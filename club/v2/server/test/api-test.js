/* Проверка сервера штаба и CRM через его же адреса: вход, роли, что кому видно. */
'use strict';
const http = require('http');
const BASE = process.env.BASE || 'http://localhost:8787';   // сервер на ПУСТЫХ данных: DATA_DIR=$(mktemp -d) PORT=8787 INSECURE_COOKIE=1 node server.js
let pass = 0, failN = 0;
const ok = (cond, name, extra) => { if (cond) pass++; else { failN++; console.log('  ✗', name, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ''); } };

class Client {
  /* base — другой сервер (бот проверяется на своём), bearer — ключ бота вместо входа */
  constructor(name, base = BASE, bearer = '') { this.name = name; this.cookie = ''; this.base = base; this.bearer = bearer; }
  async req(method, path, body, {raw = false, noHeader = false} = {}) {
    const headers = {'content-type': 'application/json'};
    if (!noHeader) headers['x-eva'] = '1';
    if (this.cookie) headers.cookie = this.cookie;
    if (this.bearer) headers.authorization = 'Bearer ' + this.bearer;
    const r = await fetch(this.base + path, {method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual'});
    const sc = r.headers.get('set-cookie');
    if (sc) { const m = /eva_sid=([^;]*)/.exec(sc); if (m) this.cookie = m[1] ? 'eva_sid=' + m[1] : ''; }
    if (raw) return {status: r.status, text: await r.text(), headers: r.headers};
    let j = null;
    try { j = await r.json(); } catch (e) { /* пусто */ }
    return {status: r.status, j: j || {}};
  }
  get(p) { return this.req('GET', p); }
  put(c, id, b, api = '/api') { return this.req('PUT', `${api}/doc/${c}/${encodeURIComponent(id)}`, b); }
  patch(c, id, b, api = '/api') { return this.req('PATCH', `${api}/doc/${c}/${encodeURIComponent(id)}`, b); }
  del(c, id, api = '/api') { return this.req('DELETE', `${api}/doc/${c}/${encodeURIComponent(id)}`); }
  async state(api = '/api') { return (await this.get(api + '/state')).j; }
  /* поток событий: собираем сообщения в массив */
  listen(api = '/api') {
    const msgs = [];
    const u = new URL(BASE + api + '/events');
    const req = http.get({host: u.hostname, port: u.port, path: u.pathname, headers: {cookie: this.cookie}}, res => {
      res.setEncoding('utf8');
      let buf = '';
      res.on('data', ch => { buf += ch; let i; while ((i = buf.indexOf('\n\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 2); if (line.startsWith('data: ')) msgs.push(JSON.parse(line.slice(6))); } });
    });
    return {msgs, close: () => req.destroy()};
  }
}
const wait = ms => new Promise(r => setTimeout(r, ms));
/* отпечаток пароля так, как его считает браузер (WebCrypto) — старые учётки должны войти */
async function browserHash(pw, salt) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name: 'PBKDF2', salt: enc.encode(salt), iterations: 150000, hash: 'SHA-256'}, key, 256);
  return 'pbkdf2$' + Buffer.from(bits).toString('base64');
}

(async () => {
  const anon = new Client('anon'), owner = new Client('owner'), member = new Client('member'), investor = new Client('investor'), lead = new Client('lead');

  console.log('1. без входа');
  let s = await anon.state();
  ok(s.me === null && s.empty === true && Object.keys(s.collections).length === 0, 'пустой штаб: ничего не отдаёт', s);
  ok((await anon.put('tasks', 't0', {title: 'x'})).status === 401, 'запись без входа — 401');
  ok((await anon.get('/api/events')).status === 401, 'события без входа — 401');
  ok((await anon.get('/api/export')).status === 401, 'выгрузка без входа — 401');
  ok((await anon.get('/crm/api/state')).status === 401, 'CRM без входа — 401');

  console.log('2. основатель создаёт штаб');
  let r = await owner.req('POST', '/api/auth/owner', {name: 'Тест Основатель', email: 'Owner@Test.ru', pw: 'secret1'});
  ok(r.status === 200 && r.j.me, 'учётка основателя создана', r);
  const ownerId = r.j.me;
  ok((await anon.req('POST', '/api/auth/owner', {name: 'Вор', email: 'thief@test.ru', pw: 'secret1'})).status === 400, 'второго основателя создать нельзя');
  s = await owner.state();
  const oacc = s.collections.accounts[ownerId];
  ok(oacc && !('hash' in oacc) && !('salt' in oacc), 'отпечаток пароля в браузер не уходит', oacc);
  ok((await owner.req('PUT', '/api/doc/tasks/tx', {title: 'x'}, {noHeader: true})).status === 403, 'запись без заголовка страницы — 403');
  const ownerPid = oacc.personId;

  console.log('3. основатель наполняет');
  ok((await owner.put('people', 'p1', {name: '', title: 'SMM', dir: 'content', salary: 120000, status: 'vacancy', phone: '+7900'})).status === 200, 'карточка человека');
  ok((await owner.put('invites', 'ABCD-2345', {role: 'member', personId: 'p1', by: ownerId, at: Date.now()})).status === 200, 'приглашение');
  ok((await owner.put('invites', 'INVE-2222', {role: 'investor', by: ownerId, at: Date.now()})).status === 200, 'приглашение инвестору');
  ok((await owner.put('invites', 'LEAD-3333', {role: 'lead', by: ownerId, at: Date.now()})).status === 200, 'приглашение руководителю');
  await owner.put('ledger', 'l1', {kind: 'out', amount: 5000, cat: 'office', date: '2026-10-01'});
  await owner.put('plan', 'pay_p1', {title: 'SMM', group: 'payroll', cat: 'payroll', amount: 120000, months: ['2026-10'], personId: 'p1', insurance: true});
  await owner.put('plan', 'reg1', {title: 'Офис', group: 'regular', cat: 'office', amount: 30000, months: ['2026-10']});
  await owner.put('tasks', 't1', {title: 'Задача', status: 'todo', budget: 1000});
  ok((await owner.put('protocols', 'pr1', {title: 'Только основатели', level: 1, date: '2026-10-19', text: 'опционы', people: [], ok: {}})).status === 200, 'протокол ур. 1');
  ok((await owner.put('protocols', 'pr2', {title: 'С инвесторами', level: 2, date: '2026-10-19', text: 'раунд', people: [], ok: {}})).status === 200, 'протокол ур. 2');
  ok((await owner.put('protocols', 'pr3', {title: 'Для всех', level: 3, date: '2026-10-19', text: 'план', people: [], ok: {}})).status === 200, 'протокол ур. 3');
  ok((await owner.put('meetings', 'mt1', {title: 'Совет основателей', level: 1, date: '2026-10-20', start: '17:00', dur: 60})).status === 200, 'собрание ур. 1');
  ok((await owner.put('meetings', 'mt3', {title: 'Созвон команды', date: '2026-10-20', start: '11:00', dur: 60})).status === 200, 'собрание без уровня');
  ok((await owner.put('scenarios', 'sc1', {name: 'УСН 6%', p: {taxMode: 'income', tax: 6}})).status === 200, 'сценарий');
  await owner.put('docs', 'settings', {price: 2900, cashStart: 777, cashDate: '2026-09-01', invest: {'2026-11': 1},
    rates: {insurance: [{from: '', label: 'до регистрации', steps: [{upTo: null, rate: 0}]}, {from: '2026-11', label: 'ООО', steps: [{upTo: 2400000, rate: 0.3}, {upTo: null, rate: 0.15}]}]}});
  await owner.put('orders', 'o1', {no: 1, customer: 'Клиентка', contact: '+7911', address: 'Москва', items: [{title: 'Свеча', qty: 1, price: 900}], pay: 'paid'});
  await owner.put('refunds', 'rf1', {client: 'Анна', contact: 'a@a.ru', amount: 2900, status: 'new', comment: 'не подошло'});
  await owner.put('links', 'lk1', {title: 'Только команде', url: 'https://x.ru', roles: ['owner', 'lead', 'finance', 'member']});
  await owner.put('sales', '2026-10-01', {pays: 3, regs: 40});

  console.log('4. приглашение до входа');
  s = await anon.get('/api/state?join=abcd2345');
  const pk = s.j.collections;
  ok(pk.invites && pk.invites['ABCD-2345'] && pk.invites['ABCD-2345'].role === 'member', 'по коду видно приглашение', pk);
  ok(pk.people && pk.people.p1 && !('salary' in pk.people.p1), 'в анкете нет оклада', pk.people);
  ok(!pk.tasks && !pk.ledger, 'по коду больше ничего не отдаётся');
  ok(Object.keys((await anon.get('/api/state?join=ZZZZ-9999')).j.collections).length === 0, 'по чужому коду — пусто');

  console.log('5. регистрация по приглашениям');
  r = await member.req('POST', '/api/auth/join', {code: 'ABCD-2345', given: 'Маша', surname: 'Команда', email: 'member@test.ru', pw: 'member1', phone: '+7922', title: 'SMM'});
  ok(r.status === 200 && r.j.me, 'участница зарегистрировалась', r);
  const memberId = r.j.me, memberPid = 'p1';   // приглашение ABCD-2345 — на карточку p1
  ok((await anon.req('POST', '/api/auth/join', {code: 'ABCD-2345', given: 'Вор', surname: 'Вор', email: 'x@test.ru', pw: 'xxxxxx'})).status === 400, 'приглашение одноразовое');
  r = await investor.req('POST', '/api/auth/join', {code: 'INVE-2222', given: 'Иван', surname: 'Инвестор', email: 'inv@test.ru', pw: 'invest1'});
  const investorId = r.j.me;
  ok(r.status === 200, 'инвестор зарегистрировался');
  r = await lead.req('POST', '/api/auth/join', {code: 'LEAD-3333', given: 'Лена', surname: 'Лид', email: 'lead@test.ru', pw: 'leader1'});
  const leadId = r.j.me;
  ok(r.status === 200, 'руководитель зарегистрировался');
  ok((await anon.req('POST', '/api/auth/join', {code: 'LEAD-3333', given: 'A', surname: 'B', email: 'member@test.ru', pw: 'xxxxxx'})).status === 400, 'повторная почта не проходит');

  console.log('6. что видит участница');
  s = await member.state();
  const mc = s.collections;
  ok(s.me === memberId, 'сервер знает, кто вошёл');
  ok(Object.keys(mc.invites).length === 0, 'приглашений не видит', mc.invites);
  ok(Object.keys(mc.ledger).length === 0, 'операций не видит', mc.ledger);
  ok(Object.keys(mc.plan).length === 0, 'плана платежей и зарплат не видит', mc.plan);
  ok(Object.keys(mc.orders).length === 0 && Object.keys(mc.refunds).length === 0, 'заказов и возвратов не видит');
  ok(Object.keys(mc.scenarios).length === 0, 'сценариев не видит', mc.scenarios);
  ok(!mc.protocols.pr1 && !mc.protocols.pr2 && mc.protocols.pr3, 'протоколы — только уровня 3', Object.keys(mc.protocols));
  ok(!mc.meetings.mt1 && mc.meetings.mt3, 'собрание уровня 1 не видит, обычное — да', Object.keys(mc.meetings));
  ok(mc.people.p1 && mc.people.p1.name === 'Маша Команда' && !('salary' in mc.people.p1), 'карточку видит, оклад — нет', mc.people.p1);
  ok(mc.people.p1.status === 'active', 'вакансия закрылась');
  ok(Object.values(mc.accounts).every(a => !('hash' in a) && !('salt' in a) && !('reset' in a)), 'ни одного отпечатка пароля');
  ok(mc.docs.settings && mc.docs.settings.price === 2900 && !('cashStart' in mc.docs.settings), 'настройки без денег на счёте', mc.docs.settings);
  ok(!('rates' in mc.docs.settings), 'ставки взносов и налогов команде не уходят', mc.docs.settings);
  ok(mc.tasks.t1 && mc.sales['2026-10-01'] && mc.links.lk1, 'задачи, цифры и материалы видит');

  console.log('7. что может участница');
  ok((await member.put('tasks', 't2', {title: 'Моя', status: 'todo'})).status === 200, 'задачу создать — да');
  ok((await member.put('ledger', 'l2', {kind: 'in', amount: 1})).status === 403, 'операцию внести — нет');
  /* файлы к задаче: приложить, открыть, кто видит */
  const png = 'data:image/png;base64,' + Buffer.from('PNGDATA').toString('base64');
  ok((await member.put('files', 'f1', {task: 't1', where: 'outcome', name: 'скрин.png', type: 'image/png', size: 7, data: png, by: memberPid, at: 1})).status === 200, 'файл к задаче приложить — да');
  ok((await member.put('files', 'f2', {task: 'нет-такой', where: 'thread', name: 'x.png', type: 'image/png', size: 7, data: png})).status === 403, 'файл к чужой несуществующей задаче — нет');
  ok((await member.put('files', 'f3', {task: 't1', where: 'thread', name: 'x', data: 'javascript:alert(1)'})).status === 403, 'не файл — нет');
  ok((await member.put('files', 'f4', {task: 't1', where: 'thread', name: 'big', data: 'data:image/png;base64,' + 'A'.repeat(7200000)})).status !== 200, 'больше 5 МБ — нет');
  ok((await member.put('files', 'f1', {task: 't1', where: 'outcome', name: 'подмена', data: png})).status === 403, 'файл заменить — нет');
  r = await member.state();
  ok(r.collections.files.f1 && !('data' in r.collections.files.f1) && r.collections.files.f1.acc === memberId, 'в списке — без содержимого, с автором', r.collections.files.f1);
  r = await member.req('GET', '/api/file/f1', undefined, {raw: true});
  ok(r.status === 200 && r.text === 'PNGDATA' && r.headers.get('content-type') === 'image/png' && /inline/.test(r.headers.get('content-disposition')) && /sandbox/.test(r.headers.get('content-security-policy') || ''), 'файл открывается', r.status);
  await member.put('files', 'f5', {task: 't1', where: 'thread', name: 'page.html', type: 'text/html', size: 5, data: 'data:text/html;base64,' + Buffer.from('<b>x</b>').toString('base64')});
  r = await member.req('GET', '/api/file/f5', undefined, {raw: true});
  ok(r.status === 200 && r.headers.get('content-type') === 'application/octet-stream' && /attachment/.test(r.headers.get('content-disposition')), 'HTML не открывается страницей — только скачать', r.headers.get('content-type'));
  ok((await anon.req('GET', '/api/file/f1', undefined, {raw: true})).status === 401, 'без входа файл не отдаётся');
  ok((await member.del('files', 'f5')).status === 200, 'свой файл удалить — да');
  ok((await member.put('scenarios', 'sc3', {name: 'x', p: {}})).status === 403, 'сценарий сохранить — нет');
  ok((await member.patch('protocols', 'pr3', {ok: {[memberPid]: Date.now()}})).status === 200, 'своё «Ок» в протоколе — да');
  ok((await member.patch('protocols', 'pr3', {ok: {someoneElse: Date.now()}})).status === 403, '«Ок» за другого — нет');
  ok((await member.patch('protocols', 'pr3', {text: 'переписала'})).status === 403, 'текст протокола менять — нет');
  ok((await member.patch('protocols', 'pr1', {ok: {[memberPid]: Date.now()}})).status === 403, '«Ок» в закрытом протоколе — нет');
  ok((await member.put('yasen', memberPid, {answers: {humor: {pick: 'Часто, но по делу', own: ''}}, at: 1})).status === 200, 'анкета Ясеня — свой ответ да');
  ok((await member.put('yasen', 'чужой', {answers: {}, at: 1})).status === 403, 'анкета Ясеня — за другого нет');
  ok((await member.put('protocols', 'pr9', {title: 'x', level: 3})).status === 403, 'протокол завести — нет');
  ok((await member.put('meetings', 'mt9', {title: 'x', level: 1, date: '2026-10-21', start: '10:00', dur: 30})).status === 403, 'собрание уровня 1 завести — нет');
  ok((await member.patch('accounts', memberId, {role: 'owner'})).status === 403, 'сделать себя основателем — нет');
  ok((await member.patch('accounts', memberId, {hash: 'x', salt: 'y'})).status === 403, 'подменить пароль записью — нет');
  ok((await member.patch('accounts', ownerId, {prefs: {a: 1}})).status === 403, 'чужую учётку — нет');
  ok((await member.patch('accounts', memberId, {prefs: {theme: 'dark'}})).status === 200, 'свои настройки вида — да');
  ok((await member.put('accounts', 'evil', {name: 'x', role: 'owner', email: 'e@e.ru'})).status === 403, 'создать учётку записью — нет');
  ok((await member.patch('people', 'p1', {phone: '+7933'})).status === 200, 'свой телефон — да');
  ok((await member.patch('people', 'p1', {salary: 999999})).status === 403, 'свой оклад — нет');
  ok((await member.patch('people', ownerPid, {name: 'Взлом'})).status === 403, 'чужую карточку — нет');
  ok((await member.put('invites', 'EVIL-0001', {role: 'owner'})).status === 403, 'выдать приглашение — нет');
  ok((await member.put('plan', 'tb_t2', {title: 'Задача: Моя', group: 'once', cat: 'other', amount: 500, months: ['2026-10'], taskId: 't2', insurance: false})).status === 200, 'бюджет своей задачи в план — да');
  ok((await member.put('plan', 'pay_x', {title: 'x', group: 'payroll', amount: 1, months: ['2026-10']})).status === 403, 'зарплатную строку — нет');
  ok((await member.put('plan', 'reg2', {title: 'x', group: 'regular', amount: 1, months: ['2026-10']})).status === 403, 'обычный платёж — нет');
  ok((await member.del('plan', 'reg1')).status === 403, 'удалить чужой платёж — нет');
  ok((await member.patch('docs', 'settings', {price: 1})).status === 403, 'настройки — нет');
  ok((await member.put('sales', '2026-10-02', {pays: 1})).status === 200, 'цифры дня — да');
  ok((await member.del('sales', '2026-10-01')).status === 403, 'удалить день — нет');
  ok((await member.get('/api/export')).status === 403, 'полная выгрузка — нет');
  ok((await member.put('tasks', '__proto__', {title: 'x'})).status === 400 && (await member.put('tasks', 'constructor', {title: 'x'})).status === 400, 'служебные имена записью не становятся');
  ok((await member.req('PATCH', '/api/doc/people/p1', undefined, {raw: true})).status === 400, 'пустая правка — отказ, а не сбой');
  r = await fetch(BASE + '/api/doc/accounts/' + memberId, {method: 'PATCH', headers: {'content-type': 'application/json', 'x-eva': '1', cookie: member.cookie}, body: '{"prefs":{"a":1},"__proto__":{"role":"owner"}}'});
  ok(r.status === 200 && (await member.state()).collections.accounts[memberId].role === 'member', 'поле __proto__ в правке ничего не даёт');
  ok((await member.req('POST', '/api/auth/reset', {accId: 'constructor', code: 'AAAA-BBBB', pw: 'xxxxxx1'})).status === 400, 'сброс пароля для несуществующей учётки — отказ');
  ok((await member.req('POST', '/api/import', {collections: {tasks: {}}})).status === 403, 'загрузка файла — нет');
  ok((await member.req('POST', '/api/auth/issue-reset', {accId: ownerId})).status === 403, 'выдать сброс пароля основателю — нет');
  s = await owner.state();
  ok(s.collections.people.p1.salary === 120000 && s.collections.people.p1.phone === '+7933', 'оклад на сервере цел после правки участницы', s.collections.people.p1);
  ok(Object.keys((await member.state()).collections.plan).join() === 'tb_t2', 'в плане участница видит только строку своей задачи');

  console.log('8. сообщения');
  const dm = 'dm:' + [ownerId, memberId].sort().join('|');
  ok((await member.put('messages', 'm1', {ch: 'team', by: memberId, text: 'Привет', at: Date.now()})).status === 200, 'в общий чат — да');
  ok((await member.put('messages', 'm2', {ch: 'team', by: ownerId, text: 'От чужого имени', at: Date.now()})).status === 403, 'от чужого имени — нет');
  ok((await owner.put('messages', 'm3', {ch: dm, by: ownerId, text: 'Лично', at: Date.now()})).status === 200, 'личное сообщение');
  ok('m3' in (await member.state()).collections.messages, 'адресат личное видит');
  ok(!('m3' in (await lead.state()).collections.messages), 'третий человек личное не видит');
  ok((await lead.put('messages', 'm4', {ch: dm, by: leadId, text: 'Влез', at: Date.now()})).status === 403, 'написать в чужой диалог — нет');
  ok((await lead.del('messages', 'm1')).status === 403, 'удалить чужое сообщение — нет');

  console.log('9. инвестор');
  s = await investor.state();
  const ic = s.collections;
  ok(Object.keys(ic.tasks).length === 0 && Object.keys(ic.messages).length === 0, 'задач и сообщений не видит');
  ok(ic.ledger.l1 && ic.plan.reg1, 'деньги видит');
  ok(ic.docs.settings && Array.isArray(ic.docs.settings.rates.insurance) && ic.docs.settings.rates.insurance[1].steps[0].upTo === 2400000, 'ставки по срокам и порогам видит', ic.docs.settings);
  ok(ic.orders.o1 && !('customer' in ic.orders.o1) && !('address' in ic.orders.o1) && !('contact' in ic.orders.o1), 'заказы — без данных клиентов', ic.orders.o1);
  ok(ic.refunds.rf1 && ic.refunds.rf1.amount === 2900 && !('client' in ic.refunds.rf1) && !('comment' in ic.refunds.rf1), 'возвраты — только суммы', ic.refunds.rf1);
  ok(!ic.links.lk1, 'материал «только команде» не видит');
  ok(ic.people.p1 && ic.people.p1.name === 'Маша Команда' && !('phone' in ic.people.p1) && !('email' in ic.people.p1) && !('salary' in ic.people.p1), 'команду видит по именам, без контактов', ic.people.p1);
  ok(ic.accounts[memberId] && !('email' in ic.accounts[memberId]) && ic.accounts[investorId].email === 'inv@test.ru', 'чужих почт для входа не видит, свою — да', ic.accounts[memberId]);
  ok((await investor.put('ledger', 'l9', {kind: 'in', amount: 1})).status === 403 && (await investor.put('tasks', 't9', {title: 'x'})).status === 403, 'писать не может');
  ok(ic.scenarios.sc1 && ic.scenarios.sc1.p.tax === 6, 'сценарии видит');
  ok(!ic.yasen[memberPid], 'чужую анкету Ясеня не видит');
  ok(!ic.protocols.pr1 && ic.protocols.pr2 && ic.protocols.pr3, 'протоколы уровней 2 и 3 видит, 1 — нет', Object.keys(ic.protocols));
  ok((await investor.put('scenarios', 'sc9', {name: 'x', p: {}})).status === 403, 'сценарий сохранить — нет');
  ok(Object.keys(ic.files || {}).length === 0 && (await investor.req('GET', '/api/file/f1', undefined, {raw: true})).status === 404, 'файлов к задачам не видит');
  ok((await lead.del('files', 'f1')).status === 403, 'чужой файл удалить — нет');
  ok((await investor.get('/crm/api/state')).status === 403, 'в CRM не пускают');
  ok((await investor.req('GET', '/crm/', undefined, {raw: true})).status === 403, 'страница CRM закрыта');

  console.log('10. руководитель');
  s = await lead.state();
  ok(s.collections.ledger.l1 && s.collections.orders.o1.customer === 'Клиентка', 'деньги и клиентов видит');
  ok(!('salary' in s.collections.people.p1), 'оклад в карточке не видит');
  ok((await lead.patch('docs', 'settings', {rates: {vat: []}})).status === 403, 'ставки меняет только основатель');
  ok((await lead.put('ledger', 'l3', {kind: 'in', amount: 10, cat: 'other', date: '2026-10-02'})).status === 200, 'операцию внести — да');
  ok((await lead.put('scenarios', 'sc2', {name: 'Рефералка 20%', p: {refFirst: 20}})).status === 200, 'сценарий сохранить — да');
  ok((await lead.patch('plan', 'pay_p1', {amount: 1})).status === 403, 'зарплатную строку править — нет');
  ok((await lead.patch('docs', 'strategy', {x: 1})).status === 404, 'стратегии ещё нет — 404, а не запись');
  await owner.put('docs', 'strategy', {goals: {g1: {title: 'Цель'}}});
  ok((await lead.patch('docs', 'strategy', {goals: {g1: {done: true}}})).status === 200, 'отметить пункт цели — да');
  ok((await lead.put('docs', 'strategy', {})).status === 403, 'заменить стратегию — нет');
  ok((await lead.patch('accounts', memberId, {active: false})).status === 403, 'отключить коллегу — нет');

  console.log('11. живые события по ролям');
  const ml = member.listen(), il = investor.listen();
  await wait(300);
  await owner.put('ledger', 'l4', {kind: 'out', amount: 1, cat: 'other', date: '2026-10-03'});
  await owner.put('tasks', 't5', {title: 'Новая'});
  await owner.patch('people', 'p1', {salary: 130000});
  await wait(400);
  ok(!ml.msgs.some(m => m.col === 'ledger'), 'участнице операции не приходят', ml.msgs);
  ok(ml.msgs.some(m => m.col === 'tasks' && m.id === 't5'), 'участнице задачи приходят');
  ok(ml.msgs.filter(m => m.col === 'people').every(m => !('salary' in m.doc)), 'в событиях оклада нет', ml.msgs.filter(m => m.col === 'people'));
  ok(il.msgs.some(m => m.col === 'ledger' && m.id === 'l4') && !il.msgs.some(m => m.col === 'tasks'), 'инвестору — деньги, не задачи', il.msgs);
  ok(ml.msgs.every(m => !m.doc || typeof m.rev === 'number'), 'у событий есть номер правки');

  console.log('12. смена роли и отключение');
  ok((await owner.patch('accounts', ownerId, {role: 'member'})).status === 403, 'основатель не может разжаловать сам себя');
  ok((await owner.patch('accounts', memberId, {role: 'finance'})).status === 200, 'основатель меняет роль');
  await wait(300);
  ok(ml.msgs.some(m => m.reload), 'страница участницы получит команду перезагрузиться', ml.msgs.slice(-3));
  ok('salary' in (await member.state()).collections.people.p1, 'с ролью «Финансы» оклад уже виден');
  ok((await owner.patch('accounts', investorId, {active: false})).status === 200, 'отключить вход инвестору');
  ok((await investor.state()).me === null, 'отключённый сразу без доступа');
  ok((await investor.req('POST', '/api/auth/login', {email: 'inv@test.ru', pw: 'invest1'})).status === 403, 'и войти заново не может');
  ml.close(); il.close();

  console.log('13. пароли');
  const m2 = new Client('member2');
  ok((await m2.req('POST', '/api/auth/login', {email: 'member@test.ru', pw: 'wrong'})).status === 401, 'неверный пароль — 401');
  ok((await m2.req('POST', '/api/auth/login', {email: 'nobody@test.ru', pw: 'wrong'})).status === 401, 'нет такой почты — тот же 401');
  ok((await m2.req('POST', '/api/auth/login', {email: 'MEMBER@test.ru ', pw: 'member1'})).status === 200, 'вход: почта без учёта регистра');
  ok((await member.req('POST', '/api/auth/password', {old: 'bad', pw: 'newpass1'})).status === 400, 'смена пароля с неверным текущим — нет');
  ok((await member.req('POST', '/api/auth/password', {old: 'member1', pw: 'newpass1'})).status === 200, 'смена пароля');
  ok((await m2.state()).me === null, 'другое устройство после смены пароля вышло');
  ok((await member.state()).me === memberId, 'это устройство осталось');
  r = await owner.req('POST', '/api/auth/issue-reset', {accId: leadId});
  ok(r.status === 200 && /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(r.j.code), 'основатель выдал код сброса', r);
  const code = r.j.code;
  ok(Object.keys((await anon.get(`/api/state?reset=${leadId}.WRNG-CODE`)).j.collections).length === 0, 'ссылка сброса с чужим кодом ничего не показывает');
  s = (await anon.get(`/api/state?reset=${leadId}.${code}`)).j;
  ok(s.collections.accounts && s.collections.accounts[leadId].email === 'lead@test.ru' && !('hash' in s.collections.accounts[leadId].reset), 'по верной ссылке — только имя и почта', s.collections);
  const l2 = new Client('lead2');
  ok((await l2.req('POST', '/api/auth/reset', {accId: leadId, code: 'AAAA-BBBB', pw: 'hacked1'})).status === 400, 'сброс с неверным кодом — нет');
  ok((await l2.req('POST', '/api/auth/reset', {accId: leadId, code, pw: 'resetpw1'})).status === 200, 'сброс по коду');
  ok((await lead.state()).me === null, 'старые входы после сброса закрыты');
  ok((await l2.req('POST', '/api/auth/reset', {accId: leadId, code, pw: 'again123'})).status === 400, 'код одноразовый');
  Object.assign(lead, {cookie: l2.cookie});

  console.log('14. старая учётка из артефакта (отпечаток, посчитанный браузером)');
  const salt = Buffer.from('0123456789abcdef').toString('base64');
  const full = (await owner.get('/api/export?secrets=1')).j;
  ok(full.collections.accounts[ownerId].hash && full.collections.accounts[ownerId].salt, 'полная выгрузка основателя — с отпечатками');
  ok(!(await owner.get('/api/export')).j.collections.accounts, 'обычная выгрузка — без учёток');
  r = await owner.req('POST', '/api/import?mode=merge', {collections: {accounts: {old1: {name: 'Старая Учётка', email: 'old@test.ru', role: 'member', salt, hash: await browserHash('Пароль123', salt), active: true}}}});
  ok(r.status === 200, 'загрузка файла основателем', r);
  const old = new Client('old');
  ok((await old.req('POST', '/api/auth/login', {email: 'old@test.ru', pw: 'Пароль123'})).status === 200, 'пароль из артефакта подошёл на сервере');
  ok((await owner.state()).me === ownerId, 'основатель после загрузки остался в штабе');

  console.log('15. CRM');
  /* строка команды CRM, заведённая заранее на карточку штаба, привязывается к учётке при регистрации */
  await owner.put('people', 'p9', {name: 'Нина Новая', title: 'Менеджер', order: 50});
  await owner.put('invites', 'NINA-4444', {role: 'member', personId: 'p9', by: ownerId, at: Date.now()});
  await owner.put('team', 'tm_nina', {name: 'Нина', role: 'owner', person: 'p9', joinedAt: 1}, '/crm/api');
  const nina = new Client('nina');
  r = await nina.req('POST', '/api/auth/join', {code: 'NINA-4444', given: 'Нина', surname: 'Новая', email: 'nina@test.ru', pw: 'ninapw1'});
  s = (await nina.get('/crm/api/state')).j;
  ok(r.status === 200 && s.collections.team.tm_nina.uid === r.j.me && s.crmRole === 'owner', 'заранее заведённая строка CRM привязалась к новой учётке', s.collections.team.tm_nina);
  s = (await owner.get('/crm/api/state')).j;
  ok(s.me === ownerId && s.owner === true && s.crmRole === 'owner', 'основатель штаба — руководитель CRM', s);
  ok((await owner.put('team', 'tm_owner', {uid: ownerId, name: '', role: 'owner', joinedAt: Date.now(), order: 0}, '/crm/api')).status === 200, 'строка руководителя');
  ok((await lead.put('people', 'c1', {type: 'client', name: 'Клиентка'}, '/crm/api')).status === 403, 'без строки в команде CRM — только смотреть');
  ok((await lead.put('team', 'tm_lead', {uid: leadId, name: '', role: 'owner', joinedAt: Date.now()}, '/crm/api')).status === 403, 'записать себя руководителем — нет');
  ok((await lead.put('team', 'tm_lead', {uid: ownerId, name: '', role: 'member'}, '/crm/api')).status === 403, 'завести строку на чужую учётку — нет');
  ok((await lead.put('team', 'tm_lead', {uid: leadId, name: '', role: 'member', joinedAt: Date.now(), order: 20}, '/crm/api')).status === 403, 'сразу в команду без подтверждения — нет');
  ok((await lead.put('team', 'tm_lead', {uid: leadId, name: 'Лида', role: 'member', status: 'pending', joinedAt: Date.now(), order: 40}, '/crm/api')).status === 200, 'первый вход: заявка в команду');
  ok((await lead.get('/crm/api/state')).j.crmRole === 'viewer', 'пока заявку не подтвердили — только смотреть');
  ok((await lead.put('people', 'c0', {type: 'client', name: 'Рано'}, '/crm/api')).status === 403, 'с заявкой карточки не пишутся');
  ok((await lead.put('team', 'tm_lead2', {uid: leadId, name: '', role: 'member', status: 'pending'}, '/crm/api')).status === 403, 'вторую строку — нет');
  ok((await lead.patch('team', 'tm_lead', {role: 'owner'}, '/crm/api')).status === 403, 'поднять себе роль — нет');
  ok((await lead.patch('team', 'tm_lead', {status: 'active'}, '/crm/api')).status === 403, 'подтвердить свою заявку самой — нет');
  ok((await lead.patch('team', 'tm_lead', {head: true}, '/crm/api')).status === 403, 'сделать себя главной — нет');
  ok((await lead.patch('team', 'tm_lead', {title: 'Маркетолог', tg: '@lida', groups: ['client']}, '/crm/api')).status === 200, '«Мой профиль»: должность, Telegram, группы — да');
  ok((await owner.patch('team', 'tm_lead', {status: 'active', approvedAt: Date.now()}, '/crm/api')).status === 200 && (await lead.get('/crm/api/state')).j.crmRole === 'member', 'руководитель подтвердил заявку — роль «Команда»');
  ok((await lead.put('people', 'c1', {type: 'client', name: 'Клиентка', code: 'ANNA482'}, '/crm/api')).status === 200, 'карточку клиентки — да');
  ok((await lead.del('people', 'c1', '/crm/api')).status === 403, 'удалить карточку — только руководитель');
  /* интервью по ссылке: без входа, только в карточку по коду, не затирая записанное интервьюером */
  await lead.patch('people', 'c1', {s1: 'new', s2: 'none', talk: {t_job: {a: 'Записала команда'}}}, '/crm/api');
  ok((await anon.req('POST', '/crm/api/talk', {c: 'NOPE999', a: {t_pain: 'x'}})).status === 404, 'интервью: чужой код — нет');
  ok((await anon.req('POST', '/crm/api/talk', {c: 'ANNA482', a: {t_pain: 'x'}}, {noHeader: true})).status === 403, 'интервью: не со страницы — нет');
  ok((await anon.req('POST', '/crm/api/talk', {c: 'anna482', a: {t_pain: 'Нет времени', t_job: 'Подмена', 'bad id!': 'x', t_mood: 5}})).status === 200, 'интервью по ссылке — принято');
  r = (await lead.get('/crm/api/state')).j.collections.people.c1;
  ok(r.talk.t_pain.a === 'Нет времени' && r.talk.t_pain.self && r.talk.t_job.a === 'Записала команда' && !r.talk['bad id!'] && !r.talk.t_mood, 'ответы в карточке, записанное командой не затёрто', r.talk);
  ok(r.s2 === 'done' && r.s1 === 'skip' && r.talkSelf, 'карточка перешла к итогу', {s1: r.s1, s2: r.s2});
  ok((await anon.req('POST', '/crm/api/talk', {c: 'ANNA482', a: {name: 'Взлом', tg: '@x', t_goal: 'Высыпаться'}})).status === 200
    && (r = (await lead.get('/crm/api/state')).j.collections.people.c1) && r.name === 'Клиентка' && !r.talk.name && !r.talk.tg && r.talk.t_goal.a === 'Высыпаться', 'личная ссылка: имя и контакт из формы не трогают карточку', r.talk);
  /* общая ссылка на форму интервью (/interview/): без кода — новая карточка с именем и контактом */
  ok((await anon.req('POST', '/crm/api/talk', {t: 'k', a: {t_pain: 'Без имени'}})).status === 400, 'общая ссылка: без имени — нет');
  r = await anon.req('POST', '/crm/api/talk', {t: 'k', a: {name: 'Ольга Новая', tg: '@olga', t_pain: 'Мало сна', t_job: 'Дизайнер', 'bad id!': 'x'}});
  const olga = Object.values((await lead.get('/crm/api/state')).j.collections.people).find(x => x.name === 'Ольга Новая');
  ok(r.status === 200 && /^OLGA\d{3}$/.test(r.j.c) && olga && olga.code === r.j.c && olga.type === 'client' && olga.tg === '@olga', 'общая ссылка: новая карточка клиентки с кодом и контактом', {r: r.j, olga});
  ok(olga && olga.s2 === 'done' && olga.s1 === 'skip' && olga.talk.t_pain.a === 'Мало сна' && olga.talk.t_pain.self && !olga.talk.name && !olga.talk['bad id!'], 'общая ссылка: ответы во вкладке «Интервью», шаг «Итог»', olga);
  ok((await anon.req('POST', '/crm/api/talk', {c: r.j.c, a: {t_goal: 'Дополнила'}})).status === 200
    && Object.values((await lead.get('/crm/api/state')).j.collections.people).filter(x => x.name === 'Ольга Новая').length === 1, 'правка ответов после отправки — в ту же карточку');
  let lim = 0;
  for (let i = 0; i < 11 && !lim; i++) if ((await anon.req('POST', '/crm/api/talk', {t: 'k', a: {name: 'Спам ' + i, t_pain: 'x'}})).status === 429) lim = i + 1;
  ok(lim && lim <= 10, 'общая ссылка: много новых карточек с одного адреса — стоп', lim);
  /* анкета на своём сервере: ответы сразу в карточку (без пересылки ссылки менеджеру) */
  ok((await anon.req('POST', '/crm/api/anketa', {t: 'k', c: 'ANNA482', a: {energy: 5}}, {noHeader: true})).status === 403, 'анкета: не со страницы — нет');
  ok((await anon.req('POST', '/crm/api/anketa', {t: 'k', c: 'NOPE999', a: {energy: 5}})).status === 404, 'анкета: чужой код — нет');
  ok((await anon.req('POST', '/crm/api/anketa', {t: 'e', c: 'ANNA482', a: {energy: 5}})).status === 400, 'анкета: ссылка другой группы — нет');
  r = await anon.req('POST', '/crm/api/anketa', {t: 'k', c: 'anna482', g: 1, a: {energy: 5, pain: ['Нет времени', 42], city: 'Казань', 'bad id!': 'x', obj: {x: 1}}, k: {name: 'Взлом', city: 'Казань', role: 'owner'}});
  let c1 = (await lead.get('/crm/api/state')).j.collections.people.c1;
  ok(r.status === 200 && r.j.c === 'ANNA482' && c1.answers.energy === 5 && c1.answers.pain.join() === 'Нет времени' && !c1.answers['bad id!'] && !c1.answers.obj, 'анкета: ответы в карточке, лишнее отброшено', c1.answers);
  ok(c1.fresh && c1.fresh.kind === 'anketa' && /анкету/.test(c1.fresh.text), 'анкета: пометка «новое» для исполнителя', c1.fresh);
  ok(c1.s1 === 'done' && c1.answeredBy === 'self' && c1.name === 'Клиентка' && c1.city === 'Казань' && !c1.role && c1.gift && c1.gift.done === false, 'анкета: шаг, город, подарок; имя не затёрто', {s1: c1.s1, name: c1.name, city: c1.city, gift: c1.gift});
  r = await anon.req('POST', '/crm/api/anketa', {t: 'k', c: 'ANNA482', r: 1, a: {name: 'Подруга Аня', energy: 7}, k: {name: 'Подруга Аня'}});
  let fr = Object.values((await lead.get('/crm/api/state')).j.collections.people).find(x => x.name === 'Подруга Аня');
  ok(r.status === 200 && fr && fr.code === r.j.c && fr.ref === 'ANNA482' && fr.source === 'ref' && fr.s1 === 'done' && fr.answers.energy === 7, 'анкета «Меня пригласили»: новая карточка, кто позвал', fr);
  ok((await anon.req('POST', '/crm/api/anketa', {t: 'k', c: r.j.c, a: {energy: 8}})).status === 200
    && Object.values((await lead.get('/crm/api/state')).j.collections.people).filter(x => x.name === 'Подруга Аня').length === 1, 'анкета: правка после отправки — в ту же карточку');
  r = await anon.req('POST', '/crm/api/anketa', {t: 'e', a: {name: 'Мария Эксперт', dirs: ['Йога']}, k: {name: 'Мария Эксперт', dirs: ['Йога']}});
  fr = Object.values((await lead.get('/crm/api/state')).j.collections.people).find(x => x.name === 'Мария Эксперт');
  ok(r.status === 200 && fr && fr.type === 'expert' && fr.dirs.join() === 'Йога' && !fr.gift, 'анкета без кода: новая карточка эксперта', fr);
  ok((await lead.put('cfg', 'q_client', {test: [], talk: [], at: 1}, '/crm/api')).status === 200, 'вопросы анкеты — да');
  ok((await lead.patch('cfg', 'settings', {anketaUrl: 'https://evil'}, '/crm/api')).status === 404 && (await lead.put('cfg', 'settings', {anketaUrl: 'https://evil'}, '/crm/api')).status === 403, 'настройки CRM — нет');
  ok((await owner.patch('team', 'tm_lead', {role: 'viewer'}, '/crm/api')).status === 200, 'руководитель делает наблюдателем');
  ok((await lead.patch('people', 'c1', {name: 'Правка'}, '/crm/api')).status === 403, 'наблюдатель писать не может');
  ok((await lead.get('/crm/api/state')).j.collections.people.c1.name === 'Клиентка', 'но читает');
  const pr = (await lead.get('/crm/api/profiles')).j;
  ok(pr[ownerId] && pr[ownerId].name === 'Тест Основатель', 'имена для команды CRM — из учёток штаба', pr);
  ok(!((await owner.state()).collections.people.c1), 'клиентки CRM не смешиваются с командой штаба');
  /* место по коду приглашения: код видит только руководитель, занимает — сервер */
  ok((await owner.put('team', 'tm_head', {name: 'Зульфия', title: 'Исполнительный директор', role: 'owner', head: true, status: 'invited', code: 'EVA-7KQ2', order: 0}, '/crm/api')).status === 200, 'руководитель заводит место главной с кодом');
  ok((await owner.get('/crm/api/state')).j.collections.team.tm_head.code === 'EVA-7KQ2', 'руководитель видит код');
  s = (await member.get('/crm/api/state')).j;
  ok(s.collections.team.tm_head && !('code' in s.collections.team.tm_head), 'остальным код не отдаётся', s.collections.team.tm_head);
  ok((await member.patch('team', 'tm_head', {uid: memberId, status: 'active'}, '/crm/api')).status === 403, 'занять место записью — нет');
  r = await member.req('POST', '/crm/api/join', {code: 'EVA-AAAA'});
  ok(r.status === 403, 'чужой код — нет', r.j);
  r = await member.req('POST', '/crm/api/join', {code: 'eva 7kq2', name: 'Зульфия Каримова', groups: ['client', 'expert'], tg: '@zulya'});
  s = (await member.get('/crm/api/state')).j;
  ok(r.status === 200 && r.j.role === 'owner' && r.j.head === true && s.crmRole === 'owner', 'по коду — сразу в команде с ролью из приглашения', r.j);
  ok(s.collections.team.tm_head.uid === memberId && s.collections.team.tm_head.status === 'active' && !s.collections.team.tm_head.code && s.collections.team.tm_head.name === 'Зульфия Каримова', 'место главной привязано к учётке, код погашен', s.collections.team.tm_head);
  ok((await member.req('POST', '/crm/api/join', {code: 'EVA-7KQ2'})).status === 403, 'код второй раз — нет');
  ok((await lead.req('POST', '/crm/api/join', {code: 'EVA-7KQ2'})).status === 403, 'уже в команде — код не нужен');
  ok([401, 403].includes((await investor.req('POST', '/crm/api/join', {code: 'EVA-7KQ2'})).status), 'инвестору (или отключённой учётке) CRM закрыта');
  ok((await member.req('POST', '/crm/api/join', {code: 'EVA-7KQ2'}, {noHeader: true})).status === 403, 'вход по коду — только со своей страницы');
  let jn = 0;
  for (let i = 0; i < 10; i++) jn = (await nina.req('POST', '/crm/api/join', {code: 'EVA-ZZZ' + i})).status;
  ok(jn === 429, 'перебор кодов приглашения закрыт на время', jn);

  ok((await anon.req('POST', '/api/zoom/webhook', {event: 'recording.completed', payload: {object: {id: 1}}}, {noHeader: true})).status === 401, 'уведомление «от Зума» без подписи — 401');
  console.log('16. страницы');
  r = await anon.req('GET', '/', undefined, {raw: true});
  ok(r.status === 200 && r.text.includes('window.EVA = ') && r.text.includes('/eva-server.js'), 'главная подключает серверную часть');
  ok((await anon.req('GET', '/eva-club-v2.html', undefined, {raw: true})).status === 200, 'код штаба отдаётся');
  ok((await anon.req('GET', '/eva-server.js', undefined, {raw: true})).status === 200, 'eva-server.js отдаётся');
  r = await anon.req('GET', '/crm/', undefined, {raw: true});
  ok(r.status === 302 && r.headers.get('location') === '/?next=crm', 'CRM без входа — на экран входа', r.status);
  ok((await owner.req('GET', '/crm/', undefined, {raw: true})).text.includes('"app":"crm"'), 'CRM со входом открывается');
  ok((await anon.req('GET', '/anketa/', undefined, {raw: true})).status === 200 && (await anon.req('GET', '/anketa.html', undefined, {raw: true})).status === 200, 'анкета открыта всем');
  ok((await anon.req('GET', '/interview/', undefined, {raw: true})).status === 200 && (await anon.req('GET', '/interview', undefined, {raw: true})).status === 301, 'форма интервью открыта всем');
  for (const p of ['/server/server.js', '/server/data/eva-hq.json', '/src/app/03-auth.js', '/../server.js', '/data/eva-hq.json', '/.git/config', '/build.py'])
    ok((await anon.req('GET', p, undefined, {raw: true})).status === 404, 'закрыто: ' + p);
  r = await anon.req('GET', '/privacy', undefined, {raw: true});
  ok(r.status === 200 && r.text.includes('конфиденциальность'), 'страница о конфиденциальности открыта всем', r.status);
  ok((await anon.req('GET', '/m/team.html', undefined, {raw: true})).status === 401, 'презентации без входа закрыты');
  r = await owner.req('GET', '/m/product.html', undefined, {raw: true});
  ok(r.status === 200 && r.text.includes('Продуктовое наполнение'), '«Продуктовое наполнение» из репозитория открывается команде', r.status);
  r = await owner.req('GET', '/m/shoot.html', undefined, {raw: true});
  ok(r.status === 200 && r.text.includes('План съёмок') && (r.headers.get('content-security-policy') || '').includes('sandbox'), '«План съёмок» открывается и заперт в песочнице', r.status);
  ok((await anon.req('GET', '/m/shoot.html', undefined, {raw: true})).status === 401, '«План съёмок» без входа закрыт');

  console.log('17. перебор паролей и выход');
  const br = new Client('brute');
  let st = 0;
  for (let i = 0; i < 10; i++) st = (await br.req('POST', '/api/auth/login', {email: 'owner@test.ru', pw: 'guess' + i})).status;
  ok(st === 429, 'после серии неудач вход с этого адреса закрыт на время', st);
  ok((await owner.req('POST', '/api/auth/logout', {})).status === 200 && (await owner.state()).me === null, 'выход закрывает сессию');

  console.log('18. бот команды: вход по ключу — задачи, CRM как у команды, приглашения «Команда»');
  ok((await new Client('nokey', BASE, 'k'.repeat(40)).get('/api/state')).status === 401, 'без BOT_KEY на сервере ключ бота не пускает');
  {
    /* у бота свой сервер: с ключом и на своих пустых данных */
    const {spawn} = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eva-bot-'));
    const KEY = require('crypto').randomBytes(24).toString('hex');
    const B2 = `http://localhost:${Number(new URL(BASE).port || 8787) + 1}`;
    const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')],
      {env: {...process.env, DATA_DIR: dir, PORT: new URL(B2).port, INSECURE_COOKIE: '1', BOT_KEY: KEY, ZOOM_WEBHOOK_SECRET: 'zsecret'}, stdio: 'ignore'});
    try {
      for (let i = 0; i < 50; i++) { try { if ((await fetch(B2 + '/healthz')).ok) break; } catch (e) { /* ещё не встал */ } await wait(100); }
      const own = new Client('owner2', B2), bot = new Client('bot', B2, KEY), bad = new Client('bad', B2, KEY.replace(/.$/, c => (c === 'a' ? 'b' : 'a')));
      await own.req('POST', '/api/auth/owner', {name: 'Основатель Бота', email: 'o@bot.ru', pw: 'secret1'});
      const ownAcc = (await own.state()).me;
      await own.put('people', 'pz', {name: 'Зуля Тест', title: 'PR', dir: 'content', salary: 100000, phone: '+7999', birthDate: '1990-01-01'});
      await own.put('tasks', 'th', {title: 'Задача человека', assignee: 'pz', status: 'todo', due: '2026-10-20'});
      await own.put('ledger', 'l1', {amount: 5000, title: 'деньги'});
      await own.put('messages', 'mm1', {ch: 'team', by: ownAcc, text: 'секрет', at: Date.now()});

      ok((await bad.get('/api/state')).status === 401, 'чужой ключ — 401');
      r = await bot.get('/api/state');
      const bs = r.j.collections || {};
      ok(r.status === 200 && bs.tasks && bs.tasks.th, 'бот видит задачи', r.status);
      ok(bs.people && bs.people.pz && bs.people.pz.name === 'Зуля Тест' && !('phone' in bs.people.pz) && !('salary' in bs.people.pz) && !('birthDate' in bs.people.pz), 'из «Команды» — только кто это', bs.people);
      ok(!Object.keys(bs.ledger || {}).length && !Object.keys(bs.messages || {}).length && !Object.keys(bs.invites || {}).length, 'денег, сообщений и приглашений не видит');
      ok(Object.values(bs.accounts || {}).every(a => !('email' in a) && !('hash' in a)), 'учётки — без почты и пароля', bs.accounts);

      ok((await bot.put('tasks', 'tb1', {title: 'От бота', assignee: 'pz', status: 'todo', via: 'bot', createdBy: 'pz'})).status === 200, 'бот ставит задачу');
      ok((await bot.put('tasks', 'tb2', {title: 'Без пометки', status: 'todo'})).status === 403, 'задачу без пометки via: bot — нет');
      ok((await bot.put('tasks', 'th', {title: 'Подмена', via: 'bot'})).status === 403, 'чужую задачу целиком не заменяет');
      ok((await bot.patch('tasks', 'th', {due: '2026-10-21'})).status === 200, 'срок чужой задачи меняет');
      ok((await bot.patch('tasks', 'th', {via: 'bot'})).status === 403, 'пометку бота на чужую задачу не ставит');
      ok((await bot.del('tasks', 'th')).status === 403, 'чужую задачу не удаляет');
      ok((await bot.req('PATCH', '/api/doc/tasks/th', {due: '2026-10-22'}, {noHeader: true})).status === 403, 'запись без заголовка x-eva — нет');
      ok((await bot.put('ledger', 'l2', {amount: 1})).status === 403 && (await bot.patch('people', 'pz', {phone: '+7000'})).status === 403, 'деньги и «Команду» не меняет');
      ok((await bot.put('messages', 'mm2', {ch: 'team', by: 'bot', text: 'x', at: 1})).status === 403, 'в чат команды не пишет');
      ok((await bot.get('/api/events')).status === 403 && (await bot.get('/api/export')).status === 403, 'поток событий и выгрузка — нет');
      ok((await bot.del('tasks', 'tb1')).status === 200, 'свою задачу удаляет');

      const log = (await bot.get('/api/bot/log?n=10')).j.log || [];
      ok(log.length === 3 && log.map(x => x.op).join() === 'put,patch,delete', 'журнал бота: каждая правка', log.map(x => x.op));
      const pl = log.find(x => x.op === 'patch');
      ok(pl && pl.prev && pl.prev.due === '2026-10-20' && pl.next.due === '2026-10-21', 'в журнале прежняя версия — правку можно вернуть', pl);
      ok((await own.state()).collections.tasks.th.due === '2026-10-21', 'основатель видит правку бота');

      /* CRM: бот — как человек из команды (member): видит всё, правит карточки, не удаляет и в команду не пишется */
      await own.put('people', 'cc1', {type: 'client', name: 'Клиентка Бота', phone: '+79990001122', answers: {q1: 'старый ответ'}}, '/crm/api');
      r = await bot.get('/crm/api/state');
      ok(r.status === 200 && r.j.crmRole === 'member' && (r.j.collections.people.cc1 || {}).phone === '+79990001122', 'бот видит CRM целиком, как команда', r.j.crmRole);
      ok((await bot.patch('people', 'cc1', {answers: {q1: 'старый ответ', q2: 'новый'}}, '/crm/api')).status === 200, 'бот дописывает ответы в карточку CRM');
      ok((await bot.put('people', 'cc2', {type: 'client', name: 'Новая от бота'}, '/crm/api')).status === 200, 'бот заводит карточку CRM');
      ok((await bot.del('people', 'cc1', '/crm/api')).status === 403, 'карточки CRM не удаляет (это руководитель)');
      ok((await bot.put('team', 'tmb', {uid: 'bot', role: 'member', status: 'pending'}, '/crm/api')).status === 403, 'в команду CRM строку не заводит');
      ok((await bot.put('cfg', 'settings', {x: 1}, '/crm/api')).status === 403, 'настройки CRM не меняет');
      ok((await bot.get('/crm/api/export')).status === 403 && (await bot.get('/crm/api/events')).status === 403, 'выгрузка и поток событий CRM — нет');
      ok((await bot.req('PATCH', '/crm/api/doc/people/cc1', {name: 'x'}, {noHeader: true})).status === 403, 'запись в CRM без заголовка x-eva — нет');
      ok((await own.state('/crm/api')).collections.people.cc1.answers.q2 === 'новый', 'руководитель видит правку бота в CRM');
      /* новые анкеты — боту журналом событий */
      await own.patch('people', 'cc1', {code: 'CCBOT11', type: 'client'}, '/crm/api');
      const t0 = Date.now() - 1;
      ok((await new Client('anon3', bot.base).req('POST', '/crm/api/anketa', {t: 'k', c: 'CCBOT11', a: {energy: 4}})).status === 200, 'анкета по ссылке на сервере бота');
      const evs = (await bot.get('/crm/api/bot/events?since=' + t0)).j.events || [];
      ok(evs.length === 1 && evs[0].kind === 'anketa' && evs[0].code === 'CCBOT11' && /Клиентка Бота заполнила анкету/.test(evs[0].text), 'бот видит новую анкету в журнале событий', evs);
      ok(((await bot.get('/crm/api/bot/events?since=' + Date.now())).j.events || []).length === 0, 'журнал событий: только новее since');
      const clog = ((await bot.get('/api/bot/log?n=10')).j.log || []).filter(x => x.app === 'crm');
      ok(clog.length === 2 && clog[0].prev.answers.q1 === 'старый ответ', 'правки бота в CRM — в журнал с прежней версией', clog);

      /* собрания: бот назначает созвоны, встречу Зума заводит сервер */
      await own.put('meetings', 'mh', {title: 'Собрание основателей', date: '2026-10-21', start: '15:00', dur: 60, level: 1, organizer: 'pz', attendees: [],
        extGuests: [{id: 'g1', name: 'Гость', email: 'g@x.ru'}], guests: ['g@x.ru']});
      const bmh = ((await bot.get('/api/state')).j.collections.meetings || {}).mh;
      ok(bmh && bmh.title === 'Собрание основателей' && !('extGuests' in bmh) && !('guests' in bmh), 'собрания видит, внешних гостей — нет', bmh);
      ok((await bot.put('meetings', 'mb1', {title: 'Созвон', date: '2026-10-21', start: '15:00', dur: 60, level: 1, organizer: 'pz', attendees: [], via: 'bot'})).status === 200, 'бот создаёт собрание');
      ok((await bot.put('meetings', 'mb2', {title: 'Без пометки', date: '2026-10-21', start: '16:00'})).status === 403, 'собрание без пометки via: bot — нет');
      ok((await bot.patch('meetings', 'mh', {start: '16:00'})).status === 200, 'время чужого собрания меняет');
      const omh = (await own.state()).collections.meetings.mh;
      ok(omh.start === '16:00' && (omh.extGuests || []).length === 1 && (omh.guests || []).length === 1, 'гости собрания после правки бота на месте', omh);
      ok((await bot.patch('meetings', 'mh', {extGuests: []})).status === 403, 'внешних гостей не трогает');
      ok((await bot.del('meetings', 'mh')).status === 403, 'чужое собрание не удаляет');
      r = await bot.req('POST', '/api/zoom/meeting', {id: 'mb1'});
      ok(r.status === 503, 'встречу Зума просит у сервера (здесь Зум не подключён — 503, а не отказ в правах)', r);
      ok((await bot.del('meetings', 'mb1')).status === 200, 'своё собрание удаляет');
      ok((await bot.put('protocols', 'pb', {title: 'x', level: 3, via: 'bot'})).status === 403, 'протоколы не трогает');

      /* протоколы и стратегия — только читать */
      await own.put('protocols', 'pr1', {title: 'Созвон основателей', level: 1, date: '2026-10-21', text: 'итоги', people: [], ok: {}, file: {name: 'p.pdf', data: 'data:application/pdf;base64,AAAA'}});
      await own.put('docs', 'strategy', {goals: {g1: {title: 'Цель квартала'}}});
      await own.put('docs', 'settings', {cashStart: 100000});
      const bs2 = (await bot.get('/api/state')).j.collections;
      ok(bs2.protocols.pr1 && bs2.protocols.pr1.text === 'итоги' && !('file' in bs2.protocols.pr1) && bs2.protocols.pr1.hasFile === true, 'протоколы видит, без файла', bs2.protocols.pr1);
      ok(bs2.docs.strategy && bs2.docs.strategy.goals.g1.title === 'Цель квартала' && !bs2.docs.settings, 'стратегию видит, настройки — нет', bs2.docs);
      ok((await bot.patch('protocols', 'pr1', {text: 'другое'})).status === 403 && (await bot.patch('docs', 'strategy', {goals: {}})).status === 403, 'протоколы и стратегию не меняет');

      /* анкета «Каким быть Ясеню» — только читать */
      await own.put('yasen', 'pz', {answers: {you: {pick: 'На «ты»', own: ''}}, name: 'Зоя', at: 1});
      const bya = ((await bot.get('/api/state')).j.collections.yasen || {}).pz;
      ok(bya && bya.answers.you.pick === 'На «ты»', 'ответы анкеты Ясеня видит', bya);
      /* транскрипт встречи из Зума: сервер скачивает его по ссылке из уведомления, бот читает */
      const vtt = http.createServer((q, s2) => {
        if (q.headers.authorization !== 'Bearer dtok') { s2.writeHead(401); return s2.end(); }
        s2.end('WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\nКирилл: Внимание, задача: Зоя готовит отчёт до пятницы\n\n2\n00:00:04.000 --> 00:00:05.000\nЗоя: Хорошо\n');
      });
      await new Promise(r => vtt.listen(0, r));
      /* созвон не из штаба (личный в общем Зуме) — штаб пропускает: ни протокола, ни транскрипта */
      const zsign = body => { const ts = String(Math.floor(Date.now() / 1000)); return {'content-type': 'application/json', 'x-zm-request-timestamp': ts, 'x-zm-signature': 'v0=' + require('crypto').createHmac('sha256', 'zsecret').update(`v0:${ts}:${body}`).digest('hex')}; };
      for (const event of ['recording.completed', 'recording.transcript_completed', 'meeting.summary_completed']) {
        const b = JSON.stringify({event, download_token: 'dtok', payload: {object: {id: 999, uuid: 'x9', topic: 'Личный созвон', start_time: '2026-10-21T12:00:00Z',
          recording_files: [{file_type: 'TRANSCRIPT', download_url: `http://127.0.0.1:${vtt.address().port}/t.vtt`}]}}});
        r = await fetch(B2 + '/api/zoom/webhook', {method: 'POST', headers: zsign(b), body: b});
      }
      ok(r.status === 200 && !Object.values((await own.state()).collections.protocols || {}).some(x => x.zoomId === '999'), 'созвон не из штаба в протоколы не попадает');
      await own.put('meetings', 'mz777', {title: 'Созвон', date: '2026-10-21', start: '15:00', dur: 60, level: 3, organizer: 'pz', attendees: [], zoomId: '777'});
      const zbody = JSON.stringify({event: 'recording.transcript_completed', download_token: 'dtok', payload: {object: {id: 777, topic: 'Созвон', start_time: '2026-10-21T12:00:00Z',
        recording_files: [{file_type: 'TRANSCRIPT', download_url: `http://127.0.0.1:${vtt.address().port}/t.vtt`}]}}});
      const zts = String(Math.floor(Date.now() / 1000));
      const zsig = 'v0=' + require('crypto').createHmac('sha256', 'zsecret').update(`v0:${zts}:${zbody}`).digest('hex');
      r = await fetch(B2 + '/api/zoom/webhook', {method: 'POST', headers: {'content-type': 'application/json', 'x-zm-request-timestamp': zts, 'x-zm-signature': zsig}, body: zbody});
      vtt.close();
      const zp = Object.values((await bot.get('/api/state')).j.collections.protocols || {}).find(x => x.zoomId === '777');
      ok(r.status === 200 && zp && /^\[00:00:01\] Кирилл: Внимание, задача: Зоя готовит отчёт до пятницы\n\[00:00:04\] Зоя: Хорошо$/.test(zp.transcript || ''), 'транскрипт Зума — в протокол, бот его видит', zp);
      /* второй заход в ту же встречу (свой uuid) — транскрипт дописывается следом; повтор того же — не дублируется */
      const zsend = async body => {
        const ts = String(Math.floor(Date.now() / 1000)), sig = 'v0=' + require('crypto').createHmac('sha256', 'zsecret').update(`v0:${ts}:${body}`).digest('hex');
        return fetch(B2 + '/api/zoom/webhook', {method: 'POST', headers: {'content-type': 'application/json', 'x-zm-request-timestamp': ts, 'x-zm-signature': sig}, body});
      };
      await new Promise(rr => vtt.listen(0, rr));
      const zobj = uuid => JSON.stringify({event: 'recording.completed', download_token: 'dtok', payload: {object: {id: 777, uuid, start_time: '2026-10-21T12:00:00Z',
        recording_files: [{file_type: 'TRANSCRIPT', download_url: `http://127.0.0.1:${vtt.address().port}/t.vtt`},
          {id: 'mv', file_type: 'MP4', recording_type: 'active_speaker', download_url: 'https://zoom.us/rec/download/mv'}]}}});
      await zsend(zobj('u2')); await zsend(zobj('u2'));
      vtt.close();
      const zps = Object.values((await bot.get('/api/state')).j.collections.protocols || {}).filter(x => x.zoomId === '777'), zp2 = zps[0] || {};
      ok(zps.length === 1 && (String(zp2.transcript).match(/Следующая часть встречи/g) || []).length === 1 && (String(zp2.transcript).match(/Внимание, задача/g) || []).length === 2, 'вторая часть встречи — транскрипт дописан один раз', zp2.transcriptOf);
      ok((zp2.videos || []).length === 1 && !('recSrc' in zp2), 'видео записи бот видит, ссылку на файл Зума — нет', zp2);
      ok((await bot.patch('yasen', 'pz', {at: 2})).status === 403 && (await bot.put('yasen', 'yb', {answers: {}, at: 1, via: 'bot'})).status === 403 && (await bot.del('yasen', 'pz')).status === 403, 'анкету не меняет, не заполняет и не удаляет');

      /* своя карточка в «Команде» — одна и только «кто это» */
      ok((await bot.put('people', 'yasen', {name: 'Ясень Ева', title: 'ИИ-ассистент команды', dir: 'ops', status: 'active', order: 90, bot: true})).status === 200, 'бот заводит свою карточку в «Команде»');
      ok((await own.state()).collections.people.yasen.name === 'Ясень Ева', 'основатель видит Ясеня в «Команде»');
      ok((await bot.patch('people', 'yasen', {title: 'Ассистент'})).status === 200, 'свою должность меняет');
      ok((await bot.patch('people', 'yasen', {salary: 1})).status === 403 && (await bot.patch('people', 'yasen', {founder: true})).status === 403, 'оклад и «основатель» себе не ставит');
      ok((await bot.put('people', 'p9', {name: 'Чужой', via: 'bot'})).status === 403 && (await bot.patch('people', 'pz', {title: 'x'})).status === 403, 'чужие карточки не заводит и не меняет');
      ok((await bot.del('people', 'yasen')).status === 403, 'свою карточку не удаляет');
      ok((await bot.put('tasks', 'ty', {title: 'От Ясеня', assignee: 'pz', createdBy: 'yasen', via: 'bot'})).status === 200, 'ставит задачу от себя');

      /* приглашения: только «Команда», код и роль ставит сервер, ссылка — тому, кто попросил */
      ok((await bot.req('POST', '/api/bot/invite', {personId: 'pz'})).status === 400, 'приглашение без «кто попросил» — нет');
      r = await bot.req('POST', '/api/bot/invite', {personId: 'pz', askedBy: 'Кирилл', role: 'owner'});
      const bcode = r.j.code;
      ok(r.status === 200 && /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(bcode || '') && r.j.role === 'member' && (r.j.link || '').endsWith('/#join=' + bcode), 'бот выдаёт приглашение — роль «Команда», даже если просит другую', r.j);
      let oi = (await own.state()).collections.invites[bcode];
      ok(oi && oi.role === 'member' && oi.personId === 'pz' && oi.by === 'yasen' && oi.askedBy === 'Кирилл', 'основатель видит приглашение от Ясеня', oi);
      r = await bot.req('POST', '/api/bot/invite', {personId: 'pz', askedBy: 'Кирилл'});
      ok(r.status === 200 && r.j.code === bcode && r.j.again, 'повторная просьба — та же ссылка', r.j);
      ok((await bot.patch('invites', bcode, {role: 'owner'})).status === 403 && (await bot.put('invites', 'ZZZZ-2345', {role: 'member', by: 'yasen'})).status === 403, 'роль в ссылке не меняет, приглашение мимо сервера не заводит');
      await own.put('people', 'pl', {name: 'Лид Тест'});
      await own.put('invites', 'LEAD-2345', {role: 'lead', personId: 'pl', by: ownAcc, at: 1});
      ok((await bot.req('POST', '/api/bot/invite', {personId: 'pl', askedBy: 'Егор'})).status === 409, 'чужую ссылку (с другой ролью) не отдаёт и вторую не выдаёт');
      ok(!('LEAD-2345' in ((await bot.state()).collections.invites || {})) && (await bot.del('invites', 'LEAD-2345')).status === 403, 'чужие приглашения не видит и не отзывает');
      r = await bot.req('POST', '/api/bot/invite', {given: 'Джаргал', surname: 'Тест', title: 'Дизайнер', askedBy: 'Егор'});
      ok(r.status === 200 && ((await own.state()).collections.people[r.j.personId] || {}).name === 'Джаргал Тест', 'нового человека заводит в «Команде» вместе с приглашением', r.j);
      ok((await bot.del('invites', r.j.code)).status === 200, 'свою неиспользованную ссылку отзывает');
      const pk = (await new Client('peek', B2).get('/api/state?join=' + bcode)).j.collections || {};
      ok(pk.invites[bcode].role === 'member' && (pk.people.yasen || {}).name === 'Ясень Ева', 'в анкете приглашения видно, кто пригласил', pk);
      const jz = new Client('jz', B2);
      ok((await jz.req('POST', '/api/auth/join', {code: bcode, given: 'Зуля', surname: 'Тест', email: 'z@bot.ru', pw: 'zulya1'})).status === 200, 'по ссылке от бота входят');
      ok((await own.state()).collections.accounts[(await jz.state()).me].role === 'member', 'вошедший по ссылке бота — «Команда»');
      ok((await bot.req('POST', '/api/bot/invite', {personId: 'pz', askedBy: 'Кирилл'})).status === 409, 'тому, у кого уже есть вход, приглашение не выдаёт');

      for (let i = 0; i < 9; i++) await bad.get('/api/state');
      ok((await bad.get('/api/state')).status === 429, 'перебор ключа закрывает вход с этого адреса');
    } finally { srv.kill(); }
  }

  console.log('19. бот штаба в Telegram: привязка, напоминания, кнопки');
  ok((await fetch(BASE + '/api/tg/webhook', {method: 'POST', headers: {'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'x'}, body: '{}'})).status === 401, 'без HQ_TG_TOKEN вебхук ничего не принимает');
  ok((await member.req('POST', '/api/tg/link', {})).status === 503, 'без HQ_TG_TOKEN ссылку на бота не выдаёт');
  {
    /* свой сервер с ключом бота и свой «Telegram»: запоминает, что сервер отправил */
    const {spawn} = require('child_process'), fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eva-tg-'));
    const port = Number(new URL(BASE).port || 8787), B3 = `http://localhost:${port + 2}`, TGP = port + 3;
    const TOKEN = '123456:' + crypto.randomBytes(24).toString('hex'), SECRET = 'tg' + crypto.randomBytes(16).toString('hex');
    const calls = [];
    const fake = http.createServer((req, res) => {
      let b = '';
      req.on('data', ch => { b += ch; });
      req.on('end', () => {
        const m = /^\/bot([^/]+)\/(\w+)$/.exec(req.url) || [];
        let p = {};
        try { p = JSON.parse(b || '{}'); } catch (e) { /* пусто */ }
        calls.push({token: m[1], method: m[2], p});
        res.writeHead(200, {'content-type': 'application/json'});
        /* чат 333 «заблокировал бота» */
        if (m[2] === 'sendMessage' && String(p.chat_id) === '333') return res.end(JSON.stringify({ok: false, error_code: 403, description: 'Forbidden: bot was blocked by the user'}));
        const result = m[2] === 'getMe' ? {id: 1, is_bot: true, username: 'eva_test_hq_bot'} : m[2] === 'sendMessage' ? {message_id: calls.length, chat: {id: p.chat_id}, text: p.text} : true;
        res.end(JSON.stringify({ok: true, result}));
      });
    });
    await new Promise(r => fake.listen(TGP, r));
    const run = () => spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {env: {...process.env, DATA_DIR: dir, PORT: String(port + 2), INSECURE_COOKIE: '1',
      HQ_TG_TOKEN: TOKEN, HQ_TG_SECRET: SECRET, TG_API: `http://localhost:${TGP}`, TG_TICK_MS: '200', TG_ANY_HOUR: '1'}, stdio: 'ignore'});
    const up = async () => { for (let i = 0; i < 50; i++) { try { if ((await fetch(B3 + '/healthz')).ok) return; } catch (e) { /* ещё не встал */ } await wait(100); } };
    let srv = run();
    try {
      await up();
      const hook = (u, secret = SECRET) => fetch(B3 + '/api/tg/webhook', {method: 'POST', headers: {'content-type': 'application/json', ...(secret ? {'x-telegram-bot-api-secret-token': secret} : {})}, body: JSON.stringify(u)}).then(x => x.status);
      const sent = (chat, pred = () => true) => calls.filter(c => c.method === 'sendMessage' && String(c.p.chat_id) === String(chat) && pred(c.p));
      const until = async (fn, ms = 5000) => { for (let i = 0; i < ms / 100; i++) { if (fn()) return true; await wait(100); } return !!fn(); };
      const btns = p => ((p.reply_markup || {}).inline_keyboard || []).flat().map(b => b.callback_data).filter(Boolean);
      let uid = 100;
      const msg = (chat, text) => hook({update_id: ++uid, message: {message_id: uid, chat: {id: chat, type: 'private'}, from: {id: chat}, text}});
      const press = (chat, data) => hook({update_id: ++uid, callback_query: {id: 'q' + uid, from: {id: chat}, data, message: {message_id: 5, chat: {id: chat, type: 'private'}, text: 'напоминание'}}});

      const own = new Client('owner3', B3), ca = new Client('anna', B3), cb = new Client('boris', B3), cc = new Client('vera', B3), anon3 = new Client('anon3', B3);
      await own.req('POST', '/api/auth/owner', {name: 'Основатель Штаба', email: 'o@tg.ru', pw: 'secret1'});
      const ownPid = Object.values((await own.state()).collections.accounts)[0].personId;
      for (const [pid, code, name] of [['pA', 'ANNA-2345', 'Анна'], ['pB', 'BORI-2345', 'Борис'], ['pC', 'VERA-2345', 'Вера']]) {
        await own.put('people', pid, {name, title: 'Команда', order: 50});
        await own.put('invites', code, {role: 'member', personId: pid, by: null, at: Date.now()});
      }
      await ca.req('POST', '/api/auth/join', {code: 'ANNA-2345', given: 'Анна', surname: 'Тест', email: 'a@tg.ru', pw: 'secret1'});
      await cb.req('POST', '/api/auth/join', {code: 'BORI-2345', given: 'Борис', surname: 'Тест', email: 'b@tg.ru', pw: 'secret1'});
      await cc.req('POST', '/api/auth/join', {code: 'VERA-2345', given: 'Вера', surname: 'Тест', email: 'c@tg.ru', pw: 'secret1'});
      await until(() => calls.some(c => c.method === 'getMe'));
      await wait(200);
      ok(calls.every(c => c.token === TOKEN), 'сервер ходит в Telegram со своим ключом');
      r = await own.req('GET', '/', undefined, {raw: true});
      ok(r.text.includes('window.EVA_TG_BOT = "eva_test_hq_bot"'), 'штаб знает имя бота — покажет «Подключить Telegram»');

      /* вебхук: только с секретом */
      ok(await hook({update_id: 1, message: {chat: {id: 999, type: 'private'}, text: '/start'}}, 'wrong-secret-0000') === 401, 'вебхук с неверным секретом — 401');
      ok(await hook({update_id: 2, message: {chat: {id: 999, type: 'private'}, text: '/start'}}, '') === 401, 'вебхук без секрета — 401');
      ok(await msg(999, '/start') === 200, 'вебхук с секретом принимает');

      /* привязка: одноразовая ссылка — только на свою карточку */
      ok((await anon3.req('POST', '/api/tg/link', {})).status === 401, 'ссылку на бота без входа не выдаёт');
      r = await ca.req('POST', '/api/tg/link', {personId: 'pB'});
      const codeA = ((r.j.url || '').match(/^https:\/\/t\.me\/eva_test_hq_bot\?start=([\w-]+)$/) || [])[1];
      ok(r.status === 200 && codeA && codeA.length >= 20, 'ссылка вида t.me/<бот>?start=<одноразовый код>', r.j);
      const codeB = ((await cb.req('POST', '/api/tg/link', {})).j.url || '').split('start=')[1];
      const codeC = ((await cc.req('POST', '/api/tg/link', {})).j.url || '').split('start=')[1];
      const tgOf = async pid => ((await own.get('/api/export')).j.collections.people[pid] || {}).tgChatId;
      await msg(777, '/start ' + 'x'.repeat(24));
      await msg(777, '/start p_pA');
      ok(sent(777).some(c => /не подошла/.test(c.p.text)) && !(await tgOf('pA')), 'чужой или выдуманный код ничего не привязывает');
      await msg(111, '/start ' + codeA);
      ok(await tgOf('pA') === 111, 'код Анны привязал её чат к её карточке');
      ok(sent(111).some(c => /Готово, Анна/.test(c.p.text)), 'бот подтвердил привязку');
      await msg(999, '/start ' + codeA);
      ok(await tgOf('pA') === 111 && sent(999).some(c => /не подошла/.test(c.p.text)), 'код одноразовый: второй раз и из другого чата не работает');
      await msg(222, '/start ' + codeB);
      await msg(333, '/start ' + codeC);
      const sa = (await ca.state()).collections.people;
      ok(sa.pA.tgLinked === true && !('tgChatId' in sa.pA) && !('tgChatId' in ((await own.state()).collections.people.pB || {})), 'в браузер — только «подключён», номер чата не уходит', sa.pA);
      ok((await ca.patch('people', 'pA', {tgLinked: false})).status === 403 && (await ca.patch('people', 'pA', {tgChatId: 5})).status === 403, 'привязку в карточке сам не подделать');

      /* новая анкета в CRM — исполнителю карточки сообщение в Telegram */
      const annaAcc = (await ca.state()).me;
      await own.put('team', 'tmA', {uid: annaAcc, role: 'member', status: 'active', name: 'Анна'}, '/crm/api');
      await own.put('people', 'cA', {type: 'client', name: 'Тест Клиентка', code: 'TGCL111', s1: 'sent', s2: 'none', s3: 'none', owner: 'tmA'}, '/crm/api');
      ok((await anon3.req('POST', '/crm/api/anketa', {t: 'k', c: 'TGCL111', a: {energy: 6}})).status === 200, 'клиентка заполнила анкету');
      ok(await until(() => sent(111, p => /Тест Клиентка заполнила анкету/.test(p.text)).length), 'исполнителю пришло сообщение в Telegram о новой анкете', calls.slice(-2));
      ok(sent(111, p => /Тест Клиентка заполнила анкету/.test(p.text)).length === 1, 'сообщение — одно');
      ok(!sent(222, p => /Тест Клиентка/.test(p.text)).length, 'остальным — ничего');

      /* собрание через полчаса: напоминание с кнопками участникам, кто не участник — ничего */
      const MSK = 3 * 3600e3, s0 = Math.ceil((Date.now() + 30 * 60e3) / 60e3) * 60e3;
      const D = new Date(s0 + MSK).toISOString().slice(0, 10), HM = new Date(s0 + MSK).toISOString().slice(11, 16);
      await own.put('meetings', 'mt1', {title: 'Собрание штаба', date: D, start: HM, dur: 30, organizer: ownPid, attendees: ['pA', 'pB'], responses: {pB: 'tentative'}, remindMin: 60, zoomUrl: 'https://zoom.us/j/1', agenda: 'План'});
      ok(await until(() => sent(111, p => btns(p).includes(`m:mt1:${D}:a`)).length && sent(222, p => btns(p).includes(`m:mt1:${D}:d`)).length), 'участникам пришло напоминание с кнопками «Буду» / «Не смогу»', calls.slice(-3));
      await wait(700);
      ok(sent(111, p => /Собрание штаба/.test(p.text)).length === 1, 'напоминание не повторяется на следующих кругах');
      ok(!sent(333, p => /Собрание штаба/.test(p.text)).length, 'тому, кого нет на собрании, — ничего');
      const before = (await own.state()).collections.meetings.mt1;
      ok(await press(111, `m:mt1:${D}:a`) === 200, 'нажатие «Буду» принято');
      let after = (await own.state()).collections.meetings.mt1;
      ok(after.responses.pA === 'accepted' && after.responses.pB === 'tentative', '«Буду» Анны записано, ответ Бориса не тронут', after.responses);
      ok(JSON.stringify({...after, responses: null}) === JSON.stringify({...before, responses: null}), 'остальное в собрании не изменилось');
      ok(calls.some(c => c.method === 'answerCallbackQuery') && calls.some(c => c.method === 'editMessageText' && /Ваш ответ: ✅ Буду/.test(c.p.text)), 'бот ответил на нажатие и отметил ответ в сообщении');
      await press(333, `m:mt1:${D}:d`);
      await press(444, `m:mt1:${D}:d`);
      await press(111, `m:mt1:2020-01-01:d`);
      ok(JSON.stringify((await own.state()).collections.meetings.mt1.responses) === JSON.stringify(after.responses), 'кнопка чужого собрания, чужого чата или прошедшего дня ничего не меняет');
      await press(222, `m:mt1:${D}:d`);
      after = (await own.state()).collections.meetings.mt1;
      ok(after.responses.pB === 'declined' && after.responses.pA === 'accepted', '«Не смогу» Бориса — только в его поле');
      /* повторяющееся: ответ кнопкой — на один день */
      const wk = new Date(Date.parse(D) - 7 * 864e5).toISOString().slice(0, 10);
      await own.put('meetings', 'mt2', {title: 'Еженедельное', date: wk, start: HM, dur: 30, repeat: 'weekly', organizer: ownPid, attendees: ['pA']});
      ok(await until(() => sent(111, p => btns(p).includes(`m:mt2:${D}:d`)).length), 'повторяющееся собрание: напоминание о сегодняшнем дне');
      await press(111, `m:mt2:${D}:d`);
      const m2 = (await own.state()).collections.meetings.mt2;
      ok(m2.responses.pA === 'declined' && m2.respDate.pA === D, 'у повторяющегося ответ помечен днём', m2);

      /* протокол на «Ок» */
      await own.put('protocols', 'pr1', {title: 'Протокол собрания', level: 3, date: D, text: 'Итоги', people: ['pA', 'pB'], ok: {}, at: Date.now() - 5 * 60e3});
      ok(await until(() => sent(111, p => btns(p).some(x => x.startsWith('p:pr1:'))).length), 'протокол пришёл с кнопкой «Ок»');
      const okBtn = btns(sent(111, p => btns(p).some(x => x.startsWith('p:pr1:')))[0].p).find(x => x.startsWith('p:pr1:'));
      await press(111, okBtn);
      let pr = (await own.state()).collections.protocols.pr1;
      ok(typeof pr.ok.pA === 'number' && !pr.ok.pB && pr.text === 'Итоги', '«Ок» Анны записано — только её', pr.ok);
      await own.put('protocols', 'pr1', {...pr, text: 'Итоги, исправлено', ok: {}, upd: Date.now() - 5 * 60e3});
      await press(111, okBtn);
      pr = (await own.state()).collections.protocols.pr1;
      ok(!pr.ok.pA, '«Ок» на прежний текст после правки не засчитывается');
      ok(await until(() => sent(111, p => btns(p).some(x => x.startsWith('p:pr1:') && x !== okBtn)).length), 'новая версия текста — новое напоминание');

      /* задачи со сроком сегодня; заблокировали бота — отвязываем */
      await own.put('tasks', 'tt1', {title: 'Сдать отчёт', status: 'todo', assignee: 'pA', due: D});
      await own.put('tasks', 'tt2', {title: 'Позвонить', status: 'todo', assignee: 'pC', due: D});
      ok(await until(() => sent(111, p => /Сдать отчёт/.test(p.text)).length), 'сводка задач со сроком сегодня');
      await until(() => sent(333, p => /Позвонить/.test(p.text)).length);
      await wait(200);
      ok(!(await tgOf('pC')), 'бота заблокировали — привязка снята сама');
      ok((await cc.state()).collections.people.pC.tgLinked === false, 'и в штабе видно, что Telegram не подключён');

      /* /stop и защита от повторов после перезапуска */
      await msg(222, '/stop');
      ok(!(await tgOf('pB')) && (await cb.state()).collections.people.pB.tgLinked === false, '/stop отключает напоминания');
      const n = calls.filter(c => c.method === 'sendMessage').length;
      srv.kill();
      await wait(300);
      srv = run();
      await up();
      await wait(1200);
      ok(calls.filter(c => c.method === 'sendMessage').length === n, 'после перезапуска сервера ничего не отправлено повторно', calls.slice(n).map(c => c.p.text));
    } finally { srv.kill(); fake.close(); }
  }

  console.log('20. запись встречи из Зума — смотреть в штабе');
  {
    /* свой сервер с ключами Зума и свой «Зум»: выдаёт ключ, список записей, файл — перенаправлением в «хранилище»
       (другой адрес, туда ключ уходить не должен), кусками по Range */
    const {spawn} = require('child_process'), fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eva-zoom-'));
    const port = Number(new URL(BASE).port || 8787), B4 = `http://localhost:${port + 4}`, ZP = port + 5;
    const FILE = Buffer.from('0123456789'.repeat(100)), hits = {token: 0, list: 0, dl: 0, cdn: 0, evil: 0};
    const fake = http.createServer((q, s2) => {
      const u = new URL(q.url, 'http://x');
      const authed = q.headers.authorization === 'Bearer ztok';
      if (u.pathname === '/oauth/token') { hits.token++; s2.writeHead(200, {'content-type': 'application/json'}); return s2.end(JSON.stringify({access_token: 'ztok', expires_in: 3600})); }
      if (/^\/v2\/meetings\/[^/]+\/recordings$/.test(u.pathname)) {
        hits.list++;
        if (!authed) { s2.writeHead(401); return s2.end(); }
        s2.writeHead(200, {'content-type': 'application/json'});
        return s2.end(JSON.stringify({uuid: 'old-1', recording_files: [{id: 'fold', file_type: 'MP4', recording_type: 'gallery_view', status: 'completed', download_url: `http://localhost:${ZP}/rec/download/old`}]}));
      }
      if (u.pathname.startsWith('/rec/download/')) {
        hits.dl++;
        if (!authed) { s2.writeHead(401); return s2.end(); }
        s2.writeHead(302, {location: `http://127.0.0.1:${ZP}/cdn/${u.pathname.split('/').pop()}?sig=1`});
        return s2.end();
      }
      if (u.pathname.startsWith('/cdn/')) {
        hits.cdn++;
        if (q.headers.authorization) { s2.writeHead(400); return s2.end('ключ ушёл в хранилище'); }
        const m = /^bytes=(\d+)-(\d*)$/.exec(q.headers.range || '');
        if (!m) { s2.writeHead(200, {'content-type': 'binary/octet-stream', 'content-length': FILE.length}); return s2.end(FILE); }
        const a = Number(m[1]), b = Math.min(m[2] ? Number(m[2]) : FILE.length - 1, FILE.length - 1);
        s2.writeHead(206, {'content-type': 'binary/octet-stream', 'content-length': b - a + 1, 'content-range': `bytes ${a}-${b}/${FILE.length}`});
        return s2.end(FILE.subarray(a, b + 1));
      }
      hits.evil++;
      s2.writeHead(404); s2.end();
    });
    await new Promise(r => fake.listen(ZP, r));
    const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {env: {...process.env, DATA_DIR: dir, PORT: String(port + 4), INSECURE_COOKIE: '1',
      ZOOM_ACCOUNT_ID: 'acc', ZOOM_CLIENT_ID: 'cid', ZOOM_CLIENT_SECRET: 'csec', ZOOM_WEBHOOK_SECRET: 'zsecret',
      ZOOM_OAUTH_URL: `http://localhost:${ZP}/oauth/token`, ZOOM_API_URL: `http://localhost:${ZP}/v2`}, stdio: 'ignore'});
    try {
      for (let i = 0; i < 50; i++) { try { if ((await fetch(B4 + '/healthz')).ok) break; } catch (e) { /* ещё не встал */ } await wait(100); }
      const own = new Client('owner4', B4), mem = new Client('member4', B4), anon4 = new Client('anon4', B4);
      await own.req('POST', '/api/auth/owner', {name: 'Основатель Зума', email: 'o@zoom.ru', pw: 'secret1'});
      await own.put('people', 'pm', {name: 'Мила', title: 'Команда', order: 50});
      await own.put('invites', 'MILA-2345', {role: 'member', personId: 'pm', by: null, at: Date.now()});
      await mem.req('POST', '/api/auth/join', {code: 'MILA-2345', given: 'Мила', surname: 'Команда', email: 'm@zoom.ru', pw: 'member1'});
      const zsend = body => {
        const ts = String(Math.floor(Date.now() / 1000)), sig = 'v0=' + crypto.createHmac('sha256', 'zsecret').update(`v0:${ts}:${body}`).digest('hex');
        return fetch(B4 + '/api/zoom/webhook', {method: 'POST', headers: {'content-type': 'application/json', 'x-zm-request-timestamp': ts, 'x-zm-signature': sig}, body});
      };
      const dl = n => `http://localhost:${ZP}/rec/download/${n}`;
      await own.put('meetings', 'mz888', {title: 'Созвон основателей', date: '2026-10-22', start: '15:00', dur: 60, level: 1, organizer: 'pm', attendees: [], zoomId: '888'});
      const rec = (uuid, start) => JSON.stringify({event: 'recording.completed', payload: {object: {id: 888, uuid, topic: 'Созвон основателей', start_time: start, share_url: 'https://zoom.us/rec/share/abc',
        recording_files: [
          {id: uuid + 'g', file_type: 'MP4', recording_type: 'gallery_view', status: 'completed', download_url: dl(uuid + 'g'), recording_start: start},
          {id: uuid + 's', file_type: 'MP4', recording_type: 'shared_screen_with_speaker_view', status: 'completed', download_url: dl(uuid + 's'), recording_start: start, file_size: 1000},
          {id: uuid + 'a', file_type: 'M4A', recording_type: 'audio_only', status: 'completed', download_url: dl(uuid + 'a'), recording_start: start}]}}});
      await zsend(rec('p1', '2026-10-22T12:00:00Z')); await zsend(rec('p1', '2026-10-22T12:00:00Z'));
      let ps = Object.entries((await own.state()).collections.protocols || {}).filter(([, x]) => x.zoomId === '888');
      const [pid, zp] = ps[0] || [null, {}];
      ok(ps.length === 1 && (zp.videos || []).length === 1 && zp.videos[0].id === 'p1s' && zp.videos[0].kind === 'video', 'из файлов записи — одно видео, экран с говорящим; повтор не дублирует', zp.videos);
      ok(!('recSrc' in zp), 'ссылку на файл Зума основатель не видит — её знает только сервер', Object.keys(zp));

      const vraw = async (c, n, range) => {
        const r = await fetch(B4 + `/api/zoom/video/${encodeURIComponent(pid)}/${n}`, {headers: {...(c.cookie ? {cookie: c.cookie} : {}), ...(range ? {range} : {})}});
        return {status: r.status, type: r.headers.get('content-type'), cr: r.headers.get('content-range'), text: await r.text()};
      };
      r = await vraw(own, 0, 'bytes=0-99');
      ok(r.status === 206 && r.cr === 'bytes 0-99/1000' && r.text === FILE.subarray(0, 100).toString() && r.type === 'video/mp4', 'запись отдаётся кусками, как видео', r.status + ' ' + r.cr + ' ' + r.type);
      r = await vraw(own, 0, 'bytes=900-');
      ok(r.status === 206 && r.text === FILE.subarray(900).toString() && hits.dl === 1 && hits.cdn === 2, 'следующий кусок — сразу из хранилища, Зум второй раз не спрашиваем', hits);
      r = await vraw(own, 0);
      ok(r.status === 200 && r.text.length === 1000, 'без Range — вся запись');
      ok(hits.token === 1, 'ключ Зума берём один раз и помним', hits.token);
      ok((await vraw(mem, 0, 'bytes=0-9')).status === 404, 'участник не видит протокол уровня 1 — и записи не получит');
      ok((await vraw(anon4, 0)).status === 401, 'без входа — нет');
      ok((await vraw(own, 5)).status === 404, 'нет такой записи — 404');

      /* ссылку на файл не подменить: сервер не понесёт ключ Зума на чужой адрес */
      ok((await own.put('protocols', 'evil', {title: 'x', level: 1, date: '2026-10-22', videos: [{id: 'e'}], recSrc: {e: `http://localhost:${ZP}/steal`}})).status === 403, 'новый протокол со своей ссылкой на файл — нет');
      r = await own.patch('protocols', pid, {recSrc: {p1s: `http://localhost:${ZP}/steal`}});
      const r2 = await vraw(own, 0, 'bytes=0-9');
      ok(r2.status === 206 && hits.evil === 0, 'правка протокола ссылку на файл не меняет', [r.status, r2.status, hits]);
      const zp1 = (await own.state()).collections.protocols[pid];
      ok(await own.put('protocols', pid, {...zp1, text: 'Итоги'}).then(x => x.status === 200) && (await vraw(own, 0, 'bytes=0-9')).status === 206, 'основатель сохранил протокол — запись по-прежнему смотрится');

      /* второй заход в ту же встречу — вторая запись */
      await zsend(rec('p2', '2026-10-22T12:40:00Z'));
      const zp2 = (await own.state()).collections.protocols[pid];
      ok((zp2.videos || []).map(v => v.id).join() === 'p1s,p2s', 'второй заход — вторая часть записи', zp2.videos);
      ok((await vraw(own, 1, 'bytes=0-9')).status === 206, 'вторая часть тоже смотрится');

      /* записи встреч, прошедших раньше: сервер находит их у Зума по заходам протокола */
      await own.put('protocols', 'old', {title: 'Прошлый созвон', level: 1, date: '2026-10-20', zoomId: '999', recUrl: 'https://zoom.us/rec/share/old', transcriptOf: ['old-1'], people: [], ok: {}});
      ok((await mem.req('POST', '/api/zoom/videos', {id: 'old'})).status === 404, 'участник не ищет записи закрытого протокола');
      r = await own.req('POST', '/api/zoom/videos', {id: 'old'});
      ok(r.status === 200 && (r.j.videos || []).length === 1 && r.j.videos[0].id === 'fold' && hits.list === 1, 'запись прошлой встречи найдена у Зума', [r.j, hits.list]);
      r = await own.req('POST', '/api/zoom/videos', {id: 'old'});
      ok((r.j.videos || []).length === 1 && hits.list === 1, 'повторно Зум не спрашиваем', hits.list);
      const oldv = await fetch(B4 + '/api/zoom/video/old/0', {headers: {cookie: own.cookie, range: 'bytes=0-4'}});
      ok(oldv.status === 206 && (await oldv.text()) === '01234', 'и смотрится в штабе');
    } finally { srv.kill(); fake.close(); }
  }

  console.log('21. разовая правка данных CRM: тестовые карточки (без сервера, на копии)');
  {
    const fs = require('fs'), os = require('os'), path = require('path');
    const {JsonStore} = require('../lib/store'), {runFixes} = require('../lib/crm-fixes');
    const mk = docs => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evafix-')); const st = new JsonStore({file: path.join(dir, 'eva-crm.json'), cols: ['team', 'people', 'cfg'], format: 'eva-crm'}).load(); Object.entries(docs).forEach(([c, d]) => Object.entries(d).forEach(([id, x]) => st.set(c, id, x))); st.flush(); return {dir, st}; };
    const old = Date.UTC(2026, 9, 15), fresh = Date.UTC(2026, 9, 23, 12);
    const {dir, st} = mk({people: {
      al: {type: 'client', name: 'Алёна Красильникова', createdAt: old, talk: {t_job: {a: 'x'}}}, c1: {type: 'client', name: 'Маша', createdAt: old}, c2: {type: 'client', name: 'Новая настоящая', createdAt: fresh},
      d1: {type: 'expert', name: 'Пример эксперт', demo: true, createdAt: old}, e1: {type: 'expert', name: 'Ирина Йога', createdAt: old}, e2: {type: 'partner', name: 'Студия тест', createdAt: fresh}},
      team: {dm_anna: {demo: true, name: 'Анна'}, tm1: {name: 'Зуля', uid: 'u1'}}, cfg: {meta2: {demo: true}, settings: {x: 1}}});
    const logs = [];
    const done = runFixes(st, dir, {log: x => logs.push(x)});
    const ids = c => Object.keys(st.col(c)).sort().join(',');
    ok(ids('people') === 'al,c2,e1' && ids('team') === 'tm1' && ids('cfg') === 'settings', 'правка: осталась Алена, новые клиентки и настоящие эксперты', {people: ids('people'), team: ids('team'), cfg: ids('cfg')});
    const bk = JSON.parse(fs.readFileSync(path.join(dir, 'removed', '2026-10-23-test-data.json'), 'utf8'));
    ok(Object.keys(bk.collections.people).sort().join() === 'c1,d1,e2' && bk.collections.people.c1.name === 'Маша' && bk.collections.team.dm_anna, 'правка: удалённое сохранено копией', bk.collections);
    ok(done['2026-10-23-test-data'] && JSON.parse(fs.readFileSync(path.join(dir, 'crm-fixes.json'), 'utf8'))['2026-10-23-test-data'], 'правка отмечена сделанной', logs);
    st.set('people', 'c3', {type: 'client', name: 'Ещё тест', createdAt: old});
    runFixes(st, dir, {log: () => {}});
    ok(st.get('people', 'c3'), 'правка не повторяется при следующем запуске');
    const st2 = new JsonStore({file: path.join(dir, 'eva-crm.json'), cols: ['team', 'people', 'cfg'], format: 'eva-crm'}).load();
    ok(!st2.get('people', 'c1') && st2.get('people', 'al'), 'правка записана в файл данных');
    const b2 = mk({people: {c1: {type: 'client', name: 'Маша', createdAt: old}, d1: {type: 'client', name: 'Пример', demo: true, createdAt: old}}});
    runFixes(b2.st, b2.dir, {log: () => {}});
    ok(b2.st.get('people', 'c1') && !b2.st.get('people', 'd1'), 'нет карточки Алены — клиенток без пометок не трогаем, пример убираем');
  }

  console.log(`\nИтог: прошло ${pass}, не прошло ${failN}`);
  process.exit(failN ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
