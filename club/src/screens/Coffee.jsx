import { useStore } from '../lib/store.jsx';
import { coffeeFor, userById, cityName } from '../lib/logic.js';
import { weekKey, dateShort } from '../lib/time.js';
import { Avatar, Btn, Card, Empty, Switch, TopBar } from '../components/UI.jsx';
import { IcCoffee } from '../components/Icons.jsx';

/* Рандом-кофе: пара на неделю, приоритет — один город и разные команды. */

export default function Coffee({ navigate, now }) {
  const { state, me, dispatch } = useStore();
  const week = weekKey(now);
  const pair = coffeeFor(state, me.id, week);
  const buddy = pair ? userById(state, pair.a === me.id ? pair.b : pair.a) : null;
  const history = state.coffee
    .filter((c) => (c.a === me.id || c.b === me.id) && c.week !== week)
    .sort((a, b) => b.at - a.at);

  return (
    <div className="screen">
      <TopBar title="Рандом-кофе" sub="Каждый понедельник новая пара" />

      {!me.coffeeEnabled ? (
        <Card>
          <div className="t-title">Участие выключено</div>
          <div className="t-sub">Включите переключатель — и в ближайший понедельник придёт пара.</div>
          <Switch
            title="Участвовать в рандом-кофе"
            on={me.coffeeEnabled}
            onChange={(v) => dispatch({ type: 'profile', patch: { coffeeEnabled: v }, silent: true })}
          />
        </Card>
      ) : !buddy ? (
        <Empty title="Пары на эту неделю нет" text="Такое бывает, если участников с включённым кофе нечётное число. В понедельник попробуем снова." />
      ) : (
        <>
          <div className="hero center">
            <div style={{ display: 'grid', justifyItems: 'center', gap: 10 }}>
              <IcCoffee size={22} className="t-lime" />
              <Avatar user={buddy} size={82} />
              <div>
                <div className="t-big">{buddy.name}</div>
                <div className="t-sub">
                  {cityName(state, buddy.cityId)}
                  {pair.online ? ' · встречаетесь онлайн' : ' · вы в одном городе'}
                </div>
              </div>
            </div>
          </div>

          <Card style={{ marginTop: 10 }}>
            <div className="t-dim">Чем занимается</div>
            <div style={{ marginTop: 3 }}>{buddy.about}</div>
            {buddy.lookingFor && (
              <>
                <div className="t-dim" style={{ marginTop: 12 }}>Что ищет</div>
                <div style={{ marginTop: 3 }}>{buddy.lookingFor}</div>
              </>
            )}
          </Card>

          <a className="btn primary wide" style={{ marginTop: 10 }} href={`https://t.me/${(buddy.tg || '').replace('@', '')}`} target="_blank" rel="noreferrer">
            Написать в телеграм
          </a>

          <div className="btn-row" style={{ marginTop: 10 }}>
            <Btn kind={pair.status === 'agreed' ? 'on' : 'soft'} onClick={() => dispatch({ type: 'coffee', id: pair.id, status: 'agreed' })}>
              Договорились
            </Btn>
            <Btn kind={pair.status === 'skipped' ? 'off' : 'soft'} onClick={() => dispatch({ type: 'coffee', id: pair.id, status: 'skipped' })}>
              Пропустить неделю
            </Btn>
          </div>

          <Btn kind="ghost" wide small style={{ marginTop: 10 }} onClick={() => navigate(`/person/${buddy.id}`)}>
            Открыть профиль
          </Btn>
        </>
      )}

      {history.length > 0 && (
        <>
          <div className="section"><h2>С кем уже виделись</h2></div>
          <Card>
            {history.map((c) => {
              const other = userById(state, c.a === me.id ? c.b : c.a);
              return (
                <div key={c.id} className="lead" style={{ gridTemplateColumns: 'auto 1fr auto' }}>
                  <Avatar user={other} size={32} />
                  <div style={{ minWidth: 0 }}>
                    <div className="ellipsis" style={{ fontWeight: 600 }}>{other?.name}</div>
                    <div className="t-dim">{dateShort(c.at)}</div>
                  </div>
                  <span className={`chip ${c.status === 'agreed' ? 'on' : ''}`}>
                    {c.status === 'agreed' ? 'встретились' : c.status === 'skipped' ? 'пропустили' : 'без ответа'}
                  </span>
                </div>
              );
            })}
          </Card>
        </>
      )}

      <Card className="flat" style={{ marginTop: 16 }}>
        <Switch
          title="Участвовать в рандом-кофе"
          sub="Выключается одним переключателем"
          on={me.coffeeEnabled}
          onChange={(v) => dispatch({ type: 'profile', patch: { coffeeEnabled: v }, silent: true })}
        />
      </Card>
    </div>
  );
}
