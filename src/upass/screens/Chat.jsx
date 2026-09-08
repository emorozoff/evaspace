import { useEffect, useRef, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { TopBar, Empty, Btn, Note } from '../components/UI.jsx';
import { Avatar } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';
import { circleById, THREADS, DMS } from '../data/life.js';
import { byId } from '../data/people.js';
import { canSee, visibleResidents } from '../lib/select.js';
import { RESIDENTS } from '../data/people.js';
import { CircleIcon } from './Chats.jsx';
import { plural, nf } from '../lib/format.js';

/* Один экран для круга и личной переписки: заголовок, лента пузырей, поле ввода. */
export default function Chat({ kind, id }) {
  const app = useApp();
  const [text, setText] = useState('');
  const endRef = useRef(null);

  const circle = kind === 'circle' ? circleById(id) : null;
  const person = kind === 'dm' ? byId(id) : null;

  useEffect(() => {
    if (kind === 'dm') app.markSeen('dm-' + id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, kind]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [app.messages[id]?.length, app.dms[id]?.length]);

  if (kind === 'circle' && !circle) return <Empty title="Круг не найден" />;
  if (kind === 'dm' && !person) return <Empty title="Резидент не найден" />;

  if (circle && !canSee(app.me, circle.minTier, circle.minDegree)) {
    return (
      <>
        <TopBar title={circle.name} backTo="/chats" />
        <div className="screen">
          <Empty icon="lock" title="Круг закрыт" text={`Нужен уровень ${circle.minTier} и степень ${circle.minDegree}. Ни участники, ни переписка снаружи не видны.`} action={<Btn size="sm" variant="quiet" onClick={() => go('/degrees')}>Как получить доступ</Btn>} />
        </div>
      </>
    );
  }

  const joined = circle ? app.circles.includes(circle.id) : true;
  const base = circle ? THREADS[circle.id] || [] : DMS.find((d) => d.with === id)?.thread || [];
  const mine = circle ? app.messages[id] || [] : app.dms[id] || [];
  const members = circle ? visibleResidents(app.me).filter((r) => r.circle === circle.id) : [];

  const send = () => {
    if (!text.trim()) return;
    if (circle) app.post(circle.id, text.trim());
    else app.sendDm(id, text.trim());
    setText('');
  };

  const title = circle ? circle.name : person.name;
  const sub = circle
    ? `${nf(circle.members)} ${plural(circle.members, 'участник', 'участника', 'участников')} · куратор ${byId(circle.curator)?.name.split(' ')[0]}`
    : person.online ? 'в сети' : `${person.title} · ${person.company}`;

  return (
    <>
      <TopBar
        title={title}
        sub={sub}
        backTo="/chats"
        right={
          circle ? (
            <Btn size="sm" variant={joined ? 'quiet' : 'gold'} onClick={() => app.joinCircle(circle.id, circle.name)}>{joined ? 'Выйти' : 'Вступить'}</Btn>
          ) : (
            <button className="iconbtn" onClick={() => go(`/p/${person.id}`)}><Avatar person={person} size={32} /></button>
          )
        }
      />

      <div className="screen screen--chat">
        {circle && (
          <div className="scroller" style={{ paddingTop: 10 }}>
            <button className="center" style={{ width: 58 }} onClick={() => {}}>
              <CircleIcon c={circle} size={40} />
              <div className="t-xs dim-2" style={{ marginTop: 5 }}>круг</div>
            </button>
            {members.map((m) => (
              <button key={m.id} className="center" style={{ width: 58 }} onClick={() => go(`/p/${m.id}`)}>
                <Avatar person={m} size={40} dot={m.online} style={{ margin: '0 auto' }} />
                <div className="t-xs dim-2" style={{ marginTop: 5 }}>{m.name.split(' ')[0]}</div>
              </button>
            ))}
          </div>
        )}

        <div className="chat">
          <div className="chat__day">{circle ? 'Последние сообщения' : 'Переписка'}</div>
          {base.map((m, i) => {
            const isMe = m.who === 'me';
            const p = isMe ? null : byId(m.who);
            return (
              <div key={i} className={`bubble ${isMe ? 'bubble--out' : 'bubble--in'}`}>
                {circle && !isMe && (
                  <button className="bubble__who" onClick={() => go(`/p/${m.who}`)}>
                    {p?.name}{m.who === circle.curator ? ' · куратор' : ''}
                  </button>
                )}
                {m.text}
                <div className="bubble__time">{m.ago ? (m.ago < 24 ? `${Math.round(m.ago)} ч назад` : `${Math.round(m.ago / 24)} дн назад`) : ''}</div>
              </div>
            );
          })}
          {mine.map((m, i) => (
            <div key={'me' + i} className="bubble bubble--out">
              {m.text}
              <div className="bubble__time">{new Date(m.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {joined ? (
          <div className="composer">
            <input className="field grow" placeholder="Сообщение" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
            <button className="iconbtn iconbtn--gold" onClick={send} aria-label="Отправить"><Icon name="send" size={18} width={1.9} /></button>
          </div>
        ) : (
          <div className="composer">
            <Btn variant="gold" wide onClick={() => app.joinCircle(circle.id, circle.name)}>Вступить, чтобы писать</Btn>
          </div>
        )}
      </div>
    </>
  );
}
