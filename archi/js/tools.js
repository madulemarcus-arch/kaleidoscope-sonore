// Tools: snapping, pointer/keyboard input, drawing and editing tools.
(function () {
  const A = window.App, V = A.view;
  A.opts = { grid: true, ortho: false, snap: true };
  A.tool = 'select'; A.pts = []; A.typed = ''; A.cur = null; A.raw = [0, 0]; A.pv = null; A.snapInfo = null; A.flip = false; A.furnKind = 'lit'; A.furnRot = 0;
  A.TOOLS = [['select', 'Sélection', 'V'], ['wall', 'Mur', 'M'], ['line', 'Ligne', 'L'], ['rect', 'Pièce', 'R'], ['door', 'Porte', 'D'], ['window', 'Fenêtre', 'F'], ['dim', 'Cote', 'C'], ['furn', 'Meuble', 'U'], ['col', 'Poteau', 'P'], ['beam', 'Poutre', 'B'], ['text', 'Texte', 'T']];
  const OPEN = { door: { w: 0.9, h: 2.1, sill: 0 }, window: { w: 1.2, h: 1.2, sill: 0.9 } };
  let shiftKey = false, spaceKey = false;
  const num = s => parseFloat(String(s).replace(',', '.'));
  const chain = () => A.tool === 'wall' || A.tool === 'line' || A.tool === 'beam';

  A.cancel = () => { A.pts = []; A.typed = ''; A.pv = null; A.snapInfo = null; A.redraw && A.redraw(); A.emit(); };
  A.setTool = t => { A.tool = t; A.cancel(); };

  // ---------- snapping ----------
  A.snapPoint = (raw, from, skip = []) => {
    let p = raw.slice(), kind = null;
    if (A.opts.snap) { let best = 12 / V.s;
      for (const it of A.doc.items) { if (!A.free(it) || skip.includes(it.id) || A.isOpening(it)) continue;
        for (const q of A.endpoints(it)) { const d = A.dist(raw, q); if (d < best) { best = d; p = q.slice(); kind = 'end'; } } }
      if (!kind) { best = 10 / V.s; for (const it of A.doc.items) { if (!A.free(it) || skip.includes(it.id) || (it.t !== 'wall' && it.t !== 'line')) continue;
        const m = [(it.a[0] + it.b[0]) / 2, (it.a[1] + it.b[1]) / 2], d = A.dist(raw, m); if (d < best) { best = d; p = m; kind = 'mid'; } } } }
    if (!kind) {
      if (A.opts.grid) { const st = A.gridStep(); p = [Math.round(p[0] / st) * st, Math.round(p[1] / st) * st]; kind = 'grid'; }
      if (from && (A.opts.ortho || shiftKey)) { const dx = raw[0] - from[0], dy = raw[1] - from[1];
        p = Math.abs(dx) >= Math.abs(dy) ? [A.opts.grid ? p[0] : raw[0], from[1]] : [from[0], A.opts.grid ? p[1] : raw[1]]; kind = 'ortho'; }
    }
    return { p, kind };
  };

  // ---------- creation helpers ----------
  const layerId = () => (A.layer(A.doc.active) ? A.doc.active : A.doc.layers[0].id);
  const strLayer = () => A.layer('str') ? 'str' : layerId();
  const mk = (doc, it) => { it.id = A.uid(); it.layer = it.layer || layerId(); doc.items.push(it); return it; };
  const addSeg = (a, b) => { if (A.dist(a, b) < 0.01) return false;
    A.edit(d => mk(d, A.tool === 'wall' ? { t: 'wall', a, b, th: d.defaults.th, h: d.defaults.h } : A.tool === 'beam' ? { t: 'beam', a, b, layer: strLayer() } : { t: 'line', a, b })); return true; };
  const rectPts = (p, q) => [p, [q[0], p[1]], q, [p[0], q[1]]];
  const addRect = (p, q) => { if (Math.abs(q[0] - p[0]) < 0.05 || Math.abs(q[1] - p[1]) < 0.05) return false; const c = rectPts(p, q);
    A.edit(d => c.forEach((a, i) => mk(d, { t: 'wall', a, b: c[(i + 1) % 4], th: d.defaults.th, h: d.defaults.h }))); return true; };
  A.openingAt = (raw, kind) => {
    let best = null; const w0 = OPEN[kind].w;
    for (const w of A.doc.items) { if (w.t !== 'wall' || !A.free(w) || A.dist(w.a, w.b) < w0) continue; const s = A.segDist(raw, w.a, w.b);
      if (s.d <= w.th / 2 + 0.3 && (!best || s.d < best.d)) best = { wall: w, d: s.d, t: s.t }; }
    if (!best) return null; const len = A.dist(best.wall.a, best.wall.b);
    return { wall: best.wall, pos: Math.max(w0 / 2, Math.min(len - w0 / 2, Math.round(best.t * 20) / 20)) };
  };
  const dimOff = (a, b, p) => { const n = A.normal(A.unit(a, b)); return (p[0] - a[0]) * n[0] + (p[1] - a[1]) * n[1]; };

  // ---------- preview + status ----------
  A.updatePreview = () => {
    const c = A.cur, pv = { walls: [], lines: [] }; A.pv = pv; if (!c) return;
    const from = A.pts[0];
    if (chain() && from) { const l = A.dist(from, c); if (A.tool === 'wall') pv.walls.push({ a: from, b: c, th: A.doc.defaults.th }); else pv.lines.push([from, c]);
      const ang = (Math.atan2(c[1] - from[1], c[0] - from[0]) * 180 / Math.PI + 360) % 360; pv.label = { p: c, text: A.typed ? A.typed + ' m' : `${A.fmt(l)} m · ${A.fmt(ang, 0)}°` }; }
    else if (A.tool === 'rect' && from) { pv.rect = rectPts(from, c); const w = Math.abs(c[0] - from[0]), h = Math.abs(c[1] - from[1]); pv.label = { p: c, text: A.typed || `${A.fmt(w)} × ${A.fmt(h)} m · ${A.fmt(w * h)} m²` }; }
    else if (A.tool === 'door' || A.tool === 'window') { const o = A.openingAt(A.raw, A.tool); if (o) { pv.open = A.openRect({ wall: o.wall.id, pos: o.pos, w: OPEN[A.tool].w }).pts; A.pvOpen = o; } else A.pvOpen = null; }
    else if (A.tool === 'furn') { const k = A.FURN[A.furnKind]; pv.rect = A.furnPoly({ p: c, w: k[1], d: k[2], rot: A.furnRot }); pv.label = { p: c, text: k[0] }; }
    else if (A.tool === 'dim' && from) { const off = A.pts[1] ? dimOff(from, A.pts[1], c) : 0, b = A.pts[1] || c; pv.lines.push([from, b]);
      if (A.pts[1]) { const g = A.dimGeom({ a: from, b, off }); pv.lines.push([g.a2, g.b2]); } pv.label = { p: c, text: `${A.fmt(A.dist(from, b))} m` }; }
  };
  A.hint = () => {
    const n = A.pts.length, t = A.tool;
    if (t === 'select') return A.sel.length ? 'Glissez pour déplacer · poignées carrées pour étirer · Suppr pour effacer' : 'Touchez un élément · glissez dans le vide pour déplacer la vue';
    if (chain()) return n ? 'Cliquez le point suivant · tapez une longueur puis Entrée · clic droit / Échap pour finir' : 'Cliquez le point de départ';
    if (t === 'rect') return n ? 'Cliquez le coin opposé · ou tapez 4x3 puis Entrée' : 'Cliquez un coin de la pièce';
    if (t === 'door' || t === 'window') return 'Cliquez sur un mur pour poser · X : inverser le côté';
    if (t === 'col') return 'Cliquez pour poser un poteau (section recalculée par le dimensionnement)';
    if (t === 'beam') return n ? 'Cliquez le poteau suivant · clic droit / Échap pour finir' : 'Cliquez le poteau de départ (les poutres sous les murs sont déduites des poteaux, inutile de les dessiner)';
    if (t === 'furn') return 'Choisissez le meuble en haut · cliquez pour le poser · X : tourner de 90°';
    if (t === 'dim') return n === 0 ? 'Cliquez le premier point' : n === 1 ? 'Cliquez le second point' : 'Cliquez pour placer la ligne de cote';
    return 'Cliquez pour placer le texte';
  };

  // ---------- committing a click ----------
  function click(p) {
    const t = A.tool;
    if (chain()) { if (!A.pts.length) { A.pts = [p]; } else { if (A.same(A.pts[0], p)) return; const first = A.chainStart; addSeg(A.pts[0], p); A.pts = (first && A.same(first, p)) ? [] : [p]; } if (A.pts.length === 1 && !A.chainStart) A.chainStart = p; if (!A.pts.length) A.chainStart = null; }
    else if (t === 'rect') { if (!A.pts.length) A.pts = [p]; else if (addRect(A.pts[0], p)) A.pts = []; }
    else if (t === 'door' || t === 'window') { const o = A.openingAt(A.raw, t); if (o) A.edit(d => mk(d, Object.assign({ t, wall: o.wall.id, pos: o.pos, flip: A.flip, mirror: false, layer: o.wall.layer }, OPEN[t]))); }
    else if (t === 'dim') { if (A.pts.length < 2) { if (!A.pts.length || !A.same(A.pts[0], p)) A.pts.push(p); } else { const off = dimOff(A.pts[0], A.pts[1], p) || 0.5, [a, b] = A.pts; A.edit(d => mk(d, { t: 'dim', a, b, off })); A.pts = []; } }
    else if (t === 'col') { if (!A.doc.items.some(o => o.t === 'col' && A.same(o.p, p))) A.edit(d => mk(d, { t: 'col', p, a: 0.2, layer: strLayer() })); }
    else if (t === 'furn') { const k = A.FURN[A.furnKind]; A.edit(d => mk(d, { t: 'furn', kind: A.furnKind, p, w: k[1], d: k[2], h: k[3], rot: A.furnRot, layer: A.layer('meu') ? 'meu' : layerId() })); }
    else if (t === 'text') { const s = prompt('Texte :'); if (s && s.trim()) A.edit(d => mk(d, { t: 'text', p, s: s.trim(), size: 0.25 })); }
    A.typed = ''; A.updatePreview(); A.redraw(); A.emit();
  }
  A.finishChain = () => { A.pts = []; A.chainStart = null; A.typed = ''; A.updatePreview(); A.redraw(); A.emit(); };
  A.commitTyped = (text) => {
    const s = (text != null ? text : A.typed).trim(); if (!s || !A.pts.length) return false; const from = A.pts[0];
    if (chain()) { const L = num(s); if (!(L > 0)) return false; const c = A.cur || A.raw; let u = A.dist(from, c) > 1e-6 ? A.unit(from, c) : [1, 0];
      if (A.opts.ortho || shiftKey) u = Math.abs(u[0]) >= Math.abs(u[1]) ? [Math.sign(u[0]) || 1, 0] : [0, Math.sign(u[1])];
      const b = [from[0] + u[0] * L, from[1] + u[1] * L]; addSeg(from, b); A.pts = [b]; }
    else if (A.tool === 'rect') { const m = s.match(/^(\d*[.,]?\d+)\s*[x*;]\s*(\d*[.,]?\d+)$/i); if (!m) return false; const sx = A.raw[0] >= from[0] ? 1 : -1, sy = A.raw[1] >= from[1] ? 1 : -1;
      if (addRect(from, [from[0] + sx * num(m[1]), from[1] + sy * num(m[2])])) A.pts = []; }
    else return false;
    A.typed = ''; A.updatePreview(); A.redraw(); A.emit(); return true;
  };

  // ---------- selection drag ----------
  let drag = null;
  // Other walls/lines whose end touches point `key` of `it` (they stretch along when it moves).
  const linked = (it, key) => A.doc.items.filter(o => o !== it && (o.t === 'wall' || o.t === 'line')).flatMap(o => ['a', 'b'].filter(k => A.same(o[k], it[key])).map(k => ({ o, k })));
  function startSelect(p, raw, shift) {
    const tol = 10 / V.s;
    if (A.sel.length === 1) { const it = A.item(A.sel[0]);
      if (it && it.a && it.b && !A.isOpening(it)) for (const k of ['a', 'b']) { const q = A.toScreen(it[k]); if (Math.hypot(q[0] - p[0], q[1] - p[1]) < 12) {
        drag = { type: 'handle', it, k, links: linked(it, k), moved: false, p0: p }; return; } } }
    const id = A.hit(raw, tol);
    if (id) { if (!A.sel.includes(id)) A.sel = shift ? [...A.sel, id] : [id]; A.emit();
      const items = A.sel.map(A.item).filter(Boolean), orig = {};
      items.forEach(it => { orig[it.id] = JSON.parse(JSON.stringify(it)); });
      const stretch = items.length === 1 && (items[0].t === 'wall' || items[0].t === 'line') ? ['a', 'b'].flatMap(k => linked(items[0], k).map(l => ({ ...l, from: l.o[l.k].slice(), key: k }))) : [];
      drag = { type: 'move', raw0: raw, orig, stretch, moved: false, p0: p }; }
    else drag = { type: 'pan', ox: V.ox, oy: V.oy, p0: p, moved: false, shift };
  }
  function moveSelect(p, raw) {
    if (!drag) return; const dpx = Math.hypot(p[0] - drag.p0[0], p[1] - drag.p0[1]);
    if (drag.type === 'pan') { if (dpx > 3) drag.moved = true; if (drag.moved) { V.ox = drag.ox + p[0] - drag.p0[0]; V.oy = drag.oy + p[1] - drag.p0[1]; A.redraw(); } return; }
    if (!drag.moved && dpx < 4) return; if (!drag.moved) { drag.moved = true; A.snap(); }
    if (drag.type === 'handle') { const other = drag.it[drag.k === 'a' ? 'b' : 'a'], s = A.snapPoint(raw, other, [drag.it.id, ...drag.links.map(l => l.o.id)]); A.snapInfo = s;
      drag.it[drag.k] = s.p.slice(); drag.links.forEach(l => { l.o[l.k] = s.p.slice(); }); A.redraw(); return; }
    let d = [raw[0] - drag.raw0[0], raw[1] - drag.raw0[1]]; if (A.opts.grid) { const st = A.gridStep(); d = [Math.round(d[0] / st) * st, Math.round(d[1] / st) * st]; }
    const ids = Object.keys(drag.orig), moving = ids.filter(id => { const o = drag.orig[id]; return !(A.isOpening(o) && ids.includes(o.wall)); });
    moving.forEach(id => { const it = A.item(id), o = drag.orig[id];
      if (A.isOpening(it)) { const w = A.item(it.wall); if (!w) return; const u = A.unit(w.a, w.b); it.pos = Math.max(it.w / 2, Math.min(A.dist(w.a, w.b) - it.w / 2, o.pos + d[0] * u[0] + d[1] * u[1])); }
      else if (it.t === 'text' || it.t === 'furn' || it.t === 'col') it.p = [o.p[0] + d[0], o.p[1] + d[1]];
      else { it.a = [o.a[0] + d[0], o.a[1] + d[1]]; it.b = [o.b[0] + d[0], o.b[1] + d[1]]; } });
    drag.stretch.forEach(l => { const it = A.item(Object.keys(drag.orig)[0]); l.o[l.k] = it[l.key].slice(); });
    A.redraw();
  }
  function endSelect(e, p, raw) {
    const d = drag; drag = null; if (!d) return;
    if (d.moved && d.type !== 'pan') { A.snapInfo = null; A.save(); A.emit(); return; }
    if (!d.moved && d.type === 'pan') { if (!d.shift) { A.sel = []; } A.emit(); }
    else if (d.type === 'pan') A.redraw();
  }

  // ---------- pointer events ----------
  A.initInput = cv => {
    const ptrs = new Map(); let gest = null, pan = null, down = null;
    const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const setCursor = p => { A.raw = A.toWorld(p[0], p[1]); const s = A.snapPoint(A.raw, A.pts.length && A.tool !== 'rect' && A.tool !== 'dim' ? A.pts[A.pts.length - 1] : null); A.cur = s.p; A.snapInfo = A.tool === 'select' ? null : s;
      A.updatePreview(); A.status && A.status(); A.redraw(); };
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, pos(e));
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; gest = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], v: { ...V } }; drag = null; down = null; return; }
      if (ptrs.size > 2) return;
      const p = pos(e);
      if (e.button === 1 || e.button === 2 || spaceKey) { pan = { p0: p, ox: V.ox, oy: V.oy, moved: false, right: e.button === 2 }; return; }
      if (e.button !== 0) return; down = { p, touch: e.pointerType === 'touch' };
      if (A.tool === 'select') startSelect(p, A.toWorld(p[0], p[1]), e.shiftKey); else setCursor(p);
    });
    cv.addEventListener('pointermove', e => {
      if (!ptrs.has(e.pointerId) && e.pointerType === 'touch') return; const p = pos(e); if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, p);
      shiftKey = e.shiftKey;
      if (gest && ptrs.size >= 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], g = gest.v;
        const wx = (gest.c[0] - g.ox) / g.s, wy = -(gest.c[1] - g.oy) / g.s; V.s = Math.max(2, Math.min(2000, g.s * d / gest.d)); V.ox = c[0] - wx * V.s; V.oy = c[1] + wy * V.s; A.redraw(); return; }
      if (pan) { if (Math.hypot(p[0] - pan.p0[0], p[1] - pan.p0[1]) > 3) pan.moved = true; if (pan.moved) { V.ox = pan.ox + p[0] - pan.p0[0]; V.oy = pan.oy + p[1] - pan.p0[1]; A.redraw(); } return; }
      const raw = A.toWorld(p[0], p[1]);
      if (A.tool === 'select') { A.raw = raw; if (drag) moveSelect(p, raw); A.status && A.status(); } else setCursor(p);
    });
    const up = e => {
      const p = pos(e); ptrs.delete(e.pointerId);
      if (gest) { if (ptrs.size < 2) gest = null; if (!ptrs.size) down = null; return; }
      if (pan) { const was = pan; pan = null; if (!was.moved && was.right) { if (A.pts.length) A.finishChain(); else A.cancel(); } return; }
      if (e.type === 'pointercancel') { drag = null; down = null; return; }
      if (A.tool === 'select') { endSelect(e, p, A.toWorld(p[0], p[1])); return; }
      if (down) { const near = Math.hypot(p[0] - down.p[0], p[1] - down.p[1]) < 6; if (near || down.touch) { setCursor(p); click(A.cur); } down = null; }
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !ptrs.size && A.tool !== 'select') { A.snapInfo = null; A.cur = null; A.pv = null; A.redraw(); } });
    cv.addEventListener('dblclick', e => { if (chain() && A.pts.length) A.finishChain(); });
    cv.addEventListener('wheel', e => { e.preventDefault(); const p = pos(e), f = Math.exp(-e.deltaY * 0.0015), wx = (p[0] - V.ox) / V.s, wy = -(p[1] - V.oy) / V.s;
      V.s = Math.max(2, Math.min(2000, V.s * f)); V.ox = p[0] - wx * V.s; V.oy = p[1] + wy * V.s; if (A.tool !== 'select') setCursor(p); else A.redraw(); }, { passive: false });
  };

  // ---------- keyboard ----------
  window.addEventListener('keyup', e => { if (e.key === 'Shift') shiftKey = false; if (e.key === ' ') spaceKey = false; });
  window.addEventListener('keydown', e => {
    if (/^(INPUT|SELECT|TEXTAREA)$/.test((e.target || {}).tagName)) return;
    if (A.mode === '3d') { const k3 = e.key.toLowerCase(); if (e.key === '2' || e.key === 'Escape') A.setMode('2d'); else if (k3 === 'h') A.v3.preset('iso'); else if (k3 === 't') A.v3.preset('top'); return; }
    if (e.key === 'Shift') shiftKey = true; if (e.key === ' ') { spaceKey = true; e.preventDefault(); return; }
    const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
    if (mod) { if (k === 'z') { e.preventDefault(); e.shiftKey ? A.redo() : A.undo(); } else if (k === 'y') { e.preventDefault(); A.redo(); }
      else if (k === 'a') { e.preventDefault(); A.sel = A.doc.items.filter(A.free).map(i => i.id); A.emit(); } else if (k === 's') { e.preventDefault(); A.exportJSON && A.exportJSON(); } return; }
    if (A.pts.length && (chain() || A.tool === 'rect')) {
      if (/^[0-9.,]$/.test(e.key) || (A.tool === 'rect' && /^[x*;]$/i.test(e.key))) { A.typed += e.key.toLowerCase(); A.updatePreview(); A.redraw(); A.status && A.status(); e.preventDefault(); return; }
      if (e.key === 'Backspace' && A.typed) { A.typed = A.typed.slice(0, -1); A.updatePreview(); A.redraw(); A.status && A.status(); e.preventDefault(); return; }
      if (e.key === 'Enter') { if (A.typed) A.commitTyped(); else A.finishChain(); e.preventDefault(); return; }
    }
    if (e.key === '3') { A.setMode('3d'); return; }
    if (e.key === 'Escape') { if (A.typed) { A.typed = ''; A.updatePreview(); A.redraw(); A.status && A.status(); } else if (A.pts.length) A.finishChain(); else if (A.sel.length) { A.sel = []; A.emit(); } else A.setTool('select'); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { if (A.sel.length) { A.edit(d => A.removeIds(A.sel)); A.sel = []; A.emit(); } return; }
    const tool = { v: 'select', m: 'wall', l: 'line', r: 'rect', d: 'door', f: 'window', c: 'dim', u: 'furn', p: 'col', b: 'beam', t: 'text' }[k];
    if (tool) { A.setTool(tool); return; }
    if (k === 'x' && (A.tool === 'door' || A.tool === 'window')) { A.flip = !A.flip; A.emit(); }
    else if (k === 'x' && A.tool === 'furn') { A.furnRot = (A.furnRot + 90) % 360; A.updatePreview(); A.redraw(); }
    else if (k === 'o') { A.opts.ortho = !A.opts.ortho; A.emit(); } else if (k === 'g') { A.opts.grid = !A.opts.grid; A.emit(); } else if (k === 's') { A.opts.snap = !A.opts.snap; A.emit(); }
    else if (k === 'h' && A.fitView) A.fitView();
  });
})();
