import { PEOPLE, MATERIALS, ARCHIVE, TEAM_SEEDS, REVENUE_REASONS } from '../data/people.js';
import { DAY, WEEK, HOUR, addMonths, weekKey } from './time.js';
import { hash } from './format.js';
import { ensureEvents } from './events.js';

/* Демо-данные клуба. Собираются один раз при первом запуске и дальше
   живут в localStorage — как настоящая база, только на телефоне. */

const LOCATIVE = {
  Москва: 'Москве',
  'Санкт-Петербург': 'Петербурге',
  Казань: 'Казани',
  Екатеринбург: 'Екатеринбурге',
  Новосибирск: 'Новосибирске',
  Краснодар: 'Краснодаре',
  Тбилиси: 'Тбилиси',
  Дубай: 'Дубае',
  Белград: 'Белграде',
  Алматы: 'Алматы',
};

/** «Пятница в {городе}» — приводим название к предложному падежу. */
export function locative(name = '') {
  const clean = name.trim();
  if (LOCATIVE[clean]) return LOCATIVE[clean];
  if (/[ыиоуеэюя]$/i.test(clean)) return clean;
  if (/а$/i.test(clean)) return clean.slice(0, -1) + 'е';
  if (/[ья]$/i.test(clean)) return clean.slice(0, -1) + 'и';
  if (/ь$/i.test(clean)) return clean.slice(0, -1) + 'и';
  return clean + 'е';
}

export function cityId(name) {
  return 'c_' + hash(name.trim().toLowerCase()).toString(36);
}

export function makeCity(name, now = Date.now()) {
  return {
    id: cityId(name),
    name: name.trim(),
    nameIn: locative(name),
    organizerId: null,
    organizerOfferTo: null,
    organizerDeclined: [],
    chatUrl: '',
    createdAt: now,
  };
}

/* Роль в команде выводим из навыков: так демо-люди сразу разложены по ролям */
const ROLE_BY_SKILL = {
  'Разработка': 'Разработка',
  'Продажи': 'Продажи',
  'ИИ-агенты': 'Продукт',
  'Продукт': 'Продукт',
  'Нейросети в маркетинге': 'Маркетинг',
  'Контент': 'Маркетинг',
  'Видео и монтаж': 'Маркетинг',
  'Дизайн': 'Маркетинг',
  'Финансы': 'Финансы',
  'Автоматизация': 'Операционка',
  'Найм и HR': 'Операционка',
  'Обучение': 'Операционка',
};

const ROLES = ['Предприниматель', 'Эксперт', 'Руководитель', 'Программист', 'Автоматизация', 'Дизайнер', 'Креатор', 'Блогер', 'Маркетолог', 'Продюсер', 'Продажи', 'Инвестор'];
const WORK = ['Своё дело', 'Фриланс', 'Работаю в компании'];
const SCHEDULE = ['Стандартный 5/2', 'Сменный 2/2', 'Свободный'];
const AIMS = ['Заработать', 'Научиться', 'Общение'];
const FIELDS = ['Услуги', 'Приложение', 'Креатив', 'Торговля', 'Обучение'];
const SPHERES = ['Инфобизнес', 'ИТ-продукты', 'Контент и блогинг', 'Услуги и агентство', 'Торговля', 'Производство', 'Образование'];
const EXP = ['Первый год', '1–3 года', '3–7 лет', 'Больше 7'];
const AGE = ['18–25', '26–32', '33–40', '41–50', '50+'];
const INCOME = ['до 100 тыс', '100–300 тыс', '300–500 тыс', 'больше 500 тыс'];
const STATUS = ['Хочу влюбиться', 'В отношениях', 'Женат / замужем', 'Не указываю'];
const AI = ['Новичок', 'Средний уровень', 'Про'];
const GOALS = ['Новые знакомства', 'Встретить любовь', 'Найти партнёров', 'Запустить проект', 'Оптимизировать время', 'Научиться ИИ'];
const POWERS = ['Придумывать', 'Договариваться', 'Собирать продукт', 'Делать красиво', 'Писать тексты', 'Считать деньги', 'Автоматизировать', 'Выступать', 'Доводить до конца'];
const HOBBY = ['Падл и теннис', 'Горы и походы', 'Караоке', 'Настолки', 'Клубы и вечеринки', 'Зал и бег', 'Путешествия', 'Вино и рестораны', 'Книги и подкасты', 'Мотоциклы и авто', 'Музыка', 'Фото и видео'];

/** Ответы анкеты для демо-участника — устойчивые, но разные. */
function factsFor(user, pick, female) {
  const craft = ROLE_BY_SKILL[user.skills[0]] || ROLE_BY_SKILL[user.skills[1]] || 'Продукт';
  // Возраст и доход тянутся за опытом: «Больше 7 лет в деле» в 18–25 выглядит выдумкой
  const expIndex = Math.floor(pick() * EXP.length);
  const age = AGE[Math.min(AGE.length - 1, expIndex + Math.floor(pick() * 2))];
  const income = INCOME[Math.min(INCOME.length - 1, Math.max(0, expIndex - 1 + Math.floor(pick() * 2)))];
  return {
    craft: [craft],
    role: [...ROLES].sort(() => pick() - 0.5).slice(0, 1 + Math.floor(pick() * 2)),
    work: [WORK[Math.floor(pick() * WORK.length)]],
    schedule: [SCHEDULE[Math.floor(pick() * SCHEDULE.length)]],
    gender: [female ? 'Женщина' : 'Мужчина'],
    sphere: [SPHERES[Math.floor(pick() * SPHERES.length)]],
    exp: [EXP[expIndex]],
    age: [age],
    income: [income],
    status: [STATUS[Math.floor(pick() * STATUS.length)]],
    ai: [AI[Math.floor(pick() * AI.length)]],
    goal: [...GOALS].sort(() => pick() - 0.5).slice(0, 1 + Math.floor(pick() * 2)),
    powers: [...POWERS].sort(() => pick() - 0.5).slice(0, 2 + Math.floor(pick() * 2)),
    hobby: [...HOBBY].sort(() => pick() - 0.5).slice(0, 2 + Math.floor(pick() * 2)),
  };
}

/* Простой генератор псевдослучайных чисел: одинаковые данные при каждой сборке */
function rng(seed) {
  let s = hash(String(seed)) % 2147483647;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* Партнёры сезона: у каждого своя страница и оффер участникам */
const SPONSORS = [
  {
    id: 'sp1',
    name: 'Кинескоп',
    tone: '#6d9bff',
    tag: 'Видеохостинг',
    short: 'Хранит все эфиры клуба',
    about: 'Российский видеохостинг для бизнеса: приватные ссылки, аналитика досмотров и плеер, который не тормозит.',
    offer: 'Три месяца тарифа Pro бесплатно по промокоду IAICLUB',
    link: 'https://kinescope.io',
  },
  {
    id: 'sp2',
    name: 'Точка',
    tone: '#79d2bf',
    tag: 'Банк для бизнеса',
    short: 'Счёт за день, без визита',
    about: 'Банк для предпринимателей: открытие счёта онлайн, бухгалтерия и эквайринг в одном окне.',
    offer: 'Обслуживание бесплатно на год для участников клуба',
    link: 'https://tochka.com',
  },
  {
    id: 'sp3',
    name: 'Лоджик',
    tone: '#8e7bf5',
    tag: 'ИИ-платформа',
    short: 'Агенты без разработчика',
    about: 'Конструктор ИИ-агентов: база знаний, телефония и интеграции с CRM без единой строки кода.',
    offer: 'Годовая лицензия со скидкой 40% и час внедрения в подарок',
    link: 'https://example.com',
  },
];

const TEAM_GOALS = [
  'Дойти до миллиона выручки и нанять первого сотрудника',
  'Собрать 30 клиентов на подписке до выпускного',
  'Запустить продукт в трёх городах',
  'Выйти на окупаемость и снять зависимость от рекламы',
  'Сделать так, чтобы продукт продавал себя сам',
];

const PLACES = {
  Москва: 'Кофейня «Депо», Лесная 20 — второй этаж у окна',
  'Санкт-Петербург': 'Бар «Заря», Казанская 7',
  Казань: 'Антикафе «Небо», Баумана 44',
  Екатеринбург: 'Кофейня «Энгельс», Ленина 49',
};

export function buildSeed(now = Date.now()) {
  const rand = rng('iai-club');

  // Сезон: начался два месяца назад, идёт три месяца
  const seasonStart = new Date(now);
  seasonStart.setMonth(seasonStart.getMonth() - 2, 1);
  seasonStart.setHours(0, 0, 0, 0);
  const season = {
    id: 2,
    title: 'Сезон 2',
    startsAt: seasonStart.getTime(),
    graduationAt: addMonths(seasonStart.getTime(), 3),
    // Клуб заходит в копилку своей десятиной с продаж сезона
    clubPot: 480000,
  };

  // Города
  const cityNames = [...new Set(PEOPLE.map((p) => p[1]))];
  const cities = cityNames.map((name) => makeCity(name, season.startsAt));

  // Участники
  const users = PEOPLE.map((p, i) => {
    const [name, city, about, lookingFor, skills, pack] = p;
    return {
      id: `u${i + 1}`,
      name,
      cityId: cityId(city),
      about,
      lookingFor,
      skills,
      photo: '',
      tg: '@' + name.split(' ')[0].toLowerCase().replace(/[^a-zа-я]/gi, ''),
      phone: '',
      package: pack,
      joinedAt: season.startsAt + Math.floor(rand() * 26) * DAY,
      referredBy: null,
      bonus: 0,
      coffeeEnabled: rand() > 0.15,
      visible: true,
      notifications: true,
      archive: false,
      admin: false,
      active: true,
      onboarded: true,
      demo: true,
    };
  }).map((u) => ({ ...u, points: 0, facts: factsFor(u, rand, /(а|я)$/i.test(u.name.split(' ')[0])) }));

  // Участников с включённым кофе делаем нечётное число: тогда новый
  // участник сразу получает пару, а не ждёт следующего понедельника
  const coffeeOn = users.filter((u) => u.coffeeEnabled);
  if (coffeeOn.length % 2 === 0) coffeeOn[coffeeOn.length - 1].coffeeEnabled = false;

  // Организаторы: первый по дате регистрации в четырёх городах, остальные пока без
  cities.forEach((city, index) => {
    const members = users.filter((u) => u.cityId === city.id).sort((a, b) => a.joinedAt - b.joinedAt);
    if (members.length < 2) return;
    city.chatUrl = `https://t.me/+iai_${city.id.slice(2)}`;
    if (index < 4) city.organizerId = members[0].id;
    else city.organizerOfferTo = members[0].id;
  });

  // Команды
  const teams = [];
  const members = [];
  const used = new Set();
  TEAM_SEEDS.forEach(([name, idea, cityName], i) => {
    const id = `t${i + 1}`;
    const pool = users.filter((u) => !used.has(u.id) && u.package === 'pro');
    const captain = pool.find((u) => u.cityId === cityId(cityName)) || pool[0];
    if (!captain) return;
    used.add(captain.id);
    teams.push({
      id,
      name,
      idea,
      goal: TEAM_GOALS[i % TEAM_GOALS.length],
      cover: i % 4,
      captainId: captain.id,
      mateId: null,
      seasonId: season.id,
      chatUrl: `https://t.me/+iai_team_${id}`,
      createdAt: season.startsAt + 3 * DAY,
    });
    members.push({ teamId: id, userId: captain.id, role: captain.facts.craft[0], joinedAt: season.startsAt + 3 * DAY });

    const size = 3 + Math.floor(rand() * 3);
    const rest = users.filter((u) => !used.has(u.id));
    for (let k = 0; k < size; k++) {
      const pick = rest[Math.floor(rand() * rest.length)];
      if (!pick || used.has(pick.id)) continue;
      used.add(pick.id);
      members.push({ teamId: id, userId: pick.id, role: pick.facts.craft[0], joinedAt: season.startsAt + (5 + k) * DAY });
    }
    // Второй по дате в команде становится помощником капитана
    const mate = members.filter((m) => m.teamId === id && m.userId !== captain.id)[0];
    if (mate) teams[teams.length - 1].mateId = mate.userId;
  });

  // Часть участников ещё ждёт распределения — иначе куратору в админке нечего делать
  const applications = users
    .filter((u) => !used.has(u.id) && u.paid !== false)
    .slice(0, 5)
    .map((u, i) => ({
      id: `ap_seed_${i + 1}`,
      userId: u.id,
      role: u.facts.craft[0],
      hours: [4, 6, 8, 12][i % 4],
      aim: [AIMS[i % AIMS.length]],
      field: [FIELDS[(i + 1) % FIELDS.length]],
      about: u.about,
      at: now - (i + 1) * 9 * HOUR,
      status: 'pending',
    }));

  // Выручка и копилка
  const revenue = [];
  const contributions = [];
  teams.forEach((team, i) => {
    const teamUsers = members.filter((m) => m.teamId === team.id);
    const count = 3 + Math.floor(rand() * 4);
    let total = 0;
    for (let k = 0; k < count; k++) {
      // Живые суммы с шагом в 500 ₽ — круглые миллионы выглядят выдумкой
      const amount = Math.round(((25 + rand() * 175) * 1000 * (1 - i * 0.13)) / 500) * 500;
      const author = teamUsers[Math.floor(rand() * teamUsers.length)];
      const at = season.startsAt + Math.floor(rand() * ((now - season.startsAt) / DAY)) * DAY;
      total += amount;
      revenue.push({
        id: `r_${team.id}_${k}`,
        teamId: team.id,
        userId: author.userId,
        amount,
        hours: 2 + Math.round(rand() * 12),
        comment: REVENUE_REASONS[Math.floor(rand() * REVENUE_REASONS.length)],
        proof: '',
        at,
        editableUntil: at + 2 * DAY,
      });
    }
    // Первые команды честно перевели взнос, последняя ещё нет
    const share = [1, 1, 0.6, 0.35, 0][i] ?? 1;
    if (share > 0) {
      contributions.push({
        id: `k_${team.id}`,
        teamId: team.id,
        amount: share >= 1 ? Math.round(total * 0.1) : Math.round((total * 0.1 * share) / 100) * 100,
        proof: 'Перевод от ' + team.name,
        confirmed: i < 2,
        at: now - (3 + i) * DAY,
      });
    }
  });

  // Недельные отчёты команд
  const reports = teams.map((team, i) => ({
    id: `rep_${team.id}`,
    teamId: team.id,
    week: weekKey(now - WEEK),
    authorId: team.captainId,
    done: ['Запустили лендинг и собрали 40 заявок', 'Закрыли первого клиента на внедрение', 'Подключили оплату и сделали онбординг'][i % 3],
    stuck: ['Не успели с интеграцией телефонии', 'Долго согласовывали договор', 'Реклама даёт дорогие лиды'][i % 3],
    next: ['Дожать три встречи и выставить счета', 'Собрать вторую версию демо', 'Нанять помощника на поддержку'][i % 3],
    at: now - 3 * DAY,
  }));

  // База знаний
  const materials = MATERIALS.map(([title, type, topic, description, url, weeksAgo], i) => ({
    id: `m${i + 1}`,
    title,
    type,
    topic,
    description,
    videoUrl: url,
    seasonId: season.id,
    publishedAt: now - weeksAgo * WEEK - 2 * HOUR,
  })).concat(
    ARCHIVE.map(([title, type, topic, description, url], i) => ({
      id: `ma${i + 1}`,
      title,
      type,
      topic,
      description,
      videoUrl: url,
      seasonId: season.id - 1,
      publishedAt: season.startsAt - (i + 1) * WEEK,
    }))
  );

  // Дружбы между демо-участниками
  const friends = [];
  for (let i = 0; i < 40; i++) {
    const a = users[Math.floor(rand() * users.length)];
    const b = users[Math.floor(rand() * users.length)];
    if (a.id === b.id) continue;
    const key = [a.id, b.id].sort().join('|');
    if (friends.some((f) => [f.a, f.b].sort().join('|') === key)) continue;
    friends.push({ id: `f${i}`, a: a.id, b: b.id, status: 'accepted', at: now - Math.floor(rand() * 30) * DAY });
  }

  const state = {
    v: 5,
    seededAt: now,
    season,
    cities,
    users,
    teams,
    members,
    applications,
    invites: [],
    circle: [],
    circleOut: [],
    meets: [],
    messages: [],
    posts: [],
    pointsLog: [],
    seen: {},
    sponsors: SPONSORS,
    reports,
    revenue,
    contributions,
    materials,
    // Закреплённые материалы: приветствие, видео недели, дальше — словарь
    pinned: ['m1', 'm2'],
    terms: [],
    events: [],
    rsvp: {},
    views: {},
    friends,
    referrals: [],
    bonusLog: [],
    notes: [],
    proposals: [],
    broadcasts: [],
    session: { userId: null, admin: false },
    seenInstall: false,
  };

  // Места пятничных встреч там, где есть организатор
  state.events = ensureEvents(state, now);
  state.events.forEach((e) => {
    if (e.type !== 'offline') return;
    const city = cities.find((c) => c.id === e.cityId);
    if (city?.organizerId && PLACES[city.name]) {
      e.place = PLACES[city.name];
      e.description = 'Собираемся, показываем, что сделали за неделю, и просто общаемся.';
    }
  });

  // Посещаемость: у каждого свой характер — кто-то ходит почти всегда,
  // кто-то заглядывает раз в месяц. От этого зависит активность команды.
  const habit = {};
  users.forEach((u) => (habit[u.id] = 0.35 + rand() * 0.55));

  state.events.forEach((event) => {
    const pool = users.filter((u) => {
      if (event.type === 'offline') return u.cityId === event.cityId;
      if (event.type === 'team') return members.some((m) => m.teamId === event.teamId && m.userId === u.id);
      if (event.minPackage === 'pro') return u.package === 'pro';
      return true;
    });
    pool.forEach((u) => {
      const r = rand();
      if (r < habit[u.id]) state.rsvp[`${event.id}:${u.id}`] = 'going';
      else if (r < habit[u.id] + 0.15) state.rsvp[`${event.id}:${u.id}`] = 'not_going';
    });
  });

  // Кто-то уже посмотрел материалы
  materials.forEach((m) => {
    users.forEach((u) => {
      if (rand() < 0.25) state.views[`${m.id}:${u.id}`] = now - Math.floor(rand() * 20) * DAY;
    });
  });

  // Живая переписка: в чатах команд и городов уже что-то есть
  const talk = [
    ['Собираемся в четверг в 20:00, всем удобно?', 'Да, буду', 'Плюс'],
    ['Скинул в папку черновик лендинга — посмотрите к созвону', 'Ок, гляну вечером'],
    ['Кто идёт в пятницу? Возьму столик побольше', 'Я иду', 'Буду с партнёром'],
  ];
  state.teams.forEach((team, i) => {
    const roster = state.members.filter((m) => m.teamId === team.id);
    const lines = talk[i % talk.length];
    lines.forEach((text, k) => {
      state.messages.push({
        id: `msg_t${team.id}_${k}`,
        chat: `team:${team.id}`,
        userId: roster[k % roster.length]?.userId,
        text,
        at: now - (lines.length - k) * 5 * HOUR,
      });
    });
  });
  cities.filter((c) => c.chatUrl).slice(0, 4).forEach((city, i) => {
    const members = users.filter((u) => u.cityId === city.id);
    ['Кто в пятницу? Предлагаю кофейню на Ленина', 'Я за', 'Буду в 19:40'].forEach((text, k) => {
      state.messages.push({
        id: `msg_c${city.id}_${k}`,
        chat: `city:${city.id}`,
        userId: members[(k + i) % members.length]?.id,
        text,
        at: now - (3 - k) * 4 * HOUR,
      });
    });
  });

  // Лента: клуб выглядит живым уже на первом открытии
  const feed = [
    ['встреча', 'Собрались вчетвером на Патриках, три часа разбирали воронки. Оказалось, у всех одна и та же дыра на втором шаге.'],
    ['результат', 'Первый клиент на внедрение агента в поддержку. Дошли за две недели с момента знакомства на пятнице.'],
    ['команда', 'Поменяли гипотезу: вместо своего продукта делаем внедрения. Считать стало приятнее.'],
    ['встреча', 'Пятница в Казани удалась: было девять человек, двое из них — новенькие. Разошлись за полночь.'],
    ['вопрос', 'Кто уже поднимал телефонию на ИИ-агенте? Нужен совет по сценариям, готов обменяться опытом.'],
    ['результат', 'Сэкономили 40 часов в месяц на отчётности. Всё, что раньше делали руками, теперь собирается само.'],
  ];
  feed.forEach(([tag, text], i) => {
    const author = users[(i * 5 + 3) % users.length];
    state.posts.push({
      id: `ps_seed_${i}`,
      userId: author.id,
      text,
      photo: '',
      tag,
      at: now - (i + 1) * 9 * HOUR,
      likes: users.slice(i, i + 2 + (i % 4)).map((u) => u.id),
    });
  });

  // Баллы демо-участников: активность за сезон уже накопилась
  state.users = state.users.map((u) => ({
    ...u,
    points: Math.round(40 + rand() * 320),
  }));

  return state;
}
