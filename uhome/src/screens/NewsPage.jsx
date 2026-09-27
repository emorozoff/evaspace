import { go } from '../lib/router.jsx';
import { NEWS } from '../data/news.js';
import { ago } from '../lib/format.js';
import { TopBar, Btn, Empty } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';

/* Новость целиком и один шаг к действию — туда, где можно воспользоваться. */
export default function NewsPage({ id }) {
  const n = NEWS.find((x) => x.id === id);
  if (!n) return <div className="screen screen--nested"><TopBar backTo="/" /><Empty title="Новость не найдена" /></div>;
  return (
    <div className="screen screen--nested">
      <TopBar title={n.tag} sub={ago(n.daysAgo)} backTo="/" />
      <div className="stack-24">
        <div className="stack">
          <span className={`news__ic tone-${n.tone}`} style={{ width: 56, height: 56, borderRadius: 18 }}><Icon name={n.icon} size={26} /></span>
          <h1 className="h2">{n.title}</h1>
          <div className="t-sm dim-2">{n.sub}</div>
        </div>
        <p className="lead">{n.text}</p>
        <Btn variant="gold" wide onClick={() => go(n.to)}>Перейти</Btn>
      </div>
    </div>
  );
}
