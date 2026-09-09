import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { materialsFor, isViewed, archiveCount } from '../lib/logic.js';
import { dateShort } from '../lib/time.js';
import { preview } from '../lib/video.js';
import { money } from '../lib/format.js';
import { Btn, Card, Empty } from '../components/UI.jsx';
import { IcSpark, IcSearch, IcPlay, IcCheck } from '../components/Icons.jsx';

const TYPES = ['все', 'эфир', 'воркшоп', 'мастермайнд', 'гайд'];
const ARCHIVE_PRICE = 990;

export default function Base({ navigate }) {
  const { state, me, dispatch } = useStore();
  const [query, setQuery] = useState('');
  const [type, setType] = useState('все');
  const [topic, setTopic] = useState('все');

  const all = materialsFor(state, me);
  const topics = useMemo(() => ['все', ...new Set(all.map((m) => m.topic))], [all]);

  const list = all.filter((m) => {
    if (type !== 'все' && m.type !== type) return false;
    if (topic !== 'все' && m.topic !== topic) return false;
    if (query && !`${m.title} ${m.description}`.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="screen">
      <div className="topbar">
        <div className="logo">
          <div className="mark"><IcSpark size={16} className="t-lime" /></div>
          <h1>База знаний</h1>
        </div>
      </div>

      <div className="field" style={{ position: 'relative' }}>
        <input placeholder="Поиск по названию" value={query} onChange={(e) => setQuery(e.target.value)} style={{ paddingLeft: 40 }} />
        <span style={{ position: 'absolute', left: 13, top: 14, color: 'var(--dim)' }}>
          <IcSearch />
        </span>
      </div>

      <div className="chips" style={{ marginTop: 10 }}>
        {TYPES.map((t) => (
          <span key={t} className={`chip ${type === t ? 'on' : ''}`} onClick={() => setType(t)}>{t}</span>
        ))}
      </div>
      <div className="chips">
        {topics.map((t) => (
          <span key={t} className={`chip ${topic === t ? 'on' : ''}`} onClick={() => setTopic(t)}>{t}</span>
        ))}
      </div>

      {list.length === 0 && <Empty title="Ничего не нашлось" text="Попробуйте другой запрос или снимите фильтры." />}

      <div className="stack" style={{ marginTop: 6 }}>
        {list.map((m) => (
          <MaterialRow key={m.id} material={m} viewed={isViewed(state, m.id, me.id)} onOpen={() => navigate(`/base/${m.id}`)} />
        ))}
      </div>

      {!me.archive && archiveCount(state) > 0 && (
        <Card kind="violet" style={{ marginTop: 16 }}>
          <div className="t-title">Архив прошлых сезонов</div>
          <div className="t-sub" style={{ marginTop: 3 }}>
            {archiveCount(state)} материала из прошлых сезонов клуба: эфиры, мастермайнды и гайды.
          </div>
          <Btn kind="violet" wide small style={{ marginTop: 12 }} onClick={() => dispatch({ type: 'buyArchive' })}>
            Открыть за {money(ARCHIVE_PRICE)}
          </Btn>
        </Card>
      )}
    </div>
  );
}

export function MaterialRow({ material, viewed, onOpen }) {
  const cover = preview(material.videoUrl);
  return (
    <Card tap onClick={onOpen}>
      <div className="row top">
        <div className="video" style={{ width: 104, aspectRatio: '16/10', flex: 'none' }}>
          {cover && (
            <img
              src={cover}
              alt=""
              loading="lazy"
              onError={(e) => (e.currentTarget.style.display = 'none')}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
          <div className="play" style={{ width: 32, height: 32, position: 'relative' }}>
            <IcPlay size={13} />
          </div>
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, lineHeight: 1.25 }}>{material.title}</div>
          <div className="t-dim" style={{ marginTop: 4 }}>
            {material.type} · {material.topic} · {dateShort(material.publishedAt)}
          </div>
          {viewed && (
            <div className="t-lime" style={{ fontSize: 12, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <IcCheck size={13} /> просмотрено
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
