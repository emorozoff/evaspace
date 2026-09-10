import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { meetsFor, userById, cityName, MEET_GOALS, WEEKLY_MEETS, chatKey, factOf } from '../lib/logic.js';
import { weekKey, dateShort } from '../lib/time.js';
import { Avatar, Btn, Empty, List, Item, Note, Section, Sheet, Tag, TopBar } from '../components/UI.jsx';
import Choice from '../components/Choice.jsx';
import Icon from '../components/Icons.jsx';

/* Новые знакомства: программа сама предлагает несколько человек в неделю.
   Совпало с обеих сторон — открывается общий чат. */

export default function Meet({ now }) {
  const { state, me, dispatch } = useStore();
  const [goalOpen, setGoalOpen] = useState(false);
  const week = weekKey(now);
  const mine = meetsFor(state, me.id, week);
  const open = mine.filter((m) => m.status === 'new' || (m.status === 'liked' && !m.likedBy.includes(me.id)));
  const current = open[0];
  const other = current ? userById(state, current.a === me.id ? current.b : current.a) : null;
  const matched = mine.filter((m) => m.status === 'matched');
  const goal = me.meetGoal || me.facts?.goal?.[0] || MEET_GOALS[0].id;
  const goalLabel = MEET_GOALS.find((g) => g.id === goal)?.label || goal;

  return (
    <div className="screen" style={{ paddingTop: 0 }}>
      <TopBar title="Новые знакомства" sub={`${WEEKLY_MEETS} предложения в неделю`} backTo="/people" />
      <div className="stack-20">
        <button className="card tap row" onClick={() => setGoalOpen(true)}>
          <div className="item__ic"><Icon name={MEET_GOALS.find((g) => g.id === goal)?.icon || 'people'} size={19} /></div>
          <div className="grow">
            <div className="t-xs dim-2">Цель знакомств</div>
            <div className="t-md">{goalLabel}</div>
          </div>
          <Icon name="right" size={16} className="chev" />
        </button>

        {/* Сколько предложений на этой неделе уже посмотрели */}
        <div className="meet__quota">
          {Array.from({ length: WEEKLY_MEETS }, (_, i) => <i key={i} data-on={i < mine.length - open.length} />)}
        </div>

        {!me.coffeeEnabled ? (
          <Empty icon="people" title="Знакомства выключены" text="Включите их в профиле — и в понедельник придут новые предложения." />
        ) : current && other ? (
          <article className="meet">
            <div className="meet__top">
              <span className="meet__mode">{current.online ? 'онлайн' : 'ваш город'}</span>
              <span className="meet__pct"><Icon name="spark" size={12} /> {current.percent}%</span>
              <Avatar user={other} size={96} radius={0.3} />
              <div>
                <div className="h2">{other.name}</div>
                <div className="t-sm dim-2" style={{ marginTop: 4 }}>{cityName(state, other.cityId)} · {other.about}</div>
              </div>
            </div>
            <div className="meet__body">
              <div className="wrap" style={{ justifyContent: 'center' }}>
                {(other.facts?.hobby || []).map((h) => (
                  <Tag key={h} tone={(me.facts?.hobby || []).includes(h) ? 'accent' : undefined}>{h}</Tag>
                ))}
              </div>
              {factOf(other, 'goal') && <div className="t-sm dim center">В клубе за: {factOf(other, 'goal').toLowerCase()}</div>}

              <div className="pair">
                <Btn variant="accent" icon="handshake" onClick={() => dispatch({ type: 'meetLike', id: current.id, goal })}>Познакомиться</Btn>
                <Btn variant="quiet" onClick={() => dispatch({ type: 'meetSkip', id: current.id })}>Пропустить</Btn>
              </div>
              <button className="t-sm accent center" style={{ fontWeight: 600 }} onClick={() => go(`/person/${other.id}`)}>Открыть профиль</button>
            </div>
          </article>
        ) : (
          <Empty
            icon="check"
            title="На этой неделе всё"
            text={`Вы посмотрели все ${WEEKLY_MEETS} предложения. Новые придут в понедельник — за сезон успеете познакомиться почти со всеми.`}
          />
        )}

        {matched.length > 0 && (
          <Section title={`Метчи · ${matched.length}`}>
            <List>
              {matched.map((m) => {
                const person = userById(state, m.a === me.id ? m.b : m.a);
                return (
                  <Item
                    key={m.id}
                    lead={<Avatar user={person} size={44} ring="var(--accent)" />}
                    title={person?.name}
                    sub={`Совпадение ${m.percent}% · ${m.online ? 'онлайн' : cityName(state, person?.cityId)}`}
                    meta={<Tag tone="accent">чат</Tag>}
                    onClick={() => go(`/chat/${encodeURIComponent(chatKey('dm', [m.a, m.b]))}`)}
                  />
                );
              })}
            </List>
          </Section>
        )}

        {mine.filter((m) => m.status === 'liked' && m.likedBy.includes(me.id)).length > 0 && (
          <Section title="Ждём ответа">
            <List>
              {mine.filter((m) => m.status === 'liked' && m.likedBy.includes(me.id)).map((m) => {
                const person = userById(state, m.a === me.id ? m.b : m.a);
                return <Item key={m.id} lead={<Avatar user={person} size={40} />} title={person?.name} sub={`Предложение отправлено ${dateShort(m.at)}`} meta={<Tag tone="warm">ждём</Tag>} chev={false} />;
              })}
            </List>
          </Section>
        )}

        <Note icon="eye">Программа подбирает по совпадению интересов и следит, чтобы вы не встречались дважды. Город решает только формат: живьём или онлайн.</Note>
      </div>

      <Sheet open={goalOpen} onClose={() => setGoalOpen(false)} title="Зачем знакомитесь" sub="Это видит собеседник">
        <div className="stack">
          <Choice options={MEET_GOALS} value={[goal]} max={1} onChange={(v) => { dispatch({ type: 'meetGoal', goal: v[0] }); setGoalOpen(false); }} />
        </div>
      </Sheet>
    </div>
  );
}
