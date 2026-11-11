// 3D mesh generation from the 2D plan (no rendering here, so it can be tested on its own).
// Plan (x, y) in metres becomes 3D (x, up, -y). Vertex layout: x y z nx ny nz r g b a.
(function () {
  const A = window.App, WALL = [0.90, 0.88, 0.84, 1], SLAB = [0.22, 0.29, 0.40, 1], GLASS = [0.55, 0.78, 0.95, 0.35];
  A.SLAB_T = 0.2;
  // Splits a wall into boxes around its openings. Returns { boxes, panes } as plain descriptors.
  A.wallPieces = w => {
    const g = A.wallGeom(w), ops = A.openings(w).map(o => ({ o, s0: A.openPos(o, w) - o.w / 2, s1: A.openPos(o, w) + o.w / 2 })).sort((a, b) => a.s0 - b.s0), boxes = [], panes = [];
    let cur = -g.ea; const full = (s0, s1) => { if (s1 - s0 > 1e-4) boxes.push({ s0, s1, y0: 0, y1: w.h }); };
    ops.forEach(({ o, s0, s1 }) => { full(cur, s0); const top = Math.min(w.h, o.sill + o.h);
      if (o.sill > 1e-4) boxes.push({ s0, s1, y0: 0, y1: Math.min(o.sill, w.h) });
      if (top < w.h - 1e-4) boxes.push({ s0, s1, y0: top, y1: w.h });
      if (o.t === 'window') panes.push({ s0, s1, y0: o.sill, y1: top }); cur = Math.max(cur, s1); });
    full(cur, g.len + g.eb); return { g, boxes, panes };
  };
  A.buildMesh = doc => {
    const solid = [], glass = [], st = { boxes: 0, panes: 0, walls: 0 };
    const quad = (out, p, n, c) => { [0, 1, 2, 0, 2, 3].forEach(i => out.push(p[i][0], p[i][1], p[i][2], n[0], n[1], n[2], c[0], c[1], c[2], c[3])); };
    const box = (a, u, n, s0, s1, k0, k1, y0, y1, c) => { st.boxes++; const P = (s, k, y) => [a[0] + u[0] * s + n[0] * k, y, -(a[1] + u[1] * s + n[1] * k)], u3 = [u[0], 0, -u[1]], n3 = [n[0], 0, -n[1]], neg = v => v.map(x => -x);
      quad(solid, [P(s0, k0, y1), P(s1, k0, y1), P(s1, k1, y1), P(s0, k1, y1)], [0, 1, 0], c);
      quad(solid, [P(s0, k1, y0), P(s1, k1, y0), P(s1, k1, y1), P(s0, k1, y1)], n3, c); quad(solid, [P(s0, k0, y0), P(s1, k0, y0), P(s1, k0, y1), P(s0, k0, y1)], neg(n3), c);
      quad(solid, [P(s1, k0, y0), P(s1, k1, y0), P(s1, k1, y1), P(s1, k0, y1)], u3, c); quad(solid, [P(s0, k0, y0), P(s0, k1, y0), P(s0, k1, y1), P(s0, k0, y1)], neg(u3), c); };
    const old = A.doc; let bounds = null; A.doc = doc;
    try {
      doc.items.filter(i => i.t === 'wall' && A.shown(i)).forEach(w => { st.walls++; const { g, boxes, panes } = A.wallPieces(w);
        boxes.forEach(b => box(w.a, g.u, g.n, b.s0, b.s1, -g.h, g.h, b.y0, b.y1, WALL));
        panes.forEach(p => { st.panes++; const P = (s, y) => [w.a[0] + g.u[0] * (p.s0 + s * (p.s1 - p.s0)), y, -(w.a[1] + g.u[1] * (p.s0 + s * (p.s1 - p.s0)))], n3 = [g.n[0], 0, -g.n[1]];
          const q = [[P(0, p.y0), P(1, p.y0), P(1, p.y1), P(0, p.y1)]][0]; quad(glass, q, n3, GLASS); }); });
      const b = bounds = A.bounds(); if (b) { const m = 1.5; box([b.x0 - m, b.y0 - m], [1, 0], [0, 1], 0, b.x1 - b.x0 + 2 * m, 0, b.y1 - b.y0 + 2 * m, -A.SLAB_T, 0, SLAB); st.boxes--; }
    } finally { A.doc = old; }
    return { solid: new Float32Array(solid), glass: new Float32Array(glass), stats: st, bounds };
  };
})();
