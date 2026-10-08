// Offline cache: serve the app shell from cache, refresh it in the background.
const CACHE = 'cispolstore-v31';
const FILES = ['./', './index.html', './style.css', './js/core.js', './js/ui.js', './js/roles.js', './js/clients.js', './js/stock.js', './js/techs.js', './js/plans.js', './js/invoices.js', './js/delivery.js', './js/reports.js', './js/monthly.js', './js/finance.js', './js/settings.js', './js/remind.js', './js/penalties.js', './js/unpaid.js', './js/export.js', './js/sync.js', './js/drive.js', './js/main.js', './manifest.webmanifest', './logo.png', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return; // never cache Google/Supabase calls
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => {
    const net = fetch(e.request).then(r => { if (r.ok) caches.open(CACHE).then(c => c.put(e.request, r.clone())); return r; }).catch(() => hit);
    return hit || net;
  }));
});
