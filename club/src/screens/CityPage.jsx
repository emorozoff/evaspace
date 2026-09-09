import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { cityStats, nextFridayEvent } from '../lib/logic.js';
import { dateShort, dateTiny } from '../lib/time.js';
import { Avatar, Btn, Card, Empty, Sheet, Stat, TopBar, Area } from '../components/UI.jsx';
import { IcPin, IcNext, IcCity } from '../components/Icons.jsx';
import EventCard from '../components/EventCard.jsx';

/* Город — ключевая механика клуба. Двое в городе = чат + пятница. */

export default function CityPage({ id, navigate, now }) {
  const { state, me, dispatch } = useStore();
  const stats = cityStats(state, id);
  const [propose, setPropose] = useState(false);
  const [text, setText] = useState('');

  if (!stats.city) return <Empty title="Город не найден" />;

  const friday = nextFridayEvent(state, id, now);
  const isMine = me.cityId === id;
  const offer = stats.city.organizerOfferTo === me.id && !stats.city.organizerId;
  const proposals = state.proposals.filter((p) => p.cityId === id).slice(-5).reverse();

  return (
    <div className="screen">
      <TopBar title={stats.city.name} sub={isMine ? 'Ваш город' : 'Город клуба'} />

      <div className="hero">
        <div className="row" style={{ marginBottom: 12 }}>
          <IcCity size={22} className="t-lime" />
          <div className="t-title">Пятница в {stats.city.nameIn}</div>
        </div>
        <div className="grid3">
          <Stat value={stats.count} label="участников" />
          <Stat value={stats.organizer ? stats.organizer.name.split(' ')[0] : '—'} label="организатор" />
          <Stat value={friday ? dateTiny(friday.startsAt) : '—'} label="ближайшая" />
        </div>
      </div>

      {!stats.ready && (
        <Card style={{ marginTop: 10 }}>
          <div className="t-title">Пока в городе один человек</div>
          <div className="t-sub">
            Как только появится второй, мы сами заведём чат города и поставим в расписание еженедельную пятницу.
            Позовите кого-нибудь по своей ссылке.
          </div>
          <Btn kind="ghost" wide small style={{ marginTop: 12 }} onClick={() => navigate('/invite')}>
            Пригласить друга
          </Btn>
        </Card>
      )}

      {offer && (
        <Card kind="accent" style={{ marginTop: 10 }}>
          <div className="t-title">Станьте организатором города</div>
          <div className="t-sub">Выбираете место и время встречи, можете отменить конкретную неделю. Всё остальное — сами участники.</div>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <Btn kind="primary" small onClick={() => dispatch({ type: 'organizer', cityId: id, accept: true })}>Согласен</Btn>
            <Btn kind="soft" small onClick={() => dispatch({ type: 'organizer', cityId: id, accept: false })}>Не сейчас</Btn>
          </div>
        </Card>
      )}

      {stats.city.chatUrl && (
        <a className="btn soft wide" style={{ marginTop: 10 }} href={stats.city.chatUrl} target="_blank" rel="noreferrer">
          Чат города в телеграме
        </a>
      )}

      {friday && (
        <>
          <div className="section"><h2>Ближайшая встреча</h2></div>
          <EventCard event={friday} now={now} onOpen={() => navigate(`/event/${friday.id}`)} />
        </>
      )}

      {stats.ready && !stats.organizer && (
        <Card style={{ marginTop: 10 }}>
          <div className="t-title">Организатора нет</div>
          <div className="t-sub">Встреча всё равно есть — место выбирают сами участники. Клуб в это не вмешивается.</div>
          <Btn kind="ghost" wide small style={{ marginTop: 12 }} onClick={() => setPropose(true)}>
            <IcPin /> Предложить место
          </Btn>
        </Card>
      )}

      {proposals.length > 0 && (
        <>
          <div className="section"><h2>Предложения</h2></div>
          <Card>
            {proposals.map((p) => {
              const author = state.users.find((u) => u.id === p.userId);
              return (
                <div key={p.id} className="lead" style={{ gridTemplateColumns: 'auto 1fr' }}>
                  <Avatar user={author} size={30} />
                  <div>
                    <div className="t-sub">{p.text}</div>
                    <div className="t-dim">{author?.name} · {dateShort(p.at)}</div>
                  </div>
                </div>
              );
            })}
          </Card>
        </>
      )}

      <div className="section"><h2>Участники · {stats.count}</h2></div>
      <Card>
        {stats.members.map((u) => (
          <div key={u.id} className="lead" style={{ gridTemplateColumns: 'auto 1fr auto', cursor: 'pointer' }} onClick={() => navigate(`/person/${u.id}`)}>
            <Avatar user={u} size={34} />
            <div style={{ minWidth: 0 }}>
              <div className="ellipsis" style={{ fontWeight: 600 }}>
                {u.name} {u.id === stats.city.organizerId && <span className="t-lime" style={{ fontSize: 12 }}>· организатор</span>}
              </div>
              <div className="t-dim ellipsis">{u.about}</div>
            </div>
            <IcNext />
          </div>
        ))}
      </Card>

      {propose && (
        <Sheet title="Предложить место" sub={`Пятница в ${stats.city.nameIn}`} onClose={() => setPropose(false)}>
          <div className="stack">
            <Area placeholder="Идём в боулинг на Ленина, сбор в 20:00" value={text} onChange={(e) => setText(e.target.value)} />
            <Btn
              kind="primary"
              wide
              disabled={text.trim().length < 5}
              onClick={() => {
                dispatch({ type: 'propose', cityId: id, text });
                setText('');
                setPropose(false);
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
