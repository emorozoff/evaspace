import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import WorldMap from '../components/WorldMap.jsx';
import Scene, { SceneThumb } from '../components/Scene.jsx';
import { Top, List, Item, Chip, Scroller, Section, Sheet, Btn, KV, Note } from '../components/UI.jsx';
import { Avatar } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';
import { LOCATIONS, CITIES, STATUS, KINDS } from '../data/places.js';
import { HUB_MAIN } from '../data/landmarks.js';
import { upcoming, visibleResidents } from '../lib/select.js';
import { usdExact, nf, plural } from '../lib/format.js';
import { distanceKm } from '../data/world.js';

export default function MapScreen() {
  const app = useApp();
  const { me } = app;
  const [filter, setFilter] = useState('all');
  const [sel, setSel] = useState(null);

  const people = useMemo(() => visibleResidents(me), [me]);
  const summit = upcoming(me).find((e) => e.kind === 'summit');
  const summitCity = summit ? LOCATIONS.find((l) => l.id === summit.loc)?.city : null;

  const homes = useMemo(() => LOCATIONS.filter((l) => filter === 'all' || l.status === filter), [filter]);
  const selected = sel && LOCATIONS.find((l) => l.id === sel);
  const main = LOCATIONS.filter((l) => HUB_MAIN.includes(l.city));

  const sorted = useMemo(() => {
    const from = CITIES[me.city];
    return [...homes].map((l) => ({ ...l, km: distanceKm(from, CITIES[l.city]) })).sort((a, b) => a.km - b.km);
  }, [homes, me.city]);

  return (
    <div className="screen screen--flush stack-20">
      <div style={{ padding: '0 16px' }}>
        <Top title="Карта" sub={`20 хабов UHOME · ${people.length} ${plural(people.length, 'резидент', 'резидента', 'резидентов')} на карте`} />
      </div>

      <WorldMap
        locations={homes}
        people={people}
        selected={sel}
        onSelect={(id) => setSel(id)}
        onPerson={(id) => go(`/p/${id}`)}
        myCity={me.city}
        routeTo={summitCity}
        height={340}
      />

      <div style={{ padding: '0 16px' }} className="stack-20">
        <Scroller>
          <Chip on={filter === 'all'} onClick={() => setFilter('all')}>Все · {LOCATIONS.length}</Chip>
          {Object.entries(STATUS).map(([k, s]) => (
            <Chip key={k} on={filter === k} onClick={() => setFilter(k)}>
              <span style={{ width: 7, height: 7, borderRadius: 4, background: s.tone, display: 'inline-block' }} />
              {s.name} · {LOCATIONS.filter((l) => l.status === k).length}
            </Chip>
          ))}
        </Scroller>

        <Section title="Главные хабы">
          <div className="scroller">
            {main.map((l) => (
              <button key={l.id} onClick={() => setSel(l.id)} style={{ width: 168 }}>
                <Scene city={l.city} height={104} label>
                  <div className="scene__over">
                    <div className="t-md" style={{ color: '#fff' }}>{l.name}</div>
                    <div className="t-xs" style={{ color: 'rgba(255,255,255,.65)' }}>{l.residents} резидентов</div>
                  </div>
                </Scene>
              </button>
            ))}
          </div>
        </Section>

        {summit && (
          <List>
            <Item
              icon="plane"
              title={summit.title}
              sub="Дуга на карте — путь от вашего города до места слёта"
              subWrap
              onClick={() => go(`/event/${summit.id}`)}
            />
          </List>
        )}

        <Section title={`От вас · ${CITIES[me.city].flag} ${CITIES[me.city].name}`}>
          <List>
            {sorted.map((l) => (
              <Item
                key={l.id}
                lead={<SceneThumb city={l.city} size={46} />}
                title={
                  <span className="row" style={{ gap: 6 }}>
                    <span className="ell">{l.name}</span>
                    <span style={{ width: 6, height: 6, borderRadius: 3, background: STATUS[l.status].tone, flex: 'none' }} />
                  </span>
                }
                sub={`${CITIES[l.city].flag} ${CITIES[l.city].name} · ${KINDS[l.kind].short} · ${nf(l.km)} км`}
                meta={l.tariff ? <span className="gold" style={{ fontSize: 13, fontWeight: 700 }}>{usdExact(l.tariff)}</span> : <span>{STATUS[l.status].name}</span>}
                onClick={() => setSel(l.id)}
              />
            ))}
          </List>
        </Section>
      </div>

      <Sheet open={!!selected} onClose={() => setSel(null)}>
        {selected && <HubSheet loc={selected} me={me} people={people} onOpen={() => go(`/loc/${selected.id}`)} />}
      </Sheet>
    </div>
  );
}

function HubSheet({ loc, me, people, onOpen }) {
  const c = CITIES[loc.city];
  const here = people.filter((r) => r.city === loc.city);
  return (
    <div className="stack">
      <Scene city={loc.city} height={150} label>
        <div className="scene__over">
          <div className="row" style={{ gap: 6, marginBottom: 4 }}>
            <span className="tag" style={{ background: `${STATUS[loc.status].tone}2a`, color: STATUS[loc.status].tone }}>{STATUS[loc.status].name}</span>
            <span className="tag">{KINDS[loc.kind].name}</span>
          </div>
          <div className="h2" style={{ color: '#fff' }}>{loc.name}</div>
        </div>
      </Scene>

      <div className="card" style={{ paddingTop: 2, paddingBottom: 2 }}>
        <KV k="Адрес" v={loc.address} />
        {loc.tariff > 0 && <KV k="Тариф резидента" v={`${usdExact(loc.tariff)} / ночь · рынок ${usdExact(loc.market)}`} tone="var(--gold)" />}
        <KV k="Резидентов в городе" v={String(loc.residents)} />
        {loc.opened && <KV k="Открытие" v={String(loc.opened)} />}
      </div>

      {here.length > 0 && (
        <div className="scroller">
          {here.map((r) => (
            <button key={r.id} className="center" style={{ width: 62 }} onClick={() => go(`/p/${r.id}`)}>
              <Avatar person={r} size={44} dot={r.online} style={{ margin: '0 auto' }} />
              <div className="t-xs dim-2" style={{ marginTop: 5 }}>{r.name.split(' ')[0]}</div>
            </button>
          ))}
        </div>
      )}

      <Btn variant="gold" wide onClick={onOpen}>Открыть локацию</Btn>
    </div>
  );
}
