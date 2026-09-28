/* «Хром» экрана, как в презентации клуба: моноширинная подпись слева,
   счётчик справа и тонкая линия под ними. Линия — это и прогресс:
   золото растёт слева направо. */

export default function Chrome({ left, right, progress = 0, onSkip, skipLabel = 'Позже', live = true }) {
  return (
    <div className="o-chrome">
      <div className="o-chrome__row">
        <span className="o-chrome__l">{live && <i className="o-live" />}<span>{left}</span></span>
        <span className="o-chrome__r">
          {right}
          {onSkip && <button className="o-chrome__skip" onClick={onSkip}>{skipLabel}</button>}
        </span>
      </div>
      <div className="o-chrome__line"><i style={{ transform: `scaleX(${Math.max(0, Math.min(1, progress))})` }} /></div>
    </div>
  );
}

export const pad2 = (n) => String(n).padStart(2, '0');

/** Заголовок с выделенным словом: «Что вы <b>ищете</b> в клубе?» */
export function Titled({ text, em, className = 'o-title' }) {
  if (!em || !text.includes(em)) return <h1 className={className}>{text}</h1>;
  const [a, b] = text.split(em);
  return <h1 className={className}>{a}<b>{em}</b>{b}</h1>;
}
