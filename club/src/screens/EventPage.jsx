import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { canJoin, chatKey, cityById, goingUsers, notGoingUsers, rsvpOf, friendsGoing, eventMeta, eventTally } from '../lib/logic.js';
import { whenLabel, inputValue, MINUTE, relative, plural } from '../lib/time.js';
import { EVENT_TYPES } from '../lib/events.js';
import { money } from '../lib/format.js';
import Cover from '../components/Cover.jsx';
import { Avatar, Btn, Card, Empty, Field, List, Item, Note, Section, Sheet, Stat, Tag, TopBar } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';
import VideoModal from '../components/VideoModal.jsx';

const TONE_TAG = { online: 'blue', offline: 'accent', team: 'violet', summit: 'warm' };

export default function EventPage({ id, now }) {
  const { state, me, dispatch } = useStore();
  const event = state.events.find((e) => e.id === id);
  const [edit, setEdit] = useState(false);
  const [propose, setPropose] = useState(false);
  const [text, setText] = useState('');
  const [play, setPlay] = useState(false);
  if (!event) return <div className="screen"><Empty title="Событие не найдено" /></div>;

  const city = event.cityId ? cityById(state, event.cityId) : null;
  const team = event.teamId ? state.teams.find((t) => t.id === event.teamId) : null;
  const going = goingUsers(state, event.id);
  const friends = friendsGoing(state, event.id, me.id);
  const mine = rsvpOf(state, event.id, me.id);
  const past = event.startsAt + event.duration * MINUTE < now;
  const meta = eventMeta(event);
  const tally = eventTally(state, event);
  const declined = notGoingUsers(state, event.id);
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

        {/* Тема встречи — первое, что человек хочет понять */}
        {event.topic && (
          <div>
            <div className="hdr">Тема</div>
            <p className="lead" style={{ marginTop: 6 }}>{event.topic}</p>
          </div>
        )}

        <List>
          <Item
            icon="calendar"
            title={event.flexible ? 'Время выбирает команда' : `${whenLabel(event.startsAt, now)} · ${event.duration} мин`}
            sub={event.flexible ? 'Договоритесь в чате команды' : past ? 'Уже прошло' : relative(event.startsAt, now)}
            chev={false}
          />
          {meta.offline ? (
            <Item
              icon="pin"
              title={<span style={{ whiteSpace: 'normal', lineHeight: 1.3 }}>{event.place || 'Адрес ещё не выбран'}</span>}
              sub={city ? `${city.name} · открыть город` : 'Офлайн'}
              onClick={city ? () => go(`/city/${city.id}`) : undefined}
            />
          ) : (
            <Item icon="video" title="Онлайн" sub={event.joinUrl ? 'Кнопка «Подключиться» появится за 15 минут до начала' : 'Ссылка появится ближе к началу'} chev={false} />
          )}
          <Item
            icon="people"
            title={`Для кого · ${meta.audience}`}
            sub={event.type === 'team' ? 'Только участники вашей команды' : event.minPackage === 'pro' ? 'Входит в пакет PRO' : 'Открыто всем резидентам клуба'}
            chev={false}
          />
          <Item
            icon="money"
            title={meta.paid ? `Участие ${money(event.price)}` : 'Участие бесплатно'}
            sub={meta.paid ? 'Оплата отдельно, вне приложения' : 'Входит в подписку клуба'}
            chev={false}
          />
          {team && <Item icon="message" title="Чат команды" sub="Согласовать время и место" onClick={() => go(`/chat/${encodeURIComponent(chatKey('team', [team.id]))}`)} />}
          {event.type === 'offline' && city && <Item icon="message" title="Чат города" sub="Договориться, кто где" onClick={() => go(`/chat/${encodeURIComponent(chatKey('city', [city.id]))}`)} />}
        </List>

        {event.description && <p className="lead">{event.description}</p>}

        {/* Что разберём — чтобы человек шёл за конкретикой, а не «послушать» */}
        {event.agenda?.length > 0 && (
          <Section title="Что разберём">
            <Card>
              <ol className="agenda">
                {event.agenda.map((line, i) => (
                  <li key={line}><span className="agenda__n">{i + 1}</span><span>{line}</span></li>
                ))}
              </ol>
            </Card>
          </Section>
        )}

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

        {/* Отказавшихся видит только куратор: участникам это знать незачем */}
        {state.session.admin && (
          <Section title="Свод для куратора" sub="Видно только в админском входе">
            <Card>
              <div className="stats">
                <Stat v={tally.going} l="идут" tone="var(--accent)" />
                <Stat v={tally.no} l="отказались" tone="var(--red)" />
                <Stat v={tally.silent} l="молчат" />
              </div>
              {declined.length > 0 && (
                <>
                  <div className="hdr" style={{ marginTop: 14, padding: 0 }}>Не придут</div>
                  <div className="scroller" style={{ marginTop: 8 }}>
                    {declined.map((u) => (
                      <button key={u.id} className="center" style={{ width: 60 }} onClick={() => go(`/person/${u.id}`)}>
                        <Avatar user={u} size={38} style={{ margin: '0 auto', opacity: 0.6 }} />
                        <div className="t-xs dim-2 ell" style={{ marginTop: 5 }}>{u.name.split(' ')[0]}</div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </Card>
          </Section>
        )}

        {past && event.recordUrl && (
          <Btn variant="ghost" wide icon="play" onClick={() => setPlay(true)}>Смотреть запись</Btn>
        )}

        {!past && !event.canceled && (
          <div className="sticky-cta stack-8">
            {canJoin(event, now) ? (
              <a className="btn btn--accent btn--wide" href={event.joinUrl} target="_blank" rel="noreferrer">Подключиться</a>
            ) : meta.offline ? (
              /* У офлайна выбор делают здесь, увидев адрес и стоимость */
              <div className="pair">
                <Btn variant={mine === 'going' ? 'soft' : 'accent'} icon={mine === 'going' ? 'check' : undefined} onClick={() => dispatch({ type: 'rsvp', eventId: event.id, status: 'going' })}>
                  {mine === 'going' ? 'Иду' : 'Иду'}
                </Btn>
                <Btn variant={mine === 'not_going' ? 'danger' : 'quiet'} icon={mine === 'not_going' ? 'x' : undefined} onClick={() => dispatch({ type: 'rsvp', eventId: event.id, status: 'not_going' })}>
                  Не иду
                </Btn>
              </div>
            ) : (
              <Btn variant={mine === 'going' ? 'soft' : 'accent'} wide icon={mine === 'going' ? 'check' : undefined} onClick={() => dispatch({ type: 'rsvp', eventId: event.id, status: 'going' })}>
                {mine === 'going' ? 'Вы идёте · отменить' : 'Пойду'}
              </Btn>
            )}
            {mine !== 'going' && !canJoin(event, now) && !meta.offline && (
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

      {play && <VideoModal url={event.recordUrl} title={event.title} onClose={() => setPlay(false)} />}

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
  const [topic, setTopic] = useState(event.topic || '');
  const [price, setPrice] = useState(String(event.price || ''));
  const [description, setDescription] = useState(event.description);
  const [at, setAt] = useState(inputValue(event.startsAt));
  return (
    <div className="stack">
      <Field label="Тема встречи"><input className="field" placeholder="Что разбираем" value={topic} onChange={(e) => setTopic(e.target.value)} /></Field>
      <Field label="Адрес"><input className="field" placeholder="Кофейня на Ленина, второй этаж" value={place} onChange={(e) => setPlace(e.target.value)} /></Field>
      <Field label="Стоимость участия" hint="Пусто или 0 — бесплатно"><input className="field" inputMode="numeric" placeholder="0" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} /></Field>
      <Field label="Описание"><textarea className="field" placeholder="Идём в боулинг, сбор в 20:00" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      <Field label="Дата и время"><input className="field" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} /></Field>
      <Btn variant="accent" wide onClick={() => { dispatch({ type: 'eventPatch', eventId: event.id, patch: { place, topic, description, price: Number(price) || 0, startsAt: new Date(at).getTime() || event.startsAt } }); onDone(); }}>Сохранить</Btn>
      <Btn variant={event.canceled ? 'ghost' : 'danger'} wide onClick={() => { dispatch({ type: 'eventPatch', eventId: event.id, patch: { canceled: !event.canceled }, toast: event.canceled ? 'Встреча снова в расписании' : 'Встреча отменена на эту неделю' }); onDone(); }}>
        {event.canceled ? 'Вернуть встречу' : 'Отменить на эту неделю'}
      </Btn>
    </div>
  );
}
