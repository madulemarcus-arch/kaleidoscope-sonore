// Structural pre-sizing to BAEL 91 (revised 99): slabs, beams, columns and isolated footings.
// Units inside the formulas: MPa, MN, m, m2 (loads in kN are divided by 1000). Results are a pre-sizing aid and must be checked by an engineer.
(function () {
  const A = window.App, S = A.struct = {}, TOL = 0.15, GB = 1.5, GS = 1.15, GC = 25, ES = 200000;
  const ceilTo = (v, s) => Math.ceil(v / s - 1e-9) * s, r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100, cm2 = m2 => m2 * 1e4;
  const pairKey = (a, b) => a < b ? a + '|' + b : b + '|' + a;

  // ---------- material constants and section formulas ----------
  S.mat = p => { const fbu = 0.85 * p.fc28 / GB, ft28 = 0.6 + 0.06 * p.fc28, ss = p.fe / GS, al = 3.5 / (3.5 + 1000 * ss / ES), mul = 0.8 * al * (1 - 0.4 * al);
    return { fc: p.fc28, fe: p.fe, fbu, ft28, ss, alphaL: al, muL: mul, tauLim: Math.min(0.15 * p.fc28 / GB, 4), ssSer: Math.min(2 / 3 * p.fe, 110 * Math.sqrt(1.6 * ft28)) }; };
  // Rectangular section in simple bending (ELU). Mu in MN.m, b and d in m. As is returned in cm2.
  S.flex = (Mu, b, d, m) => { const mu = Mu / (b * d * d * m.fbu); if (mu > m.muL) return { ok: false, mu }; const al = 1.25 * (1 - Math.sqrt(1 - 2 * mu)), z = d * (1 - 0.4 * al); return { ok: true, mu, alpha: al, z, As: cm2(Mu / (z * m.ss)) }; };
  // Two-way slab moments (BAEL annex E3, nu = 0). Returns the coefficients and the span moments per metre in kN.m/m.
  S.slabMoments = (lx, ly, pu) => { const a = lx / ly; if (a < 0.4) { const M0x = pu * lx * lx / 8; return { alpha: a, oneWay: true, mux: null, muy: null, M0x, M0y: M0x / 4 }; }
    const mux = 1 / (8 * (1 + 2.4 * Math.pow(a, 3))), muy = a * a * (1 - 0.95 * Math.pow(1 - a, 2)), M0x = mux * pu * lx * lx; return { alpha: a, oneWay: false, mux, muy, M0x, M0y: muy * M0x }; };
  // Equivalent uniform loads (kN/m) a panel gives a beam: moment (m) and shear (v). edge = 'short' or 'long'.
  S.panelLoad = (p, lx, ly, edge) => { const a = lx / ly, q0 = p * lx / 2;
    if (a < 0.4) return edge === 'long' ? { m: q0, v: q0 } : { m: 0, v: 0 };
    return edge === 'short' ? { m: p * lx / 3, v: p * lx / 4 } : { m: q0 * (1 - a * a / 3), v: q0 * (1 - a / 2) }; };
  // Short-column check (BAEL B.8.4): required longitudinal steel in cm2 for a square a x a column.
  S.column = (Nu, a, l0, m) => { const lf = 0.7 * l0, lam = lf * Math.sqrt(12) / a, al = lam <= 50 ? 0.85 / (1 + 0.2 * Math.pow(lam / 35, 2)) : 0.6 * Math.pow(50 / lam, 2), Br = Math.pow(a - 0.02, 2), B = a * a;
    const Areq = (Nu / al - Br * m.fc / (0.9 * GB)) * GS / m.fe, Amin = Math.max(4 * 4 * a, 0.2 * B * 100) / 1e4, Amax = 5 * B / 100; return { lam, alpha: al, Br, Areq: cm2(Areq), Amin: cm2(Amin), Amax: cm2(Amax), As: cm2(Math.max(Areq, Amin)) }; };
  // Isolated square footing: plan side A (m), height h, steel (cm2 per direction), from the strut method.
  S.footing = (Nu, Ns, a, sigSol, m) => { const A0 = Math.sqrt(1.1 * Ns / (sigSol * 1000)), side = Math.max(ceilTo(A0, 0.05), a + 0.3), d = Math.max(ceilTo((side - a) / 4, 0.05), 0.2), h = d + 0.05;
    const Asu = cm2(Nu / 1000 * (side - a) / (8 * d * m.ss)), Ass = cm2(Ns / 1000 * (side - a) / (8 * d * m.ssSer)); return { side, d, h, Asu, Ass, As: Math.max(Asu, Ass), sigma: 1.1 * Ns / (side * side) / 1000 }; };

  // ---------- reinforcement choices ----------
  const area = d => Math.PI * Math.pow(d / 10, 2) / 4;            // cm2 for a diameter in mm
  S.beamBars = (As, b) => { for (const d of [10, 12, 14, 16, 20, 25]) { const n = Math.max(2, Math.ceil(As / area(d) - 1e-9)), maxN = Math.max(2, Math.floor((b * 1000 - 60 + 25) / (d + 25))); if (n <= maxN) return { n, d, text: n + 'HA' + d, As: n * area(d) }; } const d = 25, n = Math.ceil(As / area(d)); return { n, d, text: n + 'HA25', As: n * area(d) }; };
  S.slabBars = (As, h, main) => { const smax = main ? Math.min(300 * h, 33) : Math.min(400 * h, 45);
    for (const d of [8, 10, 12, 14]) { const s = Math.floor(100 * area(d) / As / 5) * 5; if (s >= 10 || d === 14) { const e = Math.max(5, Math.min(s, Math.floor(smax / 5) * 5)); return { d, e, text: 'HA' + d + ' e=' + e, As: 100 * area(d) / e }; } } };
  S.colBars = As => { for (const d of [12, 14, 16, 20, 25]) { let n = Math.max(4, Math.ceil(As / area(d) - 1e-9)); if (n % 2) n++; if (n <= 12) return { n, d, text: n + 'HA' + d, As: n * area(d) }; } const d = 25, n = Math.ceil(As / area(d)); return { n, d, text: n + 'HA25', As: n * area(d) }; };
  S.footBars = (As, side) => { for (const d of [10, 12, 14, 16]) { const n = Math.max(4, Math.ceil(As / area(d) - 1e-9)), e = (side - 0.1) / (n - 1); if (e >= 0.10) return { n, d, e: Math.floor(e * 100), text: n + 'HA' + d + ' par sens', As: n * area(d) }; } const d = 20, n = Math.ceil(As / area(d)); return { n, d, e: 10, text: n + 'HA20 par sens', As: n * area(d) }; };

  // ---------- geometry: columns, beams, panels ----------
  S.columns = () => A.doc.items.filter(i => i.t === 'col' && A.shown(i));
  S.labels = () => { const cols = S.columns().slice().sort((p, q) => (Math.round(q.p[1] * 10) - Math.round(p.p[1] * 10)) || (p.p[0] - q.p[0])), m = {}; cols.forEach((c, i) => { m[c.id] = 'P' + (i + 1); }); return m; };
  // Beams run between consecutive columns lying on a wall axis, plus the beams drawn by hand between two columns.
  S.beams = () => { const cols = S.columns(), list = [], seen = new Set(), near = p => cols.find(c => A.dist(c.p, p) <= TOL);
    const add = (c1, c2, manual) => { if (!c1 || !c2 || c1 === c2 || A.dist(c1.p, c2.p) < 0.3) return; const k = pairKey(c1.id, c2.id); if (seen.has(k)) return; seen.add(k); list.push({ k, ca: c1, cb: c2, L: A.dist(c1.p, c2.p), manual }); };
    A.doc.items.filter(i => i.t === 'wall' && A.shown(i)).forEach(w => { const on = cols.map(c => ({ c, s: A.segDist(c.p, w.a, w.b) })).filter(x => x.s.d <= TOL).sort((p, q) => p.s.t - q.s.t); for (let i = 0; i + 1 < on.length; i++) add(on[i].c, on[i + 1].c, false); });
    A.doc.items.filter(i => i.t === 'beam' && A.shown(i)).forEach(b => add(near(b.a), near(b.b), true));
    list.sort((p, q) => (Math.round((q.ca.p[1] + q.cb.p[1]) * 5) - Math.round((p.ca.p[1] + p.cb.p[1]) * 5)) || (p.ca.p[0] + p.cb.p[0] - q.ca.p[0] - q.cb.p[0])); list.forEach((b, i) => { b.id = 'PO' + (i + 1); }); return list; };
  // Rectangular panels closed by beams: every side may be made of several collinear beams, and nothing may cross the interior.
  S.cells = (cols, beams) => { const xs = [], ys = [], uniq = (arr, v) => { if (!arr.some(u => Math.abs(u - v) < TOL)) arr.push(v); }; cols.forEach(c => { uniq(xs, c.p[0]); uniq(ys, c.p[1]); }); xs.sort((p, q) => p - q); ys.sort((p, q) => p - q);
    const hor = beams.filter(b => Math.abs(b.ca.p[1] - b.cb.p[1]) < TOL), ver = beams.filter(b => Math.abs(b.ca.p[0] - b.cb.p[0]) < TOL), lo = (u, v) => Math.min(u, v), hi = (u, v) => Math.max(u, v), out = [];
    // beams lying on the line at `pos`, covering [a, b] without gap (returns them, or null)
    const chain = (list, axis, pos, a, b) => { const on = list.filter(x => Math.abs((x.ca.p[1 - axis] + x.cb.p[1 - axis]) / 2 - pos) < TOL).map(x => ({ x, s: lo(x.ca.p[axis], x.cb.p[axis]), e: hi(x.ca.p[axis], x.cb.p[axis]) })).filter(r => r.e > a + TOL && r.s < b - TOL).sort((p, q) => p.s - q.s);
      let cur = a; const used = []; for (const r of on) { if (r.s > cur + TOL) return null; cur = Math.max(cur, r.e); used.push(r.x); } return cur >= b - TOL ? used : null; };
    for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) for (let k = 0; k < ys.length; k++) for (let l = k + 1; l < ys.length; l++) {
      const x0 = xs[i], x1 = xs[j], y0 = ys[k], y1 = ys[l], w = x1 - x0, h = y1 - y0; if (w < 0.5 || h < 0.5) continue;
      const bot = chain(hor, 0, y0, x0, x1), top = chain(hor, 0, y1, x0, x1), left = chain(ver, 1, x0, y0, y1), right = chain(ver, 1, x1, y0, y1); if (!bot || !top || !left || !right) continue;
      const crossing = hor.some(b => { const y = (b.ca.p[1] + b.cb.p[1]) / 2; return y > y0 + TOL && y < y1 - TOL && hi(b.ca.p[0], b.cb.p[0]) > x0 + TOL && lo(b.ca.p[0], b.cb.p[0]) < x1 - TOL; }) ||
        ver.some(b => { const x = (b.ca.p[0] + b.cb.p[0]) / 2; return x > x0 + TOL && x < x1 - TOL && hi(b.ca.p[1], b.cb.p[1]) > y0 + TOL && lo(b.ca.p[1], b.cb.p[1]) < y1 - TOL; }) || cols.some(c => c.p[0] > x0 + TOL && c.p[0] < x1 - TOL && c.p[1] > y0 + TOL && c.p[1] < y1 - TOL);
      if (crossing) continue; out.push({ w, h, lx: Math.min(w, h), ly: Math.max(w, h), x0, y0, x1, y1, edges: [{ bs: bot, len: w }, { bs: top, len: w }, { bs: left, len: h }, { bs: right, len: h }] }); }
    return out; };
  // Wall line load (kN/m per metre of beam) from a collinear wall, reduced by its openings.
  S.wallLoad = (beam, p, hb) => { const dir = A.unit(beam.ca.p, beam.cb.p), mid = [(beam.ca.p[0] + beam.cb.p[0]) / 2, (beam.ca.p[1] + beam.cb.p[1]) / 2]; let best = 0;
    A.doc.items.filter(i => i.t === 'wall' && A.shown(i)).forEach(w => { const u = A.unit(w.a, w.b); if (Math.abs(u[0] * dir[1] - u[1] * dir[0]) > 0.05 || A.segDist(mid, w.a, w.b).d > TOL) return;
      const len = A.dist(w.a, w.b), open = A.openings(w).reduce((s, o) => s + o.w * Math.min(o.h, w.h), 0), frac = Math.min(0.9, open / (len * w.h)); best = Math.max(best, p.wallLoad * Math.max(0, w.h - hb) * (1 - frac)); }); return best; };
  S.sig = doc => { const old = A.doc; A.doc = doc; try { return JSON.stringify([doc.struct.p, doc.items.filter(i => i.t === 'col' || i.t === 'beam').map(i => [i.t, i.p || i.a, i.b || i.a || 0]), doc.items.filter(i => i.t === 'wall').map(w => [w.a, w.b, w.th, w.h, A.openings(w).map(o => [o.pos, o.w, o.h])])]); } finally { A.doc = old; } };

  // Columns on every wall corner/end and along long walls (spacing <= maxSpan). Returns the new points only.
  S.autoPoints = () => { const p = A.doc.struct.p, pts = [], have = q => pts.some(o => A.dist(o, q) < 0.1) || S.columns().some(c => A.dist(c.p, q) < 0.1), put = q => { q = [Math.round(q[0] * 100) / 100, Math.round(q[1] * 100) / 100]; if (!have(q)) pts.push(q); };
    A.doc.items.filter(i => i.t === 'wall' && A.shown(i)).forEach(w => { const n = Math.max(1, Math.ceil(A.dist(w.a, w.b) / p.maxSpan - 1e-9)); for (let i = 0; i <= n; i++) put([w.a[0] + (w.b[0] - w.a[0]) * i / n, w.a[1] + (w.b[1] - w.a[1]) * i / n]); }); return pts; };
  S.autoColumns = () => { const pts = S.autoPoints(); if (!pts.length) return 0; A.edit(d => pts.forEach(q => d.items.push({ id: A.uid(), t: 'col', p: q, a: 0.2, layer: A.layer('str') ? 'str' : d.active }))); return pts.length; };

  // ---------- the calculation ----------
  S.compute = doc => { const old = A.doc; A.doc = doc; try { return compute(doc); } finally { A.doc = old; } };
  function compute(doc) {
    const p = doc.struct.p, m = S.mat(p), warn = [], res = { params: Object.assign({}, p), mat: m, warnings: warn, errors: [], sig: S.sig(doc), columns: [], beams: [], panels: [], slab: null };
    const cols = S.columns(); if (!cols.length) { res.errors.push('Aucun poteau : posez des poteaux (outil Poteau, touche P) ou utilisez « Placer les poteaux automatiquement ».'); return res; }
    const lab = S.labels(), beams = S.beams(), cells = S.cells(cols, beams), walls = doc.items.filter(i => i.t === 'wall' && A.shown(i)), H = walls.length ? Math.max(...walls.map(w => w.h)) : doc.defaults.h;
    const nInter = Math.max(0, Math.round(p.nlev) - 1), topSlab = p.top === 'dalle', needSlab = nInter >= 1 || topSlab;
    if (!beams.length) warn.push('Aucune poutre trouvée : les poutres se déduisent des poteaux alignés sur un mur ou reliés par une poutre dessinée.');
    // --- slab thickness: smallest h (cm steps) that passes bending and shear on every panel
    const setF = h => ({ g: GC * h + p.G2, q: p.Q }), setT = h => topSlab ? { g: GC * h + p.G2top, q: p.Qtop } : { g: p.Groof, q: p.Qroof }, gov = h => nInter >= 1 ? setF(h) : setT(h);
    let hs = 0, panelsOut = [];
    if (needSlab && cells.length) {
      let h0 = Math.max(0.12, ceilTo(Math.max(...cells.map(c => c.lx / (c.lx / c.ly >= 0.4 ? 40 : 30))), 0.01)), ok = false;
      for (let h = h0; h <= 0.40 + 1e-9; h = Math.round((h + 0.01) * 100) / 100) { const L = gov(h), pu = 1.35 * L.g + 1.5 * L.q; let all = true; const out = [];
        cells.forEach(c => { const mo = S.slabMoments(c.lx, c.ly, pu), dx = h - 0.03, dy = h - 0.04, ft = (M, d) => S.flex(M / 1000, 1, d, m), tx = ft(0.85 * mo.M0x, dx), ty = ft(0.85 * mo.M0y, dy), ax = ft(0.5 * mo.M0x, dx), ay = ft(0.5 * mo.M0y, dy);
          const Vu = mo.oneWay ? pu * c.lx / 2 : pu * c.lx / (2 + mo.alpha), tau = Vu / 1000 / dx, tauLim = 0.07 * m.fc / GB; if (!(tx.ok && ty.ok && ax.ok && ay.ok) || tau > tauLim) all = false; out.push({ c, mo, tx, ty, ax, ay, Vu, tau, tauLim, pu, dx, dy }); });
        if (all) { hs = h; panelsOut = out; ok = true; break; } }
      if (!ok) { hs = 0.40; warn.push('Dalle : épaisseur de 40 cm insuffisante, réduisez les portées (ajoutez des poteaux ou des poutres).'); }
      else if (hs > 0.25) warn.push('Dalle épaisse (' + Math.round(hs * 100) + ' cm) : envisagez des poutres intermédiaires ou un plancher à corps creux.');
    } else if (needSlab) warn.push('Aucune dalle rectangulaire fermée par quatre poutres : épaisseur de dalle non calculée (15 cm par défaut).');
    if (needSlab && !hs) hs = 0.15;
    const Lf = nInter >= 1 ? setF(hs) : null, Lt = setT(hs), puF = Lf ? 1.35 * Lf.g + 1.5 * Lf.q : 0, psF = Lf ? Lf.g + Lf.q : 0, puT = 1.35 * Lt.g + 1.5 * Lt.q, psT = Lt.g + Lt.q;
    res.slab = needSlab ? { h: hs, panels: panelsOut.map((o, i) => { const c = o.c, mo = o.mo, bar = (r, mn, main) => S.slabBars(Math.max(r.As, mn), hs, main), ymin = 6 * hs, xmin = ymin * (3 - Math.max(mo.alpha, 0.4)) / 2;
      return { id: 'D' + (i + 1), lx: c.lx, ly: c.ly, alpha: mo.alpha, oneWay: mo.oneWay, mux: mo.mux, muy: mo.muy, M0x: mo.M0x, M0y: mo.M0y, pu: o.pu, tau: o.tau, tauLim: o.tauLim,
        Atx: Math.max(o.tx.As, xmin), Aty: Math.max(o.ty.As, ymin), Aax: Math.max(o.ax.As, xmin * 0.5), Aay: Math.max(o.ay.As, ymin * 0.5), barTx: bar(o.tx, xmin, true), barTy: bar(o.ty, ymin, false), barAx: bar(o.ax, xmin * 0.5, true), barAy: bar(o.ay, ymin * 0.5, false), x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1 }; }) } : null;
    panelsOut = null;
    // --- load a set (ELU pu / ELS ps) puts on every beam, summed over adjacent panels
    const slabOn = (pu, ps) => { const o = new Map(beams.map(b => [b.k, { um: 0, uv: 0, sm: 0, sv: 0 }])); cells.forEach(c => c.edges.forEach(e => { const edge = e.len <= c.lx + 0.01 ? 'short' : 'long', U = S.panelLoad(pu, c.lx, c.ly, edge), Sv = S.panelLoad(ps, c.lx, c.ly, edge); e.bs.forEach(b => { const t = o.get(b.k); t.um += U.m; t.uv += U.v; t.sm += Sv.m; t.sv += Sv.v; }); })); return o; };
    const govLoad = nInter >= 1 ? slabOn(puF, psF) : slabOn(puT, psT), floorLoad = Lf ? slabOn(puF, psF) : null, topLoad = slabOn(puT, psT);
    // --- beams: smallest section passing bending (no compression steel) and shear
    const bm = new Map();
    beams.forEach(bw => { const sl = govLoad.get(bw.k); let b = 0.20, h = Math.max(0.25, ceilTo(bw.L / 12, 0.05)), out = null;
      for (let n = 0; n < 60; n++) { const self = GC * b * h, wall = S.wallLoad(bw, p, h), pm = sl.um + 1.35 * (self + wall), pv = sl.uv + 1.35 * (self + wall), M0 = pm * bw.L * bw.L / 8, Vu = pv * bw.L / 2, d = h - 0.04;
        const f = S.flex(0.85 * M0 / 1000, b, d, m), fa = S.flex(0.5 * M0 / 1000, b, d, m), tau = Vu / 1000 / (b * d);
        if (f.ok && fa.ok && tau <= m.tauLim) { const Amin = cm2(0.23 * b * d * m.ft28 / m.fe), Ast = Math.max(f.As, Amin), Aa = Math.max(fa.As, Amin), k = Math.max(0, tau - 0.3 * m.ft28), At = 2 * area(6) * 1e-4;
          let stM = Math.min(0.40, 0.9 * d, At * m.fe / (0.4 * b)); if (k > 0) stM = Math.min(stM, At / (b * k / (0.9 * m.ss))); const st = Math.max(5, Math.floor(stM * 100 / 5) * 5);
          out = { b, h, d, M0, Mt: 0.85 * M0, Ma: 0.5 * M0, Vu, tau, Ast, Aa, barT: S.beamBars(Ast, b), barA: S.beamBars(Aa, b), st, self, wall, pu: pm }; break; }
        if (h < 0.70 - 1e-9) h = Math.round((h + 0.05) * 100) / 100; else { b = Math.round((b + 0.05) * 100) / 100; h = Math.max(0.25, ceilTo(bw.L / 12, 0.05)); } }
      if (!out) { warn.push('Poutre ' + bw.id + ' : section non trouvée (portée trop grande), ajoutez un poteau.'); out = { b: 0.3, h: 0.7, d: 0.66, M0: 0, Mt: 0, Ma: 0, Vu: 0, tau: 0, Ast: 0, Aa: 0, barT: { text: '—' }, barA: { text: '—' }, st: 15, self: 0, wall: 0, pu: 0, failed: true }; }
      bm.set(bw.k, out); });
    // --- reactions at the beam ends, per level set
    const react = (bw, ld, ult) => { const s = ld.get(bw.k), o = bm.get(bw.k), wall = 0, line = (ult ? s.uv + 1.35 * (o.self + o.wall) : s.sv + o.self + o.wall); return line * bw.L / 2; };
    res.beams = beams.map(bw => { const o = bm.get(bw.k), sl = govLoad.get(bw.k); return { id: bw.id, k: bw.k, ca: bw.ca.id, cb: bw.cb.id, from: lab[bw.ca.id], to: lab[bw.cb.id], p1: bw.ca.p, p2: bw.cb.p, L: bw.L, manual: bw.manual, ...o, slabPm: sl.um, slabPv: sl.uv }; });
    // --- columns
    const hbMax = id => Math.max(0.25, ...beams.filter(b => b.ca.id === id || b.cb.id === id).map(b => bm.get(b.k).h));
    cols.forEach(c => { const mine = beams.filter(b => b.ca.id === c.id || b.cb.id === c.id), l0 = Math.max(1.5, H - hbMax(c.id));
      let Ru = 0, Rs = 0; const dirs = []; mine.forEach(b => { const other = b.ca.id === c.id ? b.cb : b.ca, u = A.unit(c.p, other.p); dirs.push(u);
        const ru = (nInter ? nInter * react(b, floorLoad, true) : 0) + react(b, topLoad, true), rs = (nInter ? nInter * react(b, floorLoad, false) : 0) + react(b, topLoad, false); Ru += ru; Rs += rs; });
      const cont = dirs.some((u, i) => dirs.some((v, j) => j > i && u[0] * v[0] + u[1] * v[1] < -0.95)), cf = cont ? 1.10 : 1.0; Ru *= cf; Rs *= cf;
      const amin = Math.max(0.20, ceilTo(Math.max(0, ...walls.filter(w => A.segDist(c.p, w.a, w.b).d <= TOL).map(w => w.th)), 0.05)), levels = Math.max(1, Math.round(p.nlev)); let a = amin, out = null;
      for (; a <= 0.60 + 1e-9; a = Math.round((a + 0.05) * 100) / 100) { const Nu = Ru + 1.35 * GC * a * a * H * levels, r = S.column(Nu / 1000, a, l0, m); if (r.Areq <= 0.02 * a * a * 1e4 && r.lam <= 70) { out = { a, Nu, Ns: Rs + GC * a * a * H * levels, r }; break; } }
      let failed = false; if (!out) { a = 0.60; const Nu = Ru + 1.35 * GC * a * a * H * levels; out = { a, Nu, Ns: Rs + GC * a * a * H * levels, r: S.column(Nu / 1000, a, l0, m) }; failed = true; warn.push('Poteau ' + lab[c.id] + ' : 60 × 60 cm insuffisant, réduisez la charge (ajoutez des poteaux) ou étudiez-le avec un ingénieur.'); }
      if (!mine.length) warn.push('Poteau ' + lab[c.id] + ' : aucune poutre ne l\'atteint, sa charge est limitée à son poids propre.');
      const bars = S.colBars(out.r.As), ft = S.footing(out.Nu, out.Ns, out.a, p.sigSol, m);
      res.columns.push({ id: c.id, label: lab[c.id], p: c.p, a: out.a, l0, Nu: out.Nu, Ns: out.Ns, lam: out.r.lam, alpha: out.r.alpha, Areq: out.r.Areq, Amin: out.r.Amin, Amax: out.r.Amax, bars, tie: out.a >= 0.2 ? 'cadres HA6 e=' + Math.floor(Math.min(15 * bars.d / 10, 40, out.a * 100 + 10) / 5) * 5 + ' cm' : '', failed, continuous: cont, beams: mine.map(b => b.id), footing: { ...ft, bars: S.footBars(ft.As, ft.side) } }); });
    res.columns.sort((q, r) => parseInt(q.label.slice(1)) - parseInt(r.label.slice(1)));
    // footings that touch each other
    for (let i = 0; i < res.columns.length; i++) for (let j = i + 1; j < res.columns.length; j++) { const u = res.columns[i], v = res.columns[j], f1 = u.footing.side / 2, f2 = v.footing.side / 2; if (Math.abs(u.p[0] - v.p[0]) < f1 + f2 - 0.001 && Math.abs(u.p[1] - v.p[1]) < f1 + f2 - 0.001) warn.push('Semelles de ' + u.label + ' et ' + v.label + ' qui se chevauchent : prévoyez une semelle filante ou un radier.'); }
    res.H = H; res.hs = hs; res.sigSol = p.sigSol; res.totals = { Nu: res.columns.reduce((s, c) => s + c.Nu, 0), Ns: res.columns.reduce((s, c) => s + c.Ns, 0) };
    if (p.sigSol < 0.1) warn.push('Contrainte admissible du sol très faible (' + p.sigSol + ' MPa) : étude de sol indispensable.');
    return res;
  }

  S.run = () => { const r = S.compute(A.doc); A.doc.struct.result = r; A.save(); A.emit(); return r; };
  S.stale = () => { const r = A.doc.struct && A.doc.struct.result; return !!r && !r.errors.length && r.sig !== S.sig(A.doc); };
  // Section sizes used by the 3D view and the plan overlay: computed ones when available and up to date, otherwise defaults.
  S.sizes = () => { const r = A.doc.struct.result, out = { col: {}, beam: {}, foot: {}, hs: null }; if (!r || r.errors.length) return out; r.columns.forEach(c => { out.col[c.id] = c.a; out.foot[c.id] = c.footing; }); r.beams.forEach(b => { out.beam[b.k] = { b: b.b, h: b.h }; }); out.hs = r.hs; return out; };

  // ---------- drawing on the 2D plan ----------
  S.overlay = (ctx, v, th, sel) => { const r = A.doc.struct.result; if (!r || r.errors.length) return; const T = p => A.toScreen(p, v), stale = r.sig !== S.sig(A.doc); ctx.save(); ctx.globalAlpha = stale ? 0.45 : 1; ctx.lineJoin = 'round';
    ctx.setLineDash([6, 4]); ctx.strokeStyle = '#ffb27a'; ctx.lineWidth = 1;
    r.columns.forEach(c => { const f = c.footing.side, q = [T([c.p[0] - f / 2, c.p[1] + f / 2]), T([c.p[0] + f / 2, c.p[1] - f / 2])]; ctx.strokeRect(q[0][0], q[0][1], q[1][0] - q[0][0], q[1][1] - q[0][1]); });
    ctx.setLineDash([]); ctx.lineWidth = Math.max(2, 0.2 * v.s * 0.5); ctx.strokeStyle = 'rgba(255,159,107,.55)';
    r.beams.forEach(b => { const p = T(b.p1), q = T(b.p2); ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); });
    const px = Math.max(9, Math.min(13, 0.22 * v.s)); ctx.font = `${px}px Inter, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillStyle = th.text || '#ffd27a';
    r.beams.forEach(b => { const mx = (b.p1[0] + b.p2[0]) / 2, my = (b.p1[1] + b.p2[1]) / 2, q = T([mx, my]); ctx.save(); ctx.translate(q[0], q[1]); let ang = -Math.atan2(b.p2[1] - b.p1[1], b.p2[0] - b.p1[0]); if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI; ctx.rotate(ang); ctx.fillText(`${b.id} ${Math.round(b.b * 100)}×${Math.round(b.h * 100)}`, 0, -4); ctx.restore(); });
    r.columns.forEach(c => { const f = c.footing.side / 2, top = T([c.p[0], c.p[1] + f]), bot = T([c.p[0], c.p[1] - f]); ctx.fillStyle = th.text || '#ffd27a'; ctx.textBaseline = 'bottom'; ctx.fillText(`${c.label} ${Math.round(c.a * 100)}×${Math.round(c.a * 100)}`, top[0], top[1] - 2);
      ctx.fillStyle = '#ffb27a'; ctx.textBaseline = 'top'; ctx.fillText(`S ${A.fmt(c.footing.side)}`, bot[0], bot[1] + 2); });
    if (r.slab) { ctx.textBaseline = 'middle'; ctx.fillStyle = '#9be29b'; r.slab.panels.forEach(d => { const q = T([(d.x0 + d.x1) / 2, (d.y0 + d.y1) / 2]); ctx.fillText(`${d.id} e=${Math.round(r.slab.h * 100)} cm`, q[0], q[1]); }); }
    ctx.restore(); };

  // ---------- written report (HTML, printable) ----------
  S.report = (doc) => { const r = doc.struct.result; if (!r) return ''; const p = r.params, f = (v, n = 2) => A.fmt(v, n), esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])), row = a => '<tr>' + a.map(c => '<td>' + c + '</td>').join('') + '</tr>', head = a => '<tr>' + a.map(c => '<th>' + c + '</th>').join('') + '</tr>';
    const m = r.mat; let h = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Note de calcul — ${esc(doc.name)}</title><style>body{font:14px/1.45 system-ui,Segoe UI,sans-serif;max-width:980px;margin:24px auto;padding:0 16px;color:#111}h1{font-size:22px}h2{margin-top:28px;border-bottom:2px solid #12365d;color:#12365d}table{border-collapse:collapse;width:100%;margin:8px 0}th,td{border:1px solid #bbb;padding:4px 6px;text-align:left;font-size:13px}th{background:#eef2f7}.w{background:#fff4e5;border:1px solid #e5b044;padding:8px;margin:8px 0}.note{color:#555;font-size:12px}</style></head><body>`;
    h += `<h1>Note de calcul de pré-dimensionnement — ${esc(doc.name)}</h1><p class="note">Règles BAEL 91 révisé 99, états limites ultime (ELU) et de service (ELS). Document d'aide au pré-dimensionnement généré automatiquement : il doit être vérifié et validé par un ingénieur structure avant toute exécution.</p>`;
    if (r.errors.length) return h + '<div class="w">' + r.errors.map(esc).join('<br>') + '</div></body></html>';
    h += `<h2>1. Hypothèses</h2><table>${head(['Donnée', 'Valeur'])}${row(['Béton', 'fc28 = ' + p.fc28 + ' MPa ; fbu = ' + f(m.fbu) + ' MPa ; ft28 = ' + f(m.ft28) + ' MPa'])}${row(['Acier', 'HA FeE' + p.fe + ' ; σs = ' + f(m.ss, 1) + ' MPa ; μl = ' + f(m.muL, 3)])}${row(['Sol', 'contrainte admissible ' + f(p.sigSol) + ' MPa (à confirmer par une étude de sol)'])}${row(['Niveaux', p.nlev + ' (plancher haut : ' + (p.top === 'dalle' ? 'dalle terrasse' : 'charpente légère') + ')'])}${row(['Charges planchers', 'G2 = ' + f(p.G2) + ' kN/m² ; Q = ' + f(p.Q) + ' kN/m²'])}${row(['Charges toiture', p.top === 'dalle' ? 'G2 = ' + f(p.G2top) + ' ; Q = ' + f(p.Qtop) + ' kN/m²' : 'G = ' + f(p.Groof) + ' ; Q = ' + f(p.Qroof) + ' kN/m²'])}${row(['Maçonnerie', f(p.wallLoad) + ' kN/m² de mur, réduite des ouvertures'])}${row(['Combinaisons', 'ELU : 1,35 G + 1,5 Q ; ELS : G + Q'])}</table>`;
    if (r.warnings.length) h += '<div class="w"><b>Points d\'attention</b><br>' + r.warnings.map(esc).join('<br>') + '</div>';
    if (r.slab) { h += `<h2>2. Dalle (épaisseur ${Math.round(r.slab.h * 100)} cm)</h2><table>${head(['Panneau', 'lx × ly (m)', 'α', 'pu (kN/m²)', 'M0x / M0y (kN.m/m)', 'Chapeaux / travée sens x', 'sens y', 'τu / limite (MPa)'])}`;
      r.slab.panels.forEach(d => { h += row([d.id, f(d.lx) + ' × ' + f(d.ly), f(d.alpha) + (d.oneWay ? ' (portée unique)' : ''), f(d.pu), f(d.M0x) + ' / ' + f(d.M0y), 'travée ' + d.barTx.text + ' ; chapeaux ' + d.barAx.text, 'travée ' + d.barTy.text + ' ; chapeaux ' + d.barAy.text, f(d.tau) + ' / ' + f(d.tauLim)]); }); h += '</table><p class="note">Moments : coefficients de l\'annexe E3 (ν = 0) ; moments en travée 0,85 M0, sur appuis 0,5 M0. Pas d\'armatures d\'effort tranchant (τu ≤ 0,07 fc28/γb).</p>'; }
    h += `<h2>3. Poutres</h2><table>${head(['Poutre', 'Entre', 'Portée (m)', 'Section b × h (cm)', 'pu (kN/m)', 'M0 (kN.m)', 'Travée', 'Appui', 'Vu (kN)', 'τu (MPa)', 'Cadres HA6'])}`;
    r.beams.forEach(b => { h += row([b.id + (b.manual ? ' (dessinée)' : ''), b.from + '–' + b.to, f(b.L), Math.round(b.b * 100) + ' × ' + Math.round(b.h * 100), f(b.pu), f(b.M0), b.barT.text, b.barA.text, f(b.Vu, 1), f(b.tau), 'e=' + b.st + ' cm']); }); h += '</table><p class="note">Charges sur les poutres : charges équivalentes des dalles (triangle ou trapèze), poids propre et maçonnerie. Moment en travée 0,85 M0, sur appui 0,5 M0. Armatures longitudinales de montage non détaillées.</p>';
    h += `<h2>4. Poteaux et semelles isolées</h2><table>${head(['Poteau', 'Section (cm)', 'Nu (kN)', 'Ns (kN)', 'λ', 'Armatures', 'Cadres', 'Semelle A × A (m)', 'Hauteur (m)', 'Aciers de semelle', 'σ sol (MPa)'])}`;
    r.columns.forEach(c => { h += row([c.label, Math.round(c.a * 100) + ' × ' + Math.round(c.a * 100), f(c.Nu, 0), f(c.Ns, 0), f(c.lam, 1), c.bars.text + ' (A = ' + f(c.Areq) + ' cm² requis, mini ' + f(c.Amin) + ')', c.tie, f(c.footing.side) + ' × ' + f(c.footing.side), f(c.footing.h), c.footing.bars.text, f(c.footing.sigma)]); });
    h += `</table><p class="note">Poteaux : méthode forfaitaire BAEL B.8.4 (élancement, flambement), longueur de flambement 0,7 l0, majoration de 10 % des charges pour un poteau continu. Semelles : méthode des bielles, aciers = max(ELU, ELS fissuration préjudiciable). Charges totales : Nu = ${f(r.totals.Nu, 0)} kN, Ns = ${f(r.totals.Ns, 0)} kN.</p></body></html>`; return h; };
})();
