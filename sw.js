// Fierro service worker. Sube VERSION en cada despliegue (deploy.py lo hace solo).
const VERSION = '0.1.0';
const CACHE = 'fierro-' + VERSION;
const SHELL = [
  './', './index.html', './styles.css', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png',
  './js/app.js', './js/state.js', './js/db.js', './js/util.js', './js/version.js',
  './js/vendor/preact-htm.js',
  './js/data/routine.js', './js/data/diet.js',
  './js/engine/nutrition.js', './js/engine/progression.js',
  './js/views/ui.js', './js/views/Hoy.js', './js/views/Entrenar.js', './js/views/Dieta.js',
  './js/views/Progreso.js', './js/views/Ajustes.js', './js/views/Onboarding.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('fierro-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('./index.html').then((r) => r || fetch(req)));
    return;
  }
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }))
  );
});
