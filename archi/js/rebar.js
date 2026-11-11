// Reinforcement drawings and bills of quantities from the BAEL pre-sizing result (doc.struct.result).
// Conventions (also printed on the sheets): cover 3 cm (5 cm for footings), 180° hook developed 20 Ø, 90° hook 12 Ø, stirrup hooks 10 Ø,
// straight anchorage ls = Ø·fe / (4·τs) with τs = 0.6·ψs²·ft28 (ψs = 1.5), weight 0.00617 Ø² kg/m (Ø in mm). Pre-sizing: to be checked by an engineer.
(function () {
  const A = window.App, R = A.rebar = {}, C = 0.03, CF = 0.05, ST = 6, MONT = 10;
  const kgm = d => 0.00617 * d * d, hook180 = d => 20 * d / 1000, hook90 = d => 12 * d / 1000, area = d => Math.PI * Math.pow(d / 10, 2) / 4;
  const f1 = v => A.fmt(v, 2), esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  R.ls = (d, m) => d / 1000 * m.fe / (4 * 0.6 * 2.25 * m.ft28);          // straight anchorage length (m)
  const bar = (mark, desc, n, d, len, shape) => ({ mark, desc, n, d, len, kg: n * len * kgm(d), shape });

  // ---------- model: every bar of every element, with lengths and weights ----------
  R.model = doc => {
    const r = doc.struct.result; if (!r || r.errors.length) return null; const m = r.mat, p = r.params, colBy = {}; r.columns.forEach(c => { colBy[c.id] = c; });
    const out = { beams: [], cols: [], foots: [], slabs: [], mat: m, H: r.H, hs: r.hs, ls: d => R.ls(d, m) };
    r.beams.forEach(b => { const A_ = colBy[b.ca], B_ = colBy[b.cb], aA = A_.a, aB = B_.a, Ln = b.L - (aA + aB) / 2, bars = [], d = b.barT.d, n = b.barT.n;
      const straight = b.L + (aA + aB) / 2 - 2 * C, mont = { n: 2, d: MONT }, cad = ST, nCad = Math.max(1, Math.floor(Ln / (b.st / 100) + 1e-9)), cadLen = 2 * (b.b - 2 * C) + 2 * (b.h - 2 * C) + 2 * 10 * ST / 1000;
      const capBars = Aa => { const need = Math.max(0, Aa - 2 * area(MONT)); return need > 0.3 ? A.struct.beamBars(need, b.b) : null; }, chapA = capBars(b.AaA), chapB = capBars(b.AaB);
      // a hogging bar over an inner support runs on into the neighbouring span (only this span's share is listed); at an end support it is anchored by a hook
      const capLen = (ch, cap, end, a) => cap + a / 2 + (end === 'rive' ? -C + hook180(ch.d) : 0), mk = { };
      bars.push(bar('1', 'Armatures inférieures de travée', n, d, straight + 2 * hook180(d), 'straight-hooks'));
      bars.push(bar('2', 'Armatures supérieures de montage', mont.n, mont.d, straight + 2 * hook180(mont.d), 'straight-hooks'));
      let k = 3; if (chapA) { mk.A = String(k); bars.push(bar(String(k++), 'Chapeaux sur l\'appui ' + b.from + (b.endA === 'rive' ? ' (ancrés par crochet)' : ' (se poursuivent dans la travée voisine)'), chapA.n, chapA.d, capLen(chapA, b.capA, b.endA, aA), 'chapeau')); }
      if (chapB) { mk.B = String(k); bars.push(bar(String(k++), 'Chapeaux sur l\'appui ' + b.to + (b.endB === 'rive' ? ' (ancrés par crochet)' : ' (se poursuivent dans la travée voisine)'), chapB.n, chapB.d, capLen(chapB, b.capB, b.endB, aB), 'chapeau')); }
      mk.cad = String(k); bars.push(bar(String(k), 'Cadres HA' + cad + ' e=' + b.st + ' cm', nCad, cad, cadLen, 'stirrup'));
      out.beams.push({ id: b.id, from: b.from, to: b.to, L: b.L, Ln, b: b.b, h: b.h, aA, aB, bot: { n, d }, mont, chapA, chapB, capA: b.capA, capB: b.capB, endA: b.endA, endB: b.endB, MA: b.MA, MB: b.MB, Mt: b.Mt, M0: b.M0, method: b.method, chain: b.chain, pos: b.pos, nSpans: b.nSpans, mk, st: b.st, nCad, bars, kg: bars.reduce((s, x) => s + x.kg, 0), conc: b.b * b.h * Ln }); });
    r.columns.forEach(c => { const d = c.bars.d, n = c.bars.n, st = Math.max(5, Math.floor(Math.min(15 * d / 10, 40, c.a * 100 + 10) / 5) * 5), nCad = Math.floor(r.H / (st / 100)) + 2, ft = c.footing, ls = p.nlev > 1 ? R.ls(d, m) : 0;
      const L1 = r.H - C + (ft.h - CF) + hook90(d) + ls, cadLen = 4 * (c.a - 2 * C) + 2 * 10 * ST / 1000, bars = [bar('1', 'Armatures longitudinales' + (ls ? ' (attentes de ' + A.fmt(ls) + ' m au niveau supérieur)' : ''), n, d, L1, 'column'), bar('2', 'Cadres HA' + ST + ' e=' + st + ' cm', nCad, ST, cadLen, 'stirrup')];
      out.cols.push({ id: c.id, label: c.label, a: c.a, H: r.H, n, d, st, nCad, bars, kg: bars.reduce((s, x) => s + x.kg, 0), conc: c.a * c.a * r.H, lap: ls });
      const fb = ft.bars, fbar = bar('1', 'Aciers de semelle, sens x et sens y (' + fb.n + ' HA' + fb.d + ' par sens)', 2 * fb.n, fb.d, ft.side - 2 * CF + 2 * hook90(fb.d), 'footing');
      out.foots.push({ id: c.id, label: c.label.replace('P', 'S'), col: c.label, side: ft.side, h: ft.h, a: c.a, n: fb.n, d: fb.d, bars: [fbar], kg: fbar.kg, conc: ft.side * ft.side * ft.h, sigma: ft.sigma, Nu: c.Nu }); });
    if (r.slab) r.slab.panels.forEach(s => { const w = s.x1 - s.x0, h = s.y1 - s.y0, shortX = w <= h, spanX = shortX ? s.lx : s.ly, spanY = shortX ? s.ly : s.lx, cnt = (perp, e) => Math.floor(perp * 100 / e + 1e-9) + 1, bars = [];
      const tx = s.barTx, ty = s.barTy, ax = s.barAx, ay = s.barAy;   // x = direction of the short span lx
      const dirs = [['x', tx, ax, s.lx, s.ly], ['y', ty, ay, s.ly, s.lx]];
      dirs.forEach(([k, t, a, span, perp], i) => { bars.push(bar(String(2 * i + 1), 'Armatures inférieures dans le sens ' + (k === 'x' ? 'de la petite portée lx' : 'de la grande portée ly') + ' : HA' + t.d + ' e=' + t.e, cnt(perp, t.e), t.d, span, 'slab-bottom'));
        bars.push(bar(String(2 * i + 2), 'Chapeaux sur appuis, sens ' + (k === 'x' ? 'lx' : 'ly') + ' : HA' + a.d + ' e=' + a.e, 2 * cnt(perp, a.e), a.d, 0.2 * span + 0.15, 'slab-top')); });
      out.slabs.push({ id: s.id, w, h, shortX, lx: s.lx, ly: s.ly, thick: r.slab.h, x0: s.x0, y0: s.y0, x1: s.x1, y1: s.y1, bars, kg: bars.reduce((q, x) => q + x.kg, 0), conc: w * h * r.slab.h, tx, ty, ax, ay }); });
    const sum = k => (arr) => arr.reduce((q, x) => q + x[k], 0);
    out.totals = { beams: { kg: sum('kg')(out.beams), conc: sum('conc')(out.beams) }, cols: { kg: sum('kg')(out.cols), conc: sum('conc')(out.cols) }, foots: { kg: sum('kg')(out.foots), conc: sum('conc')(out.foots) }, slabs: { kg: sum('kg')(out.slabs), conc: sum('conc')(out.slabs) } };
    out.totals.all = { kg: Object.values(out.totals).reduce((q, x) => q + x.kg, 0), conc: Object.values(out.totals).reduce((q, x) => q + x.conc, 0) };
    // per-diameter steel summary
    const byD = {}; [...out.beams, ...out.cols, ...out.foots, ...out.slabs].forEach(e => e.bars.forEach(b => { byD[b.d] = (byD[b.d] || 0) + b.n * b.len; })); out.byDiameter = Object.keys(byD).map(Number).sort((x, y) => x - y).map(d => ({ d, len: byD[d], kg: byD[d] * kgm(d) }));
    return out; };

  // ---------- drawing helpers ----------
  const INK = '#1a1a1a', RED = '#c0392b', BLUE = '#1f6fb5', MUTE = '#666', GREY = '#e9e9e9';
  const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" style="max-width:${w}px;background:#fff" font-family="Inter,system-ui,sans-serif" font-size="11">${body}</svg>`;
  const L = (x1, y1, x2, y2, c = INK, w = 1, extra = '') => `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${c}" stroke-width="${w}" ${extra}/>`;
  const Rc = (x, y, w, h, fill = 'none', c = INK, sw = 1, extra = '') => `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${fill}" stroke="${c}" stroke-width="${sw}" ${extra}/>`;
  const T = (x, y, t, anchor = 'middle', c = INK, size = 11, extra = '') => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" fill="${c}" font-size="${size}" ${extra}>${esc(t)}</text>`;
  const Pth = (pts, c = RED, w = 2, extra = '') => `<path d="M${pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L')}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linejoin="round" ${extra}/>`;
  const Ci = (x, y, r, fill = RED) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${Math.max(2.2, r).toFixed(1)}" fill="${fill}" stroke="${INK}" stroke-width="0.6"/>`;
  const dimH = (x1, x2, y, label) => L(x1, y, x2, y, MUTE, 0.8) + L(x1, y - 4, x1, y + 4, MUTE, 0.8) + L(x2, y - 4, x2, y + 4, MUTE, 0.8) + T((x1 + x2) / 2, y - 4, label, 'middle', MUTE, 10);
  const dimV = (x, y1, y2, label) => L(x, y1, x, y2, MUTE, 0.8) + L(x - 4, y1, x + 4, y1, MUTE, 0.8) + L(x - 4, y2, x + 4, y2, MUTE, 0.8) + T(x - 6, (y1 + y2) / 2, label, 'end', MUTE, 10);
  const mark = (x, y, t) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8" fill="#fff" stroke="${INK}"/>` + T(x, y + 4, t, 'middle', INK, 11, 'font-weight="700"');
  const spread = (n, lo, hi) => n === 1 ? [(lo + hi) / 2] : Array.from({ length: n }, (_, i) => lo + (hi - lo) * i / (n - 1));
  // Longitudinal bar positions in a square column section (n = 4, 6, 8, 10, 12 ...): corners first, then the sides.
  const colPositions = (n, lo, hi) => { const pts = [[lo, lo], [hi, lo], [hi, hi], [lo, hi]], m = n - 4; if (m <= 0) return pts.slice(0, Math.max(n, 1));
    if (m === 2) { pts.push([(lo + hi) / 2, lo], [(lo + hi) / 2, hi]); return pts; } const per = Math.floor(m / 4), extra = m - 4 * per;
    for (let s = 0; s < 4; s++) { const k = per + (s < extra ? 1 : 0); for (let i = 1; i <= k; i++) { const t = lo + (hi - lo) * i / (k + 1); pts.push(s === 0 ? [t, lo] : s === 1 ? [t, hi] : s === 2 ? [lo, t] : [hi, t]); } } return pts; };
  R.colPositions = colPositions;
  const table = e =>`<table class="bars"><tr><th>Rep.</th><th>Désignation</th><th>Ø</th><th>Nb</th><th>Long. unit. (m)</th><th>Long. totale (m)</th><th>Poids (kg)</th></tr>${e.bars.map(b => `<tr><td>${b.mark}</td><td>${esc(b.desc)}</td><td>HA${b.d}</td><td>${b.n}</td><td>${f1(b.len)}</td><td>${f1(b.n * b.len)}</td><td>${f1(b.kg)}</td></tr>`).join('')}<tr class="tot"><td colspan="6">Total</td><td>${f1(e.kg)}</td></tr></table>`;

  // ---------- beam: longitudinal section + two cross sections ----------
  R.beamSVG = (e) => { const W = 940, s = (W - 140) / (e.L + 0.8), ox = 70, X = x => ox + (x + 0.4) * s, yT = 80, hh = e.h * s, colH = 0.6 * s, H = yT + hh + colH + 40, c = C * s, out = [];
    [[0, e.aA], [e.L, e.aB]].forEach(([x, a]) => { out.push(Rc(X(x - a / 2), yT, a * s, hh + colH, GREY)); });
    out.push(Rc(X(-e.aA / 2), yT, (e.L + (e.aA + e.aB) / 2) * s, hh, '#fff'));
    const x0 = X(-e.aA / 2 + C), x1 = X(e.L + e.aB / 2 - C), leg = Math.min(0.2 * s, hh * 0.35), yB = yT + hh - c - e.bot.d / 2000 * s, yTop = yT + c + MONT / 2000 * s;
    // stirrups
    const face = e.aA / 2; for (let i = 0; i < e.nCad; i++) { const x = X(face + (e.st / 2 + i * e.st) / 100); out.push(L(x, yT + c, x, yT + hh - c, BLUE, 1)); }
    out.push(Pth([[x0, yB - leg], [x0, yB], [x1, yB], [x1, yB - leg]], RED, Math.max(2, e.bot.d / 1000 * s)));
    out.push(Pth([[x0, yTop + leg], [x0, yTop], [x1, yTop], [x1, yTop + leg]], RED, Math.max(1.6, MONT / 1000 * s)));
    const yC = yTop + 0.03 * s + MONT / 1000 * s, capW = d => Math.max(1.8, d / 1000 * s);
    if (e.chapA) out.push(Pth([[x0, yC + leg * 0.8], [x0, yC], [X(e.capA), yC]], '#8e44ad', capW(e.chapA.d)));
    if (e.chapB) out.push(Pth([[x1, yC + leg * 0.8], [x1, yC], [X(e.L - e.capB), yC]], '#8e44ad', capW(e.chapB.d)));
    const yBot = yT + hh + 18, yUp = yT - 8, lead = (x, y1, y2) => L(x, y1, x, y2, MUTE, 0.7, 'stroke-dasharray="2 2"');
    out.push(lead(X(e.L / 2), yBot - 8, yB), mark(X(e.L / 2), yBot, '1'), lead(X(e.L / 2), yUp + 8, yTop), mark(X(e.L / 2), yUp, '2'));
    if (e.chapA) out.push(lead(X(0.12 * e.L), yUp + 8, yC), mark(X(0.12 * e.L), yUp, e.mk.A));
    if (e.chapB) out.push(lead(X(0.88 * e.L), yUp + 8, yC), mark(X(0.88 * e.L), yUp, e.mk.B));
    const xc = X(face + (e.st / 2 + 3 * e.st) / 100); out.push(lead(xc, yBot - 8, yT + hh - c), mark(xc, yBot, e.mk.cad));
    out.push(dimH(X(0), X(e.L), yT - 22, 'L = ' + f1(e.L) + ' m entre axes'), dimV(X(-e.aA / 2) - 12, yT, yT + hh, Math.round(e.h * 100) + ' cm'));
    out.push(T(ox, 22, `${e.id} — ${e.from} à ${e.to} — section ${Math.round(e.b * 100)} × ${Math.round(e.h * 100)} cm`, 'start', INK, 14, 'font-weight="700"'), T(ox, 38, (e.nSpans > 1 ? `Poutre continue de ${e.nSpans} travées (travée ${e.pos}), méthode ${e.method === 'caquot' ? 'de Caquot' : 'forfaitaire'} — ` : 'Travée isolée — ') + `M appui ${e.from} = ${f1(e.MA)}, M travée = ${f1(e.Mt)}, M appui ${e.to} = ${f1(e.MB)} kN.m`, 'start', MUTE, 11));
    out.push(T(ox, H - 10, 'Coupe longitudinale (échelle indicative) — poteaux en gris, cadres en bleu, chapeaux en violet', 'start', MUTE, 10));
    return svg(W, H, out.join('')); };
  R.beamSectionSVG = (e) => { const s = 300 / Math.max(e.b, e.h) * 0.8, W = 640, H = e.h * s + 90, c = C * s, bw = e.b * s, bh = e.h * s, d = e.bot.d / 1000 * s, dc = ST / 1000 * s, out = [];
    [[40, 'Coupe A-A (milieu de travée)', false], [340, 'Coupe B-B (sur appui)', true]].forEach(([ox, title, support]) => { const oy = 40;
      out.push(T(ox + bw / 2, 22, title, 'middle', INK, 12, 'font-weight="700"'), Rc(ox, oy, bw, bh, '#fff'), Rc(ox + c, oy + c, bw - 2 * c, bh - 2 * c, 'none', BLUE, Math.max(1.2, dc)));
      const lo = ox + c + dc + d / 2, hi = ox + bw - c - dc - d / 2; spread(e.bot.n, lo, hi).forEach(x => out.push(Ci(x, oy + bh - c - dc - d / 2, d / 2)));
      const md = MONT / 1000 * s, top = [lo + (md - d) / 2, hi - (md - d) / 2]; top.forEach(x => out.push(Ci(x, oy + c + dc + md / 2, md / 2)));
      const ch = e.chapA && e.chapB ? (e.chapA.n * e.chapA.d * e.chapA.d >= e.chapB.n * e.chapB.d * e.chapB.d ? e.chapA : e.chapB) : e.chapA || e.chapB; if (support && ch) { const cd = ch.d / 1000 * s, ys = oy + c + dc + md + cd * 0.9; spread(ch.n, lo + 4, hi - 4).forEach(x => out.push(Ci(x, ys, cd / 2, '#8e44ad'))); }
      out.push(dimH(ox, ox + bw, oy + bh + 22, Math.round(e.b * 100) + ' cm'), dimV(ox - 10, oy, oy + bh, Math.round(e.h * 100))); });
    return svg(W, H, out.join('')); };

  // ---------- column: elevation + cross section ----------
  R.colSVG = (e, f) => { const W = 640, Hm = e.H + f.h + 0.3, s = 400 / Hm, H = Hm * s + 90, cx = 150, base = 40 + e.H * s, c = C * s, a = e.a * s, d = e.d / 1000 * s, out = [];
    out.push(Rc(cx - f.side * s / 2, base, f.side * s, f.h * s, GREY), Rc(cx - f.side * s / 2, base + f.h * s, f.side * s, 0.05 * s, '#f6f6f6', INK, 1, 'stroke-dasharray="3 2"'), Rc(cx - a / 2, 40, a, e.H * s, '#fff'));
    for (let i = 0; i < e.nCad; i++) { const y = base - 0.05 * s - i * e.st / 100 * s; if (y > 40 + c) out.push(L(cx - a / 2 + c, y, cx + a / 2 - c, y, BLUE, 1)); }
    const xl = cx - a / 2 + c + 2, xr = cx + a / 2 - c - 2, yTop = 40 + c, yFoot = base + (f.h - CF) * s, ret = 15 * e.d / 1000 * s, w = Math.max(2, d);
    out.push(Pth([[xl + ret, yFoot], [xl, yFoot], [xl, yTop]], RED, w), Pth([[xr - ret, yFoot], [xr, yFoot], [xr, yTop]], RED, w));
    out.push(Pth([[cx - f.side * s / 2 + CF * s, base + (f.h - CF) * s - 3], [cx + f.side * s / 2 - CF * s, base + (f.h - CF) * s - 3]], RED, 1.5, 'stroke-dasharray="4 2"'));
    out.push(dimV(cx - f.side * s / 2 - 14, 40, base, f1(e.H) + ' m'), dimV(cx - f.side * s / 2 - 14, base, base + f.h * s, Math.round(f.h * 100) + ' cm'), dimH(cx - f.side * s / 2, cx + f.side * s / 2, base + f.h * s + 34, 'semelle ' + f1(f.side) + ' m'));
    out.push(T(30, 22, `${e.label} — ${Math.round(e.a * 100)} × ${Math.round(e.a * 100)} cm — ${e.n}HA${e.d}`, 'start', INK, 14, 'font-weight="700"'), mark(cx + a / 2 + 26, 40 + e.H * s / 2 - 20, '1'), mark(cx + a / 2 + 26, 40 + e.H * s / 2 + 20, '2'));
    // section
    const S = 220, ox = 380, oy = 80, k = S / e.a, cs = C * k, dd = e.d / 1000 * k, dt = ST / 1000 * k;
    out.push(T(ox + S / 2, 60, 'Coupe transversale', 'middle', INK, 12, 'font-weight="700"'), Rc(ox, oy, S, S, '#fff'), Rc(ox + cs, oy + cs, S - 2 * cs, S - 2 * cs, 'none', BLUE, Math.max(1.5, dt)));
    const lo = ox + cs + dt + dd / 2, hi = ox + S - cs - dt - dd / 2; colPositions(e.n, lo, hi).forEach(([x, y]) => out.push(Ci(x, oy + (y - ox), dd / 2)));
    out.push(dimH(ox, ox + S, oy + S + 22, Math.round(e.a * 100) + ' cm'), T(ox + S / 2, oy + S + 46, `cadres HA${ST} e=${e.st} cm`, 'middle', MUTE, 10), T(ox + S / 2, oy + S + 60, '3 cadres au moins en zone de recouvrement', 'middle', MUTE, 10));
    return svg(W, H, out.join('')); };

  // ---------- footing: plan + section ----------
  R.footSVG = (f) => { const W = 640, s = 260 / f.side, ox = 40, oy = 50, out = [], c = CF * s, d = f.d / 1000 * s;
    out.push(T(ox, 24, `${f.label} (sous ${f.col}) — ${f1(f.side)} × ${f1(f.side)} m, h = ${Math.round(f.h * 100)} cm`, 'start', INK, 14, 'font-weight="700"'), Rc(ox, oy, f.side * s, f.side * s, '#fff'));
    const lo = c + d / 2, hi = f.side * s - c - d / 2; spread(f.n, lo, hi).forEach(p => { out.push(L(ox + c, oy + p, ox + f.side * s - c, oy + p, RED, Math.max(1.6, d)), L(ox + p, oy + c, ox + p, oy + f.side * s - c, '#e67e22', Math.max(1.6, d))); });
    const cs = f.a * s; out.push(Rc(ox + f.side * s / 2 - cs / 2, oy + f.side * s / 2 - cs / 2, cs, cs, 'rgba(0,0,0,.08)', INK, 1, 'stroke-dasharray="4 3"'));
    out.push(dimH(ox, ox + f.side * s, oy + f.side * s + 22, f1(f.side) + ' m'), T(ox + f.side * s / 2, oy + f.side * s + 44, `${f.n} HA${f.d} par sens, espacement ≈ ${f1((f.side - 2 * CF) / (f.n - 1) * 100)} cm`, 'middle', MUTE, 10));
    // section on the right
    const sx = 360, ss = 200 / Math.max(f.side, f.h + 0.9), top = 90, hS = f.h * ss, wS = f.side * ss, aS = f.a * ss, colH = 0.5 * ss;
    out.push(T(sx + wS / 2, 56, 'Coupe', 'middle', INK, 12, 'font-weight="700"'), Rc(sx, top + colH, wS, hS, GREY), Rc(sx, top + colH + hS, wS, 0.05 * ss, '#f6f6f6', INK, 1, 'stroke-dasharray="3 2"'), Rc(sx + wS / 2 - aS / 2, top, aS, colH, '#fff'));
    const yb = top + colH + hS - CF * ss - f.d / 2000 * ss, lg = Math.min(f.h - 0.12, 0.25) * ss; out.push(Pth([[sx + CF * ss, yb - lg], [sx + CF * ss, yb], [sx + wS - CF * ss, yb], [sx + wS - CF * ss, yb - lg]], RED, Math.max(1.8, f.d / 1000 * ss)));
    out.push(Pth([[sx + wS / 2 - aS / 2 + 3, top], [sx + wS / 2 - aS / 2 + 3, yb - 4], [sx + wS / 2 - aS / 2 + 3 - 15 * f.d / 1000 * ss, yb - 4]], RED, 1.6), Pth([[sx + wS / 2 + aS / 2 - 3, top], [sx + wS / 2 + aS / 2 - 3, yb - 4], [sx + wS / 2 + aS / 2 - 3 + 15 * f.d / 1000 * ss, yb - 4]], RED, 1.6));
    out.push(dimV(sx - 12, top + colH, top + colH + hS, Math.round(f.h * 100) + ' cm'), T(sx + wS / 2, top + colH + hS + 0.05 * ss + 18, 'béton de propreté 5 cm', 'middle', MUTE, 10));
    return svg(W, Math.max(oy + f.side * s + 60, 330), out.join('')); };

  // ---------- slab panel ----------
  R.slabSVG = (e) => { const W = 640, s = Math.min(420 / e.w, 300 / e.h), ox = 60, oy = 50, w = e.w * s, h = e.h * s, out = [], maxLines = 40;
    out.push(T(ox, 24, `${e.id} — ${f1(e.lx)} × ${f1(e.ly)} m, épaisseur ${Math.round(e.thick * 100)} cm`, 'start', INK, 14, 'font-weight="700"'), Rc(ox, oy, w, h, '#fff', INK, 2.5));
    const dirs = [{ k: 'x', t: e.tx, a: e.ax, hor: e.shortX }, { k: 'y', t: e.ty, a: e.ay, hor: !e.shortX }];
    dirs.forEach(({ t, a, hor }, i) => { const col = i === 0 ? RED : '#e67e22', perp = hor ? e.h : e.w, nB = Math.floor(perp * 100 / t.e) + 1, step = Math.max(1, Math.ceil(nB / maxLines)), span = hor ? e.w : e.h;
      for (let j = 0; j < nB; j += step) { const o = (j * t.e / 100) * s; hor ? out.push(L(ox + 6, oy + h - o - 3, ox + w - 6, oy + h - o - 3, col, 0.9)) : out.push(L(ox + o + 3, oy + 6, ox + o + 3, oy + h - 6, col, 0.9)); }
      const cl = 0.2 * (hor ? e.w : e.h) * s, nT = Math.floor(perp * 100 / a.e) + 1, stepT = Math.max(1, Math.ceil(nT / maxLines));
      for (let j = 0; j < nT; j += stepT) { const o = (j * a.e / 100) * s; if (hor) { out.push(L(ox, oy + h - o - 6, ox + cl, oy + h - o - 6, '#8e44ad', 1.6), L(ox + w - cl, oy + h - o - 6, ox + w, oy + h - o - 6, '#8e44ad', 1.6)); } else { out.push(L(ox + o + 6, oy, ox + o + 6, oy + cl, '#8e44ad', 1.6), L(ox + o + 6, oy + h - cl, ox + o + 6, oy + h, '#8e44ad', 1.6)); } } });
    out.push(dimH(ox, ox + w, oy + h + 24, f1(e.w) + ' m'), dimV(ox - 10, oy, oy + h, f1(e.h) + ' m'));
    [`Rouge : ${e.tx.text}, lit inférieur dans le sens de la petite portée lx`, `Orange : ${e.ty.text}, lit inférieur dans le sens de la grande portée ly`, `Violet : chapeaux sur appuis (0,2 de la portée) — sens lx ${e.ax.text} ; sens ly ${e.ay.text}`].forEach((t, i) => out.push(T(ox, oy + h + 50 + 15 * i, t, 'start', MUTE, 10)));
    return svg(W, oy + h + 100, out.join('')); };

  // ---------- general plan of the structure ----------
  R.planSVG = (doc, mdl) => { const r = doc.struct.result, W = 900, xs = r.columns.map(c => c.p[0]), ys = r.columns.map(c => c.p[1]), x0 = Math.min(...xs) - 1, x1 = Math.max(...xs) + 1, y0 = Math.min(...ys) - 1, y1 = Math.max(...ys) + 1, s = Math.min((W - 80) / (x1 - x0), 560 / (y1 - y0)), H = (y1 - y0) * s + 60, out = [];
    const P = p => [40 + (p[0] - x0) * s, 30 + (y1 - p[1]) * s];
    doc.items.filter(i => i.t === 'wall' && A.shown(i)).forEach(w => { const a = P(w.a), b = P(w.b); out.push(L(a[0], a[1], b[0], b[1], '#ccc', Math.max(2, w.th * s))); });
    r.slab && r.slab.panels.forEach(d => { const a = P([d.x0, d.y1]), b = P([d.x1, d.y0]); out.push(Rc(a[0], a[1], b[0] - a[0], b[1] - a[1], 'rgba(46,160,67,.06)', 'none'), T((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, `${d.id} e=${Math.round(r.slab.h * 100)}`, 'middle', '#1e7a34', 12)); });
    r.beams.forEach(b => { const a = P(b.p1), c = P(b.p2); out.push(L(a[0], a[1], c[0], c[1], '#555', Math.max(3, b.b * s), 'stroke-opacity=".55"'));
      const mx = (a[0] + c[0]) / 2, my = (a[1] + c[1]) / 2, vert = Math.abs(a[0] - c[0]) < 1; out.push(T(mx, vert ? my : my - 8, `${b.id} ${Math.round(b.b * 100)}×${Math.round(b.h * 100)}`, 'middle', INK, 10, vert ? `transform="rotate(-90 ${mx.toFixed(1)} ${my.toFixed(1)}) translate(0 -8)"` : '')); });
    r.columns.forEach(c => { const q = P(c.p), a = c.a * s, f = c.footing.side * s; out.push(Rc(q[0] - f / 2, q[1] - f / 2, f, f, 'none', '#e67e22', 1, 'stroke-dasharray="5 3"'), Rc(q[0] - a / 2, q[1] - a / 2, a, a, INK, INK), T(q[0], q[1] - f / 2 - 4, `${c.label} ${Math.round(c.a * 100)}×${Math.round(c.a * 100)}`, 'middle', INK, 11, 'font-weight="700"')); });
    out.push(T(40, H - 10, 'Plan de repérage : poteaux (noir), poutres (gris), semelles (pointillés orange), dalles (vert)', 'start', MUTE, 10)); return svg(W, H, out.join('')); };

  // ---------- bill of quantities ----------
  R.summaryHTML = mdl => { const t = mdl.totals, row = (n, o, kgp) => `<tr><td>${n}</td><td>${f1(o.conc)}</td><td>${f1(o.kg)}</td><td>${o.conc > 0 ? f1(o.kg / o.conc, 0) : '—'}</td></tr>`;
    return `<table class="bars"><tr><th>Ouvrage</th><th>Béton (m³)</th><th>Acier (kg)</th><th>Ratio (kg/m³)</th></tr>${row('Semelles', t.foots)}${row('Poteaux', t.cols)}${row('Poutres', t.beams)}${row('Dalles', t.slabs)}<tr class="tot"><td>Total</td><td>${f1(t.all.conc)}</td><td>${f1(t.all.kg)}</td><td>${t.all.conc > 0 ? f1(t.all.kg / t.all.conc, 0) : '—'}</td></tr></table>` +
      `<table class="bars"><tr><th>Diamètre</th><th>Longueur (m)</th><th>Poids (kg)</th></tr>${mdl.byDiameter.map(x => `<tr><td>HA${x.d}</td><td>${f1(x.len)}</td><td>${f1(x.kg)}</td></tr>`).join('')}</table>`; };
  R.notesHTML = mdl => `<ul class="notes"><li>Enrobage 3 cm (5 cm pour les semelles, sur béton de propreté de 5 cm). Béton fc28 = ${mdl.mat.fc} MPa, acier HA FeE${mdl.mat.fe}.</li><li>Longueurs développées : crochet à 180° = 20 Ø, équerre = 12 Ø, crochets de cadres = 10 Ø.</li><li>Longueur de scellement droit ls = Ø·fe / (4 τs) avec τs = 0,6 ψs² ft28 : HA12 ≈ ${f1(R.ls(12, mdl.mat))} m, HA16 ≈ ${f1(R.ls(16, mdl.mat))} m ; recouvrements ≥ ls.</li><li>Chapeaux : 0,25 L de chaque côté des appuis ; dalle : chapeaux sur 0,2 de la portée.</li><li>Quantités indicatives (pertes et façonnage non comptés). Plans de principe issus du pré-dimensionnement : à vérifier et valider par un ingénieur structure avant exécution.</li></ul>`;

  // ---------- list of views and full printable document ----------
  R.views = mdl => [{ id: 'plan', title: 'Plan de repérage' }, ...mdl.beams.map(b => ({ id: b.id, title: `Poutre ${b.id}` })), ...mdl.cols.map(c => ({ id: c.label, title: `Poteau ${c.label}` })), ...mdl.foots.map(f => ({ id: f.label, title: `Semelle ${f.label}` })), ...mdl.slabs.map(s => ({ id: s.id, title: `Dalle ${s.id}` })), { id: 'qty', title: 'Nomenclature et métré' }];
  R.viewHTML = (doc, mdl, id) => { if (id === 'plan') return R.planSVG(doc, mdl);
    if (id === 'qty') return '<h3>Métré</h3>' + R.summaryHTML(mdl) + R.notesHTML(mdl); let e;
    if ((e = mdl.beams.find(x => x.id === id))) return R.beamSVG(e) + R.beamSectionSVG(e) + table(e);
    if ((e = mdl.cols.find(x => x.label === id))) return R.colSVG(e, mdl.foots.find(f => f.id === e.id)) + table(e);
    if ((e = mdl.foots.find(x => x.label === id))) return R.footSVG(e) + table(e);
    if ((e = mdl.slabs.find(x => x.id === id))) return R.slabSVG(e) + table(e); return ''; };
  R.document = doc => { const mdl = R.model(doc); if (!mdl) return ''; const css = 'body{font:13px/1.4 system-ui,Segoe UI,sans-serif;margin:0;color:#111}section{page-break-after:always;padding:16px 20px;max-width:1000px;margin:auto}h1{font-size:20px;color:#12365d}h2{font-size:16px;border-bottom:2px solid #12365d;color:#12365d}table.bars{border-collapse:collapse;width:100%;margin:8px 0}table.bars td,table.bars th{border:1px solid #bbb;padding:3px 6px;text-align:left}table.bars th{background:#eef2f7}tr.tot td{font-weight:700;background:#f6f6f6}.notes{color:#444}svg{display:block;margin:6px 0}@page{size:A4 landscape;margin:10mm}';
    const secs = R.views(mdl).map(v => `<section><h2>${esc(v.title)}</h2>${R.viewHTML(doc, mdl, v.id)}</section>`).join('');
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Plans de ferraillage — ${esc(doc.name)}</title><style>${css}</style></head><body><section><h1>Plans de ferraillage — ${esc(doc.name)}</h1><p>Document généré à partir du pré-dimensionnement BAEL 91 révisé 99. À vérifier et valider par un ingénieur structure avant toute exécution.</p>${R.notesHTML(mdl)}</section>${secs}</body></html>`; };
})();
