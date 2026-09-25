/* Расчёты для главной, денег и отчётов — в одном месте, чтобы цифры везде
   совпадали. Продажа = первая оплата подписки. Выручка дня считается сама:
   (оплаты + продления) × цена, если её не поправили руками. */

/* ── продажи ── */
function revenueOf(s) {
  const own = s.revenue;
  if (own !== undefined && own !== null && own !== '') return Number(own) || 0;
  return ((Number(s.pays) || 0) + (Number(s.renewals) || 0)) * settings().price;
}
const Sales = {
  list() { return Store.all('sales').filter(s => /^\d{4}-\d\d-\d\d$/.test(s.id)).sort((a, b) => (a.id < b.id ? -1 : 1)); },
  day(iso) { return Store.get('sales', iso); },
  agg(list) {
    const price = settings().price;
    const a = {reach: 0, regs: 0, pays: 0, renewals: 0, revenue: 0, revNew: 0, revRenew: 0, experts: 0, mk: 0, days: 0};
    list.forEach(s => {
      a.reach += Number(s.reach) || 0;
      a.regs += Number(s.regs) || 0;
      a.pays += Number(s.pays) || 0;
      a.renewals += Number(s.renewals) || 0;
      const rev = revenueOf(s), renew = Math.min(rev, (Number(s.renewals) || 0) * price);
      a.revenue += rev;
      a.revRenew += renew;
      a.revNew += rev - renew;
      a.experts += Number(s.experts) || 0;
      a.mk += Number(s.mk) || 0;
      a.days++;
    });
    return a;
  },
  range(from, to) { return this.agg(this.list().filter(s => s.id >= from && s.id <= to)); },
  month(m) { return this.range(monthStart(m), monthEnd(m)); },
};

/* ── план продаж ── */
const Plan = {
  /* продажи месяца по сценарию; сентябрь — подготовка, плана нет */
  sales(sc, m) { return Q.months.includes(m) ? scenarioSales(sc)[m] : 0; },
  day(sc, iso) { const m = monthOf(iso); return this.sales(sc, m) / daysInMonth(m); },
  range(sc, from, to) {
    let s = 0;
    for (let d = from; d <= to; d = addDays(d, 1)) s += this.day(sc, d);
    return s;
  },
  regs(sales) { return sales / (settings().convPay || 0.05); },
  reach(sales) { return this.regs(sales) / (settings().convReg || 0.02); },
  total(sc) { return sum(Q.months, m => this.sales(sc, m)); },
  /* цепочка по плану: новые + продления при удержании */
  chain(sc) {
    const s = settings();
    let payers = 0;
    return CF_MONTHS.map(m => {
      const fresh = this.sales(sc, m);
      const renewals = payers * s.retention;
      payers = fresh + renewals;
      return {m, fresh, renewals, revNew: fresh * s.price, revRenew: renewals * s.price};
    });
  },
};

/* ход квартала: сколько продано, где должны быть, куда идём */
function quarterPace(sc) {
  const t = today();
  const started = t >= Q.start, over = t > Q.end;
  const to = over ? Q.end : t;
  const fact = started ? Sales.range(Q.start, to).pays : 0;
  const planToDate = started ? Plan.range(sc, Q.start, to) : 0;
  const total = Plan.total(sc);
  const daysAll = daysBetween(Q.start, Q.end) + 1;
  const daysGone = started ? daysBetween(Q.start, to) + 1 : 0;
  const daysLeft = daysAll - daysGone;
  const projected = daysGone ? Math.round(fact / daysGone * daysAll) : 0;
  const needPerDay = daysLeft > 0 ? Math.max(0, (total - fact) / daysLeft) : 0;
  let heading = 'ниже минимума';
  if (projected >= Plan.total('max')) heading = 'на «Прорыв»';
  else if (projected >= Plan.total('goal')) heading = 'на «Цель»';
  else if (projected >= Plan.total('min')) heading = 'на «Минимум»';
  return {started, over, fact, planToDate, total, daysAll, daysGone, daysLeft, projected, needPerDay, heading,
    toStart: started ? 0 : daysBetween(t, Q.start)};
}
/* премия команды: 30% чистого дохода (выручка первых платежей минус реферальные 30%) */
function premiumOf(salesCount, revNew) {
  const s = settings();
  if (salesCount < s.premiumMin) return 0;
  return revNew * (1 - s.referral) * s.premium;
}

/* ── деньги ── */
const Money = {
  ledger() { return Store.all('ledger').sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.at || 0) - (a.at || 0))); },
  month(m) {
    const t = {in: 0, out: 0, invest: 0, cats: {in: {}, out: {}, invest: {}}};
    Store.all('ledger').forEach(e => {
      if (monthOf(e.date) !== m || !KINDS[e.kind]) return;
      const a = Number(e.amount) || 0;
      t[e.kind] += a;
      t.cats[e.kind][e.cat] = (t.cats[e.kind][e.cat] || 0) + a;
    });
    return t;
  },
  planItems() {
    const order = {payroll: 0, regular: 1, once: 2};
    return Store.all('plan').sort((a, b) => (order[a.group] ?? 3) - (order[b.group] ?? 3) || (a.months || [])[0]?.localeCompare((b.months || [])[0] || '') || (b.amount || 0) - (a.amount || 0));
  },
  planAmount(item, m) {
    if (!(item.months || []).includes(m)) return 0;
    const who = item.personId ? personById(item.personId) : null;
    if (who && (who.status === 'inactive' || who.archived)) return 0;   // не активирован — не платим
    const base = Number(item.amount) || 0;
    return item.group === 'payroll' && item.insurance !== false ? Math.round(base * (1 + settings().insurance)) : base;
  },
  paid(item, m) { return Store.all('ledger').find(e => e.planId === item.id && e.planMonth === m) || null; },
  /* план расходов месяца по статьям: всего и ещё не оплачено */
  planByCat(m) {
    const all = {}, unpaid = {};
    this.planItems().forEach(it => {
      const a = this.planAmount(it, m);
      if (!a) return;
      const cat = it.group === 'payroll' ? 'payroll' : (it.cat || 'other');
      all[cat] = (all[cat] || 0) + a;
      if (!this.paid(it, m)) unpaid[cat] = (unpaid[cat] || 0) + a;
    });
    return {all, unpaid};
  },
  /* деньги на счёте: старт + приходы + вложения + выручка − расходы после даты старта */
  cashNow() {
    const s = settings(), t = today();
    let cash = Number(s.cashStart) || 0;
    Store.all('ledger').forEach(e => {
      if (e.date < s.cashDate || e.date > t) return;
      const a = Number(e.amount) || 0;
      cash += e.kind === 'out' ? -a : a;
    });
    cash += Sales.range(s.cashDate, t).revenue;
    return cash;
  },
};

const VAR_CATS = ['referral', 'acquiring', 'tax'];
const FIXED_CATS = Object.keys(OUT_CATS).filter(c => !VAR_CATS.includes(c));

/* ── Cash Flow до Нового года: прошлые месяцы — факт, текущий — факт плюс
   остаток плана, будущие — план. Выручка — по выбранному сценарию. ── */
function cashFlow(sc) {
  const s = settings(), t = today(), cur = monthOf(t);
  let open = Number(s.cashStart) || 0;
  let prevPayers = 0;
  return CF_MONTHS.map(m => {
    const status = m < cur ? 'fact' : m === cur ? 'now' : 'plan';
    const f = Sales.month(m), led = Money.month(m), plan = Money.planByCat(m);
    const planFresh = Plan.sales(sc, m);
    let fresh, renewCount, revNew, revRenew;
    if (status === 'fact') {
      fresh = f.pays; renewCount = f.renewals; revNew = f.revNew; revRenew = f.revRenew;
    } else {
      const restDays = status === 'now' ? Math.max(0, daysBetween(t, monthEnd(m))) : daysInMonth(m);
      const restPlan = planFresh * restDays / daysInMonth(m);
      fresh = f.pays + restPlan;
      renewCount = Math.max(f.renewals, prevPayers * s.retention);
      revNew = f.revNew + restPlan * s.price;
      revRenew = Math.max(f.revRenew, renewCount * s.price);
    }
    prevPayers = fresh + renewCount;
    const otherIn = led.in;
    const invest = status === 'fact' ? led.invest : Math.max(led.invest, Number((s.invest || {})[m]) || 0);
    const revenue = revNew + revRenew;
    const out = {};
    FIXED_CATS.forEach(c => {
      out[c] = (led.cats.out[c] || 0) + (status === 'fact' ? 0 : (plan.unpaid[c] || 0));
    });
    const varBase = {referral: revNew * s.referral, acquiring: revenue * s.acquiring, tax: revenue * s.taxRate};
    VAR_CATS.forEach(c => {
      out[c] = status === 'fact' ? (led.cats.out[c] || 0) : Math.max(led.cats.out[c] || 0, varBase[c]);
    });
    const inTotal = revenue + otherIn;
    const outTotal = sum(Object.values(out));
    const close = open + inTotal + invest - outTotal;
    const row = {m, status, open, fresh, renewCount, revNew, revRenew, otherIn, invest, out, inTotal, outTotal, net: inTotal + invest - outTotal, close};
    open = close;
    return row;
  });
}

/* ── P&L по месяцам: факт и план ── */
function pnl(sc) {
  const s = settings();
  const chain = Plan.chain(sc);
  return CF_MONTHS.map((m, i) => {
    const f = Sales.month(m), led = Money.month(m), plan = Money.planByCat(m);
    const c = chain[i];
    const factOut = {...led.cats.out};
    const planRev = c.revNew + c.revRenew;
    const planOut = {...plan.all, referral: c.revNew * s.referral, acquiring: planRev * s.acquiring, tax: planRev * s.taxRate};
    const fact = {subs: f.revenue, other: led.in, out: factOut, outTotal: led.out, invest: led.invest};
    fact.income = fact.subs + fact.other;
    fact.profit = fact.income - fact.outTotal;
    const pl = {subs: planRev, other: 0, out: planOut, outTotal: sum(Object.values(planOut))};
    pl.income = pl.subs;
    pl.profit = pl.income - pl.outTotal;
    return {m, fact, plan: pl};
  });
}