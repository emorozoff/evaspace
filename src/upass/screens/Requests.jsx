import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { Top, List, Item, Chip, Scroller, Sheet, Btn, Empty, Note, Tag } from '../components/UI.jsx';
import { Avatar } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';
import { REQUESTS, REQUEST_TAGS } from '../data/life.js';
import { REGIONS } from '../data/regions.js';
import { byId } from '../data/people.js';
import { agoHours, plural } from '../lib/format.js';

/* Лента запросов: короткий текст, теги, ответы в ветке или в личку. */
export default function Requests() {
  const app = useApp();
  const { me } = app;
  const [tag, setTag] = useState('all');
  const [scope, setScope] = useState('all');
  const [ask, setAsk] = useState(false);

  const all = useMemo(() => {
    const mine = app.requests.map((q) => ({ ...q, who: 'me', ago: (Date.now() - q.at) / 3.6e6, replies: [] }));
    let list = [...mine, ...REQUESTS];
    if (scope === 'region') list = list.filter((q) => q.region === me.city);
    if (scope === 'mine') list = list.filter((q) => q.who === 'me');
    if (tag !== 'all') list = list.filter((q) => q.tags.includes(tag));
    return list.sort((a, b) => a.ago - b.ago);
  }, [app.requests, tag, scope, me.city]);

  return (
    <div className="screen stack">
      <Top
        title="Запросы"
        sub="Что нужно прямо сейчас — и кто может помочь"
        right={<button className="iconbtn iconbtn--gold" onClick={() => setAsk(true)} aria-label="Написать запрос"><Icon name="plus" size={19} /></button>}
      />

      <Scroller>
        <Chip on={scope === 'all'} onClick={() => setScope('all')}>Все</Chip>
        <Chip on={scope === 'region'} onClick={() => setScope('region')}>{REGIONS[me.city].flag} Мой регион</Chip>
        <Chip on={scope === 'mine'} onClick={() => setScope('mine')}>Мои</Chip>
      </Scroller>

      <Scroller>
        <Chip on={tag === 'all'} onClick={() => setTag('all')}>Все темы</Chip>
        {REQUEST_TAGS.map((t) => <Chip key={t} on={tag === t} onClick={() => setTag(t)}>{t}</Chip>)}
      </Scroller>

      {all.length === 0 ? (
        <Empty icon="message" title="Пока пусто" text="Напишите первый запрос — сообщество отвечает в среднем за пару часов." action={<Btn size="sm" variant="gold" onClick={() => setAsk(true)}>Написать</Btn>} />
      ) : (
        <div className="stack-8">
          {all.map((q) => <RequestCard key={q.id} q={q} app={app} />)}
        </div>
      )}

      <Note icon="eye">Ответить можно прямо в ветке или написать автору в личку. Запросы видят все резиденты сообщества.</Note>

      <Sheet open={ask} onClose={() => setAsk(false)} title="Новый запрос" sub="Коротко и по делу — так отвечают быстрее">
        <AskForm app={app} onDone={() => setAsk(false)} />
      </Sheet>
    </div>
  );
}

export function RequestCard({ q, app, full }) {
  const p = q.who === 'me' ? app.me : byId(q.who);
  const replies = (q.replies || []).length + (app.replies[q.id] || []).length;
  return (
    <button className="card tap" style={{ display: 'block', width: '100%' }} onClick={() => go(`/request/${q.id}`)}>
      <div className="row" style={{ gap: 11 }}>
        <Avatar person={p} size={40} dot={p?.online} />
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 7 }}>
            <span className="t-md ell">{q.who === 'me' ? 'Вы' : p?.name}</span>
            <span className="t-xs dim-2">{agoHours(q.ago)}</span>
          </div>
          <div className="t-xs dim-2">{REGIONS[q.region]?.flag} {REGIONS[q.region]?.name}</div>
        </div>
      </div>
      <div className="t-sm" style={{ marginTop: 10, lineHeight: 1.5 }}>{q.text}</div>
      <div className="spread" style={{ marginTop: 11 }}>
        <div className="wrap" style={{ gap: 6 }}>
          {q.tags.map((t) => <Tag key={t} plain>#{t}</Tag>)}
        </div>
        <span className="t-xs dim-2 row" style={{ gap: 5 }}>
          <Icon name="message" size={13} />
          {replies || 0}
        </span>
      </div>
    </button>
  );
}

export function AskForm({ app, onDone }) {
  const [text, setText] = useState('');
  const [tags, setTags] = useState([]);
  const toggle = (t) => setTags((v) => (v.includes(t) ? v.filter((x) => x !== t) : v.length < 3 ? [...v, t] : v));
  return (
    <div className="stack">
      <textarea className="field" autoFocus placeholder="Что нужно? Чем конкретнее, тем быстрее ответят." value={text} onChange={(e) => setText(e.target.value)} style={{ minHeight: 120 }} />
      <div>
        <div className="label">Темы · до трёх</div>
        <div className="wrap">
          {['Визы', 'Жильё', 'Работа', 'Партнёрство', 'Совет', 'Инвестиции', 'Здоровье', 'Дети', 'Транспорт', 'Знакомство'].map((t) => (
            <Chip key={t} on={tags.includes(t)} onClick={() => toggle(t)}>{t}</Chip>
          ))}
        </div>
      </div>
      <Note icon="users">Запрос увидят резиденты во всех регионах, но первыми — те, кто рядом с вами.</Note>
      <Btn variant="gold" wide disabled={text.trim().length < 10 || !tags.length} onClick={() => { app.ask({ text: text.trim(), tags, region: app.me.city }); onDone(); }}>
        Опубликовать
      </Btn>
    </div>
  );
}
