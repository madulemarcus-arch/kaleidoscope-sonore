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
  // One place sets the colours, the tempo and the quantity of effects, so that the sky, the glows, the photo cards and the card itself stay coherent.
  //  - colours: three harmonised shades per decor (a = main, b = accent, c = highlight); nothing is drawn outside this palette
  //  - rhythm: one tempo that scales every speed (stars, scenes, glows, photo cards, CSS sheen and sweep)
  //  - quantity: one density that scales the stars, links, soft lights, scene frequency and cards; photos on screen lower it so the card is never overloaded
  const LEVELS = { calm: { tempo: .7, dens: .6, gap: 1.7 }, balanced: { tempo: 1, dens: 1, gap: 1 }, intense: { tempo: 1.35, dens: 1.4, gap: .7 } };
  const PAL = { def: { a: '120,190,255', b: '229,176,68', c: '236,106,64' }, sunset: { a: '255,150,90', b: '246,196,83', c: '255,110,150' }, night: { a: '110,150,255', b: '62,198,255', c: '170,150,255' },
    aurora: { a: '70,220,160', b: '62,198,255', c: '150,120,255' }, starlink: { a: '205,228,255', b: '62,198,255', c: '160,140,255' } };
  const F = App.fx = { LEVELS, PAL, level: () => LEVELS[App.db.settings.fx] || LEVELS.balanced, decor: () => PAL[App.db.settings.decor] ? App.db.settings.decor : 'def', pal: () => PAL[F.decor()],
    photos: () => { const S = App.db.settings; return S.decor === 'starlink' || (S.decor === 'photos' && (S.bgs || []).length > 0); },
    sig: () => (App.db.settings.fx || 'balanced') + '|' + F.decor() + '|' + (F.photos() ? 1 : 0),
    paint: () => { const h = document.querySelector('#view .hero'); if (!h) return; const p = F.pal(); h.style.setProperty('--fa', p.a); h.style.setProperty('--fb', p.b); h.style.setProperty('--fc', p.c); h.style.setProperty('--tempo', F.level().tempo); } };
  // animated sky, modern look: depth-layered twinkling stars linked like a network, additive neon glows in the brand colours,
  // and a changing sequence of scenes (satellite train, meteor shower, comet, WiFi rings, orbits, light pulse).
  // Two layers share one 30 fps loop: a page-wide canvas behind the dashboard and a small one inside the hero card (the amount).
  const sky = (() => {
    let raf = 0, last = 0, page = null, hero = null;
    const C = { white: '255,255,255' }, rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)], col = () => { const p = F.pal(), r = Math.random(); return r < .55 ? p.a : r < .88 ? p.b : p.c; }, budget = l => F.level().dens * (F.photos() ? .65 : 1) * l.w;
    // soft glowing orb, drawn once per colour then scaled (cheap)
    const SPR = new Map(), sprite = rgb => { let c = SPR.get(rgb); if (c) return c; c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.16, `rgba(${rgb},.85)`); gr.addColorStop(.45, `rgba(${rgb},.2)`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); SPR.set(rgb, c); return c; };
    const orb = (g, rgb, x, y, r, a) => { g.globalAlpha = Math.max(0, Math.min(1, a)); g.drawImage(sprite(rgb), x - r, y - r, r * 2, r * 2); g.globalAlpha = 1; };
    const want = () => App.state.view === 'home' && App.db.settings.sky !== false && !reduce() && !document.hidden && !(navigator.connection && navigator.connection.saveData);
    const dark = () => { const m = /\d+/g, c = (getComputedStyle(document.body).backgroundColor.match(m) || [255, 255, 255]).map(Number); return (c[0] * 299 + c[1] * 587 + c[2] * 114) / 1000 < 128; };
    // a layer owns a canvas; dens = pixels per star, gap = ms between scenes, link = distance of the network lines
    const mk = (cv, o) => ({ cv, g: cv.getContext('2d'), W: 0, H: 0, stars: [], bokeh: [], sat: null, shots: [], rings: [], orbit: null, pulse: 0, scene: '', next: performance.now() + o.first, ...o });
    const size = (l, w, h) => { const dpr = Math.min(2, window.devicePixelRatio || 1); l.W = w; l.H = h; l.cv.width = Math.max(1, w * dpr); l.cv.height = Math.max(1, h * dpr); l.g.setTransform(dpr, 0, 0, dpr, 0, 0);
      l.sig = F.sig(); l.L = l.link * (.8 + .2 * Math.min(1.4, budget(l))); l.stars = Array.from({ length: Math.min(Math.round(l.max * Math.max(1, F.level().dens)), Math.round(w * h / l.dens * budget(l))) }, () => { const z = pick([.45, .75, 1]); return { x: Math.random() * w, y: Math.random() * h, z, r: l.r0 * (.55 + .6 * z) + Math.random() * l.r1 * z, ph: Math.random() * 6.28, sp: 1.2 + Math.random() * 3, dx: (Math.random() - .5) * 34 * z, dy: (Math.random() - .5) * 18 * z, tint: Math.random() < .2 ? col() : null, big: Math.random() < .12 }; });
      l.bokeh = Array.from({ length: Math.max(2, Math.round((l.hero ? 5 : 7) * budget(l))) }, () => ({ x: Math.random() * w, y: Math.random() * h, r: rnd(28, 72), vx: rnd(-9, 9), vy: rnd(-5, 5), rgb: col(), a: rnd(.05, .11) })); };
    const fit = l => l.hero ? size(l, l.cv.parentNode.clientWidth, l.cv.parentNode.clientHeight) : size(l, window.innerWidth, window.innerHeight);
    // scenes: one event is picked at random each time (never the same twice in a row) so the sky keeps changing
    const SCENES = ['train', 'shower', 'rings', 'comet', 'pulse', 'orbit', 'train', 'shower', 'orbit'];
    const shot = (l, at, big, c) => { const dir = Math.random() < .5 ? 1 : -1, v = (big ? 560 : 420) + Math.random() * 160; return { at, x: Math.random() * l.W, y: -10, vx: v * .55 * dir, vy: v * .8, len: big ? 150 : 85, w: big ? 3.4 : 2.2, c }; };
    const spawn = (l, t) => { let k; do k = pick(SCENES); while (k === l.scene); l.scene = k; const c = col();
      if (k === 'train') { const dir = Math.random() < .5 ? 1 : -1, sl = (Math.random() * .25 + .1) * (Math.random() < .5 ? 1 : -1), v = l.v + Math.random() * 40;
        l.sat = { x: dir > 0 ? -20 : l.W + 20, y: l.H * (.1 + Math.random() * (l.hero ? .5 : .4)), vx: v * dir, vy: v * sl, n: 7, c }; }
      else if (k === 'shower') for (let i = 0; i < 7; i++) l.shots.push(shot(l, t + i * 240, false, c));
      else if (k === 'comet') l.shots.push(shot(l, t, true, c));
      else if (k === 'rings') { const x = Math.random() * l.W, y = Math.random() * l.H; for (let i = 0; i < 4; i++) l.rings.push({ x, y, at: t + i * 330, c }); } // WiFi-like waves
      else if (k === 'orbit') l.orbit = { t0: t, dur: 6800, cx: l.W * rnd(.4, .6), cy: l.H * rnd(.4, .6), rx: l.W * rnd(.3, .42), ry: l.H * rnd(.2, .3), rot: rnd(-.5, .5), c };
      else l.pulse = t; // a wave of light sweeps the stars
      l.next = t + (l.gap + Math.random() * l.gap) * F.level().gap * (F.photos() ? 1.4 : 1); };
    const draw = (l, now, dt, T) => { const { g, W, H } = l, gaF = F.photos() ? .8 : 1; g.clearRect(0, 0, W, H); g.globalCompositeOperation = 'lighter'; // additive light
      l.glow.forEach((c, i) => { const t = now / 1000 * (.22 + i * .1) * T, x = W * (.5 + .45 * Math.sin(t + i * 2)), y = H * (.45 + .4 * Math.cos(t * 1.3 + i)), R = Math.max(W, H) * .6, gr = g.createRadialGradient(x, y, 0, x, y, R); gr.addColorStop(0, `rgba(${c},${(l.ga * gaF).toFixed(3)})`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(0, 0, W, H); });
      l.bokeh.forEach(b => { b.x = (b.x + b.vx * dt + W) % W; b.y = (b.y + b.vy * dt + H) % H; orb(g, b.rgb, b.x, b.y, b.r, b.a * (.7 + .3 * Math.sin(now / 1500 + b.r))); }); // big soft lights drifting slowly
      const pp = l.pulse ? (now - l.pulse) / 1000 : -1; if (pp > 1.4) l.pulse = 0;
      const st = l.stars, n = Math.min(48, st.length), L = l.L;
      st.forEach(s => { s.x = (s.x + s.dx * dt + W) % W; s.y = (s.y + s.dy * dt + H) % H; });
      g.lineWidth = .7; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const dx = st[i].x - st[j].x, dy = st[i].y - st[j].y, d2 = dx * dx + dy * dy; if (d2 < L * L) { g.strokeStyle = `rgba(${l.ink},${((1 - Math.sqrt(d2) / L) * .24).toFixed(3)})`; g.beginPath(); g.moveTo(st[i].x, st[i].y); g.lineTo(st[j].x, st[j].y); g.stroke(); } } // network
      st.forEach(s => { const tw = .5 + .5 * Math.sin(now / 1000 * s.sp * T + s.ph), b = pp >= 0 ? Math.max(0, 1 - Math.abs(s.x / W - pp / 1.2) * 5) : 0, a = Math.min(1, (.25 + .75 * tw + b) * (.45 + .55 * s.z)), rgb = s.tint || l.ink, r = s.r * (1 + b * 1.4);
        if (s.big) { orb(g, rgb, s.x, s.y, r * 7, a * .6); g.strokeStyle = `rgba(${rgb},${(a * .55).toFixed(3)})`; g.lineWidth = .8; const k = r * (3 + 4 * tw); g.beginPath(); g.moveTo(s.x - k, s.y); g.lineTo(s.x + k, s.y); g.moveTo(s.x, s.y - k); g.lineTo(s.x, s.y + k); g.stroke(); }
        g.fillStyle = `rgba(${rgb},${a.toFixed(3)})`; g.beginPath(); g.arc(s.x, s.y, r, 0, 6.283); g.fill(); });
      if (!l.sat && !l.shots.length && !l.rings.length && !l.orbit && !l.pulse && now > l.next) spawn(l, now);
      l.rings = l.rings.filter(r => { const rad = (now - r.at) / 1000 * 240 * T, mx = Math.max(W, H) * .5; if (rad < 0) return true; if (rad > mx) return false; const k = 1 - rad / mx;
        if (rad < 60) orb(g, r.c, r.x, r.y, 26 * (1 - rad / 60) + 6, .9); g.strokeStyle = `rgba(${r.c},${(.85 * k).toFixed(3)})`; g.lineWidth = 2.4; g.beginPath(); g.arc(r.x, r.y, rad, 0, 6.283); g.stroke();
        g.strokeStyle = `rgba(255,255,255,${(.35 * k).toFixed(3)})`; g.lineWidth = .8; g.beginPath(); g.arc(r.x, r.y, rad + 5, 0, 6.283); g.stroke(); return true; });
      const o = l.orbit; if (o) { const age = now - o.t0; if (age > o.dur) l.orbit = null; else { const e = Math.min(1, age / 700, (o.dur - age) / 900), cr = Math.cos(o.rot), sr = Math.sin(o.rot), pt = th => [o.cx + o.rx * Math.cos(th) * cr - o.ry * Math.sin(th) * sr, o.cy + o.rx * Math.cos(th) * sr + o.ry * Math.sin(th) * cr];
        g.setLineDash([3, 9]); g.strokeStyle = `rgba(${o.c},${(.3 * e).toFixed(3)})`; g.lineWidth = 1; g.beginPath(); g.ellipse(o.cx, o.cy, o.rx, o.ry, o.rot, 0, 6.283); g.stroke(); g.setLineDash([]);
        [0, 3.1416].forEach(ph => { const th = age / 1000 * 1.5 * T + ph; for (let k = 16; k >= 0; k--) { const [x, y] = pt(th - k * .085), f = (1 - k / 17) * e; orb(g, o.c, x, y, 3 + 11 * f * (k ? .35 : 1), f * (k ? .55 : 1)); } const [hx, hy] = pt(th); g.fillStyle = `rgba(255,255,255,${e.toFixed(3)})`; g.beginPath(); g.arc(hx, hy, 2.4, 0, 6.283); g.fill(); }); } }
      l.shots = l.shots.filter(sh => { if (now < sh.at) return true; sh.x += sh.vx * dt; sh.y += sh.vy * dt; const D = Math.hypot(sh.vx, sh.vy), tx = sh.x - sh.vx / D * sh.len, ty = sh.y - sh.vy / D * sh.len, gr = g.createLinearGradient(sh.x, sh.y, tx, ty);
        gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, `rgba(${sh.c},.7)`); gr.addColorStop(1, `rgba(${sh.c},0)`); g.strokeStyle = gr; g.lineWidth = sh.w; g.lineCap = 'round'; g.beginPath(); g.moveTo(sh.x, sh.y); g.lineTo(tx, ty); g.stroke(); orb(g, sh.c, sh.x, sh.y, sh.w * 5, .9); return sh.y < H + 80 && sh.x > -80 && sh.x < W + 80; });
      const s = l.sat; if (s) { s.x += s.vx * dt; s.y += s.vy * dt; const D = Math.hypot(s.vx, s.vy), tl = s.n * 22, gr = g.createLinearGradient(s.x, s.y, s.x - s.vx / D * tl, s.y - s.vy / D * tl);
        gr.addColorStop(0, `rgba(${s.c},.55)`); gr.addColorStop(1, `rgba(${s.c},0)`); g.strokeStyle = gr; g.lineWidth = 1.4; g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(s.x - s.vx / D * tl, s.y - s.vy / D * tl); g.stroke();
        for (let i = 0; i < s.n; i++) { const x = s.x - s.vx / D * i * 22, y = s.y - s.vy / D * i * 22, f = 1 - i * .11; orb(g, s.c, x, y, 15 * f, .75 * f); g.fillStyle = `rgba(255,255,255,${f.toFixed(2)})`; g.beginPath(); g.arc(x, y, 2.3, 0, 6.283); g.fill(); }
        if (s.x < -120 || s.x > l.W + 120 || s.y < -120 || s.y > l.H + 120) l.sat = null; }
      g.globalCompositeOperation = 'source-over'; };
    const frame = now => {
      raf = requestAnimationFrame(frame);
      if (now - last < 33) return; const dt = Math.min(.1, (now - last) / 1000); last = now; // ~30 images/s keeps the phone cool
      if (hero && !hero.cv.isConnected) hero = null; // the screen was redrawn: its hero card is gone
      const T = F.level().tempo; [page, hero].forEach(l => l && !l.cv.hidden && draw(l, now, dt * T, T));
    };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; if (page) page.cv.hidden = true; document.querySelectorAll('.hsky').forEach(x => x.remove()); document.querySelectorAll('.hero.hanim').forEach(x => x.classList.remove('hanim')); hero = null; };
    const run = () => { const d = dark();
      if (!page) { const cv = document.createElement('canvas'); cv.id = 'sky'; cv.setAttribute('aria-hidden', 'true'); document.body.prepend(cv); page = mk(cv, { w: .7, dens: 6500, max: 120, r0: .6, r1: 1.1, ga: .26, v: 170, gap: 3000, first: 1200, link: 110 });
        window.addEventListener('resize', () => { fit(page); if (hero && hero.cv.isConnected) fit(hero); }); }
      page.cv.hidden = false; page.ink = d ? '255,255,255' : '30,90,168'; const pl = F.pal(); page.glow = d ? [pl.a, pl.b] : ['30,90,168', '213,82,47']; if (page.W !== window.innerWidth || page.H !== window.innerHeight || page.sig !== F.sig()) fit(page);
      // hero card (the amount): always on a dark blue, so white stars and brighter neon
      const h = document.querySelector('#view .hero'); if (h) { h.classList.add('hanim'); F.paint(); } if (h && hero && hero.cv.parentNode === h && hero.sig !== F.sig()) fit(hero); if (h && !(hero && hero.cv.parentNode === h)) { h.querySelectorAll('.hsky').forEach(x => x.remove()); const cv = document.createElement('canvas'); cv.className = 'hsky'; cv.setAttribute('aria-hidden', 'true'); h.prepend(cv);
        hero = mk(cv, { hero: true, w: 1, dens: 1100, max: 80, r0: .7, r1: 1.2, ga: .3, v: 150, gap: 2200, first: 600, link: 88, ink: '255,255,255', glow: [] }); fit(hero); }
      if (hero) { const pl = F.pal(); hero.glow = [pl.a, pl.b, pl.c]; }
      if (!raf) { last = 0; raf = requestAnimationFrame(frame); } };
    const sync = () => { if (want()) run(); else if (raf || (page && !page.cv.hidden)) stop(); };
    document.addEventListener('visibilitychange', sync);
    sync.scene = () => (hero && hero.scene) || ''; // current scene of the hero card (read by the tests)
    sync.stats = () => hero ? { stars: hero.stars.length, link: Math.round(hero.L), bokeh: hero.bokeh.length, glow: hero.glow.slice(), tempo: F.level().tempo, gap: F.level().gap } : null;
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
