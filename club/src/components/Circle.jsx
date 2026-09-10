import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { chatKey, cityName, innerCircle, matchedWith, teamOf, unreadIn } from '../lib/logic.js';
import { Avatar, Item, List, Search, Section, Sheet } from './UI.jsx';
import TeamAvatar from './TeamAvatar.jsx';
import Icon from './Icons.jsx';

/* Ближний круг: чат команды, метчи и люди с близкими интересами.
   Пустым не бывает — если своих ещё нет, показываем тех, кто рядом по духу. */

export default function Circle() {
  const { state, me, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const people = innerCircle(state, me.id);
  const team = teamOf(state, me.id);
  const teamChat = team ? chatKey('team', [team.id]) : null;
  const matched = new Set(matchedWith(state, me.id).map((u) => u.id));
  const inCircle = new Set(people.map((p) => p.id));

  const candidates = state.users
    .filter((u) => u.id !== me.id && u.active !== false && !inCircle.has(u.id))
    .filter((u) => !query || `${u.name} ${u.about}`.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 24);

  return (
    <Section title="Ближний круг" more="Сообщения" onMore={() => go('/chats')}>
      <div className="scroller">
        {teamChat && (
          <button className="circle-item" onClick={() => go(`/chat/${encodeURIComponent(teamChat)}`)}>
            <span style={{ position: 'relative' }}>
              <TeamAvatar team={team} size={48} />
              {unreadIn(state, teamChat, me.id) > 0 && <span className="badge-n">{unreadIn(state, teamChat, me.id)}</span>}
            </span>
            <span className="circle-item__t">Команда</span>
          </button>
        )}
        {people.map((p) => {
          const dm = chatKey('dm', [me.id, p.id]);
          const isMatch = matched.has(p.id);
          return (
            <button key={p.id} className="circle-item" onClick={() => (isMatch ? go(`/chat/${encodeURIComponent(dm)}`) : go(`/person/${p.id}`))}>
              <span style={{ position: 'relative' }}>
                <Avatar user={p} size={48} ring={isMatch ? 'var(--accent)' : team && state.members.some((m) => m.teamId === team.id && m.userId === p.id) ? 'var(--violet)' : undefined} />
                {isMatch && unreadIn(state, dm, me.id) > 0 && <span className="badge-n">{unreadIn(state, dm, me.id)}</span>}
              </span>
              <span className="circle-item__t">{p.name.split(' ')[0]}</span>
            </button>
          );
        })}
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
