import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { canJoin, cityById, goingUsers, rsvpOf, friendsGoing } from '../lib/logic.js';
import { whenLabel, dayName, timeOf, inputValue, MINUTE, relative } from '../lib/time.js';
import { people } from '../lib/format.js';
import { EVENT_TYPES } from '../lib/events.js';
import { Avatar, Btn, Card, Empty, Input, Area, Sheet, TopBar } from '../components/UI.jsx';
import { IcPin, IcPlay, IcNext, IcEdit } from '../components/Icons.jsx';

export default function EventPage({ id, navigate, now }) {
  const { state, me, dispatch } = useStore();
  const event = state.events.find((e) => e.id === id);
  const [edit, setEdit] = useState(false);
  const [propose, setPropose] = useState(false);
  const [text, setText] = useState('');

  if (!event) return <Empty title="Событие не найдено" />;

  const city = event.cityId ? cityById(state, event.cityId) : null;
  const team = event.teamId ? state.teams.find((t) => t.id === event.teamId) : null;
  const going = goingUsers(state, event.id);
  const friends = friendsGoing(state, event.id, me.id);
  const mine = rsvpOf(state, event.id, me.id);
  const past = event.startsAt + event.duration * MINUTE < now;
  const isOrganizer = city?.organizerId === me.id;
  const canEdit = isOrganizer || state.session.admin || (team && team.captainId === me.id);

  return (
    <div className="screen">
      <TopBar title={event.title} sub={EVENT_TYPES[event.type].label} right={canEdit && !past ? <button className="iconbtn" onClick={() => setEdit(true)}><IcEdit /></button> : null} />

      <Card>
        <div className="row" style={{ marginBottom: 10 }}>
          <span className={`event-type ${event.type}`}>{EVENT_TYPES[event.type].short}</span>
          {event.minPackage === 'pro' && <span className="chip pro">только PRO</span>}
          {event.canceled && <span className="chip red">отменено</span>}
        </div>

        <div className="t-big">{event.flexible ? 'Время выбирает команда' : whenLabel(event.startsAt, now)}</div>
        {!event.flexible && (
          <div className="t-sub" style={{ marginTop: 2 }}>
            {dayName(event.startsAt)}, {timeOf(event.startsAt)} — {event.duration} минут
          </div>
        )}

        {event.description && <p className="t-sub" style={{ marginTop: 12 }}>{event.description}</p>}

        {event.type === 'offline' && (
          <div className="dotline" style={{ marginTop: 12 }}>
            <IcPin />
            <span>{event.place || `${city?.name} — место ещё не выбрано`}</span>
          </div>
        )}

        {city && (
          <div className="link t-lime" style={{ marginTop: 10, cursor: 'pointer' }} onClick={() => navigate(`/city/${city.id}`)}>
            Город {city.name} →
          </div>
        )}
        {team && (
          <div className="link t-lime" style={{ marginTop: 10, cursor: 'pointer' }} onClick={() => navigate(`/team/${team.id}`)}>
            Команда «{team.name}» →
          </div>
        )}
      </Card>

      {!past && !event.canceled && (
        <Card>
          <div className="btn-row">
            <Btn kind={mine === 'going' ? 'on' : 'soft'} onClick={() => dispatch({ type: 'rsvp', eventId: event.id, status: 'going' })}>
              Иду
            </Btn>
            <Btn kind={mine === 'not_going' ? 'off' : 'soft'} onClick={() => dispatch({ type: 'rsvp', eventId: event.id, status: 'not_going' })}>
              Не могу
            </Btn>
          </div>
          {canJoin(event, now) ? (
            <a className="btn primary wide" style={{ marginTop: 10 }} href={event.joinUrl} target="_blank" rel="noreferrer">
              Подключиться <IcNext size={16} />
            </a>
          ) : event.joinUrl ? (
            <div className="t-dim center" style={{ marginTop: 10 }}>
              Ссылка на подключение откроется за 15 минут до начала — {relative(event.startsAt, now)}
            </div>
          ) : null}
        </Card>
      )}

      {past && event.recordUrl && (
        <a className="btn soft wide" style={{ marginTop: 10 }} href={event.recordUrl} target="_blank" rel="noreferrer">
          <IcPlay size={16} /> Запись встречи
        </a>
      )}

      {event.type === 'offline' && !isOrganizer && !city?.organizerId && !past && (
        <Card style={{ marginTop: 10 }}>
          <div className="t-title">Место ещё не выбрано</div>
          <div className="t-sub">Организатора в городе нет — участники договариваются сами. Предложите место, оно уйдёт в чат города.</div>
          <Btn kind="ghost" wide small style={{ marginTop: 12 }} onClick={() => setPropose(true)}>
            Предложить место
          </Btn>
        </Card>
      )}

      <div className="section">
        <h2>Идут {going.length ? `· ${going.length}` : ''}</h2>
      </div>
      {going.length === 0 ? (
        <Empty title="Пока никто не отметился" text="Будьте первым — остальные обычно подтягиваются." />
      ) : (
        <Card>
          {friends.length > 0 && <div className="t-lime" style={{ marginBottom: 8 }}>Из них {people(friends.length)} у вас в друзьях</div>}
          {going.map((u) => (
            <div key={u.id} className="lead" onClick={() => navigate(`/person/${u.id}`)} style={{ cursor: 'pointer', gridTemplateColumns: 'auto 1fr auto' }}>
              <Avatar user={u} size={34} />
              <div style={{ minWidth: 0 }}>
                <div className="ellipsis" style={{ fontWeight: 600 }}>{u.name}</div>
                <div className="t-dim ellipsis">{u.about}</div>
              </div>
              <IcNext />
            </div>
          ))}
        </Card>
      )}

      {edit && <EditSheet event={event} onClose={() => setEdit(false)} />}
      {propose && (
        <Sheet title="Предложить место" onClose={() => setPropose(false)}>
          <div className="stack">
            <Area placeholder="Идём в боулинг на Ленина, сбор в 20:00" value={text} onChange={(e) => setText(e.target.value)} />
            <Btn
              kind="primary"
              wide
              disabled={text.trim().length < 5}
              onClick={() => {
                dispatch({ type: 'propose', cityId: event.cityId, text });
                setPropose(false);
                setText('');
              }}
            >
              Отправить
            </Btn>
          </div>
        </Sheet>
      )}
    </div>
  );
}

/** Организатор города задаёт место и время или отменяет встречу на конкретную неделю. */
function EditSheet({ event, onClose }) {
  const { dispatch } = useStore();
  const [place, setPlace] = useState(event.place);
  const [description, setDescription] = useState(event.description);
  const [at, setAt] = useState(inputValue(event.startsAt));

  return (
    <Sheet title="Встреча" sub="Место, время и описание" onClose={onClose}>
      <div className="stack">
        <Input label="Место" placeholder="Кофейня на Ленина, второй этаж" value={place} onChange={(e) => setPlace(e.target.value)} />
        <Area label="Описание" placeholder="Идём в боулинг, сбор в 20:00" value={description} onChange={(e) => setDescription(e.target.value)} />
        <Input label="Дата и время" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
        <Btn
          kind="primary"
          wide
          onClick={() => {
            dispatch({
              type: 'eventPatch',
              eventId: event.id,
              patch: { place, description, startsAt: new Date(at).getTime() || event.startsAt },
            });
            onClose();
          }}
        >
          Сохранить
        </Btn>
        <Btn
          kind={event.canceled ? 'soft' : 'danger'}
          wide
          onClick={() => {
            dispatch({
              type: 'eventPatch',
              eventId: event.id,
              patch: { canceled: !event.canceled },
              toast: event.canceled ? 'Встреча снова в расписании' : 'Встреча отменена на эту неделю',
            });
            onClose();
          }}
        >
          {event.canceled ? 'Вернуть встречу' : 'Отменить на эту неделю'}
        </Btn>
      </div>
    </Sheet>
  );
}
