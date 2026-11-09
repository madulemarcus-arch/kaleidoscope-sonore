// Core: global App object, data store (localStorage + IndexedDB mirror), migration, helpers.
(function () {
  const LS = 'biz.db', IDB = 'biz-manager', STORE = 'kv', VERSION = 1;
  const App = window.App = { NAME: 'CISPOLstore Business', BUILD: 'business-v6', DB_VERSION: VERSION, views: {}, mods: {}, hooks: {}, ready: null };

  // ---------- helpers ----------
  App.$ = (s, r) => (r || document).querySelector(s);
  App.$$ = (s, r) => [...(r || document).querySelectorAll(s)];
  App.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  App.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  App.diff = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5);
  App.today = () => App.isoDate(new Date());
  App.isoDate = d => { const z = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); };
  App.addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return App.isoDate(d); };
  App.fmtDate = iso => iso ? iso.split('-').reverse().join('/') : '';
  App.on = (ev, fn) => (App.hooks[ev] = App.hooks[ev] || []).push(fn);
  App.emit = (ev, a) => (App.hooks[ev] || []).forEach(fn => { try { fn(a); } catch (e) { console.error(e); } });

  // ---------- defaults ----------
  // Optional modules: an inactive one appears nowhere (menus, home, reports).
  App.MODULES = [
    ['sales', 'Ventes', 'Devis, factures, paiements'], ['stock', 'Stock', 'Produits, entrées/sorties, inventaire'],
    ['services', 'Services', 'Prestations et commissions'], ['subs', 'Abonnements', 'Récurrents, échéances, rappels'],
    ['rental', 'Location', 'Biens loués, caution, retours'], ['delivery', 'Livraisons', 'Planification et encaissement'],
    ['interventions', 'Interventions', 'Visites, employé, statut'], ['contracts', 'Contrats', 'Modèles imprimables'],
    ['purchases', 'Achats', 'Bons de commande, fournisseurs'], ['cash', 'Caisse', 'Comptage, écart, clôture'],
    ['team', 'Équipe', 'Profils, PIN, journal d\'audit']
  ];
  // Starting presets by activity: modules switched on + vocabulary.
  App.PRESETS = {
    general: { label: 'Tous secteurs', modules: ['sales', 'stock', 'cash', 'purchases'], vocab: { client: 'client', product: 'produit', sub: 'abonnement' } },
    commerce: { label: 'Commerce', modules: ['sales', 'stock', 'purchases', 'cash', 'delivery'], vocab: { client: 'client', product: 'article', sub: 'abonnement' } },
    services: { label: 'Services', modules: ['sales', 'services', 'interventions', 'contracts', 'cash'], vocab: { client: 'client', product: 'prestation', sub: 'contrat' } },
    abonnements: { label: 'Abonnements', modules: ['sales', 'subs', 'cash', 'contracts'], vocab: { client: 'client', product: 'formule', sub: 'abonnement' } },
    location: { label: 'Location', modules: ['sales', 'rental', 'contracts', 'cash'], vocab: { client: 'client', product: 'bien', sub: 'location' } },
    restauration: { label: 'Restauration', modules: ['sales', 'stock', 'purchases', 'cash', 'delivery', 'team'], vocab: { client: 'client', product: 'plat', sub: 'abonnement' } },
    atelier: { label: 'Atelier', modules: ['sales', 'stock', 'interventions', 'purchases', 'cash'], vocab: { client: 'client', product: 'pièce', sub: 'contrat' } },
    ecole: { label: 'École', modules: ['sales', 'subs', 'cash', 'team', 'contracts'], vocab: { client: 'élève', product: 'prestation', sub: 'inscription' } },
    cabinet: { label: 'Cabinet', modules: ['sales', 'services', 'contracts', 'cash'], vocab: { client: 'patient', product: 'prestation', sub: 'contrat' } }
  };
  App.defaults = () => ({
    v: VERSION,
    settings: {
      setup: false, name: '', activity: 'general', city: '', address: '', phone: '', email: '', slogan: '', terms: '',
      logo: '', stamp: '', currency: 'USD', cur2: 'CDF', rate: 2800, // 1 principal = rate × secondary
      legal: [{ k: 'RCCM', v: '' }, { k: 'ID Nat.', v: '' }, { k: 'N° impôt', v: '' }], // editable labels
      modules: Object.fromEntries(App.MODULES.map(m => [m[0], App.PRESETS.general.modules.includes(m[0])])),
      vocab: { ...App.PRESETS.general.vocab },
      fields: { clients: [], products: [], invoices: [] }, // custom fields: {id,label,type,options}
      theme: 'auto', dial: '243', words: 'be', clientTypes: ['Particulier', 'Entreprise'], categories: ['Général'], units: ['pièce', 'kg', 'm', 'litre'], seq: { client: 0, product: 0, supplier: 0, order: {}, invoice: {}, quote: {}, receipt: {} },
      goal: 0, expenseCats: ['Achats', 'Loyer', 'Salaires', 'Transport', 'Électricité / Eau', 'Communication', 'Autres'],
      modes: ['Espèces', 'Mobile money', 'Banque', 'Autre'],
      msgs: { remind: 'Bonjour {nom},\nSauf erreur de notre part, la facture {numero} de {montant} (reste {reste}) est impayée depuis {jours} jour(s).\nMerci de régler dès que possible.\n{entreprise}', receipt: 'Bonjour {nom},\nNous avons bien reçu votre paiement de {montant}{facture} le {date}. Merci !\n{entreprise}' }, // dial = country code for WhatsApp links
    },
    clients: [], products: [], suppliers: [], invoices: [], payments: [], expenses: [], movements: [], log: [], lastImport: null, orders: [], inventories: [], quotes: [], cashCounts: [], closings: [], users: []
  });

  // ---------- store ----------
  App.db = App.defaults();
  let timer = 0, idb = null;
  const openIdb = () => new Promise(res => {
    try { const r = indexedDB.open(IDB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch (e) { res(null); }
  });
  const idbGet = () => new Promise(res => { if (!idb) return res(null); try { const q = idb.transaction(STORE).objectStore(STORE).get('db'); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); } catch (e) { res(null); } });
  const idbPut = s => { if (!idb) return; try { idb.transaction(STORE, 'readwrite').objectStore(STORE).put(s, 'db'); } catch (e) { /* mirror is best effort */ } };
  App.flush = () => {
    clearTimeout(timer); timer = 0;
    const s = JSON.stringify(App.db);
    try { localStorage.setItem(LS, s); } catch (e) { App.toast && App.toast('Mémoire pleine : faites une sauvegarde', 'err'); }
    idbPut(s);
  };
  App.save = () => { clearTimeout(timer); timer = setTimeout(App.flush, 250); App.emit('save'); };
  window.addEventListener('pagehide', () => { if (timer) App.flush(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && timer) App.flush(); });

  // Fill missing keys from defaults, then run versioned migrations.
  const merge = (def, cur) => {
    if (Array.isArray(def) || def === null || typeof def !== 'object') return cur === undefined ? def : cur;
    const o = { ...cur };
    for (const k in def) o[k] = (cur && typeof cur === 'object' && k in cur) ? merge(def[k], cur[k]) : def[k];
    return o;
  };
  App.migrate = d => {
    const out = merge(App.defaults(), d || {});
    // future: if ((d.v||0) < 2) {...}
    out.v = VERSION; return out;
  };
  App.load = async () => {
    idb = await openIdb();
    let raw = null; try { raw = localStorage.getItem(LS); } catch (e) { /* private mode */ }
    if (!raw) raw = await idbGet(); // restored automatically when localStorage was wiped
    let d = null; try { d = raw ? JSON.parse(raw) : null; } catch (e) { d = null; }
    App.db = App.migrate(d);
    if (!raw) App.flush(); else idbPut(JSON.stringify(App.db));
  };
  App.reset = () => { App.db = App.defaults(); App.flush(); };

  // ---------- settings helpers ----------
  App.set = () => App.db.settings;
  App.mod = id => !!App.db.settings.modules[id];
  App.vocab = (k, plural) => { const w = (App.db.settings.vocab[k] || k); return plural ? (/[sx]$/.test(w) ? w : w + 's') : w; };
  App.cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  App.log = (action, detail) => { const l = App.db.log; l.push({ t: Date.now(), a: action, d: detail || '', u: App.user ? App.user.name : '' }); if (l.length > 500) l.splice(0, l.length - 500); };

  // permissions: no profile created yet = single owner = everything allowed (roles.js narrows this once users exist)
  App.can = () => true; App.canView = () => true;
  // ready = data loaded AND every script parsed (modules register views/hooks while loading)
  App.ready = Promise.all([App.load(), new Promise(r => document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', r) : r())]);
})();
