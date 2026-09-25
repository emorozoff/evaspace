/* Дашборд: как идут продажи за период, что требует внимания прямо сейчас,
   мои задачи, деньги по месяцам, источники и работа менеджеров. */

/* сколько клиенток дошли до этапа (или дальше) — воронка когорты */
function reachFunnel(list, fid = 'sales') {
  const f = Funnels.get(fid);
  if (!f) return [];
  const idxOf = c => {
    if (c.stage !== 'lost') return f.stages.findIndex(s => s.id === c.stage);
    /* для отказа — самый дальний этап, до которого дошла */
    let best = -1;
    Ev.list(c).forEach(e => { if (e.kind === 'stage' && e.from) best = Math.max(best, f.stages.findIndex(s => s.id === e.from)); });
    return best;
  };
  const idx = list.map(idxOf);
  const rows = f.stages.map((s, i) => ({name: s.name, n: idx.filter(x => x >= i).length, won: !!s.won, href: `funnels`}));
  rows.push({name: LOST.name, n: list.filter(c => c.stage === 'lost').length, lost: true, sub: 'отказ'});
  return rows;
}

function periodDelta(cur, prev) {
  if (!prev) return cur ? '<span class="delta up">новое</span>' : '';
  const d = (cur - prev) / prev;
  if (Math.abs(d) < 0.005) return '<span class="delta">как раньше</span>';
  return `<span class="delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${pct(Math.abs(d))}</span>`;
}

function attentionHtml(list) {
  const t = today(), s = settings(), me = Who.id(), all = Who.can('clients.all');
  const mineOrAll = c => all || c.manager === me || !c.manager;
  const L = list.filter(mineOrAll);
  const waiting = L.filter(c => cx(c).waiting && c.stage !== 'lost').sort((a, b) => cx(a).lastIn.t - cx(b).lastIn.t);
  const free = L.filter(c => !c.manager && ['lead', 'qual', 'invoice'].includes(c.stage));
  const unpaid = L.filter(c => cx(c).pending.some(p => p.t < Date.now() - 3 * 864e5));
  const stale = L.filter(c => !['paid', 'lost', 'warm1', 'warm2'].includes(c.stage) && (!cx(c).lastTouch || cx(c).lastTouch < addDays(t, -s.staleDays)));
  const expiring = L.filter(c => cx(c).sub === 'expiring');
  const overdue = Tasks.visible().filter(x => x.due && x.due < t);
  const row = (c, extra) => `<a class="attn-row" href="#client-${c.id}">${avatar(Clients.name(c))}<span class="t">${esc(Clients.name(c))}</span><small>${extra}</small></a>`;
  const group = (title, items, render, tone = '', more = '') => items.length ? `<div class="attn-g"><div class="attn-h">${title}<span class="n ${tone}">${items.length}</span></div>${items.slice(0, 4).map(render).join('')}${items.length > 4 ? `<a class="attn-row" href="${more}"><small>ещё ${items.length - 4} →</small></a>` : ''}</div>` : '';
  const html = [
    group('Ждут ответа', waiting, c => row(c, `${chBadge(cx(c).lastIn.ch)} ${timeAgo(cx(c).lastIn.t)}`), 'bad', '#inbox'),
    group('Свободные заявки — взять в работу', free, c => row(c, esc(Funnels.stage('sales', c.stage).name)), '', '#funnels'),
    group('Просроченные задачи', overdue, x => `<a class="attn-row" href="${entHref(x.col, x.ent)}">${avatar(entName(x.col, x.ent))}<span class="t">${esc(x.title)}</span><small class="bad">${dayShort(x.due)}</small></a>`, 'bad'),
    group('Счёт не оплачен больше 3 дней', unpaid, c => row(c, rub(sum(cx(c).pending, p => p.amount || settings().price)))),
    group(`Без касания ${s.staleDays}+ дней`, stale, c => row(c, cx(c).lastTouch ? dayShort(cx(c).lastTouch) : 'ни разу')),
    group('Подписка заканчивается', expiring, c => row(c, 'до ' + dayShort(cx(c).subUntil))),
  ].join('');
  return html || '<div class="okline">Всё под контролем: никто не ждёт ответа, просроченных задач нет.</div>';
}

function taskRowHtml(x) {
  const t = today();
  const late = x.due && x.due < t;
  const who = Team.get(Tasks.whoOf(x));
  return `<div class="task-row ${x.done ? 'done' : ''}">
    <button class="t-check ${x.done ? 'done' : ''}" data-task-done="${x.col}|${x.ent.id}|${x.id}" ${Who.readOnly() ? 'disabled' : ''} aria-label="Готово">${icon('tick')}</button>
    <div class="tt"><b>${esc(x.title)}</b><br><a href="${entHref(x.col, x.ent)}">${esc(entName(x.col, x.ent))}</a></div>
    ${who && who.id !== Who.id() ? Team.av(who) : ''}<span class="due ${late ? 'late' : x.due === t ? 'soon' : ''}">${dayOrWhen(x.due)}</span>
  </div>`;
}
function wireTaskDone(root) {
  on(root, 'click', '[data-task-done]', (e, el) => {
    const [col, id, eid] = el.dataset.taskDone.split('|');
    const cur = (Store.get(col, id).ev || {})[eid];
    Tasks.done(col, id, eid, !(cur && cur.done));
    if (!(cur && cur.done)) toast('Задача закрыта', {undo: () => Tasks.done(col, id, eid, false)});
  });
}

function revenueByMonth(list, months) {
  const types = Object.keys(PAY_TYPES).filter(k => k !== 'refund');
  const m = Object.fromEntries(months.map(x => [x, Object.fromEntries(types.map(t => [t, 0]))]));
  list.forEach(c => cx(c).ok.forEach(p => {
    const mm = monthOf(isoTs(p.t));
    if (!m[mm]) return;
    const v = cashOf(p);
    if (p.type === 'refund') m[mm].sub += v; else if (m[mm][p.type] !== undefined) m[mm][p.type] += v;
  }));
  const groups = [
    {name: 'Подписки', color: '#5A50C0', keys: ['sub', 'year']},
    {name: 'Курсы и консультации', color: '#AD4C74', keys: ['course', 'consult']},
    {name: 'События и клубы', color: '#4F7A7A', keys: ['event', 'club']},
    {name: 'Маркет', color: '#2C7753', keys: ['market']},
    {name: 'Пополнения', color: '#C08F3B', keys: ['topup']},
  ];
  return {labels: months.map(monthShort), series: groups.map(g => ({name: g.name, color: g.color, values: months.map(x => sum(g.keys, k => m[x][k]))}))};
}

App.register('home', {
  title: 'Дашборд',
  render(root) {
    const t = today(), s = settings();
    const per = View.get('home.period', '30');
    const from = periodFrom(per);
    const days = daysBetween(from, t) + 1;
    const prevFrom = addDays(from, -days), prevTo = addDays(from, -1);
    const vis = Clients.visible();
    const all = Clients.all();
    const inP = (d, a = from, b = t) => d && d >= a && d <= b;

    const newC = vis.filter(c => inP(c.created)).length;
    const newPrev = vis.filter(c => inP(c.created, prevFrom, prevTo)).length;
    const firstPays = vis.filter(c => cx(c).firstPay && inP(isoTs(cx(c).firstPay)));
    const firstPrev = vis.filter(c => cx(c).firstPay && inP(isoTs(cx(c).firstPay), prevFrom, prevTo)).length;
    const cash = sum(vis, c => sum(cx(c).ok.filter(p => inP(isoTs(p.t))), cashOf));
    const cashPrev = sum(vis, c => sum(cx(c).ok.filter(p => inP(isoTs(p.t), prevFrom, prevTo)), cashOf));
    const payN = sum(vis, c => cx(c).ok.filter(p => p.type !== 'refund' && p.method !== 'balance' && inP(isoTs(p.t))).length);
    const active = all.filter(c => ['active', 'expiring'].includes(cx(c).sub));
    const trial = all.filter(c => cx(c).sub === 'trial').length;
    const expiring = all.filter(c => cx(c).sub === 'expiring').length;
    const leadsP = vis.filter(c => inP(c.created) && Funnels.idx('sales', c.stage) >= Funnels.idx('sales', 'lead'));
    const conv = leadsP.length ? leadsP.filter(c => c.stage === 'paid').length / leadsP.length : null;
    const waiting = vis.filter(c => cx(c).waiting && c.stage !== 'lost').length;
    const plan = s.plan;
    const planStarted = t >= plan.start;
    const planFact = all.filter(c => cx(c).firstPay && isoTs(cx(c).firstPay) >= plan.start && isoTs(cx(c).firstPay) <= plan.end).length;

    const hour = new Date().getHours();
    const hello = hour < 5 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
    const me = Who.member();
    const canMoney = Who.can('money.view');

    const tiles = `
      <a class="card stat as-link" href="#clients"><span class="label">Новые контакты</span><div class="big">${fmt(newC)}</div><div class="foot">${periodDelta(newC, newPrev)} к прошлым ${days} дн.</div></a>
      <a class="card stat as-link" href="#funnels"><span class="label">Первые оплаты</span><div class="big">${fmt(firstPays.length)}</div><div class="foot">${periodDelta(firstPays.length, firstPrev)} · конверсия заявки ${conv === null ? '—' : pct(conv)}</div></a>
      ${canMoney ? `<a class="card stat as-link" href="#reports"><span class="label">Выручка</span><div class="big">${rubK(cash)}</div><div class="foot">${periodDelta(cash, cashPrev)} · ${fmt(payN)} ${plural(payN, 'оплата', 'оплаты', 'оплат')}, ср. чек ${payN ? rubK(cash / payN) : '—'}</div></a>` : ''}
      <div class="card stat"><span class="label">Активные подписки</span><div class="big">${fmt(active.length)}</div><div class="foot">${expiring ? `<span class="warn">${expiring} заканчиваются</span> · ` : ''}${trial} на пробном</div></div>
      <div class="card stat"><span class="label">План: ${esc(plan.name)}</span><div class="big">${fmt(planFact)} <small>из ${fmt(plan.target)}</small></div>${progress(plan.target ? planFact / plan.target : 0, 'good')}<div class="foot">${planStarted ? 'первых оплат по цели «Цель»' : `старт ${dayLong(plan.start)} · минимум ${plan.min}, прорыв ${plan.max}`}</div></div>
      <a class="card stat as-link" href="#inbox"><span class="label">Ждут ответа</span><div class="big ${waiting ? 'bad' : ''}">${fmt(waiting)}</div><div class="foot">норма ответа — ${s.replyMinutes} минут</div></a>`;

    const cohort = vis.filter(c => inP(c.created));
    const funnel = reachFunnel(cohort.length ? cohort : vis);
    const teamTasks = !Tasks.mine().length && Who.can('clients.all');
    const myTasks = (teamTasks ? Tasks.open() : Tasks.mine()).slice(0, 8);
    const months = monthsBack(6);
    const rev = revenueByMonth(all, months);

    /* источники: клиентки за период и сколько из них оплатили */
    const srcRows = Object.entries(SOURCES).map(([k, n]) => {
      const L = vis.filter(c => c.source === k && inP(c.created));
      const paid = L.filter(c => cx(c).ltv > 0).length;
      return {name: n, v: L.length, paid};
    }).filter(r => r.v).sort((a, b) => b.v - a.v);

    /* менеджеры */
    const since = dateOf(from).getTime();
    const mgrRows = Team.assignable().map(m => {
      let calls = 0, talk = 0, msgs = 0, pays = 0, cashM = 0, owned = 0;
      all.forEach(c => {
        if (c.manager === m.id) owned++;
        Ev.list(c).forEach(e => {
          if (e.t < since || e.by !== m.id) return;
          if (e.kind === 'call') { calls++; talk += e.dur || 0; }
          if (e.kind === 'msg' && e.dir === 'out') msgs++;
        });
        if (c.manager === m.id) cx(c).ok.forEach(p => { if (p.t >= since && p.type !== 'refund') { pays++; cashM += cashOf(p); } });
      });
      return {m, calls, talk, msgs, pays, cash: cashM, owned};
    }).filter(r => r.owned || r.calls || r.msgs);

    /* лента */
    const feed = [];
    vis.forEach(c => Ev.list(c).forEach(e => { if (['msg', 'call', 'pay', 'stage'].includes(e.kind) && e.t > Date.now() - 7 * 864e5) feed.push({c, e}); }));
    feed.sort((a, b) => b.e.t - a.e.t);
    const feedText = ({c, e}) => {
      const who = e.by ? Team.first(Team.get(e.by)) : '';
      if (e.kind === 'msg') return e.dir === 'in' ? `<b>${esc(Clients.name(c))}</b> <span>написала в ${esc(CHANNELS[e.ch].name)}:</span> ${esc(String(e.text).slice(0, 70))}` : `<b>${esc(who || 'Менеджер')}</b> <span>ответила</span> ${esc(Clients.name(c))}`;
      if (e.kind === 'call') return `<b>${esc(who || 'Звонок')}</b> <span>${e.result === 'ok' ? 'поговорила с' : 'не дозвонилась до'}</span> ${esc(Clients.name(c))}${e.dur ? ` · ${dur(e.dur)}` : ''}`;
      if (e.kind === 'pay') return `<b>${esc(Clients.name(c))}</b> <span>${e.status === 'ok' ? (e.type === 'refund' ? 'возврат' : 'оплатила') : 'получила счёт'}</span> ${e.amount ? rub(e.amount) : ''} · ${esc((PAY_TYPES[e.type] || {}).name || '')}`;
      return `<b>${esc(Clients.name(c))}</b> <span>→ ${esc((Funnels.stage('sales', e.to) || {}).name || e.to)}</span>`;
    };

    root.innerHTML = `
      ${pageHead(`${hello}${me ? ', ' + esc(Team.first(me)) : ''}`, `${cap(dayWd(t))} · в вашей зоне ${fmt(vis.length)} ${plural(vis.length, 'клиентка', 'клиентки', 'клиенток')}, ${fmt(Tasks.mine().length)} ${plural(Tasks.mine().length, 'открытая задача', 'открытые задачи', 'открытых задач')}`,
        `<div class="seg">${Object.entries(PERIODS).map(([k, p]) => `<button data-per="${k}" class="${k === per ? 'on' : ''}">${p.name}</button>`).join('')}</div>
         ${Who.can('clients.edit') && !Who.readOnly() ? `<button class="btn primary" data-new-client>${icon('plus')}Клиентка</button>` : ''}`)}
      ${!all.length ? emptyBaseHtml() : ''}
      <div class="tiles6">${tiles}</div>
      <div class="split section">
        <div class="card"><div class="card-head"><h2>Воронка продаж</h2><span class="note">${cohort.length ? `контакты за ${esc(PERIODS[per].name.toLowerCase())}: сколько дошли до этапа` : 'вся база: сколько дошли до этапа'}</span></div>
          ${funnelBars(funnel)}
          <div class="row" style="margin-top:12px"><a class="btn sm" href="#funnels">${icon('funnel')}Открыть доску</a><a class="btn sm ghost" href="#reports">Конверсии по сегментам</a></div>
        </div>
        <div class="card"><div class="card-head"><h2>Требует внимания</h2></div><div class="attn">${attentionHtml(all)}</div></div>
      </div>
      <div class="split section">
        <div class="card"><div class="card-head"><h2>${teamTasks ? 'Задачи команды' : 'Мои задачи'}</h2><span class="note">${teamTasks ? `${Tasks.open().filter(x => x.due && x.due < t).length} просрочено` : Tasks.mineOverdue() ? `<span class="bad">${Tasks.mineOverdue()} просрочено</span>` : 'просроченных нет'}</span></div>
          ${myTasks.length ? `<div class="task-list">${myTasks.map(taskRowHtml).join('')}</div>` : '<p class="note">Открытых задач нет. Задача ставится из карточки клиентки: «Задача» в ленте.</p>'}
        </div>
        <div class="card"><div class="card-head"><h2>Что происходило</h2><span class="note">7 дней</span></div>
          ${feed.length ? `<div class="feed2">${feed.slice(0, 8).map(x => `<a href="#client-${x.c.id}">${x.e.kind === 'msg' ? chBadge(x.e.ch) : `<span class="ch" style="--c:var(--ink-3)"><svg viewBox="0 0 24 24">${ICONS[x.e.kind === 'call' ? 'phone' : x.e.kind === 'pay' ? 'card' : 'arrow']}</svg></span>`}<span class="f-t">${feedText(x)}</span><small>${timeAgo(x.e.t)}</small></a>`).join('')}</div>` : '<p class="note">За неделю событий нет.</p>'}
        </div>
      </div>
      ${canMoney ? `<section class="section card"><div class="card-head"><h2>Деньги по месяцам</h2><span class="note">поступления без оплат с баланса, за вычетом возвратов</span></div>${stackChart({labels: rev.labels, series: rev.series, height: 230})}</section>` : ''}
      <div class="split section">
        <div class="card"><div class="card-head"><h2>Откуда приходят</h2><span class="note">контакты за период · справа — сколько оплатили</span></div>
          ${hbarList(srcRows, {sub: r => r.paid ? `${r.paid} опл.` : ''})}</div>
        <div class="card"><div class="card-head"><h2>Менеджеры</h2><span class="note">за период</span></div>
          ${mgrRows.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Кто</th><th class="r">Клиенток</th><th class="r">Звонки</th><th class="r">Сообщ.</th><th class="r">Оплаты</th></tr></thead><tbody>
            ${mgrRows.map(r => `<tr><td><span class="row" style="gap:8px;align-items:center;flex-wrap:nowrap">${Team.av(r.m)}${esc(Team.name(r.m))}</span></td><td class="r">${r.owned}</td><td class="r">${r.calls}<br><small class="muted">${durLong(r.talk)}</small></td><td class="r">${r.msgs}</td><td class="r">${r.pays}${canMoney ? `<br><small class="muted">${rubK(r.cash)}</small>` : ''}</td></tr>`).join('')}
          </tbody></table></div>` : '<p class="note">Пока нет активности.</p>'}
        </div>
      </div>`;

    on(root, 'click', '[data-per]', (e, el) => { View.set('home.period', el.dataset.per); App.render(); });
    on(root, 'click', '[data-new-client]', () => openClientForm(null));
    on(root, 'click', '[data-go]', (e, el) => App.go(el.dataset.go));
    wireTaskDone(root);
    wireEmptyBase(root);
  },
});

/* пустая база: загрузить пример или начать с чистого листа */
function emptyBaseHtml() {
  const can = Who.can('settings.edit') && !Who.readOnly();
  return `<div class="help start"><div><b>База пока пустая</b>
    <p style="margin-top:4px">Загрузите демо-данные — 78 вымышленных клиенток с анкетами, перепиской, звонками и оплатами, эксперты, партнёры и чат конференции — и посмотрите, как всё работает. Удалить их можно одной кнопкой в «Настройках → Данные». Или начните сразу со своей базы: «Клиенты → Загрузить CSV».</p>
    ${can ? `<div class="row" style="margin-top:10px"><button class="btn primary sm" data-demo-load>${icon('db')}Загрузить демо-данные</button><a class="btn sm" href="#clients">Загрузить свою базу</a></div>` : '<p class="note" style="margin-top:6px">Загрузить данные может руководитель.</p>'}
  </div></div>`;
}
function wireEmptyBase(root) {
  on(root, 'click', '[data-demo-load]', async (e, el) => {
    el.disabled = true;
    el.textContent = 'Загружаю…';
    const n = await Demo.load((k, total) => { el.textContent = `Загружаю… ${k} из ${total}`; });
    toast(`Загружено ${n} демо-записей`);
    App.render();
  });
}
