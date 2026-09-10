import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { cityName, innerCircle, teamOf } from '../lib/logic.js';
import { Avatar, Item, List, Search, Section, Sheet } from './UI.jsx';
import Icon from './Icons.jsx';

/* Ближний круг: команда попадает сюда сама, остальных участник добавляет плюсом. */

export default function Circle() {
  const { state, me, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const people = innerCircle(state, me.id);
  const team = teamOf(state, me.id);
  const inCircle = new Set(people.map((p) => p.id));

  const candidates = state.users
    .filter((u) => u.id !== me.id && u.active !== false && !inCircle.has(u.id))
    .filter((u) => !query || `${u.name} ${u.about}`.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 24);

  return (
    <Section title="Ближний круг" more={people.length ? 'Все люди' : undefined} onMore={() => go('/people')}>
      <div className="scroller">
        {people.map((p) => (
          <button key={p.id} className="circle-item" onClick={() => go(`/person/${p.id}`)}>
            <Avatar user={p} size={48} ring={team && state.members.some((m) => m.teamId === team.id && m.userId === p.id) ? 'var(--violet)' : undefined} />
            <span className="circle-item__t">{p.name.split(' ')[0]}</span>
          </button>
        ))}
        <button className="circle-item" onClick={() => setOpen(true)}>
          <span className="circle-add"><Icon name="plus" size={20} /></span>
          <span className="circle-item__t dim-2">Добавить</span>
        </button>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Кого добавить" sub="Одно нажатие — человек в круге">
        <div className="stack">
          <Search value={query} onChange={setQuery} placeholder="Имя или дело" />
          <List>
            {candidates.map((u) => (
              <Item
                key={u.id}
                lead={<Avatar user={u} size={40} />}
                title={u.name}
                sub={`${cityName(state, u.cityId)} · ${u.about}`}
                chev={false}
                meta={<Icon name="plus" size={17} color="var(--accent)" />}
                onClick={() => dispatch({ type: 'circleAdd', userId: u.id })}
              />
            ))}
          </List>
        </div>
      </Sheet>
    </Section>
  );
}
