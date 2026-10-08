/* Финансы — разделы вкладки: обзор, подписки и рефералы, курсы и авторы,
   маркетплейс (заказы, товары, распределение), сбои оплат, возвраты.
   Записи с данными клиентов (сбои, возвраты, заказы) видят роли с правом
   fin.ops; инвестор видит только сводные цифры. */

const finOps = () => Auth.can('fin.ops');
const finTile = (label, big, foot = '', cls = '') => `<div class="card stat ${cls}"><span class="label">${label}</span><div class="big">${big}</div>${foot ? `<div class="foot">${foot}</div>` : ''}</div>`;
const finPill = (st, map) => `<span class="pill ${(map[st] || {}).tone || ''}">${esc((map[st] || {}).name || st || '—')}</span>`;
const finSeg = (key, items, cur) => `<div class="seg">${items.map(([k, n]) => `<button type="button" data-fseg="${key}:${k}" class="${k === cur ? 'on' : ''}">${n}</button>`).join('')}</div>`;
const finCsvBtn = k => `<button type="button" class="btn xs ghost" data-fin-csv="${k}">${icon('download')}CSV</button>`;
const pctOr = (x, d = 0) => (x === null || x === undefined ? '—' : pct(x, d));
/* контакт клиента: почта, телефон или телеграм — ссылкой */
function contactHtml(c) {
  const v = String(c || '').trim();
  if (!v) return '';
  if (EMAIL_RE.test(v)) return `<a href="mailto:${esc(v)}">${esc(v)}</a>`;
  if (/^\+?[\d\s()-]{7,}$/.test(v)) return `<a href="tel:${esc(v.replace(/[^\d+]/g, ''))}">${esc(v)}</a>`;
  const tg = normTg(v);
  return tg ? `<a href="${esc(tgUrl(tg))}" target="_blank" rel="noopener">${esc(tgShow(tg))}</a>` : esc(v);
}
const finPeople = () => people().filter(p => p.name && pStatus(p) === 'active');
const whoSel = (id, cur) => `<select class="select" id="${id}"><option value="">—</option>${finPeople().map(p => `<option value="${p.id}" ${p.id === cur ? 'selected' : ''}>${esc(personName(p))}</option>`).join('')}</select>`;
const finLog = text => ({[uid()]: {at: Date.now(), by: Tasks.meKey(), text}});
const logHtml = d => {
  const list = Object.values(d && d.log || {}).sort((a, b) => b.at - a.at).slice(0, 6);
  return list.length ? `<div class="fin-log"><span class="label">История</span>${list.map(x => `<div><small>${timeAgo(x.at)} · ${esc(whoFirst(x.by))}</small> ${esc(x.text)}</div>`).join('')}</div>` : '';
};
const monthOpts = (cur, months = finMonths()) => months.map(m => `<option value="${m}" ${m === cur ? 'selected' : ''}>${monthName(m, true)}</option>`).join('');

/* ── обзор ── */
function finOverviewHtml(sc) {
  const s = settings(), t = today(), m = monthOf(t);
  const cash = Money.cashNow();
  const cf = cashFlow(sc), last = cf[cf.length - 1], minClose = Math.min(...cf.map(r => r.close));
  const f = Sales.month(m), led = Money.month(m);
  const inCourses = led.cats.in.courses || 0, inMarket = led.cats.in.market || 0;
  const income = f.revenue + led.in, net = income - led.out;
  const sub = Subs.now(), rate = Subs.rate();
  const tiles = [
    finTile('Баланс на сегодня', rubK(cash), `старт ${rubK(s.cashStart)} на ${dayLong(s.cashDate)} + операции и выручка`, 'cash-card'),
    finTile(`Итог ${MONTHS_GEN[monthIdx(m)]}`, `<span class="${net < 0 ? 'bad' : 'good'}">${signed(net)}</span>`, `приход ${rubK(income)} · расход ${rubK(led.out)}`),
    finTile('Прогноз на 31 декабря', `<span class="${last.close < 0 ? 'bad' : ''}">${rubK(last.close)}</span>`, minClose < 0 ? `<span class="bad">в минус уйдём в ${monthName(cf.find(r => r.close < 0).m).toLowerCase()} — нужны вложения</span>` : `сценарий «${SCENARIOS[sc].name}» и план платежей`),
    finTile('Платных подписчиков', fmt(sub.total), `месячных ${fmt(sub.endM)} · годовых ${fmt(sub.endY)}`),
    finTile('MRR', rubK(sub.mrr), `месячная выручка подписок: ${rub(s.price)} и ${rub(priceYear())}/12`),
    finTile('Продления', pctOr(rate && rate.renew), rate ? `${monthName(rate.m).toLowerCase()} · отток ${pctOr(rate.churn)}` : 'появятся после первого месяца'),
    finTile('Возвраты', pctOr(rate && rate.refund, 1), `от оплат · за ${monthName(m).toLowerCase()} ${fmt(sub.refunds)} на ${rubK(sub.refundSum)}`),
    finTile('Средний чек', sub.check ? rub(Math.round(sub.check)) : '—', `${fmt(sub.pays)} ${plural(sub.pays, 'оплата', 'оплаты', 'оплат')} подписки за ${monthName(m).toLowerCase()}`),
  ];
  /* приход и расход месяца: одна шкала на обе стороны */
  const ins = [['Подписки', f.revenue], ['Курсы', inCourses], ['Маркетплейс', inMarket], ['Прочие приходы', led.in - inCourses - inMarket]].filter(x => x[1] > 0);
  const outs = Object.entries(led.cats.out).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([c, v]) => [OUT_CATS[c] || c, v]);
  const outTop = outs.length > 6 ? [...outs.slice(0, 5), ['Остальное', sum(outs.slice(5), x => x[1])]] : outs;
  const max = Math.max(1, ...ins.map(x => x[1]), ...outTop.map(x => x[1]));
  const bar = (tone) => ([name, v]) => `<div class="fin-bar" title="${esc(name)}: ${rub(v)}"><span class="fb-l">${esc(name)}</span><span class="fb-t"><i class="${tone}" style="width:${Math.max(1.5, v / max * 100).toFixed(1)}%"></i></span><b>${rubK(v)}</b></div>`;
  const flow = `<div class="card fin-flow"><div class="card-head"><h2>Приход и расход — ${monthName(m).toLowerCase()}</h2><button class="link-btn" data-fin-go="ops">Журнал</button></div>
    <div class="fb-group"><span class="label">Приход <b class="good">+${rub(income)}</b></span>${ins.length ? ins.map(bar('in')).join('') : '<p class="note">Прихода пока нет</p>'}</div>
    <div class="fb-group"><span class="label">Расход <b class="bad">${led.out ? '−' : ''}${rub(led.out)}</b></span>${outTop.length ? outTop.map(bar('out')).join('') : '<p class="note">Расходов пока нет</p>'}</div></div>`;
  /* что требует действий */
  let att = '';
  if (finOps()) {
    const a = Fin.attention();
    const planUnpaid = Money.planItems().filter(it => Money.planAmount(it, m) && !Money.paid(it, m));
    const rows = [
      a.refunds.length ? ['refunds', 'bad', `Запросы на возврат: ${a.refunds.length}`, a.late.length ? `<b class="bad">${a.late.length} ${plural(a.late.length, 'просрочен', 'просрочено', 'просрочено')}</b> · ответить за ${REFUND_DAYS} дней` : `ответить за ${REFUND_DAYS} дней с запроса`] : null,
      a.failed.length ? ['failed', 'warn', `Сбои оплат: ${a.failed.length} на ${rub(a.failedSum)}`, a.failedDue.length ? `сегодня нужно действие по ${a.failedDue.length}` : 'ждём ответа клиентов'] : null,
      a.payouts.total ? ['payouts', 'violet', `К выплате: ${rub(a.payouts.total)}`, [a.payouts.ref ? `рефералам ${rubK(a.payouts.ref)}` : '', a.payouts.author ? `авторам ${rubK(a.payouts.author)}` : '', a.payouts.seller ? `продавцам ${rubK(a.payouts.seller)}` : ''].filter(Boolean).join(' · ')] : null,
      a.ship.length ? ['market', 'gold', `Заказы к отправке: ${a.ship.length}`, 'оплачены, ещё не отправлены'] : null,
      a.low.length ? ['market', 'line', `Мало на складе: ${a.low.length}`, a.low.slice(0, 3).map(p => `${esc(p.title)} — ${fmt(Number(p.stock) || 0)}`).join(', ')] : null,
      planUnpaid.length ? ['plan', 'line', `Платежи ${MONTHS_GEN[monthIdx(m)]} по плану: ${planUnpaid.length}`, `осталось оплатить ${rub(sum(planUnpaid, it => Money.planAmount(it, m)))}`] : null,
    ].filter(Boolean);
    att = `<div class="card fin-att"><div class="card-head"><h2>Нужно внимание</h2></div>
      ${rows.length ? `<div class="focus-list">${rows.map(([tab, tone, text, sub]) => `<button class="focus-row" data-fin-go="${tab === 'payouts' ? (a.payouts.ref ? 'subs' : a.payouts.author ? 'courses' : 'market') : tab}"><span class="fr-t"><span class="pill ${tone}">${text}</span><small>${sub}</small></span>${icon('arrow')}</button>`).join('')}</div>`
        : '<p class="note">Всё под контролем: открытых возвратов и сбоев нет, выплаты сделаны.</p>'}</div>`;
  }
  /* план платежей месяца */
  const planAll = sum(Money.planItems(), it => Money.planAmount(it, m)), planPaid = sum(Money.planItems(), it => (Money.paid(it, m) ? Money.planAmount(it, m) : 0));
  const recent = Money.ledger().slice(0, 6);
  return `<div class="cards tiles fin-kpi">${tiles.join('')}</div>
    <div class="split section">${flow}${att || `<div class="card"><div class="card-head"><h2>Подписки</h2></div><p class="note">${fmt(sub.total)} платных: месячных ${fmt(sub.endM)}, годовых ${fmt(sub.endY)}. Продления — ${pctOr(rate && rate.renew)}.</p></div>`}</div>
    <section class="section"><div class="section-head"><h2>Приход и расход по месяцам</h2><span class="hint-inline">Факт против плана; будущие месяцы — план по сценарию «${SCENARIOS[sc].name}» и плану платежей</span></div>
      <div class="money-top">${pnl(sc).map(monthCardHtml).join('')}</div>
      ${planAll ? `<div class="fin-planline"><span>План платежей ${MONTHS_GEN[monthIdx(m)]}: оплачено <b>${rub(planPaid)}</b> из ${rub(planAll)}</span>${progress(planPaid / planAll, 'good')}<button class="link-btn" data-fin-go="plan">План и прогноз</button></div>` : ''}
    </section>
    ${unitHtml()}
    <section class="section card"><div class="card-head"><h2>Последние операции</h2><button class="link-btn" data-fin-go="ops">Весь журнал</button></div>
      ${recent.length ? `<div class="fin-recent">${recent.map(e => `<div class="fr-op"><span class="soft">${dayShort(e.date)}</span><span>${esc(e.note || catName(e.kind, e.cat))}<small>${esc(catName(e.kind, e.cat))}</small></span><b class="${e.kind === 'out' ? 'bad' : 'good'}">${e.kind === 'out' ? '−' : '+'}${rub(e.amount)}</b></div>`).join('')}</div>` : '<p class="note">Операций пока нет.</p>'}</section>`;
}
function monthCardHtml(r) {
  const st = monthStatus(r.m);
  const f = st === 'plan' ? r.plan : r.fact;
  return `<div class="card month-card ${st}"><div class="mc-h"><b>${monthName(r.m)}</b><span class="pill ${st === 'now' ? 'rose' : ''}">${STATUS_TAG[st]}</span></div>
    <div class="mc-row"><span>Доходы</span><b class="good">${rubK(f.income)}</b></div>
    <div class="mc-row"><span>Расходы</span><b class="bad">${rubK(f.outTotal)}</b></div>
    <div class="mc-row total"><span>Итог</span><b class="${f.profit < 0 ? 'bad' : 'good'}">${signed(f.profit)}</b></div>
    ${st !== 'plan' ? `<div class="note">план: ${signed(r.plan.profit)}</div>` : '<div class="note">по плану платежей и сценарию</div>'}</div>`;
}
/* чек и юнит-экономика */
function unitHtml() {
  const t = today(), per = View.get('fin.ue', 'quarter');
  const from = per === 'month' ? monthStart(monthOf(t)) : (t < Q.start ? monthStart(CF_MONTHS[0]) : Q.start);
  const u = unitEcon(from, t);
  const s = settings();
  const orders = Store.all('orders').filter(o => o.pay === 'paid' && (o.paidAt || o.date) >= from && (o.paidAt || o.date) <= t);
  const courseN = sum(Fin.courses(), c => sum(finMonths().filter(m => m >= monthOf(from)), m => Fin.courseSale(c, m).n));
  const courseRev = sum(Fin.courses(), c => sum(finMonths().filter(m => m >= monthOf(from)), m => Fin.courseSale(c, m).revenue));
  const row = (name, val, how, cls = '') => `<tr class="${cls}"><td>${name}<small class="block how-m">${how}</small></td><td class="r nowrap"><b>${val}</b></td><td class="note">${how}</td></tr>`;
  const ok = u.ltvCac === null ? '' : u.ltvCac >= 3 ? 'good' : u.ltvCac >= 1 ? 'warn' : 'bad';
  return `<section class="section card unit">
    <div class="card-head"><h2>Чек и юнит-экономика</h2>${finSeg('ue', [['month', 'Этот месяц'], ['quarter', 'С начала квартала']], per)}</div>
    <div class="table-wrap"><table class="t unit-t">
      <tbody>
        ${row('Средний чек оплаты', rub(Math.round(u.check)), `выручка подписок ${rubK(u.f.revenue)} ÷ ${fmt(u.pays)} ${plural(u.pays, 'оплата', 'оплаты', 'оплат')} (первые и продления)`)}
        ${row('Цена подписки', `${rub(s.price)} · ${rub(priceYear())}`, `месяц · год (≈ ${rub(Math.round(priceYear() / 12))} в месяц)`)}
        ${row('Переменные расходы с оплаты', pct(u.varShare, 1), `эквайринг ${pct(s.acquiring, 1)} + налог ${pct(s.taxRate, 1)}`)}
        ${row('Маржа с оплаты', rub(Math.round(u.margin)), 'чек минус переменные расходы')}
        ${row('Продлевают каждый месяц', pct(u.renew), u.renewPlan ? 'по плану — фактических продлений ещё нет' : 'по последнему месяцу в «Подписках»')}
        ${row('Средний срок подписки', `${fmt(u.life, 1)} мес.`, `1 ÷ отток ${pct(u.churn)}`)}
        ${row('LTV — доход с подписчика', rub(Math.round(u.ltv)), 'маржа с оплаты × срок подписки', 'sub')}
        ${row('Стоимость привлечения (CAC)', u.cac === null ? '—' : rub(Math.round(u.cac)), `маркетинг и реферальные ${rubK(u.spend)} ÷ ${fmt(u.f.pays)} новых платящих`, 'sub')}
        ${row('LTV / CAC', u.ltvCac === null ? '—' : `<span class="${ok}">${fmt(u.ltvCac, 1)}</span>`, u.cac === 0 ? 'расходов на привлечение за период нет — подписчики пришли сами' : 'здорово — от 3; меньше 1 — привлечение не окупается')}
        ${row('Окупаемость привлечения', u.payback === null ? '—' : `${fmt(u.payback, 1)} мес.`, 'CAC ÷ маржа с оплаты')}
        ${orders.length ? row('Средний чек заказа маркетплейса', rub(Math.round(sum(orders, o => Fin.orderTotal(o)) / orders.length)), `${fmt(orders.length)} оплаченных заказов`) : ''}
        ${courseN ? row('Средняя цена проданного курса', rub(Math.round(courseRev / courseN)), `${fmt(courseN)} продаж на ${rubK(courseRev)}`) : ''}
      </tbody></table></div>
  </section>`;
}

/* ── подписки и рефералы ── */
function finSubsHtml() {
  const rows = Subs.rows(), now = rows[rows.length - 1], rate = Subs.rate(), s = settings();
  const edit = Auth.can('money.edit');
  const cell = (r, k, val = r[k]) => `<td class="r ${r.auto[k] ? 'auto' : ''}" ${r.auto[k] ? 'title="Само: из «Цифр дня» и возвратов. «Поправить» — внести своё"' : ''}>${fmt(val)}</td>`;
  return `<div class="cards tiles">
      ${finTile('Платных сейчас', fmt(now.total), `месячных ${fmt(now.endM)} · годовых ${fmt(now.endY)}`)}
      ${finTile('MRR', rubK(now.mrr), 'месячная выручка подписок')}
      ${finTile('Продления', pctOr(rate && rate.renew), rate ? `${monthName(rate.m).toLowerCase()} · не продлили ${pctOr(rate.churn)}` : 'после первого месяца')}
      ${finTile('Возвраты', pctOr(rate && rate.refund, 1), `от оплат · ${fmt(now.refunds)} в этом месяце`)}
    </div>
    <section class="section">
      <div class="section-head"><h2>Подписки по месяцам</h2><span class="hint-inline">Серым — посчитано само: новые и продления из «Цифр дня», возвраты — из раздела «Возвраты». Цены: месяц ${rub(s.price)}, год ${rub(priceYear())}.</span>${finCsvBtn('subs')}</div>
      <div class="table-wrap"><table class="t subs-t grid-lines">
        <thead><tr><th>Месяц</th><th class="r">На начало<small>мес · год</small></th><th class="r">Новые<small>месячные</small></th><th class="r">Новые<small>годовые</small></th><th class="r">Продлили</th><th class="r">Не продлили</th><th class="r">Возвраты</th><th class="r">На конец<small>мес · год</small></th><th class="r">Всего</th><th class="r">Продления</th><th class="r">Возвраты</th><th class="r">Выручка</th><th class="r">MRR</th>${edit ? '<th></th>' : ''}</tr></thead>
        <tbody>${rows.map(r => `<tr class="${r.now ? 'now-row' : ''}"><td class="nowrap"><b>${monthName(r.m)}</b>${r.now ? ' <span class="th-tag now">идёт</span>' : ''}</td>
          <td class="r nowrap ${r.auto.startM && r.auto.startY ? 'auto' : ''}">${fmt(r.startM)} · ${fmt(r.startY)}</td>
          ${cell(r, 'newM')}<td class="r">${fmt(r.newY)}</td>${cell(r, 'renewed')}${cell(r, 'churn')}${cell(r, 'refunds')}
          <td class="r nowrap">${fmt(r.endM)} · ${fmt(r.endY)}</td><td class="r"><b>${fmt(r.total)}</b></td>
          <td class="r">${pctOr(r.renewRate)}</td><td class="r">${pctOr(r.refundRate, 1)}</td><td class="r nowrap">${rubK(r.revenue)}</td><td class="r nowrap">${rubK(r.mrr)}</td>
          ${edit ? `<td><button class="btn xs ghost" data-subs-edit="${r.m}">Поправить</button></td>` : ''}</tr>`).join('')}</tbody>
      </table></div>
      <p class="note">Продления — доля месячных подписчиков на начало месяца, которые оплатили снова${now.now ? '; в идущем месяце срок подошёл ещё не у всех, поэтому считаем только прошедшие дни' : ''}. Возвраты — от всех оплат месяца. Годовые подписки продлеваются через год.</p>
    </section>
    ${payoutsHtml('ref')}`;
}
function editSubs(m) {
  const rows = Subs.rows(), r = rows.find(x => x.m === m), rec = Subs.rec(m), first = rows[0].m === m;
  const f = (k, label, hint, auto) => `<label class="field"><span>${label}</span><input class="input num" data-sk="${k}" inputmode="numeric" value="${isSet(rec[k]) ? esc(rec[k]) : ''}" placeholder="${fmt(auto)}"><small>${hint}</small></label>`;
  openModal({
    title: `Подписки — ${monthName(m).toLowerCase()}`,
    body: `<p class="note">Пустое поле — значит «посчитать само» (серая цифра). Впишите своё, если знаете точнее — например, из личного кабинета платёжной системы.</p>
      <div class="grid3">
        ${f('startM', 'Месячных на начало', first ? 'с этого месяца начинаем учёт' : 'само — конец прошлого месяца', r.startM)}
        ${f('startY', 'Годовых на начало', first ? 'с этого месяца начинаем учёт' : 'само — конец прошлого месяца', r.startY)}
        ${f('newY', 'Новые годовые', 'годовые подписки, оформленные в этом месяце', r.newY)}
        ${f('newM', 'Новые месячные', 'само — оплаты из «Цифр дня» минус годовые', r.newM)}
        ${f('renewed', 'Продлили', 'само — продления из «Цифр дня»', r.renewed)}
        ${f('churn', 'Не продлили', 'само — у кого подошёл срок, но оплаты не было', r.churn)}
        ${f('refunds', 'Возвраты, шт.', 'само — из раздела «Возвраты»', r.refunds)}
        ${f('refundSum', 'Возвраты, ₽', 'само — из раздела «Возвраты»', r.refundSum)}
      </div>`,
    foot: '<button class="btn" data-close>Отмена</button><button class="btn primary" id="sbSave">Сохранить</button>',
    onMount(el, close) {
      $('#sbSave', el).onclick = () => {
        const data = {by: Tasks.meKey(), at: Date.now()};
        $$('[data-sk]', el).forEach(i => { const v = i.value.trim(); data[i.dataset.sk] = v === '' ? null : Math.max(0, Math.round(parseNum(v))); });
        Store.put('subs', m, data);
        close();
        toast(`Подписки за ${monthName(m).toLowerCase()} сохранены`);
      };
    },
  });
}

/* ── выплаты: рефералам, авторам, продавцам ── */
function payoutsHtml(kind) {
  const ops = finOps();
  const all = Fin.accruals().filter(x => x.kind === kind);
  const f = View.get('fin.pay.' + kind, 'due');
  const list = all.filter(x => (f === 'due' ? !x.paid : f === 'paid' ? x.paid : true));
  const due = sum(all.filter(x => !x.paid && x.closed), x => x.amount), paid = sum(all.filter(x => x.paid), x => x.amount);
  const growing = sum(all.filter(x => !x.paid && !x.closed), x => x.amount);
  const title = {ref: 'Реферальные выплаты', author: 'Выплаты авторам', seller: 'Выплаты продавцам'}[kind];
  const how = {ref: 'Кому и сколько начислено за приведённых подписчиков. «Выплатить» — расход попадёт в журнал со статьёй «Реферальные выплаты».',
    author: 'Начисляется само: продажи курса × доля автора. За идущий месяц — «начисляется», выплата — после закрытия месяца.',
    seller: 'Начисляется само из оплаченных заказов: оборот продавца минус комиссия клуба.'}[kind];
  const row = x => `<tr class="${x.paid ? 'muted-row' : ''}">
      <td><b>${esc(x.to)}</b>${x.contact && ops ? `<small class="block">${contactHtml(x.contact)}</small>` : ''}${x.course ? `<small class="block">${esc(x.course.title)}</small>` : ''}${x.note ? `<small class="block">${esc(x.note)}</small>` : ''}</td>
      <td class="nowrap">${monthName(x.month)}</td>
      <td class="r nowrap">${kind === 'ref' ? `${x.n ? fmt(x.n) + ' опл. · ' : ''}${rub(x.base)} × ${fmt(x.pct)}%` : kind === 'author' ? `${fmt(x.n)} шт. · ${rubK(x.revenue)}` : `оборот ${rubK(x.revenue)} · комиссия ${rubK(x.fee)}`}</td>
      <td class="r nowrap"><b>${rub(x.amount)}</b></td>
      <td class="nowrap">${x.paid ? `<span class="pill good">выплачено ${dayShort(x.paidAt)}</span>` : x.closed ? '<span class="pill warn">к выплате</span>' : '<span class="pill line">начисляется</span>'}</td>
      <td class="nowrap r">${ops ? (x.paid ? `<button class="btn xs ghost" data-unpay-x="${esc(x.id)}">Отменить</button>` : x.closed ? `<button class="btn xs primary" data-pay-x="${esc(x.id)}">Выплатить</button>` : '') : ''}${ops && kind === 'ref' ? ` <button class="icon-btn" data-ref-edit="${esc(x.id)}" aria-label="Изменить" title="Изменить">${icon('edit')}</button>` : ''}</td></tr>`;
  return `<section class="section payouts" data-payouts="${kind}">
    <div class="section-head"><h2>${title}</h2><span class="hint-inline">${how}</span>
      <span class="row">${finSeg('pay.' + kind, [['due', 'К выплате'], ['paid', 'Выплачено'], ['all', 'Все']], f)}${ops && kind === 'ref' ? `<button class="btn sm primary" data-ref-add>${icon('plus')}Начисление</button>` : ''}${finCsvBtn('payouts')}</span></div>
    <div class="fin-sum"><span>К выплате <b>${rub(due)}</b></span>${growing ? `<span>начисляется за ${monthName(monthOf(today())).toLowerCase()} <b>${rub(growing)}</b></span>` : ''}<span>Выплачено <b class="good">${rub(paid)}</b></span></div>
    ${list.length ? `<div class="table-wrap"><table class="t pay-t"><thead><tr><th>Кому</th><th>Месяц</th><th class="r">За что</th><th class="r">Сумма</th><th>Статус</th><th></th></tr></thead><tbody>${list.map(row).join('')}</tbody></table></div>`
      : `<div class="empty"><b>${f === 'due' ? 'Выплатить пока нечего' : 'Записей нет'}</b>${kind === 'ref' && ops ? 'Нажмите «Начисление», чтобы записать, сколько начислено партнёру или амбассадору.' : ''}</div>`}
  </section>`;
}
function editRef(id) {
  const p = id ? Store.get('payouts', id) : null, s = settings();
  const v = p || {to: '', contact: '', month: monthOf(today()), n: '', base: '', pct: Math.round(s.referral * 100), amount: '', note: ''};
  const names = [...new Set(Store.all('payouts').filter(x => x.kind === 'ref' && x.to).map(x => x.to))];
  openModal({
    title: p ? 'Реферальное начисление' : 'Новое реферальное начисление',
    body: `<div class="grid2">
        <label class="field"><span>Кому</span><input class="input" id="rfTo" list="rfNames" value="${esc(v.to)}" placeholder="Имя партнёра или амбассадора" maxlength="80"><datalist id="rfNames">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist></label>
        <label class="field"><span>Контакт</span><input class="input" id="rfContact" value="${esc(v.contact || '')}" placeholder="@telegram, почта или телефон" maxlength="80"></label>
      </div>
      <div class="grid3">
        <label class="field"><span>Месяц</span><select class="select" id="rfMonth">${monthOpts(v.month, monthRange(CF_MONTHS[0], addMonths(monthOf(today()), 1)))}</select></label>
        <label class="field"><span>Оплат привёл</span><input class="input num" id="rfN" inputmode="numeric" value="${esc(v.n || '')}" placeholder="0"></label>
        <label class="field"><span>Сумма этих оплат, ₽</span><input class="input num" id="rfBase" inputmode="decimal" value="${esc(v.base || '')}" placeholder="оплаты × ${fmt(s.price)}"></label>
        <label class="field"><span>Процент</span><input class="input num" id="rfPct" inputmode="decimal" value="${esc(v.pct)}"></label>
        <label class="field"><span>Начислено, ₽</span><input class="input num" id="rfAmount" inputmode="decimal" value="${esc(v.amount || '')}"><small id="rfAuto"></small></label>
      </div>
      <label class="field"><span>Комментарий</span><input class="input" id="rfNote" value="${esc(v.note || '')}" maxlength="160" placeholder="Например: промокод ANNA, блог"></label>
      ${p && p.status === 'paid' ? `<p class="note">Выплачено ${dayLong(p.paidAt)} — сумма в журнале не изменится; чтобы поправить, отмените выплату.</p>` : ''}`,
    foot: `${p ? `<button class="btn danger left" id="rfDel">${icon('trash')}Удалить</button>` : ''}<button class="btn" data-close>Отмена</button><button class="btn primary" id="rfSave">Сохранить</button>`,
    onMount(el, close) {
      const calc = () => {
        const n = parseNum($('#rfN', el).value), base = parseNum($('#rfBase', el).value) || n * s.price;
        const a = Math.round(base * parseNum($('#rfPct', el).value) / 100);
        $('#rfAuto', el).textContent = a ? `само: ${rub(a)}` : '';
        return {n, base, a};
      };
      ['#rfN', '#rfBase', '#rfPct'].forEach(q => $(q, el).addEventListener('input', calc));
      calc();
      $('#rfSave', el).onclick = () => {
        const to = $('#rfTo', el).value.trim();
        if (!to) { $('#rfTo', el).focus(); toast('Кому начисляем?'); return; }
        const c = calc(), amount = Math.round(parseNum($('#rfAmount', el).value)) || c.a;
        if (!(amount > 0)) { $('#rfAmount', el).focus(); toast('Укажите сумму начисления'); return; }
        const data = {kind: 'ref', to, contact: $('#rfContact', el).value.trim(), month: $('#rfMonth', el).value, n: c.n || 0, base: c.base || 0, pct: parseNum($('#rfPct', el).value), amount, note: $('#rfNote', el).value.trim()};
        if (p) Store.patch('payouts', p.id, data);
        else Store.add('payouts', {...data, status: 'accrued', by: Tasks.meKey(), at: Date.now()});
        close();
        toast(`Начислено: ${to} — ${rub(amount)}`);
      };
      const del = $('#rfDel', el);
      if (del) del.onclick = async () => {
        if (!(await confirmPop(del, {text: p.status === 'paid' ? 'Удалить начисление? Выплата останется в журнале.' : 'Удалить начисление?', yes: 'Удалить', danger: true}))) return;
        Store.remove('payouts', p.id);
        close();
      };
    },
  });
}

/* ── курсы и выплаты авторам ── */
function finCoursesHtml() {
  const list = Fin.courses(), months = finMonths(), cur = monthOf(today());
  const edit = Auth.can('money.edit');
  const mTot = m => list.reduce((a, c) => { const s = Fin.courseSale(c, m); a.n += s.n; a.rev += s.revenue; a.au += s.author; return a; }, {n: 0, rev: 0, au: 0});
  const now = mTot(cur);
  const due = sum(Fin.accruals().filter(x => x.kind === 'author' && !x.paid && x.closed), x => x.amount);
  const ledCell = m => {
    const t = mTot(m), e = Fin.courseLedger(m);
    if (!t.rev && !e) return '<td></td>';
    if (e) return `<td class="r"><span class="pill good" title="Выручка курсов за ${monthName(m).toLowerCase()} — в журнале">${icon('tick')}в журнале</span></td>`;
    return `<td class="r">${edit ? `<button class="btn xs" data-course-led="${m}" title="Записать выручку курсов приходом в журнал — тогда она попадёт в баланс и P&L">Внести приход</button>` : '<span class="note">не в журнале</span>'}</td>`;
  };
  return `<div class="cards tiles">
      ${finTile(`Продано за ${monthName(cur).toLowerCase()}`, fmt(now.n), `${list.length} ${plural(list.length, 'курс', 'курса', 'курсов')} в каталоге`)}
      ${finTile('Выручка курсов за месяц', rubK(now.rev), 'продажи × цена или своя сумма')}
      ${finTile('Авторам за месяц', rubK(now.au), 'начисляется, выплата после закрытия месяца')}
      ${finTile('К выплате авторам', rubK(due), 'за прошлые месяцы')}
    </div>
    <section class="section">
      <div class="section-head"><h2>Продажи по курсам</h2><span class="hint-inline">${edit ? 'Впишите, сколько продано за месяц, — выручка и доля автора посчитаются сами. «Внести приход» запишет выручку месяца в журнал.' : 'Сколько продано и начислено авторам.'}</span>
        <span class="row">${edit ? `<button class="btn sm primary" data-course-add>${icon('plus')}Курс</button>` : ''}${finCsvBtn('courses')}</span></div>
      ${list.length ? `<div class="table-wrap"><table class="t courses-t grid-lines">
        <thead><tr><th>Курс</th>${months.map(m => `<th class="r">${monthName(m)}${m === cur ? ' <span class="th-tag now">идёт</span>' : ''}</th>`).join('')}<th class="r">Всего</th><th class="r">Выручка</th><th class="r">Авторам</th></tr></thead>
        <tbody>${list.map(c => {
          const tot = months.reduce((a, m) => { const s = Fin.courseSale(c, m); a.n += s.n; a.rev += s.revenue; a.au += s.author; return a; }, {n: 0, rev: 0, au: 0});
          return `<tr class="${c.active === false ? 'dim' : ''}"><td><button class="plan-name" ${edit ? `data-course-edit="${c.id}"` : 'disabled'}>${esc(c.title)}</button><div class="note">${esc(c.author || 'автор не указан')} · ${rub(Number(c.price) || 0)} · автору ${fmt(Number(c.authorPct) || 0)}%</div></td>
            ${months.map(m => { const s = Fin.courseSale(c, m); return `<td class="r">${edit ? `<input class="input num sm cs-n" data-cs="${c.id}:${m}" inputmode="numeric" value="${s.n || ''}" placeholder="0" aria-label="${esc(c.title)}: продано за ${monthName(m).toLowerCase()}">` : fmt(s.n)}${s.revenue ? `<small class="block">${rubK(s.revenue)}${s.own ? '*' : ''}</small>` : ''}</td>`; }).join('')}
            <td class="r"><b>${fmt(tot.n)}</b></td><td class="r nowrap">${rubK(tot.rev)}</td><td class="r nowrap">${rubK(tot.au)}</td></tr>`;
        }).join('')}</tbody>
        <tfoot><tr class="total"><td>Итого</td>${months.map(m => { const t = mTot(m); return `<td class="r nowrap">${fmt(t.n)} шт.<small class="block">${rubK(t.rev)}</small></td>`; }).join('')}<td class="r">${fmt(sum(months, m => mTot(m).n))}</td><td class="r nowrap">${rubK(sum(months, m => mTot(m).rev))}</td><td class="r nowrap">${rubK(sum(months, m => mTot(m).au))}</td></tr>
          <tr class="sub"><td>Приход в журнале</td>${months.map(ledCell).join('')}<td colspan="3"></td></tr></tfoot>
      </table></div>${list.some(c => months.some(m => Fin.courseSale(c, m).own)) ? '<p class="note">* выручка вписана вручную (скидки, акции)</p>' : ''}`
        : `<div class="empty"><b>Курсов пока нет</b>${edit ? 'Добавьте курс: название, автор, цена и доля автора.' : ''}</div>`}
    </section>
    ${payoutsHtml('author')}`;
}
function editCourse(id) {
  const c = id ? Store.get('courses', id) : null;
  const v = c || {title: '', author: '', authorContact: '', price: '', authorPct: 50, active: true, sales: {}};
  openModal({
    title: c ? 'Курс' : 'Новый курс',
    wide: !!c,
    body: `<label class="field"><span>Название</span><input class="input" id="crTitle" value="${esc(v.title)}" maxlength="120" placeholder="Например: Макияж для себя за 7 дней"></label>
      <div class="grid2">
        <label class="field"><span>Автор</span><input class="input" id="crAuthor" value="${esc(v.author || '')}" maxlength="80"></label>
        <label class="field"><span>Контакт автора</span><input class="input" id="crContact" value="${esc(v.authorContact || '')}" maxlength="80" placeholder="@telegram, почта или телефон"></label>
      </div>
      <div class="grid3">
        <label class="field"><span>Цена, ₽</span><input class="input num" id="crPrice" inputmode="decimal" value="${esc(v.price)}"></label>
        <label class="field"><span>Доля автора, %</span><input class="input num" id="crPct" inputmode="decimal" value="${esc(v.authorPct)}"></label>
        <label class="check cr-act"><input type="checkbox" id="crActive" ${v.active !== false ? 'checked' : ''}> В продаже</label>
      </div>
      ${c ? `<div class="field"><span>Выручка по месяцам — если отличалась от «продано × цена» (скидки, акции)</span><div class="grid3">${finMonths().map(m => { const x = (c.sales || {})[m] || {}; return `<label class="field"><span>${monthName(m)}</span><input class="input num" data-crrev="${m}" inputmode="decimal" value="${isSet(x.revenue) ? esc(x.revenue) : ''}" placeholder="${fmt((Number(x.n) || 0) * (Number(c.price) || 0))}"></label>`; }).join('')}</div></div>` : ''}`,
    foot: `${c ? `<button class="btn danger left" id="crDel">${icon('trash')}Удалить</button>` : ''}<button class="btn" data-close>Отмена</button><button class="btn primary" id="crSave">Сохранить</button>`,
    onMount(el, close) {
      $('#crSave', el).onclick = () => {
        const title = $('#crTitle', el).value.trim();
        if (!title) { $('#crTitle', el).focus(); return; }
        const data = {title, author: $('#crAuthor', el).value.trim(), authorContact: $('#crContact', el).value.trim(), price: parseNum($('#crPrice', el).value), authorPct: parseNum($('#crPct', el).value), active: $('#crActive', el).checked};
        if (c) {
          const sales = clone(c.sales || {});
          $$('[data-crrev]', el).forEach(i => { const m = i.dataset.crrev; sales[m] = {...(sales[m] || {}), revenue: i.value.trim() === '' ? null : parseNum(i.value)}; });
          Store.put('courses', c.id, {...c, ...data, sales});
          finMonths().forEach(syncCourseLedger);
        } else Store.add('courses', {...data, sales: {}, at: Date.now(), by: Tasks.meKey()});
        close();
      };
      const del = $('#crDel', el);
      if (del) del.onclick = async () => {
        if (!(await confirmPop(del, {text: 'Удалить курс? Продажи и начисления по нему пропадут, выплаты останутся в журнале.', yes: 'Удалить', danger: true}))) return;
        Store.remove('courses', c.id);
        finMonths().forEach(syncCourseLedger);
        close();
      };
    },
  });
}
/* выручка курсов месяца уже в журнале — держим сумму в актуальном виде */
function syncCourseLedger(m) {
  const e = Fin.courseLedger(m);
  if (!e) return;
  const total = sum(Fin.courses(), c => Fin.courseSale(c, m).revenue);
  if (!total) Store.remove('ledger', e.id);
  else if (Number(e.amount) !== total) Store.patch('ledger', e.id, {amount: total});
}

/* ── маркетплейс ── */
function finMarketHtml() {
  const view = View.get('fin.mk', 'orders'), cur = monthOf(today());
  const orders = Fin.orders(), products = Fin.products();
  const month = orders.filter(o => monthOf(o.date || '') === cur);
  const paidM = orders.filter(o => o.pay === 'paid' && monthOf(o.paidAt || o.date || '') === cur);
  const tiles = `<div class="cards tiles">
      ${finTile(`Заказов за ${monthName(cur).toLowerCase()}`, fmt(month.length), `оплачено ${fmt(paidM.length)}`)}
      ${finTile('Выручка за месяц', rubK(sum(paidM, o => Fin.orderTotal(o))), 'оплаченные заказы')}
      ${finTile('К отправке', fmt(orders.filter(o => Fin.toShip(o)).length), 'оплачены, не отправлены')}
      ${finTile('Ждут оплаты', fmt(orders.filter(o => (o.pay || 'wait') === 'wait' && o.delivery !== 'cancelled').length), rubK(sum(orders.filter(o => (o.pay || 'wait') === 'wait' && o.delivery !== 'cancelled'), o => Fin.orderTotal(o))))}
    </div>`;
  const seg = finSeg('mk', [['orders', `Заказы · ${orders.length}`], ['products', `Товары и склад · ${products.length}`], ['split', 'Распределение выручки']], view);
  return `${tiles}<div class="fin-subbar">${seg}</div>${view === 'products' ? productsHtml(products) : view === 'split' ? splitHtml() : ordersHtml(orders)}`;
}
function ordersHtml(orders) {
  const ops = finOps();
  const f = View.get('fin.ordf', 'open');
  const groups = {open: o => o.delivery !== 'cancelled' && o.delivery !== 'delivered' && o.pay !== 'refund', wait: o => (o.pay || 'wait') === 'wait' && o.delivery !== 'cancelled', ship: o => Fin.toShip(o), road: o => o.delivery === 'shipped', done: o => o.delivery === 'delivered' || o.delivery === 'cancelled' || o.pay === 'refund', all: () => true};
  const list = orders.filter(groups[f] || groups.all);
  const items = o => (o.items || []).map(it => `${esc(it.title)}${Number(it.qty) > 1 ? ` × ${fmt(it.qty)}` : ''}`).join(', ');
  const sel = (o, kind, map, cur) => ops ? `<select class="select sm st-sel ${(map[cur] || {}).tone || ''}" data-ord-${kind}="${o.id}" aria-label="${kind === 'pay' ? 'Оплата' : 'Доставка'} заказа №${o.no}">${Object.entries(map).map(([k, x]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${x.name}</option>`).join('')}</select>` : finPill(cur, map);
  return `<section class="section">
    <div class="section-head"><h2>Заказы</h2>${finSeg('ordf', [['open', 'В работе'], ['wait', 'Ждут оплаты'], ['ship', 'К отправке'], ['road', 'В пути'], ['done', 'Закрытые'], ['all', 'Все']], f)}
      <span class="row">${ops ? `<button class="btn sm primary" data-order-add>${icon('plus')}Заказ</button>` : ''}${finCsvBtn('orders')}</span></div>
    ${list.length ? `<div class="table-wrap"><table class="t ord-t">
      <thead><tr><th>№</th><th>Дата</th>${ops ? '<th>Клиент</th>' : ''}<th>Состав</th><th class="r">Сумма</th><th>Оплата</th><th>Доставка</th><th>Трек</th></tr></thead>
      <tbody>${list.map(o => `<tr class="${ops ? 'click' : ''}" ${ops ? `data-order="${o.id}"` : ''}>
        <td><b>${fmt(o.no)}</b></td><td class="nowrap">${dayShort(o.date || today())}</td>
        ${ops ? `<td>${esc(o.customer || '—')}${o.contact ? `<small class="block">${contactHtml(o.contact)}</small>` : ''}</td>` : ''}
        <td class="ord-items">${items(o) || '—'}</td><td class="r nowrap"><b>${rub(Fin.orderTotal(o))}</b></td>
        <td data-stop>${sel(o, 'pay', ORDER_PAY, o.pay || 'wait')}</td><td data-stop>${sel(o, 'del', ORDER_DELIVERY, o.delivery || 'new')}</td>
        <td class="nowrap">${esc(o.track || '')}</td></tr>`).join('')}</tbody></table></div>`
      : `<div class="empty"><b>Заказов нет</b>${ops ? 'Нажмите «Заказ», чтобы записать первый.' : ''}</div>`}
    <p class="note">«Оплачен» — приход сам попадает в журнал, свой товар списывается со склада. «Возврат» — в журнал ляжет расход «Возвраты клиентам», товар вернётся на склад.</p>
  </section>`;
}
function editOrder(id) {
  const o = id ? Store.get('orders', id) : null;
  const products = Fin.products();
  const v = o || {no: Market.nextNo(), date: today(), customer: '', contact: '', address: '', items: [], shipCost: '', pay: 'wait', delivery: 'new', track: '', note: ''};
  const itemRow = (it = {}) => `<div class="oi-row">
      <select class="select oi-p"><option value="">— товар из каталога —</option>${products.map(p => `<option value="${p.id}" ${p.id === it.productId ? 'selected' : ''}>${esc(p.title)}${p.seller ? ' · ' + esc(p.seller) : ''}</option>`).join('')}</select>
      <input class="input oi-t" placeholder="или название" value="${esc(it.productId ? '' : it.title || '')}">
      <input class="input num oi-q" inputmode="numeric" value="${esc(it.qty || 1)}" aria-label="Количество">
      <input class="input num oi-pr" inputmode="decimal" value="${esc(it.price || '')}" placeholder="цена" aria-label="Цена">
      <button type="button" class="icon-btn" data-oi-del aria-label="Убрать">${icon('x')}</button></div>`;
  openModal({
    title: o ? `Заказ №${o.no}` : 'Новый заказ',
    wide: true,
    body: `<div class="grid3">
        <label class="field"><span>Номер</span><input class="input num" id="orNo" value="${esc(v.no)}"></label>
        <label class="field"><span>Дата</span><input class="input" type="date" id="orDate" value="${esc(v.date || today())}"></label>
        <label class="field"><span>Клиент</span><input class="input" id="orCustomer" value="${esc(v.customer || '')}" maxlength="80"></label>
        <label class="field"><span>Контакт</span><input class="input" id="orContact" value="${esc(v.contact || '')}" maxlength="80" placeholder="телефон, почта или @telegram"></label>
        <label class="field fin-span2"><span>Адрес или пункт выдачи</span><input class="input" id="orAddr" value="${esc(v.address || '')}" maxlength="200"></label>
      </div>
      <div class="field"><span>Состав заказа</span><div class="oi-list" id="orItems">${(v.items.length ? v.items : [{}]).map(itemRow).join('')}</div>
        <button type="button" class="btn xs ghost" id="orItemAdd">${icon('plus')}Позиция</button></div>
      <div class="grid3">
        <label class="field"><span>Доставка, ₽</span><input class="input num" id="orShip" inputmode="decimal" value="${esc(v.shipCost || '')}" placeholder="0"></label>
        <label class="field"><span>Оплата</span><select class="select" id="orPay">${Object.entries(ORDER_PAY).map(([k, x]) => `<option value="${k}" ${k === (v.pay || 'wait') ? 'selected' : ''}>${x.name}</option>`).join('')}</select></label>
        <label class="field"><span>Доставка</span><select class="select" id="orDel">${Object.entries(ORDER_DELIVERY).map(([k, x]) => `<option value="${k}" ${k === (v.delivery || 'new') ? 'selected' : ''}>${x.name}</option>`).join('')}</select></label>
        <label class="field"><span>Трек-номер</span><input class="input" id="orTrack" value="${esc(v.track || '')}" maxlength="60"></label>
        <label class="field fin-span2"><span>Комментарий</span><input class="input" id="orNote" value="${esc(v.note || '')}" maxlength="200"></label>
      </div>
      <p class="fin-total">Итого: <b id="orTotal"></b></p>`,
    foot: `${o ? `<button class="btn danger left" id="orDel2">${icon('trash')}Удалить</button>` : ''}<button class="btn" data-close>Отмена</button><button class="btn primary" id="orSave">Сохранить</button>`,
    onMount(el, close) {
      const read = () => $$('.oi-row', el).map(r => {
        const pid = $('.oi-p', r).value, p = pid ? Store.get('products', pid) : null;
        const title = p ? p.title : $('.oi-t', r).value.trim();
        if (!title) return null;
        const it = {productId: pid || null, title, qty: Math.max(1, Math.round(parseNum($('.oi-q', r).value)) || 1), price: parseNum($('.oi-pr', r).value)};
        if (p && p.seller) { it.seller = p.seller; it.fee = Number(p.fee) || 0; }
        if (p && !p.seller) it.cost = Number(p.cost) || 0;
        return it;
      }).filter(Boolean);
      const total = () => { const t = Fin.orderTotal({items: read(), shipCost: parseNum($('#orShip', el).value)}); $('#orTotal', el).textContent = rub(t); };
      on(el, 'change', '.oi-p', (e, s) => { const p = Store.get('products', s.value), r = s.closest('.oi-row'); if (p) { $('.oi-pr', r).value = p.price || ''; $('.oi-t', r).value = ''; } total(); });
      on(el, 'input', '.oi-q, .oi-pr, .oi-t, #orShip', total);
      on(el, 'click', '[data-oi-del]', (e, b) => { b.closest('.oi-row').remove(); total(); });
      $('#orItemAdd', el).onclick = () => { $('#orItems', el).insertAdjacentHTML('beforeend', itemRow()); total(); };
      total();
      $('#orSave', el).onclick = () => {
        const items = read();
        if (!items.length) { toast('Добавьте хотя бы одну позицию'); return; }
        const pay = $('#orPay', el).value;
        const data = {no: Math.round(parseNum($('#orNo', el).value)) || Market.nextNo(), date: $('#orDate', el).value || today(), customer: $('#orCustomer', el).value.trim(), contact: $('#orContact', el).value.trim(),
          address: $('#orAddr', el).value.trim(), items, shipCost: parseNum($('#orShip', el).value), pay, delivery: $('#orDel', el).value, track: $('#orTrack', el).value.trim(), note: $('#orNote', el).value.trim()};
        if (pay === 'paid' && !(o && o.paidAt)) data.paidAt = today();
        if (pay === 'wait') data.paidAt = null;
        let oid;
        if (o) { oid = o.id; Store.put('orders', oid, {...o, ...data}); }
        else oid = Store.add('orders', {...data, by: Tasks.meKey(), at: Date.now()});
        Market.sync(oid);
        close();
        toast(o ? `Заказ №${data.no} сохранён` : `Заказ №${data.no} записан`);
      };
      const del = $('#orDel2', el);
      if (del) del.onclick = async () => {
        if (!(await confirmPop(del, {text: 'Удалить заказ? Его приход и возврат уйдут из журнала, товар вернётся на склад.', yes: 'Удалить', danger: true}))) return;
        Store.put('orders', o.id, {...o, pay: 'wait', delivery: 'cancelled'});
        Market.sync(o.id);
        Store.remove('orders', o.id);
        close();
      };
    },
  });
}
function productsHtml(products) {
  const ops = finOps();
  const sold = {};
  Store.all('orders').filter(o => o.pay === 'paid' && o.delivery !== 'cancelled').forEach(o => (o.items || []).forEach(it => { if (it.productId) sold[it.productId] = (sold[it.productId] || 0) + (Number(it.qty) || 0); }));
  return `<section class="section">
    <div class="section-head"><h2>Товары и склад</h2><span class="hint-inline">Свой склад — товар, который клуб закупает и отправляет сам: у него остаток и себестоимость. Товар продавца — клуб берёт комиссию, остальное выплачивается продавцу.</span>
      <span class="row">${ops ? `<button class="btn sm primary" data-product-add>${icon('plus')}Товар</button>` : ''}${finCsvBtn('products')}</span></div>
    ${products.length ? `<div class="table-wrap"><table class="t prod-t">
      <thead><tr><th>Товар</th><th>Чей</th><th class="r">Цена</th><th class="r">Себестоимость</th><th class="r">Остаток</th><th class="r">Продано</th></tr></thead>
      <tbody>${products.map(p => {
        const low = !p.seller && isSet(p.stock) && Number(p.stock) <= 3;
        return `<tr><td><button class="plan-name" ${ops ? `data-product="${p.id}"` : 'disabled'}>${esc(p.title)}</button>${p.sku ? `<div class="note">арт. ${esc(p.sku)}</div>` : ''}</td>
          <td>${p.seller ? `${esc(p.seller)} <span class="note">· комиссия ${fmt(Number(p.fee) || 0)}%</span>` : 'Свой склад'}</td>
          <td class="r nowrap">${rub(Number(p.price) || 0)}</td><td class="r nowrap">${p.seller ? '—' : rub(Number(p.cost) || 0)}</td>
          <td class="r">${p.seller ? '—' : ops ? `<input class="input num sm st-in ${low ? 'bad' : ''}" data-stock="${p.id}" inputmode="numeric" value="${isSet(p.stock) ? esc(p.stock) : ''}" placeholder="—" aria-label="Остаток: ${esc(p.title)}">` : `<span class="${low ? 'bad' : ''}">${isSet(p.stock) ? fmt(p.stock) : '—'}</span>`}${low ? '<small class="block bad">заканчивается</small>' : ''}</td>
          <td class="r">${fmt(sold[p.id] || 0)}</td></tr>`;
      }).join('')}</tbody></table></div>`
      : `<div class="empty"><b>Товаров пока нет</b>${ops ? 'Добавьте товары — свои или продавцов-партнёров.' : ''}</div>`}
  </section>`;
}
function editProduct(id) {
  const p = id ? Store.get('products', id) : null;
  const v = p || {title: '', sku: '', price: '', cost: '', stock: '', seller: '', fee: 20};
  const sellers = [...new Set(Store.all('products').map(x => x.seller).filter(Boolean))];
  openModal({
    title: p ? 'Товар' : 'Новый товар',
    body: `<div class="grid2"><label class="field"><span>Название</span><input class="input" id="prTitle" value="${esc(v.title)}" maxlength="120"></label>
      <label class="field"><span>Артикул</span><input class="input" id="prSku" value="${esc(v.sku || '')}" maxlength="40"></label></div>
      <div class="seg" id="prOwn"><button type="button" data-own="1" class="${!v.seller ? 'on' : ''}">Свой склад</button><button type="button" data-own="0" class="${v.seller ? 'on' : ''}">Товар продавца</button></div>
      <div class="grid3">
        <label class="field"><span>Цена, ₽</span><input class="input num" id="prPrice" inputmode="decimal" value="${esc(v.price)}"></label>
        <label class="field" data-own-f><span>Себестоимость, ₽</span><input class="input num" id="prCost" inputmode="decimal" value="${esc(v.cost || '')}"></label>
        <label class="field" data-own-f><span>Остаток, шт.</span><input class="input num" id="prStock" inputmode="numeric" value="${isSet(v.stock) ? esc(v.stock) : ''}"></label>
        <label class="field" data-sel-f><span>Продавец</span><input class="input" id="prSeller" list="prSellers" value="${esc(v.seller || '')}" maxlength="80"><datalist id="prSellers">${sellers.map(n => `<option value="${esc(n)}">`).join('')}</datalist></label>
        <label class="field" data-sel-f><span>Комиссия клуба, %</span><input class="input num" id="prFee" inputmode="decimal" value="${esc(v.fee)}"></label>
      </div>`,
    foot: `${p ? `<button class="btn danger left" id="prDel">${icon('trash')}Удалить</button>` : ''}<button class="btn" data-close>Отмена</button><button class="btn primary" id="prSave">Сохранить</button>`,
    onMount(el, close) {
      let own = !v.seller;
      const sync = () => { $$('[data-own-f]', el).forEach(x => { x.hidden = !own; }); $$('[data-sel-f]', el).forEach(x => { x.hidden = own; }); $$('[data-own]', el).forEach(b => b.classList.toggle('on', (b.dataset.own === '1') === own)); };
      on(el, 'click', '[data-own]', (e, b) => { own = b.dataset.own === '1'; sync(); });
      sync();
      $('#prSave', el).onclick = () => {
        const title = $('#prTitle', el).value.trim();
        if (!title) { $('#prTitle', el).focus(); return; }
        const seller = own ? '' : $('#prSeller', el).value.trim();
        if (!own && !seller) { $('#prSeller', el).focus(); toast('Чей товар? Укажите продавца'); return; }
        const st = $('#prStock', el).value.trim();
        const data = {title, sku: $('#prSku', el).value.trim(), price: parseNum($('#prPrice', el).value), seller,
          cost: own ? parseNum($('#prCost', el).value) : 0, stock: own && st !== '' ? Math.round(parseNum(st)) : null, fee: own ? 0 : parseNum($('#prFee', el).value)};
        if (p) Store.put('products', p.id, {...p, ...data}); else Store.add('products', {...data, at: Date.now()});
        close();
      };
      const del = $('#prDel', el);
      if (del) del.onclick = async () => {
        if (!(await confirmPop(del, {text: 'Удалить товар из каталога? В старых заказах он останется.', yes: 'Удалить', danger: true}))) return;
        Store.remove('products', p.id);
        close();
      };
    },
  });
}
function splitHtml() {
  const months = finMonths(), m = months.includes(View.get('fin.splitm', '')) ? View.get('fin.splitm', '') : months[months.length - 1];
  const x = Market.split(m), cur = monthOf(today()), ops = finOps();
  return `<section class="section">
    <div class="section-head"><h2>Распределение выручки — ${monthName(m).toLowerCase()}</h2><span class="hint-inline">Кому сколько из оплаченных заказов месяца: клубу — маржа своих товаров, комиссия с продавцов и доставка; продавцам — их доля.</span>
      <select class="select sm" id="splitM">${monthOpts(m, months)}</select></div>
    <div class="cards tiles">
      ${finTile('Оборот', rubK(x.revenue), `${fmt(x.orders.length)} оплаченных заказов`)}
      ${finTile('Свои товары: маржа', rubK(x.own.rev - x.own.cost), `выручка ${rubK(x.own.rev)} − себестоимость ${rubK(x.own.cost)}`)}
      ${finTile('Комиссия клуба', rubK(sum(x.sellers, s => s.fee)), `с оборота продавцов ${rubK(sum(x.sellers, s => s.turnover))}`)}
      ${finTile('Итого клубу', rubK(x.club), `${x.shipping ? `с доставкой ${rubK(x.shipping)} · ` : ''}продавцам ${rubK(x.toSellers)}`)}
    </div>
    ${x.sellers.length ? `<div class="table-wrap section"><table class="t"><thead><tr><th>Продавец</th><th class="r">Позиций</th><th class="r">Оборот</th><th class="r">Комиссия клуба</th><th class="r">К выплате</th><th>Статус</th></tr></thead>
      <tbody>${x.sellers.map(s => { const id = Fin.sellerId(s.seller, m), p = Store.get('payouts', id), paid = p && p.status === 'paid';
        return `<tr><td><b>${esc(s.seller)}</b></td><td class="r">${fmt(s.orders)}</td><td class="r nowrap">${rub(Math.round(s.turnover))}</td><td class="r nowrap">${rub(Math.round(s.fee))}</td><td class="r nowrap"><b>${rub(Math.round(s.payout))}</b></td>
          <td class="nowrap">${paid ? `<span class="pill good">выплачено ${dayShort(p.paidAt)}</span>${ops ? ` <button class="btn xs ghost" data-unpay-x="${esc(id)}">Отменить</button>` : ''}` : m < cur ? (ops ? `<button class="btn xs primary" data-pay-x="${esc(id)}">Выплатить</button>` : '<span class="pill warn">к выплате</span>') : '<span class="pill line">начисляется</span>'}</td></tr>`; }).join('')}</tbody></table></div>`
      : '<p class="note section">Товаров продавцов в оплаченных заказах этого месяца нет.</p>'}
  </section>`;
}

/* ── сбои оплат ── */
function finFailedHtml() {
  const all = Fin.failed(), cur = monthOf(today());
  const f = View.get('fin.failf', 'open');
  const list = all.filter(x => (f === 'open' ? Fin.failOpen(x) : f === 'all' ? true : (x.status || 'new') === f));
  const month = all.filter(x => monthOf(x.date || '') === cur);
  const rec = month.filter(x => x.status === 'paid'), lost = month.filter(x => x.status === 'lost');
  const open = all.filter(x => Fin.failOpen(x));
  const reasons = Object.entries(FAIL_REASONS).map(([k, n]) => [n, month.filter(x => (x.reason || 'other') === k).length]).filter(x => x[1]);
  return `<div class="cards tiles">
      ${finTile('Открыто', fmt(open.length), `на ${rub(sum(open, x => x.amount))}`)}
      ${finTile('Действие сегодня', `<span class="${all.some(x => Fin.failDue(x)) ? 'bad' : ''}">${fmt(all.filter(x => Fin.failDue(x)).length)}</span>`, 'новые и с наступившим шагом')}
      ${finTile('Вернули оплату', fmt(rec.length), `${rub(sum(rec, x => x.amount))} · ${month.length ? pct(rec.length / month.length) : '—'} сбоев месяца`)}
      ${finTile('Потеряно за месяц', fmt(lost.length), rub(sum(lost, x => x.amount)))}
    </div>
    ${reasons.length ? `<div class="fin-reasons"><span class="label">Причины за ${monthName(cur).toLowerCase()}</span>${reasons.map(([n, k]) => `<span class="chip">${esc(n)} <b>${k}</b></span>`).join('')}</div>` : ''}
    <section class="section">
      <div class="section-head"><h2>Неудавшиеся платежи</h2>${finSeg('failf', [['open', 'Открытые'], ['paid', 'Оплачено'], ['lost', 'Потеряно'], ['all', 'Все']], f)}
        <span class="row"><button class="btn sm primary" data-fail-add>${icon('plus')}Сбой оплаты</button>${finCsvBtn('failed')}</span></div>
      ${list.length ? `<div class="table-wrap"><table class="t fail-t">
        <thead><tr><th>Дата</th><th>Клиент</th><th class="r">Сумма</th><th>Причина</th><th class="r">Попыток</th><th>Статус</th><th>Следующий шаг</th><th>Ответственный</th></tr></thead>
        <tbody>${list.map(x => { const due = Fin.failDue(x); const who = personById(x.who);
          return `<tr class="click ${due ? 'due-row' : ''}" data-fail="${x.id}"><td class="nowrap">${dayShort(x.date || today())}</td>
            <td><b>${esc(x.client || '—')}</b>${x.contact ? `<small class="block">${contactHtml(x.contact)}</small>` : ''}</td>
            <td class="r nowrap"><b>${rub(Number(x.amount) || 0)}</b><small class="block">${x.plan === 'year' ? 'годовая' : 'месячная'}</small></td>
            <td>${esc(FAIL_REASONS[x.reason] || FAIL_REASONS.other)}</td><td class="r">${fmt(Number(x.attempts) || 0)}</td>
            <td>${finPill(x.status || 'new', FAIL_ST)}</td>
            <td class="nowrap">${Fin.failOpen(x) && x.next ? `<span class="${x.next <= today() ? 'bad' : ''}">${x.next === today() ? 'сегодня' : dayShort(x.next)}</span>` : ''}</td>
            <td class="nowrap">${who ? `${avatar(who, 'xs')} ${esc(firstName(who))}` : ''}</td></tr>`; }).join('')}</tbody></table></div>`
        : `<div class="empty"><b>${f === 'open' ? 'Открытых сбоев нет' : 'Записей нет'}</b>Сбой оплаты — когда списание за подписку не прошло: не хватило денег, банк отклонил, карта просрочена. Запишите его, чтобы вернуть подписчика.</div>`}
      <p class="note">Как работать: «Написали клиенту» — отправьте готовое сообщение из карточки; «Повторное списание» — ставьте дату следующей попытки; «Оплачено» — подписчик вернулся (можно сразу добавить продление в «Цифры дня»).</p>
    </section>`;
}
function failMessage(x) {
  const name = String(x.client || '').split(' ')[0];
  const why = {funds: 'на карте не хватило средств', bank: 'банк отклонил платёж', card: 'карта просрочена или заблокирована', tds: 'платёж не подтвердился', limit: 'по карте превышен лимит'}[x.reason] || 'платёж не прошёл';
  return `${name ? name + ', здравствуйте' : 'Здравствуйте'}! Это Eva Club. Не получилось продлить вашу подписку — ${why}. Чтобы доступ к мастер-классам не прервался, обновите способ оплаты в приложении или ответьте на это сообщение — поможем. Спасибо, что вы с нами!`;
}
function editFailed(id) {
  const x = id ? Store.get('failed', id) : null, s = settings();
  const v = x || {date: today(), client: '', contact: '', amount: s.price, plan: 'month', reason: 'funds', attempts: 1, status: 'new', next: addDays(today(), 1), who: Auth.personId() || '', note: ''};
  openModal({
    title: x ? 'Сбой оплаты' : 'Новый сбой оплаты',
    wide: true,
    body: `<div class="grid3">
        <label class="field"><span>Дата сбоя</span><input class="input" type="date" id="flDate" value="${esc(v.date)}"></label>
        <label class="field"><span>Клиент</span><input class="input" id="flClient" value="${esc(v.client || '')}" maxlength="80"></label>
        <label class="field"><span>Контакт</span><input class="input" id="flContact" value="${esc(v.contact || '')}" maxlength="80" placeholder="почта, телефон или @telegram"></label>
        <label class="field"><span>Сумма, ₽</span><input class="input num" id="flAmount" inputmode="decimal" value="${esc(v.amount)}"></label>
        <label class="field"><span>Подписка</span><select class="select" id="flPlan"><option value="month" ${v.plan !== 'year' ? 'selected' : ''}>Месячная</option><option value="year" ${v.plan === 'year' ? 'selected' : ''}>Годовая</option></select></label>
        <label class="field"><span>Причина</span><select class="select" id="flReason">${Object.entries(FAIL_REASONS).map(([k, n]) => `<option value="${k}" ${k === v.reason ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="field"><span>Попыток списания</span><input class="input num" id="flAttempts" inputmode="numeric" value="${esc(v.attempts || 0)}"></label>
        <label class="field"><span>Статус</span><select class="select" id="flStatus">${Object.entries(FAIL_ST).map(([k, st]) => `<option value="${k}" ${k === (v.status || 'new') ? 'selected' : ''}>${st.name}</option>`).join('')}</select></label>
        <label class="field"><span>Следующий шаг</span><input class="input" type="date" id="flNext" value="${esc(v.next || '')}"></label>
        <label class="field"><span>Ответственный</span>${whoSel('flWho', v.who)}</label>
        <label class="field fin-span2"><span>Комментарий</span><input class="input" id="flNote" value="${esc(v.note || '')}" maxlength="200"></label>
      </div>
      <label class="check" id="flSalesBox" hidden><input type="checkbox" id="flSales" checked> Добавить продление в «Цифры дня» за сегодня (+1)</label>
      <div class="fin-msg"><span class="label">Сообщение клиенту</span><p id="flMsg"></p><div class="row"><button type="button" class="btn xs" id="flCopy">${icon('copy')}Скопировать</button><span id="flTg"></span></div></div>
      ${logHtml(x)}`,
    foot: `${x ? `<button class="btn danger left" id="flDel">${icon('trash')}Удалить</button><button class="btn ghost" id="flTask" title="Поручить человеку задачей">${icon('check')}Задача</button>` : ''}<button class="btn" data-close>Отмена</button><button class="btn primary" id="flSave">Сохранить</button>`,
    onMount(el, close) {
      const cur = () => ({client: $('#flClient', el).value.trim(), reason: $('#flReason', el).value});
      const paint = () => {
        $('#flMsg', el).textContent = failMessage(cur());
        const tg = normTg($('#flContact', el).value);
        $('#flTg', el).innerHTML = tg ? `<a class="btn xs ghost" href="${esc(tgUrl(tg))}" target="_blank" rel="noopener" data-fl-tg>${icon('ext')}Открыть чат</a>` : '';
        $('#flSalesBox', el).hidden = !($('#flStatus', el).value === 'paid' && (!x || x.status !== 'paid'));
      };
      ['#flClient', '#flContact'].forEach(q => $(q, el).addEventListener('input', paint));
      ['#flReason', '#flStatus'].forEach(q => $(q, el).addEventListener('change', paint));
      paint();
      $('#flCopy', el).onclick = e => copyText($('#flMsg', el).textContent, e.currentTarget);
      on(el, 'click', '[data-fl-tg]', () => copyText($('#flMsg', el).textContent));
      $('#flSave', el).onclick = () => {
        const amount = parseNum($('#flAmount', el).value);
        if (!$('#flClient', el).value.trim() && !$('#flContact', el).value.trim()) { $('#flClient', el).focus(); toast('Укажите клиента или контакт'); return; }
        const status = $('#flStatus', el).value;
        const data = {date: $('#flDate', el).value || today(), client: $('#flClient', el).value.trim(), contact: $('#flContact', el).value.trim(), amount, plan: $('#flPlan', el).value,
          reason: $('#flReason', el).value, attempts: Math.max(0, Math.round(parseNum($('#flAttempts', el).value))), status, next: $('#flNext', el).value || null, who: $('#flWho', el).value || null, note: $('#flNote', el).value.trim()};
        if (x) {
          const changed = x.status !== status;
          Store.patch('failed', x.id, {...data, ...(status === 'paid' && changed ? {paidAt: today()} : {}), ...(changed ? {log: finLog(`статус: ${FAIL_ST[status].name.toLowerCase()}`)} : {})});
        } else Store.add('failed', {...data, by: Tasks.meKey(), at: Date.now(), log: finLog('записан сбой оплаты'), ...(status === 'paid' ? {paidAt: today()} : {})});
        if (status === 'paid' && (!x || x.status !== 'paid') && $('#flSales', el).checked && Auth.can('sales.edit')) {
          const d = Sales.day(today()) || {};
          Store.put('sales', today(), {...d, renewals: (Number(d.renewals) || 0) + 1, by: Tasks.meKey(), at: Date.now()});
          toast('Оплата вернулась — +1 продление в «Цифрах дня»');
        }
        close();
      };
      const del = $('#flDel', el);
      if (del) del.onclick = async () => { if (await confirmPop(del, {text: 'Удалить запись о сбое?', yes: 'Удалить', danger: true})) { Store.remove('failed', x.id); close(); } };
      const task = $('#flTask', el);
      if (task) task.onclick = () => { close(); openTask(null, {defaults: {title: `Сбой оплаты: ${x.client || x.contact}`, desc: `${FAIL_REASONS[x.reason] || ''}, ${rub(Number(x.amount) || 0)}. Контакт: ${x.contact || '—'}. Вернуть подписчика.`, assignee: x.who || Auth.personId(), dir: 'ops'}}); };
    },
  });
}

/* ── возвраты ── */
function finRefundsHtml() {
  const all = Fin.refunds(), cur = monthOf(today());
  const f = View.get('fin.reff', 'open');
  const list = all.filter(x => (f === 'open' ? Fin.refundOpen(x) : f === 'all' ? true : (x.status || 'new') === f));
  const open = all.filter(x => Fin.refundOpen(x)), late = open.filter(x => Fin.refundLate(x));
  const done = Fin.refundsIn(cur), rate = Subs.rate();
  return `<div class="cards tiles">
      ${finTile('Открытые запросы', fmt(open.length), `на ${rub(sum(open, x => x.amount))}`)}
      ${finTile('Просрочено', `<span class="${late.length ? 'bad' : ''}">${fmt(late.length)}</span>`, `ответ и возврат — за ${REFUND_DAYS} дней`)}
      ${finTile(`Возвращено за ${monthName(cur).toLowerCase()}`, fmt(done.n), rub(done.sum))}
      ${finTile('Возвраты подписок', pctOr(rate && rate.refund, 1), 'от всех оплат подписки')}
    </div>
    <section class="section">
      <div class="section-head"><h2>Запросы на возврат</h2>${finSeg('reff', [['open', 'Открытые'], ['refunded', 'Возвращено'], ['rejected', 'Отказано'], ['all', 'Все']], f)}
        <span class="row"><button class="btn sm primary" data-refund-add>${icon('plus')}Запрос на возврат</button>${finCsvBtn('refunds')}</span></div>
      ${list.length ? `<div class="table-wrap"><table class="t ref-t">
        <thead><tr><th>Получен</th><th>Клиент</th><th>Что</th><th class="r">Сумма</th><th>Причина</th><th>Ответить до</th><th>Статус</th><th>Ответственный</th></tr></thead>
        <tbody>${list.map(x => { const lateX = Fin.refundLate(x), who = personById(x.who), left = x.deadline ? daysBetween(today(), x.deadline) : null;
          return `<tr class="click ${lateX ? 'due-row' : ''}" data-refund="${x.id}"><td class="nowrap">${dayShort(x.date || today())}</td>
            <td><b>${esc(x.client || '—')}</b>${x.contact ? `<small class="block">${contactHtml(x.contact)}</small>` : ''}</td>
            <td>${esc(REFUND_PRODUCTS[x.product || 'sub'])}${x.what ? `<small class="block">${esc(x.what)}</small>` : ''}</td>
            <td class="r nowrap"><b>${rub(Number(x.amount) || 0)}</b></td><td>${esc(x.reason || '')}</td>
            <td class="nowrap">${Fin.refundOpen(x) && x.deadline ? `<span class="${lateX ? 'bad' : left <= 2 ? 'warn-t' : ''}">${dayShort(x.deadline)}</span><small class="block ${lateX ? 'bad' : ''}">${lateX ? `просрочено на ${-left} ${plural(-left, 'день', 'дня', 'дней')}` : left === 0 ? 'сегодня' : `осталось ${left} ${plural(left, 'день', 'дня', 'дней')}`}</small>` : x.refundedAt ? `<small>возвращено ${dayShort(x.refundedAt)}</small>` : ''}</td>
            <td>${finPill(x.status || 'new', REFUND_ST)}</td><td class="nowrap">${who ? `${avatar(who, 'xs')} ${esc(firstName(who))}` : ''}</td></tr>`; }).join('')}</tbody></table></div>`
        : `<div class="empty"><b>${f === 'open' ? 'Открытых запросов нет' : 'Записей нет'}</b>Запрос на возврат — когда клиент просит вернуть деньги за подписку, курс или товар. У каждого — срок ответа ${REFUND_DAYS} дней, статус и ответственный.</div>`}
      <p class="note">«Возвращено» — расход «Возвраты клиентам» сам ляжет в журнал, а по заказу маркетплейса заказ перейдёт в «Возврат» и товар вернётся на склад. Возвраты подписок учитываются в «Подписках».</p>
    </section>`;
}
function refundMessage(x, status) {
  const name = String(x.client || '').split(' ')[0];
  const hi = name ? `${name}, здравствуйте` : 'Здравствуйте';
  if (status === 'rejected') return `${hi}! Это Eva Club. Мы рассмотрели ваш запрос на возврат и, к сожалению, не можем его выполнить${x.decision ? ': ' + x.decision : ''}. Если остались вопросы — ответьте на это сообщение, разберёмся вместе.`;
  if (status === 'refunded') return `${hi}! Это Eva Club. Вернули ${rub(Number(x.amount) || 0)} на вашу карту — деньги придут в течение нескольких дней, в зависимости от банка. Будем рады видеть вас снова!`;
  return `${hi}! Это Eva Club. Получили ваш запрос на возврат ${rub(Number(x.amount) || 0)} — рассмотрим и ответим до ${x.deadline ? dayLong(x.deadline) : 'конца недели'}.`;
}
function editRefund(id) {
  const x = id ? Store.get('refunds', id) : null, s = settings();
  const v = x || {date: today(), client: '', contact: '', product: 'sub', what: '', courseId: '', orderId: '', amount: s.price, reason: REFUND_REASONS[0], comment: '', status: 'new', who: Auth.personId() || '', decision: ''};
  const orders = Fin.orders().filter(o => o.pay === 'paid' || o.id === v.orderId).slice(0, 60);
  openModal({
    title: x ? 'Запрос на возврат' : 'Новый запрос на возврат',
    wide: true,
    body: `<div class="grid3">
        <label class="field"><span>Получен</span><input class="input" type="date" id="rqDate" value="${esc(v.date)}"><small id="rqDl"></small></label>
        <label class="field"><span>Клиент</span><input class="input" id="rqClient" value="${esc(v.client || '')}" maxlength="80"></label>
        <label class="field"><span>Контакт</span><input class="input" id="rqContact" value="${esc(v.contact || '')}" maxlength="80" placeholder="почта, телефон или @telegram"></label>
        <label class="field"><span>Что возвращаем</span><select class="select" id="rqProduct">${Object.entries(REFUND_PRODUCTS).map(([k, n]) => `<option value="${k}" ${k === (v.product || 'sub') ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="field" data-rq="course"><span>Курс</span><select class="select" id="rqCourse"><option value="">—</option>${Fin.courses().map(c => `<option value="${c.id}" ${c.id === v.courseId ? 'selected' : ''}>${esc(c.title)}</option>`).join('')}</select></label>
        <label class="field" data-rq="market"><span>Заказ</span><select class="select" id="rqOrder"><option value="">—</option>${orders.map(o => `<option value="${o.id}" ${o.id === v.orderId ? 'selected' : ''}>№${o.no} · ${esc(o.customer || '')} · ${rub(Fin.orderTotal(o))}</option>`).join('')}</select></label>
        <label class="field" data-rq="other"><span>Уточнение</span><input class="input" id="rqWhat" value="${esc(v.what || '')}" maxlength="80"></label>
        <label class="field"><span>Сумма, ₽</span><input class="input num" id="rqAmount" inputmode="decimal" value="${esc(v.amount)}"></label>
        <label class="field"><span>Причина</span><select class="select" id="rqReason">${REFUND_REASONS.map(r => `<option ${r === v.reason ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
        <label class="field"><span>Статус</span><select class="select" id="rqStatus">${Object.entries(REFUND_ST).map(([k, st]) => `<option value="${k}" ${k === (v.status || 'new') ? 'selected' : ''}>${st.name}</option>`).join('')}</select></label>
        <label class="field"><span>Ответственный</span>${whoSel('rqWho', v.who)}</label>
        <label class="field fin-span2"><span>Что пишет клиент</span><input class="input" id="rqComment" value="${esc(v.comment || '')}" maxlength="300"></label>
        <label class="field fin-span2"><span>Решение и пояснение</span><input class="input" id="rqDecision" value="${esc(v.decision || '')}" maxlength="300" placeholder="Обязательно при отказе"></label>
      </div>
      <div class="fin-msg"><span class="label">Ответ клиенту</span><p id="rqMsg"></p><div class="row"><button type="button" class="btn xs" id="rqCopy">${icon('copy')}Скопировать</button><span id="rqTg"></span></div></div>
      ${logHtml(x)}`,
    foot: `${x ? `<button class="btn danger left" id="rqDel">${icon('trash')}Удалить</button><button class="btn ghost" id="rqTask">${icon('check')}Задача</button>` : ''}<button class="btn" data-close>Отмена</button><button class="btn primary" id="rqSave">Сохранить</button>`,
    onMount(el, close) {
      const dl = () => addDays($('#rqDate', el).value || today(), REFUND_DAYS);
      const paint = () => {
        const prod = $('#rqProduct', el).value;
        $$('[data-rq]', el).forEach(f => { f.hidden = f.dataset.rq !== prod && !(f.dataset.rq === 'other' && prod === 'sub'); });
        $('#rqDl', el).textContent = `ответить до ${dayLong(dl())}`;
        $('#rqMsg', el).textContent = refundMessage({client: $('#rqClient', el).value, amount: parseNum($('#rqAmount', el).value), deadline: dl(), decision: $('#rqDecision', el).value.trim()}, $('#rqStatus', el).value);
        const tg = normTg($('#rqContact', el).value);
        $('#rqTg', el).innerHTML = tg ? `<a class="btn xs ghost" href="${esc(tgUrl(tg))}" target="_blank" rel="noopener" data-rq-tg>${icon('ext')}Открыть чат</a>` : '';
      };
      on(el, 'input', 'input', paint);
      on(el, 'change', 'select, input[type=date]', paint);
      on(el, 'change', '#rqOrder', (e, s) => { const o = Store.get('orders', s.value); if (o) { $('#rqAmount', el).value = Fin.orderTotal(o); if (!$('#rqClient', el).value) $('#rqClient', el).value = o.customer || ''; if (!$('#rqContact', el).value) $('#rqContact', el).value = o.contact || ''; paint(); } });
      on(el, 'change', '#rqCourse', (e, s) => { const c = Store.get('courses', s.value); if (c && c.price) { $('#rqAmount', el).value = c.price; paint(); } });
      paint();
      $('#rqCopy', el).onclick = e => copyText($('#rqMsg', el).textContent, e.currentTarget);
      on(el, 'click', '[data-rq-tg]', () => copyText($('#rqMsg', el).textContent));
      $('#rqSave', el).onclick = () => {
        const status = $('#rqStatus', el).value, product = $('#rqProduct', el).value;
        if (!$('#rqClient', el).value.trim() && !$('#rqContact', el).value.trim()) { $('#rqClient', el).focus(); toast('Укажите клиента или контакт'); return; }
        if (status === 'rejected' && !$('#rqDecision', el).value.trim()) { $('#rqDecision', el).focus(); toast('При отказе напишите пояснение — клиенту и для истории'); return; }
        const amount = parseNum($('#rqAmount', el).value);
        const data = {date: $('#rqDate', el).value || today(), deadline: dl(), client: $('#rqClient', el).value.trim(), contact: $('#rqContact', el).value.trim(), product,
          courseId: product === 'course' ? $('#rqCourse', el).value || null : null, orderId: product === 'market' ? $('#rqOrder', el).value || null : null,
          what: $('#rqWhat', el).value.trim(), amount, reason: $('#rqReason', el).value, comment: $('#rqComment', el).value.trim(), status, who: $('#rqWho', el).value || null, decision: $('#rqDecision', el).value.trim()};
        const was = x ? x.status || 'new' : null;
        let rid;
        if (x) { rid = x.id; Store.patch('refunds', rid, {...data, ...(was !== status ? {log: finLog(`статус: ${REFUND_ST[status].name.toLowerCase()}`)} : {})}); }
        else rid = Store.add('refunds', {...data, by: Tasks.meKey(), at: Date.now(), log: finLog('получен запрос на возврат')});
        refundMoney(rid, was, status);
        close();
        if (status === 'refunded' && was !== 'refunded') toast(`Возвращено ${rub(amount)} — расход в журнале`);
      };
      const del = $('#rqDel', el);
      if (del) del.onclick = async () => {
        if (!(await confirmPop(del, {text: x.status === 'refunded' ? 'Удалить запрос? Расход по возврату уйдёт из журнала.' : 'Удалить запрос на возврат?', yes: 'Удалить', danger: true}))) return;
        refundMoney(x.id, x.status, 'deleted');
        Store.remove('refunds', x.id);
        close();
      };
      const task = $('#rqTask', el);
      if (task) task.onclick = () => { close(); openTask(null, {defaults: {title: `Возврат: ${x.client || x.contact}`, desc: `${REFUND_PRODUCTS[x.product || 'sub']}, ${rub(Number(x.amount) || 0)}. Причина: ${x.reason || '—'}. Ответить до ${x.deadline ? dayLong(x.deadline) : '—'}.`, assignee: x.who || Auth.personId(), due: x.deadline || '', dir: 'ops'}}); };
    },
  });
}
/* деньги по возврату: «Возвращено» — расход в журнал (по заказу — через заказ), отмена — обратно */
function refundMoney(rid, was, status) {
  const x = Store.get('refunds', rid);
  if (!x) return;
  const now = status === 'refunded', before = was === 'refunded';
  if (now === before) return;
  if (x.product === 'market' && x.orderId && Store.get('orders', x.orderId)) {
    Market.setPay(x.orderId, now ? 'refund' : 'paid');
  } else if (now) {
    const lid = Store.add('ledger', {kind: 'out', amount: Number(x.amount) || 0, cat: 'refunds', date: today(), note: `Возврат: ${x.client || x.contact || ''} · ${REFUND_PRODUCTS[x.product || 'sub']}`, refundId: rid, by: Tasks.meKey(), at: Date.now()});
    Store.patch('refunds', rid, {ledgerId: lid});
  } else Store.all('ledger').filter(e => e.refundId === rid).forEach(e => Store.remove('ledger', e.id));
  if (status !== 'deleted') Store.patch('refunds', rid, {refundedAt: now ? today() : null});
}

/* ── события вкладки ── */
function wireFin(root) {
  on(root, 'click', '[data-fin-go]', (e, el) => {
    View.set('fin.tab', el.dataset.finGo);
    App.render();
    const tabs = $('.fin-tabs');
    if (tabs && tabs.getBoundingClientRect().top < 0) tabs.scrollIntoView({block: 'start'});
  });
  on(root, 'click', '[data-fseg]', (e, el) => { const [k, v] = el.dataset.fseg.split(':'); View.set('fin.' + k, v); App.render(); });
  on(root, 'click', '[data-fin-csv]', async (e, el) => {
    const k = el.dataset.finCsv, name = `eva-hq-${k}-${today()}.csv`;
    if (await Portable.save(name, Portable[k + 'Csv']())) toast(`Файл ${name} — сохранён`);
  });
  /* подписки и выплаты */
  on(root, 'click', '[data-subs-edit]', (e, el) => editSubs(el.dataset.subsEdit));
  on(root, 'click', '[data-ref-add]', () => editRef(null));
  on(root, 'click', '[data-ref-edit]', (e, el) => editRef(el.dataset.refEdit));
  const accOf = id => Fin.accruals().find(x => x.id === id);
  on(root, 'click', '[data-pay-x]', async (e, el) => {
    const a = accOf(el.dataset.payX);
    if (!a || !(await confirmPop(el, {text: `Выплатить ${rub(a.amount)} — ${a.to}? Расход попадёт в журнал.`, yes: 'Да, выплачено'}))) return;
    Fin.pay(a);
    toast(`Выплачено: ${a.to} — ${rub(a.amount)}`);
  });
  on(root, 'click', '[data-unpay-x]', async (e, el) => {
    const a = accOf(el.dataset.unpayX);
    if (!a || !(await confirmPop(el, {text: 'Отменить выплату? Расход уйдёт из журнала.', yes: 'Да, отменить', danger: true}))) return;
    Fin.unpay(a);
  });
  /* курсы */
  on(root, 'click', '[data-course-add]', () => editCourse(null));
  on(root, 'click', '[data-course-edit]', (e, el) => editCourse(el.dataset.courseEdit));
  on(root, 'change', '[data-cs]', (e, el) => {
    const [cid, m] = el.dataset.cs.split(':');
    Store.patch('courses', cid, {sales: {[m]: {n: Math.max(0, Math.round(parseNum(el.value)))}}}, {mustExist: true});
    syncCourseLedger(m);
  });
  on(root, 'click', '[data-course-led]', (e, el) => {
    const m = el.dataset.courseLed, total = sum(Fin.courses(), c => Fin.courseSale(c, m).revenue);
    if (!total) return;
    Store.add('ledger', {kind: 'in', amount: total, cat: 'courses', date: m === monthOf(today()) ? today() : monthEnd(m), note: `Курсы · ${monthName(m).toLowerCase()}`, courseMonth: m, by: Tasks.meKey(), at: Date.now()});
    toast(`Выручка курсов за ${monthName(m).toLowerCase()} — в журнале: +${rub(total)}`);
  });
  /* маркетплейс */
  on(root, 'click', '[data-order-add]', () => editOrder(null));
  on(root, 'click', '[data-order]', (e, el) => { if (!e.target.closest('[data-stop], a, select')) editOrder(el.dataset.order); });
  on(root, 'change', '[data-ord-pay]', (e, el) => { Market.setPay(el.dataset.ordPay, el.value); toast(`Заказ: ${ORDER_PAY[el.value].name.toLowerCase()}${el.value === 'paid' ? ' — приход в журнале' : el.value === 'refund' ? ' — расход «Возвраты клиентам» в журнале' : ''}`); });
  on(root, 'change', '[data-ord-del]', (e, el) => Market.setDelivery(el.dataset.ordDel, el.value));
  on(root, 'click', '[data-product-add]', () => editProduct(null));
  on(root, 'click', '[data-product]', (e, el) => editProduct(el.dataset.product));
  on(root, 'change', '[data-stock]', (e, el) => Store.patch('products', el.dataset.stock, {stock: el.value.trim() === '' ? null : Math.round(parseNum(el.value))}, {mustExist: true}));
  const sm = $('#splitM', root);
  if (sm) sm.onchange = () => { View.set('fin.splitm', sm.value); App.render(); };
  /* сбои и возвраты */
  on(root, 'click', '[data-fail-add]', () => editFailed(null));
  on(root, 'click', '[data-fail]', (e, el) => { if (!e.target.closest('a')) editFailed(el.dataset.fail); });
  on(root, 'click', '[data-refund-add]', () => editRefund(null));
  on(root, 'click', '[data-refund]', (e, el) => { if (!e.target.closest('a')) editRefund(el.dataset.refund); });
}

/* новые возвраты, сбои и заказы от коллег — звук и уведомление тем, кто ведёт финансы */
const FinNotify = {
  since: 0,
  wired: false,
  init() {
    if (this.wired) return;
    this.wired = true;
    this.since = Date.now() - 2000;
    Store.subscribe(c => { if (['refunds', 'failed', 'orders'].includes(c)) setTimeout(() => this.check(), 40); });
  },
  check() {
    if (!Auth.me() || !finOps()) return [];
    const me = Tasks.meKey();
    const fresh = [
      ...Store.all('refunds').map(x => ({c: 'refunds', x, text: `Запрос на возврат: ${x.client || x.contact || 'клиент'} — ${rub(Number(x.amount) || 0)}`, tab: 'refunds'})),
      ...Store.all('failed').map(x => ({c: 'failed', x, text: `Сбой оплаты: ${x.client || x.contact || 'клиент'} — ${FAIL_REASONS[x.reason] || 'платёж не прошёл'}`, tab: 'failed'})),
      ...Store.all('orders').map(x => ({c: 'orders', x, text: `Новый заказ №${x.no}: ${rub(Fin.orderTotal(x))}`, tab: 'market'})),
    ].filter(e => (e.x.at || 0) > this.since && e.x.by && e.x.by !== me);
    if (!fresh.length) return [];
    this.since = Math.max(this.since, ...fresh.map(e => e.x.at || 0));
    Sound.play(fresh.some(e => e.c === 'refunds') ? 'control' : 'task');
    fresh.slice(-3).forEach(e => toast(e.text, {ring: true, action: {label: 'Открыть', fn: () => { View.set('fin.tab', e.tab); App.go('money'); }}}));
    return fresh;
  },
};
