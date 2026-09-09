/* Жизнь сообщества: мероприятия и эфиры, сообщества по направлениям и регионам,
   запросы резидентов, услуги релокации, переписки.
   Даты — смещение в днях от сегодня, чтобы расписание всегда было живым. */

import { REGIONS, REGION_KEYS } from './regions.js';

export const EVENT_KINDS = {
  meet: { name: 'Встреча', tone: '#D9B26B', icon: 'cup' },
  live: { name: 'Эфир', tone: '#5B8CFF', icon: 'video' },
  sport: { name: 'Спорт', tone: '#58D68D', icon: 'dumbbell' },
  practice: { name: 'Практика', tone: '#5FE0C8', icon: 'leaf' },
  club: { name: 'Закрытое', tone: '#8E7BF5', icon: 'lock' },
  connect: { name: 'U-connect', tone: '#F2789B', icon: 'plane' },
  conf: { name: 'U-conf', tone: '#E9855C', icon: 'spark' },
  world: { name: 'U-world', tone: '#D9B26B', icon: 'award' },
};

/* Три больших события года — их видят все резиденты в любом регионе. */
export const FLAGSHIPS = ['connect', 'conf', 'world'];

export const EVENTS = [
  /* ——— большие ——— */
  {
    id: 'e-connect', kind: 'connect', title: 'U-connect · Стамбул', region: 'istanbul',
    inDays: 24, time: '10:00', days: 3, online: false, price: 340, capacity: 220, host: 'r22',
    going: ['r1', 'r2', 'r4', 'r6', 'r8', 'r9', 'r13', 'r14', 'r15', 'r19', 'r22', 'r23'],
    about: 'Ежеквартальный слёт сообщества — каждый раз в новой стране. Три дня: знакомства, шесть параллельных секций, спорт по утрам и общий ужин на двести человек.',
    program: [
      'Съезд, открытие, представление новых резидентов',
      'Секции по направлениям, разборы проектов, спорт с утра',
      'Итоги, планы на квартал, общий ужин и проводы',
    ],
  },
  {
    id: 'e-conf', kind: 'conf', title: 'U-conf · стартапы и технологии', region: 'lisbon',
    inDays: 47, time: '11:00', days: 2, online: false, price: 260, capacity: 300, host: 'r13',
    going: ['r13', 'r21', 'r17', 'r5', 'r10', 'r2'],
    about: 'Конференция сообщества раз в полгода: что резиденты построили за полугодие, где это работает и сколько стоило. Питчи, демо и живые разборы вместо докладов по слайдам.',
    program: [
      'Питчи резидентов, демо продуктов, вопросы из зала',
      'Секции: ИИ в проде, инженерия, деньги и рынки',
    ],
    speakers: ['r13', 'r21', 'r17'],
  },
  {
    id: 'e-world', kind: 'world', title: 'U-world · неделя года', region: 'bali',
    inDays: 62, time: '18:00', days: 7, online: false, price: 690, capacity: 260, host: 'r22',
    going: ['r1', 'r3', 'r4', 'r5', 'r7', 'r12', 'r15', 'r16', 'r18', 'r20', 'r21', 'r22', 'r24'],
    about: 'Новогодний слёт: итоги года по каждому направлению, награждение резидентов, которые больше всех сделали для сообщества и добились результата в своём деле. Главное событие года.',
    program: [
      'Съезд и открытие недели',
      'Итоги года по направлениям',
      'Секции сообществ и разборы',
      'Свободный день: спорт, вода, семьи',
      'Планы сообщества на год',
      'Церемония года: девять номинаций',
      'Общий стол и проводы',
    ],
  },

  /* ——— эфиры ——— */
  {
    id: 'e1', kind: 'live', title: 'Виза цифрового кочевника: пять стран', region: 'global',
    inDays: 1, time: '19:00', mins: 60, online: true, price: 0, capacity: 200, host: 'r9',
    going: ['r9', 'r5', 'r16', 'r17', 'r24'],
    about: 'Разбираем пять программ, по которым резиденты уже получили долгие визы: сроки, суммы, документы и где обычно отказывают.',
  },
  {
    id: 'e2', top: true, kind: 'live', title: 'Перенос компании в ОАЭ: без иллюзий', region: 'global',
    inDays: 3, time: '18:30', mins: 90, online: true, price: 0, capacity: 200, host: 'r9',
    going: ['r2', 'r8', 'r11', 'r9', 'r6'],
    about: 'Свободная зона или материк, банк, найм, налоги. Считаем на реальных цифрах трёх резидентов, которые прошли это за последний год.',
  },
  {
    id: 'e3', top: true, kind: 'live', title: 'ИИ в продукте: что реально работает', region: 'global',
    inDays: 6, time: '17:00', mins: 75, online: true, price: 0, capacity: 250, host: 'r13',
    going: ['r13', 'r21', 'r10', 'r5'],
    about: 'Без обзоров и новостей: три внедрения в проде, сколько стоили, где сломались и что дали в деньгах.',
  },
  {
    id: 'e4', kind: 'live', title: 'Деньги в трёх юрисдикциях', region: 'global',
    inDays: 9, time: '19:00', mins: 60, online: true, price: 0, capacity: 180, host: 'r17',
    going: ['r17', 'r14', 'r5', 'r16'],
    about: 'Как устроены расчёты, если команда и клиенты в разных странах: где держать деньги, чем платить, что показывать банку.',
  },
  {
    id: 'e5', kind: 'live', title: 'Час с инвестором', region: 'global',
    inDays: 13, time: '18:00', mins: 60, online: true, price: 0, capacity: 120, host: 'r2',
    going: ['r2', 'r13', 'r21', 'r8'],
    about: 'Четыре резидента показывают проекты по десять минут, инвестор отвечает честно: зашёл бы или нет и почему.',
  },
  {
    id: 'e6', kind: 'practice', title: 'Утренняя практика онлайн', region: 'global',
    inDays: 2, time: '07:00', mins: 45, online: true, price: 0, capacity: 100, host: 'r1',
    going: ['r1', 'r3', 'r7', 'r20'],
    about: 'Виньяса и дыхание. Включайтесь из любой точки — камера по желанию.',
  },

  /* ——— офлайн по регионам ——— */
  {
    id: 'e7', top: true, kind: 'meet', title: 'Завтрак резидентов', region: 'moscow',
    inDays: 1, time: '09:00', mins: 120, online: false, price: 0, capacity: 24, host: 'r22',
    going: ['r5', 'r8', 'r10', 'r22'],
    about: 'Каждый за минуту говорит, что строит и какая помощь нужна. Дальше свободное общение.',
  },
  {
    id: 'e8', top: true, kind: 'sport', title: 'Утренний сёрф и кофе', region: 'bali',
    inDays: 2, time: '06:30', mins: 150, online: false, price: 0, capacity: 12, host: 'r12',
    going: ['r1', 'r3', 'r12', 'r4'],
    about: 'Сессия для любого уровня, доски на месте. После воды — кофе на террасе.',
  },
  {
    id: 'e9', top: true, kind: 'meet', title: 'Ужин нового круга', region: 'dubai',
    inDays: 4, time: '20:00', mins: 180, online: false, price: 45, capacity: 16, host: 'r9',
    going: ['r9', 'r11', 'r2', 'r13'],
    about: 'Стол на шестнадцать человек для тех, кто в регионе меньше трёх месяцев. Знакомство и практические вопросы переезда.',
  },
  {
    id: 'e10', kind: 'sport', title: 'Бег 10 км вдоль набережной', region: 'belgrade',
    inDays: 5, time: '08:00', mins: 90, online: false, price: 0, capacity: 30, host: 'r22',
    going: ['r22', 'r5', 'r18'],
    about: 'Две группы по темпу, после — завтрак.',
  },
  {
    id: 'e11', kind: 'meet', title: 'Приём новых резидентов', region: 'tbilisi',
    inDays: 7, time: '19:00', mins: 150, online: false, price: 0, capacity: 26, host: 'r20',
    going: ['r20', 'r17', 'r16'],
    about: 'Знакомство с теми, кто вступил в этом месяце. Старшие рассказывают, чем могут быть полезны.',
  },
  {
    id: 'e12', top: true, kind: 'meet', title: 'Питчи резидентов', region: 'moscow',
    inDays: 8, time: '19:00', mins: 150, online: false, price: 30, capacity: 40, host: 'r8',
    going: ['r8', 'r2', 'r5', 'r10', 'r13'],
    about: 'Шесть питчей по семь минут, вопросы от круга. Заявки принимает куратор.',
  },
  {
    id: 'e13', kind: 'club', title: 'Закрытый ужин на двенадцать', region: 'istanbul',
    inDays: 16, time: '20:30', mins: 210, online: false, price: 90, capacity: 12, host: 'r19', minDegree: 2,
    going: ['r19', 'r14', 'r18'],
    about: 'Шеф готовит при гостях. Состав стола подбирается вручную под запросы участников.',
  },
  {
    id: 'e14', kind: 'sport', title: 'Падел-турнир', region: 'phuket',
    inDays: 11, time: '16:00', mins: 180, online: false, price: 25, capacity: 16, host: 'r15',
    going: ['r15', 'r4', 'r7', 'r12'],
    about: 'Парный турнир, ракетки в аренду. После матчей — ужин.',
  },
  {
    id: 'e15', kind: 'meet', title: 'Кофе для тех, кто только прилетел', region: 'bali',
    inDays: 3, time: '10:00', mins: 90, online: false, price: 0, capacity: 20, host: 'r7',
    going: ['r7', 'r3', 'r12'],
    about: 'Раз в неделю: где жить, где работать, к кому идти с документами. Приходят и старожилы.',
  },
  {
    id: 'e16', kind: 'meet', title: 'Прошедший разбор: розница и сети', region: 'moscow',
    inDays: -4, time: '19:00', mins: 120, online: true, price: 0, capacity: 40, host: 'r8',
    going: ['r8', 'r5', 'r10'],
    about: 'Как выйти с сорока точек на сто. Запись в базе знаний.',
  },
  {
    id: 'e17', kind: 'live', title: 'Прошедший эфир: школы и врачи в Азии', region: 'global',
    inDays: -9, time: '18:00', mins: 60, online: true, price: 0, capacity: 150, host: 'r20',
    going: ['r20', 'r7', 'r15'],
    about: 'Разбор для семей: школы, страховка, педиатры. Запись доступна.',
  },
];

/* Девять номинаций U-world */
export const AWARDS = [
  { id: 'aw1', name: 'Резидент года', about: 'Наибольший вклад в жизнь сообщества' },
  { id: 'aw2', name: 'Результат года', about: 'Выдающийся результат в своём деле' },
  { id: 'aw3', name: 'Открытие года', about: 'Вступил в этом году и уже изменил круг' },
  { id: 'aw4', name: 'Регион года', about: 'Самое живое сообщество на месте' },
  { id: 'aw5', name: 'Сообщество года', about: 'Направление с самой сильной жизнью' },
  { id: 'aw6', name: 'Наставник года', about: 'Тот, кто вырастил других' },
  { id: 'aw7', name: 'Связь года', about: 'Знакомство, которое выросло в общее дело' },
  { id: 'aw8', name: 'Служение', about: 'Работа на сообщество без ожидания выгоды' },
  { id: 'aw9', name: 'Хранитель традиции', about: 'Тот, кто держит правила, когда их удобно нарушить' },
];

/* ——— сообщества ———
   region: ключ региона или 'global'. access: open | closed. */
export const COMMUNITIES = [
  { id: 'c-it', skill: 'it', name: 'ИТ и продукт', topic: 'Технологии', icon: 'code', tone: '#5B8CFF', region: 'global', access: 'open', members: 186, curator: 'r13', about: 'Инженеры, продакты, основатели софтверных компаний. Разборы архитектур, найм, подрядчики.' },
  { id: 'c-ai', skill: 'ai', name: 'Искусственный интеллект', topic: 'Технологии', icon: 'spark', tone: '#8E7BF5', region: 'global', access: 'open', members: 204, curator: 'r13', about: 'Внедрения, а не новости: что работает в проде, сколько стоит и где ломается.' },
  { id: 'c-move', skill: 'realty', name: 'Релокация и визы', topic: 'Переезд', icon: 'plane', tone: '#5FE0C8', region: 'global', access: 'open', members: 241, curator: 'r9', about: 'Самое живое сообщество: визы, банки, жильё, школы. Отвечают те, кто прошёл это сам.' },
  { id: 'c-home', skill: 'realty', name: 'Жильё и быт', topic: 'Переезд', icon: 'home', tone: '#D9B26B', region: 'global', access: 'open', members: 171, curator: 'r7', about: 'Где жить в каждом регионе, как проверять договор и не потерять депозит.' },
  { id: 'c-biz', skill: 'ops', name: 'Операционный бизнес', topic: 'Дело', icon: 'chart', tone: '#E9855C', region: 'global', access: 'open', members: 143, curator: 'r8', about: 'Розница, услуги, франшизы. Скучные бизнесы с настоящей выручкой.' },
  { id: 'c-body', skill: 'body', name: 'Тело и практики', topic: 'Жизнь', icon: 'leaf', tone: '#58D68D', region: 'global', access: 'open', members: 158, curator: 'r20', about: 'Спорт, восстановление, ретриты, медицина для тех, кто много летает.' },
  { id: 'c-brand', skill: 'brand', name: 'Бренд и медиа', topic: 'Дело', icon: 'brush', tone: '#F2789B', region: 'global', access: 'open', members: 121, curator: 'r18', about: 'Айдентика, съёмки, тексты, звук. Резиденты делают проекты друг для друга.' },
  { id: 'c-family', name: 'Семья в переезде', topic: 'Жизнь', icon: 'heart', tone: '#C7A3E8', region: 'global', access: 'open', members: 97, curator: 'r11', about: 'Школы, врачи, документы для детей в новой стране.' },

  { id: 'c-dubai', name: 'Дубай: свои', topic: 'Регион', icon: 'users', tone: '#D9B26B', region: 'dubai', access: 'open', members: 148, curator: 'r9', about: 'Всё про жизнь в регионе: где встречаемся, кто прилетел, куда идти с вопросом.' },
  { id: 'c-bali', name: 'Бали: свои', topic: 'Регион', icon: 'users', tone: '#58D68D', region: 'bali', access: 'open', members: 132, curator: 'r12', about: 'Сёрф, виллы, байки, врачи и общий стол по четвергам.' },
  { id: 'c-moscow', name: 'Москва: свои', topic: 'Регион', icon: 'users', tone: '#8E7BF5', region: 'moscow', access: 'open', members: 214, curator: 'r22', about: 'Завтраки по средам, питчи, спорт и разборы.' },
  { id: 'c-phuket', name: 'Пхукет: свои', topic: 'Регион', icon: 'users', tone: '#5B8CFF', region: 'phuket', access: 'open', members: 86, curator: 'r15', about: 'Семейный регион: школы, падел, вода и спокойный ритм.' },
  { id: 'c-tbilisi', name: 'Тбилиси: свои', topic: 'Регион', icon: 'users', tone: '#5FE0C8', region: 'tbilisi', access: 'open', members: 58, curator: 'r20', about: 'Первый регион для тех, кто только начал жить между странами.' },
  { id: 'c-istanbul', name: 'Стамбул: свои', topic: 'Регион', icon: 'users', tone: '#E9855C', region: 'istanbul', access: 'open', members: 74, curator: 'r19', about: 'Встречи на двух берегах, рестораны резидентов, короткие визиты.' },

  { id: 'c-invest', skill: 'capital', name: 'Инвестиции', topic: 'Дело', icon: 'coin', tone: '#5FE0C8', region: 'global', access: 'closed', minDegree: 3, members: 52, curator: 'r2', about: 'Синдикаты, дью-дилидженс, сделки. Закрытый клуб: вход с третьей степени.' },
  { id: 'c-law', skill: 'law', name: 'Право и структуры', topic: 'Дело', icon: 'shield', tone: '#9BA6BE', region: 'global', access: 'closed', minDegree: 2, members: 68, curator: 'r14', about: 'Холдинги, трасты, мультиюрисдикция. Закрытый клуб.' },
  { id: 'c-founders', skill: 'ops', name: 'Основатели', topic: 'Дело', icon: 'spark', tone: '#5B8CFF', region: 'global', access: 'closed', minDegree: 2, members: 96, curator: 'r13', about: 'Только те, кто держит компанию. Разговор без питчей: наём, увольнения, кассовые разрывы, выгорание.' },
  { id: 'c-office', skill: 'capital', name: 'Семейный капитал', topic: 'Дело', icon: 'wallet', tone: '#D9B26B', region: 'global', access: 'closed', minDegree: 3, members: 34, curator: 'r2', about: 'Как устроены семейные деньги: наследование, доверительное управление, разделение рисков между странами.' },
  { id: 'c-long', skill: 'body', name: 'Долголетие', topic: 'Жизнь', icon: 'heart', tone: '#58D68D', region: 'global', access: 'closed', minDegree: 2, members: 61, curator: 'r20', about: 'Чекапы, врачи в каждом регионе, протоколы восстановления после перелётов. Данные участников не выходят за клуб.' },
  { id: 'c-curators', name: 'Совет кураторов', topic: 'Клуб', icon: 'seal', tone: '#8E7BF5', region: 'global', access: 'closed', minDegree: 3, members: 24, curator: 'r22', about: 'Кураторы сообществ и регионов: кого принимаем, кого просим уйти, что меняем в правилах.' },
  { id: 'c-deep', name: 'Глубокая вода', topic: 'Клуб', icon: 'compass', tone: '#5FE0C8', region: 'global', access: 'closed', minDegree: 4, members: 18, curator: 'r23', about: 'Разговор о том, что не обсуждают вслух. Состав известен только участникам.' },
  { id: 'c-black', name: '·····', topic: 'Клуб', icon: 'seal', tone: '#D9B26B', region: 'global', access: 'closed', minDegree: 5, members: 0, curator: 'r23', about: '' },
];

/* Чат экспатов есть в каждом регионе: туда идут в первый день на месте —
   спросить про сим-карту, врача и договор аренды. Собирается из справочника
   регионов, чтобы двадцать почти одинаковых записей не жили руками. */
const EXPAT_TONES = ['#5FE0C8', '#5B8CFF', '#58D68D', '#D9B26B', '#8E7BF5', '#F2789B', '#E9855C'];
const EXPAT_CURATORS = ['r9', 'r12', 'r22', 'r15', 'r19', 'r20', 'r17', 'r16', 'r5', 'r7'];

export const EXPAT_CHATS = REGION_KEYS.map((key, i) => ({
  id: `c-exp-${key}`,
  name: `Экспаты · ${REGIONS[key].name}`,
  topic: 'Регион',
  icon: 'globe',
  tone: EXPAT_TONES[i % EXPAT_TONES.length],
  region: key,
  access: 'open',
  expat: true,
  members: Math.round(REGIONS[key].residents * 1.7),
  curator: EXPAT_CURATORS[i % EXPAT_CURATORS.length],
  about: 'Бытовой чат региона: сим-карта, врач, договор аренды, куда идти с документами.',
}));

/* Общий список: тематические сообщества, клубы и чаты экспатов. */
COMMUNITIES.push(...EXPAT_CHATS);

export const COMMUNITY_TOPICS = ['Переезд', 'Технологии', 'Дело', 'Жизнь', 'Регион'];

export const THREADS = {
  'c-move': [
    { who: 'r9', text: 'Напоминаю: с этого месяца в ОАЭ подача на резидентскую визу идёт только через новый портал. Старые ссылки не работают, инструкцию обновила в базе знаний.', ago: 30 },
    { who: 'r16', text: 'Подтверждаю, вчера подавались. Заняло сорок минут вместо трёх часов.', ago: 26 },
    { who: 'r5', text: 'А кто-нибудь делал визу цифрового кочевника в Португалии в этом году? Интересуют реальные сроки.', ago: 14 },
    { who: 'r13', text: 'Делал. Одиннадцать недель от подачи до карты. Готовь выписки за шесть месяцев, это главный стопор.', ago: 12 },
  ],
  'c-ai': [
    { who: 'r13', text: 'Выложил разбор: во что реально обходится инференс на своём железе против облака. Считал на нашем проекте, цифры без маркетинга.', ago: 52 },
    { who: 'r21', text: 'Смотрю. У нас похожая математика, но электричество в Сингапуре съедает всю экономию.', ago: 44 },
    { who: 'r10', text: 'Ищу пайплайн монтажа на нейросетях, который не разваливается на длинных интервью. У кого работает?', ago: 21 },
  ],
  'c-bali': [
    { who: 'r12', text: 'Сёрф завтра в 6:30, доски беру на троих. Кто ещё?', ago: 9 },
    { who: 'r3', text: 'Я в деле, приеду на байке, могу кого-то забрать из Берава.', ago: 7 },
    { who: 'r7', text: 'В четверг общий стол в Чангу, место на двадцать человек. Записывайтесь до среды.', ago: 5 },
  ],
  'c-home': [
    { who: 'r7', text: 'Правило, которое экономит депозит: фотографируйте всё при заезде, включая счётчики, и отправляйте хозяину в тот же день.', ago: 40 },
    { who: 'r11', text: 'И проверяйте, кто платит за обслуживание бассейна. Это самая частая ссора в конце сезона.', ago: 36 },
  ],
  'c-family': [
    { who: 'r11', text: 'Кто отдавал детей в школы Дубая в этом году? Интересует British curriculum.', ago: 20 },
    { who: 'r9', text: 'Мы в JESS. Запись на следующий год открывается в сентябре, лучше не тянуть.', ago: 18 },
  ],
  'c-invest': [
    { who: 'r2', text: 'Открываю синдикат на pre-seed, чек от $25k. Материалы в закреплённых.', ago: 36 },
    { who: 'r23', text: 'Посмотрю к пятнице. Интересует только структура владения.', ago: 28 },
  ],
  'c-it': [
    { who: 'r17', text: 'Собрал схему расчётов для команды в трёх странах. Могу разобрать чей-то кейс на созвоне.', ago: 34 },
    { who: 'r5', text: 'Возьми мой: пять человек в четырёх юрисдикциях и полный хаос с валютой.', ago: 25 },
  ],
  'c-moscow': [
    { who: 'r22', text: 'Завтрак в среду в девять, как обычно. Новых четверо — приходите знакомиться.', ago: 16 },
    { who: 'r8', text: 'Буду. Принесу разбор по найму, который просили.', ago: 12 },
  ],
  'c-dubai': [
    { who: 'r9', text: 'Ужин нового круга в четверг, шестнадцать мест. Для тех, кто в регионе меньше трёх месяцев.', ago: 22 },
    { who: 'r11', text: 'Записалась. И подскажу по районам, если кто выбирает жильё.', ago: 19 },
  ],
};

/* ——— запросы резидентов ———
   Лента, где просят помощь и отвечают. Ответ — в ветке или в личку. */
/* Теги запроса: id — для хранения, name — для чипа, ask — как тема звучит
   внутри автособранного текста («запрос на партнёрство и знакомства»). */
export const REQUEST_TAGS = [
  { id: 'contacts', emoji: '🤝', name: 'Знакомства', ask: 'знакомства' },
  { id: 'partner', emoji: '🧩', name: 'Партнёрство', ask: 'партнёрство' },
  { id: 'work', emoji: '💼', name: 'Работа', ask: 'работа' },
  { id: 'money', emoji: '📈', name: 'Деньги', ask: 'инвестиции' },
  { id: 'visa', emoji: '🛂', name: 'Визы', ask: 'визы' },
  { id: 'home', emoji: '🏠', name: 'Жильё', ask: 'жильё' },
  { id: 'move', emoji: '📦', name: 'Переезд', ask: 'переезд' },
  { id: 'advice', emoji: '💡', name: 'Совет', ask: 'совет' },
  { id: 'health', emoji: '🩺', name: 'Здоровье', ask: 'здоровье' },
  { id: 'family', emoji: '🎒', name: 'Дети', ask: 'школа для детей' },
];

export const requestTag = (id) => REQUEST_TAGS.find((t) => t.id === id);

/* Запрос можно опубликовать вообще без текста — достаточно тегов.
   Тогда он собирается сам. Вариантов подачи семь, они чередуются,
   чтобы лента не выглядела как рассылка одного бота. */
const cap = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);

const TEMPLATES = [
  (loc, topics) => `У меня запрос ${loc}: ${topics}. Жду контактов и откликов.`,
  (loc, topics) => `Ищу ${loc} помощь по теме: ${topics}. Напишите, если это ваша сфера.`,
  (loc, topics) => `${cap(topics)} — вот что нужно ${loc} прямо сейчас. Откликнитесь, кто в теме.`,
  (loc, topics) => `Я ${loc}. Тема: ${topics}. Можно ответить в ветке, можно в личку.`,
  (loc, topics) => `Короткий запрос ${loc}: ${topics}. Быстро созвонимся — и я тоже пригожусь.`,
  (loc, topics) => `Собираю контакты ${loc} по теме: ${topics}. Любая наводка в помощь.`,
  (loc, topics) => `${cap(loc)} нужен человек, который разбирается: ${topics}. Подскажете?`,
];

/** Перечисление тем через запятую и «и»: «жильё, визы и переезд». */
export function topicsPhrase(tagIds) {
  const words = tagIds.map((id) => requestTag(id)?.ask).filter(Boolean);
  if (words.length <= 1) return words[0] || 'помощь сообщества';
  return `${words.slice(0, -1).join(', ')} и ${words[words.length - 1]}`;
}

/** Текст запроса из одних тегов. variant крутит подачу по кругу. */
export function autoRequestText(regionKey, tagIds, variant = 0) {
  const loc = REGIONS[regionKey]?.loc || 'в сообществе';
  return TEMPLATES[((variant % TEMPLATES.length) + TEMPLATES.length) % TEMPLATES.length](loc, topicsPhrase(tagIds));
}

export const REQUEST_VARIANTS = TEMPLATES.length;

export const REQUESTS = [
  {
    id: 'q1', who: 'r5', region: 'moscow', ago: 2, tags: ['work', 'partner'],
    text: 'Ищу команду, которой нужен продакт-сооснователь. Платежи, финтех, семь лет опыта. Готова войти в проект на ранней стадии и переехать в любой регион сообщества.',
    replies: [
      { who: 'r13', ago: 1.5, text: 'У меня как раз стоит вопрос по продуктовой части в Лиссабоне. Напишу в личку, обсудим.' },
      { who: 'r17', ago: 1, text: 'Ирина, посмотрите мой проект по расчётам для распределённых команд — там ровно ваша задача.' },
    ],
  },
  {
    id: 'q2', who: 'r16', region: 'almaty', ago: 5, tags: ['partner', 'move'],
    text: 'Нужен партнёр по складу в Дубае, 800 м². Есть поток грузов из Китая, не хватает рук на месте. Готова отдать долю за операционку.',
    replies: [
      { who: 'r9', ago: 4, text: 'Знаю двоих, кто держит склады в Джебель-Али. Свела вас в личке.' },
    ],
  },
  {
    id: 'q3', who: 'r3', region: 'phuket', ago: 8, tags: ['home', 'advice'],
    text: 'Переезжаю с Пхукета на Бали в марте. Что сейчас с ценами на длинную аренду в Чангу и стоит ли брать через агента? Бюджет до $1200 в месяц.',
    replies: [
      { who: 'r7', ago: 7, text: 'До $1200 реально, но не в первой линии. Агент нужен только для проверки договора — покажу шаблон.' },
      { who: 'r12', ago: 6, text: 'Могу показать три варианта у соседей, без комиссии. И байк подгоню в первый день.' },
    ],
  },
  {
    id: 'q4', who: 'r10', region: 'moscow', ago: 12, tags: ['work', 'contacts'],
    text: 'Снимаю про технологии. Ищу резидентов, кто готов рассказать о своём деле на камеру — сделаю материал бесплатно, мне нужны истории, вам — видео для себя.',
    replies: [
      { who: 'r21', ago: 10, text: 'Возьмусь. У нас как раз запускается линия на складе, будет что показать.' },
      { who: 'r1', ago: 9, text: 'И меня запиши. Могу и площадку дать под съёмку на Бали.' },
    ],
  },
  {
    id: 'q5', who: 'r24', region: 'newyork', ago: 18, tags: ['advice', 'visa'],
    text: 'Кто продлевал B1/B2 в этом году не из США? Интересуют реальные сроки записи и города, где очередь короче.',
    replies: [
      { who: 'r14', ago: 16, text: 'Белград и Ереван — самые быстрые сейчас. В Ереване записывалась за три недели.' },
    ],
  },
  {
    id: 'q6', who: 'r18', region: 'barcelona', ago: 26, tags: ['contacts'],
    text: 'Прилетаю в Дубай на неделю с 20-го. Ищу компанию на утренний спорт и один хороший ужин. Кто на месте?',
    replies: [
      { who: 'r11', ago: 24, text: 'Я на месте. Бегаем по утрам вдоль канала, присоединяйтесь.' },
      { who: 'r9', ago: 22, text: 'Ужин нового круга как раз попадает на ваши даты. Держу место.' },
    ],
  },
  {
    id: 'q7', who: 'r15', region: 'phuket', ago: 34, tags: ['work'],
    text: 'Ищу управляющего на объект в Бангкоке. Нужен человек, который жил в Азии и умеет держать подрядчиков. Ставка выше рынка, но и спрос серьёзный.',
    replies: [],
  },
  {
    id: 'q8', who: 'r20', region: 'tbilisi', ago: 40, tags: ['health'],
    text: 'Собираю группу на расширенный чекап в Тбилиси в феврале — от восьми человек цена падает вдвое. Кому актуально?',
    replies: [
      { who: 'r22', ago: 38, text: 'Записывай двоих.' },
      { who: 'r16', ago: 30, text: 'И меня, если даты сдвинутся ближе к концу месяца.' },
    ],
  },
  {
    id: 'q9', who: 'r17', region: 'yerevan', ago: 50, tags: ['money'],
    text: 'Поднимаем раунд на платёжную инфраструктуру. Не прошу денег — прошу двух-трёх человек, кто пройдёт по нашей юнит-экономике и скажет, где мы себя обманываем.',
    replies: [
      { who: 'r2', ago: 47, text: 'Присылайте модель. Разберу и отвечу честно, даже если ответ не понравится.' },
    ],
  },
];

/* ——— услуги: всё, что помогает быстро осесть в новом регионе ——— */
export const SERVICE_CATS = [
  { id: 'visa', name: 'Визы и документы', short: 'Виза', emoji: '🛂', icon: 'passport' },
  { id: 'home', name: 'Жильё', short: 'Жильё', emoji: '🏠', icon: 'home' },
  { id: 'money', name: 'Счета и налоги', short: 'Счёт', emoji: '🏦', icon: 'wallet' },
  { id: 'move', name: 'Переезд', short: 'Переезд', emoji: '📦', icon: 'briefcase' },
  { id: 'transport', name: 'Транспорт', short: 'Транспорт', emoji: '🚗', icon: 'car' },
  { id: 'health', name: 'Здоровье', short: 'Здоровье', emoji: '🩺', icon: 'heart' },
  { id: 'kids', name: 'Дети и школы', short: 'Школа', emoji: '🎒', icon: 'graduation' },
  { id: 'work', name: 'Работа и офис', short: 'Офис', emoji: '💻', icon: 'code' },
];

/* Порядок витрины в регионе — по тому, что нужно в первую неделю на месте. */
export const SERVICE_ORDER = ['home', 'visa', 'transport', 'money', 'move', 'health', 'kids', 'work'];
export const serviceCat = (id) => SERVICE_CATS.find((c) => c.id === id);

export const SERVICES = [
  { id: 's1', title: 'Резидентская виза ОАЭ под ключ', cat: 'visa', owner: 'r9', region: 'dubai', price: 300, unit: 'услуга', days: 12, reply: 8, rating: 5.0, deals: 96, desc: 'Виза, Emirates ID, медицинская проверка, банковский счёт. Сопровождение на всех этапах, включая запись в центры.' },
  { id: 's2', title: 'Продление B211 и выезды', cat: 'visa', owner: 'r12', region: 'bali', price: 90, unit: 'продление', days: 5, reply: 25, rating: 4.8, deals: 214, desc: 'Продление визы без выезда, сопровождение в иммиграционном офисе, напоминания о сроках.' },
  { id: 's3', title: 'Проверка договора аренды', cat: 'home', owner: 'r7', region: 'phuket', price: 60, unit: 'договор', days: 1, reply: 40, rating: 4.9, deals: 158, desc: 'Читаю договор до подписания, отмечаю пункты, из-за которых теряют депозит. Работает в Азии и на Бали.' },
  { id: 's4', title: 'Подбор жилья на сезон', cat: 'home', owner: 'r7', region: 'bali', price: 0, unit: 'по запросу', days: 7, reply: 40, rating: 4.9, deals: 74, desc: 'Три проверенных варианта под ваш бюджет и район, договор и депозит через эскроу. Без комиссии с резидентов.' },
  { id: 's5', title: 'Банковский счёт и налоги', cat: 'money', owner: 'r17', region: 'yerevan', price: 400, unit: 'проект', days: 10, reply: 50, rating: 4.8, deals: 88, desc: 'Личный и корпоративный счёт, схема расчётов для распределённой команды, налоговая карта по вашим странам.' },
  { id: 's6', title: 'Бухгалтерия для нерезидента', cat: 'money', owner: 'r8', region: 'global', price: 250, unit: 'мес', days: 3, reply: 42, rating: 4.9, deals: 67, desc: 'Отчётность, валютный контроль, работа с зарубежными контрактами. Для тех, кто живёт в одной стране, а работает в трёх.' },
  { id: 's7', title: 'Переезд вещей между странами', cat: 'move', owner: 'r16', region: 'almaty', price: 480, unit: 'куб', days: 21, reply: 45, rating: 4.7, deals: 88, desc: 'Сборные грузы между СНГ, Китаем и Заливом. Резидентам — по себестоимости плюс страховка.' },
  { id: 's8', title: 'Первая неделя в регионе', cat: 'move', owner: 'r9', region: 'dubai', price: 150, unit: 'услуга', days: 1, reply: 8, rating: 5.0, deals: 122, desc: 'Встреча, сим-карта, транспорт, показ районов, три встречи с нужными людьми. Чтобы не терять неделю на бытовуху.' },
  { id: 's9', title: 'Байк с доставкой к дому', cat: 'transport', owner: 'r12', region: 'bali', price: 90, unit: 'мес', days: 1, reply: 25, rating: 4.8, deals: 388, desc: 'PCX и NMAX, два шлема, механик приезжает сам в течение двух часов.' },
  { id: 's10', title: 'Автомобиль без залога', cat: 'transport', owner: 'r4', region: 'bali', price: 420, unit: 'мес', days: 1, reply: 12, rating: 4.9, deals: 214, desc: 'Доставка к дому, страховка включена, подменная машина в течение дня.' },
  { id: 's11', title: 'Чекап и протокол восстановления', cat: 'health', owner: 'r20', region: 'tbilisi', price: 260, unit: 'услуга', days: 2, reply: 35, rating: 4.9, deals: 118, desc: 'Расширенный анализ, разбор сна и перелётов, план на три месяца. Онлайн-сопровождение включено.' },
  { id: 's12', title: 'Медицинская страховка для кочевника', cat: 'health', owner: 'r9', region: 'global', price: 95, unit: 'мес', days: 2, reply: 8, rating: 4.8, deals: 143, desc: 'Покрытие в любой стране пребывания, включая спорт и мотоцикл. Подбираю под маршрут и возраст.' },
  { id: 's13', title: 'Школа и документы для ребёнка', cat: 'kids', owner: 'r11', region: 'dubai', price: 180, unit: 'услуга', days: 14, reply: 30, rating: 4.9, deals: 52, desc: 'Подбор школы под программу и бюджет, запись, перевод документов, сопровождение на собеседовании.' },
  { id: 's14', title: 'Педиатр и врачи в Азии', cat: 'kids', owner: 'r20', region: 'phuket', price: 0, unit: 'по запросу', days: 1, reply: 35, rating: 5.0, deals: 61, desc: 'Список проверенных врачей и клиник по регионам, помощь с записью и переводом. Резидентам бесплатно.' },
  { id: 's15', title: 'Рабочее место и юрлицо', cat: 'work', owner: 'r19', region: 'istanbul', price: 220, unit: 'мес', days: 5, reply: 15, rating: 4.8, deals: 46, desc: 'Стол в тихом месте, юридический адрес, регистрация компании и первый бухгалтер.' },
  { id: 's16', title: 'Съёмка личного бренда', cat: 'work', owner: 'r10', region: 'moscow', price: 600, unit: 'день', days: 5, reply: 20, rating: 4.8, deals: 63, desc: 'Интервью, фото для профиля, вертикальные видео. Монтаж за пять дней.' },
];

/* ——— личные переписки ——— */
export const DMS = [
  {
    with: 'r22', unread: 2,
    thread: [
      { who: 'r22', text: 'Добро пожаловать! Я Мария, отвечаю за онбординг. Прочитала анкету — есть три человека, с которыми вас стоит познакомить в вашем регионе.', ago: 26 },
      { who: 'r22', text: 'И сразу совет: откройте раздел «Запросы» и напишите, что вам нужно прямо сейчас. Это работает быстрее, чем искать людей вручную.', ago: 25 },
      { who: 'me', text: 'Спасибо! Напишу сегодня.', ago: 20 },
      { who: 'r22', text: 'Отлично. В четверг эфир про перенос компании в ОАЭ — советую заглянуть, там будет половина дубайского круга.', ago: 3 },
      { who: 'r22', text: 'И не забудьте объявить поездку, если куда-то летите: сообщество любит встречать своих.', ago: 2 },
    ],
  },
  {
    with: 'r9', unread: 1,
    thread: [
      { who: 'r9', text: 'Мария сказала, вы смотрите в сторону Дубая. Если нужна виза, счёт или первая неделя на месте — говорите, у нас это отработано.', ago: 18 },
      { who: 'me', text: 'Пока считаю бюджет. Виза точно понадобится ближе к весне.', ago: 16 },
      { who: 'r9', text: 'Тогда посчитайте по калькулятору на карте, он честный. И приходите на ужин нового круга в четверг.', ago: 5 },
    ],
  },
  {
    with: 'r13', unread: 0,
    thread: [
      { who: 'r13', text: 'Увидел вас в сообществе по ИИ. Я в Дубае со вторника, ищу первых корпоративных клиентов в Заливе. Может, кофе?', ago: 12 },
      { who: 'me', text: 'С радостью. Среда, утро?', ago: 11 },
      { who: 'r13', text: 'Среда, 9:00. Скину точку в личку накануне.', ago: 10 },
    ],
  },
  {
    with: 'r7', unread: 0,
    thread: [
      { who: 'r7', text: 'По вашему запросу про жильё: есть три варианта в Чангу до $1200. Скину фото и договор на проверку.', ago: 30 },
      { who: 'me', text: 'Буду признателен. Заезд планирую в марте.', ago: 28 },
      { who: 'r7', text: 'Тогда бронируем в январе — в марте уже разберут.', ago: 27 },
    ],
  },
];

/* Объявленные поездки резидентов. Смещение в днях, как и у событий,
   чтобы расписание всегда было живым. */
export const TRIPS = [
  { who: 'r13', region: 'dubai', inDays: 3, days: 7 },
  { who: 'r18', region: 'dubai', inDays: 11, days: 7 },
  { who: 'r5', region: 'dubai', inDays: 19, days: 14 },
  { who: 'r2', region: 'bali', inDays: 26, days: 30 },
  { who: 'r22', region: 'istanbul', inDays: 24, days: 3 },
  { who: 'r9', region: 'istanbul', inDays: 24, days: 4 },
  { who: 'r14', region: 'lisbon', inDays: 47, days: 2 },
  { who: 'r21', region: 'lisbon', inDays: 46, days: 4 },
  { who: 'r3', region: 'bali', inDays: 34, days: 60 },
  { who: 'r16', region: 'dubai', inDays: 8, days: 5 },
  { who: 'r25', region: 'lisbon', inDays: 44, days: 6 },
  { who: 'r30', region: 'singapore', inDays: 15, days: 4 },
  { who: 'r29', region: 'phuket', inDays: 6, days: 10 },
  { who: 'r20', region: 'dubai', inDays: 21, days: 8 },
  { who: 'r8', region: 'almaty', inDays: 13, days: 4 },
  { who: 'r27', region: 'mexico', inDays: 29, days: 12 },
];

export const eventById = (id) => EVENTS.find((e) => e.id === id);
export const communityById = (id) => COMMUNITIES.find((c) => c.id === id);
export const serviceById = (id) => SERVICES.find((s) => s.id === id);
export const requestById = (id) => REQUESTS.find((r) => r.id === id);
