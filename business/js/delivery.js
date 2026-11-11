// Deliveries (module « Livraisons »): planning, driver, status, cash collected on delivery (recorded as a payment on the invoice).
(function () {
  const App = window.App, ui = App.ui, esc = App.esc, M = App.money, A = App.sales, C = App.clients, ST = App.staff, norm = C.norm, db = () => App.db;
  const D = App.delivery = {};
  D.STATUS = ['À planifier', 'Planifiée', 'En route', 'Livrée', 'Échec']; const tone = { 'À planifier': 'warn', 'Planifiée': '', 'En route': '', 'Livrée': 'ok', 'Échec': 'bad' };
  D.get = id => db().deliveries.find(d => d.id === id);
  const cname = d => { const c = C.get(d.clientId); return c ? c.name : 'Client de passage'; };
  D.form = (id, fromInvoice) => {
    const d = id ? D.get(id) : null, s = db().settings, src = d || {}, invs = [['', '— Sans facture —'], ...db().invoices.filter(i => A.live(i)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 80).map(i => [i.id, i.number + ' · ' + A.cname(i) + (A.due(i) > 0 ? ' · reste ' + A.fmt(i, A.due(i)) : '')])];
    const sh = ui.sheet({ title: d ? 'Modifier ' + d.number : 'Nouvelle livraison', wide: true, html: ui.field('Facture', ui.select('invoiceId', invs, src.invoiceId || fromInvoice || '')) + ui.field(App.cap(App.vocab('client')), ui.select('clientId', C.options('— Choisir —'), src.clientId || '')) + ui.field('Adresse de livraison', ui.input('address', src.address)) + '<div class="row2">' + ui.field('Livreur', ui.select('driverId', ST.opts('— Non attribué —'), src.driverId || '')) + ui.field('Statut', ui.select('status', D.STATUS, d ? d.status : 'À planifier')) + '</div>' + ui.field('Date prévue', ui.dateField('date', src.date)) + ui.field('À encaisser à la livraison (' + s.currency + ')', ui.input('collect', d ? d.collect : '', { num: 1 })) + ui.field('Note', ui.input('note', src.note)),
      actions: [...(d && App.can('delete') ? [{ label: 'Supprimer', cls: 'danger', fn: async x => { if (await ui.confirm('Supprimer ' + d.number + ' ?', 'Supprimer', true)) { db().deliveries = db().deliveries.filter(y => y.id !== d.id); App.save(); x.close(); App.render(); } return false; } }] : []), { label: 'Annuler', cls: 'ghost' }, { label: 'Enregistrer', cls: 'primary', fn: x => {
        const f = ui.read(x.body); if (!f.invoiceId && !f.clientId && !f.address) { App.toast('Indiquez une facture, un client ou une adresse', 'err'); return false; }
        const rec = { invoiceId: f.invoiceId, clientId: f.clientId, address: f.address, driverId: f.driverId, status: f.status, date: f.date, collect: f.collect || 0, currency: s.currency, note: f.note };
        if (d) Object.assign(d, rec); else db().deliveries.push({ id: App.uid(), number: A.nextNo('LIV', 'delivery', () => db().deliveries), collected: false, ...rec }); App.log(d ? 'delivery.edit' : 'delivery.add', f.address); App.save(); App.toast('Livraison enregistrée'); App.render();
      } }] });
    sh.body.addEventListener('input', e => { if (e.target.name !== 'invoiceId') return; const i = A.get(e.target.value); if (!i) return; const c = C.get(i.clientId); sh.q('[name=clientId]').value = i.clientId || ''; if (c && !sh.q('[name=address]').value) sh.q('[name=address]').value = c.address || ''; if (!sh.q('[name=collect]').value && A.due(i) > 0) sh.q('[name=collect]').value = A.due(i); });
  };
  // cash on delivery: becomes a normal payment (receipt, journal, cash drawer) on the linked invoice
  D.collect = d => {
    const i = A.get(d.invoiceId); if (!i || d.collected || !(d.collect > 0)) return false; const amount = Math.min(d.collect, A.due(i)); if (!(amount > 0)) return false;
    A.addPayment(i, { amount, currency: i.currency, mode: db().settings.modes[0], date: App.today(), note: 'Encaissé à la livraison ' + d.number }, true); d.collected = true; App.log('delivery.collect', d.number + ' ' + amount); App.save(); return amount;
  };
  D.setStatus = async (d, status) => {
    d.status = status; App.log('delivery.status', d.number + ' ' + status);
    if (status === 'Livrée' && d.collect > 0 && !d.collected && A.get(d.invoiceId) && App.can('pay') && await ui.confirm('Encaisser ' + M.fmt(Math.min(d.collect, A.due(A.get(d.invoiceId))), d.currency) + ' auprès du client ?', 'Encaisser')) D.collect(d);
    App.save(); App.render();
  };
  D.profile = id => {
    const d = D.get(id); if (!d) return; const dr = ST.get(d.driverId), i = A.get(d.invoiceId), c = C.get(d.clientId);
    const sh = ui.sheet({ title: d.number, wide: true, html: '<p><span class="pill ' + tone[d.status] + '">' + d.status + '</span> ' + esc(cname(d)) + '</p><dl class="kv"><dt>Adresse</dt><dd>' + esc(d.address || (c && c.address) || '—') + '</dd><dt>Date</dt><dd>' + App.fmtDate(d.date) + '</dd><dt>Livreur</dt><dd>' + esc(dr ? dr.name : '—') + '</dd><dt>Facture</dt><dd>' + (i ? esc(i.number) + ' · ' + A.status(i)[0] : '—') + '</dd><dt>À encaisser</dt><dd>' + (d.collect ? M.fmt(d.collect, d.currency) + (d.collected ? ' · encaissé ✔' : '') : '—') + '</dd></dl>' + (d.note ? '<p class="muted">' + esc(d.note) + '</p>' : '') + '<div class="chips">' + D.STATUS.map(s => '<button data-s="' + s + '" class="' + (d.status === s ? 'on' : '') + '">' + s + '</button>').join('') + '</div>',
      actions: [{ label: 'Modifier', cls: 'ghost', fn: () => { setTimeout(() => D.form(id), 200); } }, ...(c && c.phone ? [{ label: '📞 Appeler', cls: 'ghost', fn: () => { location.href = 'tel:' + C.digits(c.phone); return false; } }] : [])] });
    sh.body.addEventListener('click', async e => { const b = e.target.closest('[data-s]'); if (b) { sh.close(); await D.setStatus(d, b.dataset.s); setTimeout(() => D.profile(id), 250); } });
  };
  const st = { f: 'today', q: '' };
  App.views.delivery = { title: 'Livraisons', render(el, params) {
    const t = App.today(), F2 = { today: ['Aujourd\'hui', d => d.date === t && !['Livrée', 'Échec'].includes(d.status)], next: ['À venir', d => d.date > t && !['Livrée', 'Échec'].includes(d.status)], open: ['Non livrées', d => !['Livrée'].includes(d.status)], done: ['Livrées', d => d.status === 'Livrée'], all: ['Toutes', () => true] }, q = norm(st.q);
    const l = db().deliveries.filter(d => F2[st.f][1](d) && (!q || norm(d.number + ' ' + cname(d) + ' ' + d.address).includes(q))).sort((a, b) => a.date.localeCompare(b.date)), toCollect = db().deliveries.filter(d => !d.collected && d.collect > 0 && d.status !== 'Échec').reduce((a, d) => a + d.collect, 0);
    el.innerHTML = '<div class="page"><div class="stats card"><div><b>' + db().deliveries.filter(F2.today[1]).length + '</b><small>aujourd\'hui</small></div><div><b>' + db().deliveries.filter(d => d.status === 'En route').length + '</b><small>en route</small></div><div><b>' + M.main(toCollect) + '</b><small>à encaisser</small></div></div><div class="tools"><input type="search" id="dq" placeholder="Rechercher" value="' + esc(st.q) + '"><button class="btn primary" id="dn">+ Livraison</button></div><div class="chips">' + Object.entries(F2).map(([k, v]) => '<button data-f="' + k + '" class="' + (st.f === k ? 'on' : '') + '">' + v[0] + '</button>').join('') + '</div>' + (l.length ? '<div class="list">' + l.map(d => '<div class="swr" style="--n:0"><div class="item" data-id="' + d.id + '" role="button" tabindex="0"><span class="av">🚚</span><span class="tx"><b>' + esc(cname(d)) + '</b><small>' + esc(d.number) + ' · ' + App.fmtDate(d.date) + (d.address ? ' · ' + esc(d.address) : '') + ((ST.get(d.driverId) || {}).name ? ' · ' + esc(ST.get(d.driverId).name) : '') + '</small></span><span class="end">' + (d.collect ? '<b>' + M.fmt(d.collect, d.currency) + '</b>' : '') + '<span class="pill ' + tone[d.status] + '">' + d.status + '</span></span></div></div>').join('') + '</div>' : '<div class="empty"><div class="big">🚚</div><h2>Aucune livraison</h2></div>') + '</div>';
    const dq = el.querySelector('#dq'); dq.oninput = () => { st.q = dq.value; const p = dq.selectionStart; App.views.delivery.render(el); const n = el.querySelector('#dq'); n.focus(); n.setSelectionRange(p, p); };
    el.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { st.f = b.dataset.f; App.views.delivery.render(el); }); el.querySelector('#dn').onclick = () => D.form(); el.querySelectorAll('.item[data-id]').forEach(i => i.onclick = () => D.profile(i.dataset.id)); if (params && params.add) D.form();
  } };
  App.quick.push({ label: () => 'Nouvelle livraison', mod: 'delivery', run: () => { App.go('delivery'); setTimeout(() => D.form(), 30); } });
  const wrap = (o, fn, perm) => { const f = o[fn]; o[fn] = function () { if (!App.can(perm)) { App.toast('Action non autorisée pour votre profil', 'err'); return; } return f.apply(this, arguments); }; };
  App.ready.then(() => { wrap(D, 'form', 'sell'); });
})();
