import { useState } from 'react';
import Icon from './Icons.jsx';

/* Плитки выбора: иконка или крупное значение, подпись и галочка.
   Вариант «Другое» открывает поле — так анкета остаётся на нажатиях,
   но не заставляет выбирать из чужого списка. */

export default function Choice({ options, value = [], max = 1, onChange, wide, list }) {
  const known = new Set(options.filter((o) => !o.other).map((o) => o.id));
  const other = options.find((o) => o.other);
  const custom = value.find((v) => v && !known.has(v)) || '';
  const [text, setText] = useState(custom);
  const otherOn = Boolean(other) && (custom !== '' || value.includes(''));

  const pick = (id) => {
    if (max === 1) return onChange([id]);
    if (value.includes(id)) return onChange(value.filter((x) => x !== id));
    if (value.length >= max) return onChange([...value.slice(1), id]);
    onChange([...value, id]);
  };

  const pickOther = () => {
    if (otherOn) return onChange(value.filter((v) => known.has(v)));
    const rest = max === 1 ? [] : value.filter((v) => known.has(v)).slice(0, max - 1);
    onChange([...rest, text]);
  };

  // Длинные перечни (профессии) читаются списком, короткие — плитками
  const rows = options.map((o) => {
    const on = o.other ? otherOn : value.includes(o.id);
    return list ? (
      <button key={o.id} className={`crow${on ? ' crow--on' : ''}`} onClick={() => (o.other ? pickOther() : pick(o.id))} aria-pressed={on}>
        <span className="crow__ic"><Icon name={o.icon} size={19} /></span>
        <span className="crow__t">{o.other && custom ? custom : o.label}</span>
        {o.hint && <span className="crow__hint">{o.hint}</span>}
        <span className="crow__tick"><Icon name="check" size={15} color="var(--accent)" /></span>
      </button>
    ) : (
      <button key={o.id} className={`choice${on ? ' choice--on' : ''}`} onClick={() => (o.other ? pickOther() : pick(o.id))} aria-pressed={on}>
        <span className="choice__tick"><Icon name="check" size={15} color="var(--accent)" /></span>
        {o.big ? <span className="choice__big">{o.big}</span> : <span className="choice__ic"><Icon name={o.icon} size={26} /></span>}
        <span className="choice__t">{o.other && custom ? custom : o.label}</span>
      </button>
    );
  });

  return (
    <>
      <div className={list ? 'crows' : `choices${wide ? ' choices--wide' : ''}`}>{rows}</div>

      {otherOn && other && (
        <input
          className="field"
          style={{ marginTop: 8 }}
          autoFocus
          placeholder={other.placeholder || 'Свой вариант'}
          value={text}
          onChange={(e) => {
            const next = e.target.value;
            setText(next);
            onChange([...value.filter((v) => known.has(v)), next]);
          }}
        />
      )}
    </>
  );
}
