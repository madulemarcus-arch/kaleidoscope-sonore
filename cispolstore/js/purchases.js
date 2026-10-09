// Purchases: what the company bought, from whom, and for how much. Lives in the Factures tab ("Achats"); every purchase is money paid out in the Finance journal.
(() => {
  'use strict';
  const App = window.App, $ = App.$, esc = App.esc, F = App.f;
  const CUR = [['USD', 'Dollar ($)'], ['CDF', 'Franc congolais (CDF)']];
  const ps = { tab: 'sales', q: '' };
  let draft = null;   // form state kept while the item rows are added or removed

  App.purchaseTotal = b => (b.items || []).reduce((a, x) => a + (+x.qty || 0) * (+x.price || 0), 0);
  const supName = b => (App.supplier(b.supplierId) || {}).name || b.supplierName || '—';
  const summary = b => { const l = (b.items || []).map(x => x.desc).filter(Boolean); return l.length > 2 ? l.slice(0, 2).join(', ') + ` +${l.length - 2}` : l.join(', ') || '—'; };
  App.purchaseLabel = b => 'Achat · ' + summary(b);
  App.purchaseWho = supName;

  // ---------- Tabs inside "Factures": sales invoices | purchases ----------
  const tabs = () => App.can('costs') ? `<div class="chips noprint">${[['sales', '🧾 Ventes'], ['buy', '🛍️ Achats']].map(([k, t]) => `<button class="chip ${ps.tab === k ? 'on' : ''}" data-act="invtab" data-v="${k}">${t}</button>`).join('')}</div>` : '';
  const salesView = App.views.invoices;
  App.views.invoices = () => {
    if (!App.can('costs')) ps.tab = 'sales';
    if (ps.tab !== 'buy') { const r = salesView(); r.html = tabs() + r.html; return r; }
    const db = App.db, all = db.purchases || [], q = ps.q.trim().toLowerCase();
    const l = all.filter(b => !q || (supName(b) + ' ' + summary(b) + ' ' + (b.ref || '')).toLowerCase().includes(q)).sort((a, b) => b.date.localeCompare(a.date) || (b.ts || 0) - (a.ts || 0));
    const m = App.today().slice(0, 7), U = b => App.usd(App.purchaseTotal(b), b.currency, b);
    const mt = all.filter(b => b.date.startsWith(m)).reduce((a, b) => a + U(b), 0), tt = all.reduce((a, b) => a + U(b), 0);
    return {
      title: 'Factures', sub: `${all.length} achat(s)`, back: 'more', nav: 'more',
      html: `${tabs()}<div class="grid two"><div class="stat"><small>Acheté ce mois</small><b>${App.fmt(mt)}</b></div><div class="stat"><small>Total des achats</small><b>${App.fmt(tt)}</b></div></div>
        <div class="search"><input id="bq" placeholder="Rechercher un fournisseur, un article…" value="${esc(ps.q)}" autocomplete="off"></div>
        <div class="bar"><button class="btn" data-act="newbuy">+ Nouvel achat</button><button class="btn sec" data-act="buycsv">CSV</button></div>
        ${l.length ? `<div class="list">${l.map(b => `<button class="item" data-act="go" data-v="purchase" data-id="${b.id}"><div class="grow"><b>${esc(supName(b))}</b><small>${App.fdate(b.date)} · ${esc(summary(b))}${b.ref ? ' · ' + esc(b.ref) : ''}</small></div><div class="end"><b>${App.fmt(App.purchaseTotal(b), b.currency)}</b><small>${esc(b.mode || '')}</small></div></button>`).join('')}</div>` : '<div class="empty">Aucun achat enregistré. Touchez « + Nouvel achat » pour noter ce que l\'entreprise a acheté, chez qui et à combien.</div>'}`,
      after: () => { if ($('bq')) $('bq').oninput = e => { ps.q = e.target.value; const p = e.target.selectionStart; App.refresh(); const n = $('bq'); if (n) { n.focus(); n.setSelectionRange(p, p); } }; }
    };
  };
  App.actions.invtab = d => { ps.tab = d.v === 'buy' ? 'buy' : 'sales'; App.refresh(); };

  // ---------- Detail ----------
  App.views.purchase = p => {
    const b = (App.db.purchases || []).find(x => x.id === p.id);
    if (!b) return { title: 'Achat', back: 'invoices', html: '<div class="empty">Introuvable.</div>' };
    const sup = App.supplier(b.supplierId), tot = App.purchaseTotal(b);
    return {
      title: supName(b), sub: `Achat du ${App.fdate(b.date)}`, back: 'invoices', nav: 'more',
      html: `<div class="card"><dl class="kv"><dt>Fournisseur</dt><dd>${sup ? `<a href="#" data-act="go" data-v="supplier" data-id="${sup.id}">${esc(sup.name)}</a>` : esc(supName(b))}</dd><dt>Date</dt><dd>${App.fdate(b.date)}</dd><dt>Payé par</dt><dd>${esc(b.mode || '—')}</dd><dt>N° facture / bon</dt><dd>${esc(b.ref || '—')}</dd>${b.note ? `<dt>Note</dt><dd>${esc(b.note)}</dd>` : ''}</dl></div>
        <h2 class="sec">Ce qui a été acheté <span class="more">Total ${App.fmt(tot, b.currency)}</span></h2>
        <div class="list">${(b.items || []).map(x => `<div class="item"><div class="grow"><b>${esc(x.desc)}</b><small>${App.nf(x.qty, 2)} × ${App.fmt(x.price, b.currency)}</small></div><b>${App.fmt((+x.qty || 0) * (+x.price || 0), b.currency)}</b></div>`).join('')}</div>
        ${b.currency === 'CDF' ? `<p class="mut">Équivalent : ${App.fmt(App.usd(tot, 'CDF', b))} (taux de la date).</p>` : ''}
        <div class="bar noprint" style="margin-top:12px"><button class="btn sec" data-act="editbuy" data-id="${b.id}">Modifier</button><button class="btn del" data-act="delbuy" data-id="${b.id}">Supprimer</button></div>`
    };
  };

  // ---------- Form ----------
  const blankItem = () => ({ desc: '', qty: 1, price: '' });
  const readForm = () => {
    const items = []; for (let i = 0; $('l_d' + i); i++) items.push({ desc: $('l_d' + i).value.trim(), qty: App.n('l_q' + i), price: $('l_p' + i).value });
    return { id: draft && draft.id, supplierId: App.v('f_sup'), supplierName: App.v('f_supn'), date: App.v('f_date'), currency: App.v('f_cur'), mode: App.v('f_mode'), ref: App.v('f_ref'), note: App.v('f_note'), items };
  };
  const total = () => { let t = 0; for (let i = 0; $('l_d' + i); i++) t += App.n('l_q' + i) * App.n('l_p' + i); if ($('b_tot')) $('b_tot').textContent = App.fmt(t, App.v('f_cur') || 'USD'); };
  const buyForm = b => {
    draft = b; const sups = [['', '— Autre fournisseur (saisir le nom) —'], ...App.db.suppliers.slice().sort((x, y) => x.name.localeCompare(y.name)).map(s => [s.id, s.name])];
    const rows = (b.items.length ? b.items : [blankItem()]).map((x, i) => `<div class="card" style="padding:10px;margin-bottom:8px">${F.text('l_d' + i, 'Article acheté', x.desc, 'placeholder="Ex. Kit Starlink Mini, câble 50 m…" oninput="App.buyTotal()"')}<div class="row">${F.num('l_q' + i, 'Quantité', x.qty, 'oninput="App.buyTotal()"')}${F.num('l_p' + i, 'Prix unitaire', x.price, 'oninput="App.buyTotal()"')}</div>${i ? `<button type="button" class="btn sm del" data-act="buyrm" data-i="${i}">Retirer cet article</button>` : ''}</div>`).join('');
    App.modal(b.id ? "Modifier l'achat" : 'Nouvel achat',
      `${F.sel('f_sup', 'Acheté chez (fournisseur)', sups, b.supplierId)}${F.text('f_supn', 'Nom du fournisseur', b.supplierName, 'placeholder="Si pas dans la liste (sera ajouté)"')}
       <div class="row">${F.date('f_date', 'Date', b.date)}${F.sel('f_cur', 'Devise', CUR, b.currency, 'onchange="App.buyTotal()"')}</div>${rows}
       <button type="button" class="btn sec sm" data-act="buyadd">+ Ajouter un article</button>
       <div class="spread" style="margin:10px 0"><span>Total de l'achat</span><b id="b_tot" style="font-size:18px"></b></div>
       <div class="row">${F.sel('f_mode', 'Payé par', App.PAY_MODES, b.mode)}${F.text('f_ref', 'N° facture / bon fournisseur', b.ref)}</div>${F.text('f_note', 'Note (facultatif)', b.note)}`,
      () => saveBuy(readForm()));
    total();
  };
  App.buyTotal = total;
  const saveBuy = f => {
    const items = f.items.filter(x => x.desc && +x.qty > 0 && +x.price > 0).map(x => ({ desc: x.desc, qty: +x.qty, price: +x.price }));
    if (!items.length) { App.toast('Ajoutez au moins un article avec son prix'); return false; }
    let sid = f.supplierId, sname = f.supplierName;
    if (!sid && !sname) { App.toast('Indiquez chez qui vous avez acheté'); return false; }
    if (!sid) { let s = App.db.suppliers.find(x => x.name.toLowerCase() === sname.toLowerCase()); if (!s) { s = { id: App.uid(), name: sname, phone: '', address: '', goods: '', notes: '' }; App.db.suppliers.push(s); } sid = s.id; }
    const list = App.db.purchases = App.db.purchases || [], rec = f.id ? list.find(x => x.id === f.id) : null;
    const o = { supplierId: sid, supplierName: (App.supplier(sid) || {}).name || sname, date: f.date || App.today(), currency: f.currency === 'CDF' ? 'CDF' : 'USD', mode: f.mode, ref: f.ref, note: f.note, items };
    if (rec) { if (rec.currency !== o.currency || rec.date !== o.date) delete rec.rate; Object.assign(rec, o); } else list.push({ id: App.uid(), ts: Date.now(), ...o });
    App.stampRates(); App.save(); ps.tab = 'buy'; if (['invoices', 'purchase'].includes(App.state.view)) App.refresh(); else App.go('invoices'); App.toast('Achat enregistré');
  };
  App.actions.newbuy = () => buyForm({ supplierId: '', supplierName: '', date: App.today(), currency: 'USD', mode: 'Cash', ref: '', note: '', items: [blankItem()] });
  App.actions.editbuy = d => { const b = (App.db.purchases || []).find(x => x.id === d.id); if (b) buyForm({ ...b, items: b.items.map(x => ({ ...x })) }); };
  App.actions.buyadd = () => { const f = readForm(); f.items.push(blankItem()); buyForm(f); };
  App.actions.buyrm = d => { const f = readForm(); f.items.splice(+d.i, 1); buyForm(f); };
  App.actions.delbuy = d => { if (!App.confirm('Supprimer cet achat ?')) return; App.db.purchases = (App.db.purchases || []).filter(x => x.id !== d.id); App.save(); App.go('invoices', {}, true); };
  App.actions.buycsv = () => App.download(`cispolstore-achats-${App.today()}.csv`, App.csv([['Date', 'Fournisseur', 'Article', 'Quantité', 'Prix unitaire', 'Montant', 'Devise', 'Payé par', 'N° facture / bon', 'Note'], ...(App.db.purchases || []).slice().sort((a, b) => a.date.localeCompare(b.date)).flatMap(b => b.items.map(x => [b.date, supName(b), x.desc, x.qty, x.price, x.qty * x.price, b.currency, b.mode, b.ref, b.note]))]), 'text/csv');
})();
