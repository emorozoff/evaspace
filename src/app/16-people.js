/* =====================================================================
   СТРАНИЦЫ ЖЕНЩИН
   У каждой женщины есть страница: не витрина и не лента её постов,
   а карточка — кто она, что любит, с кем знакома, куда идёт.

   Три правила, из которых всё остальное следует.

   1. Страница показывает то, что она выбрала, и ничего из того, что
      она делала. Ни звёзд, ни стрика, ни её посланий: мы обещали ей,
      что её неделя сравнивается только с её прошлой, и счётчик на
      чужой странице отменял бы это обещание за один взгляд.

   2. Подписка и знакомство — разные связи. На эксперта подписываются
      в одну сторону, и у него счётчик: это витрина, счётчик работает
      на него. С женщиной знакомятся взаимно и без счётчика — это не
      рейтинг популярности, а разрешение написать.

   3. Чувствительное закрывается на самой встрече, а не в её
      настройках. Женщина, которая идёт на «Развод: как пережить»,
      в этот момент думает о разводе, а не о приватности.
   ===================================================================== */

/* Публичные карточки: своя уезжает в общие данные, чужие приходят
   обратно. Одна запись на почту — сервер сливает список по номеру,
   поэтому чужую карточку затереть нельзя. */
const PEOPLE = [];

const personKey = m => String(m || '').toLowerCase().trim();

/* Карточки демо-участниц: те же женщины, что в подборе знакомств и в ленте.
   Живут отдельно от PEOPLE нарочно — PEOPLE целиком приходит с сервера и
   перезаписывается при каждой синхронизации. Настоящая карточка всегда
   сильнее демонстрационной: как только женщина с этой почтой заведёт свою,
   показываем её. */
function demoCard(mail){
  const key = personKey(mail);
  const m = typeof MEMBERS !== 'undefined' && MEMBERS.find(x => personKey(x.mail) === key);
  if(!m) return null;
  return {
    id: key, n: m.n, city: m.city === 'Онлайн' ? '' : m.city, about: m.bio,
    since: Date.now() - (120 + m.age) * 864e5,
    ints: m.ints || [], shelf: [], follows: [], mates: [], showMates: false,
    next: [], past: [], demo: true,
    dating: m.open ? {goal:'Знакомства и совместные практики', city:m.city} : null
  };
}
const cardOf = mail => PEOPLE.find(p => personKey(p.id) === personKey(mail)) || demoCard(mail);

/* ---------- своя карточка ---------- */
function myCard(){
  const me = myMail();
  if(!me) return null;
  const show = S.show || {};
  const ev = myEventsSplit();
  return {
    id: me,
    n: S.name || 'Женщина',
    city: S.city || (S.datingProfile && S.datingProfile.city) || '',
    about: S.about || (S.datingProfile && S.datingProfile.about) || '',
    since: S.since || (S.sub && S.sub.start) || Date.now(),
    ints: (S.myInts || []).slice(0, 12),
    shelf: show.shelf === false ? [] : myShelf().map(x => x.id),
    follows: show.follows === false ? [] : (S.follows || []).slice(),
    mates: (S.mates || []).slice(),                    // нужен всегда: по нему сервер проверяет знакомство
    showMates: show.mates !== false,
    next: show.next === false ? [] : ev.next.map(e => e.id),
    past: show.past === false ? [] : ev.past.map(e => e.id),
    dating: show.dating !== false && !!(S.datingProfile && S.datingProfile.goal)
      ? {goal:S.datingProfile.goal, city:S.datingProfile.city || ''} : null
  };
}

/* Её карточка уезжает после каждого изменения. Отдельной кнопки
   «опубликовать» нет намеренно: страница должна быть свежей сама. */
function publishCard(){
  if(S.role && S.role !== 'user') return;   // у экспертов и админов своя страница
  const c = myCard();
  if(!c) return;
  const at = PEOPLE.findIndex(p => personKey(p.id) === c.id);
  if(at >= 0) PEOPLE[at] = c; else PEOPLE.push(c);
  schedulePersist();
  syncPush(['people']);
}

/* Карточка появляется сама, без кнопки «опубликовать»: как только
   женщина вошла, её страница уже есть. Помним почту, для которой
   отправляли, - при смене аккаунта карточка уедет заново. */
let CARD_FOR = '';
function ensureCard(){
  const me = myMail && myMail();
  if(!me || S.role !== 'user' || S.screen !== 'app' || CARD_FOR === me) return;
  CARD_FOR = me;
  publishCard();
}

/* ---------- что она отметила ---------- */
/* Полка собирается из того же «Избранного», которым она уже пользуется:
   одна звезда на всю платформу, а не отдельная кнопка «на полку».
   Показываем не больше трёх - полка, а не склад. */
function myShelf(){
  return (S.likes || []).map(shelfItem).filter(Boolean).slice(0, 3);
}
function shelfItem(id){
  const lib = LIB.find(x => x.id === id);
  if(lib) return {id, kind:lib.type === 'class' ? 'Мастер-класс' : lib.type === 'affirm' ? 'Послание' : 'Практика',
    t:lib.title, type:lib.type};
  const c = COURSES.find(x => x.id === id);
  if(c) return {id, kind:'Курс', t:c.t, type:'course'};
  const g = GOODS.find(x => x.id === id);
  if(g) return {id, kind:'Товар', t:g.t, type:'good'};
  return null;
}

/* Звезда на курсе и на товаре: те же «Избранное» и та же полка, что
   у практик. Возвращает разметку кнопки, чтобы не повторять её трижды. */
function starBtn(id, size){
  return `<span class="starbtn ${isLiked(id) ? 'on' : ''}"
    onclick="event.stopPropagation();starContent(this,'${attJs(id)}')"
    aria-label="В избранное">${starMark(size || 15, isLiked(id) ? '#E7A339' : 'rgba(17,16,20,.22)')}</span>`;
}

/* ---------- мероприятия ----------
   Закрытая встреча не попадает на страницу никогда: метку ставит тот,
   кто заводит мероприятие, и она сильнее любых её переключателей. */
function myEventsSplit(ids){
  const list = (ids || S.myEvents || [])
    .map(id => EVENTS.find(e => e.id === id))
    .filter(e => e && !e.closed);
  const today = new Date().toISOString().slice(0, 10);
  return {
    next: list.filter(e => (e.d || '') >= today).sort((a,b) => (a.d||'').localeCompare(b.d||'')),
    past: list.filter(e => (e.d || '') <  today).sort((a,b) => (b.d||'').localeCompare(a.d||''))
  };
}

/* ---------- подписка на эксперта ---------- */
const isFollowing = id => (S.follows || []).includes(id);
function followExpert(id){
  S.follows = S.follows || [];
  const on = isFollowing(id);
  S.follows = on ? S.follows.filter(x => x !== id) : [...S.follows, id];
  publishCard(); render();
  toast(on ? 'Отписалась' : 'Подписалась. Напишем, когда выйдет новое');
}

/* Кольцо вокруг кружка значит «есть новое» — иначе это украшение,
   на которое перестают нажимать. Новое считаем по двум честным
   признакам: материалов стало больше, чем когда она заходила, или
   у эксперта есть ближайшая встреча, на которую она не записана. */
function expertHasNew(id){
  const e = EXPERTS.find(x => x.id === id);
  if(!e) return false;
  const seen = (S.expSeen || {})[id] || {n:0, at:0};
  const mats = LIB.filter(x => x.expert === e.n && x.status === 'live').length;
  if(mats > (seen.n || 0)) return true;
  const today = new Date().toISOString().slice(0, 10);
  return EVENTS.some(v => v.by === e.n && !v.closed && (v.d || '') >= today
    && !(S.myEvents || []).includes(v.id));
}
function markExpertSeen(id){
  const e = EXPERTS.find(x => x.id === id);
  if(!e) return;
  S.expSeen = S.expSeen || {};
  S.expSeen[id] = {n: LIB.filter(x => x.expert === e.n && x.status === 'live').length, at: Date.now()};
  schedulePersist();
}

/* Сколько женщин подписано на эксперта — считаем по их же карточкам.
   Это витрина, и здесь счётчик уместен: он работает на него. */
function followCount(id){
  return PEOPLE.filter(p => (p.follows || []).includes(id)).length;
}

/* ---------- знакомство ----------
   Взаимно: пока обе не назвали друг друга, это заявка, а не связь.
   Сервер проверяет то же самое перед тем, как пропустить сообщение. */
const iAdded  = mail => (S.mates || []).includes(personKey(mail));
function sheAdded(mail){
  const c = cardOf(mail);
  return !!c && (c.mates || []).some(x => personKey(x) === myMail());
}
const areMates = mail => iAdded(mail) && sheAdded(mail);

function toggleMate(mail){
  const key = personKey(mail);
  if(!key || key === myMail()) return;
  S.mates = S.mates || [];
  const on = iAdded(key);
  S.mates = on ? S.mates.filter(x => x !== key) : [...S.mates, key];
  publishCard(); render();
  toast(on ? 'Убрала из знакомых'
    : sheAdded(key) ? 'Теперь вы знакомы — можно написать'
                    : 'Отметила. Станете знакомы, когда она ответит тем же');
}

/* ---------- имена, которые мы уже видели ----------
   Карточка есть не у всех: женщина, которая ещё не открывала новую версию,
   в PEOPLE не попала. Но её имя мы только что показали рядом с аватаром —
   запоминаем, чтобы её страница была с именем, а не «участница». */
const NAMES = {};
function rememberName(mail, name){
  const key = personKey(mail);
  if(key && name && !NAMES[key]) NAMES[key] = String(name);
}
const nameOf = mail => (cardOf(mail) || {}).n || NAMES[personKey(mail)] || 'Участница';

/* эксперт — по почте его же аккаунта: у него своя страница, не эта */
function expertByMail(mail){
  const key = personKey(mail);
  if(!key || typeof EXPERTS === 'undefined') return null;
  return EXPERTS.find(e => personKey(e.email || e.mail) === key) || null;
}

/* ---------- переход на страницу ---------- */
function openPerson(mail){
  const key = personKey(mail);
  if(!key) return;
  if(key === myMail()){ openPage('profile'); return; }
  const ex = expertByMail(key);
  if(ex) return openExpert(ex.id);
  S.viewPerson = key; S.page = 'person'; S.sheet = null;
  S.viewExpert = null; S.course = null; S.viewGood = null;
  S.thread = null; S.viewGood = null;
  if(S.chat) S.chat.open = null;
  render(); window.scrollTo(0, 0);
}
function closePerson(){ S.viewPerson = null; S.page = null; render(); window.scrollTo(0, 0); }

/* Один обработчик на всё приложение вместо onclick у каждого аватара.
   Ставим его на перехвате: аватар часто лежит внутри кнопки — строки письма,
   карточки поста, — и без перехвата сначала сработала бы кнопка вокруг. */
document.addEventListener('click', e => {
  const el = e.target && e.target.closest && e.target.closest('[data-p],[data-x]');
  if(!el) return;
  const mail = el.getAttribute('data-p'), exp = el.getAttribute('data-x');
  if(!mail && !exp) return;
  e.preventDefault(); e.stopPropagation();
  if(exp) openExpert(exp); else openPerson(mail);
}, true);

/* имя автора становится ссылкой только там, где мы знаем почту */
function personLink(name, mail, cls){
  const key = personKey(mail);
  if(key) rememberName(key, name);
  if(!key || key === myMail()) return esc(name || '');
  return `<button class="plink ${cls || ''}" onclick="event.stopPropagation();openPerson('${attJs(key)}')">${esc(name || '')}</button>`;
}

/* Шапка страницы — одна на обе: и на заполненную, и на пустую.
   Город, «здесь с» и пара слов о себе появляются, если они есть. */
function personHead(mail, name, c){
  const key = personKey(mail);
  return `<div class="exphead">
    <div class="brandbar" style="margin:0">
      <button onclick="closePerson()" style="color:#fff;font-size:20px;width:30px;text-align:left">‹</button>
      <div class="b">Участница</div><div style="width:30px"></div>
    </div>
    <div class="pcirc" style="width:92px;height:92px;margin:6px auto 0;border:2px solid rgba(255,255,255,.35)">
      ${chatAva(name, authorColor(key), false, 92, key)}</div>
    <div class="nm">${esc(name)}</div>
    ${c ? `<div class="mrow">
      ${c.city ? `<span class="mstat">${PIN_SVG}${esc(c.city)}</span>` : ''}
      <span class="mstat">${sinceText(c.since)}</span>
    </div>
    ${c.about ? `<p class="pabout">${esc(c.about)}</p>` : ''}` : ''}
  </div>`;
}

/* Женщина, которая ещё не открывала новую версию, карточки не имеет.
   Пустой экран «страница не заполнена» — тупик: непонятно, к кому попал
   и что делать. Поэтому показываем то, что знаем, и оставляем главное
   действие — познакомиться. Когда она зайдёт, страница наполнится сама. */
function pgPersonBlank(mail){
  const key = personKey(mail);
  const n = nameOf(key);
  return `<div class="view">
    ${personHead(key, n, null)}
    <div class="pad" style="padding-top:16px">
      <div class="row" style="gap:8px">
        <button class="btn" style="flex:1"
          onclick="toast('Написать можно той, с кем вы знакомы')">Написать</button>
        <button class="btn ${iAdded(key) ? 'done' : 'ghost'}" style="flex:1"
          onclick="toggleMate('${attJs(key)}')">${iAdded(key) ? 'Ждём ответа' : 'Познакомиться'}</button>
      </div>
      <div class="card" style="margin-top:16px">
        <b style="font-size:14.5px">Страница пока пустая</b>
        <p class="small muted" style="margin:7px 0 0">${esc(n)} ещё не заполняла её.
          Отметь знакомство — она увидит это у себя, и вы сможете написать друг другу.</p>
      </div>
    </div>
  </div>`;
}

/* =====================================================================
   СТРАНИЦА
   Порядок: шапка → действия → эксперты → интересы → полка → статус →
   знакомые → мероприятия. Мероприятия в конце и лентой: у страницы
   должно быть окончание, а не обрыв.
   ===================================================================== */
function pgPerson(){
  const c = cardOf(S.viewPerson);
  if(!c) return pgPersonBlank(S.viewPerson);

  const mates = areMates(c.id);
  const waiting = iAdded(c.id) && !sheAdded(c.id);
  const ev = myEventsSplit([...(c.next || []), ...(c.past || [])]);
  const shelf = (c.shelf || []).map(shelfItem).filter(Boolean);
  const follows = (c.follows || []).map(id => EXPERTS.find(e => e.id === id)).filter(Boolean);
  const friends = c.showMates === false ? []
    : (c.mates || []).filter(m => (cardOf(m) || {}).mates &&
        (cardOf(m).mates || []).some(x => personKey(x) === personKey(c.id)))
      .map(cardOf).filter(Boolean);

  return `<div class="view">
    ${personHead(c.id, c.n, c)}

    <div class="pad" style="padding-top:16px">
      <div class="row" style="gap:8px">
        <button class="btn ${mates ? 'acc' : ''}" style="flex:1"
          onclick="${mates ? `writeMate('${attJs(c.id)}')` : `toast('Написать можно той, с кем вы знакомы')`}"
          ${mates ? '' : 'aria-disabled="true"'}>Написать</button>
        <button class="btn ${iAdded(c.id) ? 'done' : 'ghost'}" style="flex:1"
          onclick="toggleMate('${attJs(c.id)}')">
          ${mates ? 'Знакомы' : waiting ? 'Ждём ответа' : 'Познакомиться'}</button>
      </div>
      ${!mates && waiting ? `<p class="small muted" style="margin:8px 0 0;text-align:center">
        Она увидит это у себя. Писать можно, когда отметит в ответ.</p>` : ''}
      ${c.demo ? `<p class="small muted" style="margin:8px 0 0;text-align:center">
        Это показательная анкета — такие страницы платформа собирает сама,
        пока не набрались настоящие.</p>` : ''}

      ${circleRow('Читает', 'эксперты', follows.map(e => ({
        id:e.id, n:e.n.split(' ')[0], mail:'', ring:expertHasNew(e.id),
        go:`openExpert('${attJs(e.id)}')`})), 'Цветное кольцо — у неё вышло что-то новое.')}

      ${(c.ints || []).length ? `<div class="psec">
        <div class="sec-h"><h2 class="serif" style="font-size:17px">Интересы</h2></div>
        <div class="chips wrap">${c.ints.map(t => `<span class="chip pale">${esc(t)}</span>`).join('')}</div>
      </div>` : ''}

      ${shelf.length ? `<div class="psec">
        <div class="sec-h"><h2 class="serif" style="font-size:17px">Что я люблю</h2>
          <span class="small muted">отмечено ею</span></div>
        <div class="shelf">${shelf.map(x => `<button class="stile" onclick="${shelfGo(x)}">
          <div class="cov">${cover(x.id, x.type === 'course' ? 'course' : x.type === 'good' ? 'practice' : x.type)}</div>
          <div class="nm"><span class="kind">${esc(x.kind)}</span>${esc(x.t)}</div></button>`).join('')}</div>
      </div>` : ''}

      ${c.dating ? `<div class="psec">
        <div class="sec-h"><h2 class="serif" style="font-size:17px">Статус</h2></div>
        <div class="card datebox">
          ${HEART_SVG}
          <div style="flex:1;min-width:0"><b style="font-size:13.5px;display:block">Открыта к знакомствам</b>
            <span class="small muted">${esc(c.dating.goal)}${c.dating.city ? ' · ' + esc(c.dating.city) : ''}</span></div>
        </div>
      </div>` : ''}

      ${circleRow('Знакомы', plural(friends.length, 'женщина', 'женщины', 'женщин'),
        friends.map(f => ({id:f.id, n:(f.n || '').split(' ')[0], mail:f.id, ring:false,
          go:`openPerson('${attJs(f.id)}')`})), '')}

      ${ev.next.length || ev.past.length ? `<div class="psec">
        <div class="sec-h"><h2 class="serif" style="font-size:17px">Мероприятия</h2></div>
        ${ev.next.length ? `<div class="eyebrow" style="margin-bottom:8px">Идёт</div>
          <div class="evstrip">${ev.next.map(evChip).join('')}</div>` : ''}
        ${ev.past.length ? `<div class="eyebrow" style="margin:14px 0 8px">Была раньше</div>
          <div class="evstrip">${ev.past.map(evChip).join('')}</div>` : ''}
      </div>` : ''}
    </div>
  </div>`;
}

const PIN_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><path d="M12 21s-6.5-5.5-6.5-10a6.5 6.5 0 0 1 13 0c0 4.5-6.5 10-6.5 10z"/><circle cx="12" cy="11" r="2.2"/></svg>`;
const HEART_SVG = `<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="var(--accent)"
  stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex:none"><path d="M12 20s-6.5-4.2-6.5-8.6A3.9 3.9 0 0 1 12 8.6a3.9 3.9 0 0 1 6.5 2.8C18.5 15.8 12 20 12 20z"/></svg>`;

/* «с апреля здесь», а не «с апрель здесь»: месяц сам по себе браузер
   отдаёт в именительном падеже, поэтому держим родительный списком. */
const MONTHS_OF = ['января','февраля','марта','апреля','мая','июня',
                   'июля','августа','сентября','октября','ноября','декабря'];
function sinceText(at){
  const d = new Date(+at || Date.now());
  const now = new Date();
  const year = d.getFullYear() === now.getFullYear() ? '' : ' ' + d.getFullYear();
  return 'с ' + MONTHS_OF[d.getMonth()] + year + ' здесь';
}
function shelfGo(x){
  if(x.type === 'course') return `openCourseLanding('${attJs(x.id)}')`;
  if(x.type === 'good')   return `openGood('${attJs(x.id)}')`;
  return `openLesson('${attJs(x.id)}')`;
}

/* Мероприятие в ленте: дата, название, место. Лента листается вбок —
   так у страницы есть окончание, а не обрыв на середине списка. */
function evChip(e){
  const d = new Date(e.d);
  return `<button class="evmini" onclick="openSheet({k:'event',id:'${attJs(e.id)}'})">
    <div class="evdate"><b>${d.getDate()}</b><span>${d.toLocaleDateString('ru-RU',{month:'short'}).replace('.','')}</span></div>
    <b class="evt">${esc(e.t)}</b>
    <span class="small muted">${esc(e.city || e.mode || '')}</span>
  </button>`;
}

/* Ряд кружков. Пустой ряд не показываем вовсе: пустой круг с надписью
   «пока никого» выглядит как упрёк. */
function circleRow(title, note, people, hint){
  if(!people.length) return '';
  const show = people.slice(0, 4), rest = people.length - show.length;
  return `<div class="psec">
    <div class="sec-h"><h2 class="serif" style="font-size:17px">${esc(title)}</h2>
      <span class="small muted">${esc(note)}</span></div>
    <div class="circles">
      ${show.map(p => `<button class="who" onclick="${p.go}">
        <span class="ring ${p.ring ? 'new' : ''}">${chatAva(p.n, authorColor(p.id), false, 56, p.mail)}</span>
        <span class="wname">${esc(p.n)}</span></button>`).join('')}
      ${rest > 0 ? `<div class="who"><span class="more">+${rest}</span>
        <span class="wname muted">ещё</span></div>` : ''}
    </div>
    ${hint ? `<p class="small muted" style="margin:9px 0 0">${esc(hint)}</p>` : ''}
  </div>`;
}

/* ---------- письмо знакомой ---------- */
function writeMate(mail){
  if(!areMates(mail)) return toast('Написать можно той, с кем вы знакомы');
  openSheet({k:'toMate', id:personKey(mail)});
}
function shToMate(){
  const c = cardOf(S.sheet.id);
  if(!c) return `<div class="empty">Не нашли</div>`;
  return `<h2 class="serif" style="font-size:22px;margin:0 0 6px">Написать ${esc(c.n)}</h2>
    <p class="small muted" style="margin:0 0 12px">Придёт ей в личные сообщения от твоего имени.</p>
    <textarea class="field" id="tm_t" rows="5" placeholder="Что хочешь написать"></textarea>
    <button class="btn" onclick="sendToMate('${attJs(c.id)}')">Отправить</button>`;
}
async function sendToMate(mail){
  const t = (($('#tm_t') || {}).value || '').trim();
  if(!t) return toast('Напиши пару слов');
  const r = await apiCall('dm_send', {email:personKey(mail), text:t,
    from:S.name || 'Участница', subject:''}, {silent:true});
  if(!r) return toast(SYNC.lastError || 'Не отправилось');
  S.sheet = null; render();
  toast('Отправлено');
}

/* ---------- настройки видимости ----------
   По умолчанию открыто всё: закрытая страница остаётся закрытой
   навсегда — до настроек доходят единицы. Убрать можно каждый блок
   отдельно, а не «скрыть страницу целиком». */
const SHOW_ROWS = [
  ['shelf',   'Что я люблю',        'Практики, курсы и товары, которые ты отметила'],
  ['follows', 'На кого я подписана','Эксперты, которых ты читаешь'],
  ['mates',   'С кем я знакома',    'Кружки знакомых перед мероприятиями'],
  ['next',    'Куда я иду',         'Ближайшие встречи, на которые ты записана'],
  ['past',    'Где я была',         'Прошедшие встречи'],
  ['dating',  'Открыта к знакомствам', 'Город и повод — в блоке «Статус»']
];
function shMyPage(){
  const show = S.show || {};
  return `<h2 class="serif" style="font-size:22px;margin:0 0 6px">Моя страница</h2>
    <p class="small muted" style="margin:0 0 14px">Так тебя видят другие женщины и эксперты.</p>
    <label class="lbl">Город</label>
    <input class="field" value="${esc(S.city || '')}" placeholder="Москва"
      oninput="S.city=this.value" onchange="publishCard()">
    <label class="lbl">Пара слов о себе</label>
    <textarea class="field" rows="2" placeholder="Йога по утрам, учусь говорить «нет»"
      oninput="S.about=this.value" onchange="publishCard()">${esc(S.about || '')}</textarea>
    <div class="card" style="margin-top:12px">
      ${SHOW_ROWS.map(([k, t, d], i) => `<div class="uline"${i === 0 ? ' style="border:none;padding-top:0"' : ''}>
        <div style="flex:1;min-width:0"><b style="font-size:13.5px">${esc(t)}</b>
          <div class="small muted">${esc(d)}</div></div>
        <button class="sw ${show[k] !== false ? 'on' : ''}" onclick="toggleShow('${attJs(k)}')"><i></i></button>
      </div>`).join('')}
    </div>
    <div class="card" style="background:var(--accent-soft);border-color:transparent">
      <b style="font-size:13px;display:block;margin-bottom:3px">Закрытые встречи не показываются никогда</b>
      <span class="small muted">Ни в «где я была», ни в «куда я иду» — что бы ни стояло в переключателях.</span>
    </div>
    <button class="btn ghost" onclick="closeSheet();openPerson(myMail())">Посмотреть, как видят другие</button>`;
}
function toggleShow(k){
  S.show = Object.assign({shelf:true, follows:true, mates:true, next:true, past:true, dating:true}, S.show || {});
  S.show[k] = !(S.show[k] !== false);
  publishCard(); render();
}

/* Все модули расставили значения по умолчанию — запоминаем чистое состояние,
   чтобы вход в другой аккаунт начинался с него, а не с чужих данных. */
keepPristine();
