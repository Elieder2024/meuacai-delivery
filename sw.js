const CACHE_NAME = 'nunuacai-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css?v=2.0',
  '/app.js?v=2.0',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
