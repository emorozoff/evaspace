import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { canJoin, goingUsers, rsvpOf, friendsGoing, cityById } from '../lib/logic.js';
import { whenLabel, MINUTE } from '../lib/time.js';
import { plural } from '../lib/time.js';
import { EVENT_TYPES } from '../lib/events.js';
import Cover, { CoverThumb } from './Cover.jsx';
import { AvatarStack, Btn, Tag, Item } from './UI.jsx';
import Icon from './Icons.jsx';

const TONE_TAG = { online: 'blue', offline: 'accent', team: 'violet', summit: 'warm' };

/**
 * Карточка события по механике Евы: обложка 16:10 с типом и названием,
 * под ней короткое описание, а внизу отдельной строкой — кто идёт и одна
 * кнопка записи. Аватарки никогда не ложатся на обложку.
 */
export default function EventCard({ event, now = Date.now() }) {
  const { state, me, dispatch } = useStore();
  const mine = rsvpOf(state, event.id, me.id);
  const going = goingUsers(state, event.id);
  const friends = friendsGoing(state, event.id, me.id);
  const city = event.cityId ? cityById(state, event.cityId) : null;
  const past = event.startsAt + event.duration * MINUTE < now;
  const joinable = canJoin(event, now);
  const open = () => go(`/event/${event.id}`);

  const where = event.type === 'online' || event.type === 'team' ? 'онлайн' : event.place || city?.name || '';
  const when = event.flexible ? 'время выбирает команда' : whenLabel(event.startsAt, now);

  return (
    <article className={`ev${past ? ' ev--past' : ''}`}>
      <button style={{ display: 'block', width: '100%' }} onClick={open}>
        <Cover event={event}>
          <div className="ev__tags">
            <Tag tone={TONE_TAG[event.type]}>{EVENT_TYPES[event.type].label}</Tag>
            {event.minPackage === 'pro' && <Tag tone="violet">PRO</Tag>}
          </div>
          {mine === 'going' && !past && <div className="ev__when"><Icon name="check" size={12} /><span>вы идёте</span></div>}
          <div className="ev__over">
            <div className="ev__title">{event.title}</div>
            <div className="ev__meta">{when} · {where}</div>
          </div>
        </Cover>
      </button>

      <div className="ev__body">
        {event.description && <div className="ev__desc clamp-2">{event.description}</div>}

        <div className="ev__foot">
          <div className="ev__who">
            <AvatarStack users={going} max={4} size={26} />
            <span className="ell">
              {going.length ? <><b>{going.length}</b> {plural(going.length, 'идёт', 'идут', 'идут')}</> : 'пока никто'}
              {friends.length > 0 && <span className="accent"> · {friends.length} из друзей</span>}
            </span>
          </div>

          {past ? (
            event.recordUrl ? (
              <a className="btn btn--ghost btn--sm" href={event.recordUrl} target="_blank" rel="noreferrer">
                <Icon name="play" size={13} /> Запись
              </a>
            ) : null
          ) : joinable ? (
            <a className="btn btn--accent btn--sm" href={event.joinUrl} target="_blank" rel="noreferrer">
              Подключиться
            </a>
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
    </article>
  );
}

/* Компактная строка — для длинных списков и прошедших событий. */
export function EventRow({ event, now = Date.now(), meta }) {
  const { state, me } = useStore();
  const mine = rsvpOf(state, event.id, me.id);
  const count = goingUsers(state, event.id).length;
  return (
    <Item
      lead={<CoverThumb event={event} />}
      title={event.title}
      sub={`${event.flexible ? 'время команды' : whenLabel(event.startsAt, now)} · ${count} ${plural(count, 'идёт', 'идут', 'идут')}`}
      meta={meta ?? (mine === 'going' ? <Tag tone="accent">иду</Tag> : <Tag tone={TONE_TAG[event.type]}>{EVENT_TYPES[event.type].short}</Tag>)}
      onClick={() => go(`/event/${event.id}`)}
    />
  );
}
