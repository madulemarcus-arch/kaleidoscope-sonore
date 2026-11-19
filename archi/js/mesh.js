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
    const base = [], solid = [], glass = [], st = { boxes: 0, panes: 0, walls: 0, furn: 0, cols: 0, beams: 0, roof: 'none', levels: 1, voiles: 0, rails: 0, claustra: 0, lintels: 0, joints: 0, stairs: 0, height: 0 };
    const tri = (out, p, n, c) => p.forEach(q => out.push(q[0], q[1], q[2], n[0], n[1], n[2], c[0], c[1], c[2], c[3]));
    const quad = (out, p, n, c) => tri(out, [p[0], p[1], p[2], p[0], p[2], p[3]], n, c);
    // Polygon with a computed normal: pointing up (slopes) or away from `away` (gables).
    const poly3 = (out, pts, c, away) => { let n = unit3(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0])));
      if (away) { const m = pts.reduce((s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]], [0, 0, 0]).map(x => x / pts.length); if (dot(n, sub(m, away)) < 0) n = n.map(x => -x); } else if (n[1] < 0) n = n.map(x => -x);
      pts.length === 3 ? tri(out, pts, n, c) : quad(out, pts, n, c); };
    // Box in a local frame: origin a, axes u (along) and n (across), ranges s, k, heights y0..y1 (plus the level offset YO). Bottom face skipped.
    let YO = 0;
    const box = (out, a, u, n, s0, s1, k0, k1, y0, y1, c) => { const P = (s, k, y) => [a[0] + u[0] * s + n[0] * k, y + YO, -(a[1] + u[1] * s + n[1] * k)], u3 = [u[0], 0, -u[1]], n3 = [n[0], 0, -n[1]], neg = v => v.map(x => -x);
      quad(out, [P(s0, k0, y1), P(s1, k0, y1), P(s1, k1, y1), P(s0, k1, y1)], [0, 1, 0], c);
      quad(out, [P(s0, k1, y0), P(s1, k1, y0), P(s1, k1, y1), P(s0, k1, y1)], n3, c); quad(out, [P(s0, k0, y0), P(s1, k0, y0), P(s1, k0, y1), P(s0, k0, y1)], neg(n3), c);
      quad(out, [P(s1, k0, y0), P(s1, k1, y0), P(s1, k1, y1), P(s1, k0, y1)], u3, c); quad(out, [P(s0, k0, y0), P(s0, k1, y0), P(s0, k1, y1), P(s0, k0, y1)], neg(u3), c); };
    // Vertical prism with a regular polygon section (round columns)
    const prism = (out, p, r, y0, y1, c, n = 16) => { const P = (i, y) => [p[0] + r * Math.cos(2 * Math.PI * i / n), y + YO, -(p[1] + r * Math.sin(2 * Math.PI * i / n))];
      for (let i = 0; i < n; i++) { const m = 2 * Math.PI * (i + 0.5) / n; quad(out, [P(i, y0), P(i + 1, y0), P(i + 1, y1), P(i, y1)], [Math.cos(m), 0, -Math.sin(m)], c); tri(out, [[p[0], y1 + YO, -p[1]], P(i, y1), P(i + 1, y1)], [0, 1, 0], c); } };
    // Flat quad on a wall face (joint lines): offset k along the normal, extent s0..s1 and y0..y1
    const face = (out, a, u, n, s0, s1, k, y0, y1, c) => { const P = (s, y) => [a[0] + u[0] * s + n[0] * k, y + YO, -(a[1] + u[1] * s + n[1] * k)], nn = [n[0] * Math.sign(k), 0, -n[1] * Math.sign(k)]; quad(out, [P(s0, y0), P(s1, y0), P(s1, y1), P(s0, y1)], nn, c); };
    const old = A.doc, oldLv = A.lvView; let bounds = null; A.doc = doc;
    try {
      const r = doc.render, N = A.nLevels(), Hl = doc.defaults.h, onl = it => { const l = A.layer(it.layer); return !l || l.on; }, allWalls = doc.items.filter(i => i.t === 'wall' && onl(i)), wallMat = A.MATS[r.wallMat] || A.MATS.crepi;
      const Hmax = allWalls.length ? Math.max(...allWalls.map(w => w.h)) : Hl, Hs = N === 1 ? Hmax : Hl, Htot = N === 1 ? Hmax : N * Hl, concrete = [0.62, 0.62, 0.64, 1], MORTAR = [0.74, 0.74, 0.72, 1];
      let wb = null; allWalls.forEach(w => A.wallGeom(w).poly.forEach(p => { wb = wb || { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 }; wb.x0 = Math.min(wb.x0, p[0]); wb.y0 = Math.min(wb.y0, p[1]); wb.x1 = Math.max(wb.x1, p[0]); wb.y1 = Math.max(wb.y1, p[1]); }));
      st.levels = N; st.height = Htot; let jbudget = 60000;
      const sz = A.struct.sizes(), tl = (A.doc.struct.result && A.doc.struct.result.hs) || 0.15;
      for (let lv = 0; lv < N; lv++) { A.lvView = lv; YO = lv * Hl;
        const walls = r.walls === false ? [] : doc.items.filter(i => i.t === 'wall' && A.shown(i));
        walls.forEach(w => { st.walls++; const { g, boxes, panes } = A.wallPieces(w), wt = A.lib ? A.lib.wallType(w) : null, c = rgba(wt ? wt.b.c : (A.MATS[w.mat] || wallMat)[1]); st.boxes += boxes.length;
          boxes.forEach(b => box(solid, w.a, g.u, g.n, b.s0, b.s1, -g.h, g.h, b.y0, b.y1, c));
          panes.forEach(p => { st.panes++; const P = (s, y) => [w.a[0] + g.u[0] * (p.s0 + s * (p.s1 - p.s0)), y + YO, -(w.a[1] + g.u[1] * (p.s0 + s * (p.s1 - p.s0)))]; quad(glass, [P(0, p.y0), P(1, p.y0), P(1, p.y1), P(0, p.y1)], [g.n[0], 0, -g.n[1]], GLASS); });
          if (wt) { const bk = wt.b, jt = wt.s.joint || 0.01, stepY = bk.H + jt, stepX = bk.L + jt;   // mortar joints of the bond (courses and staggered head joints) on both faces
            boxes.forEach(b => { for (const k of [g.h + 0.0012, -g.h - 0.0012]) { for (let y = b.y0 + stepY, row = 1; y < b.y1 - 1e-4 && jbudget > 0; y += stepY, row++) { face(solid, w.a, g.u, g.n, b.s0, b.s1, k, y - jt, y, MORTAR); jbudget -= 1; st.joints++; }
                for (let row = 0, y = b.y0; y < b.y1 - 1e-4 && jbudget > 0; y += stepY, row++) for (let s = b.s0 + (row % 2 ? stepX / 2 : stepX); s < b.s1 - 1e-4 && jbudget > 0; s += stepX) { face(solid, w.a, g.u, g.n, s - jt, s, k, y, Math.min(y + bk.H, b.y1), MORTAR); jbudget -= 1; st.joints++; } } });
            if (wt.s.lint !== false) { const ls = A.lib.active('lintel'), ap = ls ? ls.app : 0.25, lh = ls ? ls.h : 0.2, lc = rgba(A.lib.color(ls ? ls.mat : 'c25'));
              A.openings(w).forEach(o => { const top = o.sill + o.h; if (top >= w.h - 1e-4) return; const cc = A.openPos(o, w), q = o.w / 2 + ap; st.lintels++; box(solid, w.a, g.u, g.n, Math.max(-g.ea, cc - q), Math.min(g.len + g.eb, cc + q), -g.h - 0.002, g.h + 0.002, top, Math.min(w.h, top + lh), lc); }); } }
          A.openings(w).filter(o => o.t === 'claustra').forEach(o => { const sc = A.lib && A.lib.sec(o.ct), m = sc ? sc.mod : 0.2, e = sc ? sc.e : 0.1, nx = Math.max(1, Math.round(o.w / m)), ny = Math.max(1, Math.round(o.h / m)), cc = A.openPos(o, w), cl = rgba(A.lib ? A.lib.color(sc ? sc.mat : 'mac') : [0.9, 0.88, 0.8]); st.claustra++;
            if (nx * ny > 900) return; for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const on = !sc || sc.motif === 'damier' ? (i + j) % 2 === 0 : sc.motif === 'barreaux' ? i % 2 === 0 : (i + j) % 3 !== 0; if (on) box(solid, w.a, g.u, g.n, cc - o.w / 2 + i * o.w / nx, cc - o.w / 2 + (i + 1) * o.w / nx, -e / 2, e / 2, o.sill + j * o.h / ny, o.sill + (j + 1) * o.h / ny, cl); } }); });
        doc.items.filter(i => i.t === 'furn' && A.shown(i)).forEach(f => { st.furn++; const a = (f.rot || 0) * Math.PI / 180, u = [Math.cos(a), Math.sin(a)], k = A.FURN[f.kind] || A.FURN.table;
          box(solid, f.p, u, [-u[1], u[0]], -f.w / 2, f.w / 2, -f.d / 2, f.d / 2, 0, f.h, rgba(k[4])); });
        doc.items.filter(i => i.t === 'voile' && A.shown(i)).forEach(v => { const u = A.unit(v.a, v.b), n = A.normal(u); st.voiles++; box(solid, v.a, u, n, 0, A.dist(v.a, v.b), -v.th / 2, v.th / 2, 0, v.h || Hl, [0.58, 0.59, 0.61, 1]); });
        doc.items.filter(i => i.t === 'rail' && A.shown(i)).forEach(rl => { const s = A.lib && A.lib.sec(rl.rt); if (!s) return; st.rails++; const u = A.unit(rl.a, rl.b), n = A.normal(u), len = A.dist(rl.a, rl.b), h = s.h, c = rgba(A.lib.color(s.mat));
          if (s.kind === 'plein') { box(solid, rl.a, u, n, 0, len, -s.sec / 2, s.sec / 2, 0, h, c); return; }
          box(solid, rl.a, u, n, 0, len, -0.03, 0.03, h - 0.05, h, c);
          if (s.kind === 'verre') { const P = (t, y) => [rl.a[0] + u[0] * t, y + YO, -(rl.a[1] + u[1] * t)]; quad(glass, [P(0, 0.1), P(len, 0.1), P(len, h - 0.05), P(0, h - 0.05)], [n[0], 0, -n[1]], GLASS); quad(glass, [P(0, 0.1), P(0, h - 0.05), P(len, h - 0.05), P(len, 0.1)], [-n[0], 0, n[1]], GLASS); }
          else if (s.kind === 'lisses') for (let i = 1; i <= 4; i++) box(solid, rl.a, u, n, 0, len, -s.sec / 2, s.sec / 2, 0.1 + (i - 1) * (h - 0.2) / 3 - s.sec / 2, 0.1 + (i - 1) * (h - 0.2) / 3 + s.sec / 2, c);
          else { box(solid, rl.a, u, n, 0, len, -0.025, 0.025, 0.06, 0.1, c); const nb = Math.floor(len / (s.esp + s.sec)); if (nb < 400) for (let i = 0; i < nb; i++) { const x = (i + 0.5) * len / nb; box(solid, rl.a, u, n, x - s.sec / 2, x + s.sec / 2, -s.sec / 2, s.sec / 2, 0.1, h - 0.05, c); } }
          const np = Math.max(1, Math.round(len / (s.post || 1.2))); for (let i = 0; i <= np; i++) { const x = i * len / np; box(solid, rl.a, u, n, Math.max(0, x - 0.03), Math.min(len, x + 0.03), -0.03, 0.03, 0, h, c); } });
        if (A.stairs && A.stairs.mesh) A.stairs.mesh(doc, { box, prism, quad, tri, solid, glass, st, rgba, Hl, lv });
        if (r.structure) { A.struct.columns().forEach(c => { const sc = c.sec && A.lib ? A.lib.sec(c.sec) : null, d = A.colDims(c), a = sz.col[c.id] || c.a, col = sc ? rgba(A.lib.color(sc.mat)) : concrete; st.cols++;
            if (d.shape === 'circ') prism(solid, c.p, Math.max(d.b, a) / 2 + 0.004, 0, Hs + 0.006, col); else { const w = Math.max(d.b, a * (d.b >= d.h ? 1 : d.b / d.h)) , h2 = Math.max(d.h, a * (d.h >= d.b ? 1 : d.h / d.b)); box(solid, c.p, [1, 0], [0, 1], -(sz.col[c.id] ? a : d.b) / 2 - 0.004, (sz.col[c.id] ? a : d.b) / 2 + 0.004, -(sz.col[c.id] ? a : d.h) / 2 - 0.004, (sz.col[c.id] ? a : d.h) / 2 + 0.004, 0, Hs + 0.006, col); } });
          A.struct.beams().forEach(b => { const sc = b.sec && A.lib ? A.lib.sec(b.sec) : null, s = sz.beam[b.k] || (sc ? { b: sc.b, h: sc.h } : { b: 0.2, h: 0.3 }), u = A.unit(b.ca.p, b.cb.p); st.beams++; box(solid, b.ca.p, u, A.normal(u), 0, b.L, -s.b / 2 - 0.004, s.b / 2 + 0.004, Hs - s.h, Hs + 0.003, sc ? rgba(A.lib.color(sc.mat)) : concrete); }); }
        if (lv > 0 && wb) { let pieces = [[wb.x0, wb.y0, wb.x1, wb.y1]];   // floor slab of this level, with an opening (trémie) above every stair that starts on the level below
          doc.items.filter(i => i.t === 'stair' && onl(i) && A.atLevel(i, lv - 1) && A.stairs).forEach(sx => { const pts = A.stairs.world(sx, A.stairs.calcItem(sx)).steps.flatMap(s => s.poly), h = [Math.min(...pts.map(p => p[0])) - 0.02, Math.min(...pts.map(p => p[1])) - 0.02, Math.max(...pts.map(p => p[0])) + 0.02, Math.max(...pts.map(p => p[1])) + 0.02], next = [];
            pieces.forEach(([x0, y0, x1, y1]) => { if (h[0] >= x1 || h[2] <= x0 || h[1] >= y1 || h[3] <= y0) { next.push([x0, y0, x1, y1]); return; }
              if (h[0] > x0) next.push([x0, y0, h[0], y1]); if (h[2] < x1) next.push([h[2], y0, x1, y1]); const a = Math.max(x0, h[0]), b = Math.min(x1, h[2]); if (h[1] > y0) next.push([a, y0, b, h[1]]); if (h[3] < y1) next.push([a, h[3], b, y1]); }); pieces = next; });
          st.slabPieces = (st.slabPieces || 0) + pieces.length; pieces.forEach(([x0, y0, x1, y1]) => box(solid, [x0, y0], [1, 0], [0, 1], 0, x1 - x0, 0, y1 - y0, -tl, 0, [0.70, 0.70, 0.71, 1])); }
      }
      YO = 0;
      if (wb) { const H = Htot, o = r.over, tn = Math.tan(r.slope * Math.PI / 180), fl = rgba((A.FLOORS[r.floorMat] || A.FLOORS.carrelage)[1]), rc = rgba((A.ROOFMATS[r.roofMat] || A.ROOFMATS.tuile)[1]), wc = rgba(wallMat[1]);
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
    } finally { A.doc = old; A.lvView = oldLv; }
    return { base: new Float32Array(base), solid: new Float32Array(solid), glass: new Float32Array(glass), stats: st, bounds };
  };
})();
