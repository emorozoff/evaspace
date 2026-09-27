import { useMemo, useState } from 'react';
import { go } from '../lib/router.jsx';
import { circleOrder } from '../lib/select.js';
import { groupsOf } from '../lib/groups.js';
import { assistantOf } from '../lib/assistant.js';
import { ranked } from '../lib/match.js';
import { PEOPLE } from '../data/people.js';
import { REGIONS } from '../data/regions.js';
import { firstName, plural } from '../lib/format.js';
import { Avatar, GroupAva } from './Art.jsx';
import { AvatarPortrait } from './AvatarArt.jsx';
import { Section, Sheet, List, Item, Search } from './UI.jsx';
import Icon from './Icons.jsx';

/* Ближний круг — как в телеграме: первыми команда клуба, мастер-группа
   и ассистент, дальше свои люди. Кто написал и не прочитан — встаёт в начало со счётчиком:
   личное — красным, группы — белым. */

export default function Circle({ app }) {
  const [add, setAdd] = useState(false);
  const items = circleOrder(app);
  const groups = groupsOf(app.me);
  const A = assistantOf(app);
  const unread = items.reduce((n, x) => n + x.unread, 0);

  const view = (x) => {
    if (x.id === 'ai') return { name: A.name, ava: <AvatarPortrait who={A.id} size={58} />, to: '/ai' };
    if (x.group) {
      const g = groups.find((y) => y.id === x.id);
      return { name: g.short, ava: <GroupAva members={g.members} size={58} ring={x.unread ? 'var(--gold)' : null} />, to: `/chat/${x.id}` };
    }
    if (x.id === 'team') return { name: 'Команда', ava: <Avatar person={x.person} size={58} ring={x.unread ? 'var(--gold)' : null} />, to: '/chat/team' };
    return { name: firstName(x.person.name), ava: <Avatar person={x.person} size={58} ring={x.unread ? 'var(--gold)' : null} dot={!x.unread && x.person.online} />, to: `/chat/${x.id}` };
  };

  return (
    <Section
      title="Ближний круг"
      note={unread ? `${unread} ${plural(unread, 'новое сообщение', 'новых сообщения', 'новых сообщений')}` : 'Все сообщения прочитаны'}
      more="Сообщения"
      onMore={() => go('/chats')}
    >
      <div className="scroller">
        {items.map((x) => {
          const v = view(x);
          return (
            <button key={x.id} className={`circle${x.unread ? ' circle--new' : ''}`} onClick={() => go(v.to)}>
              <span className="circle__ava">
                {v.ava}
                {x.unread > 0 && <span className={`badge${x.group ? ' badge--muted' : ''}`}>{x.unread}</span>}
              </span>
              <span className="circle__t">{v.name}</span>
            </button>
          );
        })}
        <button className="circle" onClick={() => setAdd(true)}>
          <span className="circle-add"><Icon name="plus" size={20} /></span>
          <span className="circle__t">Добавить</span>
        </button>
      </div>

      <Sheet open={add} onClose={() => setAdd(false)} title="Кого добавить" sub="Одно нажатие — человек в круге. Можно добавить нескольких.">
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
