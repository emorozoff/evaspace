import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { Top, List, Item, Chip, Scroller, Search, Empty, Bar, Note } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';
import { SERVICES, SERVICE_CATS } from '../data/life.js';
import { CITIES } from '../data/places.js';
import { byId } from '../data/people.js';
import { spendTotals } from '../lib/select.js';
import { usd, usdExact, pct } from '../lib/format.js';

export const CAT_ICON = { transport: 'car', docs: 'passport', home: 'home', health: 'heart', media: 'brush', legal: 'shield', food: 'cup', gifts: 'gift', edu: 'book', tech: 'code' };

export default function Market() {
  const app = useApp();
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const spend = useMemo(() => spendTotals(app.extraSpend), [app.extraSpend]);

  const list = useMemo(() => {
    let out = SERVICES;
    if (cat !== 'all') out = out.filter((s) => s.cat === cat);
    if (q.trim()) {
      const t = q.toLowerCase();
      out = out.filter((s) => (s.title + ' ' + s.desc + ' ' + CITIES[s.city].name).toLowerCase().includes(t));
    }
    return out;
  }, [cat, q]);

  return (
    <div className="screen stack">
      <Top title="Услуги" sub="Резиденты — резидентам, с кэшбэком" right={<button className="iconbtn" onClick={() => go('/club')}><Icon name="back" size={18} /></button>} />

      <div className="card">
        <div className="spread">
          <div className="t-md">Трат внутри круга</div>
          <div className="t-md gold">{pct(spend.share)} <span className="t-xs dim-2">/ цель 80%</span></div>
        </div>
        <div style={{ marginTop: 10 }}><Bar value={spend.share / 0.8} /></div>
        <div className="t-xs dim-2" style={{ marginTop: 7 }}>{usd(spend.inside)} внутри · {usd(spend.outside)} снаружи за 90 дней</div>
      </div>

      <Search value={q} onChange={setQ} placeholder="Виза, байк, вилла, цветы, съёмка…" />

      <Scroller>
        <Chip on={cat === 'all'} onClick={() => setCat('all')}>Всё</Chip>
        {SERVICE_CATS.map((c) => <Chip key={c.id} on={cat === c.id} onClick={() => setCat(c.id)}>{c.name}</Chip>)}
      </Scroller>

      {list.length === 0 ? (
        <Empty title="Ничего не нашлось" text="Условие открытия нового города — десять активных услуг от местных резидентов." />
      ) : (
        <List>
          {list.map((s) => {
            const owner = byId(s.owner);
            return (
              <Item
                key={s.id}
                icon={CAT_ICON[s.cat]}
                title={s.title}
                sub={`${owner?.company} · ${CITIES[s.city].flag} ${CITIES[s.city].name} · ответ ≈ ${s.reply} мин`}
                meta={
                  <>
                    <span className="gold" style={{ fontSize: 13, fontWeight: 700 }}>{s.price ? usdExact(s.price) : 'по запросу'}</span>
                    <span className="tag tag--gold">+{s.cashback}%</span>
                  </>
                }
                chev={false}
                onClick={() => go(`/service/${s.id}`)}
              />
            );
          })}
        </List>
      )}

      <Note icon="wallet">Баллы начисляются за услуги, билеты и приглашённых. 100 баллов = $1. Баллы — не UHT.</Note>
    </div>
  );
}
