import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { eventsFiltered } from '../lib/select.js';
import { EVENT_TYPES } from '../data/events.js';
import { REGIONS } from '../data/regions.js';
import { count, dayShift, dateLong, plural } from '../lib/format.js';
import { Top, Picker, List, Empty, Btn } from '../components/UI.jsx';
import { EventCard, EventRow } from '../components/EventCards.jsx';
import Flag from '../components/Flag.jsx';
import Icon from '../components/Icons.jsx';

/* Афиша: лёгкий фильтр в одну строку — регион списком и тип:
   все, закрытые, партнёров. Над ним — шкала четырёх недель, где точкой
   отмечен каждый день с событием. Ближайшее — большой карточкой, дальше
   строки по неделям с датой плиткой, как на табло. */

const REGION_FILTER = ['moscow', 'bali', 'dubai', 'miami', 'europe'];
const TYPE_ICON = { all: 'spark', closed: 'lock', partner: 'handshake' };

export default function Events({ query }) {
  const app = useApp();
  const [region, setRegion] = useState(query.region || 'all');
  const [type, setType] = useState(query.type || 'all');
  const list = useMemo(() => eventsFiltered({ region, type }), [region, type]);

  const regionOptions = [
    { id: 'all', name: 'Все регионы', lead: <Icon name="globe" size={20} /> },
    ...REGION_FILTER.map((k) => ({
      id: k, name: REGIONS[k].name, lead: <Flag cc={REGIONS[k].cc} size={24} />,
      sub: k === app.me.region ? 'вы здесь' : undefined,
      meta: <span className="xmeta">{eventsFiltered({ region: k, type }).length}</span>,
    })),
    { id: 'online', name: 'Онлайн, Zoom', lead: <Icon name="video" size={20} />, meta: <span className="xmeta">{eventsFiltered({ region: 'online', type }).length}</span> },
  ];
  const regionLabel = regionOptions.find((o) => o.id === region);
  const regionLead = region === 'all' ? <Icon name="globe" size={16} /> : region === 'online' ? <Icon name="video" size={16} /> : <Flag cc={REGIONS[region].cc} size={16} />;
  const typeLabel = EVENT_TYPES.find((t) => t.id === type);

  const [first, ...rest] = list;
  const groups = groupByWeek(rest);
  const mine = Object.keys(app.going).length;

  return (
    <div className="screen stack-24 rise-in xevs">
      <div>
        <Top
          title="События"
          sub={<span className="xtele"><b>{list.length}</b> {plural(list.length, 'событие', 'события', 'событий')}<i />на месяц вперёд{mine > 0 && <><i /><span className="sea">вы идёте на {mine}</span></>}</span>}
        />
        <div className="filters">
          <Picker
            label="Регион"
            title="Регион"
            sub="Эфиры в Zoom — отдельной строкой"
            summary={<>{regionLead} {regionLabel.name}</>}
            options={regionOptions}
            value={region}
            onChange={setRegion}
          />
          <Picker
            label="Тип"
            title="Какие события"
            summary={<><Icon name={TYPE_ICON[type]} size={15} /> {typeLabel.name}</>}
            options={EVENT_TYPES.map((t) => ({ ...t, lead: <Icon name={TYPE_ICON[t.id]} size={19} /> }))}
            value={type}
            onChange={setType}
          />
        </div>
        <MonthStrip app={app} list={list} />
      </div>

      {!first ? (
        <Empty
          icon="calendar"
          title="Под фильтр ничего нет"
          text="Попробуйте другой регион или все типы событий."
          action={<Btn size="sm" variant="ghost" onClick={() => { setRegion('all'); setType('all'); }}>Сбросить фильтр</Btn>}
        />
      ) : (
        <div className="stack">
          <div className="weekline"><span className="weekline__t">Ближайшее</span><span className="weekline__r" /></div>
          <EventCard app={app} event={first} height={150} />
        </div>
      )}

      {groups.map((g) => (
        <div key={g.title} className="stack xweek">
          <div className="weekline">
            <span className="weekline__t">{g.title}</span>
            <span className="weekline__r" />
            <span className="weekline__n">{String(g.items.length).padStart(2, '0')}</span>
          </div>
          <List>{g.items.map((e) => <EventRow key={e.id} app={app} event={e} />)}</List>
        </div>
      ))}

      <button className="xlink" onClick={() => go('/base')}>
        <span className="xlink__ic"><Icon name="video" size={18} /></span>
        <span className="grow">
          <span className="xlink__t">Прошедшие эфиры — в Базе</span>
          <span className="xlink__s">Записи Zoom с таймкодами и главными мыслями</span>
        </span>
        <Icon name="right" size={16} className="chev" />
      </button>
    </div>
  );
}

/* Шкала четырёх недель с понедельника: деление — день, точка — события
   в этот день (под фильтр), зелёное кольцо — куда вы идёте. Нажатие на
   день с событием открывает первое из них. */
function MonthStrip({ app, list }) {
  const start = -((new Date().getDay() + 6) % 7); // понедельник этой недели
  const days = Array.from({ length: 28 }, (_, i) => start + i);
  const byDay = {};
  for (const e of list) (byDay[e.inDays] ||= []).push(e);
  return (
    <div className="xstrip" aria-label="События на четыре недели вперёд">
      <div className="xstrip__row">
        {days.map((d, i) => {
          const evs = byDay[d] || [];
          const going = evs.some((e) => app.going[e.id]);
          const past = d < 0;
          const date = dayShift(d);
          const El = evs.length ? 'button' : 'span';
          return (
            <El
              key={d}
              className={`xstrip__d${d === 0 ? ' is-today' : ''}${past ? ' is-past' : ''}${evs.length ? ' has-ev' : ''}${going ? ' is-going' : ''}${i % 7 === 0 ? ' is-mon' : ''}`}
              style={{ '--i': i }}
              onClick={evs.length ? () => go(`/event/${evs[0].id}`) : undefined}
              aria-label={evs.length ? `${dateLong(date)}: ${count(evs.length, 'событие', 'события', 'событий')}` : undefined}
            >
              <span className="xstrip__dots">
                {evs.slice(0, 3).map((e) => <i key={e.id} />)}
              </span>
              <span className="xstrip__tick" />
            </El>
          );
        })}
      </div>
      <div className="xstrip__legend">
        {[0, 7, 14, 21].map((k) => {
          const date = dayShift(start + k);
          return <span key={k}>{String(date.getDate()).padStart(2, '0')}.{String(date.getMonth() + 1).padStart(2, '0')}</span>;
        })}
      </div>
    </div>
  );
}

/* Недели — календарные: до воскресенья «на этой неделе», дальше следующая. */
function groupByWeek(list) {
  const out = [];
  const left = 7 - (new Date().getDay() || 7);
  const title = (d) => (d <= left ? 'На этой неделе' : d <= left + 7 ? 'На следующей неделе' : 'Позже');
  for (const e of list) {
    const t = title(e.inDays);
    let g = out.find((x) => x.title === t);
    if (!g) out.push((g = { title: t, items: [] }));
    g.items.push(e);
  }
  return out;
}
