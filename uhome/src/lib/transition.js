/* Плавные переходы между состояниями: элементы с одним и тем же
   view-transition-name перетекают из старого положения в новое, остальное
   мягко проявляется. Где браузер не умеет — состояние меняется сразу.
   Использование: transition(() => setStep(step + 1)). */

export const canTransition = () => typeof document !== 'undefined' && typeof document.startViewTransition === 'function' && !prefersReduced();

export function prefersReduced() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function transition(update) {
  if (!canTransition()) {
    update();
    return Promise.resolve();
  }
  // flushSync внутри React не нужен: startViewTransition ждёт микрозадачу,
  // а состояние React обновится в ней же
  const t = document.startViewTransition(() => {
    update();
    return new Promise((r) => setTimeout(r, 0));
  });
  return t.finished.catch(() => {});
}

/* FLIP: элемент «прыгает» из прежнего места плавно. Вызвать после рендера,
   передав прежний прямоугольник. */
export function flip(el, from, ms = 480) {
  if (!el || !from || prefersReduced()) return;
  const to = el.getBoundingClientRect();
  const dx = from.left - to.left;
  const dy = from.top - to.top;
  const sx = from.width / to.width;
  const sy = from.height / to.height;
  if (!dx && !dy && sx === 1 && sy === 1) return;
  el.animate(
    [{ transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` }, { transform: 'none' }],
    { duration: ms, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
  );
}
