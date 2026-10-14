// Activity journal: who created, edited, deleted or cashed what, and when.
// Works by comparing the data with its previous state at every save, so it covers every screen; each entry is attributed to the active profile.
(() => {
  'use strict';
  const App = window.App, $ = App.$, esc = App.esc;
  const MAX = 3000;
  const fm = (n, c) => App.fmt(n, c || 'USD');
  const cl = id => App.cname(App.client(id));
  const supN = o => (App.supplier(o.supplierId) || {}).name || o.supplierName || '';
  // collection -> description of one record (works on a copy of a deleted record too)
  const DESC = {
    clients: o => `le client ${App.cname(o)}`,
    invoices: o => `la facture ${o.number} (${cl(o.clientId)} · ${fm(App.invTotal(o), o.currency)})`,
    payments: o => `un paiement de ${fm(o.amount, o.currency)} (${cl(o.clientId)}${App.invoice(o.invoiceId) ? ' · ' + App.invoice(o.invoiceId).number : ''})`,
    expenses: o => `la dépense « ${o.label} » (${fm(o.amount, o.currency)})`,
    products: o => `le produit ${o.name}`,
    purchases: o => `l'achat du ${App.fdate(o.date)}${supN(o) ? ' chez ' + supN(o) : ''}`,
    deposits: o => `le dépôt de ${cl(o.clientId)} (${fm(o.amount, o.currency)})`,
    penalties: o => `la pénalité de ${cl(o.clientId)} (${fm(o.amount, o.currency)})`,
    quotes: o => `le devis ${o.no}`,
    slpays: o => `un reversement à Starlink (${fm(o.amount, o.currency)})`,
    suppliers: o => `le fournisseur ${o.name}`,
    technicians: o => `le technicien ${o.name}`,
    installs: o => `une installation chez ${cl(o.clientId)}`,
    deliveries: o => `une livraison pour ${cl(o.clientId)}`,
    counts: o => `l'inventaire ${o.no}`,
    orders: o => `le bon de commande ${o.no}`,
    closings: o => `la clôture du ${App.fdate(o.date)}`,
    caisse: o => `un comptage de caisse du ${App.fdate(o.date)}`,
  };
  const COLLS = Object.keys(DESC);
  // fields that change by themselves (or are bookkeeping) are not worth reporting
  const IGNORE = new Set(['rate', 'ts', 'lastRemind', 'seen', 'no', 'fx']);
  const LABEL = { amount: 'Montant', price: 'Prix', cost: 'Coût', date: 'Date', status: 'Statut', phone: 'Téléphone', note: 'Note', name: 'Nom', first: 'Prénom', last: 'Nom', currency: 'Devise', mode: 'Mode', paid: 'Payée le', ref: 'Référence', reason: 'Motif', agreed: 'Prix convenu', pending: 'En attente', min: 'Stock minimum', plan: 'Formule', acc: 'Compte ACC', type: 'Type', address: 'Adresse', city: 'Ville', label: 'Libellé', cat: 'Catégorie', start: 'Début abonnement', period: 'Période', clientId: 'Client', purpose: 'Objet', until: 'Valable jusqu\'au', tech: 'Technicien', discount: 'Remise', phone2: 'Téléphone 2' };
  const short = v => { const s = typeof v === 'string' ? v : JSON.stringify(v); return v === '' || v == null || v === undefined ? '—' : s.length > 28 ? s.slice(0, 27) + '…' : s; };
  let snap = null; // { coll: Map(key -> json) }, users: json, rate
  const keyOf = it => it && (it.id || it.ts || it.date);
  const take = () => { const db = App.db, s = { users: JSON.stringify((db.settings.users || []).map(u => ({ id: u.id, name: u.name, role: u.role, active: u.active }))), rate: db.settings.rate }; COLLS.forEach(c => { const m = new Map(); (db[c] || []).forEach(it => { const k = keyOf(it); if (k != null) m.set(k, JSON.stringify(it)); }); s[c] = m; }); return s; };
  App.auditReset = () => { snap = take(); };
  const list = () => (App.db.audit = App.db.audit || []);
  const push = (e) => { const me = App.me() || {}, now = new Date(); list().push({ ts: Date.now(), date: App.today(), t: now.toTimeString().slice(0, 5), by: me.name || 'Administrateur', role: me.role || 'admin', uid: me.id || '', ...e }); if (list().length > MAX) list().splice(0, list().length - MAX); };
  App.audit = (kind, text, extra) => push({ kind, text, ...(extra || {}) });
  const changes = (a, b, coll) => { const out = []; new Set([...Object.keys(a), ...Object.keys(b)]).forEach(k => { if (IGNORE.has(k) || (coll === 'products' && k === 'qty')) return; const x = JSON.stringify(a[k]), y = JSON.stringify(b[k]); if (x === y) return;
    if (typeof a[k] === 'object' && a[k] !== null || typeof b[k] === 'object' && b[k] !== null) out.push([LABEL[k] || k, 'modifié', '']); else out.push([LABEL[k] || k, short(a[k]), short(b[k])]); }); return out; };
  const diff = () => {
    if (!snap) { snap = take(); return; }
    const db = App.db, cur = take();
    COLLS.forEach(c => { const prev = snap[c], now = cur[c], d = DESC[c];
      now.forEach((json, k) => { const o = JSON.parse(json);
        if (!prev.has(k)) { try { push({ kind: c === 'payments' ? 'pay' : 'add', coll: c, text: c === 'payments' ? `a encaissé ${fm(o.amount, o.currency)} de ${cl(o.clientId)}${App.invoice(o.invoiceId) ? ' · ' + App.invoice(o.invoiceId).number : ''}` : c === 'slpays' ? `a reversé ${fm(o.amount, o.currency)} à Starlink` : 'a créé ' + d(o) }); } catch (e) {} return; }
        if (prev.get(k) === json) return;
        const before = JSON.parse(prev.get(k)), ch = changes(before, o, c); if (!ch.length) return;
        try {
          let kind = 'edit', text = 'a modifié ' + d(o);
          if (c === 'invoices' && before.pending && !o.pending) { kind = 'pay'; text = `a validé la vente ${o.number}`; }
          else if (c === 'penalties' && !before.paid && o.paid) { kind = 'pay'; text = `a encaissé la pénalité de ${cl(o.clientId)} (${fm(o.amount, o.currency)})`; }
          else if (c === 'deposits' && (o.uses || []).length > (before.uses || []).length) { const u = o.uses[o.uses.length - 1]; text = `${u.type === 'refund' ? 'a rendu' : 'a payé'} ${fm(u.amount, o.currency)} ${u.type === 'refund' ? 'au client' : 'pour'} ${cl(o.clientId)}`; }
          push({ kind, coll: c, text, ch: ch.slice(0, 8) });
        } catch (e) {} });
      prev.forEach((json, k) => { if (now.has(k)) return; try { const o = JSON.parse(json); push({ kind: 'del', coll: c, text: 'a supprimé ' + d(o) }); } catch (e) {} }); });
    if (cur.rate !== snap.rate && snap.rate != null) push({ kind: 'edit', coll: 'settings', text: `a changé le taux du jour : ${snap.rate} → ${cur.rate} CDF` });
    if (cur.users !== snap.users) { const a = JSON.parse(snap.users), b = JSON.parse(cur.users);
      b.forEach(u => { const p = a.find(x => x.id === u.id); if (!p) push({ kind: 'add', coll: 'users', text: `a créé le profil ${u.name} (${u.role})` }); else if (p.role !== u.role || p.active !== u.active) push({ kind: 'edit', coll: 'users', text: `a modifié le profil ${u.name} (${u.role}${u.active === false ? ', désactivé' : ''})` }); });
      a.forEach(u => { if (!b.find(x => x.id === u.id)) push({ kind: 'del', coll: 'users', text: `a supprimé le profil ${u.name}` }); }); }
    snap = take(); // includes the entries just added? no: entries live in db.audit, not tracked
  };
  const save0 = App.save;
  App.save = () => { try { diff(); } catch (e) {} return save0(); };
  // who opened the app
  const login0 = App.me_login;
  if (login0) App.me_login = u => { const same = App.user && App.user.id === u.id; const r = login0(u); if (!same) push({ kind: 'login', coll: 'session', text: 'a ouvert sa session', by: u.name, role: u.role, uid: u.id }); return r; };
  document.addEventListener('DOMContentLoaded', () => {});
  setTimeout(() => { if (!snap && App.db) snap = take(); }, 0);

  // ---------- journal view (administrator) ----------
  const st = { who: 'all', kind: 'all', per: '7', q: '' };
  const KIND = { add: ['➕', 'ok', 'Créations'], edit: ['✏️', 'warn', 'Modifications'], del: ['🗑', 'bad', 'Suppressions'], pay: ['💰', 'ok', 'Encaissements'], login: ['🔑', '', 'Connexions'] };
  const ROLE = { admin: 'Administrateur', comptable: 'Comptable', vendeur: 'Vendeur', technicien: 'Technicien', livreur: 'Livreur' };
  const visible = () => { const q = st.q.toLowerCase(), from = st.per === 'all' ? '' : App.addDays(App.today(), -(+st.per - 1));
    return list().filter(e => (st.who === 'all' || e.by === st.who) && (st.kind === 'all' || e.kind === st.kind) && (!from || e.date >= from) && (!q || (e.by + ' ' + e.text).toLowerCase().includes(q))).slice().reverse(); };
  const drawRows = () => { const l = visible().slice(0, 300), days = [];
    l.forEach(e => { let g = days[days.length - 1]; if (!g || g.d !== e.date) { g = { d: e.date, l: [] }; days.push(g); } g.l.push(e); });
    $('jlist').innerHTML = l.length ? days.map(g => `<h2 class="sec">${esc(App.dayLabel(g.d))}</h2><div class="list">${g.l.map(e => { const k = KIND[e.kind] || KIND.edit;
      return `<button class="item" data-act="jr_open" data-i="${list().indexOf(e)}"><span class="avatar ${k[1]}">${k[0]}</span><div class="grow"><span style="font-weight:800">${esc(e.by)}</span> ${esc(e.text)}<small>${esc(e.t || '')} · ${esc(ROLE[e.role] || e.role)}</small></div><span class="mut">›</span></button>`; }).join('')}</div>`).join('') + (visible().length > 300 ? '<p class="mut" style="text-align:center">Affichage des 300 plus récentes : affinez avec les filtres.</p>' : '') : '<div class="empty big"><div class="ei">🕵️</div><b>Aucune activité</b><p class="mut">Les créations, modifications, suppressions et encaissements apparaîtront ici.</p></div>'; };
  App.views.journal = () => {
    const all = list(), today = all.filter(e => e.date === App.today()), week = all.filter(e => e.date >= App.addDays(App.today(), -6)), dels = week.filter(e => e.kind === 'del').length;
    const by = {}; today.forEach(e => { by[e.by] = (by[e.by] || 0) + 1; }); const top = Object.entries(by).sort((a, b) => b[1] - a[1])[0], people = [...new Set(all.map(e => e.by))];
    return {
      title: 'Journal d\'activité', sub: `${today.length} action(s) aujourd'hui`, back: 'more', nav: 'more',
      html: `<section class="hero dhero"><div class="hero-top"><div><small>🕵️ Actions aujourd'hui</small><div class="hero-num" data-count="${today.length}" data-int="1">${today.length}</div></div></div>
          <div class="cstats"><div><b style="font-size:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block">${top ? esc(top[0]) : '—'}</b><small>le plus actif</small></div><div class="${dels ? 'bad' : ''}"><b>${dels}</b><small>suppression(s) / 7 j</small></div><div><b>${all.length}</b><small>au total</small></div></div></section>
        <div class="search"><input id="jq" placeholder="Rechercher (facture, client, personne…)" value="${esc(st.q)}" autocomplete="off"></div>
        <div class="chips">${[['all', 'Tout'], ['add', '➕ Créations'], ['edit', '✏️ Modifs'], ['del', '🗑 Suppressions'], ['pay', '💰 Encaissements'], ['login', '🔑 Connexions']].map(([k, t]) => `<button class="chip ${st.kind === k ? 'on' : ''}" data-act="jr_f" data-k="kind" data-v="${k}">${t}</button>`).join('')}</div>
        <div class="chips">${[['1', "Aujourd'hui"], ['7', '7 jours'], ['30', '30 jours'], ['all', 'Tout']].map(([k, t]) => `<button class="chip ${st.per === k ? 'on' : ''}" data-act="jr_f" data-k="per" data-v="${k}">${t}</button>`).join('')}</div>
        ${people.length > 1 ? `<div class="chips"><button class="chip ${st.who === 'all' ? 'on' : ''}" data-act="jr_f" data-k="who" data-v="all">Tout le monde</button>${people.map(p => `<button class="chip ${st.who === p ? 'on' : ''}" data-act="jr_f" data-k="who" data-v="${esc(p)}">👤 ${esc(p)}</button>`).join('')}</div>` : ''}
        <div id="jlist"></div>`,
      after: () => { drawRows(); $('jq').oninput = e => { st.q = e.target.value; drawRows(); }; }
    };
  };
  App.actions.jr_f = d => { st[d.k] = d.v; App.refresh(); };
  App.actions.jr_open = d => { const e = list()[+d.i]; if (!e) return;
    App.modal('Détail', `<div class="card" style="margin:0 0 10px"><b>${esc(e.by)}</b> <span class="mut">(${esc(ROLE[e.role] || e.role)})</span><div style="margin-top:4px">${esc(e.text)}</div><div class="mut" style="margin-top:6px">${App.fdate(e.date)} à ${esc(e.t || '')}</div></div>
      ${(e.ch || []).length ? `<h2 class="sec">Ce qui a changé</h2><div class="list">${e.ch.map(c => `<div class="item"><div class="grow"><b>${esc(c[0])}</b><small>${esc(c[1])}${c[2] ? ' → ' + esc(c[2]) : ''}</small></div></div>`).join('')}</div>` : ''}`); };
})();
