// Small delights: confetti, haptic tick, count-up numbers, greeting and achievement badges
(() => {
  const App = window.App, reduce = () => window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  const COL = ['#e4572e', '#f6c453', '#1f9d55', '#2f7de1', '#7c5cff', '#ffffff'];
  App.tick = () => { try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {} };
  // confetti burst from the top of the screen
  App.celebrate = msg => {
    if (msg) App.toast(msg);
    try { if (navigator.vibrate) navigator.vibrate([30, 40, 30]); } catch (e) {}
    if (reduce() || document.getElementById('confetti')) return;
    const cv = document.createElement('canvas'); cv.id = 'confetti'; cv.setAttribute('aria-hidden', 'true');
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = window.innerWidth, H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; document.body.appendChild(cv);
    const g = cv.getContext('2d'); g.scale(dpr, dpr);
    const ps = Array.from({ length: 110 }, () => ({ x: W / 2 + (Math.random() - .5) * W * .5, y: -10 - Math.random() * 60, vx: (Math.random() - .5) * 9, vy: 2 + Math.random() * 5, s: 5 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: COL[Math.floor(Math.random() * COL.length)] }));
    const t0 = performance.now();
    const step = now => {
      const k = (now - t0) / 1700; g.clearRect(0, 0, W, H);
      ps.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .12; p.vx *= .99; p.r += p.vr; g.save(); g.globalAlpha = Math.max(0, 1 - Math.max(0, k - .6) / .4); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); g.restore(); });
      if (k < 1) requestAnimationFrame(step); else cv.remove();
    };
    requestAnimationFrame(step);
  };
  // animated sky behind the dashboard: twinkling stars and a Starlink-like train of satellites now and then
  const sky = (() => {
    let cv, g, W = 0, H = 0, stars = [], sat = null, nextSat = 0, raf = 0, last = 0, ink = '255,255,255', glow = ['91,155,240', '157,133,255'];
    const want = () => App.state.view === 'home' && App.db.settings.sky !== false && !reduce() && !document.hidden && !(navigator.connection && navigator.connection.saveData);
    const dark = () => { const m = /\d+/g, c = (getComputedStyle(document.body).backgroundColor.match(m) || [255, 255, 255]).map(Number); return (c[0] * 299 + c[1] * 587 + c[2] * 114) / 1000 < 128; };
    const size = () => { const dpr = Math.min(2, window.devicePixelRatio || 1); W = window.innerWidth; H = window.innerHeight; cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = Array.from({ length: Math.min(110, Math.round(W * H / 9000)) }, () => ({ x: Math.random() * W, y: Math.random() * H, r: 1 + Math.random() * 1.6, ph: Math.random() * 6.28, sp: .4 + Math.random() * .9 })); };
    const launch = t => { const dir = Math.random() < .5 ? 1 : -1, y0 = H * (.1 + Math.random() * .4), sl = (Math.random() * .25 + .1) * (Math.random() < .5 ? 1 : -1), v = 38 + Math.random() * 14;
      sat = { x: dir > 0 ? -20 : W + 20, y: y0, vx: v * dir, vy: v * sl, n: 5, born: t }; nextSat = t + 10000 + Math.random() * 12000; };
    const frame = now => {
      raf = requestAnimationFrame(frame);
      if (now - last < 33) return; const dt = Math.min(.1, (now - last) / 1000); last = now; // ~30 images/s keeps the phone cool
      g.clearRect(0, 0, W, H);
      glow.forEach((c, i) => { const t = now / 1000 * (.05 + i * .03), x = W * (.5 + .45 * Math.sin(t + i * 2)), y = H * (.45 + .4 * Math.cos(t * 1.3 + i)), R = Math.max(W, H) * .55, gr = g.createRadialGradient(x, y, 0, x, y, R); gr.addColorStop(0, `rgba(${c},.22)`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(0, 0, W, H); }); // slow drifting glows
      stars.forEach(s => { const a = .3 + .6 * (.5 + .5 * Math.sin(now / 1000 * s.sp + s.ph)); g.fillStyle = `rgba(${ink},${a})`; g.beginPath(); g.arc(s.x, s.y, s.r, 0, 6.283); g.fill(); });
      if (!sat && now > nextSat) launch(now);
      if (sat) { sat.x += sat.vx * dt; sat.y += sat.vy * dt; const L = Math.hypot(sat.vx, sat.vy);
        for (let i = 0; i < sat.n; i++) { const x = sat.x - sat.vx / L * i * 20, y = sat.y - sat.vy / L * i * 20; g.fillStyle = `rgba(${ink},${.85 - i * .12})`; g.beginPath(); g.arc(x, y, 2.2, 0, 6.283); g.fill(); }
        if (sat.x < -120 || sat.x > W + 120 || sat.y < -120 || sat.y > H + 120) sat = null; }
    };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; if (cv) cv.hidden = true; };
    const run = () => { if (!cv) { cv = document.createElement('canvas'); cv.id = 'sky'; cv.setAttribute('aria-hidden', 'true'); document.body.prepend(cv); g = cv.getContext('2d'); size(); window.addEventListener('resize', () => cv && !cv.hidden && size()); }
      cv.hidden = false; const d = dark(); ink = d ? '255,255,255' : '30,90,168'; glow = d ? ['91,155,240', '157,133,255'] : ['30,90,168', '213,82,47']; if (!W || W !== window.innerWidth || H !== window.innerHeight) size(); if (!raf) { nextSat = performance.now() + 2500; last = 0; raf = requestAnimationFrame(frame); } };
    const sync = () => { if (want()) run(); else if (raf || (cv && !cv.hidden)) stop(); };
    document.addEventListener('visibilitychange', sync);
    return sync;
  })();
  App.sky = sky;
  // loading pill with a spinner for slow work (reading a file, building a PDF); returns the function that hides it
  App.busy = msg => { const el = document.createElement('div'); el.className = 'busy'; el.setAttribute('role', 'status'); el.innerHTML = `<i></i>${App.esc(msg || 'Un instant…')}`; document.body.appendChild(el); return () => el.remove(); };
  App.greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Bonjour ☀️' : h < 18 ? 'Bon après-midi 🌤️' : 'Bonsoir 🌙'; };

  // achievements: [id, icon, label, reached]
  const SER = [['c', '👥', 'clients', [10, 50, 100, 250], () => App.db.clients.length], ['f', '🧾', 'factures', [10, 50, 100, 250], () => App.db.invoices.length]];
  App.badges = () => {
    const out = [];
    SER.forEach(([k, ico, lab, ths, cnt]) => { const n = cnt(); let nextDone = false; ths.forEach(t => { const ok = n >= t; if (ok || !nextDone) { out.push({ id: k + t, ico, label: `${t} ${lab}`, ok }); if (!ok) nextDone = true; } }); });
    return out;
  };
  const LS = 'cispolstore-badges';
  // celebrates a newly earned badge (silent the very first time, so existing data does not fire confetti)
  App.checkBadges = (extra) => {
    try {
      const earned = App.badges().filter(b => b.ok).map(b => b.id).concat(extra || []), raw = localStorage.getItem(LS);
      if (raw === null) { localStorage.setItem(LS, JSON.stringify(earned)); return; }
      const old = JSON.parse(raw), fresh = earned.filter(x => !old.includes(x));
      if (!fresh.length) return;
      localStorage.setItem(LS, JSON.stringify(old.concat(fresh)));
      const b = App.badges().filter(x => fresh.includes(x.id)).pop();
      App.celebrate(b ? `🏆 Bravo ! ${b.label}` : '🎯 Objectif du mois atteint !');
    } catch (e) {}
  };
  App.badgesHtml = () => { const bs = App.badges(); return bs.length ? `<div class="badges" aria-label="Vos réussites">${bs.map(b => `<span class="bdg ${b.ok ? 'on' : ''}" title="${b.ok ? 'Obtenu' : 'À débloquer'}"><i>${b.ico}</i>${b.label}</span>`).join('')}</div>` : ''; };

  // count-up for every [data-count] number that appears in the view
  const run = el => {
    if (el.dataset.counted) return; el.dataset.counted = '1';
    if (reduce()) return;
    const to = +el.dataset.count, t0 = performance.now();
    const step = now => { const k = Math.min(1, (now - t0) / 700), e = 1 - Math.pow(1 - k, 3); el.textContent = el.dataset.int ? Math.round(to * e) : App.fmt(to * e); if (k < 1 && document.body.contains(el)) requestAnimationFrame(step); else el.textContent = el.dataset.int ? to : App.fmt(to); };
    requestAnimationFrame(step);
  };
  const v = document.getElementById('view');
  if (v) new MutationObserver(() => v.querySelectorAll('[data-count]:not([data-counted])').forEach(run)).observe(v, { childList: true, subtree: true });
  // subtle tick on navigation and the + button
  document.addEventListener('click', e => { if (e.target.closest('#bottom a, #bottom button, #fab')) App.tick(); }, true);
})();
