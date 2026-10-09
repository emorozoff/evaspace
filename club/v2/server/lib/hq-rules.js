/* Права штаба на сервере: кто какую запись получает и кто что может менять.
   Роли и права — те же, что в src/app/01-config.js: там они решают, что
   показать на экране, здесь — что вообще уходит в браузер и что сервер
   согласится записать. Поменяли права в одном месте — поменяйте в другом. */

'use strict';
const {isObj} = require('./store');

const COLS = ['accounts', 'invites', 'people', 'tasks', 'ledger', 'plan', 'sales', 'links', 'docs', 'meetings', 'busy', 'messages',
  'subs', 'payouts', 'courses', 'orders', 'products', 'failed', 'refunds'];
const ROLES = ['owner', 'lead', 'finance', 'member', 'investor'];
const roleOf = r => (ROLES.includes(r) ? r : 'member');
const PERMS = {
  'tasks.view':     ['owner', 'lead', 'finance', 'member'],
  'tasks.manage':   ['owner', 'lead', 'finance'],
  'money.view':     ['owner', 'lead', 'finance', 'investor'],
  'money.edit':     ['owner', 'lead', 'finance'],
  'payroll.view':   ['owner', 'finance'],
  'fin.ops':        ['owner', 'lead', 'finance'],
  'sales.edit':     ['owner', 'lead', 'finance', 'member'],
  'strategy.check': ['owner', 'lead', 'finance'],
};
const can = (role, perm) => (PERMS[perm] || []).includes(role);

const omit = (o, keys) => { const out = {...o}; keys.forEach(k => { delete out[k]; }); return out; };
/* пароль и всё, по чему его можно подобрать или сбросить, — никогда не уходит в браузер */
const ACC_SECRET = ['salt', 'hash', 'reset'];
/* что человек может поправить в своей учётке сам */
const ACC_SELF = ['prefs', 'welcomed', 'welcomedAt', 'lastSeen'];
/* что в учётке меняет только основатель */
const ACC_OWNER = [...ACC_SELF, 'role', 'active', 'name', 'email', 'personId'];
/* поля карточки, которые человек не меняет себе сам */
const PERSON_LOCKED = ['salary', 'startMonth', 'rate', 'status', 'archived', 'founder', 'managerId', 'order', 'tgChatId'];
/* данные клиентов в финансовых записях — инвестору идут только суммы */
const CLIENT_FIELDS = ['client', 'customer', 'contact', 'address', 'comment', 'note', 'log', 'track', 'to', 'who', 'decision'];
/* инвестор команду не ведёт: ему от карточки и учётки — только кто это, без контактов и личного */
const PERSON_PUBLIC = ['name', 'givenName', 'surname', 'title', 'dir', 'status', 'order', 'founder', 'archived'];
const ACC_PUBLIC = ['name', 'role', 'personId', 'active'];
const pick = (o, keys) => Object.fromEntries(keys.filter(k => o[k] !== undefined).map(k => [k, o[k]]));
/* настройки денег — тем, кто денег не видит, не нужны */
const SETTINGS_MONEY = ['cashStart', 'cashDate', 'invest'];

const dmHas = (ch, accId) => String(ch).startsWith('dm:') && String(ch).slice(3).split('|').includes(accId);

/* что из записи увидит этот человек: документ (возможно, без части полей) или null */
function view(ctx, c, id, doc) {
  if (!doc) return null;
  const r = ctx.role;
  switch (c) {
    case 'accounts': return can(r, 'tasks.view') || id === ctx.accId ? omit(doc, ACC_SECRET) : pick(doc, ACC_PUBLIC);
    case 'invites': return r === 'owner' ? doc : null;
    case 'people':
      if (!can(r, 'tasks.view') && id !== ctx.personId) return pick(doc, PERSON_PUBLIC);
      return omit(doc, can(r, 'payroll.view') ? ['tgChatId'] : ['tgChatId', 'salary']);
    case 'tasks': case 'meetings': case 'busy': return can(r, 'tasks.view') ? doc : null;
    case 'messages':
      if (!can(r, 'tasks.view')) return null;
      return doc.ch === 'team' || dmHas(doc.ch, ctx.accId) ? doc : null;
    case 'ledger': case 'subs': case 'courses': case 'products': return can(r, 'money.view') ? doc : null;
    case 'plan':
      if (can(r, 'money.view')) return doc;
      /* команде — только строки бюджета задач: их заводит сама задача */
      return can(r, 'tasks.view') && (doc.taskId || id.startsWith('tb_')) ? doc : null;
    case 'orders': case 'payouts': case 'failed': case 'refunds':
      if (can(r, 'fin.ops')) return doc;
      return can(r, 'money.view') ? omit(doc, CLIENT_FIELDS) : null;
    case 'links': return r === 'owner' || !Array.isArray(doc.roles) || doc.roles.includes(r) ? doc : null;
    case 'docs': return id === 'settings' && !can(r, 'money.view') ? omit(doc, SETTINGS_MONEY) : doc;
    case 'sales': return doc;
    default: return null;
  }
}

const no = why => ({ok: false, why});
const yes = next => ({ok: true, next});
const onlyKeys = (body, allowed) => isObj(body) && Object.keys(body).every(k => allowed.includes(k));

/* можно ли записать. op: put | patch | delete; cur — что лежит сейчас,
   body — что прислали, next — что получится (для delete — null).
   Возвращает {ok, next} — next может быть поправлен (скрытые поля возвращаем на место). */
function write(ctx, op, c, id, cur, body, next) {
  const r = ctx.role, owner = r === 'owner';
  switch (c) {
    case 'accounts': {
      /* учётки создаёт и удаляет только сервер: вход, приглашение, сброс пароля */
      if (op !== 'patch' || !cur) return no('учётки меняются через вход и приглашения');
      if (Object.keys(body || {}).some(k => ACC_SECRET.includes(k))) return no('пароль меняется на своей странице');
      const self = id === ctx.accId;
      if (owner) {
        if (!onlyKeys(body, ACC_OWNER)) return no('это поле учётки менять нельзя');
        /* основатель не может сам себя разжаловать или отключить — иначе штаб останется без хозяина */
        if (self && ((body.role !== undefined && body.role !== 'owner') || body.active === false)) return no('нельзя снять права основателя с самого себя');
        if (body.role !== undefined && !ROLES.includes(body.role)) return no('нет такой роли');
        return yes(next);
      }
      return self && onlyKeys(body, ACC_SELF) ? yes(next) : no('чужую учётку меняет только основатель');
    }
    case 'invites': return owner ? yes(next) : no('приглашения выдаёт основатель');
    case 'people': {
      if (owner) return yes(next);
      if (op !== 'patch' || !cur || id !== ctx.personId) return no('чужую карточку меняет только основатель');
      if (Object.keys(body || {}).some(k => PERSON_LOCKED.includes(k))) return no('это поле карточки меняет основатель');
      return yes(next);
    }
    case 'tasks': case 'meetings': return can(r, 'tasks.view') ? yes(next) : no('нет доступа к задачам и собраниям');
    case 'busy':
      /* занятость — только своя */
      return can(r, 'tasks.view') && (owner || id === ctx.personId) ? yes(next) : no('занятость каждый ведёт свою');
    case 'messages': {
      if (!can(r, 'tasks.view')) return no('нет доступа к сообщениям');
      if (op === 'delete') return cur && (cur.by === ctx.accId || owner) ? yes(null) : no('удалить можно только своё сообщение');
      if (op !== 'put' || cur) return no('сообщения не редактируются');
      if (!isObj(body) || body.by !== ctx.accId || typeof body.text !== 'string' || body.text.length > 8000) return no('сообщение оформлено неверно');
      return body.ch === 'team' || dmHas(body.ch, ctx.accId) ? yes(next) : no('это не ваш диалог');
    }
    case 'plan': {
      const taskRow = d => !!d && d.group === 'once' && !!d.taskId;
      const payroll = d => !!d && d.group === 'payroll';
      /* зарплатные строки — только тем, кто видит зарплаты */
      if ((payroll(cur) || payroll(next)) && !can(r, 'payroll.view')) return no('зарплаты ведут основатель и финансы');
      if (can(r, 'money.edit')) return yes(next);
      /* команда: только строка бюджета своей задачи (tb_<id задачи>) */
      if (can(r, 'tasks.view') && (!cur || taskRow(cur)) && (op === 'delete' ? !!cur : taskRow(next))) return yes(next);
      return no('план платежей ведут основатель, руководитель и финансы');
    }
    case 'ledger': case 'subs': case 'courses': case 'products':
      return can(r, 'money.edit') ? yes(next) : no('деньги вносят основатель, руководитель и финансы');
    case 'orders': case 'payouts': case 'failed': case 'refunds':
      return can(r, 'fin.ops') ? yes(next) : no('заказы, выплаты и возвраты ведут основатель, руководитель и финансы');
    case 'sales':
      if (op === 'delete') return can(r, 'tasks.manage') ? yes(null) : no('день удаляет руководитель');
      return can(r, 'sales.edit') ? yes(next) : no('цифры продаж вносит команда');
    case 'links': return owner ? yes(next) : no('свои материалы добавляет основатель');
    case 'docs':
      if (owner) return yes(next);
      /* отмечать пункты целей могут руководитель и финансы; остальное в стратегии и настройках — основатель */
      if (id === 'strategy' && op === 'patch' && cur && can(r, 'strategy.check')) return yes(next);
      return no('стратегию и настройки меняет основатель');
    default: return no('нет такой коллекции');
  }
}

/* поля, которые человек не видит, при его записи остаются как были */
function keepHidden(ctx, c, id, cur, next) {
  if (!cur || !next) return next;
  const seen = view(ctx, c, id, cur);
  if (!seen) return next;
  const out = {...next};
  Object.keys(cur).forEach(k => { if (!(k in seen)) out[k] = cur[k]; });
  return out;
}

module.exports = {COLS, ROLES, roleOf, can, view, write, keepHidden, ACC_SECRET};
