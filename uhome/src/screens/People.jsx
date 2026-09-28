import { useMemo, useState } from 'react';
import { useApp, weekKey } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { ranked, match } from '../lib/match.js';
import { peopleIn } from '../lib/select.js';
import { PEOPLE, ROLES, EXCHANGE, MEET_GOALS, INTERESTS } from '../data/people.js';
import { REGIONS, REGION_KEYS } from '../data/regions.js';
import { count, plural } from '../lib/format.js';
import { Top, Seg, Search, Picker, Section, List, Item, Empty, Btn, Sheet, Note } from '../components/UI.jsx';
import { Avatar } from '../components/Art.jsx';
import WorldMap from '../components/WorldMap.jsx';
import RegionSheet from '../components/RegionSheet.jsx';
import Icon from '../components/Icons.jsx';
import Flag from '../components/Flag.jsx';

/* Люди — механика знакомств из клуба: раз в неделю программа предлагает
   несколько человек, совпало с обеих сторон — открывается чат.
   Рядом — вся база резидентов и карта, где видно, кто где. */

const WEEKLY = 7;

export default function People({ query }) {
  const app = useApp();
  const [tab, setTab] = useState(query.tab || 'meet');

  const change = (t) => {
    setTab(t);
    history.replaceState(null, '', `#/people?tab=${t}`);
  };

  return (
    <div className="screen stack-24 rise-in">
      <div>
        <Top title="Люди" sub={`${count(PEOPLE.length, 'резидент', 'резидента', 'резидентов')} · ${peopleIn(app.me.region).length} ${REGIONS[app.me.region].loc}`} />
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
      {tab === 'meet' && <Meet app={app} />}
      {tab === 'list' && <Residents app={app} sort={query.sort} region={query.region} />}
      {tab === 'map' && <MapTab app={app} />}
    </div>
  );
}

/* ——— знакомства ——— */

function Meet({ app }) {
  const [edit, setEdit] = useState(false);
  const [boom, setBoom] = useState(null);
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
  const matched = suggest.filter(({ p }) => status[p.id] === 'matched');
  const waiting = suggest.filter(({ p }) => status[p.id] === 'liked');

  const answer = (like) => {
    const res = app.meetAnswer(current.p.id, like);
    if (res === 'matched') setBoom(current.p);
    else if (res === 'liked') app.say('Отправили предложение — ждём ответа');
  };

  return (
    <div className="stack-24">
      <button className="mine" onClick={() => setEdit(true)}>
        <div className="row" style={{ gap: 12 }}>
          <Avatar person={app.me} size={52} />
          <div className="grow" style={{ textAlign: 'left' }}>
            <div className="t-xs dim-2">Ищу в знакомствах</div>
            <div className="t-md" style={{ marginTop: 2 }}>
              {app.me.goals.map((g) => MEET_GOALS.find((x) => x.id === g)?.label).filter(Boolean).join(' · ') || 'Выберите цели'}
            </div>
            <div className="t-xs dim-2" style={{ marginTop: 3 }}>{app.me.interests.length} {plural(app.me.interests.length, 'интерес', 'интереса', 'интересов')} · {(app.me.needs || []).length} запроса</div>
          </div>
          <Icon name="edit" size={17} className="chev" />
        </div>
      </button>

      <div className="stack-8">
        <div className="spread">
          <span className="hdr" style={{ padding: 0 }}>Подборка недели</span>
          <span className="t-xs dim-2">{suggest.length - open.length} из {suggest.length}</span>
        </div>
        <div className="meet__quota">
          {suggest.map(({ p }) => <i key={p.id} data-on={!!status[p.id]} />)}
        </div>
      </div>

      {current ? (
        <MeetCard app={app} item={current} onAnswer={answer} />
      ) : (
        <Empty
          icon="check"
          title="На этой неделе всё"
          text="Новая подборка придёт в понедельник. Пока — загляните в базу резидентов или на карту."
          action={<Btn size="sm" variant="ghost" icon="swap" onClick={app.meetRestart}>Показать подборку снова</Btn>}
        />
      )}

      {matched.length > 0 && (
        <Section title={`Взаимно · ${matched.length}`} note="Чат открыт — напишите первым">
          <List>
            {matched.map(({ p, pct }) => (
              <Item
                key={p.id}
                lead={<Avatar person={p} size={44} ring="var(--gold)" dot={p.online} />}
                title={p.name}
                sub={<>{pct}% · <Flag cc={REGIONS[p.region].cc} size={12} /> {p.city}</>}
                meta={<span className="tag tag--gold">чат</span>}
                onClick={() => go(`/chat/${p.id}`)}
              />
            ))}
          </List>
        </Section>
      )}

      {waiting.length > 0 && (
        <Section title="Ждём ответа">
          <List>
            {waiting.map(({ p }) => (
              <Item key={p.id} lead={<Avatar person={p} size={40} />} title={p.name} sub={`${p.title} · ${p.company}`} meta={<span className="tag">ждём</span>} onClick={() => go(`/p/${p.id}`)} />
            ))}
          </List>
        </Section>
      )}

      <Note icon="eye">Подборка — по встречному совпадению: кто даёт то, что вы ищете, и кому полезны вы. Регион решает формат — вживую или созвон.</Note>

      <Sheet open={edit} onClose={() => setEdit(false)} title="Что вы ищете" sub="Это видят в знакомствах. Подборка пересчитается сразу.">
        {edit && <MeetForm app={app} onDone={() => setEdit(false)} />}
      </Sheet>

      <Sheet open={!!boom} onClose={() => setBoom(null)}>
        {boom && (
          <div className="meet__boom stack">
            <div className="row" style={{ justifyContent: 'center', gap: 0 }}>
              <Avatar person={app.me} size={72} />
              <Avatar person={boom} size={72} ring="var(--gold)" style={{ marginLeft: -14 }} />
            </div>
            <h2 className="h2">Взаимно!</h2>
            <p className="lead">{boom.name} тоже хочет познакомиться. Чат открыт, человек — в вашем ближнем круге.</p>
            <Btn variant="gold" wide icon="message" onClick={() => { setBoom(null); go(`/chat/${boom.id}`); }}>Написать</Btn>
            <Btn variant="quiet" wide onClick={() => setBoom(null)}>Смотреть дальше</Btn>
          </div>
        )}
      </Sheet>
    </div>
  );
}

function MeetCard({ app, item, onAnswer }) {
  const { p, pct, reasons, hobbies } = item;
  const r = REGIONS[p.region];
  const near = p.region === app.me.region;
  return (
    <article className="meet" key={p.id}>
      <div className="meet__shot" style={{ background: `radial-gradient(80% 70% at 50% 30%, ${r.plate}, #0c0e14)` }}>
        <Avatar person={p} size={124} radius={0.3} />
        <div className="scene__top">
          <span className="glass">{near ? 'рядом с вами' : <><Flag cc={r.cc} size={13} /> {r.name} · созвон</>}</span>
          <span className="glass" style={{ color: 'var(--gold)' }}><Icon name="spark" size={12} /> {pct}%</span>
        </div>
        <div className="meet__over">
          <div className="h2" style={{ color: '#fff' }}>{p.name}</div>
          <div className="t-sm" style={{ color: 'rgba(255,255,255,.78)', marginTop: 3 }}>{p.title} · {p.company} · {p.city}</div>
        </div>
      </div>
      <div className="meet__body">
        <p className="t-sm dim" style={{ margin: 0, lineHeight: 1.5 }}>{p.about}</p>
        <div>
          <div className="hdr" style={{ padding: 0 }}>Ищет</div>
          <div className="wrap" style={{ marginTop: 8 }}>
            {p.goals.map((g) => {
              const shared = app.me.goals.includes(g);
              return <span key={g} className={`tag${shared ? ' tag--gold' : ''}`}>{MEET_GOALS.find((x) => x.id === g)?.label}</span>;
            })}
          </div>
        </div>
        <div>
          <div className="hdr" style={{ padding: 0 }}>Интересы</div>
          <div className="wrap" style={{ marginTop: 8 }}>
            {p.interests.map((t) => <span key={t} className={`tag${hobbies.includes(t) ? ' tag--sea' : ''}`}>{t}</span>)}
          </div>
        </div>
        {reasons.length > 0 && <div className="t-sm dim center" style={{ lineHeight: 1.5 }}>{reasons[0][0].toUpperCase() + reasons.slice(0, 2).join(' · ').slice(1)}</div>}
        <div className="pair pair--wide">
          <Btn variant="gold" icon="handshake" onClick={() => onAnswer(true)}>Познакомиться</Btn>
          <Btn variant="quiet" onClick={() => onAnswer(false)}>Пропустить</Btn>
        </div>
        <button className="t-sm gold center" style={{ fontWeight: 700 }} onClick={() => go(`/p/${p.id}`)}>Открыть профиль</button>
      </div>
    </article>
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

  return (
    <div className="stack">
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
          summary={sort === 'match' ? 'Совпадение' : sort === 'new' ? 'Новые' : 'Рядом'}
          options={[{ id: 'match', name: 'По совпадению' }, { id: 'near', name: 'Рядом со мной' }, { id: 'new', name: 'Новые резиденты' }]}
          value={sort}
          def="match"
          onChange={setSort}
        />
      </div>
      <div className="t-xs dim-2" style={{ padding: '2px 4px' }}>{count(list.length, 'человек', 'человека', 'человек')} · от 75% — стоит познакомиться первыми</div>
      {list.length === 0 ? (
        <Empty title="Никого не нашли" text="Попробуйте другой регион или роль." />
      ) : (
        <div className="stack-8">{list.map((x) => <PersonCard key={x.p.id} app={app} x={x} />)}</div>
      )}
    </div>
  );
}

/* Карточка резидента во всю ширину: кто он, польза знакомства,
   что даёт и что ищет — совпадения с вами подсвечены. */
export function PersonCard({ app, x }) {
  const { p, pct, toMe, fromMe } = x;
  const inCircle = app.circle.includes(p.id);
  return (
    <button className="pcard" onClick={() => go(`/p/${p.id}`)}>
      <div className="row" style={{ gap: 13, alignItems: 'flex-start' }}>
        <Avatar person={p} size={54} dot={p.online} ring={inCircle ? 'var(--gold)' : null} />
        <div className="grow">
          <div className="spread" style={{ alignItems: 'flex-start' }}>
            <span className="t-md ell" style={{ paddingTop: 2 }}>{p.name}</span>
            <span className="use"><span className="use__v">{pct}%</span><span className="use__l">польза</span></span>
          </div>
          <div className="t-sm dim ell" style={{ marginTop: 2 }}>{p.title} · {p.company}</div>
          <div className="t-xs dim-2" style={{ marginTop: 3 }}><Flag cc={REGIONS[p.region].cc} size={12} /> {p.city}{p.joined <= 30 ? ' · новый резидент' : ''}</div>
        </div>
      </div>
      <div className="pcard__row" style={{ marginTop: 14 }}>
        <span className="pcard__k">Даёт</span>
        <div className="wrap">{p.gives.map((g) => <span key={g} className={`tag${toMe.includes(g) ? ' tag--gold' : ''}`}>{EXCHANGE[g].name}</span>)}</div>
      </div>
      <div className="pcard__row">
        <span className="pcard__k">Ищет</span>
        <div className="wrap">{p.needs.map((g) => <span key={g} className={`tag${fromMe.includes(g) ? ' tag--sea' : ''}`}>{EXCHANGE[g].name}</span>)}</div>
      </div>
    </button>
  );
}

/* ——— карта ——— */

function MapTab({ app }) {
  const [sel, setSel] = useState(null);
  const [regionSheet, setRegionSheet] = useState(false);
  const here = sel ? peopleIn(sel).map((p) => ({ p, ...match(app.me, p) })).sort((a, b) => b.pct - a.pct) : [];

  return (
    <div className="stack-24">
      <div className="stack">
        <WorldMap
          people={PEOPLE}
          myRegion={app.me.region}
          selected={sel}
          onSelect={(k) => setSel(k === sel ? null : k)}
          onPerson={(id) => go(`/p/${id}`)}
          height={210}
        />
        <button className="card tap row" style={{ display: 'flex', gap: 12 }} onClick={() => setRegionSheet(true)}>
          <span className="picker__lead"><Flag cc={REGIONS[app.me.region].cc} size={24} /></span>
          <div className="grow">
            <div className="t-md">Вы {REGIONS[app.me.region].loc}</div>
            <div className="t-xs dim-2" style={{ marginTop: 2 }}>Бирюзовый значок на карте. Нажмите, чтобы сменить регион</div>
          </div>
          <Icon name="swap" size={17} className="chev" />
        </button>
      </div>

      {sel ? (
        <Section title={<><Flag cc={REGIONS[sel].cc} size={20} /> {REGIONS[sel].name}</>} note={`${count(here.length, 'резидент', 'резидента', 'резидентов')} · ${REGIONS[sel].country}`} more="Все регионы" onMore={() => setSel(null)}>
          <List>
            {here.map(({ p, pct }) => (
              <Item
                key={p.id}
                lead={<Avatar person={p} size={44} dot={p.online} />}
                title={p.name}
                sub={`${p.city} · ${p.title}, ${p.company}`}
                meta={<span className={`pct${pct >= 75 ? ' pct--hi' : ''}`}>{pct}%</span>}
                onClick={() => go(`/p/${p.id}`)}
              />
            ))}
          </List>
        </Section>
      ) : (
        <Section title="Кто где" note="Нажмите на регион — покажем людей там">
          <List>
            {REGION_KEYS.map((k) => {
              const folks = peopleIn(k);
              const online = folks.filter((p) => p.online).length;
              return (
                <Item
                  key={k}
                  lead={<span className="picker__lead" style={{ width: 44, height: 44, borderRadius: 14 }}><Flag cc={REGIONS[k].cc} size={26} /></span>}
                  title={`${REGIONS[k].name}${k === app.me.region ? ' · вы здесь' : ''}`}
                  sub={`${count(folks.length, 'резидент', 'резидента', 'резидентов')} · ${online} онлайн`}
                  meta={
                    <div className="ava-stack">
                      {folks.slice(0, 3).map((p) => <Avatar key={p.id} person={p} size={24} />)}
                    </div>
                  }
                  onClick={() => setSel(k)}
                />
              );
            })}
          </List>
        </Section>
      )}

      <RegionSheet app={app} open={regionSheet} onClose={() => setRegionSheet(false)} />
    </div>
  );
}
