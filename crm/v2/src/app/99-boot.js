/* Запуск: общая база или браузер, кто открыл — и рисуем. Вне артефакта
   при первом открытии загружаем пример, чтобы было на что посмотреть. */

(async function boot() {
  const mark = $('.boot-mark');
  if (mark) mark.innerHTML = brandIcon();
  const msg = $('#bootMsg');
  const slow = setTimeout(() => { if (msg) msg.textContent = 'База отвечает медленно — ещё пара секунд…'; }, 4000);
  try { await Promise.all([Store.init(), Who.init()]); } catch (e) { console.error('Хранилище не поднялось', e); }
  clearTimeout(slow);
  /* CRM переехала на свой сервер (CRM_HOME). Копия в артефакте Claude заморожена: если её
     опубликуют снова, там должна открыться эта табличка, а не CRM со старыми данными. */
  if (Store.state.mode !== 'local' && !onServer()) {
    App.render = App.renderSoon = () => {};
    const t = $('#boot b');
    if (t) t.textContent = 'Eva CRM переехала';
    if (msg) msg.innerHTML = `Теперь она работает по адресу <a href="${CRM_HOME}" target="_blank" rel="noopener">${CRM_HOME.replace(/^https:\/\/|\/$/g, '')}</a> — вход по учётке штаба. Копия в Claude больше не обновляется.`;
    return;
  }
  if (Store.state.mode === 'local' && !Store.total() && !Local.get('eva-crm2-seeded', false)) {
    Local.set('eva-crm2-seeded', true);
    await Demo.load();
  }
  App.start();
  window.__eva = {Store, Who, App, View, People, Questions, Stats, Codec, Import, Demo, recommendations};
})();
