import { useState, useRef, useEffect } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { TopBar, Card, Btn, Empty, Tag } from '../components/UI.jsx';
import { Avatar, Cover } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';
import { circleById, THREADS } from '../data/life.js';
import { byId, RESIDENTS } from '../data/people.js';
import { canSee, visibleResidents } from '../lib/select.js';
import { agoHours, nf, plural } from '../lib/format.js';

export default function Circle({ id }) {
  const app = useApp();
  const c = circleById(id);
  const [text, setText] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [app.messages[id]?.length]);

  if (!c) return <Empty title="Круг не найден" />;
  if (!canSee(app.me, c.minTier, c.minDegree)) {
    return (
      <>
        <TopBar title={c.name} backTo="/circles" />
        <div className="screen">
          <Empty
            icon="lock"
            title="Круг закрыт"
            text={`Нужен уровень ${c.minTier} и степень ${c.minDegree}. Ни участники, ни переписка снаружи не видны.`}
            action={<Btn variant="quiet" size="sm" onClick={() => go('/degrees')}>Как получить доступ</Btn>}
          />
        </div>
      </>
    );
  }

  const joined = app.circles.includes(c.id);
  const thread = THREADS[c.id] || [];
  const mine = app.messages[c.id] || [];
  const curator = byId(c.curator);
  const members = visibleResidents(app.me).filter((r) => r.circle === c.id);

  const send = () => {
    if (!text.trim()) return;
    app.post(c.id, text.trim());
    setText('');
  };

  return (
    <>
      <TopBar
        title={c.name}
        subtitle={`${nf(c.members)} ${plural(c.members, 'участник', 'участника', 'участников')}`}
        backTo="/circles"
        right={
          <Btn size="sm" variant={joined ? 'quiet' : 'gold'} onClick={() => app.joinCircle(c.id, c.name)}>
            {joined ? 'Выйти' : 'Вступить'}
          </Btn>
        }
      />

      <div className="screen stack-16">
        <Cover art={c.art} seed={c.id} height={110} radius={18}>
          <div style={{ position: 'absolute', left: 14, right: 14, bottom: 11 }}>
            <div className="t-sm dim" style={{ lineHeight: 1.45 }}>{c.about}</div>
          </div>
        </Cover>

        <div className="scroller">
          {members.map((m) => (
            <button key={m.id} className="center" style={{ width: 58 }} onClick={() => go(`/p/${m.id}`)}>
              <Avatar person={m} size={38} dot={m.online} style={{ margin: '0 auto' }} />
              <div className="t-xs dim-2" style={{ marginTop: 5 }}>{m.name.split(' ')[0]}</div>
            </button>
          ))}
        </div>

        <div className="stack-8">
          {thread.map((m, i) => {
            const p = byId(m.who);
            return (
              <div key={i} className="row-t" style={{ gap: 9 }}>
                <button onClick={() => go(`/p/${m.who}`)} style={{ flex: 'none' }}>
                  <Avatar person={p} size={30} />
                </button>
                <div>
                  <div className="row" style={{ gap: 7 }}>
                    <span className="t-xs" style={{ fontWeight: 700 }}>{p?.name}</span>
                    {m.who === c.curator && <Tag tone="gold">куратор</Tag>}
                    <span className="t-xs dim-2">{agoHours(m.ago)}</span>
                  </div>
                  <div className="msg msg--in" style={{ marginTop: 5 }}>{m.text}</div>
                </div>
              </div>
            );
          })}

          {mine.map((m, i) => (
            <div key={'me' + i} className="msg msg--out">{m.text}</div>
          ))}
          <div ref={endRef} />
        </div>

        {joined ? (
          <div className="row" style={{ gap: 8, position: 'sticky', bottom: 'calc(var(--tab-h) + 10px)' }}>
            <input
              className="field grow"
              placeholder="Написать в круг"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
            />
            <button className="iconbtn" style={{ background: 'var(--gold)', color: '#241a07', borderColor: 'transparent' }} onClick={send}>
              <Icon name="up" size={18} width={2} />
            </button>
          </div>
        ) : (
          <Card className="center">
            <div className="t-sm dim">Вступите в круг, чтобы писать и получать приглашения на встречи.</div>
            <Btn variant="gold" wide style={{ marginTop: 12 }} onClick={() => app.joinCircle(c.id, c.name)}>Вступить</Btn>
          </Card>
        )}
      </div>
    </>
  );
}
