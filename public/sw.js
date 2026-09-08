/* Eva Space — service worker: приложение открывается даже без интернета.
   Область видимости — вся папка /evaspace/, поэтому важно не трогать
   вложенные приложения: у UPASS свой service worker и своя оболочка. */
const VERSION = 'eva-v2';
const BASE = '/evaspace/';
const NESTED = ['/evaspace/upass/', '/evaspace/u/'];   // чужие приложения внутри той же папки
const SHELL = [BASE, BASE + 'index.html', BASE + 'manifest.webmanifest', BASE + 'icons/apple-touch-icon.png'];

const isNested = (pathname) => NESTED.some((p) => pathname.startsWith(p));

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (isNested(url.pathname)) return;   // отдаём запрос соседнему приложению как есть

  // Навигация: сначала сеть, при офлайне — сохранённая оболочка Eva Space
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
