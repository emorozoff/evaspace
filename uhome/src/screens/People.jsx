import { useEffect, useMemo, useState } from 'react';
import { useApp, weekKey } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { ranked, match } from '../lib/match.js';
import { peopleIn } from '../lib/select.js';
import { whyText } from '../lib/intro.js';
import { assistantOf } from '../lib/assistant.js';
import { introduce, hasChat } from '../components/Intros.jsx';
import { PEOPLE, ROLES, EXCHANGE, MEET_GOALS, INTERESTS } from '../data/people.js';
import { REGIONS, REGION_KEYS } from '../data/regions.js';
import { regionStats } from '../data/communities.js';
import { count, plural } from '../lib/format.js';
import { Top, Seg, Search, Picker, Section, List, Empty, Btn, Sheet } from '../components/UI.jsx';
import WorldMap from '../components/WorldMap.jsx';
import RegionSheet from '../components/RegionSheet.jsx';
import Icon from '../components/Icons.jsx';
import Flag from '../components/Flag.jsx';
import { PersonRow } from '../components/people/Bits.jsx';
import { MeetDeck, Match, WeekList } from '../components/people/MeetDeck.jsx';

/* Люди — знакомства из клуба: раз в неделю программа предлагает семь
   человек, совпало с обеих сторон — открывается чат. Рядом — вся база
   резидентов с фильтрами и карта, где видно, кто где. */

const WEEKLY = 7;
const TABS = ['meet', 'list', 'map'];

export default function People({ query }) {
  const app = useApp();
  const [tab, setTab] = useState(TABS.includes(query.tab) ? query.tab : 'meet');
  const [edit, setEdit] = useState(false);
  const change = (t) => {
    setTab(t);
    history.replaceState(null, '', `#/people?tab=${t}`);
  };

  return (
    <div className={`screen p-people p-people--${tab}`}>
      <Top
        title="Люди"
        sub={`${count(PEOPLE.length, 'резидент', 'резидента', 'резидентов')} · ${regionStats(app.me.region).residents} ${REGIONS[app.me.region].loc}`}
        right={tab === 'meet' ? <Btn variant="quiet" size="sm" icon="filter" onClick={() => setEdit(true)}>Я ищу</Btn> : null}
      />
      <Seg value={tab} onChange={change} options={[{ value: 'meet', label: 'Знакомства' }, { value: 'list', label: 'Резиденты' }, { value: 'map', label: 'Карта' }]} />

      {tab === 'meet' && <Meet app={app} paused={edit} />}
      {tab === 'list' && <Residents app={app} query={query} />}
      {tab === 'map' && <MapTab app={app} />}

      <Sheet open={edit} onClose={() => setEdit(false)} title="Что вы ищете" sub="Подборка — по встречному совпадению: кто даёт то, что вы ищете, и кому полезны вы. Пересчёт — сразу.">
        {edit && <MeetForm app={app} onDone={() => setEdit(false)} />}
      </Sheet>
    </div>
  );
}

/* ——— знакомства ——— */

function Meet({ app, paused }) {
  const [boom, setBoom] = useState(null);
  const [sheet, setSheet] = useState(false);
  const week = weekKey();
  const suggest = useMemo(
    () => ranked(app.me, PEOPLE).slice(0, WEEKLY),
    // подборка обновляется раз в неделю и при смене интересов
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [app.me.needs, app.me.gives, app.me.interests, app.me.goals, app.me.region, week]
  );
  const status = app.meet.status;
  const intros = app.intros || {};
  // знакомство через ассистента — отдельное состояние, а не «взаимно»
  const stateOf = (id) => (intros[id] ? 'intro' : status[id] || null);
  const open = suggest.filter(({ p }) => !stateOf(p.id));
  const current = open[0];
  const pos = suggest.length - open.length + (current ? 1 : 0);
  const links = suggest.filter(({ p }) => ['matched', 'intro'].includes(stateOf(p.id))).length;

  const commit = (item, dir) => {
    const { p } = item;
    if (dir === 'left') return app.meetAnswer(p.id, false);
    if (dir === 'up') return introduce(app, p, whyText(item));
    const res = app.meetAnswer(p.id, true);
    if (res === 'matched') setBoom(p);
    else app.say('Предложение отправлено — ждём ответа');
    return res;
  };

  return (
    <div className="p-meet">
      <div className="p-meet__prog">
        <button onClick={() => setSheet(true)}>Неделя {week.split('-')[1]}{links ? ` · ${links} ${plural(links, 'связь', 'связи', 'связей')}` : ''}</button>
        <b>{pos} / {suggest.length}</b>
      </div>

      {current ? (
        <MeetDeck app={app} item={current} onCommit={commit} paused={paused || !!boom || sheet} chat={hasChat(app, current.p.id)} />
      ) : (
        <div className="stack">
          <Section title="Неделя закрыта" note={`${links ? `${links} ${plural(links, 'новая связь', 'новые связи', 'новых связей')}. ` : ''}Новая подборка придёт в понедельник.`}>
            <WeekList app={app} list={suggest} stateOf={stateOf} />
          </Section>
          <Btn variant="quiet" wide icon="swap" onClick={app.meetRestart}>Показать снова</Btn>
        </div>
      )}

      {boom && <Match app={app} p={boom} onClose={() => setBoom(null)} />}

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Знакомства недели" sub="Взаимно и через ассистента — чат уже открыт. Остальным отправлено предложение.">
        <WeekList app={app} list={suggest} stateOf={stateOf} />
      </Sheet>
    </div>
  );
}

/* Пределы и поведение — как в тесте: на пределе новый выбор заменяет самый старый. */
function MeetForm({ app, onDone }) {
  const [goals, setGoals] = useState(app.me.goals || []);
  const [needs, setNeeds] = useState(app.me.needs || []);
  const [interests, setInterests] = useState(app.me.interests || []);
  const toggle = (list, set, v, max) => set(list.includes(v) ? list.filter((x) => x !== v) : list.length < max ? [...list, v] : [...list.slice(1), v]);
  const group = (label, list, set, max, options) => (
    <div>
      <span className="label">{label} · {list.length} / {max}</span>
      <div className="wrap">
        {options.map((o) => (
          <button key={o.id} className={`chip${list.includes(o.id) ? ' chip--on' : ''}`} onClick={() => toggle(list, set, o.id, max)}>{o.name}</button>
        ))}
      </div>
    </div>
  );
  return (
    <div className="stack" style={{ gap: 20 }}>
      {group('Зачем знакомитесь', goals, setGoals, 3, MEET_GOALS.map((g) => ({ id: g.id, name: g.label })))}
      {group('Что ищете', needs, setNeeds, 3, Object.entries(EXCHANGE).map(([id, x]) => ({ id, name: x.name })))}
      {group('Интересы', interests, setInterests, 5, INTERESTS.map((t) => ({ id: t, name: t })))}
      <Btn variant="gold" wide onClick={() => { app.updateMe({ goals, needs, interests }); app.say('Подборка пересчитана'); onDone(); }}>Сохранить</Btn>
    </div>
  );
}

/* ——— база резидентов ——— */

const SORTS = [
  { id: 'match', name: 'По пользе знакомства', short: 'Польза' },
  { id: 'near', name: 'Рядом со мной', short: 'Рядом' },
  { id: 'new', name: 'Новые резиденты', short: 'Новые' },
];

/* Фильтры живут в адресе: открыли профиль, вернулись — всё на месте. */
function Residents({ app, query }) {
  const [q, setQ] = useState(query.q || '');
  const [region, setRegion] = useState(REGIONS[query.region] ? query.region : 'all');
  const [role, setRole] = useState(ROLES.includes(query.role) ? query.role : 'all');
  const [sort, setSort] = useState(SORTS.some((s) => s.id === query.sort) ? query.sort : 'match');

  useEffect(() => {
    const u = new URLSearchParams({ tab: 'list' });
    if (region !== 'all') u.set('region', region);
    if (role !== 'all') u.set('role', role);
    if (sort !== 'match') u.set('sort', sort);
    if (q) u.set('q', q);
    history.replaceState(null, '', `#/people?${u}`);
  }, [q, region, role, sort]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const all = ranked(app.me, PEOPLE).filter(({ p }) => {
      if (region !== 'all' && p.region !== region) return false;
      if (role !== 'all' && p.role !== role) return false;
      if (!needle) return true;
      const hay = [p.name, p.company, p.about, p.city, p.role, p.title, ...p.gives.map((x) => EXCHANGE[x]?.name), ...p.needs.map((x) => EXCHANGE[x]?.name), ...p.interests].join(' ').toLowerCase();
      return hay.includes(needle);
    });
    if (sort === 'new') all.sort((a, b) => a.p.joined - b.p.joined);
    if (sort === 'near') all.sort((a, b) => (b.p.region === app.me.region) - (a.p.region === app.me.region) || b.pct - a.pct);
    return all;
  }, [app.me, q, region, role, sort]);

  return (
    <div className="stack p-list">
      <Search value={q} onChange={setQ} placeholder="Имя, компания, чем занимается" />
      <div className="filters">
        <Picker
          label="Регион"
          summary={region === 'all' ? 'Везде' : <><Flag cc={REGIONS[region].cc} size={14} /> {REGIONS[region].name}</>}
          options={[{ id: 'all', name: 'Все регионы', lead: <Icon name="globe" size={20} /> }, ...REGION_KEYS.map((k) => ({ id: k, name: REGIONS[k].name, lead: <Flag cc={REGIONS[k].cc} size={24} />, meta: <span className="t-xs dim-2">{regionStats(k).residents}</span> }))]}
          value={region}
          onChange={setRegion}
        />
        <Picker label="Роль" summary={role === 'all' ? 'Все роли' : role} options={[{ id: 'all', name: 'Все роли' }, ...ROLES.map((r) => ({ id: r, name: r }))]} value={role} onChange={setRole} />
        <Picker label="Порядок" title="Сначала" summary={SORTS.find((s) => s.id === sort).short} options={SORTS} value={sort} def="match" onChange={setSort} />
      </div>
      <div className="p-count"><b>{list.length}</b> {plural(list.length, 'человек', 'человека', 'человек')} · {SORTS.find((s) => s.id === sort).name.toLowerCase()}</div>
      {list.length === 0 ? (
        <Empty title="Никого не нашли" text="Попробуйте другой регион, роль или запрос." />
      ) : (
        <List>{list.map(({ p, pct }) => <PersonRow key={p.id} app={app} p={p} pct={pct} />)}</List>
      )}
    </div>
  );
}

/* ——— карта ——— */

function MapTab({ app }) {
  const [sel, setSel] = useState(null);
  const [regionSheet, setRegionSheet] = useState(false);
  const here = sel ? peopleIn(sel).map((p) => ({ p, ...match(app.me, p) })).sort((a, b) => b.pct - a.pct) : [];

  return (
    <div className="stack-24 p-mapx">
      <div className="stack-8">
        <div className="card p-map">
          <WorldMap people={PEOPLE} myRegion={app.me.region} selected={sel} onSelect={(k) => setSel(k === sel ? null : k)} onPerson={(id) => go(`/p/${id}`)} height={220} />
        </div>
        <div className="sect__note">Нажмите на регион — откроется список. Приблизьте — появятся люди.</div>
      </div>

      {sel ? (
        <Section title={<><Flag cc={REGIONS[sel].cc} size={20} /> {REGIONS[sel].name}</>} note={`${count(here.length, 'резидент', 'резидента', 'резидентов')} · ${REGIONS[sel].country}`} more="Все регионы" onMore={() => setSel(null)}>
          <List>{here.map(({ p, pct }) => <PersonRow key={p.id} app={app} p={p} pct={pct} />)}</List>
        </Section>
      ) : (
        <Section title="Кто где" note="Резиденты по регионам клуба">
          <div className="rows">
            {REGION_KEYS.map((k) => {
              const folks = peopleIn(k);
              const n = regionStats(k).residents;
              const online = folks.filter((p) => p.online).length;
              const me = k === app.me.region;
              return (
                <button key={k} className="rows__r" onClick={() => setSel(k)}>
                  <span className="rows__k"><Flag cc={REGIONS[k].cc} size={14} /> {REGIONS[k].name}<i>{REGIONS[k].country}{me ? ' · вы здесь' : ''}</i></span>
                  <span className="rows__v">{n}<u>{online} онлайн</u></span>
                </button>
              );
            })}
          </div>
          <div><Btn variant="quiet" size="sm" icon="swap" onClick={() => setRegionSheet(true)}>Сменить мой регион</Btn></div>
        </Section>
      )}

      <RegionSheet app={app} open={regionSheet} onClose={() => setRegionSheet(false)} />
    </div>
  );
}
