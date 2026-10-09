/* Настройки: команда и роли, воронки и этапы, сегменты с условиями, теги,
   интеграции, схема базы и данные (демо, выгрузка, очистка). */

const INTEGRATIONS = [
  {id: 'tg', icon: 'send', name: 'Telegram', what: ['Бот Евы: входящие и ответы из CRM', 'Личные аккаунты менеджеров — через Wazzup24 или Radist.Online', 'Групповые чаты: сообщения из CRM уходят в общий чат, ответы участниц приходят в карточки'], how: 'Бот — токен от @BotFather на сервере интеграций, вебхук в CRM. Личные аккаунты — сервис-посредник с API.'},
  {id: 'wa', icon: 'msg', name: 'WhatsApp', what: ['Переписка в карточке клиентки', 'Шаблоны и рассылки тем, кто дал согласие'], how: 'Wazzup24 или Green API для номера менеджера; официальный WhatsApp Business API — через провайдера. В России звонки в WhatsApp ограничены с 2025 года, возможны сбои — дублируйте важное в Telegram, MAX или SMS.'},
  {id: 'max', icon: 'msg', name: 'MAX', what: ['Резервный мессенджер на случай блокировок', 'Бот для уведомлений'], how: 'API ботов MAX (VK). Подключается так же, как Telegram-бот.'},
  {id: 'call', icon: 'phone', name: 'Телефония и записи звонков', what: ['Звонок из карточки в один клик', 'Входящие открывают карточку', 'Запись разговора и длительность — в ленте', 'Расшифровка и краткий итог звонка (SpeechKit + ИИ)'], how: 'Манго Офис, UIS, Zadarma или Sipuni: вебхуки о звонках и ссылки на записи. Предупреждайте клиентку, что разговор записывается.'},
  {id: 'email', icon: 'mail', name: 'Почта', what: ['Письма из карточки', 'Рассылки по сегментам со статистикой открытий', 'Отписка в один клик'], how: 'UniSender, Dashamail или SendPulse. Своя подпись домена (SPF, DKIM), иначе письма уйдут в спам.'},
  {id: 'push', icon: 'bell', name: 'Пуш-уведомления', what: ['Пуши в приложение Eva Space', 'Не чаще 2 в неделю — ограничение встроено'], how: 'Firebase Cloud Messaging для веб-приложения и Android, RuStore Push — для российских Android-устройств.'},
  {id: 'sms', icon: 'msg', name: 'SMS', what: ['Коды, напоминания об оплате и встречах'], how: 'SMS.ru, SMSC или SMS Aero. Рекламные SMS — только с согласием и зарегистрированным именем отправителя.'},
  {id: 'pay', icon: 'card', name: 'Оплаты', what: ['Оплаты и возвраты сами падают в карточку', 'Первая оплата переводит в «Оплата получена»', 'Ссылка на оплату из карточки'], how: 'ЮKassa, CloudPayments или Продамус: вебхук об оплате с id клиентки. Автопродления подписки — рекуррентные платежи.'},
  {id: 'app', icon: 'db', name: 'Приложение Eva Space', what: ['Регистрация создаёт карточку с анкетой', 'Согласия с датой и версией документа', 'Активность: звёзды, практики, баллы, последний вход', 'Заявки экспертов и партнёров'], how: 'Вебхуки приложения: регистрация, анкета, согласие, оплата, активность раз в сутки. Связь по ID в приложении.'},
  {id: 'hq', icon: 'chart', name: 'Штаб Eva Club', what: ['Цифры дня — регистрации, оплаты, продления — без ручного ввода', 'Премия команды считается по факту из CRM'], how: 'Раз в сутки CRM отправляет сводку в «Отчёты → Цифры дня» штаба.'},
];

App.register('settings', {
  title: 'Настройки',
  render(root) {
    const tab = View.get('st.tab', 'team');
    const canEdit = Who.can('settings.edit') && !Who.readOnly();
    const canFunnels = Who.can('funnels.edit') && !Who.readOnly();
    let body = '';

    if (tab === 'team') {
      const team = Team.all(true);
      body = `<div class="help"><div><b>Как добавить сотрудника.</b> Откройте доступ к этой CRM в меню «Поделиться» артефакта. Когда человек откроет CRM, он появится здесь с ролью «Менеджер» — поменяйте роль. Сотрудников без входа (например, стажёров) можно добавить вручную, чтобы назначать им клиенток.
        <br><span class="note">Роли разделяют интерфейс. Граница доступа — сам артефакт: у кого есть доступ, тот технически может прочитать общую базу. Реальные персональные данные клиенток храните в производственной версии на российском сервере (см. ТЗ).</span></div></div>
        <div class="table-wrap"><table class="t"><thead><tr><th>Сотрудник</th><th>Роль</th><th>Должность</th><th>Вход</th><th class="r">Клиенток</th><th></th></tr></thead><tbody>
        ${team.map(m => `<tr class="${m.archived ? 'dim' : ''}"><td><span class="row" style="gap:8px;align-items:center;flex-wrap:nowrap">${Team.av(m)}${canEdit ? `<input class="input sm" data-tname="${m.id}" value="${esc(m.name || '')}" placeholder="${esc(Team.name(m))}" style="width:190px">` : `<b>${esc(Team.name(m))}</b>`}</span></td>
          <td>${canEdit && m.uid !== Who.uid ? `<select class="select sm" data-trole="${m.id}" style="width:auto">${Object.entries(ROLES).map(([k, r]) => opt(k, r.name, roleOf(m.role))).join('')}</select>` : `<span class="pill ${ROLES[roleOf(m.role)].tone}">${ROLES[roleOf(m.role)].name}</span>`}</td>
          <td>${canEdit ? `<input class="input sm" data-ttitle="${m.id}" value="${esc(m.title || '')}" style="width:190px">` : esc(m.title || '')}</td>
          <td>${m.uid ? (m.uid === Who.uid ? '<span class="pill good">это вы</span>' : '<span class="pill good">через Claude</span>') : '<span class="pill">без входа</span>'}</td>
          <td class="r">${Clients.all().filter(c => c.manager === m.id).length}</td>
          <td class="r">${canEdit && m.uid !== Who.uid ? `<div class="row" style="gap:4px;justify-content:flex-end"><button class="btn xs" data-as="${m.id}" title="Посмотреть CRM глазами сотрудника">${icon('eye')}Как видит</button><button class="btn xs ghost" data-tarch="${m.id}">${m.archived ? 'Вернуть' : 'В архив'}</button></div>` : ''}</td></tr>`).join('')}
        </tbody></table></div>
        ${canEdit ? `<form class="row" id="addMember" style="margin-top:12px"><input class="input" id="nmName" placeholder="Имя и фамилия" style="max-width:260px"><select class="select" id="nmRole" style="max-width:200px">${Object.entries(ROLES).map(([k, r]) => opt(k, r.name, 'manager')).join('')}</select><button class="btn" type="submit">${icon('plus')}Добавить без входа</button></form>` : ''}
        <section class="section"><h2 style="margin-bottom:10px">Что видит каждая роль</h2><div class="table-wrap"><table class="t"><thead><tr><th>Роль</th><th>Что делает</th></tr></thead><tbody>${Object.values(ROLES).map(r => `<tr><td><span class="pill ${r.tone}">${r.name}</span></td><td>${esc(r.about)}</td></tr>`).join('')}</tbody></table></div></section>`;
    } else if (tab === 'funnels') {
      const fid = View.get('st.fn', 'sales');
      const f = Funnels.get(fid) || Funnels.get('sales');
      const counts = st => entityList(f.entity).filter(e => Funnels.of(f.entity, e) === f.id && e.stage === st).length;
      body = `<div class="t-bar"><div class="seg">${Funnels.list().map(x => `<button data-stfn="${x.id}" class="${x.id === f.id ? 'on' : ''}">${esc(x.name)}</button>`).join('')}</div><span class="t-bar-sp"></span>${canFunnels ? `<button class="btn sm" data-new-funnel>${icon('plus')}Воронка для клиенток</button>` : ''}</div>
        <div class="card"><div class="grid2"><label class="field"><span>Название воронки</span><input class="input" id="fnName" value="${esc(f.name)}" ${canFunnels ? '' : 'disabled'}></label><label class="field"><span>Для кого</span><input class="input" value="${esc({clients: 'Клиентки', experts: 'Эксперты', partners: 'Партнёры'}[f.entity])}" disabled></label></div>
          <label class="field" style="margin-top:10px"><span>Описание</span><textarea class="textarea" id="fnAbout" ${canFunnels ? '' : 'disabled'}>${esc(f.about || '')}</textarea></label></div>
        <div class="stack section" id="stages">${f.stages.map((s, i) => `<div class="card flat" data-si="${i}" style="padding:12px 14px">
          <div class="row" style="align-items:center"><b style="width:22px">${i + 1}</b><input class="input" data-k="name" value="${esc(s.name)}" style="flex:1 1 200px;max-width:320px" ${canFunnels ? '' : 'disabled'}>
            <label class="check"><input type="checkbox" data-k="won" ${s.won ? 'checked' : ''} ${canFunnels ? '' : 'disabled'}>Цель воронки (оплата, запуск)</label><span class="note">сейчас: ${counts(s.id)}</span><span class="sp"></span>
            ${canFunnels ? `<button class="icon-btn" data-up="${i}" title="Выше" ${i ? '' : 'disabled'}>▲</button><button class="icon-btn" data-down="${i}" title="Ниже" ${i < f.stages.length - 1 ? '' : 'disabled'}>▼</button><button class="icon-btn" data-rm-stage="${i}" title="Удалить этап">${icon('trash')}</button>` : ''}</div>
          <textarea class="textarea" data-k="about" style="margin-top:8px;min-height:44px" placeholder="Критерий входа: что должно случиться, чтобы перенести карточку сюда" ${canFunnels ? '' : 'disabled'}>${esc(s.about || '')}</textarea></div>`).join('')}</div>
        ${canFunnels ? `<div class="row" style="margin-top:12px"><button class="btn" data-add-stage>${icon('plus')}Этап</button><span class="sp"></span><button class="btn primary" data-save-funnel>Сохранить воронку</button></div>` : ''}
        <p class="note" style="margin-top:10px">Этап с карточками удалить нельзя — сначала перенесите их. «Отказ» есть в каждой воронке и не удаляется.</p>`;
    } else if (tab === 'segments') {
      const segs = Segments.all();
      body = `<p class="note" style="margin-bottom:12px">Сегмент — группа по условиям: ниша, город, анкета, теги, деньги, активность. Клиентка попадает в первый подходящий сегмент по порядку; вручную его можно сменить в карточке. Сегменты делят воронку на доске и в отчётах, по ним собираются рассылки.</p>
        <div class="stack">${segs.map(sg => {
          const n = Clients.all().filter(c => (cx(c).segment || {}).id === sg.id).length;
          const any = Clients.all().filter(c => Segments.test(sg, c)).length;
          return `<div class="card"><div class="card-head"><div class="row" style="align-items:center;gap:10px"><i class="dot" style="background:${esc(sg.color)};width:12px;height:12px;flex-basis:12px"></i><h2>${esc(sg.name)}</h2><span class="pill">${n} ${plural(n, 'клиентка', 'клиентки', 'клиенток')}</span>${any > n ? `<span class="note">подходят ${any}, часть попала в сегмент выше</span>` : ''}</div>
            ${canFunnels ? `<button class="btn sm" data-seg-edit="${sg.id}">${icon('edit')}Условия</button>` : ''}</div>
            <div class="rule-txt">${(sg.rules || []).map((r, i) => `${i ? `<span class="and">${sg.match === 'any' ? 'или' : 'и'}</span>` : ''}<span class="pill line">${esc(ruleText(r))}</span>`).join('') || '<span class="muted">условий нет — только ручной выбор</span>'}</div>
            ${sg.offer ? `<p class="note" style="margin-top:8px"><b>Условия для сегмента:</b> ${esc(sg.offer)}</p>` : ''}</div>`;
        }).join('')}</div>
        ${canFunnels ? `<button class="btn primary" style="margin-top:12px" data-seg-edit="">${icon('plus')}Сегмент</button>` : ''}`;
    } else if (tab === 'tags') {
      const tags = Tags.all();
      const cnt = Tags.count();
      const groups = [...new Set(tags.map(t => t.group))];
      body = `<p class="note" style="margin-bottom:12px">Теги — быстрые метки: статус, интерес, поведение, событие. Группа помогает не плодить похожие теги. Теги ставятся в карточке, массово в таблице и при загрузке базы.</p>
        <div class="two">${groups.map(g => `<div class="card"><div class="mini-h"><h3>${esc(g)}</h3></div>${tags.filter(t => t.group === g).map(t => `<div class="kv"><span>${tagChip(t.id)}</span><b>${cnt[t.id] || 0} ${canFunnels ? `<button class="btn xs ghost" data-tag-edit="${t.id}">${icon('edit')}</button>` : ''}</b></div>`).join('')}</div>`).join('')}</div>
        ${canFunnels ? `<button class="btn primary" style="margin-top:12px" data-tag-edit="">${icon('plus')}Тег</button>` : ''}`;
    } else if (tab === 'integrations') {
      const st = Cfg.list('integrations') || {};
      body = `<div class="help"><div><b>Как это устроено.</b> CRM хранит историю и показывает её, а сообщения, звонки и оплаты приходят через сервер интеграций (вебхуки). Ключи доступа хранятся только на этом сервере, не в CRM. Пока канал не подключён, всё работает в демо-режиме: ответы сохраняются в истории, а отправить их можно по ссылке «Открыть в Telegram / WhatsApp».</div></div>
        <div class="integ">${INTEGRATIONS.map(x => {
          const on_ = (st[x.id] || {}).status === 'on';
          return `<div class="card"><div class="integ-h"><span class="ico">${icon(x.icon)}</span><b>${esc(x.name)}</b><span class="pill ${on_ ? 'good' : ''}">${on_ ? 'Подключено' : 'Демо-режим'}</span></div>
            <ul>${x.what.map(w => `<li>${esc(w)}</li>`).join('')}</ul>
            <p class="note">${esc(x.how)}</p>
            ${canEdit ? `<div class="row"><button class="btn sm" data-integ="${x.id}">${on_ ? 'Отключить' : 'Отметить подключённым'}</button></div>` : ''}</div>`;
        }).join('')}</div>`;
    } else if (tab === 'schema') {
      const EV_SCHEMA = [['kind', 'вид: msg, call, camp, pay, note, task, stage, meet, sys'], ['t', 'время, мс'], ['by', 'кто из команды'], ['ch', 'канал: tg, wa, max, email, sms, push'], ['dir', 'in / out'], ['text', 'текст, итог, заметка'], ['dur, result, rec', 'звонок: длительность, итог, ссылка на запись'], ['type, amount, method, status, item, expertId', 'оплата'], ['title, due, who, done', 'задача'], ['from, to, funnel, auto', 'смена этапа'], ['camp', 'id рассылки']];
      const cnt = Store.total();
      body = `<div class="card"><div class="card-head"><h2>Объём базы</h2><span class="note">${fmt(cnt)} из 5 000 записей в этой версии</span></div><div class="meter"><i style="width:${Math.min(100, cnt / 50).toFixed(1)}%"></i></div>
          <p class="note" style="margin-top:8px">Одна клиентка — одна запись со всей историей внутри. Эта версия вмещает до ~4 500 клиенток; дальше — производственная база (PostgreSQL на российском сервере), схема та же.</p></div>
        <section class="section"><h2 style="margin-bottom:10px">Таблица clients — клиентки</h2>
          <div class="table-wrap"><table class="t schema-t"><thead><tr><th>Поле</th><th>Название</th><th>Группа</th><th>Тип</th><th>Откуда</th></tr></thead><tbody>
          ${CLIENT_FIELDS.map(f => `<tr><td>${esc(f.k.startsWith('q_') ? 'quiz.' + f.k.slice(2) : f.k)}</td><td>${esc(f.n)}${f.about ? `<br><small class="muted">${esc(f.about)}</small>` : ''}</td><td>${esc(f.g)}</td><td>${esc(f.type)}</td><td>${f.calc ? '<span class="pill violet">считается</span>' : f.k.startsWith('q_') ? 'анкета' : 'вводится'}</td></tr>`).join('')}
          <tr><td>ev.{id}</td><td>История: касания, звонки, сообщения, оплаты, задачи, этапы</td><td>История</td><td>map</td><td>события</td></tr>
          </tbody></table></div></section>
        <section class="section"><h2 style="margin-bottom:10px">Событие истории — ev</h2><div class="table-wrap"><table class="t schema-t"><tbody>${EV_SCHEMA.map(([k, n]) => `<tr><td>${esc(k)}</td><td>${esc(n)}</td></tr>`).join('')}</tbody></table></div></section>
        <section class="section two">
          <div class="card"><div class="mini-h"><h3>experts — эксперты</h3></div><p class="note">name, direction, phone, tg, email, city, social, audience, experience, formats[], about, share, stage, funnel, manager, callAt, shootAt, content{title, kind, status, date}, ev{}</p></div>
          <div class="card"><div class="mini-h"><h3>partners — партнёры</h3></div><p class="note">name, category, city, address, contactName, contactRole, phone, tg, email, site, model, rate, promo, terms, contract{num, date, until}, offers{title, promo, discount, until, forWhom}, stage, manager, ev{}</p></div>
          <div class="card"><div class="mini-h"><h3>chats — групповые чаты</h3></div><p class="note">name, kind, ch, about, members[], msgs{t, from{type: client | team, id}, text, to}</p></div>
          <div class="card"><div class="mini-h"><h3>campaigns, payouts, team, cfg</h3></div><p class="note">campaigns: name, ch, text, audience{seg, rules, match | ids}, status, at, sent. payouts/{YYYY-MM}: rows{clientId: status, amount, mode, at}. team: name, uid, role, title. cfg: funnels, segments, tags, templates, sequences, views, integrations, settings.</p></div>
        </section>`;
    } else {
      const demo = Demo.present();
      const n = Store.total();
      body = `<div class="two">
        <div class="card"><div class="card-head"><h2>Демо-данные</h2>${demo ? '<span class="pill violet">загружены</span>' : ''}</div>
          <p class="note">78 вымышленных клиенток с анкетами, перепиской, звонками и оплатами, 14 экспертов, 10 партнёров, чат конференции UNICONF, рассылки и реестры выплат. Все записи помечены — удаляются одной кнопкой, ваши записи остаются.</p>
          ${canEdit ? `<div class="row" style="margin-top:10px">${demo ? `<button class="btn danger" data-demo-clear>${icon('trash')}Удалить демо-данные</button>` : ''}<button class="btn ${demo ? '' : 'primary'}" data-demo-load>${icon('db')}${demo ? 'Загрузить заново' : 'Загрузить демо-данные'}</button></div>` : ''}</div>
        <div class="card"><div class="card-head"><h2>Выгрузка всей базы</h2></div>
          <p class="note">JSON со всеми записями: клиентки с историей, эксперты, партнёры, чаты, рассылки, настройки. Для переезда на производственную базу и резервной копии.</p>
          ${Who.can('export') ? `<div class="row" style="margin-top:10px"><button class="btn" data-export-all>${icon('download')}Скачать JSON (${fmt(n)} записей)</button><button class="btn" data-export-clients>${icon('table')}Клиентки в CSV</button></div>` : ''}</div>
        <div class="card"><div class="card-head"><h2>Персональные данные</h2></div>
          <ul class="legal"><li>Храним только нужное для работы: контакты, анкету, согласия, историю касаний и оплат.</li>
            <li>Данные о здоровье (беременность, цикл) видны только при отдельном согласии.</li>
            <li>Отзыв согласия — удаляем данные в течение 30 дней: «Удалить карточку».</li>
            <li>Для реальной базы клиенток — производственная версия на сервере в России (152-ФЗ, ст. 18 ч. 5), уведомление Роскомнадзора, сообщение об утечке за 24 часа.</li></ul></div>
        ${canEdit ? `<div class="card"><div class="card-head"><h2>Очистить всё</h2></div><p class="note">Удаляет все записи этой CRM у всей команды. Отменить нельзя — сначала скачайте JSON.</p><div class="row" style="margin-top:10px"><button class="btn danger" data-wipe>${icon('trash')}Очистить базу</button></div></div>` : ''}
      </div>`;
    }

    const tabs = [['team', 'Команда', Team.all().length], ['funnels', 'Воронки и этапы'], ['segments', 'Сегменты и условия', Segments.all().length], ['tags', 'Теги', Tags.all().length], ['integrations', 'Интеграции'], ['schema', 'Схема базы'], ['data', 'Данные']];
    root.innerHTML = `${pageHead('Настройки', 'Команда, воронки, сегменты, теги, интеграции и данные.')}${tabsHtml('st.tab', tabs, tab)}${body}`;

    wireTabs(root);
    /* команда */
    on(root, 'change', '[data-tname]', (e, el) => Store.patch('team', el.dataset.tname, {name: el.value.trim()}));
    on(root, 'change', '[data-ttitle]', (e, el) => Store.patch('team', el.dataset.ttitle, {title: el.value.trim()}));
    on(root, 'change', '[data-trole]', (e, el) => { Store.patch('team', el.dataset.trole, {role: el.value}); toast('Роль изменена'); });
    on(root, 'click', '[data-tarch]', (e, el) => { const m = Team.get(el.dataset.tarch); Store.patch('team', m.id, {archived: !m.archived}); });
    on(root, 'click', '[data-as]', (e, el) => { View.set('as', el.dataset.as); App.go('home'); });
    const addM = $('#addMember', root);
    if (addM) addM.onsubmit = e => { e.preventDefault(); const name = $('#nmName', root).value.trim(); if (!name) return; Store.add('team', {name, role: $('#nmRole', root).value, title: ROLES[$('#nmRole', root).value].name, joinedAt: Date.now(), order: 30}); };
    /* воронки */
    on(root, 'click', '[data-stfn]', (e, el) => { View.set('st.fn', el.dataset.stfn); App.render(); });
    const readStages = () => $$('#stages [data-si]', root).map(c => {
      const f = Funnels.get(View.get('st.fn', 'sales')) || Funnels.get('sales');
      const old = f.stages[Number(c.dataset.si)] || {};
      const out = {...old, name: $('[data-k="name"]', c).value.trim() || old.name || 'Этап', about: $('[data-k="about"]', c).value.trim()};
      if ($('[data-k="won"]', c).checked) out.won = true; else delete out.won;
      return out;
    });
    const saveFunnel = (stages, msg) => {
      const f = Funnels.get(View.get('st.fn', 'sales')) || Funnels.get('sales');
      const base = {...f};
      delete base.id;
      Funnels.save(f.id, {...base, name: $('#fnName', root).value.trim() || f.name, about: $('#fnAbout', root).value.trim(), stages});
      if (msg) toast(msg);
    };
    on(root, 'click', '[data-up], [data-down]', (e, el) => {
      const st = readStages();
      const i = Number(el.dataset.up ?? el.dataset.down), j = el.dataset.up !== undefined ? i - 1 : i + 1;
      [st[i], st[j]] = [st[j], st[i]];
      saveFunnel(st);
    });
    on(root, 'click', '[data-rm-stage]', async (e, el) => {
      const f = Funnels.get(View.get('st.fn', 'sales'));
      const i = Number(el.dataset.rmStage);
      const s = f.stages[i];
      const n = entityList(f.entity).filter(x => Funnels.of(f.entity, x) === f.id && x.stage === s.id).length;
      if (n) { toast(`На этапе «${s.name}» ${n} ${plural(n, 'карточка', 'карточки', 'карточек')} — сначала перенесите их`, {error: true}); return; }
      if (f.stages.length <= 2) { toast('В воронке должно остаться хотя бы два этапа', {error: true}); return; }
      if (!await confirmPop(el, {text: `Удалить этап «${s.name}»?`, yes: 'Удалить', danger: true})) return;
      const st = readStages(); st.splice(i, 1); saveFunnel(st, 'Этап удалён');
    });
    on(root, 'click', '[data-add-stage]', () => { const st = readStages(); const won = st.findIndex(s => s.won); const ns = {id: 's' + uid().slice(-5), name: 'Новый этап', about: ''}; if (won >= 0) st.splice(won, 0, ns); else st.push(ns); saveFunnel(st); });
    on(root, 'click', '[data-save-funnel]', () => saveFunnel(readStages(), 'Воронка сохранена'));
    on(root, 'click', '[data-new-funnel]', async (e, el) => {
      const name = await askText(el, 'Название воронки', 'Корпоративные клиенты');
      if (!name) return;
      const id = 'f' + uid().slice(-5);
      Funnels.save(id, {name, entity: 'clients', order: 10, about: '', stages: [{id: 'new', name: 'Новый контакт', about: ''}, {id: 'talk', name: 'Переговоры', about: ''}, {id: 'offer', name: 'Предложение отправлено', about: ''}, {id: 'won', name: 'Сделка', about: '', won: true}]});
      View.set('st.fn', id);
      toast('Воронка создана: переносите в неё клиенток через «Изменить» в карточке');
    });
    /* сегменты и теги */
    on(root, 'click', '[data-seg-edit]', (e, el) => openSegmentForm(el.dataset.segEdit));
    on(root, 'click', '[data-tag-edit]', (e, el) => openTagForm(el.dataset.tagEdit));
    /* интеграции */
    on(root, 'click', '[data-integ]', (e, el) => { const cur = (Cfg.list('integrations') || {})[el.dataset.integ] || {}; Cfg.save('integrations', el.dataset.integ, {...cur, status: cur.status === 'on' ? 'off' : 'on', at: Date.now()}); });
    /* данные */
    wireEmptyBase(root);
    on(root, 'click', '[data-demo-clear]', async (e, el) => {
      if (!await confirmPop(el, {text: 'Удалить все демо-записи? Ваши записи останутся.', yes: 'Удалить', danger: true})) return;
      el.disabled = true; el.textContent = 'Удаляю…';
      const n = await Demo.clear();
      toast(`Удалено демо-записей: ${n}`);
    });
    on(root, 'click', '[data-export-all]', () => {
      const out = {exportedAt: new Date().toISOString(), app: 'Eva CRM'};
      Store.COLS.forEach(c => { out[c] = Object.fromEntries(Store.all(c).map(d => { const {id, ...b} = d; return [id, b]; })); });
      saveFile(`eva-crm-${today()}.json`, JSON.stringify(out, null, 1), 'Выгрузка базы');
    });
    on(root, 'click', '[data-export-clients]', () => exportClients(Clients.all(), CLIENT_FIELDS.filter(f => !['name', 'demo'].includes(f.k)).map(f => f.k)));
    on(root, 'click', '[data-wipe]', async (e, el) => {
      if (!await confirmPop(el, {text: 'Удалить ВСЕ записи CRM у всей команды?', yes: 'Удалить всё', danger: true})) return;
      for (const c of Store.COLS) for (const d of Store.all(c)) if (!(c === 'team' && d.uid)) Store.remove(c, d.id);
      await Store.flush();
      toast('База очищена');
    });
  },
});

function openSegmentForm(id) {
  const sg = id ? Segments.get(id) : null;
  const state = {rules: clone(sg ? sg.rules || [] : [{f: 'niche', op: 'eq', v: NICHES[0]}]), match: sg ? sg.match || 'all' : 'all'};
  openModal({title: sg ? `Сегмент: ${sg.name}` : 'Новый сегмент', wide: true, body: `<div class="grid3">
      <label class="field"><span>Название</span><input class="input" id="sgName" value="${esc(sg ? sg.name : '')}" placeholder="Салоны красоты"></label>
      <label class="field"><span>Цвет</span><input class="input" type="color" id="sgColor" value="${esc(sg ? sg.color : AV_COLORS[Segments.all().length % AV_COLORS.length])}"></label>
      <label class="field"><span>Порядок проверки</span><input class="input num" id="sgOrder" value="${sg ? sg.order ?? 50 : Segments.all().length + 1}"><small>меньше — проверяется раньше</small></label></div>
    <div class="field"><span>Условия попадания</span></div>
    <div id="sgRules">${rulesEditorHtml(state.rules, state.match)}</div>
    <label class="field"><span>Условия работы с сегментом</span><textarea class="textarea" id="sgOffer" placeholder="Какое предложение, скидка, формат для этого сегмента">${esc(sg ? sg.offer || '' : '')}</textarea></label>`,
    foot: `${sg ? '<button class="btn danger left" data-del>Удалить</button>' : ''}<button class="btn" data-close>Отмена</button><button class="btn primary" data-ok>Сохранить</button>`,
    onMount(el, close) {
      const upd = () => { const r = state.read ? state.read() : state.rules; $('[data-r-count]', el).textContent = `подходят: ${Clients.all().filter(c => r.length && testRules(r, state.match, c)).length}`; };
      wireRulesEditor($('#sgRules', el), state, upd);
      upd();
      $('[data-ok]', el).onclick = () => {
        const name = $('#sgName', el).value.trim();
        if (!name) { $('#sgName', el).classList.add('need'); return; }
        Cfg.save('segments', id || 'sg' + uid().slice(-5), {name, color: $('#sgColor', el).value, order: parseNum($('#sgOrder', el).value), match: state.match, rules: state.read().filter(r => r.f && (OPS[r.op].noValue || !isEmpty(r.v))), offer: $('#sgOffer', el).value.trim()});
        close();
        toast('Сегмент сохранён');
      };
      const del = $('[data-del]', el);
      if (del) del.onclick = async () => { if (await confirmPop(del, {text: 'Удалить сегмент? Клиентки останутся, просто без этого сегмента.', yes: 'Удалить', danger: true})) { Cfg.drop('segments', id); close(); } };
    }});
}

function openTagForm(id) {
  const t = id ? Tags.get(id) : null;
  const groups = [...new Set(Tags.all().map(x => x.group))];
  openModal({title: t ? 'Тег' : 'Новый тег', body: `<div class="grid3"><label class="field"><span>Название</span><input class="input" id="tgName" value="${esc(t ? t.name : '')}"></label>
      <label class="field"><span>Группа</span><input class="input" id="tgGroup" list="tgGroups" value="${esc(t ? t.group : 'Интерес')}"><datalist id="tgGroups">${groups.map(g => `<option value="${esc(g)}">`).join('')}</datalist></label>
      <label class="field"><span>Цвет</span><input class="input" type="color" id="tgColor" value="${esc(t ? t.color : '#5A50C0')}"></label></div>`,
    foot: `${t ? '<button class="btn danger left" data-del>Удалить</button>' : ''}<button class="btn" data-close>Отмена</button><button class="btn primary" data-ok>Сохранить</button>`,
    onMount(el, close) {
      $('[data-ok]', el).onclick = () => { const name = $('#tgName', el).value.trim(); if (!name) { $('#tgName', el).classList.add('need'); return; } Cfg.save('tags', id || 't' + uid().slice(-6), {name, group: $('#tgGroup', el).value.trim() || 'Прочее', color: $('#tgColor', el).value}); close(); };
      const del = $('[data-del]', el);
      if (del) del.onclick = async () => {
        const n = Tags.count()[id] || 0;
        if (!await confirmPop(del, {text: n ? `Тег стоит у ${n}. Снять у всех и удалить?` : 'Удалить тег?', yes: 'Удалить', danger: true})) return;
        Clients.all().filter(c => (c.tags || []).includes(id)).forEach(c => Store.patch('clients', c.id, {tags: c.tags.filter(x => x !== id)}));
        Cfg.drop('tags', id);
        close();
      };
    }});
}
