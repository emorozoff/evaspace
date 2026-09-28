import { go } from '../lib/router.jsx';
import { NEWS } from '../data/news.js';
import { ago } from '../lib/format.js';
import { TopBar, Btn, Empty } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';

/* Новость целиком и один шаг к действию — туда, где можно воспользоваться.
   Ниже — остальные новости клуба тонкими строками. */

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
  const idx = NEWS.indexOf(n);
  const label = ACTION.find(([re]) => re.test(n.to))?.[1] || 'Перейти';
  const more = NEWS.filter((x) => x.id !== n.id);
  return (
    <div className="screen screen--nested xnw">
      <TopBar title={n.tag} sub={ago(n.daysAgo)} backTo="/" />
      <div className="stack-24">
        <article className="xnw-art">
          <div className="xnw-art__meta">
            <span className={`xnw-art__ic tone-${n.tone}`}><Icon name={n.icon} size={22} /></span>
            <span className="xnw-art__k">
              <span>{n.tag}</span>
              <span className="xnw-art__d">{ago(n.daysAgo)} · №{String(idx + 1).padStart(3, '0')}</span>
            </span>
          </div>
          <h1 className="h2 xnw-art__t">{n.title}</h1>
          <div className="xnw-art__sub">{n.sub}</div>
          <i className="xnw-art__rule" aria-hidden="true" />
          <p className="lead">{n.text}</p>
        </article>

        <Btn variant="gold" wide onClick={() => go(n.to)}>{label}</Btn>

        <section className="sect">
          <div className="sect__head"><div className="sect__title">Ещё новости</div></div>
          <div className="xnw-list">
            {more.map((x, i) => (
              <button key={x.id} className="xnw-row" style={{ '--i': i }} onClick={() => go(`/news/${x.id}`, true)}>
                <span className={`xnw-row__ic tone-${x.tone}`}><Icon name={x.icon} size={16} /></span>
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="xnw-row__k">{x.tag} · {ago(x.daysAgo)}</span>
                  <span className="xnw-row__t">{x.title}</span>
                </span>
                <Icon name="right" size={15} className="chev" />
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
