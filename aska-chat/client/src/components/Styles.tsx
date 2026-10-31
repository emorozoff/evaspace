// Галерея стилей в «Ещё» → «Вид»: у каждого — маленькое окошко-превью. Нажал — стиль меняется сразу.
import type { Design } from '../lib/aska.ts';

export const STYLES: { key: Design; name: string; note: string }[] = [
  { key: 'zoomer', name: 'Зумер', note: 'стекло, пузыри, крупно' },
  { key: 'millennial', name: 'Миллениал', note: 'классика 2000-х, окна' },
  { key: 'royal', name: 'Царская особа', note: 'бархат, золото, «Ваше Величество»' },
  { key: 'business', name: 'Бизнес', note: 'строго, рабочие чаты отдельно' },
  { key: 'night', name: 'Ночь', note: 'тёмный, бережёт глаза' },
];

export function StylePick({ value, onChange }: { value: Design; onChange: (d: Design) => void }) {
  return (
    <div className="aska-styles" role="radiogroup" aria-label="Стиль">
      {STYLES.map((x) => (
        <button type="button" key={x.key} role="radio" aria-checked={value === x.key} className={`aska-style${value === x.key ? ' on' : ''}`}
          data-style={x.key} onClick={() => onChange(x.key)}>
          <span className={`sp-prev sp-${x.key}`} aria-hidden="true">
            <i className="t" /><i className="r a" /><i className="r b" /><i className="r c" /><i className="m" />
          </span>
          <b>{x.name}{value === x.key && ' ✓'}</b>
          <small>{x.note}</small>
        </button>
      ))}
    </div>
  );
}
