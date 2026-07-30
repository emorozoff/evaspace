import { useEffect, useMemo, useRef, useState } from 'react';
import Art from './Art.jsx';
import { IcStar, IcSparkStar, IcBack, IcClock, IcPlay, IcCheck } from './Icons.jsx';
import { TYPE_META, expertById } from '../data/content.js';
import { back as goBack, go } from '../lib/router.jsx';

/* --------- звёздное небо (декор) --------- */
export function StarField({ n = 40, seed = 5, className = 'sky' }) {
  const dots = useMemo(() => {
    let x = seed * 7919;
    const rnd = () => ((x = (x * 9301 + 49297) % 233280), x / 233280);
    return Array.from({ length: n }, (_, i) => ({
      k: i,
      left: rnd() * 100,
      top: rnd() * 100,
      s: rnd() * 2.2 + 0.8,
      d: rnd() * 4,
      o: rnd() * 0.6 + 0.35,
    }));
  }, [n, seed]);
  return (
    <div className={className} aria-hidden="true">
      {dots.map((d) => (
        <span
          key={d.k}
          style={{
            position: 'absolute',
            left: d.left + '%',
            top: d.top + '%',
            width: d.s,
            height: d.s,
            borderRadius: '50%',
            background: '#fff',
            opacity: d.o,
            animation: `twinkle ${2.4 + d.d}s ease-in-out ${d.d}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

/* --------- аватар --------- */
export function Avatar({ name = '', hue = 320, size = 42, ring = false }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flex: 'none',
        display: 'grid',
        placeItems: 'center',
        color: '#fff',
        fontWeight: 800,
        fontSize: size * 0.36,
        background: `linear-gradient(135deg, hsl(${hue} 70% 68%), hsl(${hue + 40} 55% 42%))`,
        boxShadow: ring ? '0 0 0 3px rgba(255,255,255,.7)' : 'none',
      }}
    >
      {initials || '★'}
    </div>
  );
}

/* --------- звёзды дня --------- */
export function StarRow({ count = 0, total = 3, size = 18, gold = '#d5a45c' }) {
  return (
    <div className="stars-row">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className="star-dot" style={{ color: i < count ? gold : 'rgba(59,30,78,.16)' }}>
          <IcStar size={size} filled={i < count} />
        </span>
      ))}
    </div>
  );
}

/* --------- кольцо совпадения --------- */
export function MatchRing({ percent = 80, size = 46, color = '#b64f7c' }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="match-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(59,30,78,.1)" strokeWidth="4" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - percent / 100)}
          style={{ transition: 'stroke-dashoffset .9s cubic-bezier(.4,0,.2,1)' }}
        />
      </svg>
      <b style={{ color }}>{percent}%</b>
    </div>
  );
}

/* --------- шапка --------- */
export function TopBar({ title, onBack, right, dark = false, sub }) {
  return (
    <div className={'topbar' + (dark ? ' on-dark' : '')}>
      {onBack !== false && (
        <button className="icon-btn" onClick={onBack || goBack} aria-label="Назад">
          <IcBack size={20} />
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{ margin: 0 }}>{title}</h1>
        {sub && <div className="tiny muted" style={{ marginTop: 1 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

/* --------- логотип --------- */
export function Logo({ size = 22, withText = true, light = false }) {
  return (
    <div className="row" style={{ gap: 8 }}>
      <span style={{ color: light ? '#f6dfae' : '#b64f7c', display: 'grid', placeItems: 'center' }}>
        <IcSparkStar size={size} />
      </span>
      {withText && (
        <span className="serif" style={{ fontSize: size * 0.86, letterSpacing: 1.2, color: light ? '#fff' : 'var(--plum)' }}>
          EVA SPACE
        </span>
      )}
    </div>
  );
}

/* --------- карточка урока (крупная) --------- */
export function LessonCard({ lesson, percent, onClick, done, width = 232, tagLine }) {
  if (!lesson) return null;
  const m = TYPE_META[lesson.type];
  const ex = expertById(lesson.expert);
  return (
    <button className="card" style={{ width, textAlign: 'left' }} onClick={onClick}>
      <Art art={lesson.art} id={lesson.id} image={lesson.image} ratio="16-10">
        <div className="art-overlay" />
        <div style={{ position: 'absolute', top: 10, left: 10 }}>
          <span className="tag" style={{ background: 'rgba(255,255,255,.9)', color: m.color }}>
            {m.emoji} {m.short}
          </span>
        </div>
        {typeof percent === 'number' && (
          <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(255,255,255,.92)', borderRadius: 999, padding: '3px 9px', fontSize: 11, fontWeight: 800, color: '#b64f7c' }}>
            {percent}%
          </div>
        )}
        {done && (
          <div style={{ position: 'absolute', right: 10, bottom: 10, width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg,#f6dfae,#d5a45c)', color: '#fff', display: 'grid', placeItems: 'center' }}>
            <IcCheck size={15} />
          </div>
        )}
        <div style={{ position: 'absolute', left: 12, right: 12, bottom: 10, color: '#fff' }}>
          <div className="ttl" style={{ fontSize: 15 }}>{lesson.title}</div>
          <div className="tiny" style={{ opacity: 0.85, marginTop: 2 }}>
            {ex.name} · {lesson.min} мин
          </div>
        </div>
      </Art>
      {tagLine && (
        <div className="card-pad" style={{ paddingTop: 10, paddingBottom: 12 }}>
          <div className="tiny muted">{tagLine}</div>
        </div>
      )}
    </button>
  );
}

/* --------- строка урока (список) --------- */
export function LessonRow({ lesson, right, onClick, percent, done }) {
  const m = TYPE_META[lesson.type];
  const ex = expertById(lesson.expert);
  return (
    <button className="list-item" style={{ width: '100%', textAlign: 'left' }} onClick={onClick}>
      <div className="thumb wide">
        <Art art={lesson.art} id={lesson.id} image={lesson.image} ratio="16-10" />
        {lesson.type !== 'affirmation' && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,.4)' }}>
            <IcPlay size={20} />
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row" style={{ gap: 6, marginBottom: 3 }}>
          <span className="tiny" style={{ fontWeight: 800, color: m.color }}>{m.short}</span>
          {typeof percent === 'number' && <span className="tiny muted">· {percent}% совпадение</span>}
        </div>
        <div className="ttl">{lesson.title}</div>
        <div className="tiny muted row" style={{ gap: 5, marginTop: 3 }}>
          <IcClock size={12} /> {lesson.min} мин · {ex.name}
        </div>
      </div>
      {done ? (
        <div className="done-check on"><IcCheck size={16} /></div>
      ) : (
        right || null
      )}
    </button>
  );
}

/* --------- нижний лист --------- */
export function Sheet({ open, onClose, children, title }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="sheet-back" onClick={onClose} />
      <div className="sheet">
        <div className="grabber" />
        {title && (
          <div className="pad" style={{ paddingBottom: 8 }}>
            <div className="sect-title" style={{ fontSize: 21 }}>{title}</div>
          </div>
        )}
        {children}
      </div>
    </>
  );
}

/* --------- всплывающее сообщение --------- */
export function Toast({ text, onDone }) {
  const cb = useRef(onDone);
  cb.current = onDone;
  useEffect(() => {
    if (!text) return;
    const t = setTimeout(() => cb.current?.(), 2600);
    return () => clearTimeout(t);
  }, [text]);
  if (!text) return null;
  return (
    <div className="toast">
      <IcSparkStar size={16} /> {text}
    </div>
  );
}

/* --------- салют из звёздочек --------- */
export function Celebrate({ trigger }) {
  const [items, setItems] = useState([]);
  const prev = useRef(trigger);
  useEffect(() => {
    if (trigger === prev.current) return;
    prev.current = trigger;
    const now = Date.now();
    setItems(
      Array.from({ length: 14 }, (_, i) => ({
        k: now + i,
        left: 10 + Math.random() * 80,
        delay: Math.random() * 0.35,
        emo: ['✨', '⭐️', '🌸', '💫', '🤍'][i % 5],
      }))
    );
    const t = setTimeout(() => setItems([]), 2000);
    return () => clearTimeout(t);
  }, [trigger]);
  if (!items.length) return null;
  return (
    <div className="confetti">
      {items.map((c) => (
        <i key={c.k} style={{ left: c.left + '%', animationDelay: c.delay + 's' }}>{c.emo}</i>
      ))}
    </div>
  );
}

/* --------- пустое состояние --------- */
export function Empty({ emoji = '🌸', title, text, action }) {
  return (
    <div className="empty">
      <div style={{ fontSize: 40, marginBottom: 10 }}>{emoji}</div>
      <div style={{ fontWeight: 800, marginBottom: 6, color: 'var(--plum)' }}>{title}</div>
      {text && <div className="small">{text}</div>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

/* --------- цена --------- */
export function Price({ value, old }) {
  return (
    <div className="row" style={{ gap: 6 }}>
      <span className="price">{value.toLocaleString('ru-RU')} ₽</span>
      {old && <span className="strike">{old.toLocaleString('ru-RU')} ₽</span>}
    </div>
  );
}

export function goTo(p) {
  go(p);
}
