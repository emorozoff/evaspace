import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { Top, Chip, Sheet, Btn, Empty, Note, Picker } from '../components/UI.jsx';
import { Avatar } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';
import { REQUESTS, REQUEST_TAGS, requestTag, autoRequestText, topicsPhrase } from '../data/life.js';
import { REGIONS } from '../data/regions.js';
import { byId } from '../data/people.js';
import { agoHours } from '../lib/format.js';

/* Лента запросов. Ответить можно прямо в карточке — экран запроса нужен
   только чтобы прочитать всю ветку. */
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

      <div className="filters">
        <Picker
          label="Все"
          summary={scope === 'all' ? 'Все' : scope === 'region' ? `${REGIONS[me.city].flag} Мой регион` : 'Мои'}
          title="Чьи запросы"
          options={[
            { id: 'region', lead: REGIONS[me.city].flag, name: 'Мой регион', sub: REGIONS[me.city].name },
            { id: 'mine', lead: '📌', name: 'Мои запросы' },
          ]}
          value={scope}
          onChange={setScope}
          allLabel="Все запросы"
        />
        <Picker
          label="Тема"
          summary={tag === 'all' ? 'Тема' : `${requestTag(tag).emoji} ${requestTag(tag).name}`}
          title="Тема"
          options={REQUEST_TAGS.map((t) => ({ id: t.id, lead: t.emoji, name: t.name }))}
          value={tag}
          onChange={setTag}
          allLabel="Все темы"
        />
      </div>

      {all.length === 0 ? (
        <Empty icon="message" title="Пока пусто" text="Напишите первый запрос — сообщество отвечает в среднем за пару часов." action={<Btn size="sm" variant="gold" onClick={() => setAsk(true)}>Написать</Btn>} />
      ) : (
        <div className="stack-8">
          {all.map((q) => <RequestCard key={q.id} q={q} app={app} />)}
        </div>
      )}

      <Note icon="eye">Ответ уходит в ветку запроса и автору в личку. Запросы видят все резиденты сообщества.</Note>

      <Sheet open={ask} onClose={() => setAsk(false)} title="Новый запрос" sub="Хватит и одних тем — текст соберётся сам">
        <AskForm app={app} onDone={() => setAsk(false)} />
      </Sheet>
    </div>
  );
}

export function RequestCard({ q, app }) {
  const [text, setText] = useState('');
  const p = q.who === 'me' ? app.me : byId(q.who);
  const own = app.replies[q.id] || [];
  const total = (q.replies || []).length + own.length;

  const send = () => {
    if (!text.trim()) return;
    app.replyTo(q.id, text.trim());
    setText('');
  };

  return (
    <div className="card">
      <button className="row" style={{ gap: 11, width: '100%' }} onClick={() => q.who !== 'me' && go(`/p/${q.who}`)}>
        <Avatar person={p} size={40} dot={p?.online} />
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 7 }}>
            <span className="t-md ell">{q.who === 'me' ? 'Вы' : p?.name}</span>
            <span className="t-xs dim-2">{agoHours(q.ago)}</span>
          </div>
          <div className="t-xs dim-2">{REGIONS[q.region]?.flag} {REGIONS[q.region]?.name}</div>
        </div>
      </button>

      <div className="t-sm" style={{ marginTop: 10, lineHeight: 1.5 }}>{q.text}</div>

      <div className="wrap" style={{ gap: 6, marginTop: 11 }}>
        {q.tags.map((t) => {
          const meta = requestTag(t);
          return <span key={t} className="tag tag--plain">{meta ? `${meta.emoji} ${meta.name}` : t}</span>;
        })}
      </div>

      {/* последний ответ виден сразу, вся ветка — по «Открыть» */}
      <button className="reply" onClick={() => go(`/request/${q.id}`)}>
        {total > 0 ? (
          <>
            <span className="reply__who">{lastAuthor(q, own)}</span>
            <span className="reply__t ell">{lastText(q, own)}</span>
            <span className="reply__more">Открыть · {total}</span>
          </>
        ) : (
          <>
            <span className="reply__t dim-2">Ответов пока нет</span>
            <span className="reply__more">Открыть</span>
          </>
        )}
      </button>

      <div className="composer composer--inline">
        <input
          className="field grow"
          placeholder={q.who === 'me' ? 'Добавить к запросу' : 'Ответить в ветке'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button className="iconbtn iconbtn--gold" onClick={send} aria-label="Отправить">
          <Icon name="send" size={17} width={1.9} />
        </button>
      </div>
    </div>
  );
}

const lastAuthor = (q, own) => {
  if (own.length) return 'Вы';
  const r = (q.replies || [])[q.replies.length - 1];
  return byId(r.who)?.name.split(' ')[0] || '';
};
const lastText = (q, own) => (own.length ? own[own.length - 1].text : (q.replies || [])[q.replies.length - 1]?.text || '');

/* Запрос можно собрать из одних тем: текст напишется сам, а вариант подачи
   каждый раз новый — иначе лента превращается в одинаковые объявления. */
export function AskForm({ app, onDone }) {
  const [text, setText] = useState('');
  const [tags, setTags] = useState([]);
  const auto = !text.trim();
  const preview = tags.length ? autoRequestText(app.me.city, tags, app.askVariant) : '';

  const toggle = (t) => setTags((v) => (v.includes(t) ? v.filter((x) => x !== t) : v.length < 3 ? [...v, t] : v));

  return (
    <div className="stack">
      <div>
        <div className="label">Темы · до трёх</div>
        <div className="wrap">
          {REQUEST_TAGS.map((t) => (
            <Chip key={t.id} on={tags.includes(t.id)} onClick={() => toggle(t.id)}>{t.emoji} {t.name}</Chip>
          ))}
        </div>
      </div>

      <textarea
        className="field"
        placeholder="Можно оставить пустым — текст соберётся из тем"
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{ minHeight: 96 }}
      />

      {auto && tags.length > 0 && (
        <div className="card card--gold">
          <div className="eyebrow eyebrow--gold">Опубликуем так</div>
          <div className="t-sm" style={{ marginTop: 7, lineHeight: 1.5 }}>{preview}</div>
        </div>
      )}

      <Note icon="users">
        {tags.length
          ? `Тема: ${topicsPhrase(tags)}. Первыми увидят те, кто рядом с вами.`
          : 'Выберите хотя бы одну тему — по ней запрос найдут те, кто может помочь.'}
      </Note>

      <Btn
        variant="gold"
        wide
        disabled={!tags.length || (!auto && text.trim().length < 10)}
        onClick={() => {
          app.ask({ text: auto ? preview : text.trim(), tags, region: app.me.city, auto });
          onDone();
        }}
      >
        {auto ? 'Опубликовать готовый текст' : 'Опубликовать'}
      </Btn>
    </div>
  );
}
