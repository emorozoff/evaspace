import { useEffect, useMemo, useState } from 'react';
import { useApp, weekKey } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { ranked, match } from '../lib/match.js';
import { peopleIn } from '../lib/select.js';
import { whyText } from '../lib/intro.js';
import { assistantOf } from '../lib/assistant.js';
import { PEOPLE, ROLES, EXCHANGE, MEET_GOALS, INTERESTS } from '../data/people.js';
import { REGIONS, REGION_KEYS } from '../data/regions.js';
import { count, plural } from '../lib/format.js';
import { Top, Seg, Search, Picker, Section, List, Item, Empty, Btn, Sheet } from '../components/UI.jsx';
import { Avatar } from '../components/Art.jsx';
import WorldMap from '../components/WorldMap.jsx';
import RegionSheet from '../components/RegionSheet.jsx';
import Icon from '../components/Icons.jsx';
import Flag from '../components/Flag.jsx';
import Gauge from '../components/people/Gauge.jsx';
import { ChipLine } from '../components/people/Chips.jsx';
import { MeetDeck, MeetProgress, Boom, WeekDone } from '../components/people/MeetDeck.jsx';

/* Люди — механика знакомств из клуба: раз в неделю программа предлагает
   несколько человек, совпало с обеих сторон — открывается чат.
   Рядом — вся база резидентов и карта, где видно, кто где. */

const WEEKLY = 7;

export default function People({ query }) {
  const app = useApp();
  const [tab, setTab] = useState(['meet', 'list', 'map'].includes(query.tab) ? query.tab : 'meet');
  const [edit, setEdit] = useState(false);

  const change = (t) => {
    setTab(t);
    history.replaceState(null, '', `#/people?tab=${t}`);
  };

  return (
    <div className={`screen people people--${tab}`}>
      <div className="people__head">
        <Top
          title="Люди"
          sub={<span className="people__sub">{count(PEOPLE.length, 'резидент', 'резидента', 'резидентов')} · {peopleIn(app.me.region).length} {REGIONS[app.me.region].loc}</span>}
          right={tab === 'meet' ? (
            <button className="people__prefs" onClick={() => setEdit(true)} aria-label="Что вы ищете в знакомствах">
              <Icon name="filter" size={15} />
              <span>Я ищу</span>
            </button>
          ) : null}
        />
        <Seg
          value={tab}
          onChange={change}
          options={[
            { value: 'meet', label: 'Знакомства' },
            { value: 'list', label: 'Резиденты' },
            { value: 'map', label: 'Карта' },
          ]}
        />
      </div>
      {tab === 'meet' && <Meet app={app} paused={edit} />}
      {tab === 'list' && <Residents app={app} sort={query.sort} region={query.region} />}
      {tab === 'map' && <MapTab app={app} />}

      <Sheet open={edit} onClose={() => setEdit(false)} title="Что вы ищете" sub="Подборка — по встречному совпадению: кто даёт то, что вы ищете, и кому полезны вы. Это видят в знакомствах, пересчёт — сразу.">
        {edit && <MeetForm app={app} onDone={() => setEdit(false)} />}
      </Sheet>
    </div>
  );
}

/* ——— знакомства ——— */

function Meet({ app, paused }) {
  const [boom, setBoom] = useState(null);
  const [sheet, setSheet] = useState(false);
  const [note, setNote] = useState(null);
  const week = weekKey();
  const suggest = useMemo(
    () => ranked(app.me, PEOPLE.filter((p) => p.id !== 'team')).slice(0, WEEKLY),
    // подборка обновляется раз в неделю и при смене интересов
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [app.me.needs, app.me.gives, app.me.interests, app.me.goals, app.me.region, week]
  );
  const status = app.meet.status;
  const open = suggest.filter(({ p }) => !status[p.id]);
  const current = open[0];
  const A = assistantOf(app);
  // чат открыт: совпало взаимно или ассистент познакомил
  const chatOpen = (id) => status[id] === 'matched' || !!app.intros?.[id];
  const met = suggest.filter(({ p }) => status[p.id] && chatOpen(p.id));
  const waiting = suggest.filter(({ p }) => status[p.id] === 'liked' && !chatOpen(p.id));

  useEffect(() => {
    if (!note) return undefined;
    const t = setTimeout(() => setNote(null), 2600);
    return () => clearTimeout(t);
  }, [note]);

  const commit = (item, dir) => {
    const { p } = item;
    if (dir === 'left') {
      app.meetAnswer(p.id, false);
      return;
    }
    if (dir === 'up') {
      const already = !!app.intros?.[p.id];
      app.meetAnswer(p.id, true);
      if (!already) app.intro(p.id, whyText(item));
      setNote({
        at: Date.now(),
        text: already
          ? `${A.name} уже ${A.she ? 'познакомила' : 'познакомил'} вас — чат открыт`
          : `${A.name} ${A.she ? 'написала' : 'написал'} вам обоим — ответ придёт в чат`,
      });
      return;
    }
    const res = app.meetAnswer(p.id, true);
    if (res === 'matched') setBoom(p);
    else setNote({ at: Date.now(), text: 'Предложение отправлено — ждём ответа' });
  };

  return (
    <div className="pmeet">
      <MeetProgress
        list={suggest}
        status={status}
        currentId={current?.p.id}
        week={week.split('-')[1]}
        met={met}
        chatOpen={chatOpen}
        onMet={() => setSheet(true)}
      />

      {current ? (
        <MeetDeck app={app} items={open} onCommit={commit} paused={paused || !!boom || sheet}>
          {note && <div className="pm-note" key={note.at}><Icon name="check" size={14} /> {note.text}</div>}
        </MeetDeck>
      ) : (
        <WeekDone app={app} list={suggest} status={status} week={week.split('-')[1]} chatOpen={chatOpen} onRestart={app.meetRestart} />
      )}

      {boom && <Boom app={app} p={boom} onClose={() => setBoom(null)} />}

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Знакомства недели" sub="Взаимно и через ассистента — чат уже открыт. Остальным отправлено предложение.">
        <div className="stack">
          {met.length > 0 && (
            <div className="stack-8">
              <span className="label">Чат открыт · {met.length}</span>
              <List>
                {met.map(({ p, pct }) => (
                  <Item
                    key={p.id}
                    lead={<Avatar person={p} size={44} radius={0.5} ring="var(--gold)" dot={p.online} />}
                    title={p.name}
                    sub={<><Flag cc={REGIONS[p.region].cc} size={12} /> {p.city} · польза {pct}%</>}
                    meta={<span className="tag tag--gold">{app.intros?.[p.id] && status[p.id] !== 'matched' ? A.name : 'взаимно'}</span>}
                    onClick={() => { setSheet(false); go(`/chat/${p.id}`); }}
                  />
                ))}
              </List>
            </div>
          )}
          {waiting.length > 0 && (
            <div className="stack-8">
              <span className="label">Ждём ответа · {waiting.length}</span>
              <List>
                {waiting.map(({ p }) => (
                  <Item
                    key={p.id}
                    lead={<Avatar person={p} size={40} radius={0.5} />}
                    title={p.name}
                    sub={`${p.title} · ${p.company}`}
                    meta={<span className="tag">ждём</span>}
                    onClick={() => { setSheet(false); go(`/p/${p.id}`); }}
                  />
                ))}
              </List>
            </div>
          )}
        </div>
      </Sheet>
    </div>
  );
}

function MeetForm({ app, onDone }) {
  const [goals, setGoals] = useState(app.me.goals);
  const [needs, setNeeds] = useState(app.me.needs);
  const [interests, setInterests] = useState(app.me.interests);
  const toggle = (list, set, v, max) => set(list.includes(v) ? list.filter((x) => x !== v) : list.length < max ? [...list, v] : list);

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div>
        <span className="label">Зачем знакомитесь · до трёх</span>
        <div className="wrap">
          {MEET_GOALS.map((g) => (
            <button key={g.id} className={`chip${goals.includes(g.id) ? ' chip--on' : ''}`} onClick={() => toggle(goals, setGoals, g.id, 3)}>{g.label}</button>
          ))}
        </div>
      </div>
      <div>
        <span className="label">Что ищете · до трёх</span>
        <div className="wrap">
          {Object.entries(EXCHANGE).map(([id, x]) => (
            <button key={id} className={`chip${needs.includes(id) ? ' chip--on' : ''}`} onClick={() => toggle(needs, setNeeds, id, 3)}>{x.name}</button>
          ))}
        </div>
      </div>
      <div>
        <span className="label">Интересы · до шести</span>
        <div className="wrap">
          {INTERESTS.map((t) => (
            <button key={t} className={`chip${interests.includes(t) ? ' chip--on' : ''}`} onClick={() => toggle(interests, setInterests, t, 6)}>{t}</button>
          ))}
        </div>
      </div>
      <Btn variant="gold" wide onClick={() => { app.updateMe({ goals, needs, interests }); app.say('Подборка пересчитана'); onDone(); }}>Сохранить</Btn>
    </div>
  );
}

/* ——— база резидентов ——— */

function Residents({ app, sort: initialSort, region: initialRegion }) {
  const [q, setQ] = useState('');
  const [region, setRegion] = useState(REGIONS[initialRegion] ? initialRegion : 'all');
  const [role, setRole] = useState('all');
  const [sort, setSort] = useState(initialSort === 'new' ? 'new' : 'match');

  const list = useMemo(() => {
    const all = ranked(app.me, PEOPLE).filter(({ p }) => {
      if (region !== 'all' && p.region !== region) return false;
      if (role !== 'all' && p.role !== role) return false;
      if (q && !`${p.name} ${p.company} ${p.about} ${p.city}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
    if (sort === 'new') all.sort((a, b) => a.p.joined - b.p.joined);
    if (sort === 'near') all.sort((a, b) => (b.p.region === app.me.region) - (a.p.region === app.me.region) || b.pct - a.pct);
    return all;
  }, [app.me, q, region, role, sort]);

  const hi = list.filter((x) => x.pct >= 75).length;

  return (
    <div className="stack presi">
      <Search value={q} onChange={setQ} placeholder="Имя, компания, чем занимается" />
      <div className="filters">
        <Picker
          label="Регион"
          summary={region === 'all' ? 'Везде' : <><Flag cc={REGIONS[region].cc} size={14} /> {REGIONS[region].name}</>}
          options={[{ id: 'all', name: 'Все регионы', lead: <Icon name="globe" size={20} /> }, ...REGION_KEYS.map((k) => ({ id: k, name: REGIONS[k].name, lead: <Flag cc={REGIONS[k].cc} size={24} />, meta: <span className="t-xs dim-2">{peopleIn(k).length}</span> }))]}
          value={region}
          onChange={setRegion}
        />
        <Picker
          label="Роль"
          summary={role === 'all' ? 'Все роли' : role}
          options={[{ id: 'all', name: 'Все роли' }, ...ROLES.map((r) => ({ id: r, name: r }))]}
          value={role}
          onChange={setRole}
        />
        <Picker
          label="Порядок"
          title="Сначала"
          summary={sort === 'match' ? 'Польза' : sort === 'new' ? 'Новые' : 'Рядом'}
          options={[{ id: 'match', name: 'По пользе знакомства' }, { id: 'near', name: 'Рядом со мной' }, { id: 'new', name: 'Новые резиденты' }]}
          value={sort}
          def="match"
          onChange={setSort}
        />
      </div>
      <div className="presi__count">
        <span><b>{list.length}</b> {plural(list.length, 'человек', 'человека', 'человек')}</span>
        <span className="presi__hi"><i />{hi ? `${hi} с пользой от 75%` : sort === 'new' ? 'сначала новые' : sort === 'near' ? 'сначала рядом' : 'по пользе знакомства'}</span>
      </div>
      {list.length === 0 ? (
        <Empty title="Никого не нашли" text="Попробуйте другой регион или роль." />
      ) : (
        <div className="stack-8">{list.map((x) => <PersonCard key={x.p.id} app={app} x={x} />)}</div>
      )}
    </div>
  );
}

/* Карточка резидента во всю ширину: кто он, кольцо пользы знакомства,
   что даёт и что ищет — совпадения с вами подсвечены. */
export function PersonCard({ app, x }) {
  const { p, pct, toMe = [], fromMe = [] } = x;
  const inCircle = app.circle.includes(p.id);
  const r = REGIONS[p.region];
  return (
    <button className="prc" onClick={() => go(`/p/${p.id}`)}>
      <div className="prc__top">
        <Avatar person={p} size={48} radius={0.5} dot={p.online} ring={inCircle ? 'var(--gold)' : null} />
        <div className="prc__id">
          <div className="prc__name">{p.name}</div>
          <div className="prc__role">{p.title} · {p.company}</div>
          <div className="prc__meta">
            <Flag cc={r.cc} size={12} />
            <span className="ell">{p.city}</span>
            {p.joined <= 30 && <span className="prc__new">новый</span>}
            {inCircle && <span className="prc__circ">в круге</span>}
          </div>
        </div>
        <Gauge pct={pct} size={46} />
      </div>
      <div className="prc__rows">
        <ChipLine k="Даёт" items={p.gives} on={toMe} tone="gold" />
        <ChipLine k="Ищет" items={p.needs} on={fromMe} tone="sea" />
      </div>
    </button>
  );
}

/* ——— карта ——— */

function MapTab({ app }) {
  const [sel, setSel] = useState(null);
  const [regionSheet, setRegionSheet] = useState(false);
  const here = sel ? peopleIn(sel).map((p) => ({ p, ...match(app.me, p) })).sort((a, b) => b.pct - a.pct) : [];
  const max = Math.max(...REGION_KEYS.map((k) => peopleIn(k).length));
  const mine = REGIONS[app.me.region];

  return (
    <div className="stack-24 pmapx">
      <div className="stack">
        <div className="pmap">
          <WorldMap
            people={PEOPLE}
            myRegion={app.me.region}
            selected={sel}
            onSelect={(k) => setSel(k === sel ? null : k)}
            onPerson={(id) => go(`/p/${id}`)}
            height={206}
          />
          <div className="pmap__hud">
            <span>Резиденты · {PEOPLE.length}</span>
            <span>{REGION_KEYS.length} регионов</span>
          </div>
        </div>
        <button className="pmap-me" onClick={() => setRegionSheet(true)}>
          <span className="pmap-me__f"><Flag cc={mine.cc} size={26} /></span>
          <span className="grow">
            <span className="pmap-me__k">Ваш регион</span>
            <span className="pmap-me__v">Вы {mine.loc}</span>
          </span>
          <span className="pmap-me__a">Сменить <Icon name="swap" size={14} /></span>
        </button>
      </div>

      {sel ? (
        <Section title={<><Flag cc={REGIONS[sel].cc} size={20} /> {REGIONS[sel].name}</>} note={`${count(here.length, 'резидент', 'резидента', 'резидентов')} · ${REGIONS[sel].country}`} more="Все регионы" onMore={() => setSel(null)}>
          <div className="preg">
            {here.map(({ p, pct }) => (
              <button key={p.id} className="preg__row" onClick={() => go(`/p/${p.id}`)}>
                <Avatar person={p} size={42} radius={0.5} dot={p.online} />
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="preg__t ell">{p.name}</span>
                  <span className="preg__s ell">{p.city} · {p.title}, {p.company}</span>
                </span>
                <Gauge pct={pct} size={38} />
              </button>
            ))}
          </div>
        </Section>
      ) : (
        <Section title="Кто где" note="Нажмите на регион — покажем людей там">
          <div className="preg">
            {REGION_KEYS.map((k, i) => {
              const folks = peopleIn(k);
              const online = folks.filter((p) => p.online).length;
              const me = k === app.me.region;
              return (
                <button key={k} className={`preg__row${me ? ' preg__row--me' : ''}`} onClick={() => setSel(k)}>
                  <span className="preg__flag"><Flag cc={REGIONS[k].cc} size={30} /></span>
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="preg__t">{REGIONS[k].name}{me && <span className="preg__here">вы здесь</span>}</span>
                    <span className="preg__bar"><i style={{ '--w': folks.length / max, '--i': i }} /></span>
                    <span className="preg__s">{folks.length} рез. · {online} онлайн</span>
                  </span>
                  <span className="ava-stack preg__avas">
                    {folks.slice(0, 3).map((p) => <Avatar key={p.id} person={p} size={24} radius={0.5} />)}
                  </span>
                  <Icon name="right" size={16} className="chev" />
                </button>
              );
            })}
          </div>
        </Section>
      )}

      <RegionSheet app={app} open={regionSheet} onClose={() => setRegionSheet(false)} />
    </div>
  );
}
