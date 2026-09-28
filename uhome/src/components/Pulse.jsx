import { useEffect, useRef, useState } from 'react';
import Icon from './Icons.jsx';
import { Seg, Sheet, Item } from './UI.jsx';
import { CITIES, REGIONS, REGION_CITY, REGION_KEYS } from '../data/regions.js';
import { PEOPLE } from '../data/people.js';
import { regionStats } from '../data/communities.js';
import { go } from '../lib/router.jsx';
import { count } from '../lib/format.js';
import { PAIRS, CURRENCIES } from '../data/currencies.js';
import { localParts, hhmm, diffLabel } from '../lib/time.js';
import { useRates, pairValue, money, moneyParts, freshness } from '../lib/rates.js';
import Flag from './Flag.jsx';

/* Живой блок под картой резидента — одна спокойная панель, четыре экрана:
   время в трёх городах, три курса, резиденты и сообщества по регионам.
   Листается сам раз в семь секунд, пальцем и по вкладкам. Нажатие на город
   или курс — выбрать другой; на регион — его люди или сообщество. */

const SLIDES = [
  { value: 'clocks', label: 'Время' },
  { value: 'rates', label: 'Курсы' },
  { value: 'people', label: 'Люди' },
  { value: 'communities', label: 'Сообщества' },
];
const EVERY = 7000;
const REST = 20000; // после ручного листания автопрокрутка ждёт
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export default function Pulse({ app }) {
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState(1);
  const [now, setNow] = useState(() => new Date());
  const [pick, setPick] = useState(null); // { field: 'clocks' | 'rates', slot }
  const [auto, setAuto] = useState(true);
  const resume = useRef(0);
  const drag = useRef(null);
  const swiped = useRef(false);
  const rates = useRates();
  const n = SLIDES.length;

  // минуты идут сами — иначе блок выглядит скриншотом
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!auto || pick) return undefined;
    const t = setTimeout(() => { setDir(1); setIdx((i) => (i + 1) % n); }, EVERY);
    return () => clearTimeout(t);
  }, [idx, auto, pick, n]);

  useEffect(() => () => clearTimeout(resume.current), []);

  const pause = () => {
    setAuto(false);
    clearTimeout(resume.current);
    resume.current = setTimeout(() => setAuto(true), REST);
  };
  const show = (i, d) => {
    pause();
    setDir(d);
    setIdx(((i % n) + n) % n);
  };

  /* Свайп только листает. Выбор города или курса — обычный клик по кнопке:
     на сенсорном экране браузер сам решает, было это нажатие или жест. */
  const onDown = (e) => { drag.current = { x: e.clientX, y: e.clientY }; swiped.current = false; };
  const onUp = (e) => {
    const s = drag.current;
    drag.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(e.clientY - s.y)) {
      swiped.current = true;
      show(idx + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    }
  };
  const choose = (field, slot) => {
    if (swiped.current) return;
    pause();
    setPick({ field, slot });
  };

  const baseTz = REGIONS[app.me.region]?.tz || 'Europe/Moscow';
  const here = REGION_CITY[app.me.region];
  const cur = SLIDES[idx].value;

  const hint = {
    clocks: 'Нажмите на город, чтобы сменить',
    rates: `${cap(freshness(rates))} · нажмите, чтобы сменить`,
    people: `${count(PEOPLE.length, 'резидент', 'резидента', 'резидентов')} в приложении · нажмите на регион`,
    communities: 'Участников в сообществе региона · нажмите',
  }[cur];

  return (
    <>
      <div className="card h-live">
        <Seg value={cur} onChange={(v) => show(SLIDES.findIndex((s) => s.value === v), SLIDES.findIndex((s) => s.value === v) > idx ? 1 : -1)} options={SLIDES} />
        <div className="h-live__view" onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => (drag.current = null)}>
          <div className={`strip h-live__slide${cur === 'clocks' || cur === 'rates' ? '' : ' h-live__slide--5'}`} key={cur} data-dir={dir}>
            {cur === 'clocks' && app.clocks.map((key, i) => {
              const c = CITIES[key];
              if (!c) return null;
              const t = localParts(c.tz, now);
              return (
                <button key={key} className="h-cell" onClick={() => choose('clocks', i)} aria-label={`${c.name}, ${hhmm(t)}. Сменить город`}>
                  <span className="strip__v h-cell__v">{hhmm(t)}</span>
                  <span className="h-cell__place"><Flag cc={c.cc} size={12} /><span className="ell">{c.name}</span></span>
                  <span className="strip__k">{key === here ? 'вы здесь' : diffLabel(c.tz, baseTz, now)}</span>
                </button>
              );
            })}
            {cur === 'rates' && app.rates.map((id, i) => {
              const v = pairValue(id, rates);
              if (!v) return null;
              const m = moneyParts(v.value, v.to);
              const sym = <small>{m.sym}</small>;
              return (
                <button key={id} className="h-cell" onClick={() => choose('rates', i)} aria-label={`${v.title}: ${money(v.value, v.to)}. Сменить курс`}>
                  <span className="strip__v h-cell__v" data-len={m.num.length >= 7 ? 'l' : m.num.length >= 6 ? 'm' : undefined}>{m.pre && sym}{m.num}{!m.pre && sym}</span>
                  <span className="h-cell__place">{v.from} / {v.to}</span>
                  <span className="strip__k">
                    {v.trend > 0 && <Icon name="up" size={9} />}{v.trend < 0 && <Icon name="dn" size={9} />}
                    за 1 {CURRENCIES[v.from].sym}
                  </span>
                </button>
              );
            })}
            {(cur === 'people' || cur === 'communities') && REGION_KEYS.map((k) => {
              const r = REGIONS[k];
              const st = regionStats(k);
              const val = cur === 'people' ? st.residents : st.members;
              const to = cur === 'people' ? `/people?tab=list&region=${k}` : `/community/${st.list[0]?.id}`;
              return (
                <button key={k} className="h-cell" data-on={k === app.me.region} onClick={() => !swiped.current && go(to)} aria-label={`${r.name}: ${val}`}>
                  <span className="strip__v">{val}</span>
                  <span className="h-cell__place"><span className="ell">{r.name}</span></span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="h-live__hint" key={`h${cur}`}>{hint}</div>
      </div>

      <Sheet open={pick?.field === 'clocks'} onClose={() => setPick(null)} title="Какой город показать" sub="Выбранный встанет на это место. Если он уже на главной — города поменяются местами.">
        {pick?.field === 'clocks' && (
          <div className="list list--plain">
            {Object.entries(CITIES).map(([key, c]) => {
              const on = app.clocks[pick.slot] === key;
              const elsewhere = !on && app.clocks.includes(key);
              return (
                <Item
                  key={key}
                  lead={<span className="picker__lead"><Flag cc={c.cc} size={24} /></span>}
                  title={c.name}
                  sub={`${hhmm(localParts(c.tz, now))} · ${diffLabel(c.tz, baseTz, now)}${elsewhere ? ' · уже на главной' : ''}`}
                  meta={on ? <Icon name="check" size={18} color="var(--gold)" /> : elsewhere ? <Icon name="swap" size={16} color="var(--ink-3)" /> : undefined}
                  chev={false}
                  onClick={() => { app.setSlot('clocks', pick.slot, key); setPick(null); }}
                />
              );
            })}
          </div>
        )}
      </Sheet>

      <Sheet open={pick?.field === 'rates'} onClose={() => setPick(null)} title="Какой курс показать" sub={`Курс обновляется раз в 10 минут, ${freshness(rates)}.`}>
        {pick?.field === 'rates' && (
          <div className="list list--plain">
            {PAIRS.map((p) => {
              const on = app.rates[pick.slot] === p.id;
              const elsewhere = !on && app.rates.includes(p.id);
              const v = pairValue(p.id, rates);
              return (
                <Item
                  key={p.id}
                  lead={<span className="picker__lead h-num">{CURRENCIES[p.from].sym}</span>}
                  title={p.title}
                  sub={`${p.from} / ${p.to} · ${money(v.value, p.to)}${elsewhere ? ' · уже на главной' : ''}`}
                  meta={on ? <Icon name="check" size={18} color="var(--gold)" /> : elsewhere ? <Icon name="swap" size={16} color="var(--ink-3)" /> : undefined}
                  chev={false}
                  onClick={() => { app.setSlot('rates', pick.slot, p.id); setPick(null); }}
                />
              );
            })}
          </div>
        )}
      </Sheet>
    </>
  );
}
