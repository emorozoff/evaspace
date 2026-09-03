/* =====================================================================
   КУРСЫ: уроки, лендинг, страница обучения
   ===================================================================== */
const LESSON_SETS = {
  k1:[['Знакомство и замер сил','Как понять, на каком ты уровне энергии',9],
      ['Дыхание для восстановления','Базовая техника на каждый день',12],
      ['Тело утром','Мягкая разминка без нагрузки',14],
      ['Где утекает энергия','Аудит дня и три решения',16],
      ['Практика опоры','Возврат в тело за десять минут',11],
      ['Отдых, который восстанавливает','Разница между отдыхом и залипанием',18],
      ['Свой ритм на месяц вперёд','Собираем план, который выдержишь',15]],
  k2:[['Почему не получается медитировать','Разбираем главный миф',11],
      ['Первые пять минут','Самая простая техника',8],
      ['Дыхание как якорь','Что делать, когда мысли не замолкают',12],
      ['Сканирование тела','Практика на 15 минут',15],
      ['Медитация при тревоге','Короткий протокол в моменте',10],
      ['Вечерняя практика','Как заканчивать день',13],
      ['Своя регулярность','Как не бросить на второй неделе',12]],
  k3:[['Кто твой внутренний критик','Откуда он взялся и чей это голос',18],
      ['Разговор с зеркалом','Первая практика самоподдержки',9],
      ['Границы: где я заканчиваюсь','Четыре типа нарушений',22],
      ['Учимся говорить нет','Формулировки, после которых не стыдно',17],
      ['Сравнение с другими','Как выйти из гонки',15],
      ['Своя цена','Про деньги и самооценку',19],
      ['Опора внутри','Итоговая практика',14],
      ['Что дальше','План на три месяца',11]],
  k4:[['Материнская вина','Почему она стала нормой',16],
      ['Пять минут для себя','Практика в реальных условиях',6],
      ['Когда всё раздражает','Что делать с гневом на ребёнка',19],
      ['Просить о помощи','Как договариваться с близкими',15],
      ['Тело после родов','Возвращение без насилия',17],
      ['Я не только мама','Возврат к своим желаниям',14]],
  k5:[['Сколько я стою','Считаем честно',20],
      ['Разговор о цене','Скрипт переговоров',18],
      ['Отказы','Как перестать их бояться',15],
      ['Поднять чек','Пошагово и без паники',22],
      ['Деньги в паре','Общий бюджет без ссор',19],
      ['Финансовая подушка','Простая арифметика',16],
      ['Планы на год','Цели от ценностей',17],
      ['Работа с возражениями','Живые примеры',21],
      ['Итоги и следующий шаг','',12]],
  k6:[['Почему ты не высыпаешься','Разбор причин',14],
      ['Гигиена сна без занудства','Что реально влияет',16],
      ['Йога-нидра','Практика на 20 минут',20],
      ['Тревога перед сном','Протокол на вечер',13],
      ['Утро без будильника-врага','Как просыпаться мягче',12]]
};

function lessonsOf(cid){
  if(!S.lessons[cid]) S.lessons[cid] = (LESSON_SETS[cid]||[]).map(([t,d,m],i) =>
    ({id:cid+'_'+(i+1), n:i+1, t, d, min:m, done:false, video:'', free:i===0||i===3}));
  return S.lessons[cid];
}

function openCourseLanding(id){ S.course = {id, mode:'landing'}; S.sheet = null; S.page = null; render(); window.scrollTo(0,0); }
function openCourseLearn(id, unit){ S.course = {id, mode:'learn', unit:unit || 0}; S.sheet = null; render(); window.scrollTo(0,0); }
function closeCourse(){ S.course = null; render(); window.scrollTo(0,0); }

function pgCourseLanding(){
  const c = COURSES.find(x => x.id === S.course.id);
  const e = expBy(c.e);
  const ls = lessonsOf(c.id);
  const mods = (typeof modulesOf === 'function') ? modulesOf(c.id) : [{n:1,t:'Программа',units:ls.map(l=>l.n)}];
  const own = S.courses.includes(c.id);
  const bonus = Math.min(S.bonus, Math.round(c.p*0.3));
  const total = ls.reduce((a,l) => a + l.min, 0);
  const info = COURSE_INFO[c.id] || {who:[],gives:[],promo:''};
  const rev = REVIEWS[c.id] || [];
  const back = S.demo || S.role === 'user' ? "closeCourse()" : "closeCourse()";
  return `<div class="view pad">
    <button class="backbtn" onclick="${back}">‹ Курсы</button>

    <div class="chead">
      ${cover(c.id,'course')}
      <div class="badge">${COURSE_KIND[c.id]} курс</div>
      <div class="ctext">
        <h1 class="serif" style="font-size:24px;margin:0 0 6px;color:#fff">${esc(c.t)}</h1>
        <p style="font-size:13.5px;line-height:1.45;color:rgba(255,255,255,.82);margin:0">${esc(info.promo || c.d)}</p>
      </div>
    </div>

    <button class="card" style="width:100%;text-align:left;padding:12px" onclick="openExpert('${attJs(e.id)}')">
      <div class="row"><div class="pcirc" style="width:46px;height:46px">${expPic(e)}</div>
        <div style="flex:1"><b style="font-size:14px">${esc(e.n)} ${e.verified?'<span class="vt">✓</span>':''}</b>
          <div class="small muted">${e.r} · ${e.exp} практики</div></div>
        <span class="stars5">★ ${e.rate}</span></div>
    </button>

    <div class="g3" style="margin:12px 0">
      <div class="stat"><b style="font-size:17px">${ls.length}</b><div class="small muted">уроков</div></div>
      <div class="stat"><b style="font-size:17px">${Math.round(total/60*10)/10} ч</b><div class="small muted">видео</div></div>
      <div class="stat"><b style="font-size:17px">${c.s.toLocaleString('ru-RU')}</b><div class="small muted">учениц</div></div>
    </div>

    <div class="sec-h" style="margin-top:16px"><h2 class="serif">О курсе за две минуты</h2></div>
    <div class="promo">${videoBlock(c.id+'_promo','course')}</div>

    <div class="sec-h"><h2 class="serif">Для кого этот курс</h2></div>
    ${info.who.map((w,i) => `<div class="sellcard">
      <div class="num">${i+1}</div><div style="flex:1;font-size:13.5px;line-height:1.45">${esc(w)}</div></div>`).join('')}

    <div class="sellwrap">
      <h3>Что ты получишь</h3>
      ${info.gives.map(w => `<div class="sellcard dark">
        <div class="num">✓</div><div style="flex:1;font-size:13.5px;line-height:1.45">${esc(w)}</div></div>`).join('')}
    </div>

    <div class="sec-h"><h2 class="serif">Программа</h2>
      <span class="small muted">${mods.length} модуля · ${ls.length} уроков</span></div>
    ${mods.map(m => `<div class="modbox">
      <div class="mh"><span>Модуль ${esc(m.n)}. ${esc(m.t)}</span>
        <span class="lockmini">${m.units.length} уроков</span></div>
      <div style="padding:8px">
        ${m.units.map(un => {
          const l = ls.find(x => x.n === un); if(!l) return '';
          const open = own || l.free;
          return `<button class="unit ${l.done?'done':''}" onclick="${open?`openCourseLearn('${attJs(c.id)}',${ls.indexOf(l)})`:`toast('Урок откроется после покупки')`}">
            <div class="n">${l.done?'✓':l.n}</div>
            <div class="mini">${cover(l.id,'practice')}</div>
            <div style="flex:1;min-width:0">
              <b style="font-size:13px;display:block">${esc(l.t)}</b>
              <div class="small muted">${l.d ? esc(l.d)+' · ' : ''}${l.min} мин</div></div>
            ${open ? '<span class="pill free">открыт</span>' : '<span class="lockmini">🔒</span>'}
          </button>`;
        }).join('')}
      </div>
    </div>`).join('')}

    ${rev.length ? `<div class="sec-h"><h2 class="serif">Отзывы</h2>
      <span class="stars5">★ ${c.r} · ${rev.length}</span></div>
      ${rev.map(([who,t,st]) => `<div class="review">
        <div class="spread"><b style="font-size:13px">${who}</b>
          <span class="stars5">${'★'.repeat(st)}</span></div>
        <p class="small muted" style="margin:6px 0 0">${t}</p></div>`).join('')}` : ''}

    <div class="card" style="margin-top:14px">
      <div class="spread"><span class="small muted">Цена</span>
        <div><span class="price" style="font-size:19px">${money(c.p)}</span><span class="old">${money(c.old)}</span></div></div>
      <div class="spread" style="margin-top:8px"><span class="small muted">Списать бонусами</span>
        <b style="color:var(--accent)">−${money(bonus)}</b></div>
      <div class="spread" style="margin-top:8px"><span class="small muted">Доступ</span><b>навсегда</b></div>
      ${own ? `<button class="btn done" style="margin-top:12px" onclick="openCourseLearn('${attJs(c.id)}',0)">Продолжить обучение</button>`
            : `<button class="btn acc" style="margin-top:12px" onclick="buyCourse('${attJs(c.id)}')">Купить за ${money(c.p - bonus)}</button>
               <p class="small muted" style="text-align:center;margin:8px 0 0">Открытые уроки можно посмотреть до покупки</p>`}
    </div>
  </div>`;
}

function pgCourseLearn(){
  const c = COURSES.find(x => x.id === S.course.id);
  const ls = lessonsOf(c.id);
  const i = Math.min(S.course.unit || 0, ls.length-1);
  const l = ls[i];
  const done = ls.filter(x => x.done).length;
  const hwDone = S.homework && S.homework[l.id];
  return `<div class="view pad">
    <button class="backbtn" onclick="openCourseLanding('${attJs(c.id)}')">‹ ${esc(c.t)}</button>

    <div class="eyebrow" style="margin-top:6px">Урок ${esc(l.n)} из ${ls.length} · ${l.min} мин</div>
    <h1 class="serif" style="font-size:23px;margin:7px 0 12px">${esc(l.t)}</h1>

    ${videoBlock(l.id)}

    <div class="card" style="margin-top:12px">
      <b style="font-size:14.5px">Об уроке</b>
      <p class="small muted" style="margin:7px 0 0;white-space:pre-line">${esc(l.d || 'Описание урока появится здесь.')}</p>
    </div>

    ${l.hw ? `<div class="card" style="border-color:${hwDone?'var(--ok)':'var(--line-2)'}">
      <div class="spread">
        <div style="flex:1"><b style="font-size:14.5px">Домашнее задание</b>
          <div class="small muted" style="margin-top:3px">${esc(l.hw.title || 'Практика после урока')}</div></div>
        ${hwDone ? '<span class="pill free">выполнено</span>' : ''}
      </div>
      <button class="btn ${hwDone?'ghost':''}" style="margin-top:10px" onclick="openSheet({k:'hw',id:'${attJs(l.id)}',cid:'${attJs(c.id)}'})">
        ${hwDone ? 'Открыть задание' : 'Открыть задание'}</button>
    </div>` : ''}

    <div class="bar" style="margin:14px 0 6px"><i style="width:${done/ls.length*100}%"></i></div>
    <div class="small muted" style="margin-bottom:12px">Пройдено ${done} из ${ls.length}</div>

    <div class="acts" style="margin-bottom:14px">
      <button class="btn ghost" ${i===0?'disabled':''} onclick="openCourseLearn('${attJs(c.id)}',${i-1})">←</button>
      <button class="btn ${l.done?'done':''}" onclick="doneUnit('${attJs(c.id)}',${i})">${l.done?'✓ Пройден':'Отметить пройденным'}</button>
      <button class="btn ghost" ${i===ls.length-1?'disabled':''} onclick="openCourseLearn('${attJs(c.id)}',${i+1})">→</button>
    </div>

    <div class="sec-h"><h2 class="serif">Все уроки</h2></div>
    ${ls.map((u,k) => {
      const open = S.courses.includes(c.id) || u.free;
      return `<button class="unit ${u.done?'done':''}" style="${k===i?'border-color:var(--ink)':''}"
        onclick="${open?`openCourseLearn('${attJs(c.id)}',${k})`:`toast('Урок откроется после покупки')`}">
        <div class="n">${u.done?'✓':u.n}</div>
        <div style="flex:1;min-width:0"><b style="font-size:13px;display:block">${esc(u.t)}</b>
          <div class="small muted">${u.min} мин${u.hw?' · есть домашнее':''}</div></div>
        ${k===i?'<span class="chip pale">сейчас</span>':open?'<span class="muted">›</span>':'<span class="lockmini">🔒</span>'}
      </button>`;
    }).join('')}
  </div>`;
}

function doneUnit(cid, i){
  const ls = lessonsOf(cid);
  if(ls[i].done) return;
  ls[i].done = true; S.points += 20;
  const all = ls.every(x => x.done);
  render();
  toast(all ? 'Курс пройден полностью. +150 баллов' : '+20 баллов');
  if(all) S.points += 130;
}

/* открытые уроки курсов дополняют мастер-классы, когда библиотека исчерпана */
function openCourseLessons(){
  const out = [];
  COURSES.filter(c => !c.draft).forEach(c => {
    (lessonsOf(c.id) || []).filter(l => l.free).forEach(l => {
      out.push({
        id:'cl_' + l.id, type:'class', title:l.t, text:(l.d || 'Открытый урок курса «' + c.t + '»'),
        expert:c.e, min:l.min || 15, tags:(COURSE_TAGS[c.id] || []), status:'live', free:true,
        video:l.video || '', fromCourse:c.id, aud:[], level:'any'
      });
    });
  });
  return out;
}

/* ---------- мероприятия ---------- */
const EVENTS = [
  {id:'ev1', t:'Женский круг «Возвращение к себе»', kind:'Женский круг', d:'2026-08-14', tm:'19:00',
   mode:'офлайн', city:'Москва', place:'Чистые пруды', price:2500, by:'Ксения Роот', seats:12, left:4, status:'live',
   about:'Три часа в кругу женщин: разговор, практика и время, когда никто ничего от тебя не хочет.'},
  {id:'ev2', t:'Утренняя йога в парке', kind:'Встреча', d:'2026-08-09', tm:'08:30',
   mode:'офлайн', city:'Москва', place:'Коломенское', price:0, by:'Алина Ветрова', seats:30, left:11, status:'live',
   about:'Мягкая практика на траве, коврики свои. После - завтрак для тех, кто останется.'},
  {id:'ev3', t:'Концерт поющих чаш', kind:'Концерт', d:'2026-08-21', tm:'20:00',
   mode:'офлайн', city:'Санкт-Петербург', place:'лофт «Тихая»', price:1800, by:'Марина Ясная', seats:60, left:23, status:'live',
   about:'Час звука лёжа. Приходи в удобной одежде, плед выдадим.'},
  {id:'ev4', t:'Встреча мам «Без вины»', kind:'Встреча', d:'2026-08-16', tm:'11:00',
   mode:'онлайн', city:'Zoom', place:'', price:0, by:'Тая Мирная', seats:100, left:57, status:'live',
   about:'Полтора часа разговора о материнстве без советов и оценок. Можно с ребёнком на руках.'},
  {id:'ev5', t:'Мастермайнд «Своё дело»', kind:'Встреча', d:'2026-08-28', tm:'19:30',
   mode:'онлайн', city:'Zoom', place:'', price:3500, by:'Ольга Светлова', seats:15, left:6, status:'pending',
   about:'Разбор трёх проектов участниц: цены, воронка, следующий шаг.'}
];
const MON = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
function evDate(d){ const x = new Date(d); return {d:x.getDate(), m:MON[x.getMonth()]}; }

function pgEvents(){
  const mode = S.evMode || 'все';
  let list = EVENTS.filter(e => e.status === 'live' || S.role === 'admin');
  if(mode !== 'все') list = list.filter(e => e.mode === mode);
  if(S.evCity && S.evCity !== 'все') list = list.filter(e => e.city === S.evCity);
  const cities = ['все', ...new Set(EVENTS.filter(e => e.mode === 'офлайн').map(e => e.city))];
  const mine = EVENTS.filter(e => S.myEvents.includes(e.id));

  return `
  <div class="seg">${['все','офлайн','онлайн'].map(k =>
    `<button class="${mode===k?'on':''}" onclick="S.evMode='${attJs(k)}';render()">${k}</button>`).join('')}</div>
  ${mode !== 'онлайн' ? `<select class="field regionsel" onchange="S.evCity=this.value;render()">
    ${cities.map(c => `<option value="${c}" ${(S.evCity||'все')===c?'selected':''}>${c === 'все' ? 'Все регионы' : c}</option>`).join('')}
  </select>` : ''}

  ${list.length ? `<div class="carousel">${list.map(e => evCard(e)).join('')}</div>
    <div class="small muted" style="margin:2px 0 14px;text-align:center">${plural(list.length,'мероприятие','мероприятия','мероприятий')} · листай вбок</div>`
    : '<div class="empty">По этим фильтрам ничего нет</div>'}

  ${mine.length ? `<div class="sec-h" style="margin-top:6px"><h2 class="serif" style="font-size:18px">Я иду</h2></div>
    ${mine.map(e => `<button class="gitem" onclick="openSheet({k:'event',id:'${attJs(e.id)}'})">
      <div class="gemoji">${e.mode === 'онлайн' ? '⌘' : '◈'}</div>
      <div style="flex:1;min-width:0"><b style="font-size:13.5px">${esc(e.t)}</b>
        <div class="small muted">${new Date(e.d).toLocaleDateString('ru-RU',{day:'numeric',month:'long'})}, ${esc(e.tm)} · ${esc(e.city)}</div></div>
      <span class="chip pale">${e.price?'билет':'запись'}</span></button>`).join('')}` : ''}

  ${S.role === 'expert' ? `<button class="btn ghost" style="margin-top:8px" onclick="openSheet('newEvent')">Предложить мероприятие</button>` : ''}
  ${S.role === 'admin' ? `<button class="btn" style="margin-top:8px" onclick="openSheet('newEvent')">＋ Добавить мероприятие</button>` : ''}`;
}

function evCard(e){
  const dt = evDate(e.d), going = S.myEvents.includes(e.id);
  return `<div class="evcard">
    <div class="ph" onclick="openSheet({k:'event',id:'${attJs(e.id)}'})">
      ${cover(e.id, e.kind === 'Концерт' ? 'class' : 'practice')}
      <div class="when"><b>${esc(dt.d)}</b><span>${esc(dt.m)}</span></div>
      <div class="evtags">
        <span class="evtag">${e.mode}</span>
        <span class="evtag">${e.price ? money(e.price) : 'бесплатно'}</span>
      </div>
      ${e.status === 'pending' ? '<div class="flag" style="top:auto;bottom:8px">на модерации</div>' : ''}
    </div>
    <div style="padding:12px">
      <div class="eyebrow">${esc(e.kind)} · ${esc(e.tm)}</div>
      <b style="font-size:14.5px;display:block;margin:5px 0 4px;line-height:1.25">${esc(e.t)}</b>
      <div class="small muted">${esc(e.mode === 'онлайн' ? 'Онлайн · ' + e.city : e.city + (e.place ? ', ' + e.place : ''))}</div>
      <div class="small muted" style="margin-top:2px">${esc(e.by)} · ${plural(e.left,'место','места','мест')} свободно</div>
      <button class="btn sm ${going?'done':'acc'}" style="width:100%;margin-top:10px"
        onclick="event.stopPropagation();goEvent('${attJs(e.id)}')">
        ${going ? '✓ Я иду, отменить' : e.price ? 'Купить билет' : 'Записаться'}</button>
    </div>
  </div>`;
}

function goEvent(id){
  const e = EVENTS.find(x => x.id === id);
  if(!e) return;
  if(S.myEvents.includes(id)){
    S.myEvents = S.myEvents.filter(x => x !== id);
    e.left = Math.min(e.seats, e.left + 1);
    S.points = Math.max(0, S.points - 10);
    render(); schedulePersist(); syncPush(['events']);
    return toast('Запись отменена, место освободилось');
  }
  if(e.left <= 0) return toast('Мест не осталось');
  S.myEvents.push(id);
  e.left = Math.max(0, e.left - 1);
  S.points += 10;
  render(); schedulePersist(); syncPush(['events']);
  toast(e.price
    ? `Билет забронирован. Осталось ${plural(e.left,'место','места','мест')}`
    : `Записала. Осталось ${plural(e.left,'место','места','мест')}`);
}

/* ---------- участницы и знакомства ---------- */
const WALL = [
  {id:'w1', a:'Ирина', c:'#6C5CE0', ago:'2 ч назад', city:'Москва',
   t:'Ищу с кем поиграть в падел по выходным. Уровень начинающий, корт в Лужниках, ракетка есть.', st:12, ints:['падел'],
   comments:[{a:'Света', c:'#3F7D62', t:'Я начинающая, тоже ищу пару. Напиши мне', ago:'1 ч назад'}]},
  {id:'w2', a:'Настя', c:'#A8375C', ago:'4 ч назад', city:'Москва',
   t:'Хочу утренние медитации вдвоём по видео. В 7:00, двадцать минут, без разговоров - просто вместе.', st:23, ints:['медитация']},
  {id:'w3', a:'Юля', c:'#3F7D62', ago:'вчера', city:'Онлайн',
   t:'Живу в Тбилиси, скучаю по русскому общению. Готова созваниваться и болтать о книгах и жизни.', st:31, ints:['книги','языки']},
  {id:'w4', a:'Даша', c:'#B8894A', ago:'вчера', city:'Екатеринбург',
   t:'В субботу иду в горы, есть место в машине. Маршрут лёгкий, часа четыре с привалом.', st:18, ints:['горы']},
  {id:'w5', a:'Лена', c:'#111014', ago:'2 дня назад', city:'Москва',
   t:'Мамы с малышами до двух лет, давайте гулять вместе по будням. Парк Горького или Сокольники.', st:27, ints:['материнство']}
];

function pgMembers(){
  const wall = WALL;
  const prof = S.datingProfile;
  return `
  ${prof ? datingBlock() : `
    <div class="card" style="background:linear-gradient(150deg,#F3EFFA,#FBF1F4);border-color:transparent">
      <b style="font-size:16px">Новые знакомства</b>
      <p class="small muted" style="margin:7px 0 12px">Заполни короткую анкету - и Ева начнёт подбирать женщин
        с похожими интересами. Можно встретиться на кофе в своём городе или познакомиться онлайн.</p>
      <button class="btn" onclick="openSheet('dating')">Найти подруг</button>
    </div>`}

  <div class="sec-h"><h2 class="serif" style="font-size:18px">Послания</h2>
    <span class="small muted">${WALL.length}</span></div>
  <button class="wallstart" onclick="openSheet('newPost')">
    ${chatAva(S.name, 'var(--ink)', true, 34)}
    <span>Напиши послание: ищу с кем поиграть в падел…</span>
    <span class="wsend">Написать</span>
  </button>


  ${wall.map(w => {
    const liked = (S.starred||[]).includes(w.id);
    return `<div class="wallpost">
      <div class="row" style="align-items:center;margin-bottom:9px">
        ${chatAva(w.a, w.c, !!w.own, 38, w.email)}
        <div style="flex:1;min-width:0">
          <b style="font-size:14px;display:block">${esc(w.a)}${w.own?' · ты':''}</b>
          <span class="small muted" style="font-size:11px">${esc(w.city)} · ${esc(w.ago)}</span>
        </div>
      </div>
      <p style="margin:0 0 10px;font-size:14px;line-height:1.5">${esc(w.t)}</p>
      <div class="chips wrap" style="padding:0 0 10px">${w.ints.map(t =>
        `<span class="chip pale" style="padding:3px 9px;font-size:10.5px">${t}</span>`).join('')}</div>
      <div class="wallfoot">
        <div class="row" style="gap:7px">
          <button class="btn xs" onclick="replyWall('${attJs(w.id)}')">Познакомиться</button>
          <button class="cmtbtn" onclick="toggleComments('${attJs(w.id)}')">
            💬 ${(w.comments||[]).length || ''}</button>
        </div>
        <button class="starbtn ${liked?'on':''}" onclick="starPost('${attJs(w.id)}')">
          ${starMark(16, liked ? '#E7A339' : 'rgba(17,16,20,.22)')}
          <span>${w.st + (liked?1:0)}</span>
        </button>
      </div>
      ${(S.openCmts||[]).includes(w.id) ? `
        <div class="cmts">
          ${(w.comments||[]).map(c => `<div class="cmt ${c.own?'own':''}">
            ${chatAva(c.a, c.c, !!c.own, 28, c.email)}
            <div style="flex:1;min-width:0">
              <div class="row" style="gap:6px">
                <b style="font-size:12.5px;color:${c.own ? 'var(--accent)' : 'var(--ink)'}">${esc(c.a)}${c.own?' · ты':''}</b>
                ${c.curator ? '<span class="badge-cur">куратор</span>' : ''}
                <span class="small muted" style="font-size:10px;margin-left:auto">${esc(c.ago)}</span></div>
              <div style="font-size:13px;line-height:1.45;margin-top:3px">${esc(c.t)}</div>
            </div>
          </div>`).join('') || '<div class="small muted" style="padding:4px 0 8px">Пока никто не ответил. Будь первой</div>'}
          <div class="row" style="gap:7px;margin-top:6px">
            <input class="field" style="margin:0;flex:1;padding:9px 12px;font-size:13px" id="cm_${w.id}"
              placeholder="Ответить" onkeydown="if(event.key==='Enter')addComment('${attJs(w.id)}')">
            <button class="btn sm" onclick="addComment('${attJs(w.id)}')">→</button>
          </div>
        </div>` : (w.comments||[]).length ? `
        <button class="cmtpeek" onclick="toggleComments('${attJs(w.id)}')">
          ${chatAva(w.comments[0].a, w.comments[0].c, !!w.comments[0].own, 22, w.comments[0].email)}
          <span><b>${esc(w.comments[0].a)}:</b> ${esc(w.comments[0].t.slice(0,38))}${w.comments[0].t.length>38?'…':''}</span>
          ${w.comments.length > 1 ? `<span class="cmtmore">ещё ${w.comments.length - 1}</span>` : ''}
        </button>` : ''}
    </div>`;
  }).join('')}`;
}

/* ---------- знакомства ---------- */
/* пока анкета не опубликована — показываем её в том же виде, в котором увидят другие */
function myProfileCard(){
  const p = S.datingProfile;
  const age = S.birth.date ? Math.floor((Date.now() - new Date(S.birth.date))/31557600000) : null;
  return `
  <div class="card" style="padding:14px">
    <b style="font-size:16px">Твоя анкета готова</b>
    <p class="small muted" style="margin:6px 0 12px">Так тебя увидят другие участницы. Проверь и опубликуй -
      после этого начнём подбирать знакомства.</p>
    <div class="mcard myprofile">
      <div class="mphoto">${myAvatar()
        ? `<img src="${myAvatar()}" alt="">`
        : `<div style="width:100%;height:100%;display:grid;place-items:center;background:var(--surface-2)">
            <div style="text-align:center;padding:20px">
              <div class="dot-ava" style="width:64px;height:64px;font-size:24px;margin:0 auto 10px;background:var(--ink)">${esc((S.name||'Я')[0])}</div>
              <button class="btn ghost sm" onclick="pickAvatar()">Добавить фото</button>
              <div class="small muted" style="margin-top:6px">С фото откликаются в разы чаще</div>
            </div></div>`}
        <div class="mname"><b>${esc(S.name||'Ты')}${age ? ', ' + age : ''}</b>
          <span>${esc(p.city || 'город не указан')}${p.goal ? ' · ' + p.goal : ''}</span></div>
      </div>
      <div style="padding:14px">
        <p style="margin:0 0 10px;font-size:14px;line-height:1.5">${esc(p.about || 'Расскажи пару слов о себе - это поможет найти близких по духу')}</p>
        <div class="eyebrow" style="margin-bottom:6px">Интересы</div>
        <div class="chips wrap" style="padding:0">${(p.ints||[]).map(t => `<span class="chip pale" style="padding:4px 10px">${esc(t)}</span>`).join('')}</div>
      </div>
    </div>
    <div class="draftbar">
      <button class="btn ghost" style="flex:1" onclick="openSheet('dating')">Редактировать</button>
      <button class="btn" style="flex:1" onclick="publishProfile()">Опубликовать</button>
    </div>
  </div>`;
}
function publishProfile(){
  S.datingProfile.published = true;
  S.matchIdx = 0;
  render(); schedulePersist();
  toast(myAvatar() ? 'Анкета опубликована. Подбираем знакомства' : 'Опубликовано. С фото откликаются чаще - добавь позже');
}
function datingBlock(){
  const p = S.datingProfile;
  if(!p.published) return myProfileCard();
  const fmt = S.datingFmt || 'кофе';
  const pool = matchPool(fmt);
  const idx = Math.min(S.matchIdx || 0, Math.max(0, pool.length-1));
  const m = pool[idx];
  return `
  <div class="card" style="padding:14px">
    <div class="spread" style="margin-bottom:10px">
      <b style="font-size:16px">Новые знакомства</b>
      <button class="chip" onclick="openSheet('dating')">Анкета</button>
    </div>
    <div class="seg" style="margin-bottom:12px">
      <button class="${fmt==='кофе'?'on':''}" onclick="setFmt('кофе')">Кофе в моём городе</button>
      <button class="${fmt==='онлайн'?'on':''}" onclick="setFmt('онлайн')">Знакомство онлайн</button>
    </div>

    ${m ? `<div class="mcard">
      <div class="mphoto">${MEDIA[m.id] ? `<img src="${MEDIA[m.id]}" alt="">` : portrait(m.id)}
        <div class="mname">
          <b>${esc(m.n)}, ${m.age}</b>
          <span>${fmt === 'кофе' ? m.city : m.city === 'Онлайн' ? 'онлайн' : m.city + ' · онлайн'}</span>
        </div>
      </div>
      <div style="padding:14px">
        <p style="margin:0 0 10px;font-size:14px;line-height:1.5">${m.bio}</p>
        <div class="eyebrow" style="margin-bottom:6px">Интересы</div>
        <div class="chips wrap" style="padding:0">${m.ints.map(t =>
          `<span class="chip ${(p.ints||[]).includes(t)?'on':'pale'}" style="padding:4px 10px">${t}</span>`).join('')}</div>
        ${common(m).length ? `<div class="small" style="color:var(--ok);margin-top:8px;font-weight:600">
          Совпадение: ${common(m).join(', ')}</div>` : ''}
        <div class="acts">
          <button class="btn" onclick="inviteMatch('${attJs(m.id)}')">Позвать ${fmt === 'кофе' ? 'на кофе' : 'познакомиться'}</button>
          <button class="btn ghost" onclick="nextMatch()">Следующая</button>
        </div>
      </div>
    </div>
    <div class="small muted" style="text-align:center;margin-top:8px">${idx+1} из ${pool.length}</div>`
    : `<div class="empty">В этом формате пока никого нет. Попробуй другой формат или добавь интересы в анкету.</div>`}
  </div>`;
}
function common(m){
  const mine = (S.datingProfile && S.datingProfile.ints) || [];
  return m.ints.filter(t => mine.includes(t));
}
function matchPool(fmt){
  let pool = MEMBERS.filter(m => fmt === 'онлайн' || m.city !== 'Онлайн');
  if(fmt === 'кофе' && S.datingProfile && S.datingProfile.city){
    const same = pool.filter(m => m.city === S.datingProfile.city);
    if(same.length) pool = same;
  }
  return pool.slice().sort((a,b) => {
    const photo = (MEDIA[b.id] ? 1 : 0) - (MEDIA[a.id] ? 1 : 0);
    if(photo) return photo;
    return common(b).length - common(a).length;
  });
}
function setFmt(f){ S.datingFmt = f; S.matchIdx = 0; render(); }
function nextMatch(){
  const pool = matchPool(S.datingFmt || 'кофе');
  S.matchIdx = ((S.matchIdx || 0) + 1) % Math.max(1, pool.length);
  render();
}
function inviteMatch(id){
  const m = MEMBERS.find(x => x.id === id);
  const fmt = S.datingFmt || 'кофе';
  sendInvite(m, fmt);
  S.points += 5;
  nextMatch();
}

/* создаёт переписку у себя и «входящее» приглашение для демонстрации ответа */
function sendInvite(m, fmt){
  initInbox();
  const now = new Date();
  const tm = String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  const text = fmt === 'кофе'
    ? `Привет! Увидела твою анкету, у нас общие интересы. Давай выпьем кофе в ${(S.datingProfile&&S.datingProfile.city)||'городе'}?`
    : 'Привет! Увидела твою анкету, у нас общие интересы. Давай познакомимся онлайн?';
  let t = S.inbox.find(x => x.who === m.id);
  if(!t){
    t = {id:'inv'+Date.now().toString(36), from:m.n, who:m.id, c:'#6C5CE0', kind:'знакомство',
         ago:'только что', unread:false, msgs:[]};
    S.inbox.unshift(t);
  }
  t.msgs.push({me:true, t:text, tm});
  S.thread = t.id; S.page = 'inbox'; S.clubTab = 'people';
  render(); schedulePersist();
  toast('Приглашение отправлено ' + m.n);
  setTimeout(() => {
    t.msgs.push({me:false, t:'Привет! С удовольствием. Когда тебе удобно?', tm, invite:true});
    if(S.thread === t.id) render(); else { t.unread = true; render(); }
  }, 2200);
}

/* входящее приглашение с кнопками */
function seedIncomingInvite(){
  initInbox();
  if(S.inbox.some(t => t.pending)) return;
  const now = new Date();
  S.inbox.unshift({id:'in'+Date.now().toString(36), from:'Даша', c:'#3F7D62', kind:'приглашение',
    ago:'5 мин назад', unread:true, pending:true,
    msgs:[{me:false, t:'Привет! Я в субботу иду в горы, есть место в машине. Маршрут лёгкий. Пойдёшь?',
      tm:String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0')}]});
}
function answerInvite(id, yes){
  const t = S.inbox.find(x => x.id === id);
  const now = new Date();
  const tm = String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  t.pending = false;
  t.msgs.push({me:true, t: yes ? 'Да, с удовольствием! Давай договоримся о времени.' : 'Спасибо за приглашение, но в этот раз не смогу.', tm});
  if(yes) S.points += 10;
  render(); schedulePersist();
  toast(yes ? 'Приглашение принято. +10 баллов' : 'Приглашение отклонено');
  if(yes) setTimeout(() => {
    t.msgs.push({me:false, t:'Отлично! Выезжаем в 8 утра от метро, скину точку.', tm});
    if(S.thread === t.id) render();
  }, 1600);
}

function tgInt(btn, t){
  S.myInts = S.myInts || [];
  const on = S.myInts.includes(t);
  S.myInts = on ? S.myInts.filter(x => x !== t) : [...S.myInts, t];
  btn.classList.toggle('on', !on);
}
function toggleComments(id){
  S.openCmts = S.openCmts || [];
  S.openCmts = S.openCmts.includes(id) ? S.openCmts.filter(x => x !== id) : [...S.openCmts, id];
  render();
}
function addComment(id){
  const inp = document.getElementById('cm_' + id);
  const v = inp ? inp.value.trim() : '';
  if(!v) return toast('Напиши ответ');
  const w = WALL.find(x => x.id === id);
  if(!w) return;
  w.comments = w.comments || [];
  w.comments.push({a:S.role === 'admin' ? (S.adminName || 'Куратор') : (S.name || 'Я'),
    c:'#111014', t:v, ago:'только что', own:true, curator:S.role === 'admin',
    email:S.user ? S.user.email : ''});
  S.points += 3;
  render(); schedulePersist(); syncPush(['wall']);
  toast('Комментарий добавлен. +3 балла');
}

function starPost(id){
  S.starred = S.starred || [];
  const on = S.starred.includes(id);
  S.starred = on ? S.starred.filter(x => x !== id) : [...S.starred, id];
  render(); schedulePersist();
  if(!on) toast('Звезда отправлена');
}

/* =====================================================================
   СООБЩЕСТВА: чаты
   ===================================================================== */
const CHAT_SEED = {
  gr1:[['Ирина','#3F7D62',"Девочки, седьмой день подряд на коврике. Раньше максимум было два.",'09:12'],
       ['Алина Ветрова','#A8375C',"Ирина, поздравляю. Если появится ощущение «уже легко» — не увеличивай время, увеличь внимание.",'09:31',1],
       ['Камила','#6C5CE0',"А коврик 6 мм не слишком мягкий для баланса?",'10:02'],
       ['Ирина','#3F7D62',"Мне норм, но для баланса действительно лучше 4 мм",'10:14']],
  gr2:[['Настя','#B8894A',"Третий день делаю «5 минут для мамы», пока сын спит. Вечером реально спокойнее.",'08:40'],
       ['Тая Мирная','#A8375C',"Настя, это и работает: важна не длительность, а регулярность. Нервной системе нужен повторяющийся сигнал безопасности.",'09:05',1],
       ['Лена','#6C5CE0',"А если ребёнок не спит днём вообще? У нас так уже месяц",'09:20'],
       ['Тая Мирная','#A8375C',"Лена, тогда встраивай в момент, когда он занят игрой рядом. Пять минут не требуют тишины.",'09:44',1]],
  gr3:[['Марина Ясная','#A8375C',"Сегодня в 21:00 общая медитация в эфире. Подключайтесь, кто может.",'12:00',1],
       ['Оля','#3F7D62',"Буду!",'12:14']],
  gr4:[['Света','#6C5CE0',"Подняла чек на 40%. Ушёл один клиент, пришло трое.",'11:02'],
       ['Ольга Светлова','#A8375C',"Света, отличный результат. Скинь потом, как строила разговор — разберём на примере.",'11:30',1]],
  gr5:[['Юля','#B8894A',"28 неделя, тревожно перед родами. Кто как справлялся?",'10:11'],
       ['Тая Мирная','#A8375C',"Юля, тревога на этом сроке нормальна. Помогает план на роды: не идеальный сценарий, а список того, что ты можешь контролировать.",'10:35',1]],
  gr6:[['Даша','#3F7D62',"Кто-нибудь отслеживает цикл в приложении? Совпадает с ощущениями?",'13:20'],
       ['Ника','#6C5CE0',"У меня да, особенно лютеиновая — как по учебнику",'13:41']]
};

function initChats(){
  if(S.chats) return;
  S.chats = {};
  GROUPS.forEach(g => {
    S.chats[g.id] = (CHAT_SEED[g.id]||[]).map(([a,c,t,tm,exp]) => ({a,c,t,tm,exp:!!exp,own:false}));
  });
  S.chat = {open:null, unread:{gr2:2, gr3:1}};
}

function pgClub(){
  initChats();
  const mine = GROUPS.filter(g => S.joined.includes(g.id));
  const rest = GROUPS.filter(g => !S.joined.includes(g.id));
  const last = id => { const m = S.chats[id]; return m && m.length ? m[m.length-1] : null; };
  const row = (g, joined) => {
    const l = last(g.id), un = (S.chat.unread||{})[g.id];
    return `<button class="gitem" onclick="${joined?`openChat('${attJs(g.id)}')`:`join('${attJs(g.id)}');openChat('${attJs(g.id)}')`}">
      <div class="gemoji">${esc(g.e)}</div>
      <div style="flex:1;min-width:0">
        <div class="spread"><b style="font-size:14px">${esc(g.t)}</b>
          <span class="small muted" style="font-size:10.5px">${l?l.tm:''}</span></div>
        <div class="small muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px">
          ${l ? `${esc(l.a)}: ${esc(l.t)}` : g.m.toLocaleString('ru-RU') + ' участниц'}</div>
      </div>
      ${un ? `<span class="unreadc">${un}</span>` : joined ? '' : '<span class="chip pale">войти</span>'}
    </button>`;
  };
  const tab = S.clubTab || 'groups';
  return `<div class="view pad" style="padding-top:calc(18px + env(safe-area-inset-top))">
    <div class="spread">
      <div><div class="eyebrow">Сообщество</div>
        <h1 class="serif" style="font-size:26px;margin:6px 0 0">${tab==='groups'?'Группы':tab==='events'?'Мероприятия':'Участницы'}</h1></div>
      ${tab==='groups' ? `<button class="chip" onclick="openSheet('newGroup')">＋ Создать</button>` : ''}
    </div>
    <div class="seg" style="margin-top:12px">
      <button class="${tab==='groups'?'on':''}" onclick="S.clubTab='groups';render()">Группы</button>
      <button class="${tab==='events'?'on':''}" onclick="S.clubTab='events';render()">Мероприятия</button>
      <button class="${tab==='people'?'on':''}" onclick="S.clubTab='people';render()">Участницы</button>
    </div>
    ${tab === 'people' ? pgMembers() : tab === 'events' ? `
      <p class="small muted" style="margin:0 0 12px">Женские круги, встречи, концерты и практики офлайн и онлайн.
        ${S.myEvents.length ? 'Ты записана на ' + plural(S.myEvents.length,'мероприятие','мероприятия','мероприятий') + '.' : ''}</p>
      ${pgEvents()}`
    : `
      <p class="small muted" style="margin:0 0 12px">Переписка как в мессенджере. Эксперты отвечают внутри своих групп.</p>
      ${mine.length ? `<div class="eyebrow" style="margin-bottom:8px">Мои группы</div>${mine.map(g => row(g,true)).join('')}` : ''}
      <div class="eyebrow" style="margin:16px 0 8px">Все группы</div>
      ${rest.map(g => row(g,false)).join('')}`}
  </div>`;
}

function openChat(id){ initChats(); S.chat.open = id; (S.chat.unread||{})[id] = 0; render(); scrollChat(); }
function closeChat(){ S.chat.open = null; render(); window.scrollTo(0,0); }

function pgChatRoom(){
  const g = GROUPS.find(x => x.id === S.chat.open);
  const msgs = S.chats[g.id] || [];
  return `<div class="view">
    <div class="hero chathead" style="padding-bottom:14px;border-radius:0 0 var(--r) var(--r)">
      <div class="brandbar" style="margin:0">
        <button onclick="closeChat()" style="color:#fff;font-size:20px;width:30px;text-align:left">‹</button>
        <div class="row" style="flex:1;justify-content:center">
          <div class="gemoji" style="width:32px;height:32px;font-size:15px;background:rgba(255,255,255,.12)">${esc(g.e)}</div>
          <div><div style="font-size:14px;font-weight:700">${esc(g.t)}</div>
            <div class="small muted" style="font-size:10.5px">${g.m.toLocaleString('ru-RU')} участниц${S.role==='admin'?' · модерация':''}</div></div>
        </div>
        <button class="chip" style="background:rgba(255,255,255,.12);color:#fff;border-color:transparent"
          onclick="openSheet({k:'groupInfo',id:'${attJs(g.id)}'})">···</button>
      </div>
    </div>
    <div class="pad">
      <div class="chatlist" id="clist">
        ${msgs.map((m,i) => `<div class="cmsg ${m.own?'own':''}">
          ${!m.own ? chatAva(m.a, m.c, false, 32, m.email) : ''}
          <div class="txt">
            ${!m.own ? `<div class="nm">${esc(m.a)}${m.exp?' <span class="badge-exp">эксперт</span>':''}${m.curator?' <span class="badge-cur">куратор</span>':''}</div>` : ''}
            ${esc(m.t)}
            <div class="tm">${esc(m.tm)}${S.role==='admin'&&!m.own?` · <span onclick="delMsg('${attJs(g.id)}',${i})" style="cursor:pointer;color:var(--accent)">удалить</span>`:''}</div>
          </div>
        </div>`).join('')}
      </div>
      <div class="chatbar">
        <input class="field" id="cin" placeholder="Сообщение" onkeydown="if(event.key==='Enter')sendMsg('${attJs(g.id)}')">
        <button class="btn" style="width:auto;padding:12px 16px;border-radius:999px" onclick="sendMsg('${attJs(g.id)}')">→</button>
      </div>
    </div>
  </div>`;
}

/* аватар автора: своё фото у себя, буква у остальных */
function chatAva(name, color, own, size, email){
  const s = size || 32;
  if(own && S.role === 'admin' && S.adminAvatar) return avaImg(S.adminAvatar, s);
  if((name === 'Куратор' || name === S.adminName) && S.adminAvatar) return avaImg(S.adminAvatar, s);
  if(own){
    const mine = myAvatar();
    if(mine) return avaImg(mine, s);
  }
  if(email){
    const src = avatarOf(email);
    if(src) return avaImg(src, s);
  }
  const initials = String(name || '?').split(' ').map(w => w[0]).join('').slice(0,2);
  return `<div class="dot-ava" style="width:${s}px;height:${s}px;background:${safeColor(color)}">${esc(initials)}</div>`;
}

function sendMsg(gid){
  const inp = $('#cin'); if(!inp) return;
  const t = inp.value.trim(); if(!t) return;
  const now = new Date();
  const tm = String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  S.chats[gid].push({a: S.role === 'admin' ? (S.adminName || 'Куратор') : (S.name || 'Я'),
    c:'#111014', t, tm, own:true, curator: S.role === 'admin',
    email:S.user ? S.user.email : ''});
  S.points += 5;
  render(); scrollChat(); toast('+5 баллов за участие');
  setTimeout(() => {
    const g = GROUPS.find(x => x.id === gid);
    const ex = EXPERTS[hash(gid) % EXPERTS.length];
    const replies = [
      'Спасибо, что написала. Ты не одна с этим - в группе многие проходили похожее.',
      'Хороший вопрос. Начни с самого малого шага, остальное подтянется.',
      'Отмечу это на ближайшем эфире, разберём подробнее.'
    ];
    S.chats[gid].push({a:ex.n, c:'#A8375C', t:replies[hash(t) % replies.length], tm, exp:true, own:false});
    if(S.chat.open === gid){ render(); scrollChat(); } else { S.chat.unread[gid] = (S.chat.unread[gid]||0)+1; }
  }, 1600);
}
function delMsg(gid, i){ S.chats[gid].splice(i,1); render(); toast('Сообщение удалено'); }
function scrollChat(){ setTimeout(() => { const l = $('#clist'); if(l) window.scrollTo(0, document.body.scrollHeight); }, 60); }

/* =====================================================================
   ЛИЧНЫЕ СООБЩЕНИЯ ПОЛЬЗОВАТЕЛЯ
   ===================================================================== */
function initInbox(){
  if(S.inbox && S.inbox.length) return;
  if(S.inbox) { seedInbox(); return; }
  seedInbox();
}
function seedInbox(){
  const base = [
    {id:'p1', from:'Ирина', c:'#6C5CE0', kind:'знакомство', ago:'1 ч назад', unread:true,
     msgs:[{me:false, t:'Привет! Увидела твоё послание про пробежки. Я как раз бегаю в Сокольниках по средам, давай вместе?', tm:'09:20'}]},
    {id:'p2', from:'Марина Ясная', c:'#A8375C', kind:'эксперт', ago:'вчера', unread:true, exp:true,
     msgs:[{me:false, t:'Спасибо за вопрос в группе. Отвечаю подробнее: дыхание 4-7-8 можно делать и при панике, но начинать лучше в спокойном состоянии, чтобы тело запомнило схему.', tm:'18:05'}]},
    {id:'p3', from:'Eva Space', c:'#111014', kind:'система', ago:'2 дня назад', unread:false, sys:true,
     msgs:[{me:false, t:'Твоя программа обновилась: на новой неделе новые практики. Хорошего старта!', tm:'08:00'}]}
  ];
  S.inbox = S.inbox || [];
  base.forEach(t => { if(!S.inbox.some(x => x.id === t.id)) S.inbox.push(t); });
}
const unreadCount = () => { initInbox(); pullMarketReplies(); return S.inbox.filter(t => t.unread).length; };

/* забираем ответы админа на вопросы о товарах, адресованные этой почте */
function pullMarketReplies(){
  if(!S.user || !S.marketReplies || !S.marketReplies.length) return;
  const mine = String(S.user.email).toLowerCase();
  S.seenReplies = S.seenReplies || [];
  const fresh = S.marketReplies.filter(r =>
    String(r.mail).toLowerCase() === mine && !S.seenReplies.includes(r.qid + '_' + r.at));
  if(!fresh.length) return;
  let th = S.inbox.find(x => x.kind === 'маркет');
  if(!th){
    th = {id:'mk'+Date.now().toString(36), from:'Eva Space · Маркет', c:'#111014',
          kind:'маркет', ago:'только что', unread:false, sys:true, msgs:[]};
    S.inbox.unshift(th);
  }
  fresh.forEach(r => {
    th.msgs.push({me:false, t:r.t, tm:r.tm});
    S.seenReplies.push(r.qid + '_' + r.at);
  });
  th.unread = true;
}

function pgInbox(){
  initInbox();
  if(S.thread) return pgThread();
  return `<div class="view pad">${backBtn('Назад')}
    <h1 class="serif" style="font-size:26px;margin:10px 0 4px">Сообщения</h1>
    <p class="small muted" style="margin:0 0 14px">Приглашения от участниц, ответы экспертов и уведомления платформы.</p>
    ${S.inbox.map(t => {
      const last = t.msgs[t.msgs.length-1];
      return `<button class="gitem ${t.unread?'unreadrow':''}" onclick="openThread('${attJs(t.id)}')">
        ${chatAva(t.from, t.c, false, 42, t.email)}
        <div style="flex:1;min-width:0">
          <div class="spread"><b style="font-size:14px">${esc(t.from)}${t.exp?' <span class="badge-exp">эксперт</span>':''}</b>
            <span class="small muted" style="font-size:10.5px">${esc(t.ago)}</span></div>
          <div class="small muted" style="margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${esc(last.t)}</div>
        </div>
        ${t.unread ? '<span class="unreadc">1</span>' : ''}
      </button>`;
    }).join('')}
    <div class="card" style="margin-top:10px">
      <b style="font-size:14.5px">Как сюда попадают сообщения</b>
      <p class="small muted" style="margin:7px 0 0">Когда ты отвечаешь на послание участницы или зовёшь кого-то познакомиться,
        переписка появляется здесь. Эксперты пишут сюда же, если ответили на твой вопрос лично.</p>
    </div>
  </div>`;
}
function openThread(id){ initInbox(); const t = S.inbox.find(x => x.id === id); t.unread = false; S.thread = id; render(); }
function pgThread(){
  const t = S.inbox.find(x => x.id === S.thread);
  return `<div class="view pad">
    <button class="backbtn" onclick="S.thread=null;render()">‹ Сообщения</button>
    <div class="row" style="margin:12px 0 6px">
      ${chatAva(t.from, t.c, false, 40, t.email)}
      <div><b style="font-size:15px">${esc(t.from)}</b>
        <div class="small muted">${esc(t.kind)}</div></div>
    </div>
    <div class="chatlist">
      ${t.msgs.map(m => `<div class="cmsg ${m.me?'own':''}">
        ${!m.me ? chatAva(t.from, t.c, false, 32, t.email) : ''}
        <div class="txt">${esc(m.t)}<div class="tm">${esc(m.tm)}</div></div>
      </div>`).join('')}
    </div>
    ${t.pending ? `<div class="card" style="border-color:var(--accent)">
      <b style="font-size:14px">Приглашение</b>
      <div class="small muted" style="margin:4px 0 10px">${esc(t.from)} зовёт тебя встретиться. Ответишь?</div>
      <div class="acts" style="margin:0">
        <button class="btn" onclick="answerInvite('${attJs(t.id)}',true)">Принять</button>
        <button class="btn ghost" onclick="answerInvite('${attJs(t.id)}',false)">Отклонить</button>
      </div></div>` : ''}
    <div class="chatbar">
      <input class="field" id="tin" placeholder="Сообщение" onkeydown="if(event.key==='Enter')sendDM('${attJs(t.id)}')">
      <button class="btn" style="width:auto;padding:12px 16px;border-radius:999px" onclick="sendDM('${attJs(t.id)}')">→</button>
    </div>
  </div>`;
}
function sendDM(id){
  const inp = $('#tin'); if(!inp) return;
  const v = inp.value.trim(); if(!v) return;
  const t = S.inbox.find(x => x.id === id);
  const now = new Date();
  const tm = String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  t.msgs.push({me:true, t:v, tm});
  /* сообщение в тред маркета — это новый вопрос администратору */
  if(t.kind === 'маркет'){
    S.qs.push({id:'q'+Date.now().toString(36), gid:t.gid || '', who:S.name || 'Гостья',
      mail:S.user ? S.user.email : '', ago:'только что', t:v, answer:'', private:true});
    syncPush(['questions']);
    render(); schedulePersist();
    return toast('Вопрос отправлен, ответим в течение дня');
  }
  render(); schedulePersist();
  setTimeout(() => {
    if(t.sys) return;
    t.msgs.push({me:false, t:t.exp ? 'Спасибо, что написала. Отвечу подробнее в течение дня.' : 'Отлично, давай! Напиши, когда тебе удобно.',
      tm:String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0')});
    if(S.thread === id) render(); else t.unread = true;
  }, 1500);
}


function replyWall(id){
  const w = WALL.find(x => x.id === id);
  if(!w) return;
  initInbox();
  const now = new Date();
  const tm = String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  let t = S.inbox.find(x => x.from === w.a && x.kind === 'знакомство');
  if(!t){
    t = {id:'wr'+Date.now().toString(36), from:w.a, c:w.c, kind:'знакомство', ago:'только что', unread:false, msgs:[]};
    S.inbox.unshift(t);
  }
  t.msgs.push({me:true, t:`Привет! Откликаюсь на твоё послание: «${w.t.slice(0,60)}${w.t.length>60?'…':''}»`, tm});
  S.thread = t.id; S.page = 'inbox';
  render(); schedulePersist(); toast('Написала ' + w.a);
  setTimeout(() => {
    t.msgs.push({me:false, t:'Привет! Здорово, что откликнулась. Расскажи о себе немного?', tm});
    if(S.thread === t.id) render(); else { t.unread = true; render(); }
  }, 1800);
}

/* стартовое входящее приглашение — чтобы механика была видна */
setTimeout(() => { try{ seedIncomingInvite(); }catch(e){} }, 100);

