import { useEffect, useMemo, useRef, useState } from 'react';
import { landDots, project } from '../data/world.js';
import { REGIONS, REGION_KEYS } from '../data/regions.js';
import { LANDMARKS } from '../data/landmarks.js';
import { toneOf } from '../data/people.js';
import { initials } from '../lib/format.js';

/* Карта резидентов — из UPASS. Мир точками, пять регионов клуба значками
   с силуэтом. Приблизьте — над значком дугой встанут резиденты: дуга
   держится в верхних 150°, поэтому люди не наезжают ни на значок, ни на подпись. */

const W = 720;
const H = 276;
const CELL = W / 180;

export default function WorldMap({ people = [], selected = null, onSelect, onPerson, myRegion = null, height = 300 }) {
  const dotsPath = useMemo(() => {
    const s = CELL * 0.5;
    let d = '';
    for (const [fx, fy] of landDots()) {
      d += `M${(fx * W - s / 2).toFixed(1)} ${(fy * H - s / 2).toFixed(1)}h${s.toFixed(2)}v${s.toFixed(2)}h-${s.toFixed(2)}z`;
    }
    return d;
  }, []);

  const pins = useMemo(
    () => REGION_KEYS.map((key) => {
      const r = REGIONS[key];
      const p = project(r.lat, r.lon);
      return { key, ...r, x: p.x * W, y: p.y * H };
    }),
    []
  );

  const byRegion = useMemo(() => {
    const m = {};
    for (const p of people) (m[p.region] ||= []).push(p);
    return m;
  }, [people]);

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

  /* На старте видны все регионы сразу: от Майами до Бали. */
  const [view, setView] = useState(() => {
    const xs = pins.map((p) => p.x);
    const ys = pins.map((p) => p.y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    return { k: 1, x: W / 2 - cx, y: H / 2 - cy };
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
      const k = Math.max(3.4, v.k);
      return clamp({ k, x: W / 2 - pin.x * k, y: H / 2 - pin.y * k + 18 });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const toLocal = (e) => {
    const r = box.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  const onDown = (e) => {
    pointers.current.set(e.pointerId, toLocal(e));
    moved.current = false;
    if (pointers.current.size === 1) drag.current = { ...toLocal(e), view };
  };
  const onMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
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
    const p = toLocal(e);
    setView((v) => {
      const k = Math.max(1, Math.min(7, v.k * (e.deltaY < 0 ? 1.18 : 0.85)));
      return clamp({ k, x: p.x - ((p.x - v.x) / v.k) * k, y: p.y - ((p.y - v.y) / v.k) * k });
    });
  };
  const zoomBy = (f) =>
    setView((v) => clamp({ k: v.k * f, x: W / 2 - ((W / 2 - v.x) / v.k) * v.k * f, y: H / 2 - ((H / 2 - v.y) / v.k) * v.k * f }));

  const k = view.k;
  const showPeople = k >= 2.6;

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
          <path d={dotsPath} fill="#8a8a96" fillOpacity="0.24" />

          {pins.map((p) => {
            const on = selected === p.key;
            const mine = myRegion === p.key;
            const R = 15 / Math.pow(k, 0.6);
            const folks = showPeople ? byRegion[p.key] || [] : [];
            const count = (byRegion[p.key] || []).length;
            const dim = selected && !on;
            return (
              <g key={p.key} transform={`translate(${p.x} ${p.y})`} opacity={dim ? 0.5 : 1}>
                {folks.length > 0 && (() => {
                  const a = 8.5 / Math.sqrt(k);
                  const perRow = 5;
                  return folks.map((r, i) => {
                    const row = Math.floor(i / perRow);
                    const idx = i % perRow;
                    const n = Math.min(perRow, folks.length - row * perRow);
                    const SWEEP = (150 * Math.PI) / 180;
                    const stepMax = perRow > 1 ? SWEEP / (perRow - 1) : SWEEP;
                    const need = (a * 1.22) / Math.sin(Math.min(Math.PI / 2, stepMax) / 2);
                    // каждый следующий ряд — на целый аватар дальше, чтобы ряды не наезжали
                    const rad = Math.max(R + a + 6 / Math.sqrt(k), need) + row * a * 2.4;
                    const step = 2 * Math.asin(Math.min(0.85, (a * 1.22) / rad));
                    const ang = -Math.PI / 2 + (idx - (n - 1) / 2) * step;
                    return (
                      <g
                        key={r.id}
                        transform={`translate(${Math.cos(ang) * rad} ${Math.sin(ang) * rad})`}
                        className="pin"
                        onClick={(e) => { e.stopPropagation(); if (!moved.current) onPerson?.(r.id); }}
                      >
                        <rect x={-a} y={-a} width={a * 2} height={a * 2} rx={a * 0.62} fill="#1b1b1f" stroke="#0f0f12" strokeWidth={1.2 / k} />
                        <rect x={-a} y={-a} width={a * 2} height={a * 2} rx={a * 0.62} fill={toneOf(r)} fillOpacity="0.26" />
                        <text y={a * 0.36} textAnchor="middle" fontSize={a * 0.8} fontWeight="650" fill={toneOf(r)} fontFamily="Onest, sans-serif">{initials(r.name)}</text>
                        {r.online && <circle cx={a * 0.8} cy={a * 0.8} r={a * 0.26} fill="#6EE7B7" stroke="#0f0f12" strokeWidth={0.6 / k} />}
                      </g>
                    );
                  });
                })()}

                <g className="pin" onClick={(e) => { e.stopPropagation(); if (!moved.current) onSelect?.(p.key); }}>
                  {mine && !on && <circle className="pin__halo" r="3" fill="none" stroke="#6EE7B7" strokeWidth={0.9 / k} />}
                  <circle r={R} fill="#141417" stroke={on ? '#F3DCA8' : mine ? '#6EE7B7' : '#E6C27A'} strokeWidth={(on ? 1.8 : 1.1) / Math.sqrt(k)} />
                  <Silhouette region={p.key} size={R * 1.5} />
                  <text
                    y={R + 8.5 / Math.sqrt(k)}
                    textAnchor="middle" fontSize={7.6 / Math.sqrt(k)} fontWeight="700" fill="#F4F4F5" fontFamily="Onest, sans-serif"
                    style={{ paintOrder: 'stroke' }} stroke="#0f0f12" strokeWidth={2.4 / k}
                  >
                    {p.name}{count ? ` · ${count}` : ''}
                  </text>
                </g>
              </g>
            );
          })}
        </g>
      </svg>

      <div style={{ position: 'absolute', right: 10, top: 10, display: 'grid', gap: 6 }}>
        <button className="mapbtn" onClick={() => zoomBy(1.5)} aria-label="Приблизить">+</button>
        <button className="mapbtn" onClick={() => zoomBy(1 / 1.5)} aria-label="Отдалить">−</button>
      </div>
      <div className="maplabel">{showPeople ? 'Нажмите на человека — откроется профиль' : 'Приблизьте или нажмите на регион'}</div>
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
          <circle key={i} cx={p.c[0]} cy={p.c[1]} r={p.c[2]} fill={p.fill ? '#E6C27A' : 'none'} fillOpacity={p.fill ? 0.3 : 1} stroke="#E6C27A" strokeWidth="3.2" />
        ) : (
          <path key={i} d={p.d} fill={p.fill ? '#E6C27A' : 'none'} fillOpacity={p.fill ? 0.25 : 1} stroke="#E6C27A" strokeWidth={p.thin ? 1.6 : 3.2} strokeLinecap="round" strokeLinejoin="round" />
        )
      )}
    </g>
  );
}
