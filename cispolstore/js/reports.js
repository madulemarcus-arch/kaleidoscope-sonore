// Dashboard, subscriptions calendar and reports.
(() => {
  'use strict';
  const App = window.App, $ = App.$, esc = App.esc;
  const gere = () => App.db.clients.filter(c => c.type === 'gere');
  const periodChips = (act, cur, extra = '') => `<div class="chips">${App.PERIODS.map(([k, t]) => `<button class="chip ${cur === k ? 'on' : ''}" data-act="${act}" data-p="${k}">${t}</button>`).join('')}${extra}</div>`;

  // Totals of invoices / expenses inside a date range, all in USD
  const finance = r => {
    const inv = App.db.invoices.filter(i => App.inRange(i.date, r));
    const ca = inv.reduce((a, i) => a + App.usd(App.invTotal(i), i.currency), 0);
    const cost = inv.reduce((a, i) => a + App.usd(App.invCost(i), i.currency), 0);
    const exp = App.db.expenses.filter(e => App.inRange(e.date, r)).reduce((a, e) => a + App.usd(e.amount, e.currency), 0);
    return { inv, ca, cost, margin: ca - cost, exp, net: ca - cost - exp };
  };

  // ---------- Dashboard ----------
  let dper = 'month';
  const chartData = per => {
    const t = App.today(), r = App.range(per), inv = App.db.invoices.filter(i => App.inRange(i.date, r));
    const val = i => App.usd(App.invTotal(i), i.currency);
    let buckets;
    if (per === 'day') { buckets = Array.from({ length: 24 }, (_, h) => ({ l: h % 3 === 0 ? h + 'h' : '', v: 0 })); inv.forEach(i => { buckets[i.ts ? new Date(i.ts).getHours() : 12].v += val(i); }); }
    else if (per === 'week') { buckets = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(l => ({ l, v: 0 })); inv.forEach(i => { buckets[App.diff(r[0], i.date)].v += val(i); }); }
    else if (per === 'month') { const n = App.diff(r[0], r[1]) + 1; buckets = Array.from({ length: n }, (_, d) => ({ l: (d + 1) % 5 === 1 ? String(d + 1) : '', v: 0 })); inv.forEach(i => { buckets[+i.date.slice(8) - 1].v += val(i); }); }
    else { buckets = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'].map(l => ({ l, v: 0 })); inv.forEach(i => { buckets[+i.date.slice(5, 7) - 1].v += val(i); }); }
    return buckets;
  };
  App.views.home = () => {
    const db = App.db, S = db.settings, g = gere(), t = App.today();
    const subs = g.map(c => ({ c, s: App.sub(c) })).filter(x => x.s);
    const n = k => subs.filter(x => x.s.status === k).length;
    const soon = subs.filter(x => x.s.status === 'actif' && x.s.left <= 7), today = subs.filter(x => x.s.end === t), becomeInactive = subs.filter(x => x.s.gEnd === App.addDays(t, -1) || (x.s.status === 'inactif' && x.s.left === -1));
    const f = finance(App.range(dper)), bars = chartData(dper), max = Math.max(...bars.map(b => b.v), 1);
    const cable = db.products.filter(p => p.unit === 'm' && App.tracked(p)).reduce((a, p) => a + p.qty, 0);
    const low = db.products.filter(p => App.tracked(p) && p.qty <= (p.min || 0)).length;
    const urgent = subs.filter(x => x.s.status !== 'inactif' ? x.s.left <= 7 : x.s.left >= -1).sort((a, b) => (a.s.status === 'actif' ? a.s.left : a.s.status === 'sursis' ? a.s.left - 100 : -200) - (b.s.status === 'actif' ? b.s.left : b.s.status === 'sursis' ? b.s.left - 100 : -200)).slice(0, 8);
    const alert = (ico, txt, cls) => `<button class="item" data-act="go" data-v="subs"><span>${ico}</span><div class="grow"><b class="${cls}" style="white-space:normal">${txt}</b></div><span class="mut">›</span></button>`;
    const alerts = [soon.length && alert('⚠️', `${soon.length} abonnement(s) expirent bientôt (≤ 7 jours).`, 'warn'), n('sursis') && alert('🟠', `${n('sursis')} client(s) sont actuellement en sursis.`, 'warn'), becomeInactive.length && alert('🔴', `${becomeInactive.length} client(s) deviennent inactifs aujourd'hui.`, 'bad')].filter(Boolean);
    return {
      title: 'Accueil', nav: 'home',
      html: `<h2 style="font-size:20px">Bonjour, ${esc(S.company.name)} 👋</h2><div class="mut" style="margin-bottom:10px">Voici un aperçu de votre activité · ${new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</div>
        <div class="search"><input readonly placeholder="Rechercher client, ACC, facture, matériel…" data-act="search"></div>
        <div class="grid two stats">
          <button class="stat" data-act="go" data-v="clients" style="text-align:left;font:inherit;color:inherit;cursor:pointer"><small>👥 Clients</small><b>${db.clients.length}</b><small>au total</small></button>
          <div class="stat"><small><span class="dot" style="background:var(--ok)"></span>Clients actifs</small><b>${n('actif')}</b></div>
          <div class="stat"><small><span class="dot" style="background:var(--warn)"></span>En sursis</small><b>${n('sursis')}</b></div>
          <div class="stat"><small><span class="dot" style="background:var(--bad)"></span>Inactifs</small><b>${n('inactif')}</b></div>
          <div class="stat"><small>📅 Expirent bientôt</small><b class="${soon.length ? 'warn' : ''}">${soon.length}</b></div>
          <div class="stat"><small>⚠️ Expirent aujourd'hui</small><b class="${today.length ? 'bad' : ''}">${today.length}</b></div></div>
        <div class="dash"><div style="grid-area:a">${alerts.length ? `<h2 class="sec">Alertes</h2><div class="list">${alerts.join('')}</div>` : ''}</div>
        <div style="grid-area:b"><h2 class="sec">Finances</h2>${periodChips('dper', dper)}
        <div class="grid two"><div class="stat"><small>💰 Chiffre d'affaires</small><b>${App.fmt(f.ca)}</b></div><div class="stat"><small>📈 Bénéfice net</small><b class="${f.net >= 0 ? 'ok' : 'bad'}">${App.fmt(f.net)}</b></div><div class="stat"><small>💸 Dépenses</small><b>${App.fmt(f.exp)}</b></div><div class="stat"><small>Marge brute</small><b>${App.fmt(f.margin)}</b></div></div>
        ${App.unpaidTotal() > 0.004 ? `<button class="item" data-act="go" data-v="impayes" style="margin-bottom:12px"><span class="avatar warn">🧾</span><div class="grow"><b>Impayés : ${App.fmt(App.unpaidTotal())}</b><small>Voir et relancer</small></div><span class="mut">›</span></button>` : ''}
        <div class="card"><b>Ventes</b><div class="chart">${bars.map(b => `<div title="${App.fmt(b.v)}"><i style="height:${Math.round(b.v / max * 100)}%"></i><small>${b.l}</small></div>`).join('')}</div></div>
        </div><div style="grid-area:c"><h2 class="sec">Stock</h2><div class="grid two"><button class="stat" data-act="go" data-v="stock" style="text-align:left;font:inherit;color:inherit;cursor:pointer"><small>📦 Produits</small><b>${db.products.length}</b>${low ? `<small class="warn">${low} en stock bas</small>` : ''}</button><div class="stat"><small>📏 Câble restant</small><b>${App.nf(cable, 2)} m</b></div></div>
        </div><div style="grid-area:d">${urgent.length ? `<h2 class="sec">Renouvellements à traiter<button class="more" data-act="go" data-v="subs">Tout voir</button></h2><div class="list">${urgent.map(({ c, s }) => `<button class="item" data-act="go" data-v="client" data-id="${c.id}"><span class="avatar ${{ actif: 'ok', sursis: 'warn', inactif: 'bad' }[s.status]}">${esc(App.initials(c))}</span><div class="grow"><b>${esc(App.cname(c))}</b><small>Fin ${App.fdate(s.end)}${s.status === 'sursis' ? ' · sursis → ' + App.fdate(s.gEnd) : ''}</small></div><div class="end">${App.pill(s.status)}</div></button>`).join('')}</div>` : ''}
        </div></div>
        ${App.hasData(db) ? '' : `<div class="card" style="margin-top:14px"><b>Bienvenue 👋</b><p class="mut">Commencez par ajouter vos produits dans <b>Stock</b>, puis créez vos clients avec le bouton <b>+</b>.</p></div>`}`
    };
  };
  App.actions.dper = d => { dper = d.p; App.refresh(); };

  // ---------- Subscriptions calendar ----------
  const cal = (() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth(), sel: App.today() }; })();
  const dayEvents = day => {
    const ev = [];
    gere().forEach(c => { const s = App.sub(c); if (!s) return;
      if (s.end === day) ev.push({ c, k: 'ok', t: 'Fin de l\'abonnement' });
      if (s.grace && day >= s.gStart && day <= s.gEnd) ev.push({ c, k: 'warn', t: `Sursis (jusqu'au ${App.fdate(s.gEnd)})` });
      if (App.addDays(s.gEnd, 1) === day) ev.push({ c, k: 'bad', t: 'Devient inactif' }); });
    return ev;
  };
  App.views.subs = () => {
    const g = gere(), subs = g.map(c => ({ c, s: App.sub(c) })).filter(x => x.s), n = k => subs.filter(x => x.s.status === k).length;
    const first = new Date(cal.y, cal.m, 1), lead = (first.getDay() + 6) % 7, days = new Date(cal.y, cal.m + 1, 0).getDate(), t = App.today();
    let cells = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(x => `<div class="h">${x}</div>`).join('') + '<i></i>'.repeat(lead);
    for (let d = 1; d <= days; d++) {
      const iso = App.iso(new Date(cal.y, cal.m, d)), ev = dayEvents(iso), kinds = [...new Set(ev.map(e => e.k))];
      cells += `<button class="${iso === t ? 'today' : ''} ${iso === cal.sel ? 'sel' : ''}" data-act="calday" data-d="${iso}">${d}<span class="d">${kinds.map(k => `<i style="background:var(--${k})"></i>`).join('')}</span></button>`;
    }
    const evs = dayEvents(cal.sel);
    const upcoming = subs.filter(x => x.s.status === 'actif' && x.s.left <= 30).sort((a, b) => a.s.left - b.s.left);
    return {
      title: 'Abonnements', back: 'more', nav: 'more',
      html: `<div class="grid"><div class="stat"><small><span class="dot" style="background:var(--ok)"></span>Actifs</small><b>${n('actif')}</b></div><div class="stat"><small><span class="dot" style="background:var(--warn)"></span>En sursis</small><b>${n('sursis')}</b></div><div class="stat"><small><span class="dot" style="background:var(--bad)"></span>Inactifs</small><b>${n('inactif')}</b></div></div>
        <div class="bar" style="margin-bottom:12px"><button class="btn" data-act="go" data-v="rappels">📲 Rappels WhatsApp</button></div>
        <div class="card"><div class="spread" style="margin-bottom:8px"><button class="btn sm sec" data-act="calnav" data-n="-1">‹</button><b>${first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</b><button class="btn sm sec" data-act="calnav" data-n="1">›</button></div><div class="cal">${cells}</div>
          <div class="legend"><span><i style="background:var(--ok)"></i>Fin d'abonnement</span><span><i style="background:var(--warn)"></i>Période de sursis</span><span><i style="background:var(--bad)"></i>Passage à inactif</span></div></div>
        <h2 class="sec">${App.fdate(cal.sel)}</h2>${evs.length ? `<div class="list">${evs.map(e => `<button class="item" data-act="go" data-v="client" data-id="${e.c.id}"><span class="avatar ${e.k}">${esc(App.initials(e.c))}</span><div class="grow"><b>${esc(App.cname(e.c))}</b><small>${e.t}</small></div><span class="mut">›</span></button>`).join('')}</div>` : '<div class="empty">Aucun événement ce jour.</div>'}
        <h2 class="sec">Renouvellements à venir (30 jours)</h2>${upcoming.length ? `<div class="list">${upcoming.map(({ c, s }) => `<button class="item" data-act="go" data-v="client" data-id="${c.id}"><span class="avatar ok">${esc(App.initials(c))}</span><div class="grow"><b>${esc(App.cname(c))}</b><small>${esc(c.plan || '')}</small></div><div class="end"><b>${App.fdate(s.end)}</b><span class="mut">dans ${s.left} j</span></div></button>`).join('')}</div>` : '<div class="empty">Aucun renouvellement dans les 30 prochains jours.</div>'}`
    };
  };
  App.actions.calday = d => { cal.sel = d.d; App.refresh(); };
  App.actions.calnav = d => { const x = new Date(cal.y, cal.m + +d.n, 1); cal.y = x.getFullYear(); cal.m = x.getMonth(); App.refresh(); };

  // ---------- Reports ----------
  const rs = { tab: 'ventes', per: 'month', from: App.today().slice(0, 8) + '01', to: App.today() };
  const TABS = [['ventes', 'Ventes'], ['abos', 'Abonnements'], ['inst', 'Installations'], ['mat', 'Matériel'], ['benef', 'Bénéfices'], ['dep', 'Dépenses'], ['stock', 'Stock'], ['clients', 'Clients']];
  const rng = () => rs.per === 'custom' ? [rs.from, rs.to] : App.range(rs.per);
  const money = 'm';
  const REP = {
    ventes: r => { const inv = App.db.invoices.filter(i => App.inRange(i.date, r)).sort((a, b) => b.date.localeCompare(a.date)), f = finance(r), due = inv.reduce((a, i) => a + App.usd(App.invDue(i), i.currency), 0);
      return { cards: [['Factures', inv.length], ['Chiffre d\'affaires', f.ca, money], ['Reste à encaisser', due, money]], head: ['Date', 'Facture', 'Client', 'Type', 'Total ($)', 'Reste ($)'], fmt: [4, 5], rows: inv.map(i => [i.date, i.number, App.cname(App.client(i.clientId)), App.invTypes[i.type], App.usd(App.invTotal(i), i.currency), App.usd(App.invDue(i), i.currency)]) }; },
    abos: r => { const lines = []; App.db.invoices.filter(i => App.inRange(i.date, r)).forEach(i => i.lines.forEach(l => { if (/^abonnement/i.test(l.desc)) lines.push([i.date, i.number, App.cname(App.client(i.clientId)), l.desc, App.usd(l.qty * l.price, i.currency), App.usd(l.qty * (l.price - (l.cost || 0)), i.currency)]); }));
      const g = gere().map(c => App.sub(c)).filter(Boolean), n = k => g.filter(s => s.status === k).length;
      return { cards: [['Renouvellements facturés', lines.length], ['Revenus abonnements', lines.reduce((a, x) => a + x[4], 0), money], ['Marge abonnements', lines.reduce((a, x) => a + x[5], 0), money], ['Actifs / sursis / inactifs', `${n('actif')} / ${n('sursis')} / ${n('inactif')}`]], head: ['Date', 'Facture', 'Client', 'Désignation', 'Montant ($)', 'Marge ($)'], fmt: [4, 5], rows: lines.sort((a, b) => b[0].localeCompare(a[0])) }; },
    inst: r => { const l = App.db.installs.filter(x => App.inRange(x.date, r)).sort((a, b) => b.date.localeCompare(a.date));
      return { cards: [['Installations', l.length], ['Revenus', l.reduce((a, x) => a + (x.price || 0), 0), money]], head: ['Date', 'Client', 'Type', 'Technicien', 'Prix ($)'], fmt: [4], rows: l.map(x => [x.date, App.cname(App.client(x.clientId)), x.kind, x.tech || '', x.price || 0]) }; },
    mat: r => { const by = {}; App.db.invoices.filter(i => App.inRange(i.date, r)).forEach(i => i.lines.forEach(l => { if (!l.pid) return; const o = by[l.pid] = by[l.pid] || { name: l.desc, unit: l.unit, q: 0, rev: 0, cost: 0 }; o.q += l.qty; o.rev += App.usd(l.qty * l.price, i.currency); o.cost += App.usd(l.qty * (l.cost || 0), i.currency); }));
      const rows = Object.values(by).sort((a, b) => b.rev - a.rev).map(o => [o.name, o.q + (o.unit ? ' ' + o.unit : ''), o.rev, o.rev - o.cost]);
      return { cards: [['Articles vendus', rows.length], ['Ventes matériel', rows.reduce((a, x) => a + x[2], 0), money], ['Marge', rows.reduce((a, x) => a + x[3], 0), money]], head: ['Article', 'Quantité', 'Ventes ($)', 'Marge ($)'], fmt: [2, 3], rows }; },
    benef: r => { const f = finance(r);
      return { cards: [['Chiffre d\'affaires', f.ca, money], ['Coût des marchandises', f.cost, money], ['Marge brute', f.margin, money], ['Dépenses', f.exp, money], ['Bénéfice net', f.net, money]], head: ['Facture', 'Date', 'Vente ($)', 'Coût ($)', 'Bénéfice ($)'], fmt: [2, 3, 4], rows: f.inv.sort((a, b) => b.date.localeCompare(a.date)).map(i => { const v = App.usd(App.invTotal(i), i.currency), c = App.usd(App.invCost(i), i.currency); return [i.number, i.date, v, c, v - c]; }) }; },
    dep: r => { const l = App.db.expenses.filter(e => App.inRange(e.date, r)).sort((a, b) => b.date.localeCompare(a.date)), by = {}; l.forEach(e => { by[e.cat] = (by[e.cat] || 0) + App.usd(e.amount, e.currency); });
      return { cards: [['Dépenses', l.reduce((a, e) => a + App.usd(e.amount, e.currency), 0), money], ...Object.entries(by).map(([k, v]) => [k, v, money])], head: ['Date', 'Libellé', 'Catégorie', 'Montant ($)'], fmt: [3], rows: l.map(e => [e.date, e.label, e.cat, App.usd(e.amount, e.currency)]) }; },
    stock: () => { const p = App.db.products.filter(App.tracked), val = p.reduce((a, x) => a + x.qty * x.cost, 0), sale = p.reduce((a, x) => a + x.qty * x.price, 0);
      return { cards: [['Produits suivis', p.length], ['Valeur (achat)', val, money], ['Valeur (vente)', sale, money], ['Stock bas', p.filter(x => x.qty <= (x.min || 0)).length]], head: ['Produit', 'Catégorie', 'Quantité', 'Valeur achat ($)'], fmt: [3], rows: p.sort((a, b) => a.name.localeCompare(b.name)).map(x => [x.name, x.cat, x.qty + (x.unit === 'm' ? ' m' : ''), x.qty * x.cost]) }; },
    clients: r => { const c = App.db.clients, tot = {}; App.db.invoices.forEach(i => { tot[i.clientId] = (tot[i.clientId] || 0) + App.usd(App.invTotal(i), i.currency); });
      return { cards: [['Clients', c.length], ['Gérés', c.filter(x => x.type === 'gere').length], ['Matériel / Installation', `${c.filter(x => x.type === 'mat').length} / ${c.filter(x => x.type === 'install').length}`], ['Nouveaux (période)', c.filter(x => App.inRange(x.created || '', r)).length]], head: ['Client', 'Type', 'Statut', 'Total facturé ($)'], fmt: [3], rows: c.map(x => [App.cname(x), App.TYPES[x.type], App.sub(x) ? App.STATUS[App.sub(x).status][0] : '—', tot[x.id] || 0]).sort((a, b) => b[3] - a[3]) }; }
  };
  const lastReport = { head: [], rows: [] };
  App.views.reports = () => {
    const r = rng(), rep = REP[rs.tab](r), noPer = rs.tab === 'stock';
    Object.assign(lastReport, rep);
    const show = (v, i) => rep.fmt && rep.fmt.includes(i) ? App.fmt(v) : esc(v);
    return {
      title: 'Rapports', back: 'more', nav: 'more',
      html: `<div class="tabs">${TABS.map(([k, t]) => `<button class="${rs.tab === k ? 'on' : ''}" data-act="reptab" data-t="${k}">${t}</button>`).join('')}</div>
        ${noPer ? '' : `${periodChips('repper', rs.per, `<button class="chip ${rs.per === 'custom' ? 'on' : ''}" data-act="repper" data-p="custom">Personnalisée</button>`)}${rs.per === 'custom' ? `<div class="row"><div><label class="l">Du</label><input type="date" id="r_from" value="${rs.from}"></div><div><label class="l">Au</label><input type="date" id="r_to" value="${rs.to}"></div></div>` : ''}<div class="mut" style="margin:6px 0">Période : ${App.fdate(r[0])} → ${App.fdate(r[1])}</div>`}
        <div class="grid">${rep.cards.map(([l, v, m]) => `<div class="stat"><small>${esc(l)}</small><b>${m ? App.fmt(v) : esc(v)}</b></div>`).join('')}</div>
        <div class="bar"><button class="btn sec" data-act="repcsv">⬇ Exporter CSV</button></div>
        ${rep.rows.length ? `<div class="card" style="padding:0;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr>${rep.head.map(h => `<th style="text-align:left;padding:9px 10px;color:var(--mut);font-size:12px;white-space:nowrap">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rep.rows.slice(0, 300).map(row => `<tr>${row.map((v, i) => `<td style="padding:8px 10px;border-top:1px solid var(--line);${rep.fmt && rep.fmt.includes(i) ? 'text-align:right;white-space:nowrap' : ''}">${show(v, i)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<div class="empty">Aucune donnée sur cette période.</div>'}`,
      after: () => { ['r_from', 'r_to'].forEach(id => { if ($(id)) $(id).onchange = () => { rs.from = $('r_from').value || rs.from; rs.to = $('r_to').value || rs.to; App.refresh(); }; }); }
    };
  };
  App.actions.reptab = d => { rs.tab = d.t; App.refresh(); };
  App.actions.repper = d => { rs.per = d.p; App.refresh(); };
  App.actions.repcsv = () => App.download(`cispolstore-rapport-${rs.tab}-${App.today()}.csv`, App.csv([lastReport.head, ...lastReport.rows]), 'text/csv');
})();
