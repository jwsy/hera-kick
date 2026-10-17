const CACHE = 'hera-runner-v21';
// Relative paths so the SW works under any base URL (e.g. GitHub Pages /repo-name/).
// They resolve relative to the SW's own location at install time.
const CORE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/sprites/hera-sheet.png',
  './assets/sprites/enemies-sheet.png',
  './assets/sprites/ground-sheet.png',
  './assets/sprites/hera-turn-sheet.png',
  './assets/sprites/peacock-turn-sheet.png',
  './assets/sprites/peacock-exit-sheet.png',
  './assets/backgrounds/olympus.png',
  './assets/backgrounds/sky-clouds.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
