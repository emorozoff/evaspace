/* =====================================================================
   АВТОРИЗАЦИЯ И ПОДПИСКА
   ===================================================================== */
Object.assign(S, {
  auth:{mode:'choose', email:'', pass:'', name:'', err:'', code:'', sent:'', remember:true},
  user:null, homework:{}, myEvents:[], extra:{},
  sub:{trial:false, start:null, days:3, active:false, price:2900, plan:'month'}
});

const STAR_PATH = 'M50 2c1.6 16.4 4.4 27.4 8.8 33.6C63.2 41.8 73.6 45.6 90 48c-16.4 2.4-26.8 6.2-31.2 12.4C54.4 66.6 51.6 79 50 98c-1.6-19-4.4-31.4-8.8-37.6C36.8 54.2 26.4 50.4 10 48c16.4-2.4 26.8-6.2 31.2-12.4C45.6 29.4 48.4 18.4 50 2z';
const STAR = `<svg class="splash-star" viewBox="0 0 100 100" aria-hidden="true">
  <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFFDF6"/><stop offset="1" stop-color="#F0D9A8"/></linearGradient></defs>
  <path d="${STAR_PATH}" fill="url(#sg)"/></svg>`;
const starMark = (size, fill) => `<svg width="${size||13}" height="${size||13}" viewBox="0 0 100 100" style="vertical-align:-1px">
  <path d="${STAR_PATH}" fill="${fill||'#E7A339'}"/></svg>`;

/* Заставка держалась ровно 2,45 секунды при каждом открытии, и только
   потом начинался вход — то есть приложение сначала ждало, а потом
   работало. Теперь вход начинается сразу, а заставка живёт ровно столько,
   сколько он идёт, но не меньше короткой паузы: иначе она мелькает. */
const SPLASH_MIN = 900;
let splashRun = false;
function scrSplash(){
  if(!splashRun){
    splashRun = true;
    const started = Date.now();
    (async () => {
      if(!S.user){
        try { await tryAutoLoginAsync(); } catch(e){ try { tryAutoLogin(); } catch(e2){} }
      }
      const left = Math.max(0, SPLASH_MIN - (Date.now() - started));
      setTimeout(() => {
        if(!S.user) S.screen = 'auth';
        render(); stars();
      }, left);
    })();
  }
  return `<div class="splash">
    <div class="splash-glow"></div>
    ${STAR}
    <div style="display:flex;flex-direction:column;align-items:center;gap:7px;position:relative;z-index:2">
      <div class="splash-name">EVA SPACE</div>
      <div class="splash-sub">пространство для себя</div>
    </div>
  </div>`;
}

/* ---------- экран входа ---------- */
function scrAuth(){
  const a = S.auth;
  if(a.mode === 'admin') return authAdmin();
  if(a.mode === 'verify') return scrVerify();
  if(a.mode === 'choose') return authChoose();
  return authForm();
}

function authChoose(){
  return `<div class="sky"><canvas id="sky"></canvas></div>
  <div class="night" style="justify-content:center">
    <div class="authhead anim-up" style="margin-bottom:38px">
      <svg width="40" height="40" viewBox="0 0 100 100" style="filter:drop-shadow(0 0 18px rgba(255,235,200,.4))">
        <path d="${STAR_PATH}" fill="#fff"/></svg>
      <div class="logo" style="font-size:30px;color:#fff;line-height:1">EVA&nbsp;SPACE</div>
      <p class="muted small" style="margin:0;line-height:1.55">Личная программа развития<br>на каждый день</p>
    </div>
    <div class="anim-up d1">
      <button class="btn" style="background:#fff;color:var(--ink)" onclick="authGo('signup')">Создать аккаунт</button>
      <button class="btn ghost" style="margin-top:9px" onclick="authGo('login')">Войти в аккаунт</button>
    </div>
    <div style="flex:1"></div>
    <p class="small muted" style="text-align:center;font-size:11px;line-height:1.5">
      Создавая аккаунт, ты соглашаешься с условиями сервиса и политикой конфиденциальности</p>
    <button class="svcbtn" onclick="authGo('admin')">Вход для администраторов и экспертов</button>
  </div>`;
}

function authForm(){
  const a = S.auth, isNew = a.mode === 'signup';
  return `<div class="sky"><canvas id="sky"></canvas></div>
  <div class="night">
    <button onclick="authGo('choose')" style="color:#fff;font-size:20px;width:34px;text-align:left">‹</button>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center">
      <h1 class="serif" style="font-size:30px;margin:0 0 8px">${isNew ? 'Создать аккаунт' : 'С возвращением'}</h1>
      <p class="muted small" style="margin:0 0 24px">${isNew
        ? 'Имя и пароль - и сразу к тесту. Почту оставишь в конце, когда программа будет готова.'
        : 'Введи почту и пароль от своего аккаунта.'}</p>
      ${isNew ? `<label class="lbl" style="color:rgba(255,255,255,.6)">Как тебя зовут</label>
        <input class="field" id="a_name" placeholder="Имя" value="${esc(a.name)}">`
      : `<label class="lbl" style="color:rgba(255,255,255,.6)">Почта</label>
        <input class="field" id="a_mail" type="email" inputmode="email" placeholder="you@mail.ru" value="${esc(a.email)}">`}
      <label class="lbl" style="color:rgba(255,255,255,.6)">Пароль</label>
      <input class="field" id="a_pass" type="password" placeholder="${isNew?'Минимум 6 символов':'Пароль'}" value="${esc(a.pass)}">
      ${a.err ? `<div class="small" style="color:#FFB4C4;margin:-2px 0 10px">${a.err}</div>` : ''}
      <button class="row" style="margin:2px 0 12px;color:rgba(255,255,255,.75);font-size:12.5px"
        onclick="S.auth.remember=!S.auth.remember;render()">
        <span class="sw ${a.remember?'on':''}" style="width:36px;height:21px"><i style="width:15px;height:15px;${a.remember?'left:18px':''}"></i></span>
        Оставаться в аккаунте на этом устройстве</button>
      <button class="btn" style="background:#fff;color:var(--ink);margin-top:2px" onclick="submitAuth()">
        ${isNew ? 'Создать аккаунт' : 'Войти'}</button>
      ${!isNew ? `<button style="color:rgba(255,255,255,.5);font-size:12px;margin-top:14px;width:100%"
        onclick="toast('Ссылка для восстановления отправлена')">Забыла пароль</button>` : ''}
      <button style="color:rgba(255,255,255,.55);font-size:12.5px;margin-top:18px;width:100%"
        onclick="authGo('${attJs(isNew?'login':'signup')}')">
        ${isNew ? 'У меня уже есть аккаунт' : 'Создать новый аккаунт'}</button>
      <button class="svcbtn" onclick="authGo('admin')">Вход для администраторов и экспертов</button>
    </div>
  </div>`;
}

function authAdmin(){
  return `<div class="sky"><canvas id="sky"></canvas></div>
  <div class="night">
    <button onclick="authGo('choose')" style="color:#fff;font-size:20px;width:34px;text-align:left">‹</button>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center">
      <div class="eyebrow" style="color:rgba(255,255,255,.5)">Служебный вход</div>
      <h1 class="serif" style="font-size:27px;margin:8px 0 8px">Панель управления</h1>
      <p class="muted small" style="margin:0 0 22px">Для администраторов и подтверждённых экспертов. Загрузка контента, модерация, статистика.</p>
      <label class="lbl" style="color:rgba(255,255,255,.6)">Служебная почта</label>
      <input class="field" id="ad_mail" type="email" inputmode="email" placeholder="you@mail.ru">
      <label class="lbl" style="color:rgba(255,255,255,.6)">Пароль</label>
      <input class="field" id="ad_pass" type="password" placeholder="Пароль">
      <button class="btn" style="background:#fff;color:var(--ink)" onclick="adminLogin()">Войти в панель</button>
      <p class="small muted" style="margin-top:14px;font-size:11px">Роль определяет сервер: администратора задаёт
        файл data/config.php на хостинге, эксперта назначает администратор.</p>
    </div>
  </div>`;
}

/* роль назначает сервер, экран входа её больше не трогает */
function authGo(m){ S.auth.mode = m; S.auth.err = ''; render(); }

async function submitAuth(){
  const a = S.auth;
  a.pass = ($('#a_pass')||{}).value || '';
  const nm = (($('#a_name')||{}).value || '').trim();

  if(a.mode === 'signup'){
    if(!nm){ a.err = 'Как к тебе обращаться?'; return render(); }
    if(a.pass.length < 6){ a.err = 'Пароль минимум 6 символов'; return render(); }
    a.err = ''; a.name = nm;
    S.name = nm; S.role = 'user';
    S.tags = []; S.picked = []; S.qi = 0; S.answers = {}; S.extra = {};
    S.screen = 'quiz';
    render(); stars();
    return;
  }

  a.email = (($('#a_mail')||{}).value || '').trim().toLowerCase();
  if(!/^[^@\s]+@[^@\s]+\.[a-zа-я]{2,}$/i.test(a.email)){ a.err = 'Проверь адрес почты'; return render(); }
  if(a.pass.length < 6){ a.err = 'Пароль минимум 6 символов'; return render(); }

  if(a.mode === 'login'){
    if(SYNC.alive !== false){                      // пароль проверяет сервер
      const r = await apiCall('login', { email:a.email, pass:a.pass }, { silent:true });
      if(!r){ a.err = SYNC.lastError || 'Не удалось войти'; return render(); }
      SYNC.token = r.token;
      mirrorUser(r.user);
      if(!r.user.verified){
        a.err = ''; a.code = r.demo_code || ''; a.mode = 'verify';
        sendVerificationEmail(a.email, a.code);
        return render();
      }
      return signIn(DB.find(a.email) || r.user);
    }
    const u = DB.find(a.email);                    // без сервера — только на этом устройстве
    if(!u){ a.err = 'Аккаунт с такой почтой не найден'; return render(); }
    if(u.pass !== hashPass(a.pass)){ a.err = 'Неверный пароль'; return render(); }
    if(!u.verified){ a.err = ''; a.code = u.code; a.mode = 'verify'; sendVerificationEmail(a.email, u.code); return render(); }
    signIn(u);
    return;
  }

}

/* ---------- почта в конце теста ---------- */
function scrMail(){
  const a = S.auth;
  return `<div class="sky"><canvas id="sky"></canvas></div>
  <div class="night">
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center">
      <div class="eyebrow" style="color:rgba(255,255,255,.5)">Последний шаг</div>
      <h1 class="serif" style="font-size:28px;margin:8px 0 8px">${esc(S.name||'Твоя')}, программа готова</h1>
      <p class="muted small" style="margin:0 0 20px">Оставь почту - на неё придёт код доступа и туда же будем присылать
        напоминания о практиках. Без неё программа не сохранится.</p>
      <label class="lbl" style="color:rgba(255,255,255,.6)">Почта</label>
      <input class="field" id="m_mail" type="email" inputmode="email" placeholder="you@mail.ru" value="${esc(a.email)}">
      ${a.err ? `<div class="small" style="color:#FFB4C4;margin:-2px 0 10px">${a.err}</div>` : ''}
      <button class="row" style="margin:2px 0 12px;color:rgba(255,255,255,.75);font-size:12.5px"
        onclick="S.auth.remember=!S.auth.remember;render()">
        <span class="sw ${a.remember?'on':''}" style="width:36px;height:21px"><i style="width:15px;height:15px;${a.remember?'left:18px':''}"></i></span>
        Оставаться в аккаунте на этом устройстве</button>
      <button class="btn" style="background:#fff;color:var(--ink)" onclick="sendCode()">Получить код доступа</button>
      <p class="small muted" style="margin-top:14px;font-size:11.5px">Три дня бесплатно, потом 2 900 ₽ в месяц. Отменить можно в любой момент.</p>
      <button class="svcbtn" onclick="authGo('admin')">Вход для администраторов и экспертов</button>
    </div>
  </div>`;
}

async function sendCode(){
  const a = S.auth;
  a.email = (($('#m_mail')||{}).value || '').trim().toLowerCase();
  if(!/^[^@\s]+@[^@\s]+\.[a-zа-я]{2,}$/i.test(a.email)){ a.err = 'Проверь адрес почты'; return render(); }

  if(SYNC.alive !== false){                        // аккаунт заводит сервер
    const r = await apiCall('register',
      { email:a.email, name:S.name || 'Гостья', pass:a.pass || 'eva2026' }, { silent:true });
    if(!r){ a.err = SYNC.lastError || 'Не удалось создать аккаунт'; return render(); }
    SYNC.token = r.token;
    mirrorUser(r.user);
    a.err = ''; a.code = r.demo_code || ''; a.mode = 'verify'; S.screen = 'auth';
    sendVerificationEmail(a.email, a.code);
    render(); stars();
    return;
  }

  if(DB.find(a.email)){ a.err = 'Эта почта уже занята - войди в аккаунт'; return render(); }
  const code = genCode();
  DB.upsert({email:a.email, name:S.name, pass:hashPass(a.pass || 'eva2026'), verified:false, code,
    role:'user', created:Date.now()});
  a.err = ''; a.code = code; a.mode = 'verify'; S.screen = 'auth';
  sendVerificationEmail(a.email, code);
  render(); stars();
}

async function signIn(u){
  S.user = {email:u.email, name:u.name, role:u.role || 'user'};
  S.role = u.role === 'admin' ? 'admin' : u.role === 'expert' ? 'expert' : 'user';
  S.name = u.name;
  if(S.auth.remember) DB.setSession({email:u.email, at:Date.now()});
  if(typeof pullProgress === 'function') await pullProgress(u.email);
  S.avatar = '';
  const had = restore(u.email);
  if(!S.name) S.name = u.name;
  const known = typeof avatarOf === 'function' ? avatarOf(u.email) : '';
  if(known) S.avatar = known;
  if(had && S.program && S.program.length){
    S.screen = 'app'; S.tab = 'home'; checkWeek();
  } else {
    S.tags = []; S.picked = []; S.qi = 0; S.screen = 'quiz';
  }
  render(); stars();
  toast('С возвращением, ' + u.name);
}

function scrVerify(){
  const a = S.auth;
  return `<div class="sky"><canvas id="sky"></canvas></div>
  <div class="night">
    <button onclick="authGo('choose')" style="color:#fff;font-size:20px;width:34px;text-align:left">‹</button>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center">
      <div class="eyebrow" style="color:rgba(255,255,255,.5)">Шаг 2 из 2</div>
      <h1 class="serif" style="font-size:28px;margin:8px 0 8px">Подтверди почту</h1>
      <p class="muted small" style="margin:0 0 6px">Мы отправили шестизначный код на <b style="color:#fff">${esc(a.email)}</b>.
        Если письма нет - проверь папку «Спам».</p>
      <div class="card" style="background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.14);color:#fff;margin:14px 0">
        <div class="small" style="opacity:.7">Демо-режим: почтовый сервис не подключён, код показан здесь</div>
        <div style="font-size:26px;font-weight:700;letter-spacing:.28em;margin-top:6px">${a.code}</div>
      </div>
      <input class="field" id="v_code" inputmode="numeric" maxlength="6" placeholder="Код из письма"
        style="font-size:20px;letter-spacing:.3em;text-align:center">
      ${a.err ? `<div class="small" style="color:#FFB4C4;margin:-2px 0 10px">${a.err}</div>` : ''}
      <button class="btn" style="background:#fff;color:var(--ink)" onclick="checkCode()">Подтвердить</button>
      <button style="color:rgba(255,255,255,.55);font-size:12.5px;margin-top:14px;width:100%"
        onclick="resendCode()">Отправить код ещё раз</button>
    </div>
  </div>`;
}

async function checkCode(){
  const v = (($('#v_code')||{}).value || '').trim();

  if(SYNC.alive !== false){                        // код сверяет сервер
    const r = await apiCall('verify', { email:S.auth.email, code:v }, { silent:true });
    if(!r){ S.auth.err = SYNC.lastError || 'Код не совпадает'; return render(); }
    mirrorUser(r.user);
    S.auth.err = '';
    S.user = {email:r.user.email, name:r.user.name, role:r.user.role};
    S.role = r.user.role === 'expert' ? 'expert' : r.user.role === 'admin' ? 'admin' : 'user';
    S.name = r.user.name;
    if(S.auth.remember) DB.setSession({email:r.user.email, at:Date.now()});
    toast('Почта подтверждена');
    if(S.tags && S.tags.length){ buildAnim(); }
    else { restore(r.user.email); S.screen = 'app'; render(); }
    return;
  }

  const u = DB.find(S.auth.email);
  if(!u) { S.auth.mode = 'signup'; return render(); }
  if(v !== u.code){ S.auth.err = 'Код не совпадает'; return render(); }
  u.verified = true; DB.upsert(u);
  S.auth.err = '';
  S.user = {email:u.email, name:u.name, role:u.role || 'user'};
  S.role = 'user'; S.name = u.name;
  if(S.auth.remember) DB.setSession({email:u.email, at:Date.now()});
  toast('Почта подтверждена');
  if(S.tags && S.tags.length){ buildAnim(); }
  else { restore(u.email); S.screen = 'app'; render(); }
}

/* анимация сборки программы после подтверждения */
function buildAnim(){
  S.screen = 'building'; render(); stars();
  const steps = ['Читаю твои ответы', 'Сравниваю с ' + LIB.length + ' уроками библиотеки',
    'Раскладываю на семь дней', 'Открываю доступ на три дня'];
  let k = 0;
  const iv = setInterval(() => {
    k++;
    const t = document.getElementById('bs'), p = document.getElementById('bp');
    if(t && steps[k]) t.textContent = steps[k];
    if(p) p.style.width = (10 + k*24) + '%';
    if(k >= 4){
      clearInterval(iv);
      buildProgram(); startTrial(); S.week = weekNo(); S.day = todayIdx(); bumpVisit();
      S.screen = 'ready'; render(); stars(); persist();
    }
  }, 800);
}
async function resendCode(){
  if(SYNC.alive !== false){
    const r = await apiCall('resend', { email:S.auth.email }, { silent:true });
    if(!r) return toast(SYNC.lastError || 'Не удалось отправить код');
    S.auth.code = r.demo_code || '';
    sendVerificationEmail(S.auth.email, S.auth.code);
    render(); return toast('Код отправлен повторно');
  }
  const u = DB.find(S.auth.email);
  if(!u) return;
  u.code = genCode(); DB.upsert(u); S.auth.code = u.code;
  sendVerificationEmail(u.email, u.code);
  render(); toast('Код отправлен повторно');
}

/* Роль приходит с сервера. Назначить её себе из браузера нельзя:
   администратора задаёт файл data/config.php, эксперта — администратор. */
async function adminLogin(){
  const mail = (($('#ad_mail')||{}).value || '').trim().toLowerCase();
  const pass = ($('#ad_pass')||{}).value || '';
  if(!mail || !pass) return toast('Введи почту и пароль');

  const enter = (u, role) => {
    S.role = role;
    S.user = {email:u.email, name:u.name, role};
    S.name = u.name;
    if(role === 'admin') S.adminName = u.name;
    DB.setSession({email:u.email, at:Date.now()});
    S.screen = 'app'; S.page = null;
    render();
    toast(role === 'admin' ? 'Панель администратора' : 'Кабинет эксперта');
  };

  if(SYNC.alive === false){                        // без сервера — только на этом устройстве
    const u = DB.find(mail);
    if(!u || u.pass !== hashPass(pass)) return toast('Неверная почта или пароль');
    const role = u.role === 'admin' ? 'admin' : u.role === 'expert' ? 'expert' : 'user';
    if(role === 'user') return toast('У этого аккаунта нет доступа к панели');
    return enter(u, role);
  }

  const r = await apiCall('login', { email:mail, pass }, { silent:true });
  if(!r) return toast(SYNC.lastError || 'Не удалось войти');
  const role = r.user.role;
  if(role !== 'admin' && role !== 'expert'){
    S.role = 'user';
    return toast('У этого аккаунта нет доступа к панели. Администратор назначается в data/config.php на хостинге');
  }
  SYNC.token = r.token;
  mirrorUser(r.user);
  enter(r.user, role);
  if(role === 'admin') pullUsers();
}

async function logout(){
  persist();
  if(typeof pushProgress === 'function') await pushProgress();
  if(SYNC.alive !== false && SYNC.token) await apiCall('logout', {}, { silent:true });
  SYNC.token = '';
  const last = S.user ? S.user.email : '';
  DB.clearSession();
  S.user = null; S.role = 'user'; S.avatar = '';
  S.auth = {mode: last ? 'login' : 'choose', email:last, pass:'', name:'', err:'', code:'', sent:'', remember:true};
  S.screen = 'auth'; S.page = null; S.sheet = null; S.course = null;
  render(); stars();
}

/* автовход по сохранённой сессии */
async function tryAutoLoginAsync(){
  try { await SYNC.ready; } catch(e){}

  if(SYNC.alive !== false){                        // с сервером решает токен, а не запись в браузере
    if(!SYNC.token) return false;
    const r = await apiCall('me', null, { silent:true });
    if(!r || !r.user){ SYNC.token = ''; DB.clearSession(); return false; }
    mirrorUser(r.user);
    DB.setSession({email:r.user.email, at:Date.now()});
    if(typeof pullProgress === 'function') await pullProgress(r.user.email);
    const entered = tryAutoLogin();
    if(entered && r.user.role === 'admin') await pullUsers();
    return entered;
  }

  const s = DB.session();
  if(!s) return false;
  const u = DB.find(s.email);
  if(!u || !u.verified) return false;
  if(typeof pullProgress === 'function') await pullProgress(u.email);
  return tryAutoLogin();
}
function tryAutoLogin(){
  const s = DB.session();
  if(!s) return false;
  const u = DB.find(s.email);
  if(!u || !u.verified) return false;
  S.user = {email:u.email, name:u.name, role:u.role || 'user'};
  S.role = u.role === 'admin' ? 'admin' : u.role === 'expert' ? 'expert' : 'user';
  S.name = u.name;
  S.avatar = '';
  const had = restore(u.email);
  if(!S.name) S.name = u.name;
  const known = typeof avatarOf === 'function' ? avatarOf(u.email) : '';
  if(known) S.avatar = known;
  S.screen = 'app';
  if(S.role === 'user' && (!had || !S.program || !S.program.length)){ S.screen = 'quiz'; S.qi = 0; S.picked = []; }
  else checkWeek();
  return true;
}

/* ---------- подписка ---------- */
function startTrial(){
  S.sub = {trial:true, start:Date.now(), days:3, active:false, price:2900, plan:'month'};
}
function trialLeft(){
  if(!S.sub.trial || !S.sub.start) return 0;
  const passed = Math.floor((Date.now() - S.sub.start)/864e5);
  return Math.max(0, S.sub.days - passed);
}
function hasAccess(){ return S.sub.active || trialLeft() > 0; }

function trialBar(){ return ''; }

/* строка о доступе внутри шапки */
function accessLine(){
  if(S.sub.active) return `<button class="levelbar" onclick="openPage('sub')">
    <span class="lchip">Подписка</span>
    <span class="small" style="flex:1;opacity:.85">${S.sub.plan === 'year' ? 'годовая' : 'месячная'} · осталось ${plural(subLeft(),'день','дня','дней')}</span>
    <span style="opacity:.7">›</span></button>`;
  const l = trialLeft();
  return `<button class="levelbar" onclick="openPage('sub')" style="${l?'':'background:rgba(255,255,255,.16)'}">
    <span class="lchip" style="${l?'':'background:var(--accent);color:#fff'}">${l ? 'Бесплатно' : 'Доступ закрыт'}</span>
    <span class="small" style="flex:1;opacity:.85">${l
      ? `осталось ${plural(l,'день','дня','дней')} из ${S.sub.days}, потом 2 900 ₽ в месяц`
      : 'оформи подписку, чтобы вернуть программу'}</span>
    <span style="opacity:.7">›</span></button>`;
}

function pgSub(){
  const l = trialLeft();
  const plans = [
    {k:'month', n:'Месяц', p:2900, s:'Списание раз в месяц', d:''},
    {k:'year',  n:'Год',   p:24900, s:'2 075 ₽ в месяц', d:'выгода 29%'}
  ];
  return `<div class="view pad">${backBtn('Назад')}
    <div class="paywall">
      <div class="eyebrow" style="color:rgba(255,255,255,.55)">Подписка</div>
      <h1 class="serif" style="font-size:27px;margin:8px 0 10px">Eva Space<br>без ограничений</h1>
      <p class="small" style="opacity:.75;margin:0">${S.sub.active
        ? (S.sub.plan === 'year' ? 'Годовая подписка активна. ' : 'Подписка активна. ') +
          'Следующее списание через ' + plural(subLeft(),'день','дня','дней') + '.'
        : l > 0 ? `Сейчас у тебя бесплатный доступ, осталось ${plural(l,'день','дня','дней')}. После этого 2 900 ₽ в месяц.`
                : 'Пробные три дня закончились. Оформи подписку, чтобы вернуть программу.'}</p>
    </div>

    <div class="card">
      <b style="font-size:14.5px">Что входит</b>
      ${[['Личная программа на каждый день','Пересобирается под твои темы и цикл'],
         ['Вся библиотека практик и мастер-классов','37 материалов, новые каждую неделю'],
         ['Сообщество и группы','Ответы экспертов внутри чатов'],
         ['Отчёты, календарь, трекер цикла',''],
         ['Скидка 15% на курсы и маркет','']].map(([t,d]) => `
        <div class="row" style="align-items:flex-start;margin-top:11px">
          <span style="color:var(--ok);font-weight:700">✓</span>
          <div style="flex:1"><div style="font-size:13.5px;font-weight:600">${t}</div>
            ${d?`<div class="small muted">${d}</div>`:''}</div></div>`).join('')}
    </div>

    ${!S.sub.active ? `
      ${plans.map(p => `<button class="card" style="width:100%;text-align:left;${S.sub.plan===p.k?'border-color:var(--ink);border-width:1.5px':''}"
        onclick="S.sub.plan='${attJs(p.k)}';render()">
        <div class="spread">
          <div><b style="font-size:15px">${esc(p.n)}</b>
            <div class="small muted">${p.s}</div></div>
          <div style="text-align:right">
            <div class="price" style="font-size:18px">${money(p.p)}</div>
            ${p.d?`<div class="small" style="color:var(--ok);font-weight:700">${esc(p.d)}</div>`:''}</div>
        </div></button>`).join('')}
      <button class="btn acc" onclick="payPlan()">Оформить за ${money(S.sub.plan==='year'?24900:2900)}</button>
      <p class="small muted" style="text-align:center;margin-top:10px;font-size:11.5px">
        Отменить можно в любой момент в настройках. Оплата в прототипе не проходит.</p>`
    : `<button class="btn ghost" onclick="S.sub.active=false;render();toast('Подписка отменена')">Отменить подписку</button>`}
  </div>`;
}

function payPlan(){
  const days = S.sub.plan === 'year' ? 365 : 30;
  S.sub.active = true; S.sub.trial = false;
  S.sub.paidAt = Date.now(); S.sub.days2 = days;
  S.bonus += S.sub.plan === 'year' ? 1000 : 300;
  render(); schedulePersist();
  toast(S.sub.plan === 'year' ? 'Годовая подписка активна. Начислено 1 000 бонусов' : 'Подписка активна. Начислено 300 бонусов');
}
function subLeft(){
  if(!S.sub.active || !S.sub.paidAt) return 0;
  const passed = Math.floor((Date.now() - S.sub.paidAt)/864e5);
  return Math.max(0, (S.sub.days2 || 30) - passed);
}
const subLabel = () => S.sub.active
  ? (S.sub.plan === 'year' ? 'Годовая подписка' : 'Подписка на месяц') + ' · осталось ' + plural(subLeft(),'день','дня','дней')
  : trialLeft() ? 'Пробный период, осталось ' + plural(trialLeft(),'день','дня','дней') : 'Не активна';

/* ---------- анимированные звёзды на тёмных экранах ---------- */
function stars(){
  const c = document.getElementById('sky');
  if(!c) return;
  const x = c.getContext('2d'), w = c.width = c.offsetWidth, h = c.height = c.offsetHeight;
  const pts = [...Array(70)].map(() => ({x:Math.random()*w, y:Math.random()*h,
      r:Math.random()*1.2+.3, a:Math.random(), s:Math.random()*.01+.004}));
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  (function loop(){
    if(!document.body.contains(c)) return;
    x.clearRect(0,0,w,h);
    pts.forEach(p => { p.a += p.s; const o = (Math.sin(p.a)+1)/2*.55+.12;
      x.fillStyle = `rgba(255,255,255,${o})`; x.beginPath(); x.arc(p.x,p.y,p.r,0,7); x.fill(); });
    requestAnimationFrame(loop);
  })();
}

/* =====================================================================
   МЕДИА: загрузка фото со сжатием
   ===================================================================== */
const MEDIA = {};   // id -> dataURL (jpeg)

function cover(id, kind){
  if(MEDIA[id]){
    const pos = (typeof POS !== 'undefined' && POS[id]) || '50% 50%';
    return `<img src="${safeUrl(MEDIA[id])}" alt="" style="object-position:${esc(pos)}">`;
  }
  return coverGen(id, kind);
}

/* Сжатие: длинная сторона до 1400px, JPEG 0.86 — вес падает в разы,
   картинка остаётся резкой на ретине. PNG с прозрачностью не теряется. */
function compressImage(file, cb, maxSide, quality){
  maxSide = maxSide || 1400; quality = quality || 0.86;
  const okType = /^image\//.test(file.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name || '');
  if(!okType) return toast('Это не изображение');
  if(file.size > 25 * 1024 * 1024) return toast('Файл больше 25 МБ, выбери снимок поменьше');
  toast('Обрабатываю фото…');
  const fr = new FileReader();
  fr.onload = e => {
    const img = new Image();
    img.onload = () => {
      let {width:w, height:h} = img;
      const k = Math.min(1, maxSide / Math.max(w, h));
      w = Math.round(w*k); h = Math.round(h*k);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const x = c.getContext('2d');
      x.imageSmoothingQuality = 'high';
      x.drawImage(img, 0, 0, w, h);
      const isPng = /png|webp/.test(file.type) && hasAlpha(x, w, h);
      const out = isPng ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', quality);
      cb(out, {w, h, before:file.size, after:Math.round(out.length*0.75)});
    };
    img.onerror = () => {
      // HEIC с айфона браузер иногда не открывает как картинку
      toast(/heic|heif/i.test(file.type + file.name)
        ? 'Формат HEIC не читается браузером. В настройках айфона: Камера → Форматы → «Наиболее совместимый»'
        : 'Не удалось прочитать файл');
    };
    img.src = e.target.result;
  };
  fr.onerror = () => toast('Не удалось открыть файл');
  fr.readAsDataURL(file);
}
function hasAlpha(ctx, w, h){
  try{
    const d = ctx.getImageData(0,0,Math.min(w,60),Math.min(h,60)).data;
    for(let i = 3; i < d.length; i += 4) if(d[i] < 250) return true;
  }catch(e){}
  return false;
}
const kb = n => n > 1e6 ? (n/1048576).toFixed(1)+' МБ' : Math.round(n/1024)+' КБ';

function pickImage(key, after){
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/*';
  inp.style.cssText = 'position:fixed;left:-9999px;opacity:0';
  document.body.appendChild(inp);
  inp.onchange = () => {
    const f = inp.files && inp.files[0];
    setTimeout(() => { try{ inp.remove(); }catch(e){} }, 500);
    if(!f) return;
    compressImage(f, async (data, info) => {
      MEDIA[key] = data;
      toast(`Фото загружено · ${kb(info.before)} → ${kb(info.after)}`);
      if(after) after(data, info); else render();
      if(typeof uploadImage === 'function'){
        const url = await uploadImage(key, data);
        if(url && url !== data){ MEDIA[key] = url; render(); }
        if(typeof syncPush === 'function') syncPush();
      }
    });
  };
  inp.click();
}

/* ---------- встраивание видео ---------- */
function videoUrl(id){
  const x = (typeof itemById === 'function') ? itemById(id) : null;
  if(x && x.video) return x.video;
  if(S.videos && S.videos[id]) return S.videos[id];
  if(S.editCourse || true){
    for(const cid in (S.lessons||{})){
      const l = (S.lessons[cid]||[]).find(u => u.id === id);
      if(l && l.video) return l.video;
    }
  }
  return '';
}
function embedSrc(url){
  if(!url) return null;
  let m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  if(m) return {type:'iframe', src:'https://www.youtube.com/embed/' + m[1]};
  m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if(m) return {type:'iframe', src:'https://player.vimeo.com/video/' + m[1]};
  m = url.match(/kinescope\.io\/(?:embed\/)?([\w-]+)/);
  if(m) return {type:'iframe', src:'https://kinescope.io/embed/' + m[1]};
  if(/\.(mp4|webm|mov)(\?|$)/i.test(url)) return {type:'video', src:url};
  return {type:'link', src:url};
}
/* есть ли по этому ключу настоящий проигрыватель, а не заглушка */
function hasPlayer(id){
  const e = embedSrc(videoUrl(id));
  return !!e && (e.type === 'iframe' || e.type === 'video');
}
function videoBlock(id, posterKind){
  const url = videoUrl(id), e = embedSrc(url);
  if(e && e.type === 'iframe')
    return `<iframe class="frame" src="${e.src}" allowfullscreen allow="autoplay; fullscreen; picture-in-picture"></iframe>`;
  if(e && e.type === 'video')
    return `<video class="frame" src="${safeUrl(e.src)}" controls playsinline
      poster="${safeUrl(MEDIA[id]||'')}" preload="metadata"></video>`;
  if(e && e.type === 'link')
    return `<a class="player" href="${e.src}" target="_blank" rel="noopener" style="text-decoration:none;display:grid">
      ${cover(id, posterKind||'practice')}<div class="pl">▶</div></a>`;
  return `<div class="player" onclick="toast('Видео ещё не добавлено')">
    ${cover(id, posterKind||'practice')}<div class="pl">▶</div></div>`;
}

