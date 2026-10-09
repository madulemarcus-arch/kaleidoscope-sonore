// Core: utilities, data model, storage, migration, business rules shared by every module.
(() => {
  'use strict';
  const App = window.App = { views: {}, actions: {} };
  const $ = App.$ = id => document.getElementById(id);
  App.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  App.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // ---------- Dates (ISO yyyy-mm-dd, local time) ----------
  const pad = n => String(n).padStart(2, '0');
  const iso = App.iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = App.parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  App.today = () => iso(new Date());
  App.addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  App.diff = (a, b) => Math.round((parse(b) - parse(a)) / 864e5); // days from a to b
  App.fdate = s => s ? s.split('-').reverse().join('/') : '—';
  App.weekStart = s => { const d = parse(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); };

  // ---------- Constants ----------
  App.PAY_MODES = ['Cash', 'M-Pesa', 'Airtel Money', 'Orange Money', 'Banque', 'Carte', 'Autre'];
  App.CATS = ['Kits Starlink', 'Routeurs', 'Câbles', 'Connecteurs', 'Injecteurs PoE', 'Antennes', 'Accessoires', 'Abonnement', 'Service', 'Autre'];
  App.NO_STOCK = ['Abonnement', 'Service'];
  App.EXP_CATS = ['Achat marchandise', 'Transport', 'Loyer', 'Salaire', 'Commission technicien', 'Internet / Abonnement', 'Marketing', 'Autre'];
  App.PLANS = ['Résidentiel', 'Résidentiel Lite', 'Local Prioritaire 50 Go', 'Local Prioritaire 1 To', 'Itinérance', 'Mobile Prioritaire'];
  App.KITS = ['Starlink Mini', 'Starlink Standard'];
  App.TYPES = { gere: 'Client géré', mat: 'Matériel uniquement', install: 'Installation uniquement' };

  // ---------- Data ----------
  const KEY = 'cispolstore-v2', OLD_KEY = 'cispolstore-v1';
  const blank = () => ({
    v: 2,
    settings: {
      company: { name: 'CISPOLstore', address: 'Kinshasa, RDC', phone: '+243 814 048 480', email: 'contact@cispolstore.com', rccm: '', idnat: '', impot: '', logo: '', tagline: 'SOLUTIONS TECHNOLOGIQUES ET CONNECTIVITE', city: 'Kinshasa', payTerms: 'Virement bancaire ou espèces.' },
      plans: { 'Résidentiel': { price: 70, cost: 64 } }, rate: 2400, rates: [], theme: 'auto', lockMin: 2, period: 30, grace: 15, pin: null, invSeq: {}, clientSeq: 0
    },
    clients: [], products: [], moves: [], suppliers: [], technicians: [], penalties: [], deliveries: [], invoices: [], payments: [], installs: [], expenses: [], closings: [], log: []
  });
  App.blank = blank;
  const normalize = o => {
    const b = blank(), s = o.settings || {};
    return { ...b, ...o, settings: { ...b.settings, ...s, company: { ...b.settings.company, ...(s.company || {}) } } };
  };
  App.hasData = d => d && ['clients', 'products', 'invoices', 'expenses'].some(k => (d[k] || []).length);

  // Import a v1 (single-page app) backup into the v2 model
  App.migrate = o => {
    const d = blank(), t = App.today();
    const seq = () => 'CL-' + String(++d.settings.clientSeq).padStart(4, '0');
    (o.products || []).forEach(p => d.products.push({ id: p.id, name: p.name, cat: p.cat === 'Starlink' ? 'Kits Starlink' : p.cat === 'Routeur / WiFi' ? 'Routeurs' : (App.CATS.includes(p.cat) ? p.cat : 'Autre'), ref: '', unit: 'pièce', qty: p.stock || 0, cost: p.cost || 0, price: p.price || 0, supplierId: '', min: p.min || 0, entry: '' }));
    (o.clients || []).forEach(c => {
      const g = c.type === 'gere';
      const n = { id: c.id, code: seq(), type: g ? 'gere' : 'mat', first: c.first || '', last: c.last || c.name || '', phone: c.phone || '', phone2: '', address: c.addr || '', city: '', quarter: '', installAddr: c.addr || '', acc: c.acc || '', serial: '', kit: '', plan: c.plan || '', price: c.amount || 0, payMode: 'Cash', start: '', period: d.settings.period, grace: Number.isFinite(c.grace) ? c.grace : 15, note: c.note || '', article: c.article || '', created: t, subs: [] };
      n.name = (n.first + ' ' + n.last).trim();
      if (g && c.due) { n.start = c.start && App.diff(c.start, c.due) > 0 ? c.start : App.addDays(c.due, -d.settings.period); n.period = Math.max(1, App.diff(n.start, c.due)); }
      d.clients.push(n);
      (c.payments || []).forEach(p => d.payments.push({ id: App.uid(), date: p.date, clientId: c.id, invoiceId: '', amount: p.amount, currency: 'USD', mode: 'Cash', ref: '', comment: 'Abonnement (ancienne version)' }));
    });
    const yr = {};
    (o.sales || []).slice().sort((a, b) => a.date.localeCompare(b.date)).forEach(s => {
      const y = s.date.slice(0, 4); yr[y] = (yr[y] || 0) + 1; d.settings.invSeq[y] = yr[y];
      const inv = { id: s.id, number: `FAC-${y}-${String(yr[y]).padStart(4, '0')}`, date: s.date, ts: 0, type: 'materiel', clientId: s.clientId || '', currency: 'USD', payMode: 'Cash', lines: (s.items || []).map(i => ({ pid: i.pid, desc: i.name, qty: i.qty, price: i.price, cost: i.cost || 0, unit: 'pièce' })), note: '' };
      d.invoices.push(inv);
      (s.payments || []).forEach(p => d.payments.push({ id: App.uid(), date: p.date, clientId: s.clientId || '', invoiceId: s.id, amount: p.amount, currency: 'USD', mode: 'Cash', ref: '', comment: '' }));
    });
    (o.expenses || []).forEach(e => d.expenses.push({ id: e.id, date: e.date, label: e.label, cat: e.cat, amount: e.amount, currency: 'USD' }));
    return d;
  };

  let db = blank();
  try {
    const raw = localStorage.getItem(KEY), old = localStorage.getItem(OLD_KEY);
    if (raw) db = normalize(JSON.parse(raw));
    else if (old) { db = normalize(App.migrate(JSON.parse(old))); }
  } catch (e) { db = blank(); }
  Object.defineProperty(App, 'db', { get: () => db, set: v => { db = normalize(v); } });

  // Internal storage: localStorage + IndexedDB mirror (restored if localStorage is wiped)
  const idb = (mode, fn) => new Promise((ok, ko) => {
    const o = indexedDB.open('cispolstore', 1);
    o.onupgradeneeded = () => o.result.createObjectStore('kv');
    o.onerror = () => ko(o.error);
    o.onsuccess = () => { const r = fn(o.result.transaction('kv', mode).objectStore('kv')); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); };
  });
  App.save = () => {
    App.stampRates();
    const txt = JSON.stringify(db);
    try { localStorage.setItem(KEY, txt); } catch (e) { App.toast('Stockage local plein ou bloqué : faites une sauvegarde'); }
    try { idb('readwrite', st => st.put(txt, 'db2')).catch(() => {}); } catch (e) {}
    if (App.afterSave) App.afterSave();
  };
  // Backup content: everything except this device's PIN
  App.exportData = () => { const d = JSON.parse(JSON.stringify(db)); delete d.settings.pin; delete d.settings.users; return d; };
  App.recover = () => idb('readonly', st => st.get('db2')).then(t => { if (!t) return false; const d = JSON.parse(t); if (App.hasData(d)) { db = normalize(d); App.save(); return true; } return false; }).catch(() => false);

  // ---------- Money ----------
  // Exchange rate: the current rate, a history of every change, and a rate frozen on each invoice / payment / expense / penalty
  App.rate = () => +db.settings.rate || 2400;
  App.rateOn = d => { const h = (db.settings.rates || []).filter(x => x.date <= d).sort((a, b) => a.date.localeCompare(b.date) || (a.ts || 0) - (b.ts || 0)); return h.length ? +h[h.length - 1].rate : App.rate(); };
  App.rateOf = r => +r.rate || App.rateOn(r.date || r.paid || App.today());
  // gives every record its own rate (once), so changing the rate later never rewrites the past
  const STAMPED = [['invoices', 'date'], ['payments', 'date'], ['expenses', 'date'], ['penalties', 'date']];
  App.stampRates = () => { STAMPED.forEach(([k, f]) => (db[k] || []).forEach(r => { if (!(+r.rate > 0)) r.rate = App.rateOn(r[f] || App.today()); })); };
  App.setRate = r => {
    r = Math.round(+r) || 0; const S = db.settings; if (r < 1 || r === +S.rate) return false;
    App.stampRates();   // freeze every existing record at the previous rate first
    S.rate = r; S.rates = [...(S.rates || []), { date: App.today(), ts: Date.now(), rate: r }].slice(-400); return true;
  };
  App.conv = (n, from, to, rate) => from === to ? n : (rate = +rate || App.rate(), from === 'CDF' ? n / rate : n * rate);
  App.usd = (n, cur, rec) => App.conv(n, cur || 'USD', 'USD', rec ? App.rateOf(rec) : undefined);
  const nf = (n, d) => (+n || 0).toLocaleString('fr-FR', { maximumFractionDigits: d });
  App.fmt = (n, cur = 'USD') => cur === 'CDF' ? `${nf(n, 0)} CDF` : `${nf(n, Math.abs(n % 1) > 0.004 ? 2 : 0)} $`;
  App.nf = nf;

  // ---------- Lookups ----------
  App.client = id => db.clients.find(c => c.id === id);
  App.prod = id => db.products.find(p => p.id === id);
  App.supplier = id => db.suppliers.find(s => s.id === id);
  App.invoice = id => db.invoices.find(i => i.id === id);
  App.cname = c => c ? (c.name || ((c.first || '') + ' ' + (c.last || '')).trim() || '—') : 'Client de passage';
  App.initials = c => { const n = App.cname(c).split(/\s+/).filter(Boolean); return ((n[0] || '?')[0] + (n[1] ? n[1][0] : '')).toUpperCase(); };
  App.tracked = p => !!p && !App.NO_STOCK.includes(p.cat);
  App.nextClientCode = () => 'CL-' + String(++db.settings.clientSeq).padStart(4, '0');
  App.log = (clientId, text) => { db.log.push({ ts: Date.now(), date: App.today(), clientId: clientId || '', text }); if (db.log.length > 5000) db.log.splice(0, db.log.length - 5000); };

  // ---------- Subscriptions ----------
  // end = start + period days ; grace runs from end+1 to end+grace
  App.sub = c => {
    if (!c || c.type !== 'gere' || !c.start) return null;
    const days = c.period || db.settings.period, grace = Number.isFinite(c.grace) ? c.grace : db.settings.grace;
    const end = App.addDays(c.start, days), gStart = App.addDays(end, 1), gEnd = App.addDays(end, grace), t = App.today();
    let status, left;
    if (t <= end) { status = 'actif'; left = App.diff(t, end); }
    else if (t <= gEnd) { status = 'sursis'; left = App.diff(t, gEnd); }
    else { status = 'inactif'; left = -App.diff(gEnd, t); }
    return { start: c.start, days, grace, end, gStart, gEnd, status, left };
  };
  App.STATUS = { actif: ['Actif', 'ok'], sursis: ['En sursis', 'warn'], inactif: ['Inactif', 'bad'] };
  App.pill = status => { const [t, k] = App.STATUS[status]; return `<span class="pill ${k}">${t}</span>`; };

  // ---------- Invoices ----------
  App.invTotal = i => i.lines.reduce((a, l) => a + l.qty * l.price, 0);
  App.invCost = i => i.lines.reduce((a, l) => a + l.qty * (l.cost || 0), 0);
  App.invPaid = i => db.payments.filter(p => p.invoiceId === i.id).reduce((a, p) => a + App.conv(p.amount, p.currency, i.currency, App.rateOf(p)), 0);
  // negotiated price: the printed invoice keeps its full total, but what the client really owes (and what counts as revenue) is i.agreed
  App.invAgreed = i => +i.agreed > 0 && +i.agreed < App.invTotal(i) ? +i.agreed : App.invTotal(i);
  // a pending invoice was only handed to the client: no stock out, no revenue, nothing to collect until the sale is validated
  App.live = i => !i.pending;
  App.invDue = i => i.pending ? 0 : Math.max(0, App.invAgreed(i) - App.invPaid(i));
  App.invStatus = i => { if (i.pending) return 'pending'; const t = App.invAgreed(i), p = App.invPaid(i); return p >= t - 0.005 ? 'paid' : p > 0 ? 'part' : 'unpaid'; };
  App.INV = { paid: ['Payée', 'ok'], part: ['Partielle', 'warn'], unpaid: ['Impayée', 'bad'], pending: ['En attente', 'warn'] };
  App.invTypes = { materiel: 'Matériel', abonnement: 'Abonnement', installation: 'Installation', complete: 'Facture complète' };
  App.nextInvNumber = (year, dry) => {
    const prefix = `FAC-${year}-`;
    const max = db.invoices.reduce((m, i) => i.number.startsWith(prefix) ? Math.max(m, parseInt(i.number.slice(prefix.length), 10) || 0) : m, 0);
    const n = Math.max(max, db.settings.invSeq[year] || 0) + 1;
    if (!dry) db.settings.invSeq[year] = n;
    return prefix + String(n).padStart(4, '0');
  };

  // ---------- Stock ----------
  // qty > 0 adds to stock, qty < 0 removes it
  App.move = m => {
    const p = App.prod(m.pid); if (!p) return;
    const mv = { id: App.uid(), date: m.date || App.today(), pid: m.pid, qty: m.qty, type: m.qty >= 0 ? 'in' : 'out', cost: m.cost ?? p.cost, supplierId: m.supplierId || '', purchase: !!m.purchase, invoiceId: m.invoiceId || '', clientId: m.clientId || '', note: m.note || '' };
    if (App.tracked(p)) p.qty = Math.round((p.qty + m.qty) * 1000) / 1000;
    if (m.qty > 0 && m.cost != null) p.cost = m.cost;
    if (m.qty > 0 && m.supplierId) p.supplierId = m.supplierId;
    db.moves.push(mv); return mv;
  };

  // ---------- Period helpers (reports & dashboard) ----------
  App.range = key => {
    const t = App.today();
    if (key === 'day') return [t, t];
    if (key === 'week') return [App.weekStart(t), App.addDays(App.weekStart(t), 6)];
    if (key === 'month') return [t.slice(0, 8) + '01', iso(new Date(+t.slice(0, 4), +t.slice(5, 7), 0))];
    return [t.slice(0, 4) + '-01-01', t.slice(0, 4) + '-12-31'];
  };
  App.inRange = (d, r) => d >= r[0] && d <= r[1];
  App.PERIODS = [['day', "Aujourd'hui"], ['week', 'Cette semaine'], ['month', 'Ce mois'], ['year', 'Cette année']];

  // ---------- French number to words (invoice) ----------
  const U = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const T = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];
  const b100 = (n, fin) => {
    if (n < 20) return U[n];
    if (n < 70) { const t = Math.floor(n / 10), u = n % 10; return T[t] + (u === 1 ? ' et un' : u ? '-' + U[u] : ''); }
    if (n < 80) { const u = n - 60; return 'soixante' + (u === 11 ? ' et onze' : '-' + U[u]); }
    const u = n - 80; return u === 0 ? (fin ? 'quatre-vingts' : 'quatre-vingt') : 'quatre-vingt-' + U[u];
  };
  const b1000 = (n, fin) => {
    const h = Math.floor(n / 100), r = n % 100;
    if (!h) return b100(r, fin);
    const head = h === 1 ? 'cent' : U[h] + ' cent';
    return r ? head + ' ' + b100(r, fin) : head + (h > 1 && fin ? 's' : '');
  };
  App.words = n => {
    n = Math.floor(n); if (n === 0) return 'zéro';
    const mil = Math.floor(n / 1e6), th = Math.floor(n % 1e6 / 1000), r = n % 1000, out = [];
    if (mil) out.push((mil === 1 ? 'un' : b1000(mil, false)) + (mil > 1 ? ' millions' : ' million'));
    if (th) out.push(th === 1 ? 'mille' : b1000(th, false) + ' mille');
    if (r) out.push(b1000(r, true));
    return out.join(' ');
  };
  App.amountWords = (n, cur) => {
    const whole = Math.floor(n + 1e-9), cents = Math.round((n - whole) * 100);
    const unit = cur === 'CDF' ? (whole > 1 ? 'francs congolais' : 'franc congolais') : (whole > 1 ? 'dollars américains' : 'dollar américain');
    let s = `${App.words(whole)} ${unit}`;
    if (cents) s += ` et ${App.words(cents)} ${cents > 1 ? 'cents' : 'cent'}`;
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  // ---------- CSV / downloads ----------
  App.csv = rows => '﻿' + rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
  App.download = (name, text, type) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  };
})();
