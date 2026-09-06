/* =====================================================================
   EVA EVENTS — цепочка сообщений вокруг мероприятия
   Задача простая: чтобы женщина дошла. Для этого её ведут:
   сразу после записи — подтверждение и вопрос про подругу, за три дня —
   обязательное «подтверждаю» или «не смогу», накануне и в день —
   напоминание, после — вопрос о впечатлении.
   Место, от которого отказались заранее, достаётся другой.
   ===================================================================== */

const EVA_EVENTS = 'Eva Events';

/* Шаги цепочки: смещение от начала мероприятия в часах.
   За купленный билет женщина уже заплатила — дёргать её подтверждениями
   невежливо, вместо этого напоминаем и зовём взять подругу. На бесплатном
   подтверждение и есть главный рычаг доходимости: место стоит денег
   ведущей, даже когда не стоит денег гостье. */
const EV_CHAIN = [
  {k:'booked',  h:null,  label:'сразу после записи'},
  {k:'invite',  h:7*24,  label:'за неделю'},
  {k:'confirm', h:3*24,  label:'за три дня', when:'free'},
  {k:'hold',    h:3*24,  label:'за три дня', when:'paid'},
  {k:'day',     h:24,    label:'накануне'},
  {k:'today',   h:3,     label:'в день мероприятия'},
  {k:'after',   h:-24,   label:'на следующий день'}
];
const evPaid = e => !!(e && e.price);
/* шаги именно этого мероприятия */
function evSteps(e){
  const kind = evPaid(e) ? 'paid' : 'free';
  return EV_CHAIN.filter(s => !s.when || s.when === kind);
}

const evStep = k => EV_CHAIN.find(s => s.k === k);
const evById = id => EVENTS.find(e => e.id === id);

/* когда мероприятие начинается */
function evStart(e){
  const d = evDay(e && e.d);
  if(!d) return null;
  const m = /^(\d{1,2})[:.](\d{2})/.exec(String(e.tm || '19:00'));
  if(m) d.setHours(+m[1], +m[2], 0, 0);
  return d.getTime();
}
const evWhenText = e => {
  const d = evDay(e.d);
  return d ? d.toLocaleDateString('ru-RU', {day:'numeric', month:'long'}) + ', ' + (e.tm || '') : (e.tm || '');
};
const evPlaceText = e => e.mode === 'онлайн'
  ? 'Онлайн' + (e.city ? ' · ' + e.city : '')
  : [e.city, e.place].filter(Boolean).join(', ');

/* ---------- состояние цепочки ---------- */
function evState(id){
  S.evChain = S.evChain || {};
  return S.evChain[id];
}
function evStateSet(id, patch){
  S.evChain = S.evChain || {};
  S.evChain[id] = Object.assign({sent:[], status:'booked', plusOne:false, at:Date.now()},
                                S.evChain[id] || {}, patch || {});
  return S.evChain[id];
}

/* ---------- переписка ---------- */
function evThread(e){
  initInbox();
  let t = S.inbox.find(x => x.kind === 'мероприятие' && x.eid === e.id);
  if(!t){
    t = {id:'ev_' + e.id, from:EVA_EVENTS, c:'#111014', kind:'мероприятие', eid:e.id,
         ago:'только что', unread:false, sys:true, msgs:[]};
    S.inbox.unshift(t);
  }
  return t;
}
function evSay(e, k, text, act, ticket){
  const t = evThread(e);
  const now = new Date();
  const step = (evSteps(e).find(x => x.k === k) || evStep(k));
  t.msgs.push({me:false, t:text, when:step ? step.label : '',
    tm:String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0'),
    act:act || '', ticket:!!ticket, eid:e.id});
  t.unread = true;
  t.ago = 'только что';
  const st = evStateSet(e.id, {});
  if(k && st.sent.indexOf(k) < 0) st.sent.push(k);
  schedulePersist();
}

/* ---------- тексты шагов ---------- */
function evMessage(e, k){
  const st = evStateSet(e.id, {});
  const when = evWhenText(e), place = evPlaceText(e);
  const bring = e.bring ? '\nЧто взять: ' + e.bring : '';

  if(k === 'booked') return {t:
    (evPaid(e) ? 'Билет у тебя. ' : 'Место за тобой. ') + '«' + e.t + '»\n\n' +
    '📅 ' + when + '\n📍 ' + place +
    (evPaid(e) ? '\n🎟 ' + money(e.price) + ', оплачено' : '\n🎟 бесплатно') + '\n\n' +
    (evPaid(e)
      ? 'Подтверждать ничего не нужно — просто приходи. Напомню накануне и в день встречи.'
      : 'За три дня попрошу подтвердить, что идёшь: на бесплатных местах всегда есть очередь.') +
    '\n\nСкажи, придёшь одна или с подругой?', act:'plusone', ticket:true};

  if(k === 'invite') return st.plusOne
    ? {t:'Держи приглашение для подруги на «' + e.t + '».\n\n' +
         'Она открывает ссылку, вводит код и попадает на то же место рядом с тобой.\n' +
         'Код: ' + evInviteCode(e) + '\n\n' +
         'Если подруга передумала — просто не отправляй код, на записи это не скажется.', act:''}
    : {t:'Через неделю «' + e.t + '».\n\n' +
         'Вдвоём доходят чаще — если хочешь, возьми подругу. Для неё будет скидка по приглашению.',
       act:'invite'};

  if(k === 'confirm') return {t:
    'Через три дня «' + e.t + '», ' + when + '.\n\n' +
    'Скажи, идёшь? Если планы поменялись — так тоже бывает, просто нажми «не смогу», ' +
    'и место достанется той, кто ждёт. Никто не расстроится, честный ответ дороже.', act:'confirm'};

  if(k === 'hold') return {t:
    'Через три дня «' + e.t + '», ' + when + '.\n\n' +
    'Билет у тебя, ничего подтверждать не надо. Если хочешь, возьми с собой подругу — ' +
    'вдвоём и дорога легче, и разговор потом длиннее.', act:'invite'};

  if(k === 'day') return {t:
    'Завтра «' + e.t + '», в ' + (e.tm || '') + '.\n\n' +
    '📍 ' + place + bring + '\n\n' +
    (e.mode === 'онлайн'
      ? 'Ссылку пришлю утром, она откроется за десять минут до начала. Можно быть без камеры.'
      : 'Если опоздаешь — не страшно, просто напиши сюда, тебя дождутся.'),
    act:'', ticket:true};

  if(k === 'today') return {t:
    'Сегодня в ' + (e.tm || '') + '. Ждём тебя.\n\n' +
    (e.mode === 'онлайн' ? '🔗 Ссылка открыта, заходи за пять минут до начала.' : '📍 ' + place) +
    '\n\nЕсли день сложился иначе — напиши сюда, это нормально.', act:'', ticket:true};

  if(k === 'after') return {t:
    'Ну как «' + e.t + '»?\n\n' +
    'Сначала главное: получилось прийти? Отвечай честно — по этому мы понимаем, ' +
    'какие встречи собирают, а какие только выглядят красиво.', act:'came'};

  return null;
}

/* код приглашения для подруги: короткий и читаемый вслух */
function evInviteCode(e){
  const st = evStateSet(e.id, {});
  if(!st.code){
    st.code = 'EVA-' + String(hash(e.id + (myMail() || S.name || ''))).slice(0, 4);
    schedulePersist();
  }
  return st.code;
}

/* ---------- запуск и остановка ---------- */
function startEvChain(id){
  const e = evById(id);
  if(!e) return;
  const st = evStateSet(id, {status:'booked', at:Date.now(), sent:[]});
  const t = evThread(e);
  t.msgs = [];                          // записалась заново — переписка начинается сначала
  st.sent = [];
  evFire(e, 'booked');
  if(S.evFast !== false) evDemoTimer();
  else tickEvChain();
}
function stopEvChain(id, why){
  const st = evState(id);
  if(!st) return;
  st.status = why || 'cancelled';
  schedulePersist();
}

/* отправка одного шага */
function evFire(e, k){
  const m = evMessage(e, k);
  if(!m) return false;
  evSay(e, k, m.t, m.act, m.ticket);
  return true;
}

/* ---------- расписание ---------- */
/* какие шаги уже пора отправить по настоящему времени */
function evDueSteps(e, st){
  const start = evStart(e);
  if(!start) return [];
  const left = (start - Date.now()) / 36e5;              // часов до начала
  return evSteps(e).filter(s => s.h !== null && left <= s.h && st.sent.indexOf(s.k) < 0)
                   .map(s => s.k);
}
function tickEvChain(){
  if(S.evFast !== false) return;                        // в ускоренном режиме шагами двигает таймер
  let changed = false;
  Object.keys(S.evChain || {}).forEach(id => {
    const st = S.evChain[id], e = evById(id);
    if(!e || !st || st.status === 'cancelled') return;
    evDueSteps(e, st).forEach(k => { if(evFire(e, k)) changed = true; });
  });
  return changed;
}

/* Ускоренный показ: шаги идут раз в десять секунд, у каждого письма
   написано, за сколько до мероприятия оно пришло бы на самом деле. */
let evTimer = null;
function evDemoTimer(){
  if(evTimer) return;
  evTimer = setInterval(() => {
    if(S.evFast === false) return;
    let moved = false;
    Object.keys(S.evChain || {}).forEach(id => {
      const st = S.evChain[id], e = evById(id);
      if(!e || !st || st.status === 'cancelled') return;
      const next = evSteps(e).find(s => s.h !== null && st.sent.indexOf(s.k) < 0);
      if(next && evFire(e, next.k)) moved = true;
    });
    if(moved && S.screen === 'app'){ try { render(); } catch(err){ console.error('[Eva] цепочка:', err); } }
  }, 10000);
}

/* ---------- ответы женщины ---------- */
function evAnswer(id, text){
  const e = evById(id);
  if(!e) return;
  const t = evThread(e);
  const now = new Date();
  t.msgs.push({me:true, t:text,
    tm:String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0')});
}
function evPlusOne(id, yes){
  const e = evById(id); if(!e) return;
  evAnswer(id, yes ? 'Приду с подругой' : 'Приду одна');
  const st = evStateSet(id, {plusOne:!!yes});
  evSay(e, '', yes
    ? 'Отлично, беру два места. За неделю пришлю приглашение для подруги.'
    : 'Записала. Если передумаешь и захочешь взять подругу — скажи, место найдём.', yes ? '' : 'invite');
  st.sent = st.sent; render(); schedulePersist();
}
function evInvite(id){
  const e = evById(id); if(!e) return;
  evAnswer(id, 'Хочу приглашение для подруги');
  evStateSet(id, {plusOne:true});
  evSay(e, '', 'Приглашение готово — открой и перешли подруге.\n\nКод: ' + evInviteCode(e), '');
  S.sheet = {k:'ticket', id:e.id, mode:'invite'};
  render(); schedulePersist();
}
function evConfirm(id, yes){
  const e = evById(id); if(!e) return;
  if(yes){
    evAnswer(id, 'Подтверждаю, иду');
    evStateSet(id, {status:'confirmed'});
    evSay(e, '', 'Записала окончательно. Ждём тебя ' + evWhenText(e) + '.\n' +
      'Накануне напомню про адрес и что взять с собой.', '');
  } else {
    evAnswer(id, 'Не смогу прийти');
    evStateSet(id, {status:'cancelled'});
    /* место возвращается сразу: в этом весь смысл раннего отказа */
    if(S.myEvents.includes(id)){
      S.myEvents = S.myEvents.filter(x => x !== id);
      e.left = Math.min(e.seats || e.left + 1, (e.left || 0) + 1);
      syncPush(['events']);
    }
    evSay(e, '', 'Спасибо, что сказала заранее — место уйдёт другой женщине.\n' +
      'Запись отменена, деньги за билет вернутся тем же способом в течение трёх дней.', '');
  }
  render(); schedulePersist();
}
/* Дошла или нет — главный вопрос: из ответов складывается доходимость,
   а из оценок — понимание, что повторять. */
function evCame(id, yes){
  const e = evById(id); if(!e) return;
  evAnswer(id, yes ? 'Да, была' : 'Не получилось прийти');
  evStateSet(id, {came:!!yes, status:'done'});
  if(yes) evSay(e, '', 'Хорошо. Оцени встречу — от одной звезды до пяти. ' +
    'Это две секунды, а ведущей помогает.', 'rate');
  else evSay(e, '', 'Бывает. Скажи в двух словах, что помешало, — не для галочки, ' +
    'а чтобы в следующий раз получилось.', 'why');
  pushReview(e);
  render(); schedulePersist();
}
function evRate(id, n){
  const e = evById(id); if(!e) return;
  evAnswer(id, 'Оценка: ' + n + ' из 5');
  evStateSet(id, {rate:n});
  evSay(e, '', n >= 4
    ? 'Спасибо. Передам ведущей — ей важно это слышать. Похожие встречи буду показывать первыми.'
    : 'Спасибо за честность. Напиши пару слов, что было не так, — передам ведущей и учту в подборе.',
    n >= 4 ? '' : 'why');
  pushReview(e);
  render(); schedulePersist();
}
function evWhy(id){
  const inp = document.getElementById('evwhy_' + id);
  const v = inp ? inp.value.trim() : '';
  if(!v) return toast('Напиши хотя бы пару слов');
  const e = evById(id); if(!e) return;
  evAnswer(id, v);
  evStateSet(id, {why:v});
  evSay(e, '', 'Записала. Спасибо, что не промолчала.', '');
  pushReview(e);
  render(); schedulePersist();
}

/* отзыв уезжает на сервер: по нему админ видит доходимость и оценки */
function pushReview(e){
  const st = evStateSet(e.id, {});
  S.reviews = S.reviews || [];
  const id = 'rv_' + e.id + '_' + (myMail() || 'guest');
  const rec = {id, kind:'event', eid:e.id, title:e.t, free:!evPaid(e),
    email:myMail(), who:S.name || 'Гостья',
    came:st.came === true, rate:st.rate || 0, why:st.why || '', at:Date.now()};
  const i = S.reviews.findIndex(r => r.id === id);
  if(i >= 0) S.reviews[i] = rec; else S.reviews.push(rec);
  if(typeof syncPush === 'function') syncPush(['reviews']);
}

/* ---------- отметка о подтверждении ---------- */
function evBadge(id){
  const st = evState(id);
  if(!st || st.status === 'cancelled') return '';
  if(st.status === 'confirmed') return '<span class="evok">подтверждено</span>';
  if(st.sent.indexOf('confirm') >= 0) return '<span class="evwait">ждём ответа</span>';
  return '';
}

/* кнопки под письмом Eva Events */
function evActions(m){
  /* письма Евы про неделю живут в той же переписке, но своих кнопок
     у мероприятий не имеют — разбираем их первыми */
  if(m.act === 'weekMood') return `<div class="macts">${MOODS.map(x =>
    `<button class="btn xs${x.k === 'good' ? ' acc' : ''}"
      onclick="weekMood('${attJs(x.k)}')">${esc(x.n)}</button>`).join('')}</div>`;
  if(m.act === 'openContent') return `<div class="macts">
    <button class="btn xs acc" onclick="S.thread=null;go('content')">Открыть библиотеку</button>
    <button class="btn xs" onclick="S.thread=null;go('home')">К моей неделе</button></div>`;
  if(m.act === 'weekBlock') return `<div class="macts">${BLOCKS.map(x =>
    `<button class="btn xs" onclick="weekBlock('${attJs(x.k)}')">${esc(x.n)}</button>`).join('')}</div>`;
  if(m.act === 'rebuild') return `<div class="macts">
    <button class="btn xs acc" onclick="S.thread=null;openSheet('rebuild')">Пересобрать программу</button></div>`;
  if(m.act === 'support') return `<div class="macts">
    <button class="btn xs acc" onclick="S.thread=null;openSheet('support')">Написать нам</button>
    <button class="btn xs" onclick="S.thread=null;go('home')">Не сейчас</button></div>`;
  const id = m.eid;
  const tick = m.ticket ? `<div class="macts"><button class="btn xs"
    onclick="openSheet({k:'ticket',id:'${attJs(id)}'})">Показать билет</button></div>` : '';
  if(m.act === '') return tick;
  if(m.act === 'plusone') return tick + `<div class="macts">
    <button class="btn xs" onclick="evPlusOne('${attJs(id)}',false)">Приду одна</button>
    <button class="btn xs acc" onclick="evPlusOne('${attJs(id)}',true)">Приду с подругой</button></div>`;
  if(m.act === 'invite') return tick + `<div class="macts">
    <button class="btn xs acc"
      onclick="evInvite('${attJs(id)}')">Взять приглашение</button></div>`;
  if(m.act === 'confirm') return `<div class="macts">
    <button class="btn xs acc" onclick="evConfirm('${attJs(id)}',true)">Подтверждаю</button>
    <button class="btn xs" onclick="evConfirm('${attJs(id)}',false)">Не смогу</button></div>`;
  if(m.act === 'came') return `<div class="macts">
    <button class="btn xs acc" onclick="evCame('${attJs(id)}',true)">Да, была</button>
    <button class="btn xs" onclick="evCame('${attJs(id)}',false)">Не получилось</button></div>`;
  if(m.act === 'rate') return `<div class="rateline">${[1,2,3,4,5].map(n =>
    `<button class="rstar" onclick="evRate('${attJs(id)}',${n})" aria-label="${n} из 5">
      ${starMark(21, 'rgba(17,16,20,.24)')}</button>`).join('')}</div>`;
  if(m.act === 'why') return `<div class="whyrow">
    <input class="field" id="evwhy_${esc(id)}" placeholder="Пара слов"
      onkeydown="if(event.key==='Enter')evWhy('${attJs(id)}')">
    <button class="btn sm" onclick="evWhy('${attJs(id)}')">→</button></div>`;
  return '';
}

/* =====================================================================
   БИЛЕТ И ПРИГЛАШЕНИЕ
   Женщина записалась — у неё появляется билет: фирменная карточка,
   которую не стыдно показать на входе и переслать подруге.
   Оформление одно на все мероприятия, меняется только содержимое.
   ===================================================================== */

/* номер билета: короткий, читается вслух */
function evTicketNo(e){
  const st = evStateSet(e.id, {});
  if(!st.no){
    st.no = 'EV-' + String(hash(e.id + (myMail() || S.name || '') + st.at)).slice(0, 5);
    schedulePersist();
  }
  return st.no;
}

function shTicket(){
  const e = evById(S.sheet.id);
  if(!e) return `<div class="empty">Мероприятие не найдено</div>`;
  const st = evStateSet(e.id, {});
  const invite = S.sheet.mode === 'invite';
  const d = evDay(e.d);
  const day = d ? d.getDate() : '';
  const mon = d ? MON[d.getMonth()] : '';
  const dow = d ? DOW[d.getDay()] : '';
  const paid = !!e.price;

  return `<div class="tick ${invite ? 'inv' : ''}">
    <div class="tick-top">
      <div class="tick-brand"><svg width="15" height="15" viewBox="0 0 100 100" aria-hidden="true">
        <path d="${STAR_PATH}" fill="currentColor"/></svg> EVA SPACE</div>
      <div class="tick-kind">${invite ? 'приглашение' : paid ? 'билет' : 'запись'}</div>
    </div>

    <div class="tick-body">
      <div class="tick-date">
        <b>${esc(String(day))}</b>
        <span>${esc(mon)}</span>
        <i>${esc(dow)}</i>
      </div>
      <div class="tick-what">
        <div class="tick-kindname">${esc(e.kind || 'Встреча')}</div>
        <h3>${esc(e.t)}</h3>
        <div class="tick-line">${esc(e.tm || '')} · ${esc(evPlaceText(e))}</div>
        <div class="tick-line muted">Ведёт ${esc(e.by || 'Eva Space')}</div>
      </div>
    </div>

    <div class="tick-rip"><i></i><i></i></div>

    <div class="tick-foot">
      ${invite
        ? `<div class="tick-cell"><span>Код подруги</span><b>${esc(evInviteCode(e))}</b></div>
           <div class="tick-cell right"><span>Приглашает</span><b>${esc(S.name || 'Гостья')}</b></div>`
        : `<div class="tick-cell"><span>Номер</span><b>${esc(evTicketNo(e))}</b></div>
           <div class="tick-cell right"><span>На имя</span><b>${esc(S.name || 'Гостья')}</b></div>`}
    </div>
  </div>

  ${invite
    ? `<p class="small muted" style="margin:14px 0 12px">Перешли этот код подруге. Она вводит его
        при записи на «${esc(e.t)}» и садится рядом с тобой${paid ? ', со скидкой по приглашению' : ''}.</p>
       <button class="btn" onclick="copyInvite('${attJs(e.id)}')">Скопировать код</button>
       <button class="btn ghost" style="margin-top:9px"
         onclick="openSheet({k:'ticket',id:'${attJs(e.id)}'})">Показать мой билет</button>`
    : `<p class="small muted" style="margin:14px 0 12px">${paid
        ? 'Покажи этот экран на входе. Подтверждать участие не нужно — место закреплено за тобой.'
        : 'Место закреплено за тобой. За три дня попрошу подтвердить, что идёшь.'}</p>
       <button class="btn" onclick="openSheet({k:'ticket',id:'${attJs(e.id)}',mode:'invite'})">
         Пригласить подругу</button>
       <button class="btn ghost" style="margin-top:9px"
         onclick="closeSheet();openSheet({k:'event',id:'${attJs(e.id)}'})">О мероприятии</button>`}`;
}

function copyInvite(id){
  const e = evById(id);
  if(!e) return;
  const code = evInviteCode(e);
  const text = 'Иду на «' + e.t + '», ' + evWhenText(e) + '. Присоединяйся: код ' + code + ' в Eva Space.';
  if(navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
  evStateSet(id, {plusOne:true});
  toast('Скопировано — отправь подруге');
}
