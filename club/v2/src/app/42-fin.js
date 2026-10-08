/* Финансы — модель. Подписки по месяцам, выплаты (рефералам, авторам курсов,
   продавцам маркетплейса), курсы, заказы и товары, сбои оплат и возвраты.
   Правило одно: деньги, которые на самом деле пришли или ушли, всегда лежат
   в журнале операций (ledger) — тогда баланс, P&L и Cash Flow считают их сами.
   Операция помнит, откуда она: payoutId (выплата), orderId (заказ),
   refundId (возврат), courseMonth (выручка курсов за месяц). */

const FAIL_REASONS = {
  funds: 'Недостаточно средств',
  bank:  'Отказ банка',
  card:  'Карта просрочена или заблокирована',
  tds:   'Не прошло подтверждение 3-D Secure',
  limit: 'Превышен лимит по карте',
  other: 'Другое',
};
const FAIL_ST = {
  new:       {name: 'Новый',              tone: 'bad'},
  contacted: {name: 'Написали клиенту',   tone: 'warn'},
  retry:     {name: 'Повторное списание', tone: 'violet'},
  paid:      {name: 'Оплачено',           tone: 'good'},
  lost:      {name: 'Потерян',            tone: 'line'},
};
const FAIL_OPEN = ['new', 'contacted', 'retry'];
const REFUND_ST = {
  new:      {name: 'Новый запрос',     tone: 'bad'},
  review:   {name: 'На рассмотрении',  tone: 'warn'},
  approved: {name: 'Одобрен — вернуть', tone: 'violet'},
  refunded: {name: 'Возвращено',       tone: 'good'},
  rejected: {name: 'Отказано',         tone: 'line'},
};
const REFUND_OPEN = ['new', 'review', 'approved'];
const REFUND_PRODUCTS = {sub: 'Подписка', course: 'Курс', market: 'Маркетплейс', other: 'Другое'};
const REFUND_REASONS = ['Не подошёл контент', 'Забыл(а) отменить подписку', 'Двойное или ошибочное списание', 'Технические проблемы', 'Не устроило качество', 'Другое'];
const REFUND_DAYS = 10;   // ответить и вернуть деньги — 10 дней (закон о защите прав потребителей)
const ORDER_PAY = {
  wait:   {name: 'Ждёт оплаты', tone: 'warn'},
  paid:   {name: 'Оплачен',     tone: 'good'},
  refund: {name: 'Возврат',     tone: 'bad'},
};
const ORDER_DELIVERY = {
  new:       {name: 'Новый',      tone: 'line'},
  packing:   {name: 'Собирается', tone: 'violet'},
  shipped:   {name: 'Отправлен',  tone: 'gold'},
  delivered: {name: 'Доставлен',  tone: 'good'},
  cancelled: {name: 'Отменён',    tone: 'bad'},
};
const PAYOUT_KINDS = {
  ref:    {name: 'Рефералам',      cat: 'referral'},
  author: {name: 'Авторам курсов', cat: 'authors'},
  seller: {name: 'Продавцам',      cat: 'sellers'},
};
const isSet = v => v !== undefined && v !== null && v !== '';
const priceYear = () => Number(settings().priceYear) || settings().price * 10;
/* месяцы учёта: с начала Cash Flow по текущий */
function finMonths() {
  const cur = monthOf(today()), first = CF_MONTHS[0];
  return monthRange(first, cur < first ? first : cur);
}

/* ── подписки по месяцам: внесённое человеком поверх того, что видно из «Цифр дня» ── */
const Subs = {
  rec(m) { return Store.get('subs', m) || {}; },
  rows() {
    const s = settings(), out = [], cur = monthOf(today());
    let prev = null;
    finMonths().forEach(m => {
      const r = this.rec(m), f = Sales.month(m), ref = Fin.refundsIn(m, 'sub');
      const num = (k, def) => (isSet(r[k]) ? Number(r[k]) || 0 : def);
      const now = m === cur;
      const startM = num('startM', prev ? prev.endM : 0), startY = num('startY', prev ? prev.endY : 0);
      const newY = num('newY', 0);
      const newM = num('newM', Math.max(0, f.pays - newY));
      const renewed = num('renewed', f.renewals);
      /* продлеваются все месячные, кто был на начало; в идущем месяце срок
         подошёл ещё не у всех — ждём пропорционально прошедшим дням */
      const share = now ? Math.min(1, Number(today().slice(8)) / daysInMonth(m)) : 1;
      const due = Math.round(startM * share);
      const churn = num('churn', Math.max(0, due - renewed));
      const refunds = num('refunds', ref.n);
      const refundSum = num('refundSum', ref.sum);
      const endM = Math.max(0, startM + newM - churn - refunds);
      const endY = Math.max(0, startY + newY);
      const pays = newM + newY + renewed;
      const row = {m, now, r, startM, startY, newM, newY, renewed, due, churn, refunds, refundSum, endM, endY, total: endM + endY, pays,
        renewRate: due ? Math.min(1, renewed / due) : null, churnRate: due ? churn / due : null, refundRate: pays ? refunds / pays : null,
        revenue: f.revenue, check: pays ? f.revenue / pays : null, mrr: endM * s.price + endY * priceYear() / 12,
        auto: {newM: !isSet(r.newM), renewed: !isSet(r.renewed), churn: !isSet(r.churn), refunds: !isSet(r.refunds), refundSum: !isSet(r.refundSum), startM: !isSet(r.startM), startY: !isSet(r.startY)}};
      out.push(row);
      prev = row;
    });
    return out;
  },
  now() { const rows = this.rows(); return rows[rows.length - 1]; },
  /* процент продлений — по последнему месяцу, где было кому продлевать */
  rate() {
    const rows = this.rows().filter(r => r.due > 0);
    const full = rows.filter(r => !r.now);
    const r = full[full.length - 1] || rows[rows.length - 1];
    return r ? {renew: r.renewRate, churn: r.churnRate, refund: r.refundRate, m: r.m} : null;
  },
};

/* ── общее по финансам ── */
const Fin = {
  byDate: list => list.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || (b.at || 0) - (a.at || 0)),
  refunds() { return this.byDate(Store.all('refunds')); },
  refundOpen: r => REFUND_OPEN.includes(r.status || 'new'),
  refundLate(r) { return this.refundOpen(r) && !!r.deadline && r.deadline < today(); },
  refundsIn(m, product) {
    const list = Store.all('refunds').filter(r => r.status === 'refunded' && monthOf(r.refundedAt || r.date || '') === m && (!product || (r.product || 'sub') === product));
    return {n: list.length, sum: sum(list, r => r.amount)};
  },
  failed() { return this.byDate(Store.all('failed')); },
  failOpen: f => FAIL_OPEN.includes(f.status || 'new'),
  failDue(f) { return this.failOpen(f) && ((f.status || 'new') === 'new' || !f.next || f.next <= today()); },
  orders() { return Store.all('orders').sort((a, b) => (Number(b.no) || 0) - (Number(a.no) || 0)); },
  orderTotal: o => sum(o.items || [], it => (Number(it.qty) || 0) * (Number(it.price) || 0)) + (Number(o.shipCost) || 0),
  toShip: o => o.pay === 'paid' && ['new', 'packing'].includes(o.delivery || 'new'),
  products() { return Store.all('products').filter(p => p.title).sort((a, b) => String(a.title).localeCompare(String(b.title), 'ru')); },
  courses() { return Store.all('courses').filter(c => c.title).sort((a, b) => (a.at || 0) - (b.at || 0)); },
  courseSale(c, m) {
    const x = (c.sales || {})[m] || {};
    const n = Number(x.n) || 0;
    const revenue = isSet(x.revenue) ? Number(x.revenue) || 0 : n * (Number(c.price) || 0);
    return {n, revenue, author: Math.round(revenue * (Number(c.authorPct) || 0) / 100), own: isSet(x.revenue)};
  },
  courseLedger: m => Store.all('ledger').find(e => e.courseMonth === m) || null,
  authorId: (cid, m) => `author_${cid}_${m}`,
  sellerId: (name, m) => `seller_s${hashStr(normTitle(name)).toString(36)}_${m}`,

  /* начисления к выплате: рефералам — записями, авторам и продавцам — из продаж;
     текущий месяц ещё «начисляется», к выплате — закрытые месяцы */
  accruals() {
    const cur = monthOf(today()), out = [];
    Store.all('payouts').filter(p => p.kind === 'ref' && p.to).forEach(p => out.push({kind: 'ref', id: p.id, to: p.to, contact: p.contact || '', month: p.month, amount: Number(p.amount) || 0,
      base: Number(p.base) || 0, n: Number(p.n) || 0, pct: Number(p.pct) || 0, note: p.note || '', paid: p.status === 'paid', paidAt: p.paidAt || '', doc: p, closed: true}));
    this.courses().forEach(c => finMonths().forEach(m => {
      const s = this.courseSale(c, m);
      if (!s.author) return;
      const id = this.authorId(c.id, m), p = Store.get('payouts', id);
      out.push({kind: 'author', id, to: c.author || 'Автор курса', contact: c.authorContact || '', course: c, month: m, amount: s.author, n: s.n, revenue: s.revenue,
        paid: !!(p && p.status === 'paid'), paidAt: (p && p.paidAt) || '', doc: p, closed: m < cur});
    }));
    finMonths().forEach(m => Market.split(m).sellers.forEach(x => {
      if (!x.payout) return;
      const id = this.sellerId(x.seller, m), p = Store.get('payouts', id);
      out.push({kind: 'seller', id, to: x.seller, month: m, amount: Math.round(x.payout), revenue: x.turnover, fee: x.fee, paid: !!(p && p.status === 'paid'), paidAt: (p && p.paidAt) || '', doc: p, closed: m < cur});
    }));
    return out.sort((a, b) => (a.paid - b.paid) || String(b.month).localeCompare(String(a.month)));
  },
  payoutsDue() {
    const list = this.accruals().filter(x => !x.paid && x.closed);
    const by = k => sum(list.filter(x => x.kind === k), x => x.amount);
    return {list, ref: by('ref'), author: by('author'), seller: by('seller'), total: sum(list, x => x.amount)};
  },
  /* выплатить: расход в журнал + отметка «выплачено» */
  pay(acc) {
    const date = today();
    const lid = Store.add('ledger', {kind: 'out', amount: acc.amount, cat: PAYOUT_KINDS[acc.kind].cat, date,
      note: `${PAYOUT_KINDS[acc.kind].name}: ${acc.to}${acc.course ? ' · ' + acc.course.title : ''} · ${monthName(acc.month).toLowerCase()}`, payoutId: acc.id, by: Tasks.meKey(), at: Date.now()});
    const {id: _drop, ...base} = acc.doc || {kind: acc.kind, to: acc.to, month: acc.month, ...(acc.course ? {courseId: acc.course.id} : {}), at: Date.now()};
    Store.put('payouts', acc.id, {...base, amount: acc.amount, status: 'paid', paidAt: date, ledgerId: lid, paidBy: Tasks.meKey()});
  },
  unpay(acc) {
    Store.all('ledger').filter(e => e.payoutId === acc.id).forEach(e => Store.remove('ledger', e.id));
    if (acc.kind === 'ref') Store.patch('payouts', acc.id, {status: 'accrued', paidAt: null, ledgerId: null});
    else Store.remove('payouts', acc.id);
  },

  /* что требует действий финансов */
  attention() {
    const refunds = Store.all('refunds').filter(r => this.refundOpen(r));
    const failed = Store.all('failed').filter(f => this.failOpen(f));
    return {
      refunds, late: refunds.filter(r => this.refundLate(r)),
      failed, failedDue: failed.filter(f => this.failDue(f)), failedSum: sum(failed, f => f.amount),
      ship: Store.all('orders').filter(o => this.toShip(o)),
      low: this.products().filter(p => !p.seller && isSet(p.stock) && Number(p.stock) <= 3),
      payouts: this.payoutsDue(),
    };
  },
  badge() {
    if (!Auth.can('fin.ops')) return 0;
    const a = this.attention();
    return a.refunds.length + a.failedDue.length + a.ship.length;
  },
};

/* ── маркетплейс: оплата заказа ↔ журнал и склад ── */
const Market = {
  nextNo() { return 1 + Math.max(0, ...Store.all('orders').map(o => Number(o.no) || 0)); },
  /* привести журнал и склад к статусу заказа: оплачен — приход; возврат —
     ещё и расход «Возвраты клиентам»; свой товар списан со склада, пока заказ
     оплачен и не отменён */
  sync(id) {
    const o = Store.get('orders', id);
    if (!o) return;
    const led = Store.all('ledger').filter(e => e.orderId === id);
    const inE = led.find(e => e.kind === 'in'), outE = led.find(e => e.kind === 'out');
    const total = Fin.orderTotal(o), by = Tasks.meKey(), at = Date.now();
    const wantIn = o.pay === 'paid' || o.pay === 'refund', wantOut = o.pay === 'refund';
    if (wantIn && !inE) Store.add('ledger', {kind: 'in', amount: total, cat: 'market', date: o.paidAt || today(), note: `Заказ №${o.no}${o.customer ? ' · ' + o.customer : ''}`, orderId: id, by, at});
    else if (wantIn && inE && Number(inE.amount) !== total) Store.patch('ledger', inE.id, {amount: total});
    else if (!wantIn && inE) Store.remove('ledger', inE.id);
    if (wantOut && !outE) Store.add('ledger', {kind: 'out', amount: total, cat: 'refunds', date: today(), note: `Возврат по заказу №${o.no}`, orderId: id, by, at});
    else if (!wantOut && outE) Store.remove('ledger', outE.id);
    const need = {};
    if (o.pay === 'paid' && o.delivery !== 'cancelled') (o.items || []).forEach(it => {
      const p = it.productId ? Store.get('products', it.productId) : null;
      if (p && !p.seller) need[p.id] = (need[p.id] || 0) + (Number(it.qty) || 0);
    });
    const have = o.stockOut || {};
    let moved = false;
    new Set([...Object.keys(need), ...Object.keys(have)]).forEach(pid => {
      const delta = (need[pid] || 0) - (Number(have[pid]) || 0);
      const p = Store.get('products', pid);
      if (delta && p && isSet(p.stock)) { Store.patch('products', pid, {stock: (Number(p.stock) || 0) - delta}); moved = true; }
    });
    if (moved || JSON.stringify(need) !== JSON.stringify(have)) Store.put('orders', id, {...Store.get('orders', id), stockOut: need});
  },
  setPay(id, pay) {
    const o = Store.get('orders', id);
    if (!o || o.pay === pay) return;
    Store.patch('orders', id, {pay, ...(pay === 'paid' && !o.paidAt ? {paidAt: today()} : {}), ...(pay === 'wait' ? {paidAt: null} : {})});
    this.sync(id);
  },
  setDelivery(id, delivery) {
    const o = Store.get('orders', id);
    if (!o || o.delivery === delivery) return;
    Store.patch('orders', id, {delivery, ...(delivery === 'shipped' && !o.shippedAt ? {shippedAt: today()} : {})});
    this.sync(id);
  },
  /* распределение выручки месяца: свои товары — маржа клуба; товары продавцов —
     комиссия клуба и выплата продавцу */
  split(m) {
    const orders = Store.all('orders').filter(o => o.pay === 'paid' && o.delivery !== 'cancelled' && monthOf(o.paidAt || o.date || '') === m);
    const own = {rev: 0, cost: 0}, sellers = {};
    let revenue = 0, shipping = 0;
    orders.forEach(o => {
      shipping += Number(o.shipCost) || 0;
      (o.items || []).forEach(it => {
        const amount = (Number(it.qty) || 0) * (Number(it.price) || 0);
        revenue += amount;
        if (it.seller) {
          const x = sellers[it.seller] = sellers[it.seller] || {seller: it.seller, turnover: 0, fee: 0, payout: 0, orders: 0};
          const fee = amount * (Number(it.fee) || 0) / 100;
          x.turnover += amount; x.fee += fee; x.payout += amount - fee; x.orders++;
        } else {
          own.rev += amount;
          own.cost += (Number(it.qty) || 0) * (Number(it.cost) || 0);
        }
      });
    });
    const list = Object.values(sellers);
    return {orders, revenue: revenue + shipping, goods: revenue, shipping, own, sellers: list,
      club: own.rev - own.cost + sum(list, x => x.fee) + shipping, toSellers: sum(list, x => x.payout)};
  },
};

/* ── чек и юнит-экономика за период ── */
function unitEcon(from, to) {
  const s = settings(), f = Sales.range(from, to);
  const pays = f.pays + f.renewals;
  const check = pays ? f.revenue / pays : s.price;
  let spend = 0;
  Store.all('ledger').forEach(e => { if (e.kind === 'out' && e.date >= from && e.date <= to && ['marketing', 'referral'].includes(e.cat)) spend += Number(e.amount) || 0; });
  const cac = f.pays ? spend / f.pays : null;
  const varShare = (Number(s.acquiring) || 0) + (Number(s.taxRate) || 0);
  const margin = check * (1 - varShare);
  const rate = Subs.rate();
  const renew = rate && rate.renew !== null ? rate.renew : s.retention;
  const churn = Math.max(0.02, 1 - renew);
  const life = Math.min(36, 1 / churn);
  const ltv = margin * life;
  return {from, to, f, pays, check, spend, cac, varShare, margin, renew, renewPlan: !(rate && rate.renew !== null), churn, life, ltv,
    ltvCac: cac ? ltv / cac : null, payback: cac && margin ? cac / margin : null};
}
