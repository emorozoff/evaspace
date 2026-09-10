import Icon from './Icons.jsx';

/* Плитки выбора: иконка или крупное значение, подпись и галочка.
   Одним компонентом собраны все вопросы анкеты. */

export default function Choice({ options, value = [], max = 1, onChange, wide }) {
  const toggle = (id) => {
    if (max === 1) return onChange([id]);
    if (value.includes(id)) return onChange(value.filter((x) => x !== id));
    if (value.length >= max) return onChange([...value.slice(1), id]);
    onChange([...value, id]);
  };

  return (
    <div className={`choices${wide ? ' choices--wide' : ''}`}>
      {options.map((o) => {
        const on = value.includes(o.id);
        return (
          <button key={o.id} className={`choice${on ? ' choice--on' : ''}`} onClick={() => toggle(o.id)} aria-pressed={on}>
            <span className="choice__tick"><Icon name="check" size={15} color="var(--accent)" /></span>
            {o.big ? <span className="choice__big">{o.big}</span> : <span className="choice__ic"><Icon name={o.icon} size={26} /></span>}
            <span className="choice__t">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
