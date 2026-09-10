/* Знакомство при входе: девять вопросов на четырёх экранах.
   Ответы нужны не ради анкеты — по ним куратор собирает равные команды,
   а люди находят друг друга в каталоге и на рандом-знакомствах. */

export const STEPS = [
  {
    id: 'work',
    eyebrow: 'Шаг 1 из 4',
    title: 'Чем вы сильны в деле',
    sub: 'Куратор собирает команды так, чтобы роли не повторялись',
    questions: [
      {
        id: 'role',
        title: 'Ваша роль',
        max: 1,
        options: [
          { id: 'Продукт', label: 'Продукт', icon: 'target' },
          { id: 'Продажи', label: 'Продажи', icon: 'handshake' },
          { id: 'Разработка', label: 'Разработка', icon: 'code' },
          { id: 'Маркетинг', label: 'Маркетинг', icon: 'megaphone' },
          { id: 'Операционка', label: 'Операционка', icon: 'gear' },
          { id: 'Финансы', label: 'Финансы', icon: 'chart' },
        ],
      },
      {
        id: 'exp',
        title: 'Сколько лет в деле',
        max: 1,
        options: [
          { id: 'Первый год', label: 'Первый год', icon: 'spark' },
          { id: '1–3 года', label: '1–3 года', icon: 'sprout' },
          { id: '3–7 лет', label: '3–7 лет', icon: 'tree' },
          { id: 'Больше 7', label: 'Больше 7', icon: 'mountain' },
        ],
      },
    ],
  },
  {
    id: 'power',
    eyebrow: 'Шаг 2 из 4',
    title: 'Что у вас получается лучше всего',
    sub: 'Выберите до трёх — команде важно, кто что тянет',
    questions: [
      {
        id: 'powers',
        title: '',
        max: 3,
        options: [
          { id: 'Придумывать', label: 'Придумывать', icon: 'bulb' },
          { id: 'Договариваться', label: 'Договариваться', icon: 'handshake' },
          { id: 'Собирать продукт', label: 'Собирать продукт', icon: 'code' },
          { id: 'Делать красиво', label: 'Делать красиво', icon: 'palette' },
          { id: 'Писать тексты', label: 'Писать тексты', icon: 'pen' },
          { id: 'Считать деньги', label: 'Считать деньги', icon: 'chart' },
          { id: 'Автоматизировать', label: 'Автоматизировать', icon: 'gear' },
          { id: 'Выступать', label: 'Выступать', icon: 'mic' },
          { id: 'Доводить до конца', label: 'Доводить до конца', icon: 'shield' },
        ],
      },
      {
        id: 'ai',
        title: 'Насколько уверенно с ИИ',
        max: 1,
        options: [
          { id: 'Новичок', label: 'Новичок', icon: 'sprout' },
          { id: 'Средний уровень', label: 'Средний', icon: 'bulb' },
          { id: 'Про', label: 'Про', icon: 'bolt' },
        ],
      },
    ],
  },
  {
    id: 'numbers',
    eyebrow: 'Шаг 3 из 4',
    title: 'Немного цифр',
    sub: 'Нужно, чтобы команды получились равными по силе. Видит только куратор',
    questions: [
      {
        id: 'age',
        title: 'Возраст',
        max: 1,
        options: [
          { id: '18–25', label: 'лет', big: '18–25' },
          { id: '26–32', label: 'года', big: '26–32' },
          { id: '33–40', label: 'лет', big: '33–40' },
          { id: '41–50', label: 'лет', big: '41–50' },
          { id: '50+', label: 'лет', big: '50+' },
        ],
      },
      {
        id: 'income',
        title: 'Сколько дело приносит в месяц',
        max: 1,
        options: [
          { id: 'до 300 тыс', label: 'в месяц', big: 'до 300к' },
          { id: '300 тыс — 1 млн', label: 'в месяц', big: '0,3–1 млн' },
          { id: '1–3 млн', label: 'в месяц', big: '1–3 млн' },
          { id: '3–10 млн', label: 'в месяц', big: '3–10 млн' },
          { id: 'больше 10 млн', label: 'в месяц', big: '10 млн+' },
        ],
      },
    ],
  },
  {
    id: 'life',
    eyebrow: 'Шаг 4 из 4',
    title: 'И про жизнь',
    sub: 'По этому люди находят друг друга на пятницах и знакомствах',
    questions: [
      {
        id: 'goal',
        title: 'Зачем вступаете в клуб',
        max: 2,
        options: [
          { id: 'Новые знакомства', label: 'Новые знакомства', icon: 'people' },
          { id: 'Встретить любовь', label: 'Встретить любовь', icon: 'heart' },
          { id: 'Найти партнёров', label: 'Найти партнёров', icon: 'handshake' },
          { id: 'Запустить проект', label: 'Запустить проект', icon: 'rocket' },
          { id: 'Оптимизировать время', label: 'Освободить время', icon: 'clock' },
          { id: 'Научиться ИИ', label: 'Научиться ИИ', icon: 'spark' },
        ],
      },
      {
        id: 'status',
        title: 'Статус в отношениях',
        max: 1,
        options: [
          { id: 'Свободен', label: 'Свободен', icon: 'heart' },
          { id: 'В отношениях', label: 'В отношениях', icon: 'flame' },
          { id: 'Женат / замужем', label: 'Женат / замужем', icon: 'rings' },
          { id: 'Не указываю', label: 'Не указываю', icon: 'lock' },
        ],
      },
      {
        id: 'hobby',
        title: 'Чем занимаетесь, когда не работаете',
        max: 3,
        options: [
          { id: 'Падл и теннис', label: 'Падл, теннис', icon: 'run' },
          { id: 'Горы и походы', label: 'Горы, походы', icon: 'mountain' },
          { id: 'Караоке', label: 'Караоке', icon: 'mic' },
          { id: 'Настолки', label: 'Настолки', icon: 'game' },
          { id: 'Клубы и вечеринки', label: 'Клубы, вечеринки', icon: 'bolt' },
          { id: 'Зал и бег', label: 'Зал, бег', icon: 'shield' },
          { id: 'Путешествия', label: 'Путешествия', icon: 'plane' },
          { id: 'Вино и рестораны', label: 'Вино, рестораны', icon: 'fork' },
          { id: 'Книги и подкасты', label: 'Книги, подкасты', icon: 'book' },
          { id: 'Мотоциклы и авто', label: 'Мото, авто', icon: 'bolt' },
          { id: 'Музыка', label: 'Музыка', icon: 'music' },
          { id: 'Фото и видео', label: 'Фото, видео', icon: 'camera' },
        ],
      },
    ],
  },
];

export const QUESTIONS = STEPS.flatMap((s) => s.questions);

export const questionById = (id) => QUESTIONS.find((q) => q.id === id);

export function optionOf(questionId, optionId) {
  return questionById(questionId)?.options.find((o) => o.id === optionId) || null;
}

/** Шаг пройден, когда у каждого вопроса есть хотя бы один ответ. */
export function stepDone(step, answers) {
  return step.questions.every((q) => (answers[q.id] || []).length > 0);
}

/** Подписи в профиле и админке */
export const FACT_LABELS = {
  role: 'Роль',
  exp: 'Опыт',
  ai: 'Владение ИИ',
  age: 'Возраст',
  income: 'Доход в месяц',
  goal: 'Зачем в клубе',
  status: 'Отношения',
  powers: 'Сильные стороны',
  hobby: 'Увлечения',
};
