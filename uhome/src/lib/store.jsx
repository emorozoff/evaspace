import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_CLOCKS, REGIONS } from '../data/regions.js';
import { DEFAULT_RATES } from '../data/currencies.js';
import { DEFAULT_CIRCLE } from '../data/people.js';
import { TEAM_REPLY } from '../data/chats.js';
import { memberNumber, seeded } from './art.js';

/* Состояние приложения: один стор, одно место сохранения (localStorage,
   ключ uhome.v1). Экраны не пишут в хранилище напрямую — только через
   действия отсюда. Ключ поднимается, если меняется форма данных. */

const KEY = 'uhome.v1';

export const DEMO_ME = {
  id: 'me',
  name: 'Андрей Соколов',
  role: 'Основатель',
  title: 'Основатель',
  company: 'Nord Digital',
  region: 'bali',
  city: 'Чангу',
  since: 2025,
  about: 'Делаю digital-продукты для гостиничного бизнеса. На Бали с прошлой зимы.',
  gives: ['ai', 'marketing'],
  needs: ['invest', 'realty', 'partners'],
  interests: ['Серфинг', 'Падел', 'Кофе', 'Путешествия'],
  goals: ['partner', 'friends', 'sport'],
  langs: ['RU', 'EN'],
};

/** Неделя вида 2026-39: по ней обновляется подборка знакомств. */
export function weekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return `${y}-${w}`;
}

function fresh() {
  return {
    stage: 'welcome',
    me: { ...DEMO_ME, number: memberNumber('demo', DEMO_ME.since) },
    clocks: DEFAULT_CLOCKS,
    rates: DEFAULT_RATES,
    circle: DEFAULT_CIRCLE,
    going: { e1: true, e3: true },
    asked: {},
    joined: ['c-bali', 'i-sport', 'i-ai'],
    sent: {},
    read: {},
    meet: { week: weekKey(), status: {} },
    orders: [],
    watched: {},
    hidden: {},
  };
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw || !raw.me) return fresh();
    const base = fresh();
    const s = { ...base, ...raw, me: { ...base.me, ...raw.me } };
    if (!REGIONS[s.me.region]) s.me.region = 'bali';
    // новая неделя — новая подборка знакомств
    if (s.meet?.week !== weekKey()) s.meet = { week: weekKey(), status: {} };
    return s;
  } catch {
    return fresh();
  }
}

const Ctx = createContext(null);

export function StoreProvider({ children }) {
  const [state, setState] = useState(load);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(0);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* хранилище недоступно (приватный режим) — работаем в памяти */
    }
  }, [state]);

  const say = useCallback((text) => {
    clearTimeout(toastTimer.current);
    setToast({ text, at: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  const patch = useCallback((fn) => setState((s) => ({ ...s, ...fn(s) })), []);

  const actions = useMemo(() => {
    const push = (chat, msg) =>
      patch((s) => ({ sent: { ...s.sent, [chat]: [...(s.sent[chat] || []), { ...msg, at: Date.now() }] } }));

    return {
      enter: (me) => patch((s) => ({ stage: 'member', me: me ? { ...s.me, ...me } : s.me })),
      leave: () => {
        setState(fresh());
      },
      updateMe: (p) => patch((s) => ({ me: { ...s.me, ...p } })),

      setRegion: (region) => {
        patch((s) => ({ me: { ...s.me, region, city: REGIONS[region].name } }));
        say(`Вы ${REGIONS[region].loc} — афиша и услуги подстроены`);
      },

      /* Слот часов или курса меняется на выбранный; если выбранное уже
         стоит в другом слоте — они меняются местами, дублей не бывает. */
      setSlot: (field, slot, value) =>
        patch((s) => {
          const list = [...s[field]];
          const was = list.indexOf(value);
          if (was >= 0) list[was] = list[slot];
          list[slot] = value;
          return { [field]: list };
        }),

      toggleCircle: (id) =>
        patch((s) => ({ circle: s.circle.includes(id) ? s.circle.filter((x) => x !== id) : [...s.circle, id] })),

      toggleGoing: (id) =>
        patch((s) => {
          const going = { ...s.going };
          if (going[id]) delete going[id];
          else going[id] = true;
          return { going };
        }),

      askClosed: (id) => patch((s) => ({ asked: { ...s.asked, [id]: Date.now() } })),

      toggleJoin: (id) =>
        patch((s) => ({ joined: s.joined.includes(id) ? s.joined.filter((x) => x !== id) : [...s.joined, id] })),

      markRead: (chat) => patch((s) => (s.read[chat] ? {} : { read: { ...s.read, [chat]: Date.now() } })),

      send: (chat, text, { reply } = {}) => {
        push(chat, { from: 'me', text });
        // команда клуба отвечает сама, люди — иногда, чтобы переписка была живой
        const answer = chat === 'team' ? TEAM_REPLY : reply;
        if (answer) setTimeout(() => push(chat, { from: 'them', text: answer }), 1400);
      },

      /* Взаимность в демо решается детерминированно от человека и недели,
         поэтому ответ известен сразу и не меняется при перезапуске. */
      meetAnswer: (id, like) => {
        const result = !like ? 'skipped' : seeded(id + weekKey())() > 0.35 ? 'matched' : 'liked';
        patch((s) => ({
          meet: { ...s.meet, status: { ...s.meet.status, [id]: result } },
          circle: result === 'matched' && !s.circle.includes(id) ? [...s.circle, id] : s.circle,
        }));
        return result;
      },
      meetRestart: () => patch((s) => ({ meet: { ...s.meet, status: {} } })),

      order: (company, offer, note) =>
        patch((s) => ({ orders: [{ id: `o${Date.now()}`, company, offer, note, at: Date.now() }, ...s.orders] })),

      watch: (id) => patch((s) => ({ watched: { ...s.watched, [id]: true } })),
      hide: (key) => patch((s) => ({ hidden: { ...s.hidden, [key]: true } })),
    };
  }, [patch, say]);

  const value = useMemo(() => ({ ...state, ...actions, say, toast }), [state, actions, say, toast]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useApp = () => useContext(Ctx);
