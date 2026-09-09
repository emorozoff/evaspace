import { useEffect, useState } from 'react';
import Icon from './Icons.jsx';
import { back } from '../lib/router.jsx';

/* Заголовок экрана: большой заголовок и одно-два действия справа. */
export function Top({ title, right, sub }) {
  return (
    <div className="top">
      <div className="grow" style={{ minWidth: 0 }}>
        <h1 className="h1">{title}</h1>
        {sub && <div className="t-sm dim-2" style={{ marginTop: 4 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

/* Липкая шапка вложенного экрана. */
export function TopBar({ title, sub, backTo, onBack, right }) {
  return (
    <div className="topbar">
      <button className="iconbtn" onClick={() => (onBack ? onBack() : back(backTo))} aria-label="Назад">
        <Icon name="back" size={19} />
      </button>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="topbar__title ell">{title}</div>
        {sub && <div className="topbar__sub ell">{sub}</div>}
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
  return <button className={`chip${on ? ' chip--on' : ''}`} {...rest}>{children}</button>;
}

export function Tag({ tone, plain, children, style }) {
  const cls = ['tag', tone ? `tag--${tone}` : '', plain ? 'tag--plain' : ''].filter(Boolean).join(' ');
  return <span className={cls} style={style}>{children}</span>;
}

export function Card({ as = 'div', variant, className = '', children, ...rest }) {
  const El = as;
  const cls = ['card', variant ? `card--${variant}` : '', className].filter(Boolean).join(' ');
  return <El className={cls} {...rest}>{children}</El>;
}

/* Группа строк как в мессенджере. */
export function List({ children, plain, style }) {
  return <div className={`list${plain ? ' list--plain' : ''}`} style={style}>{children}</div>;
}

/* Строка списка: слева иконка или аватар, по центру заголовок и подпись, справа мета. */
export function Item({ lead, icon, title, sub, subWrap, meta, chev = true, onClick, as, tone, plain }) {
  const El = as || (onClick ? 'button' : 'div');
  return (
    <El className={`item${plain ? ' item--plain' : ''}`} onClick={onClick}>
      {lead}
      {icon && !lead && <div className="item__ic"><Icon name={icon} size={19} /></div>}
      <div className="item__body">
        <div className="item__t" style={tone ? { color: tone } : undefined}>{title}</div>
        {sub && <div className={`item__s${subWrap ? ' item__s--wrap' : ''}`}>{sub}</div>}
      </div>
      {meta !== undefined && <div className="item__meta">{meta}</div>}
      {chev && onClick && <Icon name="right" size={16} className="chev" color="var(--ink-4)" />}
    </El>
  );
}

export function Section({ id, title, more, onMore, children }) {
  return (
    <section className="sect" id={id}>
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

export function Note({ icon = 'eye', children, tone = 'var(--ink-3)' }) {
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
        {title && (
          <div style={{ marginBottom: 14 }}>
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

/* Ряд круглых действий: как «написать · позвонить · видео» в профиле мессенджера. */
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

/* Фильтр-раскрывашка. Вместо длинной ленты чипов — одна кнопка с текущим
   выбором; список открывается шторкой. Так три фильтра занимают одну строку. */
export function Picker({ label, summary, title, sub, options, value, onChange, multi = false, allLabel }) {
  const [open, setOpen] = useState(false);
  const chosen = multi ? value || [] : value;
  const active = multi ? chosen.length > 0 : chosen && chosen !== 'all';

  const pickOne = (id) => {
    if (!multi) {
      onChange(id);
      setOpen(false);
      return;
    }
    onChange(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]);
  };

  return (
    <>
      <button className={`picker${active ? ' picker--on' : ''}`} onClick={() => setOpen(true)}>
        <span className="picker__t ell">{summary || label}</span>
        <Icon name="down" size={14} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={title || label} sub={sub}>
        <div className="list">
          {allLabel && (
            <Item
              plain
              title={allLabel}
              meta={!active ? <Icon name="check" size={16} color="var(--gold)" /> : undefined}
              chev={false}
              onClick={() => { onChange(multi ? [] : 'all'); setOpen(false); }}
            />
          )}
          {options.map((o) => {
            const on = multi ? chosen.includes(o.id) : chosen === o.id;
            return (
              <Item
                key={o.id}
                plain
                lead={o.lead ? <span className="picker__lead">{o.lead}</span> : undefined}
                title={o.name}
                sub={o.sub}
                meta={on ? <Icon name="check" size={16} color="var(--gold)" /> : o.meta}
                chev={false}
                onClick={() => pickOne(o.id)}
              />
            );
          })}
        </div>
        {multi && <Btn variant="gold" wide style={{ marginTop: 14 }} onClick={() => setOpen(false)}>Показать</Btn>}
      </Sheet>
    </>
  );
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
