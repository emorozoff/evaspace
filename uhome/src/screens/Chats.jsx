import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { chatList } from '../lib/select.js';
import { REGIONS } from '../data/regions.js';
import { TopBar, List, Item } from '../components/UI.jsx';
import { Avatar, Tile } from '../components/Art.jsx';
import { Thumb } from '../components/Covers.jsx';

/* Сообщения: личные разговоры и чаты сообществ одним списком.
   Непрочитанные — наверху, как на главной в ближнем круге. */

const timeOf = (ms) => {
  if (!ms) return '';
  const d = new Date(ms);
  const today = new Date().toDateString() === d.toDateString();
  return today ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
};

export default function Chats() {
  const app = useApp();
  const list = chatList(app);

  return (
    <div className="screen screen--nested">
      <TopBar title="Сообщения" sub={`${list.length} разговоров`} backTo="/" />
      <List>
        {list.map((c) => {
          const title = c.kind === 'dm' ? c.person.name : c.community.name;
          const who = c.last?.from === 'me' ? 'Вы: ' : '';
          const lead =
            c.kind === 'dm' ? (
              <Avatar person={c.person} size={50} dot={c.person.online} />
            ) : c.community.kind === 'local' ? (
              <Thumb region={c.community.region} size={50} radius={16} />
            ) : (
              <Tile icon={c.community.icon} tone={c.community.tone} size={50} radius={16} />
            );
          return (
            <Item
              key={c.id}
              lead={lead}
              title={<span style={{ fontWeight: c.unread ? 800 : 600 }}>{title}</span>}
              sub={`${who}${c.last?.text || (c.kind === 'group' ? `${REGIONS[c.community.region]?.flag || ''} сообщество` : '')}`}
              meta={
                <>
                  <span>{timeOf(c.last?.at)}</span>
                  {c.unread > 0 && <span className="unread">{c.unread}</span>}
                </>
              }
              chev={false}
              onClick={() => go(`/chat/${c.id}`)}
            />
          );
        })}
      </List>
    </div>
  );
}
