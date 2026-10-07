// Deliveries: who delivers what to whom, status, and cash collected on delivery. Delivery drivers only see their own.
(() => {
  'use strict';
  const App = window.App, $ = App.$, esc = App.esc, F = App.f;
  const ST = { todo: ['À livrer', 'warn'], route: ['En route', 'blue'], done: ['Livrée', 'ok'], failed: ['Échec', 'bad'] };
  const st = { f: 'open' };
  const drivers = () => App.users().filter(u => u.role === 'livreur' && u.active !== false);
  const mine = () => App.multi() && App.user && App.user.role === 'livreur';
  const visible = () => App.db.deliveries.filter(d => !mine() || d.driverId === App.user.id);
  const pill = s => `<span class="pill ${ST[s][1]}">${ST[s][0]}</span>`;
  const maps = a => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(a);
  const tel = p => String(p || '').replace(/[^+\d]/g, '');

  App.views.livraisons = () => {
    const all = visible(), open = all.filter(d => d.status !== 'done');
    const l = (st.f === 'open' ? open : st.f === 'done' ? all.filter(d => d.status === 'done') : all).slice().sort((a, b) => (st.f === 'done' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));
    const chips = [['open', `À faire (${open.length})`], ['done', 'Livrées'], ['all', 'Toutes']].map(([k, t]) => `<button class="chip ${st.f === k ? 'on' : ''}" data-act="dl_filter" data-f="${k}">${t}</button>`).join('');
    return {
      title: 'Livraisons', back: App.role().home === 'livraisons' ? '' : 'more', nav: App.role().home === 'livraisons' ? 'livraisons' : 'more',
      html: `${mine() ? '' : '<div class="bar"><button class="btn" data-act="newdl">+ Livraison</button></div>'}<div class="chips">${chips}</div>` +
        (l.length ? l.map(card).join('') : `<div class="empty">${st.f === 'open' ? 'Aucune livraison à faire. 🎉' : 'Aucune livraison.'}</div>`)
    };
  };
  const card = d => {
    const c = App.client(d.clientId), inv = App.invoice(d.invoiceId), due = inv ? App.invDue(inv) : 0, active = d.status !== 'done', ph = d.phone || (c && c.phone) || '';
    const w = ph ? App.waUrl(ph, `Bonjour ${(c && c.first) || ''}, votre livraison CISPOLstore est en route.`) : '';
    return `<div class="card"><div class="spread"><b>${esc(App.cname(c))}</b>${pill(d.status)}</div>
      <div class="mut" style="margin:4px 0">${esc(d.items || '—')}</div>
      <dl class="kv"><dt>Adresse</dt><dd>${esc(d.address || '—')}</dd><dt>Date</dt><dd>${App.fdate(d.date)}${d.driverName ? ' · ' + esc(d.driverName) : ''}</dd>${inv ? `<dt>Facture</dt><dd>${esc(inv.number)}${due > 0.004 ? ` · <b class="warn">à encaisser ${App.fmt(due, inv.currency)}</b>` : ' · réglée'}</dd>` : ''}${d.note ? `<dt>Note</dt><dd>${esc(d.note)}</dd>` : ''}${d.status === 'done' ? `<dt>Livrée le</dt><dd>${App.fdate(d.doneAt)}${d.collected ? ' · encaissé ' + App.fmt(d.collected, d.collectedCur) : ''}</dd>` : ''}</dl>
      <div class="bar" style="margin-top:8px">${ph ? `<a class="btn sm sec" href="tel:${esc(tel(ph))}" style="text-decoration:none">📞</a>` : ''}${w ? `<a class="btn sm sec" href="${w}" target="_blank" rel="noopener" style="text-decoration:none">💬</a>` : ''}${d.address ? `<a class="btn sm sec" href="${maps(d.address)}" target="_blank" rel="noopener" style="text-decoration:none">🗺️ Itinéraire</a>` : ''}
        ${active ? `${d.status === 'todo' || d.status === 'failed' ? `<button class="btn sm sec" data-act="dl_go" data-id="${d.id}">▶ En route</button>` : ''}<button class="btn sm" data-act="dl_done" data-id="${d.id}">✓ Livrée</button><button class="btn sm del" data-act="dl_fail" data-id="${d.id}">✗ Échec</button>` : ''}
        ${mine() ? '' : `<button class="btn sm sec" data-act="editdl" data-id="${d.id}">✏️</button>`}</div></div>`;
  };
  App.actions.dl_filter = d => { st.f = d.f; App.refresh(); };
  const find = id => App.db.deliveries.find(d => d.id === id);
  const who = () => (App.multi() && App.user ? App.user.name : 'Livreur');
  App.actions.dl_go = d => { const x = find(d.id); if (!x) return; x.status = 'route'; App.log(x.clientId, 'Livraison en route'); App.save(); App.refresh(); };
  App.actions.dl_fail = d => {
    const x = find(d.id); if (!x) return;
    App.modal('Livraison non effectuée', `<p>${esc(App.cname(App.client(x.clientId)))}</p>${F.text('f_why', 'Motif', '', 'placeholder="Client absent, adresse introuvable…"')}`, () => {
      x.status = 'failed'; x.note = [x.note, App.v('f_why')].filter(Boolean).join(' · '); App.log(x.clientId, 'Livraison échouée : ' + (App.v('f_why') || 'sans motif')); App.save(); App.refresh();
    }, 'Enregistrer');
  };
  App.actions.dl_done = d => {
    const x = find(d.id); if (!x) return; const inv = App.invoice(x.invoiceId), due = inv ? App.invDue(inv) : 0;
    App.modal('Livraison effectuée', `<p>${esc(App.cname(App.client(x.clientId)))}</p>${due > 0.004 ? `<div class="row">${F.num('f_amt', `Montant encaissé (${inv.currency})`, Math.round(due * 100) / 100)}${F.sel('f_m', 'Mode', App.PAY_MODES, 'Cash')}</div><p class="mut">Mettez 0 si le client ne paie pas à la livraison.</p>` : '<p class="mut">Aucun montant à encaisser.</p>'}`, () => {
      const amt = due > 0.004 ? App.n('f_amt') : 0;
      x.status = 'done'; x.doneAt = App.today();
      if (amt > 0) { App.db.payments.push({ id: App.uid(), date: App.today(), clientId: x.clientId, invoiceId: inv.id, amount: amt, currency: inv.currency, mode: App.v('f_m') || 'Cash', ref: 'Livraison', comment: 'Encaissé à la livraison par ' + who() }); x.collected = amt; x.collectedCur = inv.currency; }
      App.log(x.clientId, `Livraison effectuée par ${who()}${amt > 0 ? ' · encaissé ' + App.fmt(amt, inv.currency) : ''}`);
      App.save(); App.toast('Livraison enregistrée'); App.refresh();
    }, 'Confirmer');
  };

  App.actions.newdl = () => App.deliveryForm();
  App.actions.editdl = d => App.deliveryForm(find(d.id));
  App.actions.deldl = d => { const x = find(d.id); if (!x || !App.confirm('Supprimer cette livraison ?')) return; App.db.deliveries = App.db.deliveries.filter(y => y !== x); App.close(); App.save(); App.refresh(); };
  App.deliveryForm = (x, pre = {}) => {
    const isNew = !x; x = x || { clientId: pre.clientId || '', invoiceId: pre.invoiceId || '', address: '', phone: '', items: '', date: App.today(), driverId: '', driverName: '', status: 'todo', note: '' };
    if (!App.db.clients.length) return App.toast("Créez d'abord un client");
    const invOpts = cid => [['', '— Aucune —'], ...App.db.invoices.filter(i => i.clientId === cid).sort((a, b) => b.date.localeCompare(a.date)).map(i => [i.id, `${i.number} · ${App.fmt(App.invTotal(i), i.currency)}${App.invDue(i) > 0.004 ? ' · reste ' + App.fmt(App.invDue(i), i.currency) : ''}`])];
    const drv = drivers();
    App.modal(isNew ? 'Nouvelle livraison' : 'Modifier la livraison',
      `${F.sel('f_c', 'Client', App.clientOpts('— Choisir —'), x.clientId)}${F.sel('f_i', 'Facture liée', invOpts(x.clientId), x.invoiceId)}${F.area('f_it', 'À livrer', x.items)}
       ${F.text('f_ad', 'Adresse de livraison', x.address)}<div class="row">${F.text('f_ph', 'Téléphone', x.phone, 'type="tel"')}${F.date('f_d', 'Date', x.date)}</div>
       ${App.multi() ? F.sel('f_dr', 'Livreur', [['', '— Non assigné —'], ...drv.map(u => [u.id, u.name])], x.driverId) : F.text('f_drn', 'Livreur', x.driverName)}${isNew ? '' : F.sel('f_s', 'Statut', Object.entries(ST).map(([k, v]) => [k, v[0]]), x.status)}${F.area('f_n', 'Note', x.note)}
       ${isNew ? '' : `<div class="bar"><button type="button" class="btn sm del" data-act="deldl" data-id="${x.id}">Supprimer</button></div>`}`,
      () => {
        if (!App.v('f_c')) { App.toast('Choisissez un client'); return false; }
        const drId = App.multi() ? App.v('f_dr') : '', u = drv.find(z => z.id === drId);
        Object.assign(x, { clientId: App.v('f_c'), invoiceId: App.v('f_i'), items: App.v('f_it'), address: App.v('f_ad'), phone: App.v('f_ph'), date: App.v('f_d') || App.today(), driverId: drId, driverName: App.multi() ? (u ? u.name : '') : App.v('f_drn'), note: App.v('f_n') });
        if (!isNew) x.status = App.v('f_s') || x.status;
        if (isNew) { x.id = App.uid(); App.db.deliveries.push(x); App.log(x.clientId, 'Livraison planifiée' + (x.driverName ? ' (' + x.driverName + ')' : '')); }
        App.save(); App.toast('Livraison enregistrée'); App.refresh();
      });
    const fill = () => {
      const c = App.client($('f_c').value); $('f_i').innerHTML = App.opts(invOpts($('f_c').value), '');
      if (c && !$('f_ad').value) $('f_ad').value = c.installAddr || c.address || ''; if (c && !$('f_ph').value) $('f_ph').value = c.phone || '';
    };
    $('f_c').onchange = () => { $('f_ad').value = ''; $('f_ph').value = ''; fill(); };
    $('f_i').onchange = () => { const i = App.invoice($('f_i').value); if (i && !$('f_it').value) $('f_it').value = i.lines.filter(l => !/^abonnement/i.test(l.desc)).map(l => `${l.qty} × ${l.desc}`).join(', '); };
    if (isNew && x.clientId) fill();
  };
  // shortcut from an invoice
  App.actions.dl_fromInv = d => { const i = App.invoice(d.id); App.deliveryForm(null, { clientId: i.clientId, invoiceId: i.id }); };
})();
