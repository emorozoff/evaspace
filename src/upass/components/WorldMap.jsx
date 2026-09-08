import { useEffect, useMemo, useRef, useState } from 'react';
import { landDots, project, distanceKm } from '../data/world.js';
import { REGIONS, TIERS_REGION, MAIN_REGIONS } from '../data/regions.js';
import { LANDMARKS } from '../data/landmarks.js';
import { toneOf } from '../data/people.js';
import { initials } from '../lib/format.js';

/* Карта регионов. Три уровня: обзор — четыре основных региона со значками;
   ближе — все двадцать; вплотную — резиденты дугой НАД значком, чтобы никогда
   не перекрывать ни сам хаб, ни его подпись снизу. */

const W = 720;
const H = 276;
const CELL = W / 180;

/* Регионы, которые на карте почти совпадают: значок отводится, к точке идёт выноска. */
const NUDGE = { yerevan: [-15, 15], tbilisi: [11, -11], singapore: [9, 13], bangkok: [-7, -13], bali: [13, 9], phuket: [-13, -3], miami: [6, 12] };

export default function WorldMap({
  regions = [],
  people = [],
  selected = null,
  onSelect,
  onPerson,
  myRegion = null,
  height = 320,
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
      regions.map((key) => {
        const r = REGIONS[key];
        const p = project(r.lat, r.lon);
        return { key, ...r, x: p.x * W, y: p.y * H, main: MAIN_REGIONS.includes(key) };
      }),
    [regions]
  );

  const byRegion = useMemo(() => {
    const m = {};
    for (const r of people) (m[r.city] ||= []).push(r);
    return m;
  }, [people]);

  const mine = myRegion && REGIONS[myRegion] ? project(REGIONS[myRegion].lat, REGIONS[myRegion].lon) : null;
  const dest = selected && REGIONS[selected] ? project(REGIONS[selected].lat, REGIONS[selected].lon) : null;

  const box = useRef(null);
  const drag = useRef(null);
  const pointers = useRef(new Map());
  const moved = useRef(false);

  const visW = () => {
    const r = box.current?.getBoundingClientRect();
    return r && r.height ? Math.min(W, H * (r.width / r.height)) : W;
  };

  const clamp = (v) => {
    const k = Math.max(1, Math.min(7, v.k));
    const vis = visW();
    const left = (W - vis) / 2;
    return { k, x: Math.min(left, Math.max(left + vis - W * k, v.x)), y: Math.min(0, Math.max(H - H * k, v.y)) };
  };

  const [view, setView] = useState(() => {
    const c = myRegion && REGIONS[myRegion] ? project(REGIONS[myRegion].lat, REGIONS[myRegion].lon) : { x: 0.6, y: 0.4 };
    const k = 1.25;
    return { k, x: W / 2 - c.x * W * k, y: H / 2 - c.y * H * k };
  });

  useEffect(() => {
    setView((v) => clamp(v));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selected) return;
    const pin = pins.find((p) => p.key === selected);
    if (!pin) return;
    setView((v) => {
      const k = Math.max(3.2, v.k);
      return clamp({ k, x: W / 2 - pin.x * k, y: H / 2 - pin.y * k });
    });
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

  const zoomBy = (f) =>
    setView((v) => clamp({ k: v.k * f, x: W / 2 - ((W / 2 - v.x) / v.k) * v.k * f, y: H / 2 - ((H / 2 - v.y) / v.k) * v.k * f }));

  const k = view.k;
  const showPeople = k >= 3;
  const showAll = k >= 1.7;
  const arc = mine && dest && selected !== myRegion ? arcPath(mine.x * W, mine.y * H, dest.x * W, dest.y * H) : null;

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
          <path d={dotsPath} fill="#8b97b3" fillOpacity="0.26" />

          {arc && (
            <path d={arc} fill="none" stroke="#D9B26B" strokeOpacity="0.7" strokeWidth={1.2 / k} strokeDasharray={`${4 / k} ${4 / k}`}>
              <animate attributeName="stroke-dashoffset" from="16" to="0" dur="1.2s" repeatCount="indefinite" />
            </path>
          )}

          {mine && (
            <g transform={`translate(${mine.x * W} ${mine.y * H})`}>
              <circle className="pin__halo" r="3" fill="none" stroke="#5FE0C8" strokeWidth={0.9 / k} />
              <circle r={2.6 / k} fill="#5FE0C8" />
            </g>
          )}

          {pins.map((p) => {
            const tone = TIERS_REGION[p.tier].tone;
            const on = selected === p.key;
            const badged = p.main || showAll || on;
            const R = (p.main ? 15 : 11.5) / Math.pow(k, 0.6);
            const n = NUDGE[p.key] && badged ? NUDGE[p.key] : [0, 0];
            const nx = n[0] / Math.sqrt(k), ny = n[1] / Math.sqrt(k);
            const folks = showPeople ? byRegion[p.key] || [] : [];
            const dim = selected && !on;

            return (
              <g key={p.key} transform={`translate(${p.x} ${p.y})`} opacity={dim ? 0.45 : 1}>
                {(nx || ny) && <line x1="0" y1="0" x2={nx} y2={ny} stroke="#D9B26B" strokeOpacity="0.45" strokeWidth={0.7 / k} />}
                {(nx || ny) && <circle r={1.4 / k} fill="#D9B26B" />}

                <g transform={`translate(${nx} ${ny})`}>
                  {/* Резиденты — дугой над значком. Шаг по углу считается из размера
                      аватара и радиуса, поэтому они не наезжают ни друг на друга,
                      ни на сам значок, ни на подпись снизу. */}
                  {folks.length > 0 && (() => {
                    const a = 8.5 / Math.sqrt(k);            // половина стороны аватара
                    const perRow = 5;
                    const rows = Math.ceil(folks.length / perRow);
                    return folks.map((r, i) => {
                      const row = Math.floor(i / perRow);
                      const idx = i % perRow;
                      const count = Math.min(perRow, folks.length - row * perRow);
                      /* дуга держится в верхних 150°, поэтому люди никогда не сползают
                         на бока значка: при нехватке места растёт радиус, а не размах */
                      const SWEEP = (150 * Math.PI) / 180;
                      const base = R + a + (6 + row * a * 2.6) / Math.sqrt(k);
                      const stepMax = count > 1 ? SWEEP / (count - 1) : SWEEP;
                      const need = (a * 1.22) / Math.sin(Math.min(Math.PI / 2, stepMax) / 2);
                      const rad = Math.max(base, need);
                      const step = 2 * Math.asin(Math.min(0.85, (a * 1.22) / rad));
                      const ang = -Math.PI / 2 + (idx - (count - 1) / 2) * step;
                      const ax = Math.cos(ang) * rad, ay = Math.sin(ang) * rad;
                      return (
                        <g
                          key={r.id}
                          transform={`translate(${ax} ${ay})`}
                          className="pin"
                          onClick={(e) => { e.stopPropagation(); if (!moved.current) onPerson?.(r.id); }}
                        >
                          <rect x={-a} y={-a} width={a * 2} height={a * 2} rx={a * 0.62} fill={toneOf(r)} stroke="#0a0d15" strokeWidth={1.2 / k} />
                          <text y={a * 0.36} textAnchor="middle" fontSize={a * 0.8} fontWeight="700" fill="#fff" fontFamily="Manrope, sans-serif">
                            {initials(r.name)}
                          </text>
                          {r.online && <circle cx={a * 0.8} cy={a * 0.8} r={a * 0.26} fill="#58D68D" stroke="#0a0d15" strokeWidth={0.6 / k} />}
                        </g>
                      );
                    });
                  })()}

                  <g className="pin" onClick={(e) => { e.stopPropagation(); if (!moved.current) onSelect?.(p.key); }}>
                    {badged ? (
                      <>
                        {p.tier === 'core' && !on && <circle className="pin__halo" r="3" fill="none" stroke={tone} strokeWidth={0.8 / k} />}
                        <circle r={R} fill="#12141b" stroke={on ? '#F3E0B3' : tone} strokeWidth={(on ? 1.8 : 1) / Math.sqrt(k)} />
                        <Silhouette region={p.key} size={R * 1.5} />
                        {(p.main || on || showAll) && (
                          <text
                            y={R + 8 / Math.sqrt(k)}
                            textAnchor="middle"
                            fontSize={7.5 / Math.sqrt(k)}
                            fontWeight="700"
                            fill="#EEF0F6"
                            fillOpacity="0.94"
                            fontFamily="Manrope, sans-serif"
                            style={{ paintOrder: 'stroke' }}
                            stroke="#0a0d15"
                            strokeWidth={2.4 / k}
                          >
                            {p.name}
                          </text>
                        )}
                      </>
                    ) : (
                      <>
                        <circle r={9 / k} fill="transparent" />
                        <circle r={3 / Math.sqrt(k)} fill={tone} />
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
        <>
          <div style={{ position: 'absolute', right: 10, bottom: 10, display: 'grid', gap: 6 }}>
            <button className="mapbtn" onClick={() => zoomBy(1.45)} aria-label="Приблизить">+</button>
            <button className="mapbtn" onClick={() => zoomBy(1 / 1.45)} aria-label="Отдалить">−</button>
          </div>
          <div style={{ position: 'absolute', left: 10, bottom: 10, fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, background: 'rgba(18,20,27,.85)', padding: '5px 9px', borderRadius: 9 }}>
            {!showAll ? 'Приблизьте — появятся все регионы' : !showPeople ? 'Ещё ближе — появятся резиденты' : 'Нажмите на человека — откроется профиль'}
          </div>
        </>
      )}
    </div>
  );
}

function Silhouette({ region, size }) {
  const lm = LANDMARKS[region];
  if (!lm) return null;
  const s = size / 100;
  return (
    <g transform={`translate(${-size / 2} ${-size / 2 - size * 0.02}) scale(${s})`}>
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
