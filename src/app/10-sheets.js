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

function sheet(){
  const k = typeof S.sheet === 'string' ? S.sheet : S.sheet.k;
  const body = ({lesson:shLesson, course:shCourse, rebuild:shRebuild, eva:shEva,
    hint:shHint, addTag:shAddTag, cycle:shCycle, hd:shHD, consult:shConsult, write:shWrite,
    newContent:shNewContent, editContent:shEditContent, reject:shReject, rework:shRework,
    units:shUnits, groupInfo:shGroupInfo, newGroup:shNewGroup, fix:shFix, video:shVideo,
    hw:shHW, event:shEvent, newEvent:shNewEvent, eventEdit:shEventEdit, evReview:shEvReview, write2:shWrite2, hwEdit:shHwEdit,
    install:shInstall, diag:shDiag, askGood:shAskGood, newPost:shNewPost, dating:shDating, newInt:shNewInt, pickPhrase:shPickPhrase, exMail:shExMail, exPass:shExPass, changeMail:shChangeMail, changePass:shChangePass, support:shSupport, expTags:shExpTags, newEdu:shNewEdu, addUser:shAddUser, grant:shGrant, eduCheck:shEduCheck,
    service:shService,
    newCourse:shNewCourse, newGood:shNewGood, idea:shIdea})[k]();
  return `<div class="bg" onclick="if(event.target===this)closeSheet()">
    <div class="sheet"><div class="grab"></div>${body}</div></div>`;
}

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
          <div class="small muted">${e.r}</div></div>
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
      <div style="flex:1"><b style="font-size:14px">${esc(e.n)}</b><div class="small muted">${e.r}</div></div>
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
  const day = S.program[S.day], left = day.tasks.filter(t => !t.done);
  if(/аффирмац|прочит/.test(q)) return day.tasks[0].text;
  if(/балл|звёзд|звезд|статус|уровен/.test(q)){
    const {next} = levelNow();
    return `У тебя ${S.points} баллов и ${S.stars} из ${starsTotal()} звёзд на этой неделе.` + (next ? ` До статуса «${esc(next.n)}» осталось ${next.from - S.points}.` : '');
  }
  if(/почему|как.*собра|подобра/.test(q))
    return `Я собрала программу по твоим темам: ${S.tags.slice(0,4).join(', ')}. Из ${LIB.length} уроков библиотеки выбрала те, где совпадение выше всего - среднее по программе ${S.match}%.`;
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
function openCourse(id){ S.sheet = {k:'course', id}; render(); }

function tgTag(t){ S.tags = S.tags.includes(t) ? S.tags.filter(x => x !== t) : [...S.tags, t]; render(); }
function rebuild(){ buildProgram(); S.sheet = null; S.gentle = false; render(); toast('Программа собрана заново'); }

function addToDay(id){
  const x = LIB.find(i => i.id === id);
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
  S.cart = []; S.page = 'profile'; render(); schedulePersist();
  if(typeof syncPush === 'function') syncPush(['orders']);
  toast(`Заказ оформлен. Кэшбэк ${cb} бонусов`);
}
function buyCourse(id){
  if(S.courses.includes(id)) return;
  const c = COURSES.find(x => x.id === id);
  const used = Math.min(S.bonus, Math.round(c.p*0.3));
  S.bonus -= used; S.courses.push(id); S.points += 50;
  S.purchases.unshift({t:c.t, p:c.p - used, cb:0, date:'сегодня'});
  S.sheet = null; render();
  toast('Курс открыт. +150 баллов');
}
function join(id){
  S.joined = S.joined.includes(id) ? S.joined.filter(x => x !== id) : [...S.joined, id];
  render();
}
function copyRef(){
  const u = 'https://eva.space/r/' + (S.name||'eva').toLowerCase();
  if(navigator.clipboard) navigator.clipboard.writeText(u).catch(()=>{});
  toast('Ссылка скопирована');
}
function restartQuiz(){ S.screen='quiz'; S.qi=0; S.picked=[]; S.tags=[]; S.sheet=null; S.page=null; render(); stars(); }
function restart(){ S.screen = 'welcome'; S.tags = []; S.picked = []; S.qi = 0; S.sheet = null; S.page = null; render(); stars(); }

/* ---------- старт ---------- */
window.S = S; window.LIB = LIB;
S.tags = ['спокойствие','тревога','уверенность'];
buildProgram();
S.tags = [];
S.screen = 'splash';
render();
initPWA();
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

function shConsult(){
  const e = EXPERTS.find(x => x.id === S.sheet.id);
  return `<h2 class="serif" style="font-size:24px;margin:0 0 6px">Заявка на консультацию</h2>
    <p class="small muted" style="margin:0 0 14px">${esc(e.n)} · 50 минут онлайн · ${money(e.price)}</p>
    <input class="field" placeholder="Имя" value="${esc(S.name)}">
    <input class="field" placeholder="Телефон или телеграм">
    <textarea class="field" rows="3" placeholder="С каким запросом приходишь"></textarea>
    <div class="seg">${['утро','день','вечер'].map(t => `<button class="${t===S.slot?'on':''}" onclick="S.slot='${attJs(t)}';render()">${t}</button>`).join('')}</div>
    <button class="btn" onclick="S.sheet=null;render();toast('Заявка отправлена, эксперт свяжется с тобой')">Отправить заявку</button>`;
}

function shWrite(){
  const e = EXPERTS.find(x => x.id === S.sheet.id);
  return `<h2 class="serif" style="font-size:24px;margin:0 0 6px">Написать эксперту</h2>
    <p class="small muted" style="margin:0 0 14px">${esc(e.n)} обычно отвечает в течение суток.</p>
    <textarea class="field" rows="5" placeholder="Твой вопрос"></textarea>
    <button class="btn" onclick="S.sheet=null;render();toast('Сообщение отправлено')">Отправить</button>`;
}

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

  ${MEDIA[d.key] ? `<img class="upprev" src="${MEDIA[d.key]}" alt="">
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
  const x = S.pending.find(i => i.id === S.sheet.id);
  return `<h2 class="serif" style="font-size:22px;margin:0 0 6px">Доработка</h2>
    <div class="card" style="background:var(--surface-2);border:none">
      <div class="small"><b>Комментарий редакции:</b> ${esc(x.comment||'')}</div></div>
    <label class="lbl">Название</label>
    <input class="field" id="ft" value="${esc(x.title)}">
    <label class="lbl">Описание</label>
    <textarea class="field" id="fx" rows="4">${esc(x.text)}</textarea>
    ${MEDIA[x.id] ? `<img class="upprev" src="${MEDIA[x.id]}" alt="">` : ''}
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
  const joined = S.joined.includes(g.id);
  return `<div style="text-align:center">
      <div class="gemoji" style="width:64px;height:64px;font-size:28px;margin:0 auto 10px">${esc(g.e)}</div>
      <h2 class="serif" style="font-size:22px;margin:0 0 4px">${esc(g.t)}</h2>
      <p class="small muted">${g.m.toLocaleString('ru-RU')} участниц</p></div>
    <div class="card" style="margin-top:14px"><b style="font-size:14px">О группе</b>
      <p class="small muted" style="margin:6px 0 0">${esc(g.d)}</p></div>
    <button class="btn ghost" onclick="toast('Уведомления выключены')">Выключить уведомления</button>
    <button class="btn ${joined?'ghost':''}" style="margin-top:9px" onclick="join('${attJs(g.id)}');closeSheet()">
      ${joined ? 'Выйти из группы' : 'Вступить'}</button>`;
}
function shNewGroup(){
  return `<h2 class="serif" style="font-size:22px;margin:0 0 12px">Новая группа</h2>
    <input class="field" placeholder="Название группы">
    <textarea class="field" rows="3" placeholder="О чём она"></textarea>
    <div class="chips wrap">${['🧘‍♀️','🌙','👶','💼','🌸','📖','🏃','🤍'].map(e => `<button class="chip">${e}</button>`).join('')}</div>
    <button class="btn" style="margin-top:12px" onclick="S.sheet=null;render();toast('Группа отправлена на согласование')">Создать</button>`;
}

/* ---------- мероприятия ---------- */
function shEvent(){
  const e = EVENTS.find(x => x.id === S.sheet.id);
  if(!e) return `<div class="empty">Мероприятие не найдено</div>`;
  const going = S.myEvents.includes(e.id);
  const shots = [e.id, ...(e.gallery||[])].filter(k => MEDIA[k]);
  const si = Math.min(S.evSlide || 0, Math.max(0, shots.length-1));
  const isAdm = S.role === 'admin';
  return `${shots.length ? `<div class="gslider" style="margin-bottom:14px">
      <div class="gslide" style="height:190px"><img src="${safeUrl(MEDIA[shots[si]])}" alt=""></div>
      ${shots.length > 1 ? `<button class="gnav left" onclick="slideEv(-1,${shots.length})">‹</button>
        <button class="gnav right" onclick="slideEv(1,${shots.length})">›</button>
        <div class="gdots">${shots.map((_,k) => `<i class="${k===si?'on':''}"></i>`).join('')}</div>` : ''}
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
    <p class="small muted" style="margin:0 0 14px">${esc(e.about)}</p>
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
function slideEv(d, n){ S.evSlide = ((S.evSlide || 0) + d + n) % n; render(); }

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
function evDraft(){
  if(!S.evd) S.evd = {key:'evnew_' + Date.now().toString(36), gallery:[], unlimited:false, kind:'Женский круг', mode:'офлайн'};
  return S.evd;
}
function setEvD(f, v){ evDraft()[f] = v; }
function setEvDR(f, v){ evDraft()[f] = v; render(); }

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
            <img src="${MEDIA[k]}" alt="">
            ${k===key ? '<span class="covlabel">обложка</span>'
              : `<button class="mkcov" onclick="setEvCover('${attJs(k)}')">Сделать обложкой</button>`}
            <button class="phdel" onclick="delEvPhoto('${attJs(k)}')">✕</button>
          </div>`).join('') +
          `<button class="addphoto" onclick="addEvPhoto()"><span class="pl2">＋</span><span class="small">ещё фото</span></button>`;
      })()}
    </div>

    <label class="lbl">Название</label><input class="field" id="ev_t" placeholder="Женский круг «...»">
    <label class="lbl">Тип</label>
    <div class="seg">${['Женский круг','Встреча','Концерт'].map(k =>
      `<button class="${d.kind===k?'on':''}" onclick="chipPick(this,'evd.kind','${attJs(k)}')">${k}</button>`).join('')}</div>
    <div class="g2">
      <div><label class="lbl">Дата</label><input class="field" id="ev_d" type="date"></div>
      <div><label class="lbl">Время</label><input class="field" id="ev_tm" type="time" value="19:00"></div>
    </div>
    <label class="lbl">Формат</label>
    <div class="seg">${['офлайн','онлайн'].map(k =>
      `<button class="${d.mode===k?'on':''}" onclick="setEvDR('mode','${attJs(k)}')">${k}</button>`).join('')}</div>
    <label class="lbl">${d.mode==='онлайн' ? 'Платформа' : 'Город'}</label>
    <input class="field" id="ev_c" placeholder="${d.mode==='онлайн' ? 'Zoom' : 'Москва'}">
    ${d.mode==='офлайн' ? `<label class="lbl">Адрес или место</label>
      <input class="field" id="ev_pl" placeholder="Чистые пруды, студия «Тихая»">` : ''}
    <div class="g2">
      <div><label class="lbl">Цена, ₽</label><input class="field" id="ev_p" type="number" value="0"></div>
      <div><label class="lbl">Мест</label>
        <input class="field" id="ev_s" type="number" value="20" ${d.unlimited?'disabled':''}></div>
    </div>
    <button class="row" style="margin:-2px 0 10px;font-size:13px;font-weight:600" onclick="tgUnlimited(this)">
      <span class="sw ${d.unlimited?'on':''}" style="width:38px;height:22px"><i style="width:16px;height:16px;${d.unlimited?'left:19px':''}"></i></span>
      Места не ограничены</button>
    <label class="lbl">Описание</label><textarea class="field" id="ev_a" rows="3"></textarea>
    <button class="btn" onclick="saveEvent()">${isAdmin ? 'Опубликовать' : 'Отправить на согласование'}</button>`;
}
function tgUnlimited(btn){
  const d = evDraft();
  d.unlimited = !d.unlimited;
  render();
}
function addEvPhoto(){
  const d = evDraft(), gk = d.key + '_g' + Date.now().toString(36);
  pickImage(gk, () => { d.gallery.push(gk); render(); });
}
function setEvCover(gk){
  const d = evDraft(), key = d.key;
  const old = MEDIA[key];
  MEDIA[key] = MEDIA[gk];
  const i = d.gallery.indexOf(gk);
  if(i > -1){ if(old) MEDIA[gk] = old; else d.gallery.splice(i,1); }
  render(); toast('Фото стало обложкой');
}
function delEvPhoto(k){
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
  const t = ($('#ev_t')||{}).value, dt = ($('#ev_d')||{}).value;
  if(!t || !t.trim() || !dt) return toast('Заполни название и дату');
  const seats = dr.unlimited ? 0 : (+($('#ev_s')||{}).value || 20);
  const id = 'ev'+Date.now().toString(36);
  if(MEDIA[dr.key]){ MEDIA[id] = MEDIA[dr.key]; delete MEDIA[dr.key]; }
  const gallery = [];
  (dr.gallery||[]).forEach((gk, i) => {
    const nk = id + '_g' + i;
    if(MEDIA[gk]){ MEDIA[nk] = MEDIA[gk]; delete MEDIA[gk]; gallery.push(nk); }
  });
  EVENTS.unshift({id, t:t.trim(), kind:dr.kind || 'Женский круг', d:dt,
    tm:($('#ev_tm')||{}).value || '19:00', mode:dr.mode || 'офлайн',
    city:($('#ev_c')||{}).value || (dr.mode === 'онлайн' ? 'Zoom' : 'Москва'),
    place:($('#ev_pl')||{}).value || '',
    price:+($('#ev_p')||{}).value || 0,
    by:S.role === 'expert' ? me().n : 'Eva Space',
    seats, left:seats, unlimited:!!dr.unlimited, gallery,
    status:S.role === 'admin' ? 'live' : 'pending',
    about:($('#ev_a')||{}).value || ''});
  S.evd = null; S.sheet = null; syncPush(); render();
  toast(S.role === 'admin' ? 'Мероприятие опубликовано' : 'Отправлено на согласование');
}

function shEventEdit(){
  const x = EVENTS.find(v => v.id === S.sheet.id);
  return `<h2 class="serif" style="font-size:22px;margin:0 0 6px">Мероприятие</h2>
    <p class="small muted" style="margin:0 0 12px">После изменений уйдёт на повторное согласование.</p>
    <label class="lbl">Название</label><input class="field" value="${esc(x.t)}" oninput="setEv('${attJs(x.id)}','t',this.value)">
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
    <label class="lbl">Описание</label>
    <textarea class="field" rows="3" oninput="setEv('${attJs(x.id)}','about',this.value)">${esc(x.about||'')}</textarea>
    <button class="btn ghost" onclick="pickImage('${attJs(x.id)}')">Заменить обложку</button>
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
function shWrite2(){
  const u = allUsers().find(x => x.id === S.sheet.id);
  return `<h2 class="serif" style="font-size:22px;margin:0 0 6px">Написать пользователю</h2>
    <p class="small muted" style="margin:0 0 12px">${esc(u.n)} · ${u.m}</p>
    <label class="lbl">Тема</label><input class="field" id="w_s" value="Eva Space">
    <label class="lbl">Сообщение</label><textarea class="field" id="w_t" rows="5"></textarea>
    <div class="chips wrap">${['Напомнить про пробный период','Предложить скидку 20%','Спросить, что не подошло','Пригласить на мероприятие'].map(t =>
      `<button class="chip" onclick="$('#w_t').value=($('#w_t').value?$('#w_t').value+' ':'')+'${attJs(t)}'">${t}</button>`).join('')}</div>
    <button class="btn" style="margin-top:12px" onclick="S.sheet=null;render();toast('Письмо отправлено на ${u.m}')">Отправить</button>`;
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
function createUser(){
  const n = ($('#nu_n')||{}).value, m = (($('#nu_m')||{}).value||'').trim().toLowerCase();
  if(!n || !n.trim()) return toast('Укажи имя');
  if(!/^[^@\s]+@[^@\s]+\.[a-zа-я]{2,}$/i.test(m)) return toast('Проверь почту');
  if(DB.find(m)) return toast('Такая почта уже есть');
  const access = S.newAccess || 'trial';
  const role = S.newRole || 'user';
  DB.upsert({email:m, name:n.trim(), pass:hashPass(($('#nu_p')||{}).value || 'eva2026'), verified:true,
    role, created:Date.now(), tg:($('#nu_t')||{}).value || '',
    gift:access === 'gift', paid:access === 'paid',
    note:access === 'gift' ? 'Доступ подарен администратором' : ''});

  /* эксперт сразу получает карточку и появляется в переключателе кабинета */
  if(role === 'expert') createExpertProfile(n.trim(), m, ($('#nu_t')||{}).value || '');

  S.sheet = null; syncPush(); render();
  toast(role === 'expert'
    ? 'Эксперт добавлен. Профиль создан, можно выбрать его в кабинете'
    : 'Аккаунт создан. Данные для входа отправлены на ' + m);
}
function shGrant(){
  const u = allUsers().find(x => x.id === S.sheet.id);
  const offers = [
    {k:'gift30', t:'Бесплатный доступ на 30 дней', d:'Подписка без оплаты, потом обычные условия'},
    {k:'gift', t:'Бессрочный бесплатный доступ', d:'Для амбассадоров, партнёров и тестировщиц'},
    {k:'off50', t:'Скидка 50% на первый месяц', d:'1 450 ₽ вместо 2 900 ₽'},
    {k:'trial7', t:'Продлить пробный период до 7 дней', d:'Если не успела попробовать'}
  ];
  return `<h2 class="serif" style="font-size:22px;margin:0 0 6px">Доступ и предложения</h2>
    <p class="small muted" style="margin:0 0 12px">${esc(u.n)} · ${u.m}</p>
    ${offers.map(o => `<button class="card" style="width:100%;text-align:left" onclick="grant('${attJs(u.id)}','${attJs(o.k)}')">
      <b style="font-size:14px">${esc(o.t)}</b>
      <div class="small muted" style="margin-top:3px">${esc(o.d)}</div></button>`).join('')}
    ${u.gift || u.pay === 'paid' ? `<button class="btn ghost" onclick="grant('${attJs(u.id)}','revoke')">Снять доступ</button>` : ''}`;
}
function grant(id, kind){
  const all = DB.users(), k = String(id).toLowerCase();
  const label = {gift30:'Бесплатный доступ на 30 дней', gift:'Бессрочный доступ подарен',
    off50:'Скидка 50% на первый месяц', trial7:'Пробный продлён до 7 дней', revoke:'Доступ снят'}[kind];
  if(all[k]){
    if(kind === 'revoke'){ all[k].gift = false; all[k].paid = false; all[k].offer = ''; }
    else if(kind === 'off50'){ all[k].offer = 'Скидка 50%'; }
    else if(kind === 'trial7'){ all[k].trialDays = 7; }
    else { all[k].gift = true; all[k].paid = true; all[k].offer = label; }
    DB.saveUsers(all);
  } else {
    const u = USERS.find(x => x.id === id);
    if(u){ u.pay = kind === 'revoke' ? 'none' : 'paid'; u.note = (u.note ? u.note + '. ' : '') + label; }
  }
  if(S.user && S.user.email === k && kind !== 'revoke') S.sub.active = true;
  S.sheet = null; render(); toast(label);
}

/* ---------- эксперт: услуги, теги, образование ---------- */
function shExpTags(){
  const e = EXPERTS.find(x => x.id === S.sheet.id);
  const rest = ALL_TAGS.filter(t => !e.t.includes(t));
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
  const x = (e.edu||[]).find(v => v.id === id);
  return `<h2 class="serif" style="font-size:22px;margin:0 0 4px">Проверка документа</h2>
    <p class="small muted" style="margin:0 0 12px">${esc(e.n)} · ${esc(x.t)}${x.y?', '+x.y:''}</p>
    ${MEDIA['cert_'+id]
      ? `<img src="${MEDIA['cert_'+id]}" style="width:100%;border-radius:var(--r);margin-bottom:10px">`
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
function priceStep(v, dir){
  const idx = Math.round((v - 490) / 500);
  const next = Math.max(0, idx + dir);
  return next === 0 ? 0 : 490 + next * 500;
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
  S.datingProfile = {...d};
  S.myInts = d.ints;
  S.matchIdx = 0; S.datingFmt = S.datingFmt || 'кофе';
  S.sheet = null; render(); schedulePersist();
  toast('Анкета сохранена. Подбираем знакомства');
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
function shNewPost(){
  const ints = S.myInts || [];
  return `<h2 class="serif" style="font-size:22px;margin:0 0 6px">Послание участницам</h2>
    <p class="small muted" style="margin:0 0 12px">Расскажи, кого ищешь или что предлагаешь. Коротко и по делу.</p>
    <textarea class="field" id="wp_t" rows="4" placeholder="Ищу с кем поиграть в падел по выходным…"
      oninput="S.postText=this.value">${esc(S.postText||'')}</textarea>
    <div class="chips wrap">${['Ищу компанию','Предлагаю встречу','Хочу поговорить','Ищу подругу по интересам'].map(t =>
      `<button class="chip" onclick="addPostPhrase('${attJs(t)}')">${t}</button>`).join('')}</div>
    <label class="lbl" style="margin-top:10px">Темы послания <span id="pcount" class="muted">${(S.postInts||[]).length?'('+(S.postInts||[]).length+')':''}</span></label>
    <div class="chips wrap">${[...INTERESTS, ...(S.customInts||[])].map(t =>
      `<button class="chip ${(S.postInts||[]).includes(t)?'on':''}" onclick="chipToggle(this,'postInts','${attJs(t)}','#pcount')">${t}</button>`).join('')}</div>
    ${ints.length ? `<div class="small muted" style="margin-top:6px">Твои интересы: ${ints.join(', ')}</div>` : ''}
    <button class="btn" style="margin-top:14px" onclick="sendPost()">Отправить послание</button>
    <p class="small muted" style="text-align:center;margin-top:8px;font-size:11.5px">Увидят все участницы · +5 баллов</p>`;
}
function addPostPhrase(t){
  S.postText = ((S.postText || '') + (S.postText ? ' ' : '') + t + '. ');
  render();
}
function sendPost(){
  const t = ((($('#wp_t')||{}).value) || S.postText || '').trim();
  if(!t) return toast('Напиши хотя бы пару слов');
  WALL.unshift({id:'w'+Date.now().toString(36), a:S.name || 'Я', c:'#111014', ago:'только что',
    city:((S.datingProfile && S.datingProfile.city) || 'Москва'), t, st:0,
    ints:(S.postInts||[]).length ? S.postInts : (S.myInts||[]).slice(0,2), own:true});
  S.points += 5; S.postInts = []; S.postText = ''; S.sheet = null;
  render(); schedulePersist(); syncPush(['wall']); toast('Послание опубликовано. +5 баллов');
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

  S.sheet = null; S.viewGood = null; S.page = 'inbox'; S.thread = th.id;
  render(); schedulePersist(); syncPush(['questions']);
  toast('Вопрос отправлен, ответим в личных сообщениях');
}

/* ---------- настройки ---------- */
function shChangeMail(){
  return `<h2 class="serif" style="font-size:22px;margin:0 0 6px">Изменить почту</h2>
    <p class="small muted" style="margin:0 0 12px">На новый адрес придёт код подтверждения.</p>
    <label class="lbl">Текущая</label>
    <div class="linkbox" style="margin-bottom:10px">${S.user ? esc(S.user.email) : '—'}</div>
    <label class="lbl">Новая почта</label>
    <input class="field" id="nm_mail" type="email" placeholder="you@mail.ru">
    <button class="btn" onclick="changeMail()">Отправить код</button>`;
}
function changeMail(){
  const m = (($('#nm_mail')||{}).value || '').trim().toLowerCase();
  if(!/^[^@\s]+@[^@\s]+\.[a-zа-я]{2,}$/i.test(m)) return toast('Проверь адрес');
  if(DB.find(m)) return toast('Эта почта уже занята');
  S.sheet = null; render(); toast('Код отправлен на ' + m);
}
function shChangePass(){
  return `<h2 class="serif" style="font-size:22px;margin:0 0 6px">Сменить пароль</h2>
    <p class="small muted" style="margin:0 0 12px">После смены на других устройствах придётся войти заново.</p>
    <label class="lbl">Текущий пароль</label><input class="field" id="p_old" type="password">
    <label class="lbl">Новый пароль</label><input class="field" id="p_new" type="password" placeholder="Минимум 6 символов">
    <label class="lbl">Повтори новый</label><input class="field" id="p_rep" type="password">
    <button class="btn" onclick="changePass()">Сохранить</button>`;
}
function changePass(){
  const o = ($('#p_old')||{}).value, n = ($('#p_new')||{}).value, r = ($('#p_rep')||{}).value;
  const u = S.user ? DB.find(S.user.email) : null;
  if(u && u.pass !== hashPass(o)) return toast('Текущий пароль неверный');
  if(!n || n.length < 6) return toast('Новый пароль минимум 6 символов');
  if(n !== r) return toast('Пароли не совпадают');
  if(u){ u.pass = hashPass(n); DB.upsert(u); }
  S.sheet = null; render(); toast('Пароль изменён');
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
  if(typeof INBOX !== 'undefined') INBOX.unshift({id:'t'+Date.now().toString(36), from:S.name||'Пользователь',
    role:'ученица', mail:S.user?S.user.email:'—', ago:'только что',
    sub:S.supTopic || 'Другое', t, st:'новое'});
  S.sheet = null; render(); syncPush(['support']); toast('Отправлено в поддержку');
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
    <button class="btn" onclick="changeExpertPass()">Сохранить</button>`;
}
function changeExpertPass(){
  const o = ($('#xp_old')||{}).value, n = ($('#xp_new')||{}).value, r = ($('#xp_rep')||{}).value;
  const u = S.user ? DB.find(S.user.email) : null;
  if(u && u.pass !== hashPass(o)) return toast('Текущий пароль неверный');
  if(!n || n.length < 6) return toast('Новый пароль минимум 6 символов');
  if(n !== r) return toast('Пароли не совпадают');
  if(u){ u.pass = hashPass(n); DB.upsert(u); }
  S.sheet = null; render(); toast('Пароль изменён');
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


