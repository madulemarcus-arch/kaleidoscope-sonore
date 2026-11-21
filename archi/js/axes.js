// Axes: the building grid (cartesian X/Y or cylindrical R/theta), storeys (Z) and foundation depth.
// Axes are drawn under the plan (greyed out once walls exist), are snapped to, and can seed columns and beams at their intersections.
// Data: doc.grid = { sys:'cart'|'cyl', x:[{n,p}] (vertical lines x = p), y:[{n,p}] (horizontal lines y = p), cyl:{ c:[x,y], r:[{n,v}], a:[{n,v}] (degrees) }, anchor (m), fade, bubbles, snap }.
// Number of storeys = doc.struct.p.nlev, storey height = doc.defaults.h.
(function () {
  const A = window.App, $ = id => document.getElementById(id), AX = A.axes = {};
  const r3 = v => Math.round(v * 1000) / 1000, rad = d => d * Math.PI / 180;
  AX.letter = i => { let s = '', n = i; do { s = String.fromCharCode(65 + n % 26) + s; n = Math.floor(n / 26) - 1; } while (n >= 0); return s; };
  AX.has = () => { const g = A.doc.grid; return g.sys === 'cyl' ? g.cyl.r.length + g.cyl.a.length > 0 : g.x.length + g.y.length > 0; };
  AX.clear = () => { const g = A.doc.grid; return g.sys === 'cyl' ? g.cyl.r.length + g.cyl.a.length === 0 : g.x.length + g.y.length === 0; };
  const span = (arr, pad, fb) => arr.length ? [Math.min(...arr.map(a => a.p)) - pad, Math.max(...arr.map(a => a.p)) + pad] : fb;

  // ---------- geometry ----------
  AX.ext = () => { const g = A.doc.grid, pad = 1.2; if (g.sys === 'cyl') { const R = Math.max(1, ...g.cyl.r.map(r => r.v)) + pad; return { x0: g.cyl.c[0] - R, x1: g.cyl.c[0] + R, y0: g.cyl.c[1] - R, y1: g.cyl.c[1] + R, R }; }
    const [x0, x1] = span(g.x, pad, [-3, 7]), [y0, y1] = span(g.y, pad, [-3, 7]); return { x0, x1, y0, y1 }; };
  // every intersection: cartesian x x y, or cylindrical ring x radial axis
  AX.intersections = () => { const g = A.doc.grid, out = [];
    if (g.sys === 'cyl') { const c = g.cyl.c; g.cyl.r.forEach(r => g.cyl.a.forEach(a => out.push({ p: [r3(c[0] + r.v * Math.cos(rad(a.v))), r3(c[1] + r.v * Math.sin(rad(a.v)))], name: r.n + '/' + a.n, r: r.v, a: a.v }))); }
    else g.x.forEach(x => g.y.forEach(y => out.push({ p: [x.p, y.p], name: y.n + x.n, x: x.p, y: y.p, xn: x.n, yn: y.n }))); return out; };
  // pairs of neighbouring intersections along the axes (beams between columns)
  AX.links = () => { const g = A.doc.grid, pts = AX.intersections(), out = [];
    if (g.sys === 'cyl') { const rs = [...g.cyl.r].sort((p, q) => p.v - q.v), as = [...g.cyl.a].sort((p, q) => p.v - q.v), at = (r, a) => pts.find(q => q.r === r.v && q.a === a.v);
      as.forEach(a => rs.forEach((r, i) => { if (i) out.push([at(rs[i - 1], a).p, at(r, a).p]); }));
      rs.forEach(r => as.forEach((a, j) => { if (j) out.push([at(r, as[j - 1]).p, at(r, a).p]); else return; }));
      if (as.length > 2 && 360 - (as[as.length - 1].v - as[0].v) < 1.5 * (as[as.length - 1].v - as[0].v) / (as.length - 1)) rs.forEach(r => out.push([at(r, as[as.length - 1]).p, at(r, as[0]).p]));
    } else { const xs = [...g.x].sort((p, q) => p.p - q.p), ys = [...g.y].sort((p, q) => p.p - q.p);
      xs.forEach(x => ys.forEach((y, j) => { if (j) out.push([[x.p, ys[j - 1].p], [x.p, y.p]]); })); ys.forEach(y => xs.forEach((x, i) => { if (i) out.push([[xs[i - 1].p, y.p], [x.p, y.p]]); })); }
    return out; };
  // snapping: intersections first, then the axis lines themselves; step rounds the free coordinate along a line
  AX.snap = (raw, scale, step) => { if (!AX.has()) return null; const g = A.doc.grid, tol = 14 / scale, tl = 9 / scale; let best = tol, hit = null;
    AX.intersections().forEach(q => { const d = A.dist(raw, q.p); if (d < best) { best = d; hit = { p: q.p.slice(), kind: 'axe', name: q.name }; } });
    if (hit) return hit; best = tl; const e = AX.ext(), rd = v => step ? Math.round(v / step) * step : v;
    if (g.sys === 'cyl') { const c = g.cyl.c, dx = raw[0] - c[0], dy = raw[1] - c[1], dist = Math.hypot(dx, dy);
      g.cyl.r.forEach(r => { const d = Math.abs(dist - r.v); if (d < best && dist > 1e-6) { best = d; hit = { p: [c[0] + dx / dist * r.v, c[1] + dy / dist * r.v], kind: 'axeL', name: r.n }; } });
      g.cyl.a.forEach(a => { const u = [Math.cos(rad(a.v)), Math.sin(rad(a.v))], t = dx * u[0] + dy * u[1], d = Math.abs(-dx * u[1] + dy * u[0]); if (t > 0 && t <= e.R && d < best) { best = d; const tt = Math.max(0, rd(t)); hit = { p: [c[0] + u[0] * tt, c[1] + u[1] * tt], kind: 'axeL', name: a.n }; } }); }
    else { g.x.forEach(x => { const d = Math.abs(raw[0] - x.p); if (d < best && raw[1] >= e.y0 && raw[1] <= e.y1) { best = d; hit = { p: [x.p, rd(raw[1])], kind: 'axeL', name: x.n }; } });
      g.y.forEach(y => { const d = Math.abs(raw[1] - y.p); if (d < best && raw[0] >= e.x0 && raw[0] <= e.x1) { best = d; hit = { p: [rd(raw[0]), y.p], kind: 'axeL', name: y.n }; } }); }
    return hit; };

  // ring names sit in the widest gap between two radial axes (-90 degrees when there are fewer than two)
  AX.ringLabelAngle = () => { const a = A.doc.grid.cyl.a.map(q => ((q.v % 360) + 360) % 360).sort((p, q) => p - q); if (a.length < 2) return rad(-90); let best = -1, mid = 0;
    a.forEach((v, i) => { const nx = i === a.length - 1 ? a[0] + 360 : a[i + 1], gap = nx - v; if (gap > best) { best = gap; mid = v + gap / 2; } }); return rad(mid); };
  // greyed out once walls exist (and not in the Axes tab)
  AX.dimmed = mode => mode !== 'axes' && A.doc.grid.fade !== false && A.doc.items.some(i => i.t === 'wall');

  // ---------- drawing ----------
  AX.draw = (ctx, W, H, v, th, mode) => { if (!AX.has()) return; const g = A.doc.grid, dim = AX.dimmed(mode), print = !!th.ink;
    const col = print ? (dim ? '#b5b5b5' : '#555') : (dim ? 'rgba(150,165,190,.34)' : '#5aa9ff'), txt = print ? (dim ? '#999' : '#333') : (dim ? 'rgba(170,185,210,.55)' : '#9ccbff');
    const S = p => A.toScreen(p, v), rb = Math.max(8, Math.min(15, 0.28 * v.s)), e = AX.ext();
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = dim ? 0.8 : 1.1; ctx.setLineDash([16, 4, 3, 4]);
    const bubble = (p, dir, name) => { if (g.bubbles === false) return; const q = S(p), cx = q[0] + dir[0] * rb, cy = q[1] + dir[1] * rb; ctx.setLineDash([]); ctx.fillStyle = th.bg; ctx.beginPath(); ctx.arc(cx, cy, rb, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
      ctx.fillStyle = txt; ctx.font = `${Math.round(rb * (name.length > 2 ? 0.8 : 1.05))}px Inter, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(name, cx, cy + 0.5); ctx.setLineDash([16, 4, 3, 4]); };
    const line = (a, b) => { const p = S(a), q = S(b); ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); };
    if (g.sys === 'cyl') { const c = g.cyl.c, cs = S(c);
      const la = AX.ringLabelAngle(); g.cyl.r.forEach(r => { ctx.beginPath(); ctx.arc(cs[0], cs[1], r.v * v.s, 0, 2 * Math.PI); ctx.stroke(); bubble([c[0] + r.v * Math.cos(la), c[1] + r.v * Math.sin(la)], [Math.cos(la), -Math.sin(la)], r.n); });
      g.cyl.a.forEach(a => { const u = [Math.cos(rad(a.v)), Math.sin(rad(a.v))], end = [c[0] + u[0] * e.R, c[1] + u[1] * e.R]; line(c, end); bubble(end, [u[0], -u[1]], a.n + ''); });
      ctx.setLineDash([]); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cs[0], cs[1], 2.5, 0, 2 * Math.PI); ctx.fill(); }
    else { g.x.forEach(x => { line([x.p, e.y0], [x.p, e.y1]); bubble([x.p, e.y1], [0, -1], x.n); bubble([x.p, e.y0], [0, 1], x.n); });
      g.y.forEach(y => { line([e.x0, y.p], [e.x1, y.p]); bubble([e.x0, y.p], [-1, 0], y.n); bubble([e.x1, y.p], [1, 0], y.n); });
      if (!dim) { ctx.setLineDash([]); ctx.fillStyle = txt; ctx.font = `${Math.max(10, Math.min(13, 0.2 * v.s))}px Inter, system-ui, sans-serif`; ctx.textBaseline = 'bottom'; ctx.textAlign = 'center';
        const xs = [...g.x].sort((p, q) => p.p - q.p), ys = [...g.y].sort((p, q) => p.p - q.p), top = S([0, e.y1])[1] - 2 * rb - 6, left = S([e.x0, 0])[0] - 2 * rb - 8;
        xs.forEach((x, i) => { if (i) ctx.fillText(A.fmt(x.p - xs[i - 1].p), S([(x.p + xs[i - 1].p) / 2, 0])[0], top); });
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ys.forEach((y, i) => { if (i) ctx.fillText(A.fmt(y.p - ys[i - 1].p), left, S([0, (y.p + ys[i - 1].p) / 2])[1]); }); } }
    ctx.restore(); };

  // ---------- model edits ----------
  const G = () => A.doc.grid;
  const shiftFrom = (list, i, delta) => { for (let k = i; k < list.length; k++) list[k].p = r3(list[k].p + delta); };
  AX.setSys = s => A.edit(d => { d.grid.sys = s; });
  AX.addAxis = k => A.edit(d => { const l = d.grid[k], last = l[l.length - 1], step = l.length > 1 ? last.p - l[l.length - 2].p : 4; l.push({ n: k === 'x' ? String(l.length + 1) : AX.letter(l.length), p: r3(last ? last.p + step : 0) }); });
  AX.delAxis = (k, i) => A.edit(d => { d.grid[k].splice(i, 1); });
  AX.setSpacing = (k, i, val) => A.edit(d => { const l = d.grid[k]; if (!isFinite(val)) return; if (i === 0) shiftFrom(l, 0, val - l[0].p); else { const v = Math.max(0.1, val); shiftFrom(l, i, v - (l[i].p - l[i - 1].p)); } });
  AX.rename = (k, i, s) => A.edit(d => { d.grid[k][i].n = String(s).trim().slice(0, 6) || d.grid[k][i].n; });
  AX.generate = (nx, ex, ny, ey) => A.edit(d => { const n = (c, e, f) => Array.from({ length: Math.max(0, Math.min(40, Math.round(c))) }, (_, i) => ({ n: f(i), p: r3(i * e) })); d.grid.sys = 'cart'; d.grid.x = n(nx, Math.max(0.1, ex), i => String(i + 1)); d.grid.y = n(ny, Math.max(0.1, ey), AX.letter); });
  AX.generateCyl = (nr, dr, na, da0) => A.edit(d => { const c = d.grid.cyl; d.grid.sys = 'cyl'; c.r = Array.from({ length: Math.max(0, Math.min(30, Math.round(nr))) }, (_, i) => ({ n: 'R' + (i + 1), v: r3((i + 1) * Math.max(0.1, dr)) }));
    const n = Math.max(0, Math.min(72, Math.round(na))); c.a = Array.from({ length: n }, (_, i) => ({ n: String(i + 1), v: r3(i * (da0 || (n ? 360 / n : 0))) })); });
  AX.addRing = () => A.edit(d => { const r = d.grid.cyl.r, last = r[r.length - 1], st = r.length > 1 ? last.v - r[r.length - 2].v : 3; r.push({ n: 'R' + (r.length + 1), v: r3(last ? last.v + st : st) }); });
  AX.addAngle = () => A.edit(d => { const a = d.grid.cyl.a, last = a[a.length - 1], st = a.length > 1 ? last.v - a[a.length - 2].v : 45; a.push({ n: String(a.length + 1), v: r3(last ? last.v + st : 0) }); });
  AX.setLevels = n => A.edit(d => { d.struct.p.nlev = Math.max(1, Math.min(10, Math.round(n))); });
  AX.setStoreyH = h => A.edit(d => { if (!(h >= 2)) return; const old = d.defaults.h; d.items.forEach(i => { if (i.t === 'wall' && Math.abs(i.h - old) < 1e-9) i.h = h; }); d.defaults.h = r3(h); });
  AX.setAnchor = v => A.edit(d => { if (v >= 0.3 && v <= 6) d.grid.anchor = r3(v); });
  // columns at every intersection (not on an existing column), optionally with a beam along every axis between neighbouring columns
  AX.place = withBeams => { const res = { cols: 0, beams: 0 }, pts = AX.intersections(), d0 = A.doc; if (!pts.length) return res;
    const newCols = pts.filter(q => !d0.items.some(o => o.t === 'col' && A.same(o.p, q.p))), links = withBeams ? AX.links().filter(([a, b]) => A.dist(a, b) >= 0.3 && !d0.items.some(o => o.t === 'beam' && ((A.same(o.a, a) && A.same(o.b, b)) || (A.same(o.a, b) && A.same(o.b, a))))) : [];
    if (!newCols.length && !links.length) return res;   // nothing to add: no undo step
    A.edit(d => { const lay = d.layers.some(l => l.id === 'str') ? 'str' : d.active; newCols.forEach(q => { d.items.push({ id: A.uid(), t: 'col', p: q.p.slice(), a: 0.2, layer: lay }); res.cols++; });
      links.forEach(([a, b]) => { d.items.push({ id: A.uid(), t: 'beam', a: a.slice(), b: b.slice(), layer: lay }); res.beams++; }); });
    return res; };
  AX.levels = () => { const N = Math.max(1, Math.round(A.doc.struct.p.nlev)), H = A.doc.defaults.h; return { N, H, list: Array.from({ length: N + 1 }, (_, i) => ({ name: i === N ? 'Toiture' : i === 0 ? 'RDC' : 'R+' + i, z: r3(i * H) })), total: r3(N * H), D: A.doc.grid.anchor }; };

  // ---------- section sketch: ground, storeys and foundation depth ----------
  AX.sectionSVG = () => { const L = AX.levels(), W = 290, top = 22, total = L.total + L.D + 0.5, s = Math.min(34, 200 / total), gy = top + L.total * s, bx = 104, bw = 78, fy = gy + L.D * s, f = (v, n = 2) => A.fmt(v, n), out = [];
    out.push(`<rect x="${bx - 50}" y="${gy}" width="${bw + 100}" height="${L.D * s + 18}" fill="url(#hatchG)" opacity=".5"/>`);
    out.push(`<line x1="8" y1="${gy}" x2="${bx + bw + 6}" y2="${gy}" stroke="currentColor" stroke-width="1.6"/>`, `<text x="${bx + bw + 8}" y="${gy + 16}" font-size="9.5" fill="currentColor" opacity=".75">T.N. ±0,00</text>`);
    const ft = Math.min(0.4, L.D * 0.8) * s; out.push(`<rect x="${bx - 12}" y="${fy - ft}" width="${bw + 24}" height="${ft}" fill="#8b95a6" stroke="currentColor"/>`, `<rect x="${bx + bw / 2 - 5}" y="${gy}" width="10" height="${Math.max(0, fy - ft - gy)}" fill="#8b95a6" stroke="currentColor" stroke-width=".8"/>`);
    out.push(`<rect x="${bx}" y="${top}" width="${bw}" height="${L.total * s}" fill="none" stroke="#5aa9ff" stroke-width="1.4"/>`);
    L.list.forEach((l, i) => { const y = gy - l.z * s; out.push(`<line x1="${bx}" y1="${y}" x2="${bx + bw}" y2="${y}" stroke="#5aa9ff" stroke-width="${i === L.N ? 2.2 : 1.2}"/>`, `<text x="${bx + bw + 8}" y="${y + 3.5}" font-size="10" fill="currentColor">${l.name} <tspan opacity=".7">+${f(l.z)}</tspan></text>`); });
    out.push(`<line x1="${bx - 26}" y1="${gy}" x2="${bx - 26}" y2="${fy}" stroke="#e5b044" stroke-width="1.4" marker-start="url(#arr)" marker-end="url(#arr)"/>`, `<text x="${bx - 30}" y="${(gy + fy) / 2}" font-size="10" fill="#e5b044" text-anchor="end" dominant-baseline="middle">D = ${f(L.D)} m</text>`);
    out.push(`<text x="${bx - 30}" y="${top + 6}" font-size="10" fill="currentColor" text-anchor="end" opacity=".8">H = ${f(L.total)} m</text>`);
    return `<svg viewBox="0 0 ${W} ${fy + 22}" width="100%" role="img" aria-label="Coupe : niveaux et profondeur d'ancrage" style="color:var(--ink)"><defs><pattern id="hatchG" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke="#8fa0bb" stroke-width="1"/></pattern><marker id="arr" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L6,3 L0,6 z" fill="#e5b044"/></marker></defs>${out.join('')}</svg>`; };

  // ---------- panel ----------
  const box = $('panelAx'); let sig = '';
  const rows = k => { const l = G()[k]; return `<table class="axt"><tr><th>Nom</th><th>${l.length ? 'Entraxe (m)' : ''}</th><th>Position</th><th></th></tr>${l.map((a, i) => `<tr><td><input data-k="name:${k}:${i}" value="${a.n}" maxlength="6" aria-label="Nom"></td><td><input type="number" step="0.05" data-k="sp:${k}:${i}" value="${i ? r3(a.p - l[i - 1].p) : a.p}" aria-label="${i ? 'Entraxe avec l\'axe précédent' : 'Position de l\'origine'}"></td><td class="pos" data-pos="${k}:${i}">${A.fmt(a.p)}</td><td><button data-del="${k}:${i}" aria-label="Supprimer l'axe" title="Supprimer">✕</button></td></tr>`).join('')}</table><button class="wide" data-add="${k}">+ Axe ${k === 'x' ? 'X (1, 2, 3…)' : 'Y (A, B, C…)'}</button>`; };
  const cylRows = (k, unit) => { const l = G().cyl[k]; return `<table class="axt"><tr><th>Nom</th><th>${unit}</th><th></th></tr>${l.map((a, i) => `<tr><td><input data-k="cn:${k}:${i}" value="${a.n}" maxlength="6" aria-label="Nom"></td><td><input type="number" step="${k === 'r' ? 0.1 : 5}" data-k="cv:${k}:${i}" value="${a.v}" aria-label="${unit}"></td><td><button data-cdel="${k}:${i}" aria-label="Supprimer" title="Supprimer">✕</button></td></tr>`).join('')}</table>`; };
  const build = () => { const g = G(), L = AX.levels(), cyl = g.sys === 'cyl', c = g.cyl;
    return `<section><h2>Système de coordonnées</h2><div class="seg"><button data-sys="cart" aria-pressed="${!cyl}">Cartésien</button><button data-sys="cyl" aria-pressed="${cyl}">Cylindrique</button></div>
      <p class="muted">${cyl ? 'Cylindrique : rayon R, angle polaire θ (0° vers l\'est, sens trigonométrique) et hauteur Z.' : 'Cartésien : axes X (numérotés) et Y (lettrés), hauteur Z par niveaux.'} Le système sphérique n'a pas de sens pour un plan de bâtiment : il n'est pas proposé.</p></section>
    <section><h2>Grille rapide</h2>${cyl ? `<label class="row"><span>Anneaux (R)</span><input type="number" min="0" max="30" data-q="nr" value="${c.r.length || 3}"></label><label class="row"><span>Pas radial (m)</span><input type="number" step="0.5" data-q="dr" value="${c.r.length > 1 ? r3(c.r[1].v - c.r[0].v) : 3}"></label><label class="row"><span>Axes radiaux</span><input type="number" min="0" max="72" data-q="na" value="${c.a.length || 8}"></label>`
      : `<label class="row"><span>Axes X</span><input type="number" min="0" max="40" data-q="nx" value="${g.x.length || 4}"></label><label class="row"><span>Entraxe X (m)</span><input type="number" step="0.25" data-q="ex" value="${g.x.length > 1 ? r3(g.x[1].p - g.x[0].p) : 4}"></label><label class="row"><span>Axes Y</span><input type="number" min="0" max="40" data-q="ny" value="${g.y.length || 3}"></label><label class="row"><span>Entraxe Y (m)</span><input type="number" step="0.25" data-q="ey" value="${g.y.length > 1 ? r3(g.y[1].p - g.y[0].p) : 4}"></label>`}<button class="wide" data-act="gen">Générer la grille</button></section>
    ${cyl ? `<section><h2>Centre</h2><label class="row"><span>X (m)</span><input type="number" step="0.5" data-k="cx" value="${c.c[0]}"></label><label class="row"><span>Y (m)</span><input type="number" step="0.5" data-k="cy" value="${c.c[1]}"></label></section>
      <section><h2>Anneaux (rayons)</h2>${cylRows('r', 'Rayon (m)')}<button class="wide" data-act="addRing">+ Anneau</button></section><section><h2>Axes radiaux (angles)</h2>${cylRows('a', 'Angle (°)')}<button class="wide" data-act="addAngle">+ Axe radial</button></section>`
      : `<section><h2>Axes X (1, 2, 3…)</h2>${rows('x')}</section><section><h2>Axes Y (A, B, C…)</h2>${rows('y')}</section>`}
    <section><h2>Niveaux (Z)</h2><label class="row"><span>Étages</span><select data-k="lev">${Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}"${i + 1 === L.N ? ' selected' : ''}>${i ? 'R+' + i : 'RDC seul'}</option>`).join('')}</select></label>
      <label class="row"><span>Hauteur d'étage (m)</span><input type="number" step="0.05" min="2" max="6" data-k="hs" value="${L.H}"></label><label class="row"><span>Ancrage D (m)</span><input type="number" step="0.1" min="0.3" max="6" data-k="anc" value="${L.D}" title="Profondeur d'ancrage de la fondation sous le terrain naturel"></label>
      <div id="axSec">${AX.sectionSVG()}</div><p class="muted" id="axInfo"></p></section>
    <section><h2>Affichage</h2><label class="chk"><input type="checkbox" data-o="fade"${g.fade !== false ? ' checked' : ''}> Griser les axes dès que les murs sont tracés</label><label class="chk"><input type="checkbox" data-o="bubbles"${g.bubbles !== false ? ' checked' : ''}> Bulles de repérage</label>
      <label class="chk"><input type="checkbox" data-o="snap"${g.snap !== false ? ' checked' : ''}> Accrochage aux axes en dessin 2D</label></section>
    <section><h2>Structure sur les axes</h2><button class="wide" data-act="cols">Poteaux à chaque intersection</button><button class="wide" data-act="beams">Poteaux et poutres sur les axes</button><button class="wide" data-act="fit">Tout voir</button><p class="muted" id="axMsg"></p></section>`; };
  const refresh = () => { if (!box) return; const g = G(), L = AX.levels(), s = JSON.stringify([g.sys, g.x.length, g.y.length, g.cyl.r.length, g.cyl.a.length, g.cyl.r.map(r => r.n + r.v), g.cyl.a.map(a => a.n + a.v), g.x.map(a => a.n), g.y.map(a => a.n)]);
    if (s !== sig || !box.firstChild) { sig = s; box.innerHTML = build(); }
    else { // same structure: update values in place so that typing and tabbing are not interrupted
      const set = (el, v) => { if (el && el !== document.activeElement) el.value = v; };
      ['x', 'y'].forEach(k => g[k].forEach((a, i) => { set(box.querySelector(`[data-k="sp:${k}:${i}"]`), i ? r3(a.p - g[k][i - 1].p) : a.p); const t = box.querySelector(`[data-pos="${k}:${i}"]`); if (t) t.textContent = A.fmt(a.p); }));
      set(box.querySelector('[data-k=hs]'), L.H); set(box.querySelector('[data-k=anc]'), L.D); set(box.querySelector('[data-k=lev]'), L.N); const sv = $('axSec'); if (sv) sv.innerHTML = AX.sectionSVG(); }
    const info = $('axInfo'); if (info) info.textContent = `${L.N} niveau${L.N > 1 ? 'x' : ''} (${L.N > 1 ? 'R+' + (L.N - 1) : 'RDC'}), hauteur totale ${A.fmt(L.total)} m, fondation à −${A.fmt(L.D)} m.`; };
  if (box) {
    box.addEventListener('click', e => { const t = e.target.closest('button'); if (!t) return; const d = t.dataset;
      if (d.sys) AX.setSys(d.sys); else if (d.add) AX.addAxis(d.add); else if (d.del) { const [k, i] = d.del.split(':'); AX.delAxis(k, +i); }
      else if (d.cdel) { const [k, i] = d.cdel.split(':'); A.edit(dd => { dd.grid.cyl[k].splice(+i, 1); }); }
      else if (d.act === 'gen') { const q = n => parseFloat(box.querySelector(`[data-q=${n}]`).value); if (G().sys === 'cyl') AX.generateCyl(q('nr'), q('dr'), q('na')); else AX.generate(q('nx'), q('ex'), q('ny'), q('ey')); setTimeout(() => A.fitView && A.fitView(), 0); }
      else if (d.act === 'addRing') AX.addRing(); else if (d.act === 'addAngle') AX.addAngle(); else if (d.act === 'fit') A.fitView();
      else if (d.act === 'cols' || d.act === 'beams') { const r = AX.place(d.act === 'beams'), m = $('axMsg'); if (m) m.textContent = AX.clear() ? 'Définissez d\'abord des axes.' : r.cols || r.beams ? `${r.cols} poteau(x) et ${r.beams} poutre(s) ajoutés (annulable avec Ctrl+Z).` : 'Rien à ajouter : les poteaux existent déjà sur les axes.'; } });
    box.addEventListener('change', e => { const t = e.target, k = t.dataset.k, v = parseFloat(t.value);
      if (t.dataset.o) { A.edit(d => { d.grid[t.dataset.o] = t.checked; }); return; }
      if (!k) return; const p = k.split(':');
      if (p[0] === 'name') AX.rename(p[1], +p[2], t.value); else if (p[0] === 'sp') AX.setSpacing(p[1], +p[2], v);
      else if (p[0] === 'cn') A.edit(d => { d.grid.cyl[p[1]][+p[2]].n = String(t.value).trim().slice(0, 6) || d.grid.cyl[p[1]][+p[2]].n; }); else if (p[0] === 'cv') A.edit(d => { if (isFinite(v) && (p[1] !== 'r' || v > 0)) d.grid.cyl[p[1]][+p[2]].v = v; });
      else if (k === 'cx' || k === 'cy') A.edit(d => { if (isFinite(v)) d.grid.cyl.c[k === 'cx' ? 0 : 1] = v; }); else if (k === 'lev') AX.setLevels(v); else if (k === 'hs') AX.setStoreyH(v); else if (k === 'anc') AX.setAnchor(v); });
  }
  A.on(refresh);
})();
