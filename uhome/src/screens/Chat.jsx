import { useEffect, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { messagesOf } from '../lib/select.js';
import { groupById } from '../lib/groups.js';
import { byId, toneOf } from '../data/people.js';
import { communityById } from '../data/communities.js';
import { REGIONS } from '../data/regions.js';
import { seeded } from '../lib/art.js';
import { TopBar, Empty } from '../components/UI.jsx';
import { Avatar, GroupAva } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';
import Flag from '../components/Flag.jsx';

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
    ? id === 'team' ? 'Отвечаем за 15 минут' : <>{person.online ? 'онлайн' : 'не в сети'} · <Flag cc={REGIONS[person.region].cc} size={12} /> {person.city}</>
    : group ? `${group.members.length + 1} участников · ${group.when}` : `${community.members} участников`;
  const to = person ? (id === 'team' ? '/profile' : `/p/${id}`) : group ? `/group/${id}` : `/community/${id}`;

  let lastDay = '';
  let prev = null;

  return (
    <div className="screen screen--nested screen--chat xc">
      <TopBar
        title={title}
        sub={sub}
        backTo="/chats"
        right={
          <button className="xc__who" onClick={() => go(to)} aria-label="Профиль">
            {person ? <Avatar person={person} size={38} /> : group ? <GroupAva members={group.members} size={38} /> : <span className="iconbtn"><Icon name="users" size={18} /></span>}
          </button>
        }
      />

      <div className="xc__feed">
        {id === 'team' && (
          <div className="xc__note">
            <span className="xc__note-k"><Icon name="spark" size={12} /> Команда UHOME</span>
            <span>События, услуги, знакомства, визы, жильё. Пишите как другу — разберёмся.</span>
          </div>
        )}
        {group && (
          <button className="xc__note" onClick={() => go(`/group/${id}`)}>
            <span className="xc__note-k"><Icon name={group.icon} size={12} /> {group.short || 'Группа'}</span>
            <span>{group.about} <span className="gold">Состав и встречи →</span></span>
          </button>
        )}
        {messages.length === 0 && (
          <div className="xc__empty">
            <span className="xc__empty-k">Канал открыт</span>
            Здесь пока пусто. Напишите первым — {person ? 'в клубе принято отвечать' : 'сообщество увидит сообщение сразу'}.
          </div>
        )}
        {messages.map((m, i) => {
          const day = dayLabel(m.at);
          const showDay = day !== lastDay;
          lastDay = day;
          const out = m.from === 'me';
          const author = (community || group) && !out ? byId(m.who) : null;
          const cont = !showDay && prev && prev.from === m.from && prev.who === m.who && m.from !== 'sys';
          prev = m;
          if (m.from === 'sys') {
            return (
              <div key={i} style={{ display: 'contents' }}>
                {showDay && <div className="xc__day"><span>{day}</span></div>}
                <div className="xc__sys">
                  <span className="xc__sys-k"><Icon name="spark" size={12} /> Интро · UHOME</span>
                  <span>{m.text}</span>
                </div>
              </div>
            );
          }
          const bubble = (
            <div className={`xb ${out ? 'xb--out' : 'xb--in'}${cont ? ' xb--cont' : ''}`}>
              {author && !cont && <span className="xb__who" style={{ color: toneOf(author) }}>{author.name}</span>}
              {!out && m.who && !author && !cont && <span className="xb__who">{m.who}</span>}
              <span className="xb__text">{m.text}</span>
              <span className="xb__sp" aria-hidden="true" />
              <span className="xb__time">{hm(m.at)}{out && <Icon name="check" size={11} width={2.2} />}</span>
            </div>
          );
          // в группе у последнего сообщения серии — лицо автора, как в мессенджере
          const next = messages[i + 1];
          const lastOfRun = !next || next.from !== m.from || next.who !== m.who || dayLabel(next.at) !== day;
          return (
            <div key={i} style={{ display: 'contents' }}>
              {showDay && <div className="xc__day"><span>{day}</span></div>}
              {author ? (
                <div className={`xb-row${cont ? ' xb-row--cont' : ''}`}>
                  {lastOfRun ? <button className="xb-row__ava" onClick={() => go(`/p/${author.id}`)} aria-label={author.name}><Avatar person={author} size={28} /></button> : <span className="xb-row__sp" />}
                  {bubble}
                </div>
              ) : bubble}
            </div>
          );
        })}
      </div>

      <form className="xcomp" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <div className="xcomp__bar">
          <input className="xcomp__in" value={text} onChange={(e) => setText(e.target.value)} placeholder="Сообщение" enterKeyHint="send" aria-label="Сообщение" />
          <button className="xcomp__send" type="submit" disabled={!text.trim()} aria-label="Отправить">
            <Icon name="send" size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}
