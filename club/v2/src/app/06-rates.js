/* Ставки по срокам и порогам. У каждой ставки — периоды «с какого месяца»
   (до регистрации ООО, после регистрации, с IT-льготами), а в каждом периоде —
   ступени по порогу за календарный год: до порога одна ставка, со всего, что
   сверх порога, — другая. Взносы считаются от зарплаты каждого человека с начала
   года, налог, НДС и эквайринг — от выручки клуба с начала года. Хранится в
   settings.rates; без него — одна ставка из старых полей insurance, taxRate, acquiring. */

const RATE_DEFS = {
  insurance: {name: 'Страховые взносы', of: 'от зарплаты', year: 'зарплата человека с начала года', legacy: 'insurance'},
  tax:       {name: 'Налог', of: 'от выручки', year: 'выручка клуба с начала года', legacy: 'taxRate'},
  vat:       {name: 'НДС', of: 'от выручки', year: 'выручка клуба с начала года', legacy: null},
  acquiring: {name: 'Эквайринг', of: 'от выручки', year: 'выручка клуба с начала года', legacy: 'acquiring'},
};
const RATE_KEYS = Object.keys(RATE_DEFS);

/* ступени: по возрастанию порога, последняя — без порога («сверх») */
function cleanSteps(steps) {
  const list = (Array.isArray(steps) ? steps : []).filter(x => x && typeof x === 'object')
    .map(x => ({upTo: Number(x.upTo) > 0 ? Math.round(Number(x.upTo)) : null, rate: clamp(Number(x.rate) || 0, 0, 1)}));
  const caps = [];
  list.filter(x => x.upTo !== null).sort((a, b) => a.upTo - b.upTo).forEach(x => { if (!caps.length || caps[caps.length - 1].upTo !== x.upTo) caps.push(x); });
  const open = list.find(x => x.upTo === null);
  return [...caps, {upTo: null, rate: open ? open.rate : caps.length ? caps[caps.length - 1].rate : 0}];
}
function rateTable(key, s = settings()) {
  const own = s.rates && Array.isArray(s.rates[key]) ? s.rates[key].filter(p => p && typeof p === 'object') : [];
  if (!own.length) {
    const legacy = RATE_DEFS[key].legacy;
    return [{from: '', label: '', steps: [{upTo: null, rate: legacy ? clamp(Number(s[legacy]) || 0, 0, 1) : 0}]}];
  }
  const t = own.map(p => ({from: /^\d{4}-\d{2}$/.test(p.from || '') ? p.from : '', label: String(p.label || '').slice(0, 60), steps: cleanSteps(p.steps)}))
    .sort((a, b) => a.from.localeCompare(b.from));
  t[0].from = '';   // первый период действует с самого начала
  return t;
}
function ratePeriod(key, m, s = settings()) {
  const t = rateTable(key, s);
  let p = t[0];
  t.forEach(x => { if (x.from <= m) p = x; });
  return p;
}
/* сколько начислить с суммы amount в месяце m, если база с начала года уже набрала before */
function rateCharge(key, m, amount, before = 0, s = settings()) {
  const lo = Math.max(0, Number(before) || 0), hi = lo + Math.max(0, Number(amount) || 0);
  let charge = 0, floor = 0;
  for (const st of ratePeriod(key, m, s).steps) {
    const capV = st.upTo === null ? Infinity : st.upTo;
    const part = Math.min(hi, capV) - Math.max(lo, floor);
    if (part > 0) charge += part * st.rate;
    floor = capV;
    if (capV >= hi) break;
  }
  return charge;
}
/* ставка, которая действует сейчас: ступень, в которой стоит база с начала года */
function rateAt(key, m, base = 0, s = settings()) {
  const steps = ratePeriod(key, m, s).steps, b = Math.max(0, Number(base) || 0);
  return (steps.find(st => st.upTo === null || b < st.upTo) || steps[steps.length - 1]).rate;
}
/* выручка подписок с начала года до начала месяца m */
const revenueBefore = m => Sales.range(m.slice(0, 4) + '-01-01', addDays(monthStart(m), -1)).revenue;

/* подписи: «15% до 2,4 млн ₽ в год, сверх — 7,6%» · «30%» */
function stepsText(steps) {
  if (steps.length === 1) return pctA(steps[0].rate);
  return steps.map((st, i) => (st.upTo === null ? `сверх — ${pctA(st.rate)}` : `${pctA(st.rate)} до ${money(st.upTo)}${i ? '' : ' в год'}`)).join(', ');
}
const monthFrom = m => `с ${MONTHS_GEN[monthIdx(m)]} ${m.slice(0, 4)}`;
/* ставка на месяц одной строкой — для подсказок у сумм */
const rateText = (key, m = monthOf(today())) => stepsText(ratePeriod(key, m).steps);
/* «0% → с ноября 2026: 30% → с февраля 2027: 15% до 2,4 млн ₽ в год, сверх — 7,6%» */
function rateTimeline(key) {
  return rateTable(key).map((p, i) => `${i ? monthFrom(p.from) + ': ' : ''}${stepsText(p.steps)}`).join(' → ');
}
/* месяцы для выбора начала периода: с прошлого января на три года вперёд */
function rateMonths() {
  const y = Number(today().slice(0, 4)), out = [];
  for (let yy = y - 1; yy <= y + 2; yy++) for (let mm = 1; mm <= 12; mm++) out.push(`${yy}-${String(mm).padStart(2, '0')}`);
  return out;
}
