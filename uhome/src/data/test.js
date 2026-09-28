import { TONES } from './avatars.js';
import { EXCHANGE, INTERESTS, SPHERES } from './people.js';
import { REGIONS, REGION_KEYS } from './regions.js';

/* Тест на входе. Короткий, всё нажатием: по ответам ассистент учится,
   собирает команду и мастер-группу и считает пользу знакомств.
   Каждый ответ становится узлом живой фигуры резидента: сначала орбита
   (тон и сфера), потом квадрат обмена (что ищете и что даёте), потом
   сеть (интересы, маршруты, каналы). em — слово, которое выделяется в
   заголовке, place — куда ляжет узел (моноширинная подсказка). */

export const FORMATS = [
  { id: 'coffee', name: 'Кофе один на один' },
  { id: 'dinner', name: 'Ужины в узком кругу' },
  { id: 'sport', name: 'Спорт вместе' },
  { id: 'online', name: 'Созвон онлайн' },
  { id: 'trips', name: 'Поездки и ретриты' },
];

const exchange = Object.entries(EXCHANGE).map(([id, x]) => ({ id, name: x.name }));

export const TEST = [
  {
    id: 'assistant', kind: 'avatar', title: 'Кто будет вашим ассистентом?', em: 'ассистентом',
    sub: 'Ева и Адам знают всех в клубе и подбирают людей, встречи и сделки под вас. Сменить можно в любой момент.',
    place: 'Цифровой ассистент · обучен на базе клуба',
  },
  { id: 'tone', kind: 'one', title: 'Как с вами общаться?', em: 'общаться', sub: 'Тон ассистента. Поменять можно в профиле.', place: 'Первый узел орбиты', options: TONES },
  { id: 'sphere', kind: 'one', title: 'Ваша сфера', em: 'сфера', sub: 'По ней соберём мастер-группу из людей с похожими задачами.', place: 'Замыкает орбиту', options: SPHERES },
  { id: 'needs', kind: 'many', max: 3, title: 'Что вы ищете в клубе?', em: 'ищете', sub: 'До трёх. Приведём тех, кто это даёт.', place: 'Левая грань квадрата', options: exchange },
  { id: 'gives', kind: 'many', max: 3, title: 'Чем вы полезны другим?', em: 'полезны', sub: 'До трёх. Так вас найдут те, кому вы нужны.', place: 'Правая грань · обмен', options: exchange },
  { id: 'interests', kind: 'many', max: 5, title: 'Что вы любите вне работы?', em: 'любите', sub: 'До пяти. Общее помогает начать разговор.', place: 'Верхняя дуга сети', options: INTERESTS.map((x) => ({ id: x, name: x })) },
  { id: 'regions', kind: 'many', max: 5, title: 'Где вы бываете?', em: 'бываете', sub: 'Позовём на встречи там и предупредим, кто прилетает.', place: 'Маршруты сети', options: REGION_KEYS.map((k) => ({ id: k, name: REGIONS[k].name, cc: REGIONS[k].cc })) },
  { id: 'formats', kind: 'many', max: 5, title: 'Как вам удобнее знакомиться?', em: 'знакомиться', sub: 'Такие поводы ассистент и будет предлагать.', place: 'Каналы связи', options: FORMATS },
];
