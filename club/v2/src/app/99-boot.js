/* Запуск: подключаемся к базе (или к браузеру), затем рисуем штаб. */

(async function boot() {
  const mark = $('.boot-mark');
  if (mark) mark.innerHTML = brandIcon();
  const msg = $('#bootMsg');
  const slow = setTimeout(() => { if (msg) msg.textContent = 'База отвечает медленно — ещё пара секунд…'; }, 4000);
  /* кто смотрит (аккаунт Claude) — в фоне: где площадка не отвечает, это до 10 с */
  Auth.initIdentity().then(() => { App.renderSoon(); App.paintSync(Store.state); });
  try { await Store.init(); } catch (e) { console.error('Хранилище не поднялось', e); }
  clearTimeout(slow);
  App.start();
  TaskNotify.init();
  MsgNotify.init();
  MeetRemind.start();
  /* для проверок и отладки из консоли */
  window.__eva = {Store, Auth, App, Tasks, Inbox, settings, Sales, Plan, Money, cashFlow, pnl, quarterPace, Sound, Strategy, openWelcome, inviteLink, inviteText, Adam, Chat, Msgs, MsgNotify, MeetRemind, Cal, openGEvent, remindGuests, openTask};
})();