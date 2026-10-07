// Monthly report: a one-page summary of the month (sales, subscriptions, margin, unpaid, penalties, stock, deliveries) to share or print.
(() => {
  'use strict';
  const App = window.App, esc = App.esc;
  const rm = { m: App.today().slice(0, 7) };
  const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const label = m => `${MONTHS[+m.slice(5) - 1]} ${m.slice(0, 4)}`;
  const shift = (m, n) => { const d = new Date(+m.slice(0, 4), +m.slice(5) - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  const rangeOf = m => [m + '-01', m + '-' + String(new Date(+m.slice(0, 4), +m.slice(5), 0).getDate()).padStart(2, '0')];
  const pct = (a, b) => b > 0 ? Math.round(a / b * 100) : 0;

  // every figure of the report, computed once and used for both the screen and the shared text
  const data = m => {
    const db = App.db, r = rangeOf(m), t = App.today(), f = App.finance(r), U = (n, c, r) => App.usd(n, c, r);
    const subLines = []; f.inv.forEach(i => i.lines.forEach(l => { if (!l.pid && /^abonnement/i.test(l.desc)) subLines.push({ amt: U(l.qty * l.price, i.currency, i), margin: U(l.qty * (l.price - (l.cost || 0)), i.currency, i) }); }));
    const matSales = f.inv.reduce((a, i) => a + i.lines.filter(l => l.pid).reduce((b, l) => b + U(l.qty * l.price, i.currency, i), 0), 0);
    const inst = db.installs.filter(x => App.inRange(x.date, r)), pen = db.penalties.filter(p => p.paid && App.inRange(p.paid, r));
    const gere = db.clients.filter(c => c.type === 'gere').map(c => App.sub(c)).filter(Boolean), n = k => gere.filter(s => s.status === k).length;
    const open = db.invoices.filter(i => App.invDue(i) > 0.004), openMonth = open.filter(i => App.inRange(i.date, r));
    const exp = {}; db.expenses.filter(e => App.inRange(e.date, r)).forEach(e => { exp[e.cat] = (exp[e.cat] || 0) + U(e.amount, e.currency, e); });
    const dl = db.deliveries.filter(d => d.status === 'done' && d.doneAt && App.inRange(d.doneAt, r));
    return {
      m, ca: f.ca, cost: f.cost, margin: f.margin, exp: f.exp, net: f.net, nInv: f.inv.length,
      sub: { n: subLines.length, amt: subLines.reduce((a, x) => a + x.amt, 0), margin: subLines.reduce((a, x) => a + x.margin, 0) },
      matSales, inst: { n: inst.length, amt: inst.reduce((a, x) => a + (x.price || 0), 0) },
      pen: { paid: pen.reduce((a, p) => a + U(p.amount, p.currency, p), 0), n: pen.length, due: App.penaltyDueTotal() },
      status: { actif: n('actif'), sursis: n('sursis'), inactif: n('inactif') },
      toRenew: m === t.slice(0, 7) ? gere.filter(s => s.status === 'actif' && s.end >= t && s.end <= r[1]).length : null,
      unpaid: { total: App.unpaidTotal(), n: open.length, month: openMonth.reduce((a, i) => a + U(App.invDue(i), i.currency, i), 0), nMonth: openMonth.length },
      lowStock: db.products.filter(p => App.tracked(p) && p.qty <= (p.min || 0)).map(p => `${p.name} (${App.nf(p.qty, 2)}${p.unit === 'm' ? ' m' : ''})`),
      exps: Object.entries(exp).sort((a, b) => b[1] - a[1]), deliveries: { done: dl.length, pending: db.deliveries.filter(d => d.status !== 'done').length },
      newClients: db.clients.filter(c => c.created && App.inRange(c.created, r)).length
    };
  };
  const text = d => {
    const co = App.db.settings.company.name, F = x => App.fmt(x), L = [`📑 ${co} — Rapport de ${label(d.m)}`, ''];
    L.push(`💰 Chiffre d'affaires : ${F(d.ca)} (${d.nInv} facture(s))`, `📈 Marge brute : ${F(d.margin)}`, `💸 Dépenses : ${F(d.exp)}`, `✅ Bénéfice net : ${F(d.net)}`, '');
    L.push(`📡 Abonnements : ${d.sub.n} renouvelé(s), ${F(d.sub.amt)} facturés, marge ${F(d.sub.margin)}`, `   Actifs ${d.status.actif} · En sursis ${d.status.sursis} · Inactifs ${d.status.inactif}${d.toRenew != null ? ` · À renouveler d'ici fin de mois : ${d.toRenew}` : ''}`);
    L.push(`🔧 Installations : ${d.inst.n} (${F(d.inst.amt)})`, `📦 Ventes de matériel : ${F(d.matSales)}`, `👥 Nouveaux clients : ${d.newClients}`, '');
    L.push(`🧾 Impayés à ce jour : ${F(d.unpaid.total)} (${d.unpaid.n} facture(s)), dont ${F(d.unpaid.month)} facturés ce mois`, `⚠️ Pénalités : ${F(d.pen.paid)} payées ce mois · ${F(d.pen.due)} à payer`);
    if (d.deliveries.done || d.deliveries.pending) L.push(`🚚 Livraisons : ${d.deliveries.done} faite(s) ce mois · ${d.deliveries.pending} à faire`);
    if (d.lowStock.length) L.push(`📉 Stock bas : ${d.lowStock.join(', ')}`);
    return L.join('\n');
  };

  App.views.rapportmois = () => {
    const d = data(rm.m), F = x => App.fmt(x), row = (t, v, cls = '') => `<div class="item"><div class="grow">${t}</div><b class="${cls}">${v}</b></div>`;
    const cur = rm.m === App.today().slice(0, 7);
    return {
      title: 'Rapport du mois', back: 'more', nav: 'more',
      html: `<div class="card noprint"><div class="spread"><button class="btn sm sec" data-act="rm_nav" data-n="-1">‹</button><b style="font-size:17px;text-transform:capitalize">${label(rm.m)}</b><button class="btn sm sec" data-act="rm_nav" data-n="1" ${cur ? 'disabled' : ''}>›</button></div></div>
        <h1 style="display:none">${esc(App.db.settings.company.name)} — ${label(rm.m)}</h1>
        <div class="grid two"><div class="stat"><small>💰 Chiffre d'affaires</small><b>${F(d.ca)}</b><small>${d.nInv} facture(s)</small></div><div class="stat"><small>✅ Bénéfice net</small><b class="${d.net >= 0 ? 'ok' : 'bad'}">${F(d.net)}</b><small>marge ${pct(d.net, d.ca)} %</small></div></div>
        <h2 class="sec">Finances</h2><div class="list">${row('Chiffre d\'affaires', F(d.ca))}${row('Coût (Starlink, marchandises)', F(d.cost))}${row('Marge brute', F(d.margin), d.margin >= 0 ? 'ok' : 'bad')}${row('Dépenses', F(d.exp))}${row('Bénéfice net', F(d.net), d.net >= 0 ? 'ok' : 'bad')}</div>
        ${d.exps.length ? `<div class="list" style="margin-top:8px">${d.exps.map(([k, v]) => row('<span class="mut">' + esc(k) + '</span>', F(v))).join('')}</div>` : ''}
        <h2 class="sec">Abonnements</h2><div class="list">${row('Renouvellements facturés', d.sub.n)}${row('Montant des abonnements', F(d.sub.amt))}${row('Marge sur abonnements', F(d.sub.margin), 'ok')}${row('Actifs / sursis / inactifs', `${d.status.actif} / ${d.status.sursis} / ${d.status.inactif}`)}${d.toRenew != null ? row("À renouveler d'ici fin de mois", d.toRenew, d.toRenew ? 'warn' : '') : ''}</div>
        <h2 class="sec">Ventes et services</h2><div class="list">${row('Ventes de matériel', F(d.matSales))}${row('Installations', `${d.inst.n} · ${F(d.inst.amt)}`)}${row('Nouveaux clients', d.newClients)}${row('Livraisons faites', d.deliveries.done)}</div>
        <h2 class="sec">À encaisser</h2><div class="list">${row('Impayés à ce jour', `${F(d.unpaid.total)} · ${d.unpaid.n}`, d.unpaid.total ? 'warn' : 'ok')}${row('dont facturés ce mois', `${F(d.unpaid.month)} · ${d.unpaid.nMonth}`)}${row('Pénalités payées ce mois', `${F(d.pen.paid)} · ${d.pen.n}`)}${row('Pénalités à payer', F(d.pen.due), d.pen.due ? 'bad' : '')}</div>
        ${d.lowStock.length ? `<h2 class="sec">Stock bas</h2><div class="card">${d.lowStock.map(esc).join(' · ')}</div>` : ''}
        <div class="bar noprint" style="margin-top:16px"><button class="btn" data-act="rm_wa">💬 Partager sur WhatsApp</button><button class="btn sec" data-act="rm_copy">📋 Copier le texte</button><button class="btn sec" data-act="rm_print">🖨️ Imprimer / PDF</button></div>`
    };
  };
  App.actions.rm_nav = d => { const n = shift(rm.m, +d.n); if (n > App.today().slice(0, 7)) return; rm.m = n; App.refresh(); };
  App.actions.rm_wa = () => window.open('https://wa.me/?text=' + encodeURIComponent(text(data(rm.m))), '_blank', 'noopener');
  App.actions.rm_copy = () => { const t = text(data(rm.m)); const done = () => App.toast('Rapport copié'); try { navigator.clipboard.writeText(t).then(done, () => window.prompt('Copiez :', t)); } catch (e) { window.prompt('Copiez :', t); } };
  App.actions.rm_print = () => window.print();
  App.monthlyText = m => text(data(m || rm.m));
})();
