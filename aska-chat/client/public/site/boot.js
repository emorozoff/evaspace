// Подача сайта выбирается до отрисовки, чтобы не мигала чужая: ?style=m|z → сохранённый выбор → дизайн из самой АСЬКИ → Зумер.
(() => {
  let s = null;
  try {
    s = localStorage.getItem('aska-site-style');
    if (!s && localStorage.getItem('aska-design') === 'millennial') s = 'm';
  } catch (e) { /* приватный режим */ }
  const q = /[?&#]style=([zm])\b/.exec(location.search + location.hash);
  if (q) s = q[1];
  const root = document.documentElement;
  root.dataset.style = s === 'm' ? 'm' : 'z';
  root.classList.add('js');
})();
