import { useEffect, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { messagesOf } from '../lib/select.js';
import { groupById } from '../lib/groups.js';
import { byId } from '../data/people.js';
import { communityById } from '../data/communities.js';
import { REGIONS } from '../data/regions.js';
import { seeded } from '../lib/art.js';
import { plural } from '../lib/format.js';
import { TopBar, Empty } from '../components/UI.jsx';
import { Avatar, GroupAva } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';
import Flag from '../components/Flag.jsx';

/* Переписка: личная, с командой клуба, мастер-группа или чат сообщества.
   Входящие — панелью, свои — на золотой подложке с тонкой кромкой.
   Таб-бара здесь нет — поле ввода стоит у нижнего края. */

const REPLIES = ['Отлично, договорились!', 'Сейчас гляну и отвечу', 'Давайте созвонимся вечером?', 'Супер, спасибо!', 'Звучит интересно, расскажите подробнее'];

export const hm = (ms) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
export const dayLabel = (ms) => {
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

  const team = id === 'team';
  const title = person ? person.name : group ? group.name : community.name;
  const members = group ? group.members.length + 1 : community?.members;
  const sub = person
    ? team ? 'Отвечаем за 15 минут' : <>{person.online ? 'онлайн' : 'не в сети'} · <Flag cc={REGIONS[person.region].cc} size={12} /> {person.city}</>
    : `${members} ${plural(members, 'участник', 'участника', 'участников')}${group ? ` · ${group.when}` : ''}`;
  const to = person ? (team ? null : `/p/${id}`) : group ? `/group/${id}` : `/community/${id}`;
  const face = person ? <Avatar person={person} size={38} /> : group ? <GroupAva members={group.members} size={38} /> : <span className="iconbtn"><Icon name="users" size={18} /></span>;

  let lastDay = '';

  return (
    <div className="screen screen--nested screen--chat">
      <TopBar
        title={title}
        sub={sub}
        backTo="/chats"
        right={to ? <button onClick={() => go(to)} aria-label={group ? 'О группе' : community ? 'О сообществе' : 'Профиль'}>{face}</button> : face}
      />

      <div className="s-feed">
        {team && <div className="note-line">Команда UHOME: события, услуги, знакомства, визы, жильё. Пишите как другу — разберёмся.</div>}
        {group && (
          <button className="note-line" style={{ textAlign: 'left' }} onClick={() => go(`/group/${id}`)}>
            {group.short}: {group.about} <span className="gold">Состав и встречи →</span>
          </button>
        )}
        {messages.length === 0 && (
          <div className="note-line">Здесь пока пусто. Напишите первым — {person ? 'в клубе принято отвечать' : 'сообщество увидит сообщение сразу'}.</div>
        )}
        {messages.map((m, i) => {
          const day = dayLabel(m.at);
          const showDay = day !== lastDay;
          lastDay = day;
          const out = m.from === 'me';
          const prev = messages[i - 1];
          const next = messages[i + 1];
          const same = (a, b) => a && b && a.from === b.from && a.who === b.who && a.from !== 'sys' && dayLabel(a.at) === dayLabel(b.at);
          const cont = !showDay && same(prev, m);
          const lastOfRun = !same(m, next);
          const author = (community || group) && !out ? byId(m.who) : null;
          return (
            <div key={i} style={{ display: 'contents' }}>
              {showDay && <div className="s-day">{day}</div>}
              {m.from === 'sys' ? (
                <div className="note-line s-sys">{m.text}</div>
              ) : (
                <div className={`s-row${out ? ' s-row--out' : ''}${cont ? ' s-row--cont' : ''}`}>
                  {author && (lastOfRun ? <button className="s-row__ava" onClick={() => go(`/p/${author.id}`)} aria-label={author.name}><Avatar person={author} size={28} /></button> : <span className="s-row__ava" />)}
                  <div className={`s-b ${out ? 's-b--out' : 's-b--in'}`}>
                    {!out && !cont && (author || m.who) && <span className="s-b__who">{author ? author.name : m.who}</span>}
                    <span className="s-b__text">{m.text}</span>
                    <span className="s-b__time">{hm(m.at)}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <form className="s-comp" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <div className="s-comp__bar">
          <input className="s-comp__in" value={text} onChange={(e) => setText(e.target.value)} placeholder="Сообщение" enterKeyHint="send" aria-label="Сообщение" />
          <button className="s-comp__send" type="submit" disabled={!text.trim()} aria-label="Отправить"><Icon name="send" size={18} /></button>
        </div>
      </form>
    </div>
  );
}
