import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { buildSeed, makeCity, cityId as makeCityId } from './seed.js';
import { ensureEvents } from './events.js';
import {
  ensureCityRules,
  ensureMeets,
  chatKey,
  buildNotifications,
  POINTS,
  suggestTeamPlan,
  teamSize,
  MAX_TEAM,
  REFERRAL_BONUS,
  note,
} from './logic.js';
import { uid, hash } from './format.js';
import { DAY, weekKey } from './time.js';

const KEY = 'iaiclub.state.v4';

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

function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...state, toast: null }));
  } catch {
    /* приватный режим — молча продолжаем */
  }
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
        onboarded: false,
        facts: {},
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

    /** Ответы анкеты знакомства — по ним куратор балансирует команды. */
    case 'onboard': {
      if (!user) return state;
      const facts = { ...(user.facts || {}), ...action.facts };
      const patch = { facts, onboarded: true };
      // Роль и увлечения сразу видны в каталоге — дублировать их руками не нужно
      if (facts.hobby?.length) patch.skills = [...new Set([...(user.skills || []), ...facts.hobby])].slice(0, 5);
      return { ...state, users: state.users.map((u) => (u.id === user.id ? { ...u, ...patch } : u)) };
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
      const first = !rsvp[key] && action.status === 'going';
      if (rsvp[key] === action.status) delete rsvp[key];
      else rsvp[key] = action.status;
      const next = { ...state, rsvp };
      return first ? award(next, user.id, 'rsvp') : next;
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

    /* ---------- команды: распределяет куратор ---------- */

    case 'apply': {
      if (!user) return state;
      const applications = state.applications.filter((a) => !(a.userId === user.id && a.status === 'pending'));
      return withToast(
        {
          ...state,
          applications: [...applications, { id: uid('ap'), userId: user.id, role: action.role, hours: action.hours, about: action.about || '', at: now, status: 'pending' }],
        },
        'Заявка у куратора'
      );
    }

    case 'applyCancel':
      return withToast({ ...state, applications: state.applications.filter((a) => !(a.userId === user?.id && a.status === 'pending')) }, 'Заявка отозвана');

    case 'teamCreate': {
      const id = uid('t');
      const team = {
        id,
        name: action.name.trim(),
        idea: (action.idea || '').trim(),
        captainId: action.captainId || null,
        seasonId: state.season.id,
        chatUrl: '',
        createdAt: now,
      };
      const next = { ...state, teams: [...state.teams, team] };
      return withToast({ ...next, events: [...next.events, ...ensureEvents(next, now)] }, 'Команда создана');
    }

    case 'teamCover':
      return withToast({ ...state, teams: state.teams.map((t) => (t.id === action.teamId ? { ...t, cover: action.cover } : t)) }, 'Обложка обновлена');

    /** Куратор применяет план, собранный ИИ. */
    case 'applyPlan': {
      let next = state;
      for (const step of action.plan) {
        next = reducer(next, { type: 'assign', teamId: step.teamId, userId: step.userId, role: step.role, silent: true, now });
      }
      return withToast(next, `Распределено: ${action.plan.length}`);
    }

    case 'teamPatch':
      return withToast({ ...state, teams: state.teams.map((t) => (t.id === action.teamId ? { ...t, ...action.patch } : t)) }, 'Сохранено');

    /** Куратор определяет участника в команду. */
    case 'assign': {
      if (teamSize(state, action.teamId) >= MAX_TEAM) return withToast(state, 'В команде уже 10 человек');
      const team = state.teams.find((t) => t.id === action.teamId);
      if (!team) return state;
      const members = state.members.filter((m) => m.userId !== action.userId);
      const application = state.applications.find((a) => a.userId === action.userId && a.status === 'pending');
      return withToast(
        {
          ...state,
          members: [...members, { teamId: team.id, userId: action.userId, role: action.role || application?.role || 'участник', joinedAt: now }],
          applications: state.applications.map((a) => (a.userId === action.userId && a.status === 'pending' ? { ...a, status: 'assigned', teamId: team.id } : a)),
          teams: state.teams.map((t) => (t.id === team.id && !t.captainId ? { ...t, captainId: action.userId } : t)),
          notes: [...state.notes, note(`assigned-${team.id}-${action.userId}-${now}`, action.userId, 'Вы в команде', `Куратор определил вас в команду «${team.name}».`, '/team', now)],
        },
        action.silent ? null : 'Участник в команде'
      );
    }

    case 'unassign': {
      const members = state.members.filter((m) => !(m.teamId === action.teamId && m.userId === action.userId));
      const rest = members.filter((m) => m.teamId === action.teamId);
      return withToast(
        {
          ...state,
          members,
          teams: state.teams.map((t) => (t.id === action.teamId && t.captainId === action.userId ? { ...t, captainId: rest[0]?.userId || null } : t)),
        },
        'Участник убран из команды'
      );
    }

    /** Капитан раздаёт роли и назначает помощника. */
    case 'teamRole':
      return withToast(
        { ...state, members: state.members.map((m) => (m.teamId === action.teamId && m.userId === action.userId ? { ...m, role: action.role } : m)) },
        'Роль обновлена'
      );

    case 'teamTitle': {
      const team = state.teams.find((t) => t.id === action.teamId);
      if (!team) return state;
      const patch = action.title === 'captain' ? { captainId: action.userId } : { mateId: action.userId === team.mateId ? null : action.userId };
      return withToast({ ...state, teams: state.teams.map((t) => (t.id === team.id ? { ...t, ...patch } : t)) }, action.title === 'captain' ? 'Новый капитан' : 'Помощник назначен');
    }

    /** Усиление команды: участник зовёт человека, тот решает сам. */
    case 'invite': {
      if (state.invites.some((i) => i.userId === action.userId && i.status === 'pending')) return withToast(state, 'Этого человека уже позвали');
      const team = state.teams.find((t) => t.id === action.teamId);
      const id = uid('iv');
      return withToast(
        {
          ...state,
          invites: [...state.invites, { id, teamId: action.teamId, userId: action.userId, fromId: user?.id, at: now, status: 'pending' }],
          notes: [...state.notes, note(`invite-${id}`, action.userId, 'Вас зовут в команду', `«${team?.name}» приглашает вас усилить команду.`, '/team', now)],
        },
        'Приглашение отправлено'
      );
    }

    case 'inviteAnswer': {
      const invite = state.invites.find((i) => i.id === action.id);
      if (!invite) return state;
      const invites = state.invites.map((i) => (i.id === invite.id ? { ...i, status: action.accept ? 'accepted' : 'declined' } : i));
      if (!action.accept) return withToast({ ...state, invites }, 'Приглашение отклонено');
      const application = state.applications.find((a) => a.userId === invite.userId && a.status === 'pending');
      const next = reducer({ ...state, invites }, { type: 'assign', teamId: invite.teamId, userId: invite.userId, role: application?.role || user?.facts?.role?.[0], silent: true, now });
      // Тот, кто позвал, получает благодарность в бонусах: команда стала сильнее
      const bonus = 500;
      return withToast(
        {
          ...next,
          users: next.users.map((u) => (u.id === invite.fromId ? { ...u, bonus: (u.bonus || 0) + bonus } : u)),
          bonusLog: [...next.bonusLog, { id: uid('b'), userId: invite.fromId, amount: bonus, reason: 'Привёл человека в команду', at: now }],
        },
        'Добро пожаловать в команду'
      );
    }

    /* ---------- разговоры ---------- */

    case 'send': {
      if (!user || !action.text.trim()) return state;
      const next = {
        ...state,
        messages: [...state.messages, { id: uid('ms'), chat: action.chat, userId: user.id, text: action.text.trim(), at: now }],
        seen: { ...state.seen, [action.chat]: now },
      };
      // Баллы за живое общение, но не за спам: не чаще раза в минуту
      const last = state.messages.filter((m) => m.userId === user.id).sort((a, b) => b.at - a.at)[0];
      return last && now - last.at < 60 * 1000 ? next : award(next, user.id, 'message');
    }

    case 'readChat':
      return { ...state, seen: { ...state.seen, [action.chat]: now } };

    /* ---------- знакомства ---------- */

    /** Цель, с которой участник идёт знакомиться на этой неделе. */
    case 'meetGoal':
      return { ...state, users: state.users.map((u) => (u.id === user?.id ? { ...u, meetGoal: [].concat(action.goal).slice(0, 3) } : u)) };

    case 'meetSkip':
      return withToast({ ...state, meets: state.meets.map((m) => (m.id === action.id ? { ...m, status: 'skipped' } : m)) }, 'Пропускаем');

    /** Предложить знакомство. Совпало с обеих сторон — метч и общий чат. */
    case 'meetLike': {
      const meet = state.meets.find((m) => m.id === action.id);
      if (!meet || !user) return state;
      const other = meet.a === user.id ? meet.b : meet.a;
      const likedBy = [...new Set([...(meet.likedBy || []), user.id])];
      const matched = likedBy.includes(other);
      const meets = state.meets.map((m) => (m.id === meet.id ? { ...m, likedBy, status: matched ? 'matched' : 'liked', goal: action.goal || m.goal } : m));
      if (!matched) return withToast({ ...state, meets }, 'Предложение отправлено');

      const chat = chatKey('dm', [meet.a, meet.b]);
      const names = [meet.a, meet.b].map((id) => state.users.find((u) => u.id === id));
      const rewarded = award(award(state, meet.a, 'match'), meet.b, 'match');
      return withToast(
        {
          ...rewarded,
          meets,
          messages: [
            ...rewarded.messages,
            { id: uid('ms'), chat, userId: 'system', text: `Метч недели: совпадение интересов ${meet.percent}%. Договоритесь, где и когда.`, at: now },
          ],
          notes: [
            ...rewarded.notes,
            note(`match-${meet.id}-${meet.a}`, meet.a, 'Метч недели', `${names[1]?.name} тоже хочет познакомиться. Открывайте чат.`, `/chat/${chat}`, now),
            note(`match-${meet.id}-${meet.b}`, meet.b, 'Метч недели', `${names[0]?.name} тоже хочет познакомиться. Открывайте чат.`, `/chat/${chat}`, now),
          ],
        },
        'Метч! Чат уже открыт'
      );
    }

    /* ---------- лента ---------- */

    case 'postAdd': {
      if (!user) return state;
      const post = { id: uid('ps'), userId: user.id, text: action.text.trim(), photo: action.photo || '', tag: action.tag || 'встреча', at: now, likes: [] };
      const withPost = { ...state, posts: [post, ...state.posts] };
      const kind = post.tag === 'встреча' && post.photo ? 'meetPhoto' : 'post';
      return withToast(award(withPost, user.id, kind), `+${POINTS[kind]} баллов за пост`);
    }

    case 'postLike': {
      if (!user) return state;
      return {
        ...state,
        posts: state.posts.map((p) =>
          p.id === action.id ? { ...p, likes: p.likes.includes(user.id) ? p.likes.filter((x) => x !== user.id) : [...p.likes, user.id] } : p
        ),
      };
    }

    case 'postDelete':
      return withToast({ ...state, posts: state.posts.filter((p) => p.id !== action.id) }, 'Пост удалён');

    /* ---------- ближний круг ---------- */

    case 'circleAdd':
      return withToast(
        { ...state, circle: [...new Set([...(state.circle || []), action.userId])], circleOut: (state.circleOut || []).filter((id) => id !== action.userId) },
        'Добавлен в ближний круг'
      );

    case 'circleRemove':
      return {
        ...state,
        circle: (state.circle || []).filter((id) => id !== action.userId),
        circleOut: [...new Set([...(state.circleOut || []), action.userId])],
      };

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
      return withToast(award({ ...state, revenue: [...state.revenue, entry] }, user.id, 'revenue'), `Записано ${entry.amount.toLocaleString('ru-RU')} ₽`);
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

      next = ensureMeets(next, now);

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
