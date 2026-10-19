/* Финансы в Excel — резервная копия и шаблон для своих расчётов.
   Лист «Настройки» — исходные цифры (жёлтые ячейки: цена, удержание,
   рефералка, ставки по месяцам, план продаж и вложений), «План платежей» —
   что и когда платим, «Прогноз» считается из них формулами так же, как
   Cash Flow в штабе: поменяли ставку или продажи — пересчитался весь прогноз.
   Прошедшие месяцы — факт из журнала (числа), текущий — факт плюс план.
   Остальные листы — данные на момент выгрузки. Контактов клиентов в файле нет.
   Библиотека ExcelJS (MIT) грузится только по кнопке: на своём сервере — с него же. */

const XL = {
  money: '#,##0.00 "₽"', int: '#,##0', pct: '0.0%', date: 'dd.mm.yyyy',
  head: {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FF2E2A5C'}},
  input: {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFFFF3C4'}},
  fact: {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFF1F1F4'}},
  total: {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFE9E7F7'}},
};
const xlCol = n => { let s = ''; for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s; return s; };
const xlDate = iso => (/^\d{4}-\d\d-\d\d$/.test(iso || '') ? new Date(iso + 'T00:00:00Z') : (iso || ''));
async function xlLoad() {
  if (window.ExcelJS) return window.ExcelJS;
  const src = onServer() ? '/vendor/exceljs.min.js' : 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
  await new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('нет библиотеки')); document.head.appendChild(s); });
  return window.ExcelJS;
}
/* лист-таблица: шапка, строки, форматы колонок */
function xlTable(wb, name, cols, rows, {note = ''} = {}) {
  const ws = wb.addWorksheet(name, {views: [{state: 'frozen', ySplit: note ? 3 : 1}]});
  if (note) { ws.addRow([note]).font = {italic: true, color: {argb: 'FF6B6880'}}; ws.addRow([]); }
  const h = ws.addRow(cols.map(c => c[1]));
  xlHead(h);
  rows.forEach(r => ws.addRow(cols.map(c => { const v = typeof c[0] === 'function' ? c[0](r) : r[c[0]]; return v === undefined || v === null ? '' : v; })));
  cols.forEach((c, i) => { const col = ws.getColumn(i + 1); col.width = c[3] || Math.max(10, Math.min(40, c[1].length + 4)); if (c[2]) col.numFmt = XL[c[2]] || c[2]; });
  if (rows.length) ws.autoFilter = {from: {row: h.number, column: 1}, to: {row: h.number, column: cols.length}};
  return ws;
}
function xlHead(row) {
  row.eachCell(c => { c.fill = XL.head; c.font = {bold: true, color: {argb: 'FFFFFFFF'}}; c.alignment = {vertical: 'middle', wrapText: true}; });
  row.height = 30;
}

async function xlFinance() {
  const ExcelJS = await xlLoad();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Штаб Eva Club';
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true;
  const s = settings(), sc = s.scenario, t = today(), cur = monthOf(t);
  const cf = cashFlow(sc), months = CF_MONTHS, live = months.filter(m => m >= cur);
  const MC = i => xlCol(2 + i);                        // колонка месяца: B, C, D, E…
  const payPriv = !Auth.can('payroll.view');

  /* ── Как пользоваться ── */
  const how = wb.addWorksheet('Как пользоваться');
  [[`Финансы Eva Club — выгрузка ${dayLong(t)}`],
    [''],
    ['Зачем этот файл'],
    ['1. Резервная копия: все финансовые данные штаба на дату выгрузки.'],
    ['2. Шаблон для своих расчётов: меняйте цифры здесь, штаб от этого не меняется.'],
    [''],
    ['Как устроено'],
    ['• «Настройки» — исходные цифры. Жёлтые ячейки можно менять: цена, удержание, рефералка, ставки по месяцам, план продаж и вложений.'],
    ['• «План платежей» — что и когда платим (жёлтые суммы тоже можно менять).'],
    ['• «Прогноз» — приход, расход и деньги на счёте по месяцам. Считается формулами из «Настроек» и «Плана платежей», как Cash Flow в штабе.'],
    ['• «Обзор» — главные цифры; итоги до 31 декабря тоже считаются формулами.'],
    ['• Серые месяцы — факт из журнала, их формулы не меняют. Текущий месяц — факт плюс то, что ещё по плану.'],
    ['• Остальные листы (журнал, продажи, подписки, курсы, маркетплейс, выплаты, возвраты, сценарии) — данные на дату выгрузки.'],
    ['• Контактов клиентов в файле нет: только суммы, даты и статусы.'],
    [''],
    ['Совет: перед своими расчётами сохраните копию файла, чтобы оригинал остался резервной копией.'],
  ].forEach((r, i) => { const row = how.addRow(r); if (i === 0) row.font = {bold: true, size: 16}; if (['Зачем этот файл', 'Как устроено'].includes(r[0])) row.font = {bold: true, size: 12}; });
  how.getColumn(1).width = 120;

  /* «Обзор» — вторым листом; заполняем в конце, когда известны строки «Прогноза» */
  const ov = wb.addWorksheet('Обзор');

  /* ── Настройки ── */
  const set = wb.addWorksheet('Настройки', {views: [{state: 'frozen', xSplit: 1}]});
  set.getColumn(1).width = 46;
  months.forEach((m, i) => { set.getColumn(2 + i).width = 18; });
  set.getColumn(2 + months.length).width = 60;
  const title = (ws, text) => { const r = ws.addRow([text]); r.font = {bold: true, size: 14}; return r; };
  title(set, 'Исходные цифры для прогноза');
  set.addRow(['Жёлтые ячейки можно менять — «Прогноз» и «Обзор» пересчитаются сами.']).font = {italic: true, color: {argb: 'FF6B6880'}};
  set.addRow([]);
  const one = (label, v, fmt, input = true, hint = '') => {
    const r = set.addRow([label, v]);
    const c = r.getCell(2); c.numFmt = fmt; if (input) c.fill = XL.input;
    if (hint) r.getCell(2 + months.length).value = hint;
    return `Настройки!$B$${r.number}`;
  };
  const S = {
    cash: one('Деньги на счёте на старте, ₽', Number(s.cashStart) || 0, XL.money, true, `на ${dayLong(s.cashDate)}`),
    price: one('Подписка в месяц, ₽', Number(s.price) || 0, XL.money),
    year: one('Годовая подписка, ₽', priceYear(), XL.money, false, 'для справки: прогноз считает выручку по месячной цене, как штаб'),
    ret: one('Продлевают в следующем месяце', Number(s.retention) || 0, XL.pct),
    ref: one('Рефералам с первой оплаты', Number(s.referral) || 0, XL.pct),
  };
  set.addRow([]);
  const mh = set.addRow(['По месяцам', ...months.map(m => `${monthName(m)} · ${STATUS_TAG[monthStatus(m)]}`), 'Пояснение']);
  xlHead(mh);
  /* действующие ставки месяца — как считает штаб (с порогами за год) */
  let ytd = 0;
  const eff = {};
  cf.forEach((r, i) => {
    if (!i || r.m.endsWith('-01')) ytd = revenueBefore(r.m);
    const rev = r.revNew + r.revRenew;
    eff[r.m] = Object.fromEntries(['tax', 'vat', 'acquiring'].map(k => [k, rev > 0 ? rateCharge(k, r.m, rev, ytd) / rev : rateAt(k, r.m, ytd)]));
    let base = 0, ins = 0;
    Money.planItems().forEach(it => { if (it.group === 'payroll' && it.insurance !== false) { const b = Money.planBase(it, r.m); base += b; ins += b ? Money.insurance(it, r.m, b) : 0; } });
    eff[r.m].insurance = base > 0 ? ins / base : rateAt('insurance', r.m, 0);
    ytd += rev;
  });
  const perMonth = (label, get, fmt, hint = '') => {
    const r = set.addRow([label, ...months.map(get), hint]);
    months.forEach((m, i) => { const c = r.getCell(2 + i); c.numFmt = fmt; c.fill = monthStatus(m) === 'fact' ? XL.fact : XL.input; });
    return i => `Настройки!${MC(i)}$${r.number}`;
  };
  const R = {
    sales: perMonth('Новые продажи (первые оплаты), шт', m => cf.find(x => x.m === m).fresh, '#,##0.##', 'факт — оплаты из «Цифр дня»; дальше — план по сценарию «' + SCENARIOS[sc].name + '» (в текущем месяце: факт + остаток плана)'),
    tax: perMonth('Налог, % выручки', m => eff[m].tax, '0.00%', 'действующая ставка месяца с учётом порогов за год'),
    vat: perMonth('НДС, % выручки', m => eff[m].vat, '0.00%'),
    acq: perMonth('Эквайринг, % выручки', m => eff[m].acquiring, '0.00%'),
    ins: perMonth('Взносы, % зарплаты', m => eff[m].insurance, '0.00%', 'для строк плана платежей с отметкой «Взносы: да»'),
    inv: perMonth('Вложения по плану, ₽', m => (monthStatus(m) === 'fact' ? cf.find(x => x.m === m).invest : Number((s.invest || {})[m]) || 0), XL.money, 'деньги основателя и инвесторов; пока не пришли — по плану'),
  };

  /* ── План платежей: что ещё платить (база без взносов) ── */
  const plan = wb.addWorksheet('План платежей', {views: [{state: 'frozen', ySplit: 3, xSplit: 1}]});
  title(plan, 'План платежей');
  plan.addRow(['Суммы без взносов. В текущем месяце — сколько ещё осталось оплатить. Жёлтое можно менять.']).font = {italic: true, color: {argb: 'FF6B6880'}};
  const ph = plan.addRow(['Платёж', 'Статья', 'Взносы', ...live.map(m => monthName(m) + (m === cur ? ' (осталось)' : ''))]);
  xlHead(ph);
  const planRows = [];
  const toPay = (it, m) => {
    const full = Money.planAmount(it, m), base = Money.planBase(it, m);
    if (!full) return 0;
    const left = m === cur ? Money.left(it, m) : full;
    return kop(left * base / full);
  };
  const add = (name, cat, ins, vals) => planRows.push([name, OUT_CATS[cat] || cat, ins ? 'да' : 'нет', ...vals]);
  if (payPriv) {
    [true, false].forEach(ins => {
      const items = Money.planItems().filter(it => it.group === 'payroll' && (it.insurance !== false) === ins);
      if (items.length) add('Оплата труда (сводно)', 'payroll', ins, live.map(m => kop(sum(items, it => toPay(it, m)))));
    });
  }
  Money.planItems().filter(it => !(payPriv && it.group === 'payroll')).forEach(it => {
    const cat = it.group === 'payroll' ? 'payroll' : (it.cat || 'other');
    add(it.title || 'Без названия', cat, it.group === 'payroll' && it.insurance !== false, live.map(m => toPay(it, m)));
  });
  planRows.forEach(v => { const r = plan.addRow(v); live.forEach((m, i) => { const c = r.getCell(4 + i); c.numFmt = XL.money; c.fill = XL.input; }); });
  const pFirst = ph.number + 1, pLast = Math.max(pFirst, ph.number + planRows.length + 20);   // запас строк под свои платежи
  plan.getColumn(1).width = 38; plan.getColumn(2).width = 28; plan.getColumn(3).width = 10;
  live.forEach((m, i) => { plan.getColumn(4 + i).width = 18; });
  const planSum = (m, cat, ins) => {
    const i = live.indexOf(m), col = xlCol(4 + i);
    const crit = `'План платежей'!$B$${pFirst}:$B$${pLast},"${OUT_CATS[cat]}"` + (ins === undefined ? '' : `,'План платежей'!$C$${pFirst}:$C$${pLast},"${ins ? 'да' : 'нет'}"`);
    return `SUMIFS('План платежей'!${col}$${pFirst}:${col}$${pLast},${crit})`;
  };

  /* ── Прогноз: Cash Flow формулами ── */
  const pr = wb.addWorksheet('Прогноз', {views: [{state: 'frozen', ySplit: 3, xSplit: 1}]});
  title(pr, `Прогноз денег до 31 декабря · сценарий продаж «${SCENARIOS[sc].name}»`);
  pr.addRow(['Серые месяцы — факт из журнала. Остальное считается из «Настроек» и «Плана платежей».']).font = {italic: true, color: {argb: 'FF6B6880'}};
  const hh = pr.addRow(['', ...months.map(m => `${monthName(m)} · ${STATUS_TAG[monthStatus(m)]}`), 'Итого']);
  xlHead(hh);
  pr.getColumn(1).width = 44;
  months.forEach((m, i) => { pr.getColumn(2 + i).width = 18; });
  pr.getColumn(2 + months.length).width = 20;
  const TOT = xlCol(2 + months.length);
  const rowNo = {};
  /* строка: для каждого месяца — число (факт) или формула; f получает (i, m, r, ref) */
  const line = (key, label, f, {fmt = XL.money, total = true, bold = false, fill = null} = {}) => {
    const r = pr.addRow([label]);
    rowNo[key] = r.number;
    months.forEach((m, i) => {
      const c = r.getCell(2 + i), v = f(i, m, cf[i]);
      c.value = v; c.numFmt = fmt;
      if (monthStatus(m) === 'fact') c.fill = XL.fact;
    });
    if (total) { const c = r.getCell(2 + months.length); c.value = {formula: `SUM(B${r.number}:${MC(months.length - 1)}${r.number})`}; c.numFmt = fmt; c.font = {bold: true}; }
    if (bold) r.font = {bold: true};
    if (fill) r.eachCell(c => { c.fill = fill; });
    return r;
  };
  const ref = (key, i) => `${MC(i)}${rowNo[key]}`;
  const F = (formula, result) => ({formula, result: Number.isFinite(result) ? Math.round(result * 100) / 100 : undefined});
  const fact = m => monthStatus(m) === 'fact';
  const now = m => monthStatus(m) === 'now';
  const facts = Object.fromEntries(months.map(m => [m, {f: Sales.month(m), led: Money.month(m)}]));
  const n2 = x => kop(Number(x) || 0);
  line('fresh', 'Новые продажи, шт', (i, m, r) => (fact(m) ? r.fresh : F(R.sales(i), r.fresh)), {fmt: '#,##0.##'});
  line('renew', 'Продления, шт', (i, m, r) => (fact(m) ? r.renewCount : F(i ? `MAX(${n2(facts[m].f.renewals)},(${ref('fresh', i - 1)}+${ref('renew', i - 1)})*${S.ret})` : `${n2(facts[m].f.renewals)}`, r.renewCount)), {fmt: '#,##0.##'});
  line('revNew', 'Выручка: первые оплаты', (i, m, r) => (fact(m) ? n2(r.revNew) : F(`${n2(facts[m].f.revNew)}+MAX(0,${ref('fresh', i)}-${n2(facts[m].f.pays)})*${S.price}`, r.revNew)));
  line('revRenew', 'Выручка: продления', (i, m, r) => (fact(m) ? n2(r.revRenew) : F(`MAX(${n2(facts[m].f.revRenew)},${ref('renew', i)}*${S.price})`, r.revRenew)));
  line('otherIn', 'Прочие приходы (курсы, маркетплейс и др.)', (i, m, r) => n2(r.otherIn));
  line('inTotal', 'Приход всего', (i, m, r) => F(`${ref('revNew', i)}+${ref('revRenew', i)}+${ref('otherIn', i)}`, r.inTotal), {bold: true, fill: XL.total});
  line('invest', 'Вложения', (i, m, r) => (fact(m) ? n2(r.invest) : F(`MAX(${n2(facts[m].led.invest)},${R.inv(i)})`, r.invest)));
  const outKeys = [];
  /* постоянные статьи: факт журнала + что ещё платить по плану */
  FIXED_CATS.forEach(c => {
    if (c === 'payroll') {
      line('payBase', `${OUT_CATS.payroll}: оклады`, (i, m, r) => (fact(m) ? n2(r.out.payroll) : F(`${n2(facts[m].led.cats.out.payroll)}+${planSum(m, 'payroll')}`, null)));
      line('payIns', 'Взносы с зарплаты', (i, m, r) => (fact(m) ? 0 : F(`${planSum(m, 'payroll', true)}*${R.ins(i)}`, null)));
      outKeys.push('payBase', 'payIns');
      return;
    }
    line('out_' + c, OUT_CATS[c], (i, m, r) => (fact(m) ? n2(r.out[c]) : F(`${n2(facts[m].led.cats.out[c])}+${planSum(m, c)}`, r.out[c])));
    outKeys.push('out_' + c);
  });
  /* от выручки: рефералка — от первых оплат, остальное — от всей выручки подписок */
  const varLine = (c, label, base, rate) => {
    line('out_' + c, label, (i, m, r) => (fact(m) ? n2(r.out[c]) : F(`MAX(${n2(facts[m].led.cats.out[c])},${base(i)}*${rate(i)})`, r.out[c])));
    outKeys.push('out_' + c);
  };
  varLine('referral', OUT_CATS.referral, i => ref('revNew', i), () => S.ref);
  varLine('acquiring', OUT_CATS.acquiring, i => `(${ref('revNew', i)}+${ref('revRenew', i)})`, R.acq);
  varLine('tax', OUT_CATS.tax, i => `(${ref('revNew', i)}+${ref('revRenew', i)})`, R.tax);
  varLine('vat', OUT_CATS.vat, i => `(${ref('revNew', i)}+${ref('revRenew', i)})`, R.vat);
  line('outTotal', 'Расход всего', (i, m, r) => F(outKeys.map(k => ref(k, i)).join('+'), r.outTotal), {bold: true, fill: XL.total});
  line('net', 'Чистый поток (приход + вложения − расход)', (i, m, r) => F(`${ref('inTotal', i)}+${ref('invest', i)}-${ref('outTotal', i)}`, r.net), {bold: true});
  line('open', 'На счёте в начале месяца', (i, m, r) => (i ? 0 : F(S.cash, r.open)), {total: false});
  line('close', 'На счёте в конце месяца', (i, m, r) => F(`${ref('open', i)}+${ref('net', i)}`, r.close), {total: false, bold: true, fill: XL.total});
  /* «в начале» ссылается на «в конце» прошлого месяца — номер строки известен только теперь */
  months.forEach((m, i) => { if (i) { const c = pr.getCell(`${MC(i)}${rowNo.open}`); c.value = {formula: `${MC(i - 1)}${rowNo.close}`, result: kop(cf[i].open)}; } });
  pr.getCell(`${TOT}${rowNo.close}`).value = '';
  /* отрицательный остаток — красным */
  pr.addConditionalFormatting({ref: `B${rowNo.close}:${MC(months.length - 1)}${rowNo.close}`, rules: [{type: 'cellIs', operator: 'lessThan', formulae: [0], style: {font: {color: {argb: 'FFC0392B'}, bold: true}}}]});

  /* ── Обзор ── */
  ov.getColumn(1).width = 46; ov.getColumn(2).width = 22; ov.getColumn(3).width = 70;
  title(ov, `Финансы Eva Club на ${dayLong(t)}`);
  ov.addRow([]);
  const oh = ov.addRow(['Показатель', 'Значение', 'Как считается']);
  xlHead(oh);
  const sub = Subs.now(), rate = Subs.rate(), u = unitEcon(t < Q.start ? monthStart(CF_MONTHS[0]) : Q.start, t);
  const P = k => `Прогноз!${TOT}${rowNo[k]}`, last = `Прогноз!${MC(months.length - 1)}${rowNo.close}`;
  const closeRange = `Прогноз!B${rowNo.close}:${MC(months.length - 1)}${rowNo.close}`;
  const totIn = sum(cf, r => r.inTotal), totOut = sum(cf, r => r.outTotal);
  [
    ['Баланс на сегодня', Money.cashNow(), XL.money, 'на дату выгрузки: старт + операции и выручка'],
    ['Деньги на 31 декабря', F(last, cf[cf.length - 1].close), XL.money, 'формула из «Прогноза»'],
    ['Минимум на счёте до конца года', F(`MIN(${closeRange})`, Math.min(...cf.map(r => r.close))), XL.money, 'если меньше нуля — нужны вложения'],
    ['Приход до 31 декабря', F(P('inTotal'), totIn), XL.money, 'с сентября, формула из «Прогноза»'],
    ['Расход до 31 декабря', F(P('outTotal'), totOut), XL.money, 'с сентября, формула из «Прогноза»'],
    ['Прибыль до 31 декабря', F(`${P('inTotal')}-${P('outTotal')}`, totIn - totOut), XL.money, 'приход минус расход, без вложений'],
    ['Рентабельность', F(`IF(${P('inTotal')}=0,0,(${P('inTotal')}-${P('outTotal')})/${P('inTotal')})`, totIn ? (totIn - totOut) / totIn : 0), XL.pct, 'прибыль ÷ приход'],
    ['Платных подписчиков', sub.total, XL.int, `месячных ${sub.endM}, годовых ${sub.endY}`],
    ['MRR — месячная выручка подписок', sub.mrr, XL.money, ''],
    ['Продления', rate && rate.renew !== null ? rate.renew : '', XL.pct, rate ? monthName(rate.m) : 'после первого месяца'],
    ['Возвраты, % от оплат', rate && rate.refund !== null ? rate.refund : '', XL.pct, ''],
    ['Средний чек оплаты', u.check || 0, XL.money, 'выручка подписок ÷ оплаты'],
    ['Маржа с оплаты', u.margin || 0, XL.money, 'чек минус эквайринг и налоги'],
    ['LTV — доход с подписчика', u.ltv || 0, XL.money, 'маржа × средний срок подписки'],
    ['Стоимость привлечения (CAC)', u.cac === null ? '' : u.cac, XL.money, 'маркетинг и рефералы ÷ новые платящие'],
    ['LTV / CAC', u.ltvCac === null ? '' : u.ltvCac, '0.0', 'от 3 — здорово, меньше 1 — привлечение не окупается'],
  ].forEach(([label, v, fmt, how2]) => { const r = ov.addRow([label, v, how2]); r.getCell(2).numFmt = fmt; r.getCell(3).font = {color: {argb: 'FF6B6880'}}; });
  /* план-факт по месяцам */
  ov.addRow([]);
  const pf = ov.addRow(['План-факт по месяцам', 'Доходы факт', 'Расходы факт', 'Итог факт', 'Доходы план', 'Расходы план', 'Итог план']);
  xlHead(pf);
  pnl(sc).forEach(r => { const row = ov.addRow([monthName(r.m), r.fact.income, r.fact.outTotal, r.fact.profit, r.plan.income, r.plan.outTotal, r.plan.profit]); for (let c = 2; c <= 7; c++) row.getCell(c).numFmt = XL.money; });
  [4, 5, 6, 7].forEach(c => { ov.getColumn(c).width = 18; });

  /* ── данные на дату выгрузки ── */
  xlTable(wb, 'Журнал операций', [[e => xlDate(e.date), 'Дата', XL.date, 12], [e => (KINDS[e.kind] || {}).name || e.kind, 'Тип', '', 12], [e => catName(e.kind, e.cat), 'Статья', '', 30],
    [e => (e.kind === 'out' ? -1 : 1) * (Number(e.amount) || 0), 'Сумма, ₽', XL.money, 18], [e => e.note || '', 'Комментарий', '', 50], [e => (e.planId ? 'по плану' : ''), 'План', '', 10], [e => (e.by ? whoName(e.by) : ''), 'Кто внёс', '', 20]], Money.ledger());
  xlTable(wb, 'Продажи по дням', [[x => xlDate(x.id), 'Дата', XL.date, 12], ['reach', 'Охват', XL.int], ['views', 'Просмотры', XL.int], ['clicks', 'Переходы', XL.int], ['regs', 'Регистрации', XL.int], ['pays', 'Оплаты', XL.int], ['renewals', 'Продления', XL.int],
    [x => revenueOf(x), 'Выручка, ₽', XL.money, 16], ['experts', 'Эксперты', XL.int], ['mk', 'Мастер-классы', XL.int]], Sales.list());
  xlTable(wb, 'Подписки', [[r => monthName(r.m), 'Месяц', '', 12], ['startM', 'Месячных на начало', XL.int], ['startY', 'Годовых на начало', XL.int], ['newM', 'Новые месячные', XL.int], ['newY', 'Новые годовые', XL.int], ['renewed', 'Продлили', XL.int], ['churn', 'Не продлили', XL.int],
    ['refunds', 'Возвраты, шт', XL.int], ['refundSum', 'Возвраты, ₽', XL.money, 16], ['endM', 'Месячных на конец', XL.int], ['endY', 'Годовых на конец', XL.int], ['total', 'Всего платных', XL.int],
    [r => (r.renewRate === null ? '' : r.renewRate), 'Продления', XL.pct], [r => (r.refundRate === null ? '' : r.refundRate), 'Возвраты', XL.pct], ['revenue', 'Выручка, ₽', XL.money, 16], ['mrr', 'MRR, ₽', XL.money, 16]], Subs.rows());
  const courseRows = [];
  Fin.courses().forEach(c => finMonths().forEach(m => { const x = Fin.courseSale(c, m); if (x.n || x.revenue) courseRows.push({c, m, ...x}); }));
  xlTable(wb, 'Курсы', [[r => r.c.title, 'Курс', '', 36], [r => r.c.author || '', 'Автор', '', 20], [r => monthName(r.m), 'Месяц', '', 12], ['n', 'Продано, шт', XL.int], [r => Number(r.c.price) || 0, 'Цена, ₽', XL.money, 14], ['revenue', 'Выручка, ₽', XL.money, 16],
    [r => (Number(r.c.authorPct) || 0) / 100, 'Доля автора', XL.pct], ['author', 'Автору, ₽', XL.money, 16]], courseRows);
  xlTable(wb, 'Заказы', [['no', '№', XL.int, 8], [o => xlDate(o.date), 'Дата', XL.date, 12], [o => (o.items || []).map(it => `${it.title} × ${it.qty}`).join(', '), 'Состав', '', 50], [o => Number(o.shipCost) || 0, 'Доставка, ₽', XL.money, 14],
    [o => Fin.orderTotal(o), 'Сумма, ₽', XL.money, 16], [o => (ORDER_PAY[o.pay || 'wait'] || {}).name, 'Оплата', '', 14], [o => xlDate(o.paidAt), 'Оплачен', XL.date, 12], [o => (ORDER_DELIVERY[o.delivery || 'new'] || {}).name, 'Доставка', '', 14]], Fin.orders(),
  {note: 'Без имён, телефонов и адресов клиентов.'});
  xlTable(wb, 'Товары', [['title', 'Товар', '', 36], ['sku', 'Артикул', '', 12], [p => p.seller || 'Свой склад', 'Чей', '', 20], [p => Number(p.price) || 0, 'Цена, ₽', XL.money, 14], [p => (p.seller ? '' : Number(p.cost) || 0), 'Себестоимость, ₽', XL.money, 16],
    [p => (p.seller ? (Number(p.fee) || 0) / 100 : ''), 'Комиссия клуба', XL.pct], [p => (p.seller || !isSet(p.stock) ? '' : Number(p.stock)), 'Остаток', XL.int]], Fin.products());
  xlTable(wb, 'Выплаты', [[x => PAYOUT_KINDS[x.kind].name, 'Кому', '', 16], ['to', 'Получатель', '', 28], [x => (x.course ? x.course.title : ''), 'Курс', '', 30], [x => monthName(x.month), 'Месяц', '', 12], ['amount', 'Начислено, ₽', XL.money, 16],
    [x => (x.paid ? 'выплачено' : x.closed ? 'к выплате' : 'начисляется'), 'Статус', '', 14], [x => xlDate(x.paidAt), 'Дата выплаты', XL.date, 14]], Fin.accruals(), {note: 'Партнёры, авторы и продавцы — без контактов.'});
  xlTable(wb, 'Сбои оплат', [[x => xlDate(x.date), 'Дата', XL.date, 12], [x => Number(x.amount) || 0, 'Сумма, ₽', XL.money, 16], [x => FAIL_REASONS[x.reason] || '', 'Причина', '', 36], [x => (FAIL_ST[x.status || 'new'] || {}).name, 'Статус', '', 22], ['attempts', 'Попыток', XL.int]], Fin.failed(),
    {note: 'Без данных клиентов: только даты, суммы и статусы.'});
  xlTable(wb, 'Возвраты', [[x => xlDate(x.date), 'Дата запроса', XL.date, 14], [x => REFUND_PRODUCTS[x.product] || '', 'Что возвращают', '', 16], [x => Number(x.amount) || 0, 'Сумма, ₽', XL.money, 16], ['reason', 'Причина', '', 34],
    [x => (REFUND_ST[x.status || 'new'] || {}).name, 'Статус', '', 20], [x => xlDate(x.refundedAt), 'Возвращено', XL.date, 14]], Fin.refunds(), {note: 'Без данных клиентов: только даты, суммы и статусы.'});
  /* сохранённые сценарии — итоги на дату выгрузки */
  const scs = scList();
  if (scs.length) {
    const res = [{name: 'План штаба', note: '', r: scResult(null)}, ...scs.map(x => ({name: x.name || 'Без названия', note: x.note || '', r: scResult(x.p || {})}))];
    xlTable(wb, 'Сценарии', [['name', 'Сценарий', '', 34], ['note', 'Описание', '', 34], [x => x.r.revenue, 'Выручка подписок, ₽', XL.money, 18], [x => x.r.outTotal, 'Расходы, ₽', XL.money, 18], [x => x.r.taxes, 'Налоги и НДС, ₽', XL.money, 18],
      [x => x.r.out.referral || 0, 'Рефералам, ₽', XL.money, 18], [x => x.r.profit, 'Прибыль, ₽', XL.money, 18], [x => (x.r.margin === null ? '' : x.r.margin), 'Рентабельность', XL.pct, 14], [x => x.r.cashEnd, 'Деньги на 31 декабря, ₽', XL.money, 20],
      [x => (x.r.negMonth ? monthName(x.r.negMonth) : 'хватает'), 'Когда кончатся деньги', '', 18]], res, {note: 'Итоги до 31 декабря из раздела «Сценарии» на дату выгрузки.'});
  }
  return wb.xlsx.writeBuffer();
}
async function xlDownload(btn) {
  if (btn) { btn.disabled = true; btn.dataset.label = btn.innerHTML; btn.innerHTML = `${icon('clock')}Готовлю файл…`; }
  try {
    const buf = await xlFinance();
    const name = `eva-finance-${today()}.xlsx`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([buf], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    toast(`Файл ${name} — сохранён`);
  } catch (e) {
    console.error(e);
    toast('Не получилось собрать файл Excel. Попробуйте ещё раз', {error: true});
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = btn.dataset.label; }
  }
}
