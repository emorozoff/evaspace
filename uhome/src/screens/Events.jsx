import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { eventsFiltered } from '../lib/select.js';
import { EVENT_TYPES } from '../data/events.js';
import { REGIONS } from '../data/regions.js';
import { count } from '../lib/format.js';
import { Top, Picker, List, Empty, Btn } from '../components/UI.jsx';
import { EventCard, EventRow } from '../components/EventCards.jsx';

/* Афиша: лёгкий фильтр в одну строку — регион списком и тип:
   все, закрытые, партнёров. Ближайшее — большой карточкой, дальше
   строки по неделям с датой плиткой, как в календаре. */

const REGION_FILTER = ['moscow', 'bali', 'dubai', 'miami', 'europe'];

export default function Events({ query }) {
  const app = useApp();
  const [region, setRegion] = useState(query.region || 'all');
  const [type, setType] = useState(query.type || 'all');
  const list = useMemo(() => eventsFiltered({ region, type }), [region, type]);

  const regionOptions = [
    { id: 'all', name: 'Все регионы', lead: '🌍' },
    ...REGION_FILTER.map((k) => ({
      id: k, name: REGIONS[k].name, lead: REGIONS[k].flag,
      sub: k === app.me.region ? 'вы здесь' : undefined,
      meta: <span className="t-xs dim-2">{eventsFiltered({ region: k, type }).length}</span>,
    })),
    { id: 'online', name: 'Онлайн, Zoom', lead: '💻', meta: <span className="t-xs dim-2">{eventsFiltered({ region: 'online', type }).length}</span> },
  ];
  const regionLabel = regionOptions.find((o) => o.id === region);
  const typeLabel = EVENT_TYPES.find((t) => t.id === type);

  const [first, ...rest] = list;
  const groups = groupByWeek(rest);
  const mine = Object.keys(app.going).length;

  return (
    <div className="screen stack-24 rise-in">
      <div>
        <Top
          title="События"
          sub={`${count(list.length, 'событие', 'события', 'событий')} на месяц вперёд${mine ? ` · вы идёте на ${mine}` : ''}`}
        />
        <div className="filters">
          <Picker
            label="Регион"
            title="Регион"
            sub="Эфиры в Zoom — отдельной строкой"
            summary={`${regionLabel.lead} ${regionLabel.name}`}
            options={regionOptions}
            value={region}
            onChange={setRegion}
          />
          <Picker
            label="Тип"
            title="Какие события"
            summary={typeLabel.name}
            options={EVENT_TYPES.map((t) => ({ ...t, lead: t.id === 'all' ? '✦' : t.id === 'closed' ? '🔒' : '🤝' }))}
            value={type}
            onChange={setType}
          />
        </div>
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
          <div className="hdr">Ближайшее</div>
          <EventCard app={app} event={first} height={168} />
        </div>
      )}

      {groups.map((g) => (
        <div key={g.title} className="stack">
          <div className="weekline">
            <span className="weekline__t">{g.title}</span>
            <span className="weekline__r" />
            <span className="weekline__n">{g.items.length}</span>
          </div>
          <List>{g.items.map((e) => <EventRow key={e.id} app={app} event={e} />)}</List>
        </div>
      ))}

      <button className="card tap row" style={{ display: 'flex', gap: 12 }} onClick={() => go('/base')}>
        <div className="item__ic"><span style={{ fontSize: 19 }}>🎥</span></div>
        <div className="grow">
          <div className="t-md">Прошедшие эфиры — в Базе</div>
          <div className="t-xs dim-2" style={{ marginTop: 2 }}>Записи Zoom с таймкодами и главными мыслями</div>
        </div>
      </button>
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
