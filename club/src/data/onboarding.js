/* Знакомство при входе. Занятие спрашивают сразу при регистрации — это
   первое, что о человеке хотят знать. Дальше двенадцать вопросов на четырёх
   экранах: по ним ИИ-куратор собирает равные команды, а подбор людей
   и знакомств понимает, кто кому будет интересен. */

/** Занятие: спрашивается на экране регистрации, сразу после имени. */
export const ROLE_QUESTION = {
  id: 'role',
  title: 'Чем занимаетесь',
  hint: 'До двух — по этому подбираются люди и команды',
  max: 2,
  list: true,
  options: [
    { id: 'Предприниматель', label: 'Предприниматель', icon: 'rocket' },
    { id: 'Эксперт', label: 'Эксперт, консультант', icon: 'bulb' },
    { id: 'Руководитель', label: 'Руководитель', icon: 'crown' },
    { id: 'Программист', label: 'Программист', icon: 'code' },
    { id: 'Автоматизация', label: 'Автоматизация и ИИ', icon: 'robot' },
    { id: 'Дизайнер', label: 'Дизайнер', icon: 'brush' },
    { id: 'Креатор', label: 'Креатор', icon: 'palette' },
    { id: 'Блогер', label: 'Блогер', icon: 'camera' },
    { id: 'Маркетолог', label: 'Маркетолог', icon: 'megaphone' },
    { id: 'Продюсер', label: 'Продюсер', icon: 'mic' },
    { id: 'Продажи', label: 'Продажи', icon: 'handshake' },
    { id: 'Инвестор', label: 'Инвестор', icon: 'chart' },
    { id: 'other', label: 'Другое', icon: 'pen', other: true, placeholder: 'Чем занимаетесь' },
  ],
};

export const STEPS = [
  {
    id: 'who',
    eyebrow: 'Шаг 1 из 4',
    title: 'Кто вы',
    sub: 'Пара вопросов о том, как устроена ваша неделя',
    questions: [
      {
        id: 'schedule',
        title: 'Ваш график',
        max: 1,
        options: [
          { id: 'Стандартный 5/2', label: 'Стандартный', big: '5/2' },
          { id: 'Сменный 2/2', label: 'Сменный', big: '2/2' },
          { id: 'Свободный', label: 'Свободный', big: '∞' },
        ],
      },
      {
        id: 'gender',
        title: 'Пол',
        max: 1,
        options: [
          { id: 'Мужчина', label: 'Мужчина', icon: 'male' },
          { id: 'Женщина', label: 'Женщина', icon: 'female' },
        ],
      },
      {
        id: 'work',
        title: 'Где работаете',
        max: 1,
        options: [
          { id: 'Своё дело', label: 'Своё дело', icon: 'rocket' },
          { id: 'Фриланс', label: 'Фриланс', icon: 'spark' },
          { id: 'Работаю в компании', label: 'В компании', icon: 'city' },
        ],
      },
    ],
  },
  {
    id: 'work',
    eyebrow: 'Шаг 2 из 4',
    title: 'Ваше дело',
    sub: 'ИИ-куратор собирает команды так, чтобы роли, сферы и графики сходились',
    questions: [
      {
        id: 'sphere',
        title: 'Сфера',
        max: 1,
        options: [
          { id: 'Инфобизнес', label: 'Инфобизнес', icon: 'mic' },
          { id: 'ИТ-продукты', label: 'ИТ-продукты', icon: 'code' },
          { id: 'Контент и блогинг', label: 'Контент, блогинг', icon: 'camera' },
          { id: 'Услуги и агентство', label: 'Услуги, агентство', icon: 'handshake' },
          { id: 'Торговля', label: 'Торговля', icon: 'money' },
          { id: 'Производство', label: 'Производство', icon: 'gear' },
          { id: 'Образование', label: 'Образование', icon: 'book' },
          { id: 'other', label: 'Другое', icon: 'pen', other: true, placeholder: 'Ваша сфера' },
        ],
      },
      {
        id: 'craft',
        title: 'Что берёте на себя в команде',
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
    id: 'numbers',
    eyebrow: 'Шаг 3 из 4',
    title: 'Немного цифр',
    sub: 'Нужно, чтобы команды получились равными по силе. Доход видит только куратор',
    questions: [
      {
        id: 'income',
        title: 'Сколько дело приносит в месяц',
        max: 1,
        options: [
          { id: 'до 100 тыс', label: 'в месяц', big: 'до 100к' },
          { id: '100–300 тыс', label: 'в месяц', big: '100–300к' },
          { id: '300–500 тыс', label: 'в месяц', big: '300–500к' },
          { id: 'больше 500 тыс', label: 'в месяц', big: '500к+' },
        ],
      },
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
    id: 'life',
    eyebrow: 'Шаг 4 из 4',
    title: 'И про жизнь',
    sub: 'По этому подбираются знакомства и соседи по пятнице',
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
          { id: 'Хочу влюбиться', label: 'Хочу влюбиться', icon: 'heartPlus' },
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

export const QUESTIONS = [ROLE_QUESTION, ...STEPS.flatMap((s) => s.questions)];

export const questionById = (id) => QUESTIONS.find((q) => q.id === id);

export function optionOf(questionId, optionId) {
  return questionById(questionId)?.options.find((o) => o.id === optionId) || null;
}

export function stepDone(step, answers) {
  return step.questions.every((q) => (answers[q.id] || []).filter(Boolean).length > 0);
}

export const FACT_LABELS = {
  role: 'Чем занимается',
  work: 'Где работает',
  schedule: 'График',
  gender: 'Пол',
  sphere: 'Сфера',
  craft: 'В команде',
  exp: 'Опыт',
  ai: 'Владение ИИ',
  age: 'Возраст',
  income: 'Доход в месяц',
  goal: 'Зачем в клубе',
  status: 'Отношения',
  hobby: 'Увлечения',
};
