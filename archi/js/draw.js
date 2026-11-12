// Rendering: view transform, grid, items, selection and tool previews. render() is also used for PNG export.
(function () {
  const A = window.App, V = A.view = { s: 50, ox: 0, oy: 0 };
  A.THEMES = {
    screen: { bg: '#0e1420', grid: 'rgba(124,196,255,.10)', major: 'rgba(124,196,255,.22)', axis: 'rgba(213,82,47,.55)', ink: null, text: '#e5b044', sel: '#ff8a5c', pv: '#ffd27a' },
    print: { bg: '#ffffff', grid: null, major: null, axis: null, ink: '#111111', text: '#111111', sel: '#d5522f', pv: '#d5522f' }
  };
  A.toScreen = (p, v = V) => [p[0] * v.s + v.ox, -p[1] * v.s + v.oy];
  A.toWorld = (x, y) => [(x - V.ox) / V.s, -(y - V.oy) / V.s];
  const STEPS = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100];
  A.gridStep = () => STEPS.find(s => s * V.s >= 18) || 100;
  A.fit = (W, H) => {
    const b = A.bounds(); if (!b) { V.s = 50; V.ox = W / 2; V.oy = H / 2; return; }
    const w = Math.max(b.x1 - b.x0, 1), h = Math.max(b.y1 - b.y0, 1);
    V.s = Math.min((W - 80) / w, (H - 80) / h, 400); V.ox = W / 2 - (b.x0 + b.x1) / 2 * V.s; V.oy = H / 2 + (b.y0 + b.y1) / 2 * V.s;
  };

  function poly(ctx, pts, v) { ctx.beginPath(); pts.forEach((p, i) => { const q = A.toScreen(p, v); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.closePath(); }
  function seg(ctx, a, b, v) { const p = A.toScreen(a, v), q = A.toScreen(b, v); ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); }
  function label(ctx, text, p, ang, v, color, px) {
    const q = A.toScreen(p, v); let a = -ang; if (a > Math.PI / 2) a -= Math.PI; if (a < -Math.PI / 2) a += Math.PI;
    ctx.save(); ctx.translate(q[0], q[1]); ctx.rotate(a); ctx.fillStyle = color; ctx.font = `${px}px Inter, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(text, 0, -3); ctx.restore();
  }
  function grid(ctx, W, H, v, th) {
    const st = STEPS.find(s => s * v.s >= 18) || 100, w0 = [(0 - v.ox) / v.s, -(0 - v.oy) / v.s], w1 = [(W - v.ox) / v.s, -(H - v.oy) / v.s];
    const draw = (step, color) => { ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = Math.ceil(w0[0] / step) * step; x <= w1[0]; x += step) { const sx = Math.round(x * v.s + v.ox) + 0.5; ctx.moveTo(sx, 0); ctx.lineTo(sx, H); }
      for (let y = Math.ceil(w1[1] / step) * step; y <= w0[1]; y += step) { const sy = Math.round(-y * v.s + v.oy) + 0.5; ctx.moveTo(0, sy); ctx.lineTo(W, sy); } ctx.stroke(); };
    draw(st, th.grid); draw(st * 5, th.major);
    ctx.strokeStyle = th.axis; ctx.beginPath(); ctx.moveTo(0, Math.round(v.oy) + 0.5); ctx.lineTo(W, Math.round(v.oy) + 0.5); ctx.moveTo(Math.round(v.ox) + 0.5, 0); ctx.lineTo(Math.round(v.ox) + 0.5, H); ctx.stroke();
  }

  // opts: { sel:[ids], pv:{...preview}, snap:{p,kind}, grid:bool }
  A.render = (ctx, W, H, v, theme, opts = {}) => {
    const th = A.THEMES[theme], doc = A.doc; ctx.fillStyle = th.bg; ctx.fillRect(0, 0, W, H);
    if (opts.grid && th.grid) grid(ctx, W, H, v, th);
    const col = it => th.ink || (A.layer(it.layer) || {}).color || '#fff', items = doc.items.filter(A.shown);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // walls: filled, with a same-colour stroke so joined corners merge
    items.filter(i => i.t === 'wall').forEach(w => { const c = col(w); ctx.fillStyle = c; ctx.strokeStyle = c; ctx.lineWidth = 1; poly(ctx, A.wallGeom(w).poly, v); ctx.fill(); ctx.stroke(); });
    // openings cut the wall, then draw their symbol
    items.filter(A.isOpening).forEach(o => { const r = A.openRect(o); if (!r) return; ctx.fillStyle = th.bg; poly(ctx, r.pts, v); ctx.fill();
      const c = col(r.w); ctx.strokeStyle = c; ctx.lineWidth = 1.2; const { u, n, h } = r.g, q = o.w / 2, P = (s, k) => [r.w.a[0] + u[0] * (r.c + s * q) + n[0] * k, r.w.a[1] + n[1] * k + u[1] * (r.c + s * q)];
      if (o.t === 'window') { [-1, 0, 1].forEach(k => seg(ctx, P(-1, k * h * 0.66), P(1, k * h * 0.66), v)); seg(ctx, P(-1, h), P(-1, -h), v); seg(ctx, P(1, h), P(1, -h), v); return; }
      const side = o.flip ? -1 : 1, sg = o.mirror ? 1 : -1, hinge = P(sg, 0), closed = P(-sg, 0), tip = [hinge[0] + n[0] * side * o.w, hinge[1] + n[1] * side * o.w];
      seg(ctx, P(-1, h), P(-1, -h), v); seg(ctx, P(1, h), P(1, -h), v); seg(ctx, hinge, tip, v);
      const H0 = A.toScreen(hinge, v), C0 = A.toScreen(closed, v), T0 = A.toScreen(tip, v), a1 = Math.atan2(C0[1] - H0[1], C0[0] - H0[0]), a2 = Math.atan2(T0[1] - H0[1], T0[0] - H0[0]);
      let d = a2 - a1; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      ctx.beginPath(); ctx.arc(H0[0], H0[1], o.w * v.s, a1, a2, d < 0); ctx.stroke(); });
    items.filter(i => i.t === 'line').forEach(l => { ctx.strokeStyle = col(l); ctx.lineWidth = 1.4; seg(ctx, l.a, l.b, v); });
    items.filter(i => i.t === 'dim').forEach(d => { const g = A.dimGeom(d), c = th.ink || col(d); ctx.strokeStyle = c; ctx.lineWidth = 1;
      seg(ctx, d.a, g.a2, v); seg(ctx, d.b, g.b2, v); seg(ctx, g.a2, g.b2, v);
      [g.a2, g.b2].forEach(p => { const k = 0.08; seg(ctx, [p[0] - (g.u[0] - g.n[0]) * k, p[1] - (g.u[1] - g.n[1]) * k], [p[0] + (g.u[0] - g.n[0]) * k, p[1] + (g.u[1] - g.n[1]) * k], v); });
      label(ctx, A.fmt(g.len) + ' m', [(g.a2[0] + g.b2[0]) / 2, (g.a2[1] + g.b2[1]) / 2], Math.atan2(g.u[1], g.u[0]), v, c, Math.max(10, Math.min(16, 0.2 * v.s))); });
    items.filter(i => i.t === 'col').forEach(c => { const k = col(c); ctx.fillStyle = k; ctx.strokeStyle = k; ctx.globalAlpha = 0.85; poly(ctx, A.colPoly(c), v); ctx.fill(); ctx.globalAlpha = 1; ctx.lineWidth = 1; ctx.stroke(); });
    items.filter(i => i.t === 'beam').forEach(b => { ctx.strokeStyle = col(b); ctx.lineWidth = 3; ctx.setLineDash([9, 5]); seg(ctx, b.a, b.b, v); ctx.setLineDash([]); });
    if (opts.struct && A.struct) A.struct.overlay(ctx, v, th);
    items.filter(i => i.t === 'furn').forEach(f => { const c = col(f), P = A.furnPoly(f), q = A.toScreen(f.p, v); ctx.fillStyle = c; ctx.strokeStyle = c; ctx.globalAlpha = 0.14; poly(ctx, P, v); ctx.fill(); ctx.globalAlpha = 1; ctx.lineWidth = 1.2; poly(ctx, P, v); ctx.stroke();
      const px = Math.min(13, Math.min(f.w, f.d) * v.s * 0.4); if (px >= 7) { ctx.font = `${px}px Inter, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText((A.FURN[f.kind] || [f.kind])[0], q[0], q[1]); } });
    items.filter(i => i.t === 'text').forEach(t => { const q = A.toScreen(t.p, v); ctx.fillStyle = th.ink || col(t); ctx.font = `${Math.max(6, t.size * v.s)}px Inter, system-ui, sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(t.s, q[0], q[1]); });

    // selection
    ctx.lineWidth = 2; ctx.strokeStyle = th.sel; ctx.fillStyle = th.sel;
    (opts.sel || []).map(A.item).filter(Boolean).forEach(it => {
      if (it.t === 'wall') poly(ctx, A.wallGeom(it).poly, v); else if (A.isOpening(it)) { const r = A.openRect(it); if (!r) return; poly(ctx, r.pts, v); }
      else if (it.t === 'furn') poly(ctx, A.furnPoly(it), v);
      else if (it.t === 'col') poly(ctx, A.colPoly(it), v);
      else if (it.t === 'text') { const b = A.textBox(it); poly(ctx, [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]], v); }
      else if (it.t === 'dim') { const g = A.dimGeom(it); seg(ctx, g.a2, g.b2, v); return; } else { seg(ctx, it.a, it.b, v); return; }
      ctx.stroke(); });
    if (opts.sel && opts.sel.length === 1) { const it = A.item(opts.sel[0]); if (it && !A.isOpening(it) && it.t !== 'text') A.endpoints(it).forEach(p => { const q = A.toScreen(p, v); ctx.fillStyle = '#fff'; ctx.strokeStyle = th.sel; ctx.lineWidth = 1.5; ctx.fillRect(q[0] - 4, q[1] - 4, 8, 8); ctx.strokeRect(q[0] - 4, q[1] - 4, 8, 8); }); }

    // tool preview
    const pv = opts.pv; if (pv) { ctx.globalAlpha = 0.85; ctx.strokeStyle = th.pv; ctx.fillStyle = th.pv; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
      (pv.walls || []).forEach(w => { const g = A.wallGeom({ a: w.a, b: w.b, th: w.th, id: '_pv' }); ctx.globalAlpha = 0.3; poly(ctx, g.poly, v); ctx.fill(); ctx.globalAlpha = 0.85; ctx.stroke(); });
      (pv.lines || []).forEach(l => seg(ctx, l[0], l[1], v));
      if (pv.rect) { poly(ctx, pv.rect, v); ctx.stroke(); }
      if (pv.open) { ctx.setLineDash([]); poly(ctx, pv.open, v); ctx.globalAlpha = 0.4; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke(); }
      ctx.setLineDash([]); ctx.globalAlpha = 1;
      if (pv.label) { const q = A.toScreen(pv.label.p, v); ctx.font = '13px Inter, system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; const tw = ctx.measureText(pv.label.text).width;
        ctx.fillStyle = 'rgba(14,20,32,.85)'; ctx.fillRect(q[0] + 10, q[1] - 30, tw + 10, 20); ctx.fillStyle = th.pv; ctx.fillText(pv.label.text, q[0] + 15, q[1] - 14); } }
    if (opts.snap) { const q = A.toScreen(opts.snap.p, v); ctx.strokeStyle = opts.snap.kind === 'end' ? '#7cffb0' : opts.snap.kind === 'mid' ? '#7cc4ff' : '#ffd27a'; ctx.lineWidth = 1.5;
      if (opts.snap.kind === 'end' || opts.snap.kind === 'mid') ctx.strokeRect(q[0] - 6, q[1] - 6, 12, 12); else { ctx.beginPath(); ctx.moveTo(q[0] - 6, q[1]); ctx.lineTo(q[0] + 6, q[1]); ctx.moveTo(q[0], q[1] - 6); ctx.lineTo(q[0], q[1] + 6); ctx.stroke(); } }
  };
})();
