// Stock (products, in/out movements, cable in metres) and suppliers.
(() => {
  'use strict';
  const App = window.App, $ = App.$, esc = App.esc, F = App.f;
  const unitLabel = p => p.unit === 'm' ? 'm' : '';
  const qtyText = p => App.tracked(p) ? `${App.nf(p.qty, 2)}${p.unit === 'm' ? ' m' : ''}` : '∞';
  const stClass = p => !App.tracked(p) ? '' : p.qty <= 0 ? 'bad' : p.qty <= (p.min || 0) ? 'warn' : 'ok';
  const supOpts = () => [['', '— Aucun —'], ...App.db.suppliers.map(s => [s.id, s.name])];
  const prodOpts = (only) => App.db.products.filter(p => !only || App.tracked(p)).sort((a, b) => a.name.localeCompare(b.name)).map(p => [p.id, `${p.name}${App.tracked(p) ? ` (${qtyText(p)})` : ''}`]);

  // ---------- Stock list ----------
  const st = { cat: 'all', q: '' };
  const drawList = () => {
    const q = st.q.toLowerCase();
    const l = App.db.products.filter(p => (st.cat === 'all' || p.cat === st.cat) && (!q || (p.name + ' ' + p.ref + ' ' + p.cat).toLowerCase().includes(q))).sort((a, b) => a.name.localeCompare(b.name));
    $('plist').innerHTML = l.length ? `<div class="list">${l.map(p => {
      const sup = App.supplier(p.supplierId);
      return `<div class="item"><div class="grow"><b>${esc(p.name)}</b><small>${esc(p.cat)}${p.ref ? ' · ' + esc(p.ref) : ''}${sup ? ' · ' + esc(sup.name) : ''}</small><small>${App.can('costs') ? 'Achat : ' + App.fmt(p.cost) + ' | ' : ''}Vente : ${App.fmt(p.price)}${p.unit === 'm' ? ' / m' : ''}</small></div>
        <div class="end"><span class="pill ${stClass(p)}" style="font-size:13px">${App.tracked(p) ? 'En stock : ' + qtyText(p) : 'Sans stock'}</span>
        ${App.can('stockedit') ? `<span><button class="btn sm sec" data-act="stin" data-id="${p.id}">＋</button> <button class="btn sm sec" data-act="stout" data-id="${p.id}">－</button> <button class="btn sm sec" data-act="editprod" data-id="${p.id}">✎</button></span>` : ''}</div></div>`;
    }).join('')}</div>` : '<div class="empty">Aucun produit. Ajoutez par exemple « Starlink Mini », « Câble Cat6 (m) », « Routeur »…</div>';
  };
  App.views.stock = p => {
    if (p && p.q != null && p.q !== st.q) st.q = p.q;
    const db = App.db, low = db.products.filter(x => App.tracked(x) && x.qty <= (x.min || 0));
    const moves = db.moves.slice(-12).reverse();
    return {
      title: 'Stock', sub: `${db.products.length} produit(s)`, nav: 'stock',
      html: `<div class="search"><input id="pq" placeholder="Rechercher un produit, une référence…" value="${esc(st.q)}" autocomplete="off"></div>
        <div class="chips"><button class="chip ${st.cat === 'all' ? 'on' : ''}" data-act="stcat" data-c="all">Tous</button>${App.CATS.filter(c => db.products.some(p => p.cat === c)).map(c => `<button class="chip ${st.cat === c ? 'on' : ''}" data-act="stcat" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>
        ${low.length ? `<div class="card" style="margin-bottom:10px"><b class="warn">⚠ Stock bas :</b> ${low.map(x => esc(x.name) + ' (' + qtyText(x) + ')').join(', ')}</div>` : ''}
        <div id="plist"></div>
        <div class="bar" style="margin-top:14px"><button class="btn" data-act="newprod">+ Produit</button><button class="btn sec" data-act="stin">📥 Entrée</button><button class="btn sec" data-act="stout">📤 Sortie</button><button class="btn sec" data-csv="produits">CSV</button></div>
        ${moves.length ? `<h2 class="sec">Mouvements récents</h2><div class="list">${moves.map(m => { const p = App.prod(m.pid), c = App.client(m.clientId), i = App.invoice(m.invoiceId); return `<div class="item"><div class="grow"><b>${esc(p ? p.name : '?')}</b><small>${App.fdate(m.date)}${i ? ' · ' + esc(i.number) : ''}${c ? ' · ' + esc(App.cname(c)) : ''}${m.note ? ' · ' + esc(m.note) : ''}</small></div><b class="${m.qty >= 0 ? 'ok' : 'bad'}">${m.qty > 0 ? '+' : ''}${App.nf(m.qty, 2)}${p && p.unit === 'm' ? ' m' : ''}</b></div>`; }).join('')}</div>` : ''}`,
      after: () => { drawList(); $('pq').oninput = e => { st.q = e.target.value; drawList(); }; }
    };
  };
  App.actions.stcat = d => { st.cat = d.c; App.refresh(); };
  App.actions.newprod = () => App.productForm();
  App.actions.editprod = d => App.productForm(App.prod(d.id));

  // ---------- Product form ----------
  App.productForm = p => {
    const isNew = !p;
    p = p || { name: '', cat: 'Kits Starlink', ref: '', unit: 'pièce', qty: 0, cost: '', price: '', supplierId: '', min: 1, entry: App.today() };
    App.modal(isNew ? 'Nouveau produit' : 'Modifier le produit',
      `${F.text('f_name', 'Nom', p.name, 'required')}
       <div class="row">${F.sel('f_cat', 'Catégorie', App.CATS, p.cat)}${F.text('f_ref', 'Référence', p.ref)}</div>
       <div class="row">${F.sel('f_unit', 'Unité', [['pièce', 'Pièce'], ['m', 'Mètre (m)']], p.unit)}${F.num('f_qty', isNew ? 'Quantité initiale' : 'Quantité en stock', p.qty)}${F.num('f_min', 'Stock minimum', p.min)}</div>
       <div class="row">${F.num('f_cost', "Prix d'achat ($)", p.cost)}${F.num('f_price', 'Prix de vente ($)', p.price)}</div>
       ${F.sel('f_sup', 'Fournisseur', supOpts(), p.supplierId)}${F.date('f_entry', "Date d'entrée", p.entry)}`,
      () => {
        if (!App.v('f_name')) { App.toast('Nom requis'); return false; }
        const o = { name: App.v('f_name'), cat: App.v('f_cat'), ref: App.v('f_ref'), unit: App.v('f_unit'), min: App.n('f_min'), cost: App.n('f_cost'), price: App.n('f_price'), supplierId: App.v('f_sup'), entry: App.v('f_entry') };
        const q = App.n('f_qty');
        if (isNew) { Object.assign(p, o, { id: App.uid(), qty: App.NO_STOCK.includes(o.cat) ? 0 : q }); App.db.products.push(p); if (q > 0 && App.tracked(p)) App.db.moves.push({ id: App.uid(), date: App.today(), pid: p.id, qty: q, type: 'in', cost: o.cost, supplierId: o.supplierId, invoiceId: '', clientId: '', note: 'Stock initial' }); }
        else { if (App.tracked({ cat: o.cat }) && Math.abs(q - p.qty) > 1e-9) App.db.moves.push({ id: App.uid(), date: App.today(), pid: p.id, qty: q - p.qty, type: q > p.qty ? 'in' : 'out', cost: o.cost, supplierId: '', invoiceId: '', clientId: '', note: 'Correction de stock' }); Object.assign(p, o, { qty: App.NO_STOCK.includes(o.cat) ? 0 : q }); }
        App.save(); App.toast('Produit enregistré'); App.refresh();
      });
    if (!isNew) {
      const del = document.createElement('button'); del.type = 'button'; del.className = 'btn del sm'; del.textContent = 'Supprimer'; del.style.marginRight = 'auto';
      del.onclick = () => { if (App.db.invoices.some(i => i.lines.some(l => l.pid === p.id))) return App.toast('Produit utilisé dans des factures : suppression impossible'); if (!App.confirm('Supprimer ce produit ?')) return; App.db.products = App.db.products.filter(x => x !== p); App.db.moves = App.db.moves.filter(m => m.pid !== p.id); App.save(); App.close(); App.refresh(); };
      document.querySelector('#dlg .end').prepend(del);
    }
  };

  // ---------- Stock in / out ----------
  App.stockInForm = id => {
    const l = prodOpts(true); if (!l.length) return App.toast("Ajoutez d'abord un produit");
    const p = App.prod(id) || App.prod(l[0][0]);
    App.modal('Entrée de stock',
      `${F.sel('f_p', 'Produit', l, p.id)}<div class="row">${F.num('f_q', 'Quantité reçue', '', 'min="0"')}${F.num('f_c', "Prix d'achat unitaire ($)", p.cost)}</div>
       ${F.sel('f_s', 'Fournisseur', supOpts(), p.supplierId)}${F.date('f_d', 'Date', App.today())}${F.text('f_n', 'Note / n° de bon', '')}`,
      () => {
        const q = App.n('f_q'); if (q <= 0) { App.toast('Quantité invalide'); return false; }
        App.move({ pid: App.v('f_p'), qty: q, cost: App.n('f_c'), supplierId: App.v('f_s'), date: App.v('f_d'), note: App.v('f_n') || 'Entrée de stock' });
        App.save(); App.toast('Stock mis à jour'); App.refresh();
      }, 'Ajouter au stock');
    $('f_p').onchange = () => { const x = App.prod($('f_p').value); $('f_c').value = x.cost; $('f_s').value = x.supplierId || ''; };
  };
  App.actions.stin = d => App.stockInForm(d.id);
  App.stockOutForm = id => {
    const l = prodOpts(true); if (!l.length) return App.toast("Ajoutez d'abord un produit");
    const p = App.prod(id) || App.prod(l[0][0]);
    App.modal('Sortie de stock',
      `${F.sel('f_p', 'Produit', l, p.id)}${F.num('f_q', 'Quantité sortie', '', 'min="0"')}
       ${F.sel('f_r', 'Motif', ['Vente', 'Installation', 'Perte / casse', 'Usage interne', 'Autre'], 'Installation')}
       ${F.sel('f_c', 'Client concerné', App.clientOpts('— Aucun —'))}${F.date('f_d', 'Date', App.today())}${F.text('f_n', 'Note', '')}`,
      () => {
        const q = App.n('f_q'), x = App.prod(App.v('f_p')); if (q <= 0) { App.toast('Quantité invalide'); return false; }
        if (q > x.qty && !App.confirm(`Stock insuffisant (${x.qty}). Continuer quand même ?`)) return false;
        App.move({ pid: x.id, qty: -q, clientId: App.v('f_c'), date: App.v('f_d'), note: [App.v('f_r'), App.v('f_n')].filter(Boolean).join(' · ') });
        if (App.v('f_c')) App.log(App.v('f_c'), `Sortie de stock : ${q} ${x.unit === 'm' ? 'm' : '×'} ${x.name}`);
        App.save(); App.toast('Sortie enregistrée'); App.refresh();
      }, 'Enregistrer la sortie');
  };
  App.actions.stout = d => App.stockOutForm(d.id);

  // ---------- Suppliers ----------
  App.views.suppliers = () => {
    const l = App.db.suppliers.slice().sort((a, b) => a.name.localeCompare(b.name));
    return {
      title: 'Fournisseurs', back: 'more', nav: 'more',
      html: `<div class="bar"><button class="btn" data-act="newsup">+ Fournisseur</button></div>` + (l.length ? `<div class="list">${l.map(s => `<button class="item" data-act="go" data-v="supplier" data-id="${s.id}"><span class="avatar">🚚</span><div class="grow"><b>${esc(s.name)}</b><small>${esc(s.phone || '')}${s.goods ? ' · ' + esc(s.goods) : ''}</small></div><span class="mut">›</span></button>`).join('')}</div>` : '<div class="empty">Aucun fournisseur.</div>')
    };
  };
  App.actions.newsup = () => App.supplierForm();
  App.supplierForm = s => {
    const isNew = !s; s = s || { name: '', phone: '', address: '', goods: '', notes: '' };
    App.modal(isNew ? 'Nouveau fournisseur' : 'Modifier le fournisseur', `${F.text('f_name', 'Nom', s.name)}${F.text('f_phone', 'Téléphone', s.phone, 'type="tel"')}${F.text('f_addr', 'Adresse', s.address)}${F.text('f_goods', 'Matériel fourni', s.goods)}${F.area('f_notes', 'Notes', s.notes)}`, () => {
      if (!App.v('f_name')) { App.toast('Nom requis'); return false; }
      Object.assign(s, { name: App.v('f_name'), phone: App.v('f_phone'), address: App.v('f_addr'), goods: App.v('f_goods'), notes: App.v('f_notes') });
      if (isNew) { s.id = App.uid(); App.db.suppliers.push(s); }
      App.save(); App.toast('Fournisseur enregistré'); App.refresh();
    });
  };
  App.views.supplier = p => {
    const s = App.supplier(p.id); if (!s) return { title: 'Fournisseur', back: 'suppliers', html: '<div class="empty">Introuvable.</div>' };
    const buys = App.db.moves.filter(m => m.supplierId === s.id && m.qty > 0).slice().reverse();
    const total = buys.reduce((a, m) => a + m.qty * m.cost, 0), prods = App.db.products.filter(x => x.supplierId === s.id);
    return {
      title: s.name, sub: 'Fournisseur', back: 'suppliers', nav: 'more',
      html: `<div class="card"><dl class="kv"><dt>Téléphone</dt><dd>${App.tel(s.phone)}</dd><dt>Adresse</dt><dd>${esc(s.address || '—')}</dd><dt>Matériel fourni</dt><dd>${esc(s.goods || '—')}</dd><dt>Notes</dt><dd>${esc(s.notes || '—')}</dd></dl>
        <div class="bar" style="margin-top:12px"><button class="btn sec" data-act="editsup" data-id="${s.id}">Modifier</button><button class="btn del" data-act="delsup" data-id="${s.id}">Supprimer</button></div></div>
        ${prods.length ? `<h2 class="sec">Produits</h2><div class="list">${prods.map(x => `<div class="item"><div class="grow"><b>${esc(x.name)}</b></div><span>Achat : ${App.fmt(x.cost)}</span></div>`).join('')}</div>` : ''}
        <h2 class="sec">Historique des achats <span class="more">Total ${App.fmt(total)}</span></h2>
        ${buys.length ? `<div class="list">${buys.map(m => { const x = App.prod(m.pid); return `<div class="item"><div class="grow"><b>${esc(x ? x.name : '?')}</b><small>${App.fdate(m.date)} · ${App.nf(m.qty, 2)} × ${App.fmt(m.cost)}</small></div><b>${App.fmt(m.qty * m.cost)}</b></div>`; }).join('')}</div>` : '<div class="empty">Aucun achat enregistré. Utilisez « Entrée de stock » en choisissant ce fournisseur.</div>'}`
    };
  };
  App.actions.editsup = d => App.supplierForm(App.supplier(d.id));
  App.actions.delsup = d => { if (!App.confirm('Supprimer ce fournisseur ?')) return; const s = App.supplier(d.id); App.db.suppliers = App.db.suppliers.filter(x => x !== s); App.db.products.forEach(p => { if (p.supplierId === s.id) p.supplierId = ''; }); App.save(); App.go('suppliers', {}, true); };

  // ---------- Installations ----------
  App.views.installs = () => {
    const l = App.db.installs.slice().sort((a, b) => b.date.localeCompare(a.date));
    return {
      title: 'Installations', back: 'more', nav: 'more',
      html: `<div class="bar"><button class="btn" data-act="newinst">+ Installation</button></div>` + (l.length ? `<div class="list">${l.map(x => `<button class="item" data-act="go" data-v="client" data-id="${x.clientId}" data-p='${JSON.stringify({ id: x.clientId, tab: 'inst' })}'><span class="avatar">🔧</span><div class="grow"><b>${esc(App.cname(App.client(x.clientId)))}</b><small>${App.fdate(x.date)} · ${esc(x.kind)} · ${esc(x.tech || '—')}</small></div><b>${App.fmt(x.price || 0)}</b></button>`).join('')}</div>` : '<div class="empty">Aucune installation enregistrée.</div>')
    };
  };
  App.actions.newinst = d => App.installForm({ clientId: d.cid, tech: d.tech });
  App.installForm = (pre = {}) => {
    const cl = App.clientOpts('— Choisir —', ['gere', 'install', 'mat']); if (cl.length < 2) return App.toast("Créez d'abord un client");
    const mats = [];
    const draw = () => { $('mlist').innerHTML = mats.length ? mats.map((m, i) => `<div class="item"><div class="grow"><b>${esc(App.prod(m.pid).name)}</b></div><b>${m.qty} ${esc(App.prod(m.pid).unit === 'm' ? 'm' : '×')}</b><button type="button" class="btn sm del" data-act="rmmat" data-i="${i}">✕</button></div>`).join('') : '<small class="mut">Aucun matériel utilisé</small>'; };
    App.actions.rmmat = d => { mats.splice(+d.i, 1); draw(); };
    App.modal("Nouvelle installation",
      `${F.sel('f_c', 'Client', cl, pre.clientId || '')}<div class="row">${F.date('f_d', "Date d'installation", App.today())}${F.sel('f_k', "Type d'installation", ['Installation Starlink', 'Installation WiFi / réseau', 'Dépannage', 'Autre'], 'Installation Starlink')}</div>
       <div class="row">${F.text('f_t', 'Technicien', pre.tech || '', 'list="techlist" autocomplete="off"' + (pre.tech ? ' readonly' : ''))}${F.list('techlist', App.techNames())}${F.num('f_p', "Prix de l'installation ($)", '')}</div>
       <label class="l">Matériel utilisé (sort du stock)</label><div class="row"><select id="f_mp" style="flex:3">${App.opts(prodOpts(true))}</select><input id="f_mq" type="number" step="any" min="0" value="1" style="flex:1"><button type="button" class="btn sm" id="f_madd" style="flex:1">Ajouter</button></div><div id="mlist" class="list" style="margin-top:8px"></div>
       ${F.area('f_o', 'Observations', '')}`,
      () => {
        if (!App.v('f_c')) { App.toast('Choisissez un client'); return false; }
        const inst = { id: App.uid(), clientId: App.v('f_c'), date: App.v('f_d') || App.today(), kind: App.v('f_k'), tech: App.v('f_t'), techId: App.techId(App.v('f_t')), price: App.n('f_p'), materials: mats.slice(), invoiceId: '', obs: App.v('f_o') };
        mats.forEach(m => App.move({ pid: m.pid, qty: -m.qty, clientId: inst.clientId, date: inst.date, note: 'Installation' }));
        App.db.installs.push(inst); App.log(inst.clientId, `Installation : ${inst.kind}${inst.tech ? ' (' + inst.tech + ')' : ''}`);
        App.save(); App.toast('Installation enregistrée'); App.refresh();
      });
    $('f_madd').onclick = () => { const q = App.n('f_mq'); if (q > 0 && $('f_mp').value) { mats.push({ pid: $('f_mp').value, qty: q }); draw(); } };
    draw();
  };

  // ---------- CSV ----------
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-csv="produits"]'); if (!b) return;
    App.download(`cispolstore-stock-${App.today()}.csv`, App.csv([['Nom', 'Catégorie', 'Référence', 'Unité', 'Quantité', 'Prix achat', 'Prix vente', 'Fournisseur', 'Stock min'], ...App.db.products.map(p => [p.name, p.cat, p.ref, p.unit, p.qty, p.cost, p.price, (App.supplier(p.supplierId) || {}).name || '', p.min])]), 'text/csv');
  });
})();
