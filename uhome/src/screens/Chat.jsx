import { useEffect, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { messagesOf } from '../lib/select.js';
import { groupById } from '../lib/groups.js';
import { byId } from '../data/people.js';
import { communityById } from '../data/communities.js';
import { REGIONS } from '../data/regions.js';
import { seeded } from '../lib/art.js';
import { TopBar, Empty } from '../components/UI.jsx';
import { Avatar, GroupAva } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';

/* Переписка: личная, с командой клуба, своя группа (команда, мастер-группа)
   или чат сообщества. Таб-бара здесь нет — поле ввода стоит у нижнего края. */

const REPLIES = ['Отлично, договорились!', 'Сейчас гляну и отвечу', 'Давай созвонимся вечером?', 'Супер, спасибо!', 'Звучит интересно, расскажи подробнее'];

const hm = (ms) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const dayLabel = (ms) => {
  const d = new Date(ms);
  const t = new Date();
  if (d.toDateString() === t.toDateString()) return 'Сегодня';
  t.setDate(t.getDate() - 1);
  if (d.toDateString() === t.toDateString()) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
};

export default function Chat({ id }) {
  const app = useApp();
  const [text, setText] = useState('');
  const person = byId(id);
  const community = communityById(id);
  const group = id?.startsWith('g-') ? groupById(app.me, id) : null;
  const messages = messagesOf(app, id);

  // открытый чат прочитан — и то, что пришло, пока он открыт, тоже
  useEffect(() => {
    app.markRead(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, messages.length]);

  useEffect(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight });
  }, [messages.length]);

  if (!person && !community && !group) return <div className="screen screen--nested"><TopBar backTo="/chats" /><Empty title="Чат не найден" /></div>;

  const send = () => {
    const t = text.trim();
    if (!t) return;
    const n = (app.sent[id] || []).length;
    const r = seeded(id + n)();
    const reply = (person || group) && id !== 'team' && n % 2 === 0 ? REPLIES[Math.floor(r * REPLIES.length)] : undefined;
    const who = group ? group.members[Math.floor(r * group.members.length)]?.id : undefined;
    app.send(id, t, { reply, who });
    setText('');
  };

  const title = person ? person.name : group ? group.name : community.name;
  const sub = person
    ? id === 'team' ? 'Отвечаем за 15 минут' : `${person.online ? 'онлайн' : 'не в сети'} · ${REGIONS[person.region].flag} ${person.city}`
    : group ? `${group.members.length + 1} участников · ${group.when}` : `${community.members} участников`;
  const to = person ? (id === 'team' ? '/profile' : `/p/${id}`) : group ? `/group/${id}` : `/community/${id}`;

  let lastDay = '';

  return (
    <div className="screen screen--nested screen--chat">
      <TopBar
        title={title}
        sub={sub}
        backTo="/chats"
        right={
          <button onClick={() => go(to)} aria-label="Профиль">
            {person ? <Avatar person={person} size={38} /> : group ? <GroupAva members={group.members} size={38} /> : <span className="iconbtn"><Icon name="users" size={18} /></span>}
          </button>
        }
      />

      <div className="chat">
        {id === 'team' && (
          <div className="note" style={{ marginBottom: 8 }}>
            <Icon name="spark" size={16} color="var(--gold)" />
            <div>Команда UHOME: события, услуги, знакомства, визы, жильё. Пишите как другу — разберёмся.</div>
          </div>
        )}
        {group && (
          <button className="note" style={{ marginBottom: 8, textAlign: 'left' }} onClick={() => go(`/group/${id}`)}>
            <Icon name={group.icon} size={16} color="var(--gold)" />
            <div>{group.about} <span className="gold">Состав и встречи →</span></div>
          </button>
        )}
        {messages.length === 0 && (
          <div className="t-sm dim-2 center" style={{ padding: '40px 20px', lineHeight: 1.5 }}>
            Здесь пока пусто. Напишите первым — {person ? 'в клубе принято отвечать' : 'сообщество увидит сообщение сразу'}.
          </div>
        )}
        {messages.map((m, i) => {
          const day = dayLabel(m.at);
          const showDay = day !== lastDay;
          lastDay = day;
          const out = m.from === 'me';
          const author = (community || group) && !out ? byId(m.who) : null;
          if (m.from === 'sys') {
            return (
              <div key={i} style={{ display: 'contents' }}>
                {showDay && <div className="chat__day">{day}</div>}
                <div className="chat__sys"><Icon name="spark" size={14} color="var(--gold)" />{m.text}</div>
              </div>
            );
          }
          return (
            <div key={i} style={{ display: 'contents' }}>
              {showDay && <div className="chat__day">{day}</div>}
              <div className={`bubble ${out ? 'bubble--out' : 'bubble--in'}`}>
                {author && <span className="bubble__who">{author.name}</span>}
                {!out && m.who && !author && <span className="bubble__who">{m.who}</span>}
                {m.text}
                <div className="bubble__time">{hm(m.at)}</div>
              </div>
            </div>
          );
        })}
      </div>

      <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input className="field grow" value={text} onChange={(e) => setText(e.target.value)} placeholder="Сообщение" enterKeyHint="send" />
        <button className="sendbtn" type="submit" disabled={!text.trim()} aria-label="Отправить">
          <Icon name="send" size={19} />
        </button>
      </form>
    </div>
  );
}
