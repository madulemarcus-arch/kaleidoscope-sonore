// 3D mesh generation from the 2D plan (no rendering here, so it can be tested on its own).
// Plan (x, y) in metres becomes 3D (x, up, -y). Vertex layout: x y z nx ny nz r g b a.
// Three meshes: base (floor + ground, never casts shadows), solid (walls, roof, furniture) and glass (window panes).
(function () {
  const A = window.App, GLASS = [0.55, 0.78, 0.95, 0.35], GRASS = [0.32, 0.46, 0.30];
  A.MATS = { crepi: ['Crépi blanc', [0.92, 0.90, 0.85]], brique: ['Brique', [0.70, 0.34, 0.26]], pierre: ['Pierre', [0.62, 0.58, 0.52]], bois: ['Bois', [0.62, 0.45, 0.28]], beton: ['Béton brut', [0.62, 0.63, 0.65]], bleu: ['Peinture bleue', [0.35, 0.55, 0.75]], jaune: ['Peinture jaune', [0.90, 0.78, 0.45]] };
  A.FLOORS = { carrelage: ['Carrelage', [0.80, 0.80, 0.78]], parquet: ['Parquet', [0.66, 0.50, 0.32]], beton: ['Béton lissé', [0.55, 0.56, 0.58]] };
  A.ROOFMATS = { tuile: ['Tuile rouge', [0.62, 0.28, 0.20]], tole: ['Tôle', [0.58, 0.62, 0.64]], ardoise: ['Ardoise', [0.30, 0.32, 0.36]], dalle: ['Dalle béton', [0.60, 0.61, 0.63]] };
  A.ROOFS = { none: 'Aucune', flat: 'Toit plat', gable: 'Deux pentes' };
  const rgba = c => [c[0], c[1], c[2], 1];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], unit3 = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

  // Splits a wall into boxes around its openings. Returns { g, boxes, panes } as plain descriptors.
  A.wallPieces = w => {
    const g = A.wallGeom(w), ops = A.openings(w).map(o => ({ o, s0: A.openPos(o, w) - o.w / 2, s1: A.openPos(o, w) + o.w / 2 })).sort((a, b) => a.s0 - b.s0), boxes = [], panes = [];
    let cur = -g.ea; const full = (s0, s1) => { if (s1 - s0 > 1e-4) boxes.push({ s0, s1, y0: 0, y1: w.h }); };
    ops.forEach(({ o, s0, s1 }) => { full(cur, s0); const top = Math.min(w.h, o.sill + o.h);
      if (o.sill > 1e-4) boxes.push({ s0, s1, y0: 0, y1: Math.min(o.sill, w.h) });
      if (top < w.h - 1e-4) boxes.push({ s0, s1, y0: top, y1: w.h });
      if (o.t === 'window') panes.push({ s0, s1, y0: o.sill, y1: top }); cur = Math.max(cur, s1); });
    full(cur, g.len + g.eb); return { g, boxes, panes };
  };

  // Sun position from the hour (6 h to 18 h): azimuth east -> south -> west, elevation peaking at noon. Plan north is +y.
  A.sunAt = hour => { const t = Math.max(0, Math.min(1, (hour - 6) / 12)), el = Math.max(8, 78 * Math.sin(Math.PI * t)) * Math.PI / 180, az = (90 + 180 * t) * Math.PI / 180;
    return { el, az, dir: [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)] }; };

  A.buildMesh = doc => {
    const base = [], solid = [], glass = [], st = { boxes: 0, panes: 0, walls: 0, furn: 0, roof: 'none' };
    const tri = (out, p, n, c) => p.forEach(q => out.push(q[0], q[1], q[2], n[0], n[1], n[2], c[0], c[1], c[2], c[3]));
    const quad = (out, p, n, c) => tri(out, [p[0], p[1], p[2], p[0], p[2], p[3]], n, c);
    // Polygon with a computed normal: pointing up (slopes) or away from `away` (gables).
    const poly3 = (out, pts, c, away) => { let n = unit3(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0])));
      if (away) { const m = pts.reduce((s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]], [0, 0, 0]).map(x => x / pts.length); if (dot(n, sub(m, away)) < 0) n = n.map(x => -x); } else if (n[1] < 0) n = n.map(x => -x);
      pts.length === 3 ? tri(out, pts, n, c) : quad(out, pts, n, c); };
    // Box in a local frame: origin a, axes u (along) and n (across), ranges s, k, heights y0..y1. Bottom face skipped.
    const box = (out, a, u, n, s0, s1, k0, k1, y0, y1, c) => { const P = (s, k, y) => [a[0] + u[0] * s + n[0] * k, y, -(a[1] + u[1] * s + n[1] * k)], u3 = [u[0], 0, -u[1]], n3 = [n[0], 0, -n[1]], neg = v => v.map(x => -x);
      quad(out, [P(s0, k0, y1), P(s1, k0, y1), P(s1, k1, y1), P(s0, k1, y1)], [0, 1, 0], c);
      quad(out, [P(s0, k1, y0), P(s1, k1, y0), P(s1, k1, y1), P(s0, k1, y1)], n3, c); quad(out, [P(s0, k0, y0), P(s1, k0, y0), P(s1, k0, y1), P(s0, k0, y1)], neg(n3), c);
      quad(out, [P(s1, k0, y0), P(s1, k1, y0), P(s1, k1, y1), P(s1, k0, y1)], u3, c); quad(out, [P(s0, k0, y0), P(s0, k1, y0), P(s0, k1, y1), P(s0, k0, y1)], neg(u3), c); };
    const old = A.doc; let bounds = null; A.doc = doc;
    try {
      const r = doc.render, walls = doc.items.filter(i => i.t === 'wall' && A.shown(i)), wallMat = A.MATS[r.wallMat] || A.MATS.crepi;
      let wb = null; walls.forEach(w => A.wallGeom(w).poly.forEach(p => { wb = wb || { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 }; wb.x0 = Math.min(wb.x0, p[0]); wb.y0 = Math.min(wb.y0, p[1]); wb.x1 = Math.max(wb.x1, p[0]); wb.y1 = Math.max(wb.y1, p[1]); }));
      walls.forEach(w => { st.walls++; const { g, boxes, panes } = A.wallPieces(w), c = rgba((A.MATS[w.mat] || wallMat)[1]); st.boxes += boxes.length;
        boxes.forEach(b => box(solid, w.a, g.u, g.n, b.s0, b.s1, -g.h, g.h, b.y0, b.y1, c));
        panes.forEach(p => { st.panes++; const P = (s, y) => [w.a[0] + g.u[0] * (p.s0 + s * (p.s1 - p.s0)), y, -(w.a[1] + g.u[1] * (p.s0 + s * (p.s1 - p.s0)))]; quad(glass, [P(0, p.y0), P(1, p.y0), P(1, p.y1), P(0, p.y1)], [g.n[0], 0, -g.n[1]], GLASS); }); });
      doc.items.filter(i => i.t === 'furn' && A.shown(i)).forEach(f => { st.furn++; const a = (f.rot || 0) * Math.PI / 180, u = [Math.cos(a), Math.sin(a)], k = A.FURN[f.kind] || A.FURN.table;
        box(solid, f.p, u, [-u[1], u[0]], -f.w / 2, f.w / 2, -f.d / 2, f.d / 2, 0, f.h, rgba(k[4])); });
      if (wb) { const H = Math.max(...walls.map(w => w.h)), o = r.over, tn = Math.tan(r.slope * Math.PI / 180), fl = rgba((A.FLOORS[r.floorMat] || A.FLOORS.carrelage)[1]), rc = rgba((A.ROOFMATS[r.roofMat] || A.ROOFMATS.tuile)[1]), wc = rgba(wallMat[1]);
        box(base, [wb.x0, wb.y0], [1, 0], [0, 1], 0, wb.x1 - wb.x0, 0, wb.y1 - wb.y0, -0.1, 0, fl);
        box(base, [wb.x0 - 12, wb.y0 - 12], [1, 0], [0, 1], 0, wb.x1 - wb.x0 + 24, 0, wb.y1 - wb.y0 + 24, -0.6, -0.01, rgba(GRASS));
        if (r.roof === 'flat') { st.roof = 'flat'; box(solid, [wb.x0 - o, wb.y0 - o], [1, 0], [0, 1], 0, wb.x1 - wb.x0 + 2 * o, 0, wb.y1 - wb.y0 + 2 * o, H, H + 0.2, rc); }
        else if (r.roof === 'gable') { st.roof = 'gable'; const alongX = wb.x1 - wb.x0 >= wb.y1 - wb.y0, A0 = alongX ? wb.x0 : wb.y0, A1 = alongX ? wb.x1 : wb.y1, B0 = alongX ? wb.y0 : wb.x0, B1 = alongX ? wb.y1 : wb.x1;
          const M = (a, b, h) => alongX ? [a, h, -b] : [b, h, -a], Bm = (B0 + B1) / 2, rise = (B1 - B0) / 2 * tn, eave = H - o * tn, mid = [(wb.x0 + wb.x1) / 2, H / 2, -(wb.y0 + wb.y1) / 2];
          poly3(solid, [M(A0 - o, B0 - o, eave), M(A1 + o, B0 - o, eave), M(A1 + o, Bm, H + rise), M(A0 - o, Bm, H + rise)], rc);
          poly3(solid, [M(A0 - o, B1 + o, eave), M(A1 + o, B1 + o, eave), M(A1 + o, Bm, H + rise), M(A0 - o, Bm, H + rise)], rc);
          [A0, A1].forEach(a => poly3(solid, [M(a, B0, H), M(a, B1, H), M(a, Bm, H + rise)], wc, mid)); }
      }
      bounds = A.bounds();
    } finally { A.doc = old; }
    return { base: new Float32Array(base), solid: new Float32Array(solid), glass: new Float32Array(glass), stats: st, bounds };
  };
})();
