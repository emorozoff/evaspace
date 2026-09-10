import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { canJoin, goingUsers, rsvpOf } from '../lib/logic.js';
import { whenLabel, plural, MINUTE } from '../lib/time.js';
import { EVENT_TYPES } from '../lib/events.js';
import Cover from './Cover.jsx';
import { Btn, Tag } from './UI.jsx';
import Icon from './Icons.jsx';

const TONE_TAG = { online: 'blue', offline: 'accent', team: 'violet', summit: 'warm' };

/**
 * Короткая плашка события для главной: обложка слева, суть справа,
 * запись одной кнопкой. Занимает вчетверо меньше места, чем большая карточка.
 */
export default function EventCompact({ event, now = Date.now() }) {
  const { state, me, dispatch } = useStore();
  const mine = rsvpOf(state, event.id, me.id);
  const count = goingUsers(state, event.id).length;
  const joinable = canJoin(event, now);
  const past = event.startsAt + event.duration * MINUTE < now;

  return (
    <div className="card" style={{ padding: 10 }}>
      <div className="row-t" style={{ gap: 12 }}>
        <button style={{ width: 96, flex: 'none', borderRadius: 12, overflow: 'hidden' }} onClick={() => go(`/event/${event.id}`)}>
          <Cover event={event} />
        </button>
        <div className="grow" style={{ paddingTop: 2 }}>
          <button style={{ display: 'block', width: '100%' }} onClick={() => go(`/event/${event.id}`)}>
            <div className="row" style={{ gap: 6 }}>
              <Tag tone={TONE_TAG[event.type]}>{EVENT_TYPES[event.type].label}</Tag>
              {event.minPackage === 'pro' && <Tag tone="violet">PRO</Tag>}
            </div>
            <div className="t-md" style={{ marginTop: 6, lineHeight: 1.25 }}>{event.title}</div>
            <div className="t-xs dim-2" style={{ marginTop: 3 }}>
              {event.flexible ? 'время выбирает команда' : whenLabel(event.startsAt, now)} · {count} {plural(count, 'идёт', 'идут', 'идут')}
            </div>
          </button>

          {!past && (
            joinable ? (
              <a className="btn btn--accent btn--sm" style={{ marginTop: 10 }} href={event.joinUrl} target="_blank" rel="noreferrer">Подключиться</a>
            ) : (
              <Btn
                variant={mine === 'going' ? 'soft' : 'accent'}
                size="sm"
                style={{ marginTop: 10 }}
                icon={mine === 'going' ? 'check' : undefined}
                onClick={() => dispatch({ type: 'rsvp', eventId: event.id, status: 'going' })}
              >
                {mine === 'going' ? 'Иду' : 'Пойду'}
              </Btn>
            )
          )}
          {past && event.recordUrl && (
            <a className="btn btn--ghost btn--sm" style={{ marginTop: 10 }} href={event.recordUrl} target="_blank" rel="noreferrer">
              <Icon name="play" size={13} /> Запись
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
