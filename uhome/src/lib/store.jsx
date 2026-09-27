import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_CLOCKS, REGIONS } from '../data/regions.js';
import { DEFAULT_RATES } from '../data/currencies.js';
import { DEFAULT_CIRCLE } from '../data/people.js';
import { TEAM_REPLY } from '../data/chats.js';
import { memberNumber, seeded } from './art.js';
import { reply, assistantOf } from './assistant.js';
import { AVATARS } from '../data/avatars.js';

/* Состояние приложения: один стор, одно место сохранения (localStorage,
   ключ uhome.v2). Экраны не пишут в хранилище напрямую — только через
   действия отсюда. Ключ поднимается, если меняется форма данных. */

const KEY = 'uhome.v2';

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
  // ответы теста: по ним ассистент учится и собирает группы
  assistant: 'eva',
  tone: 'flirt',
  sphere: 'it',
  regionsOften: ['bali', 'moscow', 'dubai'],
  formats: ['coffee', 'sport', 'dinner'],
  tested: false,
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
    intros: {},
    ai: { messages: [], count: 0, memory: { topics: {} } },
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

      markRead: (chat) => patch((s) => ({ read: { ...s.read, [chat]: Date.now() } })),

      send: (chat, text, { reply, who } = {}) => {
        push(chat, { from: 'me', text });
        // команда клуба отвечает сама, люди — иногда, чтобы переписка была живой
        const answer = chat === 'team' ? TEAM_REPLY : reply;
        if (answer) setTimeout(() => push(chat, { from: 'them', text: answer, ...(who ? { who } : {}) }), 1400);
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

      finishTest: (answers) => patch((s) => ({ me: { ...s.me, ...answers, tested: true } })),

      /* Ассистент: вопрос уходит сразу, ответ — через «печатает…».
         Каждая тема запоминается: так он учится, что вам важно. */
      aiAsk: (text) => {
        patch((s) => ({ ai: { ...s.ai, messages: [...s.ai.messages, { from: 'me', text, at: Date.now() }] } }));
        setTimeout(() => {
          patch((s) => {
            const r = reply(s, text);
            const topics = { ...s.ai.memory.topics, [r.topic]: (s.ai.memory.topics[r.topic] || 0) + 1 };
            const handoff = r.handoff
              ? { sent: { ...s.sent, team: [...(s.sent.team || []), { from: 'me', text: `Вопрос через ассистента: ${text}`, at: Date.now() }] } }
              : {};
            return {
              ...handoff,
              ai: { messages: [...s.ai.messages, { from: 'ai', ...r, at: Date.now() }], count: s.ai.count + 1, memory: { ...s.ai.memory, topics } },
            };
          });
        }, 900);
      },
      aiOpen: () =>
        patch((s) => (s.ai.messages.length ? {} : { ai: { ...s.ai, messages: [{ from: 'ai', ...reply(s, 'привет'), at: Date.now() }] } })),
      aiReset: () => patch(() => ({ ai: { messages: [], count: 0, memory: { topics: {} } } })),

      /* Интро: ассистент пишет обоим, почему стоит поговорить, открывает
         общий чат и кладёт человека в ближний круг. */
      intro: (pid, why) => {
        patch((s) => {
          const A = assistantOf(s);
          const note = `${A.name} ${A.she ? 'познакомила' : 'познакомил'} вас. ${why || ''}`.trim();
          return {
            intros: { ...s.intros, [pid]: Date.now() },
            circle: s.circle.includes(pid) ? s.circle : [...s.circle, pid],
            sent: { ...s.sent, [pid]: [...(s.sent[pid] || []), { from: 'sys', text: note, at: Date.now() }] },
          };
        });
        setTimeout(() => patch((s) => {
          const A = AVATARS[s.me.assistant] || AVATARS.eva;
          const text = `Привет! ${A.name} ${A.she ? 'рассказала' : 'рассказал'} о вас — кажется, нам есть что обсудить. Созвонимся на неделе?`;
          return { sent: { ...s.sent, [pid]: [...(s.sent[pid] || []), { from: 'them', text, at: Date.now() }] }, read: { ...s.read, [pid]: 0 } };
        }), 2200);
      },

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
