/* Главная: что сделать сегодня, четыре группы по трём шагам, ключевые
   рекомендации, что говорят клиентки, покрытие 14 направлений экспертами,
   партнёры по категориям, охват амбассадоров и яркие цитаты. */

App.register('home', {
  title: 'Главная',
  render(root) {
    const all = Store.all('people');
    const now = Date.now();
    const toSend = all.filter(p => (p.s1 || 'new') === 'new');
    const waiting = all.filter(p => p.s1 === 'sent');
    const callsToday = all.filter(p => p.s2 === 'set' && p.callAt && isoTs(p.callAt) === today());
    const needCall = all.filter(p => p.s1 === 'done' && p.s2 === 'none');
    const decide = all.filter(p => People.col(p) === 3 && (p.s3 || 'none') === 'none');
    const recs = recommendations();
    const me = Who.member();
    const hour = new Date().getHours();
    const hello = hour < 5 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
    const clientAgg = Stats.agg('client');
    const pick = id => clientAgg.find(a => a.q.id === id && a.n);
    const keyQs = ['pain', 'goal', 'time', 'formats', 'price', 'when'].map(pick).filter(Boolean);
    const cov = Stats.dirCoverage();
    const cats = Stats.catCoverage().filter(x => x.n);
    const quotes = Stats.quotes().slice(0, 6);
    const tags = Stats.insightTags();
    const ambs = People.all('amb');
    const reach = sum(ambs, p => REACH[(p.answers || {}).size] || 0);
    const platforms = {};
    ambs.forEach(p => ((p.answers || {}).where || []).forEach(w => { platforms[w] = (platforms[w] || 0) + 1; }));
    const upcoming = all.filter(p => p.s2 === 'set' && p.callAt && p.callAt > now - 3600e3).sort((a, b) => a.callAt - b.callAt).slice(0, 5);

    root.innerHTML = `
      ${pageHead(`${hello}${me ? ', ' + esc(Team.first(me)) : ''} 👋`, `${cap(dayWd(today()))} · в базе ${all.length} ${plural(all.length, 'человек', 'человека', 'человек')}: клиентки, эксперты, партнёры и амбассадоры`,
        People.canEdit() ? `<button class="btn" data-paste>📥 Вставить ответы</button>` : '')}
      ${!all.length ? `<div class="welcome"><span class="e">🌱</span><div><b>Начнём?</b><p>Загрузите пример в «⚙️ Настройках», чтобы посмотреть, как всё работает, или добавьте первого человека в любом разделе.</p>
        <div class="how3"><div><b>1. 📝 Анкета</b>Ссылка → человек отвечает сам за 3 минуты</div><div><b>2. 📞 Созвон</b>20–30 минут в Zoom по готовым вопросам</div><div><b>3. 🚀 Итог</b>Инсайты или решение о сотрудничестве</div></div></div></div>` : ''}
      <div class="todo">
        <a class="todo-i ${toSend.length ? 'hot' : ''}" href="#${(toSend[0] || {}).type || 'client'}"><span class="big-emo">✉️</span><div><b>${toSend.length}</b><span>отправить ссылку на анкету${waiting.length ? ` · ⏳ ждём ответы от ${waiting.length}` : ''}</span></div></a>
        <a class="todo-i ${needCall.length ? 'hot' : ''}" href="#${(needCall[0] || {}).type || 'client'}"><span class="big-emo">📅</span><div><b>${needCall.length}</b><span>назначить созвон — анкета уже есть${callsToday.length ? ` · сегодня ${callsToday.length}` : ''}</span></div></a>
        <a class="todo-i ${decide.length ? 'hot' : ''}" href="#${(decide[0] || {}).type || 'expert'}"><span class="big-emo">🚀</span><div><b>${decide.length}</b><span>подвести итог после созвона</span></div></a>
      </div>
      <section class="section aud">${Object.entries(TYPES).map(([k, T]) => { const f = Stats.funnel(k); return `<a class="card aud-c as-link" href="#${k}">
          <div class="aud-h"><span class="e">${T.emo}</span><b>${k === 'client' ? 'Кастдев' : T.name}</b><span class="n">${f.all}</span></div>
          <div class="steps3"><div><b>${f.c1}</b>${T.steps[0]}</div><div><b>${f.c2}</b>${T.steps[1]}</div><div><b>${f.c3}</b>${T.steps[2]}</div></div>
          <div class="aud-f">${k === 'client' ? `💡 разобрано интервью: <b>${f.yes}</b>` : `🚀 подключаем: <b>${f.yes}</b>`} · 📝 анкет: <b>${f.answered}</b></div></a>`; }).join('')}</section>
      <div class="split section">
        <div class="card"><div class="card-head"><h2>💡 Ключевые рекомендации</h2><span class="note">из ответов и того, где люди застряли</span></div>
          ${recs.length ? `<div class="recs">${recs.slice(0, 8).map(r => `<a class="rec" href="#${r.href}"><span class="e">${r.emo}</span><div><b>${esc(r.text)}</b><small>${esc(r.why)}</small></div></a>`).join('')}</div>` : '<p class="note">Рекомендации появятся, когда придут первые анкеты (от трёх в группе).</p>'}
        </div>
        <div class="stack">
          <div class="card"><div class="card-head"><h2>📅 Ближайшие созвоны</h2></div>
            ${upcoming.length ? `<div class="recs">${upcoming.map(p => `<a class="rec" href="#p-${p.id}"><span class="e">${TYPES[p.type].emo}</span><div><b>${esc(People.name(p))}</b><small>${esc(when(p.callAt))}${p.zoom ? ' · Zoom' : ''}</small></div></a>`).join('')}</div>` : '<p class="note">Созвонов не назначено.</p>'}</div>
          <div class="card"><div class="card-head"><h2>⭐ Цитаты из интервью</h2></div>
            ${quotes.length ? `<div class="stack">${quotes.map(x => `<div class="quote">«${esc(x.text.length > 220 ? x.text.slice(0, 220) + '…' : x.text)}»<small><a href="#p-${x.p.id}">${TYPES[x.p.type].emo} ${esc(People.name(x.p))}</a></small></div>`).join('')}</div>` : '<p class="note">Отмечайте ⭐ яркие ответы в режиме созвона — они соберутся здесь.</p>'}</div>
        </div>
      </div>
      ${keyQs.length ? `<section class="section"><div class="section-head"><h2>🌸 Что говорят клиентки</h2><span class="hint-inline">${Stats.funnel('client').answered} ${plural(Stats.funnel('client').answered, 'анкета', 'анкеты', 'анкет')} · полная статистика — в «Кастдеве»</span></div>
        <div class="qstats">${keyQs.map(qStatCard).join('')}</div>
        ${tags.length ? `<div class="card" style="margin-top:12px"><div class="card-head"><h2>🏷 Метки из интервью</h2></div><div class="cloud">${tags.map(t => `<span>${esc(t.name)} <b>${t.v}</b></span>`).join('')}</div></div>` : ''}</section>` : ''}
      <section class="section card"><div class="card-head"><h2>🎓 14 направлений: кто есть</h2><span class="note">розовые — экспертов пока нет · 🎥 — хотят снять курс</span></div>
        <div class="coverage">${cov.map(x => `<div class="cov ${x.n ? '' : 'zero'}"><b>${esc(x.d)}</b><small>${x.n ? `${x.n} ${plural(x.n, 'эксперт', 'эксперта', 'экспертов')}${x.yes ? ` · 🚀 ${x.yes}` : ''}${x.course ? ` · 🎥 ${x.course}` : ''}` : 'ищем'}</small></div>`).join('')}</div></section>
      <div class="two section">
        <div class="card"><div class="card-head"><h2>🤝 Партнёры по категориям</h2></div>
          ${cats.length ? hbarList(cats.map(x => ({name: x.c, v: x.n})), {color: 'var(--good)', sub: r => { const c = cats.find(y => y.c === r.name); return c && c.yes ? `🚀 ${c.yes}` : ''; }}) : '<p class="note">Пока нет партнёров.</p>'}</div>
        <div class="card"><div class="card-head"><h2>📣 Амбассадоры</h2><span class="note">охват ≈ ${fmt(reach)}</span></div>
          ${Object.keys(platforms).length ? hbarList(Object.entries(platforms).map(([name, v]) => ({name, v})).sort((a, b) => b.v - a.v), {color: 'var(--rose)'}) : '<p class="note">Пока нет анкет амбассадоров.</p>'}
          ${ambs.length ? `<p class="note" style="margin-top:10px">По ссылкам амбассадоров пришли: <b>${sum(ambs, p => People.invited(p).length)}</b></p>` : ''}</div>
      </div>`;

    on(root, 'click', '[data-paste]', () => openPaste());
  },
});
