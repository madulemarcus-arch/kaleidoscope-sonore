// Suppliers: list, profile (products supplied, purchases, open orders), form. Reused later for "Dû au fournisseur".
(function () {
  const App = window.App, ui = App.ui, esc = App.esc, M = App.money, S = App.stock, C = App.clients, norm = C.norm, db = () => App.db;
  const P = App.suppliers = {};
  P.get = id => db().suppliers.find(s => s.id === id);
  P.nextCode = () => { const q = App.db.settings.seq; q.supplier = (q.supplier || 0) + 1; return 'FO-' + String(q.supplier).padStart(4, '0'); };
  P.extras = []; // other modules add (supplier) => html
  P.form = (id, done) => {
    const s = id ? P.get(id) : null;
    ui.sheet({ title: s ? 'Modifier — ' + s.name : 'Nouveau fournisseur', wide: true,
      html: ui.field('Nom *', ui.input('name', s && s.name)) + '<div class="row2">' + ui.field('Contact', ui.input('contact', s && s.contact)) + ui.field('Téléphone', ui.input('phone', s && s.phone, { tel: 1 })) + '</div><div class="row2">' + ui.field('Courriel', ui.input('email', s && s.email, { type: 'email' })) + ui.field('Adresse', ui.input('address', s && s.address)) + '</div>' + ui.field('Note', '<textarea name="note" rows="2">' + esc(s ? s.note : '') + '</textarea>'),
      actions: [...(s ? [{ label: 'Supprimer', cls: 'danger', fn: async sh => { const used = db().products.some(p => p.supplierId === s.id) || db().movements.some(m => m.supplierId === s.id) || db().orders.some(o => o.supplierId === s.id); if (used) { App.toast('Ce fournisseur a un historique : suppression impossible', 'err'); return false; } if (await ui.confirm('Supprimer ' + s.name + ' ?', 'Supprimer', true)) { db().suppliers = db().suppliers.filter(x => x.id !== s.id); App.save(); sh.close(); done ? done() : App.render(); } return false; } }] : []),
        { label: 'Annuler', cls: 'ghost' }, { label: 'Enregistrer', cls: 'primary', fn: sh => {
          const f = ui.read(sh.body); if (!f.name) { App.toast('Le nom est obligatoire', 'err'); return false; }
          if (s) Object.assign(s, f); else db().suppliers.push({ id: App.uid(), code: P.nextCode(), created: App.today(), ...f });
          App.log(s ? 'supplier.edit' : 'supplier.add', f.name); App.save(); App.toast('Fournisseur enregistré'); done ? done() : App.render();
        } }] });
  };
  P.profile = id => {
    const s = P.get(id); if (!s) return; const prods = db().products.filter(p => p.supplierId === id), buys = db().movements.filter(m => m.supplierId === id && m.type === 'in'), spent = buys.reduce((a, m) => a + m.qty * m.cost, 0), open = db().orders.filter(o => o.supplierId === id && o.status === 'open');
    const rows = [['Code', s.code], ['Contact', s.contact], ['Téléphone', s.phone], ['Courriel', s.email], ['Adresse', s.address], ['Note', s.note]].filter(r => r[1]);
    ui.sheet({ title: s.name, wide: true, html: '<div class="tools">' + (s.phone ? '<a class="btn ghost" href="tel:' + esc(C.digits(s.phone)) + '">📞 Appeler</a><a class="btn ghost" target="_blank" rel="noopener" href="https://wa.me/' + C.intl(s.phone) + '">💬 WhatsApp</a>' : '') + '</div><div class="stats"><div><b>' + prods.length + '</b><small>' + esc(App.vocab('product', true)) + '</small></div><div><b>' + M.main(spent) + '</b><small>achats</small></div><div class="' + (open.length ? 'bad' : '') + '"><b>' + open.length + '</b><small>commandes ouvertes</small></div></div><dl class="kv">' + rows.map(r => '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>').join('') + '</dl>' + (prods.length ? '<h4>Fournis</h4><div class="list">' + prods.map(p => '<div class="item"><span class="tx"><b>' + esc(p.name) + '</b><small>' + S.qty(p) + ' en stock</small></span></div>').join('') + '</div>' : '') + P.extras.map(fn => fn(s) || '').join(''),
      actions: [{ label: 'Modifier', cls: 'primary', fn: () => { setTimeout(() => P.form(id), 200); } }] });
  };
  const st = { q: '' };
  App.views.suppliers = {
    title: 'Fournisseurs',
    render(el, params) {
      const q = norm(st.q), list = db().suppliers.slice().sort((a, b) => norm(a.name).localeCompare(norm(b.name))).filter(s => !q || norm(s.name + ' ' + s.contact + ' ' + s.phone + ' ' + s.code).includes(q));
      el.innerHTML = '<div class="page"><div class="tools"><input type="search" id="sq" placeholder="Rechercher un fournisseur" value="' + esc(st.q) + '"><button class="btn primary" id="sn">+ Fournisseur</button></div>' + (!db().suppliers.length ? '<div class="empty"><div class="big">🏭</div><h2>Aucun fournisseur</h2><p class="muted">Ajoutez ceux qui vous livrent vos ' + esc(App.vocab('product', true)) + '.</p></div>' : '<div class="list">' + (list.map(s => '<div class="swr" style="--n:0"><div class="item" role="button" tabindex="0" data-id="' + s.id + '"><span class="av">' + esc(App.letterOf(s.name)) + '</span><span class="tx"><b>' + esc(s.name) + '</b><small>' + esc([s.code, s.contact, s.phone].filter(Boolean).join(' · ')) + '</small></span></div></div>').join('') || '<p class="muted center">Aucun résultat.</p>') + '</div>') + '</div>';
      const sq = el.querySelector('#sq'); sq.oninput = () => { st.q = sq.value; const p = sq.selectionStart; App.views.suppliers.render(el); const n = el.querySelector('#sq'); n.focus(); n.setSelectionRange(p, p); };
      el.querySelector('#sn').onclick = () => P.form(); el.querySelectorAll('.item[data-id]').forEach(i => i.onclick = () => P.profile(i.dataset.id));
      if (params && params.add) P.form();
    }
  };
})();
