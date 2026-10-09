/* Запуск: подключаемся к общей базе (или к браузеру) и узнаём, кто открыл
   CRM, затем рисуем. Вне артефакта при первом открытии загружаем пример,
   чтобы было на чём посмотреть; в общей базе пример загружает руководитель. */

(async function boot() {
  const mark = $('.boot-mark');
  if (mark) mark.innerHTML = brandIcon();
  const msg = $('#bootMsg');
  const slow = setTimeout(() => { if (msg) msg.textContent = 'База отвечает медленно — ещё пара секунд…'; }, 4000);
  try { await Promise.all([Store.init(), Who.init()]); } catch (e) { console.error('Хранилище не поднялось', e); }
  clearTimeout(slow);
  if (Store.state.mode === 'local' && !Store.total() && !Local.get('eva-crm-seeded', false)) {
    if (msg) msg.textContent = 'Готовлю пример базы…';
    Local.set('eva-crm-seeded', true);
    await Demo.load();
  }
  App.start();
  /* для проверок из консоли */
  window.__eva = {Store, Who, App, View, Clients, Referral, Demo, cx, settings};
})();
