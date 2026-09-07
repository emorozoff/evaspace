import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { Card, Chip, Scroller, Search, Section, Empty, Bar } from '../components/UI.jsx';
import { Cover, Avatar, Ring } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';
import { SERVICES, SERVICE_CATS } from '../data/life.js';
import { CITIES } from '../data/places.js';
import { byId } from '../data/people.js';
import { spendTotals } from '../lib/select.js';
import { usd, usdExact, pct, nf, plural } from '../lib/format.js';

export default function Market() {
  const app = useApp();
  const [cat, setCat] = useState('all');
  const [city, setCity] = useState('all');
  const [q, setQ] = useState('');

  const spend = useMemo(() => spendTotals(app.extraSpend), [app.extraSpend]);

  const list = useMemo(() => {
    let out = SERVICES;
    if (cat !== 'all') out = out.filter((s) => s.cat === cat);
    if (city !== 'all') out = out.filter((s) => s.city === city);
    if (q.trim()) {
      const t = q.toLowerCase();
      out = out.filter((s) => s.title.toLowerCase().includes(t) || s.desc.toLowerCase().includes(t));
    }
    return out;
  }, [cat, city, q]);

  const cities = useMemo(() => [...new Set(SERVICES.map((s) => s.city))], []);

  return (
    <div className="screen stack-16">
      <div>
        <div className="eyebrow">Внутренняя экономика</div>
        <h2 className="display" style={{ marginTop: 3 }}>Услуги резидентов</h2>
      </div>

      <Card variant="gold">
        <div className="row" style={{ gap: 16 }}>
          <Ring value={spend.share} size={84} stroke={7}>
            <div>
              <div className="display" style={{ fontSize: 19 }}>{pct(spend.share)}</div>
              <div className="eyebrow" style={{ fontSize: 7.5 }}>внутри</div>
            </div>
          </Ring>
          <div className="grow">
            <div className="t-md">Цель круга — 80% трат внутри</div>
            <div className="t-xs dim" style={{ marginTop: 5, lineHeight: 1.45 }}>
              Мы ходим в рестораны резидентов, арендуем у резидентов, лечимся и снимаем у резидентов.
              Деньги остаются в круге и возвращаются кэшбэком и ростом NAV.
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}><Bar value={spend.share / 0.8} /></div>
        <div className="spread t-xs dim-2" style={{ marginTop: 7 }}>
          <span>{usd(spend.inside)} внутри</span>
          <span>{usd(spend.outside)} снаружи</span>
        </div>
      </Card>

      <Search value={q} onChange={setQ} placeholder="Виза, байк, вилла, цветы, съёмка…" />

      <Scroller>
        <Chip on={cat === 'all'} onClick={() => setCat('all')}>Всё</Chip>
        {SERVICE_CATS.map((c) => (
          <Chip key={c.id} on={cat === c.id} onClick={() => setCat(c.id)}>{c.name}</Chip>
        ))}
      </Scroller>

      <Scroller>
        <Chip on={city === 'all'} onClick={() => setCity('all')}>Все города</Chip>
        {cities.map((c) => (
          <Chip key={c} on={city === c} onClick={() => setCity(c)}>{CITIES[c].flag} {CITIES[c].name}</Chip>
        ))}
      </Scroller>

      {list.length === 0 ? (
        <Empty title="Ничего не нашлось" text="В этом городе пока нет такой услуги. Условие открытия нового города — десять активных услуг от местных резидентов." />
      ) : (
        <div className="stack">
          {list.map((s) => {
            const owner = byId(s.owner);
            return (
              <button key={s.id} className="card tap" style={{ padding: 0, overflow: 'hidden', display: 'block', width: '100%', textAlign: 'left' }} onClick={() => go(`/service/${s.id}`)}>
                <Cover art={s.art} seed={s.id} height={106}>
                  <div style={{ position: 'absolute', left: 13, right: 13, bottom: 10 }}>
                    <div className="row" style={{ gap: 6, marginBottom: 5 }}>
                      <span className="tag tag--gold">кэшбэк {s.cashback}%</span>
                      <span className="tag tag--plain">{CITIES[s.city].flag} {CITIES[s.city].name}</span>
                    </div>
                    <div className="t-lg">{s.title}</div>
                  </div>
                </Cover>
                <div className="spread" style={{ padding: 12 }}>
                  <div className="row" style={{ gap: 9 }}>
                    <Avatar person={owner} size={26} />
                    <div>
                      <div className="t-xs" style={{ fontWeight: 600 }}>{owner?.company}</div>
                      <div className="t-xs dim-2">Ответ ≈ {s.reply} мин · ★ {s.rating}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="t-sm gold">{s.price ? usdExact(s.price) : 'по запросу'}</div>
                    {s.price > 0 && <div className="t-xs dim-2">за {s.unit}</div>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Card className="row-t" style={{ gap: 11 }}>
        <Icon name="wallet" size={17} color="var(--gold)" />
        <div className="t-xs dim">
          Баллы начисляются за оплату услуг партнёров, билеты и приглашённых резидентов.
          Курс списания фиксирован: 100 баллов = $1. Баллы — не UHT: они не дают доли в активах.
        </div>
      </Card>
    </div>
  );
}
