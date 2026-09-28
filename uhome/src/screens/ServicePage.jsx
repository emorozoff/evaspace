import { useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { companyById, catById } from '../data/services.js';
import { byId } from '../data/people.js';
import { REGIONS } from '../data/regions.js';
import { EVENTS } from '../data/events.js';
import { nf, plural } from '../lib/format.js';
import { Brand } from '../components/Covers.jsx';
import { Avatar } from '../components/Art.jsx';
import { EventRow } from '../components/EventCards.jsx';
import { TopBar, Section, List, Item, Btn, Sheet, Empty, Field } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';
import Flag from '../components/Flag.jsx';

/* Компания резидента: что предлагают и почём, бонус для своих, как это
   работает, кто владелец и что говорят резиденты. Заявка уходит владельцу
   в личные сообщения — разговор продолжается там же. */

export default function ServicePage({ id }) {
  const app = useApp();
  const c = companyById(id);
  const [order, setOrder] = useState(null); // индекс выбранного предложения
  if (!c) return <div className="screen screen--nested"><TopBar backTo="/services" /><Empty title="Компания не найдена" /></div>;

  const cat = catById(c.cat);
  const owner = byId(c.owner);
  const events = EVENTS.filter((e) => e.partner === c.id);
  const mine = app.orders.filter((o) => o.company === c.id);

  return (
    <div className="screen screen--nested s-hascta">
      <TopBar title={c.name} sub={cat.name} backTo="/services" />

      <div className="stack-24">
        <div className="stack">
          <Brand company={c} height={150}>
            <div className="scene__top">
              <span className="glass"><Icon name={cat.icon} size={12} /> {cat.name}</span>
              <span className="glass" style={{ gap: 4 }}>{c.regions.map((k) => <Flag key={k} cc={REGIONS[k].cc} size={13} />)}</span>
            </div>
          </Brand>
          <h1 className="h2" style={{ marginTop: 6 }}>{c.name}</h1>
          <p className="lead">{c.tagline}</p>
          <div className="strip">
            <div><span className="strip__v">{c.rating.toFixed(1)}</span><span className="strip__k">оценка</span></div>
            <div><span className="strip__v">{nf(c.done)}</span><span className="strip__k">{plural(c.done, 'заказ', 'заказа', 'заказов')}</span></div>
            <div><span className="strip__v">{c.regions.length}</span><span className="strip__k">{plural(c.regions.length, 'регион', 'региона', 'регионов')}</span></div>
          </div>
          <div className="note"><Icon name="gift" size={16} color="var(--gold)" /><div><b style={{ color: 'var(--ink)', fontWeight: 600 }}>Для резидентов.</b> {c.perk}</div></div>
        </div>

        <Section title="О компании">
          <p className="lead">{c.about}</p>
          <div className="t-sm dim-2">{c.regions.map((k) => REGIONS[k].name).join(' · ')}</div>
        </Section>

        <Section title="Что предлагают" note="Нажмите — заявка на это предложение">
          <div className="rows">
            {c.offers.map((o, i) => (
              <button key={o.name} className="rows__r" style={{ width: '100%' }} onClick={() => setOrder(i)}>
                <span className="rows__k">{o.name}<i>{o.time}</i></span>
                <span className="rows__v">{o.price}</span>
              </button>
            ))}
          </div>
        </Section>

        <Section title="Как это работает">
          <div className="steps">
            {c.steps.map((st, i) => <div key={i} className="step"><span className="step__n">{String(i + 1).padStart(2, '0')}</span><span className="step__t">{st}</span></div>)}
          </div>
        </Section>

        {owner && (
          <Section title="Владелец — резидент клуба">
            <List>
              <Item lead={<Avatar person={owner} size={42} dot={owner.online} />} title={owner.name} sub={<>{owner.title} · <Flag cc={REGIONS[owner.region].cc} size={12} /> {owner.city}</>} onClick={() => go(`/p/${owner.id}`)} />
            </List>
          </Section>
        )}

        {c.reviews?.length > 0 && (
          <Section title="Отзывы резидентов" note={`${c.reviews.length} ${plural(c.reviews.length, 'отзыв', 'отзыва', 'отзывов')} · только резиденты`}>
            <List>
              {c.reviews.map((r, i) => {
                const p = byId(r.who);
                return <Item key={i} lead={<Avatar person={p} size={36} />} title={p.name} sub={r.text} subWrap chev={false} onClick={() => go(`/p/${p.id}`)} />;
              })}
            </List>
          </Section>
        )}

        {events.length > 0 && (
          <Section title="События компании">
            <List>{events.map((e) => <EventRow key={e.id} app={app} event={e} />)}</List>
          </Section>
        )}

        {mine.length > 0 && <div className="note-line">Ваши заявки: {mine.map((o) => o.offer).join('; ')}. Ответ придёт в сообщения.</div>}
      </div>

      <div className="s-cta">
        <Btn variant="gold" className="grow" onClick={() => setOrder(0)}>Оставить заявку</Btn>
        <button className="s-cta__ic" onClick={() => go(`/chat/${c.owner}`)} aria-label="Написать владельцу"><Icon name="message" size={19} /></button>
      </div>

      <Sheet open={order !== null} onClose={() => setOrder(null)} title="Заявка" sub={`Уйдёт владельцу в сообщения — там же придёт ответ.`}>
        {order !== null && <OrderForm app={app} c={c} start={order} onDone={() => setOrder(null)} />}
      </Sheet>
    </div>
  );
}

function OrderForm({ app, c, start, onDone }) {
  const [pick, setPick] = useState(start);
  const [note, setNote] = useState('');
  const offer = c.offers[pick];

  const submit = () => {
    const text = `Заявка из UHOME: «${offer.name}» (${offer.price}).${note.trim() ? ` ${note.trim()}` : ''}`;
    app.order(c.id, offer.name, note.trim());
    app.send(c.owner, text, { reply: `Спасибо! Заявку на «${offer.name}» вижу, вернусь с деталями сегодня.` });
    app.say('Заявка отправлена — ответ придёт в сообщения');
    onDone();
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="list list--plain">
        {c.offers.map((o, i) => (
          <Item key={o.name} title={o.name} sub={`${o.price} · ${o.time}`} meta={i === pick ? <Icon name="check" size={18} color="var(--gold)" /> : ''} chev={false} onClick={() => setPick(i)} />
        ))}
      </div>
      <Field label="Комментарий" hint="Даты, адрес, сколько человек — всё, что поможет ответить сразу">
        <textarea className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Например: нужно с 1 ноября, вилла в Чангу" />
      </Field>
      <div className="note-line">{c.perk} — применится автоматически.</div>
      <Btn variant="gold" wide onClick={submit}>Отправить заявку</Btn>
    </div>
  );
}
