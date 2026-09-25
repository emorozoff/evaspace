/* Деньги: быстрая запись сверху → месяцы → P&L план/факт → план платежей
   с кнопкой «Оплатить» → журнал. Выручка подписок приходит из «Отчётов»
   (цифры продаж), поэтому здесь её вручную не вносим. */

const MoneyUI = {
  draft: {kind: 'out', amount: '', cat: 'other', date: '', note: ''},
};
const catName = (kind, cat) => ((KINDS[kind] || {}).cats || {})[cat] || 'Прочее';
const monthStatus = m => (m < monthOf(today()) ? 'fact' : m === monthOf(today()) ? 'now' : 'plan');
const STATUS_TAG = {fact: 'факт', now: 'идёт', plan: 'план'};

App.register('money', {
  title: 'Деньги',
  render(root) {
    if (!Auth.can('money.view')) { root.innerHTML = pageHead('Деньги', '') + noAccess(); return; }
    const s = settings(), sc = s.scenario;
    const edit = Auth.can('money.edit');
    const rows = pnl(sc);
    const cash = Money.cashNow();

    root.innerHTML = `
      ${pageHead('Деньги', 'Сверху — быстрая запись расхода, прихода или вложения. Ниже — P&L по месяцам, план платежей и журнал всех операций.', helpBtn('money'))}
      ${helpBox('money', `<b>Как вести деньги.</b><ol>
        <li>Потратили или получили деньги — запишите строкой сверху: сумма, статья, дата. Enter — сохранить. Ошиблись — «Отменить» в уведомлении или правка в журнале.</li>
        <li>Плановые платежи (зарплаты, штаб, сервисы) отмечайте кнопкой «Оплатить» в плане — операция запишется в журнал сама.</li>
        <li>Выручку подписок вносить не нужно: она считается из цифр продаж в «Отчётах».</li>
        <li>«Вложение» — деньги основателя или инвестора: они пополняют счёт, но не считаются доходом.</li></ol>`)}
      ${edit ? quickEntryHtml() : ''}
      <div class="money-top">
        <div class="card stat cash-card"><span class="label">На счёте сейчас</span><div class="big">${rubK(cash)}</div>
          <div class="foot">старт ${rubK(s.cashStart)} на ${dayLong(s.cashDate)} + все операции и выручка</div></div>
        ${rows.map(r => {
          const st = monthStatus(r.m);
          const f = st === 'plan' ? r.plan : r.fact;
          return `<div class="card month-card ${st}"><div class="mc-h"><b>${monthName(r.m)}</b><span class="pill ${st === 'now' ? 'rose' : ''}">${STATUS_TAG[st]}</span></div>
            <div class="mc-row"><span>Доходы</span><b class="good">${rubK(f.income)}</b></div>
            <div class="mc-row"><span>Расходы</span><b class="bad">${rubK(f.outTotal)}</b></div>
            <div class="mc-row total"><span>Итог</span><b class="${f.profit < 0 ? 'bad' : 'good'}">${signed(f.profit)}</b></div>
            ${st !== 'plan' ? `<div class="note">план: ${signed(r.plan.profit)}</div>` : '<div class="note">по плану платежей и сценарию</div>'}</div>`;
        }).join('')}
      </div>
      <section class="section">
        <div class="section-head"><h2>P&amp;L по месяцам</h2><span class="hint-inline">Крупно — факт, мелко — план. Будущие месяцы — только план. Сценарий продаж «${SCENARIOS[sc].name}».</span></div>
        ${pnlTable(rows)}
      </section>
      <section class="section">
        <div class="section-head"><h2>План платежей</h2><span class="hint-inline">${edit ? 'Нажмите «Оплатить», когда деньги ушли — операция попадёт в журнал и в P&L.' : 'Что и когда платим до конца года.'}</span>
          ${edit ? `<button class="btn sm" data-plan-add>${icon('plus')}Платёж</button>` : ''}</div>
        ${planTable()}
      </section>
      <section class="section">
        <div class="section-head"><h2>Журнал операций</h2>${ledgerFilters()}</div>
        ${ledgerTable()}
      </section>
      ${Auth.can('settings.edit') ? moneySettingsHtml() : ''}`;

    wireHelp(root);
    if (edit) wireQuickEntry(root);
    wirePlan(root);
    wireLedger(root);
    if (Auth.can('settings.edit')) wireMoneySettings(root);
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
    <p class="note">План расходов = план платежей ниже + от выручки по плану: реферальные ${pct(settings().referral)} первых оплат, эквайринг ${pct(settings().acquiring, 1)}, налог ${pct(settings().taxRate)}.</p>`;
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
    const paid = Money.paid(it, m);
    const canPay = edit && (it.group !== 'payroll' || seePay);
    if (paid) return `<td class="r plan-c paid"><button class="pay-btn paid" ${canPay ? `data-unpay="${it.id}:${m}"` : 'disabled'} title="Оплачено ${dayLong(paid.date)}${canPay ? ' — нажмите, чтобы отменить' : ''}"><span>${rub(a)}</span>${icon('tick')}</button></td>`;
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
      return `<tr><td><button class="plan-name" ${edit && (g !== 'payroll' || seePay) ? `data-plan-edit="${it.id}"` : 'disabled'}>${esc(it.title)}</button>
        <div class="note">${g === 'payroll' ? `${p ? esc(personName(p)) + ' · ' : ''}${rub(it.amount)}${it.insurance !== false ? ' + взносы ' + pct(settings().insurance, 1) : ''}` : `${catName('out', it.cat)} · ${rub(it.amount)}${g === 'regular' ? ' в месяц' : ''}`}</div></td>
        ${months.map(m => cell(it, m)).join('')}<td class="r"><b>${rub(sum(months, m => Money.planAmount(it, m)))}</b></td></tr>`;
    }).join('');
  }).join('');
  const tot = m => sum(items, it => Money.planAmount(it, m));
  const paidTot = m => sum(items, it => (Money.paid(it, m) ? Money.planAmount(it, m) : 0));
  return `<div class="table-wrap"><table class="t plan grid-lines">
    <thead><tr><th>Платёж</th>${months.map(m => `<th class="r">${monthName(m)}</th>`).join('')}<th class="r">Всего</th></tr></thead>
    <tbody>${groupRows}
      <tr class="total"><td>Итого по плану</td>${months.map(m => `<td class="r">${rub(tot(m))}</td>`).join('')}<td class="r">${rub(sum(months, tot))}</td></tr>
      <tr class="sub"><td>Оплачено</td>${months.map(m => `<td class="r good">${paidTot(m) ? rub(paidTot(m)) : '—'}</td>`).join('')}<td class="r good">${rub(sum(months, paidTot))}</td></tr>
      <tr class="sub"><td>Осталось оплатить</td>${months.map(m => `<td class="r">${tot(m) - paidTot(m) ? rub(tot(m) - paidTot(m)) : '—'}</td>`).join('')}<td class="r">${rub(sum(months, m => tot(m) - paidTot(m)))}</td></tr>
    </tbody></table></div>`;
}
function wirePlan(root) {
  on(root, 'click', '[data-pay]', async (e, el) => {
    const [id, m] = el.dataset.pay.split(':');
    const it = Store.get('plan', id);
    if (!it) return;
    const a = Money.planAmount(it, m);
    if (!(await confirmPop(el, {text: `Отметить оплаченным: ${it.title}, ${monthName(m).toLowerCase()} — ${rub(a)}?`, yes: 'Да, оплачено'}))) return;
    const cur = monthOf(today());
    const date = m === cur ? today() : m < cur ? monthEnd(m) : today();
    Store.add('ledger', {kind: 'out', amount: a, cat: it.group === 'payroll' ? 'payroll' : (it.cat || 'other'), date, note: it.title,
      planId: it.id, planMonth: m, by: Tasks.meKey(), at: Date.now()});
    toast(`Оплачено: ${it.title}`);
  });
  on(root, 'click', '[data-unpay]', async (e, el) => {
    const [id, m] = el.dataset.unpay.split(':');
    const it = Store.get('plan', id);
    const paid = it && Money.paid(it, m);
    if (!paid) return;
    if (!(await confirmPop(el, {text: `Отменить оплату: ${it.title}, ${monthName(m).toLowerCase()}? Операция уйдёт из журнала.`, yes: 'Да, отменить', danger: true}))) return;
    const copy = clone(paid);
    Store.remove('ledger', paid.id);
    toast('Оплата отменена', {undo: () => Store.put('ledger', copy.id, copy)});
  });
  on(root, 'click', '[data-plan-edit]', (e, el) => editPlanItem(el.dataset.planEdit));
  on(root, 'click', '[data-plan-add]', () => editPlanItem(null));
}
function editPlanItem(id) {
  const it = id ? Store.get('plan', id) : null;
  const seePay = Auth.can('payroll.view');
  const v = it || {title: '', group: 'regular', cat: 'office', amount: '', months: [monthOf(today())], insurance: true, personId: ''};
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
        <label class="check pi-ins"><input type="checkbox" id="piIns" ${v.insurance !== false ? 'checked' : ''}>Плюс страховые взносы ${pct(settings().insurance, 1)}</label>
      </div>
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
      $('#piSave', el).onclick = () => {
        const title = $('#piTitle', el).value.trim();
        const amount = parseNum($('#piAmount', el).value);
        const months = $$('.chip.pick input:checked', el).map(i => i.value);
        if (!title) return $('#piTitle', el).focus();
        if (!(amount > 0)) { $('#piAmount', el).focus(); toast('Укажите сумму'); return; }
        if (!months.length) { toast('Отметьте хотя бы один месяц'); return; }
        const group = $('#piGroup', el).value;
        const data = {title, group, amount, months, cat: group === 'payroll' ? 'payroll' : $('#piCat', el).value,
          personId: group === 'payroll' ? $('#piPerson', el).value || null : null, insurance: group === 'payroll' ? $('#piIns', el).checked : false};
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
      ${e0.planId ? '<p class="note">Операция создана кнопкой «Оплатить» в плане платежей. Если удалить её, платёж снова станет неоплаченным.</p>' : ''}`,
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
  const s = settings();
  return `<details class="section card settings-box" ${View.get('m.set', false) ? 'open' : ''} id="mSet">
    <summary><h2>Настройки расчёта</h2><span class="note">деньги на старте, ставки, план вложений</span></summary>
    <div class="grid3 set-grid">
      <label class="field"><span>Деньги на счёте на старте, ₽</span><input class="input num" id="msCash" inputmode="decimal" value="${s.cashStart}"></label>
      <label class="field"><span>Дата старта</span><input class="input" id="msDate" type="date" value="${esc(s.cashDate)}"></label>
      <label class="field"><span>Страховые взносы, %</span><input class="input num" id="msIns" inputmode="decimal" value="${fmt(s.insurance * 100, 1)}"></label>
      <label class="field"><span>Эквайринг, % выручки</span><input class="input num" id="msAcq" inputmode="decimal" value="${fmt(s.acquiring * 100, 1)}"></label>
      <label class="field"><span>Налог, % выручки</span><input class="input num" id="msTax" inputmode="decimal" value="${fmt(s.taxRate * 100, 1)}"><small>УСН 15%: минимальный налог 1%, пока расходы больше доходов</small></label>
    </div>
    <div class="field"><span>План вложений по месяцам, ₽ — попадает в Cash Flow, пока деньги не пришли</span>
      <div class="grid3">${Q.months.map(m => `<label class="field"><span>${monthName(m)}</span><input class="input num" data-inv="${m}" inputmode="decimal" value="${(s.invest || {})[m] || ''}" placeholder="0"></label>`).join('')}</div></div>
    <div class="row"><button class="btn primary" id="msSave">Сохранить настройки</button></div>
  </details>`;
}
function wireMoneySettings(root) {
  const box = $('#mSet', root);
  box.addEventListener('toggle', () => View.set('m.set', box.open));
  $('#msSave', root).onclick = () => {
    const invest = {};
    $$('[data-inv]', root).forEach(i => { invest[i.dataset.inv] = Math.max(0, parseNum(i.value)); });
    saveSettings({cashStart: parseNum($('#msCash', root).value), cashDate: $('#msDate', root).value || '2026-09-01',
      insurance: parseNum($('#msIns', root).value) / 100, acquiring: parseNum($('#msAcq', root).value) / 100,
      taxRate: parseNum($('#msTax', root).value) / 100, invest});
    toast('Настройки сохранены');
  };
}