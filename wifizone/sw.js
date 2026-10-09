// Old WiFi Zone service worker, replaced: it removes itself and its cache so the redirect page can load.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('wifizone-')).map(k => caches.delete(k)))).then(() => self.registration.unregister())));
