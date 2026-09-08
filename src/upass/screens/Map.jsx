import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import WorldMap from '../components/WorldMap.jsx';
import Scene, { SceneThumb } from '../components/Scene.jsx';
import { Top, List, Item, Chip, Scroller, Section, Sheet, Btn, KV, Note, Seg } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';
import { REGIONS, REGION_KEYS, MAIN_REGIONS, TIERS_REGION, TOTALS } from '../data/regions.js';
import { ROLE_TONE } from '../data/people.js';
import { RESIDENTS } from '../data/people.js';
import { flight, monthly, tripCost, fitsBudget, hoursText } from '../lib/travel.js';
import { usdExact, nf, plural } from '../lib/format.js';

const HOUSING = [
  { id: 'apt', name: 'Апартаменты' },
  { id: 'villa', name: 'Вилла' },
  { id: 'hotel', name: 'Отель' },
];

export default function MapScreen() {
  const app = useApp();
  const { me } = app;
  const [sel, setSel] = useState(null);
  const [budget, setBudget] = useState(null);

  const sorted = useMemo(
    () =>
      REGION_KEYS.filter((k) => k !== me.city)
        .map((k) => ({ key: k, ...REGIONS[k], f: flight(me.city, k), m: monthly(k, 'lean') }))
        .sort((a, b) => a.f.km - b.f.km),
    [me.city]
  );

  return (
    <div className="screen screen--flush stack-20">
      <div style={{ padding: '0 16px' }}>
        <Top
          title="Куда лечу"
          sub={`${REGION_KEYS.length} регионов · ${nf(TOTALS.residents)} резидентов · ${nf(TOTALS.companies)} компаний`}
        />
      </div>

      <WorldMap
        regions={REGION_KEYS}
        people={RESIDENTS}
        selected={sel}
        onSelect={setSel}
        onPerson={(id) => go(`/p/${id}`)}
        myRegion={me.city}
        height={340}
      />

      <div style={{ padding: '0 16px' }} className="stack-20">
        <div className="legend">
          {Object.entries(ROLE_TONE).map(([role, tone]) => (
            <span key={role} className="legend__i"><i className="legend__d" style={{ background: tone }} />{role}</span>
          ))}
        </div>

        <List>
          <Item
            icon="compass"
            title="Подобрать регион под бюджет"
            sub="Сколько стоит месяц жизни с билетами — от вашего региона"
            onClick={() => setBudget(2000)}
          />
        </List>

        <Section title="Основные регионы">
          <div className="scroller">
            {MAIN_REGIONS.map((k) => (
              <button key={k} onClick={() => setSel(k)} style={{ width: 168 }}>
                <Scene city={k} height={104} label>
                  <div className="scene__over">
                    <div className="t-md" style={{ color: '#fff' }}>{REGIONS[k].name}</div>
                    <div className="t-xs" style={{ color: 'rgba(255,255,255,.65)' }}>{REGIONS[k].residents} резидентов</div>
                  </div>
                </Scene>
              </button>
            ))}
          </div>
        </Section>

        <Section title={`От вас · ${REGIONS[me.city].flag} ${REGIONS[me.city].name}`}>
          <List>
            {sorted.map((r) => (
              <Item
                key={r.key}
                lead={<SceneThumb city={r.key} size={46} />}
                title={
                  <span className="row" style={{ gap: 6 }}>
                    <span className="ell">{r.name}</span>
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
                onClick={() => setSel(r.key)}
              />
            ))}
          </List>
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

/* Карточка направления: перелёт, жильё, месяц жизни — всё считается на месте. */
function RegionSheet({ from, to, onOpen }) {
  const [style, setStyle] = useState('lean');
  const [housing, setHousing] = useState('apt');
  const r = REGIONS[to];
  const t = tripCost(from, to, style, housing, 1);
  const f = t.flight;

  return (
    <div className="stack">
      <Scene city={to} height={150} label>
        <div className="scene__over">
          <div className="h2" style={{ color: '#fff' }}>{r.name}</div>
          <div className="t-xs" style={{ color: 'rgba(255,255,255,.7)' }}>{r.country} · {TIERS_REGION[r.tier].name}</div>
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
        <KV k={housing === 'hotel' ? 'Отель, за месяц' : 'Жильё, месяц'} v={usdExact(housing === 'hotel' ? t.monthly.rent * 30 : t.monthly.rent)} />
        <KV k="Еда, транспорт, связь" v={usdExact(t.monthly.living)} />
        <KV k="Месяц жизни" v={usdExact(housing === 'hotel' ? t.monthly.rent * 30 + t.monthly.living : t.monthly.total)} tone="var(--gold)" />
        <KV k="С билетами туда-обратно" v={usdExact(t.tickets + (housing === 'hotel' ? t.monthly.rent * 30 + t.monthly.living : t.monthly.total))} tone="var(--cyan)" />
      </div>

      <Note icon="eye">{r.visa}. Лучшее время: {r.best.toLowerCase()}. Интернет — около {r.internet} Мбит/с.</Note>

      <Btn variant="gold" wide onClick={onOpen}>Открыть регион</Btn>
    </div>
  );
}

function BudgetPicker({ from, limit, setLimit, onPick }) {
  const fits = useMemo(() => fitsBudget(from, limit, 'lean', 'apt'), [from, limit]);
  return (
    <div className="stack">
      <div className="wrap">
        {[1200, 1500, 2000, 3000, 5000].map((v) => (
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
            title={REGIONS[x.key].name}
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
