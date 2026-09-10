import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { chatMessages, chatsOf, userById, teamOf } from '../lib/logic.js';
import { timeOf, dateShort, sameDay } from '../lib/time.js';
import { Avatar, Empty, TopBar } from '../components/UI.jsx';
import TeamAvatar from '../components/TeamAvatar.jsx';
import Icon from '../components/Icons.jsx';

/* Разговор внутри приложения: команда, город и метчи. Никаких переходов наружу. */

export default function Chat({ id }) {
  const { state, me, dispatch } = useStore();
  const [text, setText] = useState('');
  const bottom = useRef(null);
  const key = decodeURIComponent(id || '');
  const info = chatsOf(state, me.id).find((c) => c.key === key);
  const list = chatMessages(state, key);

  useEffect(() => {
    dispatch({ type: 'readChat', chat: key });
  }, [key, dispatch]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [list.length]);

  if (!info) return <div className="screen"><Empty icon="message" title="Разговор не найден" text="Он открывается, когда появляется команда, город или метч." /></div>;

  const send = () => {
    if (!text.trim()) return;
    dispatch({ type: 'send', chat: key, text });
    setText('');
  };

  const lead = info.kind === 'team' ? <TeamAvatar team={info.team} size={34} radius={0.32} />
    : info.kind === 'dm' ? <Avatar user={info.user} size={34} />
    : <div className="item__ic" style={{ width: 34, height: 34, borderRadius: 11 }}><Icon name="city" size={17} /></div>;

  return (
    <div className="screen" style={{ paddingTop: 0 }}>
      <TopBar
        title={info.title}
        sub={info.kind === 'team' ? 'Чат команды' : info.kind === 'city' ? 'Чат города' : 'Личный чат'}
        backTo="/"
        right={<button className="iconbtn" onClick={() => info.kind === 'dm' ? go(`/person/${info.user.id}`) : info.kind === 'team' ? go('/team') : go(`/city/${info.city.id}`)}>{lead}</button>}
      />

      <div className="chat">
        {list.length === 0 && <Empty icon="message" title="Здесь пока тихо" text="Напишите первым — остальные подтянутся." />}
        {list.map((m, i) => {
          const author = m.userId === 'system' ? null : userById(state, m.userId);
          const mine = m.userId === me.id;
          const newDay = i === 0 || !sameDay(m.at, list[i - 1].at);
          return (
            <div key={m.id} style={{ display: 'contents' }}>
              {newDay && <div className="chat-day">{dateShort(m.at)}</div>}
              {m.userId === 'system' ? (
                <div className="bubble bubble--sys">{m.text}</div>
              ) : (
                <div className={`bubble ${mine ? 'bubble--out' : 'bubble--in'}`}>
                  {!mine && info.kind !== 'dm' && <span className="bubble__who">{author?.name.split(' ')[0]}</span>}
                  {m.text}
                  <div className="bubble__time">{timeOf(m.at)}</div>
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      <div className="composer">
        <input
          className="field"
          placeholder="Сообщение"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button className="composer__send" onClick={send} disabled={!text.trim()} aria-label="Отправить">
          <Icon name="send" size={18} />
        </button>
      </div>
    </div>
  );
}

/** Список разговоров — открывается из ближнего круга. */
export function Chats() {
  const { state, me } = useStore();
  const list = chatsOf(state, me.id);
  const team = teamOf(state, me.id);
  return (
    <div className="screen" style={{ paddingTop: 0 }}>
      <TopBar title="Сообщения" sub="Команда, город и знакомства" backTo="/" />
      {list.length === 0 ? (
        <Empty icon="message" title="Разговоров пока нет" text="Чат появится вместе с командой, городом или первым метчем." />
      ) : (
        <div className="list">
          {list.map((c) => {
            const lead = c.kind === 'team' ? <TeamAvatar team={c.team} size={44} />
              : c.kind === 'dm' ? <Avatar user={c.user} size={44} />
              : <div className="item__ic" style={{ width: 44, height: 44 }}><Icon name="city" size={20} /></div>;
            return (
              <button key={c.key} className="item" onClick={() => go(`/chat/${encodeURIComponent(c.key)}`)}>
                {lead}
                <div className="item__body">
                  <div className="item__t">{c.title}</div>
                  <div className="item__s">{c.last ? `${c.last.userId === me.id ? 'Вы: ' : ''}${c.last.text}` : 'Пока пусто'}</div>
                </div>
                <div className="item__meta">
                  {c.last && <span>{timeOf(c.last.at)}</span>}
                  {c.unread > 0 && <span className="count">{c.unread}</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}
      {!team && <div className="t-xs dim-2 center" style={{ marginTop: 16 }}>Чат команды появится, когда куратор определит вас в состав.</div>}
    </div>
  );
}
