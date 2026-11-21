// Version erhöhen, wenn du Dateien änderst, damit iPhones die neue Version laden
const CACHE = 'sudoku-v31';
const FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './sudoku.js',
  './bg.js',
  './paper.js',
  './sound.js',
  './manifest.json',
  './icons/icon-180.png?v=3',
  './icons/icon-192.png?v=3',
  './icons/icon-512.png?v=3',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Netzwerk zuerst, bei Offline aus dem Cache
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
