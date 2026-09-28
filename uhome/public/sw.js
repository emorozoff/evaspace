/* Офлайн-режим UHOME CLUB.
   Страница — сначала из сети, без сети из кэша. Файлы сборки с хешем
   в имени не меняются, поэтому их берём из кэша сразу.
   Курсы валют ходят на чужие адреса — их не трогаем вовсе. */

const CACHE = 'uhome-v4';
const BASE = new URL('./', self.location).pathname; // /evaspace/uhome/
const SHELL = [BASE, BASE + 'index.html', BASE + 'manifest.webmanifest', BASE + 'icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('uhome-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
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
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(BASE + 'index.html', copy));
          }
          return res;
        })
        .catch(() => caches.match(BASE + 'index.html'))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
    )
  );
});
