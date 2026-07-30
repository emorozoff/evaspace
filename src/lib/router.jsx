import { useEffect, useState, useCallback } from 'react';

/* Маршрутизация через hash — чтобы работало на GitHub Pages
   и при добавлении приложения на экран «Домой». */

export function currentPath() {
  const h = window.location.hash || '#/';
  return h.replace(/^#/, '') || '/';
}

export function go(path, replace = false) {
  const h = '#' + (path.startsWith('/') ? path : '/' + path);
  if (replace) window.location.replace(h);
  else window.location.hash = h;
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

  // при переходе на новый экран всегда показываем его сверху
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      document.querySelectorAll('.screen, .onb-body').forEach((el) => (el.scrollTop = 0));
      window.scrollTo(0, 0);
    });
    return () => cancelAnimationFrame(id);
  }, [path]);

  const navigate = useCallback((p, r) => go(p, r), []);
  const parts = path.split('/').filter(Boolean);
  return { path, parts, navigate };
}
