// Lists: swipe a row to the left to reveal quick actions (call, WhatsApp, copy the ACC, renew, collect…); on a computer the actions appear on hover.
(() => {
  'use strict';
  const App = window.App;
  // helpers used by the list screens
  App.rowSwipe = (n, actions, row) => `<div class="swr" style="--n:${n}"><div class="swa">${actions}</div>${row}</div>`;
  App.letterOf = name => { const c = String(name || '?').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().charAt(0).toUpperCase(); return /[A-Z]/.test(c) ? c : '#'; };
  const dayLabel = d => { const t = App.today(); return d === t ? "Aujourd'hui" : d === App.addDays(t, -1) ? 'Hier' : App.fdate(d); };
  App.dayLabel = dayLabel;

  let sw = null, lastDrag = 0;
  const closeAll = except => document.querySelectorAll('.swr.open').forEach(r => { if (r !== except) r.classList.remove('open'); });
  document.addEventListener('touchstart', e => {
    const r = e.target.closest('.swr'); if (!r) { closeAll(); return; }
    const it = r.querySelector('.item'), a = r.querySelector('.swa'); if (!it || !a) return;
    const t = e.touches[0], w = a.offsetWidth; closeAll(r);
    sw = { r, it, w, x: t.clientX, y: t.clientY, base: r.classList.contains('open') ? -w : 0, dir: null, cur: 0 };
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!sw) return; const t = e.touches[0], dx = t.clientX - sw.x, dy = t.clientY - sw.y;
    if (sw.dir === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) sw.dir = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
    if (sw.dir !== 'h') return;
    if (e.cancelable) e.preventDefault();
    sw.cur = Math.max(-sw.w, Math.min(0, sw.base + dx)); sw.it.style.transition = 'none'; sw.it.style.transform = `translateX(${sw.cur}px)`;
  }, { passive: false });
  const end = () => {
    if (!sw) return; const s = sw; sw = null;
    if (s.dir === 'h') { lastDrag = Date.now(); s.it.style.transition = ''; s.it.style.transform = ''; s.r.classList.toggle('open', s.cur < -s.w / 3); }
  };
  document.addEventListener('touchend', end); document.addEventListener('touchcancel', end);
  // a swipe must not open the row, and a tap on an open row only closes it
  document.addEventListener('click', e => {
    if (Date.now() - lastDrag < 350) { e.stopPropagation(); e.preventDefault(); return; }
    const it = e.target.closest('.swr.open > .item'); if (it && !e.target.closest('a, [data-act="copy"]')) { e.stopPropagation(); e.preventDefault(); it.parentNode.classList.remove('open'); }
  }, true);
})();
// keyboard: Enter or Space opens a row that is not a real button
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.item[role="button"]')) { e.preventDefault(); e.target.click(); } });
