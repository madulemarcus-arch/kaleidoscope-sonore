// Two-tone SVG icons for navigation (bottom bar and side menu). Shapes shared with CISPOLstore Manager, plus the ones for the business modules.
(function () {
  const App = window.App;
  const P = {
    home: '<path class="f s" d="M3.5 11.2 12 4l8.5 7.2V19a1.5 1.5 0 0 1-1.5 1.5h-3.8v-5.3H8.8v5.3H5A1.5 1.5 0 0 1 3.5 19z"/><path class="s" d="M2.5 11.8 12 3.5l9.5 8.3"/>',
    clients: '<circle class="f s" cx="9" cy="8" r="3.3"/><path class="f s" d="M2.8 19.5c0-3.4 2.8-6 6.2-6s6.2 2.6 6.2 6z"/><circle class="s" cx="17.2" cy="9" r="2.5"/><path class="s" d="M16.3 13.8c2.8.3 4.9 2.3 4.9 5.2"/>',
    money: '<circle class="f s" cx="12" cy="12" r="9"/><path class="s" d="M12 6.8v10.4M14.8 9.4c-.4-1.1-1.4-1.7-2.8-1.7-1.6 0-2.8.8-2.8 2.1 0 3 5.8 1.2 5.8 4.2 0 1.3-1.2 2.1-3 2.1-1.5 0-2.6-.7-3-1.8"/>',
    stock: '<path class="f s" d="M3.5 7.6 12 3l8.5 4.6v8.8L12 21l-8.5-4.6z"/><path class="s" d="M3.7 7.7 12 12.3l8.3-4.6M12 12.3V21"/><path class="s" d="m7.8 5.3 8.4 4.6"/>',
    more: '<rect class="f s" x="3.5" y="3.5" width="7" height="7" rx="2"/><rect class="f s" x="13.5" y="3.5" width="7" height="7" rx="2"/><rect class="f s" x="3.5" y="13.5" width="7" height="7" rx="2"/><rect class="f s" x="13.5" y="13.5" width="7" height="7" rx="2"/>',
    sales: '<path class="f s" d="M5.5 3.5h13v17l-2.2-1.5-2.1 1.5-2.2-1.5-2.2 1.5-2.1-1.5-2.2 1.5z"/><path class="s" d="M9 8.5h6M9 12h6M9 15.3h3.5"/>',
    services: '<path class="f s" d="M14.7 6.3a4.2 4.2 0 0 0-5.4 5.4L3.6 17.4a1.9 1.9 0 0 0 2.7 2.7l5.7-5.7a4.2 4.2 0 0 0 5.4-5.4l-2.7 2.7-2.4-.6-.6-2.4z"/>',
    delivery: '<path class="f s" d="M2.8 6.8h11.4v9.6H2.8z"/><path class="f s" d="M14.2 9.6h3.7l3.3 3.3v3.5h-7z"/><circle class="f s" cx="7" cy="17.6" r="2"/><circle class="f s" cx="17.4" cy="17.6" r="2"/>',
    subs: '<path class="f s" d="M4 12a8 8 0 0 1 13.7-5.6L20 8.7V4"/><path class="f s" d="M20 12a8 8 0 0 1-13.7 5.6L4 15.3V20"/><path class="s" d="M20 8.7h-4.7M4 15.3h4.7"/>',
    rental: '<circle class="f s" cx="8" cy="12" r="4.2"/><path class="s" d="M12.2 12H21M17.5 12v3.2M20.7 12v2.2"/><circle class="s" cx="8" cy="12" r="1.3"/>',
    contracts: '<path class="f s" d="M6 3.5h8.5L19 8v12.5H6z"/><path class="s" d="M14.5 3.5V8H19M9 12.5h7M9 15.5h7M9 18.5h4"/>',
    purchases: '<path class="f s" d="M3 4.5h2.4l1.6 9.2h10.2l1.8-6.8H6.2"/><circle class="f s" cx="9" cy="18.5" r="1.6"/><circle class="f s" cx="16.5" cy="18.5" r="1.6"/>',
    suppliers: '<path class="f s" d="M3.5 9.5 5 4.5h14l1.5 5z"/><path class="f s" d="M4.5 9.5V20h15V9.5"/><path class="s" d="M10 20v-5.5h4V20M3.5 9.5a2.8 2.8 0 0 0 5.5 0 2.8 2.8 0 0 0 5.5 0 2.8 2.8 0 0 0 5.5 0"/>',
    cash: '<rect class="f s" x="2.8" y="6" width="18.4" height="12" rx="2.2"/><circle class="s" cx="12" cy="12" r="2.8"/><path class="s" d="M6 9.2v.1M18 14.8v.1"/>',
    interventions: '<path class="f s" d="M3.5 9h17v10.5h-17z"/><path class="s" d="M8.5 9V6.2a1.2 1.2 0 0 1 1.2-1.2h4.6a1.2 1.2 0 0 1 1.2 1.2V9M3.5 13.5h17M11 13.5v2.2h2v-2.2"/>',
    team: '<circle class="f s" cx="12" cy="8" r="3.6"/><path class="f s" d="M4.5 20c.4-4 3.4-6.2 7.5-6.2s7.1 2.2 7.5 6.2z"/>',
    data: '<ellipse class="f s" cx="12" cy="6" rx="7.5" ry="3"/><path class="f s" d="M4.5 6v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6"/><path class="f s" d="M4.5 12v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6"/>',
    settings: '<circle class="f s" cx="12" cy="12" r="3.2"/><path class="s" d="M12 3.2v2.3M12 18.5v2.3M20.8 12h-2.3M5.5 12H3.2M18.2 5.8l-1.6 1.6M7.4 16.6l-1.6 1.6M18.2 18.2l-1.6-1.6M7.4 7.4 5.8 5.8"/>'
  };
  App.icon = (n, extra) => P[n] ? '<svg class="ic' + (extra ? ' ' + extra : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + P[n] + '</svg>' : '';
  App.ICONS = Object.keys(P);
})();
