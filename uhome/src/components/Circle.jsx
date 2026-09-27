import { useMemo, useState } from 'react';
import { go } from '../lib/router.jsx';
import { circleOrder } from '../lib/select.js';
import { ranked } from '../lib/match.js';
import { PEOPLE } from '../data/people.js';
import { REGIONS } from '../data/regions.js';
import { firstName } from '../lib/format.js';
import { Avatar } from './Art.jsx';
import { Section, Sheet, List, Item, Search } from './UI.jsx';
import Icon from './Icons.jsx';

/* Ближний круг — как в клубе: первой идёт команда, дальше свои люди.
   Кто написал и ещё не прочитан, встаёт в самое начало и получает
   счётчик, как в мессенджере. Нажатие открывает переписку. */

export default function Circle({ app }) {
  const [add, setAdd] = useState(false);
  const items = circleOrder(app);
  const unread = items.reduce((n, x) => n + x.unread, 0);

  return (
    <Section
      title="Ближний круг"
      note={unread ? `${unread} ${unread === 1 ? 'новое сообщение' : unread < 5 ? 'новых сообщения' : 'новых сообщений'}` : undefined}
      more="Сообщения"
      onMore={() => go('/chats')}
    >
      <div className="scroller">
        {items.map(({ id, person, unread: n }) => (
          <button key={id} className={`circle${n ? ' circle--new' : ''}`} onClick={() => go(`/chat/${id}`)}>
            <span className="circle__ava">
              <Avatar person={person} size={56} ring={n ? 'var(--gold)' : null} dot={!n && person.online} />
              {n > 0 && <span className="badge">{n}</span>}
            </span>
            <span className="circle__t">{id === 'team' ? 'Команда' : firstName(person.name)}</span>
          </button>
        ))}
        <button className="circle" onClick={() => setAdd(true)}>
          <span className="circle-add"><Icon name="plus" size={20} /></span>
          <span className="circle__t dim-2">Добавить</span>
        </button>
      </div>

      <Sheet open={add} onClose={() => setAdd(false)} title="Кого добавить" sub="Одно нажатие — человек в круге. Шторка не закрывается, можно добавить нескольких.">
        <AddList app={app} />
      </Sheet>
    </Section>
  );
}

function AddList({ app }) {
  const [q, setQ] = useState('');
  const list = useMemo(() => ranked(app.me, PEOPLE), [app.me]);
  const shown = list.filter(({ p }) => !q || `${p.name} ${p.company} ${p.about}`.toLowerCase().includes(q.toLowerCase())).slice(0, 30);
  return (
    <div className="stack">
      <Search value={q} onChange={setQ} placeholder="Имя, компания или дело" />
      <List>
        {shown.map(({ p, pct }) => {
          const on = app.circle.includes(p.id);
          return (
            <Item
              key={p.id}
              lead={<Avatar person={p} size={42} dot={p.online} />}
              title={p.name}
              sub={`${REGIONS[p.region].flag} ${p.city} · ${p.company}`}
              meta={on ? <span className="tag tag--sea">в круге</span> : <span className={`pct${pct >= 75 ? ' pct--hi' : ''}`}>{pct}%</span>}
              chev={false}
              onClick={() => app.toggleCircle(p.id)}
            />
          );
        })}
      </List>
    </div>
  );
}
