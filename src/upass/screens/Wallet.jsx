import { useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { Top, List, Item, Btn, Section, Bar, Tag, Note } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';
import { TIERS } from '../data/canon.js';
import { SERVICES } from '../data/life.js';
import { usdExact, nf } from '../lib/format.js';

export default function Wallet() {
  const app = useApp();
  const tier = TIERS.find((t) => t.n === app.me.tier) || TIERS[0];
  const refs = 2;
  const code = (app.me.handle || 'you').toUpperCase() + '-' + (app.me.number || '').slice(-4);
  const [copied, setCopied] = useState(false);
  const canRenew = app.points >= (tier.price || 0) * 100;

  return (
    <div className="screen stack-20">
      <Top title="Баллы" sub="100 баллов = $1 · не токен и не доля" right={<button className="iconbtn" onClick={() => go('/club')}><Icon name="back" size={18} /></button>} />

      <div className="card card--gold">
        <div className="eyebrow eyebrow--gold">Баланс</div>
        <div className="row" style={{ alignItems: 'baseline', gap: 8, marginTop: 6 }}><div className="display" style={{ fontSize: 38 }}>{nf(app.points)}</div><div className="t-md gold">= {usdExact(app.points / 100, 2)}</div></div>
        <div className="row" style={{ gap: 10, marginTop: 14 }}>
          <Btn variant="gold" wide disabled={!canRenew} onClick={() => app.spendPoints((tier.price || 0) * 100, 'продление членства')}>Продлить {tier.name}</Btn>
          <Btn variant="quiet" onClick={() => go('/market')}>Потратить</Btn>
        </div>
        {!canRenew && tier.price > 0 && <div className="t-xs dim-2" style={{ marginTop: 10 }}>До продления не хватает {nf(tier.price * 100 - app.points)} баллов</div>}
      </div>

      <Section title="Приглашения · 5 = год бесплатно">
        <div className="card">
          <div className="spread"><span className="t-sm">Принято по вашей рекомендации</span><span className="t-md gold">{refs} / 5</span></div>
          <div style={{ marginTop: 10 }}><Bar value={refs / 5} /></div>
        </div>
        <List>
          <Item icon="share" title={`upass.club/i/${code}`} sub={copied ? 'Скопировано' : 'Нажмите, чтобы скопировать ссылку'} chev={false} onClick={() => { navigator.clipboard?.writeText(`https://upass.club/i/${code}`).catch(() => {}); setCopied(true); app.say('Ссылка скопирована'); }} />
        </List>
      </Section>

      <Section title="Как начисляются">
        <List>
          <Item icon="gift" title="Кэшбэк с услуг резидентов" sub="От 3 до 15% — процент задаёт партнёр" chev={false} />
          <Item icon="calendar" title="События" sub="+80 за запись, +150 за отметку на входе" chev={false} />
          <Item icon="users" title="Приглашённые" sub="+5000 за каждого принятого и оплатившего" chev={false} />
          <Item icon="cup" title="Встречи" sub="+120 за подтверждённую обеими сторонами" chev={false} />
        </List>
      </Section>

      <Section title="Лучший кэшбэк">
        <List>
          {[...SERVICES].sort((a, b) => b.cashback - a.cashback).slice(0, 4).map((s) => (
            <Item key={s.id} icon="gift" title={s.title} sub={s.price ? `${usdExact(s.price)} за ${s.unit}` : 'по запросу'} meta={<Tag tone="gold">{s.cashback}%</Tag>} chev={false} onClick={() => go(`/service/${s.id}`)} />
          ))}
        </List>
      </Section>
    </div>
  );
}
