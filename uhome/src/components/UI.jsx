import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icons.jsx';
import { back as backNav } from '../lib/router.jsx';

/* Заголовок вкладки: крупная антиква, подпись и одно-два действия справа. */
export function Top({ title, sub, right }) {
  return (
    <div className="top">
      <div className="grow" style={{ minWidth: 0 }}>
        <h1 className="h1">{title}</h1>
        {sub && <div className="top__sub">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

/* Липкая шапка вложенного экрана: возврат есть на каждом, кроме вкладок. */
export function TopBar({ title, sub, backTo = '/', right }) {
  return (
    <div className="topbar">
      <button className="backbtn" onClick={() => backNav(backTo)} aria-label="Назад">
        <Icon name="back" size={20} width={2} />
      </button>
      <div className="grow" style={{ minWidth: 0 }}>
        {title && <div className="topbar__title ell">{title}</div>}
        {sub && <div className="topbar__sub ell">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

export function Btn({ variant = 'ghost', size, wide, icon, children, className = '', ...rest }) {
  const cls = ['btn', `btn--${variant}`, size === 'sm' ? 'btn--sm' : '', wide ? 'btn--wide' : '', className].filter(Boolean).join(' ');
  return (
    <button className={cls} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 15 : 18} />}
      {children}
    </button>
  );
}

export function Tag({ tone, children, style }) {
  return <span className={`tag${tone ? ` tag--${tone}` : ''}`} style={style}>{children}</span>;
}

export function List({ children, plain, style }) {
  return <div className={`list${plain ? ' list--plain' : ''}`} style={style}>{children}</div>;
}

/* Строка списка как в мессенджере: слева иконка или аватар, справа мета. */
export function Item({ lead, icon, iconTone, title, sub, subWrap, meta, chev = true, onClick, plain }) {
  const El = onClick ? 'button' : 'div';
  return (
    <El className={`item${plain ? ' item--plain' : ''}`} onClick={onClick}>
      {lead}
      {icon && !lead && (
        <div className="item__ic" style={iconTone ? { color: iconTone, background: `${iconTone}1f` } : undefined}>
          <Icon name={icon} size={19} />
        </div>
      )}
      <div className="item__body">
        <div className="item__t">{title}</div>
        {sub && <div className={`item__s${subWrap ? ' item__s--wrap' : ''}`}>{sub}</div>}
      </div>
      {meta !== undefined && <div className="item__meta">{meta}</div>}
      {chev && onClick && <Icon name="right" size={16} className="chev" />}
    </El>
  );
}

export function Section({ title, note, more, onMore, children, id }) {
  return (
    <section className="sect" id={id}>
      {title && (
        <div className="sect__head">
          <div style={{ minWidth: 0 }}>
            <div className="sect__title">{title}</div>
            {note && <div className="sect__note">{note}</div>}
          </div>
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
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" data-on={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function KV({ k, v }) {
  return (
    <div className="kv">
      <div className="kv__k">{k}</div>
      <div className="kv__v">{v}</div>
    </div>
  );
}

export function Empty({ icon = 'search', title, text, action }) {
  return (
    <div className="card center" style={{ padding: '30px 20px' }}>
      <div style={{ opacity: 0.45, marginBottom: 10, display: 'flex', justifyContent: 'center' }}><Icon name={icon} size={28} /></div>
      <div className="t-md">{title}</div>
      {text && <div className="t-sm dim" style={{ marginTop: 6, lineHeight: 1.5 }}>{text}</div>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
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
  /* Шторка рисуется прямо в body: у экранов есть анимация появления, а
     анимированный transform делает предка точкой отсчёта для position: fixed —
     без портала шторка уезжала бы вместе с блоком за край экрана. */
  return createPortal(
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="sheet__grip" />
        <button className="sheet__x" onClick={onClose} aria-label="Закрыть">
          <Icon name="x" size={16} />
        </button>
        {title && (
          <div style={{ marginBottom: 16, paddingRight: 44 }}>
            <h2 className="h2">{title}</h2>
            {sub && <div className="t-sm dim-2" style={{ marginTop: 5, lineHeight: 1.45 }}>{sub}</div>}
          </div>
        )}
        {children}
      </div>
    </>,
    document.body
  );
}

export function Search({ value, onChange, placeholder = 'Поиск' }) {
  return (
    <div className="search">
      <Icon name="search" size={18} />
      <input className="field" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

/* Фильтр-раскрывашка: одна кнопка с текущим выбором, список — в шторке.
   Так два-три фильтра помещаются в одну строку без ленты чипов. */
export function Picker({ label, summary, title, sub, options, value, onChange, lead, def = 'all' }) {
  const [open, setOpen] = useState(false);
  const active = value && value !== def;
  return (
    <>
      <button className={`picker${active ? ' picker--on' : ''}`} onClick={() => setOpen(true)}>
        <span className="picker__t ell">{lead ? `${lead} ` : ''}{summary || label}</span>
        <Icon name="down" size={15} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={title || label} sub={sub}>
        <div className="list list--plain">
          {options.map((o) => {
            const on = value === o.id;
            return (
              <Item
                key={o.id}
                lead={o.lead ? <span className="picker__lead">{o.lead}</span> : undefined}
                title={o.name}
                sub={o.sub}
                meta={on ? <Icon name="check" size={18} color="var(--gold)" /> : o.meta}
                chev={false}
                onClick={() => { onChange(o.id); setOpen(false); }}
              />
            );
          })}
        </div>
      </Sheet>
    </>
  );
}

export function Stars({ value }) {
  return (
    <span className="stars">
      <Icon name="star" size={13} color="var(--gold)" fill="var(--gold)" width={1} />
      {value.toFixed(1)}
    </span>
  );
}

export function Field({ label, children, hint }) {
  return (
    <label style={{ display: 'block' }}>
      {label && <span className="label">{label}</span>}
      {children}
      {hint && <span className="t-xs dim-2" style={{ display: 'block', marginTop: 6 }}>{hint}</span>}
    </label>
  );
}
