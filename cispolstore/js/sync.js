// Multi-device sync. The whole data set is encrypted on the phone (AES-GCM, key derived from a
// passphrase) and stored as one opaque row in the user's own Supabase project (see sync/supabase.sql).
// Devices merge record by record against the last synced snapshot (three-way merge), so offline edits
// made on several phones are combined instead of overwritten.
(() => {
  'use strict';
  const App = window.App, $ = App.$, esc = App.esc;
  const CKEY = 'cispolstore-sync';
  const COLL = ['clients', 'products', 'moves', 'suppliers', 'technicians', 'penalties', 'invoices', 'payments', 'installs', 'expenses', 'log'];
  const SHARED = ['company', 'rate', 'period', 'grace', 'msgs', 'plans']; // PIN, theme and auto-lock stay per device
  const js = JSON.stringify;

  let cfg = null; try { cfg = JSON.parse(localStorage.getItem(CKEY)); } catch (e) {}
  const saveCfg = () => { try { localStorage.setItem(CKEY, js(cfg)); } catch (e) {} };
  const S = App.sync = { status: cfg ? 'idle' : 'off', error: '', summary: '' };
  App.syncConfigured = () => !!cfg;

  // ---------- Crypto ----------
  const te = new TextEncoder(), td = new TextDecoder();
  const toB64 = u => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const derive = async (ws, pass) => {
    const base = await crypto.subtle.importKey('raw', te.encode(pass), 'PBKDF2', false, ['deriveBits']);
    const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: te.encode('cispolstore:' + ws), iterations: 200000, hash: 'SHA-256' }, base, 512));
    return { key: toB64(bits.slice(0, 32)), token: [...bits.slice(32)].map(b => b.toString(16).padStart(2, '0')).join('') };
  };
  const aes = k => crypto.subtle.importKey('raw', fromB64(k), 'AES-GCM', false, ['encrypt', 'decrypt']);
  const seal = async obj => {
    const iv = crypto.getRandomValues(new Uint8Array(12)), ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aes(cfg.key), te.encode(js(obj))));
    const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12); return toB64(out);
  };
  const open = async blob => { const u = fromB64(blob); return JSON.parse(td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.slice(0, 12) }, await aes(cfg.key), u.slice(12)))); };

  // ---------- Server calls ----------
  const rpc = async (fn, body) => {
    const h = { 'Content-Type': 'application/json', apikey: cfg.anon };
    if (cfg.anon.startsWith('eyJ')) h.Authorization = 'Bearer ' + cfg.anon;
    const r = await fetch(cfg.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: h, body: js(body) });
    const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) {}
    if (!r.ok) { const m = (j && (j.message || j.hint)) || t.slice(0, 160) || ('HTTP ' + r.status); const e = new Error(m); e.forbidden = /forbidden/.test(m); e.missing = r.status === 404; throw e; }
    return j;
  };
  const auth = () => ({ p_ws: cfg.ws, p_token: cfg.token });

  // ---------- Shared snapshot & merge ----------
  const keyOf = (name, x) => name === 'log' ? x.ts + '|' + x.clientId + '|' + x.text : x.id;
  const order = (name, a) => a.slice().sort((x, y) => ((x.ts || 0) - (y.ts || 0)) || String(keyOf(name, x)).localeCompare(String(keyOf(name, y))));
  const shared = d => {
    const o = {}; COLL.forEach(k => { o[k] = order(k, d[k] || []); });
    o.settings = {}; SHARED.forEach(k => { o.settings[k] = d.settings[k]; }); o.settings.invSeq = d.settings.invSeq || {}; o.settings.clientSeq = d.settings.clientSeq || 0;
    return o;
  };
  const canon = s => js(s);

  // Both sides changed the same record: keep remote, then re-apply the fields this device changed
  const conflict = (name, b, l, r) => {
    const o = { ...r };
    new Set([...Object.keys(l), ...Object.keys(b)]).forEach(k => { if (js(l[k]) !== js(b[k])) o[k] = l[k]; });
    if (name === 'products' && Number.isFinite(l.qty) && Number.isFinite(b.qty) && Number.isFinite(r.qty)) o.qty = Math.round((r.qty + (l.qty - b.qty)) * 1000) / 1000; // stock: add both devices' movements
    return o;
  };
  const mergeColl = (name, b, l, r, first) => {
    const mk = a => new Map((a || []).map(x => [keyOf(name, x), x])), mb = mk(b), ml = mk(l), mr = mk(r), out = [];
    for (const k of new Set([...mr.keys(), ...ml.keys(), ...mb.keys()])) {
      const eb = mb.get(k), el = ml.get(k), er = mr.get(k), sb = eb && js(eb), sl = el && js(el), sr = er && js(er);
      if (el && er) {
        if (sl === sr) out.push(el);
        else if (!eb) out.push(first ? er : el);           // new on both sides with different content
        else if (sr === sb) out.push(el);                  // only this device changed it
        else if (sl === sb) out.push(er);                  // only the other device changed it
        else out.push(conflict(name, eb, el, er));
      } else if (el) { if (!eb || sl !== sb) out.push(el); }   // new here, or edited here while deleted elsewhere
      else if (er) { if (!eb || sr !== sb) out.push(er); }     // new there, or edited there while deleted here
    }
    return order(name, out);
  };
  const mergeAll = (b, l, r, first) => {
    const o = { settings: {} };
    COLL.forEach(k => { o[k] = mergeColl(k, b && b[k], l[k], r[k], first); });
    SHARED.forEach(k => { const sb = b && js(b.settings[k]), sl = js(l.settings[k]), sr = js(r.settings[k]); o.settings[k] = sl === sr ? l.settings[k] : first ? r.settings[k] : sl === sb ? r.settings[k] : l.settings[k]; });
    o.settings.clientSeq = Math.max(l.settings.clientSeq || 0, r.settings.clientSeq || 0);
    o.settings.invSeq = { ...(r.settings.invSeq || {}) }; Object.entries(l.settings.invSeq || {}).forEach(([y, n]) => { o.settings.invSeq[y] = Math.max(n, o.settings.invSeq[y] || 0); });
    return o;
  };
  const apply = m => { const db = App.db; COLL.forEach(k => { db[k] = m[k]; }); Object.assign(db.settings, m.settings); };

  // Two devices can issue the same invoice number / client code while offline: renumber the later one
  const fixDuplicates = () => {
    const db = App.db; let n = 0;
    const seen = new Map();
    order('invoices', db.invoices).forEach(i => { if (seen.has(i.number) && seen.get(i.number) !== i.id) { const old = i.number; i.number = App.nextInvNumber((i.date || App.today()).slice(0, 4)); App.log(i.clientId, `Facture ${old} renumérotée ${i.number} (doublon entre appareils)`); n++; } else seen.set(i.number, i.id); });
    const codes = new Map();
    order('clients', db.clients).forEach(c => { if (codes.has(c.code) && codes.get(c.code) !== c.id) { c.code = App.nextClientCode(); n++; } else codes.set(c.code, c.id); });
    return n;
  };

  // ---------- Sync engine ----------
  let busy = false, applying = false, dirty = true, timer = null;
  const ICONS = { off: ['☁️', 'Synchronisation non configurée'], idle: ['☁️', 'Synchronisé'], busy: ['🔄', 'Synchronisation…'], error: ['⚠️', 'Erreur de synchronisation'], offline: ['📴', 'Hors connexion'] };
  const setStatus = (st, err = '') => {
    S.status = st; S.error = err;
    const b = $('syncBtn'); if (!b) return;
    b.textContent = ICONS[st][0]; b.title = ICONS[st][1] + (err ? ' : ' + err : ''); b.style.opacity = st === 'off' ? .45 : 1;
  };
  S.last = () => (cfg && cfg.last) || 0;

  S.now = async () => {
    if (!cfg || busy) return S.summary;
    busy = true; setStatus('busy'); let changed = false;
    try {
      if (!navigator.onLine) { const e = new Error('Pas de connexion internet'); e.offline = true; throw e; }
      for (let attempt = 0; attempt < 4; attempt++) {
        const head = await rpc('cispol_head', auth());
        if (head.exists && !dirty && head.version === cfg.version) { S.summary = 'Déjà à jour'; break; } // nothing new on either side
        let remote = null, version = 0;
        if (head.exists) { const r = await rpc('cispol_pull', auth()); remote = await open(r.blob); version = r.version; }
        const local = shared(App.db);
        if (remote) {
          const merged = mergeAll(cfg.base ? JSON.parse(cfg.base) : null, local, remote, !cfg.base);
          if (canon(merged) !== canon(local)) { applying = true; try { apply(merged); fixDuplicates(); App.save(); } finally { applying = false; } changed = true; }
        }
        const now = shared(App.db);
        if (remote && canon(now) === canon(remote)) { cfg.version = version; cfg.base = canon(now); S.summary = changed ? 'Données reçues' : 'Déjà à jour'; dirty = false; break; }
        const res = await rpc('cispol_push', { ...auth(), p_blob: await seal(now), p_base: version });
        if (res.ok) { cfg.version = res.version; cfg.base = canon(now); dirty = false; S.summary = changed ? 'Échangé avec les autres appareils' : 'Envoyé'; break; }
        if (attempt === 3) throw new Error('Un autre appareil synchronise en même temps, réessayez');
      }
      cfg.last = Date.now(); saveCfg(); setStatus('idle');
      if (changed && !App.locked && !document.getElementById('dlg').open) App.refresh();
      else if (App.state.view === 'settings' && !document.getElementById('dlg').open) App.refresh();
    } catch (e) {
      setStatus(e.offline || !navigator.onLine ? 'offline' : 'error', e.forbidden ? 'phrase secrète incorrecte' : e.message);
      S.summary = ICONS[S.status][1] + (S.error ? ' : ' + S.error : '');
    } finally { busy = false; }
    return S.summary;
  };
  const schedule = ms => { if (!cfg) return; clearTimeout(timer); timer = setTimeout(() => S.now(), ms); };
  App.afterSave = () => { if (cfg && !applying) { dirty = true; schedule(4000); } };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(600); });
  window.addEventListener('online', () => schedule(600));
  setInterval(() => { if (cfg && !document.hidden) { schedule(10); } }, 90000);

  // ---------- Connect / disconnect ----------
  S.connect = async ({ url, anon, ws, pass }) => {
    url = url.trim().replace(/\/+$/, ''); if (!/^https?:\/\//.test(url)) url = 'https://' + url;
    ws = ws.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
    if (!ws) throw new Error("Nom d'espace invalide");
    if (pass.length < 8) throw new Error('La phrase secrète doit contenir au moins 8 caractères');
    const keys = await derive(ws, pass), prev = cfg;
    cfg = { url, anon: anon.trim(), ws, key: keys.key, token: keys.token, base: null, version: 0, last: 0 };
    try { await rpc('cispol_head', auth()); }
    catch (e) { cfg = prev; if (e.forbidden) throw new Error('Cet espace existe déjà avec une autre phrase secrète'); if (e.missing) throw new Error("Le script SQL n'a pas été exécuté dans Supabase"); throw new Error(e.message === 'Failed to fetch' ? "Impossible de joindre l'adresse Supabase" : e.message); }
    saveCfg(); dirty = true; setStatus('idle');
    return S.now();
  };
  S.disconnect = () => { cfg = null; try { localStorage.removeItem(CKEY); } catch (e) {} setStatus('off'); S.summary = ''; };

  // ---------- Settings screen ----------
  const SQL_URL = 'sync/supabase.sql';
  App.syncCard = () => {
    const when = cfg && cfg.last ? new Date(cfg.last).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : 'jamais';
    const st = { off: 'Non configurée', idle: 'Active', busy: 'En cours…', error: 'Erreur', offline: 'Hors connexion' }[S.status];
    const cls = { idle: 'ok', error: 'bad', offline: 'warn' }[S.status] || '';
    const row = (t, s, b) => `<div class="item"><div class="grow"><b>${t}</b><small style="white-space:normal">${s}</small></div>${b || ''}</div>`;
    return `<h2 class="sec">Synchronisation entre appareils</h2><div class="list">
      ${row('État', `<b class="${cls}">${st}</b>${S.error ? ' · ' + esc(S.error) : ''}${cfg ? `<br>Espace « ${esc(cfg.ws)} » · dernière synchronisation : ${when}` : '<br>Utilisez la même application sur plusieurs téléphones ou ordinateurs.'}`, cfg ? '<button class="btn sm" data-act="syncnow">Synchroniser</button>' : '<button class="btn sm" data-act="syncsetup">Configurer</button>')}
      ${cfg ? row('Réglages', 'Données chiffrées avant l\'envoi. Chaque appareil garde son propre PIN.', '<button class="btn sm del" data-act="syncoff">Déconnecter</button>') : ''}</div>`;
  };
  App.actions.syncnow = async () => { App.toast('Synchronisation…'); App.toast(await S.now()); };
  App.actions.syncoff = () => { if (App.confirm("Déconnecter la synchronisation ? Les données restent sur cet appareil.")) { S.disconnect(); App.refresh(); } };
  App.actions.syncsql = () => { fetch(SQL_URL).then(r => r.text()).then(t => { try { navigator.clipboard.writeText(t); App.toast('Script SQL copié'); } catch (e) { App.toast('Copie impossible'); } }).catch(() => App.toast('Script indisponible')); };
  App.actions.syncsetup = () => {
    const F = App.f;
    App.modal('Synchronisation',
      `<div class="card" style="font-size:14px"><b>À faire une seule fois (5 minutes)</b>
        <ol style="margin:8px 0 0;padding-left:18px">
          <li>Créez un compte gratuit sur <b>supabase.com</b>, puis un nouveau projet.</li>
          <li>Menu <b>SQL Editor</b> → New query → collez le script ci-dessous → <b>Run</b>.</li>
          <li>Menu <b>Project Settings → API</b> : copiez l'<b>URL du projet</b> et la clé <b>anon / publishable</b>.</li>
          <li>Saisissez-les ici avec un nom d'espace et une phrase secrète. Sur chaque autre appareil, saisissez <b>exactement les mêmes 4 valeurs</b>.</li></ol>
        <div class="bar"><button type="button" class="btn sm sec" data-act="syncsql">📋 Copier le script SQL</button></div></div>
       ${F.text('f_url', 'URL du projet Supabase', cfg ? cfg.url : '', 'placeholder="https://xxxx.supabase.co" autocapitalize="none" autocomplete="off"')}
       ${F.text('f_anon', 'Clé publique (anon / publishable)', cfg ? cfg.anon : '', 'autocapitalize="none" autocomplete="off"')}
       ${F.text('f_ws', "Nom de l'espace", cfg ? cfg.ws : 'cispolstore', 'autocapitalize="none" autocomplete="off"')}
       <label class="l" for="f_pass">Phrase secrète (8 caractères minimum)</label><input id="f_pass" type="password" autocomplete="off">
       <p class="mut" style="font-size:13px">Les données sont chiffrées avec cette phrase avant l'envoi : sans elle, personne (même Supabase) ne peut les lire. <b>Notez-la</b> : elle ne peut pas être récupérée.</p>
       <p id="f_msg" class="warn"></p>`,
      () => {
        const msg = $('f_msg'), btn = $('dok'); msg.textContent = ''; btn.disabled = true; btn.textContent = 'Connexion…';
        S.connect({ url: App.v('f_url'), anon: App.v('f_anon'), ws: App.v('f_ws'), pass: $('f_pass').value }).then(r => { App.close(); App.toast('Synchronisation activée : ' + r); App.refresh(); })
          .catch(e => { msg.textContent = e.message; btn.disabled = false; btn.textContent = 'Connecter'; });
        return false;
      }, 'Connecter');
  };

  // Header cloud button
  const btn = $('syncBtn');
  if (btn) { setStatus(S.status); btn.onclick = () => { if (!cfg) App.go('settings'); else App.actions.syncnow(); }; }
  if (cfg) schedule(1500);
})();
