/* Метрики: воронка продаж квартала одной лентой сверху вниз.
   Охват → просмотры → переходы → регистрации → покупки → продления.
   Проценты между шагами правятся прямо на ленте, числа пересчитываются
   сразу, итог — справа. Два вопроса: «сколько продаж даст охват» и
   «какой охват нужен под план». Черновик у каждого свой; основатель
   сохраняет удачный вариант как план команды — тогда «Стратегия»,
   «Отчёты» и Cash Flow считают по нему. */

const FUNNEL = [
  {k: 'views',  c: 'view',  name: 'Просмотр',    of: 'охвата',      about: 'посмотрели ролик или пост', min: 1, max: 100, step: 1},
  {k: 'clicks', c: 'click', name: 'Переход',     of: 'просмотров',  about: 'перешли по ссылке на сайт или в приложение', min: 0.1, max: 40, step: 0.1},
  {k: 'regs',   c: 'reg',   name: 'Регистрация', of: 'переходов',   about: 'создали учётку в приложении', min: 1, max: 100, step: 1},
  {k: 'pays',   c: 'pay',   name: 'Покупка',     of: 'регистраций', about: 'первая оплата подписки — это продажа', min: 0.1, max: 40, step: 0.1},
  {k: 'renew',  c: 'renew', name: 'Продление',   of: 'платящих',    about: 'продлевают подписку в следующем месяце', min: 0, max: 100, step: 1},
];
/* шаги «что даст больше всего»: на сколько пунктов подвинуть каждую конверсию */
const LEVERS = {view: 0.05, click: 0.01, reg: 0.05, pay: 0.01, renew: 0.1};

/* воронка плана команды: шаг «переход → регистрация» выводится из convReg,
   поэтому старые настройки и «Стратегия» считают так же */
function funnelOf(s = settings()) {
  const f = s.funnel || {};
  const view = clamp(Number(f.view) || 0.4, 0.001, 1), click = clamp(Number(f.click) || 0.1, 0.0001, 1);
  return {view, click, reg: clamp((Number(s.convReg) || 0.02) / (view * click), 0.0001, 1), pay: Number(s.convPay) || 0.05, renew: clamp(Number(s.retention) || 0, 0, 1), price: Number(s.price) || 2900};
}
function mxPlanDraft(sc) {
  const s = settings(), f = funnelOf(s);
  const reach = Object.fromEntries(Q.months.map(m => {
    const own = s.reachPlan && s.reachPlan[m];
    return [m, own !== undefined && own !== null ? Number(own) : Math.round(Plan.reach(scenarioSales(sc)[m]) / 1000) * 1000];
  }));
  return {...f, reach};
}
const MX_KEYS = ['view', 'click', 'reg', 'pay', 'renew', 'price'];

const MxUI = {
  draft: null,
  get sc() { return View.get('mx.sc', settings().scenario); },
  get mode() { return View.get('mx.mode', 'forward'); },
  load() {
    if (!this.draft) {
      const saved = View.get('mx.draft', null);
      this.draft = saved && saved.reach ? saved : mxPlanDraft(this.sc);
    }
    return this.draft;
  },
  save() { View.set('mx.draft', this.draft); },
  reset() { this.draft = mxPlanDraft(this.sc); this.save(); },
};

/* расчёт квартала по воронке */
function mxCalc(f, mode, sc) {
  const plan = scenarioSales(sc);
  let prev = 0;
  const rows = Q.months.map(m => {
    let reach, views, clicks, regs, pays;
    if (mode === 'reverse') {
      pays = plan[m];
      regs = pays / Math.max(f.pay, 1e-6);
      clicks = regs / Math.max(f.reg, 1e-6);
      views = clicks / Math.max(f.click, 1e-6);
      reach = views / Math.max(f.view, 1e-6);
    } else {
      reach = Number(f.reach[m]) || 0;
      views = reach * f.view;
      clicks = views * f.click;
      regs = clicks * f.reg;
      pays = regs * f.pay;
    }
    const renewals = prev * f.renew;
    const active = pays + renewals;
    prev = active;
    return {m, reach, views, clicks, regs, pays, renewals, active, revNew: pays * f.price, revRenew: renewals * f.price, revenue: active * f.price, plan: plan[m]};
  });
  const tot = {};
  ['reach', 'views', 'clicks', 'regs', 'pays', 'renewals', 'revNew', 'revRenew', 'revenue', 'plan'].forEach(k => { tot[k] = sum(rows, r => r[k]); });
  tot.active = rows[rows.length - 1].active;
  return {rows, tot};
}
/* факт воронки за период из «Цифр дня» */
function mxFact(from, to) {
  const a = Sales.range(from, to);
  const conv = (x, y) => (y > 0 && x >= 0 ? x / y : null);
  /* продление: продления месяца ÷ платящие прошлого месяца */
  let renewRate = null;
  const months = Q.months.filter(m => monthStart(m) <= to && monthEnd(m) >= from);
  let ren = 0, base = 0;
  months.forEach(m => {
    const prev = Sales.month(addMonths(m, -1));
    const cur = Sales.month(m);
    if (prev.pays + prev.renewals > 0) { ren += cur.renewals; base += prev.pays + prev.renewals; }
  });
  if (base > 0) renewRate = ren / base;
  return {a, view: conv(a.views, a.reach), click: conv(a.clicks, a.views), reg: conv(a.regs, a.clicks || 0), regFromReach: conv(a.regs, a.reach), pay: conv(a.pays, a.regs), renew: renewRate};
}

/* шаги ленты и глаголы переходов между ними */
const MX_STEPS = [
  {k: 'reach',    name: 'Охват',       hint: 'увидели нас'},
  {k: 'views',    name: 'Просмотры',   hint: 'посмотрели ролик или пост',     c: 'view',  verb: 'посмотрят',             d: 1,   min: 1},
  {k: 'clicks',   name: 'Переходы',    hint: 'перешли на сайт или в приложение', c: 'click', verb: 'перейдут',          d: 0.5, min: 0.1},
  {k: 'regs',     name: 'Регистрации', hint: 'создали учётку',                c: 'reg',   verb: 'зарегистрируются',      d: 1,   min: 1},
  {k: 'pays',     name: 'Покупки',     hint: 'первая оплата — это продажа',   c: 'pay',   verb: 'купят',                 d: 0.5, min: 0.1},
  {k: 'renewals', name: 'Продления',   hint: 'за квартал',                    c: 'renew', verb: 'продлят в след. месяце', d: 5,   min: 0},
];
const mxPct = v => fmt(v * 100, v * 100 < 10 && Math.abs(v * 1000 - Math.round(v * 100) * 10) > 0.01 ? 1 : 0);
/* факт — за квартал, а до его старта — за сентябрь */
function mxFactRange() {
  const t = today();
  if (t >= Q.start) return {from: Q.start, to: t < Q.end ? t : Q.end, name: 'за квартал'};
  return {from: '2026-09-01', to: t, name: 'за сентябрь'};
}

App.register('metrics', {
  title: 'Метрики',
  render(root) {
    const sc = MxUI.sc, mode = MxUI.mode;
    const f = MxUI.load();
    const canSave = Auth.can('settings.edit');
    const rev = mode === 'reverse';

    const row = st => `<div class="mf2-row ${st.k === 'pays' ? 'main' : ''} ${st.k === 'renewals' ? 'renew' : ''}">
        <div class="mf2-name"><b>${st.name}</b><small>${st.hint}</small></div>
        <div class="mf2-bar"><i id="mxb-${st.k}"></i></div>
        <div class="mf2-val">${st.k === 'reach' && !rev
          ? `<input class="input num mx-reach-in" data-mreach-total inputmode="numeric" aria-label="Охват за квартал">`
          : `<b id="mxv-${st.k}"></b>`}</div>
      </div>`;
    const conv = st => `<div class="mf2-conv">
        <span class="mf2-arr" aria-hidden="true">↓</span>
        <div class="mx-pct"><button type="button" data-mstep="${st.c}" data-d="-1" aria-label="меньше">−</button><input class="input num" data-mc="${st.c}" inputmode="decimal" value="${mxPct(f[st.c])}" aria-label="${st.name}, %"><span>%</span><button type="button" data-mstep="${st.c}" data-d="1" aria-label="больше">+</button></div>
        <span class="mf2-verb">${st.verb}</span>
        <small class="mf2-hint" id="mxh-${st.c}"></small>
      </div>`;

    root.innerHTML = `
      ${pageHead('Метрики', 'Воронка продаж за квартал. Меняйте проценты между шагами — всё пересчитается сразу.',
        `<div class="seg" title="С каким планом сравнивать">${Object.entries(SCENARIOS).map(([k, x]) => `<button data-msc="${k}" class="${k === sc ? 'on' : ''}">${x.name} ${fmt(Plan.total(k))}</button>`).join('')}</div>${helpBtn('metrics')}`)}
      ${helpBox('metrics', `<b>Как читать.</b> Сверху вниз — путь человека: увидел → посмотрел → перешёл → зарегистрировался → купил → продлил. Между шагами — какой процент доходит до следующего; меняйте его кнопками − / + или числом. Под процентом — план команды и факт из «Цифр дня». Справа — итог квартала. Ваши правки видны только вам${canSave ? '; «Сделать планом команды» сохранит их для всех' : ''}.`)}
      <div class="seg mx-mode">
        <button data-mmode="forward" class="${!rev ? 'on' : ''}">Сколько продаж даст охват</button>
        <button data-mmode="reverse" class="${rev ? 'on' : ''}">Какой охват нужен под план «${SCENARIOS[sc].name}»</button>
      </div>
      <div class="mx2">
        <section class="card mx-flow">${MX_STEPS.map((st, i) => (i ? conv(st) : '') + row(st)).join('')}</section>
        <aside class="mx-side">
          <section class="card mx-res" id="mxRes"></section>
          <section class="card mx-set">
            <label class="field"><span>Цена подписки, ₽ в месяц</span><input class="input num" data-mprice inputmode="numeric" value="${fmt(f.price)}"></label>
            <div class="mx-act" id="mxAct"></div>
            <div class="mx-fact" id="mxFactLine"></div>
          </section>
        </aside>
      </div>
      <section class="card mx-lev section" id="mxLev"></section>
      <details class="section mx-months">
        <summary>По месяцам</summary>
        <div class="table-wrap"><table class="t grid-lines">
          <thead><tr><th></th>${Q.months.map(m => `<th class="r">${monthName(m)}</th>`).join('')}<th class="r">Квартал</th></tr></thead>
          ${!rev ? `<tbody><tr><td>Охват <span class="note">можно поправить</span></td>${Q.months.map(m => `<td class="r"><input class="input num sm" data-mreach="${m}" inputmode="numeric" value="${fmt(Math.round(f.reach[m] || 0))}"></td>`).join('')}<td class="r" id="mxMonReach"></td></tr></tbody>` : ''}
          <tbody id="mxMon"></tbody>
        </table></div>
        ${!rev && canSave ? `<p class="note">Нравится результат? <button class="link-btn" data-mtoplan>Записать эти продажи в план «${SCENARIOS[sc].name}»</button> — сценарий в «Стратегии» поменяется.</p>` : ''}
      </details>`;

    wireHelp(root);
    const paint = () => mxPaint(root, f, mode, sc);
    paint();
    const reachIn = $('[data-mreach-total]', root);
    if (reachIn) reachIn.value = fmt(Math.round(sum(Q.months, m => f.reach[m] || 0)));

    on(root, 'click', '[data-msc]', (e, el) => { View.set('mx.sc', el.dataset.msc); App.render(); });
    on(root, 'click', '[data-mmode]', (e, el) => { View.set('mx.mode', el.dataset.mmode); App.render(); });
    const setConv = (k, v) => {
      const st = MX_STEPS.find(x => x.c === k);
      f[k] = clamp(v, st.min / 100, 1);
      MxUI.save();
      paint();
    };
    on(root, 'click', '[data-mstep]', (e, el) => {
      const k = el.dataset.mstep, st = MX_STEPS.find(x => x.c === k);
      const cur = Math.round(f[k] * 1000) / 10;
      const next = Math.round((cur + Number(el.dataset.d) * st.d) / st.d) * st.d;
      setConv(k, next / 100);
      $(`[data-mc="${k}"]`, root).value = mxPct(f[k]);
    });
    on(root, 'input', '[data-mc]', (e, el) => { if (el.value.trim()) setConv(el.dataset.mc, parseNum(el.value) / 100); });
    on(root, 'change', '[data-mc]', (e, el) => { el.value = mxPct(f[el.dataset.mc]); });
    /* охват за квартал раскладываем по месяцам в прежней пропорции */
    on(root, 'input', '[data-mreach-total]', (e, el) => {
      const total = Math.max(0, parseNum(el.value));
      const cur = sum(Q.months, m => f.reach[m] || 0);
      const shape = cur > 0 ? Q.months.map(m => (f.reach[m] || 0) / cur) : Q.months.map(m => scenarioSales(sc)[m] / Plan.total(sc));
      Q.months.forEach((m, i) => {
        f.reach[m] = Math.round(total * shape[i]);
        const mi = $(`[data-mreach="${m}"]`, root); if (mi) mi.value = fmt(f.reach[m]);
      });
      MxUI.save();
      paint();
    });
    on(root, 'change', '[data-mreach-total]', (e, el) => { el.value = fmt(Math.round(sum(Q.months, m => f.reach[m] || 0))); });
    on(root, 'input', '[data-mreach]', (e, el) => {
      f.reach[el.dataset.mreach] = Math.max(0, parseNum(el.value));
      if (reachIn) reachIn.value = fmt(Math.round(sum(Q.months, m => f.reach[m] || 0)));
      MxUI.save();
      paint();
    });
    on(root, 'change', '[data-mreach]', (e, el) => { el.value = fmt(Math.round(f.reach[el.dataset.mreach] || 0)); });
    on(root, 'input', '[data-mprice]', (e, el) => { if (el.value.trim()) { f.price = Math.max(1, parseNum(el.value)); MxUI.save(); paint(); } });
    on(root, 'change', '[data-mprice]', (e, el) => { el.value = fmt(f.price); });
    on(root, 'click', '[data-mreset]', () => { MxUI.reset(); App.render(); });
    on(root, 'click', '[data-mfact]', () => {
      const r = mxFactRange(), fx = mxFact(r.from, r.to);
      let n = 0;
      ['view', 'click', 'reg', 'pay', 'renew'].forEach(k => { if (fx[k] !== null && fx[k] > 0 && fx[k] <= 1) { f[k] = fx[k]; n++; } });
      MxUI.save();
      toast(n ? `Взял из факта: ${n} ${plural(n, 'процент', 'процента', 'процентов')}` : 'Для процентов пока мало данных в «Цифрах дня»');
      App.render();
    });
    on(root, 'click', '[data-msave]', async (e, save) => {
      const c = mxCalc(f, mode, sc);
      if (!(await confirmPop(save, {text: 'Сделать планом команды? «Стратегия», «Отчёты» и Cash Flow будут считать по этой воронке.', yes: 'Да, сохранить'}))) return;
      const reachPlan = Object.fromEntries(c.rows.map(r => [r.m, Math.round(r.reach)]));
      saveSettings({funnel: {view: f.view, click: f.click}, convReg: f.view * f.click * f.reg, convPay: f.pay, retention: f.renew, price: Math.round(f.price), reachPlan});
      toast('Воронка сохранена как план команды');
      MxUI.draft = null;
      View.set('mx.draft', null);
      App.render();
    });
    on(root, 'click', '[data-mtoplan]', async (e, toPlan) => {
      const c = mxCalc(f, 'forward', sc);
      const next = Object.fromEntries(c.rows.map(r => [r.m, Math.round(r.pays)]));
      if (!(await confirmPop(toPlan, {text: `Записать в сценарий «${SCENARIOS[sc].name}» продажи ${Q.months.map(m => fmt(next[m])).join(' / ')}?`, yes: 'Записать'}))) return;
      saveSettings({plans: {[sc]: next}});
      toast(`План «${SCENARIOS[sc].name}» обновлён: ${fmt(sum(Object.values(next)))} продаж за квартал`);
      App.render();
    });
  },
});

/* перерисовка чисел без пересоздания полей ввода — фокус остаётся на месте */
function mxPaint(root, f, mode, sc) {
  const c = mxCalc(f, mode, sc), t = c.tot, rev = mode === 'reverse';
  const team = funnelOf();
  const fr = mxFactRange(), fx = mxFact(fr.from, fr.to);
  /* полосы: логарифмическая шкала, чтобы и 500 000, и 500 были видны */
  const lo = Math.log10(Math.max(1, Math.min(t.pays, t.renewals || t.pays))), hi = Math.log10(Math.max(10, t.reach));
  const w = v => clamp(hi > lo ? 10 + 90 * (Math.log10(Math.max(1, v)) - lo) / (hi - lo) : 100, 6, 100);
  MX_STEPS.forEach(st => {
    const v = t[st.k];
    const bar = $(`#mxb-${st.k}`, root); if (bar) bar.style.width = w(v).toFixed(1) + '%';
    const val = $(`#mxv-${st.k}`, root); if (val) val.textContent = fmt(Math.round(v));
    if (!st.c) return;
    const h = $(`#mxh-${st.c}`, root);
    if (!h) return;
    const parts = [];
    if (Math.abs(f[st.c] - team[st.c]) > 1e-6) parts.push(`план ${mxPct(team[st.c])}%`);
    /* продлений в факте ещё нет, пока некому продлевать — ноль не показываем */
    const fv = st.c === 'renew' && !fx[st.c] ? null : fx[st.c];
    if (fv !== null && fv !== undefined && fx.a.days) parts.push(`факт ${mxPct(fv)}%`);
    h.textContent = parts.join(' · ');
  });
  const gap = Math.round(t.pays) - Math.round(t.plan);
  $('#mxRes', root).innerHTML = rev
    ? `<span class="label">Под план «${SCENARIOS[sc].name}» — ${fmt(t.plan)} продаж</span>
      <div class="mx-big">${fmt(Math.round(t.reach))}<small>охвата за квартал</small></div>
      <div class="mx-vs">≈ ${fmt(Math.round(t.reach / 3))} в месяц · ${fmt(Math.ceil(t.regs))} ${plural(Math.ceil(t.regs), 'регистрация', 'регистрации', 'регистраций')}</div>
      <dl class="mx-dl"><div><dt>Выручка квартала</dt><dd>${rubK(t.revenue)}</dd></div><div><dt>Платят на 31 декабря</dt><dd>${fmt(Math.round(t.active))}</dd></div></dl>`
    : `<span class="label">Итог квартала</span>
      <div class="mx-big">${fmt(Math.round(t.pays))}<small>${plural(Math.round(t.pays), 'продажа', 'продажи', 'продаж')}</small></div>
      <div class="mx-vs ${paceTone(Math.round(t.pays), Math.round(t.plan))}">план «${SCENARIOS[sc].name}» ${fmt(t.plan)} · ${gap === 0 ? 'ровно по плану' : (gap > 0 ? '+' : '') + fmt(gap)}</div>
      <dl class="mx-dl"><div><dt>Выручка квартала</dt><dd>${rubK(t.revenue)}</dd></div><div><dt>Платят на 31 декабря</dt><dd>${fmt(Math.round(t.active))}</dd></div><div><dt>Охват на одну продажу</dt><dd>${t.pays ? fmt(Math.round(t.reach / t.pays)) : '—'}</dd></div></dl>`;
  const planReach = mxPlanDraft(sc).reach;
  const dirty = MX_KEYS.some(k => Math.abs((f[k] || 0) - (team[k] || 0)) > 1e-9) || (!rev && Q.months.some(m => Math.round(f.reach[m] || 0) !== Math.round(planReach[m] || 0)));
  $('#mxAct', root).innerHTML = `${dirty ? '<span class="pill warn">ваш вариант — не план команды</span>' : '<span class="pill good">это план команды</span>'}
    <div class="row">${dirty ? '<button class="btn sm ghost" data-mreset>Вернуть план</button>' : ''}${Auth.can('settings.edit') && dirty ? '<button class="btn sm primary" data-msave>Сделать планом команды</button>' : ''}</div>`;
  $('#mxFactLine', root).innerHTML = fx.a.days
    ? `<span>Факт ${fr.name}: ${fmt(fx.a.pays)} ${plural(fx.a.pays, 'продажа', 'продажи', 'продаж')} из ${fmt(fx.a.regs)} регистраций, ${fx.a.days} ${plural(fx.a.days, 'день', 'дня', 'дней')} с цифрами.</span> <button class="link-btn" data-mfact>Подставить факт</button>`
    : `<span>Факта ${fr.name} ещё нет — цифры вносят в «Отчётах» → «Цифры дня».</span>`;

  /* где искать рост: три самых сильных рычага */
  const fwd = {...f, reach: rev ? Object.fromEntries(c.rows.map(r => [r.m, r.reach])) : f.reach};
  const base = mxCalc(fwd, 'forward', sc).tot;
  const levers = [
    {name: 'Охват +10%', from: '', t: mxCalc({...fwd, reach: Object.fromEntries(Q.months.map(m => [m, (fwd.reach[m] || 0) * 1.1]))}, 'forward', sc).tot},
    ...MX_STEPS.filter(st => st.c).map(st => ({name: `${FUNNEL.find(x => x.c === st.c).name} +${fmt(LEVERS[st.c] * 100)} п.п.`,
      from: `${mxPct(fwd[st.c])}% → ${mxPct(Math.min(1, fwd[st.c] + LEVERS[st.c]))}%`,
      t: mxCalc({...fwd, [st.c]: Math.min(1, fwd[st.c] + LEVERS[st.c])}, 'forward', sc).tot})),
  ].map(x => ({...x, dS: x.t.pays - base.pays, dR: x.t.revenue - base.revenue})).sort((a, b) => b.dR - a.dR).slice(0, 3);
  $('#mxLev', root).innerHTML = `<div class="card-head"><h2>Где искать рост</h2><span class="note">что даст больше всего, если подвинуть один шаг</span></div>
    <ol class="mx-levs">${levers.map(x => `<li><b>${x.name}</b>${x.from ? ` <span class="note">${x.from}</span>` : ''}<span class="mx-lv-v">+${fmt(Math.round(x.dS))} ${plural(Math.round(x.dS), 'продажа', 'продажи', 'продаж')} · +${rubK(x.dR)}</span></li>`).join('')}</ol>`;

  const mr = $('#mxMonReach', root); if (mr) mr.innerHTML = `<b>${fmt(Math.round(t.reach))}</b>`;
  const line = (name, get, fm = v => fmt(Math.round(v)), cls = '') => `<tr class="${cls}"><td>${name}</td>${c.rows.map(r => `<td class="r">${fm(get(r))}</td>`).join('')}<td class="r"><b>${fm(get(t))}</b></td></tr>`;
  $('#mxMon', root).innerHTML = `
    ${rev ? line('Охват', r => r.reach) : ''}
    ${line('Регистрации', r => r.regs)}
    ${line('Продажи', r => r.pays, undefined, 'sub')}
    ${!rev ? line(`План «${SCENARIOS[sc].name}»`, r => r.plan, v => `<span class="muted">${fmt(Math.round(v))}</span>`) : ''}
    ${line('Продления', r => r.renewals)}
    ${line('Выручка', r => r.revenue, rubK, 'total')}`;
}
