import { PEOPLE, byId, firstNameOf } from '../data/people.js';
import { MASTERMINDS, MASTERMIND_SIZE } from '../data/groups.js';
import { inDaysFor } from '../data/events.js';
import { match } from './match.js';
import { dateLong, dayShift, relDayIn } from './format.js';

/* Мастер-группа собирается из ответов теста: десять человек с похожими
   задачами. Тема — там, где больше всего совпадений с тем, что вы ищете
   и даёте, и с вашей сферой; внутри темы — самые полезные вам люди.
   До теста профиль пустой, и группа — нейтральная, первая по списку тем. */

const themeScore = (theme, p) =>
  [...(p.needs || []), ...(p.gives || [])].filter((x) => theme.tags.includes(x)).length * 2 +
  (theme.spheres.includes(p.sphere) ? 3 : 0);

export function mastermindFor(me) {
  return [...MASTERMINDS].sort((a, b) => themeScore(b, me) - themeScore(a, me))[0];
}

export function groupsOf(me) {
  const theme = mastermindFor(me);
  const ranked = PEOPLE.map((p) => ({ p, s: themeScore(theme, p) * 10 + match(me, p).pct }))
    .sort((a, b) => b.s - a.s)
    .slice(0, MASTERMIND_SIZE - 1)
    .map((x) => x.p);

  return [
    {
      id: 'g-mm', kind: 'mastermind', name: `Мастер-группа «${theme.name}»`, short: 'Мастер-группа',
      about: `Десять предпринимателей с похожими задачами. Раз в две недели разбираете запрос одного из участников. Тема — «${theme.name}».`,
      when: theme.when, icon: theme.icon, members: ranked, theme,
    },
  ];
}

export const groupById = (me, id) => groupsOf(me).find((g) => g.id === id);

/* Ближайшая встреча группы: день недели из темы, не раньше завтра.
   { inDays, date, time, text: 'в среду, 7 октября, в 18:00 в Zoom' } */
export function nextMeeting(g) {
  const theme = g.theme || g;
  const inDays = inDaysFor(theme.weekday ?? 3, 1);
  const date = dayShift(inDays);
  const time = theme.time || '18:00';
  return { inDays, date, time, text: `${relDayIn(inDays)}, ${dateLong(date)}, в ${time} в Zoom` };
}

/* Переписка группы собирается из её состава — у каждого свои люди.
   Люди говорят как люди: конкретная дата, а не строка расписания. */
export function groupThread(me, g) {
  const [a, b, c] = g.members;
  if (!a) return [];
  const next = nextMeeting(g);
  return [
    { from: 'them', who: a.id, text: `Коллеги, следующая встреча — ${next.text}. ${firstNameOf(b || a)}, разбираем ваш запрос — готовы?`, mins: 900 },
    { from: 'them', who: b?.id || a.id, text: 'Да, спасибо! Пришлю цифры за день до встречи.', mins: 600 },
    { from: 'them', who: c?.id || a.id, text: 'Предлагаю после встречи 15 минут на интро — у меня два полезных контакта для группы.', mins: 55 },
  ];
}

// непрочитанное в групповых чатах до первого открытия: мастер-группа и сообщества
export const GROUP_UNREAD = { 'g-mm': 3, 'c-bali': 4, 'i-sport': 2 };

export { byId };
