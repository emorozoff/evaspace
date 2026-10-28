/* Биржа идей и кайдзен: команда подаёт идеи и маленькие улучшения, голосует и обсуждает,
   основатель, руководитель и финансы рассматривают (за неделю), берут в работу — задачей и,
   если нужны деньги, заявкой на финансирование. Когда идея принесла результат, финансы
   записывают подтверждённый эффект и премию автору: за внедрённый кайдзен — фиксированная сумма,
   за прибыль или экономию — процент от эффекта за первые месяцы, за новое направление — доля
   или опцион по решению акционеров. Размеры премий — в настройках (видит и меняет основатель).
   Кто что может — server/lib/hq-rules.js (ideaWrite). */

const IDEA_TYPES = {
  kaizen: {name: 'Кайдзен', about: 'маленькое улучшение того, как мы работаем', tone: 'good'},
  idea:   {name: 'Идея', about: 'новое: продукт, канал, партнёрство, формат', tone: 'violet'},
  save:   {name: 'Экономия', about: 'как тратить меньше без потери качества', tone: 'gold'},
  event:  {name: 'Мероприятие', about: 'встреча, акция, запуск', tone: 'rose'},
};
const IDEA_ST = {
  new: {name: 'Новая', tone: 'line'}, review: {name: 'На рассмотрении', tone: 'gold'}, accepted: {name: 'Внедряем', tone: 'violet'},
  done: {name: 'Внедрена', tone: 'good'}, profit: {name: 'Принесла результат', tone: 'good'}, later: {name: 'Отложена', tone: 'line'}, declined: {name: 'Отклонена', tone: 'bad'},
};
const IDEA_TAGS = ['продукт', 'контент', 'маркетинг', 'клиенты', 'процессы', 'команда', 'автоматизация', 'партнёры', 'экономия', 'сервис'];
const IDEA_REWARD = {bonus: 'Премия', pct: 'Процент от эффекта', share: 'Доля или опцион'};
const IDEA_DEF = {ideaPct: 0.1, ideaMonths: 12, kaizenBonus: 3000, shareFrom: 3000000};

const Ideas = {
  cfg() { const b = settings().ideas || {}; return Object.fromEntries(Object.entries(IDEA_DEF).map(([k, d]) => [k, Number(b[k]) > 0 ? Number(b[k]) : d])); },
  all() { return Store.all('ideas').filter(x => x.title).sort((a, b) => (b.at || 0) - (a.at || 0)); },
  status(i) { return IDEA_ST[i.status] ? i.status : 'new'; },
  votes(i) { return Object.values(i.votes || {}).filter(Boolean).length; },
  voted(i) { return !!(i.votes || {})[Tasks.meKey()]; },
  comments(i) { return Object.entries(i.comments || {}).map(([id, c]) => ({...c, id})).sort((a, b) => (a.at || 0) - (b.at || 0)); },
  desk() { return Auth.can('tasks.manage'); },
  canEdit(i) { return this.desk() || (i.by === Tasks.meKey() && ['new', 'review', 'later'].includes(this.status(i))); },
  badge() { return Auth.me() && this.desk() ? this.all().filter(i => this.status(i) === 'new').length : 0; },
  vote(i) { const me = Tasks.meKey(); Store.patch('ideas', i.id, {votes: {[me]: this.voted(i) ? null : Date.now()}}, {mustExist: true}); },
  comment(i, text, extra = {}) { Store.patch('ideas', i.id, {comments: {[uid()]: {by: Tasks.meKey(), at: Date.now(), text, ...extra}}}, {mustExist: true}); },
  /* какую премию предложить: кайдзен без денежного эффекта — фиксированная, есть эффект — процент, крупный — доля */
  suggest(i) {
    const c = this.cfg(), eff = Number((i.result || {}).amount) || 0;
    if (!eff) return {kind: 'bonus', amount: c.kaizenBonus};
    if (eff >= c.shareFrom) return {kind: 'share', pct: c.ideaPct, amount: Math.round(eff * c.ideaPct)};
    return {kind: 'pct', pct: c.ideaPct, amount: Math.round(eff * c.ideaPct)};
  },
};

App.register('ideas', {
  title: 'Биржа идей',
  render(root) {
    const all = Ideas.all(), c = Ideas.cfg();
    const stF = View.get('id.st', 'all'), tyF = View.get('id.ty', ''), sort = View.get('id.sort', 'new'), q = View.get('id.q', '');
    const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е');
    const groups = {all: null, new: ['new'], review: ['review'], accepted: ['accepted'], done: ['done', 'profit'], archive: ['later', 'declined']};
    const list = all.filter(i => (!groups[stF] || groups[stF].includes(Ideas.status(i))) && (!tyF || i.type === tyF)
      && (!q || norm(`${i.title} ${i.problem} ${i.proposal} ${i.effect} ${(i.tags || []).join(' ')} ${whoName(i.by)}`).includes(norm(q))));
    if (sort === 'top') list.sort((a, b) => Ideas.votes(b) - Ideas.votes(a) || (b.at || 0) - (a.at || 0));
    const done = all.filter(i => ['done', 'profit'].includes(Ideas.status(i)));
    const effect = sum(all, i => (i.result || {}).amount), rewards = sum(all, i => (i.reward || {}).amount);
    const n = st => all.filter(i => !groups[st] || groups[st].includes(Ideas.status(i))).length;
    root.innerHTML = `
      ${pageHead('Биржа идей', 'Идеи и кайдзен — непрерывные улучшения от всей команды. Идея принесла результат — автор получает премию.', `<button class="btn primary sm" id="idNew">${icon('plus')}Предложить идею</button>`)}
      ${helpBox('ideas', `<b>Что такое кайдзен.</b> Японская система непрерывного улучшения: не ждём большой реформы, а каждый день понемногу улучшаем то, как работаем. Лучше всех знает, что улучшить, тот, кто делает работу. Заметили, что можно быстрее, дешевле или удобнее для клиенток, — нажмите «Предложить идею»: как сейчас, что предлагаете, что получим. Команда поддерживает голосом, руководители отвечают за неделю. Внедрили улучшение — премия ${money(c.kaizenBonus)}; идея принесла прибыль или экономию — ${pct(c.ideaPct)} от эффекта за первые ${c.ideaMonths} ${plural(c.ideaMonths, 'месяц', 'месяца', 'месяцев')}.`)}
      <div class="cards tiles id-kpi">
        ${finTile('Идей подано', fmt(all.length), `${fmt(n('new'))} ждут рассмотрения`)}
        ${finTile('Внедрено', fmt(done.length), `в работе ${fmt(n('accepted'))}`)}
        ${finTile('Подтверждённый эффект', money(effect), 'прибыль и экономия от идей')}
        ${finTile('Премии авторам', money(rewards), `выплачено ${money(sum(all.filter(i => (i.reward || {}).paidAt), i => i.reward.amount))}`)}
      </div>
      <div class="bg-tools">
        <div class="seg">${[['all', 'Все'], ['new', 'Новые'], ['review', 'На рассмотрении'], ['accepted', 'Внедряем'], ['done', 'Внедрены'], ['archive', 'Архив']].map(([k, nm]) => `<button type="button" data-idst="${k}" class="${k === stF ? 'on' : ''}">${nm}${n(k) && k !== 'all' ? ` · ${n(k)}` : ''}</button>`).join('')}</div>
        <div class="seg">${[['new', 'Свежие'], ['top', 'Популярные']].map(([k, nm]) => `<button type="button" data-idsort="${k}" class="${k === sort ? 'on' : ''}">${nm}</button>`).join('')}</div>
        <input class="input" id="idQ" type="search" placeholder="Поиск по идеям" value="${esc(q)}">
      </div>
      <div class="chips bg-tags">${Object.entries(IDEA_TYPES).map(([k, x]) => `<button type="button" class="chip ${k === tyF ? 'on' : ''}" data-idty="${k}" title="${esc(x.about)}">${x.name}</button>`).join('')}</div>
      ${list.length ? `<div class="id-grid">${list.map(ideaCardHtml).join('')}</div>`
        : `<div class="empty"><b>${all.length ? 'Ничего не нашлось' : 'Идей пока нет'}</b>${all.length ? 'Снимите фильтр или поищите другое слово.' : 'Будьте первой: что в нашей работе можно сделать быстрее, дешевле или удобнее?'}</div>`}
      ${ideaRulesHtml()}`;
    wireHelp(root);
    on(root, 'click', '[data-idst]', (e, el) => { View.set('id.st', el.dataset.idst); App.render(); });
    on(root, 'click', '[data-idsort]', (e, el) => { View.set('id.sort', el.dataset.idsort); App.render(); });
    on(root, 'click', '[data-idty]', (e, el) => { View.set('id.ty', View.get('id.ty', '') === el.dataset.idty ? '' : el.dataset.idty); App.render(); });
    on(root, 'click', '[data-idea]', (e, el) => {
      const v = e.target.closest('[data-ivote]');
      if (v) { const i = Store.get('ideas', v.dataset.ivote); if (i) Ideas.vote(i); return; }
      openIdea(el.dataset.idea);
    });
    on(root, 'keydown', '[data-idea]', (e, el) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === el) { e.preventDefault(); openIdea(el.dataset.idea); } });
    const qi = $('#idQ', root);
    let t = null;
    qi.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { View.set('id.q', qi.value); App.render({focus: 'idQ'}); }, 300); });
    $('#idNew', root).onclick = () => editIdea(null);
    if (Auth.can('settings.edit')) wireIdeaSettings(root);
  },
});

function ideaCardHtml(i) {
  const st = Ideas.status(i), ty = IDEA_TYPES[i.type] || IDEA_TYPES.idea, a = personById(i.by);
  const nc = Ideas.comments(i).length;
  return `<div class="card id-card st-${st}" data-idea="${i.id}" role="button" tabindex="0">
    <div class="id-top"><span class="pill ${ty.tone}">${ty.name}</span><span class="pill ${IDEA_ST[st].tone}">${IDEA_ST[st].name}</span></div>
    <b class="id-title">${esc(i.title)}</b>
    <p class="id-text">${esc(String(i.proposal || i.problem || '').slice(0, 220))}</p>
    ${Number(i.profitEst) > 0 || (i.result || {}).amount ? `<p class="id-eff">${(i.result || {}).amount ? `эффект <b>${money(i.result.amount)}</b>` : `ожидаем ${money(Number(i.profitEst))} в год`}${(i.reward || {}).amount ? ` · премия автору ${money(i.reward.amount)}` : ''}</p>` : ''}
    <div class="id-foot">${avatar(a || {name: whoName(i.by)}, 'xs')}<span>${esc(whoFirst(i.by))} · ${timeAgo(i.at)}</span>
      <span class="id-acts">${nc ? `<span class="t-cm">${icon('msg')}${nc}</span>` : ''}<button type="button" class="id-vote ${Ideas.voted(i) ? 'on' : ''}" data-ivote="${i.id}" title="${Ideas.voted(i) ? 'Убрать голос' : 'Поддержать идею'}">${icon('heart')}${Ideas.votes(i) || ''}</button></span></div>
  </div>`;
}

function openIdea(id) {
  const i = Store.get('ideas', id);
  if (!i) return;
  const st = Ideas.status(i), ty = IDEA_TYPES[i.type] || IDEA_TYPES.idea, desk = Ideas.desk(), me = Tasks.meKey();
  const task = i.taskId ? Tasks.get(i.taskId) : null, req = (i.reqId && Store.get('fundreqs', i.reqId)) || Budget.reqs().find(q => q.ideaId === i.id) || null;
  const sug = Ideas.suggest(i), rw = i.reward || null, res = i.result || null, c = Ideas.cfg();
  const block = (label, v) => (String(v || '').trim() ? `<div class="fl-text"><span class="label">${label}</span><p>${esc(v).replace(/\n/g, '<br>')}</p></div>` : '');
  openModal({
    title: i.title,
    wide: true,
    body: `<div class="fl-view">
        <div class="id-top"><span class="pill ${ty.tone}">${ty.name}</span><span class="pill ${IDEA_ST[st].tone}">${IDEA_ST[st].name}</span>${(i.tags || []).map(t => `<span class="pill line">#${esc(t)}</span>`).join('')}</div>
        <p class="note">Предложил(а) ${esc(whoName(i.by))}, ${timeAgo(i.at)}${i.dir ? ' · ' + esc(dirName(i.dir)) : ''} · ${Ideas.votes(i)} ${plural(Ideas.votes(i), 'голос', 'голоса', 'голосов')}</p>
        ${block('Как сейчас', i.problem)}${block('Что предлагаю', i.proposal)}${block('Что получим', i.effect)}
        ${Number(i.profitEst) > 0 || Number(i.costEst) > 0 ? `<p class="note">${Number(i.profitEst) > 0 ? `Ожидаемая прибыль или экономия: <b>${money(Number(i.profitEst))}</b> в год. ` : ''}${Number(i.costEst) > 0 ? `Нужно денег на запуск: <b>${money(Number(i.costEst))}</b>.` : ''}</p>` : ''}
        ${i.verdict ? `<div class="fl-verdict ${['declined'].includes(st) ? 'rejected' : st === 'later' ? 'revise' : 'approved'}"><b>${esc(whoName(i.statusBy))}:</b> ${esc(i.verdict)}</div>` : ''}
        ${task || req ? `<p class="note">${task ? `Задача: <a href="#tasks" data-open-task="${task.id}">${esc(task.title)}</a>. ` : ''}${req ? `Заявка на финансирование: <a href="#budget" data-open-req="${req.id}">${esc(req.title)}</a> — ${FLOW_ST[Budget.state(req).status].name.toLowerCase()}.` : ''}</p>` : ''}
        ${res || rw ? `<div class="id-result">${res ? `<span>Подтверждённый эффект: <b>${money(Number(res.amount) || 0)}</b>${res.months ? ` за ${res.months} ${plural(res.months, 'месяц', 'месяца', 'месяцев')}` : ''}${res.note ? ` — ${esc(res.note)}` : ''}</span>` : ''}
          ${rw ? `<span>Премия автору: <b>${rw.kind === 'share' ? 'доля или опцион' : money(Number(rw.amount) || 0)}</b> · ${IDEA_REWARD[rw.kind] || ''}${rw.kind === 'pct' && rw.pct ? ` ${pct(rw.pct)}` : ''}${rw.note ? ` — ${esc(rw.note)}` : ''} · <b class="${rw.paidAt ? 'good' : 'gold'}">${rw.paidAt ? 'выплачено' : 'к выплате'}</b></span>` : ''}</div>` : ''}
        ${desk ? `<details class="id-desk" ${['new', 'review'].includes(st) ? 'open' : ''}><summary>Рассмотрение и премия</summary>
          <div class="field"><span>Статус</span><div class="seg" id="idSt">${Object.entries(IDEA_ST).map(([k, x]) => `<button type="button" data-idset="${k}" class="${k === st ? 'on' : ''}">${x.name}</button>`).join('')}</div></div>
          <label class="field"><span>Решение для автора <small>почему берём, откладываем или нет — автор увидит</small></span><textarea class="textarea" id="idVerdict" rows="2">${esc(i.verdict || '')}</textarea></label>
          <div class="grid3">
            <label class="field"><span>Подтверждённый эффект, ₽</span><input class="input num" id="idEff" inputmode="decimal" value="${res ? esc(res.amount) : ''}" placeholder="прибыль или экономия"></label>
            <label class="field"><span>За сколько месяцев</span><input class="input num" id="idEffM" inputmode="numeric" value="${res && res.months ? esc(res.months) : c.ideaMonths}"></label>
            <label class="field"><span>Как посчитали</span><input class="input" id="idEffN" value="${res ? esc(res.note || '') : ''}" placeholder="откуда цифра"></label>
          </div>
          <div class="grid3">
            <label class="field"><span>Премия</span><select class="select" id="idRwK">${Object.entries(IDEA_REWARD).map(([k, n]) => `<option value="${k}" ${k === ((rw && rw.kind) || sug.kind) ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
            <label class="field"><span>Сумма премии, ₽</span><input class="input num" id="idRwA" inputmode="decimal" value="${rw ? esc(rw.amount || '') : ''}" placeholder="${sug.amount}"></label>
            <label class="field"><span>Комментарий</span><input class="input" id="idRwN" value="${rw ? esc(rw.note || '') : ''}" placeholder="например: за IV квартал"></label>
          </div>
          <p class="fl-hint">${icon('spark')}<span>По правилам: кайдзен — ${money(c.kaizenBonus)}, прибыль или экономия — ${pct(c.ideaPct)} от эффекта за ${c.ideaMonths} мес., новое направление с эффектом от ${money(c.shareFrom)} в год — доля или опцион по решению акционеров. Предлагаем: <b>${sug.kind === 'share' ? 'доля или опцион' : money(sug.amount)}</b>.</span></p>
          <div class="row"><button class="btn primary" id="idDeskSave">Сохранить решение</button>${rw && !rw.paidAt ? '<button class="btn" id="idPaid">Отметить: премия выплачена</button>' : ''}
            ${!task ? `<button class="btn ghost" id="idTask">${icon('check')}Поставить задачу</button>` : ''}</div>
        </details>` : ''}
        <div class="id-thread"><span class="label">Обсуждение</span>
          ${Ideas.comments(i).map(x => `<div class="id-c ${x.kind === 'status' ? 'sys' : ''}"><b>${esc(whoName(x.by))}</b><small>${timeAgo(x.at)}</small><p>${esc(x.text).replace(/\n/g, '<br>')}</p></div>`).join('') || '<p class="note">Пока никто не писал. Поддержите идею или задайте вопрос автору.</p>'}
          <div class="row id-c-new"><textarea class="textarea" id="idC" rows="2" placeholder="Вопрос, уточнение или как улучшить идею"></textarea><button class="btn sm" id="idCSend">${icon('msg')}Написать</button></div>
        </div>
      </div>`,
    foot: `<span class="left row">${(i.by === me && st === 'new') || Auth.isOwner() ? `<button class="btn danger" id="idDel" title="Удалить">${icon('trash')}</button>` : ''}${Ideas.canEdit(i) ? `<button class="btn" id="idEdit">${icon('edit')}Изменить</button>` : ''}</span>
      ${(i.by === me || desk) && !req && !['declined'].includes(st) ? `<button class="btn" id="idReq">${icon('pie')}Заявка на финансирование</button>` : ''}
      <button class="btn" data-close>Закрыть</button>
      <button class="btn ${Ideas.voted(i) ? '' : 'primary'}" id="idVote">${icon('heart')}${Ideas.voted(i) ? 'Убрать голос' : 'Поддержать'}</button>`,
    onMount(el, close) {
      $('#idVote', el).onclick = () => { Ideas.vote(i); close(); };
      on(el, 'click', '[data-open-task]', (e, a) => { e.preventDefault(); close(); openTask(a.dataset.openTask); });
      on(el, 'click', '[data-open-req]', (e, a) => { e.preventDefault(); close(); openReq(a.dataset.openReq); });
      $('#idCSend', el).onclick = () => {
        const t = $('#idC', el).value.trim();
        if (!t) { $('#idC', el).focus(); return; }
        Ideas.comment(i, t);
        close();
        setTimeout(() => openIdea(i.id), 60);
      };
      const ed = $('#idEdit', el);
      if (ed) ed.onclick = () => { close(); editIdea(i.id); };
      const del = $('#idDel', el);
      if (del) del.onclick = async () => { if (await confirmPop(del, {text: 'Удалить идею насовсем?', yes: 'Удалить', danger: true})) { Store.remove('ideas', i.id); close(); } };
      const rq = $('#idReq', el);
      if (rq) rq.onclick = () => {
        close();
        editReq(null, {kind: 'idea', ideaId: i.id, title: i.title, dir: i.dir || '', amount: Number(i.costEst) || '', why: '', gain: i.effect || '', need: [i.problem, i.proposal].filter(Boolean).join('\n\n'), tags: (i.tags || []).slice(0, 5)});
      };
      if (!desk) return;
      on(el, 'click', '[data-idset]', (e, b) => $$('[data-idset]', el).forEach(x => x.classList.toggle('on', x === b)));
      $('#idRwK', el).onchange = e => { if (e.target.value === 'share') $('#idRwA', el).value = ''; };
      $('#idDeskSave', el).onclick = () => {
        const next = ($('[data-idset].on', el) || {}).dataset?.idset || st, verdict = $('#idVerdict', el).value.trim();
        const eff = Math.round(parseNum($('#idEff', el).value) || 0), effM = Math.round(parseNum($('#idEffM', el).value) || 0);
        const kind = $('#idRwK', el).value, amt = Math.round(parseNum($('#idRwA', el).value) || 0);
        const patch = {upd: Date.now()};
        if (next !== st || verdict !== (i.verdict || '')) Object.assign(patch, {status: next, verdict, statusBy: me, statusAt: Date.now()});
        if (eff) patch.result = {amount: eff, months: effM || c.ideaMonths, note: $('#idEffN', el).value.trim(), by: me, at: Date.now()};
        if (amt || kind === 'share' && (eff || rw)) patch.reward = {kind, amount: amt, ...(kind !== 'bonus' ? {pct: c.ideaPct} : {}), note: $('#idRwN', el).value.trim(), by: me, at: Date.now(), ...(rw && rw.paidAt ? {paidAt: rw.paidAt} : {})};
        if (eff && !patch.status && !['profit'].includes(st)) Object.assign(patch, {status: 'profit', statusBy: me, statusAt: Date.now()});
        if (next === 'declined' && !verdict) { $('#idVerdict', el).focus(); toast('Объясните автору, почему нет — так идеи будут лучше'); return; }
        Store.patch('ideas', i.id, patch, {mustExist: true});
        if (patch.status && patch.status !== st) Ideas.comment(i, `Статус: ${IDEA_ST[patch.status].name}${verdict ? ` — ${verdict}` : ''}`, {kind: 'status', status: patch.status});
        toast('Решение по идее сохранено — автор получит уведомление');
        close();
      };
      const paid = $('#idPaid', el);
      if (paid) paid.onclick = () => { Store.patch('ideas', i.id, {reward: {paidAt: Date.now()}, upd: Date.now()}, {mustExist: true}); toast('Премия отмечена выплаченной'); close(); };
      const tk = $('#idTask', el);
      if (tk) tk.onclick = () => {
        const tid = Tasks.create({title: `Внедрить идею: ${i.title}`.slice(0, 200), desc: [i.problem && `Как сейчас: ${i.problem}`, i.proposal && `Что предлагаем: ${i.proposal}`, i.effect && `Что получим: ${i.effect}`].filter(Boolean).join('\n\n'), assignee: personById(i.by) ? i.by : Auth.personId(), dir: i.dir || ''});
        Store.patch('ideas', i.id, {taskId: tid, ...(['new', 'review'].includes(st) ? {status: 'accepted', statusBy: me, statusAt: Date.now()} : {}), upd: Date.now()}, {mustExist: true});
        close();
      };
    },
  });
}

function editIdea(id) {
  const cur = id ? Store.get('ideas', id) : null;
  const v = cur ? clone(cur) : {title: '', type: 'kaizen', problem: '', proposal: '', effect: '', profitEst: '', costEst: '', dir: (Auth.person() || {}).dir || '', tags: []};
  const tagsHtml = () => [...new Set([...IDEA_TAGS, ...(v.tags || [])])].map(t => `<button type="button" class="chip ${(v.tags || []).includes(t) ? 'on' : ''}" data-itag="${esc(t)}">#${esc(t)}</button>`).join('');
  openModal({
    title: cur ? 'Идея' : 'Новая идея',
    wide: true,
    body: `<div class="fr-form">
      <div class="field"><span>Что это</span><div class="seg" id="iTy">${Object.entries(IDEA_TYPES).map(([k, x]) => `<button type="button" data-ity="${k}" class="${k === v.type ? 'on' : ''}" title="${esc(x.about)}">${x.name}</button>`).join('')}</div><small id="iTyAbout">${esc((IDEA_TYPES[v.type] || IDEA_TYPES.idea).about)}</small></div>
      <label class="field"><span>Коротко — в чём идея</span><input class="input" id="iT" maxlength="200" value="${esc(v.title)}" placeholder="Например: шаблон ответа на частые вопросы клиенток"></label>
      <label class="field"><span>Как сейчас <small>что мешает, где теряем время или деньги</small></span><textarea class="textarea" id="iP" rows="2">${esc(v.problem)}</textarea></label>
      <label class="field"><span>Что предлагаю <small>первый шаг, который можно сделать уже на этой неделе</small></span><textarea class="textarea" id="iPr" rows="3">${esc(v.proposal)}</textarea></label>
      <label class="field"><span>Что получим <small>время, деньги, качество, довольные клиентки — лучше в цифрах</small></span><textarea class="textarea" id="iE" rows="2">${esc(v.effect)}</textarea></label>
      <div class="grid3">
        <label class="field"><span>Прибыль или экономия в год, ₽ <small>если можно оценить</small></span><input class="input num" id="iPe" inputmode="decimal" value="${esc(v.profitEst || '')}" placeholder="0"></label>
        <label class="field"><span>Нужно денег на запуск, ₽</span><input class="input num" id="iCe" inputmode="decimal" value="${esc(v.costEst || '')}" placeholder="0"></label>
        <label class="field"><span>Направление</span><select class="select" id="iDir"><option value="">— не выбрано —</option>${Object.entries(DIRS).map(([k, x]) => `<option value="${k}" ${k === v.dir ? 'selected' : ''}>${x.name}</option>`).join('')}</select></label>
      </div>
      <div class="field"><span>Теги</span><div class="chips" id="iTags">${tagsHtml()}</div></div>
    </div>`,
    foot: `<button class="btn" data-close>Отмена</button><button class="btn primary" id="iSave">${cur ? 'Сохранить' : 'Подать идею'}</button>`,
    onMount(el, close) {
      on(el, 'click', '[data-ity]', (e, b) => { v.type = b.dataset.ity; $$('[data-ity]', el).forEach(x => x.classList.toggle('on', x === b)); $('#iTyAbout', el).textContent = IDEA_TYPES[v.type].about; });
      on(el, 'click', '[data-itag]', (e, b) => { const t = b.dataset.itag; v.tags = (v.tags || []).includes(t) ? v.tags.filter(x => x !== t) : [...(v.tags || []), t]; b.classList.toggle('on'); });
      $('#iSave', el).onclick = () => {
        const title = $('#iT', el).value.trim(), proposal = $('#iPr', el).value.trim();
        if (!title) { $('#iT', el).focus(); toast('Назовите идею'); return; }
        if (!proposal) { $('#iPr', el).focus(); toast('Напишите, что предлагаете'); return; }
        const body = {title, type: v.type, problem: $('#iP', el).value.trim(), proposal, effect: $('#iE', el).value.trim(),
          profitEst: Math.round(parseNum($('#iPe', el).value) || 0), costEst: Math.round(parseNum($('#iCe', el).value) || 0), dir: $('#iDir', el).value, tags: v.tags || [], upd: Date.now()};
        if (cur) { Store.patch('ideas', cur.id, body, {mustExist: true}); toast('Идея сохранена'); }
        else { Store.add('ideas', {...body, by: Tasks.meKey(), at: Date.now(), status: 'new'}); Sound.play('sent'); toast('Идея подана — руководители ответят в течение недели'); }
        close();
      };
    },
  });
}

/* правила биржи идей: как работает кайдзен и премии; основатель меняет размеры премий */
function ideaRulesHtml() {
  const c = Ideas.cfg();
  return `<div class="split section id-rules">
    <div class="card"><h2>Как у нас работает кайдзен</h2>
      <ol><li><b>Маленький шаг сегодня</b> лучше идеального плана завтра.</li><li><b>Ищем причину, а не виноватого</b> — улучшаем процесс, а не ругаем людей.</li><li><b>Сначала то, что без денег</b>: порядок, шаблоны, договорённости.</li><li><b>Ответ — за неделю</b>: каждую идею рассматривают и объясняют решение автору.</li><li><b>Эффект измеряем</b>: часы, рубли, качество, отзывы клиенток.</li></ol>
      <p class="note">Цикл улучшения: планируем → делаем → проверяем результат → закрепляем как стандарт (или пробуем иначе).</p></div>
    <div class="card"><h2>Путь идеи и премии</h2>
      <ol><li>Подали идею — команда поддерживает голосом и задаёт вопросы.</li><li>Основатель, руководитель или финансы за неделю отвечают: внедряем, откладываем или нет — с объяснением.</li><li>Внедряем — ставим задачу; если нужны деньги — заявка на финансирование прямо из идеи.</li><li>Через 1–3 месяца финансы записывают подтверждённый эффект.</li><li>Автор получает премию:</li></ol>
      <ul><li>внедрённое улучшение (кайдзен) — <b>${money(c.kaizenBonus)}</b>;</li><li>прибыль или экономия — <b>${pct(c.ideaPct)}</b> от эффекта за первые ${c.ideaMonths} ${plural(c.ideaMonths, 'месяц', 'месяца', 'месяцев')}, выплата раз в квартал;</li><li>новое направление или продукт с эффектом от ${money(c.shareFrom)} в год — доля в прибыли или опцион по решению акционеров.</li></ul>
      ${Auth.can('settings.edit') ? `<div class="id-set"><span class="label">Размеры премий</span><div class="grid2">
        <label class="field"><span>Премия за кайдзен, ₽</span><input class="input num" id="isK" inputmode="numeric" value="${c.kaizenBonus}"></label>
        <label class="field"><span>Процент от эффекта</span><input class="input num" id="isP" inputmode="decimal" value="${fmt(c.ideaPct * 100, 1).replace(',0', '')}"></label>
        <label class="field"><span>Месяцев эффекта</span><input class="input num" id="isM" inputmode="numeric" value="${c.ideaMonths}"></label>
        <label class="field"><span>Доля или опцион — от эффекта в год, ₽</span><input class="input num" id="isS" inputmode="numeric" value="${c.shareFrom}"></label>
      </div><button class="btn sm primary" id="isSave">Сохранить</button></div>` : ''}</div>
  </div>`;
}
function wireIdeaSettings(root) {
  const b = $('#isSave', root);
  if (!b) return;
  b.onclick = () => {
    const n = (s, k = 1) => Math.max(0, (parseNum($(s, root).value) || 0) * k);
    saveSettings({ideas: {kaizenBonus: Math.round(n('#isK')) || IDEA_DEF.kaizenBonus, ideaPct: n('#isP', 0.01) || IDEA_DEF.ideaPct, ideaMonths: Math.round(n('#isM')) || IDEA_DEF.ideaMonths, shareFrom: Math.round(n('#isS')) || IDEA_DEF.shareFrom}});
    toast('Размеры премий сохранены');
  };
}

/* руководителям — о новых идеях; автору — о решении, премии и новых комментариях */
const IdeaNotify = {
  since: 0,
  wired: false,
  init() {
    if (this.wired) return;
    this.wired = true;
    this.since = Date.now() - 2000;
    Store.subscribe(c => { if (c === 'ideas') setTimeout(() => this.check(), 50); });
  },
  check() {
    if (!Auth.me()) return;
    const me = Tasks.meKey(), fresh = [];
    Ideas.all().forEach(i => {
      if (Ideas.desk() && i.by !== me && (i.at || 0) > this.since) fresh.push({i, t: i.at, text: `Новая идея: ${i.title} — ${whoFirst(i.by)}`});
      if (i.by !== me) return;
      if (i.statusBy !== me && (i.statusAt || 0) > this.since) fresh.push({i, t: i.statusAt, text: `Ваша идея «${i.title}»: ${IDEA_ST[Ideas.status(i)].name.toLowerCase()}`});
      if (i.reward && i.reward.by !== me && (i.reward.at || 0) > this.since) fresh.push({i, t: i.reward.at, text: `Премия за идею «${i.title}»: ${i.reward.kind === 'share' ? 'доля или опцион' : money(Number(i.reward.amount) || 0)}`});
      Ideas.comments(i).forEach(x => { if (x.by !== me && x.kind !== 'status' && (x.at || 0) > this.since) fresh.push({i, t: x.at, text: `${whoFirst(x.by)} написал(а) об идее «${i.title}»`}); });
    });
    if (!fresh.length) return;
    this.since = Math.max(this.since, ...fresh.map(f => f.t));
    Sound.play('info');
    fresh.slice(-3).forEach(f => toast(f.text, {action: {label: 'Открыть', fn: () => openIdea(f.i.id)}}));
  },
};
