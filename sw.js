/* Eva Space — простой service worker: приложение открывается даже без интернета */
const VERSION = 'eva-v1-apps';
const BASE = '/evaspace/';
const SHELL = [BASE, BASE + 'index.html', BASE + 'manifest.webmanifest', BASE + 'icons/apple-touch-icon.png'];

/* На том же адресе рядом с Евой живут самостоятельные приложения: клуб,
   UPASS, «Оракул дня», видео. У каждого свой service worker и свой кэш,
   а этот обслуживает весь /evaspace/ — без исключения он перехватывал бы
   переходы в них и отдавал вместо них оболочку Евы. */
const STANDALONE = ['club/', 'klub/', 'u/', 'upass/', 'karta-dnya/', 'video/'];
const isStandalone = (pathname) => STANDALONE.some((name) => pathname.startsWith(BASE + name));

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
  if (isStandalone(url.pathname)) return;            // соседние приложения обслуживают себя сами

  // Навигация: сначала сеть, при офлайне — сохранённая оболочка приложения
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (url.pathname === BASE || url.pathname === BASE + 'index.html') {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(BASE + 'index.html', copy));
          }
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
