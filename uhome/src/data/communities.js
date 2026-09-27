/* Сообщества: пять локальных — по регионам клуба — и пять по интересам.
   Своё локальное сообщество определяется регионом резидента и стоит первым. */

export const COMMUNITIES = [
  {
    id: 'c-moscow', kind: 'local', region: 'moscow', name: 'UHOME Москва', members: 214,
    about: 'Бизнес-завтраки по четвергам, закрытые ужины и большие встречи раз в сезон.',
    hosts: ['r12', 'r21'],
    chat: [
      { who: 'r12', text: 'Завтрак в четверг — осталось два места, пишите.', mins: 50 },
      { who: 'r21', text: 'Кто идёт на итоги сезона? Собираю список гостей.', mins: 180 },
    ],
  },
  {
    id: 'c-bali', kind: 'local', region: 'bali', name: 'UHOME Бали', members: 132,
    about: 'Серф по утрам, падел по средам и общий стол по пятницам. Чангу, Убуд, Букит.',
    hosts: ['r22', 'r1'],
    chat: [
      { who: 'r4', text: 'На Батур в субботу ещё есть два байка — присоединяйтесь.', mins: 25 },
      { who: 'r22', text: 'Серф-утро переносим на 7:00 — прилив позже.', mins: 95 },
      { who: 'r9', text: 'Кто знает хорошего педиатра в Чангу?', mins: 240 },
    ],
  },
  {
    id: 'c-dubai', kind: 'local', region: 'dubai', name: 'UHOME Дубай', members: 148,
    about: 'Сделки, компании, резидентские визы. Встречи на крыше Марины раз в месяц.',
    hosts: ['r5', 'r13'],
    chat: [
      { who: 'r5', text: 'На крыше в пятницу будет 40 человек, ужин включён.', mins: 70 },
      { who: 'r13', text: 'Напоминаю: до конца месяца подать отчётность по ESR.', mins: 300 },
    ],
  },
  {
    id: 'c-usa', kind: 'local', region: 'miami', name: 'UHOME США', members: 46,
    about: 'Майами, Нью-Йорк, Лос-Анджелес. Coffee & Deals раз в две недели и закрытые ужины.',
    hosts: ['r10', 'r16'],
    chat: [
      { who: 'r10', text: 'Coffee & Deals в субботу в Брикелле, приходите с задачей.', mins: 120 },
    ],
  },
  {
    id: 'c-europe', kind: 'local', region: 'europe', name: 'UHOME Европа', members: 63,
    about: 'Лиссабон, Барселона, Берлин, Кипр. Ужины по городам и общие эфиры.',
    hosts: ['r11', 'r27'],
    chat: [
      { who: 'r11', text: 'Первый ужин в Лиссабоне — бронирую стол на 20.', mins: 60 },
      { who: 'r27', text: 'На Кипре собираемся в ноябре, кто будет?', mins: 400 },
    ],
  },
  {
    id: 'i-invest', kind: 'interest', name: 'Инвестиции и сделки', icon: 'chart', tone: '#C9A96E', members: 96, chapters: ['moscow', 'dubai', 'europe', 'miami'],
    about: 'Сделки внутри клуба, синдикаты и разбор проектов. Раз в месяц — питч-сессия.',
    hosts: ['r2', 'r27'],
    chat: [{ who: 'r2', text: 'Собираем синдикат в AI для продаж, чек от $10 тысяч.', mins: 140 }],
  },
  {
    id: 'i-realty', kind: 'interest', name: 'Недвижимость', icon: 'home', tone: '#C9A27E', members: 88, chapters: ['bali', 'dubai', 'miami'],
    about: 'Аренда и покупка на Бали, в Дубае и Майами. Честные отзывы о застройщиках.',
    hosts: ['r8', 'r19'],
    chat: [{ who: 'r8', text: 'Освобождается вилла на 3 спальни в Семиньяке с ноября.', mins: 90 }],
  },
  {
    id: 'i-family', kind: 'interest', name: 'Семьи с детьми', icon: 'kids', tone: '#C99AAA', members: 71, chapters: ['bali', 'dubai', 'moscow'],
    about: 'Сады, школы, врачи и детские праздники во всех регионах клуба.',
    hosts: ['r15', 'r26'],
    chat: [{ who: 'r15', text: 'В субботу семейный день в Little Sun — ждём всех!', mins: 200 }],
  },
  {
    id: 'i-sport', kind: 'interest', name: 'Спорт: серф, падел, бег', icon: 'wave', tone: '#8BB8B8', members: 104, chapters: ['bali', 'dubai', 'moscow', 'europe'],
    about: 'Тренировки вместе в каждом регионе: серф на Бали, падел в Дубае, бег в Москве.',
    hosts: ['r22', 'r5'],
    chat: [{ who: 'r22', text: 'Турнир по паделу через три недели, запись открыта.', mins: 30 }],
  },
  {
    id: 'i-ai', kind: 'interest', name: 'AI и технологии', icon: 'spark', tone: '#A99BC9', members: 118, chapters: ['moscow', 'bali', 'europe', 'miami'],
    about: 'Автоматизации, ассистенты и продукты на AI. Делимся тем, что работает.',
    hosts: ['r14', 'r22'],
    chat: [{ who: 'r14', text: 'Выложил в Базу запись про ассистентов продаж.', mins: 160 }],
  },
];

export const communityById = (id) => COMMUNITIES.find((c) => c.id === id);
export const localOf = (region) => COMMUNITIES.find((c) => c.kind === 'local' && c.region === region);

/* Сколько резидентов и сообществ в регионе: локальное плюс главы сообществ по интересам. */
export function regionStats(region) {
  const local = localOf(region);
  const chapters = COMMUNITIES.filter((c) => c.kind === 'interest' && c.chapters?.includes(region));
  return { members: local?.members || 0, communities: (local ? 1 : 0) + chapters.length, list: local ? [local, ...chapters] : chapters };
}
