/* =====================================================================
   ПОДБОР ПРОГРАММЫ
   Ядро продукта: из библиотеки в сорок с лишним материалов собрать
   женщине семь дней по три дела так, чтобы это читалось как собранное
   для неё, а не как лента.

   Механика держится на четырёх правилах.

   1. Безопасность — это фильтр, всё остальное — оценка.
      Беременной не показываем активные практики, в дни менструации —
      тоже: это запрет, а не предпочтение, и он не снимается никогда.
      Время, уровень, направления раньше тоже были фильтрами, и когда
      после них оставалось меньше трёх материалов, код снимал условия
      подряд — включая запреты. Теперь мягкие условия живут в оценке:
      пул не пустеет, снимать нечего.

   2. Оценка складывается из семи сигналов с понятными весами.
      Каждый нормируется в 0..1 и умножается на свой вес, сумма делится
      на максимум — получается честный процент. Материал, который ей не
      подходит, показывает низкий процент, а не «52%» из ниоткуда.

   3. У дня есть тема.
      Три её главных запроса раскладываются по неделе, и внутри дня все
      три дела тянутся к теме дня. Так вторник читается как «про
      границы», а не как три случайных карточки.

   4. Внутри недели материал не повторяется, между неделями первым
      возвращается самый давний.
   ===================================================================== */

/* ---------- профиль: всё, что мы о ней знаем, в одном месте ---------- */
function profileOf(){
  return {
    tags:   weightedTags(),
    topics: S.topics || [],
    aud:    typeof myAudience === 'function' ? myAudience() : [],
    time:   +S.time || 20,          // из старых профилей могло прийти строкой
    level:  myLevel(),
    seen:   S.seen || {},
    week:   S.week || 0,
    gentle: !!S.gentle
  };
}

/* Вес запроса. Первый вопрос теста — «что важнее всего сейчас», и его
   ответы весят больше остальных: женщина назвала главное, а не побочное.
   У старых профилей веса нет — там считаем по месту в списке, порядок
   там тот же, потому что теги копятся по ходу теста. */
function weightedTags(){
  const src = S.tagw || {};
  return (S.tags || []).map((t, i) => ({
    t,
    w: src[t] != null ? src[t] : Math.max(0.5, 1 - i * 0.12)
  }));
}

function myLevel(){
  if((S.tags || []).includes('опыт')) return 'pro';
  if((S.tags || []).includes('новичок')) return 'new';
  return 'middle';
}

/* ---------- запреты ----------
   Единственное, что отсекается наглухо. Список короткий нарочно:
   всё, что не про безопасность, должно жить в оценке. */
function allowed(item, p){
  const aud = item.aud || [];
  /* активные практики не даём в дни менструации и при беременности */
  const inPeriod = p.aud.includes('period');
  if(aud.includes('active') && (inPeriod || p.aud.includes('pregnant'))) return false;
  /* материал, помеченный этапом, — только для этого этапа */
  const stages = ['pregnant', 'newborn', 'toddler'];
  const mark = aud.filter(k => stages.includes(k));
  if(mark.length && !mark.some(k => p.aud.includes(k))) return false;
  return true;
}

/* ---------- семь сигналов ----------
   Веса подобраны так: запрос женщины весит больше половины, потому что
   ради него она и проходила тест. Очередь редакции весит меньше всех —
   раньше она стояла первой в сортировке и делала программу одинаковой
   для всех, кем бы они ни были. */
const SIGNALS = {
  request: 46,   // теги её запроса
  topic:   22,   // выбранные направления
  stage:   14,   // этап жизни
  time:    10,   // влезает в её минуты
  level:    8,   // по силам
  fresh:   10,   // давно не показывали
  order:    5    // очередь, заданная редакцией
};

/* Чем длиннее материал, тем важнее, чтобы он был новым.
   Пересмотреть аффирмацию в одну строчку — нормально, её и повторяют
   нарочно. Поэтому у аффирмаций свежесть весит мало, у практик больше.

   С мастер-классами весом не обойтись. Полчаса видео, которое она уже
   смотрела, — потерянный вечер, и точность подбора этого не окупает:
   какой бы вес мы ни поставили, разница в совпадении между «прямо про
   её запрос» и «мимо» всегда больше. Поэтому у длинного материала
   свежесть — не вес, а ступень: сначала идёт всё неувиденное (внутри —
   по совпадению), и только когда оно кончилось, возвращается самое
   давнее. Так обещание «мастер-классы не повторяются» становится
   правдой, а не пожеланием. */
const FRESH_BY_TYPE = {affirm: 6, practice: 14};
const FRESH_FIRST = ['class'];
function signalsFor(type){
  const w = FRESH_BY_TYPE[type];
  return w == null ? SIGNALS : Object.assign({}, SIGNALS, {fresh: w});
}
const signalMax = sig => Object.keys(sig).reduce((n, k) => n + sig[k], 0);

/* доля запроса, которую закрывает материал */
function sRequest(item, p){
  if(!p.tags.length) return 0.5;                       // теста не было — не наказываем
  const his = Array.isArray(item.tags) ? item.tags : [];
  const top = p.tags.slice(0, 3);
  const need = top.reduce((n, x) => n + x.w, 0) || 1;
  const got = p.tags.filter(x => his.includes(x.t))
                    .reduce((n, x) => n + x.w, 0);
  return Math.min(1, got / need);
}

function sTopic(item, p){
  if(!p.topics.length) return 0.5;                     // направлений не выбирала
  const his = Array.isArray(item.topics) ? item.topics : [];
  const hit = his.filter(t => p.topics.includes(t)).length;
  return Math.min(1, hit / Math.min(2, p.topics.length));
}

/* Этап жизни: материал, прямо помеченный её этапом, ценнее общего.
   Общий подходит всем и получает середину, а не ноль. */
function sStage(item, p){
  const aud = (item.aud || []).filter(k => k !== 'active' && k !== 'period');
  if(!aud.length) return 0.55;
  return aud.some(k => p.aud.includes(k)) ? 1 : 0.3;
}

/* Время: важно не «влезает ли вообще», а влезает ли спокойно.
   В мягком режиме бюджет урезаем — она сама сказала, что тяжело. */
function sTime(item, p){
  const budget = p.gentle ? Math.max(10, p.time * 0.6) : p.time;
  const min = +item.min || 0;
  if(min <= budget * 0.7) return 1;
  if(min <= budget)       return 0.75;
  if(min <= budget * 1.5) return 0.3;
  return 0.05;
}

/* Уровень: точное попадание лучше всего, «для всех» — почти так же
   хорошо, через ступень — плохо, но не запрещено. Раньше здесь была
   ошибка: новичку не доставалось даже то, что помечено «для новичков». */
const LEVELS_ORDER = ['new', 'middle', 'pro'];
function sLevel(item, p){
  const lvl = item.level || 'any';
  if(lvl === 'any') return 0.8;
  const d = Math.abs(LEVELS_ORDER.indexOf(lvl) - LEVELS_ORDER.indexOf(p.level));
  return d === 0 ? 1 : d === 1 ? 0.45 : 0.1;
}

/* Свежесть: не видела — лучшее, что может быть. Дальше по тому,
   сколько недель прошло: через месяц материал снова как новый. */
function sFresh(item, p){
  const at = p.seen[item.id];
  if(at == null) return 1;
  const ago = Math.max(0, p.week - at);
  return Math.min(1, 0.15 + ago * 0.22);
}

/* Очередь редакции: подсказка, куда смотреть, если всё остальное
   вровень. Материалы без очереди не проигрывают — им середина. */
function sOrder(item){
  const ord = +item.ord || 0;
  if(ord <= 0) return 0.35;
  return Math.max(0.4, 1 - (ord - 1) / 20);
}

/* Раскладка: последний разделитель, когда всё остальное вровень.
   Запрос женщины закрывается первыми несколькими материалами, а дальше
   вся библиотека для неё одинаково нейтральна — и без разделителя каждая
   получала бы один и тот же «лучший остаток». Двум женщинам с разными
   ответами доставалась половина одной программы. Число считается из её
   профиля и номера материала: у одной женщины оно всегда одно и то же
   (программа не пляшет между сборками), у разных — разное. */
function spread(item, p){
  const key = (p.tags.map(x => x.t).join(',') + '|' + (p.topics || []).join(',')) || 'нет';
  return hash(key + '::' + item.id) % 5;
}

/* ---------- оценка целиком ---------- */
function scoreItem(item, p){
  const parts = {
    request: sRequest(item, p),
    topic:   sTopic(item, p),
    stage:   sStage(item, p),
    time:    sTime(item, p),
    level:   sLevel(item, p),
    fresh:   sFresh(item, p),
    order:   sOrder(item)
  };
  const sig = signalsFor(item.type);
  let sum = 0;
  Object.keys(sig).forEach(k => { sum += parts[k] * sig[k]; });
  return {score: Math.round(sum / signalMax(sig) * 100), parts, sig};
}

/* Почему именно это — одной строкой, её словами.
   Показываем не больше двух причин: третья уже не читается. */
function whyItem(item, p){
  const out = [];
  const his = Array.isArray(item.tags) ? item.tags : [];
  const mine = p.tags.filter(x => his.includes(x.t)).map(x => x.t);
  if(mine.length) out.push('про ' + mine.slice(0, 2).join(' и '));
  const tp = (item.topics || []).filter(t => (p.topics || []).includes(t));
  if(tp.length && typeof topicName === 'function'){
    const n = topicName(tp[0]);
    if(n) out.push(n.toLowerCase());
  }
  const aud = (item.aud || []).filter(k => k !== 'active' && k !== 'period');
  if(!out.length && aud.some(k => p.aud.includes(k))) out.push('под твой этап');
  if(!out.length && (+item.min || 0) <= p.time * 0.7) out.push('быстро, ' + item.min + ' мин');
  return out.slice(0, 2).join(' · ');
}

/* Совпадение материала с ней — то же число, что и в программе.
   Используется в библиотеке для сортировки и на карточках. */
function matchOf(item){
  if(!item) return 0;
  return scoreItem(item, profileOf()).score;
}

/* попадает ли материал в выбранные ею направления */
function topicHit(item){
  const mine = S.topics || [];
  if(!mine.length) return false;
  const his = (item && Array.isArray(item.topics)) ? item.topics : [];
  return his.some(t => mine.indexOf(t) >= 0);
}

/* ---------- совместимость ----------
   Эти три проверки остались как были: на них смотрит админка,
   когда показывает, кому материал достанется. */
function fitsAudience(item){ return allowed(item, profileOf()); }
function fitsLevel(item){ return sLevel(item, profileOf()) >= 0.45; }
function fitsTime(item){ return sTime(item, profileOf()) >= 0.3; }

/* ---------- чем библиотека закрывает запросы ----------
   Подбор не может дать того, чего нет. Если под «деньги» в библиотеке
   три материала, женщина с этим запросом получит три попадания и
   восемнадцать нейтральных дел — и никакая настройка весов этого не
   изменит. Считаем покрытие по каждому запросу теста, чтобы дыры
   в контенте было видно до того, как о них скажут женщины. */
function tagCoverage(){
  const live = LIB.filter(x => x.status === 'live');
  const asked = {};
  (typeof QUIZ !== 'undefined' ? QUIZ : []).forEach(q =>
    (q.o || []).forEach(o => (o.tags || []).forEach(t => { asked[t] = true; })));
  return Object.keys(asked).map(t => {
    const hit = live.filter(x => (x.tags || []).includes(t));
    const by = {affirm:0, practice:0, class:0};
    hit.forEach(x => { if(by[x.type] !== undefined) by[x.type]++; });
    return {t, n:hit.length, by};
  }).sort((a, b) => a.n - b.n);
}

/* ---------- темы недели ----------
   Три главных запроса раскладываются по семи дням так, чтобы соседние
   дни не повторялись, а к концу недели каждая тема прозвучала. */
function weekThemes(p){
  const top = p.tags.slice(0, 3).map(x => x.t);
  if(!top.length) return DAYS.map(() => null);
  return DAYS.map((_, i) => top[i % top.length]);
}
const THEME_BONUS = 12;                       // столько добавляет тема дня
function themeFit(item, theme){
  if(!theme) return 0;
  return (item.tags || []).includes(theme) ? THEME_BONUS : 0;
}

/* Будни — только то, что она успеет.
   Женщина сказала «десять минут в день», а самый короткий мастер-класс
   идёт двадцать: короче в библиотеке нет. Раньше он вставал ей в среду —
   и она открывала приложение, видела, что не успеет, и закрывала.

   Штрафом это не решается: подходящее по теме длинное, а короткое обычно
   не про её запрос, и разрыв в оценке больше любого разумного штрафа.
   Поэтому в будни выбор сужается до того, что влезает в её время, — и
   только если не влезает ничего, берём лучшее из длинного. На выходных
   ограничения нет: там время есть, и туда уходит самое содержательное. */
const WEEKEND_FROM = 5;                        // суббота и воскресенье
function fitsBudget(item, p){
  return (+item.min || 0) <= (p.gentle ? Math.max(10, p.time * 0.6) : p.time);
}
function dayChoice(list, p, i){
  if(i >= WEEKEND_FROM) return list;
  const fit = list.filter(c => fitsBudget(c.item, p));
  return fit.length ? fit : list;
}

/* ---------- сбор недели ---------- */
function buildProgram(){
  const p = profileOf();
  const themes = weekThemes(p);
  const used = {};                            // внутри недели не повторяемся

  /* Порядок важен: слоты разбирают материал по очереди, и первым должен
     выбирать самый стеснённый. Вечер буднего дня, когда мастер-класс не
     влезает в её время, берёт короткую практику — если дать дневному слоту
     выбрать раньше, короткие кончатся и вечер снова станет длинным. */
  const plan = type => planWeek(type, p, themes, used);
  const af = plan('affirm');
  const mk = plan('class');
  const ev = eveningPlan(mk, p, used);
  const pr = plan('practice');

  S.program = DAYS.map((d, i) => ({
    d, theme: themes[i],
    tasks: [
      task(af[i], 'утро', p),
      task(pr[i], S.slot, p),
      task(ev[i], 'вечер', p)
    ].filter(Boolean)
  }));

  rememberShown(p);
  S.stars = starsWeek();

  const all = S.program.flatMap(x => x.tasks);
  S.match = all.length ? Math.round(all.reduce((a, t) => a + t.match, 0) / all.length) : 0;
  S.day = todayIdx();
}

/* Материалы одного вида на семь дней.
   Сначала расставляем привязанные к дням недели — редакция сказала
   «эта практика по вторникам», это сильнее всего остального. Оставшиеся
   дни разбираем по очереди, выбирая лучшее с поправкой на тему дня. */
function planWeek(type, p, themes, used){
  const pool = candidates(type, p);
  const out = new Array(DAYS.length).fill(null);

  DAYS.forEach((_, i) => {
    const key = DAY_KEYS[i];
    const fixed = pool.find(c => !used[c.item.id] &&
      Array.isArray(c.item.days) && c.item.days.includes(key));
    if(fixed){ out[i] = fixed.item; used[fixed.item.id] = true; }
  });

  DAYS.forEach((_, i) => {
    if(out[i]) return;
    const free = pool.filter(c => !used[c.item.id] &&
      (!c.item.days || !c.item.days.length));
    const rest = free.length ? free : pool.filter(c => !used[c.item.id]);
    if(!rest.length){                          // библиотека кончилась — повторяем самое давнее
      const any = pool[i % Math.max(1, pool.length)];
      out[i] = any ? any.item : null;
      return;
    }
    const list = dayChoice(rest, p, i);
    /* если неувиденное есть — выбираем только из него: тема дня не повод
       показать второй раз то, что она уже смотрела */
    const fresh = list.filter(c => !c.seen);
    const from = fresh.length ? fresh : list;
    let best = from[0], bestScore = -Infinity;
    from.forEach(c => {
      const v = c.score + c.mix + themeFit(c.item, themes[i]);
      if(v > bestScore){ bestScore = v; best = c; }
    });
    out[i] = best.item;
    used[best.item.id] = true;
  });
  return out;
}

/* Вечер буднего дня, когда мастер-классы длиннее её времени.
   У женщины с десятью минутами в день ни один мастер-класс в бюджет не
   влезает — короче двадцати минут их просто нет. Ставить его всё равно
   значит обещать невыполнимое: она откроет, увидит, что не успеет, и
   закроет. Поэтому в такие будни вечером встаёт вторая короткая практика,
   а мастер-классы уходят на выходные, где время есть.

   Дел по-прежнему три в день: меняется вид вечернего, а не их число. */
function eveningPlan(mk, p, used){
  const short = candidates('practice', p).filter(c => fitsBudget(c.item, p));
  return mk.map((item, i) => {
    if(i >= WEEKEND_FROM || !item || fitsBudget(item, p)) return item;
    const swap = short.find(c => !used[c.item.id]);
    if(!swap) return item;                     // короткого нет — оставляем как есть
    used[swap.item.id] = true;
    return swap.item;
  });
}

/* Все допустимые материалы вида, оценённые и отсортированные.
   Для мастер-классов пул шире: когда свои кончились, идут открытые
   уроки курсов — женщина видит новое, а не третий круг одного и того же. */
function candidates(type, p){
  let base = LIB.filter(x => x.type === type && x.status === 'live');
  if(type === 'class' && typeof openCourseLessons === 'function'){
    const lessons = openCourseLessons() || [];
    lessons.forEach(l => { if(l && !base.some(x => x.id === l.id)) base.push(l); });
  }
  const tier = FRESH_FIRST.indexOf(type) >= 0;
  return base
    .filter(x => allowed(x, p))
    .map(item => ({
      item,
      score: scoreItem(item, p).score,
      mix:   spread(item, p),
      /* 0 — не видела, 1 — видела: для длинного материала это ступень */
      seen:  tier && p.seen[item.id] != null ? 1 : 0,
      ago:   p.week - (p.seen[item.id] != null ? p.seen[item.id] : -999)
    }))
    /* раскладка участвует только в сортировке: показанный процент от неё
       не меняется — иначе он перестал бы быть честным */
    .sort((a, b) =>
      a.seen - b.seen ||                                  // неувиденное вперёд
      (a.seen ? b.ago - a.ago : 0) ||                      // среди повторов — самое давнее
      (b.score + b.mix) - (a.score + a.mix) ||
      String(a.item.id).localeCompare(String(b.item.id)));
}

/* Что показали на этой неделе — помним по номеру недели.
   Раньше помнились только мастер-классы, и аффирмации могли прийти
   две недели подряд одни и те же. */
function rememberShown(p){
  S.seen = S.seen || {};
  S.program.forEach(day => day.tasks.forEach(t => { if(t) S.seen[t.id] = p.week; }));
  const ids = Object.keys(S.seen);
  if(ids.length > 400){                        // не копим бесконечно
    ids.sort((a, b) => S.seen[a] - S.seen[b])
       .slice(0, ids.length - 400)
       .forEach(id => delete S.seen[id]);
  }
}

function task(item, slot, p){
  if(!item) return null;
  const prof = p || profileOf();
  const s = scoreItem(item, prof);
  return {...item, slot, pts:TYPE[item.type].pts,
          match:s.score, why:whyItem(item, prof), done:false};
}

const todayIdx = () => (new Date().getDay() + 6) % 7;
const weekNo = () => Math.floor((Date.now() - new Date(new Date().getFullYear(),0,1)) / 6048e5);

/* при смене недели программа пересобирается на свежих материалах */
function checkWeek(quiet){
  const wasDay = S.day;
  S.day = todayIdx();
  if(!quiet) bumpVisit();
  const w = weekNo();
  S.weekly = S.weekly || {exchanged:false};
  if(S.week === undefined || S.week === null){ S.week = w; return wasDay !== S.day; }
  if(S.week !== w){
    /* снимок делаем ДО пересборки: после неё считать уже нечего */
    const past = typeof weekSnapshot === 'function' ? weekSnapshot() : null;
    S.week = w;
    S.weekly.exchanged = false;          // обмен баллов снова доступен
    S.stars = 0;                          // звёзды недели считаются заново
    buildProgram();                       // программа пересобирается на свежем
    if(typeof evaWeekly === 'function') evaWeekly(past);
    if(!quiet) toast('Новая неделя — Ева подвела итоги');
    if(typeof schedulePersist === 'function') schedulePersist();
    return true;
  }
  /* в выходные напоминаем про непройденное — один раз за неделю */
  if(typeof weekendNudge === 'function' && weekendNudge()) return true;
  if(wasDay !== S.day && typeof schedulePersist === 'function') schedulePersist();
  return wasDay !== S.day;
}

/* Приложение часто остаётся открытым на ночь. Раз в минуту проверяем,
   не наступил ли новый день или новая неделя, иначе программа замирает
   на вчерашнем дне до перезахода. */
function watchCalendar(){
  setInterval(() => {
    if(S.screen !== 'app' || !S.user) return;
    try {
      let need = checkWeek();
      /* заодно двигаем письма Eva Events по настоящему расписанию */
      if(typeof tickEvChain === 'function' && tickEvChain()) need = true;
      if(typeof maybeShowWeek === 'function' && maybeShowWeek()) need = true;
      if(need) render();
    } catch(e){ console.error('[Eva] смена дня:', e); }
  }, 60000);
}
const doneOf = i => S.program[i] ? S.program[i].tasks.filter(t => t.done).length : 0;
const starsTotal = () => S.program.length * 3;

/* звёзды текущей недели считаем из самой программы, чтобы счётчик
   не мог перерасти максимум после пересборки. Накопленное за всё
   время живёт отдельно в S.starsAll */
function starsWeek(){
  return (S.program || []).reduce((a, d) => a + d.tasks.filter(t => t.done).length, 0);
}

function complete(di, ti){
  const t = S.program[di].tasks[ti];
  if(t.done) return;
  t.done = true;
  S.points += t.pts;
  S.starsAll = (S.starsAll || 0) + 1;
  S.stars = starsWeek();
  toast(`+${t.pts} баллов`);
  if(doneOf(di) === 3) setTimeout(() => toast('День закрыт полностью'), 1000);
  render(); schedulePersist();
}

function levelNow(){
  let cur = LEVELS[0], next = LEVELS[1];
  LEVELS.forEach((l,i) => { if(S.points >= l.from){ cur = l; next = LEVELS[i+1] || null; } });
  return {cur, next};
}

function streak(){
  let n = 0;
  for(let i = todayIdx(); i >= 0; i--){ if(doneOf(i) === 3) n++; else break; }
  return n;
}

/* ---------- служебное ---------- */
function toast(msg){
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2100);
}

function speak(text){
  if(!S.voice || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const clean = String(text).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu,'').replace(/\s+/g,' ');
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = 'ru-RU'; u.rate = .98; u.pitch = 1.08;
  const vs = speechSynthesis.getVoices().filter(v => v.lang && v.lang.toLowerCase().startsWith('ru'));
  const f = vs.find(v => /Milena|Alyona|Katya|Female|Google/i.test(v.name)) || vs[0];
  if(f) u.voice = f;
  speechSynthesis.speak(u);
}

const hello = () => { const h = new Date().getHours();
  return h < 6 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер'; };

/* =====================================================================
   РОУТЕР
   ===================================================================== */
/* Перерисовка со страховкой. Если экран не собрался — показываем понятную
   карточку вместо белого листа: приложение остаётся живым, и из него всегда
   можно выйти на главную. */
let crashCount = 0;
function render(){
  try {
    renderScreen();
    crashCount = 0;
  } catch(e){
    console.error('[Eva] экран не собрался:', e);
    crashCount++;
    try {
      shownHTML = null; shownSheet = null; el.__split = false;   // после падения показываем заново в любом случае
      el.innerHTML = crashCount > 2
        ? `<div class="view pad" style="padding-top:60px"><h1 class="serif">Приложение споткнулось</h1>
             <p class="small muted" style="margin:10px 0 16px">Обнови страницу — данные сохранены.</p>
             <button class="btn" onclick="location.reload()">Обновить</button></div>`
        : crashScreen(e);
    } catch(e2){
      el.innerHTML = '<div style="padding:28px;font-family:sans-serif">Что-то пошло не так. Обнови страницу.</div>';
    }
  }
}

/* Перерисовка по чужому изменению: страница остаётся на месте.
   Обычный render() пересобирает разметку, и браузер прокручивает наверх —
   женщина читала послание, а её выбросило в начало ленты. Со стороны это
   и выглядело как самопроизвольная перезагрузка. */
function softRender(){
  const y = window.scrollY;
  render();
  if(Math.abs(window.scrollY - y) > 2) window.scrollTo(0, y);
}

function crashScreen(e){
  const pro = S.role === 'admin' || S.role === 'expert';
  return `<div class="view pad" style="padding-top:calc(40px + env(safe-area-inset-top))">
    <div style="font-size:40px;margin-bottom:10px">✦</div>
    <h1 class="serif" style="font-size:26px;margin:0 0 8px">Этот экран не открылся</h1>
    <p class="small muted" style="margin:0 0 18px">Похоже, в данных чего-то не хватает. Остальное приложение работает —
      вернись на главную и продолжай.</p>
    <button class="btn" onclick="backHome()">На главную</button>
    <button class="btn ghost" style="margin-top:9px" onclick="location.reload()">Обновить страницу</button>
    ${pro ? `<div class="card" style="margin-top:16px"><div class="eyebrow">Для разработчика</div>
      <div class="small" style="margin-top:6px;word-break:break-word">${esc(String(e && e.message || e))}</div></div>` : ''}
  </div>`;
}

/* вернуться в заведомо рабочее состояние */
function backHome(){
  S.sheet = null; S.page = null; S.course = null; S.viewGood = null; S.viewExpert = null;
  if(S.chat) S.chat.open = null;
  S.tab = 'home'; S.screen = 'app'; crashCount = 0;
  render();
}

/* Пересборка страницы — самая дорогая операция в приложении: браузер
   заново разбирает разметку и считает раскладку. Перерисовку дёргают и
   таймеры, и ответы сервера, поэтому сравниваем с тем, что уже показано,
   и не трогаем страницу, если ничего не изменилось. Заодно не сбивается
   набранный текст и позиция прокрутки. */
let shownHTML = null, shownSheet = null;
window.__renders = 0; window.__skipped = 0;
function setHTML(html){
  shownSheet = null;
  if(html === shownHTML && !el.__split){ window.__skipped++; return false; }
  el.__split = false;
  shownHTML = html; el.innerHTML = html; window.__renders++;
  after();
  return true;
}

/* Внутри приложения страница и шторка живут в разных коробках. Открыть
   урок — значит дорисовать шторку, а не пересобрать всё вокруг: список
   под ней остаётся на месте, прокрутка не прыгает, экран не моргает. */
function setApp(body, sh){
  if(!el.__split){
    el.innerHTML = '<div id="pagebox"></div><div id="sheetbox"></div>';
    el.__split = true; shownHTML = null; shownSheet = null;
  }
  const pageBox = el.firstElementChild, sheetBox = el.lastElementChild;
  if(body === shownHTML) window.__skipped++;
  else {
    const memo = keepFocus();
    shownHTML = body; pageBox.innerHTML = body; window.__renders++;
    after(); memo();
  }
  if(sh !== shownSheet){ shownSheet = sh; sheetBox.innerHTML = sh; }
  return true;
}

/* Что делаем после каждой пересборки разметки. */
function after(){ deskArrows(); growFields(); }

/* Поля, которые растут под текст: после пересборки их надо померить заново,
   иначе набранное послание схлопывается в одну строку. */
function growFields(){
  document.querySelectorAll('textarea[data-grow]').forEach(grow);
}
function grow(t){
  t.style.height = 'auto';
  t.style.height = Math.min(t.scrollHeight, +t.dataset.grow || 190) + 'px';
}

/* Перерисовку могут дёрнуть таймер или ответ сервера прямо посреди набора
   текста. Запоминаем, где стоял курсор, и возвращаем его на место. */
function keepFocus(){
  const a = document.activeElement;
  if(!a || !a.id || (a.tagName !== 'INPUT' && a.tagName !== 'TEXTAREA')) return () => {};
  const id = a.id, pos = a.selectionStart, end = a.selectionEnd;
  return () => {
    const n = document.getElementById(id);
    if(!n || typeof n.focus !== 'function') return;
    try { n.focus({preventScroll:true}); } catch(e){ n.focus(); }
    try { if(pos != null && n.setSelectionRange) n.setSelectionRange(pos, end); } catch(e){}
  };
}

/* =====================================================================
   СТРЕЛКИ У ГОРИЗОНТАЛЬНЫХ ЛЕНТ
   На телефоне ленту листают пальцем, на компьютере листать было нечем.
   После каждой перерисовки оборачиваем ленты, которым не хватает ширины,
   и ставим по краям две круглые кнопки. На сенсорных экранах их нет.
   ===================================================================== */
const RAILS = '.hscroll, .carousel, .galrow';

function railOf(btn){
  const box = btn && btn.parentElement;
  return box ? box.querySelector(RAILS) : null;
}
function slideRail(btn, dir){
  const row = railOf(btn);
  if(!row) return;
  row.scrollBy({ left: dir * Math.max(220, row.clientWidth * 0.8), behavior:'smooth' });
}
/* стрелка гаснет, когда в эту сторону листать больше нечего */
function markRail(box){
  const row = box.querySelector(RAILS);
  if(!row) return;
  const left = box.querySelector('.snav.left'), right = box.querySelector('.snav.right');
  const end = row.scrollWidth - row.clientWidth - 2;
  if(left)  left.classList.toggle('off', row.scrollLeft <= 2);
  if(right) right.classList.toggle('off', row.scrollLeft >= end);
}
function deskArrows(){
  try {
    /* мышь или просто широкий экран: на телефоне ленту листают пальцем */
    const mouse = window.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches;
    if(!mouse && window.innerWidth < 720) return;
    document.querySelectorAll(RAILS).forEach(row => {
      const parent = row.parentElement;
      if(!parent || parent.classList.contains('scroller')) return;
      if(row.scrollWidth - row.clientWidth < 24) return;      // всё и так помещается
      const box = document.createElement('div');
      box.className = 'scroller rail';
      parent.insertBefore(box, row);
      box.appendChild(row);
      box.insertAdjacentHTML('afterbegin',
        '<button class="snav left" aria-label="Назад" onclick="slideRail(this,-1)">‹</button>');
      box.insertAdjacentHTML('beforeend',
        '<button class="snav right" aria-label="Вперёд" onclick="slideRail(this,1)">›</button>');
      row.addEventListener('scroll', () => markRail(box), { passive:true });
      markRail(box);
    });
  } catch(e){ console.error('[Eva] стрелки лент:', e); }
}
window.addEventListener('resize', () => { try { deskArrows(); } catch(e){} });

function renderScreen(){
  const s = S.screen;
  if(s === 'splash')   { setHTML(scrSplash()); return; }
  if(s === 'auth')     { setHTML(scrAuth()); return; }
  if(s === 'mail')     { setHTML(scrMail()); return; }
  if(s === 'welcome')  setHTML(scrWelcome());
  else if(s === 'quiz')     setHTML(scrQuiz());
  else if(s === 'building') setHTML(scrBuilding());
  else if(s === 'ready')    setHTML(scrReady());
  else {
    const pro = S.role !== 'user';
    const inChat = !!(S.chat && S.chat.open);      // в чате внизу и так занято полем ввода
    const inThread = S.page === 'inbox' && !!S.thread;
    /* поле ввода рисуем рядом с оболочкой, а не внутри ленты: так оно
       стоит на месте и не съезжает вместе с последним сообщением */
    const bar = S.sheet ? '' : inChat ? chatBar() : inThread ? threadBar() : '';
    setApp(`<div class="shell">${page()}</div>` + bar
      + (pro ? '' : nav() + (inChat || inThread ? '' : fab())) + roleSwitch(),
      S.sheet ? sheetSafe() : '');
  }
  if(s !== 'app' && s !== 'welcome') return;
  if(s === 'welcome') stars();
}

function scrWelcome(){
  return `<div class="sky"><canvas id="sky"></canvas></div>
  <div class="night" style="justify-content:center;text-align:center">
    <div class="anim-up" style="font-size:52px;line-height:1;margin-bottom:6px">✦</div>
    <h1 class="serif anim-up d1" style="font-size:46px;margin:0 0 14px">Eva Space</h1>
    <p class="muted anim-up d1" style="margin:0 0 34px;line-height:1.6">Платформа женского развития<br>с личной программой на каждый день</p>
    <div class="anim-up d2" style="text-align:left">
      <div class="small muted" style="margin-bottom:8px">Как тебя зовут?</div>
      <input class="field" id="nm" placeholder="Имя" value="${esc(S.name)}"
        style="background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.22);color:#fff"
        oninput="S.name=this.value" onkeydown="if(event.key==='Enter')startQuiz()">
    </div>
    <div style="flex:1"></div>
    <p class="small muted anim-up d3" style="margin-bottom:14px">6 коротких вопросов - и Ева соберёт программу<br>из аффирмаций, практик и мастер-классов</p>
    <button class="btn gold anim-up d3" onclick="startQuiz()">Начать</button>
  </div>`;
}

function scrQuiz(){
  const flow = quizFlow();
  const q = flow[Math.min(S.qi, flow.length-1)], sel = S.picked[S.qi] || [];
  const can = sel.length > 0;
  return `<div class="sky"><canvas id="sky"></canvas></div>
  <div class="night">
    <div class="spread" style="margin-bottom:18px">
      <button onclick="prevQ()" style="color:#fff;font-size:22px;width:34px;text-align:left">‹</button>
      <div class="small muted">${S.qi+1}/${flow.length}</div>
      <div style="width:34px"></div>
    </div>
    <div class="bar" style="background:rgba(255,255,255,.16);margin-bottom:24px"><i style="width:${(S.qi)/flow.length*100}%"></i></div>
    <h2 class="serif" style="font-size:30px;margin:0 0 6px">${q.q}</h2>
    <p class="small muted" style="margin:0 0 ${q.grid ? '14px' : '20px'}">${q.hint}${
      !sel.length ? '' : q.max === 0 ? ` · выбрано ${sel.length}`
        : q.max > 1 ? ` · выбрано ${sel.length} из ${q.max}` : ''}</p>
    <div style="flex:1">
      ${q.grid
        ? `<div class="tgrid">${q.o.map((o,i) => `
            <button class="ttile ${sel.includes(i)?'on':''}" onclick="pick(${i})">
              <span class="tico">${tIcon(o.topic, 15)}</span>
              <span class="tlab">${esc(o.t)}</span>
              <span class="tmark">${CHECK_SVG}</span>
            </button>`).join('')}</div>`
        : q.o.map((o,i) => `<button class="opt ${sel.includes(i)?'on':''}" onclick="pick(${i})">
            <i>${esc(o.e)}</i><span><b>${esc(o.t)}</b>${o.s?`<small>${o.s}</small>`:''}</span>
            ${sel.includes(i)?'<span style="margin-left:auto;color:var(--gold-soft)">✓</span>':''}
          </button>`).join('')}
    </div>
    <button class="btn gold" ${can?'':'disabled'} onclick="nextQ()">
      ${S.qi >= flow.length-1 ? 'Собрать мою программу' : 'Дальше'}</button>
  </div>`;
}

function scrBuilding(){
  return `<div class="sky"><canvas id="sky"></canvas></div>
  <div class="night" style="justify-content:center;text-align:center">
    <div style="font-size:46px;animation:up 1s infinite alternate">✦</div>
    <h2 class="serif" style="font-size:30px;margin:18px 0 10px">Ева собирает<br>твою программу</h2>
    <p class="small muted" id="bs">Читаю твои ответы</p>
    <div class="bar" style="background:rgba(255,255,255,.16);max-width:220px;margin:22px auto 0"><i id="bp" style="width:8%"></i></div>
  </div>`;
}

function scrReady(){
  const tags = S.tags.slice(0,6);
  return `<div class="sky"><canvas id="sky"></canvas></div>
  <div class="night" style="text-align:center">
    <div style="font-size:52px;margin-top:20px" class="anim-up">✦</div>
    <h2 class="serif anim-up d1" style="font-size:34px;margin:14px 0 12px">${esc(S.name||'Твоя')}, твоя<br>программа готова</h2>
    <p class="small muted anim-up d1">Ева просмотрела ${LIB.length} уроков и собрала<br>7 дней специально под твои ответы</p>

    <div class="anim-up d2" style="display:flex;gap:14px;align-items:center;background:rgba(255,255,255,.11);
      border:1px solid rgba(255,255,255,.18);border-radius:var(--r-lg);padding:16px;margin:22px 0;text-align:left">
      ${donut(S.match)}
      <div><b style="font-size:16px">совпадение с тобой</b>
        <div class="small muted">21 урок · 7 дней · ${S.time} мин в день</div></div>
    </div>

    <p class="small muted anim-up d2">Программа построена вокруг тем:</p>
    <div class="chips wrap anim-up d3" style="justify-content:center;margin-top:10px">
      ${tags.map(t => `<span class="chip" style="background:rgba(255,255,255,.13);color:#fff;box-shadow:none">${t}</span>`).join('')}
    </div>
    <div style="flex:1"></div>
    <button class="btn gold anim-up d3" onclick="enter()">Открыть личный кабинет</button>
  </div>`;
}

function donut(pct){
  const C = 2*Math.PI*26;
  return `<div style="position:relative;width:64px;height:64px;flex:none">
    <svg width="64" height="64" viewBox="0 0 64 64" style="transform:rotate(-90deg)">
      <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="5"/>
      <circle cx="32" cy="32" r="26" fill="none" stroke="var(--gold-soft)" stroke-width="5" stroke-linecap="round"
        stroke-dasharray="${C*pct/100} ${C}"/>
    </svg>
    <div style="position:absolute;inset:0;display:grid;place-items:center;font-size:14px;font-weight:800;color:var(--gold-soft)">${pct}%</div>
  </div>`;
}

/* ---------- действия онбординга ---------- */
function startQuiz(){
  if(!S.name.trim()) S.name = 'Ева';
  S.screen = 'quiz'; S.qi = 0; S.picked = []; S.tags = [];
  render(); stars();
}
function pick(i){
  const q = quizFlow()[S.qi]; let sel = S.picked[S.qi] || [];
  /* max не указан — один ответ; max:0 — сколько захочет */
  const max = q.max == null ? 1 : q.max;
  if(sel.includes(i)) sel = sel.filter(x => x !== i);
  else if(max === 1) sel = [i];
  else if(!max || sel.length < max) sel = [...sel, i];
  /* набрала максимум — вытесняем самый давний выбор, а не схлопываем список
     до двух: на вопросе с четырьмя вариантами так терялись ответы */
  else sel = [...sel.slice(1), i];
  S.picked[S.qi] = sel; render(); stars();
}
function prevQ(){
  if(S.qi === 0){ S.screen = 'welcome'; render(); return; }
  S.qi--; render(); stars();
}
function nextQ(){
  const flow = quizFlow();
  const q = flow[S.qi];
  S.answers = S.answers || {};
  /* направления собираем заново: женщина могла снять галочку и вернуться */
  if(q.grid) S.topics = [];
  const qw = (typeof QUIZ_W !== 'undefined' && QUIZ_W[q.id] != null) ? QUIZ_W[q.id] : 0.6;
  S.tagw = S.tagw || {};
  (S.picked[S.qi] || []).forEach(i => {
    const o = q.o[i];
    /* тег мог прийти из двух вопросов — оставляем больший вес */
    (o.tags || []).forEach(t => {
      if(!S.tags.includes(t)) S.tags.push(t);
      S.tagw[t] = Math.max(S.tagw[t] || 0, qw);
    });
    if(o.topic){ S.topics = S.topics || []; if(!S.topics.includes(o.topic)) S.topics.push(o.topic); }
    if(o.time) S.time = o.time;
    if(o.slot) S.slot = o.slot;
    if(o.extra) Object.assign(S.extra, o.extra);
    S.answers[q.id] = {t:o.t, next:o.next || null};
  });
  if(S.qi < quizFlow().length - 1){ S.qi++; render(); stars(); return; }
  if(!S.user){ S.screen = 'mail'; render(); stars(); return; }
  S.screen = 'building'; render(); stars();
  const steps = ['Читаю твои ответы','Сравниваю с '+LIB.length+' уроками библиотеки','Раскладываю на семь дней','Проверяю, что влезает в '+S.time+' минут'];
  persist();
  let k = 0;
  const iv = setInterval(() => {
    k++;
    const t = document.getElementById('bs'), p = document.getElementById('bp');
    if(t && steps[k]) t.textContent = steps[k];
    if(p) p.style.width = (8 + k*24) + '%';
    if(k >= 4){ clearInterval(iv); buildProgram(); S.screen = 'ready'; render(); stars(); }
  }, 780);
}
function enter(){
  startTrial(); S.screen = 'app'; S.tab = 'home'; render();
  /* в первый раз вместо всплывашки показываем подсказки: про три дня
     сказано на последнем шаге, две подсказки разом только мешают */
  if(S.tourDone) setTimeout(() => toast('Три дня бесплатного доступа открыты'), 700);
  else setTimeout(tourStart, 650);
}
/* ---------- роутер страниц ---------- */
function page(){
  if(S.role === 'admin') return pgAdmin();
  if(S.page === 'sub') return pgSub();
  if(S.viewGood) return pgGood();
  if(S.course) return S.course.mode === 'learn' ? pgCourseLearn() : pgCourseLanding();
  if(S.chat && S.chat.open) return pgChatRoom();
  if(S.role === 'expert' && S.page !== 'expertPublic') return pgExpertRoom();
  if(S.viewExpert) return pgExpertPage();
  if(S.page){
    const M = {report:pgReport, calendar:pgCalendar, profile:pgProfile, points:pgPoints, earn:pgEarn,
               settings:pgSettings, cart:pgCart, cycle:pgCycle, birth:pgBirth, inbox:pgInbox,
               groupAdmin:pgGroupAdmin};
    return (M[S.page] || pgProfile)();
  }
  return ({home:pgHome, content:pgContent, courses:pgCourses, market:pgMarket, club:pgClub})[S.tab]();
}

/* ---------- переключатель ролей (для разработки) ---------- */
/* инструмент разработки: с сервером его видит только администратор */
function roleSwitch(){
  if(SYNC.alive !== false && !(S.user && S.user.role === 'admin')) return '';
  const R = [['user','Пользователь'],['expert','Эксперт'],['admin','Админ']];
  return `<div class="rolesw">
    ${R.map(([k,l]) => `<button class="${S.role===k?'on':''}" onclick="setRole('${attJs(k)}')">${l}</button>`).join('')}
  </div>`;
}
function setRole(r){
  S.role = r; S.page = null; S.viewExpert = null; S.sheet = null; S.course = null;
  if(S.chat) S.chat.open = null;
  S.tab = 'home'; S.adminTab = 'content'; S.expTab = 'profile';
  if(!S.user) S.user = {email:'demo@evaspace.ru', name:S.name || 'Алиса'};
  if(S.screen !== 'app') S.screen = 'app';
  render(); window.scrollTo(0,0);
  toast(r === 'admin' ? 'Панель администратора' : r === 'expert' ? 'Кабинет эксперта' : 'Обычный пользователь');
}

function resetViews(){
  S.sheet = null; S.course = null; S.viewExpert = null; S.viewGood = null;
  S.editItem = null; S.editCourse = null; S.editUnit = null; S.gDraft = null;
  if(S.chat) S.chat.open = null;
}
function go(tab, pg){ resetViews(); S.tab = tab; S.page = pg || null; render(); window.scrollTo(0,0); }
function openPage(p){ resetViews(); S.page = p; render(); window.scrollTo(0,0); }
function back(){ resetViews(); S.page = null; render(); window.scrollTo(0,0); }
/* =====================================================================
   ТОЧЕЧНЫЕ ОБНОВЛЕНИЯ БЕЗ ПЕРЕРИСОВКИ
   Клик по тегу или цене не должен перестраивать экран и сбрасывать скролл.
   ===================================================================== */
function pathGet(obj, path){
  return path.split('.').reduce((o,k) => (o == null ? o : o[k]), obj);
}
function pathSet(obj, path, val){
  const ks = path.split('.'), last = ks.pop();
  const t = ks.reduce((o,k) => (o[k] = o[k] || {}), obj);
  t[last] = val;
}

/* переключает тег в массиве по пути в S и подсвечивает кнопку на месте */
function chipToggle(btn, path, value, counterSel){
  const arr = pathGet(S, path) || [];
  const on = arr.includes(value);
  const next = on ? arr.filter(x => x !== value) : [...arr, value];
  pathSet(S, path, next);
  btn.classList.toggle('on', !on);
  const mark = btn.querySelector('.x');
  if(mark) mark.textContent = on ? '' : ' ✕';
  if(counterSel){
    const c = document.querySelector(counterSel);
    if(c) c.textContent = next.length ? '(' + next.length + ')' : '';
  }
  schedulePersist();
}

/* выбор одного значения в группе кнопок */
function chipPick(btn, path, value){
  pathSet(S, path, value);
  const wrap = btn.parentElement;
  [...wrap.children].forEach(b => b.classList.toggle('on', b === btn));
  schedulePersist();
}

/* изменение числа с обновлением одного узла */
function stepValue(path, dir, outSel, fmt){
  const cur = pathGet(S, path) || 0;
  const idx = Math.round((cur - 490) / 500);
  const next = Math.max(0, idx + dir);
  const val = next === 0 ? 0 : 490 + next * 500;
  pathSet(S, path, val);
  const out = document.querySelector(outSel);
  if(out) out.textContent = val === 0 ? 'Бесплатно' : money(val);
  const manual = document.querySelector(outSel + '-input');
  if(manual) manual.value = val || '';
}

