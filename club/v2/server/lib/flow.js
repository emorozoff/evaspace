/* Бюджетирование: кто согласует, маршрут и где сейчас заявка или бюджет направления.
   Один файл на двоих: штаб собирает его в страницу (build.py) — показать маршрут и кнопки,
   сервер берёт через require — проверить, что решение принимает тот, чья очередь (hq-rules.js).
   Поменяли правило здесь — оно поменялось и на экране, и в проверке.

   Разовая заявка идёт по сумме: до 50 000 ₽ — финдиректор, до 150 000 ₽ — ещё гендиректор,
   дороже — ещё акционеры (пороги меняются в настройках). Бюджет направления — по горизонту:
   месяц — финдиректор, квартал — и гендиректор, год — и акционеры.
   Свою заявку согласует уровень выше; один человек на двух шагах подряд решает один раз.
   У акционеров решает большинство. «На доработку» возвращает автору: он правит и отправляет
   снова — начинается новый круг, прежние решения остаются в истории. */

const Flow = (() => {
  const LIMITS = {cfoLimit: 50000, ceoLimit: 150000};
  const STEPS = {cfo: 'Финдиректор', ceo: 'Гендиректор', board: 'Акционеры'};
  const VERDICTS = ['ok', 'revise', 'no'];
  const keyOf = a => a.personId || a.id;
  const pad2 = n => String(n).padStart(2, '0');

  /* настройки бюджета из docs/settings.budget с порогами по умолчанию */
  function cfg(budget) {
    const b = budget && typeof budget === 'object' ? budget : {};
    const num = (v, d) => (Number(v) > 0 ? Number(v) : d);
    return {...b, cfoLimit: num(b.cfoLimit, LIMITS.cfoLimit), ceoLimit: Math.max(num(b.ceoLimit, LIMITS.ceoLimit), num(b.cfoLimit, LIMITS.cfoLimit))};
  }
  /* кто согласует: выбранные в настройках, а если не выбраны — по ролям учёток.
     Финдиректор — первая учётка «Финансы» (иначе основатель), гендиректор — основатель из «Команды»
     (иначе первая учётка «Основатель»), акционеры — основатели и инвесторы */
  function people(budget, accounts, persons) {
    const b = budget || {};
    const live = (accounts || []).filter(a => a && a.active !== false && a.name);
    const byRole = r => live.filter(a => a.role === r).map(keyOf);
    const founder = (persons || []).find(p => p && p.founder && !p.archived && live.some(a => a.personId === p.id));
    const cfo = b.cfo || byRole('finance')[0] || byRole('owner')[0] || null;
    const ceo = b.ceo || (founder && founder.id) || byRole('owner')[0] || null;
    const board = Array.isArray(b.board) && b.board.length ? b.board : [...byRole('owner'), ...byRole('investor')];
    return {cfo, ceo, board: board.filter((k, i, a) => k && a.indexOf(k) === i)};
  }
  /* маршрут: бюджет направления — по горизонту, разовая заявка — по сумме */
  function route(doc, budget) {
    if (doc.ptype) return doc.ptype === 'year' ? ['cfo', 'ceo', 'board'] : doc.ptype === 'quarter' ? ['cfo', 'ceo'] : ['cfo'];
    const c = cfg(budget), a = Number(doc.amount) || 0;
    return a <= c.cfoLimit ? ['cfo'] : a <= c.ceoLimit ? ['cfo', 'ceo'] : ['cfo', 'ceo', 'board'];
  }
  /* кто решает на шаге. Свою заявку согласует уровень выше: финдиректор → гендиректор → акционеры */
  function deciders(step, who, author) {
    const board = who.board.filter(k => k !== author);
    if (step === 'board') return board;
    if (step === 'ceo') return who.ceo && who.ceo !== author ? [who.ceo] : board;
    if (who.cfo && who.cfo !== author) return [who.cfo];
    return who.ceo && who.ceo !== author ? [who.ceo] : board;
  }
  /* где сейчас: draft — черновик, review — на согласовании (step — чей шаг, waiting — от кого ждём),
     revise — на доработке, approved — согласовано, rejected — отказ, withdrawn — отозвано */
  function state(doc, who, budget) {
    const r = route(doc, budget), round = Number(doc.round) || 0;
    const base = {route: r, step: null, waiting: [], round, done: {}};
    if (doc.withdrawn) return {...base, status: 'withdrawn'};
    if (!doc.sentAt || !round) return {...base, status: 'draft'};
    const ds = Object.values(doc.decisions || {}).filter(d => d && d.round === round).sort((a, b) => (a.at || 0) - (b.at || 0));
    let prev = null;
    for (const step of r) {
      const can = deciders(step, who, doc.by);
      /* тот же единственный человек, что решал на прошлом шаге, второй раз не решает */
      if (prev && can.length === 1 && prev.length === 1 && can[0] === prev[0]) { base.done[step] = base.done[r[r.indexOf(step) - 1]]; continue; }
      const last = {};
      ds.filter(d => d.step === step).forEach(d => { last[d.by] = d; });
      const votes = Object.values(last);
      const back = votes.find(d => d.verdict === 'revise');
      if (back) return {...base, status: 'revise', step, by: back.by, note: back.note || ''};
      if (step === 'board') {
        const n = Math.max(1, can.length), ok = votes.filter(d => d.verdict === 'ok').length, no = votes.filter(d => d.verdict === 'no');
        if (ok * 2 > n) { base.done[step] = votes.filter(d => d.verdict === 'ok'); prev = can; continue; }
        if (no.length && no.length * 2 >= n) return {...base, status: 'rejected', step, by: no[no.length - 1].by, note: no[no.length - 1].note || ''};
        return {...base, status: 'review', step, waiting: can.filter(k => !last[k])};
      }
      const d = votes[votes.length - 1];
      if (!d) return {...base, status: 'review', step, waiting: can};
      if (d.verdict === 'no') return {...base, status: 'rejected', step, by: d.by, note: d.note || ''};
      base.done[step] = [d];
      prev = can;
    }
    return {...base, status: 'approved'};
  }

  /* ── периоды бюджета: год «2027», квартал «2027-Q1», месяц «2027-01» ── */
  function months(ptype, period) {
    const y = Number(String(period).slice(0, 4));
    if (ptype === 'year') return Array.from({length: 12}, (_, i) => `${y}-${pad2(i + 1)}`);
    if (ptype === 'quarter') { const q = Number(String(period).slice(6)) || 1; return [0, 1, 2].map(i => `${y}-${pad2((q - 1) * 3 + i + 1)}`); }
    return [String(period).slice(0, 7)];
  }
  /* бюджетный календарь: год сдаём за месяц до начала, квартал — за две недели, месяц — за неделю */
  function deadline(ptype, period) {
    const start = months(ptype, period)[0], [y, m] = start.split('-').map(Number);
    const d = ptype === 'year' ? new Date(Date.UTC(y, m - 2, 1)) : new Date(Date.UTC(y, m - 1, 1 - (ptype === 'quarter' ? 14 : 7)));
    return d.toISOString().slice(0, 10);
  }
  /* один бюджет на направление (или отдел) и период */
  const budgetId = (period, dir, dept) => `b_${period}_${dir}${dept ? '_' + dept : ''}`;

  return {LIMITS, STEPS, VERDICTS, cfg, people, route, deciders, state, months, deadline, budgetId};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Flow;
