import { useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { TopBar, List, Item, Btn, Section, Sheet, KV, Empty, Note } from '../components/UI.jsx';
import { Avatar } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';
import { serviceById, SERVICE_CATS } from '../data/life.js';
import { CITIES } from '../data/places.js';
import { byId } from '../data/people.js';
import { CAT_ICON } from './Market.jsx';
import { usdExact, nf, plural } from '../lib/format.js';

export default function Service({ id }) {
  const app = useApp();
  const s = serviceById(id);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  if (!s) return <Empty title="Услуга не найдена" />;

  const owner = byId(s.owner);
  const cat = SERVICE_CATS.find((c) => c.id === s.cat);
  const city = CITIES[s.city];
  const sent = app.requests.some((r) => r.service === s.id);
  const cashback = Math.round((s.price * s.cashback) / 100);

  return (
    <>
      <TopBar title={s.title} sub={cat?.name} backTo="/market" />
      <div className="screen stack-20">
        <div className="row" style={{ gap: 14, paddingTop: 6 }}>
          <div className="item__ic" style={{ width: 56, height: 56, borderRadius: 16 }}><Icon name={CAT_ICON[s.cat]} size={26} /></div>
          <div className="grow">
            <h2 className="h2">{s.title}</h2>
            <div className="t-sm dim" style={{ marginTop: 3 }}>{city.flag} {city.name} · {cat?.name}</div>
          </div>
        </div>

        <div className="spread">
          <div className="display" style={{ fontSize: 32 }}>{s.price ? usdExact(s.price) : 'По запросу'} {s.price > 0 && <span className="t-sm dim">/ {s.unit}</span>}</div>
          {cashback > 0 && <span className="tag tag--gold" style={{ fontSize: 12 }}>+{nf(cashback * 100)} баллов</span>}
        </div>

        <p className="lead">{s.desc}</p>

        <div className="stats">
          <div className="stat"><div className="stat__v gold">★ {s.rating}</div><div className="stat__l">Оценка</div></div>
          <div className="stat"><div className="stat__v">{s.deals}</div><div className="stat__l">Заказов</div></div>
          <div className="stat"><div className="stat__v cyan">{s.reply}</div><div className="stat__l">Ответ, мин</div></div>
        </div>

        <Section title="Партнёр">
          <List>
            <Item lead={<Avatar person={owner} size={46} dot={owner.online} />} title={owner.name} sub={`${owner.company} · ${owner.vouches} ${plural(owner.vouches, 'поручительство', 'поручительства', 'поручительств')}`} onClick={() => go(`/p/${owner.id}`)} />
            <Item icon="message" title="Написать партнёру" sub="Личное сообщение" onClick={() => go(`/dm/${owner.id}`)} />
          </List>
        </Section>

        <Note icon="shield">Внутри круга не продают того, во что не верят сами. Партнёр отвечает репутацией: жалоба попадает в цепочку.</Note>

        <div style={{ position: 'sticky', bottom: 'calc(var(--tab-h) + 12px)' }}>
          <Btn variant={sent ? 'ghost' : 'gold'} wide icon={sent ? 'check' : undefined} onClick={() => !sent && setOpen(true)}>{sent ? 'Заявка отправлена' : 'Оставить заявку'}</Btn>
        </div>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Заявка партнёру" sub={owner.company}>
        <div className="stack">
          <textarea className="field" autoFocus placeholder="Что нужно, когда и в каком городе" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="card" style={{ paddingTop: 2, paddingBottom: 2 }}>
            <KV k="Стоимость" v={s.price ? `${usdExact(s.price)} / ${s.unit}` : 'по запросу'} />
            <KV k="Вернётся баллами" v={`${nf(cashback * 100)} (${usdExact(cashback)})`} tone="var(--cyan)" />
          </div>
          <Btn variant="gold" wide onClick={() => { app.requestService(s, text || 'Здравствуйте! Интересует ваша услуга.'); setOpen(false); setText(''); }}>Отправить</Btn>
        </div>
      </Sheet>
    </>
  );
}
