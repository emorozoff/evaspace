import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ME_DEFAULT, RESIDENTS } from '../data/people.js';
import { DEGREES, PASSPHRASES, TIERS } from '../data/canon.js';
import { REGIONS } from '../data/regions.js';
import { linkChain } from './chain.js';
import { residentNumber, seeded } from './art.js';

const KEY = 'upass.v3';

const EMPTY = {
  stage: 'guest',            // guest → review → approved → member
  me: { ...ME_DEFAULT },
  appliedAt: null,
  joinedAt: null,
  oath: false,
  connections: [],
  going: [],
  communities: [],
  messages: {},
  dms: {},
  requests: [],              // свои запросы в ленте
  replies: {},               // ответы на чужие запросы
  trips: [],
  rep: [],
  secret: false,
  visibility: 'all',
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
  const snap = useRef(s);
  snap.current = s;

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

  const addRep = useCallback((type, extra = {}) => {
    setS((prev) => ({
      ...prev,
      rep: [
        ...prev.rep,
        {
          at: new Date().toISOString().slice(0, 16).replace('T', ' '),
          type,
          subject: 'me',
          with: extra.with || '',
          weight: extra.weight ?? 1,
          note: extra.note || '',
        },
      ],
    }));
  }, []);

  /* ——— вступление ——— */
  const apply = useCallback((form) => {
    setS((prev) => ({ ...prev, stage: 'review', appliedAt: Date.now(), me: { ...prev.me, ...form } }));
  }, []);

  const approve = useCallback(() => setS((prev) => (prev.stage === 'review' ? { ...prev, stage: 'approved' } : prev)), []);

  const payMembership = useCallback(() => {
    const now = new Date();
    const at = now.toISOString().slice(0, 16).replace('T', ' ');
    setS((prev) => ({
      ...prev,
      stage: 'member',
      joinedAt: now.toISOString(),
      me: { ...prev.me, tier: 1, degree: 1, since: now.getFullYear() },
      rep: [
        ...prev.rep,
        { at, type: 'join', subject: 'me', with: '', weight: 3, note: 'Принят в сообщество, паспорт выдан' },
      ],
    }));
    say('Паспорт выдан. Добро пожаловать');
  }, [say]);

  const reset = useCallback(() => {
    localStorage.removeItem(KEY);
    setS({ ...EMPTY });
    window.location.hash = '#/';
  }, []);

  /* ——— люди ——— */
  const connect = useCallback(
    (id) => {
      if (snap.current.connections.includes(id)) return;
      setS((prev) => ({ ...prev, connections: [...new Set([...prev.connections, id])] }));
      const p = RESIDENTS.find((r) => r.id === id);
      addRep('connect', { with: id, weight: 1, note: `Знакомство: ${p?.name || id}` });
      say('Контакт добавлен');
    },
    [addRep, say]
  );

  const confirmMeet = useCallback(
    (id) => {
      const p = RESIDENTS.find((r) => r.id === id);
      addRep('meet', { with: id, weight: 3, note: `Подтверждённая встреча: ${p?.name || id}` });
      say('Встреча подтверждена обеими сторонами');
    },
    [addRep, say]
  );

  const vouch = useCallback(
    (id) => {
      const p = RESIDENTS.find((r) => r.id === id);
      addRep('vouch', { with: id, weight: 5, note: `Поручительство за ${p?.name || id}` });
      say('Поручительство записано навсегда');
    },
    [addRep, say]
  );

  /* ——— мероприятия ——— */
  const toggleGoing = useCallback(
    (id, title) => {
      const joining = !snap.current.going.includes(id);
      setS((prev) => ({ ...prev, going: joining ? [...new Set([...prev.going, id])] : prev.going.filter((x) => x !== id) }));
      if (joining) {
        addRep('event', { weight: 2, note: `Участие: ${title}` });
        say('Записались');
      }
    },
    [addRep, say]
  );

  /* ——— сообщества и переписки ——— */
  const joinCommunity = useCallback(
    (id, name) => {
      const joining = !snap.current.communities.includes(id);
      setS((prev) => ({
        ...prev,
        communities: joining ? [...new Set([...prev.communities, id])] : prev.communities.filter((x) => x !== id),
      }));
      say(joining ? `Вы в сообществе «${name}»` : `Вышли из «${name}»`);
    },
    [say]
  );

  const post = useCallback((communityId, text) => {
    setS((prev) => ({
      ...prev,
      messages: { ...prev.messages, [communityId]: [...(prev.messages[communityId] || []), { text, at: Date.now() }] },
    }));
  }, []);

  const sendDm = useCallback((personId, text) => {
    setS((prev) => ({
      ...prev,
      dms: { ...prev.dms, [personId]: [...(prev.dms[personId] || []), { text, at: Date.now() }] },
    }));
  }, []);

  /* ——— запросы ——— */
  const ask = useCallback(
    ({ text, tags, region }) => {
      const id = 'my' + Date.now();
      setS((prev) => ({ ...prev, requests: [{ id, text, tags, region, at: Date.now() }, ...prev.requests] }));
      addRep('request', { weight: 1, note: 'Запрос сообществу' });
      say('Запрос опубликован — ответы придут в ленту и в личку');
      return id;
    },
    [addRep, say]
  );

  const replyTo = useCallback(
    (requestId, text) => {
      setS((prev) => ({
        ...prev,
        replies: { ...prev.replies, [requestId]: [...(prev.replies[requestId] || []), { text, at: Date.now() }] },
      }));
      addRep('reply', { weight: 1, note: 'Ответ на запрос резидента' });
      say('Ответ отправлен');
    },
    [addRep, say]
  );

  const dropRequest = useCallback((id) => setS((prev) => ({ ...prev, requests: prev.requests.filter((r) => r.id !== id) })), []);

  /* ——— поездки ——— */
  const announceTrip = useCallback(
    (trip) => {
      setS((prev) => ({ ...prev, trips: [...prev.trips, { ...trip, id: 't' + Date.now() }] }));
      addRep('trip', { weight: 1, note: `Поездка: ${REGIONS[trip.region]?.name || trip.region}` });
      say('Поездка объявлена — сообщество в регионе увидит');
    },
    [addRep, say]
  );

  const cancelTrip = useCallback((id) => setS((prev) => ({ ...prev, trips: prev.trips.filter((t) => t.id !== id) })), []);

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

  const setOath = useCallback((v) => setS((prev) => ({ ...prev, oath: v })), []);
  const setMe = useCallback((fields) => setS((prev) => ({ ...prev, me: { ...prev.me, ...fields } })), []);
  const setRegion = useCallback(
    (key) => {
      setS((prev) => ({ ...prev, me: { ...prev.me, city: key } }));
      say(`Регион: ${REGIONS[key]?.name || key}`);
    },
    [say]
  );
  const setVisibility = useCallback((v) => setS((prev) => ({ ...prev, visibility: v })), []);
  const markSeen = useCallback((k) => setS((prev) => ({ ...prev, seen: { ...prev.seen, [k]: true } })), []);

  /* ——— производные ——— */
  const chain = useMemo(() => linkChain(s.rep), [s.rep]);

  const counts = useMemo(() => {
    const c = { meets: 0, vouches: 0, events: 0, replies: 0 };
    for (const e of s.rep) {
      if (e.type === 'meet') c.meets++;
      if (e.type === 'vouch') c.vouches++;
      if (e.type === 'event') c.events++;
      if (e.type === 'reply') c.replies++;
    }
    return c;
  }, [s.rep]);

  const degree = useMemo(() => {
    if (s.stage !== 'member') return 0;
    let d = 1;
    for (const g of DEGREES) {
      if (counts.meets >= g.need.meets && counts.vouches >= g.need.vouches && counts.events >= g.need.events) d = Math.max(d, g.n);
    }
    return Math.min(d, s.secret ? 6 : 3);
  }, [counts, s.stage, s.secret]);

  const me = useMemo(
    () => ({
      ...s.me,
      id: 'me',
      degree,
      meets: counts.meets,
      vouches: counts.vouches,
      tone: s.me.name ? `hsl(${Math.floor(seeded(s.me.name)() * 360)} 52% 48%)` : s.me.tone,
      number: residentNumber(s.me.name || 'guest', s.me.since),
    }),
    [s.me, degree, counts]
  );

  const value = {
    ...s,
    me,
    counts,
    degree,
    chain,
    toast,
    say,
    apply,
    approve,
    payMembership,
    reset,
    connect,
    confirmMeet,
    vouch,
    toggleGoing,
    joinCommunity,
    post,
    sendDm,
    ask,
    replyTo,
    dropRequest,
    announceTrip,
    cancelTrip,
    tryPassphrase,
    setOath,
    setMe,
    setRegion,
    setVisibility,
    markSeen,
    addRep,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
