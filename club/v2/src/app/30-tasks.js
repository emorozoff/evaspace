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
      due: fields.due || null, month: fields.due ? monthOf(fields.due) : (fields.month !== undefined ? fields.month : monthOf(today())),
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
const DIR_CODE = {product: 'ПР', content: 'КН', audience: 'АУ', ops: 'УП'};
const TaskUI = {
  composer: null,        // открытая строка добавления в колонке: {col, title, assignee, due}
  showDone: false,
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
      late: View.get('t.late', false),
      done: View.get('t.done', false),
      dir: View.get('t.dir', ''),
      goal: View.get('t.goal', ''),
      q: View.get('t.q', ''),
    };
  },
  /* люди, направление, цель, поиск — общие для всех видов */
  filtered(opts = {}) {
    const f = this.filters(), q = f.q.trim().toLowerCase(), me = Auth.personId();
    return Tasks.all().filter(t => {
      if (f.who === 'me' && t.assignee !== me) return false;
      if (f.who === 'none' && t.assignee) return false;
      if (!['me', 'all', 'none'].includes(f.who) && t.assignee !== f.who) return false;
      if (f.dir && t.dir !== f.dir) return false;
      if (f.goal && t.goalId !== f.goal) return false;
      if (f.late && !opts.ignoreLate && !Tasks.overdue(t)) return false;
      if (q && !(t.title + ' ' + (t.desc || '')).toLowerCase().includes(q)) return false;
      return true;
    });
  },
};
/* порядок внутри колонки: ручной (перетаскиванием), иначе — по времени создания */
const effOrder = t => (typeof t.order === 'number' ? t.order : (t.createdAt || 0));
const byOrder = list => list.slice().sort((a, b) => effOrder(a) - effOrder(b));
function orderBetween(afterId, beforeId) {
  const a = afterId ? Tasks.get(afterId) : null, b = beforeId ? Tasks.get(beforeId) : null;
  if (a && b) return (effOrder(a) + effOrder(b)) / 2;
  if (a) return effOrder(a) + 1000;
  if (b) return effOrder(b) - 1000;
  return Date.now();
}

App.register('tasks', {
  title: 'Задачи',
  render(root) {
    const view = View.get('t.view', 'board');
    const f = TaskUI.filters();
    const ppl = people();
    const goals = Strategy.goals();
    const list = TaskUI.filtered();
    const lateN = TaskUI.filtered({ignoreLate: true}).filter(t => Tasks.overdue(t)).length;
    const reviewN = list.filter(t => t.status === 'review').length;
    const opt = (v, n, cur) => `<option value="${esc(v)}" ${cur === v ? 'selected' : ''}>${esc(n)}</option>`;
    const whoOpts = [['me', 'Мои задачи'], ['all', 'Вся команда'], ...ppl.map(p => [p.id, personName(p)]), ['none', 'Без исполнителя']]
      .filter(([v]) => v !== 'me' || Auth.personId()).map(([v, n]) => opt(v, n, f.who)).join('');
    const views = [['board', 'Доска'], ['month', 'По месяцам'], ['week', 'По неделям'], ['list', 'Список']];

    root.innerHTML = `
      ${pageHead('Задачи', 'Кто что делает и к какому дню. Карточки перетаскиваются зажатием — между колонками и внутри колонки.',
        `${helpBtn('tasks')}<button class="btn primary" data-quick>${icon('plus')}Задача</button>`)}
      ${helpBox('tasks', `<b>Как работаем с задачами.</b> «+ Добавить задачу» внизу колонки — название и Enter, можно сразу следующую. Зажмите карточку и перетащите: в «В работе», «На проверке», в другой месяц или неделю. Если задачу ставил другой человек, из «Готово» она попадёт к нему на проверку — он примет или вернёт с комментарием. Клик по карточке — все поля, обсуждение и история; по аватару — сменить исполнителя.`)}
      <div class="t-bar">
        <div class="seg" role="tablist">${views.map(([k, n]) => `<button data-view="${k}" class="${view === k ? 'on' : ''}">${n}</button>`).join('')}</div>
        <select class="select sm" id="fWho" aria-label="Чьи задачи">${whoOpts}</select>
        <select class="select sm" id="fDir" aria-label="Направление">${opt('', 'Все направления', f.dir)}${Object.entries(DIRS).map(([k, d]) => opt(k, d.name, f.dir)).join('')}</select>
        ${goals.length ? `<select class="select sm" id="fGoal" aria-label="Цель квартала">${opt('', 'Все цели', f.goal)}${goals.map(g => opt(g.id, g.short || g.title, f.goal)).join('')}</select>` : ''}
        <input class="input sm t-search" id="fQ" type="search" placeholder="Поиск" value="${esc(f.q)}">
        <span class="t-bar-sp"></span>
        <button class="chip ${f.late ? 'on' : ''}" data-late>Просрочено <b>${lateN}</b></button>
        ${reviewN ? `<span class="pill gold">${reviewN} на проверке</span>` : ''}
        ${view !== 'board' ? `<label class="check t-done-t"><input type="checkbox" id="fDone" ${f.done ? 'checked' : ''}>Показывать готовые</label>` : ''}
      </div>
      <div id="taskView"></div>`;

    const box = $('#taskView', root);
    if (view === 'month') renderTaskMonths(box, list);
    else if (view === 'week') renderTaskWeeks(box, list);
    else if (view === 'list') renderTaskList(box, list);
    else renderTaskBoard(box, list);

    wireHelp(root);
    on(root, 'click', '[data-view]', (e, el) => { View.set('t.view', el.dataset.view); TaskUI.composer = null; App.render(); });
    on(root, 'click', '[data-late]', () => { View.set('t.late', !f.late); App.render(); });
    on(root, 'click', '[data-quick]', () => quickTask({}));
    $('#fWho', root).onchange = e => { View.set('t.who', e.target.value); App.render(); };
    $('#fDir', root).onchange = e => { View.set('t.dir', e.target.value); App.render(); };
    if ($('#fGoal', root)) $('#fGoal', root).onchange = e => { View.set('t.goal', e.target.value); App.render(); };
    if ($('#fDone', root)) $('#fDone', root).onchange = e => { View.set('t.done', e.target.checked); App.render(); };
    let qt;
    $('#fQ', root).oninput = e => { clearTimeout(qt); const v = e.target.value; qt = setTimeout(() => { View.set('t.q', v); App.render({focus: 'fQ'}); const el = $('#fQ'); if (el) el.setSelectionRange(v.length, v.length); }, 250); };
    wireTaskCards(root);
    wireComposer(root);
  },
});

/* ── карточка на доске (по мотивам первой версии: код направления, аватар, срок) ── */
function dueChip(t) {
  const d = Tasks.due(t);
  if (!d) return '<span class="due none">без срока</span>';
  const label = t.due ? dayShort(t.due) : monthShort(t.month);
  if (t.status === 'done') return `<span class="due">${label}</span>`;
  if (d < today()) return `<span class="due late" title="Срок прошёл">${icon('cal')}${label}</span>`;
  if (t.due && daysBetween(today(), t.due) <= 2) return `<span class="due soon">${icon('cal')}${t.due === today() ? 'сегодня' : label}</span>`;
  return `<span class="due">${icon('cal')}${label}</span>`;
}
function taskMeta(t) {
  const g = t.goalId ? Strategy.goal(t.goalId) : null;
  const n = Object.values(t.comments || {}).filter(c => c.kind !== 'system').length;
  return [
    g ? `<span class="t-goal" title="Цель квартала">${esc(g.short || g.title)}</span>` : '',
    t.dir && DIRS[t.dir] ? `<span class="t-dir"><i class="dot" style="background:${DIRS[t.dir].color}"></i>${DIRS[t.dir].name}</span>` : '',
    n ? `<span class="t-cm">${icon('msg')}${n}</span>` : '',
    Tasks.unseen(t) ? '<span class="pill rose">новое</span>' : '',
  ].join('');
}
function taskCard(t, opts = {}) {
  const p = personById(t.assignee);
  const can = Tasks.canEdit(t);
  const g = t.goalId ? Strategy.goal(t.goalId) : null;
  const n = Object.values(t.comments || {}).filter(c => c.kind !== 'system').length;
  const code = DIR_CODE[t.dir];
  return `<div class="kc ${t.status} ${Tasks.unseen(t) ? 'fresh' : ''} ${can ? 'can' : ''}" data-task="${t.id}" tabindex="0">
    <div class="kc-top">
      ${code ? `<span class="kc-dir" style="--c:${DIRS[t.dir].color}" title="${DIRS[t.dir].name}">${code}</span>` : '<span class="kc-dir none">—</span>'}
      ${t.priority === 'high' ? '<span class="kc-prio" title="Важная задача">!</span>' : ''}
      ${Tasks.unseen(t) ? '<span class="pill rose">новое</span>' : ''}
      <button class="kc-av" ${can ? `data-assign="${t.id}"` : 'disabled'} title="${esc(p ? personName(p) : 'Назначить исполнителя')}">${avatar(p)}</button>
    </div>
    <div class="kc-title">${esc(t.title)}</div>
    <div class="kc-foot">${dueChip(t)}${n ? `<span class="t-cm">${icon('msg')}${n}</span>` : ''}${g ? `<span class="t-goal">${esc(g.short || g.title)}</span>` : ''}${opts.status ? `<span class="pill ${STATUSES[t.status].tone} kc-st">${STATUSES[t.status].name}</span>` : ''}</div>
  </div>`;
}
/* строка — для списка, главной и дорожной карты */
function taskRow(t) {
  const p = personById(t.assignee);
  const can = Tasks.canEdit(t);
  return `<div class="t-row ${t.status === 'done' ? 'done' : ''} ${Tasks.unseen(t) ? 'fresh' : ''}" data-task="${t.id}">
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

/* колонка доски с добавлением внизу */
function kbCol({key, title, sub = '', items, add = null, now = false, tone = '', extra = ''}) {
  const comp = TaskUI.composer && TaskUI.composer.col === key ? TaskUI.composer : null;
  return `<section class="kb-col ${now ? 'now' : ''} ${tone}" data-col="${key}">
    <header class="kb-h"><b>${title}</b>${sub}<span class="kb-n">${items.length}</span></header>
    <div class="kb-list">
      ${items.map(t => taskCard(t, {status: key.startsWith('m:') || key.startsWith('w:')})).join('')}
      ${extra}
      ${add ? (comp ? composerHtml(comp) : `<button class="kb-add" data-add="${key}">${icon('plus')}Добавить задачу</button>`) : ''}
    </div>
  </section>`;
}
function composerHtml(c) {
  const ppl = people();
  return `<form class="kb-composer" data-composer="${c.col}" autocomplete="off">
    <textarea class="textarea" id="kbTitle" rows="2" placeholder="Что нужно сделать? Enter — добавить" maxlength="200">${esc(c.title || '')}</textarea>
    <div class="kb-comp-row">
      <select class="select sm" id="kbWho" aria-label="Кому">${[['', 'Не назначено'], ...ppl.map(p => [p.id, personName(p)])].map(([v, n]) => `<option value="${v}" ${(c.assignee ?? Auth.personId() ?? '') === v ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
      <input class="input sm" id="kbDue" type="date" value="${esc(c.due || '')}" aria-label="Срок">
    </div>
    <div class="kb-comp-row"><button class="btn sm primary" type="submit">Добавить</button><button class="btn sm ghost" type="button" data-comp-close>Отмена</button><button class="btn sm ghost kb-more" type="button" data-comp-more>Подробнее…</button></div>
  </form>`;
}
/* что означает колонка для новой задачи */
function colPreset(key) {
  if (key.startsWith('s:')) return {status: key.slice(2)};
  if (key.startsWith('m:')) return key === 'm:none' ? {month: null} : {month: key.slice(2)};
  if (key.startsWith('w:')) {
    const w = key.slice(2), m = View.get('t.weekMonth', monthOf(today()));
    if (w === 'none') return {month: m};
    let d = addDays(w, 4);
    if (d < monthStart(m)) d = monthStart(m);
    if (d > monthEnd(m)) d = monthEnd(m);
    return {due: d};
  }
  return {};
}
function wireComposer(root) {
  on(root, 'click', '[data-add]', (e, el) => {
    const pre = colPreset(el.dataset.add);
    TaskUI.composer = {col: el.dataset.add, title: '', assignee: undefined, due: pre.due || ''};
    App.render({focus: 'kbTitle'});
  });
  on(root, 'click', '[data-comp-close]', () => { TaskUI.composer = null; App.render(); });
  const form = $('.kb-composer', root);
  if (!form) return;
  const c = TaskUI.composer;
  const ta = $('#kbTitle', form);
  ta.addEventListener('input', () => { c.title = ta.value; });
  $('#kbWho', form).onchange = e => { c.assignee = e.target.value; };
  $('#kbDue', form).onchange = e => { c.due = e.target.value; };
  ta.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
    if (e.key === 'Escape') { TaskUI.composer = null; App.render(); }
  });
  const make = () => {
    const title = ta.value.trim();
    if (!title) { ta.focus(); return null; }
    const pre = colPreset(c.col);
    const due = $('#kbDue', form).value || null;
    const col = $$(`[data-col="${c.col}"] [data-task]`, root).map(x => Tasks.get(x.dataset.task)).filter(Boolean);
    const id = Tasks.create({title, assignee: $('#kbWho', form).value || null, due, month: due ? monthOf(due) : (pre.month !== undefined ? pre.month : undefined), status: pre.status});
    Store.patch('tasks', id, {order: col.length ? effOrder(col[col.length - 1]) + 1000 : Date.now()});
    return id;
  };
  form.onsubmit = e => {
    e.preventDefault();
    if (!make()) return;
    c.title = '';
    App.render({focus: 'kbTitle'});
  };
  $('[data-comp-more]', form).onclick = () => {
    const id = make();
    if (!id) return;
    TaskUI.composer = null;
    App.render();
    openTask(id);
  };
  setTimeout(() => { const t = $('#kbTitle'); if (t && document.activeElement !== t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } }, 0);
}

/* ── доска по статусам ── */
function renderTaskBoard(box, list) {
  const doneAll = list.filter(t => t.status === 'done').sort((a, b) => (b.doneAt || b.updatedAt || 0) - (a.doneAt || a.updatedAt || 0));
  const doneShown = TaskUI.showDone ? doneAll : doneAll.slice(0, 8);
  const cols = [
    kbCol({key: 's:todo', title: 'К работе', items: byOrder(list.filter(t => t.status === 'todo')), add: true}),
    kbCol({key: 's:doing', title: 'В работе', items: byOrder(list.filter(t => t.status === 'doing')), add: true, tone: 'doing'}),
    kbCol({key: 's:review', title: 'На проверке', sub: '<em>принимает автор</em>', items: byOrder(list.filter(t => t.status === 'review')), tone: 'review'}),
    kbCol({key: 's:done', title: 'Готово', items: doneShown, tone: 'done',
      extra: doneAll.length > doneShown.length ? `<button class="kb-more-done" data-more-done>Показать ещё ${doneAll.length - doneShown.length}</button>` : ''}),
  ];
  box.innerHTML = `<div class="kb kb-status">${cols.join('')}</div>`;
  on(box, 'click', '[data-more-done]', () => { TaskUI.showDone = true; App.render(); });
  Drag.board(box, {canDrag: id => { const t = Tasks.get(id); return t && Tasks.canEdit(t); }, onDrop: dropOnStatus});
}
function dropOnStatus(id, key, pos) {
  const t = Tasks.get(id);
  if (!t) return;
  let st = key.slice(2);
  const order = orderBetween(pos.afterId, pos.beforeId);
  if (st === t.status) { Store.patch('tasks', id, {order}); return; }
  if (t.status === 'review' && st === 'done' && !Tasks.canJudge(t)) { toast('Принять задачу может автор или руководитель'); return; }
  if (st === 'done' && t.status !== 'review' && Tasks.needsReview(t)) { st = 'review'; toast('Задачу ставил другой человек — она ушла ему на проверку'); }
  Store.patch('tasks', id, {order});
  Tasks.setStatus(t, st, st === 'done' && t.status === 'review' ? `${firstName(Auth.person() || {})}: принято` : null);
}

/* ── по месяцам ── */
function renderTaskMonths(box, list) {
  const showDone = TaskUI.filters().done;
  const vis = list.filter(t => showDone || t.status !== 'done');
  const cur = monthOf(today());
  const cols = [...TaskUI.months().map(m => {
      const all = list.filter(t => t.month === m);
      const done = all.filter(t => t.status === 'done').length;
      return kbCol({key: 'm:' + m, title: monthName(m), now: m === cur, add: true,
        sub: `<span class="kb-prog" title="Готово ${done} из ${all.length}">${all.length ? `${done}/${all.length}` : ''}</span>`,
        items: byOrder(vis.filter(t => t.month === m))});
    }),
    kbCol({key: 'm:none', title: 'Без срока', add: true, items: byOrder(vis.filter(t => !t.month))})];
  box.innerHTML = `<div class="kb kb-wide">${cols.join('')}</div>`;
  Drag.board(box, {canDrag: id => { const t = Tasks.get(id); return t && Tasks.canEdit(t); }, onDrop: (id, key, pos) => {
    const t = Tasks.get(id);
    const m = key === 'm:none' ? null : key.slice(2);
    const patch = {order: orderBetween(pos.afterId, pos.beforeId)};
    if (t.month !== m) {
      patch.month = m;
      if (!m || (t.due && monthOf(t.due) !== m)) patch.due = null;
      Tasks.update(id, patch, `Перенесено на ${m ? monthName(m).toLowerCase() : '«без срока»'}`);
    } else Store.patch('tasks', id, patch);
  }});
}

/* ── по неделям ── */
function renderTaskWeeks(box, list) {
  const months = TaskUI.months();
  let m = View.get('t.weekMonth', monthOf(today()));
  if (!months.includes(m)) m = monthOf(today());
  const showDone = TaskUI.filters().done;
  const weeks = [];
  for (let w = weekStart(monthStart(m)); w <= monthEnd(m); w = addDays(w, 7)) weeks.push(w);
  const inMonth = list.filter(t => (t.due ? monthOf(t.due) === m : t.month === m) && (showDone || t.status !== 'done'));
  const thisWeek = weekStart(today());
  const cols = [kbCol({key: 'w:none', title: 'Без даты', sub: '<em>разложите по неделям</em>', add: true, tone: 'backlog', items: byOrder(inMonth.filter(t => !t.due))}),
    ...weeks.map(w => kbCol({key: 'w:' + w, title: weekLabel(w), now: w === thisWeek, add: true,
      items: byOrder(inMonth.filter(t => t.due && t.due >= w && t.due <= addDays(w, 6)))}))];
  box.innerHTML = `<div class="tabs week-tabs">${months.map(x => `<button data-wm="${x}" class="${x === m ? 'on' : ''}">${monthName(x)}<span class="n">${list.filter(t => (t.due ? monthOf(t.due) === x : t.month === x) && t.status !== 'done').length}</span></button>`).join('')}</div>
    <div class="kb kb-weeks">${cols.join('')}</div>`;
  on(box, 'click', '[data-wm]', (e, el) => { View.set('t.weekMonth', el.dataset.wm); TaskUI.composer = null; App.render(); });
  Drag.board(box, {canDrag: id => { const t = Tasks.get(id); return t && Tasks.canEdit(t); }, onDrop: (id, key, pos) => {
    const t = Tasks.get(id);
    const w = key.slice(2);
    const order = orderBetween(pos.afterId, pos.beforeId);
    if (w === 'none') { if (t.due) Tasks.update(id, {due: null, month: m, order}, 'Срок снят'); else Store.patch('tasks', id, {order}); return; }
    let d = addDays(w, t.due ? weekday(t.due) : 4);
    if (d < monthStart(m)) d = monthStart(m);
    if (d > monthEnd(m)) d = monthEnd(m);
    if (d === t.due) { Store.patch('tasks', id, {order}); return; }
    Tasks.update(id, {due: d, month: monthOf(d), order}, `Срок: ${dayLong(d)}`);
  }});
}

/* ── список ── */
function renderTaskList(box, list) {
  const showDone = TaskUI.filters().done;
  const groups = ['review', 'doing', 'todo', ...(showDone ? ['done'] : [])];
  const comp = TaskUI.composer && TaskUI.composer.col === 's:todo' ? TaskUI.composer : null;
  const html = groups.map(st => {
    let items = st === 'done' ? list.filter(t => t.status === 'done').sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)).slice(0, 60) : Tasks.sort(list.filter(t => t.status === st));
    if (!items.length && st !== 'todo') return '';
    return `<section class="t-group"><div class="t-group-head">${STATUSES[st].name} <span>${items.length}</span>${st === 'review' ? '<em>ждут приёмки автора или руководителя</em>' : ''}</div>
      ${st === 'todo' ? `<div class="kb-col list-add" data-col="s:todo"><div class="kb-list">${comp ? composerHtml(comp) : '<button class="kb-add" data-add="s:todo">' + icon('plus') + 'Добавить задачу</button>'}</div></div>` : ''}
      ${items.length ? `<div class="t-list grouped">${items.map(taskRow).join('')}</div>` : ''}</section>`;
  }).join('');
  box.innerHTML = html || taskEmpty();
}
function taskEmpty() {
  const f = TaskUI.filters();
  return `<div class="empty"><b>${f.late ? 'Просроченных задач нет' : 'Задач по этому фильтру нет'}</b>
    ${f.who === 'me' ? 'Показаны только ваши задачи — выберите «Вся команда», чтобы увидеть задачи всех.' : 'Поменяйте фильтр или добавьте задачу.'}</div>`;
}

/* клики по карточкам и строкам: галочка, смена исполнителя, открытие */
function wireTaskCards(root) {
  on(root, 'click', '[data-done]', (e, el) => {
    e.stopPropagation();
    const t = Tasks.get(el.dataset.done);
    if (!t) return;
    if (t.status === 'done') Tasks.setStatus(t, 'doing');
    else if (t.status === 'review') { if (Tasks.canJudge(t)) Tasks.setStatus(t, 'done', `${firstName(Auth.person() || {})}: принято`); else toast('Задача ждёт приёмки автора или руководителя'); }
    else Tasks.complete(t);
  });
  on(root, 'click', '[data-assign]', async (e, el) => {
    e.stopPropagation();
    const t = Tasks.get(el.dataset.assign);
    if (!t) return;
    const v = await pickPop(el, [['', 'Не назначено'], ...people().map(p => [p.id, personName(p) + (p.title && p.name ? ' · ' + p.title : '')])], t.assignee || '');
    if (v === null || v === (t.assignee || '')) return;
    const p = personById(v);
    Tasks.update(t.id, {assignee: v || null, ...(p && p.dir && !t.dir ? {dir: p.dir} : {})}, `Исполнитель: ${p ? personName(p) : 'не назначен'}`);
  });
  on(root, 'click', '[data-task]', (e, el) => {
    if (e.target.closest('[data-done], button, a, input, select, textarea')) return;
    openTask(el.dataset.task);
  });
  on(root, 'keydown', '[data-task]', (e, el) => { if (e.key === 'Enter' && e.target === el) openTask(el.dataset.task); });
}

/* быстрое окно, как в первой версии: название, кто, срок → Добавить или Подробнее… */
function quickTask(preset) {
  const ppl = people();
  openModal({
    title: 'Новая задача',
    body: `<input class="input t-m-title" id="qtTitle" placeholder="Название задачи" maxlength="200">
      <div class="grid3">
        <label class="field"><span>Кто делает</span><select class="select" id="qtWho">${[['', 'Не назначено'], ...ppl.map(p => [p.id, personName(p)])].map(([v, n]) => `<option value="${v}" ${(Auth.personId() || '') === v ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
        <label class="field"><span>Срок</span><input class="input" id="qtDue" type="date" value="${esc(preset.due || '')}"></label>
        <label class="field"><span>Направление</span><select class="select" id="qtDir"><option value="">Как у исполнителя</option>${Object.entries(DIRS).map(([k, d]) => `<option value="${k}">${d.name}</option>`).join('')}</select></label>
      </div>`,
    foot: `<button class="btn ghost left" id="qtMore">Подробнее…</button><button class="btn" data-close>Отмена</button><button class="btn primary" id="qtAdd">Добавить</button>`,
    onMount(el, close) {
      const make = () => {
        const title = $('#qtTitle', el).value.trim();
        if (!title) { $('#qtTitle', el).focus(); $('#qtTitle', el).classList.add('need'); return null; }
        const due = $('#qtDue', el).value || null;
        return Tasks.create({title, assignee: $('#qtWho', el).value || null, due, dir: $('#qtDir', el).value || undefined});
      };
      $('#qtAdd', el).onclick = () => { if (make()) { close(); toast('Задача добавлена'); } };
      $('#qtMore', el).onclick = () => { const id = make(); if (id) { close(); openTask(id); } };
      $('#qtTitle', el).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#qtAdd', el).click(); } });
    },
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