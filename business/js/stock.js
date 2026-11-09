// Stock: products (configurable categories and units), journal of movements, low-stock alerts, value, product report.
(function () {
  const App = window.App, ui = App.ui, esc = App.esc, M = App.money, C = App.clients, norm = C.norm;
  const S = App.stock = {}, db = () => App.db;
  S.get = id => db().products.find(p => p.id === id);
  S.supplier = id => db().suppliers.find(s => s.id === id);
  S.tracked = p => p.track !== false;
  S.nf = n => String(Math.round((+n || 0) * 100) / 100).replace('.', ',');
  S.qty = p => S.tracked(p) ? S.nf(p.qty) + (p.unit && p.unit !== 'pièce' ? ' ' + p.unit : '') : '∞';
  S.state = p => !S.tracked(p) ? '' : p.qty <= 0 ? 'bad' : p.qty <= (+p.min || 0) ? 'warn' : 'ok';
  S.low = () => db().products.filter(p => S.tracked(p) && p.qty <= (+p.min || 0));
  S.value = p => S.tracked(p) ? (+p.qty || 0) * (+p.cost || +p.price || 0) : 0;
  S.nextCode = () => { const q = App.db.settings.seq; q.product = (q.product || 0) + 1; return 'PR-' + String(q.product).padStart(4, '0'); };
  // The only door to change a quantity: keeps the journal complete. qty > 0 = in, qty < 0 = out.
  S.move = o => {
    const p = S.get(o.pid); if (!p) return null;
    if (S.tracked(p)) p.qty = Math.round((p.qty + o.qty) * 1000) / 1000;
    if (o.qty > 0 && o.cost > 0 && o.type === 'in') p.cost = o.cost; // last purchase price
    const m = { id: App.uid(), date: o.date || App.today(), pid: o.pid, qty: o.qty, type: o.type || (o.qty > 0 ? 'in' : 'out'), cost: o.cost || 0, supplierId: o.supplierId || '', note: o.note || '', ref: o.ref || '' };
    db().movements.push(m); return m;
  };
  const supOpts = () => [['', '— Aucun —'], ...db().suppliers.map(s => [s.id, s.name])];
  const prodOpts = () => db().products.filter(S.tracked).sort((a, b) => norm(a.name).localeCompare(norm(b.name))).map(p => [p.id, p.name + ' (' + S.qty(p) + ')']);
  const dl = (id, arr) => '<datalist id="' + id + '">' + arr.map(x => '<option value="' + esc(x) + '">').join('') + '</datalist>';
  const word = () => App.cap(App.vocab('product'));

  // ---------- product form ----------
  S.form = (id, done) => {
    const p = id ? S.get(id) : null, s = App.db.settings;
    ui.sheet({ title: p ? 'Modifier — ' + p.name : 'Nouveau ' + App.vocab('product'), wide: true,
      html: ui.field('Nom *', ui.input('name', p && p.name)) +
        '<div class="row2">' + ui.field('Catégorie', '<input name="cat" list="dl-cat" value="' + esc(p ? p.cat : s.categories[0]) + '">' + dl('dl-cat', s.categories)) + ui.field('Référence', ui.input('ref', p && p.ref)) + '</div>' +
        '<div class="row2">' + ui.field('Unité', '<input name="unit" list="dl-unit" value="' + esc(p ? p.unit : s.units[0]) + '">' + dl('dl-unit', s.units)) + ui.field('Fournisseur', ui.select('supplierId', supOpts(), p ? p.supplierId : '')) + '</div>' +
        '<label class="mod"><input type="checkbox" name="track"' + (!p || S.tracked(p) ? ' checked' : '') + '><span><b>Suivre le stock</b><small>Décochez pour un service ou un article non compté.</small></span></label>' +
        '<div class="row2">' + ui.field(p ? 'Quantité en stock' : 'Quantité initiale', ui.input('qty', p ? p.qty : 0, { num: 1 })) + ui.field('Stock minimum (alerte)', ui.input('min', p ? p.min : 1, { num: 1 })) + '</div>' +
        '<div class="row2">' + ui.field('Prix d\'achat (' + s.currency + ')', ui.input('cost', p ? p.cost : '', { num: 1 })) + ui.field('Prix de vente (' + s.currency + ')', ui.input('price', p ? p.price : '', { num: 1 })) + '</div>' + App.cf.html('products', p && p.fields),
      actions: [...(p ? [{ label: 'Supprimer', cls: 'danger', fn: async sh => { if (db().invoices.some(i => (i.lines || []).some(l => l.pid === p.id))) { App.toast('Utilisé dans des factures : suppression impossible', 'err'); return false; } if (await ui.confirm('Supprimer ' + p.name + ' ?', 'Supprimer', true)) { db().products = db().products.filter(x => x.id !== p.id); App.log('product.delete', p.name); App.save(); sh.close(); done ? done() : App.render(); } return false; } }] : []),
        { label: 'Annuler', cls: 'ghost' }, { label: 'Enregistrer', cls: 'primary', fn: sh => {
          const f = ui.read(sh.body); if (!f.name) { App.toast('Le nom est obligatoire', 'err'); return false; }
          const cat = f.cat || s.categories[0], unit = f.unit || s.units[0]; if (!s.categories.includes(cat)) s.categories.push(cat); if (!s.units.includes(unit)) s.units.push(unit);
          const rec = { name: f.name, cat, ref: f.ref, unit, supplierId: f.supplierId, track: f.track, min: f.min, cost: f.cost, price: f.price, fields: App.cf.read('products', sh.body) };
          if (p) { const diff = f.track ? Math.round((f.qty - p.qty) * 1000) / 1000 : 0; Object.assign(p, rec); if (diff) S.move({ pid: p.id, qty: diff, type: 'adjust', note: 'Correction de la fiche' }); }
          else { const n = { id: App.uid(), code: S.nextCode(), created: App.today(), qty: 0, ...rec }; db().products.push(n); if (f.track && f.qty > 0) S.move({ pid: n.id, qty: f.qty, type: 'in', cost: f.cost, note: 'Stock initial' }); }
          App.log(p ? 'product.edit' : 'product.add', f.name); App.save(); App.toast(word() + ' enregistré'); done ? done() : App.render();
        } }] });
  };

  // ---------- in / out ----------
  S.moveForm = (kind, pid) => {
    const l = prodOpts(); if (!l.length) return App.toast('Ajoutez d\'abord un ' + App.vocab('product') + ' suivi en stock', 'err');
    const p = S.get(pid) || S.get(l[0][0]), inn = kind === 'in';
    ui.sheet({ title: inn ? 'Entrée de stock' : 'Sortie de stock', html: ui.field(word(), ui.select('pid', l, p.id)) + '<div class="row2">' + ui.field('Quantité', ui.stepper('qty', 1, 0)) + (inn ? ui.field('Prix d\'achat unitaire', ui.input('cost', p.cost, { num: 1 })) : ui.field('Motif', ui.select('reason', ['Perte / casse', 'Usage interne', 'Don / échantillon', 'Autre'], 'Perte / casse'))) + '</div>' + (inn ? ui.field('Fournisseur', ui.select('supplierId', supOpts(), p.supplierId)) : '') + ui.field('Date', ui.dateField('date')) + ui.field('Note', ui.input('note', '')),
      actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Enregistrer', cls: 'primary', fn: sh => {
        const f = ui.read(sh.body); if (!(f.qty > 0)) { App.toast('Quantité invalide', 'err'); return false; }
        const q = S.get(f.pid); if (!inn && f.qty > q.qty && !sh._ok) { App.toast('Stock insuffisant (' + S.qty(q) + '). Appuyez encore pour forcer.', 'err'); sh._ok = true; return false; }
        S.move({ pid: f.pid, qty: inn ? f.qty : -f.qty, type: kind, cost: f.cost, supplierId: f.supplierId, date: f.date, note: f.note || f.reason || (inn ? 'Entrée de stock' : 'Sortie de stock') });
        App.log('stock.' + kind, q.name + ' ' + f.qty); App.save(); App.toast(inn ? 'Entrée enregistrée' : 'Sortie enregistrée'); App.render();
      } }] });
  };

  // ---------- journal and product report ----------
  const moveRow = m => { const p = S.get(m.pid), sp = S.supplier(m.supplierId); return '<div class="item"><span class="av">' + (m.qty > 0 ? '＋' : '－') + '</span><span class="tx"><b>' + esc(p ? p.name : '(supprimé)') + '</b><small>' + App.fmtDate(m.date) + (sp ? ' · ' + esc(sp.name) : '') + (m.note ? ' · ' + esc(m.note) : '') + '</small></span><span class="end"><b>' + (m.qty > 0 ? '+' : '') + S.nf(m.qty) + '</b></span></div>'; };
  S.journal = () => ui.sheet({ title: 'Mouvements de stock', wide: true, html: db().movements.length ? '<div class="list">' + db().movements.slice(-100).reverse().map(moveRow).join('') + '</div>' : '<p class="muted">Aucun mouvement.</p>' });
  S.report = id => {
    const p = S.get(id); if (!p) return; const mv = db().movements.filter(m => m.pid === id).reverse(), qin = mv.filter(m => m.qty > 0).reduce((a, m) => a + m.qty, 0), qout = -mv.filter(m => m.qty < 0).reduce((a, m) => a + m.qty, 0), sp = S.supplier(p.supplierId);
    const rows = [['Code', p.code], ['Catégorie', p.cat], ['Référence', p.ref], ['Fournisseur', sp && sp.name], ['Prix d\'achat', p.cost ? M.main(p.cost) : ''], ['Prix de vente', p.price ? M.main(p.price) + ' (≈ ' + M.second(p.price) + ')' : ''], ['Marge unitaire', p.price && p.cost ? M.main(p.price - p.cost) : ''], ['Valeur du stock', S.tracked(p) ? M.main(S.value(p)) : ''], ...App.cf.show('products', p.fields)].filter(r => r[1]);
    ui.sheet({ title: p.name, wide: true, html: '<div class="stats"><div class="' + S.state(p) + '"><b>' + S.qty(p) + '</b><small>en stock (min ' + S.nf(p.min) + ')</small></div><div><b>' + S.nf(qin) + '</b><small>entré</small></div><div><b>' + S.nf(qout) + '</b><small>sorti</small></div></div><dl class="kv">' + rows.map(r => '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>').join('') + '</dl>' + (mv.length ? '<h4>Mouvements</h4><div class="list">' + mv.slice(0, 30).map(moveRow).join('') + '</div>' : ''),
      actions: [{ label: '＋ Entrée', cls: 'ghost', fn: () => { setTimeout(() => S.moveForm('in', id), 200); } }, { label: '－ Sortie', cls: 'ghost', fn: () => { setTimeout(() => S.moveForm('out', id), 200); } }, { label: 'Modifier', cls: 'primary', fn: () => { setTimeout(() => S.form(id), 200); } }] });
  };

  // ---------- screen ----------
  const st = { cat: '', f: 'all', q: '', byVal: false };
  const FILT = { all: ['Tous', () => true], in: ['En stock', p => S.tracked(p) && p.qty > 0], low: ['Stock bas', p => S.tracked(p) && p.qty <= (+p.min || 0)], out: ['Épuisés', p => S.tracked(p) && p.qty <= 0], ns: ['Sans suivi', p => !S.tracked(p)] };
  App.views.stock = {
    title: 'Stock',
    render(el, params) {
      const all = db().products, low = S.low(), total = all.reduce((a, p) => a + S.value(p), 0), cats = [...new Set(all.map(p => p.cat))].filter(Boolean), q = norm(st.q);
      const list = all.filter(p => (!st.cat || p.cat === st.cat) && FILT[st.f][1](p) && (!q || norm(p.name + ' ' + p.ref + ' ' + p.cat + ' ' + p.code).includes(q))).sort((a, b) => st.byVal ? S.value(b) - S.value(a) : norm(a.name).localeCompare(norm(b.name)));
      const row = p => { const it = '<div class="item" role="button" tabindex="0" data-id="' + p.id + '"><span class="av">' + esc(App.letterOf(p.name)) + '</span><span class="tx"><b>' + esc(p.name) + '</b><small>' + esc([p.cat, p.ref, p.price ? M.main(p.price) : ''].filter(Boolean).join(' · ')) + '</small></span><span class="end"><span class="pill ' + S.state(p) + '">' + S.qty(p) + '</span>' + (st.byVal && S.tracked(p) ? '<small>' + M.main(S.value(p)) + '</small>' : '') + '</span></div>'; return S.tracked(p) ? App.rowSwipe(2, '<button data-act data-in="' + p.id + '" aria-label="Entrée">＋</button><button data-act data-out="' + p.id + '" aria-label="Sortie">－</button>', it) : '<div class="swr" style="--n:0">' + it + '</div>'; };
      el.innerHTML = '<div class="page"><section class="hero"><small>Valeur du stock (prix d\'achat)</small><div class="amt">' + M.main(total) + '</div><div class="sub">≈ ' + M.second(total) + '</div></section>' +
        '<div class="stats card"><div><b>' + all.length + '</b><small>' + esc(App.vocab('product', true)) + '</small></div><div class="' + (low.length ? 'bad' : '') + '"><b>' + low.length + '</b><small>stock bas</small></div><div><b>' + all.filter(p => S.tracked(p) && p.qty <= 0).length + '</b><small>épuisés</small></div></div>' +
        (low.length && st.f === 'all' ? '<div class="warnbox">⚠ Stock bas : ' + low.slice(0, 6).map(p => esc(p.name) + ' (' + S.qty(p) + ')').join(', ') + (low.length > 6 ? '…' : '') + '</div>' : '') +
        '<div class="tools"><input type="search" id="pq" placeholder="Rechercher (nom, référence…)" value="' + esc(st.q) + '"></div>' +
        (cats.length > 1 ? '<div class="chips"><button data-c="" class="' + (!st.cat ? 'on' : '') + '">Toutes</button>' + cats.map(c => '<button data-c="' + esc(c) + '" class="' + (st.cat === c ? 'on' : '') + '">' + esc(c) + '</button>').join('') + '</div>' : '') +
        '<div class="chips">' + Object.entries(FILT).map(([k, v]) => '<button data-f="' + k + '" class="' + (st.f === k ? 'on' : '') + '">' + v[0] + '</button>').join('') + '<button id="byv" class="' + (st.byVal ? 'on' : '') + '">💰 Trier par valeur</button></div>' +
        (!all.length ? '<div class="empty"><div class="big">📦</div><h2>Aucun ' + esc(App.vocab('product')) + '</h2><p class="muted">Ajoutez le premier avec le bouton +.</p></div>' : '<div class="list">' + (list.map(row).join('') || '<p class="muted center">Aucun résultat.</p>') + '</div>') +
        '<div class="tools"><button class="btn primary" id="np">+ ' + esc(App.cap(App.vocab('product'))) + '</button><button class="btn ghost" id="sin">📥 Entrée</button><button class="btn ghost" id="sout">📤 Sortie</button></div>' +
        '<div class="tools"><button class="btn ghost" id="jr">🧾 Mouvements</button><button class="btn ghost" id="inv">📋 Inventaire</button><button class="btn ghost" id="ro">🛒 À commander' + (low.length ? ' (' + low.length + ')' : '') + '</button><button class="btn ghost" data-go="suppliers">🏭 Fournisseurs</button></div></div>';
      const redo = () => App.views.stock.render(el), pq = el.querySelector('#pq');
      pq.oninput = () => { st.q = pq.value; const p = pq.selectionStart; redo(); const n = el.querySelector('#pq'); n.focus(); n.setSelectionRange(p, p); };
      el.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { st.cat = b.dataset.c; redo(); }); el.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { st.f = b.dataset.f; redo(); });
      el.querySelector('#byv').onclick = () => { st.byVal = !st.byVal; redo(); };
      el.querySelectorAll('.item[data-id]').forEach(i => i.onclick = () => S.report(i.dataset.id));
      el.querySelectorAll('[data-in]').forEach(b => b.onclick = e => { e.stopPropagation(); S.moveForm('in', b.dataset.in); }); el.querySelectorAll('[data-out]').forEach(b => b.onclick = e => { e.stopPropagation(); S.moveForm('out', b.dataset.out); });
      el.querySelector('#np').onclick = () => S.form(); el.querySelector('#sin').onclick = () => S.moveForm('in'); el.querySelector('#sout').onclick = () => S.moveForm('out'); el.querySelector('#jr').onclick = S.journal;
      el.querySelector('#inv').onclick = () => S.inventory && S.inventory(); el.querySelector('#ro').onclick = () => S.reorder && S.reorder();
      if (params && params.add) S.form();
    }
  };
  App.quick[2].run = () => { App.go('stock'); setTimeout(() => S.form(), 30); };
})();
