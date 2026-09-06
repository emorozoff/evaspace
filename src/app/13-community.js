/* =====================================================================
   СООБЩЕСТВА: РОЛИ, СОЗДАНИЕ, УПРАВЛЕНИЕ
   Роль на платформе и роль в сообществе — разные вещи. Обычная участница
   может быть владелицей своего круга и решать там всё, оставаясь обычной
   участницей на самой платформе. Администратор платформы может всё и
   везде: за платформу отвечает он.
   ===================================================================== */

const GROLES = {
  owner:  {n:'Владелица',     s:'Описание, команда, заявки, закрытие'},
  host:   {n:'Со-ведущая',    s:'Правит описание, принимает заявки, закрепляет'},
  keeper: {n:'Хранительница', s:'Следит за разговором и встречает новеньких'},
  member: {n:'Участница',     s:'Пишет и отвечает'}
};

const GACCESS = {
  open:    {n:'Открытое',      s:'Заходит любая участница платформы'},
  request: {n:'По заявке',     s:'Видно описание, переписка — после одобрения'},
  club:    {n:'Клуб',          s:'Доступ по подписке, помесячно'},
  experts: {n:'Для экспертов', s:'Только эксперты платформы'},
  anon:    {n:'Анонимное',     s:'Ни имён, ни лиц. Ведёт редакция Евы'}
};

/* =====================================================================
   АНОНИМНЫЕ СООБЩЕСТВА
   Есть разговоры, которые не начинают под своим именем: насилие, долги,
   зависимость, мысли, за которые стыдно. Такой группе мало убрать аватар
   с экрана — нужно, чтобы имени не было в самих данных.

   Поэтому здесь не «скрытие», а другой способ подписывать сообщения.
   В анонимной группе сообщение уходит без почты и без имени, а вместо
   них — прозвище: «Участница 7». Оно считается из почты и номера группы,
   поэтому в одной группе женщина всегда одна и та же, а в соседней —
   другая, и связать их между собой нельзя. Ни на сервере, ни у нас.

   Из этого следует всё остальное:
   · нажать на имя и попасть на её страницу нельзя — почты в сообщении нет;
   · вести такую группу может только редакция: у обычной женщины не может
     быть права молчаливо узнать, кто написал;
   · модерация работает по прозвищу — этого хватает, чтобы убрать сообщение
     и остановить того, кто портит разговор, и не хватает, чтобы узнать её;
   · баллов за сообщения здесь не начисляем: «+5 баллов» под рассказом
     о насилии — это неуважение, а заодно и след в её счёте.
   ===================================================================== */
const isAnon = g => !!g && g.access === 'anon';

/* Прозвище: считаем из почты и номера группы. Число небольшое нарочно —
   «Участница 7» читается как человек, а не как опознавательный код. */
function anonNo(mail, gid){
  const src = String(mail || '').toLowerCase() + '|' + String(gid || '');
  let h = 5381;
  for(let i = 0; i < src.length; i++) h = ((h << 5) + h + src.charCodeAt(i)) >>> 0;
  return (h % 89) + 1;
}
const anonName = (mail, gid) => 'Участница ' + anonNo(mail, gid);
const myAnonName = gid => anonName(myMail(), gid);

/* Молчание по прозвищу: редакция может остановить того, кто портит
   разговор, не зная, кто это. Список хранится в самой группе. */
function anonMuted(g, name){
  return isAnon(g) && (g.muted || []).indexOf(String(name)) >= 0;
}
function anonMute(gid, name){
  const g = GROUPS.find(x => x.id === gid);
  if(!g || !isAnon(g)) return;
  g.muted = g.muted || [];
  const at = g.muted.indexOf(name);
  if(at >= 0) g.muted.splice(at, 1); else g.muted.push(name);
  render(); pushShared();
  toast(at >= 0 ? name + ' снова может писать' : name + ' больше не пишет здесь');
}

/* Что можно каждой роли. Список плоский нарочно: так его видно целиком
   и не приходится держать в голове иерархию. */
const GRIGHTS = {
  owner:   ['read','write','delAny','pin','mute','kick','accept','edit','team','price','close'],
  host:    ['read','write','delAny','pin','mute','kick','accept','edit'],
  keeper:  ['read','write','delAny','mute','greet'],
  member:  ['read','write'],
  visitor: []
};

function myGRole(g){
  if(!g) return 'visitor';
  /* В анонимной комнате нет ни владелицы, ни со-ведущих: право удалить
     сообщение и закрыть кому-то письмо — это право модерации, а модерация
     здесь только у редакции. Иначе одна из участниц молча получила бы
     власть над остальными, оставаясь для них безымянной. */
  if(isAnon(g)) return S.role === 'admin' ? 'owner' : (S.joined || []).indexOf(g.id) >= 0 ? 'member' : 'visitor';
  const me = myMail();
  if(me && g.owner && String(g.owner).toLowerCase() === me) return 'owner';
  /* в демонстрационных сообществах почт нет: ведущую узнаём по имени */
  if(S.role === 'expert' && g.lead && g.lead === (S.name || '')) return 'owner';
  const t = (g.team || []).find(m => m.mail && String(m.mail).toLowerCase() === me);
  if(t) return t.role || 'keeper';
  return (S.joined || []).includes(g.id) ? 'member' : 'visitor';
}

function gCan(g, act){
  if(S.role === 'admin') return true;
  return (GRIGHTS[myGRole(g)] || []).indexOf(act) >= 0;
}

/* сообщества, которыми она управляет — для кабинета эксперта и админки */
/* =====================================================================
   СОЗДАНИЕ
   Между черновиком и живым сообществом всегда стоит человек: это защищает
   от мусора и от групп, которые никто не ведёт.
   ===================================================================== */

const G_EMOJI = ['🧘‍♀️','🌙','👶','💼','🌸','📖','🏃','🤍','🌿','☕','🎨','🔥'];
const G_COLORS = ['#4E8F84','#8054B8','#D18A5B','#5E5FA8','#B64F7C','#3F7D62','#B8894A','#6C5CE0'];

function newGroup(){
  S.gdraft = {t:'', about:'', who:'', access:'open', e:'🌸', c:'#B64F7C',
              rules:['','',''], welcome:'', price:1500};
  openSheet('newGroup');
}

function shNewGroup(){
  const d = S.gdraft = S.gdraft || {t:'', about:'', who:'', access:'open', e:'🌸',
                                    c:'#B64F7C', rules:['','',''], welcome:'', price:1500};
  return `<h2 class="serif" style="font-size:22px;margin:0 0 4px">Своё сообщество</h2>
    <p class="small muted" style="margin:0 0 14px">Заполни, что успеешь — черновик сохранится.
      Отправишь, когда будет готово: мы посмотрим и откроем.</p>

    <label class="lbl">Название</label>
    <input class="field" id="ng_t" placeholder="Например, «Мамы двойняшек»"
      value="${esc(d.t)}" oninput="S.gdraft.t=this.value">

    <label class="lbl">О чём это</label>
    <textarea class="field" id="ng_a" rows="3" placeholder="Пара строк о том, что здесь происходит"
      oninput="S.gdraft.about=this.value">${esc(d.about)}</textarea>

    <label class="lbl">Кто здесь</label>
    <input class="field" id="ng_w" placeholder="Кому сюда — одной строкой"
      value="${esc(d.who)}" oninput="S.gdraft.who=this.value">

    <label class="lbl">Знак и цвет</label>
    <div class="chips wrap" style="padding-bottom:6px">${G_EMOJI.map(e =>
      `<button class="chip ${d.e===e?'on':''}" onclick="S.gdraft.e='${attJs(e)}';render()">${e}</button>`).join('')}</div>
    <div class="gcolors">${G_COLORS.map(c =>
      `<button class="gcol ${d.c===c?'on':''}" style="background:${safeColor(c)}"
        onclick="S.gdraft.c='${attJs(c)}';render()" aria-label="Цвет"></button>`).join('')}</div>

    <label class="lbl" style="margin-top:12px">Кто может войти</label>
    ${Object.entries(GACCESS).filter(([k]) => k !== 'experts' && k !== 'anon').map(([k,v]) =>
      `<button class="optl ${d.access===k?'on':''}" onclick="S.gdraft.access='${attJs(k)}';render()">
        <b style="display:block;font-size:13.5px">${v.n}</b>
        <span class="small muted">${v.s}</span></button>`).join('')}
    ${d.access === 'club' ? `<input class="field" type="number" placeholder="Цена в месяц, ₽"
      value="${d.price||''}" oninput="S.gdraft.price=+this.value||0">` : ''}

    <label class="lbl" style="margin-top:8px">О чём договорились — до трёх правил</label>
    ${[0,1,2].map(i => `<input class="field" placeholder="Правило ${i+1}"
      value="${esc(d.rules[i]||'')}" oninput="S.gdraft.rules[${i}]=this.value">`).join('')}

    <label class="lbl">Приветствие новеньким</label>
    <textarea class="field" rows="3" placeholder="Что она увидит, когда войдёт"
      oninput="S.gdraft.welcome=this.value">${esc(d.welcome)}</textarea>

    <button class="btn" style="margin-top:6px" onclick="sendGroup()">Отправить на согласование</button>
    <button class="btn ghost" style="margin-top:9px" onclick="closeSheet();toast('Черновик сохранён')">
      Сохранить черновик</button>`;
}

function sendGroup(){
  const d = S.gdraft || {};
  if(!(d.t || '').trim())     return toast('Как называется сообщество?');
  if((d.about || '').trim().length < 20) return toast('Расскажи чуть подробнее, о чём это');
  const id = 'g' + Date.now().toString(36);
  GROUPS.push({
    id, t:d.t.trim(), e:d.e || '🌸', c:d.c || '#B64F7C', m:1,
    access:d.access || 'open', price:d.access === 'club' ? (d.price || 0) : 0,
    about:d.about.trim(), who:(d.who || '').trim(),
    rules:(d.rules || []).map(r => r.trim()).filter(Boolean),
    welcome:(d.welcome || '').trim(),
    lead:S.name || 'Ведущая', owner:myMail(), status:'pending', tags:[], requests:[],
    team:[{n:S.name || 'Я', r:'ведёт сообщество', role:'owner', mail:myMail()}]
  });
  S.gdraft = null; S.sheet = null;
  S.joined = [...new Set([...(S.joined || []), id])];
  render(); schedulePersist(); syncPush(['groups']);
  toast('Отправили на согласование. Ответим в сообщениях');
}

/* =====================================================================
   УПРАВЛЕНИЕ СООБЩЕСТВОМ
   ===================================================================== */

function openGroupAdmin(id){
  S.gAdmin = id; S.gTab = 'about'; S.sheet = null;
  S.page = 'groupAdmin'; render(); window.scrollTo(0,0);
}

function pgGroupAdmin(){
  const g = GROUPS.find(x => x.id === S.gAdmin);
  if(!g) return `<div class="view pad">${backBtn('Назад')}<div class="empty">Сообщество не найдено</div></div>`;
  if(!gCan(g, 'edit')) return `<div class="view pad">${backBtn('Назад')}
    <div class="empty">Управлять этим сообществом может только ведущая</div></div>`;
  const tab = S.gTab || 'about';
  const reqs = (g.requests || []).length;
  const role = myGRole(g);

  return `<div class="view">
    <div class="hero" style="background:${safeColor(g.c)}">
      <div class="brandbar">
        <button onclick="back()" style="color:#fff;font-size:20px;width:30px;text-align:left">‹</button>
        <div class="b">Управление</div>
        <button class="chip" style="background:rgba(255,255,255,.14);color:#fff;border-color:transparent"
          onclick="openChat('${attJs(g.id)}')">В чат</button>
      </div>
      <div class="row" style="gap:12px;position:relative;z-index:2">
        <div class="gemoji" style="width:46px;height:46px;background:rgba(255,255,255,.18);color:#fff">${gIcon(g, 24)}</div>
        <div style="flex:1;min-width:0">
          <h1 class="serif" style="font-size:22px;margin:0;color:#fff">${esc(g.t)}</h1>
          <div class="small muted" style="margin-top:3px">${gStatusLine(g)} · ты ${GROLES[role].n.toLowerCase()}</div>
        </div>
      </div>
    </div>
    <div class="pad" style="padding-top:16px">
      <div class="seg">
        <button class="${tab==='about'?'on':''}" onclick="S.gTab='about';render()">Описание</button>
        <button class="${tab==='team'?'on':''}" onclick="S.gTab='team';render()">Команда</button>
        <button class="${tab==='hello'?'on':''}" onclick="S.gTab='hello';render()">Приветствие</button>
        <button class="${tab==='reqs'?'on':''}" onclick="S.gTab='reqs';render()">Заявки${reqs?' · '+reqs:''}</button>
      </div>
      ${({about:gTabAbout, team:gTabTeam, hello:gTabHello, reqs:gTabReqs}[tab] || gTabAbout)(g)}
    </div>
  </div>`;
}

const gStatusLine = g => g.status === 'pending' ? 'на согласовании'
  : g.status === 'rework' ? 'на доработке'
  : g.status === 'closed' ? 'закрыто'
  : g.m.toLocaleString('ru-RU') + ' участниц';

/* ---------- описание ---------- */
function gTabAbout(g){
  return `
  ${g.status === 'rework' && g.note ? `<div class="card" style="border-color:var(--warn)">
    <div class="eyebrow" style="color:var(--warn)">Просят доработать</div>
    <p class="small" style="margin:6px 0 0">${esc(g.note)}</p></div>` : ''}

  <label class="lbl">Название</label>
  <input class="field" id="ga_t" value="${esc(g.t)}">
  <label class="lbl">О чём это</label>
  <textarea class="field" id="ga_a" rows="3">${esc(g.about || '')}</textarea>
  <label class="lbl">Кто здесь</label>
  <input class="field" id="ga_w" value="${esc(g.who || '')}">

  <label class="lbl">Знак и цвет</label>
  <div class="chips wrap" style="padding-bottom:6px">${G_EMOJI.map(e =>
    `<button class="chip ${g.e===e?'on':''}" onclick="gSet('e','${attJs(e)}')">${e}</button>`).join('')}</div>
  <div class="gcolors">${G_COLORS.map(c =>
    `<button class="gcol ${g.c===c?'on':''}" style="background:${safeColor(c)}"
      onclick="gSet('c','${attJs(c)}')" aria-label="Цвет"></button>`).join('')}</div>

  <label class="lbl" style="margin-top:12px">Кто может войти</label>
  ${Object.entries(GACCESS).map(([k,v]) => `<button class="optl ${g.access===k?'on':''}"
    ${gCan(g,'price') || k !== 'club' ? `onclick="gSet('access','${attJs(k)}')"` : 'disabled'}>
    <b style="display:block;font-size:13.5px">${v.n}</b>
    <span class="small muted">${v.s}</span></button>`).join('')}
  ${g.access === 'club' && gCan(g,'price') ? `<input class="field" type="number"
    placeholder="Цена в месяц, ₽" value="${g.price||''}" oninput="gSet('price', +this.value||0, true)">` : ''}

  <label class="lbl" style="margin-top:8px">О чём договорились</label>
  ${[0,1,2].map(i => `<input class="field" id="ga_r${i}" placeholder="Правило ${i+1}"
    value="${esc((g.rules||[])[i] || '')}">`).join('')}

  <button class="btn" onclick="gSaveAbout()">Сохранить</button>
  ${g.status === 'rework' ? `<button class="btn ghost" style="margin-top:9px"
    onclick="gResend()">Отправить снова на согласование</button>` : ''}
  ${gCan(g,'close') && g.status === 'live' ? `<button class="btn ghost" style="margin-top:9px;color:var(--accent)"
    onclick="gClose()">Закрыть сообщество</button>` : ''}`;
}

/* поля, которые правятся одним нажатием, сохраняем сразу */
function gSet(k, v, quiet){
  const g = GROUPS.find(x => x.id === S.gAdmin);
  if(!g) return;
  g[k] = v;
  if(!quiet) render();
  schedulePersist(); syncPush(['groups']);
}

function gSaveAbout(){
  const g = GROUPS.find(x => x.id === S.gAdmin);
  if(!g) return;
  const val = id => (($('#' + id) || {}).value || '').trim();
  if(!val('ga_t')) return toast('Название не может быть пустым');
  g.t = val('ga_t'); g.about = val('ga_a'); g.who = val('ga_w');
  g.rules = [0,1,2].map(i => val('ga_r' + i)).filter(Boolean);
  render(); schedulePersist(); syncPush(['groups']);
  toast('Описание сохранено');
}

function gResend(){
  const g = GROUPS.find(x => x.id === S.gAdmin);
  if(!g) return;
  g.status = 'pending'; g.note = '';
  render(); schedulePersist(); syncPush(['groups']);
  toast('Отправили на согласование');
}

function gClose(){
  const g = GROUPS.find(x => x.id === S.gAdmin);
  if(!g || !confirm('Закрыть сообщество? Переписка останется у участниц, новых пускать не будем.')) return;
  g.status = 'closed';
  S.page = null; render(); schedulePersist(); syncPush(['groups']);
  toast('Сообщество закрыто');
}

/* ---------- команда ---------- */
function gTabTeam(g){
  const team = g.team || [];
  return `
  <p class="small muted" style="margin:0 0 12px">Помощницы получают права внутри сообщества.
    На платформе они остаются обычными участницами.</p>

  ${team.map((m,i) => {
    const r = GROLES[m.role || 'keeper'] || GROLES.keeper;
    const ex = m.e ? EXPERTS.find(x => x.id === m.e) : null;
    return `<div class="card gmember">
      <div class="row" style="gap:11px">
        <div class="tpic" style="width:38px;height:38px">
          ${ex ? expPic(ex) : chatAva(m.n, authorColor(m.n), false, 38, m.mail || demoMail(m.n))}</div>
        <div style="flex:1;min-width:0">
          <b style="font-size:14px;display:block">${esc(m.n)}</b>
          <span class="small muted" style="font-size:11.5px">${esc(r.n)} · ${esc(r.s)}</span>
        </div>
        ${m.role === 'owner' ? '<span class="chip pale">владелица</span>' : ''}
      </div>
      ${m.role !== 'owner' && gCan(g,'team') ? `<div class="chips" style="padding:9px 0 0">
        ${['host','keeper'].map(k => `<button class="chip ${m.role===k?'on':''}"
          onclick="gSetRole(${i},'${attJs(k)}')">${GROLES[k].n}</button>`).join('')}
        <button class="chip" style="color:var(--accent)" onclick="gDropMember(${i})">убрать</button>
      </div>` : ''}
    </div>`;
  }).join('')}

  ${gCan(g,'team') ? `<button class="btn ghost" onclick="openSheet('invite')">＋ Позвать помощницу</button>`
    : `<p class="small muted">Назначать помощниц может только владелица.</p>`}

  <div class="sec-h"><h2 class="serif" style="font-size:18px">Что может кто</h2></div>
  <div class="card">
    ${Object.entries(GROLES).map(([k,v]) => `<div class="uline${k==='owner'?' first':''}">
      <div style="flex:1"><b style="font-size:13px">${v.n}</b>
        <div class="small muted" style="font-size:11.5px">${v.s}</div></div></div>`).join('')}
  </div>`;
}

function gSetRole(i, role){
  const g = GROUPS.find(x => x.id === S.gAdmin);
  if(!g || !g.team[i]) return;
  g.team[i].role = role;
  render(); schedulePersist(); syncPush(['groups']);
  toast(g.team[i].n + ' теперь ' + GROLES[role].n.toLowerCase());
}

function gDropMember(i){
  const g = GROUPS.find(x => x.id === S.gAdmin);
  if(!g || !g.team[i]) return;
  const n = g.team[i].n;
  if(!confirm('Убрать ' + n + ' из команды? Участницей она останется.')) return;
  g.team.splice(i, 1);
  render(); schedulePersist(); syncPush(['groups']);
  toast(n + ' больше не в команде');
}

function shInvite(){
  const g = GROUPS.find(x => x.id === S.gAdmin);
  if(!g) return `<div class="empty">Сообщество не найдено</div>`;
  const d = S.ginv = S.ginv || {n:'', mail:'', role:'keeper'};
  return `<h2 class="serif" style="font-size:22px;margin:0 0 4px">Позвать помощницу</h2>
    <p class="small muted" style="margin:0 0 14px">Приглашение придёт ей в сообщения.
      Права появятся, когда она согласится.</p>
    <label class="lbl">Имя</label>
    <input class="field" id="gi_n" value="${esc(d.n)}" oninput="S.ginv.n=this.value" placeholder="Как её зовут">
    <label class="lbl">Почта</label>
    <input class="field" id="gi_m" value="${esc(d.mail)}" oninput="S.ginv.mail=this.value" placeholder="pochta@mail.ru">
    <label class="lbl">Роль</label>
    ${['host','keeper'].map(k => `<button class="optl ${d.role===k?'on':''}"
      onclick="S.ginv.role='${attJs(k)}';render()">
      <b style="display:block;font-size:13.5px">${GROLES[k].n}</b>
      <span class="small muted">${GROLES[k].s}</span></button>`).join('')}
    <button class="btn" style="margin-top:6px" onclick="gInvite()">Отправить приглашение</button>`;
}

function gInvite(){
  const g = GROUPS.find(x => x.id === S.gAdmin);
  const d = S.ginv || {};
  if(!g) return;
  if(!(d.n || '').trim())   return toast('Как её зовут?');
  if(!/.+@.+\..+/.test(d.mail || '')) return toast('Проверь адрес почты');
  g.team = g.team || [];
  g.team.push({n:d.n.trim(), mail:String(d.mail).trim().toLowerCase(),
               role:d.role || 'keeper', r:GROLES[d.role || 'keeper'].n.toLowerCase()});
  S.ginv = null; S.sheet = null;
  render(); schedulePersist(); syncPush(['groups']);
  toast('Приглашение отправлено');
}

/* ---------- приветствие ---------- */
function gTabHello(g){
  return `
  <p class="small muted" style="margin:0 0 12px">Это первое, что она увидит, когда войдёт.
    Пара тёплых строк и подсказка, с чего начать.</p>
  <textarea class="field" id="gh_t" rows="5"
    placeholder="Рада, что ты здесь. Расскажи о себе парой строк — так проще познакомиться.">${esc(g.welcome || '')}</textarea>
  <button class="btn" onclick="gSaveHello()">Сохранить</button>
  <button class="btn ghost" style="margin-top:9px" onclick="gPreviewHello()">Посмотреть, как увидит она</button>

  <div class="sec-h"><h2 class="serif" style="font-size:18px">Что ещё увидит новенькая</h2></div>
  <div class="card">
    <div class="uline first"><span class="small muted" style="flex:1">Описание</span>
      <b style="font-size:12.5px">${g.about ? 'есть' : 'пусто'}</b></div>
    <div class="uline"><span class="small muted" style="flex:1">Правила</span>
      <b style="font-size:12.5px">${(g.rules||[]).length || 'нет'}</b></div>
    <div class="uline"><span class="small muted" style="flex:1">Команда</span>
      <b style="font-size:12.5px">${plural((g.team||[]).length,'человек','человека','человек')}</b></div>
  </div>`;
}

function gSaveHello(){
  const g = GROUPS.find(x => x.id === S.gAdmin);
  if(!g) return;
  g.welcome = (($('#gh_t') || {}).value || '').trim();
  schedulePersist(); syncPush(['groups']);
  toast('Приветствие сохранено');
}
function gPreviewHello(){
  const g = GROUPS.find(x => x.id === S.gAdmin);
  if(!g) return;
  g.welcome = (($('#gh_t') || {}).value || '').trim();
  openSheet({k:'hello', id:g.id});
}

/* приветствие новенькой: показываем сразу после входа */
function shHello(){
  const g = GROUPS.find(x => x.id === S.sheet.id);
  if(!g) return `<div class="empty">Сообщество не найдено</div>`;
  const lead = EXPERTS.find(e => e.n === g.lead);
  return `<div class="gcover" style="--gc:${safeColor(g.c)}">
      <div class="gcircle">${gIcon(g, 30)}</div>
      <h2 class="serif" style="font-size:21px;margin:10px 0 4px">${esc(g.t)}</h2>
      <div class="grow"><span>ты в сообществе</span></div>
    </div>
    <div class="hellonote">
      <div class="row" style="gap:10px;margin-bottom:9px">
        ${lead ? `<div class="pcirc" style="width:34px;height:34px;flex:none">${expPic(lead)}</div>`
               : chatAva(g.lead || 'Ева', safeColor(g.c), false, 34, demoMail(g.lead))}
        <div><b style="font-size:13.5px;display:block">${esc(g.lead || 'Ведущая')}</b>
          <span class="small muted" style="font-size:11px">ведёт сообщество</span></div>
      </div>
      <p>${esc(g.welcome || 'Рада, что ты здесь. Загляни в правила и расскажи о себе парой строк.')}</p>
    </div>
    ${(g.rules||[]).length ? `<div class="gsec"><div class="dh">О чём договорились</div>
      <ul class="grules">${g.rules.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>` : ''}
    <button class="btn" onclick="closeSheet();openChat('${attJs(g.id)}')">Войти в переписку</button>`;
}

/* ---------- заявки ---------- */
function gTabReqs(g){
  const list = g.requests || [];
  if(g.access !== 'request') return `<div class="card">
    <b style="font-size:14px">Заявок нет и не будет</b>
    <p class="small muted" style="margin:6px 0 10px">Сейчас сообщество ${
      GACCESS[g.access] ? GACCESS[g.access].n.toLowerCase() : 'открытое'}.
      Заявки появляются, если поставить вход «по заявке».</p>
    <button class="btn ghost sm" onclick="S.gTab='about';render()">Поменять вход</button></div>`;
  if(!list.length) return `<div class="empty">Пока никто не просится. Заявки появятся здесь.</div>`;
  return list.map((r,i) => `<div class="card">
    <div class="row" style="gap:11px">
      ${chatAva(r.n, authorColor(r.n), false, 38, r.mail)}
      <div style="flex:1;min-width:0">
        <b style="font-size:14px;display:block">${esc(r.n)}</b>
        <span class="small muted" style="font-size:11.5px">${esc(r.ago || 'недавно')}</span>
      </div>
    </div>
    ${r.t ? `<p class="small" style="margin:9px 0 0">${esc(r.t)}</p>` : ''}
    <div class="acts">
      <button class="btn sm" onclick="gAccept(${i})">Впустить</button>
      <button class="btn ghost sm" onclick="gDecline(${i})">Отказать</button>
    </div>
  </div>`).join('');
}

function gAccept(i){
  const g = GROUPS.find(x => x.id === S.gAdmin);
  if(!g || !(g.requests||[])[i]) return;
  const r = g.requests[i];
  g.requests.splice(i, 1); g.m = (g.m || 0) + 1;
  render(); schedulePersist(); syncPush(['groups']);
  toast(r.n + ' в сообществе');
}
function gDecline(i){
  const g = GROUPS.find(x => x.id === S.gAdmin);
  if(!g || !(g.requests||[])[i]) return;
  const n = g.requests[i].n;
  g.requests.splice(i, 1);
  render(); schedulePersist(); syncPush(['groups']);
  toast('Отказали ' + n);
}

/* заявка от участницы */
function askGroup(id){
  const g = GROUPS.find(x => x.id === id);
  if(!g) return;
  g.requests = g.requests || [];
  if(g.requests.some(r => r.mail === myMail())) return toast('Заявка уже отправлена');
  g.requests.push({n:S.name || 'Гостья', mail:myMail(), ago:'только что',
                   t:(($('#gq_t') || {}).value || '').trim()});
  S.sheet = null; render(); schedulePersist(); syncPush(['groups']);
  toast('Заявка отправлена. Ведущая ответит');
}

/* =====================================================================
   МОДЕРАЦИЯ: администратор решает судьбу новых сообществ
   ===================================================================== */
function gApprove(id){
  const g = GROUPS.find(x => x.id === id);
  if(!g) return;
  g.status = 'live'; g.note = '';
  render(); pushShared(); toast('«' + g.t + '» открыто');
}
function gRework(id){
  const g = GROUPS.find(x => x.id === id);
  if(!g) return;
  const note = prompt('Что доработать?');
  if(note == null) return;
  g.status = 'rework'; g.note = note;
  render(); pushShared(); toast('Отправили на доработку');
}
function gRefuse(id){
  const g = GROUPS.find(x => x.id === id);
  if(!g) return;
  const note = prompt('Причина отказа?');
  if(note == null) return;
  g.status = 'refused'; g.note = note;
  render(); pushShared(); toast('Отказали');
}
