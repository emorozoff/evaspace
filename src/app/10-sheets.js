/* =====================================================================
   ШТОРКИ
   ===================================================================== */
/* шторка со страховкой: её падение не должно уносить экран под ней */
function sheetSafe(){
  try { return sheet(); }
  catch(e){
    console.error('[Eva] шторка не собралась:', e);
    return `<div class="bg" onclick="if(event.target===this)closeSheet()">
      <div class="sheet"><div class="grab"></div>
        <h2 class="serif" style="font-size:20px;margin:0 0 6px">Не получилось открыть</h2>
        <p class="small muted" style="margin:0 0 14px">В этих данных чего-то не хватает. Остальное работает.</p>
        <button class="btn" onclick="closeSheet()">Закрыть</button></div></div>`;
  }
}

/* Окно всегда открывается от какой-то записи: урока, курса, эксперта.
   Запись может исчезнуть между открытием списка и нажатием — редакция
   удалила материал, эксперт снял услугу, синхронизация принесла свежие
   данные. Раньше окно в этом случае падало в «Не получилось открыть» с
   ошибкой в консоли. Теперь говорит понятную фразу и не пугает. */
const gone = what => `<div class="empty">${what} больше нет — возможно, запись удалили.<br>
  Вернись к списку, там всё свежее.</div>
  <button class="btn ghost" style="margin-top:10px" onclick="closeSheet()">Закрыть</button>`;

function sheet(){
  const k = typeof S.sheet === 'string' ? S.sheet : S.sheet.k;
  const body = ({lesson:shLesson, course:shCourse, rebuild:shRebuild, eva:shEva,
    hint:shHint, addTag:shAddTag, cycle:shCycle, hd:shHD, consult:shConsult, write:shWrite,
    newContent:shNewContent, editContent:shEditContent, reject:shReject, rework:shRework,
    units:shUnits, groupInfo:shGroupInfo, newGroup:shNewGroup, fix:shFix, video:shVideo,
    invite:shInvite, hello:shHello, askGroup:shAskGroup, weekSum:shWeekSum,
    myPage:shMyPage, toMate:shToMate,
    hw:shHW, event:shEvent, newEvent:shNewEvent, eventEdit:shEventEdit, evReview:shEvReview, write2:shWrite2, hwEdit:shHwEdit,
    expertApply:shExpertApply, install:shInstall, diag:shDiag, askGood:shAskGood, photo:shPhoto, ticket:shTicket, dating:shDating, dropProfile:shDropProfile, newInt:shNewInt, pickPhrase:shPickPhrase, exMail:shExMail, exPass:shExPass, changeMail:shChangeMail, changePass:shChangePass, support:shSupport, expTags:shExpTags, newEdu:shNewEdu, addUser:shAddUser, grant:shGrant, eduCheck:shEduCheck,
    service:shService, editUser:shEditUser,
    partnerApply:shPartnerApply, eventApply:shEventApply, rules:shRules, anonNick:shAnonNick,
    newCourse:shNewCourse, newGood:shNewGood, idea:shIdea})[k]();
  /* Часть окон — не шторка снизу, а окно по центру: короткий разговор,
     на который надо ответить сейчас, а не «дочитать список». Ник в
     анонимной комнате именно такой: без него она не может написать. */
  const mid = MODAL_SHEETS.indexOf(k) >= 0;
  return `<div class="bg${mid ? ' mid' : ''}" onclick="if(event.target===this)closeSheet()">
    <div class="sheet${mid ? ' modal' : ''}">${mid ? '' : '<div class="grab"></div>'}${body}</div></div>`;
}
const MODAL_SHEETS = ['anonNick'];

function shLesson(){
  const x = LIB.find(i => i.id === S.sheet.id);
  const inProg = S.program.map((d,di) => d.tasks.map((t,ti) => ({t,di,ti})))
                  .flat().find(o => o.t.id === x.id);
  const e = expBy(x.expert);
  return `${x.video
    ? `<div style="margin-bottom:14px">${videoBlock(x.id, x.type)}</div>`
    : `<div style="border-radius:var(--r-lg);overflow:hidden;height:190px;position:relative;margin-bottom:14px">
        ${cover(x.id, x.type)}
        ${x.type !== 'affirm' ? '<div class="play">▶</div>' : ''}
        <div class="badge">${TYPE[x.type].l}</div>
      </div>`}
    <div class="spread"><div class="eyebrow">${x.min} мин · ${matchOf(x)}% совпадение</div>
      <button class="starbtn ${isLiked(x.id)?'on':''}" onclick="starContent(this,'${attJs(x.id)}')">
        ${starMark(16, isLiked(x.id) ? '#E7A339' : 'rgba(17,16,20,.22)')}
        <span style="font-size:11px">${isLiked(x.id)?'в избранном':'в избранное'}</span></button></div>
    <h2 class="serif" style="font-size:27px;margin:8px 0 10px">${esc(x.title)}</h2>
    <p style="font-size:14.5px;line-height:1.6;color:var(--muted);margin:0 0 14px">${esc(x.type==='affirm' ? '«'+x.text+'»' : x.text)}</p>
    <div class="chips wrap">${x.tags.map(t => `<span class="chip pale">${esc(t)}</span>`).join('')}</div>

    <button class="card" style="margin-top:14px;width:100%;text-align:left" onclick="closeSheet();openExpert('${attJs(e.id)}')">
      <div class="row"><div class="pcirc" style="width:42px;height:42px">${expPic(e)}</div>
        <div style="flex:1"><b style="font-size:14px">${esc(e.n)} ${e.verified?'<span class="vt">✓</span>':''}</b>
          <div class="small muted">${esc(e.r)}</div></div>
        <span class="stars5">★ ${e.rate}</span><span class="muted">›</span></div>
    </button>

    ${inProg && !inProg.t.done ? `<button class="btn" onclick="complete(${inProg.di},${inProg.ti});closeSheet()">
      ${TYPE[x.type].act} +${TYPE[x.type].pts}</button>` :
      inProg ? `<button class="btn done" disabled>✓ Уже выполнено</button>` :
      `<button class="btn" onclick="addToDay('${attJs(x.id)}')">Добавить в мой день</button>`}
    <button class="btn ghost" style="margin-top:9px" onclick="speak(${JSON.stringify(x.text).replace(/"/g,'&quot;')})">Прочитать вслух</button>`;
}

function shCourse(){
  const c = COURSES.find(i => i.id === S.sheet.id), e = expBy(c.e);
  const bonus = Math.min(S.bonus, Math.round(c.p*0.3));
  return `<div style="border-radius:var(--r-lg);overflow:hidden;height:180px;position:relative;margin-bottom:14px">
      ${cover(c.id,'course')}<div class="cap"><b>${esc(c.t)}</b><span>${esc(c.e)}</span></div></div>
    <div class="eyebrow">${plural(c.n,'урок','урока','уроков')} · ★ ${c.r}</div>
    <h2 class="serif" style="font-size:26px;margin:8px 0 10px">${esc(c.t)}</h2>
    <p style="font-size:14.5px;line-height:1.6;color:var(--muted);margin:0 0 14px">${esc(c.d)}</p>
    <div class="card">
      <div class="spread"><span class="small muted">Цена</span>
        <div><span class="price">${money(c.p)}</span><span class="old">${money(c.old)}</span></div></div>
      <div class="spread" style="margin-top:8px"><span class="small muted">Можно списать бонусами</span>
        <b style="color:var(--rose-deep)">−${money(bonus)}</b></div>
      <div class="spread" style="margin-top:8px"><span class="small muted">Баллов за прохождение</span>
        <b style="color:var(--ok)">+150</b></div>
    </div>
    <button class="card" style="width:100%;text-align:left" onclick="closeSheet();openExpert('${attJs(e.id)}')">
      <div class="row"><div class="pcirc" style="width:42px;height:42px">${expPic(e)}</div>
      <div style="flex:1"><b style="font-size:14px">${esc(e.n)}</b><div class="small muted">${esc(e.r)}</div></div>
      <span class="muted">›</span></div></button>
    <button class="btn" onclick="buyCourse('${attJs(c.id)}')">Записаться за ${money(c.p - bonus)}</button>`;
}

function shRebuild(){
  const tags = allTags().map(([t]) => t);
  return `<h2 class="serif" style="font-size:25px;margin:0 0 6px">Пересобрать программу</h2>
    <p class="small muted" style="margin:0 0 16px">Ева заново пройдёт по библиотеке и соберёт семь дней. Отметки обнулятся, баллы и звёзды останутся.</p>
    <div class="eyebrow" style="margin-bottom:10px">Темы</div>
    <div class="chips wrap">${tags.map(t =>
      `<button class="chip ${S.tags.includes(t)?'on':''}" onclick="tgTag('${attJs(t)}')">${esc(t)}</button>`).join('')}</div>
    <div class="eyebrow" style="margin:16px 0 10px">Сколько минут в день</div>
    <div class="seg">${[[10,'5–10 мин'],[20,'15–20 мин'],[35,'30+ мин']].map(([v,l]) =>
      `<button class="${S.time===v?'on':''}" onclick="S.time=${v};render()">${l}</button>`).join('')}</div>
    <div class="eyebrow" style="margin:16px 0 10px">Удобное время</div>
    <div class="seg">${['утро','день','вечер'].map(v =>
      `<button class="${S.slot===v?'on':''}" onclick="S.slot='${attJs(v)}';render()">${v}</button>`).join('')}</div>
    <button class="btn" style="margin-top:16px" ${S.tags.length?'':'disabled'} onclick="rebuild()">Собрать заново</button>`;
}

/* ---------- Ева ---------- */
function shEva(){
  return `<div class="row" style="margin-bottom:14px">
      <div class="dot-ava" style="background:var(--grad-hero);width:42px;height:42px;font-size:17px">✦</div>
      <div style="flex:1"><b style="font-size:16px">Ева</b><div class="small muted">твоя помощница</div></div>
      <button class="chip" onclick="closeSheet()">Закрыть</button>
    </div>
    <div id="chat" style="max-height:42vh;overflow-y:auto;margin-bottom:12px">
      ${(S.eva||[]).map(m => `<div class="bubble ${m.r==='me'?'me':''}">${esc(m.t)}</div>`).join('')}
    </div>
    <div class="chips">${['Что мне сегодня делать?','Почему такая программа?','Нет времени на себя','Прочитай аффирмацию','Сколько у меня баллов?']
      .map(q => `<button class="chip" onclick="ask('${attJs(q)}')">${q}</button>`).join('')}</div>
    <div class="row" style="gap:8px">
      <input class="field" id="vin" style="margin:0" placeholder="Напиши Еве" onkeydown="if(event.key==='Enter')ask(this.value)">
      <button class="btn" style="width:auto;padding:13px 17px" onclick="ask($('#vin').value)">→</button>
      <button class="btn ghost" style="width:auto;padding:13px 15px" onclick="listen()">🎙</button>
    </div>`;
}

function ask(q){
  if(!q || !q.trim()) return;
  S.eva = S.eva || []; S.eva.push({r:'me', t:q.trim()});
  const a = evaAnswer(q.toLowerCase());
  S.eva.push({r:'eva', t:a});
  render();
  const c = $('#chat'); if(c) c.scrollTop = c.scrollHeight;
  speak(a);
}

function evaAnswer(q){
  const day = (S.program || [])[S.day] || {tasks:[]}, left = day.tasks.filter(t => !t.done);
  if(/аффирмац|прочит/.test(q)){
    const af = day.tasks.find(t => t.type === 'affirm') || day.tasks[0];
    return af && af.text ? af.text : 'На сегодня аффирмации нет — загляни в библиотеку, там их много.';
  }
  if(/балл|звёзд|звезд|статус|уровен/.test(q)){
    const {next} = levelNow();
    return `У тебя ${S.points} баллов и ${S.stars} из ${starsTotal()} звёзд на этой неделе.` + (next ? ` До статуса «${esc(next.n)}» осталось ${next.from - S.points}.` : '');
  }
  if(/почему|как.*собра|подобра/.test(q))
    return `Я собрала программу по твоим темам: ${((S.goals||[]).length ? S.goals : S.tags).slice(0,4).join(', ')}. Из ${LIB.length} уроков библиотеки выбрала те, где совпадение выше всего — среднее по программе ${S.match}%.`;
  if(/нет времени|не успева|некогда|нет сил|устал|тяжел/.test(q)){
    S.gentle = true;
    return 'Включила мягкий режим: сегодня только аффирмация на одну минуту. Остальное подождёт, программа никуда не денется.';
  }
  if(/сегодня|делать|задани|план/.test(q))
    return left.length ? `Осталось ${plural(left.length,'задание','задания','заданий')}: ${left.map(t => t.title).join(', ')}. Начни с самого короткого - это ${left.slice().sort((a,b)=>a.min-b.min)[0].title}.`
                       : 'Всё на сегодня закрыто. Три звезды твои, можно выдохнуть.';
  if(/пересобра|нов.*программ|друг.*программ/.test(q)){ setTimeout(() => openSheet('rebuild'), 500); return 'Открываю настройки программы.'; }
  if(/сплю|сон|бессонниц/.test(q)) return 'Посмотри «Йога-нидра перед сном» у Марины Ясной - двадцать минут лёжа, многие засыпают на середине. Найдёшь в контенте по тегу «сон».';
  if(/тревог|паник|страшно/.test(q)) return 'В моменте помогает удлинённый выдох: вдох на четыре, выдох на восемь. В библиотеке это «Дыхание при тревоге», шесть минут.';
  if(/курс/.test(q)) return `Под твои темы ближе всего «${COURSES[0].t}» от ${COURSES[0].e}. Открой вкладку Курсы.`;
  if(/привет|здравств|как дела/.test(q)) return `${hello()}, ${S.name || 'Ева'}. Чем помочь?`;
  return 'Я умею рассказать про сегодняшний день, объяснить логику программы, включить мягкий режим и прочитать аффирмацию вслух. Спроси что-то из этого.';
}

function listen(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR) return toast('Распознавание речи работает в Chrome и Safari');
  const r = new SR(); r.lang = 'ru-RU'; r.interimResults = false;
  r.onresult = e => ask(e.results[0][0].transcript);
  r.onerror = () => toast('Не расслышала, попробуй ещё раз');
  r.start(); toast('Слушаю...');
}

/* =====================================================================
   ДЕЙСТВИЯ
   ===================================================================== */
function openSheet(k){ S.sheet = k; render(); }
function openIdea(){ S.sheet = 'idea'; render(); }
function closeSheet(){ S.sheet = null; render(); }
function openLesson(id){ S.sheet = {k:'lesson', id}; render(); }
function tgTag(t){
  S.tagw = S.tagw || {};
  if(S.tags.includes(t)){ S.tags = S.tags.filter(x => x !== t); delete S.tagw[t]; }
  else { S.tags = [...S.tags, t]; S.tagw[t] = 0.9; }   // выбрала сама — весит как ответ теста
  render();
}
function rebuild(){ buildProgram(); S.sheet = null; S.gentle = false; render(); toast('Программа собрана заново'); }

function addToDay(id){
  const x = LIB.find(i => i.id === id);
  if(!(S.program || [])[S.day]) return;
  S.program[S.day].tasks.push(task(x, S.slot));
  S.sheet = null; S.tab = 'home'; S.page = null; render();
  toast('Добавила в день ' + (S.day+1));
}

function addCart(id){
  const c = S.cart.find(x => x.id === id);
  if(c) c.n++; else S.cart.push({id, n:1});
  render(); toast('В корзине');
}
function qty(id, d){
  const c = S.cart.find(x => x.id === id);
  c.n += d; if(c.n <= 0) S.cart = S.cart.filter(x => x.id !== id);
  render();
}
function checkout(){
  const _items = S.cart.map(c => ({id:c.id, n:c.n}));
  const items = S.cart.map(c => ({...GOODS.find(g => g.id === c.id), n:c.n}));
  const total = items.reduce((a,i) => a + i.p*i.n, 0);
  const used = Math.min(S.bonus, Math.round(total*0.3));
  const cb = Math.round(total*0.05);
  S.bonus = S.bonus - used + cb;
  S.points += Math.min(50, Math.round(total/200));
  items.forEach(i => S.purchases.unshift({t:i.t, p:i.p*i.n, cb:Math.round(i.p*i.n*0.05), date:'сегодня'}));
  S.orders.unshift({id:'o'+Date.now().toString(36), who:S.name || 'Гостья',
    mail:S.user ? S.user.email : '—', items:_items, sum:total, bonus:used, st:'новый',
    d:'сегодня', city:(S.datingProfile && S.datingProfile.city) || 'Москва', phone:S.phone || ''});
  const oid = S.orders[0].id;
  platformSay(`Заказ принят: ${items.map(i => i.t + (i.n > 1 ? ' × ' + i.n : '')).join(', ')}. ` +
    `Сумма ${money(total)}${used ? ', из них бонусами ' + used : ''}. ` +
    `Номер заказа ${oid}. Менеджер напишет сюда, как оплатить и когда доставим — обычно в течение дня. ` +
    `Если нужно что-то поменять или отменить, ответь на это сообщение. Кэшбэк ${cb} бонусов уже начислен.`,
    '', 'market');
  S.cart = []; S.page = 'profile'; render(); schedulePersist();
  if(typeof syncPush === 'function') syncPush(['orders']);
  toast('Заказ принят. Подробности — в сообщениях');
}
/* Оплаты пока нет. Раньше «Купить» открывало курс бесплатно и обещало
   «+150 баллов» (начисляя 50). Теперь это заявка: команда видит её в
   поддержке, открывает курс в карточке пользователя — и он появляется
   у женщины при следующем входе. */
function buyCourse(id){
  if(S.courses.includes(id)) return;
  const c = COURSES.find(x => x.id === id);
  if(!c) return;
  S.courseAsked = S.courseAsked || [];
  if(S.courseAsked.includes(id)){ S.sheet = null; render(); return toast('Заявка на этот курс уже у нас'); }
  const tk = toSupport('Курс: ' + c.t, 'Хочу курс «' + c.t + '» (' + money(c.p) + '). Оплата картой ещё не подключена — прошу открыть доступ.', 'course', {course:c.id});
  if(!tk) return toast('Не отправилось, попробуй позже');
  S.courseAsked.push(id);
  platformSay(`Заявка на курс «${c.t}» у нас. Оплата картой пока не подключена, поэтому курс откроем вручную ` +
    `и напишем сюда — обычно в течение дня. Первые уроки уже открыты, можно начинать.`, 'openCourses', 'experts', tk.id);
  S.sheet = null; render(); schedulePersist();
  toast('Заявка отправлена. Подтверждение — в сообщениях');
}
function join(id){
  const g = GROUPS.find(x => x.id === id);
  const was = S.joined.includes(id);
  /* в сообщество по заявке не входят молча: сначала пара строк о себе */
  if(!was && g && g.access === 'request' && myGRole(g) === 'visitor')
    return openSheet({k:'askGroup', id});
  S.joined = was ? S.joined.filter(x => x !== id) : [...S.joined, id];
  render(); schedulePersist();
  /* первое, что видит новенькая, — приветствие ведущей, а не пустая переписка */
  if(!was && g) setTimeout(() => openSheet({k:'hello', id}), 120);
}

function shAskGroup(){
  const g = GROUPS.find(x => x.id === S.sheet.id);
  if(!g) return `<div class="empty">Сообщество не найдено</div>`;
  return `<h2 class="serif" style="font-size:21px;margin:0 0 4px">Заявка в «${esc(g.t)}»</h2>
    <p class="small muted" style="margin:0 0 12px">${esc(g.who || 'Расскажи пару слов о себе — ведущая посмотрит и ответит.')}</p>
    <textarea class="field" id="gq_t" rows="3" placeholder="Почему тебе сюда"></textarea>
    <button class="btn" onclick="askGroup('${attJs(g.id)}')">Отправить заявку</button>`;
}
function copyRef(){
  const u = 'https://eva.space/r/' + (S.name||'eva').toLowerCase();
  if(navigator.clipboard) navigator.clipboard.writeText(u).catch(()=>{});
  toast('Ссылка скопирована');
}
function restartQuiz(){ resetQuiz(); S.screen='quiz'; S.sheet=null; S.page=null; render(); stars(); }
/* ---------- старт ---------- */
window.S = S; window.LIB = LIB;
S.tags = ['спокойствие','тревога','уверенность'];
buildProgram();
S.tags = [];
S.screen = 'splash';
render();
initPWA();
watchCalendar();
SYNC.ready = initSync();

function shHint(){
  const h = HINTS[S.sheet.id];
  return `<h2 class="serif" style="font-size:25px;margin:0 0 12px">${esc(h.t)}</h2>
    <p style="font-size:14.5px;line-height:1.65;color:var(--muted);white-space:pre-line;margin:0 0 16px">${h.b}</p>
    <button class="btn" onclick="closeSheet()">Понятно</button>`;
}

function shAddTag(){
  const rest = allTags().map(([t]) => t).filter(t => !S.tags.includes(t));
  return `<h2 class="serif" style="font-size:24px;margin:0 0 6px">Добавить тему</h2>
    <p class="small muted" style="margin:0 0 14px">Программа пересоберётся сразу - уроки по новой теме появятся в ближайших днях.</p>
    <div class="chips wrap">${rest.map(t => `<button class="chip" onclick="addTag('${attJs(t)}')">${t}</button>`).join('')}</div>`;
}

function shCycle(){
  const c = S.cycle;
  return `<h2 class="serif" style="font-size:24px;margin:0 0 6px">Трекер цикла</h2>
    <p class="small muted" style="margin:0 0 14px">Оценка по средней длине цикла. Не медицинский прогноз и не способ контрацепции.</p>
    <b style="font-size:14px">Первый день последних месячных</b>
    <input class="field" type="date" style="margin-top:8px" id="cl" value="${c.last}">
    <b style="font-size:14px">Длина цикла, дней</b>
    <input class="field" type="number" min="20" max="45" style="margin-top:8px" id="cn" value="${c.len}">
    <b style="font-size:14px">Длительность месячных, дней</b>
    <input class="field" type="number" min="2" max="10" style="margin-top:8px" id="cp" value="${c.period}">
    <button class="btn" style="margin-top:6px" onclick="saveCycle()">Сохранить</button>
    ${c.last ? `<button class="btn ghost" style="margin-top:9px" onclick="S.cycle.last='';S.sheet=null;render()">Отключить трекер</button>` : ''}`;
}

function saveCycle(){
  const l = $('#cl').value;
  if(!l) return toast('Укажи дату');
  S.cycle = {last:l, len:+$('#cn').value || 28, period:+$('#cp').value || 5, on:true};
  S.sheet = null; render(); toast('Трекер настроен');
}

function shHD(){
  if(S.hdi >= HD_Q.length){
    const t = HD[S.hd];
    return `<div style="text-align:center;padding:8px 0 4px"><div style="font-size:40px">✦</div>
      <h2 class="serif" style="font-size:27px;margin:10px 0 8px">${esc(t.n)}</h2>
      <p style="font-size:14.5px;line-height:1.6;color:var(--muted)">${t.s}</p></div>
      <div class="card"><b style="font-size:14px">Твоя сила</b><div class="small muted" style="margin-top:5px">${esc(t.str)}</div></div>
      <div class="card"><b style="font-size:14px">Ловушка</b><div class="small muted" style="margin-top:5px">${t.warn}</div></div>
      <p class="small muted" style="text-align:center">Упрощённый тест по четырём вопросам, не расчёт карты рождения.</p>
      <button class="btn" onclick="closeSheet()">Хорошо</button>`;
  }
  const q = HD_Q[S.hdi];
  return `<div class="small muted">Вопрос ${S.hdi+1} из ${HD_Q.length}</div>
    <h2 class="serif" style="font-size:24px;margin:8px 0 16px">${q.q}</h2>
    ${q.o.map(o => `<button class="optl" onclick="hdPick('${attJs(o.v)}')">${esc(o.t)}</button>`).join('')}`;
}

function startHD(){ S.hdi = 0; S.hdAnswers = []; S.sheet = 'hd'; render(); }

function hdPick(v){
  S.hdAnswers.push(v); S.hdi++;
  if(S.hdi >= HD_Q.length) S.hd = hdCalc(S.hdAnswers);
  render();
}

/* Заявка эксперту и вопрос ему уходят в поддержку — туда, где их видит
   команда и откуда ответ приходит женщине в личные сообщения. Раньше обе
   кнопки только показывали «отправлено»: заявки не существовало нигде. */
function shConsult(){
  const e = EXPERTS.find(x => x.id === S.sheet.id);
  return `<h2 class="serif" style="font-size:24px;margin:0 0 6px">Заявка на консультацию</h2>
    <p class="small muted" style="margin:0 0 14px">${esc(e.n)} · 50 минут онлайн · ${money(e.price)}</p>
    <input class="field" id="cs_name" placeholder="Имя" value="${esc(S.name)}">
    <input class="field" id="cs_contact" placeholder="Телефон или телеграм">
    <textarea class="field" id="cs_text" rows="3" placeholder="С каким запросом приходишь"></textarea>
    <div class="seg">${['утро','день','вечер'].map(t => `<button class="${t===S.slot?'on':''}" onclick="S.slot='${attJs(t)}';render()">${t}</button>`).join('')}</div>
    <button class="btn" onclick="sendConsult('${attJs(e.id)}')">Отправить заявку</button>
    <p class="tiny muted" style="margin-top:10px">Заявку получит команда Евы и передаст эксперту. Ответ придёт в личные сообщения.</p>`;
}
function sendConsult(eid){
  const e = EXPERTS.find(x => x.id === eid);
  const contact = (($('#cs_contact')||{}).value || '').trim();
  const text = (($('#cs_text')||{}).value || '').trim();
  if(!contact) return toast('Оставь телефон или телеграм — иначе не с кем связаться');
  const t = toSupport('Заявка на консультацию: ' + (e ? e.n : ''),
    ['Имя: ' + ((($('#cs_name')||{}).value || S.name || '').trim()), 'Связь: ' + contact,
     'Удобно: ' + S.slot, '', text || 'Запрос не описан'].join('\n'), 'consult');
  platformSay(`Заявка на консультацию к ${e ? e.n : 'эксперту'} передана. ` +
    `Свяжемся по контакту «${contact}» и напишем сюда — обычно в течение дня.`,
    '', 'experts', t && t.id);
  S.sheet = null; render();
  toast('Заявка отправлена. Подтверждение — в сообщениях');
}

function shWrite(){
  const e = EXPERTS.find(x => x.id === S.sheet.id);
  return `<h2 class="serif" style="font-size:24px;margin:0 0 6px">Написать эксперту</h2>
    <p class="small muted" style="margin:0 0 14px">${esc(e.n)} обычно отвечает в течение суток.</p>
    <textarea class="field" id="wq_text" rows="5" placeholder="Твой вопрос"></textarea>
    <button class="btn" onclick="sendExpertQuestion('${attJs(e.id)}')">Отправить</button>
    <p class="tiny muted" style="margin-top:10px">Ответ придёт в личные сообщения.</p>`;
}
function sendExpertQuestion(eid){
  const e = EXPERTS.find(x => x.id === eid);
  const text = (($('#wq_text')||{}).value || '').trim();
  if(!text) return toast('Напиши вопрос');
  const tk = toSupport('Вопрос эксперту: ' + (e ? e.n : ''), text, 'question');
  platformSay(`Вопрос для ${e ? e.n : 'эксперта'} передан: «${text.length > 90 ? text.slice(0, 88) + '…' : text}». ` +
    `Ответ придёт сюда — обычно в течение суток.`, '', 'experts', tk && tk.id);
  S.sheet = null; render();
  toast('Вопрос отправлен. Ответ придёт в сообщения');
}

/* Одно окно в поддержку для всех обращений из приложения.
   kind — вид заявки (expert, partner, event, course, sub, order…): по нему
   администратор видит заявки прямо в своём разделе, а не только в общей
   ленте поддержки. data — структурированные поля, из которых заявку можно
   превратить в мероприятие или карточку одной кнопкой. */
function toSupport(sub, text, kind, data){
  if(typeof INBOX === 'undefined') return null;
  const t = {
    id:'s' + Date.now().toString(36),
    from: S.name || 'Участница',
    role: S.role === 'expert' ? 'эксперт' : 'ученица',
    mail: S.user ? S.user.email : '—',
    ago: 'только что', sub, t: text, st:'новое',
    kind: kind || '', at: Date.now()
  };
  if(data) t.data = data;
  t.msgs = [{id:'m' + Date.now().toString(36), who:'user', t:text, at:Date.now()}];
  INBOX.unshift(t);
  if(typeof syncPush === 'function') syncPush(['support']);
  return t;
}

/* Подтверждение в её сообщениях. Тост живёт две секунды, и после него
   легко засомневаться: ушло ли, что дальше, когда ждать. Поэтому всё,
   что она отправила или заказала, оставляет след в переписке — и не
   в общей куче, а у того отправителя, кто за это отвечает. */
function platformSay(text, act, chan, tid){
  if(typeof sayFrom !== 'function') return;
  sayFrom(chan || 'space', text, act, tid);
}
/* Обращение — это разговор, а не одно письмо. Раньше ответ поддержки
   уходил женщине, её ответ заводил новое обращение, и связать их было
   нечем: администратор видел ленту обрывков. Теперь у обращения есть
   переписка, и обе стороны дописывают в неё. */
function ticketSay(tk, who, text){
  if(!tk) return null;
  tk.msgs = Array.isArray(tk.msgs) ? tk.msgs : (tk.t ? [{id:'m0', who:'user', t:tk.t, at:tk.at || Date.now()}] : []);
  const m = {id:'m' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
             who, t:String(text), at:Date.now()};
  tk.msgs.push(m);
  if(tk.msgs.length > 60) tk.msgs = tk.msgs.slice(-60);
  return m;
}

/* какой отправитель отвечает за этот вид заявки */
const KIND_CHAN = {expert:'experts', question:'experts', consult:'experts', course:'experts',
                   partner:'market', order:'market',
                   event:'events',
                   sub:'space', support:'space', reply:'space'};
const chanOf = kind => KIND_CHAN[kind] || 'space';

function suggestTags(text){
  const t = (text || '').toLowerCase();
  const found = allTags().map(([g]) => g).filter(g => t.includes(g.slice(0, Math.max(4, g.length-2))));
  const extra = {'дыхан':'тревога','сон':'сон','мама':'материнство','ребен':'материнство','границ':'границы',
    'деньг':'деньги','тело':'тело','устал':'выгорание','критик':'самокритика','беремен':'беременность'};
  Object.entries(extra).forEach(([k,v]) => { if(t.includes(k) && !found.includes(v)) found.push(v); });
  return found.slice(0,5);
}

function shEditContent(){
  const x = LIB.find(i => i.id === S.sheet.id);
  return `<h2 class="serif" style="font-size:24px;margin:0 0 12px">Редактирование</h2>
    <input class="field" value="${esc(x.title)}" oninput="x_edit('${attJs(x.id)}','title',this.value)">
    <textarea class="field" rows="4" oninput="x_edit('${attJs(x.id)}','text',this.value)">${esc(x.text)}</textarea>
    <input class="field" type="number" value="${x.min}" oninput="x_edit('${attJs(x.id)}','min',+this.value)">
    <div class="small muted" style="margin-bottom:6px">Теги</div>
    <div class="chips wrap">${allTags().map(([t]) =>
      `<button class="chip ${x.tags.includes(t)?'on':''}" onclick="tgItem('${attJs(x.id)}','${attJs(t)}')">${esc(t)}</button>`).join('')}</div>
    <button class="btn" style="margin-top:14px" onclick="S.sheet=null;render();toast('Сохранено')">Сохранить</button>
    <button class="btn ghost" style="margin-top:9px" onclick="delItem('${attJs(x.id)}')">Удалить материал</button>`;
}

function x_edit(id,f,v){ const x = LIB.find(i => i.id === id); x[f] = v; }

function tgItem(id,t){
  const x = LIB.find(i => i.id === id);
  x.tags = x.tags.includes(t) ? x.tags.filter(g => g !== t) : [...x.tags, t];
  render();
}

function delItem(id){
  const i = LIB.findIndex(x => x.id === id);
  LIB.splice(i,1); S.sheet = null; render(); toast('Материал удалён');
}

function shReject(){
  const x = S.pending.find(i => i.id === S.sheet.id);
  return `<h2 class="serif" style="font-size:24px;margin:0 0 6px">Отклонить материал</h2>
    <p class="small muted" style="margin:0 0 14px">«${esc(x.title)}» · ${esc(x.expert)}</p>
    <textarea class="field" id="rc" rows="4" placeholder="Комментарий автору: что поправить"></textarea>
    <button class="btn" onclick="reject('${attJs(x.id)}')">Отклонить с комментарием</button>
    <button class="btn ghost" style="margin-top:9px" onclick="closeSheet()">Отмена</button>`;
}

function shNewGood(){
  return `<h2 class="serif" style="font-size:24px;margin:0 0 12px">Новый товар</h2>
    <input class="field" placeholder="Название">
    <input class="field" type="number" placeholder="Цена, ₽">
    <input class="field" type="number" placeholder="Старая цена, ₽">
    <div class="seg">${['Для практики','Одежда','Дом'].map((k,i) => `<button class="${i===0?'on':''}">${k}</button>`).join('')}</div>
    <button class="btn" style="margin-top:14px" onclick="S.sheet=null;render();toast('Товар добавлен в каталог')">Добавить</button>`;
}

function shIdea(){
  return `<h2 class="serif" style="font-size:24px;margin:0 0 6px">Предложить доработку</h2>
    <p class="small muted" style="margin:0 0 14px">Идеи попадают к команде, самые популярные уходят в работу.</p>
    <textarea class="field" id="ii" rows="4" placeholder="Чего не хватает в приложении"></textarea>
    <button class="btn" onclick="sendIdea()">Отправить</button>`;
}

function sendIdea(){
  const t = ($('#ii')||{}).value;
  if(!t || !t.trim()) return toast('Напиши идею');
  S.ideas.unshift({id:'i'+Date.now().toString(36), a:S.name||'Гостья', t:t.trim(), v:1, st:'новое', pr:'—', d:'только что'});
  S.points += 5; S.sheet = null; render(); toast('Спасибо, идея отправлена. +5 баллов');
}

function openHint(k){ S.sheet = {k:'hint', id:k}; render(); }
/* =====================================================================
   ШТОРКИ v3.x (восстановлено)
   ===================================================================== */

/* ---------- черновик материала ---------- */
function cDraft(){
  if(!S.cd) S.cd = {type:'practice', title:'', text:'', min:10, video:'', tags:[], free:true,
                    aud:[], level:'any', days:[], key:'draft_'+Date.now().toString(36)};
  return S.cd;
}
function setCD(f, v){ cDraft()[f] = v; }
function tgNew(btn, t){
  const d = cDraft();
  const on = d.tags.includes(t);
  d.tags = on ? d.tags.filter(x => x !== t) : [...d.tags, t];
  btn.classList.toggle('on', !on);
  const c = document.getElementById('tagcount');
  if(c) c.textContent = d.tags.length ? '· выбрано ' + d.tags.length : '';
}

function shNewContent(){
  const d = cDraft();
  const sug = suggestTags(d.title + ' ' + d.text).filter(t => !d.tags.includes(t));
  return `<h2 class="serif" style="font-size:22px;margin:0 0 6px">
    ${S.role === 'admin' ? 'Загрузить материал' : 'Предложить материал'}</h2>
  <p class="small muted" style="margin:0 0 12px">${S.role === 'admin'
    ? 'Материал появится в библиотеке сразу.' : 'Уйдёт на проверку редакции - ответ обычно за сутки.'}</p>

  <label class="lbl">Тип</label>
  <div class="seg">${Object.entries(TYPE).map(([k,v]) =>
    `<button class="${d.type===k?'on':''}" onclick="chipPick(this,'cd.type','${attJs(k)}')">${v.l}</button>`).join('')}</div>

  ${MEDIA[d.key] ? `<img class="upprev" src="${safeUrl(MEDIA[d.key])}" alt="">
    <div class="acts" style="margin:0 0 9px"><button class="btn ghost sm" onclick="pickImage('${attJs(d.key)}')">Заменить фото</button>
      <button class="btn ghost sm" onclick="delete MEDIA['${attJs(d.key)}'];render()">Убрать</button></div>`
  : `<button class="upbox" style="width:100%" onclick="pickImage('${attJs(d.key)}')">
      <div style="font-size:20px">▣</div>
      <div style="font-weight:600;font-size:13.5px;margin-top:6px">Загрузить обложку</div>
      <div class="small muted">JPEG, PNG, WebP, HEIC. Сожмём до 1400 px, резкость сохранится</div>
    </button>`}

  <label class="lbl">Название</label>
  <input class="field" id="nt" value="${esc(d.title)}" placeholder="Например: Дыхание при тревоге"
    oninput="setCD('title',this.value)">

  <label class="lbl">Описание</label>
  <textarea class="field" id="nx" rows="4" placeholder="Что даёт практика и как её делать"
    oninput="setCD('text',this.value)">${esc(d.text)}</textarea>

  <div class="g2">
    <div><label class="lbl">Длительность, мин</label>
      <input class="field" type="number" value="${d.min}" oninput="setCD('min',+this.value||10)"></div>
    <div><label class="lbl">Доступ</label>
      <div class="seg" style="margin:0">
        <button class="${d.free?'on':''}" onclick="chipPick(this,'cd.free',true)">Бесплатно</button>
        <button class="${!d.free?'on':''}" onclick="chipPick(this,'cd.free',false)">По подписке</button>
      </div></div>
  </div>

  <label class="lbl">Ссылка на видео</label>
  <input class="field" value="${esc(d.video)}" placeholder="https://youtu.be/..." oninput="setCD('video',this.value)">

  <div class="svcbox">
    <div class="hd"><span class="svclabel">служебное</span><b>Кому показывать</b></div>
    <div class="small muted">Ученицы не видят. Не выбрано — подходит всем</div>
    <div class="chips wrap">${AUDIENCE.map(a => `<button class="chip ${(d.aud||[]).includes(a.k)?'on':''}"
      onclick="chipToggle(this,'cd.aud','${attJs(a.k)}')">${esc(a.n)}</button>`).join('')}</div>
  </div>

  <div class="svcbox">
    <div class="hd"><span class="svclabel">служебное</span><b>Уровень подготовки</b></div>
    <div class="seg" style="margin-top:8px">${LEVELS_CONTENT.map(l => `<button class="${(d.level||'any')===l.k?'on':''}"
      onclick="chipPick(this,'cd.level','${attJs(l.k)}')">${esc(l.n)}</button>`).join('')}</div>
  </div>

  <div class="svcbox">
    <div class="hd"><span class="svclabel">служебное</span><b>День недели</b></div>
    <div class="small muted">Не выбрано — любой день</div>
    <div class="chips wrap">${WEEKDAYS_TAG.map(w => `<button class="chip ${(d.days||[]).includes(w.k)?'on':''}"
      onclick="chipToggle(this,'cd.days','${attJs(w.k)}')">${esc(w.n)}</button>`).join('')}</div>
  </div>

  <label class="lbl">Теги <span id="tagcount" class="muted">${d.tags.length ? '· выбрано ' + d.tags.length : ''}</span></label>
  ${sug.length ? `<div class="chips wrap" style="padding-bottom:4px">${sug.map(t =>
    `<button class="chip ${d.tags.includes(t)?'on':''}" onclick="tgNew(this,'${attJs(t)}')">✦ ${t}</button>`).join('')}</div>` : ''}
  <div class="chips wrap">${ALL_TAGS.filter(t => !sug.includes(t)).map(t =>
    `<button class="chip ${d.tags.includes(t)?'on':''}" onclick="tgNew(this,'${attJs(t)}')">${t}</button>`).join('')}</div>

  <button class="btn" style="margin-top:14px" onclick="saveContent()">
    ${S.role === 'admin' ? 'Опубликовать' : 'Отправить на проверку'}</button>`;
}

function saveContent(){
  const d = cDraft();
  if(!d.title.trim() || !d.text.trim()) return toast('Заполни название и описание');
  const id = 'n'+Date.now().toString(36);
  if(MEDIA[d.key]){ MEDIA[id] = MEDIA[d.key]; delete MEDIA[d.key]; }
  const item = {id, type:d.type, title:d.title.trim(), text:d.text.trim(), min:d.min || 10,
    video:d.video || '', free:d.free !== false, aud:d.aud || [], level:d.level || 'any', days:d.days || [],
    tags:d.tags.length ? d.tags : suggestTags(d.title + ' ' + d.text),
    expert:S.role === 'expert' ? me().n : 'Редакция Eva'};
  if(S.role === 'admin'){ LIB.push({...item, status:'live'}); toast('Опубликовано в библиотеке'); }
  else { S.pending.push({...item, status:'pending', sent:'только что'}); toast('Отправлено на проверку'); }
  S.cd = null; S.sheet = null; pushShared(); render();
}

/* ---------- черновик курса ---------- */
function kDraft(){
  if(!S.kd) S.kd = {t:'', d:'', p:4900, old:7900, kind:'Базовый',
    e:(S.role === 'expert' ? me().n : EXPERTS[0].n), tags:[]};
  return S.kd;
}
function setKD(f, v){ kDraft()[f] = v; }
function tgNc(btn, t){
  const d = kDraft();
  const on = d.tags.includes(t);
  d.tags = on ? d.tags.filter(x => x !== t) : [...d.tags, t];
  btn.classList.toggle('on', !on);
  const c = document.getElementById('kcount');
  if(c) c.textContent = d.tags.length ? '(' + d.tags.length + ')' : '';
}
function shNewCourse(){
  const d = kDraft();
  return `<h2 class="serif" style="font-size:22px;margin:0 0 6px">Новый курс</h2>
    <p class="small muted" style="margin:0 0 12px">После создания сразу откроется редактор: модули, уроки, видео, описания и домашние задания.</p>
    <label class="lbl">Название</label>
    <input class="field" value="${esc(d.t)}" placeholder="Например: Опора на себя" oninput="setKD('t',this.value)">
    <label class="lbl">Короткое описание</label>
    <textarea class="field" rows="3" placeholder="О чём курс в двух предложениях" oninput="setKD('d',this.value)">${esc(d.d)}</textarea>
    <div class="g2">
      <div><label class="lbl">Цена, ₽</label><input class="field" type="number" value="${d.p}" oninput="setKD('p',+this.value||0)"></div>
      <div><label class="lbl">Старая цена</label><input class="field" type="number" value="${d.old}" oninput="setKD('old',+this.value||0)"></div>
    </div>
    <label class="lbl">Тип</label>
    <div class="seg">${['Базовый','Дополнительный'].map(k =>
      `<button class="${d.kind===k?'on':''}" onclick="chipPick(this,'kd.kind','${attJs(k)}')">${k}</button>`).join('')}</div>
    <label class="lbl">Эксперт</label>
    <div class="scroller">
      <button class="snav left" onclick="scrollChips(this,-1)">‹</button>
      <div class="chips">${EXPERTS.map(e => `<button class="chip ${d.e===e.n?'on':''}"
        onclick="chipPick(this,'kd.e','${attJs(esc(e.n))}')">${esc(e.n)}</button>`).join('')}</div>
      <button class="snav right" onclick="scrollChips(this,1)">›</button>
    </div>
    <label class="lbl">Темы <span id="kcount" class="muted">${d.tags.length?'('+d.tags.length+')':''}</span></label>
    <div class="chips wrap">${ALL_TAGS.slice(0,20).map(t => `<button class="chip ${d.tags.includes(t)?'on':''}"
      onclick="tgNc(this,'${attJs(t)}')">${t}</button>`).join('')}</div>
    <button class="btn" style="margin-top:12px" onclick="createCourse()">Создать и открыть редактор</button>`;
}
function createCourse(){
  const d = kDraft();
  if(!d.t.trim()) return toast('Назови курс');
  const id = 'c'+Date.now().toString(36);
  COURSES.push({id, t:d.t.trim(), d:d.d.trim() || 'Описание появится позже',
    e:d.e, n:0, p:d.p || 4900, old:d.old || 7900, r:5.0, s:0, draft:true});
  COURSE_KIND[id] = d.kind;
  COURSE_TAGS[id] = d.tags;
  COURSE_INFO[id] = {who:['Опиши, кому подойдёт курс'], gives:['Что получит ученица'], promo:d.d.trim()};
  REVIEWS[id] = [];
  S.lessons[id] = [];
  S.modules = S.modules || {};
  S.modules[id] = [{n:1, t:'Модуль 1', units:[]}];
  S.kd = null; S.sheet = null;
  pushShared();
  openCourseEditor(id);
  toast('Курс создан. Добавь модули и уроки');
}

/* ---------- модерация ---------- */
function shRework(){
  const x = S.pending.find(i => i.id === S.sheet.id);
  return `<h2 class="serif" style="font-size:22px;margin:0 0 6px">Отправить на доработку</h2>
    <p class="small muted" style="margin:0 0 12px">«${esc(x.title)}» · ${esc(x.expert)}</p>
    <textarea class="field" id="rc" rows="4" placeholder="Что поправить: длина, звук, формулировки, теги"></textarea>
    <div class="chips wrap">${['Сократить вступление','Плохой звук','Добавить теги','Уточнить противопоказания','Переснять обложку'].map(t =>
      `<button class="chip" onclick="$('#rc').value=($('#rc').value?$('#rc').value+'. ':'')+'${attJs(t)}'">${t}</button>`).join('')}</div>
    <button class="btn" style="margin-top:12px" onclick="rework('${attJs(x.id)}')">Отправить эксперту</button>
    <button class="btn ghost" style="margin-top:8px" onclick="closeSheet()">Отмена</button>`;
}
function shFix(){
  const x = (S.pending || []).find(i => i.id === S.sheet.id);
  if(!x) return gone('Этого материала');
  return `<h2 class="serif" style="font-size:22px;margin:0 0 6px">Доработка</h2>
    <div class="card" style="background:var(--surface-2);border:none">
      <div class="small"><b>Комментарий редакции:</b> ${esc(x.comment||'')}</div></div>
    <label class="lbl">Название</label>
    <input class="field" id="ft" value="${esc(x.title)}">
    <label class="lbl">Описание</label>
    <textarea class="field" id="fx" rows="4">${esc(x.text)}</textarea>
    ${MEDIA[x.id] ? `<img class="upprev" src="${safeUrl(MEDIA[x.id])}" alt="">` : ''}
    <button class="btn ghost" onclick="pickImage('${attJs(x.id)}')">Заменить обложку</button>
    <button class="btn" style="margin-top:9px" onclick="sendFix('${attJs(x.id)}')">Отправить снова на проверку</button>`;
}
function sendFix(id){
  const x = S.pending.find(i => i.id === id);
  x.title = ($('#ft')||{}).value || x.title;
  x.text = ($('#fx')||{}).value || x.text;
  x.status = 'pending'; x.sent = 'только что, после доработки'; x.comment = '';
  S.sheet = null; pushShared(); render(); toast('Отправлено на повторную проверку');
}

/* ---------- видео ---------- */
function shVideo(){
  const id = S.sheet.id;
  S.videos = S.videos || {};
  const cur = (itemById(id)||{}).video || S.videos[id] || '';
  return `<h2 class="serif" style="font-size:22px;margin:0 0 6px">Видео по ссылке</h2>
    <p class="small muted" style="margin:0 0 12px">YouTube, Vimeo, Kinescope или прямая ссылка на mp4. Плеер подставится автоматически.</p>
    <input class="field" id="vurl" placeholder="https://" value="${esc(cur)}">
    <div class="chips wrap">${['YouTube','Vimeo','Kinescope','Своя ссылка'].map(t => `<span class="chip pale">${t}</span>`).join('')}</div>
    <button class="btn" style="margin-top:12px" onclick="saveVideo('${attJs(id)}')">Сохранить</button>
    <button class="btn ghost" style="margin-top:8px" onclick="pickImage('${attJs(id)}')">Загрузить обложку вместо кадра</button>`;
}
function saveVideo(id){
  const v = ($('#vurl')||{}).value || '';
  S.videos = S.videos || {}; S.videos[id] = v;
  const x = itemById(id); if(x) x.video = v;
  if(S.editCourse){ const l = lessonsOf(S.editCourse).find(u => u.id === id); if(l) l.video = v; }
  S.sheet = null; pushShared(); render(); toast(v ? 'Видео добавлено' : 'Ссылка очищена');
}

/* ---------- уроки и домашние задания ---------- */
function shUnits(){
  const c = COURSES.find(x => x.id === S.sheet.id);
  const ls = lessonsOf(c.id);
  return `<h2 class="serif" style="font-size:22px;margin:0 0 6px">Уроки курса</h2>
    <p class="small muted" style="margin:0 0 12px">${esc(c.t)} · ${ls.length} уроков</p>
    ${ls.map((l,i) => `<button class="unit" onclick="openUnitEditor('${attJs(c.id)}','${attJs(l.id)}')">
      <div class="n">${esc(l.n)}</div>
      <div class="mini">${cover(l.id,'practice')}</div>
      <div style="flex:1;min-width:0"><b style="font-size:13px;display:block">${esc(l.t)}</b>
        <div class="small muted">${l.min} мин · ${l.video ? 'видео есть' : 'без видео'}</div></div>
      <span class="muted">›</span>
    </button>`).join('')}
    <button class="btn ghost" style="margin-top:10px" onclick="addUnitTo('${attJs(c.id)}',0)">＋ Добавить урок</button>
    <button class="btn" style="margin-top:9px" onclick="closeSheet()">Готово</button>`;
}
function shHwEdit(){
  const {cid, id} = S.sheet;
  const l = lessonsOf(cid).find(x => x.id === id);
  if(!l) return gone('Этого урока');
  const hw = l.hw || {title:'', text:'', min:15};
  return `<h2 class="serif" style="font-size:22px;margin:0 0 6px">Домашнее задание</h2>
    <p class="small muted" style="margin:0 0 12px">Урок ${esc(l.n)}. ${esc(l.t)}. Открывается отдельным окном после видео.</p>
    <label class="lbl">Название задания</label><input class="field" id="hw_t" value="${esc(hw.title)}">
    <label class="lbl">Текст задания</label><textarea class="field" id="hw_x" rows="5">${esc(hw.text)}</textarea>
    <label class="lbl">Сколько времени займёт, мин</label><input class="field" id="hw_m" type="number" value="${hw.min||15}">
    <button class="btn" onclick="saveHW('${attJs(cid)}','${attJs(id)}')">Сохранить задание</button>
    ${l.hw ? `<button class="btn ghost" style="margin-top:8px" onclick="delHW('${attJs(cid)}','${attJs(id)}')">Убрать задание из урока</button>` : ''}`;
}
function saveHW(cid, id){
  const l = lessonsOf(cid).find(x => x.id === id);
  const t = ($('#hw_t')||{}).value, x = ($('#hw_x')||{}).value;
  if(!x || !x.trim()) return toast('Напиши текст задания');
  l.hw = {title:(t||'Практика после урока').trim(), text:x.trim(), min:+($('#hw_m')||{}).value || 15};
  S.sheet = null; pushShared(); render(); toast('Домашнее задание сохранено');
}
function delHW(cid, id){
  const l = lessonsOf(cid).find(x => x.id === id);
  delete l.hw; S.sheet = null; render(); toast('Задание убрано');
}
function shHW(){
  const {id, cid} = S.sheet;
  const l = lessonsOf(cid).find(x => x.id === id);
  if(!l || !l.hw) return gone('Этого задания');
  const done = S.homework && S.homework[id];
  return `<div class="eyebrow">Домашнее задание · урок ${esc(l.n)}</div>
    <h2 class="serif" style="font-size:22px;margin:8px 0 10px">${esc(l.hw.title || l.t)}</h2>
    <div class="hwbox"><p class="small" style="margin:0;white-space:pre-line;line-height:1.6">${esc(l.hw.text||'')}</p></div>
    ${l.hw.min ? `<div class="small muted" style="margin-bottom:10px">Примерно ${l.hw.min} минут</div>` : ''}
    <label class="lbl">Заметка для себя</label>
    <textarea class="field" id="hw_note" rows="3" placeholder="Что получилось, что было сложно">${esc((done&&done.note)||'')}</textarea>
    <button class="btn ${done?'done':''}" onclick="doneHW('${attJs(id)}','${attJs(cid)}')">${done ? '✓ Выполнено, сохранить заметку' : 'Выполнила'}</button>
    <button class="btn ghost" style="margin-top:8px" onclick="closeSheet()">Закрыть</button>`;
}
function doneHW(id, cid){
  const note = (($('#hw_note')||{}).value || '').trim();
  S.homework = S.homework || {};
  const first = !S.homework[id];
  S.homework[id] = {done:true, note, at:Date.now()};
  if(first) S.points += 30;
  S.sheet = null; render(); schedulePersist();
  toast(first ? 'Задание выполнено. +30 баллов' : 'Заметка сохранена');
}

/* ---------- группы ---------- */
function shGroupInfo(){
  const g = GROUPS.find(x => x.id === S.sheet.id);
  if(!g) return `<div class="empty">Группа не найдена</div>`;
  const joined = S.joined.includes(g.id);
  const may = canEnter(g);
  const club = isClub(g);
  const lead = EXPERTS.find(e => e.n === g.lead);

  return `<div class="gcover" style="--gc:${safeColor(g.c)}">
      <div class="gcircle">${gIcon(g, 30)}</div>
      <h2 class="serif" style="font-size:22px;margin:10px 0 4px">${esc(g.t)}</h2>
      <div class="grow">
        <span>${g.m.toLocaleString('ru-RU')} участниц</span>
        ${club ? `<span>${lockIcon(11)} клуб · ${money(g.price)} в месяц</span>`
          : g.access === 'experts' ? `<span>${lockIcon(11)} только для экспертов</span>`
          : '<span>открытая группа</span>'}
      </div>
    </div>

    <p class="gabout">${esc(g.about || '')}</p>

    ${g.lead ? `<div class="gplate">
      <div class="row" style="gap:10px">
        ${lead ? `<div class="pcirc" style="width:42px;height:42px;flex:none">${expPic(lead)}</div>`
               : chatAva(g.lead, safeColor(g.c), false, 42, demoMail(g.lead))}
        <div style="flex:1;min-width:0">
          <div class="eyebrow" style="margin:0">Ведёт</div>
          <b style="font-size:14px;display:block">${esc(g.lead)}</b>
          ${lead ? `<span class="small muted" style="font-size:11.5px">${esc(lead.r)}</span>` : ''}
        </div>
      </div>
    </div>` : ''}

    ${g.who ? `<div class="gsec"><div class="dh">Кто здесь</div><p>${esc(g.who)}</p></div>` : ''}

    ${(g.rules||[]).length ? `<div class="gsec"><div class="dh">О чём договорились</div>
      <ul class="grules">${g.rules.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>` : ''}

    ${(g.team||[]).length ? `<div class="gsec">
      <div class="dh">Команда сообщества</div>
      <div class="teamrow hscroll">${g.team.map(m => {
        const ex = m.e ? EXPERTS.find(x => x.id === m.e) : null;
        return `<div class="tcard">
          <div class="tpic">${ex ? expPic(ex) : chatAva(m.n, authorColor(m.mail || m.n), false, 30, m.mail || demoMail(m.n))}</div>
          <div style="flex:1;min-width:0">
            <b>${esc(m.n)}</b><span>${esc(m.r)}</span>
          </div>
        </div>`;
      }).join('')}</div>
    </div>` : ''}

    ${(g.tags||[]).length ? `<div class="chips wrap" style="padding:2px 0 10px">${
      g.tags.map(t => `<span class="chip pale" style="padding:3px 9px;font-size:10.5px">${esc(t)}</span>`).join('')}</div>` : ''}

    ${gCan(g,'edit') ? `<button class="btn ghost" style="margin-bottom:9px"
      onclick="closeSheet();openGroupAdmin('${attJs(g.id)}')">Управлять сообществом</button>` : ''}

    ${!may && g.access === 'experts' ? `
      <div class="glocked">${lockIcon(15)}
        <div><b>Закрытая комната</b>
          <div class="small muted">Сюда попадают эксперты платформы. Если ведёшь практики и хочешь
            присоединиться — расскажи о себе, мы ответим.</div></div></div>
      <button class="btn ghost" onclick="closeSheet();openSheet('support')">Написать о себе</button>`
    : !may && club ? `
      <div class="glocked">${lockIcon(15)}
        <div><b>Частный клуб</b>
          <div class="small muted">${money(g.price)} в месяц. Отменить можно в любой момент,
            доступ останется до конца оплаченного месяца.</div></div></div>
      <button class="btn" onclick="joinClub('${attJs(g.id)}')">Вступить за ${money(g.price)} в месяц</button>
      <button class="btn ghost" style="margin-top:9px" onclick="closeSheet()">Пока подумаю</button>`
    : `
      <button class="btn ghost" onclick="pushOff()">Выключить уведомления</button>
      <button class="btn ${joined?'ghost':''}" style="margin-top:9px" onclick="join('${attJs(g.id)}')">
        ${joined ? 'Выйти из сообщества' : g.access === 'request' ? 'Оставить заявку' : 'Вступить'}</button>
      ${club && (S.clubs||[]).includes(g.id) ? `<button class="btn ghost" style="margin-top:9px;color:var(--accent)"
        onclick="leaveClub('${attJs(g.id)}')">Отменить подписку на клуб</button>` : ''}`}`;
}

/* подписка на частный клуб: в демонстрации оплата не списывается */
function joinClub(id){
  const g = GROUPS.find(x => x.id === id);
  if(!g) return;
  S.clubs = [...new Set([...(S.clubs||[]), id])];
  if(!S.joined.includes(id)) S.joined = [...S.joined, id];
  S.sheet = null;
  render(); schedulePersist();
  toast('Ты в клубе «' + g.t + '». Первый созвон — в ближайший вторник');
  openChat(id);
}
function leaveClub(id){
  if(!confirm('Отменить подписку на клуб? Доступ пропадёт сразу.')) return;
  S.clubs = (S.clubs||[]).filter(x => x !== id);
  S.joined = S.joined.filter(x => x !== id);
  if(S.chat) S.chat.open = null;
  S.sheet = null;
  render(); schedulePersist();
  toast('Подписка отменена');
}

/* ---------- мероприятия ---------- */
function shEvent(){
  const e = EVENTS.find(x => x.id === S.sheet.id);
  if(!e) return `<div class="empty">Мероприятие не найдено</div>`;
  const going = S.myEvents.includes(e.id);
  const shots = [e.id, ...(e.gallery||[])].filter(k => MEDIA[k]);
  const si = Math.min(S.evSlide || 0, Math.max(0, shots.length-1));
  const isAdm = S.role === 'admin';
  return `${shots.length ? `<div class="gslider" style="margin-bottom:14px" id="evgal">
      <div class="gslide" style="height:190px"><img id="evshot" src="${safeUrl(MEDIA[shots[si]])}" alt=""></div>
      ${shots.length > 1 ? `<button class="gnav left" onclick="slideEv(-1)">‹</button>
        <button class="gnav right" onclick="slideEv(1)">›</button>
        <div class="gdots" id="evdots">${shots.map((_,k) => `<i class="${k===si?'on':''}"></i>`).join('')}</div>` : ''}
    </div>`
    : `<div style="border-radius:var(--r-lg);overflow:hidden;height:170px;margin-bottom:14px">${cover(e.id,'practice')}</div>`}
    <div class="eyebrow">${esc(e.kind)}</div>
    <h2 class="serif" style="font-size:22px;margin:8px 0 10px">${esc(e.t)}</h2>
    <div class="card" style="padding:12px">
      <div class="uline" style="border:none;padding-top:0"><span class="small muted" style="width:80px">Когда</span>
        <b style="font-size:13px">${new Date(e.d).toLocaleDateString('ru-RU',{day:'numeric',month:'long'})}, ${esc(e.tm)}</b></div>
      <div class="uline"><span class="small muted" style="width:80px">Формат</span>
        <b style="font-size:13px">${esc(e.mode === 'онлайн' ? 'Онлайн, ' + e.city : 'Очно, ' + e.city + (e.place ? ', ' + e.place : ''))}</b></div>
      <div class="uline"><span class="small muted" style="width:80px">Ведёт</span><b style="font-size:13px">${esc(e.by)}</b></div>
      <div class="uline"><span class="small muted" style="width:80px">Места</span>
        <b style="font-size:13px;color:${e.unlimited || e.left ? 'var(--ink)' : 'var(--accent)'}">
          ${e.unlimited ? 'без ограничения' : e.left ? 'свободно ' + e.left + ' из ' + e.seats : 'мест не осталось'}</b></div>
    </div>
    <p class="small" style="margin:0 0 10px;line-height:1.55">${esc(e.about)}</p>
    ${evDetails(e)}
    <div class="spread" style="margin-bottom:12px">
      <span class="price" style="font-size:19px">${e.price ? money(e.price) : 'бесплатно'}</span>
      ${e.price ? '<span class="small muted">оплата на месте или картой</span>' : ''}</div>
    ${isAdm && e.status === 'pending' ? `
      <div class="card" style="border-color:var(--accent)">
        <b style="font-size:14.5px">Мероприятие на согласовании</b>
        <div class="small muted" style="margin:4px 0 10px">Предложил ${esc(e.by)}</div>
        <button class="btn" onclick="pubEvent('${attJs(e.id)}');closeSheet()">Опубликовать</button>
        <div class="acts">
          <button class="btn ghost" onclick="openSheet({k:'evReview',id:'${attJs(e.id)}',mode:'rework'})">На доработку</button>
          <button class="btn ghost" onclick="openSheet({k:'evReview',id:'${attJs(e.id)}',mode:'reject'})">Отказать</button>
        </div>
      </div>`
    : `<button class="btn ${going?'done':'acc'}" ${!going && !e.unlimited && !e.left ? 'disabled' : ''}
        onclick="goEvent('${attJs(e.id)}');closeSheet()">
        ${going ? '✓ Ты идёшь, отменить запись'
          : (!e.unlimited && !e.left) ? 'Мест не осталось'
          : e.price ? 'Купить билет за ' + money(e.price) : 'Пойду'}</button>`}`;
}
/* Подробности мероприятия: коротко видно сразу, детали — по неприметной
   строчке. Раскрываем без перерисовки экрана, иначе страница дёргается. */
function evDetails(e){
  const prog = Array.isArray(e.program) ? e.program.filter(Boolean) : [];
  const has = e.full || prog.length || e.who || e.bring;
  if(!has) return '';
  const open = S.evMore === e.id;
  return `<button class="evmore${open?' on':''}" onclick="toggleEvDet('${attJs(e.id)}', this)">
      <span>Подробности</span><i>⌄</i></button>
    <div class="evdet${open?' on':''}" id="evdet_${esc(e.id)}" style="max-height:${open?'none':'0'}">
      <div class="evdet-in">
        ${e.full ? richText(e.full) : ''}
        ${prog.length ? `<div class="dh">Расписание</div>
          <ul class="evprog">${prog.map(x => {
            const m = /^\s*(\d{1,2}[:.]\d{2}|[А-Яа-яЁё]{2}\s+\d{1,2}[:.]\d{2})\s*[—–-]\s*(.+)$/.exec(x);
            return m ? `<li><b>${esc(m[1])}</b> ${esc(m[2])}</li>` : `<li>${esc(x)}</li>`;
          }).join('')}</ul>` : ''}
        ${e.who ? `<div class="dh">Для кого</div><p>${esc(e.who)}</p>` : ''}
        ${e.bring ? `<div class="dh">${e.mode === 'онлайн' ? 'Как подключиться' : 'Что взять с собой'}</div>
          <p>${esc(e.bring)}</p>` : ''}
      </div>
    </div>`;
}

/* плавное раскрытие: считаем высоту содержимого и анимируем её,
   а не перерисовываем весь экран */
function toggleEvDet(id, btn){
  const box = document.getElementById('evdet_' + id);
  if(!box){ S.evMore = S.evMore === id ? null : id; return render(); }
  const inner = box.firstElementChild;
  const open = box.classList.contains('on');
  if(open){
    /* сначала фиксируем текущую высоту, заставляем браузер её посчитать
       и только потом сжимаем — иначе перехода не будет */
    box.style.maxHeight = inner.offsetHeight + 'px';
    void box.offsetHeight;
    box.classList.remove('on');
    box.style.maxHeight = '0px';
    S.evMore = null;
  } else {
    box.classList.add('on');
    box.style.maxHeight = inner.offsetHeight + 'px';
    S.evMore = id;
    setTimeout(() => { if(box.classList.contains('on')) box.style.maxHeight = 'none'; }, 280);
  }
  if(btn) btn.classList.toggle('on', !open);
}

/* Листаем фото мероприятия, меняя одну картинку.
   Раньше здесь был render(): страница пересобиралась целиком, прокрутка
   улетала наверх — со стороны это выглядело как перезагрузка. */
function slideEv(d){
  const e = EVENTS.find(x => x.id === (S.sheet||{}).id);
  if(!e) return;
  const shots = [e.id, ...(e.gallery || [])].filter(k => MEDIA[k]);
  const n = shots.length;
  if(n < 2) return;
  S.evSlide = ((S.evSlide || 0) + d + n) % n;
  const img = document.getElementById('evshot');
  if(!img) return render();                       // шторки нет — обычный путь
  img.src = safeUrl(MEDIA[shots[S.evSlide]]);
  const dots = document.getElementById('evdots');
  if(dots) [...dots.children].forEach((i, k) => i.className = k === S.evSlide ? 'on' : '');
}

/* решение админа по мероприятию с комментарием эксперту */
function shEvReview(){
  const e = EVENTS.find(x => x.id === S.sheet.id);
  const rework = S.sheet.mode === 'rework';
  const hints = rework
    ? ['Уточнить адрес','Добавить описание','Заменить обложку','Пересмотреть цену','Указать больше мест']
    : ['Не подходит формату платформы','Дублирует другое мероприятие','Нет подтверждения площадки','Слишком короткий срок'];
  return `<h2 class="serif" style="font-size:22px;margin:0 0 6px">${rework ? 'Отправить на доработку' : 'Отказать'}</h2>
    <p class="small muted" style="margin:0 0 12px">«${esc(e.t)}» · ${esc(e.by)}. Комментарий придёт эксперту в личные сообщения.</p>
    <textarea class="field" id="evc" rows="4" placeholder="${rework ? 'Что поправить' : 'Причина отказа'}"></textarea>
    <div class="chips wrap">${hints.map(t =>
      `<button class="chip" onclick="$('#evc').value=($('#evc').value?$('#evc').value+'. ':'')+'${attJs(t)}'">${t}</button>`).join('')}</div>
    <button class="btn" style="margin-top:12px" onclick="reviewEvent('${attJs(e.id)}','${attJs(S.sheet.mode)}')">
      ${rework ? 'Отправить эксперту' : 'Отказать'}</button>
    <button class="btn ghost" style="margin-top:8px" onclick="closeSheet()">Отмена</button>`;
}
/* Типовые поля мероприятия. Один и тот же блок в добавлении и в правке,
   чтобы в админке форма была одна и та же и ничего не терялось. */
const evLines = t => String(t == null ? '' : t).split('\n').map(x => x.trim()).filter(Boolean);

function evTextFields(v, mk){
  return `
    <label class="lbl">Короткое описание</label>
    <p class="tiny muted" style="margin:-4px 0 6px">Одна-две фразы. Их видно в списке и в календаре «Я иду».</p>
    <textarea class="field" id="ev_a" rows="2" oninput="${mk('about', 'this.value')}">${esc(v.about || '')}</textarea>

    <label class="lbl">Подробное описание</label>
    <p class="tiny muted" style="margin:-4px 0 6px">Пишется как пост в телеграме. Пустая строка — новый абзац,
      «## Заголовок» — подзаголовок, «- » в начале строки — пункт списка, *звёздочки* делают текст жирным.</p>
    <textarea class="field" id="ev_f" rows="8" placeholder="Что это за встреча и почему на неё стоит прийти.

## Что будет
- разговор в кругу, без советов
- телесная практика
- письмо себе

Приходи, *даже если* идёшь на такое впервые."
      oninput="${mk('full', 'this.value')}">${esc(v.full || '')}</textarea>

    <label class="lbl">Расписание</label>
    <p class="tiny muted" style="margin:-4px 0 6px">Каждый пункт с новой строки: «19:00 — чай и знакомство».</p>
    <textarea class="field" id="ev_pr" rows="5"
      oninput="${mk('program', 'evLines(this.value)')}">${esc((v.program || []).join('\n'))}</textarea>

    <label class="lbl">Для кого</label>
    <input class="field" id="ev_w" placeholder="Любой уровень, опыт не нужен"
      value="${esc(v.who || '')}" oninput="${mk('who', 'this.value')}">

    <label class="lbl">Что взять с собой или как подключиться</label>
    <input class="field" id="ev_b" placeholder="Коврик и тёплые носки"
      value="${esc(v.bring || '')}" oninput="${mk('bring', 'this.value')}">`;
}

function evDraft(){
  if(!S.evd) S.evd = {key:'evnew_' + Date.now().toString(36), gallery:[], unlimited:false, kind:'Женский круг', mode:'офлайн'};
  return S.evd;
}
function setEvD(f, v){ evDraft()[f] = v; }

/* снимаем всё, что сейчас в полях, в черновик — вызывается перед перерисовкой */
function keepEventFields(){
  const d = evDraft();
  [['ev_t','t'], ['ev_d','d'], ['ev_tm','tm'], ['ev_c','city'], ['ev_pl','place'],
   ['ev_a','about'], ['ev_f','full'], ['ev_w','who'], ['ev_b','bring']].forEach(([id, f]) => {
    const e = $('#' + id); if(e && e.value !== undefined && e.value !== '') d[f] = e.value;
  });
  const pr = $('#ev_pr'); if(pr && pr.value !== '') d.program = evLines(pr.value);
  [['ev_p','price'], ['ev_s','seats']].forEach(([id, f]) => {
    const e = $('#' + id); if(e && e.value !== '') d[f] = +e.value || 0;
  });
}
function shNewEvent(){
  const isAdmin = S.role === 'admin';
  const d = evDraft(), key = d.key;
  return `<h2 class="serif" style="font-size:22px;margin:0 0 6px">${isAdmin ? 'Новое мероприятие' : 'Предложить мероприятие'}</h2>
    <p class="small muted" style="margin:0 0 12px">${isAdmin ? 'Появится в разделе сразу.' : 'Уйдёт администратору на согласование.'}</p>

    <label class="lbl">Фотографии</label>
    <div class="photos">
      ${(() => {
        const shots = [key, ...d.gallery].filter(k => MEDIA[k]);
        if(!shots.length) return `<button class="addphoto big" onclick="pickImage('${attJs(key)}')">
          <span class="pl2">＋</span><b>Загрузить обложку</b>
          <span class="small muted">Первое фото станет обложкой мероприятия</span></button>`;
        return shots.map(k => `<div class="photo ${k===key?'cover':''}">
            <img src="${safeUrl(MEDIA[k])}" alt="">
            ${k===key ? '<span class="covlabel">обложка</span>'
              : `<button class="mkcov" onclick="setEvCover('${attJs(k)}')">Сделать обложкой</button>`}
            <button class="phdel" onclick="delEvPhoto('${attJs(k)}')">✕</button>
          </div>`).join('') +
          `<button class="addphoto" onclick="addEvPhoto()"><span class="pl2">＋</span><span class="small">ещё фото</span></button>`;
      })()}
    </div>

    <label class="lbl">Название</label>
    <input class="field" id="ev_t" placeholder="Женский круг «...»"
      value="${esc(d.t || '')}" oninput="setEvD('t', this.value)">
    <label class="lbl">Тип</label>
    <div class="chips wrap">${EVENT_KINDS.map(k =>
      `<button class="chip ${d.kind===k?'on':''}" onclick="pickChip(this,'evd.kind','${attJs(k)}')">${esc(k)}</button>`).join('')}</div>
    <div class="g2">
      <div><label class="lbl">Дата</label>
        <input class="field" id="ev_d" type="date" value="${esc(d.d || '')}" oninput="setEvD('d', this.value)"></div>
      <div><label class="lbl">Время</label>
        <input class="field" id="ev_tm" type="time" value="${esc(d.tm || '19:00')}" oninput="setEvD('tm', this.value)"></div>
    </div>
    <div class="card" style="padding:13px 15px;margin:0 0 12px">
      <div class="spread">
        <div style="flex:1;min-width:0"><b style="font-size:13px">Закрытая встреча</b>
          <div class="small muted">Не попадёт на страницы участниц. Для тем,
            о которых не говорят вслух</div></div>
        <button class="sw ${d.closed?'on':''}" onclick="setEvD('closed', ${d.closed?'false':'true'});render()"><i></i></button>
      </div>
    </div>
    <label class="lbl">Формат</label>
    <div class="seg">${['офлайн','онлайн'].map(k =>
      `<button class="${d.mode===k?'on':''}" onclick="pickMode(this,'${attJs(k)}')">${k}</button>`).join('')}</div>
    <label class="lbl" id="ev_clbl">${d.mode==='онлайн' ? 'Платформа' : 'Город'}</label>
    <input class="field" id="ev_c" placeholder="${d.mode==='онлайн' ? 'Zoom' : 'Москва'}"
      value="${esc(d.city || '')}" oninput="setEvD('city', this.value)">
    <div id="ev_place" ${d.mode==='офлайн' ? '' : 'hidden'}>
      <label class="lbl">Адрес или место</label>
      <input class="field" id="ev_pl" placeholder="Чистые пруды, студия «Тихая»"
        value="${esc(d.place || '')}" oninput="setEvD('place', this.value)">
    </div>
    <div class="g2">
      <div><label class="lbl">Цена, ₽</label>
        <input class="field" id="ev_p" type="number" value="${d.price || 0}" oninput="setEvD('price', +this.value || 0)"></div>
      <div><label class="lbl">Мест</label>
        <input class="field" id="ev_s" type="number" value="${d.seats || 20}"
          oninput="setEvD('seats', +this.value || 0)" ${d.unlimited?'disabled':''}></div>
    </div>
    <button class="row" style="margin:-2px 0 10px;font-size:13px;font-weight:600" onclick="tgUnlimited(this)">
      <span class="sw ${d.unlimited?'on':''}" style="width:38px;height:22px"><i style="width:16px;height:16px;${d.unlimited?'left:19px':''}"></i></span>
      Места не ограничены</button>
    <p class="tiny muted" id="ev_unl" style="margin:-6px 0 10px" ${d.unlimited?'':'hidden'}>Число мест не понадобится.</p>
    ${evTextFields(d, (f, ex) => `setEvD('${f}', ${ex})`)}
    <button class="btn" style="margin-top:14px" onclick="saveEvent()">${isAdmin ? 'Опубликовать' : 'Отправить на согласование'}</button>`;
}
/* Переключатели в форме меняют только то, что должны: экран не
   перерисовывается, набранное остаётся на месте, страница не дёргается. */
function tgUnlimited(btn){
  const d = evDraft();
  d.unlimited = !d.unlimited;
  const sw = btn && btn.querySelector('.sw');
  if(sw){
    sw.classList.toggle('on', d.unlimited);
    const dot = sw.querySelector('i');
    if(dot) dot.style.left = d.unlimited ? '19px' : '';
  }
  const seats = $('#ev_s'); if(seats) seats.disabled = d.unlimited;
  const note = $('#ev_unl'); if(note) note.hidden = !d.unlimited;
  schedulePersist();
}

/* выбор одной фишки из ряда: подсветка переставляется на месте */
function markChip(btn){
  const wrap = btn && btn.parentElement;
  if(wrap) [...wrap.children].forEach(b => b.classList.toggle('on', b === btn));
}
function pickChip(btn, path, value){
  keepEventFields();
  pathSet(S, path, value);
  markChip(btn);
  schedulePersist();
}
/* формат встречи: подпись поля и адрес переключаются без перерисовки */
function pickMode(btn, mode){
  keepEventFields();
  evDraft().mode = mode;
  markChip(btn);
  const lbl = $('#ev_clbl'), city = $('#ev_c'), place = $('#ev_place');
  if(lbl)   lbl.textContent = mode === 'онлайн' ? 'Платформа' : 'Город';
  if(city)  city.placeholder = mode === 'онлайн' ? 'Zoom' : 'Москва';
  if(place) place.hidden = mode !== 'офлайн';
  schedulePersist();
}
function addEvPhoto(){
  keepEventFields();
  const d = evDraft(), gk = d.key + '_g' + Date.now().toString(36);
  pickImage(gk, () => { d.gallery.push(gk); render(); });
}
function setEvCover(gk){
  keepEventFields();
  const d = evDraft(), key = d.key;
  const old = MEDIA[key];
  MEDIA[key] = MEDIA[gk];
  const i = d.gallery.indexOf(gk);
  if(i > -1){ if(old) MEDIA[gk] = old; else d.gallery.splice(i,1); }
  render(); toast('Фото стало обложкой');
}
function delEvPhoto(k){
  keepEventFields();
  const d = evDraft();
  if(k === d.key){
    if(d.gallery.length){ const n = d.gallery.shift(); MEDIA[d.key] = MEDIA[n]; delete MEDIA[n]; }
    else delete MEDIA[d.key];
  } else {
    delete MEDIA[k];
    d.gallery = d.gallery.filter(x => x !== k);
  }
  render();
}

function saveEvent(){
  const dr = evDraft();
  keepEventFields();                                  // добираем то, что успели набрать
  const t = dr.t || '', dt = dr.d || '';
  if(!t.trim() || !dt) return toast('Заполни название и дату');
  const seats = dr.unlimited ? 0 : (+dr.seats || 20);
  const id = 'ev'+Date.now().toString(36);
  if(MEDIA[dr.key]){ MEDIA[id] = MEDIA[dr.key]; delete MEDIA[dr.key]; }
  const gallery = [];
  (dr.gallery||[]).forEach((gk, i) => {
    const nk = id + '_g' + i;
    if(MEDIA[gk]){ MEDIA[nk] = MEDIA[gk]; delete MEDIA[gk]; gallery.push(nk); }
  });
  EVENTS.unshift({id, t:t.trim(), kind:dr.kind || 'Женский круг', d:dt,
    tm:dr.tm || '19:00', mode:dr.mode || 'офлайн',
    city:dr.city || (dr.mode === 'онлайн' ? 'Zoom' : 'Москва'),
    place:dr.place || '',
    price:+dr.price || 0,
    by:S.role === 'expert' ? me().n : 'Eva Space',
    seats, left:seats, unlimited:!!dr.unlimited, closed:!!dr.closed, gallery,
    status:S.role === 'admin' ? 'live' : 'pending',
    about:dr.about || '', full:dr.full || '', program:dr.program || [],
    who:dr.who || '', bring:dr.bring || ''});
  S.evd = null; S.sheet = null; syncPush(); render();
  toast(S.role === 'admin' ? 'Мероприятие опубликовано' : 'Отправлено на согласование');
}

function shEventEdit(){
  const x = EVENTS.find(v => v.id === S.sheet.id);
  return `<h2 class="serif" style="font-size:22px;margin:0 0 6px">Мероприятие</h2>
    <p class="small muted" style="margin:0 0 12px">После изменений уйдёт на повторное согласование.</p>
    <label class="lbl">Название</label><input class="field" value="${esc(x.t)}" oninput="setEv('${attJs(x.id)}','t',this.value)">
    <label class="lbl">Тип</label>
    <div class="chips wrap">${EVENT_KINDS.map(k =>
      `<button class="chip ${x.kind===k?'on':''}"
        onclick="setEv('${attJs(x.id)}','kind','${attJs(k)}');markChip(this)">${esc(k)}</button>`).join('')}</div>
    <div class="g2">
      <div><label class="lbl">Дата</label><input class="field" type="date" value="${esc(x.d)}" oninput="setEv('${attJs(x.id)}','d',this.value)"></div>
      <div><label class="lbl">Время</label><input class="field" type="time" value="${esc(x.tm)}" oninput="setEv('${attJs(x.id)}','tm',this.value)"></div>
    </div>
    <label class="lbl">Город или платформа</label>
    <input class="field" value="${esc(x.city)}" oninput="setEv('${attJs(x.id)}','city',this.value)">
    <div class="g2">
      <div><label class="lbl">Цена, ₽</label><input class="field" type="number" value="${x.price}" oninput="setEv('${attJs(x.id)}','price',+this.value||0)"></div>
      <div><label class="lbl">Мест</label><input class="field" type="number" value="${x.seats}" oninput="setEv('${attJs(x.id)}','seats',+this.value||10)"></div>
    </div>
    ${evTextFields(x, (f, ex) => `setEv('${attJs(x.id)}','${f}', ${ex})`)}
    <button class="btn ghost" style="margin-top:14px" onclick="pickImage('${attJs(x.id)}')">Заменить обложку</button>
    <button class="btn" style="margin-top:9px" onclick="resendEvent('${attJs(x.id)}')">
      ${S.role === 'admin' ? 'Сохранить' : 'Отправить на согласование'}</button>`;
}
function setEv(id, f, v){ const x = EVENTS.find(e => e.id === id); x[f] = v; if(f === 'seats') x.left = v; }
function resendEvent(id){
  const x = EVENTS.find(e => e.id === id);
  if(S.role !== 'admin'){ x.status = 'pending'; x.comment = ''; }
  S.sheet = null; render();
  toast(S.role === 'admin' ? 'Сохранено' : 'Отправлено на согласование');
}

/* ---------- админ: пользователи ---------- */
/* адресат — аккаунт из списка или просто почта (покупательница из заказа) */
function dmTarget(id){
  const u = allUsers().find(x => x.id === id);
  if(u) return u;
  const m = String(id || '').trim().toLowerCase();
  return m.includes('@') ? {id:m, n:m, m, real:true} : null;
}
function shWrite2(){
  const u = dmTarget(S.sheet.id);
  if(!u) return `<div class="empty">Некому писать</div>`;
  return `<h2 class="serif" style="font-size:22px;margin:0 0 6px">Написать пользователю</h2>
    <p class="small muted" style="margin:0 0 12px">${esc(u.n)} · ${u.m}</p>
    <label class="lbl">Тема</label><input class="field" id="w_s" value="Eva Space">
    <label class="lbl">Сообщение</label><textarea class="field" id="w_t" rows="5"></textarea>
    <div class="chips wrap">${['Напомнить про пробный период','Предложить скидку 20%','Спросить, что не подошло','Пригласить на мероприятие'].map(t =>
      `<button class="chip" onclick="$('#w_t').value=($('#w_t').value?$('#w_t').value+' ':'')+'${attJs(t)}'">${t}</button>`).join('')}</div>
    <button class="btn" style="margin-top:12px" onclick="sendUserMessage('${attJs(u.id)}')">Отправить</button>
    <p class="tiny muted" style="margin-top:10px">Придёт в её личные сообщения в приложении.
      Уведомление на почту добавится, когда подключим рассылку.</p>`;
}

/* сообщение уходит на сервер и появляется у женщины в личных сообщениях */
async function sendUserMessage(id){
  const u = dmTarget(id);
  if(!u) return;
  const text = (($('#w_t')||{}).value || '').trim();
  const subject = (($('#w_s')||{}).value || '').trim();
  if(!text) return toast('Напиши сообщение');
  if(!u.real) return toast('Это демонстрационная запись — писать некому');
  if(SYNC.alive === false) return toast('Отправка работает только при подключённом сервере');
  const r = await apiCall('dm_send', { email:u.m, subject, text,
                                       from:S.adminName || 'Eva Space' }, { silent:true });
  if(!r) return toast(SYNC.lastError || 'Не отправилось');
  S.sheet = null; render();
  toast('Сообщение отправлено в личные сообщения');
}

/* правка карточки: имя и отметка о подтверждённой почте */
function shEditUser(){
  const u = allUsers().find(x => x.id === S.sheet.id);
  if(!u) return `<div class="empty">Аккаунт не найден</div>`;
  return `<h2 class="serif" style="font-size:22px;margin:0 0 6px">Карточка пользователя</h2>
    <p class="small muted" style="margin:0 0 12px">${esc(u.m)}</p>
    <label class="lbl">Имя</label>
    <input class="field" id="eu_n" value="${esc(u.n)}">
    <label class="row" style="margin:10px 0 4px;font-size:13.5px;gap:8px">
      <input type="checkbox" id="eu_v" ${u.verified ? 'checked' : ''}> Почта подтверждена</label>
    <p class="tiny muted" style="margin:6px 0 14px">Почту здесь не меняем: почта — это ключ аккаунта.</p>
    <button class="btn" onclick="saveUserCard('${attJs(u.id)}')">Сохранить</button>
    ${u.real ? `<div class="eyebrow" style="margin:18px 0 6px">Забыла пароль</div>
    <p class="tiny muted" style="margin:0 0 8px">Пока почта не подключена, письмо с восстановлением не уходит.
      Выдай временный пароль и скажи его ей — она войдёт и поменяет на свой в настройках.
      Остальные её входы закроются.</p>
    <input class="field" id="eu_p" placeholder="Временный пароль, минимум 6 символов" autocomplete="off">
    <button class="btn ghost" onclick="resetUserPass('${attJs(u.id)}')">Выдать временный пароль</button>` : ''}
    ${u.real ? `<button class="btn ghost" style="margin-top:9px;color:var(--accent)"
      onclick="closeSheet();removeUser('${attJs(u.id)}')">Удалить аккаунт</button>` : ''}`;
}
function shAddUser(){
  return `<h2 class="serif" style="font-size:22px;margin:0 0 6px">Добавить вручную</h2>
    <p class="small muted" style="margin:0 0 12px">Аккаунт создастся сразу подтверждённым.</p>
    <label class="lbl">Роль</label>
    <div class="seg">${[['user','Ученица'],['expert','Эксперт'],['admin','Администратор']].map(([k,l]) =>
      `<button class="${(S.newRole||'user')===k?'on':''}" onclick="chipPick(this,'newRole','${attJs(k)}')">${l}</button>`).join('')}</div>
    <label class="lbl">Имя</label><input class="field" id="nu_n" placeholder="Имя и фамилия">
    <label class="lbl">Почта</label><input class="field" id="nu_m" type="email" placeholder="mail@example.ru">
    <label class="lbl">Телеграм</label><input class="field" id="nu_t" placeholder="@nickname">
    <label class="lbl">Пароль по умолчанию</label><input class="field" id="nu_p" value="eva2026">
    <label class="lbl">Доступ</label>
    <div class="seg">${[['trial','Пробный, 3 дня'],['gift','Подарить бесплатно'],['paid','Отметить оплаченным']].map(([k,l]) =>
      `<button class="${(S.newAccess||'trial')===k?'on':''}" onclick="chipPick(this,'newAccess','${attJs(k)}')">${l}</button>`).join('')}</div>
    <button class="btn" onclick="createUser()">Создать аккаунт</button>`;
}
/* Аккаунт заводит сервер. Раньше запись оставалась в браузере
   администратора, а тост обещал письмо, которого никто не отправлял. */
async function createUser(){
  const n = ($('#nu_n')||{}).value, m = (($('#nu_m')||{}).value||'').trim().toLowerCase();
  const pass = ($('#nu_p')||{}).value || 'eva2026';
  if(!n || !n.trim()) return toast('Укажи имя');
  if(!/^[^@\s]+@[^@\s]+\.[a-zа-я]{2,}$/i.test(m)) return toast('Проверь почту');
  if(pass.length < 6) return toast('Пароль минимум 6 символов');
  if(DB.find(m)) return toast('Такая почта уже есть');
  const access = S.newAccess || 'trial';
  const role = S.newRole || 'user';
  if(role === 'admin') return toast('Администратор назначается в data/config.php на хостинге');
  if(SYNC.alive === false) return toast('Аккаунт создаётся только при подключённом сервере');
  const r = await apiCall('user_create', { email:m, name:n.trim(), pass, role, access,
                                           tg:($('#nu_t')||{}).value || '' }, { silent:true });
  if(!r) return toast(SYNC.lastError || 'Не получилось создать аккаунт');
  mirrorUser(r.user);

  /* эксперт сразу получает карточку и появляется в переключателе кабинета */
  if(role === 'expert') createExpertProfile(n.trim(), m, ($('#nu_t')||{}).value || '');

  S.sheet = null; syncPush(); render();
  toast(role === 'expert'
    ? 'Эксперт добавлен. Скажи ей пароль: ' + pass
    : 'Аккаунт создан. Письма нет — скажи ей почту и пароль: ' + pass);
}
/* Доступ живёт в аккаунте на сервере. Раньше «подарить» писало отметку
   в браузер администратора — женщина об этом не узнавала никогда. */
function shGrant(){
  const u = allUsers().find(x => x.id === S.sheet.id);
  if(!u) return `<div class="empty">Аккаунт не найден</div>`;
  const rec = DB.find(u.m) || {};
  const offers = [
    {k:'gift30', t:'Доступ на 30 дней', d:'Полная программа без оплаты, потом обычные условия'},
    {k:'gift', t:'Бессрочный доступ', d:'Для амбассадоров, партнёров и тестировщиц'},
    {k:'trial7', t:'Продлить пробный период до 7 дней', d:'Если не успела попробовать'}
  ];
  const has = rec.gift ? 'бессрочный' : rec.access_until && rec.access_until * 1000 > Date.now()
    ? 'до ' + new Date(rec.access_until * 1000).toLocaleDateString('ru-RU',{day:'numeric',month:'long'}) : '';
  const mine = rec.courses || [];
  return `<h2 class="serif" style="font-size:22px;margin:0 0 6px">Доступ</h2>
    <p class="small muted" style="margin:0 0 12px">${esc(u.n)} · ${u.m}${has ? ' · доступ ' + has : ''}</p>
    ${offers.map(o => `<button class="card" style="width:100%;text-align:left" onclick="grant('${attJs(u.id)}','${attJs(o.k)}')">
      <b style="font-size:14px">${esc(o.t)}</b>
      <div class="small muted" style="margin-top:3px">${esc(o.d)}</div></button>`).join('')}
    <div class="eyebrow" style="margin:14px 0 8px">Курсы</div>
    <div class="chips wrap">${COURSES.filter(c => !c.draft).map(c =>
      `<button class="chip ${mine.includes(c.id) ? 'on' : ''}" onclick="grant('${attJs(u.id)}','${mine.includes(c.id) ? 'uncourse' : 'course'}','${attJs(c.id)}')">${esc(c.t)}</button>`).join('')}</div>
    <p class="tiny muted" style="margin:8px 0 12px">Открытый курс появится у неё при следующем входе в приложение.</p>
    ${has || mine.length ? `<button class="btn ghost" onclick="grant('${attJs(u.id)}','revoke')">Снять весь доступ</button>` : ''}`;
}
async function grant(id, kind, course){
  const u = allUsers().find(x => x.id === id);
  if(!u) return;
  const label = {gift30:'Доступ открыт на 30 дней', gift:'Бессрочный доступ открыт',
    trial7:'Пробный продлён до 7 дней', course:'Курс открыт', uncourse:'Курс закрыт', revoke:'Доступ снят'}[kind];
  if(!u.real){ S.sheet = null; render(); return toast('Это демонстрационная запись, доступ ей не нужен'); }
  if(SYNC.alive === false) return toast('Доступ открывается только при подключённом сервере');
  const r = await apiCall('access', { email:u.m, kind, course:course || '' }, { silent:true });
  if(!r) return toast(SYNC.lastError || 'Не получилось');
  mirrorUser(r.user);
  if(S.user && S.user.email === u.m) applyGrants();
  /* Женщина просила доступ и ждёт ответа. Раньше он просто появлялся —
     она заходила и обнаруживала, что программа открыта, без единого слова.
     Теперь приходит письмо от того, кто за это отвечает. */
  const c = course && typeof COURSES !== 'undefined' ? COURSES.find(x => x.id === course) : null;
  const letter = {
    gift:   ['space',   'Доступ открыт',
             'Доступ к программе и библиотеке открыт — без ограничения по сроку. Заходи и продолжай с того места, где остановилась.'],
    gift30: ['space',   'Доступ открыт на 30 дней',
             'Доступ к программе и библиотеке открыт на тридцать дней. Ближе к концу напомним, ничего не пропадёт.'],
    trial7: ['space',   'Пробный период продлён',
             'Продлили пробный период до семи дней — успеешь посмотреть спокойно.'],
    course: ['experts', 'Курс открыт',
             'Курс «' + (c ? c.t : 'твой курс') + '» открыт. Он уже в разделе «Курсы», можно начинать с первого урока.'],
    uncourse: null, revoke: null
  }[kind];
  if(letter) await apiCall('dm_send', { email:u.m, from:(CHANNELS[letter[0]]||{}).from || 'Eva Space',
    chan:letter[0], subject:letter[1], text:letter[2] }, { silent:true });
  render(); toast(label + (letter ? '. Написали ей' : ''));
}

/* ---------- эксперт: услуги, теги, образование ---------- */
function shExpTags(){
  const e = EXPERTS.find(x => x.id === S.sheet.id);
  if(!e) return gone('Этой карточки');
  const rest = ALL_TAGS.filter(t => !(e.t || []).includes(t));
  return `<h2 class="serif" style="font-size:22px;margin:0 0 6px">Добавить тему</h2>
    <p class="small muted" style="margin:0 0 12px">По этим темам твои материалы попадают в программы учениц.</p>
    <div class="chips wrap">${rest.map(t => `<button class="chip" onclick="addExpTag('${attJs(e.id)}','${attJs(t)}')">${t}</button>`).join('')}</div>`;
}
function shNewEdu(){
  return `<h2 class="serif" style="font-size:22px;margin:0 0 6px">Образование</h2>
    <p class="small muted" style="margin:0 0 12px">Укажи программу и приложи скан. Ученицы увидят только название и год после проверки.</p>
    <label class="lbl">Что окончила</label>
    <input class="field" id="ed_t" placeholder="МГУ, факультет психологии">
    <label class="lbl">Год окончания</label>
    <input class="field" id="ed_y" placeholder="2016">
    <button class="btn" onclick="saveEdu('${attJs(S.sheet.id)}')">Отправить на проверку</button>`;
}
function saveEdu(eid){
  const t = ($('#ed_t')||{}).value, y = ($('#ed_y')||{}).value;
  if(!t || !t.trim()) return toast('Укажи, что окончила');
  const e = EXPERTS.find(x => x.id === eid);
  e.edu = e.edu || [];
  const id = 'ed'+Date.now().toString(36);
  e.edu.push({id, t:t.trim(), y:(y||'').trim(), st:'pending', expert:e.n});
  S.sheet = null; pushShared(); render();
  toast('Отправлено администратору. Загрузи скан документа');
  setTimeout(() => pickImage('cert_'+id), 400);
}
function shEduCheck(){
  const {eid, id} = S.sheet;
  const e = EXPERTS.find(x => x.id === eid);
  const x = ((e || {}).edu || []).find(v => v.id === id);
  if(!e || !x) return gone('Этого документа');
  return `<h2 class="serif" style="font-size:22px;margin:0 0 4px">Проверка документа</h2>
    <p class="small muted" style="margin:0 0 12px">${esc(e.n)} · ${esc(x.t)}${x.y?', '+x.y:''}</p>
    ${MEDIA['cert_'+id]
      ? `<img src="${safeUrl(MEDIA['cert_'+id])}" style="width:100%;border-radius:var(--r);margin-bottom:10px">`
      : `<div class="upbox">Скан не загружен - можно запросить у эксперта</div>`}
    <p class="small muted" style="margin:0 0 12px">Скан виден только администраторам.</p>
    <button class="btn" onclick="setEdu('${attJs(eid)}','${attJs(id)}','approved')">Подтвердить образование</button>
    <label class="lbl" style="margin-top:12px">Комментарий при отказе</label>
    <textarea class="field" id="ed_c" rows="3" placeholder="Например: скан нечитаемый"></textarea>
    <button class="btn ghost" onclick="setEdu('${attJs(eid)}','${attJs(id)}','rejected')">Отклонить</button>`;
}
function setEdu(eid, id, st){
  const e = EXPERTS.find(x => x.id === eid);
  const x = (e.edu||[]).find(v => v.id === id);
  x.st = st;
  if(st === 'rejected') x.comment = (($('#ed_c')||{}).value || 'Документ не принят').trim();
  S.sheet = null; pushShared(); render();
  toast(st === 'approved' ? 'Образование подтверждено' : 'Отклонено, эксперт увидит комментарий');
}
function svStep(dir){ stepValue('svDraft.price', dir, '#svprice'); }
function shService(){
  const e = me ? me() : EXPERTS[0];
  const editing = S.sheet.id ? (e.services||[]).find(x => x.id === S.sheet.id) : null;
  if(!S.svDraft || S.svDraft._id !== (editing ? editing.id : 'new')){
    S.svDraft = editing ? {...editing, _id:editing.id, who:[...(editing.who||[])]}
      : {_id:'new', t:'Личная консультация', mins:50, format:'онлайн, Zoom', price:4990,
         about:'', who:[], oldPrice:0, until:''};
  }
  const d = S.svDraft;
  return `<h2 class="serif" style="font-size:22px;margin:0 0 6px">${editing ? 'Услуга' : 'Новая услуга'}</h2>
    <p class="small muted" style="margin:0 0 12px">Появится на твоей публичной странице в блоке «Услуги эксперта».</p>
    <label class="lbl">Название</label>
    <input class="field" value="${esc(d.t)}" oninput="S.svDraft.t=this.value">
    <div class="g2">
      <div><label class="lbl">Длительность, мин</label>
        <input class="field" type="number" value="${d.mins}" oninput="S.svDraft.mins=+this.value||30"></div>
      <div><label class="lbl">Формат</label>
        <input class="field" value="${esc(d.format)}" oninput="S.svDraft.format=this.value"></div>
    </div>
    <label class="lbl">Цена</label>
    <div class="pricepick">
      <button onclick="svStep(-1)">−</button>
      <div class="pv" id="svprice">${d.price === 0 ? 'Бесплатно' : money(d.price)}</div>
      <button onclick="svStep(1)">+</button>
    </div>
    <div class="small muted" style="margin:-2px 0 8px">Шаг 500 ₽, цена заканчивается на 90. Ноль - бесплатная услуга</div>
    <input class="field" type="number" id="svprice-input" placeholder="Или впиши цену вручную" value="${d.price||''}"
      oninput="S.svDraft.price=+this.value||0;document.getElementById('svprice').textContent=(+this.value?money(+this.value):'Бесплатно')">
    <label class="lbl">Описание</label>
    <textarea class="field" rows="3" oninput="S.svDraft.about=this.value">${esc(d.about)}</textarea>
    <label class="lbl">С какими запросами приходят</label>
    <div id="svwho">${(d.who||[]).map((w,i) => `<input class="field" value="${esc(w)}" oninput="S.svDraft.who[${i}]=this.value">`).join('')}</div>
    <button class="btn ghost sm" onclick="addWhoField()">＋ запрос</button>
    <div class="card" style="margin-top:12px">
      <b style="font-size:14px">Спецусловие</b>
      <div class="small muted" style="margin:4px 0 9px">Ограниченное по времени предложение</div>
      <label class="lbl">Прежняя цена, ₽</label>
      <input class="field" type="number" value="${d.oldPrice||''}" oninput="S.svDraft.oldPrice=+this.value||0">
      <label class="lbl">Действует до</label>
      <input class="field" type="date" value="${d.until||''}" oninput="S.svDraft.until=this.value">
    </div>
    <button class="btn" onclick="saveService()">Сохранить услугу</button>
    ${editing ? `<button class="btn ghost" style="margin-top:8px" onclick="delService('${attJs(editing.id)}')">Удалить</button>` : ''}`;
}
function addWhoField(){
  const box = document.getElementById('svwho');
  if(!box) return;
  const i = S.svDraft.who.length;
  S.svDraft.who.push('');
  const inp = document.createElement('input');
  inp.className = 'field'; inp.placeholder = 'С каким запросом приходят';
  inp.oninput = e => { S.svDraft.who[i] = e.target.value; };
  box.appendChild(inp); inp.focus();
}
function saveService(){
  const e = me();
  const d = S.svDraft;
  if(!d.t || !d.t.trim()) return toast('Назови услугу');
  d.who = (d.who||[]).filter(w => w && w.trim());
  e.services = e.services || [];
  if(d._id === 'new') e.services.push({...d, id:'sv'+Date.now().toString(36)});
  else {
    const i = e.services.findIndex(x => x.id === d._id);
    e.services[i] = {...e.services[i], ...d};
  }
  S.svDraft = null; S.sheet = null; pushShared(); render(); toast('Услуга сохранена');
}
function delService(id){
  const e = me();
  e.services = (e.services||[]).filter(x => x.id !== id);
  S.svDraft = null; S.sheet = null; render(); toast('Услуга удалена');
}

/* ---------- знакомства и послания ---------- */
function shDating(){
  const d = S.datingProfile ? (S.dp = S.dp || {...S.datingProfile})
    : (S.dp = S.dp || {ints:[...(S.myInts||[])], goal:'подруги', city:'Москва', about:''});
  const age = S.birth.date ? Math.floor((Date.now() - new Date(S.birth.date))/31557600000) : null;
  const kids = S.extra && (S.extra.baby || S.extra.preg);
  const all = [...INTERESTS, ...(S.customInts||[])];
  return `<h2 class="serif" style="font-size:22px;margin:0 0 6px">Анкета знакомств</h2>
    <p class="small muted" style="margin:0 0 12px">Три вопроса - и Ева начнёт подбирать женщин, с которыми у тебя есть общее.</p>
    <div class="card" style="padding:12px;background:var(--surface-2);border:none">
      <div class="small"><b>${esc(S.name||'Ты')}</b>${age ? `, ${age}` : ''}${kids ? ' · ' + (S.extra.preg ? 'беременность, ' + S.extra.preg : 'малыш ' + S.extra.baby) : ''}</div>
      <div class="small muted" style="margin-top:3px">Эти данные уже есть в профиле</div>
    </div>
    <label class="lbl">Город</label>
    <input class="field" value="${esc(d.city||'')}" placeholder="Москва" oninput="S.dp.city=this.value">
    <label class="lbl">Зачем тебе знакомства</label>
    <div class="chips wrap">${['подруги','спорт вместе','поговорить','мамы рядом','путешествия','нетворкинг'].map(g =>
      `<button class="chip ${d.goal===g?'on':''}" onclick="chipPick(this,'dp.goal','${attJs(g)}')">${g}</button>`).join('')}</div>
    <label class="lbl" style="margin-top:10px">Интересы <span id="dcount" class="muted">${d.ints.length?'('+d.ints.length+')':''}</span></label>
    <div class="chips wrap" id="dints">${all.map(t =>
      `<button class="chip ${d.ints.includes(t)?'on':''}" onclick="chipToggle(this,'dp.ints','${attJs(t)}','#dcount')">${t}</button>`).join('')}</div>
    <button class="btn ghost sm" style="margin-top:8px" onclick="openSheet('newInt')">＋ Свой интерес</button>
    <label class="lbl" style="margin-top:12px">Пара слов о себе</label>
    <textarea class="field" rows="3" placeholder="Например: медитирую по утрам, ищу подругу для практик"
      oninput="S.dp.about=this.value">${esc(d.about||'')}</textarea>
    <button class="btn" onclick="saveDating()">${S.datingProfile ? 'Сохранить' : 'Начать знакомиться'}</button>`;
}
function saveDating(){
  const d = S.dp || {};
  if(!d.ints || !d.ints.length) return toast('Выбери хотя бы один интерес');
  /* каждый раз после правки показываем анкету такой, какой её увидят другие:
     раньше опубликованную анкету посмотреть было негде */
  S.datingProfile = {...d, published:false};
  S.myInts = d.ints;
  S.dp = null;
  S.matchIdx = 0; S.datingFmt = S.datingFmt || 'кофе';
  S.showProfile = false;
  S.sheet = null; S.tab = 'club'; S.clubTab = 'people';
  render(); schedulePersist();
  toast('Посмотри, как анкета выглядит со стороны');
}

/* подтверждение удаления анкеты */
function shDropProfile(){
  return `<h2 class="serif" style="font-size:22px;margin:0 0 6px">Удалить анкету?</h2>
    <p class="small muted" style="margin:0 0 14px">Тебя перестанут показывать в знакомствах, а переписки
      останутся на месте. Заполнить заново можно в любой момент.</p>
    <button class="btn" style="background:var(--accent)" onclick="dropProfile()">Удалить</button>
    <button class="btn ghost" style="margin-top:9px" onclick="closeSheet()">Оставить</button>`;
}
function shNewInt(){
  return `<h2 class="serif" style="font-size:22px;margin:0 0 6px">Свой интерес</h2>
    <p class="small muted" style="margin:0 0 12px">Добавится в общий список - по нему тебя найдут другие участницы.</p>
    <input class="field" id="ni_t" placeholder="Например: сёрфинг">
    <button class="btn" onclick="addCustomInt()">Добавить</button>
    <button class="btn ghost" style="margin-top:8px" onclick="openSheet('dating')">Назад к анкете</button>`;
}
function addCustomInt(){
  const t = (($('#ni_t')||{}).value || '').trim().toLowerCase();
  if(!t) return toast('Напиши название');
  S.customInts = S.customInts || [];
  if(!INTERESTS.includes(t) && !S.customInts.includes(t)) S.customInts.push(t);
  S.dp = S.dp || {ints:[]};
  if(!S.dp.ints.includes(t)) S.dp.ints.push(t);
  openSheet('dating'); toast('Интерес добавлен');
}
/* просмотр фотографии из ленты во весь экран */
function shPhoto(){
  const src = MEDIA[S.sheet.src];
  if(!src) return `<div class="empty">Фотография не найдена</div>`;
  return `<img src="${safeUrl(src)}" alt="" style="width:100%;border-radius:var(--r-lg);display:block">
    <button class="btn ghost" style="margin-top:12px" onclick="closeSheet()">Закрыть</button>`;
}

function sendPost(){
  const d = S.post || {};
  const text = ((($('#wp_t')||{}).value) || d.t || '').trim();
  if(!text) return toast('Напиши хотя бы пару слов');
  /* послание подписываем почтой автора: метка «моё» уезжала в общие данные
     и чужие послания показывались чужими же аватарками */
  WALL.unshift({id:'w' + Date.now().toString(36), a:S.name || 'Я', ago:'только что',
    city:((S.datingProfile && S.datingProfile.city) || S.city || ''), t:text, st:0,
    email:myMail(), comments:[]});
  S.points += 5; S.post = null;
  /* поле для послания стоит прямо в ленте: убираем набранное и снимаем
     фокус, чтобы на телефоне не осталась висеть клавиатура */
  const box = $('#wp_t');
  if(box){ box.value = ''; box.blur(); }
  render(); schedulePersist(); syncPush(['wall']);
  toast('Послание опубликовано. +5 баллов');
}

/* ---------- вопрос о товаре ---------- */
function shAskGood(){
  const g = GOODS.find(x => x.id === S.sheet.id);
  return `<h2 class="serif" style="font-size:22px;margin:0 0 6px">Вопрос о товаре</h2>
    <p class="small muted" style="margin:0 0 12px">${esc(g.t)}. Ответим в личных сообщениях - переписка появится
      у тебя в разделе «Сообщения».</p>
    <textarea class="field" id="gq_t" rows="4" placeholder="Например: какой размер выбрать?"></textarea>
    <div class="chips wrap">${['Какой размер выбрать?','Из чего сделано?','Когда будет доставка?','Есть другие цвета?'].map(t =>
      `<button class="chip" onclick="$('#gq_t').value='${attJs(t)}'">${t}</button>`).join('')}</div>
    <button class="btn" style="margin-top:12px" onclick="askGood('${attJs(g.id)}')">Отправить вопрос</button>`;
}

/* вопрос уходит админу и одновременно открывает личную переписку у покупательницы */
function askGood(gid){
  const t = (($('#gq_t')||{}).value || '').trim();
  if(!t) return toast('Напиши вопрос');
  const g = GOODS.find(x => x.id === gid);
  const mail = S.user ? S.user.email : '';
  const id = 'q'+Date.now().toString(36);

  S.qs.push({id, gid, who:S.name || 'Гостья', mail, ago:'только что', t, answer:'', private:true});

  /* переписка у покупательницы */
  if(typeof initInbox === 'function') initInbox();
  const now = new Date();
  const tm = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
  let th = S.inbox.find(x => x.kind === 'маркет');
  if(!th){
    th = {id:'mk'+Date.now().toString(36), from:'Eva Space · Маркет', c:'#111014',
          kind:'маркет', ago:'только что', unread:false, sys:true, msgs:[]};
    S.inbox.unshift(th);
  }
  th.msgs.push({me:true, t:`Вопрос о товаре «${g ? g.t : ''}»: ${t}`, tm});
  th.qid = id;
  platformSay(`Вопрос о товаре «${g ? g.t : ''}» передан. Ответим сюда — обычно в течение дня. ` +
    'Если это про заказ, напиши его номер, так найдём быстрее.', '', 'market');

  S.sheet = null; S.viewGood = null; S.page = 'inbox'; S.thread = th.id;
  render(); schedulePersist(); syncPush(['questions']);
  toast('Вопрос отправлен. Ответ придёт в сообщения');
}

/* ---------- настройки ---------- */
/* Почта — это номер аккаунта: по ней лежат прогресс, фото, карточка
   страницы и переписка. Переносить всё это женщина себе сама не может,
   и делать вид, что может, — хуже, чем сказать прямо. Здесь окно честно
   говорит, как поменять адрес, вместо кнопки, которая ничего не делала. */
function shChangeMail(){
  return `<h2 class="serif" style="font-size:22px;margin:0 0 6px">Изменить почту</h2>
    <label class="lbl">Сейчас вход по адресу</label>
    <div class="linkbox" style="margin-bottom:12px">${S.user ? esc(S.user.email) : '—'}</div>
    <div class="card" style="background:var(--accent-soft);border-color:transparent">
      <b style="font-size:14.5px">Адрес меняем вручную</b>
      <p class="small muted" style="margin:7px 0 0">По этой почте лежит всё: программа,
        баллы, покупки, фото, страница и переписка. Чтобы ничего не потерялось,
        адрес переносим руками — напиши в поддержку, поменяем в тот же день.</p>
    </div>
    <button class="btn" style="margin-top:12px" onclick="openSheet('support')">Написать в поддержку</button>`;
}
function shChangePass(){
  return `<h2 class="serif" style="font-size:22px;margin:0 0 6px">Сменить пароль</h2>
    <p class="small muted" style="margin:0 0 12px">После смены на других устройствах придётся войти заново.</p>
    <label class="lbl">Текущий пароль</label><input class="field" id="p_old" type="password">
    <label class="lbl">Новый пароль</label><input class="field" id="p_new" type="password" placeholder="Минимум 6 символов">
    <label class="lbl">Повтори новый</label><input class="field" id="p_rep" type="password">
    <button class="btn" onclick="changePass()">Сохранить</button>`;
}
/* Одна смена пароля на всех: у женщины поля p_*, у эксперта xp_*.
   Меняет сервер — раньше приложение правило только копию в браузере
   и всё равно говорило «Пароль изменён». */
async function changePass(pref){
  const id = k => ($('#' + (pref || 'p') + '_' + k) || {}).value || '';
  const o = id('old'), n = id('new'), r = id('rep');
  if(!n || n.length < 6) return toast('Новый пароль минимум 6 символов');
  if(n !== r) return toast('Пароли не совпадают');

  const res = await apiCall('pass_change', {old:o, new:n}, {silent:true});
  if(!res) return toast(SYNC.lastError || 'Не удалось сменить пароль');

  /* копию в браузере держим в согласии с сервером: по ней работает
     вход, когда сети нет */
  const u = S.user ? DB.find(S.user.email) : null;
  if(u){ u.pass = hashPass(n); DB.upsert(u); }
  S.sheet = null; render();
  toast('Пароль изменён. Другие входы закрыты');
}
function shSupport(){
  return `<h2 class="serif" style="font-size:22px;margin:0 0 6px">Написать в поддержку</h2>
    <p class="small muted" style="margin:0 0 12px">Обычно отвечаем в течение дня.</p>
    <label class="lbl">Тема</label>
    <div class="chips wrap">${['Оплата','Доступ','Технический сбой','Вопрос по программе','Другое'].map(t =>
      `<button class="chip ${(S.supTopic||'Другое')===t?'on':''}" onclick="chipPick(this,'supTopic','${attJs(t)}')">${t}</button>`).join('')}</div>
    <label class="lbl">Сообщение</label>
    <textarea class="field" id="sup_t" rows="5" placeholder="Опиши, что случилось"></textarea>
    <button class="btn" onclick="sendSupport()">Отправить</button>`;
}
function sendSupport(){
  const t = (($('#sup_t')||{}).value || '').trim();
  if(!t) return toast('Опиши вопрос');
  const tk = toSupport(S.supTopic || 'Другое', t, 'support');
  platformSay(`Получили обращение «${S.supTopic || 'Другое'}». Обычно отвечаем в течение дня — ответ придёт сюда.`,
    '', 'space', tk && tk.id);
  S.sheet = null; render(); toast('Отправлено в поддержку. Подтверждение — в сообщениях');
}


/* =====================================================================
   ЗАЯВКА ЭКСПЕРТА
   Специалист видит на платформе чужие карточки и думает «я тоже так могу».
   До сих пор ему некуда было это сказать: эксперты появлялись только
   через личное приглашение, а на экране про это не было ни слова.

   Заявка спрашивает ровно то, без чего решение не принять, и ничего
   сверх: имя и почта уже есть в аккаунте, диплом на этом шаге не нужен —
   его проверяют потом, когда договорились. Пять полей, две минуты.

   Падает она в поддержку, отдельной темой «Заявка эксперта»: там её
   видит редакция, там же отвечает, и оттуда одной кнопкой выдаёт роль.
   Заводить ради этого отдельный ящик незачем — обращения уже читают.
   ===================================================================== */
const EXP_WANT = ['Практики и медитации', 'Мастер-классы', 'Курс', 'Личные консультации', 'Встречи офлайн'];

/* ссылка на правила — одна строка под любой формой заявки */
const rulesLine = kind => `<p class="tiny muted" style="margin:10px 0 0">Отправляя заявку, вы соглашаетесь
  с <button class="link" style="font-size:inherit" onclick="openSheet({k:'rules',kind:'${attJs(kind)}'})">правилами для ${
  {expert:'экспертов', partner:'партнёров', event:'мероприятий'}[kind] || 'участников'}</button> — они короткие.</p>`;

/* уже отправленная заявка: не даём дублировать, говорим, что дальше */
const sentCard = (title, text, again) => `<h2 class="serif" style="font-size:22px;margin:0 0 6px">${title}</h2>
    <p class="small muted" style="margin:0 0 14px">${text}</p>
    ${again ? `<button class="btn ghost" style="margin-bottom:9px" onclick="${again}">Предложить ещё</button>` : ''}
    <button class="btn ghost" onclick="closeSheet()">Понятно</button>`;

function shExpertApply(){
  const d = S.expApply = S.expApply || {want:[], area:'', exp:'', link:'', about:''};
  const sent = (typeof INBOX !== 'undefined') &&
    INBOX.some(t => t.sub === 'Заявка эксперта' && t.mail === (S.user ? S.user.email : ''));
  if(sent) return sentCard('Заявка отправлена',
    'Прочитаем и ответим в течение недели — ответ придёт в «Сообщения». Если нужно что-то добавить, напишите в поддержку.');

  return `<h2 class="serif" style="font-size:22px;margin:0 0 6px">Стать экспертом Евы</h2>
    <p class="small muted" style="margin:0 0 14px">Практики, мастер-классы, курс или консультации — расскажите,
      чем делитесь. Пять полей, две минуты. Диплом на этом шаге не нужен: документы посмотрим потом,
      когда договоримся по сути.</p>

    <label class="lbl">Чем занимаетесь</label>
    <input class="field" id="ea_area" placeholder="Телесный терапевт, преподаю йогу"
      value="${esc(d.area)}" oninput="S.expApply.area=this.value">

    <label class="lbl">Сколько лет практикуете</label>
    <input class="field" id="ea_exp" placeholder="Например, восемь"
      value="${esc(d.exp)}" oninput="S.expApply.exp=this.value">

    <label class="lbl">Что хотели бы вести</label>
    <div class="chips wrap" style="margin-bottom:12px">${EXP_WANT.map(w =>
      `<button class="chip ${d.want.indexOf(w) >= 0 ? 'on' : ''}"
        onclick="expWant(this,'${attJs(w)}')">${w}</button>`).join('')}</div>

    <label class="lbl">Где вас можно посмотреть</label>
    <input class="field" id="ea_link" placeholder="Сайт, телеграм-канал или профиль в соцсети"
      value="${esc(d.link)}" oninput="S.expApply.link=this.value">

    <label class="lbl">Пара слов о подходе</label>
    <textarea class="field" rows="4" placeholder="С чем к вам приходят и что меняется у женщин после работы с вами"
      oninput="S.expApply.about=this.value">${esc(d.about)}</textarea>

    <div class="card" style="background:var(--surface-2);border-color:transparent;margin-top:4px">
      <span class="small muted">Отправим от имени <b>${esc(S.name || '—')}</b>,
        ${S.user ? esc(S.user.email) : 'почта не указана'}. Ответ придёт в «Сообщения».</span>
    </div>

    <button class="btn" style="margin-top:12px" onclick="sendExpertApply()">Отправить заявку</button>
    ${rulesLine('expert')}`;
}
/* Отметка «что хотела бы вести» меняется на месте: перерисовывать всю
   форму ради одного чипа незачем — она набирает текст в соседнем поле. */
function expWant(btn, w){
  const d = S.expApply = S.expApply || {want:[]};
  const on = d.want.indexOf(w) >= 0;
  d.want = on ? d.want.filter(x => x !== w) : [...d.want, w];
  if(btn && btn.classList) btn.classList.toggle('on', !on);
  schedulePersist();
}
function sendExpertApply(){
  const d = S.expApply || {};
  if(!(d.area || '').trim())  return toast('Напишите, чем занимаетесь');
  if(!(d.about || '').trim()) return toast('Пара слов о подходе — самое важное поле');
  if(typeof INBOX === 'undefined') return toast('Не отправилось, попробуйте позже');
  const tk = {
    id:'ea' + Date.now().toString(36),
    from: S.name || 'Участница',
    role: 'ученица',
    mail: S.user ? S.user.email : '—',
    ago: 'только что',
    sub: 'Заявка эксперта',
    t: [
      'Чем занимается: ' + d.area,
      d.exp ? 'В практике: ' + d.exp : '',
      (d.want || []).length ? 'Хочет вести: ' + d.want.join(', ') : '',
      d.link ? 'Где посмотреть: ' + d.link : '',
      '',
      d.about
    ].filter(Boolean).join('\n'),
    st:'новое', kind:'expert', at:Date.now()
  };
  INBOX.unshift(tk);
  S.expApply = null;
  platformSay('Заявка на роль эксперта у нас. Прочитаем внимательно и ответим сюда в течение недели. ' +
    'Спасибо, что хотите делиться опытом — из таких заявок и растёт Ева.', '', 'experts', tk.id);
  S.sheet = null; render(); syncPush(['support']);
  toast('Заявка отправлена. Подтверждение — в сообщениях');
}

/* =====================================================================
   ПАРТНЁР МАРКЕТА И МЕРОПРИЯТИЕ ОТ УЧАСТНИЦЫ
   Те же правила, что у заявки эксперта: короткая форма, заявка уходит
   в поддержку с меткой вида, администратор видит её в своём разделе,
   женщине приходит подтверждение в сообщения.
   ===================================================================== */
function shPartnerApply(){
  const d = S.partnerApply = S.partnerApply || {brand:'', goods:'', link:'', why:'', contact:''};
  const sent = (typeof INBOX !== 'undefined') &&
    INBOX.some(t => t.kind === 'partner' && t.mail === (S.user ? S.user.email : '') && t.st !== 'закрыто');
  if(sent) return sentCard('Заявка партнёра отправлена',
    'Посмотрим товар и ответим в течение трёх дней — ответ придёт в «Сообщения».');
  return `<h2 class="serif" style="font-size:22px;margin:0 0 6px">Стать партнёром маркета</h2>
    <p class="small muted" style="margin:0 0 14px">Мы собираем маркет из вещей для заботы о себе, которые
      сами бы выбрали. Расскажите о товаре — пять полей, две минуты.</p>
    <label class="lbl">Бренд или имя</label>
    <input class="field" id="pa_brand" placeholder="Мастерская «Тихий час»" value="${esc(d.brand)}" oninput="S.partnerApply.brand=this.value">
    <label class="lbl">Что за товар</label>
    <textarea class="field" id="pa_goods" rows="3" placeholder="Свечи из соевого воска, коврики, травяные чаи…"
      oninput="S.partnerApply.goods=this.value">${esc(d.goods)}</textarea>
    <label class="lbl">Где посмотреть</label>
    <input class="field" id="pa_link" placeholder="Сайт, маркетплейс или соцсеть" value="${esc(d.link)}" oninput="S.partnerApply.link=this.value">
    <label class="lbl">Почему это для Евы</label>
    <input class="field" id="pa_why" placeholder="Состав, производство, для каких практик" value="${esc(d.why)}" oninput="S.partnerApply.why=this.value">
    <label class="lbl">Как связаться</label>
    <input class="field" id="pa_contact" placeholder="Телефон или телеграм" value="${esc(d.contact)}" oninput="S.partnerApply.contact=this.value">
    <div class="card" style="background:var(--surface-2);border-color:transparent;margin-top:4px">
      <span class="small muted">Отправим от имени <b>${esc(S.name || '—')}</b>,
        ${S.user ? esc(S.user.email) : 'почта не указана'}. Ответ придёт в «Сообщения».</span>
    </div>
    <button class="btn" style="margin-top:12px" onclick="sendPartnerApply()">Отправить заявку</button>
    ${rulesLine('partner')}`;
}
function sendPartnerApply(){
  const d = S.partnerApply || {};
  if(!(d.brand || '').trim()) return toast('Назовите бренд или себя');
  if(!(d.goods || '').trim()) return toast('Напишите, что за товар');
  if(!(d.contact || '').trim()) return toast('Оставьте телефон или телеграм');
  const t = toSupport('Партнёр маркета: ' + d.brand.trim(), [
      'Товар: ' + d.goods.trim(),
      d.link ? 'Где посмотреть: ' + d.link : '',
      d.why ? 'Почему для Евы: ' + d.why : '',
      'Связь: ' + d.contact.trim()
    ].filter(Boolean).join('\n'), 'partner', {brand:d.brand.trim(), contact:d.contact.trim()});
  if(!t) return toast('Не отправилось, попробуйте позже');
  S.partnerApply = null;
  platformSay(`Заявка партнёра «${d.brand.trim()}» получена. Посмотрим товар и ответим сюда в течение трёх дней. ` +
    'Спасибо — мы собираем маркет из вещей, которые сами бы выбрали.', '', 'market', t.id);
  S.sheet = null; render();
  toast('Заявка отправлена. Подтверждение — в сообщениях');
}

function shEventApply(){
  const d = S.eventApply = S.eventApply || {own:true, t:'', d:'', where:'', link:'', about:'', contact:''};
  const last = (typeof INBOX !== 'undefined') &&
    INBOX.find(t => t.kind === 'event' && t.mail === (S.user ? S.user.email : '') && t.st === 'новое');
  if(last && !d.more) return sentCard('Мероприятие отправлено',
    'Проверим и, если всё сходится с правилами, опубликуем — напишем в «Сообщения» в течение трёх дней.',
    "S.eventApply.more=true;render()");
  return `<h2 class="serif" style="font-size:22px;margin:0 0 6px">${d.own ? 'Добавить своё мероприятие' : 'Порекомендовать мероприятие'}</h2>
    <div class="seg" style="margin:0 0 12px">
      <button class="${d.own ? 'on' : ''}" onclick="S.eventApply.own=true;render()">Провожу сама</button>
      <button class="${d.own ? '' : 'on'}" onclick="S.eventApply.own=false;render()">Рекомендую</button>
    </div>
    <p class="small muted" style="margin:0 0 14px">${d.own
      ? 'Женский круг, практика, лекция или встреча — расскажите коротко, мы проверим и опубликуем.'
      : 'Знаете хорошее мероприятие? Напишите, что и откуда знаете, — мы свяжемся с организаторами сами.'}</p>
    <label class="lbl">Название</label>
    <input class="field" id="ea2_t" placeholder="Женский круг «Тихая пятница»" value="${esc(d.t)}" oninput="S.eventApply.t=this.value">
    <div class="g2">
      <div><label class="lbl">Дата</label>
        <input class="field" id="ea2_d" type="date" value="${esc(d.d)}" oninput="S.eventApply.d=this.value"></div>
      <div><label class="lbl">Город или онлайн</label>
        <input class="field" id="ea2_w" placeholder="Москва / Zoom" value="${esc(d.where)}" oninput="S.eventApply.where=this.value"></div>
    </div>
    <label class="lbl">Ссылка</label>
    <input class="field" id="ea2_l" placeholder="Страница, канал или анонс" value="${esc(d.link)}" oninput="S.eventApply.link=this.value">
    <label class="lbl">${d.own ? 'О чём и для кого' : 'Что там и откуда знаете'}</label>
    <textarea class="field" id="ea2_a" rows="3" placeholder="${d.own ? 'Что будет, сколько длится, сколько стоит' : 'Были сами или советовали подруги — так и напишите'}"
      oninput="S.eventApply.about=this.value">${esc(d.about)}</textarea>
    ${d.own ? `<label class="lbl">Как связаться</label>
    <input class="field" id="ea2_c" placeholder="Телефон или телеграм" value="${esc(d.contact)}" oninput="S.eventApply.contact=this.value">` : ''}
    <button class="btn" style="margin-top:8px" onclick="sendEventApply()">${d.own ? 'Отправить на проверку' : 'Порекомендовать'}</button>
    ${rulesLine('event')}`;
}
function sendEventApply(){
  const d = S.eventApply || {};
  if(!(d.t || '').trim()) return toast('Назовите мероприятие');
  if(!(d.about || '').trim()) return toast(d.own ? 'Напишите, о чём оно' : 'Напишите, откуда знаете');
  if(d.own && !(d.contact || '').trim()) return toast('Оставьте телефон или телеграм');
  const own = !!d.own;
  const t = toSupport((own ? 'Мероприятие: ' : 'Рекомендация: ') + d.t.trim(), [
      d.d ? 'Когда: ' + d.d : '',
      d.where ? 'Где: ' + d.where : '',
      d.link ? 'Ссылка: ' + d.link : '',
      d.about.trim(),
      own ? 'Связь: ' + d.contact.trim() : 'Рекомендует участница'
    ].filter(Boolean).join('\n'), 'event',
    {own, t:d.t.trim(), d:d.d || '', where:d.where || '', link:d.link || '', about:d.about.trim(), contact:d.contact || ''});
  if(!t) return toast('Не отправилось, попробуйте позже');
  S.eventApply = {own, t:'', d:'', where:'', link:'', about:'', contact:''};
  platformSay(own
    ? `Мероприятие «${d.t.trim()}» получено. Проверим и, если всё сходится с правилами, опубликуем — напишем сюда в течение трёх дней.`
    : `Спасибо за рекомендацию «${d.t.trim()}». Свяжемся с организаторами и, если подойдёт, добавим в раздел. Напишем сюда.`,
    '', 'events', t.id);
  S.sheet = null; render();
  toast(own ? 'Отправлено на проверку. Подтверждение — в сообщениях' : 'Спасибо, передали команде');
}

/* Ник для анонимной комнаты. Первое, что она здесь делает, — поэтому
   объясняем на месте, что он значит, и предлагаем три готовых на случай
   «не придумывается». Проверку показываем сразу под полем, а не после
   отправки: переписывать ник вслепую неприятно. */
function shAnonNick(){
  const gid = S.sheet.id;
  const g = GROUPS.find(x => x.id === gid);
  const cur = myAnonName(gid);
  S.nickDraft = S.nickDraft || {};
  const v = S.nickDraft[gid] != null ? S.nickDraft[gid] : '';
  S.nickIdeas = S.nickIdeas || {};
  if(!S.nickIdeas[gid]) S.nickIdeas[gid] = nickIdeas(gid);
  return `<h2 class="serif" style="font-size:22px;margin:0 0 6px">${cur ? 'Сменить ник' : 'Твой ник здесь'}</h2>
    <p class="small muted" style="margin:0 0 14px">${esc((g||{}).t || 'Анонимная комната')} · виден только в этой комнате.
      С твоей страницей, именем и почтой он не связан — ни на экране, ни в сохранённом.
      ${cur ? 'Прежние сообщения останутся под старым ником и останутся твоими.' : ''}</p>
    <div class="nickpreview" id="an_prev">${nickPreview(v.trim() || cur)}</div>
    <label class="lbl">Ник</label>
    <input class="field" id="an_nick" maxlength="18" autocomplete="off" placeholder="Например, Тихая осень"
      value="${esc(v)}" oninput="typeNick('${attJs(gid)}', this.value)"
      onkeydown="if(event.key==='Enter')saveAnonNick('${attJs(gid)}')">
    <div class="small" id="an_err" style="color:var(--accent);margin:-4px 0 8px;min-height:16px"></div>
    <div class="eyebrow" style="margin:2px 0 7px">Если не придумывается</div>
    <div class="chips wrap">${S.nickIdeas[gid].map(n =>
      `<button class="chip" onclick="pickNick('${attJs(gid)}','${attJs(n)}')">${esc(n)}</button>`).join('')}</div>
    <button class="btn" id="an_go" style="margin-top:14px" ${cur ? '' : 'disabled'}
      onclick="saveAnonNick('${attJs(gid)}')">${cur ? 'Сменить' : 'Войти в комнату'}</button>
    <p class="tiny muted" style="margin-top:10px">Здесь не начисляются баллы и не видно, кто прочитал.
      Если кто-то портит разговор, редакция закроет ему письмо — по нику, не зная, кто за ним.</p>`;
}
const nickPreview = n => `${anonAva(n || '?', 46)}
  <div><b style="font-size:15px">${esc(n || 'Ник')}</b>
    <div class="small muted">так тебя увидят в комнате</div></div>`;
/* Набор ника меняет только предпросмотр, подсказку об ошибке и кнопку.
   Пересобирать окно на каждую букву — это моргание и потерянный курсор. */
function typeNick(gid, val){
  S.nickDraft = S.nickDraft || {};
  S.nickDraft[gid] = val;
  const n = String(val || '').trim();
  const err = n ? anonNickError(gid, n) : '';
  const prev = $('#an_prev'), box = $('#an_err'), go = $('#an_go');
  if(prev) prev.innerHTML = nickPreview(n || myAnonName(gid));
  if(box)  box.textContent = err;
  if(go)   go.disabled = !!err || !n;
}
function pickNick(gid, n){
  const inp = $('#an_nick');
  if(inp){ inp.value = n; inp.focus(); }
  typeNick(gid, n);
}
function saveAnonNick(gid){
  const v = (($('#an_nick')||{}).value || (S.nickDraft||{})[gid] || '').trim();
  if(setAnonNick(gid, v)){
    if(S.nickDraft) delete S.nickDraft[gid];
    if(S.nickIdeas) delete S.nickIdeas[gid];
    setTimeout(() => { const el = $('#cin'); if(el) el.focus(); }, 80);
  }
}

/* ---------- правила: коротко, с благодарностью и общей целью ---------- */
const RULES = {
  expert: {t:'Правила для экспертов', lead:'Спасибо, что хотите делиться опытом в Еве. Наша общая цель — платформа, где женщине помогают настоящие люди с настоящей практикой.',
    pts:['Опыт настоящий: вы ведёте практику не первый год и можете это показать.',
         'Материал ваш — своё, а не пересказ чужих курсов.',
         'Без обещаний чудес: не лечим, не гарантируем, не пугаем.',
         'Бережно: женщина может быть в тяжёлом состоянии, и это учитывается в каждом слове.',
         'Ученицам в своих группах отвечаете в разумный срок.',
         'Документы посмотрим позже — на старте достаточно рассказа о себе.']},
  partner: {t:'Правила для партнёров маркета', lead:'Спасибо за интерес к маркету Евы. Наша общая цель — собрать здесь качественные вещи для заботы о себе, которые сами бы подарили подруге.',
    pts:['Качество: товар, за который не стыдно и через год.',
         'Экологичность: состав, упаковка и производство без вреда — нам это важно.',
         'Честное описание: без «волшебных» свойств и обещаний.',
         'Доставка и возврат на вашей стороне, условия оговариваем заранее.',
         'По теме: практики, дом, тело, ритуалы — то, ради чего женщины здесь.']},
  event: {t:'Правила для мероприятий', lead:'Спасибо, что хотите позвать женщин на встречу или подсказать хорошую. Наша общая цель — чтобы каждое мероприятие в Еве было безопасным и таким, каким описано.',
    pts:['Безопасно: понятное место, ведущая с опытом, без давления и продаж на встрече.',
         'Честно: описание совпадает с тем, что будет; цена и условия возврата указаны.',
         'По теме Евы: женские круги, практики, встречи, лекции, ретриты.',
         'Рекомендуете чужое — скажите, откуда знаете; с организаторами свяжемся сами.',
         'Мы можем не опубликовать — но обычно объясняем, почему.']}
};
function shRules(){
  const r = RULES[S.sheet && S.sheet.kind] || RULES.expert;
  return `<h2 class="serif" style="font-size:22px;margin:0 0 8px">${r.t}</h2>
    <p class="small" style="margin:0 0 12px;line-height:1.55">${r.lead}</p>
    <ul class="rules">${r.pts.map(x => `<li>${x}</li>`).join('')}</ul>
    <p class="tiny muted" style="margin:12px 0 14px">Отправляя заявку, вы соглашаетесь с этими правилами и с условиями сервиса.
      Спорные случаи разбираем вручную — и обычно договариваемся.</p>
    <button class="btn ghost" onclick="closeSheet()">Понятно</button>`;
}

/* ---------- решение по мероприятию ---------- */
function reviewEvent(id, mode){
  const c = (($('#evc')||{}).value || '').trim();
  if(!c) return toast(mode === 'rework' ? 'Напиши, что поправить' : 'Укажи причину отказа');
  const e = EVENTS.find(x => x.id === id);
  e.status = mode === 'rework' ? 'rework' : 'rejected';
  e.comment = c;
  notifyExpert(e.by, mode === 'rework'
    ? `Мероприятие «${esc(e.t)}» вернули на доработку. ${c}`
    : `Мероприятие «${esc(e.t)}» отклонено. ${c}`);
  S.sheet = null; syncPush(['events']); render();
  toast(mode === 'rework' ? 'Отправлено эксперту на доработку' : 'Отклонено, эксперт получил причину');
}

/* сообщение эксперту в личные сообщения */
function notifyExpert(expertName, text){
  if(typeof initInbox === 'function') initInbox();
  if(!S.inbox) return;
  const now = new Date();
  const tm = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
  let t = S.inbox.find(x => x.from === 'Редакция Eva' && x.to === expertName);
  if(!t){
    t = {id:'ed'+Date.now().toString(36), from:'Редакция Eva', to:expertName, c:'#111014',
         kind:'редакция', ago:'только что', unread:true, sys:true, msgs:[]};
    S.inbox.unshift(t);
  }
  t.msgs.push({me:false, t:text, tm});
  t.unread = true;
  S.expertNotes = S.expertNotes || [];
  S.expertNotes.unshift({to:expertName, t:text, at:Date.now()});
  syncPush(['support']);
}


/* ---------- смена почты и пароля в кабинете эксперта ---------- */
function shExMail(){
  return `<h2 class="serif" style="font-size:22px;margin:0 0 6px">Изменить почту</h2>
    <p class="small muted" style="margin:0 0 12px">По этому адресу ты входишь в кабинет.</p>
    <label class="lbl">Текущая</label>
    <div class="linkbox" style="margin-bottom:10px">${S.user ? esc(S.user.email) : '—'}</div>
    <label class="lbl">Новая почта</label>
    <input class="field" id="ex_mail" type="email" placeholder="you@mail.ru">
    <label class="lbl">Пароль для подтверждения</label>
    <input class="field" id="ex_mp" type="password">
    <button class="btn" onclick="changeExpertMail()">Сохранить</button>`;
}
function changeExpertMail(){
  const m = (($('#ex_mail')||{}).value || '').trim().toLowerCase();
  const pw = ($('#ex_mp')||{}).value || '';
  if(!/^[^@\s]+@[^@\s]+\.[a-zа-я]{2,}$/i.test(m)) return toast('Проверь адрес');
  if(DB.find(m)) return toast('Эта почта уже занята');
  const u = S.user ? DB.find(S.user.email) : null;
  if(u && u.pass !== hashPass(pw)) return toast('Неверный пароль');
  if(u){
    const all = DB.users();
    delete all[u.email.toLowerCase()];
    DB.saveUsers(all);
    u.email = m; DB.upsert(u);
    DB.setSession({email:m, at:Date.now()});
    S.user.email = m;
  }
  S.sheet = null; render(); toast('Почта изменена на ' + m);
}
function shExPass(){
  return `<h2 class="serif" style="font-size:22px;margin:0 0 6px">Сменить пароль</h2>
    <label class="lbl">Текущий пароль</label><input class="field" id="xp_old" type="password">
    <label class="lbl">Новый пароль</label><input class="field" id="xp_new" type="password" placeholder="Минимум 6 символов">
    <label class="lbl">Повтори новый</label><input class="field" id="xp_rep" type="password">
    <button class="btn" onclick="changePass('xp')">Сохранить</button>`;
}



/* создаёт профиль эксперта под новый аккаунт */
function createExpertProfile(name, email, tg){
  if(EXPERTS.some(e => e.n === name)) return EXPERTS.find(e => e.n === name);
  const id = 'e' + (EXPERTS.length + 1) + Date.now().toString(36).slice(-3);
  const e = {
    id, n:name, email, tg: tg || '',
    r:'Специализация не указана',
    t:[], exp:'новый эксперт', students:0, rate:5.0, price:4990,
    about:'Расскажи о себе: опыт, подход, чем помогаешь. Этот текст видят ученицы.',
    mission:'Твоя миссия — одна фраза о том, ради чего ты работаешь.',
    verified:false, who:[], ach:[], edu:[], services:[], c:'#A8375C'
  };
  EXPERTS.push(e);
  return e;
}


/* ---------- выбор готовой формулировки для профиля эксперта ---------- */
function shPickPhrase(){
  const {id, field} = S.sheet;
  const e = EXPERTS.find(x => x.id === id);
  if(!e || !field) return gone('Этой карточки');
  const isWho = field === 'who';
  const list = isWho ? WHO_TPL : ACH_TPL;
  const used = e[field] || [];
  const free = list.filter(t => !used.includes(t));
  return `<h2 class="serif" style="font-size:22px;margin:0 0 6px">
      ${isWho ? 'С чем к тебе приходят' : 'Опыт и достижения'}</h2>
    <p class="small muted" style="margin:0 0 14px">${isWho
      ? 'Выбери формулировку из готовых или напиши свою. Потом текст можно поправить.'
      : 'Выбери подходящее и подставь свои цифры вместо скобок.'}</p>

    <label class="lbl" style="margin-top:0">Написать своё</label>
    <div class="row" style="gap:8px">
      <input class="field" style="margin:0;flex:1" id="ph_own"
        placeholder="${isWho ? 'Например: не могу отдыхать без вины' : 'Например: 12 лет практики'}"
        onkeydown="if(event.key==='Enter')addOwnPhrase('${attJs(id)}','${attJs(field)}')">
      <button class="btn sm" onclick="addOwnPhrase('${attJs(id)}','${attJs(field)}')">→</button>
    </div>

    ${free.length ? `<div class="sec-h" style="margin-top:16px">
        <h2 class="serif" style="font-size:17px">Готовые формулировки</h2>
        <span class="small muted">${free.length}</span></div>
      ${free.map(t => `<button class="phrase" onclick="addPhrase('${attJs(id)}','${attJs(field)}', this.dataset.t)" data-t="${esc(t)}">
        <span class="pl2">＋</span><span>${esc(t)}</span></button>`).join('')}`
    : '<div class="empty" style="margin-top:14px">Все готовые формулировки уже добавлены</div>'}`;
}
function addPhrase(id, field, text){
  const e = EXPERTS.find(x => x.id === id);
  e[field] = e[field] || [];
  if(!e[field].includes(text)) e[field].push(text);
  S.sheet = null; render(); syncPush(['experts']);
  toast('Добавлено - поправь под себя');
}
function addOwnPhrase(id, field){
  const v = (($('#ph_own')||{}).value || '').trim();
  if(!v) return toast('Напиши формулировку');
  const e = EXPERTS.find(x => x.id === id);
  e[field] = e[field] || [];
  e[field].push(v);
  S.sheet = null; render(); syncPush(['experts']);
  toast('Добавлено');
}


