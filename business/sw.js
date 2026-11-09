// Offline cache: serve the app shell from cache, refresh it in the background.
const CACHE = 'business-v4';
const FILES = ['./', './index.html', './css/app.css', './js/core.js', './js/money.js', './js/ui.js', './js/settings.js', './js/main.js', './js/lists.js', './js/sheetio.js', './js/clients.js', './js/clientimport.js', './js/stock.js', './js/suppliers.js', './js/inventory.js', './js/reorder.js', './js/sales.js', './js/docs.js', './js/quotes.js', './js/unpaid.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))));
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return; // never cache sync/Drive calls
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => {
    const net = fetch(e.request).then(r => { if (r.ok) caches.open(CACHE).then(c => c.put(e.request, r.clone())); return r; }).catch(() => hit);
    return hit || net;
  }));
});
