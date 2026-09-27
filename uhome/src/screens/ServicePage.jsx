import { useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { companyById, catById } from '../data/services.js';
import { byId } from '../data/people.js';
import { REGIONS } from '../data/regions.js';
import { EVENTS } from '../data/events.js';
import { nf, whenLabel } from '../lib/format.js';
import { Brand } from '../components/Covers.jsx';
import { Avatar } from '../components/Art.jsx';
import { TopBar, Section, List, Item, Btn, Sheet, Empty, Field } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';

/* Карточка компании резидента: что предлагают и почём, бонус для своих,
   как это работает, кто владелец и что говорят резиденты. Заявка уходит
   владельцу в личные сообщения — разговор продолжается там же. */

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
    <div className="screen screen--nested">
      <TopBar title={c.name} sub={cat.name} backTo="/services" />

      <div className="stack-24">
        <div className="stack">
          <Brand company={c} height={176}>
            <div className="scene__top">
              <span className="glass" style={{ color: cat.tone }}><Icon name={cat.icon} size={13} />{cat.name}</span>
              <span className="glass">{c.regions.map((k) => REGIONS[k].flag).join(' ')}</span>
            </div>
            <div className="scene__over">
              <h1 className="h1" style={{ fontSize: 38 }}>{c.name}</h1>
              <div className="t-sm" style={{ color: 'rgba(255,255,255,.8)', marginTop: 4 }}>{c.tagline}</div>
            </div>
          </Brand>

          <div className="stats">
            <div className="stat"><div className="stat__v" style={{ color: 'var(--gold)' }}>★ {c.rating.toFixed(1)}</div><div className="stat__l">оценка резидентов</div></div>
            <div className="stat"><div className="stat__v">{nf(c.done)}</div><div className="stat__l">заказов</div></div>
            <div className="stat"><div className="stat__v">{c.regions.length}</div><div className="stat__l">{c.regions.length === 1 ? 'регион' : 'региона'}</div></div>
          </div>

          <div className="card card--sea row" style={{ gap: 12 }}>
            <div className="item__ic" style={{ background: 'var(--sea-soft)', color: 'var(--sea)' }}><Icon name="gift" size={19} /></div>
            <div className="grow">
              <div className="eyebrow" style={{ color: 'var(--sea)' }}>Для резидентов</div>
              <div className="t-md" style={{ marginTop: 3 }}>{c.perk}</div>
            </div>
          </div>
        </div>

        <Section title="О компании">
          <p className="lead">{c.about}</p>
          <div className="wrap">
            {c.regions.map((k) => <span key={k} className="tag tag--line">{REGIONS[k].flag} {REGIONS[k].name}</span>)}
          </div>
        </Section>

        <Section title="Что предлагают" note="Нажмите — заявка на это предложение">
          <div className="list">
            {c.offers.map((o, i) => (
              <button key={o.name} className="offer" style={{ width: '100%' }} onClick={() => setOrder(i)}>
                <div className="grow">
                  <div className="t-md" style={{ lineHeight: 1.3 }}>{o.name}</div>
                  <div className="t-xs dim-2" style={{ marginTop: 3 }}>{o.time}</div>
                </div>
                <div className="offer__price">{o.price}</div>
              </button>
            ))}
          </div>
        </Section>

        <Section title="Как это работает">
          <div className="card steps">
            {c.steps.map((s, i) => (
              <div key={i} className="step">
                <span className="step__n">{i + 1}</span>
                <span className="step__t">{s}</span>
              </div>
            ))}
          </div>
        </Section>

        {owner && (
          <Section title="Владелец — резидент клуба">
            <List>
              <Item
                lead={<Avatar person={owner} size={46} dot={owner.online} />}
                title={owner.name}
                sub={`${owner.title} · ${REGIONS[owner.region].flag} ${owner.city}`}
                onClick={() => go(`/p/${owner.id}`)}
              />
            </List>
          </Section>
        )}

        {c.reviews?.length > 0 && (
          <Section title="Отзывы резидентов">
            <div className="stack-8">
              {c.reviews.map((r, i) => {
                const p = byId(r.who);
                return (
                  <div key={i} className="quote">
                    <div className="quote__t">«{r.text}»</div>
                    <button className="row" style={{ gap: 8 }} onClick={() => go(`/p/${p.id}`)}>
                      <Avatar person={p} size={26} />
                      <span className="t-xs dim">{p.name} · {p.company}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {events.length > 0 && (
          <Section title="События компании">
            <List>
              {events.map((e) => (
                <Item key={e.id} icon="calendar" title={e.title} sub={`${whenLabel(e.inDays, e.time)} · ${e.price}`} onClick={() => go(`/event/${e.id}`)} />
              ))}
            </List>
          </Section>
        )}

        {mine.length > 0 && (
          <div className="note"><Icon name="check" size={16} color="var(--sea)" /><div>Ваши заявки: {mine.map((o) => o.offer).join('; ')}. Ответ — в сообщениях.</div></div>
        )}

        <div className="pair pair--wide">
          <Btn variant="gold" onClick={() => setOrder(0)}>Оставить заявку</Btn>
          <Btn variant="ghost" icon="message" onClick={() => go(`/chat/${c.owner}`)}>Написать</Btn>
        </div>
      </div>

      <Sheet open={order !== null} onClose={() => setOrder(null)} title="Заявка" sub={`Уйдёт ${owner?.name.split(' ')[0] || 'владельцу'} в сообщения — там же придёт ответ.`}>
        {order !== null && <OrderForm app={app} c={c} owner={owner} start={order} onDone={() => setOrder(null)} />}
      </Sheet>
    </div>
  );
}

function OrderForm({ app, c, owner, start, onDone }) {
  const [pick, setPick] = useState(start);
  const [note, setNote] = useState('');
  const offer = c.offers[pick];

  const submit = () => {
    const text = `Заявка из UHOME: «${offer.name}» (${offer.price}).${note.trim() ? ` ${note.trim()}` : ''}`;
    app.order(c.id, offer.name, note.trim());
    app.send(c.owner, text, { reply: `Спасибо! Заявку на «${offer.name}» вижу, вернусь с деталями сегодня.` });
    app.say(`Заявка отправлена — ответ придёт в сообщения`);
    onDone();
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="list list--plain">
        {c.offers.map((o, i) => (
          <Item
            key={o.name}
            title={o.name}
            sub={`${o.price} · ${o.time}`}
            meta={i === pick ? <Icon name="check" size={18} color="var(--gold)" /> : undefined}
            chev={false}
            onClick={() => setPick(i)}
          />
        ))}
      </div>
      <Field label="Комментарий" hint="Даты, адрес, сколько человек — всё, что поможет ответить сразу">
        <textarea className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Например: нужно с 1 ноября, вилла в Чангу" />
      </Field>
      <div className="note"><Icon name="gift" size={16} color="var(--sea)" /><div>{c.perk} — применится автоматически.</div></div>
      <Btn variant="gold" wide onClick={submit}>Отправить заявку</Btn>
    </div>
  );
}
