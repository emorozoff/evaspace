/* Вход по ролям. У каждого человека своя учётка; роль решает меню и права.
   Пароль хранится только как PBKDF2-SHA256 (150 000 итераций) с солью —
   тем же способом, что в первой версии, поэтому старые пароли подходят.
   Честно: это разделение кабинетов внутри команды, а не сейф — общая база
   читается всеми, у кого есть доступ к штабу. */

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
  me() {
    /* window.__EVA_AS — только для проверок: две вкладки под разными людьми */
    const id = window.__EVA_AS || Local.get(SESSION_KEY, null);
    const a = id ? Store.get('accounts', id) : null;
    return a && a.active !== false ? a : null;
  },
  role() { const a = this.me(); return a ? roleOf(a.role) : null; },
  person() { const a = this.me(); return a ? personById(a.personId) : null; },
  personId() { const a = this.me(); return a ? a.personId || null : null; },
  can(perm) { const r = this.role(); return !!r && (PERMS[perm] || []).includes(r); },
  isOwner() { return this.role() === 'owner'; },

  start(acc) {
    Local.set(SESSION_KEY, acc.id);
    if (!acc.lastSeen || Date.now() - acc.lastSeen > 3600e3) Store.patch('accounts', acc.id, {lastSeen: Date.now()});
  },
  logout() { Local.del(SESSION_KEY); window.__EVA_AS = null; App.render(); },

  findByEmail(email) { const e = normEmail(email); return Store.all('accounts').find(a => normEmail(a.email) === e) || null; },

  async login(email, pw) {
    const acc = this.findByEmail(email);
    if (!acc) throw new Error('Нет учётки с такой почтой. Если вас пригласили — войдите по коду приглашения.');
    if (acc.active === false) throw new Error('Учётка отключена. Напишите основателю.');
    if ((await hashPassword(pw, acc.salt)) !== acc.hash) throw new Error('Пароль не подошёл. Проверьте раскладку или попросите у основателя код сброса.');
    this.start(acc);
  },

  async createAccount({name, email, pw, role, personId}) {
    if (!name.trim()) throw new Error('Напишите имя и фамилию.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) throw new Error('Почта выглядит неправильно.');
    if (pw.length < 6) throw new Error('Пароль — не короче 6 символов.');
    if (this.findByEmail(email)) throw new Error('Эта почта уже зарегистрирована — просто войдите.');
    const salt = randSalt();
    const acc = {name: name.trim(), email: normEmail(email), role, personId: personId || null,
      salt, hash: await hashPassword(pw, salt), active: true, createdAt: Date.now(), lastSeen: Date.now()};
    const id = Store.add('accounts', acc);
    return {...acc, id};
  },

  /* первый вход в пустой штаб — учётка основателя и его карточка в команде */
  async createOwner(f) {
    if (Store.count('accounts')) throw new Error('Штаб уже создан — войдите своей почтой.');
    let pid = (people().find(p => p.founder) || {}).id;
    if (!pid) pid = Store.add('people', {name: f.name.trim(), title: 'Основатель', dir: 'ops', founder: true, order: 0});
    const acc = await this.createAccount({...f, role: 'owner', personId: pid});
    if (!personById(pid).name) Store.patch('people', pid, {name: f.name.trim()});
    this.start(acc);
  },

  async acceptInvite(f) {
    const code = normCode(f.code);
    const inv = Store.get('invites', code);
    if (!inv || inv.usedBy) throw new Error('Код не найден или уже использован. Попросите у основателя новый.');
    let pid = inv.personId;
    if (!pid || !personById(pid)) pid = Store.add('people', {name: f.name.trim(), title: inv.title || '', dir: inv.dir || '', order: 50});
    const acc = await this.createAccount({...f, role: roleOf(inv.role), personId: pid});
    const p = personById(pid);
    if (p && !p.name) Store.patch('people', pid, {name: f.name.trim()});
    Store.patch('invites', code, {usedBy: acc.id, usedAt: Date.now()});
    this.start(acc);
  },

  async resetWithCode(f) {
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
    const code = makeCode(), salt = randSalt();
    await Store.patch('accounts', accId, {reset: {salt, hash: await hashPassword(normCode(code), salt), exp: Date.now() + 864e5}});
    return code;
  },
};

/* ── экран входа ── */
function renderAuth(root) {
  const empty = !Store.count('accounts');
  let mode = empty ? 'owner' : View.get('authMode', 'login');
  if (mode === 'owner' && !empty) mode = 'login';

  const titles = {
    owner:  ['Создайте штаб', 'Вы первый: эта учётка станет учёткой основателя. Команду пригласите кодами из раздела «Команда».'],
    login:  ['Вход в штаб', 'Почта и пароль, которые вы задали при регистрации.'],
    invite: ['Вход по приглашению', 'Код выдаёт основатель. Роль и кабинет подставятся сами.'],
    reset:  ['Новый пароль', 'Попросите у основателя код сброса — он действует сутки.'],
  };
  const fields = {
    owner:  ['name', 'email', 'pw', 'pw2'],
    login:  ['email', 'pw'],
    invite: ['code', 'name', 'email', 'pw', 'pw2'],
    reset:  ['email', 'code', 'pw', 'pw2'],
  };
  const F = {
    name:  '<label class="field"><span>Имя и фамилия</span><input class="input" id="a-name" autocomplete="name" placeholder="Анна Смирнова"></label>',
    email: '<label class="field"><span>Почта</span><input class="input" id="a-email" type="email" autocomplete="email" placeholder="name@mail.ru"></label>',
    pw:    `<label class="field"><span>${mode === 'login' ? 'Пароль' : 'Пароль (от 6 символов)'}</span><input class="input" id="a-pw" type="password" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}"></label>`,
    pw2:   '<label class="field"><span>Пароль ещё раз</span><input class="input" id="a-pw2" type="password" autocomplete="new-password"></label>',
    code:  `<label class="field"><span>${mode === 'reset' ? 'Код сброса' : 'Код приглашения'}</span><input class="input auth-code" id="a-code" autocomplete="one-time-code" placeholder="ABCD-2345"></label>`,
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
      <div class="auth-brand">${starSvg('auth-mark')}<div><b>Eva Club</b><span>штаб команды Eva Space · V2</span></div></div>
      ${tabs}
      <h1>${title}</h1>
      <p class="auth-lead">${lead}</p>
      <div class="auth-msg" id="authMsg" hidden></div>
      <div class="auth-fields">${fields[mode].map(k => F[k]).join('')}</div>
      <button class="btn primary auth-go" type="submit" id="authGo">${mode === 'owner' ? 'Создать штаб' : mode === 'invite' ? 'Войти и получить кабинет' : mode === 'reset' ? 'Сохранить пароль и войти' : 'Войти'}</button>
      <div class="auth-links">
        ${mode === 'login' ? '<button type="button" class="link-btn" data-mode="reset">Забыли пароль?</button>' : ''}
        ${mode === 'reset' ? '<button type="button" class="link-btn" data-mode="login">Вернуться ко входу</button>' : ''}
      </div>
      <p class="auth-note">Не используйте пароль от почты или банка: вход разделяет кабинеты внутри команды, а данные штаба видят все, кому открыт доступ к нему.</p>
    </form>
    <aside class="auth-side">
      <p class="label">Кто что видит</p>
      <ul class="auth-roles">${roles}</ul>
      <p class="note">Роль назначает основатель, когда выдаёт код приглашения. Поменять её можно в разделе «Команда».</p>
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
    if (fields[mode].includes('pw2') && f.pw !== val('a-pw2')) { msg.textContent = 'Пароли не совпадают.'; msg.hidden = false; return; }
    const go = $('#authGo', root);
    go.disabled = true;
    go.textContent = 'Проверяю…';
    try {
      if (mode === 'owner') await Auth.createOwner(f);
      else if (mode === 'invite') await Auth.acceptInvite(f);
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
  const first = $('input', form);
  if (first) setTimeout(() => first.focus(), 30);
}