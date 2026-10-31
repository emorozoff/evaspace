import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { start } from './lib/store.ts';
import { applyDesign, getDesign, unlockSoundOnFirstTouch } from './lib/aska.ts';
import './styles.css';
import './v5.css';
import './v6.css';
import './v7.css';
import './v8.css';
import './v9.css';
import './v10.css';
import './v11.css';

applyDesign(getDesign());
unlockSoundOnFirstTouch();

// На iPhone клавиатура уменьшает видимую область — стили «Аськи» берут высоту из --vvh.
function fitViewport() {
  const vv = window.visualViewport;
  document.documentElement.style.setProperty('--vvh', `${Math.round(vv ? vv.height : window.innerHeight)}px`);
}
window.visualViewport?.addEventListener('resize', fitViewport);
window.visualViewport?.addEventListener('scroll', () => window.scrollTo(0, 0));
window.addEventListener('resize', fitViewport);
fitViewport();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch((e) => console.error('sw', e));

// На iPhone приложение с экрана «Домой» неделями живёт в памяти и не видит новую версию.
// Запоминаем версию сервера при запуске; вышла новая — тихо перезапускаемся, когда АСЬКУ снова открыли.
let bootVersion = '';
async function serverVersion() {
  try { return String((await (await fetch('/api/health', { cache: 'no-store' })).json()).version || ''); } catch { return ''; }
}
serverVersion().then((v) => { bootVersion = v; });
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible') return;
  const v = await serverVersion();
  if (!bootVersion) bootVersion = v; // запустились без связи — запоминаем сейчас
  else if (v && v !== bootVersion) location.reload();
});

createRoot(document.getElementById('root')!).render(<App />);
start();
