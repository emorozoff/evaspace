import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { visibleEvents, summitEvent } from '../lib/logic.js';
import { startOfWeek, weekTitle, startOfDay, monthName, DAY, WEEK } from '../lib/time.js';
import { Top, Picker, Empty, List, Btn } from '../components/UI.jsx';
import EventCard, { EventRow } from '../components/EventCard.jsx';
import Icon from '../components/Icons.jsx';

const TYPES = [
  { id: 'offline', label: 'Встречи в городе' },
  { id: 'online', label: 'Эфиры клуба' },
  { id: 'team', label: 'Созвоны команды' },
];

/* Расписание на две недели вперёд: ближайшее крупно, остальное строками.
   Всё, что прошло, уезжает в архив. */

export default function Events({ now }) {
  const { state, me } = useStore();
  const [type, setType] = useState('all');
  const summit = summitEvent(state);

  const list = useMemo(
    () => visibleEvents(state, me, { from: startOfDay(now), to: startOfWeek(now) + 2 * WEEK + 7 * DAY })
      .filter((e) => e.type !== 'summit')
      .filter((e) => type === 'all' || e.type === type),
    [state, me, type, now]
  );

  const weeks = useMemo(() => {
    const map = new Map();
    for (const e of list) {
      const key = startOfWeek(e.startsAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    }
    return [...map.entries()].slice(0, 3);
  }, [list]);

  const [first] = list;

  return (
    <div className="screen stack-20">
      <Top
        title="События"
        sub="Две недели вперёд"
        right={<button className="iconbtn" onClick={() => go('/archive')} aria-label="Архив"><Icon name="clock" size={18} /></button>}
      />

      <div className="filters">
        <Picker label="Все события" title="Что показать" options={TYPES} value={type} onChange={setType} allLabel="Все события" />
      </div>

      {weeks.length === 0 && (
        <Empty
          icon="calendar"
          title="Здесь пусто"
          text={type === 'team' ? 'Созвоны появятся, когда куратор определит вас в команду.' : type === 'offline' ? 'Встречи заводятся, когда в городе набирается двое.' : 'В ближайшие две недели событий нет.'}
        />
      )}

      {weeks.map(([weekStart, events], wi) => {
        // В первой неделе ближайшее событие показываем крупно, остальное — строками
        const big = wi === 0 && first && events[0]?.id === first.id ? events[0] : null;
        const rest = big ? events.slice(1) : events;
        return (
          <section key={weekStart} className="stack">
            <div className="week-hdr">
              <span className="week-hdr__t">{weekTitle(weekStart, now)}</span>
              <span className="week-hdr__r" />
              <span className="week-hdr__n">{events.length}</span>
            </div>
            {big && <EventCard event={big} now={now} />}
            {rest.length > 0 && <List>{rest.map((e) => <EventRow key={e.id} event={e} now={now} />)}</List>}
          </section>
        );
      })}

      {/* Выпускной стоит в конце сезона — месяц известен, дата ещё нет */}
      {summit && (
        <section className="stack">
          <div className="week-hdr">
            <span className="week-hdr__t">Финал сезона</span>
            <span className="week-hdr__r" />
          </div>
          <button className="card tap row" onClick={() => go('/summit')}>
            <div className="item__ic" style={{ background: 'var(--warm-soft)', color: 'var(--warm)' }}><Icon name="cup" size={20} /></div>
            <div className="grow">
              <div className="t-md">Большой слёт и выпускной</div>
              <div className="t-xs dim-2" style={{ marginTop: 2 }}>
                {monthName(state.season.graduationAt)} · дату объявим ближе к финалу
              </div>
            </div>
            <Icon name="right" size={16} className="chev" />
          </button>
        </section>
      )}

      <Btn variant="ghost" wide icon="clock" onClick={() => go('/archive')}>Архив и записи</Btn>
    </div>
  );
}
