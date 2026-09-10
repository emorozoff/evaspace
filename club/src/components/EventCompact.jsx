import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { canJoin, goingUsers, rsvpOf } from '../lib/logic.js';
import { whenLabel, plural, MINUTE } from '../lib/time.js';
import { EVENT_TYPES } from '../lib/events.js';
import Cover from './Cover.jsx';
import { Btn, Tag } from './UI.jsx';

const TONE_TAG = { online: 'blue', offline: 'accent', team: 'violet', summit: 'warm' };

/**
 * Короткая плашка события: обложка, суть и одна кнопка справа.
 * Занимает вчетверо меньше места, чем большая карточка.
 */
export default function EventCompact({ event, now = Date.now(), onPlay }) {
  const { state, me, dispatch } = useStore();
  const mine = rsvpOf(state, event.id, me.id);
  const count = goingUsers(state, event.id).length;
  const joinable = canJoin(event, now);
  const past = event.startsAt + event.duration * MINUTE < now;

  return (
    <div className="card row" style={{ padding: 10, gap: 12 }}>
      <button style={{ width: 68, height: 68, flex: 'none', borderRadius: 14, overflow: 'hidden' }} onClick={() => go(`/event/${event.id}`)}>
        <Cover event={event} className="ev__cover--square" />
      </button>

      <button className="grow" style={{ minWidth: 0 }} onClick={() => go(`/event/${event.id}`)}>
        <div className="row" style={{ gap: 6 }}>
          <Tag tone={TONE_TAG[event.type]}>{EVENT_TYPES[event.type].label}</Tag>
          {event.minPackage === 'pro' && <Tag tone="violet">PRO</Tag>}
        </div>
        <div className="t-md ell" style={{ marginTop: 5 }}>{event.title}</div>
        <div className="t-xs dim-2 ell" style={{ marginTop: 2 }}>
          {event.flexible ? 'время согласуете в чате' : whenLabel(event.startsAt, now)} · {count} {plural(count, 'идёт', 'идут', 'идут')}
        </div>
      </button>

      <div style={{ flex: 'none' }}>
        {past ? (
          event.recordUrl && onPlay ? <Btn variant="ghost" size="sm" icon="play" onClick={() => onPlay(event)}>Запись</Btn> : null
        ) : joinable ? (
          <a className="btn btn--accent btn--sm" href={event.joinUrl} target="_blank" rel="noreferrer">Подключиться</a>
        ) : (
          <Btn
            variant={mine === 'going' ? 'soft' : 'accent'}
            size="sm"
            icon={mine === 'going' ? 'check' : undefined}
            onClick={() => dispatch({ type: 'rsvp', eventId: event.id, status: 'going' })}
          >
            {mine === 'going' ? 'Иду' : 'Пойду'}
          </Btn>
        )}
      </div>
    </div>
  );
}
