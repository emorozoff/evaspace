import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { coffeeFor, userById, cityName } from '../lib/logic.js';
import { weekKey, dateShort } from '../lib/time.js';
import { Avatar, Btn, Card, Empty, List, Item, Section, Switch, Tag, TopBar } from '../components/UI.jsx';

/* Рандом-кофе: пара на неделю, приоритет — один город и разные команды. */

export default function Coffee({ now }) {
  const { state, me, dispatch } = useStore();
  const week = weekKey(now);
  const pair = coffeeFor(state, me.id, week);
  const buddy = pair ? userById(state, pair.a === me.id ? pair.b : pair.a) : null;
  const history = state.coffee.filter((c) => (c.a === me.id || c.b === me.id) && c.week !== week).sort((a, b) => b.at - a.at);

  return (
    <div className="screen" style={{ paddingTop: 0 }}>
      <TopBar title="Рандом-кофе" sub="Новая пара каждый понедельник" backTo="/people" />
      <div className="stack-20">
        {!me.coffeeEnabled ? (
          <Empty icon="coffee" title="Участие выключено" text="Включите переключатель внизу — и в ближайший понедельник придёт пара." />
        ) : !buddy ? (
          <Empty icon="coffee" title="Пары на эту неделю нет" text="Так бывает при нечётном числе участников. В понедельник попробуем снова." />
        ) : (
          <>
            <Card className="center" style={{ display: 'grid', justifyItems: 'center', gap: 10, padding: 22 }}>
              <Avatar user={buddy} size={88} ring="var(--accent)" />
              <div>
                <h2 className="h2">{buddy.name}</h2>
                <div className="t-sm dim-2" style={{ marginTop: 4 }}>{cityName(state, buddy.cityId)} · {pair.online ? 'встречаетесь онлайн' : 'вы в одном городе'}</div>
              </div>
              <div className="t-sm dim" style={{ lineHeight: 1.5 }}>{buddy.about}{buddy.lookingFor ? ` · ищет: ${buddy.lookingFor.toLowerCase()}` : ''}</div>
            </Card>

            <a className="btn btn--accent btn--wide" href={`https://t.me/${(buddy.tg || '').replace('@', '')}`} target="_blank" rel="noreferrer">Написать в телеграм</a>
            <div className="pair">
              <Btn variant={pair.status === 'agreed' ? 'soft' : 'ghost'} icon={pair.status === 'agreed' ? 'check' : undefined} onClick={() => dispatch({ type: 'coffee', id: pair.id, status: 'agreed' })}>Договорились</Btn>
              <Btn variant={pair.status === 'skipped' ? 'danger' : 'quiet'} onClick={() => dispatch({ type: 'coffee', id: pair.id, status: 'skipped' })}>Пропустить</Btn>
            </div>
            <button className="t-sm accent center" style={{ fontWeight: 600 }} onClick={() => go(`/person/${buddy.id}`)}>Открыть профиль</button>
          </>
        )}

        {history.length > 0 && (
          <Section title="С кем уже виделись">
            <List>
              {history.map((c) => {
                const other = userById(state, c.a === me.id ? c.b : c.a);
                return <Item key={c.id} lead={<Avatar user={other} size={36} />} title={other?.name} sub={dateShort(c.at)} meta={<Tag tone={c.status === 'agreed' ? 'accent' : undefined}>{c.status === 'agreed' ? 'встретились' : c.status === 'skipped' ? 'пропустили' : 'без ответа'}</Tag>} chev={false} />;
              })}
            </List>
          </Section>
        )}

        <List>
          <Switch title="Участвовать в рандом-кофе" sub="Приоритет: один город, разные команды, ещё не встречались" on={me.coffeeEnabled} onChange={(v) => dispatch({ type: 'profile', patch: { coffeeEnabled: v }, silent: true })} />
        </List>
      </div>
    </div>
  );
}
