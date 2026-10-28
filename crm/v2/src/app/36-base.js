/* База — все контакты разом: клиентки, эксперты, партнёры, амбассадоры. Сверху — сводка, ниже —
   список с поиском, фильтрами (группа, этап, канал, тег, срок) и сортировкой; строка ведёт в карточку.
   В карточке вкладка «Профиль»: ID в Еве, канал, кем привлечён, продукты, подписчики, скидка партнёра
   и задачи по контакту; «История» — все касания: шаги, рассылки, задачи. */

const CHANNELS = ['Telegram', 'Instagram', 'ВКонтакте', 'YouTube', 'Блогер', 'Подруга / рекомендация', 'Эксперт', 'Партнёр: студия или салон', 'Мероприятие', 'Сайт', 'Реклама', 'Другое'];
const PRODUCTS = ['Подписка Ева', 'Годовая программа', 'Курс эксперта', 'Мастер-класс', 'Ретрит', 'Офлайн-встреча', 'Маркет'];
/* канал: указан в карточке → ответ анкеты «Откуда узнала» → пришла по ссылке подруги */
function channelOf(p) {
  if (p.channel) return p.channel;
  const s = noEmo((p.answers || {}).source || '');
  if (s) return ({'Подруга': 'Подруга / рекомендация', 'Студия или салон': 'Партнёр: студия или салон'})[s] || (CHANNELS.includes(s) ? s : s.startsWith('Другое') ? 'Другое' : s);
  return p.ref ? 'Подруга / рекомендация' : '';
}
/* кем привлечён: человек из базы по реферальной ссылке или как записали руками */
function recruiter(p) { const r = p.ref ? People.byCode(p.ref) : null; return r ? {p: r, name: People.name(r)} : p.refText ? {name: p.refText} : null; }
/* продукты: отмеченные + действующая подписка и подарочный доступ */
function productsOf(p) {
  const out = [...(p.products || [])];
  const st = Sales.status(p);
  if (['paid', 'renewed'].includes(st) && !out.includes('Подписка Ева')) out.unshift('Подписка Ева');
  if (accessOn(p)) out.push('Доступ в подарок');
  return out;
}
const lastTouch = p => p.touchedAt || p.createdAt || 0;
const DAY = 864e5;

const BASE_STATUS = [['', 'Все этапы'], ['s1', 'Шаг 1 · анкета'], ['s2', 'Шаг 2 · встреча'], ['s3', 'Шаг 3 · итог'], ['sub', 'С подпиской'], ['gift', 'С доступом в подарок'], ['reg', 'Зарегистрированы, не купили'], ['churn', 'Не продлили']];
const BASE_PERIOD = [['', 'За всё время'], ['7', 'Добавлены за 7 дней'], ['30', 'Добавлены за 30 дней'], ['90', 'Добавлены за 90 дней'], ['idle30', 'Без касаний больше 30 дней'], ['exp7', 'Подписка или доступ кончается за 7 дней']];
const BASE_SORT = {
  new: ['Сначала новые', (a, b) => (b.createdAt || 0) - (a.createdAt || 0)],
  touch: ['Последние касания', (a, b) => lastTouch(b) - lastTouch(a)],
  idle: ['Давно без касаний', (a, b) => lastTouch(a) - lastTouch(b)],
  name: ['По имени', (a, b) => People.name(a).localeCompare(People.name(b), 'ru')],
  until: ['Скоро кончается доступ', (a, b) => (untilOf(a) || 9e15) - (untilOf(b) || 9e15)],
};
/* до какого числа у человека есть Ева: подписка или подарок */
const untilOf = p => Math.max(Sales.until(p) || 0, accessOn(p) ? p.access.until : 0) || null;
function baseMatch(p, st) {
  if (!st) return true;
  if (st === 's1' || st === 's2' || st === 's3') return People.col(p) === Number(st[1]);
  const s = Sales.status(p);
  if (st === 'sub') return ['paid', 'renewed'].includes(s);
  if (st === 'gift') return accessOn(p);
  if (st === 'reg') return s === 'reg' || s === 'trial';
  if (st === 'churn') return s === 'churn';
  return true;
}

App.register('base', {
  title: 'База',
  render(root) {
    const V = k => View.get('b.' + k, '');
    const type = V('type'), q = V('q').trim().toLowerCase(), tag = V('tag'), ch = V('ch'), st = V('st'), per = V('per'), sort = V('sort') || 'new';
    const all = People.all();
    const now = Date.now();
    let list = type ? all.filter(p => p.type === type) : all;
    if (q) list = list.filter(p => [People.name(p), p.city, p.code, p.evaId, p.tg, (p.tags || []).join(' '), channelOf(p)].join(' ').toLowerCase().includes(q));
    if (tag) list = list.filter(p => (p.tags || []).includes(tag));
    if (ch) list = list.filter(p => channelOf(p) === ch);
    list = list.filter(p => baseMatch(p, st));
    if (/^\d+$/.test(per)) list = list.filter(p => (p.createdAt || 0) > now - Number(per) * DAY);
    if (per === 'idle30') list = list.filter(p => lastTouch(p) < now - 30 * DAY);
    if (per === 'exp7') list = list.filter(p => { const u = untilOf(p); return u && u > now && u < now + 7 * DAY; });
    list = list.slice().sort((BASE_SORT[sort] || BASE_SORT.new)[1]);
    /* сводка — по всей базе, не по фильтру */
    const by = k => all.filter(p => p.type === k).length;
    const fresh30 = all.filter(p => (p.createdAt || 0) > now - 30 * DAY).length;
    const subs = all.filter(p => ['paid', 'renewed'].includes(Sales.status(p))).length;
    const gifts = all.filter(accessOn).length, refs = all.filter(p => p.ref).length;
    const chRows = Object.entries(all.reduce((m, p) => { const c = channelOf(p); if (c) m[c] = (m[c] || 0) + 1; return m; }, {})).map(([name, v]) => ({name, v})).sort((a, b) => b.v - a.v).slice(0, 7);
    const tagN = all.reduce((m, p) => { (p.tags || []).forEach(t => { m[t] = (m[t] || 0) + 1; }); return m; }, {});
    const tagRows = Object.entries(tagN).map(([name, v]) => ({name, v})).sort((a, b) => b.v - a.v);
    const canEdit = People.canEdit();
    const sel = (id, opts, cur, label) => `<select class="select sm t-filter" id="${id}" aria-label="${label}">${opts.map(([v, n]) => `<option value="${esc(v)}" ${cur === v ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
    const row = p => { const r = recruiter(p), u = untilOf(p), o = Team.get(p.owner), pr = productsOf(p);
      return `<tr data-open="${p.id}" class="${freshFor(p) ? 'is-new' : ''}">
        <td><div class="bt-who">${avatar(People.name(p))}<span><b>${esc(People.name(p))}</b><small>${esc(p.code || '')}${p.evaId ? ' · EVA ' + esc(p.evaId) : ''}${p.tg ? ' · ' + esc(p.tg) : ''}</small></span></div></td>
        <td><span class="bt-grp">${TYPES[p.type].emo} ${esc(TYPES[p.type].one)}</span></td>
        <td>${esc(TYPES[p.type].steps[People.col(p) - 1])}${Sales.status(p) ? `<br><small class="muted">${esc(Sales.label(p))}</small>` : ''}</td>
        <td>${esc(channelOf(p) || '—')}${r ? `<br><small class="muted">привлекла: ${esc(r.name)}</small>` : ''}</td>
        <td>${pr.length ? pr.map(x => `<span class="tagchip">${esc(x)}</span>`).join(' ') : '<span class="muted">—</span>'}${u ? `<br><small class="${u < now + 7 * DAY ? 'warn-t' : 'muted'}">до ${esc(dateRu(u))}</small>` : ''}</td>
        <td>${(p.tags || []).slice(0, 3).map(t => `<span class="tagchip">${esc(t)}</span>`).join(' ')}</td>
        <td>${o ? esc(Team.first(o)) : '<span class="muted">—</span>'}</td>
        <td class="r"><small>${esc(sinceDays(lastTouch(p)))}</small></td></tr>`; };
    root.innerHTML = `
      ${pageHead('База', 'Все контакты в одном месте: кто это, откуда пришёл, кем привлечён, чем пользуется и вся история. Нажмите на строку — откроется карточка.',
        `<button class="btn" data-csv>${icon('download')}Выгрузить в Excel</button>${canEdit ? `<button class="btn primary" data-add>${icon('plus')}Добавить контакт</button>` : ''}`)}
      <div class="kpis kpis-4 card base-kpi">${[[all.length, 'контактов в базе'], [fresh30, 'новых за 30 дней'], [subs, 'с подпиской'], [gifts, 'с доступом в подарок']].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('')}</div>
      <div class="base-dash">
        <div class="card base-types">${Object.keys(TYPES).map(k => `<button class="bt-type ${type === k ? 'on' : ''}" data-btype="${k}"><span>${TYPES[k].emo}</span><b>${by(k)}</b><small>${esc(TYPES[k].name)}</small></button>`).join('')}
          <button class="bt-type ${refs && st === '' && ch === 'Подруга / рекомендация' ? 'on' : ''}" data-bch="Подруга / рекомендация"><span>👭</span><b>${refs}</b><small>по рекомендации</small></button></div>
        <div class="card"><div class="card-head"><h2>Каналы</h2><span class="note">откуда приходят</span></div>${chRows.length ? hbarList(chRows, {color: 'var(--link)'}) : '<p class="note">Канал — из ответа анкеты «Откуда узнала» или в профиле карточки.</p>'}</div>
        <div class="card"><div class="card-head"><h2>Теги</h2><span class="note">нажмите — отфильтрую</span></div>${tagRows.length ? `<div class="tag-cloud">${tagRows.slice(0, 18).map(t => `<button class="chip ${tag === t.name ? 'on' : ''}" data-btag="${esc(t.name)}">${esc(t.name)}<span class="chip-n">${t.v}</span></button>`).join('')}</div>` : '<p class="note">Теги ставятся в карточке — «Добавить тег».</p>'}</div>
      </div>
      <div class="t-bar"><input class="input sm t-search" id="bbq" placeholder="Поиск: имя, @telegram, код, EVA ID, город" value="${esc(V('q'))}">
        ${sel('bbType', [['', 'Все группы'], ...Object.keys(TYPES).map(k => [k, TYPES[k].name])], type, 'Группа')}
        ${sel('bbSt', BASE_STATUS, st, 'Этап')}${sel('bbCh', [['', 'Все каналы'], ...CHANNELS.map(c => [c, c])], ch, 'Канал')}
        ${sel('bbTag', [['', 'Все теги'], ...Object.keys(tagN).sort().map(t => [t, t])], tag, 'Тег')}${sel('bbPer', BASE_PERIOD, per, 'Срок')}${sel('bbSort', Object.entries(BASE_SORT).map(([k, [n]]) => [k, n]), sort, 'Порядок')}
        ${type || q || tag || ch || st || per ? '<button class="link-btn" data-bclear>Сбросить</button>' : ''}<span class="t-bar-sp"></span>
        <span class="note">${list.length === all.length ? `${all.length} ${plural(all.length, 'контакт', 'контакта', 'контактов')}` : `найдено ${list.length} из ${all.length}`}</span></div>
      <div class="card" style="padding:0;overflow:auto">${list.length ? `<table class="t base-t"><thead><tr><th>Контакт</th><th>Группа</th><th>Этап</th><th>Канал</th><th>Продукты</th><th>Теги</th><th>Ведёт</th><th class="r">Касание</th></tr></thead>
        <tbody>${list.slice(0, 400).map(row).join('')}</tbody></table>${list.length > 400 ? `<p class="note" style="padding:10px 14px">Показаны первые 400 — уточните фильтр.</p>` : ''}` : '<p class="note" style="padding:16px">Никого не нашли — поменяйте фильтр.</p>'}</div>`;
    const set = (k, v) => { View.set('b.' + k, v); App.render(); };
    let qt;
    $('#bbq', root).oninput = e => { clearTimeout(qt); const v = e.target.value; qt = setTimeout(() => { View.set('b.q', v); App.render({focus: 'bbq'}); }, 250); };
    [['bbType', 'type'], ['bbSt', 'st'], ['bbCh', 'ch'], ['bbTag', 'tag'], ['bbPer', 'per'], ['bbSort', 'sort']].forEach(([id, k]) => { $('#' + id, root).onchange = e => set(k, e.target.value); });
    on(root, 'click', '[data-btype]', (e, el) => set('type', type === el.dataset.btype ? '' : el.dataset.btype));
    on(root, 'click', '[data-bch]', (e, el) => set('ch', ch === el.dataset.bch ? '' : el.dataset.bch));
    on(root, 'click', '[data-btag]', (e, el) => set('tag', tag === el.dataset.btag ? '' : el.dataset.btag));
    on(root, 'click', '[data-bclear]', () => { ['type', 'q', 'tag', 'ch', 'st', 'per'].forEach(k => View.set('b.' + k, '')); App.render(); });
    on(root, 'click', '[data-open]', (e, el) => App.go('p-' + el.dataset.open));
    on(root, 'click', '[data-csv]', () => downloadCsv(`eva-baza-${today()}.csv`, list));
    on(root, 'click', '[data-add]', async (e, el) => { const t = type || await pickPop(el, Object.keys(TYPES).map(k => [k, `${TYPES[k].emo} ${TYPES[k].one}`]), 'client'); if (t) openAdd(t); });
  },
});

/* выгрузка списка: Excel открывает CSV с «;» и BOM */
function downloadCsv(name, list) {
  const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['Имя', 'Группа', 'Код', 'EVA ID', 'Telegram / телефон', 'Город', 'Этап', 'Продажи', 'Канал', 'Кем привлечён', 'Продукты', 'Ева до', 'Теги', 'Ведёт', 'Добавлен', 'Последнее касание'];
  const rows = list.map(p => { const r = recruiter(p), u = untilOf(p); return [People.name(p), TYPES[p.type].one, p.code, p.evaId, p.tg, p.city, TYPES[p.type].steps[People.col(p) - 1], Sales.label(p), channelOf(p), r ? r.name : '', productsOf(p).join(', '), u ? isoTs(u) : '', (p.tags || []).join(', '), Team.get(p.owner) ? Team.name(Team.get(p.owner)) : '', p.createdAt ? isoTs(p.createdAt) : '', lastTouch(p) ? isoTs(lastTouch(p)) : '']; });
  const csv = '﻿' + [head, ...rows].map(r => r.map(cell).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type: 'text/csv;charset=utf-8'}));
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* ── вкладка «Профиль» в карточке ── */
function profilePane(p, canEdit) {
  const r = recruiter(p), st = Sales.status(p), u = untilOf(p);
  const ro = canEdit ? '' : 'disabled';
  const inv = People.invited(p);
  return `<div class="pf">
    <div class="pf-grid">
      <label class="field"><span>ID в приложении Ева</span><input class="input" data-pf="evaId" value="${esc(p.evaId || '')}" placeholder="например, 104382" ${ro}></label>
      <label class="field"><span>Telegram или телефон</span><input class="input" data-pf="tg" value="${esc(p.tg || '')}" placeholder="@username или +7…" ${ro}></label>
      <label class="field"><span>Канал — откуда пришёл</span><select class="select" data-pf="channel" ${ro}><option value="">${channelOf(p) && !p.channel ? `из анкеты: ${esc(channelOf(p))}` : '—'}</option>${CHANNELS.map(c => `<option ${p.channel === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      <label class="field"><span>Кем привлечён</span>${r && r.p ? `<a class="pf-ref" href="#p-${r.p.id}">${avatar(r.name)}${esc(r.name)} <small>по реферальной ссылке</small></a>` : `<input class="input" data-pf="refText" value="${esc(p.refText || '')}" placeholder="имя, блогер, партнёр…" ${ro}>`}</label>
      <label class="field"><span>Город</span><input class="input" data-pf="city" value="${esc(p.city || '')}" ${ro}></label>
      ${p.type === 'amb' || p.type === 'expert' ? `<label class="field"><span>Подписчики (аудитория)</span><input class="input" type="number" min="0" data-pf="followers" value="${esc(p.followers || '')}" placeholder="${esc(noEmo((p.answers || {}).size || '')) || 'сколько читают'}" ${ro}></label>` : ''}
    </div>
    <div class="field"><span>Продукты, которыми пользуется</span><div class="picked">${productsOf(p).map(x => `<span class="tagchip">${esc(x)}</span>`).join('')}${canEdit ? `<button type="button" class="btn sm" data-products>${icon('edit')}Отметить</button>` : ''}</div></div>
    <div class="pf-sum">
      <div><span>Добавлен</span><b>${p.createdAt ? esc(when(p.createdAt)) : '—'}</b></div>
      <div><span>Последнее касание</span><b>${esc(sinceDays(lastTouch(p)))}</b></div>
      <div><span>Кастдев</span><b>шаг ${People.col(p)} · ${esc(TYPES[p.type].steps[People.col(p) - 1])}</b></div>
      <div><span>Продажи</span><b>${st ? esc(Sales.label(p)) : '—'}</b></div>
      <div><span>Ева до</span><b>${u ? esc(dateRu(u)) : '—'}</b></div>
      <div><span>Привёл(а) по своей ссылке</span><b>${inv.length ? inv.map(x => `<a href="#p-${x.id}">${esc(People.name(x))}</a>`).join(', ') : '—'}</b></div>
      ${p.type === 'partner' && p.deal && p.deal.discount ? `<div><span>Скидка для участниц</span><b>${esc(p.deal.discount)}${p.deal.promo ? ' · промокод ' + esc(p.deal.promo) : ''}</b></div>` : ''}
    </div>
    ${tasksBox(p, canEdit)}
  </div>`;
}
function wireProfile(root, p) {
  on(root, 'change', '[data-pf]', (e, el) => {
    const k = el.dataset.pf, v = el.type === 'number' ? (el.value ? Number(el.value) : null) : el.value.trim();
    const names = {evaId: 'ID в Еве', tg: 'Telegram', channel: 'Канал', refText: 'Кем привлечён', city: 'Город', followers: 'Подписчики'};
    People.patch(p.id, {[k]: v || null}, `${names[k]}: ${v || '—'}`, '🗂');
  });
  on(root, 'click', '[data-products]', async (e, el) => {
    const v = await multiPop(el, {items: [...new Set([...PRODUCTS, ...People.all().flatMap(x => x.products || [])])], selected: p.products || [], allowNew: true, placeholder: 'Найти или добавить продукт…'});
    if (v) People.patch(p.id, {products: v}, `Продукты: ${v.join(', ') || '—'}`, '🛍');
  });
  wireTasks(root, p);
}
/* история: шаги и правки карточки, рассылки, задачи — одной лентой */
function historyItems(p) {
  const out = Object.values(p.log || {}).map(l => ({t: l.t, text: noEmo(l.text), by: l.by}));
  Store.all('mail').forEach(m => { const t = (m.sent || {})[p.id]; if (t) out.push({t, text: `Рассылка «${m.title}» (${m.channel === 'wa' ? 'WhatsApp' : m.channel === 'app' ? 'приложение Евы' : 'Telegram'})`, by: m.by}); });
  Store.all('tasks').filter(x => x.pid === p.id).forEach(x => { out.push({t: x.at, text: `Задача: ${x.text}${x.due ? ' · срок ' + dayShort(x.due) : ''}`, by: x.by}); if (x.done) out.push({t: x.doneAt, text: `Сделано: ${x.text}`, by: x.doneBy}); });
  return out.filter(x => x.t).sort((a, b) => b.t - a.t);
}
