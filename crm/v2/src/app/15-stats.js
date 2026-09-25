/* Статистика по группам: главные цифры, что слышим на интервью, покрытие
   14 направлений экспертами, партнёры по категориям, охват амбассадоров и
   графики по каждому вопросу анкеты. Подписи без смайлов — так цифры
   читаются с первого взгляда. */

App.register('stats', {
  title: 'Статистика',
  render(root) {
    const type = TYPES[View.get('st.type', 'client')] ? View.get('st.type', 'client') : 'client';
    const L = People.all(type);
    const f = Stats.funnel(type);
    const talks = L.filter(p => p.s2 === 'done').length;
    const agg = Stats.agg(type).filter(a => a.n);
    const kpis = [[f.all, 'в базе'], [f.answered, plural(f.answered, 'анкета заполнена', 'анкеты заполнены', 'анкет заполнено')],
      [talks, type === 'client' ? 'интервью проведено' : plural(talks, 'созвон проведён', 'созвона проведено', 'созвонов проведено')],
      [f.yes, type === 'client' ? 'интервью разобрано' : 'подключаем']];

    let extra = '';
    if (type === 'client') {
      const tags = Stats.insightTags();
      const quotes = Stats.quotes().filter(x => x.p.type === 'client').slice(0, 8);
      extra = `<div class="two section">
        <div class="card"><div class="card-head"><h2>Что слышим на интервью</h2><span class="note">метки из разбора</span></div>
          ${tags.length ? hbarList(tags.map(t => ({name: noEmo(t.name), v: t.v})), {color: 'var(--violet)'}) : '<p class="note">Метки появятся, когда разберёте первые интервью.</p>'}</div>
        <div class="card"><div class="card-head"><h2>Цитаты</h2><span class="note">отмечены звёздочкой на созвоне</span></div>
          ${quotes.length ? `<div class="stack">${quotes.map(x => `<div class="quote">«${esc(x.text.length > 220 ? x.text.slice(0, 220) + '…' : x.text)}»<small><a href="#p-${x.p.id}">${esc(People.name(x.p))}</a></small></div>`).join('')}</div>` : '<p class="note">Во время интервью нажимайте звёздочку у яркого ответа — он появится здесь.</p>'}</div>
      </div>`;
    } else if (type === 'expert') {
      const cov = Stats.dirCoverage();
      const closed = cov.filter(x => x.n).length;
      extra = `<section class="section card"><div class="card-head"><h2>14 направлений</h2><span class="note">закрыто ${closed} из ${cov.length} · розовые — экспертов пока нет</span></div>
        <div class="coverage">${cov.map(x => `<div class="cov ${x.n ? '' : 'zero'}"><b>${esc(noEmo(x.d))}</b>${x.n
          ? `<small>${x.n} ${plural(x.n, 'эксперт', 'эксперта', 'экспертов')}</small>${x.yes ? `<small>подключаем: ${x.yes}</small>` : ''}${x.course ? `<small>хотят курс: ${x.course}</small>` : ''}`
          : '<small>ищем</small>'}</div>`).join('')}</div></section>`;
    } else if (type === 'partner') {
      const cats = Stats.catCoverage().filter(x => x.n);
      extra = `<section class="section card"><div class="card-head"><h2>Партнёры по категориям</h2><span class="note">${cats.length} из ${PARTNER_CATS.length} категорий</span></div>
        ${cats.length ? hbarList(cats.map(x => ({name: noEmo(x.c), v: x.n, yes: x.yes})), {color: 'var(--good)', sub: r => (r.yes ? `подключаем ${r.yes}` : '')}) : '<p class="note">Пока нет партнёров.</p>'}</section>`;
    } else {
      const reach = sum(L, p => REACH[(p.answers || {}).size] || 0);
      const platforms = {};
      L.forEach(p => ((p.answers || {}).where || []).forEach(w => { platforms[w] = (platforms[w] || 0) + 1; }));
      const invited = sum(L, p => People.invited(p).length);
      extra = `<div class="two section">
        <div class="card"><div class="card-head"><h2>Охват</h2></div>
          <div class="kpis">${[[`≈ ${fmt(reach)}`, 'читают амбассадоров'], [invited, 'пришли по их ссылкам']].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('')}</div>
          <p class="note" style="margin-top:10px">Охват — сумма ответов «Сколько людей тебя читает», по середине диапазона.</p></div>
        <div class="card"><div class="card-head"><h2>Где рассказывают</h2></div>
          ${Object.keys(platforms).length ? hbarList(Object.entries(platforms).map(([name, v]) => ({name: noEmo(name), v})).sort((a, b) => b.v - a.v), {color: 'var(--rose)'}) : '<p class="note">Пока нет анкет амбассадоров.</p>'}</div>
      </div>`;
    }

    root.innerHTML = `
      ${pageHead('Статистика', 'Ответы из анкет и итоги созвонов. Всё считается само, когда приходят ответы.')}
      ${tabsHtml('st.type', Object.keys(TYPES).map(k => [k, groupName(k), People.all(k).length || null]), type)}
      <div class="kpis kpis-4 card">${kpis.map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('')}</div>
      ${extra}
      <section class="section"><div class="section-head"><h2>Ответы анкеты</h2><span class="hint-inline">по ${f.answered} ${plural(f.answered, 'анкете', 'анкетам', 'анкетам')} · где можно выбрать несколько, сумма больше 100%</span></div>
        ${agg.length ? `<div class="qstats">${agg.map(qStatCard).join('')}</div>` : '<p class="note">Графики появятся, когда придут первые анкеты.</p>'}</section>`;

    wireTabs(root);
  },
});

/* один вопрос анкеты: вариант — полоса — сколько человек — доля.
   Один ответ (возраст, цена, время) — в порядке вариантов, чтобы шкала
   читалась слева направо; несколько ответов — от частых к редким. */
function qStatCard(a) {
  const colors = ['var(--link)', 'var(--rose)', 'var(--good)', 'var(--gold)'];
  const color = colors[hashStr(a.q.id) % colors.length];
  const rows = a.q.k === 'many' ? a.rows.slice().sort((x, y) => y.v - x.v) : a.rows;
  return `<div class="card qstat"><div class="qstat-h"><h3>${esc(noEmo(a.q.t))}</h3><span>${a.n} ${plural(a.n, 'ответ', 'ответа', 'ответов')}${a.q.k === 'many' ? ' · несколько' : ''}</span></div>
    ${a.q.k === 'scale' && a.avg !== null ? `<p class="qstat-avg">В среднем <b>${fmt(a.avg, 1)}</b> из 5</p>` : ''}
    ${hbarList(rows.map(r => ({name: noEmo(r.name), v: r.v})), {color, sub: r => (a.n ? pct(r.v / a.n) : '')})}</div>`;
}
