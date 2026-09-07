import { useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { Card, Btn, Section, Sheet, KV, Chip, Empty } from '../components/UI.jsx';
import { Avatar } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';
import { RESIDENTS, byId } from '../data/people.js';
import { usdExact, nf, pct } from '../lib/format.js';

export default function Heritage() {
  const app = useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [rel, setRel] = useState('Супруг(а)');
  const [share, setShare] = useState(100);

  const heirs = app.heirs || [];
  const value = app.me.uht * app.pf.price;

  const add = () => {
    if (!name.trim()) return;
    app.setHeirs([...heirs, { id: 'h' + Date.now(), name: name.trim(), rel, share }]);
    app.say('Наследник назначен. Оформление — через устав кооператива');
    setOpen(false);
    setName('');
  };

  return (
    <div className="screen stack-22">
      <div>
        <div className="eyebrow">Преемственность</div>
        <h2 className="display" style={{ marginTop: 3 }}>Наследие</h2>
        <p className="t-sm dim" style={{ marginTop: 8, lineHeight: 1.55 }}>
          Наше поколение первым оставляет значимый цифровой след, а механизмов передачи почти нет.
          Здесь назначается, кому перейдёт доля, доступ и знание — и что не передаётся никому.
        </p>
      </div>

      <Card variant="gold">
        <div className="eyebrow eyebrow--gold">К передаче сегодня</div>
        <div className="display" style={{ fontSize: 34, marginTop: 6 }}>{usdExact(Math.round(value))}</div>
        <div className="t-sm dim">{nf(app.me.uht, 1)} UHT · {pct(app.me.uht / app.pf.supply, 3)} портфеля кооператива</div>
      </Card>

      <Section eyebrow="Что переходит" title="Три части наследства">
        <div className="stack-8">
          <Part icon="coin" title="Доля" text="Токены переходят наследнику без выхода из портфеля: активы не продаются, кооператив не теряет ликвидность. Оформление — через устав." tone="#D7B06A" />
          <Part icon="passport" title="Доступ" text="Уровень членства и место в круге сохраняются за семьёй. Цифровое древо связывает профили поколений." tone="#5FE0C8" />
          <Part icon="book" title="Знание" text="Архив материалов, решений и контактов, который наследник получает вместе с долей." tone="#8E7BF5" />
          <Part icon="lock" title="Что не переходит" text="Степень. Она зарабатывается встречами и поручительствами — наследовать доверие нельзя. Это решение принято собранием." tone="#FF7A6E" />
        </div>
      </Section>

      <Section eyebrow="Назначены" title="Наследники" more="Добавить" onMore={() => setOpen(true)}>
        {heirs.length === 0 ? (
          <Empty
            icon="shield"
            title="Наследники не назначены"
            text="Пока их нет, доля в случае утраты резидента поступает в общую очередь выкупа по правилам устава."
            action={<Btn variant="gold" size="sm" onClick={() => setOpen(true)}>Назначить</Btn>}
          />
        ) : (
          <div className="stack-8">
            {heirs.map((h) => (
              <Card key={h.id} className="row" style={{ gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 999, flex: 'none', display: 'grid', placeItems: 'center', background: 'var(--panel-2)', color: 'var(--gold)', fontWeight: 700 }}>
                  {h.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="grow">
                  <div className="t-md">{h.name}</div>
                  <div className="t-xs dim">{h.rel} · {h.share}% доли</div>
                </div>
                <button className="iconbtn" onClick={() => app.setHeirs(heirs.filter((x) => x.id !== h.id))}>
                  <Icon name="x" size={15} />
                </button>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section eyebrow="Цифровое древо" title="Поколения в клубе">
        <Card>
          <div className="row" style={{ gap: 12, justifyContent: 'center', padding: '8px 0' }}>
            <Node label="Вы" tone="var(--gold)" me person={app.me} />
            <div style={{ width: 26, height: 1, background: 'var(--line-2)' }} />
            {heirs.length ? (
              heirs.slice(0, 2).map((h) => <Node key={h.id} label={h.name.split(' ')[0]} tone="var(--cyan)" />)
            ) : (
              <Node label="—" tone="var(--ink-4)" />
            )}
          </div>
          <div className="t-xs dim center" style={{ marginTop: 10, lineHeight: 1.5 }}>
            Древо связывает профили поколений: наследник видит, что его доля пришла от вас,
            и историю участия семьи в круге.
          </div>
        </Card>
      </Section>

      <Card className="row-t" style={{ gap: 11 }}>
        <Icon name="shield" size={17} color="var(--ink-3)" />
        <div className="t-xs dim" style={{ lineHeight: 1.5 }}>
          Назначение в приложении — это воля резидента, а не юридический документ. Оформление
          идёт через устав кооператива и структуру владения; юридический круг клуба помогает
          бесплатно. Вопросы — к куратору круга «Право и структуры».
        </div>
      </Card>

      <Sheet open={open} onClose={() => setOpen(false)} eyebrow="Воля резидента" title="Назначить наследника">
        <div className="stack-16">
          <input className="field" autoFocus placeholder="Имя и фамилия" value={name} onChange={(e) => setName(e.target.value)} />
          <div>
            <div className="label">Кем приходится</div>
            <div className="wrap">
              {['Супруг(а)', 'Ребёнок', 'Родитель', 'Партнёр', 'Другое'].map((r) => (
                <Chip key={r} on={rel === r} onClick={() => setRel(r)}>{r}</Chip>
              ))}
            </div>
          </div>
          <div>
            <div className="label">Доля наследства</div>
            <div className="wrap">
              {[100, 75, 50, 25].map((v) => (
                <Chip key={v} on={share === v} onClick={() => setShare(v)}>{v}%</Chip>
              ))}
            </div>
          </div>
          <Btn variant="gold" wide onClick={add}>Назначить</Btn>
        </div>
      </Sheet>
    </div>
  );
}

function Part({ icon, title, text, tone }) {
  return (
    <Card className="row-t" style={{ gap: 12 }}>
      <div style={{ width: 32, height: 32, borderRadius: 11, flex: 'none', display: 'grid', placeItems: 'center', background: `${tone}1c`, color: tone }}>
        <Icon name={icon} size={16} />
      </div>
      <div>
        <div className="t-md">{title}</div>
        <div className="t-xs dim" style={{ marginTop: 3, lineHeight: 1.5 }}>{text}</div>
      </div>
    </Card>
  );
}

function Node({ label, tone, me, person }) {
  return (
    <div className="center" style={{ width: 66 }}>
      {me ? (
        <Avatar person={person} size={44} ring={tone} style={{ margin: '0 auto' }} />
      ) : (
        <div style={{ width: 44, height: 44, margin: '0 auto', borderRadius: 999, border: `1.5px dashed ${tone}`, display: 'grid', placeItems: 'center', color: tone, fontWeight: 700 }}>
          {label.slice(0, 1)}
        </div>
      )}
      <div className="t-xs dim" style={{ marginTop: 7 }}>{label}</div>
    </div>
  );
}
