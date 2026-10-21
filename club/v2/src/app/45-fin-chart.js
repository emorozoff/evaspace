/* «Финансы» → «Обзор»: график в стиле биржевого. По дням с начала учёта до
   31 декабря: деньги на счёте, выручка, расходы и вложения (накопительно за
   выбранный период). До сегодня — факт из журнала и «Цифр дня», дальше —
   прогноз пунктиром: то, что осталось по Cash Flow месяца, ровно по дням.
   Что показать и за какой период — переключатели над графиком. */

const FC_SERIES = {
  cash:   {name: 'Деньги на счёте', color: 'var(--gold-brand)'},
  rev:    {name: 'Выручка',         color: 'var(--good)'},
  out:    {name: 'Расходы',         color: 'var(--bad)'},
  invest: {name: 'Вложения',        color: 'var(--violet)'},
};
const FC_PERIODS = [['month', 'Месяц'], ['quarter', 'Квартал'], ['all', 'Весь срок']];

/* приход, расход и вложения по дням: факт до сегодня, дальше остаток Cash Flow месяца поровну */
function finDaily(sc) {
  const s = settings(), t = today(), cf = cashFlow(sc);
  const from = s.cashDate && s.cashDate < monthStart(CF_MONTHS[0]) ? s.cashDate : monthStart(CF_MONTHS[0]);
  const to = monthEnd(CF_MONTHS[CF_MONTHS.length - 1]);
  const fact = {};
  const add = (d, k, v) => { (fact[d] = fact[d] || {rev: 0, out: 0, invest: 0})[k] += v; };
  Store.all('ledger').forEach(e => { if (!KINDS[e.kind] || !e.date) return; const a = Number(e.amount) || 0; add(e.date, e.kind === 'out' ? 'out' : e.kind === 'invest' ? 'invest' : 'rev', a); });
  Sales.list().forEach(x => add(x.id, 'rev', revenueOf(x)));
  /* прогноз месяца: сколько ещё придёт и уйдёт после сегодня */
  const plan = {};
  cf.forEach(r => {
    if (r.status === 'fact') return;
    const days = [];
    for (let d = r.status === 'now' ? addDays(t, 1) : monthStart(r.m); d <= monthEnd(r.m); d = addDays(d, 1)) days.push(d);
    if (!days.length) return;
    const done = {rev: 0, out: 0, invest: 0};
    if (r.status === 'now') for (let d = monthStart(r.m); d <= t; d = addDays(d, 1)) { const f = fact[d]; if (f) { done.rev += f.rev; done.out += f.out; done.invest += f.invest; } }
    const left = {rev: Math.max(0, r.inTotal - done.rev), out: Math.max(0, r.outTotal - done.out), invest: Math.max(0, r.invest - done.invest)};
    days.forEach(d => { plan[d] = {rev: left.rev / days.length, out: left.out / days.length, invest: left.invest / days.length}; });
  });
  const out = [];
  let cash = Number(s.cashStart) || 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const isFact = d <= t, v = (isFact ? fact[d] : plan[d]) || {rev: 0, out: 0, invest: 0};
    if (d >= (s.cashDate || from)) cash += v.rev + v.invest - v.out;
    out.push({d, fact: isFact, cash, rev: v.rev, out: v.out, invest: v.invest});
  }
  return out;
}

function finChartHtml(sc) {
  const per = View.get('fin.fcp', 'quarter'), on = View.get('fin.fcs', ['cash', 'rev', 'out', 'invest']);
  const t = today(), days = finDaily(sc);
  const lo = per === 'month' ? monthStart(monthOf(t)) : per === 'quarter' ? Q.start : days[0].d;
  const hi = per === 'month' ? monthEnd(monthOf(t)) : Q.end;
  const win = days.filter(x => x.d >= lo && x.d <= hi);
  if (!win.length) return '';
  /* потоки — накопительно с начала периода, деньги на счёте — как есть */
  const acc = {rev: 0, out: 0, invest: 0};
  const pts = win.map(x => { acc.rev += x.rev; acc.out += x.out; acc.invest += x.invest; return {...x, cum: {cash: x.cash, rev: acc.rev, out: acc.out, invest: acc.invest}}; });
  const ti = pts.findIndex(x => x.d === t);
  const series = [];
  on.filter(k => FC_SERIES[k]).forEach(k => {
    const f = FC_SERIES[k];
    series.push({group: k, name: f.name, color: f.color, width: k === 'cash' ? 2.5 : 2, area: k === 'cash', values: pts.map(x => (x.fact ? kop(x.cum[k]) : null))});
    series.push({group: k, name: f.name + ' · прогноз', color: f.color, width: k === 'cash' ? 2.5 : 2, dash: true, values: pts.map((x, i) => (!x.fact || i === ti ? kop(x.cum[k]) : null))});
  });
  const labels = pts.map(x => ({text: dayLong(x.d), tick: x.d.endsWith('-01') || (per === 'month' && /-(08|15|22)$/.test(x.d)) ? dayShort(x.d) : ''}));
  /* шапка как у котировки: сколько на счёте сейчас и куда идём к концу периода */
  const now = ti >= 0 ? pts[ti] : pts[pts.length - 1], end = pts[pts.length - 1], start = pts[0];
  const delta = now.cash - start.cash, toEnd = end.cash - now.cash;
  const chip = k => `<button type="button" class="chip fc-chip ${on.includes(k) ? 'on' : ''}" data-fcs="${k}" style="--c:${FC_SERIES[k].color}"><i></i>${FC_SERIES[k].name}</button>`;
  return `<section class="section card fin-chart">
    <div class="fc-head">
      <div class="fc-quote"><span class="label">Деньги на счёте · ${ti >= 0 ? 'сегодня' : dayLong(now.d)}</span>
        <b class="fc-big">${money(now.cash)}</b>
        <span class="fc-delta ${delta < 0 ? 'bad' : 'good'}">${delta < 0 ? '▼' : '▲'} ${signedMoney(delta)} с ${dayLong(start.d)}</span>
        ${end.d > t ? `<span class="fc-delta soft">к ${dayLong(end.d)} по прогнозу ${money(end.cash)} (${signedMoney(toEnd)})</span>` : ''}</div>
      ${finSeg('fcp', FC_PERIODS, per)}
    </div>
    <div class="chips fc-chips">${Object.keys(FC_SERIES).map(chip).join('')}</div>
    ${series.length ? stockChart({labels, series, today: ti}) : '<p class="note">Выберите, что показать.</p>'}
    <p class="note">Сплошная линия — факт, пунктир — прогноз по плану платежей и сценарию продаж «${esc(SCENARIOS[sc].name)}». Выручка, расходы и вложения — накопительно с начала периода.</p>
  </section>`;
}
/* линейный график с минусом по оси Y, вертикалью «сегодня» и подсказкой в деньгах */
function stockChart({labels, series, today: ti = -1, height = 300}) {
  const W = chartWidth(), H = height, L = W < 520 ? 92 : 112, R = 16, T = 18, B = 26;
  const n = labels.length;
  const vals = series.flatMap(s => s.values.filter(v => v !== null));
  let mn = Math.min(0, ...vals), mx = Math.max(0, ...vals);
  const step = niceScale(Math.max(1, mx - mn), false, 5).step;
  mn = Math.floor(mn / step) * step; mx = Math.max(mn + step, Math.ceil(mx / step) * step);
  const x = i => L + (n <= 1 ? 0 : (i / (n - 1)) * (W - L - R));
  const y = v => T + (1 - (v - mn) / (mx - mn)) * (H - T - B);
  let g = '';
  for (let v = mn; v <= mx + step / 2; v += step) g += `<line class="grid ${Math.abs(v) < step / 1e6 ? 'zero' : ''}" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${esc(money(v))}</text>`;
  labels.forEach((lb, i) => { if (lb.tick) g += `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${esc(lb.tick)}</text>`; });
  if (ti >= 0) g += `<line class="fc-today" x1="${x(ti)}" x2="${x(ti)}" y1="${T}" y2="${H - B}"/><text class="fc-today-t" x="${x(ti) + 5}" y="${T + 10}">сегодня</text>`;
  let marks = '';
  series.forEach(s => {
    const pts = s.values.map((v, i) => (v === null ? null : [x(i), y(v)])).filter(Boolean);
    if (!pts.length) return;
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
    if (s.area) marks += `<path d="${d}L${pts[pts.length - 1][0].toFixed(1)} ${y(Math.max(mn, 0))}L${pts[0][0].toFixed(1)} ${y(Math.max(mn, 0))}Z" fill="${s.color}" opacity=".12"/>`;
    marks += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width || 2}" stroke-linecap="round" stroke-linejoin="round" ${s.dash ? 'stroke-dasharray="5 5" opacity=".85"' : ''}/>`;
    if (!s.dash && ti >= 0 && s.values[ti] !== null) marks += `<circle cx="${x(ti)}" cy="${y(s.values[ti])}" r="4.5" fill="${s.color}" stroke="var(--surface)" stroke-width="2"/>`;
  });
  const data = esc(JSON.stringify({fmt: 'money', labels: labels.map(l => l.text), series: series.map(s => ({name: s.name, group: s.group, color: s.color, dash: !!s.dash, values: s.values}))}));
  return `<div class="chart-box" data-chart="line" data-cfg="${data}" data-geo="${[W, H, L, R, T, B].join(',')}">
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="График денег по дням">${g}${marks}<line class="cross" x1="0" x2="0" y1="${T}" y2="${H - B}" hidden/></svg>
    <div class="chart-tip" hidden></div></div>`;
}
