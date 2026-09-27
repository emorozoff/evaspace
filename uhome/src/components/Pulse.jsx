import { useEffect, useRef, useState } from 'react';
import Icon from './Icons.jsx';
import { Sheet, Item } from './UI.jsx';
import { CITIES, REGIONS, REGION_CITY } from '../data/regions.js';
import { PAIRS, CURRENCIES } from '../data/currencies.js';
import { localParts, hhmm, diffLabel, dayPart } from '../lib/time.js';
import { useRates, pairValue, money, moneyParts, freshness } from '../lib/rates.js';

/* Живой блок под картой резидента — как в UPASS: листается сам, как табло,
   и пальцем. Два слайда: время в трёх городах и три курса валют.
   Нажатие на город или курс открывает список — выбранное встаёт на это место. */

const EVERY = 7000;
const OUT = 900; // столько же длится анимация в стилях

export default function Pulse({ app }) {
  const [view, setView] = useState({ cur: 0, prev: null, dir: 1 });
  const [now, setNow] = useState(() => new Date());
  const [pick, setPick] = useState(null); // { field: 'clocks' | 'rates', slot }
  const hold = useRef(0);
  const drag = useRef(null);
  const rates = useRates();

  const slides = ['clocks', 'rates'];
  const at = (n) => ((n % slides.length) + slides.length) % slides.length;

  // минуты идут сами — иначе блок выглядит скриншотом
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      if (Date.now() < hold.current || pick) return;
      setView((v) => ({ cur: v.cur + 1, prev: v.cur, dir: 1 }));
    }, EVERY);
    return () => clearInterval(t);
  }, [pick]);

  useEffect(() => {
    if (view.prev === null) return;
    const t = setTimeout(() => setView((v) => ({ ...v, prev: null })), OUT);
    return () => clearTimeout(t);
  }, [view.prev]);

  const move = (d) => {
    hold.current = Date.now() + 20000;
    setView((v) => ({ cur: v.cur + d, prev: v.cur, dir: d }));
  };

  const goTo = (n) => {
    const d = n - at(view.cur);
    if (d) move(d);
  };

  /* Свайп листает, короткое нажатие по ячейке — выбор. */
  const onDown = (e) => {
    drag.current = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e) => {
    const start = drag.current;
    drag.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(e.clientY - start.y)) {
      move(dx < 0 ? 1 : -1);
      return;
    }
    const cell = e.target.closest('[data-slot]');
    if (cell) {
      hold.current = Date.now() + 20000;
      setPick({ field: cell.dataset.field, slot: Number(cell.dataset.slot) });
    }
  };

  const baseTz = REGIONS[app.me.region]?.tz || 'Europe/Moscow';
  const hereCity = REGION_CITY[app.me.region];

  const render = (kind) =>
    kind === 'clocks' ? (
      <Clocks list={app.clocks} now={now} baseTz={baseTz} here={hereCity} />
    ) : (
      <Rates list={app.rates} rates={rates} />
    );

  const cur = slides[at(view.cur)];
  const prev = view.prev === null ? null : slides[at(view.prev)];

  return (
    <>
      <div
        className="pulse"
        data-dir={view.dir}
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={() => (drag.current = null)}
        onClick={(e) => {
          // с клавиатуры pointerup не приходит — выбор открываем по обычному клику
          const cell = e.detail === 0 && e.target.closest('[data-slot]');
          if (cell) setPick({ field: cell.dataset.field, slot: Number(cell.dataset.slot) });
        }}
      >
        <div className="pulse__head">
          <div className="pulse__tabs">
            <button className="pulse__tab" data-on={cur === 'clocks'} onClick={() => goTo(0)}>Время</button>
            <button className="pulse__tab" data-on={cur === 'rates'} onClick={() => goTo(1)}>Курсы</button>
          </div>
          <span className="pulse__hint">{cur === 'rates' ? freshness(rates) : 'нажмите, чтобы сменить город'}</span>
        </div>
        <div className="pulse__view">
          {prev && <div className="pulse__slide pulse__slide--out" key={`o${view.prev}`}>{render(prev)}</div>}
          <div className="pulse__slide pulse__slide--in" key={`i${view.cur}`}>{render(cur)}</div>
        </div>
        <div className="pulse__dots">
          {slides.map((s, n) => (
            <button key={s} data-on={n === at(view.cur)} onClick={() => goTo(n)} aria-label={s === 'clocks' ? 'Время' : 'Курсы'} />
          ))}
        </div>
      </div>

      <Sheet
        open={pick?.field === 'clocks'}
        onClose={() => setPick(null)}
        title="Какой город показать"
        sub="Выбранный встанет на это место. Если он уже на главной — города поменяются местами."
      >
        {pick?.field === 'clocks' && (
          <CityList app={app} slot={pick.slot} now={now} baseTz={baseTz} onDone={() => setPick(null)} />
        )}
      </Sheet>

      <Sheet
        open={pick?.field === 'rates'}
        onClose={() => setPick(null)}
        title="Какой курс показать"
        sub={`Курс обновляется раз в 10 минут, ${freshness(rates)}.`}
      >
        {pick?.field === 'rates' && <PairList app={app} slot={pick.slot} rates={rates} onDone={() => setPick(null)} />}
      </Sheet>
    </>
  );
}

function Clocks({ list, now, baseTz, here }) {
  return list.map((key, i) => {
    const c = CITIES[key];
    if (!c) return null;
    const t = localParts(c.tz, now);
    const part = dayPart(t.h);
    return (
      <button key={key + i} className="pulse__cell" data-slot={i} data-field="clocks">
        <div className="pulse__big">{hhmm(t)}</div>
        <div className="pulse__place"><span>{c.flag}</span><span>{c.name}</span></div>
        <div className="pulse__meta">
          <Icon name={part === 'ночь' || part === 'вечер' ? 'moon' : 'sun'} size={11} />
          {key === here ? <span className="pulse__here">вы здесь</span> : <span>{diffLabel(c.tz, baseTz, now)}</span>}
        </div>
      </button>
    );
  });
}

function Rates({ list, rates }) {
  return list.map((id, i) => {
    const v = pairValue(id, rates);
    if (!v) return null;
    const m = moneyParts(v.value, v.to);
    const sym = <small className="pulse__sym">{m.sym}</small>;
    return (
      <button key={id + i} className="pulse__cell" data-slot={i} data-field="rates">
        <div className={`pulse__big pulse__big--rate${m.num.length >= 7 ? ' pulse__big--sm' : ''}`}>
          {m.pre && sym}{m.num}{!m.pre && sym}
        </div>
        <div className="pulse__place"><span>{v.from} / {v.to}</span></div>
        <div className="pulse__meta">
          {v.trend > 0 && <Icon name="up" size={11} className="trend-up" />}
          {v.trend < 0 && <Icon name="dn" size={11} className="trend-down" />}
          <span>за 1 {CURRENCIES[v.from].sym}</span>
        </div>
      </button>
    );
  });
}

function CityList({ app, slot, now, baseTz, onDone }) {
  return (
    <div className="list list--plain">
      {Object.entries(CITIES).map(([key, c]) => {
        const on = app.clocks[slot] === key;
        const elsewhere = !on && app.clocks.includes(key);
        return (
          <Item
            key={key}
            lead={<span className="picker__lead">{c.flag}</span>}
            title={c.name}
            sub={`${hhmm(localParts(c.tz, now))} · ${diffLabel(c.tz, baseTz, now)}${elsewhere ? ' · уже на главной' : ''}`}
            meta={on ? <Icon name="check" size={18} color="var(--gold)" /> : elsewhere ? <Icon name="swap" size={16} color="var(--ink-3)" /> : undefined}
            chev={false}
            onClick={() => { app.setSlot('clocks', slot, key); onDone(); }}
          />
        );
      })}
    </div>
  );
}

function PairList({ app, slot, rates, onDone }) {
  return (
    <div className="list list--plain">
      {PAIRS.map((p) => {
        const on = app.rates[slot] === p.id;
        const elsewhere = !on && app.rates.includes(p.id);
        const v = pairValue(p.id, rates);
        return (
          <Item
            key={p.id}
            lead={<span className="picker__lead" style={{ fontSize: 14, fontWeight: 800, color: 'var(--gold)' }}>{CURRENCIES[p.from].sym}</span>}
            title={p.title}
            sub={`${p.from} / ${p.to} · ${money(v.value, p.to)}${elsewhere ? ' · уже на главной' : ''}`}
            meta={on ? <Icon name="check" size={18} color="var(--gold)" /> : elsewhere ? <Icon name="swap" size={16} color="var(--ink-3)" /> : undefined}
            chev={false}
            onClick={() => { app.setSlot('rates', slot, p.id); onDone(); }}
          />
        );
      })}
    </div>
  );
}
