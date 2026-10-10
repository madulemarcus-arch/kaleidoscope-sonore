// Forms as sheets: grab handle (drag down to close), close button, quick date buttons, + / − on quantities.
(() => {
  'use strict';
  const App = window.App, $ = App.$, dlg = $('dlg');
  const orig = App.modal;
  const fire = el => { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };

  // quick date buttons under every date field of a form
  const dates = root => root.querySelectorAll('input[type="date"]').forEach(inp => {
    if (inp.dataset.qd) return; inp.dataset.qd = '1'; const t = App.today(), max = inp.max, min = inp.min;
    const opts = [["Aujourd'hui", t], ['Hier', App.addDays(t, -1)], ['−7 j', App.addDays(t, -7)]].filter(([, d]) => (!max || d <= max) && (!min || d >= min));
    if (opts.length < 2) return;
    const row = document.createElement('div'); row.className = 'qd';
    const paint = () => row.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', inp.value === opts[i][1]));
    opts.forEach(([l, d]) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = l; b.onclick = () => { inp.value = d; fire(inp); paint(); }; row.appendChild(b); });
    inp.addEventListener('input', paint); inp.parentNode.appendChild(row); paint();
  });

  // − / + around the quantity fields
  const steppers = root => root.querySelectorAll('input#f_qty, input#f_q, input[id^="l_q"]').forEach(inp => {
    if (inp.parentNode.classList.contains('stp')) return;
    const w = document.createElement('div'); w.className = 'stp'; inp.parentNode.insertBefore(w, inp);
    const mk = (t, d) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.setAttribute('aria-label', d > 0 ? 'Augmenter' : 'Diminuer'); b.onclick = () => { const v = Math.max(+inp.min || 0, (parseFloat(String(inp.value).replace(',', '.')) || 0) + d); inp.value = Math.round(v * 100) / 100; fire(inp); }; return b; };
    w.appendChild(mk('−', -1)); w.appendChild(inp); w.appendChild(mk('+', 1));
  });

  App.modal = (title, body, onOk, okLabel) => {
    orig(title, body, onOk, okLabel);
    const form = dlg.querySelector('form'); if (!form) return;
    form.insertAdjacentHTML('afterbegin', '<div class="grab" aria-hidden="true"></div>');
    const h = form.querySelector('h3'); if (h) { const x = document.createElement('button'); x.type = 'button'; x.className = 'dclose'; x.setAttribute('aria-label', 'Fermer'); x.textContent = '✕'; x.onclick = () => dlg.close(); h.appendChild(x); }
    dates(form); steppers(form);
  };

  // drag the handle or the title down to close the sheet (phones)
  let drag = null;
  dlg.addEventListener('touchstart', e => { const g = e.target.closest('.grab, dialog > form > h3'); if (!g || dlg.scrollTop > 0) return; drag = { y: e.touches[0].clientY, dy: 0 }; }, { passive: true });
  dlg.addEventListener('touchmove', e => { if (!drag) return; drag.dy = Math.max(0, e.touches[0].clientY - drag.y); dlg.style.transition = 'none'; dlg.style.transform = `translateY(${drag.dy}px)`; }, { passive: true });
  const stop = () => { if (!drag) return; const d = drag; drag = null; dlg.style.transition = ''; dlg.style.transform = ''; if (d.dy > 110) dlg.close(); };
  dlg.addEventListener('touchend', stop); dlg.addEventListener('touchcancel', stop);
})();
