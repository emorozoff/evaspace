import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import WorldMap from '../components/WorldMap.jsx';
import Scene, { SceneThumb } from '../components/Scene.jsx';
import { Avatar } from '../components/Art.jsx';
import { PosterThumb } from '../components/Poster.jsx';
import { Top, List, Item, Chip, Section, Sheet, Btn, KV, Note, Seg, Tag } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';
import { REGIONS, REGION_KEYS, MAIN_REGIONS, TIERS_REGION, TOTALS, visaShort } from '../data/regions.js';
import { RESIDENTS, byId } from '../data/people.js';
import { EVENT_KINDS, FLAGSHIPS } from '../data/life.js';
import { circleOf, circleMeta } from '../data/circles.js';
import { upcoming, whereToMeet } from '../lib/select.js';
import { bestMatches, matchPct, matchReasons } from '../lib/match.js';
import { flight, monthly, tripCost, fitsBudget, hoursText } from '../lib/travel.js';
import { usdExact, nf, plural, relDay, stayLabel } from '../lib/format.js';

const HOUSING = [
  { id: 'apt', name: 'Апартаменты' },
  { id: 'villa', name: 'Вилла' },
  { id: 'hotel', name: 'Отель' },
];

const SORTS = [
  { value: 'near', label: 'Ближе' },
  { value: 'cheap', label: 'Дешевле' },
  { value: 'people', label: 'Своих' },
];

export default function MapScreen() {
  const app = useApp();
  const { me } = app;
  const [sel, setSel] = useState(null);
  const [budget, setBudget] = useState(null);
  const [tab, setTab] = useState('places');

  return (
    <div className="screen screen--flush stack-20">
      <div style={{ padding: '0 16px' }}>
        <Top
          title="Регионы"
          sub={`${REGION_KEYS.length} регионов · ${nf(TOTALS.residents)} резидентов · ${nf(TOTALS.companies)} компаний`}
        />
      </div>

      <div className="maparea">
        <WorldMap
          regions={REGION_KEYS}
          people={RESIDENTS}
          selected={sel}
          onSelect={setSel}
          onPerson={(id) => go(`/p/${id}`)}
          myRegion={me.city}
          height={340}
        />
        <button className="maparea__cta" onClick={() => go(`/people?region=${me.city}`)}>
          <Icon name="users" size={16} />
          Кто рядом
        </button>
      </div>

      <div style={{ padding: '0 16px' }} className="stack-20">
        <Section title="Основные регионы">
          <div className="scroller">
            {MAIN_REGIONS.map((k) => (
              <button key={k} onClick={() => setSel(k)} style={{ width: 172 }}>
                <Scene city={k} height={108}>
                  <div className="scene__over">
                    <div className="t-md" style={{ color: '#fff' }}>{REGIONS[k].flag} {REGIONS[k].name}</div>
                    <div className="t-xs" style={{ color: 'rgba(255,255,255,.75)' }}>
                      {REGIONS[k].residents} своих · от {usdExact(monthly(k, 'lean').total)}/мес
                    </div>
                  </div>
                </Scene>
              </button>
            ))}
          </div>
        </Section>

        <Section title={`От вас · ${REGIONS[me.city].flag} ${REGIONS[me.city].name}`}>
          <Seg
            value={tab}
            onChange={setTab}
            options={[
              { value: 'events', label: 'События' },
              { value: 'people', label: 'Люди' },
              { value: 'places', label: 'Локации' },
            ]}
          />
          {tab === 'events' && <EventsTab me={me} />}
          {tab === 'people' && <PeopleTab app={app} />}
          {tab === 'places' && <PlacesTab me={me} onPick={setSel} onBudget={() => setBudget(3000)} />}
        </Section>
      </div>

      <Sheet open={!!sel} onClose={() => setSel(null)}>
        {sel && <RegionSheet from={me.city} to={sel} onOpen={() => go(`/region/${sel}`)} />}
      </Sheet>

      <Sheet open={budget !== null} onClose={() => setBudget(null)} title="Регион под бюджет" sub="Билеты туда-обратно плюс месяц жизни">
        {budget !== null && <BudgetPicker from={me.city} limit={budget} setLimit={setBudget} onPick={(k) => { setBudget(null); setSel(k); }} />}
      </Sheet>
    </div>
  );
}

/* ——— события основных регионов ——— */
function EventsTab({ me }) {
  const list = useMemo(
    () =>
      upcoming(me)
        .filter((e) => e.region === 'global' || MAIN_REGIONS.includes(e.region) || e.region === me.city)
        .sort((a, b) => rank(b) - rank(a) || a.inDays - b.inDays)
        .slice(0, 8),
    [me]
  );

  return (
    <List>
      {list.map((e) => (
        <Item
          key={e.id}
          lead={<PosterThumb event={e} size={44} />}
          title={
            <span className="row" style={{ gap: 6 }}>
              <span style={{ flex: 'none' }}>{e.online ? '🛰' : REGIONS[e.region]?.flag}</span>
              <span className="ell">{e.title}</span>
            </span>
          }
          sub={`${relDay(e.inDays)}, ${e.time} · ${e.online ? 'эфир' : REGIONS[e.region]?.name || 'сообщество'}`}
          meta={FLAGSHIPS.includes(e.kind) ? <Tag tone="gold">Маст-хэв</Tag> : e.top ? <Tag tone="cyan">Топ</Tag> : undefined}
          onClick={() => go(`/event/${e.id}`)}
        />
      ))}
    </List>
  );
}

const rank = (e) => (FLAGSHIPS.includes(e.kind) ? 2 : e.top ? 1 : 0);

/* ——— люди по регионам: совпадения, круг и «хочу встретиться» ——— */
function PeopleTab({ app }) {
  const { me } = app;
  const list = useMemo(() => {
    const ranked = bestMatches(me, RESIDENTS, 40);
    const keep = ranked.filter(
      ({ p, pct }) => app.meet.includes(p.id) || circleOf(p.id, app.circles) || pct >= 68
    );
    return keep
      .sort((a, b) => (app.meet.includes(b.p.id) ? 1 : 0) - (app.meet.includes(a.p.id) ? 1 : 0) || b.score - a.score)
      .slice(0, 12);
  }, [me, app.circles, app.meet]);

  if (!list.length) {
    return <Note icon="users">Пока никого не подобралось. Отметьте в профиле, что ищете, — совпадения появятся.</Note>;
  }

  return (
    <div className="stack-8">
      {list.map(({ p, pct }) => (
        <MeetRow key={p.id} p={p} pct={pct} app={app} />
      ))}
      <Note icon="pin">Отметка «хочу встретиться» подсказывает, куда человек летит и на какие встречи идёт.</Note>
    </div>
  );
}

function MeetRow({ p, pct, app }) {
  const { me } = app;
  const c = REGIONS[p.city];
  const circle = circleOf(p.id, app.circles);
  const want = app.meet.includes(p.id);
  const where = want ? whereToMeet(me, p.id) : [];
  const reason = matchReasons(me, p)[0];

  return (
    <div className={`card${want ? ' card--gold' : ''}`}>
      <div className="row" style={{ gap: 11 }}>
        <button onClick={() => go(`/p/${p.id}`)} style={{ flex: 'none' }}>
          <Avatar person={p} size={44} dot={p.online} />
        </button>
        <button className="grow" style={{ minWidth: 0, textAlign: 'left' }} onClick={() => go(`/p/${p.id}`)}>
          <div className="row" style={{ gap: 6 }}>
            <span className="t-md ell">{p.name}</span>
            {circle && <Tag tone="cyan">{circleMeta(circle)?.short}</Tag>}
          </div>
          <div className="t-xs dim-2 ell" style={{ marginTop: 2 }}>
            {c.flag} {c.name} · {reason || p.company}
          </div>
        </button>
        <div className="meetside">
          <span className={`tag${pct >= 75 ? ' tag--gold' : ''}`}>{pct}%</span>
          <button
            className={`meetbtn${want ? ' meetbtn--on' : ''}`}
            onClick={() => app.toggleMeet(p.id)}
            aria-label="Хочу встретиться"
          >
            <Icon name={want ? 'check' : 'plus'} size={15} />
          </button>
        </div>
      </div>

      {want && (
        <div className="stack-8" style={{ marginTop: 11 }}>
          {where.length === 0 ? (
            <div className="t-xs dim-2">Поездок и встреч пока не объявлено — напишите напрямую.</div>
          ) : (
            where.map((w, i) =>
              w.kind === 'trip' ? (
                <button key={i} className="meetline" onClick={() => go(`/region/${w.region}`)}>
                  <Icon name="plane" size={14} color="var(--gold)" />
                  <span>Летит в {REGIONS[w.region].name} · {relDay(w.inDays)} на {stayLabel(w.days)}</span>
                </button>
              ) : (
                <button key={i} className="meetline" onClick={() => go(`/event/${w.event.id}`)}>
                  <Icon name="calendar" size={14} color="var(--cyan)" />
                  <span>{w.event.title} · {relDay(w.event.inDays)}</span>
                </button>
              )
            )
          )}
          <Btn size="sm" variant="quiet" icon="message" onClick={() => go(`/dm/${p.id}`)}>Написать</Btn>
        </div>
      )}
    </div>
  );
}

/* ——— локации ——— */
function PlacesTab({ me, onPick, onBudget }) {
  const [sort, setSort] = useState('near');
  const list = useMemo(() => {
    const rows = REGION_KEYS.filter((k) => k !== me.city).map((k) => ({
      key: k, ...REGIONS[k], f: flight(me.city, k), m: monthly(k, 'lean'),
    }));
    if (sort === 'cheap') return rows.sort((a, b) => a.f.from + a.m.total - (b.f.from + b.m.total));
    if (sort === 'people') return rows.sort((a, b) => b.residents - a.residents);
    return rows.sort((a, b) => a.f.km - b.f.km);
  }, [me.city, sort]);

  return (
    <div className="stack">
      <div className="row" style={{ gap: 8 }}>
        <div className="grow"><Seg value={sort} onChange={setSort} options={SORTS} /></div>
        <Btn size="sm" variant="quiet" icon="wallet" onClick={onBudget}>Бюджет</Btn>
      </div>
      <List>
        {list.map((r) => (
          <Item
            key={r.key}
            lead={<SceneThumb city={r.key} size={46} />}
            title={
              <span className="row" style={{ gap: 6 }}>
                <span className="ell">{r.flag} {r.name}</span>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: TIERS_REGION[r.tier].tone, flex: 'none' }} />
              </span>
            }
            sub={`${nf(r.f.km)} км · ${hoursText(r.f.hours)} · ${r.residents} своих`}
            meta={
              <>
                <span className="gold" style={{ fontSize: 13, fontWeight: 700 }}>от {usdExact(r.f.from)}</span>
                <span>месяц от {usdExact(r.m.total)}</span>
              </>
            }
            chev={false}
            onClick={() => onPick(r.key)}
          />
        ))}
      </List>
    </div>
  );
}

/* Карточка направления: перелёт, жильё, месяц жизни — всё считается на месте. */
function RegionSheet({ from, to, onOpen }) {
  const [style, setStyle] = useState('lean');
  const [housing, setHousing] = useState('apt');
  const r = REGIONS[to];
  const t = tripCost(from, to, style, housing, 1);
  const f = t.flight;
  const rent = housing === 'hotel' ? t.monthly.rent * 30 : t.monthly.rent;
  const month = rent + t.monthly.living;

  return (
    <div className="stack">
      <Scene city={to} height={150}>
        <div className="scene__over">
          <div className="h2" style={{ color: '#fff' }}>{r.name}</div>
          <div className="t-xs" style={{ color: 'rgba(255,255,255,.75)' }}>{r.country} · {TIERS_REGION[r.tier].name}</div>
        </div>
      </Scene>

      <div className="stats">
        <div className="stat"><div className="stat__v">{r.residents}</div><div className="stat__l">Резидентов</div></div>
        <div className="stat"><div className="stat__v">{r.companies}</div><div className="stat__l">Компаний</div></div>
        <div className="stat"><div className="stat__v">{r.communities}</div><div className="stat__l">Сообществ</div></div>
      </div>

      {f && (
        <div className="card" style={{ paddingTop: 2, paddingBottom: 2 }}>
          <KV k="Перелёт" v={`${nf(f.km)} км · ${hoursText(f.hours)}${f.direct ? '' : ' · с пересадкой'}`} />
          <KV k="Билет" v={`от ${usdExact(f.from)} · обычно ${usdExact(f.avg)}`} tone="var(--gold)" />
        </div>
      )}

      <Seg value={style} onChange={setStyle} options={[{ value: 'lean', label: 'Экономно' }, { value: 'comfort', label: 'Комфортно' }]} />
      <div className="wrap">
        {HOUSING.map((h) => <Chip key={h.id} on={housing === h.id} onClick={() => setHousing(h.id)}>{h.name}</Chip>)}
      </div>

      <div className="card" style={{ paddingTop: 2, paddingBottom: 2 }}>
        <KV k={housing === 'hotel' ? 'Отель, за месяц' : 'Жильё, месяц'} v={usdExact(rent)} />
        <KV k="Еда, транспорт, связь" v={usdExact(t.monthly.living)} />
        <KV k="Месяц жизни" v={usdExact(month)} tone="var(--gold)" />
        <KV k="С билетами туда-обратно" v={usdExact(t.tickets + month)} tone="var(--cyan)" />
      </div>

      <Note icon="eye">{visaShort(to)}. Лучшее время: {r.best.toLowerCase()}. Интернет — около {r.internet} Мбит/с.</Note>

      <Btn variant="gold" wide onClick={onOpen}>Открыть регион</Btn>
    </div>
  );
}

function BudgetPicker({ from, limit, setLimit, onPick }) {
  const fits = useMemo(() => fitsBudget(from, limit, 'lean', 'apt'), [from, limit]);
  return (
    <div className="stack">
      <div className="wrap">
        {[1500, 2000, 3000, 5000, 8000].map((v) => (
          <Chip key={v} on={limit === v} onClick={() => setLimit(v)}>до {usdExact(v)}</Chip>
        ))}
      </div>
      <div className="t-sm dim">
        {fits.length
          ? `${fits.length} ${plural(fits.length, 'регион подходит', 'региона подходят', 'регионов подходят')} под ${usdExact(limit)} в месяц — с билетами туда-обратно и жильём.`
          : 'Под такой бюджет пока ничего. Поднимите порог.'}
      </div>
      <List>
        {fits.map((x) => (
          <Item
            key={x.key}
            lead={<SceneThumb city={x.key} size={44} />}
            title={`${REGIONS[x.key].flag} ${REGIONS[x.key].name}`}
            sub={`Билеты ${usdExact(x.tickets)} · месяц ${usdExact(x.living)}`}
            meta={<span className="gold" style={{ fontSize: 13, fontWeight: 700 }}>{usdExact(x.total)}</span>}
            chev={false}
            onClick={() => onPick(x.key)}
          />
        ))}
      </List>
    </div>
  );
}
