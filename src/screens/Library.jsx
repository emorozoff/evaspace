import { useMemo, useState, useEffect } from 'react';
import { useStore } from '../lib/store.jsx';
import { TYPE_META, ALL_TAGS } from '../data/content.js';
import { LessonRow, Empty, MatchRing } from '../components/UI.jsx';
import { IcSearch, IcFilter, IcClose } from '../components/Icons.jsx';
import { go } from '../lib/router.jsx';
import { whyLesson } from '../lib/matching.js';

const TABS = [
  { id: 'all', label: 'Всё' },
  { id: 'affirmation', label: 'Аффирмации' },
  { id: 'practice', label: 'Практики' },
  { id: 'masterclass', label: 'Мастер-классы' },
];

export default function Library() {
  const { state, allLessons } = useStore();
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [tags, setTags] = useState([]);

  // тег может прийти из ссылки: #/library?tag=йога
  useEffect(() => {
    const raw = window.location.hash.split('?')[1];
    if (!raw) return;
    const p = new URLSearchParams(raw);
    const t = p.get('tag');
    if (t) setTags([decodeURIComponent(t)]);
  }, []);

  const tagCounts = useMemo(() => {
    const c = {};
    allLessons.forEach((l) => (l.tags || []).forEach((t) => (c[t] = (c[t] || 0) + 1)));
    return c;
  }, [allLessons]);

  const popularTags = useMemo(() => ALL_TAGS.filter((t) => tagCounts[t]).sort((a, b) => tagCounts[b] - tagCounts[a]), [tagCounts]);

  const list = useMemo(() => {
    const ql = q.toLowerCase().trim();
    return allLessons
      .filter((l) => (tab === 'all' ? true : l.type === tab))
      .filter((l) => (tags.length ? tags.every((t) => (l.tags || []).includes(t)) : true))
      .filter((l) => (ql ? `${l.title} ${l.sub || ''} ${l.about || ''} ${(l.tags || []).join(' ')}`.toLowerCase().includes(ql) : true))
      .map((l) => ({ l, w: whyLesson(l, state.program?.weights, state.program?.meta) }))
      .sort((a, b) => b.w.percent - a.w.percent);
  }, [allLessons, tab, tags, q, state.program]);

  const toggleTag = (t) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  return (
    <div className="screen">
      <div className="topbar">
        <div style={{ flex: 1 }}>
          <div className="eyebrow">Библиотека</div>
          <h1 style={{ marginTop: 2 }}>Весь контент</h1>
        </div>
      </div>

      <div className="pad">
        <div className="row" style={{ gap: 8 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{ position: 'absolute', left: 14, top: 12, color: 'var(--muted)' }}>
              <IcSearch size={19} />
            </span>
            <input className="input" style={{ paddingLeft: 42 }} placeholder="Поиск: тревога, йога, сон…" value={q} onChange={(e) => setQ(e.target.value)} />
            {q && (
              <button style={{ position: 'absolute', right: 12, top: 12, color: 'var(--muted)' }} onClick={() => setQ('')}>
                <IcClose size={18} />
              </button>
            )}
          </div>
        </div>

        <div className="seg" style={{ marginTop: 12 }}>
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="pad">
      <div className="chips scroll" style={{ marginTop: 12 }}>
        {tags.length > 0 && (
          <button className="chip on" onClick={() => setTags([])}>
            <IcClose size={13} /> Сбросить
          </button>
        )}
        {popularTags.map((t) => (
          <button key={t} className={'chip' + (tags.includes(t) ? ' on' : '')} onClick={() => toggleTag(t)}>
            {t} <span style={{ opacity: 0.55, fontWeight: 700 }}>{tagCounts[t]}</span>
          </button>
        ))}
      </div>
      </div>

      <div className="pad" style={{ marginTop: 14 }}>
        <div className="row between" style={{ marginBottom: 10 }}>
          <div className="tiny muted">
            Найдено {list.length} из {allLessons.length} · отсортировано по совпадению с тобой
          </div>
        </div>

        {list.length === 0 ? (
          <Empty emoji="🔍" title="Ничего не нашлось" text="Попробуй убрать фильтры или изменить запрос" action={<button className="btn ghost sm" onClick={() => { setTags([]); setQ(''); setTab('all'); }}>Сбросить всё</button>} />
        ) : (
          <div className="stack">
            {list.map(({ l, w }) => (
              <LessonRow
                key={l.id}
                lesson={l}
                percent={w.percent}
                done={Object.keys(state.done).some((k) => k.endsWith(':' + l.id))}
                onClick={() => go(`/lesson/x/${l.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
