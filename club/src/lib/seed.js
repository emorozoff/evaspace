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

/* Простой генератор псевдослучайных чисел: одинаковые данные при каждой сборке */
function rng(seed) {
  let s = hash(String(seed)) % 2147483647;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

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
      demo: true,
    };
  });

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
      captainId: captain.id,
      seasonId: season.id,
      isOpen: i > 1,
      wanted: 5,
      chatUrl: `https://t.me/+iai_team_${id}`,
      createdAt: season.startsAt + 3 * DAY,
    });
    members.push({ teamId: id, userId: captain.id, role: 'капитан', joinedAt: season.startsAt + 3 * DAY });

    const size = 3 + Math.floor(rand() * 3);
    const rest = users.filter((u) => !used.has(u.id));
    for (let k = 0; k < size; k++) {
      const pick = rest[Math.floor(rand() * rest.length)];
      if (!pick || used.has(pick.id)) continue;
      used.add(pick.id);
      members.push({
        teamId: id,
        userId: pick.id,
        role: ['продукт', 'продажи', 'разработка', 'маркетинг', 'операционка'][k % 5],
        joinedAt: season.startsAt + (5 + k) * DAY,
      });
    }
  });

  // Выручка и копилка
  const revenue = [];
  const contributions = [];
  teams.forEach((team, i) => {
    const teamUsers = members.filter((m) => m.teamId === team.id);
    const count = 4 + Math.floor(rand() * 5);
    let total = 0;
    for (let k = 0; k < count; k++) {
      const amount = Math.round((40 + rand() * 260) * 1000 * (1 - i * 0.12));
      const author = teamUsers[Math.floor(rand() * teamUsers.length)];
      const at = season.startsAt + Math.floor(rand() * ((now - season.startsAt) / DAY)) * DAY;
      total += amount;
      revenue.push({
        id: `r_${team.id}_${k}`,
        teamId: team.id,
        userId: author.userId,
        amount,
        hours: Math.round(rand() * 20),
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
        amount: Math.ceil((total * 0.1 * share) / 100) * 100,
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
    v: 1,
    seededAt: now,
    season,
    cities,
    users,
    teams,
    members,
    applications: [],
    reports,
    revenue,
    contributions,
    materials,
    events: [],
    rsvp: {},
    views: {},
    friends,
    coffee: [],
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

  // Кто-то уже отметился на ближайших событиях
  state.events.forEach((event) => {
    if (event.startsAt < now - WEEK) return;
    const pool = users.filter((u) => {
      if (event.type === 'offline') return u.cityId === event.cityId;
      if (event.type === 'team') return members.some((m) => m.teamId === event.teamId && m.userId === u.id);
      if (event.minPackage === 'pro') return u.package === 'pro';
      return true;
    });
    pool.forEach((u) => {
      const r = rand();
      if (r < 0.55) state.rsvp[`${event.id}:${u.id}`] = 'going';
      else if (r < 0.68) state.rsvp[`${event.id}:${u.id}`] = 'not_going';
    });
  });

  // Кто-то уже посмотрел материалы
  materials.forEach((m) => {
    users.forEach((u) => {
      if (rand() < 0.25) state.views[`${m.id}:${u.id}`] = now - Math.floor(rand() * 20) * DAY;
    });
  });

  return state;
}
