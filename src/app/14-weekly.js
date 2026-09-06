/* =====================================================================
   ИТОГИ НЕДЕЛИ И ВОВЛЕЧЁННОСТЬ
   Раз в неделю программа пересобирается, и звёзды обнуляются. Раньше это
   происходило молча — женщина возвращалась в понедельник и видела чужую
   неделю без объяснений. Теперь Ева подводит итог: что получилось, над
   чем она работала, и что дальше.

   Тон зависит от того, как прошла неделя, и это главное правило: хвалим
   за настоящее, а не за факт захода. Пустую неделю не празднуем — но и
   не стыдим: вина не возвращает людей, она их прогоняет.
   ===================================================================== */

const EVA_NAME = 'Ева';

/* Три уровня вовлечённости. Границы взяты от 21 дела в неделе:
   две трети — сильная неделя, четверть — начатая, ниже — тихая. */
const WEEK_LEVELS = [
  {k:'strong', from:14, n:'сильная неделя'},
  {k:'middle', from:5,  n:'рабочая неделя'},
  {k:'quiet',  from:0,  n:'тихая неделя'}
];
const weekLevel = done => (WEEK_LEVELS.find(l => done >= l.from) || WEEK_LEVELS[2]).k;

/* Снимок недели делаем ДО пересборки программы: после неё считать уже
   нечего — задания заменились на новые. */
function weekSnapshot(){
  const days = (S.program || []);
  const tasks = days.flatMap(d => d.tasks || []);
  const done = tasks.filter(t => t.done);
  const byType = {affirm:0, practice:0, class:0};
  done.forEach(t => { if(byType[t.type] !== undefined) byType[t.type]++; });
  /* над чем работала: направления сделанных материалов, по убыванию */
  const topics = {};
  done.forEach(t => (t.topics || []).forEach(k => { topics[k] = (topics[k] || 0) + 1; }));
  const top = Object.keys(topics).sort((a,b) => topics[b] - topics[a]).slice(0, 3);
  return {
    at: Date.now(),
    done: done.length,
    total: tasks.length,
    days: days.filter(d => (d.tasks || []).some(t => t.done)).length,
    full: days.filter(d => (d.tasks || []).length && (d.tasks || []).every(t => t.done)).length,
    byType, topics: top,
    points: S.points || 0,
    level: weekLevel(done.length)
  };
}

/* ---------- тексты ---------- */
/* По одному набору на уровень. Внутри уровня берём по номеру недели,
   чтобы одно и то же не повторялось месяц подряд. */
const WEEK_TEXT = {
  strong: [
    n => `${n}, это была сильная неделя. Ты не просто заходила — ты делала, и это видно.`,
    n => `${n}, ты прошла почти всё, что Ева собрала. Так выглядит настоящая работа над собой.`,
    n => `${n}, неделя удалась. Ты держала ритм, даже когда было некогда.`
  ],
  middle: [
    n => `${n}, неделя получилась рабочей. Не всё, но и не мимо — а это и есть нормальный темп.`,
    n => `${n}, ты сделала свою часть. Пропущенное не пропало: похожее вернётся на новой неделе.`,
    n => `${n}, хорошая неделя. Понемногу и есть то, что работает в долгую.`
  ],
  quiet: [
    n => `${n}, неделя вышла тихой — так бывает, и это не провал.`,
    n => `${n}, на этой неделе было не до себя. Начнём заново, с одного дела.`,
    n => `${n}, тихая неделя тоже часть пути. Ева собрала новую, полегче.`
  ]
};
const WEEK_TAIL = {
  strong: 'Новая неделя уже собрана — на свежих материалах и под то, что тебе интересно.',
  middle: 'Новая неделя собрана. Если совсем нет сил — включи мягкий режим, останутся два дела вместо трёх.',
  quiet:  'Начни с одной аффирмации. Минута — и день уже засчитан.'
};

/* строка «над чем работала» — только по настоящим делам, без выдумок */
function weekWork(w){
  const parts = [];
  if(w.byType.affirm)   parts.push(plural(w.byType.affirm, 'аффирмация', 'аффирмации', 'аффирмаций'));
  if(w.byType.practice) parts.push(plural(w.byType.practice, 'практика', 'практики', 'практик'));
  if(w.byType.class)    parts.push(plural(w.byType.class, 'мастер-класс', 'мастер-класса', 'мастер-классов'));
  return parts.join(', ');
}

function weekTopics(w){
  const names = (w.topics || []).map(topicName).filter(Boolean);
  if(!names.length) return '';
  return names.length === 1 ? names[0]
    : names.slice(0, -1).join(', ') + ' и ' + names[names.length - 1];
}

/* ---------- письмо от Евы ---------- */
function evaThread(){
  S.inbox = S.inbox || [];
  let t = S.inbox.find(x => x.id === 'eva_week');
  if(!t){
    t = {id:'eva_week', from:EVA_NAME, c:'#A8375C', kind:'итоги', ago:'только что',
         unread:false, sys:true, msgs:[]};
    S.inbox.unshift(t);
  }
  return t;
}

function evaSay(text, act){
  const t = evaThread();
  const now = new Date();
  t.msgs.push({me:false, t:text, act:act || '',
    tm:String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0')});
  t.unread = true;
  t.ago = 'только что';
  /* переписка с Евой длинная — держим последние тридцать сообщений */
  if(t.msgs.length > 30) t.msgs = t.msgs.slice(-30);
  schedulePersist();
}

/* Итог недели: письмо в сообщения плюс шторка при входе.
   Вызывается из checkWeek со снимком прошедшей недели. */
function evaWeekly(w){
  if(!w || !S.user) return;
  const name = S.name || 'Ева';
  const set = WEEK_TEXT[w.level] || WEEK_TEXT.quiet;
  const lead = set[(S.week || 0) % set.length](name);
  const work = weekWork(w), topics = weekTopics(w);

  const lines = [lead];
  if(w.done) lines.push(`За неделю: ${w.done} из ${w.total} дел, ${plural(w.days,'день','дня','дней')} с отметками` +
    (w.full ? `, ${plural(w.full,'день закрыт','дня закрыты','дней закрыты')} полностью` : '') + '.');
  if(work)   lines.push(`Ты прошла: ${work}.`);
  if(topics) lines.push(`Больше всего — про ${topics.toLowerCase()}.`);
  lines.push(WEEK_TAIL[w.level] || WEEK_TAIL.quiet);

  evaSay(lines.join(' '), 'weekMood');
  S.lastWeek = w;
  S.weekShown = false;
  S.weekMood = null;
}

/* Ответ на «как прошла неделя» */
const MOODS = [
  {k:'good',  n:'Хорошо',        r:'Рада за тебя. Пусть новая неделя будет такой же.'},
  {k:'so-so', n:'По-разному',    r:'Так чаще всего и бывает. Главное, что ты возвращаешься.'},
  {k:'hard',  n:'Было тяжело',   r:'Спасибо, что сказала. Я собрала неделю полегче — начни с малого, остальное подождёт.'}
];
function weekMood(k){
  const m = MOODS.find(x => x.k === k);
  if(!m) return;
  S.weekMood = k;
  const t = evaThread();
  t.msgs.push({me:true, t:m.n, tm:nowTime()});
  evaSay(m.r);
  if(k === 'hard') S.gentle = true;
  S.sheet = null;
  render(); schedulePersist();
  toast(k === 'hard' ? 'Включила мягкий режим' : 'Спасибо');
}
const nowTime = () => {
  const d = new Date();
  return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
};

/* ---------- шторка с итогом ---------- */
function shWeekSum(){
  const w = S.lastWeek;
  if(!w) return `<div class="empty">Итогов пока нет</div>`;
  const work = weekWork(w), topics = weekTopics(w);
  const set = WEEK_TEXT[w.level] || WEEK_TEXT.quiet;
  return `<div class="wsum wsum-${w.level}">
      <div class="wsumtop">${starMark(20, w.level === 'quiet' ? 'rgba(255,255,255,.5)' : '#E7A339')}
        <span>Итоги недели</span></div>
      <div class="wsumbig">${w.done}<i>из ${w.total}</i></div>
      <div class="wsumsub">${plural(w.days,'день','дня','дней')} с отметками${
        w.full ? ` · ${plural(w.full,'день','дня','дней')} закрыто полностью` : ''}</div>
    </div>
    <p class="wsumtext">${esc(set[(S.week || 0) % set.length](S.name || 'Ева'))}</p>
    ${work ? `<div class="uline first"><span class="small muted" style="flex:1">Прошла</span>
      <b style="font-size:13px">${esc(work)}</b></div>` : ''}
    ${topics ? `<div class="uline"><span class="small muted" style="flex:1">Больше всего</span>
      <b style="font-size:13px">${esc(topics)}</b></div>` : ''}
    <div class="uline"><span class="small muted" style="flex:1">Баллов всего</span>
      <b style="font-size:13px">${w.points}</b></div>
    <p class="small muted" style="margin:14px 0 12px">${esc(WEEK_TAIL[w.level] || WEEK_TAIL.quiet)}</p>
    <div class="eyebrow" style="margin-bottom:8px">Как прошла твоя неделя?</div>
    <div class="moods">${MOODS.map(m => `<button class="mood" onclick="weekMood('${attJs(m.k)}')">
      ${esc(m.n)}</button>`).join('')}</div>
    <button class="btn ghost" style="margin-top:10px" onclick="closeSheet()">Позже</button>`;
}

/* ---------- напоминание в выходные ---------- */
/* Задача — вовлечённость, а не давление: пишем один раз за неделю,
   только если непройденного действительно много, и зовём посмотреть,
   а не требуем догнать. */
function weekendNudge(){
  if(!S.user || S.screen !== 'app') return false;
  const day = new Date().getDay();               // 6 — суббота, 0 — воскресенье
  if(day !== 6 && day !== 0) return false;
  if(S.nudgedWeek === S.week) return false;

  const tasks = (S.program || []).flatMap(d => d.tasks || []);
  const left = tasks.filter(t => !t.done).length;
  if(!tasks.length || left < tasks.length * 0.5) return false;

  S.nudgedWeek = S.week;
  const name = S.name || 'Ева';
  evaSay(`${name}, выходные — хорошее время догнать неделю. ` +
    `Непройденного осталось ${plural(left,'дело','дела','дел')}, но догонять всё не нужно: ` +
    `выбери одно, что откликается. Или загляни в библиотеку — там есть короткие практики на пять минут.`,
    'openContent');
  schedulePersist();
  return true;
}

/* ---------- показ при входе ---------- */
/* Шторку показываем один раз и только на главной: посреди чата или
   оплаты она была бы не к месту. */
function maybeShowWeek(){
  if(!S.lastWeek || S.weekShown) return false;
  if(S.screen !== 'app' || S.page || S.sheet || (S.chat && S.chat.open)) return false;
  if(S.role !== 'user') return false;
  S.weekShown = true;
  S.sheet = 'weekSum';
  schedulePersist();
  return true;
}

/* Открыть итоги вручную — из настроек. Если недели ещё не было,
   считаем по текущей: женщина всё равно хочет посмотреть, как идёт. */
function showWeekSum(){
  if(!S.lastWeek) S.lastWeek = weekSnapshot();
  S.page = null; S.sheet = 'weekSum';
  render();
}

/* Все модули расставили значения по умолчанию — запоминаем чистое состояние,
   чтобы вход в другой аккаунт начинался с него, а не с чужих данных. */
keepPristine();
