import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { ME_DEFAULT, RESIDENTS } from '../data/people.js';
import { DEGREES, PASSPHRASES, TIERS } from '../data/canon.js';
import { linkChain } from './chain.js';
import { portfolio } from './nav.js';
import { residentNumber, seeded } from './art.js';

const KEY = 'upass.v1';

const EMPTY = {
  stage: 'guest',            // guest → review → approved → member
  me: { ...ME_DEFAULT },
  appliedAt: null,
  joinedAt: null,
  oath: false,
  points: 0,
  uht: 0,
  invested: 0,
  connections: [],
  going: [],
  bookings: [],
  votes: {},
  circles: [],
  messages: {},
  requests: [],
  rep: [],
  secret: false,
  heirs: [],
  visibility: 'all',
  extraSpend: [],
  trips: [],
  seen: {},
};

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const saved = JSON.parse(raw);
    return { ...EMPTY, ...saved, me: { ...ME_DEFAULT, ...(saved.me || {}) } };
  } catch {
    return { ...EMPTY };
  }
}

export function StoreProvider({ children }) {
  const [s, setS] = useState(load);
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* приватный режим — работаем без сохранения */
    }
  }, [s]);

  const say = useCallback((text) => {
    setToast(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const patch = useCallback((fn) => setS((prev) => ({ ...prev, ...(typeof fn === 'function' ? fn(prev) : fn) })), []);

  /* --- репутация: журнал только на добавление ---------------------------- */
  const addRep = useCallback((type, subject, extra = {}) => {
    setS((prev) => ({
      ...prev,
      rep: [
        ...prev.rep,
        {
          at: new Date().toISOString().slice(0, 16).replace('T', ' '),
          type,
          subject,
          with: extra.with || '',
          weight: extra.weight ?? 1,
          note: extra.note || '',
        },
      ],
    }));
  }, []);

  /* --- вступление -------------------------------------------------------- */
  const apply = useCallback((form) => {
    setS((prev) => ({
      ...prev,
      stage: 'review',
      appliedAt: Date.now(),
      me: { ...prev.me, ...form },
    }));
  }, []);

  const approve = useCallback(() => setS((prev) => (prev.stage === 'review' ? { ...prev, stage: 'approved' } : prev)), []);

  const payMembership = useCallback(
    (tier) => {
      const now = new Date();
      setS((prev) => ({
        ...prev,
        stage: 'member',
        joinedAt: now.toISOString(),
        points: prev.points + 2000,
        me: { ...prev.me, tier, degree: 1, since: now.getFullYear() },
        rep: [
          ...prev.rep,
          { at: now.toISOString().slice(0, 16).replace('T', ' '), type: 'join', subject: 'me', with: '', weight: 3, note: 'Посвящение и выдача паспорта' },
          { at: now.toISOString().slice(0, 16).replace('T', ' '), type: 'tier', subject: 'me', with: '', weight: 1, note: `Уровень членства ${TIERS.find((t) => t.n === tier)?.name ?? tier}` },
        ],
      }));
      say('Паспорт выдан. Добро пожаловать в круг');
    },
    [say]
  );

  const reset = useCallback(() => {
    localStorage.removeItem(KEY);
    setS({ ...EMPTY });
    window.location.hash = '#/';
  }, []);

  /* --- действия резидента ------------------------------------------------ */
  const connect = useCallback(
    (id) => {
      setS((prev) => {
        if (prev.connections.includes(id)) return prev;
        return { ...prev, connections: [...prev.connections, id], points: prev.points + 50 };
      });
      const p = RESIDENTS.find((r) => r.id === id);
      addRep('connect', 'me', { with: id, weight: 1, note: `Знакомство: ${p?.name || id}` });
      say('Контакт добавлен, +50 баллов');
    },
    [addRep, say]
  );

  const confirmMeet = useCallback(
    (id) => {
      const p = RESIDENTS.find((r) => r.id === id);
      addRep('meet', 'me', { with: id, weight: 3, note: `Подтверждённая встреча: ${p?.name || id}` });
      setS((prev) => ({ ...prev, points: prev.points + 120 }));
      say('Встреча подтверждена обеими сторонами');
    },
    [addRep, say]
  );

  const vouch = useCallback(
    (id) => {
      const p = RESIDENTS.find((r) => r.id === id);
      addRep('vouch', 'me', { with: id, weight: 5, note: `Поручительство за ${p?.name || id}` });
      say('Поручительство записано в цепочку навсегда');
    },
    [addRep, say]
  );

  const toggleGoing = useCallback(
    (id, title) => {
      let joined = false;
      setS((prev) => {
        joined = !prev.going.includes(id);
        return {
          ...prev,
          going: joined ? [...prev.going, id] : prev.going.filter((x) => x !== id),
          points: prev.points + (joined ? 80 : 0),
        };
      });
      if (joined) {
        addRep('event', 'me', { weight: 2, note: `Участие: ${title}` });
        say('Записались. +80 баллов');
      }
    },
    [addRep, say]
  );

  const book = useCallback(
    (booking) => {
      setS((prev) => ({
        ...prev,
        bookings: [...prev.bookings, { ...booking, id: 'b' + Date.now() }],
        extraSpend: [...prev.extraSpend, { cat: 'Жильё', inside: booking.total, outside: 0 }],
      }));
      addRep('booking', 'me', { weight: 1, note: `Бронь: ${booking.locName}` });
      say('Бронь подтверждена');
    },
    [addRep, say]
  );

  const requestService = useCallback(
    (service, text) => {
      setS((prev) => ({
        ...prev,
        requests: [...prev.requests, { id: 'q' + Date.now(), service: service.id, text, at: Date.now(), status: 'sent' }],
        points: prev.points + Math.round(service.price * service.cashback) / 100,
        extraSpend: [...prev.extraSpend, { cat: 'Услуги и документы', inside: service.price, outside: 0 }],
      }));
      addRep('deal', 'me', { with: service.owner, weight: 2, note: `Заявка: ${service.title}` });
      say('Заявка отправлена партнёру');
    },
    [addRep, say]
  );

  const joinCircle = useCallback(
    (id, name) => {
      setS((prev) => ({
        ...prev,
        circles: prev.circles.includes(id) ? prev.circles.filter((x) => x !== id) : [...prev.circles, id],
      }));
      say(`Вы в круге «${name}»`);
    },
    [say]
  );

  const post = useCallback((circleId, text) => {
    setS((prev) => ({
      ...prev,
      messages: { ...prev.messages, [circleId]: [...(prev.messages[circleId] || []), { text, at: Date.now() }] },
    }));
  }, []);

  const vote = useCallback(
    (proposalId, choice, title) => {
      setS((prev) => ({ ...prev, votes: { ...prev.votes, [proposalId]: choice } }));
      addRep('vote', 'me', { weight: 1, note: `Голос: ${title}` });
      say('Голос учтён');
    },
    [addRep, say]
  );

  const invest = useCallback(
    (usd, tokens) => {
      setS((prev) => ({ ...prev, invested: prev.invested + usd, uht: prev.uht + tokens }));
      addRep('capital', 'me', { weight: 4, note: `Внесено $${Math.round(usd).toLocaleString('ru-RU')} · выпущено ${tokens.toFixed(1)} UHT` });
      say(`Выпущено ${tokens.toFixed(1)} UHT по текущей цене NAV`);
    },
    [addRep, say]
  );

  const spendPoints = useCallback(
    (n, what) => {
      let ok = false;
      setS((prev) => {
        if (prev.points < n) return prev;
        ok = true;
        return { ...prev, points: prev.points - n };
      });
      say(ok ? `Списано ${n} баллов: ${what}` : 'Баллов пока не хватает');
      return ok;
    },
    [say]
  );

  const upgrade = useCallback(
    (tier) => {
      setS((prev) => ({ ...prev, me: { ...prev.me, tier } }));
      addRep('tier', 'me', { weight: 1, note: `Уровень членства повышен до ${TIERS.find((t) => t.n === tier)?.name ?? tier}` });
      say('Уровень членства обновлён');
    },
    [addRep, say]
  );

  const tryPassphrase = useCallback(
    (word) => {
      const ok = PASSPHRASES.includes((word || '').trim().toUpperCase());
      if (ok) {
        setS((prev) => ({ ...prev, secret: true }));
        say('Дверь открыта. Ex umbra in lucem');
      }
      return ok;
    },
    [say]
  );

  const announceTrip = useCallback(
    (trip) => {
      setS((prev) => ({ ...prev, trips: [...prev.trips, { ...trip, id: 't' + Date.now() }] }));
      addRep('trip', 'me', { weight: 1, note: `Объявлена поездка: ${trip.cityName}` });
      say('Поездка объявлена — круг в городе увидит');
    },
    [addRep, say]
  );

  const cancelTrip = useCallback((id) => setS((prev) => ({ ...prev, trips: prev.trips.filter((t) => t.id !== id) })), []);

  const setOath = useCallback((v) => setS((prev) => ({ ...prev, oath: v })), []);
  const setHeirs = useCallback((heirs) => setS((prev) => ({ ...prev, heirs })), []);
  const setMe = useCallback((fields) => setS((prev) => ({ ...prev, me: { ...prev.me, ...fields } })), []);
  const setVisibility = useCallback((v) => setS((prev) => ({ ...prev, visibility: v })), []);
  const markSeen = useCallback((k) => setS((prev) => ({ ...prev, seen: { ...prev.seen, [k]: true } })), []);

  /* --- производные значения ---------------------------------------------- */
  const chain = useMemo(() => linkChain(s.rep), [s.rep]);

  const counts = useMemo(() => {
    const c = { meets: 0, vouches: 0, events: 0, deals: 0 };
    for (const e of s.rep) {
      if (e.type === 'meet') c.meets++;
      if (e.type === 'vouch') c.vouches++;
      if (e.type === 'event') c.events++;
      if (e.type === 'deal') c.deals++;
    }
    return c;
  }, [s.rep]);

  const degree = useMemo(() => {
    if (s.stage !== 'member') return 0;
    let d = 1;
    for (const g of DEGREES) {
      const ok = counts.meets >= g.need.meets && counts.vouches >= g.need.vouches && counts.events >= g.need.events;
      if (ok) d = Math.max(d, g.n);
    }
    return Math.min(d, s.secret ? 6 : 3);
  }, [counts, s.stage, s.secret]);

  const pf = useMemo(() => portfolio(s.invested, s.uht), [s.invested, s.uht]);

  const me = useMemo(
    () => ({
      ...s.me,
      tone: s.me.name ? `hsl(${Math.floor(seeded(s.me.name)() * 360)} 52% 46%)` : s.me.tone,
      id: 'me',
      degree,
      uht: s.uht,
      meets: counts.meets,
      vouches: counts.vouches,
      number: residentNumber(s.me.name || 'guest', s.me.since),
    }),
    [s.me, degree, s.uht, counts]
  );

  const value = {
    ...s,
    me,
    counts,
    degree,
    chain,
    pf,
    toast,
    say,
    patch,
    apply,
    approve,
    payMembership,
    reset,
    connect,
    confirmMeet,
    vouch,
    toggleGoing,
    book,
    requestService,
    joinCircle,
    post,
    vote,
    invest,
    spendPoints,
    upgrade,
    tryPassphrase,
    announceTrip,
    cancelTrip,
    setOath,
    setHeirs,
    setMe,
    setVisibility,
    markSeen,
    addRep,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
