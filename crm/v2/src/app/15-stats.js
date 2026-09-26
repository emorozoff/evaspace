/* Статистика для трёх ролей и ответы анкеты:
   • Процесс — команде и руководителю: воронка каждой группы с конверсией
     шага, сколько дней уходит на шаг, динамика по неделям, кто сколько сделал;
   • Продукт — основателю: что болит, что хотят, спрос на форматы против
     того, что могут снять эксперты, цена против 2 900 ₽, боли по этапам
     жизни, метки с цитатами, идеи из интервью и сводка от Claude;
   • Маркетинг — маркетологу: портрет клиентки, откуда приходят, когда
     удобно, слова клиенток, сегменты, рефералы и охват, что дают партнёры,
     заходы для рекламы от Claude;
   • Ответы — графики по каждому вопросу анкеты с фильтром по сегменту.
   Подписи без смайлов — так цифры читаются с первого взгляда. */

const ST_TABS = [['process', 'Процесс'], ['product', 'Продукт'], ['marketing', 'Маркетинг'], ['answers', 'Ответы анкеты']];
const PRICE_NOW = 2900;
/* клиентский формат ↔ что может снять эксперт */
const FORMAT_MAP = [
  ['Короткие практики', 'Короткие практики'], ['Мастер-классы экспертов', 'Мастер-класс'], ['Курсы', 'Курс'],
  ['Живые эфиры', 'Эфир'], ['Офлайн-встречи', 'Офлайн'],
];
const Syn = {};   // сводки Claude по ключу — только в этом окне

App.register('stats', {
  title: 'Статистика',
  render(root) {
    const tab = ST_TABS.some(([k]) => k === View.get('st.tab', 'process')) ? View.get('st.tab', 'process') : 'process';
    const body = tab === 'product' ? productView() : tab === 'marketing' ? marketingView() : tab === 'answers' ? answersStatsView() : processView();
    const sub = {
      process: 'Как идут три шага: где люди застревают, сколько дней уходит на шаг, кто сколько сделал.',
      product: 'Что улучшить в Еве: боли, желания, форматы, цена и идеи прямо из интервью.',
      marketing: 'Кому и как рассказывать о Еве: портрет, каналы, время, слова клиенток, рефералы.',
      answers: 'Графики по каждому вопросу анкеты. Всё считается само, когда приходят ответы.',
    }[tab];
    root.innerHTML = `
      ${pageHead('Статистика', sub)}
      ${tabsHtml('st.tab', ST_TABS, tab)}
      ${body}`;
    wireTabs(root);
    on(root, 'click', '[data-seg]', (e, el) => { View.set('st.seg', el.dataset.seg); App.render(); });
    on(root, 'click', '[data-syn]', async (e, el) => {
      const key = el.dataset.syn;
      Syn[key] = {loading: true};
      App.render();
      try { Syn[key] = {data: await synthesize(key)}; }
      catch (err) { Syn[key] = {err: CLAUDE_ERR[err && err.code] || 'Claude не ответил: ' + ((err && err.message) || 'попробуйте ещё раз')}; }
      App.render();
    });
    on(root, 'click', '[data-syn-copy]', (e, el) => copyOrShow(synText(el.dataset.synCopy), 'Скопировано — можно вставить задачей в штаб 📋'));
  },
});

/* ── общие кусочки ── */
const kpiRow = (items, cls = 'kpis-4') => `<div class="kpis ${cls} card">${items.map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('')}</div>`;
const card = (title, note, inner, cls = '') => `<div class="card ${cls}"><div class="card-head"><h2>${title}</h2>${note ? `<span class="note">${note}</span>` : ''}</div>${inner}</div>`;
const answered = type => People.all(type).filter(p => Object.keys(p.answers || {}).length);
function aggOf(type, id, list) { return Stats.agg(type, list).find(a => a.q.id === id && a.n) || null; }
function topShare(a) { const t = a && Stats.top(a); return t ? {name: noEmo(t.name), share: t.v / a.n, v: t.v, n: a.n} : null; }
const bars = (a, color, max = 8) => (a ? hbarList(a.rows.slice().sort((x, y) => (a.q.k === 'many' ? y.v - x.v : 0)).filter(r => r.v || a.q.k !== 'many').slice(0, max).map(r => ({name: noEmo(r.name), v: r.v})), {color, sub: r => pct(r.v / a.n)}) : '<p class="note">Пока нет ответов.</p>');
const avgDays = pairs => { const d = pairs.filter(([a, b]) => a && b && b >= a).map(([a, b]) => (b - a) / 864e5); return d.length ? d.reduce((x, y) => x + y, 0) / d.length : null; };
const daysTxt = v => (v === null ? '—' : v < 1 ? 'меньше дня' : `${fmt(v, v < 10 ? 1 : 0)} ${plural(Math.round(v), 'день', 'дня', 'дней')}`);

/* ── Процесс ── */
function processView() {
  const all = Store.all('people');
  const stages = type => {
    const L = People.all(type);
    return [
      ['Добавлены', L.length],
      ['Ссылка отправлена', L.filter(p => (p.s1 || 'new') !== 'new').length],
      ['Анкета заполнена', L.filter(p => p.s1 === 'done').length],
      [type === 'client' ? 'Интервью назначено' : 'Созвон назначен', L.filter(p => hasCall(p) || ['done', 'skip'].includes(p.s2)).length],
      [type === 'client' ? 'Интервью прошло' : 'Созвон прошёл', L.filter(p => p.s2 === 'done').length],
      [type === 'client' ? 'Инсайты собраны' : 'Подключаем', L.filter(People.connected).length],
    ];
  };
  const funnelHtml = type => {
    const st = stages(type);
    const max = Math.max(1, st[0][1]);
    return `<div class="pf">${st.map(([name, v], i) => {
      const conv = i && st[i - 1][1] ? v / st[i - 1][1] : null;
      return `<div class="pf-r"><span class="pf-n">${name}</span><span class="pf-t"><i style="width:${(v / max * 100).toFixed(1)}%"></i></span><b>${v}</b><small class="${conv !== null && conv < .5 ? 'bad' : ''}">${conv === null ? '' : pct(conv)}</small></div>`;
    }).join('')}</div>`;
  };
  const sentToAns = avgDays(all.map(p => [p.sentAt, p.answeredAt]));
  const ansToCall = avgDays(all.filter(p => p.callAt).map(p => [p.answeredAt, p.callAt]));
  /* отвечают на анкету: заполнили сами / (заполнили сами + ещё ждём) */
  const selfDone = all.filter(p => p.s1 === 'done' && p.answeredBy === 'self').length, waiting = all.filter(p => p.s1 === 'sent').length;
  const respRate = selfDone + waiting ? selfDone / (selfDone + waiting) : null;
  const closed = all.filter(p => ['done', 'noshow'].includes(p.s2));
  const showRate = closed.length ? closed.filter(p => p.s2 === 'done').length / closed.length : null;
  const stuck = all.filter(p => p.s1 === 'sent' && p.sentAt && Date.now() - p.sentAt > 3 * 864e5);
  /* по неделям: добавили, анкеты, созвоны */
  const w0 = weekStart(today());
  const weeks = Array.from({length: 6}, (_, i) => addDays(w0, (i - 5) * 7));
  const inWeek = (ts, w) => ts && ts >= dateOf(w).getTime() && ts < dateOf(addDays(w, 7)).getTime();
  const wk = weeks.map(w => ({w, added: all.filter(p => inWeek(p.createdAt, w)).length, ans: all.filter(p => inWeek(p.answeredAt, w)).length, calls: all.filter(p => p.s2 === 'done' && inWeek(p.callAt, w)).length}));
  const wmax = Math.max(1, ...wk.flatMap(x => [x.added, x.ans, x.calls]));
  const team = Team.all().map(m => { const L = all.filter(p => p.owner === m.id); return {m, n: L.length, calls: L.filter(p => p.s2 === 'done').length, res: L.filter(p => (p.s3 || 'none') !== 'none').length}; }).filter(x => x.n);
  return `
    ${kpiRow([[respRate === null ? '—' : pct(respRate), 'отвечают на анкету'], [daysTxt(sentToAns), 'от ссылки до ответов'], [daysTxt(ansToCall), 'от анкеты до созвона'], [showRate === null ? '—' : pct(showRate), 'доходят до созвона']])}
    ${stuck.length ? `<div class="warnline" style="margin-top:12px">${stuck.length} ${plural(stuck.length, 'человек молчит', 'человека молчат', 'человек молчат')} больше трёх дней после ссылки: ${esc(stuck.slice(0, 4).map(People.name).join(', '))}${stuck.length > 4 ? '…' : ''}. Напомните одним сообщением.</div>` : ''}
    <div class="two section">${Object.keys(TYPES).map(k => card(`${TYPES[k].emo} ${groupName(k)}`, 'сколько дошло до шага · доля от прошлого', funnelHtml(k))).join('')}</div>
    <div class="two section">
      ${card('По неделям', 'последние 6 недель', `<div class="wk">${wk.map(x => `<div class="wk-c"><div class="wk-b">${[['added', 'var(--ink-3)'], ['ans', 'var(--link)'], ['calls', 'var(--good)']].map(([k, c]) => `<i style="height:${(x[k] / wmax * 100).toFixed(0)}%;background:${c}" title="${x[k]}"></i>`).join('')}</div><small>${dayShort(x.w)}</small></div>`).join('')}</div>
        <div class="cal-legend" style="margin:8px 0 0"><span><i class="cb-dot" style="background:var(--ink-3)"></i>добавили</span><span><i class="cb-dot" style="background:var(--link)"></i>анкет</span><span><i class="cb-dot" style="background:var(--good)"></i>созвонов прошло</span></div>`)}
      ${card('Кто сколько сделал', 'людей · созвонов · итогов', team.length ? `<div class="tm-list">${team.map(x => `<div class="tm-r">${Team.av(x.m)}<b>${esc(Team.name(x.m))}</b><span>${x.n}</span><span>${x.calls}</span><span>${x.res}</span></div>`).join('')}</div>` : '<p class="note">Назначьте ведущих в карточках — здесь появится вклад каждого.</p>')}
    </div>`;
}

/* ── Продукт ── */
function productView() {
  const seg = View.get('st.seg', '');
  const qs = Questions.set('client').test;
  const stageQ = qs.find(q => q.id === 'stage');
  const base = answered('client');
  const list = seg ? base.filter(p => (p.answers || {}).stage === seg) : base;
  const n = list.length;
  const pain = aggOf('client', 'pain', list), goal = aggOf('client', 'goal', list), formats = aggOf('client', 'formats', list);
  const time = aggOf('client', 'time', list), price = aggOf('client', 'price', list), fit = aggOf('client', 'fit', list);
  const priceHi = price ? price.rows.filter(r => /1 500–3 000|Больше 3 000/.test(r.name)).reduce((a, r) => a + r.v, 0) / price.n : null;
  const tp = topShare(pain);
  /* спрос клиенток на форматы против того, что эксперты готовы снять */
  const ex = answered('expert');
  const demand = FORMAT_MAP.map(([c, e]) => {
    const want = formats ? (formats.rows.find(r => noEmo(r.name).startsWith(c)) || {v: 0}).v / formats.n : 0;
    const can = ex.length ? ex.filter(p => [].concat((p.answers || {}).record || []).some(x => noEmo(x).startsWith(e))).length / ex.length : 0;
    return {c, want, can, gap: want - can};
  });
  /* боли по этапам жизни */
  const stages = stageQ ? stageQ.o.filter(o => base.some(p => p.answers.stage === o)) : [];
  const painQ = qs.find(q => q.id === 'pain');
  const cross = painQ ? painQ.o.map(o => ({o, cells: stages.map(s => { const L = base.filter(p => p.answers.stage === s); return {s, v: L.filter(p => [].concat(p.answers.pain || []).includes(o)).length, n: L.length}; })})) : [];
  /* метки из интервью с цитатами */
  const tags = Stats.insightTags();
  const clients = People.all('client');
  const tagQuote = t => { for (const p of clients.filter(x => ((x.res || {}).tags || []).includes(t))) { const s = Object.values(p.talk || {}).find(x => x && x.star && x.a); if (s) return {p, text: s.a}; } return null; };
  const ideas = clients.filter(p => (p.res || {}).idea || (p.res || {}).main).map(p => ({p, main: p.res.main, idea: p.res.idea}));
  const about = clients.map(p => ({p, a: ((p.talk || {}).t9 || {}).a})).filter(x => x.a);
  const recs = recommendations().filter(r => r.kind === 'idea').slice(0, 6);
  return `
    ${segChips(stages, seg, base.length)}
    ${kpiRow([[n, n === base.length ? 'анкет клиенток' : 'анкет в сегменте'], [tp ? pct(tp.share) : '—', tp ? `главная боль: ${esc(tp.name.toLowerCase())}` : 'главная боль'],
      [priceHi === null ? '—' : pct(priceHi), `готовы платить от 1 500 ₽ (сейчас ${fmt(PRICE_NOW)} ₽)`], [fit && fit.avg !== null ? `${fmt(fit.avg, 1)} из 5` : '—', 'откликается идея Евы']])}
    ${synBox('product', 'Что улучшить в продукте', 'Claude соберёт 5 главных улучшений с доказательствами из ответов и интервью — готово, чтобы поставить задачами в штабе.')}
    <div class="two section">
      ${card('Что болит', `${pain ? pain.n : 0} ответов`, bars(pain, 'var(--link)'))}
      ${card('Что важно', `${goal ? goal.n : 0} ответов`, bars(goal, 'var(--violet)'))}
      ${card('Спрос на форматы и что могут эксперты', 'доля клиенток, которые хотят · доля экспертов, которые снимут', `<div class="dm">${demand.map(d => `<div class="dm-r"><b>${esc(d.c)}</b>
          <span class="dm-t"><i class="want" style="width:${(d.want * 100).toFixed(0)}%"></i></span><small>${pct(d.want)}</small>
          <span class="dm-t"><i class="can" style="width:${(d.can * 100).toFixed(0)}%"></i></span><small>${pct(d.can)}</small>
          ${d.gap > .15 ? '<em class="st warn">не хватает</em>' : d.gap < -.2 ? '<em class="st">с запасом</em>' : '<em></em>'}</div>`).join('')}</div>
        <div class="cal-legend" style="margin:8px 0 0"><span><i class="cb-dot" style="background:var(--link)"></i>хотят клиентки</span><span><i class="cb-dot" style="background:var(--violet)"></i>готовы снять эксперты</span></div>`)}
      ${card('Время и цена', `подписка сейчас ${fmt(PRICE_NOW)} ₽`, `${bars(time, 'var(--good)')}<div style="height:12px"></div>${bars(price, 'var(--gold)')}`)}
    </div>
    ${cross.length && stages.length > 1 ? `<section class="section card"><div class="card-head"><h2>Боли по этапам жизни</h2><span class="note">сколько человек в сегменте отметили боль · темнее — чаще</span></div>
      <div class="xt-wrap"><table class="xt"><thead><tr><th></th>${stages.map(s => `<th>${esc(noEmo(s))}<small>${base.filter(p => p.answers.stage === s).length}</small></th>`).join('')}</tr></thead>
      <tbody>${cross.map(r => `<tr><td>${esc(noEmo(r.o))}</td>${r.cells.map(c => { const sh = c.n ? c.v / c.n : 0; return `<td style="background:color-mix(in srgb, var(--link) ${(sh * 70).toFixed(0)}%, var(--surface));color:${sh > .5 ? '#fff' : 'inherit'}">${c.v ? `${c.v}<small>${pct(sh)}</small>` : '·'}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div></section>` : ''}
    <div class="two section">
      ${card('Что слышим на интервью', 'метки из разбора и пример цитаты', tags.length ? `<div class="tq-list">${tags.map(t => { const q = tagQuote(t.name); return `<div class="tqr"><div class="tqr-h"><b>${esc(noEmo(t.name))}</b><span>${t.v}</span></div>${q ? `<p>«${esc(q.text.length > 150 ? q.text.slice(0, 150) + '…' : q.text)}» <a href="#p-${q.p.id}">${esc(People.name(q.p))}</a></p>` : ''}</div>`; }).join('')}</div>` : '<p class="note">Метки появятся, когда разберёте первые интервью.</p>')}
      ${card('Идеи из интервью', `${ideas.length} ${plural(ideas.length, 'интервью', 'интервью', 'интервью')}`, ideas.length ? `<div class="idea-list">${ideas.map(x => `<a class="idea" href="#p-${x.p.id}">${x.main ? `<b>${esc(x.main)}</b>` : ''}${x.idea ? `<span>${esc(x.idea)}</span>` : ''}<small>${esc(People.name(x.p))}</small></a>`).join('')}</div>` : '<p class="note">В итоге интервью заполняйте «Главный инсайт» и «Что улучшить в Еве» — они соберутся здесь.</p>')}
      ${card('Что говорят про Еву', 'ответы на вопрос о приложении', about.length ? `<div class="stack">${about.slice(0, 6).map(x => `<div class="quote">«${esc(x.a)}»<small><a href="#p-${x.p.id}">${esc(People.name(x.p))}</a></small></div>`).join('')}</div>` : '<p class="note">Пока нет ответов.</p>')}
      ${card('Рекомендации по ответам', '', recs.length ? `<div class="recs">${recs.map(r => `<a class="rec" href="#${r.href}"><b>${esc(r.text)}</b><small><span class="rec-g">${r.type === 'all' ? 'Все группы' : groupName(r.type)}</span>${esc(r.why)}</small></a>`).join('')}</div>` : '<p class="note">Появятся, когда придут первые анкеты.</p>')}
    </div>`;
}

/* ── Маркетинг ── */
function marketingView() {
  const base = answered('client');
  const n = base.length;
  const mode = id => topShare(aggOf('client', id, base));
  const persona = [['Возраст', mode('age')], ['Город', mode('city')], ['Этап жизни', mode('stage')], ['Болит', mode('pain')], ['Хочет', mode('goal')], ['Время в день', mode('time')], ['Когда удобно', mode('when')], ['Готова платить', mode('price')], ['Откуда узнаёт', mode('source')]].filter(x => x[1]);
  const quotes = Stats.quotes().filter(x => x.p.type === 'client').slice(0, 4);
  const source = aggOf('client', 'source', base), when = aggOf('client', 'when', base), tried = aggOf('client', 'tried', base);
  const ambs = People.all('amb');
  const reach = sum(ambs, p => REACH[(p.answers || {}).size] || 0);
  const platforms = {};
  ambs.forEach(p => ((p.answers || {}).where || []).forEach(w => { platforms[w] = (platforms[w] || 0) + 1; }));
  const refs = Store.all('people').map(p => ({p, n: People.invited(p).length})).filter(x => x.n).sort((a, b) => b.n - a.n);
  const invited = Store.all('people').filter(p => p.ref);
  const giveQ = aggOf('partner', 'give', answered('partner')), tellQ = aggOf('partner', 'tell', answered('partner'));
  const stageQ = Questions.set('client').test.find(q => q.id === 'stage');
  const segs = stageQ ? stageQ.o.map(o => { const L = base.filter(p => p.answers.stage === o); const g = topShare(aggOf('client', 'goal', L)), pn = topShare(aggOf('client', 'pain', L)); return {o, n: L.length, g, pn}; }).filter(x => x.n) : [];
  return `
    ${kpiRow([[n, 'анкет клиенток'], [`≈ ${fmt(reach)}`, 'охват амбассадоров'], [invited.length, 'пришли по ссылкам'], [People.all('partner').filter(People.connected).length, 'партнёров подключаем']])}
    ${synBox('marketing', 'Заходы для рекламы', 'Claude предложит 5 заходов для постов и рекламы на языке клиенток: кому, где и почему сработает.')}
    <div class="two section">
      ${card('Портрет клиентки', `самый частый ответ · по ${n} ${plural(n, 'анкете', 'анкетам', 'анкетам')}`, persona.length ? `<div class="persona">${persona.map(([k, x]) => `<div><span>${k}</span><b>${esc(x.name)}</b><small>${pct(x.share)}</small></div>`).join('')}</div>
        ${quotes.length ? `<div class="stack" style="margin-top:12px">${quotes.slice(0, 2).map(x => `<div class="quote">«${esc(x.text)}»<small><a href="#p-${x.p.id}">${esc(People.name(x.p))}</a></small></div>`).join('')}</div>` : ''}` : '<p class="note">Портрет появится с первыми анкетами.</p>')}
      ${card('Сегменты', 'сколько человек · что хотят · что болит', segs.length ? `<div class="segs">${segs.map(s => `<div><b>${esc(noEmo(s.o))}</b><span>${s.n}</span><small>${s.g ? 'хочет: ' + esc(s.g.name.toLowerCase()) : ''}${s.pn ? ' · болит: ' + esc(s.pn.name.toLowerCase()) : ''}</small></div>`).join('')}</div>` : '<p class="note">Пока нет данных.</p>')}
      ${card('Откуда узнают', 'клиентки', bars(source, 'var(--link)'))}
      ${card('Когда удобно', 'время для пушей, постов и эфиров', bars(when, 'var(--gold)'))}
      ${card('Что уже пробовали', 'с чем сравнивают Еву', bars(tried, 'var(--violet)'))}
      ${card('Амбассадоры: где рассказывают', `охват ≈ ${fmt(reach)}`, Object.keys(platforms).length ? hbarList(Object.entries(platforms).map(([name, v]) => ({name: noEmo(name), v})).sort((a, b) => b.v - a.v), {color: 'var(--rose)'}) : '<p class="note">Пока нет анкет амбассадоров.</p>')}
      ${card('Кто приводит людей', 'по единой ссылке', refs.length ? `<div class="tm-list">${refs.slice(0, 8).map(x => `<a class="tm-r" href="#p-${x.p.id}">${avatar(People.name(x.p))}<b>${esc(People.name(x.p))}</b><small>${groupName(x.p.type)}</small><span>${x.n}</span></a>`).join('')}</div>` : '<p class="note">Когда по ссылке придут первые люди, здесь будет видно, кто их привёл.</p>')}
      ${card('Что дают партнёры', 'для совместных акций', giveQ ? `${bars(giveQ, 'var(--good)')}<div style="height:12px"></div>${bars(tellQ, 'var(--good)')}` : '<p class="note">Пока нет анкет партнёров.</p>')}
    </div>`;
}

/* ── Ответы анкеты по группам (как было) с фильтром по сегменту ── */
function answersStatsView() {
  const type = TYPES[View.get('st.type', 'client')] ? View.get('st.type', 'client') : 'client';
  const seg = type === 'client' ? View.get('st.seg', '') : '';
  const stageQ = Questions.set('client').test.find(q => q.id === 'stage');
  const base = People.all(type);
  const list = seg ? base.filter(p => (p.answers || {}).stage === seg) : base;
  const f = Stats.funnel(type);
  const agg = Stats.agg(type, list).filter(a => a.n);
  const nAns = list.filter(p => Object.keys(p.answers || {}).length).length;
  let extra = '';
  if (type === 'expert') {
    const cov = Stats.dirCoverage();
    extra = `<section class="section card"><div class="card-head"><h2>14 направлений</h2><span class="note">закрыто ${cov.filter(x => x.n).length} из ${cov.length} · розовые — экспертов пока нет</span></div>
      <div class="coverage">${cov.map(x => `<div class="cov ${x.n ? '' : 'zero'}"><b>${esc(noEmo(x.d))}</b>${x.n ? `<small>${x.n} ${plural(x.n, 'эксперт', 'эксперта', 'экспертов')}</small>${x.yes ? `<small>подключаем: ${x.yes}</small>` : ''}${x.course ? `<small>хотят курс: ${x.course}</small>` : ''}` : '<small>ищем</small>'}</div>`).join('')}</div></section>`;
  } else if (type === 'partner') {
    const cats = Stats.catCoverage().filter(x => x.n);
    extra = `<section class="section card"><div class="card-head"><h2>Партнёры по категориям</h2><span class="note">${cats.length} из ${PARTNER_CATS.length} категорий</span></div>
      ${cats.length ? hbarList(cats.map(x => ({name: noEmo(x.c), v: x.n, yes: x.yes})), {color: 'var(--good)', sub: r => (r.yes ? `подключаем ${r.yes}` : '')}) : '<p class="note">Пока нет партнёров.</p>'}</section>`;
  }
  return `
    <div class="st-sub">${Object.keys(TYPES).map(k => `<button class="chip ${k === type ? 'on' : ''}" data-tab-key="st.type" data-tab="${k}">${groupName(k)}<span class="chip-n">${People.all(k).length}</span></button>`).join('')}</div>
    ${type === 'client' && stageQ ? segChips(stageQ.o.filter(o => base.some(p => (p.answers || {}).stage === o)), seg, f.answered) : ''}
    ${kpiRow([[f.all, 'в базе'], [nAns, seg ? 'анкет в сегменте' : 'анкет заполнено'], [base.filter(p => p.s2 === 'done').length, type === 'client' ? 'интервью проведено' : 'созвонов проведено'], [f.yes, type === 'client' ? 'интервью разобрано' : 'подключаем']])}
    ${extra}
    <section class="section"><div class="section-head"><h2>Ответы анкеты</h2><span class="hint-inline">по ${nAns} ${plural(nAns, 'анкете', 'анкетам', 'анкетам')} · где можно выбрать несколько, сумма больше 100%</span></div>
      ${agg.length ? `<div class="qstats">${agg.map(qStatCard).join('')}</div>` : '<p class="note">Графики появятся, когда придут первые анкеты.</p>'}</section>`;
}

/* фильтр по этапу жизни: «Все · Мама малыша · Карьера …» */
function segChips(opts, cur, total) {
  if (!opts.length) return '';
  return `<div class="chip-row st-seg"><span class="note">Сегмент:</span><button class="chip ${!cur ? 'on' : ''}" data-seg="">Все<span class="chip-n">${total}</span></button>${opts.map(o => `<button class="chip ${cur === o ? 'on' : ''}" data-seg="${esc(o)}">${esc(noEmo(o))}<span class="chip-n">${answered('client').filter(p => p.answers.stage === o).length}</span></button>`).join('')}</div>`;
}

/* один вопрос анкеты: вариант — полоса — сколько человек — доля.
   Один ответ (возраст, цена, время) — в порядке вариантов, чтобы шкала
   читалась слева направо; несколько ответов — от частых к редким. */
function qStatCard(a) {
  const colors = ['var(--link)', 'var(--violet)', 'var(--good)', 'var(--gold)'];
  const color = colors[hashStr(a.q.id) % colors.length];
  const rows = a.q.k === 'many' ? a.rows.slice().sort((x, y) => y.v - x.v) : a.rows;
  return `<div class="card qstat"><div class="qstat-h"><h3>${esc(noEmo(a.q.t))}</h3><span>${a.n} ${plural(a.n, 'ответ', 'ответа', 'ответов')}${a.q.k === 'many' ? ' · несколько' : ''}</span></div>
    ${a.q.k === 'scale' && a.avg !== null ? `<p class="qstat-avg">В среднем <b>${fmt(a.avg, 1)}</b> из 5</p>` : ''}
    ${hbarList(rows.map(r => ({name: noEmo(r.name), v: r.v})), {color, sub: r => (a.n ? pct(r.v / a.n) : '')})}</div>`;
}

/* ── сводки Claude для основателя и маркетолога ── */
function synBox(key, title, lead) {
  const s = Syn[key];
  const canAsk = People.canEdit();
  const head = `<div class="ai-h"><span class="ai-mark">${brandMark()}</span><div><b>${title} — сводка от Claude</b><span class="note">${lead}</span></div><span class="sp"></span>
    ${canAsk ? `<button class="btn sm ${s && s.data ? '' : 'primary'}" data-syn="${key}" ${s && s.loading ? 'disabled' : ''}>${s && s.loading ? 'Claude думает…' : s && s.data ? 'Обновить' : 'Собрать сводку'}</button>` : ''}
    ${s && s.data ? `<button class="btn sm ghost" data-syn-copy="${key}">${icon('copy')}Скопировать</button>` : ''}</div>`;
  if (!s || (!s.data && !s.err)) return `<div class="ai-box section">${head}</div>`;
  if (s.err) return `<div class="ai-box section">${head}<p class="warnline" style="margin-top:10px">${esc(s.err)}</p></div>`;
  const items = s.data.items || [];
  return `<div class="ai-box section">${head}<ol class="syn">${items.map(it => `<li><b>${esc(it.title || '')}</b>${it.evidence ? `<span>${esc(it.evidence)}</span>` : ''}${it.action ? `<em>${esc(it.action)}</em>` : ''}</li>`).join('')}</ol></div>`;
}
function synText(key) {
  const s = Syn[key];
  return ((s && s.data && s.data.items) || []).map((it, i) => `${i + 1}. ${it.title}\n   ${it.evidence || ''}\n   → ${it.action || ''}`).join('\n\n');
}
/* что отдаём Claude: только сводные цифры, метки, инсайты и цитаты — без контактов */
function statsDigest() {
  const base = answered('client');
  const line = (label, id) => { const a = aggOf('client', id, base); return a ? `${label}: ${a.rows.slice().sort((x, y) => y.v - x.v).filter(r => r.v).map(r => `${noEmo(r.name)} — ${r.v} из ${a.n}`).join('; ')}` : ''; };
  const tags = Stats.insightTags().map(t => `${noEmo(t.name)} — ${t.v}`).join('; ');
  const ideas = People.all('client').map(p => [(p.res || {}).main, (p.res || {}).idea].filter(Boolean).join(' / ')).filter(Boolean).map(x => '- ' + x).join('\n');
  const quotes = Stats.quotes().filter(x => x.p.type === 'client').slice(0, 10).map(x => `- «${x.text}»`).join('\n');
  const about = People.all('client').map(p => ((p.talk || {}).t9 || {}).a).filter(Boolean).map(x => '- ' + x).join('\n');
  const ex = answered('expert');
  const rec = ex.length ? `Эксперты готовы снять (из ${ex.length}): ` + FORMAT_MAP.map(([, e]) => `${e} — ${ex.filter(p => [].concat((p.answers || {}).record || []).some(x => noEmo(x).startsWith(e))).length}`).join('; ') : '';
  const cov = Stats.dirCoverage().filter(x => !x.n).map(x => noEmo(x.d)).join(', ');
  const amb = People.all('amb');
  return [`Анкет клиенток: ${base.length}.`, line('Возраст', 'age'), line('Этап жизни', 'stage'), line('Болит', 'pain'), line('Важно', 'goal'), line('Время в день', 'time'), line('Когда удобно', 'when'),
    line('Пробовали', 'tried'), line('Интересно в Еве', 'formats'), line('Готовы платить в месяц', 'price'), line('Откуда узнали', 'source'),
    tags ? `Метки из интервью: ${tags}` : '', ideas ? `Инсайты и идеи из интервью:\n${ideas}` : '', quotes ? `Яркие цитаты:\n${quotes}` : '', about ? `Что говорят про приложение:\n${about}` : '',
    rec, cov ? `Направления без экспертов: ${cov}` : '', amb.length ? `Амбассадоров: ${amb.length}, охват около ${fmt(sum(amb, p => REACH[(p.answers || {}).size] || 0))}` : ''].filter(Boolean).join('\n');
}
async function synthesize(key) {
  let sample = null;
  try { sample = window.claude && typeof window.claude.use === 'function' ? await window.claude.use('sample') : null; } catch (e) { sample = null; }
  if (!sample) throw {code: 'unavailable'};
  const about = 'Eva Space — приложение для женщин 25–45: программа коротких практик под этап жизни, проверенные эксперты, мастер-классы и курсы, сообщество, ИИ-помощница Ева. Подписка 2 900 ₽ в месяц.';
  const task = key === 'product'
    ? 'Ты — продуктовый аналитик. По данным кастдева назови 5 главных улучшений продукта, от самого важного. Для каждого: что сделать, на каких данных это основано (цифры или цитата), первый шаг на эту неделю.'
    : 'Ты — маркетолог. По данным кастдева предложи 5 заходов для постов и рекламы на языке клиенток. Для каждого: заход (заголовок как в посте), кому он (сегмент) и почему сработает (цифры или цитата), где запускать (канал из данных).';
  const shape = key === 'product'
    ? '{"items": [{"title": "что улучшить, до 90 знаков", "evidence": "на чём основано, до 160 знаков", "action": "первый шаг, до 120 знаков"}]}'
    : '{"items": [{"title": "заход — как заголовок поста, до 90 знаков", "evidence": "кому и почему сработает, до 160 знаков", "action": "где и как запустить, до 120 знаков"}]}';
  const input = `${about}\n${task}\nОпирайся только на данные ниже, ничего не выдумывай. Пиши по-русски, коротко, без канцелярита.\n\nДанные:\n${statsDigest()}\n\nВерни только JSON такого вида: ${shape}`;
  const out = await sample.json(input, {modelTier: 'default'});
  return {items: (Array.isArray(out.items) ? out.items : []).slice(0, 5)};
}
