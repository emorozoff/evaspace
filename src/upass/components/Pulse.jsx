import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icons.jsx';
import { Avatar } from './Art.jsx';
import { REGIONS, timeIn } from '../data/regions.js';
import { residentsIn, agendaFor, regionStats } from '../lib/select.js';
import { nf, plural, relDay } from '../lib/format.js';

/* Живой блок под паспортом. Информация занимает его целиком и сменяется
   каруселью: текущее уходит влево, следующее приходит справа. Меняется само
   раз в пять секунд, по нажатию и свайпом. Высота фиксирована — иначе
   экран прыгает на каждой смене. */

const EVERY = 5000;
const OUT = 440;
const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export default function Pulse({ app }) {
  const [view, setView] = useState({ cur: 0, prev: null, dir: 1 });
  const [now, setNow] = useState(() => new Date());
  const hold = useRef(0);
  const drag = useRef(null);

  const slides = useMemo(() => buildSlides(app, now), [app, now]);
  const at = (n) => ((n % slides.length) + slides.length) % slides.length;

  /* Минуты должны идти сами, иначе блок выглядит скриншотом. */
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      if (Date.now() < hold.current) return;
      setView((v) => ({ cur: v.cur + 1, prev: v.cur, dir: 1 }));
    }, EVERY);
    return () => clearInterval(t);
  }, []);

  /* Уходящий слайд живёт ровно столько, сколько идёт анимация. */
  useEffect(() => {
    if (view.prev === null) return;
    const t = setTimeout(() => setView((v) => ({ ...v, prev: null })), OUT);
    return () => clearTimeout(t);
  }, [view.prev]);

  const move = (d) => {
    hold.current = Date.now() + EVERY * 2;
    setView((v) => ({ cur: v.cur + d, prev: v.cur, dir: d }));
  };

  const cur = slides[at(view.cur)];
  const prev = view.prev === null ? null : slides[at(view.prev)];

  return (
    <div className="pulse" data-dir={view.dir}>
      <button
        className="pulse__body"
        onPointerDown={(e) => (drag.current = e.clientX)}
        onPointerUp={(e) => {
          const dx = drag.current === null ? 0 : e.clientX - drag.current;
          drag.current = null;
          move(Math.abs(dx) > 34 ? (dx < 0 ? 1 : -1) : 1);
        }}
        onPointerCancel={() => (drag.current = null)}
        aria-label="Следующая карточка"
      >
        <div className="pulse__view">
          {prev && <div className="pulse__slide pulse__slide--out" key={`o${view.prev}`}>{prev.body}</div>}
          <div className="pulse__slide pulse__slide--in" key={`i${view.cur}`}>{cur.body}</div>
        </div>
      </button>

      <div className="pulse__dots">
        {slides.map((s, n) => (
          <button
            key={s.id}
            data-on={n === at(view.cur)}
            onClick={() => { const d = n - at(view.cur); if (d) move(d); }}
            aria-label={`Карточка ${n + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

/* ——— содержимое ——— */

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
        <div className="pulse__region">
          <span className="pulse__flag">{r.flag}</span>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="pulse__title ell">{r.name}</div>
            <div className="pulse__sub ell">
              {nf(stats.residents)} резидентов · {nf(stats.companies)} {plural(stats.companies, 'компания', 'компании', 'компаний')}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'clock',
      body: (
        <div className="pulse__clocks">
          {(clocks.length ? clocks : [me.city]).map((k) => (
            <div key={k} className="pulse__clock">
              <div className="pulse__time figure">{hhmm(timeIn(k, now))}</div>
              <div className="pulse__place">
                <span className="pulse__flag--xs">{REGIONS[k].flag}</span>
                {REGIONS[k].name}
              </div>
            </div>
          ))}
        </div>
      ),
    },
  ];

  if (trip) {
    const to = REGIONS[trip.region];
    out.push({
      id: 'trip',
      body: (
        <div className="pulse__trip">
          <div className="pulse__city">
            <span className="pulse__flag--sm">{r.flag}</span>
            <span>{r.name}</span>
          </div>
          <div className="pulse__route">
            <span className="pulse__dash" />
            <Icon name="plane" size={22} color="var(--gold)" />
            <span className="pulse__dash" />
          </div>
          <div className="pulse__city">
            <span className="pulse__flag--sm">{to.flag}</span>
            <span>{to.name}</span>
          </div>
        </div>
      ),
    });
  } else {
    out.push({
      id: 'trip',
      body: (
        <div className="pulse__region">
          <span className="pulse__ic"><Icon name="plane" size={20} color="var(--gold)" /></span>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="pulse__title ell">Куда летим</div>
            <div className="pulse__sub ell">Поездка ещё не объявлена</div>
          </div>
        </div>
      ),
    });
  }

  out.push({
    id: 'near',
    body: (
      <div className="pulse__region">
        <div className="ava-stack" style={{ flex: 'none' }}>
          {here.slice(0, 3).map((p) => <Avatar key={p.id} person={p} size={34} />)}
        </div>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="pulse__title ell">{here.length ? `${here.length} своих рядом` : 'Своих рядом пока нет'}</div>
          <div className="pulse__sub ell">
            {here.length
              ? `${online.length} в сети${next ? ` · встреча ${relDay(next.inDays)}` : ''}`
              : 'Посмотрите карту — сообщество в соседнем регионе'}
          </div>
        </div>
      </div>
    ),
  });

  return out;
}
