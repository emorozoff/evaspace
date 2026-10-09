/* Права Eva CRM на сервере. В артефакте CRM узнавала человека по аккаунту
   Claude, здесь — по учётке штаба: вход один на оба приложения. Роль в CRM
   лежит в её собственной команде (team/<id>.role), как и раньше; строка
   команды привязана к учётке полем uid. */

'use strict';
const {isObj} = require('./store');

const COLS = ['team', 'people', 'cfg'];
const ROLES = ['owner', 'member', 'viewer'];
const roleOf = r => (ROLES.includes(r) ? r : 'member');

/* роль в CRM: своя строка в команде; без строки основатель штаба — руководитель, остальные смотрят */
function crmRole(store, accId, hqOwner) {
  const row = Object.values(store.col('team')).find(t => t && t.uid === accId && !t.archived);
  if (row) return roleOf(row.role);
  return hqOwner ? 'owner' : 'viewer';
}

/* читают все, кого пустили в CRM */
const view = (ctx, c, id, doc) => doc || null;

const no = why => ({ok: false, why});
const yes = next => ({ok: true, next});

function write(ctx, op, c, id, cur, body, next, store) {
  const r = ctx.crmRole, owner = r === 'owner', edit = owner || r === 'member';
  switch (c) {
    case 'team': {
      if (owner) return yes(next);
      /* первый вход: человек заводит себе строку — одну, свою, с ролью «Команда» */
      const mine = Object.values(store.col('team')).some(t => t && t.uid === ctx.accId && !t.archived);
      if (op === 'put' && !cur && !mine && isObj(body) && body.uid === ctx.accId && roleOf(body.role) === 'member' && body.role === 'member') return yes(next);
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

module.exports = {COLS, ROLES, roleOf, crmRole, view, write, keepHidden};
