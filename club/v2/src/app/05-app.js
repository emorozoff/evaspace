/* Оболочка и маршруты. Адрес страницы — простое слово после #:
   #home, #strategy, #tasks, #money, #reports, #team, #m-standards (материал).
   Данные приходят вживую — страница перерисовывается сама, но не тогда,
   когда человек печатает в поле: дождёмся, пока он закончит. */

const App = {
  pages: {},
  shell: false,
  cur: null,
  _t: null,
  _pending: false,
  _pointer: false,

  register(id, page) { this.pages[id] = page; },

  start() {
    Store.subscribe(() => this.renderSoon());
    Store.onStatus(s => this.paintSync(s));
    window.addEventListener('hashchange', () => this.render());
    document.addEventListener('pointerdown', () => { this._pointer = true; }, true);
    document.addEventListener('pointerup', () => { this._pointer = false; if (this._pending) this.renderSoon(); }, true);
    document.addEventListener('focusout', () => { if (this._pending) this.renderSoon(250); });
    wireCharts();
    this.render();
  },

  parse() {
    const h = decodeURIComponent(location.hash.replace(/^#/, ''));
    if (h.startsWith('m-')) return {id: 'material', param: h.slice(2)};
    if (h.startsWith('p-')) return {id: 'person', param: h.slice(2)};
    return {id: h || 'home', param: null};
  },
  go(hash) { if (location.hash === '#' + hash) this.render(); else location.hash = hash; },

  typing() {
    const a = document.activeElement, page = $('#page');
    return !!(page && a && page.contains(a) && a.matches('input:not([type=checkbox]):not([type=radio]), textarea, select'));
  },
  renderSoon(delay = 60) {
    clearTimeout(this._t);
    this._t = setTimeout(() => {
      if (this.typing() || this._pointer) { this._pending = true; return; }
      this._pending = false;
      this.render();
    }, delay);
  },

  render(opts = {}) {
    const root = $('#app');
    const me = Auth.me();
    if (!me) {
      /* экран входа не перерисовываем от чужих правок — только если штаб перестал быть пустым */
      const mode = Store.count('accounts') ? 'has' : 'empty';
      if (!opts.force && $('#authRoot') && this._authMode === mode) return;
      this._authMode = mode;
      this.shell = false;
      this.cur = null;
      root.innerHTML = '<div class="auth-page" id="authRoot"></div>';
      renderAuth($('#authRoot'));
      return;
    }
    let {id, param} = this.parse();
    const nav = NAV.find(n => n.id === id);
    if (!this.pages[id] || (nav && nav.perm && !Auth.can(nav.perm))) { id = 'home'; param = null; }
    if (!this.shell) this.buildShell();
    this.paintNav(id);
    /* свежий контейнер на каждую отрисовку: старые обработчики событий уходят вместе с ним */
    const prev = $('#page');
    const page = prev.cloneNode(false);
    prev.replaceWith(page);
    const key = id + ':' + (param || '');
    const y = window.scrollY;
    page.dataset.page = id;
    this.pages[id].render(page, param);
    if (this.cur === key) window.scrollTo(0, y);
    else window.scrollTo(0, 0);
    this.cur = key;
    if (opts.focus) { const el = document.getElementById(opts.focus); if (el) el.focus(); }
    document.title = (id === 'home' ? '' : (this.pages[id].title || '') + ' · ') + 'Штаб Eva Club V2';
  },

  buildShell() {
    $('#app').innerHTML = `<div class="shell">
      <aside class="side">
        <a class="brand" href="#home">${brandIcon('brand-mark')}<div><b>Eva Club</b><span>штаб команды · V2</span></div></a>
        <nav class="nav" id="nav" aria-label="Разделы"></nav>
        <div class="side-foot">
          <div class="sync" id="sync"><i></i><span></span></div>
          <div class="me-chip" id="meChip"></div>
        </div>
      </aside>
      <main class="main"><div class="page" id="page"></div></main>
    </div>`;
    on($('#meChip'), 'click', '[data-logout]', () => Auth.logout());
    this.shell = true;
    this.paintSync(Store.state);
  },

  paintNav(active) {
    const items = NAV.filter(n => !n.perm || Auth.can(n.perm));
    $('#nav').innerHTML = items.map(n => {
      const b = n.id === 'tasks' ? taskBadge() : 0;
      return `<a href="#${n.id}" class="${n.id === active || (active === 'material' && n.id === 'home') ? 'on' : ''}">${icon(n.icon)}<span>${n.name}</span>${b ? `<span class="badge" title="Требуют внимания">${b}</span>` : ''}</a>`;
    }).join('');
    const me = Auth.me(), p = Auth.person();
    const chip = $('#meChip');
    chip.classList.toggle('on', active === 'me' || (active === 'person' && this.parse().param === Auth.personId()));
    chip.innerHTML = `<a class="me-link" href="#me" title="Моя страница">${avatar(p || {name: me.name})}<div class="who"><b>${esc(p && p.name ? p.name : me.name)}</b><span>${esc(p && p.title ? p.title : ROLES[roleOf(me.role)].name)}</span></div></a>
      <button data-logout title="Выйти" aria-label="Выйти">${icon('logout')}</button>`;
  },

  paintSync(s) {
    const el = $('#sync');
    if (!el) return;
    let cls = '', text = 'Общая база · сохранено';
    if (s.mode === 'local') { cls = 'local'; text = 'Только этот браузер'; }
    else if (s.pending) { cls = 'busy'; text = 'Сохраняю…'; }
    else if (s.readOnly) { cls = 'err'; text = 'Только просмотр'; }
    else if (s.error) { cls = 'err'; text = 'Не сохранилось'; }
    el.className = 'sync ' + cls;
    $('span', el).textContent = text;
    el.title = s.mode === 'local'
      ? 'Штаб открыт не в артефакте Claude: данные живут только в этом браузере'
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