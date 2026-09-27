/* Резиденты клуба. Содержимое демонстрационное: имена, биографии и связи
   с компаниями придуманы для показа и заменяются настоящей базой. */

export const ROLES = ['Основатель', 'Инвестор', 'Предприниматель', 'Эксперт', 'Творец', 'Управляющий'];

/* Цвет аватара — от роли: инвестора видно от основателя одним взглядом. */
export const ROLE_TONE = {
  'Основатель': '#8FA8C9',
  'Инвестор': '#C9A96E',
  'Предприниматель': '#8FB8A0',
  'Эксперт': '#A99BC9',
  'Творец': '#C99AAA',
  'Управляющий': '#8BB8B8',
};

export const ROLE_EN = {
  'Основатель': 'FOUNDER',
  'Инвестор': 'INVESTOR',
  'Предприниматель': 'ENTREPRENEUR',
  'Эксперт': 'EXPERT',
  'Творец': 'CREATOR',
  'Управляющий': 'MANAGER',
};

export const toneOf = (p) => (p?.id === 'team' ? '#C9A96E' : ROLE_TONE[p?.role] || '#A99BC9');
export const roleEn = (p) => ROLE_EN[p?.role] || 'RESIDENT';

/* Один словарь на два вопроса: «что ищу» и «чем полезен». Совпадение
   считается встречно — я ищу то, что он даёт, и наоборот. */
export const EXCHANGE = {
  invest: { name: 'Инвестиции', emoji: '📈' },
  partners: { name: 'Партнёры', emoji: '🤝' },
  clients: { name: 'Клиенты', emoji: '🎯' },
  realty: { name: 'Недвижимость', emoji: '🏡' },
  relocation: { name: 'Переезд и визы', emoji: '🛂' },
  hiring: { name: 'Команда', emoji: '🧑‍💻' },
  marketing: { name: 'Маркетинг', emoji: '📣' },
  ai: { name: 'AI и автоматизация', emoji: '🧠' },
  law: { name: 'Право и налоги', emoji: '⚖️' },
  mentor: { name: 'Наставничество', emoji: '🧭' },
  kids: { name: 'Дети и школы', emoji: '🧸' },
  friends: { name: 'Друзья и досуг', emoji: '🥂' },
};

/* Зачем знакомятся — как в знакомствах клуба. Видит собеседник. */
export const MEET_GOALS = [
  { id: 'partner', label: 'Найти партнёра' },
  { id: 'invest', label: 'Инвестиции' },
  { id: 'deals', label: 'Клиенты и сделки' },
  { id: 'exp', label: 'Обмен опытом' },
  { id: 'friends', label: 'Друзья и досуг' },
  { id: 'sport', label: 'Спорт вместе' },
  { id: 'family', label: 'Семьями с детьми' },
];

export const INTERESTS = [
  'Серфинг', 'Падел', 'Теннис', 'Бег', 'Йога', 'Зал', 'Горы', 'Яхты', 'Мотоциклы', 'Путешествия',
  'Вино', 'Кофе', 'Гастрономия', 'Книги', 'Кино', 'Музыка', 'Фото', 'Искусство', 'Шахматы', 'Гольф',
];

export const TEAM = {
  id: 'team',
  name: 'Команда UHOME',
  role: 'Команда',
  title: 'Менеджеры клуба',
  company: 'UHOME CLUB',
  about: 'Отвечаем за 15 минут с 9 до 22 по вашему времени: события, услуги, знакомства, всё про клуб.',
};

export const PEOPLE = [
  {
    id: 'r1', name: 'Марина Соколова', role: 'Основатель', title: 'Основатель', company: 'Aura Retreats',
    region: 'bali', city: 'Убуд', since: 2023, joined: 400, online: true,
    about: 'Строю сеть ретрит-центров в Азии. Три площадки на Бали, выезды для команд от 8 до 40 человек.',
    gives: ['partners', 'friends', 'mentor'], needs: ['marketing', 'hiring'],
    interests: ['Йога', 'Серфинг', 'Книги', 'Гастрономия'], goals: ['exp', 'friends'], langs: ['RU', 'EN'], contact: '@sokolova',
  },
  {
    id: 'r2', name: 'Алексей Ремизов', role: 'Инвестор', title: 'Управляющий партнёр', company: 'Remizov Capital',
    region: 'dubai', city: 'Дубай Марина', since: 2022, joined: 700, online: false,
    about: 'Инвестирую в основателей с настоящей выручкой. 22 сделки на ранних стадиях, 7 выходов.',
    gives: ['invest', 'mentor'], needs: ['partners', 'clients'],
    interests: ['Яхты', 'Гольф', 'Вино', 'Книги'], goals: ['invest', 'deals'], langs: ['RU', 'EN'], contact: '@remizov',
  },
  {
    id: 'r3', name: 'Ксения Орлова', role: 'Предприниматель', title: 'Основатель', company: 'Amazonki',
    region: 'bali', city: 'Чангу', since: 2023, joined: 380, online: true,
    about: 'Визы и ВНЖ на Бали и в Дубае: B211A, KITAS, продления, золотая виза. Больше 2 000 оформленных виз.',
    gives: ['relocation', 'law'], needs: ['marketing', 'clients'],
    interests: ['Серфинг', 'Путешествия', 'Кофе'], goals: ['deals', 'friends'], langs: ['RU', 'EN', 'ID'], contact: '',
  },
  {
    id: 'r4', name: 'Денис Полозов', role: 'Предприниматель', title: 'Основатель', company: 'Butler Bike',
    region: 'bali', city: 'Чангу', since: 2024, joined: 210, online: true,
    about: 'Байки с доставкой к вилле за час: Vespa, NMAX, PCX. Страховка, шлемы и замена в дороге.',
    gives: ['relocation', 'friends'], needs: ['invest', 'marketing'],
    interests: ['Мотоциклы', 'Серфинг', 'Горы', 'Фото'], goals: ['partner', 'sport'], langs: ['RU', 'EN'], contact: '',
  },
  {
    id: 'r5', name: 'Тимур Асланов', role: 'Инвестор', title: 'Партнёр', company: 'Gulf Bridge',
    region: 'dubai', city: 'DIFC', since: 2022, joined: 650, online: true,
    about: 'Недвижимость и частный капитал в ОАЭ. Помогаю зайти в сделку без лишних посредников.',
    gives: ['invest', 'realty'], needs: ['partners'],
    interests: ['Падел', 'Яхты', 'Гастрономия'], goals: ['invest', 'deals'], langs: ['RU', 'EN', 'AR'], contact: '@aslanov',
  },
  {
    id: 'r6', name: 'Ирина Бекетова', role: 'Эксперт', title: 'Налоговый консультант', company: 'Clear Books',
    region: 'moscow', city: 'Москва', since: 2023, joined: 330, online: false,
    about: 'Налоги и отчётность для тех, кто живёт между странами. Резидентство, счета, дивиденды.',
    gives: ['law', 'mentor'], needs: ['clients', 'ai'],
    interests: ['Бег', 'Книги', 'Театр', 'Вино'], goals: ['exp', 'deals'], langs: ['RU', 'EN'], contact: '@beketova',
  },
  {
    id: 'r7', name: 'Никита Драч', role: 'Основатель', title: 'CEO', company: 'Drach Robotics',
    region: 'moscow', city: 'Москва', since: 2024, joined: 190, online: true,
    about: 'Автоматизируем склады роботами и компьютерным зрением. Ищем выход на рынки Залива.',
    gives: ['ai', 'hiring'], needs: ['invest', 'partners', 'relocation'],
    interests: ['Шахматы', 'Бег', 'Кино'], goals: ['invest', 'partner'], langs: ['RU', 'EN'], contact: '@drach',
  },
  {
    id: 'r8', name: 'Алина Нурлан', role: 'Управляющий', title: 'Управляющая', company: 'Nest Estate',
    region: 'bali', city: 'Семиньяк', since: 2023, joined: 300, online: false,
    about: 'Виллы на сезон и на годы: подбор, проверка договора, управление. Работаю с резидентами без комиссии сверху.',
    gives: ['realty', 'relocation'], needs: ['clients', 'invest'],
    interests: ['Йога', 'Искусство', 'Гастрономия'], goals: ['deals', 'friends'], langs: ['RU', 'EN'], contact: '@nest.estate',
  },
  {
    id: 'r9', name: 'Вера Полянская', role: 'Творец', title: 'Фотограф и режиссёр', company: 'Frame Studio',
    region: 'bali', city: 'Чангу', since: 2024, joined: 150, online: true,
    about: 'Снимаю личный бренд и компании: фото, рилсы, короткие фильмы. Команда на Бали и в Москве.',
    gives: ['marketing', 'friends'], needs: ['clients', 'partners'],
    interests: ['Фото', 'Серфинг', 'Кино', 'Музыка'], goals: ['deals', 'friends'], langs: ['RU', 'EN'], contact: '@frame.studio',
  },
  {
    id: 'r10', name: 'Родион Сантос', role: 'Основатель', title: 'Основатель', company: 'Verde App',
    region: 'miami', city: 'Майами', since: 2024, joined: 120, online: true,
    about: 'Финтех для экспатов в США: счета, переводы, кредитная история с нуля.',
    gives: ['ai', 'relocation'], needs: ['invest', 'marketing', 'hiring'],
    interests: ['Теннис', 'Яхты', 'Путешествия'], goals: ['invest', 'partner'], langs: ['RU', 'EN', 'ES'], contact: '@santos',
  },
  {
    id: 'r11', name: 'Хана Сато', role: 'Эксперт', title: 'Продуктовый консультант', company: 'Sato Studio',
    region: 'europe', city: 'Лиссабон', since: 2024, joined: 160, online: false,
    about: 'Помогаю продуктам выйти на Европу: исследования, позиционирование, запуск.',
    gives: ['marketing', 'mentor'], needs: ['clients', 'friends'],
    interests: ['Искусство', 'Кофе', 'Серфинг'], goals: ['exp', 'friends'], langs: ['EN', 'RU', 'PT'], contact: '@hanasato',
  },
  {
    id: 'r12', name: 'Сергей Липатов', role: 'Предприниматель', title: 'Основатель', company: 'Sever Foods',
    region: 'moscow', city: 'Москва', since: 2022, joined: 720, online: true,
    about: 'Производство и сеть кафе «Каша & Вино». Масштабируем франшизу на Дубай.',
    gives: ['partners', 'mentor'], needs: ['realty', 'relocation', 'law'],
    interests: ['Гастрономия', 'Вино', 'Горы'], goals: ['partner', 'deals'], langs: ['RU'], contact: '@lipatov',
  },
  {
    id: 'r13', name: 'Камила Юсупова', role: 'Эксперт', title: 'Юрист', company: 'Lex Nomad',
    region: 'dubai', city: 'Бизнес-Бей', since: 2023, joined: 280, online: false,
    about: 'Компании в ОАЭ, США и Европе, счета, структуры владения. Говорю на языке основателя.',
    gives: ['law', 'relocation'], needs: ['clients', 'ai'],
    interests: ['Падел', 'Книги', 'Путешествия'], goals: ['deals', 'exp'], langs: ['RU', 'EN'], contact: '@lexnomad',
  },
  {
    id: 'r14', name: 'Давид Мкртчян', role: 'Основатель', title: 'CTO', company: 'Areg Systems',
    region: 'europe', city: 'Берлин', since: 2023, joined: 260, online: true,
    about: 'Строю платёжную инфраструктуру для маркетплейсов. Команда 40 человек в трёх странах.',
    gives: ['ai', 'hiring', 'mentor'], needs: ['invest', 'clients'],
    interests: ['Шахматы', 'Бег', 'Музыка'], goals: ['invest', 'exp'], langs: ['RU', 'EN', 'DE'], contact: '@mkrtchyan',
  },
  {
    id: 'r15', name: 'Ольга Дорн', role: 'Управляющий', title: 'Директор', company: 'Little Sun',
    region: 'bali', city: 'Чангу', since: 2024, joined: 200, online: false,
    about: 'Детский сад и начальная школа на русском и английском. 60 детей, 12 педагогов.',
    gives: ['kids', 'friends'], needs: ['marketing', 'realty'],
    interests: ['Йога', 'Книги', 'Искусство'], goals: ['family', 'friends'], langs: ['RU', 'EN'], contact: '@littlesun',
  },
  {
    id: 'r16', name: 'Максим Гурьев', role: 'Инвестор', title: 'Бизнес-ангел', company: 'Guryev Ventures',
    region: 'miami', city: 'Нью-Йорк', since: 2023, joined: 310, online: false,
    about: 'Вкладываюсь в AI и потребительские сервисы на ранней стадии. Чек $50–250 тысяч.',
    gives: ['invest', 'mentor'], needs: ['partners', 'friends'],
    interests: ['Гольф', 'Теннис', 'Вино'], goals: ['invest', 'friends'], langs: ['RU', 'EN'], contact: '@guryev',
  },
  {
    id: 'r17', name: 'Анна Ветрова', role: 'Творец', title: 'Шеф и основатель', company: 'Sage Kitchen',
    region: 'bali', city: 'Берава', since: 2024, joined: 140, online: true,
    about: 'Ресторан и кейтеринг на Бали: ужины для резидентов, выездные столы на виллах.',
    gives: ['friends', 'clients'], needs: ['marketing', 'partners'],
    interests: ['Гастрономия', 'Вино', 'Серфинг'], goals: ['deals', 'friends'], langs: ['RU', 'EN'], contact: '@sagekitchen',
  },
  {
    id: 'r18', name: 'Рустам Бек', role: 'Предприниматель', title: 'Основатель', company: 'Levant Table',
    region: 'dubai', city: 'Джумейра', since: 2023, joined: 290, online: true,
    about: 'Два ресторана в Дубае и кейтеринг для закрытых ужинов клуба.',
    gives: ['friends', 'partners'], needs: ['invest', 'hiring'],
    interests: ['Гастрономия', 'Падел', 'Путешествия'], goals: ['deals', 'friends'], langs: ['RU', 'EN', 'AR'], contact: '@levanttable',
  },
  {
    id: 'r19', name: 'Лейла Хан', role: 'Управляющий', title: 'Директор по продажам', company: 'Skyline Homes',
    region: 'dubai', city: 'Даунтаун', since: 2024, joined: 175, online: false,
    about: 'Квартиры в Дубае: аренда на год, покупка на этапе стройки, сопровождение сделки.',
    gives: ['realty', 'invest'], needs: ['clients'],
    interests: ['Йога', 'Яхты', 'Искусство'], goals: ['deals', 'exp'], langs: ['RU', 'EN'], contact: '@skylinehomes',
  },
  {
    id: 'r20', name: 'Глеб Осмолов', role: 'Творец', title: 'Музыкальный продюсер', company: 'Osmolov Sound',
    region: 'europe', city: 'Барселона', since: 2024, joined: 90, online: true,
    about: 'Пишу музыку для брендов и игр. Собираю студию резидентов в Барселоне.',
    gives: ['marketing', 'friends'], needs: ['clients', 'partners'],
    interests: ['Музыка', 'Кино', 'Серфинг'], goals: ['friends', 'exp'], langs: ['RU', 'EN', 'ES'], contact: '@osmolov',
  },
  {
    id: 'r21', name: 'Софья Ленц', role: 'Эксперт', title: 'Маркетолог', company: 'Lenz Atelier',
    region: 'moscow', city: 'Москва', since: 2025, joined: 25, online: true,
    about: 'Запускаю бренды премиум-сегмента: стратегия, упаковка, первые продажи.',
    gives: ['marketing', 'mentor'], needs: ['clients', 'relocation'],
    interests: ['Искусство', 'Вино', 'Путешествия'], goals: ['deals', 'friends'], langs: ['RU', 'EN'], contact: '@lenz',
  },
  {
    id: 'r22', name: 'Егор Тамм', role: 'Основатель', title: 'Основатель', company: 'Lattice AI',
    region: 'bali', city: 'Улувату', since: 2025, joined: 12, online: true,
    about: 'AI-ассистенты для отделов продаж. Команда из шести человек, первые $40 тысяч выручки в месяц.',
    gives: ['ai', 'hiring'], needs: ['invest', 'clients', 'realty'],
    interests: ['Серфинг', 'Падел', 'Кофе', 'Путешествия'], goals: ['invest', 'sport'], langs: ['RU', 'EN'], contact: '@tamm',
  },
  {
    id: 'r23', name: 'Полина Грин', role: 'Управляющий', title: 'Партнёр', company: 'Harbor Realty',
    region: 'miami', city: 'Майами', since: 2025, joined: 18, online: false,
    about: 'Жильё в Майами для тех, кто переезжает: аренда, покупка, школы рядом.',
    gives: ['realty', 'kids', 'relocation'], needs: ['clients', 'friends'],
    interests: ['Теннис', 'Йога', 'Яхты'], goals: ['family', 'deals'], langs: ['RU', 'EN'], contact: '@harborrealty',
  },
  {
    id: 'r24', name: 'Артём Волков', role: 'Предприниматель', title: 'Основатель', company: 'Move Easy',
    region: 'dubai', city: 'Дубай', since: 2025, joined: 9, online: true,
    about: 'Переезд вещей и животных между странами: упаковка, таможня, доставка до двери.',
    gives: ['relocation', 'partners'], needs: ['clients', 'marketing'],
    interests: ['Мотоциклы', 'Горы', 'Путешествия'], goals: ['deals', 'sport'], langs: ['RU', 'EN'], contact: '@moveeasy',
  },
  {
    id: 'r25', name: 'Дарья Ким', role: 'Творец', title: 'Дизайнер', company: 'Kim Objects',
    region: 'moscow', city: 'Москва', since: 2025, joined: 5, online: false,
    about: 'Дизайн интерьеров для вилл и квартир: от концепции до мебели на заказ.',
    gives: ['realty', 'marketing'], needs: ['clients', 'friends'],
    interests: ['Искусство', 'Кофе', 'Кино'], goals: ['friends', 'deals'], langs: ['RU', 'EN'], contact: '@kim.objects',
  },
  {
    id: 'r26', name: 'Мария Тонева', role: 'Управляющий', title: 'Директор', company: 'Montessori House',
    region: 'dubai', city: 'Аль-Барша', since: 2024, joined: 230, online: false,
    about: 'Монтессори-сад в Дубае: дети от 2 до 6 лет, английский и русский.',
    gives: ['kids'], needs: ['marketing', 'friends'],
    interests: ['Йога', 'Книги', 'Бег'], goals: ['family', 'friends'], langs: ['RU', 'EN'], contact: '@montessorihouse',
  },
  {
    id: 'r27', name: 'Илья Рябов', role: 'Инвестор', title: 'Основатель фонда', company: 'North Star Fund',
    region: 'europe', city: 'Лимасол', since: 2023, joined: 340, online: true,
    about: 'Фонд на $30 млн: B2B SaaS и финтех в Европе. Сооснователь двух сервисов с выходом.',
    gives: ['invest', 'mentor', 'law'], needs: ['partners'],
    interests: ['Яхты', 'Бег', 'Шахматы'], goals: ['invest', 'exp'], langs: ['RU', 'EN'], contact: '@ryabov',
  },
  {
    id: 'r28', name: 'Кирилл Ю', role: 'Основатель', title: 'Основатель', company: 'Stem Pay',
    region: 'moscow', city: 'Москва', since: 2025, joined: 20, online: true,
    about: 'Платежи для креаторов и школ. Растём на 20% в месяц, ищем выход на Индонезию.',
    gives: ['ai', 'clients'], needs: ['relocation', 'invest', 'law'],
    interests: ['Падел', 'Горы', 'Кофе'], goals: ['partner', 'sport'], langs: ['RU', 'EN'], contact: '@kirillyu',
  },
];

/* Сфера бизнеса — по ней тест собирает мастер-группы из людей с похожими задачами. */
export const SPHERES = [
  { id: 'it', name: 'IT и продукт' },
  { id: 'finance', name: 'Финансы и инвестиции' },
  { id: 'realty', name: 'Недвижимость' },
  { id: 'trade', name: 'Торговля и e-commerce' },
  { id: 'services', name: 'Услуги и консалтинг' },
  { id: 'media', name: 'Медиа и бренд' },
  { id: 'life', name: 'Гостеприимство и lifestyle' },
  { id: 'prod', name: 'Производство' },
];

const SPHERE_OF = {
  r1: 'life', r2: 'finance', r3: 'services', r4: 'life', r5: 'finance', r6: 'services', r7: 'it', r8: 'realty',
  r9: 'media', r10: 'it', r11: 'it', r12: 'prod', r13: 'services', r14: 'it', r15: 'life', r16: 'finance',
  r17: 'life', r18: 'life', r19: 'realty', r20: 'media', r21: 'media', r22: 'it', r23: 'realty', r24: 'services',
  r25: 'media', r26: 'life', r27: 'finance', r28: 'it',
};
for (const p of PEOPLE) p.sphere = SPHERE_OF[p.id];

/* Ближайшие поездки резидентов: куда летят и через сколько дней.
   Прилёт в ваш регион — один из лучших поводов пересечься вживую. */
export const TRIPS = [
  { who: 'r2', to: 'bali', inDays: 5, days: 10 },
  { who: 'r13', to: 'bali', inDays: 4, days: 7 },
  { who: 'r14', to: 'bali', inDays: 9, days: 14 },
  { who: 'r5', to: 'moscow', inDays: 6, days: 5 },
  { who: 'r21', to: 'dubai', inDays: 7, days: 6 },
  { who: 'r16', to: 'dubai', inDays: 11, days: 4 },
  { who: 'r27', to: 'moscow', inDays: 3, days: 5 },
  { who: 'r10', to: 'europe', inDays: 12, days: 8 },
  { who: 'r7', to: 'dubai', inDays: 8, days: 10 },
  { who: 'r22', to: 'dubai', inDays: 14, days: 5 },
  { who: 'r11', to: 'bali', inDays: 16, days: 21 },
];

export const byId = (id) => (id === 'team' ? TEAM : PEOPLE.find((p) => p.id === id));
export const firstNameOf = (p) => (p?.name || '').split(' ')[0];

/* Кого добавить в ближний круг по умолчанию. */
export const DEFAULT_CIRCLE = ['r4', 'r9', 'r3', 'r2', 'r8', 'r22', 'r12', 'r17'];
