/* Настройки: команда, как работает единая ссылка, пример данных, выгрузка
   ответов для анализа. */

App.register('settings', {
  title: 'Настройки',
  render(root) {
    const own = Who.can('team') && !Who.readOnly();
    const canEdit = People.canEdit();
    const s = settings();
    const team = Team.all();
    root.innerHTML = `
      ${pageHead('Настройки', 'Команда, единая ссылка, пример данных и выгрузка ответов.')}
      <div class="two">
        <div class="card"><div class="card-head"><h2>Одна ссылка на человека</h2></div>
          <p class="note" style="margin-bottom:8px">У каждого человека свой код, например <span class="code">ANNA482</span>. Ссылка с ним работает для всего сразу:</p>
          <ol class="legal"><li><b>Анкета.</b> Человек открывает ссылку и отвечает на вопросы кнопками.</li>
            <li><b>Ответы возвращаются.</b> В конце он нажимает «Отправить» и присылает менеджеру ссылку, которая одним нажатием кладёт ответы в карточку.</li>
            <li><b>Рефералка.</b> Если по ссылке придёт подруга, она выберет «Меня пригласили», и в её карточке будет видно, кто её привёл.</li></ol>
          <label class="field" style="margin-top:10px"><span>Адрес публичной анкеты</span><input class="input" id="stAnk" value="${esc(s.anketaUrl || '')}" ${own ? '' : 'disabled'}><small>Анкета — отдельная страница: откройте к ней доступ по ссылке, чтобы её видели люди вне команды.</small></label>
        </div>
        <div class="card"><div class="card-head"><h2>Команда и доступ</h2><a class="note" href="#team">Открыть →</a></div>
          <p class="note" style="margin-bottom:8px">В команде ${team.length} ${plural(team.length, 'человек', 'человека', 'человек')}${Team.pending().length ? `, ждут подтверждения — ${Team.pending().length}` : ''}${Team.invited().length ? `, приглашены — ${Team.invited().length}` : ''}. Главная — ${esc(Team.headName())}.</p>
          <p class="note">Новые люди регистрируются сами: с кодом приглашения — сразу, без кода — после подтверждения главной.</p></div>
        <div class="card"><div class="card-head"><h2>Выгрузить ответы</h2></div>
          <p class="note" style="margin-bottom:10px">Таблица CSV для Excel или Google Таблиц: одна строка — один человек, столбцы — вопросы анкеты и заметки созвона.</p>
          <div class="row">${Object.keys(TYPES).map(k => `<button class="btn sm" data-csv="${k}">${icon('download')}${groupName(k)}</button>`).join('')}</div></div>
        <div class="card"><div class="card-head"><h2>Пример данных</h2>${Demo.present() ? '<span class="pill violet">загружен</span>' : ''}</div>
          <p class="note" style="margin-bottom:10px">Вымышленные клиентки, эксперты, партнёры и амбассадоры на разных шагах — посмотреть, как всё работает. Ваши записи не трогаем.</p>
          ${canEdit ? `<div class="row">${Demo.present() ? `<button class="btn danger sm" data-demo-clear>${icon('trash')}Удалить пример</button>` : ''}<button class="btn sm ${Demo.present() ? '' : 'primary'}" data-demo-load>${Demo.present() ? 'Загрузить заново' : 'Загрузить пример'}</button></div>` : ''}</div>
      </div>
      <p class="note" style="margin-top:16px">Первая, подробная версия CRM сохранена как черновик. Роли разделяют интерфейс, а не данные: у кого есть доступ к странице, тот видит общую базу. Реальные персональные данные в рабочей версии храните на сервере в России.</p>`;

    const ank = $('#stAnk', root);
    if (ank) ank.onchange = () => Store.patch('cfg', 'settings', {anketaUrl: ank.value.trim()});
    on(root, 'click', '[data-demo-load]', async (e, el) => { el.disabled = true; el.textContent = 'Загружаю…'; const n = await Demo.load(); toast(`🧪 Загружено: ${n}`); });
    on(root, 'click', '[data-demo-clear]', async (e, el) => { if (!await confirmPop(el, {text: 'Удалить пример? Ваши записи останутся.', yes: 'Удалить', danger: true})) return; const n = await Demo.clear(); toast(`Удалено: ${n}`); });
    on(root, 'click', '[data-csv]', (e, el) => exportCsv(el.dataset.csv));
  },
});

function exportCsv(type) {
  const qs = Questions.set(type).test, talk = Questions.set(type).talk;
  const list = People.all(type);
  const head = ['Имя', 'Код', 'Город', 'Шаг', 'Анкета', 'Созвон', 'Итог', ...qs.map(q => noEmo(q.t)), ...talk.map(q => 'Созвон: ' + q.t), 'Метки', 'Главное', 'Заметка'];
  const rows = list.map(p => [People.name(p), p.code, p.city || '', ['', 'Анкета', 'Созвон', 'Итог'][People.col(p)], (S1[p.s1] || {}).name || '', (S2[p.s2] || {}).name || '', (s3Map(type)[p.s3] || {}).name || '',
    ...qs.map(q => answerLabels(q, (p.answers || {})[q.id]).map(noEmo).join(', ')), ...talk.map(q => ((p.talk || {})[q.id] || {}).a || ''),
    ((p.res || {}).tags || []).map(noEmo).join(', '), (p.res || {}).main || (p.res || {}).next || '', (p.res || {}).note || (p.res || {}).idea || '']);
  const data = csvOf([head, ...rows]);
  (async () => {
    let dl = null;
    try { dl = window.claude && typeof window.claude.use === 'function' ? await window.claude.use('downloads') : null; } catch (e) { dl = null; }
    if (dl) { try { await dl.save({filename: `eva-${type}-${today()}.csv`, data}); toast('📤 Таблица сохранена'); return; } catch (e) { if (e && e.code === 'declined') return; } }
    copyOrShow(data, '📋 Таблица скопирована — вставьте в Google Таблицы');
  })();
}
