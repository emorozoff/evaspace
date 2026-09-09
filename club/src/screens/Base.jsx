import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { materialsFor, isViewed, archiveCount } from '../lib/logic.js';
import { dateShort } from '../lib/time.js';
import { preview } from '../lib/video.js';
import { money, hash } from '../lib/format.js';
import { Btn, Card, Empty, List, Item, Picker, Search, TopBar } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';

const TYPES = ['эфир', 'воркшоп', 'мастермайнд', 'гайд'].map((t) => ({ id: t, label: t[0].toUpperCase() + t.slice(1) }));
const TYPE_TONE = { эфир: 'blue', воркшоп: 'accent', мастермайнд: 'violet', гайд: 'warm' };
const ARCHIVE_PRICE = 990;

export default function Base() {
  const { state, me, dispatch } = useStore();
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [topic, setTopic] = useState('all');

  const all = materialsFor(state, me);
  const topics = useMemo(() => [...new Set(all.map((m) => m.topic))].map((t) => ({ id: t, label: t })), [all]);
  const list = all.filter((m) =>
    (type === 'all' || m.type === type) &&
    (topic === 'all' || m.topic === topic) &&
    (!query || `${m.title} ${m.description}`.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="screen" style={{ paddingTop: 0 }}>
      <TopBar title="База знаний" sub="Эфиры, воркшопы и гайды клуба" backTo="/" />
      <div className="stack-20">
        <div className="stack-8">
          <Search value={query} onChange={setQuery} placeholder="Поиск по названию" />
          <div className="filters">
            <Picker label="Все типы" title="Тип материала" options={TYPES} value={type} onChange={setType} allLabel="Все типы" />
            <Picker label="Все темы" title="Тема" options={topics} value={topic} onChange={setTopic} allLabel="Все темы" />
          </div>
        </div>

        {list.length === 0 ? (
          <Empty title="Ничего не нашлось" text="Попробуйте другой запрос или снимите фильтры." />
        ) : (
          <List>
            {list.map((m) => (
              <Item
                key={m.id}
                lead={<MaterialThumb material={m} size={52} />}
                title={<span className="clamp-2" style={{ whiteSpace: 'normal', lineHeight: 1.3 }}>{m.title}</span>}
                sub={<><span style={{ color: `var(--${TYPE_TONE[m.type] === 'accent' ? 'accent' : TYPE_TONE[m.type]})` }}>{m.type}</span> · {m.topic} · {dateShort(m.publishedAt)}{m.seasonId < state.season.id ? ' · архив' : ''}</>}
                meta={isViewed(state, m.id, me.id) ? <Icon name="check" size={16} color="var(--accent)" /> : undefined}
                onClick={() => go(`/material/${m.id}`)}
              />
            ))}
          </List>
        )}

        {!me.archive && archiveCount(state) > 0 && (
          <Card variant="violet">
            <div className="t-lg">Архив прошлых сезонов</div>
            <div className="t-sm dim" style={{ marginTop: 4 }}>{archiveCount(state)} материала: эфиры, мастермайнды и гайды первого сезона.</div>
            <Btn variant="ghost" size="sm" style={{ marginTop: 12 }} onClick={() => dispatch({ type: 'buyArchive' })}>Открыть за {money(ARCHIVE_PRICE)}</Btn>
          </Card>
        )}
      </div>
    </div>
  );
}

/** Превью: обложка YouTube, если сеть есть; иначе — тихий градиент с play. */
export function MaterialThumb({ material, size = 44 }) {
  const cover = preview(material.videoUrl);
  const hue = hash(material.id) % 360;
  return (
    <div className="thumb" style={{ width: size, height: size, background: `linear-gradient(135deg, hsl(${hue} 30% 26%), #0f121a)` }}>
      {cover && <img src={cover} alt="" loading="lazy" onError={(e) => (e.currentTarget.style.display = 'none')} />}
      <div className="thumb__play"><i><Icon name="play" size={11} /></i></div>
    </div>
  );
}
