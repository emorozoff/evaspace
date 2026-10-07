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
    {sel: '.kb .tc', title: 'Карточка задачи', text: 'Сверху — кто поставил → кто делает. Статус, важность и исполнитель меняются прямо на карточке, клик — окно задачи.'},
    {sel: '.kb .due-btn', title: 'Срок', text: 'Нажмите на срок, чтобы поменять. В пределах месяца исполнитель переносит сам, иначе — запрос постановщику.'},
    {sel: '.inbox', title: 'Для вас', text: 'Что ждёт вашего решения — согласовать работу, бюджет или перенос срока — и что произошло по вашим задачам.'},
    {sel: '.t-bar .seg', title: 'Виды', text: 'Доска по статусам, по месяцам, по неделям или списком. Карточки перетаскиваются зажатием.'},
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
    {sel: '#qeForm', title: 'Быстрая запись', text: 'Потратили или получили деньги — сумма, статья, дата и Enter.'},
    {sel: 'table.plan', title: 'План платежей', text: 'Зарплаты, штаб и сервисы. «Оплатить» — и операция сама попадёт в журнал.'},
    {sel: 'table.led', title: 'Журнал операций', text: 'Все приходы и расходы. Фильтры сверху переключаются без перезагрузки.'},
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
  /* первый заход на страницу — тур через мгновение, если ничего не мешает */
  maybe(page) {
    if (!TOURS[page] || window.__EVA_NOTOUR || this.active || this.seen(page)) return;
    const me = Auth.me();
    if (!me || me.welcomed === false) return;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      if (this.active || modalOpen() || $('.pop') || App.parse().id !== page || this.seen(page)) return;
      this.start(page);
    }, 800);
  },
  steps(page) {
    return (TOURS[page] || []).filter(s => { const el = $(s.sel); return el && el.getClientRects().length; });
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
      if (e.key === 'Escape') { e.preventDefault(); this.stop(true); }
      if (e.key === 'ArrowRight') this.go(1);
      if (e.key === 'ArrowLeft') this.go(-1);
    };
    this._place = () => this.place();
    document.addEventListener('keydown', this._key, true);
    window.addEventListener('resize', this._place);
    window.addEventListener('scroll', this._place, true);
    on(root, 'click', '[data-tour-go]', (e, b) => this.go(Number(b.dataset.tourGo)));
    on(root, 'click', '[data-tour-end]', () => this.stop(true));
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
  show() {
    const a = this.active, st = a.steps[a.i], el = $(st.sel);
    if (!el) { this.go(1); return; }
    el.scrollIntoView({block: 'center', inline: 'nearest'});
    const pop = $('.tour-pop', a.root);
    pop.innerHTML = `<div class="tour-n">${a.i + 1} из ${a.steps.length}</div>
      <b class="tour-t"></b><p class="tour-x"></p>
      <div class="tour-btns"><button class="btn ghost sm" data-tour-end>Пропустить</button><span></span>
        ${a.i ? '<button class="btn sm" data-tour-go="-1">Назад</button>' : ''}
        <button class="btn primary sm" data-tour-go="1">${a.i === a.steps.length - 1 ? 'Понятно' : 'Дальше'}</button></div>`;
    $('.tour-t', pop).textContent = st.title;
    $('.tour-x', pop).textContent = st.text;
    this.place();
    setTimeout(() => { const b = $('[data-tour-go="1"]', pop); if (b) b.focus({preventScroll: true}); }, 30);
  },
  place() {
    const a = this.active;
    if (!a) return;
    const el = $(a.steps[a.i].sel);
    if (!el) return;
    const r = el.getBoundingClientRect(), pad = 6;
    const hole = $('.tour-hole', a.root), pop = $('.tour-pop', a.root);
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
  reset() { Object.keys(TOURS).forEach(k => Prefs.set('tour_' + k, false)); },
};
