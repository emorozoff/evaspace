import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { chatList, lastOf, unreadOf } from '../lib/select.js';
import { assistantOf } from '../lib/assistant.js';
import { byId, firstNameOf } from '../data/people.js';
import { TopBar, List, Item } from '../components/UI.jsx';
import { Avatar, Tile, GroupAva } from '../components/Art.jsx';
import { HoloPortrait } from '../components/AiFab.jsx';
import { plural } from '../lib/format.js';
import { Thumb } from '../components/Covers.jsx';

/* Сообщения: ассистент сверху, дальше личные, команда, мастер-группа
   и сообщества одним списком. Непрочитанные — наверху; личное красным,
   группы белым — как в телеграме. */

const timeOf = (ms) => {
  if (!ms) return '';
  const d = new Date(ms);
  const today = new Date().toDateString() === d.toDateString();
  return today ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
};

export default function Chats() {
  const app = useApp();
  const list = chatList(app);
  const A = assistantOf(app);
  const aiLast = lastOf(app, 'ai');
  const aiUnread = unreadOf(app, 'ai');
  const fresh = list.reduce((n, c) => n + (c.unread || 0), 0) + aiUnread;

  return (
    <div className="screen screen--nested xch">
      <TopBar
        title="Сообщения"
        sub={<span className="xtele"><b>{list.length + 1}</b> {plural(list.length + 1, 'разговор', 'разговора', 'разговоров')}{fresh > 0 && <><i /><b>{fresh}</b> {plural(fresh, 'новое', 'новых', 'новых')}</>}</span>}
        backTo="/"
      />

      <div className="xch__k">Ассистент</div>
      <button className="xch__ai" onClick={() => go('/ai')}>
        <HoloPortrait who={A.id} size={46} />
        <span className="xch__ai-body">
          <span className="xch__ai-top">
            <span className="xch__ai-name">{A.name}</span>
            <span className="xch__ai-tag"><i />в сети</span>
          </span>
          <span className="xch__ai-s">{aiLast ? `${aiLast.from === 'me' ? 'Вы: ' : ''}${aiLast.text.split('\n')[0]}` : `${A.she ? 'Собрала' : 'Собрал'} для вас поводы познакомиться`}</span>
        </span>
        <span className="item__meta">
          {aiLast && <span className="xch__time">{timeOf(aiLast.at)}</span>}
          {aiUnread > 0 && <span className="unread">{aiUnread}</span>}
        </span>
      </button>

      <div className="xch__k">Разговоры</div>
      <List>
        {list.map((c, i) => {
          const title = c.kind === 'dm' ? c.person.name : c.kind === 'squad' ? c.group.name : c.community.name;
          const author = c.last?.from === 'me' ? 'Вы: ' : c.kind !== 'dm' && c.last?.who && byId(c.last.who) ? `${firstNameOf(byId(c.last.who))}: ` : '';
          const lead =
            c.kind === 'dm' ? (
              <Avatar person={c.person} size={46} dot={c.person.online} />
            ) : c.kind === 'squad' ? (
              <GroupAva members={c.group.members} size={46} />
            ) : c.community.kind === 'local' ? (
              <Thumb region={c.community.region} size={46} radius={15} />
            ) : (
              <Tile icon={c.community.icon} tone={c.community.tone} size={46} radius={15} />
            );
          return (
            <div key={c.id} className={`xch__row${c.unread ? ' is-new' : ''}`} style={{ '--i': i }}>
              <Item
                lead={lead}
                title={title}
                sub={c.last?.from === 'sys' ? c.last.text : `${author}${c.last?.text || (c.kind === 'group' ? 'сообщество' : '')}`}
                meta={
                  <>
                    <span className="xch__time">{timeOf(c.last?.at)}</span>
                    {c.unread > 0 && <span className={`unread${c.kind === 'dm' ? '' : ' unread--muted'}`}>{c.unread}</span>}
                  </>
                }
                chev={false}
                onClick={() => go(`/chat/${c.id}`)}
              />
            </div>
          );
        })}
      </List>
    </div>
  );
}
