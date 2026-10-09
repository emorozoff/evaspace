/* Вход по ролям. У каждого человека своя учётка; роль решает меню и права.
   Пароль хранится только как PBKDF2-SHA256 (150 000 итераций) с солью —
   тем же способом, что в первой версии, поэтому старые пароли подходят.
   Честно: в артефакте Claude это разделение кабинетов внутри команды, а не
   сейф — общая база читается всеми, у кого есть доступ к штабу.
   На своём сервере (onServer) вход проверяет сервер: пароль уходит только
   ему, отпечатки паролей в браузер не приходят, сессия — в cookie. После
   входа страница перезагружается и получает данные уже по роли. */

/* сервер принял вход — перезагружаемся в штаб; обещание не завершается, чтобы форма не дёргалась */
const serverEnter = hash => { window.EvaServer.enter(hash); return new Promise(() => {}); };

const SESSION_KEY = 'eva-hq-session';
const b64 = buf => btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
function randSalt() {
  const a = new Uint8Array(16);
  if ((window.crypto || {}).getRandomValues) window.crypto.getRandomValues(a);
  else for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
  return b64(a.buffer);
}
async function hashPassword(pw, salt) {
  const enc = new TextEncoder();
  const subtle = (window.crypto || {}).subtle;
  if (subtle && subtle.importKey) {
    try {
      const key = await subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
      const bits = await subtle.deriveBits({name: 'PBKDF2', salt: enc.encode(salt), iterations: 150000, hash: 'SHA-256'}, key, 256);
      return 'pbkdf2$' + b64(bits);
    } catch (e) { /* ниже запасной путь */ }
  }
  let h = 5381;
  const s = salt + '|' + pw;
  for (let r = 0; r < 20000; r++) for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return 'weak$' + h.toString(36);
}
const normEmail = s => String(s || '').trim().toLowerCase();
function makeCode() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s.slice(0, 4) + '-' + s.slice(4);
}
const normCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^(.{4})(.+)$/, '$1-$2');

const Auth = {
  /* сессия: в хранилище браузера и в памяти — некоторые браузеры не дают
     хранилища странице внутри Claude, а вход всё равно должен держаться */
  _sid: null,
  claudeId: null,      // кто смотрит: id аккаунта Claude (capability user), если площадка его даёт
  canWrite: null,      // может ли этот человек писать в общую базу (null — площадка не сказала)
  viaClaude: false,    // вошёл без пароля, по аккаунту Claude
  _noAuto: false,      // нажал «Выйти» — сам больше не входим, пока не обновит страницу
  me() {
    /* window.__EVA_AS — только для проверок: две вкладки под разными людьми */
    /* на своём сервере, кто вошёл, говорит сервер — браузеру на слово не верим */
    const id = onServer() ? window.EvaServer.session.me : window.__EVA_AS || Local.get(SESSION_KEY, null) || this._sid;
    const a = id ? Store.get('accounts', id) : null;
    return a && a.active !== false ? a : null;
  },
  /* узнать человека по аккаунту Claude: один раз привязал — дальше без пароля */
  async initIdentity() {
    try {
      const u = window.claude && typeof window.claude.use === 'function' ? await window.claude.use('user') : null;
      if (!u) return;
      this.claudeId = (await u.id()) || null;
      this.canWrite = await u.can('data.write');
    } catch (e) { /* без личности — обычный вход по паролю */ }
  },
  byClaude() {
    if (!this.claudeId) return null;
    return Store.all('accounts').find(a => a.claudeId === this.claudeId && a.active !== false) || null;
  },
  autoLogin() {
    if (this._noAuto || window.__EVA_AS || this.me()) return false;
    const a = this.byClaude();
    if (!a) return false;
    this.viaClaude = true;
    this.start(a, {silent: true});
    return true;
  },
  /* привязать учётку к аккаунту Claude — следующий вход без пароля */
  linkClaude(accId) {
    if (!this.claudeId || !accId) return;
    Store.all('accounts').filter(a => a.claudeId === this.claudeId && a.id !== accId).forEach(a => Store.patch('accounts', a.id, {claudeId: null}));
    const a = Store.get('accounts', accId);
    if (a && a.claudeId !== this.claudeId) Store.patch('accounts', accId, {claudeId: this.claudeId});
  },
  role() { const a = this.me(); return a ? roleOf(a.role) : null; },
  person() { const a = this.me(); return a ? personById(a.personId) : null; },
  personId() { const a = this.me(); return a ? a.personId || null : null; },
  can(perm) { const r = this.role(); return !!r && (PERMS[perm] || []).includes(r); },
  isOwner() { return this.role() === 'owner'; },

  start(acc, opts = {}) {
    this._sid = acc.id;
    Local.set(SESSION_KEY, acc.id);
    if (!opts.silent) this.linkClaude(acc.id);
    if (!acc.lastSeen || Date.now() - acc.lastSeen > 3600e3) Store.patch('accounts', acc.id, {lastSeen: Date.now()}, {mustExist: true});
  },
  logout() {
    if (onServer()) { window.EvaServer.auth.logout(); return; }
    Local.del(SESSION_KEY); this._sid = null; this._noAuto = true; this.viaClaude = false; window.__EVA_AS = null; App.render();
  },

  findByEmail(email) { const e = normEmail(email); return Store.all('accounts').find(a => normEmail(a.email) === e) || null; },

  async login(email, pw) {
    if (onServer()) { await window.EvaServer.auth.login(email, pw); return serverEnter('home'); }
    const acc = this.findByEmail(email);
    if (!acc) throw new Error('Нет учётки с такой почтой. Если вас пригласили — откройте ссылку из приглашения или введите код во вкладке «У меня приглашение».');
    if (acc.active === false) throw new Error('Учётка отключена. Напишите основателю.');
    if ((await hashPassword(pw, acc.salt)) !== acc.hash) throw new Error('Пароль не подошёл. Проверьте раскладку или попросите у основателя код сброса.');
    this.start(acc);
  },

  async createAccount({name, email, pw, role, personId, welcomed}) {
    if (!name.trim()) throw new Error('Напишите имя и фамилию.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) throw new Error('Почта выглядит неправильно.');
    if (pw.length < 6) throw new Error('Пароль — не короче 6 символов.');
    if (this.findByEmail(email)) throw new Error('Эта почта уже зарегистрирована — просто войдите.');
    const salt = randSalt();
    const acc = {name: name.trim(), email: normEmail(email), role, personId: personId || null,
      salt, hash: await hashPassword(pw, salt), active: true, createdAt: Date.now(), lastSeen: Date.now()};
    if (welcomed === false) acc.welcomed = false;   // новичку при первом входе — приветствие
    const id = uid();
    const wrote = Store.put('accounts', id, acc);
    return {...acc, id, wrote};
  },

  /* первый вход в пустой штаб — учётка основателя и его карточка в команде */
  async createOwner(f) {
    if (onServer()) { await window.EvaServer.auth.owner({name: f.name, email: f.email, pw: f.pw}); return serverEnter('home'); }
    if (Store.count('accounts')) throw new Error('Штаб уже создан — войдите своей почтой.');
    let pid = (people().find(p => p.founder) || {}).id;
    if (!pid) pid = Store.add('people', {name: f.name.trim(), title: 'Основатель', dir: 'ops', founder: true, order: 0});
    const acc = await this.createAccount({...f, role: 'owner', personId: pid});
    if (!personById(pid).name) Store.patch('people', pid, {name: f.name.trim()});
    this.start(acc);
  },

  /* регистрация по приглашению: анкета из ссылки ложится в карточку человека
     в «Команде» — то, что заполнил основатель, человек мог поправить */
  async acceptInvite(f) {
    if (onServer()) {
      await window.EvaServer.auth.join({...f, code: normCode(f.code)});
      Local.del('eva-hq-join:' + f.code);
      return serverEnter('home');
    }
    const code = normCode(f.code);
    const inv = Store.get('invites', code);
    if (!inv || inv.usedBy) throw new Error('Приглашение не найдено или уже использовано. Попросите у основателя новую ссылку.');
    const given = String(f.given || '').trim(), surname = String(f.surname || '').trim();
    if (!given) throw new Error('Напишите имя.');
    if (!surname) throw new Error('Напишите фамилию.');
    const name = joinName(given, surname);
    if (f.birthDate && !/^\d{4}-\d\d-\d\d$/.test(f.birthDate)) throw new Error('Дата рождения выглядит неправильно.');
    let pid = inv.personId;
    if (!pid || !personById(pid)) pid = Store.add('people', {name, title: inv.title || '', dir: inv.dir || '', order: 50});
    const acc = await this.createAccount({name, email: f.email, pw: f.pw, role: roleOf(inv.role), personId: pid, welcomed: false});
    /* запись в общую базу могли не пустить: штаб открыт человеку только на просмотр */
    await acc.wrote;
    if (Store.state.mode !== 'local' && Store.state.readOnly) {
      /* база не приняла — не оставляем в браузере «учётку-призрак», иначе повтор скажет «почта занята» */
      Store.drop('accounts', acc.id);
      if (!inv.personId || inv.personId !== pid) Store.drop('people', pid);
      throw new Error(`Регистрация не сохранилась: штаб открыт тебе только на просмотр. Попроси основателя пригласить тебя в «Поделиться» по почте твоего аккаунта Claude с правом «Редактор», обнови страницу и открой ссылку ещё раз — заполненное в анкете сохранится в этом браузере.`);
    }
    delete acc.wrote;
    const p = personById(pid) || {};
    const card = {name, givenName: given, surname, email: normEmail(f.email), joinedAt: Date.now()};
    ['title', 'dir', 'phone', 'telegram', 'birthDate', 'birthTime', 'birthCity', 'hdType', 'hdProfile'].forEach(k => {
      if (f[k] !== undefined) card[k] = String(f[k] || '').trim();
    });
    if (p.status === 'vacancy') card.status = 'active';   // вакансия закрыта
    Store.patch('people', pid, card);
    Store.patch('invites', code, {usedBy: acc.id, usedAt: Date.now()});
    this.start(acc);
    return acc;
  },

  /* смена пароля по ссылке от основателя: #reset=<учётка>.<код> */
  async resetByLink(accId, code, pw) {
    if (onServer()) { await window.EvaServer.auth.reset({accId, code, pw}); return serverEnter('home'); }
    const acc = Store.get('accounts', accId), r = acc && acc.reset;
    if (!r || r.exp < Date.now()) throw new Error('Ссылка для смены пароля устарела или уже использована. Попросите у основателя новую.');
    if ((await hashPassword(normCode(code), r.salt)) !== r.hash) throw new Error('Ссылка для смены пароля не подходит. Попросите у основателя новую.');
    if (pw.length < 6) throw new Error('Пароль — не короче 6 символов.');
    const salt = randSalt();
    await Store.patch('accounts', acc.id, {salt, hash: await hashPassword(pw, salt), reset: null});
    this.start(acc);
  },
  async resetWithCode(f) {
    if (onServer()) { await window.EvaServer.auth.reset({email: f.email, code: f.code, pw: f.pw}); return serverEnter('home'); }
    const acc = this.findByEmail(f.email);
    const r = acc && acc.reset;
    if (!r || r.exp < Date.now()) throw new Error('Код сброса не найден или истёк. Попросите у основателя новый.');
    if ((await hashPassword(normCode(f.code), r.salt)) !== r.hash) throw new Error('Код сброса не подошёл.');
    if (f.pw.length < 6) throw new Error('Пароль — не короче 6 символов.');
    const salt = randSalt();
    await Store.put('accounts', acc.id, {...acc, salt, hash: await hashPassword(f.pw, salt), reset: null});
    this.start(acc);
  },

  /* основатель выдаёт код сброса пароля: действует сутки */
  async issueReset(accId) {
    if (onServer()) return window.EvaServer.auth.issueReset(accId);
    const code = makeCode(), salt = randSalt();
    await Store.patch('accounts', accId, {reset: {salt, hash: await hashPassword(normCode(code), salt), exp: Date.now() + 864e5}});
    return code;
  },
};

/* ── экран входа ── */
function renderAuth(root) {
  const join = App.parse();
  if (join.id === 'join' && !hqEmpty()) { renderJoin(root, join.param); return; }
  if (join.id === 'reset' && !hqEmpty()) { renderResetLink(root, join.param); return; }
  const empty = hqEmpty();
  let mode = empty ? 'owner' : View.get('authMode', 'login');
  if (mode === 'owner' && !empty) mode = 'login';

  const titles = {
    owner:  ['Создайте штаб', 'Вы первый: эта учётка станет учёткой основателя. Команду пригласите ссылками из раздела «Команда».'],
    login:  ['Вход в штаб', 'Почта и пароль, которые вы задали при регистрации.'],
    invite: ['Вход по приглашению', 'Проще всего — открыть ссылку из приглашения. Если ссылка не открылась, введите код из того же сообщения: дальше будет короткая анкета, роль подставится сама.'],
    reset:  ['Новый пароль', 'Попросите у основателя код сброса — он действует сутки.'],
  };
  const fields = {
    owner:  ['name', 'email', 'pw', 'pw2'],
    login:  ['email', 'pw'],
    invite: ['code'],
    reset:  ['email', 'code', 'pw', 'pw2'],
  };
  const F = {
    name:  '<label class="field"><span>Имя и фамилия</span><input class="input" id="a-name" autocomplete="name" placeholder="Анна Смирнова"></label>',
    email: '<label class="field"><span>Почта</span><input class="input" id="a-email" type="email" name="username" autocomplete="username" placeholder="name@mail.ru"></label>',
    pw:    `<label class="field"><span>${mode === 'login' ? 'Пароль' : 'Пароль (от 6 символов)'}</span><input class="input" id="a-pw" type="password" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}"></label>`,
    pw2:   '<label class="field"><span>Пароль ещё раз</span><input class="input" id="a-pw2" type="password" autocomplete="new-password"></label>',
    code:  mode === 'invite'
      ? (onServer() ? '<label class="field"><span>Код из приглашения</span><input class="input auth-code" id="a-code" autocomplete="one-time-code" placeholder="ABCD-2345"></label>'
        : '<label class="field"><span>Код из приглашения или почта, на которую вас пригласили</span><input class="input" id="a-code" autocomplete="one-time-code" placeholder="ABCD-2345 или name@mail.ru"></label>')
      : '<label class="field"><span>Код сброса</span><input class="input auth-code" id="a-code" autocomplete="one-time-code" placeholder="ABCD-2345"></label>',
  };
  const [title, lead] = titles[mode];
  const tabs = empty ? '' : `<div class="seg auth-tabs">
      <button data-mode="login" class="${mode === 'login' ? 'on' : ''}">Вход</button>
      <button data-mode="invite" class="${mode === 'invite' ? 'on' : ''}">У меня приглашение</button>
    </div>`;
  const roles = Object.entries(ROLES).map(([k, r]) =>
    `<li><span class="pill ${r.tone}">${r.name}</span><span>${esc(r.about)}</span></li>`).join('');

  root.innerHTML = `<div class="auth">
    <form class="auth-card card" id="authForm" novalidate>
      <div class="auth-brand">${brandIcon('auth-mark')}<div><b>Eva Club</b><span>штаб команды Eva Space · V2</span></div></div>
      ${tabs}
      <h1>${title}</h1>
      <p class="auth-lead">${lead}</p>
      <div class="auth-msg" id="authMsg" hidden></div>
      <div class="auth-fields">${fields[mode].map(k => F[k]).join('')}</div>
      <button class="btn primary auth-go" type="submit" id="authGo">${mode === 'owner' ? 'Создать штаб' : mode === 'invite' ? 'Дальше — к анкете' : mode === 'reset' ? 'Сохранить пароль и войти' : 'Войти'}</button>
      <div class="auth-links">
        ${mode === 'login' ? '<button type="button" class="link-btn" data-mode="reset">Забыли пароль?</button>' : ''}
        ${mode === 'reset' ? '<span class="note">Проще всего — попросить у основателя ссылку для смены пароля: «Команда» → «Сброс пароля».</span>' : ''}
        ${mode === 'reset' ? '<button type="button" class="link-btn" data-mode="login">Вернуться ко входу</button>' : ''}
      </div>
      ${Auth.claudeId && mode === 'login' ? '<p class="auth-claude">Вы вошли в Claude — после первого входа штаб будет узнавать вас сам, без пароля.</p>' : ''}
      <p class="auth-note">${onServer() ? 'Не используйте здесь пароль от почты или банка. Забыли пароль — основатель пришлёт ссылку для смены.' : 'Не используйте пароль от почты или банка: вход разделяет кабинеты внутри команды, а данные штаба видят все, кому открыт доступ к нему.'}</p>
    </form>
    <aside class="auth-side">
      <p class="label">Кто что видит</p>
      <ul class="auth-roles">${roles}</ul>
      <p class="note">Роль назначает основатель, когда отправляет ссылку-приглашение. Поменять её можно в разделе «Команда».</p>
    </aside>
  </div>`;

  on(root, 'click', '[data-mode]', (e, el) => { e.preventDefault(); View.set('authMode', el.dataset.mode); App.render({force: true}); });
  const form = $('#authForm', root);
  const msg = $('#authMsg', root);
  const val = id => ($('#' + id, root) || {}).value || '';
  form.addEventListener('submit', async e => {
    e.preventDefault();
    msg.hidden = true;
    const f = {name: val('a-name'), email: val('a-email'), pw: val('a-pw'), code: val('a-code')};
    if (mode === 'invite' && onServer()) {
      const raw = f.code.trim();
      if (raw.includes('@')) { msg.textContent = 'Введите код из сообщения с приглашением (вида ABCD-2345) или откройте ссылку из него.'; msg.hidden = false; return; }
      const code = normCode(raw);
      let inv = null;
      try { inv = ((await window.EvaServer.auth.peek({join: code})).invites || {})[code] || null; }
      catch (err) { msg.textContent = err.message || 'Сервер не ответил — попробуйте ещё раз.'; msg.hidden = false; return; }
      if (!inv || inv.usedBy) { msg.textContent = inv ? 'По этому коду уже зарегистрировались — войдите своей почтой и паролем.' : 'Код не найден. Проверьте его или попросите у основателя новую ссылку.'; msg.hidden = false; return; }
      location.hash = 'join=' + code;
      return;
    }
    if (mode === 'invite') {
      const raw = f.code.trim();
      /* можно ввести почту: найдём приглашение, выданное человеку с этой почтой */
      if (raw.includes('@')) {
        const e = normEmail(raw);
        const found = Store.all('invites').filter(i => !i.usedBy).filter(i => { const p = personById(i.personId); return p && [p.email, p.calEmail].some(x => x && normEmail(x) === e); });
        if (found.length !== 1) { msg.textContent = found.length ? 'На эту почту несколько приглашений — введите код из сообщения.' : 'Приглашения на эту почту не нашлось. Введите код из сообщения или попросите у основателя ссылку.'; msg.hidden = false; return; }
        location.hash = 'join=' + found[0].id;
        return;
      }
      const code = normCode(raw), inv = Store.get('invites', code);
      if (!inv || inv.usedBy) { msg.textContent = inv ? 'По этому коду уже зарегистрировались — войдите своей почтой и паролем.' : 'Код не найден. Проверьте его или попросите у основателя новую ссылку.'; msg.hidden = false; return; }
      location.hash = 'join=' + code;
      return;
    }
    if (fields[mode].includes('pw2') && f.pw !== val('a-pw2')) { msg.textContent = 'Пароли не совпадают.'; msg.hidden = false; return; }
    const go = $('#authGo', root);
    go.disabled = true;
    go.textContent = 'Проверяю…';
    try {
      if (mode === 'owner') await Auth.createOwner(f);
      else if (mode === 'reset') await Auth.resetWithCode(f);
      else await Auth.login(f.email, f.pw);
      View.set('authMode', 'login');
      App.render();
    } catch (err) {
      msg.textContent = err.message || String(err);
      msg.hidden = false;
      go.disabled = false;
      go.textContent = 'Попробовать ещё раз';
    }
  });
  wirePwToggles(root);
  const first = $('input', form);
  /* фокус в первое поле — только если человек ещё никуда не нажал */
  if (first) setTimeout(() => { if (!document.activeElement || document.activeElement === document.body) first.focus(); }, 30);
}

/* глазок у пароля: показать / скрыть — меньше ошибок при наборе на телефоне */
function wirePwToggles(root) {
  $$('input[type=password]', root).forEach(i => {
    if (i.parentElement.classList.contains('pw-wrap')) return;
    const w = document.createElement('span');
    w.className = 'pw-wrap';
    i.replaceWith(w);
    w.appendChild(i);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pw-eye';
    b.setAttribute('aria-label', 'Показать пароль');
    b.innerHTML = icon('eye');
    b.onclick = () => {
      const show = i.type === 'password';
      i.type = show ? 'text' : 'password';
      b.innerHTML = icon(show ? 'eyeOff' : 'eye');
      b.setAttribute('aria-label', show ? 'Скрыть пароль' : 'Показать пароль');
      i.focus();
    };
    w.appendChild(b);
  });
}

/* смена пароля по ссылке: #reset=<учётка>.<код> */
function renderResetLink(root, param) {
  const [accId, code] = String(param || '').split('.');
  const acc = accId ? Store.get('accounts', accId) : null;
  const ok = acc && acc.reset && acc.reset.exp > Date.now();
  root.innerHTML = `<div class="auth one"><form class="auth-card card" id="rlForm" novalidate>
    <div class="auth-brand">${brandIcon('auth-mark')}<div><b>Eva Club</b><span>штаб команды Eva Space</span></div></div>
    ${ok ? `<h1>Новый пароль</h1><p class="auth-lead">${esc(acc.name)}, придумайте новый пароль — и сразу войдёте в штаб.</p>
      <input type="email" name="username" autocomplete="username" value="${esc(acc.email)}" hidden>
      <div class="auth-fields"><label class="field"><span>Новый пароль — от 6 символов</span><input class="input" id="rl-pw" type="password" autocomplete="new-password"></label>
        <label class="field"><span>Ещё раз</span><input class="input" id="rl-pw2" type="password" autocomplete="new-password"></label></div>
      <div class="auth-msg" id="rlMsg" hidden></div>
      <button class="btn primary auth-go" type="submit" id="rlGo">Сохранить пароль и войти</button>`
    : `<h1>Ссылка устарела</h1><p class="auth-lead">Ссылка для смены пароля действует сутки и только один раз. Попросите у основателя новую.</p>
      <div class="row"><button type="button" class="btn primary" data-rl-login>Ко входу</button></div>`}
  </form></div>`;
  on(root, 'click', '[data-rl-login]', () => { View.set('authMode', 'login'); location.hash = ''; App.render({force: true}); });
  const form = $('#rlForm', root);
  if (!ok) return;
  wirePwToggles(root);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('#rlMsg', root), pw = $('#rl-pw', root).value;
    if (pw !== $('#rl-pw2', root).value) { msg.textContent = 'Пароли не совпадают.'; msg.hidden = false; return; }
    try {
      await Auth.resetByLink(accId, code, pw);
      try { history.replaceState(null, '', '#home'); } catch (err) { location.hash = 'home'; }
      App.render({force: true});
      toast('Пароль изменён — вы в штабе');
    } catch (err) { msg.textContent = err.message || String(err); msg.hidden = false; }
  });
  setTimeout(() => { const i = $('#rl-pw', root); if (i) i.focus(); }, 30);
}
