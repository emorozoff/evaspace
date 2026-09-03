/* Eva Space — service worker.
   Приложение открывается даже без интернета: свежая версия берётся из сети,
   а если сети нет — из кэша. */
const VERSION = 'eva-v2';
const BASE = new URL('./', self.location).pathname;      // /evaspace/ на GitHub Pages
const SHELL = [BASE, BASE + 'index.html', BASE + 'manifest.json', BASE + 'icon.svg',
               BASE + 'icon-192.png', BASE + 'icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting())
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
  if (url.origin !== self.location.origin) return;   // шрифты и прочее с других доменов — мимо
  if (url.pathname.endsWith('.php')) return;         // обращения к серверу синхронизации не кэшируем

  // Открытие приложения: сначала сеть — чтобы сразу приходила новая версия
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

  // Иконки и манифест: отдаём из кэша, параллельно обновляем
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
