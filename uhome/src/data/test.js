import { TONES } from './avatars.js';
import { EXCHANGE, INTERESTS, SPHERES } from './people.js';
import { REGIONS, REGION_KEYS } from './regions.js';

/* Тест на входе. Короткий, всё нажатием: по ответам ассистент учится,
   собирает команду и мастер-группу и считает пользу знакомств. */

export const FORMATS = [
  { id: 'coffee', name: 'Кофе один на один' },
  { id: 'dinner', name: 'Ужины в узком кругу' },
  { id: 'sport', name: 'Спорт вместе' },
  { id: 'online', name: 'Созвон онлайн' },
  { id: 'trips', name: 'Поездки и ретриты' },
];

export const TEST = [
  { id: 'assistant', kind: 'avatar', title: 'Кто будет вашим ассистентом?', sub: 'Ева и Адам знают всех в клубе и подбирают людей, встречи и сделки под вас. Сменить можно в любой момент.' },
  { id: 'tone', kind: 'one', title: 'Как с вами общаться?', sub: 'Тон ассистента — поменяете в профиле.', options: TONES },
  { id: 'sphere', kind: 'one', title: 'Ваша сфера', sub: 'По ней соберём мастер-группу из людей с похожими задачами.', options: SPHERES },
  { id: 'needs', kind: 'many', max: 3, title: 'Что вы ищете в клубе?', sub: 'До трёх — ассистент будет приводить к вам тех, кто это даёт.', options: Object.entries(EXCHANGE).map(([id, x]) => ({ id, name: x.name })) },
  { id: 'gives', kind: 'many', max: 3, title: 'Чем вы можете быть полезны?', sub: 'До трёх — так вас найдут те, кому вы нужны.', options: Object.entries(EXCHANGE).map(([id, x]) => ({ id, name: x.name })) },
  { id: 'interests', kind: 'many', max: 5, title: 'Что вы любите вне работы?', sub: 'До пяти — общее помогает начать разговор.', options: INTERESTS.map((x) => ({ id: x, name: x })) },
  { id: 'regions', kind: 'many', max: 5, title: 'Где вы бываете?', sub: 'Позовём на встречи там и предупредим, кто прилетает.', options: REGION_KEYS.map((k) => ({ id: k, name: REGIONS[k].name, cc: REGIONS[k].cc })) },
  { id: 'formats', kind: 'many', max: 5, title: 'Как вам удобнее знакомиться?', sub: 'Ассистент будет предлагать именно такие поводы.', options: FORMATS },
];
