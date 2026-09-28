import { useState } from 'react';
import { go } from '../lib/router.jsx';
import { reasons } from '../lib/intro.js';
import { assistantOf } from '../lib/assistant.js';
import { messagesOf } from '../lib/select.js';
import { whenLabel, plural, relDayIn } from '../lib/format.js';
import { EVENTS } from '../data/events.js';
import { REGIONS } from '../data/regions.js';
import { TRIPS, firstNameOf } from '../data/people.js';
import { Avatar } from './Art.jsx';
import { Section } from './UI.jsx';

/* Знакомства недели на главной: три строки — человек, одна причина,
   польза цифрой и одно действие. «Познакомить» — ассистент пишет обоим и
   открывает общий чат; с кем переписка уже есть — просто «Написать».
   Кого познакомили — уходит из списка, на его место встаёт следующий. */

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/* Причина одной строкой: имя уже стоит выше, поэтому здесь только суть. */
function short(r, region) {
  const p = r.p;
  if (r.kind === 'arrival') {
    const t = TRIPS.find((x) => x.who === p.id && x.to === region);
    if (t) return `Прилетает ${REGIONS[t.to].loc} ${relDayIn(t.inDays)}, на ${t.days} ${plural(t.days, 'день', 'дня', 'дней')}`;
  }
  if (r.kind === 'event') {
    const e = EVENTS.find((x) => x.id === r.eventId);
    if (e) return `Вы оба идёте на «${e.title}» — ${whenLabel(e.inDays, e.time).toLowerCase()}`;
  }
  if (r.kind === 'fresh') {
    const d = p.joined;
    return `В клубе ${d <= 1 ? 'с сегодняшнего дня' : `${d} ${plural(d, 'день', 'дня', 'дней')}`} — круг только складывается`;
  }
  const t = r.text.replace(/\.$/, '');
  const name = firstNameOf(p);
  return t.startsWith(name + ' ') ? cap(t.slice(name.length + 1)) : t;
}

export function introduce(app, p, why) {
  const A = assistantOf(app);
  app.intro(p.id, why);
  app.say(`${A.name} ${A.she ? 'написала' : 'написал'} вам обоим — ответ придёт в чат`);
}

/** С кем переписка уже идёт — знакомить не нужно, достаточно написать. */
export const hasChat = (app, id) => app.circle.includes(id) && messagesOf(app, id).length > 0;

function IntroRow({ app, r }) {
  const p = r.p;
  const [leaving, setLeaving] = useState(false);
  const chat = hasChat(app, p.id);
  const intro = () => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(() => introduce(app, p, r.why), 300);
  };
  const profile = () => go(`/p/${p.id}`);
  return (
    <div className={`item h-intro${leaving ? ' h-intro--out' : ''}`}>
      <button className="h-intro__who" onClick={profile} aria-label={`Открыть профиль: ${p.name}`}>
        <Avatar person={p} size={44} dot={p.online} />
      </button>
      <button className="item__body h-intro__body" onClick={profile}>
        <span className="item__t">{p.name}</span>
        <span className="item__s item__s--wrap clamp-2">{short(r, app.me.region)}</span>
      </button>
      <span className="item__meta h-intro__meta">
        <span className="h-num">{r.pct}%</span>
        {chat
          ? <button className="h-intro__act" onClick={() => go(`/chat/${p.id}`)}>Написать</button>
          : <button className="h-intro__act" onClick={intro}>Познакомить</button>}
      </span>
    </div>
  );
}

export default function Intros({ app, limit = 3 }) {
  const week = reasons(app, 7);
  const A = assistantOf(app);
  if (!week.length) return null;
  const n = week.length;
  return (
    <Section title="Знакомства" note={`${A.name} ${A.found} ${n} ${plural(n, 'человека', 'человека', 'человек')} на этой неделе`}>
      <div className="list">
        {week.slice(0, limit).map((r) => <IntroRow key={r.id} app={app} r={r} />)}
        <button className="item h-intro__more" onClick={() => go('/people?tab=meet')}>Все знакомства →</button>
      </div>
    </Section>
  );
}
