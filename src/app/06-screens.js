/* =====================================================================
   ШАПКА И НАВИГАЦИЯ
   ===================================================================== */
function hint(k){ return `<button class="qm" onclick="event.stopPropagation();openHint('${attJs(k)}')" aria-label="Что это">?</button>`; }

function avatarEl(size, cls){
  const src = myAvatar();
  return src ? avaImg(src, size) : avaLetter(S.name, size, cls);
}

function hero(){
  const {cur, next} = levelNow();
  const left = next ? next.from - S.points : 0;
  const part = daypart(), sc = SCENES[part];
  const m = moon(), z = zodiac(S.birth.date), cy = cycleNow();
  return `<div class="hero" style="background:${sc.g}">
    ${sceneSVG(part)}
    <div class="brandbar">
      <div class="b">✦ Eva Space</div>
      <div class="row" style="gap:8px">
        <button class="mailbtn2" onclick="openPage('inbox')" aria-label="Сообщения">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
            <rect x="3" y="5" width="18" height="14" rx="3"/><path d="M4 7l8 6 8-6"/></svg>
          ${unreadCount() ? `<i class="mdot">${unreadCount()}</i>` : ''}
        </button>
        <button onclick="openPage('profile')" style="display:flex">${avatarEl(38)}</button>
      </div>
    </div>
    <h1 class="serif" style="font-size:29px;margin:0">${hello()}, ${esc(S.name||'Ева')}</h1>
    <p class="small muted" style="margin:5px 0 0">${esc(sc.e)} ${esc(sc.n)} · день ${S.day+1} из 7</p>

    <div class="wish">${greetingLine()}</div>

    <div class="stats">
      <button onclick="openHint('stars')"><b>${starMark(15)} ${S.stars} из ${starsTotal()}</b><span>звёзд за неделю</span></button>
      <button onclick="openPage('points')"><b>${S.points}</b><span>баллов · ${cur.n.toLowerCase()}</span></button>
      <button onclick="openPage('points')"><b>${S.bonus} ₽</b><span>бонусов</span></button>
    </div>
    ${accessLine()}
  </div>`;
}

const NAVI = {
  home:['Главная','<path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'],
  content:['Контент','<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h5"/>'],
  courses:['Курсы','<path d="M12 4 2 9l10 5 10-5z"/><path d="M6 11.5V17c0 1.5 3 3 6 3s6-1.5 6-3v-5.5"/>'],
  market:['Маркет','<path d="M4 8h16l-1.2 11a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>'],
  club:['Сообщество','<circle cx="9" cy="8" r="3"/><path d="M2 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5"/><path d="M16 11a3 3 0 0 0 0-6M18 20c0-2.2-.7-3.9-2-5"/>']
};

function nav(){
  return `<nav class="nav">${Object.entries(NAVI).map(([k,[l,d]]) =>
    `<button class="${S.tab===k&&!S.page?'on':''}" data-tab="${attJs(k)}" onclick="go('${attJs(k)}')">
      <svg viewBox="0 0 24 24">${d}</svg><span>${l}</span></button>`).join('')}</nav>`;
}

function fab(){
  return `<button class="fab" onclick="openSheet('eva')" aria-label="Ева">
    <svg width="26" height="26" viewBox="0 0 100 100" aria-hidden="true">
      <path d="${STAR_PATH}" fill="#fff"/></svg></button>`;
}

const backBtn = t => `<button class="backbtn" onclick="back()">‹ ${t}</button>`;

/* =====================================================================
   ГЛАВНАЯ
   ===================================================================== */
function pgHome(){
  const day = S.program[S.day];
  const idxs = S.gentle ? [0, 2].filter(i => day.tasks[i]) : day.tasks.map((_,i) => i);
  const shown = idxs.map(i => day.tasks[i]);
  const more = LIB.filter(x => !day.tasks.some(t => t.id === x.id))
                  .map(x => ({...x, m:matchOf(x)})).sort((a,b) => b.m - a.m).slice(0,8);
  const acc = hasAccess();
  return `${hero()}
  <div class="view pad">
    <div style="height:14px"></div>
    ${trialBar()}
    ${!acc ? `<button class="expbar" onclick="openPage('sub')">
      <span class="lk">${LOCK_SVG}</span>
      <span style="flex:1;text-align:left"><b>Пробные три дня прошли</b>
        <span class="small" style="display:block;opacity:.75">Прогресс сохранён. Открой доступ - и продолжишь с того же места</span></span>
      <span class="expgo">Открыть</span>
    </button>` : ''}
    <div class="sec-h" style="margin-top:20px">
      <div class="eyebrow">Программа на 7 дней</div>
      <button class="link" onclick="openPage('report')">Отчёт недели</button>
    </div>
    <div class="week">
      ${S.program.map((d,i) => {
        const dt = dateOfDay(i), done = doneOf(i);
        return `<button class="wd ${i===S.day?'sel':''} ${i===todayIdx()&&i!==S.day?'today':''} ${i>todayIdx()?'future':''}" onclick="setDay(${i})">
          <span>${esc(d.d)}</span><b>${dt.getDate()}</b>
          <div class="pips">${S.program[i].tasks.map(t => `<i class="pip ${t.done?'on':''}"></i>`).join('')}</div>
          ${done===3?'<div class="wstar">★</div>':''}
        </button>`;}).join('')}
    </div>

    <div class="sec-h">
      <div><h2 class="serif">${S.day === todayIdx() ? 'Сегодня' : DAYS[S.day]+', день '+(S.day+1)}</h2>
        <div class="small muted">${S.gentle ? 'Мягкий режим: аффирмация и мастер-класс' : 'Выполни три шага - получишь три звезды'}</div></div>
      <div class="starrow">${[0,1,2].map(i => i < doneOf(S.day)
        ? starMark(17) : `<span class="off">${starMark(17,'rgba(17,16,20,.14)')}</span>`).join(' ')}</div>
    </div>

    <div id="today">${S.day > todayIdx() ? `<div class="future-note">
        <b>День откроется ${dateOfDay(S.day).toLocaleDateString('ru-RU',{day:'numeric',month:'long'})}</b>
        <div class="small muted">Можно посмотреть, что тебя ждёт. Отмечать задания получится в этот день.</div>
      </div>${shown.map((t,k) => lessonCard(t, S.day, idxs[k], true)).join('')}`
      : shown.map((t,k) => lessonCard(t, S.day, idxs[k], !acc && !(k === 0), !acc)).join('')}</div>

    ${!S.gentle && doneOf(S.day) === 0 ? `
      <div class="row" style="margin-bottom:16px">
        <button class="btn ghost" style="flex:1" onclick="gentle(true)">Сегодня совсем нет сил</button>${hint('gentle')}</div>` : ''}
    ${S.gentle ? `<button class="btn ghost" style="margin-bottom:16px" onclick="gentle(false)">Вернуть полную программу</button>` : ''}

    ${S.astroOn ? dayAdvice() : ''}

    <div class="g4" style="margin-bottom:6px">
      ${[['calendar','Календарь'],['content','Контент'],['profile','Кабинет'],['eva','Ева']].map(([k,l]) =>
        `<button class="quick" onclick="${k==='eva'?"openSheet('eva')":k==='content'?"go('content')":`openPage('${k}')`}">
          ${QICON[k]||QICON.report}<span>${l}</span></button>`).join('')}
    </div>

    ${S.courses.length ? `
      <div class="sec-h"><h2 class="serif">Мои курсы</h2><button class="link" onclick="go('courses')">Каталог</button></div>
      ${S.courses.map(id => {
        const c = COURSES.find(x => x.id === id); if(!c) return '';
        const ls = lessonsOf(c.id), done = ls.filter(l => l.done).length;
        return `<button class="crow" onclick="openCourseLanding('${attJs(c.id)}')">
          <div class="mini">${cover(c.id,'course')}</div>
          <div style="flex:1;min-width:0">
            <b style="font-size:13.5px">${esc(c.t)}</b>
            <div class="small muted">${esc(c.e)} · ${done} из ${ls.length} уроков</div>
            <div class="bar" style="margin-top:6px"><i style="width:${done/ls.length*100}%"></i></div>
          </div></button>`;
      }).join('')}` : `
      <div class="sec-h"><h2 class="serif">Мои курсы</h2></div>
      <button class="card" style="width:100%;text-align:left" onclick="go('courses')">
        <b style="font-size:14.5px">Пока ни одного курса</b>
        <div class="small muted" style="margin-top:4px">У каждого эксперта есть курс - продолжение практик из твоей программы. Первые уроки открыты бесплатно.</div>
      </button>`}

    <div class="sec-h"><h2 class="serif">Ещё для тебя</h2><button class="link" onclick="go('content')">Весь контент</button></div>
    <div class="hscroll">
      ${more.map(x => `
        <button class="lesson" style="margin:0" onclick="openLesson('${attJs(x.id)}')">
          <div class="cov" style="height:104px">${cover(x.id, x.type)}
            <div class="badge">${x.m}%</div></div>
          <div class="body" style="padding:11px 12px 13px">
            <div class="eyebrow" style="font-size:9px">${TYPE[x.type].l}</div>
            <div style="font-weight:700;font-size:13.5px;line-height:1.3;margin:5px 0 4px">${esc(x.title)}</div>
            <div class="small muted" style="font-size:11.5px">${esc(x.expert)} · ${x.min} мин</div>
          </div>
        </button>`).join('')}
    </div>
  </div>`;
}

function donutLight(pct){
  const C = 2*Math.PI*22;
  return `<div style="position:relative;width:54px;height:54px;flex:none">
    <svg width="54" height="54" viewBox="0 0 54 54" style="transform:rotate(-90deg)">
      <circle cx="27" cy="27" r="22" fill="none" stroke="var(--line)" stroke-width="4"/>
      <circle cx="27" cy="27" r="22" fill="none" stroke="var(--rose)" stroke-width="4" stroke-linecap="round"
        stroke-dasharray="${C*pct/100} ${C}"/></svg>
    <div style="position:absolute;inset:0;display:grid;place-items:center;font-size:12.5px;font-weight:800;color:var(--rose-deep)">${pct}%</div>
  </div>`;
}

function lessonCard(t, di, ti, locked, paywall){
  const m = TYPE[t.type];
  if(locked) return `<div class="lesson locked-day">
    <div class="cov" onclick="${paywall ? "openPage('sub')" : `toast('Этот день откроется ${dateOfDay(di).toLocaleDateString('ru-RU',{day:'numeric',month:'long'})}')`}">
      ${cover(t.id, t.type)}
      <div class="badge">${ti===0?'Аффирмация':ti===1?'Практика':'Мастер-класс'}</div>
      <div class="daylock">${LOCK_SVG}</div>
      ${paywall ? '<div class="lockhint">Нажми, чтобы открыть доступ</div>' : ''}
      <div class="cap"><b>${esc(t.title)}</b><span>${esc(t.expert)} · ${t.min} мин</span></div>
    </div></div>`;
  /* Отметка «сделала» переехала внутрь карточки маленьким кружком: две
     кнопки под каждым уроком превращали день в стену из кнопок. Нажатие
     по самой карточке по-прежнему открывает урок. */
  return `<div class="lesson wide${t.done?' done':''}">
    <div class="cov" onclick="openLesson('${attJs(t.id)}')">
      ${cover(t.id, t.type)}
      <div class="badge afflabel">${ti===0?'Аффирмация дня':ti===1?(t.slot==='утро'?'Утренняя практика':'Практика дня'):'Мастер-класс'}</div>
      ${t.type !== 'affirm' ? `<div class="play">▶</div>` : ''}
      <button class="donemark ${t.done?'on':''}" onclick="event.stopPropagation();complete(${di},${ti})"
        title="${t.done ? 'Сделано' : esc(m.act) + ' · +' + t.pts + ' баллов'}"
        aria-label="${t.done ? 'Сделано' : esc(m.act)}">${CHECK_SVG}</button>
      <div class="cap"><b>${esc(t.title)}</b><span>${esc(t.expert)} · ${t.min} мин${
        t.why ? ' · ' + esc(t.why) : ' · ' + t.match + '% совпадение'}</span></div>
    </div>
  </div>`;
}

const CHECK_SVG = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
  stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7"/></svg>`;

function setDay(i){ S.day = i; render(); if(i > todayIdx()) toast('Заглядываешь вперёд: этот день откроется ' + dateOfDay(i).toLocaleDateString('ru-RU',{day:'numeric',month:'long'})); }

function gentle(v){ S.gentle = v; render(); schedulePersist(); toast(v ? 'Оставила аффирмацию и мастер-класс' : 'Программа вернулась'); }

/* =====================================================================
   КОНТЕНТ
   ===================================================================== */
function allTags(){
  const c = {};
  LIB.forEach(x => x.tags.forEach(t => c[t] = (c[t]||0)+1));
  return Object.entries(c).sort((a,b) => b[1]-a[1]);
}

/* отбор материалов вынесен отдельно: им пользуются и экран, и обновление списка */
const CTYPES = {'Всё':null, 'Аффирмации':'affirm', 'Практики':'practice', 'Мастер-классы':'class'};

function contentItems(){
  let items = LIB.filter(x => x.status === 'live');
  if(CTYPES[S.filter]) items = items.filter(x => x.type === CTYPES[S.filter]);
  if(S.topicFilter) items = items.filter(x => (x.topics||[]).includes(S.topicFilter));
  if(S.onlyLiked) items = items.filter(x => isLiked(x.id));
  if(S.q.trim()){
    const q = S.q.toLowerCase();
    items = items.filter(x => (x.title + ' ' + x.text + ' ' + x.expert + ' ' + x.tags.join(' ') + ' ' +
      (x.topics||[]).map(topicName).join(' ')).toLowerCase().includes(q));
  }
  items = items.map(x => ({...x, m:matchOf(x)})).sort((a,b) => b.m - a.m);
  return items;
}

function pgContent(){
  const items = contentItems();
  return `<div class="view pad" style="padding-top:calc(20px + env(safe-area-inset-top))">
    <div class="eyebrow">Библиотека</div>
    <h1 class="serif" style="font-size:29px;margin:6px 0 14px">Весь контент</h1>

    <div style="position:relative;margin-bottom:12px">
      <input class="field" style="margin:0;padding-left:40px" placeholder="Поиск: тревога, йога, сон"
        value="${esc(S.q)}" oninput="S.q=this.value;renderList()">
      <span style="position:absolute;left:15px;top:13px;opacity:.4">🔍</span>
    </div>

    <div id="cbox">${contentTabs()}${topicRow()}</div>
    <div class="small muted" id="found" style="margin:4px 0 12px">${foundLine(items.length)}</div>
    <div id="list">${listHTML(items)}</div>
  </div>`;
}

function contentTabs(){
  return `<div class="seg">${Object.keys(CTYPES).map(k =>
    `<button class="${S.filter===k?'on':''}" onclick="setCType('${attJs(k)}')">${k}</button>`).join('')}</div>`;
}

/* Направления показываем только внутри вида. В общем списке их набирается
   на три экрана, и за фишками теряется сам контент; поэтому во «Всём»
   остаются только «Все» и «Избранное», а направления приходят вместе с
   выбранным видом — и лишь те, в которых действительно что-то есть. */
function topicRow(){
  const type = CTYPES[S.filter];
  const live = LIB.filter(x => x.status === 'live' && (!type || x.type === type));
  const have = {};
  live.forEach(x => (x.topics||[]).forEach(k => { have[k] = (have[k]||0) + 1; }));
  const list = type
    ? (topicsFor(type) || []).filter(t => have[t.k])
        .sort((a,b) => have[b.k] - have[a.k]).slice(0, 8)
    : [];
  const liked = (S.likes || []).filter(id => LIB.some(x => x.id === id)).length;
  const all = !S.topicFilter && !S.onlyLiked;
  return `<div class="trow hscroll">
    <button class="tchip ${all?'on plain':''}" onclick="showAll()"><span>Все</span></button>
    ${liked ? `<button class="tchip fav ${S.onlyLiked?'on':''}" onclick="tgLiked()">
      ${starMark(13, S.onlyLiked ? '#fff' : '#E7A339')}<span>Избранное</span><b>${liked}</b></button>` : ''}
    ${list.map(t => `<button class="tchip ${S.topicFilter===t.k?'on':''}" style="--tc:${safeColor(t.c)}"
      onclick="pickTopic('${attJs(t.k)}')">
      ${tIcon(t.k, 14)}<span>${esc(t.l)}</span><b>${have[t.k]}</b></button>`).join('')}
  </div>`;
}

/* Переключения меняют только фишки и список: заголовок и поле поиска
   остаются нетронутыми, поэтому экран не дёргается и курсор не пропадает. */
function setCType(k){ S.filter = k; S.topicFilter = null; renderTabs(); }
function pickTopic(k){ S.topicFilter = S.topicFilter === k ? null : k; S.onlyLiked = false; renderTabs(); }
function tgLiked(){ S.onlyLiked = !S.onlyLiked; if(S.onlyLiked) S.topicFilter = null; renderTabs(); }
function showAll(){ S.topicFilter = null; S.onlyLiked = false; renderTabs(); }

function renderTabs(){
  const box = $('#cbox');
  if(!box) return render();
  box.innerHTML = contentTabs() + topicRow();
  deskArrows();
  renderList();
}

const foundLine = n => 'Найдено ' + plural(n,'урок','урока','уроков') + ' · отсортировано по совпадению с тобой';
const listHTML = items => items.length ? items.map(x => contentRow(x)).join('')
  : `<div class="empty">Ничего не нашлось.<br>Попробуй другое слово или сними фильтр.</div>`;

/* Обновляем только список, не трогая поле ввода: иначе на каждой букве
   пропадал курсор и приходилось щёлкать по полю заново. */
function renderList(){
  const box = $('#list');
  if(!box) return render();
  const items = contentItems();
  box.innerHTML = listHTML(items);
  const cnt = $('#found');
  if(cnt) cnt.textContent = foundLine(items.length);
}

function starContent(btn, id){
  S.likes = S.likes || [];
  const on = S.likes.includes(id);
  S.likes = on ? S.likes.filter(v => v !== id) : [...S.likes, id];
  btn.classList.toggle('on', !on);
  btn.innerHTML = starMark(15, !on ? '#E7A339' : 'rgba(17,16,20,.22)');
  schedulePersist();
  publishCard();                       /* полка на её странице - это те же звёзды */
  if(!on) toast('Добавлено в избранное');
}
const isLiked = id => (S.likes || []).includes(id);

function contentRow(x){
  return `<button class="crow" onclick="openLesson('${attJs(x.id)}')">
    <div class="mini">${cover(x.id, x.type)}${x.type!=='affirm'?'<div style="position:absolute;inset:0;display:grid;place-items:center;color:#fff;font-size:15px">▶</div>':''}</div>
    <div style="flex:1;min-width:0">
      <div style="font-size:10.5px;font-weight:800"><span style="color:var(--rose-deep)">${TYPE[x.type].l}</span>
        <span class="muted"> · ${x.m||matchOf(x)}% совпадение</span></div>
      <div style="font-weight:700;font-size:14px;line-height:1.3;margin:3px 0 4px">${esc(x.title)}</div>
      <div class="small muted" style="font-size:11.5px">${x.min} мин · ${esc(x.expert)}</div>
    </div>
    <span class="starbtn ${isLiked(x.id)?'on':''}" onclick="event.stopPropagation();starContent(this,'${attJs(x.id)}')">
      ${starMark(15, isLiked(x.id) ? '#E7A339' : 'rgba(17,16,20,.22)')}</span>
  </button>`;
}

/* =====================================================================
   КУРСЫ
   ===================================================================== */
function pgCourses(){
  const mine = new Set(S.tags);
  const rec = c => (COURSE_TAGS[c.id]||[]).some(t => mine.has(t));
  const kinds = ['Рекомендованные','Базовые','Дополнительные'];
  let list = COURSES.filter(c => !c.draft);
  if(S.courseSort === 'Базовые') list = list.filter(c => COURSE_KIND[c.id] === 'Базовый');
  else if(S.courseSort === 'Дополнительные') list = list.filter(c => COURSE_KIND[c.id] === 'Дополнительный');
  else list = list.sort((a,b) => (rec(b)?1:0) - (rec(a)?1:0));

  return `<div class="view pad" style="padding-top:calc(20px + env(safe-area-inset-top))">
    <div class="eyebrow">Обучение</div>
    <h1 class="serif" style="font-size:29px;margin:6px 0 14px">Курсы экспертов</h1>

    <div class="card" style="background:linear-gradient(150deg,#2E2145,#4B2A4E);color:#fff;border-color:transparent">
      <h3 class="serif" style="font-size:20px;margin:0 0 8px;color:#fff">Понравилась бесплатная практика?</h3>
      <p class="small" style="margin:0;color:rgba(255,255,255,.78)">У каждого эксперта есть полный курс - продолжение того,
        что ты уже пробовала в программе. Первые уроки открыты без оплаты.</p>
    </div>

    ${expertsRow()}

    <div class="sec-h"><h2 class="serif">Все курсы</h2><span class="small muted">${list.length} шт.</span></div>
    <div class="seg">${kinds.map(k => `<button class="${S.courseSort===k?'on':''}" onclick="S.courseSort='${attJs(k)}';render()">${k}</button>`).join('')}</div>

    ${list.map(c => `
      <div class="lesson">
        <div class="cov" style="height:158px" onclick="openCourseLanding('${attJs(c.id)}')">
          ${cover(c.id,'course')}
          <div class="badge">${esc(COURSE_KIND[c.id])}</div>
          ${rec(c) ? `<div class="badge" style="left:auto;right:12px;background:var(--grad-gold);color:var(--plum)">✦ тебе</div>` : ''}
          <div class="cap"><b>${esc(c.t)}</b><span>${esc(c.e)} · ${plural(c.n,'урок','урока','уроков')}</span></div>
          <span class="starcorner">${starBtn(c.id, 15)}</span>
        </div>
        <div class="body">
          <p class="small muted" style="margin:0 0 10px">${esc(c.d)}</p>
          <div class="chips wrap" style="padding-bottom:6px">${(COURSE_TAGS[c.id]||[]).map(t => `<span class="chip pale">${esc(t)}</span>`).join('')}</div>
          <div class="spread">
            <div><span class="price">${money(c.p)}</span><span class="old">${money(c.old)}</span></div>
            <div class="small muted">★ ${c.r} · ${c.s.toLocaleString('ru-RU')} учениц</div>
          </div>
          <button class="btn ${S.courses.includes(c.id)?'done':''}" style="margin-top:12px"
            onclick="${S.courses.includes(c.id)?'':`openCourseLanding('${attJs(c.id)}')`}">
            ${S.courses.includes(c.id) ? '✓ Курс открыт' : 'Подробнее'}</button>
        </div>
      </div>`).join('')}
  </div>`;
}

/* =====================================================================
   РЯД ЭКСПЕРТОВ В КУРСАХ
   Подписка не заводит себе отдельного места: она меняет порядок в ряду,
   который здесь и так был. Те, кого женщина читает, идут первыми и
   помечены — у кого вышло новое, у того помечено ярче. Дальше остальные,
   в прежнем порядке.

   Так решено нарочно. Отдельный экран «мои эксперты» пришлось бы чем-то
   наполнять с первого дня и объяснять, зачем он; порядок в ряду не нужно
   ни объяснять, ни открывать — он просто есть, и без подписок ряд
   выглядит ровно как раньше.
   ===================================================================== */
function expertsRow(){
  const has = e => typeof expertHasNew === 'function' && expertHasNew(e.id);
  const mine = typeof isFollowing === 'function' ? EXPERTS.filter(e => isFollowing(e.id)) : [];
  /* среди своих первыми те, у кого вышло новое: иначе метка «новое»
     оказывается второй-третьей и ряд приходится листать до неё */
  const following = mine.filter(has).concat(mine.filter(e => !has(e)));
  const rest = EXPERTS.filter(e => following.indexOf(e) < 0);
  const fresh = mine.filter(has).length;

  const card = (e, own) => {
    const isNew = own && has(e);
    return `<button class="exp ${own ? 'mine' : ''}" style="width:154px" onclick="openExpert('${attJs(e.id)}')">
      ${own ? `<span class="expmark ${isNew ? 'new' : ''}"
        title="${isNew ? 'Вышло что-то с твоего прошлого захода' : 'Ты подписана'}">${
        isNew ? 'новое' : 'читаю'}</span>` : ''}
      <div class="pcirc">${expPic(e, true)}</div>
      <div style="font-weight:800;font-size:13.5px;margin-top:9px">${esc(e.n)}${e.verified?' <span class="vt">✓</span>':''}</div>
      <div class="small muted" style="font-size:11.5px;min-height:32px">${esc(e.r)}</div>
      <div style="color:var(--gold);font-weight:800;font-size:12.5px">★ ${e.rate}</div>
    </button>`;
  };

  return `<div class="sec-h"><h2 class="serif">Эксперты</h2>
      <span class="small muted">${!following.length ? EXPERTS.length
        : fresh ? (fresh === 1 ? 'у одной новое' : 'новое у ' + fresh)
        : 'сначала твои'}</span></div>
    <div class="hscroll">
      ${following.map(e => card(e, true)).join('')}${rest.map(e => card(e, false)).join('')}
    </div>`;
}

/* ---------- страница эксперта (публичный лендинг) ---------- */
function openExpert(id){
  S.expShown = 8; S.viewExpert = id;
  S.page = null; S.sheet = null; S.viewPerson = null;
  S.course = null; S.viewGood = null;      // иначе роутер останется на курсе или товаре
  /* запоминаем, сколько у него материалов было в этот раз: по этому
     числу кружок потом покажет, что вышло новое */
  if(typeof markExpertSeen === 'function') markExpertSeen(id);
  render(); window.scrollTo(0,0);
}
function closeExpert(){ S.viewExpert = null; render(); window.scrollTo(0,0); }

function moreExpert(step){ S.expShown = (S.expShown || step) + step; render(); }
function pgExpertPage(){
  const e = EXPERTS.find(x => x.id === S.viewExpert);
  const courses = COURSES.filter(c => c.e === e.n);
  const mats = LIB.filter(x => x.expert === e.n);
  const rev = (REVIEWS[courses[0] ? courses[0].id : 'k1'] || []).slice(0,2);
  const pic = expPic(e, true);
  return `<div class="view">
    <div class="exphead">
      <div class="brandbar" style="margin:0">
        <button onclick="${S.role==='expert'?"S.page=null;S.viewExpert=null;render()":'closeExpert()'}"
          style="color:#fff;font-size:20px;width:30px;text-align:left">‹</button>
        <div class="b">Эксперт</div><div style="width:30px"></div>
      </div>
      <div class="pcirc" style="width:92px;height:92px;margin:6px auto 0;border:2px solid rgba(255,255,255,.35)">${pic}</div>
      <div class="nm">${esc(e.n)} ${e.verified?'<span class="vt big">✓</span>':''}</div>
      <div class="sub">${esc(e.r)}</div>
      <div class="mrow">
        <span class="mstat">★ ${e.rate}</span>
        <span class="mstat">${e.students.toLocaleString('ru-RU')} учениц</span>
        <span class="mstat">${followCount(e.id)} подписаны</span>
      </div>
    </div>

    <div class="pad" style="padding-top:16px">
      ${S.role === 'user' ? `<div class="row" style="gap:8px;margin-bottom:12px">
        <button class="btn ${isFollowing(e.id) ? 'done' : 'acc'}" style="flex:1"
          onclick="followExpert('${attJs(e.id)}')">
          ${isFollowing(e.id) ? 'Вы подписаны' : 'Подписаться'}</button>
        <button class="btn ghost" style="flex:1"
          onclick="openSheet({k:'write',id:'${attJs(e.id)}'})">Написать</button>
      </div>
      <p class="small muted" style="margin:-6px 0 14px;text-align:center">
        Подписка — про новые практики и встречи. Не чаще, чем они выходят.</p>` : ''}
      <div class="card"><b style="font-size:15px">О себе</b>
        <p class="small muted" style="margin:8px 0 0">${esc(e.about)}</p></div>

      <div class="quote">
        <span class="qmark">“</span>
        <p>${esc(e.mission)}</p>
        <div class="qauthor">${esc(e.n)}</div>
      </div>

      <div class="sec-h"><h2 class="serif">С чем ко мне приходят</h2></div>
      ${(e.who||[]).map(w => `<div class="whocard">
        <span class="wdot"></span><div style="flex:1;font-size:13.5px;line-height:1.45">${esc(w)}</div></div>`).join('')}

      <div class="card" style="margin-top:12px">
        <b style="font-size:14.5px">Темы, с которыми работает</b>
        <div class="small muted" style="margin:4px 0 9px">По этим темам подбираются практики в твоей программе</div>
        <div class="chips wrap">${e.t.map(t => `<span class="chip pale">${esc(t)}</span>`).join('')}</div>
      </div>

      <div class="sec-h"><h2 class="serif">Опыт и достижения</h2></div>
      <div class="g3" style="margin-bottom:10px">
        <div class="stat"><b style="font-size:17px">${e.exp}</b><div class="small muted">в практике</div></div>
        <div class="stat"><b style="font-size:17px">${e.students >= 1000 ? (e.students/1000).toFixed(1)+'к' : e.students}</b><div class="small muted">учениц</div></div>
        <div class="stat"><b style="font-size:17px"><span class="stars5">★</span> ${e.rate}</b><div class="small muted">рейтинг</div></div>
      </div>
      ${(e.ach||[]).length ? `<div class="card">
        ${(e.ach||[]).map(a => `<div class="achline"><span class="wdot"></span><span style="flex:1">${esc(a)}</span></div>`).join('')}
      </div>` : ''}

      ${(e.edu||[]).filter(x => x.st === 'approved').length ? `
        <div class="sec-h"><h2 class="serif">Образование</h2>
          <span class="small muted">проверено редакцией</span></div>
        ${(e.edu||[]).filter(x => x.st === 'approved').map(x => `<div class="educard">
          <div class="edok">✓</div>
          <div style="flex:1"><b style="font-size:13.5px">${esc(x.t)}</b>
            <div class="small muted">${x.y}</div></div></div>`).join('')}
        <div class="small muted" style="margin:-2px 0 12px">Дипломы и сертификаты проверены администрацией платформы. Сами документы не публикуются.</div>` : ''}

      <div class="sec-h"><h2 class="serif">Курсы</h2><span class="small muted">${courses.length}</span></div>
      ${courses.length ? courses.map(c => `<button class="crow" onclick="openCourseLanding('${attJs(c.id)}')">
        <div class="mini">${cover(c.id,'course')}</div>
        <div style="flex:1"><b style="font-size:13.5px">${esc(c.t)}</b>
          <div class="small muted">${plural(lessonsOf(c.id).length,'урок','урока','уроков')} · ★ ${c.r}</div>
          <div class="price" style="font-size:14px;margin-top:3px">${money(c.p)}</div></div>
      </button>`).join('') : '<div class="empty">Курсы готовятся</div>'}

      <div class="sec-h"><h2 class="serif">Материалы</h2><span class="small muted">${mats.length}</span></div>
      ${(() => {
        const step = 8, shown = Math.min(mats.length, S.expShown || step);
        return mats.slice(0, shown).map(x => contentRow({...x, m:matchOf(x)})).join('')
          + (mats.length > shown
            ? `<button class="btn ghost" onclick="moreExpert(${step})">
                 Показать ещё ${Math.min(step, mats.length - shown)} из ${mats.length - shown}</button>`
            : mats.length > step
              ? `<button class="btn ghost" onclick="S.expShown=${step};render()">Свернуть</button>` : '');
      })()}

      ${rev.length ? `<div class="sec-h"><h2 class="serif">Отзывы</h2></div>
        ${rev.map(([who,t,st]) => `<div class="review">
          <div class="spread"><b style="font-size:13px">${who}</b><span class="stars5">${'★'.repeat(st)}</span></div>
          <p class="small muted" style="margin:6px 0 0">${t}</p></div>`).join('')}` : ''}

      <div class="sec-h"><h2 class="serif">Услуги эксперта</h2>
        <span class="small muted">${(e.services||[]).length}</span></div>
      ${(e.services||[]).map(sv => {
        const off = sv.until && new Date(sv.until) > new Date();
        return `<div class="consult">
          ${off ? `<div class="offbadge">Спецусловие до ${new Date(sv.until).toLocaleDateString('ru-RU',{day:'numeric',month:'long'})}</div>` : ''}
          <b style="font-size:16px;display:block">${esc(sv.t)}</b>
          <div class="small muted" style="margin:4px 0 10px">${sv.mins} минут · ${sv.format}</div>
          <p class="small" style="margin:0 0 10px;line-height:1.5">${esc(sv.about)}</p>
          ${(sv.who||[]).length ? `<div class="small muted" style="margin-bottom:6px">С какими запросами приходят:</div>
            ${(sv.who||[]).map(w => `<div class="achline"><span class="wdot"></span><span style="flex:1">${esc(w)}</span></div>`).join('')}` : ''}
          <div class="spread" style="margin-top:12px">
            <div>${sv.price === 0
              ? `<span class="price-l" style="color:var(--ok)">Бесплатно</span>`
              : `<span class="price-l">${money(off && sv.oldPrice ? sv.price : sv.price)}</span>
                 ${off && sv.oldPrice ? `<span class="old">${money(sv.oldPrice)}</span>` : ''}`}</div>
            <button class="btn sm acc" onclick="openSheet({k:'consult',id:'${attJs(e.id)}',sv:'${attJs(sv.id)}'})">
              ${sv.price === 0 ? 'Записаться' : 'Оставить заявку'}</button>
          </div>
        </div>`;
      }).join('') || '<div class="empty">Услуги пока не добавлены</div>'}
      <button class="btn ghost" onclick="openSheet({k:'write',id:'${attJs(e.id)}'})">Написать эксперту</button>

      <div class="card" style="border:1px dashed var(--line-2)">
        <b style="font-size:15px">Это открытая страница</b>
        <p class="small muted" style="margin:8px 0 12px">Материалы ${esc(e.n.split(' ')[0])} можно посмотреть без оплаты. С подпиской добавляется личная программа на каждый день, вся библиотека и сообщество.</p>
        <button class="btn ghost" onclick="closeExpert();openPage('sub')">Что входит в подписку</button>
      </div>
    </div>
  </div>`;
}

/* ---------- дата дня программы ---------- */
function dateOfDay(i){
  const d = new Date();
  d.setDate(d.getDate() - todayIdx() + i);
  return d;
}

/* ---------- подсказка дня ---------- */
/* Короткое послание с делом внутри вместо трёх абзацев справочника.
   Из чего оно сложилось — мелкой строкой под заголовком: кому интересно,
   тот прочитает, остальным не мешает. */
function dayAdvice(){
  const m = moon(), z = zodiac(S.birth.date), cy = cycleNow();
  const tip = dayTip();
  const act = tip.a ? TIP_ACTS[tip.a] : null;
  return `<div class="card advice">
    <div class="advhead">
      ${moonDisc(m, 46)}
      <div style="flex:1;min-width:0">
        <div class="eyebrow">Подсказка дня</div>
        <b class="serif" style="font-size:18px;display:block;margin-top:3px">${esc(tip.h)}</b>
      </div>
      ${hint('moon')}
    </div>
    <p class="advline">${esc(tip.t)}</p>
    <div class="advfoot">
      <div class="advwhy">${esc(dayWhy())}</div>
      <button class="tipstar ${tipStarred(tip.k) ? 'on' : ''}" id="tipstar"
        aria-pressed="${tipStarred(tip.k)}" aria-label="Отметить, что подсказка откликнулась"
        onclick="starTip('${attJs(tip.k)}')">${starMark(15, 'currentColor')}</button>
    </div>
    ${act ? `<button class="advgo" onclick="${act.go}">${esc(act.n)} ›</button>` : ''}
    ${!z || !cy ? `<button class="advmore" onclick="openPage('birth')">
      ${!z ? 'Добавить дату рождения' : 'Добавить даты цикла'} — подсказки станут точнее ›</button>` : ''}
  </div>`;
}

/* Веса подбора её словами. Числа те же, что в коде: если поменяем вес,
   поменяется и объяснение — расходиться им нельзя. */
const SIGNAL_NAMES = {
  request:'Твой запрос', topic:'Направления', stage:'Этап жизни',
  time:'Твоё время', fresh:'Новое для тебя', level:'Уровень', order:'Порядок редакции'
};
function whyWeights(){
  const max = Math.max(...Object.keys(SIGNALS).map(k => SIGNALS[k]));
  return Object.keys(SIGNALS)
    .sort((a, b) => SIGNALS[b] - SIGNALS[a])
    .map(k => `<div class="whyline">
      <span class="small" style="flex:1">${esc(SIGNAL_NAMES[k] || k)}</span>
      <div class="bar" style="width:96px"><i style="width:${Math.round(SIGNALS[k] / max * 100)}%"></i></div>
    </div>`).join('');
}

function dropTag(t){ S.tags = S.tags.filter(x => x !== t); buildProgram(); render(); toast('Тема убрана, программа обновлена'); }
function addTag(t){ if(!S.tags.includes(t)) S.tags.push(t); buildProgram(); S.sheet = null; render(); toast('Тема добавлена'); }

/* ---------- иконки быстрых действий ---------- */
const QI = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
  stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const QICON = {
  calendar: QI('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/><circle cx="12" cy="15" r="1.6" fill="currentColor" stroke="none"/>'),
  content:  QI('<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 9h10M7 13h7"/>'),
  report:   QI('<path d="M4 19V9M10 19V5M16 19v-7M21 19H3"/>'),
  eva:      QI('<path d="M12 3l2.2 6.3L20.5 12l-6.3 2.2L12 21l-2.2-6.8L3.5 12l6.3-2.7z"/>'),
  profile:  QI('<circle cx="12" cy="8" r="3.4"/><path d="M4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6"/>')
};
const LOCK_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
  stroke-linecap="round"><rect x="5" y="10.5" width="14" height="10" rx="3"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></svg>`;


/* ---------- живые приветствия ---------- */
function bumpVisit(){
  const today = new Date().toDateString();
  S.visits = S.visits || {day:'', n:0};
  if(S.visits.day !== today){ S.visits = {day:today, n:1}; }
  else S.visits.n++;
  schedulePersit_safe();
}
function schedulePersit_safe(){ try{ schedulePersist(); }catch(e){} }

function greetingLine(){
  const v = (S.visits && S.visits.n) || 1;
  const h = new Date().getHours();
  const day = S.program[S.day] || {tasks:[]};
  const left = day.tasks.filter(t => !t.done).length;
  const total = day.tasks.length;
  const done = total - left;
  const cy = cycleNow();
  const name = S.name || 'Ева';
  const wd = new Date().toLocaleDateString('ru-RU',{weekday:'long'});
  const Wd = wd[0].toUpperCase() + wd.slice(1);
  const nextCourse = COURSES.filter(c => !c.draft && !S.courses.includes(c.id))[0];

  if(total && done === total){
    const praise = [
      `Ты закрыла все три задания. Это целый день, который ты провела на своей стороне - и таких звёзд у тебя уже ${S.starsAll || S.stars}.`,
      `Три из трёх. Ты не просто выполнила программу, ты выбрала себя сегодня. Отдыхай спокойно.`,
      `День закрыт полностью. Знаешь, что самое ценное? Не сами практики, а то, что ты возвращаешься к ним снова.`
    ][v % 3];
    return nextCourse
      ? `${praise} Если захочется глубже - посмотри курс «${esc(nextCourse.t)}», первые уроки открыты бесплатно.`
      : praise;
  }
  if(done && left === 1)
    return `Осталось одно задание - ${day.tasks.find(t => !t.done).title.toLowerCase()}. Ты уже почти собрала полный день.`;
  if(S.gentle)
    return `Сегодня мягкий режим: аффирмация и мастер-класс, практику отложили. Так тоже считается.`;
  if(cy && cy.phase.k === 'menstrual' && v <= 2)
    return `${Wd}, день ${cy.day} цикла. Сил сейчас меньше - это физиология, а не лень. Возьми самое короткое задание и не требуй большего.`;
  if(cy && cy.phase.k === 'ovulation' && v <= 2)
    return `${Wd}, овуляторная фаза - пик энергии за весь цикл. Если откладывала сложный разговор или дело, сегодня лучший день.`;

  const morning = [
    `Доброе утро, ${name}. Рада тебя видеть. Начни с аффирмации - это одна минута, а тон дня она задаёт на весь день.`,
    `Ты прекрасна сегодня. Скажи это себе вслух перед зеркалом и посмотри, как изменится лицо. Потом можно и к практике.`,
    `Аффирмация дня: скажи вслух «вселенная, что за сюрприз ты мне сегодня приготовила?» - и весь день посматривай, что она ответит.`,
    `${Wd} только начинается, и он ещё ничей. Сделай первый вдох поглубже - и забирай его себе.`,
    `Не спеши включаться в чужие дела. Первые пять минут этого утра пусть будут только твоими.`
  ];
  const dayl = [
    `Ты уже в середине дня. Если он выдался тяжёлым - это не повод отменять заботу о себе, скорее наоборот.`,
    `Спроси себя честно: чего сейчас не хватает - тишины, воды или движения? С этого и начни, остальное подождёт.`,
    `${left ? `Осталось ${plural(left,'задание','задания','заданий')}, и ни одно не займёт больше получаса.` : 'На сегодня всё закрыто.'} Ты справляешься лучше, чем тебе кажется.`,
    `Маленький комплимент: ты продолжаешь возвращаться к себе даже тогда, когда некогда. Это редкое умение.`
  ];
  const evening = [
    `Вечер - время выдоха. Одна практика перед сном стоит трёх утренних обещаний себе.`,
    `Сегодня был день. Не идеальный, но твой - и он почти закончился. Давай завершим его мягко.`,
    `Скажи себе спасибо за сегодня, вслух и по-настоящему. А потом можно отдыхать с чистой совестью.`,
    `Если сил не осталось совсем - включи мягкий режим внизу. Одна минута сегодня всегда лучше, чем ноль.`
  ];
  const pool = h < 12 ? morning : h < 18 ? dayl : evening;
  return pool[(v - 1) % pool.length];
}

/* =====================================================================
   МАРКЕТ
   ===================================================================== */
function pgMarket(){
  const cats = ['Всё', ...new Set(GOODS.map(g => g.c))];
  const items = S.cat === 'Всё' ? GOODS : GOODS.filter(g => g.c === S.cat);
  const cnt = S.cart.reduce((a,c) => a + c.n, 0);
  return `<div class="view pad" style="padding-top:calc(20px + env(safe-area-inset-top))">
    <div class="spread">
      <div><div class="eyebrow">Маркет</div>
        <h1 class="serif" style="font-size:29px;margin:6px 0 0">Для твоих практик</h1></div>
      <button class="quick" style="width:46px;height:46px;padding:0;display:grid;place-items:center;position:relative" onclick="openPage('cart')">
        <i style="margin:0">🛒</i>
        ${cnt ? `<span style="position:absolute;top:-4px;right:-4px;background:var(--rose-deep);color:#fff;border-radius:99px;font-size:10px;font-weight:800;padding:2px 6px">${cnt}</span>` : ''}
      </button>
    </div>

    <div class="card" style="background:linear-gradient(120deg,var(--blush),var(--lilac-soft));margin-top:14px">
      <div class="row"><div style="font-size:24px">🎁</div>
        <div><b style="font-size:15px">${S.bonus} ₽ бонусами</b>
          <div class="small muted">Можно оплатить до 30% любого заказа</div></div></div>
    </div>

    <div class="chips">${cats.map(c => `<button class="chip ${S.cat===c?'on':''}" onclick="S.cat='${attJs(c)}';render()">${c}</button>`).join('')}</div>

    <div class="g2">
      ${items.map(g => `<div class="prod">
        <div class="ph" onclick="openGood('${attJs(g.id)}')">${goodPic(g)}${g.f?`<div class="flag">${g.f}</div>`:''}
          <span class="starcorner">${starBtn(g.id, 14)}</span></div>
        <div class="info">
          <div class="nm">${esc(g.t)}</div>
          <div style="margin:6px 0 10px"><span class="price">${money(g.p)}</span>${g.old?`<span class="old">${money(g.old)}</span>`:''}</div>
          <button class="btn sm" style="width:100%" onclick="addCart('${attJs(g.id)}')">＋ В корзину</button>
        </div>
      </div>`).join('')}
    </div>
  </div>`;
}

function pgCart(){
  const items = S.cart.map(c => ({...GOODS.find(g => g.id === c.id), n:c.n}));
  const total = items.reduce((a,i) => a + i.p*i.n, 0);
  const useBonus = Math.min(S.bonus, Math.round(total*0.3));
  const pay = total - useBonus;
  return `<div class="view pad">${backBtn('Маркет')}
    <h1 class="serif" style="font-size:28px;margin:10px 0 14px">Корзина</h1>
    ${!items.length ? `<div class="empty">Пока пусто.<br>Загляни в маркет - там есть коврик, который многие берут после первой недели практик.</div>
      <button class="btn ghost" onclick="go('market')">В маркет</button>` : `
      ${items.map(i => `<div class="card" style="padding:12px">
        <div class="row">
          <div style="width:66px;height:56px;border-radius:12px;overflow:hidden;flex:none">${goodPic(i)}</div>
          <div style="flex:1"><div style="font-weight:700;font-size:13.5px;line-height:1.3">${esc(i.t)}</div>
            <div class="price" style="font-size:14px;margin-top:4px">${money(i.p*i.n)}</div></div>
          <div class="row" style="gap:8px">
            <button class="chip" onclick="qty('${attJs(i.id)}',-1)">−</button>
            <b>${esc(i.n)}</b>
            <button class="chip" onclick="qty('${attJs(i.id)}',1)">＋</button>
          </div>
        </div></div>`).join('')}
      <div class="card">
        <div class="spread"><span class="muted small">Товары</span><b>${money(total)}</b></div>
        <div class="spread" style="margin-top:8px"><span class="muted small">Бонусами (до 30%)</span>
          <b style="color:var(--rose-deep)">−${money(useBonus)}</b></div>
        <div class="spread" style="margin-top:8px"><span class="muted small">Кэшбэк вернётся</span>
          <b style="color:var(--ok)">+${money(Math.round(total*0.05))}</b></div>
        <hr style="border:none;border-top:1px solid var(--line);margin:12px 0">
        <div class="spread"><b style="font-size:16px">К оплате</b><b class="price" style="font-size:19px">${money(pay)}</b></div>
      </div>
      <button class="btn" onclick="checkout()">Оформить заказ</button>`}
  </div>`;
}

/* =====================================================================
   СООБЩЕСТВО
   ===================================================================== */
/* =====================================================================
   ПРОФИЛЬ
   ===================================================================== */
function pgProfile(){
  const {cur, next} = levelNow();
  const pct = next ? Math.min(100, Math.round((S.points - cur.from)/(next.from - cur.from)*100)) : 100;
  const rate = REF_RATE[cur.id];
  const earned = INVITED.reduce((a,i) => a + Math.round(i.sum*rate/100), 0);
  const spent = S.purchases.reduce((a,p) => a + p.p, 0);
  const doneTasks = S.program.reduce((a,d) => a + d.tasks.filter(t => t.done).length, 0);
  const hw = Object.keys(S.homework||{}).length;
  const lessons = Object.values(S.lessons||{}).flat().filter(l => l.done).length;
  return `<div class="view">
    <div class="hero">
      ${sceneSVG(daypart())}
      <div class="brandbar">
        <button onclick="go('home')" style="color:#fff;font-size:20px;width:30px;text-align:left">‹</button>
        <div class="b">Личный кабинет</div>
        <button class="chip" style="background:rgba(255,255,255,.12);color:#fff;border-color:transparent"
          onclick="openPage('settings')">Настройки</button>
      </div>
      <div style="text-align:center;position:relative;z-index:2">
        <div style="margin:2px auto 10px;width:82px;position:relative">
          ${avatarEl(82)}
          <button class="camera" onclick="pickAvatar()">▣</button>
        </div>
        <h1 class="serif" style="font-size:24px;margin:0;color:#fff">${esc(S.name||'Ева')}</h1>
        <p class="small muted" style="margin:5px 0 0">${S.user ? esc(S.user.email) : ''}</p>
        <div class="mrow" style="display:flex;justify-content:center;gap:7px;margin-top:12px;flex-wrap:wrap">
          <span class="mstat">${esc(cur.e)} ${esc(cur.n)}</span>
          <span class="mstat">${S.sub.active ? (S.sub.plan==='year'?'годовая подписка':'подписка') + ', ' + plural(subLeft(),'день','дня','дней') : trialLeft() ? 'пробный, ' + plural(trialLeft(),'день','дня','дней') : 'доступ закрыт'}</span>
        </div>
      </div>
      <div class="bar" style="background:rgba(255,255,255,.2);margin:16px 0 8px"><i style="width:${pct}%"></i></div>
      <div class="small muted" style="text-align:center">${next ? `${next.from - S.points} баллов до статуса «${esc(next.n)}»` : 'высший статус'}</div>
    </div>

    <div class="pad" style="padding-top:16px">
      <div class="sec-h" style="margin-top:0"><h2 class="serif">Статистика</h2>
        <button class="link" onclick="openPage('report')">Отчёт недели</button></div>
      <div class="g3">
        <div class="stat"><b style="font-size:19px">${S.starsAll || S.stars}</b><div class="small muted">звёзд всего</div></div>
        <div class="stat"><b style="font-size:19px">${streak()}</b><div class="small muted">дней подряд</div></div>
        <div class="stat"><b style="font-size:19px">${S.points}</b><div class="small muted">баллов</div></div>
      </div>
      <div class="card" style="margin-top:10px">
        <div class="uline" style="border:none;padding-top:0"><span class="small muted" style="flex:1">Заданий выполнено</span>
          <b style="font-size:13px">${doneTasks} из ${starsTotal()}</b></div>
        <div class="uline"><span class="small muted" style="flex:1">Уроков курсов пройдено</span><b style="font-size:13px">${lessons}</b></div>
        <div class="uline"><span class="small muted" style="flex:1">Домашних заданий сдано</span><b style="font-size:13px">${hw}</b></div>
        <div class="uline"><span class="small muted" style="flex:1">Групп в сообществе</span><b style="font-size:13px">${S.joined.length}</b></div>
        <div class="uline"><span class="small muted" style="flex:1">Мероприятий</span><b style="font-size:13px">${(S.myEvents||[]).length}</b></div>
      </div>

      <div class="sec-h"><h2 class="serif">Почему такая программа</h2>${hint('match')}</div>
      <div class="card">
        <div class="row" style="align-items:flex-start">
          ${donutLight(S.match)}
          <p class="small muted" style="margin:0">Ева сравнила твои ответы с ${LIB.length} материалами библиотеки
            и оценила каждый по семи признакам: насколько он про твой запрос, попадает ли
            в выбранные направления, подходит ли твоему этапу и уровню, влезает ли
            в ${S.time} минут и давно ли ты его видела.</p>
        </div>
        <div class="small muted" style="margin:14px 0 8px">Что было решающим:</div>
        <div class="whyrow">${whyWeights()}</div>
        <p class="small muted" style="margin:12px 0 0">В будни остаётся то, что влезает
          в твои минуты, длинное уходит на выходные. Внутри недели ничего не повторяется,
          а на следующей первым вернётся самое давнее.</p>
        <div class="small muted" style="margin:14px 0 8px">Твои темы — можно убрать лишнее или добавить новое:</div>
        <div class="chips wrap">
          ${S.tags.map(t => `<button class="chip on" onclick="dropTag('${attJs(t)}')">${esc(t)} <span style="opacity:.6">✕</span></button>`).join('')}
          <button class="chip" onclick="openSheet('addTag')">＋ тема</button>
        </div>
        <button class="btn ghost" style="margin-top:12px" onclick="openSheet('rebuild')">Пересобрать программу</button>
      </div>

      <div class="sec-h"><h2 class="serif">Зарабатывай вместе с Евой</h2>${hint('earn')}</div>
      <div class="card" style="background:var(--grad-dark);color:#fff;border-color:transparent">
        <div class="g2">
          <div><div class="small" style="opacity:.7">Начислено всего</div>
            <div class="serif" style="font-size:26px;margin-top:3px">${money(earned)}</div></div>
          <div><div class="small" style="opacity:.7">Твоя ставка</div>
            <div class="serif" style="font-size:26px;margin-top:3px">${rate}%</div></div>
        </div>
        <div class="linkbox" style="background:rgba(255,255,255,.12);color:#fff;margin-top:12px">
          eva.space/r/${esc((S.name||'eva').toLowerCase())}</div>
        <div class="acts">
          <button class="btn" style="background:#fff;color:var(--ink)" onclick="copyRef()">Скопировать ссылку</button>
          <button class="btn ghost" style="background:rgba(255,255,255,.14);color:#fff;border-color:rgba(255,255,255,.2)"
            onclick="withdraw(${earned})">Вывести</button>
        </div>
      </div>

      <div class="card">
        <b style="font-size:14.5px">Кто пришёл по ссылке</b>
        <div class="small muted" style="margin:4px 0 8px">${plural(INVITED.length,'подруга','подруги','подруг')} · ${INVITED.filter(i=>i.sum).length} с покупками</div>
        ${INVITED.map(i => `<div class="uline">
          <div class="dot-ava" style="width:28px;height:28px;font-size:11px;background:var(--lilac)">${i.n[0]}</div>
          <div style="flex:1"><b style="font-size:12.5px">${esc(i.n)}</b>
            <div class="small muted">${esc(i.ago)}</div></div>
          <b style="font-size:12.5px;color:${i.sum?'var(--ok)':'var(--muted)'}">
            ${i.sum ? '+'+money(Math.round(i.sum*rate/100)) : 'без покупок'}</b>
        </div>`).join('')}
        <button class="btn ghost" style="margin-top:10px" onclick="openPage('earn')">Условия и статусы</button>
      </div>

      <div class="sec-h"><h2 class="serif">Покупки</h2>
        <span class="small muted">${spent ? 'на ' + money(spent) : ''}</span></div>
      ${S.purchases.length ? S.purchases.map(p => `<div class="card" style="padding:12px">
        <div class="spread"><div style="flex:1"><b style="font-size:13.5px">${esc(p.t)}</b>
          <div class="small muted">${p.date}</div></div>
          <div style="text-align:right"><b style="font-size:13.5px">${money(p.p)}</b>
            ${p.cb?`<div class="small" style="color:var(--ok)">+${p.cb} бонусов</div>`:''}</div></div>
      </div>`).join('') : '<div class="empty">Покупок пока нет</div>'}

      ${[['inbox','Сообщения', unreadCount() ? 'Непрочитанных: ' + unreadCount() : 'Приглашения и ответы экспертов'],
         ['points','Баллы и бонусы','Механика начисления и статусы'],
         ['moon','Лунный календарь','Фаза дня и подсказки'],
         ['cycle','Календарь цикла','День цикла и рекомендации'],
         ['birth','Дата рождения и цикл','Human Design, знак, персональный портрет'],
         ['sub','Подписка', subLabel()],
         ['settings','Настройки','Уведомления, пароль, оплаты, контакты']].map(([k,t,d]) =>
        `<button class="card" style="width:100%;text-align:left;padding:13px" onclick="openPage('${attJs(k)}')">
          <div class="row"><div style="flex:1"><b style="font-size:14px">${t}</b>
            <div class="small muted" style="margin-top:2px">${d}</div></div>
            <span class="muted">›</span></div></button>`).join('')}

      <button class="card" style="width:100%;text-align:left;padding:13px" onclick="openIdea()">
        <div class="row"><div style="flex:1"><b style="font-size:14px">Предложить доработку</b>
          <div class="small muted" style="margin-top:2px">Идея уходит команде, +5 баллов</div></div>
          <span class="muted">›</span></div></button>
    </div>
  </div>`;
}

function withdraw(sum){
  if(sum < 3000) return toast('Вывод доступен от 3 000 ₽, сейчас ' + money(sum));
  toast('Заявка на вывод принята, деньги придут в течение трёх дней');
}

function pgEarn(){
  const {cur} = levelNow();
  const rate = REF_RATE[cur.id];
  const earned = INVITED.reduce((a,i) => a + Math.round(i.sum*rate/100), 0);
  const link = 'eva.space/r/' + (S.name||'eva').toLowerCase();
  return `<div class="view pad">${backBtn('Профиль')}
    <div class="spread"><h1 class="serif" style="font-size:26px;margin:10px 0 4px">Зарабатывай с Евой</h1>${hint('earn')}</div>
    <p class="small muted" style="margin:0 0 14px">Приглашай подруг - получай награду с их покупок. Чем выше статус, тем больше процент.</p>

    <div class="card" style="background:var(--grad-dark);color:#fff;border-color:transparent">
      <div class="g2">
        <div><div class="small" style="opacity:.7">Начислено за всё время</div>
          <div class="serif" style="font-size:28px;margin-top:4px;color:#fff">${money(earned)}</div></div>
        <div><div class="small" style="opacity:.7">Твоя награда</div>
          <div class="serif" style="font-size:28px;margin-top:4px;color:#fff">${rate}%</div></div>
      </div>
      <button class="btn" style="background:#fff;color:var(--ink);margin-top:14px" onclick="withdraw(${earned})">
        Вывести на карту</button>
      <p class="small" style="opacity:.65;margin:8px 0 0;text-align:center">Вывод от 3 000 ₽, раз в месяц</p>
    </div>

    <div class="reflink">
      <div class="eyebrow" style="color:var(--accent)">Твоя ссылка</div>
      <div class="reflink-url">${link}</div>
      <p class="small muted" style="margin:8px 0 12px">Подруга перейдёт по ней, зарегистрируется и получит
        <b>300 бонусов</b> на первый заказ. Ты будешь получать ${rate}% со всех её покупок в течение года.</p>
      <div class="acts" style="margin:0">
        <button class="btn" onclick="copyRef()">Скопировать ссылку</button>
        <button class="btn ghost" onclick="shareRef()">Поделиться</button>
      </div>
    </div>

    <div class="card" style="background:linear-gradient(150deg,#F3EFFA,#FBF1F4);border-color:transparent">
      <b style="font-size:15px">Вдохновляй своим примером</b>
      <p class="small muted" style="margin:7px 0 0">Женщины приходят не по рекламе, а за живым примером.
        Расскажи, что у тебя изменилось за эти недели: как стал спать, как перестала извиняться за отдых,
        какую практику полюбила. Это работает сильнее любых обещаний.</p>
      <div class="chips wrap" style="margin-top:10px">
        ${['Рассказать в сторис','Позвать подругу лично','Поделиться в чате мам','Написать пост'].map(t =>
          `<span class="chip pale">${t}</span>`).join('')}
      </div>
    </div>

    <div class="sec-h"><h2 class="serif">Статусы и награда</h2></div>
    ${LEVELS.map(l => {
      const on = cur.id === l.id, has = S.points >= l.from;
      return `<div class="card" style="${on?'border-color:var(--ink);border-width:1.5px':''}">
        <div class="spread">
          <div class="row"><div class="lvlmark ${has?'has':''}">${has?'✓':l.e}</div>
            <div><b style="font-size:14.5px">${esc(l.n)}</b>${on?'<span class="chip pale" style="margin-left:7px;padding:2px 8px">сейчас</span>':''}
              <div class="small muted" style="margin-top:2px">${l.from ? 'от '+l.from+' баллов' : 'с первого дня'}</div></div></div>
          <b style="font-size:17px;color:${has?'var(--accent)':'var(--muted)'}">${REF_RATE[l.id]}%</b>
        </div>
        <ul style="margin:10px 0 0;padding-left:18px;font-size:12.5px;color:var(--muted);line-height:1.7">
          ${l.perks.map(p => `<li>${p}</li>`).join('')}</ul>
      </div>`;
    }).join('')}

    <div class="sec-h"><h2 class="serif">Кто пришёл по ссылке</h2>
      <span class="small muted">${INVITED.length}</span></div>
    ${INVITED.map(i => `<div class="card" style="padding:12px">
      <div class="spread">
        <div class="row"><div class="dot-ava" style="background:var(--lilac)">${i.n[0]}</div>
          <div><b style="font-size:13.5px">${esc(i.n)}</b><div class="small muted">${esc(i.ago)}</div></div></div>
        <b style="font-size:13.5px;color:${i.sum?'var(--ok)':'var(--muted)'}">
          ${i.sum ? '+'+money(Math.round(i.sum*rate/100)) : 'пока без покупок'}</b>
      </div></div>`).join('')}
  </div>`;
}
function shareRef(){
  const url = 'https://eva.space/r/' + (S.name||'eva').toLowerCase();
  const text = 'Я занимаюсь в Eva Space - там личная программа на каждый день. Заходи по моей ссылке, тебе дадут 300 бонусов: ' + url;
  if(navigator.share) navigator.share({title:'Eva Space', text}).catch(()=>{});
  else { if(navigator.clipboard) navigator.clipboard.writeText(text).catch(()=>{}); toast('Текст приглашения скопирован'); }
}

