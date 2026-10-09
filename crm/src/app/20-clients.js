/* Клиенты — главная таблица. Одна строка = одна клиентка, колонки
   выбираются из схемы (CLIENT_FIELDS), фильтры — быстрые виды, выпадающие
   списки и конструктор условий. Отсюда — массовые действия, импорт и
   выгрузка CSV. */

const Sel = new Set();
const QUICK_VIEWS = {
  all:       {name: 'Все'},
  mine:      {name: 'Мои', test: c => c.manager === Who.id()},
  free:      {name: 'Без менеджера', test: c => !c.manager && c.stage !== 'lost'},
  hot:       {name: 'Горячие', test: c => (c.tags || []).includes('hot') || ['qual', 'invoice'].includes(c.stage)},
  waiting:   {name: 'Ждут ответа', test: c => cx(c).waiting && c.stage !== 'lost'},
  stale:     {name: 'Без касания 7+ дней', test: c => !['paid', 'lost'].includes(c.stage) && (!cx(c).lastTouch || cx(c).lastTouch < addDays(today(), -settings().staleDays))},
  expiring:  {name: 'Подписка заканчивается', test: c => cx(c).sub === 'expiring'},
  paying:    {name: 'С подпиской', test: c => ['active', 'expiring'].includes(cx(c).sub)},
  noconsent: {name: 'Без согласия на рассылки', test: c => !c.consentAds},
};
const DEFAULT_COLS = ['phone', 'city', 'stage', 'segment', 'tags', 'manager', 'source', 'sub', 'ltv', 'lastTouch', 'nextAt'];

/* значение поля для сортировки и CSV */
function sortVal(c, k) {
  if (k === 'name') return Clients.name(c).toLowerCase();
  if (k === 'stage') return (c.stage === 'lost' ? 100 : Funnels.idx(Funnels.of('clients', c), c.stage));
  if (k === 'manager') return Team.name(Team.get(c.manager));
  if (k === 'segment') { const s = cx(c).segment; return s ? s.name : 'я'; }
  if (k === 'sub') return ['active', 'expiring', 'trial', 'expired', 'none'].indexOf(cx(c).sub);
  if (k === 'level') return c.points || 0;
  const v = fieldVal(c, k);
  if (Array.isArray(v)) return v.join(', ');
  return v ?? '';
}
function textVal(c, k) {
  const f = FIELD[k] || {};
  const v = k === 'name' ? Clients.name(c) : fieldVal(c, k);
  if (isEmpty(v)) return '';
  switch (f.type) {
    case 'stage': return (Funnels.stage(Funnels.of('clients', c), c.stage) || {}).name || c.stage;
    case 'segment': { const s = cx(c).segment; return s ? s.name : ''; }
    case 'tags': return (v || []).map(t => (Tags.get(t) || {}).name || t).join(', ');
    case 'person': return Team.name(Team.get(v));
    case 'partner': return (Partners.get(v) || {}).name || '';
    case 'client': return Clients.name(Clients.get(v));
    case 'quiz': return quizText(f.q, v);
    case 'sub': return SUB_STATUS[cx(c).sub].name;
    case 'level': return levelOf(c.points).name;
    case 'phone': return phoneFmt(v);
    case 'date': return typeof v === 'number' ? isoTs(v) : v;
    case 'bool': return v ? 'да' : '';
    default: return f.label ? (Array.isArray(v) ? v.map(f.label).join(', ') : f.label(v)) : Array.isArray(v) ? v.join(', ') : String(v);
  }
}
function cellHtml(c, k) {
  const f = FIELD[k] || {};
  const v = fieldVal(c, k);
  switch (f.type) {
    case 'stage': return stagePill(Funnels.of('clients', c), c.stage);
    case 'segment': return segPill(cx(c).segment);
    case 'tags': return `<span class="tags-line">${tagsHtml(c.tags, 2)}</span>`;
    case 'person': { const m = Team.get(v); return m ? `<span class="row" style="gap:6px;flex-wrap:nowrap;align-items:center">${Team.av(m)}${esc(Team.first(m))}</span>` : '<span class="muted">—</span>'; }
    case 'sub': return subPill(c);
    case 'money': return isEmpty(v) || !v ? '<span class="muted">—</span>' : rub(v);
    case 'date': { const d = toDay(v); if (!d) return '<span class="muted">—</span>'; const late = k === 'nextAt' && d < today(); return `<span class="${late ? 'bad' : k === 'nextAt' && d === today() ? 'warn' : ''}">${dayOrWhen(d)}</span>`; }
    case 'phone': return v ? `<span class="nowrap">${esc(phoneFmt(v))}</span>` : '<span class="muted">—</span>';
    case 'level': return esc(levelOf(c.points).name);
    default: { const t = textVal(c, k); return t ? esc(t) : '<span class="muted">—</span>'; }
  }
}

const ClientsUI = {
  filters() {
    return {
      q: View.get('cl.q', ''), view: View.get('cl.view', 'all'), stage: View.get('cl.stage', ''), seg: View.get('cl.seg', ''),
      tag: View.get('cl.tag', ''), mgr: View.get('cl.mgr', ''), src: View.get('cl.src', ''), sub: View.get('cl.sub', ''),
      rules: View.get('cl.rules', []), match: View.get('cl.match', 'all'),
    };
  },
  list(f = this.filters()) {
    const q = f.q.trim().toLowerCase();
    const qd = q.replace(/\D/g, '');
    const qv = QUICK_VIEWS[f.view];
    const saved = f.view.startsWith('v:') ? (Cfg.list('views') || {})[f.view.slice(2)] : null;
    return Clients.visible().filter(c => {
      if (qv && qv.test && !qv.test(c)) return false;
      if (saved && !testRules(saved.rules, saved.match, c)) return false;
      if (f.stage && c.stage !== f.stage) return false;
      if (f.seg) { const s = cx(c).segment; if (f.seg === 'none' ? s : (!s || s.id !== f.seg)) return false; }
      if (f.tag && !(c.tags || []).includes(f.tag)) return false;
      if (f.mgr === 'me' && c.manager !== Who.id()) return false;
      if (f.mgr === 'none' && c.manager) return false;
      if (f.mgr && !['me', 'none'].includes(f.mgr) && c.manager !== f.mgr) return false;
      if (f.src && c.source !== f.src) return false;
      if (f.sub && cx(c).sub !== f.sub) return false;
      if (f.rules.length && !testRules(f.rules, f.match, c)) return false;
      if (q) {
        const hay = [c.name, c.org, c.email, c.tg, c.city, c.refCode].join(' ').toLowerCase();
        const ph = phoneDigits(c.phone) + ' ' + phoneDigits(c.wa);
        if (!hay.includes(q) && !(qd.length >= 3 && ph.includes(qd))) return false;
      }
      return true;
    });
  },
  sorted(list) {
    const s = View.get('cl.sort', {k: 'created', dir: 'desc'});
    const dir = s.dir === 'asc' ? 1 : -1;
    return list.slice().sort((a, b) => {
      const x = sortVal(a, s.k), y = sortVal(b, s.k);
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir;
      return String(x).localeCompare(String(y), 'ru', {numeric: true}) * dir;
    });
  },
  cols() { return View.get('cl.cols', DEFAULT_COLS).filter(k => FIELD[k] && k !== 'name'); },
};

App.register('clients', {
  title: 'Клиенты',
  render(root) {
    const f = ClientsUI.filters();
    const list = ClientsUI.sorted(ClientsUI.list(f));
    const cols = ClientsUI.cols();
    const sort = View.get('cl.sort', {k: 'created', dir: 'desc'});
    const limit = View.get('cl.limit', 100);
    const vis = Clients.visible();
    const canEdit = Who.can('clients.edit') && !Who.readOnly();
    for (const id of [...Sel]) if (!Store.get('clients', id)) Sel.delete(id);
    const savedViews = Object.entries(Cfg.list('views') || {});
    const segs = Segments.all();
    const extraN = [f.stage, f.seg, f.tag, f.mgr, f.src, f.sub].filter(Boolean).length + (f.rules.length ? 1 : 0);

    const selOpts = (id, cur, pairs, first) => `<select class="select sm" id="${id}">${opt('', first, cur)}${pairs.map(([v, n]) => opt(v, n, cur)).join('')}</select>`;
    const stages = [...Funnels.stages('sales').map(s => [s.id, s.name]), ['lost', LOST.name]];
    const th = k => {
      const fd = k === 'name' ? {n: 'Клиентка'} : FIELD[k];
      const on = sort.k === k;
      return `<th data-sort="${k}" class="${on ? 'sorted' : ''} ${['money', 'number'].includes((FIELD[k] || {}).type) ? 'r' : ''} ${k === 'name' ? 'name' : ''}">${esc(fd.n)}${on ? `<span class="arr">${sort.dir === 'asc' ? '▲' : '▼'}</span>` : ''}</th>`;
    };
    const rows = list.slice(0, limit).map(c => `<tr data-open="${c.id}" class="${Sel.has(c.id) ? 'sel' : ''}">
        <td class="ck"><input type="checkbox" data-sel="${c.id}" ${Sel.has(c.id) ? 'checked' : ''} aria-label="Выбрать"></td>
        <td class="name"><div class="nm">${avatar(Clients.name(c))}<span>${esc(Clients.name(c))}</span>${cx(c).unread ? `<span class="counter">${cx(c).unread}</span>` : ''}</div>${c.org ? `<small>${esc(c.org)}</small>` : ''}</td>
        ${cols.map(k => `<td class="${['money', 'number'].includes(FIELD[k].type) ? 'r' : ''} ${FIELD[k].type === 'quiz' ? 'wrap' : ''}">${cellHtml(c, k)}</td>`).join('')}
      </tr>`).join('');
    const ltvSum = sum(list, c => cx(c).ltv);

    root.innerHTML = `
      ${pageHead('Клиенты', `База: ${fmt(Clients.all().length)} ${plural(Clients.all().length, 'запись', 'записи', 'записей')}${vis.length !== Clients.all().length ? ` · в вашей зоне ${fmt(vis.length)}` : ''}. Каждая строка — карточка со всей историей: анкета, касания, звонки, оплаты.`,
        `${canEdit ? `<button class="btn" data-import>${icon('upload')}Загрузить CSV</button>` : ''}
         ${Who.can('export') ? `<button class="btn" data-export>${icon('download')}Выгрузить</button>` : ''}
         ${canEdit ? `<button class="btn primary" data-new-client>${icon('plus')}Клиентка</button>` : ''}`)}
      ${!Clients.all().length ? emptyBaseHtml() : ''}
      <div class="c-tools">
        <div class="views">
          ${Object.entries(QUICK_VIEWS).map(([k, v]) => `<button class="chip ${f.view === k ? 'on' : ''}" data-view="${k}">${esc(v.name)}${k !== 'all' ? ` <b>${vis.filter(v.test).length}</b>` : ''}</button>`).join('')}
          ${savedViews.map(([id, v]) => `<button class="chip ${f.view === 'v:' + id ? 'on' : ''}" data-view="v:${id}">${icon('filter')}${esc(v.name)}</button>`).join('')}
        </div>
        <div class="t-bar">
          <input class="input sm t-search" id="clQ" placeholder="Имя, телефон, почта, @ник" value="${esc(f.q)}">
          ${selOpts('clStage', f.stage, stages, 'Все этапы')}
          ${selOpts('clSeg', f.seg, [...segs.map(s => [s.id, s.name]), ['none', 'Без сегмента']], 'Все сегменты')}
          ${selOpts('clTag', f.tag, Tags.all().map(t => [t.id, t.name]), 'Все теги')}
          ${Who.can('clients.all') ? selOpts('clMgr', f.mgr, [['me', 'Мои'], ['none', 'Без менеджера'], ...Team.assignable().map(m => [m.id, Team.name(m)])], 'Все менеджеры') : ''}
          ${selOpts('clSrc', f.src, Object.entries(SOURCES), 'Все источники')}
          ${selOpts('clSub', f.sub, Object.entries(SUB_STATUS).map(([k, s]) => [k, s.name]), 'Любая подписка')}
          <button class="btn sm ${f.rules.length ? 'primary' : ''}" data-rules>${icon('filter')}Условия${f.rules.length ? ` · ${f.rules.length}` : ''}</button>
          <span class="t-bar-sp"></span>
          ${extraN || f.q || f.view !== 'all' ? '<button class="btn sm ghost" data-reset>Сбросить</button>' : ''}
          <button class="btn sm ghost" data-cols>${icon('table')}Колонки</button>
        </div>
        ${f.rules.length ? `<div class="rule-txt">${f.rules.map((r, i) => `${i ? `<span class="and">${f.match === 'any' ? 'или' : 'и'}</span>` : ''}<span class="pill line">${esc(ruleText(r))}</span>`).join('')}${Who.can('funnels.edit') ? '<button class="link-btn" data-save-view>Сохранить как вид</button>' : ''}</div>` : ''}
      </div>
      <div class="c-table-wrap"><table class="ct">
        <thead><tr><th class="ck"><input type="checkbox" data-sel-all ${list.length && list.slice(0, limit).every(c => Sel.has(c.id)) ? 'checked' : ''} aria-label="Выбрать все"></th>${th('name')}${cols.map(th).join('')}</tr></thead>
        <tbody>${rows || `<tr><td colspan="${cols.length + 2}"><div class="empty" style="margin:12px"><b>Никого не нашли</b>Поменяйте фильтры или сбросьте их.</div></td></tr>`}</tbody>
        ${list.length ? `<tfoot><tr><td class="ck"></td><td class="name">${fmt(list.length)} ${plural(list.length, 'клиентка', 'клиентки', 'клиенток')}</td>${cols.map(k => `<td class="${['money', 'number'].includes(FIELD[k].type) ? 'r' : ''}">${k === 'ltv' && Who.can('money.view') ? rub(ltvSum) : ''}</td>`).join('')}</tr></tfoot>` : ''}
      </table></div>
      ${list.length > limit ? `<div class="more-rows"><button class="btn" data-more>Показать ещё ${Math.min(100, list.length - limit)} из ${list.length - limit}</button></div>` : ''}
      ${Sel.size ? `<div class="bulk"><b>Выбрано: ${Sel.size}</b>
        ${Who.can('clients.assign') ? `<button class="btn sm" data-bulk="assign">${icon('users')}Менеджер</button>` : ''}
        ${canEdit ? `<button class="btn sm" data-bulk="tag">${icon('tag')}Тег</button><button class="btn sm" data-bulk="stage">${icon('funnel')}Этап</button><button class="btn sm" data-bulk="task">${icon('check')}Задача</button>` : ''}
        ${Who.can('campaigns.send') ? `<button class="btn sm" data-bulk="camp">${icon('send')}В рассылку</button>` : ''}
        ${Who.can('export') ? `<button class="btn sm" data-bulk="export">${icon('download')}CSV</button>` : ''}
        ${Who.can('clients.delete') ? `<button class="btn sm" data-bulk="del">${icon('trash')}Удалить</button>` : ''}
        <span class="sp"></span><button class="btn sm" data-bulk="clear">Снять выбор</button></div>` : ''}
    `;

    /* фильтры */
    let qt;
    $('#clQ', root).oninput = e => { clearTimeout(qt); const v = e.target.value; qt = setTimeout(() => { View.set('cl.q', v); View.set('cl.limit', 100); App.render({focus: 'clQ'}); }, 250); };
    const bind = (id, key) => { const el = $('#' + id, root); if (el) el.onchange = () => { View.set(key, el.value); View.set('cl.limit', 100); App.render(); }; };
    bind('clStage', 'cl.stage'); bind('clSeg', 'cl.seg'); bind('clTag', 'cl.tag'); bind('clMgr', 'cl.mgr'); bind('clSrc', 'cl.src'); bind('clSub', 'cl.sub');
    on(root, 'click', '[data-view]', (e, el) => { View.set('cl.view', el.dataset.view); Sel.clear(); App.render(); });
    on(root, 'click', '[data-reset]', () => { ['cl.q', 'cl.stage', 'cl.seg', 'cl.tag', 'cl.mgr', 'cl.src', 'cl.sub'].forEach(k => View.set(k, '')); View.set('cl.rules', []); View.set('cl.view', 'all'); App.render(); });
    on(root, 'click', '[data-sort]', (e, el) => {
      const k = el.dataset.sort, s = View.get('cl.sort', {k: 'created', dir: 'desc'});
      View.set('cl.sort', {k, dir: s.k === k && s.dir === 'desc' ? 'asc' : 'desc'});
      App.render();
    });
    on(root, 'click', '[data-more]', () => { View.set('cl.limit', limit + 100); App.render(); });
    on(root, 'click', '[data-cols]', () => openColumns());
    on(root, 'click', '[data-rules]', () => openRulesModal({
      title: 'Условия отбора', rules: f.rules, match: f.match,
      hint: 'Любые поля таблицы: анкета, согласия, деньги, активность. Например: «Город равно Москва» и «Принесла, LTV не меньше 5000».',
      onSave: (rules, match) => { View.set('cl.rules', rules); View.set('cl.match', match); App.render(); },
    }));
    on(root, 'click', '[data-save-view]', async (e, el) => {
      const name = await askText(el, 'Название вида', 'Москва, LTV от 5 000');
      if (!name) return;
      Cfg.save('views', 'v' + uid().slice(-5), {name, rules: f.rules, match: f.match});
      toast('Вид сохранён — он появился у всей команды');
    });
    /* строки и выбор */
    on(root, 'click', 'tr[data-open]', (e, el) => { if (e.target.closest('.ck')) return; App.go('client-' + el.dataset.open); });
    on(root, 'change', '[data-sel]', (e, el) => { if (el.checked) Sel.add(el.dataset.sel); else Sel.delete(el.dataset.sel); App.render(); });
    on(root, 'change', '[data-sel-all]', (e, el) => { list.slice(0, limit).forEach(c => (el.checked ? Sel.add(c.id) : Sel.delete(c.id))); App.render(); });
    /* кнопки */
    on(root, 'click', '[data-new-client]', () => openClientForm(null));
    on(root, 'click', '[data-import]', () => openImport());
    on(root, 'click', '[data-export]', () => exportClients(list, cols));
    on(root, 'click', '[data-bulk]', (e, el) => bulkAction(el.dataset.bulk, el));
    wireEmptyBase(root);
  },
});

/* ── массовые действия ── */
async function bulkAction(kind, anchor) {
  const ids = [...Sel].filter(id => Store.get('clients', id));
  const list = ids.map(id => Store.get('clients', id));
  if (kind === 'clear') { Sel.clear(); App.render(); return; }
  if (kind === 'assign') {
    const v = await pickPop(anchor, [['', 'Снять менеджера'], ...Team.assignable().map(m => [m.id, Team.name(m)])], '');
    if (v === null) return;
    list.forEach(c => Store.patch('clients', c.id, {manager: v || null}));
    toast(`Менеджер назначен: ${list.length}`);
  }
  if (kind === 'tag') {
    const v = await pickPop(anchor, [...Tags.all().map(t => [t.id, `${t.name} · ${t.group}`]), ['__new', '+ Новый тег…']], '');
    if (v === null) return;
    let id = v;
    if (v === '__new') { const name = await askText(anchor, 'Новый тег', 'Например, «Была на эфире»'); if (!name) return; id = Tags.ensure(name); }
    list.forEach(c => { if (!(c.tags || []).includes(id)) Store.patch('clients', c.id, {tags: [...(c.tags || []), id]}); });
    toast(`Тег добавлен: ${list.length}`);
  }
  if (kind === 'stage') {
    const v = await pickPop(anchor, [...Funnels.stages('sales').map(s => [s.id, s.name]), ['lost', LOST.name]], '');
    if (v === null) return;
    let reason = '';
    if (v === 'lost') { reason = await pickPop(anchor, LOST_REASONS.map(r => [r, r]), ''); if (reason === null) return; }
    list.forEach(c => moveStage('clients', c.id, v, {reason}));
    toast(`Этап изменён: ${list.length}`);
  }
  if (kind === 'task') {
    const title = await askText(anchor, 'Задача для выбранных', 'Позвонить и пригласить на эфир');
    if (!title) return;
    list.forEach(c => Tasks.add('clients', c.id, {title, due: today(), who: c.manager || Who.id()}));
    toast(`Задач поставлено: ${list.length}`);
  }
  if (kind === 'camp') { openCampaignForm(null, {ids}); return; }
  if (kind === 'export') { exportClients(list, ClientsUI.cols()); return; }
  if (kind === 'del') {
    if (!await confirmPop(anchor, {text: `Удалить ${list.length} ${plural(list.length, 'карточку', 'карточки', 'карточек')} со всей историей?`, yes: 'Удалить', danger: true})) return;
    list.forEach(c => Store.remove('clients', c.id));
    Sel.clear();
    toast(`Удалено: ${list.length}`);
  }
  App.render();
}

/* короткий ввод текста рядом с кнопкой (prompt() в артефакте не работает) */
function askText(anchor, label, placeholder = '', value = '') {
  return new Promise(resolve => {
    closePops();
    const pop = document.createElement('div');
    pop.className = 'pop';
    pop.innerHTML = `<p></p><form class="row" style="gap:6px;flex-wrap:nowrap"><input class="input sm" style="min-width:200px"><button class="btn sm primary" type="submit">OK</button></form>`;
    $('p', pop).textContent = label;
    const inp = $('input', pop);
    inp.placeholder = placeholder;
    inp.value = value;
    document.body.appendChild(pop);
    const r = anchor.getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight;
    let top = r.bottom + 6;
    if (top + h > window.innerHeight - 8) top = r.top - h - 6;
    pop.style.top = (top + window.scrollY) + 'px';
    pop.style.left = (clamp(r.left, 8, window.innerWidth - w - 8) + window.scrollX) + 'px';
    const done = v => { pop.remove(); document.removeEventListener('mousedown', outside, true); resolve(v); };
    pop._done = () => done(null);
    const outside = e => { if (!pop.contains(e.target)) done(null); };
    setTimeout(() => document.addEventListener('mousedown', outside, true), 0);
    $('form', pop).onsubmit = e => { e.preventDefault(); done(inp.value.trim() || null); };
    inp.addEventListener('keydown', e => { if (e.key === 'Escape') done(null); });
    inp.focus();
  });
}

/* ── колонки ── */
function openColumns() {
  const cur = new Set(ClientsUI.cols());
  const body = `<p class="note">Выберите, что видно в таблице. Порядок — как в схеме базы. Настройка помнится в этом браузере.</p>
    <div class="colpick">${FIELD_GROUPS.map(g => `<h4>${esc(g)}</h4>${CLIENT_FIELDS.filter(f => f.g === g && f.k !== 'name').map(f => `<label class="check"><input type="checkbox" value="${f.k}" ${cur.has(f.k) ? 'checked' : ''}>${esc(f.n)}</label>`).join('')}`).join('')}</div>`;
  openModal({title: 'Колонки таблицы', wide: true, body,
    foot: '<button class="btn ghost left" data-def>Как было</button><button class="btn" data-close>Отмена</button><button class="btn primary" data-ok>Показать</button>',
    onMount(el, close) {
      $('[data-def]', el).onclick = () => { View.set('cl.cols', DEFAULT_COLS); close(); };
      $('[data-ok]', el).onclick = () => { View.set('cl.cols', $$('input:checked', el).map(i => i.value)); close(); };
    }});
}

/* ── конструктор условий: общий для фильтра, сегментов и рассылок ── */
const RULE_FIELDS = () => CLIENT_FIELDS.filter(f => !['name', 'id', 'demo', 'segment', 'wa', 'birth'].includes(f.k));
function valueOptions(k) {
  const f = FIELD[k];
  if (!f) return null;
  if (f.type === 'quiz') return Object.entries(QUIZ[f.q].opts);
  if (f.type === 'stage') return [...Funnels.stages('sales').map(s => [s.id, s.name]), ['lost', LOST.name]];
  if (f.type === 'tags') return Tags.all().map(t => [t.id, t.name]);
  if (f.type === 'person') return Team.assignable().map(m => [m.id, Team.name(m)]);
  if (f.type === 'partner') return Partners.all().map(p => [p.id, p.name]);
  if (f.type === 'sub') return Object.entries(SUB_STATUS).map(([k2, s]) => [k2, s.name]);
  if (f.type === 'level') return LEVELS.map(l => [l.id, l.name]);
  if (f.list) return f.list().map(v => [v, f.label ? f.label(v) : v]);
  return null;
}
function ruleRowHtml(r, i) {
  const f = FIELD[r.f] || RULE_FIELDS()[0];
  const ops = opsFor(f.type);
  const op = ops.includes(r.op) ? r.op : ops[0];
  const vo = valueOptions(f.k);
  const noV = OPS[op] && OPS[op].noValue;
  const groups = FIELD_GROUPS.map(g => {
    const fs = RULE_FIELDS().filter(x => x.g === g);
    return fs.length ? `<optgroup label="${esc(g)}">${fs.map(x => opt(x.k, x.n, f.k)).join('')}</optgroup>` : '';
  }).join('');
  let val = '';
  if (noV) val = '<span></span>';
  else if (vo && op !== 'in') val = `<select class="select rv" data-r="v">${vo.map(([v, n]) => opt(v, n, r.v)).join('')}</select>`;
  else if (vo && op === 'in') val = `<select class="select rv" data-r="v" multiple size="3">${vo.map(([v, n]) => `<option value="${esc(v)}" ${(Array.isArray(r.v) ? r.v : [r.v]).includes(v) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
  else val = `<input class="input rv" data-r="v" value="${esc(r.v ?? '')}" ${['number', 'money', 'date'].includes(f.type) ? 'inputmode="numeric"' : ''} placeholder="${f.type === 'date' ? 'дней' : 'значение'}">`;
  return `<div class="rule" data-i="${i}">
    <select class="select" data-r="f">${groups}</select>
    <select class="select" data-r="op">${ops.map(o => opt(o, OPS[o].name, op)).join('')}</select>
    ${val}
    <button class="icon-btn" data-r-del title="Убрать условие">${icon('x')}</button>
  </div>`;
}
function rulesEditorHtml(rules, match) {
  return `<div class="rules" data-rules-ed>${rules.map(ruleRowHtml).join('') || '<p class="note">Условий пока нет.</p>'}</div>
    <div class="rules-foot"><button class="btn sm" data-r-add>${icon('plus')}Условие</button>
      <div class="seg" data-match><button data-m="all" class="${match !== 'any' ? 'on' : ''}">Все условия</button><button data-m="any" class="${match === 'any' ? 'on' : ''}">Любое из</button></div>
      <span class="note" data-r-count></span></div>`;
}
/* читает редактор в массив правил; перерисовывает строку при смене поля */
function wireRulesEditor(el, state, onChange) {
  const read = () => $$('.rule', el).map(row => {
    const f = $('[data-r="f"]', row).value, op = $('[data-r="op"]', row).value;
    const ve = $('[data-r="v"]', row);
    let v = '';
    if (ve) v = ve.multiple ? $$('option:checked', ve).map(o => o.value) : ve.value;
    const ft = (FIELD[f] || {}).type;
    if (['number', 'money'].includes(ft) || ['within', 'older'].includes(op)) v = v === '' ? '' : parseNum(v);
    return {f, op, v};
  });
  const redraw = () => {
    const box = $('[data-rules-ed]', el);
    box.innerHTML = state.rules.map(ruleRowHtml).join('') || '<p class="note">Условий пока нет.</p>';
    onChange && onChange(state);
  };
  el.addEventListener('change', e => {
    const row = e.target.closest('.rule');
    if (!row) return;
    const i = Number(row.dataset.i);
    const prev = state.rules[i] || {};
    state.rules = read();
    if (e.target.dataset.r === 'f' && prev.f !== state.rules[i].f) { state.rules[i] = {f: state.rules[i].f, op: opsFor(FIELD[state.rules[i].f].type)[0], v: ''}; redraw(); return; }
    if (e.target.dataset.r === 'op') { redraw(); return; }
    onChange && onChange(state);
  });
  el.addEventListener('input', e => { if (e.target.closest('.rule') && e.target.tagName === 'INPUT') { state.rules = read(); onChange && onChange(state); } });
  on(el, 'click', '[data-r-add]', e => { e.preventDefault(); state.rules = read(); state.rules.push({f: 'city', op: 'eq', v: ''}); redraw(); });
  on(el, 'click', '[data-r-del]', (e, b) => { e.preventDefault(); state.rules = read(); state.rules.splice(Number(b.closest('.rule').dataset.i), 1); redraw(); });
  on(el, 'click', '[data-m]', (e, b) => { e.preventDefault(); state.match = b.dataset.m; $$('[data-m]', el).forEach(x => x.classList.toggle('on', x === b)); onChange && onChange(state); });
  state.read = read;
}
function openRulesModal({title, rules, match, hint, onSave}) {
  const state = {rules: clone(rules || []), match: match || 'all'};
  const count = () => Clients.visible().filter(c => testRules(state.rules, state.match, c)).length;
  openModal({title, wide: true, body: `${hint ? `<p class="note">${esc(hint)}</p>` : ''}${rulesEditorHtml(state.rules, state.match)}`,
    foot: '<button class="btn ghost left" data-clear>Очистить</button><button class="btn" data-close>Отмена</button><button class="btn primary" data-ok>Применить</button>',
    onMount(el, close) {
      const upd = () => { $('[data-r-count]', el).textContent = `подходят: ${count()}`; };
      wireRulesEditor(el, state, upd);
      upd();
      $('[data-clear]', el).onclick = () => { onSave([], 'all'); close(); };
      $('[data-ok]', el).onclick = () => { state.rules = state.read(); onSave(state.rules.filter(r => r.f && (OPS[r.op].noValue || !isEmpty(r.v))), state.match); close(); };
    }});
}

/* ── новая клиентка / правка карточки ── */
function fieldInput(f, v, idp = 'ff') {
  const id = `${idp}-${f.k}`;
  const vo = valueOptions(f.k);
  if (f.type === 'quiz') {
    const q = QUIZ[f.q];
    if (q.multi) return `<div class="chips" id="${id}" data-multi>${Object.entries(q.opts).map(([k, n]) => `<label class="chip ${(v || []).includes(k) ? 'on' : ''}"><input type="checkbox" value="${k}" ${(v || []).includes(k) ? 'checked' : ''} hidden>${esc(n)}</label>`).join('')}</div>`;
    return `<select class="select" id="${id}">${opt('', '—', v)}${Object.entries(q.opts).map(([k, n]) => opt(k, n, v)).join('')}</select>`;
  }
  if (f.type === 'multi') return `<div class="chips" id="${id}" data-multi>${(vo || []).map(([k, n]) => `<label class="chip ${(v || []).includes(k) ? 'on' : ''}"><input type="checkbox" value="${k}" ${(v || []).includes(k) ? 'checked' : ''} hidden>${esc(n)}</label>`).join('')}</div>`;
  if (vo) return `<select class="select" id="${id}">${opt('', '—', v)}${vo.map(([k, n]) => opt(k, n, v)).join('')}</select>`;
  if (f.type === 'date') return `<input class="input" type="date" id="${id}" value="${esc(toDay(v) || '')}">`;
  if (f.type === 'bool') return `<label class="check"><input type="checkbox" id="${id}" ${v ? 'checked' : ''}>да</label>`;
  if (['number', 'money'].includes(f.type)) return `<input class="input num" inputmode="numeric" id="${id}" value="${esc(v ?? '')}">`;
  return `<input class="input" id="${id}" value="${esc(f.type === 'phone' ? phoneFmt(v) : v ?? '')}" ${f.type === 'email' ? 'type="email"' : ''} placeholder="${f.type === 'tg' ? '@username' : ''}">`;
}
function readField(f, el, idp = 'ff') {
  const node = $(`#${idp}-${f.k}`, el);
  if (!node) return undefined;
  if (node.dataset.multi !== undefined) return $$('input:checked', node).map(i => i.value);
  if (f.type === 'bool') return node.checked;
  const v = node.value.trim();
  if (f.type === 'phone') return v ? phoneDigits(v) : '';
  if (f.type === 'tg') return tgUser(v);
  if (['number', 'money'].includes(f.type)) return v === '' ? null : parseNum(v);
  return v || null;
}
const FORM_SKIP = ['stage', 'tags', 'segment', 'id', 'demo', 'lostReason'];
function openClientForm(id, focusGroup = null) {
  const c = id ? Clients.get(id) : null;
  const editable = CLIENT_FIELDS.filter(f => !f.calc && !FORM_SKIP.includes(f.k) && (c || !['referrerId'].includes(f.k) || true));
  const groups = FIELD_GROUPS.filter(g => editable.some(f => f.g === g));
  const val = f => (f.k.startsWith('q_') ? ((c && c.quiz) || {})[f.k.slice(2)] : c ? c[f.k] : f.k === 'created' ? today() : f.k === 'manager' && Who.role() === 'manager' ? Who.id() : f.k === 'source' ? 'site' : undefined);
  const fieldsHtml = g => `<div class="grid2">${editable.filter(f => f.g === g).map(f => `<label class="field ${['quiz', 'multi'].includes(f.type) && (QUIZ[f.q] || {}).multi !== false ? '' : ''}" style="${['multi'].includes(f.type) || (f.type === 'quiz' && QUIZ[f.q].multi) ? 'grid-column:1/-1' : ''}"><span>${esc(f.n)}${f.req ? ' *' : ''}</span>${f.k === 'referrerId' ? `<select class="select" id="ff-referrerId">${opt('', '—', val(f))}${Clients.all().filter(x => !c || x.id !== c.id).sort((a, b) => Clients.name(a).localeCompare(Clients.name(b), 'ru')).map(x => opt(x.id, Clients.name(x), val(f))).join('')}</select>` : fieldInput(f, val(f))}${f.about ? `<small>${esc(f.about)}</small>` : ''}</label>`).join('')}</div>`;
  const body = `${!c ? `<div class="grid2"><label class="field"><span>Этап воронки</span><select class="select" id="ff-stage">${Funnels.stages('sales').map(s => opt(s.id, s.name, 'lead')).join('')}</select></label><label class="field"><span>Воронка</span><select class="select" id="ff-funnel">${Funnels.forEntity('clients').map(fn => opt(fn.id, fn.name, 'sales')).join('')}</select></label></div>` : ''}
    ${groups.map(g => `<details ${!focusGroup && (g === 'Контакты' || g === 'Воронка') || g === focusGroup ? 'open' : ''} class="fgroup"><summary class="label">${esc(g)}</summary>${fieldsHtml(g)}</details>`).join('')}
    <p class="note">Поля, которые считаются сами (LTV, подписка, последнее касание, сегмент), в форме не правятся — они берутся из истории.</p>`;
  openModal({title: c ? `Правка: ${Clients.name(c)}` : 'Новая клиентка', wide: true, body,
    foot: `<button class="btn" data-close>Отмена</button><button class="btn primary" data-ok>${c ? 'Сохранить' : 'Создать карточку'}</button>`,
    onMount(el, close) {
      on(el, 'change', '[data-multi] input', (e, i) => i.closest('.chip').classList.toggle('on', i.checked));
      $('[data-ok]', el).onclick = () => {
        const data = {quiz: {...((c && c.quiz) || {})}};
        editable.forEach(f => {
          const v = readField(f, el);
          if (v === undefined) return;
          if (f.k.startsWith('q_')) data.quiz[f.k.slice(2)] = v; else data[f.k] = v;
        });
        if (!String(data.name || '').trim() && !String(data.org || '').trim()) { $('#ff-name', el).classList.add('need'); $('#ff-name', el).focus(); return; }
        const dupe = Clients.all().find(x => x.id !== (c && c.id) && ((data.phone && phoneDigits(x.phone) === data.phone) || (data.email && x.email && x.email.toLowerCase() === String(data.email).toLowerCase())));
        if (c) {
          Store.patch('clients', c.id, data);
          if (Array.isArray(data.allowCh)) Store.patch('clients', c.id, {allowCh: data.allowCh});
          toast('Сохранено');
          close();
        } else {
          data.stage = $('#ff-stage', el).value;
          data.funnel = $('#ff-funnel', el).value;
          const nid = Clients.create(data);
          close();
          toast(dupe ? `Создано. Похоже на дубль: ${Clients.name(dupe)} — проверьте` : 'Карточка создана');
          App.go('client-' + nid);
        }
      };
    }});
}

/* ── выгрузка ── */
async function saveFile(filename, data, label = 'Файл') {
  let dl = null;
  try { dl = window.claude && typeof window.claude.use === 'function' ? await window.claude.use('downloads') : null; } catch (e) { dl = null; }
  if (dl) {
    try { await dl.save({filename, data}); toast(`${label} сохранён`); return; }
    catch (e) { if (e && e.code === 'declined') return; }
  }
  /* запасной путь: текст в окне, копируется кнопкой */
  openModal({title: label, wide: true, body: `<p class="note">Скачивание здесь недоступно — скопируйте содержимое и вставьте в Excel или Google Таблицы.</p><textarea class="textarea copy-fallback" id="copyBox" readonly>${esc(data)}</textarea>`,
    foot: '<button class="btn" data-close>Закрыть</button><button class="btn primary" data-copy>Скопировать</button>',
    onMount(el) { $('[data-copy]', el).onclick = async () => { if (await copyText(data, $('#copyBox', el))) toast('Скопировано'); }; }});
}
function exportClients(list, cols) {
  const keys = ['name', ...cols.filter(k => k !== 'name')];
  const extra = ['phone', 'email', 'tg', 'city', 'created'].filter(k => !keys.includes(k));
  const all = [...keys, ...extra];
  const rows = [all.map(k => (k === 'name' ? 'Имя и фамилия' : FIELD[k].n)), ...list.map(c => all.map(k => textVal(c, k)))];
  saveFile(`eva-crm-klienty-${today()}.csv`, csvOf(rows), 'Выгрузка клиентов');
}

/* ── загрузка базы из CSV: «База загружена» ── */
function openImport() {
  let parsed = null, map = [];
  const guess = h => {
    const n = String(h).trim().toLowerCase();
    const f = CLIENT_FIELDS.find(x => (x.csv || []).some(a => n === a || n.includes(a)));
    return f ? f.k : '';
  };
  const body = `<p class="note">Файл CSV из Excel, Google Таблиц или выгрузки сервиса. Первая строка — заголовки: «Имя», «Телефон», «Почта», «Город», «Ниша», «Источник», «Теги»… Столбцы сопоставятся сами, их можно поправить.</p>
    <label class="dropzone" id="dz"><input type="file" accept=".csv,.txt,text/csv" hidden id="impFile"><b>Выберите файл</b> или перетащите его сюда<br><small>или вставьте текст ниже</small></label>
    <textarea class="textarea" id="impText" placeholder="Имя;Телефон;Город;Ниша&#10;Ирина Громова;+7 916 000-00-00;Москва;Салон красоты"></textarea>
    <div id="impMap"></div>`;
  openModal({title: 'Загрузить базу клиентов', wide: true, body,
    foot: '<button class="btn" data-close>Отмена</button><button class="btn primary" data-go disabled>Загрузить</button>',
    onMount(el, close) {
      const go = $('[data-go]', el);
      const show = text => {
        const rows = csvParse(text);
        if (rows.length < 2) { $('#impMap', el).innerHTML = rows.length ? '<p class="warnline">Нужна строка заголовков и хотя бы одна строка данных.</p>' : ''; go.disabled = true; return; }
        parsed = rows;
        map = rows[0].map(guess);
        const fieldOpts = cur => `<option value="">— не загружать —</option>${CLIENT_FIELDS.filter(f => !f.calc && !['stage', 'id', 'demo'].includes(f.k)).map(f => opt(f.k, f.n, cur)).join('')}`;
        const dupes = rows.slice(1).filter(r => {
          const ph = phoneDigits(r[map.indexOf('phone')] || ''), em = String(r[map.indexOf('email')] || '').toLowerCase();
          return Clients.all().some(c => (ph && phoneDigits(c.phone) === ph) || (em && c.email && c.email.toLowerCase() === em));
        }).length;
        $('#impMap', el).innerHTML = `<div class="table-wrap"><table class="t map-t"><thead><tr><th>Столбец файла</th><th>Поле CRM</th><th>Пример</th></tr></thead><tbody>
          ${rows[0].map((h, i) => `<tr><td>${esc(h)}</td><td><select class="select" data-map="${i}">${fieldOpts(map[i])}</select></td><td class="muted">${esc(rows[1][i] || '')}</td></tr>`).join('')}
          </tbody></table></div>
          <div class="grid3" style="margin-top:12px">
            <label class="field"><span>Этап для новых</span><select class="select" id="impStage">${Funnels.stages('sales').map(s => opt(s.id, s.name, 'base')).join('')}</select></label>
            <label class="field"><span>Менеджер</span><select class="select" id="impMgr">${opt('', 'Не назначать', '')}${opt('__even', 'Поровну между менеджерами', '')}${Team.assignable().map(m => opt(m.id, Team.name(m), '')).join('')}</select></label>
            <label class="field"><span>Тег партии</span><input class="input" id="impTag" value="Импорт ${dayShort(today())}"></label>
          </div>
          <p class="note" style="margin-top:8px">Строк: <b>${rows.length - 1}</b>${dupes ? ` · уже есть в базе по телефону или почте: <b>${dupes}</b> — их не дублируем, а дополняем пустые поля и ставим тег` : ''}. Согласие на рассылки из файла не берём: рекламные рассылки этим контактам не уйдут, пока клиентка его не даст.</p>`;
        go.disabled = false;
      };
      $('#impFile', el).onchange = e => { const file = e.target.files[0]; if (!file) return; const r = new FileReader(); r.onload = () => { $('#impText', el).value = String(r.result).slice(0, 2e6); show(String(r.result)); }; r.readAsText(file, 'utf-8'); };
      const dz = $('#dz', el);
      dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('on'); });
      dz.addEventListener('dragleave', () => dz.classList.remove('on'));
      dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('on'); const file = e.dataTransfer.files[0]; if (file) { const r = new FileReader(); r.onload = () => { $('#impText', el).value = String(r.result); show(String(r.result)); }; r.readAsText(file, 'utf-8'); } });
      let t;
      $('#impText', el).oninput = e => { clearTimeout(t); t = setTimeout(() => show(e.target.value), 300); };
      on(el, 'change', '[data-map]', (e, s) => { map[Number(s.dataset.map)] = s.value; });
      go.onclick = async () => {
        if (!parsed) return;
        const stage = $('#impStage', el).value, mgr = $('#impMgr', el).value, tagName = $('#impTag', el).value.trim();
        const tagId = tagName ? Tags.ensure(tagName, 'Импорт') : null;
        const mgrs = Team.assignable().filter(m => roleOf(m.role) === 'manager' || roleOf(m.role) === 'lead');
        const batch = `${tagName || 'Импорт'}.csv`;
        let created = 0, merged = 0, k = 0;
        go.disabled = true;
        for (const r of parsed.slice(1)) {
          const d = {quiz: {}};
          map.forEach((key, i) => {
            if (!key) return;
            const f = FIELD[key];
            let v = String(r[i] ?? '').trim();
            if (!v) return;
            if (f.type === 'phone') v = phoneDigits(v);
            else if (f.type === 'tg') v = tgUser(v);
            else if (['number', 'money'].includes(f.type)) v = parseNum(v);
            else if (f.type === 'tags') v = v.split(/[,;|]/).map(x => Tags.ensure(x.trim())).filter(Boolean);
            else if (f.type === 'select' && key === 'source') v = Object.keys(SOURCES).find(s => SOURCES[s].toLowerCase() === v.toLowerCase() || s === v) || 'import';
            if (key.startsWith('q_')) d.quiz[key.slice(2)] = v; else d[key] = v;
          });
          if (!d.name && !d.org) continue;
          const dup = Clients.all().find(c => (d.phone && phoneDigits(c.phone) === d.phone) || (d.email && c.email && c.email.toLowerCase() === String(d.email).toLowerCase()));
          const tags = [...(d.tags || []), ...(tagId ? [tagId] : [])];
          if (dup) {
            const p = {tags: [...new Set([...(dup.tags || []), ...tags])]};
            Object.entries(d).forEach(([key, v]) => { if (key !== 'tags' && key !== 'quiz' && isEmpty(dup[key])) p[key] = v; });
            Store.patch('clients', dup.id, p);
            merged++;
          } else {
            const manager = mgr === '__even' ? (mgrs.length ? mgrs[k++ % mgrs.length].id : null) : mgr || null;
            Clients.create({...d, tags, stage, manager, source: d.source || 'import', importBatch: batch, consentAds: null});
            created++;
          }
          if ((created + merged) % 25 === 0) { go.textContent = `Загружаю… ${created + merged}`; await new Promise(res => setTimeout(res, 20)); }
        }
        close();
        toast(`Загружено: ${created} новых${merged ? `, дополнено ${merged}` : ''}`);
        View.set('cl.view', 'all');
        App.go('clients');
      };
    }});
}
