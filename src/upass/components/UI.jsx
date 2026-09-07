import { useEffect } from 'react';
import Icon from './Icons.jsx';
import { back } from '../lib/router.jsx';

export function TopBar({ title, subtitle, onBack, right, backTo }) {
  return (
    <div className="topbar">
      {(onBack || backTo) && (
        <button className="iconbtn" onClick={() => (onBack ? onBack() : back(backTo))} aria-label="Назад">
          <Icon name="back" size={19} />
        </button>
      )}
      <div className="grow" style={{ minWidth: 0 }}>
        {subtitle && <div className="eyebrow" style={{ marginBottom: 1 }}>{subtitle}</div>}
        <div className="topbar__title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
      </div>
      {right}
    </div>
  );
}

export function Btn({ variant = 'ghost', size, wide, icon, iconRight, children, ...rest }) {
  const cls = ['btn', `btn--${variant}`, size === 'sm' ? 'btn--sm' : '', wide ? 'btn--wide' : ''].filter(Boolean).join(' ');
  return (
    <button className={cls} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 15 : 17} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 15 : 17} />}
    </button>
  );
}

export function Chip({ on, children, ...rest }) {
  return (
    <button className={`chip${on ? ' chip--on' : ''}`} {...rest}>
      {children}
    </button>
  );
}

export function Tag({ tone, plain, children, style }) {
  const cls = ['tag', tone ? `tag--${tone}` : '', plain ? 'tag--plain' : ''].filter(Boolean).join(' ');
  return <span className={cls} style={style}>{children}</span>;
}

export function Card({ as = 'div', variant, tight, pad, className = '', children, ...rest }) {
  const El = as;
  const cls = ['card', variant ? `card--${variant}` : '', tight ? 'card--tight' : '', pad ? 'card--pad' : '', className].filter(Boolean).join(' ');
  return <El className={cls} {...rest}>{children}</El>;
}

export function Section({ eyebrow, title, more, onMore, children }) {
  return (
    <section className="sect">
      {(title || eyebrow) && (
        <div className="sect__head">
          <div>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            {title && <div className="t-lg" style={{ marginTop: eyebrow ? 3 : 0 }}>{title}</div>}
          </div>
          {more && <button className="sect__more" onClick={onMore}>{more}</button>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Seg({ value, onChange, options }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.value} data-on={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function KV({ k, v, tone }) {
  return (
    <div className="kv">
      <div className="kv__k">{k}</div>
      <div className="kv__v" style={tone ? { color: tone } : undefined}>{v}</div>
    </div>
  );
}

export function Bar({ value, tone = '' }) {
  return (
    <div className="bar">
      <div className={`bar__fill${tone ? ` bar__fill--${tone}` : ''}`} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

export function Stat({ v, l, tone }) {
  return (
    <div className="stat">
      <div className="stat__v" style={tone ? { color: tone } : undefined}>{v}</div>
      <div className="stat__l">{l}</div>
    </div>
  );
}

export function Empty({ icon = 'search', title, text, action }) {
  return (
    <div className="card center" style={{ padding: '30px 20px' }}>
      <div style={{ opacity: 0.4, marginBottom: 10 }}><Icon name={icon} size={30} /></div>
      <div className="t-md">{title}</div>
      {text && <div className="t-sm dim" style={{ marginTop: 6, lineHeight: 1.5 }}>{text}</div>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}

export function Sheet({ open, onClose, title, eyebrow, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="sheet__grip" />
        {(title || eyebrow) && (
          <div style={{ marginBottom: 14 }}>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            {title && <h3 className="display" style={{ marginTop: 4 }}>{title}</h3>}
          </div>
        )}
        {children}
      </div>
    </>
  );
}

export function Search({ value, onChange, placeholder = 'Поиск' }) {
  return (
    <div className="search">
      <Icon name="search" size={17} />
      <input className="field" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

export function Scroller({ children }) {
  return <div className="scroller">{children}</div>;
}

export function Lock({ text, action }) {
  return (
    <div className="locked__veil">
      <Icon name="lock" size={20} color="var(--ink-2)" />
      <div className="t-sm dim" style={{ maxWidth: 250, lineHeight: 1.45 }}>{text}</div>
      {action}
    </div>
  );
}

export function Row({ left, title, sub, right, onClick, tone }) {
  return (
    <button className="card tap row" onClick={onClick} style={{ gap: 12 }}>
      {left}
      <div className="grow">
        <div className="t-md" style={{ color: tone }}>{title}</div>
        {sub && <div className="t-xs dim" style={{ marginTop: 2 }}>{sub}</div>}
      </div>
      {right ?? <Icon name="right" size={16} color="var(--ink-4)" />}
    </button>
  );
}
