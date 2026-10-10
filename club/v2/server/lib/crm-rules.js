/* Права Eva CRM на сервере. В артефакте CRM узнавала человека по аккаунту
   Claude, здесь — по учётке штаба: вход один на оба приложения. Роль в CRM
   лежит в её собственной команде (team/<id>.role), как и раньше; строка
   команды привязана к учётке полем uid. */

'use strict';
const {isObj} = require('./store');

const COLS = ['team', 'people', 'cfg'];
const ROLES = ['owner', 'member', 'viewer'];
const roleOf = r => (ROLES.includes(r) ? r : 'member');
/* строка команды: invited — место по коду приглашения, pending — заявка ждёт
   подтверждения главной, rejected — заявку отклонили; пусто или active — в команде */
const WAITING = ['pending', 'rejected'];
/* что человек меняет в своей строке сам («Мой профиль»); роль, статус и место главной — руководитель */
const PROFILE = ['name', 'title', 'tg', 'groups'];
const normCode = s => { const x = String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); return x ? 'EVA-' + (x.startsWith('EVA') ? x.slice(3) : x) : ''; };

/* роль в CRM: своя строка в команде; без строки основатель штаба — руководитель, остальные смотрят.
   Заявка, которую ещё не подтвердили, прав не даёт. */
function crmRole(store, accId, hqOwner) {
  const rows = Object.values(store.col('team')).filter(t => t && t.uid === accId && !t.archived);
  const row = rows.find(t => !WAITING.includes(t.status)) || null;
  if (row) return roleOf(row.role);
  return hqOwner ? 'owner' : 'viewer';
}

/* читают все, кого пустили в CRM; коды приглашений — только руководитель:
   иначе любой из команды занял бы чужое место (например, место главной) */
const view = (ctx, c, id, doc) => {
  if (!doc) return null;
  if (c === 'team' && doc.code && ctx.crmRole !== 'owner') { const {code, ...rest} = doc; return rest; }
  return doc;
};
const sameBut = (a, b, keys) => {
  const strip = o => JSON.stringify(Object.keys(o || {}).filter(k => !keys.includes(k)).sort().map(k => [k, o[k]]));
  return strip(a) === strip(b);
};

const no = why => ({ok: false, why});
const yes = next => ({ok: true, next});

function write(ctx, op, c, id, cur, body, next, store) {
  const r = ctx.crmRole, owner = r === 'owner', edit = owner || r === 'member';
  switch (c) {
    case 'team': {
      if (owner) return yes(next);
      /* первый вход: заявка в команду — одна, своя, с ролью «Команда»; права появятся,
         когда её подтвердит главная или руководитель */
      const mine = Object.values(store.col('team')).some(t => t && t.uid === ctx.accId && !t.archived);
      if (op === 'put' && !cur && !mine && isObj(body) && body.uid === ctx.accId && body.role === 'member' && body.status === 'pending' && !body.head && !body.code) return yes(next);
      /* свой профиль: имя, должность, Telegram, с кем работает */
      if (op === 'patch' && cur && cur.uid === ctx.accId && !cur.archived && sameBut(cur, next, PROFILE)) return yes(next);
      return no('команду CRM ведёт руководитель');
    }
    case 'people':
      if (op === 'delete') return owner ? yes(null) : no('удаляет карточки руководитель');
      return edit ? yes(next) : no('у вас в CRM доступ только на просмотр');
    case 'cfg':
      if (/^q_[a-z]+$/.test(id)) return edit ? yes(next) : no('вопросы правит команда CRM');
      return owner ? yes(next) : no('настройки CRM меняет руководитель');
    default: return no('нет такой коллекции');
  }
}
const keepHidden = (ctx, c, id, cur, next) => next;

/* вход в команду по коду приглашения: место с этим кодом становится строкой этой учётки.
   Код проверяет сервер — в браузер коды не попадают никому, кроме руководителя. */
function join(store, ctx, b) {
  if (!isObj(b)) return no('нужен объект');
  const code = normCode(b.code);
  const rows = store.col('team');
  const own = Object.entries(rows).filter(([, t]) => t && t.uid === ctx.accId && !t.archived);
  if (own.some(([, t]) => !WAITING.includes(t.status))) return no('Вы уже в команде CRM — роль меняет руководитель в разделе «Команда».');
  const hit = code && Object.entries(rows).find(([, t]) => t && t.status === 'invited' && !t.uid && !t.archived && normCode(t.code) === code);
  if (!hit) return no('Код не найден или уже использован. Проверьте его или отправьте заявку без кода.');
  const [id, row] = hit;
  const str = (v, n) => String(v || '').trim().slice(0, n);
  const groups = Array.isArray(b.groups) ? b.groups.filter(g => typeof g === 'string' && g.length < 20).slice(0, 8) : [];
  const next = {...row, uid: ctx.accId, status: 'active', code: null, usedCode: code, joinedAt: Date.now(),
    name: str(b.name, 120) || row.name || '', title: str(b.title, 120) || row.title || '', tg: str(b.tg, 64) || row.tg || '',
    groups: groups.length ? groups : row.groups || []};
  /* своя заявка без кода больше не нужна — место из приглашения важнее */
  own.forEach(([rid]) => store.set('team', rid, null));
  store.set('team', id, next);
  return {ok: true, id, role: roleOf(row.role), head: !!row.head};
}

module.exports = {COLS, ROLES, roleOf, crmRole, view, write, keepHidden, join, normCode};
