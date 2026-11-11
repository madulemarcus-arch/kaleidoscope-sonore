// UI wiring: canvas sizing, toolbar, layers and properties panels, status bar, file menu, service worker.
(function () {
  const A = window.App, $ = id => document.getElementById(id), cv = $('cv'), ctx = cv.getContext('2d');
  let W = 0, H = 0, raf = 0;

  // ---------- canvas ----------
  const resize = () => { const r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2); const nw = Math.max(1, Math.round(r.width)), nh = Math.max(1, Math.round(r.height));
    if (W) { A.view.ox += (nw - W) / 2; A.view.oy += (nh - H) / 2; } W = nw; H = nh; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); A.redraw(); };
  const paint = () => { raf = 0; if (!A.doc) return; A.render(ctx, W, H, A.view, 'screen', { sel: A.sel, pv: A.pv, snap: A.snapInfo, grid: A.opts.grid || true, struct: A.doc.struct.show !== false }); };
  A.redraw = () => { if (!raf) raf = requestAnimationFrame(paint); };
  A.fitView = () => { A.fit(W, H); A.redraw(); };
  new ResizeObserver(() => { if (A.mode === '3d') A.v3.resize(); else resize(); }).observe($('stage'));

  // ---------- toolbar + toggles ----------
  const tools = $('tools');
  A.TOOLS.forEach(([id, name, key]) => { const b = document.createElement('button'); b.dataset.tool = id; b.title = name + ' (' + key + ')'; b.innerHTML = `${name}<small>${key}</small>`; b.onclick = () => A.setTool(id); tools.appendChild(b); });
  [['tGrid', 'grid'], ['tSnap', 'snap'], ['tOrtho', 'ortho']].forEach(([id, k]) => { $(id).onclick = () => { A.opts[k] = !A.opts[k]; A.emit(); }; });
  $('undo').onclick = () => A.undo(); $('redo').onclick = () => A.redo(); $('fit').onclick = () => A.fitView();
  $('panelBtn').onclick = () => { const o = $('panel').classList.toggle('open'); $('panelBtn').setAttribute('aria-pressed', o); };
  $('lenBtn').onclick = () => { const s = prompt(A.tool === 'rect' ? 'Dimensions en mètres (ex. 4x3) :' : 'Longueur en mètres :'); if (s) A.commitTyped(s); };
  $('docName').onchange = e => A.edit(d => { d.name = e.target.value.trim() || 'Sans titre'; });

  // ---------- 2D / 3D mode ----------
  const cv3 = $('cv3'); let first3 = true;
  A.mode = '2d';
  A.setMode = m => {
    if (m === A.mode) return;
    if (m === '3d') { A.cancel(); if (!A.v3.init(cv3)) { alert('La vue 3D demande WebGL, absent de ce navigateur.'); return; } A.mode = '3d'; if (first3) { A.v3.initInput(cv3); first3 = false; } }
    else A.mode = '2d';
    const d3 = A.mode === '3d'; document.body.dataset.mode = A.mode; cv.hidden = d3; cv3.hidden = !d3; $('bar3').hidden = !d3;
    $('mode2').setAttribute('aria-pressed', String(!d3)); $('mode3').setAttribute('aria-pressed', String(d3));
    if (d3) { A.v3.rebuild(); A.v3.resize(); A.v3.preset('iso'); const none = !A.v3.mesh.stats.walls; $('msg3').hidden = !none; $('msg3').textContent = 'Aucun mur à afficher : dessinez d\'abord en 2D.'; }
    else { $('msg3').hidden = true; resize(); }
    A.emit(); drawRender();
  };
  $('mode2').onclick = () => A.setMode('2d'); $('mode3').onclick = () => A.setMode('3d');
  $('bar3').onclick = e => { const v = e.target.dataset && e.target.dataset.v; if (!v) return; if (v === 'png') A.v3.snapshot(2, b => A.download((A.doc.name || 'plan').replace(/[^\w\-]+/g, '-') + '-3d.png', b)); else if (v === 'panel') $('panel3').classList.toggle('open'); else A.v3.preset(v); };

  // ---------- furniture picker (header, visible with the Meuble tool) ----------
  const fs = $('furnSel'); Object.keys(A.FURN).forEach(k => { const o = document.createElement('option'); o.value = k; o.textContent = A.FURN[k][0]; fs.appendChild(o); });
  fs.onchange = () => { A.furnKind = fs.value; A.updatePreview(); A.redraw(); }; fs.value = A.furnKind;

  // ---------- 3D rendering panel (materials, roof, sun) ----------
  const p3 = $('panel3');
  const opts = (table, cur) => Object.keys(table).map(k => `<option value="${k}"${k === cur ? ' selected' : ''}>${esc(Array.isArray(table[k]) ? table[k][0] : table[k])}</option>`).join('');
  function drawRender() {
    if (A.mode !== '3d') return; const a = document.activeElement; if (p3.contains(a) && a.type === 'range') return; const r = A.doc.render, hh = Math.floor(r.hour), mm = Math.round((r.hour - hh) * 60);
    p3.innerHTML = `<section><h2>Matériaux</h2><label class="row"><span>Murs</span><select data-k="wallMat">${opts(A.MATS, r.wallMat)}</select></label><label class="row"><span>Sol</span><select data-k="floorMat">${opts(A.FLOORS, r.floorMat)}</select></label>
      <p class="muted">Un mur précis peut avoir son propre matériau : sélectionnez-le en 2D.</p></section>
      <section><h2>Toiture</h2><label class="row"><span>Type</span><select data-k="roof">${opts(A.ROOFS, r.roof)}</select></label>
      <label class="row"><span>Matériau</span><select data-k="roofMat">${opts(A.ROOFMATS, r.roofMat)}</select></label>
      <label class="row"><span>Pente (°)</span><input type="number" data-k="slope" min="5" max="60" step="1" value="${r.slope}"></label>
      <label class="row"><span>Débord (m)</span><input type="number" data-k="over" min="0" max="2" step="0.1" value="${r.over}"></label></section>
      <section><h2>Soleil</h2><label class="row"><span>Heure</span><b id="hourTxt">${hh} h ${String(mm).padStart(2, '0')}</b></label><input type="range" data-k="hour" min="6" max="18" step="0.25" value="${r.hour}" aria-label="Heure du soleil">
      <label class="chk"><input type="checkbox" data-k="shadows"${r.shadows ? ' checked' : ''}> Ombres portées</label></section>
      <section><h2>Structure</h2><label class="chk"><input type="checkbox" data-k="structure"${r.structure ? ' checked' : ''}> Poteaux et poutres</label></section>`;
  }
  p3.onchange = e => { const k = e.target.dataset.k; if (!k) return; let v = e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'number' || e.target.type === 'range' ? parseFloat(e.target.value) : e.target.value;
    if (typeof v === 'number' && !isFinite(v)) return; if (k === 'slope') v = Math.max(5, Math.min(60, v)); if (k === 'over') v = Math.max(0, Math.min(2, v)); A.edit(d => { d.render[k] = v; }); };
  p3.oninput = e => { if (e.target.dataset.k !== 'hour') return; const v = parseFloat(e.target.value); A.doc.render.hour = v; const hh = Math.floor(v); $('hourTxt').textContent = `${hh} h ${String(Math.round((v - hh) * 60)).padStart(2, '0')}`; A.v3.draw(); };

  // ---------- file menu ----------
  const menu = $('menu'), closeMenu = () => { menu.hidden = true; $('menuBtn').setAttribute('aria-expanded', 'false'); };
  $('menuBtn').onclick = e => { e.stopPropagation(); menu.hidden = !menu.hidden; $('menuBtn').setAttribute('aria-expanded', String(!menu.hidden)); };
  document.addEventListener('click', e => { if (!menu.contains(e.target)) closeMenu(); });
  menu.onclick = e => { const act = e.target.dataset && e.target.dataset.act; if (!act) return; closeMenu();
    if (act === 'new') { if (!A.doc.items.length || confirm('Effacer le plan actuel ? (Annuler n\'est plus possible après.)')) { A.setDoc(A.newDoc()); A.fitView(); } }
    else if (act === 'open') $('file').click(); else if (act === 'save') A.exportJSON(); else if (act === 'dxf') A.exportDXF();
    else if (act === 'png') { if (!A.exportPNG()) alert('Le plan est vide.'); } };
  $('file').onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader();
    r.onload = () => { try { A.importJSON(String(r.result)); A.fitView(); } catch (err) { alert('Impossible d\'ouvrir ce fichier : ' + err.message); } }; r.readAsText(f); e.target.value = ''; };

  // ---------- layers panel ----------
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function drawLayers() {
    const box = $('layers'); box.innerHTML = '';
    A.doc.layers.forEach(l => { const row = document.createElement('div'); row.className = 'layer';
      row.innerHTML = `<button data-k="on" title="Afficher / masquer" aria-pressed="${l.on}">${l.on ? '◉' : '○'}</button><button data-k="lock" title="Verrouiller" aria-pressed="${l.lock}">${l.lock ? '🔒' : '🔓'}</button>` +
        `<button class="nm ${A.doc.active === l.id ? 'on' : ''}" data-k="act" title="Calque actif : les nouveaux éléments y vont">${esc(l.name)}</button><input type="color" data-k="col" value="${l.color}" aria-label="Couleur de ${esc(l.name)}">`;
      row.onclick = e => { const k = e.target.dataset.k; if (!k || k === 'col') return; A.edit(d => { const x = d.layers.find(q => q.id === l.id); if (k === 'on') x.on = !x.on; else if (k === 'lock') x.lock = !x.lock; else d.active = l.id; }); };
      row.querySelector('[data-k=col]').onchange = e => A.edit(d => { d.layers.find(q => q.id === l.id).color = e.target.value; });
      box.appendChild(row); });
  }
  $('addLayer').onclick = () => { const n = prompt('Nom du calque :'); if (n && n.trim()) A.edit(d => { const id = 'c' + A.uid(); d.layers.push({ id, name: n.trim(), color: '#9be29b', on: true, lock: false }); d.active = id; }); };

  // ---------- structure panel (BAEL pre-sizing) ----------
  const sb = $('structBox'), USAGES = { 'Logement': 1.5, 'Bureaux, école, hôpital': 2.5, 'Commerce': 5.0 };
  function drawStruct() {
    const p = A.doc.struct.p, r = A.doc.struct.result, o = (list, cur) => list.map(v => `<option value="${v}"${String(v) === String(cur) ? ' selected' : ''}>${v}</option>`).join(''), num = (k, label, step, min, max) => `<label class="row"><span>${label}</span><input type="number" data-s="${k}" step="${step}" min="${min}" max="${max}" value="${p[k]}"></label>`;
    const usage = Object.keys(USAGES).find(k => USAGES[k] === p.Q);
    let h = `<label class="row"><span>Béton fc28 (MPa)</span><select data-s="fc28">${o([20, 25, 30, 35], p.fc28)}</select></label><label class="row"><span>Acier HA FeE</span><select data-s="fe">${o([400, 500], p.fe)}</select></label>` +
      num('sigSol', 'Sol admissible (MPa)', 0.05, 0.05, 1) + num('nlev', 'Niveaux (planchers)', 1, 1, 8) +
      `<label class="row"><span>Plancher haut</span><select data-s="top"><option value="dalle"${p.top === 'dalle' ? ' selected' : ''}>Dalle terrasse</option><option value="charpente"${p.top === 'charpente' ? ' selected' : ''}>Charpente légère</option></select></label>` +
      `<label class="row"><span>Usage</span><select data-u="1">${Object.keys(USAGES).map(k => `<option${k === usage ? ' selected' : ''}>${k}</option>`).join('')}${usage ? '' : '<option selected>Personnalisé</option>'}</select></label>` +
      num('Q', 'Q planchers (kN/m²)', 0.5, 0.5, 10) + num('G2', 'G revêtements (kN/m²)', 0.5, 0, 10) + num('maxSpan', 'Portée max. auto (m)', 0.5, 2, 8) +
      `<label class="chk"><input type="checkbox" data-s="show"${A.doc.struct.show !== false ? ' checked' : ''}> Afficher les résultats sur le plan</label>` +
      `<button class="wide" data-act="autocol">Placer les poteaux automatiquement</button><button class="wide" data-act="calc">Calculer</button>`;
    if (r) { if (r.errors.length) h += `<p class="muted">${esc(r.errors.join(' '))}</p>`; else { const stale = A.struct.stale();
      h += `<p class="muted">${stale ? '<b>Résultats périmés : le plan a changé, relancez le calcul.</b><br>' : ''}${r.columns.length} poteaux, ${r.beams.length} poutres${r.slab ? ', dalle de ' + Math.round(r.slab.h * 100) + ' cm' : ''}. Charge totale : ${A.fmt(r.totals.Nu, 0)} kN (ELU).</p>` + r.warnings.map(w => `<p class="muted">⚠ ${esc(w)}</p>`).join('') +
        `<button class="wide" data-act="apply">Appliquer les sections aux poteaux</button><button class="wide" data-act="report">Note de calcul (fichier HTML)</button>`; } }
    else h += '<p class="muted">Posez des poteaux (touche P) sur les coins et le long des murs, puis lancez le calcul. Pré-dimensionnement BAEL à valider par un ingénieur.</p>';
    sb.innerHTML = h + '<p class="muted">Pré-dimensionnement automatique (BAEL 91 rév. 99) : à vérifier et valider par un ingénieur structure avant toute exécution.</p>';
  }
  sb.onchange = e => { const t = e.target; if (t.dataset.u) { const q = USAGES[t.value]; if (q) A.edit(d => { d.struct.p.Q = q; }); return; } const k = t.dataset.s; if (!k) return;
    if (k === 'show') { A.edit(d => { d.struct.show = t.checked; }); return; } const v = parseFloat(t.value); if (!isFinite(v)) { A.emit(); return; } A.edit(d => { d.struct.p[k] = k === 'nlev' ? Math.max(1, Math.min(8, Math.round(v))) : v; }); };
  sb.onclick = e => { const act = e.target.dataset && e.target.dataset.act; if (!act) return;
    if (act === 'autocol') { const n = A.struct.autoColumns(); if (!n) alert('Aucun nouveau poteau à placer (dessinez d\'abord des murs).'); }
    else if (act === 'calc') A.struct.run();
    else if (act === 'apply') { const r = A.doc.struct.result; if (r) A.edit(d => r.columns.forEach(c => { const it = d.items.find(i => i.id === c.id); if (it) it.a = c.a; })); }
    else if (act === 'report') { const html = A.struct.report(A.doc); if (html) A.download((A.doc.name || 'plan').replace(/[^\w\-]+/g, '-') + '-note-de-calcul.html', new Blob([html], { type: 'text/html' })); } };

  // ---------- properties panel ----------
  function field(label, value, step, set, min) { const r = document.createElement('label'); r.className = 'row'; r.innerHTML = `<span>${label}</span>`; const i = document.createElement('input'); i.type = 'number'; i.step = step; i.min = min == null ? 0.01 : min; i.value = Math.round(value * 1000) / 1000;
    i.onchange = () => { const v = parseFloat(i.value); if (isFinite(v) && v >= i.min) A.edit(set.bind(null, v)); else A.emit(); }; r.appendChild(i); return r; }
  function drawProps() {
    const box = $('props'); box.innerHTML = ''; const sel = A.sel.map(A.item).filter(Boolean);
    if (!sel.length) { $('propsTitle').textContent = 'Réglages des murs'; box.appendChild(field('Épaisseur (m)', A.doc.defaults.th, 0.01, (v, d) => { d.defaults.th = v; }));
      box.appendChild(field('Hauteur (m)', A.doc.defaults.h, 0.05, (v, d) => { d.defaults.h = v; })); const m = document.createElement('p'); m.className = 'muted'; m.textContent = 'Valables pour les prochains murs. Sélectionnez un élément pour modifier ses propriétés.'; box.appendChild(m); return; }
    const names = { wall: 'Mur', line: 'Ligne', door: 'Porte', window: 'Fenêtre', dim: 'Cote', text: 'Texte', furn: 'Meuble', col: 'Poteau', beam: 'Poutre' };
    $('propsTitle').textContent = sel.length > 1 ? sel.length + ' éléments' : names[sel[0].t];
    const each = (fn) => d => sel.forEach(s => fn(d.items.find(i => i.id === s.id)));
    if (sel.length === 1) { const it = sel[0];
      if (it.t === 'wall') { box.appendChild(field('Épaisseur (m)', it.th, 0.01, (v, d) => { d.items.find(i => i.id === it.id).th = v; })); box.appendChild(field('Hauteur (m)', it.h, 0.05, (v, d) => { d.items.find(i => i.id === it.id).h = v; }));
        const r = document.createElement('label'); r.className = 'row'; r.innerHTML = '<span>Matériau</span>'; const ms = document.createElement('select'); ms.innerHTML = '<option value="">Par défaut</option>' + Object.keys(A.MATS).map(k => `<option value="${k}"${it.mat === k ? ' selected' : ''}>${esc(A.MATS[k][0])}</option>`).join('');
        ms.onchange = () => A.edit(d => { const x = d.items.find(i => i.id === it.id); if (ms.value) x.mat = ms.value; else delete x.mat; }); r.appendChild(ms); box.appendChild(r);
        const p = document.createElement('p'); p.className = 'muted'; p.textContent = 'Longueur : ' + A.fmt(A.dist(it.a, it.b)) + ' m'; box.appendChild(p); }
      if (it.t === 'furn') { const r = document.createElement('label'); r.className = 'row'; r.innerHTML = '<span>Type</span>'; const ks = document.createElement('select'); ks.innerHTML = Object.keys(A.FURN).map(k => `<option value="${k}"${it.kind === k ? ' selected' : ''}>${esc(A.FURN[k][0])}</option>`).join('');
        ks.onchange = () => A.edit(d => { d.items.find(i => i.id === it.id).kind = ks.value; }); r.appendChild(ks); box.appendChild(r);
        [['Largeur (m)', 'w', 0.05, 0.05], ['Profondeur (m)', 'd', 0.05, 0.05], ['Hauteur (m)', 'h', 0.05, 0.02]].forEach(([l, k, st, mn]) => box.appendChild(field(l, it[k], st, (v, d) => { d.items.find(i => i.id === it.id)[k] = v; }, mn)));
        box.appendChild(field('Rotation (°)', it.rot || 0, 5, (v, d) => { d.items.find(i => i.id === it.id).rot = v % 360; }, 0)); }
      if (it.t === 'col') box.appendChild(field('Section (m)', it.a, 0.05, (v, d) => { d.items.find(i => i.id === it.id).a = v; }));
      if (it.t === 'line' || it.t === 'dim' || it.t === 'beam') { const p = document.createElement('p'); p.className = 'muted'; p.textContent = 'Longueur : ' + A.fmt(A.dist(it.a, it.b)) + ' m'; box.appendChild(p); }
      if (A.isOpening(it)) { box.appendChild(field('Largeur (m)', it.w, 0.05, (v, d) => { d.items.find(i => i.id === it.id).w = v; })); box.appendChild(field('Hauteur (m)', it.h, 0.05, (v, d) => { d.items.find(i => i.id === it.id).h = v; }));
        box.appendChild(field('Allège (m)', it.sill, 0.05, (v, d) => { d.items.find(i => i.id === it.id).sill = v; }, 0));
        const r = document.createElement('div'); r.className = 'row btns'; [['flip', 'Inverser le côté'], ['mirror', it.t === 'door' ? 'Charnière' : null]].forEach(([k, t]) => { if (!t) return; const b = document.createElement('button'); b.textContent = t; b.onclick = () => A.edit(d => { const x = d.items.find(i => i.id === it.id); x[k] = !x[k]; }); r.appendChild(b); }); box.appendChild(r); }
      if (it.t === 'text') { const r = document.createElement('label'); r.className = 'row'; r.innerHTML = '<span>Texte</span>'; const i = document.createElement('input'); i.value = it.s; i.onchange = () => i.value.trim() ? A.edit(d => { d.items.find(x => x.id === it.id).s = i.value.trim(); }) : A.emit(); r.appendChild(i); box.appendChild(r);
        box.appendChild(field('Taille (m)', it.size, 0.05, (v, d) => { d.items.find(i => i.id === it.id).size = v; })); } }
    if (!sel.some(A.isOpening)) { const r = document.createElement('label'); r.className = 'row'; r.innerHTML = '<span>Calque</span>'; const s = document.createElement('select');
      A.doc.layers.forEach(l => { const o = document.createElement('option'); o.value = l.id; o.textContent = l.name; if (sel.every(x => x.layer === l.id)) o.selected = true; s.appendChild(o); });
      if (!sel.every(x => x.layer === sel[0].layer)) s.insertAdjacentHTML('afterbegin', '<option selected disabled>—</option>');
      s.onchange = () => A.edit(each(x => { x.layer = s.value; })); r.appendChild(s); box.appendChild(r); }
    const del = document.createElement('button'); del.className = 'wide'; del.textContent = 'Supprimer (Suppr)'; del.onclick = () => { A.edit(() => A.removeIds(A.sel)); A.sel = []; A.emit(); }; box.appendChild(del);
  }

  // ---------- status + global refresh ----------
  A.status = () => { if (A.mode === '3d') { $('coords').textContent = ''; $('hint').textContent = 'Glissez pour tourner · Maj ou clic droit + glisser : déplacer · molette ou deux doigts : zoom'; return; } const p = A.raw || [0, 0]; $('coords').textContent = `x ${A.fmt(p[0])} · y ${A.fmt(p[1])} m · ${A.fmt(A.view.s, 0)} px/m`;
    $('hint').textContent = A.typed ? `Saisie : ${A.typed} (Entrée pour valider)` : A.hint(); };
  A.on(() => {
    tools.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === A.tool)));
    $('tGrid').setAttribute('aria-pressed', A.opts.grid); $('tSnap').setAttribute('aria-pressed', A.opts.snap); $('tOrtho').setAttribute('aria-pressed', A.opts.ortho);
    $('undo').disabled = !A.canUndo(); $('redo').disabled = !A.canRedo(); $('lenBtn').hidden = !(A.pts.length && (A.tool === 'wall' || A.tool === 'line' || A.tool === 'rect'));
    if (document.activeElement !== $('docName')) $('docName').value = A.doc.name;
    if (!A.doc.layers.some(l => l.id === A.doc.active)) A.doc.active = A.doc.layers[0].id;
    $('furnSel').hidden = A.tool !== 'furn'; if (document.activeElement !== fs) fs.value = A.furnKind;
    drawLayers(); drawProps(); drawStruct(); drawRender(); A.status(); A.redraw();
  });

  // ---------- start ----------
  A.initInput(cv); resize();
  A.setDoc(A.restore() || A.newDoc()); A.fitView();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  document.documentElement.dataset.ready = '1';
})();
