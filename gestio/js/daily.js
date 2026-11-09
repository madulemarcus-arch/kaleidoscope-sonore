// End-of-day summary: what came in and went out today by mode and currency, the cash that should be in the drawer, and a saved closing with the counted cash.
(() => {
  'use strict';
  const App = window.App, $ = App.$, esc = App.esc;
  const ds = { d: App.today() };
  const CASH = 'Cash';
  const shift = (d, n) => App.addDays(d, n);

  const data = d => {
    const db = App.db, rows = App.ledger().filter(x => x.date === d);
    const ins = rows.filter(x => x.kind === 'in'), outs = rows.filter(x => x.kind === 'out');
    const usd = a => a.reduce((s, x) => s + x.usd, 0);
    const byMode = {}; rows.forEach(x => { const m = byMode[x.mode] = byMode[x.mode] || { in: {}, out: {} }; m[x.kind][x.cur] = (m[x.kind][x.cur] || 0) + x.amt; });
    const cash = { USD: 0, CDF: 0 }; rows.filter(x => x.mode === CASH).forEach(x => { cash[x.cur] = (cash[x.cur] || 0) + (x.kind === 'in' ? x.amt : -x.amt); });
    const inv = db.invoices.filter(i => App.live(i) && i.date === d), invAmt = inv.reduce((s, i) => s + App.usd(App.invAgreed(i), i.currency, i), 0);
    const unpaid = inv.filter(i => App.invDue(i) > 0.004), unpaidAmt = unpaid.reduce((s, i) => s + App.usd(App.invDue(i), i.currency, i), 0);
    const deliveries = db.deliveries.filter(x => x.status === 'done' && x.doneAt === d).length;
    const closing = (db.closings || []).find(c => c.date === d);
    return { d, rows, ins, outs, cin: usd(ins), cout: usd(outs), byMode, cash, inv, invAmt, unpaid, unpaidAmt, deliveries, closing };
  };
  const curs = o => Object.entries(o).filter(([, v]) => Math.abs(v) > 0.004).map(([c, v]) => App.fmt(v, c)).join(' + ') || '—';

  const text = x => {
    const co = App.db.settings.company.name, F = n => App.fmt(n), L = [`🧾 ${co} — Journée du ${App.fdate(x.d)}`, ''];
    L.push(`⬇ Entrées : ${F(x.cin)} (${x.ins.length})`);
    Object.entries(x.byMode).forEach(([m, o]) => { if (Object.keys(o.in).length) L.push(`   • ${m} : ${curs(o.in)}`); });
    L.push(`⬆ Sorties : ${F(x.cout)} (${x.outs.length})`);
    Object.entries(x.byMode).forEach(([m, o]) => { if (Object.keys(o.out).length) L.push(`   • ${m} : ${curs(o.out)}`); });
    L.push(`💰 Solde du jour : ${F(x.cin - x.cout)}`, '');
    L.push(`🧾 Factures émises : ${x.inv.length} (${F(x.invAmt)})`, `⏳ Restent à encaisser : ${x.unpaid.length} facture(s), ${F(x.unpaidAmt)}`);
    if (x.deliveries) L.push(`🚚 Livraisons faites : ${x.deliveries}`);
    L.push('', `💵 Cash attendu en caisse : ${curs(x.cash)}`);
    if (x.closing) { const c = x.closing; L.push(`✅ Clôturée · Cash compté : ${curs(c.counted)}${c.diff ? ' · Écart : ' + curs(c.diff) : ' · aucun écart'}`); if (c.note) L.push('Note : ' + c.note); }
    return L.join('\n');
  };

  App.views.daily = () => {
    const x = data(ds.d), F = n => App.fmt(n), isToday = ds.d >= App.today();
    const row = (t, v, cls = '') => `<div class="item"><div class="grow">${t}</div><b class="${cls}">${v}</b></div>`;
    const modes = Object.entries(x.byMode).sort((a, b) => a[0].localeCompare(b[0]));
    const cl = x.closing, hist = (App.db.closings || []).slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
    const cnt = (c, v) => `<div class="fld"><label>Cash compté (${c === 'CDF' ? 'francs' : 'dollars'})</label><input id="dc_${c}" type="number" inputmode="decimal" min="0" step="${c === 'CDF' ? 1 : 0.01}" value="${cl ? cl.counted[c] ?? '' : ''}" placeholder="${App.nf(v, c === 'CDF' ? 0 : 2)}"></div>`;
    return {
      title: 'Clôture du jour', sub: App.fdate(ds.d), back: 'more', nav: 'more',
      html: `<div class="bar noprint"><button class="btn sm sec" data-act="dc_nav" data-n="-1">‹ Veille</button><input type="date" id="dc_date" value="${ds.d}" max="${App.today()}" style="flex:1"><button class="btn sm sec" data-act="dc_nav" data-n="1" ${isToday ? 'disabled' : ''}>Lendemain ›</button></div>
        <div class="grid"><div class="stat"><small>⬇ Entrées</small><b class="ok">${F(x.cin)}</b><small>${x.ins.length} encaissement(s)</small></div><div class="stat"><small>⬆ Sorties</small><b class="bad">${F(x.cout)}</b><small>${x.outs.length} sortie(s)</small></div><div class="stat"><small>Solde du jour</small><b class="${x.cin - x.cout >= 0 ? 'ok' : 'bad'}">${F(x.cin - x.cout)}</b></div></div>
        <h2 class="sec">Par mode de paiement</h2>
        ${modes.length ? `<div class="list">${modes.map(([m, o]) => `<div class="item"><div class="grow"><b>${esc(m)}</b><small>${Object.keys(o.out).length ? 'Sorties : ' + curs(o.out) : 'Aucune sortie'}</small></div><b class="ok">${curs(o.in)}</b></div>`).join('')}</div>` : '<div class="empty">Aucun mouvement ce jour-là.</div>'}
        <h2 class="sec">Ventes du jour</h2>
        <div class="list">${row('Factures émises', `${x.inv.length} · ${F(x.invAmt)}`)}${row('Restent à encaisser', x.unpaid.length ? `${x.unpaid.length} · ${F(x.unpaidAmt)}` : 'Rien', x.unpaid.length ? 'bad' : 'ok')}${x.deliveries ? row('Livraisons faites', x.deliveries) : ''}</div>
        <h2 class="sec">💵 Caisse (cash)</h2>
        <div class="card"><div class="spread"><span>Cash attendu en caisse</span><b style="font-size:18px">${curs(x.cash)}</b></div><small class="mut">Cash encaissé − cash payé ce jour-là (hors M-Pesa, Airtel, banque…).</small>
          <div class="row noprint" style="margin-top:10px">${cnt('USD', x.cash.USD)}${cnt('CDF', x.cash.CDF)}</div>
          <div class="fld noprint"><label>Note (facultatif)</label><input id="dc_note" value="${esc(cl ? cl.note || '' : '')}" placeholder="Ex. 5 $ donnés au livreur"></div>
          ${cl ? `<div class="${cl.diff ? 'warn' : 'ok'}" style="font-weight:700;margin-top:6px">✅ Clôturée · compté ${curs(cl.counted)} · ${cl.diff ? 'écart ' + curs(cl.diff) : 'aucun écart'}</div>` : ''}
          <div class="bar noprint" style="margin-top:10px"><button class="btn" data-act="dc_close">${cl ? 'Mettre à jour la clôture' : '✔ Clôturer la journée'}</button>${cl ? '<button class="btn sec del" data-act="dc_open">Rouvrir</button>' : ''}</div></div>
        <div class="bar noprint" style="margin-top:14px"><button class="btn" data-act="dc_wa">💬 Envoyer sur WhatsApp</button><button class="btn sec" data-act="dc_copy">📋 Copier</button><button class="btn sec" data-act="dc_print">🖨️ Imprimer</button></div>
        ${x.rows.length ? `<h2 class="sec">Détail des mouvements</h2><div class="list">${x.rows.map(r => `<div class="item"><div class="grow"><b>${esc(r.label)}</b><small>${esc(r.who || '')} · ${esc(r.mode)}</small></div><b class="${r.kind === 'in' ? 'ok' : 'bad'}">${r.kind === 'in' ? '+' : '−'}${App.fmt(r.amt, r.cur)}</b></div>`).join('')}</div>` : ''}
        ${hist.length ? `<h2 class="sec noprint">Dernières clôtures</h2><div class="list noprint">${hist.map(c => `<button class="item" data-act="dc_go" data-d="${c.date}"><div class="grow"><b>${App.fdate(c.date)}</b><small>Compté ${curs(c.counted)}</small></div><b class="${c.diff ? 'warn' : 'ok'}">${c.diff ? 'Écart ' + curs(c.diff) : 'OK'}</b></button>`).join('')}</div>` : ''}`,
      after: () => { if ($('dc_date')) $('dc_date').onchange = () => { const v = $('dc_date').value; if (v && v <= App.today()) { ds.d = v; App.refresh(); } }; }
    };
  };

  App.actions.dc_nav = d => { const n = shift(ds.d, +d.n); if (n > App.today()) return; ds.d = n; App.refresh(); };
  App.actions.dc_go = d => { ds.d = d.d; App.refresh(); };
  App.actions.dc_close = () => {
    const x = data(ds.d), counted = {}, diff = {};
    ['USD', 'CDF'].forEach(c => { const el = $('dc_' + c); if (el && el.value !== '') counted[c] = +el.value; });
    if (!Object.keys(counted).length) return App.toast('Saisissez le cash compté (dollars et/ou francs)');
    Object.keys(counted).forEach(c => { const e = Math.round((counted[c] - (x.cash[c] || 0)) * 100) / 100; if (Math.abs(e) > 0.004) diff[c] = e; });
    const db = App.db; db.closings = (db.closings || []).filter(c => c.date !== ds.d);
    const who = App.me ? App.me() : null;
    db.closings.push({ id: App.uid(), date: ds.d, ts: Date.now(), expected: { USD: x.cash.USD || 0, CDF: x.cash.CDF || 0 }, counted, diff: Object.keys(diff).length ? diff : null, note: $('dc_note') ? $('dc_note').value.trim() : '', by: who ? who.name : '' });
    App.save(); App.refresh(); App.toast('Journée clôturée');
  };
  App.actions.dc_open = () => { if (!App.confirm('Rouvrir cette journée ? La clôture enregistrée sera supprimée.')) return; App.db.closings = (App.db.closings || []).filter(c => c.date !== ds.d); App.save(); App.refresh(); };
  App.actions.dc_wa = () => window.open('https://wa.me/?text=' + encodeURIComponent(text(data(ds.d))), '_blank', 'noopener');
  App.actions.dc_copy = () => { const t = text(data(ds.d)); const done = () => App.toast('Récapitulatif copié'); try { navigator.clipboard.writeText(t).then(done, () => window.prompt('Copiez :', t)); } catch (e) { window.prompt('Copiez :', t); } };
  App.actions.dc_print = () => window.print();
})();
