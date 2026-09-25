/* Задачи команды: список, по месяцам, по неделям. Каждая задача — свой
   документ в базе, поэтому правки разных людей не затирают друг друга.
   Цикл: К работе → В работе → На проверке → Готово. Если задачу поставил
   другой человек, исполнитель сдаёт её на проверку, а принимает автор
   или руководитель. */

const Tasks = {
  all() { return Store.all('tasks'); },
  get(id) { return Store.get('tasks', id); },
  meKey() { return Auth.personId() || (Auth.me() || {}).id; },
  due(t) { return t.due || (t.month ? monthEnd(t.month) : null); },
  isOpen(t) { return t.status !== 'done'; },
  overdue(t) { const d = this.due(t); return this.isOpen(t) && !!d && d < today(); },
  mine(t) { return !!t.assignee && t.assignee === Auth.personId(); },
  manager() { return Auth.can('tasks.manage'); },
  canEdit(t) { return this.manager() || this.mine(t) || (t.createdBy && t.createdBy === this.meKey()); },
  canJudge(t) { return this.manager() || (t.createdBy && t.createdBy === this.meKey() && !this.mine(t)); },
  canDelete(t) { return this.manager() || (t.createdBy && t.createdBy === this.meKey()); },
  unseen(t) {
    const k = this.meKey();
    return this.mine(t) && this.isOpen(t) && t.updatedBy && t.updatedBy !== k && (!t.seen || !t.seen[k] || t.seen[k] < (t.updatedAt || 0));
  },
  /* нужна ли приёмка: задачу поставил другой человек, а сдаёт не руководитель */
  needsReview(t) { return !this.manager() && t.createdBy && t.createdBy !== this.meKey(); },
  sortKey(t) { return [t.status === 'done' ? 1 : 0, t.priority === 'high' ? 0 : 1, this.due(t) || '9999', t.createdAt || 0]; },
  sort(list) {
    return list.slice().sort((a, b) => {
      const x = this.sortKey(a), y = this.sortKey(b);
      for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
      return 0;
    });
  },

  create(fields) {
    const k = this.meKey(), now = Date.now();
    const assignee = fields.assignee === undefined ? Auth.personId() : fields.assignee;
    const p = personById(assignee);
    const t = {
      title: fields.title.trim(), desc: fields.desc || '', result: fields.result || '',
      status: fields.status || 'todo', assignee: assignee || null,
      dir: fields.dir || (p && p.dir) || '', priority: fields.priority || 'normal',
      due: fields.due || null, month: fields.due ? monthOf(fields.due) : (fields.month || monthOf(today())),
      goalId: fields.goalId || null, stratId: fields.stratId || null,
      createdBy: k, createdAt: now, updatedAt: now, updatedBy: k, comments: {},
    };
    return Store.add('tasks', t);
  },
  update(id, patch, log) {
    const k = this.meKey(), now = Date.now();
    const p = {...patch, updatedAt: now, updatedBy: k};
    if (log) p.comments = {[uid()]: {by: k, at: now, text: log, kind: 'system'}};
    return Store.patch('tasks', id, p);
  },
  setStatus(t, status, note) {
    const patch = {status};
    if (status === 'done') patch.doneAt = Date.now();
    if (status === 'doing' && t.status === 'todo') patch.startedAt = Date.now();
    const who = firstName(Auth.person() || {name: Auth.me().name});
    const log = note || `${who}: ${STATUSES[t.status].name} → ${STATUSES[status].name}`;
    return this.update(t.id, patch, log);
  },
  /* «сделано» из списка или карточки */
  complete(t) {
    const next = this.needsReview(t) ? 'review' : 'done';
    this.setStatus(t, next);
    toast(next === 'review' ? 'Отправлено на проверку' : 'Готово', {undo: () => this.setStatus({...t, status: next}, t.status)});
  },
  comment(t, text, kind = 'comment') {
    const k = this.meKey(), now = Date.now();
    return Store.patch('tasks', t.id, {updatedAt: now, updatedBy: k, comments: {[uid()]: {by: k, at: now, text: text.trim(), kind}}});
  },
  markSeen(t) {
    if (!this.unseen(t)) return;
    Store.patch('tasks', t.id, {seen: {[this.meKey()]: Date.now()}});
  },
  remove(t, anchor) {
    return confirmPop(anchor, {text: `Удалить задачу «${t.title.slice(0, 60)}»?`, yes: 'Да, удалить', danger: true}).then(ok => {
      if (!ok) return false;
      const copy = clone(t);
      Store.remove('tasks', t.id);
      toast('Задача удалена', {undo: () => Store.put('tasks', copy.id, copy)});
      return true;
    });
  },
};

/* счётчик в меню: мне поставили или вернули + (руководителю) ждут приёмки */
function taskBadge() {
  if (!Auth.can('tasks.view')) return 0;
  const list = Tasks.all();
  const mine = list.filter(t => Tasks.unseen(t)).length;
  const review = Tasks.manager() ? list.filter(t => t.status === 'review').length
    : list.filter(t => t.status === 'review' && t.createdBy === Tasks.meKey() && !Tasks.mine(t)).length;
  return mine + review;
}

/* ── страница ── */
const TaskUI = {
  draft: {title: '', assignee: undefined, due: ''},
  months() {
    const t = monthOf(today());
    const set = new Set(Tasks.all().map(x => x.month).filter(Boolean));
    let from = addMonths(t, -1), to = addMonths(t, 4);
    set.forEach(m => { if (m < from && Tasks.all().some(x => x.month === m && Tasks.isOpen(x))) from = m; if (m > to) to = m; });
    return monthRange(from, to);
  },
  filters() {
    return {
      who: View.get('t.who', Auth.personId() ? 'me' : 'all'),
      chip: View.get('t.chip', 'open'),
      dir: View.get('t.dir', ''),
      goal: View.get('t.goal', ''),
      q: View.get('t.q', ''),
    };
  },
  filtered(opts = {}) {
    const f = this.filters(), q = f.q.trim().toLowerCase(), me = Auth.personId();
    return Tasks.all().filter(t => {
      if (f.who === 'me' && t.assignee !== me) return false;
      if (f.who !== 'me' && f.who !== 'all' && f.who !== 'none' && t.assignee !== f.who) return false;
      if (f.who === 'none' && t.assignee) return false;
      if (f.dir && t.dir !== f.dir) return false;
      if (f.goal && t.goalId !== f.goal) return false;
      if (q && !(t.title + ' ' + (t.desc || '')).toLowerCase().includes(q)) return false;
      if (opts.ignoreChip) return true;
      if (f.chip === 'open') return Tasks.isOpen(t);
      if (f.chip === 'review') return t.status === 'review';
      if (f.chip === 'overdue') return Tasks.overdue(t);
      if (f.chip === 'done') return t.status === 'done';
      return true;
    });
  },
};

App.register('tasks', {
  title: 'Задачи',
  render(root) {
    const view = View.get('t.view', 'list');
    const f = TaskUI.filters();
    const base = TaskUI.filtered({ignoreChip: true});
    const cnt = {
      open: base.filter(t => Tasks.isOpen(t)).length,
      review: base.filter(t => t.status === 'review').length,
      overdue: base.filter(t => Tasks.overdue(t)).length,
      done: base.filter(t => t.status === 'done').length,
    };
    const ppl = people();
    const goals = Strategy.goals();
    const whoOpts = [['me', 'Мои'], ['all', 'Все люди'], ...ppl.map(p => [p.id, personName(p)]), ['none', 'Без исполнителя']]
      .filter(([v]) => v !== 'me' || Auth.personId())
      .map(([v, n]) => `<option value="${v}" ${f.who === v ? 'selected' : ''}>${esc(n)}</option>`).join('');
    const dirOpts = `<option value="">Все направления</option>` + Object.entries(DIRS).map(([k, d]) => `<option value="${k}" ${f.dir === k ? 'selected' : ''}>${d.name}</option>`).join('');
    const goalOpts = `<option value="">Все цели</option>` + goals.map(g => `<option value="${g.id}" ${f.goal === g.id ? 'selected' : ''}>${esc(g.short || g.title)}</option>`).join('');
    const chip = (k, name) => `<button class="chip ${f.chip === k ? 'on' : ''}" data-chip="${k}">${name}${cnt[k] !== undefined ? ` <b>${cnt[k]}</b>` : ''}</button>`;
    const assOpts = [['', 'Себе'], ...ppl.filter(p => p.id !== Auth.personId()).map(p => [p.id, personName(p)])]
      .map(([v, n]) => `<option value="${v}" ${(TaskUI.draft.assignee || '') === v ? 'selected' : ''}>${esc(n)}</option>`).join('');

    root.innerHTML = `
      ${pageHead('Задачи', 'Кто что делает и к какому дню. Поставьте задачу коллеге — она сразу появится у него с отметкой «новое».',
        `${helpBtn('tasks')}<button class="btn primary" data-new>${icon('plus')}Задача</button>`)}
      ${helpBox('tasks', `<b>Как работаем с задачами.</b><ol>
        <li>Добавьте задачу строкой сверху: что сделать, кому и к какому дню. Enter — сохранить.</li>
        <li>Взяли в работу — нажмите «В работу» в карточке. Сделали — поставьте галочку: если задачу ставил другой человек, она уйдёт ему на проверку.</li>
        <li>Автор или руководитель принимает работу или возвращает с комментарием — всё видно в истории карточки.</li>
        <li>«По неделям» — для планёрки в понедельник: перетащите задачу в нужную неделю, срок поставится сам.</li></ol>`)}
      <form class="qa card flat" id="qaForm" autocomplete="off">
        <input class="input qa-title" id="qaTitle" placeholder="Новая задача — что нужно сделать?" value="${esc(TaskUI.draft.title)}" maxlength="200">
        <select class="select qa-who" id="qaWho" aria-label="Кому">${assOpts}</select>
        <input class="input qa-due" id="qaDue" type="date" value="${esc(TaskUI.draft.due)}" aria-label="Срок" min="2026-01-01" max="2028-12-31">
        <button class="btn dark" type="submit">Добавить</button>
      </form>
      <div class="t-toolbar">
        <div class="seg" role="tablist">
          <button data-view="list" class="${view === 'list' ? 'on' : ''}">Список</button>
          <button data-view="month" class="${view === 'month' ? 'on' : ''}">По месяцам</button>
          <button data-view="week" class="${view === 'week' ? 'on' : ''}">По неделям</button>
        </div>
        <div class="chips">${chip('open', 'Открытые')}${chip('review', 'На проверке')}${chip('overdue', 'Просрочено')}${chip('done', 'Готово')}${chip('all', 'Все')}</div>
        <div class="t-selects">
          <select class="select sm" id="fWho" aria-label="Чьи задачи">${whoOpts}</select>
          <select class="select sm" id="fDir" aria-label="Направление">${dirOpts}</select>
          ${goals.length ? `<select class="select sm" id="fGoal" aria-label="Цель квартала">${goalOpts}</select>` : ''}
          <input class="input sm" id="fQ" type="search" placeholder="Поиск" value="${esc(f.q)}">
        </div>
      </div>
      <div id="taskView"></div>`;

    const list = TaskUI.filtered();
    const box = $('#taskView', root);
    if (view === 'month') renderTaskMonths(box, list);
    else if (view === 'week') renderTaskWeeks(box, list);
    else renderTaskList(box, list);

    wireHelp(root);
    on(root, 'click', '[data-view]', (e, el) => { View.set('t.view', el.dataset.view); App.render(); });
    on(root, 'click', '[data-chip]', (e, el) => { View.set('t.chip', el.dataset.chip); App.render(); });
    on(root, 'click', '[data-new]', () => openTask(null));
    $('#fWho', root).onchange = e => { View.set('t.who', e.target.value); App.render(); };
    $('#fDir', root).onchange = e => { View.set('t.dir', e.target.value); App.render(); };
    if ($('#fGoal', root)) $('#fGoal', root).onchange = e => { View.set('t.goal', e.target.value); App.render(); };
    let qt;
    $('#fQ', root).oninput = e => { clearTimeout(qt); const v = e.target.value; qt = setTimeout(() => { View.set('t.q', v); App.render({focus: 'fQ'}); const el = $('#fQ'); if (el) el.setSelectionRange(v.length, v.length); }, 250); };

    const qa = $('#qaForm', root);
    $('#qaTitle', root).oninput = e => { TaskUI.draft.title = e.target.value; };
    $('#qaWho', root).onchange = e => { TaskUI.draft.assignee = e.target.value; };
    $('#qaDue', root).onchange = e => { TaskUI.draft.due = e.target.value; };
    qa.onsubmit = e => {
      e.preventDefault();
      const title = $('#qaTitle', root).value.trim();
      if (!title) { $('#qaTitle', root).focus(); return; }
      const who = $('#qaWho', root).value || Auth.personId();
      const due = $('#qaDue', root).value || null;
      const month = due ? monthOf(due) : (view === 'week' ? View.get('t.weekMonth', monthOf(today())) : monthOf(today()));
      Tasks.create({title, assignee: who, due, month});
      TaskUI.draft.title = '';
      const p = personById(who);
      toast(who && who !== Auth.personId() ? `Задача поставлена: ${firstName(p)}` : 'Задача добавлена');
      App.render({focus: 'qaTitle'});
    };
    wireTaskCards(root);
  },
});

/* ── строка и карточка задачи ── */
function dueChip(t) {
  const d = Tasks.due(t);
  if (!d) return '<span class="due none">без срока</span>';
  const label = t.due ? dayShort(t.due) : monthShort(t.month);
  if (t.status === 'done') return `<span class="due">${label}</span>`;
  if (d < today()) return `<span class="due late" title="Срок прошёл">${label}</span>`;
  if (t.due && daysBetween(today(), t.due) <= 2) return `<span class="due soon">${t.due === today() ? 'сегодня' : label}</span>`;
  return `<span class="due">${label}</span>`;
}
function taskMeta(t) {
  const g = t.goalId ? Strategy.goal(t.goalId) : null;
  const n = Object.values(t.comments || {}).filter(c => c.kind !== 'system').length;
  return [
    g ? `<span class="t-goal">${esc(g.short || g.title)}</span>` : '',
    t.dir && DIRS[t.dir] ? `<span class="t-dir"><i class="dot" style="background:${DIRS[t.dir].color}"></i>${DIRS[t.dir].name}</span>` : '',
    n ? `<span class="t-cm">${icon('msg')}${n}</span>` : '',
    Tasks.unseen(t) ? '<span class="pill rose">новое</span>' : '',
  ].join('');
}
function taskRow(t) {
  const p = personById(t.assignee);
  const can = Tasks.canEdit(t);
  return `<div class="t-row ${t.status === 'done' ? 'done' : ''} ${Tasks.unseen(t) ? 'fresh' : ''}" data-task="${t.id}" draggable="${can}">
    <button class="t-check ${t.status}" data-done="${t.id}" ${can ? '' : 'disabled'} aria-label="${t.status === 'done' ? 'Вернуть в работу' : 'Отметить сделанной'}" title="${t.status === 'done' ? 'Вернуть в работу' : t.status === 'review' ? 'На проверке' : 'Сделано'}">${icon('tick')}</button>
    <div class="t-main">
      <div class="t-title">${t.priority === 'high' ? '<i class="prio" title="Важно"></i>' : ''}${esc(t.title)}</div>
      <div class="t-meta">${taskMeta(t)}</div>
    </div>
    <div class="t-who">${avatar(p)}<span class="t-who-n">${esc(p ? firstName(p) : 'Никто')}</span></div>
    ${dueChip(t)}
    <span class="pill ${STATUSES[t.status].tone} t-st">${STATUSES[t.status].name}</span>
  </div>`;
}
function taskCard(t) {
  const p = personById(t.assignee);
  return `<div class="t-card ${t.status} ${Tasks.unseen(t) ? 'fresh' : ''}" data-task="${t.id}" draggable="${Tasks.canEdit(t)}">
    <div class="t-title">${t.priority === 'high' ? '<i class="prio" title="Важно"></i>' : ''}${esc(t.title)}</div>
    <div class="t-card-foot">${avatar(p)}${dueChip(t)}<span class="pill ${STATUSES[t.status].tone}">${STATUSES[t.status].name}</span></div>
  </div>`;
}

function renderTaskList(box, list) {
  if (!list.length) { box.innerHTML = taskEmpty(); return; }
  const groups = ['review', 'doing', 'todo', 'done'];
  const openDone = View.get('t.showDone', false) || TaskUI.filters().chip === 'done';
  box.innerHTML = groups.map(st => {
    let items = Tasks.sort(list.filter(t => t.status === st));
    if (!items.length) return '';
    const total = items.length;
    if (st === 'done') {
      items = items.sort((a, b) => (b.doneAt || b.updatedAt || 0) - (a.doneAt || a.updatedAt || 0));
      if (!openDone) return `<section class="t-group"><button class="t-group-head as-btn" data-show-done>${STATUSES.done.name} <span>${total}</span> — показать</button></section>`;
      items = items.slice(0, 60);
    }
    return `<section class="t-group"><div class="t-group-head">${STATUSES[st].name} <span>${total}</span>${st === 'review' ? '<em>ждут приёмки автора или руководителя</em>' : ''}</div>
      <div class="t-list grouped">${items.map(taskRow).join('')}</div></section>`;
  }).join('');
  on(box, 'click', '[data-show-done]', () => { View.set('t.showDone', true); App.render(); });
}
function taskEmpty() {
  const f = TaskUI.filters();
  return `<div class="empty"><b>${f.chip === 'overdue' ? 'Просроченных задач нет' : f.chip === 'review' ? 'На проверке ничего нет' : 'Задач по этому фильтру нет'}</b>
    ${f.who === 'me' ? 'Показаны только ваши задачи — выберите «Все люди», чтобы увидеть задачи команды.' : 'Поменяйте фильтр или добавьте задачу строкой выше.'}</div>`;
}

function renderTaskMonths(box, list) {
  const months = TaskUI.months();
  const cols = [...months.map(m => ({key: m, name: monthName(m), items: list.filter(t => t.month === m)})),
    {key: 'none', name: 'Без срока', items: list.filter(t => !t.month)}];
  const base = TaskUI.filtered({ignoreChip: true});
  box.innerHTML = `<div class="board">${cols.map(c => {
    const all = base.filter(t => (c.key === 'none' ? !t.month : t.month === c.key));
    const done = all.filter(t => t.status === 'done').length;
    const now = c.key === monthOf(today());
    return `<div class="col ${now ? 'now' : ''}" data-drop-month="${c.key}">
      <div class="col-head"><b>${c.name}</b>${now ? '<span class="pill rose">сейчас</span>' : ''}<span class="col-n">${done}/${all.length}</span></div>
      ${all.length ? progress(done / all.length, 'good') : ''}
      <div class="col-body">${Tasks.sort(c.items).map(taskCard).join('') || '<div class="col-empty">Перетащите сюда задачу</div>'}</div>
    </div>`;
  }).join('')}</div>`;
  wireDrop(box, '[data-drop-month]', (t, el) => {
    const m = el.dataset.dropMonth === 'none' ? null : el.dataset.dropMonth;
    if (t.month === m) return;
    const patch = {month: m};
    if (!m || (t.due && monthOf(t.due) !== m)) patch.due = null;
    Tasks.update(t.id, patch, `Перенесено на ${m ? monthName(m).toLowerCase() : '«без срока»'}`);
  });
}

function renderTaskWeeks(box, list) {
  const months = TaskUI.months();
  let m = View.get('t.weekMonth', monthOf(today()));
  if (!months.includes(m)) m = monthOf(today());
  const weeks = [];
  for (let w = weekStart(monthStart(m)); w <= monthEnd(m); w = addDays(w, 7)) weeks.push(w);
  const inMonth = list.filter(t => (t.due ? monthOf(t.due) === m : t.month === m));
  const thisWeek = weekStart(today());
  box.innerHTML = `<div class="tabs week-tabs">${months.map(x => `<button data-wm="${x}" class="${x === m ? 'on' : ''}">${monthName(x)}<span class="n">${list.filter(t => (t.due ? monthOf(t.due) === x : t.month === x)).length}</span></button>`).join('')}</div>
    <div class="board weeks">
    <div class="col undated" data-drop-week="none">
      <div class="col-head"><b>Без даты</b><span class="col-n">${inMonth.filter(t => !t.due).length}</span></div>
      <div class="col-body">${Tasks.sort(inMonth.filter(t => !t.due)).map(taskCard).join('') || '<div class="col-empty">Всё распределено по неделям</div>'}</div>
    </div>${weeks.map(w => {
      const end = addDays(w, 6);
      const items = inMonth.filter(t => t.due && t.due >= w && t.due <= end);
      return `<div class="col ${w === thisWeek ? 'now' : ''}" data-drop-week="${w}">
        <div class="col-head"><b>${weekLabel(w)}</b>${w === thisWeek ? '<span class="pill rose">эта неделя</span>' : ''}<span class="col-n">${items.length}</span></div>
        <div class="col-body">${Tasks.sort(items).map(taskCard).join('') || '<div class="col-empty">Свободно</div>'}</div>
      </div>`;
    }).join('')}</div>
    <p class="note">Слева — задачи месяца без даты. Перетащите задачу в неделю — срок встанет на пятницу этой недели (или на тот же день недели, если срок уже был).</p>`;
  on(box, 'click', '[data-wm]', (e, el) => { View.set('t.weekMonth', el.dataset.wm); App.render(); });
  wireDrop(box, '[data-drop-week]', (t, el) => {
    const w = el.dataset.dropWeek;
    if (w === 'none') { if (t.due) Tasks.update(t.id, {due: null, month: m}, 'Срок снят'); return; }
    const wd = t.due ? weekday(t.due) : 4;
    let d = addDays(w, wd);
    if (d < monthStart(m)) d = monthStart(m);
    if (d > monthEnd(m)) d = monthEnd(m);
    if (d === t.due) return;
    Tasks.update(t.id, {due: d, month: monthOf(d)}, `Срок: ${dayLong(d)}`);
  });
}

/* перетаскивание карточек между колонками */
function wireDrop(box, colSel, onDrop) {
  let dragId = null;
  box.addEventListener('dragstart', e => {
    const card = e.target.closest('[data-task]');
    if (!card) return;
    dragId = card.dataset.task;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', dragId); } catch (err) { /* старые браузеры */ }
  });
  box.addEventListener('dragend', e => { const c = e.target.closest('[data-task]'); if (c) c.classList.remove('dragging'); $$('.drop-on', box).forEach(x => x.classList.remove('drop-on')); });
  box.addEventListener('dragover', e => {
    const col = e.target.closest(colSel);
    if (!col || !dragId) return;
    e.preventDefault();
    $$('.drop-on', box).forEach(x => x !== col && x.classList.remove('drop-on'));
    col.classList.add('drop-on');
  });
  box.addEventListener('drop', e => {
    const col = e.target.closest(colSel);
    if (!col || !dragId) return;
    e.preventDefault();
    col.classList.remove('drop-on');
    const t = Tasks.get(dragId);
    dragId = null;
    if (t && Tasks.canEdit(t)) onDrop(t, col);
  });
}
function wireTaskCards(root) {
  on(root, 'click', '[data-done]', (e, el) => {
    e.stopPropagation();
    const t = Tasks.get(el.dataset.done);
    if (!t) return;
    if (t.status === 'done') Tasks.setStatus(t, 'doing');
    else if (t.status === 'review') { if (Tasks.canJudge(t)) Tasks.setStatus(t, 'done', `${firstName(Auth.person() || {})}: принято`); else toast('Задача ждёт приёмки автора или руководителя'); }
    else Tasks.complete(t);
  });
  on(root, 'click', '[data-task]', (e, el) => {
    if (e.target.closest('[data-done], button, a, input, select')) return;
    openTask(el.dataset.task);
  });
}

/* ── карточка задачи в окне ── */
function openTask(id, defaults = {}) {
  const isNew = !id;
  let unsub = null;
  let t = isNew ? null : Tasks.get(id);
  if (!isNew && !t) { toast('Задача уже удалена'); return; }
  if (t) Tasks.markSeen(t);
  const can = isNew || Tasks.canEdit(t);
  const ppl = people();
  const months = monthRange('2026-08', '2027-12');
  const goals = Strategy.goals();
  const items = Strategy.items();
  const v = t || {title: '', desc: '', result: '', status: 'todo', assignee: Auth.personId(), dir: (Auth.person() || {}).dir || '',
    priority: 'normal', due: '', month: monthOf(today()), goalId: '', stratId: '', ...defaults};
  const sel = (id, opts, cur, dis) => `<select class="select" id="${id}" ${dis ? 'disabled' : ''}>${opts.map(([val, n]) => `<option value="${esc(val)}" ${String(cur || '') === String(val) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;

  const body = `
    <input class="input t-m-title" id="tmTitle" value="${esc(v.title)}" placeholder="Что нужно сделать" ${can ? '' : 'disabled'} maxlength="200">
    ${isNew ? '' : `<div class="t-m-status" id="tmStatus"></div>`}
    <div class="grid2">
      <label class="field"><span>Кто делает</span>${sel('tmWho', [['', 'Не назначено'], ...ppl.map(p => [p.id, personName(p) + (p.title && p.name ? ' · ' + p.title : '')])], v.assignee, !can)}</label>
      <label class="field"><span>Срок</span><input class="input" id="tmDue" type="date" value="${esc(v.due || '')}" ${can ? '' : 'disabled'} min="2026-01-01" max="2028-12-31"></label>
      <label class="field"><span>Месяц</span>${sel('tmMonth', [['', 'Без срока'], ...months.map(m => [m, monthName(m, true)])], v.month, !can)}</label>
      <label class="field"><span>Направление</span>${sel('tmDir', [['', 'Без направления'], ...Object.entries(DIRS).map(([k, d]) => [k, d.name])], v.dir, !can)}</label>
      <label class="field"><span>Важность</span>${sel('tmPrio', [['normal', 'Обычная'], ['high', 'Важно']], v.priority, !can)}</label>
      <label class="field"><span>Цель квартала</span>${sel('tmGoal', [['', 'Не связана'], ...goals.map(g => [g.id, g.short || g.title])], v.goalId, !can)}</label>
    </div>
    ${items.length ? `<label class="field"><span>Этап дорожной карты</span>${sel('tmStrat', [['', 'Не связана'], ...items.map(i => [i.id, `${dirName(i.dir)} · ${i.title}`])], v.stratId, !can)}</label>` : ''}
    <label class="field"><span>Что сделать подробнее</span><textarea class="textarea" id="tmDesc" rows="3" ${can ? '' : 'disabled'} placeholder="Контекст, ссылки, договорённости">${esc(v.desc || '')}</textarea></label>
    <label class="field"><span>Результат — как поймём, что готово</span><input class="input" id="tmResult" value="${esc(v.result || '')}" ${can ? '' : 'disabled'} placeholder="Например: договор подписан и лежит в папке"></label>
    ${isNew ? '' : `<div class="t-m-comments"><div class="label">Обсуждение и история</div><div id="tmThread" class="thread"></div>
      <form id="tmCForm" class="t-m-cform"><textarea class="textarea" id="tmComment" rows="2" placeholder="Написать комментарий: вопрос, ссылка, что сделано"></textarea><button class="btn sm dark" type="submit">Отправить</button></form></div>`}`;
  const foot = isNew
    ? `<button class="btn" data-close>Отмена</button><button class="btn primary" id="tmCreate">Создать задачу</button>`
    : `${Tasks.canDelete(t) ? `<button class="btn danger left" id="tmDel">${icon('trash')}Удалить</button>` : '<span class="left note" id="tmWhoMade"></span>'}<span class="note" id="tmSaved"></span><button class="btn" data-close>Закрыть</button>`;

  openModal({
    title: isNew ? 'Новая задача' : 'Задача',
    body, foot, wide: true, focus: isNew,
    onMount(el, close) {
      const val = sel => $(sel, el).value;
      if (isNew) {
        $('#tmCreate', el).onclick = () => {
          const title = val('#tmTitle').trim();
          if (!title) { $('#tmTitle', el).focus(); return; }
          const due = val('#tmDue') || null;
          Tasks.create({title, assignee: val('#tmWho') || null, due, month: val('#tmMonth') || null, dir: val('#tmDir'),
            priority: val('#tmPrio'), goalId: val('#tmGoal') || null, stratId: $('#tmStrat', el) ? val('#tmStrat') || null : null,
            desc: val('#tmDesc'), result: val('#tmResult')});
          close();
          toast('Задача создана');
        };
        return;
      }
      /* автосохранение по полю */
      const saved = () => { const s = $('#tmSaved', el); if (s) { s.textContent = 'Сохранено'; clearTimeout(s._t); s._t = setTimeout(() => { s.textContent = ''; }, 1600); } };
      const field = (sel, key, map = x => x, log) => {
        const input = $(sel, el);
        if (!input) return;
        input.addEventListener('change', () => {
          const cur = Tasks.get(id);
          if (!cur) return;
          let value = map(input.value);
          if (key === 'title' && !value) { input.value = cur.title; return; }
          const patch = {[key]: value};
          if (key === 'due') { patch.month = value ? monthOf(value) : cur.month; const mm = $('#tmMonth', el); if (mm && value) mm.value = monthOf(value); }
          if (key === 'month' && cur.due && monthOf(cur.due) !== value) { patch.due = null; $('#tmDue', el).value = ''; }
          if (key === 'assignee' && value && !cur.dir) { const p = personById(value); if (p && p.dir) patch.dir = p.dir; }
          Tasks.update(id, patch, log ? log(value) : null);
          saved();
        });
      };
      field('#tmTitle', 'title', s => s.trim());
      field('#tmWho', 'assignee', s => s || null, s => `Исполнитель: ${s ? personName(personById(s)) : 'не назначен'}`);
      field('#tmDue', 'due', s => s || null, s => (s ? `Срок: ${dayLong(s)}` : 'Срок снят'));
      field('#tmMonth', 'month', s => s || null);
      field('#tmDir', 'dir');
      field('#tmPrio', 'priority');
      field('#tmGoal', 'goalId', s => s || null);
      field('#tmStrat', 'stratId', s => s || null);
      field('#tmDesc', 'desc');
      field('#tmResult', 'result');

      const paint = () => {
        const cur = Tasks.get(id);
        if (!cur) { close(); return; }
        paintTaskStatus($('#tmStatus', el), cur);
        const typing = document.activeElement && document.activeElement.id === 'tmComment';
        paintThread($('#tmThread', el), cur, typing);
        const wm = $('#tmWhoMade', el);
        if (wm) { const c = personById(cur.createdBy); wm.textContent = c ? `Поставил(а): ${personName(c)}` : ''; }
      };
      paint();
      unsub = Store.subscribe(c => { if (c === 'tasks') paint(); });

      on(el, 'click', '[data-st]', (e, b) => {
        const cur = Tasks.get(id);
        const st = b.dataset.st;
        if (st === 'return') {
          const box = $('#tmComment', el);
          if (!box.value.trim()) { box.focus(); box.placeholder = 'Напишите, что доработать — без комментария вернуть нельзя'; box.classList.add('need'); return; }
          Tasks.comment(cur, box.value, 'return');
          box.value = '';
          Tasks.setStatus(cur, 'doing', `${firstName(Auth.person() || {})}: вернул(а) на доработку`);
          return;
        }
        if (st === 'accept') { Tasks.setStatus(cur, 'done', `${firstName(Auth.person() || {})}: принято`); return; }
        if (st === 'complete') { Tasks.complete(cur); return; }
        Tasks.setStatus(cur, st);
      });
      const cf = $('#tmCForm', el);
      cf.onsubmit = e => {
        e.preventDefault();
        const box = $('#tmComment', el);
        if (!box.value.trim()) return;
        Tasks.comment(Tasks.get(id), box.value);
        box.value = '';
        box.classList.remove('need');
        paint();
      };
      $('#tmComment', el).addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) cf.requestSubmit(); });
      const del = $('#tmDel', el);
      if (del) del.onclick = () => Tasks.remove(Tasks.get(id), del).then(ok => { if (ok) close(); });
    },
    onClose() { if (unsub) unsub(); },
  });
}
function paintTaskStatus(box, t) {
  if (!box) return;
  const can = Tasks.canEdit(t), judge = Tasks.canJudge(t);
  const steps = Object.entries(STATUSES).map(([k, s]) => `<span class="st-step ${k === t.status ? 'on ' + s.tone : ''}">${s.name}</span>`).join('<i></i>');
  let actions = '';
  if (t.status === 'todo' && can) actions = `<button class="btn sm" data-st="doing">В работу</button><button class="btn sm primary" data-st="complete">${Tasks.needsReview(t) ? 'Сдать на проверку' : 'Сделано'}</button>`;
  if (t.status === 'doing' && can) actions = `<button class="btn sm primary" data-st="complete">${Tasks.needsReview(t) ? 'Сдать на проверку' : 'Сделано'}</button>`;
  if (t.status === 'review') actions = judge ? `<button class="btn sm good" data-st="accept">${icon('tick')}Принять</button><button class="btn sm danger" data-st="return">Вернуть на доработку</button>` : '<span class="note">Ждёт приёмки автора или руководителя</span>';
  if (t.status === 'done' && can) actions = `<button class="btn sm" data-st="doing">Вернуть в работу</button>`;
  box.innerHTML = `<div class="st-steps">${steps}</div><div class="st-actions">${actions}</div>`;
}
function paintThread(box, t, keepScroll) {
  if (!box) return;
  const list = Object.entries(t.comments || {}).map(([cid, c]) => ({cid, ...c})).sort((a, b) => a.at - b.at);
  if (!list.length) { box.innerHTML = '<p class="note">Пока пусто. Вопросы и договорённости по задаче пишите здесь — их увидит вся команда.</p>'; return; }
  box.innerHTML = list.map(c => {
    const p = personById(c.by);
    if (c.kind === 'system') return `<div class="th-sys"><span>${esc(c.text)}</span><time>${timeAgo(c.at)}</time></div>`;
    return `<div class="th-msg ${c.kind === 'return' ? 'ret' : ''}">${avatar(p)}<div><div class="th-h"><b>${esc(p ? personName(p) : 'Кто-то из команды')}</b><time>${timeAgo(c.at)}</time>${c.kind === 'return' ? '<span class="pill bad">вернул(а) на доработку</span>' : ''}</div><p></p></div></div>`;
  }).join('');
  /* текст комментариев — только через textContent */
  const msgs = list.filter(c => c.kind !== 'system');
  $$('.th-msg p', box).forEach((pEl, i) => { pEl.textContent = msgs[i].text; });
  if (!keepScroll) box.scrollTop = box.scrollHeight;
}