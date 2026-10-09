/* Эксперты: от списка кандидатов до первых выплат. Анкета — как в заявке
   эксперта в приложении (чем занимается, стаж, форматы, где посмотреть,
   подход). Карточка: условия, созвон, съёмка, контент, продажи и доля. */

App.register('experts', {
  title: 'Эксперты',
  render(root) {
    const all = Experts.all();
    const s = settings();
    const q = View.get('ex.q', '').trim().toLowerCase();
    const dirF = View.get('ex.dir', '');
    const list = all.filter(e => (!q || e.name.toLowerCase().includes(q)) && (!dirF || e.direction === dirF));
    const stats = all.map(e => ({e, s: Experts.stats(e)}));
    const agreed = all.filter(e => Funnels.idx('experts', e.stage) >= Funnels.idx('experts', 'agreed')).length;
    const mkLive = sum(stats, x => x.s.live);
    const mkAll = sum(stats, x => x.s.content.length);
    const owed = sum(stats, x => Math.max(0, x.s.owed));
    const canEdit = Who.can('experts.edit') && !Who.readOnly();
    const shoots = all.filter(e => e.shootAt && e.shootAt >= today()).sort((a, b) => a.shootAt.localeCompare(b.shootAt));
    const calls = Tasks.open().filter(x => x.col === 'experts');

    root.innerHTML = `
      ${pageHead('Эксперты', `Цель квартала — 50+ экспертов и 150+ мастер-классов. Эксперту — ${pct(s.expertShare)} с продаж его курсов и консультаций, платформе — ${pct(1 - s.expertShare)}.`,
        `<a class="btn" href="#funnels" data-fnid="experts">${icon('funnel')}Воронка экспертов</a>${canEdit ? `<button class="btn primary" data-new>${icon('plus')}Эксперт</button>` : ''}`)}
      <div class="tiles6">
        <div class="card stat"><span class="label">В базе</span><div class="big">${all.length}</div><div class="foot">кандидатов ${all.filter(e => e.stage === 'list').length} · отказов ${all.filter(e => e.stage === 'lost').length}</div></div>
        <div class="card stat"><span class="label">Согласовано и дальше</span><div class="big">${agreed} <small>из 50</small></div>${progress(agreed / 50, 'good')}<div class="foot">цель квартала</div></div>
        <div class="card stat"><span class="label">Мастер-классы</span><div class="big">${mkLive} <small>из ${mkAll} в плане</small></div>${progress(mkLive / 150, '')}<div class="foot">опубликовано, цель 150</div></div>
        ${Who.can('money.view') ? `<div class="card stat"><span class="label">Продажи с контента</span><div class="big">${rubK(sum(stats, x => x.s.revenue))}</div><div class="foot">к выплате экспертам ${rubK(owed)}</div></div>` : ''}
      </div>
      <div class="split section">
        <div class="card"><div class="card-head"><h2>Ближайшие съёмки</h2><span class="note">смена — до 20 посланий, 8–10 практик или 2 мастер-класса</span></div>
          ${shoots.length ? `<div class="task-list">${shoots.map(e => `<div class="task-row">${avatar(e.name)}<div class="tt"><b>${esc(e.name)}</b><br><a href="#expert-${e.id}">${esc(e.direction)} · ${Object.values(e.content || {}).filter(x => x.status === 'plan').length} в плане</a></div><span class="due">${dayOrWhen(e.shootAt)}</span></div>`).join('')}</div>` : '<p class="note">Съёмки не назначены.</p>'}</div>
        <div class="card"><div class="card-head"><h2>Созвоны и задачи</h2></div>
          ${calls.length ? `<div class="task-list">${calls.slice(0, 6).map(taskRowHtml).join('')}</div>` : '<p class="note">Открытых задач нет.</p>'}</div>
      </div>
      <section class="section">
        <div class="t-bar"><input class="input sm t-search" id="exQ" placeholder="Поиск" value="${esc(View.get('ex.q', ''))}">
          <select class="select sm" id="exDir">${opts([['', 'Все направления'], ...EXPERT_DIRS.map(d => [d, d])], dirF)}</select></div>
        <div class="table-wrap"><table class="t"><thead><tr><th>Эксперт</th><th>Направление</th><th>Этап</th><th class="r">Аудитория</th><th class="r">Контент</th><th>Съёмка</th>${Who.can('money.view') ? '<th class="r">Продажи</th><th class="r">К выплате</th>' : ''}</tr></thead><tbody>
          ${list.map(e => { const st = Experts.stats(e); return `<tr class="hov" style="cursor:pointer" data-href="#expert-${e.id}"><td><span class="row" style="gap:8px;align-items:center;flex-wrap:nowrap">${avatar(e.name)}<b>${esc(e.name)}</b></span></td><td>${esc(e.direction || '')}</td><td>${stagePill('experts', e.stage)}</td><td class="r">${e.audience ? fmt(e.audience) : '—'}</td><td class="r">${st.content.length ? `${st.live}/${st.content.length}` : '—'}</td><td>${e.shootAt ? dayShort(e.shootAt) : '—'}</td>${Who.can('money.view') ? `<td class="r">${st.revenue ? rub(st.revenue) : '—'}</td><td class="r">${st.owed > 0 ? rub(st.owed) : '—'}</td>` : ''}</tr>`; }).join('') || `<tr><td colspan="8"><p class="note">Никого не нашли.</p></td></tr>`}
        </tbody></table></div>
      </section>`;

    let qt;
    $('#exQ', root).oninput = e => { clearTimeout(qt); const v = e.target.value; qt = setTimeout(() => { View.set('ex.q', v); App.render({focus: 'exQ'}); }, 250); };
    $('#exDir', root).onchange = e => { View.set('ex.dir', e.target.value); App.render(); };
    on(root, 'click', '[data-href]', (e, el) => { location.hash = el.dataset.href; });
    on(root, 'click', '[data-new]', () => openExpertForm(null));
    on(root, 'click', '[data-fnid]', (e, el) => View.set('fn.id', el.dataset.fnid));
    wireTaskDone(root);
  },
});

function openExpertForm(id, stage = 'list') {
  const e = id ? Experts.get(id) : null;
  const v = k => (e ? e[k] ?? '' : '');
  const body = `<div class="grid2">
      <label class="field"><span>Имя и фамилия *</span><input class="input" id="exName" value="${esc(v('name'))}"></label>
      <label class="field"><span>Направление</span><select class="select" id="exDirF">${EXPERT_DIRS.map(d => opt(d, d, v('direction') || EXPERT_DIRS[0])).join('')}</select></label>
      <label class="field"><span>Телефон</span><input class="input" id="exPhone" value="${esc(phoneFmt(v('phone')))}"></label>
      <label class="field"><span>Telegram</span><input class="input" id="exTg" value="${esc(v('tg'))}" placeholder="@username"></label>
      <label class="field"><span>Почта</span><input class="input" id="exEmail" value="${esc(v('email'))}"></label>
      <label class="field"><span>Город</span><input class="input" id="exCity" value="${esc(v('city'))}"></label>
      <label class="field"><span>Где посмотреть: сайт, канал, соцсеть</span><input class="input" id="exSocial" value="${esc(v('social'))}"></label>
      <label class="field"><span>Аудитория, подписчиков</span><input class="input num" id="exAud" inputmode="numeric" value="${esc(v('audience'))}"></label>
      <label class="field"><span>Стаж</span><select class="select" id="exExp">${opt('', '—', v('experience'))}${EXPERT_EXP.map(x => opt(x, x, v('experience'))).join('')}</select></label>
      <label class="field"><span>Доля эксперта с продаж</span><select class="select" id="exShare">${[0.5, 0.6, 0.7, 0.8].map(x => opt(x, pct(x), e && typeof e.share === 'number' ? e.share : settings().expertShare)).join('')}</select></label>
      <div class="field" style="grid-column:1/-1"><span>Что хотела бы вести</span><div class="chips" id="exFormats">${EXPERT_FORMATS.map(x => `<label class="chip ${(e && e.formats || []).includes(x) ? 'on' : ''}"><input type="checkbox" value="${esc(x)}" hidden ${(e && e.formats || []).includes(x) ? 'checked' : ''}>${esc(x)}</label>`).join('')}</div></div>
      <label class="field" style="grid-column:1/-1"><span>Пара слов о подходе</span><textarea class="textarea" id="exAbout">${esc(v('about'))}</textarea></label>
    </div>`;
  openModal({title: e ? `Эксперт: ${e.name}` : 'Новый эксперт', wide: true, body,
    foot: `<button class="btn" data-close>Отмена</button><button class="btn primary" data-ok>${e ? 'Сохранить' : 'Добавить'}</button>`,
    onMount(el, close) {
      on(el, 'change', '#exFormats input', (ev, i) => i.closest('.chip').classList.toggle('on', i.checked));
      $('[data-ok]', el).onclick = () => {
        const name = $('#exName', el).value.trim();
        if (!name) { $('#exName', el).classList.add('need'); $('#exName', el).focus(); return; }
        const d = {name, direction: $('#exDirF', el).value, phone: phoneDigits($('#exPhone', el).value), tg: tgUser($('#exTg', el).value), email: $('#exEmail', el).value.trim(), city: $('#exCity', el).value.trim(),
          social: $('#exSocial', el).value.trim(), audience: parseNum($('#exAud', el).value) || null, experience: $('#exExp', el).value, share: Number($('#exShare', el).value),
          formats: $$('#exFormats input:checked', el).map(i => i.value), about: $('#exAbout', el).value.trim()};
        if (e) { Store.patch('experts', e.id, d); close(); return; }
        const nid = Store.add('experts', {...d, stage, funnel: 'experts', manager: Who.id(), created: today(), createdAt: Date.now(), stageAt: Date.now(), content: {},
          ev: {[uid()]: {kind: 'sys', t: Date.now(), by: Who.id(), text: 'Эксперт добавлен вручную'}}});
        close();
        App.go('expert-' + nid);
      };
    }});
}

App.register('expert', {
  title: id => (Experts.get(id) || {}).name || 'Эксперт',
  render(root, id) {
    const e = Experts.get(id);
    if (!e) { root.innerHTML = `<a class="back-link" href="#experts">${icon('back')}Эксперты</a><div class="empty"><b>Эксперт не найден</b></div>`; return; }
    const st = Experts.stats(e);
    const canEdit = Who.can('experts.edit') && !Who.readOnly();
    const mode = View.get('cm.mode', 'msg');
    const tab = View.get('ex.tab', 'feed');
    const evs = Ev.list(e);
    const content = Object.entries(e.content || {}).map(([k, x]) => ({...x, id: k}));
    const pane = tab === 'content' ? `<div class="content-list">${content.map(x => `<div class="content-row">${icon('cam')}<b>${esc(x.title)}</b><span class="muted">${esc(x.kind || 'Мастер-класс')} · ${x.date ? dayShort(x.date) : ''}</span>
        ${canEdit ? `<select class="select sm" data-cstatus="${x.id}" style="width:auto">${Object.entries(CONTENT_STATUS).map(([k, v]) => opt(k, v.name, x.status)).join('')}</select>` : `<span class="pill ${CONTENT_STATUS[x.status].tone}">${CONTENT_STATUS[x.status].name}</span>`}</div>`).join('') || '<p class="note">Контента пока нет.</p>'}</div>
        ${canEdit ? `<form class="row" id="addMk" style="margin-top:10px"><input class="input" id="mkTitle" placeholder="Название мастер-класса или практики" style="flex:2 1 240px"><select class="select" id="mkKind" style="width:auto">${opts(['Мастер-класс', 'Практика', 'Послание', 'Курс'].map(x => [x, x]), 'Мастер-класс')}</select><input class="input" type="date" id="mkDate" style="width:auto" value="${e.shootAt || addDays(today(), 14)}"><button class="btn" type="submit">${icon('plus')}Добавить</button></form>` : ''}`
      : tab === 'sales' ? `${st.sales.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Дата</th><th>Клиентка</th><th>Что</th><th class="r">Сумма</th><th class="r">Доля эксперта</th></tr></thead><tbody>
          ${st.sales.slice().sort((a, b) => b.t - a.t).map(p => `<tr><td>${dayShort(isoTs(p.t))}</td><td><a class="inline-link" href="#client-${p.client.id}">${esc(Clients.name(p.client))}</a></td><td>${esc(p.item || PAY_TYPES[p.type].name)}</td><td class="r">${rub(cashOf(p))}</td><td class="r">${rub(Math.round(cashOf(p) * st.share))}</td></tr>`).join('')}
        </tbody></table></div>` : '<p class="note">Продаж с контента пока нет. Продажа привязывается к эксперту в форме оплаты клиентки.</p>'}`
      : timelineHtml('experts', e, evs, canEdit);

    root.innerHTML = `
      <a class="back-link" href="#experts">${icon('back')}Эксперты</a>
      <div class="cc-head">${avatar(e.name, 'xl')}
        <div class="cc-title"><h1>${esc(e.name)}</h1>
          <div class="cc-sub">${stagePill('experts', e.stage)}<span>${esc(e.direction || '')}</span>${e.audience ? `<span>${fmt(e.audience)} подписчиков</span>` : ''}${e.city ? `<span>${esc(e.city)}</span>` : ''}</div>
          <div class="tags-line">${(e.formats || []).map(f => `<span class="tagc" style="--c:var(--violet)">${esc(f)}</span>`).join('')}</div></div>
        <div class="cc-acts">${canEdit ? `<button class="btn sm" data-edit>${icon('edit')}Изменить</button>` : ''}${e.tg ? `<a class="btn sm" href="https://t.me/${esc(tgUser(e.tg))}" target="_blank" rel="noopener">${icon('ext')}Telegram</a>` : ''}</div>
      </div>
      ${stepperHtml('experts', e, canEdit)}
      <div class="cc-grid">
        <div class="cc-main">${canEdit ? composerHtml('experts', e, mode === 'pay' ? 'msg' : mode) : ''}
          <div class="card">${tabsHtml('ex.tab', [['feed', 'Лента', evs.length], ['content', 'Контент', content.length], ['sales', 'Продажи и доля', st.sales.length || null]], tab)}<div class="cc-pane">${pane}</div></div></div>
        <aside class="cc-side">
          <div class="card"><div class="mini-h"><h3>Условия</h3></div>
            ${kv('Доля эксперта', pct(st.share))}${kv('Платформе', pct(1 - st.share))}
            ${kv('Созвон', e.callAt ? when(e.callAt) : '—')}
            ${kv('Съёмка', canEdit ? `<input class="input sm" type="date" id="exShoot" value="${esc(e.shootAt || '')}" style="width:150px">` : e.shootAt ? dayLong(e.shootAt) : '—')}
            ${kv('Куратор', esc(Team.name(Team.get(e.manager))))}
          </div>
          ${Who.can('money.view') ? `<div class="card"><div class="mini-h"><h3>Деньги</h3></div>${kv('Продажи с контента', rub(st.revenue))}${kv('Заработал', rub(st.earned))}${kv('Выплачено', rub(st.paidOut))}${kv('К выплате', `<b class="${st.owed > 0 ? 'warn' : ''}">${rub(Math.max(0, st.owed))}</b>`)}</div>` : ''}
          <div class="card"><div class="mini-h"><h3>Заявка эксперта</h3></div>
            ${kv('Стаж', esc(e.experience || ''))}${kv('Где посмотреть', e.social ? `<a href="https://${esc(String(e.social).replace(/^https?:\/\//, ''))}" target="_blank" rel="noopener">${esc(e.social)}</a>` : '')}
            ${e.about ? `<p class="note" style="margin-top:6px">${esc(e.about)}</p>` : ''}</div>
          <div class="card"><div class="mini-h"><h3>Контакты</h3></div>${kv('Телефон', esc(phoneFmt(e.phone)))}${kv('Telegram', e.tg ? '@' + esc(tgUser(e.tg)) : '')}${kv('Почта', esc(e.email || ''))}</div>
        </aside>
      </div>`;

    wireTabs(root);
    wireStepper(root, 'experts', e);
    wireTimeline(root, 'experts', e);
    wireComposer(root, 'experts', e);
    on(root, 'click', '[data-edit]', () => openExpertForm(e.id));
    on(root, 'change', '[data-cstatus]', (ev, el) => Store.patch('experts', e.id, {content: {[el.dataset.cstatus]: {status: el.value}}}));
    const shoot = $('#exShoot', root);
    if (shoot) shoot.onchange = () => { Store.patch('experts', e.id, {shootAt: shoot.value || null}); if (shoot.value) Ev.add('experts', e.id, {kind: 'sys', text: `Съёмка назначена на ${dayLong(shoot.value)}`}); };
    const add = $('#addMk', root);
    if (add) add.onsubmit = ev => { ev.preventDefault(); const t = $('#mkTitle', root).value.trim(); if (!t) return; Store.patch('experts', e.id, {content: {['mk' + uid().slice(-5)]: {title: t, kind: $('#mkKind', root).value, status: 'plan', date: $('#mkDate', root).value}}}); };
  },
});
