import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { Card, Btn, Section, KV, Bar, Tag } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';
import { TIERS } from '../data/canon.js';
import { SERVICES } from '../data/life.js';
import { usdExact, nf, plural } from '../lib/format.js';

const EARN = [
  { icon: 'gift', title: 'Кэшбэк с услуг резидентов', text: 'От 3 до 15% суммы, процент задаёт партнёр' },
  { icon: 'calendar', title: 'Участие в событиях', text: '+80 за запись, +150 за отметку на входе' },
  { icon: 'users', title: 'Приглашённые резиденты', text: '+5000 за каждого принятого и оплатившего' },
  { icon: 'cup', title: 'Подтверждённые встречи', text: '+120 за встречу, подтверждённую обеими сторонами' },
];

export default function Wallet() {
  const app = useApp();
  const tier = TIERS.find((t) => t.n === app.me.tier) || TIERS[0];
  const refs = 2;
  const code = (app.me.handle || 'you').toUpperCase() + '-' + (app.me.number || '').slice(-4);
  const [copied, setCopied] = useState(false);

  const yearCovered = Math.min(1, refs / 5);
  const canRenew = app.points >= (tier.price || 0) * 100;

  const copy = () => {
    navigator.clipboard?.writeText(`https://upass.club/i/${code}`).catch(() => {});
    setCopied(true);
    app.say('Ссылка скопирована');
  };

  return (
    <div className="screen stack-22">
      <div>
        <div className="eyebrow">Бонусная программа</div>
        <h2 className="display" style={{ marginTop: 3 }}>Баллы и приглашения</h2>
      </div>

      <Card variant="gold">
        <div className="eyebrow eyebrow--gold">Баланс</div>
        <div className="row" style={{ alignItems: 'baseline', gap: 10, marginTop: 6 }}>
          <div className="display" style={{ fontSize: 40 }}>{nf(app.points)}</div>
          <div className="t-md gold">баллов</div>
        </div>
        <div className="t-sm dim">= {usdExact(app.points / 100, 2)} · курс фиксирован: 100 баллов = $1</div>
        <div className="row" style={{ gap: 10, marginTop: 16 }}>
          <Btn variant="gold" wide disabled={!canRenew} onClick={() => app.spendPoints((tier.price || 0) * 100, 'продление членства')}>
            Продлить членство
          </Btn>
          <Btn variant="quiet" onClick={() => go('/market')}>Потратить</Btn>
        </div>
        {!canRenew && tier.price > 0 && (
          <div className="t-xs dim-2" style={{ marginTop: 10 }}>
            До продления {tier.name} не хватает {nf(tier.price * 100 - app.points)} баллов
          </div>
        )}
      </Card>

      <Section eyebrow="Реферальная программа" title="Пять приглашённых — год бесплатно">
        <Card>
          <div className="spread">
            <div className="t-sm">Принято по вашей рекомендации</div>
            <div className="t-md gold">{refs} / 5</div>
          </div>
          <div style={{ marginTop: 10 }}><Bar value={yearCovered} /></div>
          <div className="t-xs dim" style={{ marginTop: 9, lineHeight: 1.45 }}>
            За каждого принятого и оплатившего друга — фиксированный бонус на счёт.
            Пять приглашённых полностью закрывают следующий год членства.
          </div>
          <button className="card tap row" style={{ marginTop: 14, background: 'var(--panel-2)' }} onClick={copy}>
            <div className="grow">
              <div className="eyebrow">Ваш код</div>
              <div className="mono gold" style={{ marginTop: 4, fontSize: 13 }}>upass.club/i/{code}</div>
            </div>
            <Icon name={copied ? 'check' : 'share'} size={17} color="var(--gold)" />
          </button>
        </Card>
      </Section>

      <Section eyebrow="Как начисляются" title="Источники баллов">
        <div className="stack-8">
          {EARN.map((e) => (
            <Card key={e.title} className="row-t" style={{ gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 11, flex: 'none', display: 'grid', placeItems: 'center', background: 'var(--panel-2)', color: 'var(--gold)' }}>
                <Icon name={e.icon} size={16} />
              </div>
              <div>
                <div className="t-sm" style={{ fontWeight: 600 }}>{e.title}</div>
                <div className="t-xs dim" style={{ marginTop: 2 }}>{e.text}</div>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Section eyebrow="Лучший кэшбэк" title="Где вернётся больше">
        <div className="stack-8">
          {[...SERVICES].sort((a, b) => b.cashback - a.cashback).slice(0, 4).map((s) => (
            <button key={s.id} className="card tap spread" onClick={() => go(`/service/${s.id}`)}>
              <div>
                <div className="t-sm">{s.title}</div>
                <div className="t-xs dim-2" style={{ marginTop: 2 }}>{s.price ? usdExact(s.price) : 'по запросу'} · за {s.unit}</div>
              </div>
              <Tag tone="gold">{s.cashback}%</Tag>
            </button>
          ))}
        </div>
      </Section>

      <Card className="row-t" style={{ gap: 11 }}>
        <Icon name="coin" size={17} color="var(--ink-3)" />
        <div className="t-xs dim" style={{ lineHeight: 1.5 }}>
          Баллы — это программа лояльности, а не токен. Они не дают доли в активах, не растут
          вместе с NAV и не участвуют в голосовании. Смешивать их с UHT в интерфейсе нельзя.
        </div>
      </Card>
    </div>
  );
}
