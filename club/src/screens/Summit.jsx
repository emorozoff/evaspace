import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { goingUsers, rsvpOf, summitEvent } from '../lib/logic.js';
import { whenLabel, dateShort, plural, DAY } from '../lib/time.js';
import Cover from '../components/Cover.jsx';
import { Avatar, Btn, Card, Empty, List, Item, Note, Section, Tag, TopBar } from '../components/UI.jsx';

const PROGRAM = [['12:00', 'Сбор, кофе и знакомства'], ['13:00', 'Итоги сезона: цифры клуба'], ['14:00', 'Питчи команд — по 7 минут'], ['16:00', 'Награждение и копилка сезона'], ['17:30', 'Фотосессия и съёмка ролика'], ['19:00', 'Вечеринка']];

export default function Summit({ now }) {
  const { state, me, dispatch } = useStore();
  const event = summitEvent(state);
  if (!event) return <div className="screen"><Empty title="Слёт ещё не назначен" /></div>;
  const going = goingUsers(state, event.id);
  const mine = rsvpOf(state, event.id, me.id);
  const days = Math.ceil((event.startsAt - now) / DAY);
  const past = event.startsAt < now;

  return (
    <div className="screen" style={{ paddingTop: 0 }}>
      <TopBar title="Большой слёт" sub={state.season.title} />
      <div className="stack-20">
        <div className="ev">
          <Cover event={event}>
            <div className="ev__tags"><Tag tone="warm">Слёт</Tag></div>
            <div className="ev__over">
              <div className="ev__title">{dateShort(event.startsAt)}</div>
              <div className="ev__meta">{past ? 'Слёт прошёл' : `через ${days} ${plural(days, 'день', 'дня', 'дней')}`} · {whenLabel(event.startsAt, now)}</div>
            </div>
          </Cover>
        </div>

        <List>
          <Item icon="pin" title={event.place} sub="Площадка за городом — возьмите наличные на такси" chev={false} />
          <Item icon="people" title={`Едут · ${going.length}`} sub="Список ниже" chev={false} />
        </List>

        <Section title="Программа">
          <List>
            {PROGRAM.map(([t, what]) => <Item key={t} lead={<div className="item__ic num" style={{ fontSize: 12, fontWeight: 800 }}>{t}</div>} title={what} chev={false} />)}
          </List>
        </Section>

        <Card>
          <div className="eyebrow">Что взять</div>
          <div className="stack-8" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.5 }} >
            <div>· Питч команды на 7 минут — можно без слайдов</div>
            <div>· Ноутбук, если показываете продукт</div>
            <div className="dim-2">Дресс-код: как в рабочий день, только удобнее.</div>
          </div>
        </Card>

        {going.length > 0 && (
          <Section title="Едут">
            <Card>
              <div className="scroller">
                {going.slice(0, 20).map((u) => (
                  <button key={u.id} className="center" style={{ width: 60 }} onClick={() => go(`/person/${u.id}`)}>
                    <Avatar user={u} size={42} style={{ margin: '0 auto' }} />
                    <div className="t-xs dim-2 ell" style={{ marginTop: 5 }}>{u.name.split(' ')[0]}</div>
                  </button>
                ))}
              </div>
            </Card>
          </Section>
        )}

        <Note icon="video">После слёта здесь появятся фотографии и ролик о сезоне.</Note>

        {!past && (
          <div className="sticky-cta">
            <Btn variant={mine === 'going' ? 'soft' : 'accent'} wide icon={mine === 'going' ? 'check' : undefined} onClick={() => dispatch({ type: 'rsvp', eventId: event.id, status: 'going' })}>
              {mine === 'going' ? 'Вы едете · отменить' : 'Буду'}
            </Btn>
          </div>
        )}
      </div>
    </div>
  );
}
