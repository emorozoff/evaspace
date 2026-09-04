/* =====================================================================
   EVA EVENTS — цепочка сообщений вокруг мероприятия
   Задача простая: чтобы женщина дошла. Для этого её ведут:
   сразу после записи — подтверждение и вопрос про подругу, за три дня —
   обязательное «подтверждаю» или «не смогу», накануне и в день —
   напоминание, после — вопрос о впечатлении.
   Место, от которого отказались заранее, достаётся другой.
   ===================================================================== */

const EVA_EVENTS = 'Eva Events';

/* шаги цепочки: смещение от начала мероприятия в часах */
const EV_CHAIN = [
  {k:'booked',  h:null,  label:'сразу после записи'},
  {k:'invite',  h:7*24,  label:'за неделю'},
  {k:'confirm', h:3*24,  label:'за три дня'},
  {k:'day',     h:24,    label:'накануне'},
  {k:'today',   h:3,     label:'в день мероприятия'},
  {k:'after',   h:-24,   label:'на следующий день'}
];

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
function evSay(e, k, text, act){
  const t = evThread(e);
  const now = new Date();
  const step = evStep(k);
  t.msgs.push({me:false, t:text, when:step ? step.label : '',
    tm:String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0'),
    act:act || '', eid:e.id});
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
    'Записала тебя на «' + e.t + '».\n\n' +
    '📅 ' + when + '\n📍 ' + place +
    (e.price ? '\n💳 ' + money(e.price) : '\n💳 бесплатно') + '\n\n' +
    'За три дня попрошу подтвердить, что идёшь — так место не пропадёт зря.\n' +
    'Скажи сразу: придёшь одна или с подругой?', act:'plusone'};

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
    'Подтверди, пожалуйста, что идёшь. Если планы изменились — скажи сейчас, ' +
    'и мы отдадим место другой женщине из листа ожидания. Это не обидно, это честно.', act:'confirm'};

  if(k === 'day') return {t:
    'Завтра «' + e.t + '», в ' + (e.tm || '') + '.\n\n' +
    '📍 ' + place + bring + '\n\n' +
    (e.mode === 'онлайн'
      ? 'Ссылку пришлю утром, она откроется за десять минут до начала.'
      : 'Если опаздываешь — ничего страшного, просто напиши сюда.'), act:''};

  if(k === 'today') return {t:
    'Сегодня в ' + (e.tm || '') + '. Ждём тебя.\n\n' +
    (e.mode === 'онлайн' ? '🔗 Ссылка открыта, заходи за пять минут до начала.' : '📍 ' + place) +
    '\n\nЕсли что-то случилось и ты не сможешь — напиши, мы поймём.', act:''};

  if(k === 'after') return {t:
    'Как тебе «' + e.t + '»?\n\n' +
    'Ответь одним нажатием — это помогает нам понять, что повторять, а что менять.', act:'feedback'};

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
  evSay(e, k, m.t, m.act);
  return true;
}

/* ---------- расписание ---------- */
/* какие шаги уже пора отправить по настоящему времени */
function evDueSteps(e, st){
  const start = evStart(e);
  if(!start) return [];
  const left = (start - Date.now()) / 36e5;              // часов до начала
  return EV_CHAIN.filter(s => s.h !== null && left <= s.h && st.sent.indexOf(s.k) < 0)
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
      const next = EV_CHAIN.find(s => s.h !== null && st.sent.indexOf(s.k) < 0);
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
  evSay(e, '', 'Приглашение готово.\n\nКод: ' + evInviteCode(e) + '\n' +
    'Подруга вводит его при записи на «' + e.t + '» и получает скидку.', '');
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
function evFeedback(id, good){
  const e = evById(id); if(!e) return;
  evAnswer(id, good ? 'Было хорошо' : 'Так себе');
  evStateSet(id, {status:'done', liked:!!good});
  evSay(e, '', good
    ? 'Спасибо. Передам ведущей — ей важно это слышать.\nПохожие встречи буду показывать первыми.'
    : 'Жаль. Напиши сюда пару слов, что было не так, — я передам ведущей и учту в подборе.', '');
  render(); schedulePersist();
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
  const id = m.eid;
  if(m.act === 'plusone') return `<div class="macts">
    <button class="btn xs" onclick="evPlusOne('${attJs(id)}',false)">Приду одна</button>
    <button class="btn xs acc" onclick="evPlusOne('${attJs(id)}',true)">Приду с подругой</button></div>`;
  if(m.act === 'invite') return `<div class="macts">
    <button class="btn xs acc" onclick="evInvite('${attJs(id)}')">Взять приглашение</button></div>`;
  if(m.act === 'confirm') return `<div class="macts">
    <button class="btn xs acc" onclick="evConfirm('${attJs(id)}',true)">Подтверждаю</button>
    <button class="btn xs" onclick="evConfirm('${attJs(id)}',false)">Не смогу</button></div>`;
  if(m.act === 'feedback') return `<div class="macts">
    <button class="btn xs acc" onclick="evFeedback('${attJs(id)}',true)">Было хорошо</button>
    <button class="btn xs" onclick="evFeedback('${attJs(id)}',false)">Так себе</button></div>`;
  return '';
}
