import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { LESSONS, PRODUCTS, GROUPS, SEED_POSTS, LEVELS, TYPE_META, COURSES } from '../data/content.js';
import { buildProgram } from './matching.js';

const KEY = 'eva.state.v2';

const EMPTY = {
  onboarded: false,
  name: '',
  answers: {},
  program: null,
  done: {},            // "день:idУрока" -> время выполнения
  points: 0,
  bonus: 0,            // бонусные рубли
  purchases: [],       // купленные курсы
  cart: {},            // id товара -> количество
  orders: [],
  posts: [],           // свои посты в сообществе
  likes: {},
  joined: ['gr2'],
  customGroups: [],
  cycle: null,         // { last: 'YYYY-MM-DD', length: 28, period: 5 }
  customLessons: [],
  customProducts: [],
  chat: [],
  favorites: {},
  createdAt: null,
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    return { ...EMPTY };
  }
}

function save(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* приватный режим — молча продолжаем */
  }
}

function reducer(state, a) {
  switch (a.type) {
    case 'name':
      return { ...state, name: a.value };

    case 'answer': {
      const q = a.q;
      const cur = state.answers[q.id] || [];
      let next;
      if (cur.includes(a.optId)) next = cur.filter((x) => x !== a.optId);
      else if (q.max === 1) next = [a.optId];
      else next = cur.length >= q.max ? [...cur.slice(1), a.optId] : [...cur, a.optId];
      return { ...state, answers: { ...state.answers, [q.id]: next } };
    }

    case 'finish': {
      const all = [...LESSONS, ...state.customLessons];
      return {
        ...state,
        onboarded: true,
        createdAt: state.createdAt || Date.now(),
        program: buildProgram(state.answers, all),
        points: state.points || 200,
        bonus: state.bonus || 300,
      };
    }

    case 'rebuild': {
      const all = [...LESSONS, ...state.customLessons];
      return { ...state, program: buildProgram(state.answers, all), toast: 'Программа пересобрана под твои ответы' };
    }

    case 'complete': {
      const k = `${a.day}:${a.lessonId}`;
      if (state.done[k]) return state;
      const pts = TYPE_META[a.lessonType]?.points || 10;
      const done = { ...state.done, [k]: Date.now() };

      // бонус за полностью закрытый день
      const day = state.program?.days?.[a.day];
      let extra = 0;
      let toast = `+${pts} баллов`;
      if (day) {
        const ids = [day.affirmation, day.practice, day.masterclass];
        if (ids.every((id) => done[`${a.day}:${id}`])) {
          extra += 30;
          toast = 'День закрыт полностью! +30 бонусных баллов';
        }
        // бонус за всю неделю
        const allDone = (state.program.days || []).every((d, i) =>
          [d.affirmation, d.practice, d.masterclass].every((id) => done[`${i}:${id}`])
        );
        if (allDone) {
          extra += 200;
          toast = 'Суперзвезда недели! +200 баллов';
        }
      }
      const gained = pts + extra;
      return {
        ...state,
        done,
        points: state.points + gained,
        bonus: state.bonus + Math.round(gained * 0.2),
        toast,
        celebrate: (state.celebrate || 0) + 1,
      };
    }

    case 'uncomplete': {
      const k = `${a.day}:${a.lessonId}`;
      if (!state.done[k]) return state;
      const done = { ...state.done };
      delete done[k];
      const pts = TYPE_META[a.lessonType]?.points || 10;
      return { ...state, done, points: Math.max(0, state.points - pts) };
    }

    case 'fav': {
      const f = { ...state.favorites };
      if (f[a.id]) delete f[a.id];
      else f[a.id] = true;
      return { ...state, favorites: f, toast: f[a.id] ? 'Добавлено в избранное' : 'Убрано из избранного' };
    }

    case 'cart': {
      const cart = { ...state.cart };
      cart[a.id] = (cart[a.id] || 0) + (a.qty ?? 1);
      if (cart[a.id] <= 0) delete cart[a.id];
      return { ...state, cart, toast: a.qty === -1 ? undefined : 'Добавлено в корзину' };
    }

    case 'cartRemove': {
      const cart = { ...state.cart };
      delete cart[a.id];
      return { ...state, cart };
    }

    case 'checkout': {
      const order = { id: 'o' + Date.now(), items: a.items, total: a.total, usedBonus: a.usedBonus, at: Date.now() };
      return {
        ...state,
        cart: {},
        orders: [order, ...state.orders],
        bonus: state.bonus - a.usedBonus + Math.round(a.total * 0.05),
        points: state.points + Math.round(a.total / 100),
        toast: 'Заказ оформлен! Начислен кэшбэк баллами',
        celebrate: (state.celebrate || 0) + 1,
      };
    }

    case 'buyCourse': {
      if (state.purchases.includes(a.id)) return state;
      return {
        ...state,
        purchases: [...state.purchases, a.id],
        points: state.points + 150,
        toast: 'Курс открыт! +150 баллов',
        celebrate: (state.celebrate || 0) + 1,
      };
    }

    case 'post': {
      const p = { id: 'u' + Date.now(), group: a.group, author: state.name || 'Ты', hue: 320, text: a.text, ago: 'только что', likes: 0, mine: true };
      return { ...state, posts: [p, ...state.posts], points: state.points + 5, toast: '+5 баллов за активность в сообществе' };
    }

    case 'like': {
      const likes = { ...state.likes };
      if (likes[a.id]) delete likes[a.id];
      else likes[a.id] = true;
      return { ...state, likes };
    }

    case 'joinGroup': {
      const joined = state.joined.includes(a.id) ? state.joined.filter((x) => x !== a.id) : [...state.joined, a.id];
      return { ...state, joined, toast: joined.includes(a.id) ? 'Ты вступила в группу' : 'Ты вышла из группы' };
    }

    case 'createGroup': {
      const g = { id: 'cg' + Date.now(), title: a.title, emoji: a.emoji || '✨', members: 1, hue: 320, about: a.about, tags: [], mine: true };
      return { ...state, customGroups: [g, ...state.customGroups], joined: [...state.joined, g.id], toast: 'Группа создана' };
    }

    case 'cycle':
      return { ...state, cycle: a.value, toast: 'Календарь обновлён' };

    case 'addLesson': {
      const l = { ...a.lesson, custom: true };
      const customLessons = [l, ...state.customLessons];
      return { ...state, customLessons, toast: 'Урок добавлен в библиотеку' };
    }

    case 'addProduct':
      return { ...state, customProducts: [{ ...a.product, custom: true }, ...state.customProducts], toast: 'Товар добавлен в маркет' };

    case 'removeCustom': {
      if (a.kind === 'lesson') return { ...state, customLessons: state.customLessons.filter((l) => l.id !== a.id), toast: 'Урок удалён' };
      return { ...state, customProducts: state.customProducts.filter((p) => p.id !== a.id), toast: 'Товар удалён' };
    }

    case 'chat':
      return { ...state, chat: [...state.chat, a.message] };

    case 'clearChat':
      return { ...state, chat: [] };

    case 'toast':
      return { ...state, toast: a.value };

    case 'clearToast':
      return { ...state, toast: undefined };

    case 'reset':
      return { ...EMPTY };

    default:
      return state;
  }
}

const Ctx = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const { toast, celebrate, ...persist } = state;
    save(persist);
  }, [state]);

  const value = useMemo(() => {
    const allLessons = [...state.customLessons, ...LESSONS];
    const allProducts = [...state.customProducts, ...PRODUCTS];
    const allGroups = [...state.customGroups, ...GROUPS];
    const allPosts = [...state.posts, ...SEED_POSTS];
    return { state, dispatch, allLessons, allProducts, allGroups, allPosts };
  }, [state]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore вне StoreProvider');
  return v;
}

/* ---------------- Производные данные ---------------- */

export function levelOf(points) {
  let idx = 0;
  LEVELS.forEach((l, i) => {
    if (points >= l.from) idx = i;
  });
  const current = LEVELS[idx];
  const next = LEVELS[idx + 1];
  const progress = next ? Math.min(1, (points - current.from) / (next.from - current.from)) : 1;
  return { current, next, progress, index: idx };
}

export function todayIndex(program) {
  if (!program?.createdAt) return 0;
  const d = Math.floor((Date.now() - program.createdAt) / 86400000);
  return Math.max(0, Math.min(6, d));
}

export function dayStars(state, dayIdx) {
  const day = state.program?.days?.[dayIdx];
  if (!day) return 0;
  return [day.affirmation, day.practice, day.masterclass].filter((id) => state.done[`${dayIdx}:${id}`]).length;
}

export function totalStars(state) {
  let s = 0;
  for (let i = 0; i < 7; i++) s += dayStars(state, i);
  return s;
}

export function isSuperStar(state) {
  return totalStars(state) === 21;
}

export function weekReport(state) {
  const days = [];
  let stars = 0;
  let minutes = 0;
  const byType = { affirmation: 0, practice: 0, masterclass: 0 };
  const lessons = [...state.customLessons, ...LESSONS];
  for (let i = 0; i < 7; i++) {
    const d = state.program?.days?.[i];
    const s = dayStars(state, i);
    stars += s;
    days.push(s);
    if (d) {
      [['affirmation', d.affirmation], ['practice', d.practice], ['masterclass', d.masterclass]].forEach(([t, id]) => {
        if (state.done[`${i}:${id}`]) {
          byType[t]++;
          minutes += lessons.find((l) => l.id === id)?.min || 0;
        }
      });
    }
  }
  const fullDays = days.filter((s) => s === 3).length;
  const earned =
    byType.affirmation * TYPE_META.affirmation.points +
    byType.practice * TYPE_META.practice.points +
    byType.masterclass * TYPE_META.masterclass.points +
    fullDays * 30 +
    (stars === 21 ? 200 : 0);
  return { days, stars, fullDays, minutes, byType, earned, super: stars === 21 };
}

export function referralIncome(refs) {
  return refs.reduce((s, r) => s + Math.round(r.spent * 0.1), 0);
}

export function courseProgressStub(id) {
  const c = COURSES.find((x) => x.id === id);
  return c ? c.lessons.length : 0;
}
