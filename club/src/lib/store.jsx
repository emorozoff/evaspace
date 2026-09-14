import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { buildSeed, makeCity, cityId as makeCityId } from './seed.js';
import { ensureEvents } from './events.js';
import { ensureCityRules, buildNotifications, note } from './rules.js';
import { ensureMeets } from './meet.js';
import { chatKey, greetInChats } from './chats.js';
import { POINTS } from './points.js';
import { suggestTeamPlan, voteSummary, voteTally } from './teams.js';
import account from './actions/account.js';
import teamActions from './actions/teams.js';
import social from './actions/social.js';
import content from './actions/content.js';
import { uid } from './format.js';
import { DAY } from './time.js';

const KEY = 'iaiclub.state.v7';

/* Задержки демо-режима: куратор и участники отвечают сами,
   иначе в одиночном демо некому распределить и принять. */
const AUTO_CURATOR = 20 * 1000;
const AUTO_FRIEND_ANSWER = 10 * 1000;

/**
 * Читаем сохранённое состояние и достраиваем его до текущей формы.
 * Раньше новая коллекция в коде роняла приложение у тех, кто уже заходил;
 * теперь недостающие поля берутся из свежей сборки, а не остаются пустыми.
 */
/* Ключи прошлых версий только занимают место — убираем их при старте. */
function dropOldKeys() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('iaiclub.state.') && k !== KEY)
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* приватный режим — ничего страшного */
  }
}

function load() {
  dropOldKeys();
  const fresh = buildSeed();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh;
    const saved = JSON.parse(raw);
    if (!saved || saved.v !== fresh.v) return fresh;

    const merged = { ...fresh, ...saved };
    for (const [key, value] of Object.entries(fresh)) {
      const kept = saved[key];
      const shapeMatches = Array.isArray(value) ? Array.isArray(kept) : typeof kept === typeof value && kept !== null;
      if (!shapeMatches) merged[key] = value;
    }
    merged.season = { ...fresh.season, ...(saved.season || {}) };
    merged.session = { ...fresh.session, ...(saved.session || {}) };
    return merged;
  } catch {
    return fresh;
  }
}

/**
 * Сохранение с оглядкой на место. В localStorage примерно пять мегабайт,
 * а фотографии из ленты и знакомств лежат прямо в состоянии. Раньше при
 * переполнении запись молча падала и терялось всё: сообщения, голоса,
 * правки профиля. Теперь при нехватке места сбрасываем самое тяжёлое
 * и необязательное — старые фото в ленте и давнюю переписку — и пробуем снова.
 */
function save(state) {
  const clean = { ...state, toast: null };
  try {
    localStorage.setItem(KEY, JSON.stringify(clean));
    return true;
  } catch (err) {
    if (!isQuotaError(err)) return false;
  }

  for (const shed of [shedOldPhotos, shedOldMessages]) {
    try {
      localStorage.setItem(KEY, JSON.stringify(shed(clean)));
      return true;
    } catch (err) {
      if (!isQuotaError(err)) return false;
    }
  }
  return false;
}

const isQuotaError = (err) =>
  err && (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED' || err.code === 22);

/** Фото старше недели в ленте — первое, чем можно пожертвовать. */
function shedOldPhotos(state) {
  const edge = Date.now() - 7 * DAY;
  return { ...state, posts: state.posts.map((p) => (p.at < edge && p.photo ? { ...p, photo: '' } : p)) };
}

/** Дальше режем историю переписки: последние двести сообщений на чат. */
function shedOldMessages(state) {
  const byChat = new Map();
  for (const m of state.messages) {
    if (!byChat.has(m.chat)) byChat.set(m.chat, []);
    byChat.get(m.chat).push(m);
  }
  const kept = [...byChat.values()].flatMap((list) => list.slice(-200));
  return { ...shedOldPhotos(state), messages: kept.sort((a, b) => a.at - b.at) };
}

/** Уведомление всей команде: в личные уведомления и в общий чат. */
function notifyTeam(state, team, from, title, text, to, now) {
  const roster = state.members.filter((m) => m.teamId === team.id);
  const key = `vote-${team.id}-${now}`;
  return {
    ...state,
    notes: [...state.notes, ...roster.map((m) => note(`${key}-${m.userId}`, m.userId, title, text, to, now))],
    messages: [...state.messages, { id: uid('ms'), chat: chatKey('team', [team.id]), userId: 'system', text: `${title}. ${from.name}: ${text}`, at: now }],
  };
}

/**
 * Проверяем голосование после каждого голоса. Единогласно «за» — решение
 * применяется; хотя бы один «против» — предложение закрывается.
 */
function settleVote(state, voteId, now) {
  const vote = state.votes.find((v) => v.id === voteId);
  if (!vote || vote.status !== 'open') return state;
  const tally = voteTally(state, vote);
  const team = state.teams.find((t) => t.id === vote.teamId);
  if (!team) return state;
  const author = me(state) || { name: 'Участник' };

  if (tally.no.length > 0) {
    const closed = { ...state, votes: state.votes.map((v) => (v.id === voteId ? { ...v, status: 'failed' } : v)) };
    return notifyTeam(closed, team, author, 'Предложение не прошло', `«${voteSummary(vote)}» — кто-то из команды против. Решения принимаются единогласно.`, '/team', now);
  }
  if (!tally.done) return state;

  let next = {
    ...state,
    votes: state.votes.map((v) => (v.id === voteId ? { ...v, status: 'passed' } : v)),
  };
  if (vote.kind === 'goal') {
    next = { ...next, teams: next.teams.map((t) => (t.id === team.id ? { ...t, goal: vote.proposal.goal } : t)) };
  } else {
    // Меняем расписание и пересобираем будущие созвоны под новое время
    next = { ...next, teams: next.teams.map((t) => (t.id === team.id ? { ...t, call: vote.proposal } : t)) };
    next = { ...next, events: next.events.filter((e) => !(e.teamId === team.id && e.type === 'team' && e.startsAt > now)) };
    next = { ...next, events: [...next.events, ...ensureEvents(next, now)] };
  }
  const what = vote.kind === 'goal' ? 'Цель команды изменилась' : 'Время созвона изменилось';
  return notifyTeam(next, team, author, what, `Команда согласилась единогласно: ${voteSummary(vote)}.`, '/team', now);
}

/** Баллы за активность: копятся у участника и видны в профиле. */
function award(state, userId, kind, times = 1) {
  const amount = (POINTS[kind] || 0) * times;
  if (!userId || !amount) return state;
  return {
    ...state,
    users: state.users.map((u) => (u.id === userId ? { ...u, points: (u.points || 0) + amount } : u)),
    pointsLog: [...(state.pointsLog || []), { id: uid('pt'), userId, kind, amount, at: Date.now() }].slice(-200),
  };
}

function withToast(state, text) {
  return { ...state, toast: text ? { id: uid('t'), text } : null };
}

function me(state) {
  return state.users.find((u) => u.id === state.session.userId) || null;
}

/** Город по названию: находим существующий или заводим новый. */
function resolveCity(state, name) {
  const id = makeCityId(name);
  if (state.cities.some((c) => c.id === id)) return { state, id };
  return { state: { ...state, cities: [...state.cities, makeCity(name)] }, id };
}

/* Редьюсер собран из четырёх срезов по смыслу. Каждый срез отвечает
   за свои действия и возвращает undefined, если действие не его, —
   так добавление нового действия не заставляет читать весь файл. */
const SLICES = [account, teamActions, social, content];

function reducer(state, action) {
  const now = action.now || Date.now();
  const user = me(state);
  const ctx = { now, user, withToast, award, notifyTeam, settleVote, resolveCity, root: reducer };

  for (const slice of SLICES) {
    const next = slice(state, action, ctx);
    if (next !== undefined) return next;
  }

  switch (action.type) {

    case 'toast':
      return withToast(state, action.text);

    case 'reset':
      return withToast(buildSeed(now), 'Демо-данные пересозданы');

    case 'seenInstall':
      return { ...state, seenInstall: true };

    case 'tick': {
      let next = state;

      const added = ensureEvents(next, now);
      if (added.length) next = { ...next, events: [...next.events, ...added] };

      const rules = ensureCityRules(next, now);
      if (rules.changed) next = { ...next, cities: rules.cities };
      const cityNotes = rules.notes.filter((n) => !next.notes.some((x) => x.key === n.key));
      if (cityNotes.length) next = { ...next, notes: [...next.notes, ...cityNotes] };

      next = ensureMeets(next, now);
      next = greetInChats(next, now);

      // Демо: ИИ-куратор разбирает вашу заявку сам — тем же алгоритмом, что в админке.
      // Чужие заявки остаются куратору: иначе в админке нечего было бы распределять.
      const waiting = next.applications.filter(
        (a) => a.status === 'pending' && a.userId === next.session.userId && now - a.at > AUTO_CURATOR
      );
      if (waiting.length) {
        const plan = suggestTeamPlan(next);
        for (const application of waiting) {
          const step = plan.find((x) => x.userId === application.userId);
          if (!step) break;
          next = reducer(next, { type: 'assign', teamId: step.teamId, userId: step.userId, role: step.role, silent: true, now });
        }
        next = { ...next, toast: state.toast };
      }

      // Демо: собеседник в личном чате отвечает сам — иначе разговор мёртвый
      const replies = ['Привет! Рад знакомству', 'Давай созвонимся на неделе?', 'Отличная идея, я за', 'Напиши, когда удобно — подстроюсь', 'Как раз думал об этом же'];
      const dmKeys = [...new Set(next.messages.filter((m) => m.chat.startsWith('dm:')).map((m) => m.chat))];
      for (const key of dmKeys) {
        const thread = next.messages.filter((m) => m.chat === key).sort((a, b) => a.at - b.at);
        const last = thread[thread.length - 1];
        if (!last || last.userId !== next.session.userId || now - last.at < AUTO_FRIEND_ANSWER) continue;
        const other = key.slice(3).split('|').find((id) => id !== next.session.userId);
        if (!next.users.find((u) => u.id === other)?.demo) continue;
        next = {
          ...next,
          messages: [...next.messages, { id: uid('ms'), chat: key, userId: other, text: replies[thread.length % replies.length], at: now }],
        };
      }

      // Демо: собеседник отвечает взаимностью тем охотнее, чем ближе интересы
      const waitingMeets = next.meets.filter(
        (m) => m.status === 'liked' && now - m.at > AUTO_FRIEND_ANSWER && !m.likedBy.includes(m.a === next.session.userId ? m.b : m.a)
      );
      for (const meet of waitingMeets) {
        const other = meet.likedBy.includes(meet.a) ? meet.b : meet.a;
        const person = next.users.find((u) => u.id === other);
        if (!person?.demo) continue;
        if (meet.percent < 45) {
          next = { ...next, meets: next.meets.map((m) => (m.id === meet.id ? { ...m, status: 'passed' } : m)) };
          continue;
        }
        const saved = next.session.userId;
        next = reducer({ ...next, session: { ...next.session, userId: other } }, { type: 'meetLike', id: meet.id, now });
        next = { ...next, session: { ...next.session, userId: saved }, toast: state.toast };
      }

      // Демо: приглашённый в команду соглашается сам
      const invited = next.invites.filter((i) => i.status === 'pending' && now - i.at > AUTO_FRIEND_ANSWER && next.users.find((u) => u.id === i.userId)?.demo);
      for (const invite of invited) next = reducer(next, { type: 'inviteAnswer', id: invite.id, accept: true, now });
      if (invited.length) next = { ...next, toast: state.toast };

      const friendPending = next.friends.filter(
        (f) => f.status === 'pending' && now - f.at > AUTO_FRIEND_ANSWER && next.users.find((u) => u.id === f.b)?.demo
      );
      if (friendPending.length) {
        next = {
          ...next,
          friends: next.friends.map((f) => (friendPending.some((p) => p.id === f.id) ? { ...f, status: 'accepted' } : f)),
        };
      }

      const fresh = buildNotifications(next, me(next), now);
      if (fresh.length) next = { ...next, notes: [...next.notes, ...fresh] };

      return next;
    }

    default:
      return state;
  }
}

const Ctx = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, load);
  const first = useRef(true);
  const warned = useRef(false);

  // Сохраняем и подтягиваем расписание при каждом открытии
  useEffect(() => {
    if (first.current) {
      first.current = false;
      dispatch({ type: 'tick' });
    }
    // Если записать не удалось даже после чистки — честно предупреждаем:
    // молча терять сообщения и правки профиля хуже, чем сказать об этом
    if (!save(state) && !warned.current) {
      warned.current = true;
      dispatch({ type: 'toast', text: 'В браузере кончилось место — часть фото не сохранится' });
    }
  }, [state]);

  // Раз в минуту: подтягиваем ближайшие события и ответы на заявки
  useEffect(() => {
    const id = setInterval(() => dispatch({ type: 'tick' }), 5000);
    const onShow = () => dispatch({ type: 'tick' });
    document.addEventListener('visibilitychange', onShow);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onShow);
    };
  }, []);

  const value = useMemo(() => ({ state, dispatch, me: me(state) }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStore вне StoreProvider');
  return ctx;
}
