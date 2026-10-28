/* Продажи — после кастдева: кто зарегистрировался в Еве, купил, продлил или ушёл и почему.
   • Данные в карточке: sale = {reg: дата регистрации, pays: [{id, at, plan, amount, until}],
     churn: {reason, note, at}, likes, dislikes, engage: high | mid | low}. Связи с оплатами приложения
     нет — оплаты вносит команда (по одной или списком из таблицы).
   • Вкладки: Дашборд (воронка, выручка, ожидаемые продления, причины), Клиенты, Группы (10 готовых
     + свои), Рассылки (по группе; Telegram, WhatsApp или список для приложения Евы; отметки «отправлено»). */

const SALE_PLANS = [['month', 'Месяц', 1], ['3m', '3 месяца', 3], ['6m', 'Полгода', 6], ['year', 'Год', 12]];
const salePlan = k => SALE_PLANS.find(x => x[0] === k) || SALE_PLANS[0];
const CHURN_REASONS = ['Дорого', 'Нет времени', 'Не нашла нужного', 'Неудобно пользоваться', 'Технические проблемы', 'Ушла в другое приложение', 'Нужна пауза', 'Другое'];
const ENGAGE = [['high', 'Часто пользуется'], ['mid', 'Иногда'], ['low', 'Почти не заходит']];
const SALE_ST = {reg: ['Зарегистрирована, не купила', 'warn'], trial: ['Доступ в подарок, не купила', 'violet'], paid: ['Купила', 'good'], renewed: ['Продлила', 'good'], churn: ['Не продлила', 'bad']};
/* дата + n месяцев (addMonths в 00-core — для строк «2026-10») */
const plusMonths = (ts, n) => { const d = new Date(ts); d.setMonth(d.getMonth() + n); return d.getTime(); };
const monthKey = ts => isoTs(ts).slice(0, 7);

const Sales = {
  pays(p) { return ((p.sale || {}).pays || []).filter(x => x && x.at).slice().sort((a, b) => a.at - b.at); },
  in(p) { return !!(p.sale && (p.sale.reg || Sales.pays(p).length)); },
  people() { return Store.all('people').filter(Sales.in); },
  until(p) { const ps = Sales.pays(p); return ps.length ? Math.max(...ps.map(x => x.until || 0)) : null; },
  last(p) { const ps = Sales.pays(p); return ps[ps.length - 1] || null; },
  status(p) {
    if (!p.sale) return null;
    const ps = Sales.pays(p);
    if (!ps.length) return p.sale.reg ? (accessOn(p) ? 'trial' : 'reg') : null;
    if (Sales.until(p) > Date.now()) return ps.length > 1 ? 'renewed' : 'paid';
    return 'churn';
  },
  active(p) { return ['paid', 'renewed'].includes(Sales.status(p)); },
  label(p) { const s = Sales.status(p); return s ? SALE_ST[s][0] : ''; },
  chip(p) { const s = Sales.status(p); return s ? stChip(SALE_ST[s][1], SALE_ST[s][0]) : ''; },
  soon(p, days) { return Sales.active(p) && Sales.until(p) < Date.now() + days * DAY; },
  total(p) { return Sales.pays(p).reduce((a, x) => a + (Number(x.amount) || 0), 0); },
  /* сколько месяцев с первой оплаты */
  months(p) { const ps = Sales.pays(p); return ps.length ? Math.max(0, Math.floor((Date.now() - ps[0].at) / (30.4 * DAY))) : 0; },
};

/* ── 10 готовых целевых групп ── */
const isMom = p => (p.tags || []).includes('Мама') || stageGroupsOf(p.answers || {}).includes('Материнство') || /(^|[^а-яё])(мама|мамой|маме|дети|детей|детьми|детям|дочк|дочь|дочер|сын)/i.test(((p.talk || {}).t_job || {}).a || '');
const prevMonth = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return monthKey(d.getTime()); };
const SALES_GROUPS = [
  {key: 'noBuy', name: 'Зарегистрировались, но не купили', about: 'дожать первую покупку: показать пользу и предложить месяц', f: p => ['reg', 'trial'].includes(Sales.status(p))},
  {key: 'lastMonth', name: 'Купили в прошлом месяце и не продлили', about: 'например, купили в сентябре и не продлили в октябре', f: p => Sales.status(p) === 'churn' && Sales.pays(p).some(x => monthKey(x.at) === prevMonth()) && !Sales.pays(p).some(x => monthKey(x.at) === monthKey(Date.now()))},
  {key: 'ending7', name: 'Подписка кончается за 7 дней', about: 'напомнить о продлении заранее', f: p => Sales.soon(p, 7)},
  {key: 'long3', name: 'С нами больше трёх месяцев', about: 'самые верные — отзывы, годовая подписка, амбассадоры', f: p => Sales.active(p) && Sales.months(p) >= 3},
  {key: 'year', name: 'На годовой подписке', about: 'закрытые встречи, ранний доступ к программам', f: p => Sales.active(p) && (Sales.last(p) || {}).plan === 'year'},
  {key: 'churn', name: 'Не продлили', about: 'спросить почему и вернуть предложением', f: p => Sales.status(p) === 'churn'},
  {key: 'moms', name: 'Мамы', about: 'тег «Мама», этап «Материнство» в анкете или дети в интервью', f: p => ['client', 'amb'].includes(p.type) && isMom(p)},
  {key: 'giftEnd', name: 'Подарочный доступ кончается', about: 'за 7 дней до конца подарка — предложить купить', f: p => accessOn(p) && p.access.until < Date.now() + 7 * DAY && !Sales.active(p)},
  {key: 'refs', name: 'Пришли по рекомендации', about: 'спасибо пригласившей, бонус за подругу', f: p => !!p.ref},
  {key: 'lowEng', name: 'Платят, но почти не заходят', about: 'риск не продлить — вернуть в привычку', f: p => Sales.active(p) && (p.sale || {}).engage === 'low'},
];
/* участники группы: готовой — по правилу на сегодня, своей — кого добавили */
function groupMembers(ref) {
  if (!ref) return [];
  if (ref.startsWith('g:')) { const g = SALES_GROUPS.find(x => x.key === ref.slice(2)); return g ? People.all().filter(g.f) : []; }
  if (ref.startsWith('c:')) { const g = Store.get('groups', ref.slice(2)); return g ? (g.members || []).map(id => People.get(id)).filter(Boolean) : []; }
  return [];
}
const groupName2 = ref => (ref.startsWith('g:') ? (SALES_GROUPS.find(x => x.key === ref.slice(2)) || {}).name : (Store.get('groups', ref.slice(2)) || {}).name) || 'Группа';
const allGroupRefs = () => [...SALES_GROUPS.map(g => ['g:' + g.key, g.name]), ...Store.all('groups').sort((a, b) => (b.at || 0) - (a.at || 0)).map(g => ['c:' + g.id, `${g.name} (своя)`])];

/* связаться: Telegram по нику или телефону, WhatsApp с готовым текстом */
const isPhone = s => /^\+?\d[\d\s()-]{8,}$/.test(String(s || '').trim());
const tgChat = p => (!p.tg ? '' : isPhone(p.tg) ? `https://t.me/+${phoneDigits(p.tg)}` : `https://t.me/${encodeURIComponent(tgUser(p.tg))}`);
const waChat = (p, text = '') => { const d = isPhone(p.tg) ? phoneDigits(p.tg) : ''; return d.length >= 11 ? `https://wa.me/${d}${text ? '?text=' + encodeURIComponent(text) : ''}` : ''; };
const personal = (text, p) => String(text || '').replace(/\{имя\}/gi, String(p.name || '').split(' ')[0] || '');

/* ── карточка: вкладка «Продажи» ── */
function salesPane(p, canEdit) {
  const s = p.sale || {}, ps = Sales.pays(p), st = Sales.status(p), u = Sales.until(p);
  const ro = canEdit ? '' : 'disabled';
  return `<div class="sl">
    <div class="sl-head">${st ? Sales.chip(p) : '<span class="st">Ещё не в продажах</span>'}
      ${u ? `<span class="note">${Sales.active(p) ? 'подписка до' : 'закончилась'} ${esc(dateRu(u))}</span>` : ''}${ps.length ? `<span class="note">· оплачено всего ${rub(Sales.total(p))} · с нами ${Sales.months(p)} мес.</span>` : ''}
      <span class="sp"></span>${canEdit ? `${!s.reg ? '<button class="btn sm" data-sale-reg>Зарегистрирована в Еве</button>' : ''}<button class="btn sm primary" data-sale-pay>${icon('plus')}Оплата</button>${st === 'churn' || Sales.soon(p, 30) ? '<button class="btn sm" data-sale-churn>Не продлила — почему</button>' : ''}` : ''}</div>
    ${s.churn ? `<div class="warnline">Не продлила: <b>${esc(s.churn.reason)}</b>${s.churn.note ? ' — ' + esc(s.churn.note) : ''} <small>(${esc(when(s.churn.at))})</small></div>` : ''}
    <div class="grid2">
      <label class="field"><span>Зарегистрирована в Еве</span><input class="input" type="date" data-sale="reg" value="${s.reg ? isoTs(s.reg) : ''}" ${ro}></label>
      <label class="field"><span>Как пользуется</span><select class="select" data-sale="engage" ${ro}><option value="">—</option>${ENGAGE.map(([k, n]) => `<option value="${k}" ${s.engage === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="field"><span>Что нравится</span><textarea class="textarea" data-sale="likes" placeholder="практики на 5 минут, эксперт по сну…" ${ro}>${esc(s.likes || '')}</textarea></label>
      <label class="field"><span>Что не нравится</span><textarea class="textarea" data-sale="dislikes" placeholder="много пушей, нет программ для мам…" ${ro}>${esc(s.dislikes || '')}</textarea></label>
    </div>
    <div class="field"><span>Оплаты</span>${ps.length ? `<table class="t"><thead><tr><th>Дата</th><th>Тариф</th><th class="r">Сумма</th><th>До</th><th></th></tr></thead><tbody>${ps.slice().reverse().map(x => `<tr><td>${esc(dateRu(x.at))}</td><td>${esc(salePlan(x.plan)[1])}</td><td class="r">${rub(x.amount)}</td><td>${esc(dateRu(x.until))}</td><td class="r">${canEdit ? `<button class="icon-btn" data-sale-del="${x.id}" title="Удалить оплату">${icon('trash')}</button>` : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="note">Оплат пока нет.</p>'}</div>
  </div>`;
}
function wireSales(root, p) {
  const cur = () => People.get(p.id) || p;
  const saleOf = () => ({...(cur().sale || {})});
  on(root, 'change', '[data-sale]', (e, el) => {
    const k = el.dataset.sale, s = saleOf();
    s[k] = k === 'reg' ? (el.value ? dateOf(el.value).getTime() : null) : el.value.trim();
    People.patch(p.id, {sale: s}, k === 'reg' ? `Регистрация в Еве: ${el.value || '—'}` : k === 'engage' ? `Пользуется: ${(ENGAGE.find(x => x[0] === el.value) || [0, '—'])[1].toLowerCase()}` : '', '💳');
  });
  on(root, 'click', '[data-sale-reg]', () => { const s = saleOf(); s.reg = Date.now(); People.patch(p.id, {sale: s}, 'Зарегистрировалась в Еве', '💳'); });
  on(root, 'click', '[data-sale-pay]', () => openPayment(cur()));
  on(root, 'click', '[data-sale-churn]', () => openChurn(cur()));
  on(root, 'click', '[data-sale-del]', async (e, el) => {
    if (!await confirmPop(el, {text: 'Удалить эту оплату?', yes: 'Удалить', danger: true})) return;
    const s = saleOf(); s.pays = (s.pays || []).filter(x => x.id !== el.dataset.saleDel);
    People.patch(p.id, {sale: s}, 'Удалили оплату', '↩');
  });
}
function openPayment(p) {
  const last = Sales.last(p);
  openModal({title: `Оплата: ${People.name(p)}`, body: `
      <div class="grid2"><label class="field"><span>Тариф</span><select class="select" id="pyPlan">${SALE_PLANS.map(([k, n]) => `<option value="${k}" ${(last ? last.plan : 'month') === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="field"><span>Сумма, ₽</span><input class="input" id="pyAmt" type="number" min="0" value="${last ? last.amount : PRICE_NOW}"></label></div>
      <label class="field"><span>Дата оплаты</span><input class="input" id="pyAt" type="date" value="${today()}"></label>
      <p class="note">${Sales.active(p) ? `Действующая подписка до ${esc(dateRu(Sales.until(p)))} — новая начнётся с этого дня (продление).` : 'Подписка начнётся с даты оплаты.'}</p>`,
    foot: '<button class="btn" data-close>Отмена</button><button class="btn primary" data-ok>Записать оплату</button>',
    onMount(el, close) {
      $('[data-ok]', el).onclick = () => {
        const plan = $('#pyPlan', el).value, amount = Number($('#pyAmt', el).value) || 0, at = dateOf($('#pyAt', el).value || today()).getTime() + 12 * 3600e3;
        const from = Sales.active(p) ? Math.max(Sales.until(p), at) : at;
        const s = {...(p.sale || {})};
        s.reg = s.reg || at;
        s.pays = [...(s.pays || []), {id: uid(), at, plan, amount, until: plusMonths(from, salePlan(plan)[2])}];
        delete s.churn;
        People.patch(p.id, {sale: s}, `${Sales.pays(p).length ? 'Продление' : 'Покупка'}: ${salePlan(plan)[1].toLowerCase()}, ${rub(amount)}`, '💳');
        close();
        toast(`💳 ${People.name(p)}: ${salePlan(plan)[1].toLowerCase()} · ${rub(amount)}`);
      };
    }});
}
function openChurn(p) {
  const c = (p.sale || {}).churn || {};
  openModal({title: `Почему не продлила: ${People.name(p)}`, body: `
      <div class="field"><span>Причина</span><div class="acc-plans" id="chR">${CHURN_REASONS.map(r => `<button type="button" class="${c.reason === r ? 'sug' : ''}" data-v="${esc(r)}">${esc(r)}</button>`).join('')}</div></div>
      <label class="field"><span>Её словами</span><textarea class="textarea" id="chN" placeholder="Что сказала, что могло бы вернуть">${esc(c.note || '')}</textarea></label>`,
    foot: '<button class="btn" data-close>Отмена</button><button class="btn primary" data-ok>Сохранить</button>',
    onMount(el, close) {
      let reason = c.reason || '';
      on(el, 'click', '#chR button', (e, b) => { reason = b.dataset.v; $$('#chR button', el).forEach(x => x.classList.toggle('sug', x === b)); });
      $('[data-ok]', el).onclick = () => {
        if (!reason) { toast('Выберите причину'); return; }
        People.patch(p.id, {sale: {...(p.sale || {}), churn: {reason, note: $('#chN', el).value.trim(), at: Date.now()}}}, `Не продлила: ${reason}`, '💔');
        close();
      };
    }});
}

/* ── страница «Продажи» ── */
App.register('sales', {
  title: 'Продажи',
  render(root) {
    const tab = ['dash', 'list', 'groups', 'mail'].includes(View.get('sl.tab', 'dash')) ? View.get('sl.tab', 'dash') : 'dash';
    const L = Sales.people();
    const canEdit = People.canEdit();
    const mailOpen = View.get('sl.mail', '');
    let body = '';
    if (tab === 'dash') body = salesDash(L);
    else if (tab === 'list') body = salesList(L, canEdit);
    else if (tab === 'groups') body = salesGroups(canEdit);
    else body = mailOpen && Store.get('mail', mailOpen) ? mailView(Store.get('mail', mailOpen), canEdit) : mailList(canEdit);
    root.innerHTML = `
      ${pageHead('Продажи', 'Кто зарегистрировался в Еве, купил, продлил или ушёл — и почему. Группы для рассылок и сами рассылки.',
        canEdit ? `<button class="btn" data-sl-import>${icon('upload')}Список из таблицы</button><button class="btn primary" data-sl-add>${icon('plus')}В продажи</button>` : '')}
      ${tabsHtml('sl.tab', [['dash', 'Дашборд'], ['list', 'Клиенты', L.length || null], ['groups', 'Группы', SALES_GROUPS.length + Store.all('groups').length], ['mail', 'Рассылки', Store.all('mail').length || null]], tab)}
      <div class="sl-body">${body}</div>`;
    wireTabs(root);
    on(root, 'click', '[data-tab-key="sl.tab"]', () => View.set('sl.mail', ''));
    on(root, 'click', '[data-open]', (e, el) => { if (!e.target.closest('button, a, input, select')) App.go('p-' + el.dataset.open); });
    on(root, 'click', '[data-sl-add]', (e, el) => addToSales(el));
    on(root, 'click', '[data-sl-import]', () => openSalesImport());
    on(root, 'click', '[data-pay]', (e, el) => openPayment(People.get(el.dataset.pay)));
    on(root, 'click', '[data-churn]', (e, el) => openChurn(People.get(el.dataset.churn)));
    on(root, 'click', '[data-slf]', (e, el) => { View.set('sl.f', el.dataset.slf); App.render(); });
    wireGroups(root);
    wireMail(root);
  },
});

function salesDash(L) {
  const now = Date.now();
  const bought = L.filter(p => Sales.pays(p).length);
  const active = L.filter(Sales.active);
  const renewed = L.filter(p => Sales.pays(p).length > 1);
  const churn = L.filter(p => Sales.status(p) === 'churn');
  const noBuy = L.filter(p => ['reg', 'trial'].includes(Sales.status(p)));
  const soon30 = active.filter(p => Sales.until(p) < now + 30 * DAY);
  const expect = soon30.reduce((a, p) => a + (Number((Sales.last(p) || {}).amount) || 0), 0);
  const year = active.filter(p => (Sales.last(p) || {}).plan === 'year');
  const allPays = L.flatMap(p => Sales.pays(p).map(x => ({...x, p})));
  const mNow = monthKey(now);
  const revNow = allPays.filter(x => monthKey(x.at) === mNow).reduce((a, x) => a + (Number(x.amount) || 0), 0);
  const avg = allPays.length ? allPays.reduce((a, x) => a + (Number(x.amount) || 0), 0) / allPays.length : 0;
  const engaged = active.filter(p => (p.sale || {}).engage);
  const high = engaged.filter(p => p.sale.engage === 'high').length;
  /* выручка по месяцам: последние 6 */
  const months = Array.from({length: 6}, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 5 + i); return monthKey(d.getTime()); });
  const MON = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const byM = months.map(m => ({name: `${MON[Number(m.slice(5)) - 1]} ${m.slice(2, 4)}`, v: allPays.filter(x => monthKey(x.at) === m).reduce((a, x) => a + (Number(x.amount) || 0), 0)}));
  const reasons = Object.entries(churn.reduce((m, p) => { const r = ((p.sale || {}).churn || {}).reason || 'Не спросили'; m[r] = (m[r] || 0) + 1; return m; }, {})).map(([name, v]) => ({name, v})).sort((a, b) => b.v - a.v);
  const plans = SALE_PLANS.map(([k, n]) => ({name: n, v: active.filter(p => (Sales.last(p) || {}).plan === k).length})).filter(r => r.v);
  const quotes = (k, list) => list.filter(p => (p.sale || {})[k]).slice(0, 5).map(p => `<div class="quote">«${esc(p.sale[k])}»<small><a href="#p-${p.id}">${esc(People.name(p))}</a></small></div>`).join('') || '<p class="note">Записывайте во вкладке «Продажи» карточки.</p>';
  const pctOf = (a, b) => (b ? pct(a / b) : '—');
  const kpi = items => `<div class="kpis kpis-4 card">${items.map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('')}</div>`;
  if (!L.length) return `<div class="welcome"><span class="e">💳</span><div><b>Продаж пока нет</b><p>Нажмите «В продажи» — найдите человека в базе и отметьте регистрацию в Еве или оплату. Или вставьте список из таблицы. Дальше — воронка, продления, группы и рассылки.</p></div></div>`;
  return `
    ${kpi([[L.length, 'зарегистрировались'], [noBuy.length, 'не купили'], [bought.length, `купили · ${pctOf(bought.length, L.length)}`], [active.length, 'подписок сейчас']])}
    <div style="height:10px"></div>
    ${kpi([[renewed.length, `продлили · ${pctOf(renewed.length, bought.length)}`], [churn.length, 'не продлили'], [`${soon30.length} · ${rub(expect)}`, 'продлений ждём за 30 дней'], [year.length, 'на годовой подписке']])}
    <div style="height:10px"></div>
    ${kpi([[rub(revNow), 'выручка в этом месяце'], [rub(avg), 'средний чек'], [engaged.length ? pct(high / engaged.length) : '—', 'часто пользуются (из отмеченных)'], [rub(L.reduce((a, p) => a + Sales.total(p), 0)), 'выручка за всё время']])}
    <div class="two section">
      ${card('Воронка продаж', 'от регистрации до продления', hbarList([{name: 'Зарегистрировались', v: L.length}, {name: 'Купили', v: bought.length}, {name: 'Продлили', v: renewed.length}, {name: 'Подписка сейчас', v: active.length}], {color: 'var(--good)'}))}
      ${card('Выручка по месяцам', 'последние полгода', hbarList(byM, {color: 'var(--gold)', valFmt: rub}))}
      ${card('Почему не продлевают', `${churn.length} ${plural(churn.length, 'человек', 'человека', 'человек')}`, reasons.length ? hbarList(reasons, {color: 'var(--bad)'}) : '<p class="note">Пока все продлевают.</p>')}
      ${card('Тарифы сейчас', 'у действующих подписок', plans.length ? hbarList(plans, {color: 'var(--violet)'}) : '<p class="note">Нет действующих подписок.</p>')}
      ${card('Что нравится', 'словами клиенток', `<div class="stack">${quotes('likes', L)}</div>`)}
      ${card('Что не нравится', 'что исправить, чтобы продлевали', `<div class="stack">${quotes('dislikes', L)}</div>`)}
    </div>`;
}
function salesList(L, canEdit) {
  const f = View.get('sl.f', '');
  const list = (f ? L.filter(p => (f === 'active' ? Sales.active(p) : Sales.status(p) === f)) : L).slice().sort((a, b) => (Sales.until(a) || 0) - (Sales.until(b) || 0));
  const chips = [['', 'Все', L.length], ['reg', 'Не купили', L.filter(p => ['reg', 'trial'].includes(Sales.status(p))).length], ['active', 'С подпиской', L.filter(Sales.active).length], ['renewed', 'Продлили', L.filter(p => Sales.status(p) === 'renewed').length], ['churn', 'Не продлили', L.filter(p => Sales.status(p) === 'churn').length]];
  return `<div class="chip-row">${chips.map(([k, n, c]) => `<button class="chip ${f === k ? 'on' : ''}" data-slf="${k}">${n}<span class="chip-n">${c}</span></button>`).join('')}</div>
    <div class="card" style="padding:0;overflow:auto">${list.length ? `<table class="t base-t"><thead><tr><th>Контакт</th><th>Статус</th><th>Тариф</th><th class="r">Оплачено</th><th>С нами</th><th>Подписка до</th><th>Пользуется</th><th></th></tr></thead><tbody>
      ${list.map(p => { const u = Sales.until(p), last = Sales.last(p), tg = tgChat(p), wa = waChat(p); return `<tr data-open="${p.id}">
        <td><div class="bt-who">${avatar(People.name(p))}<span><b>${esc(People.name(p))}</b><small>${esc(p.tg || '')}${p.evaId ? ' · EVA ' + esc(p.evaId) : ''}</small></span></div></td>
        <td>${Sales.chip(p)}${((p.sale || {}).churn || {}).reason ? `<br><small class="muted">${esc(p.sale.churn.reason)}</small>` : ''}</td>
        <td>${last ? esc(salePlan(last.plan)[1]) : '—'}</td><td class="r">${rub(Sales.total(p))}</td><td>${Sales.pays(p).length ? `${Sales.months(p)} мес.` : '—'}</td>
        <td>${u ? `<span class="${Sales.soon(p, 7) ? 'warn-t' : ''}">${esc(dateRu(u))}</span>` : '—'}</td>
        <td>${esc(((ENGAGE.find(x => x[0] === (p.sale || {}).engage) || [0, '—'])[1]))}</td>
        <td class="r nowrap">${tg ? `<a class="icon-btn" href="${esc(tg)}" target="_blank" rel="noopener" title="Написать в Telegram">${icon('send')}</a>` : ''}${wa ? `<a class="icon-btn" href="${esc(wa)}" target="_blank" rel="noopener" title="Написать в WhatsApp">${icon('msg')}</a>` : ''}${canEdit ? `<button class="btn xs" data-pay="${p.id}">Оплата</button>${Sales.status(p) === 'churn' ? `<button class="btn xs" data-churn="${p.id}">Почему</button>` : ''}` : ''}</td></tr>`; }).join('')}
    </tbody></table>` : '<p class="note" style="padding:16px">Никого в этом статусе.</p>'}</div>`;
}
/* добавить в продажи: найти в базе — отметить регистрацию; нет в базе — новая клиентка */
function addToSales(anchor) {
  openModal({title: 'В продажи', body: `
      <label class="field"><span>Найти в базе</span><input class="input" id="saFind" type="search" autocomplete="off" placeholder="Имя, @telegram, телефон, код"></label>
      <div class="add-hits" id="saHits"></div>
      <div class="add-or"><span>или новая клиентка</span></div>
      <div class="grid2"><label class="field"><span>Имя</span><input class="input" id="saName"></label><label class="field"><span>Telegram или телефон</span><input class="input" id="saTg"></label></div>
      <div class="grid2"><label class="field"><span>ID в Еве</span><input class="input" id="saEva"></label><label class="field"><span>Зарегистрирована</span><input class="input" type="date" id="saReg" value="${today()}"></label></div>`,
    foot: '<button class="btn" data-close>Отмена</button><button class="btn primary" data-ok>Добавить</button>',
    onMount(el, close) {
      const mark = p => { People.patch(p.id, {sale: {...(p.sale || {}), reg: (p.sale || {}).reg || Date.now()}}, 'Добавили в продажи: зарегистрирована в Еве', '💳'); close(); View.set('pp.tab', 'sales'); App.go('p-' + p.id); };
      $('#saFind', el).addEventListener('input', () => {
        $('#saHits', el).innerHTML = findContacts($('#saFind', el).value).map(p => `<div class="add-hit">${avatar(People.name(p))}<span><b>${esc(People.name(p))}</b><small>${esc(contactLine(p))}${Sales.in(p) ? ' · уже в продажах' : ''}</small></span><button class="btn sm primary" data-pick="${p.id}">${Sales.in(p) ? 'Открыть' : 'Выбрать'}</button></div>`).join('');
      });
      on(el, 'click', '[data-pick]', (e, b) => mark(People.get(b.dataset.pick)));
      $('[data-ok]', el).onclick = () => {
        const name = $('#saName', el).value.trim();
        if (!name) { $('#saName', el).classList.add('need'); return; }
        const reg = dateOf($('#saReg', el).value || today()).getTime();
        const id = People.create({type: 'client', name, tg: $('#saTg', el).value.trim(), evaId: $('#saEva', el).value.trim(), s1: 'skip', s2: 'skip', s3: 'none', sale: {reg}, source: 'sales'});
        close(); View.set('pp.tab', 'sales'); App.go('p-' + id);
      };
    }});
  void anchor;
}
/* список из таблицы: имя; telegram/телефон; EVA ID; дата регистрации; тариф; сумма; дата оплаты */
function openSalesImport() {
  openModal({title: 'Продажи списком из таблицы', wide: true, body: `
      <p class="note">Скопируйте строки из Excel или Google-таблицы. Столбцы по порядку: <b>имя · Telegram или телефон · ID в Еве · дата регистрации · тариф (месяц, 3 месяца, полгода, год) · сумма · дата оплаты</b>. Пустые столбцы можно оставить пустыми. Человек уже есть в базе (по Telegram, телефону или ID) — допишем ему, нет — заведём клиентку.</p>
      <textarea class="textarea" id="siBox" style="min-height:180px;font-family:var(--f-mono, monospace);font-size:12.5px" placeholder="Анна Иванова	@anna	104382	01.09.2026	месяц	2900	05.09.2026"></textarea>
      <div id="siPrev" class="note"></div>`,
    foot: '<button class="btn" data-close>Отмена</button><button class="btn primary" data-ok>Загрузить</button>',
    onMount(el, close) {
      const date = s => { const m = String(s || '').trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/) || String(s || '').trim().match(/^(\d{4})-(\d\d)-(\d\d)$/); if (!m) return null; const [y, mo, d] = m[1].length === 4 ? [m[1], m[2], m[3]] : [m[3].length === 2 ? '20' + m[3] : m[3], m[2], m[1]]; return new Date(Number(y), Number(mo) - 1, Number(d), 12).getTime(); };
      const plan = s => { const t = String(s || '').toLowerCase(); return /год|12/.test(t) ? 'year' : /пол|6/.test(t) ? '6m' : /3|квар/.test(t) ? '3m' : t ? 'month' : ''; };
      const parse = () => $('#siBox', el).value.split('\n').map(l => l.split(/\t|;/).map(x => x.trim())).filter(c => c[0]);
      $('#siBox', el).addEventListener('input', () => { const r = parse(); $('#siPrev', el).textContent = r.length ? `Строк: ${r.length}. Первая: ${r[0].filter(Boolean).join(' · ')}` : ''; });
      $('[data-ok]', el).onclick = () => {
        let made = 0, upd = 0;
        parse().forEach(([name, tg, eva, regS, planS, amtS, payS]) => {
          const ex = Store.all('people').find(p => (eva && p.evaId && String(p.evaId) === eva) || (tg && sameContact('', tg).includes(p)));
          const reg = date(regS) || date(payS) || Date.now();
          const pl = plan(planS), at = date(payS) || (pl ? reg : null);
          const pay = pl && at ? {id: uid(), at, plan: pl, amount: Number(String(amtS || '').replace(/[^\d.]/g, '')) || 0, until: plusMonths(at, salePlan(pl)[2])} : null;
          if (ex) {
            const s = {...(ex.sale || {})}; s.reg = s.reg || reg; if (pay && !(s.pays || []).some(x => Math.abs(x.at - pay.at) < DAY && x.plan === pay.plan)) s.pays = [...(s.pays || []), pay];
            People.patch(ex.id, {sale: s, ...(eva && !ex.evaId ? {evaId: eva} : {})}, 'Продажи: загрузили из таблицы', '💳'); upd++;
          } else { People.create({type: 'client', name, tg: tg || '', evaId: eva || '', s1: 'skip', s2: 'skip', s3: 'none', sale: {reg, pays: pay ? [pay] : []}, source: 'sales'}); made++; }
        });
        close(); toast(`Загружено: новых ${made}, дописано ${upd}`); View.set('sl.tab', 'list'); App.render();
      };
    }});
}

/* ── группы ── */
function salesGroups(canEdit) {
  const open = View.get('sl.g', '');
  const row = (ref, name, about, members, own) => `<div class="card grp ${open === ref ? 'open' : ''}">
      <div class="grp-h"><div><b>${esc(name)}</b><small>${esc(about)}</small></div><span class="grp-n">${members.length}</span>
        <button class="btn sm" data-gopen="${ref}">${open === ref ? 'Скрыть' : 'Кто здесь'}</button>
        ${canEdit ? `<button class="btn sm primary" data-gmail="${ref}" ${members.length ? '' : 'disabled'}>${icon('send')}Рассылка</button>` : ''}
        ${canEdit && own ? `<button class="icon-btn" data-gedit="${ref.slice(2)}" title="Изменить состав">${icon('edit')}</button><button class="icon-btn" data-gdel="${ref.slice(2)}" title="Удалить группу">${icon('trash')}</button>` : canEdit ? `<button class="icon-btn" data-gsave="${ref}" title="Сохранить как свою группу — дальше состав правится руками">${icon('copy')}</button>` : ''}</div>
      ${open === ref ? `<div class="grp-m">${members.map(p => `<a href="#p-${p.id}" class="grp-p">${avatar(People.name(p))}<span>${esc(People.name(p))}<small>${esc(Sales.label(p) || TYPES[p.type].one)}</small></span></a>`).join('') || '<p class="note">Сейчас никого.</p>'}</div>` : ''}
    </div>`;
  const own = Store.all('groups').sort((a, b) => (b.at || 0) - (a.at || 0));
  return `<div class="section-head"><h2>Целевые группы</h2><span class="hint-inline">считаются сами по данным продаж и карточек — на сегодня</span></div>
    <div class="grp-list">${SALES_GROUPS.map(g => row('g:' + g.key, g.name, g.about, People.all().filter(g.f), false)).join('')}</div>
    <div class="section-head" style="margin-top:22px"><h2>Свои группы</h2>${canEdit ? `<button class="btn sm primary" data-gnew>${icon('plus')}Новая группа</button>` : ''}</div>
    <div class="grp-list">${own.map(g => row('c:' + g.id, g.name, `добавлены вручную · ${(g.members || []).length}`, groupMembers('c:' + g.id), true)).join('') || '<p class="note">Соберите свою группу руками — например, «Пришли на офлайн-встречу 12.10».</p>'}</div>`;
}
function editGroup(g) {
  openModal({title: g ? `Группа «${g.name}»` : 'Новая группа', body: `
      <label class="field"><span>Название</span><input class="input" id="grName" value="${esc(g ? g.name : '')}" placeholder="Например: офлайн-встреча 12.10"></label>
      <div class="field"><span>Кто в группе</span>${pickedHtml('grMem', (g ? g.members || [] : []).map(id => People.name(People.get(id))), 'Добавить людей')}</div>`,
    foot: '<button class="btn" data-close>Отмена</button><button class="btn primary" data-ok>Сохранить</button>',
    onMount(el, close) {
      let ids = g ? [...(g.members || [])] : [];
      const all = People.all(), label = id => { const p = People.get(id); return p ? `${People.name(p)} · ${TYPES[p.type].one}` : id; };
      on(el, 'click', '[data-pick-open]', async (e, b) => {
        const v = await multiPop(b, {items: all.map(p => p.id), selected: ids, label, placeholder: 'Найти человека…'});
        if (!v) return;
        ids = v;
        $('#grMem', el).outerHTML = pickedHtml('grMem', ids.map(id => People.name(People.get(id))), 'Добавить людей');
      });
      $('[data-ok]', el).onclick = () => {
        const name = $('#grName', el).value.trim();
        if (!name) { $('#grName', el).classList.add('need'); return; }
        if (g) Store.patch('groups', g.id, {name, members: ids}); else Store.add('groups', {name, members: ids, at: Date.now(), by: Who.id()});
        close();
      };
    }});
}
function wireGroups(root) {
  on(root, 'click', '[data-gopen]', (e, el) => { View.set('sl.g', View.get('sl.g', '') === el.dataset.gopen ? '' : el.dataset.gopen); App.render(); });
  on(root, 'click', '[data-gnew]', () => editGroup(null));
  on(root, 'click', '[data-gedit]', (e, el) => editGroup(Store.get('groups', el.dataset.gedit)));
  on(root, 'click', '[data-gdel]', async (e, el) => { if (await confirmPop(el, {text: 'Удалить группу? Люди останутся в базе.', yes: 'Удалить', danger: true})) Store.remove('groups', el.dataset.gdel); });
  on(root, 'click', '[data-gsave]', (e, el) => {
    const ref = el.dataset.gsave;
    const id = Store.add('groups', {name: `${groupName2(ref)} · ${dayShort(today())}`, members: groupMembers(ref).map(p => p.id), at: Date.now(), by: Who.id()});
    toast('Сохранили как свою группу — состав можно править'); View.set('sl.g', 'c:' + id); App.render();
  });
  on(root, 'click', '[data-gmail]', (e, el) => editMail(null, el.dataset.gmail));
}

/* ── рассылки ── */
const MAIL_CH = [['tg', 'Telegram'], ['wa', 'WhatsApp'], ['app', 'В приложении Евы (список ID)']];
function mailList(canEdit) {
  const L = Store.all('mail').sort((a, b) => (b.at || 0) - (a.at || 0));
  return `<div class="section-head"><h2>Рассылки</h2>${canEdit ? `<button class="btn sm primary" data-mnew>${icon('plus')}Новая рассылка</button>` : ''}</div>
    <p class="note" style="margin-bottom:10px">Текст пишется один раз, {имя} подставится само. Отправка — по одному нажатию на каждого: откроется чат в Telegram или WhatsApp с готовым текстом, отметка «отправлено» ляжет в историю карточки. Для приложения Евы — выгрузка ID и текста для команды приложения.</p>
    ${L.length ? `<div class="grp-list">${L.map(m => { const n = (m.ids || []).length, s = Object.keys(m.sent || {}).filter(id => (m.ids || []).includes(id)).length; return `<div class="card grp"><div class="grp-h"><div><b>${esc(m.title)}</b><small>${esc(groupName2(m.group || 'c:'))} · ${esc((MAIL_CH.find(x => x[0] === m.channel) || MAIL_CH[0])[1])} · ${esc(when(m.at))}</small></div>
      <span class="grp-n">${s}/${n}</span><span class="iv-pbar"><i style="width:${n ? (s / n * 100).toFixed(0) : 0}%"></i></span><button class="btn sm ${s < n ? 'primary' : ''}" data-mopen="${m.id}">${s < n ? 'Отправлять' : 'Открыть'}</button></div></div>`; }).join('')}</div>` : '<p class="note">Рассылок пока нет. Начните с группы: «Группы» → «Рассылка».</p>'}`;
}
function editMail(m, group = '') {
  openModal({title: m ? 'Изменить рассылку' : 'Новая рассылка', wide: true, body: `
      <label class="field"><span>Название</span><input class="input" id="mlT" value="${esc(m ? m.title : '')}" placeholder="Например: продление · октябрь"></label>
      <div class="grid2"><label class="field"><span>Кому — группа</span><select class="select" id="mlG" ${m ? 'disabled' : ''}>${allGroupRefs().map(([k, n]) => `<option value="${k}" ${(m ? m.group : group) === k ? 'selected' : ''}>${esc(n)} · ${groupMembers(k).length}</option>`).join('')}</select>${m ? '<small>Состав правится в самой рассылке: «Убрать» и «Добавить людей»</small>' : ''}</label>
      <label class="field"><span>Куда</span><select class="select" id="mlC">${MAIL_CH.map(([k, n]) => `<option value="${k}" ${(m ? m.channel : 'tg') === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>
      <label class="field"><span>Текст</span><textarea class="textarea" id="mlX" style="min-height:140px" placeholder="{имя}, привет! Твоя подписка на Еву заканчивается через 3 дня…">${esc(m ? m.text : '')}</textarea><small>{имя} — подставится имя каждого человека</small></label>`,
    foot: '<button class="btn" data-close>Отмена</button><button class="btn primary" data-ok>Сохранить</button>',
    onMount(el, close) {
      $('[data-ok]', el).onclick = () => {
        const title = $('#mlT', el).value.trim(), text = $('#mlX', el).value.trim();
        if (!title || !text) { (title ? $('#mlX', el) : $('#mlT', el)).classList.add('need'); return; }
        if (m) Store.patch('mail', m.id, {title, text, channel: $('#mlC', el).value});
        else {
          const g = $('#mlG', el).value;
          const id = Store.add('mail', {title, text, channel: $('#mlC', el).value, group: g, ids: groupMembers(g).map(p => p.id), sent: {}, at: Date.now(), by: Who.id()});
          View.set('sl.tab', 'mail'); View.set('sl.mail', id);
        }
        close(); App.render();
      };
    }});
}
function mailView(m, canEdit) {
  const ppl = (m.ids || []).map(id => People.get(id)).filter(Boolean);
  const sent = m.sent || {}, done = ppl.filter(p => sent[p.id]).length;
  return `<div class="ml-head"><button class="link-btn" data-mback>${icon('back')}Все рассылки</button>
      <h2>${esc(m.title)}</h2><span class="note">${esc(groupName2(m.group || 'c:'))} · ${esc((MAIL_CH.find(x => x[0] === m.channel) || MAIL_CH[0])[1])} · отправлено ${done} из ${ppl.length}</span>
      <span class="sp"></span>${canEdit ? `<button class="btn sm" data-medit>${icon('edit')}Изменить</button><button class="btn sm" data-madd>${icon('plus')}Добавить людей</button><button class="icon-btn" data-mdel title="Удалить рассылку">${icon('trash')}</button>` : ''}</div>
    <div class="card ml-text"><pre>${esc(m.text)}</pre><div class="row"><button class="btn sm" data-mcopy>${icon('copy')}Скопировать текст</button><button class="btn sm" data-mcontacts>${icon('copy')}Все контакты</button>${m.channel === 'app' ? `<button class="btn sm" data-mcsv>${icon('download')}Выгрузить ID для приложения</button>` : ''}</div></div>
    <div class="card" style="padding:0;overflow:auto"><table class="t base-t"><thead><tr><th>Кому</th><th>Контакт</th><th>Отправить</th><th class="c">Отправлено</th><th></th></tr></thead><tbody>
      ${ppl.map(p => { const txt = personal(m.text, p), link = m.channel === 'wa' ? waChat(p, txt) : m.channel === 'tg' ? tgChat(p) : ''; return `<tr class="${sent[p.id] ? 'ml-done' : ''}">
        <td><a href="#p-${p.id}" class="bt-who">${avatar(People.name(p))}<span><b>${esc(People.name(p))}</b><small>${esc(Sales.label(p) || TYPES[p.type].one)}</small></span></a></td>
        <td>${esc(p.tg || (m.channel === 'app' ? (p.evaId ? 'EVA ' + p.evaId : 'нет ID') : 'нет контакта'))}</td>
        <td class="nowrap">${link ? `<a class="btn xs primary" href="${esc(link)}" target="_blank" rel="noopener" data-msend="${p.id}">${m.channel === 'wa' ? 'Открыть WhatsApp' : 'Открыть Telegram'}</a>` : ''}${m.channel !== 'wa' ? `<button class="btn xs" data-mone="${p.id}">Текст</button>` : ''}</td>
        <td class="c"><input type="checkbox" data-mmark="${p.id}" ${sent[p.id] ? 'checked' : ''} ${canEdit ? '' : 'disabled'} aria-label="Отправлено"></td>
        <td class="r">${canEdit ? `<button class="icon-btn" data-mrm="${p.id}" title="Убрать из рассылки">${icon('x')}</button>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="5" class="note">Никого — добавьте людей.</td></tr>'}
    </tbody></table></div>`;
}
function wireMail(root) {
  const m = () => Store.get('mail', View.get('sl.mail', ''));
  const markSent = (id, on = true) => {
    const x = m(); if (!x) return;
    const sent = {...(x.sent || {})};
    if (on) sent[id] = Date.now(); else delete sent[id];
    Store.put('mail', x.id, {...x, sent});
    if (on) People.patch(id, {}, `Рассылка «${x.title}»`, '✉️');
  };
  on(root, 'click', '[data-mnew]', () => editMail(null, View.get('sl.g', '') || 'g:noBuy'));
  on(root, 'click', '[data-mopen]', (e, el) => { View.set('sl.mail', el.dataset.mopen); App.render(); });
  on(root, 'click', '[data-mback]', () => { View.set('sl.mail', ''); App.render(); });
  on(root, 'click', '[data-medit]', () => editMail(m()));
  on(root, 'click', '[data-mdel]', async (e, el) => { if (await confirmPop(el, {text: 'Удалить рассылку? Отметки в карточках останутся.', yes: 'Удалить', danger: true})) { Store.remove('mail', m().id); View.set('sl.mail', ''); } });
  on(root, 'click', '[data-madd]', async (e, el) => {
    const x = m();
    const v = await multiPop(el, {items: People.all().map(p => p.id), selected: x.ids || [], label: id => { const p = People.get(id); return p ? `${People.name(p)} · ${TYPES[p.type].one}` : id; }, placeholder: 'Найти человека…'});
    if (v) Store.patch('mail', x.id, {ids: v});
  });
  on(root, 'click', '[data-mrm]', (e, el) => { const x = m(); Store.patch('mail', x.id, {ids: (x.ids || []).filter(id => id !== el.dataset.mrm)}); });
  on(root, 'click', '[data-mcopy]', () => copyOrShow(m().text, 'Текст скопирован'));
  on(root, 'click', '[data-mone]', (e, el) => copyOrShow(personal(m().text, People.get(el.dataset.mone)), 'Текст скопирован — вставьте в чат'));
  on(root, 'click', '[data-mcontacts]', () => copyOrShow((m().ids || []).map(id => People.get(id)).filter(Boolean).map(p => `${People.name(p)}\t${p.tg || ''}\t${p.evaId || ''}`).join('\n'), 'Контакты скопированы'));
  on(root, 'click', '[data-mcsv]', () => { const x = m(); downloadCsv(`eva-rassylka-${today()}.csv`, (x.ids || []).map(id => People.get(id)).filter(Boolean)); });
  on(root, 'click', '[data-msend]', (e, el) => { if (!(m().sent || {})[el.dataset.msend]) setTimeout(() => markSent(el.dataset.msend), 300); });
  on(root, 'change', '[data-mmark]', (e, el) => markSent(el.dataset.mmark, el.checked));
}
