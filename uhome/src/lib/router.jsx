import { useEffect, useState } from 'react';

/* Маршрутизация по hash (#/path): работает на GitHub Pages и после
   установки на экран «Домой», где у приложения нет своего сервера. */

export function currentPath() {
  return (window.location.hash || '#/').replace(/^#/, '') || '/';
}

export function go(path, replace = false) {
  const h = '#' + (path.startsWith('/') ? path : '/' + path);
  if (replace) window.location.replace(h);
  else window.location.hash = h;
}

/* Назад — по истории, а если в неё пришли по прямой ссылке, то на запасной экран. */
export function back(fallback = '/') {
  if (window.history.length > 1) window.history.back();
  else go(fallback);
}

export function useRoute() {
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    const on = () => setPath(currentPath());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  // Новый экран открывается сверху, а не с середины прошлого списка
  useEffect(() => {
    const id = requestAnimationFrame(() => window.scrollTo(0, 0));
    return () => cancelAnimationFrame(id);
  }, [path]);

  const [clean, qs] = path.split('?');
  const parts = clean.split('/').filter(Boolean);
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  return { path: clean, full: path, parts, query };
}
