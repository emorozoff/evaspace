/* Новые люди в команде: приглашение ссылкой с ролью, регистрация по ней
   с данными из карточки (их можно поправить и дописать), приветствие
   новичка и командный дух на главной — комплимент дня, неделя команды,
   герои недели и дни рождения.
   Ссылка — адрес штаба с #join=КОД. Если площадка не передаст часть после #,
   в том же сообщении есть код: «У меня приглашение» → код → та же анкета. */

const HQ_URL = 'https://claude.ai/artifact/3KYL4dL825LveSe7AHEAeR';

/* ── Human Design: тип и профиль ── */
const HD_TYPES = {
  generator:  {name: 'Генератор', strategy: 'откликаться на то, что по-настоящему зажигает', sign: 'удовлетворение',
    gift: 'твоя энергия — двигатель команды: когда дело откликается, оно горит в руках.',
    about: 'Энергия, которая строит: лучше всего работает, когда дело по-настоящему откликается.'},
  mg:         {name: 'Манифестирующий генератор', strategy: 'откликаться и сообщать, прежде чем действовать', sign: 'удовлетворение и покой',
    gift: 'ты успеваешь за троих и находишь короткий путь там, где другие его не видят.',
    about: 'Скорость и многозадачность: находит короткий путь и успевает за троих.'},
  manifestor: {name: 'Манифестор', strategy: 'сообщать о решениях до того, как действовать', sign: 'покой',
    gift: 'ты умеешь начинать то, на что другие не решаются, — без этого компанию на миллиард не построить.',
    about: 'Инициатор: запускает новое и задаёт команде движение.'},
  projector:  {name: 'Проектор', strategy: 'ждать приглашения и признания', sign: 'успех',
    gift: 'ты видишь людей и процессы насквозь — твой взгляд помогает всей команде работать умнее.',
    about: 'Видит людей и процессы насквозь и помогает команде работать умнее.'},
  reflector:  {name: 'Рефлектор', strategy: 'давать важным решениям время — около лунного цикла', sign: 'удивление',
    gift: 'ты чувствуешь команду как никто: по тебе видно, где нам хорошо и что пора менять.',
    about: 'Зеркало команды: чувствует, где всем хорошо и что пора менять.'},
};
const HD_PROFILES = ['1/3', '1/4', '2/4', '2/5', '3/5', '3/6', '4/6', '4/1', '5/1', '5/2', '6/2', '6/3'];
const HD_LINES = ['', 'Исследователь', 'Отшельник', 'Экспериментатор', 'Оппортунист', 'Еретик', 'Ролевая модель'];
const hdProfileName = pr => { const [a, b] = String(pr || '').split('/').map(Number); return HD_LINES[a] && HD_LINES[b] ? `${HD_LINES[a]} / ${HD_LINES[b]}` : ''; };
const capFirst = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/* ── имя: в карточке храним целиком и по частям ── */
function nameParts(p) {
  if (!p) return {given: '', surname: ''};
  if (p.givenName || p.surname) return {given: p.givenName || '', surname: p.surname || ''};
  const [given = '', ...rest] = String(p.name || '').trim().split(/\s+/);
  return {given, surname: rest.join(' ')};
}
const joinName = (given, surname) => [given, surname].map(x => String(x || '').trim()).filter(Boolean).join(' ');
const givenOf = p => nameParts(p).given || firstName(p);

/* ближайший день рождения: дата, через сколько дней */
function nextBirthday(iso, from = today()) {
  if (!/^\d{4}-\d\d-\d\d$/.test(iso || '')) return null;
  const y = Number(from.slice(0, 4));
  let d = isoOf(dateOf(`${y}-${iso.slice(5)}`));
  if (d < from) d = isoOf(dateOf(`${y + 1}-${iso.slice(5)}`));
  return {date: d, days: daysBetween(from, d)};
}
const isBirthday = (p, d = today()) => !!(p && p.birthDate && p.birthDate.slice(5) === d.slice(5));

/* ── большая цель и обращение к новичку: правит основатель в «Команде» ── */
const VISION_DEFAULT = {
  big: 'Компания на миллиард',
  welcome: 'Мы строим Eva Space — и строим её как компанию на миллиард. Здесь каждый отвечает за свой участок, доводит дела до конца и подставляет плечо соседу. Мы рады, что теперь ты с нами.',
  year: '',
};
const vision = () => ({...VISION_DEFAULT, ...((Strategy.doc() || {}).vision || {})});

/* ── приглашение ── */
const JOIN_FIELDS = [
  ['given', 'Имя'], ['surname', 'Фамилия'], ['title', 'Должность'], ['email', 'Почта'], ['phone', 'Телефон'], ['telegram', 'Телеграм'],
  ['birthDate', 'День рождения'], ['birthTime', 'Время рождения'], ['birthCity', 'Город рождения'], ['hdType', 'Тип по Human Design'], ['hdProfile', 'Профиль'],
];
/* что знает карточка: эти поля подтянутся в анкету */
function cardValues(p, inv = {}) {
  const n = nameParts(p);
  const title = p && p.title && p.title !== 'Новый человек' ? p.title : (inv.title && inv.title !== 'Новый человек' ? inv.title : '');
  const v = {given: n.given, surname: n.surname, title, dir: (p && p.dir) || inv.dir || ''};
  ['email', 'phone', 'telegram', 'birthDate', 'birthTime', 'birthCity', 'hdType', 'hdProfile'].forEach(k => { v[k] = (p && p[k]) || ''; });
  if (v.hdType && !HD_TYPES[v.hdType]) v.hdType = '';
  return v;
}
const pendingInvite = pid => Store.all('invites').find(i => i.personId === pid && !i.usedBy) || null;
/* в артефакте Claude адрес страницы изнутри не виден — берём адрес штаба */
const hqBase = () => (Store.state.mode === 'db' ? HQ_URL : location.href.split('#')[0]);
function inviteLink(code) { return `${hqBase()}#join=${code}`; }
/* ключ анкеты: поменялся — анкету можно дорисовать (данные пришли позже) */
function joinKey(code) {
  const inv = Store.get('invites', normCode(code));
  return JSON.stringify([code, !!inv, inv && inv.usedBy, inv && inv.role, inv ? cardValues(personById(inv.personId), inv) : 0]);
}
function inviteText(code) {
  const inv = Store.get('invites', code) || {};
  const g = givenOf(personById(inv.personId));
  return `${g ? g + ', привет' : 'Привет'}! Приглашаю тебя в штаб Eva Space — нашу команду, которая строит компанию на миллиард.

Ссылка: ${inviteLink(code)}
Доступ: ${ROLES[roleOf(inv.role)].name}.

По ссылке откроется короткая анкета — часть данных уже заполнена, проверь и допиши остальное. Если вместо анкеты откроется вход, нажми «У меня приглашение» и введи код ${code}.${Store.state.mode === 'db' ? '\n\nОткрывай ссылку в своём аккаунте Claude — в том, на чью почту пришёл доступ к штабу.' : ''}`;
}
/* основателю: без доступа на редактирование анкета не сохранится */
function shareHelpHtml() {
  if (Store.state.mode !== 'db') return '';
  return `<div class="iv-share">${icon('help')}<div><b>Чтобы анкета сохранилась, человеку нужен доступ на редактирование.</b>
    <ol><li>«Поделиться» у штаба → пригласите человека <b>по почте его аккаунта Claude</b> с правом <b>«Редактор»</b> (Editor).</li>
      <li>Выключите доступ «всем по ссылке»: по общей ссылке люди не из вашей организации Claude могут только смотреть — и регистрация у них не сохранится.</li>
      <li>Отправьте ссылку-приглашение отсюда.</li></ol></div></div>`;
}
function fillHtml(p) {
  const v = cardValues(p);
  const has = JOIN_FIELDS.filter(([k]) => v[k]), miss = JOIN_FIELDS.filter(([k]) => !v[k]);
  return `<div class="iv-fill">
    <div><span class="label">Подтянется в анкету</span><div class="chips">${has.length ? has.map(([, n]) => `<span class="pill good">${n}</span>`).join('') : '<span class="note">пока ничего</span>'}</div></div>
    ${miss.length ? `<div><span class="label">Человек заполнит сам</span><div class="chips">${miss.map(([, n]) => `<span class="pill line">${n}</span>`).join('')}</div></div>` : ''}
    ${Auth.can('team.manage') ? `<button type="button" class="link-btn" data-iv-edit>${miss.length ? 'Дополнить карточку сейчас' : 'Изменить карточку'}</button>` : ''}
  </div>`;
}
function issueInvite(pid) {
  const p = pid ? personById(pid) : null;
  let inv = p ? pendingInvite(pid) : null;
  const roles = Object.entries(ROLES).filter(([k]) => k !== 'owner');
  const curRole = inv ? roleOf(inv.role) : 'member';
  const out = code => `<span class="label">Ссылка-приглашение</span>
    <div class="iv-link"><input class="input" id="ivLink" readonly value="${esc(inviteLink(code))}" aria-label="Ссылка-приглашение"><button type="button" class="btn sm primary" data-iv-copy-link>${icon('copy')}Скопировать ссылку</button></div>
    <pre class="iv-msg" id="ivMsg"></pre>
    <div class="row"><button type="button" class="btn sm" data-iv-copy-msg>${icon('copy')}Скопировать приглашение целиком</button><button type="button" class="btn sm ghost" data-iv-preview>Как увидит человек</button></div>
    <p class="note">Ссылка одноразовая: после регистрации она перестанет работать. Запасной код из сообщения — <span class="inv-code">${esc(code)}</span>.</p>
    ${shareHelpHtml()}`;
  openModal({
    title: p ? `Пригласить: ${personName(p)}` : 'Пригласить в команду',
    wide: true,
    body: `${p ? `<div class="iv-who">${avatar(p, 'lg')}<div><b>${esc(personName(p))}</b><small>${esc([p.title, DIRS[p.dir] ? DIRS[p.dir].name : ''].filter(Boolean).join(' · ') || 'должность не указана')}</small></div></div>`
      : `<div class="grid2"><label class="field"><span>Имя</span><input class="input" id="ivGiven" placeholder="Анна"></label>
          <label class="field"><span>Фамилия</span><input class="input" id="ivSurname" placeholder="Смирнова"></label></div>
        <div class="grid2"><label class="field"><span>Должность</span><input class="input" id="ivTitle" placeholder="SMM-менеджер"></label>
          <label class="field"><span>Направление</span><select class="select" id="ivDir"><option value="">Без направления</option>${Object.entries(DIRS).map(([k, d]) => `<option value="${k}">${d.name}</option>`).join('')}</select></label></div>`}
      <div class="field"><span>Доступ в штабе</span><div class="iv-roles" role="radiogroup">${roles.map(([k, r]) => `<label class="iv-role ${k === curRole ? 'on' : ''}"><input type="radio" name="ivRole" value="${k}" ${k === curRole ? 'checked' : ''}><b>${r.name}</b><small>${esc(r.about)}</small></label>`).join('')}</div></div>
      ${p ? fillHtml(p) : '<p class="note">Остальное — день рождения, контакты, Human Design — человек допишет сам в анкете по ссылке.</p>'}
      <div class="invite-out" id="ivOut" ${inv ? '' : 'hidden'}>${inv ? out(inv.id) : ''}</div>`,
    foot: `<button class="btn" data-close>Готово</button><button class="btn primary" id="ivGo">${inv ? 'Выдать новую ссылку' : `${icon('link')}Создать ссылку`}</button>`,
    onMount(el, close) {
      const role = () => ($('input[name=ivRole]:checked', el) || {}).value || 'member';
      const paintOut = () => {
        $('#ivOut', el).innerHTML = out(inv.id);
        $('#ivOut', el).hidden = false;
        $('#ivMsg', el).textContent = inviteText(inv.id);
      };
      if (inv) $('#ivMsg', el).textContent = inviteText(inv.id);
      on(el, 'change', 'input[name=ivRole]', (e, i) => {
        $$('.iv-role', el).forEach(x => x.classList.toggle('on', x.contains(i)));
        /* роль в уже выданной ссылке меняется сразу — ссылка та же */
        if (inv) { Store.patch('invites', inv.id, {role: i.value}); inv = Store.get('invites', inv.id); paintOut(); toast(`Доступ по ссылке: ${ROLES[i.value].name}`); }
      });
      $('#ivGo', el).onclick = () => {
        let personId = pid;
        if (!p) {
          const given = $('#ivGiven', el).value.trim(), surname = $('#ivSurname', el).value.trim(), title = $('#ivTitle', el).value.trim();
          if (!given && !title) { $('#ivGiven', el).focus(); toast('Напишите имя или должность'); return; }
          personId = Store.add('people', {name: joinName(given, surname), givenName: given, surname, title, dir: $('#ivDir', el).value, order: 50});
        }
        if (inv) Store.remove('invites', inv.id);
        const code = makeCode();
        const pp = personById(personId) || {};
        Store.put('invites', code, {role: role(), personId, title: pp.title || '', dir: pp.dir || '', by: Tasks.meKey(), at: Date.now()});
        inv = Store.get('invites', code);
        paintOut();
        $('#ivGo', el).textContent = 'Выдать новую ссылку';
        if (!p) $$('#ivGiven, #ivSurname, #ivTitle, #ivDir', el).forEach(x => { x.disabled = true; });
        toast('Ссылка готова — отправьте её человеку');
      };
      on(el, 'click', '[data-iv-copy-link]', (e, b) => copyText(inviteLink(inv.id), b));
      on(el, 'click', '[data-iv-copy-msg]', (e, b) => copyText(inviteText(inv.id), b));
      on(el, 'click', '[data-iv-preview]', () => previewJoin(inv.id));
      on(el, 'click', '[data-iv-edit]', () => { close(); editPerson(pid, {then: 'invite'}); });
    },
  });
}

/* ── анкета по ссылке ── */
function joinFormHtml(v, src, preview = false) {
  const tag = k => (src[k] ? '<em class="jf-src" title="Заполнено основателем — можно поправить">из карточки</em>' : '');
  const dis = preview ? 'disabled' : '';
  const inp = (k, label, type = 'text', attrs = '') => `<label class="field"><span>${label}${tag(k)}</span><input class="input" id="j-${k}" type="${type}" value="${esc(v[k] || '')}" ${attrs} ${dis}></label>`;
  return `<section class="jf-sec"><h3>О тебе</h3>
      <div class="grid2">${inp('given', 'Имя', 'text', 'autocomplete="given-name" maxlength="60"')}${inp('surname', 'Фамилия', 'text', 'autocomplete="family-name" maxlength="80"')}</div>
      <div class="grid2">${inp('title', 'Должность', 'text', 'placeholder="Например: SMM-менеджер" maxlength="80"')}
        <label class="field"><span>Направление${tag('dir')}</span><select class="select" id="j-dir" ${dis}><option value="">Без направления</option>${Object.entries(DIRS).map(([k, d]) => `<option value="${k}" ${k === v.dir ? 'selected' : ''}>${d.name}</option>`).join('')}</select></label></div>
    </section>
    <section class="jf-sec"><h3>Как с тобой связаться</h3>
      <div class="grid3">${inp('email', 'Почта — она же для входа', 'email', 'name="username" autocomplete="username" inputmode="email" placeholder="name@mail.ru"')}${inp('phone', 'Телефон', 'tel', 'autocomplete="tel" inputmode="tel" placeholder="+7 900 000-00-00"')}${inp('telegram', 'Телеграм', 'text', 'placeholder="@name"')}</div>
    </section>
    <section class="jf-sec"><h3>Рождение и Human Design <small>по желанию — чтобы команда знала тебя лучше</small></h3>
      <div class="grid3">${inp('birthDate', 'Дата рождения', 'date', `min="1940-01-01" max="${today()}"`)}${inp('birthTime', 'Время рождения', 'time')}${inp('birthCity', 'Город рождения', 'text', 'placeholder="Москва" maxlength="80"')}</div>
      <div class="field"><span>Кто ты по Human Design${tag('hdType')}</span>
        <div class="hd-types" role="radiogroup" aria-label="Тип по Human Design">${[...Object.entries(HD_TYPES), ['', {name: 'Не знаю'}]].map(([k, t]) => `<button type="button" class="chip hd-chip ${(v.hdType || '') === k ? 'on' : ''}" data-hd="${k}" role="radio" aria-checked="${(v.hdType || '') === k}" ${dis}>${t.name}</button>`).join('')}</div>
        <small class="hd-hint" id="jHdHint">${HD_TYPES[v.hdType] ? `Стратегия — ${HD_TYPES[v.hdType].strategy}.` : ''}</small></div>
      <label class="field hd-prof"><span>Профиль — две цифры из карты, например 3/5${tag('hdProfile')}</span><select class="select" id="j-hdProfile" ${dis}><option value="">Не знаю</option>${HD_PROFILES.map(pr => `<option value="${pr}" ${pr === v.hdProfile ? 'selected' : ''}>${pr} — ${hdProfileName(pr)}</option>`).join('')}</select></label>
      <p class="note">Тип и профиль считаются по дате, времени и месту рождения в любом калькуляторе Human Design. Не знаешь — оставь пустым, допишешь потом на своей странице.</p>
    </section>
    ${preview ? '' : `<section class="jf-sec"><h3>Пароль для входа</h3>
      <div class="grid2"><label class="field"><span>Пароль — от 6 символов</span><input class="input" id="j-pw" type="password" autocomplete="new-password"></label>
        <label class="field"><span>Пароль ещё раз</span><input class="input" id="j-pw2" type="password" autocomplete="new-password"></label></div>
      <p class="note">Не используй пароль от почты или банка: вход разделяет кабинеты внутри команды.</p></section>`}`;
}
function joinHeroHtml(inv, p, v) {
  const role = roleOf(inv.role);
  const by = inv.by ? whoName(inv.by) : '';
  return `<div class="join-hero">
    <div class="wl-sparks" aria-hidden="true">${sparksHtml()}</div>
    ${brandIcon('join-mark')}
    <p class="wl-kicker">Eva Space · ${esc(vision().big)}</p>
    <h1>${v.given ? `${esc(v.given)}, тебя` : 'Тебя'} приглашают в команду Eva Space</h1>
    <p>Мы строим компанию на миллиард — и хотим строить её вместе с тобой.${by && by !== 'кто-то' ? ` Приглашение от <b>${esc(by)}</b>.` : ''}</p>
    <div class="join-role"><span class="pill ${ROLES[role].tone}">${ROLES[role].name}</span><span>${esc(ROLES[role].about)}</span></div>
  </div>`;
}
function renderJoin(root, code) {
  const c = normCode(code), inv = Store.get('invites', c);
  if (!inv || inv.usedBy) {
    root.innerHTML = `<div class="auth one"><div class="auth-card card">
      <div class="auth-brand">${brandIcon('auth-mark')}<div><b>Eva Club</b><span>штаб команды Eva Space</span></div></div>
      <h1>${inv ? 'По этой ссылке уже зарегистрировались' : 'Ссылка-приглашение не работает'}</h1>
      <p class="auth-lead">${inv ? 'Войдите своей почтой и паролем.' : 'Приглашение отозвали или в ссылке опечатка. Попросите у основателя новую ссылку — или введите код из сообщения.'}</p>
      <div class="row"><button class="btn primary" data-join-mode="login">Войти</button>${inv ? '' : '<button class="btn" data-join-mode="invite">Ввести код</button>'}</div>
    </div></div>`;
    on(root, 'click', '[data-join-mode]', (e, b) => { View.set('authMode', b.dataset.joinMode); location.hash = ''; App.render({force: true}); });
    return;
  }
  const p = personById(inv.personId);
  const card = cardValues(p, inv);
  const src = Object.fromEntries(Object.entries(card).filter(([, x]) => x).map(([k]) => [k, true]));
  /* что человек уже набрал в этом браузере — не теряем при обновлении страницы */
  const draft = Local.get('eva-hq-join:' + c, null) || {};
  const v = {...card, ...Object.fromEntries(Object.entries(draft).filter(([, x]) => x))};
  const ro = Auth.canWrite === false;
  root.innerHTML = `<div class="join">
    ${joinHeroHtml(inv, p, v)}
    <form class="card join-form ${ro ? 'is-ro' : ''}" id="joinForm" novalidate autocomplete="on">
      ${ro ? `<div class="join-ro"><b>Сейчас штаб открыт тебе только на просмотр — регистрация не сохранится.</b>
        <p>Попроси основателя пригласить тебя в меню «Поделиться» штаба по почте твоего аккаунта Claude с правом «Редактор». Когда доступ придёт — обнови страницу и открой эту ссылку снова.</p>
        <div class="row"><button type="button" class="btn sm" data-join-ask>${icon('copy')}Скопировать сообщение основателю</button><button type="button" class="btn sm primary" data-join-reload>${icon('refresh')}Доступ дали — проверить</button></div></div>` : ''}
      <p class="join-lead">Проверь данные — часть мы уже заполнили. Всё можно поправить сейчас или потом на своей странице в штабе.</p>
      ${joinFormHtml(v, src)}
      <div class="auth-msg" id="joinMsg" hidden></div>
      <button class="btn primary join-go" type="submit" id="joinGo" ${ro ? 'disabled title="Сначала нужен доступ на редактирование"' : ''}>${icon('heart')}Присоединиться к команде</button>
      <p class="auth-note">Анкету видят все в команде штаба. Уже есть учётка? <button type="button" class="link-btn" data-join-mode="login">Войти</button></p>
    </form>
  </div>`;
  wireJoinForm(root, c);
  wirePwToggles(root);
  on(root, 'click', '[data-join-reload]', () => location.reload());
  on(root, 'click', '[data-join-ask]', (e, b) => copyText(`Привет! Открываю приглашение в штаб Eva Club, но штаб открыт мне только на просмотр — регистрация не сохраняется. Пригласи меня, пожалуйста, в «Поделиться» по почте моего аккаунта Claude с правом «Редактор».`, b));
  on(root, 'click', '[data-join-mode]', (e, b) => { View.set('authMode', b.dataset.joinMode); location.hash = ''; App.render({force: true}); });
  const first = $('#j-given', root);
  if (first && !first.value) setTimeout(() => { if (!document.activeElement || document.activeElement === document.body) first.focus(); }, 30);
}
function wireJoinForm(root, code) {
  let hd = (($('.hd-chip.on', root) || {}).dataset || {}).hd || '';
  on(root, 'click', '[data-hd]', (e, b) => {
    hd = b.dataset.hd;
    $('#joinForm', root).dataset.dirty = '1';
    $$('.hd-chip', root).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', String(x === b)); });
    $('#jHdHint', root).textContent = HD_TYPES[hd] ? `Стратегия — ${HD_TYPES[hd].strategy}.` : '';
  });
  const form = $('#joinForm', root), msg = $('#joinMsg', root), go = $('#joinGo', root);
  const val = k => (($('#j-' + k, root) || {}).value || '').trim();
  const fail = (text, k) => { msg.textContent = text; msg.hidden = false; const i = k && $('#j-' + k, root); if (i) { i.classList.add('bad'); i.focus(); } else msg.scrollIntoView({block: 'center', behavior: 'smooth'}); };
  /* черновик анкеты — в этом браузере, без пароля */
  const keep = () => {
    const d = {hdType: hd};
    ['given', 'surname', 'title', 'dir', 'email', 'phone', 'telegram', 'birthDate', 'birthTime', 'birthCity', 'hdProfile'].forEach(k => { d[k] = val(k); });
    Local.set('eva-hq-join:' + code, d);
  };
  on(form, 'input', '.input', (e, i) => { i.classList.remove('bad'); form.dataset.dirty = '1'; if (i.type !== 'password') keep(); });
  on(form, 'change', 'select', () => { form.dataset.dirty = '1'; keep(); });
  on(root, 'click', '[data-hd]', () => keep());
  form.addEventListener('submit', async e => {
    e.preventDefault();
    msg.hidden = true;
    Sound.unlock();
    const f = {code, hdType: hd};
    ['given', 'surname', 'title', 'dir', 'email', 'phone', 'telegram', 'birthDate', 'birthTime', 'birthCity', 'hdProfile'].forEach(k => { f[k] = val(k); });
    f.pw = ($('#j-pw', root) || {}).value || '';
    if (!f.given) return fail('Напиши имя.', 'given');
    if (!f.surname) return fail('Напиши фамилию.', 'surname');
    if (!/^\S+@\S+\.\S+$/.test(f.email)) return fail('Почта выглядит неправильно — по ней ты будешь входить в штаб.', 'email');
    if (Auth.findByEmail(f.email)) return fail('С этой почтой уже есть учётка — войди или укажи другую почту.', 'email');
    if (f.pw.length < 6) return fail('Пароль — не короче 6 символов.', 'pw');
    if (f.pw !== (($('#j-pw2', root) || {}).value || '')) return fail('Пароли не совпадают.', 'pw2');
    go.disabled = true;
    go.textContent = 'Создаю учётку…';
    try {
      await Auth.acceptInvite(f);
      Local.del('eva-hq-join:' + code);
      try { history.replaceState(null, '', '#home'); } catch (err) { location.hash = 'home'; }
      App.render({force: true});
    } catch (err) {
      fail(err.message || String(err));
      go.disabled = false;
      go.innerHTML = `${icon('heart')}Попробовать ещё раз`;
    }
  });
}
/* основатель смотрит, что подтянется в анкету */
function previewJoin(code) {
  const inv = Store.get('invites', code);
  if (!inv) return;
  const p = personById(inv.personId), v = cardValues(p, inv);
  const src = Object.fromEntries(Object.entries(v).filter(([, x]) => x).map(([k]) => [k, true]));
  openModal({
    title: 'Анкета по ссылке — как увидит человек',
    wide: true,
    focus: false,
    body: `<div class="join preview">${joinHeroHtml(inv, p, v)}<div class="join-form">${joinFormHtml(v, src, true)}</div></div>
      <p class="note">Поля с пометкой «из карточки» человек увидит заполненными и сможет поправить. Пустые допишет сам; дальше — пароль и приветствие.</p>`,
    foot: '<button class="btn primary" data-close>Понятно</button>',
  });
}

/* открыл ссылку, уже войдя в штаб (например, основатель проверяет) */
App.register('join', {
  title: 'Приглашение',
  render(root, code) {
    const c = normCode(code), inv = Store.get('invites', c), me = Auth.me();
    if (inv && inv.usedBy === me.id) { App.go('home'); return; }
    const p = inv ? personById(inv.personId) : null;
    root.innerHTML = `${pageHead('Ссылка-приглашение', '')}
      <div class="card join-in">
        ${inv && !inv.usedBy ? `<p>Это приглашение в штаб${p ? ` для <b>${esc(personName(p))}</b>` : ''}. Вы вошли как <b>${esc(me.name)}</b>.</p>
          <p class="note">Чтобы зарегистрироваться по ссылке, выйдите из своей учётки — откроется анкета. Посмотреть её, не выходя, можно кнопкой «Как увидит человек».</p>
          <div class="row"><button class="btn" data-join-preview>Как увидит человек</button><button class="btn" data-join-out>Выйти и зарегистрироваться</button><a class="btn primary" href="#home">Остаться в штабе</a></div>`
        : `<p>${inv ? 'По этой ссылке уже зарегистрировались.' : 'Приглашение не найдено — его отозвали или в ссылке опечатка.'}</p><div class="row"><a class="btn primary" href="#home">На главную</a></div>`}
      </div>`;
    on(root, 'click', '[data-join-out]', () => Auth.logout());
    on(root, 'click', '[data-join-preview]', () => previewJoin(c));
  },
});

/* ── приветствие новичка ── */
const WELCOME_STEPS = {
  owner: [['#team', 'Пригласите команду ссылками из «Команды» — у каждого своя роль'], ['#strategy', 'Проверьте цели квартала и этапы года в «Стратегии»'], ['#tasks', 'Раздайте задачи — исполнителю придёт уведомление со звуком']],
  lead: [['#m-standards', 'Прочитай Книгу стандартов — это час'], ['#tasks', 'Открой задачи своего направления: всё новое — в блоке «Для вас»'], ['#reports', 'К созвону в понедельник, 11:00, — цифры недели в «Отчётах»'], ['#me', 'Заполни свою страницу: фото, пара слов о себе, цели на квартал']],
  member: [['#m-standards', 'Прочитай Книгу стандартов и пройди тест в конце'], ['#tasks', 'Открой свои задачи: новое — в блоке «Для вас», сделано — жми «Готово»'], ['#me', 'Заполни свою страницу: фото, пара слов о себе, цели на квартал'], ['#calendar', 'Подключи Google Календарь — команда увидит, когда ты занят']],
  finance: [['#money', 'Финансы: обзор, баланс, приход и расход — всё на первой вкладке'], ['#money:refunds', 'Возвраты и сбои оплат — каждый запрос со сроком и статусом'], ['#money:plan', 'План и прогноз: платежи по месяцам и Cash Flow до Нового года'], ['#me', 'Заполни свою страницу: фото, пара слов о себе, цели на квартал']],
  investor: [['#strategy', 'Стратегия: цели квартала и дорожная карта'], ['#reports', 'Отчёты: продажи и Cash Flow до Нового года'], ['#home', 'Материалы для инвесторов — на главной']],
};
function sparksHtml() {
  return [[8, 18, 14], [86, 12, 10], [72, 62, 16], [18, 70, 9], [48, 8, 8], [93, 48, 7]]
    .map(([x, y, s], i) => `<svg viewBox="0 0 24 24" style="left:${x}%;top:${y}%;width:${s}px;height:${s}px;animation-delay:${(i * .45).toFixed(2)}s"><path d="M12 2c.7 5.6 2.4 7.3 8 8-5.6.7-7.3 2.4-8 8-.7-5.6-2.4-7.3-8-8 5.6-.7 7.3-2.4 8-8z"/></svg>`).join('');
}
function yearHtml(v) {
  const stages = Strategy.stages(), nowH = hOfDate(today());
  const miles = Strategy.miles().filter(m => !m.done && m.h >= nowH).slice(0, 3);
  const st = stages.map(s => {
    const a = hOfDate(s.from + '-01'), b = hOfDate(monthEnd(s.to));
    return `<li class="${nowH >= a && nowH <= b ? 'here' : ''}"><b>${esc(s.title)}</b><small>${monthShort(s.from)} — ${monthShort(s.to)}${nowH >= a && nowH <= b ? ' · мы здесь' : ''}</small></li>`;
  }).join('');
  if (!v.year && !st && !miles.length) return '<p class="note">Цели года появятся в «Стратегии».</p>';
  return `${v.year ? '<p class="wl-year"></p>' : ''}${st ? `<ul class="wl-stages">${st}</ul>` : ''}
    ${miles.length ? `<p class="wl-miles"><span>Ближайшие точки:</span> ${miles.map(m => `${esc(m.title)} — ${gShort(m.h)}`).join(' · ')}</p>` : ''}`;
}
function openWelcome({preview = false} = {}) {
  const me = Auth.me();
  if (!me) return;
  const p = Auth.person() || {name: me.name};
  const v = vision(), sc = settings().scenario, role = roleOf(me.role);
  const goals = Strategy.goals().slice(0, 5);
  const hd = HD_TYPES[p.hdType];
  openModal({
    title: 'Добро пожаловать',
    wide: true,
    focus: false,
    body: `<div class="wl-hero">
        <div class="wl-sparks" aria-hidden="true">${sparksHtml()}</div>
        ${brandIcon('wl-mark')}
        <p class="wl-kicker">Eva Space · ${esc(v.big)}</p>
        <h2 class="wl-title">Добро пожаловать в ярдную команду, ${esc(givenOf(p))}!</h2>
        <p class="wl-lead">Мы рады, что ты с нами.</p>
      </div>
      <p class="wl-text" id="wlText"></p>
      <div class="wl-grid">
        <section class="wl-card"><span class="label">Цель года</span>${yearHtml(v)}</section>
        <section class="wl-card"><span class="label">${Q.name}</span>
          <div class="wl-num"><b>${fmt(Plan.total(sc))}</b><span>продаж до 31 декабря · план «${SCENARIOS[sc].name}»</span></div>
          ${goals.length ? `<ol class="wl-goals">${goals.map(g => `<li><b>${esc(g.short || '')}</b>${g.title ? ` — ${esc(g.title)}` : ''}</li>`).join('')}</ol>` : '<p class="note">Цели квартала — в «Стратегии».</p>'}
        </section>
      </div>
      ${hd ? `<div class="wl-hd">${icon('spark')}<div><b>Ты — ${hd.name}${p.hdProfile ? ` · ${esc(p.hdProfile)}` : ''}</b><p>${capFirst(hd.gift)} Твоя стратегия — ${hd.strategy}.</p></div></div>` : ''}
      <div class="wl-start"><span class="label">С чего начать · ${ROLES[role].name}</span>
        <ol>${(WELCOME_STEPS[role] || WELCOME_STEPS.member).map(([href, text]) => `<li><a href="${href}">${esc(text)}</a></li>`).join('')}</ol></div>`,
    foot: `<button class="btn ghost" data-wl-go="strategy">Открыть стратегию</button><button class="btn primary" data-close>${icon('heart')}Поехали!</button>`,
    onMount(el, close) {
      el.classList.add('wl-modal');
      $('#wlText', el).textContent = v.welcome;
      const y = $('.wl-year', el); if (y) y.textContent = v.year;
      on(el, 'click', 'a[href^="#"]', () => close());
      on(el, 'click', '[data-wl-go]', (e, b) => { close(); App.go(b.dataset.wlGo); });
      Sound.play('hello');
    },
    onClose() { if (!preview && Auth.me() && Auth.me().welcomed === false) Store.patch('accounts', me.id, {welcomed: true, welcomedAt: Date.now()}); },
  });
}

/* основатель правит большую цель и обращение — их видит каждый новичок */
function onboardHtml() {
  const v = vision();
  return `<section class="section card onb">
    <div class="card-head"><h2>Приветствие новичков</h2><span class="note">его видит каждый, кто зарегистрировался по ссылке</span></div>
    <div class="grid2"><label class="field"><span>Большая цель</span><input class="input" id="vbBig" maxlength="60" value="${esc(v.big)}"></label>
      <label class="field"><span>Цель года <small class="note">пусто — покажем этапы года из «Стратегии»</small></span><input class="input" id="vbYear" maxlength="200" value="${esc(v.year)}" placeholder="Например: 10 000 платящих и выход на окупаемость"></label></div>
    <label class="field"><span>Обращение к новичку</span><textarea class="textarea" id="vbText" rows="3" maxlength="700"></textarea></label>
    <div class="row"><button class="btn primary sm" id="vbSave">Сохранить</button><button class="btn sm ghost" data-wl-preview>${icon('spark')}Посмотреть приветствие</button></div>
  </section>`;
}
function wireOnboard(root) {
  const ta = $('#vbText', root);
  if (!ta) return;
  ta.value = vision().welcome;
  $('#vbSave', root).onclick = () => {
    Strategy.save({vision: {big: $('#vbBig', root).value.trim() || VISION_DEFAULT.big, year: $('#vbYear', root).value.trim(), welcome: ta.value.trim() || VISION_DEFAULT.welcome}});
    toast('Приветствие сохранено');
  };
  on(root, 'click', '[data-wl-preview]', () => openWelcome({preview: true}));
}

/* ── командный дух на главной ── */
const COMPLIMENTS = [
  'с тобой даже сложные задачи выглядят решаемыми.',
  'твоя работа двигает всю команду вперёд — это видно.',
  'ты делаешь Еву сильнее каждый день.',
  'на тебя можно положиться — и это дорогого стоит.',
  'у тебя талант доводить дела до конца.',
  'команде повезло, что ты с нами.',
  'твои идеи делают продукт лучше.',
  'ты умеешь превращать хаос в понятный план.',
  'с тобой работать — одно удовольствие.',
  'ты задаёшь планку, до которой хочется дотянуться.',
  'спасибо за твою энергию — она заряжает всех вокруг.',
  'ты — часть того, из чего строится компания на миллиард.',
  'твоё внимание к деталям спасает нас чаще, чем кажется.',
  'у тебя отлично получается слышать людей.',
  'ты не боишься браться за новое — это и есть дух стартапа.',
  'каждая закрытая тобой задача — кирпич в нашем ярде.',
  'твоя честность помогает команде расти.',
  'рядом с тобой хочется работать лучше.',
  'ты находишь решение там, где другие видят стену.',
  'твой вклад заметен, даже когда о нём не говорят вслух.',
  'ты приносишь в команду спокойствие и уверенность.',
  'ты растёшь быстрее, чем успевает смениться квартал.',
  'ты помогаешь коллегам, не дожидаясь просьбы, — это ценно.',
  'ты — тот человек, с которым хочется строить большое.',
];
const SLOGANS = [
  'Компания на миллиард начинается с задачи, которую ты закроешь сегодня.',
  'Мы — команда, которая доводит до конца.',
  'Сильные вместе: помогаем друг другу и празднуем каждую победу.',
  'Каждый день — на шаг ближе к ярду.',
  'Мы строим то, чем будем гордиться.',
  'Маленькие победы каждый день складываются в большую компанию.',
];
const hashStr = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return h; };
function teamWeek() {
  const since = Date.now() - 7 * 864e5, t = today();
  const closed = Tasks.all().filter(x => x.status === 'done' && (x.doneAt || 0) >= since);
  const by = {};
  closed.forEach(x => { if (x.assignee && personById(x.assignee)) by[x.assignee] = (by[x.assignee] || 0) + 1; });
  const heroes = Object.entries(by).map(([pid, n]) => ({p: personById(pid), n})).sort((a, b) => b.n - a.n || personName(a.p).localeCompare(personName(b.p), 'ru')).slice(0, 3);
  let days = 0;
  for (let i = 0; i < 7; i++) if (Sales.day(addDays(t, -i))) days++;
  return {closed: closed.length, accepted: closed.filter(x => x.acceptedBy).length, days, heroes};
}
function birthdaysSoon(within = 14) {
  return people().filter(p => p.birthDate && pStatus(p) === 'active').map(p => ({p, b: nextBirthday(p.birthDate)})).filter(x => x.b && x.b.days <= within).sort((a, b) => a.b.days - b.b.days);
}
function spiritHtml() {
  const me = Auth.me(), p = Auth.person();
  const t = today(), g = p ? givenOf(p) : String(me.name || '').split(' ')[0];
  const bday = isBirthday(p, t);
  const hd = p && HD_TYPES[p.hdType];
  const pool = hd ? [hd.gift, ...COMPLIMENTS] : COMPLIMENTS;
  const seed = hashStr(((p && p.id) || me.id) + t);
  const k = View.get('sp.k', 0);
  const text = pool[(seed + k) % pool.length];
  const slogan = SLOGANS[hashStr(t) % SLOGANS.length];
  const w = teamWeek();
  const soon = birthdaysSoon().filter(x => !(p && x.p.id === p.id && x.b.days === 0));
  const todayB = soon.filter(x => x.b.days === 0), later = soon.filter(x => x.b.days > 0).slice(0, 3);
  return `<section class="spirit card ${bday ? 'bday' : ''}">
    <div class="sp-main">
      <div class="wl-sparks" aria-hidden="true">${sparksHtml()}</div>
      <span class="sp-kicker">${icon(bday ? 'gift' : 'spark')}${bday ? 'С днём рождения!' : 'Комплимент дня'}</span>
      <p class="sp-text" id="spText">${esc(bday ? `${g}, с днём рождения! Вся команда Eva Space рядом — пусть этот год будет самым смелым и счастливым.` : `${g}, ${text}`)}</p>
      <div class="sp-foot"><span class="sp-slogan">${esc(slogan)}</span>${bday ? '' : '<button type="button" class="sp-more" data-sp-next>Ещё комплимент</button>'}</div>
    </div>
    <div class="sp-side">
      <span class="label">Неделя команды</span>
      <div class="sp-stats"><div><b>${w.closed}</b><span>${plural(w.closed, 'задача закрыта', 'задачи закрыто', 'задач закрыто')}</span></div><div><b>${w.accepted}</b><span>согласовано</span></div><div><b>${w.days}/7</b><span>дней с цифрами</span></div></div>
      ${w.heroes.length ? `<div class="sp-heroes"><span class="sp-h-l">Герои недели</span>${w.heroes.map(h => `<a class="sp-hero" href="#p-${h.p.id}" title="${esc(personName(h.p))}: закрыто задач — ${h.n}">${avatar(h.p)}<b>${esc(firstName(h.p))}</b><em>${h.n}</em></a>`).join('')}</div>`
        : '<p class="note sp-empty">Закрой первую задачу недели — и попадёшь в герои.</p>'}
      ${todayB.length ? `<div class="sp-bdays now">${icon('gift')}<span>Сегодня день рождения: <b>${todayB.map(x => esc(personName(x.p))).join(', ')}</b> — поздравь!</span></div>` : ''}
      ${later.length ? `<div class="sp-bdays">${icon('gift')}<span>Скоро дни рождения: ${later.map(x => `<b>${esc(firstName(x.p))}</b> — ${dayShort(x.b.date)}`).join(', ')}</span></div>` : ''}
    </div>
  </section>`;
}
function wireSpirit(root) {
  on(root, 'click', '[data-sp-next]', () => {
    View.set('sp.k', View.get('sp.k', 0) + 1);
    const p = Auth.person(), me = Auth.me(), hd = p && HD_TYPES[p.hdType];
    const pool = hd ? [hd.gift, ...COMPLIMENTS] : COMPLIMENTS;
    const el = $('#spText', root);
    if (el) { el.textContent = `${p ? givenOf(p) : String(me.name || '').split(' ')[0]}, ${pool[(hashStr(((p && p.id) || me.id) + today()) + View.get('sp.k', 0)) % pool.length]}`; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
  });
}

/* ── рождение и дизайн на странице человека ── */
function birthHdHtml(p, edit) {
  const hd = HD_TYPES[p.hdType], nb = nextBirthday(p.birthDate);
  const rows = [
    p.birthDate ? `<div><span class="label">День рождения</span><b>${dayLong(p.birthDate)}</b><small>${nb && nb.days === 0 ? 'сегодня!' : nb ? `через ${nb.days} ${plural(nb.days, 'день', 'дня', 'дней')}` : ''}</small></div>` : '',
    p.birthTime ? `<div><span class="label">Время рождения</span><b>${esc(p.birthTime)}</b></div>` : '',
    p.birthCity ? `<div><span class="label">Город рождения</span><b>${esc(p.birthCity)}</b></div>` : '',
  ].filter(Boolean).join('');
  const body = rows || hd || p.hdProfile ? `${rows ? `<div class="pf-bd">${rows}</div>` : ''}
    ${hd || p.hdProfile ? `<div class="pf-hd"><div class="pf-tags">${hd ? `<span class="pill violet">${hd.name}</span>` : ''}${p.hdProfile ? `<span class="pill line">Профиль ${esc(p.hdProfile)} · ${hdProfileName(p.hdProfile)}</span>` : ''}</div>
      ${hd ? `<p>${p.id === Auth.personId() ? capFirst(hd.gift) : hd.about}</p><p class="note">Стратегия — ${hd.strategy}. Признак, что всё идёт верно, — ${hd.sign}.</p>` : ''}</div>` : ''}` : '';
  return `<section class="card pf-sec"><div class="card-head"><h2>Рождение и Human Design</h2>${edit ? `<button class="link-btn" data-pf-birth>${body ? 'Изменить' : 'Заполнить'}</button>` : ''}</div>
    ${body || `<p class="note">${edit ? 'День, время и город рождения, тип и профиль по Human Design — команде проще понять, как с тобой работать.' : 'Пока не заполнено.'}</p>`}</section>`;
}
function editBirth(p) {
  openModal({
    title: 'Рождение и Human Design',
    body: `<div class="grid3"><label class="field"><span>Дата рождения</span><input class="input" type="date" id="bdDate" value="${esc(p.birthDate || '')}" min="1940-01-01" max="${today()}"></label>
      <label class="field"><span>Время рождения</span><input class="input" type="time" id="bdTime" value="${esc(p.birthTime || '')}"></label>
      <label class="field"><span>Город рождения</span><input class="input" id="bdCity" value="${esc(p.birthCity || '')}" maxlength="80"></label></div>
      <div class="grid2"><label class="field"><span>Тип по Human Design</span><select class="select" id="bdHd"><option value="">Не знаю</option>${Object.entries(HD_TYPES).map(([k, t]) => `<option value="${k}" ${k === p.hdType ? 'selected' : ''}>${t.name}</option>`).join('')}</select></label>
      <label class="field"><span>Профиль</span><select class="select" id="bdProf"><option value="">Не знаю</option>${HD_PROFILES.map(pr => `<option value="${pr}" ${pr === p.hdProfile ? 'selected' : ''}>${pr} — ${hdProfileName(pr)}</option>`).join('')}</select></label></div>`,
    foot: '<button class="btn" data-close>Отмена</button><button class="btn primary" id="bdSave">Сохранить</button>',
    onMount(el, close) {
      $('#bdSave', el).onclick = () => {
        Store.patch('people', p.id, {birthDate: $('#bdDate', el).value, birthTime: $('#bdTime', el).value, birthCity: $('#bdCity', el).value.trim(), hdType: $('#bdHd', el).value, hdProfile: $('#bdProf', el).value});
        close();
        toast('Сохранено');
      };
    },
  });
}
