/* Страница человека: #me — своя, #p-<id> — любого в команде.
   Фото, о себе, миссия, увлечения тегами, зона ответственности, личные
   цели на квартал, обучение (общее для команды и своё), задачи, пароль.
   Править может сам человек и основатель; остальные смотрят. */

const LEARN_KINDS = {book: 'Книга', deck: 'Презентация', video: 'Ролик', course: 'Курс', task: 'Практика', link: 'Ссылка'};
const DEFAULT_LEARNING = {
  l_standards: {title: 'Книга стандартов и тест в конце', url: '#m-standards', kind: 'book', order: 1},
  l_quarter: {title: 'Квартал команды: цели, план продаж, премия', url: '#m-team', kind: 'deck', order: 2},
  l_speech: {title: 'Выступление основателя о квартале', url: '#m-speech', kind: 'video', order: 3},
  l_app: {title: 'Пройти приложение Ева глазами пользовательницы: тест, программа, клуб, покупка', url: '', kind: 'task', order: 4},
};
const Learning = {
  items() {
    const doc = Store.get('docs', 'learning');
    const src = doc && doc.items ? doc.items : DEFAULT_LEARNING;
    return Object.entries(src).map(([id, x]) => ({...x, id})).filter(x => !x.deleted).sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  },
  save(items) { return Store.patch('docs', 'learning', {items}); },
};
const canEditPerson = pid => Auth.isOwner() || (!!pid && Auth.personId() === pid);
const linkHref = u => (/^#[a-z0-9._~-]+$/i.test(u || '') ? u : safeUrl(u));

App.register('me', {
  title: 'Моя страница',
  render(root) {
    const pid = Auth.personId();
    if (pid && personById(pid)) return renderProfile(root, pid);
    renderAccountOnly(root);
  },
});
App.register('person', {
  title: 'Человек',
  render(root, pid) {
    if (!Auth.can('tasks.view') && pid !== Auth.personId()) { root.innerHTML = pageHead('Человек', '') + noAccess(); return; }
    if (!personById(pid)) { root.innerHTML = pageHead('Человек', '') + '<div class="empty"><b>Человек не найден</b>Возможно, его убрали из команды.</div>'; return; }
    renderProfile(root, pid);
  },
});

function renderProfile(root, pid) {
  const p = personById(pid);
  const own = Auth.personId() === pid;
  const edit = canEditPerson(pid);
  const acc = Store.all('accounts').find(a => a.personId === pid && a.active !== false);
  const st = PERSON_STATUS[pStatus(p)];
  const tasks = Tasks.all().filter(t => t.assignee === pid);
  const open = Tasks.sort(tasks.filter(t => Tasks.isOpen(t)));
  const late = open.filter(t => Tasks.overdue(t)).length;
  const doneQ = tasks.filter(t => t.status === 'done' && (t.doneAt || 0) >= dateOf(Q.start).getTime()).length;
  const goals = Object.entries(p.goals || {}).map(([id, g]) => ({...g, id})).filter(g => !g.deleted).sort((a, b) => (a.at || 0) - (b.at || 0));
  const learnTeam = Learning.items();
  const learnMine = Object.entries(p.myLearning || {}).map(([id, x]) => ({...x, id})).filter(x => !x.deleted).sort((a, b) => (a.at || 0) - (b.at || 0));
  const done = x => !!((p.learning || {})[x.id] || {}).done;
  const learnDone = learnTeam.filter(done).length + learnMine.filter(x => x.done).length;
  const learnAll = learnTeam.length + learnMine.length;
  const contacts = [['Почта', p.email || (acc && acc.email)], ['Телефон', p.phone], ['Телеграм', p.telegram]].filter(([, v]) => v);
  const sec = (key, title, body, empty) => `<section class="card pf-sec"><div class="card-head"><h2>${title}</h2>${edit ? `<button class="link-btn" data-pf-edit="${key}">${body ? 'Изменить' : 'Заполнить'}</button>` : ''}</div>
    ${body || `<p class="note">${edit ? empty : 'Пока не заполнено.'}</p>`}</section>`;
  const learnRow = (x, mine) => {
    const href = linkHref(x.url);
    const isDone = mine ? x.done : done(x);
    return `<li class="lr ${isDone ? 'done' : ''}">
      <label class="check"><input type="checkbox" ${mine ? `data-my-learn="${x.id}"` : `data-learn="${x.id}"`} ${isDone ? 'checked' : ''} ${edit ? '' : 'disabled'}></label>
      <div class="lr-t">${href ? `<a href="${esc(href)}" ${href.startsWith('#') ? '' : 'target="_blank" rel="noopener"'}>${esc(x.title)}${href.startsWith('#') ? '' : icon('ext')}</a>` : `<span>${esc(x.title)}</span>`}
        <small>${LEARN_KINDS[x.kind] || 'Материал'}${mine ? ' · моё' : ' · для всей команды'}</small></div>
      ${mine && edit ? `<button class="icon-btn" data-my-learn-del="${x.id}" title="Убрать">${icon('x')}</button>` : ''}
      ${!mine && Auth.isOwner() ? `<button class="icon-btn" data-learn-del="${x.id}" title="Убрать у всех">${icon('x')}</button>` : ''}
    </li>`;
  };

  root.innerHTML = `
    <div class="pf-head card">
      <div class="pf-photo ${edit ? 'can' : ''}">${avatar(p, 'xl')}${edit ? `<label class="pf-photo-btn" title="Сменить фото">${icon('edit')}<input type="file" accept="image/*" id="pfPhoto" hidden></label>` : ''}</div>
      <div class="pf-main">
        <div class="pf-name"><h1>${esc(p.name || 'Имя не указано')}</h1>${own ? '<span class="pill line">это вы</span>' : ''}</div>
        <p class="pf-title">${esc(p.title || 'Должность не указана')}${p.dir && DIRS[p.dir] ? ` · ${DIRS[p.dir].name}` : ''}</p>
        <div class="pf-tags"><span class="pill ${st.tone}">${st.name}</span>${acc ? rolePill(acc.role) : '<span class="pill line">без входа в штаб</span>'}${p.rate ? `<span class="pill line">${esc(p.rate)}</span>` : ''}${p.format ? `<span class="pill line">${esc(p.format)}</span>` : ''}</div>
        ${contacts.length ? `<div class="pf-contacts">${contacts.map(([k, v]) => `<button class="pf-ct" data-copy="${esc(v)}" title="Скопировать"><span>${k}</span><b>${esc(v)}</b></button>`).join('')}</div>` : ''}
      </div>
      <div class="pf-stats">
        <a href="#tasks" data-my-tasks><b>${open.length}</b><span>задач открыто</span></a>
        <div><b class="${late ? 'bad' : ''}">${late}</b><span>просрочено</span></div>
        <div><b>${doneQ}</b><span>сделано за квартал</span></div>
        <div><b>${learnDone}/${learnAll}</b><span>обучение</span></div>
      </div>
      <div class="pf-act">${Auth.isOwner() ? `<button class="btn sm" data-person-edit="${pid}">${icon('edit')}Условия и контакты</button>` : edit ? `<button class="btn sm" data-pf-edit="contacts">${icon('edit')}Контакты</button>` : ''}${p.photo && edit ? '<button class="btn sm ghost" data-photo-del>Убрать фото</button>' : ''}</div>
    </div>

    <div class="pf-grid">
      <div class="pf-col">
        ${sec('about', 'О себе', p.about ? '<p class="pf-text" data-f="about"></p>' : '', 'Пара предложений: откуда вы, чем занимались, что умеете лучше всего.')}
        ${sec('mission', 'Миссия', p.mission ? '<p class="pf-text pf-mission" data-f="mission"></p>' : '', 'Зачем вы в Еве — одной фразой.')}
        <section class="card pf-sec"><div class="card-head"><h2>Увлечения</h2></div>
          <div class="tags" id="pfTags">${(p.interests || []).map((t, i) => `<span class="tag">${esc(t)}${edit ? `<button data-tag-del="${i}" aria-label="Убрать">×</button>` : ''}</span>`).join('') || (edit ? '' : '<p class="note">Пока не заполнено.</p>')}
          ${edit ? '<input class="tag-in" id="pfTagIn" placeholder="+ добавить: йога, горы, книги… Enter" maxlength="40">' : ''}</div></section>
        ${sec('duties', 'Зона ответственности', p.duties || p.kpi ? `<div class="pf-kv">${p.duties ? '<span class="label">Обязанности</span><p class="pf-text" data-f="duties"></p>' : ''}${p.kpi ? '<span class="label">Результат (KPI)</span><p class="pf-text" data-f="kpi"></p>' : ''}</div>` : '', 'Что входит в обязанности и по какому результату оцениваем.')}
      </div>
      <div class="pf-col">
        <section class="card pf-sec"><div class="card-head"><h2>Личные цели на квартал</h2><span class="note">рядом с командными</span></div>
          <ul class="pf-goals">${goals.map(g => `<li class="${g.done ? 'done' : ''}"><label class="check"><input type="checkbox" data-goal="${g.id}" ${g.done ? 'checked' : ''} ${edit ? '' : 'disabled'}><span></span></label>${edit ? `<button class="icon-btn" data-goal-del="${g.id}" title="Убрать">${icon('x')}</button>` : ''}</li>`).join('')}</ul>
          ${edit ? '<input class="input sm" id="pfGoalIn" placeholder="+ цель: например, запустить свой экспертный продукт — Enter" maxlength="160">' : (goals.length ? '' : '<p class="note">Цели ещё не поставлены.</p>')}
        </section>
        <section class="card pf-sec"><div class="card-head"><h2>Обучение</h2><span class="note">${learnDone} из ${learnAll} пройдено</span></div>
          ${progress(learnAll ? learnDone / learnAll : 0, 'good')}
          <ul class="learn">${learnTeam.map(x => learnRow(x, false)).join('')}${learnMine.map(x => learnRow(x, true)).join('')}</ul>
          ${edit || Auth.isOwner() ? `<div class="row learn-add">${edit ? '<button class="btn sm" data-learn-add="mine">+ Своё: ролик, курс, книга</button>' : ''}${Auth.isOwner() ? '<button class="btn sm ghost" data-learn-add="team">+ Для всей команды</button>' : ''}</div>` : ''}
        </section>
        <section class="card pf-sec"><div class="card-head"><h2>Задачи</h2><a class="link-btn" href="#tasks" data-my-tasks>Все задачи</a></div>
          ${open.length ? `<div class="t-list mini">${open.slice(0, 6).map(taskRow).join('')}</div>` : '<p class="note">Открытых задач нет.</p>'}
        </section>
      </div>
    </div>
    ${own ? `<section class="section card pf-sec"><div class="card-head"><h2>Вход и пароль</h2></div>
      <p class="note">Почта для входа: <b>${esc((Auth.me() || {}).email || '')}</b></p>
      <div class="row pf-pw"><input class="input" type="password" id="pwOld" placeholder="Текущий пароль" autocomplete="current-password"><input class="input" type="password" id="pwNew" placeholder="Новый, от 6 символов" autocomplete="new-password"><input class="input" type="password" id="pwNew2" placeholder="Новый ещё раз" autocomplete="new-password"><button class="btn" id="pwSave">Сменить пароль</button><button class="btn ghost" data-logout-me>${icon('logout')}Выйти</button></div>
    </section>` : ''}`;

  /* тексты — только через textContent */
  const put = (sel, v) => { const el = $(sel, root); if (el) el.textContent = v || ''; };
  put('[data-f="about"]', p.about);
  put('[data-f="mission"]', p.mission);
  put('[data-f="duties"]', p.duties);
  put('[data-f="kpi"]', p.kpi);
  $$('.pf-goals li', root).forEach((li, i) => { $('span', li).textContent = goals[i].t; });

  wireTaskCards(root);
  on(root, 'click', '[data-my-tasks]', () => { View.set('t.who', pid); View.set('t.late', false); });
  on(root, 'click', '[data-person-edit]', (e, el) => editPerson(el.dataset.personEdit));
  on(root, 'click', '[data-copy]', (e, el) => copyText(el.dataset.copy, $('b', el)));
  on(root, 'click', '[data-logout-me]', () => Auth.logout());
  if (!edit) return;

  const save = patch => Store.patch('people', pid, patch);
  on(root, 'click', '[data-pf-edit]', (e, el) => {
    const k = el.dataset.pfEdit;
    if (k === 'contacts') return editContacts(p);
    const cfg = {about: ['О себе', 'Пара предложений о себе', 5], mission: ['Миссия', 'Зачем вы в Еве', 2],
      duties: ['Зона ответственности', '', 3]}[k];
    if (k === 'duties') return editDuties(p);
    textModal(cfg[0], p[k] || '', cfg[1], cfg[2], v => save({[k]: v}));
  });
  /* фото: уменьшаем до 192 px и храним в карточке */
  const inp = $('#pfPhoto', root);
  if (inp) inp.onchange = async () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    try { save({photo: await shrinkImage(f, 192)}); toast('Фото обновлено'); }
    catch (err) { toast('Не получилось прочитать картинку — попробуйте JPG или PNG', {error: true}); }
  };
  on(root, 'click', '[data-photo-del]', () => save({photo: ''}));
  /* увлечения */
  const tagIn = $('#pfTagIn', root);
  if (tagIn) tagIn.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ',') return;
    e.preventDefault();
    const v = tagIn.value.trim().replace(/,$/, '');
    if (!v) return;
    const list = (p.interests || []).filter(x => x.toLowerCase() !== v.toLowerCase()).concat([v]).slice(0, 20);
    save({interests: list});
    App.render({focus: 'pfTagIn'});
  });
  on(root, 'click', '[data-tag-del]', (e, el) => save({interests: (p.interests || []).filter((x, i) => i !== Number(el.dataset.tagDel))}));
  /* цели */
  const gIn = $('#pfGoalIn', root);
  if (gIn) gIn.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const v = gIn.value.trim();
    if (!v) return;
    save({goals: {[uid()]: {t: v, done: false, at: Date.now()}}});
    App.render({focus: 'pfGoalIn'});
  });
  on(root, 'change', '[data-goal]', (e, el) => save({goals: {[el.dataset.goal]: {done: el.checked}}}));
  on(root, 'click', '[data-goal-del]', (e, el) => save({goals: {[el.dataset.goalDel]: {deleted: true}}}));
  /* обучение */
  on(root, 'change', '[data-learn]', (e, el) => save({learning: {[el.dataset.learn]: {done: el.checked, at: Date.now()}}}));
  on(root, 'change', '[data-my-learn]', (e, el) => save({myLearning: {[el.dataset.myLearn]: {done: el.checked}}}));
  on(root, 'click', '[data-my-learn-del]', (e, el) => save({myLearning: {[el.dataset.myLearnDel]: {deleted: true}}}));
  on(root, 'click', '[data-learn-del]', async (e, el) => {
    if (!(await confirmPop(el, {text: 'Убрать материал из обучения у всей команды?', yes: 'Да, убрать', danger: true}))) return;
    const items = Object.fromEntries(Learning.items().map(x => [x.id, {title: x.title, url: x.url, kind: x.kind, order: x.order}]));
    items[el.dataset.learnDel].deleted = true;
    Learning.save(items);
  });
  on(root, 'click', '[data-learn-add]', (e, el) => learnModal(el.dataset.learnAdd, pid));
  /* пароль */
  const pw = $('#pwSave', root);
  if (pw) pw.onclick = async () => {
    const acc0 = Auth.me();
    const o = $('#pwOld', root).value, n1 = $('#pwNew', root).value, n2 = $('#pwNew2', root).value;
    if ((await hashPassword(o, acc0.salt)) !== acc0.hash) { toast('Текущий пароль не подошёл', {error: true}); return; }
    if (n1.length < 6) { toast('Новый пароль — не короче 6 символов', {error: true}); return; }
    if (n1 !== n2) { toast('Новые пароли не совпадают', {error: true}); return; }
    const salt = randSalt();
    await Store.patch('accounts', acc0.id, {salt, hash: await hashPassword(n1, salt)});
    ['pwOld', 'pwNew', 'pwNew2'].forEach(id => { $('#' + id, root).value = ''; });
    toast('Пароль изменён');
  };
}

/* учётка без карточки в команде (например, инвестор) */
function renderAccountOnly(root) {
  const a = Auth.me();
  root.innerHTML = `${pageHead(esc(a.name), `${ROLES[roleOf(a.role)].name} · ${esc(a.email)}`)}
    <section class="card pf-sec"><div class="card-head"><h2>Вход и пароль</h2></div>
      <div class="row pf-pw"><input class="input" type="password" id="pwOld" placeholder="Текущий пароль"><input class="input" type="password" id="pwNew" placeholder="Новый, от 6 символов"><input class="input" type="password" id="pwNew2" placeholder="Новый ещё раз"><button class="btn" id="pwSave">Сменить пароль</button><button class="btn ghost" data-logout-me>${icon('logout')}Выйти</button></div></section>`;
  on(root, 'click', '[data-logout-me]', () => Auth.logout());
  $('#pwSave', root).onclick = async () => {
    const o = $('#pwOld', root).value, n1 = $('#pwNew', root).value, n2 = $('#pwNew2', root).value;
    if ((await hashPassword(o, a.salt)) !== a.hash) { toast('Текущий пароль не подошёл', {error: true}); return; }
    if (n1.length < 6 || n1 !== n2) { toast('Проверьте новый пароль: от 6 символов и одинаковый дважды', {error: true}); return; }
    const salt = randSalt();
    await Store.patch('accounts', a.id, {salt, hash: await hashPassword(n1, salt)});
    toast('Пароль изменён');
  };
}

function textModal(title, value, placeholder, rows, onSave) {
  openModal({
    title,
    body: `<textarea class="textarea" id="txVal" rows="${rows}" placeholder="${esc(placeholder)}" maxlength="1500"></textarea>`,
    foot: '<button class="btn" data-close>Отмена</button><button class="btn primary" id="txSave">Сохранить</button>',
    onMount(el, close) {
      $('#txVal', el).value = value;
      $('#txSave', el).onclick = () => { onSave($('#txVal', el).value.trim()); close(); };
    },
  });
}
function editDuties(p) {
  openModal({
    title: 'Зона ответственности',
    body: `<label class="field"><span>Обязанности</span><textarea class="textarea" id="duVal" rows="3"></textarea></label>
      <label class="field"><span>Результат, по которому оцениваем (KPI)</span><textarea class="textarea" id="kpiVal" rows="3"></textarea></label>`,
    foot: '<button class="btn" data-close>Отмена</button><button class="btn primary" id="duSave">Сохранить</button>',
    onMount(el, close) {
      $('#duVal', el).value = p.duties || '';
      $('#kpiVal', el).value = p.kpi || '';
      $('#duSave', el).onclick = () => { Store.patch('people', p.id, {duties: $('#duVal', el).value.trim(), kpi: $('#kpiVal', el).value.trim()}); close(); };
    },
  });
}
function editContacts(p) {
  openModal({
    title: 'Контакты',
    body: `<div class="grid3"><label class="field"><span>Почта</span><input class="input" id="ctEmail"></label>
      <label class="field"><span>Телефон</span><input class="input" id="ctPhone"></label>
      <label class="field"><span>Телеграм</span><input class="input" id="ctTg" placeholder="@name"></label></div>`,
    foot: '<button class="btn" data-close>Отмена</button><button class="btn primary" id="ctSave">Сохранить</button>',
    onMount(el, close) {
      $('#ctEmail', el).value = p.email || ''; $('#ctPhone', el).value = p.phone || ''; $('#ctTg', el).value = p.telegram || '';
      $('#ctSave', el).onclick = () => { Store.patch('people', p.id, {email: $('#ctEmail', el).value.trim(), phone: $('#ctPhone', el).value.trim(), telegram: $('#ctTg', el).value.trim()}); close(); };
    },
  });
}
function learnModal(kind, pid) {
  openModal({
    title: kind === 'team' ? 'Материал для всей команды' : 'Своё обучение',
    body: `<label class="field"><span>Что пройти</span><input class="input" id="lnTitle" placeholder="Например: курс по продажам, ролик про воронку" maxlength="160"></label>
      <div class="grid2"><label class="field"><span>Ссылка</span><input class="input" id="lnUrl" placeholder="https://… или #m-standards"></label>
      <label class="field"><span>Тип</span><select class="select" id="lnKind">${Object.entries(LEARN_KINDS).map(([k, n]) => `<option value="${k}" ${k === 'video' ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>`,
    foot: '<button class="btn" data-close>Отмена</button><button class="btn primary" id="lnSave">Добавить</button>',
    onMount(el, close) {
      $('#lnSave', el).onclick = () => {
        const title = $('#lnTitle', el).value.trim();
        if (!title) return $('#lnTitle', el).focus();
        const url = $('#lnUrl', el).value.trim();
        const x = {title, url: linkHref(url) || '', kind: $('#lnKind', el).value};
        if (kind === 'team') {
          const items = Object.fromEntries(Learning.items().map(i => [i.id, {title: i.title, url: i.url, kind: i.kind, order: i.order}]));
          items[uid()] = {...x, order: Learning.items().length + 1};
          Learning.save(items);
        } else Store.patch('people', pid, {myLearning: {[uid()]: {...x, done: false, at: Date.now()}}});
        close();
      };
    },
  });
}
/* картинка → квадрат 192 px в JPEG (≈15 КБ), чтобы не раздувать базу */
function shrinkImage(file, size) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = reject;
    r.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const s = Math.min(img.width, img.height);
        c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}