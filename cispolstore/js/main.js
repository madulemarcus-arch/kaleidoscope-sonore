// Boot: theme, first view, lock screen, persistent storage, offline cache.
(() => {
  'use strict';
  const App = window.App;
  App.applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', App.applyTheme);
  App.go('home', {}, true);

  if (App.hasPin()) App.showLock('enter', 'unlock');
  else if (!App.db.settings.pinAsked) { App.db.settings.pinAsked = true; App.save(); App.showLock('new1', 'setup'); }

  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().then(p => { App.persisted = p; if (App.state.view === 'settings') App.refresh(); }).catch(() => {});
  // Restore from the IndexedDB mirror if localStorage was wiped
  if (!App.hasData(App.db)) App.recover().then(ok => { if (ok) { App.applyTheme(); App.refresh(); } });
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
