import { useStore } from '../lib/store.jsx';
import { goingUsers, rsvpOf, summitEvent } from '../lib/logic.js';
import { whenLabel, dateShort, plural, DAY } from '../lib/time.js';
import { people } from '../lib/format.js';
import { Avatar, AvatarStack, Btn, Card, Empty, TopBar } from '../components/UI.jsx';
import { IcPin, IcNext } from '../components/Icons.jsx';

const PROGRAM = [
  ['12:00', 'Сбор, кофе и знакомства'],
  ['13:00', 'Итоги сезона: цифры клуба'],
  ['14:00', 'Питчи команд — по 7 минут'],
  ['16:00', 'Награждение и копилка сезона'],
  ['17:30', 'Фотосессия и съёмка ролика'],
  ['19:00', 'Вечеринка'],
];

export default function Summit({ navigate, now }) {
  const { state, me, dispatch } = useStore();
  const event = summitEvent(state);
  if (!event) return <Empty title="Слёт ещё не назначен" />;

  const going = goingUsers(state, event.id);
  const mine = rsvpOf(state, event.id, me.id);
  const days = Math.ceil((event.startsAt - now) / DAY);
  const past = event.startsAt < now;

  return (
    <div className="screen">
      <TopBar title="Большой слёт" sub={state.season.title} />

      <div className="hero center">
        <div className="t-dim">{past ? 'Слёт прошёл' : `через ${days} ${plural(days, 'день', 'дня', 'дней')}`}</div>
        <div className="t-huge" style={{ margin: '6px 0' }}>{dateShort(event.startsAt)}</div>
        <div className="t-sub">{whenLabel(event.startsAt, now)}</div>
        <div className="dotline center" style={{ justifyContent: 'center', marginTop: 10 }}>
          <IcPin />
          <span>{event.place}</span>
        </div>
      </div>

      {!past && (
        <div className="btn-row" style={{ marginTop: 10 }}>
          <Btn kind={mine === 'going' ? 'on' : 'primary'} onClick={() => dispatch({ type: 'rsvp', eventId: event.id, status: 'going' })}>
            {mine === 'going' ? 'Вы едете' : 'Буду'}
          </Btn>
          <Btn kind={mine === 'not_going' ? 'off' : 'soft'} onClick={() => dispatch({ type: 'rsvp', eventId: event.id, status: 'not_going' })}>
            Не смогу
          </Btn>
        </div>
      )}

      <div className="section"><h2>Программа</h2></div>
      <Card>
        {PROGRAM.map(([time, what]) => (
          <div key={time} className="lead" style={{ gridTemplateColumns: '54px 1fr' }}>
            <div className="place mono">{time}</div>
            <div>{what}</div>
          </div>
        ))}
      </Card>

      <div className="section"><h2>Что взять</h2></div>
      <Card>
        <div className="stack s">
          <div>· Питч команды на 7 минут — без слайдов тоже можно</div>
          <div>· Ноутбук, если показываете продукт</div>
          <div>· Наличные на такси — площадка за городом</div>
          <div className="t-sub" style={{ marginTop: 6 }}>Дресс-код: как в обычный рабочий день, только удобнее.</div>
        </div>
      </Card>

      <div className="section"><h2>Едут · {going.length}</h2></div>
      {going.length === 0 ? (
        <Empty title="Пока никто не отметился" />
      ) : (
        <Card>
          <AvatarStack users={going} max={10} size={34} />
          <div className="t-dim" style={{ marginTop: 10 }}>{people(going.length)} уже подтвердили участие</div>
          {going.slice(0, 12).map((u) => (
            <div key={u.id} className="lead" style={{ gridTemplateColumns: 'auto 1fr auto', cursor: 'pointer' }} onClick={() => navigate(`/person/${u.id}`)}>
              <Avatar user={u} size={32} />
              <div className="ellipsis" style={{ fontWeight: 600 }}>{u.name}</div>
              <IcNext />
            </div>
          ))}
        </Card>
      )}

      <Card className="flat" style={{ marginTop: 16 }}>
        <div className="t-dim">
          После слёта здесь появятся фотографии и ролик о сезоне.
        </div>
      </Card>
    </div>
  );
}
