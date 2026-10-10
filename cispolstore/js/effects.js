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
