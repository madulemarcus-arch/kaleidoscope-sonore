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
  // ULS interaction of a square section a x a, steel As/2 in each of two layers at dp from the faces, bending about one axis (parabola-rectangle concrete, bilinear steel,
  // pivots B and C). N in MN (compression positive), As in m2; returns the resisting moment about the centroid in MN.m. The neutral axis depth is found by bisection.
  S.colMR = (N, As, a, m, dp = 0.045) => { const h = a, b = a, fbu = m.fbu, fsd = m.fe / GS, es = 200000, ns = 160;
    const sc = e => e <= 0 ? 0 : e >= 0.002 ? fbu : fbu * (1 - Math.pow(1 - e / 0.002, 2)), ss = e => Math.max(-fsd, Math.min(fsd, es * e));
    const resp = x => { const et = x <= h ? 3.5e-3 : 2e-3 / (1 - 3 * h / (7 * x)), dy = Math.min(x, h) / ns; let Nn = 0, Mm = 0;
      for (let i = 0; i < ns; i++) { const y = (i + 0.5) * dy, f = sc(et * (1 - y / x)) * b * dy; Nn += f; Mm += f * (h / 2 - y); }
      [dp, h - dp].forEach(y => { const e = et * (1 - y / x), f = As / 2 * (ss(e) - sc(e)); Nn += f; Mm += f * (h / 2 - y); }); return { N: Nn, M: Mm }; };
    let lo = 1e-4, hi = 1e3; for (let i = 0; i < 90; i++) { const mid = Math.sqrt(lo * hi); if (resp(mid).N < N) lo = mid; else hi = mid; } return resp(Math.sqrt(lo * hi)).M; };
  // Smallest steel (cm2) resisting (Nu MN, Mu MN.m) in a square column, between the BAEL minimum and 5 % of the section.
  S.colBending = (Nu, Mu, a, m) => { const B = a * a, Amin = Math.max(4 * 4 * a, 0.2 * B * 100) / 1e4, Amax = 5 * B / 100;
    if (S.colMR(Nu, Amax, a, m) < Mu) return { ok: false, As: cm2(Amax), MR: S.colMR(Nu, Amax, a, m) }; if (S.colMR(Nu, Amin, a, m) >= Mu) return { ok: true, As: cm2(Amin), MR: S.colMR(Nu, Amin, a, m) };
    let lo = Amin, hi = Amax; for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2; if (S.colMR(Nu, mid, a, m) >= Mu) hi = mid; else lo = mid; } return { ok: true, As: cm2(hi), MR: S.colMR(Nu, hi, a, m) }; };
  // Straight anchorage length ls = Ø·fe / (4 τs), τs = 0,6 ψs² ft28 (HA, ψs = 1,5); a normal 180° hook anchors with 0,4 ls (measured outside the hook).
  S.anchorage = (d, m) => { const ls = d / 1000 * m.fe / (4 * 0.6 * 2.25 * m.ft28); return { ls, la: 0.4 * ls }; };

  // Unbalanced moment at an inner node under alternate live loading, shared between the columns by stiffness (one distribution step, far ends fixed, k = I/length).
  // ea, eb: the two collinear beams meeting at the node { Gm, Qm (kN/m), L (m), Ib (m4) }; kA, kB: stiffness I/H of the column segment above / below (0 when absent).
  // Fixed-end moments p·L²/12 with the loaded span at 1,35 G + 1,5 Q and the other at 1,35 G; the worst of the two patterns is kept.
  S.unbalanced = (ea, eb, kA, kB) => { const fl = e => (1.35 * e.Gm + 1.5 * e.Qm) * e.L * e.L / 12, fu = e => 1.35 * e.Gm * e.L * e.L / 12, dM = Math.max(Math.abs(fl(ea) - fu(eb)), Math.abs(fu(ea) - fl(eb))), sk = ea.Ib / ea.L + eb.Ib / eb.L + kA + kB;
    return { dM, sumK: sk, above: dM * kA / sk, below: dM * kB / sk }; };
  // Isolated square footing: plan side A (m), height h, steel (cm2 per direction), from the strut method.
  S.footing = (Nu, Ns, a, sigSol, m) => { const A0 = Math.sqrt(1.1 * Ns / (sigSol * 1000)), side = Math.max(ceilTo(A0, 0.05), a + 0.3), d = Math.max(ceilTo((side - a) / 4, 0.05), 0.2), h = d + 0.05;
    const Asu = cm2(Nu / 1000 * (side - a) / (8 * d * m.ss)), Ass = cm2(Ns / 1000 * (side - a) / (8 * d * m.ssSer)); return { side, d, h, Asu, Ass, As: Math.max(Asu, Ass), sigma: 1.1 * Ns / (side * side) / 1000 }; };

  // ---------- continuous beams (BAEL B.6.2,21 forfaitaire, B.6.2,22 Caquot) ----------
  // spans: [{ L, Gm, Qm, Gv, Qv }] in m and kN/m (m = loads used for moments, v = loads used for shear). Returns moments (kN.m, magnitudes) and shears (kN) per span.
  S.degression = n => n >= 5 ? (3 + n) / (2 * n) : 1;   // NF P06-001: live loads of the n floors under the roof are reduced for n >= 5
  S.continuous = (spans, force) => { const n = spans.length, pu = s => 1.35 * s.Gm + 1.5 * s.Qm, puv = s => 1.35 * s.Gv + 1.5 * s.Qv, psv = s => s.Gv + s.Qv;
    const M0 = spans.map(s => pu(s) * s.L * s.L / 8), al = spans.map(s => s.Gm + s.Qm > 0 ? s.Qm / (s.Gm + s.Qm) : 0), why = [];
    spans.forEach((s, i) => { if (s.Qm > 2 * s.Gm + 1e-9) why.push('Q > 2G dans la travée ' + (i + 1)); });
    for (let i = 0; i + 1 < n; i++) { const r = spans[i].L / spans[i + 1].L; if (r < 0.8 - 1e-9 || r > 1.25 + 1e-9) why.push('portées voisines dans un rapport de ' + A.fmt(r) + ' (hors de 0,8 à 1,25)'); }
    const method = force || (why.length ? 'caquot' : 'forfaitaire'), Ms = new Array(n + 1).fill(0), Mt = [], Vl = [], Vr = [];
    Ms[0] = 0.15 * M0[0]; Ms[n] = 0.15 * M0[n - 1];
    if (method === 'forfaitaire') {
      for (let k = 1; k < n; k++) Ms[k] = (n === 2 ? 0.6 : (k === 1 || k === n - 1) ? 0.5 : 0.4) * Math.max(M0[k - 1], M0[k]);
      spans.forEach((s, i) => { const a = al[i], end = i === 0 || i === n - 1; Mt[i] = Math.max(Math.max(1.05, 1 + 0.3 * a) * M0[i] - (Ms[i] + Ms[i + 1]) / 2, (end ? 1.2 + 0.3 * a : 1 + 0.3 * a) / 2 * M0[i]); });
      const f = k => k <= 0 || k >= n ? 1 : n === 2 ? 1.10 : (k === 1 || k === n - 1) ? 1.15 : 1.0;
      spans.forEach((s, i) => { const v = puv(s) * s.L / 2; Vl[i] = v * f(i); Vr[i] = v * f(i + 1); });
    } else {
      const lp = spans.map((s, i) => n === 1 || i === 0 || i === n - 1 ? s.L : 0.8 * s.L), pmax = spans.map(pu), pmin = spans.map(s => 1.35 * s.Gm), sup = (k, pw, pe) => (pw * Math.pow(lp[k - 1], 3) + pe * Math.pow(lp[k], 3)) / (8.5 * (lp[k - 1] + lp[k]));
      for (let k = 1; k < n; k++) Ms[k] = sup(k, pmax[k - 1], pmax[k]);
      spans.forEach((s, i) => { const Mw = i === 0 ? 0.15 * M0[i] : sup(i, pmin[i - 1], pmax[i]), Me = i === n - 1 ? 0.15 * M0[i] : sup(i + 1, pmax[i], pmin[i + 1]), p = pmax[i], x = Math.max(0, Math.min(s.L, s.L / 2 + (Mw - Me) / (p * s.L)));
        Mt[i] = Math.max(0, p * x * (s.L - x) / 2 - Mw * (1 - x / s.L) - Me * x / s.L); Vl[i] = puv(s) * s.L / 2 + (Ms[i] - Ms[i + 1]) / s.L; Vr[i] = puv(s) * s.L / 2 + (Ms[i + 1] - Ms[i]) / s.L; });
    }
    return { method, reasons: why, spans: spans.map((s, i) => ({ L: s.L, p: pu(s), M0: M0[i], alpha: al[i], Mw: Ms[i], Me: Ms[i + 1], Mt: Mt[i], Vl: Vl[i], Vr: Vr[i], Vls: Vl[i] * psv(s) / puv(s), Vrs: Vr[i] * psv(s) / puv(s), endW: i === 0 ? 'rive' : 'appui', endE: i === n - 1 ? 'rive' : 'appui' })) }; };
  // Groups beams into continuous chains (collinear beams meeting at a column), ordered along the chain. Each item: { b, flip } with flip = the beam's ca is its east end.
  S.chains = beams => { const par = beams.map((_, i) => i), find = i => par[i] === i ? i : (par[i] = find(par[i])), byCol = new Map(), dir = (b, c) => A.unit(c.p, (b.ca === c ? b.cb : b.ca).p);
    beams.forEach((b, i) => [b.ca, b.cb].forEach(c => { if (!byCol.has(c.id)) byCol.set(c.id, []); byCol.get(c.id).push({ i, c }); }));
    byCol.forEach(l => { for (let x = 0; x < l.length; x++) for (let y = x + 1; y < l.length; y++) { const u = dir(beams[l[x].i], l[x].c), v = dir(beams[l[y].i], l[y].c); if (u[0] * v[0] + u[1] * v[1] < -0.95) par[find(l[x].i)] = find(l[y].i); } });
    const groups = new Map(); beams.forEach((b, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(b); });
    return [...groups.values()].map(g => { const u = A.unit(g[0].ca.p, g[0].cb.p), pr = p => p[0] * u[0] + p[1] * u[1]; return g.map(b => ({ b, flip: pr(b.ca.p) > pr(b.cb.p), s: pr(b.ca.p) + pr(b.cb.p) })).sort((p, q) => p.s - q.s); }); };

  // ---------- reinforcement choices ----------
  const area = d => Math.PI * Math.pow(d / 10, 2) / 4;            // cm2 for a diameter in mm
  S.beamBars = (As, b) => { for (const d of [10, 12, 14, 16, 20, 25]) { const n = Math.max(2, Math.ceil(As / area(d) - 1e-9)), maxN = Math.max(2, Math.floor((b * 1000 - 60 + 25) / (d + 25))); if (n <= maxN) return { n, d, text: n + 'HA' + d, As: n * area(d) }; } const d = 25, n = Math.ceil(As / area(d)); return { n, d, text: n + 'HA25', As: n * area(d) }; };
  S.slabBars = (As, h, main) => { const smax = main ? Math.min(300 * h, 33) : Math.min(400 * h, 45);
    for (const d of [8, 10, 12, 14]) { const s = Math.floor(100 * area(d) / As / 5) * 5; if (s >= 10 || d === 14) { const e = Math.max(5, Math.min(s, Math.floor(smax / 5) * 5)); return { d, e, text: 'HA' + d + ' e=' + e, As: 100 * area(d) / e }; } } };
  S.colBars = As => { for (const d of [12, 14, 16, 20, 25]) { let n = Math.max(4, Math.ceil(As / area(d) - 1e-9)); if (n % 2) n++; if (n <= 12) return { n, d, text: n + 'HA' + d, As: n * area(d) }; } const d = 25, n = Math.ceil(As / area(d)); return { n, d, text: n + 'HA25', As: n * area(d) }; };
  S.footBars = (As, side) => { for (const d of [10, 12, 14, 16]) { const n = Math.max(4, Math.ceil(As / area(d) - 1e-9)), e = (side - 0.1) / (n - 1); if (e >= 0.10) return { n, d, e: Math.floor(e * 100), text: n + 'HA' + d + ' par sens', As: n * area(d) }; } const d = 20, n = Math.ceil(As / area(d)); return { n, d, e: 10, text: n + 'HA20 par sens', As: n * area(d) }; };

  // ---------- strip footing under a row of columns ----------
  S.stripBars = (As, B) => { const nmin = Math.ceil((B - 0.10) / 0.25 - 1e-9) + 1; for (const d of [12, 14, 16, 20, 25]) { const n = Math.max(nmin, Math.ceil(As / area(d) - 1e-9)), e = (B - 0.10) / (n - 1); if (e >= 0.075 || d === 25) return { n, d, e: Math.floor(e * 100), text: n + 'HA' + d, As: n * area(d) }; } };
  // cols: [{ x (m along the row), Nu, Ns (kN), a (m) }] sorted by x. The strip is centred on the resultant of the service loads, so the soil pressure is uniform.
  // Longitudinally it works like an upside-down continuous beam (tension at the bottom under the columns, at the top between them), transversally like two cantilevers.
  S.strip = (cols, p, m) => { const n = cols.length, sNu = cols.reduce((s, c) => s + c.Nu, 0), sNs = cols.reduce((s, c) => s + c.Ns, 0), xs = cols.map(c => c.x), aMax = Math.max(...cols.map(c => c.a));
    const xR = cols.reduce((s, c) => s + c.Ns * c.x, 0) / sNs, half = Math.max(xR - xs[0], xs[n - 1] - xR) + 0.25, x0 = xR - half, x1 = xR + half, L = 2 * half;
    const B = Math.max(ceilTo(1.1 * sNs / (p.sigSol * 1000 * L), 0.05), ceilTo(aMax + 0.3, 0.05), 0.5), wu = sNu / L, qu = sNu / (B * L), sigma = 1.1 * sNs / (B * L) / 1000, ratio = sNs / sNu;
    const an = S.continuous(xs.slice(1).map((x, i) => ({ L: x - xs[i], Gm: wu / 1.35, Qm: 0, Gv: wu / 1.35, Qv: 0 }))), cl = xs[0] - x0, cr = x1 - xs[n - 1];
    const Msup = xs.map((_, i) => i === 0 ? Math.max(an.spans[0].Mw, wu * cl * cl / 2) : i === n - 1 ? Math.max(an.spans[n - 2].Me, wu * cr * cr / 2) : an.spans[i - 1].Me);
    const Mbot = Math.max(...Msup), Mtop = Math.max(...an.spans.map(s => s.Mt)), V = Math.max(...an.spans.map(s => Math.max(s.Vl, s.Vr)), wu * cl, wu * cr), b0 = 0.25, c = (B - b0) / 2, Mtr = qu * c * c / 2;
    let h = Math.max(0.30, ceilTo((B - b0) / 4 + 0.05, 0.05)), ok = false, fb, ft, ftr, d, tau; const tauLim = 0.07 * m.fc / GB;
    for (; h <= 1.2 + 1e-9; h = Math.round((h + 0.05) * 100) / 100) { d = h - 0.07; fb = S.flex(Mbot / 1000, B, d, m); ft = S.flex(Mtop / 1000, B, d, m); ftr = S.flex(Mtr / 1000, 1, d, m); tau = V / 1000 / (B * d); if (fb.ok && ft.ok && ftr.ok && tau <= tauLim) { ok = true; break; } }
    if (!ok) { h = 1.2; d = h - 0.07; fb = S.flex(Mbot / 1000, B, d, m); ft = S.flex(Mtop / 1000, B, d, m); ftr = S.flex(Mtr / 1000, 1, d, m); tau = V / 1000 / (B * d); }
    const ser = M => cm2(M * ratio / 1000 / (0.9 * d * m.ssSer)), Amin = cm2(0.23 * B * d * m.ft28 / m.fe), Amin1 = cm2(0.23 * d * m.ft28 / m.fe);
    const Ab = Math.max(fb.As || 0, ser(Mbot), Amin), At = Math.max(ft.As || 0, ser(Mtop), Amin), Atr = Math.max(ftr.As || 0, ser(Mtr), Amin1);
    return { n, L, B, h, d, x0, x1, xR, overL: cl, overR: cr, wu, qu, sigma, sNu, sNs, Mbot, Mtop, Mtr, V, tau, tauLim, Msup, an, failed: !ok, Ab, At, Atr, barBot: S.stripBars(Ab, B), barTop: S.stripBars(At, B), barTr: S.slabBars(Atr, h, true) }; };

  // ---------- raft foundation (radier nervuré) ----------
  // The raft slab is rectangular and centred on the resultant of the service loads (uniform soil pressure). Upside down it works like a floor:
  // slab panels closed by ribs ("nervures") under the beam lines, loaded upward by the net pressure qu = ΣNu / S, plus a cantilever rim. o: { cols, cells, beams, chains, p, m, lab }
  S.raft = o => { const { cols, cells, beams, chains, p, m, lab } = o, sNu = cols.reduce((s, c) => s + c.Nu, 0), sNs = cols.reduce((s, c) => s + c.Ns, 0), xR = cols.reduce((s, c) => s + c.Ns * c.p[0], 0) / sNs, yR = cols.reduce((s, c) => s + c.Ns * c.p[1], 0) / sNs;
    const xs = cols.map(c => c.p[0]), ys = cols.map(c => c.p[1]), hx0 = Math.max(xR - Math.min(...xs), Math.max(...xs) - xR), hy0 = Math.max(yR - Math.min(...ys), Math.max(...ys) - yR), tauLimPlate = 0.07 * m.fc / GB, count = new Map();
    cells.forEach(c => c.edges.forEach(e => e.bs.forEach(b => count.set(b.k, (count.get(b.k) || 0) + 1))));
    const panel = (c, pu, h) => { const mo = S.slabMoments(c.lx, c.ly, pu), dx = h - 0.03, dy = h - 0.04, f = (M, d) => S.flex(M / 1000, 1, d, m), tx = f(0.85 * mo.M0x, dx), ty = f(0.85 * mo.M0y, dy), ax = f(0.5 * mo.M0x, dx), ay = f(0.5 * mo.M0y, dy), Vu = mo.oneWay ? pu * c.lx / 2 : pu * c.lx / (2 + mo.alpha), tau = Vu / 1000 / dx;
      return { mo, tx, ty, ax, ay, Vu, tau, ok: tx.ok && ty.ok && ax.ok && ay.ok && tau <= tauLimPlate }; };
    let out = null;
    for (let dd = 0.5; dd <= 3.0 + 1e-9; dd += 0.25) { const hx = hx0 + dd, hy = hy0 + dd, Sr = 4 * hx * hy, qu = sNu / Sr, qs = sNs / Sr;
      // plate thickness: smallest e passing bending and shear on every panel
      let e = Math.max(0.20, ceilTo(Math.max(...cells.map(c => c.lx)) / 20, 0.01)), pan = null, failed = false;
      for (; e <= 0.60 + 1e-9; e = Math.round((e + 0.01) * 100) / 100) { const r = cells.map(c => panel(c, qu, e)); if (r.every(x => x.ok)) { pan = r; break; } }
      if (!pan) { e = 0.60; pan = cells.map(c => panel(c, qu, e)); failed = true; }
      const panels = pan.map((o, i) => { const c = o.c = cells[i], mo = o.mo, bar = (r, mn, main) => S.slabBars(Math.max(r.As || 0, mn), e, main), ymin = 6 * e, xmin = ymin * (3 - Math.max(mo.alpha, 0.4)) / 2;
        return { id: 'RP' + (i + 1), lx: c.lx, ly: c.ly, alpha: mo.alpha, oneWay: mo.oneWay, mux: mo.mux, muy: mo.muy, M0x: mo.M0x, M0y: mo.M0y, pu: qu, tau: o.tau, tauLim: tauLimPlate, Atx: Math.max(o.tx.As || 0, xmin), Aty: Math.max(o.ty.As || 0, ymin), Aax: Math.max(o.ax.As || 0, xmin * 0.5), Aay: Math.max(o.ay.As || 0, ymin * 0.5),
          barTx: bar(o.tx, xmin, true), barTy: bar(o.ty, ymin, false), barAx: bar(o.ax, xmin * 0.5, true), barAy: bar(o.ay, ymin * 0.5, false), x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1 }; });
      // ribs: load from the panels on each side (equivalent triangle / trapezoid loads) and from the rim along the outer ribs
      const loadOn = new Map(beams.map(b => [b.k, { m: 0, v: 0 }]));
      cells.forEach(c => c.edges.forEach(ed => { const edge = ed.len <= c.lx + 0.01 ? 'short' : 'long', q = S.panelLoad(qu, c.lx, c.ly, edge); ed.bs.forEach(b => { const t = loadOn.get(b.k); t.m += q.m; t.v += q.v; }); }));
      beams.forEach(b => { if (count.get(b.k) === 1) { const t = loadOn.get(b.k); t.m += qu * dd; t.v += qu * dd; } });
      const nerv = [], ribLoad = beams.reduce((s, b) => s + loadOn.get(b.k).v * b.L, 0), perimLen = beams.filter(b => count.get(b.k) === 1).reduce((s, b) => s + b.L, 0); let nn = 0;
      chains.forEach((chain, ci) => { if (!chain.some(it => count.get(it.b.k))) return; const Lmax = Math.max(...chain.map(it => it.b.L)), spans = chain.map(it => { const l = loadOn.get(it.b.k); return { L: it.b.L, Gm: l.m / 1.35, Qm: 0, Gv: l.v / 1.35, Qv: 0 }; }), an = S.continuous(spans), n = chain.length;
        let b = 0.30, h = Math.max(0.40, e + 0.20, ceilTo(Lmax / 8, 0.05)), good = false;
        for (let k = 0; k < 80 && !good; k++) { const d = h - 0.05; if (an.spans.every(s => S.flex(s.Mt / 1000, b, d, m).ok && S.flex(s.Mw / 1000, b, d, m).ok && S.flex(s.Me / 1000, b, d, m).ok && Math.max(s.Vl, s.Vr) / 1000 / (b * d) <= m.tauLim)) good = true; else if (h < 1.2 - 1e-9) h = Math.round((h + 0.05) * 100) / 100; else { b = Math.round((b + 0.05) * 100) / 100; h = Math.max(0.40, e + 0.20, ceilTo(Lmax / 8, 0.05)); } }
        const d = h - 0.05, Amin = cm2(0.23 * b * d * m.ft28 / m.fe);
        chain.forEach((it, i) => { const sp = an.spans[i], V = Math.max(sp.Vl, sp.Vr), tau = V / 1000 / (b * d), ft = M => S.flex(M / 1000, b, d, m).As || 0, Ast = Math.max(ft(sp.Mt), Amin), AaW = Math.max(ft(sp.Mw), Amin), AaE = Math.max(ft(sp.Me), Amin), kk = Math.max(0, tau - 0.3 * m.ft28), At = 2 * area(6) * 1e-4;
          let stM = Math.min(0.40, 0.9 * d, At * m.fe / (0.4 * b)); if (kk > 0) stM = Math.min(stM, At / (b * kk / (0.9 * m.ss))); const st = Math.max(5, Math.floor(stM * 100 / 5) * 5), Lw = i === 0 ? it.b.L : Math.max(chain[i - 1].b.L, it.b.L), Le = i === n - 1 ? it.b.L : Math.max(chain[i + 1].b.L, it.b.L);
          const M0w = i === 0 ? sp.M0 : Math.max(an.spans[i - 1].M0, sp.M0), M0e = i === n - 1 ? sp.M0 : Math.max(an.spans[i + 1].M0, sp.M0), capW = (i === 0 ? 0.2 : sp.Mw >= 0.4 * M0w - 1e-9 ? 0.25 : 0.2) * Lw, capE = (i === n - 1 ? 0.2 : sp.Me >= 0.4 * M0e - 1e-9 ? 0.25 : 0.2) * Le, Aa = Math.max(AaW, AaE);
          nn++; nerv.push({ id: 'NV' + nn, k: it.b.k, ca: it.b.ca.id, cb: it.b.cb.id, from: lab[it.b.ca.id], to: lab[it.b.cb.id], p1: it.b.ca.p, p2: it.b.cb.p, L: it.b.L, manual: false, b, h, d, M0: sp.M0, Mt: sp.Mt, Mw: sp.Mw, Me: sp.Me, Ma: Math.max(sp.Mw, sp.Me), Vu: V, tau, Ast, AaW, AaE, Aa, barT: S.beamBars(Ast, b), barA: S.beamBars(Aa, b), barW: S.beamBars(AaW, b), barE: S.beamBars(AaE, b), st, self: 0, wall: 0, pu: sp.p, capW, capE, endW: sp.endW, endE: sp.endE, flip: it.flip, method: an.method, chain: ci + 1, pos: i + 1, nSpans: n, alpha: sp.alpha,
            ...(it.flip ? { MA: sp.Me, MB: sp.Mw, AaA: AaE, AaB: AaW, capA: capE, capB: capW, endA: sp.endE, endB: sp.endW } : { MA: sp.Mw, MB: sp.Me, AaA: AaW, AaB: AaE, capA: capW, capB: capE, endA: sp.endW, endB: sp.endE }), failedSection: !good }); }); });
      const Mdb = qu * dd * dd / 2, dE = e - 0.04, fdb = S.flex(Mdb / 1000, 1, dE, m), Adb = Math.max(fdb.As || 0, cm2(0.23 * dE * m.ft28 / m.fe), 6 * e), rim = { M: Mdb, ok: fdb.ok, As: Adb, bar: S.slabBars(Adb, e, true), width: dd };
      const conc = Sr * e + nerv.reduce((s, v) => s + v.b * Math.max(0, v.h - e) * v.L, 0), W = GC * conc, sigma = (sNs + W) / Sr / 1000;
      out = { ribLoad, perimLen, rim: dd, hx, hy, Lx: 2 * hx, Ly: 2 * hy, S: Sr, x0: xR - hx, x1: xR + hx, y0: yR - hy, y1: yR + hy, xR, yR, e, panels, nerv, dbord: rim, W, conc, sigma, qu, qs, sNu, sNs, tauLimPlate, failed: failed || nerv.some(v => v.failedSection) || !rim.ok, soilFailed: sigma > p.sigSol };
      if (!out.soilFailed) break; }
    return out; };

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
    const Lf = nInter >= 1 ? setF(hs) : null, Lt = setT(hs);
    res.slab = needSlab ? { h: hs, panels: panelsOut.map((o, i) => { const c = o.c, mo = o.mo, bar = (r, mn, main) => S.slabBars(Math.max(r.As, mn), hs, main), ymin = 6 * hs, xmin = ymin * (3 - Math.max(mo.alpha, 0.4)) / 2;
      return { id: 'D' + (i + 1), lx: c.lx, ly: c.ly, alpha: mo.alpha, oneWay: mo.oneWay, mux: mo.mux, muy: mo.muy, M0x: mo.M0x, M0y: mo.M0y, pu: o.pu, tau: o.tau, tauLim: o.tauLim,
        Atx: Math.max(o.tx.As, xmin), Aty: Math.max(o.ty.As, ymin), Aax: Math.max(o.ax.As, xmin * 0.5), Aay: Math.max(o.ay.As, ymin * 0.5), barTx: bar(o.tx, xmin, true), barTy: bar(o.ty, ymin, false), barAx: bar(o.ax, xmin * 0.5, true), barAy: bar(o.ay, ymin * 0.5, false), x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1 }; }) } : null;
    panelsOut = null;
    // --- loads a set puts on every beam, split into dead (g) and live (q) parts, for moments (m) and shear (v)
    const slabOn = (g, q) => { const o = new Map(beams.map(b => [b.k, { gm: 0, gv: 0, qm: 0, qv: 0 }])); cells.forEach(c => c.edges.forEach(e => { const edge = e.len <= c.lx + 0.01 ? 'short' : 'long', G = S.panelLoad(g, c.lx, c.ly, edge), Q = S.panelLoad(q, c.lx, c.ly, edge); e.bs.forEach(bb => { const t = o.get(bb.k); t.gm += G.m; t.gv += G.v; t.qm += Q.m; t.qv += Q.v; }); })); return o; };
    const govSet = nInter >= 1 ? slabOn(Lf.g, Lf.q) : slabOn(Lt.g, Lt.q), floorSet = Lf ? slabOn(Lf.g, Lf.q) : null, topSet = slabOn(Lt.g, Lt.q);
    const spanLoads = (chain, set, sec) => chain.map(it => { const sl = set.get(it.b.k), self = GC * sec.b * sec.h, wall = S.wallLoad(it.b, p, sec.h); return { L: it.b.L, Gm: sl.gm + self + wall, Qm: sl.qm, Gv: sl.gv + self + wall, Qv: sl.qv, self, wall }; });
    // --- beams, chain by chain: smallest common section passing bending at mid-span and supports (no compression steel) and shear
    const bm = new Map(), chains = S.chains(beams), chainInfo = [];
    chains.forEach((chain, ci) => { const Lmax = Math.max(...chain.map(it => it.b.L)); let b = 0.20, h = Math.max(0.25, ceilTo(Lmax / 12, 0.05)), found = null, an = null, loads = null;
      for (let n = 0; n < 80 && !found; n++) { loads = spanLoads(chain, govSet, { b, h }); an = S.continuous(loads); const d = h - 0.04;
        const ok = an.spans.every((s, i) => S.flex(s.Mt / 1000, b, d, m).ok && S.flex(s.Mw / 1000, b, d, m).ok && S.flex(s.Me / 1000, b, d, m).ok && Math.max(s.Vl, s.Vr) / 1000 / (b * d) <= m.tauLim);
        if (ok) found = { b, h }; else if (h < 0.70 - 1e-9) h = Math.round((h + 0.05) * 100) / 100; else { b = Math.round((b + 0.05) * 100) / 100; h = Math.max(0.25, ceilTo(Lmax / 12, 0.05)); } }
      if (!found) { warn.push('Poutre continue ' + chain.map(it => it.b.id).join('–') + ' : section non trouvée (portées trop grandes), ajoutez un poteau.'); found = { b, h }; }
      const sec = found, d = sec.h - 0.04, Amin = cm2(0.23 * sec.b * d * m.ft28 / m.fe), n = chain.length;
      if (an.method === 'caquot') warn.push('Poutres ' + chain.map(it => it.b.id).join('–') + ' : méthode forfaitaire non applicable (' + an.reasons.join(' ; ') + '), calcul par la méthode de Caquot.');
      chainInfo.push({ beams: chain.map(it => it.b.id), method: an.method, reasons: an.reasons });
      chain.forEach((it, i) => { const s = an.spans[i], ld = loads[i], V = Math.max(s.Vl, s.Vr), tau = V / 1000 / (sec.b * d), ft = (M, dd) => S.flex(M / 1000, sec.b, dd, m);
        const Ast = Math.max(ft(s.Mt, d).As || 0, Amin), AaW = Math.max(ft(s.Mw, d).As || 0, Amin), AaE = Math.max(ft(s.Me, d).As || 0, Amin), k = Math.max(0, tau - 0.3 * m.ft28), At = 2 * area(6) * 1e-4;
        let stM = Math.min(0.40, 0.9 * d, At * m.fe / (0.4 * sec.b)); if (k > 0) stM = Math.min(stM, At / (sec.b * k / (0.9 * m.ss))); const st = Math.max(5, Math.floor(stM * 100 / 5) * 5);
        const Lw = i === 0 ? it.b.L : Math.max(chain[i - 1].b.L, it.b.L), Le = i === n - 1 ? it.b.L : Math.max(chain[i + 1].b.L, it.b.L), M0w = i === 0 ? s.M0 : Math.max(an.spans[i - 1].M0, s.M0), M0e = i === n - 1 ? s.M0 : Math.max(an.spans[i + 1].M0, s.M0);
        const capW = (i === 0 ? 0.2 : s.Mw >= 0.4 * M0w - 1e-9 ? 0.25 : 0.2) * Lw, capE = (i === n - 1 ? 0.2 : s.Me >= 0.4 * M0e - 1e-9 ? 0.25 : 0.2) * Le, Aa = Math.max(AaW, AaE);
        bm.set(it.b.k, { b: sec.b, h: sec.h, d, M0: s.M0, Mt: s.Mt, Mw: s.Mw, Me: s.Me, Ma: Math.max(s.Mw, s.Me), Vu: V, tau, Ast, AaW, AaE, Aa, barT: S.beamBars(Ast, sec.b), barA: S.beamBars(Aa, sec.b), barW: S.beamBars(AaW, sec.b), barE: S.beamBars(AaE, sec.b), st, self: ld.self, wall: ld.wall, pu: s.p,
          capW, capE, endW: s.endW, endE: s.endE, flip: it.flip, ...(it.flip ? { MA: s.Me, MB: s.Mw, AaA: AaE, AaB: AaW, capA: capE, capB: capW, endA: s.endE, endB: s.endW } : { MA: s.Mw, MB: s.Me, AaA: AaW, AaB: AaE, capA: capW, capB: capE, endA: s.endW, endB: s.endE }), method: an.method, chain: ci + 1, pos: i + 1, nSpans: n, alpha: s.alpha, ok: !!found.b }); }); });
    // shear at both ends of every span, per level set (these are the beam reactions on the columns, with the continuity effect included)
    const ends = new Map(); beams.forEach(bw => ends.set(bw.k, {}));
    chains.forEach(chain => { const sec = bm.get(chain[0].b.k); [['F', floorSet], ['T', topSet]].forEach(([key, set]) => { if (!set) return; const loads = spanLoads(chain, set, sec), an = S.continuous(loads), anG = S.continuous(loads.map(l => ({ ...l, Qm: 0, Qv: 0 })), an.method), anQ = S.continuous(loads.map(l => ({ ...l, Gm: 0, Gv: 0 })), an.method);
      // the reactions are linear in the loads: the dead part (÷ 1,35) and the live part (÷ 1,5) are kept apart for the load take-down with live-load reduction
      chain.forEach((it, i) => { const s1 = an.spans[i], sg = anG.spans[i], sq = anQ.spans[i], west = it.flip ? it.b.cb : it.b.ca, east = it.flip ? it.b.ca : it.b.cb, e = ends.get(it.b.k);
        (e[west.id] = e[west.id] || {})[key] = { u: s1.Vl, s: sg.Vl / 1.35 + sq.Vl / 1.5, g: sg.Vl / 1.35, q: sq.Vl / 1.5, m: s1.Mw, Gm: loads[i].Gm, Qm: loads[i].Qm, L: it.b.L, Ib: sec.b * sec.h * sec.h * sec.h / 12 }; (e[east.id] = e[east.id] || {})[key] = { u: s1.Vr, s: sg.Vr / 1.35 + sq.Vr / 1.5, g: sg.Vr / 1.35, q: sq.Vr / 1.5, m: s1.Me, Gm: loads[i].Gm, Qm: loads[i].Qm, L: it.b.L, Ib: sec.b * sec.h * sec.h * sec.h / 12 }; }); }); });
    const react = (bw, colId, ult) => { const e = ends.get(bw.k)[colId], g = x => x ? (ult ? x.u : x.s) : 0; return nInter * g(e.F) + g(e.T); };
    res.chains = chainInfo;
    res.beams = beams.map(bw => { const o = bm.get(bw.k), sl = govSet.get(bw.k); return { id: bw.id, k: bw.k, ca: bw.ca.id, cb: bw.cb.id, from: lab[bw.ca.id], to: lab[bw.cb.id], p1: bw.ca.p, p2: bw.cb.p, L: bw.L, manual: bw.manual, ...o, slabG: sl.gm, slabQ: sl.qm }; });
    // --- columns
    const hbMax = id => Math.max(0.25, ...beams.filter(b => b.ca.id === id || b.cb.id === id).map(b => bm.get(b.k).h));
    cols.forEach(c => { const mine = beams.filter(b => b.ca.id === c.id || b.cb.id === c.id), l0 = Math.max(1.5, H - hbMax(c.id));
      const dirs = mine.map(b => A.unit(c.p, (b.ca.id === c.id ? b.cb : b.ca).p)), cont = dirs.some((u, i) => dirs.some((v, j) => j > i && u[0] * v[0] + u[1] * v[1] < -0.95));
      const sum = (key, f) => mine.reduce((t, b) => t + (((ends.get(b.k)[c.id] || {})[key] || {})[f] || 0), 0), RG_T = sum('T', 'g'), RQ_T = sum('T', 'q'), RG_F = nInter ? sum('F', 'g') : 0, RQ_F = nInter ? sum('F', 'q') : 0;
      // beams ending at this column with no collinear beam on the other side transmit their end moment (0,15 M0 at an end support) to the column; inner continuous nodes transmit none
      const dirOf = b => A.unit(c.p, (b.ca.id === c.id ? b.cb : b.ca).p), rive = mine.filter(b => !mine.some(o => o !== b && (() => { const u = dirOf(b), v = dirOf(o); return u[0] * v[0] + u[1] * v[1] < -0.95; })()));
      const opp = (b, o) => { const u = dirOf(b), v = dirOf(o); return u[0] * v[0] + u[1] * v[1] < -0.95; }, pairs = []; mine.forEach((b, i) => mine.forEach((o, j) => { if (j > i && opp(b, o)) { const u = dirOf(b); pairs.push({ a: b, b: o, axis: Math.abs(u[0]) >= Math.abs(u[1]) ? 'x' : 'y' }); } }));
      const femOf = (b, key) => (ends.get(b.k)[c.id] || {})[key], kcOf = a2 => Math.pow(a2, 4) / 12 / H;
      const alt = (key, kA, kB, part) => { let x = 0, y = 0, dx = 0, dy = 0; pairs.forEach(pr => { const ea = femOf(pr.a, key), eb = femOf(pr.b, key); if (!ea || !eb) return; const r = S.unbalanced(ea, eb, kA, kB); if (pr.axis === 'x') { x += r[part]; dx = Math.max(dx, r.dM); } else { y += r[part]; dy = Math.max(dy, r.dM); } }); return { x, y, dx, dy }; };
      const mom = key => { let mx = 0, my = 0; rive.forEach(b => { const e = (ends.get(b.k)[c.id] || {})[key]; if (!e) return; const u = dirOf(b); mx += e.m * Math.abs(u[0]); my += e.m * Math.abs(u[1]); }); return { x: mx, y: my }; }, MT = mom('T'), MF = nInter ? mom('F') : { x: 0, y: 0 };
      const amin = Math.max(0.20, ceilTo(Math.max(0, ...walls.filter(w => A.segDist(c.p, w.a, w.b).d <= TOL).map(w => w.th)), 0.05)), N = Math.max(1, Math.round(p.nlev)), levels = []; let Gprev = 0, aPrev = amin, failed = false;
      // load take-down from the top slab to the foundation: section chosen level by level (never smaller than the level above), live loads of the floors reduced by (3+n)/(2n) for n >= 5
      for (let k = 1; k <= N; k++) { const Gk = k === 1 ? RG_T : RG_F, Qk = k === 1 ? RQ_T : RQ_F, nfl = k - 1, deg = p.degr === false ? 1 : S.degression(nfl), Qc = RQ_T + deg * nfl * RQ_F; let a = aPrev, got = null;
        // first-order moments at the node of slab k (half to the segment above, half below; all to the first segment under the roof) and of slab k+1 under this segment
        const sk = k === 1 ? MT : MF, ft = k === 1 ? 1 : 0.5, MxR = Math.max(ft * sk.x, k < N ? 0.5 * MF.x : 0), MyR = Math.max(ft * sk.y, k < N ? 0.5 * MF.y : 0);
        const eval_ = a2 => { const kc = kcOf(a2), top = alt(k === 1 ? 'T' : 'F', k > 1 ? kcOf(aPrev) : 0, kc, 'below'), bot = k < N ? alt('F', kc, kc, 'above') : { x: 0, y: 0, dx: 0, dy: 0 }, Mx = MxR + Math.max(top.x, bot.x), My = MyR + Math.max(top.y, bot.y), altInfo = { x: Math.max(top.x, bot.x), y: Math.max(top.y, bot.y), dMx: Math.max(top.dx, bot.dx), dMy: Math.max(top.dy, bot.dy) }; const self = GC * a2 * a2 * H, Gc = Gprev + Gk + self, Nu = 1.35 * Gc + 1.5 * Qc, r = S.column(Nu / 1000, a2, l0, m); let cb = null, ok = r.Areq <= 0.02 * a2 * a2 * 1e4 && r.lam <= 70;
          if (Mx > 0 || My > 0) { const e0x = Mx / Nu, e0y = My / Nu, e0 = Math.max(e0x, e0y) + 0.7 * Math.min(e0x, e0y), ea = Math.max(0.02, l0 / 250), lf = 0.7 * l0, al = Gc / (Gc + Qc), e2 = 3 * lf * lf * (2 + 2 * al) / (1e4 * a2), e1 = e0 + ea, Mu = Nu * (e1 + e2), res = S.colBending(Nu / 1000, Mu / 1000, a2, m);
            cb = { e0, ea, e2, e1, Mu, res, lamOK: r.lam <= Math.max(50, Math.min(67 * e1 / a2, 100)) }; ok = ok && res.ok && res.As <= 0.02 * a2 * a2 * 1e4 && cb.lamOK; }
          return { a: a2, self, Gc, Nu, r, cb, ok, Mx, My, altInfo, As: Math.max(r.As, cb ? cb.res.As : 0) }; };
        for (; a <= 0.60 + 1e-9; a = Math.round((a + 0.05) * 100) / 100) { const t = eval_(a); if (t.ok) { got = t; break; } }
        if (!got) { got = eval_(0.60); failed = true; warn.push('Poteau ' + lab[c.id] + ' (' + (k === N ? 'RDC' : 'R+' + (N - k)) + ') : 60 × 60 cm insuffisant, réduisez la charge (ajoutez des poteaux) ou étudiez-le avec un ingénieur.'); }
        levels.push({ k, name: k === N ? 'RDC' : 'R+' + (N - k), Mx: got.Mx, My: got.My, alt: got.altInfo, bend: got.cb ? { e0: got.cb.e0, ea: got.cb.ea, e2: got.cb.e2, Mu: got.cb.Mu, AsFlex: got.cb.res.As, AsCentered: got.r.As, MR: got.cb.res.MR * 1000, lamOK: got.cb.lamOK } : null, Gk, Qk, self: got.self, G: got.Gc, Q: Qc, deg, nFloors: nfl, Nu: got.Nu, Ns: got.Gc + Qc, a: got.a, lam: got.r.lam, Areq: got.r.Areq, Amin: got.r.Amin, Amax: got.r.Amax, bars: S.colBars(got.As) }); Gprev = got.Gc; aPrev = got.a; }
      const base = levels[N - 1], out = { a: base.a, Nu: base.Nu, Ns: base.Ns, r: { lam: base.lam, alpha: 0, Areq: base.Areq, Amin: base.Amin, Amax: base.Amax, As: base.bars.As } }; out.r.alpha = S.column(base.Nu / 1000, base.a, l0, m).alpha;
      if (!mine.length) warn.push('Poteau ' + lab[c.id] + ' : aucune poutre ne l\'atteint, sa charge est limitée à son poids propre.');
      // node detailing: anchorage of the beam bars in the column (hook: straight length 0,4 ls) and beam width against column width, at every slab level
      const CVR = 0.03, capD = o => { const need = Math.max(0, o.Aa - 2 * area(10)); return need > 0.3 ? S.beamBars(need, o.b).d : 0; };
      const nodeInfo = rive.map(b => { const o = bm.get(b.k), d = Math.max(o.barT.d, 10, capD(o)), an = S.anchorage(d, m), u = dirOf(b); return { beam: b.id, axis: Math.abs(u[0]) >= Math.abs(u[1]) ? 'x' : 'y', b: o.b, d, ls: an.ls, la: an.la, need: an.la + CVR }; });
      const nodeLv = levels.map((lv, i) => { const aN = i === 0 ? lv.a : levels[i - 1].a, bad = nodeInfo.filter(n => aN - CVR < n.la - 1e-9 || n.b > aN + 1e-9); return { k: lv.k, name: lv.name, a: aN, ok: !bad.length, bad: bad.map(n => n.beam) }; });
      if (nodeLv.some(l => !l.ok)) { const w = nodeLv.find(l => !l.ok), n = nodeInfo.find(x => w.bad.includes(x.beam)); warn.push('Nœud ' + lab[c.id] + ' : ancrage des barres HA' + n.d + ' de ' + n.beam + ' insuffisant dans le poteau de ' + Math.round(w.a * 100) + ' cm au niveau ' + w.name + ' (largeur d\'au moins ' + Math.round(Math.ceil(n.need * 20) * 5) + ' cm pour un crochet normal) : réduisez le diamètre, élargissez le poteau ou prévoyez des barres en U.'); }
      const bars = base.bars, ft = S.footing(out.Nu, out.Ns, out.a, p.sigSol, m);
      res.columns.push({ id: c.id, label: lab[c.id], p: c.p, a: out.a, l0, Nu: out.Nu, Ns: out.Ns, lam: out.r.lam, alpha: out.r.alpha, Areq: out.r.Areq, Amin: out.r.Amin, Amax: out.r.Amax, bars, tie: out.a >= 0.2 ? 'cadres HA6 e=' + Math.floor(Math.min(15 * bars.d / 10, 40, out.a * 100 + 10) / 5) * 5 + ' cm' : '', failed, continuous: cont, levels, node: { rive: nodeInfo, levels: nodeLv, pairs: pairs.map(pr => ({ axis: pr.axis, beams: [pr.a.id, pr.b.id] })) }, beams: mine.map(b => b.id), footing: { ...ft, bars: S.footBars(ft.As, ft.side) } }); });
    res.columns.sort((q, r) => parseInt(q.label.slice(1)) - parseInt(r.label.slice(1)));
    // --- strip footings: under a row of columns when the isolated footings (nearly) touch, or always when asked for
    const mode = p.found || 'auto', colRes = Object.fromEntries(res.columns.map(c => [c.id, c])), cand = []; res.strips = []; res.raft = null;
    // raft: when asked for, or (automatic) when the isolated footings would cover at least half of the building footprint
    const px = cols.map(c => c.p[0]), py = cols.map(c => c.p[1]), S0 = (Math.max(...px) - Math.min(...px) + 1) * (Math.max(...py) - Math.min(...py) + 1), isoArea = res.columns.reduce((s, c) => s + c.footing.side * c.footing.side, 0);
    res.footRatio = isoArea / S0; let raftOn = false;
    if (mode === 'radier' && !cells.length) warn.push('Radier : aucune dalle rectangulaire fermée par des poutres, impossible de dimensionner les nervures. Calcul avec des semelles.');
    if (cells.length && (mode === 'radier' || (mode === 'auto' && res.footRatio >= 0.5))) { raftOn = true;
      const rf = S.raft({ cols: res.columns, cells, beams, chains, p, m, lab }); res.raft = rf;
      res.columns.forEach(c => { c.raft = true; c.fh = Math.max(rf.e, ...rf.nerv.filter(v => v.ca === c.id || v.cb === c.id).map(v => v.h)); c.fw = Math.max(0.3, ...rf.nerv.filter(v => v.ca === c.id || v.cb === c.id).map(v => v.b)); });
      if (rf.soilFailed) warn.push('Radier : la pression du sol (' + A.fmt(rf.sigma) + ' MPa) dépasse l\'admissible (' + A.fmt(p.sigSol) + ' MPa) même avec 3 m de débord : prévoyez un sol amélioré ou des fondations profondes.');
      if (rf.failed) warn.push('Radier : section non trouvée pour tous les éléments (épaisseur ou nervures insuffisantes), réduisez les portées.');
      if (mode === 'auto') warn.push('Radier retenu automatiquement : les semelles isolées couvriraient ' + Math.round(res.footRatio * 100) + ' % de l\'emprise (seuil 50 %).');
      warn.push('Radier nervuré : pré-dimensionnement sous les files de poutres (pression uniforme sous la résultante des charges). Tassements différentiels, poinçonnement, étanchéité et soulèvement à vérifier par un ingénieur.'); }
    if (!raftOn) chains.forEach(chain => { const cs = [chain[0].flip ? chain[0].b.cb : chain[0].b.ca]; chain.forEach(it => cs.push(it.flip ? it.b.ca : it.b.cb)); if (cs.length < 2) return;
      const close = cs.some((c, i) => i > 0 && colRes[c.id].footing.side / 2 + colRes[cs[i - 1].id].footing.side / 2 + 0.25 > A.dist(c.p, cs[i - 1].p)); if (mode === 'filantes' || (mode === 'auto' && close)) cand.push({ cs, chain }); });
    const parts = {}; cand.forEach((cd, k) => cd.cs.forEach(c => { const R = cd.chain.filter(it => it.b.ca.id === c.id || it.b.cb.id === c.id).reduce((s, it) => s + react(it.b, c.id, true), 0); (parts[c.id] = parts[c.id] || []).push({ k, R }); }));
    cand.forEach((cd, k) => { const u = A.unit(cd.cs[0].p, cd.cs[cd.cs.length - 1].p), cols = cd.cs.map(c => { const list = parts[c.id], tot = list.reduce((s, x) => s + x.R, 0), mine = list.find(x => x.k === k), fr = tot > 0 ? mine.R / tot : 1 / list.length, cr = colRes[c.id];
        return { id: c.id, label: cr.label, x: (c.p[0] - cd.cs[0].p[0]) * u[0] + (c.p[1] - cd.cs[0].p[1]) * u[1], Nu: cr.Nu * fr, Ns: cr.Ns * fr, a: cr.a }; });
      const st = S.strip(cols, p, m), n = [-u[1], u[0]], O = cd.cs[0].p, P = (x, y) => [O[0] + u[0] * x + n[0] * y, O[1] + u[1] * x + n[1] * y];
      Object.assign(st, { id: 'SF' + (k + 1), u, origin: O, cols, corners: [P(st.x0, -st.B / 2), P(st.x1, -st.B / 2), P(st.x1, st.B / 2), P(st.x0, st.B / 2)], centre: P((st.x0 + st.x1) / 2, 0) });
      if (st.failed) warn.push('Semelle filante ' + st.id + ' : hauteur de 1,20 m insuffisante, étudiez un radier.');
      st.cols.forEach(c => { const cr = colRes[c.id]; (cr.strips = cr.strips || []).push(st.id); cr.fh = Math.max(cr.fh || 0, st.h); cr.fw = Math.max(cr.fw || 0, st.B); });
      res.strips.push(st); });
    // overlaps: isolated footings between themselves, and parallel strips
    const iso = res.columns.filter(c => !c.strips && !c.raft);
    for (let i = 0; i < iso.length; i++) for (let j = i + 1; j < iso.length; j++) { const u = iso[i], v = iso[j], f1 = u.footing.side / 2, f2 = v.footing.side / 2; if (Math.abs(u.p[0] - v.p[0]) < f1 + f2 - 0.001 && Math.abs(u.p[1] - v.p[1]) < f1 + f2 - 0.001) warn.push('Semelles de ' + u.label + ' et ' + v.label + ' qui se chevauchent : prévoyez une semelle filante ou un radier.'); }
    for (let i = 0; i < res.strips.length; i++) for (let j = i + 1; j < res.strips.length; j++) { const u = res.strips[i], v = res.strips[j]; if (Math.abs(u.u[0] * v.u[0] + u.u[1] * v.u[1]) > 0.95 && Math.abs((v.centre[0] - u.centre[0]) * -u.u[1] + (v.centre[1] - u.centre[1]) * u.u[0]) < (u.B + v.B) / 2 - 0.001) { const su = (v.centre[0] - u.centre[0]) * u.u[0] + (v.centre[1] - u.centre[1]) * u.u[1]; if (Math.abs(su) < (u.L + v.L) / 2) warn.push('Semelles filantes ' + u.id + ' et ' + v.id + ' parallèles qui se recoupent : prévoyez un radier.'); } }
    if (res.columns.some(c => c.strips && c.strips.length > 1)) warn.push('Semelles filantes : les croisements de deux semelles ne sont pas détaillés (nœud d\'angle à étudier).');
    res.H = H; res.hs = hs; res.sigSol = p.sigSol; res.found = mode; res.totals = { Nu: res.columns.reduce((s, c) => s + c.Nu, 0), Ns: res.columns.reduce((s, c) => s + c.Ns, 0) };
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
    r.columns.forEach(c => { if (c.strips || c.raft) return; const f = c.footing.side, q = [T([c.p[0] - f / 2, c.p[1] + f / 2]), T([c.p[0] + f / 2, c.p[1] - f / 2])]; ctx.strokeRect(q[0][0], q[0][1], q[1][0] - q[0][0], q[1][1] - q[0][1]); });
    if (r.raft) { const q0 = T([r.raft.x0, r.raft.y1]), q1 = T([r.raft.x1, r.raft.y0]); ctx.strokeRect(q0[0], q0[1], q1[0] - q0[0], q1[1] - q0[1]); }
    (r.strips || []).forEach(st => { ctx.beginPath(); st.corners.forEach((p, i) => { const q = T(p); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.closePath(); ctx.stroke(); });
    ctx.setLineDash([]); ctx.lineWidth = Math.max(2, 0.2 * v.s * 0.5); ctx.strokeStyle = 'rgba(255,159,107,.55)';
    r.beams.forEach(b => { const p = T(b.p1), q = T(b.p2); ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); });
    const px = Math.max(9, Math.min(13, 0.22 * v.s)); ctx.font = `${px}px Inter, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillStyle = th.text || '#ffd27a';
    r.beams.forEach(b => { const mx = (b.p1[0] + b.p2[0]) / 2, my = (b.p1[1] + b.p2[1]) / 2, q = T([mx, my]); ctx.save(); ctx.translate(q[0], q[1]); let ang = -Math.atan2(b.p2[1] - b.p1[1], b.p2[0] - b.p1[0]); if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI; ctx.rotate(ang); ctx.fillText(`${b.id} ${Math.round(b.b * 100)}×${Math.round(b.h * 100)}`, 0, -4); ctx.restore(); });
    r.columns.forEach(c => { const f = c.strips || c.raft ? c.a / 2 + 0.05 : c.footing.side / 2, top = T([c.p[0], c.p[1] + f]), bot = T([c.p[0], c.p[1] - f]); ctx.fillStyle = th.text || '#ffd27a'; ctx.textBaseline = 'bottom'; ctx.fillText(`${c.label} ${Math.round(c.a * 100)}×${Math.round(c.a * 100)}`, top[0], top[1] - 2);
      if (c.strips || c.raft) return; ctx.fillStyle = '#ffb27a'; ctx.textBaseline = 'top'; ctx.fillText(`S ${A.fmt(c.footing.side)}`, bot[0], bot[1] + 2); });
    if (r.raft) { const q = T([r.raft.xR, r.raft.y0]); ctx.fillStyle = '#ffb27a'; ctx.textBaseline = 'top'; ctx.fillText(`Radier ${A.fmt(r.raft.Lx)}×${A.fmt(r.raft.Ly)} e=${Math.round(r.raft.e * 100)}`, q[0], q[1] + 6); }
    (r.strips || []).forEach(st => { const q = T(st.centre); ctx.fillStyle = '#ffb27a'; ctx.textBaseline = 'middle'; ctx.fillText(`${st.id} ${A.fmt(st.B)}×${A.fmt(st.L)} h=${Math.round(st.h * 100)}`, q[0], q[1] + Math.max(14, st.B * v.s / 2 + 10)); });
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
    h += `<h2>3. Poutres</h2><table>${head(['Poutre', 'Entre', 'Portée (m)', 'Section b × h (cm)', 'Continuité', 'pu (kN/m)', 'M0 (kN.m)', 'M appui gauche / travée / appui droit (kN.m)', 'Armatures de travée', 'Chapeaux (appui g. / appui d.)', 'Vu (kN)', 'τu (MPa)', 'Cadres HA6'])}`;
    r.beams.forEach(b => { h += row([b.id + (b.manual ? ' (dessinée)' : ''), b.from + '–' + b.to, f(b.L), Math.round(b.b * 100) + ' × ' + Math.round(b.h * 100), b.nSpans > 1 ? 'travée ' + b.pos + '/' + b.nSpans + ' (' + (b.method === 'caquot' ? 'Caquot' : 'forfaitaire') + ')' : 'travée isolée', f(b.pu), f(b.M0), f(b.MA, 1) + ' / ' + f(b.Mt, 1) + ' / ' + f(b.MB, 1), b.barT.text, (b.AaA > 0 ? S.beamBars(b.AaA, b.b).text : '—') + ' / ' + (b.AaB > 0 ? S.beamBars(b.AaB, b.b).text : '—'), f(b.Vu, 1), f(b.tau), 'e=' + b.st + ' cm']); });
    h += '</table><p class="note">Poutres alignées reliées par un poteau : poutre continue, calculée par la méthode forfaitaire (BAEL B.6.2,21) quand Q ≤ 2G et que les portées voisines sont dans un rapport de 0,8 à 1,25, sinon par la méthode de Caquot (B.6.2,22). Moments aux appuis de rive : 0,15 M0 (encastrement partiel). Section commune à toute la file. Efforts tranchants majorés de 10 % (2 travées) ou 15 % (3 travées et plus) sur le premier appui intermédiaire. Charges sur les poutres : charges équivalentes des dalles (triangle, trapèze), poids propre et maçonnerie. Armatures de montage non détaillées.</p>';
    h += `<h2>4. Descente de charges, poteaux et semelles</h2><p class="note">Descente de charges du dernier plancher jusqu'aux fondations. Les réactions des poutres de chaque niveau (parts permanente G et d'exploitation Q) viennent de l'analyse des poutres continues ; le poids propre de chaque tronçon de poteau est ajouté avec sa propre section ; les charges d'exploitation des planchers sont cumulées avec la loi de dégression NF P06-001 : Q0 + (3 + n)/(2n) · (Q1 + … + Qn) pour n ≥ 5 planchers sous la toiture (sans réduction en dessous${p.degr === false ? ' ; dégression désactivée pour ce calcul' : ''}). La section d'un niveau n'est jamais inférieure à celle du niveau supérieur.</p><table>${head(['Poteau', 'Niveau', 'Réactions des poutres G / Q (kN)', 'Poids propre du poteau (kN)', 'Σ G (kN)', 'Σ Q (kN)', 'Coefficient de dégression', 'Nu (kN)', 'Ns (kN)', 'Section (cm)', 'Armatures'])}`;
    r.columns.forEach(c => c.levels.forEach(lv => { h += row([c.label, lv.name, f(lv.Gk, 1) + ' / ' + f(lv.Qk, 1), f(lv.self, 1), f(lv.G, 1), f(lv.Q, 1), lv.nFloors >= 5 && lv.deg < 1 ? f(lv.deg, 3) : '1', f(lv.Nu, 0), f(lv.Ns, 0), Math.round(lv.a * 100) + ' × ' + Math.round(lv.a * 100), lv.bars.text]); }));
    h += `</table><p><b>Poteaux (niveau RDC) et semelles</b></p><table>${head(['Poteau', 'Section (cm)', 'Nu (kN)', 'Ns (kN)', 'λ', 'Armatures', 'Cadres', 'Semelle A × A (m)', 'Hauteur (m)', 'Aciers de semelle', 'σ sol (MPa)'])}`;
    r.columns.forEach(c => { h += row([c.label, Math.round(c.a * 100) + ' × ' + Math.round(c.a * 100), f(c.Nu, 0), f(c.Ns, 0), f(c.lam, 1), c.bars.text + ' (A = ' + f(c.Areq) + ' cm² requis, mini ' + f(c.Amin) + ')', c.tie, c.raft ? 'sur le radier' : c.strips ? 'sous ' + c.strips.join(' + ') : f(c.footing.side) + ' × ' + f(c.footing.side), c.strips || c.raft ? f(c.fh) : f(c.footing.h), c.strips || c.raft ? '—' : c.footing.bars.text, c.strips || c.raft ? '—' : f(c.footing.sigma)]); });
    h += `</table><p class="note">Poteaux : méthode forfaitaire BAEL B.8.4 (élancement, flambement), longueur de flambement 0,7 l0, charges issues de l\'analyse des poutres continues (effet de continuité compris). Semelles isolées : méthode des bielles, aciers = max(ELU, ELS fissuration préjudiciable). Charges totales : Nu = ${f(r.totals.Nu, 0)} kN, Ns = ${f(r.totals.Ns, 0)} kN.</p>`;
    const nodes = r.columns.filter(c => c.node && (c.node.rive.length || c.node.pairs.length));
    if (nodes.length) { h += `<h2>4 bis. Nœuds poutre-poteau</h2><table>${head(['Poteau', 'Poutres de rive (sens)', 'Barres ancrées : Ø max, la = 0,4·ls, largeur de poteau requise', 'Largeur de poteau (haut / RDC)', 'Ancrage', 'Poutres continues (sens)', 'Moment d\'équilibre sous chargement alterné au RDC : ΔM / part du poteau (kN.m)', 'Moment transmis au RDC Mx / My (kN.m)', 'e0 + ea + e2 (cm)', 'Mu = N·(e0 + ea + e2) (kN.m)', 'Aciers : flexion composée / compression centrée (cm²)'])}`;
      nodes.forEach(c => { const b = c.levels[c.levels.length - 1], bd = b.bend, top = c.node.levels[0], bot = c.node.levels[c.node.levels.length - 1], bad = c.node.levels.some(l => !l.ok), al = b.alt || { x: 0, y: 0, dMx: 0, dMy: 0 }, hasR = c.node.rive.length;
        h += row([c.label, hasR ? c.node.rive.map(n => n.beam + ' (' + n.axis + ')').join(', ') : '—', hasR ? c.node.rive.map(n => 'HA' + n.d + ', ' + f(n.la * 100, 0) + ' cm, ≥ ' + Math.round(Math.ceil(n.need * 20) * 5) + ' cm').join(' ; ') : '—', Math.round(top.a * 100) + ' / ' + Math.round(bot.a * 100) + ' cm', hasR ? (bad ? '<b>insuffisant</b> (' + c.node.levels.filter(l => !l.ok).map(l => l.name).join(', ') + ')' : 'suffisant') : '—',
          c.node.pairs.length ? c.node.pairs.map(q => q.beams.join('–') + ' (' + q.axis + ')').join(', ') : '—', c.node.pairs.length ? (al.dMx ? 'x : ' + f(al.dMx, 1) + ' / ' + f(al.x, 1) : '') + (al.dMx && al.dMy ? ' ; ' : '') + (al.dMy ? 'y : ' + f(al.dMy, 1) + ' / ' + f(al.y, 1) : '') : '—',
          f(b.Mx, 1) + ' / ' + f(b.My, 1), bd ? f(bd.e0 * 100, 1) + ' + ' + f(bd.ea * 100, 1) + ' + ' + f(bd.e2 * 100, 1) : '—', bd ? f(bd.Mu, 1) : '—', bd ? f(bd.AsFlex) + ' / ' + f(bd.AsCentered) : '—']); });
      h += '</table><p class="note">Une poutre qui s\'arrête sur un poteau sans poutre alignée de l\'autre côté (poteau de rive ou d\'angle) lui transmet son moment d\'appui de rive (0,15 M0 en méthode forfaitaire ou de Caquot) : réparti par moitié entre le poteau au-dessus et au-dessous de chaque plancher, en totalité vers le poteau sous la toiture ; deux poutres perpendiculaires donnent une flexion déviée traitée par excentricité équivalente e0 = e_grand + 0,7·e_petit. <b>Poteaux continus</b> (poutres alignées de part et d\'autre) : sous chargement alterné (une travée chargée à 1,35 G + 1,5 Q, la voisine à 1,35 G), les moments d\'encastrement p·L²/12 ne s\'équilibrent plus ; le déséquilibre ΔM (le plus défavorable des deux dispositions) est réparti entre les poteaux au-dessus et au-dessous et les deux poutres au prorata des rigidités I/L (une seule distribution, extrémités éloignées encastrées). Calcul en flexion composée par l\'équilibre de la section (béton parabole-rectangle, acier bilinéaire, pivots B et C, deux lits d\'acier), excentricité additionnelle ea = max(2 cm ; l0/250) et effets du second ordre e2 = 3·lf²·(2 + α·φ) / (10⁴·h) avec φ = 2 (BAEL A.4.3,5). Ancrage des barres des poutres de rive par crochet à 180° : longueur droite 0,4·ls en dehors du crochet, enrobage 3 cm ; la largeur de poteau requise est arrondie à 5 cm.</p>'; }
    if (r.strips && r.strips.length) { h += `<h2>5. Semelles filantes</h2><table>${head(['Semelle', 'Poteaux', 'B × L × h (m)', 'σ sol (MPa)', 'wu (kN/m)', 'M appui / M travée (kN.m)', 'Vu (kN)', 'τu / limite (MPa)', 'Aciers inférieurs (sous les poteaux)', 'Aciers supérieurs (entre poteaux)', 'Aciers transversaux'])}`;
      r.strips.forEach(st => { h += row([st.id, st.cols.map(c => c.label).join(', '), f(st.B) + ' × ' + f(st.L) + ' × ' + f(st.h), f(st.sigma), f(st.wu, 1), f(st.Mbot, 1) + ' / ' + f(st.Mtop, 1), f(st.V, 1), f(st.tau) + ' / ' + f(st.tauLim), st.barBot.text, st.barTop.text, st.barTr.text]); });
      h += '</table><p class="note">Semelle centrée sur la résultante des charges de service (pression uniforme du sol), calculée dans le sens longitudinal comme une poutre continue renversée (méthode forfaitaire ou Caquot, débords en console), dans le sens transversal comme deux consoles de largeur (B − 25 cm)/2. Section rectangulaire sans armatures d\'effort tranchant : τu ≤ 0,07 fc28/γb. Aciers = max(ELU, ELS fissuration préjudiciable, section minimale). Charge d\'un poteau commun à deux semelles répartie au prorata des réactions des poutres.</p>'; }
    if (r.raft) { const rf = r.raft; h += `<h2>6. Radier nervuré</h2><table>${head(['Donnée', 'Valeur'])}${row(['Emprise', f(rf.Lx) + ' × ' + f(rf.Ly) + ' m = ' + f(rf.S, 1) + ' m² (débord ' + f(rf.rim) + ' m), centrée sur la résultante des charges de service'])}${row(['Charges', 'ΣNu = ' + f(rf.sNu, 0) + ' kN, ΣNs = ' + f(rf.sNs, 0) + ' kN ; pression nette ELU qu = ' + f(rf.qu, 1) + ' kN/m²'])}${row(['Poids du radier / pression du sol', f(rf.W, 0) + ' kN ; σ = ' + f(rf.sigma) + ' MPa (admissible ' + f(r.sigSol) + ' MPa)'])}${row(['Dalle', 'épaisseur ' + Math.round(rf.e * 100) + ' cm'])}${row(['Console de débord', 'M = ' + f(rf.dbord.M, 1) + ' kN.m/m ; aciers supérieurs ' + rf.dbord.bar.text])}</table>`;
      h += `<table>${head(['Panneau', 'lx × ly (m)', 'α', 'qu (kN/m²)', 'M0x / M0y', 'Face supérieure (travée) sens x / sens y', 'Face inférieure (sur nervures) sens x / sens y', 'τu / limite (MPa)'])}`;
      rf.panels.forEach(d => { h += row([d.id, f(d.lx) + ' × ' + f(d.ly), f(d.alpha), f(d.pu, 1), f(d.M0x, 1) + ' / ' + f(d.M0y, 1), d.barTx.text + ' / ' + d.barTy.text, d.barAx.text + ' / ' + d.barAy.text, f(d.tau) + ' / ' + f(d.tauLim)]); }); h += '</table>';
      h += `<table>${head(['Nervure', 'Entre', 'Portée (m)', 'Section b × h (cm)', 'Continuité', 'M appui g. / travée / appui d. (kN.m)', 'Aciers de travée (face supérieure)', 'Chapeaux (face inférieure, appui g. / d.)', 'Vu (kN)', 'τu (MPa)', 'Cadres HA6'])}`;
      rf.nerv.forEach(b => { h += row([b.id, b.from + '–' + b.to, f(b.L), Math.round(b.b * 100) + ' × ' + Math.round(b.h * 100), b.nSpans > 1 ? 'travée ' + b.pos + '/' + b.nSpans + ' (' + (b.method === 'caquot' ? 'Caquot' : 'forfaitaire') + ')' : 'travée isolée', f(b.MA, 1) + ' / ' + f(b.Mt, 1) + ' / ' + f(b.MB, 1), b.barT.text, (b.AaA > 0 ? S.beamBars(b.AaA, b.b).text : '—') + ' / ' + (b.AaB > 0 ? S.beamBars(b.AaB, b.b).text : '—'), f(b.Vu, 1), f(b.tau), 'e=' + b.st + ' cm']); });
      h += '</table><p class="note">Radier nervuré : dalle et nervures sous les files de poutres, calculés comme un plancher renversé soumis à la pression nette du sol qu = ΣNu / S (le poids propre du radier est repris directement par le sol). Panneaux de dalle : coefficients de l\'annexe E3 ; nervures : poutres continues (forfaitaire ou Caquot) ; débord : console. La pression du sol de service inclut le poids du radier. Épaisseur de dalle ≥ lx/20 et ≥ 20 cm, hauteur des nervures ≥ L/8. Poinçonnement, tassements différentiels et étanchéité non vérifiés.</p>'; }
    h += '</body></html>'; return h; };
})();
