import { useRef, useState } from 'react';
import { go } from '../lib/router.jsx';
import { reasons } from '../lib/intro.js';
import { assistantOf } from '../lib/assistant.js';
import { whenLabel, plural, dayShift, dateLong } from '../lib/format.js';
import { EVENTS } from '../data/events.js';
import { REGIONS } from '../data/regions.js';
import { TRIPS, firstNameOf } from '../data/people.js';
import { Avatar } from './Art.jsx';
import { AvatarPortrait } from './AvatarArt.jsx';
import { Section } from './UI.jsx';
import Icon from './Icons.jsx';
import { Ring, CountUp, useInView } from './home/Gauge.jsx';

/* Знакомства дня: одна панель, три человека. У каждого — кольцо
   «польза» вокруг аватара (прорисовывается, цифра досчитывается, когда
   блок входит в экран), вид повода моноширинным, одна строка причины и
   два действия: «познакомить» — ассистент пишет обоим и открывает общий
   чат; «написать» — сразу в личку. Кого познакомили — уходит из списка,
   на его место встаёт следующий. */

const KIND = {
  event: { label: 'На одном событии', icon: 'calendar', tone: 'gold' },
  arrival: { label: 'Прилетает', icon: 'plane', tone: 'blue' },
  city: { label: 'Рядом', icon: 'pin', tone: 'sea' },
  need: { label: 'Закроет запрос', icon: 'handshake', tone: 'violet' },
  fresh: { label: 'Новичок', icon: 'star', tone: 'rose' },
};

/* Знак «познакомить»: два человека-узла, связь между ними пунктиром
   и плюс — ассистент проводит линию. */
function Connect() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <circle cx="5.5" cy="15.5" r="2.6" />
      <circle cx="18.5" cy="15.5" r="2.6" />
      <path d="M8 14c2.2-3.6 5.8-3.6 8 0" strokeDasharray="1.6 2.2" />
      <path d="M12 3.6v4.8M9.6 6h4.8" />
    </svg>
  );
}

/* Причина одной строкой: вид повода уже написан над именем, поэтому
   здесь — только суть (какое событие, когда, что даёт). */
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const ON_DAY = ['в воскресенье', 'в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу'];
const onDay = (d) => (d === 0 ? 'сегодня' : d === 1 ? 'завтра' : d === 2 ? 'послезавтра' : d < 7 ? ON_DAY[dayShift(d).getDay()] : dateLong(dayShift(d)));

function short(r, region) {
  const p = r.p;
  if (r.kind === 'arrival') {
    const t = TRIPS.find((x) => x.who === p.id && x.to === region);
    if (t) return `${cap(REGIONS[t.to].loc)} ${onDay(t.inDays)}, на ${t.days} ${plural(t.days, 'день', 'дня', 'дней')}`;
  }
  if (r.kind === 'event') {
    const e = EVENTS.find((x) => x.id === r.eventId);
    if (e) return `${whenLabel(e.inDays, e.time)} · «${e.title}»`;
  }
  if (r.kind === 'fresh') {
    const d = p.joined;
    return `В клубе ${d <= 1 ? 'с сегодняшнего дня' : `${d} ${plural(d, 'день', 'дня', 'дней')}`} — круг только складывается`;
  }
  // «Денис тоже на Бали…», «Камила даёт то, что…» — имя уже стоит строкой выше
  const t = r.text.replace(/\.$/, '');
  const name = firstNameOf(p);
  return t.startsWith(name + ' ') ? cap(t.slice(name.length + 1)) : t;
}

export function introduce(app, p, why) {
  const A = assistantOf(app);
  app.intro(p.id, why);
  app.say(`${A.name} ${A.she ? 'написала' : 'написал'} вам обоим — ответ придёт в чат`);
}

/** Строка знакомства — её же можно поставить в любой список. */
export function IntroRow({ app, r, run = true, n = 0, onIntro }) {
  const p = r.p;
  const k = KIND[r.kind] || KIND.fresh;
  const [leaving, setLeaving] = useState(false);
  const intro = () => {
    if (leaving) return;
    setLeaving(true);
    // строка уезжает вправо, потом ассистент знакомит — на её место встаёт следующая
    setTimeout(() => (onIntro ? onIntro(r) : introduce(app, p, r.why)), 320);
  };
  const toProfile = () => go(`/p/${p.id}`);
  return (
    <div className={`hi-row${leaving ? ' hi-row--out' : ''}`} style={{ '--i': n }}>
      <button className="hi-row__who" onClick={toProfile} aria-label={`${p.name}: польза знакомства ${r.pct}%`}>
        <Ring pct={r.pct} size={54} stroke={2} run={run} delay={160 + n * 120}>
          <Avatar person={p} size={36} radius={0.5} />
        </Ring>
        <span className="hi-pill" aria-hidden="true"><CountUp value={r.pct} run={run} delay={160 + n * 120} />%</span>
      </button>
      <button className="hi-row__body" onClick={toProfile} tabIndex={-1}>
        <span className={`hi-kind hi-kind--${k.tone}`}><Icon name={k.icon} size={11} width={1.8} />{k.label}</span>
        <span className="hi-row__name">{p.name}</span>
      </button>
      <span className="hi-row__acts">
        <button className="hi-act hi-act--go" onClick={intro} aria-label={`Познакомить с ${p.name}`} title="Познакомить">
          <Connect />
        </button>
        <button className="hi-act" onClick={() => go(`/chat/${p.id}`)} aria-label={`Написать ${p.name}`} title="Написать">
          <Icon name="message" size={16} width={1.6} />
        </button>
      </span>
      <button className="hi-row__why" onClick={toProfile} tabIndex={-1}>{short(r, app.me.region)}</button>
    </div>
  );
}

export default function Intros({ app, limit = 3, title = 'Знакомства дня' }) {
  const ref = useRef(null);
  const seen = useInView(ref, { threshold: 0.35 });
  const list = reasons(app, limit);
  const A = assistantOf(app);
  if (!list.length) return null;
  return (
    <Section title={title} note={`${A.name} ${A.found} · кольцо — польза знакомства`}>
      <div ref={ref} className={`hi${seen ? ' hi--on' : ''}`}>
        <i className="hi__scan" aria-hidden="true" />
        <div className="hi__rows">
          {list.map((r, n) => <IntroRow key={r.id} app={app} r={r} run={seen} n={n} />)}
        </div>
        <div className="hi__foot">
          <button className="hi__link" onClick={() => go('/people?tab=meet')}>
            Все знакомства<span aria-hidden="true">→</span>
          </button>
          <button className="hi__link hi__link--ai" onClick={() => go('/ai')}>
            <AvatarPortrait who={A.id} size={22} />
            Спросить {A.acc}
          </button>
        </div>
      </div>
    </Section>
  );
}
