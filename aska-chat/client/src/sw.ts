/// <reference lib="webworker" />
// Service worker: открывает приложение без сети и показывает уведомления.
import { buildNotification } from './sw-logic.ts';
import type { PushData } from './sw-logic.ts';
import { kvGet } from './lib/db.ts';

declare const self: ServiceWorkerGlobalScope;

const CACHE = 'aska-v2';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  if (url.pathname === '/site' || url.pathname.startsWith('/site/')) return; // сайт — не приложение: не кэшируем и не подменяем
  if (event.request.mode === 'navigate') {
    // Сначала сеть (чтобы получать обновления), без сети — сохранённая версия.
    event.respondWith((async () => {
      try {
        const res = await fetch(event.request);
        const cache = await caches.open(CACHE);
        cache.put('/', res.clone());
        return res;
      } catch {
        return (await caches.match('/')) || Response.error();
      }
    })());
    return;
  }
  // Дизайн «Аськи» (/aska/…) меняется без смены имени файла: показываем сохранённый и тут же обновляем.
  if (url.pathname.startsWith('/aska/') || url.pathname.startsWith('/sounds/')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(event.request);
      const fresh = fetch(event.request).then((res) => { if (res.ok) cache.put(event.request, res.clone()); return res; });
      if (hit) { event.waitUntil(fresh.catch(() => {})); return hit; }
      return fresh;
    })());
    return;
  }
  if (url.pathname.startsWith('/assets/') || SHELL.includes(url.pathname)) {
    event.respondWith((async () => {
      const hit = await caches.match(event.request);
      if (hit) return hit;
      const res = await fetch(event.request);
      if (res.ok) (await caches.open(CACHE)).put(event.request, res.clone());
      return res;
    })());
  }
});

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let data: PushData = {};
    try { data = event.data?.json() ?? {}; } catch { /* пустое уведомление */ }
    let n = { title: 'АСЬКА', body: 'Новое сообщение' };
    try {
      const [keys, users, chats] = await Promise.all([kvGet('keys'), kvGet('users'), kvGet('chats')]);
      n = buildNotification(data, { keys, users, chats });
    } catch { /* показываем общее уведомление: iPhone требует показать что-то на каждый пуш */ }
    await self.registration.showNotification(n.title, {
      body: n.body,
      icon: '/icons/icon-192.png',
      data: { chatId: data.c },
      ...(data.t === 'c' ? { tag: `call:${data.c}`, renotify: true, requireInteraction: true } : {}),
    } as NotificationOptions);
    const nav = self.navigator as WorkerNavigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (typeof data.b === 'number') {
      try { await (data.b > 0 ? nav.setAppBadge?.(data.b) : nav.clearAppBadge?.()); } catch { /* нет поддержки */ }
    }
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const chatId: string | undefined = event.notification.data?.chatId;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = all[0];
    if (client) {
      await client.focus();
      if (chatId) client.postMessage({ type: 'open-chat', chatId });
      return;
    }
    await self.clients.openWindow(chatId ? `/#chat=${encodeURIComponent(chatId)}` : '/');
  })());
});
