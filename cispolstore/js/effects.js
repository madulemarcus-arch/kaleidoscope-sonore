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
  // animated sky: twinkling stars, drifting glows and a Starlink-like train of satellites now and then.
  // Two layers share one 30 fps loop: a page-wide canvas behind the dashboard and a small one inside the hero card (the amount)
  const sky = (() => {
    let raf = 0, last = 0, page = null, hero = null;
    const want = () => App.state.view === 'home' && App.db.settings.sky !== false && !reduce() && !document.hidden && !(navigator.connection && navigator.connection.saveData);
    const dark = () => { const m = /\d+/g, c = (getComputedStyle(document.body).backgroundColor.match(m) || [255, 255, 255]).map(Number); return (c[0] * 299 + c[1] * 587 + c[2] * 114) / 1000 < 128; };
    // a layer owns a canvas; dens = pixels per star, gap = ms between satellite trains
    const mk = (cv, o) => ({ cv, g: cv.getContext('2d'), W: 0, H: 0, stars: [], sat: null, next: performance.now() + o.first, ...o });
    const size = (l, w, h) => { const dpr = Math.min(2, window.devicePixelRatio || 1); l.W = w; l.H = h; l.cv.width = Math.max(1, w * dpr); l.cv.height = Math.max(1, h * dpr); l.g.setTransform(dpr, 0, 0, dpr, 0, 0);
      l.stars = Array.from({ length: Math.min(l.max, Math.round(w * h / l.dens)) }, () => ({ x: Math.random() * w, y: Math.random() * h, r: l.r0 + Math.random() * l.r1, ph: Math.random() * 6.28, sp: .4 + Math.random() * .9 })); };
    const fit = l => l.hero ? size(l, l.cv.parentNode.clientWidth, l.cv.parentNode.clientHeight) : size(l, window.innerWidth, window.innerHeight);
    const launch = (l, t) => { const dir = Math.random() < .5 ? 1 : -1, sl = (Math.random() * .25 + .1) * (Math.random() < .5 ? 1 : -1), v = l.v + Math.random() * 14;
      l.sat = { x: dir > 0 ? -20 : l.W + 20, y: l.H * (.1 + Math.random() * (l.hero ? .5 : .4)), vx: v * dir, vy: v * sl, n: 5 }; l.next = t + l.gap + Math.random() * l.gap; };
    const draw = (l, now, dt) => { const { g, W, H } = l; g.clearRect(0, 0, W, H);
      l.glow.forEach((c, i) => { const t = now / 1000 * (.05 + i * .03), x = W * (.5 + .45 * Math.sin(t + i * 2)), y = H * (.45 + .4 * Math.cos(t * 1.3 + i)), R = Math.max(W, H) * .55, gr = g.createRadialGradient(x, y, 0, x, y, R); gr.addColorStop(0, `rgba(${c},${l.ga})`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(0, 0, W, H); });
      l.stars.forEach(s => { g.fillStyle = `rgba(${l.ink},${.3 + .6 * (.5 + .5 * Math.sin(now / 1000 * s.sp + s.ph))})`; g.beginPath(); g.arc(s.x, s.y, s.r, 0, 6.283); g.fill(); });
      if (!l.sat && now > l.next) launch(l, now);
      const s = l.sat; if (s) { s.x += s.vx * dt; s.y += s.vy * dt; const D = Math.hypot(s.vx, s.vy);
        for (let i = 0; i < s.n; i++) { g.fillStyle = `rgba(${l.ink},${.85 - i * .12})`; g.beginPath(); g.arc(s.x - s.vx / D * i * 20, s.y - s.vy / D * i * 20, l.hero ? 2.4 : 2.2, 0, 6.283); g.fill(); }
        if (s.x < -120 || s.x > l.W + 120 || s.y < -120 || s.y > l.H + 120) l.sat = null; } };
    const frame = now => {
      raf = requestAnimationFrame(frame);
      if (now - last < 33) return; const dt = Math.min(.1, (now - last) / 1000); last = now; // ~30 images/s keeps the phone cool
      if (hero && !hero.cv.isConnected) hero = null; // the screen was redrawn: its hero card is gone
      [page, hero].forEach(l => l && !l.cv.hidden && draw(l, now, dt));
    };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; if (page) page.cv.hidden = true; document.querySelectorAll('.hsky').forEach(x => x.remove()); hero = null; };
    const run = () => { const d = dark();
      if (!page) { const cv = document.createElement('canvas'); cv.id = 'sky'; cv.setAttribute('aria-hidden', 'true'); document.body.prepend(cv); page = mk(cv, { dens: 9000, max: 110, r0: 1, r1: 1.6, ga: .22, v: 38, gap: 10000, first: 2500 });
        window.addEventListener('resize', () => { fit(page); if (hero && hero.cv.isConnected) fit(hero); }); }
      page.cv.hidden = false; page.ink = d ? '255,255,255' : '30,90,168'; page.glow = d ? ['91,155,240', '157,133,255'] : ['30,90,168', '213,82,47']; if (page.W !== window.innerWidth || page.H !== window.innerHeight) fit(page);
      // hero card (the amount): always on a dark blue, so white stars, brighter and more frequent trains
      const h = document.querySelector('#view .hero'); if (h && !(hero && hero.cv.parentNode === h)) { h.querySelectorAll('.hsky').forEach(x => x.remove()); const cv = document.createElement('canvas'); cv.className = 'hsky'; cv.setAttribute('aria-hidden', 'true'); h.prepend(cv);
        hero = mk(cv, { hero: true, dens: 1500, max: 70, r0: .9, r1: 1.3, ga: .16, v: 30, gap: 6000, first: 1200, ink: '255,255,255', glow: ['91,155,240', '246,196,83'] }); fit(hero); }
      if (!raf) { last = 0; raf = requestAnimationFrame(frame); } };
    const sync = () => { if (want()) run(); else if (raf || (page && !page.cv.hidden)) stop(); };
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
