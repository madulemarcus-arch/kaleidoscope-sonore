// Clients (vocabulary adapts: patient, élève…): A–Z list, global search, profile sheet, quick actions, custom fields, multi-delete with undo.
(function () {
  const App = window.App, ui = App.ui, esc = App.esc, norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const C = App.clients = {}, db = () => App.db.clients, digits = s => String(s || '').replace(/\D/g, '');
  C.norm = norm; C.digits = digits;
  C.get = id => db().find(c => c.id === id);
  C.nextCode = () => { const q = App.db.settings.seq; q.client = (q.client || 0) + 1; return 'CL-' + String(q.client).padStart(4, '0'); };
  C.initial = c => App.letterOf(c.name);
  // phone → international digits for wa.me (0xx… → country code + xx…)
  C.intl = p => { let d = digits(p); const dial = App.db.settings.dial || ''; if (d.startsWith('00')) d = d.slice(2); else if (d.startsWith('0') && dial) d = dial + d.slice(1); return d; };
  C.extras = []; // other modules push (client) => html shown on the profile (invoices, balance…)

  // ---------- custom fields (clients / products / invoices) ----------
  App.cf = {
    html(entity, vals) {
      return (App.db.settings.fields[entity] || []).map(f => ui.field(f.label, f.type === 'list' ? ui.select('cf_' + f.id, [['', '—'], ...String(f.options || '').split(',').map(x => x.trim()).filter(Boolean)], (vals || {})[f.id] || '') : ui.input('cf_' + f.id, (vals || {})[f.id], { type: f.type === 'date' ? 'date' : '', num: f.type === 'number' }))).join('');
    },
    read(entity, root) { const o = {}, v = ui.read(root); (App.db.settings.fields[entity] || []).forEach(f => { const x = v['cf_' + f.id]; if (x !== '' && x != null && x !== 0) o[f.id] = x; }); return o; },
    show(entity, vals) { return (App.db.settings.fields[entity] || []).filter(f => (vals || {})[f.id] != null).map(f => [f.label, f.type === 'date' ? App.fmtDate(vals[f.id]) : vals[f.id]]); }
  };

  // ---------- global search: clients (name, code, phone, custom fields) + products, suppliers, invoices ----------
  App.search = q => {
    const n = norm(q), d = digits(q), has = (...xs) => xs.some(x => norm(x).includes(n)), r = { clients: [], products: [], suppliers: [], invoices: [] };
    if (!n) return r;
    r.clients = db().filter(c => has(c.name, c.code, c.email, c.address, c.note, ...Object.values(c.fields || {})) || (/^[\d\s+().-]+$/.test(q) && d.length > 2 && digits(c.phone).includes(d)));
    r.products = App.db.products.filter(p => has(p.name, p.code, p.ref, p.cat));
    r.suppliers = App.db.suppliers.filter(s => has(s.name, s.phone, s.contact));
    r.invoices = App.db.invoices.filter(i => has(i.number, i.clientName, i.ref));
    return r;
  };

  // ---------- form ----------
  C.form = (id, done) => {
    const c = id ? C.get(id) : null, s = App.db.settings, v = App.vocab('client'), types = s.clientTypes.length ? s.clientTypes : ['Particulier'];
    ui.sheet({ title: c ? 'Modifier — ' + c.name : 'Nouveau ' + v, wide: true,
      html: ui.field('Nom *', ui.input('name', c && c.name)) + '<div class="row2">' + ui.field('Type', ui.select('type', types, c ? c.type : types[0])) + ui.field('Téléphone', ui.input('phone', c && c.phone, { tel: 1 })) + '</div>' +
        '<div class="row2">' + ui.field('Courriel', ui.input('email', c && c.email, { type: 'email' })) + ui.field('Adresse', ui.input('address', c && c.address)) + '</div>' + App.cf.html('clients', c && c.fields) + ui.field('Note', '<textarea name="note" rows="2">' + esc(c ? c.note : '') + '</textarea>'),
      actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Enregistrer', cls: 'primary', fn: sh => {
        const f = ui.read(sh.body); if (!f.name) { App.toast('Le nom est obligatoire', 'err'); return false; }
        const dup = f.phone && db().find(x => x.id !== (c && c.id) && digits(x.phone) && digits(x.phone) === digits(f.phone));
        if (dup && !sh._okdup) { App.toast('Ce numéro existe déjà : ' + dup.name + '. Appuyez encore pour confirmer.', 'err'); sh._okdup = true; return false; }
        const rec = { name: f.name.replace(/\s+/g, ' '), type: f.type, phone: f.phone, email: f.email, address: f.address, note: f.note, fields: App.cf.read('clients', sh.body) };
        if (c) Object.assign(c, rec); else db().push({ id: App.uid(), code: C.nextCode(), created: App.today(), ...rec });
        App.log(c ? 'client.edit' : 'client.add', rec.name); App.save(); App.toast(c ? 'Enregistré' : App.cap(v) + ' ajouté'); done ? done() : App.render();
      } }] });
  };

  // ---------- delete with undo ----------
  C.remove = ids => {
    const gone = db().filter(c => ids.includes(c.id)); if (!gone.length) return;
    App.db.clients = db().filter(c => !ids.includes(c.id)); App.log('client.delete', gone.length + ''); App.save(); App.render();
    App.toast(gone.length + ' supprimé' + (gone.length > 1 ? 's' : ''), '', { label: 'Annuler', fn: () => { App.db.clients.push(...gone); App.log('client.undelete', gone.length + ''); App.save(); App.render(); } });
  };

  // ---------- profile ----------
  C.profile = id => {
    const c = C.get(id); if (!c) return; const wa = C.intl(c.phone);
    const rows = [['Code', c.code], ['Type', c.type], ['Téléphone', c.phone], ['Courriel', c.email], ['Adresse', c.address], ['Depuis le', App.fmtDate(c.created)], ...App.cf.show('clients', c.fields), ['Note', c.note]].filter(r => r[1]);
    const sh = ui.sheet({ title: c.name, wide: true, html: '<div class="tools">' + (c.phone ? '<a class="btn ghost" href="tel:' + esc(digits(c.phone)) + '">📞 Appeler</a><a class="btn ghost" target="_blank" rel="noopener" href="https://wa.me/' + wa + '">💬 WhatsApp</a><button class="btn ghost" data-copy>📋 Copier</button>' : '') + '</div><dl class="kv">' + rows.map(r => '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>').join('') + '</dl>' + C.extras.map(fn => fn(c) || '').join(''),
      actions: [{ label: 'Supprimer', cls: 'danger', fn: async s => { if (await ui.confirm('Supprimer ' + c.name + ' ?', 'Supprimer', true)) { s.close(); C.remove([c.id]); } return false; } }, { label: 'Modifier', cls: 'primary', fn: () => { setTimeout(() => C.form(c.id), 200); } }] });
    const cp = sh.q('[data-copy]'); if (cp) cp.onclick = () => { (navigator.clipboard ? navigator.clipboard.writeText(c.name + ' ' + c.phone) : Promise.reject()).then(() => App.toast('Copié'), () => App.toast('Copie impossible', 'err')); };
  };

  // ---------- screen ----------
  const st = { q: '', type: '', sel: null };
  const row = c => {
    const body = (st.sel ? '<input type="checkbox" ' + (st.sel.has(c.id) ? 'checked' : '') + ' aria-label="Choisir">' : '') + '<span class="av">' + esc(C.initial(c)) + '</span><span class="tx"><b>' + esc(c.name) + '</b><small>' + esc([c.code, c.phone, c.type].filter(Boolean).join(' · ')) + '</small></span>';
    const item = '<div class="item" role="button" tabindex="0" data-id="' + c.id + '">' + body + '</div>';
    if (st.sel || !c.phone) return '<div class="swr" style="--n:0">' + item + '</div>';
    return App.rowSwipe(3, '<a href="tel:' + esc(digits(c.phone)) + '" data-act aria-label="Appeler">📞</a><a href="https://wa.me/' + C.intl(c.phone) + '" target="_blank" rel="noopener" data-act aria-label="WhatsApp">💬</a><button data-act data-cp="' + c.id + '" aria-label="Copier">📋</button>', item);
  };
  App.views.clients = {
    title: 'Clients',
    render(el, params) {
      const v = App.vocab('client', true), all = db().slice().sort((a, b) => norm(a.name).localeCompare(norm(b.name), 'fr')), q = st.q;
      let list = all.filter(c => (!st.type || c.type === st.type)), other = null;
      if (q) { const r = App.search(q); const ids = new Set(r.clients.map(c => c.id)); list = list.filter(c => ids.has(c.id)); other = r; }
      let html = '<div class="page"><div class="tools"><input type="search" id="cq" placeholder="Rechercher (nom, code, téléphone…)" value="' + esc(q) + '" aria-label="Rechercher"><button class="btn ghost" id="csel">' + (st.sel ? 'Terminer' : 'Sélectionner') + '</button><button class="btn ghost" id="cimp">Importer</button></div>';
      if (App.db.settings.clientTypes.length > 1) html += '<div class="chips"><button data-t="" class="' + (!st.type ? 'on' : '') + '">Tous (' + all.length + ')</button>' + App.db.settings.clientTypes.map(t => '<button data-t="' + esc(t) + '" class="' + (st.type === t ? 'on' : '') + '">' + esc(t) + '</button>').join('') + '</div>';
      if (!all.length) html += '<div class="empty"><div class="big">👥</div><h2>Aucun ' + esc(App.vocab('client')) + '</h2><p class="muted">Ajoutez le premier avec le bouton +, ou importez un fichier Excel / CSV.</p></div>';
      else if (!list.length) html += '<p class="muted center">Aucun résultat dans les ' + esc(v) + '.</p>';
      else { let last = ''; const letters = []; html += '<div class="list">' + list.map(c => { const L = C.initial(c); let h = ''; if (L !== last) { last = L; letters.push(L); h = '<div class="lhd" id="L' + (L === '#' ? 'x' : L) + '">' + L + '</div>'; } return h + row(c); }).join('') + '</div>' + (list.length > 12 && !q ? '<nav class="index" aria-label="Index">' + letters.map(L => '<button data-l="' + (L === '#' ? 'x' : L) + '">' + L + '</button>').join('') + '</nav>' : ''); }
      if (other) { const rows = [['products', 'Produits', 'stock'], ['suppliers', 'Fournisseurs', 'stock'], ['invoices', 'Factures', 'sales']].filter(g => other[g[0]].length); if (rows.length) html += '<section class="card"><h3>Autres résultats</h3>' + rows.map(g => '<div><b>' + g[1] + '</b> : ' + other[g[0]].slice(0, 5).map(x => esc(x.name || x.number)).join(', ') + '</div>').join('') + '</section>'; }
      if (st.sel) html += '<div class="selbar"><span>' + st.sel.size + ' sélectionné(s)</span><span><button class="btn ghost" id="sall">Tout</button> <button class="btn danger" id="sdel"' + (st.sel.size ? '' : ' disabled') + '>Supprimer</button></span></div>';
      el.innerHTML = html + '</div>';
      const redo = () => App.views.clients.render(el), cq = el.querySelector('#cq');
      cq.oninput = () => { st.q = cq.value; const p = cq.selectionStart; redo(); const n = el.querySelector('#cq'); n.focus(); n.setSelectionRange(p, p); };
      el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { st.type = b.dataset.t; redo(); });
      el.querySelector('#csel').onclick = () => { st.sel = st.sel ? null : new Set(); redo(); };
      el.querySelector('#cimp').onclick = () => App.clients.importSheet && App.clients.importSheet();
      el.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { const h = el.querySelector('#L' + b.dataset.l); h && h.scrollIntoView({ block: 'start' }); });
      el.querySelectorAll('.item[data-id]').forEach(it => it.onclick = () => { const id = it.dataset.id; if (st.sel) { st.sel.has(id) ? st.sel.delete(id) : st.sel.add(id); const y = scrollY; redo(); scrollTo(0, y); } else C.profile(id); });
      el.querySelectorAll('[data-cp]').forEach(b => b.onclick = e => { e.stopPropagation(); const c = C.get(b.dataset.cp); (navigator.clipboard ? navigator.clipboard.writeText(c.phone) : Promise.reject()).then(() => App.toast('Numéro copié'), () => App.toast('Copie impossible', 'err')); });
      if (st.sel) { el.querySelector('#sall').onclick = () => { list.forEach(c => st.sel.add(c.id)); redo(); }; el.querySelector('#sdel').onclick = async () => { const ids = [...st.sel]; if (ids.length && await ui.confirm('Supprimer ' + ids.length + ' ' + App.vocab('client', ids.length > 1) + ' ?', 'Supprimer', true)) { st.sel = null; C.remove(ids); } }; }
      if (params && params.add) C.form();
    }
  };
  const orig = App.quick[0]; orig.run = () => { App.go('clients'); setTimeout(() => C.form(), 30); }; // "+" opens the form directly
  App.on('save', () => { /* keep lists fresh when sync merges data */ });
})();
