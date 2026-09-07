import { useCallback, useEffect, useState } from 'react';

/* Маршрутизация по hash: работает на GitHub Pages и после установки на экран «Домой». */

export function currentPath() {
  return (window.location.hash || '#/').replace(/^#/, '') || '/';
}

export function go(path, replace = false) {
  const h = '#' + (path.startsWith('/') ? path : '/' + path);
  if (replace) window.location.replace(h);
  else window.location.hash = h;
}

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

  useEffect(() => {
    const id = requestAnimationFrame(() => window.scrollTo(0, 0));
    return () => cancelAnimationFrame(id);
  }, [path]);

  const navigate = useCallback((p, r) => go(p, r), []);
  const [clean, qs] = path.split('?');
  const parts = clean.split('/').filter(Boolean);
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  return { path: clean, parts, query, navigate };
}
