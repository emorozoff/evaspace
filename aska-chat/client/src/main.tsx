import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { start } from './lib/store.ts';
import './styles.css';

// На iPhone клавиатура уменьшает видимую область — подгоняем приложение под неё.
function fitViewport() {
  const vv = window.visualViewport;
  const root = document.documentElement;
  root.style.setProperty('--vvh', `${vv ? vv.height : window.innerHeight}px`);
  root.style.setProperty('--vvtop', `${vv ? vv.offsetTop : 0}px`);
  root.classList.toggle('kb-open', !!vv && window.innerHeight - vv.height > 120);
}
window.visualViewport?.addEventListener('resize', fitViewport);
window.visualViewport?.addEventListener('scroll', fitViewport);
window.addEventListener('resize', fitViewport);
fitViewport();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch((e) => console.error('sw', e));

createRoot(document.getElementById('root')!).render(<App />);
start();
