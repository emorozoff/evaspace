/* Кто работает в CRM. В артефакте Claude человека узнаёт сама площадка
   (claude.use('user')): паролей нет, в команде хранится только его id,
   имя подтягивается из профиля при каждой отрисовке. Роль выдаёт
   руководитель в «⚙️ Настройках»; владелец артефакта — руководитель.
   Вне артефакта (GitHub Pages, локально) вы один — руководитель, данные
   живут в этом браузере.
   Новые люди проходят регистрацию: с кодом приглашения сразу попадают в
   команду, без кода — оставляют заявку, её подтверждает главная в CRM.
   Честно: роли разделяют интерфейс внутри команды. Граница доступа — сам
   артефакт: кому он открыт, тот может прочитать общую базу. */

const Who = {
  mode: 'local',
  uid: null,
  owner: false,
  canWrite: null,
  api: null,
  names: {},

  async init() {
    let u = null;
    try { u = window.claude && typeof window.claude.use === 'function' ? await window.claude.use('user') : null; } catch (e) { u = null; }
    if (!u) { this.mode = 'local'; this.uid = 'local'; this.owner = true; return; }
    this.api = u;
    this.mode = 'platform';
    try { this.uid = await u.id(); } catch (e) { this.uid = null; }
    try { this.owner = !!(await u.isOwner()); } catch (e) { this.owner = false; }
    try { this.canWrite = await u.can('data.write'); } catch (e) { this.canWrite = null; }
  },

  /* свои строки в команде: в платформе — по id, локально — 'local'.
     Если строк несколько (двойной первый вход), берём самую раннюю */
  mine() { return this.uid ? Store.all('team').filter(t => t.uid === this.uid && !t.archived).sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0)) : []; },
  self() { return this.mine()[0] || null; },
  status() { const m = this.self(); return m ? m.status || 'active' : null; },
  realRole() {
    const m = this.self();
    if (m) return m.status === 'pending' || m.status === 'rejected' ? (this.owner ? 'owner' : 'viewer') : roleOf(m.role);
    return this.owner ? 'owner' : 'viewer';
  },
  /* руководитель может посмотреть CRM глазами сотрудника */
  asId() { const a = View.get('as', null); return a && this.realRole() === 'owner' && Store.get('team', a) ? a : null; },
  member() { const a = this.asId(); return a ? Store.get('team', a) : this.self(); },
  id() { const m = this.member(); return m ? m.id : null; },
  role() {
    if (Store.state.readOnly || (this.mode === 'platform' && this.canWrite === false)) {
      const r = this.asId() ? roleOf(this.member().role) : this.realRole();
      return r === 'owner' ? r : 'viewer';
    }
    const a = this.asId();
    return a ? roleOf(Store.get('team', a).role) : this.realRole();
  },
  can(perm) { return (PERMS[perm] || []).includes(this.role()); },
  readOnly() { return Store.state.readOnly || (this.mode === 'platform' && this.canWrite === false); },
  /* открыл CRM, но ещё не в команде — показываем регистрацию */
  needsReg() { return this.mode === 'platform' && !!this.uid && !this.owner && !this.self() && Store.state.ready !== false; },

  /* первый вход владельца, порядок в команде и место главной */
  _added: false,
  _seeded: false,
  ensure() {
    if (!this.uid || this.readOnly()) return;
    const mine = this.mine();
    if (!mine.length && !this._added && (this.owner || this.mode === 'local')) {
      this._added = true;
      const hasOwner = Store.all('team').some(t => t.uid && roleOf(t.role) === 'owner' && !t.archived);
      const role = this.owner || !hasOwner ? 'owner' : 'member';
      Store.add('team', {uid: this.uid, name: this.mode === 'local' ? 'Вы' : '', role, status: 'active', joinedAt: Date.now(), order: role === 'owner' ? 0 : 20});
    }
    if (mine.length) this._added = true;
    if (this.realRole() !== 'owner') return;
    /* двойные строки одного человека: оставляем раннюю, людей переводим на неё */
    if (mine.length > 1) {
      const keep = mine[0];
      mine.slice(1).forEach(d => {
        Store.all('people').filter(p => p.owner === d.id).forEach(p => Store.patch('people', p.id, {owner: keep.id}));
        Store.remove('team', d.id);
      });
    }
    /* главная в CRM — один раз создаём её место с кодом приглашения */
    if (!this._seeded && Store.state.ready !== false) {
      this._seeded = true;
      const cfg = Store.get('cfg', 'team') || {};
      if (!cfg.headSeeded && !Store.all('team').some(t => t.head)) {
        Store.add('team', {name: TEAM_HEAD.name, title: TEAM_HEAD.title, role: 'owner', head: true, status: 'invited', code: Team.newCode(), groups: Object.keys(TYPES), invitedBy: this.id(), invitedAt: Date.now(), order: 0});
        Store.patch('cfg', 'team', {headSeeded: true, at: Date.now()});
      }
    }
  },

  /* регистрация: по коду — сразу в команду с ролью из приглашения,
     без кода — заявка, которую подтверждает главная */
  register({name, title, groups, tg, code}) {
    if (!this.uid) return {err: 'CRM не узнала вас — откройте её в Claude.'};
    if (this.readOnly()) return {err: 'У вас доступ к странице только на просмотр — регистрация не сохранится. Попросите владельца CRM открыть доступ «Может редактировать» через «Поделиться».'};
    if (!name.trim()) return {err: 'Напишите имя и фамилию.'};
    const now = Date.now();
    const base = {uid: this.uid, name: name.trim(), title: title.trim(), groups, tg: tg.trim(), joinedAt: now};
    const c = Team.normCode(code);
    if (c) {
      const row = Store.all('team').find(t => t.status === 'invited' && !t.uid && Team.normCode(t.code) === c);
      if (!row) return {err: 'Код не найден или уже использован. Проверьте его или отправьте заявку без кода.'};
      Store.patch('team', row.id, {...base, title: base.title || row.title || '', groups: groups.length ? groups : row.groups || [], status: 'active', code: null, usedCode: c});
      return {ok: true, status: 'active', role: roleOf(row.role), head: !!row.head};
    }
    Store.add('team', {...base, role: 'member', status: 'pending', order: 40});
    return {ok: true, status: 'pending'};
  },

  /* имена из профилей площадки: не храним, спрашиваем при отрисовке */
  _asked: new Set(),
  resolveNames(extra = []) {
    if (!this.api || typeof this.api.profiles !== 'function') return Promise.resolve();
    const ids = [...Store.all('team').map(t => t.uid), ...extra].filter(x => x && x !== 'local' && !this._asked.has(x));
    if (!ids.length) return Promise.resolve();
    ids.forEach(x => this._asked.add(x));
    return Promise.resolve(this.api.profiles(ids)).then(ps => {
      let changed = false;
      for (const id of ids) { const n = ps && ps[id] && ps[id].name; if (n && this.names[id] !== n) { this.names[id] = n; changed = true; } }
      if (changed) App.renderSoon();
    }).catch(() => {});
  },
};

/* ── команда ── */
const Team = {
  /* все строки — для страницы «Команда»; без отклонённых и удалённых */
  everyone() {
    return Store.all('team').filter(t => !t.archived && t.status !== 'rejected')
      .sort((a, b) => (b.head ? 1 : 0) - (a.head ? 1 : 0) || (a.order ?? 50) - (b.order ?? 50) || this.name(a).localeCompare(this.name(b), 'ru'));
  },
  /* кто в команде: без приглашённых, ещё не вошедших, и без заявок */
  all(withArchived = false) {
    return Store.all('team').filter(t => (withArchived || !t.archived) && !['invited', 'pending', 'rejected'].includes(t.status))
      .sort((a, b) => (a.order ?? 50) - (b.order ?? 50) || this.name(a).localeCompare(this.name(b), 'ru'));
  },
  pending() { return Store.all('team').filter(t => t.status === 'pending' && !t.archived).sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0)); },
  invited() { return Store.all('team').filter(t => t.status === 'invited' && !t.archived); },
  head() { return Store.all('team').find(t => t.head && !t.archived) || null; },
  headName() { const h = this.head(); return h ? `${this.name(h)}${h.title ? ', ' + h.title.toLowerCase() : ''}` : 'руководитель CRM'; },
  get(id) { return id ? Store.get('team', id) : null; },
  name(t) {
    if (!t) return 'Не назначен';
    return t.name || (t.uid && Who.names[t.uid]) || (t.uid === Who.uid ? 'Вы' : 'Сотрудник');
  },
  first(t) { return this.name(t).split(' ')[0]; },
  /* кому можно поручить клиентку */
  assignable() { return this.all().filter(t => ['owner', 'member'].includes(roleOf(t.role))); },
  av(t, cls = '') { return t ? avatar(this.name(t), cls, t.color || null) : avatar('', cls); },
  /* код приглашения: EVA-7KQ2 — без похожих букв и цифр */
  newCode() {
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let c;
    do { c = 'EVA-' + Array.from({length: 4}, () => abc[Math.floor(Math.random() * abc.length)]).join(''); } while (Store.all('team').some(t => t.code === c));
    return c;
  },
  normCode: s => { const x = String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); return x ? (x.startsWith('EVA') ? 'EVA-' + x.slice(3) : 'EVA-' + x) : ''; },
  /* текст приглашения: что открыть и какой код ввести */
  inviteText(t) {
    return `Привет! Приглашаю тебя в CRM команды Eva Space — там мы ведём кастдев клиенток, экспертов, партнёров и амбассадоров.

1. Открой CRM: ${LINKS.crm}
   Если пишет, что нет доступа, — напиши мне, я открою.
2. Нажми «Зарегистрироваться», впиши имя и код: ${t.code}

С кодом ты сразу попадёшь в команду с ролью «${ROLES[roleOf(t.role)].name}»${t.head ? ' и станешь главной в CRM' : ''}.`;
  },
};
const meName = () => Team.name(Who.member());
