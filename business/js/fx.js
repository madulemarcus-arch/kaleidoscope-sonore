// Small delights: animated sky behind the home hero, count-up numbers, confetti, haptic tick. Everything respects « reduced motion ».
(function () {
  const App = window.App, reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches, fx = App.fx = {};
  fx.tick = () => { try { navigator.vibrate && navigator.vibrate(8); } catch (e) { } };
  // numbers that climb to their value (elements carry data-count="123.45" and keep their formatted text as the final state)
  fx.countUp = (el, to, fmt) => { if (reduce() || !(to > 0)) { el.textContent = fmt(to); return; } const t0 = performance.now(), d = 700; const step = now => { const k = Math.min(1, (now - t0) / d), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(to * e); if (k < 1 && el.isConnected) requestAnimationFrame(step); else el.textContent = fmt(to); }; requestAnimationFrame(step); };
  // confetti burst from the top of the screen
  fx.celebrate = msg => {
    if (msg) App.toast(msg); try { navigator.vibrate && navigator.vibrate([30, 40, 30]); } catch (e) { }
    if (reduce() || document.getElementById('confetti')) return;
    const cv = document.createElement('canvas'); cv.id = 'confetti'; cv.setAttribute('aria-hidden', 'true'); cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:80';
    const dpr = Math.min(2, devicePixelRatio || 1), W = innerWidth, H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; document.body.appendChild(cv); const g = cv.getContext('2d'); g.scale(dpr, dpr);
    const C = ['#d5522f', '#e5b044', '#1f9d55', '#2f7de1', '#7c5cff', '#ffffff'], ps = Array.from({ length: 110 }, () => ({ x: W / 2 + (Math.random() - .5) * W * .5, y: -10 - Math.random() * 60, vx: (Math.random() - .5) * 9, vy: 2 + Math.random() * 5, s: 5 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - .5) * .3, c: C[Math.floor(Math.random() * C.length)] })), t0 = performance.now();
    const step = now => { const k = (now - t0) / 1700; g.clearRect(0, 0, W, H); ps.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .12; p.vx *= .99; p.r += p.vr; g.save(); g.globalAlpha = Math.max(0, 1 - Math.max(0, k - .6) / .4); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * .6); g.restore(); }); if (k < 1) requestAnimationFrame(step); else cv.remove(); };
    requestAnimationFrame(step);
  };
  // a drifting network of points with a few twinkling stars and a glowing orbit; paused when hidden or removed
  fx.sky = host => {
    if (!host || host.querySelector('canvas.sky')) return; const cv = document.createElement('canvas'); cv.className = 'sky'; cv.setAttribute('aria-hidden', 'true'); host.prepend(cv); const g = cv.getContext('2d');
    let W = 0, H = 0, pts = [], dpr = Math.min(2, devicePixelRatio || 1), last = 0, raf = 0, visible = true;
    const init = () => { W = host.clientWidth; H = host.clientHeight; cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); const n = Math.max(18, Math.round(W * H / 5200)); pts = Array.from({ length: n }, (_, i) => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .22, vy: (Math.random() - .5) * .22, r: .6 + Math.random() * 1.3, star: i % 7 === 0, ph: Math.random() * 6.28, c: i % 11 === 0 ? '#f6c453' : i % 13 === 0 ? '#f08a5d' : '#ffffff' })); };
    const draw = t => {
      g.clearRect(0, 0, W, H); const L = Math.min(110, Math.max(70, W / 4));
      for (const p of pts) { p.x += p.vx; p.y += p.vy; if (p.x < -10) p.x = W + 10; if (p.x > W + 10) p.x = -10; if (p.y < -10) p.y = H + 10; if (p.y > H + 10) p.y = -10; }
      g.lineWidth = .6; for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { const a = pts[i], b = pts[j], d = Math.hypot(a.x - b.x, a.y - b.y); if (d < L) { g.strokeStyle = 'rgba(255,255,255,' + (.22 * (1 - d / L)) + ')'; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); } }
      for (const p of pts) { const tw = .55 + .45 * Math.sin(t / 700 + p.ph); g.globalAlpha = p.star ? tw : .8; g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.28); g.fill(); if (p.star) { g.strokeStyle = p.c; g.lineWidth = .8; g.beginPath(); g.moveTo(p.x - 4 * tw, p.y); g.lineTo(p.x + 4 * tw, p.y); g.moveTo(p.x, p.y - 4 * tw); g.lineTo(p.x, p.y + 4 * tw); g.stroke(); } } g.globalAlpha = 1;
      // orbit: a dotted ellipse with a glowing planet
      const cx = W * .55, cy = H * .55, rx = W * .52, ry = H * .3; g.save(); g.translate(cx, cy); g.rotate(-.32); g.setLineDash([2, 7]); g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 1; g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, 6.28); g.stroke(); g.setLineDash([]);
      const a = t / 5200, px = Math.cos(a) * rx, py = Math.sin(a) * ry, gr = g.createRadialGradient(px, py, 0, px, py, 12); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(.35, 'rgba(120,190,255,.55)'); gr.addColorStop(1, 'rgba(120,190,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(px, py, 12, 0, 6.28); g.fill(); g.restore();
    };
    const loop = t => { if (!cv.isConnected) return; raf = requestAnimationFrame(loop); if (!visible || document.hidden || t - last < 33) return; last = t; draw(t); };
    init(); draw(0); if (!reduce()) raf = requestAnimationFrame(loop);
    if ('IntersectionObserver' in window) new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(host); if ('ResizeObserver' in window) new ResizeObserver(() => { if (host.clientWidth !== W || host.clientHeight !== H) { init(); draw(0); } }).observe(host);
  };
})();
