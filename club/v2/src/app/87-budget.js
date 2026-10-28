/* Бюджетирование: свод бюджета по направлениям и отделам, разовые заявки на финансирование,
   бюджеты направлений на месяц, квартал и год, бюджетный календарь и правила.

   Заявку подаёт любой из команды — под задачу, проект, направление, мероприятие или новую идею —
   по единой форме: на что и сколько, обоснование затрат, что получим, чем это нужно бизнесу.
   Бюджет направления (или отдела) готовит его ответственный к сроку бюджетного календаря.
   Кто согласует и в каком порядке — Flow (server/lib/flow.js): тот же файл проверяет сервер,
   поэтому кнопки «Согласовать» видит только тот, чья очередь, а чужое решение сервер не примет.
   Согласованная заявка сама встаёт в план платежей (это делает сервер), там её и оплачивают.

   Свод: утверждённый бюджет месяца — самый подробный из утверждённых (месяц, иначе треть квартала,
   иначе двенадцатая часть года) + согласованные разовые заявки = план; факт — расходы из журнала:
   направление берём у строки плана, которую оплатили (заявка, задача) или у самой операции. */

const FR_KINDS = {task: 'Задача', project: 'Проект', dir: 'Направление', event: 'Мероприятие', idea: 'Новая идея', other: 'Другое'};
const FR_TAGS = ['маркетинг', 'контент', 'съёмки', 'мероприятие', 'продукт', 'сервисы', 'команда', 'обучение', 'партнёры', 'эксперимент', 'экономия', 'срочно'];
const FLOW_ST = {
  draft: {name: 'Черновик', tone: 'line'}, review: {name: 'На согласовании', tone: 'gold'}, revise: {name: 'На доработке', tone: 'warn'},
  approved: {name: 'Согласовано', tone: 'good'}, rejected: {name: 'Отказ', tone: 'bad'}, withdrawn: {name: 'Отозвано', tone: 'line'},
};
const FLOW_VERB = {ok: 'согласовал(а)', revise: 'вернул(а) на доработку', no: 'отказал(а)'};
/* сколько дней даём на решение каждому шагу — дольше подсвечиваем */
const FLOW_SLA = {cfo: 2, ceo: 2, board: 5};
const PTYPES = {month: 'Месяц', quarter: 'Квартал', year: 'Год'};
const QROMAN = ['I', 'II', 'III', 'IV'];
const qOf = m => `${m.slice(0, 4)}-Q${Math.floor(monthIdx(m) / 3) + 1}`;
function periodName(pt, p) {
  if (pt === 'year') return `${p} год`;
  if (pt === 'quarter') return `${QROMAN[Number(p.slice(6)) - 1]} квартал ${p.slice(0, 4)}`;
  return monthName(p, true);
}
function periodShift(pt, p, n) {
  if (pt === 'year') return String(Number(p) + n);
  if (pt === 'quarter') { const i = Number(p.slice(0, 4)) * 4 + Number(p.slice(6)) - 1 + n; return `${Math.floor(i / 4)}-Q${i % 4 + 1}`; }
  return addMonths(p, n);
}
const periodNow = pt => (pt === 'year' ? today().slice(0, 4) : pt === 'quarter' ? qOf(monthOf(today())) : monthOf(today()));
const budTotal = d => sum(d.lines || [], l => l.amount);

const Budget = {
  _who: null,
  me() { return Tasks.meKey(); },
  set() { return Flow.cfg(settings().budget); },
  who() { return this._who || (this._who = Flow.people(settings().budget, Store.all('accounts'), Store.all('people'))); },
  state(d) { return Flow.state(d, this.who(), settings().budget); },
  reqs() { return Store.all('fundreqs').filter(x => x.title).sort((a, b) => (b.sentAt || b.at || 0) - (a.sentAt || a.at || 0)); },
  budgets() { return Store.all('budgets').filter(x => x.period && x.ptype); },
  depts() { return ((settings().budget || {}).depts || []).filter(d => d && d.id && d.name); },
  deptName(id) { const d = this.depts().find(x => x.id === id); return d ? d.name : id ? 'Отдел' : ''; },
  head(dir, dept) { const b = settings().budget || {}; return dept ? (this.depts().find(x => x.id === dept) || {}).head || null : (b.heads || {})[dir] || null; },
  scopeName(dir, dept) { return [dirName(dir), dept ? this.deptName(dept) : ''].filter(Boolean).join(' · '); },
  amount(d) { return d.ptype ? budTotal(d) : Number(d.amount) || 0; },
  lastAt(d) { return Math.max(d.sentAt || 0, ...Object.values(d.decisions || {}).map(x => x.at || 0)); },
  /* сколько ждёт на текущем шаге: с отправки или с последнего решения этого круга */
  waitDays(d) { const st = this.state(d); if (st.status !== 'review') return 0; return Math.floor((Date.now() - this.lastAt(d)) / 864e5); },
  waitingMe() { const me = this.me(); return [...this.reqs(), ...this.budgets()].filter(d => this.state(d).waiting.includes(me)); },
  mineBack() { const me = this.me(); return [...this.reqs(), ...this.budgets()].filter(d => d.by === me && this.state(d).status === 'revise'); },
  badge() { return Auth.me() ? this.waitingMe().length + this.mineBack().length : 0; },
  col(d) { return d.ptype ? 'budgets' : 'fundreqs'; },

  decide(d, verdict, note) {
    const st = this.state(d), x = {by: this.me(), step: st.step, verdict, round: d.round, at: Date.now(), ...(note ? {note} : {})}, k = uid();
    Store.patch(this.col(d), d.id, {decisions: {[k]: x}, upd: Date.now()}, {mustExist: true});
    const next = this.state({...d, decisions: {...(d.decisions || {}), [k]: x}});
    if (verdict !== 'ok') toast(verdict === 'revise' ? 'Вернули на доработку — автор увидит комментарий' : 'Отказ записан — автор увидит причину');
    else if (next.status === 'approved') toast(d.ptype ? 'Бюджет утверждён' : 'Согласовано — сумма встанет в план платежей');
    else toast(`Ваше «да» записано. Дальше решает: ${next.waiting.map(whoFirst).join(', ') || Flow.STEPS[next.step]}`);
  },
  /* кто будет решать первым, когда отправим */
  firstUp(d) { const st = this.state({...d, sentAt: 1, round: (Number(d.round) || 0) + 1}); return st.waiting.map(whoFirst).join(', ') || 'финдиректор'; },
  send(d) {
    Store.patch(this.col(d), d.id, {sentAt: Date.now(), round: (Number(d.round) || 0) + 1, upd: Date.now()}, {mustExist: true});
    toast(`Отправлено — решает ${this.firstUp(d)}`);
  },
  withdraw(d) { Store.patch(this.col(d), d.id, {withdrawn: true, upd: Date.now()}, {mustExist: true}); toast('Отозвано'); },

  /* утверждённый бюджет месяца направления (отдела): месяц, иначе треть квартала, иначе двенадцатая часть года */
  monthBudget(m, dir, dept) {
    for (const [id, k, src] of [[Flow.budgetId(m, dir, dept), 1, 'month'], [Flow.budgetId(qOf(m), dir, dept), 1 / 3, 'quarter'], [Flow.budgetId(m.slice(0, 4), dir, dept), 1 / 12, 'year']]) {
      const d = Store.get('budgets', id);
      if (!d || this.state(d).status !== 'approved') continue;
      const cats = {};
      (d.lines || []).forEach(l => { const c = l.cat || 'other'; cats[c] = (cats[c] || 0) + (Number(l.amount) || 0) * k; });
      return {sum: sum(Object.values(cats)), cats, src, doc: d};
    }
    return {sum: 0, cats: {}, src: null, doc: null};
  },
  /* направление операции из журнала: своё, иначе у строки плана, которую ею оплатили */
  factScope(e) {
    if (e.dir) return {dir: e.dir, dept: e.dept || ''};
    const pl = e.planId ? Store.get('plan', e.planId) : null;
    if (pl && pl.reqId) { const q = Store.get('fundreqs', pl.reqId); if (q) return {dir: q.dir || '', dept: q.dept || ''}; }
    if (pl && pl.dir) return {dir: pl.dir, dept: ''};
    const t = pl && pl.taskId ? Store.get('tasks', pl.taskId) : null;
    return {dir: (t && t.dir) || '', dept: ''};
  },
  /* свод периода: по направлению и отделу — бюджет, разовые, факт, что на согласовании; и по статьям */
  summary(pt, p) {
    const ms = Flow.months(pt, p), rows = {}, cats = {};
    const row = (dir, dept) => rows[`${dir || ''}|${dept || ''}`] || (rows[`${dir || ''}|${dept || ''}`] = {dir: dir || '', dept: dept || '', bud: 0, req: 0, fact: 0, pend: 0, src: new Set()});
    const cat = c => cats[c] || (cats[c] = {bud: 0, req: 0, plan: 0, fact: 0});
    Object.keys(DIRS).forEach(dir => [['', null], ...this.depts().filter(x => x.dir === dir).map(x => [x.id])].forEach(([dept]) => ms.forEach(m => {
      const b = this.monthBudget(m, dir, dept || '');
      if (!b.sum) return;
      const r = row(dir, dept);
      r.bud += b.sum;
      r.src.add(b.src);
      Object.entries(b.cats).forEach(([c, v]) => { cat(c).bud += v; });
    })));
    this.budgets().forEach(b => { if (b.ptype === pt && b.period === p && this.state(b).status === 'review') row(b.dir, b.dept).pend += budTotal(b); });
    this.reqs().forEach(q => {
      if (!ms.includes(q.month)) return;
      const st = this.state(q).status, a = Number(q.amount) || 0;
      if (st === 'approved') { row(q.dir, q.dept).req += a; cat(q.cat || 'other').req += a; }
      if (st === 'review') row(q.dir, q.dept).pend += a;
    });
    Store.all('ledger').forEach(e => {
      if (e.kind !== 'out' || !ms.includes(monthOf(e.date))) return;
      const s = this.factScope(e), a = Number(e.amount) || 0;
      row(s.dir, s.dept).fact += a;
      cat(e.cat || 'other').fact += a;
    });
    ms.forEach(m => Object.entries(Money.planByCat(m).all).forEach(([c, v]) => { cat(c).plan += v; }));
    return {ms, rows: Object.values(rows), cats};
  },
  /* бюджетный календарь: ближайшие два месяца, следующий квартал и следующий год */
  calendar() {
    const m = monthOf(today());
    return [['month', addMonths(m, 1)], ['month', addMonths(m, 2)], ['quarter', periodShift('quarter', qOf(m), 1)], ['year', String(Number(m.slice(0, 4)) + 1)]]
      .map(([pt, p]) => ({pt, p, due: Flow.deadline(pt, p)})).sort((a, b) => a.due.localeCompare(b.due));
  },
  scopes() {
    return Object.keys(DIRS).flatMap(dir => [{dir, dept: ''}, ...this.depts().filter(x => x.dir === dir).map(x => ({dir, dept: x.id}))]);
  },
  /* сдан ли бюджет на период: свой документ, а у отдела без своего — бюджет всего направления */
  sent(d) { return !!d && !['draft', 'withdrawn'].includes(this.state(d).status); },
  missing(pt, p, sc) {
    const own = Store.get('budgets', Flow.budgetId(p, sc.dir, sc.dept));
    if (this.sent(own)) return false;
    return !(sc.dept && !own && this.sent(Store.get('budgets', Flow.budgetId(p, sc.dir, ''))));
  },
};
Store.subscribe(c => { if (['accounts', 'people', 'docs'].includes(c)) Budget._who = null; });

/* ── маленькие куски разметки ── */
const flowPill = st => `<span class="pill ${FLOW_ST[st.status].tone}">${FLOW_ST[st.status].name}</span>`;
function flowRoute(d, st) {
  const who = Budget.who();
  return `<div class="fl-route">${st.route.map(step => {
    const done = !!st.done[step], cur = st.step === step && st.status !== 'approved';
    const names = Flow.deciders(step, who, d.by).map(whoFirst);
    const tone = done ? 'good' : cur ? FLOW_ST[st.status].tone : '';
    return `<span class="fl-step ${tone}" title="${esc(names.join(', ') || 'не выбран — настройте в «Календарь и правила»')}"><b>${done ? '✓' : cur ? '●' : '○'} ${Flow.STEPS[step]}</b><small>${esc(step === 'board' ? `${names.length} ${plural(names.length, 'человек', 'человека', 'человек')}` : names[0] || 'не выбран')}</small></span>`;
  }).join('<i class="fl-arr">→</i>')}</div>`;
}
function flowHistory(d) {
  const list = Object.values(d.decisions || {}).sort((a, b) => (a.at || 0) - (b.at || 0));
  if (!list.length) return '';
  return `<div class="fl-hist"><span class="label">История решений</span>${list.map(x => `<div class="fl-h ${x.verdict}">
      <b>${esc(whoName(x.by))}</b> · ${Flow.STEPS[x.step] || ''}${(d.round || 0) > 1 ? ` · круг ${x.round}` : ''} — ${FLOW_VERB[x.verdict] || ''}<small>${timeAgo(x.at)}</small>
      ${x.note ? `<p>${esc(x.note)}</p>` : ''}</div>`).join('')}</div>`;
}
/* ждёт решения дольше, чем положено на шаг, — подсветим */
function flowWait(d, st) {
  if (st.status !== 'review') return '';
  const n = Budget.waitDays(d), late = n > (FLOW_SLA[st.step] || 2);
  const names = st.waiting.map(whoFirst).join(', ');
  return `<span class="fl-wait ${late ? 'late' : ''}">ждём: ${esc(names || '—')}${n ? ` · ${n} ${plural(n, 'день', 'дня', 'дней')}` : ''}</span>`;
}
const flowText = (label, v) => (String(v || '').trim() ? `<div class="fl-text"><span class="label">${label}</span><p>${esc(v).replace(/\n/g, '<br>')}</p></div>` : '');

/* ── страница ── */
const BG_TABS = [['sum', 'Свод', 'money.view'], ['reqs', 'Заявки'], ['plans', 'Бюджеты направлений'], ['rules', 'Календарь и правила']];
App.register('budget', {
  title: 'Бюджетирование',
  render(root, param) {
    const tabs = BG_TABS.filter(t => !t[2] || Auth.can(t[2]));
    if (param && App.cur !== 'budget:' + param && tabs.some(t => t[0] === param)) View.set('bg.tab', param);
    let tab = View.get('bg.tab', tabs[0][0]);
    if (!tabs.some(t => t[0] === tab)) tab = tabs[0][0];
    const wait = Budget.waitingMe(), back = Budget.mineBack();
    const nOf = isBud => wait.filter(d => !!d.ptype === isBud).length + back.filter(d => !!d.ptype === isBud).length;
    const badge = {reqs: nOf(false), plans: nOf(true)};
    const body = {sum: bgSumHtml, reqs: bgReqsHtml, plans: bgPlansHtml, rules: bgRulesHtml}[tab]();
    root.innerHTML = `
      ${pageHead('Бюджетирование', 'Свод бюджета по направлениям и отделам, заявки на финансирование и бюджеты на месяц, квартал и год — с согласованием.', `<button class="btn primary sm" id="bgNewReq">${icon('plus')}Заявка на финансирование</button>`)}
      ${helpBox('budget', `<b>Как устроено бюджетирование.</b> Нужны деньги на задачу, проект, мероприятие или новую идею — нажмите «Заявка на финансирование» и заполните одну форму: сколько, на что, что получим и чем это нужно бизнесу. Заявка уходит финдиректору: до ${money(Budget.set().cfoLimit)} он решает сам, до ${money(Budget.set().ceoLimit)} — ещё гендиректор, дороже — ещё акционеры. Ответ — «Согласовать», «На доработку» с комментарием или «Отказать». Согласованная сумма сама встаёт в план платежей. Бюджеты направлений сдают по календарю: на год — за месяц, на квартал — за две недели, на месяц — за неделю до начала.`)}
      ${wait.length ? `<div class="card bg-wait"><b>${icon('bell')}Ждут вашего решения: ${wait.length}</b><div class="bg-wait-list">${wait.slice(0, 6).map(d => `<button class="chip" data-flow="${Budget.col(d)}:${d.id}">${esc(d.ptype ? `Бюджет: ${Budget.scopeName(d.dir, d.dept)}, ${periodName(d.ptype, d.period)}` : d.title)} · ${money(Budget.amount(d))}</button>`).join('')}</div></div>` : ''}
      ${back.length ? `<div class="card bg-wait back"><b>${icon('undo')}Вернули вам на доработку: ${back.length}</b><div class="bg-wait-list">${back.map(d => `<button class="chip" data-flow="${Budget.col(d)}:${d.id}">${esc(d.ptype ? `Бюджет: ${Budget.scopeName(d.dir, d.dept)}, ${periodName(d.ptype, d.period)}` : d.title)}</button>`).join('')}</div></div>` : ''}
      <div class="tabs bg-tabs" role="tablist">${tabs.map(([k, n]) => `<button type="button" role="tab" data-bgtab="${k}" class="${k === tab ? 'on' : ''}">${n}${badge[k] ? ` <span class="n fin-n">${badge[k]}</span>` : ''}</button>`).join('')}</div>
      <div id="bgView" data-tab="${tab}">${body}</div>`;
    wireHelp(root);
    on(root, 'click', '[data-bgtab]', (e, el) => { View.set('bg.tab', el.dataset.bgtab); App.render(); });
    on(root, 'click', '[data-flow]', (e, el) => { const [c, id] = el.dataset.flow.split(':'); openFlow(Store.get(c, id)); });
    on(root, 'keydown', '[data-flow]', (e, el) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === el && el.tagName !== 'BUTTON') { e.preventDefault(); el.click(); } });
    $('#bgNewReq', root).onclick = () => editReq(null);
    ({sum: wireBgSum, reqs: wireBgReqs, plans: wireBgPlans, rules: wireBgRules}[tab])(root);
  },
});
function openFlow(d) { if (d) (d.ptype ? openBud : openReq)(d.id); }

/* ── свод ── */
function bgPeriodBar(key) {
  const pt = View.get(key + '.pt', 'month'), p = View.get(`${key}.p.${pt}`, periodNow(pt));
  return {pt, p, html: `<div class="bg-period">
      <div class="seg">${Object.entries(PTYPES).map(([k, n]) => `<button type="button" data-bgpt="${k}" class="${k === pt ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div class="bg-nav"><button class="icon-btn" data-bgp="-1" aria-label="Раньше">${icon('back')}</button><b>${periodName(pt, p)}</b><button class="icon-btn flip" data-bgp="1" aria-label="Позже">${icon('back')}</button>
        ${p !== periodNow(pt) ? '<button class="link-btn" data-bgp="0">сейчас</button>' : ''}</div></div>`};
}
function wireBgPeriod(root, key) {
  on(root, 'click', '[data-bgpt]', (e, el) => { View.set(key + '.pt', el.dataset.bgpt); App.render(); });
  on(root, 'click', '[data-bgp]', (e, el) => {
    const pt = View.get(key + '.pt', 'month'), n = Number(el.dataset.bgp);
    View.set(`${key}.p.${pt}`, n ? periodShift(pt, View.get(`${key}.p.${pt}`, periodNow(pt)), n) : periodNow(pt));
    App.render();
  });
}
function bgSumHtml() {
  const {pt, p, html} = bgPeriodBar('bg.sum');
  const s = Budget.summary(pt, p);
  const tot = {bud: sum(s.rows, r => r.bud), req: sum(s.rows, r => r.req), fact: sum(s.rows, r => r.fact), pend: sum(s.rows, r => r.pend)};
  const plan = tot.bud + tot.req;
  const SRC = {month: 'бюджет месяца', quarter: 'доля квартала', year: 'доля года'};
  const line = (r, sub) => {
    const pl = r.bud + r.req, left = pl - r.fact, share = pl ? r.fact / pl : 0;
    return `<tr class="${sub ? 'bg-sub' : 'bg-dir'}">
      <td>${sub ? `<span class="bg-indent">${esc(Budget.deptName(r.dept))}</span>` : r.dir ? `<i class="dot" style="background:${DIRS[r.dir].color}"></i><b>${dirName(r.dir)}</b>` : '<b>Без направления</b>'}
        ${!sub && r.src && r.src.size ? `<small class="note">${[...r.src].map(x => SRC[x]).join(', ')}</small>` : ''}</td>
      <td class="r">${r.bud ? money(r.bud) : '—'}</td><td class="r">${r.req ? money(r.req) : '—'}</td><td class="r"><b>${pl ? money(pl) : '—'}</b></td>
      <td class="r">${r.fact ? money(r.fact) : '—'}</td><td class="r ${left < 0 ? 'bad' : ''}">${pl || r.fact ? money(left) : '—'}</td>
      <td class="bg-bar-cell">${pl ? progress(Math.min(1, share), share > 1 ? 'bad' : share > 0.9 ? 'warn' : 'good') : ''}</td>
      <td class="r">${r.pend ? `<span class="gold">${money(r.pend)}</span>` : '—'}</td></tr>`;
  };
  const dirs = [...Object.keys(DIRS), ''];
  const body = dirs.map(dir => {
    const mine = s.rows.filter(r => r.dir === dir);
    if (!dir && !mine.length) return '';
    const agg = {dir, bud: sum(mine, r => r.bud), req: sum(mine, r => r.req), fact: sum(mine, r => r.fact), pend: sum(mine, r => r.pend), src: new Set(mine.flatMap(r => [...r.src]))};
    const subs = mine.filter(r => r.dept);
    return line(agg, false) + subs.map(r => line(r, true)).join('');
  }).join('');
  const catRows = Object.entries(s.cats).filter(([, v]) => v.bud || v.req || v.plan || v.fact).sort((a, b) => (b[1].bud + b[1].req) - (a[1].bud + a[1].req));
  const late = Budget.calendar().filter(c => c.due < today()).flatMap(c => Budget.scopes().filter(sc => Budget.missing(c.pt, c.p, sc))
    .map(sc => `${Budget.scopeName(sc.dir, sc.dept)} — ${periodName(c.pt, c.p).toLowerCase()}`));
  return `${html}
    <div class="cards tiles bg-kpi">
      ${finTile('Утверждённый бюджет', money(tot.bud), 'бюджеты направлений на период')}
      ${finTile('Разовые заявки', money(tot.req), 'согласованные сверх бюджетов')}
      ${finTile('План расходов', money(plan), 'бюджет + разовые')}
      ${finTile('Факт', `<span class="${tot.fact > plan && plan ? 'bad' : ''}">${money(tot.fact)}</span>`, plan ? `исполнено ${pct(tot.fact / plan)} · осталось ${money(plan - tot.fact)}` : 'расходы из журнала операций')}
      ${finTile('На согласовании', `<span class="gold">${money(tot.pend)}</span>`, 'бюджеты и заявки ждут решения')}
    </div>
    ${late.length ? `<div class="card bg-late"><b>${icon('clock')}Бюджеты не сданы в срок:</b> ${esc(late.slice(0, 8).join('; '))}${late.length > 8 ? ' и ещё ' + (late.length - 8) : ''} <button class="link-btn" data-bgtab="plans">Календарь</button></div>` : ''}
    <section class="section"><div class="section-head"><h2>По направлениям и отделам</h2><span class="hint-inline">План = утверждённый бюджет + согласованные разовые заявки. Факт — расходы из журнала: направление берём у оплаченной строки плана (заявка, задача).</span></div>
      <div class="table-wrap"><table class="t bg-sum"><thead><tr><th>Направление</th><th class="r">Бюджет</th><th class="r">Разовые</th><th class="r">План</th><th class="r">Факт</th><th class="r">Остаток</th><th>Исполнение</th><th class="r">На согласовании</th></tr></thead>
        <tbody>${body}</tbody>
        <tfoot><tr class="total"><td>Итого</td><td class="r">${money(tot.bud)}</td><td class="r">${money(tot.req)}</td><td class="r">${money(plan)}</td><td class="r">${money(tot.fact)}</td><td class="r ${plan - tot.fact < 0 ? 'bad' : ''}">${money(plan - tot.fact)}</td><td></td><td class="r">${money(tot.pend)}</td></tr></tfoot></table></div></section>
    <section class="section"><div class="section-head"><h2>По статьям расходов</h2><span class="hint-inline">«План платежей» — что стоит в финплане «Финансов» на эти месяцы (зарплаты, регулярные и разовые платежи).</span></div>
      ${catRows.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Статья</th><th class="r">Бюджет</th><th class="r">Разовые</th><th class="r">План платежей</th><th class="r">Факт</th></tr></thead>
        <tbody>${catRows.map(([c, v]) => `<tr><td>${esc(OUT_CATS[c] || c)}</td><td class="r">${v.bud ? money(v.bud) : '—'}</td><td class="r">${v.req ? money(v.req) : '—'}</td><td class="r">${v.plan ? money(v.plan) : '—'}</td><td class="r ${v.fact > v.bud + v.req && v.bud + v.req ? 'bad' : ''}">${v.fact ? money(v.fact) : '—'}</td></tr>`).join('')}</tbody></table></div>`
        : '<div class="empty"><b>Пока пусто</b>Здесь появятся статьи, когда утвердят бюджеты направлений или появятся расходы.</div>'}</section>`;
}
function wireBgSum(root) { wireBgPeriod(root, 'bg.sum'); }

/* ── заявки ── */
function bgReqsHtml() {
  const money_ = Auth.can('money.view'), me = Budget.me();
  const scope = View.get('bg.rq', money_ ? 'all' : 'mine'), stF = View.get('bg.rqst', ''), q = View.get('bg.rqq', ''), tagF = View.get('bg.rqtag', '');
  const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е');
  const all = Budget.reqs();
  const list = all.filter(d => {
    const st = Budget.state(d);
    if (scope === 'me' && !st.waiting.includes(me)) return false;
    if (scope === 'mine' && d.by !== me) return false;
    if (stF && st.status !== stF) return false;
    if (tagF && !(d.tags || []).includes(tagF)) return false;
    return !q || norm(`${d.title} ${d.why} ${d.gain} ${(d.tags || []).join(' ')} ${whoName(d.by)}`).includes(norm(q));
  });
  const tags = [...new Set(all.flatMap(d => d.tags || []))].sort((a, b) => a.localeCompare(b, 'ru'));
  const nMe = all.filter(d => Budget.state(d).waiting.includes(me)).length;
  return `<div class="bg-tools">
      <div class="seg">${[['me', `Ждут меня${nMe ? ` · ${nMe}` : ''}`], ['mine', 'Мои'], ...(money_ ? [['all', 'Все']] : [])].map(([k, n]) => `<button type="button" data-bgrq="${k}" class="${k === scope ? 'on' : ''}">${n}</button>`).join('')}</div>
      <select class="select" id="bgRqSt" aria-label="Статус"><option value="">Все статусы</option>${Object.entries(FLOW_ST).map(([k, x]) => `<option value="${k}" ${k === stF ? 'selected' : ''}>${x.name}</option>`).join('')}</select>
      <input class="input" id="bgRqQ" type="search" placeholder="Поиск по заявкам" value="${esc(q)}">
    </div>
    ${tags.length ? `<div class="chips bg-tags">${tags.map(t => `<button type="button" class="chip ${t === tagF ? 'on' : ''}" data-bgtag="${esc(t)}">#${esc(t)}</button>`).join('')}</div>` : ''}
    ${list.length ? `<div class="bg-list">${list.map(reqRowHtml).join('')}</div>`
      : `<div class="empty"><b>${all.length ? 'Ничего не нашлось' : 'Заявок пока нет'}</b>${all.length ? 'Снимите фильтр или поищите другое слово.' : 'Нужны деньги на задачу, проект или идею — нажмите «Заявка на финансирование».'}</div>`}`;
}
function reqRowHtml(d) {
  const st = Budget.state(d);
  return `<div class="card bg-row ${st.waiting.includes(Budget.me()) ? 'need' : ''}" data-flow="fundreqs:${d.id}" role="button" tabindex="0">
    <span class="bg-amt"><b>${money(Number(d.amount) || 0)}</b><small>${d.month ? monthName(d.month, true) : ''}</small></span>
    <span class="bg-main"><b>${esc(d.title)}</b>
      <small>${esc(FR_KINDS[d.kind] || 'Заявка')}${d.dir ? ' · ' + esc(Budget.scopeName(d.dir, d.dept)) : ''} · ${esc(whoName(d.by))}${(d.tags || []).length ? ' · ' + d.tags.map(t => '#' + esc(t)).join(' ') : ''}</small></span>
    <span class="bg-meta">${flowPill(st)}${flowWait(d, st)}${flowRoute(d, st)}</span>
  </div>`;
}
function wireBgReqs(root) {
  on(root, 'click', '[data-bgrq]', (e, el) => { View.set('bg.rq', el.dataset.bgrq); App.render(); });
  on(root, 'click', '[data-bgtag]', (e, el) => { View.set('bg.rqtag', View.get('bg.rqtag', '') === el.dataset.bgtag ? '' : el.dataset.bgtag); App.render(); });
  $('#bgRqSt', root).onchange = e => { View.set('bg.rqst', e.target.value); App.render(); };
  const qi = $('#bgRqQ', root);
  let t = null;
  qi.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { View.set('bg.rqq', qi.value); App.render({focus: 'bgRqQ'}); }, 300); });
}

/* карточка заявки или бюджета: маршрут, история и кнопки того, чья очередь */
function flowActions(d, st, el, close) {
  const box = $('#flAct', el);
  on(el, 'click', '[data-fl]', async (e, b) => {
    const v = b.dataset.fl;
    if (v === 'ok') { Budget.decide(d, 'ok'); close(); return; }
    if (v === 'revise' || v === 'no') {
      box.hidden = false;
      box.dataset.v = v;
      $('#flNoteL', el).textContent = v === 'revise' ? 'Что доработать — автор увидит этот комментарий' : 'Почему отказ — автор увидит этот комментарий';
      $('#flGo', el).textContent = v === 'revise' ? 'Вернуть на доработку' : 'Отказать';
      $('#flGo', el).className = `btn ${v === 'no' ? 'danger solid' : 'primary'}`;
      $('#flNote', el).focus();
      return;
    }
    if (v === 'send') { Budget.send(d); close(); return; }
    if (v === 'edit') { close(); (d.ptype ? editBud : editReq)(d.id); return; }
    if (v === 'withdraw') { if (await confirmPop(b, {text: 'Отозвать? Вернуть отозванное нельзя — можно подать заново.', yes: 'Отозвать', danger: true})) { Budget.withdraw(d); close(); } return; }
    if (v === 'del') { if (await confirmPop(b, {text: 'Удалить насовсем?', yes: 'Удалить', danger: true})) { Store.remove(Budget.col(d), d.id); close(); } return; }
    if (v === 'copy') { close(); editReq(null, {...['title', 'kind', 'tags', 'dir', 'dept', 'taskId', 'ideaId', 'amount', 'month', 'cat', 'why', 'gain', 'need', 'risk'].reduce((o, k) => ({...o, [k]: clone(d[k])}), {})}); }
  });
  const go = $('#flGo', el);
  if (go) go.onclick = () => {
    const note = $('#flNote', el).value.trim();
    if (!note) { $('#flNote', el).focus(); toast('Напишите комментарий для автора'); return; }
    Budget.decide(d, box.dataset.v, note);
    close();
  };
}
function flowFoot(d, st) {
  const me = Budget.me(), mine = d.by === me, open = ['draft', 'revise'].includes(st.status);
  /* бюджет направления может поправить и отправить тот, кто ведёт деньги (финдиректор помогает собрать) */
  const editor = mine || (!!d.ptype && Auth.can('money.edit'));
  const left = [], right = [];
  if ((mine && ['draft', 'withdrawn'].includes(st.status)) || Auth.isOwner()) left.push(`<button class="btn danger" data-fl="del" title="Удалить">${icon('trash')}</button>`);
  if (editor && open) left.push(`<button class="btn" data-fl="edit">${icon('edit')}Изменить</button>`);
  if (mine && ['review', 'revise'].includes(st.status)) right.push('<button class="btn ghost" data-fl="withdraw">Отозвать</button>');
  if (!d.ptype && mine && ['rejected', 'withdrawn'].includes(st.status)) right.push(`<button class="btn" data-fl="copy">${icon('copy')}Подать заново</button>`);
  right.push('<button class="btn" data-close>Закрыть</button>');
  if (editor && open) right.push(`<button class="btn primary" data-fl="send">${st.status === 'revise' ? 'Отправить снова' : 'Отправить на согласование'}</button>`);
  if (st.waiting.includes(me)) right.push('<button class="btn" data-fl="no">Отказать</button>', '<button class="btn" data-fl="revise">На доработку</button>', `<button class="btn primary" data-fl="ok">${icon('tick')}Согласовать</button>`);
  return `${left.length ? `<span class="left row">${left.join('')}</span>` : ''}${right.join('')}`;
}
const flowNoteBox = () => `<div class="fl-act" id="flAct" hidden><label class="field"><span id="flNoteL">Комментарий</span><textarea class="textarea" id="flNote" rows="3"></textarea></label>
  <div class="row"><button class="btn primary" id="flGo">Отправить</button></div></div>`;

function openReq(id) {
  const d = Store.get('fundreqs', id);
  if (!d) return;
  const st = Budget.state(d), task = d.taskId ? Tasks.get(d.taskId) : null, idea = d.ideaId ? Store.get('ideas', d.ideaId) : null;
  const row = Auth.can('money.view') ? Store.get('plan', 'fr_' + id) : null;
  const m = d.month || (row && (row.months || [])[0]);
  const paid = row && m ? Money.paidAmount(row, m) : 0;
  openModal({
    title: d.title,
    wide: true,
    body: `<div class="fl-view">
        <div class="fl-head"><span class="fl-big">${money(Number(d.amount) || 0)}</span>${flowPill(st)}${flowWait(d, st)}</div>
        <p class="note">${esc(FR_KINDS[d.kind] || 'Заявка')}${d.dir ? ' · ' + esc(Budget.scopeName(d.dir, d.dept)) : ''} · статья «${esc(OUT_CATS[d.cat] || 'Прочие расходы')}» · ${d.month ? 'нужны в ' + esc(monthName(d.month, true).toLowerCase()) : ''} · подал(а) ${esc(whoName(d.by))}${d.sentAt ? ', ' + timeAgo(d.sentAt) : ''}</p>
        ${(d.tags || []).length ? `<div class="chips">${d.tags.map(t => `<span class="pill line">#${esc(t)}</span>`).join('')}</div>` : ''}
        ${task ? `<p class="note">Задача: <a href="#tasks" data-open-task="${task.id}">${esc(task.title)}</a></p>` : ''}${idea ? `<p class="note">Идея с биржи: <a href="#ideas" data-open-idea="${idea.id}">${esc(idea.title)}</a></p>` : ''}
        ${flowRoute(d, st)}
        ${st.status === 'revise' || st.status === 'rejected' ? `<div class="fl-verdict ${st.status}"><b>${esc(whoName(st.by))} ${FLOW_VERB[st.status === 'revise' ? 'revise' : 'no']}:</b> ${esc(st.note)}</div>` : ''}
        ${st.status === 'approved' && row ? `<div class="fl-verdict approved">В плане платежей на ${esc(monthName(m, true).toLowerCase())}: оплачено ${money(paid)} из ${money(Money.planAmount(row, m))}. Оплатить — в «Финансах», раздел «План и прогноз».</div>` : ''}
        ${flowText('Обоснование затрат', d.why)}${flowText('Что мы получим', d.gain)}${flowText('Чем это нужно бизнесу', d.need)}${flowText('Что будет, если не делать', d.risk)}
        ${flowHistory(d)}
        ${flowNoteBox()}
      </div>`,
    foot: flowFoot(d, st),
    onMount(el, close) {
      flowActions(d, st, el, close);
      on(el, 'click', '[data-open-task]', (e, a) => { e.preventDefault(); close(); openTask(a.dataset.openTask); });
      on(el, 'click', '[data-open-idea]', (e, a) => { e.preventDefault(); close(); openIdea(a.dataset.openIdea); });
    },
  });
}

/* единая форма заявки; preset — из идеи, задачи или «Подать заново» */
function editReq(id, preset = {}) {
  const cur = id ? Store.get('fundreqs', id) : null;
  const v = cur ? clone(cur) : {title: '', kind: 'event', tags: [], dir: (Auth.person() || {}).dir || '', dept: '', taskId: '', ideaId: '', amount: '', month: addMonths(monthOf(today()), 1), cat: '', why: '', gain: '', need: '', risk: '', ...preset};
  if (!v.cat) v.cat = DIR_CAT[v.dir] || 'other';
  let catTouched = !!cur;
  const months = Array.from({length: 13}, (_, i) => addMonths(monthOf(today()), i));
  if (v.month && !months.includes(v.month)) months.unshift(v.month);
  const tasks = Tasks.all().filter(t => t.status !== 'done' || t.id === v.taskId).sort((a, b) => a.title.localeCompare(b.title, 'ru'));
  const tagsHtml = () => [...new Set([...FR_TAGS, ...(v.tags || [])])].map(t => `<button type="button" class="chip ${(v.tags || []).includes(t) ? 'on' : ''}" data-frtag="${esc(t)}">#${esc(t)}</button>`).join('');
  const deptOpts = dir => `<option value="">— всё направление —</option>${Budget.depts().filter(x => x.dir === dir).map(x => `<option value="${esc(x.id)}" ${x.id === v.dept ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}`;
  openModal({
    title: cur ? 'Заявка на финансирование' : 'Новая заявка на финансирование',
    wide: true,
    body: `<div class="fr-form">
      <label class="field"><span>Что нужно оплатить</span><input class="input" id="frT" maxlength="200" value="${esc(v.title)}" placeholder="Например: съёмка трёх роликов для запуска"></label>
      <div class="field"><span>Под что</span><div class="seg" id="frKind">${Object.entries(FR_KINDS).map(([k, n]) => `<button type="button" data-frk="${k}" class="${k === v.kind ? 'on' : ''}">${n}</button>`).join('')}</div></div>
      <label class="field" id="frTaskF" ${v.kind === 'task' ? '' : 'hidden'}><span>Задача</span><select class="select" id="frTask"><option value="">— выберите задачу —</option>${tasks.map(t => `<option value="${t.id}" ${t.id === v.taskId ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}</select></label>
      <div class="grid3">
        <label class="field"><span>Сумма, ₽</span><input class="input num" id="frA" inputmode="decimal" value="${esc(v.amount)}" placeholder="0"></label>
        <label class="field"><span>Когда нужны деньги</span><select class="select" id="frM">${months.map(m => `<option value="${m}" ${m === v.month ? 'selected' : ''}>${monthName(m, true)}</option>`).join('')}</select></label>
        <label class="field"><span>Статья расходов</span><select class="select" id="frCat">${Object.entries(OUT_CATS).filter(([k]) => !['tax', 'vat', 'acquiring', 'refunds', 'referral', 'authors', 'sellers'].includes(k)).map(([k, n]) => `<option value="${k}" ${k === v.cat ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      </div>
      <div class="chips fr-quick">${[10000, 30000, 50000, 100000, 150000].map(a => `<button type="button" class="chip" data-fra="${a}">${money(a).replace(',00', '')}</button>`).join('')}</div>
      <div class="grid2">
        <label class="field"><span>Направление</span><select class="select" id="frDir"><option value="">— не выбрано —</option>${Object.entries(DIRS).map(([k, x]) => `<option value="${k}" ${k === v.dir ? 'selected' : ''}>${x.name}</option>`).join('')}</select></label>
        <label class="field"><span>Отдел</span><select class="select" id="frDept">${deptOpts(v.dir)}</select></label>
      </div>
      <div class="field"><span>Теги</span><div class="chips" id="frTags">${tagsHtml()}</div>
        <div class="row fr-tagadd"><input class="input" id="frTagNew" maxlength="30" placeholder="свой тег"><button type="button" class="btn xs" id="frTagAdd">${icon('plus')}Тег</button></div></div>
      <p class="fl-hint" id="frRoute"></p>
      <label class="field"><span>Обоснование затрат <small>на что именно и как посчитали сумму</small></span><textarea class="textarea" id="frWhy" rows="3" placeholder="Оператор 2 дня × 15 000 ₽, монтаж 3 роликов × 5 000 ₽, свет — своё">${esc(v.why)}</textarea></label>
      <label class="field"><span>Что мы получим <small>результат — лучше в цифрах</small></span><textarea class="textarea" id="frGain" rows="2" placeholder="3 ролика к запуску, 150 000 охвата, 200 регистраций">${esc(v.gain)}</textarea></label>
      <label class="field"><span>Чем это нужно бизнесу <small>какую цель или метрику двигает</small></span><textarea class="textarea" id="frNeed" rows="2" placeholder="Цель квартала — 500 продаж: без роликов запуск идёт только на органике">${esc(v.need)}</textarea></label>
      <label class="field"><span>Что будет, если не делать <small>необязательно</small></span><textarea class="textarea" id="frRisk" rows="2">${esc(v.risk)}</textarea></label>
    </div>`,
    foot: `<button class="btn" data-close>Отмена</button><button class="btn" id="frDraft">Сохранить черновик</button><button class="btn primary" id="frSend">Отправить финдиректору</button>`,
    onMount(el, close) {
      const amount = () => Math.max(0, Math.round(parseNum($('#frA', el).value) || 0));
      const paint = () => {
        const a = amount(), dir = $('#frDir', el).value, m = $('#frM', el).value;
        const st = Budget.state({amount: a, by: Budget.me(), sentAt: 1, round: 1, decisions: {}});
        const who = Budget.who();
        const route = st.route.map(s => `${Flow.STEPS[s]}${s === 'board' ? '' : ` (${Flow.deciders(s, who, Budget.me()).map(whoFirst).join(', ') || 'не выбран'})`}`).join(' → ');
        let left = '';
        if (Auth.can('money.view') && dir) {
          const b = Budget.monthBudget(m, dir, $('#frDept', el).value);
          const used = sum(Budget.reqs().filter(q => q.id !== id && q.month === m && q.dir === dir && Budget.state(q).status === 'approved'), q => q.amount);
          left = b.sum ? ` В бюджете «${dirName(dir)}» на ${monthName(m, true).toLowerCase()} — ${money(b.sum)}, разовых уже согласовано на ${money(used)}.` : ` У «${dirName(dir)}» на ${monthName(m, true).toLowerCase()} утверждённого бюджета нет — заявка пойдёт сверх бюджета.`;
        }
        $('#frRoute', el).innerHTML = `${icon('arrow')}<span>${a ? `Маршрут: <b>${esc(route)}</b>.` : 'Укажите сумму — покажем, кто будет согласовывать.'}${esc(left)}</span>`;
      };
      paint();
      on(el, 'click', '[data-frk]', (e, b) => { v.kind = b.dataset.frk; $$('[data-frk]', el).forEach(x => x.classList.toggle('on', x === b)); $('#frTaskF', el).hidden = v.kind !== 'task'; });
      on(el, 'click', '[data-fra]', (e, b) => { $('#frA', el).value = b.dataset.fra; paint(); });
      on(el, 'click', '[data-frtag]', (e, b) => { const t = b.dataset.frtag; v.tags = (v.tags || []).includes(t) ? v.tags.filter(x => x !== t) : [...(v.tags || []), t]; b.classList.toggle('on'); });
      $('#frTagAdd', el).onclick = () => {
        const t = $('#frTagNew', el).value.trim().toLowerCase().replace(/^#/, '');
        if (!t) return;
        if (!(v.tags || []).includes(t)) v.tags = [...(v.tags || []), t];
        $('#frTags', el).innerHTML = tagsHtml();
        $('#frTagNew', el).value = '';
      };
      $('#frTask', el).onchange = e => { const t = Tasks.get(e.target.value); if (t && !$('#frT', el).value.trim()) $('#frT', el).value = t.title; if (t && t.dir && !$('#frDir', el).value) { $('#frDir', el).value = t.dir; $('#frDept', el).innerHTML = deptOpts(t.dir); } paint(); };
      $('#frDir', el).onchange = e => { $('#frDept', el).innerHTML = deptOpts(e.target.value); if (!catTouched && DIR_CAT[e.target.value]) $('#frCat', el).value = DIR_CAT[e.target.value]; paint(); };
      $('#frCat', el).onchange = () => { catTouched = true; };
      ['#frA', '#frM', '#frDept'].forEach(s => $(s, el).addEventListener(s === '#frA' ? 'input' : 'change', paint));
      const save = send => {
        const title = $('#frT', el).value.trim(), a = amount();
        const need = [['#frT', title, 'Напишите, что нужно оплатить'], ['#frA', a, 'Укажите сумму'], ['#frWhy', $('#frWhy', el).value.trim(), 'Обоснуйте затраты'], ['#frGain', $('#frGain', el).value.trim(), 'Напишите, что мы получим'], ['#frNeed', $('#frNeed', el).value.trim(), 'Напишите, чем это нужно бизнесу']];
        const miss = send ? need.find(x => !x[1]) : need.slice(0, 1).find(x => !x[1]);
        if (miss) { $(miss[0], el).focus(); toast(miss[2]); return; }
        const body = {title, kind: v.kind, tags: v.tags || [], dir: $('#frDir', el).value, dept: $('#frDept', el).value, taskId: v.kind === 'task' ? $('#frTask', el).value : '', ideaId: v.ideaId || '',
          amount: a, month: $('#frM', el).value, cat: $('#frCat', el).value, why: $('#frWhy', el).value.trim(), gain: $('#frGain', el).value.trim(), need: $('#frNeed', el).value.trim(), risk: $('#frRisk', el).value.trim(), upd: Date.now()};
        if (cur) { Store.patch('fundreqs', cur.id, body, {mustExist: true}); if (send) Budget.send({...cur, ...body}); }
        else Store.add('fundreqs', {...body, by: Budget.me(), at: Date.now(), ...(send ? {sentAt: Date.now(), round: 1} : {})});
        if (!send) toast('Черновик сохранён — отправить можно из карточки заявки');
        else if (!cur) toast(`Заявка отправлена — решает ${Budget.firstUp({...body, by: Budget.me()})}`);
        close();
      };
      $('#frDraft', el).onclick = () => save(false);
      $('#frSend', el).onclick = () => save(true);
    },
  });
}

/* ── бюджеты направлений ── */
function bgPlansHtml() {
  const money_ = Auth.can('money.view'), me = Budget.me();
  const cal = Budget.calendar(), scopes = Budget.scopes();
  const cell = (c, sc) => {
    const d = Store.get('budgets', Flow.budgetId(c.p, sc.dir, sc.dept));
    const st = d ? Budget.state(d) : null, inDir = !d && !Budget.missing(c.pt, c.p, sc);
    const late = c.due < today() && Budget.missing(c.pt, c.p, sc);
    const label = st ? FLOW_ST[st.status].name : inDir ? 'В бюджете направления' : late ? 'Просрочен' : 'Не начат';
    const tone = st ? FLOW_ST[st.status].tone : late ? 'bad' : inDir ? 'line' : '';
    return `<td><button class="bg-cell ${tone}" data-bgcell="${c.pt}|${c.p}|${sc.dir}|${sc.dept}">${label}${d ? `<small>${money(budTotal(d))}</small>` : ''}</button></td>`;
  };
  const daysTo = due => daysBetween(today(), due);
  const mine = Budget.budgets().filter(d => money_ || d.by === me).sort((a, b) => (Flow.months(b.ptype, b.period)[0]).localeCompare(Flow.months(a.ptype, a.period)[0]) || dirName(a.dir).localeCompare(dirName(b.dir), 'ru'));
  return `<section class="section"><div class="section-head"><h2>Бюджетный календарь</h2><span class="hint-inline">Бюджет на год сдаём за месяц до начала года, на квартал — за две недели, на месяц — за неделю. Нажмите на клетку, чтобы открыть или подготовить бюджет.</span></div>
      <div class="bg-due">${cal.map(c => { const n = daysTo(c.due); return `<div class="card bg-due-i ${n < 0 ? 'late' : n <= 3 ? 'soon' : ''}"><span class="label">${PTYPES[c.pt]}</span><b>${periodName(c.pt, c.p)}</b><small>сдать до ${dayLong(c.due)}${n < 0 ? ' — срок прошёл' : n === 0 ? ' — сегодня' : ` · через ${n} ${plural(n, 'день', 'дня', 'дней')}`}</small></div>`; }).join('')}</div>
      ${money_ ? `<div class="table-wrap"><table class="t bg-cal"><thead><tr><th>Направление · ответственный</th>${cal.map(c => `<th>${esc(periodName(c.pt, c.p))}</th>`).join('')}</tr></thead>
        <tbody>${scopes.map(sc => { const h = Budget.head(sc.dir, sc.dept); return `<tr><td>${sc.dept ? `<span class="bg-indent">${esc(Budget.deptName(sc.dept))}</span>` : `<i class="dot" style="background:${DIRS[sc.dir].color}"></i><b>${dirName(sc.dir)}</b>`}${h ? `<small class="note"> · ${esc(whoFirst(h))}</small>` : ''}</td>${cal.map(c => cell(c, sc)).join('')}</tr>`; }).join('')}</tbody></table></div>`
        : `<p class="note">Свой бюджет направления можно подготовить кнопкой ниже — он уйдёт финдиректору.</p>`}
      <div class="row bg-plan-add"><button class="btn sm" id="bgNewBud">${icon('plus')}Подготовить бюджет</button></div></section>
    <section class="section"><div class="section-head"><h2>${money_ ? 'Все бюджеты' : 'Мои бюджеты'}</h2></div>
      ${mine.length ? `<div class="bg-list">${mine.map(d => { const st = Budget.state(d); return `<div class="card bg-row ${st.waiting.includes(me) ? 'need' : ''}" data-flow="budgets:${d.id}" role="button" tabindex="0">
          <span class="bg-amt"><b>${money(budTotal(d))}</b><small>${esc(periodName(d.ptype, d.period))}</small></span>
          <span class="bg-main"><b>${esc(Budget.scopeName(d.dir, d.dept))}</b><small>${(d.lines || []).length} ${plural((d.lines || []).length, 'строка', 'строки', 'строк')} · ${esc(whoName(d.by))}</small></span>
          <span class="bg-meta">${flowPill(st)}${flowWait(d, st)}${flowRoute(d, st)}</span></div>`; }).join('')}</div>`
        : '<div class="empty"><b>Бюджетов пока нет</b>Ответственные готовят бюджеты направлений по календарю выше.</div>'}</section>`;
}
function wireBgPlans(root) {
  on(root, 'click', '[data-bgcell]', (e, el) => {
    const [pt, p, dir, dept] = el.dataset.bgcell.split('|');
    const d = Store.get('budgets', Flow.budgetId(p, dir, dept));
    if (d) openBud(d.id); else editBud(null, {ptype: pt, period: p, dir, dept});
  });
  $('#bgNewBud', root).onclick = () => { const c = Budget.calendar()[0]; editBud(null, {ptype: c.pt, period: c.p, dir: (Auth.person() || {}).dir || 'content', dept: ''}); };
}

/* с чем сравнить бюджет: прошлый период и доля верхнего (для месяца — треть квартала, для квартала — четверть года) */
function budCompare(d) {
  const prev = Store.get('budgets', Flow.budgetId(periodShift(d.ptype, d.period, -1), d.dir, d.dept));
  const prevOk = prev && Budget.state(prev).status === 'approved' ? prev : null;
  const ms = Flow.months(d.ptype, d.period);
  const parentId = d.ptype === 'month' ? Flow.budgetId(qOf(ms[0]), d.dir, d.dept) : d.ptype === 'quarter' ? Flow.budgetId(ms[0].slice(0, 4), d.dir, d.dept) : null;
  const parent = parentId ? Store.get('budgets', parentId) : null;
  const share = parent && Budget.state(parent).status === 'approved' ? budTotal(parent) / (d.ptype === 'month' ? 3 : 4) : null;
  return {prev: prevOk, share, parent};
}
function openBud(id) {
  const d = Store.get('budgets', id);
  if (!d) return;
  const st = Budget.state(d), tot = budTotal(d), cmp = budCompare(d);
  const dev = cmp.share ? tot / cmp.share - 1 : null;
  openModal({
    title: `Бюджет: ${Budget.scopeName(d.dir, d.dept)} — ${periodName(d.ptype, d.period)}`,
    wide: true,
    body: `<div class="fl-view">
        <div class="fl-head"><span class="fl-big">${money(tot)}</span>${flowPill(st)}${flowWait(d, st)}</div>
        <p class="note">Сдать до ${dayLong(Flow.deadline(d.ptype, d.period))}${d.sentAt ? ` · отправлен ${timeAgo(d.sentAt)}` : ''} · готовит ${esc(whoName(d.by))}</p>
        ${flowRoute(d, st)}
        ${st.status === 'revise' || st.status === 'rejected' ? `<div class="fl-verdict ${st.status}"><b>${esc(whoName(st.by))} ${FLOW_VERB[st.status === 'revise' ? 'revise' : 'no']}:</b> ${esc(st.note)}</div>` : ''}
        <div class="bg-cmp">${cmp.prev ? `<span>Прошлый период: <b>${money(budTotal(cmp.prev))}</b> (${signed(tot - budTotal(cmp.prev), money)})</span>` : ''}
          ${cmp.share !== null ? `<span class="${Math.abs(dev) > 0.1 ? 'warn' : ''}">Доля ${d.ptype === 'month' ? 'квартала' : 'года'}: <b>${money(cmp.share)}</b>${Math.abs(dev) > 0.1 ? ` — отклонение ${pct(dev)}, нужно объяснение` : ''}</span>` : ''}</div>
        <div class="table-wrap"><table class="t"><thead><tr><th>Статья</th><th>На что</th><th class="r">Сумма</th></tr></thead>
          <tbody>${(d.lines || []).map(l => `<tr><td>${esc(OUT_CATS[l.cat] || 'Прочие расходы')}</td><td>${esc(l.title || '')}${l.note ? `<small class="note"> · ${esc(l.note)}</small>` : ''}</td><td class="r">${money(Number(l.amount) || 0)}</td></tr>`).join('')}</tbody>
          <tfoot><tr class="total"><td colspan="2">Итого</td><td class="r">${money(tot)}</td></tr></tfoot></table></div>
        ${flowText('Что получим за период', d.gain)}${flowText('Чем это нужно бизнесу', d.need)}${flowText('Что изменилось и почему', d.why)}${flowText('Что будет, если урезать', d.risk)}
        ${flowHistory(d)}
        ${flowNoteBox()}
      </div>`,
    foot: flowFoot(d, st),
    onMount(el, close) { flowActions(d, st, el, close); },
  });
}
function editBud(id, preset = {}) {
  const cur = id ? Store.get('budgets', id) : null;
  const v = cur ? clone(cur) : {ptype: 'month', period: addMonths(monthOf(today()), 1), dir: 'content', dept: '', lines: [], why: '', gain: '', need: '', risk: '', ...preset};
  if (!cur) {
    const ex = Store.get('budgets', Flow.budgetId(v.period, v.dir, v.dept));
    if (ex) { openBud(ex.id); return; }
  }
  if (!v.lines.length) v.lines = [{cat: 'payroll', title: '', amount: 0}];
  const periods = pt => {
    const base = periodNow(pt), list = Array.from({length: pt === 'month' ? 8 : pt === 'quarter' ? 5 : 3}, (_, i) => periodShift(pt, base, i));
    return list.includes(v.period) || v.ptype !== pt ? list : [v.period, ...list];
  };
  const catOpts = c => Object.entries(OUT_CATS).map(([k, n]) => `<option value="${k}" ${k === c ? 'selected' : ''}>${n}</option>`).join('');
  const linesHtml = () => v.lines.map((l, i) => `<tr data-bl="${i}"><td><select class="select" data-blk="cat">${catOpts(l.cat)}</select></td>
      <td><input class="input" data-blk="title" maxlength="200" value="${esc(l.title || '')}" placeholder="на что"></td>
      <td><input class="input num" data-blk="amount" inputmode="decimal" value="${l.amount ? esc(l.amount) : ''}" placeholder="0"></td>
      <td><button type="button" class="icon-btn" data-bldel="${i}" aria-label="Убрать строку">${icon('x')}</button></td></tr>`).join('');
  const lock = !!cur;
  openModal({
    title: cur ? 'Бюджет направления' : 'Новый бюджет направления',
    wide: true,
    body: `<div class="fr-form">
      <div class="grid3">
        <div class="field"><span>Горизонт</span><div class="seg" id="bdPt">${Object.entries(PTYPES).map(([k, n]) => `<button type="button" data-bdpt="${k}" class="${k === v.ptype ? 'on' : ''}" ${lock ? 'disabled' : ''}>${n}</button>`).join('')}</div></div>
        <label class="field"><span>Период</span><select class="select" id="bdP" ${lock ? 'disabled' : ''}></select></label>
        <label class="field"><span>Направление</span><select class="select" id="bdDir" ${lock ? 'disabled' : ''}>${Object.entries(DIRS).map(([k, x]) => `<option value="${k}" ${k === v.dir ? 'selected' : ''}>${x.name}</option>`).join('')}</select></label>
      </div>
      <label class="field"><span>Отдел <small>если бюджет ведут по отделам</small></span><select class="select" id="bdDept" ${lock ? 'disabled' : ''}></select></label>
      <p class="fl-hint" id="bdHint"></p>
      <div class="field"><span>Статьи бюджета</span>
        <div class="table-wrap"><table class="t bd-lines"><thead><tr><th>Статья</th><th>На что</th><th class="r">Сумма, ₽</th><th></th></tr></thead><tbody id="bdLines">${linesHtml()}</tbody>
          <tfoot><tr class="total"><td colspan="2">Итого</td><td class="r" id="bdTot"></td><td></td></tr></tfoot></table></div>
        <div class="row"><button type="button" class="btn xs" id="bdAdd">${icon('plus')}Строка</button><button type="button" class="btn xs ghost" id="bdCopy">${icon('copy')}Как в прошлом периоде</button></div></div>
      <label class="field"><span>Что получим за период <small>цели и результат в цифрах</small></span><textarea class="textarea" id="bdGain" rows="2">${esc(v.gain)}</textarea></label>
      <label class="field"><span>Чем это нужно бизнесу <small>какие цели квартала и метрики двигает</small></span><textarea class="textarea" id="bdNeed" rows="2">${esc(v.need)}</textarea></label>
      <label class="field"><span>Что изменилось и почему <small>относительно прошлого периода; обязательно, если отклонение больше 10%</small></span><textarea class="textarea" id="bdWhy" rows="2">${esc(v.why)}</textarea></label>
      <label class="field"><span>Что будет, если урезать <small>необязательно</small></span><textarea class="textarea" id="bdRisk" rows="2">${esc(v.risk)}</textarea></label>
    </div>`,
    foot: `<button class="btn" data-close>Отмена</button><button class="btn" id="bdDraft">Сохранить черновик</button><button class="btn primary" id="bdSend">Отправить финдиректору</button>`,
    onMount(el, close) {
      const read = () => $$('[data-bl]', el).forEach(tr => {
        const l = v.lines[Number(tr.dataset.bl)];
        l.cat = $('[data-blk="cat"]', tr).value;
        l.title = $('[data-blk="title"]', tr).value.trim();
        l.amount = Math.max(0, Math.round(parseNum($('[data-blk="amount"]', tr).value) || 0));
      });
      const paintPeriods = () => { $('#bdP', el).innerHTML = periods(v.ptype).map(p => `<option value="${p}" ${p === v.period ? 'selected' : ''}>${periodName(v.ptype, p)}</option>`).join(''); v.period = $('#bdP', el).value; };
      const paintDept = () => { $('#bdDept', el).innerHTML = `<option value="">— всё направление —</option>${Budget.depts().filter(x => x.dir === v.dir).map(x => `<option value="${esc(x.id)}" ${x.id === v.dept ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}`; v.dept = $('#bdDept', el).value; };
      const paint = () => {
        read();
        const tot = sum(v.lines, l => l.amount);
        $('#bdTot', el).textContent = money(tot);
        const cmp = budCompare(v), due = Flow.deadline(v.ptype, v.period), n = daysBetween(today(), due);
        const route = Flow.route(v).map(s => Flow.STEPS[s]).join(' → ');
        const dev = cmp.share ? tot / cmp.share - 1 : null;
        $('#bdHint', el).innerHTML = `${icon('clock')}<span>Сдать до <b>${dayLong(due)}</b>${n < 0 ? ' — срок прошёл' : ''}. Маршрут: <b>${route}</b>.${cmp.prev ? ` Прошлый период: ${money(budTotal(cmp.prev))}.` : ''}${cmp.share !== null ? ` Доля ${v.ptype === 'month' ? 'квартала' : 'года'}: ${money(cmp.share)}${Math.abs(dev) > 0.1 ? ` — отклонение ${pct(dev)}, объясните в «Что изменилось»` : ''}.` : ''}</span>`;
      };
      paintPeriods(); paintDept(); paint();
      on(el, 'click', '[data-bdpt]', (e, b) => { if (lock) return; v.ptype = b.dataset.bdpt; $$('[data-bdpt]', el).forEach(x => x.classList.toggle('on', x === b)); v.period = periodShift(v.ptype, periodNow(v.ptype), 1); paintPeriods(); paint(); });
      $('#bdP', el).onchange = e => { v.period = e.target.value; paint(); };
      $('#bdDir', el).onchange = e => { v.dir = e.target.value; v.dept = ''; paintDept(); paint(); };
      $('#bdDept', el).onchange = e => { v.dept = e.target.value; paint(); };
      on(el, 'input', '[data-bl] input', () => paint());
      on(el, 'change', '[data-bl] select', () => paint());
      on(el, 'click', '[data-bldel]', (e, b) => { read(); v.lines.splice(Number(b.dataset.bldel), 1); if (!v.lines.length) v.lines.push({cat: 'other', title: '', amount: 0}); $('#bdLines', el).innerHTML = linesHtml(); paint(); });
      $('#bdAdd', el).onclick = () => { read(); v.lines.push({cat: 'other', title: '', amount: 0}); $('#bdLines', el).innerHTML = linesHtml(); paint(); };
      $('#bdCopy', el).onclick = () => {
        const prev = budCompare(v).prev;
        if (!prev) { toast('В прошлом периоде утверждённого бюджета нет'); return; }
        v.lines = clone(prev.lines || []);
        $('#bdLines', el).innerHTML = linesHtml();
        paint();
      };
      const save = send => {
        read();
        const lines = v.lines.filter(l => l.amount > 0 || l.title);
        if (!lines.length || !sum(lines, l => l.amount)) { toast('Добавьте хотя бы одну строку с суммой'); return; }
        const body = {title: `Бюджет ${Budget.scopeName(v.dir, v.dept)} — ${periodName(v.ptype, v.period)}`, lines, gain: $('#bdGain', el).value.trim(), need: $('#bdNeed', el).value.trim(), why: $('#bdWhy', el).value.trim(), risk: $('#bdRisk', el).value.trim(), upd: Date.now()};
        if (send && (!body.gain || !body.need)) { $(body.gain ? '#bdNeed' : '#bdGain', el).focus(); toast('Напишите, что получим и чем это нужно бизнесу'); return; }
        if (cur) { Store.patch('budgets', cur.id, body, {mustExist: true}); if (send) Budget.send({...cur, ...body}); }
        else {
          const nid = Flow.budgetId(v.period, v.dir, v.dept);
          if (Store.get('budgets', nid)) { toast('Бюджет на этот период уже готовят — откройте его в календаре'); return; }
          const doc = {...body, ptype: v.ptype, period: v.period, dir: v.dir, dept: v.dept || '', by: Budget.me(), at: Date.now()};
          Store.put('budgets', nid, send ? {...doc, sentAt: Date.now(), round: 1} : doc);
          if (send) toast(`Бюджет отправлен — решает ${Budget.firstUp(doc)}`);
        }
        if (!send) toast('Черновик бюджета сохранён');
        close();
      };
      $('#bdDraft', el).onclick = () => save(false);
      $('#bdSend', el).onclick = () => save(true);
    },
  });
}

/* ── календарь и правила ── */
function bgRulesHtml() {
  const c = Budget.set(), who = Budget.who();
  const name = k => (k ? esc(whoName(k)) : '<i>не выбран</i>');
  const cal = Budget.calendar();
  return `<div class="split section">
    <div class="card bg-rules">
      <h2>Правила бюджетирования</h2>
      <h3>1. Кто согласует</h3>
      <p>Финдиректор — ${name(who.cfo)}, гендиректор — ${name(who.ceo)}, акционеры — ${who.board.length ? who.board.map(k => esc(whoFirst(k))).join(', ') : '<i>не выбраны</i>'}. У акционеров решает большинство. Свою заявку человек не согласует сам — её решает уровень выше.</p>
      <h3>2. Разовые заявки</h3>
      <p>Подать может любой из команды: под задачу, проект, направление, мероприятие или новую идею. Одна форма: сумма, когда нужны деньги, статья, направление, теги, обоснование затрат, что получим, чем это нужно бизнесу.</p>
      <ul><li>до ${money(c.cfoLimit)} — решает финдиректор сам;</li><li>от ${money(c.cfoLimit)} до ${money(c.ceoLimit)} — финдиректор, затем гендиректор;</li><li>дороже ${money(c.ceoLimit)} — финдиректор, гендиректор, затем акционеры.</li></ul>
      <h3>3. Бюджеты направлений</h3>
      <p>Каждое направление (и отдел, если их завели) — центр ответственности: у него есть ответственный, и он сдаёт бюджет по статьям. Бюджеты каскадом: год → квартал → месяц. Месячный уточняет квартальный, квартальный — годовой; пока подробного нет, в своде считается доля верхнего (треть квартала, двенадцатая часть года).</p>
      <ul><li>Год — сдать за месяц до начала года; согласуют финдиректор, гендиректор и акционеры.</li><li>Квартал — за две недели до начала квартала; финдиректор и гендиректор.</li><li>Месяц — за неделю до начала месяца; финдиректор.</li></ul>
      <p>Если месячный бюджет отличается от доли квартала больше чем на 10% (или квартальный — от доли года), автор объясняет почему, а финдиректор решает, нужен ли гендиректор.</p>
      <h3>4. Решения и сроки ответа</h3>
      <p>Ответ — «Согласовать», «На доработку» с комментарием или «Отказать» с причиной. На доработке автор правит и отправляет снова — начинается новый круг с финдиректора, прежние решения остаются в истории. Отказ окончательный: можно подать новую заявку с другим обоснованием. Отвечаем быстро: финдиректор и гендиректор — за ${FLOW_SLA.cfo} дня, акционеры — за ${FLOW_SLA.board} дней; дольше — карточка подсвечивается.</p>
      <h3>5. После согласования</h3>
      <p>Согласованная заявка сама встаёт в план платежей на нужный месяц — в «Финансах» её оплачивают кнопкой «Оплатить», и она попадает в факт. Нужно больше согласованного — новая заявка на разницу. Утверждённый бюджет — лимит направления: тратим в его пределах, сверх — разовой заявкой.</p>
    </div>
    <div class="card"><h2>Ближайшие сроки</h2>
      <div class="bg-due col">${cal.map(x => { const n = daysBetween(today(), x.due); return `<div class="bg-due-i ${n < 0 ? 'late' : n <= 3 ? 'soon' : ''}"><span class="label">${PTYPES[x.pt]}</span><b>${periodName(x.pt, x.p)}</b><small>до ${dayLong(x.due)}${n < 0 ? ' — срок прошёл' : ''}</small></div>`; }).join('')}</div>
    </div></div>
    ${Auth.can('settings.edit') ? bgSettingsHtml() : ''}`;
}
function bgSettingsHtml() {
  const b = settings().budget || {}, c = Budget.set();
  const accs = roles => Store.all('accounts').filter(a => a.active !== false && a.name && roles.includes(roleOf(a.role))).map(a => ({key: a.personId || a.id, name: whoName(a.personId || a.id), role: roleOf(a.role)}));
  const sel = (id, cur, list, def) => `<select class="select" id="${id}"><option value="">${def}</option>${list.map(x => `<option value="${esc(x.key)}" ${x.key === cur ? 'selected' : ''}>${esc(x.name)} · ${ROLES[x.role].name}</option>`).join('')}</select>`;
  const boardDef = accs(['owner', 'investor']).map(x => x.key), board = Array.isArray(b.board) && b.board.length ? b.board : boardDef;
  const team = people().filter(p => p.status !== 'inactive');
  const pSel = (attr, cur) => `<select class="select" ${attr}><option value="">— не выбран —</option>${team.map(p => `<option value="${esc(p.id)}" ${p.id === cur ? 'selected' : ''}>${esc(personName(p))}</option>`).join('')}</select>`;
  return `<section class="section"><div class="section-head"><h2>Настройки бюджетирования</h2><span class="hint-inline">Видит и меняет основатель.</span></div>
    <div class="card bg-set">
      <div class="grid3">
        <label class="field"><span>Финдиректор</span>${sel('bsCfo', b.cfo || '', accs(['owner', 'lead', 'finance']), 'по умолчанию — учётка «Финансы»')}</label>
        <label class="field"><span>Гендиректор</span>${sel('bsCeo', b.ceo || '', accs(['owner', 'lead', 'finance']), 'по умолчанию — основатель')}</label>
        <div class="field"><span>Порог финдиректора и гендиректора, ₽</span><div class="row"><input class="input num" id="bsL1" inputmode="numeric" value="${c.cfoLimit}"><input class="input num" id="bsL2" inputmode="numeric" value="${c.ceoLimit}"></div></div>
      </div>
      <div class="field"><span>Акционеры</span><div class="chips" id="bsBoard">${accs(['owner', 'lead', 'finance', 'investor']).map(x => `<button type="button" class="chip ${board.includes(x.key) ? 'on' : ''}" data-bsb="${esc(x.key)}">${esc(x.name)} <small class="note">${ROLES[x.role].name}</small></button>`).join('')}</div></div>
      <div class="field"><span>Ответственные за бюджеты направлений</span><div class="grid2">${Object.entries(DIRS).map(([k, x]) => `<label class="field"><span>${x.name}</span>${pSel(`data-bshead="${k}"`, (b.heads || {})[k] || '')}</label>`).join('')}</div></div>
      <div class="field"><span>Отделы <small>необязательно: если внутри направления бюджет ведут по отделам</small></span>
        <div id="bsDepts">${(b.depts || []).map((d, i) => `<div class="row bs-dept" data-bsd="${i}"><input class="input" data-bsdk="name" value="${esc(d.name)}" placeholder="Название отдела"><select class="select" data-bsdk="dir">${Object.entries(DIRS).map(([k, x]) => `<option value="${k}" ${k === d.dir ? 'selected' : ''}>${x.name}</option>`).join('')}</select>${pSel('data-bsdk="head"', d.head || '')}<button type="button" class="icon-btn" data-bsddel="${i}" aria-label="Убрать отдел">${icon('x')}</button></div>`).join('') || '<p class="note">Отделов нет — бюджет ведётся по направлениям.</p>'}</div>
        <div class="row"><button type="button" class="btn xs" id="bsDeptAdd">${icon('plus')}Отдел</button></div></div>
      <div class="row"><button class="btn primary" id="bsSave">Сохранить настройки</button></div>
    </div></section>`;
}
function wireBgRules(root) {
  if (!Auth.can('settings.edit') || !$('#bsSave', root)) return;
  const b = settings().budget || {};
  let depts = clone(b.depts || []);
  on(root, 'click', '[data-bsb]', (e, el) => el.classList.toggle('on'));
  const readDepts = () => $$('[data-bsd]', root).forEach(row => {
    const d = depts[Number(row.dataset.bsd)];
    d.name = $('[data-bsdk="name"]', row).value.trim();
    d.dir = $('[data-bsdk="dir"]', row).value;
    d.head = $('[data-bsdk="head"]', row).value || null;
  });
  $('#bsDeptAdd', root).onclick = () => {
    readDepts();
    depts.push({id: 'd' + uid().slice(-6), name: '', dir: 'content', head: null});
    saveSettings({budget: {depts}});
  };
  on(root, 'click', '[data-bsddel]', async (e, el) => {
    if (!(await confirmPop(el, {text: 'Убрать отдел? Его бюджеты останутся в истории.', yes: 'Убрать', danger: true}))) return;
    readDepts();
    depts.splice(Number(el.dataset.bsddel), 1);
    saveSettings({budget: {depts}});
  });
  $('#bsSave', root).onclick = () => {
    readDepts();
    const l1 = Math.max(0, Math.round(parseNum($('#bsL1', root).value) || 0)), l2 = Math.max(l1, Math.round(parseNum($('#bsL2', root).value) || 0));
    const heads = Object.fromEntries($$('[data-bshead]', root).map(s => [s.dataset.bshead, s.value || null]));
    saveSettings({budget: {cfo: $('#bsCfo', root).value || null, ceo: $('#bsCeo', root).value || null, board: $$('[data-bsb].on', root).map(x => x.dataset.bsb),
      cfoLimit: l1 || Flow.LIMITS.cfoLimit, ceoLimit: l2 || Flow.LIMITS.ceoLimit, heads, depts: depts.filter(d => d.name)}});
    toast('Настройки бюджетирования сохранены');
  };
}

/* новая заявка или решение по моей — звук и уведомление; ответственным — напоминание о сроке сдачи бюджета */
const BudgetNotify = {
  since: 0,
  wired: false,
  init() {
    if (this.wired) return;
    this.wired = true;
    this.since = Date.now() - 2000;
    Store.subscribe(c => { if (c === 'fundreqs' || c === 'budgets') setTimeout(() => this.check(), 50); });
    setTimeout(() => this.deadlines(), 5000);
  },
  check() {
    if (!Auth.me()) return;
    const me = Budget.me(), fresh = [];
    Budget.waitingMe().forEach(d => { const t = Budget.lastAt(d); if (t > this.since) fresh.push({d, t, ring: true, text: `${d.ptype ? 'Бюджет' : 'Заявка'} на согласование: ${d.ptype ? Budget.scopeName(d.dir, d.dept) + ', ' + periodName(d.ptype, d.period).toLowerCase() : d.title} — ${money(Budget.amount(d))}`}); });
    [...Budget.reqs(), ...Budget.budgets()].filter(d => d.by === me).forEach(d => Object.values(d.decisions || {}).forEach(x => {
      if ((x.at || 0) > this.since && x.by !== me) fresh.push({d, t: x.at, ring: x.verdict !== 'ok', text: `${whoFirst(x.by)} ${FLOW_VERB[x.verdict]} — «${d.ptype ? Budget.scopeName(d.dir, d.dept) : d.title}»`});
    }));
    if (!fresh.length) return;
    this.since = Math.max(this.since, ...fresh.map(f => f.t));
    Sound.play('control');
    fresh.slice(-3).forEach(f => toast(f.text, {ring: f.ring, action: {label: 'Открыть', fn: () => openFlow(Store.get(Budget.col(f.d), f.d.id))}}));
  },
  /* за 3 дня до срока: ответственному направления — если бюджет ещё не отправлен; раз в день */
  deadlines() {
    if (!Auth.me()) return;
    const me = Budget.me(), day = today();
    Budget.calendar().forEach(c => {
      const n = daysBetween(day, c.due);
      if (n > 3 || n < -7) return;
      Budget.scopes().filter(sc => Budget.head(sc.dir, sc.dept) === me).forEach(sc => {
        const d = Store.get('budgets', Flow.budgetId(c.p, sc.dir, sc.dept));
        if (!Budget.missing(c.pt, c.p, sc)) return;
        const key = `eva-bud-due:${c.p}:${sc.dir}:${sc.dept}:${day}`;
        if (Local.get(key, false)) return;
        Local.set(key, true);
        toast(`Бюджет «${Budget.scopeName(sc.dir, sc.dept)}» на ${periodName(c.pt, c.p).toLowerCase()}: ${n < 0 ? 'срок сдачи прошёл' : n === 0 ? 'сдать сегодня' : `сдать до ${dayLong(c.due)}`}`, {ring: true, action: {label: 'Подготовить', fn: () => (d ? openBud(d.id) : editBud(null, {ptype: c.pt, period: c.p, dir: sc.dir, dept: sc.dept}))}});
      });
    });
  },
};
