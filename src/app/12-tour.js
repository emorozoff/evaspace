/* =====================================================================
   ПЕРВОЕ ЗНАКОМСТВО
   Семь подсказок поверх живого приложения: экран притемняется, нужный
   блок остаётся светлым, рядом — карточка с объяснением. Так она сразу
   запоминает, где что лежит, а не читает пересказ о приложении.

   Подсказки живут отдельно от render(): свой слой в конце страницы,
   который перерисовка не трогает. Поэтому переход между шагами не
   пересобирает экран под ними.
   ===================================================================== */

const T_ICO = {
  spark: `<svg width="20" height="20" viewBox="0 0 100 100" aria-hidden="true">
    <path d="${STAR_PATH}" fill="currentColor"/></svg>`,
  day: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
    stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3.6"/>
    <path d="M12 3.2v2M12 18.8v2M3.2 12h2M18.8 12h2M5.9 5.9l1.4 1.4M16.7 16.7l1.4 1.4M18.1 5.9l-1.4 1.4M7.3 16.7l-1.4 1.4"/></svg>`,
  star: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
    stroke-width="1.6" stroke-linejoin="round" aria-hidden="true">
    <path d="m12 3.6 2.6 5.3 5.8.85-4.2 4.1 1 5.8-5.2-2.75-5.2 2.75 1-5.8-4.2-4.1 5.8-.85z"/></svg>`
};
const navIco = k => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
  stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${NAVI[k][1]}</svg>`;

/* at — что подсветить, tab — на какой вкладке это показывать.
   Последний шаг без подсветки: карточка выходит на середину экрана. */
const TOUR = [
  {tab:'home', at:'.hero', pad:0, ico:T_ICO.spark,
   h:'Это твоя программа',
   p:'Ева собрала семь дней под твои ответы. Каждый понедельник неделя обновляется — темы идут за тем, что происходит с тобой.'},

  {tab:'home', at:'#today', ico:T_ICO.day,
   h:'Три дела на день',
   p:'Утро, день и вечер: короткая аффирмация, практика и мастер-класс. Вместе — минут двадцать, не больше.'},

  {tab:'home', at:'.stats', round:15, ico:T_ICO.star,
   h:'Звёзды и баллы',
   p:'Отметила сделанное — получила звезду. Звёзды складываются в баллы, а баллы превращаются в бонусы на маркете.'},

  {tab:'content', at:'.nav [data-tab="content"]', round:15, pad:4, ico:navIco('content'),
   h:'Вся библиотека',
   p:'Аффирмации, практики и мастер-классы. Выбери направление — йога, медитация, отношения — и отмечай звёздочкой то, к чему захочешь вернуться.'},

  {tab:'courses', at:'.nav [data-tab="courses"]', round:15, pad:4, ico:navIco('courses'),
   h:'Курсы от экспертов',
   p:'Глубокие программы на несколько недель: видео, домашние задания и обратная связь от эксперта. Первый урок всегда открыт.'},

  {tab:'club', at:'.nav [data-tab="club"]', round:15, pad:4, ico:navIco('club'),
   h:'Ты здесь не одна',
   p:'Группы с экспертами, женские встречи в твоём городе, знакомства и послания участниц.'},

  {tab:'home', at:null, ico:T_ICO.spark, last:true,
   h:() => 'Удачи, ' + (S.name || 'Ева'),
   p:'Ты не обязана успевать всё. Начни с одного дела сегодня — три дня открыты полностью, а дальше Ева подстроится под твой темп.'}
];

function tourStart(){
  if(S.role !== 'user' || S.screen !== 'app') return;
  if(document.getElementById('tour')) return;
  S.tour = 0;
  const box = document.createElement('div');
  box.id = 'tour';
  box.innerHTML = `<div class="tveil"></div><div class="thole"></div><div class="ttip"></div>`;
  document.body.appendChild(box);
  window.addEventListener('resize', tourPlace);
  window.addEventListener('scroll', tourPlace, {passive:true});
  tourShow();
}

function tourShow(){
  const box = document.getElementById('tour');
  if(!box) return;
  const step = TOUR[S.tour];
  if(!step) return tourEnd();

  /* каждый шаг показываем на своём экране: она сразу видит, куда попадёт */
  if(step.tab && (S.tab !== step.tab || S.page || S.sheet)){
    S.page = null; S.sheet = null; S.course = null;
    if(S.chat) S.chat.open = null;
    S.tab = step.tab;
    render();
  }

  const dots = TOUR.map((_,i) => `<i class="${i <= S.tour ? 'on' : ''}"></i>`).join('');
  box.querySelector('.ttip').innerHTML = `
    <div class="tico">${step.ico}</div>
    <div class="tnum"><span>${S.tour + 1} / ${TOUR.length}</span><span class="tbars">${dots}</span></div>
    <h3>${esc(typeof step.h === 'function' ? step.h() : step.h)}</h3>
    <p>${esc(step.p)}</p>
    <div class="tacts">
      ${step.last ? '' : `<button class="tskip" onclick="tourEnd()">Пропустить</button>`}
      ${S.tour && !step.last ? `<button class="tback" onclick="tourBack()" aria-label="Назад">‹</button>` : ''}
      <button class="tgo" onclick="${step.last ? 'tourEnd()' : 'tourNext()'}">
        ${step.last ? 'Начать первый день' : 'Дальше'}</button>
    </div>`;
  tourPlace();
}

/* Закреплённые блоки — нижняя навигация — не прокручиваются вместе со
   страницей: их подсвечиваем там, где они стоят. */
function fixedEl(el){
  for(let n = el; n && n !== document.body; n = n.parentElement)
    if(getComputedStyle(n).position === 'fixed') return true;
  return false;
}

/* Считаем место каждый раз заново: экран мог прокрутиться, повернуться
   или перерисоваться, и подсветка обязана остаться на своём блоке. */
function tourPlace(){
  const box = document.getElementById('tour');
  if(!box) return;
  const step = TOUR[S.tour];
  if(!step) return;
  const hole = box.querySelector('.thole'), tip = box.querySelector('.ttip'),
        veil = box.querySelector('.tveil');
  const t = step.at ? document.querySelector(step.at) : null;
  const vh = window.innerHeight, vw = window.innerWidth, gap = 14, edge = 12;

  if(!t){
    hole.style.display = 'none';
    veil.style.display = '';
    tip.className = 'ttip mid';
    tip.style.top = '';
    return;
  }

  /* высоту карточки надо знать заранее: от неё зависит, сколько места
     останется подсветке и с какой стороны карточка встанет */
  tip.className = 'ttip';
  tip.style.top = '-9999px';
  const tipH = tip.offsetHeight || 210;
  const pad = step.pad == null ? 8 : step.pad;
  const room = Math.max(140, vh - tipH - 2*gap - 2*edge);

  if(!fixedEl(t)){
    const r0 = t.getBoundingClientRect();
    const a = edge, b = edge + room;
    if(r0.top < a || r0.bottom > b){
      /* блок выше экрана целиком не показать — подводим его верх под край */
      let want = window.scrollY + r0.top - a;
      if(r0.height < room) want -= (room - r0.height) / 2;
      window.scrollTo(0, Math.max(0, want));
    }
  }

  const r = t.getBoundingClientRect();
  /* к краю экрана прижимаемся вплотную: иначе поверх шапки, которая и так
     начинается от нуля, рисуется белая полоска обводки */
  const top = r.top - pad;
  /* длинный блок подсвечиваем не весь: карточке тоже нужно место */
  const bot = Math.min(vh, top + room, r.bottom + pad);
  hole.style.display = '';
  veil.style.display = 'none';
  hole.style.left = (r.left - pad) + 'px';
  hole.style.top = top + 'px';
  hole.style.width = Math.min(vw, r.width + pad*2) + 'px';
  hole.style.height = Math.max(28, bot - top) + 'px';
  /* без явного скругления повторяем форму самого блока — подсветка садится
     на него как влитая */
  hole.style.borderRadius = step.round != null ? step.round + 'px'
    : pad ? '20px' : (getComputedStyle(t).borderRadius || '20px');

  /* карточку ставим с той стороны, где для неё есть место */
  if(bot + gap + tipH <= vh - edge){
    tip.classList.add('below');
    tip.style.top = (bot + gap) + 'px';
  } else if(top - gap - tipH >= edge){
    tip.classList.add('above');
    tip.style.top = (top - gap - tipH) + 'px';
  } else {
    tip.classList.add('mid');
    tip.style.top = '';
  }

  /* остриё смотрит в середину подсветки, но не сползает с карточки */
  const tr = tip.getBoundingClientRect();
  const x = Math.min(Math.max(r.left + r.width/2 - tr.left - 8, 20), tr.width - 36);
  tip.style.setProperty('--ax', x + 'px');
}

function tourNext(){ S.tour++; S.tour < TOUR.length ? tourShow() : tourEnd(); }
function tourBack(){ if(S.tour > 0){ S.tour--; tourShow(); } }

function tourEnd(){
  const box = document.getElementById('tour');
  if(box) box.remove();
  window.removeEventListener('resize', tourPlace);
  window.removeEventListener('scroll', tourPlace);
  S.tour = null;
  S.tourDone = true;
  S.tab = 'home'; S.page = null;
  render(); window.scrollTo(0, 0);
  schedulePersist();
}

/* показать подсказки заново — из настроек */
function tourAgain(){
  S.sheet = null; S.page = null; S.tab = 'home';
  render(); window.scrollTo(0, 0);
  setTimeout(tourStart, 60);
}
