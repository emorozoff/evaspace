import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { chatList, lastOf, unreadOf } from '../lib/select.js';
import { assistantOf } from '../lib/assistant.js';
import { byId, firstNameOf } from '../data/people.js';
import { REGIONS } from '../data/regions.js';
import { plural } from '../lib/format.js';
import { TopBar, List, Item } from '../components/UI.jsx';
import { Avatar, Tile, GroupAva } from '../components/Art.jsx';
import { AvatarPortrait } from '../components/AvatarArt.jsx';
import Flag from '../components/Flag.jsx';

/* Сообщения: ассистент сверху, дальше личные, команда, мастер-группа и
   сообщества одним списком. Непрочитанные — наверху; личное красным,
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
    <div className="screen screen--nested">
      <TopBar title="Сообщения" sub={`${list.length + 1} ${plural(list.length + 1, 'разговор', 'разговора', 'разговоров')}${fresh ? ` · ${fresh} ${plural(fresh, 'новое', 'новых', 'новых')}` : ''}`} backTo="/" />

      <div className="stack-24">
        <section className="sect">
          <div className="sect__eye">Ассистент</div>
          <List>
            <Item
              lead={<AvatarPortrait who={A.id} size={44} />}
              title={A.name}
              sub={aiLast ? `${aiLast.from === 'me' ? 'Вы: ' : ''}${aiLast.text.split('\n')[0]}` : `${A.she ? 'Собрала' : 'Собрал'} для вас поводы познакомиться`}
              meta={<>{aiLast && <span>{timeOf(aiLast.at)}</span>}{aiUnread > 0 && <span className="unread">{aiUnread}</span>}</>}
              chev={false}
              onClick={() => go('/ai')}
            />
          </List>
        </section>

        <section className="sect">
          <div className="sect__eye">Разговоры</div>
          <List>
            {list.map((c) => {
              const title = c.kind === 'dm' ? c.person.name : c.kind === 'squad' ? c.group.name : c.community.name;
              const author = c.last?.from === 'me' ? 'Вы: ' : c.kind !== 'dm' && c.last?.who && byId(c.last.who) ? `${firstNameOf(byId(c.last.who))}: ` : '';
              const lead =
                c.kind === 'dm' ? <Avatar person={c.person} size={44} dot={c.person.online} />
                  : c.kind === 'squad' ? <GroupAva members={c.group.members} size={44} />
                    : c.community.kind === 'local' ? <span className="disc"><Flag cc={REGIONS[c.community.region].cc} size={22} /></span>
                      : <Tile icon={c.community.icon} tone={c.community.tone} size={44} radius={22} />;
              return (
                <Item
                  key={c.id}
                  lead={lead}
                  title={title}
                  sub={c.last?.from === 'sys' ? c.last.text : `${author}${c.last?.text || (c.kind === 'group' ? 'сообщество' : '')}`}
                  meta={<><span>{timeOf(c.last?.at)}</span>{c.unread > 0 && <span className={`unread${c.kind === 'dm' ? '' : ' unread--muted'}`}>{c.unread}</span>}</>}
                  chev={false}
                  onClick={() => go(`/chat/${c.id}`)}
                />
              );
            })}
          </List>
        </section>
      </div>
    </div>
  );
}
