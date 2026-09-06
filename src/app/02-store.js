/* =====================================================================
   ХРАНИЛИЩЕ И АККАУНТЫ
   Работает поверх localStorage там, где он доступен (GitHub Pages,
   свой домен). В песочницах без доступа автоматически падает в память,
   поэтому приложение нигде не ломается.
   ===================================================================== */
const Store = (() => {
  let ok = false, mem = {};
  try {
    const k = '__eva_test__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    ok = true;
  } catch(e){ ok = false; }
  return {
    available: ok,
    get(key, def){
      try {
        const raw = ok ? window.localStorage.getItem(key) : mem[key];
        return raw ? JSON.parse(raw) : def;
      } catch(e){ return def; }
    },
    set(key, val){
      const raw = JSON.stringify(val);
      try { ok ? window.localStorage.setItem(key, raw) : (mem[key] = raw); } catch(e){ mem[key] = raw; }
    },
    del(key){
      try { ok ? window.localStorage.removeItem(key) : delete mem[key]; } catch(e){}
    }
  };
})();

const DB = {
  users(){ return Store.get('eva_users', {}); },
  saveUsers(u){ Store.set('eva_users', u); },
  find(email){ return this.users()[String(email).toLowerCase().trim()] || null; },
  upsert(u){
    const all = this.users();
    all[u.email.toLowerCase()] = u;
    this.saveUsers(all);
    if(typeof syncUser === 'function') syncUser(u);
  },
  session(){ return Store.get('eva_session', null); },
  setSession(s){ Store.set('eva_session', s); },
  clearSession(){ Store.del('eva_session'); },
  progress(email){ return Store.get('eva_progress_' + email.toLowerCase(), null); },
  saveProgress(email, data){ Store.set('eva_progress_' + email.toLowerCase(), data); }
};

/* примитивный хеш пароля — не криптография, а защита от чтения глазами.
   На бою пароль хешируется на сервере (bcrypt/argon2), см. README. */
function hashPass(p){
  let h = 5381;
  for(let i = 0; i < p.length; i++) h = ((h << 5) + h + p.charCodeAt(i)) >>> 0;
  return 'h' + h.toString(36) + p.length;
}

/* ---------- подтверждение почты ---------- */
const genCode = () => String(Math.floor(100000 + Math.random()*900000));

/* Отправка письма. В прототипе код показывается на экране.
   Для боевой версии подключается один из вариантов (см. README):
   EmailJS, Resend, Supabase Auth, Firebase Auth. */
async function sendVerificationEmail(email, code){
  if(window.EVA_MAIL && typeof window.EVA_MAIL.send === 'function'){
    try { await window.EVA_MAIL.send(email, code); return true; } catch(e){ return false; }
  }
  console.info('[Eva] Код подтверждения для ' + email + ': ' + code);
  return false;
}

/* ---------- сохранение прогресса ---------- */
function persist(){
  if(!S.user || !S.user.email) return;
  DB.saveProgress(S.user.email, {
    name:S.name, tags:S.tags, topics:S.topics, time:S.time, slot:S.slot, answers:S.answers, extra:S.extra,
    points:S.points, stars:S.stars, starsAll:S.starsAll, bonus:S.bonus, streakDays:S.streakDays,
    courses:S.courses, purchases:S.purchases, joined:S.joined, clubs:S.clubs, avatar:S.avatar,
    birth:S.birth, cycle:S.cycle, hd:S.hd, sub:S.sub, week:S.week, seed:S.seed,
    program:S.program, day:S.day, match:S.match, homework:S.homework, events:S.myEvents,
    inbox:S.inbox, seenReplies:S.seenReplies, myInts:S.myInts, datingProfile:S.datingProfile,
    starred:S.starred, starredCmts:S.starredCmts, likes:S.likes, visits:S.visits, gentle:S.gentle,
    /* без этого после перезагрузки терялась память о показанных мастер-классах
       и об обмене баллов: классы шли по кругу, а обмен можно было повторять */
    seen:S.seen, tagw:S.tagw, weekly:S.weekly, seenDm:S.seenDm, streak:S.streak,
    evChain:S.evChain, evFast:S.evFast, reviews:S.reviews, tourDone:S.tourDone,
    lastWeek:S.lastWeek, weekShown:S.weekShown, weekMood:S.weekMood,
    nudgedWeek:S.nudgedWeek, gdraft:S.gdraft,
    quietRun:S.quietRun, askedBlock:S.askedBlock,
    pushOn:S.pushOn, pushAsked:S.pushAsked, tipStars:S.tipStars,
    follows:S.follows, mates:S.mates, expSeen:S.expSeen, about:S.about, city:S.city, show:S.show,
    savedAt:Date.now()
  });
}
/* Всё, что принадлежит одной женщине. Раньше вход в другой аккаунт только
   накладывал сверху сохранённое: чего у новой хозяйки не было - анкеты
   знакомств, записей на встречи, переписки с Евой - оставалось от прошлой.
   Теперь перед восстановлением личные поля возвращаются к исходным. */
const PERSONAL = ['name','tags','topics','time','slot','answers','extra','points','stars','starsAll',
  'bonus','streakDays','streak','courses','purchases','cart','joined','clubs','owned','avatar','birth',
  'cycle','hd','hdAnswers','hdi','sub','week','seed','program','day','match','homework','myEvents',
  'inbox','seenReplies','seenDm','myInts','datingProfile','starred','starredCmts','likes','visits',
  'gentle','seen','tagw','weekly','evChain','evFast','reviews','tourDone','tour','lastWeek','weekShown',
  'weekMood','nudgedWeek','gdraft','quietRun','askedBlock','pushOn','pushAsked','tipStars','follows','mates','expSeen','about','city','show',
  'qi','picked','eva'];

let PRISTINE = null;
/* снимок нетронутого состояния - делается один раз, при загрузке */
function keepPristine(){
  if(PRISTINE) return;
  PRISTINE = {};
  PERSONAL.forEach(k => { PRISTINE[k] = (k in S) ? JSON.stringify(S[k]) : undefined; });
}
function wipePersonal(){
  keepPristine();
  PERSONAL.forEach(k => {
    if(PRISTINE[k] === undefined) delete S[k];
    else S[k] = JSON.parse(PRISTINE[k]);
  });
}

function restore(email){
  const d = DB.progress(email);
  wipePersonal();
  if(!d) return false;
  Object.keys(d).forEach(k => {
    if(k === 'events') S.myEvents = d[k] || [];
    else if(d[k] !== undefined && d[k] !== null) S[k] = d[k];
  });
  /* Старая память о показанном была списком одних мастер-классов.
     Переносим её в общую: порядок в списке был от давних к недавним. */
  if(!S.seen && Array.isArray(d.seenClasses)){
    S.seen = {};
    const w = S.week || 0, n = d.seenClasses.length;
    d.seenClasses.forEach((id, i) => { S.seen[id] = w - Math.ceil((n - i) / 3); });
  }
  return true;
}

/* автосохранение после любого изменения */
let persistTimer = null;
function schedulePersist(){
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persist();
    if(typeof pushProgress === 'function') pushProgress();
  }, 600);
}

/* =====================================================================
   ЛУНА, ГОРОСКОП, ЦИКЛ, HUMAN DESIGN
   Развлекательный слой: расчёты упрощённые, не астрономические.
   ===================================================================== */

/* ---------- фаза луны ---------- */
const MOONS = [
  {n:'Новолуние',        e:'🌑', s:'Время замыслов. Хорошо начинать и плохо требовать от себя результатов.'},
  {n:'Растущий серп',    e:'🌒', s:'Появляются силы. Маленькие шаги сейчас идут легче обычного.'},
  {n:'Первая четверть',  e:'🌓', s:'Момент решений. Если что-то откладывала - сегодня проще сдвинуть.'},
  {n:'Растущая луна',    e:'🌔', s:'Пик энергии на подъёме. Можно взять чуть больше, чем обычно.'},
  {n:'Полнолуние',       e:'🌕', s:'Всё чувствуется ярче, включая раздражение. Береги нервы и сон.'},
  {n:'Убывающая луна',   e:'🌖', s:'Хорошо завершать, а не начинать. Разбор, уборка, точки.'},
  {n:'Последняя четверть',e:'🌗',s:'Время отпускать. Спроси себя, что можно перестать делать.'},
  {n:'Старая луна',      e:'🌘', s:'Низкая энергия - это норма фазы. Отдых сейчас продуктивнее усилия.'}
];

function moonAge(d = new Date()){
  const lp = 29.530588853;
  const known = Date.UTC(2000,0,6,18,14);
  return (((d.getTime() - known) / 86400000) % lp + lp) % lp;
}
function moon(d = new Date()){
  const a = moonAge(d);
  const i = Math.floor((a / 29.530588853) * 8 + 0.5) % 8;
  return {...MOONS[i], age:Math.round(a), pct:Math.round((1 - Math.abs(a/29.530588853*2 - 1)) * 100)};
}

/* ---------- знак зодиака ---------- */
const ZOD = [
  ['Козерог','♑',1,19,'земля'],['Водолей','♒',2,18,'воздух'],['Рыбы','♓',3,20,'вода'],
  ['Овен','♈',4,19,'огонь'],['Телец','♉',5,20,'земля'],['Близнецы','♊',6,20,'воздух'],
  ['Рак','♋',7,22,'вода'],['Лев','♌',8,22,'огонь'],['Дева','♍',9,22,'земля'],
  ['Весы','♎',10,22,'воздух'],['Скорпион','♏',11,21,'вода'],['Стрелец','♐',12,21,'огонь'],
  ['Козерог','♑',12,31,'земля']
];
function zodiac(iso){
  if(!iso) return null;
  const d = new Date(iso); if(isNaN(d)) return null;
  const m = d.getMonth()+1, day = d.getDate();
  for(const [n,e,mm,dd,el] of ZOD) if(m === mm && day <= dd) return {n,e,el};
  return {n:'Козерог', e:'♑', el:'земля'};
}

const ZTIPS = {
  огонь:['Сегодня хочется действовать - направь это в одно дело, а не в пять.',
         'Твой запал сильный, но короткий. Начни с самого важного.',
         'Есть риск сгореть об чужие задачи. Спроси себя, чья это цель.'],
  земля:['Тебе сейчас нужна опора в теле, а не новые планы. Начни с практики.',
         'Хороший день для порядка: в делах, в комнате, в голове.',
         'Не торопи себя. Твой темп медленный и надёжный, это не недостаток.'],
  воздух:['Мыслей много, тела мало. Сначала подыши, потом решай.',
          'Хороший день для разговора, который ты откладывала.',
          'Информации будет больше, чем нужно. Разреши себе не всё читать.'],
  вода:['Чувства сегодня громче обычного. Это данные, а не приговор.',
        'Хороший день для тишины и воды - буквально.',
        'Твоя чувствительность считывает чужое настроение. Проверь, точно ли оно твоё.']
};
function zodTip(z, d = new Date()){
  if(!z) return null;
  const arr = ZTIPS[z.el];
  return arr[(d.getDate() + hash(z.n)) % arr.length];
}

/* ---------- цикл ---------- */
const PHASES = [
  {k:'menstrual', n:'Менструальная', e:'🌑', c:'#B64F7C',
   s:'Энергии меньше - это физиология, а не лень. Мягкие практики, тепло, сон.'},
  {k:'follicular', n:'Фолликулярная', e:'🌒', c:'#8054B8',
   s:'Силы возвращаются. Хорошее время начинать и пробовать новое.'},
  {k:'ovulation', n:'Овуляторная', e:'🌕', c:'#CD9A4E',
   s:'Пик энергии и общительности. Сложные разговоры лучше вести сейчас.'},
  {k:'luteal', n:'Лютеиновая', e:'🌘', c:'#5E5FA8',
   s:'Чувствительность растёт, силы убывают. Снижай требования к себе заранее.'}
];

function cycleNow(){
  const c = S.cycle;
  if(!c || !c.last) return null;
  const start = new Date(c.last), today = new Date();
  start.setHours(0,0,0,0); today.setHours(0,0,0,0);
  let day = Math.floor((today - start)/86400000) % c.len;
  if(day < 0) day += c.len;
  const p = day < c.period ? PHASES[0]
          : day < Math.round(c.len/2) - 2 ? PHASES[1]
          : day <= Math.round(c.len/2) + 1 ? PHASES[2] : PHASES[3];
  const next = c.len - day;
  return {day:day+1, phase:p, next, len:c.len};
}

/* ---------- human design (упрощённо) ---------- */
const HD = {
  gen:{n:'Генератор', s:'Ты создана откликаться. Спрашивай себя «да или нет» телом, а не головой.',
       str:'Устойчивая энергия, когда дело откликается', warn:'Соглашаться из вежливости и потом выгорать'},
  mg: {n:'Манифестирующий генератор', s:'Тебе можно делать несколько дел сразу и бросать то, что перестало откликаться.',
       str:'Скорость и многозадачность', warn:'Разгон без отклика - и злость на середине пути'},
  man:{n:'Манифестор', s:'Ты инициируешь. Твоя задача - предупреждать других, а не спрашивать разрешения.',
       str:'Умение начать первой', warn:'Гнев, когда приходится объясняться'},
  proj:{n:'Проектор', s:'Твоя сила - видеть систему и людей. Работает по приглашению, а не по натиску.',
       str:'Глубина и точность', warn:'Горечь, когда стараешься, а не замечают'},
  refl:{n:'Рефлектор', s:'Ты зеркало среды. Тебе особенно важно, с кем и где ты находишься.',
       str:'Чуткость к обстановке', warn:'Решения на скорую руку - тебе нужен лунный цикл'}
};
const HD_Q = [
  {q:'Как чаще всего начинаются твои дела?', o:[
    {t:'Я откликаюсь на то, что предложили', v:'gen'},
    {t:'Я сама придумываю и запускаю', v:'man'},
    {t:'Я жду, когда позовут, и тогда включаюсь', v:'proj'},
    {t:'По-разному, зависит от места и людей', v:'refl'}]},
  {q:'Что происходит к вечеру обычного дня?', o:[
    {t:'Устаю приятно, если день был по мне', v:'gen'},
    {t:'Часто перескакиваю между делами и не всё дохожу', v:'mg'},
    {t:'Выдыхаюсь быстрее других и мне нужно одной', v:'proj'},
    {t:'Зависит от того, с кем провела день', v:'refl'}]},
  {q:'Какое чувство знакомо тебе больше всего?', o:[
    {t:'Злость, когда взялась не за своё', v:'gen'},
    {t:'Гнев, когда нужно объясняться и просить', v:'man'},
    {t:'Горечь, когда стараюсь, а не ценят', v:'proj'},
    {t:'Разочарование от неподходящего окружения', v:'refl'}]},
  {q:'Как ты принимаешь важные решения?', o:[
    {t:'Тело сразу говорит да или нет', v:'gen'},
    {t:'Решаю быстро и сразу иду делать', v:'mg'},
    {t:'Мне нужно всё обдумать и обсудить', v:'proj'},
    {t:'Мне нужно время, иногда недели', v:'refl'}]}
];

function hdCalc(answers){
  const c = {};
  answers.forEach(v => c[v] = (c[v]||0)+1);
  let best = 'gen', n = 0;
  Object.entries(c).forEach(([k,v]) => { if(v > n){ n = v; best = k; } });
  if(best === 'gen' && c.mg) best = 'mg';
  return best;
}

/* ---------- сцена времени суток ---------- */
function daypart(){
  const h = new Date().getHours();
  if(h < 5)  return 'night';
  if(h < 11) return 'dawn';
  if(h < 17) return 'day';
  if(h < 21) return 'sunset';
  return 'night';
}

const SCENES = {
  dawn:  {g:'linear-gradient(168deg,#2A2036 0%,#5B3550 46%,#B2705C 100%)', n:'Утро', e:'☀'},
  day:   {g:'linear-gradient(168deg,#241F33 0%,#3E3358 46%,#7C6A93 100%)', n:'День', e:'☀'},
  sunset:{g:'linear-gradient(168deg,#1E1826 0%,#4A2740 45%,#A8563F 100%)', n:'Закат', e:'☾'},
  night: {g:'linear-gradient(168deg,#141019 0%,#241C33 50%,#3B2A45 100%)', n:'Вечер', e:'☾'}
};

/* Мягкая сцена в шапке: светило у горизонта и лёгкая дымка, без «пузырей» */
function sceneSVG(part){
  const night = part === 'night' || part === 'sunset';
  const lightY = part === 'day' ? 26 : 44;
  const lightC = part === 'dawn' ? '#FFD9A8' : part === 'day' ? '#FFF1D6' : part === 'sunset' ? '#FFC49A' : '#EFE6FF';
  const stars = night ? [...Array(26)].map((_,i) => {
    const x = (i*137)%100, y = (i*53)%42, r = (i%3)*0.22+0.28;
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${.22+(i%4)*.12}"/>`;
  }).join('') : '';
  return `<svg viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true"
    style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none">
    <defs>
      <radialGradient id="glow${part}" cx="50%" cy="50%">
        <stop offset="0" stop-color="${lightC}" stop-opacity=".34"/>
        <stop offset="1" stop-color="${lightC}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="haze${part}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity="0"/>
        <stop offset="1" stop-color="#fff" stop-opacity=".08"/>
      </linearGradient>
    </defs>
    ${stars}
    <ellipse cx="8" cy="6" rx="22" ry="13" fill="url(#glow${part})" opacity=".45"/>
    <path d="M0 46 C 22 41, 46 49, 68 45 C 84 42, 92 45, 100 43 V60 H0Z" fill="url(#haze${part})"/>
  </svg>`;
}

/* ---------- пожелание дня ---------- */
/* ---------- аватары-портреты ---------- */
function portrait(seed, size, tag){
  const n = hash(seed), [c1,c2] = PAL[n % PAL.length], g = 'pt'+n.toString(36);
  const skin = ['#F2D2BE','#E8BFA4','#D9A583','#C08A66'][n % 4];
  const hair = ['#3A2418','#6B4226','#2E1B36','#8A5A3B','#B0705A'][n % 5];
  const long = n % 3;
  return `<svg viewBox="0 0 100 100"${tag || ''} style="width:${size||'100%'};height:${size||'100%'};display:block">
    <defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
    <rect width="100" height="100" fill="url(#${g})"/>
    ${long===0 ? `<path d="M26 46c0-16 10-26 24-26s24 10 24 26v34H26Z" fill="${hair}"/>` :
      long===1 ? `<path d="M28 44c0-15 9-24 22-24s22 9 22 24v20c0 8-6 12-10 12H38c-4 0-10-4-10-12Z" fill="${hair}"/>` :
                 `<path d="M30 42c0-14 9-22 20-22s20 8 20 22v8c6 6 8 18 6 30H24c-2-12 0-24 6-30Z" fill="${hair}"/>`}
    <path d="M42 60h16v14H42Z" fill="${skin}"/>
    <ellipse cx="50" cy="48" rx="16" ry="19" fill="${skin}"/>
    <path d="M34 44c2-12 8-18 16-18s14 6 16 18c-4-6-9-9-16-9s-12 3-16 9Z" fill="${hair}"/>
    <circle cx="44" cy="48" r="1.8" fill="#3A2418"/><circle cx="56" cy="48" r="1.8" fill="#3A2418"/>
    <path d="M46 56q4 3 8 0" stroke="#B4756A" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <path d="M30 100c2-14 9-22 20-22s18 8 20 22Z" fill="#fff" opacity=".9"/>
  </svg>`;
}

/* ---------- диск луны ---------- */
function moonDisc(m, size){
  const s = size || 58, a = m.age / 29.530588853;
  const waxing = a < 0.5;
  const k = Math.abs(Math.cos(a * 2 * Math.PI));
  const rx = Math.max(0.5, k * s/2);
  const lit = a < 0.02 || a > 0.98 ? 0 : 1;
  return `<div class="moondisc" style="width:${s}px;height:${s}px">
    <svg viewBox="0 0 100 100" style="position:absolute;inset:0;width:100%;height:100%">
      <defs><clipPath id="mc${s}"><circle cx="50" cy="50" r="49"/></clipPath></defs>
      <g clip-path="url(#mc${s})">
        <circle cx="50" cy="50" r="49" fill="#1B1822"/>
        ${lit ? `<path d="M50 1 A49 49 0 0 ${waxing?1:0} 50 99 Z" fill="#F2E5C8"/>
        <ellipse cx="50" cy="50" rx="${rx/s*100}" ry="49"
          fill="${(a<0.25||a>0.75)?'#1B1822':'#F2E5C8'}"/>` : ''}
        <circle cx="34" cy="38" r="7" fill="rgba(0,0,0,.07)"/>
        <circle cx="62" cy="60" r="9" fill="rgba(0,0,0,.06)"/>
      </g>
    </svg></div>`;
}

/* ---------- короткий персональный текст дня ---------- */
/* Раньше день был разложен по трём плашкам — фаза луны, знак, цикл — и
   ни одна ничего толком не объясняла. Теперь это несколько связных фраз:
   что за фаза, что она значит для её стихии и на каком дне цикла она
   сейчас. Читается сверху вниз как короткая записка. */
/* =====================================================================
   ПОСЛАНИЯ ДНЯ
   Раньше здесь лежал разбор: фаза луны, стихия знака, фаза цикла — три
   абзаца справочника. Читалось как гороскоп из газеты и ничего не меняло
   в дне. Теперь это одно короткое послание с делом внутри.

   Правила, по которым они написаны:
   · одна мысль и одно действие, две-три строки — не лекция;
   · говорим, что делать, а не кто она: «сегодня хорошо записать цели»,
     а не «ты Овен, поэтому тебе свойственно»;
   · никаких предсказаний и обещаний — только то, что она может проверить
     на себе за пять минут;
   · совпадения ценнее одиночных поводов: новолуние в первые дни цикла —
     это другой день, чем просто новолуние, и послание тоже другое.

   Как выбирается. У каждого послания свой вес: чем точнее совпадение,
   тем выше. Берём самые точные из подходящих, а внутри равных чередуем
   по числу месяца — чтобы одно и то же не приходило две недели подряд.
   ===================================================================== */
const DAY_TIPS = [
  /* ---------- совпадения: луна и цикл вместе (вес 3) ---------- */
  {k:'nm_foll', w:3, m:['Новолуние'], c:['follicular'],
   h:'Новолуние и силы на подъёме',
   t:'Редкий день: и луна в начале, и цикл. Запиши три цели на месяц — коротко, своими словами. Через месяц вернёшься и удивишься.'},
  {k:'nm_mens', w:3, m:['Новолуние'], c:['menstrual'],
   h:'Тихое начало',
   t:'Всё начинается заново — и луна, и цикл. Но начинать делами не обязательно: сегодня достаточно написать, чего хочется. Дела подождут до сил.'},
  {k:'full_lut', w:3, m:['Полнолуние'], c:['luteal'],
   h:'Всё громче обычного',
   t:'Полнолуние и вторая половина цикла — чувства будут ярче, включая раздражение. Ничего не решай на эмоциях и ложись пораньше.',
   a:'practice'},
  {k:'full_ovu', w:3, m:['Полнолуние'], c:['ovulation'],
   h:'Пик на пике',
   t:'Энергии сегодня столько, что хватит на лишнее. Потрать её на то, что давно откладывала, а не на чужие задачи.'},
  {k:'q1_foll', w:3, m:['Первая четверть'], c:['follicular'],
   h:'День решений',
   t:'И луна, и тело сейчас за движение. Если что-то висело неделями — решай сегодня, дальше будет только сложнее собраться.'},
  {k:'wane_lut', w:3, m:['Убывающая луна','Последняя четверть'], c:['luteal'],
   h:'Время отпускать',
   t:'Хорошая пара дней, чтобы убрать лишнее: из списка дел, из переписки, из головы. Не добавляй — вычитай.'},

  /* ---------- цикл (вес 2) ---------- */
  {k:'cy_day1', w:2, c:['menstrual'], day:1,
   h:'Первый день',
   t:'Сегодня можно ничего не мочь. Вкусное, тёплое и кино — это не слабость, а нормальный план на вечер.'},
  {k:'cy_mens', w:2, c:['menstrual'],
   h:'Мягкие дни',
   t:'Энергии меньше — это физиология, а не лень. Тепло, вода, короткая практика лёжа. Спорт и большие решения подождут.',
   a:'practice'},
  {k:'cy_foll', w:2, c:['follicular'],
   h:'Силы возвращаются',
   t:'Лучшие дни месяца, чтобы попробовать новое: практику, которую откладывала, разговор, идею. Сейчас начатое доводится до конца легче.',
   a:'content'},
  {k:'cy_ovu', w:2, c:['ovulation'],
   h:'Тебя хорошо слышно',
   t:'Сегодня проще говорить и проще договариваться. Если есть сложный разговор — сегодня он пройдёт лучше, чем через неделю.'},
  {k:'cy_lut', w:2, c:['luteal'],
   h:'Заранее сбавь темп',
   t:'Чувствительность растёт, силы убывают. Снизь планку сама, до того как начнёшь себя ругать: два дела вместо трёх — это план, а не провал.'},

  /* ---------- луна (вес 1) ---------- */
  {k:'moon_new', w:1, m:['Новолуние'],
   h:'Чистый лист',
   t:'Хороший день записать цели на месяц — до следующего новолуния. Три пункта, не больше: так их видно, а не перечитываешь список.'},
  {k:'moon_serp', w:1, m:['Растущий серп'],
   h:'Первый шаг',
   t:'Силы прибывают, но их ещё мало. Сделай самое маленькое действие из того, что задумала — оно потянет за собой остальное.'},
  {k:'moon_q1', w:1, m:['Первая четверть'],
   h:'Сдвинуть с места',
   t:'Если что-то откладывала — сегодня сдвинуть проще, чем обычно. Выбери одно дело и займись им первым, до всего остального.'},
  {k:'moon_grow', w:1, m:['Растущая луна'],
   h:'Можно чуть больше',
   t:'Энергии сейчас с запасом. Возьми чуть больше обычного — но одно, а не всё сразу.',
   a:'home'},
  {k:'moon_full', w:1, m:['Полнолуние'],
   h:'Ярче обычного',
   t:'Всё чувствуется сильнее, и хорошее, и раздражающее. Береги сон: сегодня он важнее продуктивности.',
   a:'practice'},
  {k:'moon_wane', w:1, m:['Убывающая луна'],
   h:'Хорошо завершать',
   t:'Не лучший день начинать, отличный — доводить до точки. Закрой то, что висит незакрытым, хоть одно.'},
  {k:'moon_q3', w:1, m:['Последняя четверть'],
   h:'Что можно перестать',
   t:'Спроси себя: что я делаю по привычке и без радости? Одну такую вещь сегодня можно просто перестать делать.'},
  {k:'moon_old', w:1, m:['Старая луна'],
   h:'Низкая луна',
   t:'Мало сил — это фаза, а не ты. Отдых сейчас работает лучше усилия. Одна аффирмация — и день засчитан.',
   a:'home'},

  /* ---------- оттенок по стихии знака (вес 1) ---------- */
  {k:'el_fire', w:1, el:'огонь',
   h:'Запал короткий и сильный',
   t:'Сегодня хочется делать всё сразу. Направь это в одно дело — иначе к вечеру останется усталость и ни одного законченного.'},
  {k:'el_earth', w:1, el:'земля',
   h:'Опора в теле',
   t:'Тебе сейчас нужнее не новый план, а порядок: в комнате, в делах, в дыхании. Начни с практики, а не со списка.',
   a:'practice'},
  {k:'el_air', w:1, el:'воздух',
   h:'Мыслей много, тела мало',
   t:'Сначала подыши, потом решай. Пять минут дыхания — и половина сегодняшних вопросов перестанет быть срочной.',
   a:'practice'},
  {k:'el_water', w:1, el:'вода',
   h:'Чувства как данные',
   t:'Сегодня всё считывается острее, включая чужое настроение. Проверь, точно ли то, что ты чувствуешь, — твоё.'},

  /* ---------- общие (вес 0) ---------- */
  {k:'g_small', w:0, h:'Начни с малого',
   t:'Самое короткое дело из сегодняшних — сделай его первым. Дальше пойдёт само, это не мотивация, а механика.',
   a:'home'},
  {k:'g_five', w:0, h:'Пять минут',
   t:'Если сегодня совсем не до себя — возьми пять минут. Не «нормально позаниматься», а пять минут. Этого достаточно.',
   a:'content'},
  {k:'g_started', w:0, h:'Ты уже начала',
   t:'Ты открыла приложение — это и есть то самое действие, с которого всё начинается. Остальное сегодня по желанию.'},
  {k:'g_body', w:0, h:'Про тело, не про план',
   t:'Спроси себя, чего хочет тело: воды, воздуха, тишины или движения. Дай ему это раньше, чем возьмёшься за дела.'},
  {k:'g_one', w:0, h:'Одно вместо всего',
   t:'Список дел не обязан закрываться целиком. Выбери одно, которое откликается, — и пусть остальное останется на потом.',
   a:'home'},
  {k:'g_compare', w:0, h:'Не сравнивай',
   t:'Твоя неделя сравнивается только с твоей прошлой. Ни с чьей больше — там другие силы, другой цикл и другая жизнь.'},
  {k:'g_quiet', w:0, h:'Тишина тоже практика',
   t:'Если ничего не хочется — побудь пять минут без телефона и без задач. Это работает не хуже практики, а иногда лучше.'}
];

/* Куда ведёт кнопка под посланием. Больше двух вариантов не нужно:
   лишний выбор превращает подсказку в меню. */
const TIP_ACTS = {
  home:     {n:'К моей программе',  go:"go('home')"},
  content:  {n:'Открыть библиотеку', go:"go('content')"},
  practice: {n:'Короткая практика',  go:"go('content');S.cType='practice'"}
};

/* Послание на сегодня: самое точное из подошедших. */
function dayTip(d = new Date()){
  const m = moon(d), z = zodiac(S.birth && S.birth.date), cy = cycleNow();
  const fits = DAY_TIPS.filter(t => {
    if(t.m && t.m.indexOf(m.n) < 0) return false;
    if(t.c && (!cy || t.c.indexOf(cy.phase.k) < 0)) return false;
    if(t.day && (!cy || cy.day !== t.day)) return false;
    if(t.el && (!z || z.el !== t.el)) return false;
    return true;
  });
  if(!fits.length) return DAY_TIPS[DAY_TIPS.length - 1];
  const top = Math.max(...fits.map(t => t.w));
  const best = fits.filter(t => t.w === top);
  return best[(d.getDate() + d.getMonth()) % best.length];
}

/* Строка-повод под заголовком: из чего сегодня сложилось послание. */
function dayWhy(d = new Date()){
  const m = moon(d), z = zodiac(S.birth && S.birth.date), cy = cycleNow();
  return [m.n.toLowerCase(),
          cy ? cy.phase.n.toLowerCase() + ' фаза, день ' + cy.day : '',
          z ? z.e + ' ' + z.n.toLowerCase() : ''].filter(Boolean).join(' · ');
}

function personalDay(m, z){
  const t = dayTip();
  return `<b>${esc(t.h)}.</b> ${esc(t.t)}`;
}

/* ---------- звезда под посланием ----------
   «Зашло или нет» нельзя посчитать по открытиям: подсказку видят все,
   кто открыл главную. Звезда — единственный честный сигнал, и она же
   единственная причина, по которой базу посланий можно будет чистить,
   а не только пополнять.

   Отметка уходит на сервер отдельной записью: номер складывается из ключа
   послания и почты, поэтому одна женщина не может отметить дважды и не
   может стереть чужую отметку. Текст послания не отправляем — он и так
   есть в коде, а на сервере нужен только счёт. */
function tipStarred(k){ return (S.tipStars || []).indexOf(k) >= 0; }

function starTip(k){
  S.tipStars = S.tipStars || [];
  const on = tipStarred(k);
  S.tipStars = on ? S.tipStars.filter(x => x !== k) : [...S.tipStars, k];
  const me = typeof myMail === 'function' ? myMail() : '';
  if(me){
    const id = k + '__' + me;
    TIP_VOTES = (TIP_VOTES || []).filter(v => v.id !== id);
    /* Снятая звезда уезжает пометкой, а не пропажей: общий раздел на сервере
       умеет дописывать и обновлять, но не стирать. Без пометки счёт остался
       бы завышенным навсегда. */
    TIP_VOTES.push(on ? {id, k, del:true} : {id, k, at:Date.now()});
    if(typeof syncPush === 'function') syncPush(['tipstars']);
  }
  /* перерисовываем одну кнопку, а не всю страницу */
  const btn = document.getElementById('tipstar');
  if(btn){
    btn.classList.toggle('on', !on);
    btn.setAttribute('aria-pressed', String(!on));
  } else if(typeof render === 'function') render();
  if(typeof schedulePersist === 'function') schedulePersist();
  if(typeof toast === 'function') toast(on ? 'Отметка снята' : 'Спасибо, отметила');
}

/* Отметки всех женщин: сюда же приходят чужие с сервера.
   Из них считается, какие послания заходят. */
let TIP_VOTES = [];
function tipRating(){
  const by = {};
  (TIP_VOTES || []).forEach(v => { if(v && v.k && !v.del) by[v.k] = (by[v.k] || 0) + 1; });
  return DAY_TIPS.map(t => ({k:t.k, h:t.h, n:by[t.k] || 0}))
                 .sort((a, b) => b.n - a.n);
}


/* картинка эксперта: загруженное фото или сгенерированный портрет */
/* Фото эксперта. Метка data-x работает так же, как data-p у участниц:
   по ней общий обработчик открывает страницу эксперта — из ленты, из
   команды сообщества, из шапки группы. Ставим её только там, где сам
   эксперт известен: у случайной картинки открывать нечего. */
function expPic(e, noLink){
  if(!e) return '';
  const rec = typeof e === 'string' ? ((typeof EXPERTS !== 'undefined' && EXPERTS.find(x => x.id === e)) || {id:e}) : e;
  const id = rec.id;
  const known = typeof EXPERTS !== 'undefined' && EXPERTS.some(x => x.id === id);
  const tag = known && !noLink ? ` data-x="${attJs(id)}" title="Открыть страницу эксперта"` : '';
  /* сначала фото, загруженное в карточку эксперта, потом — аватар её аккаунта */
  const src = MEDIA[id] || (rec.email ? avatarOf(rec.email) : '') || (rec.mail ? avatarOf(rec.mail) : '');
  return src ? `<img src="${safeUrl(src)}" alt=""${tag}>` : portrait(id, null, tag);
}


/* картинка товара: загруженное фото с учётом кадрирования или сгенерированная */
function goodPic(g){
  const info = (typeof GOOD_INFO !== 'undefined' ? GOOD_INFO[g.id] : null) || {};
  const pos = info.pos || '50% 50%';
  const gal = info.gallery || [];
  if(MEDIA[g.id]) return `<img src="${safeUrl(MEDIA[g.id])}" alt="" style="object-position:${esc(pos)}">`;
  if(gal.length && MEDIA[gal[0]]) return `<img src="${safeUrl(MEDIA[gal[0]])}" alt="" style="object-position:${esc(pos)}">`;
  return prodArt(g.id, g.sh);
}


/* =====================================================================
   АВАТАРЫ ПОЛЬЗОВАТЕЛЕЙ
   Хранятся по адресу почты: ключ файла и запись в общем справочнике.
   Так фото не смешиваются между аккаунтами и видны админу в карточках.
   ===================================================================== */
const AVATARS = {};                       // email -> ссылка на файл

const mailKey = m => 'ava_' + String(m || '').toLowerCase().replace(/[^a-z0-9]/g, '_');

function avatarOf(email){
  if(!email) return '';
  const m = String(email).toLowerCase();
  return AVATARS[m] || MEDIA[mailKey(m)] || '';
}
function myAvatar(){
  return (S.user && avatarOf(S.user.email)) || S.avatar || '';
}
/* Своя ли это запись. Считаем по почте аккаунта, а не по метке в данных:
   метка «моё» уезжала в общие записи, и чужие послания подхватывали
   аватарку того, кто их читает. */
function myMail(){ return S.user ? String(S.user.email || '').toLowerCase() : ''; }
function isMine(rec){
  if(!rec) return false;
  const me = myMail(), his = String(rec.email || '').toLowerCase();
  if(his) return !!me && his === me;
  return !me && !!rec.own;          /* старые записи без почты — только до входа */
}
function avaImg(src, size, tag){
  const s = size || 36;
  return `<img src="${safeUrl(src)}" alt=""${tag || ''} style="width:${s}px;height:${s}px;border-radius:50%;object-fit:cover;flex:none">`;
}
function avaLetter(name, size, cls){
  const s = size || 36;
  return `<span class="ava ${cls||''}" style="width:${s}px;height:${s}px;font-size:${Math.round(s*0.38)}px">${
    esc(String(name || 'Е')[0].toUpperCase())}</span>`;
}
/* аватар любого человека: по почте, иначе буква имени */
