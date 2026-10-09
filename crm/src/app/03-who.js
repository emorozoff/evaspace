/* Кто работает в CRM. В артефакте Claude человека узнаёт сама площадка
   (claude.use('user')): паролей нет, в команде хранится только его id,
   имя подтягивается из профиля при каждой отрисовке. Роль выдаёт
   руководитель в «Настройках → Команда»; владелец артефакта — руководитель.
   Вне артефакта (GitHub Pages, локально) вы один — руководитель, данные
   живут в этом браузере.
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

  /* своя строка в команде: в платформе — по id, локально — 'local' */
  self() { return this.uid ? Store.all('team').find(t => t.uid === this.uid && !t.archived) || null : null; },
  realRole() {
    const m = this.self();
    if (m) return roleOf(m.role);
    return this.owner ? 'owner' : 'viewer';
  },
  /* руководитель может посмотреть CRM глазами сотрудника */
  asId() { const a = View.get('as', null); return a && this.realRole() === 'owner' && Store.get('team', a) ? a : null; },
  member() { const a = this.asId(); return a ? Store.get('team', a) : this.self(); },
  id() { const m = this.member(); return m ? m.id : null; },
  role() {
    if (Store.state.readOnly || (this.mode === 'platform' && this.canWrite === false)) {
      const r = this.asId() ? roleOf(this.member().role) : this.realRole();
      return r === 'owner' || r === 'lead' ? r : 'viewer';
    }
    const a = this.asId();
    return a ? roleOf(Store.get('team', a).role) : this.realRole();
  },
  can(perm) { return (PERMS[perm] || []).includes(this.role()); },
  readOnly() { return Store.state.readOnly || (this.mode === 'platform' && this.canWrite === false); },

  /* первый вход: заводим строку в команде */
  ensure() {
    if (!this.uid || this.self()) return;
    if (this.readOnly()) return;
    const hasOwner = Store.all('team').some(t => t.uid && roleOf(t.role) === 'owner' && !t.archived);
    const role = this.owner || (this.mode === 'local' && !hasOwner) ? 'owner' : 'manager';
    Store.add('team', {uid: this.uid, name: this.mode === 'local' ? 'Вы' : '', role, title: role === 'owner' ? 'Руководитель' : 'Менеджер', joinedAt: Date.now(), order: role === 'owner' ? 0 : 20});
  },

  /* имена из профилей площадки: не храним, спрашиваем при отрисовке */
  _asked: new Set(),
  resolveNames() {
    if (!this.api || typeof this.api.profiles !== 'function') return;
    const ids = Store.all('team').map(t => t.uid).filter(x => x && x !== 'local' && !this._asked.has(x));
    if (!ids.length) return;
    ids.forEach(x => this._asked.add(x));
    Promise.resolve(this.api.profiles(ids)).then(ps => {
      let changed = false;
      for (const id of ids) { const n = ps && ps[id] && ps[id].name; if (n && this.names[id] !== n) { this.names[id] = n; changed = true; } }
      if (changed) App.renderSoon();
    }).catch(() => {});
  },
};

/* ── команда ── */
const Team = {
  all(withArchived = false) {
    return Store.all('team').filter(t => withArchived || !t.archived)
      .sort((a, b) => (a.order ?? 50) - (b.order ?? 50) || this.name(a).localeCompare(this.name(b), 'ru'));
  },
  get(id) { return id ? Store.get('team', id) : null; },
  name(t) {
    if (!t) return 'Не назначен';
    return t.name || (t.uid && Who.names[t.uid]) || (t.uid === Who.uid ? 'Вы' : 'Сотрудник');
  },
  first(t) { return this.name(t).split(' ')[0]; },
  /* кому можно поручить клиентку */
  assignable() { return this.all().filter(t => ['owner', 'lead', 'manager', 'curator'].includes(roleOf(t.role))); },
  av(t, cls = '') { return t ? avatar(this.name(t), cls, t.color || null) : avatar('', cls); },
};
const meName = () => Team.name(Who.member());
