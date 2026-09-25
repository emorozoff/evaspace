/* Демо-данные. Все люди, салоны, студии и переписка вымышлены — это пример,
   на котором видно, как работает CRM. Генератор детерминированный:
   одинаковые id при каждой загрузке, поэтому повторная загрузка
   перезаписывает демо-записи, а не плодит копии. У каждой записи demo: true —
   «Настройки → Данные → Удалить демо-данные» убирает их одной кнопкой. */

const Demo = {
  build(nowTs = Date.now()) {
    const R = rng(20260925);
    const DAY = 864e5;
    const T = nowTs;
    const tsAgo = (days, hour = null) => { const d = new Date(T - days * DAY); d.setHours(hour ?? R.int(9, 20), R.int(0, 59), 0, 0); return Math.min(d.getTime(), T - 60e3); };
    const dAgo = days => isoOf(new Date(T - days * DAY));
    const dIn = days => isoOf(new Date(T + days * DAY));
    let evN = 0;
    const eid = () => 'd' + (++evN).toString(36);
    const out = {team: {}, clients: {}, experts: {}, partners: {}, chats: {}, campaigns: {}, payouts: {}, cfg: {}};

    /* ── команда ── */
    const team = {
      tm_anna:  {name: 'Анна Смирнова',  role: 'lead',    title: 'Старший менеджер',   order: 1, color: '#5A50C0'},
      tm_olga:  {name: 'Ольга Белова',   role: 'manager', title: 'Менеджер по продажам', order: 2, color: '#AD4C74'},
      tm_katya: {name: 'Екатерина Лис',  role: 'manager', title: 'Менеджер по продажам', order: 3, color: '#2C7753'},
      tm_vera:  {name: 'Вера Орлова',    role: 'curator', title: 'Куратор экспертов и партнёров', order: 4, color: '#8F6B27'},
    };
    for (const [id, t] of Object.entries(team)) out.team[id] = {...t, demo: true, joinedAt: tsAgo(160)};
    const managers = ['tm_anna', 'tm_olga', 'tm_katya'];

    /* ── партнёры ── */
    const partnersSrc = [
      ['pt_lavanda', 'Салон красоты «Лаванда»', 'Салон красоты', 'Москва', 'ул. Покровка, 17', 'Ирина Громова', 'управляющая', 'commission', 'active', 0.1, [['−15% на уходовые процедуры участницам Евы', 'EVA15', 15]], 'LAVANDA'],
      ['pt_core', 'Студия пилатеса «Центр тела»', 'Студия пилатеса', 'Санкт-Петербург', 'Малый пр. В. О., 54', 'Мария Ларионова', 'основательница', 'cross', 'contract', 0.1, [['Пробное занятие на реформере бесплатно', 'EVAPILATES', 100]], 'CORE'],
      ['pt_tihaya', 'Йога-студия «Тихая»', 'Йога-студия', 'Москва', 'Чистопрудный бульвар, 12', 'Светлана Юн', 'администратор', 'barter', 'active', 0, [['Зал для съёмок мастер-классов по будням до 14:00', '', 0], ['−20% на первый абонемент участницам Евы', 'EVAYOGA', 20]], 'TIHAYA'],
      ['pt_svet', 'Пространство «Свет»', 'Пространство для встреч', 'Санкт-Петербург', 'ул. Рубинштейна, 9', 'Олег Руденко', 'арт-директор', 'barter', 'active', 0, [['Площадка для офлайн-встреч Eva Events', '', 0]], 'SVET'],
      ['pt_forma', 'Фитнес-клуб «Форма»', 'Фитнес-клуб', 'Казань', 'ул. Баумана, 44', 'Алсу Галиева', 'менеджер по партнёрствам', 'corporate', 'meeting', 0.1, [], 'FORMA'],
      ['pt_derma', 'Косметология «Дерма»', 'Косметология', 'Екатеринбург', 'ул. Малышева, 71', 'Юлия Шарова', 'главный врач', 'commission', 'terms', 0.12, [['Консультация косметолога −30%', 'EVADERMA', 30]], 'DERMA'],
      ['pt_zelen', 'Кафе «Зелень»', 'Здоровое питание', 'Москва', 'Большая Никитская, 20', 'Денис Котов', 'владелец', 'cross', 'contact', 0, [['−10% на боулы и смузи по карте Евы', 'EVA10', 10]], 'ZELEN'],
      ['pt_aroma', 'Бренд «Арома Лаб»', 'Бренд для маркета', 'Онлайн', 'маркетплейс и сайт бренда', 'Кира Мельник', 'сооснователь', 'market', 'active', 0.25, [['Набор «Вечерний ритуал» в маркете Евы', 'AROMA', 0]], 'AROMA'],
      ['pt_lotus', 'Салон «Белый лотос»', 'Салон красоты', 'Краснодар', 'ул. Красная, 120', 'Наталья Бойко', 'владелица', 'commission', 'base', 0.1, [], 'LOTUS'],
      ['pt_reformer', 'Студия «Реформер Клаб»', 'Студия пилатеса', 'Москва', 'Ленинградский пр., 36', 'Анастасия Руд', 'управляющая', 'cross', 'lost', 0, [], 'REFORMER'],
    ];
    const partnerCities = {};
    partnersSrc.forEach(([id, name, cat, city, addr, cName, cRole, model, stage, rate, offers, promo], i) => {
      const created = 150 - i * 11;
      const ev = {};
      ev[eid()] = {kind: 'sys', t: tsAgo(created), text: 'Партнёр добавлен в базу'};
      const path = Funnels_default_path('partners', stage);
      path.forEach((st, k) => { if (k) ev[eid()] = {kind: 'stage', t: tsAgo(created - k * 6), funnel: 'partners', from: path[k - 1], to: st, by: 'tm_vera'}; });
      if (stage !== 'base') ev[eid()] = {kind: 'call', t: tsAgo(created - 3), dir: 'out', dur: R.int(240, 900), result: 'ok', by: 'tm_vera', text: `Созвон с ${cName.split(' ')[0]}: рассказали про Еву, договорились о встрече.`};
      if (['meeting', 'terms', 'contract', 'active'].includes(stage)) ev[eid()] = {kind: 'meet', t: tsAgo(created - 8), by: 'tm_vera', text: 'Встреча на площадке партнёра: показали приложение, обсудили формат сотрудничества.'};
      if (stage === 'active' && rate) ev[eid()] = {kind: 'pay', t: tsAgo(26), type: 'payout', amount: R.int(3, 9) * 1000, status: 'ok', method: 'invoice', text: 'Вознаграждение за август'};
      if (stage === 'lost') ev[eid()] = {kind: 'note', t: tsAgo(created - 14), by: 'tm_vera', text: 'Отказались: своя программа лояльности, партнёрства пока не рассматривают. Вернуться весной.'};
      if (stage === 'meeting') ev[eid()] = {kind: 'task', t: tsAgo(3), title: 'Отправить предложение по корпоративной подписке', due: dIn(1), who: 'tm_vera', done: false};
      if (stage === 'terms') ev[eid()] = {kind: 'task', t: tsAgo(5), title: 'Согласовать договор с юристом', due: dAgo(1), who: 'tm_vera', done: false};
      if (stage === 'contact') ev[eid()] = {kind: 'task', t: tsAgo(2), title: 'Назначить встречу с владельцем', due: dIn(2), who: 'tm_vera', done: false};
      const of = {};
      offers.forEach(([title, code, disc], k) => { of['o' + k] = {title, promo: code, discount: disc, until: dIn(90 + k * 30), forWhom: 'участницам Евы'}; });
      partnerCities[id] = city;
      out.partners[id] = {
        demo: true, name, category: cat, city, address: addr, contactName: cName, contactRole: cRole,
        phone: '79' + String(160000000 + hashStr(name) % 839999999).slice(0, 9), email: `hello@${refCodeFor(name).toLowerCase().replace(/\d+/, '')}.ru`,
        tg: refCodeFor(cName).toLowerCase().replace(/\d+/, '') + '_' + (i + 1),
        site: '', model, rate, stage, funnel: 'partners', manager: 'tm_vera', promo, offers: of,
        terms: ({commission: `${Math.round(rate * 100)}% с оплат клиенток, пришедших по промокоду ${promo}, 12 месяцев. Выплата раз в месяц по акту.`,
          cross: 'Взаимный промо: Ева рассказывает о партнёре в канале и рассылке, партнёр — о Еве своим клиентам. Денег друг другу не платим.',
          barter: 'Бартер: площадка партнёра для съёмок и встреч, взамен — упоминание в мастер-классах и спецпредложение участницам.',
          corporate: 'Корпоративная подписка для тренеров и администраторов клуба: от 10 человек −25%.',
          market: `Товары бренда в маркете Евы, платформе ${Math.round(rate * 100)}% с продажи, доставка и возврат на стороне бренда.`})[model],
        contract: ['contract', 'active'].includes(stage) ? {num: `П-${2026}-${String(i + 1).padStart(3, '0')}`, date: dAgo(created - 20), until: dIn(300)} : null,
        created: dAgo(created), createdAt: tsAgo(created), stageAt: tsAgo(Math.max(1, created - 20)), ev,
      };
    });

    /* ── эксперты ── */
    const expertsSrc = [
      ['ex_marina', 'Марина Ясная', 'Психология', 'paying', 48000, '5–10 лет', ['Мастер-классы', 'Курс', 'Личные консультации'], ['Как перестать себя ругать', 'Тревога: инструкция по применению', 'Границы: мягко, но твёрдо']],
      ['ex_ksenia', 'Ксения Роот', 'Йога и тело', 'paying', 36000, 'больше 10 лет', ['Практики и медитации', 'Курс'], ['Йога для начинающих: база', 'Мягкое пробуждение тела', 'Танец без правил']],
      ['ex_alina', 'Алина Ветрова', 'Медитация и дыхание', 'live', 21000, '3–5 лет', ['Практики и медитации', 'Мастер-классы'], ['Медитация с нуля: три техники', 'Йога-нидра перед сном']],
      ['ex_taya', 'Тая Мирная', 'Женское здоровье', 'shot', 64000, '5–10 лет', ['Мастер-классы', 'Встречи офлайн'], ['Цикл как суперсила', 'Практика для женского здоровья']],
      ['ex_olga', 'Ольга Светлова', 'Красота и уход', 'agreed', 12000, '3–5 лет', ['Мастер-классы'], ['Ритуалы красоты, которые работают']],
      ['ex_inna', 'Инна Ковыль', 'Деньги и карьера', 'agreed', 88000, '5–10 лет', ['Курс', 'Мастер-классы'], ['Деньги в женских руках']],
      ['ex_daria', 'Дарья Лебедева', 'Голос и публичность', 'call2', 15000, '1–3 года', ['Мастер-классы'], []],
      ['ex_vera', 'Вероника Сад', 'Отношения', 'call2', 27000, '3–5 лет', ['Личные консультации', 'Мастер-классы'], []],
      ['ex_elena', 'Елена Грач', 'Материнство', 'call1', 41000, '5–10 лет', ['Практики и медитации'], []],
      ['ex_zhanna', 'Жанна Клён', 'Женское здоровье', 'call1', 9000, '1–3 года', ['Мастер-классы'], []],
      ['ex_polina', 'Полина Верес', 'Питание', 'list', 23000, '3–5 лет', ['Мастер-классы'], []],
      ['ex_nina', 'Нина Лаптева', 'Медитация и дыхание', 'list', 7000, 'до года', ['Практики и медитации'], []],
      ['ex_mila', 'Мила Орех', 'Психология', 'list', 52000, 'больше 10 лет', ['Курс'], []],
      ['ex_sofia', 'София Тарн', 'Йога и тело', 'lost', 18000, '3–5 лет', ['Встречи офлайн'], []],
    ];
    expertsSrc.forEach(([id, name, dir, stage, aud, exp, formats, mks], i) => {
      const created = 140 - i * 7;
      const ev = {};
      ev[eid()] = {kind: 'sys', t: tsAgo(created), text: i < 6 || ['ex_polina', 'ex_mila'].includes(id) ? 'Заявка эксперта из приложения: «Стать экспертом»' : 'Добавлена в список кандидатов'};
      const path = Funnels_default_path('experts', stage);
      path.forEach((st, k) => { if (k) ev[eid()] = {kind: 'stage', t: tsAgo(created - k * 7), funnel: 'experts', from: path[k - 1], to: st, by: 'tm_vera'}; });
      if (Funnels_default_idx('experts', stage) >= 2 || stage === 'lost') ev[eid()] = {kind: 'meet', t: tsAgo(created - 12), by: 'tm_vera', ch: 'call', text: 'Встреча в Zoom, 30 минут: рассказали про платформу, долю 70/30 и график съёмок.'};
      if (stage === 'call1') ev[eid()] = {kind: 'task', t: tsAgo(2), title: 'Созвон в Zoom с экспертом', due: dIn(R.int(0, 3)), who: 'tm_vera', done: false};
      if (stage === 'call2') ev[eid()] = {kind: 'task', t: tsAgo(2), title: 'Отправить условия и договор', due: dAgo(R.int(0, 2)), who: 'tm_vera', done: false};
      if (stage === 'list') ev[eid()] = {kind: 'msg', t: tsAgo(created - 1), ch: 'tg', dir: 'out', by: 'tm_vera', text: `${name.split(' ')[0]}, здравствуйте! Я Вера из Eva Space — платформы для женщин. Мы ищем экспертов в направление «${dir}». Удобно созвониться на 30 минут?`, status: 'sent'};
      if (stage === 'lost') ev[eid()] = {kind: 'note', t: tsAgo(created - 20), by: 'tm_vera', text: 'Не готова к онлайн-съёмкам, ведёт только офлайн. Позвать на Eva Events.'};
      const content = {};
      mks.forEach((title, k) => {
        const st = stage === 'paying' || stage === 'live' ? 'live' : stage === 'shot' ? (k ? 'edit' : 'shot') : 'plan';
        content['mk' + k] = {title, status: st, date: st === 'plan' ? dIn(10 + k * 3) : dAgo(40 - k * 5), kind: k === 0 && formats.includes('Курс') ? 'Курс' : 'Мастер-класс'};
      });
      if (stage === 'paying') ev[eid()] = {kind: 'pay', t: tsAgo(15), type: 'payout', amount: i === 0 ? 18600 : 9800, status: 'ok', method: 'invoice', text: 'Доля с продаж за август'};
      out.experts[id] = {
        demo: true, name, direction: dir, stage, funnel: 'experts', manager: 'tm_vera', audience: aud, experience: exp, formats,
        city: R.pick(['Москва', 'Санкт-Петербург', 'Казань', 'Онлайн']), tg: refCodeFor(name).toLowerCase().replace(/\d+/, '') + '_expert',
        phone: '79' + String(100000000 + hashStr(name) % 899999999).slice(0, 9), email: `${refCodeFor(name).toLowerCase().replace(/\d+/, '')}@mail.ru`,
        social: `t.me/${refCodeFor(name).toLowerCase().replace(/\d+/, '')}_channel`,
        about: ({'Психология': 'Работаю в КПТ и схема-терапии, мягко и без эзотерики.', 'Йога и тело': 'Хатха и йога для спины, делаю акцент на безопасности.', 'Женское здоровье': 'Врач-гинеколог, веду просветительский блог о цикле.'})[dir] || 'Практикую сама и веду группы, люблю короткие форматы.',
        share: 0.7, callAt: Funnels_default_idx('experts', stage) >= 1 ? tsAgo(created - 7, 15) : null,
        shootAt: ['agreed'].includes(stage) ? dIn(R.int(4, 14)) : ['shot', 'live', 'paying'].includes(stage) ? dAgo(R.int(20, 45)) : null,
        content, created: dAgo(created), createdAt: tsAgo(created), stageAt: tsAgo(Math.max(1, created - 30)), ev,
      };
    });
    const COURSES = [
      ['ex_marina', 'course', 'Курс «Мягкая сила: уверенность без борьбы»', 4900],
      ['ex_ksenia', 'course', 'Курс «Йога для начинающих: база»', 3900],
      ['ex_alina', 'course', 'Курс «Медитация с нуля»', 2900],
      ['ex_marina', 'consult', 'Консультация Марины Ясной', 4490],
      ['ex_ksenia', 'consult', 'Разбор практики с Ксенией Роот', 4490],
    ];

    /* ── клиентки ── */
    const FIRST = ['Анна', 'Мария', 'Екатерина', 'Ольга', 'Наталья', 'Ирина', 'Светлана', 'Юлия', 'Татьяна', 'Елена', 'Дарья', 'Алёна', 'Ксения', 'Виктория', 'Полина', 'Алина', 'Кристина', 'Вероника', 'Марина', 'Софья', 'Валерия', 'Яна', 'Карина', 'Диана', 'Евгения', 'Людмила', 'Надежда', 'Лилия', 'Регина', 'Ангелина', 'Василиса', 'Милана', 'Эльвира', 'Жанна', 'Олеся', 'Инна'];
    const LAST = ['Иванова', 'Кузнецова', 'Соколова', 'Попова', 'Лебедева', 'Козлова', 'Новикова', 'Морозова', 'Волкова', 'Алексеева', 'Павлова', 'Семёнова', 'Голубева', 'Виноградова', 'Богданова', 'Воробьёва', 'Фёдорова', 'Михайлова', 'Беляева', 'Тарасова', 'Белова', 'Комарова', 'Орлова', 'Киселёва', 'Макарова', 'Андреева', 'Ковалёва', 'Ильина', 'Гусева', 'Титова', 'Кузьмина', 'Кудрявцева', 'Баранова', 'Куликова', 'Алексеева', 'Степанова', 'Яковлева', 'Сорокина', 'Сергеева', 'Романова'];
    const CITIES = [['Москва', 38], ['Санкт-Петербург', 20], ['Казань', 8], ['Екатеринбург', 7], ['Новосибирск', 5], ['Краснодар', 6], ['Сочи', 4], ['Нижний Новгород', 5], ['Самара', 4], ['Калининград', 3]];
    const NICHE_W = [['Работа в найме', 16], ['Своё дело', 9], ['Декрет', 8], ['Салон красоты', 8], ['Студия пилатеса', 5], ['Йога-студия', 4], ['Фитнес-клуб', 3], ['Косметология', 3], ['Психология и коучинг', 4], ['Образование', 4], ['Медицина', 3], ['Студентка', 3]];
    const SRC_W = [['tg', 16], ['vk', 8], ['blogger', 13], ['ads', 8], ['referral', 15], ['ambassador', 9], ['partner', 9], ['expert', 7], ['conf', 6], ['event', 4], ['site', 7], ['import', 7]];
    const PLAN = [['warm1', 9], ['warm2', 8], ['base', 8], ['lead', 9], ['qual', 6], ['invoice', 6], ['paid', 26], ['lost', 7]];

    const DIALOG = {
      in: {
        lead: ['Здравствуйте! Хочу узнать про подписку — что в неё входит?', 'Я совсем новичок в практиках, мне подойдёт?', 'Добрый день! Увидела вас у блогера, расскажите подробнее', 'Можно попробовать бесплатно?', 'Я мама малыша, у меня минут 10 в день. Есть смысл?'],
        qual: ['А сколько стоит год?', 'Есть ли курс именно про деньги?', 'Удобно, если перезвоните после 18:00', 'Практики можно делать без коврика?'],
        invoice: ['Пришлите, пожалуйста, ссылку ещё раз', 'Можно оплатить через СБП?', 'Оплачу в пятницу, после зарплаты'],
        paid: ['Спасибо, оплатила! Программа уже пришла', 'Третий день подряд закрываю звёзды 🌟', 'А можно подарить подписку подруге?', 'Не приходит код из письма, помогите', 'Очень понравился мастер-класс про границы'],
        lost: ['Пока дорого, вернусь позже', 'Спасибо, я пока не готова'],
      },
      out: {
        lead: ['Здравствуйте, {имя}! Я {менеджер} из Eva Space. Да, программа собирается под ваш уровень — новичкам начинаем с коротких практик по 7–10 минут.', '{имя}, добрый день! Подписка — это персональная программа на каждый день: аффирмация, практика и мастер-класс. Первые 3 дня бесплатно.'],
        qual: ['Годовая подписка — 24 900 ₽, это 2 075 ₽ в месяц, выгода 29%.', 'Да, у Инны Ковыль скоро выйдет курс «Деньги в женских руках» — подписчицам скидка 15%.', 'Хорошо, наберу вас после 18:00 🙂'],
        invoice: ['Отправляю ссылку на оплату: eva.space/pay — можно картой или по СБП.', '{имя}, счёт ещё ждёт вас. Если остались вопросы — отвечу здесь.'],
        paid: ['Ура, добро пожаловать в Еву! Программа на первую неделю уже в приложении.', 'Подарить можно: по вашему промокоду подруге 300 бонусов, а вам — процент с её оплат.', 'Код отправили повторно, проверьте папку «Промоакции».'],
        lost: ['Поняла вас, {имя}. Оставлю вам бесплатную практику — возвращайтесь, когда будет удобно.'],
      },
    };
    const NOTES = ['Ищет спокойствие после выгорания, работает в IT. Важно — короткие практики утром.', 'Интересуется курсами, спрашивала про рассрочку.', 'Пришла по рекомендации подруги, очень тёплая. Позвать в амбассадоры.', 'Предпочитает WhatsApp, в Telegram не отвечает.', 'Была на эфире «Женская энергия», задавала вопросы про цикл.', 'Хочет годовой тариф, ждёт зарплату 10 числа.'];
    const CALL_SUM = ['Обсудили цели: уверенность и энергия. Подходит месячный тариф, отправлю ссылку.', 'Рассказала про пробный доступ, договорились созвониться после пробных дней.', 'Спрашивала про годовой тариф и курсы; интересна психология.', 'Уточнила сомнения по времени — 10 минут в день её устраивают.'];

    const amb = {};  // пригласившие
    const N = 78;
    const list = [];
    for (let i = 0; i < N; i++) {
      const first = FIRST[i % FIRST.length];
      const last = LAST[(i * 7 + 3) % LAST.length];
      const id = 'c' + String(i + 1).padStart(3, '0');
      list.push({id, name: `${first} ${last}`});
    }
    /* амбассадоры и активные «приведи подругу» — из первых оплативших */
    const refLeaders = {c002: 'key', c005: 'amb', c009: 'amb', c013: 'friend', c021: 'friend'};

    list.forEach((base, i) => {
      const {id, name} = base;
      let stage = R.weighted(PLAN);
      if (refLeaders[id]) stage = 'paid';
      let source = R.weighted(SRC_W);
      if (refLeaders[id] && ['referral', 'ambassador', 'import'].includes(source)) source = 'blogger';
      const niche = R.weighted(NICHE_W);
      const city = R.weighted(CITIES);
      const created = refLeaders[id] ? R.int(125, 150) : stage === 'paid' ? (R.chance(0.3) ? R.int(9, 30) : R.int(35, 150)) : stage === 'lost' ? R.int(8, 120) : R.int(1, 60);
      const ev = {};
      const quiz = {
        goal: R.some(Object.keys(QUIZ.goal.opts), R.int(1, 3)),
        level: R.weighted([['new', 5], ['tried', 4], ['regular', 2]]),
        time: R.weighted([['t10', 5], ['t20', 4], ['t40', 2]]),
        rel: R.pick(Object.keys(QUIZ.rel.opts)),
        stage: niche === 'Декрет' ? R.pick(['baby', 'pregnant']) : niche === 'Своё дело' ? 'career' : R.weighted([['career', 4], ['search', 3], ['school', 2], ['grown', 1], ['baby', 1]]),
        interest: R.some(Object.keys(QUIZ.interest.opts), R.int(2, 5)),
      };
      const tags = [];
      if (quiz.stage === 'baby' || quiz.stage === 'pregnant' || quiz.stage === 'school') tags.push('mom');
      if (niche === 'Своё дело') tags.push('business');
      if (source === 'conf') tags.push('conf');
      if (R.chance(0.2)) tags.push('webinar');
      if (R.chance(0.12) && stage !== 'paid') tags.push('hot');
      if (R.chance(0.15)) tags.push('course');
      const inApp = source !== 'import' && !['warm1'].includes(stage);
      const createdTs = tsAgo(created);
      const manager = ['warm1', 'warm2'].includes(stage) ? (R.chance(0.3) ? R.pick(managers) : null)
        : stage === 'lead' && R.chance(0.45) ? null : R.pick(managers);
      const partnerId = source === 'partner' ? R.pick(['pt_lavanda', 'pt_lavanda', 'pt_tihaya', 'pt_core', 'pt_derma', 'pt_aroma']) : null;
      const org = ['Салон красоты', 'Студия пилатеса', 'Йога-студия', 'Фитнес-клуб', 'Косметология'].includes(niche) && R.chance(0.45)
        ? ({'Салон красоты': 'Салон «' + R.pick(['Шёлк', 'Пион', 'Мята', 'Аура', 'Бархат']) + '»', 'Студия пилатеса': 'Студия «' + R.pick(['Баланс', 'Осанка', 'Реформ']) + '»', 'Йога-студия': 'Йога-студия «' + R.pick(['Прана', 'Мудра']) + '»', 'Фитнес-клуб': 'Клуб «' + R.pick(['Ритм', 'Пульс']) + '»', 'Косметология': 'Кабинет «' + R.pick(['Скин', 'Лицо']) + '»'})[niche] : '';

      /* регистрация и анкета */
      if (source === 'import') ev[eid()] = {kind: 'sys', t: createdTs, text: 'Загружена из файла «База студий и салонов, сентябрь.csv»'};
      else if (inApp) ev[eid()] = {kind: 'sys', ch: 'app', t: createdTs, text: 'Регистрация в Eva Space, анкета заполнена'};
      else ev[eid()] = {kind: 'sys', ch: 'tg', t: createdTs, text: 'Подписалась на Telegram-бота Евы, получила практику в подарок'};

      /* путь по воронке */
      const entry = source === 'import' ? 'base' : ['site', 'ads', 'referral', 'partner', 'ambassador'].includes(source) ? 'lead' : 'warm1';
      const order = ['warm1', 'warm2', 'base', 'lead', 'qual', 'invoice', 'paid'];
      let path = [];
      if (stage === 'lost') {
        const upto = R.pick(['warm2', 'lead', 'qual', 'invoice']);
        const a = order.indexOf(entry), b = Math.max(a, order.indexOf(upto));
        path = order.slice(a, b + 1).concat('lost');
      } else {
        const a = order.indexOf(entry), b = order.indexOf(stage);
        path = b >= a ? order.slice(a, b + 1) : [stage];
      }
      const span = Math.max(1, created - (stage === 'paid' || stage === 'lost' ? R.int(10, Math.max(12, created - 5)) : R.int(0, Math.max(0, created - 1))));
      const stepDays = path.length > 1 ? Math.max(0.5, span / (path.length - 1)) : 0;
      let stageTs = createdTs;
      path.forEach((st, k) => {
        if (!k) return;
        stageTs = Math.min(T - 3600e3, createdTs + Math.round(stepDays * k * DAY));
        ev[eid()] = {kind: 'stage', t: stageTs, funnel: 'sales', from: path[k - 1], to: st, by: st === 'paid' || st === 'invoice' ? null : manager, auto: st === 'paid' || st === 'invoice', text: st === 'paid' ? 'пришла оплата' : st === 'invoice' ? 'выставлен счёт' : st === 'lost' ? '' : ''};
      });
      const stagedAt = stageTs;

      /* прогрев: касания рассылками будут ниже, здесь — диалоги */
      const talk = (kind, days, dir) => {
        const bank = DIALOG[dir][kind];
        const txt = R.pick(bank).replace('{имя}', name.split(' ')[0]).replace('{менеджер}', manager ? team[manager].name.split(' ')[0] : 'Анна');
        const ch = R.weighted([['tg', 6], ['wa', 3], ['email', 1]]);
        const t = Math.min(T - 120e3, days);
        ev[eid()] = {kind: 'msg', ch, dir, t, by: dir === 'out' ? manager || 'tm_anna' : null, text: txt, status: dir === 'out' ? 'sent' : undefined};
        return t;
      };
      const reached = s => path.includes(s);
      if (reached('lead')) {
        const t0 = createdTs + (entry === 'lead' ? 0 : Math.round(stepDays * path.indexOf('lead') * DAY));
        const tIn = talk('lead', t0 + 20 * 60e3, 'in');
        /* часть свежих заявок ещё без ответа — это видно в «Ждут ответа» */
        const unanswered = stage === 'lead' && created < 3 && R.chance(0.6);
        if (!unanswered) talk('lead', tIn + R.int(4, 50) * 60e3, 'out');
      }
      if (reached('qual')) {
        const tq = createdTs + Math.round(stepDays * path.indexOf('qual') * DAY) - 3 * 3600e3;
        ev[eid()] = {kind: 'call', t: tq - 3600e3, dir: 'out', dur: 0, result: 'noanswer', by: manager || 'tm_anna'};
        ev[eid()] = {kind: 'call', t: tq, dir: R.chance(0.3) ? 'in' : 'out', dur: R.int(180, 780), result: 'ok', by: manager || 'tm_anna', text: R.pick(CALL_SUM)};
        talk('qual', tq + 2 * 3600e3, 'in');
        talk('qual', tq + 3 * 3600e3, 'out');
      }
      if (reached('invoice')) {
        const ti = createdTs + Math.round(stepDays * path.indexOf('invoice') * DAY);
        talk('invoice', ti + 600e3, 'out');
        if (stage === 'invoice') {
          ev[eid()] = {kind: 'pay', t: ti, type: R.chance(0.25) ? 'year' : 'sub', amount: 0, status: 'pending', method: 'card', by: manager, text: 'Ссылка на оплату отправлена'};
          if (R.chance(0.5)) talk('invoice', ti + 5 * 3600e3, 'in');
        }
      }
      if (stage === 'lost') {
        const tl = stagedAt;
        talk('lost', tl - 3600e3, 'in');
        talk('lost', tl - 1800e3, 'out');
      }
      if (R.chance(0.35) && manager) ev[eid()] = {kind: 'note', t: createdTs + R.int(1, 3) * 3600e3, by: manager, text: R.pick(NOTES)};
      if (tags.includes('webinar')) ev[eid()] = {kind: 'meet', t: createdTs + R.int(2, 8) * DAY, ch: 'app', text: 'Была на эфире «Женская энергия: откуда берётся и куда утекает»'};

      /* оплаты */
      let points = inApp ? R.int(40, 900) : 0;
      let refProgram = null;
      if (stage === 'paid') {
        const firstTs = stagedAt;
        const year = R.chance(0.18);
        const method = () => R.weighted([['card', 6], ['sbp', 4]]);
        ev[eid()] = {kind: 'pay', t: firstTs, type: year ? 'year' : 'sub', amount: year ? 24900 : 2900, status: 'ok', method: method(), by: null, text: year ? 'Годовая подписка' : 'Подписка на месяц', ...(R.chance(0.2) ? {bonusUsed: 300} : {})};
        if (!year) {
          let t = firstTs;
          while (t + 30 * DAY < T && !R.chance(refLeaders[id] ? 0 : 0.13)) {
            t += 30 * DAY;
            ev[eid()] = {kind: 'pay', t, type: 'sub', amount: 2900, status: 'ok', method: 'card', text: 'Автопродление подписки'};
          }
        }
        if (R.chance(0.35)) {
          const [exId, type, item, price] = R.pick(COURSES);
          ev[eid()] = {kind: 'pay', t: Math.min(T - 3600e3, firstTs + R.int(3, 40) * DAY), type, amount: Math.round(price * 0.85), status: 'ok', method: method(), item, expertId: exId, text: `${item} · скидка подписчицы 15%`};
        }
        if (R.chance(0.2)) ev[eid()] = {kind: 'pay', t: Math.min(T - 3600e3, firstTs + R.int(5, 50) * DAY), type: 'market', amount: R.pick([890, 1490, 2390, 3200]), status: 'ok', method: method(), item: R.pick(['Набор «Вечерний ритуал»', 'Коврик для практик', 'Аромасвеча «Тишина»', 'Дневник благодарности'])};
        if (R.chance(0.12)) {
          const tt = Math.min(T - 3600e3, firstTs + R.int(2, 30) * DAY);
          ev[eid()] = {kind: 'pay', t: tt, type: 'topup', amount: 5000, status: 'ok', method: 'sbp', text: 'Пополнение баланса'};
          ev[eid()] = {kind: 'pay', t: Math.min(T - 1800e3, tt + 2 * DAY), type: 'event', amount: 3500, status: 'ok', method: 'balance', item: 'Встреча Eva Events «Осенний круг» в пространстве «Свет»'};
        }
        if (R.chance(0.05)) ev[eid()] = {kind: 'pay', t: Math.min(T - 3600e3, firstTs + 2 * DAY), type: 'refund', amount: 2900, status: 'ok', method: 'card', text: 'Возврат по заявлению: не подошёл формат'};
        points = R.int(300, 4200);
        if (refLeaders[id]) { refProgram = refLeaders[id]; points = refProgram === 'friend' ? 3900 : R.int(1200, 3000); }
        talk('paid', Math.min(T - 7200e3, firstTs + 3600e3), 'in');
        talk('paid', Math.min(T - 3600e3, firstTs + 2 * 3600e3), 'out');
        if (R.chance(0.35)) {
          const tRecent = T - R.int(1, 4) * DAY + R.int(0, 6) * 3600e3;
          talk('paid', tRecent, 'in');
          if (R.chance(0.5)) talk('paid', tRecent + 1800e3, 'out');
        }
      }

      /* задачи */
      if (['lead', 'qual', 'invoice', 'base'].includes(stage) && manager) {
        const title = ({lead: 'Перезвонить и провести квалификацию', qual: 'Отправить ссылку на оплату', invoice: 'Напомнить об оплате и перезвонить', base: 'Первое касание: написать в мессенджер'})[stage];
        const due = R.chance(0.35) ? dAgo(R.int(1, 3)) : R.chance(0.5) ? dAgo(0) : dIn(R.int(1, 4));
        ev[eid()] = {kind: 'task', t: T - R.int(1, 3) * DAY, title, due, who: manager, done: false};
      }
      if (stage === 'paid' && R.chance(0.25) && manager) ev[eid()] = {kind: 'task', t: T - 2 * DAY, title: R.pick(['Позвонить через месяц: как идут практики', 'Предложить годовой тариф', 'Пригласить в амбассадоры']), due: dIn(R.int(0, 6)), who: manager, done: false};
      if (manager && R.chance(0.3)) ev[eid()] = {kind: 'task', t: createdTs + DAY, title: 'Написать после регистрации', due: isoTs(createdTs + DAY), who: manager, done: true, doneAt: createdTs + DAY + 3600e3, doneBy: manager};

      const consentAds = source === 'import' ? null : R.chance(0.86) ? isoTs(createdTs) : null;
      out.clients[id] = {
        demo: true, name, phone: '79' + String(160000000 + (hashStr(name + i) % 839999999)).padStart(9, '0').slice(0, 9),
        email: R.chance(0.8) ? `${refCodeFor(name).toLowerCase().replace(/\d+/, '')}${i}@${R.pick(['mail.ru', 'yandex.ru', 'gmail.com', 'bk.ru'])}` : '',
        tg: R.chance(0.75) ? `${refCodeFor(name).toLowerCase().replace(/\d+/, '')}_${i + 10}` : '',
        wa: '', city, birth: `${R.int(1979, 2001)}-${pad(R.int(1, 12))}-${pad(R.int(1, 28))}`, niche, org,
        funnel: 'sales', stage, stageAt: stagedAt, lostReason: stage === 'lost' ? R.pick(LOST_REASONS) : null,
        tags, manager, source, utm: ({blogger: R.pick(['blog_mama_sept', 'blog_psy_aug']), ads: R.pick(['vk_ads_trial', 'direct_energy']), tg: 'tg_channel'})[source] || '',
        partnerId, referrerId: null, created: isoTs(createdTs), createdAt: createdTs,
        quiz: inApp ? quiz : {}, appId: inApp ? 'u' + (10400 + i * 37) : '',
        trialUntil: inApp && stage !== 'paid' && created <= 4 ? addDays(isoTs(createdTs), 3) : null,
        consentPD: source === 'import' ? null : isoTs(createdTs), consentAds, consentHealth: inApp && R.chance(0.6) ? isoTs(createdTs) : null,
        allowCh: consentAds ? R.some(['email', 'push', 'tg', 'wa'], R.int(2, 4)) : [],
        lastSeen: inApp ? (stage === 'paid' ? dAgo(R.int(0, 12)) : dAgo(Math.max(0, created - R.int(0, 3)))) : null,
        stars: stage === 'paid' ? R.int(3, 21) : inApp ? R.int(0, 6) : 0, practices: stage === 'paid' ? R.int(8, 140) : inApp ? R.int(0, 6) : 0,
        points, bonus: inApp ? R.pick([0, 150, 300, 300, 450]) : 0, balance: 0,
        refCode: refCodeFor(name), refProgram, refMode: refProgram ? (refProgram === 'friend' ? 'balance' : 'card') : null,
        taxStatus: refProgram === 'key' ? 'ip' : refProgram === 'amb' ? 'npd' : null, ambSince: refProgram && refProgram !== 'friend' ? isoTs(createdTs + 5 * DAY) : null,
        readAt: stage === 'lead' && created < 3 ? createdTs - 1000 : T - (stage === 'paid' && R.chance(0.5) ? 5 * DAY : 0),
        ev,
      };
      if (refProgram) amb[id] = refProgram;
    });

    /* приглашённые: пришедшие по ссылке подруги или амбассадора */
    const leaders = Object.keys(amb);
    Object.entries(out.clients).forEach(([cid, c], i) => {
      if (leaders.includes(cid)) return;
      if (c.source === 'referral' || c.source === 'ambassador') {
        const pool = c.source === 'ambassador' ? leaders.filter(x => amb[x] !== 'friend') : leaders;
        const ref = pool[i % pool.length];
        if (out.clients[ref].createdAt < c.createdAt) c.referrerId = ref;
        else c.referrerId = pool.find(x => out.clients[x].createdAt < c.createdAt) || null;
      }
    });
    /* у «приведи подругу» — хотя бы по две оплатившие подруги */
    ['c013', 'c021'].forEach(ref => {
      const have = Object.values(out.clients).filter(c => c.referrerId === ref && c.stage === 'paid').length;
      Object.entries(out.clients).filter(([cid, c]) => !leaders.includes(cid) && !c.referrerId && c.stage === 'paid' && c.createdAt > out.clients[ref].createdAt && ['site', 'tg', 'vk'].includes(c.source))
        .slice(0, Math.max(0, 2 - have)).forEach(([, c]) => { c.source = 'referral'; c.referrerId = ref; });
    });

    /* клиентки от партнёров: у действующих партнёров — хотя бы несколько */
    Object.entries(out.clients).filter(([cid, c]) => !leaders.includes(cid) && c.stage === 'paid' && ['blogger', 'ads', 'vk'].includes(c.source) && !c.referrerId).slice(0, 5)
      .forEach(([, c], k) => { c.source = 'partner'; c.partnerId = ['pt_lavanda', 'pt_lavanda', 'pt_tihaya', 'pt_aroma', 'pt_core'][k]; c.utm = 'promo_' + out.partners[c.partnerId].promo.toLowerCase(); });

    /* ── групповые чаты ── */
    const confMembers = Object.entries(out.clients).filter(([, c]) => c.tags.includes('conf') || c.source === 'conf').map(([cid]) => cid);
    Object.entries(out.clients).filter(([, c]) => c.stage === 'paid' && c.tags.includes('business')).slice(0, 3).forEach(([cid, c]) => { if (!confMembers.includes(cid)) { confMembers.push(cid); c.tags.push('conf'); } });
    const cm = (daysAgo, from, text) => ({t: tsAgo(daysAgo), from, text});
    const who = k => ({type: 'client', id: confMembers[k % confMembers.length]});
    const conf = {
      m1: cm(21, {type: 'team', id: 'tm_anna'}, 'Добро пожаловать в нетворкинг-чат STARTUP UNICONF Бали 2.0! Конференция — 15 декабря, 10:00–19:00, Parq Ubud. Здесь — новости, трансфер и знакомства.'),
      m2: cm(20, who(0), 'Всем привет! Лечу из Москвы 12-го, кто ещё рядом по датам?'),
      m3: cm(20, who(1), 'Я 13-го из Питера, давайте соберёмся в Убуде накануне 🙌'),
      m4: cm(18, {type: 'team', id: 'tm_anna'}, 'Для участниц Евы на конференции — утренняя практика на террасе в 8:30 с Ксенией Роот. Запись в боте.'),
      m5: cm(14, who(2), 'А питч-сессия будет на английском или можно по-русски?'),
      m6: cm(14, {type: 'team', id: 'tm_katya'}, 'Питчи на русском и английском, слайды лучше на английском. Шаблон пришлём в пятницу.'),
      m7: cm(9, who(3), 'Ищу соседку в виллу на 3 ночи, пишите в личку 🙂'),
      m8: cm(6, who(4), 'Кто-нибудь идёт на тариф Gold? Что в него входит, кроме ужина?'),
      m9: cm(5, {type: 'team', id: 'tm_anna'}, 'Gold: ужин со спикерами, закрытая сессия и трансфер из аэропорта. Подробности — у менеджера в личке.'),
      m10: cm(2, who(5), 'Спасибо за чат! Уже нашла двух соседок и партнёра по проекту 💛'),
      m11: cm(0.2, who(1), 'Когда будет расписание спикеров?'),
    };
    out.chats.ch_conf = {demo: true, order: 1, name: 'STARTUP UNICONF Бали 2.0 · групповой чат конференции', kind: 'conf', ch: 'tg', about: 'Нетворкинг-чат участниц конференции 15 декабря, Parq Ubud. Сообщения отсюда уходят в общий чат в Telegram.', members: confMembers, msgs: conf};
    const clubMembers = Object.entries(out.clients).filter(([, c]) => c.stage === 'paid' && (c.niche === 'Своё дело' || c.quiz.stage === 'career')).slice(0, 12).map(([cid]) => cid);
    const wc = k => ({type: 'client', id: clubMembers[k % Math.max(1, clubMembers.length)]});
    out.chats.ch_club = {demo: true, order: 2, name: 'Круг «Своё дело» · чат участниц', kind: 'club', ch: 'tg', about: 'Платный клуб 1 500 ₽ в месяц: разборы, созвоны по средам, взаимная поддержка.', members: clubMembers, msgs: {
      a1: cm(12, {type: 'team', id: 'tm_olga'}, 'Девочки, в среду в 19:00 созвон «Как поднять чек без страха». Ссылка — за час.'),
      a2: cm(12, wc(0), 'Буду! Как раз хочу поднять цены на консультации.'),
      a3: cm(7, wc(1), 'Поделюсь: после разбора запустила предзапись и собрала 11 заявок 🎉'),
      a4: cm(3, wc(2), 'Кто пользуется CRM для записи клиентов? Посоветуйте простую.'),
      a5: cm(1, {type: 'team', id: 'tm_olga'}, 'Запись созвона и конспект уже в разделе клуба в приложении.'),
    }};

    /* ── рассылки ── */
    const campsSrc = [
      ['cp_breath', 'Прогрев 1: практика «Дыхание 4–7–8» в подарок', 'tg', 58, 'Привет, {имя}! Держи практику «Дыхание 4–7–8» — семь минут, чтобы выдохнуть.', c => ['warm1', 'warm2', 'base', 'lead', 'qual', 'invoice', 'paid'].includes(c.stage) && c.createdAt < T - 58 * DAY],
      ['cp_webinar', 'Эфир «Женская энергия» — приглашение', 'email', 40, '{имя}, в четверг в 19:00 — бесплатный эфир с Тая Мирной про энергию и цикл.', c => c.createdAt < T - 40 * DAY],
      ['cp_trial', 'Три дня Евы бесплатно', 'tg', 24, '{имя}, попробуйте программу Евы: 3 дня бесплатно, без привязки карты.', c => c.stage !== 'paid' && c.createdAt < T - 24 * DAY],
      ['cp_uni', 'UNICONF: ранняя регистрация', 'wa', 19, '{имя}, открыта ранняя регистрация на STARTUP UNICONF Бали 2.0 — 15 декабря.', c => c.tags.includes('business') || c.tags.includes('conf')],
      ['cp_friend', 'Приведи подругу — осенняя акция', 'email', 9, '{имя}, делитесь Евой: подруге 300 бонусов, вам — процент с её оплат.', c => c.stage === 'paid'],
      ['cp_push', 'Пуш: итоги недели и звёзды', 'push', 3, 'Неделя закрыта: смотрите, сколько звёзд вы собрали 🌟', c => !!c.appId],
    ];
    campsSrc.forEach(([id, name, ch, days, text, audience]) => {
      const at = tsAgo(days, 11);
      let excluded = 0, n = 0;
      Object.values(out.clients).forEach(c => {
        if (c.createdAt > at || !audience(c)) return;
        const okCh = c.consentAds && (!c.allowCh.length || c.allowCh.includes(ch)) && (ch === 'email' ? c.email : ch === 'tg' ? c.tg : ch === 'push' ? c.appId : c.phone);
        if (!okCh) { excluded++; return; }
        n++;
        const st = R.weighted(ch === 'push' ? [['delivered', 50], ['opened', 35], ['clicked', 12], ['failed', 3]] : [['delivered', 34], ['opened', 38], ['clicked', 17], ['replied', 5], ['unsub', 2], ['failed', 4]]);
        c.ev[eid()] = {kind: 'camp', camp: id, ch, t: at + R.int(0, 40) * 60e3, status: st, text: name};
      });
      out.campaigns[id] = {demo: true, name, ch, text, status: 'sent', at, createdAt: at - DAY, by: 'tm_anna', audience: {label: 'условия кампании'}, excluded, sent: n};
    });
    out.campaigns.cp_october = {demo: true, name: 'Октябрьский запуск: первый месяц за 1 490 ₽', ch: 'tg', status: 'draft', createdAt: T - DAY, by: 'tm_anna',
      text: '{имя}, с 1 октября — запуск Евы! Первый месяц подписки за 1 490 ₽ по промокоду START. Успейте до 7 октября.',
      audience: {match: 'all', rules: [{f: 'stage', op: 'in', v: ['warm2', 'base', 'lead', 'qual']}]}};

    /* реестры выплат прошлых месяцев считаются после загрузки — из тех же
       начислений, что видит CRM (см. Demo.closeMonths) */

    out.cfg.meta = {demo: true, seededAt: T, version: 1};
    return out;
  },

  count(d) { return Object.values(d).reduce((a, m) => a + Object.keys(m).length, 0); },

  /* загрузка в текущую базу: по одной записи, с очередью хранилища */
  async load(onProgress) {
    const d = this.build();
    const total = this.count(d);
    let n = 0;
    for (const [c, docs] of Object.entries(d)) {
      for (const [id, doc] of Object.entries(docs)) {
        Store.put(c, id, doc);
        n++;
        if (onProgress && n % 10 === 0) onProgress(n, total);
        if (n % 20 === 0) await new Promise(r => setTimeout(r, 30));
      }
    }
    this.closeMonths();
    await Store.flush();
    return total;
  },
  /* позапрошлый месяц закрыт целиком, прошлый ждёт выплаты 10 числа */
  closeMonths() {
    const s = settings(), cur = monthOf(today());
    [addMonths(cur, -2), addMonths(cur, -1)].forEach((m, k) => {
      const rows = {};
      Referral.registry(m).forEach(x => {
        if (x.status !== 'due') return;
        if (k === 1) return;
        const status = x.mode === 'card' ? 'paid' : 'balance';
        rows[x.r.id] = {status, amount: x.due, mode: x.mode, at: dateOf(addMonths(m, 1) + '-0' + Math.min(9, s.refPayDay - 1)).getTime() + 11 * 3600e3, by: 'tm_vera'};
        if (status === 'balance') Store.patch('clients', x.r.id, {balance: (Clients.get(x.r.id).balance || 0) + Math.round(x.due * (1 + s.refBalanceBonus))});
        /* сохраняем по одному месяцу: registry следующего месяца учитывает выплаты этого */
        Store.put('payouts', m, {demo: true, month: m, createdAt: Date.now(), rows: {...((Store.get('payouts', m) || {}).rows || {}), [x.r.id]: rows[x.r.id]}});
      });
    });
  },
  async clear() {
    let n = 0;
    for (const c of Store.COLS) {
      for (const doc of Store.all(c)) {
        if (doc.demo) { Store.remove(c, doc.id); n++; }
      }
    }
    await Store.flush();
    return n;
  },
  present() { return Store.COLS.some(c => Store.all(c).some(d => d.demo)); },
};

/* путь по этапам воронки по умолчанию до нужного (для демо) */
function Funnels_default_path(fid, stage) {
  const st = DEFAULT_FUNNELS[fid].stages.map(s => s.id);
  if (stage === 'lost') return st.slice(0, 3).concat('lost');
  return st.slice(0, st.indexOf(stage) + 1);
}
function Funnels_default_idx(fid, stage) { return DEFAULT_FUNNELS[fid].stages.findIndex(s => s.id === stage); }
