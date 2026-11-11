// Core: document model, geometry helpers, hit testing, undo/redo, autosave.
// All coordinates are in metres, x to the right, y UP (screen conversion happens in draw.js).
(function () {
  const A = window.App = { BUILD: 'archi-v11', KEY: 'archi.doc.v1', sel: [], doc: null, listeners: [] };
  const L = (id, name, color) => ({ id, name, color, on: true, lock: false });
  A.uid = () => Math.random().toString(36).slice(2, 9);
  A.newDoc = () => A.ensureDoc({ v: 1, name: 'Sans titre', active: 'mur', defaults: { th: 0.2, h: 2.8 },
    layers: [L('mur', 'Murs', '#e6ecf5'), L('dess', 'Dessin', '#7cc4ff'), L('cot', 'Cotes', '#e5b044'), L('txt', 'Textes', '#d9d9d9')], items: [] });
  // Furniture catalogue: [label, width, depth, height, rgb]. Fixed sizes can be edited per piece.
  A.FURN = { lit: ['Lit', 1.6, 2.0, 0.5, [0.55, 0.65, 0.85]], table: ['Table', 1.4, 0.8, 0.75, [0.62, 0.45, 0.28]], chaise: ['Chaise', 0.45, 0.45, 0.9, [0.62, 0.45, 0.28]], canape: ['Canapé', 2.0, 0.9, 0.85, [0.45, 0.50, 0.58]],
    armoire: ['Armoire', 1.2, 0.6, 2.0, [0.55, 0.40, 0.25]], bureau: ['Bureau', 1.4, 0.7, 0.75, [0.70, 0.58, 0.40]], cuisine: ['Plan de cuisine', 2.4, 0.6, 0.9, [0.85, 0.85, 0.82]], lavabo: ['Lavabo', 0.6, 0.5, 0.85, [0.95, 0.95, 0.95]],
    wc: ['WC', 0.4, 0.7, 0.4, [0.95, 0.95, 0.95]], douche: ['Douche', 0.9, 0.9, 0.1, [0.80, 0.90, 0.95]], baignoire: ['Baignoire', 1.7, 0.75, 0.55, [0.95, 0.95, 0.95]] };
  // BAEL 91 (rev. 99) pre-sizing parameters. Stresses in MPa, loads in kN/m2 (kN/m for walls per m2 of wall).
  A.STRUCT_DEFAULTS = { fc28: 25, fe: 500, sigSol: 0.2, nlev: 1, top: 'dalle', G2: 2.0, Q: 1.5, G2top: 1.5, Qtop: 1.0, Groof: 1.0, Qroof: 0.5, wallLoad: 2.8, maxSpan: 4.5, found: 'auto', degr: true };
  // Fills in everything a document needs (older plans lack the rendering settings and the furniture layer).
  A.ensureDoc = d => { d.defaults = d.defaults || { th: 0.2, h: 2.8 };
    d.render = Object.assign({ wallMat: 'crepi', floorMat: 'carrelage', roof: 'none', slope: 25, over: 0.4, roofMat: 'tuile', hour: 14, shadows: true }, d.render || {});
    if (!d.layers.some(l => l.id === 'meu')) d.layers.push({ id: 'meu', name: 'Mobilier', color: '#c9a26b', on: true, lock: false });
    if (!d.layers.some(l => l.id === 'str')) d.layers.push({ id: 'str', name: 'Structure', color: '#ff9f6b', on: true, lock: false });
    d.struct = d.struct || {}; d.struct.p = Object.assign({}, A.STRUCT_DEFAULTS, d.struct.p || {}); d.render.structure = d.render.structure !== false;
    if (!d.layers.some(l => l.id === d.active)) d.active = d.layers[0].id; return d; };
  let hist = [], fut = [];
  A.on = f => A.listeners.push(f);
  A.emit = () => A.listeners.forEach(f => f());
  A.save = () => { try { localStorage.setItem(A.KEY, JSON.stringify(A.doc)); } catch (e) { /* storage may be blocked */ } };
  A.restore = () => { try { const d = JSON.parse(localStorage.getItem(A.KEY)); if (A.valid(d)) return A.ensureDoc(d); } catch (e) { /* ignore */ } return null; };
  A.valid = d => !!d && d.v === 1 && Array.isArray(d.items) && Array.isArray(d.layers) && d.layers.length > 0;
  A.setDoc = d => { A.doc = d; A.sel = []; hist = []; fut = []; A.save(); A.emit(); };
  A.snap = () => { hist.push(JSON.stringify(A.doc)); if (hist.length > 200) hist.shift(); fut = []; };
  A.edit = fn => { A.snap(); fn(A.doc); A.save(); A.emit(); };
  A.canUndo = () => hist.length > 0; A.canRedo = () => fut.length > 0;
  const swap = (from, to) => { if (!from.length) return; to.push(JSON.stringify(A.doc)); A.doc = JSON.parse(from.pop()); A.sel = A.sel.filter(id => A.item(id)); A.save(); A.emit(); };
  A.undo = () => swap(hist, fut); A.redo = () => swap(fut, hist);
  A.item = id => A.doc.items.find(i => i.id === id);
  A.layer = id => A.doc.layers.find(l => l.id === id);
  A.shown = it => { const l = A.layer(it.layer); return !l || l.on; };
  A.free = it => { const l = A.layer(it.layer); return A.shown(it) && !(l && l.lock); };
  A.isOpening = it => it.t === 'door' || it.t === 'window';

  // ---------- geometry ----------
  A.dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  A.same = (a, b) => A.dist(a, b) < 0.005;
  A.unit = (a, b) => { const l = A.dist(a, b) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
  A.normal = u => [-u[1], u[0]];
  // Distance from p to segment ab; t is the clamped position along it in metres.
  A.segDist = (p, a, b) => {
    const l = A.dist(a, b); if (l < 1e-9) return { d: A.dist(p, a), t: 0 };
    const u = A.unit(a, b), t = Math.max(0, Math.min(l, (p[0] - a[0]) * u[0] + (p[1] - a[1]) * u[1]));
    return { d: A.dist(p, [a[0] + u[0] * t, a[1] + u[1] * t]), t };
  };
  A.endpoints = it => it.t === 'wall' || it.t === 'line' || it.t === 'dim' || it.t === 'beam' ? [it.a, it.b] : it.t === 'text' || it.t === 'col' ? [it.p] : [];
  // A wall end that touches another wall's end is extended by half a thickness so corners close cleanly.
  A.wallGeom = w => {
    const u = A.unit(w.a, w.b), n = A.normal(u), h = w.th / 2;
    const joined = p => A.doc.items.some(o => o !== w && o.t === 'wall' && (A.same(o.a, p) || A.same(o.b, p)));
    const ea = joined(w.a) ? h : 0, eb = joined(w.b) ? h : 0;
    const A0 = [w.a[0] - u[0] * ea, w.a[1] - u[1] * ea], B0 = [w.b[0] + u[0] * eb, w.b[1] + u[1] * eb];
    return { u, n, h, len: A.dist(w.a, w.b), ea, eb,
      poly: [[A0[0] + n[0] * h, A0[1] + n[1] * h], [B0[0] + n[0] * h, B0[1] + n[1] * h], [B0[0] - n[0] * h, B0[1] - n[1] * h], [A0[0] - n[0] * h, A0[1] - n[1] * h]] };
  };
  A.openPos = (o, w) => Math.max(o.w / 2, Math.min(A.dist(w.a, w.b) - o.w / 2, o.pos));
  A.openings = w => A.doc.items.filter(o => A.isOpening(o) && o.wall === w.id);
  // Rectangle (4 world points) of an opening, slightly thicker than its host wall.
  A.openRect = o => {
    const w = A.item(o.wall); if (!w) return null;
    const g = A.wallGeom(w), c = A.openPos(o, w), h = g.h + 0.005, q = o.w / 2;
    const P = (s, k) => [w.a[0] + g.u[0] * (c + s * q) + g.n[0] * k * h, w.a[1] + g.u[1] * (c + s * q) + g.n[1] * k * h];
    return { w, g, c, pts: [P(-1, 1), P(1, 1), P(1, -1), P(-1, -1)] };
  };
  A.dimGeom = d => { const u = A.unit(d.a, d.b), n = A.normal(u), o = d.off || 0.5;
    return { u, n, a2: [d.a[0] + n[0] * o, d.a[1] + n[1] * o], b2: [d.b[0] + n[0] * o, d.b[1] + n[1] * o], len: A.dist(d.a, d.b) }; };
  // Four world corners of a furniture piece (centre p, size w x d, rotation in degrees).
  A.furnPoly = f => { const r = (f.rot || 0) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r), hw = f.w / 2, hd = f.d / 2;
    return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([x, y]) => [f.p[0] + x * c - y * s, f.p[1] + x * s + y * c]); };
  A.colPoly = c => { const h = c.a / 2; return [[c.p[0] - h, c.p[1] - h], [c.p[0] + h, c.p[1] - h], [c.p[0] + h, c.p[1] + h], [c.p[0] - h, c.p[1] + h]]; };
  A.textBox = t => [t.p[0], t.p[1], t.p[0] + t.s.length * t.size * 0.6, t.p[1] + t.size];

  // Topmost item under world point p (openings win over their wall); tol in metres.
  A.hit = (p, tol) => {
    const its = A.doc.items.filter(A.free);
    for (let i = its.length - 1; i >= 0; i--) { const o = its[i]; if (!A.isOpening(o)) continue;
      const r = A.openRect(o); if (!r) continue; const x = A.segDist(p, r.w.a, r.w.b);
      if (Math.abs(x.t - r.c) <= o.w / 2 + tol * 0.3 && x.d <= r.g.h + tol) return o.id; }
    for (let i = its.length - 1; i >= 0; i--) { const o = its[i];
      if (o.t === 'wall' && A.segDist(p, o.a, o.b).d <= o.th / 2 + tol) return o.id;
      if ((o.t === 'line' || o.t === 'beam') && A.segDist(p, o.a, o.b).d <= tol) return o.id;
      if (o.t === 'col' && Math.abs(p[0] - o.p[0]) <= o.a / 2 + tol && Math.abs(p[1] - o.p[1]) <= o.a / 2 + tol) return o.id;
      if (o.t === 'dim') { const g = A.dimGeom(o); if (A.segDist(p, g.a2, g.b2).d <= tol) return o.id; }
      if (o.t === 'furn') { const r = -(o.rot || 0) * Math.PI / 180, dx = p[0] - o.p[0], dy = p[1] - o.p[1], lx = dx * Math.cos(r) - dy * Math.sin(r), ly = dx * Math.sin(r) + dy * Math.cos(r);
        if (Math.abs(lx) <= o.w / 2 + tol && Math.abs(ly) <= o.d / 2 + tol) return o.id; }
      if (o.t === 'text') { const b = A.textBox(o); if (p[0] >= b[0] - tol && p[0] <= b[2] + tol && p[1] >= b[1] - tol && p[1] <= b[3] + tol) return o.id; } }
    return null;
  };
  A.bounds = () => {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const add = p => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); };
    A.doc.items.filter(A.shown).forEach(it => { if (it.t === 'wall') A.wallGeom(it).poly.forEach(add); else if (it.t === 'text') { const b = A.textBox(it); add([b[0], b[1]]); add([b[2], b[3]]); } else if (it.t === 'furn') A.furnPoly(it).forEach(add); else if (it.t === 'col') A.colPoly(it).forEach(add);
      else if (it.t === 'dim') { const g = A.dimGeom(it); [it.a, it.b, g.a2, g.b2].forEach(add); } else A.endpoints(it).forEach(add); });
    return x1 < x0 ? null : { x0, y0, x1, y1 };
  };
  A.fmt = (v, n = 2) => (Math.round(v * 10 ** n) / 10 ** n).toFixed(n).replace('.', ',');
  A.removeIds = ids => { const s = new Set(ids); A.doc.items = A.doc.items.filter(i => !s.has(i.id) && !(A.isOpening(i) && s.has(i.wall))); };
})();
