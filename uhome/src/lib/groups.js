import { PEOPLE, byId, firstNameOf } from '../data/people.js';
import { MASTERMINDS, MASTERMIND_SIZE } from '../data/groups.js';
import { match } from './match.js';

/* Мастер-группа собирается из ответов теста: десять человек с похожими
   задачами. Тема — там, где больше всего совпадений с тем, что вы ищете
   и даёте, и с вашей сферой; внутри темы — самые полезные вам люди. */

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

/* Переписка группы собирается из её состава — у каждого свои люди. */
export function groupThread(me, g) {
  const [a, b, c] = g.members;
  if (!a) return [];
  return [
    { from: 'them', who: a.id, text: `Коллеги, следующая встреча — ${g.when}. ${firstNameOf(b || a)}, разбираем ваш запрос — готовы?`, mins: 900 },
    { from: 'them', who: b?.id || a.id, text: 'Спасибо! Пришлю цифры за день до встречи.', mins: 600 },
    { from: 'them', who: c?.id || a.id, text: 'Предлагаю после встречи 15 минут на интро — у меня два полезных контакта для группы.', mins: 55 },
  ];
}

// непрочитанное в групповых чатах до первого открытия: мастер-группа и сообщества
export const GROUP_UNREAD = { 'g-mm': 3, 'c-bali': 4, 'i-sport': 2 };

export { byId };
