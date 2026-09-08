import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../fonts.css';
import './styles.css';
import App from './App.jsx';
import { StoreProvider } from './lib/store.jsx';

if (!window.location.hash) window.location.replace(window.location.pathname + '#/');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>
);

if ('serviceWorker' in navigator && !window.__UPASS_EMBED__) {
  window.addEventListener('load', () => {
    // путь относительно страницы: работает и в общей сборке, и в отдельной папке
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
