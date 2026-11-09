// Colourful two-tone SVG icons for the navigation (bottom bar and side menu). The active one pops and draws itself (see style.css).
(() => {
  const App = window.App;
  const P = {
    home: '<path class="f s" d="M3.5 11.2 12 4l8.5 7.2V19a1.5 1.5 0 0 1-1.5 1.5h-3.8v-5.3H8.8v5.3H5A1.5 1.5 0 0 1 3.5 19z"/><path class="s" d="M2.5 11.8 12 3.5l9.5 8.3"/>',
    clients: '<circle class="f s" cx="9" cy="8" r="3.3"/><path class="f s" d="M2.8 19.5c0-3.4 2.8-6 6.2-6s6.2 2.6 6.2 6z"/><circle class="s" cx="17.2" cy="9" r="2.5"/><path class="s" d="M16.3 13.8c2.8.3 4.9 2.3 4.9 5.2"/>',
    finance: '<circle class="f s" cx="12" cy="12" r="9"/><path class="s" d="M12 6.8v10.4M14.8 9.4c-.4-1.1-1.4-1.7-2.8-1.7-1.6 0-2.8.8-2.8 2.1 0 3 5.8 1.2 5.8 4.2 0 1.3-1.2 2.1-3 2.1-1.5 0-2.6-.7-3-1.8"/>',
    stock: '<path class="f s" d="M3.5 7.6 12 3l8.5 4.6v8.8L12 21l-8.5-4.6z"/><path class="s" d="M3.7 7.7 12 12.3l8.3-4.6M12 12.3V21"/><path class="s" d="m7.8 5.3 8.4 4.6"/>',
    more: '<rect class="f s" x="3.5" y="3.5" width="7" height="7" rx="2"/><rect class="f s" x="13.5" y="3.5" width="7" height="7" rx="2"/><rect class="f s" x="3.5" y="13.5" width="7" height="7" rx="2"/><rect class="f s" x="13.5" y="13.5" width="7" height="7" rx="2"/>',
    installs: '<path class="f s" d="M14.7 6.3a4.2 4.2 0 0 0-5.4 5.4L3.6 17.4a1.9 1.9 0 0 0 2.7 2.7l5.7-5.7a4.2 4.2 0 0 0 5.4-5.4l-2.7 2.7-2.4-.6-.6-2.4z"/>',
    livraisons: '<path class="f s" d="M2.8 6.8h11.4v9.6H2.8z"/><path class="f s" d="M14.2 9.6h3.7l3.3 3.3v3.5h-7z"/><circle class="f s" cx="7" cy="17.6" r="2"/><circle class="f s" cx="17.4" cy="17.6" r="2"/>'
  };
  App.icon = (n, extra) => P[n] ? `<svg class="ic ic-${n}${extra ? ' ' + extra : ''}" viewBox="0 0 24 24" aria-hidden="true">${P[n]}</svg>` : '';
  App.ICONS = Object.keys(P);
  // the static buttons of index.html (before the role-based bar is built)
  document.querySelectorAll('#bottom [data-nav] > span').forEach(s => { const n = s.parentNode.dataset.nav; if (P[n]) s.innerHTML = App.icon(n); });
})();
