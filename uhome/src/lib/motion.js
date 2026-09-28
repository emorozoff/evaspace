import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { prefersReduced, transition } from './transition.js';

/* Движение: переход состояния React и то, что идёт по таймеру.
   При prefers-reduced-motion сразу отдаётся конечное состояние. */

export { prefersReduced };

/** Переход состояния React через View Transitions. Обновление внутри
 *  startViewTransition идёт вне обработчика события, и React откладывает
 *  его в макрозадачу — снимок нового состояния успевал сняться до
 *  перерисовки. flushSync дописывает DOM синхронно, до снимка. */
export const morph = (update) => transition(() => flushSync(update));

/** Индекс последней наступившей отметки времени (мс) с начала; −1 до первой.
 *  marks — постоянный массив (константа модуля), иначе отсчёт начнётся заново. */
export function useTimeline(marks, run = true) {
  const [i, setI] = useState(() => (run && !prefersReduced() ? -1 : marks.length - 1));
  useEffect(() => {
    if (!run) return undefined;
    if (prefersReduced()) {
      setI(marks.length - 1);
      return undefined;
    }
    setI(-1);
    const timers = marks.map((ms, k) => setTimeout(() => setI(k), ms));
    return () => timers.forEach(clearTimeout);
  }, [run, marks]);
  return i;
}
