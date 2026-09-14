/* Команды: состав, роли, выручка, копилка, рейтинг и ИИ-куратор,
   который раскладывает заявки так, чтобы команды вышли рабочими. */
import { hash } from './format.js';
import { userById, isPro } from './club.js';
import { canSeeEvent, rsvpOf } from './schedule.js';
import { pointsOf } from './points.js';

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

/**
 * Личный результат за сезон: своя внесённая выручка и баллы за активность.
 * Команда — это сумма, но участнику важно видеть и свой вклад отдельно.
 */
export function personalResult(state, userId, now = Date.now()) {
  const entries = state.revenue.filter((r) => r.userId === userId);
  return {
    revenue: entries.reduce((sum, r) => sum + r.amount, 0),
    entries: entries.length,
    points: pointsOf(state, userId),
    attendance: attendanceOf(state, userId, now).percent,
  };
}

/** Личный рейтинг: сначала выручка, при равной — баллы активности. */
export function personalBoard(state, now = Date.now()) {
  return state.users
    .filter((u) => u.active !== false)
    .map((user) => ({ user, ...personalResult(state, user.id, now) }))
    .filter((row) => row.revenue > 0 || row.points > 0)
    .sort((a, b) => b.revenue - a.revenue || b.points - a.points)
    .map((row, i) => ({ ...row, place: i + 1, award: awardOf(i + 1) }));
}

export function personalPlace(state, userId) {
  const row = personalBoard(state).find((r) => r.user.id === userId);
  return row ? row.place : null;
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
/* ---------- голосования команды ---------- */

/**
 * Командные решения принимаются единогласно. Так задумано: цель и время
 * созвона касаются каждого, и решение большинством здесь означало бы,
 * что кто-то ходит на встречи, которые ему не подходят.
 */
export const VOTE_KINDS = {
  goal: { title: 'Цель команды', icon: 'target' },
  call: { title: 'Время созвона', icon: 'calendar' },
};

export function votesOf(state, teamId, status = 'open') {
  return (state.votes || [])
    .filter((v) => v.teamId === teamId && (!status || v.status === status))
    .sort((a, b) => b.at - a.at);
}

export function openVotes(state, teamId) {
  return votesOf(state, teamId, 'open');
}

/** Сколько голосов собрано и кого ещё ждём. */
export function voteTally(state, vote) {
  const roster = teamRoster(state, vote.teamId);
  const yes = roster.filter((m) => vote.votes[m.userId] === 'yes');
  const no = roster.filter((m) => vote.votes[m.userId] === 'no');
  const waiting = roster.filter((m) => !vote.votes[m.userId]);
  return { roster, yes, no, waiting, need: roster.length, done: yes.length === roster.length && roster.length > 0 };
}

/** Что именно предлагают — одной строкой для списка и уведомления. */
export function voteSummary(vote) {
  if (vote.kind === 'goal') return vote.proposal.goal;
  const { weekday, hour, minute } = vote.proposal;
  const days = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
  return `${days[weekday - 1]}, ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
