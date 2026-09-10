import { useEffect, useId, useState } from 'react';
import Icon from './Icons.jsx';
import { back as backNav } from '../lib/router.jsx';
import { hash, initials } from '../lib/format.js';

/* Общие кирпичики: заголовки, списки, кнопки, шторки, аватары. */

export function Top({ title, sub, right, back, backTo }) {
  return (
    <div>
      {back && (
        <button className="backbtn" style={{ marginBottom: 4 }} onClick={() => backNav(backTo)}>
          <Icon name="back" size={18} />
          <span>Назад</span>
        </button>
      )}
      <div className="top">
        <div className="grow">
          <h1 className="h1">{title}</h1>
          {sub && <div className="t-sm dim-2" style={{ marginTop: 4 }}>{sub}</div>}
        </div>
        {right}
      </div>
    </div>
  );
}

/* Липкая шапка вложенного экрана — всегда с подписанным возвратом. */
export function TopBar({ title, sub, backTo, right }) {
  return (
    <div className="topbar">
      <button className="backbtn" onClick={() => backNav(backTo)}>
        <Icon name="back" size={18} />
        <span>Назад</span>
      </button>
      <div className="grow">
        <div className="topbar__title ell">{title}</div>
        {sub && <div className="topbar__sub ell">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

export function Btn({ variant = 'ghost', size, wide, icon, className = '', children, ...rest }) {
  const cls = ['btn', `btn--${variant}`, size === 'sm' ? 'btn--sm' : '', wide ? 'btn--wide' : '', className].filter(Boolean).join(' ');
  return (
    <button className={cls} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 15 : 17} />}
      {children}
    </button>
  );
}

export function Tag({ tone, children, style }) {
  return <span className={`tag${tone ? ` tag--${tone}` : ''}`} style={style}>{children}</span>;
}

export function Chip({ on, children, ...rest }) {
  return <button className={`chip${on ? ' chip--on' : ''}`} {...rest}>{children}</button>;
}

export function Card({ as = 'div', variant, tap, className = '', children, ...rest }) {
  const El = as;
  const cls = ['card', variant ? `card--${variant}` : '', tap ? 'tap' : '', className].filter(Boolean).join(' ');
  return <El className={cls} {...rest}>{children}</El>;
}

export function List({ children, plain, style }) {
  return <div className={`list${plain ? ' list--plain' : ''}`} style={style}>{children}</div>;
}

/* Строка списка: слева иконка или аватар, по центру заголовок и подпись, справа мета. */
export function Item({ lead, icon, title, sub, subWrap, meta, chev = true, onClick, tone, plain }) {
  const El = onClick ? 'button' : 'div';
  return (
    <El className={`item${plain ? ' item--plain' : ''}`} onClick={onClick}>
      {lead}
      {icon && !lead && <div className="item__ic"><Icon name={icon} size={19} /></div>}
      <div className="item__body">
        <div className="item__t" style={tone ? { color: tone } : undefined}>{title}</div>
        {sub && <div className={`item__s${subWrap ? ' item__s--wrap' : ''}`}>{sub}</div>}
      </div>
      {meta !== undefined && <div className="item__meta">{meta}</div>}
      {chev && onClick && <Icon name="right" size={16} className="chev" />}
    </El>
  );
}

export function Section({ title, more, onMore, children }) {
  return (
    <section className="sect">
      {title && (
        <div className="sect__head">
          <div className="hdr">{title}</div>
          {more && <button className="sect__more" onClick={onMore}>{more}</button>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Note({ icon = 'eye', tone = 'var(--ink-3)', children }) {
  return (
    <div className="note">
      <Icon name={icon} size={16} color={tone} />
      <div>{children}</div>
    </div>
  );
}

export function Seg({ value, onChange, options }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.value} data-on={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
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

export function Bar({ value, tone }) {
  return (
    <div className="bar">
      <div className={`bar__fill${tone ? ` bar__fill--${tone}` : ''}`} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
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

export function Empty({ icon = 'search', title, text, action }) {
  return (
    <div className="card center" style={{ padding: '28px 20px' }}>
      <div style={{ opacity: 0.4, marginBottom: 10 }}><Icon name={icon} size={28} /></div>
      <div className="t-md">{title}</div>
      {text && <div className="t-sm dim" style={{ marginTop: 6, lineHeight: 1.5 }}>{text}</div>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}

export function Sheet({ open, onClose, title, sub, children }) {
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
        <button className="sheet__x" onClick={onClose} aria-label="Закрыть"><Icon name="x" size={16} /></button>
        {title && (
          <div style={{ marginBottom: 14, paddingRight: 44 }}>
            <h2 className="h2">{title}</h2>
            {sub && <div className="t-sm dim-2" style={{ marginTop: 4 }}>{sub}</div>}
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

/* Ряд действий — как «написать · позвонить» в профиле мессенджера. */
export function Actions({ items }) {
  return (
    <div className="actions" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
      {items.map((a) => (
        <button key={a.title} className={`action${a.on ? ' action--on' : ''}`} onClick={a.onClick} disabled={a.disabled}>
          <span className="action__ic"><Icon name={a.icon} size={21} /></span>
          <span className="action__t">{a.title}</span>
          {a.badge > 0 && <span className="badge-n">{a.badge}</span>}
        </button>
      ))}
    </div>
  );
}

/* Фильтр-раскрывашка: одна кнопка с текущим выбором, список — шторкой. */
export function Picker({ label, title, options, value, onChange, allLabel = 'Все' }) {
  const [open, setOpen] = useState(false);
  const active = value && value !== 'all';
  const current = options.find((o) => o.id === value);
  return (
    <>
      <button className={`picker${active ? ' picker--on' : ''}`} onClick={() => setOpen(true)}>
        <span className="ell">{current ? current.label : label}</span>
        <Icon name="down" size={14} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={title || label}>
        <List plain>
          <Item plain title={allLabel} chev={false} meta={!active ? <Icon name="check" size={16} color="var(--accent)" /> : undefined} onClick={() => { onChange('all'); setOpen(false); }} />
          {options.map((o) => (
            <Item key={o.id} plain title={o.label} sub={o.sub} chev={false} meta={value === o.id ? <Icon name="check" size={16} color="var(--accent)" /> : undefined} onClick={() => { onChange(o.id); setOpen(false); }} />
          ))}
        </List>
      </Sheet>
    </>
  );
}

export function Switch({ on, onChange, title, sub }) {
  return (
    <button className="switch" data-on={on} onClick={() => onChange(!on)} role="switch" aria-checked={on}>
      <div className="grow">
        <div className="t-md">{title}</div>
        {sub && <div className="t-xs dim-2" style={{ marginTop: 2 }}>{sub}</div>}
      </div>
      <span className="switch__track"><i /></span>
    </button>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label style={{ display: 'block' }}>
      {label && <span className="label">{label}</span>}
      {children}
      {hint && <div className="hint">{hint}</div>}
    </label>
  );
}

/* ---------- аватар: сквиркл, оттенок от имени ---------------------------- */
const TONES = ['#6d9bff', '#8e7bf5', '#79d2bf', '#e9b872', '#f2789b', '#58d68d', '#5fb8e0', '#d98ae6'];

/** Выбор файла: своя кнопка вместо системной «Choose file». */
export function FileButton({ label = 'Выбрать файл', icon = 'download', onFile }) {
  return (
    <label className="filebtn">
      <Icon name={icon} size={17} />
      <span>{label}</span>
      <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} />
    </label>
  );
}

export function toneOf(user) {
  return TONES[hash(user?.name || '?') % TONES.length];
}

export function Avatar({ user, size = 44, ring, style, radius = 0.32 }) {
  const id = useId().replace(/:/g, '');
  const tone = toneOf(user);
  return (
    <div className="ava" style={{ width: size, height: size, fontSize: size * 0.34, ...style }}>
      <div className="ava__img" style={{ borderRadius: size * radius, boxShadow: ring ? `0 0 0 2px ${ring}` : undefined }}>
        {user?.photo ? (
          <img src={user.photo} alt="" />
        ) : (
          <svg viewBox="0 0 100 100">
            <defs>
              <linearGradient id={`av${id}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={tone} stopOpacity="0.95" />
                <stop offset="100%" stopColor="#0b0d14" />
              </linearGradient>
            </defs>
            <rect width="100" height="100" fill={`url(#av${id})`} />
            <circle cx="74" cy="24" r="30" fill="#fff" opacity="0.1" />
          </svg>
        )}
      </div>
      {!user?.photo && <span style={{ position: 'relative' }}>{initials(user?.name)}</span>}
    </div>
  );
}

export function AvatarStack({ users = [], max = 4, size = 28 }) {
  if (!users.length) return null;
  const shown = users.slice(0, max);
  const rest = users.length - shown.length;
  return (
    <div className="ava-stack">
      {shown.map((u) => <Avatar key={u.id} user={u} size={size} />)}
      {rest > 0 && <span className="ava-stack__n">+{rest}</span>}
    </div>
  );
}
