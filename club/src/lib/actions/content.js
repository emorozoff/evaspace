/* Содержимое клуба: события, города, база знаний, словарь и промпты.
   Здесь распоряжаются куратор и организаторы, а не каждый участник. */
import { uid } from '../format.js';
import { MAX_PINNED } from '../logic.js';

export default function reduce(state, action, ctx) {
  const { now, user, withToast, award } = ctx;

  switch (action.type) {
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

    /* ---------- база знаний: закреп и словарь ---------- */

    case 'pin': {
      const pinned = state.pinned || [];
      const has = pinned.includes(action.id);
      if (!has && pinned.length >= MAX_PINNED) return withToast(state, `В закрепе уже ${MAX_PINNED} материалов`);
      return withToast(
        { ...state, pinned: has ? pinned.filter((x) => x !== action.id) : [...pinned, action.id] },
        has ? 'Убрали из закрепа' : 'Закрепили'
      );
    }

    /** Слово в словарь может добавить любой участник — язык клуба общий. */
    case 'termAdd': {
      const term = (action.term || '').trim();
      if (!term) return state;
      return withToast(
        {
          ...state,
          terms: [
            ...(state.terms || []),
            { id: uid('tm'), level: action.level || 'base', term, full: (action.full || '').trim(), text: (action.text || '').trim(), userId: user?.id || null, at: now },
          ],
        },
        'Слово добавлено'
      );
    }

    /** Свой промпт в библиотеку — как и слово в словарь, виден всем. */
    case 'promptAdd': {
      const title = (action.title || '').trim();
      const text = (action.text || '').trim();
      if (!title || !text) return state;
      return withToast(
        {
          ...state,
          prompts: [
            ...(state.prompts || []),
            { id: uid('pm'), cat: action.cat || 'sales', title, about: (action.about || '').trim(), text, userId: user?.id || null, at: now },
          ],
        },
        'Промпт добавлен'
      );
    }

    case 'promptDelete':
      return withToast({ ...state, prompts: (state.prompts || []).filter((p) => p.id !== action.id) }, 'Удалено');

    case 'termDelete':
      return withToast({ ...state, terms: (state.terms || []).filter((t) => t.id !== action.id) }, 'Удалено');

    case 'buyArchive':
      if (!user) return state;
      return withToast(
        { ...state, users: state.users.map((u) => (u.id === user.id ? { ...u, archive: true } : u)) },
        'Архив прошлых сезонов открыт'
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

    default:
      return undefined;
  }
}
