import { useEffect } from 'react';
import { ANALYSIS } from '../../data/test.js';
import { useTimeline } from '../../lib/motion.js';
import Icon from '../Icons.jsx';

/* Сборка профиля: три строки загораются одна за другой (~2,5 с),
   потом карточка становится паспортом. Нажатие — не ждать. */

const MARKS = [150, 950, 1750, 2550];

export default function Analysis({ onDone }) {
  const i = useTimeline(MARKS);
  useEffect(() => {
    if (i >= ANALYSIS.length) onDone();
  }, [i, onDone]);

  return (
    <>
      <h2 className="h2 o-card__t">Собираю ваш профиль</h2>
      <div className="o-lines">
        {ANALYSIS.map((t, k) => (
          <div key={t} className="o-line" data-st={k < i ? 'done' : k === i ? 'now' : 'wait'}>
            <i>{k < i && <Icon name="check" size={9} width={3} color="var(--bg)" />}</i>
            {t}
          </div>
        ))}
      </div>
      <div className="o-card__skip">Нажмите, чтобы не ждать</div>
    </>
  );
}
