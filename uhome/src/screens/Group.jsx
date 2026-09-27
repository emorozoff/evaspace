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
import { Avatar, GroupAva } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';

/* Мастер-группа: десять резидентов с похожими задачами. Состав собран
   тестом, у каждого участника видно, чем он полезен именно вам. */

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
    <div className="screen screen--nested">
      <TopBar title={g.short} backTo="/" />
      <div className="stack-24">
        <div className="aihead" style={{ gap: 14 }}>
          <GroupAva members={g.members} size={96} />
          <div>
            <div className="aicard__k">Мастер-группа · 10 человек</div>
            <h1 className="h2" style={{ marginTop: 8 }}>{g.theme.name}</h1>
          </div>
          <p className="lead" style={{ fontSize: 15, maxWidth: 360 }}>{g.about}</p>
        </div>

        <div className="stats">
          <div className="stat"><div className="stat__v gold">{avg}%</div><div className="stat__l">польза в среднем</div></div>
          <div className="stat"><div className="stat__v">{regions.length}</div><div className="stat__l">{regions.map((r) => REGIONS[r]?.flag).join(' ')}</div></div>
          <div className="stat"><div className="stat__v">2</div><div className="stat__l">встречи в месяц</div></div>
        </div>

        <div className="stack-8">
          <Btn variant="gold" wide icon="message" onClick={() => go(`/chat/${id}`)}>
            Чат группы{unread ? ` · ${unread} новых` : ''}
          </Btn>
          <div className="note">
            <Icon name="calendar" size={16} color="var(--gold)" />
            <div>Встречи {g.when}. Каждый раз разбираете запрос одного участника, после — 15 минут на интро.</div>
          </div>
        </div>

        <Section title="Участники" note={`${A.name} ${A.she ? 'собрала' : 'собрал'} по вашим ответам в тесте`}>
          <List>
            <Item lead={<Avatar person={{ ...app.me, id: 'me' }} size={46} />} title={`${app.me.name} · вы`} sub={SPHERES.find((s) => s.id === app.me.sphere)?.name || app.me.company} chev={false} />
            {people.map(({ p, m }) => (
              <Item
                key={p.id}
                lead={<Avatar person={p} size={46} dot={p.online} />}
                title={p.name}
                sub={`${REGIONS[p.region].flag} ${p.company} · ${whyText(m)}`}
                meta={<span className={`pct${m.pct >= 75 ? ' pct--hi' : ''}`}>{m.pct}%</span>}
                onClick={() => go(`/p/${p.id}`)}
              />
            ))}
          </List>
        </Section>

        {!app.me.tested && (
          <button className="aicard" onClick={() => go('/test')}>
            <Icon name="spark" size={20} color="var(--gold)" />
            <span className="grow" style={{ textAlign: 'left' }}>
              <span className="aicard__k">Точнее подбор</span>
              <span className="aicard__t" style={{ display: 'block' }}>Пройдите тест — минута, и группа соберётся под ваши задачи.</span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
