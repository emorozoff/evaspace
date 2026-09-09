import { useCallback, useEffect, useState } from 'react';

/* Маршрутизация по hash — работает и на GitHub Pages,
   и внутри установленного на телефон приложения. */

export function currentPath() {
  return (window.location.hash || '#/').replace(/^#/, '') || '/';
}

export function go(path, replace = false) {
  const hash = '#' + (path.startsWith('/') ? path : '/' + path);
  if (replace) window.location.replace(hash);
  else window.location.hash = hash;
}

export function back() {
  if (window.history.length > 1) window.history.back();
  else go('/');
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

  return { path, parts: path.split('/').filter(Boolean), navigate: useCallback((p, r) => go(p, r), []) };
}
