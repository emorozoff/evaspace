/* Партнёры — рабочее место для офлайн-точек и маркета (знакомство и анкета — в «Кастдеве»):
   • путь партнёра: Знакомство → Условия → Обучение → Работает (или Пауза);
   • в карточке — вкладка «Партнёрство»: условия (что даёт участницам, скидка, промокод, что даёт Ева,
     срок), обучение по программе, точки (офлайн-адреса и маркет), коллабы;
   • страница: доска партнёров по пути, коллабы, все точки и маркет, программа обучения. */

const P_STAGES = [['new', 'Знакомство', 'анкета и первый созвон'], ['terms', 'Условия', 'договариваемся, что даём друг другу'], ['training', 'Обучение', 'партнёр учится рассказывать о Еве'], ['active', 'Работает', 'приводит участниц, получает клиенток'], ['pause', 'Пауза', 'на время остановились']];
const PTRAIN_DEFAULT = [
  {id: 'about', t: 'Что такое Ева и для кого', d: 'созвон 15 минут: аудитория, программы, эксперты'},
  {id: 'offer', t: 'Предложение для участниц', d: 'скидка, промокод, как клиентка его получает'},
  {id: 'tell', t: 'Как рассказывать о Еве', d: 'фразы для администратора, где показать QR-код'},
  {id: 'mat', t: 'Материалы получены', d: 'стойка с QR, шаблоны сторис, тексты для рассылки'},
  {id: 'track', t: 'Учёт приведённых', d: 'промокод или ссылка, отчёт раз в месяц'},
];
const ptrain = () => ((Store.get('cfg', 'ptrain') || {}).list || PTRAIN_DEFAULT);
const COLLAB_FORMATS = ['Мероприятие', 'Эфир', 'Акция', 'Совместный продукт', 'Розыгрыш', 'Маркет', 'Ретрит'];
const COLLAB_ST = [['idea', 'Идея'], ['prep', 'Готовим'], ['live', 'Идёт'], ['done', 'Прошёл']];
const POINT_KINDS = [['offline', 'Офлайн-точка'], ['market', 'Маркет']];
/* этап: отмечен руками → по данным: обучение пройдено — работает, есть условия — обучение */
function pStage(p) {
  if (p.pstatus) return p.pstatus;
  const tr = ptrain(), done = tr.filter(m => (p.train || {})[m.id]).length;
  if (tr.length && done === tr.length) return 'active';
  if (p.deal && (p.deal.offer || p.deal.discount || p.deal.promo)) return done ? 'training' : 'terms';
  return 'new';
}
const collabsOf = p => Store.all('collabs').filter(c => [...(c.partners || []), ...(c.experts || []), ...(c.ambs || [])].includes(p.id));

/* ── вкладка «Партнёрство» в карточке ── */
function partnerPane(p, canEdit) {
  const d = p.deal || {}, tr = ptrain(), st = pStage(p), ro = canEdit ? '' : 'disabled';
  const f = (k, label, ph = '', type = 'text') => `<label class="field"><span>${label}</span><input class="input" type="${type}" data-deal="${k}" value="${esc(d[k] || '')}" placeholder="${esc(ph)}" ${ro}></label>`;
  return `<div class="pt">
    <div class="pt-stages">${P_STAGES.map(([k, n]) => `<button class="${st === k ? 'on' : ''}" data-pst="${k}" ${ro}>${esc(n)}</button>`).join('')}${p.pstatus && canEdit ? '<button class="link-btn" data-pst="">считать само</button>' : ''}</div>
    <h3 class="tf-h">Условия</h3>
    <div class="pf-grid">${f('offer', 'Что даёт участницам Евы', 'скидка 15% на абонемент')}${f('discount', 'Скидка', '15%')}${f('promo', 'Промокод', 'EVA15')}
      ${f('give', 'Что даёт Ева', 'промо в приложении, упоминание экспертов')}${f('commission', 'Комиссия или доля', '10% с покупок по ссылке')}${f('from', 'Действует с', '', 'date')}${f('until', 'по', '', 'date')}</div>
    <label class="field"><span>Заметки по договорённости</span><textarea class="textarea" data-deal="note" ${ro}>${esc(d.note || '')}</textarea></label>
    <h3 class="tf-h">Обучение <span class="h-n">${tr.filter(m => (p.train || {})[m.id]).length} из ${tr.length}</span></h3>
    <div class="pt-train">${tr.map(m => { const t = (p.train || {})[m.id]; return `<label class="pt-tm ${t ? 'done' : ''}"><input type="checkbox" data-train="${m.id}" ${t ? 'checked' : ''} ${ro}><span><b>${esc(m.t)}</b><small>${esc(m.d || '')}${t ? ` · ${esc(when(t))}` : ''}</small></span></label>`; }).join('')}</div>
    <h3 class="tf-h">Точки и маркет ${canEdit ? `<button class="btn xs" data-point-add>${icon('plus')}Точка</button>` : ''}</h3>
    ${(p.points || []).length ? `<div class="pt-points">${p.points.map(x => `<div class="pt-point"><span class="tagchip ${x.kind === 'market' ? 'dir' : ''}">${x.kind === 'market' ? 'Маркет' : 'Офлайн'}</span><b>${esc(x.name || '')}</b><span class="muted">${esc([x.city, x.address].filter(Boolean).join(', '))}</span>${x.link ? `<a href="${esc(x.link)}" target="_blank" rel="noopener">ссылка ↗</a>` : ''}${canEdit ? `<button class="icon-btn" data-point-rm="${x.id}" title="Убрать">${icon('x')}</button>` : ''}</div>`).join('')}</div>` : '<p class="note">Добавьте адрес студии или страницу в маркете — они появятся в общем списке точек.</p>'}
    <h3 class="tf-h">Коллабы ${canEdit ? `<button class="btn xs" data-collab-new="${p.id}">${icon('plus')}Коллаб</button>` : ''}</h3>
    ${collabsOf(p).map(collabCard).join('') || '<p class="note">Совместные мероприятия, эфиры, акции — с экспертами и амбассадорами.</p>'}
  </div>`;
}
function wirePartner(root, p) {
  const cur = () => People.get(p.id) || p;
  on(root, 'change', '[data-deal]', (e, el) => People.patch(p.id, {deal: {...(cur().deal || {}), [el.dataset.deal]: el.value.trim()}}, `Условия: ${el.closest('label').querySelector('span').textContent.toLowerCase()} — ${el.value.trim() || '—'}`, '🤝'));
  on(root, 'click', '[data-pst]', (e, el) => { const k = el.dataset.pst; People.patch(p.id, {pstatus: k || null}, k ? `Партнёрство: ${P_STAGES.find(x => x[0] === k)[1].toLowerCase()}` : '', '🤝'); });
  on(root, 'change', '[data-train]', (e, el) => { const m = ptrain().find(x => x.id === el.dataset.train); People.patch(p.id, {train: {...(cur().train || {}), [el.dataset.train]: el.checked ? Date.now() : null}}, `${el.checked ? 'Обучение пройдено' : 'Обучение снято'}: ${m ? m.t : ''}`, '🎓'); });
  on(root, 'click', '[data-point-add]', () => editPoint(cur()));
  on(root, 'click', '[data-point-rm]', (e, el) => People.patch(p.id, {points: (cur().points || []).filter(x => x.id !== el.dataset.pointRm)}, 'Убрали точку', '📍'));
  on(root, 'click', '[data-collab-new]', (e, el) => editCollab(null, el.dataset.collabNew));
  on(root, 'click', '[data-collab]', (e, el) => editCollab(Store.get('collabs', el.dataset.collab)));
}
function editPoint(p) {
  openModal({title: `Точка: ${People.name(p)}`, body: `
      <div class="grid2"><label class="field"><span>Тип</span><select class="select" id="poK">${POINT_KINDS.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></label>
      <label class="field"><span>Название</span><input class="input" id="poN" value="${esc(People.name(p))}"></label></div>
      <div class="grid2"><label class="field"><span>Город</span><input class="input" id="poC" value="${esc(p.city || '')}"></label><label class="field"><span>Адрес</span><input class="input" id="poA" placeholder="ул. Пушкина, 10"></label></div>
      <label class="field"><span>Ссылка (карта, маркет, сайт)</span><input class="input" id="poL" placeholder="https://"></label>`,
    foot: '<button class="btn" data-close>Отмена</button><button class="btn primary" data-ok>Добавить</button>',
    onMount(el, close) {
      $('[data-ok]', el).onclick = () => {
        const link = $('#poL', el).value.trim();
        const pt = {id: uid(), kind: $('#poK', el).value, name: $('#poN', el).value.trim(), city: $('#poC', el).value.trim(), address: $('#poA', el).value.trim(), link: /^https?:\/\//.test(link) ? link : ''};
        People.patch(p.id, {points: [...(p.points || []), pt]}, `Точка: ${pt.name}${pt.city ? ', ' + pt.city : ''}`, '📍');
        close();
      };
    }});
}
function collabCard(c) {
  const ppl = ids => (ids || []).map(id => People.get(id)).filter(Boolean).map(x => `<a href="#p-${x.id}">${esc(People.name(x))}</a>`).join(', ');
  const st = COLLAB_ST.find(x => x[0] === c.status) || COLLAB_ST[0];
  return `<div class="card collab" data-collab="${c.id}"><div class="collab-h"><b>${esc(c.title)}</b><span class="st ${c.status === 'done' ? 'good' : c.status === 'live' ? 'violet' : c.status === 'prep' ? 'warn' : ''}">${esc(st[1])}</span></div>
    <small>${esc([c.format, c.date ? dayShort(c.date) : '', c.city].filter(Boolean).join(' · '))}</small>
    ${(c.partners || []).length ? `<div>Партнёры: ${ppl(c.partners)}</div>` : ''}${(c.experts || []).length ? `<div>Эксперты: ${ppl(c.experts)}</div>` : ''}${(c.ambs || []).length ? `<div>Амбассадоры: ${ppl(c.ambs)}</div>` : ''}
    ${c.result ? `<div class="muted">Итог: ${esc(c.result)}</div>` : ''}</div>`;
}
function editCollab(c, partnerId = '') {
  const pick = (id, ids) => pickedHtml(id, (ids || []).map(x => People.name(People.get(x))), 'Выбрать');
  let sel = {coP: c ? [...(c.partners || [])] : partnerId ? [partnerId] : [], coE: c ? [...(c.experts || [])] : [], coA: c ? [...(c.ambs || [])] : []};
  openModal({title: c ? c.title : 'Новый коллаб', wide: true, body: `
      <label class="field"><span>Название</span><input class="input" id="coT" value="${esc(c ? c.title : '')}" placeholder="Утренняя практика в студии «Баланс»"></label>
      <div class="grid2"><label class="field"><span>Формат</span><select class="select" id="coF">${COLLAB_FORMATS.map(x => `<option ${c && c.format === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      <label class="field"><span>Статус</span><select class="select" id="coS">${COLLAB_ST.map(([k, n]) => `<option value="${k}" ${(c ? c.status : 'idea') === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>
      <div class="grid2"><label class="field"><span>Дата</span><input class="input" type="date" id="coD" value="${esc(c ? c.date || '' : '')}"></label><label class="field"><span>Город или онлайн</span><input class="input" id="coC" value="${esc(c ? c.city || '' : '')}"></label></div>
      <div class="field"><span>Партнёры</span>${pick('coP', sel.coP)}</div><div class="field"><span>Эксперты</span>${pick('coE', sel.coE)}</div><div class="field"><span>Амбассадоры</span>${pick('coA', sel.coA)}</div>
      <label class="field"><span>Что делаем</span><textarea class="textarea" id="coX">${esc(c ? c.about || '' : '')}</textarea></label>
      <label class="field"><span>Итог: сколько пришло, что получили</span><input class="input" id="coR" value="${esc(c ? c.result || '' : '')}"></label>`,
    foot: `${c ? '<button class="btn danger left" data-del>Удалить</button>' : ''}<button class="btn" data-close>Отмена</button><button class="btn primary" data-ok>Сохранить</button>`,
    onMount(el, close) {
      const types = {coP: 'partner', coE: 'expert', coA: 'amb'};
      on(el, 'click', '[data-pick-open]', async (e, b) => {
        const id = b.dataset.pickOpen;
        const v = await multiPop(b, {items: People.all(types[id]).map(p => p.id), selected: sel[id], label: x => People.name(People.get(x)), placeholder: 'Найти…'});
        if (!v) return;
        sel[id] = v;
        $('#' + id, el).outerHTML = pick(id, v);
      });
      if (c) $('[data-del]', el).onclick = async e => { if (await confirmPop(e.target, {text: 'Удалить коллаб?', yes: 'Удалить', danger: true})) { Store.remove('collabs', c.id); close(); } };
      $('[data-ok]', el).onclick = () => {
        const title = $('#coT', el).value.trim();
        if (!title) { $('#coT', el).classList.add('need'); return; }
        const doc = {title, format: $('#coF', el).value, status: $('#coS', el).value, date: $('#coD', el).value, city: $('#coC', el).value.trim(), partners: sel.coP, experts: sel.coE, ambs: sel.coA, about: $('#coX', el).value.trim(), result: $('#coR', el).value.trim()};
        if (c) Store.patch('collabs', c.id, doc); else Store.add('collabs', {...doc, at: Date.now(), by: Who.id()});
        close();
      };
    }});
}

/* ── страница «Партнёры» ── */
App.register('partners', {
  title: 'Партнёры',
  render(root) {
    const tab = ['list', 'collabs', 'points', 'train'].includes(View.get('pt.tab', 'list')) ? View.get('pt.tab', 'list') : 'list';
    const L = People.all('partner'), canEdit = People.canEdit();
    const cat = View.get('pt.cat', '');
    const list = cat ? L.filter(p => p.cat === cat) : L;
    const points = L.flatMap(p => (p.points || []).map(x => ({...x, p})));
    const collabs = Store.all('collabs').sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    const tr = ptrain();
    let body;
    if (tab === 'list') {
      body = `<div class="t-bar"><select class="select sm t-filter" id="ptCat"><option value="">Все категории</option>${PARTNER_CATS.map(c => `<option value="${esc(c)}" ${cat === c ? 'selected' : ''}>${esc(noEmo(c))} · ${L.filter(p => p.cat === c).length}</option>`).join('')}</select><span class="t-bar-sp"></span><span class="note">${list.length} ${plural(list.length, 'партнёр', 'партнёра', 'партнёров')}</span></div>
        <div class="pt-board">${P_STAGES.map(([k, n, about]) => { const col = list.filter(p => pStage(p) === k); return `<div class="b3-col pt-col" data-pst-col="${k}"><div class="b3-h"><b>${esc(n)}</b><span class="kb-n">${col.length}</span></div><div class="b3-hint">${esc(about)}</div>
          <div class="b3-list">${col.map(p => { const d = p.deal || {}, done = tr.filter(m => (p.train || {})[m.id]).length; return `<a class="pc" href="#p-${p.id}" data-ptab="partner"><div class="pc-top">${avatar(People.name(p))}<b>${esc(People.name(p))}</b></div>
            <div class="pc-sub">${esc([noEmo(p.cat), p.city].filter(Boolean).join(' · '))}</div>
            <div class="pc-st">${d.discount || d.offer ? `<span class="st good">${esc(d.discount || d.offer)}</span>` : ''}${d.promo ? `<span class="st">${esc(d.promo)}</span>` : ''}${(p.points || []).length ? `<span class="st">${p.points.length} ${plural(p.points.length, 'точка', 'точки', 'точек')}</span>` : ''}</div>
            ${k === 'training' || k === 'terms' ? `<span class="iv-pbar" title="Обучение ${done} из ${tr.length}"><i style="width:${tr.length ? (done / tr.length * 100).toFixed(0) : 0}%"></i></span>` : ''}</a>`; }).join('') || '<p class="note" style="padding:6px 4px">Пусто</p>'}</div></div>`; }).join('')}</div>`;
    } else if (tab === 'collabs') {
      body = `<div class="section-head"><h2>Коллабы</h2>${canEdit ? `<button class="btn sm primary" data-collab-new="">${icon('plus')}Новый коллаб</button>` : ''}</div>
        <div class="collab-grid">${COLLAB_ST.map(([k, n]) => `<div><h3 class="qs-bh">${n} <small>${collabs.filter(c => (c.status || 'idea') === k).length}</small></h3>${collabs.filter(c => (c.status || 'idea') === k).map(collabCard).join('') || '<p class="note">—</p>'}</div>`).join('')}</div>`;
    } else if (tab === 'points') {
      body = `<div class="kpis kpis-4 card">${[[points.filter(x => x.kind !== 'market').length, 'офлайн-точек'], [points.filter(x => x.kind === 'market').length, 'в маркете'], [new Set(points.map(x => x.city).filter(Boolean)).size, 'городов'], [L.filter(p => pStage(p) === 'active').length, 'партнёров работают']].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('')}</div>
        <div class="card section" style="padding:0;overflow:auto">${points.length ? `<table class="t"><thead><tr><th>Точка</th><th>Тип</th><th>Город</th><th>Адрес</th><th>Партнёр</th><th>Предложение</th></tr></thead><tbody>${points.sort((a, b) => String(a.city || '').localeCompare(String(b.city || ''), 'ru')).map(x => `<tr><td><b>${esc(x.name)}</b>${x.link ? ` <a href="${esc(x.link)}" target="_blank" rel="noopener">↗</a>` : ''}</td><td>${x.kind === 'market' ? 'Маркет' : 'Офлайн'}</td><td>${esc(x.city || '')}</td><td>${esc(x.address || '')}</td><td><a href="#p-${x.p.id}">${esc(People.name(x.p))}</a></td><td>${esc(((x.p.deal || {}).discount || (x.p.deal || {}).offer || ''))}${(x.p.deal || {}).promo ? ' · ' + esc(x.p.deal.promo) : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="note" style="padding:16px">Точки добавляются в карточке партнёра → «Партнёрство» → «Точка».</p>'}</div>`;
    } else {
      body = `<div class="section-head"><h2>Программа обучения партнёров</h2>${canEdit ? `<button class="btn sm primary" data-tr-add>${icon('plus')}Шаг</button>` : ''}</div>
        <div class="card"><ol class="tr-list">${tr.map((m, i) => `<li><span><b>${esc(m.t)}</b><small>${esc(m.d || '')}</small></span><span class="muted">${L.filter(p => (p.train || {})[m.id]).length} из ${L.length}</span>${canEdit ? `<button class="icon-btn" data-tr-ed="${i}" title="Изменить">${icon('edit')}</button><button class="icon-btn" data-tr-rm="${i}" title="Убрать">${icon('trash')}</button>` : ''}</li>`).join('')}</ol></div>
        ${L.length ? `<div class="card section" style="padding:0;overflow:auto"><table class="t"><thead><tr><th>Партнёр</th>${tr.map(m => `<th class="c" title="${esc(m.t)}">${esc(m.t.split(' ').slice(0, 2).join(' '))}</th>`).join('')}</tr></thead><tbody>${L.map(p => `<tr><td><a href="#p-${p.id}" data-ptab="partner">${esc(People.name(p))}</a></td>${tr.map(m => `<td class="c">${(p.train || {})[m.id] ? '✓' : '·'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : ''}`;
    }
    root.innerHTML = `
      ${pageHead('Партнёры', 'Офлайн-точки и маркет: условия, обучение, адреса и коллабы. Знакомство и анкета партнёра — в «Кастдеве».',
        canEdit ? `<a class="btn" href="#partner">${icon('funnel')}Кастдев партнёров</a><button class="btn primary" data-padd>${icon('plus')}Партнёр</button>` : '')}
      ${tabsHtml('pt.tab', [['list', 'Партнёры', L.length || null], ['collabs', 'Коллабы', collabs.length || null], ['points', 'Точки и маркет', points.length || null], ['train', 'Обучение']], tab)}
      <div class="sl-body">${body}</div>`;
    wireTabs(root);
    const pc = $('#ptCat', root);
    if (pc) pc.onchange = () => { View.set('pt.cat', pc.value); App.render(); };
    on(root, 'click', '[data-padd]', () => openAdd('partner'));
    on(root, 'click', '[data-ptab]', () => View.set('pp.tab', 'partner'));
    on(root, 'click', '[data-collab-new]', (e, el) => editCollab(null, el.dataset.collabNew));
    on(root, 'click', '[data-collab]', (e, el) => { if (!e.target.closest('a')) editCollab(Store.get('collabs', el.dataset.collab)); });
    const saveTr = list => Store.put('cfg', 'ptrain', {list, at: Date.now()});
    const trEdit = i => {
      const m = i >= 0 ? tr[i] : {id: 'm' + uid().slice(-5), t: '', d: ''};
      openModal({title: i >= 0 ? 'Шаг обучения' : 'Новый шаг обучения', body: `<label class="field"><span>Шаг</span><input class="input" id="trT" value="${esc(m.t)}"></label><label class="field"><span>Что именно</span><input class="input" id="trD" value="${esc(m.d || '')}"></label>`,
        foot: '<button class="btn" data-close>Отмена</button><button class="btn primary" data-ok>Сохранить</button>',
        onMount(el, close) { $('[data-ok]', el).onclick = () => { const t = $('#trT', el).value.trim(); if (!t) return; const list = tr.map(x => ({...x})); const n = {...m, t, d: $('#trD', el).value.trim()}; if (i >= 0) list[i] = n; else list.push(n); saveTr(list); close(); }; }});
    };
    on(root, 'click', '[data-tr-add]', () => trEdit(-1));
    on(root, 'click', '[data-tr-ed]', (e, el) => trEdit(Number(el.dataset.trEd)));
    on(root, 'click', '[data-tr-rm]', async (e, el) => { if (await confirmPop(el, {text: 'Убрать шаг из программы? Отметки партнёров останутся.', yes: 'Убрать', danger: true})) saveTr(tr.filter((x, i) => i !== Number(el.dataset.trRm))); });
  },
});
