import { useStore } from '../lib/store.jsx';
import { canJoin, goingUsers, rsvpOf, friendsGoing, cityById } from '../lib/logic.js';
import { whenLabel, timeOf, relative, MINUTE } from '../lib/time.js';
import { people } from '../lib/format.js';
import { EVENT_TYPES } from '../lib/events.js';
import { AvatarStack, Btn, Card } from './UI.jsx';
import { IcPin, IcClock, IcPlay, IcNext } from './Icons.jsx';

/** Карточка события: тип, время, место, кто идёт и две кнопки. */
export default function EventCard({ event, now = Date.now(), onOpen, compact = false }) {
  const { state, me, dispatch } = useStore();
  const mine = rsvpOf(state, event.id, me.id);
  const going = goingUsers(state, event.id);
  const friends = friendsGoing(state, event.id, me.id);
  const city = event.cityId ? cityById(state, event.cityId) : null;
  const team = event.teamId ? state.teams.find((t) => t.id === event.teamId) : null;
  const past = event.startsAt + event.duration * MINUTE < now;
  const joinable = canJoin(event, now);

  const set = (status) => (e) => {
    e.stopPropagation();
    dispatch({ type: 'rsvp', eventId: event.id, status });
  };

  return (
    <Card tap={Boolean(onOpen)} onClick={onOpen} className={past ? 'muted' : ''}>
      <div className="row" style={{ marginBottom: 8 }}>
        <span className={`event-type ${event.type}`}>{EVENT_TYPES[event.type].short}</span>
        {event.minPackage === 'pro' && <span className="chip pro" style={{ padding: '2px 8px' }}>PRO</span>}
        <div className="spacer" />
        <span className="t-dim nowrap">{event.flexible ? 'как удобно команде' : whenLabel(event.startsAt, now)}</span>
      </div>

      <div className="t-title">{event.title}</div>
      {!compact && event.description && (
        <div className="t-sub" style={{ marginTop: 3 }}>
          {event.description}
        </div>
      )}

      <div className="stack s" style={{ marginTop: 8 }}>
        {event.type === 'offline' && (
          <div className="dotline">
            <IcPin />
            <span>{event.place || `${city?.name || ''} — место ещё не выбрано`}</span>
          </div>
        )}
        {event.flexible && (
          <div className="dotline">
            <IcClock />
            <span>Время команда выбирает сама</span>
          </div>
        )}
        {team && <div className="dotline">Команда «{team.name}»</div>}
      </div>

      {!past && (
        <div className="row" style={{ marginTop: 12 }}>
          <AvatarStack users={going} max={compact ? 4 : 8} />
          <div className="t-dim" style={{ lineHeight: 1.25 }}>
            {going.length ? `идут ${people(going.length)}` : 'пока никто не отметился'}
            {friends.length > 0 && <div className="t-lime">из них {friends.length} в друзьях</div>}
          </div>
        </div>
      )}

      {past ? (
        event.recordUrl ? (
          <a className="btn soft wide" style={{ marginTop: 12 }} href={event.recordUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
            <IcPlay size={16} /> Посмотреть запись
          </a>
        ) : (
          <div className="t-dim" style={{ marginTop: 10 }}>Событие прошло</div>
        )
      ) : joinable ? (
        <a className="btn primary wide" style={{ marginTop: 12 }} href={event.joinUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
          Подключиться <IcNext size={16} />
        </a>
      ) : (
        <div className="btn-row" style={{ marginTop: 12 }}>
          <Btn kind={mine === 'going' ? 'on' : 'soft'} small onClick={set('going')}>
            Иду
          </Btn>
          <Btn kind={mine === 'not_going' ? 'off' : 'soft'} small onClick={set('not_going')}>
            Не могу
          </Btn>
        </div>
      )}

      {!past && !joinable && event.joinUrl && event.startsAt - now < 3 * 60 * MINUTE && (
        <div className="t-dim center" style={{ marginTop: 8 }}>
          Кнопка «Подключиться» появится за 15 минут до начала — {relative(event.startsAt, now)}
        </div>
      )}
    </Card>
  );
}

export function EventLine({ event, onOpen }) {
  return (
    <div className="lead" onClick={onOpen} style={{ cursor: 'pointer' }}>
      <div className="place">{timeOf(event.startsAt)}</div>
      <div style={{ minWidth: 0 }}>
        <div className="ellipsis" style={{ fontWeight: 600 }}>{event.title}</div>
        <div className="t-dim">{EVENT_TYPES[event.type].label}</div>
      </div>
      <IcNext />
    </div>
  );
}
