import { useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { TopBar, List, Item, Btn, Empty, Tag, Note, Section } from '../components/UI.jsx';
import { Avatar } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';
import { requestById } from '../data/life.js';
import { REGIONS } from '../data/regions.js';
import { byId } from '../data/people.js';
import { agoHours } from '../lib/format.js';

export default function Request({ id }) {
  const app = useApp();
  const [text, setText] = useState('');
  const own = app.requests.find((r) => r.id === id);
  const q = own ? { ...own, who: 'me', ago: (Date.now() - own.at) / 3.6e6, replies: [] } : requestById(id);

  if (!q) return <Empty title="Запрос не найден" />;

  const p = q.who === 'me' ? app.me : byId(q.who);
  const mine = app.replies[q.id] || [];

  return (
    <>
      <TopBar title="Запрос" sub={`${REGIONS[q.region]?.flag} ${REGIONS[q.region]?.name}`} backTo="/requests" />
      <div className="screen stack-20">
        <div className="card">
          <button className="row" style={{ gap: 11, width: '100%' }} onClick={() => q.who !== 'me' && go(`/p/${q.who}`)}>
            <Avatar person={p} size={46} dot={p?.online} />
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="t-md">{q.who === 'me' ? 'Вы' : p?.name}</div>
              <div className="t-xs dim">{q.who === 'me' ? 'ваш запрос' : `${p?.title} · ${p?.company}`} · {agoHours(q.ago)}</div>
            </div>
          </button>
          <div className="t-sm" style={{ marginTop: 12, lineHeight: 1.6 }}>{q.text}</div>
          <div className="wrap" style={{ marginTop: 12, gap: 6 }}>
            {q.tags.map((t) => <Tag key={t} plain>#{t}</Tag>)}
          </div>
        </div>

        {q.who !== 'me' && (
          <div className="row" style={{ gap: 10 }}>
            <Btn variant="ghost" wide icon="message" onClick={() => go(`/dm/${q.who}`)}>Написать в личку</Btn>
            {own === undefined && <Btn variant="quiet" icon="x" onClick={() => app.say('Скрыто из ленты')}>Скрыть</Btn>}
          </div>
        )}
        {q.who === 'me' && (
          <Btn variant="danger" wide icon="x" onClick={() => { app.dropRequest(q.id); go('/requests'); }}>Снять запрос</Btn>
        )}

        <Section title={`Ответы · ${(q.replies?.length || 0) + mine.length}`}>
          {(q.replies?.length || 0) + mine.length === 0 ? (
            <Note icon="message">Ответов пока нет. Если знаете, чем помочь, — напишите первым.</Note>
          ) : (
            <div className="stack-8">
              {(q.replies || []).map((rep, i) => {
                const a = byId(rep.who);
                return (
                  <div key={i} className="card">
                    <button className="row" style={{ gap: 10, width: '100%' }} onClick={() => go(`/p/${rep.who}`)}>
                      <Avatar person={a} size={34} dot={a?.online} />
                      <div className="grow" style={{ minWidth: 0 }}>
                        <div className="t-sm" style={{ fontWeight: 600 }}>{a?.name}</div>
                        <div className="t-xs dim-2">{agoHours(rep.ago)}</div>
                      </div>
                      <Icon name="right" size={15} color="var(--ink-4)" />
                    </button>
                    <div className="t-sm" style={{ marginTop: 9, lineHeight: 1.5 }}>{rep.text}</div>
                  </div>
                );
              })}
              {mine.map((rep, i) => (
                <div key={'me' + i} className="card card--gold">
                  <div className="row" style={{ gap: 10 }}>
                    <Avatar person={app.me} size={34} />
                    <div className="grow">
                      <div className="t-sm" style={{ fontWeight: 600 }}>Вы</div>
                      <div className="t-xs dim-2">{new Date(rep.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>
                  <div className="t-sm" style={{ marginTop: 9, lineHeight: 1.5 }}>{rep.text}</div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <div className="composer" style={{ background: 'transparent' }}>
          <input className="field grow" placeholder="Ответить в ветке" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && text.trim() && (app.replyTo(q.id, text.trim()), setText(''))} />
          <button className="iconbtn iconbtn--gold" aria-label="Отправить" onClick={() => text.trim() && (app.replyTo(q.id, text.trim()), setText(''))}>
            <Icon name="send" size={18} width={1.9} />
          </button>
        </div>
      </div>
    </>
  );
}
