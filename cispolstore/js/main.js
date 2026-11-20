// Boot: theme, first view, lock screen, persistent storage, offline cache.
(() => {
  'use strict';
  const App = window.App;
  App.applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', App.applyTheme);
  App.go('home', {}, true);
  App.applyRole();
  // App shortcuts (long-press menu on Android): ?go=<view> opens that screen when the active profile may see it
  { const g = new URLSearchParams(location.search).get('go'); if (g && App.views[g] && App.canView(g)) App.go(g, {}, true); }

  if (App.hasPin() && !(window.__enc && window.__enc.fresh && !App.multi())) App.showLock('enter', 'unlock');   // the passphrase was just typed: no second code (with profiles, the PIN still chooses the profile)
  else if (!App.db.settings.pinAsked) { App.db.settings.pinAsked = true; App.save(); App.showLock('new1', 'setup'); }

  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().then(p => { App.persisted = p; if (App.state.view === 'settings') App.refresh(); }).catch(() => {});
  // Restore from the IndexedDB mirror if localStorage was wiped
  if (!App.hasData(App.db)) App.recover().then(ok => { if (ok) { App.applyTheme(); App.refresh(); } });
  // Offline cache + "new version available" banner
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) App.showUpdate(); });
    navigator.serviceWorker.register('sw.js').then(reg => {
      const check = () => reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
      setInterval(check, 30 * 60 * 1000);
    }).catch(() => {});
  }
})();
