// Reports: sales, expenses, profit, clients, stock, simple accounting, comparison with the previous period, monthly goal, shareable monthly report.
(function () {
  const App = window.App, ui = App.ui, esc = App.esc, M = App.money, A = App.sales, S = App.stock, F = App.fin, db = () => App.db;
  const R = App.reports = {};
  const pct = (a, b) => b ? Math.round((a - b) / Math.abs(b) * 100) : null;
  const delta = (a, b) => { const p = pct(a, b); return p == null ? '' : '<b class="' + (p >= 0 ? 'up' : 'down') + '">' + (p >= 0 ? '▲ +' : '▼ ') + p + ' %</b>'; };
  // everything a report needs for a period, in the main currency
  R.compute = r => {
    const inv = db().invoices.filter(i => A.live(i) && F.inR(i.date, r)), pays = db().payments.filter(p => F.inR(p.date, r)), exps = F.expensesIn(r);
    let revenue = 0, cogs = 0; const clients = {}, prods = {};
    inv.forEach(i => {
      const t = A.main(i, i.total); revenue += t; const k = i.clientId || '_'; clients[k] = clients[k] || { id: i.clientId, name: A.cname(i), v: 0, n: 0 }; clients[k].v += t; clients[k].n++;
      const f = i.sub ? i.total / i.sub : 1; i.lines.forEach(l => { const c = (+l.cost || 0) * l.qty; cogs += c; const key = l.pid || l.desc, v = A.main(i, l.qty * l.price * f); prods[key] = prods[key] || { name: l.desc, qty: 0, v: 0, cost: 0 }; prods[key].qty += l.qty; prods[key].v += v; prods[key].cost += c; });
    });
    const exp = F.sumMain(exps.map(e => ({ amount: e.amount, cur: e.currency, rate: e.rate }))), byCat = {}; exps.forEach(e => byCat[e.category] = (byCat[e.category] || 0) + F.toMain(e.amount, e.currency, e.rate));
    const collected = F.sumMain(pays.map(p => ({ amount: p.amount, cur: p.currency, rate: p.rate })));
    return { r, n: inv.length, revenue, cogs, margin: revenue - cogs, exp, byCat, collected, profit: revenue - cogs - exp, clients: Object.values(clients).sort((a, b) => b.v - a.v), prods: Object.values(prods).sort((a, b) => b.v - a.v), newClients: db().clients.filter(c => F.inR(c.created || '', r)).length, inv };
  };
  R.goalPct = rev => db().settings.goal > 0 ? Math.round(rev / db().settings.goal * 100) : null;
  const bars = (items, fmt) => items.length ? '<div>' + items.map(([l, v, max]) => '<div class="rbar"><span>' + esc(l) + '</span><i style="width:' + Math.max(3, Math.round(v / (max || 1) * 100)) + '%"></i><b>' + fmt(v) + '</b></div>').join('') + '</div>' : '<p class="muted">Aucune donnée.</p>';

  // ---------- period report (tab « Rapports » of the Argent screen) ----------
  F.tabs.rep = {
    label: 'Rapports', perm: 'reports',
    render(tab, el) {
      const r = F.range(F.state.r), c = R.compute(r), p = R.compute(F.prevRange(r)), gp = F.state.r === 'month' ? R.goalPct(c.revenue) : null;
      const daily = F.perDay(r, days => c.inv.forEach(i => { const d = days.find(x => x.d === i.date); if (d) d.v += A.main(i, i.total); }));
      const catMax = Math.max(0, ...Object.values(c.byCat)), cats = Object.entries(c.byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v, catMax]);
      const topMax = c.clients.length ? c.clients[0].v : 1, low = S.low().length, stockVal = db().products.reduce((a, x) => a + S.value(x), 0), recv = A.unpaidTotal();
      const cashE = App.mod('cash') && App.cash ? App.cash.expected() : null;
      tab.innerHTML = F.rangeChips() +
        '<section class="hero"><small>Chiffre d\'affaires · ' + esc(r.label) + '</small><div class="amt">' + M.main(c.revenue) + '</div><div class="sub">≈ ' + M.second(c.revenue) + ' · ' + c.n + ' facture(s) ' + delta(c.revenue, p.revenue) + '</div>' + (gp != null ? '<div class="goalbar"><i style="width:' + Math.min(gp, 100) + '%"></i></div><div class="sub">Objectif ' + M.main(db().settings.goal) + ' · ' + gp + ' %</div>' : '') + '</section>' +
        '<div class="stats card"><div><b>' + M.main(c.margin) + '</b><small>marge brute</small></div><div><b>' + M.main(c.exp) + '</b><small>dépenses</small></div><div class="' + (c.profit < 0 ? 'bad' : '') + '"><b>' + M.main(c.profit) + '</b><small>bénéfice ' + delta(c.profit, p.profit) + '</small></div></div>' +
        '<p class="muted center">Bénéfice = prix de vente − prix d\'achat − dépenses</p>' +
        (App.mod('sales') ? '<section class="card"><h3>Ventes</h3>' + F.bars(daily, { title: 'Ventes par jour', fmt: M.main }) + '<div class="stats"><div><b>' + c.n + '</b><small>factures</small></div><div><b>' + M.main(c.n ? c.revenue / c.n : 0) + '</b><small>panier moyen</small></div><div><b>' + M.main(c.collected) + '</b><small>encaissé</small></div></div>' + (c.prods.length ? '<h4>Meilleures ventes</h4>' + bars(c.prods.slice(0, 5).map(x => [x.name + ' (×' + S.nf(x.qty) + ')', x.v, c.prods[0].v]), M.main) : '') + '</section>' : '') +
        '<section class="card"><h3>Dépenses</h3>' + bars(cats, M.main) + '</section>' +
        '<section class="card"><h3>' + esc(App.cap(App.vocab('client', true))) + '</h3><div class="stats"><div><b>' + c.clients.length + '</b><small>actif(s)</small></div><div><b>' + c.newClients + '</b><small>nouveau(x)</small></div><div><b>' + db().clients.length + '</b><small>au total</small></div></div>' + bars(c.clients.slice(0, 5).map(x => [x.name, x.v, topMax]), M.main) + '</section>' +
        (App.mod('stock') ? '<section class="card"><h3>Stock</h3><div class="stats"><div><b>' + M.main(stockVal) + '</b><small>valeur</small></div><div class="' + (low ? 'bad' : '') + '"><b>' + low + '</b><small>stock bas</small></div><div><b>' + db().products.length + '</b><small>' + esc(App.vocab('product', true)) + '</small></div></div></section>' : '') +
        '<section class="card"><h3>Comptabilité simple</h3><dl class="kv"><dt>Encaissé</dt><dd>' + M.main(c.collected) + '</dd><dt>Dépenses</dt><dd>− ' + M.main(c.exp) + '</dd><dt><b>Trésorerie nette</b></dt><dd><b>' + M.main(c.collected - c.exp) + '</b></dd><dt>Créances clients</dt><dd>' + M.main(recv) + '</dd>' + (App.mod('stock') ? '<dt>Valeur du stock</dt><dd>' + M.main(stockVal) + '</dd>' : '') + (cashE ? '<dt>Caisse estimée</dt><dd>' + esc(Object.entries(cashE).map(([k, v]) => M.fmt(v, k)).join(' · ')) + '</dd>' : '') + '</dl></section>' +
        '<section class="card"><h3>Objectif du mois</h3><div class="row2">' + ui.field('Objectif de chiffre d\'affaires (' + db().settings.currency + ')', ui.input('goal', db().settings.goal || '', { num: 1 })) + '<button class="btn ghost" id="sg" style="align-self:end">Enregistrer</button></div></section>' +
        '<button class="btn primary" id="mr">📤 Rapport du mois (partager)</button>';
      tab.querySelector('#sg').onclick = () => { const v = parseFloat(String(tab.querySelector('[name=goal]').value).replace(',', '.')) || 0; db().settings.goal = v; App.save(); App.toast('Objectif enregistré'); App.render(); };
      tab.querySelector('#mr').onclick = () => R.monthSheet();
    }
  };

  // ---------- monthly report: summary to share, copy or print ----------
  const monthName = key => { const [y, m] = key.split('-'); return ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'][+m - 1] + ' ' + y; };
  R.monthText = key => {
    const r = F.range(key), pr = F.range(prevKey(key)), c = R.compute(r), p = R.compute(pr), g = R.goalPct(c.revenue), s = db().settings, d = (a, b) => { const x = pct(a, b); return x == null ? '' : ' (' + (x >= 0 ? '+' : '') + x + ' % vs mois précédent)'; };
    return 'Rapport de ' + monthName(key) + ' — ' + s.name + '\n• Chiffre d\'affaires : ' + M.main(c.revenue) + d(c.revenue, p.revenue) + ' · ' + c.n + ' facture(s)\n• Encaissé : ' + M.main(c.collected) + '\n• Dépenses : ' + M.main(c.exp) + d(c.exp, p.exp) + '\n• Bénéfice : ' + M.main(c.profit) + d(c.profit, p.profit) + (g != null ? '\n• Objectif ' + M.main(s.goal) + ' : ' + g + ' %' : '') + '\n• Impayés à ce jour : ' + M.main(A.unpaidTotal()) + (c.clients.length ? '\n• Meilleurs ' + App.vocab('client', true) + ' : ' + c.clients.slice(0, 3).map(x => x.name + ' (' + M.main(x.v) + ')').join(', ') : '');
  };
  const prevKey = key => { const [y, m] = key.split('-').map(Number), d = new Date(y, m - 2, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  R.monthSheet = key => {
    key = key || App.today().slice(0, 7);
    const sh = ui.sheet({ title: 'Rapport du mois', wide: true, html: ui.field('Mois', '<input type="month" name="m" value="' + key + '">') + '<div class="card" id="mt" style="white-space:pre-wrap"></div>',
      actions: [{ label: 'Copier', cls: 'ghost', fn: () => { const t = sh.q('#mt').textContent; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => App.toast('Copié'), () => App.toast('Copie impossible', 'err')); return false; } }, { label: '🖨️ Imprimer', cls: 'ghost', fn: () => { const t = sh.q('#mt').textContent; A.printHtml(A.page('Rapport du mois', monthName(sh.q('[name=m]').value), '<div class="box" style="white-space:pre-wrap">' + esc(t) + '</div>')); return false; } }, { label: '💬 WhatsApp', cls: 'primary', fn: () => { window.open('https://wa.me/?text=' + encodeURIComponent(sh.q('#mt').textContent), '_blank', 'noopener'); return false; } }] });
    const draw = () => { const k = sh.q('[name=m]').value; if (/^\d{4}-\d{2}$/.test(k)) sh.q('#mt').textContent = R.monthText(k); }; sh.q('[name=m]').oninput = draw; draw();
  };
})();
