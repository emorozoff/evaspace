import { useMemo, useRef, useState, useEffect } from 'react';
import { landDots, project } from '../data/world.js';
import { CITIES, STATUS } from '../data/places.js';

/* Карта мира точками. Всё рисуется из вшитой маски суши — без тайлов и сети. */

const W = 720;
const H = 276;
const CELL = W / 180;

export default function WorldMap({
  locations = [],
  selected = null,
  onSelect,
  myCity = null,
  routeTo = null,
  height = 250,
  interactive = true,
}) {
  const dotsPath = useMemo(() => {
    const s = CELL * 0.52;
    let d = '';
    for (const [fx, fy] of landDots()) {
      const x = (fx * W - s / 2).toFixed(1);
      const y = (fy * H - s / 2).toFixed(1);
      d += `M${x} ${y}h${s.toFixed(2)}v${s.toFixed(2)}h-${s.toFixed(2)}z`;
    }
    return d;
  }, []);

  const pins = useMemo(
    () =>
      locations.map((l) => {
        const c = CITIES[l.city];
        const p = project(c.lat, c.lon);
        return { ...l, x: p.x * W, y: p.y * H, city: l.city, cityName: c.name, flag: c.flag };
      }),
    [locations]
  );

  const mine = myCity && CITIES[myCity] ? project(CITIES[myCity].lat, CITIES[myCity].lon) : null;
  const dest = routeTo && CITIES[routeTo] ? project(CITIES[routeTo].lat, CITIES[routeTo].lon) : null;

  /* --- панорама и масштаб ------------------------------------------------- */
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const box = useRef(null);
  const drag = useRef(null);
  const pointers = useRef(new Map());

  useEffect(() => {
    if (!selected) return;
    const pin = pins.find((p) => p.id === selected);
    if (!pin) return;
    const k = 2.2;
    setView({ k, x: W / 2 - pin.x * k, y: H / 2 - pin.y * k });
  }, [selected, pins]);

  const clamp = (v) => {
    const k = Math.max(1, Math.min(5, v.k));
    return {
      k,
      x: Math.min(0, Math.max(W - W * k, v.x)),
      y: Math.min(0, Math.max(H - H * k, v.y)),
    };
  };

  const toLocal = (e) => {
    const r = box.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  const onDown = (e) => {
    if (!interactive) return;
    pointers.current.set(e.pointerId, toLocal(e));
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (pointers.current.size === 1) drag.current = { ...toLocal(e), view };
  };

  const onMove = (e) => {
    if (!interactive || !pointers.current.has(e.pointerId)) return;
    const now = toLocal(e);
    pointers.current.set(e.pointerId, now);

    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (drag.current?.pinch) {
        const ratio = dist / drag.current.pinch.dist;
        const mid = drag.current.pinch.mid;
        setView((v) => {
          const k = Math.max(1, Math.min(5, drag.current.pinch.k * ratio));
          return clamp({ k, x: mid.x - ((mid.x - drag.current.pinch.x) / drag.current.pinch.k) * k, y: mid.y - ((mid.y - drag.current.pinch.y) / drag.current.pinch.k) * k });
        });
      } else {
        drag.current = { pinch: { dist, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, ...view } };
      }
      return;
    }

    if (!drag.current || drag.current.pinch) return;
    setView(clamp({ ...drag.current.view, x: drag.current.view.x + (now.x - drag.current.x), y: drag.current.view.y + (now.y - drag.current.y) }));
  };

  const onUp = (e) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) drag.current = null;
    else drag.current = null;
  };

  const onWheel = (e) => {
    if (!interactive) return;
    const p = toLocal(e);
    setView((v) => {
      const k = Math.max(1, Math.min(5, v.k * (e.deltaY < 0 ? 1.16 : 0.86)));
      return clamp({ k, x: p.x - ((p.x - v.x) / v.k) * k, y: p.y - ((p.y - v.y) / v.k) * k });
    });
  };

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
        <defs>
          <radialGradient id="glow" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#D7B06A" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#D7B06A" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          <path d={dotsPath} fill="#7d8aa5" fillOpacity="0.3" />

          {arc && (
            <path d={arc} fill="none" stroke="#D7B06A" strokeOpacity="0.55" strokeWidth={1 / view.k} strokeDasharray={`${4 / view.k} ${4 / view.k}`}>
              <animate attributeName="stroke-dashoffset" from="16" to="0" dur="1.2s" repeatCount="indefinite" />
            </path>
          )}

          {mine && (
            <g transform={`translate(${mine.x * W} ${mine.y * H})`}>
              <circle r={9 / view.k} fill="url(#glow)" />
              <circle r={2.6 / view.k} fill="#5FE0C8" />
              <circle className="pin__halo" r="3" fill="none" stroke="#5FE0C8" strokeWidth={0.8 / view.k} />
            </g>
          )}

          {pins.map((p) => {
            const tone = STATUS[p.status].tone;
            const on = selected === p.id;
            return (
              <g key={p.id} className="pin" transform={`translate(${p.x} ${p.y})`} onClick={() => onSelect?.(p.id)}>
                <circle r={11 / view.k} fill="transparent" />
                {p.status === 'open' && <circle className="pin__halo" r="3" fill="none" stroke={tone} strokeWidth={0.7 / view.k} />}
                <circle r={(on ? 5 : 3.4) / view.k} fill={tone} fillOpacity={p.status === 'vote' ? 0.35 : 0.95} stroke={tone} strokeWidth={0.8 / view.k} />
                {on && <circle r={8 / view.k} fill="none" stroke={tone} strokeWidth={1 / view.k} strokeOpacity="0.6" />}
                {view.k > 1.7 && (
                  <text x={7 / view.k} y={3 / view.k} fontSize={8 / view.k} fill="#EEF0F6" fillOpacity="0.85" fontFamily="Manrope, sans-serif" fontWeight="700">
                    {p.cityName}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {interactive && (
        <div style={{ position: 'absolute', right: 10, bottom: 10, display: 'grid', gap: 6 }}>
          <MapBtn onClick={() => setView((v) => clamp({ ...v, k: v.k * 1.4 }))}>+</MapBtn>
          <MapBtn onClick={() => setView((v) => clamp({ ...v, k: v.k / 1.4 }))}>−</MapBtn>
        </div>
      )}
    </div>
  );
}

function MapBtn({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center',
        background: 'rgba(12,14,20,.8)', border: '1px solid var(--line-2)', color: 'var(--ink-2)',
        fontSize: 16, fontWeight: 700, backdropFilter: 'blur(8px)',
      }}
    >
      {children}
    </button>
  );
}

/* дуга «перелёта» между двумя точками */
function arcPath(x1, y1, x2, y2) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 - Math.abs(x2 - x1) * 0.22 - 8;
  return `M${x1.toFixed(1)} ${y1.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}
