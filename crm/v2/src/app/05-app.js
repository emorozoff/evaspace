/* Оболочка и маршруты: #home, #client, #expert, #partner, #amb, #questions,
   #settings, карточка #p-<id>. Ответы, присланные по ссылке, приходят
   адресом #in.<ответы> — тогда открывается окно «Сохранить в карточку». */

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
    Who.ensure();
    Who.resolveNames();
    this.render();
  },

  parse() {
    const h = decodeURIComponent(location.hash.replace(/^#/, ''));
    if (h.startsWith('in.')) return {id: 'import', param: h.slice(3)};
    const m = h.match(/^p-(.+)$/);
    if (m) return {id: 'person', param: m[1]};
    return {id: h || 'home', param: null};
  },
  go(hash) { if (location.hash === '#' + hash) this.render(); else location.hash = hash; },

  typing() {
    const a = document.activeElement;
    return !!(a && a.matches && a.matches('input:not([type=checkbox]):not([type=radio]):not([type=file]), textarea, select') && !$('#modalRoot').contains(a));
  },
  renderSoon(delay = 60) {
    clearTimeout(this._t);
    this._t = setTimeout(() => {
      if (this.typing() || this._pointer || modalOpen()) { this._pending = true; return; }
      this._pending = false;
      this.render();
    }, delay);
  },

  render(opts = {}) {
    let {id, param} = this.parse();
    if (id === 'import') { this.buildShellOnce(); openImport(param); history.replaceState(null, '', '#home'); id = 'home'; param = null; }
    if (!this.pages[id]) { id = 'home'; param = null; }
    this.buildShellOnce();
    this.paintNav(id === 'person' ? (People.get(param) || {}).type : id);
    const prev = $('#page');
    const page = prev.cloneNode(false);
    prev.replaceWith(page);
    const key = id + ':' + (param || '');
    const y = window.scrollY;
    try { this.pages[id].render(page, param); }
    catch (e) { console.error(e); page.innerHTML = `<div class="empty"><b>Страница не открылась 😕</b>${esc(e.message || e)}</div>`; }
    if (this.cur === key) window.scrollTo(0, y); else window.scrollTo(0, 0);
    this.cur = key;
    if (opts.focus) { const el = document.getElementById(opts.focus); if (el) { el.focus(); if (el.setSelectionRange && typeof el.value === 'string') el.setSelectionRange(el.value.length, el.value.length); } }
    const t = typeof this.pages[id].title === 'function' ? this.pages[id].title(param) : this.pages[id].title;
    document.title = (id === 'home' ? '' : (t || '') + ' · ') + 'Eva CRM 2.0';
  },

  buildShellOnce() {
    if (this.shell) return;
    $('#app').innerHTML = `<div class="shell">
      <aside class="side">
        <a class="brand" href="#home">${brandIcon('brand-mark')}<div><b>Eva CRM 2.0</b><span>кастдев и подключение</span></div></a>
        <nav class="nav" id="nav" aria-label="Разделы"></nav>
        <div class="side-foot">
          <div class="sync" id="sync"><i></i><span></span></div>
          <div class="me-chip" id="meChip"></div>
        </div>
      </aside>
      <main class="main"><div class="page" id="page"></div></main>
    </div>`;
    this.shell = true;
    this.paintSync(Store.state);
  },

  paintNav(active) {
    /* у группы одна цифра — сколько в ней людей; что делать, видно на главной */
    $('#nav').innerHTML = NAV.map(n => {
      const cnt = TYPES[n.id] ? People.all(n.id).length : null;
      return `<a href="#${n.id}" class="${n.id === active ? 'on' : ''}"><span class="nav-emo" aria-hidden="true">${n.emo}</span><span>${n.name}</span>${cnt ? `<span class="nav-n">${cnt}</span>` : ''}</a>`;
    }).join('');
    const m = Who.member();
    $('#meChip').innerHTML = `${m ? Team.av(m) : avatar('Гость')}<div class="who"><b>${esc(m ? Team.name(m) : 'Гость')}</b><span>${esc(ROLES[Who.role()] ? ROLES[Who.role()].name : 'Наблюдатель')}</span></div>`;
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
  },
};

function pageHead(title, sub, actions = '') {
  return `<header class="page-head"><div><h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>${actions ? `<div class="page-actions">${actions}</div>` : ''}</header>`;
}
function tabsHtml(key, items, cur) {
  return `<div class="tabs" role="tablist">${items.map(([v, n, cnt]) => `<button role="tab" data-tab-key="${key}" data-tab="${esc(v)}" class="${v === cur ? 'on' : ''}">${n}${cnt !== undefined && cnt !== null ? `<span class="n">${esc(cnt)}</span>` : ''}</button>`).join('')}</div>`;
}
function wireTabs(root) { on(root, 'click', '[data-tab-key]', (e, el) => { View.set(el.dataset.tabKey, el.dataset.tab); App.render(); }); }
/* копирование с запасным окном, если буфер недоступен */
async function copyOrShow(text, label = 'Скопировано 👌') {
  if (await copyText(text)) { toast(label); return; }
  openModal({title: 'Скопируйте вручную', body: `<textarea class="textarea copy-fallback" readonly>${esc(text)}</textarea>`, foot: '<button class="btn" data-close>Готово</button>',
    onMount(el) { const t = $('textarea', el); t.focus(); t.select(); }});
}
