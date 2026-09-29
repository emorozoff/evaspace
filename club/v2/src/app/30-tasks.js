/* Задачи команды — механика первой версии поверх общей базы V2.
   Крупные карточки: статус, важность и исполнитель меняются прямо на
   карточке. Внутри — описание, ЦКП, детали, бюджет с согласованием одной
   галочкой (согласованный бюджет сам встаёт строкой в план платежей),
   приёмка результата, зависимости, обсуждение и история.
   Каждая задача — свой документ, правки разных людей не затирают друг
   друга. Кому что нужно знать, пишется в историю задачи с адресатами —
   из неё собираются «Для вас», счётчик в меню и всплывающие уведомления. */

const PRIO = {high: {name: 'Высокий', short: 'Выс.'}, medium: {name: 'Средний', short: 'Сред.'}, low: {name: 'Низкий', short: 'Низк.'}};
const prioOf = t => (t.priority === 'high' ? 'high' : t.priority === 'low' ? 'low' : 'medium');
const ST_MARK = {todo: '○', doing: '◐', review: '◈', done: '✓'};
const BUDGET_QUICK = [0, 10000, 20000, 30000, 50000, 100000, 200000];
const DIR_CAT = {content: 'content', audience: 'marketing', product: 'infra', ops: 'other'};
const normTitle = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const founderId = () => (people().find(p => p.founder) || {}).id || null;
function whoName(k) {
  const p = personById(k);
  if (p) return personName(p);
  const a = k ? Store.get('accounts', k) : null;
  return a ? a.name : 'кто-то';
}
const whoFirst = k => { const p = personById(k); return p ? firstName(p) : whoName(k).split(' ')[0]; };

const Tasks = {
  /* задачи без названия — обрывки чужих правок, их не показываем */
  all() { return Store.all('tasks').filter(t => t.title); },
  get(id) { const t = id ? Store.get('tasks', id) : null; return t && t.title ? t : null; },
  meKey() { return Auth.personId() || (Auth.me() || {}).id; },
  due(t) { return t.due || (t.month ? monthEnd(t.month) : null); },
  isOpen(t) { return t.status !== 'done'; },
  overdue(t) { const d = this.due(t); return this.isOpen(t) && !!d && d < today(); },
  mine(t) { return !!t.assignee && t.assignee === Auth.personId(); },
  manager() { return Auth.can('tasks.manage'); },

  /* приёмка результата: галочка в задаче; у старых задач — если ставил другой человек */
  approver(t) {
    if (t.approval === false) return null;
    const ap = t.approval === true ? (t.approver || t.createdBy || founderId()) : (t.createdBy && t.createdBy !== t.assignee ? t.createdBy : null);
    return ap && ap !== t.assignee ? ap : null;
  },
  needsApproval(t) { return !!this.approver(t); },
  canJudge(t) { return Auth.isOwner() || (!!this.approver(t) && this.approver(t) === this.meKey()); },
  canEdit(t) { const k = this.meKey(); return this.manager() || this.mine(t) || t.createdBy === k || this.approver(t) === k; },
  canDelete(t) { return this.manager() || t.createdBy === this.meKey(); },

  /* зависимости */
  blockers(t) { return (t.blockedBy || []).map(id => this.get(id)).filter(Boolean); },
  blocked(t) { return this.blockers(t).some(b => b.status !== 'done'); },
  dependents(t) { return this.all().filter(x => (x.blockedBy || []).includes(t.id)); },

  /* бюджет */
  budgetApprover(t) { return t.budgetApprover || founderId(); },
  budgetState(t) {
    if (!(Number(t.budget) > 0)) return 'none';
    if (!t.budgetNeedsApproval) return 'free';
    return t.budgetApproved ? 'approved' : t.budgetRejected ? 'rejected' : 'pending';
  },
  canApproveBudget(t) { return Auth.isOwner() || this.budgetApprover(t) === this.meKey(); },
  budgetMonth(t) { return t.due ? monthOf(t.due) : (t.month || monthOf(today())); },
  /* строка плана этой задачи: tb_<id> или перенесённая из первой версии (taskbudget_<id>) */
  planRow(id) { return Store.get('plan', 'tb_' + id) || Store.all('plan').find(p => p.taskId === id) || null; },
  budgetCat(t) { const row = this.planRow(t.id); return t.budgetCat || (row && row.cat) || DIR_CAT[t.dir] || 'other'; },
  /* одна строка плана на задачу: согласованный бюджет — в плане, иначе строки нет */
  syncBudget(id) {
    const t = this.get(id), cur = this.planRow(id), pid = cur ? cur.id : 'tb_' + id;
    const st = t ? this.budgetState(t) : 'none';
    if (!t || !(st === 'free' || st === 'approved')) { if (cur) Store.remove('plan', pid); return; }
    const next = {title: `Задача: ${t.title}`, group: 'once', cat: this.budgetCat(t), amount: Math.round(Number(t.budget)), months: [this.budgetMonth(t)], taskId: id, insurance: false};
    if (cur && cur.title === next.title && cur.cat === next.cat && Number(cur.amount) === next.amount && (cur.months || [])[0] === next.months[0]) return;
    Store.put('plan', pid, cur ? {...cur, ...next} : next);
  },

  /* кому сообщать о задаче: исполнитель, постановщик, кто принимает */
  circle(t) { return [t.assignee, t.createdBy, this.approver(t)].filter((x, i, a) => x && a.indexOf(x) === i); },

  sortKey(t) { return [t.status === 'done' ? 1 : 0, {high: 0, medium: 1, low: 2}[prioOf(t)], this.due(t) || '9999', t.createdAt || 0]; },
  sort(list) {
    return list.slice().sort((a, b) => {
      const x = this.sortKey(a), y = this.sortKey(b);
      for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
      return 0;
    });
  },

  /* похожая открытая задача с тем же названием */
  twin(title, exceptId) { const n = normTitle(title); return n ? this.all().find(x => x.id !== exceptId && x.status !== 'done' && normTitle(x.title) === n) || null : null; },
  dupGroups() {
    const g = new Map();
    this.all().filter(t => t.status !== 'done').forEach(t => { const n = normTitle(t.title); if (n) g.set(n, [...(g.get(n) || []), t]); });
    return [...g.values()].filter(x => x.length > 1).map(x => x.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)));
  },

  entry(text, ev, to) {
    const k = this.meKey();
    const e = {by: k, at: Date.now(), text, kind: 'system'};
    if (ev) { e.ev = ev; e.to = (to || []).filter((x, i, a) => x && x !== k && a.indexOf(x) === i); }
    return e;
  },
  create(fields) {
    const k = this.meKey(), now = Date.now(), title = fields.title.trim();
    /* двойной Enter или двойной клик не рождают вторую такую же задачу */
    const recent = !fields.force && this.all().find(x => x.createdBy === k && now - (x.createdAt || 0) < 15000 && normTitle(x.title) === normTitle(title));
    if (recent) return recent.id;
    const assignee = fields.assignee === undefined ? Auth.personId() : fields.assignee;
    const p = personById(assignee);
    const {title: _t, assignee: _a, force: _f, ...rest} = fields;
    const t = {
      desc: '', result: '', outcome: '', status: 'todo', priority: 'medium', due: null, goalId: null, stratId: null,
      ...rest,
      title, assignee: assignee || null, dir: fields.dir || (p && p.dir) || '',
      month: fields.due ? monthOf(fields.due) : (fields.month !== undefined ? fields.month : monthOf(today())),
      createdBy: fields.createdBy || k, createdAt: now, updatedAt: now, updatedBy: k,
    };
    const who = whoFirst(k);
    const log = {[uid()]: this.entry(assignee && assignee !== k ? `${who}: поставил(а) задачу — ${whoName(assignee)}` : `${who}: создал(а) задачу`, assignee && assignee !== k ? 'assign' : null, [assignee])};
    if (this.budgetState(t) === 'pending') Object.assign(log, {[uid()]: this.entry(`${who}: просит согласовать бюджет ${rubK(t.budget)}`, 'budget', [this.budgetApprover(t)])});
    t.comments = log;
    const id = Store.add('tasks', t);
    this.syncBudget(id);
    return id;
  },
  /* правка с записью в историю; ev — кому сообщить */
  update(id, patch, log, ev) {
    const cur = this.get(id);
    if (!cur) return Promise.resolve(false);
    const k = this.meKey();
    const p = {...patch, updatedAt: Date.now(), updatedBy: k};
    if (log) p.comments = {[uid()]: this.entry(log, ev && ev.type, ev && ev.to)};
    const r = Store.patch('tasks', id, p, {mustExist: true});
    this.syncBudget(id);
    return r;
  },
  setStatus(t, status, note) {
    const cur = this.get(t.id) || t;
    if (cur.status === status) return;
    const who = whoFirst(this.meKey());
    const patch = {status};
    let ev = null, text = note || `${who}: ${STATUSES[cur.status].name} → ${STATUSES[status].name}`;
    if (status === 'doing' && cur.status === 'todo') patch.startedAt = Date.now();
    if (status === 'review') {
      patch.submittedAt = Date.now();
      ev = {type: 'review', to: [this.approver(cur)]};
      text = note || `${who}: сдал(а) на согласование`;
    } else if (status === 'done') {
      patch.doneAt = Date.now();
      if (cur.status === 'review') { patch.acceptedBy = this.meKey(); ev = {type: 'accept', to: [cur.assignee, cur.createdBy]}; text = note || `${who}: согласовано, задача закрыта`; }
      else ev = {type: 'done', to: [cur.createdBy, this.approver(cur)]};
    } else if (cur.status === 'done' || (cur.status === 'review' && !this.mine(cur))) ev = {type: 'reopen', to: [cur.assignee]};
    const r = this.update(cur.id, patch, text, ev);
    if (status === 'done') this.notifyUnblocked(cur);
    return r;
  },
  /* что получится, если человек выбрал статус: приёмку не обойти */
  resolve(t, want) {
    if (want === t.status) return {st: null};
    if (t.status === 'review' && want === 'done' && !this.canJudge(t)) return {st: null, msg: `Согласовать может ${whoName(this.approver(t))}`};
    if (want === 'done' && t.status !== 'review' && this.needsApproval(t) && !this.canJudge(t)) return {st: 'review', msg: `Результат принимает ${whoName(this.approver(t))} — задача ушла на согласование`};
    if (want === 'review' && !this.needsApproval(t)) {
      const ap = t.createdBy && t.createdBy !== t.assignee ? t.createdBy : (founderId() !== t.assignee ? founderId() : null);
      if (!ap) return {st: null, msg: 'Согласовывать некому: вы и постановщик, и исполнитель — отметьте «Готово»'};
      return {st: 'review', patch: {approval: true, approver: ap}};
    }
    if (t.status === 'review' && (want === 'todo' || want === 'doing') && this.canJudge(t) && !this.mine(t)) return {st: null, needReturn: true};
    return {st: want};
  },
  apply(t, want) {
    const r = this.resolve(t, want);
    if (r.msg) toast(r.msg);
    if (r.needReturn) { openTask(t.id, {focus: 'return'}); return false; }
    if (!r.st) return false;
    if (r.patch) Store.patch('tasks', t.id, r.patch, {mustExist: true});
    if ((r.st === 'doing' || r.st === 'done') && this.blocked(t)) toast(`Задача ждёт: «${this.blockers(t).find(b => b.status !== 'done').title}»`);
    this.setStatus({...t, ...(r.patch || {})}, r.st);
    return true;
  },
  /* вернуть на доработку — только с комментарием */
  giveBack(t, text) {
    const k = this.meKey(), who = whoFirst(k);
    Store.patch('tasks', t.id, {comments: {[uid()]: {by: k, at: Date.now(), text: text.trim(), kind: 'return', ev: 'return', to: [t.assignee].filter(x => x && x !== k)}}}, {mustExist: true});
    return this.update(t.id, {status: 'doing', reworkCount: (t.reworkCount || 0) + 1}, `${who}: вернул(а) на доработку`);
  },
  comment(t, text) {
    const k = this.meKey(), now = Date.now();
    return Store.patch('tasks', t.id, {updatedAt: now, updatedBy: k, comments: {[uid()]: {by: k, at: now, text: text.trim(), kind: 'comment', ev: 'comment', to: this.circle(t).filter(x => x !== k)}}}, {mustExist: true});
  },
  /* блокирующая задача закрыта — исполнителю зависимой можно начинать */
  notifyUnblocked(t) {
    this.dependents(t).forEach(d => {
      if (d.status === 'done' || this.blockers(d).some(b => b.id !== t.id && b.status !== 'done')) return;
      Store.patch('tasks', d.id, {comments: {[uid()]: this.entry(`Можно начинать: «${t.title}» готова`, 'unblock', [d.assignee])}}, {mustExist: true});
    });
  },
  markSeen(t) {
    if (!Inbox.unreadFor(t)) return;
    Store.patch('tasks', t.id, {seen: {[this.meKey()]: Date.now()}}, {mustExist: true});
  },
  /* объединить дубль в более раннюю задачу */
  merge(keepId, dropId) {
    const a = this.get(keepId), b = this.get(dropId);
    if (!a || !b) return;
    const patch = {comments: {...(b.comments || {})}};
    if (b.desc && !String(a.desc || '').includes(b.desc)) patch.desc = [a.desc, b.desc].filter(Boolean).join('\n\n');
    if (!a.result && b.result) patch.result = b.result;
    if (!a.outcome && b.outcome) patch.outcome = b.outcome;
    if (!a.assignee && b.assignee) patch.assignee = b.assignee;
    if (!a.due && b.due) { patch.due = b.due; patch.month = b.month; }
    if ((Number(b.budget) || 0) > (Number(a.budget) || 0)) Object.assign(patch, {budget: b.budget, budgetNeedsApproval: !!b.budgetNeedsApproval, budgetApproved: !!b.budgetApproved, budgetApprover: b.budgetApprover || null, budgetCat: b.budgetCat || null});
    const bl = [...new Set([...(a.blockedBy || []), ...(b.blockedBy || [])])].filter(x => x !== keepId && x !== dropId);
    if (bl.length) patch.blockedBy = bl;
    this.update(keepId, patch, `${whoFirst(this.meKey())}: объединено с дублем «${b.title}»`);
    this.all().forEach(x => {
      if (x.id !== dropId && (x.blockedBy || []).includes(dropId)) Store.patch('tasks', x.id, {blockedBy: [...new Set(x.blockedBy.map(i => (i === dropId ? keepId : i)))].filter(i => i !== x.id)}, {mustExist: true});
    });
    Store.remove('tasks', dropId);
    this.syncBudget(dropId);
  },
  remove(t, anchor) {
    return confirmPop(anchor, {text: `Удалить задачу «${t.title.slice(0, 60)}»?`, yes: 'Да, удалить', danger: true}).then(ok => {
      if (!ok) return false;
      const copy = clone(t), plan = clone(this.planRow(t.id));
      Store.remove('tasks', t.id);
      this.syncBudget(t.id);
      this.all().forEach(x => { if ((x.blockedBy || []).includes(t.id)) Store.patch('tasks', x.id, {blockedBy: x.blockedBy.filter(i => i !== t.id)}, {mustExist: true}); });
      toast('Задача удалена', {undo: () => { Store.put('tasks', copy.id, copy); if (plan) Store.put('plan', plan.id, plan); }});
      return true;
    });
  },
};

/* ── входящие: что человеку нужно знать и что от него ждут ── */
const EV_TEXT = {
  assign: (w, t) => `${w} поставил(а) вам задачу «${t}»`,
  review: (w, t) => `${w} сдал(а) на согласование «${t}»`,
  accept: (w, t) => `${w} согласовал(а) «${t}»`,
  return: (w, t) => `${w} вернул(а) на доработку «${t}»`,
  done: (w, t) => `${w} закрыл(а) «${t}»`,
  reopen: (w, t) => `${w} вернул(а) в работу «${t}»`,
  budget: (w, t) => `${w} просит согласовать бюджет — «${t}»`,
  budgetOk: (w, t) => `${w} согласовал(а) бюджет — «${t}»`,
  budgetNo: (w, t) => `${w} не согласовал(а) бюджет — «${t}»`,
  comment: (w, t) => `${w} написал(а) в «${t}»`,
  unblock: (w, t) => `Можно начинать «${t}» — блокирующая задача готова`,
};
const Inbox = {
  /* непрочитанные события для меня по одной задаче */
  unreadFor(t) {
    const me = Tasks.meKey();
    if (!me) return 0;
    const seen = (t.seen || {})[me] || 0;
    let n = Object.values(t.comments || {}).filter(c => c.ev && (c.to || []).includes(me) && c.by !== me && (c.at || 0) > seen).length;
    /* старые задачи без адресатов: новая задача мне, которую я не открывал */
    if (!n && Tasks.mine(t) && Tasks.isOpen(t) && t.updatedBy && t.updatedBy !== me && !Object.values(t.comments || {}).some(c => c.ev) && (!t.seen || !t.seen[me] || t.seen[me] < (t.updatedAt || 0))) n = 1;
    return n;
  },
  events() {
    const me = Tasks.meKey();
    if (!me) return [];
    const out = [];
    Tasks.all().forEach(t => {
      const seen = (t.seen || {})[me] || 0;
      Object.values(t.comments || {}).forEach(c => {
        if (c.ev && (c.to || []).includes(me) && c.by !== me && (c.at || 0) > seen) out.push({t, c});
      });
    });
    return out.sort((a, b) => b.c.at - a.c.at);
  },
  text(e) {
    const f = EV_TEXT[e.c.ev];
    return f ? f(whoFirst(e.c.by), e.t.title) : e.c.text;
  },
  actions() {
    const me = Tasks.meKey(), list = Tasks.all();
    return {
      review: list.filter(t => t.status === 'review' && (Tasks.approver(t) === me || (!Tasks.approver(t) && Auth.isOwner()))),
      budget: list.filter(t => Tasks.budgetState(t) === 'pending' && Tasks.budgetApprover(t) === me),
      late: list.filter(t => Tasks.mine(t) && Tasks.overdue(t)),
      soon: list.filter(t => Tasks.mine(t) && Tasks.isOpen(t) && t.due && t.due >= today() && t.due <= addDays(today(), 1)),
    };
  },
  count() {
    if (!Auth.can('tasks.view')) return 0;
    const a = this.actions();
    const ids = new Set([...a.review, ...a.budget].map(t => t.id));
    Tasks.all().forEach(t => { if (this.unreadFor(t)) ids.add(t.id); });
    return ids.size;
  },
  readAll() {
    const me = Tasks.meKey(), now = Date.now();
    Tasks.all().forEach(t => { if (this.unreadFor(t)) Store.patch('tasks', t.id, {seen: {[me]: now}}, {mustExist: true}); });
  },
};
function taskBadge() { return Inbox.count(); }

/* всплывающие уведомления о свежих событиях, пока штаб открыт */
const TaskNotify = {
  since: 0,
  wired: false,
  init() {
    if (this.wired) return;
    this.wired = true;
    this.since = Date.now() - 2000;
    Store.subscribe(c => { if (c === 'tasks') setTimeout(() => this.check(), 30); });
  },
  check() {
    if (!Auth.me() || !Auth.can('tasks.view')) return;
    const fresh = Inbox.events().filter(e => (e.c.at || 0) > this.since);
    if (!fresh.length) return;
    this.since = Math.max(this.since, ...fresh.map(e => e.c.at || 0));
    fresh.slice(0, 3).reverse().forEach(e => toast(Inbox.text(e), {action: {label: 'Открыть', fn: () => openTask(e.t.id)}}));
  },
};

/* ── страница ── */
const DIR_CODE = {product: 'ПР', content: 'КН', audience: 'АУ', ops: 'УП'};
const TaskUI = {
  composer: null,        // открытая строка добавления в колонке: {col, title, assignee, due, force}
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
    TaskNotify.init();
    const view = View.get('t.view', 'board');
    const f = TaskUI.filters();
    const ppl = people();
    const goals = Strategy.goals();
    const list = TaskUI.filtered();
    const lateN = TaskUI.filtered({ignoreLate: true}).filter(t => Tasks.overdue(t)).length;
    const dups = Tasks.dupGroups();
    const opt = (v, n, cur) => `<option value="${esc(v)}" ${cur === v ? 'selected' : ''}>${esc(n)}</option>`;
    const whoOpts = [['me', 'Мои задачи'], ['all', 'Вся команда'], ...ppl.map(p => [p.id, personName(p)]), ['none', 'Без исполнителя']]
      .filter(([v]) => v !== 'me' || Auth.personId()).map(([v, n]) => opt(v, n, f.who)).join('');
    const views = [['board', 'Доска'], ['month', 'По месяцам'], ['week', 'По неделям'], ['list', 'Список']];
    TaskUI.dupIds = new Set(dups.flat().map(t => t.id));

    root.innerHTML = `
      ${pageHead('Задачи', 'Кто что делает и к какому дню. Статус, важность и исполнителя меняйте прямо на карточке, остальное — внутри задачи.',
        `${helpBtn('tasks')}<button class="btn primary" data-quick>${icon('plus')}Задача</button>`)}
      ${helpBox('tasks', `<b>Как работаем с задачами.</b> На карточке сразу меняются статус, важность и исполнитель. Клик по карточке — окно задачи: описание, ЦКП (что получим на выходе), срок, бюджет — выберите сумму и при необходимости отметьте «Требует согласования», — кто принимает результат, от чего задача зависит, обсуждение. Если результат принимает другой человек, «Готово» отправит задачу ему на согласование: он согласует или вернёт с комментарием. Всё, что касается вас, собирается в блоке «Для вас» и всплывает уведомлением. Карточки перетаскиваются зажатием.`)}
      ${inboxHtml()}
      <div class="t-bar">
        <div class="seg" role="tablist">${views.map(([k, n]) => `<button data-view="${k}" class="${view === k ? 'on' : ''}">${n}</button>`).join('')}</div>
        <select class="select sm" id="fWho" aria-label="Чьи задачи">${whoOpts}</select>
        <select class="select sm" id="fDir" aria-label="Направление">${opt('', 'Все направления', f.dir)}${Object.entries(DIRS).map(([k, d]) => opt(k, d.name, f.dir)).join('')}</select>
        ${goals.length ? `<select class="select sm" id="fGoal" aria-label="Цель квартала">${opt('', 'Все цели', f.goal)}${goals.map(g => opt(g.id, g.short || g.title, f.goal)).join('')}</select>` : ''}
        <input class="input sm t-search" id="fQ" type="search" placeholder="Поиск" value="${esc(f.q)}">
        <span class="t-bar-sp"></span>
        <button class="chip ${f.late ? 'on' : ''}" data-late>Просрочено <b>${lateN}</b></button>
        ${dups.length ? `<button class="chip warn-chip" data-dups title="Задачи с одинаковым названием">Дубли <b>${dups.length}</b></button>` : ''}
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
    on(root, 'click', '[data-dups]', () => dupModal());
    $('#fWho', root).onchange = e => { View.set('t.who', e.target.value); App.render(); };
    $('#fDir', root).onchange = e => { View.set('t.dir', e.target.value); App.render(); };
    if ($('#fGoal', root)) $('#fGoal', root).onchange = e => { View.set('t.goal', e.target.value); App.render(); };
    if ($('#fDone', root)) $('#fDone', root).onchange = e => { View.set('t.done', e.target.checked); App.render(); };
    let qt;
    $('#fQ', root).oninput = e => { clearTimeout(qt); const v = e.target.value; qt = setTimeout(() => { View.set('t.q', v); App.render({focus: 'fQ'}); const el = $('#fQ'); if (el) el.setSelectionRange(v.length, v.length); }, 250); };
    wireInbox(root);
    wireTaskCards(root);
    wireComposer(root);
  },
});

/* ── «Для вас»: решения, которых ждут, и свежие события ── */
function inboxHtml() {
  if (!Auth.can('tasks.view')) return '';
  const a = Inbox.actions(), ev = Inbox.events();
  const rows = [
    ...a.review.map(t => ({t, kind: 'gold', tag: 'ждёт вашего согласования', who: t.assignee, btn: `<button class="btn xs good" data-ib-accept="${t.id}">${icon('tick')}Согласовать</button>`})),
    ...a.budget.map(t => ({t, kind: 'gold', tag: `бюджет ${rubK(t.budget)} ждёт согласования`, who: t.createdBy, btn: `<button class="btn xs good" data-ib-budget="${t.id}">${icon('tick')}Согласовать бюджет</button>`})),
    ...a.soon.map(t => ({t, kind: 'warn', tag: t.due === today() ? 'срок сегодня' : 'срок завтра', who: t.assignee})),
  ];
  const seenIds = new Set(rows.map(r => r.t.id));
  const evRows = ev.slice(0, 12);
  if (!rows.length && !evRows.length) return '';
  /* просроченные — одной строкой: их видно фильтром «Просрочено» */
  const lateRow = a.late.length ? `<div class="ib-row sum"><span class="pill bad">просрочено у вас: ${a.late.length}</span><span class="ib-t">${esc(a.late.slice(0, 2).map(t => t.title).join(' · '))}${a.late.length > 2 ? ' …' : ''}</span><button class="btn xs" data-ib-late>Показать</button></div>` : '';
  const collapsed = View.get('t.inboxHide', false);
  return `<section class="card inbox ${collapsed ? 'shut' : ''}">
    <div class="ib-head"><h2>Для вас</h2><span class="ib-n">${Inbox.count()}</span>
      ${evRows.length ? '<button class="btn xs ghost" data-ib-read>Отметить прочитанным</button>' : ''}
      <button class="btn xs ghost" data-ib-toggle>${collapsed ? 'Показать' : 'Свернуть'}</button></div>
    ${collapsed ? '' : `<div class="ib-list">
      ${lateRow}
      ${rows.map(r => `<div class="ib-row act" data-task="${r.t.id}"><span class="pill ${r.kind}">${r.tag}</span><b class="ib-t">${esc(r.t.title)}</b>${avatar(personById(r.who))}${r.btn || ''}</div>`).join('')}
      ${evRows.map(e => `<div class="ib-row ev ${seenIds.has(e.t.id) ? 'dim' : ''}" data-task="${e.t.id}">${avatar(personById(e.c.by))}<span class="ib-t">${esc(Inbox.text(e))}${e.c.ev === 'comment' || e.c.ev === 'return' ? '' : ''}</span><time>${timeAgo(e.c.at)}</time></div>`).join('')}
      ${ev.length > evRows.length ? `<p class="note">и ещё ${ev.length - evRows.length}</p>` : ''}
    </div>`}
  </section>`;
}
function wireInbox(root) {
  on(root, 'click', '[data-ib-toggle]', () => { View.set('t.inboxHide', !View.get('t.inboxHide', false)); App.render(); });
  on(root, 'click', '[data-ib-read]', () => { Inbox.readAll(); toast('Все события отмечены прочитанными'); });
  on(root, 'click', '[data-ib-late]', () => { View.set('t.late', true); View.set('t.who', 'me'); App.render(); });
  on(root, 'click', '[data-ib-accept]', (e, el) => { e.stopPropagation(); const t = Tasks.get(el.dataset.ibAccept); if (t) { Tasks.setStatus(t, 'done'); toast('Согласовано, задача закрыта'); } });
  on(root, 'click', '[data-ib-budget]', (e, el) => { e.stopPropagation(); const t = Tasks.get(el.dataset.ibBudget); if (t) approveBudget(t, true); });
}
function approveBudget(t, ok) {
  const who = whoFirst(Tasks.meKey());
  if (ok) Tasks.update(t.id, {budgetApproved: true, budgetRejected: false, budgetApprovedBy: Tasks.meKey(), budgetApprovedAt: Date.now()}, `${who}: бюджет ${rubK(t.budget)} согласован`, {type: 'budgetOk', to: [t.assignee, t.createdBy]});
  else Tasks.update(t.id, {budgetApproved: false, budgetRejected: true}, `${who}: бюджет ${rubK(t.budget)} не согласован`, {type: 'budgetNo', to: [t.assignee, t.createdBy]});
  toast(ok ? `Бюджет согласован — ${rubK(t.budget)} в плане платежей` : 'Бюджет не согласован');
}

/* ── карточка (как в первой версии: код направления, отметки, аватар, статус и важность прямо на карточке) ── */
function dueChip(t) {
  const d = Tasks.due(t);
  if (!d) return '<span class="due none">без срока</span>';
  const label = t.due ? dayShort(t.due) : monthShort(t.month);
  if (t.status === 'done') return `<span class="due">${label}</span>`;
  if (d < today()) return `<span class="due late" title="Срок прошёл">${icon('cal')}${label}</span>`;
  if (t.due && daysBetween(today(), t.due) <= 2) return `<span class="due soon">${icon('cal')}${t.due === today() ? 'сегодня' : label}</span>`;
  return `<span class="due">${icon('cal')}${label}</span>`;
}
function budgetChip(t) {
  const st = Tasks.budgetState(t);
  if (st === 'none') return '';
  const mark = {free: '', approved: ' ✓', pending: ' · ждёт', rejected: ' · не согл.'}[st];
  return `<span class="t-budget ${st}" title="Бюджет задачи${st === 'pending' ? ' ждёт согласования' : st === 'approved' ? ' согласован' : ''}">${rubK(Number(t.budget))}${mark}</span>`;
}
function escDots(t) {
  const p = Math.min(3, t.postponeCount || 0), r = Math.min(3, t.reworkCount || 0);
  if (!p && !r) return '';
  return `<span class="tc-dots" title="${p ? `переносили срок: ${t.postponeCount}` : ''}${p && r ? ' · ' : ''}${r ? `возвращали на доработку: ${t.reworkCount}` : ''}">${'<i class="pp"></i>'.repeat(p)}${'<i class="rw"></i>'.repeat(r)}</span>`;
}
function statusSel(t, cls = '') {
  if (!Tasks.canEdit(t)) return `<span class="tc-sel ro st-${t.status} ${cls}">${ST_MARK[t.status]} ${STATUSES[t.status].name}</span>`;
  return `<select class="tc-sel st-${t.status} ${cls}" data-tsel="status" data-id="${t.id}" aria-label="Статус">${Object.entries(STATUSES).map(([k, s]) => `<option value="${k}" ${k === t.status ? 'selected' : ''}>${ST_MARK[k]} ${s.name}</option>`).join('')}</select>`;
}
function taskCard(t) {
  const p = personById(t.assignee);
  const can = Tasks.canEdit(t);
  const g = t.goalId ? Strategy.goal(t.goalId) : null;
  const n = Object.values(t.comments || {}).filter(c => c.kind !== 'system').length;
  const code = DIR_CODE[t.dir];
  const hasLock = (t.blockedBy || []).length > 0, blocked = hasLock && Tasks.blocked(t);
  const holds = t.status !== 'done' ? Tasks.dependents(t).filter(d => d.status !== 'done').length : 0;
  const fresh = Inbox.unreadFor(t) > 0;
  const pr = prioOf(t);
  const cls = [t.status, fresh ? 'fresh' : '', can ? 'can' : '', t.status === 'review' ? 'awaiting' : '', (t.reworkCount && t.status === 'doing' && lastReturn(t)) ? 'returned' : ''].join(' ');
  return `<div class="tc ${cls}" data-task="${t.id}" tabindex="0">
    ${hasLock ? `<span class="tc-lock ${blocked ? 'on' : ''}" title="${blocked ? 'Ждёт другую задачу' : 'Блокирующие задачи готовы'}">${blocked ? '🔒' : '🔓'}</span>` : ''}
    <div class="tc-top">
      ${code ? `<span class="kc-dir" style="--c:${DIRS[t.dir].color}" title="${DIRS[t.dir].name}">${code}</span>` : '<span class="kc-dir none">—</span>'}
      ${escDots(t)}
      ${fresh ? '<span class="pill rose tc-new">новое</span>' : ''}
      ${TaskUI.dupIds && TaskUI.dupIds.has(t.id) ? '<span class="tc-dup" title="Есть задача с таким же названием — объедините их кнопкой «Дубли»">дубль</span>' : ''}
      <span class="tc-av" title="${esc(p ? personName(p) : 'Не назначено')}">${avatar(p)}</span>
    </div>
    <div class="tc-title">${t.stratId ? '<span class="tc-strat" title="Этап дорожной карты">◆</span> ' : ''}${esc(t.title)}</div>
    <div class="tc-ctrl">
      ${statusSel(t)}
      ${can ? `<select class="tc-sel pr-${pr} tc-narrow" data-tsel="priority" data-id="${t.id}" aria-label="Важность">${Object.entries(PRIO).map(([k, x]) => `<option value="${k}" ${k === pr ? 'selected' : ''}>${x.short}</option>`).join('')}</select>` : `<span class="tc-sel ro pr-${pr} tc-narrow">${PRIO[pr].short}</span>`}
    </div>
    ${can ? `<select class="tc-sel tc-who" data-tsel="assignee" data-id="${t.id}" aria-label="Исполнитель"><option value="">— Не назначено —</option>${people().map(x => `<option value="${x.id}" ${t.assignee === x.id ? 'selected' : ''}>${esc(personName(x))}</option>`).join('')}</select>` : `<span class="tc-sel ro tc-who">${esc(p ? personName(p) : 'Не назначено')}</span>`}
    <div class="tc-foot">${dueChip(t)}${n ? `<span class="t-cm">${icon('msg')}${n}</span>` : ''}${budgetChip(t)}${holds ? `<span class="t-holds" title="От этой задачи зависят другие">держит ${holds}</span>` : ''}${g ? `<span class="t-goal">${esc(g.short || g.title)}</span>` : ''}</div>
  </div>`;
}
/* строка — для списка, главной, стратегии и страницы человека */
function taskMeta(t) {
  const g = t.goalId ? Strategy.goal(t.goalId) : null;
  const n = Object.values(t.comments || {}).filter(c => c.kind !== 'system').length;
  return [
    g ? `<span class="t-goal" title="Цель квартала">${esc(g.short || g.title)}</span>` : '',
    t.dir && DIRS[t.dir] ? `<span class="t-dir"><i class="dot" style="background:${DIRS[t.dir].color}"></i>${DIRS[t.dir].name}</span>` : '',
    budgetChip(t),
    n ? `<span class="t-cm">${icon('msg')}${n}</span>` : '',
    Tasks.blocked(t) ? '<span class="t-lock" title="Ждёт другую задачу">🔒</span>' : '',
    Inbox.unreadFor(t) ? '<span class="pill rose">новое</span>' : '',
  ].join('');
}
function taskRow(t) {
  const p = personById(t.assignee);
  const can = Tasks.canEdit(t);
  return `<div class="t-row ${t.status === 'done' ? 'done' : ''} ${Inbox.unreadFor(t) ? 'fresh' : ''}" data-task="${t.id}">
    <button class="t-check ${t.status}" data-done="${t.id}" ${can ? '' : 'disabled'} aria-label="${t.status === 'done' ? 'Вернуть в работу' : 'Отметить сделанной'}" title="${t.status === 'done' ? 'Вернуть в работу' : t.status === 'review' ? 'На согласовании' : 'Готово'}">${icon('tick')}</button>
    <div class="t-main">
      <div class="t-title">${prioOf(t) === 'high' ? '<i class="prio" title="Высокий приоритет"></i>' : ''}${esc(t.title)}</div>
      <div class="t-meta">${taskMeta(t)}</div>
    </div>
    <div class="t-who">${avatar(p)}<span class="t-who-n">${esc(p ? firstName(p) : 'Никто')}</span></div>
    ${dueChip(t)}
    ${statusSel(t, 't-st')}
  </div>`;
}
const lastReturn = t => Object.values(t.comments || {}).filter(c => c.kind === 'return').sort((a, b) => b.at - a.at)[0] || null;

/* колонка доски с добавлением внизу */
function kbCol({key, title, sub = '', items, add = null, now = false, tone = '', extra = ''}) {
  const comp = TaskUI.composer && TaskUI.composer.col === key ? TaskUI.composer : null;
  return `<section class="kb-col ${now ? 'now' : ''} ${tone}" data-col="${key}">
    <header class="kb-h"><b>${title}</b>${sub}<span class="kb-n">${items.length}</span></header>
    <div class="kb-list">
      ${items.map(t => taskCard(t)).join('')}
      ${extra}
      ${add ? (comp ? composerHtml(comp) : `<button class="kb-add" data-add="${key}">${icon('plus')}Добавить задачу</button>`) : ''}
    </div>
  </section>`;
}
function composerHtml(c) {
  const ppl = people();
  const twin = c.twin ? Tasks.get(c.twin) : null;
  return `<form class="kb-composer" data-composer="${c.col}" autocomplete="off">
    <textarea class="textarea" id="kbTitle" rows="2" placeholder="Что нужно сделать? Enter — добавить" maxlength="200">${esc(c.title || '')}</textarea>
    ${twin ? `<div class="kb-twin">Такая задача уже есть: <button type="button" class="link-btn" data-open-twin="${twin.id}">«${esc(twin.title.slice(0, 60))}»</button> · ${esc(twin.assignee ? firstName(personById(twin.assignee)) : 'без исполнителя')}, ${STATUSES[twin.status].name.toLowerCase()}. <button type="button" class="link-btn" data-comp-force>Всё равно добавить</button></div>` : ''}
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
  on(root, 'click', '[data-open-twin]', (e, el) => openTask(el.dataset.openTwin));
  const form = $('.kb-composer', root);
  if (!form) return;
  const c = TaskUI.composer;
  const ta = $('#kbTitle', form);
  ta.addEventListener('input', () => { c.title = ta.value; if (c.twin) { c.twin = null; c.force = false; const tw = $('.kb-twin', form); if (tw) tw.remove(); } });
  $('#kbWho', form).onchange = e => { c.assignee = e.target.value; };
  $('#kbDue', form).onchange = e => { c.due = e.target.value; };
  ta.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
    if (e.key === 'Escape') { TaskUI.composer = null; App.render(); }
  });
  let busy = false;
  const make = () => {
    const title = ta.value.trim();
    if (!title) { ta.focus(); return null; }
    const twin = Tasks.twin(title);
    if (twin && !c.force) { c.twin = twin.id; App.render({focus: 'kbTitle'}); return null; }
    const pre = colPreset(c.col);
    const due = $('#kbDue', form).value || null;
    const col = $$(`[data-col="${c.col}"] [data-task]`, root).map(x => Tasks.get(x.dataset.task)).filter(Boolean);
    const id = Tasks.create({title, force: !!c.force, assignee: $('#kbWho', form).value || null, due, month: due ? monthOf(due) : (pre.month !== undefined ? pre.month : undefined), status: pre.status && pre.status !== 'review' && pre.status !== 'done' ? pre.status : 'todo'});
    Store.patch('tasks', id, {order: col.length ? effOrder(col[col.length - 1]) + 1000 : Date.now()}, {mustExist: true});
    c.twin = null; c.force = false;
    return id;
  };
  on(form, 'click', '[data-comp-force]', () => { c.force = true; form.requestSubmit(); });
  form.onsubmit = e => {
    e.preventDefault();
    if (busy) return;
    busy = true;
    const id = make();
    busy = false;
    if (!id) return;
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
    kbCol({key: 's:review', title: 'На согласовании', sub: '<em>принимает постановщик</em>', items: byOrder(list.filter(t => t.status === 'review')), tone: 'review'}),
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
  const st = key.slice(2);
  const order = orderBetween(pos.afterId, pos.beforeId);
  if (st === t.status) { Store.patch('tasks', id, {order}, {mustExist: true}); return; }
  const r = Tasks.resolve(t, st);
  if (r.needReturn) { openTask(id, {focus: 'return'}); return; }
  if (!r.st) { if (r.msg) toast(r.msg); App.render(); return; }
  Store.patch('tasks', id, {order}, {mustExist: true});
  Tasks.apply(t, st);
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
      if (m && t.month && m > t.month) patch.postponeCount = (t.postponeCount || 0) + 1;
      Tasks.update(id, patch, `Перенесено на ${m ? monthName(m).toLowerCase() : '«без срока»'}`);
    } else Store.patch('tasks', id, patch, {mustExist: true});
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
    if (w === 'none') { if (t.due) Tasks.update(id, {due: null, month: m, order}, 'Срок снят'); else Store.patch('tasks', id, {order}, {mustExist: true}); return; }
    let d = addDays(w, t.due ? weekday(t.due) : 4);
    if (d < monthStart(m)) d = monthStart(m);
    if (d > monthEnd(m)) d = monthEnd(m);
    if (d === t.due) { Store.patch('tasks', id, {order}, {mustExist: true}); return; }
    Tasks.update(id, {due: d, month: monthOf(d), order, ...(t.due && d > t.due ? {postponeCount: (t.postponeCount || 0) + 1} : {})}, `Срок: ${dayLong(d)}`);
  }});
}

/* ── список ── */
function renderTaskList(box, list) {
  const showDone = TaskUI.filters().done;
  const groups = ['review', 'doing', 'todo', ...(showDone ? ['done'] : [])];
  const comp = TaskUI.composer && TaskUI.composer.col === 's:todo' ? TaskUI.composer : null;
  const html = groups.map(st => {
    const items = st === 'done' ? list.filter(t => t.status === 'done').sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)).slice(0, 60) : Tasks.sort(list.filter(t => t.status === st));
    if (!items.length && st !== 'todo') return '';
    return `<section class="t-group"><div class="t-group-head">${STATUSES[st].name} <span>${items.length}</span>${st === 'review' ? '<em>ждут согласования постановщика</em>' : ''}</div>
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

/* клики по карточкам и строкам: статус, важность, исполнитель прямо на карточке, открытие */
function wireTaskCards(root) {
  on(root, 'change', '[data-tsel]', (e, el) => {
    const t = Tasks.get(el.dataset.id);
    if (!t) return;
    const v = el.value, kind = el.dataset.tsel;
    if (kind === 'status') { if (!Tasks.apply(t, v)) el.value = t.status; return; }
    if (kind === 'priority') { Tasks.update(t.id, {priority: v}, `Приоритет: ${PRIO[v].name.toLowerCase()}`); return; }
    if (kind === 'assignee') {
      const p = personById(v);
      Tasks.update(t.id, {assignee: v || null, ...(p && p.dir && !t.dir ? {dir: p.dir} : {})}, `Исполнитель: ${p ? personName(p) : 'не назначен'}`, {type: 'assign', to: [v]});
    }
  });
  on(root, 'click', '[data-done]', (e, el) => {
    e.stopPropagation();
    const t = Tasks.get(el.dataset.done);
    if (!t) return;
    if (t.status === 'done') Tasks.apply(t, 'doing');
    else Tasks.apply(t, 'done');
  });
  on(root, 'click', '[data-task]', (e, el) => {
    if (e.target.closest('[data-done], button, a, input, select, textarea, .tc-sel')) return;
    openTask(el.dataset.task);
  });
  on(root, 'keydown', '[data-task]', (e, el) => { if (e.key === 'Enter' && e.target === el) openTask(el.dataset.task); });
}

/* быстрое окно: название, кто, срок → Добавить или Подробнее… */
function quickTask(preset) {
  const ppl = people();
  openModal({
    title: 'Новая задача',
    body: `<input class="input t-m-title" id="qtTitle" placeholder="Название задачи" maxlength="200">
      <div class="qt-twin note" id="qtTwin" hidden></div>
      <div class="grid3">
        <label class="field"><span>Кто делает</span><select class="select" id="qtWho">${[['', 'Не назначено'], ...ppl.map(p => [p.id, personName(p)])].map(([v, n]) => `<option value="${v}" ${(Auth.personId() || '') === v ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
        <label class="field"><span>Срок</span><input class="input" id="qtDue" type="date" value="${esc(preset.due || '')}"></label>
        <label class="field"><span>Направление</span><select class="select" id="qtDir"><option value="">Как у исполнителя</option>${Object.entries(DIRS).map(([k, d]) => `<option value="${k}">${d.name}</option>`).join('')}</select></label>
      </div>`,
    foot: `<button class="btn ghost left" id="qtMore">Подробнее…</button><button class="btn" data-close>Отмена</button><button class="btn primary" id="qtAdd">Добавить</button>`,
    onMount(el, close) {
      let force = false, done = false;
      const tw = $('#qtTwin', el);
      const check = () => {
        const twin = Tasks.twin($('#qtTitle', el).value);
        force = false;
        tw.hidden = !twin;
        if (twin) tw.innerHTML = `Похожая задача уже есть: <button type="button" class="link-btn" data-open-twin="${twin.id}">«${esc(twin.title.slice(0, 60))}»</button> — ${esc(twin.assignee ? personName(personById(twin.assignee)) : 'без исполнителя')}, ${STATUSES[twin.status].name.toLowerCase()}.`;
        $('#qtAdd', el).textContent = 'Добавить';
      };
      $('#qtTitle', el).addEventListener('input', check);
      on(el, 'click', '[data-open-twin]', (e, b) => { close(); openTask(b.dataset.openTwin); });
      const make = () => {
        if (done) return null;
        const title = $('#qtTitle', el).value.trim();
        if (!title) { $('#qtTitle', el).focus(); $('#qtTitle', el).classList.add('need'); return null; }
        if (Tasks.twin(title) && !force) { force = true; $('#qtAdd', el).textContent = 'Всё равно добавить'; tw.hidden = false; return null; }
        done = true;
        const due = $('#qtDue', el).value || null;
        return Tasks.create({title, force, assignee: $('#qtWho', el).value || null, due, dir: $('#qtDir', el).value || undefined});
      };
      $('#qtAdd', el).onclick = () => { if (make()) { close(); toast('Задача добавлена'); } };
      $('#qtMore', el).onclick = () => { const id = make(); if (id) { close(); openTask(id); } };
      $('#qtTitle', el).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#qtAdd', el).click(); } });
    },
  });
}

/* дубли: одинаковые названия у открытых задач — объединить в более раннюю */
function dupModal() {
  const groups = Tasks.dupGroups();
  if (!groups.length) { toast('Дублей нет'); return; }
  openModal({
    title: 'Дубли задач',
    body: `<p class="note">У этих открытых задач одинаковые названия. «Объединить» оставит более раннюю: перенесёт в неё обсуждение, описание, срок и бюджет, а дубль удалит.</p>
      ${groups.map(g => `<div class="dup-g">${g.map((t, i) => `<div class="dup-r">${i ? '' : '<span class="pill good">оставим</span>'}<button class="link-btn" data-open-dup="${t.id}">${esc(t.title)}</button><span class="note">${esc(t.assignee ? firstName(personById(t.assignee)) : 'без исполнителя')} · ${STATUSES[t.status].name.toLowerCase()} · создана ${timeAgo(t.createdAt)}</span></div>`).join('')}
        ${Tasks.canDelete(g[1]) ? `<button class="btn sm" data-merge="${g[0].id}|${g.slice(1).map(t => t.id).join(',')}">Объединить</button>` : '<span class="note">Объединить может постановщик или руководитель</span>'}</div>`).join('')}`,
    foot: '<button class="btn" data-close>Закрыть</button>',
    onMount(el, close) {
      on(el, 'click', '[data-open-dup]', (e, b) => { close(); openTask(b.dataset.openDup); });
      on(el, 'click', '[data-merge]', (e, b) => {
        const [keep, drops] = b.dataset.merge.split('|');
        drops.split(',').forEach(d => Tasks.merge(keep, d));
        b.closest('.dup-g').remove();
        toast('Дубли объединены');
        if (!$('.dup-g', el)) close();
      });
    },
  });
}

/* ── окно задачи — по образцу первой версии ── */
function openTask(id, opts = {}) {
  const isNew = !id;
  if (!isNew && !Tasks.get(id)) { toast('Задача уже удалена'); return; }
  const draft = isNew ? {title: '', desc: '', result: '', outcome: '', status: 'todo', assignee: Auth.personId(), dir: (Auth.person() || {}).dir || '',
    priority: 'medium', due: '', month: monthOf(today()), goalId: '', stratId: '', budget: 0, budgetNeedsApproval: !Auth.can('money.edit'), createdBy: Tasks.meKey(), ...(opts.defaults || {})} : null;
  const cur = () => (isNew ? draft : Tasks.get(id));
  let unsub = null;
  if (!isNew) Tasks.markSeen(cur());
  const t0 = cur();
  const can = isNew || Tasks.canEdit(t0);
  const ppl = people();
  const months = monthRange('2026-08', '2027-12');
  const goals = Strategy.goals(), items = Strategy.items();
  const sel = (sid, list, v, dis) => `<select class="select" id="${sid}" ${dis ? 'disabled' : ''}>${list.map(([val, n]) => `<option value="${esc(val)}" ${String(v || '') === String(val) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
  const pOpts = ppl.map(p => [p.id, personName(p) + (p.title && p.name ? ' · ' + p.title : '')]);

  const body = `<div class="tm">
    <div class="tm-top" id="tmTop"></div>
    <textarea class="tm-title" id="tmTitle" rows="1" placeholder="Что нужно сделать" ${can ? '' : 'disabled'} maxlength="200">${esc(t0.title)}</textarea>
    <div class="qt-twin note" id="tmTwin" hidden></div>
    <label class="tm-f"><span>Описание</span><textarea class="textarea" id="tmDesc" rows="3" ${can ? '' : 'disabled'} placeholder="В чём суть задачи, контекст, ссылки">${esc(t0.desc || '')}</textarea></label>
    <label class="tm-f"><span>ЦКП — что конкретно должны получить на выходе</span><textarea class="textarea" id="tmResult" rows="2" ${can ? '' : 'disabled'} placeholder="Конкретный измеримый результат: «договор подписан и лежит в папке»">${esc(t0.result || '')}</textarea></label>
    <div class="tm-box"><p class="tm-box-l">Детали задачи</p>
      <div class="tm-grid">
        <label class="tm-f"><span>Постановщик</span>${sel('tmCreator', [['', '—'], ...pOpts], t0.createdBy, !(can && Tasks.manager()))}</label>
        <label class="tm-f"><span>Ответственный</span>${sel('tmWho', [['', '— Не назначено —'], ...pOpts], t0.assignee, !can)}</label>
        <label class="tm-f"><span>Направление</span>${sel('tmDir', [['', '— Без направления —'], ...Object.entries(DIRS).map(([k, d]) => [k, `${DIR_CODE[k]} — ${d.name}`])], t0.dir, !can)}</label>
        <label class="tm-f"><span>Приоритет</span>${sel('tmPrio', Object.entries(PRIO).map(([k, x]) => [k, x.name]), prioOf(t0), !can)}</label>
        <label class="tm-f"><span>Срок</span><input class="input" id="tmDue" type="date" value="${esc(t0.due || '')}" ${can ? '' : 'disabled'} min="2026-01-01" max="2028-12-31"></label>
        <label class="tm-f"><span>Месяц</span>${sel('tmMonth', [['', 'Без срока'], ...months.map(m => [m, monthName(m, true)])], t0.month, !can)}</label>
        <label class="tm-f"><span>Цель квартала</span>${sel('tmGoal', [['', 'Не связана'], ...goals.map(g => [g.id, g.short || g.title])], t0.goalId, !can)}</label>
        ${items.length ? `<label class="tm-f tm-span2"><span>Этап дорожной карты</span>${sel('tmStrat', [['', 'Не связана'], ...items.map(i => [i.id, `${dirName(i.dir)} · ${i.title}`])], t0.stratId, !can)}</label>` : ''}
      </div>
    </div>
    <div class="tm-box" id="tmBudgetBox"></div>
    <div class="tm-box" id="tmApprBox"></div>
    ${isNew ? '' : '<div class="tm-box" id="tmDepsBox"></div><div class="tm-zone" id="tmZone"></div>'}
    ${isNew ? '' : `<div class="t-m-comments"><div class="label">Обсуждение и история</div><div id="tmThread" class="thread"></div>
      <form id="tmCForm" class="t-m-cform"><textarea class="textarea" id="tmComment" rows="2" placeholder="Написать комментарий: вопрос, ссылка, что сделано — придёт исполнителю и постановщику"></textarea><button class="btn sm dark" type="submit">Отправить</button></form></div>`}
  </div>`;
  const foot = isNew
    ? `<button class="btn" data-close>Отмена</button><button class="btn primary" id="tmCreate">Создать задачу</button>`
    : `${Tasks.canDelete(t0) ? `<button class="btn danger left" id="tmDel">${icon('trash')}Удалить</button>` : '<span class="left"></span>'}<span class="note" id="tmSaved"></span><button class="btn primary" data-close>Готово</button>`;

  openModal({
    title: isNew ? 'Новая задача' : 'Задача',
    body, foot, wide: true, focus: isNew,
    onMount(el, close) {
      el.classList.add('tm-modal');
      const saved = () => { const s = $('#tmSaved', el); if (s) { s.textContent = 'Сохранено'; clearTimeout(s._t); s._t = setTimeout(() => { s.textContent = ''; }, 1600); } };
      /* одна точка записи: у новой задачи — в черновик, у существующей — в базу с историей */
      const set = (patch, log, ev) => {
        if (isNew) { Object.assign(draft, patch); paint(); return; }
        Tasks.update(id, patch, log, ev);
        saved();
      };
      const me = () => whoFirst(Tasks.meKey());

      /* поля */
      const bind = (sid, fn) => { const i = $(sid, el); if (i) i.addEventListener('change', () => fn(i.value, i)); };
      bind('#tmTitle', v => { const t = cur(); if (!v.trim()) { $('#tmTitle', el).value = t.title; return; } set({title: v.trim()}); });
      /* название переносится на новые строки, Enter — сохранить */
      const ttl = $('#tmTitle', el);
      const grow = () => { ttl.style.height = 'auto'; ttl.style.height = ttl.scrollHeight + 'px'; };
      requestAnimationFrame(grow);
      ttl.addEventListener('input', grow);
      ttl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ttl.blur(); } });
      $('#tmTitle', el).addEventListener('input', () => {
        const tw = $('#tmTwin', el), twin = Tasks.twin($('#tmTitle', el).value, isNew ? null : id);
        tw.hidden = !twin;
        if (twin) tw.innerHTML = `Похожая задача уже есть: «${esc(twin.title.slice(0, 60))}» — ${esc(twin.assignee ? personName(personById(twin.assignee)) : 'без исполнителя')}, ${STATUSES[twin.status].name.toLowerCase()}.`;
      });
      bind('#tmDesc', v => set({desc: v}));
      bind('#tmResult', v => set({result: v}));
      bind('#tmCreator', v => set({createdBy: v || null}, `Постановщик: ${v ? whoName(v) : '—'}`));
      bind('#tmWho', v => { const t = cur(), p = personById(v); set({assignee: v || null, ...(p && p.dir && !t.dir ? {dir: p.dir} : {})}, `Исполнитель: ${p ? personName(p) : 'не назначен'}`, {type: 'assign', to: [v]}); });
      bind('#tmDir', v => set({dir: v}));
      bind('#tmPrio', v => set({priority: v}, `Приоритет: ${PRIO[v].name.toLowerCase()}`));
      bind('#tmGoal', v => set({goalId: v || null}));
      bind('#tmStrat', v => set({stratId: v || null}));
      bind('#tmDue', v => {
        const t = cur(), patch = {due: v || null};
        if (v) { patch.month = monthOf(v); const mm = $('#tmMonth', el); if (mm) mm.value = monthOf(v); }
        if (!isNew && v && t.due && v > t.due) patch.postponeCount = (t.postponeCount || 0) + 1;
        set(patch, v ? `Срок: ${dayLong(v)}` : 'Срок снят');
      });
      bind('#tmMonth', v => {
        const t = cur(), patch = {month: v || null};
        if (t.due && monthOf(t.due) !== v) { patch.due = null; $('#tmDue', el).value = ''; }
        if (!isNew && v && t.month && v > t.month) patch.postponeCount = (t.postponeCount || 0) + 1;
        set(patch, v ? `Перенесено на ${monthName(v).toLowerCase()}` : 'Срок снят');
      });

      /* бюджет */
      const setBudget = (amount) => {
        const t = cur(), patch = {budget: Math.max(0, Math.round(amount))};
        const force = !Auth.can('money.edit');
        if (force && patch.budget > 0) patch.budgetNeedsApproval = true;
        const needs = patch.budgetNeedsApproval ?? t.budgetNeedsApproval;
        let log = patch.budget ? `Бюджет: ${rub(patch.budget)}` : 'Бюджет снят', ev = null;
        if (needs && patch.budget > 0 && !Tasks.canApproveBudget(t)) {
          Object.assign(patch, {budgetApproved: false, budgetRejected: false});
          ev = {type: 'budget', to: [Tasks.budgetApprover(t)]};
          log = `${me()}: просит согласовать бюджет ${rubK(patch.budget)}`;
        }
        set(patch, log, ev);
      };
      on(el, 'click', '[data-bq]', (e, b) => setBudget(Number(b.dataset.bq)));
      on(el, 'change', '#tmBudget', (e, i) => setBudget(parseNum(i.value)));
      on(el, 'change', '#tmBudgetCat', (e, i) => set({budgetCat: i.value}));
      on(el, 'change', '#tmBudgetAppr', (e, i) => {
        const t = cur();
        if (!i.checked && !Auth.can('money.edit')) { i.checked = true; toast('Бюджет от сотрудника всегда идёт на согласование'); return; }
        const patch = {budgetNeedsApproval: i.checked, budgetApproved: false, budgetRejected: false};
        const pending = i.checked && Number(t.budget) > 0;
        set(patch, i.checked ? (pending ? `${me()}: просит согласовать бюджет ${rubK(t.budget)}` : 'Бюджет — с согласованием') : 'Бюджет — без согласования', pending ? {type: 'budget', to: [Tasks.budgetApprover(t)]} : null);
      });
      on(el, 'change', '#tmBudgetWho', (e, i) => {
        const t = cur();
        set({budgetApprover: i.value, budgetApproved: false, budgetRejected: false}, `Бюджет согласует: ${whoName(i.value)}`, Number(t.budget) > 0 ? {type: 'budget', to: [i.value]} : null);
      });
      on(el, 'click', '[data-budget-ok]', (e, b) => { approveBudget(cur(), b.dataset.budgetOk === '1'); });

      /* приёмка результата */
      on(el, 'change', '#tmAppr', (e, i) => {
        const t = cur();
        const ap = t.approver || (t.createdBy && t.createdBy !== t.assignee ? t.createdBy : founderId());
        set(i.checked ? {approval: true, approver: ap && ap !== t.assignee ? ap : null} : {approval: false}, i.checked ? `Результат согласует: ${whoName(ap)}` : 'Результат — без согласования');
      });
      on(el, 'change', '#tmApprWho', (e, i) => set({approval: true, approver: i.value}, `Результат согласует: ${whoName(i.value)}`, cur().status === 'review' ? {type: 'review', to: [i.value]} : null));

      /* зависимости */
      on(el, 'change', '#tmDepAdd', (e, i) => {
        if (!i.value) return;
        const t = cur();
        set({blockedBy: [...new Set([...(t.blockedBy || []), i.value])]}, `Зависит от: «${(Tasks.get(i.value) || {}).title || ''}»`);
      });
      on(el, 'click', '[data-dep-rm]', (e, b) => { const t = cur(); set({blockedBy: (t.blockedBy || []).filter(x => x !== b.dataset.depRm)}, 'Зависимость снята'); });
      on(el, 'click', '[data-dep-open]', (e, b) => { close(); openTask(b.dataset.depOpen); });

      /* статус */
      on(el, 'click', '[data-st]', (e, b) => {
        const t = cur(), st = b.dataset.st;
        const out = $('#tmOutcome', el);
        if (out && out.value !== (t.outcome || '')) Store.patch('tasks', id, {outcome: out.value}, {mustExist: true});
        if (st === 'return-open') { $('#tmRetWrap', el).hidden = false; b.hidden = true; $('#tmRetText', el).focus(); return; }
        if (st === 'return') {
          const box = $('#tmRetText', el);
          if (!box.value.trim()) { box.focus(); box.classList.add('need'); box.placeholder = 'Без комментария вернуть нельзя: что доработать?'; return; }
          Tasks.giveBack(t, box.value);
          toast('Возвращено на доработку — исполнитель увидит комментарий');
          return;
        }
        if (st === 'accept') { Tasks.setStatus(t, 'done'); toast('Согласовано, задача закрыта'); return; }
        if (st === 'finish') { Tasks.apply(t, 'done'); return; }
        Tasks.apply(t, st);
      });
      on(el, 'change', '#tmOutcome', (e, i) => set({outcome: i.value}));

      if (isNew) {
        $('#tmCreate', el).onclick = () => {
          const title = $('#tmTitle', el).value.trim();
          if (!title) { $('#tmTitle', el).focus(); return; }
          const twin = Tasks.twin(title);
          const btn = $('#tmCreate', el);
          if (twin && !btn.dataset.force) { btn.dataset.force = '1'; btn.textContent = 'Всё равно создать'; $('#tmTwin', el).hidden = false; return; }
          const d = {...draft};
          ['#tmDesc', '#tmResult'].forEach((s2, i2) => { d[['desc', 'result'][i2]] = $(s2, el).value; });
          Tasks.create({...d, title, force: !!btn.dataset.force, assignee: $('#tmWho', el).value || null, due: $('#tmDue', el).value || null, month: $('#tmMonth', el).value || null,
            dir: $('#tmDir', el).value, priority: $('#tmPrio', el).value, goalId: $('#tmGoal', el).value || null, stratId: $('#tmStrat', el) ? $('#tmStrat', el).value || null : null,
            createdBy: draft.createdBy || undefined});
          close();
          toast('Задача создана');
        };
      } else {
        const cf = $('#tmCForm', el);
        cf.onsubmit = e => {
          e.preventDefault();
          const box = $('#tmComment', el);
          if (!box.value.trim()) return;
          Tasks.comment(cur(), box.value);
          box.value = '';
        };
        $('#tmComment', el).addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) cf.requestSubmit(); });
        const del = $('#tmDel', el);
        if (del) del.onclick = () => Tasks.remove(cur(), del).then(ok => { if (ok) close(); });
      }

      /* перерисовка живых частей: не трогаем поле, в котором человек печатает,
         и ждём, пока отпустят кнопку мыши, — иначе нажатие «Отправить» сразу
         после ввода текста уходит в пустоту */
      let waiting = false;
      function paint() {
        if (App._pointer) {
          if (!waiting) { waiting = true; document.addEventListener('pointerup', () => { waiting = false; setTimeout(paint, 0); }, {once: true, capture: true}); }
          return;
        }
        const t = cur();
        if (!t) { close(); toast('Задачу удалили'); return; }
        const inside = box => box && box.contains(document.activeElement) && document.activeElement.matches('input:not([type=checkbox]), textarea');
        $('#tmTop', el).innerHTML = topHtml(t, isNew);
        const bb = $('#tmBudgetBox', el); if (!inside(bb)) bb.innerHTML = budgetHtml(t, can, isNew);
        const ab = $('#tmApprBox', el); if (!inside(ab)) ab.innerHTML = approvalHtml(t, can);
        if (!isNew) {
          const db = $('#tmDepsBox', el); if (!inside(db)) db.innerHTML = depsHtml(t, can);
          /* блок статуса пересобираем только при смене состояния; текст результата — на месте */
          const z = $('#tmZone', el), ret = lastReturn(t);
          const zk = [t.status, Tasks.approver(t), Tasks.canJudge(t), can, ret ? ret.at : 0, t.submittedAt || 0, t.acceptedBy || '', t.status === 'done' || t.status === 'review' ? t.outcome : ''].join('|');
          if (z.dataset.k !== zk && !inside(z)) { z.innerHTML = zoneHtml(t, can); z.dataset.k = zk; }
          else { const o = $('#tmOutcome', z); if (o && document.activeElement !== o && o.value !== (t.outcome || '')) o.value = t.outcome || ''; }
          paintThread($('#tmThread', el), t, document.activeElement && document.activeElement.id === 'tmComment');
          if (opts.focus === 'return' && t.status === 'review' && Tasks.canJudge(t)) {
            opts.focus = null;
            const b = $('[data-st="return-open"]', el); if (b) b.click();
          }
          const w = $('#tmWho', el); if (w && document.activeElement !== w) w.value = t.assignee || '';
        }
      }
      paint();
      if (!isNew) unsub = Store.subscribe(c => { if (c === 'tasks' || c === 'people') paint(); });
    },
    onClose() { if (unsub) unsub(); },
  });
}

function topHtml(t, isNew) {
  const code = DIR_CODE[t.dir];
  const blocked = !isNew && Tasks.blocked(t);
  const steps = Object.entries(STATUSES).map(([k, s]) => `<span class="st-step ${k === t.status ? 'on ' + s.tone : ''}">${s.name}</span>`).join('<i></i>');
  return `${code ? `<span class="kc-dir lg" style="--c:${DIRS[t.dir].color}">${code}</span>` : '<span class="kc-dir lg none">—</span>'}
    <span class="tm-dirn">${t.dir ? esc(dirName(t.dir)) : 'Без направления'}</span>
    ${blocked ? '<span class="pill bad">🔒 ждёт другую задачу</span>' : ''}
    ${escDots(t)}
    ${isNew ? '' : `<span class="tm-steps st-steps">${steps}</span>`}`;
}
function budgetHtml(t, can, isNew) {
  const st = Tasks.budgetState(t), amount = Number(t.budget) || 0;
  const force = !Auth.can('money.edit');
  const needs = !!t.budgetNeedsApproval || (force && amount > 0);
  const m = Tasks.budgetMonth(t), inPlan = CF_MONTHS.includes(m);
  const cat = t.id ? Tasks.budgetCat(t) : (t.budgetCat || DIR_CAT[t.dir] || 'other');
  const note = st === 'none' ? `Выберите сумму — ${needs ? 'после согласования она встанет' : 'она встанет'} разовым платежом в план платежей, в месяц задачи.`
    : st === 'pending' ? `Ждёт согласования: <b>${esc(whoName(Tasks.budgetApprover(t)))}</b>. В план платежей попадёт после согласования.`
    : st === 'rejected' ? 'Бюджет не согласован — поправьте сумму, и он снова уйдёт на согласование.'
    : `В плане платежей: разовый платёж <b>${rub(amount)}</b> за <b>${monthName(m, true).toLowerCase()}</b> — строка «Задача: ${esc(t.title)}». Правка суммы или срока обновит ту же строку, второй не появится.${inPlan ? '' : ' Месяц вне плана до Нового года — в Cash Flow не попадёт.'}`;
  const approvers = [...new Set([founderId(), ...people().filter(p => (Store.all('accounts').find(a => a.personId === p.id && ['owner', 'lead'].includes(a.role)))).map(p => p.id)])].filter(Boolean);
  return `<p class="tm-box-l">Бюджет задачи</p>
    <div class="tm-bq">${BUDGET_QUICK.map(v => `<button type="button" class="tm-chip ${amount === v ? 'on' : ''}" data-bq="${v}" ${can ? '' : 'disabled'}>${v ? fmt(v / 1000) + ' тыс ₽' : '0'}</button>`).join('')}</div>
    <div class="tm-brow">
      <label class="tm-f"><span>Или своя сумма, ₽</span><input class="input num" id="tmBudget" inputmode="numeric" value="${amount ? fmt(amount) : ''}" placeholder="0" ${can ? '' : 'disabled'}></label>
      <label class="tm-f"><span>Статья расходов</span><select class="select" id="tmBudgetCat" ${can ? '' : 'disabled'}>${Object.entries(OUT_CATS).filter(([k]) => k !== 'payroll').map(([k, n]) => `<option value="${k}" ${k === cat ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    </div>
    <div class="tm-note">${note}</div>
    <div class="tm-appr-row">
      <label class="check"><input type="checkbox" id="tmBudgetAppr" ${needs ? 'checked' : ''} ${can ? '' : 'disabled'}> Требует согласования</label>
      ${needs ? `<select class="select sm" id="tmBudgetWho" ${can ? '' : 'disabled'}>${approvers.map(pid => `<option value="${pid}" ${pid === Tasks.budgetApprover(t) ? 'selected' : ''}>Кому: ${esc(whoName(pid))}</option>`).join('')}</select>` : ''}
      ${st === 'approved' ? `<span class="pill good">✓ согласовано${t.budgetApprovedBy ? ': ' + esc(whoFirst(t.budgetApprovedBy)) : ''}</span>` : st === 'pending' ? '<span class="pill warn">ждёт согласования</span>' : st === 'rejected' ? '<span class="pill bad">не согласовано</span>' : ''}
      ${!isNew && (st === 'pending' || st === 'rejected') && Tasks.canApproveBudget(t) ? `<button type="button" class="btn sm good" data-budget-ok="1">${icon('tick')}Согласовать бюджет</button>${st === 'pending' ? '<button type="button" class="btn sm ghost" data-budget-ok="0">Не согласовывать</button>' : ''}` : ''}
    </div>
    ${force && can ? '<p class="note">Бюджет, который ставит сотрудник, всегда идёт на согласование.</p>' : ''}`;
}
function approvalHtml(t, can) {
  const ap = Tasks.approver(t);
  const opts = people().filter(p => p.id !== t.assignee);
  return `<p class="tm-box-l">Приёмка результата</p>
    <div class="tm-appr-row">
      <label class="check"><input type="checkbox" id="tmAppr" ${ap ? 'checked' : ''} ${can ? '' : 'disabled'}> Результат согласовывает</label>
      ${ap || t.approval === true ? `<select class="select sm" id="tmApprWho" ${can ? '' : 'disabled'}>${opts.map(p => `<option value="${p.id}" ${p.id === ap ? 'selected' : ''}>${esc(personName(p))}</option>`).join('')}</select>` : ''}
    </div>
    <p class="note">${ap ? `Когда исполнитель нажмёт «Готово», задача уйдёт ${esc(whoName(ap))} на согласование — он согласует или вернёт с комментарием.` : 'Без галочки исполнитель закрывает задачу сам.'}</p>`;
}
function depsHtml(t, can) {
  const bl = Tasks.blockers(t), dep = Tasks.dependents(t);
  const exclude = new Set([t.id, ...(t.blockedBy || [])]);
  /* нельзя зависеть от задачи, которая сама ждёт эту — иначе круг */
  const walk = x => Tasks.dependents(x).forEach(d => { if (!exclude.has(d.id)) { exclude.add(d.id); walk(d); } });
  walk(t);
  const addable = Tasks.all().filter(x => !exclude.has(x.id) && x.status !== 'done').sort((a, b) => a.title.localeCompare(b.title, 'ru'));
  return `<p class="tm-box-l">Зависит от ${Tasks.blocked(t) ? '· <span class="bad">🔒 заблокирована</span>' : bl.length ? '· 🔓 можно делать' : ''}</p>
    ${bl.length ? bl.map(b => `<div class="tm-dep"><span class="pill ${STATUSES[b.status].tone}">${STATUSES[b.status].name}</span><button type="button" class="link-btn" data-dep-open="${b.id}">${esc(b.title)}</button>${can ? `<button type="button" class="icon-btn" data-dep-rm="${b.id}" title="Убрать зависимость">${icon('x')}</button>` : ''}</div>`).join('') : '<p class="note">Ни от чего не зависит.</p>'}
    ${can ? `<select class="select sm" id="tmDepAdd"><option value="">+ Добавить задачу, которую надо сделать раньше…</option>${addable.map(x => `<option value="${x.id}">${esc(x.title.slice(0, 90))}</option>`).join('')}</select>` : ''}
    ${dep.length ? `<p class="note">От этой задачи зависят: ${dep.map(d => `<button type="button" class="link-btn" data-dep-open="${d.id}">${esc(d.title.slice(0, 50))}</button>`).join(', ')} — когда она будет готова, их исполнители получат «можно начинать».</p>` : ''}`;
}
function zoneHtml(t, can) {
  const ap = Tasks.approver(t), judge = Tasks.canJudge(t);
  const out = t.outcome ? `<div class="tm-outcome"><span>Результат работы</span><p>${esc(t.outcome)}</p></div>` : '';
  if (t.status === 'todo' || t.status === 'doing') {
    const ret = lastReturn(t);
    const returned = ret && t.reworkCount && (!t.submittedAt || ret.at > t.submittedAt);
    return `${returned ? `<div class="tm-returned"><b>Возвращено на доработку</b> — ${esc(whoFirst(ret.by))}, ${timeAgo(ret.at)}:<p>${esc(ret.text)}</p></div>` : ''}
      <p class="tm-zone-note">${ap ? `Отвечает ${esc(t.assignee ? whoName(t.assignee) : 'исполнитель')}, результат принимает <b>${esc(whoName(ap))}</b>.` : 'Задачу закрывает сам исполнитель.'}</p>
      <label class="tm-f"><span>Результат работы — ссылка, документ, скрин или текст</span><textarea class="textarea" id="tmOutcome" rows="2" ${can ? '' : 'disabled'} placeholder="Вставьте ссылку или опишите, что сделано и что проверить">${esc(t.outcome || '')}</textarea></label>
      ${can ? `<div class="tm-zone-btns">${t.status === 'todo' ? '<button type="button" class="btn" data-st="doing">◐ В работу</button>' : ''}<button type="button" class="btn primary" data-st="finish">${ap && !judge ? (returned ? 'Отправить повторно на согласование →' : 'Отправить на согласование →') : '✓ Готово'}</button></div>` : ''}`;
  }
  if (t.status === 'review') {
    return `<p class="tm-zone-note gold">Согласовывает: <b>${esc(whoName(ap || founderId()))}</b>${t.submittedAt ? ` · сдано ${timeAgo(t.submittedAt)}` : ''}</p>
      ${out || '<p class="note">Результат работы не приложен.</p>'}
      ${judge ? `<div class="tm-zone-btns"><button type="button" class="btn good" data-st="accept">${icon('tick')}Согласовать</button><button type="button" class="btn" data-st="return-open">↩ Вернуть на доработку</button></div>
        <div id="tmRetWrap" class="tm-ret" hidden><textarea class="textarea" id="tmRetText" rows="2" placeholder="Что нужно доработать?"></textarea><button type="button" class="btn danger" data-st="return">Подтвердить возврат</button></div>`
      : can ? '<div class="tm-zone-btns"><button type="button" class="btn" data-st="doing">Забрать обратно в работу</button></div>' : ''}`;
  }
  return `<p class="tm-zone-note good">✓ ${t.acceptedBy ? `Согласовано: ${esc(whoFirst(t.acceptedBy))}` : 'Готово'}${t.doneAt ? ` · ${dayLong(isoOf(new Date(t.doneAt)))}` : ''}</p>
    ${out}
    ${can ? '<div class="tm-zone-btns"><button type="button" class="btn" data-st="doing">Вернуть в работу</button></div>' : ''}`;
}
function paintThread(box, t, keepScroll) {
  if (!box) return;
  const list = Object.entries(t.comments || {}).map(([cid, c]) => ({cid, ...c})).sort((a, b) => a.at - b.at);
  if (!list.length) { box.innerHTML = '<p class="note">Пока пусто. Вопросы и договорённости по задаче пишите здесь — их увидят исполнитель и постановщик.</p>'; return; }
  box.innerHTML = list.map(c => {
    const p = personById(c.by);
    if (c.kind === 'system') return `<div class="th-sys"><span>${esc(c.text)}</span><time>${timeAgo(c.at)}</time></div>`;
    return `<div class="th-msg ${c.kind === 'return' ? 'ret' : ''}">${avatar(p)}<div><div class="th-h"><b>${esc(p ? personName(p) : whoName(c.by))}</b><time>${timeAgo(c.at)}</time>${c.kind === 'return' ? '<span class="pill bad">вернул(а) на доработку</span>' : ''}</div><p></p></div></div>`;
  }).join('');
  /* текст комментариев — только через textContent */
  const msgs = list.filter(c => c.kind !== 'system');
  $$('.th-msg p', box).forEach((pEl, i) => { pEl.textContent = msgs[i].text; });
  if (!keepScroll) box.scrollTop = box.scrollHeight;
}
