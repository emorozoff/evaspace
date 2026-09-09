/* Круги общения. Мессенджер делит людей на три группы: ближний круг,
   друзья и бизнес. Круг ставит сам резидент, но начальная раскладка нужна —
   иначе после вступления человек видит один плоский список из тридцати имён. */

export const CIRCLES = [
  { id: 'inner', name: 'Ближний круг', short: 'Ближние', emoji: '🔒', tone: '#D9B26B', hint: 'Кому пишете первым' },
  { id: 'friends', name: 'Друзья', short: 'Друзья', emoji: '🤝', tone: '#5FE0C8', hint: 'Общение без повода' },
  { id: 'biz', name: 'Бизнес', short: 'Бизнес', emoji: '💼', tone: '#5B8CFF', hint: 'Дела, сделки, работа' },
];

export const CIRCLE_IDS = CIRCLES.map((c) => c.id);
export const circleMeta = (id) => CIRCLES.find((c) => c.id === id);

/* Начальная раскладка: кто встретил при входе и с кем уже есть переписка —
   в ближнем круге, остальные разложены по смыслу их профиля. */
export const DEFAULT_CIRCLE = {
  r22: 'inner', r9: 'inner', r1: 'inner', r12: 'inner', r20: 'inner',
  r7: 'friends', r3: 'friends', r18: 'friends', r11: 'friends', r4: 'friends', r6: 'friends',
  r13: 'biz', r2: 'biz', r8: 'biz', r17: 'biz', r21: 'biz', r16: 'biz', r14: 'biz', r5: 'biz',
};

/** Круг человека с учётом того, что резидент поменял руками.
    'none' — осознанно убран из кругов, поэтому раскладка по умолчанию не возвращается. */
export function circleOf(id, moved = {}) {
  const m = moved[id];
  if (m === 'none') return null;
  return m || DEFAULT_CIRCLE[id] || null;
}

/** Все, кто попал в круги: и раскладка по умолчанию, и ручные переносы. */
export function peopleInCircle(circleId, moved = {}) {
  const ids = new Set([...Object.keys(DEFAULT_CIRCLE), ...Object.keys(moved)]);
  return [...ids].filter((id) => circleOf(id, moved) === circleId);
}
