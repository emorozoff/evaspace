/* =====================================================================
   АДМИН-ПАНЕЛЬ v2
   ===================================================================== */
const USERS = [
  {id:'u1', n:'Настя Ковалёва', m:'nastya.k@mail.ru', tg:'@nastya_k', role:'ученица', pay:'paid', since:'12.05', sum:2900, note:'', st:'', last:'сегодня'},
  {id:'u2', n:'Ирина Дёмина', m:'irina.demina@gmail.com', tg:'@irinad', role:'ученица', pay:'trial', since:'02.08', sum:0, note:'', st:'думает', last:'сегодня'},
  {id:'u3', n:'Камила Юсупова', m:'kamila@yandex.ru', tg:'@kamila_y', role:'ученица', pay:'none', since:'28.07', sum:0, note:'Писала, что дорого', st:'оплатит позже', last:'3 дня назад'},
  {id:'u4', n:'Лена Соболева', m:'sobol.lena@mail.ru', tg:'@lenasobol', role:'ученица', pay:'paid', since:'19.04', sum:8700, note:'Купила два курса', st:'', last:'вчера'},
  {id:'u5', n:'Юля Ветрова', m:'yulia.v@gmail.com', tg:'@yulia_vet', role:'ученица', pay:'trial', since:'04.08', sum:0, note:'', st:'', last:'сегодня'},
  {id:'u6', n:'Даша Ким', m:'dasha.kim@mail.ru', tg:'@dashakim', role:'ученица', pay:'none', since:'11.06', sum:1450, note:'Отказ: не хватает времени', st:'отказ', last:'2 недели назад'},
  {id:'u7', n:'Марина Ясная', m:'marina@evaspace.ru', tg:'@marina_yasnaya', role:'эксперт', pay:'paid', since:'03.01', sum:0, note:'Ведёт 2 курса', st:'', last:'сегодня'},
  {id:'u8', n:'Ксения Роот', m:'ksenia@evaspace.ru', tg:'@ksenia_root', role:'эксперт', pay:'paid', since:'17.02', sum:0, note:'', st:'', last:'вчера'},
  {id:'u9', n:'Ольга Светлова', m:'olga.s@evaspace.ru', tg:'@olga_sv', role:'эксперт', pay:'paid', since:'22.06', sum:0, note:'Ждёт верификации', st:'', last:'сегодня'}
];

const ADMIN_TABS = [
  ['content','Контент','▤'], ['moderate','Модерация','◷'], ['courses','Курсы','▶'],
  ['market','Маркет','◧'], ['community','Сообщество','◈'], ['users','Пользователи','◉']
];

/* ---------- служба поддержки ---------- */
const INBOX = [
  {id:'t1', from:'Ирина Дёмина', role:'ученица', mail:'irina.demina@gmail.com', ago:'12 мин назад',
   sub:'Не приходит письмо с подтверждением', t:'Зарегистрировалась час назад, письма нет ни во входящих, ни в спаме. Проверьте, пожалуйста.', st:'новое'},
  {id:'t2', from:'Ольга Светлова', role:'эксперт', mail:'olga.s@evaspace.ru', ago:'1 ч назад',
   sub:'Когда проверят мой мастер-класс', t:'Загрузила «Как говорить о деньгах в паре» вчера, статус всё ещё на проверке. Подскажите сроки.', st:'новое'},
  {id:'t3', from:'Камила Юсупова', role:'ученица', mail:'kamila@yandex.ru', ago:'вчера',
   sub:'Списание после пробного периода', t:'Хочу отменить подписку до окончания трёх дней, чтобы не списалось. Как это сделать?', st:'в работе'},
  {id:'t4', from:'Тая Мирная', role:'эксперт', mail:'taya@evaspace.ru', ago:'2 дня назад',
   sub:'Хочу добавить мероприятие', t:'Планирую встречу мам 16 августа онлайн. Как добавить её в раздел мероприятий?', st:'закрыто'}
];

function pgAdmin(){
  if(S.page === 'goodEditor') return pgGoodEditor();
  if(S.viewGood) return pgGood();
  if(S.viewExpert) return pgExpertPage();
  if(S.chat && S.chat.open) return pgChatRoom();
  if(S.editItem) return pgEditItem();
  if(S.editCourse) return S.editUnit ? pgEditUnit() : pgEditCourse();
  const pend = S.pending.filter(x => x.status === 'pending').length;
  return `<div class="view">
    <div class="hero">
      <div class="brandbar">
        <button class="row" style="gap:8px" onclick="pickAdminAvatar()">
          ${S.adminAvatar
            ? `<img src="${S.adminAvatar}" alt="" style="width:30px;height:30px;border-radius:50%;object-fit:cover">`
            : `<span class="ava" style="width:30px;height:30px;font-size:12px;background:var(--gold)">${esc((S.adminName||'К')[0])}</span>`}
          <span class="b" style="margin:0">${esc(S.adminName || 'Куратор')}</span>
        </button>
        <div class="row" style="gap:7px">
          <button class="mailbtn2" onclick="S.adminTab='inbox';render()" aria-label="Сообщения">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
              <rect x="3" y="5" width="18" height="14" rx="3"/><path d="M4 7l8 6 8-6"/></svg>
            ${INBOX.filter(t => t.st === 'новое').length ? `<i class="mdot">${INBOX.filter(t => t.st === 'новое').length}</i>` : ''}
          </button>
          <button class="chip" style="background:rgba(255,255,255,.12);color:#fff;border-color:transparent" onclick="enterDemo()">Платформа</button>
          <button class="chip" style="background:rgba(255,255,255,.12);color:#fff;border-color:transparent" onclick="logout()">Выйти</button>
        </div>
      </div>
      <h1 class="serif" style="font-size:23px;margin:0">${({content:'Управление контентом', moderate:'Модерация', courses:'Курсы',
        stats:'Статистика', users:'База пользователей', community:'Сообщества',
        ideas:'Идеи и доработки', inbox:'Поддержка', events:'Мероприятия', market:'Маркет'})[S.adminTab]}</h1>
      <p class="small muted" style="margin:5px 0 0">${LIB.length} материалов · ${COURSES.length} курсов · ${STATS.users.toLocaleString('ru-RU')} пользователей</p>
      <div class="atabs grid six">
        ${ADMIN_TABS.map(([k,l,i]) => `<button class="${S.adminTab===k?'on':''}" onclick="S.adminTab='${k}';S.tagSort=null;render()">
          ${i} ${l}${k==='moderate'&&pend?`<span class="cnt">${pend}</span>`:''}</button>`).join('')}
      </div>
    </div>
    <div class="pad" style="padding-top:16px">
      ${syncStatusLine()}
      ${S.adminTab === 'content' ? adminHello() : ''}
      ${({content:adContent, moderate:adModerate, courses:adCourses, stats:adStats,
          users:adUsers, community:adCommunity, ideas:adIdeas,
          inbox:adInbox, events:adEvents, market:adMarket})[S.adminTab]()}
    </div>
  </div>`;
}

/* ---------- контент ---------- */
function adContent(){
  const type = S.cType || 'practice';
  let items = LIB.filter(x => x.type === type);
  const tags = [...new Set(items.flatMap(x => x.tags))].sort();
  if(S.tagSort) items = items.filter(x => x.tags.includes(S.tagSort));
  if(S.cQuery) items = items.filter(x => (x.title+x.expert).toLowerCase().includes(S.cQuery.toLowerCase()));
  return `
  <div class="acts" style="margin:0 0 12px">
    <button class="btn" onclick="openSheet('newContent')">＋ Материал</button>
    <button class="btn ghost" onclick="openSheet('newCourse')">＋ Курс</button>
  </div>

  <div class="seg">
    ${Object.entries(TYPE).map(([k,v]) => `<button class="${type===k?'on':''}"
      onclick="S.cType='${k}';S.tagSort=null;render()">${v.l} · ${LIB.filter(x=>x.type===k).length}</button>`).join('')}
  </div>

  <input class="field" placeholder="Поиск по названию или автору" value="${esc(S.cQuery||'')}" oninput="S.cQuery=this.value;render()">

  <div class="chips">
    <button class="chip ${!S.tagSort?'on':''}" onclick="S.tagSort=null;render()">все теги</button>
    ${tags.map(t => `<button class="chip ${S.tagSort===t?'on':''}" onclick="S.tagSort='${t}';render()">${t}
      <span style="opacity:.5">${LIB.filter(x=>x.type===type&&x.tags.includes(t)).length}</span></button>`).join('')}
  </div>

  <div class="small muted" style="margin-bottom:10px">${plural(items.length,'материал','материала','материалов')}
    · бесплатных ${items.filter(x=>x.free).length}</div>
  ${items.map(x => adminItemCard(x, {del:true})).join('') || '<div class="empty">Ничего не найдено</div>'}`;
}

/* ---------- модерация ---------- */
function adModerate(){
  const pend = S.pending.filter(x => x.status === 'pending');
  const rew = S.pending.filter(x => x.status === 'rework');
  const done = S.pending.filter(x => x.status === 'live' || x.status === 'rejected');
  const card = x => `
    <div class="acard">
      <button class="cov" style="height:170px;position:relative;width:100%" onclick="openEditor('${x.id}')">
        ${cover(x.id, x.type)}
        <div class="badge">${TYPE[x.type].l} · ${x.min} мин</div>
        ${x.type !== 'affirm' ? '<div class="play">▶</div>' : ''}
        <div class="cap"><b>${esc(x.title)}</b><span>${esc(x.expert)} · прислан ${x.sent}</span></div>
      </button>
      <div style="padding:13px">
        <p class="small" style="margin:0 0 10px">${esc(x.text)}</p>
        <div class="chips wrap">${x.tags.map(t => `<span class="chip pale">${t}</span>`).join('')}</div>
        <div class="small muted" style="margin:8px 0 0">
          Видео: ${x.video ? esc(x.video.slice(0,34)) : 'не приложено'} · Обложка: ${MEDIA[x.id] ? 'своя' : 'авто'}
          · ${x.free ? 'бесплатный' : 'по подписке'}</div>
        <div class="acts">
          <button class="btn" onclick="approve('${x.id}')">Одобрить</button>
          <button class="btn ghost" onclick="openSheet({k:'rework',id:'${x.id}'})">На доработку</button>
        </div>
        <div class="acts">
          <button class="btn ghost" onclick="openSheet({k:'reject',id:'${x.id}'})">Отказать</button>
          <button class="btn ghost" onclick="openEditor('${x.id}')">Открыть и править</button>
        </div>
      </div>
    </div>`;
  const eq = eduQueue();
  return `
  ${eq.length ? `<div class="card" style="border-color:var(--lilac)">
    <b style="font-size:14.5px">Документы на проверке</b>
    <div class="small muted" style="margin:4px 0 10px">Дипломы и сертификаты экспертов. Сканы видят только администраторы.</div>
    ${eq.map(({e,x}) => `<div class="uline">
      <div class="dot-ava" style="width:28px;height:28px;font-size:10px;background:var(--lilac)">${e.n[0]}</div>
      <div style="flex:1"><b style="font-size:12.5px">${esc(x.t)}</b>
        <div class="small muted">${e.n}${x.y?' · '+x.y:''}${MEDIA['cert_'+x.id]?' · скан загружен':' · без скана'}</div></div>
      <button class="btn xs" onclick="openSheet({k:'eduCheck',eid:'${e.id}',id:'${x.id}'})">Открыть</button>
    </div>`).join('')}
  </div>` : ''}
  <p class="small muted" style="margin:0 0 12px">Нажми на обложку, чтобы открыть материал целиком: видео, описание, теги и доступ.</p>
  ${pend.length ? pend.map(card).join('') : '<div class="empty">Новых материалов нет</div>'}

  ${rew.length ? `<div class="sec-h"><h2 class="serif">У экспертов на доработке</h2><span class="small muted">${rew.length}</span></div>
    ${rew.map(x => `<div class="arow2">
      <div class="mini">${cover(x.id,x.type)}</div>
      <div style="flex:1"><b style="font-size:13px">${esc(x.title)}</b>
        <div class="small muted">${esc(x.expert)}</div>
        <div class="small" style="color:var(--warn);margin-top:3px">${esc(x.comment||'')}</div></div>
      <span class="tag-st st-trial">доработка</span>
    </div>`).join('')}` : ''}

  ${done.length ? `<div class="sec-h"><h2 class="serif">Обработано</h2></div>
    ${done.map(x => `<div class="arow2">
      <div class="mini">${cover(x.id,x.type)}</div>
      <div style="flex:1"><b style="font-size:13px">${esc(x.title)}</b>
        <div class="small muted">${esc(x.expert)}${x.comment?' · '+esc(x.comment.slice(0,40)):''}</div></div>
      <span class="tag-st ${x.status==='live'?'st-paid':'st-no'}">${x.status==='live'?'опубликован':'отклонён'}</span>
    </div>`).join('')}` : ''}`;
}

function approve(id){
  const x = S.pending.find(i => i.id === id);
  x.status = 'live';
  LIB.push({id:x.id, type:x.type, title:x.title, expert:x.expert, min:x.min, tags:x.tags, text:x.text, status:'live'});
  pushShared(); render(); toast('Опубликовано в библиотеке');
}
function rework(id){
  const c = (($('#rc')||{}).value || '').trim();
  if(!c) return toast('Напиши, что поправить');
  const x = S.pending.find(i => i.id === id);
  x.status = 'rework'; x.comment = c;
  S.sheet = null; pushShared(); render(); toast('Отправлено эксперту на доработку');
}
function reject(id){
  const c = (($('#rc')||{}).value || '').trim();
  const x = S.pending.find(i => i.id === id);
  x.status = 'rejected'; x.comment = c || 'Без комментария';
  S.sheet = null; pushShared(); render(); toast('Отклонено');
}

/* ---------- курсы ---------- */
function adCourses(){
  return `
  <button class="btn" onclick="openSheet('newCourse')">＋ Создать курс</button>
  <div class="sec-h"><h2 class="serif">Каталог</h2><span class="small muted">${COURSES.length}</span></div>
  ${COURSES.map(c => {
    const ls = lessonsOf(c.id), mods = modulesOf(c.id);
    return `<div class="acard">
      <button class="cov catcov" style="height:140px;position:relative;width:100%" onclick="openCourseEditor('${c.id}')">
        ${cover(c.id,'course')}
        <div class="badge">${COURSE_KIND[c.id]}</div>
        <div class="cap"><b>${c.t}</b><span>${c.e} · ${mods.length} модуля · ${ls.length} уроков</span></div>
      </button>
      <div style="padding:12px">
        <div class="spread"><span class="price">${money(c.p)}</span>
          <span class="small muted">${c.s.toLocaleString('ru-RU')} продаж · ★ ${c.r}</span></div>
        <div class="small muted" style="margin-top:5px">
          Открытых уроков: ${ls.filter(l => l.free).length} · промо: ${(S.videos&&S.videos[c.id+'_promo'])?'есть':'нет'}</div>
        <div class="acts">
          <button class="btn ghost sm" onclick="openCourseEditor('${c.id}')">Редактировать</button>
          <button class="btn ghost sm" onclick="openCourseLanding('${c.id}')">Просмотр</button>
        </div>
      </div>
    </div>`;
  }).join('')}`;
}

/* ---------- статистика ---------- */
function adStats(){
  const s = STATS;
  const period = S.statPeriod || 'месяц';
  const topCourses = COURSES.map(c => ({...c, rev:c.p*Math.round(c.s*0.02)})).sort((a,b) => b.rev - a.rev);
  return `
  <div class="seg">${['неделя','месяц','квартал'].map(p =>
    `<button class="${period===p?'on':''}" onclick="S.statPeriod='${p}';render()">${p}</button>`).join('')}</div>

  <div class="g2">
    ${[['Пользователей', s.users.toLocaleString('ru-RU'), '+8,2%'],
       ['Платных', s.paid.toLocaleString('ru-RU'), '+4,1%'],
       ['Выручка', money(s.revenue), '+11,6%'],
       ['ARPU', money(s.arpu), '+2,3%'],
       ['DAU', s.dau.toLocaleString('ru-RU'), '−1,4%'],
       ['Конверсия в оплату', Math.round(s.paid/s.users*100)+'%', '+0,9%']].map(([l,v,d]) =>
      `<div class="card" style="margin:0"><div class="small muted">${l}</div>
        <div class="serif" style="font-size:22px;margin:4px 0 2px">${v}</div>
        <div class="small" style="color:${d[0]==='−'?'var(--accent)':'var(--ok)'};font-weight:700">${d}</div></div>`).join('')}
  </div>

  <div class="card" style="margin-top:12px">
    <b style="font-size:14.5px">Удержание по дням программы</b>
    <div class="rep">${s.retention.map((n,i) => `<div><i style="height:${n/100*84}px"></i><span>${i+1}</span></div>`).join('')}</div>
    <div class="small muted">До седьмого дня доходит ${s.retention[6]}%. Основной отвал между вторым и третьим днём - там стоит добавить напоминание.</div>
  </div>

  <div class="card">
    <b style="font-size:14.5px">Воронка</b>
    ${s.funnel.map(([l,n]) => `<div style="margin-top:10px">
      <div class="spread" style="margin-bottom:4px"><span class="small">${l}</span>
        <span class="small muted">${n.toLocaleString('ru-RU')} · ${Math.round(n/s.funnel[0][1]*100)}%</span></div>
      <div class="bar"><i style="width:${n/s.funnel[0][1]*100}%"></i></div></div>`).join('')}
  </div>

  <div class="card">
    <b style="font-size:14.5px">Просмотры видео и вовлечённость</b>
    ${s.topContent.map(c => `<div style="margin-top:10px">
      <div class="spread" style="margin-bottom:4px"><span class="small">${c.t}</span>
        <span class="small muted">${c.v.toLocaleString('ru-RU')} · досмотр ${c.done}%</span></div>
      <div class="bar"><i style="width:${c.done}%"></i></div></div>`).join('')}
    <div class="small muted" style="margin-top:12px">Средний досмотр по библиотеке - 71%. Мастер-классы длиннее 30 минут теряют около четверти зрителей на середине.</div>
  </div>

  <div class="card">
    <b style="font-size:14.5px">Самые покупаемые курсы</b>
    ${topCourses.slice(0,5).map((c,i) => `<div class="trow" style="padding:9px 0">
      <span class="muted" style="font-size:12px;width:16px">${i+1}</span>
      <div style="flex:1"><b style="font-size:13px">${c.t}</b>
        <div class="small muted">${c.e}</div></div>
      <div style="text-align:right"><b style="font-size:13px">${money(c.rev)}</b>
        <div class="small muted">${Math.round(c.s*0.02)} продаж</div></div>
    </div>`).join('')}
  </div>

  <div class="card">
    <b style="font-size:14.5px">Активность в сообществах</b>
    ${GROUPS.slice(0,4).map(g => `<div class="spread" style="margin-top:9px">
      <span class="small">${g.e} ${g.t}</span>
      <span class="small muted">${(hash(g.id)%400+80)} сообщений · ${g.m.toLocaleString('ru-RU')} участниц</span></div>`).join('')}
  </div>`;
}

/* ---------- пользователи ---------- */
function allUsers(){
  const reg = Object.values(DB.users()).map(u => ({
    id:u.email, n:u.name, m:u.email, tg:u.tg || '—', role:u.role === 'expert' ? 'эксперт' : u.role === 'admin' ? 'админ' : 'ученица',
    pay:u.paid ? 'paid' : 'trial', since:new Date(u.created||Date.now()).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit'}),
    sum:0, note:u.note||'', st:u.st||'', last:'сегодня', real:true, gift:!!u.gift, offer:u.offer||'',
    verified:u.verified, days:Math.max(0, (u.trialDays||3) - Math.floor((Date.now()-(u.created||Date.now()))/864e5)), eng:70
  }));
  const demo = USERS.map(u => ({...u, verified:true, days:u.pay==='trial'?2:0, eng:(hash(u.id)%60)+35}));
  return [...reg, ...demo];
}

function adUsers(){
  const f = S.userFilter || 'все';
  const filters = ['все','платные','пробный','не оплатили','эксперты','вовлечённые'];
  let list = allUsers();
  const total = list.length;
  const paid = list.filter(u => u.pay === 'paid' && u.role === 'ученица').length;
  const trial = list.filter(u => u.pay === 'trial').length;
  const eng = list.filter(u => u.eng >= 60).length;

  if(f === 'платные') list = list.filter(u => u.pay === 'paid' && u.role === 'ученица');
  if(f === 'пробный') list = list.filter(u => u.pay === 'trial');
  if(f === 'не оплатили') list = list.filter(u => u.pay === 'none');
  if(f === 'эксперты') list = list.filter(u => u.role === 'эксперт');
  if(f === 'вовлечённые') list = list.filter(u => u.eng >= 60);
  if(S.uQuery) list = list.filter(u => (u.n+u.m+(u.tg||'')).toLowerCase().includes(S.uQuery.toLowerCase()));
  const sort = S.uSort || 'дата';
  list.sort((a,b) => sort === 'вовлечённость' ? b.eng - a.eng
    : sort === 'оплаты' ? (b.sum||0) - (a.sum||0) : String(a.n).localeCompare(String(b.n)));

  const PAY = {paid:['оплачено','st-paid'], trial:['пробный период','st-trial'], none:['без оплаты','st-none']};
  return `
  <div class="g4" style="margin-bottom:12px">
    ${[[total,'всего'],[paid,'платных'],[trial,'на пробном'],[eng,'вовлечённых']].map(([v,l]) =>
      `<div class="stat" style="padding:11px 4px"><b style="font-size:19px">${v}</b>
        <div class="small muted" style="font-size:10px">${l}</div></div>`).join('')}
  </div>
  ${Store.available ? '' : '<div class="small muted" style="margin-bottom:10px">Хранилище браузера недоступно в этой среде: показаны демо-данные. На домене или GitHub Pages сюда попадают реальные регистрации.</div>'}

  <input class="field" placeholder="Поиск по имени, почте или телеграму" value="${esc(S.uQuery||'')}" oninput="S.uQuery=this.value;render()">
  <div class="chips">${filters.map(x =>
    `<button class="chip ${f===x?'on':''}" onclick="S.userFilter='${x}';render()">${x}</button>`).join('')}</div>
  <div class="chips"><span class="small muted" style="align-self:center;margin-right:4px">Сортировка:</span>
    ${['дата','вовлечённость','оплаты'].map(x =>
      `<button class="chip ${sort===x?'on':''}" onclick="S.uSort='${x}';render()">${x}</button>`).join('')}</div>
  <div class="chips"><span class="small muted" style="align-self:center;margin-right:4px">Вид:</span>
    ${[['card','карточками'],['list','списком']].map(([k,l]) =>
      `<button class="chip ${(S.uView||'card')===k?'on':''}" onclick="S.uView='${k}';render()">${l}</button>`).join('')}</div>

  <div class="acts" style="margin-bottom:12px">
    <button class="btn" onclick="openSheet('addUser')">＋ Добавить вручную</button>
    <button class="btn ghost" onclick="exportUsers()">Выгрузить CSV</button>
  </div>

  <div class="small muted" style="margin-bottom:10px">${plural(list.length,'карточка','карточки','карточек')}</div>

  ${(S.uView||'card') === 'list' ? `<div class="tbl">
    <div class="trow head"><span style="flex:1">Пользователь</span><span style="width:70px">Доступ</span><span style="width:44px">Вовл.</span></div>
    ${list.map(u => `<button class="trow" style="width:100%;text-align:left" onclick="S.uOpen=S.uOpen==='${u.id}'?null:'${u.id}';S.uView='card';render()">
      ${avatarOf(u.m) ? avaImg(avatarOf(u.m), 26)
        : `<div class="dot-ava" style="width:26px;height:26px;font-size:10px;background:${u.role==='эксперт'?'var(--lilac)':'var(--ink)'}">${u.n[0]}</div>`}
      <div style="flex:1;min-width:0"><b style="font-size:12.5px;display:block">${u.n}</b>
        <div class="small muted" style="font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${u.m}</div></div>
      <span class="tag-st ${PAY[u.pay][1]}" style="width:70px;text-align:center;padding:3px 4px;font-size:9px">${u.gift?'подарен':PAY[u.pay][0]}</span>
      <b style="width:44px;text-align:right;font-size:11.5px">${u.eng}%</b>
    </button>`).join('')}
  </div>` : ''}

  ${(S.uView||'card') === 'list' ? '' : list.map(u => `<div class="card" ${S.uOpen===u.id?'style="border-color:var(--ink)"':''}>
    <div class="spread">
      <div class="row">
        ${avatarOf(u.m)
          ? avaImg(avatarOf(u.m), 40)
          : `<div class="dot-ava" style="width:40px;height:40px;background:${u.role==='эксперт'?'var(--lilac)':u.role==='админ'?'var(--gold)':'var(--ink)'}">${u.n[0]}</div>`}
        <div><b style="font-size:14px">${u.n}</b>
          <div class="small muted">${u.role} · с ${u.since} · ${u.last}</div></div>
      </div>
      <span class="tag-st ${u.gift?'st-think':PAY[u.pay][1]}">${u.gift?'доступ подарен':PAY[u.pay][0]}${!u.gift&&u.pay==='trial'&&u.days?', день '+(4-u.days):''}</span>
    </div>
    ${u.offer ? `<div class="small" style="color:var(--lilac);margin-top:6px;font-weight:600">Спецпредложение: ${u.offer}</div>` : ''}

    <div class="uline"><span class="small muted" style="width:92px">Почта</span>
      <b style="font-size:12.5px;flex:1;word-break:break-all">${u.m}</b>
      ${u.verified ? '<span class="pill free">подтверждена</span>' : '<span class="pill paid">не подтверждена</span>'}</div>
    <div class="uline"><span class="small muted" style="width:92px">Телеграм</span>
      <b style="font-size:12.5px;flex:1">${u.tg||'—'}</b></div>
    <div class="uline"><span class="small muted" style="width:92px">Вовлечённость</span>
      <div style="flex:1"><div class="bar"><i style="width:${u.eng}%"></i></div></div>
      <b style="font-size:12px">${u.eng}%</b></div>
    ${u.sum ? `<div class="uline"><span class="small muted" style="width:92px">Оплаты</span>
      <b style="font-size:12.5px">${money(u.sum)}</b></div>` : ''}

    <div class="ustat">
      <span>${(hash(u.m)%18)+2} практик</span>
      <span>${(hash(u.n)%6)} курсов</span>
      <span>${(hash(u.m+'g')%40)} сообщений</span>
      <span>стрик ${(hash(u.n+'s')%9)}</span>
    </div>

    ${u.role === 'ученица' ? `
      <div class="small muted" style="margin:10px 0 5px">Статус сделки</div>
      <div class="chips">${['думает','оплатит позже','отказ',''].map(st =>
        `<button class="chip ${u.st===st?'on':''}" onclick="setUser('${u.id}','st','${st}')">${st||'сбросить'}</button>`).join('')}</div>
      <input class="field" style="margin:4px 0 8px" placeholder="Комментарий менеджера"
        value="${esc(u.note||'')}" oninput="setUserQuiet('${u.id}','note',this.value)">` : ''}

    <div class="acts" style="margin-top:6px">
      <button class="btn sm" onclick="openSheet({k:'write2',id:'${u.id}'})">Написать</button>
      <button class="btn ghost sm" onclick="openSheet({k:'grant',id:'${u.id}'})">Открыть доступ</button>
      <button class="btn ghost sm" onclick="copyText('${u.m}')">Почта</button>
    </div>
  </div>`).join('') || '<div class="empty">Никого не найдено</div>'}`;
}
function setUser(id, f, v){ const u = USERS.find(x => x.id === id); if(u){ u[f] = v; return render(); }
  const all = DB.users(); const k = String(id).toLowerCase();
  if(all[k]){ all[k][f] = v; DB.saveUsers(all); render(); } }
function setUserQuiet(id, f, v){ const u = USERS.find(x => x.id === id); if(u){ u[f] = v; return; }
  const all = DB.users(); const k = String(id).toLowerCase(); if(all[k]){ all[k][f] = v; DB.saveUsers(all); } }

/* ---------- входящие ---------- */
function adInbox(){
  const f = S.inboxFilter || 'все';
  let list = INBOX.slice();
  if(f === 'от экспертов') list = list.filter(x => x.role === 'эксперт');
  if(f === 'от пользователей') list = list.filter(x => x.role === 'ученица');
  if(f === 'новые') list = list.filter(x => x.st === 'новое');
  return `
  <p class="small muted" style="margin:0 0 12px">Служба поддержки: вопросы от учениц и экспертов в одном месте.</p>
  <div class="chips">${['все','новые','от пользователей','от экспертов'].map(x =>
    `<button class="chip ${f===x?'on':''}" onclick="S.inboxFilter='${x}';render()">${x}</button>`).join('')}</div>
  ${list.map(t => `<div class="card ${t.st==='новое'?'unread':''}">
    <div class="spread">
      <div class="row"><div class="dot-ava" style="background:${t.role==='эксперт'?'var(--lilac)':'var(--ink)'}">${t.from[0]}</div>
        <div><b style="font-size:13.5px">${t.from}</b>
          <div class="small muted">${t.role} · ${t.ago}</div></div></div>
      <span class="tag-st ${t.st==='новое'?'st-trial':t.st==='в работе'?'st-think':'st-paid'}">${t.st}</span>
    </div>
    <b style="font-size:14px;display:block;margin:10px 0 5px">${t.sub}</b>
    <p class="small muted" style="margin:0 0 10px">${t.t}</p>
    <div class="small muted" style="margin-bottom:8px">${t.mail}</div>
    <div class="row" style="gap:8px">
      <input class="field" style="margin:0;flex:1" placeholder="Ответить" id="rp_${t.id}">
      <button class="btn sm" onclick="replyTicket('${t.id}')">→</button>
    </div>
    <div class="chips" style="margin-top:8px">${['новое','в работе','закрыто'].map(st =>
      `<button class="chip ${t.st===st?'on':''}" onclick="setTicket('${t.id}','${st}')">${st}</button>`).join('')}</div>
  </div>`).join('')}`;
}
function setTicket(id, st){ const t = INBOX.find(x => x.id === id); t.st = st; render(); }
function replyTicket(id){
  const v = ($('#rp_'+id)||{}).value;
  if(!v || !v.trim()) return toast('Напиши ответ');
  const t = INBOX.find(x => x.id === id); t.st = 'в работе';
  render(); toast('Ответ отправлен на ' + t.mail);
}

/* ---------- мероприятия ---------- */
function adEvents(){
  const pend = EVENTS.filter(e => e.status === 'pending');
  return `
  <button class="btn" onclick="openSheet('newEvent')">＋ Добавить мероприятие</button>
  ${pend.length ? `<div class="sec-h"><h2 class="serif">На согласовании</h2><span class="small muted">${pend.length}</span></div>
    ${pend.map(e => `<div class="acard">
      <button class="cov" style="height:130px;position:relative;width:100%" onclick="openSheet({k:'event',id:'${e.id}'})">
        ${cover(e.id,'practice')}
        <div class="badge">${e.kind} · ${new Date(e.d).toLocaleDateString('ru-RU',{day:'numeric',month:'long'})}</div>
        <div class="cap"><b>${esc(e.t)}</b><span>${esc(e.by)} · ${e.mode === 'онлайн' ? 'онлайн, ' + e.city : e.city}</span></div>
      </button>
      <div style="padding:12px">
        <p class="small muted" style="margin:0 0 10px">${esc(e.about || 'Без описания')}</p>
        <div class="small muted">${e.price ? money(e.price) : 'бесплатно'} · ${e.unlimited ? 'мест без ограничения' : e.seats + ' мест'}</div>
        <div class="acts">
          <button class="btn sm" onclick="pubEvent('${e.id}')">Опубликовать</button>
          <button class="btn ghost sm" onclick="openSheet({k:'event',id:'${e.id}'})">Открыть</button>
        </div>
        <div class="acts">
          <button class="btn ghost sm" onclick="openSheet({k:'evReview',id:'${e.id}',mode:'rework'})">На доработку</button>
          <button class="btn ghost sm" onclick="openSheet({k:'evReview',id:'${e.id}',mode:'reject'})">Отказать</button>
        </div>
      </div>
    </div>`).join('')}` : ''}

  ${EVENTS.filter(e => e.status === 'rework' || e.status === 'rejected').length ? `
    <div class="sec-h"><h2 class="serif" style="font-size:18px">Возвращены эксперту</h2></div>
    ${EVENTS.filter(e => e.status === 'rework' || e.status === 'rejected').map(e => `<div class="arow2">
      <div class="mini">${cover(e.id,'practice')}</div>
      <div style="flex:1;min-width:0"><b style="font-size:13px">${esc(e.t)}</b>
        <div class="small muted">${esc(e.by)}</div>
        <div class="small" style="color:var(--warn);margin-top:3px">${esc(e.comment||'')}</div></div>
      <span class="tag-st ${e.status==='rework'?'st-trial':'st-no'}">${e.status==='rework'?'доработка':'отказ'}</span>
    </div>`).join('')}` : ''}
  <div class="sec-h"><h2 class="serif">Опубликованные</h2><span class="small muted">${EVENTS.filter(e=>e.status==='live').length}</span></div>
  ${EVENTS.filter(e => e.status === 'live').map(e => `<div class="arow2">
    <button class="mini" onclick="openSheet({k:'event',id:'${e.id}'})">${cover(e.id,'practice')}</button>
    <button style="flex:1;min-width:0;text-align:left" onclick="openSheet({k:'event',id:'${e.id}'})">
      <b style="font-size:13px">${esc(e.t)}</b>
      <div class="small muted">${new Date(e.d).toLocaleDateString('ru-RU')} ${e.tm} · ${e.city}</div>
      <div class="small muted">${e.unlimited ? 'мест без ограничения' : (e.seats - e.left) + ' из ' + e.seats + ' записалось'}${e.price?' · '+money(e.price):' · бесплатно'}</div>
    </button>
    <div style="display:flex;flex-direction:column;gap:5px">
      <button class="chip" onclick="pickImage('${e.id}')">▣</button>
      <button class="chip" onclick="dropEvent('${e.id}')">✕</button>
    </div>
  </div>`).join('')}`;
}
function pubEvent(id){ EVENTS.find(e => e.id === id).status = 'live'; pushShared(); render(); toast('Мероприятие опубликовано'); }
function dropEvent(id){ const i = EVENTS.findIndex(e => e.id === id); EVENTS.splice(i,1); pushShared(); render(); toast('Удалено'); }

/* ---------- сообщества ---------- */
function adCommunity(){
  initChats();
  const sub = S.commSub || 'groups';
  if(sub === 'events') return commTabs(sub) + adEvents();
  if(sub === 'ideas') return commTabs(sub) + adIdeas();
  return commTabs(sub) + adGroups();
}
function commTabs(sub){
  const pend = EVENTS.filter(e => e.status === 'pending').length;
  const news = S.ideas.filter(i => i.st === 'новое').length;
  return `<div class="seg">
    <button class="${sub==='groups'?'on':''}" onclick="S.commSub='groups';render()">Группы</button>
    <button class="${sub==='events'?'on':''}" onclick="S.commSub='events';render()">Мероприятия${pend?' · '+pend:''}</button>
    <button class="${sub==='ideas'?'on':''}" onclick="S.commSub='ideas';render()">Идеи${news?' · '+news:''}</button>
  </div>`;
}
function adGroups(){
  S.owned = S.owned || ['gr2'];
  return `
  <p class="small muted" style="margin:0 0 12px">Закрепи за собой группы, которые модерируешь. В закреплённых видно новые сообщения и доступно удаление.</p>
  ${GROUPS.map(g => {
    const own = S.owned.includes(g.id);
    const msgs = (S.chats[g.id]||[]).length;
    return `<div class="card">
      <div class="spread">
        <div class="row"><div class="gemoji">${g.e}</div>
          <div><b style="font-size:14px">${g.t}</b>
            <div class="small muted">${g.m.toLocaleString('ru-RU')} участниц · ${plural(msgs,'сообщение','сообщения','сообщений')}</div></div></div>
        <button class="sw ${own?'on':''}" onclick="toggleOwn('${g.id}')"><i></i></button>
      </div>
      <div class="acts">
        <button class="btn ghost sm" onclick="openChat('${g.id}')">Открыть чат</button>
        <button class="btn ghost sm" onclick="toast('Закреплённое сообщение обновлено')">Закрепить пост</button>
      </div>
      ${own ? `<div class="small" style="margin-top:8px;color:var(--ok)">Ты модератор этой группы</div>` : ''}
    </div>`;
  }).join('')}`;
}
function toggleOwn(id){
  S.owned = S.owned.includes(id) ? S.owned.filter(x => x !== id) : [...S.owned, id];
  render(); toast(S.owned.includes(id) ? 'Группа закреплена' : 'Группа откреплена');
}

/* ---------- товары и идеи ---------- */
function adIdeas(){
  const news = S.ideas.filter(i => i.st === 'новое').sort((a,b) => b.v - a.v);
  const log = S.ideas.filter(i => i.st !== 'новое').sort((a,b) => b.v - a.v);
  return `
  <p class="small muted" style="margin:0 0 12px">Предложения пользователей. Понравившиеся уходят в бэклог со статусом и приоритетом.</p>
  <div class="sec-h" style="margin-top:0"><h2 class="serif" style="font-size:18px">Новые</h2><span class="small muted">${news.length}</span></div>
  ${news.length ? news.map(ideaCard).join('') : '<div class="empty">Новых предложений нет</div>'}
  <div class="sec-h"><h2 class="serif" style="font-size:18px">Бэклог</h2><span class="small muted">${log.length}</span></div>
  ${log.map(ideaCard).join('')}`;
}
function ideaCard(i){
  const PR = ['высокий','средний','низкий'];
  const ST = ['новое','в бэклоге','в работе','готово','отклонено'];
  return `<div class="card">
    <div class="spread" style="margin-bottom:6px"><span class="chip pale">${i.a}</span>
      <span class="small muted">${i.d} · ${i.v} голосов</span></div>
    <b style="font-size:14px">${esc(i.t)}</b>
    <div class="small muted" style="margin:8px 0 5px">Статус</div>
    <div class="chips">${ST.map(s => `<button class="chip ${i.st===s?'on':''}" onclick="setIdea('${i.id}','st','${s}')">${s}</button>`).join('')}</div>
    <div class="small muted" style="margin:3px 0 5px">Приоритет</div>
    <div class="chips">${PR.map(s => `<button class="chip ${i.pr===s?'on':''}" onclick="setIdea('${i.id}','pr','${s}')">${s}</button>`).join('')}</div>
  </div>`;
}
function setIdea(id, f, v){ const i = S.ideas.find(x => x.id === id); i[f] = v;
  if(f === 'st' && v !== 'новое' && i.pr === '—') i.pr = 'средний'; render(); }

function exportUsers(){
  const rows = [['Имя','Почта','Телеграм','Роль','Доступ','Вовлечённость','Статус','Комментарий']]
    .concat(allUsers().map(u => [u.n,u.m,u.tg||'',u.role,u.gift?'подарен':u.pay,u.eng+'%',u.st||'',u.note||'']));
  const csv = rows.map(r => r.map(v => '"'+String(v).replace(/"/g,'""')+'"').join(';')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,%EF%BB%BF' + encodeURIComponent(csv);
  a.download = 'eva-users.csv'; a.click();
  toast('CSV выгружен');
}

/* ---------- образование на проверке ---------- */
function eduQueue(){
  const out = [];
  EXPERTS.forEach(e => (e.edu||[]).forEach(x => { if(x.st === 'pending') out.push({e, x}); }));
  return out;
}

/* =====================================================================
   АДМИН: РЕДАКТОРЫ
   ===================================================================== */
Object.assign(S, {editItem:null, editCourse:null, editUnit:null, demo:false, adminName:'Егор'});

function openEditor(id){ S.editItem = id; S.sheet = null; render(); window.scrollTo(0,0); }
function closeEditor(){ S.editItem = null; render(); window.scrollTo(0,0); }
function itemById(id){ return LIB.find(x => x.id === id) || S.pending.find(x => x.id === id); }

/* ---------- карточка материала в админке (как у пользователя) ---------- */
function adminItemCard(x, opts){
  opts = opts || {};
  return `<div class="acard">
    <div class="top">
      <button class="thumb" onclick="openEditor('${x.id}')">${cover(x.id, x.type)}
        ${x.type !== 'affirm' ? '<div class="play" style="width:26px;height:26px;font-size:9px">▶</div>' : ''}</button>
      <div style="flex:1;min-width:0">
        <div class="spread" style="align-items:flex-start">
          <b style="font-size:13.5px;line-height:1.3">${esc(x.title)}</b>
          <span class="pill ${x.free?'free':'paid'}">${x.free?'free':'PRO'}</span>
        </div>
        <div class="small muted" style="margin-top:3px">${esc(x.expert)} · ${x.min} мин</div>
        <div class="small muted">${x.video ? 'видео загружено' : 'видео не добавлено'} · ${MEDIA[x.id]?'своя обложка':'авто-обложка'}</div>
      </div>
    </div>
    <div class="bar2">
      ${(x.aud||[]).length ? `<span class="chip" style="padding:3px 8px;font-size:10px;background:#EEEBFB;color:var(--lilac);border:none">
        ${(x.aud||[]).map(k => (AUDIENCE.find(a=>a.k===k)||{}).n).filter(Boolean).slice(0,2).join(', ')}${x.aud.length>2?' +'+(x.aud.length-2):''}</span>` : ''}
      ${x.level && x.level !== 'any' ? `<span class="chip pale" style="padding:3px 8px;font-size:10px">${(LEVELS_CONTENT.find(l=>l.k===x.level)||{}).n}</span>` : ''}
      ${x.tags.slice(0,3).map(t => `<span class="chip pale" style="padding:3px 8px;font-size:10px">${t}</span>`).join('')}
      <button class="chip" style="margin-left:auto" onclick="openEditor('${x.id}')">Редактировать</button>
      ${opts.del ? `<button class="chip" onclick="delItem('${x.id}')">Удалить</button>` : ''}
    </div>
  </div>`;
}

/* ---------- редактор материала ---------- */
function pgEditItem(){
  const x = itemById(S.editItem);
  if(!x) return `<div class="empty">Материал не найден</div>`;
  const isPending = x.status === 'pending' || x.status === 'rework';
  return `<div class="view pad">
    <button class="backbtn" onclick="closeEditor()">‹ ${isPending ? 'Модерация' : 'Контент'}</button>

    ${x.video ? videoBlock(x.id, x.type) : `<div class="vidbox" onclick="openSheet({k:'video',id:'${x.id}'})">
      ${cover(x.id, x.type)}<div class="pl">▶</div>
      <div class="lbl2">Видео не добавлено — нажми, чтобы вставить ссылку</div></div>`}
    <div class="acts" style="margin:0 0 10px">
      <button class="btn ghost sm" onclick="openSheet({k:'video',id:'${x.id}'})">Видео по ссылке</button>
      <button class="btn ghost sm" onclick="pickImage('${x.id}')">Обложка</button>
      ${MEDIA[x.id] ? `<button class="btn ghost sm" onclick="delete MEDIA['${x.id}'];render()">Сбросить фото</button>` : ''}
    </div>
    ${MEDIA[x.id] ? cropBox(x.id, POS[x.id] || '50% 50%', 'covPos.' + x.id) : ''}

    <label class="lbl">Тип материала</label>
    <div class="seg">${Object.entries(TYPE).map(([k,v]) =>
      `<button class="${x.type===k?'on':''}" onclick="setItem('${x.id}','type','${k}')">${v.l}</button>`).join('')}</div>

    <label class="lbl">Название</label>
    <input class="field" value="${esc(x.title)}" oninput="setQuiet('${x.id}','title',this.value)">

    <label class="lbl">Описание</label>
    <textarea class="field" rows="4" oninput="setQuiet('${x.id}','text',this.value)">${esc(x.text)}</textarea>

    <div class="g2">
      <div><label class="lbl">Длительность, мин</label>
        <input class="field" type="number" value="${x.min}" oninput="setQuiet('${x.id}','min',+this.value)"></div>
      <div><label class="lbl">Доступ</label>
        <div class="seg" style="margin:0">
          <button class="${x.free?'on':''}" onclick="setItem('${x.id}','free',true)">Бесплатно</button>
          <button class="${!x.free?'on':''}" onclick="setItem('${x.id}','free',false)">По подписке</button>
        </div></div>
    </div>

    <label class="lbl" style="margin-top:10px">Эксперт</label>
    <div class="scroller">
      <button class="snav left" onclick="scrollChips(this,-1)">‹</button>
      <div class="chips">${EXPERTS.map(e => `<button class="chip ${x.expert===e.n?'on':''}"
        onclick="chipPickExpert(this,'${x.id}','${esc(e.n)}')">${e.n}</button>`).join('')}
        <button class="chip ${x.expert==='Редакция Eva'?'on':''}" onclick="chipPickExpert(this,'${x.id}','Редакция Eva')">Редакция</button></div>
      <button class="snav right" onclick="scrollChips(this,1)">›</button>
    </div>

    <div class="svcbox">
      <div class="hd"><span class="svclabel">служебное</span><b>Кому показывать</b></div>
      <div class="small muted">Ученицы этого не видят. Не выбрано — материал подходит всем.
        Отметьте группу, и он попадёт только в программы этих женщин.</div>
      <div class="chips wrap">${AUDIENCE.map(a => `<button class="chip ${(x.aud||[]).includes(a.k)?'on':''}"
        onclick="tgAud(this,'${x.id}','${a.k}')" title="${a.hint}">${a.n}</button>`).join('')}</div>
    </div>

    <div class="svcbox">
      <div class="hd"><span class="svclabel">служебное</span><b>Уровень подготовки</b></div>
      <div class="small muted">Новичкам продвинутое не показывается</div>
      <div class="seg" style="margin-top:8px">${LEVELS_CONTENT.map(l => `<button class="${(x.level||'any')===l.k?'on':''}"
        onclick="setItem('${x.id}','level','${l.k}')">${l.n}</button>`).join('')}</div>
    </div>

    <div class="svcbox">
      <div class="hd"><span class="svclabel">служебное</span><b>День недели</b></div>
      <div class="small muted">Не выбрано — показывается в любой день. Отметьте дни, если материал
        привязан к конкретному дню недели</div>
      <div class="chips wrap">${WEEKDAYS_TAG.map(w => `<button class="chip ${(x.days||[]).includes(w.k)?'on':''}"
        onclick="tgDays(this,'${x.id}','${w.k}')">${w.n}</button>`).join('')}</div>
    </div>

    <label class="lbl">Теги <span class="muted">(${x.tags.length})</span></label>
    <div class="chips wrap">${ALL_TAGS.map(t => `<button class="chip ${x.tags.includes(t)?'on':''}"
      onclick="tgItem('${x.id}','${t}')">${t}</button>`).join('')}</div>

    <div class="acts" style="margin-top:16px">
      <button class="btn" onclick="closeEditor();toast('Сохранено')">Сохранить</button>
      ${!isPending ? `<button class="btn ghost" onclick="delItem('${x.id}')">Удалить</button>` : ''}
    </div>

    ${isPending ? `<div class="card" style="margin-top:14px">
      <b style="font-size:14.5px">Решение по материалу</b>
      <p class="small muted" style="margin:6px 0 10px">Автор: ${esc(x.expert)}, прислан ${x.sent}</p>
      <button class="btn" onclick="approve('${x.id}');closeEditor()">Одобрить и опубликовать</button>
      <div class="acts">
        <button class="btn ghost" onclick="openSheet({k:'rework',id:'${x.id}'})">На доработку</button>
        <button class="btn ghost" onclick="openSheet({k:'reject',id:'${x.id}'})">Отказать</button>
      </div>
    </div>` : ''}
  </div>`;
}

function setItem(id, f, v){ const x = itemById(id); if(x){ x[f] = v; pushShared(); render(); } }
function setQuiet(id, f, v){ const x = itemById(id); if(x) x[f] = v; }

/* ---------- редактор курса ---------- */
function openCourseEditor(id){ S.editCourse = id; S.sheet = null; render(); window.scrollTo(0,0); }
function closeCourseEditor(){ S.editCourse = null; S.editUnit = null; render(); window.scrollTo(0,0); }

function modulesOf(cid){
  if(!S.modules) S.modules = {};
  if(!S.modules[cid]){
    const src = MODULES[cid] || [[1,'Модуль 1', lessonsOf(cid).map(l => l.n)]];
    S.modules[cid] = src.map(([n,t,units]) => ({n, t, units:[...units]}));
  }
  return S.modules[cid];
}
function publishCourse(cid){
  const c = COURSES.find(x => x.id === cid);
  const ls = lessonsOf(cid);
  if(!ls.length) return toast('Добавь хотя бы один урок');
  if(!ls.some(l => l.free)) return toast('Открой хотя бы один урок как витрину');
  c.draft = false; c.n = ls.length;
  pushShared(); render(); toast('Курс опубликован в каталоге');
}

function pgEditCourse(){
  const c = COURSES.find(x => x.id === S.editCourse);
  const ls = lessonsOf(c.id), mods = modulesOf(c.id);
  const info = COURSE_INFO[c.id] || {who:[], gives:[], promo:''};
  return `<div class="view pad">
    <button class="backbtn" onclick="closeCourseEditor()">‹ Курсы</button>

    ${c.draft ? `<div class="card" style="border-color:var(--warn)">
      <div class="spread"><div style="flex:1"><b style="font-size:14.5px">Черновик</b>
        <div class="small muted" style="margin-top:3px">Курс виден только тебе. Добавь уроки и опубликуй - он появится в каталоге.</div></div></div>
      <div class="acts"><button class="btn" onclick="publishCourse('${c.id}')">Опубликовать</button>
        <button class="btn ghost" onclick="openCourseLanding('${c.id}')">Предпросмотр</button></div>
    </div>` : ''}

    ${(S.videos&&S.videos[c.id+'_promo']) ? videoBlock(c.id+'_promo','course')
      : `<div class="vidbox" style="height:190px" onclick="openSheet({k:'video',id:'${c.id}_promo'})">
        ${cover(c.id+'_promo','course')}<div class="pl">▶</div>
        <div class="lbl2">Промо-ролик не добавлен</div></div>`}
    <div class="acts" style="margin:0 0 14px">
      <button class="btn ghost sm" onclick="openSheet({k:'video',id:'${c.id}_promo'})">Промо по ссылке</button>
      <button class="btn ghost sm" onclick="pickImage('${c.id}')">Обложка курса</button>
      <button class="btn ghost sm" onclick="openCourseLanding('${c.id}')">Просмотр</button>
    </div>

    <label class="lbl">Название</label>
    <input class="field" value="${esc(c.t)}" oninput="setCourse('${c.id}','t',this.value)">
    <label class="lbl">Короткое описание</label>
    <textarea class="field" rows="3" oninput="setCourse('${c.id}','d',this.value)">${esc(c.d)}</textarea>
    <div class="g2">
      <div><label class="lbl">Цена, ₽</label><input class="field" type="number" value="${c.p}" oninput="setCourse('${c.id}','p',+this.value)"></div>
      <div><label class="lbl">Старая цена</label><input class="field" type="number" value="${c.old}" oninput="setCourse('${c.id}','old',+this.value)"></div>
    </div>
    <label class="lbl">Эксперт</label>
    <div class="chips">${EXPERTS.map(e => `<button class="chip ${c.e===e.n?'on':''}"
      onclick="setCourse('${c.id}','e','${e.n}')">${e.n}</button>`).join('')}</div>

    <div class="sec-h"><h2 class="serif">Продающие блоки</h2></div>
    <div class="card">
      <label class="lbl">Для кого этот курс</label>
      ${info.who.map((w,i) => `<input class="field" value="${esc(w)}" oninput="COURSE_INFO['${c.id}'].who[${i}]=this.value">`).join('')}
      <button class="btn ghost sm" onclick="COURSE_INFO['${c.id}'].who.push('Новый пункт');render()">＋ пункт</button>
      <label class="lbl" style="margin-top:12px">Что даёт курс</label>
      ${info.gives.map((w,i) => `<input class="field" value="${esc(w)}" oninput="COURSE_INFO['${c.id}'].gives[${i}]=this.value">`).join('')}
      <button class="btn ghost sm" onclick="COURSE_INFO['${c.id}'].gives.push('Новый пункт');render()">＋ пункт</button>
    </div>

    <div class="sec-h"><h2 class="serif">Модули и уроки</h2>
      <span class="small muted">${mods.length} модуля · ${ls.length} уроков</span></div>

    ${mods.map((m,mi) => `<div class="modbox">
      <div class="mh"><span>Модуль ${m.n}. ${esc(m.t)}</span>
        <button class="chip" style="padding:2px 8px" onclick="renameModule('${c.id}',${mi})">✎</button></div>
      <div style="padding:9px">
        ${m.units.map(un => {
          const l = ls.find(x => x.n === un);
          if(!l) return '';
          return `<button class="unit" onclick="openUnitEditor('${c.id}','${l.id}')">
            <div class="n">${l.n}</div>
            <div class="mini">${cover(l.id,'practice')}</div>
            <div style="flex:1;min-width:0">
              <b style="font-size:13px;display:block">${esc(l.t)}</b>
              <div class="small muted">${l.min} мин · ${l.video?'видео есть':'без видео'}</div>
            </div>
            <span class="pill ${l.free?'free':'paid'}">${l.free?'free':'🔒'}</span>
          </button>`;
        }).join('')}
        <button class="btn ghost sm" style="width:100%" onclick="addUnitTo('${c.id}',${mi})">＋ Добавить урок в модуль</button>
      </div>
    </div>`).join('')}

    <button class="btn ghost" onclick="addModule('${c.id}')">＋ Добавить модуль</button>
    <button class="btn" style="margin-top:9px" onclick="closeCourseEditor();toast('Курс сохранён')">Сохранить курс</button>
  </div>`;
}

function setCourse(id, f, v){ const c = COURSES.find(x => x.id === id); c[f] = v; }
function addModule(cid){
  const m = modulesOf(cid);
  m.push({n:m.length+1, t:'Новый модуль', units:[]});
  render(); toast('Модуль добавлен');
}
function renameModule(cid, mi){
  const m = modulesOf(cid)[mi];
  const t = prompt('Название модуля', m.t);
  if(t && t.trim()) m.t = t.trim();
  render();
}
function addUnitTo(cid, mi){
  const ls = lessonsOf(cid), n = ls.length + 1;
  const l = {id:cid+'_'+n, n, t:'Новый урок', d:'', min:12, done:false, video:'', free:false};
  ls.push(l);
  modulesOf(cid)[mi].units.push(n);
  S.editCourse = cid; S.editUnit = l.id; render(); window.scrollTo(0,0);
}

/* ---------- редактор урока ---------- */
function openUnitEditor(cid, uid){ S.editCourse = cid; S.editUnit = uid; render(); window.scrollTo(0,0); }
function pgEditUnit(){
  const c = COURSES.find(x => x.id === S.editCourse);
  const l = lessonsOf(c.id).find(x => x.id === S.editUnit);
  if(!l) { S.editUnit = null; return pgEditCourse(); }
  return `<div class="view pad">
    <button class="backbtn" onclick="S.editUnit=null;render()">‹ ${esc(c.t)}</button>

    ${l.video ? videoBlock(l.id) : `<div class="vidbox" onclick="openSheet({k:'video',id:'${l.id}'})">
      ${cover(l.id,'practice')}<div class="pl">▶</div>
      <div class="lbl2">Видео урока не добавлено</div></div>`}
    <div class="acts" style="margin:0 0 14px">
      <button class="btn ghost sm" onclick="openSheet({k:'video',id:'${l.id}'})">Видео по ссылке</button>
      <button class="btn ghost sm" onclick="pickImage('${l.id}')">Обложка урока</button>
    </div>

    <label class="lbl">Название урока</label>
    <input class="field" value="${esc(l.t)}" oninput="setUnit('${c.id}','${l.id}','t',this.value)">
    <label class="lbl">Описание урока</label>
    <textarea class="field" rows="4" oninput="setUnit('${c.id}','${l.id}','d',this.value)">${esc(l.d||'')}</textarea>
    <div class="g2">
      <div><label class="lbl">Длительность, мин</label>
        <input class="field" type="number" value="${l.min}" oninput="setUnit('${c.id}','${l.id}','min',+this.value)"></div>
      <div><label class="lbl">Доступ</label>
        <div class="seg" style="margin:0">
          <button class="${l.free?'on':''}" onclick="setUnitR('${c.id}','${l.id}','free',true)">Открыт</button>
          <button class="${!l.free?'on':''}" onclick="setUnitR('${c.id}','${l.id}','free',false)">🔒 Платный</button>
        </div></div>
    </div>
    <p class="small muted" style="margin:10px 0 0">Открытые уроки видны без покупки - это витрина курса. Обычно открывают первый урок и один из середины.</p>

    <div class="card" style="margin-top:12px">
      <div class="spread"><div style="flex:1"><b style="font-size:14.5px">Домашнее задание</b>
        <div class="small muted" style="margin-top:3px">${l.hw ? esc(l.hw.title) : 'Не добавлено — необязательно'}</div></div>
        <button class="btn sm ghost" onclick="openSheet({k:'hwEdit',cid:'${c.id}',id:'${l.id}'})">${l.hw?'Изменить':'Добавить'}</button></div>
      ${l.hw ? `<p class="small muted" style="margin:8px 0 0">${esc(l.hw.text.slice(0,120))}${l.hw.text.length>120?'…':''}</p>` : ''}
    </div>

    <button class="btn ghost" style="margin-top:10px" onclick="openCourseLearn('${c.id}',lessonsOf('${c.id}').findIndex(u=>u.id==='${l.id}'))">
      Посмотреть, как видит ученица</button>

    <div class="acts" style="margin-top:16px">
      <button class="btn" onclick="S.editUnit=null;render();toast('Урок сохранён')">Готово</button>
      <button class="btn ghost" onclick="delUnit('${c.id}','${l.id}')">Удалить урок</button>
    </div>
  </div>`;
}
function setUnit(cid, uid, f, v){ const l = lessonsOf(cid).find(x => x.id === uid); if(l) l[f] = v; }
function setUnitR(cid, uid, f, v){ setUnit(cid, uid, f, v); render(); }
function delUnit(cid, uid){
  const ls = lessonsOf(cid), i = ls.findIndex(x => x.id === uid);
  if(i < 0) return;
  const n = ls[i].n;
  ls.splice(i,1);
  modulesOf(cid).forEach(m => m.units = m.units.filter(u => u !== n));
  S.editUnit = null; render(); toast('Урок удалён');
}

/* ---------- демо-режим ---------- */
function enterDemo(){
  S.demo = true; S.demoRole = S.role; S.role = 'user';
  S.page = null; S.tab = 'home'; S.editItem = null; S.editCourse = null; S.editUnit = null;
  if(!S.sub.active && !trialLeft()) S.sub.active = true;
  render(); window.scrollTo(0,0);
  toast('Демо-режим: смотришь платформу глазами пользователя');
}
function exitDemo(){
  S.role = S.demoRole || 'admin'; S.demo = false;
  S.page = null; S.course = null; if(S.chat) S.chat.open = null;
  render(); window.scrollTo(0,0);
  toast('Вернулись в панель');
}
function demoBar(){
  if(!S.demo) return '';
  return `<div class="demobar">
    <span style="flex:1">Демо-режим · ты смотришь платформу как пользователь</span>
    <button onclick="exitDemo()">Вернуться в панель</button>
  </div>`;
}

/* ---------- приветствие админа ---------- */
function pickAdminAvatar(){
  pickImage('__admin__', data => {
    S.adminAvatar = data; delete MEDIA['__admin__'];
    render(); schedulePersist(); toast('Фото куратора обновлено');
  });
}
function adminHello(){
  const h = new Date().getHours();
  const g = h < 6 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
  const pend = S.pending.filter(x => x.status === 'pending').length;
  const lines = [
    'От того, что ты сегодня опубликуешь, зависит чей-то спокойный вечер.',
    'Каждый одобренный материал - это чья-то практика завтра утром.',
    'Спасибо за работу: без неё платформа была бы просто красивой оболочкой.',
    'Хорошего рабочего дня. Пусть очередь модерации будет короткой, а идеи - крупными.'
  ];
  return `<div class="card" style="background:var(--surface-2);border:none">
    <div class="row" style="align-items:flex-start">
      <button onclick="pickAdminAvatar()" style="flex:none">
        ${S.adminAvatar
          ? `<img src="${S.adminAvatar}" alt="" style="width:44px;height:44px;border-radius:50%;object-fit:cover">`
          : `<span class="ava" style="width:44px;height:44px;font-size:16px;background:var(--gold)">${esc((S.adminName||'К')[0])}</span>`}
      </button>
      <div style="flex:1">
        <b style="font-size:15.5px">${g}, ${esc(S.adminName)}</b>
        <div class="small muted" style="margin-top:2px">Куратор платформы · нажми на фото, чтобы заменить</div>
      </div>
    </div>
    <div style="height:6px"></div>
    <b style="display:none">${esc(S.adminName)}</b>
    <p class="small muted" style="margin:6px 0 0">${lines[new Date().getDate() % lines.length]}</p>
    <div class="row" style="margin-top:10px;gap:8px;flex-wrap:wrap">
      <span class="chip pale">${pend ? plural(pend,'материал','материала','материалов')+' ждут решения' : 'очередь пуста'}</span>
      <span class="chip pale">${LIB.length} материалов на платформе</span>
    </div>
    <div class="acts">
      <button class="btn ghost sm" onclick="enterDemo()">Посмотреть платформу</button>
      <button class="btn ghost sm" onclick="S.adminTab='moderate';render()">К модерации</button>
    </div>
  </div>`;
}

const POS = new Proxy({}, {
  get:(t,k) => (S.covPos || {})[k],
  set:(t,k,v) => { S.covPos = S.covPos || {}; S.covPos[k] = v; return true; }
});

function tgAud(btn, id, k){
  const x = itemById(id);
  if(!x) return;
  x.aud = x.aud || [];
  const on = x.aud.includes(k);
  x.aud = on ? x.aud.filter(v => v !== k) : [...x.aud, k];
  btn.classList.toggle('on', !on);
  syncPush(['lib','pending']);
}

function scrollChips(btn, dir){
  const row = btn.parentElement.querySelector('.chips');
  if(row) row.scrollBy({ left: dir * Math.max(160, row.clientWidth * 0.6), behavior:'smooth' });
}
function chipPickExpert(btn, id, name){
  const x = itemById(id);
  if(x) x.expert = name;
  [...btn.parentElement.children].forEach(b => b.classList.toggle('on', b === btn));
  syncPush(['lib','pending']);
}

function tgDays(btn, id, k){
  const x = itemById(id);
  if(!x) return;
  x.days = x.days || [];
  const on = x.days.includes(k);
  x.days = on ? x.days.filter(v => v !== k) : [...x.days, k];
  btn.classList.toggle('on', !on);
  syncPush(['lib','pending']);
}

/* =====================================================================
   КАБИНЕТ ЭКСПЕРТА
   ===================================================================== */
const EXP_TABS = [
  ['profile','Профиль','◉'], ['content','Контент','▤'], ['courses','Курсы','▶'],
  ['offers','Услуги и события','◇'], ['club','Сообщество','◈'], ['income','Доход','◔']
];

const me = () => EXPERTS.find(e => e.id === S.expertId);

function pgExpertRoom(){
  /* если вошли под аккаунтом эксперта — открываем именно его профиль */
  if(S.user && S.user.email && !S.expertPicked){
    const mine = EXPERTS.find(x => x.email === S.user.email) ||
                 EXPERTS.find(x => x.n === S.user.name);
    if(mine) S.expertId = mine.id;
    S.expertPicked = true;
  }
  if(S.editItem) return pgEditItem();
  if(S.editCourse) return S.editUnit ? pgEditUnit() : pgEditCourse();
  const e = me();
  const unread = EXPERT_MSGS.filter(m => m.unread).length;
  return `<div class="view">
    <div class="hero">
      ${sceneSVG(daypart())}
      <div class="brandbar"><div class="b">Кабинет эксперта</div>
        <div class="row" style="gap:8px">
          <button class="mailbtn2" onclick="S.expTab='msgs';render()" aria-label="Сообщения">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
              <rect x="3" y="5" width="18" height="14" rx="3"/><path d="M4 7l8 6 8-6"/></svg>
            ${unread ? `<i class="mdot">${unread}</i>` : ''}
          </button>
          <button class="mailbtn2" onclick="S.expTab='settings';render()" aria-label="Настройки">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
              <circle cx="12" cy="12" r="3.2"/>
              <path d="M12 3v2.2M12 18.8V21M4.2 7.5l1.9 1.1M17.9 15.4l1.9 1.1M4.2 16.5l1.9-1.1M17.9 8.6l1.9-1.1"/></svg>
          </button>
          <select class="mini-sel" onchange="S.expertId=this.value;render()">
            ${EXPERTS.map(x => `<option value="${x.id}" ${x.id===S.expertId?'selected':''}>${x.n}</option>`).join('')}
          </select>
        </div></div>
      <div class="row" style="position:relative;z-index:2">
        <div class="pcirc" style="width:56px;height:56px">${expPic(e)}</div>
        <div style="flex:1"><h1 class="serif" style="font-size:22px;margin:0;color:#fff">${e.n} ${e.verified?'<span class="vt">✓</span>':''}</h1>
          <p class="small muted" style="margin:3px 0 0">${e.r}</p></div>
      </div>
      <div class="stats" style="grid-template-columns:repeat(3,1fr)">
        <div><b>${EXPERT_STATS.views > 999 ? (EXPERT_STATS.views/1000).toFixed(1)+'к' : EXPERT_STATS.views}</b><span>просмотров</span></div>
        <div><b>${(e.students/1000).toFixed(1)}к</b><span>учениц</span></div>
        <div><b>${e.rate}</b><span>рейтинг</span></div>
      </div>
      <div class="atabs grid six">
        ${EXP_TABS.map(([k,l,i]) => `<button class="${S.expTab===k?'on':''}" onclick="S.expTab='${k}';render()">
          ${i} ${l}${k==='msgs'&&unread?`<span class="cnt">${unread}</span>`:''}</button>`).join('')}
      </div>
    </div>
    <div class="pad" style="padding-top:18px">
      ${syncStatusLine()}
      ${(() => {
        const M = {profile:exProfile, content:exContent, courses:exCourses, club:exClub,
                   offers:exOffers, income:exIncome, msgs:exMsgs, settings:exSettings,
                   events:exOffers, services:exOffers, edu:exProfile, stats:exIncome, refs:exIncome};
        return (M[S.expTab] || exProfile)();
      })()}
    </div>
  </div>`;
}

function exProfile(){
  const e = me();
  return `
  <div class="card" style="text-align:center">
    <div class="pcirc" style="width:96px;height:96px;margin:0 auto 12px">${expPic(e)}</div>
    <b style="font-size:16px">${e.n}</b>
    <div class="small muted">${e.verified ? 'Аккаунт подтверждён редакцией' : 'Ожидает подтверждения'}</div>
    <button class="btn ghost sm" style="margin-top:10px" onclick="pickImage('${e.id}')">Сменить фото</button>
  </div>

  <div class="card">
    <b style="font-size:14.5px">Специализация</b>
    <input class="field" style="margin-top:10px" value="${esc(e.r)}" oninput="me().r=this.value">
    <b style="font-size:14.5px">О себе</b>
    <textarea class="field" rows="4" style="margin-top:10px" oninput="me().about=this.value">${esc(e.about)}</textarea>
    <b style="font-size:14.5px">Миссия</b>
    <textarea class="field" rows="3" style="margin-top:10px" oninput="me().mission=this.value">${esc(e.mission)}</textarea>
    <b style="font-size:14.5px">Цена консультации, ₽</b>
    <input class="field" type="number" style="margin-top:10px" value="${e.price}" oninput="me().price=+this.value||0">
    <label class="lbl" style="margin-top:12px">Мои темы</label>
    <div class="small muted" style="margin-bottom:8px">По этим тегам платформа подбирает твои материалы в программы учениц</div>
    <div class="chips wrap">${e.t.map(t => `<button class="chip on" onclick="dropExpTag('${e.id}','${t}')">${t} <span style="opacity:.6">✕</span></button>`).join('')}
      <button class="chip" onclick="openSheet({k:'expTags',id:'${e.id}'})">＋ тема</button></div>
    <button class="btn" style="margin-top:12px" onclick="render();toast('Профиль сохранён')">Сохранить</button>
  </div>

  <div class="card">
    <b style="font-size:14.5px">С чем ко мне приходят</b>
    <p class="small muted" style="margin:5px 0 9px">Запросы, с которыми к тебе обращаются. Показывается на публичной странице</p>
    ${(e.who||[]).length
      ? (e.who).map((w,i) => `<div class="linerow">
          <input class="field" style="margin:0;flex:1" value="${esc(w)}" oninput="setWho('${e.id}',${i},this.value)">
          <button class="chip" onclick="delWho('${e.id}',${i})">✕</button></div>`).join('')
      : '<div class="small muted" style="padding:2px 0 8px">Пока пусто. Нажми «Добавить пункт» - предложу готовые формулировки</div>'}
    <button class="btn ghost sm" onclick="openSheet({k:'pickPhrase', id:'${e.id}', field:'who'})">＋ Добавить пункт</button>
  </div>

  <div class="card">
    <b style="font-size:14.5px">Опыт и достижения</b>
    <p class="small muted" style="margin:5px 0 9px">Показывается на публичной странице</p>
    ${(e.ach||[]).length
      ? (e.ach).map((a,i) => `<div class="linerow">
          <input class="field" style="margin:0;flex:1" value="${esc(a)}" oninput="setAch('${e.id}',${i},this.value)">
          <button class="chip" onclick="delAch('${e.id}',${i})">✕</button></div>`).join('')
      : '<div class="small muted" style="padding:2px 0 8px">Пока пусто. Нажми «Добавить пункт» - предложу готовые формулировки</div>'}
    <button class="btn ghost sm" onclick="openSheet({k:'pickPhrase', id:'${e.id}', field:'ach'})">＋ Добавить пункт</button>
  </div>

  <div class="card">
    <b style="font-size:14.5px">Отзывы</b>
    <p class="small muted" style="margin:5px 0 9px">Публикуются после проверки редакцией</p>
    ${(REVIEWS[(COURSES.find(c=>c.e===e.n)||{}).id] || []).map(([who,t,st]) => `<div class="review">
      <div class="spread"><b style="font-size:12.5px">${who}</b><span class="stars5">${'★'.repeat(st)}</span></div>
      <p class="small muted" style="margin:5px 0 0">${t}</p></div>`).join('') || '<div class="small muted">Пока нет</div>'}
  </div>

  ${exEduBlock()}

  <button class="btn ghost" onclick="S.viewExpert='${e.id}';S.page='expertPublic';render()">Посмотреть публичную страницу</button>`;
}

function exContent(){
  const e = me();
  const mine = LIB.filter(x => x.expert === e.n);
  const sent = S.pending.filter(x => x.expert === e.n);
  return `
  <button class="btn" onclick="openSheet('newContent')">＋ Предложить материал</button>
  <p class="small muted" style="margin:10px 0 0">Загрузи обложку, вставь ссылку на видео, выбери теги и укажи, бесплатный материал или по подписке. Редакция проверит за сутки.</p>

  ${sent.length ? `<div class="sec-h"><h2 class="serif">На проверке и доработке</h2></div>
    ${sent.map(x => `<div class="acard">
      <div class="top">
        <button class="thumb" onclick="pickImage('${x.id}')">${cover(x.id,x.type)}</button>
        <div style="flex:1;min-width:0">
          <div class="spread" style="align-items:flex-start">
            <b style="font-size:13.5px">${esc(x.title)}</b>
            <span class="tag-st ${x.status==='live'?'st-paid':x.status==='rework'?'st-trial':x.status==='rejected'?'st-no':'st-none'}">
              ${x.status==='pending'?'на проверке':x.status==='live'?'опубликован':x.status==='rework'?'доработка':'отказ'}</span>
          </div>
          <div class="small muted" style="margin-top:3px">${TYPE[x.type].l} · ${x.min} мин · ${x.free?'бесплатный':'по подписке'}</div>
          ${x.comment ? `<div class="small" style="margin-top:5px;color:var(--warn)">Редакция: ${esc(x.comment)}</div>` : ''}
        </div>
      </div>
      <div class="bar2">
        ${x.status === 'rework' ? `<button class="chip" onclick="openSheet({k:'fix',id:'${x.id}'})">Доработать</button>
          <button class="chip" onclick="openEditor('${x.id}')">Открыть</button>` : ''}
        ${x.status !== 'live' ? `<button class="chip" onclick="dropPending('${x.id}')">Удалить</button>` : ''}
      </div>
    </div>`).join('')}` : ''}

  <div class="sec-h"><h2 class="serif">Опубликовано</h2><span class="small muted">${mine.length}</span></div>
  ${mine.map(x => adminItemCard(x)).join('') || '<div class="empty">Пока нет материалов</div>'}`;
}

function exCourses(){
  const e = me();
  const mine = COURSES.filter(c => c.e === e.n);
  return `
  <button class="btn" onclick="openSheet('newCourse')">＋ Создать курс</button>
  <p class="small muted" style="margin:10px 0 0">Курс загружается по урокам: видео, обложка, описание и доступ для каждого. После добавления урок появляется в общей программе курса.</p>
  <div class="sec-h"><h2 class="serif">Мои курсы</h2><span class="small muted">${mine.length}</span></div>
  ${mine.length ? mine.map(c => {
    const ls = lessonsOf(c.id), mods = modulesOf(c.id);
    return `<div class="acard">
      <button class="cov" style="height:120px;position:relative;width:100%" onclick="openCourseEditor('${c.id}')">
        ${cover(c.id,'course')}
        <div class="cap"><b>${c.t}</b><span>${mods.length} модуля · ${ls.length} уроков</span></div>
      </button>
      <div style="padding:12px">
        <div class="spread"><span class="price">${money(c.p)}</span>
          <span class="small muted">${c.s.toLocaleString('ru-RU')} учениц · ★ ${c.r}</span></div>
        <div class="small muted" style="margin-top:5px">Открытых уроков: ${ls.filter(l=>l.free).length} · доход за месяц ${money(Math.round(c.p*c.s*0.02))}</div>
        <div class="acts">
          <button class="btn ghost sm" onclick="openCourseEditor('${c.id}')">Редактировать</button>
          <button class="btn ghost sm" onclick="addUnitTo('${c.id}',0)">＋ Урок</button>
          <button class="btn ghost sm" onclick="openCourseLanding('${c.id}')">Просмотр</button>
        </div>
      </div>
    </div>`;
  }).join('') : '<div class="empty">Пока нет курсов</div>'}`;
}

function exClub(){
  const e = me();
  const g = GROUPS[hash(e.id) % GROUPS.length];
  return `
  <div class="card">
    <div class="row"><div style="font-size:26px">${g.e}</div>
      <div style="flex:1"><b style="font-size:15px">${g.t}</b>
        <div class="small muted">${g.m.toLocaleString('ru-RU')} участниц · твоя группа</div></div></div>
    <div class="g2" style="margin-top:12px">
      <div class="phbox"><div class="serif" style="font-size:22px">${(hash(g.id)%40+12)}</div><div class="small muted">сообщений сегодня</div></div>
      <div class="phbox"><div class="serif" style="font-size:22px">${(hash(g.t)%9+2)}</div><div class="small muted">без ответа</div></div>
    </div>
  </div>
  <div class="sec-h"><h2 class="serif">Обсуждения</h2></div>
  ${POSTS.filter(p => p.g === g.id || true).slice(0,4).map(p => `<div class="msg">
    <div class="row" style="margin-bottom:8px">
      <div class="dot-ava" style="background:${p.c}">${p.a.split(' ').map(w=>w[0]).join('')}</div>
      <div style="flex:1"><b style="font-size:13.5px">${p.a}</b>
        <div class="small muted" style="font-size:11px">${p.ago}</div></div></div>
    <p style="margin:0 0 10px;font-size:13.5px;line-height:1.5">${p.t}</p>
    <button class="btn ghost sm" onclick="toast('Ответ отправлен')">Ответить</button>
  </div>`).join('')}
  <button class="btn ghost" onclick="toast('Пост опубликован в группе')">Написать в группу</button>`;
}

function exMsgs(){
  return `
  <h2 class="serif" style="font-size:24px;margin:0 0 4px">Личные сообщения</h2>
  <p class="small muted" style="margin:0 0 14px">Вопросы от учениц и заявки на консультации.</p>
  ${EXPERT_MSGS.map(m => `<div class="card ${m.unread?'unread':''}">
    <div class="row" style="margin-bottom:8px">
      <div class="dot-ava" style="background:var(--lilac)">${m.a[0]}</div>
      <div style="flex:1"><b style="font-size:13.5px">${m.a}</b>
        <div class="small muted" style="font-size:11px">${m.ago}</div></div>
      ${m.unread?'<span class="chip pale">новое</span>':''}</div>
    <p style="margin:0 0 10px;font-size:13.5px;line-height:1.5">${m.t}</p>
    <div class="row" style="gap:8px">
      <input class="field" style="margin:0;flex:1" placeholder="Ответить">
      <button class="btn sm" onclick="toast('Отправлено')">→</button></div>
  </div>`).join('')}`;
}

function exStats(){
  const s = EXPERT_STATS, e = me();
  return `
  <div class="g2">
    ${[['Просмотров', s.views.toLocaleString('ru-RU')],['Досматривают', s.done+'%'],
       ['Учениц', s.students.toLocaleString('ru-RU')],['Рейтинг','★ '+e.rate],
       ['Доход за месяц', money(s.income)],['По реф. ссылке', s.refs]].map(([l,v]) =>
      `<div class="card" style="margin:0"><div class="small muted">${l}</div>
        <div class="serif" style="font-size:23px;margin-top:4px">${v}</div></div>`).join('')}
  </div>
  <div class="card" style="margin-top:14px">
    <b style="font-size:15px">Просмотры за неделю</b>
    <div class="rep">${s.week.map((n,i) => `<div>
      <i style="height:${n/Math.max(...s.week)*88}px"></i><span>${DAYS[i]}</span></div>`).join('')}</div>
  </div>`;
}

function exRefs(){
  const e = me();
  const slug = e.n.split(' ')[0].toLowerCase();
  return `
  <p class="small muted" style="margin:0 0 14px">Обе ссылки открываются без подписки и работают как лендинг. Внутри видно, что можно оформить доступ ко всей платформе.</p>
  ${[['Страница эксперта', `eva.space/e/${slug}`, 'Профиль, миссия, материалы и консультации'],
     ['Курсы', `eva.space/e/${slug}/courses`, 'Каталог твоих курсов с оплатой'],
     ['Реферальная на платформу', `eva.space/r/${slug}`, 'Приводит пользователей, ты получаешь процент']].map(([t,u,d]) => `
    <div class="card">
      <b style="font-size:14.5px">${t}</b>
      <div class="small muted" style="margin:4px 0 8px">${d}</div>
      <div class="linkbox">${u}</div>
      <button class="btn ghost sm" style="margin-top:10px" onclick="copyText('https://${u}')">Скопировать</button>
    </div>`).join('')}
  <button class="btn" onclick="S.viewExpert='${e.id}';S.page='expertPublic';render()">Открыть как гость</button>`;
}

function copyText(t){ if(navigator.clipboard) navigator.clipboard.writeText(t).catch(()=>{}); toast('Скопировано'); }

function dropPending(id){
  S.pending = S.pending.filter(x => x.id !== id);
  render(); toast('Материал удалён');
}
function verify(id){ const e = EXPERTS.find(x => x.id === id); e.verified = !e.verified; render();
  toast(e.verified ? 'Эксперт подтверждён' : 'Галочка снята'); }

function setWho(id,i,v){ const e = EXPERTS.find(x=>x.id===id); e.who = e.who || ['Тревога и постоянное напряжение','Нет сил и хочется всё бросить']; e.who[i]=v; }
function addWho(id){ const e = EXPERTS.find(x=>x.id===id); e.who = e.who || []; e.who.push('Новый пункт'); render(); }

function dropExpTag(id, t){ const e = EXPERTS.find(x=>x.id===id); e.t = e.t.filter(x=>x!==t); render(); }
function addExpTag(id, t){ const e = EXPERTS.find(x=>x.id===id); if(!e.t.includes(t)) e.t.push(t); S.sheet=null; render(); toast('Тема добавлена'); }
function setAch(id,i,v){ const e = EXPERTS.find(x=>x.id===id); e.ach = e.ach||[]; e.ach[i]=v; }
function addAch(id){ const e = EXPERTS.find(x=>x.id===id); e.ach = e.ach||[]; e.ach.push('Новое достижение'); render(); }

/* ---------- образование эксперта ---------- */
function exEduBlock(){
  const e = me();
  const edu = e.edu || [];
  const ST = {approved:['подтверждено','st-paid'], pending:['на проверке','st-trial'], rejected:['отклонено','st-no']};
  return `<div class="card">
    <div class="spread"><b style="font-size:14.5px">Образование</b>
      <button class="btn xs ghost" onclick="openSheet({k:'newEdu',id:'${e.id}'})">＋ Добавить</button></div>
    <p class="small muted" style="margin:5px 0 10px">Диплом или сертификат проверяет администратор. Ученицы видят только название
      с отметкой о проверке, сам документ не публикуется.</p>
    ${edu.length ? edu.map(x => `<div class="uline">
      <div style="flex:1"><b style="font-size:13px">${esc(x.t)}</b>
        <div class="small muted">${x.y}${MEDIA['cert_'+x.id] ? ' · скан загружен' : ' · скан не загружен'}</div>
        ${x.comment ? `<div class="small" style="color:var(--warn);margin-top:3px">${esc(x.comment)}</div>` : ''}</div>
      <span class="tag-st ${ST[x.st][1]}">${ST[x.st][0]}</span>
      <button class="chip" onclick="pickImage('cert_${x.id}')">▣</button>
      <button class="chip" onclick="delEdu('${e.id}','${x.id}')">✕</button>
    </div>`).join('') : '<div class="small muted">Пока ничего не добавлено</div>'}
  </div>`;
}

function exEdu(){
  const e = me();
  const edu = e.edu || [];
  const ST = {approved:['подтверждено','st-paid'], pending:['на проверке','st-trial'], rejected:['отклонено','st-no']};
  return `
  <p class="small muted" style="margin:0 0 12px">Добавь дипломы и сертификаты. Администратор проверит документы: сами файлы ученицы не видят,
    в карточке появится только строка об образовании с отметкой о проверке.</p>
  <button class="btn" onclick="openSheet({k:'newEdu',id:'${e.id}'})">＋ Добавить образование</button>

  <div class="sec-h"><h2 class="serif">Мои документы</h2><span class="small muted">${edu.length}</span></div>
  ${edu.length ? edu.map(x => `<div class="card">
    <div class="spread">
      <div style="flex:1"><b style="font-size:14px">${esc(x.t)}</b>
        <div class="small muted">${x.y}</div></div>
      <span class="tag-st ${ST[x.st][1]}">${ST[x.st][0]}</span>
    </div>
    ${x.comment ? `<div class="small" style="color:var(--warn);margin-top:8px">Редакция: ${esc(x.comment)}</div>` : ''}
    <div class="row" style="margin-top:10px;gap:8px">
      ${MEDIA['cert_'+x.id] ? `<img src="${MEDIA['cert_'+x.id]}" style="width:72px;height:52px;object-fit:cover;border-radius:10px">` : ''}
      <button class="btn ghost sm" onclick="pickImage('cert_${x.id}')">${MEDIA['cert_'+x.id]?'Заменить скан':'Загрузить скан'}</button>
      <button class="btn ghost sm" onclick="delEdu('${e.id}','${x.id}')">Удалить</button>
    </div>
  </div>`).join('') : '<div class="empty">Пока ничего не добавлено</div>'}`;
}
function delEdu(eid, id){
  const e = EXPERTS.find(x=>x.id===eid);
  e.edu = (e.edu||[]).filter(x => x.id !== id);
  delete MEDIA['cert_'+id];
  render(); toast('Удалено');
}

function exServices(){
  const e = me();
  const sv = e.services || [];
  return `
  <p class="small muted" style="margin:0 0 12px">Консультации, разборы, пакеты встреч. Услуга может быть и бесплатной -
    короткое знакомство хорошо работает как первый шаг.</p>
  <button class="btn" onclick="openSheet({k:'service'})">＋ Добавить услугу</button>
  <div class="sec-h"><h2 class="serif">Мои услуги</h2><span class="small muted">${sv.length}</span></div>
  ${sv.length ? sv.map(x => {
    const off = x.until && new Date(x.until) > new Date();
    return `<div class="card">
      <div class="spread"><b style="font-size:14.5px">${esc(x.t)}</b>
        <span class="tag-st ${x.price?'st-paid':'st-think'}">${x.price?money(x.price):'бесплатно'}</span></div>
      <div class="small muted" style="margin:4px 0 6px">${x.mins} мин · ${esc(x.format)}</div>
      ${off ? `<div class="small" style="color:var(--lilac);font-weight:600">Спецусловие до ${new Date(x.until).toLocaleDateString('ru-RU')}${x.oldPrice?', прежняя цена '+money(x.oldPrice):''}</div>` : ''}
      <p class="small muted" style="margin:6px 0 0">${esc(x.about||'')}</p>
      <div class="acts">
        <button class="btn ghost sm" onclick="openSheet({k:'service',id:'${x.id}'})">Редактировать</button>
        <button class="btn ghost sm" onclick="S.viewExpert='${e.id}';S.page='expertPublic';render()">Как видит ученица</button>
      </div>
    </div>`;
  }).join('') : '<div class="empty">Услуг пока нет</div>'}`;
}

/* ---------- мероприятия эксперта ---------- */
function exEvents(){
  const e = me();
  const mine = EVENTS.filter(x => x.by === e.n);
  const ST = {live:['опубликовано','st-paid'], pending:['на согласовании','st-trial'],
    rework:['на доработке','st-trial'], rejected:['отклонено','st-no']};
  return `
  <p class="small muted" style="margin:0 0 12px">Заполни карточку мероприятия - администратор проверит и опубликует.
    Механика та же, что с контентом: можно доработать и отправить снова.</p>
  <button class="btn" onclick="openSheet('newEvent')">＋ Предложить мероприятие</button>

  <div class="sec-h"><h2 class="serif">Мои мероприятия</h2><span class="small muted">${mine.length}</span></div>
  ${mine.length ? mine.map(x => `<div class="acard">
    <div class="top">
      <button class="thumb" onclick="pickImage('${x.id}')">${cover(x.id,'practice')}</button>
      <div style="flex:1;min-width:0">
        <div class="spread" style="align-items:flex-start">
          <b style="font-size:13.5px;line-height:1.3">${x.t}</b>
          <span class="tag-st ${ST[x.status][1]}">${ST[x.status][0]}</span></div>
        <div class="small muted" style="margin-top:3px">${new Date(x.d).toLocaleDateString('ru-RU',{day:'numeric',month:'long'})}, ${x.tm}</div>
        <div class="small muted">${x.mode === 'онлайн' ? 'Онлайн · ' + x.city : x.city + (x.place ? ', ' + x.place : '')}
          · ${x.price ? money(x.price) : 'бесплатно'}</div>
        ${x.comment ? `<div class="small" style="color:var(--warn);margin-top:4px">Редакция: ${esc(x.comment)}</div>` : ''}
      </div>
    </div>
    <div class="bar2">
      <span class="chip pale">${x.seats - x.left} из ${x.seats} записались</span>
      <button class="chip" onclick="openSheet({k:'eventEdit',id:'${x.id}'})">Изменить</button>
      <button class="chip" style="margin-left:auto" onclick="dropEvent('${x.id}')">✕</button>
    </div>
  </div>`).join('') : '<div class="empty">Пока нет мероприятий</div>'}`;
}


/* ---------- услуги и мероприятия ---------- */
function exOffers(){
  const sub = S.offSub || 'services';
  return `
  <div class="seg">
    <button class="${sub==='services'?'on':''}" onclick="S.offSub='services';render()">Услуги</button>
    <button class="${sub==='events'?'on':''}" onclick="S.offSub='events';render()">Мероприятия</button>
  </div>
  ${sub === 'services' ? exServices() : exEvents()}`;
}

/* ---------- доход, статистика и ссылки ---------- */
function exIncome(){
  const e = me(), st = EXPERT_STATS;
  const rate = 25;
  const slug = e.n.split(' ')[0].toLowerCase();
  const mine = COURSES.filter(c => c.e === e.n);
  const courseIncome = mine.reduce((a,c) => a + Math.round(c.p*c.s*0.02*0.5), 0);
  const invited = [
    {n:'Настя К.', ago:'3 дня назад', st:'подписка', sum:2900},
    {n:'Ирина Д.', ago:'неделю назад', st:'купила курс', sum:4900},
    {n:'Камила Ю.', ago:'2 недели назад', st:'пробный период', sum:0},
    {n:'Лена С.', ago:'месяц назад', st:'подписка + курс', sum:7800}
  ];
  const refIncome = invited.reduce((a,i) => a + Math.round(i.sum*rate/100), 0);
  return `
  <div class="card" style="background:var(--grad-dark);color:#fff;border-color:transparent">
    <div class="g2">
      <div><div class="small" style="opacity:.7">Доход за месяц</div>
        <div class="serif" style="font-size:28px;margin-top:4px;color:#fff">${money(courseIncome + refIncome)}</div></div>
      <div><div class="small" style="opacity:.7">Твоя доля с приглашённых</div>
        <div class="serif" style="font-size:28px;margin-top:4px;color:#fff">${rate}%</div></div>
    </div>
    <div class="acts">
      <button class="btn" style="background:#fff;color:var(--ink)" onclick="toast('Заявка на вывод принята')">Вывести</button>
      <button class="btn ghost" style="background:rgba(255,255,255,.14);color:#fff;border-color:rgba(255,255,255,.2)"
        onclick="copyText('https://eva.space/r/${slug}')">Скопировать ссылку</button>
    </div>
  </div>

  <div class="g2">
    <div class="card" style="margin:0"><div class="small muted">С курсов</div>
      <div class="serif" style="font-size:21px;margin-top:3px">${money(courseIncome)}</div></div>
    <div class="card" style="margin:0"><div class="small muted">С приглашённых</div>
      <div class="serif" style="font-size:21px;margin-top:3px">${money(refIncome)}</div></div>
  </div>

  <div class="sec-h"><h2 class="serif">Твои ссылки</h2></div>
  ${[['Страница эксперта', `eva.space/e/${slug}`, 'Профиль, услуги и материалы. Открывается без подписки'],
     ['Каталог курсов', `eva.space/e/${slug}/courses`, 'Прямая ссылка на твои курсы с оплатой'],
     ['Реферальная ссылка', `eva.space/r/${slug}`, `Приводит на платформу, ты получаешь ${rate}% с покупок`]].map(([t,u,d]) => `
    <div class="card">
      <b style="font-size:14px">${t}</b>
      <div class="small muted" style="margin:3px 0 8px">${d}</div>
      <div class="linkbox">${u}</div>
      <button class="btn ghost sm" style="margin-top:9px" onclick="copyText('https://${u}')">Скопировать</button>
    </div>`).join('')}

  <div class="sec-h"><h2 class="serif">Кто пришёл по твоей ссылке</h2>
    <span class="small muted">${invited.length}</span></div>
  ${invited.map(i => `<div class="card" style="padding:12px">
    <div class="spread">
      <div class="row"><div class="dot-ava" style="background:var(--lilac)">${i.n[0]}</div>
        <div><b style="font-size:13.5px">${i.n}</b>
          <div class="small muted">${i.ago} · ${i.st}</div></div></div>
      <b style="font-size:13px;color:${i.sum?'var(--ok)':'var(--muted)'}">
        ${i.sum ? '+'+money(Math.round(i.sum*rate/100)) : 'ещё не оплатила'}</b>
    </div></div>`).join('')}

  <div class="sec-h"><h2 class="serif">Статистика</h2></div>
  <div class="g2">
    ${[['Просмотров', st.views.toLocaleString('ru-RU')],['Досматривают', st.done+'%'],
       ['Учениц', st.students.toLocaleString('ru-RU')],['Рейтинг','★ '+e.rate]].map(([l,v]) =>
      `<div class="card" style="margin:0"><div class="small muted">${l}</div>
        <div class="serif" style="font-size:21px;margin-top:3px">${v}</div></div>`).join('')}
  </div>
  <div class="card" style="margin-top:10px">
    <b style="font-size:14.5px">Просмотры за неделю</b>
    <div class="rep">${st.week.map((n,i) => `<div><i style="height:${n/Math.max(...st.week)*84}px"></i><span>${DAYS[i]}</span></div>`).join('')}</div>
  </div>`;
}


/* ---------- настройки эксперта ---------- */
function exSettings(){
  const e = me();
  const acc = S.user ? DB.find(S.user.email) : null;
  return `
  <h2 class="serif" style="font-size:20px;margin:0 0 4px">Настройки аккаунта</h2>
  <p class="small muted" style="margin:0 0 14px">Имя видят ученицы на публичной странице и в чатах.</p>

  <div class="card" style="text-align:center">
    <div style="width:88px;height:88px;margin:0 auto 12px;position:relative">
      <div class="pcirc" style="width:88px;height:88px">${expPic(e)}</div>
      <button class="camera" onclick="pickImage('${e.id}')">▣</button>
    </div>
    <div class="small muted">Фото на публичной странице</div>
  </div>

  <div class="card">
    <label class="lbl" style="margin-top:0">Имя и фамилия</label>
    <input class="field" id="ex_name" value="${esc(e.n)}" placeholder="Как тебя видят ученицы">
    <label class="lbl">Специализация</label>
    <input class="field" id="ex_role" value="${esc(e.r)}" placeholder="Психолог, самооценка">
    <button class="btn" onclick="saveExpertName()">Сохранить</button>
  </div>

  <div class="card">
    <b style="font-size:14.5px">Вход в кабинет</b>
    <div class="uline" style="margin-top:8px"><span class="small muted" style="width:76px">Почта</span>
      <b style="font-size:12.5px;flex:1;word-break:break-all">${acc ? esc(acc.email) : (S.user ? esc(S.user.email) : 'не указана')}</b>
      <button class="btn xs ghost" onclick="openSheet('exMail')">Изменить</button></div>
    <div class="uline"><span class="small muted" style="width:76px">Пароль</span>
      <b style="font-size:12.5px;flex:1">••••••••</b>
      <button class="btn xs ghost" onclick="openSheet('exPass')">Сменить</button></div>
    <div class="uline"><span class="small muted" style="width:76px">Телеграм</span>
      <input class="field" style="margin:0;flex:1;padding:7px 10px;font-size:12.5px"
        placeholder="@nickname" value="${esc(e.tg||'')}" oninput="me().tg=this.value"></div>
  </div>

  <div class="card">
    <b style="font-size:14.5px">Публичная страница</b>
    <div class="small muted" style="margin:4px 0 9px">Так тебя видят ученицы</div>
    <button class="btn ghost" onclick="S.viewExpert='${e.id}';S.page='expertPublic';render()">Посмотреть</button>
  </div>

  <button class="btn ghost" onclick="logout()">Выйти из аккаунта</button>`;
}

function saveExpertName(){
  const e = me();
  const n = (($('#ex_name')||{}).value || '').trim();
  const r = (($('#ex_role')||{}).value || '').trim();
  if(!n) return toast('Имя не может быть пустым');
  const old = e.n;
  e.n = n;
  if(r) e.r = r;
  /* переносим авторство материалов, курсов и мероприятий на новое имя */
  LIB.forEach(x => { if(x.expert === old) x.expert = n; });
  (S.pending || []).forEach(x => { if(x.expert === old) x.expert = n; });
  COURSES.forEach(c => { if(c.e === old) c.e = n; });
  EVENTS.forEach(v => { if(v.by === old) v.by = n; });
  if(S.user){
    const u = DB.find(S.user.email);
    if(u){ u.name = n; DB.upsert(u); }
    S.user.name = n;
  }
  syncPush(); render(); schedulePersist();
  toast('Изменения сохранены');
}


/* ---------- шаблоны для профиля ---------- */
const ABOUT_TPL = [
  'Работаю с женщинами больше {N} лет. Пришла в профессию из собственного опыта: сначала помогла себе, потом это стало делом жизни. Веду в мягком темпе, без давления и обещаний быстрых результатов.',
  'Помогаю женщинам вернуть контакт с собой в моменты, когда сил не осталось. В основе - {метод}, проверенный на практике и на себе. Не даю универсальных советов: у каждой своя история.',
  'Веду практику с {ГОД} года. За это время через мои курсы и консультации прошло больше {N} женщин. Верю, что забота о себе - это не роскошь и не эгоизм, а условие, при котором хватает сил на остальное.'
];
const MISSION_TPL = [
  'Показать женщине, что забота о себе занимает не два часа, а десять минут - и эти минуты меняют весь день.',
  'Помочь женщине услышать свой голос раньше, чем голоса всех остальных.',
  'Сделать так, чтобы женщина перестала выбирать между собой и близкими - и поняла, что это не выбор.'
];
const WHO_TPL = [
  'Постоянная тревога, которая стала фоном',
  'Нет сил, хотя внешне всё нормально',
  'Внутренний критик громче собственного голоса',
  'Сложно говорить «нет» без чувства вины',
  'Тело как чужое, движение через силу',
  'Растворяюсь в семье и не помню, чего хочу сама',
  'Плохо сплю, голова не выключается',
  'Занижаю свою цену и беру больше, чем могу'
];
const ACH_TPL = [
  'Провела больше {N} индивидуальных консультаций',
  'Автор курса «{название}», который прошли {N} женщин',
  'Спикер профильных конференций и подкастов',
  'Супервизор в программе подготовки специалистов',
  'Больше {N} часов личной практики'
];
function useTpl(sel, field, i, kind){
  const arr = kind === 'about' ? ABOUT_TPL : MISSION_TPL;
  const el = document.querySelector(sel);
  if(el){ el.value = arr[i]; el.focus(); }
  setExp(field, arr[i]);
  toast('Шаблон подставлен - поправь под себя');
}
function addWhoTpl(id, text){
  const e = EXPERTS.find(x => x.id === id);
  e.who = e.who || [];
  if(!e.who.includes(text)) e.who.push(text);
  render(); syncPush(['experts']);
}
function addAchTpl(id, text){
  const e = EXPERTS.find(x => x.id === id);
  e.ach = e.ach || [];
  if(!e.ach.includes(text)) e.ach.push(text);
  render(); syncPush(['experts']);
}

function delWho(id, i){ const e = EXPERTS.find(x=>x.id===id); e.who.splice(i,1); render(); syncPush(['experts']); }
function delAch(id, i){ const e = EXPERTS.find(x=>x.id===id); e.ach.splice(i,1); render(); syncPush(['experts']); }

