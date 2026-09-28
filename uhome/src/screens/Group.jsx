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
import Flag from '../components/Flag.jsx';

/* Мастер-группа: десять резидентов с похожими задачами. Карточка группы,
   цифры полосой, чат и состав — у каждого видно, чем он полезен вам. */

export default function Group({ id }) {
  const app = useApp();
  const g = groupById(app.me, id);
  if (!g) return <div className="screen screen--nested"><TopBar backTo="/" /><Empty title="Группа не найдена" /></div>;

  const A = assistantOf(app);
  const people = g.members.map((p) => ({ p, m: match(app.me, p) })).sort((a, b) => b.m.pct - a.m.pct);
  const avg = Math.round(people.reduce((n, x) => n + x.m.pct, 0) / people.length);
  const unread = unreadOf(app, id);

  return (
    <div className="screen screen--nested">
      <TopBar title={g.short} sub={g.theme.name} backTo="/" />
      <div className="stack-24">
        <div className="card card--gold">
          <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
            <GroupAva members={g.members} size={56} />
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="sect__eye">Мастер-группа · {people.length + 1} человек</div>
              <div className="h2">{g.theme.name}</div>
            </div>
          </div>
          <p style={{ marginTop: 12 }}>{g.about}</p>
          <div className="strip" style={{ marginTop: 16 }}>
            <div><span className="strip__v">{people.length + 1}</span><span className="strip__k">участников</span></div>
            <div><span className="strip__v">{avg}<small style={{ fontSize: 12, marginLeft: 1 }}>%</small></span><span className="strip__k">польза</span></div>
            <div><span className="strip__v">2</span><span className="strip__k">в месяц</span></div>
          </div>
        </div>

        <div className="stack-8">
          <Btn variant="gold" wide icon="message" onClick={() => go(`/chat/${id}`)}>Чат группы{unread ? ` · ${unread} новых` : ''}</Btn>
          <div className="note-line">Встречи {g.when}. Каждый раз разбираете запрос одного участника, после — 15 минут на интро.</div>
        </div>

        <Section title="Участники" note={`${A.name} ${A.she ? 'собрала' : 'собрал'} по вашим ответам в тесте`}>
          <List>
            <Item lead={<Avatar person={{ ...app.me, id: 'me' }} size={42} ring="var(--gold)" />} title={`${app.me.name} · вы`} sub={SPHERES.find((s) => s.id === app.me.sphere)?.name || app.me.company} chev={false} />
            {people.map(({ p, m }) => (
              <Item
                key={p.id}
                lead={<Avatar person={p} size={42} dot={p.online} />}
                title={p.name}
                sub={<><Flag cc={REGIONS[p.region].cc} size={12} /> {p.company} · {whyText(m)}</>}
                meta={<span className="s-pct">{m.pct}<small>%</small></span>}
                chev={false}
                onClick={() => go(`/p/${p.id}`)}
              />
            ))}
          </List>
        </Section>

        {!app.me.tested && (
          <List>
            <Item icon="spark" title="Точнее подбор" sub="Пройдите тест — минута, и группа соберётся под ваши задачи" onClick={() => go('/test')} />
          </List>
        )}
      </div>
    </div>
  );
}
