// Multi-device sync. The whole data set is encrypted on the device (AES-GCM, key derived from a passphrase) and stored as one
// opaque row in the user's own Supabase project (sync/supabase.sql). Devices merge record by record against the last synced
// snapshot (three-way merge): offline edits made on several phones are combined, not overwritten. Adapted from CISPOLstore Manager.
(function () {
  const App = window.App, ui = App.ui, esc = App.esc, CKEY = 'business-sync', js = JSON.stringify;
  const COLL = ['clients', 'products', 'suppliers', 'invoices', 'payments', 'expenses', 'movements', 'quotes', 'orders', 'inventories', 'cashCounts', 'closings', 'subs', 'ledger', 'staff', 'jobs', 'rentals', 'deliveries', 'contracts', 'users', 'log'];
  const NOT_SHARED = ['theme', 'lastBackup', 'seq']; // theme and backup date stay per device; counters are merged by max
  let cfg = null; try { cfg = JSON.parse(localStorage.getItem(CKEY)); } catch (e) { }
  const saveCfg = () => { try { localStorage.setItem(CKEY, js(cfg)); } catch (e) { } };
  const S = App.sync = { status: cfg ? 'idle' : 'off', error: '', summary: '' };
  App.syncConfigured = () => !!cfg;

  // ---------- crypto ----------
  const te = new TextEncoder(), td = new TextDecoder();
  const toB64 = u => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const derive = async (ws, pass) => { const base = await crypto.subtle.importKey('raw', te.encode(pass), 'PBKDF2', false, ['deriveBits']), bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: te.encode('business:' + ws), iterations: 200000, hash: 'SHA-256' }, base, 512)); return { key: toB64(bits.slice(0, 32)), token: [...bits.slice(32)].map(b => b.toString(16).padStart(2, '0')).join('') }; };
  const aes = k => crypto.subtle.importKey('raw', fromB64(k), 'AES-GCM', false, ['encrypt', 'decrypt']);
  const seal = async obj => { const iv = crypto.getRandomValues(new Uint8Array(12)), ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aes(cfg.key), te.encode(js(obj)))), out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12); return toB64(out); };
  const open = async blob => { const u = fromB64(blob); return JSON.parse(td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.slice(0, 12) }, await aes(cfg.key), u.slice(12)))); };

  // ---------- server ----------
  const rpc = async (fn, body) => {
    const h = { 'Content-Type': 'application/json', apikey: cfg.anon }; if (cfg.anon.startsWith('eyJ')) h.Authorization = 'Bearer ' + cfg.anon;
    const r = await fetch(cfg.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: h, body: js(body) }), t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) { }
    if (!r.ok) { const m = (j && (j.message || j.hint)) || t.slice(0, 160) || ('HTTP ' + r.status), e = new Error(m); e.forbidden = /forbidden/.test(m); e.missing = r.status === 404; throw e; } return j;
  };
  const auth = () => ({ p_ws: cfg.ws, p_token: cfg.token });

  // ---------- snapshot and merge ----------
  const keyOf = (name, x) => name === 'log' ? x.t + '|' + x.a + '|' + x.d + '|' + x.u : x.id;
  const order = (name, a) => a.slice().sort((x, y) => ((x.at || x.t || 0) - (y.at || y.t || 0)) || String(keyOf(name, x)).localeCompare(String(keyOf(name, y))));
  const shared = d => { const o = {}; COLL.forEach(k => { o[k] = order(k, d[k] || []); }); o.settings = {}; Object.keys(d.settings).filter(k => !NOT_SHARED.includes(k)).sort().forEach(k => { o.settings[k] = d.settings[k]; }); o.seq = d.settings.seq || {}; return o; };
  const canon = s => js(s);
  const conflict = (name, b, l, r) => { const o = { ...r }; new Set([...Object.keys(l), ...Object.keys(b)]).forEach(k => { if (js(l[k]) !== js(b[k])) o[k] = l[k]; }); if (name === 'products' && Number.isFinite(l.qty) && Number.isFinite(b.qty) && Number.isFinite(r.qty)) o.qty = Math.round((r.qty + (l.qty - b.qty)) * 1000) / 1000; return o; }; // stock: add both devices' movements
  const mergeColl = (name, b, l, r, first) => {
    const mk = a => new Map((a || []).map(x => [keyOf(name, x), x])), mb = mk(b), ml = mk(l), mr = mk(r), out = [];
    for (const k of new Set([...mr.keys(), ...ml.keys(), ...mb.keys()])) {
      const eb = mb.get(k), el = ml.get(k), er = mr.get(k), sb = eb && js(eb), sl = el && js(el), sr = er && js(er);
      if (el && er) { if (sl === sr) out.push(el); else if (!eb) out.push(first ? er : el); else if (sr === sb) out.push(el); else if (sl === sb) out.push(er); else out.push(conflict(name, eb, el, er)); }
      else if (el) { if (!eb || sl !== sb) out.push(el); } else if (er) { if (!eb || sr !== sb) out.push(er); }
    }
    return order(name, out);
  };
  const maxSeq = (a, b) => { const o = { ...(b || {}) }; Object.entries(a || {}).forEach(([k, v]) => { o[k] = typeof v === 'object' && v ? maxSeq(v, o[k]) : Math.max(v, o[k] || 0); }); return o; };
  const mergeAll = (b, l, r, first) => {
    const o = { settings: {} }; COLL.forEach(k => { o[k] = mergeColl(k, b && b[k], l[k], r[k], first); });
    new Set([...Object.keys(l.settings), ...Object.keys(r.settings)]).forEach(k => { const sb = b && js(b.settings[k]), sl = js(l.settings[k]), sr = js(r.settings[k]); o.settings[k] = sl === sr ? l.settings[k] : first ? r.settings[k] : sl === sb ? r.settings[k] : l.settings[k]; });
    o.seq = maxSeq(l.seq, r.seq); return o;
  };
  const apply = m => { const d = App.db; COLL.forEach(k => { d[k] = m[k]; }); Object.assign(d.settings, m.settings); d.settings.seq = m.seq; if (App.user) App.user = d.users.find(u => u.id === App.user.id) || App.user; };
  // two devices can issue the same number / code while offline: the later one is renumbered
  const fixDuplicates = () => {
    const d = App.db; let n = 0, A = App.sales;
    const fix = (name, list, field, next) => { const seen = new Map(); order(name, list).forEach(x => { const v = x[field]; if (seen.has(v) && seen.get(v) !== x.id) { x[field] = next(x); n++; } else seen.set(v, x.id); }); };
    fix('invoices', d.invoices, 'number', () => A.nextNo('FAC', 'invoice', () => d.invoices)); fix('quotes', d.quotes, 'number', () => A.nextNo('DEV', 'quote', () => d.quotes)); fix('payments', d.payments, 'no', () => A.nextNo('REC', 'receipt', () => d.payments.map(p => ({ number: p.no }))));
    fix('clients', d.clients, 'code', () => App.clients.nextCode()); fix('products', d.products, 'code', () => App.stock.nextCode()); fix('suppliers', d.suppliers, 'code', () => App.suppliers.nextCode());
    return n;
  };

  // ---------- engine ----------
  let busy = false, applying = false, dirty = true, timer = null;
  const ICONS = { off: ['☁️', 'Synchronisation non configurée'], idle: ['☁️', 'Synchronisé'], busy: ['🔄', 'Synchronisation…'], error: ['⚠️', 'Erreur de synchronisation'], offline: ['📴', 'Hors connexion'] };
  const setStatus = (st, err) => { S.status = st; S.error = err || ''; const b = App.$('#syncbtn'); if (b) { b.textContent = ICONS[st][0]; b.title = ICONS[st][1] + (err ? ' : ' + err : ''); } };
  S.icon = () => ICONS[S.status][0];
  S.last = () => (cfg && cfg.last) || 0;
  S.now = async () => {
    if (!cfg || busy) return S.summary; busy = true; setStatus('busy'); let changed = false;
    try {
      if (!navigator.onLine) { const e = new Error('Pas de connexion internet'); e.offline = true; throw e; }
      for (let attempt = 0; attempt < 4; attempt++) {
        const head = await rpc('biz_head', auth());
        if (head.exists && !dirty && head.version === cfg.version) { S.summary = 'Déjà à jour'; break; }
        let remote = null, version = 0; if (head.exists) { const r = await rpc('biz_pull', auth()); remote = await open(r.blob); version = r.version; }
        const local = shared(App.db);
        if (remote) { const merged = mergeAll(cfg.base ? JSON.parse(cfg.base) : null, local, remote, !cfg.base); if (canon(merged) !== canon(local)) { applying = true; try { apply(merged); fixDuplicates(); App.flush(); } finally { applying = false; } changed = true; } }
        const now = shared(App.db);
        if (remote && canon(now) === canon(remote)) { cfg.version = version; cfg.base = canon(now); S.summary = changed ? 'Données reçues' : 'Déjà à jour'; dirty = false; break; }
        const res = await rpc('biz_push', { ...auth(), p_blob: await seal(now), p_base: version });
        if (res.ok) { cfg.version = res.version; cfg.base = canon(now); dirty = false; S.summary = changed ? 'Échangé avec les autres appareils' : 'Envoyé'; break; }
        if (attempt === 3) throw new Error('Un autre appareil synchronise en même temps, réessayez');
      }
      cfg.last = Date.now(); saveCfg(); setStatus('idle'); if (changed && !(App.roles && App.roles.isLocked()) && !App.$('.sheet-wrap')) App.render();
    } catch (e) { setStatus(e.offline || !navigator.onLine ? 'offline' : 'error', e.forbidden ? 'phrase secrète incorrecte' : e.message); S.summary = ICONS[S.status][1] + (S.error ? ' : ' + S.error : ''); }
    finally { busy = false; } return S.summary;
  };
  const schedule = ms => { if (!cfg) return; clearTimeout(timer); timer = setTimeout(() => S.now(), ms); };
  App.on('save', () => { if (cfg && !applying) { dirty = true; schedule(4000); } });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(600); }); window.addEventListener('online', () => schedule(600));
  setInterval(() => { if (cfg && !document.hidden) schedule(10); }, 90000);
  S.connect = async ({ url, anon, ws, pass }) => {
    url = url.trim().replace(/\/+$/, ''); if (!/^https?:\/\//.test(url)) url = 'https://' + url; ws = ws.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
    if (!ws) throw new Error('Nom d\'espace invalide'); if (pass.length < 8) throw new Error('La phrase secrète doit contenir au moins 8 caractères');
    const keys = await derive(ws, pass), prev = cfg; cfg = { url, anon: anon.trim(), ws, key: keys.key, token: keys.token, base: null, version: 0, last: 0 };
    try { await rpc('biz_head', auth()); } catch (e) { cfg = prev; if (e.forbidden) throw new Error('Cet espace existe déjà avec une autre phrase secrète'); if (e.missing) throw new Error('Le script SQL n\'a pas été exécuté dans Supabase'); throw new Error(e.message || 'Connexion impossible'); }
    saveCfg(); dirty = true; setStatus('idle'); return S.now();
  };
  S.disconnect = () => { cfg = null; try { localStorage.removeItem(CKEY); } catch (e) { } setStatus('off'); S.summary = ''; };

  // ---------- UI ----------
  const sqlText = () => fetch('sync/supabase.sql').then(r => r.text());
  S.setup = done => {
    const sh = ui.sheet({ title: 'Synchronisation', wide: true, html: '<div class="card"><b>À faire une seule fois (5 minutes)</b><ol style="margin:8px 0 0;padding-left:18px"><li>Créez un compte gratuit sur <b>supabase.com</b>, puis un nouveau projet.</li><li><b>SQL Editor</b> → New query → collez le script → <b>Run</b>.</li><li><b>Project Settings → API</b> : copiez l\'<b>URL du projet</b> et la clé <b>anon / publishable</b>.</li><li>Saisissez-les ici avec un nom d\'espace et une phrase secrète. Sur chaque autre appareil, saisissez <b>les mêmes 4 valeurs</b>.</li></ol><button class="btn ghost sm" id="ssql">📋 Copier le script SQL</button></div>' + ui.field('URL du projet Supabase', ui.input('url', cfg ? cfg.url : '', { ph: 'https://xxxx.supabase.co' })) + ui.field('Clé publique (anon / publishable)', ui.input('anon', cfg ? cfg.anon : '')) + ui.field('Nom de l\'espace', ui.input('ws', cfg ? cfg.ws : slug())) + '<label class="fld"><span>Phrase secrète (8 caractères minimum)</span><input name="pass" type="password" autocomplete="off"></label><p class="muted">Les données sont chiffrées avec cette phrase avant l\'envoi : sans elle, personne (même Supabase) ne peut les lire. <b>Notez-la</b> : elle ne peut pas être récupérée.</p><p id="smsg" style="color:var(--bad)"></p>',
      actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Connecter', cls: 'primary', fn: async s => { const f = ui.read(s.body), msg = s.q('#smsg'); msg.textContent = ''; try { const r = await S.connect({ url: f.url, anon: f.anon, ws: f.ws, pass: f.pass }); App.toast('Synchronisation activée : ' + r); done && done(); App.render(); return true; } catch (e) { msg.textContent = e.message; return false; } } }] });
    sh.q('#ssql').onclick = () => sqlText().then(t => (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => App.toast('Script SQL copié'), () => App.toast('Copie impossible', 'err')), () => App.toast('Script introuvable', 'err'));
  };
  const slug = () => (App.db.settings.name || 'entreprise').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'entreprise';
  App.syncCard = box => {
    const when = cfg && cfg.last ? new Date(cfg.last).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : 'jamais', st = { off: 'Non configurée', idle: 'Active', busy: 'En cours…', error: 'Erreur', offline: 'Hors connexion' }[S.status];
    box.innerHTML = '<section class="card"><h3>Synchronisation entre appareils</h3><p class="muted">État : <b>' + st + '</b>' + (S.error ? ' · ' + esc(S.error) : '') + (cfg ? '<br>Espace « ' + esc(cfg.ws) + ' » · dernière synchronisation : ' + when : '<br>Utilisez la même application sur plusieurs téléphones : les données sont chiffrées avant l\'envoi, dans votre propre projet Supabase.') + '</p><div class="tools">' + (cfg ? '<button class="btn primary" id="sn">Synchroniser maintenant</button><button class="btn ghost" id="sx">Déconnecter</button>' : '<button class="btn primary" id="ss">Configurer</button>') + '</div></section>';
    const q = s => box.querySelector(s), redo = () => App.syncCard(box);
    q('#ss') && (q('#ss').onclick = () => { if (!App.can('settings')) return App.toast('Réservé à l\'administrateur', 'err'); S.setup(redo); });
    q('#sn') && (q('#sn').onclick = async () => { App.toast('Synchronisation…'); App.toast(await S.now()); redo(); });
    q('#sx') && (q('#sx').onclick = async () => { if (App.can('settings') && await ui.confirm('Déconnecter la synchronisation ? Les données restent sur cet appareil.', 'Déconnecter', true)) { S.disconnect(); redo(); App.render(); } });
  };
  App.ready.then(() => { if (cfg) schedule(1500); });
})();
