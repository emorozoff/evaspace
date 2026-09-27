/* Мастер-группы: десять резидентов с похожими задачами. Состав
   не хранится — его собирает тест по интересам (lib/groups.js), поэтому
   у каждого резидента свои люди. Здесь — темы и расписание. */

export const MASTERMINDS = [
  { id: 'mm-capital', name: 'Капитал и сделки', icon: 'chart', tags: ['invest', 'partners', 'law'], spheres: ['finance'], when: 'каждый второй четверг, 19:00 · Zoom' },
  { id: 'mm-scale', name: 'Масштаб и команда', icon: 'users', tags: ['hiring', 'clients', 'marketing', 'mentor'], spheres: ['services', 'trade', 'prod'], when: 'каждый второй вторник, 18:00 · Zoom' },
  { id: 'mm-assets', name: 'Недвижимость и активы', icon: 'home', tags: ['realty', 'relocation', 'law'], spheres: ['realty'], when: 'каждый второй понедельник, 17:00 · Zoom' },
  { id: 'mm-tech', name: 'Tech и AI', icon: 'spark', tags: ['ai', 'hiring', 'invest'], spheres: ['it'], when: 'каждую вторую среду, 18:00 · Zoom' },
  { id: 'mm-life', name: 'Жизнь между странами', icon: 'globe', tags: ['relocation', 'kids', 'friends'], spheres: ['life', 'media'], when: 'каждую вторую субботу, 11:00 · Zoom' },
];

export const MASTERMIND_SIZE = 10;
