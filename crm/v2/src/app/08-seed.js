/* Пример данных: вымышленные люди на разных шагах. Все записи с demo: true —
   удаляются одной кнопкой в настройках. Генератор детерминированный. */

const Demo = {
  build(T = Date.now()) {
    const R = rng(20261001);
    const DAY = 864e5;
    const ago = (d, h = 12) => { const x = new Date(T - d * DAY); x.setHours(h, R.int(0, 59), 0, 0); return Math.min(x.getTime(), T - 60e3); };
    const inDays = (d, h = 12) => { const x = new Date(T + d * DAY); x.setHours(h, 0, 0, 0); return x.getTime(); };
    const out = {team: {}, people: {}, cfg: {}};
    /* прошедшие созвоны — в разные дни и часы последних двух недель, без наложений */
    const HOURS = [10, 11, 12, 13, 15, 16, 17, 18, 19];
    let si = 0;
    const pastCall = () => { const n = si++; const x = new Date(T - (1 + (n * 4) % 13) * DAY); x.setHours(HOURS[(n * 7) % HOURS.length], n % 2 ? 30 : 0, 0, 0); return Math.min(x.getTime(), T - 2 * 3600e3); };
    out.team.dm_anna = {demo: true, name: 'Анна Смирнова', role: 'member', joinedAt: ago(60), order: 1, color: '#5A50C0'};
    out.team.dm_vera = {demo: true, name: 'Вера Орлова', role: 'member', joinedAt: ago(60), order: 2, color: '#8F6B27'};
    const team = ['dm_anna', 'dm_vera'];
    const codes = new Set();
    const codeOf = name => { let c = refCodeFor(name); while (codes.has(c)) c = c.replace(/\d+$/, n => String(Number(n) + 7)); codes.add(c); return c; };
    const Q = type => Object.fromEntries(Q_DEFAULT[type].test.map(q => [q.id, q]));
    /* ответ по весам вариантов */
    const one = (q, w) => (w ? R.weighted(q.o.map((o, i) => [o, w[i] ?? 1])) : R.pick(q.o));
    const many = (q, w, n) => { const pool = q.o.map((o, i) => [o, w ? w[i] ?? 1 : 1]); const res = new Set(); let guard = 0; while (res.size < n && guard++ < 30) res.add(R.weighted(pool)); return [...res]; };
    let k = 0;
    const person = (type, name, f) => {
      const id = `d${type[0]}${String(++k).padStart(2, '0')}`;
      const created = f.created ?? R.int(5, 30);
      const log = {l1: {t: ago(created), by: f.owner || null, emo: '✨', text: f.ref ? `Пришла по ссылке ${f.ref}` : 'Добавлен в CRM'}};
      if (f.s1 && f.s1 !== 'new') log.l2 = {t: ago(created - 1), by: f.owner || null, emo: '🔗', text: 'Отправили ссылку на анкету'};
      if (f.s1 === 'done') log.l3 = {t: f.answeredAt || ago(created - 2), emo: '📝', text: f.answeredBy === 'team' ? 'Анкету заполнила команда' : 'Заполнила анкету по ссылке'};
      if (f.s2 === 'set' || f.s2 === 'done') log.l4 = {t: ago(Math.max(1, created - 3)), by: f.owner || null, emo: '📅', text: 'Созвон назначен'};
      if (f.s2 === 'done') log.l5 = {t: f.callAt || ago(2), by: f.owner || null, emo: '✅', text: type === 'client' ? 'Интервью прошёл' : 'Созвон прошёл'};
      if (f.s3 && f.s3 !== 'none') log.l6 = {t: ago(1), by: f.owner || null, emo: '🚀', text: 'Итог записан'};
      out.people[id] = {demo: true, type, name, code: codeOf(name), s1: 'new', s2: 'none', s3: 'none', answers: {}, talk: {}, res: {tags: []}, createdAt: ago(created), touchedAt: ago(Math.max(0, created - 4)), log, ...f};
      const doc = out.people[id];
      /* ссылку отправили за 1–3 дня до ответов — чтобы было видно, сколько человек думает */
      if (doc.s1 === 'done' && doc.answeredBy === 'self' && doc.answeredAt && !doc.sentAt) doc.sentAt = doc.answeredAt - (1 + (k % 3)) * DAY + 3 * 3600e3;
      if (doc.callAt) doc.callMin = type === 'partner' ? 45 : 30;
      if (doc.s2 === 'done' && doc.callAt) doc.callDur = Math.round(doc.callMin * 60 * (0.75 + R.next() * 0.55));
      return id;
    };

    /* ── клиентки: кастдев ── */
    const qc = Q('client');
    const TALK_C = {
      t_job: ['Работаю в IT удалённо, продакт. Двое детей, муж много в командировках.', 'Бухгалтер в офисе до семи, выходные уходят на быт и родителей.', 'Сейчас в декрете, дочке год и два. До этого — маркетинг.'],
      t_weather: ['Переменная облачность: вроде всё хорошо, но всё время на бегу.', 'Туман — не понимаю, куда иду и чего хочу.', 'Солнечно, но ветрено — много перемен сразу.'],
      t_pain: ['Тревога из-за работы и ощущение, что ничего не успеваю. Вчера опять не могла уснуть до двух.', 'Усталость. Просыпаюсь уже уставшей, кофе не помогает.', 'Ругаю себя за всё: что мало с ребёнком, что поправилась, что не работаю.'],
      t_goal: ['Хочу перестать жить на автопилоте и найти 20 минут в день только для себя.', 'Вернуть энергию и нормальный сон.', 'Разобраться, чем хочу заниматься после декрета.'],
      t_morning: ['Первые 15 минут — телефон в кровати. Ритуалов нет, но люблю кофе в тишине, пока все спят.', 'Сразу дети, завтраки, сборы. Кайфушка — душ с любимым гелем.', 'Стакан воды и 5 минут растяжки, если получится.'],
      t_mood: ['Прогулка одной и музыка в наушниках.', 'Красивая еда и порядок дома.', 'Разговор с подругой и что-то новое — книга, место.'],
      t_selftime: ['Нет, день сразу начинается с суеты.', 'Только если встану до всех — раз в неделю получается.', 'Утром — да, 10 минут на кофе и мысли.'],
      t_day: ['После обеда созвоны до шести, потом сад, ужин, уроки. В десять я никакая.', 'Работаю до семи, дорога час, вечером готовлю на завтра.', 'Сон дочки днём — моё окно на 40 минут, обычно трачу на дела.'],
      t_pauses: ['Пауз почти нет, а если есть — листаю Reels и злюсь на себя.', 'Чай у окна 5 минут — это святое.', 'Гуляю с коляской — это и есть пауза, слушаю подкасты.'],
      t_audio: ['В машине и на прогулке с собакой.', 'Пока готовлю — музыка, подкасты в дороге.', 'Почти не слушаю, нет тишины для этого.'],
      t_fallasleep: ['Тяжело: мысли крутятся, засыпаю после часа.', 'Падаю и сразу сплю, но просыпаюсь ночью.', 'Нормально, если не сижу в телефоне до последнего.'],
      t_evening: ['Идеальный — ванна, книга и в 23 спать. Реальный — посуда и сериал до часу.', 'Хочу йогу вечером, а получается доделывать работу.', 'Идеальный — ужин с мужем без телефонов. Реальный — каждый в своём экране.'],
      t_switch: ['Душ и смена одежды — как ритуал «работа закончилась».', 'Прогулка 20 минут после работы.', 'Ничего не помогает, всё перетекает одно в другое.'],
      t_happy: ['Утро субботы, когда никуда не надо.', 'Когда занимаюсь спортом — потом весь день другой.', 'Встречи с подругами раз в месяц.'],
      t_drain: ['Работа без границ: пишут в любое время. Вчера в 23:00 опять.', 'Ночные просыпания ребёнка — неделю не высыпаюсь.', 'Бытовые мелочи, которые никто кроме меня не видит.'],
      t_last: ['Месяц назад ходила на пилатес, потом отпуск — и выпала.', 'Неделю назад включила йогу на YouTube — на десятой минуте проснулся сын.', 'Вчера сделала дыхательную практику в машине перед встречей. Помогло!'],
      t_apps: ['Плачу 3 500 за фитнес и за приложение медитаций, которое не открываю.', 'Последний раз купила курс за 7 900 — прошла половину.', 'Ни за что не плачу, всё бесплатное на YouTube.'],
      t_best: ['Работа — там всё понятно.', 'Семья и отношения.', 'Дружба: у меня классные подруги.'],
      t_grateful: ['За гибкий график и то, что дети рядом.', 'Что есть стабильная работа и своё жильё.', 'За то, что могу быть с дочкой, пока она маленькая.'],
      t_lack: ['Тишины и времени на себя.', 'Дисциплины — всё начинаю и бросаю.', 'Общения со взрослыми, я одна с ребёнком весь день.'],
      t_hour: ['Поспала бы, честно.', 'Спорт или массаж.', 'Почитала бы и помедитировала.'],
      t_how: ['Слушаю в дороге и за готовкой, с блокнотом не сажусь никогда.', 'Смотрю фоном в зале.', 'Выделяю вечер раз в неделю и смотрю с блокнотом.'],
      t_favapp: ['Яндекс Музыка — сама знает, что мне включить.', 'Duolingo: маленькие шаги и стрик, приятно не терять.', 'Pinterest — красиво и спокойно.'],
      t_annoy: ['Когда сразу просят оплату и куча экранов до сути.', 'Пуши каждый день и «ты пропустила».', 'Сложно найти, где мои мастер-классы — много разделов.'],
      t_push: ['Бесят «вернись к нам», помогают напоминания о том, что я сама поставила.', 'Утром в 7, до работы. Не пишите в выходные.', 'Одно напоминание в день, не больше.'],
      t_overload: ['Да, от количества каналов — подписана на 200 и ничего не читаю.', 'Когда всё срочно и одновременно.', 'Редко, я жёстко чищу подписки.'],
      t_saved: ['Сохраняю всё и никогда не возвращаюсь.', 'Возвращаюсь, если есть напоминание.', 'Не сохраняю — либо сразу, либо никогда.'],
      t_apply: ['Задание на день и галочка, что сделала.', 'Шпаргалка на одну картинку, которую можно сохранить.', 'Когда кто-то спрашивает, как у меня получилось.'],
      t_idealvideo: ['10 минут, светлая комната, спикер говорит спокойно и по делу, в конце — одно задание.', 'Как разговор с подругой, без пафоса, 15 минут максимум.', 'Короткие главы по 5 минут, можно слушать без картинки.'],
      t_worth: ['Курс по психологии отношений за 12 000 — пересматриваю до сих пор.', 'Абонемент в студию растяжки: там тренер, который меня помнит.', 'Подписка на книги — слушаю каждый день.'],
      t_trust: ['Смотрю на образование и живые отзывы, а не на количество подписчиков.', 'Если человек живёт так, как говорит.', 'Доверяю тем, кого советует подруга.'],
      t_three: ['Сон, тревога и тело.', 'Отношения, деньги, энергия.', 'Практики на 5 минут, психология, сообщество.'],
      t_follow: ['Слушаю Лабковского и подкаст «Норм» — за честность.', 'Подписана на нутрициолога и пару мам-блогеров — за реальную жизнь без глянца.', 'Слушаю Ирину Хакамаду — за спокойствие и опыт.'],
      t_visual: ['Красивый кадр цепляет, но остаюсь из-за смысла.', 'Динамичный разбор — люблю, когда по делу.', 'Красивый кадр, это важно, я визуал.'],
      t_change: ['Бросила сладкое, когда нашла замену и подругу, с которой вместе.', 'Начала бегать после разговора с врачом — испугалась.', 'Перестала ругать себя после терапии: помогло, что меня не оценивали.'],
      t_result: ['Когда стало легко на душе и я это замечаю.', 'Когда видны результаты: спокойнее сплю, меньше срываюсь.', 'Когда окружающие говорят, что я изменилась.'],
      t_friend: ['Если реально поможет со сном — посоветую сестре и подругам из мамского чата.', 'Когда увижу результат через месяц. Коллегам на работе точно.', 'Если будет пробный период — сразу скину подругам.'],
    };
    const WEATHER = ['Переменная облачность', 'Туман', 'Ветер, всё меняется', 'Солнечно', 'Пасмурно', 'Дождь'];
    const clients = [
      ['Ольга Миронова', {s1: 'done', s2: 'done', s3: 'done', talk: 'full', tags: ['⏳ Нет времени', '🧘‍♀️ Любит короткие практики', '🔔 Бесят пуши'], main: 'Бросает, когда пропускает пару дней и «сгорают» звёзды — нужен режим паузы без чувства вины.', idea: 'Режим «5 минут», пуши вечером, пауза для звёзд.'}],
      ['Екатерина Белова', {s1: 'done', s2: 'done', s3: 'done', talk: 'full', tags: ['🌙 Проблемы со сном', '🤖 Нравится Ева-помощница', '💡 Идея фичи'], main: 'Главное — сон: хочет вечерний ритуал из трёх шагов и голосовую Еву.', idea: 'Голосовой режим Евы, вечерняя программа для сна.'}],
      ['Мария Кузнецова', {s1: 'done', s2: 'done', s3: 'fan', talk: 'full', tags: ['👭 Хочет сообщество', '❤️ Готова рекомендовать', '💸 Дорого'], main: 'Не хватает «своих людей»: готова платить за подписку, если будет живое сообщество мам.', idea: 'Группа мам с ведущей, тариф на год дешевле.'}],
      ['Дарья Соколова', {s1: 'done', s2: 'done', s3: 'none', talk: 'part'}],
      ['Алина Козлова', {s1: 'done', s2: 'done', s3: 'none', talk: 'part'}],
      ['Юлия Морозова', {s1: 'done', s2: 'set', callAt: inDays(0, 19)}],
      ['Наталья Волкова', {s1: 'done', s2: 'set', callAt: inDays(1, 12)}],
      ['Ирина Павлова', {s1: 'done', s2: 'none', answeredAt: ago(4)}],
      ['Светлана Орлова', {s1: 'done', s2: 'none', answeredAt: ago(3)}],
      ['Полина Лебедева', {s1: 'done', s2: 'none', answeredAt: ago(0.4), answeredBy: 'team'}],
      ['Ксения Новикова', {s1: 'done', s2: 'noshow', callAt: pastCall()}],
      ['Вероника Семёнова', {s1: 'sent', sentAt: ago(1)}],
      ['Анастасия Фёдорова', {s1: 'sent', sentAt: ago(2)}],
      ['Елена Григорьева', {s1: 'new'}],
    ];
    const clientIds = [];
    clients.forEach(([name, f], i) => {
      const answered = f.s1 === 'done';
      const a = {};
      if (answered) {
        a.name = name.split(' ')[0];
        if (i % 3 === 0) a.evaId = 'EVA-' + (40210 + i * 37);
        const age = R.weighted([[23, 1], [27, 2], [31, 4], [34, 3], [38, 3], [42, 1], [47, 1]]) + R.int(0, 2);
        const born = new Date(T); born.setFullYear(born.getFullYear() - age); born.setMonth(R.int(0, 11), R.int(1, 28));
        a.birth = `${born.getFullYear()}-${String(born.getMonth() + 1).padStart(2, '0')}-${String(born.getDate()).padStart(2, '0')}`;
        a.city = R.weighted([['Москва', 5], ['Санкт-Петербург', 3], ['Казань', 2], ['Екатеринбург', 1], ['Краснодар', 1], ['Алматы', 1]]);
        a.country = a.city === 'Алматы' ? 'Казахстан' : i === 7 ? 'Другая страна: Сербия' : 'Россия';
        a.status = one(qc.status, [5, 3, 1, 1, 1, 0]);
        a.job = one(qc.job, [3, 1, 4, 2, 2, 3, 1, 0]);
        a.rhythm = one(qc.rhythm, [2, 3, 3, 1, 2]);
        a.stage = one(qc.stage, [1, 4, 2, 4, 2, 2, 1]);
        a.energy = R.weighted([[3, 2], [4, 3], [5, 3], [6, 2], [7, 2], [8, 1]]);
        a.happy = R.weighted([[4, 1], [5, 2], [6, 3], [7, 3], [8, 2], [9, 1]]);
        a.health = R.weighted([[5, 2], [6, 3], [7, 3], [8, 2], [9, 1]]);
        a.pain = many(qc.pain, [3, 5, 2, 3, 6, 1], 2);
        if (i === 4) a.pain = [a.pain[0], 'Другое: мигрени и гормоны'];
        a.goal = i === 9 ? 'Другое: найти своё дело' : one(qc.goal, [5, 4, 2, 2, 3]);
        a.time = one(qc.time, [6, 3, 1]);
        a.when = one(qc.when, [3, 1, 5]);
        a.tried = many(qc.tried, [4, 4, 2, 3, 3, 1], R.int(1, 3));
        a.spend = one(qc.spend, [2, 4, 3, 2, 1]);
        a.transform = one(qc.transform, [3, 2, 3, 2]);
        a.wake = one(qc.wake, [1, 4, 4, 2, 1, 2]);
        a.sleep = one(qc.sleep, [1, 2, 4, 3, 2, 1]);
        a.food = many(qc.food, [5, 3, 2, 3, 1], R.int(1, 2));
        a.diet = one(qc.diet, [8, 2, 0, 1, 0, 2]);
        a.screen = one(qc.screen, [1, 4, 4, 2, 1]);
        a.devices = many(qc.devices, [3, 0, 1, 2, 1, 5], 1);
        a.where = many(qc.where, [6, 4, 4, 2, 3, 1, 1, 1], R.int(2, 3));
        a.length = one(qc.length, [3, 5, 3, 1, 0]);
        a.speed = one(qc.speed, [3, 3, 1, 2]);
        a.form = many(qc.form, [3, 3, 4, 5, 1], 2);
        a.ask = one(qc.ask, [3, 3, 2]);
        a.formats = many(qc.formats, [6, 4, 2, 3, 3, 1, 3, 2], 3);
        a.price = one(qc.price, [2, 5, 3, 1]);
        a.source = i === 6 ? 'Другое: увидела стойку в фитнес-клубе' : one(qc.source, [3, 2, 3, 3, 1, 1, 1]);
        a.call = one(qc.call, [2, 4, 2, 1, 0]);
        a.tg = '@' + refCodeFor(name).toLowerCase().replace(/\d+$/, '');
      }
      const talk = {};
      if (f.talk) {
        const keys = Object.keys(TALK_C);
        keys.forEach((qid, j) => { if (f.talk === 'part' && j > 20) return; talk[qid] = {a: TALK_C[qid][(i + j) % TALK_C[qid].length], t: ago(2), asked: true}; });
        talk.t_weather.pick = WEATHER[i % WEATHER.length];
        if (i === 0) { talk.t_last.star = true; talk.t_annoy.star = true; }
        if (i === 1) talk.t_push.star = true;
        if (i === 2) { talk.t_lack.star = true; talk.t_friend.star = true; }
        if (i === 3) talk.t_pain.star = true;
      }
      const {talk: _t, tags, main, idea, ...rest} = f;
      clientIds.push(person('client', name, {...rest, answers: a, answeredAt: f.answeredAt || (answered ? ago(6 - (i % 5)) : undefined), answeredBy: f.answeredBy || (answered ? 'self' : undefined), talk, talkAt: f.talk ? ago(2) : undefined,
        callAt: f.callAt || (f.s2 === 'done' ? pastCall() : undefined), res: {tags: tags || [], main: main || '', idea: idea || ''}, city: a.city || '', tg: a.tg || '', evaId: a.evaId || '', owner: team[i % 2], created: 12 - (i % 8)}));
    });

    /* ── эксперты ── */
    const qe = Q('expert');
    const experts = [
      ['Марина Ясная', ['🧠 Психология'], 'Самокритика и внутренний критик', 'Москва', {s1: 'done', s2: 'done', s3: 'yes', course: 0, tags: ['🎓 Мастер-класс', '📚 Курс', '📣 Расскажет аудитории'], next: 'Съёмка мастер-класса «Как перестать себя ругать»', note: 'Доля 70/30 ок. Хочет курс из 6 уроков к декабрю.'}],
      ['Ксения Роот', ['🧘‍♀️ Йога', '🤸‍♀️ Растяжка'], 'Йога для спины и шеи', 'Москва', {s1: 'done', s2: 'done', s3: 'yes', course: 2, tags: ['🧘‍♀️ Практики', '📦 Готовый курс'], next: 'Разместить готовый курс «Здоровая спина»', note: 'Есть курс на 8 уроков, снят качественно.'}],
      ['Тая Мирная', ['🌺 Женские практики', '💄 Красота и здоровье'], 'Цикл и женское здоровье', 'Санкт-Петербург', {s1: 'done', s2: 'done', s3: 'think', course: 1, tags: ['🎓 Мастер-класс'], next: 'Прислать договор', note: 'Думает над эксклюзивом.'}],
      ['Алина Ветрова', ['🌬 Медитация и дыхание'], 'Дыхание при тревоге', 'Онлайн', {s1: 'done', s2: 'set', callAt: inDays(1, 15), course: 0}],
      ['Инна Ковыль', ['💰 Финансы', '🧭 Предназначение'], 'Деньги и своё дело для женщин', 'Москва', {s1: 'done', s2: 'none', course: 0}],
      ['Ольга Светлова', ['💌 Аффирмации'], 'Аффирмации и утренние ритуалы', 'Казань', {s1: 'done', s2: 'none', course: 3}],
      ['Дарья Лебедь', ['🏋️‍♀️ Фитнес'], 'Домашний фитнес для мам', 'Москва', {s1: 'done', s2: 'done', s3: 'none', course: 1}],
      ['Вероника Сад', ['💗 Отношения'], 'Отношения и границы', 'Санкт-Петербург', {s1: 'sent', sentAt: ago(1)}],
      ['Елена Грач', ['👶 Для мам'], 'Материнство без вины', 'Екатеринбург', {s1: 'sent', sentAt: ago(3)}],
      ['Нина Лаптева', ['🧘‍♀️ Йога'], 'Йога-нидра и сон', 'Онлайн', {s1: 'new'}],
      ['София Тарн', ['🤸‍♀️ Растяжка'], 'Растяжка и гибкость', 'Москва', {s1: 'done', s2: 'done', s3: 'no', course: 3, note: 'Только офлайн, онлайн не снимает. Позвать на Eva Events.'}],
    ];
    const TALK_E = {t1: 'С тревогой и ощущением «я плохая мама». Через месяц практик — спокойнее реагируют и лучше спят.', t3: 'Есть курс из 6 уроков и 10 практик. Лучше всего покупают короткие практики по 10 минут.', t4: 'Давно хочу снять курс про утренние ритуалы — нет оператора и времени на монтаж.', t6: 'Короткие форматы люблю: люди реально их делают.', t9: 'Могу два съёмочных дня в месяц и эфир раз в две недели.', t10: 'Важно, чтобы меня указывали как автора и была прозрачная отчётность по продажам.', t11: 'Да, расскажу в канале и в сторис — у меня 12 тысяч подписчиц.'};
    experts.forEach(([name, dirs, topic, city, f], i) => {
      const a = {};
      if (f.s1 === 'done') {
        Object.assign(a, {name, city, dirs, topic, exp: one(qe.exp, [0, 1, 3, 4, 2]), edu: one(qe.edu, [4, 3, 1]),
          have: many(qe.have, [3, 2, 4, 4, 4, 2, 1], R.int(2, 4)), course: qe.course.o[f.course ?? 1],
          record: many(qe.record, [3, 5, 4, 2, 2, 1], R.int(2, 4)), where: one(qe.where, [4, 2, 2, 1]), days: one(qe.days, [3, 4, 2]),
          aud: one(qe.aud, [1, 2, 4, 3, 1]), aud_where: many(qe.aud_where, [5, 3, 2, 2, 1, 2], 2), deal: many(qe.deal, [5, 2, 3, 3, 2], 2),
          check: one(qe.check, [1, 4, 3, 1, 1]), social: 't.me/' + refCodeFor(name).toLowerCase().replace(/\d+$/, ''), tg: '@' + refCodeFor(name).toLowerCase().replace(/\d+$/, '')});
      }
      const talk = f.s2 === 'done' ? Object.fromEntries(Object.entries(TALK_E).map(([q, t]) => [q, {a: t, t: ago(3)}])) : {};
      if (i === 0) talk.t4.star = true;
      person('expert', name, {s1: f.s1, s2: f.s2 || 'none', s3: f.s3 || 'none', sentAt: f.sentAt, callAt: f.callAt || (f.s2 === 'done' ? pastCall() : undefined), dirs, topic, city, answers: a,
        answeredAt: f.s1 === 'done' ? ago(5) : undefined, answeredBy: f.s1 === 'done' ? (i % 3 ? 'self' : 'team') : undefined, talk, talkAt: f.s2 === 'done' ? ago(3) : undefined,
        res: {tags: f.tags || [], next: f.next || '', note: f.note || '', date: f.next ? isoTs(inDays(10 + i)) : ''}, tg: a.tg || '', owner: 'dm_vera', created: 20 - i});
    });

    /* ── партнёры ── */
    const qp = Q('partner');
    const partners = [
      ['Салон «Лаванда»', '💅 Салон красоты', 'Москва', 'Ирина Громова, управляющая', {s1: 'done', s2: 'done', s3: 'yes', tags: ['🎁 Спецпредложение', '🔁 Взаимный промо'], next: 'Стойка с QR на ресепшене', note: '−15% на уход участницам Евы по промокоду EVA15.'}],
      ['Студия «Центр тела»', '🤸‍♀️ Студия пилатеса', 'Санкт-Петербург', 'Мария Ларионова, основательница', {s1: 'done', s2: 'done', s3: 'yes', tags: ['🔁 Взаимный промо', '🎬 Площадка'], next: 'Съёмка практик в зале', note: 'Пробное занятие бесплатно участницам.'}],
      ['Йога-студия «Тихая»', '🧘‍♀️ Йога-студия', 'Москва', 'Светлана Юн, администратор', {s1: 'done', s2: 'set', callAt: inDays(2, 11)}],
      ['Кафе «Зелень»', '🥗 Здоровое питание', 'Москва', 'Денис Котов, владелец', {s1: 'done', s2: 'none'}],
      ['Косметология «Дерма»', '✨ Косметология', 'Екатеринбург', 'Юлия Шарова, главный врач', {s1: 'done', s2: 'done', s3: 'think', tags: ['💰 Комиссия'], note: 'Хотят комиссию 15%, мы предлагаем 10%.'}],
      ['Бренд «Арома Лаб»', '🛍 Бренд для маркета', 'Онлайн', 'Кира Мельник, сооснователь', {s1: 'sent', sentAt: ago(2)}],
      ['Пространство «Свет»', '🏠 Пространство для встреч', 'Санкт-Петербург', 'Олег Руденко, арт-директор', {s1: 'new'}],
      ['Фитнес-клуб «Форма»', '🏋️‍♀️ Фитнес-клуб', 'Казань', 'Алсу Галиева, менеджер', {s1: 'done', s2: 'none'}],
    ];
    partners.forEach(([name, cat, city, contact, f], i) => {
      const a = {};
      if (f.s1 === 'done') Object.assign(a, {name, cat, city, addr: 'центр города', contact, clients: one(qp.clients, [1, 4, 3, 1]), ages: many(qp.ages, [1, 5, 4, 2], 2),
        want: many(qp.want, [5, 4, 2, 1, 3, 1, 2, 1], 2), give: many(qp.give, [4, 3, 2, 2, 1], 2), tell: many(qp.tell, [4, 3, 3, 2, 1], 2), aud: one(qp.aud, [1, 2, 4, 2]), when: one(qp.when, [2, 3, 2, 1]), tg: '@' + refCodeFor(name).toLowerCase().replace(/\d+$/, '')});
      person('partner', name, {s1: f.s1, s2: f.s2 || 'none', s3: f.s3 || 'none', sentAt: f.sentAt, callAt: f.callAt || (f.s2 === 'done' ? pastCall() : undefined), cat, city, contact, answers: a,
        answeredAt: f.s1 === 'done' ? ago(6) : undefined, answeredBy: f.s1 === 'done' ? 'self' : undefined, res: {tags: f.tags || [], next: f.next || '', note: f.note || '', date: f.next ? isoTs(inDays(7 + i)) : ''}, tg: a.tg || '', owner: 'dm_vera', created: 25 - i});
    });

    /* ── амбассадоры ── */
    const qa = Q('amb');
    const ambs = [
      ['Юлия Ким', {s1: 'done', s2: 'done', s3: 'yes', size: 3, tags: ['🔗 Ссылка выдана', '📦 Материалы отправлены', '💜 Подписка в подарок']}],
      ['Дарина Соколова', {s1: 'done', s2: 'done', s3: 'yes', size: 2, tags: ['🔗 Ссылка выдана', '🧾 Оформляет самозанятость']}],
      ['Алёна Крылова', {s1: 'done', s2: 'set', callAt: inDays(0, 16), size: 1}],
      ['Лилия Баранова', {s1: 'done', s2: 'none', size: 0}],
      ['Регина Сафина', {s1: 'sent', sentAt: ago(1)}],
      ['Милана Остапова', {s1: 'new'}],
    ];
    const ambCodes = [];
    ambs.forEach(([name, f], i) => {
      const a = {};
      if (f.s1 === 'done') Object.assign(a, {name, city: R.pick(['Москва', 'Казань', 'Сочи', 'Новосибирск']), use: one(qa.use, [3, 3, 2]), where: many(qa.where, [5, 3, 1, 2, 1, 1, 3, 1, 2], 3),
        size: qa.size.o[f.size ?? 1], topic: many(qa.topic, [4, 2, 2, 3, 1, 3, 1, 1], 2), women: one(qa.women, [6, 1, 0]), how: many(qa.how, [5, 4, 3, 2, 1, 2], 3),
        hours: one(qa.hours, [2, 3, 1]), motive: many(qa.motive, [3, 4, 2, 2, 1], 2), tax: i === 1 ? 'Самозанятая' : one(qa.tax, [2, 1, 3]), pay: one(qa.pay, [3, 2]), before: one(qa.before, [1, 2]), tg: '@' + refCodeFor(name).toLowerCase().replace(/\d+$/, '')});
      const id = person('amb', name, {s1: f.s1, s2: f.s2 || 'none', s3: f.s3 || 'none', sentAt: f.sentAt, callAt: f.callAt || (f.s2 === 'done' ? pastCall() : undefined), city: a.city || '', answers: a,
        answeredAt: f.s1 === 'done' ? ago(7) : undefined, answeredBy: f.s1 === 'done' ? 'self' : undefined, res: {tags: f.tags || [], next: f.s3 === 'yes' ? 'Первый пост в канале' : '', note: ''}, tg: a.tg || '', owner: 'dm_anna', created: 18 - i});
      ambCodes.push(out.people[id].code);
    });
    /* по ссылке Юлии пришли две подруги, по ссылке Дарины — одна */
    [[clientIds[11], ambCodes[0]], [clientIds[12], ambCodes[0]], [clientIds[9], ambCodes[1]]].forEach(([cid, code]) => { if (out.people[cid]) out.people[cid].ref = code; });

    out.cfg.meta2 = {demo: true, seededAt: T};
    return out;
  },
  async load() {
    const d = this.build();
    let n = 0;
    for (const [c, docs] of Object.entries(d)) for (const [id, doc] of Object.entries(docs)) { Store.put(c, id, doc); if (++n % 20 === 0) await new Promise(r => setTimeout(r, 30)); }
    await Store.flush();
    return n;
  },
  async clear() {
    let n = 0;
    for (const c of Store.COLS) for (const doc of Store.all(c)) if (doc.demo) { Store.remove(c, doc.id); n++; }
    await Store.flush();
    return n;
  },
  present() { return Store.COLS.some(c => Store.all(c).some(d => d.demo)); },
};
