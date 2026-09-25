/* Метрики: воронка продаж, которую можно крутить руками.
   Охват → просмотр → переход → регистрация → покупка → продление.
   Меняете любую цифру — квартал пересчитывается сразу. Два расчёта:
   «от охвата» (сколько продаж даст такой охват) и «от цели» (какой охват
   нужен под план продаж сценария). Черновик у каждого свой; основатель
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

App.register('metrics', {
  title: 'Метрики',
  render(root) {
    const s = settings();
    const sc = MxUI.sc, mode = MxUI.mode;
    const f = MxUI.load();
    const canSave = Auth.can('settings.edit');
    const team = funnelOf(s);

    const convRow = st => {
      const v = f[st.c] * 100;
      return `<div class="mx-conv">
        <div class="mx-cl"><b>${st.name}</b><small>% ${st.of} · ${st.about}</small></div>
        <input type="range" class="mx-range" data-mr="${st.c}" min="${st.min}" max="${st.max}" step="${st.step}" value="${clamp(v, st.min, st.max)}" aria-label="${st.name}, %">
        <label class="mx-num"><input class="input num sm" data-mc="${st.c}" inputmode="decimal" value="${fmt(v, v < 10 ? 1 : 0)}"><span>%</span></label>
        <span class="mx-team" title="план команды">${pct(team[st.c], team[st.c] < 0.1 ? 1 : 0)}</span>
      </div>`;
    };

    root.innerHTML = `
      ${pageHead('Метрики', 'Воронка продаж: охват → просмотр → переход → регистрация → покупка → продление. Двигайте цифры — квартал пересчитывается сразу.',
        `<div class="seg" title="Сценарий для сравнения">${Object.entries(SCENARIOS).map(([k, x]) => `<button data-msc="${k}" class="${k === sc ? 'on' : ''}">${x.name} ${fmt(Plan.total(k))}</button>`).join('')}</div>${helpBtn('metrics')}`)}
      ${helpBox('metrics', `<b>Как пользоваться.</b> Слева — ключевые цифры: охват по месяцам и конверсия каждого шага воронки. Справа — что из этого выходит: продажи, продления, платящие и выручка по месяцам против плана сценария. <b>«От охвата»</b> — вы задаёте охват и видите продажи. <b>«От цели»</b> — наоборот: берём план продаж сценария и считаем, сколько нужно регистраций, переходов, просмотров и охвата. Ниже — факт из «Цифр дня» и какие рычаги дают больше всего. Ваши правки видны только вам${canSave ? '; кнопка «Сделать планом команды» сохраняет их для всех — по ним считают «Стратегия», «Отчёты» и Cash Flow' : ' — сохранить их как план команды может основатель'}.`)}
      <div class="mx-grid">
        <section class="card mx-in">
          <div class="card-head"><h2>Ключевые цифры</h2>
            <div class="seg"><button data-mmode="forward" class="${mode === 'forward' ? 'on' : ''}">От охвата</button><button data-mmode="reverse" class="${mode === 'reverse' ? 'on' : ''}">От цели</button></div></div>
          ${mode === 'forward' ? `<div class="mx-reach"><span class="label">Охват в месяц, человек</span>
            <div class="mx-reach-row">${Q.months.map(m => `<label class="field"><span>${monthName(m)}</span><input class="input num" data-mreach="${m}" inputmode="numeric" value="${fmt(Math.round(f.reach[m] || 0))}"></label>`).join('')}</div>
            <div class="chips mx-quick"><button class="chip" data-mq="1.1">+10%</button><button class="chip" data-mq="0.9">−10%</button><button class="chip" data-mq="plan">под план «${SCENARIOS[sc].name}»</button></div></div>`
            : `<div class="mx-reach"><span class="label">План продаж «${SCENARIOS[sc].name}»</span><div class="mx-target">${Q.months.map(m => `<div><span>${monthName(m)}</span><b>${fmt(scenarioSales(sc)[m])}</b></div>`).join('')}<div><span>квартал</span><b>${fmt(Plan.total(sc))}</b></div></div><p class="note">Меняется в «Стратегии» → сценарии. Здесь считаем, что нужно на каждом шаге.</p></div>`}
          <div class="mx-convs"><div class="mx-conv head"><span></span><span></span><span>ваш вариант</span><span>план</span></div>${FUNNEL.map(convRow).join('')}</div>
          <div class="mx-price"><label class="field"><span>Цена подписки в месяц, ₽</span><input class="input num" data-mprice inputmode="numeric" value="${fmt(f.price)}"></label>
            <div class="note">Охват → регистрация: <b id="mxR2R">${pct(f.view * f.click * f.reg, 2)}</b> · в плане команды ${pct(team.view * team.click * team.reg, 2)}</div></div>
          <div class="mx-actions" id="mxAct">${mxActHtml(f, sc)}</div>
        </section>
        <section class="mx-out" id="mxOut">${mxOutHtml(f, mode, sc)}</section>
      </div>
      <section class="section" id="mxFact">${mxFactHtml(f)}</section>`;

    wireHelp(root);
    on(root, 'click', '[data-msc]', (e, el) => { View.set('mx.sc', el.dataset.msc); App.render(); });
    on(root, 'click', '[data-mmode]', (e, el) => { View.set('mx.mode', el.dataset.mmode); App.render(); });
    const repaint = () => {
      MxUI.save();
      $('#mxOut', root).innerHTML = mxOutHtml(f, MxUI.mode, sc);
      $('#mxFact', root).innerHTML = mxFactHtml(f);
      $('#mxAct', root).innerHTML = mxActHtml(f, sc);
      const r2r = $('#mxR2R', root); if (r2r) r2r.textContent = pct(f.view * f.click * f.reg, 2);
    };
    on(root, 'input', '[data-mr]', (e, el) => {
      const k = el.dataset.mr;
      f[k] = Number(el.value) / 100;
      const num = $(`[data-mc="${k}"]`, root);
      num.value = fmt(Number(el.value), Number(el.value) < 10 ? 1 : 0);
      repaint();
    });
    on(root, 'input', '[data-mc]', (e, el) => {
      const k = el.dataset.mc;
      const v = clamp(parseNum(el.value), 0, 100);
      if (!el.value.trim()) return;
      f[k] = Math.max(k === 'renew' ? 0 : 0.0001, v / 100);
      const r = $(`[data-mr="${k}"]`, root); if (r) r.value = v;
      repaint();
    });
    on(root, 'input', '[data-mreach]', (e, el) => { f.reach[el.dataset.mreach] = Math.max(0, parseNum(el.value)); repaint(); });
    on(root, 'input', '[data-mprice]', (e, el) => { if (el.value.trim()) { f.price = Math.max(1, parseNum(el.value)); repaint(); } });
    /* по уходу из поля — число в привычном виде */
    on(root, 'change', '[data-mreach]', (e, el) => { el.value = fmt(Math.round(f.reach[el.dataset.mreach] || 0)); });
    on(root, 'change', '[data-mprice]', (e, el) => { el.value = fmt(f.price); });
    on(root, 'change', '[data-mc]', (e, el) => { const v = f[el.dataset.mc] * 100; el.value = fmt(v, v < 10 ? 1 : 0); });
    on(root, 'click', '[data-mfp]', (e, el) => { View.set('mx.fact', el.dataset.mfp); $('#mxFact', root).innerHTML = mxFactHtml(f); });
    on(root, 'click', '[data-mq]', (e, el) => {
      const q = el.dataset.mq;
      Q.months.forEach(m => { f.reach[m] = q === 'plan' ? mxPlanDraftReach(f, sc, m) : Math.round((f.reach[m] || 0) * Number(q) / 1000) * 1000; });
      MxUI.save();
      App.render();
    });
    on(root, 'click', '[data-mreset]', () => { MxUI.reset(); App.render(); });
    on(root, 'click', '[data-mfact]', (e, el) => {
      const fx = mxFact(el.dataset.from, el.dataset.to);
      let n = 0;
      ['view', 'click', 'reg', 'pay', 'renew'].forEach(k => { if (fx[k] !== null && fx[k] > 0 && fx[k] <= 1) { f[k] = fx[k]; n++; } });
      MxUI.save();
      toast(n ? `Взял из факта: ${n} ${plural(n, 'конверсию', 'конверсии', 'конверсий')}` : 'Для конверсий пока мало данных в «Цифрах дня»');
      App.render();
    });
    on(root, 'click', '[data-msave]', async (e, save) => {
      const c = mxCalc(f, mode, sc);
      if (!(await confirmPop(save, {text: `Сделать планом команды? «Стратегия», «Отчёты» и Cash Flow будут считать по этой воронке${mode === 'forward' ? ` и охвату ${rubK(c.tot.reach).replace(NB + '₽', '')}` : ''}.`, yes: 'Да, сохранить'}))) return;
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
/* черновик против плана команды и кнопки сохранения */
function mxActHtml(f, sc) {
  const team = funnelOf();
  const planReach = mxPlanDraft(sc).reach;
  const dirty = MX_KEYS.some(k => Math.abs((f[k] || 0) - (team[k] || 0)) > 1e-9) || Q.months.some(m => Math.round(f.reach[m] || 0) !== Math.round(planReach[m] || 0));
  return `${dirty ? '<span class="pill warn">черновик отличается от плана команды</span>' : '<span class="pill good">совпадает с планом команды</span>'}
    <button class="btn sm ghost" data-mreset ${dirty ? '' : 'disabled'}>Вернуть план команды</button>
    ${Auth.can('settings.edit') ? `<button class="btn sm primary" data-msave ${dirty ? '' : 'disabled'}>Сделать планом команды</button>` : ''}`;
}
/* охват месяца, который нужен под план сценария при текущих конверсиях */
function mxPlanDraftReach(f, sc, m) {
  return Math.round(scenarioSales(sc)[m] / Math.max(f.pay * f.reg * f.click * f.view, 1e-9) / 1000) * 1000;
}

function mxOutHtml(f, mode, sc) {
  const c = mxCalc(f, mode, sc);
  const t = c.tot;
  const gap = Math.round(t.pays) - Math.round(t.plan);
  const tone = mode === 'reverse' ? '' : paceTone(t.pays, t.plan);
  const steps = [
    ['Охват', t.reach, null],
    ['Просмотры', t.views, f.view],
    ['Переходы', t.clicks, f.click],
    ['Регистрации', t.regs, f.reg],
    ['Покупки', t.pays, f.pay],
  ];
  const lo = Math.log10(Math.max(1, t.pays)), hi = Math.log10(Math.max(10, t.reach));
  const w = v => clamp(hi > lo ? 16 + 84 * (Math.log10(Math.max(1, v)) - lo) / (hi - lo) : 100, 14, 100);
  const tiles = mode === 'reverse'
    ? [['Охват под план', fmt(Math.round(t.reach)), `в среднем ${fmt(Math.round(t.reach / 3))} в месяц`],
       ['Регистраций нужно', fmt(Math.ceil(t.regs)), `при покупке ${pct(f.pay, 1)}`],
       ['Выручка квартала', rubK(t.revenue), `продления — ${rubK(t.revRenew)}`],
       ['Платящих на 31 декабря', fmt(Math.round(t.active)), `удержание ${pct(f.renew)}`]]
    : [['Продаж за квартал', fmt(Math.round(t.pays)), `план «${SCENARIOS[sc].name}» ${fmt(t.plan)} · <b class="${tone}">${gap > 0 ? '+' : ''}${fmt(gap)}</b>`],
       ['Выручка квартала', rubK(t.revenue), `первые оплаты ${rubK(t.revNew)} · продления ${rubK(t.revRenew)}`],
       ['Платящих на 31 декабря', fmt(Math.round(t.active)), `удержание ${pct(f.renew)}`],
       ['Охват за квартал', fmt(Math.round(t.reach)), `на одну продажу — ${t.pays ? fmt(Math.round(t.reach / t.pays)) : '—'}`]];

  const row = (name, get, f2 = v => fmt(Math.round(v)), cls = '') => `<tr class="${cls}"><td>${name}</td>${c.rows.map(r => `<td class="r">${f2(get(r))}</td>`).join('')}<td class="r"><b>${f2(get(t))}</b></td></tr>`;

  /* рычаги: что даёт каждый шаг, если подвинуть его на несколько пунктов */
  const fwd = {...f, reach: mode === 'reverse' ? Object.fromEntries(c.rows.map(r => [r.m, r.reach])) : f.reach};
  const baseF = mxCalc(fwd, 'forward', sc).tot;
  const levers = [
    {name: 'Охват +10%', t: mxCalc({...fwd, reach: Object.fromEntries(Q.months.map(m => [m, (fwd.reach[m] || 0) * 1.1]))}, 'forward', sc).tot},
    ...FUNNEL.map(st => ({name: `${st.name} +${fmt(LEVERS[st.c] * 100)} п.п.`, t: mxCalc({...fwd, [st.c]: Math.min(1, fwd[st.c] + LEVERS[st.c])}, 'forward', sc).tot})),
  ].map(x => ({...x, dSales: x.t.pays - baseF.pays, dRev: x.t.revenue - baseF.revenue})).sort((a, b) => b.dRev - a.dRev);
  const maxRev = Math.max(1, ...levers.map(x => x.dRev));

  return `<div class="cards mx-tiles">${tiles.map(([l, b, foot]) => `<div class="card stat"><span class="label">${l}</span><div class="big">${b}</div><div class="foot">${foot}</div></div>`).join('')}</div>
    <div class="card mx-funnel">
      <div class="card-head"><h2>Воронка квартала</h2><span class="note">${mode === 'reverse' ? 'сколько нужно на каждом шаге под план' : 'что даёт ваш охват'}</span></div>
      ${steps.map(([name, v, conv], i) => `<div class="mf-row"><span class="mf-n">${name}</span><div class="mf-bar"><i style="width:${w(v).toFixed(1)}%"></i><b>${fmt(Math.round(v))}</b></div><span class="mf-c">${i ? pct(conv, conv < 0.1 ? 1 : 0) : ''}</span></div>`).join('')}
      <div class="mf-row renew"><span class="mf-n">Продления</span><div class="mf-bar"><i style="width:${w(t.renewals).toFixed(1)}%"></i><b>${fmt(Math.round(t.renewals))}</b></div><span class="mf-c">${pct(f.renew)}</span></div>
      <p class="note">Проценты справа — конверсия из предыдущего шага; продления — доля платящих, которые продлевают в следующем месяце.</p>
    </div>
    <div class="table-wrap mx-table"><table class="t grid-lines">
      <thead><tr><th>По месяцам</th>${c.rows.map(r => `<th class="r">${monthName(r.m)}</th>`).join('')}<th class="r">Квартал</th></tr></thead>
      <tbody>
        ${row('Охват', r => r.reach)}
        ${row('Просмотры', r => r.views)}
        ${row('Переходы', r => r.clicks)}
        ${row('Регистрации', r => r.regs)}
        ${row('<b>Покупки</b> <span class="note">продажи</span>', r => r.pays, undefined, 'sub')}
        ${row('Продления', r => r.renewals)}
        <tr><td>Платящих в месяце</td>${c.rows.map(r => `<td class="r">${fmt(Math.round(r.active))}</td>`).join('')}<td class="r"><b>${fmt(Math.round(t.active))}</b><small class="note"> на конец</small></td></tr>
        ${row('Выручка', r => r.revenue, rubK, 'total')}
        ${mode === 'forward' ? `<tr><td>План продаж «${SCENARIOS[sc].name}»</td>${c.rows.map(r => `<td class="r muted">${fmt(r.plan)}</td>`).join('')}<td class="r muted">${fmt(t.plan)}</td></tr>
        <tr><td>Разница</td>${c.rows.map(r => `${(d => `<td class="r ${d >= 0 ? 'good' : 'bad'}">${d > 0 ? '+' : ''}${fmt(d)}</td>`)(Math.round(r.pays) - Math.round(r.plan))}`).join('')}<td class="r ${gap >= 0 ? 'good' : 'bad'}"><b>${gap > 0 ? '+' : ''}${fmt(gap)}</b></td></tr>` : ''}
      </tbody></table></div>
    ${mode === 'forward' && Auth.can('settings.edit') ? `<p class="note mx-toplan">Нравится результат? <button class="link-btn" data-mtoplan>Записать эти продажи в план «${SCENARIOS[sc].name}»</button> — сценарий в «Стратегии» поменяется.</p>` : ''}
    <div class="card mx-levers">
      <div class="card-head"><h2>Что даст больше всего</h2><span class="note">если подвинуть один шаг, остальное — как сейчас</span></div>
      ${levers.map(x => `<div class="lv-row"><span class="lv-n">${x.name}</span><div class="lv-bar"><i style="width:${(Math.max(0, x.dRev) / maxRev * 100).toFixed(1)}%"></i></div><span class="lv-v"><b>+${fmt(Math.round(x.dSales))}</b> продаж · <b>+${rubK(x.dRev)}</b></span></div>`).join('')}
    </div>`;
}

function mxFactHtml(f) {
  const t = today();
  const opts = [];
  if (t >= Q.start) opts.push(['q', 'Квартал', Q.start, t < Q.end ? t : Q.end]);
  Q.months.filter(m => monthStart(m) <= t).forEach(m => opts.push([m, monthName(m), monthStart(m), monthEnd(m) < t ? monthEnd(m) : t]));
  if (!opts.length) opts.push(['sep', 'Сентябрь', '2026-09-01', t < '2026-09-30' ? t : '2026-09-30']);
  let pick = View.get('mx.fact', opts[0][0]);
  const o = opts.find(x => x[0] === pick) || opts[0];
  pick = o[0];
  const fx = mxFact(o[2], o[3]);
  const a = fx.a;
  const cell = (fact, plan) => {
    if (fact === null) return '<td class="r muted">—</td><td></td>';
    const tone = fact >= plan ? 'good' : fact >= plan * 0.8 ? 'warn' : 'bad';
    return `<td class="r"><b>${pct(fact, fact < 0.1 ? 1 : 0)}</b></td><td class="r ${tone}">${fact >= plan ? '+' : ''}${fmt((fact - plan) * 100, 1)} п.п.</td>`;
  };
  const noData = !a.days;
  return `<div class="section-head"><h2>Факт воронки по «Цифрам дня»</h2>
      <div class="seg">${opts.map(x => `<button data-mfp="${x[0]}" class="${x[0] === pick ? 'on' : ''}">${x[1]}</button>`).join('')}</div></div>
    ${noData ? `<div class="empty"><b>Цифр за этот период ещё нет</b>Их вносят каждый день в «Отчётах» → «Цифры дня»: охват, просмотры, переходы, регистрации, оплаты, продления.</div>` : `<div class="table-wrap"><table class="t mx-fact">
      <thead><tr><th>Шаг</th><th class="r">Факт, чел.</th><th class="r">Конверсия факт</th><th class="r">к вашему варианту</th><th class="r">Ваш вариант</th></tr></thead>
      <tbody>
        <tr><td>Охват</td><td class="r">${fmt(a.reach)}</td><td></td><td></td><td></td></tr>
        <tr><td>Просмотры</td><td class="r">${a.views ? fmt(a.views) : '<span class="muted">не вносили</span>'}</td>${cell(fx.view, f.view)}<td class="r muted">${pct(f.view)}</td></tr>
        <tr><td>Переходы</td><td class="r">${a.clicks ? fmt(a.clicks) : '<span class="muted">не вносили</span>'}</td>${cell(fx.click, f.click)}<td class="r muted">${pct(f.click, 1)}</td></tr>
        <tr><td>Регистрации</td><td class="r">${fmt(a.regs)}</td>${a.clicks ? cell(fx.reg, f.reg) : `<td class="r" title="от охвата: переходы не вносили">${pct(fx.regFromReach, 2)} <small class="note">от охвата</small></td><td class="r ${fx.regFromReach === null ? '' : fx.regFromReach >= f.view * f.click * f.reg ? 'good' : 'bad'}">${fx.regFromReach === null ? '' : `план ${pct(f.view * f.click * f.reg, 2)}`}</td>`}<td class="r muted">${pct(f.reg)}</td></tr>
        <tr class="sub"><td>Покупки</td><td class="r">${fmt(a.pays)}</td>${cell(fx.pay, f.pay)}<td class="r muted">${pct(f.pay, 1)}</td></tr>
        <tr><td>Продления</td><td class="r">${fmt(a.renewals)}</td>${cell(fx.renew, f.renew)}<td class="r muted">${pct(f.renew)}</td></tr>
      </tbody></table></div>
      <div class="row mx-factfoot"><span class="note">${a.days} ${plural(a.days, 'день', 'дня', 'дней')} с цифрами · выручка ${rubK(a.revenue)}. Продление — продления месяца ÷ платящие прошлого месяца.</span>
        <button class="btn sm" data-mfact data-from="${o[2]}" data-to="${o[3]}">Подставить факт в расчёт</button></div>`}`;
}
