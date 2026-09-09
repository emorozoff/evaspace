import { useEffect } from 'react';
import { hash, initials } from '../lib/format.js';
import { back } from '../lib/router.jsx';
import { IcBack, IcClose } from './Icons.jsx';

/* Общие кирпичики интерфейса. */

export function Avatar({ user, size = 38, ring = false }) {
  const name = user?.name || '?';
  const hue = hash(name) % 360;
  const style = {
    width: size,
    height: size,
    fontSize: Math.round(size * 0.37),
    background: user?.photo ? 'var(--card-2)' : `linear-gradient(145deg, hsl(${hue} 34% 68%), hsl(${(hue + 40) % 360} 30% 52%))`,
    boxShadow: ring ? '0 0 0 2px var(--lime)' : undefined,
  };
  return (
    <div className="avatar" style={style} aria-hidden>
      {user?.photo ? <img src={user.photo} alt="" loading="lazy" /> : initials(name)}
    </div>
  );
}

export function AvatarStack({ users = [], max = 8, size = 30 }) {
  const shown = users.slice(0, max);
  const rest = users.length - shown.length;
  if (!users.length) return null;
  return (
    <div className="stackav">
      {shown.map((u) => (
        <Avatar key={u.id} user={u} size={size} />
      ))}
      {rest > 0 && <div className="more">+{rest}</div>}
    </div>
  );
}

export function Btn({ kind = '', wide, small, className = '', children, ...rest }) {
  return (
    <button className={`btn ${kind} ${wide ? 'wide' : ''} ${small ? 's' : ''} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function Chip({ on, kind = '', children, ...rest }) {
  return (
    <span className={`chip ${kind} ${on ? 'on' : ''} ${rest.onClick ? '' : 'static'}`} {...rest}>
      {children}
    </span>
  );
}

export function Card({ kind = '', tap, className = '', children, ...rest }) {
  return (
    <div className={`card ${kind} ${tap ? 'tap' : ''} ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      {label && <span>{label}</span>}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

export function Input({ label, hint, ...rest }) {
  return (
    <Field label={label} hint={hint}>
      <input {...rest} />
    </Field>
  );
}

export function Area({ label, hint, ...rest }) {
  return (
    <Field label={label} hint={hint}>
      <textarea {...rest} />
    </Field>
  );
}

export function Select({ label, hint, children, ...rest }) {
  return (
    <Field label={label} hint={hint}>
      <select {...rest}>{children}</select>
    </Field>
  );
}

export function Switch({ on, onChange, title, sub }) {
  return (
    <div className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)} role="switch" aria-checked={on}>
      <div>
        <div style={{ fontWeight: 600 }}>{title}</div>
        {sub && <div className="t-dim">{sub}</div>}
      </div>
      <div className="track">
        <i />
      </div>
    </div>
  );
}

export function Segmented({ value, options, onChange }) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Sheet({ title, sub, onClose, children }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grip" />
        {title && (
          <div className="split" style={{ marginBottom: 14 }}>
            <div>
              <h3>{title}</h3>
              {sub && <div className="t-sub">{sub}</div>}
            </div>
            <button className="iconbtn" onClick={onClose} aria-label="Закрыть">
              <IcClose />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function TopBar({ title, sub, onBack, right, children }) {
  return (
    <div className="topbar">
      {onBack !== false && (
        <button className="iconbtn" onClick={onBack || back} aria-label="Назад">
          <IcBack />
        </button>
      )}
      <div style={{ minWidth: 0 }}>
        <h1 className="ellipsis">{title}</h1>
        {sub && <div className="sub ellipsis">{sub}</div>}
      </div>
      <div className="spacer" />
      {right}
      {children}
    </div>
  );
}

export function Empty({ title, text, action }) {
  return (
    <div className="empty">
      <div className="t-title">{title}</div>
      {text && <div className="t-sub" style={{ marginBottom: action ? 16 : 0 }}>{text}</div>}
      {action}
    </div>
  );
}

export function Stat({ value, label, tone = '' }) {
  return (
    <div className="stat">
      <div className={`v mono ${tone}`}>{value}</div>
      <div className="k">{label}</div>
    </div>
  );
}

export function Progress({ percent, violet }) {
  return (
    <div className={`progress ${violet ? 'violet' : ''}`}>
      <i style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
    </div>
  );
}

export function Section({ title, action, onAction }) {
  return (
    <div className="section">
      <h2>{title}</h2>
      {action && (
        <span className="link" onClick={onAction}>
          {action}
        </span>
      )}
    </div>
  );
}
