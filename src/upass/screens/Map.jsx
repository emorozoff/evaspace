import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import WorldMap from '../components/WorldMap.jsx';
import { Card, Chip, Section, Seg, Btn, Scroller } from '../components/UI.jsx';
import { Cover } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';
import { LOCATIONS, CITIES, STATUS, KINDS } from '../data/places.js';
import { RESIDENTS } from '../data/people.js';
import { upcoming } from '../lib/select.js';
import { usd, nf, pct, plural } from '../lib/format.js';
import { distanceKm } from '../data/world.js';

export default function MapScreen() {
  const app = useApp();
  const { me } = app;
  const [mode, setMode] = useState('homes');
  const [filter, setFilter] = useState('all');
  const [sel, setSel] = useState(null);

  const summit = upcoming(me).find((e) => e.kind === 'summit');
  const summitCity = summit ? LOCATIONS.find((l) => l.id === summit.loc)?.city : null;

  const homes = useMemo(
    () => LOCATIONS.filter((l) => filter === 'all' || l.status === filter),
    [filter]
  );

  const peoplePins = useMemo(() => {
    const byCity = {};
    for (const r of RESIDENTS) byCity[r.city] = (byCity[r.city] || 0) + 1;
    return Object.entries(byCity).map(([city, n]) => ({
      id: 'city-' + city,
      city,
      name: CITIES[city].name,
      status: n >= 4 ? 'open' : 'soon',
      count: n,
    }));
  }, []);

  const pins = mode === 'homes' ? homes : peoplePins;
  const selected = sel && pins.find((p) => p.id === sel);

  const sorted = useMemo(() => {
    const from = CITIES[me.city];
    return [...homes]
      .map((l) => ({ ...l, km: distanceKm(from, CITIES[l.city]) }))
      .sort((a, b) => a.km - b.km);
  }, [homes, me.city]);

  return (
    <div className="screen screen--flush stack-16">
      <div style={{ padding: '4px 18px 0' }} className="spread">
        <div>
          <div className="eyebrow">Сеть кооператива</div>
          <h2 className="display" style={{ marginTop: 3 }}>UHOME · 20 локаций</h2>
        </div>
        <button className="iconbtn" onClick={() => go('/people')}><Icon name="users" size={18} /></button>
      </div>

      <div style={{ padding: '0 18px' }}>
        <Seg
          value={mode}
          onChange={(v) => { setMode(v); setSel(null); }}
          options={[{ value: 'homes', label: 'Локации' }, { value: 'people', label: 'Резиденты' }]}
        />
      </div>

      <WorldMap
        locations={pins}
        selected={sel}
        onSelect={(id) => setSel((s) => (s === id ? null : id))}
        myCity={me.city}
        routeTo={summitCity}
        height={264}
      />

      <div style={{ padding: '0 18px' }} className="stack-16">
        {mode === 'homes' ? (
          <Scroller>
            <Chip on={filter === 'all'} onClick={() => setFilter('all')}>Все · {LOCATIONS.length}</Chip>
            {Object.entries(STATUS).map(([k, s]) => (
              <Chip key={k} on={filter === k} onClick={() => setFilter(k)}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: s.tone, display: 'inline-block' }} />
                {s.name} · {LOCATIONS.filter((l) => l.status === k).length}
              </Chip>
            ))}
          </Scroller>
        ) : (
          <Card className="row" style={{ gap: 12 }}>
            <Icon name="pin" size={18} color="var(--cyan)" />
            <div className="t-xs dim grow">
              Точка вашего города горит бирюзовым. Резиденты видны по городу, который указали сами —
              точнее города геолокация в клубе не работает.
            </div>
          </Card>
        )}

        {selected && mode === 'homes' && <LocCard loc={selected} me={me} />}
        {selected && mode === 'people' && (
          <Card className="spread">
            <div>
              <div className="t-md">{CITIES[selected.city].flag} {selected.name}</div>
              <div className="t-xs dim" style={{ marginTop: 3 }}>
                {selected.count} {plural(selected.count, 'резидент', 'резидента', 'резидентов')} в городе
              </div>
            </div>
            <Btn size="sm" variant="quiet" onClick={() => go(`/people?city=${selected.city}`)}>Открыть</Btn>
          </Card>
        )}

        {summit && (
          <Card variant="gold" className="row-t" style={{ gap: 12 }}>
            <Icon name="plane" size={19} color="var(--gold)" />
            <div>
              <div className="t-md">{summit.title}</div>
              <div className="t-xs dim" style={{ marginTop: 3, lineHeight: 1.45 }}>
                Золотая дуга на карте — путь от вашего города до места следующего слёта.
                Раз в квартал круг собирается в новой стране.
              </div>
              <Btn size="sm" variant="ghost" style={{ marginTop: 10 }} onClick={() => go(`/event/${summit.id}`)}>
                Смотреть программу
              </Btn>
            </div>
          </Card>
        )}

        {mode === 'homes' && (
          <Section eyebrow={`От вас · ${CITIES[me.city].name}`} title="Ближайшие локации">
            <div className="stack-8">
              {sorted.map((l) => (
                <button key={l.id} className="card tap row" style={{ gap: 12 }} onClick={() => go(`/loc/${l.id}`)}>
                  <div style={{ width: 46, height: 46, flex: 'none', borderRadius: 12, overflow: 'hidden' }}>
                    <Cover art={l.art} seed={l.id} height={46} radius={12} />
                  </div>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="row" style={{ gap: 6 }}>
                      <span className="t-md">{l.name}</span>
                      <span style={{ width: 6, height: 6, borderRadius: 3, background: STATUS[l.status].tone }} />
                    </div>
                    <div className="t-xs dim" style={{ marginTop: 2 }}>
                      {CITIES[l.city].flag} {CITIES[l.city].name} · {KINDS[l.kind].short} · {nf(l.km)} км
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {l.tariff ? (
                      <>
                        <div className="t-sm gold num">{usd(l.tariff)}</div>
                        <div className="t-xs dim-2">за ночь</div>
                      </>
                    ) : (
                      <div className="t-xs dim-2">{STATUS[l.status].name}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

function LocCard({ loc, me }) {
  const c = CITIES[loc.city];
  return (
    <Card as="button" className="tap" onClick={() => go(`/loc/${loc.id}`)} style={{ padding: 0, overflow: 'hidden', display: 'block', width: '100%', textAlign: 'left' }}>
      <Cover art={loc.art} seed={loc.id} height={110}>
        <div style={{ position: 'absolute', left: 14, bottom: 11, right: 14 }}>
          <div className="row" style={{ gap: 6, marginBottom: 5 }}>
            <span className="tag" style={{ background: `${STATUS[loc.status].tone}28`, color: STATUS[loc.status].tone }}>
              {STATUS[loc.status].name}
            </span>
            <span className="tag tag--plain">{KINDS[loc.kind].name}</span>
          </div>
          <div className="t-lg">{loc.name}</div>
        </div>
      </Cover>
      <div className="spread" style={{ padding: 13 }}>
        <div className="t-xs dim">{c.flag} {c.name}, {c.country} · {loc.residents} резидентов</div>
        {loc.tariff > 0 && <div className="t-sm gold">{usd(loc.tariff)} <span className="dim-2 t-xs">/ ночь</span></div>}
      </div>
    </Card>
  );
}
