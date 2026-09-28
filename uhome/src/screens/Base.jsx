import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { MATERIALS, PINS, isPin } from '../data/base.js';
import { COMMUNITIES, localOf } from '../data/communities.js';
import { REGIONS } from '../data/regions.js';
import { EVENTS } from '../data/events.js';
import { byId } from '../data/people.js';
import { count, ago, plural } from '../lib/format.js';
import { Top, Seg, Search, Section, Empty, List, Item } from '../components/UI.jsx';
import { AvaStack, Tile } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';
import Flag from '../components/Flag.jsx';

/* База: две вкладки. «База знаний» — пять закрепов нумерованным списком
   и библиотека эфиров и гайдов с поиском. «Сообщества» — своё локальное
   карточкой, остальные строками. */

const LIBRARY = MATERIALS.filter((m) => !isPin(m.id));
const FORMATS = [
  { value: 'all', label: 'Всё' },
  { value: 'zoom', label: 'Эфиры' },
  { value: 'guide', label: 'Гайды' },
];

export default function Base({ query }) {
  const app = useApp();
  const [tab, setTab] = useState(query.tab === 'comm' ? 'comm' : 'know');
  const change = (t) => {
    setTab(t);
    history.replaceState(null, '', `#/base?tab=${t}`);
  };

  return (
    <div className="screen rise-in">
      <Top
        title="База"
        mark={tab === 'know' ? String(MATERIALS.length).padStart(2, '0') : String(COMMUNITIES.length).padStart(2, '0')}
        sub={tab === 'know'
          ? `${PINS.length} закрепов и ${count(LIBRARY.length, 'материал', 'материала', 'материалов')} в библиотеке`
          : `${count(COMMUNITIES.length, 'сообщество', 'сообщества', 'сообществ')} · вы в ${app.joined.length}`}
      />
      <Seg value={tab} onChange={change} options={[{ value: 'know', label: 'База знаний' }, { value: 'comm', label: 'Сообщества' }]} />
      <div className="b-body" key={tab}>
        {tab === 'know' ? <Knowledge app={app} /> : <Communities app={app} />}
      </div>
    </div>
  );
}

/* ——— знания ——— */

function Knowledge({ app }) {
  return (
    <div className="stack-24">
      <Pins app={app} />
      <Library app={app} />
    </div>
  );
}

/* Закреп: пять строк по номерам — два текстовых раздела и три видео. */
function Pins({ app }) {
  const done = PINS.filter((p) => app.watched[p.id]).length;
  return (
    <Section title={<>Закреплено <span className="dim-2">· {PINS.length}</span></>} note={done ? `Изучено ${done} из ${PINS.length} — основа клуба` : 'Начните с них — это основа клуба'}>
      <List>
        {PINS.map((p) => {
          const seen = !!app.watched[p.id];
          return (
            <Item
              key={p.id}
              lead={<span className="b-n">{p.n}</span>}
              title={p.title}
              sub={<><span className="tag" style={{ marginRight: 8 }}>{p.format === 'video' ? 'Видео' : 'Текст'} · {p.time}</span><span className="ell">{p.sub}</span></>}
              meta={seen ? <Icon name="check" size={16} color="var(--sea)" /> : undefined}
              onClick={() => go(p.to)}
            />
          );
        })}
      </List>
    </Section>
  );
}

function Library({ app }) {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const filtered = kind !== 'all' || !!q.trim();
  // в поиске участвуют и видео закрепа, в спокойном режиме они только наверху
  const source = filtered ? MATERIALS : LIBRARY;

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return source
      .filter((m) => (kind === 'all' || m.kind === kind) && (!s || `${m.title} ${m.about} ${m.points.join(' ')}`.toLowerCase().includes(s)))
      .sort((a, b) => a.daysAgo - b.daysAgo);
  }, [q, kind, source]);

  return (
    <Section title="Библиотека" note={filtered ? `Нашлось ${list.length}` : 'Записи эфиров и гайды клуба'}>
      <Search value={q} onChange={setQ} placeholder="Визы, налоги, нетворкинг…" />
      <Seg value={kind} onChange={setKind} options={FORMATS} />
      {list.length === 0 ? (
        <Empty title="Ничего не нашли" text="Попробуйте другое слово или спросите в сообществе — запишем эфир." action={<button className="sect__more" onClick={() => { setQ(''); setKind('all'); }}>Сбросить</button>} />
      ) : (
        <List>{list.map((m) => <MaterialRow key={m.id} m={m} watched={app.watched[m.id]} />)}</List>
      )}
    </Section>
  );
}

export function MaterialRow({ m, watched }) {
  const zoom = m.kind === 'zoom';
  return (
    <Item
      lead={<span className="disc disc--sm"><Icon name={zoom ? 'play' : 'book'} size={16} fill={zoom ? 'currentColor' : 'none'} width={zoom ? 1 : 1.6} /></span>}
      title={m.title}
      sub={`${zoom ? (isPin(m.id) ? 'Видео клуба' : 'Эфир') : 'Гайд'} · ${zoom ? m.dur : m.read} · ${ago(m.daysAgo)}`}
      meta={watched ? <Icon name="check" size={16} color="var(--sea)" /> : undefined}
      onClick={() => go(`/material/${m.id}`)}
    />
  );
}

/* ——— сообщества ——— */

function Communities({ app }) {
  const mine = localOf(app.me.region);
  const locals = COMMUNITIES.filter((c) => c.kind === 'local' && c.id !== mine?.id);
  // порядок фиксируется при открытии вкладки — строка не уезжает из-под пальца
  const [interests] = useState(() => COMMUNITIES.filter((c) => c.kind === 'interest').sort((a, b) => app.joined.includes(b.id) - app.joined.includes(a.id)));
  const join = (c) => {
    const was = app.joined.includes(c.id);
    app.toggleJoin(c.id);
    app.say(was ? `Вы вышли из «${c.name}»` : `Вы в сообществе «${c.name}»`);
  };

  return (
    <div className="stack-24 b-comm">
      {mine && <MineCard app={app} c={mine} onJoin={() => join(mine)} />}

      <Section title="Локальные" note="Сообщества других регионов клуба">
        <div className="list">
          {locals.map((c) => (
            <div key={c.id} className="item">
              <button className="row grow" style={{ gap: 13, minWidth: 0 }} onClick={() => go(`/community/${c.id}`)}>
                <span className="disc"><Flag cc={REGIONS[c.region].cc} size={22} /></span>
                <span className="item__body">
                  <span className="item__t">{c.name}</span>
                  <span className="item__s">{REGIONS[c.region].name} · {c.members} {plural(c.members, 'участник', 'участника', 'участников')}</span>
                </span>
              </button>
              <Join on={app.joined.includes(c.id)} onClick={() => join(c)} name={c.name} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="По интересам" note="Одно сообщество — отделения во всех регионах">
        <div className="list">
          {interests.map((c) => (
            <div key={c.id} className="item">
              <button className="row grow" style={{ gap: 13, minWidth: 0 }} onClick={() => go(`/community/${c.id}`)}>
                <Tile icon={c.icon} tone={c.tone} size={44} radius={22} />
                <span className="item__body">
                  <span className="item__t">{c.name}</span>
                  <span className="item__s b-flags">
                    {c.members} <span className="dim-2">·</span> {(c.chapters || []).map((k) => <Flag key={k} cc={REGIONS[k].cc} size={12} />)}
                  </span>
                </span>
              </button>
              <Join on={app.joined.includes(c.id)} onClick={() => join(c)} name={c.name} />
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Join({ on, onClick, name }) {
  return (
    <button className={`b-join${on ? ' b-join--on' : ''}`} onClick={onClick} aria-label={on ? `Выйти из «${name}»` : `Вступить в «${name}»`}>
      {on ? <><Icon name="check" size={13} width={2.2} /> Вы в нём</> : 'Вступить'}
    </button>
  );
}

function MineCard({ app, c, onJoin }) {
  const R = REGIONS[c.region];
  const on = app.joined.includes(c.id);
  const events = EVENTS.filter((e) => e.region === c.region).length;
  const chapters = COMMUNITIES.filter((x) => x.kind === 'interest' && x.chapters?.includes(c.region)).length;
  return (
    <div className="card card--gold b-mine">
      <button className="row" style={{ gap: 14, width: '100%', alignItems: 'flex-start' }} onClick={() => go(`/community/${c.id}`)}>
        <span className="disc"><Flag cc={R.cc} size={24} /></span>
        <span className="grow" style={{ minWidth: 0 }}>
          <span className="sect__eye">Ваш регион · {R.name}</span>
          <span className="h2" style={{ display: 'block' }}>{c.name}</span>
        </span>
        <Icon name="right" size={16} className="chev" style={{ marginTop: 14 }} />
      </button>
      <p style={{ marginTop: 12 }}>{c.about}</p>
      <div className="strip" style={{ marginTop: 16 }}>
        <div><span className="strip__v">{c.members}</span><span className="strip__k">{plural(c.members, 'участник', 'участника', 'участников')}</span></div>
        <div><span className="strip__v">{events}</span><span className="strip__k">{plural(events, 'событие', 'события', 'событий')}</span></div>
        <div><span className="strip__v">{chapters}</span><span className="strip__k">{plural(chapters, 'отделение', 'отделения', 'отделений')}</span></div>
      </div>
      <div className="spread" style={{ marginTop: 16 }}>
        <span className="row" style={{ gap: 10, minWidth: 0 }}>
          <AvaStack people={c.hosts.map(byId)} size={26} />
          <span className="t-xs dim-2 ell">Ведут {c.hosts.map((h) => byId(h).name.split(' ')[0]).join(' и ')}</span>
        </span>
        <Join on={on} onClick={onJoin} name={c.name} />
      </div>
    </div>
  );
}
