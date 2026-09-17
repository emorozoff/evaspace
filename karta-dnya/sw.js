/* Оракул Евы: офлайн-оболочка. Приложение открывается без интернета. */
const VERSION = 'oracle-v1';
const SHELL = [
  './', 'index.html', 'app.css', 'fonts.css', 'app.js',
  'data/zodiac.js', 'data/moon.js', 'data/decks.js', 'data/greeting.js',
  'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-64.png',
  'fonts/forum-400-cyrillic.woff2', 'fonts/forum-400-latin.woff2',
  'fonts/manrope-400-cyrillic.woff2', 'fonts/manrope-400-latin.woff2',
  'fonts/manrope-500-cyrillic.woff2', 'fonts/manrope-500-latin.woff2',
  'fonts/manrope-600-cyrillic.woff2', 'fonts/manrope-600-latin.woff2',
  'fonts/manrope-700-cyrillic.woff2', 'fonts/manrope-700-latin.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put('index.html', copy)); return res; })
        .catch(() => caches.match('index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
