/* Проверка сервера штаба и CRM через его же адреса: вход, роли, что кому видно. */
'use strict';
const http = require('http');
const BASE = process.env.BASE || 'http://localhost:8787';   // сервер на ПУСТЫХ данных: DATA_DIR=$(mktemp -d) PORT=8787 INSECURE_COOKIE=1 node server.js
let pass = 0, failN = 0;
const ok = (cond, name, extra) => { if (cond) pass++; else { failN++; console.log('  ✗', name, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ''); } };

class Client {
  constructor(name) { this.name = name; this.cookie = ''; }
  async req(method, path, body, {raw = false, noHeader = false} = {}) {
    const headers = {'content-type': 'application/json'};
    if (!noHeader) headers['x-eva'] = '1';
    if (this.cookie) headers.cookie = this.cookie;
    const r = await fetch(BASE + path, {method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual'});
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
  await owner.put('docs', 'settings', {price: 2900, cashStart: 777, cashDate: '2026-09-01', invest: {'2026-11': 1}});
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
  const memberId = r.j.me;
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
  ok(mc.people.p1 && mc.people.p1.name === 'Маша Команда' && !('salary' in mc.people.p1), 'карточку видит, оклад — нет', mc.people.p1);
  ok(mc.people.p1.status === 'active', 'вакансия закрылась');
  ok(Object.values(mc.accounts).every(a => !('hash' in a) && !('salt' in a) && !('reset' in a)), 'ни одного отпечатка пароля');
  ok(mc.docs.settings && mc.docs.settings.price === 2900 && !('cashStart' in mc.docs.settings), 'настройки без денег на счёте', mc.docs.settings);
  ok(mc.tasks.t1 && mc.sales['2026-10-01'] && mc.links.lk1, 'задачи, цифры и материалы видит');

  console.log('7. что может участница');
  ok((await member.put('tasks', 't2', {title: 'Моя', status: 'todo'})).status === 200, 'задачу создать — да');
  ok((await member.put('ledger', 'l2', {kind: 'in', amount: 1})).status === 403, 'операцию внести — нет');
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
  ok(ic.orders.o1 && !('customer' in ic.orders.o1) && !('address' in ic.orders.o1) && !('contact' in ic.orders.o1), 'заказы — без данных клиентов', ic.orders.o1);
  ok(ic.refunds.rf1 && ic.refunds.rf1.amount === 2900 && !('client' in ic.refunds.rf1) && !('comment' in ic.refunds.rf1), 'возвраты — только суммы', ic.refunds.rf1);
  ok(!ic.links.lk1, 'материал «только команде» не видит');
  ok(ic.people.p1 && ic.people.p1.name === 'Маша Команда' && !('phone' in ic.people.p1) && !('email' in ic.people.p1) && !('salary' in ic.people.p1), 'команду видит по именам, без контактов', ic.people.p1);
  ok(ic.accounts[memberId] && !('email' in ic.accounts[memberId]) && ic.accounts[investorId].email === 'inv@test.ru', 'чужих почт для входа не видит, свою — да', ic.accounts[memberId]);
  ok((await investor.put('ledger', 'l9', {kind: 'in', amount: 1})).status === 403 && (await investor.put('tasks', 't9', {title: 'x'})).status === 403, 'писать не может');
  ok((await investor.get('/crm/api/state')).status === 403, 'в CRM не пускают');
  ok((await investor.req('GET', '/crm/', undefined, {raw: true})).status === 403, 'страница CRM закрыта');

  console.log('10. руководитель');
  s = await lead.state();
  ok(s.collections.ledger.l1 && s.collections.orders.o1.customer === 'Клиентка', 'деньги и клиентов видит');
  ok(!('salary' in s.collections.people.p1), 'оклад в карточке не видит');
  ok((await lead.put('ledger', 'l3', {kind: 'in', amount: 10, cat: 'other', date: '2026-10-02'})).status === 200, 'операцию внести — да');
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

  console.log('16. страницы');
  r = await anon.req('GET', '/', undefined, {raw: true});
  ok(r.status === 200 && r.text.includes('window.EVA = ') && r.text.includes('/eva-server.js'), 'главная подключает серверную часть');
  ok((await anon.req('GET', '/eva-club-v2.html', undefined, {raw: true})).status === 200, 'код штаба отдаётся');
  ok((await anon.req('GET', '/eva-server.js', undefined, {raw: true})).status === 200, 'eva-server.js отдаётся');
  r = await anon.req('GET', '/crm/', undefined, {raw: true});
  ok(r.status === 302 && r.headers.get('location') === '/?next=crm', 'CRM без входа — на экран входа', r.status);
  ok((await owner.req('GET', '/crm/', undefined, {raw: true})).text.includes('"app":"crm"'), 'CRM со входом открывается');
  ok((await anon.req('GET', '/anketa/', undefined, {raw: true})).status === 200 && (await anon.req('GET', '/anketa.html', undefined, {raw: true})).status === 200, 'анкета открыта всем');
  for (const p of ['/server/server.js', '/server/data/eva-hq.json', '/src/app/03-auth.js', '/../server.js', '/data/eva-hq.json', '/.git/config', '/build.py'])
    ok((await anon.req('GET', p, undefined, {raw: true})).status === 404, 'закрыто: ' + p);
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

  console.log(`\nИтог: прошло ${pass}, не прошло ${failN}`);
  process.exit(failN ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
