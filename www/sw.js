const CACHE_NAME = 'kenzen-cockpit-v1'; const
ASSETS = [ './', './index.html', './matrix-data.js', './tag-inspector.js',
'./kenzen-storage.js', './manifest.json', './icon-192.png', './icon-512.png',
'https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700&family=Outfit:wght@400;600;700;900&display=swap'
];

self.addEventListener('install', (e) => { e.waitUntil(
caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)) );
self.skipWaiting(); });

self.addEventListener('activate', (e) => { e.waitUntil(
caches.keys().then((keys) => { return Promise.all( keys.map((k) => { if (k !==
CACHE_NAME) return caches.delete(k); }) ); }) ); self.clients.claim(); });

self.addEventListener('fetch', (e) => { e.respondWith(
caches.match(e.request).then((cached) => { if (cached) return cached; return
fetch(e.request).then((resp) => { if (!resp || resp.status !== 200 || resp.type
!== 'basic') return resp; const respClone = resp.clone();
caches.open(CACHE_NAME).then((cache) => cache.put(e.request, respClone)); return
resp; }).catch(() => caches.match('./index.html')); }) ); });
