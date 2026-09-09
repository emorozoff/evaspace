import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { canJoin, cityById, goingUsers, rsvpOf, friendsGoing } from '../lib/logic.js';
import { whenLabel, dayName, timeOf, inputValue, MINUTE, relative, plural } from '../lib/time.js';
import { EVENT_TYPES } from '../lib/events.js';
import Cover from '../components/Cover.jsx';
import { Avatar, Btn, Card, Empty, Field, List, Item, Note, Section, Sheet, Tag, TopBar } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';

const TONE_TAG = { online: 'blue', offline: 'accent', team: 'violet', summit: 'warm' };

export default function EventPage({ id, now }) {
  const { state, me, dispatch } = useStore();
  const event = state.events.find((e) => e.id === id);
  const [edit, setEdit] = useState(false);
  const [propose, setPropose] = useState(false);
  const [text, setText] = useState('');
  if (!event) return <div className="screen"><Empty title="Событие не найдено" /></div>;

  const city = event.cityId ? cityById(state, event.cityId) : null;
  const team = event.teamId ? state.teams.find((t) => t.id === event.teamId) : null;
  const going = goingUsers(state, event.id);
  const friends = friendsGoing(state, event.id, me.id);
  const mine = rsvpOf(state, event.id, me.id);
  const past = event.startsAt + event.duration * MINUTE < now;
  const isOrganizer = city?.organizerId === me.id;
  const canEdit = (isOrganizer || state.session.admin || (team && team.captainId === me.id)) && !past;

  return (
    <div className="screen" style={{ paddingTop: 0 }}>
      <TopBar title={event.title} sub={EVENT_TYPES[event.type].label} backTo="/events" right={canEdit ? <button className="iconbtn" onClick={() => setEdit(true)}><Icon name="edit" size={17} /></button> : null} />

      <div className="stack-20">
        <div className="ev">
          <Cover event={event}>
            <div className="ev__tags">
              <Tag tone={TONE_TAG[event.type]}>{EVENT_TYPES[event.type].label}</Tag>
              {event.minPackage === 'pro' && <Tag tone="violet">PRO</Tag>}
              {event.canceled && <Tag tone="red">отменено</Tag>}
            </div>
            <div className="ev__over"><h2 className="h2" style={{ color: '#fff' }}>{event.title}</h2></div>
          </Cover>
        </div>

        <List>
          <Item
            icon="calendar"
            title={event.flexible ? 'Время выбирает команда' : `${whenLabel(event.startsAt, now)} · ${event.duration} мин`}
            sub={event.flexible ? 'Договоритесь в чате команды' : `${dayName(event.startsAt)}, ${timeOf(event.startsAt)}`}
            chev={false}
          />
          {event.type === 'offline' ? (
            <Item icon="pin" title={event.place || 'Место ещё не выбрано'} sub={city ? `${city.name} · открыть город` : ''} onClick={city ? () => go(`/city/${city.id}`) : undefined} />
          ) : (
            <Item icon="video" title="Онлайн" sub={event.joinUrl ? 'Кнопка «Подключиться» появится за 15 минут до начала' : 'Ссылка появится ближе к началу'} chev={false} />
          )}
          {team && <Item icon="team" title={`Команда «${team.name}»`} sub={team.idea} onClick={() => go('/team')} />}
        </List>

        {event.description && <p className="lead">{event.description}</p>}

        {event.type === 'offline' && !city?.organizerId && !past && (
          <Note icon="pin" tone="var(--accent)">
            Организатора в городе нет — участники договариваются сами.{' '}
            <button className="accent" style={{ fontWeight: 700 }} onClick={() => setPropose(true)}>Предложить место</button>
          </Note>
        )}

        <Section title={`Идут · ${going.length}`}>
          {going.length === 0 ? (
            <Empty icon="people" title="Пока никто не отметился" text="Будьте первым — остальные обычно подтягиваются." />
          ) : (
            <Card>
              {friends.length > 0 && <div className="t-xs accent" style={{ marginBottom: 10 }}>{friends.length} {plural(friends.length, 'друг', 'друга', 'друзей')} среди идущих</div>}
              <div className="scroller">
                {going.map((u) => (
                  <button key={u.id} className="center" style={{ width: 60 }} onClick={() => go(`/person/${u.id}`)}>
                    <Avatar user={u} size={42} style={{ margin: '0 auto' }} ring={friends.includes(u) ? 'var(--accent)' : undefined} />
                    <div className="t-xs dim-2 ell" style={{ marginTop: 5 }}>{u.name.split(' ')[0]}</div>
                  </button>
                ))}
              </div>
            </Card>
          )}
        </Section>

        {past && event.recordUrl && (
          <a className="btn btn--ghost btn--wide" href={event.recordUrl} target="_blank" rel="noreferrer"><Icon name="play" size={15} /> Запись встречи</a>
        )}

        {!past && !event.canceled && (
          <div className="sticky-cta stack-8">
            {canJoin(event, now) ? (
              <a className="btn btn--accent btn--wide" href={event.joinUrl} target="_blank" rel="noreferrer">Подключиться</a>
            ) : (
              <Btn variant={mine === 'going' ? 'soft' : 'accent'} wide icon={mine === 'going' ? 'check' : undefined} onClick={() => dispatch({ type: 'rsvp', eventId: event.id, status: 'going' })}>
                {mine === 'going' ? 'Вы идёте · отменить' : 'Пойду'}
              </Btn>
            )}
            {mine !== 'going' && !canJoin(event, now) && (
              <button className="t-sm center" style={{ color: mine === 'not_going' ? 'var(--red)' : 'var(--ink-3)', fontWeight: 600, padding: 6 }} onClick={() => dispatch({ type: 'rsvp', eventId: event.id, status: 'not_going' })}>
                {mine === 'not_going' ? 'Вы отметили, что не сможете' : 'Не смогу'}
              </button>
            )}
            {event.joinUrl && !canJoin(event, now) && event.startsAt - now < 3 * 60 * MINUTE && (
              <div className="t-xs dim-2 center">Подключение откроется {relative(event.startsAt - 15 * MINUTE, now)}</div>
            )}
          </div>
        )}
      </div>

      <Sheet open={edit} onClose={() => setEdit(false)} title="Встреча" sub="Место, время и описание">
        <EditForm event={event} onDone={() => setEdit(false)} />
      </Sheet>

      <Sheet open={propose} onClose={() => setPropose(false)} title="Предложить место" sub="Уйдёт в чат города">
        <div className="stack">
          <textarea className="field" placeholder="Идём в боулинг на Ленина, сбор в 20:00" value={text} onChange={(e) => setText(e.target.value)} />
          <Btn variant="accent" wide disabled={text.trim().length < 5} onClick={() => { dispatch({ type: 'propose', cityId: event.cityId, text }); setPropose(false); setText(''); }}>Отправить</Btn>
        </div>
      </Sheet>
    </div>
  );
}

/** Организатор задаёт место и время или отменяет встречу на неделю. */
function EditForm({ event, onDone }) {
  const { dispatch } = useStore();
  const [place, setPlace] = useState(event.place);
  const [description, setDescription] = useState(event.description);
  const [at, setAt] = useState(inputValue(event.startsAt));
  return (
    <div className="stack">
      <Field label="Место"><input className="field" placeholder="Кофейня на Ленина, второй этаж" value={place} onChange={(e) => setPlace(e.target.value)} /></Field>
      <Field label="Описание"><textarea className="field" placeholder="Идём в боулинг, сбор в 20:00" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      <Field label="Дата и время"><input className="field" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} /></Field>
      <Btn variant="accent" wide onClick={() => { dispatch({ type: 'eventPatch', eventId: event.id, patch: { place, description, startsAt: new Date(at).getTime() || event.startsAt } }); onDone(); }}>Сохранить</Btn>
      <Btn variant={event.canceled ? 'ghost' : 'danger'} wide onClick={() => { dispatch({ type: 'eventPatch', eventId: event.id, patch: { canceled: !event.canceled }, toast: event.canceled ? 'Встреча снова в расписании' : 'Встреча отменена на эту неделю' }); onDone(); }}>
        {event.canceled ? 'Вернуть встречу' : 'Отменить на эту неделю'}
      </Btn>
    </div>
  );
}
