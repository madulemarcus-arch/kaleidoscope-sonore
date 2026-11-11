// Rental (module « Location »): rented item, dates, price, deposit (caution), return with deposit refund / retention and late fee, invoicing.
(function () {
  const App = window.App, ui = App.ui, esc = App.esc, M = App.money, A = App.sales, C = App.clients, norm = C.norm, db = () => App.db;
  const R = App.rental = {};
  R.get = id => db().rentals.find(r => r.id === id);
  R.status = r => r.returned ? ['Retournée', 'ok'] : r.end < App.today() ? ['En retard', 'bad'] : ['En cours', 'warn'];
  R.lateDays = r => r.returned ? Math.max(0, App.diff(r.end, r.returned)) : Math.max(0, App.diff(r.end, App.today()));
  const cname = r => { const c = C.get(r.clientId); return c ? c.name : 'Client de passage'; };
  R.deposits = () => db().rentals.filter(r => !r.returned || (r.deposit > 0 && r.depositBack == null)).reduce((a, r) => a + (r.depositBack == null ? r.deposit || 0 : 0), 0);
  R.form = id => {
    const r = id ? R.get(id) : null, s = db().settings;
    ui.sheet({ title: r ? 'Modifier ' + r.number : 'Nouvelle location', wide: true, html: ui.field(App.cap(App.vocab('client')), ui.select('clientId', C.options('— Choisir —'), r ? r.clientId : '')) + ui.field('Bien loué *', ui.input('item', r && r.item, { ph: 'Ex. Perceuse, salle, véhicule…' })) + '<div class="row2">' + ui.field('Début', ui.dateField('start', r && r.start)) + ui.field('Retour prévu', ui.input('end', r ? r.end : App.addDays(App.today(), 7), { type: 'date' })) + '</div><div class="row2">' + ui.field('Prix de la location (' + s.currency + ')', ui.input('price', r ? r.price : '', { num: 1 })) + ui.field('Caution (' + s.currency + ')', ui.input('deposit', r ? r.deposit : '', { num: 1 })) + '</div>' + ui.field('Note', ui.input('note', r && r.note)),
      actions: [...(r && App.can('delete') ? [{ label: 'Supprimer', cls: 'danger', fn: async x => { if (await ui.confirm('Supprimer ' + r.number + ' ?', 'Supprimer', true)) { db().rentals = db().rentals.filter(y => y.id !== r.id); App.save(); x.close(); App.render(); } return false; } }] : []), { label: 'Annuler', cls: 'ghost' }, { label: 'Enregistrer', cls: 'primary', fn: x => {
        const f = ui.read(x.body); if (!f.item) { App.toast('Indiquez le bien loué', 'err'); return false; } if (f.end < f.start) { App.toast('Le retour doit être après le début', 'err'); return false; }
        const rec = { clientId: f.clientId, item: f.item, start: f.start, end: f.end, price: f.price, deposit: f.deposit || 0, currency: s.currency, note: f.note };
        if (r) Object.assign(r, rec); else db().rentals.push({ id: App.uid(), number: A.nextNo('LOC', 'rental', () => db().rentals), returned: '', depositBack: null, invoiceId: '', ...rec }); App.log(r ? 'rental.edit' : 'rental.add', f.item); App.save(); App.toast('Location enregistrée'); App.render();
      } }] });
  };
  R.returnForm = id => {
    const r = R.get(id), late = R.lateDays(r); if (!r) return;
    ui.sheet({ title: 'Retour — ' + r.item, html: '<p>' + (late ? '<b style="color:var(--bad)">' + late + ' jour(s) de retard</b>' : 'Retour dans les délais') + ' · caution reçue : <b>' + M.main(r.deposit || 0) + '</b></p>' + ui.field('Date du retour', ui.dateField('date')) + ui.field('Frais de retard / dégâts (facturés)', ui.input('fee', '', { num: 1 })) + ui.field('Caution rendue', ui.input('back', r.deposit || '', { num: 1 }), 'Moins que la caution reçue = retenue.') + ui.field('Motif de la retenue', ui.input('why', '')),
      actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Enregistrer le retour', cls: 'primary', fn: x => {
        const f = ui.read(x.body); if (f.back > (r.deposit || 0)) { App.toast('Plus que la caution reçue', 'err'); return false; }
        r.returned = f.date; r.depositBack = f.back || 0; r.retention = M.round((r.deposit || 0) - (f.back || 0), r.currency); r.retentionWhy = f.why; r.lateFee = f.fee || 0;
        if (f.fee > 0) { const inv = A.createInvoice({ clientId: r.clientId, currency: r.currency, lines: [{ desc: 'Frais de retard / dégâts — ' + r.item + ' (' + r.number + ')', qty: 1, price: f.fee }], source: 'rental' }); r.feeInvoiceId = inv.id; }
        App.log('rental.return', r.number); App.save(); App.toast('Retour enregistré'); App.render();
      } }] });
  };
  R.invoice = r => { const link = {}; Object.defineProperty(link, 'invoiceId', { set: v => { r.invoiceId = v; App.save(); } }); Object.defineProperty(link, 'status', { set: () => { } }); A.invoiceForm({ clientId: r.clientId, fromQuote: link, from: { lines: [{ pid: '', desc: 'Location ' + r.item + ' du ' + App.fmtDate(r.start) + ' au ' + App.fmtDate(r.end), qty: 1, price: r.price }], note: r.number } }); };
  R.profile = id => {
    const r = R.get(id); if (!r) return; const [l, c] = R.status(r), inv = r.invoiceId && A.get(r.invoiceId);
    ui.sheet({ title: r.number + ' — ' + r.item, wide: true, html: '<p><span class="pill ' + c + '">' + l + '</span> ' + esc(cname(r)) + '</p><dl class="kv"><dt>Période</dt><dd>' + App.fmtDate(r.start) + ' → ' + App.fmtDate(r.end) + '</dd><dt>Prix</dt><dd>' + M.fmt(r.price, r.currency) + '</dd><dt>Caution</dt><dd>' + M.fmt(r.deposit || 0, r.currency) + (r.depositBack != null ? ' · rendue ' + M.fmt(r.depositBack, r.currency) + (r.retention ? ' · retenue ' + M.fmt(r.retention, r.currency) + (r.retentionWhy ? ' (' + esc(r.retentionWhy) + ')' : '') : '') : ' · à rendre') + '</dd><dt>Facture</dt><dd>' + (inv ? esc(inv.number) + ' · ' + A.status(inv)[0] : '—') + '</dd>' + (r.returned ? '<dt>Retour</dt><dd>' + App.fmtDate(r.returned) + '</dd>' : '') + '</dl>' + (r.note ? '<p class="muted">' + esc(r.note) + '</p>' : ''),
      actions: [{ label: 'Modifier', cls: 'ghost', fn: () => { setTimeout(() => R.form(id), 200); } }, ...(!inv && r.price > 0 && App.can('sell') ? [{ label: 'Facturer', cls: 'ghost', fn: () => { setTimeout(() => R.invoice(r), 200); } }] : []), ...(!r.returned ? [{ label: 'Retour', cls: 'primary', fn: () => { setTimeout(() => R.returnForm(id), 200); } }] : [])] });
  };
  const st = { f: 'all', q: '' };
  App.views.rental = { title: 'Location', render(el, params) {
    const q = norm(st.q), F2 = { all: ['Toutes', () => true], on: ['En cours', r => !r.returned && r.end >= App.today()], late: ['En retard', r => !r.returned && r.end < App.today()], back: ['Retournées', r => !!r.returned] }, l = db().rentals.filter(r => F2[st.f][1](r) && (!q || norm(r.number + ' ' + r.item + ' ' + cname(r)).includes(q))).sort((a, b) => b.start.localeCompare(a.start));
    el.innerHTML = '<div class="page"><div class="stats card"><div><b>' + db().rentals.filter(F2.on[1]).length + '</b><small>en cours</small></div><div class="' + (db().rentals.some(F2.late[1]) ? 'bad' : '') + '"><b>' + db().rentals.filter(F2.late[1]).length + '</b><small>en retard</small></div><div><b>' + M.main(R.deposits()) + '</b><small>cautions à rendre</small></div></div><div class="tools"><input type="search" id="rq" placeholder="Rechercher" value="' + esc(st.q) + '"><button class="btn primary" id="rn">+ Location</button></div><div class="chips">' + Object.entries(F2).map(([k, v]) => '<button data-f="' + k + '" class="' + (st.f === k ? 'on' : '') + '">' + v[0] + '</button>').join('') + '</div>' + (l.length ? '<div class="list">' + l.map(r => { const [t, c] = R.status(r); return '<div class="swr" style="--n:0"><div class="item" data-id="' + r.id + '" role="button" tabindex="0"><span class="av">🔑</span><span class="tx"><b>' + esc(r.item) + '</b><small>' + esc(r.number) + ' · ' + esc(cname(r)) + ' · retour ' + App.fmtDate(r.end) + '</small></span><span class="end"><b>' + M.fmt(r.price, r.currency) + '</b><span class="pill ' + c + '">' + t + '</span></span></div></div>'; }).join('') + '</div>' : '<div class="empty"><div class="big">🔑</div><h2>Aucune location</h2></div>') + '</div>';
    const rq = el.querySelector('#rq'); rq.oninput = () => { st.q = rq.value; const p = rq.selectionStart; App.views.rental.render(el); const n = el.querySelector('#rq'); n.focus(); n.setSelectionRange(p, p); };
    el.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { st.f = b.dataset.f; App.views.rental.render(el); }); el.querySelector('#rn').onclick = () => R.form(); el.querySelectorAll('.item[data-id]').forEach(i => i.onclick = () => R.profile(i.dataset.id)); if (params && params.add) R.form();
  } };
  App.quick.push({ label: () => 'Nouvelle location', mod: 'rental', run: () => { App.go('rental'); setTimeout(() => R.form(), 30); } });
  const wrap = (o, fn, perm) => { const f = o[fn]; o[fn] = function () { if (!App.can(perm)) { App.toast('Action non autorisée pour votre profil', 'err'); return; } return f.apply(this, arguments); }; };
  App.ready.then(() => { wrap(R, 'form', 'sell'); wrap(R, 'returnForm', 'sell'); });
})();
