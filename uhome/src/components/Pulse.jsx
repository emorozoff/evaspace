import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Icon from './Icons.jsx';
import { Sheet, Item } from './UI.jsx';
import { CITIES, REGIONS, REGION_CITY, REGION_KEYS } from '../data/regions.js';
import { regionStats, COMMUNITIES } from '../data/communities.js';
import { go } from '../lib/router.jsx';
import { plural, count } from '../lib/format.js';
import { PAIRS, CURRENCIES } from '../data/currencies.js';
import { localParts, hhmm, diffLabel, dayPart } from '../lib/time.js';
import { useRates, pairValue, money, moneyParts, freshness } from '../lib/rates.js';
import Flag from './Flag.jsx';

/* Живой блок под картой резидента — табло, как в UPASS. Четыре экрана:
   время в трёх городах, три курса, резиденты по странам и сообщества по
   странам. Листается сам (тонкая золотая линия внизу — сколько осталось
   до следующего), пальцем и по вкладкам; новый экран въезжает справа,
   ячейки прибывают одна за другой, как строки на табло вылетов.
   Нажатие на город или курс — выбрать другой; на страну — её люди или
   сообщество. */

const SLIDES = [
  { id: 'clocks', name: 'Время' },
  { id: 'rates', name: 'Курсы' },
  { id: 'people', name: 'Люди' },
  { id: 'communities', name: 'Сообщества' },
];

const EVERY = 7000;
const OUT = 560; // столько же длится уход старого экрана в стилях
const REST = 20000; // после ручного листания автопрокрутка ждёт

export default function Pulse({ app }) {
  const [view, setView] = useState({ cur: 0, prev: null, dir: 1 });
  const [now, setNow] = useState(() => new Date());
  const [pick, setPick] = useState(null); // { field: 'clocks' | 'rates', slot }
  const [auto, setAuto] = useState(true);
  const [ink, setInk] = useState({ x: 0, w: 0 });
  const resume = useRef(0);
  const drag = useRef(null);
  const tabs = useRef([]);
  const rates = useRates();

  const slides = SLIDES.map((x) => x.id);
  const at = (n) => ((n % slides.length) + slides.length) % slides.length;
  const idx = at(view.cur);

  // минуты идут сами — иначе блок выглядит скриншотом
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);

  // автопрокрутка: один таймер на экран, пауза пока открыт выбор или после ручного листания
  useEffect(() => {
    if (!auto || pick) return;
    const t = setTimeout(() => setView((v) => ({ cur: v.cur + 1, prev: v.cur, dir: 1 })), EVERY);
    return () => clearTimeout(t);
  }, [view.cur, auto, pick]);

  useEffect(() => () => clearTimeout(resume.current), []);

  useEffect(() => {
    if (view.prev === null) return;
    const t = setTimeout(() => setView((v) => ({ ...v, prev: null })), OUT);
    return () => clearTimeout(t);
  }, [view.prev]);

  /* Золотая черта под вкладкой едет к выбранной: меряем кнопку и двигаем
     одну линию трансформом. */
  const measure = useCallback(() => {
    const el = tabs.current[idx];
    if (el) setInk({ x: el.offsetLeft, w: el.offsetWidth });
  }, [idx]);
  useLayoutEffect(measure, [measure]);
  useEffect(() => {
    window.addEventListener('resize', measure);
    document.fonts?.ready?.then(measure).catch(() => {});
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  const pause = () => {
    setAuto(false);
    clearTimeout(resume.current);
    resume.current = setTimeout(() => setAuto(true), REST);
  };

  const move = (d) => {
    pause();
    setView((v) => ({ cur: v.cur + d, prev: v.cur, dir: d > 0 ? 1 : -1 }));
  };

  const goTo = (n) => {
    const d = n - idx;
    if (d) move(d);
  };

  const choose = (cell) => {
    pause();
    setPick({ field: cell.dataset.field, slot: Number(cell.dataset.slot) });
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
    if (Math.abs(dx) > 10 || Math.abs(e.clientY - start.y) > 10) return;
    const link = e.target.closest('[data-go]');
    if (link) {
      go(link.dataset.go);
      return;
    }
    const cell = e.target.closest('[data-slot]');
    if (cell) choose(cell);
  };

  const baseTz = REGIONS[app.me.region]?.tz || 'Europe/Moscow';
  const hereCity = REGION_CITY[app.me.region];

  const render = (kind) =>
    kind === 'clocks' ? <Clocks list={app.clocks} now={now} baseTz={baseTz} here={hereCity} />
      : kind === 'rates' ? <Rates list={app.rates} rates={rates} />
        : <Geo kind={kind} mine={app.me.region} />;

  const total = REGION_KEYS.reduce((n, k) => n + regionStats(k).members, 0);
  const hint = {
    clocks: 'нажмите на город, чтобы сменить',
    rates: rates.at ? `${freshness(rates)} · нажмите, чтобы сменить` : 'ориентир, не биржевой курс',
    people: `${count(total, 'резидент', 'резидента', 'резидентов')} в клубе`,
    communities: `${COMMUNITIES.length} ${plural(COMMUNITIES.length, 'сообщество', 'сообщества', 'сообществ')} в клубе`,
  };

  const cur = slides[idx];
  const prev = view.prev === null ? null : slides[at(view.prev)];

  return (
    <>
      <div
        className="hp"
        data-dir={view.dir}
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={() => (drag.current = null)}
        onClick={(e) => {
          // с клавиатуры pointerup не приходит — выбор и переход по обычному клику
          if (e.detail !== 0) return;
          const link = e.target.closest('[data-go]');
          if (link) return go(link.dataset.go);
          const cell = e.target.closest('[data-slot]');
          if (cell) choose(cell);
        }}
      >
        <i className="hp__corners" aria-hidden="true" />
        <div className="hp__head">
          <div className="hp__tabs" role="tablist">
            {SLIDES.map((x, n) => (
              <button
                key={x.id} ref={(el) => (tabs.current[n] = el)} role="tab" aria-selected={cur === x.id}
                className="hp__tab" data-on={cur === x.id} onClick={() => goTo(n)}
              >
                {x.name}
              </button>
            ))}
            <i className="hp__ink" style={{ transform: `translateX(${ink.x}px) scaleX(${ink.w / 100})` }} />
          </div>
          <span className="hp__count" aria-hidden="true">
            <b>{String(idx + 1).padStart(2, '0')}</b>/{String(SLIDES.length).padStart(2, '0')}
          </span>
        </div>
        <div className="hp__view">
          {prev && <div className="hp__slide hp__slide--out" key={`o${view.prev}`}>{render(prev)}</div>}
          <div className="hp__slide hp__slide--in" key={`i${view.cur}`}>{render(cur)}</div>
        </div>
        <div className="hp__foot">
          <span className="hp__live" aria-hidden="true" />
          <span className="hp__hint" key={cur}>{hint[cur]}</span>
        </div>
        {auto && !pick && <i className="hp__prog" key={`p${view.cur}`} style={{ animationDuration: `${EVERY}ms` }} aria-hidden="true" />}
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

/* Страны клуба: флаг, число, название и шкала относительно самой большой.
   Люди — сколько резидентов, сообщества — сколько сообществ. Ваша — золотом. */
function Geo({ kind, mine }) {
  const rows = REGION_KEYS.map((k) => {
    const st = regionStats(k);
    return { k, n: kind === 'people' ? st.members : st.communities };
  });
  const max = Math.max(1, ...rows.map((x) => x.n));
  return rows.map(({ k, n }) => {
    const local = COMMUNITIES.find((c) => c.kind === 'local' && c.region === k);
    const to = kind === 'people' ? `/people?tab=list&region=${k}` : `/community/${local?.id}`;
    return (
      <button key={k} className="hp-geo" data-go={to} data-on={k === mine} aria-label={`${REGIONS[k].name}: ${n}`}>
        <Flag cc={REGIONS[k].cc} size={22} />
        <span className="hp-geo__n">{n}</span>
        <span className="hp-geo__c">{REGIONS[k].name}</span>
        <span className="hp-geo__bar"><i style={{ transform: `scaleX(${Math.max(0.06, n / max)})` }} /></span>
      </button>
    );
  });
}

function Clocks({ list, now, baseTz, here }) {
  return list.map((key, i) => {
    const c = CITIES[key];
    if (!c) return null;
    const t = localParts(c.tz, now);
    const part = dayPart(t.h);
    const [hh, mm] = hhmm(t).split(':');
    return (
      <button key={key + i} className="hp-cell" data-slot={i} data-field="clocks" aria-label={`${c.name}, ${hhmm(t)}. Сменить город`}>
        <span className="hp-cell__big">{hh}<i className="hp-colon">:</i>{mm}</span>
        <span className="hp-cell__place"><Flag cc={c.cc} size={12} /><span>{c.name}</span></span>
        <span className="hp-cell__meta">
          <Icon name={part === 'ночь' || part === 'вечер' ? 'moon' : 'sun'} size={10} />
          {key === here ? <span className="hp-here">вы здесь</span> : <span>{diffLabel(c.tz, baseTz, now)}</span>}
        </span>
        {/* сутки линией: светлая часть — день, точка — сейчас */}
        <span className="hp-day"><i style={{ left: `${((t.h * 60 + t.m) / 1440) * 100}%` }} /></span>
      </button>
    );
  });
}

function Rates({ list, rates }) {
  return list.map((id, i) => {
    const v = pairValue(id, rates);
    if (!v) return null;
    const m = moneyParts(v.value, v.to);
    const sym = <small className="hp-sym">{m.sym}</small>;
    return (
      <button key={id + i} className="hp-cell" data-slot={i} data-field="rates" aria-label={`${v.from} к ${v.to}: ${money(v.value, v.to)}. Сменить курс`}>
        <span className={`hp-cell__big hp-cell__big--rate${m.num.length >= 7 ? ' hp-cell__big--sm' : ''}`}>
          {m.pre && sym}{m.num}{!m.pre && sym}
        </span>
        <span className="hp-cell__place hp-cell__pair">{v.from}<i>→</i>{v.to}</span>
        <span className="hp-cell__meta">
          {v.trend > 0 && <Icon name="up" size={10} className="trend-up" />}
          {v.trend < 0 && <Icon name="dn" size={10} className="trend-down" />}
          <span>за 1 {CURRENCIES[v.from].sym}</span>
        </span>
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
            lead={<span className="picker__lead"><Flag cc={c.cc} size={24} /></span>}
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
            lead={<span className="picker__lead hp-cur">{CURRENCIES[p.from].sym}</span>}
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
