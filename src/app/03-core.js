/* =====================================================================
   ЛОГИКА ПРОГРАММЫ
   ===================================================================== */
function matchOf(item){
  const id = String(item && item.id || '');
  const near = topicHit(item) ? 8 : 0;          // выбранное направление поднимает совпадение
  if(!S.tags.length) return Math.min(96, 60 + (hash(id) % 25) + near);
  const hits = (item && Array.isArray(item.tags) ? item.tags : []).filter(t => S.tags.includes(t)).length;
  const base = Math.round(hits / Math.max(1, Math.min(S.tags.length, 3)) * 62) + 30;
  return Math.max(52, Math.min(96, base + near + (hash(id) % 7)));
}

/* попадает ли материал в выбранные ею направления */
function topicHit(item){
  const mine = S.topics || [];
  if(!mine.length) return false;
  const his = (item && Array.isArray(item.topics)) ? item.topics : [];
  return his.some(t => mine.indexOf(t) >= 0);
}

/* подходит ли материал пользовательнице по этапу жизни и уровню */
function fitsAudience(item){
  const mine = myAudience();
  const aud = item.aud || [];
  const cy = typeof cycleNow === 'function' ? cycleNow() : null;
  const inPeriod = cy && cy.phase.k === 'menstrual';

  // активные практики не предлагаем в дни менструации
  if(inPeriod && aud.includes('active')) return false;

  // материал без разметки подходит всем
  if(!aud.length) return true;

  // строгие группы: если материал помечен ими, он только для них
  const strict = ['pregnant','newborn','toddler'];
  const strictTags = aud.filter(k => strict.includes(k));
  if(strictTags.length && !strictTags.some(k => mine.includes(k))) return false;

  // беременным не показываем материалы, помеченные как активные
  if(mine.includes('pregnant') && aud.includes('active')) return false;

  const soft = aud.filter(k => !strict.includes(k) && k !== 'active' && k !== 'period');
  if(soft.length && !soft.some(k => mine.includes(k))) return false;
  return true;
}

/* уровень подготовки: новичку не даём продвинутое */
function fitsLevel(item){
  const lvl = item.level || 'any';
  if(lvl === 'any') return true;
  const mine = S.tags.includes('опыт') ? 'pro' : S.tags.includes('новичок') ? 'new' : 'middle';
  if(mine === 'new') return false;
  if(mine === 'middle') return lvl !== 'pro';
  return true;
}

function fitsTime(item){
  if(S.time >= 35) return true;
  if(S.time >= 20) return item.min <= 34;
  return item.type === 'class' ? item.min <= 28 : item.min <= 12;
}

function buildProgram(){
  const shift = (S.seed || 0) + (S.week || 0);
  const rank = a => matchOf(a);

  /* отбор: время, этап жизни, уровень. Если после фильтров пусто — ослабляем условия */
  const byType = t => {
    const all = LIB.filter(x => x.type === t && x.status === 'live');
    let list = all.filter(x => fitsTime(x) && fitsAudience(x) && fitsLevel(x));
    if(list.length < 3) list = all.filter(x => fitsAudience(x));
    if(list.length < 3) list = all;
    /* Порядок такой: сначала очередь, которую задала редакция (меньше число —
       раньше), потом выбранные ею направления, потом совпадение по тегам. */
    const q = x => (+x.ord > 0 ? +x.ord : 9999);
    return list.sort((a,b) =>
      (q(a) - q(b)) ||
      ((topicHit(b) ? 1 : 0) - (topicHit(a) ? 1 : 0)) ||
      (rank(b) - rank(a)));
  };
  const af = byType('affirm'), pr = byType('practice'), mk = byType('class');
  const slot = S.slot;

  /* материалы, привязанные к конкретному дню недели */
  const fitsDay = (item, i) => !item.days || !item.days.length || item.days.includes(DAY_KEYS[i]);
  const pickForDay = (list, i, fallbackPick) => {
    const fixed = list.filter(x => x.days && x.days.length && x.days.includes(DAY_KEYS[i]));
    if(fixed.length) return fixed[(i + shift) % fixed.length];
    const free = list.filter(x => !x.days || !x.days.length);
    return fallbackPick(free.length ? free : list, i);
  };

  /* Мастер-классы на неделю. Порядок такой:
     1) те, которых она ещё не видела;
     2) когда кончились — открытые уроки курсов;
     3) в крайнем случае повторы, начиная с самых давних.
     Внутри одной недели материал не повторяется никогда. */
  S.seenClasses = S.seenClasses || [];
  const classPool = weekClasses(mk, DAYS.length + 3);

  /* практики и аффирмации чередуем со сдвигом недели — повторы допустимы, но не подряд */
  const pickRotating = (list, i) => list[(i * 2 + shift * 3 + i) % list.length];

  /* материал, привязанный к дню недели, важнее очереди; остальное — по очереди */
  const usedClasses = [];

  S.program = DAYS.map((d,i) => ({
    d, tasks:[
      task(pickForDay(af, i, pickRotating), 'утро'),
      task(pickForDay(pr, i, pickRotating), slot),
      task(classForDay(mk, classPool, i, shift, usedClasses), 'вечер')
    ]
  }));
  /* показанное запоминаем: недавние — в конце списка, чтобы при нехватке
     материала повторялись самые давние, а не одни и те же */
  S.program.forEach(day => {
    const c = day.tasks[2];
    if(!c) return;
    const at = S.seenClasses.indexOf(c.id);
    if(at >= 0) S.seenClasses.splice(at, 1);
    S.seenClasses.push(c.id);
  });
  if(S.seenClasses.length > 300) S.seenClasses = S.seenClasses.slice(-300);
  S.stars = starsWeek();

  const all = S.program.flatMap(x => x.tasks);
  S.match = Math.round(all.reduce((a,t) => a + t.match, 0) / all.length);
  S.day = todayIdx();
}

/* Список мастер-классов на неделю без повторов.
   Сначала неувиденное, потом открытые уроки курсов, потом самые давние. */
/* Мастер-класс на конкретный день: сначала привязанный к этому дню недели,
   иначе следующий из очереди, который сегодня ещё не занят. */
function classForDay(mk, pool, i, shift, used){
  const fixed = mk.filter(x => x.days && x.days.length && x.days.includes(DAY_KEYS[i])
                            && used.indexOf(x.id) < 0);
  const pick = fixed.length ? fixed[(i + shift) % fixed.length]
                            : pool.find(x => used.indexOf(x.id) < 0)
                              || pool[i % Math.max(1, pool.length)]
                              || mk[i % Math.max(1, mk.length)];
  if(pick) used.push(pick.id);
  return pick;
}

function weekClasses(mk, count){
  const shown = S.seenClasses || [];
  const lessons = (typeof openCourseLessons === 'function') ? openCourseLessons() : [];
  const allMk = LIB.filter(x => x.type === 'class' && x.status === 'live');
  const uniq = [];
  const add = list => list.forEach(x => { if(x && !uniq.some(u => u.id === x.id)) uniq.push(x); });

  add(mk.filter(x => shown.indexOf(x.id) < 0));         // подходящие и ещё не показанные
  add(allMk.filter(x => shown.indexOf(x.id) < 0));      // остальные мастер-классы
  add(lessons.filter(x => shown.indexOf(x.id) < 0));    // открытые уроки курсов
  if(uniq.length < count){                              // всё показано — идут повторы
    const rest = allMk.concat(lessons).filter(x => !uniq.some(u => u.id === x.id));
    rest.sort((a, b) => shown.indexOf(a.id) - shown.indexOf(b.id));   // сначала самые давние
    add(rest);
  }
  return uniq.slice(0, Math.max(count, 1));
}

function task(item, slot){
  return {...item, slot, pts:TYPE[item.type].pts, match:matchOf(item), done:false};
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
    S.week = w;
    S.weekly.exchanged = false;          // обмен баллов снова доступен
    S.stars = 0;                          // звёзды недели считаются заново
    buildProgram();                       // программа пересобирается на свежем
    if(!quiet) toast('Новая неделя - Ева собрала свежую программу');
    if(typeof schedulePersist === 'function') schedulePersist();
    return true;
  }
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
      if(need) render();
    } catch(e){ console.error('[Eva] смена дня:', e); }
  }, 60000);
}
function nextWeek(){
  S.week = weekNo() - 1;
  S.seed = (S.seed || 0) + 1;
  checkWeek(); render();
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
      shownHTML = null;                          // после падения показываем заново в любом случае
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
let shownHTML = null;
window.__renders = 0; window.__skipped = 0;
function setHTML(html){
  if(html === shownHTML){ window.__skipped++; return false; }
  shownHTML = html; el.innerHTML = html; window.__renders++;
  deskArrows();
  return true;
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
    setHTML(`<div class="shell">${page()}</div>` + bar
      + (pro ? '' : nav() + (inChat || inThread ? '' : fab())) + roleSwitch()
      + (S.sheet ? sheetSafe() : ''));
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
    <p class="small muted" style="margin:0 0 20px">${q.hint}</p>
    <div style="flex:1">
      ${q.grid
        ? `<div class="tgrid">${q.o.map((o,i) => `
            <button class="ttile ${sel.includes(i)?'on':''}" style="--tc:${safeColor(o.c)}"
              onclick="pick(${i})">
              <span class="tico">${tIcon(o.topic, 26)}</span>
              <span class="tlab">${esc(o.t)}</span>
              ${sel.includes(i) ? '<span class="tmark">✓</span>' : ''}
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
  if(sel.includes(i)) sel = sel.filter(x => x !== i);
  else if(q.max === 1) sel = [i];
  else if(sel.length < q.max) sel = [...sel, i];
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
  (S.picked[S.qi] || []).forEach(i => {
    const o = q.o[i];
    (o.tags || []).forEach(t => { if(!S.tags.includes(t)) S.tags.push(t); });
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
function enter(){ startTrial(); S.screen = 'app'; S.tab = 'home'; render();
  setTimeout(() => toast('Три дня бесплатного доступа открыты'), 700); }
function skipAll(){ S.name='Гостья'; S.tags=['спокойствие','тревога','уверенность']; buildProgram(); S.screen='app'; render(); }

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
               settings:pgSettings, cart:pgCart, moon:pgMoon, cycle:pgCycle, birth:pgBirth, inbox:pgInbox};
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
function selDay(i){ if(i > todayIdx()) return toast('Этот день откроется позже'); S.day = i; render(); }

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

