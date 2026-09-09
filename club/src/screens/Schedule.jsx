import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { visibleEvents } from '../lib/logic.js';
import { startOfWeek, weekTitle, DAY, startOfDay } from '../lib/time.js';
import { Card, Empty, Segmented } from '../components/UI.jsx';
import { IcSpark } from '../components/Icons.jsx';
import EventCard from '../components/EventCard.jsx';

const FILTERS = [
  { id: 'all', label: 'Все' },
  { id: 'offline', label: 'Мой город' },
  { id: 'online', label: 'Онлайн' },
  { id: 'team', label: 'Команда' },
];

export default function Schedule({ navigate, now }) {
  const { state, me } = useStore();
  const [filter, setFilter] = useState('all');
  const [when, setWhen] = useState('next');

  const list = useMemo(() => {
    const range = when === 'next'
      ? { from: startOfDay(now), to: startOfDay(now) + 35 * DAY }
      : { from: state.season.startsAt, to: now };
    const events = visibleEvents(state, me, range).filter((e) => (filter === 'all' ? true : e.type === filter));
    return when === 'next' ? events : events.reverse();
  }, [state, me, filter, when, now]);

  const weeks = useMemo(() => {
    const map = new Map();
    for (const event of list) {
      const key = startOfWeek(event.startsAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(event);
    }
    return [...map.entries()];
  }, [list]);

  return (
    <div className="screen">
      <div className="topbar">
        <div className="logo">
          <div className="mark"><IcSpark size={16} className="t-lime" /></div>
          <h1>Расписание</h1>
        </div>
      </div>

      <div className="stack">
        <Segmented
          value={when}
          onChange={setWhen}
          options={[
            { value: 'next', label: 'Ближайшие' },
            { value: 'past', label: 'Прошедшие' },
          ]}
        />
        <div className="chips">
          {FILTERS.map((f) => (
            <span key={f.id} className={`chip ${filter === f.id ? 'on' : ''}`} onClick={() => setFilter(f.id)}>
              {f.label}
            </span>
          ))}
        </div>
      </div>

      {weeks.length === 0 && (
        <Empty
          title="Здесь пусто"
          text={
            filter === 'team'
              ? 'Командные созвоны появятся, когда вы будете в команде.'
              : filter === 'offline'
              ? 'Оффлайн-встречи заводятся, когда в городе набирается двое участников.'
              : 'Событий в этом фильтре нет.'
          }
        />
      )}

      {weeks.map(([weekStart, events]) => (
        <div key={weekStart}>
          <div className="week-title">{weekTitle(weekStart, now)}</div>
          <div className="stack">
            {events.map((event) => (
              <EventCard key={event.id} event={event} now={now} onOpen={() => navigate(`/event/${event.id}`)} />
            ))}
          </div>
        </div>
      ))}

      {when === 'next' && weeks.length > 0 && (
        <Card className="card flat" style={{ marginTop: 14 }}>
          <div className="t-dim center">
            Расписание всегда заполнено на месяц вперёд. Кнопка «Иду» ничего не бронирует — она нужна, чтобы организатор
            понимал масштаб, а вы получили напоминание.
          </div>
        </Card>
      )}
    </div>
  );
}
