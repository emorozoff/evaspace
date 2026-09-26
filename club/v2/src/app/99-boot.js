/* Запуск: подключаемся к базе (или к браузеру), затем рисуем штаб. */

(async function boot() {
  const mark = $('.boot-mark');
  if (mark) mark.innerHTML = brandIcon();
  const msg = $('#bootMsg');
  const slow = setTimeout(() => { if (msg) msg.textContent = 'База отвечает медленно — ещё пара секунд…'; }, 4000);
  try { await Store.init(); } catch (e) { console.error('Хранилище не поднялось', e); }
  clearTimeout(slow);
  App.start();
  TaskNotify.init();
  /* для проверок и отладки из консоли */
  window.__eva = {Store, Auth, App, Tasks, Inbox, settings, Sales, Plan, Money, cashFlow, pnl, quarterPace};
})();