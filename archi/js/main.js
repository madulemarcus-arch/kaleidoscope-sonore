// UI wiring: canvas sizing, toolbar, layers and properties panels, status bar, file menu, service worker.
(function () {
  const A = window.App, $ = id => document.getElementById(id), cv = $('cv'), ctx = cv.getContext('2d');
  let W = 0, H = 0, raf = 0;

  // ---------- canvas ----------
  const resize = () => { const r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2); const nw = Math.max(1, Math.round(r.width)), nh = Math.max(1, Math.round(r.height));
    if (W) { A.view.ox += (nw - W) / 2; A.view.oy += (nh - H) / 2; } W = nw; H = nh; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); A.redraw(); };
  const paint = () => { raf = 0; if (!A.doc) return; A.render(ctx, W, H, A.view, 'screen', { sel: A.sel, pv: A.pv, snap: A.snapInfo, grid: A.opts.grid || true }); };
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
    A.emit();
  };
  $('mode2').onclick = () => A.setMode('2d'); $('mode3').onclick = () => A.setMode('3d');
  $('bar3').onclick = e => { const v = e.target.dataset && e.target.dataset.v; if (!v) return; if (v === 'png') { A.v3.render(); cv3.toBlob(b => A.download((A.doc.name || 'plan').replace(/[^\w\-]+/g, '-') + '-3d.png', b), 'image/png'); } else A.v3.preset(v); };

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

  // ---------- properties panel ----------
  function field(label, value, step, set, min) { const r = document.createElement('label'); r.className = 'row'; r.innerHTML = `<span>${label}</span>`; const i = document.createElement('input'); i.type = 'number'; i.step = step; i.min = min == null ? 0.01 : min; i.value = Math.round(value * 1000) / 1000;
    i.onchange = () => { const v = parseFloat(i.value); if (isFinite(v) && v >= i.min) A.edit(set.bind(null, v)); else A.emit(); }; r.appendChild(i); return r; }
  function drawProps() {
    const box = $('props'); box.innerHTML = ''; const sel = A.sel.map(A.item).filter(Boolean);
    if (!sel.length) { $('propsTitle').textContent = 'Réglages des murs'; box.appendChild(field('Épaisseur (m)', A.doc.defaults.th, 0.01, (v, d) => { d.defaults.th = v; }));
      box.appendChild(field('Hauteur (m)', A.doc.defaults.h, 0.05, (v, d) => { d.defaults.h = v; })); const m = document.createElement('p'); m.className = 'muted'; m.textContent = 'Valables pour les prochains murs. Sélectionnez un élément pour modifier ses propriétés.'; box.appendChild(m); return; }
    const names = { wall: 'Mur', line: 'Ligne', door: 'Porte', window: 'Fenêtre', dim: 'Cote', text: 'Texte' };
    $('propsTitle').textContent = sel.length > 1 ? sel.length + ' éléments' : names[sel[0].t];
    const each = (fn) => d => sel.forEach(s => fn(d.items.find(i => i.id === s.id)));
    if (sel.length === 1) { const it = sel[0];
      if (it.t === 'wall') { box.appendChild(field('Épaisseur (m)', it.th, 0.01, (v, d) => { d.items.find(i => i.id === it.id).th = v; })); box.appendChild(field('Hauteur (m)', it.h, 0.05, (v, d) => { d.items.find(i => i.id === it.id).h = v; }));
        const p = document.createElement('p'); p.className = 'muted'; p.textContent = 'Longueur : ' + A.fmt(A.dist(it.a, it.b)) + ' m'; box.appendChild(p); }
      if (it.t === 'line' || it.t === 'dim') { const p = document.createElement('p'); p.className = 'muted'; p.textContent = 'Longueur : ' + A.fmt(A.dist(it.a, it.b)) + ' m'; box.appendChild(p); }
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
    drawLayers(); drawProps(); A.status(); A.redraw();
  });

  // ---------- start ----------
  A.initInput(cv); resize();
  A.setDoc(A.restore() || A.newDoc()); A.fitView();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  document.documentElement.dataset.ready = '1';
})();
