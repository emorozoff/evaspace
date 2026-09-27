import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { MATERIALS, MATERIAL_KINDS, TOPICS } from '../data/base.js';
import { COMMUNITIES, localOf } from '../data/communities.js';
import { REGIONS } from '../data/regions.js';
import { byId } from '../data/people.js';
import { count, ago } from '../lib/format.js';
import { Top, Seg, Search, Picker, Section, Empty, Btn } from '../components/UI.jsx';
import { MaterialCover, Scene, Thumb } from '../components/Covers.jsx';
import { AvaStack } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';

/* База: две вкладки. «Знания» — записи Zoom-эфиров и гайды с таймкодами
   и главными мыслями. «Сообщества» — пять локальных по регионам клуба
   и пять по интересам; своё локальное стоит первым. */

export default function Base({ query }) {
  const app = useApp();
  const [tab, setTab] = useState(query.tab || 'know');
  const change = (t) => {
    setTab(t);
    history.replaceState(null, '', `#/base?tab=${t}`);
  };

  return (
    <div className="screen stack-24 rise-in">
      <div>
        <Top
          title="База"
          sub={tab === 'know'
            ? `${count(MATERIALS.filter((m) => m.kind === 'zoom').length, 'запись', 'записи', 'записей')} эфиров и ${count(MATERIALS.filter((m) => m.kind === 'guide').length, 'гайд', 'гайда', 'гайдов')}`
            : `${count(COMMUNITIES.length, 'сообщество', 'сообщества', 'сообществ')} · вы в ${app.joined.length}`}
        />
        <Seg value={tab} onChange={change} options={[{ value: 'know', label: 'База знаний' }, { value: 'comm', label: 'Сообщества' }]} />
      </div>
      {tab === 'know' ? <Knowledge app={app} /> : <Communities app={app} />}
    </div>
  );
}

/* ——— знания ——— */

function Knowledge({ app }) {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const [topic, setTopic] = useState('all');
  const filtered = kind !== 'all' || topic !== 'all' || q;

  const list = useMemo(
    () =>
      MATERIALS.filter((m) => {
        if (kind !== 'all' && m.kind !== kind) return false;
        if (topic !== 'all' && m.topic !== topic) return false;
        if (q && !`${m.title} ${m.about}`.toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }).sort((a, b) => a.daysAgo - b.daysAgo),
    [q, kind, topic]
  );
  const pinned = MATERIALS.filter((m) => m.pinned);

  return (
    <div className="stack-24">
      <div className="stack">
        <Search value={q} onChange={setQ} placeholder="Визы, налоги, недвижимость…" />
        <div className="filters">
          <Picker label="Формат" summary={MATERIAL_KINDS.find((k) => k.id === kind).name} options={MATERIAL_KINDS} value={kind} onChange={setKind} />
          <Picker
            label="Тема"
            summary={topic === 'all' ? 'Все темы' : `${TOPICS.find((t) => t.id === topic).emoji} ${TOPICS.find((t) => t.id === topic).name}`}
            options={[{ id: 'all', name: 'Все темы', lead: '✦' }, ...TOPICS.map((t) => ({ id: t.id, name: t.name, lead: t.emoji, meta: <span className="t-xs dim-2">{MATERIALS.filter((m) => m.topic === t.id).length}</span> }))]}
            value={topic}
            onChange={setTopic}
          />
        </div>
      </div>

      {!filtered && (
        <Section title="Главное сейчас" note="Закрепила команда клуба">
          <div className="scroller">
            {pinned.map((m) => (
              <button key={m.id} className="feat" onClick={() => go(`/material/${m.id}`)}>
                <MaterialCover material={m} height={140} radius={0} big>
                  <div className="scene__top">
                    <span className="glass"><Icon name="video" size={12} /> Zoom · {m.dur}</span>
                    {app.watched[m.id] && <span className="glass" style={{ color: 'var(--sea)' }}><Icon name="check" size={12} /></span>}
                  </div>
                </MaterialCover>
                <div className="feat__body">
                  <div className="t-md clamp-2" style={{ lineHeight: 1.3 }}>{m.title}</div>
                  <div className="row" style={{ gap: 8, marginTop: 6 }}>
                    <AvaStack people={m.speakers.map(byId)} size={22} />
                    <span className="t-xs dim-2 ell">{m.speakers.map((s) => byId(s).name.split(' ')[0]).join(', ')}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Section>
      )}


      <Section
        title={filtered ? `Нашлось · ${list.length}` : 'Все материалы'}
        more={filtered ? 'Сбросить' : undefined}
        onMore={() => { setQ(''); setKind('all'); setTopic('all'); }}
      >
        {list.length === 0 ? (
          <Empty title="Ничего не нашли" text="Попробуйте другую тему или спросите в сообществе — запишем эфир." />
        ) : (
          <div className="list">
            {list.map((m) => <MaterialRow key={m.id} m={m} watched={app.watched[m.id]} />)}
          </div>
        )}
      </Section>
    </div>
  );
}

export function MaterialRow({ m, watched }) {
  return (
    <button className="mat" onClick={() => go(`/material/${m.id}`)}>
      <div className="thumb"><MaterialCover material={m} height={64} radius={14} /></div>
      <div className="grow">
        <div className="t-md clamp-2" style={{ lineHeight: 1.3 }}>{m.title}</div>
        <div className="t-xs dim-2" style={{ marginTop: 4 }}>
          <span style={{ color: m.kind === 'zoom' ? 'var(--blue)' : 'var(--gold)', fontWeight: 700 }}>{m.kind === 'zoom' ? 'Zoom' : 'Гайд'}</span>
          {' · '}{m.kind === 'zoom' ? m.dur : m.read} · {ago(m.daysAgo)}
        </div>
      </div>
      {watched ? <Icon name="check" size={17} color="var(--sea)" /> : <Icon name="right" size={16} className="chev" />}
    </button>
  );
}

/* ——— сообщества ——— */

function Communities({ app }) {
  const mine = localOf(app.me.region);
  const locals = COMMUNITIES.filter((c) => c.kind === 'local' && c.id !== mine?.id);
  const interests = COMMUNITIES.filter((c) => c.kind === 'interest').sort((a, b) => app.joined.includes(b.id) - app.joined.includes(a.id));
  const joinedMine = mine && app.joined.includes(mine.id);

  return (
    <div className="stack-24">
      {mine && (
        <Section title="Ваш регион" note="Меняется вместе с регионом на главной">
          <button className="evcard" onClick={() => go(`/community/${mine.id}`)}>
            <Scene region={mine.region} height={140} radius={0}>
              <div className="scene__top">
                <span className="glass">{REGIONS[mine.region].flag} {REGIONS[mine.region].name}</span>
                <span className="glass" style={joinedMine ? { color: 'var(--sea)' } : undefined}>{joinedMine ? '✓ вы участник' : `${mine.members} участников`}</span>
              </div>
            </Scene>
            <div className="evcard__body">
              <div className="t-lg">{mine.name}</div>
              <div className="t-sm dim clamp-2">{mine.about}</div>
              <div className="row" style={{ gap: 8, marginTop: 8 }}>
                <AvaStack people={mine.hosts.map(byId)} size={24} />
                <span className="t-xs dim-2">Ведут {mine.hosts.map((h) => byId(h).name.split(' ')[0]).join(' и ')}</span>
              </div>
            </div>
          </button>
        </Section>
      )}

      <Section title="Локальные" note="Москва, Бали, Дубай, США, Европа">
        <div className="stack-8">
          {locals.map((c) => <CommunityRow key={c.id} app={app} c={c} />)}
        </div>
      </Section>

      <Section title="По интересам">
        <div className="stack-8">
          {interests.map((c) => <CommunityRow key={c.id} app={app} c={c} />)}
        </div>
      </Section>
    </div>
  );
}

function CommunityRow({ app, c }) {
  const joined = app.joined.includes(c.id);
  return (
    <div className={`comm${joined ? ' comm--mine' : ''}`}>
      <button className="row grow" style={{ gap: 12 }} onClick={() => go(`/community/${c.id}`)}>
        {c.kind === 'local' ? (
          <Thumb region={c.region} size={52} radius={15} />
        ) : (
          <span style={{ width: 52, height: 52, flex: 'none', borderRadius: 15, display: 'grid', placeItems: 'center', fontSize: 24, background: `linear-gradient(145deg, ${c.tone}40, var(--surface-2))`, boxShadow: `inset 0 0 0 1px ${c.tone}30` }}>{c.emoji}</span>
        )}
        <span className="grow" style={{ minWidth: 0 }}>
          <span className="t-md ell" style={{ display: 'block' }}>{c.name}</span>
          <span className="t-xs dim-2 ell" style={{ display: 'block', marginTop: 2 }}>{c.members} участников · {c.about}</span>
        </span>
      </button>
      {joined ? (
        <span className="tag tag--sea" style={{ flex: 'none' }}><Icon name="check" size={11} /> вы в нём</span>
      ) : (
        <Btn size="sm" variant="ghost" onClick={() => { app.toggleJoin(c.id); app.say(`Вы в сообществе «${c.name}»`); }}>Вступить</Btn>
      )}
    </div>
  );
}
