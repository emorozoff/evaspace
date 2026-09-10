/* И АЙ КЛАБ — офлайн-оболочка. Путь вычисляем от самого файла,
   чтобы одна и та же сборка работала и на сайте, и внутри мобильной обёртки. */
const VERSION = 'club-v4';
const BASE = new URL('./', self.location).href;
const SHELL = [BASE, BASE + 'index.html', BASE + 'manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(VERSION)
      .then((c) => c.addAll(SHELL))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  // Навигация: сначала сеть, при офлайне — сохранённая оболочка
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(BASE + 'index.html', copy));
          return res;
        })
        .catch(() => caches.match(BASE + 'index.html').then((r) => r || caches.match(BASE)))
    );
    return;
  }

  // Статика: сначала кэш, параллельно обновляем
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
