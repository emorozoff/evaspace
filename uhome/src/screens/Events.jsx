import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { eventsFiltered } from '../lib/select.js';
import { EVENT_TYPES } from '../data/events.js';
import { REGIONS } from '../data/regions.js';
import { plural } from '../lib/format.js';
import { Top, Picker, List, Item, Empty, Btn } from '../components/UI.jsx';
import { EventCard, EventRow } from '../components/EventCards.jsx';
import Flag from '../components/Flag.jsx';
import Icon from '../components/Icons.jsx';

/* Афиша: два фильтра в одну строку — регион и тип. Ближайшее событие —
   карточкой, дальше строки по неделям. */

const REGION_FILTER = ['moscow', 'bali', 'dubai', 'miami', 'europe'];

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
      meta: eventsFiltered({ region: k, type }).length,
    })),
    { id: 'online', name: 'Онлайн, Zoom', lead: <Icon name="video" size={20} />, meta: eventsFiltered({ region: 'online', type }).length },
  ];
  const regionLabel = regionOptions.find((o) => o.id === region);
  const regionLead = region === 'all' ? <Icon name="globe" size={16} /> : region === 'online' ? <Icon name="video" size={16} /> : <Flag cc={REGIONS[region].cc} size={16} />;
  const typeLabel = EVENT_TYPES.find((t) => t.id === type);

  const [first, ...rest] = list;
  const groups = groupByWeek(rest);
  const mine = Object.keys(app.going).length;

  return (
    <div className="screen stack-24 rise-in">
      <div>
        <Top
          title="События"
          mark={String(list.length).padStart(2, '0')}
          sub={`${list.length} ${plural(list.length, 'событие', 'события', 'событий')} на месяц вперёд${mine ? ` · вы идёте на ${mine}` : ''}`}
        />
        <div className="filters">
          <Picker label="Регион" title="Регион" sub="Эфиры в Zoom — отдельной строкой" summary={<>{regionLead} {regionLabel.name}</>} options={regionOptions} value={region} onChange={setRegion} />
          <Picker label="Тип" title="Какие события" summary={typeLabel.name} options={EVENT_TYPES} value={type} onChange={setType} />
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
        <section className="sect">
          <div className="sect__eye">Ближайшее</div>
          <EventCard app={app} event={first} height={140} />
        </section>
      )}

      {groups.map((g) => (
        <section key={g.title} className="sect">
          <div className="spread"><span className="sect__eye" style={{ margin: 0 }}>{g.title}</span><span className="sect__eye" style={{ margin: 0, color: 'var(--ink-3)' }}>{String(g.items.length).padStart(2, '0')}</span></div>
          <List>{g.items.map((e) => <EventRow key={e.id} app={app} event={e} />)}</List>
        </section>
      ))}

      <List>
        <Item icon="video" title="Прошедшие эфиры — в Базе" sub="Записи с таймкодами и главными мыслями" onClick={() => go('/base')} />
      </List>
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
