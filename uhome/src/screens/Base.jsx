import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { MATERIALS, TOPICS, PINS, isPin } from '../data/base.js';
import { DICT } from '../data/dictionary.js';
import { COMMUNITIES, localOf } from '../data/communities.js';
import { REGIONS, REGION_KEYS } from '../data/regions.js';
import { EVENTS } from '../data/events.js';
import { byId } from '../data/people.js';
import { count, ago, plural } from '../lib/format.js';
import { seeded } from '../lib/art.js';
import { Top, Seg, Search, Section, Empty } from '../components/UI.jsx';
import { Scene } from '../components/Covers.jsx';
import { AvaStack, Tile } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';
import Flag from '../components/Flag.jsx';

/* База: две вкладки. «Знания» — пять закрепов сверху (словарь, регионы
   и три видео команды), ниже библиотека эфиров и гайдов с поиском и темами.
   «Сообщества» — своё локальное первым, остальные локальные плиткой,
   по интересам — строками с главами по регионам. */

const LIBRARY = MATERIALS.filter((m) => !isPin(m.id));
const FORMATS = [
  { id: 'all', name: 'Всё' },
  { id: 'zoom', name: 'Эфиры' },
  { id: 'guide', name: 'Гайды' },
];

export default function Base({ query }) {
  const app = useApp();
  const [tab, setTab] = useState(query.tab === 'comm' ? 'comm' : 'know');
  const change = (t) => {
    setTab(t);
    history.replaceState(null, '', `#/base?tab=${t}`);
  };

  return (
    <div className="screen kb rise-in">
      <Top
        title="База"
        sub={tab === 'know'
          ? `${PINS.length} закрепов · ${count(LIBRARY.length, 'материал', 'материала', 'материалов')} в библиотеке`
          : `${count(COMMUNITIES.length, 'сообщество', 'сообщества', 'сообществ')} · вы в ${app.joined.length}`}
      />
      <Seg value={tab} onChange={change} options={[{ value: 'know', label: 'База знаний' }, { value: 'comm', label: 'Сообщества' }]} />
      <div className="kb__body" key={tab}>
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

/* Закреп: два текстовых раздела плитками, три видео — строками. */
function Pins({ app }) {
  const done = PINS.filter((p) => app.watched[p.id]).length;
  const text = PINS.filter((p) => p.format === 'text');
  const videos = PINS.filter((p) => p.format === 'video');
  return (
    <section className="sect bpin">
      <div className="sect__head">
        <div style={{ minWidth: 0 }}>
          <div className="sect__title">Закреплено <span className="bpin__n">· {PINS.length}</span></div>
          <div className="sect__note">Начните с них — это основа клуба</div>
        </div>
        <div className="bpin__prog" aria-label={`Изучено ${done} из ${PINS.length}`}>
          <span><b>{done}</b>/{PINS.length}</span>
          <div className="bpin__bar">{PINS.map((p) => <i key={p.id} data-on={!!app.watched[p.id]} />)}</div>
        </div>
      </div>

      <div className="bpin__grid">
        {text.map((p) => (
          <button key={p.id} className="bpin-tile" onClick={() => go(p.to)} data-done={!!app.watched[p.id]}>
            <span className="bpin-tile__top">
              <span className="bpin__idx">{p.n}{app.watched[p.id] && <Icon name="check" size={11} width={2.4} />}</span>
              <span className="bpin__fmt">Текст · {p.time}</span>
            </span>
            <span className="bpin-tile__art" aria-hidden="true">{p.id === 'dict' ? <DictWheel /> : <RegionBars />}</span>
            <span className="bpin-tile__t">{p.title}</span>
            <span className="bpin-tile__s">{p.sub}</span>
          </button>
        ))}
      </div>

      <div className="bpin__list">
        {videos.map((p, i) => {
          const seen = app.watched[p.id];
          return (
            <button key={p.id} className="bpin-row" onClick={() => go(p.to)}>
              <Wave seed={p.id} size={54} done={seen} tone={PIN_TONES[i % PIN_TONES.length]} />
              <span className="bpin-row__body">
                <span className="bpin-row__k"><span className="bpin__idx">{p.n}</span> · Видео · {p.time}</span>
                <span className="bpin-row__t">{p.title}</span>
                <span className="bpin-row__s">{p.sub}</span>
              </span>
              <Icon name="right" size={16} className="chev" />
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* Термины словаря проезжают через «окно» — как барабан выбора. */
const PIN_TONES = ['#d9b26b', '#86a9e0', '#a99bd9'];
const WHEEL = ['Резидент', 'Повод', 'Интро', 'Синдикат', 'KITAS', 'Мастер-группа'];
function DictWheel() {
  const list = [...WHEEL, ...WHEEL.slice(0, 3)];
  return (
    <span className="bpin-wheel">
      <span className="bpin-wheel__win" />
      <span className="bpin-wheel__view"><span className="bpin-wheel__list">{list.map((w, i) => <span key={i}>{w}</span>)}</span></span>
      <span className="bpin-wheel__n">{DICT.length}</span>
    </span>
  );
}

/* Пять регионов столбиками: высота — резиденты локального сообщества. */
function RegionBars() {
  const vals = REGION_KEYS.map((k) => localOf(k)?.members || 0);
  const max = Math.max(...vals);
  return (
    <span className="bpin-bars">
      {REGION_KEYS.map((k, i) => (
        <span key={k} className="bpin-bars__c">
          <span className="bpin-bars__b" style={{ '--h': Math.max(0.12, vals[i] / max), '--i': i }} />
          <Flag cc={REGIONS[k].cc} size={14} />
        </span>
      ))}
    </span>
  );
}

/** Значок видео: волна сигнала и кнопка. Посмотрели — кромка становится зелёной. */
export function Wave({ seed = 'x', size = 52, done = false, tone }) {
  const bars = useMemo(() => {
    const rnd = seeded('wave' + seed);
    return Array.from({ length: 9 }, (_, i) => 0.25 + Math.abs(Math.sin(i * 0.9 + rnd() * 3)) * 0.75);
  }, [seed]);
  return (
    <span className="kb-wave" style={{ width: size, height: size, background: tone ? `radial-gradient(90% 90% at 25% 15%, ${tone}30, transparent 70%), #0c0f15` : undefined }} data-done={done}>
      <svg viewBox="0 0 54 54" width={size} height={size} aria-hidden="true">
        {bars.map((h, i) => {
          const bh = h * 26;
          return <rect key={i} x={6 + i * 5} y={27 - bh / 2} width="2" height={bh} rx="1" className="kb-wave__b" style={{ '--i': i, fill: tone && !done ? `${tone}66` : undefined }} />;
        })}
      </svg>
      <span className="kb-wave__play">{done ? <Icon name="check" size={11} width={2.4} /> : <Icon name="play" size={10} fill="currentColor" width={1} />}</span>
    </span>
  );
}

/** Значок гайда: страница со строками и золотой заголовок. */
export function Page({ size = 52, done = false }) {
  return (
    <span className="kb-page" style={{ width: size, height: size }} data-done={done}>
      <svg viewBox="0 0 54 54" width={size} height={size} aria-hidden="true">
        <rect x="15" y="10" width="24" height="34" rx="3" className="kb-page__sheet" />
        <path d="M20 18h11" className="kb-page__h" />
        <path d="M20 24h14M20 29h14M20 34h9" className="kb-page__l" />
      </svg>
      {done && <span className="kb-page__ok"><Icon name="check" size={10} width={2.6} /></span>}
    </span>
  );
}

function Library({ app }) {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const [topic, setTopic] = useState('all');
  const filtered = kind !== 'all' || topic !== 'all' || !!q.trim();
  // в поиске участвуют и видео закрепа, в спокойном режиме они только наверху
  const source = filtered ? MATERIALS : LIBRARY;

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return source
      .filter((m) => {
        if (kind !== 'all' && m.kind !== kind) return false;
        if (topic !== 'all' && m.topic !== topic) return false;
        if (s && !`${m.title} ${m.about} ${m.points.join(' ')}`.toLowerCase().includes(s)) return false;
        return true;
      })
      .sort((a, b) => a.daysAgo - b.daysAgo);
  }, [q, kind, topic, source]);

  const topics = TOPICS.map((t) => ({ ...t, n: MATERIALS.filter((m) => m.topic === t.id).length })).filter((t) => t.n);
  const reset = () => { setQ(''); setKind('all'); setTopic('all'); };

  return (
    <section className="sect kb-lib">
      <div className="sect__head">
        <div style={{ minWidth: 0 }}>
          <div className="sect__title">Библиотека</div>
          <div className="sect__note">{filtered ? `Нашлось ${list.length}` : 'Эфиры и гайды клуба'}</div>
        </div>
        <div className="kb-fmt" role="tablist">
          {FORMATS.map((f) => (
            <button key={f.id} role="tab" data-on={kind === f.id} onClick={() => setKind(f.id)}>{f.name}</button>
          ))}
        </div>
      </div>

      <Search value={q} onChange={setQ} placeholder="Визы, налоги, нетворкинг…" />

      <div className="kb-topics">
        <button className="kb-topic" data-on={topic === 'all'} onClick={() => setTopic('all')}>
          <Icon name="grid" size={14} /> Все темы
        </button>
        {topics.map((t) => (
          <button key={t.id} className="kb-topic" data-on={topic === t.id} onClick={() => setTopic(topic === t.id ? 'all' : t.id)}>
            <Icon name={t.icon} size={14} /> {t.name} <em>{t.n}</em>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <Empty title="Ничего не нашли" text="Попробуйте другую тему или спросите в сообществе — запишем эфир." action={<button className="sect__more" onClick={reset}>Сбросить фильтры</button>} />
      ) : (
        <div className="kb-list" key={`${kind}-${topic}`}>
          {list.map((m) => <MaterialRow key={m.id} m={m} watched={app.watched[m.id]} />)}
        </div>
      )}
      {filtered && list.length > 0 && <button className="sect__more kb-reset" onClick={reset}>Сбросить фильтры</button>}
    </section>
  );
}

export function MaterialRow({ m, watched }) {
  const zoom = m.kind === 'zoom';
  return (
    <button className="kb-mat" onClick={() => go(`/material/${m.id}`)}>
      {zoom ? <Wave seed={m.id} size={50} done={watched} /> : <Page size={50} done={watched} />}
      <span className="kb-mat__body">
        <span className="kb-mat__k">
          <b data-kind={m.kind}>{zoom ? (isPin(m.id) ? 'Видео клуба' : 'Эфир') : 'Гайд'}</b> · {zoom ? m.dur : m.read} · {ago(m.daysAgo)}
        </span>
        <span className="kb-mat__t">{m.title}</span>
      </span>
      <Icon name="right" size={16} className="chev" />
    </button>
  );
}

/* ——— сообщества ——— */

function Communities({ app }) {
  const mine = localOf(app.me.region);
  const locals = COMMUNITIES.filter((c) => c.kind === 'local' && c.id !== mine?.id);
  const interests = COMMUNITIES.filter((c) => c.kind === 'interest').sort((a, b) => app.joined.includes(b.id) - app.joined.includes(a.id));
  const join = (c) => {
    const was = app.joined.includes(c.id);
    app.toggleJoin(c.id);
    app.say(was ? `Вы вышли из «${c.name}»` : `Вы в сообществе «${c.name}»`);
  };

  return (
    <div className="stack-24">
      {mine && <MineCard app={app} c={mine} onJoin={() => join(mine)} />}

      <Section title="Локальные" note="Сообщества других регионов клуба">
        <div className="cmt-grid">
          {locals.map((c) => {
            const on = app.joined.includes(c.id);
            return (
              <div key={c.id} className="cmt-tile" data-on={on}>
                <button className="cmt-tile__main" onClick={() => go(`/community/${c.id}`)}>
                  <span className="cmt-tile__flag"><Flag cc={REGIONS[c.region].cc} size={22} /></span>
                  <span className="cmt-tile__t">{REGIONS[c.region].name}</span>
                  <span className="cmt-tile__s">{c.members} {plural(c.members, 'участник', 'участника', 'участников')}</span>
                </button>
                <JoinDot on={on} onClick={() => join(c)} name={c.name} />
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="По интересам" note="Одно сообщество — главы во всех регионах">
        <div className="cmt-list">
          {interests.map((c) => {
            const on = app.joined.includes(c.id);
            return (
              <div key={c.id} className="cmt-row" data-on={on}>
                <button className="cmt-row__main" onClick={() => go(`/community/${c.id}`)}>
                  <Tile icon={c.icon} tone={c.tone} size={44} radius={13} />
                  <span className="cmt-row__body">
                    <span className="cmt-row__t">{c.name}</span>
                    <span className="cmt-row__s">
                      <span className="cmt-row__n"><Icon name="users" size={12} /> {c.members}</span>
                      <span className="cmt-row__flags">{(c.chapters || []).map((k) => <Flag key={k} cc={REGIONS[k].cc} size={13} />)}</span>
                    </span>
                  </span>
                </button>
                <JoinDot on={on} onClick={() => join(c)} name={c.name} />
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function JoinDot({ on, onClick, name }) {
  return (
    <button className="cmt-join" data-on={on} onClick={onClick} aria-label={on ? `Выйти из «${name}»` : `Вступить в «${name}»`}>
      <Icon name={on ? 'check' : 'plus'} size={15} width={on ? 2.2 : 1.8} />
      <span>{on ? 'Вы в нём' : 'Вступить'}</span>
    </button>
  );
}

function MineCard({ app, c, onJoin }) {
  const R = REGIONS[c.region];
  const on = app.joined.includes(c.id);
  const events = EVENTS.filter((e) => e.region === c.region).length;
  const chapters = COMMUNITIES.filter((x) => x.kind === 'interest' && x.chapters?.includes(c.region)).length;
  return (
    <section className="sect">
      <div className="cmt-mine">
        <button className="cmt-mine__cover" onClick={() => go(`/community/${c.id}`)} aria-label={c.name}>
          <Scene region={c.region} height={132} radius={0} />
          <span className="cmt-mine__eye kb-glass"><Flag cc={R.cc} size={14} /> Ваш регион · {R.name}</span>
        </button>
        <div className="cmt-mine__body">
          <button className="cmt-mine__head" onClick={() => go(`/community/${c.id}`)}>
            <span className="grow" style={{ minWidth: 0 }}>
              <span className="cmt-mine__t">{c.name}</span>
              <span className="cmt-mine__s">{c.about}</span>
            </span>
            <Icon name="right" size={16} className="chev" />
          </button>
          <div className="cmt-mine__stats">
            <span><b>{c.members}</b>{plural(c.members, 'участник', 'участника', 'участников')}</span>
            <span><b>{events}</b>{plural(events, 'событие', 'события', 'событий')}</span>
            <span><b>{chapters}</b>по интересам</span>
          </div>
          <div className="cmt-mine__foot">
            <AvaStack people={c.hosts.map(byId)} size={26} />
            <span className="cmt-mine__hosts">Ведут {c.hosts.map((h) => byId(h).name.split(' ')[0]).join(' и ')}</span>
            <JoinDot on={on} onClick={onJoin} name={c.name} />
          </div>
        </div>
      </div>
    </section>
  );
}
