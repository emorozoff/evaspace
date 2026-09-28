import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { companiesFor } from '../lib/select.js';
import { CATEGORIES, COMPANIES, catById } from '../data/services.js';
import { REGIONS, REGION_KEYS } from '../data/regions.js';
import { count, plural } from '../lib/format.js';
import { Top, Search, Picker, Section, Empty, Btn, List, Item } from '../components/UI.jsx';
import { Brand } from '../components/Covers.jsx';
import Icon from '../components/Icons.jsx';
import Flag from '../components/Flag.jsx';

/* Услуги — только компании резидентов. Поиск, регион, категории чипами,
   что рекомендуем в вашем регионе и все компании списком. */

export default function Services({ query }) {
  const app = useApp();
  const [cat, setCat] = useState(query.cat || 'all');
  const [region, setRegion] = useState('mine');
  const [q, setQ] = useState('');
  const list = useMemo(() => companiesFor(app, { cat, region, q }), [app, cat, region, q]);
  const r = region === 'mine' ? app.me.region : region;
  const featured = COMPANIES.filter((c) => c.featured && c.regions.includes(app.me.region));
  const browsing = cat === 'all' && !q;

  const regionOptions = [
    { id: 'mine', name: `Мой регион · ${REGIONS[app.me.region].name}`, lead: <Flag cc={REGIONS[app.me.region].cc} size={24} /> },
    ...REGION_KEYS.filter((k) => k !== app.me.region).map((k) => ({ id: k, name: REGIONS[k].name, lead: <Flag cc={REGIONS[k].cc} size={24} /> })),
    { id: 'all', name: 'Все регионы', lead: <Icon name="globe" size={20} /> },
  ];

  return (
    <div className="screen stack-24 rise-in">
      <div className="stack">
        <Top title="Услуги" mark={String(COMPANIES.length).padStart(2, '0')} sub={`${COMPANIES.length} ${plural(COMPANIES.length, 'компания', 'компании', 'компаний')} · только резиденты клуба`} />
        <Search value={q} onChange={setQ} placeholder="Виза, байк, вилла, сад, ужин…" />
        <div className="filters">
          <Picker
            label="Регион"
            title="Где нужна услуга"
            summary={r === 'all' ? <><Icon name="globe" size={16} /> Все регионы</> : <><Flag cc={REGIONS[r].cc} size={16} /> {REGIONS[r].name}</>}
            options={regionOptions}
            value={region}
            def="mine"
            onChange={setRegion}
          />
        </div>
      </div>

      <div className="scroller">
        <button className={`chip${cat === 'all' ? ' chip--on' : ''}`} onClick={() => setCat('all')}>Все</button>
        {CATEGORIES.map((c) => {
          const on = cat === c.id;
          const n = companiesFor(app, { cat: c.id, region }).length;
          return (
            <button key={c.id} className={`chip${on ? ' chip--on' : ''}`} style={n ? undefined : { opacity: 0.5 }} onClick={() => setCat(on ? 'all' : c.id)} aria-pressed={on}>
              <Icon name={c.icon} size={15} /> {c.name}{n ? <span className="dim-2"> {n}</span> : null}
            </button>
          );
        })}
      </div>

      {browsing && featured.length > 0 && (
        <Section title="Рекомендуем" note={`Резиденты пользуются ${REGIONS[app.me.region].loc}`}>
          <div className="scroller">
            {featured.map((c) => (
              <button key={c.id} className="card tap s-feat" onClick={() => go(`/service/${c.id}`)}>
                <span className="spread"><Brand company={c} size={44} radius={22} /><span className="s-star"><Icon name="star" size={12} fill="currentColor" width={1} />{c.rating.toFixed(1)}</span></span>
                <span className="h3" style={{ display: 'block', marginTop: 14 }}>{c.name}</span>
                <span className="t-xs dim-2 clamp-2" style={{ display: 'block', marginTop: 3 }}>{c.tagline}</span>
                <span className="s-perk"><Icon name="gift" size={12} /> {c.perk}</span>
              </button>
            ))}
          </div>
        </Section>
      )}

      <Section
        title={cat === 'all' ? (q ? 'Нашлось' : 'Все компании') : catById(cat).name}
        note={cat !== 'all' ? catById(cat).hint : `${count(list.length, 'компания', 'компании', 'компаний')} · сначала ваш регион`}
        more={cat !== 'all' ? 'Сбросить' : undefined}
        onMore={() => setCat('all')}
      >
        {list.length === 0 ? (
          <Empty
            icon="search"
            title="Здесь пока пусто"
            text={r === 'all' ? 'Попробуйте другой запрос.' : `В регионе «${REGIONS[r].name}» таких компаний ещё нет. Посмотрите во всех регионах или спросите команду.`}
            action={<Btn size="sm" variant="ghost" onClick={() => { setRegion('all'); setQ(''); }}>Все регионы</Btn>}
          />
        ) : (
          <List>{list.map((c) => <CompanyRow key={c.id} c={c} />)}</List>
        )}
      </Section>

      <div className="note-line">Здесь только компании резидентов. Если что-то пошло не так — напишите команде, разберёмся лично.</div>
    </div>
  );
}

export function CompanyRow({ c }) {
  return (
    <Item
      lead={<Brand company={c} size={44} radius={22} />}
      title={c.name}
      sub={c.tagline}
      meta={<><span className="s-star"><Icon name="star" size={11} fill="currentColor" width={1} />{c.rating.toFixed(1)}</span><span className="row" style={{ gap: 3 }}>{c.regions.length > 3 ? 'везде' : c.regions.map((k) => <Flag key={k} cc={REGIONS[k].cc} size={12} />)}</span></>}
      chev={false}
      onClick={() => go(`/service/${c.id}`)}
    />
  );
}
