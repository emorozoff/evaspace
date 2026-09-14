/* Вход, профиль, друзья, ближний круг и админский вход —
   всё, что участник делает со своей учётной записью. */
import { uid, hash } from '../format.js';
import { weekKey } from '../time.js';
import { REFERRAL_BONUS } from '../logic.js';
import { note } from '../rules.js';

export default function reduce(state, action, ctx) {
  const { now, user, withToast, award, resolveCity, root } = ctx;

  switch (action.type) {
    /* ---------- вход и профиль ---------- */

    case 'register': {
      const { name, city, about, phone, pack, ref, role } = action;
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
        facts: role?.length ? { role } : {},
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
      return withToast(root(next, { type: 'tick', now }), 'Добро пожаловать в клуб');
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
      return withToast(patch.cityId ? root(moved, { type: 'tick', now }) : moved, action.silent ? null : 'Сохранено');
    }

    /** Ответ в ленте: тред раскрывается прямо под постом. */
    case 'postReply': {
      if (!user || !action.text?.trim()) return state;
      const next = {
        ...state,
        postReplies: [...(state.postReplies || []), { id: uid('pr'), postId: action.postId, userId: user.id, text: action.text.trim(), at: now }],
      };
      return withToast(award(next, user.id, 'message'), null);
    }

    case 'postReplyDelete':
      return { ...state, postReplies: (state.postReplies || []).filter((r) => r.id !== action.id) };

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

    default:
      return undefined;
  }
}
