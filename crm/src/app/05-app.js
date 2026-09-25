/* Оболочка и маршруты. Адрес страницы — простое слово после #:
   #home, #clients, #funnels, #inbox … и карточки #client-<id>,
   #expert-<id>, #partner-<id>. Данные приходят вживую — страница
   перерисовывается сама, но не тогда, когда человек печатает в поле. */

const App = {
  pages: {},
  shell: false,
  cur: null,
  _t: null,
  _pending: false,
  _pointer: false,

  register(id, page) { this.pages[id] = page; },

  start() {
    Store.subscribe(c => { if (c === 'team') { Who.ensure(); Who.resolveNames(); } this.renderSoon(); });
    Store.onStatus(s => this.paintSync(s));
    window.addEventListener('hashchange', () => this.render());
    document.addEventListener('pointerdown', () => { this._pointer = true; }, true);
    document.addEventListener('pointerup', () => { this._pointer = false; if (this._pending) this.renderSoon(); }, true);
    document.addEventListener('focusout', () => { if (this._pending) this.renderSoon(250); });
    wireCharts();
    Who.ensure();
    Who.resolveNames();
    this.render();
  },

  parse() {
    const h = decodeURIComponent(location.hash.replace(/^#/, ''));
    const m = h.match(/^(client|expert|partner)-(.+)$/);
    if (m) return {id: m[1], param: m[2]};
    return {id: h || 'home', param: null};
  },
  go(hash) { if (location.hash === '#' + hash) this.render(); else location.hash = hash; },

  typing() {
    const a = document.activeElement, page = $('#page');
    return !!(page && a && page.contains(a) && a.matches('input:not([type=checkbox]):not([type=radio]):not([type=file]), textarea, select'));
  },
  renderSoon(delay = 60) {
    clearTimeout(this._t);
    this._t = setTimeout(() => {
      if (this.typing() || this._pointer || Drag.active) { this._pending = true; return; }
      this._pending = false;
      this.render();
    }, delay);
  },

  render(opts = {}) {
    let {id, param} = this.parse();
    const nav = NAV.find(n => n.id === id);
    if (!this.pages[id] || (nav && nav.perm && !Who.can(nav.perm))) { id = 'home'; param = null; }
    if (!this.shell) this.buildShell();
    this.paintNav(id);
    const prev = $('#page');
    const page = prev.cloneNode(false);
    prev.replaceWith(page);
    const key = id + ':' + (param || '');
    const y = window.scrollY;
    page.dataset.page = id;
    try { this.pages[id].render(page, param); }
    catch (e) { console.error(e); page.innerHTML = `<div class="empty"><b>Страница не открылась</b>${esc(e.message || e)}</div>`; }
    if (this.cur === key) window.scrollTo(0, y); else window.scrollTo(0, 0);
    this.cur = key;
    if (opts.focus) { const el = document.getElementById(opts.focus); if (el) { el.focus(); if (el.setSelectionRange && typeof el.value === 'string') el.setSelectionRange(el.value.length, el.value.length); } }
    const t = typeof this.pages[id].title === 'function' ? this.pages[id].title(param) : this.pages[id].title;
    document.title = (id === 'home' ? '' : (t || '') + ' · ') + 'Eva CRM';
  },

  buildShell() {
    $('#app').innerHTML = `<div class="shell">
      <aside class="side">
        <a class="brand" href="#home">${brandIcon('brand-mark')}<div><b>Eva CRM</b><span>работа с клиентами</span></div></a>
        <nav class="nav" id="nav" aria-label="Разделы"></nav>
        <div class="side-foot">
          <div class="sync" id="sync"><i></i><span></span></div>
          <div class="me-chip" id="meChip"></div>
        </div>
      </aside>
      <main class="main"><div id="asBar"></div><div class="page" id="page"></div></main>
    </div>`;
    on($('#app'), 'click', '[data-as-exit]', () => { View.set('as', null); App.render(); });
    this.shell = true;
    this.paintSync(Store.state);
  },

  paintNav(active) {
    const items = NAV.filter(n => !n.perm || Who.can(n.perm));
    const cardOf = {client: 'clients', expert: 'experts', partner: 'partners'};
    const act = cardOf[active] || active;
    const badges = {inbox: Inbox.unreadTotal(), home: Tasks.mineOverdue()};
    $('#nav').innerHTML = items.map(n => {
      const b = badges[n.id] || 0;
      return `<a href="#${n.id}" class="${n.id === act ? 'on' : ''}">${icon(n.icon)}<span>${n.name}</span>${b ? `<span class="badge" title="${n.id === 'inbox' ? 'Непрочитанные' : 'Просроченные задачи'}">${b}</span>` : ''}</a>`;
    }).join('');
    const m = Who.member();
    const role = Who.role();
    $('#meChip').innerHTML = `${m ? Team.av(m) : avatar(Who.mode === 'local' ? 'Вы' : 'Гость')}<div class="who"><b>${esc(m ? Team.name(m) : 'Гость')}</b><span>${esc(ROLES[role] ? ROLES[role].name : 'Наблюдатель')}</span></div>`;
    const as = Who.asId();
    $('#asBar').innerHTML = as ? `<div class="as-bar">${icon('eye')}<span>Вы смотрите CRM как <b>${esc(Team.name(Store.get('team', as)))}</b> · ${esc(ROLES[Who.role()].name)}</span><button class="btn xs" data-as-exit>Вернуться к себе</button></div>` : '';
  },

  paintSync(s) {
    const el = $('#sync');
    if (!el) return;
    let cls = '', text = 'Общая база · сохранено';
    if (s.mode === 'local') { cls = 'local'; text = 'Только этот браузер'; }
    else if (s.pending) { cls = 'busy'; text = 'Сохраняю…'; }
    else if (Who.readOnly()) { cls = 'err'; text = 'Только просмотр'; }
    else if (s.error) { cls = 'err'; text = 'Не сохранилось'; }
    el.className = 'sync ' + cls;
    $('span', el).textContent = text;
    el.title = s.mode === 'local'
      ? 'CRM открыта не в артефакте Claude: данные живут только в этом браузере'
      : 'Все правки сразу видны команде';
  },
};

/* заголовок страницы */
function pageHead(title, sub, actions = '') {
  return `<header class="page-head"><div><h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>${actions ? `<div class="page-actions">${actions}</div>` : ''}</header>`;
}
function noAccess(text = 'Этот раздел закрыт для вашей роли.') {
  return `<div class="empty"><b>Нет доступа</b>${esc(text)}</div>`;
}
/* вкладки внутри страницы: состояние помнится в этом браузере */
function tabsHtml(key, items, cur) {
  return `<div class="tabs" role="tablist">${items.map(([v, n, cnt]) => `<button role="tab" data-tab-key="${key}" data-tab="${esc(v)}" class="${v === cur ? 'on' : ''}">${esc(n)}${cnt !== undefined && cnt !== null ? `<span class="n">${esc(cnt)}</span>` : ''}</button>`).join('')}</div>`;
}
function wireTabs(root) {
  on(root, 'click', '[data-tab-key]', (e, el) => { View.set(el.dataset.tabKey, el.dataset.tab); App.render(); });
}
