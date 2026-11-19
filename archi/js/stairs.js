// Stairs (tab "Escalier"): parametric straight, landing, quarter-turn, half-turn and winder (balanced) stairs in reinforced concrete, steel or timber.
// A stair item { t:'stair', p:[x,y], rot (deg), par:{...parameters}, lv:[levels where it starts] } is drawn in plan, stacked in 3D and quantified.
// Local frame: u along the first flight, v to its left, origin at the right-hand end of the first riser. Step s (1..M) has its tread at z = s * hr.
(function () {
  const A = window.App, $ = id => document.getElementById(id), S = A.stairs = {}, f2 = v => A.fmt(v, 2), cm = v => Math.round(v * 1000) / 10;
  S.KINDS = [['droit', 'Droit (une volée)'], ['palier', 'Droit avec palier intermédiaire'], ['quart', 'Quart tournant avec palier d\'angle'], ['demi', 'Demi-tournant avec palier'], ['quartbal', 'Quart tournant à marches balancées']];
  S.MATS = [['beton', 'Béton armé'], ['metal', 'Métal'], ['bois', 'Bois']];
  S.defaults = () => ({ kind: 'droit', mat: 'beton', H: A.doc ? A.doc.defaults.h : 2.8, h: 0.17, g: 0.28, w: 1.0, ep: 0.15, th: 0.04, nez: 0.03, n1: 0, lp: 0, k: 3, jour: 0.1, turn: 'g', lv: [0], x: 0, y: 0, rot: 0 });
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- geometry (local frame) ----------
  S.calc = P => { const n = Math.max(2, Math.round(P.H / P.h)), hr = P.H / n, M = n - 1, g = P.g, w = P.w, k = P.kind, kw = k === 'quartbal' ? Math.max(2, Math.min(5, Math.round(P.k || 3))) : 0, land = k === 'droit' || k === 'quartbal' ? 0 : 1;
    let n1 = M, n2 = 0; if (k !== 'droit') { const rest = M - kw - land, free = Math.max(0, rest); n1 = clamp(P.n1 > 0 ? Math.round(P.n1) : Math.floor(free / 2), 1, Math.max(1, free)); n2 = Math.max(0, rest - n1); }
    const lp = k === 'palier' || k === 'demi' ? Math.max(P.lp || w, w) : w, jour = Math.max(0, P.jour == null ? 0.1 : P.jour), steps = [], path = []; let idx = 0;
    const rect = (u0, u1, v0, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], add = (poly, kind) => { idx++; steps.push({ i: idx, poly, z: idx * hr, kind }); };
    for (let i = 1; i <= n1; i++) add(rect((i - 1) * g, i * g, 0, w), 'tread');
    const u0 = n1 * g; path.push([0, w / 2]);
    if (k === 'droit') { path.push([M * g, w / 2]); }
    else if (k === 'palier') { add(rect(u0, u0 + lp, 0, w), 'landing'); for (let j = 1; j <= n2; j++) add(rect(u0 + lp + (j - 1) * g, u0 + lp + j * g, 0, w), 'tread'); path.push([u0 + lp + n2 * g, w / 2]); }
    else if (k === 'quart') { add(rect(u0, u0 + w, 0, w), 'landing'); for (let j = 1; j <= n2; j++) add(rect(u0, u0 + w, w + (j - 1) * g, w + j * g), 'tread'); path.push([u0 + w / 2, w / 2], [u0 + w / 2, w + n2 * g]); }
    else if (k === 'demi') { const W2 = 2 * w + jour; add(rect(u0, u0 + lp, 0, W2), 'landing'); for (let j = 1; j <= n2; j++) add(rect(u0 - j * g, u0 - (j - 1) * g, w + jour, W2), 'tread'); path.push([u0 + lp / 2, w / 2], [u0 + lp / 2, w + jour + w / 2], [u0 - n2 * g, w + jour + w / 2]); }
    else { const px = u0, py = w, hit = a => { const d = [Math.cos(a), Math.sin(a)], t = Math.min(d[0] > 1e-9 ? w / d[0] : 1e9, d[1] < -1e-9 ? w / -d[1] : 1e9); return [px + d[0] * t, py + d[1] * t]; };
      for (let j = 1; j <= kw; j++) { const a0 = -Math.PI / 2 + Math.PI / 2 * (j - 1) / kw, a1 = -Math.PI / 2 + Math.PI / 2 * j / kw, pts = [[px, py], hit(a0)]; const ac = -Math.PI / 4; if (a0 < ac - 1e-9 && a1 > ac + 1e-9) pts.push([px + w, py - w]); pts.push(hit(a1)); add(pts, 'winder'); }
      for (let j = 1; j <= n2; j++) add(rect(u0, u0 + w, w + (j - 1) * g, w + j * g), 'tread'); path.push([u0 / 2, w / 2], [u0 + w / 2 * 1.0, w / 2], [u0 + w / 2, w + n2 * g]); }
    if (P.turn === 'd') { steps.forEach(s => { s.poly = s.poly.map(([u, v]) => [u, w - v]); }); path.forEach(p => { p[1] = w - p[1]; }); }
    const all = steps.flatMap(s => s.poly), bb = { u0: Math.min(...all.map(p => p[0])), u1: Math.max(...all.map(p => p[0])), v0: Math.min(...all.map(p => p[1])), v1: Math.max(...all.map(p => p[1])) };
    const area = poly => Math.abs(poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
    const slope = Math.atan2(hr, g), tv = P.ep / Math.cos(slope), vol = P.mat === 'beton' ? steps.reduce((s, st) => s + area(st.poly) * (st.kind === 'landing' ? P.ep : tv + hr / 2), 0) : 0;
    const flights = k === 'droit' ? [M] : [n1, n2], pail = flights.map(nf => Math.hypot(nf * g, nf * hr));
    const winG = kw ? (w / 2) * (Math.PI / 2 / kw) : 0, blondel = 2 * hr + g, msgs = [];
    if (blondel < 0.60 || blondel > 0.64) msgs.push(['warn', `Formule de Blondel : 2h + g = ${cm(blondel)} cm (60 à 64 cm attendus).`]); else msgs.push(['ok', `Formule de Blondel : 2h + g = ${cm(blondel)} cm (conforme).`]);
    if (hr < 0.13 || hr > 0.19) msgs.push(['warn', `Hauteur de marche de ${cm(hr)} cm hors de la plage courante (13 à 19 cm).`]);
    if (g < 0.24 || g > 0.32) msgs.push(['warn', `Giron de ${cm(g)} cm hors de la plage courante (24 à 32 cm).`]);
    if (w < 0.8) msgs.push(['warn', `Emmarchement de ${cm(w)} cm : 80 cm au moins (90 cm en logement, 120 cm en établissement recevant du public).`]); else if (w < 0.9) msgs.push(['warn', 'Emmarchement inférieur à 90 cm (minimum en logement collectif).']);
    if (kw && winG < 0.22) msgs.push(['warn', `Giron des marches balancées à la ligne de foulée : ${cm(winG)} cm (22 cm au moins) : élargissez la volée ou réduisez le nombre de marches balancées.`]);
    if ((k !== 'droit' && n1 + n2 < 2)) msgs.push(['warn', 'Trop peu de marches pour ce type d\'escalier : augmentez la hauteur à franchir ou choisissez un escalier droit.']);
    if (P.mat === 'beton' && P.ep < 0.12) msgs.push(['warn', 'Paillasse de moins de 12 cm : épaisseur minimale usuelle en béton armé.']);
    return { n, hr, M, n1, n2, kw, land, lp, jour, steps, path, bb, slope, blondel, flights, pail, winG, vol, msgs, L: bb.u1 - bb.u0, Wd: bb.v1 - bb.v0 }; };
  // local -> world
  S.world = (it, c) => { const r = (it.rot || 0) * Math.PI / 180, co = Math.cos(r), si = Math.sin(r), P = it.par || S.defaults(), T = ([u, v]) => [it.p[0] + u * co - v * si, it.p[1] + u * si + v * co];
    return { steps: c.steps.map(s => Object.assign({}, s, { poly: s.poly.map(T) })), path: c.path.map(T), T }; };
  S.calcItem = it => S.calc(Object.assign(S.defaults(), it.par || {}));

  // ---------- 2D drawing ----------
  S.draw = (ctx, v, th, it, ghost) => { const c = S.calcItem(it), W = S.world(it, c), toS = p => A.toScreen(p, v), col = th.ink || '#e8d9a0'; ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1;
    if (ghost) { ctx.setLineDash([6, 4]); ctx.globalAlpha = 0.8; const all = W.steps; all.forEach(s => { ctx.beginPath(); s.poly.forEach((p, i) => { const q = toS(p); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.closePath(); ctx.stroke(); }); const q = toS(W.T([c.bb.u0 + c.L / 2, c.bb.v0 + c.Wd / 2])); ctx.setLineDash([]); ctx.font = '11px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('trémie', q[0], q[1]); ctx.restore(); return; }
    W.steps.forEach(s => { ctx.beginPath(); s.poly.forEach((p, i) => { const q = toS(p); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.closePath(); ctx.globalAlpha = s.kind === 'landing' ? 0.2 : 0.08; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke(); });
    if (v.s * c.hr * 0 + v.s * 0.3 >= 8) { ctx.font = `${Math.min(12, v.s * 0.2)}px Inter, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; c.steps.forEach((s, i) => { if (s.kind === 'landing') return; const m = s.poly.reduce((a, p) => [a[0] + p[0] / s.poly.length, a[1] + p[1] / s.poly.length], [0, 0]), q = toS(W.T(m)); ctx.fillText(String(s.i), q[0], q[1]); }); }
    ctx.lineWidth = 1.6; ctx.beginPath(); W.path.forEach((p, i) => { const q = toS(p); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.stroke(); const a = toS(W.path[W.path.length - 2]), b = toS(W.path[W.path.length - 1]), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(b[0] - 10 * Math.cos(ang - 0.4), b[1] - 10 * Math.sin(ang - 0.4)); ctx.lineTo(b[0] - 10 * Math.cos(ang + 0.4), b[1] - 10 * Math.sin(ang + 0.4)); ctx.closePath(); ctx.fill();
    const s0 = toS(W.path[0]); ctx.beginPath(); ctx.arc(s0[0], s0[1], 3, 0, 2 * Math.PI); ctx.fill(); ctx.restore(); };
  S.hit = (it, p) => { const c = S.calcItem(it), r = -(it.rot || 0) * Math.PI / 180, dx = p[0] - it.p[0], dy = p[1] - it.p[1], u = dx * Math.cos(r) - dy * Math.sin(r), v = dx * Math.sin(r) + dy * Math.cos(r); return c.steps.some(s => { let inside = false; for (let i = 0, j = s.poly.length - 1; i < s.poly.length; j = i++) { const a = s.poly[i], b = s.poly[j]; if ((a[1] > v) !== (b[1] > v) && u < (b[0] - a[0]) * (v - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside; } return inside; }); };

  // ---------- 3D ----------
  S.mesh = (doc, h) => { const { quad, tri, solid, st, rgba, Hl, lv } = h;
    doc.items.filter(i => i.t === 'stair' && A.shown(i)).forEach(it => { const P = Object.assign(S.defaults(), it.par || {}), c = S.calc(P), W = S.world(it, c), mat = P.mat, YO = lv * Hl, V = (p, z) => [p[0], z + YO, -p[1]],
        col = mat === 'beton' ? [0.66, 0.66, 0.68, 1] : mat === 'bois' ? rgba(A.lib.mat('bois').c) : rgba(A.lib.mat('s235').c), col2 = mat === 'beton' ? [0.60, 0.60, 0.62, 1] : mat === 'bois' ? rgba(A.lib.mat('boisd').c) : [0.30, 0.32, 0.36, 1];
      // convex polygon extruded between two heights
      const prismPoly = (poly, z0, z1, c1) => { const top = poly.map(p => V(p, z1)); for (let i = 1; i + 1 < top.length; i++) tri(solid, [top[0], top[i], top[i + 1]], [0, 1, 0], c1);
        poly.forEach((a, i) => { const b = poly[(i + 1) % poly.length], d = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(d[0], d[1]) || 1; if (l < 1e-6) return; quad(solid, [V(a, z0), V(b, z0), V(b, z1), V(a, z1)], [d[1] / l, 0, d[0] / l], c1); quad(solid, [V(b, z0), V(a, z0), V(a, z1), V(b, z1)], [-d[1] / l, 0, -d[0] / l], c1); }); };
      const sl = Math.atan2(c.hr, P.g), tv = P.ep / Math.cos(sl);
      c.steps.forEach((s, i) => { const poly = W.steps[i].poly, z = s.z;
        if (mat === 'beton') { prismPoly(poly, Math.max(0, z - c.hr - tv), z, s.kind === 'landing' ? col2 : col); return; }
        prismPoly(poly, z - P.th, z, col);   // tread (timber board or steel plate), with two stringers under the side edges of straight treads
        if (s.kind === 'tread') { const ls = mat === 'metal' ? 0.012 : 0.05, dep = mat === 'metal' ? 0.22 : 0.2, cen = poly.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4], [0, 0]), len = k => Math.hypot(poly[(k + 1) % 4][0] - poly[k][0], poly[(k + 1) % 4][1] - poly[k][1]), sides = Math.abs(len(0) - P.g) < 0.02 ? [0, 2] : [1, 3];
          sides.forEach(k => { const a = poly[k], b = poly[(k + 1) % 4], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], nx = cen[0] - mid[0], ny = cen[1] - mid[1], l = Math.hypot(nx, ny) || 1, o = [nx / l * ls, ny / l * ls]; prismPoly([a, b, [b[0] + o[0], b[1] + o[1]], [a[0] + o[0], a[1] + o[1]]], z - dep, z - P.th, col2); }); } });
      st.stairs++; }); };

  // ---------- the tab ----------
  const box = $('stairs'); let draft = null, editing = null;
  const getDraft = () => { if (!draft) draft = Object.assign(S.defaults(), A.doc.stairDraft || {}); return draft; };
  const preview = (P, c) => { const pad = 16, wI = 360, hI = 250, sc = Math.min((wI - 2 * pad) / Math.max(c.L, 0.5), (hI - 2 * pad) / Math.max(c.Wd, 0.5)), X = u => pad + (u - c.bb.u0) * sc, Y = v => hI - pad - (v - c.bb.v0) * sc; let b = '';
    c.steps.forEach(s => { b += `<polygon points="${s.poly.map(p => X(p[0]) + ',' + Y(p[1])).join(' ')}" fill="${s.kind === 'landing' ? 'rgba(229,176,68,.25)' : 'rgba(124,196,255,.10)'}" stroke="currentColor" stroke-width="1"/>`;
      if (s.kind !== 'landing') { const m = s.poly.reduce((a, p) => [a[0] + p[0] / s.poly.length, a[1] + p[1] / s.poly.length], [0, 0]); b += `<text x="${X(m[0])}" y="${Y(m[1]) + 3.5}" font-size="${Math.max(8, Math.min(12, sc * 0.2))}" text-anchor="middle" fill="currentColor">${s.i}</text>`; } });
    b += `<polyline points="${c.path.map(p => X(p[0]) + ',' + Y(p[1])).join(' ')}" fill="none" stroke="#e5b044" stroke-width="2" marker-end="url(#ah)"/>`;
    b += `<text x="${wI / 2}" y="${hI - 2}" font-size="10" fill="#8fa0bb" text-anchor="middle">Plan : emprise ${f2(c.L)} × ${f2(c.Wd)} m, la flèche indique la montée</text>`;
    // profile of the first flight
    const n = c.flights[0], pw = 360, ph = 150, ps = Math.min((pw - 40) / Math.max(n * P.g, 0.5), (ph - 40) / Math.max(n * c.hr, 0.5)), ox = 20, oy = ph - 20; let pr = '';
    pr += `<line x1="${ox - 10}" y1="${oy}" x2="${ox + n * P.g * ps + 10}" y2="${oy}" stroke="currentColor"/>`; let d = `M${ox},${oy}`; for (let i = 1; i <= n; i++) d += ` L${ox + (i - 1) * P.g * ps},${oy - i * c.hr * ps} L${ox + i * P.g * ps},${oy - i * c.hr * ps}`; pr += `<path d="${d}" fill="none" stroke="#7cc4ff" stroke-width="1.6"/>`;
    if (P.mat === 'beton') pr += `<line x1="${ox}" y1="${oy - c.hr * ps - P.ep * ps}" x2="${ox + n * P.g * ps}" y2="${oy - (n + 1) * c.hr * ps - P.ep * ps + c.hr * ps}" stroke="#8fa0bb" stroke-dasharray="4 3"/>`;
    pr += `<text x="${ox + P.g * ps}" y="${oy + 14}" font-size="10" fill="#e5b044">g = ${cm(P.g)} cm</text><text x="${ox - 6}" y="${oy - c.hr * ps / 2}" font-size="10" fill="#e5b044" text-anchor="end">h = ${f2(c.hr * 100)}</text>`;
    pr += `<text x="${pw / 2}" y="${ph - 2}" font-size="10" fill="#8fa0bb" text-anchor="middle">Coupe de la première volée (${n} marches)</text>`;
    return `<svg viewBox="0 0 ${wI} ${hI}" width="100%" style="max-width:${wI}px;color:var(--ink)"><defs><marker id="ah" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#e5b044"/></marker></defs>${b}</svg><svg viewBox="0 0 ${pw} ${ph}" width="100%" style="max-width:${pw}px;color:var(--ink)">${pr}</svg>`; };
  const F = [['kind', 'Type d\'escalier', 'sel', S.KINDS], ['mat', 'Matériau', 'sel', S.MATS], ['H', 'Hauteur à franchir H (cm)', 'cm'], ['h', 'Hauteur de marche visée (cm)', 'cm'], ['g', 'Giron (cm)', 'cm'], ['w', 'Emmarchement (cm)', 'cm'], ['ep', 'Épaisseur de paillasse / palier (cm)', 'cm', 'beton'], ['th', 'Épaisseur de marche (cm)', 'cm', 'notbeton'], ['n1', 'Marches de la 1re volée (0 = auto)', 'int', 'multi'], ['lp', 'Longueur du palier (cm, 0 = emmarchement)', 'cm', 'landing'], ['jour', 'Jour entre les volées (cm)', 'cm', 'demi'], ['k', 'Marches balancées', 'int', 'bal'], ['turn', 'Tourne à', 'sel', [['g', 'gauche'], ['d', 'droite']], 'turn']];
  const show = (P, a) => !a || (a === 'beton' ? P.mat === 'beton' : a === 'notbeton' ? P.mat !== 'beton' : a === 'multi' ? P.kind !== 'droit' : a === 'landing' ? P.kind === 'palier' || P.kind === 'demi' : a === 'demi' ? P.kind === 'demi' : a === 'bal' ? P.kind === 'quartbal' : a === 'turn' ? P.kind !== 'droit' && P.kind !== 'palier' : true);
  // Full render (form + results) or results only: committing a number must not rebuild the form under the cursor.
  S.render = (soft) => { if (!box || A.mode !== 'stairs') return; if (soft === true && box.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return; const P = getDraft(), c = S.calc(P), N = A.nLevels(), q = editing ? A.item(editing) : null;
    const fld = ([k, label, t, o, a0]) => { const a = t === 'sel' ? a0 : o; if (!show(P, a)) return ''; const id = `data-k="${k}"`; return `<label class="row"><span>${label}</span>${t === 'sel' ? `<select ${id}>${o.map(([v, n]) => `<option value="${v}"${P[k] === v ? ' selected' : ''}>${n}</option>`).join('')}</select>` : t === 'cm' ? `<input type="number" step="0.5" min="0" ${id} value="${cm(P[k])}">` : `<input type="number" step="1" min="0" ${id} value="${P[k]}">`}</label>`; };
    const levels = N < 2 ? '<p class="muted">Un seul niveau : passez à R+1 ou plus dans l\'onglet Axes pour poser un escalier entre deux niveaux.</p>' : `<div class="lvbox"><span>Niveaux desservis (de ce niveau au suivant)</span>${Array.from({ length: N - 1 }, (_, i) => `<label><input type="checkbox" data-lvs="${i}"${P.lv.includes(i) ? ' checked' : ''}> ${A.levelName(i)} → ${i + 1 === N - 1 ? (N - 1 === i + 1 ? A.levelName(i + 1) : '') : A.levelName(i + 1)}</label>`).join('')}<button data-act="alllv">Tous les niveaux</button></div>`;
    const res = `<table class="libt"><tr><th>Résultat</th><th>Valeur</th></tr><tr><td>Hauteur à franchir</td><td>${f2(P.H)} m en ${c.n} contremarches</td></tr><tr><td>Hauteur de marche réelle</td><td>${f2(c.hr * 100)} cm</td></tr><tr><td>Marches (girons)</td><td>${c.M}${c.land ? ' dont 1 palier' : ''}${c.kw ? ' dont ' + c.kw + ' balancées' : ''}</td></tr><tr><td>Volées</td><td>${c.flights.map((n, i) => 'volée ' + (i + 1) + ' : ' + n + ' marches').join(' ; ')}</td></tr><tr><td>Longueur de volée (projection)</td><td>${c.flights.map(n => f2(Math.max(0, n - 0) * P.g)).join(' m ; ')} m</td></tr><tr><td>Longueur de paillasse (inclinée)</td><td>${c.pail.map(l => f2(l)).join(' m ; ')} m</td></tr><tr><td>Pente</td><td>${A.fmt(c.slope * 180 / Math.PI, 1)}° (${A.fmt(Math.tan(c.slope) * 100, 0)} %)</td></tr><tr><td>Emprise en plan</td><td>${f2(c.L)} × ${f2(c.Wd)} m</td></tr>${P.mat === 'beton' ? `<tr><td>Béton (marches, paillasses, paliers)</td><td>≈ ${f2(c.vol)} m³, poids ≈ ${f2(c.vol * 25)} kN</td></tr>` : ''}</table>${c.msgs.map(([t, m]) => `<p class="muted" style="${t === 'warn' ? 'color:#ff8a5c' : 'color:#7cffb0'}">${t === 'warn' ? '⚠' : '✓'} ${m}</p>`).join('')}`;
    const html = { form: `<div class="stl"><h2>Escalier</h2>${F.map(fld).join('')}${levels}<h2>Position dans le plan</h2><label class="row"><span>X du départ (m)</span><input type="number" step="0.1" data-k="x" value="${P.x}"></label><label class="row"><span>Y du départ (m)</span><input type="number" step="0.1" data-k="y" value="${P.y}"></label><label class="row"><span>Rotation (°)</span><input type="number" step="90" data-k="rot" value="${P.rot}"></label>
      <button class="wide on" data-act="ok">${q ? 'Valider les modifications' : 'Valider et placer dans le plan'}</button><button class="wide" data-act="mouse">Placer à la souris</button>${q ? '<button class="wide" data-act="new">Nouvel escalier</button><button class="wide" data-act="del">Supprimer cet escalier</button>' : ''}<p class="muted">Valider pose l'escalier au niveau choisi (cases ci-dessus) : il apparaît dans les plans de ces niveaux, la trémie est dessinée au niveau supérieur, et la 3D l'empile à chaque étage. Pour le copier sur d'autres niveaux, cochez-les puis validez.</p></div>`, main: `${preview(P, c)}${res}` };
    if (soft === 'res' && box.querySelector('.stm')) { box.querySelector('.stm').innerHTML = html.main; return; }
    box.innerHTML = html.form + '<div class="stm">' + html.main + '</div>'; };
  const upd = (k, raw) => { const P = getDraft(), F0 = F.find(x => x[0] === k); if (F0 && F0[2] === 'cm') P[k] = Math.max(0, (parseFloat(raw) || 0) / 100); else if (F0 && F0[2] === 'int') P[k] = Math.max(0, Math.round(parseFloat(raw) || 0)); else if (k === 'x' || k === 'y' || k === 'rot') P[k] = parseFloat(raw) || 0; else P[k] = raw;
    if (k === 'H' && P.H < 1) P.H = 1; if (k === 'g' && P.g < 0.15) P.g = 0.15; if (k === 'h' && P.h < 0.1) P.h = 0.1; if (k === 'w' && P.w < 0.5) P.w = 0.5; A.edit(d => { d.stairDraft = Object.assign({}, P); }); };
  S.place = (P, pos, fresh) => { const par = Object.assign({}, P); const item = { id: fresh ? A.uid() : (editing || A.uid()), t: 'stair', p: pos || [P.x, P.y], rot: P.rot || 0, par, layer: A.layer('str') ? 'str' : A.doc.layers[0].id };
    const lv = P.lv.slice().sort(); if (lv.length && lv.length < A.nLevels()) item.lv = lv; else if (lv.length >= A.nLevels() - 1 && A.nLevels() <= 1) { /* single level */ } if (!lv.length) item.lv = [0];
    A.edit(d => { const i = d.items.findIndex(x => x.id === item.id); if (i >= 0) { item.layer = d.items[i].layer; d.items[i] = item; } else d.items.push(item); }); editing = item.id; return item; };
  S.edit = id => { const it = A.item(id); if (!it || it.t !== 'stair') return; editing = id; draft = Object.assign(S.defaults(), it.par, { x: it.p[0], y: it.p[1], rot: it.rot || 0, lv: it.lv ? it.lv.slice() : Array.from({ length: Math.max(1, A.nLevels() - 1) }, (_, i) => i) }); A.setMode('stairs'); S.render(); };
  S.stairLv = P => P.lv;
  if (box) {
    box.addEventListener('change', e => { const t = e.target; if (t.dataset.lvs != null) { const P = getDraft(), i = +t.dataset.lvs; P.lv = t.checked ? [...new Set([...P.lv, i])].sort() : P.lv.filter(x => x !== i); S.render(); return; } if (!t.dataset.k) return; upd(t.dataset.k, t.value); S.render(['kind', 'mat'].includes(t.dataset.k) ? false : 'res'); });
    box.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const a = b.dataset.act, P = getDraft();
      if (a === 'alllv') { P.lv = Array.from({ length: Math.max(1, A.nLevels() - 1) }, (_, i) => i); S.render(); }
      else if (a === 'ok') { S.place(P); A.sel = [editing]; A.setMode('2d'); }
      else if (a === 'mouse') { P.placing = true; A.edit(d => { d.stairDraft = Object.assign({}, P); }); A.setMode('2d'); A.setTool('stair'); }
      else if (a === 'new') { editing = null; S.render(); }
      else if (a === 'del') { A.edit(() => A.removeIds([editing])); editing = null; A.sel = []; S.render(); } });
  }
  S.draftPar = () => Object.assign({}, getDraft());
  S.editing = () => editing;
  A.on(() => S.render(true));
})();
