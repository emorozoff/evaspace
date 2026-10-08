/* АСЬКА — service worker: приложение открывается и без интернета.
   Обслуживает только свою папку (/evaspace/aska/), соседей не трогает. */
const VERSION = 'aska-v14';
const BASE = new URL('./', self.location).pathname;
const SHELL = ['', 'index.html', 'styles.css?v=13', 'aero.css?v=3', 'app.js?v=14', 'store.js?v=1', 'secure.js?v=1', 'art.js?v=6', 'brain.js?v=10', 'music.js?v=4', 'cinema.js?v=3', 'sounds.js?v=4', 'manifest.webmanifest', 'icons/flower.svg', 'icons/apple-touch-icon.png', 'promo/', 'promo/index.html', 'promo/promo.css?v=2', 'promo/promo.js?v=2'].map((p) => BASE + p);

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k.startsWith('aska-')).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  // у дизайна «Миллениал» (v2/) и простой v1 свои service worker'ы — их страницы не трогаем
  if (/^(v1|v2)\//.test(url.pathname.slice(BASE.length))) return;

  if (req.mode === 'navigate') {
    // кладём страницу под её собственным адресом: промо не должно подменить главную
    const key = url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname;
    e.respondWith(
      fetch(req)
        .then((res) => { if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(key, copy)); } return res; })
        .catch(() => caches.match(key).then((r) => r || caches.match(BASE + 'index.html')))
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
