import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import {
  nextEvent, visibleEvents, teamOf, teamStats, teamPlace, seasonProgress, cityStats, nextFridayEvent,
  coffeeFor, userById, materialsFor, isPro, summitVisible, summitEvent, unreadCount, seasonPot, applicationOf,
} from '../lib/logic.js';
import { weekKey, plural, whenLabel, dateShort, DAY } from '../lib/time.js';
import { money, moneyShort } from '../lib/format.js';
import { Avatar, Actions, Bar, Card, List, Item, Section, Tag } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';
import EventCard, { EventRow } from '../components/EventCard.jsx';
import { MaterialThumb } from './Base.jsx';

export default function Home({ now }) {
  const { state, me, dispatch } = useStore();
  const season = seasonProgress(state, now);
  const event = nextEvent(state, me, now);
  const upcoming = visibleEvents(state, me, { from: now, to: now + 7 * DAY }).filter((e) => e.id !== event?.id).slice(0, 3);
  const team = teamOf(state, me.id);
  const application = applicationOf(state, me.id);
  const city = cityStats(state, me.cityId);
  const friday = nextFridayEvent(state, me.cityId, now);
  const pair = coffeeFor(state, me.id, weekKey(now));
  const buddy = pair ? userById(state, pair.a === me.id ? pair.b : pair.a) : null;
  const materials = materialsFor(state, me).slice(0, 3);
  const unread = unreadCount(state, me.id);
  const summit = summitVisible(state, now) ? summitEvent(state) : null;
  const offer = city.city?.organizerOfferTo === me.id && !city.city?.organizerId;

  return (
    <div className="screen stack-20">
      <div className="top">
        <div className="grow">
          <div className="eyebrow">{state.season.title} · месяц {season.monthIndex} из 3</div>
          <h1 className="h1" style={{ marginTop: 4 }}>{greet()}, {me.name.split(' ')[0]}</h1>
        </div>
        <button className="iconbtn" onClick={() => go('/notes')} aria-label="Уведомления">
          <Icon name="bell" size={19} />
          {unread > 0 && <span className="badge-n">{unread}</span>}
        </button>
        <button onClick={() => go('/profile')} aria-label="Профиль"><Avatar user={me} size={38} /></button>
      </div>

      {/* Ближайшее событие — одна большая карточка */}
      {event ? (
        <Section title="Ближайшее" more="Все события" onMore={() => go('/events')}>
          <EventCard event={event} now={now} />
        </Section>
      ) : (
        <Card><div className="t-sm dim">Ближайших событий нет — загляните в расписание позже.</div></Card>
      )}

      <Actions
        items={[
          { icon: 'book', title: 'База знаний', onClick: () => go('/base') },
          { icon: 'trophy', title: 'Рейтинг', onClick: () => go('/rating') },
          { icon: 'city', title: city.city?.name || 'Город', onClick: () => go(`/city/${me.cityId}`) },
          { icon: 'gift', title: 'Пригласить', onClick: () => go('/invite') },
        ]}
      />

      {offer && (
        <Card variant="accent">
          <div className="t-lg">Возьмёте пятницу на себя?</div>
          <div className="t-sm dim" style={{ marginTop: 4, lineHeight: 1.5 }}>
            Вы первый в городе {city.city.nameIn}. Организатор выбирает место и время — две минуты в неделю.
          </div>
          <div className="pair" style={{ marginTop: 12 }}>
            <button className="btn btn--accent btn--sm" onClick={() => dispatch({ type: 'organizer', cityId: city.city.id, accept: true })}>Согласен</button>
            <button className="btn btn--ghost btn--sm" onClick={() => dispatch({ type: 'organizer', cityId: city.city.id, accept: false })}>Не сейчас</button>
          </div>
        </Card>
      )}

      {/* Команда */}
      {isPro(me) && (
        <Section title="Команда" more={team ? 'Открыть' : undefined} onMore={() => go('/team')}>
          {team ? (
            <TeamCard team={team} />
          ) : (
            <button className="card tap" onClick={() => go('/team')}>
              <div className="row">
                <div className="item__ic"><Icon name={application ? 'clock' : 'hand'} size={19} /></div>
                <div className="grow">
                  <div className="t-md">{application ? 'Заявка у куратора' : 'Вы ещё не в команде'}</div>
                  <div className="t-xs dim-2" style={{ marginTop: 2 }}>{application ? 'Куратор соберёт команды и напишет' : 'Заполните короткую заявку — куратор подберёт команду'}</div>
                </div>
                <Icon name="right" size={16} className="chev" />
              </div>
            </button>
          )}
        </Section>
      )}

      {/* На неделе */}
      {upcoming.length > 0 && (
        <Section title="На этой неделе" more="Все" onMore={() => go('/events')}>
          <List>{upcoming.map((e) => <EventRow key={e.id} event={e} now={now} />)}</List>
        </Section>
      )}

      {/* Город и кофе — одним списком */}
      <Section title="Рядом">
        <List>
          <Item
            icon="city"
            title={city.city?.name}
            sub={city.ready
              ? `${city.count} чел. · ${friday ? `пятница ${whenLabel(friday.startsAt, now).toLowerCase()}` : 'встреча раз в неделю'}`
              : 'Пока вы один — позовите второго, и появится пятница'}
            onClick={() => go(`/city/${me.cityId}`)}
          />
          {me.coffeeEnabled && buddy && (
            <Item
              lead={<Avatar user={buddy} size={40} />}
              title={`Пара недели: ${buddy.name.split(' ')[0]}`}
              sub={pair.status === 'agreed' ? 'Договорились — хорошей встречи' : buddy.about}
              meta={<Tag tone="accent">кофе</Tag>}
              onClick={() => go('/coffee')}
            />
          )}
          {summit && (
            <Item icon="star" title="Большой слёт" sub={`${dateShort(summit.startsAt)} · ${summit.place}`} onClick={() => go('/summit')} />
          )}
        </List>
      </Section>

      {/* База знаний */}
      {materials.length > 0 && (
        <Section title="Новое в базе" more="Вся база" onMore={() => go('/base')}>
          <List>
            {materials.map((m) => (
              <Item key={m.id} lead={<MaterialThumb material={m} />} title={m.title} sub={`${m.type} · ${dateShort(m.publishedAt)}`} onClick={() => go(`/material/${m.id}`)} />
            ))}
          </List>
        </Section>
      )}

      {/* Сезон */}
      <div className="season">
        <div className="spread">
          <div>
            <div className="t-md">До выпускного {season.daysLeft} {plural(season.daysLeft, 'день', 'дня', 'дней')}</div>
            <div className="t-xs dim-2" style={{ marginTop: 2 }}>Копилка сезона {money(seasonPot(state))} — на призы и выпускной</div>
          </div>
          <Icon name="trophy" size={20} color="var(--warm)" />
        </div>
        <Bar value={season.percent / 100} />
      </div>
    </div>
  );
}

function TeamCard({ team }) {
  const { state } = useStore();
  const stats = teamStats(state, team.id);
  const place = teamPlace(state, team.id);
  return (
    <button className="card tap" onClick={() => go('/team')}>
      <div className="spread">
        <div className="grow">
          <div className="t-lg ell">{team.name}</div>
          <div className="t-xs dim-2 ell" style={{ marginTop: 2 }}>{team.idea}</div>
        </div>
        {place && (
          <div className="center" style={{ flex: 'none' }}>
            <div className="figure warm" style={{ fontSize: 26 }}>{place}</div>
            <div className="t-xs dim-2">место</div>
          </div>
        )}
      </div>
      <div className="stats" style={{ marginTop: 12 }}>
        <div className="stat" style={{ background: 'var(--surface-2)' }}><div className="stat__v" style={{ fontSize: 16 }}>{moneyShort(stats.total)}</div><div className="stat__l">выручка</div></div>
        <div className="stat" style={{ background: 'var(--surface-2)' }}><div className="stat__v" style={{ fontSize: 16 }}>{stats.size}</div><div className="stat__l">в команде</div></div>
        <div className="stat" style={{ background: 'var(--surface-2)' }}><div className="stat__v" style={{ fontSize: 16, color: stats.debt ? 'var(--warm)' : 'var(--accent)' }}>{stats.debt ? moneyShort(stats.debt) : 'ок'}</div><div className="stat__l">копилка</div></div>
      </div>
    </button>
  );
}

function greet() {
  const h = new Date().getHours();
  if (h < 5) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}
