/* =====================================================================
   ЛОГИКА ПРОГРАММЫ
   ===================================================================== */
function matchOf(item){
  const id = String(item && item.id || '');
  if(!S.tags.length) return 60 + (hash(id) % 25);
  const hits = (item && Array.isArray(item.tags) ? item.tags : []).filter(t => S.tags.includes(t)).length;
  const base = Math.round(hits / Math.max(1, Math.min(S.tags.length, 3)) * 62) + 30;
  return Math.max(52, Math.min(96, base + (hash(id) % 7)));
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
    return list.sort((a,b) => rank(b) - rank(a));
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

  /* мастер-классы стараемся не повторять: помним показанные */
  S.seenClasses = S.seenClasses || [];
  let freshMk = mk.filter(x => !S.seenClasses.includes(x.id));
  if(freshMk.length < 7){
    // всё показали — добавляем открытые уроки курсов, потом разрешаем повторы
    const lessons = openCourseLessons().filter(x => !S.seenClasses.includes(x.id));
    freshMk = freshMk.concat(lessons);
    if(freshMk.length < 7){ S.seenClasses = []; freshMk = mk.slice(); }
  }

  /* практики и аффирмации чередуем со сдвигом недели — повторы допустимы, но не подряд */
  const pickRotating = (list, i) => list[(i * 2 + shift * 3 + i) % list.length];

  S.program = DAYS.map((d,i) => ({
    d, tasks:[
      task(pickForDay(af, i, pickRotating), 'утро'),
      task(pickForDay(pr, i, pickRotating), slot),
      task(freshMk.filter(x => fitsDay(x, i))[i % Math.max(1, freshMk.filter(x => fitsDay(x, i)).length)]
           || freshMk[i % freshMk.length], 'вечер')
    ]
  }));
  S.program.forEach(day => {
    const c = day.tasks[2];
    if(c && !S.seenClasses.includes(c.id)) S.seenClasses.push(c.id);
  });
  S.stars = starsWeek();

  const all = S.program.flatMap(x => x.tasks);
  S.match = Math.round(all.reduce((a,t) => a + t.match, 0) / all.length);
  S.day = todayIdx();
}

function task(item, slot){
  return {...item, slot, pts:TYPE[item.type].pts, match:matchOf(item), done:false};
}

const todayIdx = () => (new Date().getDay() + 6) % 7;
const weekNo = () => Math.floor((Date.now() - new Date(new Date().getFullYear(),0,1)) / 6048e5);

/* при смене недели программа пересобирается на свежих материалах */
function checkWeek(){
  S.day = todayIdx();
  bumpVisit();
  const w = weekNo();
  if(S.week === undefined){ S.week = w; return; }
  if(S.week !== w){
    S.week = w; S.weekly.exchanged = false;
    buildProgram();
    toast('Новая неделя - Ева собрала свежую программу');
  }
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
  return true;
}

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
    setHTML(`<div class="shell">${page()}</div>` + (pro ? '' : nav() + fab()) + roleSwitch()
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
      ${q.o.map((o,i) => `<button class="opt ${sel.includes(i)?'on':''}" onclick="pick(${i})">
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
  else sel = [sel[1], i];
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
  (S.picked[S.qi] || []).forEach(i => {
    const o = q.o[i];
    (o.tags || []).forEach(t => { if(!S.tags.includes(t)) S.tags.push(t); });
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

