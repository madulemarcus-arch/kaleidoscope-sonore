// NZIMBU animations, in the spirit of CISPOLstore Manager: a golden sky (twinkling stars linked like a network, drifting glows,
// a changing sequence of scenes such as a coin rain), a sparkle layer inside the header, count-up numbers, a coin confetti,
// a gallery band of money photos gliding in random directions (like the photo cards of CISPOLstore), a small haptic tick and a toast. Everything stops when the screen is locked or hidden, with "reduce motion" or data saver.
(() => {
  'use strict';
  const KEY = 'budget-fx-v1', root = document.documentElement;
  const reduceQ = matchMedia('(prefers-reduced-motion: reduce)'), darkQ = matchMedia('(prefers-color-scheme: dark)');
  const LEVELS = { calm: { tempo: .7, dens: .6, gap: 1.7 }, balanced: { tempo: 1, dens: 1, gap: 1 } };
  const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
  const mode = () => { try { return localStorage.getItem(KEY) || 'balanced'; } catch (e) { return 'balanced'; } };
  const level = () => LEVELS[mode()] || LEVELS.balanced;
  const animated = () => mode() !== 'off' && !reduceQ.matches;
  const canRun = () => animated() && !document.hidden && !root.classList.contains('locked') && !(navigator.connection && navigator.connection.saveData);
  const sig = () => mode() + '|' + (darkQ.matches ? 1 : 0);

  // Palettes: on a dark page the light is additive; on a light page darker golds are painted normally
  const PAL = {
    dark: { a: '245,197,66', b: '255,154,61', hi: '255,236,170', ink: '255,236,170', core: '255,255,255', add: true, glow: ['245,197,66', '255,154,61'] },
    light: { a: '214,152,28', b: '232,115,12', hi: '190,120,10', ink: '168,104,8', core: '140,80,5', add: false, glow: ['245,197,66', '232,115,12'] },
    hero: { a: '255,255,255', b: '255,244,200', hi: '255,255,255', ink: '255,255,255', core: '255,255,255', add: true, glow: ['255,255,255', '255,244,200'] }
  };
  const palette = l => l.hero ? PAL.hero : darkQ.matches ? PAL.dark : PAL.light;
  const col = l => { const p = palette(l), r = Math.random(); return r < .55 ? p.a : r < .88 ? p.b : p.hi; };

  // Soft glowing orb, drawn once per colour then scaled (cheap)
  const SPR = new Map();
  const sprite = (rgb, core) => {
    const k = rgb + '|' + core; let c = SPR.get(k); if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${core},1)`); gr.addColorStop(.16, `rgba(${rgb},.85)`); gr.addColorStop(.45, `rgba(${rgb},.2)`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); SPR.set(k, c); return c;
  };
  const orb = (l, rgb, x, y, r, a) => { l.g.globalAlpha = Math.max(0, Math.min(1, a)); l.g.drawImage(sprite(rgb, palette(l).core), x - r, y - r, r * 2, r * 2); l.g.globalAlpha = 1; };

  // A layer owns a canvas; dens = pixels per star, gap = ms between scenes, link = distance of the network lines
  const mk = (cv, o) => ({ cv, g: cv.getContext('2d'), W: 0, H: 0, stars: [], bokeh: [], coins: [], shots: [], rings: [], orbit: null, pulse: 0, scene: '', next: performance.now() + o.first, ...o });
  const size = (l, w, h) => {
    const dpr = Math.min(2, window.devicePixelRatio || 1), lv = level();
    l.W = w; l.H = h; l.cv.width = Math.max(1, w * dpr); l.cv.height = Math.max(1, h * dpr); l.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    l.sig = sig(); l.L = l.link * (.8 + .2 * Math.min(1.4, lv.dens));
    l.stars = Array.from({ length: Math.min(l.max, Math.round(w * h / l.dens * lv.dens)) }, () => {
      const z = pick([.45, .75, 1]);
      return { x: Math.random() * w, y: Math.random() * h, z, r: l.r0 * (.55 + .6 * z) + Math.random() * l.r1 * z, ph: Math.random() * 6.28, sp: 1.2 + Math.random() * 3, dx: (Math.random() - .5) * 30 * z, dy: (Math.random() - .5) * 16 * z, tint: Math.random() < .2 ? col(l) : null, big: Math.random() < .12 };
    });
    l.bokeh = Array.from({ length: Math.max(2, Math.round((l.hero ? 4 : 7) * lv.dens)) }, () => ({ x: Math.random() * w, y: Math.random() * h, r: rnd(28, 72), vx: rnd(-9, 9), vy: rnd(-5, 5), rgb: col(l), a: rnd(.06, .12) }));
  };
  const fit = l => l.hero ? size(l, l.cv.parentNode.clientWidth, l.cv.parentNode.clientHeight) : size(l, window.innerWidth, window.innerHeight);

  // Scenes: one event at random each time (never the same twice in a row) so the sky keeps changing
  const shot = (l, at, big, c) => { const dir = Math.random() < .5 ? 1 : -1, v = (big ? 560 : 420) + Math.random() * 160; return { at, x: Math.random() * l.W, y: -10, vx: v * .55 * dir, vy: v * .8, len: big ? 150 : 85, w: big ? 3.4 : 2.2, c }; };
  const spawn = (l, t) => {
    let k; do k = pick(l.scenes); while (k === l.scene && l.scenes.length > 1);
    l.scene = k; const c = col(l);
    if (k === 'coins') for (let i = 0; i < 14; i++) l.coins.push({ at: t + i * 230 + Math.random() * 120, x0: rnd(16, l.W - 16), y: -20, vy: rnd(110, 190), amp: rnd(8, 24), f: rnd(.8, 1.6), ph: Math.random() * 6.28, r: rnd(7, 12), spin: rnd(2, 4.5), sp0: Math.random() * 6.28 });
    else if (k === 'shower') for (let i = 0; i < 7; i++) l.shots.push(shot(l, t + i * 240, false, c));
    else if (k === 'comet') l.shots.push(shot(l, t, true, c));
    else if (k === 'rings') { const x = Math.random() * l.W, y = Math.random() * l.H; for (let i = 0; i < 4; i++) l.rings.push({ x, y, at: t + i * 330, c }); }
    else if (k === 'orbit') l.orbit = { t0: t, dur: 6800, cx: l.W * rnd(.4, .6), cy: l.H * rnd(.4, .6), rx: l.W * rnd(.3, .42), ry: l.H * rnd(.2, .3), rot: rnd(-.5, .5), c };
    else l.pulse = t; // a wave of light sweeps the stars
    l.next = t + (l.gap + Math.random() * l.gap) * level().gap;
  };

  const drawCoin = (g, c, now, alpha) => {
    const sx = Math.max(.16, Math.abs(Math.cos(c.sp0 + now / 1000 * c.spin)));
    g.save(); g.globalAlpha = alpha; g.translate(c.x, c.y);
    const gr = g.createLinearGradient(-c.r, -c.r, c.r, c.r); gr.addColorStop(0, '#fff1b8'); gr.addColorStop(.5, '#f2b632'); gr.addColorStop(1, '#c78310');
    g.fillStyle = gr; g.strokeStyle = '#a8680a'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(0, 0, c.r * sx, c.r, 0, 0, 6.283); g.fill(); g.stroke();
    if (sx > .5) { g.strokeStyle = 'rgba(255,245,200,.85)'; g.lineWidth = 1; g.beginPath(); g.ellipse(0, 0, c.r * sx * .68, c.r * .68, 0, 0, 6.283); g.stroke(); }
    g.restore();
  };

  const draw = (l, now, dt, T) => {
    const { g, W, H } = l, p = palette(l), L = l.L, st = l.stars, n = Math.min(40, st.length);
    g.clearRect(0, 0, W, H); g.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
    // big soft glows drifting
    p.glow.forEach((c, i) => { const t = now / 1000 * (.22 + i * .1) * T, x = W * (.5 + .45 * Math.sin(t + i * 2)), y = H * (.45 + .4 * Math.cos(t * 1.3 + i)), R = Math.max(W, H) * .6, gr = g.createRadialGradient(x, y, 0, x, y, R);
      gr.addColorStop(0, `rgba(${c},${l.ga})`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(0, 0, W, H); });
    l.bokeh.forEach(b => { b.x = (b.x + b.vx * dt + W) % W; b.y = (b.y + b.vy * dt + H) % H; orb(l, b.rgb, b.x, b.y, b.r, b.a * (.7 + .3 * Math.sin(now / 1500 + b.r))); });
    const pp = l.pulse ? (now - l.pulse) / 1000 : -1; if (pp > 1.4) l.pulse = 0;
    st.forEach(s => { s.x = (s.x + s.dx * dt + W) % W; s.y = (s.y + s.dy * dt + H) % H; });
    g.lineWidth = .7;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { // network
      const dx = st[i].x - st[j].x, dy = st[i].y - st[j].y, d2 = dx * dx + dy * dy;
      if (d2 < L * L) { g.strokeStyle = `rgba(${p.ink},${((1 - Math.sqrt(d2) / L) * .22).toFixed(3)})`; g.beginPath(); g.moveTo(st[i].x, st[i].y); g.lineTo(st[j].x, st[j].y); g.stroke(); }
    }
    st.forEach(s => {
      const tw = .5 + .5 * Math.sin(now / 1000 * s.sp * T + s.ph), b = pp >= 0 ? Math.max(0, 1 - Math.abs(s.x / W - pp / 1.2) * 5) : 0;
      const a = Math.min(1, (.25 + .75 * tw + b) * (.45 + .55 * s.z)), rgb = s.tint || p.ink, r = s.r * (1 + b * 1.4);
      if (s.big) { orb(l, rgb, s.x, s.y, r * 7, a * .6); g.strokeStyle = `rgba(${rgb},${(a * .55).toFixed(3)})`; g.lineWidth = .8; const k = r * (3 + 4 * tw); g.beginPath(); g.moveTo(s.x - k, s.y); g.lineTo(s.x + k, s.y); g.moveTo(s.x, s.y - k); g.lineTo(s.x, s.y + k); g.stroke(); }
      g.fillStyle = `rgba(${rgb},${a.toFixed(3)})`; g.beginPath(); g.arc(s.x, s.y, r, 0, 6.283); g.fill();
    });
    if (!l.coins.length && !l.shots.length && !l.rings.length && !l.orbit && !l.pulse && now > l.next) spawn(l, now);
    l.rings = l.rings.filter(r => {
      const rad = (now - r.at) / 1000 * 240 * T, mx = Math.max(W, H) * .5; if (rad < 0) return true; if (rad > mx) return false; const k = 1 - rad / mx;
      if (rad < 60) orb(l, r.c, r.x, r.y, 26 * (1 - rad / 60) + 6, .9);
      g.strokeStyle = `rgba(${r.c},${(.85 * k).toFixed(3)})`; g.lineWidth = 2.4; g.beginPath(); g.arc(r.x, r.y, rad, 0, 6.283); g.stroke();
      g.strokeStyle = `rgba(${p.core},${(.35 * k).toFixed(3)})`; g.lineWidth = .8; g.beginPath(); g.arc(r.x, r.y, rad + 5, 0, 6.283); g.stroke(); return true;
    });
    const o = l.orbit;
    if (o) {
      const age = now - o.t0;
      if (age > o.dur) l.orbit = null;
      else {
        const e = Math.min(1, age / 700, (o.dur - age) / 900), cr = Math.cos(o.rot), sr = Math.sin(o.rot), pt = th => [o.cx + o.rx * Math.cos(th) * cr - o.ry * Math.sin(th) * sr, o.cy + o.rx * Math.cos(th) * sr + o.ry * Math.sin(th) * cr];
        g.setLineDash([3, 9]); g.strokeStyle = `rgba(${o.c},${(.3 * e).toFixed(3)})`; g.lineWidth = 1; g.beginPath(); g.ellipse(o.cx, o.cy, o.rx, o.ry, o.rot, 0, 6.283); g.stroke(); g.setLineDash([]);
        [0, 3.1416].forEach(ph => {
          const th = age / 1000 * 1.5 * T + ph;
          for (let k = 16; k >= 0; k--) { const [x, y] = pt(th - k * .085), f = (1 - k / 17) * e; orb(l, o.c, x, y, 3 + 11 * f * (k ? .35 : 1), f * (k ? .55 : 1)); }
          const [hx, hy] = pt(th); g.fillStyle = `rgba(${p.core},${e.toFixed(3)})`; g.beginPath(); g.arc(hx, hy, 2.4, 0, 6.283); g.fill();
        });
      }
    }
    l.shots = l.shots.filter(sh => {
      if (now < sh.at) return true; sh.x += sh.vx * dt; sh.y += sh.vy * dt;
      const D = Math.hypot(sh.vx, sh.vy), tx = sh.x - sh.vx / D * sh.len, ty = sh.y - sh.vy / D * sh.len, gr = g.createLinearGradient(sh.x, sh.y, tx, ty);
      gr.addColorStop(0, `rgba(${p.core},1)`); gr.addColorStop(.25, `rgba(${sh.c},.7)`); gr.addColorStop(1, `rgba(${sh.c},0)`);
      g.strokeStyle = gr; g.lineWidth = sh.w; g.lineCap = 'round'; g.beginPath(); g.moveTo(sh.x, sh.y); g.lineTo(tx, ty); g.stroke(); orb(l, sh.c, sh.x, sh.y, sh.w * 5, .9);
      return sh.y < H + 80 && sh.x > -80 && sh.x < W + 80;
    });
    // coin rain: opaque coins that spin as they fall and sway a little (always painted normally)
    g.globalCompositeOperation = 'source-over';
    l.coins = l.coins.filter(c => {
      if (now < c.at) return true; c.y += c.vy * dt; c.x = c.x0 + Math.sin(c.ph + now / 1000 * c.f) * c.amp;
      const k = c.y / H; drawCoin(g, c, now, k > .85 ? Math.max(0, (1 - k) / .15) : 1); return c.y < H + 20;
    });
  };


  // ---------- Photo band ----------
  // A band under the header where small glass cards with money photos pass in a random direction each time:
  // left to right, right to left, falling, rising, or flying out from the centre (never the same direction twice in a row).
  const PHOTOS = Array.from({ length: 9 }, (_, i) => `photos/argent-${i + 1}.jpg`);
  const DIRS = ['ltr', 'rtl', 'ttb', 'btt', 'center'];
  const band = { el: null, bg: null, anims: [], timer: 0, seq: 0, pool: [], last: '', running: false, sig: '', static: false };
  const bandEl = () => {
    if (band.el && band.el.isConnected) return band.el;
    const h = document.querySelector('header'); if (!h) return null;
    const el = document.createElement('div'); el.id = 'band'; el.className = 'band'; el.setAttribute('aria-hidden', 'true');
    const bg = document.createElement('div'); bg.className = 'hbg'; el.appendChild(bg); h.insertAdjacentElement('afterend', el);
    Object.assign(band, { el, bg, running: false, static: false }); return el;
  };
  const bandPause = () => { clearTimeout(band.timer); band.seq++; band.anims.forEach(a => a.cancel()); band.anims = []; if (band.bg) band.bg.textContent = ''; band.running = false; band.static = false; };
  const bandRemove = () => { bandPause(); if (band.el) band.el.remove(); band.el = band.bg = null; };
  const card = (w, hh, dp) => { // far = small and faint, near = big and bright
    if (!band.pool.length) band.pool = PHOTOS.slice().sort(() => Math.random() - .5);
    const c = document.createElement('i'); c.className = 'hcard'; c.style.width = Math.round(w * dp) + 'px'; c.style.height = Math.round(hh * dp) + 'px'; c.style.zIndex = dp < 1 ? 0 : dp > 1 ? 2 : 1;
    c.style.backgroundImage = `url(${band.pool.pop()})`; c.style.setProperty('--gc', pick(['245,197,66', '232,115,12', '255,236,170'])); c.style.setProperty('--sd', rnd(0, 3).toFixed(2) + 's');
    band.bg.appendChild(c); return c;
  };
  const depth = () => pick([.76, 1, 1.18]), op = dp => dp < 1 ? .6 : dp > 1 ? 1 : .86;
  // moves a card and fades it in and out softly at the ends of its trip
  const go = (c, frames, ms, delay, dp) => {
    const o = op(dp);
    band.anims.push(c.animate(frames, { duration: ms, delay, easing: 'linear', fill: 'both' }),
      c.animate([{ opacity: 0 }, { opacity: o, offset: .14 }, { opacity: o, offset: .86 }, { opacity: 0 }], { duration: ms, delay, easing: 'linear', fill: 'both' }));
  };
  const pass = force => {
    const bg = band.bg; if (!bg || !bg.isConnected) return; clearTimeout(band.timer);
    if (document.hidden) { band.timer = setTimeout(() => pass(), 1000); return; }
    band.anims.forEach(a => a.cancel()); band.anims = []; bg.textContent = '';
    let dir = force; if (!dir) { do dir = pick(DIRS); while (dir === band.last); } band.last = dir;
    const w = bg.clientWidth, hh = bg.clientHeight, id = ++band.seq, cw = 120, tilt = () => rnd(-5, 5), lv = level(), T = lv.tempo, dn = Math.max(.6, lv.dens), sf = 1 / dn;
    if (dir === 'ltr' || dir === 'rtl') { // a row of cards, zigzag, crossing the width at different speeds (parallax)
      const ch = Math.round(hh * .6), sp = 150 * T, n = Math.max(5, Math.ceil(w / ((cw + 16) * sf)) + 3);
      for (let i = 0; i < n; i++) {
        const dp = depth(), c = card(cw, ch, dp), cwd = cw * dp, y = hh * .5 - ch * dp / 2 + (i % 2 ? 1 : -1) * hh * .08, r = tilt(), x0 = dir === 'ltr' ? -cwd : w, x1 = dir === 'ltr' ? w : -cwd, v = sp * (dp < 1 ? .7 : dp > 1 ? 1.25 : 1);
        go(c, [{ transform: `translate(${x0}px,${y}px) rotate(${r}deg)` }, { transform: `translate(${x1}px,${y}px) rotate(${r}deg)` }], (w + cwd) / v * 1000, i * (cw + 16) * sf / sp * 1000, dp);
      }
    } else if (dir === 'ttb' || dir === 'btt') { // columns of cards falling or rising
      const lanes = Math.max(2, Math.min(5, Math.round(w / 150 * Math.sqrt(dn)))), ch = Math.round(Math.min(70, hh * .62)), sp = 120 * T;
      for (let i = 0; i < lanes * 2; i++) {
        const dp = depth(), c = card(cw - 20, ch, dp), chd = ch * dp, ms = (hh + chd) / (sp * (dp < 1 ? .7 : dp > 1 ? 1.25 : 1)) * 1000, x = ((i % lanes) + .5) * w / lanes - (cw - 20) * dp / 2 + rnd(-10, 10), r = tilt(), y0 = dir === 'ttb' ? -chd : hh, y1 = dir === 'ttb' ? hh : -chd;
        go(c, [{ transform: `translate(${x}px,${y0}px) rotate(${r}deg)` }, { transform: `translate(${x}px,${y1}px) rotate(${r}deg)` }], ms, ((i % lanes) * 450 + Math.floor(i / lanes) * (ms * .55) + rnd(0, 250)) * sf, dp);
      }
    } else { // from the centre: the cards grow and fly out in every direction
      const n = Math.max(4, Math.round(6 * dn)), ch = Math.round(hh * .56), off = rnd(0, 6.28);
      for (let i = 0; i < n; i++) {
        const dp = depth(), c = card(cw, ch, dp), cx = w / 2 - cw * dp / 2, cy = hh / 2 - ch * dp / 2, a = off + i / n * 6.283 + rnd(-.3, .3), dx = Math.cos(a) * w * .7, dy = Math.sin(a) * hh * .75, r = rnd(-12, 12), o = op(dp);
        go(c, [{ transform: `translate(${cx}px,${cy}px) scale(.15) rotate(0deg)`, opacity: 0 }, { opacity: o, offset: .3 }, { transform: `translate(${cx + dx}px,${cy + dy}px) scale(1.15) rotate(${r}deg)`, opacity: 0 }], 2800 / T, i * 330 / T * sf, dp);
      }
    }
    Promise.all(band.anims.map(a => a.finished.catch(() => null))).then(() => { if (id === band.seq && bg.isConnected) band.timer = setTimeout(() => pass(), rnd(300, 900) * lv.gap); });
  };
  // "Reduce motion": three still cards
  const bandStatic = () => {
    if (band.static) return; bandPause(); band.static = true;
    const w = band.bg.clientWidth, hh = band.bg.clientHeight;
    for (let i = 0; i < 3; i++) { const c = card(120, Math.round(hh * .6), 1); c.style.opacity = .85; c.style.transform = `translate(${(i + .5) * w / 3 - 60}px,${hh * .2}px) rotate(${(i - 1) * 3}deg)`; }
  };
  const bandSync = () => {
    if (mode() === 'off' || !document.querySelector('header')) return bandRemove();
    const el = bandEl(); if (!el) return;
    if (reduceQ.matches) return bandStatic();
    if (canRun()) { if (band.running && band.sig !== sig()) bandPause(); if (!band.running) { band.running = true; band.sig = sig(); band.static = false; pass(); } }
    else if (band.running || band.static) bandPause();
  };

  let raf = 0, last = 0, page = null, hero = null, ro = null;
  const frame = now => {
    raf = requestAnimationFrame(frame);
    if (now - last < 33) return; const dt = Math.min(.1, (now - last) / 1000); last = now; // ~30 images/s keeps the phone cool
    if (hero && !hero.cv.isConnected) hero = null;
    const T = level().tempo; [page, hero].forEach(l => l && !l.cv.hidden && draw(l, now, dt * T, T));
  };
  const stop = () => {
    cancelAnimationFrame(raf); raf = 0; if (page) page.cv.hidden = true;
    document.querySelectorAll('.hsky').forEach(x => x.remove()); hero = null; if (ro) { ro.disconnect(); ro = null; }
  };
  const run = () => {
    if (!page) {
      const cv = document.createElement('canvas'); cv.id = 'sky'; cv.setAttribute('aria-hidden', 'true'); document.body.prepend(cv);
      page = mk(cv, { dens: 6500, max: 110, r0: .6, r1: 1.1, ga: .22, v: 170, gap: 3000, first: 1500, link: 110, scenes: ['coins', 'coins', 'shower', 'rings', 'comet', 'pulse', 'orbit'] });
    }
    page.cv.hidden = false; if (page.W !== innerWidth || page.H !== innerHeight || page.sig !== sig()) fit(page);
    const h = document.querySelector('header');
    if (h && !(hero && hero.cv.parentNode === h)) { // sparkles inside the golden header
      h.querySelectorAll('.hsky').forEach(x => x.remove());
      const cv = document.createElement('canvas'); cv.className = 'hsky'; cv.setAttribute('aria-hidden', 'true'); h.prepend(cv);
      hero = mk(cv, { hero: true, dens: 1100, max: 60, r0: .7, r1: 1.2, ga: .22, v: 150, gap: 2200, first: 700, link: 80, scenes: ['shower', 'rings', 'pulse'] }); fit(hero);
      if (window.ResizeObserver) { if (ro) ro.disconnect(); ro = new ResizeObserver(() => hero && hero.cv.isConnected && fit(hero)); ro.observe(h); }
    } else if (hero && hero.sig !== sig()) fit(hero);
    if (!raf) { last = 0; raf = requestAnimationFrame(frame); }
  };
  const sync = () => { if (canRun()) run(); else if (raf || (page && !page.cv.hidden)) stop(); bandSync(); };
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('resize', () => { if (page && !page.cv.hidden) { fit(page); if (hero && hero.cv.isConnected) fit(hero); } });
  [reduceQ, darkQ].forEach(q => q.addEventListener && q.addEventListener('change', sync));
  new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['class'] }); // locked / unlocked
  const start = () => sync();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  // ---------- Small delights ----------
  const tick = () => { try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {} };
  const toast = msg => {
    document.querySelectorAll('.toast').forEach(x => x.remove());
    const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => t.classList.add('out'), 2600); setTimeout(() => t.remove(), 3100);
  };
  // Count-up: renders `render(values)` into el, easing from `from` to `to` (arrays of numbers)
  const count = (el, from, to, render) => {
    cancelAnimationFrame(el._cf);
    if (!animated() || !from || from.every((v, i) => v === to[i])) { el.innerHTML = render(to); return; }
    const t0 = performance.now(), D = 700;
    const step = now => { const k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 3); el.innerHTML = render(to.map((v, i) => from[i] + (v - from[i]) * e)); if (k < 1) el._cf = requestAnimationFrame(step); };
    el._cf = requestAnimationFrame(step);
  };
  // Confetti of coins and gold flakes falling from the top of the screen
  const celebrate = msg => {
    if (msg) toast(msg);
    try { if (navigator.vibrate) navigator.vibrate([30, 40, 30]); } catch (e) {}
    if (!animated() || document.getElementById('confetti')) return;
    const cv = document.createElement('canvas'); cv.id = 'confetti'; cv.setAttribute('aria-hidden', 'true');
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = window.innerWidth, H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; document.body.appendChild(cv);
    const g = cv.getContext('2d'); g.scale(dpr, dpr);
    const COL = ['#f6c453', '#e8730c', '#fff1b8', '#d9961c', '#ffffff'];
    const ps = Array.from({ length: 90 }, (_, i) => ({ coin: i % 3 === 0, x: W / 2 + (Math.random() - .5) * W * .5, y: -10 - Math.random() * 60, vx: (Math.random() - .5) * 9, vy: 2 + Math.random() * 5, s: 5 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: pick(COL), sp0: Math.random() * 6 }));
    const t0 = performance.now();
    const step = now => {
      const k = (now - t0) / 1900; g.clearRect(0, 0, W, H);
      ps.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += .12; p.vx *= .99; p.r += p.vr;
        const a = Math.max(0, 1 - Math.max(0, k - .6) / .4);
        if (p.coin) drawCoin(g, { x: p.x, y: p.y, r: p.s * 1.1, spin: 6, sp0: p.sp0 }, now, a);
        else { g.save(); g.globalAlpha = a; g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); g.restore(); }
      });
      if (k < 1) requestAnimationFrame(step); else cv.remove();
    };
    requestAnimationFrame(step);
  };

  window.NZ = { count, celebrate, tick, toast, fx: { mode, set: v => { try { localStorage.setItem(KEY, v); } catch (e) {} sync(); } } };
})();
