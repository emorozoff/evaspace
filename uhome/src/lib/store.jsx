import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_CLOCKS, REGIONS } from '../data/regions.js';
import { DEFAULT_RATES } from '../data/currencies.js';
import { DEFAULT_CIRCLE } from '../data/people.js';
import { TEAM_REPLY, CLOSED_REPLY, APPLICANT_WELCOME } from '../data/chats.js';
import { localOf } from '../data/communities.js';
import { eventById } from '../data/events.js';
import { memberNumber, seeded } from './art.js';
import { reply, assistantOf } from './assistant.js';
import { whenLabel, firstName } from './format.js';
import { AVATARS } from '../data/avatars.js';

/* Состояние приложения: один стор, одно место сохранения (localStorage,
   ключ uhome.v2). Экраны не пишут в хранилище напрямую — только через
   действия отсюда. Ключ поднимается, если меняется форма данных.

   Два входа: enter() — демо-резидент Андрей с готовым профилем, кругом,
   переписками и записями (demo: true); apply(me) — кандидат, подавший
   заявку: чистый профиль из трёх ответов анкеты, без чужих чатов, записей
   и ответов теста (demo: false). enter(me) — то же, что apply(me). */

const KEY = 'uhome.v2';

/* Пустой профиль — с него начинается кандидат. Тон нейтральный («тёплый»),
   ассистент — Ева, ответов теста нет: их даст сам тест. */
export const BLANK_ME = {
  id: 'me',
  name: '',
  role: 'Резидент',
  title: '',
  company: '',
  region: 'bali',
  city: '',
  since: new Date().getFullYear(),
  about: '',
  gives: [],
  needs: [],
  interests: [],
  goals: [],
  langs: ['RU'],
  assistant: 'eva',
  tone: 'warm',
  sphere: undefined,
  regionsOften: [],
  formats: [],
  tested: false,
};

export const DEMO_ME = {
  ...BLANK_ME,
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
  tone: 'warm',
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

const freshAi = () => ({ messages: [], count: 0, memory: { topics: {} } });

/* Демо-резидент: заполненный профиль, круг, записи и переписки — чтобы
   приложение можно было посмотреть живым. */
function fresh() {
  return {
    stage: 'welcome',
    demo: true,
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
    ai: freshAi(),
  };
}

/* Кандидат: только то, что он сам сказал в анкете. Ни чужих переписок,
   ни записей на события, ни ответов теста — их нет, пока он их не даст.
   В круге пока только команда клуба (она закреплена в select.js), из
   сообществ — локальное своего региона, в чате команды — ответ на заявку. */
export function applicantState(form = {}) {
  // пустые поля анкеты не затирают чистый профиль: тон, ассистент и ответы теста берутся из BLANK_ME
  const given = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== '' && v != null && !(Array.isArray(v) && !v.length)));
  const region = REGIONS[given.region] ? given.region : 'bali';
  const me = { ...BLANK_ME, ...given, region, tested: !!given.tested };
  if (!me.city) me.city = REGIONS[region].name;
  if (!me.number) me.number = memberNumber(me.name || 'applicant', me.since);
  const now = Date.now();
  return {
    ...fresh(),
    stage: 'member',
    demo: false,
    me,
    circle: [],
    going: {},
    joined: [localOf(region)?.id].filter(Boolean),
    sent: { team: [{ from: 'them', who: 'Анна · менеджер клуба', text: APPLICANT_WELCOME(firstName(me.name)), at: now }] },
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

    /** Кандидат подал заявку: чистое состояние с его ответами. */
    const apply = (form) => setState(applicantState(form));

    return {
      /** Вход демо-резидента. С аргументом — то же, что apply(me) (совместимость). */
      enter: (me) => (me ? apply(me) : patch(() => ({ stage: 'member' }))),
      apply,
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

      /* Заявка на закрытое событие: отметка на событии плюс сообщение
         в чат команды — и ответ команды через пару секунд, чтобы обещание
         «придёт сообщение» было правдой. */
      askClosed: (id) => {
        const e = eventById(id);
        patch((s) => ({ asked: { ...s.asked, [id]: Date.now() } }));
        if (e) {
          push('team', { from: 'me', text: `Заявка на «${e.title}» — ${whenLabel(e.inDays, e.time)}.` });
          setTimeout(() => push('team', { from: 'them', text: CLOSED_REPLY }), 1800);
        }
      },

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
              ai: { ...s.ai, messages: [...s.ai.messages, { from: 'ai', ...r, at: Date.now() }], count: s.ai.count + 1, memory: { ...s.ai.memory, topics }, seen: true },
            };
          });
        }, 900);
      },
      aiOpen: () =>
        patch((s) => (s.ai.messages.length ? {} : { ai: { ...s.ai, seen: true, messages: [{ from: 'ai', ...reply(s, 'привет'), at: Date.now() }] } })),
      // «забыть чат»: история и память тем очищаются, но приглашение «1» не возвращается (seen)
      aiReset: () => patch(() => ({ ai: { ...freshAi(), seen: true } })),

      /* Интро: ассистент пишет обоим, почему стоит поговорить, открывает
         общий чат и кладёт человека в ближний круг. Отметка прочтения
         не трогается: новое сообщение и так новее неё, а старые
         непрочитанные не должны воскресать. */
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
          return { sent: { ...s.sent, [pid]: [...(s.sent[pid] || []), { from: 'them', text, at: Date.now() }] } };
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
