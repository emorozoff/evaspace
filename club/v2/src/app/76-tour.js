/* Туры: при первом входе на страницу — пошаговые подсказки с подсветкой
   нужного места, как на платформе. Повторить — кнопка «Тур по странице».
   Что человек уже прошёл, помнится в его учётке (Prefs), поэтому тур не
   всплывает снова ни в этом браузере, ни на другом устройстве. */

const TOURS = {
  home: [
    {sel: '.spirit', title: 'Комплимент дня и неделя команды', text: 'Каждый день — тёплые слова по имени. Рядом — сколько команда закрыла за неделю, герои недели и дни рождения.'},
    {sel: '[data-new-task]', title: 'Новая задача', text: 'Поставить задачу себе или коллеге можно прямо отсюда. Исполнитель получит уведомление со звуком.'},
    {sel: '.today', title: 'Сегодня', text: 'Внесены ли цифры дня, когда созвон и сверка месяца, собрания и созвоны CRM.'},
    {sel: '#nav', title: 'Разделы штаба', text: 'Задачи, календарь, отчёты, метрики и команда. Цифра у «Задач» — сколько ждёт вашего внимания.'},
    {sel: '#adamFab', title: 'Адам — ассистент команды', text: 'Спросите Адама, что горит и с чего начать, попросите написать напоминание коллеге. Здесь же — сообщения команды и личные диалоги.'},
    {sel: '#sndBtn', title: 'Звук уведомлений', text: 'Новая задача и задача на согласование приходят со звуком. Колокольчик включает и выключает его.'},
    {sel: '#meChip', title: 'Ваша страница', text: 'Фото, о себе, Human Design, цели на квартал, пароль — нажмите на своё имя.'},
  ],
  tasks: [
    {sel: '.t-scope', title: 'Чьи задачи', text: '«Мне» — что поставили вам, «От меня» — что вы поставили другим, «Все» — задачи всей команды. Справа можно выбрать человека.'},
    {sel: '.t-quick', title: 'Новая задача — здесь', text: 'Напишите, что сделать, выберите кому и срок — Enter. Галочка «срок важен» — исполнитель перенесёт его только с вашего согласования.'},
    {sel: '.kb .tc', title: 'Карточка задачи', text: 'Сверху — кто поставил → кто делает. Статус, важность и исполнитель меняются прямо на карточке, клик — окно задачи.',
      demo: '<div class="tour-demo"><div class="td-card td-col"><span class="td-flow">Кирилл → Мария</span><b>Снять три мастер-класса</b><span class="td-meta"><span class="due-btn td-due">20 окт</span><span class="pill violet">В работе</span></span></div></div>'},
    {sel: '.kb .due-btn', title: 'Срок', text: 'Нажмите на срок, чтобы поменять. В пределах месяца исполнитель переносит сам, иначе — запрос постановщику.',
      demo: '<div class="tour-demo"><div class="td-row"><span class="due-btn td-due">20 окт</span><span>срок можно сдвинуть сам</span></div><div class="td-row"><span class="due-btn td-due">20 окт ★</span><span>«срок важен» — перенос только с согласия постановщика</span></div></div>'},
    {sel: '.kb .t-holds', title: 'Блокирующая задача — красным', text: 'Красная надпись «держит 2» — от этой задачи зависят другие, и пока она не готова, они стоят. Такие задачи делайте первыми.',
      demo: '<div class="tour-demo"><div class="td-card"><b>Подключить оплату</b><span class="t-holds">держит 2</span></div></div>'},
    {sel: '.kb .tc-lock', title: 'Замочек', text: 'Замочек в углу карточки — у задачи есть «Зависит от». Связь ставится в окне задачи; когда блокирующая готова, придёт уведомление «можно начинать».',
      demo: '<div class="tour-demo"><div class="td-row"><span class="tc-lock on td-lock">🔒</span><span><b>Красный замочек</b> — ждёт другую задачу, начинать рано</span></div><div class="td-row"><span class="tc-lock td-lock">🔓</span><span><b>Зелёный</b> — блокирующие готовы, можно делать</span></div></div>'},
    {sel: null, title: 'Что ещё бывает на карточке', text: 'Розовая рамка — новое для вас. Золотая — ждёт согласования. Жёлтый фон — вернули на доработку. Точки — сколько раз переносили срок или возвращали. «Перенос?» — просят сдвинуть срок.',
      demo: '<div class="tour-demo td-legend"><span class="td-sw fresh">новое</span><span class="td-sw awaiting">на согласовании</span><span class="td-sw returned">вернули</span><span class="tc-dots"><i class="pp"></i><i class="rw"></i></span><span class="t-dreq">перенос?</span><span class="t-budget pending">30 тыс · ждёт</span></div>'},
    {sel: '.kb .due-btn', title: 'Срок', text: 'Нажмите на срок, чтобы поменять. В пределах месяца исполнитель переносит сам, иначе — запрос постановщику.'},
    {sel: '.inbox', title: 'Для вас', text: 'Что ждёт вашего решения — согласовать работу, бюджет или перенос срока — и что произошло по вашим задачам. Появляется, когда есть новости.',
      demo: '<div class="tour-demo"><div class="td-card td-col"><b>Для вас</b><span>Кирилл поставил вам задачу «Снять ролик»</span><span>Мария сдала на согласование «Монтаж»</span></div></div>'},
    {sel: '.t-bar .seg', title: 'Виды', text: 'Доска по статусам, по месяцам, по неделям или списком. Карточки перетаскиваются зажатием.'},
  ],
  /* окно задачи: первая новая задача и первая открытая */
  'task-new': [
    {sel: '.tm-modal #tmTitle', title: 'Ваша первая задача', text: 'Коротко и с глаголом: «Снять ролик о…». Если вы уже умеете ставить задачи — «Пропустить».'},
    {sel: '.tm-modal #tmResult', title: 'ЦКП — что получим на выходе', text: 'Конкретный результат, по которому видно, что задача сделана: «договор подписан и лежит в папке».'},
    {sel: '.tm-modal .tm-grid', title: 'Кто и когда', text: 'Постановщик — вы, ответственный — кто делает: ему придёт уведомление со звуком. Срок, месяц и цель квартала.'},
    {sel: '.tm-modal #tmDueBox', title: 'Срок важен?', text: 'Отметьте «Срок важен», если дату нельзя сдвигать: исполнитель перенесёт её только с вашего согласия. Без галочки он двигает срок сам в пределах месяца.'},
    {sel: '.tm-modal #tmBudgetBox', title: 'Бюджет и его согласование', text: 'Нужны деньги — сумма и статья. С галочкой «Требует согласования» бюджет уходит основателю или финансам: тратить можно после «Согласовать». Согласованный бюджет сам встанет в план платежей.'},
    {sel: '.tm-modal #tmApprBox', title: 'Кто принимает результат', text: '«Результат согласовывает» — кто проверит работу. Исполнитель нажмёт «Готово», и задача придёт этому человеку: принять или вернуть с комментарием.'},
    {sel: '.tm-modal #tmCreate', title: 'Создать', text: '«Создать задачу» — и она появится у исполнителя. Зависимости («ждёт другую задачу») и обсуждение — в окне уже созданной задачи.'},
  ],
  'task-open': [
    {sel: '.tm-modal #tmTop', title: 'Окно задачи', text: 'Сверху — кто поставил → кто делает и статус. Всё, что вы меняете, сохраняется сразу и видно команде.'},
    {sel: '.tm-modal #tmDueBox', title: 'Срок', text: 'Свою задачу двигаете сами. Чужую — в пределах месяца, если срок не отмечен «важным»; иначе уйдёт запрос постановщику.'},
    {sel: '.tm-modal #tmBudgetBox', title: 'Бюджет', text: 'Сумма, статья и согласование. Пока бюджет «ждёт», деньги не тратим — согласующему пришло уведомление.'},
    {sel: '.tm-modal #tmApprBox', title: 'Приёмка', text: 'Если результат принимает другой человек, «Готово» отправит задачу ему на согласование.'},
    {sel: '.tm-modal #tmDepsBox', title: 'Зависит от — замочек', text: 'Нельзя начать, пока не готова другая задача? Выберите её здесь: на карточке появится 🔒, а у той — красное «держит». Когда она будет готова, придёт «можно начинать».',
      demo: '<div class="tour-demo"><div class="td-row"><span class="tc-lock on td-lock">🔒</span><span><b>Красный замочек</b> — ждёт другую задачу, начинать рано</span></div><div class="td-row"><span class="tc-lock td-lock">🔓</span><span><b>Зелёный</b> — блокирующие готовы, можно делать</span></div></div>'},
    {sel: '.tm-modal #tmZone', title: 'Результат работы', text: 'Ссылка, документ или текст — и «Готово». Постановщик увидит результат и примет работу или вернёт с комментарием.'},
    {sel: '.tm-modal .t-m-comments', title: 'Обсуждение', text: 'Вопросы и договорённости — комментарий придёт исполнителю и постановщику со звуком.'},
    {sel: '.tm-modal #tmAdam', title: 'Адам напишет за вас', text: 'Нужно напомнить коллеге или отчитаться — Адам подготовит сообщение по этой задаче.'},
  ],
  'task-quick': [
    {sel: '#qtTitle', title: 'Быстрая задача', text: 'Название, кто делает и срок — и «Добавить».'},
    {sel: '#qtFixWrap', title: 'Срок важен', text: 'Для задачи коллеге: с галочкой исполнитель переносит срок только с вашего согласия.'},
    {sel: '#qtMore', title: 'Подробнее…', text: 'Бюджет с согласованием, ЦКП, кто принимает результат, цель квартала — в полном окне задачи.'},
  ],
  meeting: [
    {sel: '#mtTitle', title: 'Собрание', text: 'Название, дата, начало и длительность. Внизу окна — свободные у всех окна, можно нажать.'},
    {sel: '.mt-chips', title: 'Участники из команды', text: 'Нажмите на людей — им придёт приглашение в Google Календарь. «Нет почты» — впишите её прямо здесь.'},
    {sel: '#mtGAdd', title: 'Гости не из команды', text: 'Имя, почта для приглашения и Telegram для напоминания перед встречей.'},
    {sel: '#mtRemind', title: 'Напоминание', text: 'За сколько напомнить: команде — в штабе со звуком, гостям — кнопкой «Напомнить» (или ботом на своём сервере).'},
  ],
  chat: [
    {sel: '.chat-tabs', title: 'Адам, команда и личные', text: '«Адам» — ассистент: сводка дня и ответы на вопросы. «Команда» — общий чат. «Личные» — диалоги один на один.'},
    {sel: '#chatChips', title: 'С чего начать', text: 'Нажмите готовый вопрос — например, «Что у меня горит?».'},
    {sel: '#chatInput', title: 'Спросите своими словами', text: 'Enter — отправить. Попросите Адама написать сообщение коллеге или разбить задачу на шаги.'},
  ],
  'money-ops': [
    {sel: '#qeForm', title: 'Быстрая запись', text: 'Потратили или получили деньги — сумма, статья, дата и Enter. Ошиблись — «Отменить» в уведомлении.'},
    {sel: 'table.led', title: 'Журнал операций', text: 'Все приходы и расходы. Строки с пометками «по плану», выплаты, заказы и возвраты попали сюда сами. Нажмите на строку, чтобы поправить.'},
  ],
  'money-plan': [
    {sel: 'table.plan', title: 'Финплан', text: 'Оплата труда, регулярные и разовые платежи по месяцам. «Оплатить» — операция сама попадёт в журнал.'},
    {sel: 'table.pnl', title: 'План-факт', text: 'Крупно — факт, мелко — план. Будущие месяцы — план по сценарию.'},
    {sel: '.cf', title: 'Прогноз', text: 'Cash Flow до Нового года: сколько денег будет на счёте в конце каждого месяца.'},
  ],
  'money-subs': [
    {sel: '.subs-t', title: 'Подписки по месяцам', text: 'Серым — посчитано само из «Цифр дня» и возвратов. «Поправить» — вписать точные цифры, например годовые подписки.'},
    {sel: '[data-payouts="ref"]', title: 'Реферальные выплаты', text: '«Начисление» — кому и сколько за приведённых подписчиков. «Выплатить» — расход сам попадёт в журнал.'},
  ],
  'money-courses': [
    {sel: '.courses-t, [data-course-add]', title: 'Продажи курсов', text: 'Впишите, сколько продано за месяц, — выручка и доля автора посчитаются сами. «Внести приход» — выручка месяца в журнал.'},
    {sel: '[data-payouts="author"]', title: 'Выплаты авторам', text: 'Начисляются сами; за закрытый месяц — «Выплатить».'},
  ],
  'money-market': [
    {sel: '.fin-subbar', title: 'Заказы, товары, распределение', text: 'Заказы со статусом оплаты и доставки, склад и кто сколько получает с выручки.'},
    {sel: '[data-order-add]', title: 'Новый заказ', text: 'Клиент, состав и доставка. «Оплачен» — приход в журнал и списание со склада.'},
  ],
  'money-failed': [
    {sel: '[data-fail-add]', title: 'Сбой оплаты', text: 'Списание за подписку не прошло — запишите: причина, сумма, контакт. В карточке — готовое сообщение клиенту.'},
    {sel: '.fin-tabs [data-ftab="failed"]', title: 'Путь сбоя', text: 'Новый → написали клиенту → повторное списание → оплачено или потерян. Красная цифра — сколько ждёт действия сегодня.'},
  ],
  'money-refunds': [
    {sel: '[data-refund-add]', title: 'Запрос на возврат', text: 'Клиент просит вернуть деньги — запишите: что, сумма, причина. Срок ответа — 10 дней, просрочка подсвечивается красным.'},
    {sel: '.fin-tabs [data-ftab="refunds"]', title: 'Решение', text: '«Одобрен» → «Возвращено» — расход сам ляжет в журнал. Отказ — только с пояснением; ответ клиенту готов в карточке.'},
  ],
  calendar: [
    {sel: '.cal-conn', title: 'Google Календарь', text: 'Подключите один раз — увидите свои события, а команда — только когда вы заняты.'},
    {sel: '.cal-add', title: 'Собрание', text: 'Название, время, участники из команды и гости — приглашения уйдут в их календари.'},
    {sel: '.cal-tabs', title: 'Вкладки', text: 'Неделя, занятость команды со свободными окнами, список собраний и почты для приглашений.'},
  ],
  team: [
    {sel: '.team-bar .seg', title: 'Список, структура, направления', text: '«Структура» — кто кому подчиняется: генеральный директор, управление и команды директоров.'},
    {sel: '.team-add', title: 'Новый человек', text: 'Добавьте человека и сразу пригласите его ссылкой с ролью — данные из карточки подтянутся в анкету.'},
    {sel: '.onb', title: 'Приветствие новичков', text: 'Большая цель, цель года и обращение — их видит каждый, кто регистрируется по ссылке.'},
    {sel: '.portable', title: 'Данные штаба', text: 'Выгрузка всего в файл и загрузка обратно — для резервной копии и переезда на свой сервер.'},
  ],
  money: [
    {sel: '.fin-tabs', title: 'Разделы финансов', text: 'Обзор, операции, план и прогноз, подписки, курсы, маркетплейс, сбои оплат и возвраты. Красная цифра — сколько ждёт действия.'},
    {sel: '.fin-kpi', title: 'Ключевые показатели', text: 'Баланс на сегодня, итог месяца, прогноз на 31 декабря, платные подписчики, MRR, продления, возвраты и средний чек.'},
    {sel: '.fin-flow', title: 'Приход и расход', text: 'Откуда пришли деньги и куда ушли в этом месяце — на одной шкале.'},
    {sel: '.fin-att', title: 'Нужно внимание', text: 'Возвраты со сроком, сбои оплат, выплаты и заказы к отправке. Нажмите — откроется нужный раздел.'},
    {sel: '.unit', title: 'Чек и юнит-экономика', text: 'Средний чек, маржа, срок подписки, LTV, стоимость привлечения и окупаемость — с формулой у каждой цифры.'},
  ],
  reports: [
    {sel: '#salesForm', title: 'Цифры дня', text: 'Охват, регистрации, оплаты — до созвона в понедельник. Выручка посчитается сама.'},
    {sel: '.periods', title: 'Как идём', text: 'Сегодня, неделя, месяц и квартал против плана.'},
    {sel: '.rep-tabs', title: 'Разбивка', text: 'По дням, по неделям и сверка месяца.'},
  ],
  metrics: [
    {sel: '.mx-flow', title: 'Воронка', text: 'Путь человека сверху вниз. Меняйте проценты между шагами — всё пересчитается сразу.'},
    {sel: '.mx-res', title: 'Итог квартала', text: 'Продажи против плана, выручка и сколько людей платят на 31 декабря.'},
  ],
  strategy: [
    {sel: '.north', title: 'Главная цифра квартала', text: 'Сколько продаж уже есть и где должны быть по плану.'},
    {sel: '.goals', title: 'Пять целей', text: 'У каждой цели — пункты и проверяемый результат. Задачи привязываются к цели в окне задачи.'},
    {sel: '#gantt', title: 'Дорожная карта', text: 'Этапы года, ключевые точки и работы по направлениям.'},
  ],
  me: [
    {sel: '.pf-head', title: 'Ваша карточка', text: 'Фото, должность, контакты и роль в штабе.'},
    {sel: '[data-pf-birth]', title: 'Рождение и Human Design', text: 'Тип и профиль помогают команде понимать, как с вами работать.'},
    {sel: '#pfSound', title: 'Звук уведомлений', text: 'Включите, чтобы новые задачи и согласования не терялись.'},
  ],
};

const Tour = {
  active: null,
  _timer: null,
  seen(page) { return !!Prefs.get('tour_' + page, false); },
  off() { return !!Prefs.get('tours_off', false); },
  can(page) {
    const me = Auth.me();
    return !!TOURS[page] && !window.__EVA_NOTOUR && !this.active && !this.off() && !this.seen(page) && !!me && me.welcomed !== false;
  },
  /* первый заход на страницу — тур через мгновение, если ничего не мешает;
     still() — та же ли страница и раздел, когда пришло время */
  maybe(page, still = () => true) {
    if (!this.can(page)) return;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      if (!this.can(page) || modalOpen() || $('.pop') || !still()) return;
      this.start(page);
    }, 800);
  },
  /* тур внутри окна: первая задача, первое собрание, панель Адама */
  inModal(page, within = '.modal') {
    if (!this.can(page)) return;
    setTimeout(() => { if (this.can(page) && $(within) && !$('.pop')) { this.start(page); if (this.active) this.active.within = within; } }, 450);
  },
  /* шаг с примером (demo) показываем и тогда, когда на странице такого ещё нет */
  steps(page) {
    return (TOURS[page] || []).filter(s => { const el = s.sel ? $(s.sel) : null; return (el && el.getClientRects().length) || s.demo; });
  },
  /* «Я всё знаю» — больше никаких туров; вернуть — на своей странице */
  disable() {
    this.stop(true);
    Prefs.setMany({tours_off: true, ...Object.fromEntries(Object.keys(TOURS).map(k => ['tour_' + k, true]))});
    toast('Туры выключены. Включить снова — на вашей странице: «Показать подсказки и туры снова»');
  },
  start(page, manual = false) {
    const steps = this.steps(page);
    if (!steps.length) { if (manual) toast('На этой странице пока нечего показывать'); return; }
    this.stop(false);
    const root = document.createElement('div');
    root.className = 'tour';
    root.innerHTML = '<div class="tour-hole"></div><div class="tour-pop" role="dialog" aria-modal="true"></div>';
    document.body.appendChild(root);
    this.active = {page, steps, i: 0, root};
    this._key = e => {
      if (!this.active) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); this.stop(true); }
      if (e.key === 'ArrowRight') this.go(1);
      if (e.key === 'ArrowLeft') this.go(-1);
    };
    this._place = () => this.place();
    document.addEventListener('keydown', this._key, true);
    window.addEventListener('resize', this._place);
    window.addEventListener('scroll', this._place, true);
    on(root, 'click', '[data-tour-go]', (e, b) => this.go(Number(b.dataset.tourGo)));
    on(root, 'click', '[data-tour-end]', () => this.stop(true));
    on(root, 'click', '[data-tour-off]', () => this.disable());
    this.show();
  },
  go(d) {
    const a = this.active;
    if (!a) return;
    const i = a.i + d;
    if (i >= a.steps.length) { this.stop(true); toast('Готово! Тур можно повторить кнопкой «Тур по странице»'); return; }
    if (i < 0) return;
    a.i = i;
    this.show();
  },
  el(st) { const el = st.sel ? $(st.sel) : null; return el && el.getClientRects().length ? el : null; },
  show() {
    const a = this.active, st = a.steps[a.i], el = this.el(st);
    if (!el && !st.demo) { this.go(1); return; }
    if (el) el.scrollIntoView({block: 'center', inline: 'nearest'});
    const pop = $('.tour-pop', a.root);
    pop.innerHTML = `<div class="tour-n">${a.i + 1} из ${a.steps.length}</div>
      <b class="tour-t"></b><p class="tour-x"></p>${!el && st.demo ? `<div class="tour-ex"><span class="label">Как это выглядит</span>${st.demo}</div>` : ''}
      <div class="tour-btns"><button class="btn ghost sm" data-tour-end>Пропустить</button><span></span>
        ${a.i ? '<button class="btn sm" data-tour-go="-1">Назад</button>' : ''}
        <button class="btn primary sm" data-tour-go="1">${a.i === a.steps.length - 1 ? 'Понятно' : 'Дальше'}</button></div>
      ${a.i === 0 ? '<button class="link-btn tour-off" data-tour-off>Я всё знаю — больше не показывать подсказки</button>' : ''}`;
    $('.tour-t', pop).textContent = st.title;
    $('.tour-x', pop).textContent = st.text;
    this.place();
    setTimeout(() => { const b = $('[data-tour-go="1"]', pop); if (b) b.focus({preventScroll: true}); }, 30);
  },
  place() {
    const a = this.active;
    if (!a) return;
    /* окно, в котором шёл тур, закрыли — тур тоже заканчиваем */
    if (a.within && !$(a.within)) { this.stop(true); return; }
    const el = this.el(a.steps[a.i]);
    const hole = $('.tour-hole', a.root), pop = $('.tour-pop', a.root);
    /* шаг-пример без места на странице — окно по центру, без подсветки */
    hole.classList.toggle('none', !el);
    a.root.classList.toggle('center', !el);
    if (!el) {
      Object.assign(pop.style, {top: Math.max(8, (window.innerHeight - pop.offsetHeight) / 2) + 'px', left: Math.max(8, (window.innerWidth - pop.offsetWidth) / 2) + 'px'});
      return;
    }
    const r = el.getBoundingClientRect(), pad = 6;
    const top = Math.max(4, r.top - pad), left = Math.max(4, r.left - pad);
    const w = Math.min(window.innerWidth - left - 4, r.width + pad * 2), h = Math.min(window.innerHeight - top - 4, r.height + pad * 2);
    Object.assign(hole.style, {top: top + 'px', left: left + 'px', width: w + 'px', height: h + 'px'});
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let py = r.bottom + 12;
    if (py + ph > window.innerHeight - 8) py = r.top - ph - 12;
    if (py < 8) py = Math.min(window.innerHeight - ph - 8, Math.max(8, r.top + 12));
    const px = clamp(r.left + r.width / 2 - pw / 2, 8, window.innerWidth - pw - 8);
    Object.assign(pop.style, {top: py + 'px', left: px + 'px'});
  },
  stop(markSeen) {
    const a = this.active;
    if (!a) return;
    if (markSeen) Prefs.set('tour_' + a.page, true);
    a.root.remove();
    document.removeEventListener('keydown', this._key, true);
    window.removeEventListener('resize', this._place);
    window.removeEventListener('scroll', this._place, true);
    this.active = null;
  },
  reset() { Prefs.setMany({tours_off: false, ...Object.fromEntries(Object.keys(TOURS).map(k => ['tour_' + k, false]))}); },
};
