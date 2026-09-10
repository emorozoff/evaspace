import { DAY, HOUR, MINUTE, startOfWeek, weekKey } from './time.js';
import { hash, uid } from './format.js';
import { cityMembers } from './events.js';

/* Правила клуба: кто что видит, как считается рейтинг,
   как города превращаются в пятничные встречи. */

export const PACKAGES = {
  start: { id: 'start', title: 'START', price: 1900, note: 'Расписание, база знаний, люди' },
  club: { id: 'club', title: 'CLUB', price: 4900, note: 'Всё, кроме команд и рейтинга' },
  pro: { id: 'pro', title: 'PRO', price: 9900, note: 'Команда, рейтинг, мастермайнды' },
};

const RANK = { start: 0, club: 1, pro: 2 };

export function packRank(p) {
  return RANK[p] ?? 0;
}

export function hasPackage(user, min) {
  return packRank(user?.package) >= packRank(min);
}

export const isPro = (user) => hasPackage(user, 'pro');

/* ---------- люди и города ---------- */

export function userById(state, id) {
  return state.users.find((u) => u.id === id) || null;
}

export function cityById(state, id) {
  return state.cities.find((c) => c.id === id) || null;
}

export function cityName(state, id) {
  return cityById(state, id)?.name || '';
}

export function cityStats(state, id) {
  const members = cityMembers(state, id);
  const city = cityById(state, id);
  return {
    city,
    members,
    count: members.length,
    organizer: city?.organizerId ? userById(state, city.organizerId) : null,
    ready: members.length >= 2,
  };
}

/* ---------- события ---------- */

export function canSeeEvent(state, user, event) {
  if (!user) return false;
  if (!hasPackage(user, event.minPackage)) return false;
  if (event.type === 'offline') return event.cityId === user.cityId;
  if (event.type === 'team') return state.members.some((m) => m.teamId === event.teamId && m.userId === user.id);
  return true;
}

export function visibleEvents(state, user, { from = 0, to = Infinity } = {}) {
  return state.events
    .filter((e) => !e.canceled && e.startsAt >= from && e.startsAt <= to && canSeeEvent(state, user, e))
    .sort((a, b) => a.startsAt - b.startsAt);
}

export function nextEvent(state, user, now = Date.now()) {
  return visibleEvents(state, user, { from: now - 2 * HOUR })[0] || null;
}

export function rsvpOf(state, eventId, userId) {
  return state.rsvp[`${eventId}:${userId}`] || null;
}

export function goingIds(state, eventId) {
  const prefix = eventId + ':';
  return Object.keys(state.rsvp)
    .filter((k) => k.startsWith(prefix) && state.rsvp[k] === 'going')
    .map((k) => k.slice(prefix.length));
}

export function goingUsers(state, eventId) {
  return goingIds(state, eventId)
    .map((id) => userById(state, id))
    .filter(Boolean);
}

/** Кнопка «Подключиться» оживает за 15 минут до начала и гаснет после конца. */
export function canJoin(event, now = Date.now()) {
  if (!event.joinUrl) return false;
  return now >= event.startsAt - 15 * MINUTE && now <= event.startsAt + event.duration * MINUTE;
}

export function eventCity(state, event) {
  return event.cityId ? cityById(state, event.cityId) : null;
}

/** Ближайшая пятница в городе участника. */
export function nextFridayEvent(state, cityId, now = Date.now()) {
  return state.events
    .filter((e) => e.cityId === cityId && e.type === 'offline' && !e.canceled && e.startsAt > now - 3 * HOUR)
    .sort((a, b) => a.startsAt - b.startsAt)[0] || null;
}

/* ---------- команды ---------- */

export function teamOf(state, userId) {
  const link = state.members.find((m) => m.userId === userId);
  return link ? state.teams.find((t) => t.id === link.teamId) || null : null;
}

export function teamRoster(state, teamId) {
  return state.members
    .filter((m) => m.teamId === teamId)
    .map((m) => ({ ...m, user: userById(state, m.userId) }))
    .filter((m) => m.user);
}

/** Заявка участника куратору: одна активная на человека. */
export function applicationOf(state, userId) {
  return state.applications.find((a) => a.userId === userId && a.status === 'pending') || null;
}

export const TEAM_ROLES = ['Продукт', 'Продажи', 'Разработка', 'Маркетинг', 'Операционка', 'Финансы'];

export function teamSize(state, teamId) {
  return state.members.filter((m) => m.teamId === teamId).length;
}

export const MIN_TEAM = 3;
export const MAX_TEAM = 10;

/**
 * Копилка: 10% от внесённой выручки. Пока взнос не отмечен,
 * соответствующая часть выручки в рейтинг не идёт.
 */
/**
 * Посещаемость: доля прошедших событий, на которые человек нажал «Пойду».
 * Считаем только то, что он вообще мог видеть — иначе цифра врёт.
 */
export function attendanceOf(state, userId, now = Date.now()) {
  const user = userById(state, userId);
  if (!user) return { went: 0, total: 0, percent: 0 };
  const past = state.events.filter(
    (e) => !e.canceled && e.startsAt < now && e.startsAt > state.season.startsAt && canSeeEvent(state, user, e)
  );
  const went = past.filter((e) => rsvpOf(state, e.id, userId) === 'going').length;
  return { went, total: past.length, percent: past.length ? Math.round((went / past.length) * 100) : 0 };
}

/** Активность команды — средняя посещаемость её участников. */
export function teamAttendance(state, teamId, now = Date.now()) {
  const members = state.members.filter((m) => m.teamId === teamId);
  if (!members.length) return 0;
  const sum = members.reduce((acc, m) => acc + attendanceOf(state, m.userId, now).percent, 0);
  return Math.round(sum / members.length);
}

export function teamStats(state, teamId, now = Date.now()) {
  const entries = state.revenue.filter((r) => r.teamId === teamId);
  const total = entries.reduce((s, r) => s + r.amount, 0);
  const hours = entries.reduce((s, r) => s + (r.hours || 0), 0);
  const required = Math.round(total * 0.1);
  const paid = state.contributions.filter((c) => c.teamId === teamId).reduce((s, c) => s + c.amount, 0);
  const counted = Math.min(total, paid * 10);
  return {
    total,
    hours,
    required,
    paid,
    counted,
    debt: Math.max(0, required - paid),
    full: paid >= required && total > 0,
    size: teamSize(state, teamId),
    activity: teamAttendance(state, teamId, now),
    entries: entries.sort((a, b) => b.at - a.at),
  };
}

/** Награда за место: три кубка, дальше медали. */
export function awardOf(place) {
  if (place === 1) return { icon: 'cup', tone: '#e9b872', label: 'Золото' };
  if (place === 2) return { icon: 'cup', tone: '#c9d2dd', label: 'Серебро' };
  if (place === 3) return { icon: 'cup', tone: '#cd8f5e', label: 'Бронза' };
  return { icon: 'medal', tone: '#6e7486', label: `${place} место` };
}

export function leaderboard(state, now = Date.now()) {
  return state.teams
    .map((team) => ({ team, ...teamStats(state, team.id, now) }))
    .filter((row) => row.size >= MIN_TEAM)
    .sort((a, b) => b.counted - a.counted || b.total - a.total)
    .map((row, i) => ({ ...row, place: i + 1, award: awardOf(i + 1) }));
}

export function teamPlace(state, teamId) {
  const row = leaderboard(state).find((r) => r.team.id === teamId);
  return row ? row.place : null;
}

/** Клуб заходит в копилку своей десятиной — сезон стартует не с нуля. */
export function seasonPot(state) {
  return (state.season.clubPot || 0) + state.contributions.reduce((s, c) => s + c.amount, 0);
}

export function lastReport(state, teamId) {
  return state.reports.filter((r) => r.teamId === teamId).sort((a, b) => b.at - a.at)[0] || null;
}

/** Роли внутри команды: капитан, помощник и рядовые. */
export const TEAM_TITLES = { captain: 'Капитан', mate: 'Помощник', member: 'Участник' };

export function titleOf(team, userId) {
  if (team?.captainId === userId) return 'captain';
  if (team?.mateId === userId) return 'mate';
  return 'member';
}

/**
 * Баланс команды — то, на что смотрит куратор: какие роли уже заняты,
 * каких не хватает и насколько похож опыт участников.
 */
export function teamBalance(state, teamId) {
  const roster = teamRoster(state, teamId);
  const roles = {};
  roster.forEach((m) => {
    const role = m.user.facts?.role?.[0] || m.role;
    roles[role] = (roles[role] || 0) + 1;
  });
  const missing = TEAM_ROLES.filter((r) => !roles[r]);
  const levels = roster.map((m) => EXP_LEVELS.indexOf(m.user.facts?.exp?.[0])).filter((i) => i >= 0);
  const incomes = roster.map((m) => INCOME_LEVELS.indexOf(m.user.facts?.income?.[0])).filter((i) => i >= 0);
  const avg = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0);
  return {
    roster,
    roles,
    missing,
    doubled: Object.entries(roles).filter(([, n]) => n > 1).map(([r]) => r),
    exp: avg(levels),
    income: avg(incomes),
  };
}

export const EXP_LEVELS = ['Первый год', '1–3 года', '3–7 лет', 'Больше 7'];
export const INCOME_LEVELS = ['до 300 тыс', '300 тыс — 1 млн', '1–3 млн', '3–10 млн', 'больше 10 млн'];

/** Значение из анкеты одной строкой. */
export function factOf(user, key) {
  return (user?.facts?.[key] || []).join(', ');
}

/** Приглашение в команду: активное — то, на которое ещё не ответили. */
export function inviteFor(state, userId) {
  return state.invites.find((i) => i.userId === userId && i.status === 'pending') || null;
}

export function invitesFrom(state, teamId) {
  return state.invites.filter((i) => i.teamId === teamId && i.status === 'pending');
}

/** Кого вообще можно позвать: активный участник PRO без команды и без заявки. */
export function invitableUsers(state, teamId) {
  return state.users.filter(
    (u) =>
      u.active !== false &&
      isPro(u) &&
      !state.members.some((m) => m.userId === u.id) &&
      !state.invites.some((i) => i.userId === u.id && i.status === 'pending' && i.teamId === teamId)
  );
}

/**
 * Ближний круг: команда попадает туда сама, остальных участник добавляет сам.
 * Убранных вручную (`circleOut`) раскладка обратно не возвращает.
 */
export function innerCircle(state, userId) {
  const me = userById(state, userId);
  const team = teamOf(state, userId);
  const out = new Set(state.circleOut || []);
  const auto = team ? state.members.filter((m) => m.teamId === team.id && m.userId !== userId).map((m) => m.userId) : [];
  const met = matchedWith(state, userId).map((u) => u.id);
  let ids = [...new Set([...auto, ...met, ...(state.circle || [])])];

  // Круг не должен пустовать: добираем недавно пришедших с близкими интересами
  if (ids.length < 5) {
    const suggested = state.users
      .filter((u) => u.id !== userId && u.active !== false && !ids.includes(u.id) && !out.has(u.id))
      .map((u) => ({ u, score: matchPercent(me, u) }))
      .sort((x, y) => y.score - x.score || y.u.joinedAt - x.u.joinedAt)
      .slice(0, 5 - ids.length)
      .map((x) => x.u.id);
    ids = [...ids, ...suggested];
  }

  return ids.filter((id) => id !== userId && !out.has(id)).map((id) => userById(state, id)).filter(Boolean);
}

/** Статус в клубе — то, что напечатано на карточке резидента. */
export function residentTitle(user) {
  if (!user) return 'Гость';
  if (user.admin) return 'Куратор';
  return isPro(user) ? 'Резидент PRO' : 'Резидент';
}

/** Номер карточки: постоянный и опознаваемый. */
export function residentNumber(user) {
  return String(hash(user?.id || 'x') % 9000 + 1000);
}

/* ---------- база знаний ---------- */

export function materialsFor(state, user) {
  return state.materials
    .filter((m) => m.seasonId === state.season.id || user?.archive)
    .sort((a, b) => b.publishedAt - a.publishedAt);
}

export function isViewed(state, materialId, userId) {
  return Boolean(state.views[`${materialId}:${userId}`]);
}

export function archiveCount(state) {
  return state.materials.filter((m) => m.seasonId < state.season.id).length;
}

/* ---------- друзья ---------- */

export function friendStatus(state, a, b) {
  const link = state.friends.find((f) => (f.a === a && f.b === b) || (f.a === b && f.b === a));
  if (!link) return { status: 'none', link: null, incoming: false };
  return { status: link.status, link, incoming: link.status === 'pending' && link.b === a };
}

export function friendIds(state, userId) {
  return state.friends
    .filter((f) => f.status === 'accepted' && (f.a === userId || f.b === userId))
    .map((f) => (f.a === userId ? f.b : f.a));
}

export function friendsGoing(state, eventId, userId) {
  const ids = new Set(friendIds(state, userId));
  return goingUsers(state, eventId).filter((u) => ids.has(u.id));
}

/* ---------- знакомства ---------- */

/** Сколько предложений программа выдаёт в неделю: хватает, чтобы за сезон
    познакомиться со всеми, но не превращается в ленту. */
export const WEEKLY_MEETS = 3;

export const MEET_GOALS = [
  { id: 'Новые знакомства', label: 'Просто пообщаться', icon: 'people' },
  { id: 'Найти партнёров', label: 'Найти партнёра в дело', icon: 'handshake' },
  { id: 'Запустить проект', label: 'Собрать проект', icon: 'rocket' },
  { id: 'Научиться ИИ', label: 'Обменяться опытом в ИИ', icon: 'spark' },
  { id: 'Встретить любовь', label: 'Встретить любовь', icon: 'heart' },
];

/** Насколько совпадают интересы: увлечения весомее целей и сильных сторон. */
export function matchPercent(a, b) {
  if (!a || !b) return 0;
  const cross = (key) => {
    const one = new Set(a.facts?.[key] || []);
    const two = b.facts?.[key] || [];
    return two.filter((x) => one.has(x)).length;
  };
  const hobby = cross('hobby');
  const goal = cross('goal');
  const powers = cross('powers');
  const sameCity = a.cityId === b.cityId ? 1 : 0;
  const sameAi = (a.facts?.ai?.[0] && a.facts.ai[0] === b.facts?.ai?.[0]) ? 1 : 0;
  const score = hobby * 22 + goal * 16 + powers * 8 + sameCity * 12 + sameAi * 6;
  // Небольшая база, чтобы даже непохожие люди не выглядели «0%»
  return Math.max(12, Math.min(98, Math.round(18 + score)));
}

export function meetsFor(state, userId, week) {
  return state.meets.filter((m) => m.week === week && (m.a === userId || m.b === userId));
}

export function matchedWith(state, userId) {
  return state.meets
    .filter((m) => m.status === 'matched' && (m.a === userId || m.b === userId))
    .map((m) => userById(state, m.a === userId ? m.b : m.a))
    .filter(Boolean);
}

/**
 * Предложения на неделю. Приоритет — совпадение интересов и «ещё не виделись»;
 * город решает только формат встречи: офлайн или онлайн.
 */
export function ensureMeets(state, now = Date.now()) {
  const week = weekKey(now);
  const made = [];

  // Квота считается с обеих сторон: попасть в чужие предложения — тоже расход недели
  const quota = {};
  state.meets.filter((m) => m.week === week).forEach((m) => {
    quota[m.a] = (quota[m.a] || 0) + 1;
    quota[m.b] = (quota[m.b] || 0) + 1;
  });

  state.users.forEach((user) => {
    if (user.active === false || !user.coffeeEnabled) return;
    if ((quota[user.id] || 0) >= WEEKLY_MEETS) return;

    const met = new Set(
      state.meets.concat(made).filter((m) => m.a === user.id || m.b === user.id).map((m) => (m.a === user.id ? m.b : m.a))
    );

    const pool = state.users
      .filter((u) => u.id !== user.id && u.active !== false && u.coffeeEnabled && !met.has(u.id) && (quota[u.id] || 0) < WEEKLY_MEETS)
      .map((u) => ({ u, percent: matchPercent(user, u), luck: hash(week + user.id + u.id) % 20 }))
      .sort((x, y) => y.percent + y.luck - (x.percent + x.luck));

    for (const { u, percent } of pool) {
      if ((quota[user.id] || 0) >= WEEKLY_MEETS) break;
      made.push({
        id: uid('mt'),
        week,
        a: user.id,
        b: u.id,
        percent,
        online: user.cityId !== u.cityId,
        status: 'new',
        likedBy: [],
        at: startOfWeek(now),
      });
      quota[user.id] = (quota[user.id] || 0) + 1;
      quota[u.id] = (quota[u.id] || 0) + 1;
      met.add(u.id);
    }
  });

  if (!made.length) return state;
  return { ...state, meets: [...state.meets, ...made] };
}

/* ---------- разговоры ---------- */

/** Ключ разговора: у команды и города он один на всех, у людей — общий на двоих. */
export function chatKey(kind, ids) {
  return kind === 'dm' ? `dm:${[...ids].sort().join('|')}` : `${kind}:${ids[0]}`;
}

export function chatMessages(state, key) {
  return state.messages.filter((m) => m.chat === key).sort((a, b) => a.at - b.at);
}

export function lastMessage(state, key) {
  const list = chatMessages(state, key);
  return list[list.length - 1] || null;
}

export function unreadIn(state, key, userId) {
  const seen = state.seen?.[key] || 0;
  return chatMessages(state, key).filter((m) => m.at > seen && m.userId !== userId).length;
}

/** Все разговоры участника: команда, город и личные — в одном списке. */
export function chatsOf(state, userId) {
  const list = [];
  const team = teamOf(state, userId);
  if (team) list.push({ key: chatKey('team', [team.id]), kind: 'team', title: `Команда «${team.name}»`, team });
  const city = cityById(state, userById(state, userId)?.cityId);
  if (city && cityMembers(state, city.id).length >= 2) list.push({ key: chatKey('city', [city.id]), kind: 'city', title: `${city.name} · город`, city });
  matchedWith(state, userId).forEach((u) => list.push({ key: chatKey('dm', [userId, u.id]), kind: 'dm', title: u.name, user: u }));
  return list
    .map((c) => ({ ...c, last: lastMessage(state, c.key), unread: unreadIn(state, c.key, userId) }))
    .sort((a, b) => (b.last?.at || 0) - (a.last?.at || 0));
}

/* ---------- города: главное правило ---------- */

/**
 * После каждой регистрации проверяем город. Стало ровно двое —
 * заводим чат, пятничную встречу и зовём организатора.
 */
export function ensureCityRules(state, now = Date.now()) {
  const notes = [];
  let changed = false;

  const cities = state.cities.map((city) => {
    const members = cityMembers(state, city.id).sort((a, b) => a.joinedAt - b.joinedAt);
    if (members.length < 2) return city;
    let next = city;

    if (!next.chatUrl) {
      next = { ...next, chatUrl: `https://t.me/+iai_${city.id.slice(2)}` };
      changed = true;
      members.forEach((m) =>
        notes.push(
          note(
            `city-second-${city.id}-${m.id}`,
            m.id,
            'В вашем городе теперь двое',
            'Договоритесь, где встречаетесь в пятницу. Чат города уже создан.',
            `/city/${city.id}`,
            now
          )
        )
      );
    }

    if (!next.organizerId) {
      const candidate = members.find((m) => !(next.organizerDeclined || []).includes(m.id));
      if (candidate && next.organizerOfferTo !== candidate.id) {
        next = { ...next, organizerOfferTo: candidate.id };
        changed = true;
        notes.push(
          note(
            `organizer-${city.id}-${candidate.id}`,
            candidate.id,
            'Возьмёте пятницу на себя?',
            `Вы первый в городе ${city.nameIn}. Организатор выбирает место и время встречи.`,
            `/city/${city.id}`,
            now
          )
        );
      }
    }

    return next;
  });

  return { cities, notes, changed };
}

/* ---------- уведомления ---------- */

export function note(key, userId, title, text, link, at = Date.now()) {
  return { id: uid('n'), key, userId, title, text, link, at, read: false };
}

export function unreadCount(state, userId) {
  return state.notes.filter((n) => n.userId === userId && !n.read).length;
}

/**
 * Не больше пяти уведомлений в неделю: напоминание про пятницу,
 * ссылка на онлайн, пара по кофе, новое видео и «покажи, что сделал».
 */
export function buildNotifications(state, user, now = Date.now()) {
  if (!user || user.notifications === false) return [];
  const have = new Set(state.notes.map((n) => n.key));
  const out = [];
  const add = (key, title, text, link, at = now) => {
    if (have.has(key)) return;
    have.add(key);
    out.push(note(key, user.id, title, text, link, at));
  };

  const events = visibleEvents(state, user, { from: now - HOUR, to: now + 3 * DAY });

  for (const event of events) {
    const left = event.startsAt - now;
    if (event.type === 'offline' && left < 30 * HOUR && !rsvpOf(state, event.id, user.id)) {
      add(`friday-${event.id}`, 'Завтра пятница', `${event.title}. Идёте?`, `/event/${event.id}`);
    }
    if ((event.type === 'online' || event.type === 'team') && left < HOUR && left > -HOUR) {
      add(`online-${event.id}`, 'Через час начинаем', `${event.title}. Ссылка на подключение внутри.`, `/event/${event.id}`);
    }
  }

  const week = weekKey(now);
  const waiting = meetsFor(state, user.id, week).filter((m) => m.status === 'new').length;
  if (waiting) {
    add(`meets-${week}-${user.id}`, 'Новые знакомства', `На этой неделе ${waiting} предложения. Загляните, пока не разобрали.`, '/meet', startOfWeek(now) + 9 * HOUR);
  }

  const fresh = state.materials
    .filter((m) => m.seasonId === state.season.id && now - m.publishedAt < 3 * DAY)
    .sort((a, b) => b.publishedAt - a.publishedAt)[0];
  if (fresh) add(`material-${fresh.id}`, 'В базе новый материал', fresh.title, `/base/${fresh.id}`, fresh.publishedAt);

  const team = teamOf(state, user.id);
  if (team && isPro(user)) {
    const board = leaderboard(state);
    const mine = board.find((r) => r.team.id === team.id);
    const above = mine && board[mine.place - 2];
    if (mine && above) {
      add(`rank-${team.id}-${week}`, 'Вас обошли', `${above.team.name} впереди на ${(above.counted - mine.counted).toLocaleString('ru-RU')} ₽`, '/rating');
    }
    const lastEntry = state.revenue.filter((r) => r.teamId === team.id).sort((a, b) => b.at - a.at)[0];
    if (!lastEntry || now - lastEntry.at > 7 * DAY) {
      add(`silence-${team.id}-${week}`, 'Покажи, что сделал на этой неделе', 'Команда не вносила выручку больше недели.', `/team/${team.id}`);
    }
  }

  return out;
}

/* ---------- слёт ---------- */

export function summitEvent(state) {
  return state.events.find((e) => e.type === 'summit') || null;
}

export function summitVisible(state, now = Date.now()) {
  const summit = summitEvent(state);
  return Boolean(summit) && summit.startsAt - now < 45 * DAY;
}

/* ---------- спонсоры ---------- */

export function sponsorById(state, id) {
  return state.sponsors.find((s) => s.id === id) || null;
}

/* ---------- сезон ---------- */

export function seasonProgress(state, now = Date.now()) {
  const { startsAt, graduationAt } = state.season;
  const total = graduationAt - startsAt;
  const passed = Math.min(Math.max(now - startsAt, 0), total);
  const monthIndex = Math.min(3, Math.floor((now - startsAt) / (total / 3)) + 1);
  return {
    percent: Math.round((passed / total) * 100),
    monthIndex,
    daysLeft: Math.max(0, Math.ceil((graduationAt - now) / DAY)),
    startsAt,
    graduationAt,
  };
}

/* ---------- рефералка ---------- */

export const REFERRAL_BONUS = 1500;

export function referralStats(state, userId) {
  const list = state.referrals.filter((r) => r.inviterId === userId);
  return {
    list,
    visited: list.length,
    paid: list.filter((r) => r.status === 'paid').length,
    earned: list.filter((r) => r.status === 'paid').reduce((s, r) => s + r.bonus, 0),
  };
}

export function referralLink(user) {
  const base = typeof window === 'undefined' ? '' : window.location.origin + window.location.pathname;
  return `${base}#/join/${user?.ref || 'club'}`;
}
