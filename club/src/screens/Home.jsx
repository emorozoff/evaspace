import { useStore } from '../lib/store.jsx';
import {
  nextEvent, teamOf, teamStats, teamPlace, seasonProgress, cityStats, nextFridayEvent,
  coffeeFor, userById, materialsFor, isPro, summitVisible, summitEvent, unreadCount, seasonPot, leaderboard,
} from '../lib/logic.js';
import { weekKey, plural, whenLabel, dateShort } from '../lib/time.js';
import { money, moneyShort, people } from '../lib/format.js';
import { Avatar, Btn, Card, Progress, Section, Stat } from '../components/UI.jsx';
import { IcSpark, IcBell, IcNext, IcPlay, IcCoffee, IcCity, IcTrophy, IcShare } from '../components/Icons.jsx';
import EventCard from '../components/EventCard.jsx';

export default function Home({ navigate, now }) {
  const { state, me, dispatch } = useStore();
  const season = seasonProgress(state, now);
  const event = nextEvent(state, me, now);
  const team = teamOf(state, me.id);
  const city = cityStats(state, me.cityId);
  const friday = nextFridayEvent(state, me.cityId, now);
  const pair = coffeeFor(state, me.id, weekKey(now));
  const buddy = pair ? userById(state, pair.a === me.id ? pair.b : pair.a) : null;
  const material = materialsFor(state, me)[0];
  const unread = unreadCount(state, me.id);
  const summit = summitVisible(state, now) ? summitEvent(state) : null;
  const offer = city.city?.organizerOfferTo === me.id && !city.city?.organizerId;

  return (
    <div className="screen">
      <div className="topbar">
        <div className="logo">
          <div className="mark">
            <IcSpark size={16} className="t-lime" />
          </div>
          <div style={{ minWidth: 0 }}>
            <h1>И АЙ КЛАБ</h1>
            <div className="sub ellipsis">Привет, {me.name.split(' ')[0]}</div>
          </div>
        </div>
        <div className="spacer" />
        <button className="iconbtn" onClick={() => navigate('/notes')} aria-label="Уведомления">
          <IcBell />
          {unread > 0 && <span className="dot">{unread}</span>}
        </button>
      </div>

      {/* Полоса сезона */}
      <div className="hero">
        <div className="split" style={{ marginBottom: 10 }}>
          <div>
            <div className="t-dim">{state.season.title}</div>
            <div className="t-big">Месяц {season.monthIndex} из 3</div>
          </div>
          <div className="center">
            <div className="t-big mono t-lime">{season.daysLeft}</div>
            <div className="t-dim">{plural(season.daysLeft, 'день', 'дня', 'дней')} до выпускного</div>
          </div>
        </div>
        <Progress percent={season.percent} />
        <div className="row" style={{ marginTop: 10 }}>
          <IcTrophy size={16} className="t-lime" />
          <div className="t-sub">
            Копилка сезона: <b className="mono">{money(seasonPot(state))}</b> — на призы и выпускной
          </div>
        </div>
      </div>

      {/* Предложение стать организатором города */}
      {offer && (
        <Card kind="accent" style={{ marginTop: 10 }}>
          <div className="t-title">Возьмёте пятницу на себя?</div>
          <div className="t-sub" style={{ marginTop: 3 }}>
            Вы первый участник в городе {city.city.nameIn}. Организатор выбирает место и время встречи — не больше двух минут в неделю.
          </div>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <Btn kind="primary" small onClick={() => dispatch({ type: 'organizer', cityId: city.city.id, accept: true })}>
              Согласен
            </Btn>
            <Btn kind="soft" small onClick={() => dispatch({ type: 'organizer', cityId: city.city.id, accept: false })}>
              Не сейчас
            </Btn>
          </div>
        </Card>
      )}

      {/* Ближайшее событие */}
      <Section title="Ближайшее" action="Всё расписание" onAction={() => navigate('/schedule')} />
      {event ? (
        <EventCard event={event} now={now} onOpen={() => navigate(`/event/${event.id}`)} />
      ) : (
        <Card>
          <div className="t-sub">Ближайших событий нет. Загляните в расписание позже.</div>
        </Card>
      )}

      {/* Город */}
      <Section title="Мой город" action="Открыть" onAction={() => navigate(`/city/${me.cityId}`)} />
      <Card tap onClick={() => navigate(`/city/${me.cityId}`)}>
        <div className="row">
          <IcCity size={20} className="t-lime" />
          <div style={{ minWidth: 0 }}>
            <div className="t-title">{city.city?.name}</div>
            <div className="t-sub">
              {city.ready
                ? `${people(city.count)} · ${city.organizer ? `организатор ${city.organizer.name.split(' ')[0]}` : 'организатора пока нет'}`
                : 'Пока вы один. Как только появится второй — заведём чат и пятницу'}
            </div>
          </div>
          <div className="spacer" />
          <IcNext />
        </div>
        {friday && (
          <div className="t-dim" style={{ marginTop: 8 }}>
            Ближайшая пятница: {whenLabel(friday.startsAt, now)} · {friday.place || 'место ещё не выбрано'}
          </div>
        )}
      </Card>

      {/* Команда и рейтинг */}
      {isPro(me) && (
        <>
          <Section title="Команда" action={team ? 'Рейтинг' : 'Найти'} onAction={() => navigate(team ? '/rating' : '/team')} />
          {team ? (
            <TeamStrip team={team} navigate={navigate} />
          ) : (
            <Card tap onClick={() => navigate('/team')}>
              <div className="t-title">Вы ещё не в команде</div>
              <div className="t-sub">Команда — это 3–10 человек, общая идея и общая выручка в рейтинге.</div>
              <Btn kind="primary" wide small style={{ marginTop: 12 }}>
                Найти команду
              </Btn>
            </Card>
          )}
        </>
      )}

      {/* Рандом-кофе */}
      {me.coffeeEnabled && buddy && (
        <>
          <Section title="Пара недели" action="Кофе" onAction={() => navigate('/coffee')} />
          <Card tap onClick={() => navigate('/coffee')}>
            <div className="row">
              <Avatar user={buddy} size={44} />
              <div style={{ minWidth: 0 }}>
                <div className="t-title ellipsis">{buddy.name}</div>
                <div className="t-sub ellipsis">{buddy.about}</div>
              </div>
              <div className="spacer" />
              <IcCoffee size={20} className="t-lime" />
            </div>
            {pair.status === 'new' && <div className="t-dim" style={{ marginTop: 8 }}>Напишите и договоритесь о встрече на этой неделе</div>}
            {pair.status === 'agreed' && <div className="t-lime" style={{ marginTop: 8 }}>Договорились — хорошей встречи</div>}
          </Card>
        </>
      )}

      {/* База знаний */}
      {material && (
        <>
          <Section title="Последнее в базе" action="Вся база" onAction={() => navigate('/base')} />
          <Card tap onClick={() => navigate(`/base/${material.id}`)}>
            <div className="row">
              <div className="video" style={{ width: 92, aspectRatio: '16/10', flex: 'none' }}>
                <div className="play" style={{ width: 34, height: 34 }}>
                  <IcPlay size={14} />
                </div>
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="t-title" style={{ fontSize: 15 }}>{material.title}</div>
                <div className="t-dim">
                  {material.type} · {dateShort(material.publishedAt)}
                </div>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* Слёт */}
      {summit && (
        <>
          <Section title="Большой слёт" action="Подробнее" onAction={() => navigate('/summit')} />
          <Card kind="violet" tap onClick={() => navigate('/summit')}>
            <div className="t-title">{whenLabel(summit.startsAt, now)}</div>
            <div className="t-sub">{summit.place}</div>
          </Card>
        </>
      )}

      <Btn kind="ghost" wide style={{ marginTop: 22 }} onClick={() => navigate('/invite')}>
        <IcShare /> Пригласить друга
      </Btn>
    </div>
  );
}

function TeamStrip({ team, navigate }) {
  const { state } = useStore();
  const stats = teamStats(state, team.id);
  const place = teamPlace(state, team.id);
  const total = leaderboard(state).length;

  return (
    <Card tap onClick={() => navigate(`/team/${team.id}`)}>
      <div className="split">
        <div style={{ minWidth: 0 }}>
          <div className="t-title ellipsis">{team.name}</div>
          <div className="t-sub ellipsis">{team.idea}</div>
        </div>
        {place && (
          <div className="center">
            <div className="t-big mono t-lime">{place}</div>
            <div className="t-dim">из {total}</div>
          </div>
        )}
      </div>
      <div className="grid3" style={{ marginTop: 12 }}>
        <Stat value={moneyShort(stats.total)} label="выручка сезона" />
        <Stat value={`${stats.hours} ч`} label="сэкономлено" />
        <Stat value={stats.debt ? moneyShort(stats.debt) : 'ок'} label="копилка" tone={stats.debt ? 't-amber' : 't-lime'} />
      </div>
      {stats.debt > 0 && (
        <div className="t-amber" style={{ marginTop: 10, fontSize: 12.5 }}>
          Не хватает взноса {money(stats.debt)} — часть выручки не засчитана в рейтинг
        </div>
      )}
    </Card>
  );
}
