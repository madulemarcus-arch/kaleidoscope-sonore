// Small chart toolkit (no library): donut, bars (one or two series) and horizontal bars, drawn with SVG / CSS from the theme colours.
// Tapping a bar or a slice shows its value in the readout line of the chart.
(() => {
  'use strict';
  const App = window.App, esc = App.esc;
  const PAL = ['var(--blue)', 'var(--acc)', 'var(--ok)', 'var(--acc2)', '#7c5cff', '#0ea5a4', 'var(--bad)', '#64788f'];
  const C = App.chart = {};
  let uid = 0;

  // donut: items [{ label, value, color?, note? }], centre = { top, sub }
  C.donut = (items, o = {}) => {
    const list = items.filter(x => x.value > 0.0001), tot = list.reduce((a, x) => a + x.value, 0), F = o.fmt || (v => App.fmt(v));
    if (!tot) return '';
    const R = 42, L = 2 * Math.PI * R, id = 'dn' + (++uid); let off = 0;
    const segs = list.map((x, i) => { const len = x.value / tot * L, col = x.color || PAL[i % PAL.length], g = list.length > 1 ? 1.2 : 0, s = `<circle class="seg" cx="60" cy="60" r="${R}" fill="none" stroke-width="15" stroke-linecap="butt" style="stroke:${col}" stroke-dasharray="${Math.max(0, len - g)} ${L}" stroke-dashoffset="${-off}" transform="rotate(-90 60 60)" data-ct="${esc(x.label)} · ${esc(F(x.value))} (${Math.round(x.value / tot * 100)} %)"/>`; off += len; return s; }).join('');
    return `<div class="cwrap donut"><div class="dwrap"><svg viewBox="0 0 120 120" role="img" aria-label="${esc(o.label || 'Répartition')}"><circle cx="60" cy="60" r="${R}" fill="none" stroke-width="15" style="stroke:var(--card2)"/>${segs}</svg><div class="dcen"><b>${esc(o.top != null ? o.top : F(tot))}</b><small>${esc(o.sub || 'total')}</small></div></div>
      <div class="dleg">${list.map((x, i) => `<div class="dl" data-ct="${esc(x.label)} · ${esc(F(x.value))} (${Math.round(x.value / tot * 100)} %)"><i style="background:${x.color || PAL[i % PAL.length]}"></i><span class="grow"><b>${esc(x.label)}</b>${x.note ? `<small>${esc(x.note)}</small>` : ''}</span><span class="dv">${esc(F(x.value))}<small>${Math.round(x.value / tot * 100)} %</small></span></div>`).join('')}</div><div class="cread" aria-live="polite"></div></div>`;
  };

  // vertical bars: items [{ l, v, v2? }] — one series, or two (v green / v2 red) when `two` is set
  C.bars = (items, o = {}) => {
    const F = o.fmt || (v => App.fmt(v)), mx = Math.max(...items.map(x => Math.max(x.v || 0, x.v2 || 0)), 0.0001), two = !!o.two, last = items.length - 1;
    const tick = v => v >= 1000 ? Math.round(v / 100) / 10 + ' k' : String(Math.round(v));
    return `<div class="cwrap bars${two ? ' two' : ''}">${o.title ? `<div class="chead"><b>${esc(o.title)}</b>${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</div>` : ''}<div class="cread" aria-live="polite">${o.hint === false ? '' : 'Touchez une barre pour voir le détail'}</div>
      <div class="cplot"><div class="cgrid"><span>${tick(mx)}</span><span>${tick(mx / 2)}</span><span>0</span></div><div class="ccols">${items.map((x, i) => {
        const h1 = Math.round((x.v || 0) / mx * 100), h2 = Math.round((x.v2 || 0) / mx * 100), t = `${esc(x.t || x.l || '')} · ${two ? 'Entrées ' + esc(F(x.v || 0)) + ' · Sorties ' + esc(F(x.v2 || 0)) : esc(F(x.v || 0))}`;
        return `<div class="ccol" data-ct="${t}" title="${t}"><div class="cbs">${two ? `<i class="b1" style="height:${h1}%"></i><i class="b2" style="height:${h2}%"></i>` : `<i class="b1${o.hl !== false && i === last ? ' hl' : ''}" style="height:${h1}%"></i>`}</div><small>${esc(x.l || '')}</small></div>`; }).join('')}</div></div></div>`;
  };

  // horizontal bars: items [{ label, v, max?, color?, note? }]
  C.hbars = (items, o = {}) => {
    const F = o.fmt || (v => App.nf(v, 0)), mx = Math.max(...items.map(x => x.max || x.v), 0.0001);
    return `<div class="cwrap hb">${items.map(x => `<div class="hrow" data-ct="${esc(x.label)} · ${esc(F(x.v))}${x.note ? ' · ' + esc(x.note) : ''}"><div class="hl2"><span>${esc(x.label)}</span><b>${esc(F(x.v))}</b></div><div class="htr"><i style="width:${Math.max(2, Math.round(x.v / mx * 100))}%;background:${x.color || 'linear-gradient(90deg,var(--acc2),var(--acc))'}"></i></div>${x.note ? `<small>${esc(x.note)}</small>` : ''}</div>`).join('')}<div class="cread"></div></div>`;
  };

  // rows [{ date, v, v2? }] summed per day (per month when the range is long) → items for C.bars
  C.series = (r, rows) => {
    const M = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'], byMonth = App.diff(r[0], r[1]) + 1 > 62, bk = new Map();
    for (let k = r[0], n = 0; k <= r[1] && n < 4000; k = App.addDays(k, 1), n++) { const key = byMonth ? k.slice(0, 7) : k; if (!bk.has(key)) bk.set(key, { v: 0, v2: 0, l: byMonth ? M[+k.slice(5, 7) - 1] : (+k.slice(8) % 5 === 1 ? String(+k.slice(8)) : ''), t: byMonth ? M[+k.slice(5, 7) - 1] + ' ' + k.slice(0, 4) : App.fdate(k) }); }
    rows.forEach(x => { const o = bk.get(byMonth ? x.date.slice(0, 7) : x.date); if (o) { o.v += x.v || 0; o.v2 += x.v2 || 0; } });
    return [...bk.values()];
  };

  // tap / click on a bar, a slice or a legend line: show its value in the readout of the same chart
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-ct]'); if (!el) return; const w = el.closest('.cwrap'), r = w && w.querySelector('.cread'); if (!r) return;
    r.textContent = el.getAttribute('data-ct'); r.classList.add('on');
    w.querySelectorAll('.pick').forEach(x => x.classList.remove('pick')); el.classList.add('pick');
  });
})();
