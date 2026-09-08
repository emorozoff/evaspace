import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { Top, List, Item, Chip, Scroller, Search, Empty, Note, Section } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';
import { SERVICES, SERVICE_CATS } from '../data/life.js';
import { REGIONS } from '../data/regions.js';
import { byId } from '../data/people.js';
import { usdExact, plural } from '../lib/format.js';

/* Всё, что помогает быстро осесть в новом регионе. */
export default function Market() {
  const app = useApp();
  const { me } = app;
  const [cat, setCat] = useState('all');
  const [here, setHere] = useState(false);
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    let out = SERVICES;
    if (cat !== 'all') out = out.filter((s) => s.cat === cat);
    if (here) out = out.filter((s) => s.region === me.city || s.region === 'global');
    if (q.trim()) {
      const t = q.toLowerCase();
      out = out.filter((s) => (s.title + ' ' + s.desc).toLowerCase().includes(t));
    }
    return out;
  }, [cat, here, q, me.city]);

  return (
    <div className="screen stack">
      <Top title="Услуги" sub="Переезд, документы, жильё и быт — от своих" />

      <Search value={q} onChange={setQ} placeholder="Виза, счёт, жильё, школа, байк…" />

      <Scroller>
        <Chip on={cat === 'all' && !here} onClick={() => { setCat('all'); setHere(false); }}>Всё</Chip>
        <Chip on={here} onClick={() => setHere(!here)}>{REGIONS[me.city].flag} Мой регион</Chip>
        {SERVICE_CATS.map((c) => <Chip key={c.id} on={cat === c.id} onClick={() => setCat(cat === c.id ? 'all' : c.id)}>{c.name}</Chip>)}
      </Scroller>

      {list.length === 0 ? (
        <Empty title="Ничего не нашлось" text="Снимите фильтр или спросите в разделе «Запросы» — обычно отвечают за пару часов." />
      ) : (
        <List>
          {list.map((s) => {
            const owner = byId(s.owner);
            const cats = SERVICE_CATS.find((c) => c.id === s.cat);
            return (
              <Item
                key={s.id}
                icon={cats?.icon || 'gift'}
                title={s.title}
                sub={`${owner?.company} · ${s.region === 'global' ? 'везде' : REGIONS[s.region]?.name} · ${s.days} ${plural(s.days, 'день', 'дня', 'дней')}`}
                meta={<span className="gold" style={{ fontSize: 13, fontWeight: 700 }}>{s.price ? usdExact(s.price) : 'по запросу'}</span>}
                chev={false}
                onClick={() => go(`/service/${s.id}`)}
              />
            );
          })}
        </List>
      )}

      <Note icon="shield">Услуги оказывают резиденты. Внутри сообщества не продают того, во что не верят сами: жалоба разбирается и остаётся в репутации.</Note>
    </div>
  );
}
