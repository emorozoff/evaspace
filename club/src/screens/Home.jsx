import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import {
  nextEvent, visibleEvents, teamOf, teamStats, teamPlace, seasonProgress, cityStats, nextFridayEvent,
  meetsFor, userById, materialsFor, isPro, summitVisible, summitEvent, unreadCount, applicationOf,
  attendanceOf, inviteFor, awardOf, chatsOf, feedPosts, WEEKLY_MEETS,
} from '../lib/logic.js';
import { weekKey, plural, whenLabel, dateShort, DAY } from '../lib/time.js';
import { moneyShort } from '../lib/format.js';
import { Avatar, Actions, Btn, Card, List, Item, Section, Stat, Tag } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';
import ResidentCard from '../components/ResidentCard.jsx';
import Circle from '../components/Circle.jsx';
import EventCompact from '../components/EventCompact.jsx';
import { EventRow } from '../components/EventCard.jsx';
import { MaterialThumb } from './Base.jsx';
import { Post } from './Feed.jsx';

export default function Home({ now }) {
  const { state, me, dispatch } = useStore();
  const season = seasonProgress(state, now);
  const been = attendanceOf(state, me.id, now);
  const event = nextEvent(state, me, now);
  const upcoming = visibleEvents(state, me, { from: now, to: now + 8 * DAY }).filter((e) => e.id !== event?.id).slice(0, 2);
  const team = teamOf(state, me.id);
  const stats = team ? teamStats(state, team.id, now) : null;
  const invite = inviteFor(state, me.id);
  const application = applicationOf(state, me.id);
  const city = cityStats(state, me.cityId);
  const friday = nextFridayEvent(state, me.cityId, now);
  const freshMeets = meetsFor(state, me.id, weekKey(now)).filter((m) => m.status === 'new').length;
  const unreadChats = chatsOf(state, me.id).reduce((sum, c) => sum + c.unread, 0);
  const material = materialsFor(state, me)[0];
  const unread = unreadCount(state, me.id);
  const summit = summitVisible(state, now) ? summitEvent(state) : null;
  const offer = city.city?.organizerOfferTo === me.id && !city.city?.organizerId;
  const place = team ? teamPlace(state, team.id) : null;
  const posts = feedPosts(state).slice(0, 2);

  return (
    <div className="screen stack-20">
      <div className="top">
        <div className="grow">
          <div className="eyebrow">{state.season.title} · месяц {season.monthIndex} из 3</div>
          <h1 className="h1" style={{ marginTop: 4 }}>{greet()}, {me.name.split(' ')[0]}</h1>
        </div>
        <button className="iconbtn" onClick={() => go('/chats')} aria-label="Сообщения">
          <Icon name="message" size={19} />
          {unreadChats > 0 && <span className="badge-n">{unreadChats}</span>}
        </button>
        <button className="iconbtn" onClick={() => go('/notes')} aria-label="Уведомления">
          <Icon name="bell" size={19} />
          {unread > 0 && <span className="badge-n">{unread}</span>}
        </button>
        <button onClick={() => go('/profile')} aria-label="Профиль"><Avatar user={me} size={38} /></button>
      </div>

      <ResidentCard now={now} />

      {/* Обратный отсчёт и главные цифры сезона */}
      <div className="stats">
        <Stat v={season.daysLeft} l={`${plural(season.daysLeft, 'день', 'дня', 'дней')} до финала`} tone="var(--accent)" />
        <Stat v={`${been.went}/${been.total}`} l="встреч посетил" />
        <Stat v={stats ? stats.size : '—'} l={stats ? 'в команде' : 'без команды'} />
      </div>

      {/* Зовут в команду — это важнее всего остального */}
      {invite && <InviteCard invite={invite} />}

      {offer && (
        <Card variant="accent">
          <div className="t-lg">Возьмёте пятницу на себя?</div>
          <div className="t-sm dim" style={{ marginTop: 4, lineHeight: 1.5 }}>
            Вы первый в городе {city.city.nameIn}. Организатор выбирает место и время — две минуты в неделю.
          </div>
          <div className="pair" style={{ marginTop: 12 }}>
            <Btn variant="accent" size="sm" onClick={() => dispatch({ type: 'organizer', cityId: city.city.id, accept: true })}>Согласен</Btn>
            <Btn variant="ghost" size="sm" onClick={() => dispatch({ type: 'organizer', cityId: city.city.id, accept: false })}>Не сейчас</Btn>
          </div>
        </Card>
      )}

      <Circle />

      <Section title="Ближайшее" more="Все события" onMore={() => go('/events')}>
        {event ? <EventCompact event={event} now={now} /> : <Card><div className="t-sm dim">Ближайших событий нет — загляните позже.</div></Card>}
        {upcoming.length > 0 && <List>{upcoming.map((e) => <EventRow key={e.id} event={e} now={now} />)}</List>}
      </Section>

      <Actions
        items={[
          { icon: 'book', title: 'База знаний', onClick: () => go('/base') },
          { icon: 'cup', title: 'Рейтинг', onClick: () => go('/rating') },
          { icon: 'city', title: city.city?.name || 'Город', onClick: () => go(`/city/${me.cityId}`) },
          { icon: 'gift', title: 'Пригласить', onClick: () => go('/invite') },
        ]}
      />

      {isPro(me) && (
        <Section title="Команда" more={team ? 'Открыть' : undefined} onMore={() => go('/team')}>
          {team && stats ? (
            <button className="card tap" onClick={() => go('/team')}>
              <div className="row">
                {place && (
                  <span className="award" style={{ background: `${awardOf(place).tone}22` }}>
                    <Icon name={awardOf(place).icon} size={22} color={awardOf(place).tone} />
                    <span className="award__n">{place}</span>
                  </span>
                )}
                <div className="grow">
                  <div className="t-lg ell">{team.name}</div>
                  <div className="t-xs dim-2 ell" style={{ marginTop: 2 }}>{team.goal || team.idea}</div>
                </div>
                <Icon name="right" size={16} className="chev" />
              </div>
              <div className="stats" style={{ marginTop: 12 }}>
                <div className="stat" style={{ background: 'var(--surface-2)' }}><div className="stat__v" style={{ fontSize: 16 }}>{moneyShort(stats.total)}</div><div className="stat__l">выручка</div></div>
                <div className="stat" style={{ background: 'var(--surface-2)' }}><div className="stat__v" style={{ fontSize: 16 }}>{stats.activity}%</div><div className="stat__l">активность</div></div>
                <div className="stat" style={{ background: 'var(--surface-2)' }}><div className="stat__v" style={{ fontSize: 16, color: stats.debt ? 'var(--warm)' : 'var(--accent)' }}>{stats.debt ? moneyShort(stats.debt) : 'ок'}</div><div className="stat__l">копилка</div></div>
              </div>
            </button>
          ) : (
            <button className="card tap" onClick={() => go('/team')}>
              <div className="row">
                <div className="item__ic"><Icon name={application ? 'clock' : 'hand'} size={19} /></div>
                <div className="grow">
                  <div className="t-md">{application ? 'Заявка у куратора' : 'Вы ещё не в команде'}</div>
                  <div className="t-xs dim-2" style={{ marginTop: 2 }}>{application ? 'Куратор соберёт команды и напишет' : 'Короткая заявка — и куратор подберёт команду'}</div>
                </div>
                <Icon name="right" size={16} className="chev" />
              </div>
            </button>
          )}
        </Section>
      )}

      {posts.length > 0 && (
        <Section title="Лента" more="Вся лента" onMore={() => go('/feed')}>
          <div className="stack">
            {posts.map((post) => <Post key={post.id} post={post} now={now} compact />)}
          </div>
        </Section>
      )}

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
          {me.coffeeEnabled && freshMeets > 0 && (
            <Item
              icon="spark"
              title="Новые знакомства"
              sub={`${freshMeets} из ${WEEKLY_MEETS} предложений на этой неделе`}
              meta={<Tag tone="accent">{freshMeets}</Tag>}
              onClick={() => go('/meet')}
            />
          )}
          {summit && <Item icon="star" title="Большой слёт" sub={`${dateShort(summit.startsAt)} · ${summit.place}`} onClick={() => go('/summit')} />}
          {material && (
            <Item lead={<MaterialThumb material={material} />} title={material.title} sub={`${material.type} · ${dateShort(material.publishedAt)}`} onClick={() => go(`/material/${material.id}`)} />
          )}
        </List>
      </Section>
    </div>
  );
}

/** Приглашение в команду: решает сам участник, не куратор. */
function InviteCard({ invite }) {
  const { state, dispatch } = useStore();
  const team = state.teams.find((t) => t.id === invite.teamId);
  const from = userById(state, invite.fromId);
  if (!team) return null;
  return (
    <Card variant="violet">
      <div className="row-t">
        <div className="item__ic" style={{ color: 'var(--violet)' }}><Icon name="team" size={19} /></div>
        <div className="grow">
          <div className="t-lg">Вас зовут в «{team.name}»</div>
          <div className="t-sm dim" style={{ marginTop: 4, lineHeight: 1.5 }}>
            {from ? `${from.name} приглашает вас усилить команду. ` : ''}{team.goal || team.idea}
          </div>
        </div>
      </div>
      <div className="pair" style={{ marginTop: 14 }}>
        <Btn variant="accent" size="sm" onClick={() => dispatch({ type: 'inviteAnswer', id: invite.id, accept: true })}>Согласен</Btn>
        <Btn variant="quiet" size="sm" onClick={() => dispatch({ type: 'inviteAnswer', id: invite.id, accept: false })}>Не сейчас</Btn>
      </div>
    </Card>
  );
}

function greet() {
  const h = new Date().getHours();
  if (h < 5) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}
