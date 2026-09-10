import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { chatKey, cityStats, nextFridayEvent } from '../lib/logic.js';
import { dateShort } from '../lib/time.js';
import { Avatar, Btn, Card, Empty, List, Item, Note, Section, Sheet, Stat, TopBar } from '../components/UI.jsx';
import EventCard from '../components/EventCard.jsx';

/* Город: двое участников — уже чат и пятница. Дальше они договариваются сами. */

export default function CityPage({ id, now }) {
  const { state, me, dispatch } = useStore();
  const stats = cityStats(state, id);
  const [propose, setPropose] = useState(false);
  const [text, setText] = useState('');
  if (!stats.city) return <div className="screen"><Empty title="Город не найден" /></div>;

  const friday = nextFridayEvent(state, id, now);
  const offer = stats.city.organizerOfferTo === me.id && !stats.city.organizerId;
  const proposals = state.proposals.filter((p) => p.cityId === id).slice(-5).reverse();

  return (
    <div className="screen" style={{ paddingTop: 0 }}>
      <TopBar title={stats.city.name} sub={me.cityId === id ? 'Ваш город' : 'Город клуба'} />
      <div className="stack-20">
        <div className="stats">
          <Stat v={stats.count} l="участников" />
          <Stat v={stats.organizer ? stats.organizer.name.split(' ')[0] : '—'} l="организатор" />
          <Stat v={friday ? dateShort(friday.startsAt).split(' ')[0] : '—'} l={friday ? dateShort(friday.startsAt).split(' ')[1] : 'ближайшая'} />
        </div>

        {!stats.ready && (
          <Card>
            <div className="t-lg">Пока в городе один человек</div>
            <div className="t-sm dim" style={{ marginTop: 4, lineHeight: 1.5 }}>Как только появится второй, сами заведём чат города и поставим в расписание еженедельную пятницу.</div>
            <Btn variant="soft" size="sm" style={{ marginTop: 12 }} icon="gift" onClick={() => go('/invite')}>Пригласить друга</Btn>
          </Card>
        )}

        {offer && (
          <Card variant="accent">
            <div className="t-lg">Станьте организатором</div>
            <div className="t-sm dim" style={{ marginTop: 4, lineHeight: 1.5 }}>Выбираете место и время встречи, можете отменить конкретную неделю. Остальное — сами участники.</div>
            <div className="pair" style={{ marginTop: 12 }}>
              <Btn variant="accent" size="sm" onClick={() => dispatch({ type: 'organizer', cityId: id, accept: true })}>Согласен</Btn>
              <Btn variant="ghost" size="sm" onClick={() => dispatch({ type: 'organizer', cityId: id, accept: false })}>Не сейчас</Btn>
            </div>
          </Card>
        )}

        {friday && (
          <Section title="Ближайшая пятница">
            <EventCard event={friday} now={now} />
          </Section>
        )}

        {stats.ready && !stats.organizer && (
          <Note icon="pin" tone="var(--accent)">
            Организатора нет — место выбирают сами участники.{' '}
            <button className="accent" style={{ fontWeight: 700 }} onClick={() => setPropose(true)}>Предложить место</button>
          </Note>
        )}

        {stats.ready && (
          <Btn variant="ghost" wide icon="message" onClick={() => go(`/chat/${encodeURIComponent(chatKey('city', [id]))}`)}>Чат города</Btn>
        )}

        {proposals.length > 0 && (
          <Section title="Предложения">
            <List>
              {proposals.map((p) => {
                const author = state.users.find((u) => u.id === p.userId);
                return <Item key={p.id} lead={<Avatar user={author} size={36} />} title={p.text} sub={`${author?.name || ''} · ${dateShort(p.at)}`} subWrap chev={false} />;
              })}
            </List>
          </Section>
        )}

        <Section title={`Участники · ${stats.count}`}>
          <List>
            {stats.members.map((u) => (
              <Item key={u.id} lead={<Avatar user={u} size={40} />} title={u.name} sub={u.about} meta={u.id === stats.city.organizerId ? <span className="accent">организатор</span> : undefined} onClick={() => go(`/person/${u.id}`)} />
            ))}
          </List>
        </Section>
      </div>

      <Sheet open={propose} onClose={() => setPropose(false)} title="Предложить место" sub={`Пятница в ${stats.city.nameIn}`}>
        <div className="stack">
          <textarea className="field" placeholder="Идём в боулинг на Ленина, сбор в 20:00" value={text} onChange={(e) => setText(e.target.value)} />
          <Btn variant="accent" wide disabled={text.trim().length < 5} onClick={() => { dispatch({ type: 'propose', cityId: id, text }); setText(''); setPropose(false); }}>Отправить</Btn>
        </div>
      </Sheet>
    </div>
  );
}
