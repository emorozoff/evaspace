/* Запуск: общая база или браузер, кто открыл — и рисуем. Вне артефакта
   при первом открытии загружаем пример, чтобы было на что посмотреть. */

(async function boot() {
  const mark = $('.boot-mark');
  if (mark) mark.innerHTML = brandIcon();
  const msg = $('#bootMsg');
  const slow = setTimeout(() => { if (msg) msg.textContent = 'База отвечает медленно — ещё пара секунд…'; }, 4000);
  try { await Promise.all([Store.init(), Who.init()]); } catch (e) { console.error('Хранилище не поднялось', e); }
  clearTimeout(slow);
  if (Store.state.mode === 'local' && !Store.total() && !Local.get('eva-crm2-seeded', false)) {
    Local.set('eva-crm2-seeded', true);
    await Demo.load();
  }
  App.start();
  window.__eva = {Store, Who, App, View, People, Questions, Stats, Codec, Import, Demo, recommendations};
})();
