// Import clients from Excel (.xlsx) or CSV: auto-mapped columns, comparison with existing clients (duplicates), preview, undo.
(function () {
  const App = window.App, ui = App.ui, esc = App.esc, C = App.clients, norm = C.norm, io = App.sheetio;
  const BASE = [['name', 'Nom', ['nom', 'noms', 'name', 'client', 'patient', 'eleve', 'colonne1']], ['phone', 'Téléphone', ['telephone', 'tel', 'phone', 'mobile', 'gsm', 'numero']], ['email', 'Courriel', ['email', 'mail', 'courriel']], ['address', 'Adresse', ['adresse', 'address', 'residence']], ['type', 'Type', ['type', 'categorie']], ['note', 'Note', ['note', 'observation', 'remarque', 'commentaire']]];
  const fields = () => [...BASE, ...App.db.settings.fields.clients.map(f => ['cf:' + f.id, f.label, [norm(f.label)]])];
  const text = c => c == null ? '' : typeof c === 'object' ? c.iso : String(c).trim();
  const fixName = s => { s = s.replace(/\s+/g, ' ').trim(); return s === s.toUpperCase() || s === s.toLowerCase() ? s.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()) : s; };
  const fixPhone = c => { let d = C.digits(c), dial = App.db.settings.dial || ''; if (dial && d.startsWith(dial) && d.length >= dial.length + 8) d = '0' + d.slice(dial.length); else if (d.length === 9 && /^[89]/.test(d)) d = '0' + d; return d; };
  const headerRow = rows => { const i = rows.findIndex(r => r.filter(c => typeof c === 'string' && c.trim()).length >= 2); return i < 0 ? 0 : i; };
  const autoMap = headers => { const map = {}, used = new Set(), n = headers.map(norm);
    fields().forEach(([k, , keys]) => { for (const key of keys) { const at = n.findIndex((h, i) => !used.has(i) && h && (h === key || h.split(' ').includes(key) || (key.length > 3 && h.includes(key)))); if (at >= 0) { map[k] = at; used.add(at); return; } } }); return map; };
  const im = { sheets: null, si: 0, hdr: 0, map: {}, mode: 'skip', name: '', err: '' };
  const setSheet = i => { im.si = i; const s = im.sheets[i]; im.hdr = headerRow(s.rows); im.map = autoMap((s.rows[im.hdr] || []).map(text)); };

  // rows → records, each tagged new / dup (existing client) / skip (empty or repeated in the file)
  const analyse = () => {
    const s = im.sheets[im.si], out = [], seenP = new Set(), seenN = new Set(), types = App.db.settings.clientTypes;
    s.rows.slice(im.hdr + 1).forEach(r => {
      const g = k => im.map[k] == null ? '' : text(r[im.map[k]]), name = fixName(g('name')); if (!name) return;
      const rec = { name, phone: fixPhone(g('phone')), email: g('email'), address: g('address'), note: g('note'), fields: {} };
      const ty = g('type'); rec.type = types.find(t => norm(t) === norm(ty)) || (ty || '');
      App.db.settings.fields.clients.forEach(f => { const v = g('cf:' + f.id); if (v) rec.fields[f.id] = v; });
      const ex = App.db.clients.find(c => (rec.phone && C.digits(c.phone) === rec.phone) || (!rec.phone && norm(c.name) === norm(name)));
      const rep = (rec.phone && seenP.has(rec.phone)) || (!rec.phone && seenN.has(norm(name))); rec.phone ? seenP.add(rec.phone) : seenN.add(norm(name));
      out.push({ rec, ex, st: rep ? 'skip' : ex ? 'dup' : 'new' });
    });
    return out;
  };
  const apply = items => {
    const added = [], updated = [], s = App.db.settings;
    items.forEach(({ rec, ex, st }) => {
      if (rec.type && !s.clientTypes.includes(rec.type)) s.clientTypes.push(rec.type);
      if (st === 'new' || (st === 'dup' && im.mode === 'add')) { const c = { id: App.uid(), code: C.nextCode(), created: App.today(), ...rec, type: rec.type || s.clientTypes[0] }; App.db.clients.push(c); added.push(c.id); }
      else if (st === 'dup' && im.mode === 'update') { updated.push({ id: ex.id, before: JSON.parse(JSON.stringify(ex)) }); ['name', 'phone', 'email', 'address', 'note', 'type'].forEach(k => { if (rec[k]) ex[k] = rec[k]; }); ex.fields = { ...ex.fields, ...rec.fields }; }
    });
    App.db.lastImport = { at: Date.now(), name: im.name, added, updated }; App.log('client.import', added.length + '+' + updated.length); App.save(); return App.db.lastImport;
  };
  const undo = () => {
    const li = App.db.lastImport; if (!li) return; const ids = new Set(li.added);
    App.db.clients = App.db.clients.filter(c => !ids.has(c.id)); li.updated.forEach(u => { const i = App.db.clients.findIndex(c => c.id === u.id); if (i >= 0) App.db.clients[i] = u.before; });
    App.db.lastImport = null; App.log('client.import.undo', ''); App.save(); App.render(); App.toast('Import annulé');
  };
  C.undoImport = undo;

  C.importSheet = () => {
    im.sheets = null; im.err = ''; im.mode = 'skip'; let sh;
    const draw = () => {
      const li = App.db.lastImport, b = sh.body;
      if (!im.sheets) { b.innerHTML = '<p>Choisissez un fichier Excel (.xlsx) ou CSV. Les colonnes sont reconnues automatiquement, comparées à vos ' + esc(App.vocab('client', true)) + ' existants, et rien n\'est créé avant votre confirmation.</p><label class="btn" style="display:inline-block;cursor:pointer">📄 Choisir le fichier<input type="file" id="imf" accept=".xlsx,.csv,.txt" hidden></label>' + (im.err ? '<p style="color:var(--bad)">' + esc(im.err) + '</p>' : '') + (li ? '<p class="muted">Dernier import : ' + li.added.length + ' ajouté(s), ' + li.updated.length + ' mis à jour. <button class="btn ghost sm" id="imu">Annuler cet import</button></p>' : ''); sh.q('footer') && (sh.q('footer').style.display = 'none'); }
      else {
        const s = im.sheets[im.si], hdrs = (s.rows[im.hdr] || []).map(text), items = analyse(), n = k => items.filter(x => x.st === k).length;
        b.innerHTML = '<b>' + esc(im.name) + '</b>' + (im.sheets.length > 1 ? ui.field('Feuille', '<select id="ims">' + im.sheets.map((x, i) => '<option value="' + i + '"' + (i === im.si ? ' selected' : '') + '>' + esc(x.name) + ' (' + x.rows.length + ' lignes)</option>').join('') + '</select>') : '') +
          '<div class="fld"><span>Colonnes</span><div class="row2">' + fields().map(([k, l]) => '<label class="fld"><span>' + esc(l) + '</span><select data-m="' + esc(k) + '"><option value="">— ignorer —</option>' + hdrs.map((h, i) => h ? '<option value="' + i + '"' + (im.map[k] === i ? ' selected' : '') + '>' + esc(h) + '</option>' : '').join('') + '</select></label>').join('') + '</div></div>' +
          '<p><b>' + n('new') + '</b> nouveau(x) · <b>' + n('dup') + '</b> déjà enregistré(s) · <b>' + n('skip') + '</b> répété(s) dans le fichier</p>' +
          (n('dup') ? ui.field('Pour les déjà enregistrés', ui.select('mode', [['skip', 'Les ignorer'], ['update', 'Mettre à jour leurs infos'], ['add', 'Les ajouter quand même']], im.mode)) : '') +
          '<table class="tbl"><tr><th></th><th>Nom</th><th>Téléphone</th></tr>' + items.slice(0, 8).map(x => '<tr class="' + (x.st === 'new' ? '' : 'dup') + '"><td>' + (x.st === 'new' ? '＋' : x.st === 'dup' ? '≈' : '×') + '</td><td>' + esc(x.rec.name) + '</td><td>' + esc(x.rec.phone) + '</td></tr>').join('') + '</table>' + (items.length > 8 ? '<p class="muted">… et ' + (items.length - 8) + ' autres lignes</p>' : '');
        const ft = sh.q('footer'); ft.style.display = ''; ft.querySelector('.primary').disabled = !(n('new') || (n('dup') && im.mode !== 'skip'));
        b.querySelectorAll('[data-m]').forEach(x => x.onchange = () => { x.value === '' ? delete im.map[x.dataset.m] : im.map[x.dataset.m] = +x.value; draw(); });
        const m = b.querySelector('[name=mode]'); m && (m.onchange = () => { im.mode = m.value; draw(); }); const se = b.querySelector('#ims'); se && (se.onchange = () => { setSheet(+se.value); draw(); });
      }
      const f = b.querySelector('#imf'); f && (f.onchange = async () => {
        const file = f.files[0]; if (!file) return; im.name = file.name; im.err = '';
        try {
          if (/\.xls$/i.test(file.name)) throw new Error('Format ancien (.xls) non lu : enregistrez-le en .xlsx ou CSV.');
          if (/\.(csv|txt)$/i.test(file.name)) im.sheets = io.readCsv(await file.text()); else { if (typeof DecompressionStream === 'undefined') throw new Error('Ce navigateur ne lit pas Excel : exportez en CSV.'); im.sheets = await io.readXlsx(await file.arrayBuffer()); }
          if (!im.sheets.length || !im.sheets.some(s => s.rows.length)) throw new Error('Le fichier est vide.'); setSheet(0);
        } catch (e) { im.sheets = null; im.err = e.message || 'Fichier illisible.'; } draw();
      });
      const u = b.querySelector('#imu'); u && (u.onclick = () => { undo(); sh.close(); });
    };
    sh = ui.sheet({ title: 'Importer des ' + App.vocab('client', true), wide: true, html: '', actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Importer', cls: 'primary', fn: () => {
      const items = analyse(), r = apply(items); App.render(); App.toast(r.added.length + ' ajouté(s)' + (r.updated.length ? ', ' + r.updated.length + ' mis à jour' : ''), '', { label: 'Annuler', fn: undo }); } }], onMount: s => { sh = s; draw(); } });
  };
})();
