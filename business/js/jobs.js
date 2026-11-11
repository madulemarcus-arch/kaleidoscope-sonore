// Services (prestations + field staff) and Interventions (jobs): employee, address, status, price, commission paid as an expense, invoicing.
(function () {
  const App = window.App, ui = App.ui, esc = App.esc, M = App.money, A = App.sales, S = App.stock, C = App.clients, F = App.fin, norm = C.norm, db = () => App.db;
  const ST = App.staff = {}, J = App.jobs = {};
  // ---------- field staff (technicien / employé / livreur…) ----------
  ST.ROLES = ['Technicien', 'Employé', 'Livreur', 'Autre'];
  ST.get = id => db().staff.find(s => s.id === id);
  ST.opts = (blank, role) => [['', blank || '— Non attribué —'], ...db().staff.filter(s => !role || s.role === role).map(s => [s.id, s.name])];
  ST.form = (id, done) => {
    const s = id ? ST.get(id) : null;
    ui.sheet({ title: s ? 'Modifier — ' + s.name : 'Nouvel employé', html: ui.field('Nom *', ui.input('name', s && s.name)) + '<div class="row2">' + ui.field('Fonction', ui.select('role', ST.ROLES, s ? s.role : ST.ROLES[0])) + ui.field('Téléphone', ui.input('phone', s && s.phone, { tel: 1 })) + '</div>' + ui.field('Note', ui.input('note', s && s.note)),
      actions: [...(s && App.can('delete') ? [{ label: 'Supprimer', cls: 'danger', fn: async sh => { if (db().jobs.some(j => j.employeeId === s.id) || db().deliveries.some(d => d.driverId === s.id)) { App.toast('Cet employé a un historique : suppression impossible', 'err'); return false; } if (await ui.confirm('Supprimer ' + s.name + ' ?', 'Supprimer', true)) { db().staff = db().staff.filter(x => x.id !== s.id); App.save(); sh.close(); done ? done() : App.render(); } return false; } }] : []), { label: 'Annuler', cls: 'ghost' }, { label: 'Enregistrer', cls: 'primary', fn: sh => { const f = ui.read(sh.body); if (!f.name) { App.toast('Le nom est obligatoire', 'err'); return false; } if (s) Object.assign(s, f); else db().staff.push({ id: App.uid(), ...f }); App.log(s ? 'staff.edit' : 'staff.add', f.name); App.save(); App.toast('Enregistré'); done ? done() : App.render(); } }] });
  };
  ST.manage = () => { const sh = ui.sheet({ title: 'Équipe', html: '<div id="stm"></div>', actions: [{ label: '+ Employé', cls: 'primary', fn: () => { setTimeout(() => ST.form(null, () => ST.manage()), 200); } }, { label: 'Fermer', cls: 'ghost' }] }); sh.q('#stm').innerHTML = ST.list(); sh.q('#stm').querySelectorAll('[data-st]').forEach(i => i.onclick = () => { sh.close(); setTimeout(() => ST.form(i.dataset.st, () => ST.manage()), 200); }); };
  ST.list = () => db().staff.length ? '<div class="list">' + db().staff.map(s => '<div class="swr" style="--n:0"><div class="item" data-st="' + s.id + '" role="button" tabindex="0"><span class="av">' + esc(App.letterOf(s.name)) + '</span><span class="tx"><b>' + esc(s.name) + '</b><small>' + esc([s.role, s.phone].filter(Boolean).join(' · ')) + '</small></span></div></div>').join('') + '</div>' : '<p class="muted">Aucun employé. Ajoutez vos techniciens, employés ou livreurs.</p>';

  // ---------- services (catalogue of prestations = products without stock) ----------
  J.services = () => db().products.filter(p => p.track === false);
  J.serviceForm = id => {
    const p = id ? S.get(id) : null, s = db().settings;
    ui.sheet({ title: p ? 'Modifier la prestation' : 'Nouvelle prestation', html: ui.field('Nom *', ui.input('name', p && p.name)) + '<div class="row2">' + ui.field('Prix (' + s.currency + ')', ui.input('price', p ? p.price : '', { num: 1 })) + ui.field('Catégorie', ui.input('cat', p ? p.cat : 'Services')) + '</div>',
      actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Enregistrer', cls: 'primary', fn: sh => { const f = ui.read(sh.body); if (!f.name) { App.toast('Le nom est obligatoire', 'err'); return false; } if (!s.categories.includes(f.cat)) s.categories.push(f.cat); if (p) Object.assign(p, { name: f.name, price: f.price, cat: f.cat }); else db().products.push({ id: App.uid(), code: S.nextCode(), created: App.today(), name: f.name, cat: f.cat || 'Services', ref: '', unit: 'prestation', track: false, qty: 0, min: 0, cost: 0, price: f.price, fields: {}, supplierId: '' }); App.save(); App.toast('Prestation enregistrée'); App.render(); } }] });
  };
  const sv = { tab: 'svc' };
  App.views.services = { title: 'Services', render(el) {
    el.innerHTML = '<div class="page"><div class="seg" id="vt"><button data-t="svc" class="' + (sv.tab === 'svc' ? 'on' : '') + '">Prestations</button><button data-t="staff" class="' + (sv.tab === 'staff' ? 'on' : '') + '">Équipe</button></div>' + (sv.tab === 'svc' ? '<div class="tools"><button class="btn primary" id="sn">+ Prestation</button></div>' + (J.services().length ? '<div class="list">' + J.services().map(p => '<div class="swr" style="--n:0"><div class="item" data-sv="' + p.id + '" role="button" tabindex="0"><span class="av">🛠️</span><span class="tx"><b>' + esc(p.name) + '</b><small>' + esc(p.cat) + '</small></span><span class="end"><b>' + M.main(p.price) + '</b></span></div></div>').join('') + '</div>' : '<div class="empty"><div class="big">🛠️</div><h2>Aucune prestation</h2><p class="muted">Ajoutez ce que vous vendez sans stock : dépannage, consultation, cours…</p></div>') : '<div class="tools"><button class="btn primary" id="sn">+ Employé</button></div>' + ST.list()) + '</div>';
    el.querySelectorAll('#vt button').forEach(b => b.onclick = () => { sv.tab = b.dataset.t; App.views.services.render(el); }); el.querySelector('#sn').onclick = () => sv.tab === 'svc' ? J.serviceForm() : ST.form();
    el.querySelectorAll('[data-sv]').forEach(i => i.onclick = () => J.serviceForm(i.dataset.sv)); el.querySelectorAll('[data-st]').forEach(i => i.onclick = () => ST.form(i.dataset.st));
  } };

  // ---------- interventions ----------
  J.STATUS = ['Planifiée', 'En cours', 'Terminée', 'Annulée']; const tone = { 'Planifiée': 'warn', 'En cours': '', 'Terminée': 'ok', 'Annulée': 'bad' };
  J.get = id => db().jobs.find(j => j.id === id);
  J.commission = j => !j.commission || !(j.commission.value > 0) ? 0 : M.round(j.commission.type === 'pct' ? j.price * j.commission.value / 100 : j.commission.value, j.currency);
  const cname = j => { const c = C.get(j.clientId); return c ? c.name : 'Client de passage'; };
  J.form = id => {
    const j = id ? J.get(id) : null, s = db().settings, svc = [['', '— Autre / libre —'], ...J.services().map(p => [p.id, p.name])];
    const sh = ui.sheet({ title: j ? 'Modifier ' + j.number : 'Nouvelle intervention', wide: true,
      html: ui.field(App.cap(App.vocab('client')), ui.select('clientId', C.options('— Choisir —'), j ? j.clientId : '')) + ui.field('Prestation', ui.select('pid', svc, j ? j.pid : '')) + ui.field('Objet *', ui.input('title', j && j.title)) + ui.field('Adresse', ui.input('address', j && j.address)) +
        '<div class="row2">' + ui.field('Employé', ui.select('employeeId', ST.opts(), j ? j.employeeId : '')) + ui.field('Statut', ui.select('status', J.STATUS, j ? j.status : 'Planifiée')) + '</div>' + ui.field('Date', ui.dateField('date', j && j.date)) +
        '<div class="row2">' + ui.field('Prix (' + s.currency + ')', ui.input('price', j ? j.price : '', { num: 1 })) + ui.field('Commission', '<div class="row2">' + ui.select('ctype', [['pct', 'en %'], ['amt', 'montant fixe']], j && j.commission ? j.commission.type : 'pct') + ui.input('cval', j && j.commission ? j.commission.value : '', { num: 1 }) + '</div>') + '</div><p class="muted" id="cm"></p>' + ui.field('Note', ui.input('note', j && j.note)),
      actions: [...(j && App.can('delete') ? [{ label: 'Supprimer', cls: 'danger', fn: async x => { if (await ui.confirm('Supprimer ' + j.number + ' ?', 'Supprimer', true)) { db().jobs = db().jobs.filter(y => y.id !== j.id); App.save(); x.close(); App.render(); } return false; } }] : []), { label: 'Annuler', cls: 'ghost' }, { label: 'Enregistrer', cls: 'primary', fn: x => {
        const f = ui.read(x.body); if (!f.title && !f.pid) { App.toast('Indiquez l\'objet de l\'intervention', 'err'); return false; }
        const p = f.pid && S.get(f.pid), rec = { clientId: f.clientId, pid: f.pid, title: f.title || (p ? p.name : ''), address: f.address, employeeId: f.employeeId, status: f.status, date: f.date, price: f.price, currency: s.currency, commission: { type: f.ctype, value: f.cval || 0 }, note: f.note };
        if (j) Object.assign(j, rec); else db().jobs.push({ id: App.uid(), number: A.nextNo('INT', 'job', () => db().jobs), commissionPaid: false, invoiceId: '', ...rec });
        App.log(j ? 'job.edit' : 'job.add', rec.title); App.save(); App.toast('Intervention enregistrée'); App.render();
      } }] });
    const sync = () => { const f = ui.read(sh.body), v = f.ctype === 'pct' ? f.price * f.cval / 100 : f.cval; sh.q('#cm').textContent = v > 0 ? 'Commission : ' + M.main(v) : ''; };
    sh.body.addEventListener('input', e => { if (e.target.name === 'pid') { const p = S.get(e.target.value), t = sh.q('[name=title]'), pr = sh.q('[name=price]'); if (p) { if (!t.value) t.value = p.name; if (!pr.value) pr.value = p.price; } const c = C.get(sh.q('[name=clientId]').value), a = sh.q('[name=address]'); if (c && !a.value) a.value = c.address || ''; } if (e.target.name === 'clientId') { const c = C.get(e.target.value), a = sh.q('[name=address]'); if (c && !a.value) a.value = c.address || ''; } sync(); }); sync();
  };
  J.payCommission = j => {
    const v = J.commission(j), e = ST.get(j.employeeId); if (!(v > 0)) return App.toast('Pas de commission sur cette intervention', 'err'); if (!e) return App.toast('Attribuez d\'abord un employé', 'err'); if (j.commissionPaid) return App.toast('Commission déjà payée');
    const exp = { id: App.uid(), at: Date.now(), amount: v, currency: j.currency, rate: db().settings.rate, category: 'Commissions', mode: F.cashMode(), supplierId: '', date: App.today(), note: 'Commission ' + j.number + ' · ' + e.name };
    if (!F.cats().includes('Commissions')) F.cats().push('Commissions'); db().expenses.push(exp); j.commissionPaid = true; j.expenseId = exp.id; App.log('job.commission', j.number + ' ' + v); App.save(); App.toast('Commission de ' + M.main(v) + ' payée à ' + e.name); App.render();
  };
  J.invoice = j => {
    const link = {}; Object.defineProperty(link, 'invoiceId', { set: v => { j.invoiceId = v; App.save(); } }); Object.defineProperty(link, 'status', { set: () => { } });
    A.invoiceForm({ clientId: j.clientId, fromQuote: link, from: { lines: [{ pid: '', desc: j.title + (j.address ? ' — ' + j.address : ''), qty: 1, price: j.price }], note: j.number } });
  };
  J.profile = id => {
    const j = J.get(id); if (!j) return; const e = ST.get(j.employeeId), inv = j.invoiceId && A.get(j.invoiceId), cm = J.commission(j);
    const sh = ui.sheet({ title: j.number + ' — ' + j.title, wide: true, html: '<p><span class="pill ' + tone[j.status] + '">' + j.status + '</span> ' + esc(cname(j)) + (j.address ? ' · ' + esc(j.address) : '') + '</p><dl class="kv"><dt>Date</dt><dd>' + App.fmtDate(j.date) + '</dd><dt>Employé</dt><dd>' + esc(e ? e.name : '—') + '</dd><dt>Prix</dt><dd>' + M.fmt(j.price, j.currency) + '</dd><dt>Commission</dt><dd>' + (cm ? M.fmt(cm, j.currency) + (j.commissionPaid ? ' · payée ✔' : ' · à payer') : '—') + '</dd><dt>Facture</dt><dd>' + (inv ? esc(inv.number) + ' · ' + A.status(inv)[0] : '—') + '</dd></dl>' + (j.note ? '<p class="muted">' + esc(j.note) + '</p>' : '') + '<div class="chips">' + J.STATUS.map(s => '<button data-s="' + s + '" class="' + (j.status === s ? 'on' : '') + '">' + s + '</button>').join('') + '</div>',
      actions: [{ label: 'Modifier', cls: 'ghost', fn: () => { setTimeout(() => J.form(id), 200); } }, ...(cm && !j.commissionPaid && App.can('expense') ? [{ label: 'Payer la commission', cls: 'ghost', fn: () => { J.payCommission(j); } }] : []), ...(!inv && App.can('sell') && j.price > 0 ? [{ label: 'Facturer', cls: 'primary', fn: () => { setTimeout(() => J.invoice(j), 200); } }] : [])] });
    sh.body.addEventListener('click', ev => { const b = ev.target.closest('[data-s]'); if (b) { j.status = b.dataset.s; App.log('job.status', j.number + ' ' + j.status); App.save(); App.render(); sh.close(); setTimeout(() => J.profile(id), 200); } });
  };
  const jt = { f: 'all', q: '' };
  App.views.interventions = { title: 'Interventions', render(el, params) {
    const q = norm(jt.q), l = db().jobs.filter(j => (jt.f === 'all' || j.status === jt.f) && (!q || norm(j.number + ' ' + j.title + ' ' + cname(j)).includes(q))).sort((a, b) => b.date.localeCompare(a.date)), due = db().jobs.filter(j => j.status === 'Terminée' && J.commission(j) > 0 && !j.commissionPaid).reduce((a, j) => a + J.commission(j), 0);
    el.innerHTML = '<div class="page"><div class="stats card"><div><b>' + db().jobs.filter(j => j.status === 'Planifiée').length + '</b><small>planifiées</small></div><div><b>' + db().jobs.filter(j => j.status === 'En cours').length + '</b><small>en cours</small></div><div><b>' + M.main(due) + '</b><small>commissions à payer</small></div></div><div class="tools"><input type="search" id="jq" placeholder="Rechercher" value="' + esc(jt.q) + '"><button class="btn primary" id="jn">+ Intervention</button><button class="btn ghost" id="jst">Équipe</button></div><div class="chips">' + ['all', ...J.STATUS].map(k => '<button data-f="' + k + '" class="' + (jt.f === k ? 'on' : '') + '">' + (k === 'all' ? 'Toutes' : k) + '</button>').join('') + '</div>' + (l.length ? '<div class="list">' + l.map(j => '<div class="swr" style="--n:0"><div class="item" data-id="' + j.id + '" role="button" tabindex="0"><span class="av">🧰</span><span class="tx"><b>' + esc(j.title) + '</b><small>' + esc(j.number) + ' · ' + esc(cname(j)) + ' · ' + App.fmtDate(j.date) + ((ST.get(j.employeeId) || {}).name ? ' · ' + esc(ST.get(j.employeeId).name) : '') + '</small></span><span class="end"><b>' + M.fmt(j.price, j.currency) + '</b><span class="pill ' + tone[j.status] + '">' + j.status + '</span></span></div></div>').join('') + '</div>' : '<div class="empty"><div class="big">🧰</div><h2>Aucune intervention</h2></div>') + '</div>';
    const jq = el.querySelector('#jq'); jq.oninput = () => { jt.q = jq.value; const p = jq.selectionStart; App.views.interventions.render(el); const n = el.querySelector('#jq'); n.focus(); n.setSelectionRange(p, p); };
    el.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { jt.f = b.dataset.f; App.views.interventions.render(el); }); el.querySelector('#jn').onclick = () => J.form(); el.querySelector('#jst').onclick = ST.manage; el.querySelectorAll('.item[data-id]').forEach(i => i.onclick = () => J.profile(i.dataset.id)); if (params && params.add) J.form();
  } };
  App.quick.push({ label: () => 'Nouvelle intervention', mod: 'interventions', run: () => { App.go('interventions'); setTimeout(() => J.form(), 30); } });
  const wrap = (o, fn, perm) => { const f = o[fn]; o[fn] = function () { if (!App.can(perm)) { App.toast('Action non autorisée pour votre profil', 'err'); return; } return f.apply(this, arguments); }; };
  App.ready.then(() => { wrap(J, 'payCommission', 'expense'); });
})();
