/* Отчёты — всё строится из одной таблицы клиенток и их истории.
   Готовые: воронка в разрезах, деньги, удержание, менеджеры, каналы.
   Конструктор: любое поле таблицы × показатель — отчёт «по необходимости». */

const GROUPS = {
  segment: {n: 'Сегмент', of: c => { const s = cx(c).segment; return s ? s.name : 'Без сегмента'; }},
  source:  {n: 'Источник', of: c => SOURCES[c.source] || c.source || '—'},
  manager: {n: 'Менеджер', of: c => (c.manager ? Team.name(Team.get(c.manager)) : 'Без менеджера')},
  city:    {n: 'Город', of: c => c.city || '—'},
  niche:   {n: 'Сфера / ниша', of: c => c.niche || '—'},
  stage:   {n: 'Этап', of: c => (Funnels.stage(Funnels.of('clients', c), c.stage) || {name: c.stage}).name},
  month:   {n: 'Месяц появления', of: c => (c.created ? monthName(monthOf(c.created), true) : '—'), sort: c => c.created || ''},
  sub:     {n: 'Подписка', of: c => SUB_STATUS[cx(c).sub].name},
  level:   {n: 'Уровень', of: c => levelOf(c.points).name},
  partner: {n: 'Партнёр', of: c => (c.partnerId ? (Partners.get(c.partnerId) || {}).name || '—' : 'Без партнёра')},
  tag:     {n: 'Тег', multi: c => ((c.tags || []).length ? c.tags.map(t => (Tags.get(t) || {}).name || t) : ['Без тегов'])},
  q_goal:  {n: 'Анкета: что важнее', multi: c => (((c.quiz || {}).goal || []).length ? c.quiz.goal.map(x => QUIZ.goal.opts[x]) : ['Не заполняла'])},
  q_stage: {n: 'Анкета: этап жизни', of: c => quizText('stage', (c.quiz || {}).stage) || 'Не заполняла'},
  q_level: {n: 'Анкета: опыт', of: c => quizText('level', (c.quiz || {}).level) || 'Не заполняла'},
  q_time:  {n: 'Анкета: время в день', of: c => quizText('time', (c.quiz || {}).time) || 'Не заполняла'},
  q_interest: {n: 'Анкета: интересы', multi: c => (((c.quiz || {}).interest || []).length ? c.quiz.interest.map(x => QUIZ.interest.opts[x]) : ['Не заполняла'])},
};
const METRICS = {
  n:      {n: 'Клиенток', f: L => L.length, fmt},
  leads:  {n: 'Дошли до заявки', f: L => L.filter(c => Funnels.idx('sales', c.stage) >= Funnels.idx('sales', 'lead') || (c.stage === 'lost' && Ev.list(c).some(e => e.kind === 'stage' && ['lead', 'qual', 'invoice'].includes(e.from)))).length, fmt},
  paid:   {n: 'Оплатили', f: L => L.filter(c => cx(c).ltv > 0).length, fmt},
  conv:   {n: 'Конверсия в оплату', f: L => (L.length ? L.filter(c => cx(c).ltv > 0).length / L.length : null), fmt: v => pct(v), pctM: true},
  ltv:    {n: 'Принесли, ₽', f: L => sum(L, c => cx(c).ltv), fmt: rub, money: true},
  avgLtv: {n: 'Средний LTV платящей, ₽', f: L => { const P = L.filter(c => cx(c).ltv > 0); return P.length ? sum(P, c => cx(c).ltv) / P.length : null; }, fmt: rub, money: true},
  active: {n: 'Активная подписка', f: L => L.filter(c => ['active', 'expiring'].includes(cx(c).sub)).length, fmt},
  touch:  {n: 'Касаний в среднем', f: L => (L.length ? sum(L, c => cx(c).touches) / L.length : null), fmt: v => fmt(v, 1)},
  lost:   {n: 'Отказов', f: L => L.filter(c => c.stage === 'lost').length, fmt},
};
function groupRows(list, gk) {
  const g = GROUPS[gk];
  const m = new Map();
  list.forEach(c => {
    const keys = g.multi ? g.multi(c) : [g.of(c)];
    keys.forEach(k => { if (!m.has(k)) m.set(k, []); m.get(k).push(c); });
  });
  return [...m.entries()].map(([name, L]) => ({name, L}));
}

App.register('reports', {
  title: 'Отчёты',
  render(root) {
    const tab = View.get('rp.tab', 'funnel');
    const per = View.get('rp.per', '90');
    const from = periodFrom(per), t = today();
    const inP = d => d && d >= from && d <= t;
    const vis = Clients.visible();
    const cohort = vis.filter(c => inP(c.created));
    const canMoney = Who.can('money.view');
    let body = '';

    if (tab === 'funnel') {
      const gk = View.get('rp.fg', 'segment');
      const f = Funnels.get('sales');
      const reachIdx = c => {
        if (c.stage !== 'lost') return Funnels.idx('sales', c.stage);
        let b = -1; Ev.list(c).forEach(e => { if (e.kind === 'stage' && e.from) b = Math.max(b, Funnels.idx('sales', e.from)); });
        return b;
      };
      const rows = groupRows(cohort, gk).map(r => ({...r, reach: f.stages.map((s, i) => r.L.filter(c => reachIdx(c) >= i).length)})).sort((a, b) => b.L.length - a.L.length);
      const payTimes = cohort.filter(c => cx(c).firstPay).map(c => daysBetween(c.created, isoTs(cx(c).firstPay)));
      const lostBy = LOST_REASONS.map(r => ({name: r, v: cohort.filter(c => c.stage === 'lost' && c.lostReason === r).length})).filter(x => x.v);
      body = `<div class="split">
          <div class="card"><div class="card-head"><h2>Воронка за период</h2><span class="note">контакты, появившиеся за период: сколько дошли до этапа</span></div>${funnelBars(reachFunnel(cohort))}</div>
          <div class="card"><div class="card-head"><h2>Почему отказываются</h2></div>${hbarList(lostBy, {color: 'var(--bad)'})}
            <div class="kv" style="margin-top:12px"><span>От появления до оплаты, медиана</span><b>${payTimes.length ? payTimes.sort((a, b) => a - b)[Math.floor(payTimes.length / 2)] + ' дн.' : '—'}</b></div></div>
        </div>
        <section class="section card"><div class="card-head"><h2>Конверсия по этапам</h2>
          <select class="select sm" id="rpFg" style="width:auto">${Object.entries(GROUPS).filter(([k]) => !['stage'].includes(k)).map(([k, g]) => opt(k, 'в разрезе: ' + g.n, gk)).join('')}</select></div>
          <div class="table-wrap"><table class="t"><thead><tr><th>${esc(GROUPS[gk].n)}</th>${f.stages.map(s => `<th class="r">${esc(s.name)}</th>`).join('')}<th class="r">Заявка → оплата</th></tr></thead><tbody>
          ${rows.map(r => { const li = Funnels.idx('sales', 'lead'); const lead = r.reach[li] || 0, won = r.reach[r.reach.length - 1]; return `<tr><td>${esc(r.name)}</td>${r.reach.map(n => `<td class="r">${n || '<span class="muted">0</span>'}</td>`).join('')}<td class="r"><b>${lead ? pct(won / lead) : '—'}</b></td></tr>`; }).join('') || `<tr><td colspan="${f.stages.length + 2}"><p class="note">Нет контактов за период.</p></td></tr>`}
          </tbody></table></div></section>`;
    } else if (tab === 'money' && canMoney) {
      const months = monthsBack(8);
      const rev = revenueByMonth(Clients.all(), months);
      const byType = Object.entries(PAY_TYPES).map(([k, p]) => {
        const L = []; Clients.all().forEach(c => cx(c).ok.forEach(x => { if (x.type === k && inP(isoTs(x.t))) L.push(x); }));
        return {name: p.name, color: p.color, n: L.length, v: sum(L, x => Math.abs(cashOf(x)))};
      }).filter(x => x.n);
      const activeAt = m => { const end = monthEnd(m) < t ? monthEnd(m) : t; return Clients.all().filter(c => { const u = subUntilAt(c, end); return u && u >= end; }).length; };
      const pays = []; Clients.all().forEach(c => cx(c).ok.forEach(p => { if (inP(isoTs(p.t)) && p.type !== 'refund' && p.method !== 'balance') pays.push(p); }));
      const refunds = []; Clients.all().forEach(c => cx(c).ok.forEach(p => { if (inP(isoTs(p.t)) && p.type === 'refund') refunds.push(p); }));
      const cash = sum(pays, p => p.amount) - sum(refunds, p => p.amount);
      body = `<div class="tiles6">
          <div class="card stat"><span class="label">Поступления</span><div class="big">${rubK(cash)}</div><div class="foot">за вычетом возвратов</div></div>
          <div class="card stat"><span class="label">Оплат</span><div class="big">${fmt(pays.length)}</div><div class="foot">средний чек ${pays.length ? rub(sum(pays, p => p.amount) / pays.length) : '—'}</div></div>
          <div class="card stat"><span class="label">Возвраты</span><div class="big">${rubK(sum(refunds, p => p.amount))}</div><div class="foot">${refunds.length} шт. · ${pays.length ? pct(refunds.length / pays.length, 1) : '—'} оплат</div></div>
          <div class="card stat"><span class="label">Бонусами оплачено</span><div class="big">${rubK(sum(pays, p => p.bonusUsed || 0))}</div><div class="foot">не деньги — скидка</div></div>
        </div>
        <section class="section card"><div class="card-head"><h2>Поступления по месяцам</h2></div>${stackChart({labels: rev.labels, series: rev.series, height: 240})}</section>
        <div class="split section">
          <div class="card"><div class="card-head"><h2>По типам оплат</h2><span class="note">за период</span></div>${hbarList(byType.map(x => ({name: x.name, v: x.v, color: x.color, n: x.n})), {valFmt: rubK, sub: r => `${r.n} шт.`})}</div>
          <div class="card"><div class="card-head"><h2>Активные подписки на конец месяца</h2></div>${barChart({labels: months.map(m => ({text: monthName(m, true), tick: monthShort(m)})), values: months.map(activeAt), height: 200, color: 'var(--violet)', half: true})}</div>
        </div>`;
    } else if (tab === 'retention' && canMoney) {
      /* когорты по месяцу первой оплаты: доля с живой подпиской через N месяцев */
      const payers = Clients.all().filter(c => cx(c).firstPay);
      const cohorts = {};
      payers.forEach(c => { const m = monthOf(isoTs(cx(c).firstPay)); (cohorts[m] = cohorts[m] || []).push(c); });
      const ms = Object.keys(cohorts).sort().slice(-7);
      const N = 6;
      const aliveAt = (c, m) => { const end = monthEnd(m) < t ? monthEnd(m) : t; const u = subUntilAt(c, end); return !!u && u >= end; };
      body = `<div class="card"><div class="card-head"><h2>Удержание по когортам</h2><span class="note">доля оплативших, у кого подписка жива на конец N-го месяца после первой оплаты · план — 50% продлевают</span></div>
        <div class="table-wrap"><table class="t matrix"><thead><tr><th>Первая оплата</th><th class="r">Клиенток</th>${Array.from({length: N}, (_, i) => `<th class="c">Месяц ${i + 1}</th>`).join('')}</tr></thead><tbody>
        ${ms.map(m => `<tr><td>${monthName(m, true)}</td><td class="r">${cohorts[m].length}</td>${Array.from({length: N}, (_, i) => {
          const mm = addMonths(m, i);
          if (mm > monthOf(t)) return '<td class="c muted">·</td>';
          const share = cohorts[m].filter(c => aliveAt(c, mm)).length / cohorts[m].length;
          return `<td class="c"><span class="heat" style="background:color-mix(in srgb, var(--good) ${Math.round(share * 45)}%, transparent)">${pct(share)}</span></td>`;
        }).join('')}</tr>`).join('') || '<tr><td colspan="8"><p class="note">Нет оплат.</p></td></tr>'}
        </tbody></table></div></div>
        <p class="note" style="margin-top:8px">Месяц 1 — месяц первой оплаты. Годовые подписки держат клиентку 12 месяцев, поэтому когорты с долей годовых выглядят лучше — смотрите вместе с отчётом «Деньги».</p>`;
    } else if (tab === 'team') {
      const since = dateOf(from).getTime();
      const rows = Team.assignable().map(m => {
        let calls = 0, ok = 0, talk = 0, msgs = 0, tasksDone = 0, pays = 0, cash = 0, owned = 0, newOwned = 0;
        const replies = [];
        Clients.all().forEach(c => {
          if (c.manager === m.id) { owned++; if (inP(c.created)) newOwned++; }
          const evs = Ev.list(c);
          evs.forEach((e, i) => {
            if (e.t < since) return;
            if (e.by === m.id && e.kind === 'call') { calls++; if (e.result === 'ok') { ok++; talk += e.dur || 0; } }
            if (e.by === m.id && e.kind === 'msg' && e.dir === 'out') msgs++;
            if (e.kind === 'task' && e.done && e.doneBy === m.id) tasksDone++;
            if (e.kind === 'msg' && e.dir === 'in' && c.manager === m.id) {
              const nx = evs.slice(i + 1).find(x => (x.kind === 'msg' && x.dir === 'out') || (x.kind === 'call' && x.result === 'ok'));
              if (nx) replies.push((nx.t - e.t) / 60000);
            }
          });
          if (c.manager === m.id) cx(c).ok.forEach(p => { if (p.t >= since && p.type !== 'refund') { pays++; cash += cashOf(p); } });
        });
        const overdue = Tasks.open().filter(x => Tasks.whoOf(x) === m.id && x.due && x.due < t).length;
        replies.sort((a, b) => a - b);
        const med = replies.length ? replies[Math.floor(replies.length / 2)] : null;
        return {m, calls, ok, talk, msgs, tasksDone, overdue, pays, cash, owned, newOwned, med};
      });
      const s = settings();
      body = `<div class="table-wrap"><table class="t"><thead><tr><th>Менеджер</th><th class="r">Клиенток</th><th class="r">Новых</th><th class="r">Звонков</th><th class="r">Дозвон</th><th class="r">Разговоры</th><th class="r">Сообщений</th><th class="r">Ответ, медиана</th><th class="r">Задач закрыто</th><th class="r">Просрочено</th><th class="r">Оплат</th>${canMoney ? '<th class="r">Сумма</th>' : ''}</tr></thead><tbody>
        ${rows.map(r => `<tr><td><span class="row" style="gap:8px;align-items:center;flex-wrap:nowrap">${Team.av(r.m)}${esc(Team.name(r.m))}</span></td><td class="r">${r.owned}</td><td class="r">${r.newOwned}</td><td class="r">${r.calls}</td><td class="r">${r.calls ? pct(r.ok / r.calls) : '—'}</td><td class="r">${durLong(r.talk)}</td><td class="r">${r.msgs}</td>
          <td class="r ${r.med !== null && r.med > s.replyMinutes ? 'warn' : ''}">${r.med === null ? '—' : r.med < 60 ? Math.round(r.med) + ' мин' : fmt(r.med / 60, 1) + ' ч'}</td><td class="r">${r.tasksDone}</td><td class="r ${r.overdue ? 'bad' : ''}">${r.overdue}</td><td class="r">${r.pays}</td>${canMoney ? `<td class="r">${rub(r.cash)}</td>` : ''}</tr>`).join('')}
        </tbody></table></div>
        <p class="note" style="margin-top:8px">Ответ — время от входящего сообщения клиентки до ответа или разговора. Норма — ${s.replyMinutes} минут в рабочее время.</p>`;
    } else if (tab === 'channels') {
      const chs = {};
      Clients.all().forEach(c => Ev.list(c).forEach(e => {
        if (e.t < dateOf(from).getTime()) return;
        if (e.kind === 'camp') { const x = chs[e.ch] = chs[e.ch] || {sent: 0, opened: 0, clicked: 0, replied: 0, unsub: 0, personal: 0, inbound: 0}; x.sent++; const r = CAMP_RANK[e.status] ?? 0; if (r >= 3 && e.status !== 'unsub') x.opened++; if (r >= 4 && e.status !== 'unsub') x.clicked++; if (e.status === 'replied') x.replied++; if (e.status === 'unsub') x.unsub++; }
        if (e.kind === 'msg') { const x = chs[e.ch] = chs[e.ch] || {sent: 0, opened: 0, clicked: 0, replied: 0, unsub: 0, personal: 0, inbound: 0}; if (e.dir === 'out') x.personal++; else x.inbound++; }
      }));
      body = `<div class="table-wrap"><table class="t"><thead><tr><th>Канал</th><th class="r">Рассылок получено</th><th class="r">Открыли</th><th class="r">Перешли</th><th class="r">Ответили</th><th class="r">Отписались</th><th class="r">Личных сообщений</th><th class="r">Входящих</th></tr></thead><tbody>
        ${Object.entries(chs).sort((a, b) => (b[1].sent + b[1].personal) - (a[1].sent + a[1].personal)).map(([ch, x]) => `<tr><td>${chBadge(ch, true)}</td><td class="r">${x.sent}</td><td class="r">${x.sent ? pct(x.opened / x.sent) : '—'}</td><td class="r">${x.sent ? pct(x.clicked / x.sent) : '—'}</td><td class="r">${x.replied}</td><td class="r">${x.unsub}</td><td class="r">${x.personal}</td><td class="r">${x.inbound}</td></tr>`).join('') || '<tr><td colspan="8"><p class="note">Нет касаний за период.</p></td></tr>'}
        </tbody></table></div>
        <section class="section card"><div class="card-head"><h2>Рассылки за период</h2></div>
          <div class="table-wrap"><table class="t"><thead><tr><th>Рассылка</th><th>Канал</th><th class="r">Получили</th><th class="r">Открыли</th><th class="r">Перешли</th><th class="r">Оплатили за 7 дней</th></tr></thead><tbody>
          ${Camps.all().filter(cp => cp.at && isoTs(cp.at) >= from).map(cp => { const st = Camps.stats(cp); return `<tr><td>${esc(cp.name)}</td><td>${chBadge(cp.ch)}</td><td class="r">${st.total}</td><td class="r">${st.total ? pct(st.opened / st.total) : '—'}</td><td class="r">${st.total ? pct(st.clicked / st.total) : '—'}</td><td class="r">${st.paid}${canMoney && st.paidSum ? ` · ${rubK(st.paidSum)}` : ''}</td></tr>`; }).join('') || '<tr><td colspan="6"><p class="note">Рассылок не было.</p></td></tr>'}
          </tbody></table></div></section>`;
    } else {
      /* конструктор */
      const gk = View.get('rp.g', 'niche');
      const mk = View.get('rp.m', ['n', 'paid', 'conv', 'ltv']).filter(k => METRICS[k] && (canMoney || !METRICS[k].money));
      const rules = View.get('rp.rules', []);
      const base = (per === 'all' ? vis : cohort).filter(c => !rules.length || testRules(rules, View.get('rp.match', 'all'), c));
      const sortM = mk[0] || 'n';
      const rows = groupRows(base, gk).map(r => ({...r, v: Object.fromEntries(mk.map(k => [k, METRICS[k].f(r.L)]))}))
        .sort((a, b) => (GROUPS[gk].sort ? String(GROUPS[gk].sort(a.L[0])).localeCompare(String(GROUPS[gk].sort(b.L[0]))) : (b.v[sortM] ?? -1) - (a.v[sortM] ?? -1)));
      const total = Object.fromEntries(mk.map(k => [k, METRICS[k].f(base)]));
      const barK = mk.find(k => !METRICS[k].pctM) || 'n';
      body = `<div class="card"><div class="card-head"><h2>Конструктор отчёта</h2><span class="note">любое поле таблицы × любые показатели · ${per === 'all' ? 'вся база' : 'контакты за период'}</span></div>
          <div class="row" style="align-items:flex-end">
            <label class="field"><span>Группировать по</span><select class="select" id="rpG">${Object.entries(GROUPS).map(([k, g]) => opt(k, g.n, gk)).join('')}</select></label>
            <div class="field" style="flex:1"><span>Показатели</span><div class="chips">${Object.entries(METRICS).filter(([k, m]) => canMoney || !m.money).map(([k, m]) => `<button class="chip ${mk.includes(k) ? 'on' : ''}" data-metric="${k}">${esc(m.n)}</button>`).join('')}</div></div>
            <button class="btn ${rules.length ? 'primary' : ''}" data-rp-rules>${icon('filter')}Условия${rules.length ? ' · ' + rules.length : ''}</button>
            ${Who.can('export') ? `<button class="btn" data-rp-csv>${icon('download')}CSV</button>` : ''}
          </div></div>
        <div class="split section">
          <div class="table-wrap"><table class="t"><thead><tr><th>${esc(GROUPS[gk].n)}</th>${mk.map(k => `<th class="r">${esc(METRICS[k].n)}</th>`).join('')}</tr></thead><tbody>
            ${rows.map(r => `<tr><td>${esc(r.name)}</td>${mk.map(k => `<td class="r">${r.v[k] === null ? '—' : METRICS[k].fmt(r.v[k])}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${mk.length + 1}"><p class="note">Нет данных.</p></td></tr>`}
            <tr class="total"><td>Итого</td>${mk.map(k => `<td class="r">${total[k] === null ? '—' : METRICS[k].fmt(total[k])}</td>`).join('')}</tr>
          </tbody></table></div>
          <div class="card"><div class="card-head"><h2>${esc(METRICS[barK].n)}</h2></div>${hbarList(rows.slice(0, 14).map(r => ({name: r.name, v: r.v[barK] || 0})), {valFmt: METRICS[barK].money ? rubK : fmt})}</div>
        </div>`;
    }

    const tabs = [['funnel', 'Воронка'], ...(canMoney ? [['money', 'Деньги'], ['retention', 'Удержание']] : []), ['team', 'Менеджеры'], ['channels', 'Каналы и рассылки'], ['builder', 'Конструктор']];
    root.innerHTML = `
      ${pageHead('Отчёты', 'Всё считается из таблицы клиенток и их истории — цифры не расходятся с карточками.',
        `<div class="seg">${Object.entries(PERIODS).map(([k, p]) => `<button data-rper="${k}" class="${k === per ? 'on' : ''}">${p.name}</button>`).join('')}</div>`)}
      ${tabsHtml('rp.tab', tabs, tabs.some(x => x[0] === tab) ? tab : 'funnel')}
      ${body}`;

    wireTabs(root);
    on(root, 'click', '[data-rper]', (e, el) => { View.set('rp.per', el.dataset.rper); App.render(); });
    const fg = $('#rpFg', root); if (fg) fg.onchange = () => { View.set('rp.fg', fg.value); App.render(); };
    const g = $('#rpG', root); if (g) g.onchange = () => { View.set('rp.g', g.value); App.render(); };
    on(root, 'click', '[data-metric]', (e, el) => {
      const cur = View.get('rp.m', ['n', 'paid', 'conv', 'ltv']);
      const k = el.dataset.metric;
      View.set('rp.m', cur.includes(k) ? cur.filter(x => x !== k) : [...cur, k]);
      App.render();
    });
    on(root, 'click', '[data-rp-rules]', () => openRulesModal({title: 'Кого считаем в отчёте', rules: View.get('rp.rules', []), match: View.get('rp.match', 'all'), onSave: (r, m) => { View.set('rp.rules', r); View.set('rp.match', m); App.render(); }}));
    on(root, 'click', '[data-rp-csv]', () => {
      const gk = View.get('rp.g', 'niche');
      const mk = View.get('rp.m', ['n', 'paid', 'conv', 'ltv']).filter(k => METRICS[k]);
      const rules = View.get('rp.rules', []);
      const base = (per === 'all' ? vis : cohort).filter(c => !rules.length || testRules(rules, View.get('rp.match', 'all'), c));
      const rows = groupRows(base, gk).map(r => [r.name, ...mk.map(k => { const v = METRICS[k].f(r.L); return v === null ? '' : METRICS[k].pctM ? (v * 100).toFixed(1) + '%' : Math.round(v * 10) / 10; })]);
      saveFile(`eva-otchet-${gk}-${today()}.csv`, csvOf([[GROUPS[gk].n, ...mk.map(k => METRICS[k].n)], ...rows]), 'Отчёт');
    });
  },
});
