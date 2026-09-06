/* Eva Space — service worker.
   Приложение открывается даже без интернета: свежая версия берётся из сети,
   а если сети нет — из кэша. */
const VERSION = 'eva-v4';   // поднимаем номер, чтобы старый кэш очистился
const BASE = new URL('./', self.location).pathname;      // /evaspace/ на GitHub Pages
/* Без BASE: это тот же файл, что BASE + 'index.html', и при установке
   приложение скачивалось дважды. Из кэша его берут по полному имени. */
const SHELL = [BASE + 'index.html', BASE + 'manifest.json', BASE + 'icon.svg',
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

  // Открытие приложения: сначала кэш, обновление — фоном.
  // Раньше здесь была сеть: приложение при каждом запуске ждало восемьсот
  // килобайт, даже когда они уже лежали в кэше, и на мобильном интернете
  // это были секунды белого экрана. Теперь оно открывается сразу, а свежая
  // версия скачивается следом и применяется при следующем запуске —
  // если изменилась, приложение об этом скажет.
  if (req.mode === 'navigate') {
    e.respondWith(
      caches.match(BASE + 'index.html').then((cached) => {
        const fresh = fetch(req)
          .then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(BASE + 'index.html', copy));
              if (cached) tellIfNew(cached.clone(), res.clone());
            }
            return res;
          })
          .catch(() => cached);
        return cached || fresh;
      })
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

/* =====================================================================
   Напоминания от Евы
   Приходят даже когда приложение закрыто. Всего два в неделю: итоги
   в понедельник и напоминание в субботу — так обещано при подписке.
   ===================================================================== */
/* Сравниваем размер: если с сервера пришло другое приложение, говорим
   об этом открытым вкладкам — они предложат обновиться, а не подменят
   страницу под руками. */
function tellIfNew(oldRes, newRes) {
  Promise.all([oldRes.text(), newRes.text()])
    .then(([a, b]) => {
      if (a.length === b.length) return;
      return self.clients.matchAll({ type: 'window' })
        .then((list) => list.forEach((c) => c.postMessage({ eva: 'update' })));
    })
    .catch(() => {});
}

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { b: e.data ? e.data.text() : '' }; }
  const title = d.t || 'Eva Space';
  e.waitUntil(self.registration.showNotification(title, {
    body: d.b || '',
    icon: BASE + 'icon-192.png',
    badge: BASE + 'icon-192.png',
    tag: d.k || 'eva',
    renotify: false,
    data: { url: d.u || BASE }
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const want = (e.notification.data && e.notification.data.url) || BASE;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      /* приложение уже открыто — просто выводим его вперёд */
      for (const c of list) {
        if (c.url.indexOf(self.location.origin) === 0 && 'focus' in c) return c.focus();
      }
      return self.clients.openWindow(want);
    })
  );
});
