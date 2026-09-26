/* Отчёты до Нового года: цифры дня → как идём сегодня, за неделю, месяц
   и квартал против плана → Cash Flow с прогнозом. Цифры вносит команда
   каждый день (охват, регистрации, оплаты), выручка считается сама. */

const SALES_FIELDS = [
  ['reach', 'Охват', 'сколько людей увидели нас'],
  ['views', 'Просмотры', 'посмотрели ролик или пост'],
  ['clicks', 'Переходы', 'перешли на сайт или в приложение'],
  ['regs', 'Регистрации', 'новые учётки в приложении'],
  ['pays', 'Оплаты', 'первые оплаты — это продажи'],
  ['renewals', 'Продления', 'повторные оплаты подписки'],
];
const PRODUCT_FIELDS = [
  ['experts', 'Новые эксперты', 'подписали оферту'],
  ['mk', 'Мастер-классы', 'сняты и опубликованы'],
];
const RepUI = {date: null, drafts: {}};

App.register('reports', {
  title: 'Отчёты',
  render(root) {
    const s = settings();
    const sc = View.get('r.sc', s.scenario);
    const tab = View.get('r.tab', 'day');
    const pace = quarterPace(sc);
    const t = today();

    const period = (name, from, to, sub) => {
      const f = Sales.range(from, to);
      const plan = Plan.range(sc, from, to);
      const share = plan ? f.pays / plan : null;
      return `<div class="card stat period">
        <span class="label">${name}</span>
        <div class="big">${fmt(f.pays)} <small>${plan ? `из ${fmt(Math.round(plan))}` : 'продаж'}</small></div>
        ${plan ? progress(share, paceTone(f.pays, plan)) : '<div class="bar"></div>'}
        <div class="foot">${fmt(f.regs)} рег. · ${rubK(f.revenue)}${plan ? ` · <b class="${paceTone(f.pays, plan)}">${pct(share)}</b> плана` : ''}</div>
        <div class="foot">${sub}</div></div>`;
    };
    const ws = weekStart(t), qFrom = Q.start;
    const strip = `<div class="cards periods">
      ${period('Сегодня', t, t, dayWd(t))}
      ${period('Неделя', ws, addDays(ws, 6), weekLabel(ws))}
      ${period('Месяц', monthStart(monthOf(t)), monthEnd(monthOf(t)), monthName(monthOf(t)) + (monthOf(t) === '2026-09' ? ' · подготовка, без плана' : ''))}
      ${period('Квартал', qFrom, Q.end, pace.started ? `день ${pace.daysGone} из ${pace.daysAll}` : `старт через ${pace.toStart} ${plural(pace.toStart, 'день', 'дня', 'дней')}`)}
    </div>`;
    const paceLine = pace.started && !pace.over
      ? `<div class="pace-line ${paceTone(pace.fact, pace.planToDate)}">${icon('chart')}<span>При текущем темпе квартал закончится на <b>≈${fmt(pace.projected)}</b> продажах — это ${pace.heading}. Чтобы выйти на «${SCENARIOS[sc].name}» (${fmt(pace.total)}), нужно <b>${fmt(Math.ceil(pace.needPerDay))} в день</b> до 31 декабря.</span></div>`
      : pace.over ? '' : `<div class="pace-line">${icon('cal')}<span>Квартал стартует 1 октября. План «${SCENARIOS[sc].name}»: ${fmt(scenarioSales(sc)['2026-10'])} продаж в октябре — это ${fmt(Math.ceil(scenarioSales(sc)['2026-10'] / 31))} в день.</span></div>`;

    root.innerHTML = `
      ${pageHead('Отчёты', 'Как идём каждый день, неделю и месяц — против плана квартала. Внизу — Cash Flow с прогнозом до Нового года.',
        `<div class="seg" title="Сравнить со сценарием">${Object.entries(SCENARIOS).map(([k, x]) => `<button data-sc="${k}" class="${k === sc ? 'on' : ''}">${x.name} ${fmt(Plan.total(k))}</button>`).join('')}</div>${helpBtn('reports')}`)}
      ${helpBox('reports', `<b>Как вносить цифры.</b> Каждый день до вечера (и обязательно до созвона в понедельник, 11:00) откройте «Цифры дня», выберите дату и впишите охват, регистрации и оплаты. Выручка посчитается сама: оплаты и продления × ${rub(s.price)} — поправьте, если были годовые тарифы или скидки. Внести может любой в команде, исправить — тоже: видно, кто внёс последним. Сценарий сверху только меняет сравнение — план команды выбирает основатель в «Стратегии».`)}
      ${Auth.can('sales.edit') ? entryHtml() : ''}
      ${strip}
      ${paceLine}
      <div class="tabs rep-tabs" role="tablist">
        <button data-tab="day" class="${tab === 'day' ? 'on' : ''}">По дням</button>
        <button data-tab="week" class="${tab === 'week' ? 'on' : ''}">По неделям</button>
        <button data-tab="month" class="${tab === 'month' ? 'on' : ''}">По месяцам · сверка</button>
      </div>
      <div id="repView">${tab === 'week' ? weekView(sc) : tab === 'month' ? monthView(sc) : dayView(sc)}</div>
      ${Auth.can('cf.view') ? cashFlowHtml(sc) : ''}`;

    wireHelp(root);
    on(root, 'click', '[data-sc]', (e, el) => { View.set('r.sc', el.dataset.sc); App.render(); });
    on(root, 'click', '[data-tab]', (e, el) => { View.set('r.tab', el.dataset.tab); App.render(); });
    on(root, 'click', '[data-rm]', (e, el) => { View.set('r.month', el.dataset.rm); App.render(); });
    on(root, 'click', '[data-day]', (e, el) => {
      if (!Auth.can('sales.edit')) return;
      RepUI.date = el.dataset.day;
      App.render({focus: 'se-reach'});
      const f = $('#salesForm'); if (f) f.scrollIntoView({block: 'center', behavior: 'smooth'});
    });
    if (Auth.can('sales.edit')) wireEntry(root);
  },
});

/* ── цифры дня ── */
function entryHtml() {
  const d = RepUI.date || today();
  const rec = Sales.day(d);
  const dr = RepUI.drafts[d] || (rec ? {...rec} : {});
  const by = rec ? personById(rec.by) : null;
  const price = settings().price;
  const auto = ((Number(dr.pays) || 0) + (Number(dr.renewals) || 0)) * price;
  const val = k => (dr[k] === undefined || dr[k] === null ? '' : dr[k]);
  const inp = ([k, name, hint]) => `<label class="field"><span>${name}</span><input class="input num" id="se-${k}" data-sf="${k}" inputmode="numeric" value="${esc(val(k))}" placeholder="0"><small>${hint}</small></label>`;
  return `<form class="card entry" id="salesForm" autocomplete="off">
    <div class="entry-head">
      <h2>Цифры дня</h2>
      <div class="entry-date">
        <button type="button" class="icon-btn" data-shift="-1" aria-label="Предыдущий день">${icon('back')}</button>
        <input class="input sm" type="date" id="seDate" value="${d}" min="2026-09-01" max="2027-01-31">
        <button type="button" class="icon-btn" data-shift="1" aria-label="Следующий день" style="transform:scaleX(-1)">${icon('back')}</button>
        ${d !== today() ? '<button type="button" class="btn xs ghost" data-shift="0">Сегодня</button>' : ''}
      </div>
      <span class="note">${rec ? `внесено${by ? ': ' + esc(personName(by)) : ''}, ${timeAgo(rec.at)}` : 'за этот день ещё ничего'}</span>
    </div>
    <div class="entry-grid">${SALES_FIELDS.map(inp).join('')}
      <label class="field"><span>Выручка, ₽</span><input class="input num" id="se-revenue" data-sf="revenue" inputmode="numeric" value="${esc(val('revenue'))}" placeholder="${fmt(auto)}"><small>само: ${fmt(auto)} ₽ — поправьте при годовых</small></label>
    </div>
    <details class="entry-more" ${dr.experts || dr.mk || dr.note ? 'open' : ''}><summary>Продукт и заметка</summary>
      <div class="entry-grid">${PRODUCT_FIELDS.map(inp).join('')}
        <label class="field entry-note"><span>Заметка</span><input class="input" id="se-note" data-sf="note" value="${esc(val('note'))}" placeholder="Что повлияло на цифры: эфир, рассылка, сбой оплаты" maxlength="200"></label></div>
    </details>
    <div class="entry-foot">
      <span class="note">${[dr.reach && dr.views ? `просмотр ${pct(dr.views / dr.reach, 1)}` : '', dr.views && dr.clicks ? `переход ${pct(dr.clicks / dr.views, 1)}` : '', dr.clicks && dr.regs ? `регистрация ${pct(dr.regs / dr.clicks, 1)}` : dr.reach && dr.regs ? `охват → регистрация ${pct(dr.regs / dr.reach, 1)}` : '', dr.regs && dr.pays ? `покупка ${pct(dr.pays / dr.regs, 1)}` : ''].filter(Boolean).join(' · ')}</span>
      ${rec && Auth.can('tasks.manage') ? '<button type="button" class="btn ghost sm" id="seDel">Удалить день</button>' : ''}
      <button class="btn primary" type="submit">${rec ? 'Обновить' : 'Сохранить'} цифры за ${dayLong(d)}</button>
    </div>
  </form>`;
}
function wireEntry(root) {
  const form = $('#salesForm', root);
  if (!form) return;
  const d = () => RepUI.date || today();
  on(form, 'input', '[data-sf]', (e, el) => {
    const k = el.dataset.sf;
    const dr = RepUI.drafts[d()] = RepUI.drafts[d()] || {...(Sales.day(d()) || {})};
    dr[k] = k === 'note' ? el.value : (el.value === '' ? '' : Math.max(0, Math.round(parseNum(el.value))));
    if (k === 'pays' || k === 'renewals') {
      const auto = ((Number(dr.pays) || 0) + (Number(dr.renewals) || 0)) * settings().price;
      const r = $('#se-revenue', form); r.placeholder = fmt(auto);
      $('#se-revenue', form).nextElementSibling.textContent = `само: ${fmt(auto)} ₽ — поправьте при годовых`;
    }
  });
  on(form, 'click', '[data-shift]', (e, el) => {
    const n = Number(el.dataset.shift);
    RepUI.date = n === 0 ? today() : addDays(d(), n);
    App.render();
  });
  $('#seDate', form).onchange = e => { if (e.target.value) { RepUI.date = e.target.value; App.render(); } };
  const del = $('#seDel', form);
  if (del) del.onclick = async () => {
    if (!(await confirmPop(del, {text: `Удалить цифры за ${dayLong(d())}?`, yes: 'Да, удалить', danger: true}))) return;
    const copy = clone(Sales.day(d()));
    Store.remove('sales', d());
    delete RepUI.drafts[d()];
    toast('Цифры дня удалены', {undo: () => Store.put('sales', copy.id, copy)});
  };
  form.onsubmit = e => {
    e.preventDefault();
    const day = d();
    const rec = {};
    $$('[data-sf]', form).forEach(el => {
      const k = el.dataset.sf;
      if (k === 'note') { if (el.value.trim()) rec.note = el.value.trim(); return; }
      if (el.value.trim() !== '') rec[k] = Math.max(0, Math.round(parseNum(el.value)));
    });
    if (!Object.keys(rec).length) { toast('Впишите хотя бы одну цифру'); return; }
    Store.put('sales', day, {...rec, by: Tasks.meKey(), at: Date.now()});
    delete RepUI.drafts[day];
    toast(`Цифры за ${dayLong(day)} сохранены`);
    App.render();
  };
}

/* ── по дням ── */
function dayView(sc) {
  const t = today();
  const months = CF_MONTHS.filter(m => m <= monthOf(t) || m === Q.months[0]);
  let m = View.get('r.month', monthOf(t));
  if (!CF_MONTHS.includes(m)) m = CF_MONTHS.includes(monthOf(t)) ? monthOf(t) : Q.months[0];
  const days = [];
  for (let d = monthStart(m); d <= monthEnd(m); d = addDays(d, 1)) days.push(d);
  const byDay = byKey(Sales.list(), 'id');
  const chart = barChart({
    labels: days.map(d => ({text: dayWd(d), tick: String(Number(d.slice(8)))})),
    values: days.map(d => (d <= t ? Number((byDay[d] || {}).pays) || 0 : 0)),
    plan: Q.months.includes(m) ? days.map(d => Math.round(Plan.day(sc, d) * 10) / 10) : null,
    highlight: days.indexOf(t),
  });
  const rows = days.filter(d => d <= t || byDay[d]).reverse();
  const table = rows.length ? `<div class="table-wrap"><table class="t days">
    <thead><tr><th>День</th><th class="r">Охват</th><th class="r">Просм.</th><th class="r">Перех.</th><th class="r">Регистрации</th><th class="r">Оплаты</th><th class="r">Продления</th><th class="r">Выручка</th><th class="r">Рег. → оплата</th><th class="r">План оплат</th><th class="r">±</th><th>Внёс</th></tr></thead>
    <tbody>${rows.map(d => {
      const r = byDay[d];
      const plan = Plan.day(sc, d);
      const pays = r ? Number(r.pays) || 0 : 0;
      const diff = pays - plan;
      const p = r ? personById(r.by) : null;
      return `<tr class="${d === t ? 'now' : ''} ${Auth.can('sales.edit') ? 'click' : ''}" data-day="${d}">
        <td class="nowrap">${dayWd(d)}${r && r.note ? ` <span class="pill line" title="${esc(r.note)}">заметка</span>` : ''}</td>
        ${r ? `<td class="r">${fmt(r.reach || 0)}</td><td class="r">${r.views ? fmt(r.views) : '—'}</td><td class="r">${r.clicks ? fmt(r.clicks) : '—'}</td><td class="r">${fmt(r.regs || 0)}</td><td class="r"><b>${fmt(pays)}</b></td><td class="r">${fmt(r.renewals || 0)}</td><td class="r">${rub(revenueOf(r))}</td><td class="r">${r.regs ? pct(pays / r.regs, 1) : '—'}</td>`
          : `<td class="r muted" colspan="8">${Auth.can('sales.edit') ? 'не внесено — нажмите, чтобы внести' : 'не внесено'}</td>`}
        <td class="r muted">${plan ? fmt(plan, 1) : '—'}</td>
        <td class="r ${!plan ? '' : diff >= 0 ? 'good' : 'bad'}">${plan ? (diff >= 0 ? '+' : '') + fmt(diff, 1) : ''}</td>
        <td class="soft nowrap">${p ? esc(firstName(p)) : ''}</td></tr>`;
    }).join('')}</tbody></table></div>` : '<div class="empty"><b>Этот месяц ещё не начался</b>Цифры появятся с первого дня.</div>';
  return `<div class="tabs sub-tabs">${months.map(x => `<button data-rm="${x}" class="${x === m ? 'on' : ''}">${monthName(x)}</button>`).join('')}</div>
    <div class="card"><div class="card-head"><h2>Продажи по дням · ${monthName(m).toLowerCase()}</h2><span class="note">${Q.months.includes(m) ? `план ${fmt(Plan.sales(sc, m))} за месяц — ${fmt(Plan.sales(sc, m) / daysInMonth(m), 1)} в день` : 'подготовительный месяц — без плана'}</span></div>${chart}</div>
    <div class="section">${table}</div>`;
}

/* ── по неделям ── */
function weekView(sc) {
  const t = today();
  const weeks = [];
  for (let w = weekStart('2026-09-01'); w <= Q.end; w = addDays(w, 7)) weeks.push(w);
  const rows = weeks.map(w => {
    const from = w < '2026-09-01' ? '2026-09-01' : w, to = addDays(w, 6) > Q.end ? Q.end : addDays(w, 6);
    const f = Sales.range(from, to), plan = Plan.range(sc, from, to);
    return {w, from, to, f, plan, now: t >= w && t <= addDays(w, 6), future: from > t};
  });
  const chart = barChart({
    labels: rows.map(r => ({text: weekLabel(r.w), tick: dayShort(r.w).replace(NB, ' ')})),
    values: rows.map(r => (r.future ? 0 : r.f.pays)),
    plan: rows.map(r => Math.round(r.plan)),
    highlight: rows.findIndex(r => r.now),
  });
  return `<div class="card"><div class="card-head"><h2>Продажи по неделям</h2><span class="note">понедельник — воскресенье, план ${SCENARIOS[sc].name.toLowerCase()}</span></div>${chart}</div>
    <div class="section table-wrap"><table class="t weeks-t">
      <thead><tr><th>Неделя</th><th class="r">План продаж</th><th class="r">Факт</th><th class="r">% плана</th><th class="r">Регистрации</th><th class="r">план</th><th class="r">Охват</th><th class="r">Выручка</th><th class="r">Рег. → оплата</th></tr></thead>
      <tbody>${rows.map(r => {
        const share = r.plan ? r.f.pays / r.plan : null;
        return `<tr class="${r.now ? 'now' : ''} ${r.future ? 'muted-row' : ''}">
          <td class="nowrap">${weekLabel(r.w)}${r.now ? ' <span class="pill rose">эта</span>' : ''}</td>
          <td class="r">${r.plan ? fmt(r.plan, 0) : '—'}</td>
          <td class="r"><b>${r.future ? '' : fmt(r.f.pays)}</b></td>
          <td class="r ${r.future || !r.plan ? '' : paceTone(r.f.pays, r.plan)}">${r.future || !r.plan ? '' : pct(share)}</td>
          <td class="r">${r.future ? '' : fmt(r.f.regs)}</td><td class="r muted">${r.plan ? fmt(Plan.regs(r.plan)) : '—'}</td>
          <td class="r">${r.future ? '' : fmt(r.f.reach)}</td><td class="r">${r.future ? '' : rubK(r.f.revenue)}</td>
          <td class="r">${r.future || !r.f.regs ? '' : pct(r.f.pays / r.f.regs, 1)}</td></tr>`;
      }).join('')}</tbody></table></div>`;
}

/* ── по месяцам: сверка ── */
function monthView(sc) {
  const s = settings();
  const t = today();
  const cols = CF_MONTHS.map(m => ({m, f: Sales.month(m), plan: Plan.sales(sc, m), started: monthStart(m) <= t}));
  const qf = Sales.range(Q.start, Q.end), qPlan = Plan.total(sc);
  const cell = (fact, plan, started, f = fmt) => `<td class="r sv"><b>${started ? f(fact) : '—'}</b>${plan ? `<small>план ${f(plan)}${started ? ` · <span class="${paceTone(fact, plan)}">${pct(fact / plan)}</span>` : ''}</small>` : ''}</td>`;
  const rateCell = (a, b, plan, started) => `<td class="r sv"><b>${started && b ? pct(a / b, 1) : '—'}</b><small>план ${pct(plan)}</small></td>`;
  const row = (name, get, getPlan, f = fmt) => `<tr><td>${name}</td>${cols.map(c => cell(get(c.f), getPlan(c), c.started, f)).join('')}${cell(get(qf), sum(Q.months, m => getPlan({m, plan: Plan.sales(sc, m)})), t >= Q.start, f)}</tr>`;
  const chain = byKey(Plan.chain(sc), 'm');
  const cumExperts = Sales.range('2026-09-01', Q.end).experts, cumMk = Sales.range('2026-09-01', Q.end).mk;
  const premium = premiumOf(qf.pays, qf.revNew), premiumPlan = premiumOf(qPlan, qPlan * s.price);
  return `<div class="table-wrap"><table class="t sverka grid-lines">
    <thead><tr><th>Показатель</th>${cols.map(c => `<th class="r">${monthName(c.m)}${c.m === '2026-09' ? ' <span class="th-tag">подготовка</span>' : ''}</th>`).join('')}<th class="r">IV квартал</th></tr></thead>
    <tbody>
      ${row('Продажи <span class="note">первые оплаты</span>', f => f.pays, c => c.plan)}
      ${row('Регистрации', f => f.regs, c => Plan.regs(c.plan))}
      ${row('Переходы', f => f.clicks, c => Plan.clicks(c.plan))}
      ${row('Просмотры', f => f.views, c => Plan.views(c.plan))}
      ${row('Охват', f => f.reach, c => Plan.reach(c.plan))}
      ${row('Выручка первых платежей', f => f.revNew, c => c.plan * s.price, rubK)}
      ${row('Продления', f => f.revRenew, c => (chain[c.m] ? chain[c.m].revRenew : 0), rubK)}
      <tr><td>Конверсия в оплату</td>${cols.map(c => rateCell(c.f.pays, c.f.regs, s.convPay, c.started)).join('')}${rateCell(qf.pays, qf.regs, s.convPay, t >= Q.start)}</tr>
      <tr><td>Охват → регистрация</td>${cols.map(c => rateCell(c.f.regs, c.f.reach, s.convReg, c.started)).join('')}${rateCell(qf.regs, qf.reach, s.convReg, t >= Q.start)}</tr>
      <tr><td>Эксперты / мастер-классы</td>${cols.map(c => `<td class="r sv"><b>${c.started ? `${fmt(c.f.experts)} / ${fmt(c.f.mk)}` : '—'}</b></td>`).join('')}<td class="r sv"><b>${fmt(cumExperts)} / ${fmt(cumMk)}</b><small>цель ${s.expertsGoal}+ / ${s.mkGoal}+</small></td></tr>
      <tr class="total"><td>Премия команды <span class="note">${pct(s.premium)} чистого дохода</span></td>${cols.map(() => '<td></td>').join('')}<td class="r sv"><b>${rubK(premium)}</b><small>по плану ${rubK(premiumPlan)}</small></td></tr>
    </tbody></table></div>
    <div class="sverka-q card flat"><b>Пять вопросов сверки</b> — последний понедельник месяца:
      <ol><li>Сценарий: идём на 100, 500 или 1 000 — и почему.</li><li>Цели квартала: каждая из пяти — в графике, отстаём или сделано (отметьте в «Стратегии»).</li>
      <li>Что меняем: цена, трафик, контент, процессы — одно-два решения.</li><li>Деньги: выручка, расходы, штаб — ниже Cash Flow.</li><li>Кварталка: предварительные баллы каждому.</li></ol></div>`;
}

/* ── Cash Flow ── */
function cashFlowHtml(sc) {
  const s = settings();
  const rows = cashFlow(sc);
  const minClose = Math.min(...rows.map(r => r.close));
  const last = rows[rows.length - 1];
  const revTotal = sum(rows, r => r.revNew + r.revRenew);
  const outTotal = sum(rows, r => r.outTotal);
  const cells = get => rows.map(r => `<td class="r ${r.status}">${(v => (v ? rub(v) : '—'))(get(r))}</td>`).join('');
  const outCats = Object.keys(OUT_CATS).filter(c => rows.some(r => r.out[c]));
  return `<section class="section cf">
    <div class="section-head"><h2>Cash Flow до Нового года</h2><span class="hint-inline">Прошлые месяцы — факт, текущий — факт плюс остаток плана, дальше — прогноз по сценарию «${SCENARIOS[sc].name}» и плану платежей.</span></div>
    <div class="cards cf-sum">
      <div class="card stat"><span class="label">На 31 декабря</span><div class="big ${last.close < 0 ? 'bad' : ''}">${rubK(last.close)}</div><div class="foot">с планом вложений ${rubK(sum(Q.months, m => Number((s.invest || {})[m]) || 0))}</div></div>
      <div class="card stat"><span class="label">${minClose < 0 ? 'Нужно привлечь' : 'Минимум на счёте'}</span><div class="big ${minClose < 0 ? 'bad' : ''}">${rubK(minClose < 0 ? -minClose : minClose)}</div><div class="foot">${minClose < 0 ? 'чтобы не уйти в минус до конца года' : 'самая низкая точка до конца года'}</div></div>
      <div class="card stat"><span class="label">Выручка до конца года</span><div class="big">${rubK(revTotal)}</div><div class="foot">первые оплаты и продления</div></div>
      <div class="card stat"><span class="label">Расходы до конца года</span><div class="big">${rubK(outTotal)}</div><div class="foot">план платежей + от выручки</div></div>
    </div>
    <div class="table-wrap"><table class="t cf-table grid-lines">
      <thead><tr><th>Статья</th>${rows.map(r => `<th class="r">${monthName(r.m)} <span class="th-tag ${r.status}">${r.status === 'fact' ? 'факт' : r.status === 'now' ? 'факт + план' : 'прогноз'}</span></th>`).join('')}<th class="r">Итого</th></tr></thead>
      <tbody>
        <tr class="bal"><td>Остаток на начало</td>${rows.map(r => `<td class="r"><b>${rub(r.open)}</b></td>`).join('')}<td></td></tr>
        <tr class="group in"><td colspan="${rows.length + 2}">Поступления</td></tr>
        <tr class="in"><td>Подписки — первые оплаты <span class="note">${rows.map(r => fmt(Math.round(r.fresh))).join(' / ')}</span></td>${cells(r => r.revNew)}<td class="r">${rub(sum(rows, r => r.revNew))}</td></tr>
        <tr class="in"><td>Подписки — продления <span class="note">удержание ${pct(s.retention)}</span></td>${cells(r => r.revRenew)}<td class="r">${rub(sum(rows, r => r.revRenew))}</td></tr>
        <tr class="in"><td>Прочие приходы</td>${cells(r => r.otherIn)}<td class="r">${rub(sum(rows, r => r.otherIn))}</td></tr>
        <tr class="in fin"><td>Вложения <span class="note">основателя и инвесторов</span></td>${cells(r => r.invest)}<td class="r">${rub(sum(rows, r => r.invest))}</td></tr>
        <tr class="group out"><td colspan="${rows.length + 2}">Выплаты</td></tr>
        ${outCats.map(c => `<tr class="out"><td>${OUT_CATS[c]}${c === 'referral' ? ` <span class="note">${pct(s.referral)} первых оплат</span>` : c === 'acquiring' ? ` <span class="note">${pct(s.acquiring, 1)}</span>` : c === 'tax' ? ` <span class="note">${pct(s.taxRate)} выручки</span>` : ''}</td>${cells(r => r.out[c])}<td class="r">${rub(sum(rows, r => r.out[c]))}</td></tr>`).join('')}
        <tr class="sub out"><td>Итого выплаты</td>${cells(r => r.outTotal)}<td class="r">${rub(outTotal)}</td></tr>
        <tr class="sub"><td>Чистый поток</td>${rows.map(r => `<td class="r ${r.net < 0 ? 'bad' : 'good'}">${signed(r.net, rub)}</td>`).join('')}<td class="r">${signed(sum(rows, r => r.net), rub)}</td></tr>
        <tr class="total bal"><td>Остаток на конец</td>${rows.map(r => `<td class="r"><b class="${r.close < 0 ? 'bad' : ''}">${rub(r.close)}</b></td>`).join('')}<td></td></tr>
      </tbody></table></div>
    <p class="note">Старт — ${rub(s.cashStart)} на ${dayLong(s.cashDate)}. Штаб: октябрь и ноябрь — с инвестиций, декабрь — цель оплатить с прибыли. План вложений и ставки меняет основатель в «Деньгах» → «Настройки расчёта».</p>
  </section>`;
}