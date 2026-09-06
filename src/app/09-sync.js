/* =====================================================================
   СИНХРОНИЗАЦИЯ С СЕРВЕРОМ v2

   Главное отличие от первой версии: на сервер уходят отдельные ветки,
   а не всё состояние целиком, и в них никогда не попадает base64 картинок —
   только ссылки на файлы в /uploads. Именно из-за этого раньше молча
   срабатывал лимит post_max_size и данные не сохранялись.
   ===================================================================== */

/* ─────────────────────────────────────────────────────────────────
   ВХОД НА СЕРВЕР
   Общего ключа больше нет. Приложение входит по почте и паролю,
   сервер выдаёт токен сессии и сам решает, что этой женщине можно.
   Права администратора выдаются в файле data/config.php на хостинге.
   ───────────────────────────────────────────────────────────────── */

const SYNC = {
  base: 'api.php',
  alive: null,          // null — ещё не проверяли
  rev: 0,
  lastCode: 0,          // код последнего ответа сервера
  lastError: '',
  lastSaved: 0,
  queue: {},            // ветки, ждущие отправки
  sending: false,
  ready: null,          // обещание первой проверки связи
  get token(){ return Store.get('eva_token', ''); },
  set token(v){ v ? Store.set('eva_token', v) : Store.del('eva_token'); }
};

/* местная копия профиля: чтобы приложение открывалось и без сети */
function mirrorUser(u){
  if(!u || !u.email) return;
  const mail = String(u.email).toLowerCase();
  const all = DB.users();
  all[mail] = Object.assign({}, all[mail], {
    email: mail, name: u.name, role: u.role || 'user',
    verified: !!u.verified, created: u.created || Date.now()
  });
  DB.saveUsers(all);
}

/* сервер сказал, что токен больше не годится */
function dropSession(){
  SYNC.token = '';
  if(!S.user) return;
  const last = S.user.email;
  DB.clearSession();
  S.user = null; S.role = 'user'; S.avatar = '';
  S.auth = {mode:'login', email:last, pass:'', name:'',
    err:'Сессия истекла, войди ещё раз', code:'', sent:'', remember:true};
  S.screen = 'auth'; S.page = null; S.sheet = null; S.course = null;
  render(); stars();
}

async function apiCall(action, body, opts){
  opts = opts || {};
  if(SYNC.alive === false && !opts.force) return null;
  try {
    const tok = SYNC.token;
    let payload = null;
    if(body){
      payload = JSON.stringify(tok ? Object.assign({ token:tok }, body) : body);
      if(payload.length > 6_000_000){
        SYNC.lastError = 'пакет ' + Math.round(payload.length/1048576) + ' МБ — больше лимита хостинга. Сохраняю частями';
        return null;
      }
    }
    const init = payload
      ? { method:'POST', headers:{'Content-Type':'application/json'}, body:payload }
      : { cache:'no-store' };
    const url = SYNC.base + '?action=' + action + (tok && !payload ? '&token=' + encodeURIComponent(tok) : '');
    const res = await fetch(url, init);
    let j = null;
    try { j = await res.json(); }
    catch(e){ throw new Error('сервер ответил не в формате JSON (код ' + res.status + ')'); }
    if(!j.ok){
      SYNC.lastError = j.error || ('ошибка ' + res.status);
      SYNC.lastCode = res.status;              // 403 — запрещено навсегда, повтор не поможет
      if(res.status === 401 && tok) dropSession();
      if(!opts.silent) toast('Не сохранилось: ' + SYNC.lastError);
      return null;
    }
    SYNC.lastCode = 200;
    SYNC.lastError = '';
    return j;
  } catch(e){
    SYNC.lastError = e.message || 'нет связи с сервером';
    SYNC.lastCode = 0;                         // связи нет — повторить стоит
    if(!opts.silent) toast('Нет связи с сервером');
    return null;
  }
}

/* ---------- ветки общих данных ----------
   Всё, что здесь, видно каждому. Картинки хранятся ссылками. */
const BRANCHES = {
  lib:        () => LIB.map(clean),
  courses:    () => COURSES.map(clean),
  lessons:    () => S.lessons || {},
  modules:    () => S.modules || {},
  courseInfo: () => COURSE_INFO,
  courseTags: () => COURSE_TAGS,
  courseKind: () => COURSE_KIND,
  goods:      () => GOODS.map(clean),
  goodInfo:   () => GOOD_INFO,
  events:     () => EVENTS.map(clean),
  groups:     () => GROUPS.map(clean),
  experts:    () => EXPERTS.map(clean),
  pending:    () => S.pending || [],
  media:      () => mediaLinks(),
  videos:     () => S.videos || {},
  covPos:     () => S.covPos || {},
  wall:       () => (typeof WALL !== 'undefined' ? WALL.map(shareable) : []).concat(TOMBS.wall),
  chats:      () => Object.keys(S.chats || {}).reduce((acc, g) =>
                acc.concat((S.chats[g] || []).filter(m => m && m.id)
                  .map(m => ({...m, g, own:undefined}))), []).concat(TOMBS.chats),
  support:    () => (typeof INBOX !== 'undefined' ? INBOX : []),
  orders:     () => [...(typeof ORDERS !== 'undefined' ? ORDERS : []), ...(S.orders || [])],
  questions:  () => [...(typeof GOOD_QS !== 'undefined' ? GOOD_QS : []), ...(S.qs || [])],
  ideas:      () => S.ideas || [],
  adminInfo:  () => ({name:S.adminName, avatar:S.adminAvatar}),
  avatars:    () => AVATARS,
  replies:    () => S.marketReplies || [],
  reviews:    () => S.reviews || [],
  /* отметки «зашло» под посланиями дня: по записи на женщину и послание */
  tipstars:   () => (typeof TIP_VOTES !== 'undefined' ? TIP_VOTES : []),
  /* публичные карточки женщин: своя уезжает, чужие приходят обратно */
  people:     () => (typeof PEOPLE !== 'undefined' ? PEOPLE : [])
};

const clean = o => JSON.parse(JSON.stringify(o));

/* Надгробия: общий раздел на сервере умеет дописывать и обновлять записи,
   но не умеет стирать — иначе одна женщина могла бы вычистить чужое.
   Поэтому удалённое уезжает не «пропажей», а пометкой del: сервер обновит
   запись по номеру, а при загрузке помеченное мы просто не показываем. */
const TOMBS = {wall: [], chats: []};
function tombWall(id){ TOMBS.wall.push({id: String(id), del: true, a: '', t: ''}); }
function tombChat(gid, m){
  if(m && m.id) TOMBS.chats.push({id: String(m.id), g: gid, del: true, a: '', c: ''});
}
const alive = list => (Array.isArray(list) ? list.filter(x => x && !x.del) : list);

/* Из общих записей убираем всё, что верно только на этом устройстве.
   Метка «моё» раньше уезжала на сервер, и чужие послания приходили к другим
   помеченными как свои — вместе с чужой аватаркой. Автор теперь узнаётся
   по почте, а метка остаётся только в памяти браузера. */
function shareable(rec){
  const out = clean(rec);
  delete out.own; delete out.photo; delete out.kind; delete out.ints;
  if(out.email) out.email = String(out.email).toLowerCase();
  if(Array.isArray(out.comments)) out.comments = out.comments.map(c => {
    const cc = Object.assign({}, c); delete cc.own;
    if(cc.email) cc.email = String(cc.email).toLowerCase();
    return cc;
  });
  return out;
}

/* В общие данные попадают только ссылки на файлы, не base64.
   Аватарки не кладём: у них своя защищённая ветка, где каждая может писать
   только свою строку. Через общий справочник картинок чужое фото можно было
   бы подменить. */
function mediaLinks(){
  const out = {};
  Object.keys(MEDIA).forEach(k => {
    const v = MEDIA[k];
    if(k.indexOf('ava_') === 0) return;
    if(typeof v === 'string' && !v.startsWith('data:')) out[k] = v;
  });
  return out;
}

/* ---------- сохранение ---------- */
let syncTimer = null;

/* Что кому разрешено писать. Раньше отправляли всё подряд, и сервер отвечал
   «раздел lib меняют только эксперты и администраторы» — а падал при этом
   весь пакет целиком, вместе с посланием или сообщением, ради которых его
   и отправляли. Ветка, которую эта роль всё равно не запишет, теперь просто
   не уезжает. */
const OPEN_PUSH = ['wall','chats','groups','events','orders','questions',
                   'support','ideas','media','reviews','avatars','tipstars','people'];
function mayPush(b){
  if(S.role === 'admin')  return true;
  if(S.role === 'expert') return b !== 'adminInfo';
  return OPEN_PUSH.indexOf(b) >= 0;
}

/* поставить ветки в очередь; без аргументов — все, что относится к контенту */
function syncPush(branches, immediate){
  if(SYNC.alive === false) return;
  const list = branches || ['lib','courses','lessons','modules','courseInfo','courseTags','courseKind',
    'goods','goodInfo','events','experts','pending','media','videos','covPos','adminInfo','avatars',
    'groups','chats'];
  list.forEach(b => { if(BRANCHES[b] && mayPush(b)) SYNC.queue[b] = true; });
  if(!Object.keys(SYNC.queue).length) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(flushSync, immediate ? 0 : 800);
}

async function flushSync(){
  if(SYNC.sending || SYNC.alive === false) return;
  const names = Object.keys(SYNC.queue);
  if(!names.length) return;
  SYNC.sending = true;
  SYNC.queue = {};

  const parts = {};
  names.forEach(b => { try { parts[b] = BRANCHES[b](); } catch(e){} });

  // если пакет слишком большой — режем по одной ветке
  const size = JSON.stringify(parts).length;
  let okAll = true;
  if(size > 1_200_000){
    for(const b of names){
      const r = await apiCall('patch', { parts:{ [b]: parts[b] } });
      if(!r) okAll = false; else SYNC.rev = r.rev;
    }
  } else {
    const r = await apiCall('patch', { parts });
    if(!r) okAll = false; else SYNC.rev = r.rev;
  }
  SYNC.sending = false;
  if(okAll){
    SYNC.lastSaved = Date.now();
    updateSyncBadge('saved');
    if(S.role !== 'user' && !S.sheet) render();
    return;
  }
  /* Запрет не лечится повтором: раньше такая ветка возвращалась в очередь,
     уходила снова каждые пятнадцать секунд и каждый раз перерисовывала
     страницу — со стороны это выглядело как самопроизвольная перезагрузка. */
  if(SYNC.lastCode !== 403) names.forEach(b => SYNC.queue[b] = true);
  updateSyncBadge('error');
}

/* совместимость со старыми вызовами */
function pushShared(){ syncPush(); }

/* ---------- страховка от неполных данных ----------
   Материал, курс или товар может прийти с сервера без части полей: сохранили
   старой версией, оборвалась связь, поправили руками в файле. Раньше такой
   объект ронял весь экран. Дополняем безопасными значениями — пусть лучше
   будет пусто, чем белый лист. */
const okStr = (v, d) => (typeof v === 'string' ? v : (v == null ? (d || '') : String(v)));
const okNum = (v, d) => { const n = typeof v === 'number' ? v : parseFloat(v); return isFinite(n) ? n : (d || 0); };
const okArr = v => Array.isArray(v) ? v : [];
const okObj = v => (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};

/* оставляем только записи-объекты с идентификатором и дополняем их */
function fixList(list, fill){
  return okArr(list).filter(x => x && typeof x === 'object' && x.id != null)
                    .map(x => fill(Object.assign({}, x)));
}

const FIX = {
  chats: x => {
    x.id = String(x.id); x.g = okStr(x.g);
    x.a = okStr(x.a, 'Гостья'); x.t = okStr(x.t); x.tm = okStr(x.tm);
    x.c = okStr(x.c); x.email = okStr(x.email).toLowerCase();
    x.at = okNum(x.at); x.exp = !!x.exp; x.curator = !!x.curator;
    /* метка «моё» верна только на своём устройстве: узнаём автора по почте */
    delete x.own;
    x.re = x.re && typeof x.re === 'object'
      ? {a:okStr(x.re.a), t:okStr(x.re.t)} : null;
    return x;
  },
  groups: x => {
    x.id = String(x.id); x.t = okStr(x.t, 'Сообщество');
    x.e = okStr(x.e, '🌸'); x.c = okStr(x.c, '#B64F7C');
    x.m = okNum(x.m); x.price = okNum(x.price);
    x.about = okStr(x.about); x.who = okStr(x.who); x.welcome = okStr(x.welcome);
    x.lead = okStr(x.lead); x.owner = okStr(x.owner).toLowerCase();
    x.note = okStr(x.note);
    x.access = ['open','request','club','experts'].indexOf(x.access) >= 0 ? x.access : 'open';
    x.status = ['live','pending','rework','refused','closed'].indexOf(x.status) >= 0 ? x.status : 'live';
    x.tags  = Array.isArray(x.tags)  ? x.tags.map(t => okStr(t)).filter(Boolean) : [];
    x.rules = Array.isArray(x.rules) ? x.rules.map(r => okStr(r)).filter(Boolean) : [];
    x.team  = Array.isArray(x.team) ? x.team.map(m => ({
      n:okStr(m && m.n, 'Помощница'), r:okStr(m && m.r), e:okStr(m && m.e),
      mail:okStr(m && m.mail).toLowerCase(),
      role:['owner','host','keeper'].indexOf(m && m.role) >= 0 ? m.role : 'keeper'
    })) : [];
    x.requests = Array.isArray(x.requests) ? x.requests.map(r => ({
      n:okStr(r && r.n, 'Гостья'), mail:okStr(r && r.mail).toLowerCase(),
      ago:okStr(r && r.ago, 'недавно'), t:okStr(r && r.t)
    })) : [];
    return x;
  },
  lib: x => {
    x.id = String(x.id); x.t = okStr(x.t, 'Без названия');
    x.type = ['affirm','practice','class'].indexOf(x.type) >= 0 ? x.type : 'practice';
    x.min = okNum(x.min, 5); x.expert = okStr(x.expert);
    x.tags = okArr(x.tags).map(t => okStr(t)); x.d = okStr(x.d); x.text = okStr(x.text);
    x.topics = okArr(x.topics).map(t => okStr(t)).filter(Boolean); x.ord = okNum(x.ord);
    x.aud = okArr(x.aud); x.days = okArr(x.days); x.level = okStr(x.level, 'any');
    return x;
  },
  courses: x => {
    x.id = String(x.id); x.t = okStr(x.t, 'Без названия'); x.e = okStr(x.e);
    x.n = okNum(x.n, 1); x.p = okNum(x.p); x.old = okNum(x.old, x.p);
    x.r = okNum(x.r, 5); x.s = okNum(x.s); x.d = okStr(x.d);
    return x;
  },
  goods: x => {
    x.id = String(x.id); x.t = okStr(x.t, 'Без названия'); x.p = okNum(x.p);
    x.c = okStr(x.c, 'Разное'); x.sh = okStr(x.sh, 'mat');
    return x;
  },
  experts: x => {
    x.id = String(x.id); x.n = okStr(x.n, 'Эксперт'); x.r = okStr(x.r);
    x.rate = okNum(x.rate, 5); x.t = okArr(x.t); x.who = okArr(x.who);
    x.ach = okArr(x.ach); x.services = okArr(x.services);
    /* почта связывает карточку с аккаунтом, по ней же сервер понимает,
       чьи это материалы */
    x.email = okStr(x.email).toLowerCase();
    return x;
  },
  events: x => {
    x.id = String(x.id); x.t = okStr(x.t, 'Встреча'); x.city = okStr(x.city);
    x.by = okStr(x.by); x.mode = x.mode === 'онлайн' ? 'онлайн' : 'офлайн';
    x.d = okStr(x.d, new Date().toISOString().slice(0,10)); x.tm = okStr(x.tm, '19:00');
    x.left = okNum(x.left); x.seats = okNum(x.seats, x.left); x.price = okNum(x.price);
    x.closed = !!x.closed;              // закрытая встреча не попадает на страницы участниц
    x.about = okStr(x.about); x.kind = okStr(x.kind, 'Встреча'); x.gallery = okArr(x.gallery);
    x.full = okStr(x.full); x.who = okStr(x.who); x.bring = okStr(x.bring);
    x.program = okArr(x.program).map(v => okStr(v)).filter(Boolean);
    return x;
  },
  wall: x => {
    x.id = String(x.id); x.a = okStr(x.a, 'Гостья'); x.t = okStr(x.t);
    x.st = okNum(x.st);
    x.email = okStr(x.email).toLowerCase();
    x.city = okStr(x.city); x.ago = okStr(x.ago, 'недавно');
    /* старые послания могли прийти с фото, поводом и темами — просто
       забываем эти поля: в ленте их больше нет */
    delete x.photo; delete x.kind; delete x.ints;
    delete x.own;                       /* чужая метка «моё» с сервера не в счёт */
    x.comments = okArr(x.comments).filter(c => c && typeof c === 'object')
                  .map(c => { const cc = {...c, a: okStr(c.a, 'Гостья'), t: okStr(c.t),
                                ago: okStr(c.ago), st: okNum(c.st),
                                email: okStr(c.email).toLowerCase()};
                              delete cc.own; return cc; });
    return x;
  },
  people: x => {
    x.id = okStr(x.id).toLowerCase(); x.n = okStr(x.n, 'Женщина');
    x.city = okStr(x.city); x.about = okStr(x.about).slice(0, 300);
    x.since = okNum(x.since, Date.now());
    ['ints','shelf','follows','mates','next','past'].forEach(k => {
      x[k] = okArr(x[k]).map(v => okStr(v)).filter(Boolean).slice(0, 40);
    });
    x.mates = x.mates.map(v => v.toLowerCase());
    x.showMates = x.showMates !== false;
    x.dating = x.dating && typeof x.dating === 'object'
      ? {goal:okStr(x.dating.goal), city:okStr(x.dating.city)} : null;
    return x;
  },
  plain: x => x                                   // заказы, вопросы, поддержка, идеи
};

function fixShared(sh){
  ['lib','courses','goods','experts','events','wall','people'].forEach(k => {
    if(sh[k] !== undefined) sh[k] = fixList(sh[k], FIX[k]);
  });
  ['orders','questions','support','ideas','pending','replies','reviews','tipstars'].forEach(k => {
    if(sh[k] !== undefined) sh[k] = fixList(sh[k], FIX.plain);
  });
  if(sh.goodInfo !== undefined){
    const src = okObj(sh.goodInfo), out = {};
    Object.keys(src).forEach(id => {
      const i = okObj(src[id]);
      out[id] = Object.assign({}, i, {
        about: okStr(i.about), gallery: okArr(i.gallery), spec: okArr(i.spec),
        stock: okNum(i.stock, 0),
        delivery: Object.assign({free:false, price:390, cities:'', pickup:false}, okObj(i.delivery))
      });
    });
    sh.goodInfo = out;
  }
  if(sh.courseInfo !== undefined){
    const src = okObj(sh.courseInfo), out = {};
    Object.keys(src).forEach(id => {
      const i = okObj(src[id]);
      out[id] = Object.assign({}, i, {promo: okStr(i.promo), about: okStr(i.about)});
    });
    sh.courseInfo = out;
  }
  ['courseTags','courseKind','media','videos','covPos','avatars','lessons','modules'].forEach(k => {
    if(sh[k] !== undefined) sh[k] = okObj(sh[k]);
  });
  return sh;
}

/* ---------- чтение ---------- */
function applyShared(sh){
  if(!sh || typeof sh !== 'object') return false;
  try { sh = fixShared(sh); }
  catch(e){ console.error('[Eva] данные с сервера пришли в неожиданном виде:', e); }
  const repl = (arr, data) => { if(Array.isArray(data) && data.length){ arr.length = 0; data.forEach(x => arr.push(x)); } };
  repl(LIB, sh.lib);
  repl(COURSES, sh.courses);
  repl(GOODS, sh.goods);
  repl(EVENTS, sh.events);
  repl(GROUPS, sh.groups);
  if(typeof WALL !== 'undefined')  repl(WALL, alive(sh.wall));
  if(typeof INBOX !== 'undefined') repl(INBOX, sh.support);
  if(Array.isArray(sh.experts)) sh.experts.forEach(e => {
    const cur = EXPERTS.find(x => x.id === e.id);
    if(cur) Object.assign(cur, e); else EXPERTS.push(e);
  });
  const maps = {courseInfo:COURSE_INFO, courseTags:COURSE_TAGS, courseKind:COURSE_KIND, goodInfo:GOOD_INFO};
  Object.keys(maps).forEach(k => { if(sh[k] && typeof sh[k] === 'object') Object.assign(maps[k], sh[k]); });
  if(sh.media)   Object.assign(MEDIA, sh.media);
  if(Array.isArray(sh.chats) && sh.chats.length){
    /* обратно из плоского списка в переписку по группам, по времени */
    const by = {};
    sh.chats.forEach(m => {
      const g = okStr(m && m.g);
      if(!g || !m.id || m.del) return;
      (by[g] = by[g] || []).push(m);
    });
    S.chats = S.chats || {};
    Object.keys(by).forEach(g => {
      S.chats[g] = by[g].sort((a, b) => (a.at || 0) - (b.at || 0));
    });
  }
  if(sh.videos)  S.videos = Object.assign(S.videos || {}, sh.videos);
  if(sh.covPos)  S.covPos = Object.assign(S.covPos || {}, sh.covPos);
  if(sh.lessons) S.lessons = Object.assign(S.lessons || {}, sh.lessons);
  if(sh.modules) S.modules = Object.assign(S.modules || {}, sh.modules);
  if(Array.isArray(sh.pending) && sh.pending.length) S.pending = sh.pending;
  if(Array.isArray(sh.ideas)   && sh.ideas.length)   S.ideas = sh.ideas;
  if(Array.isArray(sh.replies)) S.marketReplies = sh.replies;
  if(Array.isArray(sh.reviews)) S.reviews = sh.reviews;
  if(Array.isArray(sh.people) && typeof PEOPLE !== 'undefined'){
    PEOPLE.length = 0;
    sh.people.filter(x => x && x.id).forEach(x => PEOPLE.push(x));
  }
  if(Array.isArray(sh.tipstars)) TIP_VOTES = sh.tipstars.filter(v => v && v.id && v.k);
  /* снятые звёзды приходят пометками — свои отметки восстанавливаем по ним же */
  if(Array.isArray(sh.tipstars) && S.user && S.user.email){
    const me = String(S.user.email).toLowerCase();
    S.tipStars = TIP_VOTES.filter(v => !v.del && v.id === v.k + '__' + me).map(v => v.k);
  }
  if(sh.avatars && typeof sh.avatars === 'object'){
    Object.keys(sh.avatars).forEach(m => {
      const key = String(m).toLowerCase();
      if(sh.avatars[m] && typeof sh.avatars[m] === 'string') AVATARS[key] = sh.avatars[m];
    });
    const me = S.user ? String(S.user.email).toLowerCase() : '';
    if(me && AVATARS[me]) S.avatar = AVATARS[me];
  }
  if(sh.adminInfo && typeof sh.adminInfo === 'object'){
    if(sh.adminInfo.name) S.adminName = sh.adminInfo.name;
    if(sh.adminInfo.avatar) S.adminAvatar = sh.adminInfo.avatar;
  }
  if(Array.isArray(sh.orders) && typeof ORDERS !== 'undefined'){
    ORDERS.length = 0; sh.orders.forEach(o => ORDERS.push(o)); S.orders = [];
  }
  if(Array.isArray(sh.questions) && typeof GOOD_QS !== 'undefined'){
    GOOD_QS.length = 0; sh.questions.forEach(q => GOOD_QS.push(q)); S.qs = [];
  }
  return true;
}

async function syncPull(silent){
  /* фоновая проверка: сначала спрашиваем только номер версии — это
     несколько байт вместо всей базы. Тянем данные, лишь если он другой. */
  if(silent && SYNC.rev){
    const head = await apiCall('rev', null, { silent:true });
    if(head && head.rev === SYNC.rev) return false;
  }
  const r = await apiCall('state', null, { silent:true });
  if(!r) return false;
  if(r.rev === SYNC.rev && silent) return false;
  SYNC.rev = r.rev;
  const changed = applyShared(r.shared);
  if(changed && !silent) render();
  return changed;
}

/* ---------- файлы ---------- */
async function uploadImage(id, dataUrl){
  if(SYNC.alive === false) return dataUrl;
  const r = await apiCall('upload', { id, data:dataUrl });
  if(r && r.url) return r.url;
  toast('Фото осталось только на этом устройстве: ' + (SYNC.lastError || 'сервер недоступен'));
  return dataUrl;
}

/* ---------- личные сообщения от платформы ----------
   Лежат на сервере отдельно от общих данных: каждая женщина забирает только
   свои. Поэтому и читаем их отдельным запросом, а не из общего состояния. */
async function pullDm(){
  if(SYNC.alive === false || !SYNC.token || !S.user || !S.user.email) return false;
  const r = await apiCall('dm_get', null, { silent:true });
  if(!r || !Array.isArray(r.dm) || !r.dm.length) return false;
  if(typeof initInbox === 'function') initInbox();
  S.seenDm = S.seenDm || [];
  const fresh = r.dm.filter(m => m && m.id && S.seenDm.indexOf(m.id) < 0);
  if(!fresh.length) return false;

  let th = (S.inbox || []).find(x => x.kind === 'платформа');
  if(!th){
    th = {id:'pf' + Date.now().toString(36), from:'Eva Space', c:'#111014',
          kind:'платформа', ago:'только что', unread:false, sys:true, msgs:[]};
    S.inbox.unshift(th);
  }
  fresh.forEach(m => {
    const d = new Date(m.at || Date.now());
    const tm = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
    th.msgs.push({me:false, t:(m.subject ? m.subject + ' — ' : '') + m.text, tm});
    S.seenDm.push(m.id);
  });
  th.unread = true;
  if(typeof schedulePersist === 'function') schedulePersist();
  return true;
}

/* ---------- аккаунты и прогресс ---------- */
/* на сервер уходит только профиль: пароль и права меняются не здесь */
async function syncUser(u){
  if(SYNC.alive === false || !SYNC.token || !u || !u.email) return;
  await apiCall('user_save', { user:{ email:u.email, name:u.name, avatar:u.avatar || '' } }, { silent:true });
}
/* Список аккаунтов сервер отдаёт только администратору.
   Данные сервера главнее местной копии: иначе роль, имя и отметка о почте
   остаются старыми — например, только что выданная роль эксперта тут же
   затирается тем, что лежало в браузере. Местные поля, которых на сервере
   нет (пароль для работы без сети), при этом сохраняются. */
async function pullUsers(){
  if(S.role !== 'admin') return;
  const r = await apiCall('users', null, { silent:true });
  if(!r || !r.users || typeof r.users !== 'object') return;
  const local = DB.users(), merged = {};
  Object.keys(local).forEach(k => merged[k] = local[k]);
  Object.keys(r.users).forEach(k => merged[k] = Object.assign({}, local[k], r.users[k]));
  DB.saveUsers(merged);
}
async function pushProgress(){
  if(SYNC.alive === false || !S.user || !S.user.email) return;
  const d = DB.progress(S.user.email);
  if(d) await apiCall('progress_save', { email:S.user.email, progress:d }, { silent:true });
}
async function pullProgress(email){
  const r = await apiCall('progress_get&email=' + encodeURIComponent(email), null, { silent:true });
  if(!r || !r.progress) return false;
  const local = DB.progress(email);
  if(local && (local.savedAt || 0) > (r.progress.savedAt || 0)){
    await apiCall('progress_save', { email, progress:local }, { silent:true });
    return true;
  }
  DB.saveProgress(email, r.progress);
  return true;
}

/* ---------- индикатор состояния ---------- */
function updateSyncBadge(state){
  const el = document.getElementById('syncdot');
  if(!el) return;
  el.className = 'syncdot ' + (state || '');
  el.title = state === 'error' ? ('Не сохранено: ' + SYNC.lastError) : 'Сохранено на сервере';
}
function syncStatusLine(){
  if(SYNC.alive === null) return '';
  if(SYNC.alive === false)
    return `<button class="syncbar off" onclick="openSheet('diag')">
      <span class="syncdot off"></span>Локальный режим: сервер не подключён, данные видны только здесь</button>`;
  if(SYNC.lastError)
    return `<button class="syncbar err" onclick="openSheet('diag')">
      <span class="syncdot error"></span>Не сохранено: ${esc(SYNC.lastError)}. Нажми, чтобы проверить</button>`;
  return `<button class="syncbar" onclick="openSheet('diag')">
    <span class="syncdot" id="syncdot"></span>Данные сохраняются на сервере${SYNC.lastSaved ? ' · ' + new Date(SYNC.lastSaved).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}) : ''}</button>`;
}

/* ---------- диагностика ---------- */
function shDiag(){
  const d = S.diag;
  const row = (l, v, good) => `<div class="uline"><span class="small muted" style="flex:1">${l}</span>
    <b style="font-size:12.5px;color:${good === undefined ? 'var(--ink)' : good ? 'var(--ok)' : 'var(--accent)'}">${v}</b></div>`;
  return `<h2 class="serif" style="font-size:22px;margin:0 0 6px">Состояние сервера</h2>
    <p class="small muted" style="margin:0 0 12px">Проверка связи, прав на папки и твоего доступа.</p>
    ${!d ? `<button class="btn" onclick="runDiag()">Проверить</button>` : `
      <div class="card">
        ${row('Связь с api.php', d.err ? 'нет' : 'есть', !d.err)}
        ${d.err ? `<div class="small" style="color:var(--accent);margin-top:8px">${esc(d.err)}</div>` : `
          ${row('Запись в data', d.data_ok ? 'работает' : 'НЕТ', d.data_ok)}
          ${row('Запись в uploads', d.uploads_ok ? 'работает' : 'НЕТ', d.uploads_ok)}
          ${row('Администратор назначен', d.config_ok ? 'да' : 'НЕТ', d.config_ok)}
          ${row('Твои права', {admin:'администратор', expert:'эксперт', user:'пользователь'}[d.you] || 'не вошла')}
          ${d.php ? `
            ${row('PHP', d.php)}
            ${row('Файлов загружено', d.uploads_count)}
            ${row('Размер базы', (d.db_size/1024).toFixed(1) + ' КБ')}
            ${row('Версия данных', d.rev)}
            ${row('Аккаунтов', d.users)}
            ${row('Открытых сессий', d.sessions)}
            ${row('Лимит запроса', d.post_max)}
            ${row('Разделов сохранено', (d.branches||[]).length)}
            ${d.legacy_pass ? row('Пароли старого образца', d.legacy_pass) : ''}
          ` : ''}
        `}
      </div>
      ${(d.problems||[]).length ? `<div class="card" style="border-color:var(--accent)">
        <b style="font-size:14px">Что мешает</b>
        ${d.problems.map(p => `<div class="small" style="margin-top:6px">— ${esc(p)}</div>`).join('')}
      </div>` : ''}
      ${d.config_ok === false ? `<div class="card" style="border-color:var(--warn)">
        <b style="font-size:14px">Администратор не назначен</b>
        <div class="small muted" style="margin-top:5px">Откройте на хостинге файл data/config.php и впишите свою почту
          в список admins. Пока список пуст, панель управления недоступна никому.</div></div>` : ''}
      <div class="acts">
        <button class="btn ghost" onclick="runDiag()">Проверить снова</button>
        <button class="btn ghost" onclick="syncPush(null,true);toast('Отправляю данные на сервер')">Сохранить всё</button>
      </div>
      <button class="btn ghost" style="margin-top:8px" onclick="backupDB()">Скачать резервную копию</button>
    `}`;
}
async function runDiag(){
  const r = await apiCall('diag', null, { silent:true, force:true });
  S.diag = r ? r : { err: SYNC.lastError || 'сервер не отвечает' };
  render();
}
async function backupDB(){
  const r = await apiCall('export', null, { silent:true });
  if(!r) return toast('Не удалось выгрузить: ' + SYNC.lastError);
  const a = document.createElement('a');
  a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(r.db, null, 2));
  a.download = 'eva-backup-' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  toast('Копия сохранена');
}

/* ---------- запуск ---------- */
async function initSync(){
  const ping = await apiCall('ping', null, { silent:true, force:true });
  SYNC.alive = !!ping;
  if(!SYNC.alive){
    console.info('[Eva] Сервер не найден — работаем локально в этом браузере');
    return;
  }
  await syncPull(true);
  await pullDm();
  if(S.screen === 'app') render();
  /* пока вкладка не на виду, сервер не тревожим совсем */
  setInterval(() => {
    if(document.hidden || SYNC.sending || S.sheet) return;
    syncPull(true).then(ch => { if(ch) softRender(); });
    pullDm().then(ch => { if(ch) softRender(); });
  }, 30000);
  document.addEventListener('visibilitychange', () => {
    if(!document.hidden && !SYNC.sending) syncPull(true).then(ch => { if(ch) softRender(); });
  });
  // если что-то не отправилось — пробуем ещё раз
  setInterval(() => { if(Object.keys(SYNC.queue).length) flushSync(); }, 15000);
  window.addEventListener('online', () => { SYNC.alive = true; flushSync(); });
}

/* =====================================================================
   PWA
   ===================================================================== */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); deferredPrompt = e;
  if(!Store.get('eva_install_hidden')) showInstallBar();
});
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isMobile = () => /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);

function showUpdateBar(){
  if(document.getElementById('updbar')) return;
  const el = document.createElement('div');
  el.className = 'installbar pop'; el.id = 'updbar';
  el.innerHTML = '<div class="ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" ' +
    'stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M4 12a8 8 0 0 1 13.7-5.7M20 12a8 8 0 0 1-13.7 5.7"/>' +
    '<path d="M18 3v4h-4M6 21v-4h4"/></svg></div>' +
    '<div style="flex:1;min-width:0"><b>Есть новая версия</b>' +
    '<div class="small">Обновится за секунду, данные на месте</div></div>' +
    '<button class="go" onclick="location.reload()">Обновить</button>' +
    '<button class="cl" onclick="this.parentElement.remove()">✕</button>';
  document.body.appendChild(el);
}

function showInstallBar(){
  if(isStandalone() || document.getElementById('installbar')) return;
  const el = document.createElement('div');
  el.className = 'installbar pop'; el.id = 'installbar';
  el.innerHTML = '<div class="ic"><svg width="20" height="20" viewBox="0 0 100 100">' +
    '<path d="M50 2c1.6 16.4 4.4 27.4 8.8 33.6C63.2 41.8 73.6 45.6 90 48c-16.4 2.4-26.8 6.2-31.2 12.4C54.4 66.6 51.6 79 50 98c-1.6-19-4.4-31.4-8.8-37.6C36.8 54.2 26.4 50.4 10 48c16.4-2.4 26.8-6.2 31.2-12.4C45.6 29.4 48.4 18.4 50 2z" fill="#fff"/>' +
    '</svg></div><div style="flex:1;min-width:0"><b>Установить Eva Space</b>' +
    '<div class="small">Быстрый доступ с экрана телефона</div></div>' +
    '<button class="go" onclick="doInstall()">Установить</button>' +
    '<button class="cl" onclick="hideInstallBar()">✕</button>';
  document.body.appendChild(el);
}
function hideInstallBar(){
  const el = document.getElementById('installbar');
  if(el) el.remove();
  Store.set('eva_install_hidden', Date.now());
}
async function doInstall(){
  if(deferredPrompt){
    deferredPrompt.prompt();
    const res = await deferredPrompt.userChoice;
    deferredPrompt = null; hideInstallBar();
    if(res && res.outcome === 'accepted') toast('Eva Space установлена');
    return;
  }
  hideInstallBar(); openSheet('install');
}
function shInstall(){
  const steps = isIOS()
    ? ['Нажми кнопку «Поделиться» внизу экрана Safari',
       'Пролистай меню и выбери «На экран Домой»',
       'Нажми «Добавить» — Eva Space появится рядом с другими приложениями']
    : ['Открой меню браузера — три точки в правом верхнем углу',
       'Выбери «Установить приложение» или «Добавить на главный экран»',
       'Подтверди — Eva Space появится на рабочем столе'];
  return `<div style="text-align:center;padding:4px 0 8px">
      <div style="width:56px;height:56px;border-radius:16px;background:var(--grad-dark);display:grid;place-items:center;margin:0 auto 12px">
        <svg width="28" height="28" viewBox="0 0 100 100"><path d="${STAR_PATH}" fill="#fff"/></svg></div>
      <h2 class="serif" style="font-size:22px;margin:0 0 6px">Eva Space на телефоне</h2>
      <p class="small muted" style="margin:0">Открывается как обычное приложение: без адресной строки, с иконкой на экране</p>
    </div>
    <div class="iosbox">
      ${steps.map((t,i) => `<div class="iosstep"><span class="iosnum">${i+1}</span><span>${t}</span></div>`).join('')}
    </div>
    <button class="btn" onclick="closeSheet()">Понятно</button>`;
}
function initPWA(){
  if('serviceWorker' in navigator && location.protocol.startsWith('http')){
    navigator.serviceWorker.register('sw.js')
      .then(() => { if(typeof pushSync === 'function') pushSync(); })
      .catch(() => {});
    /* приложение отдаётся из памяти телефона, а свежая версия догружается
       следом: когда она пришла — предлагаем обновиться, а не подменяем
       страницу под руками */
    navigator.serviceWorker.addEventListener('message', e => {
      if(!e.data || e.data.eva !== 'update' || S.newVersion) return;
      S.newVersion = true;
      if(!S.sheet) showUpdateBar();
    });
  }
  if(isMobile() && !isStandalone() && !Store.get('eva_install_hidden')){
    setTimeout(() => { if(!deferredPrompt) showInstallBar(); }, 4000);
  }
}

