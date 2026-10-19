/* Сценарии — «тренажёр» финансов. Входящие данные живые: журнал, план
   платежей, продажи, подписки, ставки — всё как в штабе прямо сейчас.
   Сценарий хранит только то, чем отличается от штаба (налог, рефералка,
   продажи, расходы), и считается поверх живых данных через Sandbox.run:
   на время расчёта его настройки ложатся поверх настоящих, потом снимаются.
   Ничего из сценария не записывается в другие разделы и ни на что не влияет.
   Прошедшие месяцы — факт, сценарий меняет текущий и будущие. */

const SC_TAX_MODES = {live: 'Как в штабе', income: 'С доходов', profit: 'Доходы минус расходы'};
/* готовые режимы; условия режима (лимиты, число сотрудников) — проверить с бухгалтером */
const SC_PRESETS = {
  usn6:   {name: 'УСН 6%',             p: {taxMode: 'income', tax: 6, taxMin: null, insurance: null}},
  usn15:  {name: 'УСН 15% (Д−Р)',      p: {taxMode: 'profit', tax: 15, taxMin: 1, insurance: null}},
  ausn8:  {name: 'АУСН 8%',            p: {taxMode: 'income', tax: 8, taxMin: null, insurance: 0}},
  ausn20: {name: 'АУСН 20% (Д−Р)',     p: {taxMode: 'profit', tax: 20, taxMin: 3, insurance: 0}},
};
const SC_PREP = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];
const scNum = v => (isSet(v) ? Number(v) : null);
const scPc = v => (isSet(v) ? Number(v) / 100 : null);
const scFlat = r => [{from: '', label: '', steps: [{upTo: null, rate: clamp(r, 0, 1)}]}];

/* настройки сценария поверх живых: то, что не задано, остаётся как в штабе */
function scSandbox(p, live) {
  const st = {rates: {}};
  if (isSet(p.price)) st.price = Math.max(0, scNum(p.price));
  if (isSet(p.retention)) st.retention = clamp(scPc(p.retention), 0, 1);
  const mode = p.taxMode || 'live';
  if (mode === 'income' && isSet(p.tax)) st.rates.tax = scFlat(scPc(p.tax));
  if (mode === 'profit') st.rates.tax = scFlat(0);
  ['vat', 'acquiring', 'insurance'].forEach(k => { if (isSet(p[k])) st.rates[k] = scFlat(scPc(p[k])); });
  /* продажи: план выбранного сценария квартала × процент, отдельные месяцы — своими цифрами */
  const base = SCENARIOS[p.base] ? p.base : live.scenario;
  const k = isSet(p.salesK) ? Math.max(0, scNum(p.salesK)) / 100 : 1, own = p.sales || {};
  st.plans = {[base]: Object.fromEntries(Q.months.map(m => [m, isSet(own[m]) ? Math.max(0, scNum(own[m])) : scenarioSales(base)[m] * k]))};
  const inv = p.invest || {};
  if (Q.months.some(m => isSet(inv[m]))) st.invest = Object.fromEntries(Q.months.map(m => [m, isSet(inv[m]) ? scNum(inv[m]) : Number((live.invest || {})[m]) || 0]));
  const kPay = isSet(p.payrollK) ? 1 + scNum(p.payrollK) / 100 : 1, kOther = isSet(p.otherK) ? 1 + scNum(p.otherK) / 100 : 1;
  /* рефералка: доля продаж через рефералов, процент с первой оплаты и с продлений N месяцев */
  const refSet = ['refShare', 'refFirst', 'refRenew', 'refMonths'].some(x => isSet(p[x]));
  const share = isSet(p.refShare) ? clamp(scPc(p.refShare), 0, 1) : 1;
  const first = isSet(p.refFirst) ? scPc(p.refFirst) : live.referral;
  const renew = scPc(p.refRenew) || 0, months = Math.max(0, Math.round(scNum(p.refMonths) || 0));
  return {
    base,
    settings: st,
    costK: cat => (cat === 'payroll' ? kPay : VAR_CATS.includes(cat) ? 1 : kOther),
    extra: Math.max(0, scNum(p.extra) || 0),
    referral: refSet ? (hist, s) => {
      const i = hist.length - 1;
      let r = hist[i] * share * first;
      for (let j = Math.max(0, i - months); j < i; j++) r += hist[j] * share * renew * Math.pow(s.retention, i - j);
      return r;
    } : null,
    taxProfit: mode === 'profit' ? {rate: isSet(p.tax) ? scPc(p.tax) : 0.15, min: isSet(p.taxMin) ? scPc(p.taxMin) : 0.01} : null,
  };
}
const Sandbox = {
  run(p, fn) {
    if (SANDBOX) throw new Error('сценарий внутри сценария');
    SANDBOX = scSandbox(p || {}, settings());
    try { return fn(SANDBOX.base); } finally { SANDBOX = null; }
  },
};
/* итоги сценария до 31 декабря; p = null — живой план штаба */
function scResult(p) {
  const rows = p ? Sandbox.run(p, base => cashFlow(base)) : cashFlow(settings().scenario);
  const out = {};
  rows.forEach(r => Object.entries(r.out).forEach(([c, v]) => { out[c] = (out[c] || 0) + v; }));
  const revenue = sum(rows, r => r.revNew + r.revRenew), inTotal = sum(rows, r => r.inTotal), outTotal = sum(rows, r => r.outTotal);
  const last = rows[rows.length - 1], minRow = rows.reduce((a, r) => (r.close < a.close ? r : a), rows[0]);
  const neg = rows.find(r => r.close < 0);
  return {rows, out, revenue, inTotal, outTotal, invest: sum(rows, r => r.invest), profit: inTotal - outTotal,
    margin: inTotal ? (inTotal - outTotal) / inTotal : null, taxes: (out.tax || 0) + (out.vat || 0),
    cashEnd: last.close, minClose: minRow.close, minMonth: minRow.m, negMonth: neg ? neg.m : null,
    sales: sum(rows.filter(r => r.status !== 'fact'), r => r.fresh), last};
}

/* выводы и рекомендации — по готовым правилам, без ИИ */
function scAdvice(p, r, plan) {
  const tips = [], add = (tone, text) => tips.push({tone, text});
  const s = settings();
  if (r.negMonth) add('bad', `Деньги закончатся в ${SC_PREP[monthIdx(r.negMonth)]}: на минимуме не хватит ${money(-r.minClose)}. Нужны вложения к этому месяцу или меньше расходов.`);
  else add('good', `Денег хватает до 31 декабря: минимум на счёте ${money(r.minClose)} (${monthName(r.minMonth).toLowerCase()}).`);
  const dp = r.profit - plan.profit;
  if (Math.abs(dp) >= 1) add(dp > 0 ? 'good' : 'warn', `Прибыль до 31 декабря ${dp > 0 ? 'выше' : 'ниже'} плана штаба на ${money(Math.abs(dp))}.`);
  if (r.margin !== null) {
    if (r.margin < 0) add('bad', `Убыточно: с каждых 100,00 ₽ прихода уходит в минус ${money(-r.margin * 100)}. Рентабельность ${pct(r.margin, 1)}.`);
    else add(r.margin < 0.15 ? 'warn' : 'good', `Рентабельность ${pct(r.margin, 1)}${r.margin < 0.15 ? ': запас прочности небольшой, любой рост расходов съест прибыль' : ''}.`);
  }
  /* куда уходят деньги */
  const cats = Object.entries(r.out).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (cats.length && r.inTotal) add('line', `Больше всего уходит на «${OUT_CATS[cats[0][0]] || cats[0][0]}»: ${money(cats[0][1])}, это ${pct(cats[0][1] / r.inTotal)} прихода.`);
  const ref = r.out.referral || 0;
  if (r.revenue && ref / r.revenue > 0.2) add('warn', `Рефералам уходит ${pct(ref / r.revenue)} выручки подписок (${money(ref)}). Попробуйте меньший процент с продлений или ограничить срок выплат.`);
  /* налоговый режим: что дешевле при этих же цифрах */
  if (r.revenue > 0) {
    const cur = r.cashEnd;
    const alt = Object.entries(SC_PRESETS).map(([k, x]) => ({k, name: x.name, cash: scResult({...p, ...x.p}).cashEnd}))
      .sort((a, b) => b.cash - a.cash);
    const best = alt[0];
    if (best && best.cash - cur > Math.max(100, r.revenue * 0.005)) add('violet', `При этих цифрах выгоднее всего режим «${best.name}»: к 31 декабря останется на ${money(best.cash - cur)} больше. Условия режима (лимиты выручки, число сотрудников) проверьте с бухгалтером.`);
    const staff = people().filter(x => x.name && pStatus(x) === 'active').length;
    if ((p.insurance === 0 || p.insurance === '0') && staff > 5) add('warn', `На АУСН можно не больше 5 сотрудников, а в команде сейчас ${staff}.`);
  }
  /* рычаги: что сильнее всего меняет деньги на 31 декабря */
  const lever = (name, q) => ({name, d: scResult({...p, ...q}).cashEnd - r.cashEnd});
  const k = isSet(p.salesK) ? scNum(p.salesK) : 100;
  const levers = [
    lever('+10% продаж', {salesK: k * 1.1}),
    lever('+5 п. удержания', {retention: Math.min(100, (isSet(p.retention) ? scNum(p.retention) : s.retention * 100) + 5)}),
    lever('+10% к цене подписки', {price: (isSet(p.price) ? scNum(p.price) : s.price) * 1.1}),
    lever('−10% расходов на команду и прочее', {payrollK: (scNum(p.payrollK) || 0) - 10, otherK: (scNum(p.otherK) || 0) - 10}),
  ].sort((a, b) => b.d - a.d);
  add('line', `Что сильнее всего добавит денег к 31 декабря: ${levers.map(x => `${x.name}: ${signedMoney(x.d)}`).join('; ')}.`);
  /* точка безубыточности декабря: во сколько раз нужно больше продаж */
  const decNet = x => scResult({...p, salesK: x}).last.net;
  if (r.last.net < 0) {
    let lo = k, hi = Math.max(k * 2, 200), ok = decNet(hi) >= 0;
    for (let i = 0; i < 6 && !ok; i++) { hi *= 2; ok = decNet(hi) >= 0; }
    if (ok) {
      for (let i = 0; i < 20; i++) { const mid = (lo + hi) / 2; if (decNet(mid) >= 0) hi = mid; else lo = mid; }
      const m = Q.months[Q.months.length - 1], base = scSandbox(p, s).base;
      add('violet', `Чтобы декабрь вышел в плюс, нужно около ${fmt(Math.ceil(scenarioSales(base)[m] * hi / 100))} продаж в декабре (в сценарии ${fmt(Math.round(scSandbox(p, s).settings.plans[base][m]))}).`);
    }
  }
  return tips;
}

/* ── страница ── */
let scDraft = null;   // открытый сценарий: {id, name, note, p}; id = null — новый, ещё не сохранён
const scList = () => Store.all('scenarios').sort((a, b) => (a.at || 0) - (b.at || 0));
function scOpen(id) {
  const x = id ? Store.get('scenarios', id) : null;
  scDraft = x ? {id: x.id, name: x.name || '', note: x.note || '', p: clone(x.p || {})} : {id: null, name: '', note: '', p: {}};
  View.set('sc.open', x ? x.id : null);
}
App.register('scenarios', {
  title: 'Сценарии',
  render(root) {
    if (!Auth.can('money.view')) { root.innerHTML = pageHead('Сценарии', '') + noAccess(); return; }
    const edit = Auth.can('money.edit'), list = scList();
    if (!scDraft || (scDraft.id && !Store.get('scenarios', scDraft.id))) scOpen(View.get('sc.open', null) && Store.get('scenarios', View.get('sc.open', null)) ? View.get('sc.open', null) : null);
    const cmp = View.get('sc.cmp', null) || list.slice(0, 4).map(x => x.id);
    root.innerHTML = `
      ${pageHead('Сценарии', 'Тренажёр финансов: цифры штаба настоящие, а налоги, рефералку, продажи и расходы можно менять. На штаб это не влияет.')}
      ${helpBox('scenarios', `<b>Как пользоваться сценариями.</b> Всё, что не меняете, берётся из штаба прямо сейчас: деньги на счёте, журнал, план платежей, продажи и подписки. Пустое поле значит «как в штабе», серым показано текущее значение. Прошедшие месяцы — факт, сценарий меняет текущий и будущие месяцы. ${edit ? 'Сохраните сценарий, чтобы сравнить его с другими и вернуться к нему позже.' : 'Менять цифры и смотреть результат можно, сохраняют сценарии основатель, руководители и финансы.'}`)}
      <section class="section">
        <div class="section-head"><h2>Сравнение до 31 декабря</h2><span class="hint-inline">Отметьте до 4 сценариев. «План штаба» — живой прогноз по сценарию продаж «${SCENARIOS[settings().scenario].name}».</span></div>
        ${scCompareHtml(list, cmp)}
      </section>
      <section class="section card sc-ed">
        <div class="card-head"><h2>${scDraft.id ? esc(scDraft.name || 'Без названия') : 'Новый сценарий'}</h2>
          <span class="row">${list.length ? `<select class="select sm" id="scPick" aria-label="Открыть сценарий"><option value="">+ новый сценарий</option>${list.map(x => `<option value="${x.id}" ${x.id === scDraft.id ? 'selected' : ''}>${esc(x.name || 'Без названия')}</option>`).join('')}</select>` : ''}</span></div>
        <div class="sc-grid"><div class="sc-form" id="scForm">${scFormHtml(scDraft, edit)}</div><div class="sc-out" id="scOut">${scOutHtml(scDraft.p)}</div></div>
      </section>`;
    wireHelp(root);
    const form = $('#scForm', root);
    let t = null;
    /* набранное сразу в черновик (страница может перерисоваться сама), пересчёт — с паузой */
    const recalc = () => { scRead(form); clearTimeout(t); t = setTimeout(() => { const o = $('#scOut', root); if (o) o.innerHTML = scOutHtml(scDraft.p); }, 250); };
    form.addEventListener('input', recalc);
    form.addEventListener('change', recalc);
    /* от режима налога и плана за основу зависят сами поля — перерисовать форму */
    on(form, 'change', '[data-sp="taxMode"], [data-sp="base"]', () => App.render());
    const pick = $('#scPick', root);
    if (pick) pick.onchange = () => { scOpen(pick.value || null); App.render(); };
    on(root, 'change', '[data-sc-cmp]', () => { View.set('sc.cmp', $$('[data-sc-cmp]', root).filter(i => i.checked).map(i => i.dataset.scCmp).slice(0, 4)); App.render(); });
    on(root, 'click', '[data-sc-open]', (e, el) => { scOpen(el.dataset.scOpen); App.render(); $('.sc-ed', root) && $('.sc-ed', root).scrollIntoView({behavior: 'smooth'}); });
    on(form, 'click', '[data-preset]', (e, el) => { scRead(form); Object.assign(scDraft.p, SC_PRESETS[el.dataset.preset].p); App.render(); });
    on(form, 'click', '[data-sc-reset]', () => { scDraft.p = {}; App.render(); });
    if (!edit) return;
    on(form, 'click', '#scSave', () => {
      scRead(form);
      const name = scDraft.name.trim();
      if (!name) { $('#scName', form).focus(); toast('Назовите сценарий'); return; }
      const data = {name, note: scDraft.note.trim(), p: clone(scDraft.p), by: Tasks.meKey(), upd: Date.now()};
      if (scDraft.id) Store.patch('scenarios', scDraft.id, data);
      else {
        const id = Store.add('scenarios', {...data, at: Date.now()});
        scDraft.id = id;
        View.set('sc.open', id);
        const c = View.get('sc.cmp', null);
        if (c && c.length < 4) View.set('sc.cmp', [...c, id]);
      }
      toast(`Сценарий «${name}» сохранён`);
    });
    on(form, 'click', '#scCopy', () => { scRead(form); scDraft = {id: null, name: scDraft.name + ' (копия)', note: scDraft.note, p: clone(scDraft.p)}; View.set('sc.open', null); App.render(); });
    on(form, 'click', '#scDel', async (e, el) => {
      if (!(await confirmPop(el, {text: 'Удалить сценарий? На штаб это не повлияет.', yes: 'Удалить', danger: true}))) return;
      Store.remove('scenarios', scDraft.id);
      scOpen(null);
     
      App.render();
    });
  },
});

/* поля формы → черновик; пустое поле — «как в штабе» */
function scRead(form) {
  const p = {};
  $$('[data-sp]', form).forEach(i => {
    const v = i.value.trim(), [k, sub] = i.dataset.sp.split('.');
    if (v === '') return;
    const val = i.tagName === 'SELECT' ? v : parseNum(v);
    if (sub) (p[k] = p[k] || {})[sub] = val; else p[k] = val;
  });
  if (p.taxMode === 'live') delete p.taxMode;
  scDraft.p = p;
  scDraft.name = $('#scName', form).value;
  scDraft.note = $('#scNote', form).value;
}
function scFormHtml(d, edit) {
  const s = settings(), p = d.p, m0 = monthOf(today());
  const val = k => (isSet(p[k]) ? esc(p[k]) : '');
  const f = (k, label, ph, hint = '') => `<label class="field"><span>${label}</span><input class="input num" data-sp="${k}" inputmode="decimal" value="${val(k)}" placeholder="${esc(ph)}">${hint ? `<small>${hint}</small>` : ''}</label>`;
  const rate = key => pctA(rateAt(key, m0, 0, s));
  const base = SCENARIOS[p.base] ? p.base : s.scenario;
  const months = Q.months.filter(m => m >= m0);
  return `<div class="grid2">
      <label class="field"><span>Название</span><input class="input" id="scName" value="${esc(d.name)}" maxlength="80" placeholder="Например: УСН 6% и рефералка 20%"></label>
      <label class="field"><span>Описание</span><input class="input" id="scNote" value="${esc(d.note)}" maxlength="200" placeholder="Что проверяем"></label>
    </div>
    <h3 class="sc-h">Продажи</h3>
    <div class="grid3">
      <label class="field"><span>План продаж за основу</span><select class="select" data-sp="base">${Object.entries(SCENARIOS).map(([k, x]) => `<option value="${k}" ${k === base ? 'selected' : ''}>${x.name}</option>`).join('')}</select></label>
      ${f('salesK', 'Продажи от плана, %', '100', 'например, 80 — на 20% меньше')}
      ${f('price', 'Подписка в месяц, ₽', fmt(s.price))}
      ${f('retention', 'Продлевают, %', fmt(s.retention * 100), 'доля подписчиков, которые платят снова')}
      ${months.map(m => f('sales.' + m, `Продаж за ${monthName(m).toLowerCase()}`, fmt(Math.round(scenarioSales(base)[m] * (isSet(p.salesK) ? scNum(p.salesK) / 100 : 1))))).join('')}
    </div>
    <h3 class="sc-h">Налоги и сборы</h3>
    <div class="chips sc-presets">${Object.entries(SC_PRESETS).map(([k, x]) => `<button type="button" class="chip" data-preset="${k}">${x.name}</button>`).join('')}</div>
    <div class="grid3">
      <label class="field"><span>Налог</span><select class="select" data-sp="taxMode">${Object.entries(SC_TAX_MODES).map(([k, n]) => `<option value="${k}" ${(p.taxMode || 'live') === k ? 'selected' : ''}>${n}</option>`).join('')}</select><small>в штабе: ${esc(rateText('tax', m0))}</small></label>
      ${f('tax', 'Ставка налога, %', p.taxMode === 'profit' ? '15' : fmt(rateAt('tax', m0, 0, s) * 100, 1))}
      ${p.taxMode === 'profit' ? f('taxMin', 'Минимальный налог, % выручки', '1', 'если с разницы выходит меньше') : ''}
      ${f('insurance', 'Взносы с зарплаты, %', rate('insurance'), 'на АУСН — 0')}
      ${f('vat', 'НДС, %', rate('vat'))}
      ${f('acquiring', 'Эквайринг, %', rate('acquiring'))}
    </div>
    <h3 class="sc-h">Рефералы</h3>
    <div class="grid2">
      ${f('refShare', 'Продаж через рефералов, %', '100')}
      ${f('refFirst', 'С первой оплаты, %', pctA(s.referral))}
      ${f('refRenew', 'С продлений, %', '0', 'например, 10% со следующих оплат')}
      ${f('refMonths', 'Сколько месяцев платим с продлений', '0')}
    </div>
    <h3 class="sc-h">Расходы и вложения</h3>
    <div class="grid3">
      ${f('payrollK', 'Оплата труда, ± %', '0', 'например, −20 или 15')}
      ${f('otherK', 'Остальные расходы, ± %', '0', 'офис, сервисы, маркетинг и прочее')}
      ${f('extra', 'Свой расход в месяц, ₽', '0', 'новая статья с этого месяца')}
      ${months.map(m => f('invest.' + m, `Вложения в ${monthName(m).toLowerCase()}, ₽`, fmt(Number((s.invest || {})[m]) || 0))).join('')}
    </div>
    <div class="row sc-act">
      ${edit ? `<button type="button" class="btn primary" id="scSave">${icon('tick')}Сохранить</button>` : ''}
      ${edit && d.id ? `<button type="button" class="btn" id="scCopy">${icon('copy')}Копия</button>` : ''}
      <button type="button" class="btn ghost" data-sc-reset>Всё как в штабе</button>
      ${edit && d.id ? `<button type="button" class="btn danger" id="scDel">${icon('trash')}Удалить</button>` : ''}
    </div>`;
}
/* результат открытого сценария: итоги против плана, выводы, месяцы */
function scOutHtml(p) {
  const plan = scResult(null), r = scResult(p);
  const line = (label, a, b, good = 1) => {
    const d = a - b, tone = Math.abs(d) < 0.005 ? '' : d * good > 0 ? 'good' : 'bad';
    return `<tr><td>${label}</td><td class="r nowrap"><b>${money(a)}</b></td><td class="r nowrap ${tone}">${Math.abs(d) < 0.005 ? '—' : signedMoney(d)}</td></tr>`;
  };
  const tips = scAdvice(p, r, plan);
  return `<div class="table-wrap"><table class="t sc-sum">
      <thead><tr><th>До 31 декабря</th><th class="r">Сценарий</th><th class="r">К плану штаба</th></tr></thead>
      <tbody>
        ${line('Выручка подписок', r.revenue, plan.revenue)}
        ${line('Весь приход', r.inTotal, plan.inTotal)}
        ${line('Расходы', r.outTotal, plan.outTotal, -1)}
        ${line('из них налоги и НДС', r.taxes, plan.taxes, -1)}
        ${line('из них рефералам', r.out.referral || 0, plan.out.referral || 0, -1)}
        ${line('из них оплата труда с взносами', r.out.payroll || 0, plan.out.payroll || 0, -1)}
        ${line('Прибыль', r.profit, plan.profit)}
        <tr><td>Рентабельность</td><td class="r"><b>${r.margin === null ? '—' : pct(r.margin, 1)}</b></td><td class="r">${plan.margin === null ? '' : `план ${pct(plan.margin, 1)}`}</td></tr>
        ${line('Деньги на 31 декабря', r.cashEnd, plan.cashEnd)}
        ${line('Минимум на счёте', r.minClose, plan.minClose)}
      </tbody></table></div>
    <div class="sc-tips"><h3 class="sc-h">Выводы и рекомендации</h3>${tips.map(x => `<p class="sc-tip ${x.tone}">${esc(x.text)}</p>`).join('')}
      <p class="note">Выводы штаб делает сам по готовым правилам. Это подсказки, а не советы бухгалтера.</p></div>
    <h3 class="sc-h">По месяцам</h3>
    <div class="table-wrap"><table class="t sc-months">
      <thead><tr><th></th>${r.rows.map(x => `<th class="r">${monthName(x.m)}<small>${STATUS_TAG[x.status]}</small></th>`).join('')}</tr></thead>
      <tbody>
        <tr><td>Приход</td>${r.rows.map(x => `<td class="r nowrap">${money(x.inTotal)}</td>`).join('')}</tr>
        <tr><td>Вложения</td>${r.rows.map(x => `<td class="r nowrap">${money(x.invest)}</td>`).join('')}</tr>
        <tr><td>Расходы</td>${r.rows.map(x => `<td class="r nowrap">${money(x.outTotal)}</td>`).join('')}</tr>
        <tr><td>Налоги и НДС</td>${r.rows.map(x => `<td class="r nowrap">${money((x.out.tax || 0) + (x.out.vat || 0))}</td>`).join('')}</tr>
        <tr><td>Рефералам</td>${r.rows.map(x => `<td class="r nowrap">${money(x.out.referral || 0)}</td>`).join('')}</tr>
        <tr class="total"><td>На счёте в конце</td>${r.rows.map(x => `<td class="r nowrap ${x.close < 0 ? 'bad' : ''}"><b>${money(x.close)}</b></td>`).join('')}</tr>
      </tbody></table></div>`;
}
/* сравнение сохранённых сценариев с планом штаба */
function scCompareHtml(list, cmp) {
  const plan = scResult(null);
  const cols = [{id: null, name: 'План штаба', r: plan}, ...list.filter(x => cmp.includes(x.id)).map(x => ({id: x.id, name: x.name || 'Без названия', note: x.note, r: scResult(x.p || {})}))];
  const rowM = (label, get, good = 1) => `<tr><td>${label}</td>${cols.map((c, i) => {
    const v = get(c.r), d = v - get(plan);
    return `<td class="r nowrap"><b>${money(v)}</b>${i && Math.abs(d) >= 0.005 ? `<small class="${d * good > 0 ? 'good' : 'bad'}">${signedMoney(d)}</small>` : ''}</td>`;
  }).join('')}</tr>`;
  return `${list.length ? `<div class="sc-pick">${list.map(x => `<label class="check"><input type="checkbox" data-sc-cmp="${x.id}" ${cmp.includes(x.id) ? 'checked' : ''}> ${esc(x.name || 'Без названия')}</label>`).join('')}</div>` : '<p class="note">Сохранённых сценариев пока нет — соберите первый ниже.</p>'}
    <div class="table-wrap"><table class="t sc-cmp">
      <thead><tr><th></th>${cols.map(c => `<th class="r">${c.id ? `<button class="link-btn" data-sc-open="${c.id}" title="${esc(c.note || 'Открыть')}">${esc(c.name)}</button>` : c.name}</th>`).join('')}</tr></thead>
      <tbody>
        ${rowM('Выручка подписок', r => r.revenue)}
        ${rowM('Расходы', r => r.outTotal, -1)}
        ${rowM('Налоги и НДС', r => r.taxes, -1)}
        ${rowM('Рефералам', r => r.out.referral || 0, -1)}
        ${rowM('Прибыль', r => r.profit)}
        <tr><td>Рентабельность</td>${cols.map(c => `<td class="r">${c.r.margin === null ? '—' : pct(c.r.margin, 1)}</td>`).join('')}</tr>
        ${rowM('Деньги на 31 декабря', r => r.cashEnd)}
        <tr><td>Когда деньги кончатся</td>${cols.map(c => `<td class="r ${c.r.negMonth ? 'bad' : 'good'}">${c.r.negMonth ? monthName(c.r.negMonth) : 'хватает'}</td>`).join('')}</tr>
      </tbody></table></div>`;
}
