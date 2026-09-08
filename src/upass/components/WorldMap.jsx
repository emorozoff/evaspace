import { useMemo, useRef, useState, useEffect } from 'react';
import { landDots, project } from '../data/world.js';
import { CITIES, STATUS } from '../data/places.js';
import { LANDMARKS, HUB_MAIN } from '../data/landmarks.js';
import { initials } from '../lib/format.js';

/* Карта мира точками. Три уровня детализации по масштабу:
   — обзор: четыре главных хаба с силуэтами, остальные — точки;
   — ближе: силуэты и названия у всех локаций;
   — вплотную: вокруг города раскрываются резиденты, которые в нём сейчас. */

const W = 720;
const H = 276;
const CELL = W / 180;

/* Города, которые на карте почти совпадают: значок отводится в сторону, к точке идёт выноска. */
const NUDGE = { yerevan: [-14, 16], tbilisi: [12, -10], singapore: [10, 12], bangkok: [-6, -12], bali: [12, 10], phuket: [-12, -4] };

export default function WorldMap({
  locations = [],
  people = [],
  selected = null,
  onSelect,
  onPerson,
  myCity = null,
  routeTo = null,
  height = 300,
  interactive = true,
}) {
  const dotsPath = useMemo(() => {
    const s = CELL * 0.5;
    let d = '';
    for (const [fx, fy] of landDots()) {
      d += `M${(fx * W - s / 2).toFixed(1)} ${(fy * H - s / 2).toFixed(1)}h${s.toFixed(2)}v${s.toFixed(2)}h-${s.toFixed(2)}z`;
    }
    return d;
  }, []);

  const pins = useMemo(
    () =>
      locations.map((l) => {
        const c = CITIES[l.city];
        const p = project(c.lat, c.lon);
        return { ...l, x: p.x * W, y: p.y * H, cityName: c.name, flag: c.flag, main: HUB_MAIN.includes(l.city) };
      }),
    [locations]
  );

  const byCity = useMemo(() => {
    const m = {};
    for (const r of people) (m[r.city] ||= []).push(r);
    return m;
  }, [people]);

  const mine = myCity && CITIES[myCity] ? project(CITIES[myCity].lat, CITIES[myCity].lon) : null;
  const dest = routeTo && CITIES[routeTo] ? project(CITIES[routeTo].lat, CITIES[routeTo].lon) : null;

  const box = useRef(null);
  const drag = useRef(null);
  const pointers = useRef(new Map());
  const moved = useRef(false);

  /* Видимая ширина в единицах viewBox: контейнер уже карты, края обрезаются (slice). */
  const visW = () => {
    const r = box.current?.getBoundingClientRect();
    return r && r.height ? Math.min(W, H * (r.width / r.height)) : W;
  };

  const clamp = (v) => {
    const k = Math.max(1, Math.min(7, v.k));
    const vis = visW();
    const left = (W - vis) / 2;
    return {
      k,
      x: Math.min(left, Math.max(left + vis - W * k, v.x)),
      y: Math.min(0, Math.max(H - H * k, v.y)),
    };
  };

  /* Старт: свой город в центре, чуть приближено — видны Европа, Залив и Азия. */
  const [view, setView] = useState(() => {
    const c = myCity && CITIES[myCity] ? project(CITIES[myCity].lat, CITIES[myCity].lon) : { x: 0.6, y: 0.4 };
    const k = 1.2;
    return { k, x: W / 2 - c.x * W * k, y: H / 2 - c.y * H * k };
  });

  useEffect(() => {
    setView((v) => clamp(v));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const focus = (x, y, k) => setView(clamp({ k, x: W / 2 - x * k, y: H / 2 - y * k }));

  useEffect(() => {
    if (!selected) return;
    const pin = pins.find((p) => p.id === selected);
    if (pin) focus(pin.x, pin.y, Math.max(3.4, view.k));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const toLocal = (e) => {
    const r = box.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  const onDown = (e) => {
    if (!interactive) return;
    pointers.current.set(e.pointerId, toLocal(e));
    moved.current = false;
    if (pointers.current.size === 1) drag.current = { ...toLocal(e), view };
  };
  const onMove = (e) => {
    if (!interactive || !pointers.current.has(e.pointerId)) return;
    const now = toLocal(e);
    pointers.current.set(e.pointerId, now);
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (drag.current?.pinch) {
        const p = drag.current.pinch;
        const k = Math.max(1, Math.min(7, p.k * (dist / p.dist)));
        setView(clamp({ k, x: mid.x - ((p.mid.x - p.x) / p.k) * k, y: mid.y - ((p.mid.y - p.y) / p.k) * k }));
      } else drag.current = { pinch: { dist, mid, ...view } };
      moved.current = true;
      return;
    }
    if (!drag.current || drag.current.pinch) return;
    const dx = now.x - drag.current.x, dy = now.y - drag.current.y;
    if (Math.hypot(dx, dy) > 2) moved.current = true;
    setView(clamp({ ...drag.current.view, x: drag.current.view.x + dx, y: drag.current.view.y + dy }));
  };
  const onUp = (e) => {
    pointers.current.delete(e.pointerId);
    drag.current = null;
  };
  const onWheel = (e) => {
    if (!interactive) return;
    const p = toLocal(e);
    setView((v) => {
      const k = Math.max(1, Math.min(7, v.k * (e.deltaY < 0 ? 1.18 : 0.85)));
      return clamp({ k, x: p.x - ((p.x - v.x) / v.k) * k, y: p.y - ((p.y - v.y) / v.k) * k });
    });
  };

  const k = view.k;
  const level = k >= 3.2 ? 2 : k >= 1.7 ? 1 : 0;
  const arc = mine && dest ? arcPath(mine.x * W, mine.y * H, dest.x * W, dest.y * H) : null;

  return (
    <div className="mapwrap" style={{ height }} ref={box}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        style={{ height: '100%', touchAction: 'none' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={onWheel}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${k})`}>
          <path d={dotsPath} fill="#8b97b3" fillOpacity="0.28" />

          {arc && (
            <path d={arc} fill="none" stroke="#D9B26B" strokeOpacity="0.6" strokeWidth={1.1 / k} strokeDasharray={`${4 / k} ${4 / k}`}>
              <animate attributeName="stroke-dashoffset" from="16" to="0" dur="1.2s" repeatCount="indefinite" />
            </path>
          )}

          {mine && (
            <g transform={`translate(${mine.x * W} ${mine.y * H})`}>
              <circle className="pin__halo" r="3" fill="none" stroke="#5FE0C8" strokeWidth={0.9 / k} />
              <circle r={2.8 / k} fill="#5FE0C8" />
            </g>
          )}

          {pins.map((p) => {
            const tone = STATUS[p.status].tone;
            const on = selected === p.id;
            const showBadge = p.main || level >= 1 || on;
            const badge = (p.main ? 15 : 11) / Math.pow(k, 0.62);
            const folks = level >= 2 ? byCity[p.city] || [] : [];
            const nudge = showBadge && NUDGE[p.city] ? NUDGE[p.city] : [0, 0];
            const nx = nudge[0] / Math.sqrt(k), ny = nudge[1] / Math.sqrt(k);
            return (
              <g key={p.id} transform={`translate(${p.x} ${p.y})`}>
                {(nx || ny) && <line x1="0" y1="0" x2={nx} y2={ny} stroke="#D9B26B" strokeOpacity="0.5" strokeWidth={0.7 / k} />}
                {(nx || ny) && <circle r={1.4 / k} fill="#D9B26B" />}
                <g transform={`translate(${nx} ${ny})`}>
                {/* люди раскрываются кольцом вокруг города */}
                {folks.map((r, i) => {
                  const n = folks.length;
                  const ang = -Math.PI / 2 + Math.PI / 6 + (i / n) * Math.PI * 2;
                  const rad = badge + 20 / Math.sqrt(k);
                  const ax = Math.cos(ang) * rad, ay = Math.sin(ang) * rad;
                  const s = 7 / Math.sqrt(k);
                  return (
                    <g key={r.id} transform={`translate(${ax} ${ay})`} className="pin" onClick={(e) => { e.stopPropagation(); if (!moved.current) onPerson?.(r.id); }}>
                      <line x1={-ax * 0.35} y1={-ay * 0.35} x2={0} y2={0} stroke="#D9B26B" strokeOpacity="0.35" strokeWidth={0.6 / k} />
                      <circle r={s} fill={r.tone} stroke="#0a0d15" strokeWidth={1.2 / k} />
                      <text y={s * 0.36} textAnchor="middle" fontSize={s * 0.85} fontWeight="700" fill="#fff" fontFamily="Manrope, sans-serif">{initials(r.name)}</text>
                      {r.online && <circle cx={s * 0.72} cy={s * 0.72} r={s * 0.24} fill="#58D68D" stroke="#0a0d15" strokeWidth={0.6 / k} />}
                    </g>
                  );
                })}

                <g className="pin" onClick={(e) => { e.stopPropagation(); if (!moved.current) onSelect?.(p.id); }}>
                  {showBadge ? (
                    <>
                      {p.status === 'open' && !on && <circle className="pin__halo" r="3" fill="none" stroke={tone} strokeWidth={0.8 / k} />}
                      <circle r={badge} fill="#12141b" stroke={on ? '#F3E0B3' : tone} strokeWidth={(on ? 1.6 : 1) / Math.sqrt(k)} strokeOpacity={p.status === 'vote' ? 0.55 : 1} />
                      <Silhouette city={p.city} size={badge * 1.5} dim={p.status === 'vote'} />
                      {(p.main || on || k >= 2.4) && (
                        <text y={badge + 8 / Math.sqrt(k)} textAnchor="middle" fontSize={7.5 / Math.sqrt(k)} fontWeight="700" fill="#EEF0F6" fillOpacity="0.92" fontFamily="Manrope, sans-serif" style={{ paintOrder: 'stroke' }} stroke="#0a0d15" strokeWidth={2.4 / k}>
                          {p.cityName}
                        </text>
                      )}
                    </>
                  ) : (
                    <>
                      <circle r={9 / k} fill="transparent" />
                      <circle r={3 / Math.sqrt(k)} fill={tone} fillOpacity={p.status === 'vote' ? 0.45 : 1} />
                    </>
                  )}
                </g>
                </g>
              </g>
            );
          })}
        </g>
      </svg>

      {interactive && (
        <div style={{ position: 'absolute', right: 10, bottom: 10, display: 'grid', gap: 6 }}>
          <button className="mapbtn" onClick={() => setView((v) => clamp({ k: v.k * 1.45, x: W / 2 - ((W / 2 - v.x) / v.k) * v.k * 1.45, y: H / 2 - ((H / 2 - v.y) / v.k) * v.k * 1.45 }))}>+</button>
          <button className="mapbtn" onClick={() => setView((v) => clamp({ k: v.k / 1.45, x: W / 2 - ((W / 2 - v.x) / v.k) * (v.k / 1.45), y: H / 2 - ((H / 2 - v.y) / v.k) * (v.k / 1.45) }))}>−</button>
        </div>
      )}
      {interactive && (
        <div style={{ position: 'absolute', left: 10, bottom: 10, fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, background: 'rgba(18,20,27,.85)', padding: '5px 9px', borderRadius: 9 }}>
          {level === 0 ? 'Приблизьте, чтобы увидеть все хабы' : level === 1 ? 'Ещё ближе — появятся резиденты' : 'Нажмите на человека, чтобы открыть профиль'}
        </div>
      )}
    </div>
  );
}

function Silhouette({ city, size, dim }) {
  const lm = LANDMARKS[city];
  if (!lm) return null;
  const s = size / 100;
  return (
    <g transform={`translate(${-size / 2} ${-size / 2 - size * 0.02}) scale(${s})`} opacity={dim ? 0.5 : 1}>
      {lm.parts.map((p, i) =>
        p.c ? (
          <circle key={i} cx={p.c[0]} cy={p.c[1]} r={p.c[2]} fill={p.fill ? '#D9B26B' : 'none'} fillOpacity={p.fill ? 0.3 : 1} stroke="#D9B26B" strokeWidth="3.2" />
        ) : (
          <path key={i} d={p.d} fill={p.fill ? '#D9B26B' : 'none'} fillOpacity={p.fill ? 0.25 : 1} stroke="#D9B26B" strokeWidth={p.thin ? 1.6 : 3.2} strokeLinecap="round" strokeLinejoin="round" />
        )
      )}
    </g>
  );
}

function arcPath(x1, y1, x2, y2) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 - Math.abs(x2 - x1) * 0.22 - 8;
  return `M${x1.toFixed(1)} ${y1.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}
