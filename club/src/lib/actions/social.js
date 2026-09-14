/* Разговоры, знакомства, лента и сообщества — всё, что люди делают
   друг с другом, а не со своим профилем. */
import { uid } from '../format.js';
import { weekKey } from '../time.js';
import { chatKey, seenKey, matchPercent, userById, communityById, canPin, MEET_PHOTOS, POINTS } from '../logic.js';
import { note } from '../rules.js';

export default function reduce(state, action, ctx) {
  const { now, user, withToast, award } = ctx;

  switch (action.type) {
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

    case 'toast':
      return withToast(state, action.text);

    case 'readChat':
      if (!user) return state;
      return { ...state, seen: { ...state.seen, [seenKey(user.id, action.chat)]: now } };

    /* ---------- знакомства ---------- */

    /** Цель, с которой участник идёт знакомиться на этой неделе. */
    case 'meetGoal':
      return { ...state, users: state.users.map((u) => (u.id === user?.id ? { ...u, meetGoal: [].concat(action.goal).slice(0, 3) } : u)) };

    /** Витрина в знакомствах: свои фото, цели и теги — отдельно от профиля. */
    case 'meetProfile': {
      if (!user) return state;
      const patch = {};
      if (action.photos) patch.meetPhotos = action.photos.filter(Boolean).slice(0, MEET_PHOTOS);
      if (action.tags) patch.meetTags = action.tags.filter(Boolean).slice(0, 8);
      if (action.goal) patch.meetGoal = [].concat(action.goal).slice(0, 3);
      return withToast(
        { ...state, users: state.users.map((u) => (u.id === user.id ? { ...u, ...patch } : u)) },
        action.silent ? null : 'Сохранено'
      );
    }

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

    /**
     * Предложить знакомство напрямую, не дожидаясь недельной подборки.
     * Получателю приходит уведомление и карточка с двумя ответами.
     */
    case 'meetOffer': {
      if (!user || action.toId === user.id) return state;
      const already = (state.meetOffers || []).some(
        (o) => o.fromId === user.id && o.toId === action.toId && o.status !== 'declined'
      );
      if (already) return withToast(state, 'Предложение уже отправлено');
      const to = userById(state, action.toId);
      const offer = { id: uid('of'), fromId: user.id, toId: action.toId, at: now, status: 'new' };
      return withToast(
        {
          ...state,
          meetOffers: [...(state.meetOffers || []), offer],
          notes: [
            ...state.notes,
            note(`offer-${offer.id}`, action.toId, 'Вам предложили знакомство', `${user.name} хочет познакомиться. Принять или отложить — решать вам.`, `/person/${user.id}`, now),
          ],
        },
        `Предложение ушло ${to?.name.split(' ')[0] || 'участнику'}`
      );
    }

    case 'meetOfferAnswer': {
      const offer = (state.meetOffers || []).find((o) => o.id === action.id);
      if (!offer || !user || offer.toId !== user.id) return state;
      if (!action.accept) {
        return withToast(
          { ...state, meetOffers: state.meetOffers.map((o) => (o.id === offer.id ? { ...o, status: 'later', at: now } : o)) },
          'Отложили — предложение вернётся через неделю'
        );
      }

      // Принято — это тот же метч: общий чат, баллы обоим, уведомления
      const chat = chatKey('dm', [offer.fromId, offer.toId]);
      const from = userById(state, offer.fromId);
      const week = weekKey(now);
      const exists = state.meets.find(
        (m) => m.week === week && [m.a, m.b].includes(offer.fromId) && [m.a, m.b].includes(offer.toId)
      );
      const percent = exists?.percent ?? matchPercent(from, user);
      const meet = exists
        ? { ...exists, status: 'matched', likedBy: [offer.fromId, offer.toId] }
        : {
            id: uid('mt'),
            week,
            a: offer.fromId,
            b: offer.toId,
            percent,
            online: from?.cityId !== user.cityId,
            status: 'matched',
            likedBy: [offer.fromId, offer.toId],
            at: now,
          };
      const rewarded = award(award(state, offer.fromId, 'match'), offer.toId, 'match');
      return withToast(
        {
          ...rewarded,
          meetOffers: rewarded.meetOffers.map((o) => (o.id === offer.id ? { ...o, status: 'accepted', at: now } : o)),
          meets: exists ? rewarded.meets.map((m) => (m.id === exists.id ? meet : m)) : [...rewarded.meets, meet],
          messages: [
            ...rewarded.messages,
            { id: uid('ms'), chat, userId: 'system', text: `Знакомство принято: совпадение интересов ${percent}%. Договоритесь, где и когда.`, at: now },
          ],
          notes: [
            ...rewarded.notes,
            note(`offer-ok-${offer.id}`, offer.fromId, 'Знакомство принято', `${user.name} согласился познакомиться. Чат уже открыт.`, `/chat/${chat}`, now),
          ],
        },
        'Чат открыт'
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

    /* ---------- сообщества ---------- */

    case 'community': {
      if (!user) return state;
      const list = state.communityMembers || [];
      const inside = list.some((m) => m.communityId === action.id && m.userId === user.id);
      const name = communityById(action.id)?.name || 'сообщество';
      return withToast(
        {
          ...state,
          communityMembers: inside
            ? list.filter((m) => !(m.communityId === action.id && m.userId === user.id))
            : [...list, { communityId: action.id, userId: user.id, at: now }],
        },
        inside ? `Вышли из «${name}»` : `Вы в «${name}»`
      );
    }

    /* ---------- чаты: закреп и приветствие ---------- */

    case 'pinMessage': {
      if (!canPin(state, action.chat, user?.id)) return withToast(state, 'Закреплять может только ведущий чата');
      const pins = { ...(state.pins || {}) };
      const same = pins[action.chat] === action.id;
      if (same) delete pins[action.chat];
      else pins[action.chat] = action.id;
      return withToast({ ...state, pins }, same ? 'Открепили' : 'Закрепили сообщение');
    }

    default:
      return undefined;
  }
}
