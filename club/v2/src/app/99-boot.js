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
  /* Штаб переехал на свой сервер (HQ_HOME). Копия в артефакте Claude заморожена: если её
     опубликуют снова, там должна открыться эта табличка, а не штаб со старыми данными —
     иначе записи разойдутся между двумя местами. Просто в браузере (без базы) штаб работает как раньше. */
  if (Store.state.mode === 'db') {
    App.render = App.renderSoon = () => {};
    const t = $('#boot b');
    if (t) t.textContent = 'Штаб Eva Club переехал';
    if (msg) msg.innerHTML = `Теперь он работает по адресу <a href="${HQ_HOME}" target="_blank" rel="noopener">${HQ_HOME.replace(/^https:\/\/|\/$/g, '')}</a> — входите прежней почтой и паролем. Копия в Claude больше не обновляется.`;
    return;
  }
  App.start();
  TaskNotify.init();
  MsgNotify.init();
  MeetRemind.start();
  FinNotify.init();
  /* для проверок и отладки из консоли */
  window.__eva = {Store, Auth, App, Tasks, Inbox, settings, Sales, Plan, Money, cashFlow, pnl, quarterPace, Sound, Strategy, openWelcome, inviteLink, inviteText, Adam, Chat, Msgs, MsgNotify, MeetRemind, Cal, openGEvent, remindGuests, openTask, Fin, Subs, Market, unitEcon, FinNotify};
})();