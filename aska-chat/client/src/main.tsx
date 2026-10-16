import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { start } from './lib/store.ts';
import { applyDesign, getDesign, unlockSoundOnFirstTouch } from './lib/aska.ts';
import './styles.css';

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

createRoot(document.getElementById('root')!).render(<App />);
start();
