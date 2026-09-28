import { TONES } from './avatars.js';
import { EXCHANGE, INTERESTS, SPHERES } from './people.js';

/* Регистрация — семь шагов одной карточкой. Кроме профиля (имя, роль,
   компания, регион) карточка собирает ответы теста, по которым ассистент
   учится, собирает мастер-группу и считает пользу знакомств:
   assistant, tone, sphere, needs[], gives[], interests[], regions[] (в
   профиле — regionsOften), formats[]. */

export const FORMATS = [
  { id: 'coffee', name: 'Кофе один на один' },
  { id: 'dinner', name: 'Ужины в узком кругу' },
  { id: 'sport', name: 'Спорт вместе' },
  { id: 'online', name: 'Созвон онлайн' },
  { id: 'trips', name: 'Поездки и ретриты' },
];

const exchange = Object.entries(EXCHANGE).map(([id, x]) => ({ id, name: x.name }));

/* Одна строка о каждом ассистенте — для выбора. */
export const ASSISTANTS = [
  { id: 'eva', line: 'Знает всех резидентов и подбирает людей под ваши задачи.' },
  { id: 'adam', line: 'Знает рынок и сделки клуба. Коротко, точно, с юмором.' },
];

export const STEPS = [
  { id: 'who', kind: 'who', title: 'Кто вы', sub: 'Так вас увидят резиденты — и так напечатаем паспорт.' },
  { id: 'sphere', kind: 'one', title: 'Чем занимаетесь', sub: 'По сфере соберём мастер-группу из людей с похожими задачами.', options: SPHERES },
  { id: 'region', kind: 'region', title: 'Где вы сейчас', sub: 'Афиша, услуги и люди рядом подстроятся под регион.' },
  { id: 'assistant', kind: 'avatar', title: 'Ваш ассистент', sub: 'Знает всех в клубе. Сменить можно в любой момент.', options: ASSISTANTS },
  { id: 'tone', kind: 'one', title: 'Как общаться', sub: 'Тон ассистента. Поменять можно в профиле.', options: TONES, rows: true },
  {
    id: 'exchange', kind: 'groups', title: 'Что ищете и чем полезны', sub: 'До трёх в каждой группе — знакомим по взаимной пользе.',
    groups: [
      { id: 'needs', label: 'Ищу в клубе', max: 3, options: exchange },
      { id: 'gives', label: 'Могу дать другим', max: 3, options: exchange },
    ],
  },
  {
    id: 'social', kind: 'groups', title: 'Интересы и встречи', sub: 'Общее вне работы помогает начать разговор.',
    groups: [
      { id: 'interests', label: 'Вне работы', max: 5, options: INTERESTS.map((x) => ({ id: x, name: x })) },
      { id: 'formats', label: 'Как удобнее знакомиться', max: 5, options: FORMATS },
    ],
  },
];

/* Строки сборки профиля перед выпуском паспорта. */
export const ANALYSIS = ['Сверяю с резидентами', 'Собираю мастер-группу', 'Выпускаю паспорт'];
