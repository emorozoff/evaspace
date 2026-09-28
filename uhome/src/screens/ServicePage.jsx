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
import { DateTile } from '../components/EventCards.jsx';
import Icon from '../components/Icons.jsx';
import Flag from '../components/Flag.jsx';

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
    <div className="screen screen--nested xsvp">
      <TopBar title={c.name} sub={cat.name} backTo="/services" />

      <div className="stack-24">
        <div className="stack">
          <Brand company={c} height={184}>
            <div className="scene__top">
              <span className="cv-chip" style={{ color: cat.tone }}><Icon name={cat.icon} size={12} />{cat.name}</span>
              <span className="cv-chip" style={{ gap: 4 }}>{c.regions.map((k) => <Flag key={k} cc={REGIONS[k].cc} size={13} />)}</span>
            </div>
            <div className="scene__over xsvp__over">
              <h1 className="xsvp__name">{c.name}</h1>
              <div className="xsvp__tag">{c.tagline}</div>
            </div>
          </Brand>

          <div className="xticket xticket--3">
            <div className="xticket__c">
              <span className="xticket__k">Оценка</span>
              <span className="xticket__v xsvp__rate"><Icon name="star" size={13} fill="currentColor" width={1} />{c.rating.toFixed(1)}</span>
              <span className="xticket__s">резидентов</span>
            </div>
            <div className="xticket__c">
              <span className="xticket__k">Заказов</span>
              <span className="xticket__v">{nf(c.done)}</span>
              <span className="xticket__s">через клуб</span>
            </div>
            <div className="xticket__c">
              <span className="xticket__k">Регионы</span>
              <span className="xticket__v">{String(c.regions.length).padStart(2, '0')}</span>
              <span className="xticket__s">{c.regions.map((k) => REGIONS[k].name).join(', ')}</span>
            </div>
          </div>

          <div className="xperkcard">
            <span className="xperkcard__ic"><Icon name="gift" size={18} /></span>
            <span className="grow">
              <span className="xperkcard__k">Для резидентов</span>
              <span className="xperkcard__t">{c.perk}</span>
            </span>
          </div>
        </div>

        <Section title="О компании">
          <p className="lead">{c.about}</p>
          <div className="wrap">
            {c.regions.map((k) => <span key={k} className="tag tag--line"><Flag cc={REGIONS[k].cc} size={12} /> {REGIONS[k].name}</span>)}
          </div>
        </Section>

        <Section title="Что предлагают" note="Нажмите — заявка на это предложение">
          <div className="xoffers">
            {c.offers.map((o, i) => (
              <button key={o.name} className="xoffer" style={{ '--i': i }} onClick={() => setOrder(i)}>
                <span className="xoffer__n">{String(i + 1).padStart(2, '0')}</span>
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="xoffer__t">{o.name}</span>
                  <span className="xoffer__s">{o.time}</span>
                </span>
                <span className="xoffer__p">{o.price}</span>
              </button>
            ))}
          </div>
        </Section>

        <Section title="Как это работает">
          <ol className="xtl xtl--n">
            {c.steps.map((st, i) => (
              <li key={i} className="xtl__i" style={{ '--i': i }}>
                <span className="xtl__t">{String(i + 1).padStart(2, '0')}</span>
                <span className="xtl__d">{st}</span>
              </li>
            ))}
          </ol>
        </Section>

        {owner && (
          <Section title="Владелец — резидент клуба">
            <List>
              <Item
                lead={<Avatar person={owner} size={46} dot={owner.online} />}
                title={owner.name}
                sub={<>{owner.title} · <Flag cc={REGIONS[owner.region].cc} size={12} /> {owner.city}</>}
                onClick={() => go(`/p/${owner.id}`)}
              />
            </List>
          </Section>
        )}

        {c.reviews?.length > 0 && (
          <Section title="Отзывы резидентов" note={`${c.reviews.length} ${c.reviews.length === 1 ? 'отзыв' : c.reviews.length < 5 ? 'отзыва' : 'отзывов'} · только резиденты`}>
            <div className="stack-8">
              {c.reviews.map((r, i) => {
                const p = byId(r.who);
                return (
                  <div key={i} className="xquote">
                    <div className="xquote__t">{r.text}</div>
                    <button className="row" style={{ gap: 8 }} onClick={() => go(`/p/${p.id}`)}>
                      <Avatar person={p} size={24} />
                      <span className="xquote__who">{p.name} · {p.company}</span>
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
                <Item key={e.id} lead={<DateTile days={e.inDays} />} title={e.title} sub={`${whenLabel(e.inDays, e.time)} · ${e.price}`} onClick={() => go(`/event/${e.id}`)} />
              ))}
            </List>
          </Section>
        )}

        {mine.length > 0 && (
          <div className="note"><Icon name="check" size={16} color="var(--sea)" /><div>Ваши заявки: {mine.map((o) => o.offer).join('; ')}. Ответ — в сообщениях.</div></div>
        )}

        <div className="xcta">
          <Btn variant="gold" className="xcta__main" onClick={() => setOrder(0)}>Оставить заявку</Btn>
          <button className="xcta__ic xcta__ic--wide" onClick={() => go(`/chat/${c.owner}`)} aria-label={`Написать ${owner?.name || 'владельцу'}`}>
            <Icon name="message" size={18} /><span>Написать</span>
          </button>
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
    <div className="stack xorder" style={{ gap: 16 }}>
      <div className="list list--plain">
        {c.offers.map((o, i) => (
          <Item
            key={o.name}
            title={o.name}
            sub={<><span className="xoffer__p xoffer__p--sm">{o.price}</span> · {o.time}</>}
            meta={<span className={`xpick${i === pick ? ' is-on' : ''}`}>{i === pick && <Icon name="check" size={13} width={2.2} />}</span>}
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
