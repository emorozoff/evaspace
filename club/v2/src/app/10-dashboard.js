/* Главная: как идём (продажи, деньги, задачи), что ждёт меня сегодня,
   темп квартала и материалы — стандарты и презентации. Состав зависит
   от роли: инвестор видит цифры и материалы, команда — ещё и свои задачи. */

function paceChart(sc) {
  const days = [];
  for (let d = Q.start; d <= Q.end; d = addDays(d, 1)) days.push(d);
  const t = today();
  const plans = Object.keys(SCENARIOS).map(k => {
    let acc = 0;
    return {k, values: days.map(d => { acc += Plan.day(k, d); return Math.round(acc); })};
  });
  const byDay = byKey(Sales.list(), 'id');
  let acc = 0;
  const fact = days.map(d => { if (d > t) return null; acc += Number((byDay[d] || {}).pays) || 0; return acc; });
  const labels = days.map(d => ({text: dayLong(d), tick: d.endsWith('-01') ? dayShort(d) : d === Q.end ? dayShort(d) : ''}));
  const series = plans.reverse().map(p => ({
    values: p.values, color: 'var(--ink-2)', dash: true, width: p.k === sc ? 2 : 1.5, opacity: p.k === sc ? 1 : 0.45,
    endLabel: `${SCENARIOS[p.k].name} ${fmt(Plan.total(p.k))}`, legend: p.k === sc ? `План «${SCENARIOS[p.k].name}»` : '',
  }));
  if (t >= Q.start) series.push({values: fact, color: 'var(--rose)', area: true, dot: true, width: 2.5, legend: 'Продано', endLabel: t <= Q.end ? `${fmt(acc)} сейчас` : '', labelAbove: true});
  else series.push({values: fact.map(() => null), color: 'var(--rose)', legend: 'Продано'});
  return lineChart({labels, series, height: 250});
}

App.register('home', {
  title: 'Главная',
  render(root) {
    const me = Auth.me(), role = Auth.role(), s = settings(), sc = s.scenario;
    const pace = quarterPace(sc);
    const t = today();
    const hour = new Date().getHours();
    const hello = hour < 5 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
    const name = firstName(Auth.person() || {name: me.name});
    const qStat = Sales.range(Q.start, Q.end);
    const planRev = sum(Plan.chain(sc).filter(c => Q.months.includes(c.m)), c => c.revNew + c.revRenew);
    const teamRoles = Auth.can('tasks.view');
    const allT = teamRoles ? Tasks.all() : [];
    const myOpen = allT.filter(x => Tasks.mine(x) && Tasks.isOpen(x));
    const overdueAll = allT.filter(x => Tasks.overdue(x));
    const acts = teamRoles ? Inbox.actions() : {review: [], budget: [], late: [], soon: []};
    const review = acts.review;

    /* показатели */
    const tiles = [];
    tiles.push(`<div class="card stat"><span class="label">Продажи квартала</span>
      <div class="big">${fmt(pace.fact)} <small>из ${fmt(pace.total)}</small></div>
      ${progress(pace.total ? pace.fact / pace.total : 0, paceTone(pace.fact, pace.planToDate), pace.started ? pace.daysGone / pace.daysAll : null)}
      <div class="foot">${pace.started ? `по плану к сегодня ${fmt(Math.round(pace.planToDate))} · темп ${pace.heading}` : `старт 1 октября, через ${pace.toStart} ${plural(pace.toStart, 'день', 'дня', 'дней')}`}</div></div>`);
    if (Auth.can('money.view')) {
      tiles.push(`<div class="card stat"><span class="label">Выручка квартала</span>
        <div class="big">${rubK(qStat.revenue)}</div>${progress(planRev ? qStat.revenue / planRev : 0, 'good')}
        <div class="foot">план ${rubK(planRev)} с продлениями</div></div>`);
      const cf = cashFlow(sc);
      const last = cf[cf.length - 1], min = Math.min(...cf.map(r => r.close));
      tiles.push(`<div class="card stat"><span class="label">Деньги на счёте</span>
        <div class="big">${rubK(Money.cashNow())}</div>
        <div class="foot ${min < 0 ? 'bad' : ''}">${min < 0 ? `к декабрю не хватит ${rubK(-min)} — нужен раунд` : `к 31 декабря по прогнозу ${rubK(last.close)}`}</div></div>`);
    } else {
      tiles.push(`<div class="card stat"><span class="label">Регистрации квартала</span>
        <div class="big">${fmt(qStat.regs)} <small>из ${fmt(Plan.regs(pace.total))}</small></div>${progress(qStat.regs / Math.max(1, Plan.regs(pace.total)), 'good')}
        <div class="foot">конверсия в оплату ${qStat.regs ? pct(qStat.pays / qStat.regs, 1) : '—'} при плане ${pct(s.convPay)}</div></div>`);
    }
    if (teamRoles) {
      const mgr = Tasks.manager();
      const open = mgr ? allT.filter(x => Tasks.isOpen(x)).length : myOpen.length;
      const late = mgr ? overdueAll.length : myOpen.filter(x => Tasks.overdue(x)).length;
      tiles.push(`<a class="card stat as-link" href="#tasks"><span class="label">${mgr ? 'Задачи команды' : 'Мои задачи'}</span>
        <div class="big">${fmt(open)} <small>открыто</small></div>
        <div class="foot"><span class="${late ? 'bad' : ''}">${late} просрочено</span> · ${review.length} ждут вашего согласования</div></a>`);
    }
    if (role === 'member') {
      const prem = premiumOf(qStat.pays, qStat.revNew);
      tiles.push(`<div class="card stat"><span class="label">Премия команды за квартал</span>
        <div class="big">${rubK(prem)}</div>
        <div class="foot">${qStat.pays < s.premiumMin ? `начисляется от ${s.premiumMin} продаж — осталось ${s.premiumMin - qStat.pays}` : `${pct(s.premium)} чистого дохода по факту`}</div></div>`);
    }

    /* что ждёт меня */
    let focus = '';
    if (Tasks.manager()) {
      const unpaid = Auth.can('money.edit') ? Money.planItems().filter(it => Money.planAmount(it, monthOf(t)) && !Money.paid(it, monthOf(t))) : [];
      const rows = [
        ...review.slice(0, 5).map(x => ({html: `<span class="pill gold">на согласовании</span>${esc(x.title)}`, who: personById(x.assignee), id: x.id})),
        ...acts.budget.slice(0, 4).map(x => ({html: `<span class="pill gold">бюджет ${rubK(Number(x.budget))}</span>${esc(x.title)}`, who: personById(x.createdBy), id: x.id})),
        ...overdueAll.filter(x => x.status !== 'review').sort((a, b) => (Tasks.due(a) < Tasks.due(b) ? -1 : 1)).slice(0, 5).map(x => ({html: `<span class="pill bad">срок ${dayShort(Tasks.due(x))}</span>${esc(x.title)}`, who: personById(x.assignee), id: x.id})),
      ];
      focus = `<div class="card"><div class="card-head"><h2>Ждут решения</h2><a class="link-btn" href="#tasks">Все задачи</a></div>
        ${rows.length ? `<div class="focus-list">${rows.map(r => `<button class="focus-row" data-open-task="${r.id}"><span class="fr-t">${r.html}</span>${avatar(r.who)}</button>`).join('')}</div>` : '<p class="note">Ничего не ждёт согласования и нет просроченных задач.</p>'}
        ${unpaid.length ? `<div class="focus-pay"><span class="label">Платежи ${MONTHS_GEN[monthIdx(monthOf(t))]} по плану</span>${unpaid.slice(0, 4).map(it => `<a href="#money" class="fp-row"><span>${esc(it.group === 'payroll' && !Auth.can('payroll.view') ? 'Оплата труда' : it.title)}</span><b>${rub(Money.planAmount(it, monthOf(t)))}</b></a>`).join('')}${unpaid.length > 4 ? `<a href="#money" class="note">ещё ${unpaid.length - 4}</a>` : ''}</div>` : ''}
      </div>`;
    } else if (teamRoles) {
      const list = Tasks.sort(myOpen).slice(0, 7);
      focus = `<div class="card"><div class="card-head"><h2>Мои задачи</h2><a class="link-btn" href="#tasks">Все мои задачи</a></div>
        ${list.length ? `<div class="t-list mini">${list.map(taskRow).join('')}</div>` : '<p class="note">Открытых задач нет. Возьмите задачу у ведущего своего направления или добавьте свою в «Задачах».</p>'}</div>`;
    } else {
      const goals = Strategy.goals();
      focus = `<div class="card"><div class="card-head"><h2>Цели квартала</h2><a class="link-btn" href="#strategy">Стратегия</a></div>
        ${goals.length ? `<div class="focus-list">${goals.map(g => { const st = GOAL_STATUS[g.status || ''] || GOAL_STATUS['']; const it = g.items || []; return `<a class="focus-row" href="#strategy"><span class="fr-t"><span class="pill ${st.tone}">${st.name}</span><b>${esc(g.short || '')}</b> ${esc(g.title || '')}</span><span class="note">${it.filter(x => x.done).length}/${it.length}</span></a>`; }).join('')}</div>` : '<p class="note">Цели появятся после утверждения.</p>'}</div>`;
    }

    /* сегодня: цифры и ритм */
    const todays = Sales.day(t);
    const by = todays ? personById(todays.by) : null;
    /* лента: свежие правки других людей; сотруднику — только по его задачам */
    const since = Date.now() - 14 * 864e5, mk = Tasks.meKey();
    const feed = teamRoles ? allT.filter(x => x.updatedBy && x.updatedBy !== mk && (x.updatedAt || 0) > since
      && (Tasks.manager() || x.assignee === Auth.personId() || x.createdBy === mk)).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5) : [];
    const side = `<div class="card today">
      <div class="card-head"><h2>Сегодня, ${dayLong(t)}</h2></div>
      <div class="today-row ${todays ? 'ok' : 'wait'}">
        <div><b>${todays ? `Цифры внесены: ${fmt(todays.pays || 0)} ${plural(todays.pays || 0, 'оплата', 'оплаты', 'оплат')}, ${fmt(todays.regs || 0)} рег.` : 'Цифры за сегодня ещё не внесены'}</b>
        <span class="note">${todays ? `${by ? personName(by) : ''} · ${timeAgo(todays.at)}` : 'Охват, регистрации и оплаты — до созвона, чтобы на нём принимать решения'}</span></div>
        ${Auth.can('sales.edit') ? `<a class="btn sm ${todays ? '' : 'primary'}" href="#reports">${todays ? 'Поправить' : 'Внести'}</a>` : ''}
      </div>
      <div class="today-rh">
        <div>${icon('cal')}<span><b>Созвон — ${weekday(t) === 0 && t === nextCall() ? 'сегодня' : dayWd(nextCall())}, 11:00</b><small>45 минут, цифры заранее</small></span></div>
        <div>${icon('flag')}<span><b>Сверка месяца — ${dayLong(nextReview())}</b><small>последний понедельник месяца</small></span></div>
      </div>
      ${teamRoles ? todayMeetingsHtml() : ''}
      ${feed.length ? `<div class="feed"><span class="label">Что нового в задачах</span>${feed.map(x => { const p = personById(x.updatedBy); return `<button class="feed-row" data-open-task="${x.id}">${avatar(p)}<span><span><b>${esc(p ? firstName(p) : 'Кто-то')}</b> · ${esc(x.title)}</span><small>${STATUSES[x.status].name} · ${timeAgo(x.updatedAt)}</small></span></button>`; }).join('')}</div>` : ''}
    </div>`;

    /* с чего начать — для новых людей в команде */
    const startKey = 'eva-hq-start-' + me.id;
    const started = Local.get(startKey, null);
    const showStart = teamRoles && role !== 'owner' && !started && (Date.now() - (me.createdAt || 0) < 30 * 864e5);
    const start = showStart ? `<div class="help start"><div><b>С чего начать в штабе</b><ol>
        <li>Прочитайте <a href="#m-standards">Книгу стандартов</a> и пройдите тест в конце — это час.</li>
        <li>Откройте <a href="#tasks">свои задачи</a>: всё новое для вас — в блоке «Для вас». Сделали — «Готово», задача уйдёт постановщику на согласование.</li>
        <li>Если ведёте продажи или трафик — вносите цифры дня в <a href="#reports">«Отчётах»</a> до созвона.</li>
        <li>Созвон — каждый понедельник в 11:00. «Квартал команды» — в материалах ниже.</li></ol></div>
      <button class="btn xs ghost x" data-start-hide>Понятно</button></div>` : '';

    root.innerHTML = `
      ${pageHead(`${hello}, ${esc(name)}`, `${cap(dayWd(t))} · ${Q.name}: ${pace.started ? (pace.over ? 'квартал закрыт' : `день ${pace.daysGone} из ${pace.daysAll}`) : `до старта ${pace.toStart} ${plural(pace.toStart, 'день', 'дня', 'дней')}`} · ведём план «${SCENARIOS[sc].name}»`,
        `${Auth.can('sales.edit') ? `<a class="btn" href="#reports">${icon('chart')}Цифры дня</a>` : ''}${teamRoles ? `<button class="btn primary" data-new-task>${icon('plus')}Задача</button>` : ''}`)}
      ${start}
      <div class="cards tiles">${tiles.join('')}</div>
      <div class="split section">${focus}${side}</div>
      <section class="section card">
        <div class="card-head"><h2>Темп продаж квартала</h2><span class="note">накопительно, первые оплаты · пунктир — планы трёх сценариев</span></div>
        ${paceChart(sc)}
      </section>
      <section class="section">
        <div class="section-head"><h2>Стандарты и презентации</h2><span class="hint-inline">Смотрите прямо здесь — для команды, инвесторов и экспертов</span></div>
        ${materialsHtml()}
      </section>`;

    on(root, 'click', '[data-open-task]', (e, el) => openTask(el.dataset.openTask));
    on(root, 'click', '[data-new-task]', () => openTask(null));
    on(root, 'click', '[data-start-hide]', () => { Local.set(startKey, 1); App.render(); });
    wireTaskCards(root);
    wireMaterials(root);
  },
});