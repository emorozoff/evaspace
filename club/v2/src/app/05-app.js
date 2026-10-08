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
    /* закрывают вкладку, пока правка не дошла до базы, — предупреждаем */
    window.addEventListener('beforeunload', e => { if (Store.state.pending > 0) { e.preventDefault(); e.returnValue = ''; } });
    document.addEventListener('pointerdown', e => { this._pointer = true; Sound.unlock(); this.rememberClick(e); }, true);
    document.addEventListener('change', e => this.rememberClick(e), true);
    document.addEventListener('pointerup', () => { this._pointer = false; if (this._pending) this.renderSoon(); }, true);
    document.addEventListener('focusout', () => { if (this._pending) this.renderSoon(250); });
    wireCharts();
    this.render();
  },

  parse() {
    const h = decodeURIComponent(location.hash.replace(/^#/, ''));
    if (h.startsWith('m-')) return {id: 'material', param: h.slice(2)};
    if (h.startsWith('p-')) return {id: 'person', param: h.slice(2)};
    /* ссылка-приглашение: #join=ABCD-2345 */
    if (h.startsWith('join=')) return {id: 'join', param: h.slice(5)};
    /* ссылка для смены пароля: #reset=<учётка>.<код> */
    if (h.startsWith('reset=')) return {id: 'reset', param: h.slice(6)};
    /* раздел страницы: #money:refunds */
    const sub = /^([a-z]+):([a-z]+)$/.exec(h);
    if (sub) return {id: sub[1], param: sub[2]};
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
    /* человек вошёл в Claude и уже привязал учётку — пускаем без пароля
       (кроме ссылки-приглашения и смены пароля: там решает он сам) */
    if (!Auth.me() && !['join', 'reset'].includes(this.parse().id)) Auth.autoLogin();
    const me = Auth.me();
    if (!me) {
      /* экран входа не перерисовываем от чужих правок — только если штаб перестал
         быть пустым или открыли другую ссылку-приглашение */
      const j = this.parse();
      /* анкету по ссылке дорисовываем, когда данные приглашения пришли позже, —
         но только пока человек ничего в ней не набрал */
      const mode = (Store.count('accounts') ? 'has' : 'empty') + (j.id === 'join' ? ':' + joinKey(j.param) : j.id === 'reset' ? ':r' + j.param : '') + ':' + (Auth.claudeId ? 'c' : '');
      const form = $('#joinForm');
      if (!opts.force && $('#authRoot') && (this._authMode === mode || (form && form.dataset.dirty === '1'))) return;
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
    /* свежий контейнер на каждую отрисовку: старые обработчики событий уходят вместе с ним.
       Прокрутку запоминаем ДО замены: пустой контейнер на миг укорачивает
       страницу, и браузер сбрасывает её наверх. Пока рисуем — держим прежнюю
       высоту, после — возвращаем место, а нажатую кнопку оставляем там же на экране. */
    const prev = $('#page');
    const key = id + ':' + (param || '');
    const same = this.cur === key;
    const y = window.scrollY;
    const anchor = same ? this.anchorBefore() : null;
    const page = prev.cloneNode(false);
    if (same) page.style.minHeight = prev.offsetHeight + 'px';
    prev.replaceWith(page);
    page.dataset.page = id;
    this.pages[id].render(page, param);
    if (same) {
      window.scrollTo(0, y);
      this.anchorAfter(anchor);
      requestAnimationFrame(() => { page.style.minHeight = ''; });
    } else window.scrollTo(0, 0);
    this.cur = key;
    if (opts.focus) { const el = document.getElementById(opts.focus); if (el) el.focus(); }
    const n = taskBadge();
    document.title = (n ? `(${n}) ` : '') + (id === 'home' ? '' : (this.pages[id].title || '') + ' · ') + 'Штаб Eva Club V2';
    Chat.paint();
    if (Tour.active) requestAnimationFrame(() => Tour.place());
    else if (id !== 'join') Tour.maybe(id === 'person' && param === Auth.personId() ? 'me' : id);
    /* первый вход новичка — приветствие, один раз на учётку */
    if (me.welcomed === false && this._welcomed !== me.id && id !== 'join') {
      this._welcomed = me.id;
      setTimeout(() => { if (!modalOpen()) openWelcome(); }, 180);
    }
  },

  /* «якорь» — элемент, по которому только что нажали: после перерисовки он
     должен остаться на том же месте экрана (вкладка, фильтр, кнопка) */
  _click: null,
  anchorBefore() {
    const c = this._click;
    if (!c || Date.now() - c.at > 2000) return null;
    const el = document.querySelector(c.sel);
    return el ? {sel: c.sel, top: el.getBoundingClientRect().top} : null;
  },
  anchorAfter(a) {
    if (!a) return;
    const el = document.querySelector(a.sel);
    if (!el) return;
    const d = el.getBoundingClientRect().top - a.top;
    if (Math.abs(d) > 1) window.scrollBy(0, d);
  },
  rememberClick(e) {
    const t = e.target.closest && e.target.closest('#page *');
    if (!t) return;
    /* ищем ближайший элемент с data-атрибутом или id — по нему найдём «того же» после перерисовки */
    for (let el = t; el && el.id !== 'page'; el = el.parentElement) {
      if (el.id) { this._click = {sel: '#' + CSS.escape(el.id), at: Date.now()}; return; }
      const attr = [...el.attributes].find(a => a.name.startsWith('data-') && a.name !== 'data-page');
      if (attr) { this._click = {sel: `[${attr.name}="${CSS.escape(attr.value)}"]`, at: Date.now()}; return; }
    }
  },

  buildShell() {
    $('#app').innerHTML = `<div class="shell">
      <aside class="side">
        <a class="brand" href="#home">${brandIcon('brand-mark')}<div><b>Eva Club</b><span>штаб команды · V2</span></div></a>
        <nav class="nav" id="nav" aria-label="Разделы"></nav>
        <div class="side-foot">
          <div class="side-row"><div class="sync" id="sync"><i></i><span></span></div><button class="snd-btn" id="sndBtn" type="button"></button></div>
          <div class="me-chip" id="meChip"></div>
        </div>
      </aside>
      <main class="main"><div class="ro-banner" id="roBanner" hidden></div><div class="page" id="page"></div></main>
    </div>${Chat.html()}`;
    /* Адам и сообщения: новая учётка — новый разговор */
    Chat.open = false;
    Adam.key = null;
    Chat.wire();
    on($('#meChip'), 'click', '[data-logout]', () => Auth.logout());
    $('#sndBtn').onclick = () => {
      Sound.set(!Sound.on());
      if (Sound.on()) Sound.play('task', true);
      this.paintSound();
      toast(Sound.on() ? 'Звук уведомлений включён: новые задачи и согласования прозвучат' : 'Звук уведомлений выключен');
    };
    this.paintSound();
    this.shell = true;
    this.paintSync(Store.state);
  },

  paintNav(active) {
    const items = NAV.filter(n => !n.perm || Auth.can(n.perm));
    $('#nav').innerHTML = items.map(n => {
      if (n.href) {
        const k = crmWeek().length;
        return `<a href="${n.href}" target="_blank" rel="noopener" class="nav-ext" title="Eva CRM — кастдев и подключение. Число — созвоны CRM на этой неделе">${icon(n.icon)}<span>${n.name}</span>${k ? `<span class="nav-n">${k}</span>` : ''}</a>`;
      }
      const b = n.id === 'tasks' ? taskBadge() : n.id === 'money' ? Fin.badge() : 0;
      return `<a href="#${n.id}" class="${n.id === active || (active === 'material' && n.id === 'home') ? 'on' : ''}">${icon(n.icon)}<span>${n.name}</span>${b ? `<span class="badge" title="Требуют внимания">${b}</span>` : ''}</a>`;
    }).join('');
    const me = Auth.me(), p = Auth.person();
    const chip = $('#meChip');
    chip.classList.toggle('on', active === 'me' || (active === 'person' && this.parse().param === Auth.personId()));
    chip.innerHTML = `<a class="me-link" href="#me" title="Моя страница">${avatar(p || {name: me.name})}<div class="who"><b>${esc(p && p.name ? p.name : me.name)}</b><span>${esc(p && p.title ? p.title : ROLES[roleOf(me.role)].name)}</span></div></a>
      <button data-logout title="Выйти" aria-label="Выйти">${icon('logout')}</button>`;
  },

  paintSound() {
    const b = $('#sndBtn');
    if (!b) return;
    const v = Sound.on();
    b.innerHTML = icon(v ? 'bell' : 'bellOff');
    b.classList.toggle('off', !v);
    b.title = v ? 'Звук уведомлений включён — нажмите, чтобы выключить' : 'Звук уведомлений выключен — нажмите, чтобы включить';
    b.setAttribute('aria-label', b.title);
    b.setAttribute('aria-pressed', String(v));
  },

  paintSync(s) {
    const el = $('#sync');
    if (!el) return;
    let cls = '', text = s.mode === 'server' ? 'Сервер штаба · сохранено' : 'Общая база · сохранено';
    if (s.mode === 'local') { cls = 'local'; text = 'Только этот браузер'; }
    else if (s.pending) { cls = 'busy'; text = 'Сохраняю…'; }
    else if (s.readOnly) { cls = 'err'; text = 'Только просмотр'; }
    else if (s.error) { cls = 'err'; text = 'Не сохранилось'; }
    el.className = 'sync ' + cls;
    $('span', el).textContent = text;
    /* запись не проходит — говорим прямо, а не молча теряем правки */
    const ro = $('#roBanner');
    if (ro) {
      const off = s.mode !== 'local' && (s.readOnly || Auth.canWrite === false);
      ro.hidden = !off;
      if (off) ro.innerHTML = `${icon('help')}<span><b>Ваши правки не сохраняются:</b> штаб открыт вам только на просмотр. Попросите основателя дать доступ на редактирование — меню «Поделиться» у штаба.</span>`;
    }
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