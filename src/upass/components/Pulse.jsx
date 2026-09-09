import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icons.jsx';
import { Avatar } from './Art.jsx';
import { REGIONS, timeIn } from '../data/regions.js';
import { residentsIn, agendaFor, regionStats } from '../lib/select.js';
import { nf, plural, relDay } from '../lib/format.js';
import { flight, hoursText } from '../lib/travel.js';

/* Живая строка под паспортом. Один блок, внутри которого информация
   сменяется сама раз в пять секунд и листается пальцем: где я сейчас,
   сколько времени у своих, ближайший перелёт и кто рядом.
   Высота фиксирована — иначе экран прыгает на каждой смене. */

const EVERY = 5000;
const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export default function Pulse({ app, onSettings, onOpen }) {
  const { me } = app;
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [now, setNow] = useState(() => new Date());
  const hold = useRef(0);
  const drag = useRef(null);

  const slides = useMemo(() => buildSlides(app, now), [app, now]);
  const idx = ((i % slides.length) + slides.length) % slides.length;
  const slide = slides[idx];

  /* Минуты на часах должны идти сами, иначе блок выглядит скриншотом. */
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      if (Date.now() < hold.current) return;   // после ручного листания даём паузу
      setDir(1);
      setI((v) => v + 1);
    }, EVERY);
    return () => clearInterval(t);
  }, []);

  const step = (d) => {
    hold.current = Date.now() + EVERY * 2;
    setDir(d);
    setI((v) => v + d);
  };

  /* Точка ведёт сразу на свой слайд, а не на соседний. */
  const jump = (n) => {
    const d = n - idx;
    if (d) step(d);
  };

  return (
    <div className="pulse">
      <button
        className="pulse__body"
        onPointerDown={(e) => (drag.current = e.clientX)}
        onPointerUp={(e) => {
          const dx = drag.current === null ? 0 : e.clientX - drag.current;
          drag.current = null;
          if (Math.abs(dx) > 34) step(dx < 0 ? 1 : -1);
          else onOpen?.(slide.id);
        }}
        onPointerCancel={() => (drag.current = null)}
      >
        <div className="pulse__view">
          <div className="pulse__slide" key={slide.id} data-dir={dir}>
            {slide.body}
          </div>
        </div>
      </button>

      <div className="pulse__side">
        <button className="iconbtn iconbtn--sm" onClick={onSettings} aria-label="Настроить блок">
          <Icon name="settings" size={16} />
        </button>
        <div className="pulse__dots">
          {slides.map((s, n) => (
            <button key={s.id} data-on={n === idx} onClick={() => jump(n)} aria-label={`Слайд ${n + 1}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ——— содержимое слайдов ——— */

function buildSlides(app, now) {
  const { me } = app;
  const r = REGIONS[me.city];
  const stats = regionStats(me.city);
  const here = residentsIn(me.city).filter((p) => p.id !== me.id);
  const online = here.filter((p) => p.online);
  const next = agendaFor(me, me.city, 1)[0];
  const trip = [...app.trips].sort((a, b) => a.inDays - b.inDays)[0];
  const clocks = (app.clocks || []).filter((k) => REGIONS[k]).slice(0, 3);

  const out = [
    {
      id: 'region',
      body: (
        <Line
          lead={<span className="pulse__flag">{r.flag}</span>}
          title={r.name}
          sub={`${nf(stats.residents)} резидентов · ${nf(stats.companies)} ${plural(stats.companies, 'компания', 'компании', 'компаний')}`}
          tail={<span className="pulse__hint">сменить</span>}
        />
      ),
    },
    {
      id: 'clock',
      body: (
        <div className="pulse__clocks">
          {(clocks.length ? clocks : [me.city]).map((k) => (
            <div key={k} className="pulse__clock">
              <div className="pulse__flag pulse__flag--sm">{REGIONS[k].flag}</div>
              <div className="pulse__time figure">{hhmm(timeIn(k, now))}</div>
              <div className="pulse__city">{REGIONS[k].name}</div>
            </div>
          ))}
        </div>
      ),
    },
  ];

  if (trip) {
    const f = flight(me.city, trip.region);
    const to = REGIONS[trip.region];
    out.push({
      id: 'trip',
      body: (
        <div className="pulse__trip">
          <div className="pulse__end">
            <div className="pulse__flag pulse__flag--sm">{r.flag}</div>
            <div className="pulse__city">{r.name}</div>
          </div>
          <div className="pulse__route">
            <span className="pulse__dash" />
            <Icon name="plane" size={17} color="var(--gold)" />
            <span className="pulse__dash" />
          </div>
          <div className="pulse__end">
            <div className="pulse__flag pulse__flag--sm">{to.flag}</div>
            <div className="pulse__city">{to.name}</div>
          </div>
          <div className="pulse__when">
            <div className="figure" style={{ fontSize: 16 }}>{relDay(trip.inDays)}</div>
            <div className="pulse__city">{f ? hoursText(f.hours) : 'в пути'}</div>
          </div>
        </div>
      ),
    });
  } else {
    out.push({
      id: 'trip',
      body: (
        <Line
          lead={<span className="pulse__ic"><Icon name="plane" size={19} color="var(--gold)" /></span>}
          title="Ближайшая поездка"
          sub="Пока не объявлена — выберите регион на карте и посмотрите цену"
          tail={<span className="pulse__hint">выбрать</span>}
        />
      ),
    });
  }

  out.push({
    id: 'near',
    body: (
      <Line
        lead={
          <div className="ava-stack">
            {here.slice(0, 3).map((p) => (
              <Avatar key={p.id} person={p} size={30} />
            ))}
          </div>
        }
        title={`${here.length ? `${here.length} своих рядом` : 'Своих рядом пока нет'}`}
        sub={
          here.length
            ? `${online.length} в сети${next ? ` · ближайшая встреча ${relDay(next.inDays)}` : ''}`
            : 'Посмотрите карту — сообщество в соседнем регионе'
        }
        tail={<span className="pulse__hint">кто рядом</span>}
      />
    ),
  });

  return out;
}

function Line({ lead, title, sub, tail }) {
  return (
    <div className="pulse__line">
      {lead}
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="t-md ell">{title}</div>
        <div className="t-xs dim-2 ell" style={{ marginTop: 2 }}>{sub}</div>
      </div>
      {tail}
    </div>
  );
}
