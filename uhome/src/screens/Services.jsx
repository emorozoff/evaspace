import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { companiesFor } from '../lib/select.js';
import { CATEGORIES, COMPANIES, catById } from '../data/services.js';
import { REGIONS, REGION_KEYS } from '../data/regions.js';
import { count } from '../lib/format.js';
import { Top, Search, Picker, Section, Empty, Btn, Stars, Note } from '../components/UI.jsx';
import { Brand } from '../components/Covers.jsx';
import Icon from '../components/Icons.jsx';
import Flag from '../components/Flag.jsx';

/* Маркетплейс только из компаний резидентов. Сверху категории плитками,
   дальше — что рекомендуем в вашем регионе, и все компании списком.
   Регион по умолчанию — ваш: сначала то, чем можно воспользоваться сейчас. */

export default function Services({ query }) {
  const app = useApp();
  const [cat, setCat] = useState(query.cat || 'all');
  const [region, setRegion] = useState('mine');
  const [q, setQ] = useState('');
  const list = useMemo(() => companiesFor(app, { cat, region, q }), [app, cat, region, q]);
  const r = region === 'mine' ? app.me.region : region;
  // рекомендации — в порядке, в каком их расставила команда клуба
  const featured = COMPANIES.filter((c) => c.featured && c.regions.includes(app.me.region));
  const browsing = cat === 'all' && !q;

  const regionOptions = [
    { id: 'mine', name: `Мой регион · ${REGIONS[app.me.region].name}`, lead: <Flag cc={REGIONS[app.me.region].cc} size={24} /> },
    ...REGION_KEYS.filter((k) => k !== app.me.region).map((k) => ({ id: k, name: REGIONS[k].name, lead: <Flag cc={REGIONS[k].cc} size={24} /> })),
    { id: 'all', name: 'Все регионы', lead: <Icon name="globe" size={20} /> },
  ];

  return (
    <div className="screen stack-24 rise-in">
      <div>
        <Top title="Услуги" sub={`Только компании резидентов · ${count(COMPANIES.length, 'компания', 'компании', 'компаний')}`} />
        <div className="stack">
          <Search value={q} onChange={setQ} placeholder="Виза, байк, вилла, сад, ужин…" />
          <div className="filters">
            <Picker
              label="Регион"
              title="Где нужна услуга"
              summary={r === 'all' ? 'Все регионы' : <><Flag cc={REGIONS[r].cc} size={14} /> {REGIONS[r].name}</>}
              options={regionOptions}
              value={region}
              def="mine"
              onChange={setRegion}
            />
          </div>
        </div>
      </div>

      <div className="cats">
        {CATEGORIES.map((c) => {
          const on = cat === c.id;
          const n = companiesFor(app, { cat: c.id, region }).length;
          return (
            <button key={c.id} className={`cat${on ? ' cat--on' : ''}`} onClick={() => setCat(on ? 'all' : c.id)}>
              <span className="cat__glow" style={{ background: c.tone }} />
              <span className="cat__ic" style={{ background: `${c.tone}22`, color: c.tone }}><Icon name={c.icon} size={20} /></span>
              <span className="cat__t">{c.name}</span>
              <span className="cat__n">{n ? count(n, 'компания', 'компании', 'компаний') : 'нет в регионе'}</span>
            </button>
          );
        })}
      </div>

      {browsing && featured.length > 0 && (
        <Section title="Рекомендуем" note={`Резиденты пользуются ${REGIONS[app.me.region].loc}`}>
          <div className="scroller">
            {featured.map((c) => (
              <button key={c.id} className="feat" onClick={() => go(`/service/${c.id}`)}>
                <Brand company={c} height={128} radius={0}>
                  <div className="scene__top">
                    <span className="glass">{catById(c.cat).name}</span>
                    <span className="glass" style={{ color: 'var(--gold)' }}>★ {c.rating.toFixed(1)}</span>
                  </div>
                </Brand>
                <div className="feat__body">
                  <div className="t-lg">{c.name}</div>
                  <div className="t-xs dim ell">{c.tagline}</div>
                  <div className="perk" style={{ marginTop: 4 }}><Icon name="gift" size={13} /><span>{c.perk}</span></div>
                </div>
              </button>
            ))}
          </div>
        </Section>
      )}

      <Section
        title={cat === 'all' ? (q ? 'Нашлось' : 'Все компании') : catById(cat).name}
        note={cat !== 'all' ? catById(cat).hint : undefined}
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
          <div className="stack-8">{list.map((c) => <CompanyRow key={c.id} c={c} />)}</div>
        )}
      </Section>

      <Note icon="shield" tone="var(--gold)">
        Здесь только компании резидентов. Если что-то пошло не так — напишите команде, разберёмся лично.
      </Note>
    </div>
  );
}

export function CompanyRow({ c }) {
  return (
    <button className="co" onClick={() => go(`/service/${c.id}`)}>
      <Brand company={c} size={58} radius={16} />
      <div className="co__body">
        <div className="spread">
          <span className="t-md ell">{c.name}</span>
          <Stars value={c.rating} />
        </div>
        <div className="t-xs dim ell">{c.tagline}</div>
        <div className="spread" style={{ marginTop: 2 }}>
          <span className="perk"><Icon name="gift" size={12} /><span>{c.perk}</span></span>
          <span className="t-xs dim-2" style={{ flex: 'none' }}>
            {c.regions.length > 3 ? 'все регионы' : c.regions.map((k) => <Flag key={k} cc={REGIONS[k].cc} size={13} style={{ marginRight: 3 }} />)}
          </span>
        </div>
      </div>
    </button>
  );
}
