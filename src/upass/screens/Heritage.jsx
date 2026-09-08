import { useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { Top, List, Item, Btn, Section, Sheet, Chip, Empty, Note } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';
import { usdExact, nf, pct } from '../lib/format.js';

export default function Heritage() {
  const app = useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [rel, setRel] = useState('Супруг(а)');
  const [share, setShare] = useState(100);
  const heirs = app.heirs || [];
  const value = app.me.uht * app.pf.price;

  return (
    <div className="screen stack-20">
      <Top title="Наследие" sub="Кому перейдёт доля, доступ и знание" right={<button className="iconbtn" onClick={() => go('/club')}><Icon name="back" size={18} /></button>} />

      <div className="card card--gold">
        <div className="eyebrow eyebrow--gold">К передаче сегодня</div>
        <div className="display" style={{ fontSize: 34, marginTop: 6 }}>{usdExact(Math.round(value))}</div>
        <div className="t-sm dim">{nf(app.me.uht, 1)} UHT · {pct(app.me.uht / app.pf.supply, 3)} портфеля</div>
      </div>

      <Section title="Наследники" more="Добавить" onMore={() => setOpen(true)}>
        {heirs.length === 0 ? (
          <Empty icon="shield" title="Наследники не назначены" text="Без назначения доля поступает в общую очередь выкупа по уставу." action={<Btn variant="gold" size="sm" onClick={() => setOpen(true)}>Назначить</Btn>} />
        ) : (
          <List>
            {heirs.map((h) => (
              <Item key={h.id} lead={<div className="item__ic" style={{ borderRadius: '50%', fontWeight: 700 }}>{h.name.slice(0, 1).toUpperCase()}</div>} title={h.name} sub={`${h.rel} · ${h.share}% доли`} meta={<button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => app.setHeirs(heirs.filter((x) => x.id !== h.id))}><Icon name="x" size={13} /></button>} chev={false} />
            ))}
          </List>
        )}
      </Section>

      <Section title="Что переходит">
        <List>
          <Item icon="coin" title="Доля" sub="Токены переходят без выхода из портфеля: активы не продаются, кооператив не теряет ликвидность" subWrap chev={false} />
          <Item icon="passport" title="Доступ" sub="Уровень членства и место в круге сохраняются за семьёй" subWrap chev={false} />
          <Item icon="book" title="Знание" sub="Архив материалов, решений и контактов — вместе с долей" subWrap chev={false} />
          <Item icon="lock" title="Не переходит: степень" sub="Доверие зарабатывается встречами и поручительствами. Решение принято собранием" subWrap chev={false} />
        </List>
      </Section>

      <Note icon="shield">Назначение в приложении — воля резидента, не юридический документ. Оформление идёт через устав; юридический круг помогает бесплатно.</Note>

      <Sheet open={open} onClose={() => setOpen(false)} title="Назначить наследника">
        <div className="stack">
          <input className="field" autoFocus placeholder="Имя и фамилия" value={name} onChange={(e) => setName(e.target.value)} />
          <div><div className="label">Кем приходится</div><div className="wrap">{['Супруг(а)', 'Ребёнок', 'Родитель', 'Партнёр', 'Другое'].map((r) => <Chip key={r} on={rel === r} onClick={() => setRel(r)}>{r}</Chip>)}</div></div>
          <div><div className="label">Доля наследства</div><div className="wrap">{[100, 75, 50, 25].map((v) => <Chip key={v} on={share === v} onClick={() => setShare(v)}>{v}%</Chip>)}</div></div>
          <Btn variant="gold" wide disabled={!name.trim()} onClick={() => { app.setHeirs([...heirs, { id: 'h' + Date.now(), name: name.trim(), rel, share }]); app.say('Наследник назначен'); setOpen(false); setName(''); }}>Назначить</Btn>
        </div>
      </Sheet>
    </div>
  );
}
