/* Мастер-группы: десять резидентов с похожими задачами. Состав
   не хранится — его собирает тест (lib/groups.js) по сфере и по тому, что
   вы ищете и даёте, поэтому у каждого резидента свои люди. Здесь — темы
   и расписание: when — строка для подписей, weekday (0 — вс … 6 — сб) и
   time — чтобы посчитать дату ближайшей встречи (nextMeeting в lib/groups.js). */

export const MASTERMINDS = [
  { id: 'mm-capital', name: 'Капитал и сделки', icon: 'chart', tags: ['invest', 'partners', 'law'], spheres: ['finance'], when: 'каждый второй четверг, 19:00 · Zoom', weekday: 4, time: '19:00' },
  { id: 'mm-scale', name: 'Масштаб и команда', icon: 'users', tags: ['hiring', 'clients', 'marketing', 'mentor'], spheres: ['services', 'trade', 'prod'], when: 'каждый второй вторник, 18:00 · Zoom', weekday: 2, time: '18:00' },
  { id: 'mm-assets', name: 'Недвижимость и активы', icon: 'home', tags: ['realty', 'relocation', 'law'], spheres: ['realty'], when: 'каждый второй понедельник, 17:00 · Zoom', weekday: 1, time: '17:00' },
  { id: 'mm-tech', name: 'Tech и AI', icon: 'spark', tags: ['ai', 'hiring', 'invest'], spheres: ['it'], when: 'каждую вторую среду, 18:00 · Zoom', weekday: 3, time: '18:00' },
  { id: 'mm-life', name: 'Жизнь между странами', icon: 'globe', tags: ['relocation', 'kids', 'friends'], spheres: ['life', 'media'], when: 'каждую вторую субботу, 11:00 · Zoom', weekday: 6, time: '11:00' },
];

export const MASTERMIND_SIZE = 10;
