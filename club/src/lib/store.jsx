import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { buildSeed, makeCity, cityId as makeCityId } from './seed.js';
import { ensureEvents } from './events.js';
import {
  ensureCityRules,
  ensureCoffee,
  buildNotifications,
  teamOf,
  teamSize,
  MAX_TEAM,
  REFERRAL_BONUS,
  note,
} from './logic.js';
import { uid, hash } from './format.js';
import { DAY, weekKey } from './time.js';

const KEY = 'iaiclub.state.v1';

/* Задержки демо-режима: капитан и участники отвечают сами,
   иначе в одиночном демо заявку некому принять. */
const AUTO_TEAM_ANSWER = 15 * 1000;
const AUTO_FRIEND_ANSWER = 10 * 1000;

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return buildSeed();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== 1) return buildSeed();
    return parsed;
  } catch {
    return buildSeed();
  }
}

function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...state, toast: null }));
  } catch {
    /* приватный режим — молча продолжаем */
  }
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

function reducer(state, action) {
  const now = action.now || Date.now();
  const user = me(state);

  switch (action.type) {
    /* ---------- вход и профиль ---------- */

    case 'register': {
      const { name, city, about, phone, pack, ref } = action;
      const resolved = resolveCity(state, city);
      let next = resolved.state;
      const id = uid('u');
      const person = {
        id,
        name: name.trim(),
        cityId: resolved.id,
        about: about.trim(),
        lookingFor: '',
        skills: [],
        photo: '',
        tg: '',
        phone,
        package: pack || 'club',
        joinedAt: now,
        referredBy: ref || null,
        bonus: 0,
        coffeeEnabled: true,
        visible: true,
        notifications: true,
        archive: false,
        admin: false,
        active: true,
        paid: false,
        demo: false,
        ref: 'r' + hash(name + now).toString(36).slice(0, 6),
        links: '',
      };
      next = { ...next, users: [...next.users, person], session: { ...next.session, userId: id } };

      // Реферальная ссылка: бонус пригласившему, скидка новому участнику
      const inviter = ref ? next.users.find((u) => u.ref === ref) : null;
      if (inviter) {
        next = {
          ...next,
          referrals: [...next.referrals, { id: uid('rf'), inviterId: inviter.id, invitedId: id, status: 'visited', bonus: REFERRAL_BONUS, at: now }],
        };
      }
      // Сразу применяем правила города: чат, пятница, предложение организатору
      return withToast(reducer(next, { type: 'tick', now }), 'Добро пожаловать в клуб');
    }

    case 'pay': {
      if (!user) return state;
      let next = {
        ...state,
        users: state.users.map((u) => (u.id === user.id ? { ...u, paid: true, package: action.pack || u.package } : u)),
      };
      // Пригласивший получает бонус, когда приглашённый оплатил
      const ref = next.referrals.find((r) => r.invitedId === user.id && r.status !== 'paid');
      if (ref) {
        next = {
          ...next,
          referrals: next.referrals.map((r) => (r.id === ref.id ? { ...r, status: 'paid', at: now } : r)),
          users: next.users.map((u) => (u.id === ref.inviterId ? { ...u, bonus: (u.bonus || 0) + ref.bonus } : u)),
          bonusLog: [...next.bonusLog, { id: uid('b'), userId: ref.inviterId, amount: ref.bonus, reason: 'Приглашённый оплатил подписку', at: now }],
          notes: [...next.notes, note(`ref-paid-${ref.id}`, ref.inviterId, 'Друг оплатил подписку', `Вам начислено ${REFERRAL_BONUS} ₽ бонусами.`, '/invite', now)],
        };
      }
      return withToast(next, 'Доступ открыт');
    }

    case 'login':
      return { ...state, session: { ...state.session, userId: action.userId } };

    case 'logout':
      return { ...state, session: { userId: null, admin: false } };

    case 'profile': {
      if (!user) return state;
      let next = state;
      let patch = { ...action.patch };
      if (patch.city) {
        const resolved = resolveCity(state, patch.city);
        next = resolved.state;
        patch = { ...patch, cityId: resolved.id };
        delete patch.city;
      }
      const moved = { ...next, users: next.users.map((u) => (u.id === user.id ? { ...u, ...patch } : u)) };
      return withToast(patch.cityId ? reducer(moved, { type: 'tick', now }) : moved, action.silent ? null : 'Сохранено');
    }

    case 'buyArchive':
      if (!user) return state;
      return withToast(
        { ...state, users: state.users.map((u) => (u.id === user.id ? { ...u, archive: true } : u)) },
        'Архив прошлых сезонов открыт'
      );

    /* ---------- события ---------- */

    case 'rsvp': {
      if (!user) return state;
      const key = `${action.eventId}:${user.id}`;
      const rsvp = { ...state.rsvp };
      if (rsvp[key] === action.status) delete rsvp[key];
      else rsvp[key] = action.status;
      return { ...state, rsvp };
    }

    case 'eventPatch':
      return withToast(
        { ...state, events: state.events.map((e) => (e.id === action.eventId ? { ...e, ...action.patch } : e)) },
        action.toast ?? 'Событие обновлено'
      );

    case 'eventAdd':
      return withToast({ ...state, events: [...state.events, { ...action.event, id: action.event.id || uid('ev') }] }, 'Событие создано');

    case 'eventDelete':
      return withToast({ ...state, events: state.events.filter((e) => e.id !== action.eventId) }, 'Событие удалено');

    /* ---------- города ---------- */

    case 'organizer': {
      if (!user) return state;
      const cities = state.cities.map((c) => {
        if (c.id !== action.cityId) return c;
        if (action.accept) return { ...c, organizerId: user.id, organizerOfferTo: null };
        return { ...c, organizerOfferTo: null, organizerDeclined: [...(c.organizerDeclined || []), user.id] };
      });
      return withToast({ ...state, cities }, action.accept ? 'Теперь вы организатор города' : 'Хорошо, предложим следующему');
    }

    case 'propose':
      return withToast(
        { ...state, proposals: [...state.proposals, { id: uid('p'), cityId: action.cityId, userId: user?.id, text: action.text, at: now }] },
        'Предложение отправлено в чат города'
      );

    /* ---------- команды ---------- */

    case 'teamCreate': {
      if (!user) return state;
      const id = uid('t');
      const team = {
        id,
        name: action.name.trim(),
        idea: action.idea.trim(),
        captainId: user.id,
        seasonId: state.season.id,
        isOpen: true,
        wanted: action.wanted || 5,
        chatUrl: '',
        createdAt: now,
      };
      const next = {
        ...state,
        teams: [...state.teams, team],
        members: [...state.members, { teamId: id, userId: user.id, role: 'капитан', joinedAt: now }],
        requests: state.requests.filter((r) => r.userId !== user.id || r.status !== 'pending'),
      };
      return withToast({ ...next, events: [...next.events, ...ensureEvents(next, now)] }, 'Команда создана. Вы капитан');
    }

    case 'teamPatch':
      return withToast({ ...state, teams: state.teams.map((t) => (t.id === action.teamId ? { ...t, ...action.patch } : t)) }, 'Сохранено');

    case 'teamApply': {
      if (!user) return state;
      if (state.requests.some((r) => r.teamId === action.teamId && r.userId === user.id && r.status === 'pending')) return state;
      return withToast(
        { ...state, requests: [...state.requests, { id: uid('q'), teamId: action.teamId, userId: user.id, status: 'pending', note: action.note || '', at: now }] },
        'Заявка отправлена капитану'
      );
    }

    case 'teamAnswer': {
      const request = state.requests.find((r) => r.id === action.requestId);
      if (!request) return state;
      const accept = action.accept && teamSize(state, request.teamId) < MAX_TEAM;
      const requests = state.requests.map((r) => (r.id === request.id ? { ...r, status: accept ? 'accepted' : 'declined' } : r));
      if (!accept) return withToast({ ...state, requests }, 'Заявка отклонена');
      const team = state.teams.find((t) => t.id === request.teamId);
      return withToast(
        {
          ...state,
          requests,
          members: [...state.members, { teamId: request.teamId, userId: request.userId, role: 'участник', joinedAt: now }],
          notes: [...state.notes, note(`team-in-${request.id}`, request.userId, 'Вас взяли в команду', `${team?.name || 'Команда'} приняла вашу заявку.`, `/team/${request.teamId}`, now)],
        },
        'Участник добавлен'
      );
    }

    case 'teamLeave': {
      if (!user) return state;
      const team = teamOf(state, user.id);
      if (!team) return state;
      const members = state.members.filter((m) => !(m.teamId === team.id && m.userId === user.id));
      const rest = members.filter((m) => m.teamId === team.id);
      const teams = rest.length
        ? state.teams.map((t) => (t.id === team.id && t.captainId === user.id ? { ...t, captainId: rest[0].userId } : t))
        : state.teams.filter((t) => t.id !== team.id);
      return withToast({ ...state, members, teams }, 'Вы вышли из команды');
    }

    case 'teamKick':
      return withToast(
        { ...state, members: state.members.filter((m) => !(m.teamId === action.teamId && m.userId === action.userId)) },
        'Участник исключён'
      );

    case 'report': {
      if (!user) return state;
      const week = weekKey(now);
      const existing = state.reports.find((r) => r.teamId === action.teamId && r.week === week);
      const row = { id: existing?.id || uid('rep'), teamId: action.teamId, week, authorId: user.id, ...action.patch, at: now };
      return withToast(
        { ...state, reports: existing ? state.reports.map((r) => (r.id === existing.id ? row : r)) : [...state.reports, row] },
        'Отчёт сохранён'
      );
    }

    /* ---------- выручка и копилка ---------- */

    case 'revenueAdd': {
      if (!user) return state;
      const entry = {
        id: uid('r'),
        teamId: action.teamId,
        userId: user.id,
        amount: Math.round(action.amount) || 0,
        hours: Math.round(action.hours) || 0,
        comment: action.comment || '',
        proof: action.proof || '',
        at: now,
        editableUntil: now + 2 * DAY,
      };
      return withToast({ ...state, revenue: [...state.revenue, entry] }, `Записано ${entry.amount.toLocaleString('ru-RU')} ₽`);
    }

    case 'revenueEdit':
      return withToast(
        { ...state, revenue: state.revenue.map((r) => (r.id === action.id ? { ...r, ...action.patch } : r)) },
        'Запись изменена'
      );

    case 'revenueDelete':
      return withToast({ ...state, revenue: state.revenue.filter((r) => r.id !== action.id) }, 'Запись удалена');

    case 'contributionAdd':
      return withToast(
        {
          ...state,
          contributions: [
            ...state.contributions,
            { id: uid('k'), teamId: action.teamId, amount: Math.round(action.amount) || 0, proof: action.proof || '', confirmed: false, at: now },
          ],
        },
        'Взнос отмечен. Админ подтвердит его вручную'
      );

    case 'contributionConfirm':
      return withToast(
        { ...state, contributions: state.contributions.map((c) => (c.id === action.id ? { ...c, confirmed: action.value } : c)) },
        'Готово'
      );

    /* ---------- база знаний ---------- */

    case 'view': {
      if (!user) return state;
      const key = `${action.materialId}:${user.id}`;
      const views = { ...state.views };
      if (views[key]) delete views[key];
      else views[key] = now;
      return { ...state, views };
    }

    case 'materialAdd': {
      const material = { id: uid('m'), seasonId: state.season.id, publishedAt: now, ...action.material };
      return withToast({ ...state, materials: [...state.materials, material] }, 'Материал добавлен');
    }

    case 'materialDelete':
      return withToast({ ...state, materials: state.materials.filter((m) => m.id !== action.id) }, 'Материал удалён');

    /* ---------- люди ---------- */

    case 'friendAdd': {
      if (!user) return state;
      if (state.friends.some((f) => (f.a === user.id && f.b === action.userId) || (f.b === user.id && f.a === action.userId))) return state;
      return withToast(
        { ...state, friends: [...state.friends, { id: uid('f'), a: user.id, b: action.userId, status: 'pending', at: now }] },
        'Заявка в друзья отправлена'
      );
    }

    case 'friendAnswer':
      return withToast(
        {
          ...state,
          friends: action.accept
            ? state.friends.map((f) => (f.id === action.id ? { ...f, status: 'accepted' } : f))
            : state.friends.filter((f) => f.id !== action.id),
        },
        action.accept ? 'Теперь вы друзья' : 'Заявка отклонена'
      );

    case 'friendRemove':
      return withToast({ ...state, friends: state.friends.filter((f) => f.id !== action.id) }, 'Удалено из друзей');

    case 'coffee':
      return withToast(
        { ...state, coffee: state.coffee.map((c) => (c.id === action.id ? { ...c, status: action.status } : c)) },
        action.status === 'agreed' ? 'Отлично, хорошей встречи' : 'Пропускаем эту неделю'
      );

    /* ---------- уведомления ---------- */

    case 'notesRead':
      return { ...state, notes: state.notes.map((n) => (n.userId === user?.id ? { ...n, read: true } : n)) };

    case 'noteRead':
      return { ...state, notes: state.notes.map((n) => (n.id === action.id ? { ...n, read: true } : n)) };

    /* ---------- админка ---------- */

    case 'admin':
      return { ...state, session: { ...state.session, admin: action.value } };

    case 'userPatch':
      return withToast({ ...state, users: state.users.map((u) => (u.id === action.userId ? { ...u, ...action.patch } : u)) }, 'Участник обновлён');

    case 'broadcast': {
      const targets = state.users.filter((u) => {
        if (action.target.startsWith('city:')) return u.cityId === action.target.slice(5);
        if (action.target.startsWith('pack:')) return u.package === action.target.slice(5);
        return true;
      });
      const id = uid('bc');
      return withToast(
        {
          ...state,
          broadcasts: [...state.broadcasts, { id, text: action.text, target: action.target, at: now, count: targets.length }],
          notes: [...state.notes, ...targets.map((u) => note(`bc-${id}-${u.id}`, u.id, 'Сообщение от клуба', action.text, '/', now))],
        },
        `Отправлено ${targets.length} участникам`
      );
    }

    /* ---------- служебное ---------- */

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

      next = ensureCoffee(next, now);

      // Демо: капитаны и участники отвечают на заявки сами
      const pending = next.requests.filter(
        (r) => r.status === 'pending' && now - r.at > AUTO_TEAM_ANSWER && next.users.find((u) => u.id === next.teams.find((t) => t.id === r.teamId)?.captainId)?.demo
      );
      for (const request of pending) {
        next = reducer(next, { type: 'teamAnswer', requestId: request.id, accept: teamSize(next, request.teamId) < MAX_TEAM, now });
      }
      if (pending.length) next = { ...next, toast: state.toast };

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

  // Сохраняем и подтягиваем расписание при каждом открытии
  useEffect(() => {
    if (first.current) {
      first.current = false;
      dispatch({ type: 'tick' });
    }
    save(state);
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
