// Google Drive backups. Uses Google Identity Services (token flow, scope drive.file: the app can only
// see files it created itself). A dated JSON backup is written to a "CISPOLstore sauvegardes" folder,
// manually or automatically while the app is open. Independent from the Supabase sync.
(() => {
  'use strict';
  const App = window.App, $ = App.$, esc = App.esc, F = App.f;
  const KEY = 'cispolstore-drive', SCOPE = 'https://www.googleapis.com/auth/drive.file', FOLDER = 'CISPOLstore sauvegardes', KEEP = 30;
  const API = 'https://www.googleapis.com/drive/v3/files', UP = 'https://www.googleapis.com/upload/drive/v3/files';

  let cfg = {}; try { cfg = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
  const saveCfg = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {} };
  const D = App.drive = { status: cfg.connected ? 'idle' : 'off', error: '' };
  let tok = null, tokExp = 0, busy = false, dirty = true, timer = null, warned = false;
  D.configured = () => !!cfg.clientId;
  D.lastDate = () => cfg.last ? App.iso(new Date(cfg.last)) : '';

  // ---------- Google sign-in ----------
  const loadGis = () => new Promise((ok, ko) => {
    if (window.google && google.accounts && google.accounts.oauth2) return ok();
    const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = () => ok(); s.onerror = () => ko(Object.assign(new Error('Impossible de joindre Google (connexion internet ?)'), { code: 'network' }));
    document.head.appendChild(s);
  });
  // interactive = true opens the Google window (needs a tap); false only reuses an existing Google session silently
  const getToken = async interactive => {
    if (tok && Date.now() < tokExp) return tok;
    await loadGis();
    return new Promise((ok, ko) => {
      const tc = google.accounts.oauth2.initTokenClient({
        client_id: cfg.clientId, scope: SCOPE,
        callback: r => {
          if (r.error) return ko(Object.assign(new Error(r.error_description || r.error), { code: r.error }));
          tok = r.access_token; tokExp = Date.now() + ((+r.expires_in || 3600) - 60) * 1000; cfg.connected = true; saveCfg(); ok(tok);
        },
        error_callback: e => ko(Object.assign(new Error(e && e.type === 'popup_closed' ? 'Fenêtre Google fermée avant la fin' : 'Connexion Google impossible (' + ((e && e.type) || 'erreur') + ')'), { code: (e && e.type) || 'popup' }))
      });
      tc.requestAccessToken({ prompt: interactive ? '' : 'none' });
    });
  };
  const NEED_LOGIN = ['interaction_required', 'access_denied', 'auth', 'popup_closed', 'popup_failed_to_open', 'immediate_failed', 'user_logged_out', 'consent_required', 'login_required', 'popup', 'unknown'];

  // ---------- Drive REST ----------
  const gfetch = async (url, o = {}) => {
    const r = await fetch(url, { ...o, headers: { Authorization: 'Bearer ' + tok, ...(o.headers || {}) } });
    if (r.status === 401) { tok = null; throw Object.assign(new Error('Reconnexion à Google nécessaire'), { code: 'auth' }); }
    if (!r.ok) { let m = ''; try { m = (await r.json()).error.message; } catch (e) {} throw Object.assign(new Error('Google Drive : ' + (m || r.status)), { status: r.status }); }
    if (r.status === 204) return null;
    return (r.headers.get('content-type') || '').includes('json') ? r.json() : r.text();
  };
  const list = q => gfetch(`${API}?q=${encodeURIComponent(q)}&orderBy=${encodeURIComponent('createdTime desc')}&pageSize=100&fields=${encodeURIComponent('files(id,name,createdTime,size)')}`).then(r => r.files || []);
  const multipart = (meta, content, mime = 'application/json') => { const b = 'cispol' + Date.now(); return { body: new Blob([`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: ${mime}\r\n\r\n`, content, `\r\n--${b}--`]), headers: { 'Content-Type': 'multipart/related; boundary=' + b } }; };
  // create the file in the backup folder, or overwrite today's file of the same name
  const upsert = async (fid, name, content, mime) => {
    const ex = (await list(`name='${name}' and '${fid}' in parents and trashed=false`))[0], m = multipart(ex ? { name } : { name, parents: [fid] }, content, mime);
    await gfetch(ex ? `${UP}/${ex.id}?uploadType=multipart&fields=id` : `${UP}?uploadType=multipart&fields=id`, { method: ex ? 'PATCH' : 'POST', ...m });
  };
  const folder = async () => {
    if (cfg.folderId) { try { const f = await gfetch(`${API}/${cfg.folderId}?fields=id,trashed`); if (!f.trashed) return cfg.folderId; } catch (e) { if (e.status !== 404) throw e; } }
    const found = await list(`name='${FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    const f = found[0] || await gfetch(API + '?fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: FOLDER, mimeType: 'application/vnd.google-apps.folder' }) });
    cfg.folderId = f.id; saveCfg(); return f.id;
  };

  // ---------- Backup ----------
  const setStatus = (st, err = '') => { D.status = st; D.error = err; };
  D.backupNow = async interactive => {
    if (!cfg.clientId) throw new Error('Google Drive n\'est pas configuré');
    if (busy) return; busy = true; setStatus('busy');
    try {
      await getToken(!!interactive);
      const fid = await folder(), name = `cispolstore-${App.today()}.json`, base = name.slice(0, -5);
      await upsert(fid, name, JSON.stringify(App.exportData()));
      // readable Excel copy; the JSON above is what "Restaurer" uses, so a failure here is not fatal
      let extra = '';
      try { await upsert(fid, base + '.xlsx', App.makeXlsx(App.reportSheets()), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); } catch (e) { if (e.code === 'auth') throw e; extra = e.message; }
      // keep the 30 most recent files of each kind, move older ones to the Drive trash
      const all = await list(`'${fid}' in parents and trashed=false and name contains 'cispolstore-'`);
      for (const ext of ['.json', '.xlsx']) for (const f of all.filter(f => f.name.endsWith(ext)).slice(KEEP)) await gfetch(`${API}/${f.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) });
      cfg.last = Date.now(); cfg.lastName = name; cfg.extraErr = extra; cfg.connected = true; saveCfg(); dirty = false; setStatus('idle'); warned = false;
      return name;
    } catch (e) {
      setStatus(NEED_LOGIN.includes(e.code) ? 'reconnect' : 'error', e.message); throw e;
    } finally { busy = false; }
  };

  // ---------- Automatic backups (while the app is open) ----------
  const everyMs = () => ({ 1: 1, 6: 6, 24: 24 }[cfg.every] || 24) * 3600e3;
  const due = () => cfg.connected && cfg.auto && dirty && Date.now() - (cfg.last || 0) >= everyMs();
  D.tick = async () => {
    if (!due() || busy || !navigator.onLine) return;
    try { await D.backupNow(false); } catch (e) {
      if (D.status === 'reconnect' && !warned) { warned = true; App.toast('Sauvegarde Drive : reconnexion nécessaire (Paramètres)'); }
    }
    if (App.state.view === 'settings' && !document.getElementById('dlg').open) App.refresh();
  };
  const prevAfterSave = App.afterSave;
  App.afterSave = () => { if (prevAfterSave) prevAfterSave(); dirty = true; clearTimeout(timer); timer = setTimeout(D.tick, 30000); };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(D.tick, 1500); });
  setInterval(D.tick, 5 * 60 * 1000);
  setTimeout(D.tick, 8000);

  // ---------- Settings card ----------
  const EVERY = [['', 'Désactivée'], ['1', 'Toutes les heures (si changement)'], ['6', 'Toutes les 6 heures (si changement)'], ['24', 'Une fois par jour (si changement)']];
  const when = ts => ts ? new Date(ts).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : 'jamais';
  App.driveCard = () => {
    const row = (t, s, b) => `<div class="item"><div class="grow"><b>${t}</b><small style="white-space:normal">${s}</small></div>${b || ''}</div>`;
    let body;
    if (!cfg.clientId) body = row('État', 'Non configuré. Sauvegardes datées dans votre Google Drive, sans toucher au reste de votre Drive.', '<button class="btn sm" data-act="drive_setup">Configurer</button>');
    else if (!cfg.connected) body = row('État', 'Configuré, pas encore connecté à votre compte Google.', '<button class="btn sm" data-act="drive_connect">Connecter à Google</button>') + row('Identifiant', esc(cfg.clientId.slice(0, 18)) + '…', '<button class="btn sm del" data-act="drive_off">Retirer</button>');
    else {
      const st = { busy: 'Sauvegarde en cours…', reconnect: 'Reconnexion à Google nécessaire', error: 'Erreur : ' + esc(D.error) }[D.status] || 'Connecté';
      const cls = { reconnect: 'warn', error: 'bad' }[D.status] || 'ok';
      body = row('État', `<b class="${cls}">${st}</b><br>Dernière sauvegarde : <b>${when(cfg.last)}</b>${cfg.lastName ? ' · ' + esc(cfg.lastName) : ''}<br>Fichiers : JSON (restauration), Excel (lecture)${cfg.extraErr ? '<br><span class="warn">Excel non envoyé : ' + esc(cfg.extraErr) + '</span>' : ''}`, D.status === 'reconnect' ? '<button class="btn sm" data-act="drive_connect">Reconnecter</button>' : '<button class="btn sm" data-act="drive_now">Sauvegarder</button>')
        + `<div class="item"><div class="grow"><b>Sauvegarde automatique</b><small>Quand l'application est ouverte</small></div><select id="d_every" style="width:auto;max-width:55%">${App.opts(EVERY, cfg.auto ? String(cfg.every || 24) : '')}</select></div>`
        + row('Restaurer depuis Drive', 'Choisir une sauvegarde datée (.json).', '<button class="btn sm sec" data-act="drive_restore">Choisir…</button>')
        + row('Déconnexion', 'Les sauvegardes déjà dans Drive sont conservées.', '<button class="btn sm del" data-act="drive_off">Déconnecter</button>');
    }
    return `<h2 class="sec">Sauvegarde Google Drive</h2><div class="list">${body}</div>`;
  };
  document.addEventListener('change', e => {
    if (e.target.id !== 'd_every') return;
    cfg.auto = !!e.target.value; if (e.target.value) cfg.every = +e.target.value; saveCfg();
    App.toast(cfg.auto ? 'Sauvegarde automatique activée' : 'Sauvegarde automatique désactivée');
  });

  const refreshSettings = () => { if (App.state.view === 'settings' && !document.getElementById('dlg').open) App.refresh(); };
  App.actions.drive_setup = () => {
    App.modal('Google Drive',
      `<div class="card" style="font-size:14px"><b>À faire une seule fois (10 minutes, sur ordinateur)</b>
        <ol style="margin:8px 0 0;padding-left:18px">
          <li>Allez sur <b>console.cloud.google.com</b> et créez un projet (nom : CISPOLstore).</li>
          <li><b>APIs et services → Bibliothèque</b> : cherchez <b>Google Drive API</b> → <b>Activer</b>.</li>
          <li><b>Écran de consentement OAuth</b> (ou « Google Auth Platform ») : type <b>Externe</b>, nom de l'application « CISPOLstore Manager », votre e-mail. Ajoutez la portée <b>…/auth/drive.file</b>, puis <b>publiez l'application</b> (« En production ») : sinon l'autorisation expire au bout de 7 jours.</li>
          <li><b>Identifiants → Créer des identifiants → ID client OAuth</b> : type <b>Application Web</b>. Dans <b>Origines JavaScript autorisées</b>, ajoutez : <b id="d_origin">${esc(location.origin)}</b></li>
          <li>Copiez l'<b>ID client</b> (il finit par <code>.apps.googleusercontent.com</code>) et collez-le ci-dessous.</li></ol>
        <div class="bar"><button type="button" class="btn sm sec" data-act="copy" data-t="${esc(location.origin)}">📋 Copier l'adresse autorisée</button></div></div>
       ${F.text('d_cid', 'ID client Google', cfg.clientId || '', 'placeholder="123456789-abc….apps.googleusercontent.com" autocapitalize="none" autocomplete="off"')}
       <p class="mut" style="font-size:13px">Seuls les fichiers créés par l'application sont visibles par elle : jamais le reste de votre Drive. Les sauvegardes sont des fichiers JSON lisibles dans votre Drive (protégez votre compte Google).</p><p id="d_msg" class="warn"></p>`,
      () => {
        const id = App.v('d_cid');
        if (!/^\S+\.apps\.googleusercontent\.com$/.test(id)) { $('d_msg').textContent = "Cet identifiant ne ressemble pas à un ID client Google (il finit par .apps.googleusercontent.com)."; return false; }
        if (id !== cfg.clientId) { cfg = { clientId: id }; tok = null; saveCfg(); }
        App.close(); setTimeout(App.actions.drive_connect, 50);
      }, 'Enregistrer et connecter');
  };
  App.actions.drive_connect = async () => {
    App.toast('Connexion à Google…');
    try { await D.backupNow(true); App.toast('Connecté : première sauvegarde envoyée sur Drive'); }
    catch (e) { App.toast(e.message); }
    refreshSettings();
  };
  App.actions.drive_now = async () => {
    App.toast('Sauvegarde sur Drive…');
    try { const n = await D.backupNow(true); App.toast('Sauvegarde envoyée : ' + n); }
    catch (e) { App.toast(e.message); }
    refreshSettings();
  };
  App.actions.drive_off = () => { if (!App.confirm('Déconnecter Google Drive de cette application ?')) return; if (tok && window.google && google.accounts) { try { google.accounts.oauth2.revoke(tok, () => {}); } catch (e) {} } tok = null; cfg = {}; saveCfg(); setStatus('off'); refreshSettings(); App.toast('Google Drive déconnecté'); };
  App.actions.drive_restore = async () => {
    try {
      await getToken(true); const fid = await folder(), files = (await list(`'${fid}' in parents and trashed=false and name contains 'cispolstore-'`)).filter(f => f.name.endsWith('.json'));
      if (!files.length) return App.toast('Aucune sauvegarde dans Drive');
      App.modal('Restaurer depuis Drive', `<p class="mut">Choisissez la sauvegarde à recharger. Elle remplacera les données de cet appareil.</p><div class="list">${files.map(f => `<button class="item" data-act="drive_pick" data-id="${esc(f.id)}"><div class="grow"><b>${esc(f.name)}</b><small>${when(f.createdTime)}${f.size ? ' · ' + Math.round(f.size / 1024) + ' Ko' : ''}</small></div><span class="mut">›</span></button>`).join('')}</div>`);
    } catch (e) { App.toast(e.message); }
  };
  App.actions.drive_pick = async d => {
    try { const text = await gfetch(`${API}/${d.id}?alt=media`); App.close(); App.restoreData(typeof text === 'string' ? text : JSON.stringify(text)); }
    catch (e) { App.toast(e.message); }
  };
})();
