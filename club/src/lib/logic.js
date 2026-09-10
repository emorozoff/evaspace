import { DAY, HOUR, MINUTE, plural, startOfWeek, weekKey } from './time.js';
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

/**
 * Формат и аудитория события — короткими словами, одинаково на всех экранах.
 * Раньше это приходилось выводить в каждом компоненте заново.
 */
export function eventMeta(event) {
  const offline = event.type === 'offline' || event.type === 'summit';
  const audience =
    event.type === 'team' ? 'для команды' : event.minPackage === 'pro' ? 'для PRO' : event.minPackage === 'club' ? 'для клуба' : 'для всех';
  return {
    offline,
    format: offline ? 'офлайн' : 'онлайн',
    audience,
    paid: (event.price || 0) > 0,
  };
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

/* Цель и направление из заявки: по ним ИИ-куратор собирает людей,
   которые тянут проект в одну сторону, а не спорят о смысле сезона. */
export const TEAM_AIMS = [
  { id: 'Заработать', label: 'Заработать', icon: 'money' },
  { id: 'Научиться', label: 'Научиться', icon: 'bulb' },
  { id: 'Общение', label: 'Общение', icon: 'people' },
];

export const TEAM_FIELDS = [
  { id: 'Услуги', label: 'Услуги', icon: 'handshake' },
  { id: 'Приложение', label: 'Приложение', icon: 'code' },
  { id: 'Креатив', label: 'Креатив', icon: 'palette' },
  { id: 'Торговля', label: 'Торговля', icon: 'cart' },
  { id: 'Обучение', label: 'Обучение', icon: 'book' },
  { id: 'other', label: 'Своё', icon: 'pen', other: true, placeholder: 'Что хотите делать' },
];

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
    const role = m.user.facts?.craft?.[0] || m.role;
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
export const INCOME_LEVELS = ['до 100 тыс', '100–300 тыс', '300–500 тыс', 'больше 500 тыс'];

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

/* ---------- ИИ-куратор: сборка команд ---------- */

const strengthOf = (user) => {
  const exp = Math.max(0, EXP_LEVELS.indexOf(user?.facts?.exp?.[0]));
  const income = Math.max(0, INCOME_LEVELS.indexOf(user?.facts?.income?.[0]));
  const ai = Math.max(0, ['Новичок', 'Средний уровень', 'Про'].indexOf(user?.facts?.ai?.[0]));
  return exp * 3 + income * 3 + ai * 2;
};

const expLevel = (user) => Math.max(0, EXP_LEVELS.indexOf(user?.facts?.exp?.[0]));
const incomeLevel = (user) => Math.max(0, INCOME_LEVELS.indexOf(user?.facts?.income?.[0]));

/** Заявка человека: цель, направление и часы — то, чего нет в анкете. */
const applicationOfUser = (state, userId) =>
  state.applications.find((a) => a.userId === userId && (a.status === 'pending' || a.status === 'assigned')) || null;

/**
 * Раскладка заявок по командам. Команда работоспособна, когда в ней
 * разные роли, разный опыт и разный доход (иначе одна команда собирает
 * всех сильных, а вторая — всех новичков), но одна цель и близкое
 * направление — иначе люди спорят не о работе, а о смысле сезона.
 * Возвращает план: куратор смотрит его и применяет одним нажатием.
 */
export function suggestTeamPlan(state) {
  const waiting = state.applications
    .filter((a) => a.status === 'pending')
    .map((a) => ({ application: a, user: userById(state, a.userId) }))
    .filter((x) => x.user);
  if (!waiting.length || !state.teams.length) return [];

  // Команды, где меньше народу и слабее состав, набирают первыми
  const teams = state.teams.map((team) => {
    const roster = teamRoster(state, team.id);
    const apps = roster.map((m) => applicationOfUser(state, m.userId));
    return {
      team,
      size: roster.length,
      power: roster.reduce((sum, m) => sum + strengthOf(m.user), 0),
      crafts: new Set(roster.map((m) => m.user.facts?.craft?.[0] || m.role)),
      spheres: new Set(roster.map((m) => m.user.facts?.sphere?.[0]).filter(Boolean)),
      exps: new Set(roster.map((m) => expLevel(m.user))),
      incomes: new Set(roster.map((m) => incomeLevel(m.user))),
      aims: apps.map((a) => a?.aim?.[0]).filter(Boolean),
      fields: apps.map((a) => a?.field?.[0]).filter(Boolean),
      goals: roster.flatMap((m) => m.user.facts?.goal || []),
      hobby: roster.flatMap((m) => m.user.facts?.hobby || []),
      hours: apps.map((a) => a?.hours || 0).filter(Boolean),
    };
  });

  // Сильных распределяем первыми — иначе последняя команда соберёт одних новичков
  const queue = [...waiting].sort((a, b) => strengthOf(b.user) - strengthOf(a.user));
  const plan = [];

  for (const { application, user } of queue) {
    const craft = user.facts?.craft?.[0] || application.role;
    const sphere = user.facts?.sphere?.[0];
    const exp = expLevel(user);
    const income = incomeLevel(user);
    const aim = application.aim?.[0];
    const field = application.field?.[0];
    const goals = user.facts?.goal || [];
    const hobby = user.facts?.hobby || [];
    const open = teams.filter((t) => t.size < MAX_TEAM);
    if (!open.length) break;

    const best = open
      .map((t) => {
        const sameAim = aim ? t.aims.filter((x) => x === aim).length : 0;
        const sameField = field ? t.fields.filter((x) => x === field).length : 0;
        const sharedGoals = goals.filter((g) => t.goals.includes(g)).length;
        const sharedHobby = hobby.filter((h) => t.hobby.includes(h)).length;

        let score = 0;
        if (!t.crafts.has(craft)) score += 40;                       // роли не должны повторяться
        if (sphere && !t.spheres.has(sphere)) score += 12;           // разные сферы — шире взгляд
        if (!t.exps.has(exp)) score += 18;                           // рядом с новичком нужен опытный
        if (!t.incomes.has(income)) score += 16;                     // и разный уровень дохода
        score += Math.min(sameAim, 2) * 20;                          // общая цель — важнее всего
        score += Math.min(sameField, 2) * 10;                        // и близкое направление
        score += Math.min(sharedGoals, 2) * 6;                       // общее «зачем в клубе»
        score += Math.min(sharedHobby, 2) * 3;                       // и просто общий язык
        score += (MAX_TEAM - t.size) * 6;                            // маленькие команды важнее
        score -= t.power * 0.6;                                      // выравниваем суммарную силу
        if (t.size < MIN_TEAM) score += 25;                          // сначала доводим до трёх
        // Похожие ожидания по времени: 3 часа рядом с 20 — будущий конфликт
        if (t.hours.length && application.hours) {
          const avg = t.hours.reduce((a, b) => a + b, 0) / t.hours.length;
          score -= Math.min(14, Math.abs(avg - application.hours));
        }
        return { t, score };
      })
      .sort((x, y) => y.score - x.score)[0].t;

    // Причина понадобится куратору: он должен понимать, почему ИИ так решил
    const why = [best.crafts.has(craft) ? `усилит ${craft.toLowerCase()}` : `закроет роль «${craft.toLowerCase()}»`];
    if (aim && best.aims.includes(aim)) why.push(`общая цель — ${aim.toLowerCase()}`);
    if (!best.exps.has(exp)) why.push('добавит другой уровень опыта');
    else if (!best.incomes.has(income)) why.push('выровняет команду по доходу');
    if (sphere && !best.spheres.has(sphere)) why.push(`сфера «${sphere.toLowerCase()}» новая для команды`);
    if (best.size < MIN_TEAM) why.push('команда ещё не набрана');
    else why.push(`станет ${best.size + 1} из ${MAX_TEAM}`);

    plan.push({ userId: user.id, teamId: best.team.id, role: craft, why: why.slice(0, 4).join(' · ') });
    best.size += 1;
    best.power += strengthOf(user);
    best.crafts.add(craft);
    best.exps.add(exp);
    best.incomes.add(income);
    if (sphere) best.spheres.add(sphere);
    if (aim) best.aims.push(aim);
    if (field) best.fields.push(field);
    best.goals.push(...goals);
    best.hobby.push(...hobby);
    if (application.hours) best.hours.push(application.hours);
  }

  return plan;
}

/* ---------- баллы за активность ---------- */

export const POINTS = {
  message: 2,
  rsvp: 3,
  attend: 10,
  match: 15,
  post: 20,
  meetPhoto: 25,
  revenue: 10,
};

export const POINT_LABELS = {
  message: 'Сообщение в чате',
  rsvp: 'Записался на встречу',
  attend: 'Пришёл на встречу',
  match: 'Метч на знакомстве',
  post: 'Пост в ленте',
  meetPhoto: 'Фото со встречи',
  revenue: 'Запись о выручке',
};

export function pointsOf(state, userId) {
  return userById(state, userId)?.points || 0;
}

/** Место в клубе по баллам — простая мерка активности. */
export function pointsRank(state, userId) {
  const sorted = [...state.users].filter((u) => u.active !== false).sort((a, b) => (b.points || 0) - (a.points || 0));
  return sorted.findIndex((u) => u.id === userId) + 1;
}

/* ---------- лента ---------- */

export const POST_TAGS = [
  { id: 'встреча', label: 'Встреча', icon: 'people', tone: 'accent' },
  { id: 'результат', label: 'Результат', icon: 'chart', tone: 'warm' },
  { id: 'команда', label: 'Команда', icon: 'team', tone: 'violet' },
  { id: 'вопрос', label: 'Вопрос', icon: 'bulb', tone: 'blue' },
];

/** Ответы под постом — тред, как в тредсах: первым сам пост, дальше разговор. */
export function repliesOf(state, postId) {
  return (state.postReplies || []).filter((r) => r.postId === postId).sort((a, b) => a.at - b.at);
}

export function feedPosts(state) {
  return [...state.posts].sort((a, b) => b.at - a.at);
}

export function tagOf(id) {
  return POST_TAGS.find((t) => t.id === id) || POST_TAGS[0];
}

/* ---------- база знаний ---------- */

export function materialsFor(state, user) {
  return state.materials
    .filter((m) => m.seasonId === state.season.id || user?.archive)
    .sort((a, b) => b.publishedAt - a.publishedAt);
}

/** Сколько материалов можно держать в закрепе. */
export const MAX_PINNED = 5;

/** Материал считается новинкой первую неделю — так его видно без объяснений. */
export const isNew = (material, now = Date.now()) => now - material.publishedAt < 7 * DAY;

export const isPinned = (state, id) => (state.pinned || []).includes(id);

/**
 * Порядок в базе: сначала закреплённое в заданном порядке, потом новинки,
 * потом всё остальное по дате. Словарь клуба живёт третьим закрепом и
 * приходит сюда отдельной строкой, потому что это не видео.
 */
export function baseOrder(list, state, now = Date.now()) {
  const pinned = (state.pinned || []).slice(0, MAX_PINNED);
  const inPin = list.filter((m) => pinned.includes(m.id)).sort((a, b) => pinned.indexOf(a.id) - pinned.indexOf(b.id));
  const rest = list.filter((m) => !pinned.includes(m.id));
  const fresh = rest.filter((m) => isNew(m, now));
  const old = rest.filter((m) => !isNew(m, now));
  return { pinned: inPin, fresh, rest: old };
}

/* ---------- словарь клуба ---------- */

/** Свои слова участников идут вместе с базовыми — источник виден по флагу. */
export function termsOf(state) {
  return [...(state.terms || [])];
}

/* ---------- новости ---------- */

/**
 * Три главные новости на сегодня. Собираются из того, что уже есть
 * в клубе: свежая запись, ближайшее событие, знакомства, лента.
 * Порядок — по важности, а не по времени: сверху то, из-за чего
 * стоит открыть приложение прямо сейчас.
 */
export function newsFor(state, user, now = Date.now()) {
  const out = [];
  const fresh = materialsFor(state, user).filter((m) => now - m.publishedAt < 12 * DAY);
  const material = fresh.find((m) => !isViewed(state, m.id, user.id)) || fresh[0];
  if (material) {
    out.push({
      id: `mat-${material.id}`,
      tag: material.type === 'гайд' ? 'новый гайд' : 'новое видео',
      tone: 'accent',
      icon: material.type === 'гайд' ? 'book' : 'play',
      title: material.title,
      sub: `${material.topic} · ${dayLabel(material.publishedAt, now)}`,
      to: `/material/${material.id}`,
    });
  }

  const soon = visibleEvents(state, user, { from: now, to: now + 8 * DAY })[0];
  if (soon && !rsvpOf(state, soon.id, user.id)) {
    out.push({
      id: `ev-${soon.id}`,
      tag: 'событие',
      tone: 'violet',
      icon: 'calendar',
      title: soon.title,
      sub: `${eventMeta(soon).offline ? soon.place || 'офлайн' : 'онлайн'} · ещё не отметились`,
      to: `/event/${soon.id}`,
    });
  }

  const week = weekKey(now);
  const meets = meetsFor(state, user.id, week);
  const match = meets.filter((m) => m.status === 'matched');
  const waiting = meets.filter((m) => m.status === 'new').length;
  if (match.length) {
    const other = userById(state, match[0].a === user.id ? match[0].b : match[0].a);
    out.push({
      id: `match-${match[0].id}`,
      tag: 'метч недели',
      tone: 'warm',
      icon: 'handshake',
      title: `${other?.name} тоже за знакомство`,
      sub: `Совпадение ${match[0].percent}% · чат уже открыт`,
      to: `/chat/${encodeURIComponent(chatKey('dm', [match[0].a, match[0].b]))}`,
    });
  } else if (waiting) {
    out.push({
      id: 'meets',
      tag: 'знакомства',
      tone: 'warm',
      icon: 'spark',
      title: `${waiting} ${plural(waiting, 'человек ждёт', 'человека ждут', 'человек ждут')} ответа`,
      sub: 'Предложения этой недели',
      to: '/meet',
    });
  }

  const post = feedPosts(state).find((p) => p.userId !== user.id);
  if (post) {
    const author = userById(state, post.userId);
    out.push({
      id: `post-${post.id}`,
      tag: 'в ленте',
      tone: undefined,
      icon: post.photo ? 'camera' : 'message',
      title: post.text,
      sub: `${author?.name} · ${dayLabel(post.at, now)}`,
      to: '/feed',
    });
  }

  const summit = summitVisible(state, now) ? summitEvent(state) : null;
  if (summit) {
    out.push({
      id: 'summit',
      tag: 'слёт',
      tone: 'violet',
      icon: 'star',
      title: 'Большой слёт сезона',
      sub: `${summit.place} · финал трёх месяцев`,
      to: '/summit',
    });
  }

  return out.slice(0, 3);
}

/** «сегодня / вчера / 3 дня назад» — короче, чем полная дата. */
function dayLabel(at, now) {
  const days = Math.floor((now - at) / DAY);
  if (days <= 0) return 'сегодня';
  if (days === 1) return 'вчера';
  return `${days} ${plural(days, 'день', 'дня', 'дней')} назад`;
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
export const WEEKLY_MEETS = 7;

/** Сколько раз человек может попасть в чужие списки за неделю. */
const MEETS_CAP = WEEKLY_MEETS * 2;

/** Сколько фото можно показать в знакомствах. */
export const MEET_PHOTOS = 5;

/** Фото для знакомств: своё, если загрузил, иначе аватар из профиля. */
export function meetPhotos(user) {
  const own = (user?.meetPhotos || []).filter(Boolean);
  return own.length ? own : user?.photo ? [user.photo] : [];
}

/** Теги для знакомств: свои, если задал, иначе увлечения из анкеты. */
export function meetTags(user) {
  const own = (user?.meetTags || []).filter(Boolean);
  return own.length ? own : user?.facts?.hobby || [];
}

/** Цели знакомства: выбранные вручную или взятые из «зачем в клубе». */
export function meetGoals(user) {
  const own = Array.isArray(user?.meetGoal) ? user.meetGoal : user?.meetGoal ? [user.meetGoal] : [];
  const list = (own.length ? own : user?.facts?.goal || []).filter((g) => MEET_GOALS.some((x) => x.id === g));
  return list.length ? list.slice(0, 3) : [MEET_GOALS[0].id];
}

/** Оба отметили «хочу влюбиться» и оба ищут любовь — про это стоит сказать вслух. */
export function loveMatch(a, b) {
  const wants = (u) => (u?.facts?.goal || []).includes('Встретить любовь') || meetGoals(u).includes('Встретить любовь');
  const free = (u) => u?.facts?.status?.[0] === 'Хочу влюбиться';
  return wants(a) && wants(b) && free(a) && free(b);
}

export const MEET_GOALS = [
  { id: 'Новые знакомства', label: 'Просто пообщаться', icon: 'people' },
  { id: 'Найти партнёров', label: 'Найти партнёра в дело', icon: 'handshake' },
  { id: 'Запустить проект', label: 'Собрать проект', icon: 'rocket' },
  { id: 'Научиться ИИ', label: 'Обменяться опытом в ИИ', icon: 'spark' },
  { id: 'Встретить любовь', label: 'Встретить любовь', icon: 'heart' },
];

const AI_LEVELS = ['Новичок', 'Средний уровень', 'Про'];
const AGE_ORDER = ['18–25', '26–32', '33–40', '41–50', '50+'];

const fact = (user, key) => user?.facts?.[key]?.[0] || '';
const facts = (user, key) => user?.facts?.[key] || [];

/**
 * Совпадение двух участников в процентах. Главное — общие увлечения и цели:
 * по ним люди действительно сходятся. Дальше идут сфера, город и близость
 * уровня в ИИ; разные роли в деле тоже плюс — вместе они сильнее.
 */
/** С кем совпало настолько, что стоит написать первым. */
export const MATCH_STRONG = 60;

export function matchPercent(a, b) {
  if (!a || !b) return 0;
  const common = (key) => {
    const one = new Set(facts(a, key));
    return facts(b, key).filter((x) => one.has(x)).length;
  };

  let score = 10;
  score += common('hobby') * 13;      // до 39
  score += common('goal') * 11;       // до 22
  score += common('powers') * 5;
  score += common('role') * 8;        // одно занятие — сразу есть о чём говорить
  if (fact(a, 'sphere') && fact(a, 'sphere') === fact(b, 'sphere')) score += 10;
  if (a.cityId === b.cityId) score += 10;
  if (fact(a, 'work') && fact(a, 'work') === fact(b, 'work')) score += 4;
  // Совпал график — реально получится встретиться, а не только переписываться
  if (fact(a, 'schedule') && fact(a, 'schedule') === fact(b, 'schedule')) score += 5;
  // Оба «хотят влюбиться» и оба ищут любовь — отдельный, сильный сигнал
  const bothLove = facts(a, 'goal').includes('Встретить любовь') && facts(b, 'goal').includes('Встретить любовь');
  if (bothLove && fact(a, 'status') === 'Хочу влюбиться' && fact(b, 'status') === 'Хочу влюбиться') score += 10;

  const ai = AI_LEVELS.indexOf(fact(a, 'ai'));
  const aiOther = AI_LEVELS.indexOf(fact(b, 'ai'));
  if (ai >= 0 && aiOther >= 0) score += ai === aiOther ? 6 : Math.abs(ai - aiOther) === 1 ? 3 : 0;

  const age = AGE_ORDER.indexOf(fact(a, 'age'));
  const ageOther = AGE_ORDER.indexOf(fact(b, 'age'));
  if (age >= 0 && ageOther >= 0 && Math.abs(age - ageOther) <= 1) score += 4;

  // Разные роли в деле дополняют друг друга
  if (fact(a, 'craft') && fact(b, 'craft') && fact(a, 'craft') !== fact(b, 'craft')) score += 6;

  return Math.max(12, Math.min(98, Math.round(score)));
}

/** Что именно совпало — показываем человеку словами, а не голым процентом. */
export function matchReasons(a, b) {
  const out = [];
  const common = (key) => {
    const one = new Set(facts(a, key));
    return facts(b, key).filter((x) => one.has(x));
  };
  const hobby = common('hobby');
  // «Встретить любовь» — личное: в общий каталог такая причина не выносится
  const goal = common('goal').filter((g) => g !== 'Встретить любовь');
  const role = common('role');
  if (hobby.length) out.push(hobby.slice(0, 2).join(', ').toLowerCase());
  if (role.length) out.push(role[0].toLowerCase());
  if (fact(a, 'sphere') && fact(a, 'sphere') === fact(b, 'sphere')) out.push(fact(a, 'sphere').toLowerCase());
  if (goal.length) out.push(`оба за «${goal[0].toLowerCase()}»`);
  if (a.cityId === b.cityId) out.push('один город');
  if (fact(a, 'craft') && fact(b, 'craft') && fact(a, 'craft') !== fact(b, 'craft')) out.push(`${fact(a, 'craft').toLowerCase()} и ${fact(b, 'craft').toLowerCase()}`);
  return out.slice(0, 3);
}

/** Кого показать в рекомендациях: похожие по духу и ещё не в круге. */
export function recommendPeople(state, userId, limit = 6) {
  const me = userById(state, userId);
  const circle = new Set([...(state.circle || []), ...state.members.filter((m) => m.teamId === teamOf(state, userId)?.id).map((m) => m.userId)]);
  return state.users
    .filter((u) => u.id !== userId && u.active !== false && u.visible !== false && !circle.has(u.id))
    .map((u) => ({ user: u, percent: matchPercent(me, u), reasons: matchReasons(me, u) }))
    .sort((x, y) => y.percent - x.percent || y.user.joinedAt - x.user.joinedAt)
    .slice(0, limit);
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

  // Каждому нужно набрать свои WEEKLY_MEETS предложений. Попасть в чужой
  // список — тоже расход недели, но с запасом: иначе новичок, пришедший
  // в среду, остался бы вообще без знакомств.
  const shown = MEETS_CAP;
  const quota = {};
  state.meets.filter((m) => m.week === week).forEach((m) => {
    quota[m.a] = (quota[m.a] || 0) + 1;
    quota[m.b] = (quota[m.b] || 0) + 1;
  });

  state.users.forEach((user) => {
    if (user.active === false || !user.coffeeEnabled) return;
    if ((quota[user.id] || 0) >= WEEKLY_MEETS) return;

    // С кем уже виделись и чем это кончилось: повторно зовём только тех,
    // до кого не дошли — пропущенных и не ответивших, но не бывших метчей
    const history = state.meets.concat(made).filter((m) => m.a === user.id || m.b === user.id);
    const met = new Set(history.map((m) => (m.a === user.id ? m.b : m.a)));
    const closed = new Set(
      history.filter((m) => m.status === 'matched' || m.likedBy.includes(user.id)).map((m) => (m.a === user.id ? m.b : m.a))
    );

    const candidates = state.users.filter(
      (u) => u.id !== user.id && u.active !== false && u.coffeeEnabled && (quota[u.id] || 0) < shown
    );
    const rank = (u) => ({ u, percent: matchPercent(user, u), luck: hash(week + user.id + u.id) % 20 });
    const byScore = (x, y) => y.percent + y.luck - (x.percent + x.luck);

    // Сначала новые люди, а когда база кончилась — второй круг по тем,
    // с кем знакомство так и не состоялось. Пустых недель быть не должно.
    const pool = candidates.filter((u) => !met.has(u.id)).map(rank).sort(byScore);
    const again = candidates.filter((u) => met.has(u.id) && !closed.has(u.id)).map(rank).sort(byScore);

    for (const { u, percent } of pool.concat(again)) {
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

/* Кто ведёт чат. В команде это капитан и его зам, в городе — хранитель
   (организатор пятниц) и админы клуба. У ведущих есть право закрепить
   сообщение: чат без хозяина быстро превращается в свалку. */

export const CHAT_TITLES = {
  captain: 'Капитан',
  mate: 'Зам капитана',
  keeper: 'Хранитель',
  admin: 'Админ клуба',
};

export function chatCrew(state, key) {
  const [kind, rest] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
  const crew = [];
  const push = (userId, role) => {
    const user = userById(state, userId);
    if (user && !crew.some((c) => c.user.id === user.id)) crew.push({ user, role });
  };

  if (kind === 'team') {
    const team = state.teams.find((t) => t.id === rest);
    if (team) {
      push(team.captainId, 'captain');
      push(team.mateId, 'mate');
    }
  }
  if (kind === 'city') {
    const city = cityById(state, rest);
    if (city) push(city.organizerId, 'keeper');
  }
  if (kind !== 'dm') state.users.filter((u) => u.admin).forEach((u) => push(u.id, 'admin'));
  return crew;
}

/** Ведущие чата могут закреплять сообщения и следят за правилами. */
export function canPin(state, key, userId) {
  return chatCrew(state, key).some((c) => c.user.id === userId);
}

export function pinnedMessage(state, key) {
  const id = state.pins?.[key];
  return id ? state.messages.find((m) => m.id === id) || null : null;
}

/** Правила общие для всех чатов — их же участник видит при входе. */
export const CHAT_RULES = [
  'Без ссылок и рекламы — ни в сообщениях, ни в личных.',
  'Без оскорблений и осуждения: спорить о деле можно, о человеке нельзя.',
  'Пишите по делу чата: команде — про команду, городу — про встречи.',
  'Нарушение — удаление из клуба без возврата взноса.',
];

export const WELCOME_TEXT =
  'добро пожаловать. Здесь без ссылок и рекламы, без оскорблений и осуждения — ' +
  'нарушение значит удаление из клуба без возврата взноса. В остальном как дома: спрашивайте и рассказывайте.';

/**
 * Приветствие новому участнику чата. Пишется один раз на человека и чат,
 * поэтому мы помним выданные пары в state.welcomed: перезаход в приложение
 * не должен снова здороваться со всеми.
 */
export function greetInChats(state, now = Date.now()) {
  const done = new Set(state.welcomed || []);
  const added = [];
  const marks = [];

  const greet = (key, user) => {
    const mark = `${key}|${user.id}`;
    if (done.has(mark)) return;
    done.add(mark);
    marks.push(mark);
    added.push({
      id: uid('ms'),
      chat: key,
      userId: 'system',
      text: `${user.name.split(' ')[0]}, ${WELCOME_TEXT}`,
      at: now,
    });
  };

  state.members.forEach((m) => {
    const user = userById(state, m.userId);
    if (user) greet(chatKey('team', [m.teamId]), user);
  });
  state.cities.forEach((city) => {
    if (cityMembers(state, city.id).length < 2) return;
    cityMembers(state, city.id).forEach((user) => greet(chatKey('city', [city.id]), user));
  });

  if (!added.length) return state;
  return { ...state, messages: [...state.messages, ...added], welcomed: [...(state.welcomed || []), ...marks] };
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
