/* АСЬКА — service worker: приложение открывается и без интернета.
   Обслуживает только свою папку (/evaspace/aska/), соседей не трогает. */
const VERSION = 'aska1-v1';
const BASE = new URL('./', self.location).pathname;
const SHELL = ['', 'index.html', 'styles.css?v=1', 'app.js?v=1', 'art.js?v=1', 'brain.js?v=1', 'sounds.js?v=1', 'manifest.webmanifest', 'icons/flower.svg', 'icons/apple-touch-icon.png'].map((p) => BASE + p);

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k.startsWith('aska1-')).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(BASE + 'index.html', copy)); return res; })
        .catch(() => caches.match(BASE + 'index.html'))
    );
    return;
  }
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => { if (res && res.status === 200) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return res; })
        .catch(() => cached);
      return cached || network;
    })
  );
});
