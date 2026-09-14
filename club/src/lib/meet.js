/* Люди друг для друга: совпадение, друзья, ближний круг, недельные
   знакомства и прямые предложения познакомиться. */
import { DAY, startOfWeek, weekKey } from './time.js';
import { hash, uid } from './format.js';
import { userById } from './club.js';
import { goingUsers } from './schedule.js';
import { teamOf } from './teams.js';

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

/* Прямое предложение знакомства: минуя недельную подборку. Отложенное
   возвращается через неделю — «не сейчас» редко значит «никогда». */
const OFFER_SNOOZE = 7 * DAY;

export function offerBetween(state, fromId, toId) {
  return (state.meetOffers || []).find((o) => o.fromId === fromId && o.toId === toId) || null;
}

export function incomingOffers(state, userId, now = Date.now()) {
  return (state.meetOffers || [])
    .filter((o) => o.toId === userId && (o.status === 'new' || (o.status === 'later' && now - o.at > OFFER_SNOOZE)))
    .sort((a, b) => b.at - a.at);
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
