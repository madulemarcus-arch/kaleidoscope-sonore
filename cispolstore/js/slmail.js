// Starlink e-mails: reads the Starlink notices in the user's Gmail (read-only) and updates the status of the matching client, found by its ACC number.
// Same Google sign-in as the Drive backup (Google Identity Services, token flow): nothing is stored on a server, tokens live in memory for one hour.
(() => {
  'use strict';
  const App = window.App, $ = App.$, esc = App.esc, F = App.f;
  const KEY = 'cispolstore-gmail', DRIVE_KEY = 'cispolstore-drive', SCOPE = 'https://www.googleapis.com/auth/gmail.readonly', API = 'https://gmail.googleapis.com/gmail/v1/users/me';
  const FIRST_DAYS = 30, MAX_MSG = 300, MAX_LOG = 600, DUP_MS = 2 * 3600e3;

  let cfg = {}; try { cfg = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
  cfg.accounts = Array.isArray(cfg.accounts) ? cfg.accounts : [];
  const saveCfg = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {} };
  // The list of mailboxes, the Google client ID and the reading frequency follow the data (synced settings), so the phone shows the same mailboxes as the computer.
  // Tokens never leave the device: each device signs in to Google itself. Last change wins (cfg.gt = time of the version this device holds).
  const shareCfg = () => { if (!App.db || !App.db.settings) return; const t = Date.now(); cfg.gt = t; saveCfg(); App.db.settings.gmail = { t, clientId: clientId(), every: cfg.every, accounts: cfg.accounts.map(a => a.email) }; App.save(); };
  const adopt = () => {
    const g = App.db && App.db.settings && App.db.settings.gmail;
    if (!g) { if (App.db && App.db.settings && (cfg.accounts.length || cfg.clientId)) shareCfg(); return false; } // first time on this device: publish what it already has
    if (!(g.t > (cfg.gt || 0))) return false;
    cfg.accounts = (g.accounts || []).map(e => cfg.accounts.find(a => a.email.toLowerCase() === String(e).toLowerCase()) || { email: e });
    if (g.clientId) cfg.clientId = g.clientId; if (g.every !== undefined) cfg.every = g.every; cfg.gt = g.t; saveCfg(); return true;
  };
  const EVERY = [[24, '1 fois par jour'], [12, '2 fois par jour'], [0, 'Seulement avec « Vérifier maintenant »']];
  const everyH = () => cfg.every === undefined || cfg.every === null ? 12 : +cfg.every;
  const driveId = () => { try { return (JSON.parse(localStorage.getItem(DRIVE_KEY)) || {}).clientId || ''; } catch (e) { return ''; } };
  const clientId = () => cfg.clientId || driveId();
  const L = App.slmail = { status: 'idle', error: '' };
  const log = () => (App.db.slmail = App.db.slmail || []);
  const when = ts => ts ? new Date(ts).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : 'jamais';
  let busy = false, tab = 'alerts';

  // ---------- reading one e-mail ----------
  // state shown on the client: kind of the last Starlink e-mail received for its ACC
  const STATES = { echec: ['⚠️', 'Paiement échoué', 'warn', 1], avis: ['⏳', 'Suspension imminente', 'bad', 2], suspendu: ['⛔', 'Suspendu', 'bad', 3], actif: ['✅', 'Réactivé', 'ok', 0], paye: ['💳', 'Paiement traité', 'ok', 0] };
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
    if (/paiement (a (bien )?ete )?(traite|recu|reussi|effectue|accepte)|(traitement|reception) (de votre|du) paiement|merci pour votre paiement|nous avons (bien )?recu votre paiement/.test(s) || /paiement (a (bien )?ete )?(traite|recu|reussi|effectue|accepte)|nous avons (bien )?recu votre paiement|merci pour votre paiement/.test(b)) return 'paye'; // the payment went through: closes a failed payment / suspension notice
    if (/rappel de paiement automatique/.test(s) || /paiement programme/.test(b)) return 'programme'; // information only: next automatic debit
    return '';
  };
  // m: { subject, text, ts } -> { kind, acc, amount, cur, days } ; kind '' = a Starlink e-mail we do not know yet
  L.parse = m => {
    const text = String(m.text || ''), acc = extractAcc(text) || extractAcc(m.subject), kind = kindOf(m.subject, text), out = { kind, acc, amount: 0, cur: '', days: 0 };
    const a = /montant du paiement\s*([A-Z]{3}|US\$|\$)?\s*(\d[\d\s  .,]*\d)/i.exec(text); if (a) { out.cur = (a[1] || 'CDF').replace('US$', 'USD').replace('$', 'USD').toUpperCase(); out.amount = money(a[2]); }
    const d = /dans\s+(\d+)\s+jour/i.exec(text); if (d) out.days = +d[1];
    if (out.kind === 'programme') {
      const iso = x => x ? `${x[3]}-${x[2]}-${x[1]}` : '', date = /(\d{2})\/(\d{2})\/(\d{4})/;
      const due = /programm\S*\s+pour\s+le\s+(\d{2}\/\d{2}\/\d{4})/i.exec(text), per = /p[ée]riode du relev[ée]\s*(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/i.exec(text), bal = /solde actuel\s*([A-Z]{3}|US\$|\$)?\s*(\d[\d\s\u00a0\u202f.,]*\d)/i.exec(text);
      out.due = due ? iso(date.exec(due[1])) : ''; if (per) { out.from = iso(date.exec(per[1])); out.to = iso(date.exec(per[2])); }
      if (bal) { out.cur = (bal[1] || 'CDF').replace('US$', 'USD').replace('$', 'USD').toUpperCase(); out.amount = money(bal[2]); }
    }
    return out;
  };

  // ---------- applying it to the client ----------
  const clientsFor = acc => { const k = accKey(acc); return k ? App.db.clients.filter(c => accKey(c.acc) === k) : []; };
  const apply = e => {
    if (!e.kind) { e.res = 'inconnu'; return; }
    const cs = clientsFor(e.acc); if (!cs.length) { e.res = 'sans-client'; return; } if (cs.length > 1) { e.res = 'ambigu'; return; }
    const c = cs[0]; e.clientId = c.id;
    // a payment reminder only tells when Starlink will debit next: it never changes the alert state of the client
    const fld = e.kind === 'programme' ? 'slp' : 'slm'; e.field = fld;
    if (c[fld] && c[fld].ts > e.ts) { e.res = 'ancien'; return; } // a more recent e-mail was already applied
    e.prev = c[fld] ? { ...c[fld] } : null;
    c[fld] = fld === 'slp' ? { ts: e.ts, due: e.due || '', from: e.from || '', to: e.to || '', amount: e.amount || 0, cur: e.cur || 'CDF', mid: e.id } : { state: e.kind, ts: e.ts, amount: e.amount || 0, cur: e.cur || '', mid: e.id };
    e.res = 'ok';
  };
  // an e-mail whose ACC was not known yet is tried again once the client has it
  const rematch = () => { let n = 0; log().slice().sort((a, b) => a.ts - b.ts).forEach(e => { if (e.res === 'sans-client' || e.res === 'ambigu') { apply(e); if (e.res === 'ok') n++; } }); return n; };
  // the same notice arriving in several mailboxes (forwarding, or Starlink writing to every contact address of the account) is counted once:
  // same Message-ID, or same account + same kind + same amount within two hours. The other mailboxes are remembered on the entry ("also").
  const findDup = e => log().find(x => x.id !== e.id && (e.rid && x.rid === e.rid || x.acc === e.acc && x.kind === e.kind && x.amount === e.amount && Math.abs(x.ts - e.ts) < DUP_MS));
  L.ingest = (m, mailbox) => {
    const id = mailbox + ':' + m.id, p = L.parse(m); if (!p.acc) return null; // not about an account: ignored
    const e = { id, ts: m.ts, acc: p.acc, kind: p.kind, amount: p.amount, cur: p.cur, days: p.days, due: p.due || '', from: p.from || '', to: p.to || '', subject: String(m.subject || '').slice(0, 120), mailbox, res: '' };
    e.rid = String(m.rid || '').slice(0, 200);
    const dup = findDup(e); if (dup) { if (dup.mailbox !== mailbox && !(dup.also || []).includes(mailbox)) dup.also = (dup.also || []).concat(mailbox); return null; }
    apply(e); log().push(e); if (log().length > MAX_LOG) App.db.slmail = log().slice(-MAX_LOG);
    return e;
  };
  // ACC found in e-mails but not (or twice) in the client list, one line per account whatever the number of e-mails and mailboxes
  L.unknown = () => {
    const g = new Map();
    log().filter(e => e.res === 'sans-client' || e.res === 'ambigu').forEach(e => {
      const k = accKey(e.acc); let o = g.get(k); if (!o) g.set(k, o = { acc: e.acc, ambiguous: false, boxes: new Set(), events: [], last: e });
      o.ambiguous = o.ambiguous || e.res === 'ambigu'; o.events.push(e); o.boxes.add(e.mailbox); (e.also || []).forEach(b => o.boxes.add(b)); if (e.ts > o.last.ts) o.last = e;
    });
    return [...g.values()].sort((a, b) => b.last.ts - a.last.ts);
  };
  L.alerts = () => App.db.clients.filter(c => c.slm && STATES[c.slm.state] && STATES[c.slm.state][3] > 0).sort((a, b) => STATES[b.slm.state][3] - STATES[a.slm.state][3] || b.slm.ts - a.slm.ts);
  L.count = () => L.alerts().length;
  App.slBadge = c => { const s = c.slm && STATES[c.slm.state]; return (c.nameCheck ? '<span class="pill warn" title="Nom lu sur la facture Starlink">Nom à valider</span>' : '') + (s && s[3] > 0 ? `<span class="pill ${s[2]}" title="Dernier e-mail Starlink : ${when(c.slm.ts)}">${s[1]}</span>` : ''); };
  App.slLine = c => { const s = c.slm && STATES[c.slm.state]; if (!s) return ''; return `<div class="mut" style="margin-top:6px">E-mail Starlink du ${when(c.slm.ts)} : <b class="${s[2]}">${s[0]} ${s[1]}</b>${c.slm.amount ? ' · ' + App.nf(c.slm.amount, 2) + ' ' + esc(c.slm.cur || '') : ''}</div>`; };

  App.slRow = c => { const p = c.slp, nx = p ? `<dt>Prélèvement Starlink</dt><dd>prévu le ${App.fdate(p.due || App.iso(new Date(p.ts)))}${p.amount ? ' · ' + App.nf(p.amount, 2) + ' ' + esc(p.cur || 'CDF') : ''}${p.from ? ` · période du ${App.fdate(p.from)} au ${App.fdate(p.to)}` : ''}</dd>` : '', s = c.slm && STATES[c.slm.state]; return (c.nameCheck ? `<dt>Nom</dt><dd>lu sur la facture Starlink : à vérifier <button class="btn sm sec" data-act="slm_valid" data-id="${c.id}">C'est bon</button></dd>` : '') + nx + (s ? `<dt>E-mail Starlink</dt><dd><span class="${s[2]}">${s[0]} ${s[1]}</span> · ${when(c.slm.ts)}${c.slm.amount ? ' · ' + App.nf(c.slm.amount, 2) + ' ' + esc(c.slm.cur || '') : ''}</dd>` : ''); };

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
    if (!r.ok) {
      let m = '', why = ''; try { const j = (await r.json()).error; m = j.message; why = ((j.errors || [])[0] || {}).reason || ''; } catch (e) {}
      // Gmail limits how fast a mailbox can be read ("Quota exceeded … Units per minute per user"): slow down and retry
      if (r.status === 429 || (r.status === 403 && (/rate|quota/i.test(why) || /quota|rate limit/i.test(m)))) throw Object.assign(new Error('Gmail limite le débit de lecture'), { code: 'quota', retry: +r.headers.get('retry-after') || 0 });
      throw Object.assign(new Error('Gmail : ' + (m || r.status)), { status: r.status });
    }
    return r.json();
  };
  L.pace = 150; // ms between two messages read
  L.delay = ms => new Promise(ok => setTimeout(ok, ms));
  // same request, retried a few times with a growing pause when Gmail asks to slow down
  const gq = async (url, tok) => { for (let i = 0; ; i++) { try { return await gf(url, tok); } catch (e) { if (e.code !== 'quota' || i >= 3) throw e; await L.delay((e.retry || 10 * 2 ** i) * 1000); } } };
  // email '' = pick any Google account (adding a mailbox); interactive false = reuse the existing Google session silently
  const getToken = async (email, interactive) => {
    const t0 = email && toks[email.toLowerCase()]; if (t0 && Date.now() < t0.exp) return t0.tok;
    if (!clientId()) throw Object.assign(new Error("Identifiant Google non configuré (Clients → E-mails Starlink)"), { code: 'config' });
    await loadGis();
    const t = await new Promise((ok, ko) => {
      const tc = google.accounts.oauth2.initTokenClient({
        client_id: clientId(), scope: SCOPE, login_hint: email || undefined,
        callback: r => r.error ? ko(Object.assign(new Error(r.error_description || r.error), { code: r.error })) : ok({ tok: r.access_token, exp: Date.now() + ((+r.expires_in || 3600) - 60) * 1000 }),
        error_callback: e => ko(Object.assign(new Error(e && e.type === 'popup_closed' ? 'Fenêtre Google fermée avant la fin (si Google affichait « The OAuth client was not found », l\'ID client est faux : vérifiez-le dans « Identifiant Google »)' : e && e.type === 'popup_failed_to_open' ? 'Le navigateur a bloqué la fenêtre Google : autorisez les fenêtres surgissantes pour ce site (icône dans la barre d\'adresse) ou ouvrez l\'application dans Chrome, puis réessayez.' : 'Connexion Google impossible (' + ((e && e.type) || 'erreur') + ')'), { code: (e && e.type) || 'popup' }))
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
    let ids = [], page = ''; do { const r = await gq(`${API}/messages?q=${q}&maxResults=100${page ? '&pageToken=' + page : ''}`, tok); ids = ids.concat((r.messages || []).map(x => x.id)); page = r.nextPageToken || ''; } while (page && ids.length < MAX_MSG);
    let added = 0;
    // newest first: if Gmail stops us half way, the most recent notices are already read and the next reading resumes where this one stopped
    try {
      for (const id of ids.slice(0, MAX_MSG)) {
        if (have.has(a.email + ':' + id) || seen.has(id)) continue;
        const m = await gq(`${API}/messages/${id}?format=full`, tok), from = header(m, 'from');
        if (!/starlink\.com/i.test(from)) seen.add(id);
        else { const e = L.ingest({ id, rid: header(m, 'message-id'), subject: header(m, 'subject'), text: textOf(m.payload), ts: +m.internalDate || Date.now() }, a.email); if (e) added++; else seen.add(id); }
        if (L.pace) await L.delay(L.pace);
      }
    } finally { a.seen = [...seen].slice(-500); }
    a.last = Date.now(); delete a.err; return added;
  };
  const NEED_LOGIN = ['interaction_required', 'access_denied', 'auth', 'popup_closed', 'popup_failed_to_open', 'immediate_failed', 'user_logged_out', 'consent_required', 'login_required', 'popup', 'unknown'];
  L.check = async (interactive, only) => {
    adopt(); if (busy || !cfg.accounts.length) return 0; busy = true; L.status = 'busy'; redraw();
    let added = 0; const errs = [];
    for (const a of (only ? [only] : cfg.accounts.filter(x => !x.skip))) { try { added += await syncAccount(a, interactive); } catch (e) { a.err = NEED_LOGIN.includes(e.code) ? 'reconnect' : e.code === 'quota' ? 'Gmail limite le débit : lecture partielle, touchez « Vérifier maintenant » dans une minute (elle reprend où elle s\'est arrêtée)' : e.message; errs.push(a.err === 'reconnect' ? 'reconnexion nécessaire pour ' + a.email : a.err); } }
    let auto = 0; try { auto = await L.autoLink(interactive); } catch (e) {}
    const re = rematch();
    cfg.lastCheck = Date.now(); saveCfg(); App.save();
    L.status = errs.length ? 'error' : 'idle'; L.error = errs.join(' · '); busy = false;
    if (interactive) App.toast(errs.length ? errs[0] : added || auto ? `${added} e-mail(s) Starlink lu(s)` + (re ? `, ${re} rapproché(s)` : '') + (auto ? ` · ${auto} ACC lié(s) automatiquement` : '') : 'Aucun nouvel e-mail Starlink');
    App.refresh(); return added;
  };
  L.needsAttention = () => cfg.accounts.some(a => !a.skip && a.err === 'reconnect');
  const redraw = () => { if (['clients', 'slmail'].includes(App.state.view) && !document.getElementById('dlg').open) App.refresh(); };

  // ---------- settings card ----------
  App.slmailCard = () => {
    adopt();
    const row = (t, s, b) => `<div class="item"><div class="grow"><b>${t}</b><small style="white-space:normal">${s}</small></div>${b || ''}</div>`;
    let body;
    if (!clientId()) body = row('État', "Non configuré. L'application lit les e-mails de Starlink (échec de paiement, suspension, réactivation) et met à jour le client grâce à son numéro ACC. Lecture seule : rien n'est envoyé, rien n'est supprimé.", '<button class="btn sm" data-act="slm_setup">Configurer</button>');
    else {
      const st = { busy: 'Lecture des e-mails…', error: 'Erreur : ' + esc(L.error) }[L.status] || (L.needsAttention() ? 'Reconnexion à Google nécessaire' : 'Prêt'), cls = { error: 'bad' }[L.status] || (L.needsAttention() ? 'warn' : 'ok');
      body = row('État', `<b class="${cls}">${st}</b><br>Dernière vérification : <b>${when(cfg.lastCheck)}</b>`, cfg.accounts.length ? '<button class="btn sm" data-act="slm_check">Vérifier maintenant</button>' : '')
        + cfg.accounts.map((a, i) => row('📧 ' + esc(a.email), a.skip ? "Lue par vos autres appareils : les alertes arrivent ici par la synchronisation (cet appareil ne lit pas cette boîte)." : a.err === 'reconnect' ? '<span class="warn">La connexion à Google est à refaire sur cet appareil : touchez « Reconnecter » (Google demande le mot de passe de cette adresse).</span>' : a.err ? '<span class="bad">' + esc(a.err) + '</span>' : 'Dernière lecture : ' + when(a.last), `<div style="display:grid;gap:6px">${a.err === 'reconnect' && !a.skip ? `<button class="btn sm" data-act="slm_reconnect" data-v="${i}">Reconnecter</button>` : ''}${a.skip ? `<button class="btn sm sec" data-act="slm_skip" data-v="${i}">Lire ici</button>` : a.err === 'reconnect' ? `<button class="btn sm sec" data-act="slm_skip" data-v="${i}">Ne pas lire ici</button>` : ''}<button class="btn sm del" data-act="slm_remove" data-v="${i}">Retirer</button></div>`)).join('')
        + row('Ajouter une boîte Gmail', 'Vous pouvez en lier plusieurs (par exemple la boîte qui reçoit les e-mails de paiement et celle qui reçoit les suspensions).', '<button class="btn sm" data-act="slm_add">+ Gmail</button>')
        + `<div class="item" style="flex-wrap:wrap"><div class="grow" style="flex:1 1 100%"><b>Lecture automatique</b><small style="white-space:normal">À l'ouverture de l'écran Clients, si la dernière lecture est assez ancienne. Le bouton « Vérifier maintenant » lit toujours tout de suite.</small></div><select id="slm_every" style="width:100%">${App.opts(EVERY, everyH())}</select></div>`
        + row('Alertes et journal', `${L.count()} alerte(s) en cours`, '<button class="btn sm sec" data-act="go" data-v="slmail">Ouvrir</button>')
        + row('Identifiant Google', `<span style="word-break:break-all;user-select:all">${esc(clientId())}</span><br>Si Google affiche « The OAuth client was not found », cet identifiant n'existe pas dans votre console Google : vérifiez-le (ou recréez-le) puis remplacez-le.`, `<div style="display:grid;gap:6px"><button class="btn sm sec" data-act="slm_setup">Modifier</button><button class="btn sm sec" data-act="copy" data-t="${esc(clientId())}">Copier</button></div>`);
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
        const id = App.v('slm_cid').replace(/\s+/g, ''); // a paste often carries a line break or a space
        if (!/^\d{5,}-[a-z0-9_-]+\.apps\.googleusercontent\.com$/i.test(id)) { $('slm_msg').textContent = "Cet identifiant n'a pas le format d'un ID client Google : une suite de chiffres, un tiret, des lettres et chiffres, puis .apps.googleusercontent.com (exemple : 123456789012-abc123….apps.googleusercontent.com). Copiez-le en entier."; return false; }
        cfg.clientId = id; shareCfg(); App.close(); App.refresh();
      }, 'Enregistrer');
  };
  // adding a mailbox: type the address (Google then asks to sign in with exactly that account, even when the phone is signed in to another one),
  // or pick one of the accounts already known on this device
  const failAdd = e => { L.status = 'error'; L.error = e.message; App.toast(e.message); App.refresh(); };
  const linkMailbox = async email => {
    try {
      if (cfg.accounts.some(a => a.email.toLowerCase() === email)) return App.toast('Cette boîte est déjà liée');
      App.toast('Connexion à Google : ' + email); await getToken(email, true);
      cfg.accounts.push({ email }); shareCfg(); App.refresh(); App.toast(email + ' lié : lecture des e-mails…'); L.check(true);
    } catch (e) { failAdd(e); }
  };
  App.actions.slm_add = () => {
    if (!clientId()) return App.actions.slm_setup();
    loadGis().catch(() => {}); // loaded before the tap on « Connecter »: a window opened after a download is blocked on phones
    App.modal('Ajouter une boîte Gmail',
      `<p class="mut" style="margin-top:0">Saisissez l'adresse Gmail qui reçoit les e-mails de Starlink. Google vous demandera de vous connecter avec <b>cette adresse</b>, même si le téléphone est connecté à un autre compte.</p>
       ${F.text('slm_email', 'Adresse Gmail', '', 'type="text" inputmode="email" autocapitalize="none" autocomplete="off" placeholder="exemple@gmail.com"')}<p id="slm_msg" class="warn"></p>
       <div class="bar"><button type="button" class="btn sec" data-act="slm_chooser">Choisir parmi les comptes de cet appareil</button></div>`,
      () => { const e = App.v('slm_email').trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { $('slm_msg').textContent = 'Saisissez une adresse e-mail valide (exemple@gmail.com).'; return false; } linkMailbox(e); }, 'Connecter');
  };
  App.actions.slm_chooser = async () => {
    App.close();
    try {
      App.toast('Choisissez le compte Gmail…'); await getToken('', true);
      const email = Object.keys(toks).filter(k => !cfg.accounts.some(a => a.email.toLowerCase() === k)).pop();
      if (!email) return App.toast('Ce compte est déjà lié');
      cfg.accounts.push({ email }); shareCfg(); App.refresh(); App.toast(email + ' lié : lecture des e-mails…'); L.check(true);
    } catch (e) { failAdd(e); }
  };
  App.actions.slm_remove = d => { const a = cfg.accounts[+d.v]; if (!a || !App.confirm('Retirer ' + a.email + ' ? Les alertes déjà créées sont conservées.')) return; if (toks[a.email.toLowerCase()] && window.google && google.accounts) { try { google.accounts.oauth2.revoke(toks[a.email.toLowerCase()].tok, () => {}); } catch (e) {} } delete toks[a.email.toLowerCase()]; cfg.accounts.splice(+d.v, 1); shareCfg(); App.refresh(); };
  document.addEventListener('change', e => { if (e.target && e.target.id === 'slm_every') { cfg.every = +e.target.value; shareCfg(); App.toast('Lecture automatique : ' + (EVERY.find(x => x[0] === cfg.every) || EVERY[1])[1].toLowerCase()); } });
  // one mailbox to sign in again: the Google window must open straight from the tap (a window opened after other requests is blocked on phones),
  // so this is the first thing done, and only this mailbox is read afterwards
  App.actions.slm_reconnect = async d => {
    const a = cfg.accounts[+d.v]; if (!a || busy) return;
    try { await getToken(a.email, true); } catch (e) { a.err = NEED_LOGIN.includes(e.code) ? 'reconnect' : e.message; saveCfg(); return failAdd(e); }
    delete a.err; saveCfg(); L.check(true, a);
  };
  // this device does not read that mailbox (kept on this device only): another device reads it and its alerts arrive through the data sync
  App.actions.slm_skip = d => {
    const a = cfg.accounts[+d.v]; if (!a) return; a.skip = !a.skip; if (a.skip) delete a.err; saveCfg();
    App.toast(a.skip ? 'Cet appareil ne lira plus ' + a.email + ' : les alertes arrivent par la synchronisation' : a.email + ' : lecture sur cet appareil rétablie'); App.refresh();
  };
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
    const al = L.alerts(), lg = log().slice().sort((a, b) => b.ts - a.ts), unk = L.unknown(), odd = lg.filter(e => e.res === 'inconnu'), okEv = lg.filter(e => e.kind === 'paye' || e.kind === 'actif'), autoL = L.autoLinked(), nTodo = unk.length + odd.length + autoL.length;
    if (rematch()) App.save();
    const chip = (k, t) => `<button class="chip ${tab === k ? 'on' : ''}" data-act="slm_tab" data-v="${k}">${t}</button>`;
    const cnt = k => al.filter(c => c.slm.state === k).length;
    const first = c => c.first || App.cname(c);
    const alertRow = c => { const s = STATES[c.slm.state];
      return `<div class="card"><div class="spread"><b>${esc(App.cname(c))}</b><span class="pill ${s[2]}">${s[1]}</span></div><small class="mono" style="word-break:break-all">${esc(c.acc)}</small>
        <div class="mut" style="margin-top:4px">${when(c.slm.ts)}${c.slm.amount ? ' · ' + App.nf(c.slm.amount, 2) + ' ' + esc(c.slm.cur || '') : ''}</div>
        <div class="bar">${c.phone ? `<button class="btn sm" data-act="slm_wa" data-id="${c.id}">💬 Relancer</button>` : ''}<button class="btn sm sec" data-act="go" data-v="client" data-id="${c.id}">Fiche</button><button class="btn sm sec" data-act="slm_done" data-id="${c.id}">✔ Réglé</button></div></div>`; };
    const logRow = e => { const r = RES[e.res] || ['', e.res], k = STATES[e.kind], c = App.client(e.clientId);
      return `<div class="item"><div class="grow"><b style="white-space:normal">${k ? k[0] + ' ' + k[1] : e.kind === 'programme' ? '📅 Paiement programmé' + (e.due ? ' pour le ' + App.fdate(e.due) : '') : '📨 ' + esc(e.subject)}${e.amount ? ' · ' + App.nf(e.amount, 2) + ' ' + esc(e.cur) : ''}</b><small style="white-space:normal">${when(e.ts)} · ${c ? esc(App.cname(c)) : '—'} · <span class="mono">${esc(e.acc)}</span><br>${r[0]} ${r[1]} · ${esc(e.mailbox)}${(e.also || []).length ? ' · aussi reçu dans ' + e.also.map(esc).join(', ') : ''}</small></div>${e.res === 'ok' ? `<button class="btn sm sec" data-act="slm_undo" data-id="${esc(e.id)}">Annuler</button>` : e.res === 'sans-client' || e.res === 'ambigu' ? `<button class="btn sm sec" data-act="copy" data-t="${esc(e.acc)}">Copier ACC</button>` : ''}</div>`; };
    const evLabel = e => STATES[e.kind] ? STATES[e.kind][0] + ' ' + STATES[e.kind][1] : e.kind === 'programme' ? '📅 Paiement programmé' : '📨 ' + esc(e.subject);
    const autoRow = c => `<div class="card"><div class="spread"><b>${esc(App.cname(c))}</b><span class="pill ok">ACC lié automatiquement</span></div><small class="mono" style="word-break:break-all">${esc(c.acc)}</small>
        <div class="mut" style="margin-top:4px;white-space:normal">${when(c.accAuto.ts)} · reconnu par : ${esc(c.accAuto.how)}${c.accAuto.name ? ' · facture au nom de « ' + esc(c.accAuto.name) + ' »' : ''}. Vérifiez que c'est bien ce client.</div>
        <div class="bar"><button class="btn sm" data-act="slm_ok" data-id="${c.id}">✔ C'est bon</button><button class="btn sm sec" data-act="slm_unlink" data-id="${c.id}">↩ Annuler le lien</button><button class="btn sm sec" data-act="go" data-v="client" data-id="${c.id}">Fiche</button></div></div>`;
    const unkRow = o => { const e = o.last, cs = App.db.clients.filter(c => accKey(c.acc) === accKey(o.acc));
      return `<div class="card"><div class="spread"><b class="mono" style="word-break:break-all">${esc(o.acc)}</b><span class="pill ${o.ambiguous ? 'bad' : 'warn'}">${o.ambiguous ? 'Plusieurs clients' : 'Non enregistré'}</span></div>
        <div class="mut" style="margin-top:4px;white-space:normal">Dernier e-mail : ${evLabel(e)}${e.amount ? ' · ' + App.nf(e.amount, 2) + ' ' + esc(e.cur) : ''} · ${when(e.ts)}<br>${o.events.length} e-mail(s) · boîte(s) : ${[...o.boxes].map(esc).join(', ')}</div>
        ${e.inv || o.last.inv ? `<div style="margin-top:6px;white-space:normal;font-size:13px">📄 Facture lue : <b>${esc((o.events.find(x => x.inv) || e).inv.name || '—')}</b>${(o.events.find(x => x.inv) || e).inv.serial ? ' · kit <span class="mono">' + esc((o.events.find(x => x.inv) || e).inv.serial) + '</span>' : ''}</div>` : ''}
        ${(() => { const sg = o.events.map(x => x.sug).find(Boolean), sc = sg && App.client(sg.id); return sc ? `<div class="card warn" style="margin:8px 0 0;white-space:normal">💡 C'est peut-être <b>${esc(App.cname(sc))}</b> (${esc(sg.how)}).<div class="bar"><button class="btn sm" data-act="slm_sug" data-acc="${esc(o.acc)}" data-id="${sc.id}">🔗 Lier à ${esc(App.cname(sc))}</button></div></div>` : ''; })()}
        <div class="bar">${o.ambiguous ? cs.map(c => `<button class="btn sm sec" data-act="go" data-v="client" data-id="${c.id}">Fiche : ${esc(App.cname(c))}</button>`).join('') : `<button class="btn sm" data-act="slm_link" data-acc="${esc(o.acc)}">🔗 Associer à un client</button><button class="btn sm sec" data-act="slm_new" data-acc="${esc(o.acc)}">➕ Nouveau client</button>`}<button class="btn sm sec" data-act="copy" data-t="${esc(o.acc)}">Copier ACC</button></div></div>`; };
    const body = tab === 'regles' ? `<p class="mut" style="font-size:13px">Paiements traités et services réactivés annoncés par Starlink, du plus récent au plus ancien.</p><div class="list">${okEv.length ? okEv.slice(0, 100).map(logRow).join('') : '<div class="empty">Aucun paiement traité ni service réactivé lu pour le moment.</div>'}</div>`
      : tab === 'journal' ? `<div class="list">${lg.length ? lg.slice(0, 100).map(logRow).join('') : '<div class="empty">Aucun e-mail lu pour le moment.</div>'}</div>`
      : tab === 'todo' ? `<p class="mut" style="font-size:13px">Comptes Starlink vus dans vos e-mails (une ligne par ACC, même s'il est dans plusieurs boîtes) mais absents de la liste des clients : rien n'a été modifié. Associez-les à un client existant ou créez-le : les e-mails sont appliqués tout de suite.</p>${(() => { const k = unk.filter(o => !o.ambiguous).length; return k ? `<div class="bar"><button class="btn" data-act="slm_createall">➕ Créer ${k > 1 ? 'les ' + k + ' clients manquants' : 'le client manquant'}</button></div>` : ''; })()}${(() => { const n = L.pending().length; return n ? `<div class="bar"><button class="btn sec" data-act="slm_pdf">📄 Compléter ${n} fiche(s) depuis les factures PDF</button></div>` : ''; })()}${autoL.length ? `<h2 class="sec">🔗 ACC liés automatiquement (${autoL.length})</h2>${autoL.map(autoRow).join('')}` : ''}${unk.map(unkRow).join('')}${odd.length ? `<h2 class="sec">E-mails non reconnus (${odd.length})</h2><div class="list">${odd.map(logRow).join('')}</div>` : ''}${nTodo ? '' : '<div class="card"><div class="empty">Rien à vérifier 🎉</div></div>'}`
      : al.length ? al.map(alertRow).join('') : '<div class="card"><div class="empty">Aucune alerte Starlink en cours 🎉</div></div>';
    return { title: 'Alertes Starlink', sub: 'D\'après les e-mails de Starlink', back: 'clients', nav: 'clients',
      html: `<section class="hero dhero"><div class="hero-top"><div><small>📧 Clients à suivre</small><div class="hero-num">${al.length}</div></div></div>
        <div class="cstats"><div><b>${cnt('echec')}</b><small>paiement échoué</small></div><div><b>${cnt('avis')}</b><small>suspension imminente</small></div><div><b>${cnt('suspendu')}</b><small>suspendus</small></div></div></section>
        <div class="bar"><button class="btn" data-act="slm_check" ${cfg.accounts.length ? '' : 'disabled'}>🔄 Vérifier les e-mails</button>${cfg.accounts.length ? '' : '<button class="btn sec" data-act="go" data-v="clients">Configurer Gmail</button>'}</div>
        <p class="mut" style="font-size:13px;margin:0 0 8px">Dernière vérification : ${when(cfg.lastCheck)} · ${cfg.accounts.length} boîte(s) Gmail liée(s)</p>
        <div class="chips">${chip('alerts', `Alertes (${al.length})`)}${chip('regles', `Réglés (${okEv.length})`)}${chip('journal', 'Journal')}${chip('todo', `À vérifier (${nTodo})`)}</div>${body}` };
  };
  // link an unknown ACC to a client: search a client, or create one with the ACC already filled in
  let linkAcc = '';
  const pickList = q => { const k = fold(q); return App.db.clients.filter(c => accKey(c.acc) !== accKey(linkAcc) && (!k || fold([App.cname(c), c.code, c.acc, c.phone].join(' ')).includes(k))).sort((a, b) => (a.acc ? 1 : 0) - (b.acc ? 1 : 0)).slice(0, 40)
    .map(c => `<button class="item" data-act="slm_pick" data-id="${c.id}"><div class="grow"><b>${esc(App.cname(c))}</b><small>${esc(c.code || '')} · ${c.acc ? esc(c.acc) : "pas d'ACC"}</small></div></button>`).join('') || '<div class="empty">Aucun client</div>'; };
  App.actions.slm_link = d => { linkAcc = d.acc; App.modal('Associer ' + d.acc, `<input id="slm_q" placeholder="Chercher un client (nom, code, téléphone)…" autocomplete="off"><div class="list" id="slm_list" style="margin-top:8px;max-height:50vh;overflow:auto">${pickList('')}</div>`, () => { App.close(); }, 'Fermer'); };
  document.addEventListener('input', e => { if (e.target && e.target.id === 'slm_q' && $('slm_list')) $('slm_list').innerHTML = pickList(e.target.value); });
  App.actions.slm_pick = d => {
    const c = App.client(d.id); if (!c || !linkAcc) return;
    if (c.acc && accKey(c.acc) !== accKey(linkAcc) && !App.confirm(`${App.cname(c)} a déjà l'ACC ${c.acc}. Le remplacer par ${linkAcc} ?`)) return;
    log().forEach(e => { if (accKey(e.acc) === accKey(linkAcc)) delete e.sug; }); c.acc = linkAcc; const n = rematch(); App.save(); App.close(); App.toast('ACC associé à ' + App.cname(c) + (n ? ` · ${n} e-mail(s) appliqué(s)` : '')); App.refresh();
  };
  App.actions.slm_sug = d => { linkAcc = d.acc; App.actions.slm_pick({ id: d.id }); };
  App.actions.slm_ok = d => { const c = App.client(d.id); if (!c || !c.accAuto) return; c.accAuto.ok = true; App.save(); App.refresh(); App.toast('Lien confirmé'); };
  // undo an automatic link: the e-mails go back to « À vérifier » (and the alert state they had set on the client is restored), and the account is not linked automatically again
  App.actions.slm_unlink = d => {
    const c = App.client(d.id); if (!c || !c.accAuto) return; const k = accKey(c.acc);
    log().filter(e => accKey(e.acc) === k && e.clientId === c.id).sort((a, b) => b.ts - a.ts).forEach(e => { const fld = e.field || 'slm'; if (e.res === 'ok' && c[fld] && c[fld].mid === e.id) { if (e.prev) c[fld] = e.prev; else delete c[fld]; } e.res = 'sans-client'; delete e.clientId; delete e.field; delete e.prev; e.noauto = true; });
    App.log(c.id, "Lien automatique de l'ACC " + c.acc + ' annulé'); c.acc = ''; delete c.accAuto; App.save(); App.refresh(); App.toast("Lien annulé : l'ACC repasse dans « À vérifier »");
  };
  App.actions.slm_new = d => { App.clientForm(null, 'gere'); const el = $('f_acc'); if (el) el.value = d.acc; };
  // a client created from an ACC alone (« Compte … »): the name and the phone are completed later
  const mkClient = (acc, from, to, note) => { const short = acc.replace(/^ACC-DF-/i, ''), S = App.db.settings;
    return { id: App.uid(), type: 'gere', first: 'Compte', last: short, name: 'Compte ' + short, phone: '', phone2: '', address: '', city: '', quarter: '', installAddr: '', acc, serial: '', kit: '', plan: '', price: 0, payMode: 'Cash',
      start: from || '', period: from && to ? Math.max(1, App.diff(from, to)) : S.period, grace: S.grace, note, fromMail: true, code: App.nextClientCode(), created: App.today(), subs: [] }; };
  // one client per unknown ACC (shared ACC excluded): ACC, Starlink state, and the subscription dates when a payment reminder gave the billing period
  App.actions.slm_createall = () => {
    const todo = L.unknown().filter(o => !o.ambiguous); if (!todo.length) return;
    if (!App.confirm(`Créer ${todo.length} client(s) à partir des comptes Starlink trouvés dans vos e-mails ? Ils s'appelleront « Compte … » : vous complétez ensuite le nom et le téléphone.`)) return;
    const today = App.today();
    todo.forEach(o => {
      const ev = o.events.filter(e => e.kind === 'programme' && e.from && e.to).sort((a, b) => b.ts - a.ts)[0], c = mkClient(o.acc, ev && ev.from, ev && ev.to, 'Créé le ' + App.fdate(today) + ' depuis les e-mails Starlink : nom et téléphone à compléter.');
      App.db.clients.push(c); App.log(c.id, 'Client créé depuis les e-mails Starlink (' + o.acc + ')');
    });
    const n = rematch(); App.save(); App.toast(`${todo.length} client(s) créé(s), ${n} e-mail(s) appliqué(s). Cherchez « Compte » dans Clients pour compléter leurs noms.`); App.refresh();
  };
  // ---------- invoices (PDF attached by Starlink): name, locality, plan and kit of a client created from an ACC ----------
  const MONTHS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
  const frDate = t => { const m = /(\d{1,2})\s+([a-z]+)\s+(\d{4})/.exec(fold(t)), i = m ? MONTHS.indexOf(m[2]) : -1; return i < 0 ? '' : `${m[3]}-${String(i + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`; };
  // text of an invoice (App.pdfText) -> fields
  L.invoice = text => {
    const lines = String(text || '').split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean), o = { acc: extractAcc(text), name: '', place: '', gps: '', plan: '', from: '', to: '', serial: '', kit: '', inv: '', amount: 0, cur: '' };
    const at = lines.findIndex(l => /^Attn\s*:/i.test(l)); if (at >= 0) o.name = lines[at].replace(/^Attn\s*:\s*/i, '').trim();
    const em = lines.findIndex(l => /^Emplacement\s*:/i.test(l)), g = em >= 0 && /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/.exec(lines[em]); if (g) o.gps = g[1] + ',' + g[2];
    const pl = lines[(em >= 0 ? em : at) + 1]; if (pl && !/:/.test(pl) && !/^(facture|INV-)/i.test(pl)) o.place = pl.replace(/\s*,\s*/g, ', ');
    const li = lines.map(l => /^([^|]+?)\s*\|\s*\((.+?)\s+-\s+(.+?)\)/.exec(l)).find(Boolean); if (li) { o.plan = li[1].trim(); o.from = frDate(li[2]); o.to = frDate(li[3]); }
    const k = /([A-Z][A-Z0-9-]*[A-Z0-9])\s+(KIT[0-9A-Z]{6,})/.exec(text) || /()(KIT[0-9A-Z]{6,})/.exec(text); if (k) { o.kit = k[1]; o.serial = k[2]; }
    const iv = /\bINV-[A-Z0-9-]+/.exec(text); if (iv) o.inv = iv[0];
    const t = /Prix total\s*([A-Z]{3})?\s*(\d[\d\s .,]*\d)/i.exec(text); if (t) { o.cur = t[1] || 'CDF'; o.amount = money(t[2]); }
    return o;
  };
  const cleanName = n => String(n || '').replace(/\s+/g, ' ').trim();
  // a client still waiting for its details: created from the e-mails (or still called « Compte … ») and not read yet
  L.pending = () => App.db.clients.filter(c => (c.fromMail || /^Compte /.test(c.name || '')) && !c.pdfDone && accKey(c.acc) && log().some(e => accKey(e.acc) === accKey(c.acc)));
  const pdfPart = payload => { let r = null; const walk = x => { if (!r && x.filename && /\.pdf$/i.test(x.filename) && x.body && (x.body.attachmentId || x.body.data)) r = x; (x.parts || []).forEach(walk); }; walk(payload || {}); return r; };
  const bytesOf = d => Uint8Array.from(atob(String(d).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  // the invoice of a client: tries its e-mails (payment reminders first, newest first) until one carries a PDF
  const fetchInvoiceAcc = async (acc, interactive) => {
    const k = accKey(acc), es = log().filter(e => accKey(e.acc) === k).sort((a, b) => (b.kind === 'programme') - (a.kind === 'programme') || b.ts - a.ts).slice(0, 5);
    for (const e of es) {
      const box = e.mailbox, gid = e.id.slice(box.length + 1), tok = await getToken(box, interactive), part = pdfPart((await gq(`${API}/messages/${gid}?format=full`, tok)).payload);
      if (!part) continue;
      const data = part.body.data || (await gq(`${API}/messages/${gid}/attachments/${part.body.attachmentId}`, tok)).data;
      const v = L.invoice(await App.pdfText(bytesOf(data))); if (accKey(v.acc) === k) return v;
    }
    return null;
  };
  const fetchInvoice = (c, interactive) => fetchInvoiceAcc(c.acc, interactive);

  // ---------- an unknown ACC found in an e-mail: link it to the client it belongs to ----------
  // The e-mail only carries the ACC; the name (« Attn ») and the kit serial are on the invoice attached to it. They are compared with the clients that have no ACC yet:
  // same kit serial or same full name (accents, case and word order ignored) with ONE client = linked at once (and can be undone); a close name = only a suggestion.
  const nameTok = x => fold(x).replace(/[^a-z0-9]+/g, ' ').split(' ').filter(w => w.length > 1);
  const serialKey = x => String(x || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const sameWords = (a, b) => a.length > 1 && a.length === b.length && a.slice().sort().join(' ') === b.slice().sort().join(' ');
  L.match = v => {
    const cs = App.db.clients.filter(c => !accKey(c.acc) && !/^Compte /.test(c.name || '')), sk = serialKey(v.serial), tk = nameTok(v.name);
    const bySerial = sk.length >= 8 ? cs.filter(c => serialKey(c.serial) === sk || serialKey(c.kit) === sk) : [], byName = cs.filter(c => sameWords(nameTok(App.cname(c)), tk));
    const s = bySerial.length === 1 ? bySerial[0] : null, n = byName.length === 1 ? byName[0] : null;
    if (s && (!n || n === s)) return { c: s, how: 'numéro de série du kit', sure: true };
    if (n && !bySerial.length) return { c: n, how: 'nom identique', sure: true };
    if (s) return { c: s, how: 'numéro de série du kit', sure: false };
    const sc = cs.map(c => { const a = nameTok(App.cname(c)), common = a.filter(w => tk.includes(w)).length; return { c, v: tk.length && a.length ? common / Math.max(tk.length, a.length) : 0 }; }).filter(x => x.v >= .5).sort((a, b) => b.v - a.v);
    return sc.length && (sc.length === 1 || sc[0].v > sc[1].v) ? { c: sc[0].c, how: 'nom proche', sure: false } : null;
  };
  const RETRY_MS = 12 * 3600e3, MAX_READ = 6; // an invoice is looked for again after 12 h if there was none; at most 6 invoices read per check
  L.autoLink = async interactive => {
    let linked = 0, reads = 0;
    for (const o of L.unknown().filter(x => !x.ambiguous && !x.events.some(e => e.noauto))) {
      let inv = (o.events.find(e => e.inv) || {}).inv;
      if (!inv) {
        if (reads >= MAX_READ || o.events.some(e => e.tried && Date.now() - e.tried < RETRY_MS)) continue;
        reads++; o.events.forEach(e => { e.tried = Date.now(); });
        let v = null; try { v = await fetchInvoiceAcc(o.acc, interactive); } catch (e) { if (NEED_LOGIN.includes(e.code) || e.code === 'quota' || e.code === 'config') break; continue; }
        if (L.pace) await L.delay(L.pace);
        if (!v || !(v.name || v.serial)) continue; inv = o.last.inv = { name: cleanName(v.name), serial: v.serial || '', place: v.place || '' };
      }
      const m = L.match(inv); delete o.last.sug;
      if (!m) continue;
      if (m.sure) { m.c.acc = o.acc; m.c.accAuto = { ts: Date.now(), how: m.how, name: inv.name }; App.log(m.c.id, `ACC ${o.acc} lié automatiquement (${m.how}) d'après la facture Starlink`); linked++; }
      else o.last.sug = { id: m.c.id, how: m.how };
    }
    if (linked) App.save();
    return linked;
  };
  L.autoLinked = () => App.db.clients.filter(c => c.accAuto && !c.accAuto.ok);
  const applyInvoice = (c, v) => {
    const S = App.db.settings, ch = [];
    if (v.name && /^Compte /.test(c.name || '')) { const w = cleanName(v.name).split(' '); c.first = w.length > 1 ? w[0] : ''; c.last = w.length > 1 ? w.slice(1).join(' ') : w[0]; c.name = cleanName(v.name); c.nameCheck = true; ch.push('nom'); }
    if (v.place && !c.city) { c.city = v.place.split(',')[0].trim(); if (!c.address) c.address = v.place; ch.push('localité'); }
    if (v.gps && !c.installAddr) { c.installAddr = 'GPS ' + v.gps; ch.push('position'); }
    if (v.serial && !c.serial) { c.serial = v.serial; ch.push('série du kit'); }
    if (v.plan && !c.plan) { const p = App.PLANS.find(x => fold(x) === fold(v.plan)) || v.plan; c.plan = p; if (!c.price && S.plans && S.plans[p]) c.price = S.plans[p].price || 0; ch.push('forfait'); }
    if (v.from && v.to && !c.start) { c.start = v.from; c.period = Math.max(1, App.diff(v.from, v.to)); ch.push('période'); }
    c.note = (c.note ? c.note + '\n' : '') + `Facture Starlink ${v.inv}${v.kit ? ' · kit ' + v.kit : ''} lue le ${App.fdate(App.today())} : à vérifier.`;
    c.pdfDone = true; App.log(c.id, 'Fiche complétée depuis la facture Starlink (' + (ch.join(', ') || 'rien de nouveau') + ')');
    return ch.length;
  };
  L.readInvoices = async interactive => {
    if (busy) return; const todo = L.pending(); if (!todo.length) return; busy = true; let ok = 0, none = 0, err = '';
    try {
      for (const c of todo) {
        try { const v = await fetchInvoice(c, interactive); if (v) { applyInvoice(c, v); ok++; } else none++; } catch (e) { err = e.message; if (e.code === 'quota' || e.code === 'config' || NEED_LOGIN.includes(e.code)) break; }
        if (L.pace) await L.delay(L.pace);
      }
    } finally { busy = false; }
    App.save(); App.toast(`${ok} fiche(s) complétée(s) depuis les factures PDF${none ? ` · ${none} sans facture PDF` : ''}${err ? ' · ' + err : ''}`); App.refresh();
  };
  App.actions.slm_pdf = () => L.readInvoices(true);
  App.actions.slm_valid = d => { const c = App.client(d.id); if (!c) return; delete c.nameCheck; App.save(); App.toast('Nom validé'); App.refresh(); };
  // ---------- import Starlink invoices (PDF files picked on this device): classify clients without Gmail ----------
  // newest invoice of each ACC wins; the client is found by its ACC (completed, never overwritten) or created; the name read is flagged « à valider »
  let imp = [];
  const readPdfInvoice = async file => { try { const v = L.invoice(await App.pdfText(new Uint8Array(await file.arrayBuffer()))); return v.acc ? v : null; } catch (e) { return null; } };
  const impKind = v => { const cs = clientsFor(v.acc); return cs.length > 1 ? 'ambigu' : cs.length ? 'maj' : 'new'; };
  App.slPdfButton = () => App.canView('importc') ? `<label class="btn sec full" style="cursor:pointer;display:block;margin-top:8px;text-align:center">📄 Importer des factures Starlink (PDF)<input type="file" id="sp_file" accept=".pdf,application/pdf" multiple hidden></label>` : '';
  const impApply = () => {
    const todo = imp.filter(x => x.kind !== 'ambigu'); let nNew = 0, nUp = 0;
    todo.forEach(({ v }) => {
      let c = clientsFor(v.acc)[0];
      if (!c) { c = mkClient(v.acc, v.from, v.to, 'Créé le ' + App.fdate(App.today()) + ' depuis une facture Starlink (PDF).'); c.fromMail = false; c.fromPdf = true; App.db.clients.push(c); App.log(c.id, 'Client créé depuis une facture Starlink (' + v.acc + ')'); nNew++; } else nUp++;
      applyInvoice(c, v);
    });
    const re = rematch(); App.save(); App.toast(`${nNew} client(s) créé(s), ${nUp} fiche(s) complétée(s)${re ? `, ${re} e-mail(s) appliqué(s)` : ''}. Vérifiez les noms marqués « Nom à valider ».`); App.refresh();
  };
  document.addEventListener('change', async e => {
    if (!e.target || e.target.id !== 'sp_file' || !e.target.files.length) return;
    const files = [...e.target.files]; e.target.value = ''; const done = App.busy ? App.busy('Lecture des factures…') : () => {}, byAcc = new Map(); let bad = 0;
    try { for (const f of files) { const v = await readPdfInvoice(f); if (!v) { bad++; continue; } const k = accKey(v.acc), o = byAcc.get(k); if (!o || (v.from || '') > (o.from || '')) byAcc.set(k, v); } } finally { done(); }
    imp = [...byAcc.values()].map(v => ({ v, kind: impKind(v) }));
    if (!imp.length) return App.toast(`Aucune facture Starlink reconnue (${files.length} fichier(s) lu(s)).`);
    const ok = imp.filter(x => x.kind !== 'ambigu').length, pill = { new: ['ok', 'Nouveau client'], maj: ['warn', 'Complète la fiche'], ambigu: ['bad', 'Plusieurs clients : ignoré'] };
    const row = ({ v, kind }) => { const c = kind === 'maj' ? clientsFor(v.acc)[0] : null; return `<div class="item"><div class="grow"><b style="white-space:normal">${esc(v.name || 'Sans nom')}</b><small style="white-space:normal">${esc(v.acc)}${v.place ? ' · ' + esc(v.place) : ''}${v.plan ? ' · ' + esc(v.plan) : ''}${c ? ' · fiche « ' + esc(App.cname(c)) + ' »' : ''}</small></div><span class="pill ${pill[kind][0]}">${pill[kind][1]}</span></div>`; };
    App.modal('Factures Starlink lues', `<p class="mut" style="margin-top:0">${files.length} fichier(s) : ${imp.length} compte(s) Starlink reconnu(s)${bad ? `, ${bad} fichier(s) non reconnu(s)` : ''}. Rien n'est enregistré avant que vous confirmiez. Le nom est celui que Starlink a enregistré : vous le validez ensuite fiche par fiche.</p><div class="list">${imp.map(row).join('')}</div>`,
      ok ? () => { impApply(); } : null, ok ? `Importer (${ok})` : 'Fermer');
  });
  App.actions.slm_todo = () => { tab = 'todo'; App.go('slmail'); };
  App.actions.slm_wa = d => { const c = App.client(d.id); if (!c || !c.slm || !MSG[c.slm.state]) return; const url = App.waUrl(c.phone, MSG[c.slm.state](c.first || App.cname(c), c)); if (!url) return App.toast('Pas de numéro de téléphone'); window.open(url, '_blank', 'noopener'); };
  App.actions.slm_done = d => { const c = App.client(d.id); if (!c) return; c.slm = { state: 'actif', ts: Date.now(), manual: true }; App.save(); App.toast('Alerte clôturée'); App.refresh(); };
  App.actions.slm_undo = d => {
    const e = log().find(x => x.id === d.id), c = e && App.client(e.clientId); if (!e || e.res !== 'ok' || !c) return;
    const fld = e.field || 'slm';
    if (!c[fld] || c[fld].mid !== e.id) return App.toast("Un e-mail plus récent a été appliqué depuis : annulation impossible");
    if (e.prev) c[fld] = e.prev; else delete c[fld]; e.res = 'annule'; App.save(); App.refresh(); App.toast('E-mail annulé');
  };

  // Everything lives in the Clients screen (nothing on the dashboard, nothing read when the app opens): opening Clients reads the mailboxes quietly
  // (only reuses the existing Google session: no window), at most every 30 minutes.
  const auto = () => { adopt(); if (App.state.view === 'clients' && everyH() > 0 && cfg.accounts.length && clientId() && App.guard('slm_check') && Date.now() - (cfg.lastCheck || 0) > everyH() * 3600e3) L.check(false); };
  App.slmailPanel = () => {
    if (!App.guard('slm_check')) return '';
    adopt(); setTimeout(auto, 600);
    const n = L.count(), warn = L.needsAttention(), title = '📧 E-mails Starlink' + (n ? ` · ${n} à suivre` : '') + (warn ? ' · reconnexion nécessaire' : '');
    if (rematch()) App.save();
    const nu = L.unknown().length, unkLine = nu ? `<button class="item" data-act="slm_todo" style="margin-bottom:8px"><span class="avatar warn" style="width:36px;height:36px;font-size:16px">🔗</span><div class="grow"><b style="white-space:normal">${nu} compte(s) Starlink (ACC) vu(s) dans vos e-mails mais pas dans la liste des clients.</b></div><span class="mut">›</span></button>` : '';
    const alertLine = n ? `<button class="item" data-act="go" data-v="slmail" style="margin-bottom:8px"><span class="avatar bad" style="width:36px;height:36px;font-size:16px">📧</span><div class="grow"><b style="white-space:normal">${n} client(s) Starlink à suivre (paiement échoué ou suspension).</b></div><span class="mut">›</span></button>` : '';
    return unkLine + alertLine + App.fold('slmail', title, App.slmailCard().replace(/^<h2 class="sec">.*?<\/h2>/, ''));
  };
})();
