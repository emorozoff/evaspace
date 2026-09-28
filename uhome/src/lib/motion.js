import { useEffect, useRef, useState } from 'react';

/* Движение для «вау»-моментов: расшифровка строк, печать текста,
   досчитывание цифр. Всё на requestAnimationFrame и только пока идёт
   анимация. При prefers-reduced-motion сразу отдаётся конечное
   состояние — никто не ждёт анимацию, которую не хочет видеть. */

export const prefersReduced = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<';

/** Строка «расшифровывается» слева направо, хвост из случайных знаков
 *  бежит впереди — как машиночитаемая зона при сканировании. */
export function useScramble(text, { delay = 0, speed = 18, tail = 6, run = true, glyphs = GLYPHS } = {}) {
  const [out, setOut] = useState(() => (run && !prefersReduced() ? '' : text));
  useEffect(() => {
    if (!run || prefersReduced()) {
      setOut(text);
      return undefined;
    }
    let raf = 0;
    let t0 = 0;
    let last = -1;
    const frame = (t) => {
      if (!t0) t0 = t;
      const el = t - t0 - delay;
      if (el < 0) {
        raf = requestAnimationFrame(frame);
        return;
      }
      const n = Math.min(text.length, Math.floor(el / speed));
      // хвост перемешивается ~25 раз в секунду — чаще глаз не различит
      const tick = Math.floor(el / 40) * 1000 + n;
      if (tick !== last) {
        last = tick;
        let s = text.slice(0, n);
        for (let i = n; i < Math.min(text.length, n + tail); i++) {
          s += text[i] === ' ' ? ' ' : glyphs[(Math.random() * glyphs.length) | 0];
        }
        setOut(s);
      }
      if (n < text.length) raf = requestAnimationFrame(frame);
      else setOut(text);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [text, delay, speed, tail, run, glyphs]);
  return out;
}

/** Печать текста по буквам (описание аватара, строки анализа). */
export function useTypewriter(text, { delay = 0, speed = 14, run = true } = {}) {
  const [n, setN] = useState(() => (run && !prefersReduced() ? 0 : text.length));
  useEffect(() => {
    if (!run || prefersReduced()) {
      setN(text.length);
      return undefined;
    }
    setN(0);
    let raf = 0;
    let t0 = 0;
    const frame = (t) => {
      if (!t0) t0 = t;
      const k = Math.max(0, Math.min(text.length, Math.floor((t - t0 - delay) / speed)));
      setN(k);
      if (k < text.length) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [text, delay, speed, run]);
  return { text: text.slice(0, n), done: n >= text.length };
}

/** Число досчитывается до нового значения от прежнего — счётчики
 *  «узлов» и «связей» растут, а не прыгают. */
export function useCountUp(to, { ms = 700, delay = 0, from } = {}) {
  const [v, setV] = useState(() => (prefersReduced() ? to : from ?? to));
  const cur = useRef(v);
  useEffect(() => {
    if (prefersReduced()) {
      cur.current = to;
      setV(to);
      return undefined;
    }
    const start = cur.current;
    if (start === to) return undefined;
    let raf = 0;
    let t0 = 0;
    const frame = (t) => {
      if (!t0) t0 = t;
      const p = Math.max(0, Math.min(1, (t - t0 - delay) / ms));
      const e = 1 - Math.pow(1 - p, 3);
      const val = Math.round(start + (to - start) * e);
      cur.current = val;
      setV(val);
      if (p < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [to, ms, delay]);
  return v;
}

/** Полёт светящейся точки из места нажатия в узел фигуры: ядро и два
 *  «хвоста» с отставанием — получается комета. Только transform и
 *  opacity — через Web Animations API. */
export function flyDot(layer, from, to, { ms = 660 } = {}) {
  if (!layer || prefersReduced() || !layer.animate) return;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  // дуга: середина пути приподнята и чуть отведена в сторону
  const mx = from.x + dx * 0.5 - Math.sign(dx || 1) * 22;
  const my = from.y + dy * 0.5 - 40;
  const frames = [
    { transform: `translate(${from.x}px, ${from.y}px) scale(1.8)`, opacity: 0 },
    { transform: `translate(${from.x}px, ${from.y}px) scale(1.3)`, opacity: 1, offset: 0.1 },
    { transform: `translate(${mx}px, ${my}px) scale(1)`, opacity: 1, offset: 0.52 },
    { transform: `translate(${to.x}px, ${to.y}px) scale(0.6)`, opacity: 1, offset: 0.93 },
    { transform: `translate(${to.x}px, ${to.y}px) scale(0.2)`, opacity: 0 },
  ];
  [0, 1, 2].forEach((k) => {
    const el = document.createElement('div');
    el.className = k ? 'o-fly o-fly--ghost' : 'o-fly';
    layer.appendChild(el);
    const anim = el.animate(frames, {
      duration: ms, delay: k * 45, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'both',
    });
    const done = () => el.remove();
    anim.onfinish = done;
    anim.oncancel = done;
  });
}
