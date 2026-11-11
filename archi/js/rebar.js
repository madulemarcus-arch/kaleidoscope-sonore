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
    const out = { beams: [], nodes: [], nerv: [], rslabs: [], raft: null, cols: [], foots: [], strips: [], slabs: [], mat: m, H: r.H, hs: r.hs, ls: d => R.ls(d, m) };
    const beamModel = (b, target, nerv) => { const A_ = colBy[b.ca], B_ = colBy[b.cb], aA = A_.a, aB = B_.a, Ln = b.L - (aA + aB) / 2, bars = [], d = b.barT.d, n = b.barT.n;
      const straight = b.L + (aA + aB) / 2 - 2 * C, mont = { n: 2, d: MONT }, cad = ST, nCad = Math.max(1, Math.floor(Ln / (b.st / 100) + 1e-9)), cadLen = 2 * (b.b - 2 * C) + 2 * (b.h - 2 * C) + 2 * 10 * ST / 1000;
      const capBars = Aa => { const need = Math.max(0, Aa - 2 * area(MONT)); return need > 0.3 ? A.struct.beamBars(need, b.b) : null; }, chapA = capBars(b.AaA), chapB = capBars(b.AaB);
      // a hogging bar over an inner support runs on into the neighbouring span (only this span's share is listed); at an end support it is anchored by a hook
      const capLen = (ch, cap, end, a) => cap + a / 2 + (end === 'rive' ? -C + hook180(ch.d) : 0), mk = { };
      bars.push(bar('1', nerv ? 'Armatures principales de travée (côté dalle du radier)' : 'Armatures inférieures de travée', n, d, straight + 2 * hook180(d), 'straight-hooks'));
      bars.push(bar('2', nerv ? 'Armatures de montage (face inférieure)' : 'Armatures supérieures de montage', mont.n, mont.d, straight + 2 * hook180(mont.d), 'straight-hooks'));
      let k = 3; if (chapA) { mk.A = String(k); bars.push(bar(String(k++), 'Chapeaux sur l\'appui ' + b.from + (nerv ? ' (face inférieure)' : '') + (b.endA === 'rive' ? ' (ancrés par crochet)' : ' (se poursuivent dans la travée voisine)'), chapA.n, chapA.d, capLen(chapA, b.capA, b.endA, aA), 'chapeau')); }
      if (chapB) { mk.B = String(k); bars.push(bar(String(k++), 'Chapeaux sur l\'appui ' + b.to + (nerv ? ' (face inférieure)' : '') + (b.endB === 'rive' ? ' (ancrés par crochet)' : ' (se poursuivent dans la travée voisine)'), chapB.n, chapB.d, capLen(chapB, b.capB, b.endB, aB), 'chapeau')); }
      mk.cad = String(k); bars.push(bar(String(k), 'Cadres HA' + cad + ' e=' + b.st + ' cm', nCad, cad, cadLen, 'stirrup'));
      target.push({ nerv, id: b.id, from: b.from, to: b.to, L: b.L, Ln, b: b.b, h: b.h, aA, aB, bot: { n, d }, mont, chapA, chapB, capA: b.capA, capB: b.capB, endA: b.endA, endB: b.endB, MA: b.MA, MB: b.MB, Mt: b.Mt, M0: b.M0, method: b.method, chain: b.chain, pos: b.pos, nSpans: b.nSpans, mk, st: b.st, nCad, bars, kg: bars.reduce((s, x) => s + x.kg, 0), conc: b.b * b.h * Ln }); };
    r.beams.forEach(b => beamModel(b, out.beams, false)); if (r.raft) r.raft.nerv.forEach(b => beamModel(b, out.nerv, true));
    r.columns.forEach(c => { const N = c.levels.length, ft = c.footing, g = c.levels[N - 1], d = g.bars.d, n = g.bars.n, tieSt = lv => Math.max(5, Math.floor(Math.min(15 * lv.bars.d / 10, 40, lv.a * 100 + 10) / 5) * 5), st = tieSt(g), nCad = Math.floor(r.H / (st / 100)) + 2, fh = c.strips || c.raft ? c.fh : ft.h;
      // one segment per level, ground floor first (marks 1 and 2, drawn); upper segments extend by their lap ls above the floor, the last one stops 3 cm under the top
      const order = [N - 1, ...Array.from({ length: N - 1 }, (_, i) => N - 2 - i)], bars = [], lvInfo = []; let mk = 1, lap = 0;
      order.forEach(i => { const lv = c.levels[i], k = i + 1, dd = lv.bars.d, ls = k > 1 ? R.ls(dd, m) : 0, stk = tieSt(lv), ncad = Math.floor(r.H / (stk / 100)) + (k === N ? 2 : 0), len = r.H + (k > 1 ? ls : -C) + (k === N ? (fh - CF) + hook90(dd) : 0), cadLen = 4 * (lv.a - 2 * C) + 2 * 10 * ST / 1000;
        if (k === N) lap = ls; const tag = N > 1 ? 'Niveau ' + lv.name + ' : ' : '';
        bars.push(bar(String(mk++), tag + 'Armatures longitudinales ' + lv.bars.text.replace(/^\d+/, '') + (ls ? ' (attentes de ' + A.fmt(ls) + ' m au niveau supérieur)' : ''), lv.bars.n, dd, len, 'column')); bars.push(bar(String(mk++), tag + 'Cadres HA' + ST + ' e=' + stk + ' cm (section ' + Math.round(lv.a * 100) + ' × ' + Math.round(lv.a * 100) + ' cm)', ncad, ST, cadLen, 'stirrup'));
        lvInfo.push({ name: lv.name, a: lv.a, n: lv.bars.n, d: dd, st: stk }); });
      out.cols.push({ id: c.id, label: c.label, a: c.a, H: r.H, n, d, st, nCad, bars, kg: bars.reduce((s, x) => s + x.kg, 0), conc: c.levels.reduce((s, lv) => s + lv.a * lv.a * r.H, 0), lap, levels: lvInfo, strips: c.strips || null, raft: !!c.raft, fh: c.fh, fw: c.fw });
      if (c.node && (c.node.rive.length || c.node.pairs.length)) out.nodes.push({ id: 'ND-' + c.label, label: c.label, node: c.node, levels: c.levels, a: g.a, aTop: c.levels[0].a, st, beams: (c.node.rive.length ? c.node.rive.map(n => out.beams.find(x => x.id === n.beam)) : c.node.pairs[0].beams.map(id => out.beams.find(x => x.id === id))).filter(Boolean) });
      if (c.strips || c.raft) return;
      const fb = ft.bars, fbar = bar('1', 'Aciers de semelle, sens x et sens y (' + fb.n + ' HA' + fb.d + ' par sens)', 2 * fb.n, fb.d, ft.side - 2 * CF + 2 * hook90(fb.d), 'footing');
      out.foots.push({ id: c.id, label: c.label.replace('P', 'S'), col: c.label, side: ft.side, h: ft.h, a: c.a, n: fb.n, d: fb.d, bars: [fbar], kg: fbar.kg, conc: ft.side * ft.side * ft.h, sigma: ft.sigma, Nu: c.Nu }); });
    (r.strips || []).forEach(st => { const tr = st.barTr, bb = st.barBot, tb = st.barTop, nTr = Math.floor((st.L - 0.10) / (tr.e / 100) + 1e-9) + 1,
        bars = [bar('1', 'Armatures transversales inférieures HA' + tr.d + ' e=' + tr.e + ' cm', nTr, tr.d, st.B - 2 * CF + 2 * hook90(tr.d), 'strip-tr'), bar('2', 'Armatures longitudinales inférieures (sous les poteaux), ' + bb.text, bb.n, bb.d, st.L - 2 * CF + 2 * hook90(bb.d), 'strip-long'), bar('3', 'Armatures longitudinales supérieures (entre les poteaux), ' + tb.text, tb.n, tb.d, st.L - 2 * CF + 2 * hook90(tb.d), 'strip-long')];
      out.strips.push({ id: st.id, cols: st.cols.map(c => ({ label: c.label, x: c.x, a: c.a })), B: st.B, L: st.L, h: st.h, d: st.d, x0: st.x0, x1: st.x1, barTr: tr, barBot: bb, barTop: tb, sigma: st.sigma, bars, kg: bars.reduce((s, x) => s + x.kg, 0), conc: st.B * st.L * st.h }); });
    const slabModel = (s, thick, raft, target) => { const w = s.x1 - s.x0, h = s.y1 - s.y0, shortX = w <= h, spanX = shortX ? s.lx : s.ly, spanY = shortX ? s.ly : s.lx, cnt = (perp, e) => Math.floor(perp * 100 / e + 1e-9) + 1, bars = [];
      const tx = s.barTx, ty = s.barTy, ax = s.barAx, ay = s.barAy;   // x = direction of the short span lx
      const dirs = [['x', tx, ax, s.lx, s.ly], ['y', ty, ay, s.ly, s.lx]];
      dirs.forEach(([k, t, a, span, perp], i) => { bars.push(bar(String(2 * i + 1), (raft ? 'Armatures de travée (face supérieure) dans le sens ' : 'Armatures inférieures dans le sens ') + (k === 'x' ? 'de la petite portée lx' : 'de la grande portée ly') + ' : HA' + t.d + ' e=' + t.e, cnt(perp, t.e), t.d, span, 'slab-bottom'));
        bars.push(bar(String(2 * i + 2), (raft ? 'Chapeaux sur nervures (face inférieure), sens ' : 'Chapeaux sur appuis, sens ') + (k === 'x' ? 'lx' : 'ly') + ' : HA' + a.d + ' e=' + a.e, 2 * cnt(perp, a.e), a.d, 0.2 * span + 0.15, 'slab-top')); });
      target.push({ raft, id: s.id, w, h, shortX, lx: s.lx, ly: s.ly, thick, x0: s.x0, y0: s.y0, x1: s.x1, y1: s.y1, bars, kg: bars.reduce((q, x) => q + x.kg, 0), conc: w * h * thick, tx, ty, ax, ay }); };
    if (r.slab) r.slab.panels.forEach(s => slabModel(s, r.slab.h, false, out.slabs)); if (r.raft) r.raft.panels.forEach(s => slabModel(s, r.raft.e, true, out.rslabs));
    if (r.raft) { const rf = r.raft, rb = rf.dbord.bar, perim = 2 * (rf.Lx + rf.Ly), nR = Math.floor(perim / (rb.e / 100)) + 1, bars = [bar('1', 'Armatures de console de débord (face supérieure) : HA' + rb.d + ' e=' + rb.e + ' cm, perpendiculaires au bord', nR, rb.d, rf.rim + 0.5 + hook90(rb.d), 'rim')];
      out.raft = { id: 'RAD', Lx: rf.Lx, Ly: rf.Ly, S: rf.S, e: rf.e, rim: rf.rim, x0: rf.x0, x1: rf.x1, y0: rf.y0, y1: rf.y1, sigma: rf.sigma, qu: rf.qu, bars, kg: bars[0].kg, conc: rf.conc, sNu: rf.sNu }; }
    const sum = k => (arr) => arr.reduce((q, x) => q + x[k], 0);
    out.totals = { beams: { kg: sum('kg')(out.beams), conc: sum('conc')(out.beams) }, cols: { kg: sum('kg')(out.cols), conc: sum('conc')(out.cols) }, foots: { kg: sum('kg')(out.foots), conc: sum('conc')(out.foots) }, strips: { kg: sum('kg')(out.strips), conc: sum('conc')(out.strips) }, raft: out.raft ? { kg: out.raft.kg + sum('kg')(out.nerv) + sum('kg')(out.rslabs), conc: out.raft.conc } : { kg: 0, conc: 0 }, slabs: { kg: sum('kg')(out.slabs), conc: sum('conc')(out.slabs) } };
    out.totals.all = { kg: Object.values(out.totals).reduce((q, x) => q + x.kg, 0), conc: Object.values(out.totals).reduce((q, x) => q + x.conc, 0) };
    // per-diameter steel summary
    const byD = {}; [...out.beams, ...out.cols, ...out.foots, ...out.strips, ...out.slabs, ...out.nerv, ...out.rslabs, ...(out.raft ? [out.raft] : [])].forEach(e => e.bars.forEach(b => { byD[b.d] = (byD[b.d] || 0) + b.n * b.len; })); out.byDiameter = Object.keys(byD).map(Number).sort((x, y) => x - y).map(d => ({ d, len: byD[d], kg: byD[d] * kgm(d) }));
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
    out.push(T(ox, H - 10, (e.nerv ? 'Nervure de radier dessinée retournée (côté dalle en haut, face de pose en bas) — ' : 'Coupe longitudinale (échelle indicative) — ') + 'poteaux en gris, cadres en bleu, chapeaux en violet', 'start', MUTE, 10));
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

  // ---------- strip footing: plan, longitudinal section, cross section ----------
  R.stripSVG = e => { const W = 940, s = (W - 140) / e.L, sy = Math.max(s, 48 / e.B), sv = Math.max(s, 90 / e.h), ox = 70, X = x => ox + (x - e.x0) * s, out = [];
    const oy = 70, hp = e.B * sy, c = CF * sy; out.push(T(ox, 22, `${e.id} — sous ${e.cols.map(q => q.label).join(', ')} — ${f1(e.B)} × ${f1(e.L)} m, h = ${Math.round(e.h * 100)} cm`, 'start', INK, 14, 'font-weight="700"'), T(ox, 40, 'Plan (échelle transversale exagérée si besoin)', 'start', MUTE, 10));
    out.push(Rc(X(e.x0), oy, e.L * s, hp, '#fff', INK, 2));
    const tr = e.barTr, nT = Math.floor((e.L - 0.10) / (tr.e / 100) + 1e-9) + 1, stp = Math.max(1, Math.ceil(nT / 70)); for (let j = 0; j < nT; j += stp) { const x = X(e.x0 + CF + j * tr.e / 100); out.push(L(x, oy + c, x, oy + hp - c, '#e67e22', 0.8)); }
    spread(e.barBot.n, oy + c + 3, oy + hp - c - 3).forEach(y => out.push(L(X(e.x0 + CF), y, X(e.x1 - CF), y, RED, 1.4)));
    e.cols.forEach(q => out.push(Rc(X(q.x) - q.a * s / 2, oy + hp / 2 - q.a * sy / 2, q.a * s, q.a * sy, 'rgba(0,0,0,.18)', INK, 1), T(X(q.x), oy - 8, q.label, 'middle', INK, 11, 'font-weight="700"')));
    out.push(dimH(X(e.x0), X(e.x1), oy + hp + 22, f1(e.L) + ' m'), dimV(ox - 10, oy, oy + hp, f1(e.B) + ' m'));
    // longitudinal section
    const hh = e.h * sv, stub = Math.min(0.5 * sv, 70), ly = oy + hp + 62 + stub, leg = Math.min(0.2 * sv, hh * 0.35); out.push(T(ox, ly - stub - 14, 'Coupe longitudinale (échelle verticale exagérée si besoin) — aciers inférieurs en rouge, supérieurs en violet', 'start', MUTE, 10), Rc(X(e.x0), ly, e.L * s, hh, '#e9e9e9'), Rc(X(e.x0), ly + hh, e.L * s, 0.05 * sv, '#f6f6f6', INK, 1, 'stroke-dasharray="3 2"'));
    e.cols.forEach(q => { out.push(Rc(X(q.x) - q.a * s / 2, ly - stub, q.a * s, stub, '#fff'), L(X(q.x) - q.a * s / 2 + 3, ly - stub + 4, X(q.x) - q.a * s / 2 + 3, ly + hh - CF * sv, RED, 1), L(X(q.x) + q.a * s / 2 - 3, ly - stub + 4, X(q.x) + q.a * s / 2 - 3, ly + hh - CF * sv, RED, 1)); });
    const yb = ly + hh - CF * sv - e.barBot.d / 2000 * sv, yt = ly + CF * sv + e.barTop.d / 2000 * sv; out.push(Pth([[X(e.x0 + CF), yb - leg], [X(e.x0 + CF), yb], [X(e.x1 - CF), yb], [X(e.x1 - CF), yb - leg]], RED, Math.max(2, e.barBot.d / 1000 * sv)), Pth([[X(e.x0 + CF), yt + leg], [X(e.x0 + CF), yt], [X(e.x1 - CF), yt], [X(e.x1 - CF), yt + leg]], '#8e44ad', Math.max(2, e.barTop.d / 1000 * sv)));
    out.push(mark(X(e.x0 + e.L * 0.25), yb + 20, '2'), mark(X(e.x0 + e.L * 0.25), yt - 12, '3'), dimV(ox - 10, ly, ly + hh, Math.round(e.h * 100) + ' cm'));
    // cross section
    const cy = ly + hh + 70, sc = Math.min(260 / e.B, 200 / e.h), bw = e.B * sc, bh = e.h * sc, cx = ox + 120, cs = CF * sc; out.push(T(cx + bw / 2, cy - 16, 'Coupe transversale', 'middle', INK, 12, 'font-weight="700"'), Rc(cx, cy + 0.5 * sc, bw, bh, '#e9e9e9'), Rc(cx + bw / 2 - 0.125 * sc, cy, 0.25 * sc, 0.5 * sc, '#fff'));
    const dTr = e.barTr.d / 1000 * sc, dB = e.barBot.d / 1000 * sc, dT = e.barTop.d / 1000 * sc, yTr = cy + 0.5 * sc + bh - cs - dTr / 2; out.push(L(cx + cs, yTr, cx + bw - cs, yTr, '#e67e22', Math.max(2, dTr)));
    spread(e.barBot.n, cx + cs + dB / 2 + 2, cx + bw - cs - dB / 2 - 2).forEach(x => out.push(Ci(x, yTr - dTr / 2 - dB / 2, dB / 2))); spread(e.barTop.n, cx + cs + dT / 2 + 2, cx + bw - cs - dT / 2 - 2).forEach(x => out.push(Ci(x, cy + 0.5 * sc + cs + dT / 2, dT / 2, '#8e44ad')));
    out.push(mark(cx + bw + 22, yTr, '1'), dimH(cx, cx + bw, cy + 0.5 * sc + bh + 26, f1(e.B) + ' m'), dimV(cx - 10, cy + 0.5 * sc, cy + 0.5 * sc + bh, Math.round(e.h * 100) + ' cm'), T(cx + bw + 50, cy + 0.5 * sc + bh / 2, 'béton de propreté 5 cm', 'start', MUTE, 10));
    return svg(W, cy + 0.5 * sc + bh + 50, out.join('')); };

  // ---------- slab panel ----------
  R.slabSVG = (e) => { const W = 640, s = Math.min(420 / e.w, 300 / e.h), ox = 60, oy = 50, w = e.w * s, h = e.h * s, out = [], maxLines = 40;
    out.push(T(ox, 24, `${e.id} — ${f1(e.lx)} × ${f1(e.ly)} m, épaisseur ${Math.round(e.thick * 100)} cm`, 'start', INK, 14, 'font-weight="700"'), Rc(ox, oy, w, h, '#fff', INK, 2.5));
    const dirs = [{ k: 'x', t: e.tx, a: e.ax, hor: e.shortX }, { k: 'y', t: e.ty, a: e.ay, hor: !e.shortX }];
    dirs.forEach(({ t, a, hor }, i) => { const col = i === 0 ? RED : '#e67e22', perp = hor ? e.h : e.w, nB = Math.floor(perp * 100 / t.e) + 1, step = Math.max(1, Math.ceil(nB / maxLines)), span = hor ? e.w : e.h;
      for (let j = 0; j < nB; j += step) { const o = (j * t.e / 100) * s; hor ? out.push(L(ox + 6, oy + h - o - 3, ox + w - 6, oy + h - o - 3, col, 0.9)) : out.push(L(ox + o + 3, oy + 6, ox + o + 3, oy + h - 6, col, 0.9)); }
      const cl = 0.2 * (hor ? e.w : e.h) * s, nT = Math.floor(perp * 100 / a.e) + 1, stepT = Math.max(1, Math.ceil(nT / maxLines));
      for (let j = 0; j < nT; j += stepT) { const o = (j * a.e / 100) * s; if (hor) { out.push(L(ox, oy + h - o - 6, ox + cl, oy + h - o - 6, '#8e44ad', 1.6), L(ox + w - cl, oy + h - o - 6, ox + w, oy + h - o - 6, '#8e44ad', 1.6)); } else { out.push(L(ox + o + 6, oy, ox + o + 6, oy + cl, '#8e44ad', 1.6), L(ox + o + 6, oy + h - cl, ox + o + 6, oy + h, '#8e44ad', 1.6)); } } });
    out.push(dimH(ox, ox + w, oy + h + 24, f1(e.w) + ' m'), dimV(ox - 10, oy, oy + h, f1(e.h) + ' m'));
    [`Rouge : ${e.tx.text}, ${e.raft ? 'face supérieure (travée)' : 'lit inférieur'} dans le sens de la petite portée lx`, `Orange : ${e.ty.text}, ${e.raft ? 'face supérieure (travée)' : 'lit inférieur'} dans le sens de la grande portée ly`, `Violet : chapeaux sur ${e.raft ? 'nervures, face inférieure' : 'appuis'} (0,2 de la portée) — sens lx ${e.ax.text} ; sens ly ${e.ay.text}`].forEach((t, i) => out.push(T(ox, oy + h + 50 + 15 * i, t, 'start', MUTE, 10)));
    return svg(W, oy + h + 100, out.join('')); };

  // ---------- raft: plan with ribs, panels, columns ----------
  R.raftSVG = (e, mdl) => { const doc = A.doc, r = doc.struct.result, rf = r.raft, W = 940, s = Math.min((W - 140) / rf.Lx, 520 / rf.Ly), ox = 70, oy = 70, P = p => [ox + (p[0] - rf.x0) * s, oy + (rf.y1 - p[1]) * s], out = [];
    out.push(T(ox, 22, `Radier nervuré — ${f1(rf.Lx)} × ${f1(rf.Ly)} m, dalle de ${Math.round(rf.e * 100)} cm, débord ${f1(rf.rim)} m`, 'start', INK, 14, 'font-weight="700"'), T(ox, 40, `Pression nette ELU qu = ${f1(rf.qu)} kN/m² ; pression du sol de service σ = ${f1(rf.sigma)} MPa (admissible ${f1(r.sigSol)} MPa)`, 'start', MUTE, 11));
    out.push(Rc(ox, oy, rf.Lx * s, rf.Ly * s, '#fff', INK, 2.5));
    rf.panels.forEach(d => { const a = P([d.x0, d.y1]), b = P([d.x1, d.y0]); out.push(Rc(a[0], a[1], b[0] - a[0], b[1] - a[1], 'rgba(46,160,67,.08)', '#7bbf8a', 1), T((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, `${d.id} e=${Math.round(rf.e * 100)}`, 'middle', '#1e7a34', 12), T((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 16, `${d.barTx.text} / ${d.barTy.text}`, 'middle', MUTE, 10)); });
    rf.nerv.forEach(n => { const a = P(n.p1), c = P(n.p2), vert = Math.abs(a[0] - c[0]) < 1, mx = (a[0] + c[0]) / 2, my = (a[1] + c[1]) / 2; out.push(L(a[0], a[1], c[0], c[1], '#555', Math.max(4, n.b * s), 'stroke-opacity=".6"'), T(mx, vert ? my : my - 8, `${n.id} ${Math.round(n.b * 100)}×${Math.round(n.h * 100)}`, 'middle', INK, 10, vert ? `transform="rotate(-90 ${mx.toFixed(1)} ${my.toFixed(1)}) translate(0 -8)"` : '')); });
    r.columns.forEach(c => { const q = P(c.p), a = Math.max(8, c.a * s); out.push(Rc(q[0] - a / 2, q[1] - a / 2, a, a, INK, INK), T(q[0], q[1] - a / 2 - 4, c.label, 'middle', INK, 11, 'font-weight="700"')); });
    out.push(dimH(ox, ox + rf.Lx * s, oy + rf.Ly * s + 24, f1(rf.Lx) + ' m'), dimV(ox - 10, oy, oy + rf.Ly * s, f1(rf.Ly) + ' m'));
    out.push(T(ox, oy + rf.Ly * s + 52, `Console de débord : ${rf.dbord.bar.text} (face supérieure), M = ${f1(rf.dbord.M)} kN.m/m. Nervures dessinées retournées dans les vues NV, dalle : voir les panneaux RP.`, 'start', MUTE, 10));
    return svg(W, oy + rf.Ly * s + 70, out.join('')); };

  // ---------- general plan of the structure ----------
  R.planSVG = (doc, mdl) => { const r = doc.struct.result, W = 900, xs = r.columns.map(c => c.p[0]), ys = r.columns.map(c => c.p[1]), x0 = Math.min(...xs) - 1, x1 = Math.max(...xs) + 1, y0 = Math.min(...ys) - 1, y1 = Math.max(...ys) + 1, s = Math.min((W - 80) / (x1 - x0), 560 / (y1 - y0)), H = (y1 - y0) * s + 60, out = [];
    const P = p => [40 + (p[0] - x0) * s, 30 + (y1 - p[1]) * s];
    doc.items.filter(i => i.t === 'wall' && A.shown(i)).forEach(w => { const a = P(w.a), b = P(w.b); out.push(L(a[0], a[1], b[0], b[1], '#ccc', Math.max(2, w.th * s))); });
    r.slab && r.slab.panels.forEach(d => { const a = P([d.x0, d.y1]), b = P([d.x1, d.y0]); out.push(Rc(a[0], a[1], b[0] - a[0], b[1] - a[1], 'rgba(46,160,67,.06)', 'none'), T((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, `${d.id} e=${Math.round(r.slab.h * 100)}`, 'middle', '#1e7a34', 12)); });
    r.beams.forEach(b => { const a = P(b.p1), c = P(b.p2); out.push(L(a[0], a[1], c[0], c[1], '#555', Math.max(3, b.b * s), 'stroke-opacity=".55"'));
      const mx = (a[0] + c[0]) / 2, my = (a[1] + c[1]) / 2, vert = Math.abs(a[0] - c[0]) < 1; out.push(T(mx, vert ? my : my - 8, `${b.id} ${Math.round(b.b * 100)}×${Math.round(b.h * 100)}`, 'middle', INK, 10, vert ? `transform="rotate(-90 ${mx.toFixed(1)} ${my.toFixed(1)}) translate(0 -8)"` : '')); });
    r.columns.forEach(c => { const q = P(c.p), a = c.a * s, f = c.footing.side * s; out.push((c.strips || c.raft) ? '' : Rc(q[0] - f / 2, q[1] - f / 2, f, f, 'none', '#e67e22', 1, 'stroke-dasharray="5 3"'), Rc(q[0] - a / 2, q[1] - a / 2, a, a, INK, INK), T(q[0], q[1] - f / 2 - 4, `${c.label} ${Math.round(c.a * 100)}×${Math.round(c.a * 100)}`, 'middle', INK, 11, 'font-weight="700"')); });
    if (r.raft) { const a = P([r.raft.x0, r.raft.y1]), b = P([r.raft.x1, r.raft.y0]); out.push(Rc(a[0], a[1], b[0] - a[0], b[1] - a[1], 'none', '#e67e22', 1.5, 'stroke-dasharray="6 4"')); }
    out.push(T(40, H - 10, 'Plan de repérage : poteaux (noir), poutres (gris), semelles (pointillés orange), dalles (vert)', 'start', MUTE, 10)); return svg(W, H, out.join('')); };

  // ---------- bill of quantities ----------
  R.summaryHTML = mdl => { const t = mdl.totals, row = (n, o, kgp) => `<tr><td>${n}</td><td>${f1(o.conc)}</td><td>${f1(o.kg)}</td><td>${o.conc > 0 ? f1(o.kg / o.conc, 0) : '—'}</td></tr>`;
    return `<table class="bars"><tr><th>Ouvrage</th><th>Béton (m³)</th><th>Acier (kg)</th><th>Ratio (kg/m³)</th></tr>${row('Semelles isolées', t.foots)}${t.strips.conc > 0 ? row('Semelles filantes', t.strips) : ''}${t.raft.conc > 0 ? row('Radier nervuré (dalle, nervures, débord)', t.raft) : ''}${row('Poteaux', t.cols)}${row('Poutres', t.beams)}${row('Dalles', t.slabs)}<tr class="tot"><td>Total</td><td>${f1(t.all.conc)}</td><td>${f1(t.all.kg)}</td><td>${t.all.conc > 0 ? f1(t.all.kg / t.all.conc, 0) : '—'}</td></tr></table>` +
      `<table class="bars"><tr><th>Diamètre</th><th>Longueur (m)</th><th>Poids (kg)</th></tr>${mdl.byDiameter.map(x => `<tr><td>HA${x.d}</td><td>${f1(x.len)}</td><td>${f1(x.kg)}</td></tr>`).join('')}</table>`; };
  R.notesHTML = mdl => `<ul class="notes"><li>Enrobage 3 cm (5 cm pour les semelles, sur béton de propreté de 5 cm). Béton fc28 = ${mdl.mat.fc} MPa, acier HA FeE${mdl.mat.fe}.</li><li>Longueurs développées : crochet à 180° = 20 Ø, équerre = 12 Ø, crochets de cadres = 10 Ø.</li><li>Longueur de scellement droit ls = Ø·fe / (4 τs) avec τs = 0,6 ψs² ft28 : HA12 ≈ ${f1(R.ls(12, mdl.mat))} m, HA16 ≈ ${f1(R.ls(16, mdl.mat))} m ; recouvrements ≥ ls.</li><li>Radier nervuré : lit supérieur dans les panneaux (travée) et lit inférieur sur les nervures ; console de débord en face supérieure ; nervures dessinées retournées.</li><li>Semelles filantes : aciers transversaux en lit inférieur, aciers longitudinaux inférieurs sous les poteaux et supérieurs entre les poteaux, équerres de 12 Ø aux extrémités.</li><li>Chapeaux : 0,25 L de chaque côté des appuis ; dalle : chapeaux sur 0,2 de la portée.</li><li>Quantités indicatives (pertes et façonnage non comptés). Plans de principe issus du pré-dimensionnement : à vérifier et valider par un ingénieur structure avant exécution.</li></ul>`;

  // ---------- beam-column node (edge column): anchorage of the beam bars, column bars and stirrups in the joint ----------
  R.nodeHTML = n => { if (!n.node.rive.length) { const lv = n.levels[n.levels.length - 1], al = lv.alt || { x: 0, y: 0, dMx: 0, dMy: 0 }, b = lv.bend;
      return `<table class="bars"><tr><th>Poutres continues</th><th>Sens</th><th>Déséquilibre ΔM (kN.m)</th><th>Part reprise par le poteau (kN.m)</th></tr>${n.node.pairs.map(q => `<tr><td>${q.beams.join(' – ')}</td><td>${q.axis}</td><td>${f1(q.axis === 'x' ? al.dMx : al.dMy)}</td><td>${f1(q.axis === 'x' ? al.x : al.y)}</td></tr>`).join('')}</table><ul class="notes"><li>Poteau continu : les poutres alignées se prolongent de part et d'autre ; seul le déséquilibre des moments d'encastrement sous chargement alterné (une travée chargée, la voisine à vide) est transmis au poteau, au prorata des rigidités I/L.</li><li>Barres inférieures des deux travées prolongées au moins jusqu'à l'axe du poteau ; chapeaux continus au-dessus du poteau ; cadres du poteau continus dans le nœud (au moins 3 dans la hauteur des poutres, e = ${n.st} cm).</li>${b ? `<li>Moment au pied du RDC : Mx = ${f1(lv.Mx)} kN.m, My = ${f1(lv.My)} kN.m ; flexion composée : Mu = ${f1(b.Mu)} kN.m, aciers ${f1(b.AsFlex)} cm² (${f1(b.AsCentered)} cm² en compression centrée).</li>` : ''}</ul>`; }
    const bad = n.node.levels.filter(l => !l.ok), b = n.levels[n.levels.length - 1].bend, rows = n.node.rive.map(x => `<tr><td>${x.beam} (sens ${x.axis})</td><td>HA${x.d}</td><td>${f1(x.ls * 100)} cm</td><td>${f1(x.la * 100)} cm</td><td>${f1(x.need * 100)} cm</td><td>${n.node.levels.map(l => l.name + ' : ' + Math.round(l.a * 100) + ' cm ' + (l.a - 0.03 >= x.la - 1e-9 && x.b <= l.a + 1e-9 ? '✓' : '✗')).join(' ; ')}</td></tr>`).join('');
    return `<table class="bars"><tr><th>Poutre de rive</th><th>Barres</th><th>ls (scellement droit)</th><th>la = 0,4·ls (crochet)</th><th>Poteau requis (la + 3 cm)</th><th>Largeur du poteau au nœud</th></tr>${rows}</table><ul class="notes"><li>${bad.length ? '<b>Ancrage insuffisant</b> au niveau ' + bad.map(l => l.name).join(', ') + ' : réduire le diamètre des barres, élargir le poteau ou prévoir des barres en U ; le crochet à 180° doit rester dans le poteau (enrobage 3 cm).' : 'Ancrage suffisant à tous les niveaux : crochet à 180° dans le poteau.'}</li><li>Cadres de poteau continus dans le nœud : au moins 3 cadres dans la hauteur de la poutre, espacement e = ${n.st} cm.</li>${b ? `<li>Moment transmis au poteau du RDC par les poutres de rive : Mx = ${f1(n.levels[n.levels.length - 1].Mx)} kN.m, My = ${f1(n.levels[n.levels.length - 1].My)} kN.m ; flexion composée : Mu = ${f1(b.Mu)} kN.m (e0 = ${f1(b.e0 * 100)} cm, ea = ${f1(b.ea * 100)} cm, e2 = ${f1(b.e2 * 100)} cm), aciers ${f1(b.AsFlex)} cm² (${f1(b.AsCentered)} cm² en compression centrée).</li>` : ''}</ul>`; };
  R.nodeSVG = (n, doc) => { if (!n.node.rive.length) return R.nodeInnerSVG(n);
    const bm = n.beams[0], W = 980, s = 230, cx = 210, a = n.a, hb = bm ? bm.h : 0.3, y0 = 70, colH = 1.6 * s, yb = y0 + 0.5 * s, xr = cx + a * s / 2, stub = 0.85 * s, out = [], riv = n.node.rive[0], c = C * s, d = riv.d / 1000 * s;
    out.push(T(30, 24, `Nœud ${n.label} — poteau ${Math.round(a * 100)} × ${Math.round(a * 100)} cm, poutre ${riv.beam} ${Math.round((bm ? bm.b : 0.2) * 100)} × ${Math.round(hb * 100)} cm`, 'start', INK, 14, 'font-weight="700"'));
    const ok = n.node.levels.every(l => l.ok); out.push(T(30, 44, `Ancrage des barres HA${riv.d} par crochet à 180° : longueur droite requise la = 0,4·ls = ${f1(riv.la * 100)} cm, disponible a − 3 cm = ${f1((n.aTop - 0.03) * 100)} cm (poteau du haut) — ${ok ? 'suffisant' : 'INSUFFISANT'}`, 'start', ok ? '#1e7a34' : '#c0392b', 11, 'font-weight="700"'));
    out.push(Rc(cx - a * s / 2, y0, a * s, colH, GREY), Rc(xr, yb, stub, hb * s, '#fff'));
    const xl = cx - a * s / 2 + c + 2, xrr = cx + a * s / 2 - c - 2; out.push(L(xl, y0 + 4, xl, y0 + colH - 4, RED, Math.max(1.6, n.levels[n.levels.length - 1].bars.d / 1000 * s)), L(xrr, y0 + 4, xrr, y0 + colH - 4, RED, Math.max(1.6, n.levels[n.levels.length - 1].bars.d / 1000 * s)));
    for (let i = 1; i <= 3; i++) { const y = yb + hb * s * i / 4; out.push(L(cx - a * s / 2 + c, y, cx + a * s / 2 - c, y, BLUE, 1.4)); } [yb - 0.3 * s, yb + hb * s + 0.3 * s].forEach(y => out.push(L(cx - a * s / 2 + c, y, cx + a * s / 2 - c, y, BLUE, 1)));
    // beam bars with hooks inside the column
    const xFar = cx - a * s / 2 + c + d / 2, yBot = yb + hb * s - c - d / 2, yTop = yb + c + d / 2, hk = Math.min(0.12 * s, hb * s * 0.4), wB = Math.max(2, d);
    out.push(Pth([[xr + stub, yBot], [xFar, yBot], [xFar, yBot - hk]], RED, wB), Pth([[xr + stub, yTop], [xFar + d * 1.6, yTop], [xFar + d * 1.6, yTop + hk]], '#8e44ad', Math.max(2, d)));
    out.push(L(xr, yBot + 14, xFar, yBot + 14, ok ? '#1e7a34' : '#c0392b', 1.2), L(xr, yBot + 9, xr, yBot + 19, MUTE, 1), L(xFar, yBot + 9, xFar, yBot + 19, MUTE, 1), T((xr + xFar) / 2, yBot + 32, `a − 3 cm = ${f1((a - 0.03) * 100)}`, 'middle', MUTE, 10));
    out.push(dimH(cx - a * s / 2, xr, y0 + colH + 24, Math.round(a * 100) + ' cm'), dimV(xr + stub + 14, yb, yb + hb * s, Math.round(hb * 100) + ' cm'), mark(cx, y0 + colH - 14, '1'), mark(xr + stub * 0.55, yBot - 14, '2'));
    out.push(T(xr + stub + 40, y0 + 112, 'Les barres traversent le poteau jusqu\'à la face opposée puis se retournent en crochet', 'start', MUTE, 10));
    const b = n.levels[n.levels.length - 1].bend; out.push(T(xr + stub + 40, y0 + 60, 'Barres du poteau (1) prolongées dans le nœud', 'start', MUTE, 10), T(xr + stub + 40, y0 + 78, 'Cadres du poteau (bleu) : 3 au moins dans la poutre', 'start', MUTE, 10), T(xr + stub + 40, y0 + 96, 'Barres de poutre (2) : lit inférieur rouge, supérieur violet, crochets dans le poteau', 'start', MUTE, 10));
    if (b) out.push(T(xr + stub + 40, y0 + 130, `Moment transmis au RDC : Mx = ${f1(n.levels[n.levels.length - 1].Mx)}, My = ${f1(n.levels[n.levels.length - 1].My)} kN.m`, 'start', INK, 11), T(xr + stub + 40, y0 + 148, `Flexion composée Mu = ${f1(b.Mu)} kN.m → ${f1(b.AsFlex)} cm² (centrée : ${f1(b.AsCentered)} cm²)`, 'start', INK, 11));
    return svg(W, y0 + colH + 60, out.join('')); };

  // inner (continuous) node: two beam stubs, bottom bars of both spans reaching the column axis, hogging bars running through, column stirrups through the joint
  R.nodeInnerSVG = n => { const bm = n.beams[0], W = 980, s = 200, cx = 330, a = n.a, hb = bm ? bm.h : 0.3, y0 = 70, colH = 1.6 * s, yb = y0 + 0.5 * s, xr = cx + a * s / 2, xl0 = cx - a * s / 2, stub = 0.9 * s, c = C * s, out = [], lv = n.levels[n.levels.length - 1], al = lv.alt || { x: 0, y: 0, dMx: 0, dMy: 0 }, b = lv.bend, q = n.node.pairs[0];
    out.push(T(30, 24, `Nœud ${n.label} (poteau continu) — poteau ${Math.round(a * 100)} × ${Math.round(a * 100)} cm, poutres ${q.beams.join(' et ')}`, 'start', INK, 14, 'font-weight="700"'), T(30, 44, `Chargement alterné : ΔM = ${f1(q.axis === 'x' ? al.dMx : al.dMy)} kN.m, part reprise par le poteau = ${f1(q.axis === 'x' ? al.x : al.y)} kN.m`, 'start', MUTE, 11));
    out.push(Rc(xl0, y0, a * s, colH, GREY), Rc(xr, yb, stub, hb * s, '#fff'), Rc(xl0 - stub, yb, stub, hb * s, '#fff'));
    const xl = xl0 + c + 2, xrr = xr - c - 2, dB = (bm ? bm.bot.d : 12) / 1000 * s, dM = MONT / 1000 * s; out.push(L(xl, y0 + 4, xl, y0 + colH - 4, RED, 2), L(xrr, y0 + 4, xrr, y0 + colH - 4, RED, 2));
    for (let i = 1; i <= 3; i++) { const y = yb + hb * s * i / 4; out.push(L(xl0 + c, y, xr - c, y, BLUE, 1.4)); }
    const yBot = yb + hb * s - c - dB / 2, yTop = yb + c + dM / 2; out.push(Pth([[xl0 - stub, yBot], [cx, yBot]], RED, Math.max(2, dB)), Pth([[xr + stub, yBot], [cx, yBot]], RED, Math.max(2, dB), 'stroke-dasharray="7 3"'), Pth([[xl0 - stub, yTop], [xr + stub, yTop]], '#8e44ad', Math.max(2, dM)));
    out.push(dimH(xl0, xr, y0 + colH + 24, Math.round(a * 100) + ' cm'), dimV(xr + stub + 14, yb, yb + hb * s, Math.round(hb * 100) + ' cm'), mark(cx, y0 + colH - 14, '1'), mark(xr + stub * 0.5, yBot - 14, '2'), mark(xl0 - stub * 0.5, yTop - 14, '3'));
    out.push(T(30, y0 + colH + 56, 'Repères : 1 barres du poteau · 2 barres inférieures des travées, arrêtées à l\'axe du poteau (traits pleins et tirets) · 3 chapeaux et barres de montage continus au-dessus du poteau · cadres bleus', 'start', MUTE, 10));
    if (b) out.push(T(30, y0 + colH + 74, `Flexion composée au RDC : Mu = ${f1(b.Mu)} kN.m → ${f1(b.AsFlex)} cm² (compression centrée : ${f1(b.AsCentered)} cm²)`, 'start', INK, 11));
    return svg(W, y0 + colH + 90, out.join('')); };

  // ---------- load take-down table ----------
  R.dcHTML = doc => { const r = doc.struct.result, p = r.params, rows = []; r.columns.forEach(c => c.levels.forEach(lv => rows.push(`<tr><td>${c.label}</td><td>${lv.name}</td><td>${f1(lv.Gk)} / ${f1(lv.Qk)}</td><td>${f1(lv.self)}</td><td>${f1(lv.G)}</td><td>${f1(lv.Q)}</td><td>${lv.nFloors >= 5 && lv.deg < 1 ? A.fmt(lv.deg, 3) : '1'}</td><td>${A.fmt(lv.Nu, 0)}</td><td>${A.fmt(lv.Ns, 0)}</td><td>${Math.round(lv.a * 100)} × ${Math.round(lv.a * 100)}</td><td>${lv.bars.text}</td></tr>`)));
    return `<table class="bars"><tr><th>Poteau</th><th>Niveau</th><th>Réactions des poutres G / Q (kN)</th><th>Poids propre (kN)</th><th>Σ G (kN)</th><th>Σ Q (kN)</th><th>Dégression</th><th>Nu (kN)</th><th>Ns (kN)</th><th>Section (cm)</th><th>Armatures</th></tr>${rows.join('')}</table><ul class="notes"><li>Du dernier plancher (niveau le plus haut de chaque poteau) vers les fondations : Nu = 1,35 ΣG + 1,5 ΣQ, Ns = ΣG + ΣQ au pied de chaque niveau.</li><li>Réactions des poutres issues de l'analyse des poutres continues (parts permanente et d'exploitation séparées) ; poids propre de chaque tronçon de poteau avec sa section.</li><li>Charges d'exploitation des planchers : loi de dégression NF P06-001, Q0 + (3 + n)/(2n) · (Q1 + … + Qn) pour n ≥ 5 planchers sous la toiture${p.degr === false ? ' (désactivée pour ce calcul)' : ''}.</li><li>La section d'un niveau n'est jamais inférieure à celle du niveau supérieur. Pré-dimensionnement : à vérifier par un ingénieur.</li></ul>`; };

  // ---------- list of views and full printable document ----------
  R.views = mdl => [{ id: 'plan', title: 'Plan de repérage' }, { id: 'dc', title: 'Descente de charges' }, ...mdl.beams.map(b => ({ id: b.id, title: `Poutre ${b.id}` })), ...mdl.cols.map(c => ({ id: c.label, title: `Poteau ${c.label}` })), ...mdl.nodes.map(n => ({ id: n.id, title: `Nœud ${n.label}` })), ...mdl.foots.map(f => ({ id: f.label, title: `Semelle ${f.label}` })), ...mdl.strips.map(f => ({ id: f.id, title: `Semelle filante ${f.id}` })), ...(mdl.raft ? [{ id: 'RAD', title: 'Radier nervuré' }] : []), ...mdl.nerv.map(n => ({ id: n.id, title: `Nervure ${n.id}` })), ...mdl.rslabs.map(s => ({ id: s.id, title: `Radier, panneau ${s.id}` })), ...mdl.slabs.map(s => ({ id: s.id, title: `Dalle ${s.id}` })), { id: 'qty', title: 'Nomenclature et métré' }];
  R.viewHTML = (doc, mdl, id) => { if (id === 'plan') return R.planSVG(doc, mdl);
    if (id === 'dc') return R.dcHTML(doc);
    if (/^ND-/.test(id)) { const n = mdl.nodes.find(x => x.id === id); return n ? R.nodeSVG(n, doc) + R.nodeHTML(n) : ''; }
    if (id === 'qty') return '<h3>Métré</h3>' + R.summaryHTML(mdl) + R.notesHTML(mdl); let e;
    if ((e = mdl.beams.find(x => x.id === id))) return R.beamSVG(e) + R.beamSectionSVG(e) + table(e);
    if ((e = mdl.cols.find(x => x.label === id))) return R.colSVG(e, mdl.foots.find(f => f.id === e.id) || { side: e.fw, h: e.fh, label: e.strips ? e.strips.join('+') : 'radier' }) + table(e);
    if ((e = mdl.strips.find(x => x.id === id))) return R.stripSVG(e) + table(e);
    if (id === 'RAD') return R.raftSVG(mdl.raft, mdl) + table(mdl.raft);
    if ((e = mdl.nerv.find(x => x.id === id))) return R.beamSVG(e) + R.beamSectionSVG(e) + table(e);
    if ((e = mdl.rslabs.find(x => x.id === id))) return R.slabSVG(e) + table(e);
    if ((e = mdl.foots.find(x => x.label === id))) return R.footSVG(e) + table(e);
    if ((e = mdl.slabs.find(x => x.id === id))) return R.slabSVG(e) + table(e); return ''; };
  R.document = doc => { const mdl = R.model(doc); if (!mdl) return ''; const css = 'body{font:13px/1.4 system-ui,Segoe UI,sans-serif;margin:0;color:#111}section{page-break-after:always;padding:16px 20px;max-width:1000px;margin:auto}h1{font-size:20px;color:#12365d}h2{font-size:16px;border-bottom:2px solid #12365d;color:#12365d}table.bars{border-collapse:collapse;width:100%;margin:8px 0}table.bars td,table.bars th{border:1px solid #bbb;padding:3px 6px;text-align:left}table.bars th{background:#eef2f7}tr.tot td{font-weight:700;background:#f6f6f6}.notes{color:#444}svg{display:block;margin:6px 0}@page{size:A4 landscape;margin:10mm}';
    const secs = R.views(mdl).map(v => `<section><h2>${esc(v.title)}</h2>${R.viewHTML(doc, mdl, v.id)}</section>`).join('');
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Plans de ferraillage — ${esc(doc.name)}</title><style>${css}</style></head><body><section><h1>Plans de ferraillage — ${esc(doc.name)}</h1><p>Document généré à partir du pré-dimensionnement BAEL 91 révisé 99. À vérifier et valider par un ingénieur structure avant toute exécution.</p>${R.notesHTML(mdl)}</section>${secs}</body></html>`; };
})();
