// Starlink e-mails: reads the Starlink notices in the user's Gmail (read-only) and updates the status of the matching client, found by its ACC number.
// Same Google sign-in as the Drive backup (Google Identity Services, token flow): nothing is stored on a server, tokens live in memory for one hour.
(() => {
  'use strict';
  const App = window.App, $ = App.$, esc = App.esc, F = App.f;
  const KEY = 'cispolstore-gmail', DRIVE_KEY = 'cispolstore-drive', SCOPE = 'https://www.googleapis.com/auth/gmail.readonly', API = 'https://gmail.googleapis.com/gmail/v1/users/me';
  const FIRST_DAYS = 30, MAX_MSG = 300, MAX_LOG = 600, DUP_MS = 30 * 60e3;

  let cfg = {}; try { cfg = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
  cfg.accounts = Array.isArray(cfg.accounts) ? cfg.accounts : [];
  const saveCfg = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {} };
  const driveId = () => { try { return (JSON.parse(localStorage.getItem(DRIVE_KEY)) || {}).clientId || ''; } catch (e) { return ''; } };
  const clientId = () => cfg.clientId || driveId();
  const L = App.slmail = { status: 'idle', error: '' };
  const log = () => (App.db.slmail = App.db.slmail || []);
  const when = ts => ts ? new Date(ts).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : 'jamais';
  let busy = false, tab = 'alerts';

  // ---------- reading one e-mail ----------
  // state shown on the client: kind of the last Starlink e-mail received for its ACC
  const STATES = { echec: ['⚠️', 'Paiement échoué', 'warn', 1], avis: ['⏳', 'Suspension imminente', 'bad', 2], suspendu: ['⛔', 'Suspendu', 'bad', 3], actif: ['✅', 'Réactivé', 'ok', 0] };
  const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  // ACC-DF-16170842-48858-58 : may be cut by a line break, glued to the previous word, or written with another hyphen
  const extractAcc = text => {
    const t = String(text || '').replace(/[‐-―−]/g, '-').replace(/(\d)-\s+(\d)/g, '$1-$2').replace(/ACC\s*-\s*DF/gi, 'ACC-DF');
    const m = /ACC-?DF-?(\d{5,})-(\d{3,})-(\d{1,3})(?!\d)/i.exec(t);
    return m ? `ACC-DF-${m[1]}-${m[2]}-${m[3]}` : '';
  };
  // two ACC are the same account when their digits are the same (spaces, hyphens, prefix and case do not matter)
  const accKey = acc => { const d = String(acc || '').replace(/\D/g, ''); return d.length >= 10 ? d : ''; };
  const money = s => { let t = String(s).replace(/[\s  ]/g, ''); if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, '').replace(',', '.'); else t = t.replace(/,/g, ''); const n = parseFloat(t); return isNaN(n) ? 0 : n; };
  const kindOf = (subject, body) => {
    const s = fold(subject), b = fold(body);
    if (/echec (du|de) paiement/.test(s) || /echec de paiement/.test(b)) return 'echec';
    if (/^suspension de votre service/.test(s) || /sera suspendu dans/.test(b) || /avis de suspension/.test(b)) return 'avis';
    if (/service (starlink )?suspendu/.test(s) || /service starlink a ete suspendu|service a ete suspendu/.test(b)) return 'suspendu';
    if (/reactiv/.test(s) || /reactiv/.test(b)) return 'actif';
    return '';
  };
  // m: { subject, text, ts } -> { kind, acc, amount, cur, days } ; kind '' = a Starlink e-mail we do not know yet
  L.parse = m => {
    const text = String(m.text || ''), acc = extractAcc(text) || extractAcc(m.subject), kind = kindOf(m.subject, text), out = { kind, acc, amount: 0, cur: '', days: 0 };
    const a = /montant du paiement\s*([A-Z]{3}|US\$|\$)?\s*(\d[\d\s  .,]*\d)/i.exec(text); if (a) { out.cur = (a[1] || 'CDF').replace('US$', 'USD').replace('$', 'USD').toUpperCase(); out.amount = money(a[2]); }
    const d = /dans\s+(\d+)\s+jour/i.exec(text); if (d) out.days = +d[1];
    return out;
  };

  // ---------- applying it to the client ----------
  const clientsFor = acc => { const k = accKey(acc); return k ? App.db.clients.filter(c => accKey(c.acc) === k) : []; };
  const apply = e => {
    if (!e.kind) { e.res = 'inconnu'; return; }
    const cs = clientsFor(e.acc); if (!cs.length) { e.res = 'sans-client'; return; } if (cs.length > 1) { e.res = 'ambigu'; return; }
    const c = cs[0]; e.clientId = c.id;
    if (c.slm && c.slm.ts > e.ts) { e.res = 'ancien'; return; } // a more recent e-mail was already applied
    e.prev = c.slm ? { ...c.slm } : null; c.slm = { state: e.kind, ts: e.ts, amount: e.amount || 0, cur: e.cur || '', mid: e.id }; e.res = 'ok';
  };
  // an e-mail whose ACC was not known yet is tried again once the client has it
  const rematch = () => { let n = 0; log().slice().sort((a, b) => a.ts - b.ts).forEach(e => { if (e.res === 'sans-client' || e.res === 'ambigu') { apply(e); if (e.res === 'ok') n++; } }); return n; };
  // the same notice arriving in two mailboxes (forwarding) is counted once
  const isDup = e => log().some(x => x.id !== e.id && x.acc === e.acc && x.kind === e.kind && x.amount === e.amount && Math.abs(x.ts - e.ts) < DUP_MS);
  L.ingest = (m, mailbox) => {
    const id = mailbox + ':' + m.id, p = L.parse(m); if (!p.acc) return null; // not about an account: ignored
    const e = { id, ts: m.ts, acc: p.acc, kind: p.kind, amount: p.amount, cur: p.cur, days: p.days, subject: String(m.subject || '').slice(0, 120), mailbox, res: '' };
    if (isDup(e)) return null;
    apply(e); log().push(e); if (log().length > MAX_LOG) App.db.slmail = log().slice(-MAX_LOG);
    return e;
  };
  L.alerts = () => App.db.clients.filter(c => c.slm && STATES[c.slm.state] && STATES[c.slm.state][3] > 0).sort((a, b) => STATES[b.slm.state][3] - STATES[a.slm.state][3] || b.slm.ts - a.slm.ts);
  L.count = () => L.alerts().length;
  App.slBadge = c => { const s = c.slm && STATES[c.slm.state]; return s && s[3] > 0 ? `<span class="pill ${s[2]}" title="Dernier e-mail Starlink : ${when(c.slm.ts)}">${s[1]}</span>` : ''; };
  App.slLine = c => { const s = c.slm && STATES[c.slm.state]; if (!s) return ''; return `<div class="mut" style="margin-top:6px">E-mail Starlink du ${when(c.slm.ts)} : <b class="${s[2]}">${s[0]} ${s[1]}</b>${c.slm.amount ? ' · ' + App.nf(c.slm.amount, 2) + ' ' + esc(c.slm.cur || '') : ''}</div>`; };

  App.slRow = c => { const s = c.slm && STATES[c.slm.state]; return s ? `<dt>E-mail Starlink</dt><dd><span class="${s[2]}">${s[0]} ${s[1]}</span> · ${when(c.slm.ts)}${c.slm.amount ? ' · ' + App.nf(c.slm.amount, 2) + ' ' + esc(c.slm.cur || '') : ''}</dd>` : ''; };

  // ---------- Google sign-in and Gmail REST ----------
  const loadGis = () => new Promise((ok, ko) => {
    if (window.google && google.accounts && google.accounts.oauth2) return ok();
    const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = () => ok(); s.onerror = () => ko(Object.assign(new Error('Impossible de joindre Google (connexion internet ?)'), { code: 'network' }));
    document.head.appendChild(s);
  });
  const toks = {};
  const gf = async (url, tok) => {
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + tok } });
    if (r.status === 401) throw Object.assign(new Error('Reconnexion à Google nécessaire'), { code: 'auth' });
    if (!r.ok) { let m = ''; try { m = (await r.json()).error.message; } catch (e) {} throw Object.assign(new Error('Gmail : ' + (m || r.status)), { status: r.status }); }
    return r.json();
  };
  // email '' = pick any Google account (adding a mailbox); interactive false = reuse the existing Google session silently
  const getToken = async (email, interactive) => {
    const t0 = email && toks[email.toLowerCase()]; if (t0 && Date.now() < t0.exp) return t0.tok;
    if (!clientId()) throw Object.assign(new Error("Identifiant Google non configuré (Réglages → E-mails Starlink)"), { code: 'config' });
    await loadGis();
    const t = await new Promise((ok, ko) => {
      const tc = google.accounts.oauth2.initTokenClient({
        client_id: clientId(), scope: SCOPE, login_hint: email || undefined,
        callback: r => r.error ? ko(Object.assign(new Error(r.error_description || r.error), { code: r.error })) : ok({ tok: r.access_token, exp: Date.now() + ((+r.expires_in || 3600) - 60) * 1000 }),
        error_callback: e => ko(Object.assign(new Error(e && e.type === 'popup_closed' ? 'Fenêtre Google fermée avant la fin' : 'Connexion Google impossible (' + ((e && e.type) || 'erreur') + ')'), { code: (e && e.type) || 'popup' }))
      });
      tc.requestAccessToken({ prompt: interactive ? (email ? '' : 'select_account') : 'none' });
    });
    const who = ((await gf(API + '/profile', t.tok)).emailAddress || '').toLowerCase();
    if (email && who !== email.toLowerCase()) throw Object.assign(new Error(`Mauvais compte Google : ${who} au lieu de ${email}`), { code: 'wrong' });
    toks[who] = t; t.email = who; return t.tok;
  };
  const b64 = s => { const bin = atob(String(s).replace(/-/g, '+').replace(/_/g, '/')); return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))); };
  const textOf = payload => {
    let plain = '', html = ''; const walk = x => { const d = x.body && x.body.data; if (d && x.mimeType === 'text/plain') plain += b64(d); else if (d && x.mimeType === 'text/html') html += b64(d); (x.parts || []).forEach(walk); }; walk(payload || {});
    return plain || (html ? (new DOMParser().parseFromString(html, 'text/html').body.textContent || '') : '');
  };
  const header = (msg, name) => ((((msg.payload || {}).headers) || []).find(h => String(h.name).toLowerCase() === name) || {}).value || '';
  const syncAccount = async (a, interactive) => {
    const tok = await getToken(a.email, interactive), since = a.last ? Math.floor((a.last - 2 * 864e5) / 1000) : Math.floor((Date.now() - FIRST_DAYS * 864e5) / 1000);
    const q = encodeURIComponent(`from:starlink.com after:${since}`), have = new Set(log().map(e => e.id)), seen = new Set(a.seen || []);
    let ids = [], page = ''; do { const r = await gf(`${API}/messages?q=${q}&maxResults=100${page ? '&pageToken=' + page : ''}`, tok); ids = ids.concat((r.messages || []).map(x => x.id)); page = r.nextPageToken || ''; } while (page && ids.length < MAX_MSG);
    let added = 0;
    for (const id of ids.slice(0, MAX_MSG)) {
      if (have.has(a.email + ':' + id) || seen.has(id)) continue;
      const m = await gf(`${API}/messages/${id}?format=full`, tok), from = header(m, 'from');
      if (!/starlink\.com/i.test(from)) { seen.add(id); continue; }
      const e = L.ingest({ id, subject: header(m, 'subject'), text: textOf(m.payload), ts: +m.internalDate || Date.now() }, a.email);
      if (e) added++; else seen.add(id);
    }
    a.seen = [...seen].slice(-500); a.last = Date.now(); delete a.err; return added;
  };
  const NEED_LOGIN = ['interaction_required', 'access_denied', 'auth', 'popup_closed', 'popup_failed_to_open', 'immediate_failed', 'user_logged_out', 'consent_required', 'login_required', 'popup', 'unknown'];
  L.check = async interactive => {
    if (busy || !cfg.accounts.length) return 0; busy = true; L.status = 'busy'; redraw();
    let added = 0; const errs = [];
    for (const a of cfg.accounts) { try { added += await syncAccount(a, interactive); } catch (e) { a.err = NEED_LOGIN.includes(e.code) ? 'reconnect' : e.message; errs.push(a.err === 'reconnect' ? 'reconnexion nécessaire pour ' + a.email : e.message); } }
    const re = rematch(); cfg.lastCheck = Date.now(); saveCfg(); App.save();
    L.status = errs.length ? 'error' : 'idle'; L.error = errs.join(' · '); busy = false;
    if (interactive) App.toast(errs.length ? errs[0] : added ? `${added} e-mail(s) Starlink lu(s)` + (re ? `, ${re} rapproché(s)` : '') : 'Aucun nouvel e-mail Starlink');
    App.refresh(); return added;
  };
  L.needsAttention = () => cfg.accounts.some(a => a.err === 'reconnect');
  const redraw = () => { if (['settings', 'slmail'].includes(App.state.view) && !document.getElementById('dlg').open) App.refresh(); };

  // ---------- settings card ----------
  App.slmailCard = () => {
    const row = (t, s, b) => `<div class="item"><div class="grow"><b>${t}</b><small style="white-space:normal">${s}</small></div>${b || ''}</div>`;
    let body;
    if (!clientId()) body = row('État', "Non configuré. L'application lit les e-mails de Starlink (échec de paiement, suspension, réactivation) et met à jour le client grâce à son numéro ACC. Lecture seule : rien n'est envoyé, rien n'est supprimé.", '<button class="btn sm" data-act="slm_setup">Configurer</button>');
    else {
      const st = { busy: 'Lecture des e-mails…', error: 'Erreur : ' + esc(L.error) }[L.status] || (L.needsAttention() ? 'Reconnexion à Google nécessaire' : 'Prêt'), cls = { error: 'bad' }[L.status] || (L.needsAttention() ? 'warn' : 'ok');
      body = row('État', `<b class="${cls}">${st}</b><br>Dernière vérification : <b>${when(cfg.lastCheck)}</b>`, cfg.accounts.length ? '<button class="btn sm" data-act="slm_check">Vérifier maintenant</button>' : '')
        + cfg.accounts.map((a, i) => row('📧 ' + esc(a.email), a.err === 'reconnect' ? '<span class="warn">Reconnexion nécessaire : touchez « Vérifier maintenant »</span>' : a.err ? '<span class="bad">' + esc(a.err) + '</span>' : 'Dernière lecture : ' + when(a.last), `<button class="btn sm del" data-act="slm_remove" data-v="${i}">Retirer</button>`)).join('')
        + row('Ajouter une boîte Gmail', 'Vous pouvez en lier plusieurs (par exemple la boîte qui reçoit les e-mails de paiement et celle qui reçoit les suspensions).', '<button class="btn sm" data-act="slm_add">+ Gmail</button>')
        + row('Alertes et journal', `${L.count()} alerte(s) en cours`, '<button class="btn sm sec" data-act="go" data-v="slmail">Ouvrir</button>')
        + row('Identifiant Google', esc(clientId().slice(0, 18)) + '…', '<button class="btn sm sec" data-act="slm_setup">Modifier</button>');
    }
    return `<h2 class="sec">E-mails Starlink (Gmail)</h2><div class="list">${body}</div>`;
  };
  App.actions.slm_setup = () => {
    App.modal('E-mails Starlink : Google',
      `<div class="card" style="font-size:14px"><b>À faire une seule fois</b>
        <p style="margin:6px 0">Si la sauvegarde Google Drive est déjà configurée, c'est le <b>même projet Google</b> : il suffit d'y ajouter Gmail.</p>
        <ol style="margin:8px 0 0;padding-left:18px">
          <li>Sur <b>console.cloud.google.com</b>, dans votre projet : <b>APIs et services → Bibliothèque</b> → <b>Gmail API</b> → <b>Activer</b>.</li>
          <li><b>Écran de consentement OAuth → Accès aux données</b> : ajoutez la portée <code>.../auth/gmail.readonly</code> (lecture seule).</li>
          <li>En mode « Test » : <b>Audience → Utilisateurs test</b> : ajoutez chaque adresse Gmail à lier.</li>
          <li>L'ID client est le même que pour Drive (il finit par <code>.apps.googleusercontent.com</code>). Vérifiez-le ci-dessous.</li></ol></div>
       ${F.text('slm_cid', 'ID client Google', clientId(), 'placeholder="123456789-abc….apps.googleusercontent.com" autocapitalize="none" autocomplete="off"')}
       <p class="mut" style="font-size:13px">L'application ne lit que les e-mails venant de starlink.com. Elle ne peut ni envoyer, ni modifier, ni supprimer de message.</p><p id="slm_msg" class="warn"></p>`,
      () => {
        const id = App.v('slm_cid');
        if (!/^\S+\.apps\.googleusercontent\.com$/.test(id)) { $('slm_msg').textContent = "Cet identifiant ne ressemble pas à un ID client Google (il finit par .apps.googleusercontent.com)."; return false; }
        cfg.clientId = id; saveCfg(); App.close(); App.refresh();
      }, 'Enregistrer');
  };
  App.actions.slm_add = async () => {
    if (!clientId()) return App.actions.slm_setup();
    try {
      App.toast('Choisissez le compte Gmail…'); await getToken('', true);
      const email = Object.keys(toks).filter(k => !cfg.accounts.some(a => a.email.toLowerCase() === k)).pop();
      if (!email) return App.toast('Ce compte est déjà lié');
      cfg.accounts.push({ email }); saveCfg(); App.refresh(); App.toast(email + ' lié : lecture des e-mails…'); L.check(true);
    } catch (e) { App.toast(e.message); }
  };
  App.actions.slm_remove = d => { const a = cfg.accounts[+d.v]; if (!a || !App.confirm('Retirer ' + a.email + ' ? Les alertes déjà créées sont conservées.')) return; if (toks[a.email.toLowerCase()] && window.google && google.accounts) { try { google.accounts.oauth2.revoke(toks[a.email.toLowerCase()].tok, () => {}); } catch (e) {} } delete toks[a.email.toLowerCase()]; cfg.accounts.splice(+d.v, 1); saveCfg(); App.refresh(); };
  App.actions.slm_check = () => L.check(true);
  App.actions.slm_tab = d => { tab = d.v; App.refresh(); };

  // ---------- screen: alerts, journal, to check ----------
  const MSG = {
    echec: (n, c) => `Bonjour ${n}, Starlink n'a pas pu prélever le paiement de votre abonnement${c.slm.amount ? ' (' + App.nf(c.slm.amount, 2) + ' ' + (c.slm.cur || '') + ')' : ''}. Merci de régulariser rapidement pour éviter la suspension de votre service. CISPOLstore`,
    avis: n => `Bonjour ${n}, votre service Starlink va être suspendu très prochainement pour paiement non reçu. Merci de régulariser aujourd'hui pour ne pas perdre la connexion. CISPOLstore`,
    suspendu: n => `Bonjour ${n}, votre service Starlink est suspendu pour solde impayé. Dès que vous aurez régularisé, nous le faisons réactiver. CISPOLstore`
  };
  const RES = { ok: ['✅', 'Appliqué'], ancien: ['🕓', 'Ancien : un e-mail plus récent est déjà appliqué'], 'sans-client': ['❓', 'Aucun client avec cet ACC'], ambigu: ['❗', 'Plusieurs clients ont cet ACC'], inconnu: ['📨', 'Type d\'e-mail non reconnu'], annule: ['↩️', 'Annulé'] };
  App.views.slmail = () => {
    const al = L.alerts(), lg = log().slice().sort((a, b) => b.ts - a.ts), todo = lg.filter(e => ['sans-client', 'ambigu', 'inconnu'].includes(e.res));
    const chip = (k, t) => `<button class="chip ${tab === k ? 'on' : ''}" data-act="slm_tab" data-v="${k}">${t}</button>`;
    const cnt = k => al.filter(c => c.slm.state === k).length;
    const first = c => c.first || App.cname(c);
    const alertRow = c => { const s = STATES[c.slm.state];
      return `<div class="card"><div class="spread"><b>${esc(App.cname(c))}</b><span class="pill ${s[2]}">${s[1]}</span></div><small class="mono" style="word-break:break-all">${esc(c.acc)}</small>
        <div class="mut" style="margin-top:4px">${when(c.slm.ts)}${c.slm.amount ? ' · ' + App.nf(c.slm.amount, 2) + ' ' + esc(c.slm.cur || '') : ''}</div>
        <div class="bar">${c.phone ? `<button class="btn sm" data-act="slm_wa" data-id="${c.id}">💬 Relancer</button>` : ''}<button class="btn sm sec" data-act="go" data-v="client" data-id="${c.id}">Fiche</button><button class="btn sm sec" data-act="slm_done" data-id="${c.id}">✔ Réglé</button></div></div>`; };
    const logRow = e => { const r = RES[e.res] || ['', e.res], k = STATES[e.kind], c = App.client(e.clientId);
      return `<div class="item"><div class="grow"><b style="white-space:normal">${k ? k[0] + ' ' + k[1] : '📨 ' + esc(e.subject)}${e.amount ? ' · ' + App.nf(e.amount, 2) + ' ' + esc(e.cur) : ''}</b><small style="white-space:normal">${when(e.ts)} · ${c ? esc(App.cname(c)) : '—'} · <span class="mono">${esc(e.acc)}</span><br>${r[0]} ${r[1]} · ${esc(e.mailbox)}</small></div>${e.res === 'ok' ? `<button class="btn sm sec" data-act="slm_undo" data-id="${esc(e.id)}">Annuler</button>` : e.res === 'sans-client' || e.res === 'ambigu' ? `<button class="btn sm sec" data-act="copy" data-t="${esc(e.acc)}">Copier ACC</button>` : ''}</div>`; };
    const body = tab === 'journal' ? `<div class="list">${lg.length ? lg.slice(0, 100).map(logRow).join('') : '<div class="empty">Aucun e-mail lu pour le moment.</div>'}</div>`
      : tab === 'todo' ? `<p class="mut" style="font-size:13px">Ces e-mails n'ont modifié aucun client. Ajoutez l'ACC sur la fiche du bon client : il sera rapproché à la prochaine vérification.</p><div class="list">${todo.length ? todo.map(logRow).join('') : '<div class="empty">Rien à vérifier 🎉</div>'}</div>`
      : al.length ? al.map(alertRow).join('') : '<div class="card"><div class="empty">Aucune alerte Starlink en cours 🎉</div></div>';
    return { title: 'Alertes Starlink', sub: 'D\'après les e-mails de Starlink', back: 'more', nav: 'more',
      html: `<section class="hero dhero"><div class="hero-top"><div><small>📧 Clients à suivre</small><div class="hero-num">${al.length}</div></div></div>
        <div class="cstats"><div><b>${cnt('echec')}</b><small>paiement échoué</small></div><div><b>${cnt('avis')}</b><small>suspension imminente</small></div><div><b>${cnt('suspendu')}</b><small>suspendus</small></div></div></section>
        <div class="bar"><button class="btn" data-act="slm_check" ${cfg.accounts.length ? '' : 'disabled'}>🔄 Vérifier les e-mails</button>${cfg.accounts.length ? '' : '<button class="btn sec" data-act="go" data-v="settings">Configurer Gmail</button>'}</div>
        <p class="mut" style="font-size:13px;margin:0 0 8px">Dernière vérification : ${when(cfg.lastCheck)} · ${cfg.accounts.length} boîte(s) Gmail liée(s)</p>
        <div class="chips">${chip('alerts', `Alertes (${al.length})`)}${chip('journal', 'Journal')}${chip('todo', `À vérifier (${todo.length})`)}</div>${body}` };
  };
  App.actions.slm_wa = d => { const c = App.client(d.id); if (!c || !c.slm || !MSG[c.slm.state]) return; const url = App.waUrl(c.phone, MSG[c.slm.state](c.first || App.cname(c), c)); if (!url) return App.toast('Pas de numéro de téléphone'); window.open(url, '_blank', 'noopener'); };
  App.actions.slm_done = d => { const c = App.client(d.id); if (!c) return; c.slm = { state: 'actif', ts: Date.now(), manual: true }; App.save(); App.toast('Alerte clôturée'); App.refresh(); };
  App.actions.slm_undo = d => {
    const e = log().find(x => x.id === d.id), c = e && App.client(e.clientId); if (!e || e.res !== 'ok' || !c) return;
    if (!c.slm || c.slm.mid !== e.id) return App.toast("Un e-mail plus récent a été appliqué depuis : annulation impossible");
    if (e.prev) c.slm = e.prev; else delete c.slm; e.res = 'annule'; App.save(); App.refresh(); App.toast('E-mail annulé');
  };

  // check quietly when the app opens (only reuses the existing Google session: no window), then at most every 30 minutes
  const auto = () => { if (cfg.accounts.length && clientId() && App.guard('slm_check') && Date.now() - (cfg.lastCheck || 0) > 30 * 60e3) L.check(false); };
  setTimeout(auto, 4000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(auto, 1500); });
})();
