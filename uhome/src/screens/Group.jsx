import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { groupById } from '../lib/groups.js';
import { match } from '../lib/match.js';
import { whyText } from '../lib/intro.js';
import { unreadOf } from '../lib/select.js';
import { assistantOf } from '../lib/assistant.js';
import { REGIONS } from '../data/regions.js';
import { SPHERES } from '../data/people.js';
import { TopBar, Btn, List, Item, Empty, Section } from '../components/UI.jsx';
import { Avatar } from '../components/Art.jsx';
import { PctRing } from '../components/EventCards.jsx';
import Icon from '../components/Icons.jsx';
import Flag from '../components/Flag.jsx';

/* Мастер-группа: десять резидентов с похожими задачами. Сверху — схема
   связей: вы в центре, участники на орбите; чем полезнее человек вам,
   тем ближе он к центру и ярче линия. Тонкие хорды — общие регионы.
   Ниже — состав списком, у каждого видно, чем он полезен именно вам. */

const SIZE = 300;
const C = SIZE / 2;

export default function Group({ id }) {
  const app = useApp();
  const g = groupById(app.me, id);
  if (!g) return <div className="screen screen--nested"><TopBar backTo="/" /><Empty title="Группа не найдена" /></div>;

  const A = assistantOf(app);
  const people = g.members.map((p) => ({ p, m: match(app.me, p) })).sort((a, b) => b.m.pct - a.m.pct);
  const avg = Math.round(people.reduce((n, x) => n + x.m.pct, 0) / people.length);
  const regions = [...new Set(g.members.map((p) => p.region))];
  const unread = unreadOf(app, id);

  return (
    <div className="screen screen--nested xgr">
      <TopBar title={g.short} sub={g.theme.name} backTo="/" />
      <div className="stack-24">
        <div className="xgr-head">
          <Orbit me={app.me} people={people} />
          <div className="xgr-head__k">Мастер-группа · {people.length + 1} человек</div>
          <h1 className="h2 xgr-head__t">{g.theme.name}</h1>
          <p className="xgr-head__about">{g.about}</p>
        </div>

        <div className="xticket xticket--3">
          <div className="xticket__c">
            <span className="xticket__k">Польза</span>
            <span className="xticket__v gold">{avg}<small>%</small></span>
            <span className="xticket__s">в среднем</span>
          </div>
          <div className="xticket__c">
            <span className="xticket__k">Регионы</span>
            <span className="xticket__v">{String(regions.length).padStart(2, '0')}</span>
            <span className="xticket__s xgr__flags">{regions.map((r) => <Flag key={r} cc={REGIONS[r]?.cc} size={12} />)}</span>
          </div>
          <div className="xticket__c">
            <span className="xticket__k">Встречи</span>
            <span className="xticket__v">02</span>
            <span className="xticket__s">в месяц</span>
          </div>
        </div>

        <div className="stack-8">
          <Btn variant="gold" wide icon="message" onClick={() => go(`/chat/${id}`)}>
            Чат группы{unread ? ` · ${unread} новых` : ''}
          </Btn>
          <div className="xgr-when">
            <span className="xgr-when__ic"><Icon name="calendar" size={16} /></span>
            <span>Встречи {g.when}. Каждый раз разбираете запрос одного участника, после — 15 минут на интро.</span>
          </div>
        </div>

        <Section title="Участники" note={`${A.name} ${A.she ? 'собрала' : 'собрал'} по вашим ответам в тесте`}>
          <List>
            <Item lead={<Avatar person={{ ...app.me, id: 'me' }} size={44} ring="var(--gold)" />} title={`${app.me.name} · вы`} sub={SPHERES.find((s) => s.id === app.me.sphere)?.name || app.me.company} chev={false} />
            {people.map(({ p, m }) => (
              <Item
                key={p.id}
                lead={<Avatar person={p} size={44} dot={p.online} />}
                title={p.name}
                sub={<><Flag cc={REGIONS[p.region].cc} size={12} /> {p.company} · {whyText(m)}</>}
                meta={<PctRing pct={m.pct} size={40} />}
                onClick={() => go(`/p/${p.id}`)}
              />
            ))}
          </List>
        </Section>

        {!app.me.tested && (
          <button className="xgr-test" onClick={() => go('/test')}>
            <span className="xgr-when__ic"><Icon name="spark" size={16} /></span>
            <span className="grow">
              <span className="xgr-test__k">Точнее подбор</span>
              <span className="xgr-test__t">Пройдите тест — минута, и группа соберётся под ваши задачи.</span>
            </span>
            <Icon name="right" size={16} className="chev" />
          </button>
        )}
      </div>
    </div>
  );
}

/* Схема связей группы. Всё движение — прорисовка линий и появление
   узлов (transform, opacity); без движения схема сразу на месте. */
function Orbit({ me, people }) {
  const n = people.length;
  const nodes = people.map(({ p, m }, i) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const r = Math.max(88, Math.min(126, 132 - (m.pct - 40) * 0.8));
    return { p, pct: m.pct, x: C + Math.cos(a) * r, y: C + Math.sin(a) * r, i };
  });
  const chords = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (nodes[i].p.region === nodes[j].p.region) chords.push([nodes[i], nodes[j]]);
    }
  }
  const ticks = Array.from({ length: 90 }, (_, i) => {
    const a = (i / 90) * Math.PI * 2;
    const long = i % 15 === 0;
    const r1 = 146, r2 = long ? 139 : 143;
    return `M${(C + Math.cos(a) * r1).toFixed(1)} ${(C + Math.sin(a) * r1).toFixed(1)}L${(C + Math.cos(a) * r2).toFixed(1)} ${(C + Math.sin(a) * r2).toFixed(1)}`;
  }).join('');
  return (
    <div className="xorb" style={{ width: SIZE, height: SIZE }}>
      <svg className="xorb__svg" viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} aria-hidden="true">
        <defs>
          <radialGradient id="xorbGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#D9B26B" stopOpacity="0.16" />
            <stop offset="60%" stopColor="#D9B26B" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#D9B26B" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={C} cy={C} r={C} fill="url(#xorbGlow)" />
        <g className="xorb__ticks"><path d={ticks} stroke="#EDE6D8" strokeOpacity="0.2" strokeWidth="0.8" /></g>
        <circle cx={C} cy={C} r="126" fill="none" stroke="#EDE6D8" strokeOpacity="0.07" strokeDasharray="1 4" />
        <circle cx={C} cy={C} r="88" fill="none" stroke="#EDE6D8" strokeOpacity="0.07" strokeDasharray="1 4" />
        <circle cx={C} cy={C} r="50" fill="none" stroke="#D9B26B" strokeOpacity="0.16" />
        {chords.map(([a, b], k) => (
          <line key={k} className="xorb__chord" x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#86A9E0" strokeOpacity="0.28" strokeWidth="0.8" pathLength="1" style={{ '--d': `${600 + k * 40}ms` }} />
        ))}
        {nodes.map((nd) => (
          <line
            key={nd.p.id} className="xorb__link" x1={C} y1={C} x2={nd.x} y2={nd.y} pathLength="1"
            stroke="#D9B26B" strokeOpacity={0.18 + ((nd.pct - 40) / 60) * 0.6} strokeWidth={nd.pct >= 75 ? 1.3 : 0.9}
            style={{ '--d': `${nd.i * 60}ms` }}
          />
        ))}
        {nodes.map((nd) => (
          <circle key={`d${nd.p.id}`} className="xorb__pulse" cx={C} cy={C} r="1.8" fill="#F0DCB4" style={{ '--d': `${1200 + nd.i * 380}ms`, '--dx': `${(nd.x - C).toFixed(1)}px`, '--dy': `${(nd.y - C).toFixed(1)}px` }} />
        ))}
      </svg>
      <div className="xorb__me" style={{ left: C, top: C }}>
        <i className="xorb__ping" />
        <Avatar person={{ ...me, id: 'me' }} size={58} ring="var(--gold)" />
        <span className="xorb__lbl xorb__lbl--me">вы</span>
      </div>
      {nodes.map((nd) => (
        <button
          key={nd.p.id}
          className={`xorb__node${nd.pct >= 75 ? ' is-hi' : ''}`}
          style={{ left: nd.x, top: nd.y, '--d': `${nd.i * 60 + 250}ms` }}
          onClick={() => go(`/p/${nd.p.id}`)}
          aria-label={`${nd.p.name}, польза ${nd.pct}%`}
        >
          <Avatar person={nd.p} size={36} />
          <span className="xorb__lbl">{nd.pct}%</span>
        </button>
      ))}
    </div>
  );
}
