/* Главная — что сделать сегодня. Три плитки повторяют три шага общения
   (анкета → созвон → итог), ниже — четыре группы, рекомендации и ближайшие
   созвоны. Графики ответов живут в «Статистике», чтобы главная читалась
   за полминуты. */

App.register('home', {
  title: 'Главная',
  render(root) {
    const all = Store.all('people');
    const toSend = all.filter(p => (p.s1 || 'new') === 'new');
    const waiting = all.filter(p => p.s1 === 'sent');
    const needCall = all.filter(p => People.col(p) === 2 && ['none', 'noshow'].includes(p.s2 || 'none'));
    const callsSet = all.filter(p => People.col(p) === 2 && p.s2 === 'set');
    const callsToday = callsSet.filter(p => p.callAt && isoTs(p.callAt) === today());
    const decide = all.filter(p => People.col(p) === 3 && (p.s3 || 'none') === 'none');
    const recs = recommendations();
    const now = recs.filter(r => r.kind === 'now').slice(0, 4);
    const ideas = recs.filter(r => r.kind === 'idea').slice(0, 5);
    const me = Who.member();
    const first = me ? Team.first(me) : '';
    const hour = new Date().getHours();
    const hello = hour < 5 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
    const upcoming = callsSet.filter(p => p.callAt && p.callAt > Date.now() - 3600e3).sort((a, b) => a.callAt - b.callAt).slice(0, 5);
    const known = {answers: all.filter(p => p.s1 === 'done').length, talks: all.filter(p => p.s2 === 'done').length, quotes: Stats.quotes().length};

    const tile = (n, step, list, text, small) => `<a class="todo-i ${list.length ? 'hot' : ''}" href="#${topType(list)}">
        <span class="todo-step"><i>${n}</i>${step}</span><b>${list.length}</b><span class="todo-t">${text}</span><small>${small}</small></a>`;
    const rec = r => `<a class="rec" href="#${r.href}"><b>${esc(r.text)}</b><small><span class="rec-g">${r.type === 'all' ? 'Все группы' : groupName(r.type)}</span>${esc(r.why)}</small></a>`;

    root.innerHTML = `
      ${pageHead(`${hello}${first && first !== 'Вы' ? ', ' + esc(first) : ''} 👋`, `${cap(dayWd(today()))} · в базе ${all.length} ${plural(all.length, 'человек', 'человека', 'человек')}`,
        People.canEdit() ? `<button class="btn" data-paste>${icon('inbox')}Вставить ответы</button>` : '')}
      ${!all.length ? `<div class="welcome"><span class="e">🌱</span><div><b>Начнём?</b><p>Добавьте первого человека в любом разделе или загрузите пример в настройках, чтобы посмотреть, как всё работает.</p></div></div>` : ''}
      <h2 class="h-sm">Что сделать</h2>
      <div class="todo">
        ${tile(1, 'Анкета', toSend, 'отправить ссылку на анкету', waiting.length ? `ещё ${waiting.length} ${plural(waiting.length, 'ждёт', 'ждут', 'ждут')} ответа` : 'человек ответит сам за 3 минуты')}
        ${tile(2, 'Созвон', needCall, 'назначить созвон', callsToday.length ? `сегодня ${callsToday.length} ${plural(callsToday.length, 'созвон', 'созвона', 'созвонов')}` : callsSet.length ? `уже назначено: ${callsSet.length}` : 'анкета уже заполнена')}
        ${tile(3, 'Итог', decide, 'подвести итог', 'созвон прошёл — запишите, что решили')}
      </div>
      <h2 class="h-sm">Группы</h2>
      <section class="aud">${Object.entries(TYPES).map(([k, T]) => { const f = Stats.funnel(k); return `<a class="card aud-c as-link" href="#${k}">
          <div class="aud-h"><span class="e">${T.emo}</span><b>${groupName(k)}</b><span class="n">${f.all}</span></div>
          <div class="steps3">${T.steps.map((s, i) => `<div><b>${f['c' + (i + 1)]}</b>${s}</div>`).join('')}</div>
          <div class="aud-f">${k === 'client' ? 'Разобрано интервью' : 'Подключаем'}: <b>${f.yes}</b></div></a>`; }).join('')}</section>
      <p class="note aud-note">Цифры в плитке — сколько людей сейчас на каждом шаге.</p>
      <div class="split section">
        <div class="card"><div class="card-head"><h2>Рекомендации</h2></div>
          ${!now.length && !ideas.length ? '<p class="note">Появятся, когда придут первые анкеты — от трёх в группе.</p>' : ''}
          ${now.length ? `<h3 class="rec-h">Сделать сейчас</h3><div class="recs">${now.map(rec).join('')}</div>` : ''}
          ${ideas.length ? `<h3 class="rec-h">Что улучшить</h3><div class="recs">${ideas.map(rec).join('')}</div>` : ''}
        </div>
        <div class="stack">
          <div class="card"><div class="card-head"><h2>Ближайшие созвоны</h2></div>
            ${upcoming.length ? `<div class="calls">${upcoming.map(p => `<a class="call" href="#p-${p.id}"><time>${esc(when(p.callAt))}</time><span><b>${esc(People.name(p))}</b><small>${groupName(p.type)}${p.zoom ? ' · есть ссылка на Zoom' : ''}</small></span></a>`).join('')}</div>` : '<p class="note">Созвонов не назначено.</p>'}</div>
          <a class="card as-link known" href="#stats"><div class="card-head"><h2>Что уже знаем</h2><span class="note">Статистика →</span></div>
            <div class="kpis">${[[known.answers, 'анкет'], [known.talks, 'созвонов'], [known.quotes, 'цитат']].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('')}</div></a>
        </div>
      </div>`;

    on(root, 'click', '[data-paste]', () => openPaste());
  },
});
