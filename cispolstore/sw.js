// Offline cache: serve the app shell from cache, refresh it in the background.
const CACHE = 'cispolstore-v67';
const FILES = ['./', './index.html', './style.css', './fonts/inter-latin.woff2', './js/core.js', './js/ui.js', './js/sheets.js', './js/roles.js', './js/lists.js', './js/effects.js', './js/clients.js', './js/stock.js', './js/techs.js', './js/plans.js', './vendor/qrcode.js', './js/invoices.js', './js/share.js', './js/purchases.js', './js/delivery.js', './js/charts.js', './js/reports.js', './js/monthly.js', './js/finance.js', './js/daily.js', './js/settings.js', './js/importc.js', './js/importf.js', './js/remind.js', './js/penalties.js', './js/unpaid.js', './js/export.js', './js/sync.js', './js/drive.js', './js/main.js', './manifest.webmanifest', './logo.png', './stamp.png', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return; // never cache Google/Supabase calls
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => {
    const net = fetch(e.request).then(r => { if (r.ok) caches.open(CACHE).then(c => c.put(e.request, r.clone())); return r; }).catch(() => hit);
    return hit || net;
  }));
});
