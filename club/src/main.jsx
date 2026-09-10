import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App.jsx';
import { StoreProvider } from './lib/store.jsx';
import Boundary from './components/Boundary.jsx';

if (!window.location.hash) window.location.replace(window.location.pathname + '#/');

// Кнопку установки показываем на экране «Установить на телефон»
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__installPrompt = e;
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Boundary>
      <StoreProvider>
        <App />
      </StoreProvider>
    </Boundary>
  </StrictMode>
);

/* Офлайн-режим: приложение открывается даже без интернета.
   При выходе новой сборки старый кэш умеет отдать index.html, который
   ссылается на уже удалённые файлы, — поэтому обновление подхватываем сразу
   и один раз перезагружаем страницу. */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js');
      reg.addEventListener('updatefound', () => {
        const fresh = reg.installing;
        if (!fresh) return;
        fresh.addEventListener('statechange', () => {
          if (fresh.state === 'installed' && navigator.serviceWorker.controller) fresh.postMessage('skip-waiting');
        });
      });
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded) return;
        reloaded = true;
        window.location.reload();
      });
    } catch {
      /* без service worker приложение всё равно работает */
    }
  });
}
