import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { visibleEvents } from '../lib/logic.js';
import { startOfWeek, weekTitle, startOfDay, DAY } from '../lib/time.js';
import { Top, Seg, Picker, Empty, List, Note } from '../components/UI.jsx';
import EventCard, { EventRow } from '../components/EventCard.jsx';

const TYPES = [
  { id: 'offline', label: 'Встречи в городе' },
  { id: 'online', label: 'Эфиры' },
  { id: 'team', label: 'Созвоны команды' },
  { id: 'summit', label: 'Слёт' },
];

export default function Events({ now }) {
  const { state, me } = useStore();
  const [when, setWhen] = useState('next');
  const [type, setType] = useState('all');

  const list = useMemo(() => {
    const range = when === 'next'
      ? { from: startOfDay(now), to: startOfDay(now) + 35 * DAY }
      : { from: state.season.startsAt, to: now };
    const events = visibleEvents(state, me, range).filter((e) => type === 'all' || e.type === type);
    return when === 'next' ? events : events.reverse();
  }, [state, me, when, type, now]);

  const weeks = useMemo(() => {
    const map = new Map();
    for (const e of list) {
      const key = startOfWeek(e.startsAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    }
    return [...map.entries()];
  }, [list]);

  return (
    <div className="screen stack-20">
      <Top title="События" sub="Эфиры, пятницы в городе и созвоны команды" />

      <div className="stack-8">
        <Seg value={when} onChange={setWhen} options={[{ value: 'next', label: 'Ближайшие' }, { value: 'past', label: 'Прошедшие' }]} />
        <div className="filters">
          <Picker label="Все события" title="Что показать" options={TYPES} value={type} onChange={setType} allLabel="Все события" />
        </div>
      </div>

      {weeks.length === 0 && (
        <Empty
          icon="calendar"
          title="Здесь пусто"
          text={type === 'team' ? 'Созвоны появятся, когда куратор определит вас в команду.' : type === 'offline' ? 'Встречи заводятся, когда в городе набирается двое.' : 'Событий в этом фильтре нет.'}
        />
      )}

      {weeks.map(([weekStart, events]) => (
        <section key={weekStart} className="stack">
          <div className="week-hdr">
            <span className="week-hdr__t">{weekTitle(weekStart, now)}</span>
            <span className="week-hdr__r" />
            <span className="week-hdr__n">
              {events.filter((e) => e.type === 'online').length} клубных · {events.length} всего
            </span>
          </div>
          {when === 'next' ? (
            <>
              {/* Клубные события и пятница — карточками, созвон команды — строкой:
                  у него нет времени, это скорее напоминание, чем анонс. */}
              {events.filter((e) => e.type !== 'team').map((e) => <EventCard key={e.id} event={e} now={now} />)}
              {events.some((e) => e.type === 'team') && (
                <List>{events.filter((e) => e.type === 'team').map((e) => <EventRow key={e.id} event={e} now={now} />)}</List>
              )}
            </>
          ) : (
            <List>{events.map((e) => <EventRow key={e.id} event={e} now={now} meta={e.recordUrl ? <span className="accent">запись</span> : undefined} />)}</List>
          )}
        </section>
      ))}

      {when === 'next' && weeks.length > 0 && (
        <Note icon="calendar">«Пойду» ничего не бронирует: организатор видит масштаб, а вы получаете напоминание.</Note>
      )}
    </div>
  );
}
