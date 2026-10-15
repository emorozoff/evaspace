/* Финансы: вкладки «Обзор», «Операции» (быстрая запись и журнал), «План и
   прогноз» (финплан с «Оплатить», план-факт, Cash Flow), «Подписки», «Курсы»,
   «Маркетплейс», «Сбои оплат», «Возвраты» (44-fin-ui.js). Выручка подписок
   приходит из «Отчётов» (цифры продаж), поэтому здесь её вручную не вносим.
   Платёж плана можно оплатить целиком или частями (аванс и зарплата); ставки
   взносов, налога, НДС и эквайринга — по срокам и порогам (06-rates.js). */

const MoneyUI = {
  draft: {kind: 'out', amount: '', cat: 'other', date: '', note: ''},
};
const catName = (kind, cat) => ((KINDS[kind] || {}).cats || {})[cat] || 'Прочее';
const monthStatus = m => (m < monthOf(today()) ? 'fact' : m === monthOf(today()) ? 'now' : 'plan');
const STATUS_TAG = {fact: 'факт', now: 'идёт', plan: 'план'};

/* разделы вкладки: обзор и деньги — всем, кто видит финансы; записи с данными клиентов — fin.ops */
const FIN_TABS = [
  ['overview', 'Обзор'], ['ops', 'Операции'], ['plan', 'План и прогноз'], ['subs', 'Подписки'], ['courses', 'Курсы'],
  ['market', 'Маркетплейс'], ['failed', 'Сбои оплат', 'fin.ops'], ['refunds', 'Возвраты', 'fin.ops'],
];
App.register('money', {
  title: 'Финансы',
  tourKey() { const t = View.get('fin.tab', 'overview'); return t === 'overview' || !TOURS['money-' + t] ? 'money' : 'money-' + t; },
  render(root, param) {
    if (!Auth.can('money.view')) { root.innerHTML = pageHead('Финансы', '') + noAccess(); return; }
    const s = settings(), sc = s.scenario;
    const edit = Auth.can('money.edit');
    const tabs = FIN_TABS.filter(t => !t[2] || Auth.can(t[2]));
    /* ссылка вида #money:refunds открывает нужный раздел (один раз — дальше решают вкладки) */
    if (param && App.cur !== 'money:' + param && tabs.some(t => t[0] === param)) View.set('fin.tab', param);
    let tab = View.get('fin.tab', 'overview');
    if (!tabs.some(t => t[0] === tab)) tab = 'overview';
    const a = Fin.attention();
    const badge = {failed: a.failedDue.length, refunds: a.refunds.length, market: finOps() ? a.ship.length : 0};
    const body = {
      overview: () => finOverviewHtml(sc),
      ops: () => `${edit ? quickEntryHtml() : ''}
        <section class="section"><div class="section-head"><h2>Журнал операций</h2>${ledgerFilters()}</div>${ledgerTable()}</section>`,
      plan: () => `<section class="section"><div class="section-head"><h2>Финплан: платежи по месяцам</h2><span class="hint-inline">${edit ? 'Регулярные и разовые платежи. «Оплатить», когда деньги ушли, — целиком или частью (например, аванс), операция попадёт в журнал и в план-факт.' : 'Что и когда платим до конца года.'}</span>
            ${edit ? `<button class="btn sm" data-plan-add>${icon('plus')}Платёж</button>` : ''}</div>${planTable()}</section>
        <section class="section"><div class="section-head"><h2>План-факт по месяцам</h2><span class="hint-inline">Крупно — факт, мелко — план. Будущие месяцы — только план. Сценарий продаж «${SCENARIOS[sc].name}».</span></div>${pnlTable(pnl(sc))}</section>
        ${Auth.can('cf.view') ? cashFlowHtml(sc) : ''}
        ${Auth.can('settings.edit') ? moneySettingsHtml() : ''}`,
      subs: finSubsHtml, courses: finCoursesHtml, market: finMarketHtml, failed: finFailedHtml, refunds: finRefundsHtml,
    }[tab]();

    root.innerHTML = `
      ${pageHead('Финансы', 'Все деньги клуба в одном месте: баланс и прогноз, журнал, финплан, подписки, курсы, маркетплейс, сбои оплат и возвраты.', helpBtn('money'))}
      ${helpBox('money', `<b>Как устроены финансы.</b> Всё, что пришло и ушло, лежит в <b>журнале операций</b> — из него считаются баланс, план-факт и прогноз. Записывать вручную нужно только обычные расходы и приходы (строка в «Операциях»). Остальное попадает в журнал само, когда вы нажимаете: «Оплатить» в финплане, «Выплатить» рефералу, автору или продавцу, «Оплачен» у заказа, «Возвращено» у запроса на возврат, «Внести приход» у курсов. Выручка подписок считается из «Цифр дня» в «Отчётах»; в «Подписках» её можно разделить на месячные и годовые. Сбои оплат и возвраты — карточки со сроком, статусом, ответственным и готовым сообщением клиенту.`)}
      <div class="tabs fin-tabs" role="tablist">${tabs.map(([k, n]) => `<button type="button" role="tab" data-ftab="${k}" class="${k === tab ? 'on' : ''}">${n}${badge[k] ? ` <span class="n fin-n">${badge[k]}</span>` : ''}</button>`).join('')}</div>
      <div id="finView" data-tab="${tab}">${body}</div>`;

    wireHelp(root);
    /* на телефоне вкладки прокручиваются вбок — выбранная должна быть видна */
    const bar = $('.fin-tabs', root), cur = bar && $('.on', bar);
    if (cur && (cur.offsetLeft + cur.offsetWidth > bar.scrollLeft + bar.clientWidth || cur.offsetLeft < bar.scrollLeft)) bar.scrollLeft = Math.max(0, cur.offsetLeft - 16);
    on(root, 'click', '[data-ftab]', (e, el) => { View.set('fin.tab', el.dataset.ftab); App.render(); });
    if (tab === 'ops' && edit) wireQuickEntry(root);
    if (tab === 'plan') { wirePlan(root); if (Auth.can('settings.edit')) wireMoneySettings(root); }
    if (tab === 'ops') wireLedger(root);
    wireFin(root);
  },
});

/* ── быстрая запись ── */
function quickEntryHtml() {
  const d = MoneyUI.draft;
  const cats = KINDS[d.kind].cats;
  if (!cats[d.cat]) d.cat = Object.keys(cats)[0];
  const recent = Money.ledger().slice(0, 4);
  return `<form class="card qe ${d.kind}" id="qeForm" autocomplete="off">
    <div class="seg qe-kind" role="tablist">${Object.entries(KINDS).map(([k, x]) => `<button type="button" data-kind="${k}" class="${d.kind === k ? 'on' : ''} k-${k}">${x.name}</button>`).join('')}</div>
    <div class="qe-fields">
      <label class="field qe-amount"><span>Сумма, ₽</span><input class="input num" id="qeAmount" inputmode="decimal" placeholder="0" value="${esc(d.amount)}"></label>
      <label class="field"><span>Статья</span><select class="select" id="qeCat">${Object.entries(cats).map(([k, n]) => `<option value="${k}" ${k === d.cat ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="field"><span>Дата</span><input class="input" id="qeDate" type="date" value="${esc(d.date || today())}"></label>
      <label class="field qe-note"><span>Комментарий</span><input class="input" id="qeNote" placeholder="${d.kind === 'out' ? 'За что: например, хостинг на месяц' : d.kind === 'in' ? 'От кого и за что' : 'Кто вложил'}" value="${esc(d.note)}" maxlength="160"></label>
      <button class="btn ${d.kind === 'out' ? 'danger solid' : d.kind === 'in' ? 'good' : 'dark'} qe-go" type="submit">Записать ${KINDS[d.kind].name.toLowerCase()}</button>
    </div>
    ${recent.length ? `<div class="qe-recent"><span class="label">Последние</span>${recent.map(e => `<button type="button" class="qe-r" data-led="${e.id}"><span>${dayShort(e.date)}</span><span>${esc(e.note || catName(e.kind, e.cat))}</span><b class="${e.kind === 'out' ? 'bad' : 'good'}">${e.kind === 'out' ? '−' : '+'}${rub(e.amount)}</b></button>`).join('')}</div>` : ''}
  </form>`;
}
function wireQuickEntry(root) {
  const form = $('#qeForm', root);
  const d = MoneyUI.draft;
  on(form, 'click', '[data-kind]', (e, el) => { d.kind = el.dataset.kind; d.cat = Object.keys(KINDS[d.kind].cats)[0]; App.render({focus: 'qeAmount'}); });
  $('#qeAmount', form).oninput = e => { d.amount = e.target.value; };
  $('#qeCat', form).onchange = e => { d.cat = e.target.value; };
  $('#qeDate', form).onchange = e => { d.date = e.target.value; };
  $('#qeNote', form).oninput = e => { d.note = e.target.value; };
  form.onsubmit = e => {
    e.preventDefault();
    const amount = Math.round(parseNum($('#qeAmount', form).value) * 100) / 100;
    if (!(amount > 0)) { $('#qeAmount', form).focus(); toast('Укажите сумму больше нуля'); return; }
    const entry = {kind: d.kind, amount, cat: $('#qeCat', form).value, date: $('#qeDate', form).value || today(),
      note: $('#qeNote', form).value.trim(), by: Tasks.meKey(), at: Date.now()};
    const id = Store.add('ledger', entry);
    d.amount = ''; d.note = '';
    toast(`Записано: ${d.kind === 'out' ? '−' : '+'}${rub(amount)} · ${catName(entry.kind, entry.cat)}`, {undo: () => Store.remove('ledger', id)});
    App.render({focus: 'qeAmount'});
  };
}

/* ── P&L ── */
function pnlTable(rows) {
  const cell = (r, f, p) => {
    const st = monthStatus(r.m);
    if (st === 'plan') return `<td class="r pl-cell future"><b>${p ? rubK(p) : '—'}</b><small>план</small></td>`;
    return `<td class="r pl-cell"><b>${f ? rubK(f) : '—'}</b>${p ? `<small>план ${rubK(p)}</small>` : ''}</td>`;
  };
  const total = (get) => sum(rows, r => get(r));
  const line = (name, getF, getP, cls = '') => `<tr class="${cls}"><td>${name}</td>${rows.map(r => cell(r, getF(r), getP(r))).join('')}
    <td class="r pl-cell tot"><b>${rubK(total(r => (monthStatus(r.m) === 'plan' ? getP(r) : getF(r))))}</b><small>план ${rubK(total(getP))}</small></td></tr>`;
  const outCats = Object.keys(OUT_CATS).filter(c => rows.some(r => (r.fact.out[c] || 0) || (r.plan.out[c] || 0)));
  const profitCell = r => {
    const st = monthStatus(r.m), v = st === 'plan' ? r.plan.profit : r.fact.profit;
    return `<td class="r pl-cell ${st === 'plan' ? 'future' : ''}"><b class="${v < 0 ? 'bad' : 'good'}">${signed(v)}</b>${st !== 'plan' ? `<small>план ${signed(r.plan.profit)}</small>` : '<small>план</small>'}</td>`;
  };
  const profitTot = total(r => (monthStatus(r.m) === 'plan' ? r.plan.profit : r.fact.profit));
  return `<div class="table-wrap"><table class="t pnl grid-lines">
    <thead><tr><th>Статья</th>${rows.map(r => `<th class="r">${monthName(r.m)} <span class="th-tag">${STATUS_TAG[monthStatus(r.m)]}</span></th>`).join('')}<th class="r">До конца года</th></tr></thead>
    <tbody>
      <tr class="group in"><td colspan="${rows.length + 2}">Доходы</td></tr>
      ${line('Подписки <span class="note">из отчётов о продажах</span>', r => r.fact.subs, r => r.plan.subs, 'in')}
      ${line('Прочие приходы', r => r.fact.other, r => r.plan.other, 'in')}
      ${line('Итого доходы', r => r.fact.income, r => r.plan.income, 'sub in')}
      <tr class="group out"><td colspan="${rows.length + 2}">Расходы</td></tr>
      ${outCats.map(c => line(OUT_CATS[c], r => r.fact.out[c] || 0, r => r.plan.out[c] || 0, 'out')).join('') || `<tr><td colspan="${rows.length + 2}" class="note">Расходов пока нет</td></tr>`}
      ${line('Итого расходы', r => r.fact.outTotal, r => r.plan.outTotal, 'sub out')}
      <tr class="total"><td>Прибыль</td>${rows.map(profitCell).join('')}<td class="r pl-cell tot"><b class="${profitTot < 0 ? 'bad' : 'good'}">${signed(profitTot)}</b></td></tr>
      <tr class="fin"><td>Вложения <span class="note">вне P&amp;L</span></td>${rows.map(r => `<td class="r pl-cell"><b>${r.fact.invest ? rubK(r.fact.invest) : '—'}</b></td>`).join('')}<td class="r pl-cell tot"><b>${rubK(total(r => r.fact.invest))}</b></td></tr>
    </tbody></table></div>
    <p class="note">План расходов = план платежей ниже + от выручки по плану: реферальные ${pct(settings().referral)} первых оплат, ${varRatesText()} — по ставкам каждого месяца и порогам с начала года («Настройки расчёта»).</p>`;
}

/* ── план платежей ── */
function planTable() {
  const items = Money.planItems();
  const months = CF_MONTHS;
  const edit = Auth.can('money.edit');
  const seePay = Auth.can('payroll.view');
  if (!items.length) return `<div class="empty"><b>План платежей пуст</b>${edit ? 'Добавьте зарплаты, штаб, сервисы и разовые платежи кнопкой «Платёж».' : ''}</div>`;
  const cell = (it, m) => {
    const a = Money.planAmount(it, m);
    if (!a) return '<td class="r plan-c empty-c"></td>';
    const paidA = Money.paidAmount(it, m), rest = Money.left(it, m);
    const canPay = edit && (it.group !== 'payroll' || seePay);
    const list = Money.payments(it, m).map(e => `${dayLong(e.date)} — ${rub(e.amount)}${e.planPart ? ' (' + e.planPart.toLowerCase() + ')' : ''}`).join(', ');
    if (paidA && !rest) return `<td class="r plan-c paid"><button class="pay-btn paid" ${canPay ? `data-pay="${it.id}:${m}"` : 'disabled'} title="Оплачено: ${esc(list)}${canPay ? '. Нажмите, чтобы посмотреть или отменить' : ''}"><span>${rub(a)}</span>${icon('tick')}</button></td>`;
    if (paidA) return `<td class="r plan-c part"><div class="pc-amt">${rub(a)}</div><div class="pc-bar" title="Оплачено: ${esc(list)}"><i style="width:${Math.min(100, Math.round(paidA / a * 100))}%"></i></div>
      <div class="pc-part">оплачено ${rubK(paidA)}</div>${canPay ? `<button class="pay-btn" data-pay="${it.id}:${m}">Доплатить ${rubK(rest)}</button>` : `<span class="note">осталось ${rubK(rest)}</span>`}</td>`;
    return `<td class="r plan-c"><div class="pc-amt">${rub(a)}</div>${canPay ? `<button class="pay-btn" data-pay="${it.id}:${m}">Оплатить</button>` : `<span class="note">${m < monthOf(today()) ? 'не оплачено' : ''}</span>`}</td>`;
  };
  const groupRows = Object.entries(PLAN_GROUPS).map(([g, gname]) => {
    const list = items.filter(it => it.group === g);
    if (!list.length) return '';
    const gTot = m => sum(list, it => Money.planAmount(it, m));
    const head = `<tr class="group"><td>${gname}</td>${months.map(m => `<td class="r">${gTot(m) ? rubK(gTot(m)) : ''}</td>`).join('')}<td class="r">${rubK(sum(months, gTot))}</td></tr>`;
    if (g === 'payroll' && !seePay) {
      return head + `<tr><td><span class="soft">${list.length} ${plural(list.length, 'человек', 'человека', 'человек')} в команде</span><div class="note">суммы по людям видит основатель</div></td>${months.map(m => `<td class="r plan-c">${gTot(m) ? rub(gTot(m)) : ''}</td>`).join('')}<td class="r"><b>${rub(sum(months, gTot))}</b></td></tr>`;
    }
    return head + list.map(it => {
      const p = personById(it.personId);
      const off = p && (p.status === 'inactive' || p.archived);
      return `<tr class="${off ? 'dim' : ''}"><td><button class="plan-name" ${edit && (g !== 'payroll' || seePay) ? `data-plan-edit="${it.id}"` : 'disabled'}>${esc(it.title)}</button>${off ? ' <span class="pill warn">не активирован — не считаем</span>' : ''}
        <div class="note">${g === 'payroll' ? `${p ? esc(personName(p)) + ' · ' : ''}${rub(it.amount)}${it.insurance !== false ? ' + взносы ' + insNote() : ''}` : `${catName('out', it.cat)} · ${rub(it.amount)}${g === 'regular' ? ' в месяц' : ''}`}${planParts(it).length ? ' · частями: ' + planParts(it).map(x => `${esc(x.name.toLowerCase())} ${pctA(x.share)}`).join(', ') : ''}</div></td>
        ${months.map(m => cell(it, m)).join('')}<td class="r"><b>${rub(sum(months, m => Money.planAmount(it, m)))}</b></td></tr>`;
    }).join('');
  }).join('');
  const tot = m => sum(items, it => Money.planAmount(it, m));
  const paidTot = m => sum(items, it => Math.min(Money.planAmount(it, m), Money.paidAmount(it, m)));
  return `<div class="table-wrap"><table class="t plan grid-lines">
    <thead><tr><th>Платёж</th>${months.map(m => `<th class="r">${monthName(m)}</th>`).join('')}<th class="r">Всего</th></tr></thead>
    <tbody>${groupRows}
      <tr class="total"><td>Итого по плану</td>${months.map(m => `<td class="r">${rub(tot(m))}</td>`).join('')}<td class="r">${rub(sum(months, tot))}</td></tr>
      <tr class="sub"><td>Оплачено</td>${months.map(m => `<td class="r good">${paidTot(m) ? rub(paidTot(m)) : '—'}</td>`).join('')}<td class="r good">${rub(sum(months, paidTot))}</td></tr>
      <tr class="sub"><td>Осталось оплатить</td>${months.map(m => `<td class="r">${tot(m) - paidTot(m) ? rub(tot(m) - paidTot(m)) : '—'}</td>`).join('')}<td class="r">${rub(sum(months, m => tot(m) - paidTot(m)))}</td></tr>
    </tbody></table></div>`;
}
function wirePlan(root) {
  on(root, 'click', '[data-pay]', (e, el) => { const [id, m] = el.dataset.pay.split(':'); openPay(id, m); });
  on(root, 'click', '[data-plan-edit]', (e, el) => editPlanItem(el.dataset.planEdit));
  on(root, 'click', '[data-plan-add]', () => editPlanItem(null));
}
/* части платежа: [{name: 'Аванс', share: 0.4}, {name: 'Зарплата', share: 0.6}] */
const planParts = it => (Array.isArray(it.parts) ? it.parts : []).filter(x => x && x.name && Number(x.share) > 0).map(x => ({name: String(x.name).slice(0, 40), share: Number(x.share)}));
const PARTS_DEFAULT = {payroll: [{name: 'Аванс', share: 0.4}, {name: 'Зарплата', share: 0.6}], other: [{name: 'Первая часть', share: 0.5}, {name: 'Вторая часть', share: 0.5}]};
const insNote = () => rateText('insurance') + (rateTable('insurance').length > 1 ? ', дальше по срокам' : '');
function varRatesText() {
  const m = monthOf(today()), parts = [`эквайринг ${rateText('acquiring', m)}`, `налог ${rateText('tax', m)}`];
  if (rateTable('vat').some(p => p.steps.some(st => st.rate > 0))) parts.push(`НДС ${rateText('vat', m)}`);
  return parts.join(', ');
}

/* ── оплата платежа плана: целиком или частями ── */
function openPay(id, m) {
  const it = Store.get('plan', id);
  if (!it) return;
  const cur = monthOf(today());
  const defDate = m === cur ? today() : m < cur ? monthEnd(m) : today();
  const cat = it.group === 'payroll' ? 'payroll' : (it.cat || 'other');
  let pick = null;   // выбранная часть
  openModal({
    title: `Оплата: ${it.title}`,
    body: '<div id="payBox"></div>',
    foot: '<button class="btn" data-close>Закрыть</button><button class="btn primary" id="payGo">Оплатить</button>',
    onMount(el, close) {
      const parts = () => {
        const a = Money.planAmount(it, m), list = Money.payments(it, m), rest = Money.left(it, m);
        const ps = planParts(it).map(x => ({...x, amount: Math.round(a * x.share), done: list.some(e => e.planPart === x.name)}));
        const open = ps.filter(x => !x.done);
        ps.forEach(x => { x.amount = open.length === 1 && x === open[0] ? rest : Math.min(x.amount, rest); });
        return ps;
      };
      const draw = () => {
        const a = Money.planAmount(it, m), base = Money.planBase(it, m), list = Money.payments(it, m), paidA = Money.paidAmount(it, m), rest = Money.left(it, m);
        const ps = parts();
        if (pick && !ps.some(x => x.name === pick && !x.done)) pick = null;
        /* следующая неоплаченная часть выбрана сразу: аванс, потом зарплата */
        if (!pick && ps.some(x => !x.done)) pick = ps.find(x => !x.done).name;
        const chosen = ps.find(x => x.name === pick);
        $('#payBox', el).innerHTML = `
          <div class="pay-sum"><div><span class="label">${monthName(m)} по плану</span><b>${rub(a)}</b></div>
            <div><span class="label">Оплачено</span><b class="${paidA ? 'good' : ''}">${rub(paidA)}</b></div>
            <div><span class="label">Осталось</span><b>${rub(rest)}</b></div></div>
          ${it.group === 'payroll' && it.insurance !== false && a > base ? `<p class="note">В сумме зарплата ${rub(base)} и страховые взносы ${rub(a - base)} — ${esc(rateText('insurance', m))}.</p>` : ''}
          ${list.length ? `<div class="pay-list"><span class="label">Оплаты</span>${list.map(e => `<div class="pay-row"><span class="nowrap">${dayShort(e.date)}</span><span class="pay-what">${esc(e.planPart || 'Оплата')}</span><b class="nowrap">${rub(e.amount)}</b>
            <button type="button" class="icon-btn" data-unpay-one="${e.id}" title="Отменить эту оплату" aria-label="Отменить оплату">${icon('x')}</button></div>`).join('')}</div>` : ''}
          ${rest > 0 ? `
            ${ps.length ? `<div class="field"><span>Какую часть платим</span><div class="chips pay-parts">${ps.map(x => `<button type="button" class="chip ${x.done ? 'done' : x.name === pick ? 'on' : ''}" data-part="${esc(x.name)}" ${x.done ? 'disabled' : ''}>${esc(x.name)} · ${x.done ? 'оплачено' : rub(x.amount)}</button>`).join('')}</div></div>` : ''}
            <div class="grid3">
              <label class="field"><span>Сумма, ₽</span><input class="input num" id="payAmt" inputmode="decimal" value="${chosen ? chosen.amount : rest}"></label>
              <label class="field"><span>Дата оплаты</span><input class="input" id="payDate" type="date" value="${esc(defDate)}"></label>
              <label class="field"><span>Что оплачиваем</span><input class="input" id="payPart" maxlength="40" placeholder="Например: аванс" value="${esc(chosen ? chosen.name : '')}"></label>
            </div>
            <div class="chips pay-quick"><button type="button" class="chip" data-amt="${rest}">Весь остаток ${rub(rest)}</button>${rest >= 2 ? `<button type="button" class="chip" data-amt="${Math.round(rest / 2)}">Половина ${rub(Math.round(rest / 2))}</button>` : ''}</div>
            ${!ps.length ? `<p class="note">Платите частями каждый месяц — например, аванс и зарплата? Задайте части в карточке платежа (нажмите на его название): тогда здесь будут готовые кнопки.</p>` : ''}`
          : '<p class="good pay-done">Оплачено полностью.</p>'}`;
        $('#payGo', el).hidden = !(rest > 0);
      };
      draw();
      on(el, 'click', '[data-part]', (e, b) => { pick = b.dataset.part; draw(); });
      on(el, 'click', '[data-amt]', (e, b) => { $('#payAmt', el).value = b.dataset.amt; });
      on(el, 'click', '[data-unpay-one]', async (e, b) => {
        const led = Store.get('ledger', b.dataset.unpayOne);
        if (!led) return;
        if (!(await confirmPop(b, {text: `Отменить оплату ${rub(led.amount)}${led.planPart ? ' (' + led.planPart.toLowerCase() + ')' : ''}? Операция уйдёт из журнала.`, yes: 'Да, отменить', danger: true}))) return;
        const copy = clone(led);
        Store.remove('ledger', led.id);
        toast('Оплата отменена', {undo: () => Store.put('ledger', copy.id, copy)});
        draw();
      });
      $('#payGo', el).onclick = () => {
        const rest = Money.left(it, m);
        const amount = Math.round(parseNum($('#payAmt', el).value) * 100) / 100;
        if (!(amount > 0)) { $('#payAmt', el).focus(); toast('Укажите сумму'); return; }
        if (amount > rest + 0.009) { $('#payAmt', el).focus(); toast(`Не больше остатка — ${rub(rest)}`); return; }
        const part = $('#payPart', el).value.trim().slice(0, 40);
        Store.add('ledger', {kind: 'out', amount, cat, date: $('#payDate', el).value || defDate, note: it.title + (part ? ' — ' + part.toLowerCase() : ''),
          planId: it.id, planMonth: m, ...(part ? {planPart: part} : {}), by: Tasks.meKey(), at: Date.now()});
        pick = null;
        if (Money.left(it, m) <= 0) { close(); toast(`Оплачено полностью: ${it.title}, ${monthName(m).toLowerCase()}`); return; }
        toast(`Оплачено ${rub(amount)}${part ? ' — ' + part.toLowerCase() : ''}. Осталось ${rub(Money.left(it, m))}`);
        draw();
      };
    },
  });
}
function editPlanItem(id) {
  const it = id ? Store.get('plan', id) : null;
  const seePay = Auth.can('payroll.view');
  const v = it || {title: '', group: 'regular', cat: 'office', amount: '', months: [monthOf(today())], insurance: true, personId: ''};
  let parts = planParts(v).map(x => ({name: x.name, pct: Math.round(x.share * 1000) / 10}));
  const groups = Object.entries(PLAN_GROUPS).filter(([g]) => g !== 'payroll' || seePay);
  openModal({
    title: it ? 'Платёж в плане' : 'Новый платёж',
    body: `<label class="field"><span>Название</span><input class="input" id="piTitle" value="${esc(v.title)}" placeholder="Например: Студия-штаб, аренда"></label>
      <div class="grid3">
        <label class="field"><span>Группа</span><select class="select" id="piGroup">${groups.map(([g, n]) => `<option value="${g}" ${g === v.group ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="field" id="piCatF"><span>Статья</span><select class="select" id="piCat">${Object.entries(OUT_CATS).filter(([k]) => k !== 'payroll').map(([k, n]) => `<option value="${k}" ${k === v.cat ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="field"><span>Сумма за месяц, ₽</span><input class="input num" id="piAmount" inputmode="decimal" value="${esc(v.amount)}"></label>
      </div>
      <div class="grid2" id="piPayF">
        <label class="field"><span>Человек</span><select class="select" id="piPerson"><option value="">Вакансия / не выбран</option>${people().map(p => `<option value="${p.id}" ${p.id === v.personId ? 'selected' : ''}>${esc(personName(p))}</option>`).join('')}</select></label>
        <label class="check pi-ins"><input type="checkbox" id="piIns" ${v.insurance !== false ? 'checked' : ''}>Плюс страховые взносы — сейчас ${esc(insNote())}</label>
      </div>
      <div class="field pi-parts"><label class="check"><input type="checkbox" id="piPartsOn" ${parts.length ? 'checked' : ''}>Платим частями каждый месяц</label>
        <div id="piParts"></div></div>
      <div class="field"><span>В какие месяцы платим</span><div class="chips">${CF_MONTHS.map(m => `<label class="chip pick"><input type="checkbox" value="${m}" ${(v.months || []).includes(m) ? 'checked' : ''}>${monthName(m)}</label>`).join('')}</div></div>`,
    foot: `${it ? `<button class="btn danger left" id="piDel">${icon('trash')}Удалить</button>` : ''}<button class="btn" data-close>Отмена</button><button class="btn primary" id="piSave">Сохранить</button>`,
    onMount(el, close) {
      const sync = () => {
        const pay = $('#piGroup', el).value === 'payroll';
        $('#piPayF', el).hidden = !pay;
        $('#piCatF', el).hidden = pay;
      };
      $('#piGroup', el).onchange = sync;
      sync();
      /* части: название и доля в процентах, вместе — 100% */
      const readParts = () => { parts = $$('[data-pt]', el).map(r => ({name: $('[data-pn]', r).value.trim(), pct: parseNum($('[data-pp]', r).value)})); };
      const drawParts = () => {
        const box = $('#piParts', el);
        if (!$('#piPartsOn', el).checked) { box.innerHTML = ''; return; }
        const total = Math.round(sum(parts, x => x.pct) * 10) / 10;
        box.innerHTML = `<div class="pi-plist">${parts.map((x, i) => `<div class="pi-prow" data-pt="${i}"><input class="input" data-pn maxlength="40" value="${esc(x.name)}" placeholder="Например: аванс">
            <label class="pi-pct"><input class="input num" data-pp inputmode="decimal" value="${x.pct}"><span>%</span></label>
            ${parts.length > 2 ? `<button type="button" class="icon-btn" data-pdel="${i}" aria-label="Убрать часть">${icon('x')}</button>` : '<span></span>'}</div>`).join('')}</div>
          <div class="row pi-pfoot"><button type="button" class="btn sm ghost" data-padd>${icon('plus')}Часть</button><span class="note ${Math.abs(total - 100) > 0.05 ? 'bad' : ''}" id="piPTot">вместе ${fmt(total, total % 1 ? 1 : 0)}% — нужно 100%</span></div>`;
      };
      $('#piPartsOn', el).onchange = e => {
        if (e.target.checked && !parts.length) parts = PARTS_DEFAULT[$('#piGroup', el).value === 'payroll' ? 'payroll' : 'other'].map(x => ({name: x.name, pct: x.share * 100}));
        drawParts();
      };
      on(el, 'click', '[data-padd]', () => { readParts(); parts.push({name: '', pct: Math.max(0, Math.round((100 - sum(parts, x => x.pct)) * 10) / 10)}); drawParts(); });
      on(el, 'click', '[data-pdel]', (e, b) => { readParts(); parts.splice(Number(b.dataset.pdel), 1); drawParts(); });
      on(el, 'input', '[data-pp]', () => { readParts(); const t = Math.round(sum(parts, x => x.pct) * 10) / 10, n = $('#piPTot', el); if (n) { n.textContent = `вместе ${fmt(t, t % 1 ? 1 : 0)}% — нужно 100%`; n.classList.toggle('bad', Math.abs(t - 100) > 0.05); } });
      drawParts();
      $('#piSave', el).onclick = () => {
        const title = $('#piTitle', el).value.trim();
        const amount = parseNum($('#piAmount', el).value);
        const months = $$('.chip.pick input:checked', el).map(i => i.value);
        if (!title) return $('#piTitle', el).focus();
        if (!(amount > 0)) { $('#piAmount', el).focus(); toast('Укажите сумму'); return; }
        if (!months.length) { toast('Отметьте хотя бы один месяц'); return; }
        const group = $('#piGroup', el).value;
        let partsOut = [];
        if ($('#piPartsOn', el).checked) {
          readParts();
          const list = parts.filter(x => x.name || x.pct);
          if (list.length < 2 || list.some(x => !x.name || !(x.pct > 0))) { toast('У каждой части — название и доля больше нуля, частей хотя бы две'); return; }
          if (new Set(list.map(x => x.name.toLowerCase())).size !== list.length) { toast('Названия частей не должны повторяться'); return; }
          if (Math.abs(sum(list, x => x.pct) - 100) > 0.05) { toast('Части вместе должны давать 100%'); return; }
          partsOut = list.map(x => ({name: x.name, share: Math.round(x.pct * 10) / 1000}));
        }
        const data = {title, group, amount, months, cat: group === 'payroll' ? 'payroll' : $('#piCat', el).value,
          personId: group === 'payroll' ? $('#piPerson', el).value || null : null, insurance: group === 'payroll' ? $('#piIns', el).checked : false,
          parts: partsOut};
        if (it) Store.put('plan', it.id, {...it, ...data}); else Store.add('plan', data);
        close();
      };
      const del = $('#piDel', el);
      if (del) del.onclick = async () => {
        const paid = Store.all('ledger').filter(e => e.planId === it.id).length;
        if (!(await confirmPop(del, {text: paid ? `Удалить платёж из плана? ${paid} оплат(ы) останутся в журнале.` : 'Удалить платёж из плана?', yes: 'Да, удалить', danger: true}))) return;
        const copy = clone(it);
        Store.remove('plan', it.id);
        close();
        toast('Платёж удалён из плана', {undo: () => Store.put('plan', copy.id, copy)});
      };
    },
  });
}

/* ── журнал ── */
function ledgerFilters() {
  const k = View.get('m.kind', ''), m = View.get('m.month', '');
  const months = [...new Set(Store.all('ledger').map(e => monthOf(e.date)))].sort().reverse();
  const names = [['', 'Все'], ['out', 'Расходы'], ['in', 'Приходы'], ['invest', 'Вложения']];
  return `<div class="row led-f"><div class="seg">${names.map(([x, n]) => `<button data-lk="${x}" class="${k === x ? 'on' : ''}">${n}</button>`).join('')}</div>
    <select class="select sm" id="ledMonth"><option value="">Все месяцы</option>${months.map(x => `<option value="${x}" ${x === m ? 'selected' : ''}>${monthName(x, true)}</option>`).join('')}</select></div>`;
}
function ledgerTable() {
  const k = View.get('m.kind', ''), m = View.get('m.month', '');
  const list = Money.ledger().filter(e => (!k || e.kind === k) && (!m || monthOf(e.date) === m));
  if (!list.length) return '<div class="empty"><b>Операций нет</b>Запишите первую строкой вверху страницы.</div>';
  const edit = Auth.can('money.edit');
  const shown = list.slice(0, View.get('m.more', false) ? 1000 : 40);
  const tot = kind => sum(list.filter(e => e.kind === kind), e => e.amount);
  return `<div class="table-wrap"><table class="t led">
    <thead><tr><th>Дата</th><th>Тип</th><th>Статья</th><th>Комментарий</th><th>Кто</th><th class="r">Сумма</th></tr></thead>
    <tbody>${shown.map(e => {
      const p = personById(e.by);
      return `<tr class="${edit ? 'click' : ''}" ${edit ? `data-led="${e.id}"` : ''}>
        <td class="nowrap">${dayShort(e.date)}${e.date.slice(0, 4) !== '2026' ? ' ' + e.date.slice(0, 4) : ''}</td>
        <td><span class="pill ${KINDS[e.kind] ? KINDS[e.kind].tone : ''}">${KINDS[e.kind] ? KINDS[e.kind].name : e.kind}</span></td>
        <td>${esc(catName(e.kind, e.cat))}</td>
        <td>${esc(e.note || '')}${e.planId ? ' <span class="pill line">по плану</span>' : ''}</td>
        <td class="nowrap soft">${p ? esc(firstName(p)) : ''}</td>
        <td class="r nowrap"><b class="${e.kind === 'out' ? 'bad' : 'good'}">${e.kind === 'out' ? '−' : '+'}${rub(e.amount)}</b></td></tr>`;
    }).join('')}</tbody>
    <tfoot><tr class="total"><td colspan="6"><span class="led-tot">Приходы <b class="good">+${rub(tot('in'))}</b> · Вложения <b>+${rub(tot('invest'))}</b> · Расходы <b class="bad">−${rub(tot('out'))}</b></span></td></tr></tfoot>
  </table></div>
  ${list.length > shown.length ? `<button class="btn sm ghost" data-led-more>Показать все ${list.length}</button>` : ''}`;
}
function wireLedger(root) {
  on(root, 'click', '[data-lk]', (e, el) => { View.set('m.kind', el.dataset.lk); App.render(); });
  const ms = $('#ledMonth', root);
  if (ms) ms.onchange = e => { View.set('m.month', e.target.value); App.render(); };
  on(root, 'click', '[data-led-more]', () => { View.set('m.more', true); App.render(); });
  on(root, 'click', '[data-led]', (e, el) => { if (Auth.can('money.edit')) editLedger(el.dataset.led); });
}
function editLedger(id) {
  const e0 = Store.get('ledger', id);
  if (!e0) return;
  openModal({
    title: 'Операция',
    body: `<div class="seg" id="leKind">${Object.entries(KINDS).map(([k, x]) => `<button type="button" data-k="${k}" class="${e0.kind === k ? 'on' : ''}">${x.name}</button>`).join('')}</div>
      <div class="grid3">
        <label class="field"><span>Сумма, ₽</span><input class="input num" id="leAmount" inputmode="decimal" value="${e0.amount}"></label>
        <label class="field"><span>Статья</span><select class="select" id="leCat"></select></label>
        <label class="field"><span>Дата</span><input class="input" id="leDate" type="date" value="${esc(e0.date)}"></label>
      </div>
      <label class="field"><span>Комментарий</span><input class="input" id="leNote" value="${esc(e0.note || '')}"></label>
      ${e0.planId ? `<p class="note">Операция создана кнопкой «Оплатить» в плане платежей${e0.planPart ? ` (${esc(e0.planPart.toLowerCase())})` : ''}. Если удалить её, эта сумма снова станет к оплате.</p>` : ''}`,
    foot: `<button class="btn danger left" id="leDel">${icon('trash')}Удалить</button><button class="btn" data-close>Отмена</button><button class="btn primary" id="leSave">Сохранить</button>`,
    onMount(el, close) {
      let kind = e0.kind;
      const fillCats = keep => {
        const cats = KINDS[kind].cats;
        $('#leCat', el).innerHTML = Object.entries(cats).map(([k, n]) => `<option value="${k}" ${k === keep ? 'selected' : ''}>${n}</option>`).join('');
      };
      fillCats(e0.cat);
      on(el, 'click', '[data-k]', (e, b) => { kind = b.dataset.k; $$('[data-k]', el).forEach(x => x.classList.toggle('on', x === b)); fillCats(''); });
      $('#leSave', el).onclick = () => {
        const amount = parseNum($('#leAmount', el).value);
        if (!(amount > 0)) return $('#leAmount', el).focus();
        Store.put('ledger', id, {...e0, kind, amount, cat: $('#leCat', el).value, date: $('#leDate', el).value || e0.date, note: $('#leNote', el).value.trim()});
        close();
      };
      $('#leDel', el).onclick = async () => {
        if (!(await confirmPop($('#leDel', el), {text: 'Удалить операцию из журнала?', yes: 'Да, удалить', danger: true}))) return;
        const copy = clone(e0);
        Store.remove('ledger', id);
        close();
        toast('Операция удалена', {undo: () => Store.put('ledger', copy.id, copy)});
      };
    },
  });
}

/* ── настройки расчёта (основатель) ── */
function moneySettingsHtml() {
  const s = settings(), m = monthOf(today());
  const timeline = key => rateTable(key).map((p, i, t) => {
    const on = i === t.reduce((ci, x, j) => (x.from <= m ? j : ci), 0);
    return `<span class="rt-per ${on ? 'on' : ''}"><small>${i ? monthFrom(p.from) : 'с начала'}${p.label ? ' · ' + esc(p.label) : ''}</small><b>${esc(stepsText(p.steps))}</b></span>`;
  }).join('<span class="rt-arr">→</span>');
  return `<details class="section card settings-box" ${View.get('m.set', false) ? 'open' : ''} id="mSet">
    <summary><h2>Настройки расчёта</h2><span class="note">деньги на старте, ставки по срокам и порогам, план вложений</span></summary>
    <div class="grid3 set-grid">
      <label class="field"><span>Деньги на счёте на старте, ₽</span><input class="input num" id="msCash" inputmode="decimal" value="${s.cashStart}"></label>
      <label class="field"><span>Дата старта</span><input class="input" id="msDate" type="date" value="${esc(s.cashDate)}"></label>
      <label class="field"><span>Годовая подписка, ₽</span><input class="input num" id="msYear" inputmode="decimal" value="${s.priceYear || ''}" placeholder="${s.price * 10}"><small>месячная — ${rub(s.price)} в «Стратегии»</small></label>
    </div>
    <div class="rates-box">
      <div class="rates-head"><h3>Ставки по срокам и порогам</h3>
        <p class="note">Ставка может меняться с даты — например, взносы: до регистрации ООО 0%, после — 30%, с IT-льготами — 15%. И по порогу за год: до 2,4 млн ₽ одна ставка, со всего, что сверх, — другая. Порог взносов считается по зарплате каждого человека с начала года, налога, НДС и эквайринга — по выручке клуба с начала года.</p></div>
      ${RATE_KEYS.map(k => `<div class="rate-row"><div class="rate-what"><b>${RATE_DEFS[k].name}</b><span class="note">${RATE_DEFS[k].of}</span></div>
        <div class="rate-tl">${timeline(k)}</div><button type="button" class="btn sm" data-rate-edit="${k}">Изменить</button></div>`).join('')}
    </div>
    <div class="field"><span>План вложений по месяцам, ₽ — попадает в Cash Flow, пока деньги не пришли</span>
      <div class="grid3">${Q.months.map(mm => `<label class="field"><span>${monthName(mm)}</span><input class="input num" data-inv="${mm}" inputmode="decimal" value="${(s.invest || {})[mm] || ''}" placeholder="0"></label>`).join('')}</div></div>
    <div class="row"><button class="btn primary" id="msSave">Сохранить настройки</button></div>
  </details>`;
}
function wireMoneySettings(root) {
  const box = $('#mSet', root);
  box.addEventListener('toggle', () => View.set('m.set', box.open));
  on(box, 'click', '[data-rate-edit]', (e, el) => editRates(el.dataset.rateEdit));
  $('#msSave', root).onclick = () => {
    const invest = {};
    $$('[data-inv]', root).forEach(i => { invest[i.dataset.inv] = Math.max(0, parseNum(i.value)); });
    saveSettings({cashStart: parseNum($('#msCash', root).value), cashDate: $('#msDate', root).value || '2026-09-01',
      invest, priceYear: parseNum($('#msYear', root).value) || null});
    toast('Настройки сохранены');
  };
}

/* ── ставка по срокам и порогам: периоды «с месяца», в каждом — ступени до порога и сверх ── */
const RATE_EXAMPLE = {
  insurance: 'Например: с начала — 0% (до регистрации ООО); с ноября — 30% (после регистрации); с февраля — 15% до 2 400 000 ₽ в год, сверх — 7,6% (IT-льготы).',
  tax: 'Например: 1% выручки — минимальный налог УСН 15%, пока расходы больше доходов.',
  vat: 'Например: 0% до 20 000 000 ₽ выручки в год, сверх — 5%.',
  acquiring: 'Например: 2,9% с каждой оплаты.',
};
function editRates(key) {
  const def = RATE_DEFS[key];
  let periods = rateTable(key).map(p => ({from: p.from, label: p.label, steps: p.steps.map(st => ({upTo: st.upTo, rate: Math.round(st.rate * 10000) / 100}))}));
  const months = rateMonths();
  const nextFree = () => { const used = new Set(periods.map(p => p.from)); return months.find(mm => mm > (periods[periods.length - 1].from || monthOf(today())) && !used.has(mm)) || months[months.length - 1]; };
  openModal({
    title: def.name,
    wide: true,
    body: `<p class="note">${def.of[0].toUpperCase() + def.of.slice(1)}. Порог — ${def.year}; каждый январь счёт начинается заново. ${RATE_EXAMPLE[key]}</p><div id="rtBox"></div>`,
    foot: '<button class="btn" data-close>Отмена</button><button class="btn primary" id="rtSave">Сохранить</button>',
    onMount(el, close) {
      const read = () => {
        $$('[data-per]', el).forEach(box => {
          const p = periods[Number(box.dataset.per)];
          const f = $('[data-from]', box); if (f) p.from = f.value;
          p.label = $('[data-label]', box).value.trim().slice(0, 60);
          p.steps = $$('[data-step]', box).map(r => ({upTo: $('[data-up]', r) ? (parseNum($('[data-up]', r).value) || null) : null, rate: parseNum($('[data-rate]', r).value)}));
        });
      };
      const preview = p => stepsText(cleanSteps(p.steps.map(st => ({upTo: st.upTo, rate: st.rate / 100}))));
      const draw = () => {
        $('#rtBox', el).innerHTML = periods.map((p, i) => `<div class="rp card flat" data-per="${i}">
            <div class="rp-head">
              ${i ? `<label class="field"><span>С месяца</span><select class="select" data-from>${months.map(mm => `<option value="${mm}" ${mm === p.from ? 'selected' : ''}>${monthName(mm, true)}</option>`).join('')}</select></label>` : '<div class="rp-start"><span class="label">Период</span><b>С начала</b></div>'}
              <label class="field rp-label"><span>Название периода</span><input class="input" data-label maxlength="60" value="${esc(p.label)}" placeholder="${i ? 'Например: после регистрации ООО' : 'Например: до регистрации ООО'}"></label>
              ${i ? `<button type="button" class="icon-btn" data-pdel="${i}" title="Убрать период" aria-label="Убрать период">${icon('trash')}</button>` : ''}
            </div>
            <div class="rp-steps">${p.steps.map((st, j) => {
              const last = j === p.steps.length - 1;
              return `<div class="rs" data-step="${j}">
                ${last ? `<span class="rs-l">${p.steps.length > 1 ? 'Сверх порога' : 'Ставка'}</span>` : `<span class="rs-l">До</span><input class="input num" data-up inputmode="decimal" value="${st.upTo || ''}" placeholder="2 400 000"><span class="rs-l">₽ в год —</span>`}
                <input class="input num rs-rate" data-rate inputmode="decimal" value="${st.rate}"><span class="rs-l">%</span>
                ${!last ? `<button type="button" class="icon-btn" data-sdel="${i}:${j}" title="Убрать порог" aria-label="Убрать порог">${icon('x')}</button>` : ''}</div>`;
            }).join('')}
              <button type="button" class="btn sm ghost" data-sadd="${i}">${icon('plus')}Порог за год</button></div>
            <div class="note rp-prev">${i ? monthFrom(p.from) : 'С начала'}: ${esc(preview(p))}</div>
          </div>`).join('') + `<button type="button" class="btn sm" data-padd>${icon('plus')}Новый период с даты</button>`;
      };
      draw();
      on(el, 'input', 'input', () => { read(); $$('[data-per]', el).forEach(box => { const p = periods[Number(box.dataset.per)], i = Number(box.dataset.per); $('.rp-prev', box).textContent = `${i ? monthFrom(p.from) : 'С начала'}: ${preview(p)}`; }); });
      on(el, 'change', '[data-from]', () => { read(); draw(); });
      on(el, 'click', '[data-padd]', () => {
        read();
        const lastP = periods[periods.length - 1];
        periods.push({from: nextFree(), label: '', steps: [{upTo: null, rate: lastP.steps[lastP.steps.length - 1].rate}]});
        draw();
      });
      on(el, 'click', '[data-pdel]', (e, b) => { read(); periods.splice(Number(b.dataset.pdel), 1); draw(); });
      on(el, 'click', '[data-sadd]', (e, b) => {
        read();
        const p = periods[Number(b.dataset.sadd)], caps = p.steps.filter(st => st.upTo), open = p.steps[p.steps.length - 1];
        p.steps.splice(p.steps.length - 1, 0, {upTo: caps.length ? caps[caps.length - 1].upTo * 2 : null, rate: open.rate});
        draw();
        const ups = $$(`[data-per="${b.dataset.sadd}"] [data-up]`, el); const f = ups[ups.length - 1]; if (f && !f.value) f.focus();
      });
      on(el, 'click', '[data-sdel]', (e, b) => { read(); const [i, j] = b.dataset.sdel.split(':').map(Number); periods[i].steps.splice(j, 1); draw(); });
      $('#rtSave', el).onclick = () => {
        read();
        const froms = periods.slice(1).map(p => p.from);
        if (new Set(froms).size !== froms.length) { toast('У двух периодов один и тот же месяц начала'); return; }
        for (const p of periods) {
          if (p.steps.some(st => st.rate < 0 || st.rate > 100)) { toast('Ставка — от 0 до 100%'); return; }
          const caps = p.steps.slice(0, -1);
          if (caps.some(st => !(st.upTo > 0))) { toast('Укажите порог в рублях за год или уберите строку'); return; }
          if (caps.some((st, j) => j && st.upTo <= caps[j - 1].upTo)) { toast('Пороги — по возрастанию: каждый следующий больше предыдущего'); return; }
        }
        const out = periods.map((p, i) => ({from: i ? p.from : '', label: p.label, steps: p.steps.map(st => ({upTo: st.upTo || null, rate: Math.round(st.rate * 100) / 10000}))}))
          .sort((a, b) => a.from.localeCompare(b.from));
        const patch = {rates: {[key]: out}};
        /* старое поле — ставка этого месяца без порога: на нём держатся прежние подсказки */
        if (def.legacy) patch[def.legacy] = rateAt(key, monthOf(today()), 0, {...settings(), rates: {...(settings().rates || {}), [key]: out}});
        saveSettings(patch);
        close();
        toast(`${def.name}: ${rateTimeline(key)}`);
      };
    },
  });
}
