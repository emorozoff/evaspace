import { go } from '../lib/router.jsx';
import { NEWS } from '../data/news.js';
import { ago } from '../lib/format.js';
import { TopBar, Btn, Empty, Section, List, Item } from '../components/UI.jsx';

/* Новость целиком и один шаг к действию — туда, где можно воспользоваться.
   Ниже — остальные новости клуба строками. */

const ACTION = [
  [/^\/service\//, 'Открыть компанию'],
  [/^\/material\//, 'Смотреть запись'],
  [/^\/community\//, 'Открыть сообщество'],
  [/^\/events/, 'Открыть афишу'],
  [/^\/people/, 'Открыть карту'],
];

export default function NewsPage({ id }) {
  const n = NEWS.find((x) => x.id === id);
  if (!n) return <div className="screen screen--nested"><TopBar backTo="/" /><Empty title="Новость не найдена" /></div>;
  const label = ACTION.find(([re]) => re.test(n.to))?.[1] || 'Перейти';
  const more = NEWS.filter((x) => x.id !== n.id);
  return (
    <div className="screen screen--nested">
      <TopBar title="Новости клуба" sub={n.tag} backTo="/" />
      <div className="stack-24">
        <article className="stack">
          <div className="sect__eye" style={{ margin: 0 }}>{n.tag} · {ago(n.daysAgo)}</div>
          <h1 className="h1" style={{ fontSize: 34 }}>{n.title}</h1>
          <div className="lead" style={{ color: 'var(--ink)' }}>{n.sub}</div>
          <div className="hairline" />
          <p className="lead">{n.text}</p>
        </article>

        <Btn variant="gold" wide onClick={() => go(n.to)}>{label}</Btn>

        <Section title="Ещё новости">
          <List>
            {more.map((x) => <Item key={x.id} icon={x.icon} title={x.title} sub={`${x.tag} · ${ago(x.daysAgo)}`} onClick={() => go(`/news/${x.id}`, true)} />)}
          </List>
        </Section>
      </div>
    </div>
  );
}
