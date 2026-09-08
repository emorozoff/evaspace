import { useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { TopBar, List, Item, Btn, Section, Sheet, KV, Empty, Note } from '../components/UI.jsx';
import { Avatar } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';
import { serviceById, SERVICE_CATS } from '../data/life.js';
import { REGIONS } from '../data/regions.js';
import { byId } from '../data/people.js';
import { usdExact, plural } from '../lib/format.js';

export default function Service({ id }) {
  const app = useApp();
  const s = serviceById(id);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);
  if (!s) return <Empty title="Услуга не найдена" />;

  const owner = byId(s.owner);
  const cat = SERVICE_CATS.find((c) => c.id === s.cat);
  const where = s.region === 'global' ? 'Везде' : REGIONS[s.region]?.name;

  return (
    <>
      <TopBar title={s.title} sub={cat?.name} backTo="/market" />
      <div className="screen stack-20">
        <div className="row" style={{ gap: 14, paddingTop: 6 }}>
          <div className="item__ic" style={{ width: 56, height: 56, borderRadius: 18 }}><Icon name={cat?.icon || 'gift'} size={26} /></div>
          <div className="grow">
            <h2 className="h2">{s.title}</h2>
            <div className="t-sm dim" style={{ marginTop: 3 }}>{where} · {cat?.name}</div>
          </div>
        </div>

        <div className="display" style={{ fontSize: 32 }}>
          {s.price ? usdExact(s.price) : 'По запросу'} {s.price > 0 && <span className="t-sm dim">/ {s.unit}</span>}
        </div>

        <p className="lead">{s.desc}</p>

        <div className="stats">
          <div className="stat"><div className="stat__v gold">★ {s.rating}</div><div className="stat__l">Оценка</div></div>
          <div className="stat"><div className="stat__v">{s.deals}</div><div className="stat__l">Заказов</div></div>
          <div className="stat"><div className="stat__v cyan">{s.days}</div><div className="stat__l">{plural(s.days, 'День', 'Дня', 'Дней')}</div></div>
        </div>

        <Section title="Кто делает">
          <List>
            <Item lead={<Avatar person={owner} size={46} dot={owner.online} />} title={owner.name} sub={`${owner.company} · в сообществе с ${owner.since}`} onClick={() => go(`/p/${owner.id}`)} />
            <Item icon="message" title="Написать в личку" sub={`Обычно отвечает за ${s.reply} мин`} onClick={() => go(`/dm/${owner.id}`)} />
          </List>
        </Section>

        <div style={{ position: 'sticky', bottom: 'calc(var(--tab-h) + 12px)' }}>
          <Btn variant={sent ? 'ghost' : 'gold'} wide icon={sent ? 'check' : undefined} onClick={() => !sent && setOpen(true)}>
            {sent ? 'Заявка отправлена' : 'Оставить заявку'}
          </Btn>
        </div>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Заявка" sub={owner.company}>
        <div className="stack">
          <textarea className="field" autoFocus placeholder="Что нужно, когда и в каком регионе" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="card" style={{ paddingTop: 2, paddingBottom: 2 }}>
            <KV k="Стоимость" v={s.price ? `${usdExact(s.price)} / ${s.unit}` : 'по запросу'} />
            <KV k="Срок" v={`${s.days} ${plural(s.days, 'день', 'дня', 'дней')}`} />
            <KV k="Ответ обычно за" v={`${s.reply} мин`} />
          </div>
          <Btn variant="gold" wide onClick={() => { app.sendDm(owner.id, text || `Здравствуйте! Интересует услуга «${s.title}».`); setSent(true); setOpen(false); app.say('Заявка ушла в личные сообщения'); }}>
            Отправить
          </Btn>
        </div>
      </Sheet>
    </>
  );
}
