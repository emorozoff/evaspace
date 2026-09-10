import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { materialsFor, isViewed, archiveCount, baseOrder, isNew, isPinned, MAX_PINNED } from '../lib/logic.js';
import { dateShort } from '../lib/time.js';
import { preview } from '../lib/video.js';
import { money, hash } from '../lib/format.js';
import { Btn, Card, Empty, List, Item, Picker, Search, Section, Tag, TopBar } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';

const TYPES = ['эфир', 'воркшоп', 'мастермайнд', 'гайд'].map((t) => ({ id: t, label: t[0].toUpperCase() + t.slice(1) }));
const TYPE_TONE = { эфир: 'blue', воркшоп: 'accent', мастермайнд: 'violet', гайд: 'warm' };
const ARCHIVE_PRICE = 990;

export default function Base({ now = Date.now() }) {
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
  // Закреп держится наверху, новинки идут следом, дальше — по дате
  const filtered = type !== 'all' || topic !== 'all' || query;
  const order = baseOrder(list, state, now);
  // Значки нужны только там, где раздел сам о них не говорит
  const row = (m, badges = false) => (
    <Item
      key={m.id}
      lead={<MaterialThumb material={m} size={52} />}
      title={<span className="clamp-2" style={{ whiteSpace: 'normal', lineHeight: 1.3 }}>{m.title}</span>}
      sub={<><span style={{ color: `var(--${TYPE_TONE[m.type] === 'accent' ? 'accent' : TYPE_TONE[m.type]})` }}>{m.type}</span> · {m.topic} · {dateShort(m.publishedAt)}{m.seasonId < state.season.id ? ' · архив' : ''}</>}
      meta={
        <span className="row" style={{ gap: 6 }}>
          {badges && isNew(m, now) && <Tag tone="accent">новинка</Tag>}
          {badges && isPinned(state, m.id) && <Icon name="pin" size={14} color="var(--warm)" />}
          {isViewed(state, m.id, me.id) && <Icon name="check" size={16} color="var(--accent)" />}
        </span>
      }
      onClick={() => go(`/material/${m.id}`)}
    />
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
        ) : filtered ? (
          <List>{list.map((m) => row(m, true))}</List>
        ) : (
          <>
            {/* Закреп: приветствие, видео недели и словарь клуба */}
            <Section title="Закреплено" sub={`До ${MAX_PINNED} материалов — их видят все`}>
              <List>
                {order.pinned.map((m) => row(m))}
                <Item
                  icon="abc"
                  title="Гайд-словарь клуба"
                  sub="Раунды, метрики и сленг — от лёгкого к сложному"
                  meta={<Tag tone="warm">словарь</Tag>}
                  onClick={() => go('/dict')}
                />
              </List>
            </Section>

            {order.fresh.length > 0 && (
              <Section title="Новое" sub="Появилось за последнюю неделю">
                <List>{order.fresh.map((m) => row(m))}</List>
              </Section>
            )}

            {order.rest.length > 0 && (
              <Section title="Всё остальное">
                <List>{order.rest.map((m) => row(m))}</List>
              </Section>
            )}
          </>
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
