import { go } from '../lib/router.jsx';
import { reasons } from '../lib/intro.js';
import { assistantOf } from '../lib/assistant.js';
import { REGIONS } from '../data/regions.js';
import { Avatar } from './Art.jsx';
import { AvatarPortrait } from './AvatarArt.jsx';
import { Section } from './UI.jsx';
import Icon from './Icons.jsx';
import Flag from './Flag.jsx';

/* Поводы познакомиться: каждый день — конкретный человек, конкретная
   причина (одно событие, прилетает к вам, рядом, закроет запрос, новичок)
   и польза знакомства в процентах. «Познакомить» — ассистент пишет
   обоим и открывает общий чат. */

const KIND_ICON = { event: 'calendar', arrival: 'plane', city: 'pin', need: 'handshake', fresh: 'star' };

export function introduce(app, p, why) {
  const A = assistantOf(app);
  app.intro(p.id, why);
  app.say(`${A.name} ${A.she ? 'написала' : 'написал'} вам обоим — ответ придёт в чат`);
}

export function IntroCard({ app, r }) {
  const p = r.p;
  return (
    <div className="intro">
      <div className="spread">
        <span className="intro__kind"><Icon name={KIND_ICON[r.kind] || 'spark'} size={13} />{r.label}</span>
      </div>
      <button className="row" style={{ gap: 12, textAlign: 'left' }} onClick={() => go(`/p/${p.id}`)}>
        <Avatar person={p} size={48} dot={p.online} />
        <span className="grow" style={{ minWidth: 0 }}>
          <span className="t-md ell" style={{ display: 'block', fontWeight: 600 }}>{p.name}</span>
          <span className="t-xs dim-2 ell" style={{ display: 'block', marginTop: 3 }}><Flag cc={REGIONS[p.region].cc} size={13} /> {p.company}</span>
        </span>
        <span className="use"><span className="use__v">{r.pct}%</span><span className="use__l">польза</span></span>
      </button>
      <div className="intro__t">{r.text} {r.why}</div>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn--gold btn--sm grow" onClick={() => introduce(app, p, r.why)}>Познакомить</button>
        <button className="btn btn--ghost btn--sm" onClick={() => go(`/chat/${p.id}`)} aria-label="Написать"><Icon name="message" size={16} /></button>
      </div>
    </div>
  );
}

export default function Intros({ app, limit = 8, title = 'Повод познакомиться' }) {
  const list = reasons(app, limit);
  const A = assistantOf(app);
  if (!list.length) return null;
  return (
    <Section title={title} note={`${A.name} ${A.found} по вашим задачам`}>
      <div className="scroller">
        {list.map((r) => <IntroCard key={r.id} app={app} r={r} />)}
        <button className="intro intro--ai" onClick={() => go('/ai')}>
          <AvatarPortrait who={A.id} size={56} />
          <div className="t-md" style={{ fontWeight: 600 }}>Нужен кто-то конкретный?</div>
          <div className="intro__t" style={{ minHeight: 0 }}>Напишите {A.dat}, кого вы ищете, — {A.pron} знает всех в клубе.</div>
        </button>
      </div>
    </Section>
  );
}
