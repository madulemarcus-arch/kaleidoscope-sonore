// Quotes (DEV-AAAA-0001): same lines as an invoice, then « Transformer en facture ».
(function () {
  const App = window.App, ui = App.ui, esc = App.esc, M = App.money, A = App.sales, S = App.stock, norm = App.clients.norm, db = () => App.db;
  const Q = App.quotes = {};
  Q.get = id => db().quotes.find(q => q.id === id);
  const stat = q => q.status === 'invoiced' ? ['Facturé', 'ok'] : q.status === 'declined' ? ['Refusé', 'bad'] : q.validUntil && q.validUntil < App.today() ? ['Expiré', 'warn'] : ['En attente', ''];
  Q.form = id => {
    const q = id ? Q.get(id) : null, s = db().settings, cl = [['', '— Client de passage —'], ...db().clients.slice().sort((a, b) => norm(a.name).localeCompare(norm(b.name))).map(c => [c.id, c.name])], st = { lines: JSON.parse(JSON.stringify(q ? q.lines : [{ pid: '', desc: '', qty: 1, price: '' }])) };
    const sh = ui.sheet({ title: q ? 'Modifier ' + q.number : 'Nouveau devis', wide: true, html: '<div id="qf"></div>', actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Enregistrer', cls: 'primary', fn: sh => {
      const f = vals(), ok = f.lines.filter(l => l.qty > 0 && (l.desc || l.pid)); if (!ok.length) { App.toast('Ajoutez au moins une ligne', 'err'); return false; }
      const calc = A.calc(ok, { type: f.dtype, value: f.dval }, f.currency), rec = { clientId: f.clientId, clientName: f.clientId ? '' : 'Client de passage', date: f.date, validUntil: f.validUntil, currency: f.currency, rate: f.rate > 0 ? f.rate : s.rate, lines: ok, disc: { type: f.dtype, value: f.dval || 0 }, sub: calc.sub, discAmt: calc.disc, total: calc.total, note: f.note };
      if (q) Object.assign(q, rec); else db().quotes.push({ id: App.uid(), number: A.nextNo('DEV', 'quote', () => db().quotes), status: 'open', ...rec });
      App.log(q ? 'quote.edit' : 'quote.add', ''); App.save(); App.toast('Devis enregistré'); App.render();
    } }] });
    const box = sh.q('#qf'), po = () => [['', '— Ligne libre —'], ...db().products.map(p => [p.id, p.name])];
    const read = () => { box.querySelectorAll('.ln').forEach((d, k) => { const l = st.lines[k]; l.pid = d.querySelector('[name=pid]').value; l.desc = d.querySelector('[name=desc]').value; l.qty = parseFloat(String(d.querySelector('[name=qty]').value).replace(',', '.')) || 0; l.price = d.querySelector('[name=price]').value; }); };
    const vals = () => { const f = ui.read(box); read(); f.lines = st.lines.map(l => ({ ...l, price: parseFloat(String(l.price).replace(',', '.')) || 0 })); return f; };
    const draw = () => {
      const keep = box.firstChild ? ui.read(box) : {}; const gv = (k, d) => keep[k] !== undefined && keep[k] !== '' ? keep[k] : d;
      box.innerHTML = '<div class="row2">' + ui.field(App.cap(App.vocab('client')), ui.select('clientId', cl, gv('clientId', q ? q.clientId : ''))) + ui.field('Date', ui.dateField('date', gv('date', q && q.date))) + '</div><div class="row2">' + ui.field('Valable jusqu\'au', ui.input('validUntil', gv('validUntil', q ? q.validUntil : App.addDays(App.today(), 30)), { type: 'date' })) + ui.field('Devise', ui.select('currency', [s.currency, s.cur2], gv('currency', q ? q.currency : s.currency))) + '</div>' + ui.field('Taux (1 ' + s.currency + ' = ? ' + s.cur2 + ')', ui.input('rate', gv('rate', q ? q.rate : s.rate), { num: 1 })) +
        '<div id="ln">' + st.lines.map((l, k) => '<div class="card ln" data-k="' + k + '">' + ui.select('pid', po(), l.pid) + '<input name="desc" placeholder="Désignation" value="' + esc(l.desc) + '"><div class="row2">' + ui.stepper('qty', l.qty, 0) + '<input name="price" data-num inputmode="decimal" placeholder="Prix unitaire" value="' + esc(l.price) + '"></div>' + (st.lines.length > 1 ? '<button type="button" class="btn ghost sm" data-rm="' + k + '">Retirer</button>' : '') + '</div>').join('') + '</div><button type="button" class="btn ghost" id="addln">+ Ajouter une ligne</button>' +
        '<div class="row2">' + ui.field('Remise', ui.select('dtype', [['pct', 'en %'], ['amt', 'montant']], gv('dtype', q && q.disc ? q.disc.type : 'pct'))) + ui.field('Valeur', ui.input('dval', gv('dval', q && q.disc ? q.disc.value || '' : ''), { num: 1 })) + '</div><div class="card" id="tot"></div>' + ui.field('Note', '<textarea name="note" rows="2">' + esc(gv('note', q ? q.note : '')) + '</textarea>'); recalc();
    };
    const recalc = () => { const f = vals(), c = A.calc(f.lines, { type: f.dtype, value: f.dval }, f.currency); box.querySelector('#tot').innerHTML = '<b>Total : ' + M.fmt(c.total, f.currency) + '</b>' + (c.disc ? ' <small class="muted">(remise ' + M.fmt(c.disc, f.currency) + ')</small>' : ''); };
    box.addEventListener('input', e => { if (e.target.name === 'pid') { read(); const l = st.lines[+e.target.closest('.ln').dataset.k], p = S.get(l.pid), f = ui.read(box); if (p) { l.desc = p.name; l.price = f.currency === s.currency ? p.price : M.convert(p.price, s.currency, f.currency, f.rate); draw(); return; } } recalc(); });
    box.addEventListener('click', e => { const rm = e.target.closest('[data-rm]'); if (rm) { read(); st.lines.splice(+rm.dataset.rm, 1); draw(); } if (e.target.id === 'addln') { read(); st.lines.push({ pid: '', desc: '', qty: 1, price: '' }); draw(); } });
    draw();
  };
  Q.profile = id => {
    const q = Q.get(id); if (!q) return; const [l, c] = stat(q);
    ui.sheet({ title: q.number, wide: true, html: '<p><span class="pill ' + c + '">' + l + '</span> ' + esc(A.cname(q)) + ' · ' + App.fmtDate(q.date) + '</p><table class="tbl"><tr><th>Désignation</th><th>Qté</th><th>Total</th></tr>' + q.lines.map(x => '<tr><td>' + esc(x.desc) + '</td><td>' + S.nf(x.qty) + '</td><td>' + M.fmt(x.qty * x.price, q.currency) + '</td></tr>').join('') + '</table><p><b>Total : ' + M.fmt(q.total, q.currency) + '</b></p>',
      actions: [{ label: 'Supprimer', cls: 'danger', fn: async sh => { if (await ui.confirm('Supprimer ' + q.number + ' ?', 'Supprimer', true)) { db().quotes = db().quotes.filter(x => x.id !== id); App.save(); sh.close(); App.render(); } return false; } }, ...(q.status !== 'invoiced' ? [{ label: 'Modifier', cls: 'ghost', fn: () => { setTimeout(() => Q.form(id), 200); } }, { label: 'Refusé', cls: 'ghost', fn: () => { q.status = 'declined'; App.save(); App.render(); } }, { label: 'En facture', cls: 'primary', fn: () => { setTimeout(() => A.invoiceForm({ from: q, fromQuote: q, clientId: q.clientId }), 200); } }] : []), { label: '🖨️ Imprimer', cls: 'ghost', fn: () => { A.print('quote', id); return false; } }, { label: 'Word', cls: 'ghost', fn: () => { A.word('quote', id); return false; } }] });
  };
  A.drawQuotes = (tab, el) => {
    const l = db().quotes.slice().sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));
    tab.innerHTML = '<div class="tools"><button class="btn primary" id="nq">+ Devis</button></div>' + (l.length ? '<div class="list">' + l.map(q => { const [t, c] = stat(q); return '<div class="swr" style="--n:0"><div class="item" role="button" tabindex="0" data-id="' + q.id + '"><span class="av">📝</span><span class="tx"><b>' + esc(A.cname(q)) + '</b><small>' + esc(q.number) + ' · ' + App.fmtDate(q.date) + '</small></span><span class="end"><b>' + M.fmt(q.total, q.currency) + '</b><span class="pill ' + c + '">' + t + '</span></span></div></div>'; }).join('') + '</div>' : '<div class="empty"><div class="big">📝</div><h2>Aucun devis</h2></div>');
    tab.querySelector('#nq').onclick = () => Q.form(); tab.querySelectorAll('.item[data-id]').forEach(i => i.onclick = () => Q.profile(i.dataset.id));
  };
})();
