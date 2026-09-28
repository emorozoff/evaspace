import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { companiesFor } from '../lib/select.js';
import { CATEGORIES, COMPANIES, catById } from '../data/services.js';
import { REGIONS, REGION_KEYS } from '../data/regions.js';
import { count, plural } from '../lib/format.js';
import { Top, Search, Picker, Section, Empty, Btn, Note } from '../components/UI.jsx';
import { Brand } from '../components/Covers.jsx';
import Icon from '../components/Icons.jsx';
import Flag from '../components/Flag.jsx';

/* Маркетплейс только из компаний резидентов. Сверху категории плитками,
   дальше — что рекомендуем в вашем регионе, и все компании списком.
   Регион по умолчанию — ваш: сначала то, чем можно воспользоваться сейчас. */

/* Длинное слово в узкой плитке переносится по слогу, а не по букве. */
const soft = (s) => (s.length > 10 && !s.includes(' ') ? `${s.slice(0, -5)}\u00ad${s.slice(-5)}` : s);

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
    <div className="screen stack-24 rise-in xsv">
      <div>
        <Top
          title="Услуги"
          sub={<span className="xtele"><b>{COMPANIES.length}</b> {plural(COMPANIES.length, 'компания', 'компании', 'компаний')}<i />только резиденты клуба</span>}
        />
        <div className="stack">
          <Search value={q} onChange={setQ} placeholder="Виза, байк, вилла, сад, ужин…" />
          <div className="filters">
            <Picker
              label="Регион"
              title="Где нужна услуга"
              summary={r === 'all' ? <><Icon name="globe" size={16} /> Все регионы</> : <><Flag cc={REGIONS[r].cc} size={16} /> {REGIONS[r].name}{region === 'mine' ? <span className="xsv__mine">ваш регион</span> : null}</>}
              options={regionOptions}
              value={region}
              def="mine"
              onChange={setRegion}
            />
          </div>
        </div>
      </div>

      <div className="cats xcats">
        {CATEGORIES.map((c, i) => {
          const on = cat === c.id;
          const n = companiesFor(app, { cat: c.id, region }).length;
          return (
            <button key={c.id} className={`xcat${on ? ' is-on' : ''}${n ? '' : ' is-empty'}`} style={{ '--t': c.tone, '--i': i }} onClick={() => setCat(on ? 'all' : c.id)} aria-pressed={on}>
              <span className="xcat__ic"><Icon name={c.icon} size={19} /></span>
              <span className="xcat__t">{soft(c.name)}</span>
              <span className="xcat__n">{n ? count(n, 'компания', 'компании', 'компаний') : 'нет в регионе'}</span>
            </button>
          );
        })}
      </div>

      {browsing && featured.length > 0 && (
        <Section title="Рекомендуем" note={`Резиденты пользуются ${REGIONS[app.me.region].loc}`}>
          <div className="scroller">
            {featured.map((c) => (
              <button key={c.id} className="feat xfeat" onClick={() => go(`/service/${c.id}`)}>
                <Brand company={c} height={124} radius={0}>
                  <div className="scene__top">
                    <span className="cv-chip" style={{ color: catById(c.cat).tone }}><Icon name={catById(c.cat).icon} size={12} />{catById(c.cat).name}</span>
                    <span className="cv-chip cv-chip--gold"><Icon name="star" size={11} fill="currentColor" width={1} />{c.rating.toFixed(1)}</span>
                  </div>
                </Brand>
                <div className="xfeat__body">
                  <div className="xfeat__t">{c.name}</div>
                  <div className="xfeat__s">{c.tagline}</div>
                  <div className="perk xperk"><Icon name="gift" size={13} /><span>{c.perk}</span></div>
                </div>
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
          <div className="xcos">{list.map((c, i) => <CompanyRow key={c.id} c={c} i={i} />)}</div>
        )}
      </Section>

      <Note icon="shield" tone="var(--gold)">
        Здесь только компании резидентов. Если что-то пошло не так — напишите команде, разберёмся лично.
      </Note>
    </div>
  );
}

export function CompanyRow({ c, i = 0 }) {
  return (
    <button className="xco" style={{ '--i': i }} onClick={() => go(`/service/${c.id}`)}>
      <Brand company={c} size={52} radius={15} />
      <span className="xco__body">
        <span className="xco__top">
          <span className="xco__t">{c.name}</span>
          <span className="xstar"><Icon name="star" size={11} fill="currentColor" width={1} />{c.rating.toFixed(1)}</span>
        </span>
        <span className="xco__s">{c.tagline}</span>
        <span className="xco__foot">
          <span className="perk xperk"><Icon name="gift" size={12} /><span>{c.perk}</span></span>
          <span className="xco__geo">
            {c.regions.length > 3 ? 'все регионы' : c.regions.map((k) => <Flag key={k} cc={REGIONS[k].cc} size={13} />)}
          </span>
        </span>
      </span>
    </button>
  );
}
