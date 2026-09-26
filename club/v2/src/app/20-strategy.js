/* Стратегия без лишнего: пять целей квартала, план продаж по сценариям,
   дорожная карта года, три кита и ритм команды. Правит основатель,
   пункты целей отмечают основатель и руководители. */

const GANTT_START = '2026-09';   // полумесяц 0 = первая половина сентября 2026
const GANTT_HALVES = 34;         // до конца января 2028
const hMonth = h => addMonths(GANTT_START, Math.floor(h / 2));
const hLabel = h => `${h % 2 ? 'вторая' : 'первая'} половина ${MONTHS_GEN[monthIdx(hMonth(h))]} ${hMonth(h).slice(0, 4)}`;
const hOfDate = iso => { const [y, m, d] = iso.split('-').map(Number); return (y - 2026) * 24 + (m - 9) * 2 + (d > 15 ? 1 : 0); };

const GOAL_STATUS = {
  '':      {name: 'Не начато',  tone: ''},
  ontrack: {name: 'В графике',  tone: 'good'},
  behind:  {name: 'Отстаём',    tone: 'bad'},
  done:    {name: 'Сделано',    tone: 'violet'},
};
const ITEM_STATUS = {plan: 'В плане', doing: 'Идёт', done: 'Сделано'};

/* ритм команды — одинаков каждую неделю */
const RHYTHM = [
  {when: 'Каждый понедельник, 11:00', what: 'Созвон 45 минут: цифры недели → по направлениям → неделя вперёд → отчёты → идеи и решения', rule: 'Цифры продаж — в «Отчётах» до 11:00. Без цифр направление не выступает.'},
  {when: 'Последний понедельник месяца', what: 'Сверка месяца: шесть показателей план-факт, статус пяти целей, что меняем, деньги и штаб', rule: 'Таблица сверки собрана в «Отчётах» → «Месяц».'},
  {when: 'Первая неделя января', what: 'Кварталка: личная оценка, коэффициент компании, премия, стратегия на следующий квартал', rule: 'Меньше 60 продаж за квартал — премии нет ни у кого.'},
];
function nextCall() {
  const t = today();
  let d = t;
  while (weekday(d) !== 0) d = addDays(d, 1);
  return d;
}
function lastMonday(m) {
  let d = monthEnd(m);
  while (weekday(d) !== 0) d = addDays(d, -1);
  return d;
}
function nextReview() {
  const t = today();
  let d = lastMonday(monthOf(t));
  if (d < t) d = lastMonday(addMonths(monthOf(t), 1));
  return d;
}

const Strategy = {
  doc() { return Store.get('docs', 'strategy') || {}; },
  save(partial) { return Store.patch('docs', 'strategy', partial); },
  goals() { return Object.entries(this.doc().goals || {}).map(([id, g]) => ({...g, id})).filter(g => !g.deleted).sort((a, b) => (a.order ?? 99) - (b.order ?? 99)); },
  goal(id) { const g = (this.doc().goals || {})[id]; return g && !g.deleted ? {...g, id} : null; },
  items() { return Object.entries(this.doc().items || {}).map(([id, x]) => ({...x, id})).filter(x => !x.deleted).sort((a, b) => a.from - b.from || a.to - b.to); },
  miles() { return Object.entries(this.doc().miles || {}).map(([id, x]) => ({...x, id})).filter(x => !x.deleted).sort((a, b) => a.h - b.h); },
  stages() { return this.doc().stages || []; },
  drivers() { return this.doc().drivers || {}; },
  whales() { return this.doc().whales || {}; },
};

App.register('strategy', {
  title: 'Стратегия',
  render(root) {
    const s = settings();
    const sc = s.scenario;
    const pace = quarterPace(sc);
    const goals = Strategy.goals();
    const canEdit = Auth.can('strategy.edit');
    const canCheck = Auth.can('strategy.check');
    const allTasks = Auth.can('tasks.view') ? Tasks.all() : [];

    const goalCards = goals.map((g, i) => {
      const linked = allTasks.filter(t => t.goalId === g.id);
      const done = linked.filter(t => t.status === 'done').length;
      const items = g.items || [];
      const checked = items.filter(x => x.done).length;
      const st = GOAL_STATUS[g.status || ''] || GOAL_STATUS[''];
      return `<article class="goal ${g.status === 'done' ? 'is-done' : ''}">
        <div class="goal-top"><span class="goal-n">${String(i + 1).padStart(2, '0')}</span>
          ${canCheck ? `<select class="select sm goal-st ${st.tone}" data-goal-st="${g.id}" aria-label="Статус цели">${Object.entries(GOAL_STATUS).map(([k, v]) => `<option value="${k}" ${k === (g.status || '') ? 'selected' : ''}>${v.name}</option>`).join('')}</select>` : `<span class="pill ${st.tone}">${st.name}</span>`}
          ${canEdit ? `<button class="icon-btn" data-goal-edit="${g.id}" title="Изменить цель">${icon('edit')}</button>` : ''}
        </div>
        <h3 class="goal-short">${esc(g.short || '')}</h3>
        <p class="goal-title">${esc(g.title || '')}</p>
        <ul class="goal-items">${items.map((x, k) => `<li><label class="check ${x.done ? 'on' : ''}"><input type="checkbox" data-goal-item="${g.id}:${k}" ${x.done ? 'checked' : ''} ${canCheck ? '' : 'disabled'}><span>${esc(x.t)}</span></label></li>`).join('')}</ul>
        ${g.result ? `<p class="goal-result"><span class="label">Результат</span>${esc(g.result)}</p>` : ''}
        <div class="goal-foot">
          <span>${checked}/${items.length} пунктов</span>
          ${Auth.can('tasks.view') ? (linked.length ? `<button class="link-btn" data-goal-tasks="${g.id}">задачи: ${done} из ${linked.length} готово</button>` : '<span title="Откройте задачу и выберите эту цель в поле «Цель квартала»">задачи не привязаны</span>') : ''}
        </div>
      </article>`;
    }).join('');

    /* план продаж по сценариям */
    const scRows = Object.entries(SCENARIOS).map(([k, x]) => {
      const sales = scenarioSales(k);
      const tot = sum(Q.months, m => sales[m]);
      const on = k === sc;
      return `<tr class="${on ? 'sc-on' : ''}">
        <td><label class="sc-pick">${canEdit ? `<input type="radio" name="scPick" value="${k}" ${on ? 'checked' : ''}>` : ''}<b>${x.name}</b></label><div class="note">${esc(x.about)}</div></td>
        ${Q.months.map(m => `<td class="r"><b>${fmt(sales[m])}</b><div class="note">${fmt(Plan.regs(sales[m]))} рег. · ${rubK(sales[m] * s.price).replace(NB + '₽', '')}</div></td>`).join('')}
        <td class="r"><b>${fmt(tot)}</b><div class="note">${rubK(tot * s.price)}</div></td>
      </tr>`;
    }).join('');
    const drivers = Strategy.drivers();
    const driverCards = Q.months.filter(m => drivers[m]).map(m => `<div class="driver"><span class="label">${monthName(m)} · ${fmt(scenarioSales(sc)[m])} продаж</span><b>${esc(drivers[m].title || '')}</b><p>${esc(drivers[m].text || '')}</p></div>`).join('');

    root.innerHTML = `
      ${pageHead('Стратегия', `${Q.name} · 1 октября — 31 декабря. Пять целей, план продаж и дорожная карта года — всё, по чему живёт команда.`, helpBtn('strategy'))}
      ${helpBox('strategy', `<b>Как читать стратегию.</b> Сверху — главная цифра квартала и пять целей: у каждой есть проверяемый результат. Пункты целей отмечают основатель и руководители, статус «в графике / отстаём / сделано» обновляем на сверке в последний понедельник месяца. Задачи привязываются к цели в карточке задачи — тогда прогресс виден прямо здесь.`)}
      <section class="north card">
        <div class="north-main">
          <span class="label">Главная цифра квартала · сценарий «${SCENARIOS[sc].name}»</span>
          <div class="north-num"><b>${fmt(pace.fact)}</b><span>из ${fmt(pace.total)} продаж</span></div>
          ${progress(pace.total ? pace.fact / pace.total : 0, paceTone(pace.fact, pace.planToDate), pace.started ? pace.daysGone / pace.daysAll : null)}
          <p class="note">${pace.started ? (pace.over ? 'Квартал закончился.' : `День ${pace.daysGone} из ${pace.daysAll}. По плану к сегодня — ${fmt(Math.round(pace.planToDate))}. При текущем темпе выйдем ${pace.heading} (≈${fmt(pace.projected)}).`) : `Старт квартала через ${pace.toStart} ${plural(pace.toStart, 'день', 'дня', 'дней')} — 1 октября. Продажа — первая оплата подписки ${rub(s.price)}.`}</p>
        </div>
        <div class="north-side">
          <div><span class="label">Выручка по плану</span><b>${rubK(pace.total * s.price)}</b><small>первые платежи</small></div>
          <div><span class="label">Регистраций нужно</span><b>${fmt(Plan.regs(pace.total))}</b><small>при конверсии ${pctA(s.convPay)}</small></div>
          <div><span class="label">Охват нужен</span><b>${rubK(Plan.reach(pace.total)).replace(NB + '₽', '')}</b><small>при ${pctA(s.convReg)} в регистрацию</small></div>
        </div>
      </section>

      <section class="section">
        <div class="section-head"><h2>Пять целей квартала</h2><span class="hint-inline">Одна дата — 31 декабря</span>
          ${canEdit ? `<button class="btn sm" data-goal-add>${icon('plus')}Цель</button>` : ''}</div>
        ${goals.length ? `<div class="goals">${goalCards}</div>` : `<div class="empty"><b>Цели ещё не заданы</b>${canEdit ? 'Добавьте цели квартала кнопкой «Цель».' : 'Основатель добавит цели квартала.'}</div>`}
      </section>

      <section class="section">
        <div class="section-head"><h2>План продаж</h2><span class="hint-inline">${canEdit ? 'Отметьте сценарий, по которому ведём план — по нему считаются отчёты и Cash Flow' : `Ведём по сценарию «${SCENARIOS[sc].name}»`}</span>
          ${canEdit ? `<button class="btn sm" data-sc-edit>${icon('edit')}Цифры сценариев</button>` : ''}</div>
        <div class="table-wrap"><table class="t sc-table">
          <thead><tr><th>Сценарий</th>${Q.months.map(m => `<th class="r">${monthName(m)}</th>`).join('')}<th class="r">Квартал</th></tr></thead>
          <tbody>${scRows}</tbody></table></div>
        <p class="note sc-note">Регистрации = продажи ÷ ${pctA(s.convPay)} · охват = регистрации ÷ ${pctA(s.convReg)} · удержание ${pctA(s.retention)} добавляет продления сверху. Воронку по шагам меняют в <a href="#metrics">«Метриках»</a>. Премия команды — ${pct(s.premium)} чистого дохода квартала, если продаж не меньше ${s.premiumMin}.</p>
        ${driverCards ? `<div class="drivers">${driverCards}</div>` : ''}
      </section>

      <section class="section">
        <div class="section-head"><h2>Дорожная карта</h2><span class="hint-inline">Этапы года, ключевые точки и работы по направлениям. ${canEdit ? 'Тяните полосу — сдвиг, за край — длительность, нажатие — подробности.' : 'Нажмите на полосу — покажет связанные задачи.'}</span>
          ${canEdit ? `<div class="row"><button class="btn sm" data-item-add="product">${icon('plus')}Работа</button><button class="btn sm" data-mile-add>${icon('flag')}Ключевая точка</button></div>` : ''}</div>
        ${ganttHtml(allTasks)}
      </section>

      <section class="section">
        <div class="section-head"><h2>Три кита и управление</h2><span class="hint-inline">У каждого направления ведущий и метрика недели</span></div>
        <div class="whales">${Object.entries(DIRS).map(([k, d]) => {
          const lead = personById((Strategy.whales()[k] || {}).lead);
          const open = allTasks.filter(t => t.dir === k && Tasks.isOpen(t));
          return `<div class="whale" style="--c:${d.color}">
            <div class="whale-h"><b>${d.name}</b>${Auth.can('tasks.view') ? `<button class="link-btn" data-dir-tasks="${k}">${open.length} ${plural(open.length, 'задача', 'задачи', 'задач')}</button>` : ''}</div>
            <p>${esc(d.about)}</p>
            <div class="whale-m"><span class="label">Метрика недели</span>${esc(d.metric)}</div>
            <div class="whale-lead">${canEdit
              ? `<select class="select sm" data-whale="${k}" aria-label="Ведущий"><option value="">Ведущий не назначен</option>${people().map(p => `<option value="${p.id}" ${lead && lead.id === p.id ? 'selected' : ''}>${esc(personName(p))}</option>`).join('')}</select>`
              : (lead ? `${avatar(lead)}<span>${esc(personName(lead))}</span>` : '<span class="note">Ведущий не назначен</span>')}</div>
          </div>`;
        }).join('')}</div>
      </section>

      <section class="section">
        <div class="section-head"><h2>Ритм команды</h2><span class="hint-inline">Ближайший созвон — ${dayWd(nextCall())}, 11:00 · сверка месяца — ${dayLong(nextReview())}</span></div>
        <div class="rhythm">${RHYTHM.map(r => `<div class="rh"><b>${r.when}</b><p>${r.what}</p><p class="note">${r.rule}</p></div>`).join('')}</div>
      </section>`;

    wireHelp(root);
    on(root, 'change', '[data-goal-item]', (e, el) => {
      const [gid, k] = el.dataset.goalItem.split(':');
      const g = Strategy.goal(gid);
      const items = clone(g.items || []);
      items[k].done = el.checked;
      Strategy.save({goals: {[gid]: {items}}});
    });
    on(root, 'change', '[data-goal-st]', (e, el) => Strategy.save({goals: {[el.dataset.goalSt]: {status: el.value}}}));
    on(root, 'click', '[data-goal-edit]', (e, el) => editGoal(el.dataset.goalEdit));
    on(root, 'click', '[data-goal-add]', () => editGoal(null));
    on(root, 'click', '[data-goal-tasks]', (e, el) => { View.set('t.goal', el.dataset.goalTasks); View.set('t.who', 'all'); View.set('t.chip', 'all'); App.go('tasks'); });
    on(root, 'click', '[data-dir-tasks]', (e, el) => { View.set('t.dir', el.dataset.dirTasks); View.set('t.who', 'all'); View.set('t.chip', 'open'); View.set('t.goal', ''); App.go('tasks'); });
    on(root, 'change', 'input[name=scPick]', (e, el) => { saveSettings({scenario: el.value}); toast(`План ведём по сценарию «${SCENARIOS[el.value].name}»`); });
    on(root, 'click', '[data-sc-edit]', () => editScenarios());
    on(root, 'change', '[data-whale]', (e, el) => Strategy.save({whales: {[el.dataset.whale]: {lead: el.value || null}}}));
    on(root, 'click', '[data-item-add]', (e, el) => openItem(null, {dir: el.dataset.itemAdd || 'product'}));
    on(root, 'click', '[data-mile-add]', () => editMile(null));
    wireGantt(root);
  },
});

/* ── дорожная карта: расчерченная сетка кварталов, месяцев и полумесяцев.
   Полосы работ двигаются зажатием, края растягиваются, ключевые точки
   переезжают по шкале. Шаг — полмесяца. Правит основатель, остальные
   смотрят и открывают связанные задачи. ── */
const G_MONTHS = GANTT_HALVES / 2;
const gPct = h => (h / GANTT_HALVES * 100).toFixed(3) + '%';
const gShort = h => `${h % 2 ? '2-я' : '1-я'} пол. ${MONTHS_SH[monthIdx(hMonth(h))]}${hMonth(h).slice(0, 4) !== '2026' ? ' ' + hMonth(h).slice(2, 4) : ''}`;
const gRange = (a, b) => (a === b ? gShort(a) : `${gShort(a)} → ${gShort(b)}`);

function ganttHtml(allTasks) {
  const items = Strategy.items(), miles = Strategy.miles(), stages = Strategy.stages();
  const canEdit = Auth.can('strategy.edit');
  const months = [];
  for (let i = 0; i < G_MONTHS; i++) months.push(addMonths(GANTT_START, i));
  /* кварталы для верхней строки */
  const qs = [];
  months.forEach((m, i) => {
    const q = Math.floor(monthIdx(m) / 3), key = m.slice(0, 4) + 'q' + q;
    const last = qs[qs.length - 1];
    if (last && last.key === key) last.n++;
    else qs.push({key, i, n: 1, label: `${['I', 'II', 'III', 'IV'][q]} кв. ${m.slice(0, 4)}`});
  });
  const nowH = hOfDate(today());
  const dd = Number(today().slice(8)), dim = daysInMonth(monthOf(today()));
  const nowPos = nowH + (dd <= 15 ? (dd - 1) / 15 : (dd - 16) / (dim - 15));
  const lines = qs.slice(1).map(q => `<i class="gt-ql ${months[q.i].endsWith('-01') ? 'year' : ''}" style="left:${(q.i / G_MONTHS * 100).toFixed(3)}%"></i>`).join('')
    + miles.map(ml => `<i class="gt-ml" style="left:${gPct(ml.h + 0.5)}"></i>`).join('')
    + (nowH >= 0 && nowH < GANTT_HALVES ? `<i class="gt-now" style="left:${gPct(nowPos)}"></i>` : '');
  const nowTag = nowH >= 0 && nowH < GANTT_HALVES ? `<i class="gt-now-tag" style="left:${gPct(nowPos)}">${dayShort(today())}</i>` : '';

  const head = `<div class="gt-head"><div class="gt-lab gt-corner">${canEdit ? 'Тяните полосу — сдвиг,<br>край — длительность' : 'Нажмите на полосу — задачи'}</div><div class="gt-tl">
      <div class="gt-qrow">${qs.map(q => `<div style="width:${(q.n / G_MONTHS * 100).toFixed(3)}%">${q.label}</div>`).join('')}</div>
      <div class="gt-mrow">${months.map(m => `<div class="${m === monthOf(today()) ? 'now' : ''}">${cap(MONTHS_SH[monthIdx(m)])}</div>`).join('')}</div>
      ${nowTag}
    </div></div>`;
  const stageRow = stages.length ? `<div class="gt-row gt-stage-row"><div class="gt-lab"><b>Этапы года</b></div><div class="gt-tl grid">${stages.map((st, i) => {
      const a = hOfDate(st.from + '-01'), b = hOfDate(monthEnd(st.to));
      const here = nowH >= a && nowH <= b;
      return `<div class="gt-stage s${i % 3} ${here ? 'here' : ''}" style="left:${gPct(a)};width:${gPct(b - a + 1)}" title="${esc(st.title)}: ${esc(st.text || '')}"><b>${esc(st.title)}</b>${here ? '<small>мы здесь</small>' : ''}</div>`;
    }).join('')}</div></div>` : '';
  const doneMiles = miles.filter(ml => ml.done).length;
  const mileRow = `<div class="gt-row gt-mile-row"><div class="gt-lab gt-lab-col"><b>Ключевые точки</b><small>${doneMiles} из ${miles.length} достигнуто</small>${canEdit ? `<button class="gt-add" data-mile-add>${icon('plus')}точка</button>` : ''}</div><div class="gt-tl grid" id="gtMiles">${miles.map(ml => {
      const state = ml.done ? 'done' : ml.h < nowH ? 'late' : '';
      return `<div class="gt-mile ${state} ${canEdit ? 'can' : ''}" data-mile="${ml.id}" style="left:${gPct(ml.h + 0.5)}" title="${esc(ml.title)} · ${gShort(ml.h)}${ml.done ? ' · достигнута' : state === 'late' ? ' · срок прошёл' : ''}"><i></i><span>${ml.done ? '✓ ' : ''}${esc(ml.title)}</span></div>`;
    }).join('')}</div></div>`;

  const groups = Object.entries(DIRS).map(([k, d]) => {
    const list = items.filter(x => (x.dir || 'ops') === k);
    const rows = list.map(x => {
      const linked = allTasks.filter(t => t.stratId === x.id);
      const done = linked.filter(t => t.status === 'done').length;
      return `<div class="gt-row"><div class="gt-lab" title="${esc(x.title)}"><span>${esc(x.title)}</span></div><div class="gt-tl grid">
        <div class="gt-bar ${x.status || 'plan'} ${canEdit ? 'can' : ''}" data-item="${x.id}" style="left:${gPct(x.from)};width:${gPct(x.to - x.from + 1)};--c:${d.color}" title="${esc(x.title)} · ${gRange(x.from, x.to)}">
          ${canEdit ? '<i class="gt-hl" data-edge="l"></i><i class="gt-hr" data-edge="r"></i>' : ''}
          <span class="gt-bt">${esc(x.title)}</span>${linked.length ? `<em>${done}/${linked.length}</em>` : ''}</div></div></div>`;
    }).join('');
    return `<div class="gt-dir" style="--c:${d.color}"><div class="gt-lab"><b>${d.name}</b><span>${list.length}</span>${canEdit ? `<button class="gt-add" data-item-add="${k}">${icon('plus')}работа</button>` : ''}</div><div class="gt-tl grid"></div></div>${rows}`;
  }).join('');

  return `<div class="gt-wrap"><div class="gt" id="gantt">${head}<div class="gt-body">${stageRow}${mileRow}${groups}<div class="gt-over">${lines}</div></div></div></div>
    <div class="legend g-legend"><span><i style="background:var(--ink-3)"></i>В плане</span><span><i style="background:var(--violet)"></i>Идёт</span><span><i style="background:var(--good)"></i>Сделано</span><span><i class="g-leg-now"></i>Сегодня</span><span><i class="g-leg-mile"></i>Ключевая точка</span></div>`;
}

/* подписи ключевых точек — по дорожкам, чтобы не наезжали друг на друга */
function layoutMiles(root) {
  const box = $('#gtMiles', root);
  if (!box) return;
  const lanes = [];
  $$('.gt-mile', box).map(el => ({el, x: el.offsetLeft})).sort((a, b) => a.x - b.x).forEach(({el, x}) => {
    const w = el.offsetWidth;
    let lane = lanes.findIndex(r => r < x - 6);
    if (lane < 0) { lane = lanes.length; lanes.push(0); }
    lanes[lane] = x + w;
    el.style.top = (6 + lane * 22) + 'px';
  });
  box.style.height = Math.max(36, 12 + lanes.length * 22) + 'px';
}

function wireGantt(root) {
  const gt = $('#gantt', root);
  if (!gt) return;
  layoutMiles(root);
  const canEdit = Auth.can('strategy.edit');
  let st = null;
  const unit = el => el.closest('.gt-tl').getBoundingClientRect().width / GANTT_HALVES;
  gt.addEventListener('pointerdown', e => {
    const bar = e.target.closest('.gt-bar'), mile = e.target.closest('.gt-mile');
    if (!bar && !mile) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (bar) {
      const x = Strategy.items().find(i => i.id === bar.dataset.item);
      if (!x) return;
      st = {kind: 'bar', el: bar, id: x.id, mode: e.target.dataset.edge || 'm', from: x.from, to: x.to, nf: x.from, nt: x.to, x0: e.clientX, u: unit(bar), moved: false};
    } else {
      const ml = Strategy.miles().find(m => m.id === mile.dataset.mile);
      if (!ml) return;
      st = {kind: 'mile', el: mile, id: ml.id, h: ml.h, nh: ml.h, x0: e.clientX, u: unit(mile), moved: false};
    }
    if (canEdit) { try { st.el.setPointerCapture(e.pointerId); } catch (err) { /* ничего */ } e.preventDefault(); }
  });
  gt.addEventListener('pointermove', e => {
    if (!st || !canEdit) return;
    const dh = Math.round((e.clientX - st.x0) / st.u);
    if (Math.abs(e.clientX - st.x0) > 3) st.moved = true;
    if (!st.moved) return;
    if (st.kind === 'bar') {
      const len = st.to - st.from;
      if (st.mode === 'm') { st.nf = clamp(st.from + dh, 0, GANTT_HALVES - 1 - len); st.nt = st.nf + len; }
      if (st.mode === 'l') { st.nf = clamp(st.from + dh, 0, st.to); st.nt = st.to; }
      if (st.mode === 'r') { st.nt = clamp(st.to + dh, st.from, GANTT_HALVES - 1); st.nf = st.from; }
      st.el.style.left = gPct(st.nf);
      st.el.style.width = gPct(st.nt - st.nf + 1);
      st.el.classList.add('moving');
      st.el.dataset.tip = gRange(st.nf, st.nt);
    } else {
      st.nh = clamp(st.h + dh, 0, GANTT_HALVES - 1);
      st.el.style.left = gPct(st.nh + 0.5);
      st.el.classList.add('moving');
      st.el.dataset.tip = gShort(st.nh);
    }
  });
  const finish = e => {
    if (!st) return;
    const s = st;
    st = null;
    s.el.classList.remove('moving');
    delete s.el.dataset.tip;
    if (!s.moved) {
      if (s.kind === 'bar') openItem(s.id); else if (canEdit) editMile(s.id);
      return;
    }
    if (s.kind === 'bar' && (s.nf !== s.from || s.nt !== s.to)) {
      Strategy.save({items: {[s.id]: {from: s.nf, to: s.nt}}});
      toast(`${Strategy.items().find(i => i.id === s.id).title}: ${gRange(s.nf, s.nt)}`, {undo: () => Strategy.save({items: {[s.id]: {from: s.from, to: s.to}}})});
    }
    if (s.kind === 'mile' && s.nh !== s.h) {
      Strategy.save({miles: {[s.id]: {h: s.nh}}});
      toast(`Ключевая точка: ${gShort(s.nh)}`, {undo: () => Strategy.save({miles: {[s.id]: {h: s.h}}})});
    }
  };
  gt.addEventListener('pointerup', finish);
  gt.addEventListener('pointercancel', () => { if (st) { st.el.classList.remove('moving'); st = null; App.render(); } });
}

const halfOptions = cur => {
  let o = '';
  for (let h = 0; h < GANTT_HALVES; h++) o += `<option value="${h}" ${h === cur ? 'selected' : ''}>${cap(hLabel(h))}</option>`;
  return o;
};

function openItem(id, preset = {}) {
  const x = id ? Strategy.items().find(i => i.id === id) : null;
  const canEdit = Auth.can('strategy.edit');
  const linked = x && Auth.can('tasks.view') ? Tasks.sort(Tasks.all().filter(t => t.stratId === x.id)) : [];
  const tasksHtml = x ? `<div><div class="label">Связанные задачи</div>${linked.length ? `<div class="t-list mini">${linked.map(taskRow).join('')}</div>` : '<p class="note">Задач пока нет. Привяжите задачу к этапу в её карточке.</p>'}</div>` : '';
  if (!canEdit) {
    openModal({title: x.title, body: `<p class="soft">${dirName(x.dir)} · ${cap(hLabel(x.from))} → ${hLabel(x.to)} · ${ITEM_STATUS[x.status || 'plan']}</p>${x.note ? `<p>${esc(x.note)}</p>` : ''}${tasksHtml}`,
      onMount: el => wireTaskCards(el)});
    return;
  }
  const v = x || {title: '', dir: preset.dir || 'product', from: Math.max(0, hOfDate(today())), to: Math.max(1, hOfDate(today()) + 3), status: 'plan', note: ''};
  openModal({
    title: x ? 'Работа на дорожной карте' : 'Новая работа',
    body: `<label class="field"><span>Название</span><input class="input" id="giTitle" value="${esc(v.title)}"></label>
      <div class="grid3">
        <label class="field"><span>Направление</span><select class="select" id="giDir">${Object.entries(DIRS).map(([k, d]) => `<option value="${k}" ${k === v.dir ? 'selected' : ''}>${d.name}</option>`).join('')}</select></label>
        <label class="field"><span>Начало</span><select class="select" id="giFrom">${halfOptions(v.from)}</select></label>
        <label class="field"><span>Конец</span><select class="select" id="giTo">${halfOptions(v.to)}</select></label>
      </div>
      <label class="field"><span>Статус</span><select class="select" id="giSt">${Object.entries(ITEM_STATUS).map(([k, n]) => `<option value="${k}" ${k === (v.status || 'plan') ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="field"><span>Пояснение</span><textarea class="textarea" id="giNote" rows="2">${esc(v.note || '')}</textarea></label>
      ${tasksHtml}`,
    foot: `${x ? `<button class="btn danger left" id="giDel">${icon('trash')}Удалить</button>` : ''}<button class="btn" data-close>Отмена</button><button class="btn primary" id="giSave">Сохранить</button>`,
    wide: !!linked.length,
    onMount(el, close) {
      wireTaskCards(el);
      $('#giSave', el).onclick = () => {
        const title = $('#giTitle', el).value.trim();
        if (!title) { $('#giTitle', el).focus(); return; }
        let from = Number($('#giFrom', el).value), to = Number($('#giTo', el).value);
        if (to < from) [from, to] = [to, from];
        Strategy.save({items: {[x ? x.id : uid()]: {title, dir: $('#giDir', el).value, from, to, status: $('#giSt', el).value, note: $('#giNote', el).value, deleted: false}}});
        close();
      };
      const del = $('#giDel', el);
      if (del) del.onclick = async () => {
        if (!(await confirmPop(del, {text: 'Убрать работу с дорожной карты?', yes: 'Да, убрать', danger: true}))) return;
        Strategy.save({items: {[x.id]: {deleted: true}}});
        close();
        toast('Работа убрана', {undo: () => Strategy.save({items: {[x.id]: {deleted: false}}})});
      };
    },
  });
}

function editMile(id) {
  const ml = id ? Strategy.miles().find(m => m.id === id) : null;
  const v = ml || {title: '', h: Math.max(0, hOfDate(today()) + 2)};
  openModal({
    title: ml ? 'Ключевая точка' : 'Новая ключевая точка',
    body: `<label class="field"><span>Что должно случиться</span><input class="input" id="gmTitle" value="${esc(v.title)}" placeholder="Например: первые 100 платящих"></label>
      <label class="field"><span>Когда</span><select class="select" id="gmH">${halfOptions(v.h)}</select></label>
      <label class="field"><span>Что считаем достижением</span><input class="input" id="gmNote" value="${esc(v.note || '')}" placeholder="Например: 100 оплат по подписке"></label>
      <label class="check"><input type="checkbox" id="gmDone" ${v.done ? 'checked' : ''}>Достигнута</label>`,
    foot: `${ml ? `<button class="btn danger left" id="gmDel">${icon('trash')}Удалить</button>` : ''}<button class="btn" data-close>Отмена</button><button class="btn primary" id="gmSave">Сохранить</button>`,
    onMount(el, close) {
      $('#gmSave', el).onclick = () => {
        const title = $('#gmTitle', el).value.trim();
        if (!title) return $('#gmTitle', el).focus();
        Strategy.save({miles: {[ml ? ml.id : uid()]: {title, h: Number($('#gmH', el).value), note: $('#gmNote', el).value.trim(), done: $('#gmDone', el).checked, deleted: false}}});
        close();
      };
      const del = $('#gmDel', el);
      if (del) del.onclick = async () => {
        if (!(await confirmPop(del, {text: 'Удалить ключевую точку?', yes: 'Да, удалить', danger: true}))) return;
        Strategy.save({miles: {[ml.id]: {deleted: true}}});
        close();
      };
    },
  });
}

function editGoal(id) {
  const g = id ? Strategy.goal(id) : null;
  const v = g || {short: '', title: '', result: '', items: []};
  openModal({
    title: g ? 'Цель квартала' : 'Новая цель',
    body: `<div class="grid2"><label class="field"><span>Коротко</span><input class="input" id="ggShort" value="${esc(v.short)}" placeholder="Запуск"></label>
      <label class="field"><span>Направление</span><select class="select" id="ggDir"><option value="">—</option>${Object.entries(DIRS).map(([k, d]) => `<option value="${k}" ${k === v.dir ? 'selected' : ''}>${d.name}</option>`).join('')}</select></label></div>
      <label class="field"><span>Цель целиком</span><input class="input" id="ggTitle" value="${esc(v.title)}" placeholder="Компания, оплаты и платформа на рабочем адресе"></label>
      <label class="field"><span>Пункты — по одному в строке</span><textarea class="textarea" id="ggItems" rows="4">${esc((v.items || []).map(x => x.t).join('\n'))}</textarea><small>Отметки у существующих пунктов сохранятся.</small></label>
      <label class="field"><span>Результат — как проверим одним вопросом</span><input class="input" id="ggResult" value="${esc(v.result || '')}" placeholder="Женщина регистрируется и оплачивает сама"></label>`,
    foot: `${g ? `<button class="btn danger left" id="ggDel">${icon('trash')}Удалить</button>` : ''}<button class="btn" data-close>Отмена</button><button class="btn primary" id="ggSave">Сохранить</button>`,
    onMount(el, close) {
      $('#ggSave', el).onclick = () => {
        const short = $('#ggShort', el).value.trim(), title = $('#ggTitle', el).value.trim();
        if (!short && !title) return $('#ggShort', el).focus();
        const old = Object.fromEntries((v.items || []).map(x => [x.t, x.done]));
        const items = $('#ggItems', el).value.split('\n').map(s => s.trim()).filter(Boolean).map(t => ({t, done: !!old[t]}));
        const gid = g ? g.id : uid();
        const order = g ? g.order : (Strategy.goals().length + 1);
        Strategy.save({goals: {[gid]: {short, title, items, result: $('#ggResult', el).value.trim(), dir: $('#ggDir', el).value, order, deleted: false}}});
        close();
      };
      const del = $('#ggDel', el);
      if (del) del.onclick = async () => {
        if (!(await confirmPop(del, {text: 'Удалить цель? Задачи останутся, связь с целью пропадёт.', yes: 'Да, удалить', danger: true}))) return;
        Strategy.save({goals: {[g.id]: {deleted: true}}});
        close();
        toast('Цель удалена', {undo: () => Strategy.save({goals: {[g.id]: {deleted: false}}})});
      };
    },
  });
}

function editScenarios() {
  const s = settings();
  const inputs = Object.entries(SCENARIOS).map(([k, x]) => `<tr><td><b>${x.name}</b></td>${Q.months.map(m => `<td><input class="input num sm" data-scv="${k}:${m}" inputmode="numeric" value="${scenarioSales(k)[m]}"></td>`).join('')}</tr>`).join('');
  openModal({
    title: 'Цифры сценариев',
    body: `<p class="note">Продажи (первые оплаты) по месяцам. Регистрации и охват пересчитаются сами по конверсиям ниже.</p>
      <div class="table-wrap"><table class="t"><thead><tr><th></th>${Q.months.map(m => `<th>${monthName(m)}</th>`).join('')}</tr></thead><tbody>${inputs}</tbody></table></div>
      <div class="grid3">
        <label class="field"><span>Цена подписки, ₽</span><input class="input num" id="scPrice" inputmode="numeric" value="${s.price}"></label>
        <label class="field"><span>Регистрация → оплата, %</span><input class="input num" id="scConv" inputmode="decimal" value="${fmt(s.convPay * 100, 1)}"></label>
        <label class="field"><span>Охват → регистрация, %</span><input class="input num" id="scReach" inputmode="decimal" value="${fmt(s.convReg * 100, 1)}"></label>
        <label class="field"><span>Удержание, %</span><input class="input num" id="scRet" inputmode="decimal" value="${fmt(s.retention * 100, 0)}"></label>
        <label class="field"><span>Реферальные, % выручки</span><input class="input num" id="scRef" inputmode="decimal" value="${fmt(s.referral * 100, 0)}"></label>
        <label class="field"><span>Премия команды, %</span><input class="input num" id="scPrem" inputmode="decimal" value="${fmt(s.premium * 100, 0)}"></label>
      </div>`,
    foot: `<button class="btn left" id="scReset">Вернуть план квартала</button><button class="btn" data-close>Отмена</button><button class="btn primary" id="scSave">Сохранить</button>`,
    wide: true,
    onMount(el, close) {
      $('#scSave', el).onclick = () => {
        const plans = {};
        $$('[data-scv]', el).forEach(i => { const [k, m] = i.dataset.scv.split(':'); (plans[k] = plans[k] || {})[m] = Math.max(0, Math.round(parseNum(i.value))); });
        saveSettings({plans, price: Math.max(1, parseNum($('#scPrice', el).value)), convPay: parseNum($('#scConv', el).value) / 100 || 0.05,
          convReg: parseNum($('#scReach', el).value) / 100 || 0.02, retention: clamp(parseNum($('#scRet', el).value) / 100, 0, 1),
          referral: clamp(parseNum($('#scRef', el).value) / 100, 0, 1), premium: clamp(parseNum($('#scPrem', el).value) / 100, 0, 1)});
        close();
        toast('Цифры сценариев сохранены');
      };
      $('#scReset', el).onclick = () => {
        $$('[data-scv]', el).forEach(i => { const [k, m] = i.dataset.scv.split(':'); i.value = SCENARIOS[k].sales[m]; });
      };
    },
  });
}