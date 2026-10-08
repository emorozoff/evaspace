/* Данные штаба — в файл и обратно. Один формат на всё: выгрузка из
   артефакта Claude, с GitHub Pages и со своего сервера одинаковая
   ({format: 'eva-hq', version: 1, collections: {коллекция: {id: документ}}},
   см. DATA.md), поэтому переезд на другой хостинг — «Выгрузить всё» здесь и
   «Загрузить из файла» там (или node server.js --import файл).
   Таблицы CSV — для Excel и Google Таблиц: разделитель «;», UTF-8 с BOM. */

const Portable = {
  snapshot({accounts = true} = {}) {
    const collections = {};
    Store.COLS.forEach(c => {
      if (c === 'accounts' && !accounts) return;
      collections[c] = Object.fromEntries(Store.all(c).map(d => { const {id, ...body} = d; return [id, body]; }));
    });
    return {format: 'eva-hq', version: 1, exportedAt: new Date().toISOString(), source: Store.state.mode, collections};
  },
  csv(rows, cols) {
    const q = v => { const s = v === null || v === undefined ? '' : String(v); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    return '﻿' + [cols.map(c => q(c[1])).join(';'), ...rows.map(r => cols.map(c => q(typeof c[0] === 'function' ? c[0](r) : r[c[0]])).join(';'))].join('\r\n');
  },
  tasksCsv() {
    const nm = id => (id ? whoName(id) : '');
    return this.csv(Tasks.sort(Tasks.all()), [
      ['id', 'id'], ['title', 'Задача'], [t => STATUSES[t.status] ? STATUSES[t.status].name : t.status, 'Статус'],
      [t => nm(t.createdBy), 'Поставил(а)'], [t => nm(t.assignee), 'Исполнитель'], [t => PRIO[prioOf(t)].name, 'Приоритет'],
      ['due', 'Срок'], ['month', 'Месяц'], [t => (t.dueFixed ? 'да' : ''), 'Срок важен'], [t => dirName(t.dir), 'Направление'],
      [t => { const g = t.goalId ? Strategy.goal(t.goalId) : null; return g ? g.short || g.title : ''; }, 'Цель'],
      [t => Number(t.budget) || '', 'Бюджет, ₽'], ['result', 'ЦКП'], ['outcome', 'Результат'], ['desc', 'Описание'],
      [t => (t.createdAt ? isoOf(new Date(t.createdAt)) : ''), 'Создана'], [t => (t.doneAt ? isoOf(new Date(t.doneAt)) : ''), 'Готово'],
    ]);
  },
  salesCsv() {
    return this.csv(Sales.list(), [['id', 'Дата'], ['reach', 'Охват'], ['views', 'Просмотры'], ['clicks', 'Переходы'], ['regs', 'Регистрации'], ['pays', 'Оплаты'], ['renewals', 'Продления'], [s => revenueOf(s), 'Выручка, ₽'], ['experts', 'Эксперты'], ['mk', 'Мастер-классы'], ['note', 'Заметка'], [s => (s.by ? whoName(s.by) : ''), 'Внёс(ла)']]);
  },
  ledgerCsv() {
    return this.csv(Money.ledger(), [['date', 'Дата'], [e => (KINDS[e.kind] || {}).name || e.kind, 'Тип'], [e => catName(e.kind, e.cat), 'Статья'], [e => (e.kind === 'out' ? -1 : 1) * (Number(e.amount) || 0), 'Сумма, ₽'], ['note', 'Комментарий'], [e => (e.planId ? 'по плану' : ''), 'План'], [e => (e.by ? whoName(e.by) : ''), 'Кто']]);
  },
  peopleCsv() {
    const pay = Auth.can('payroll.view');
    return this.csv(people(), [['id', 'id'], ['name', 'Имя'], ['title', 'Должность'], [p => dirName(p.dir), 'Направление'], [p => (PERSON_STATUS[pStatus(p)] || {}).name, 'Статус'], ['email', 'Почта'], ['phone', 'Телефон'], ['telegram', 'Телеграм'], ['birthDate', 'Дата рождения'], [p => (HD_TYPES[p.hdType] || {}).name || '', 'Human Design'], ['hdProfile', 'Профиль'], [p => (pay ? p.salary || '' : ''), 'Оклад, ₽']]);
  },
  /* финансы */
  subsCsv() {
    return this.csv(Subs.rows(), [['m', 'Месяц'], ['startM', 'Месячных на начало'], ['startY', 'Годовых на начало'], ['newM', 'Новые месячные'], ['newY', 'Новые годовые'], ['renewed', 'Продлили'], ['churn', 'Не продлили'],
      ['refunds', 'Возвраты, шт'], ['refundSum', 'Возвраты, ₽'], ['endM', 'Месячных на конец'], ['endY', 'Годовых на конец'], ['total', 'Всего платных'], [r => (r.renewRate === null ? '' : Math.round(r.renewRate * 1000) / 10), 'Продления, %'],
      [r => (r.refundRate === null ? '' : Math.round(r.refundRate * 1000) / 10), 'Возвраты, %'], [r => Math.round(r.revenue), 'Выручка, ₽'], [r => Math.round(r.mrr), 'MRR, ₽']]);
  },
  payoutsCsv() {
    return this.csv(Fin.accruals(), [[x => PAYOUT_KINDS[x.kind].name, 'Кому'], ['to', 'Получатель'], ['contact', 'Контакт'], [x => (x.course ? x.course.title : ''), 'Курс'], ['month', 'Месяц'], ['amount', 'Начислено, ₽'],
      [x => (x.paid ? 'выплачено' : x.closed ? 'к выплате' : 'начисляется'), 'Статус'], ['paidAt', 'Дата выплаты']]);
  },
  coursesCsv() {
    const rows = [];
    Fin.courses().forEach(c => finMonths().forEach(m => { const x = Fin.courseSale(c, m); if (x.n || x.revenue) rows.push({c, m, ...x}); }));
    return this.csv(rows, [[r => r.c.title, 'Курс'], [r => r.c.author || '', 'Автор'], ['m', 'Месяц'], ['n', 'Продано, шт'], ['revenue', 'Выручка, ₽'], [r => Number(r.c.authorPct) || 0, 'Доля автора, %'], ['author', 'Автору, ₽'],
      [r => { const p = Store.get('payouts', Fin.authorId(r.c.id, r.m)); return p && p.status === 'paid' ? 'выплачено ' + p.paidAt : ''; }, 'Выплата']]);
  },
  ordersCsv() {
    return this.csv(Fin.orders(), [['no', '№'], ['date', 'Дата'], ['customer', 'Клиент'], ['contact', 'Контакт'], ['address', 'Адрес'], [o => (o.items || []).map(it => `${it.title} × ${it.qty} по ${it.price}`).join(', '), 'Состав'],
      ['shipCost', 'Доставка, ₽'], [o => Fin.orderTotal(o), 'Сумма, ₽'], [o => (ORDER_PAY[o.pay || 'wait'] || {}).name, 'Оплата'], ['paidAt', 'Оплачен'], [o => (ORDER_DELIVERY[o.delivery || 'new'] || {}).name, 'Доставка'], ['track', 'Трек'], ['note', 'Комментарий']]);
  },
  productsCsv() {
    return this.csv(Fin.products(), [['title', 'Товар'], ['sku', 'Артикул'], [p => p.seller || 'свой склад', 'Чей'], ['fee', 'Комиссия клуба, %'], ['price', 'Цена, ₽'], ['cost', 'Себестоимость, ₽'], ['stock', 'Остаток']]);
  },
  failedCsv() {
    return this.csv(Fin.failed(), [['date', 'Дата'], ['client', 'Клиент'], ['contact', 'Контакт'], ['amount', 'Сумма, ₽'], [x => (x.plan === 'year' ? 'годовая' : 'месячная'), 'Подписка'], [x => FAIL_REASONS[x.reason] || '', 'Причина'],
      ['attempts', 'Попыток'], [x => (FAIL_ST[x.status || 'new'] || {}).name, 'Статус'], ['next', 'Следующий шаг'], [x => (x.who ? whoName(x.who) : ''), 'Ответственный'], ['paidAt', 'Оплачено'], ['note', 'Комментарий']]);
  },
  refundsCsv() {
    return this.csv(Fin.refunds(), [['date', 'Получен'], ['deadline', 'Ответить до'], ['client', 'Клиент'], ['contact', 'Контакт'], [x => REFUND_PRODUCTS[x.product || 'sub'], 'Что'], ['amount', 'Сумма, ₽'], ['reason', 'Причина'],
      ['comment', 'Что пишет клиент'], [x => (REFUND_ST[x.status || 'new'] || {}).name, 'Статус'], ['decision', 'Решение'], [x => (x.who ? whoName(x.who) : ''), 'Ответственный'], ['refundedAt', 'Возвращено']]);
  },
  /* сохранить файл: в Claude — через площадку (человек подтверждает), иначе — обычной загрузкой */
  async save(filename, text) {
    let dl = null;
    try { dl = window.claude && typeof window.claude.use === 'function' ? await window.claude.use('downloads') : null; } catch (e) { dl = null; }
    if (dl) {
      try { await dl.save({filename, data: text}); return true; }
      catch (e) { if (e && e.code === 'declined') return false; if (e && e.code === 'rate_limited') { toast('Окно сохранения уже открыто — подтвердите или закройте его'); return false; } }
    }
    try {
      const blob = new Blob([text], {type: filename.endsWith('.csv') ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      return true;
    } catch (e) { toast('Браузер не дал сохранить файл', {error: true}); return false; }
  },
  parse(text) {
    const j = JSON.parse(text);
    const cols = j && (j.collections || j);
    if (!cols || typeof cols !== 'object') throw new Error('В файле нет данных штаба');
    const known = Object.keys(cols).filter(c => Store.COLS.includes(c) && cols[c] && typeof cols[c] === 'object' && !Array.isArray(cols[c]));
    if (!known.length) throw new Error('Это не выгрузка штаба: нет ни задач, ни людей, ни цифр');
    return {cols: Object.fromEntries(known.map(c => [c, cols[c]])), meta: j};
  },
  /* загрузить: «добавить и обновить» или «заменить» — только те коллекции, что есть в файле */
  async apply(cols, mode) {
    const me = (Auth.me() || {}).id;
    let n = 0;
    for (const c of Object.keys(cols)) {
      const docs = cols[c];
      Object.entries(docs).forEach(([id, d]) => { if (d && typeof d === 'object') { Store.put(c, id, d); n++; } });
      if (mode === 'replace') Store.all(c).filter(x => !(x.id in docs) && !(c === 'accounts' && x.id === me)).forEach(x => Store.remove(c, x.id));
    }
    await Store.flush();
    return n;
  },
};
const dayStamp = () => today();
function portableHtml() {
  const owner = Auth.isOwner();
  const counts = ['tasks', 'sales', 'ledger', 'people'].map(c => `${{tasks: 'задач', sales: 'дней с цифрами', ledger: 'операций', people: 'человек'}[c]}: ${Store.count(c)}`).join(' · ');
  return `<section class="section card portable">
    <div class="card-head"><h2>Данные штаба</h2><span class="note">${counts}</span></div>
    <p class="note">Всё, что есть в штабе, — в один файл: для резервной копии и переезда на свой сервер или другой хостинг. Формат один везде — файл отсюда загружается в штаб на сервере, и наоборот.</p>
    <div class="pt-row">
      <button class="btn primary sm" data-pt="json">${icon('download')}Выгрузить всё (JSON)</button>
      ${owner ? '<label class="check pt-acc"><input type="checkbox" id="ptAcc" checked> с учётками и паролями — для переезда</label>' : ''}
    </div>
    <div class="pt-row"><span class="label">Таблицы для Excel</span>
      <button class="btn sm" data-pt="tasks">${icon('download')}Задачи</button>
      <button class="btn sm" data-pt="sales">${icon('download')}Цифры продаж</button>
      <button class="btn sm" data-pt="ledger">${icon('download')}Операции</button>
      <button class="btn sm" data-pt="people">${icon('download')}Команда</button>
    </div>
    ${owner ? `<div class="pt-row"><button class="btn sm" data-pt-import>${icon('upload')}Загрузить из файла…</button><input type="file" id="ptFile" accept=".json,application/json" hidden>
      <span class="note">Свой сервер: папка <code>club/v2/server</code> — <code>node server.js</code>, затем загрузите сюда файл выгрузки.</span></div>` : ''}
  </section>`;
}
function wirePortable(root) {
  on(root, 'click', '[data-pt]', async (e, b) => {
    const k = b.dataset.pt;
    let name, text;
    if (k === 'json') {
      const acc = !!($('#ptAcc', root) || {}).checked && Auth.isOwner();
      name = `eva-hq-${acc ? 'full' : 'data'}-${dayStamp()}.json`;
      text = JSON.stringify(Portable.snapshot({accounts: acc}), null, 1);
    } else {
      name = `eva-hq-${k}-${dayStamp()}.csv`;
      text = Portable[k + 'Csv']();
    }
    if (await Portable.save(name, text)) toast(`Файл ${name} — сохранён`);
  });
  const file = $('#ptFile', root);
  on(root, 'click', '[data-pt-import]', () => file && file.click());
  if (file) file.onchange = async () => {
    const f = file.files && file.files[0];
    file.value = '';
    if (!f) return;
    let parsed;
    try { parsed = Portable.parse(await f.text()); }
    catch (err) { toast('Не получилось прочитать файл: ' + (err.message || err), {error: true}); return; }
    importModal(parsed, f.name);
  };
}
function importModal({cols, meta}, fname) {
  const names = {accounts: 'учётки', invites: 'приглашения', people: 'люди', tasks: 'задачи', ledger: 'операции', plan: 'план платежей', sales: 'цифры продаж', links: 'материалы', docs: 'стратегия и настройки', meetings: 'собрания', busy: 'занятость', messages: 'сообщения',
    subs: 'подписки по месяцам', payouts: 'выплаты', courses: 'курсы', orders: 'заказы', products: 'товары', failed: 'сбои оплат', refunds: 'возвраты'};
  const rows = Object.keys(cols).map(c => `<tr><td>${names[c] || c}</td><td class="r">${Object.keys(cols[c]).length}</td><td class="r soft">${Store.count(c)}</td></tr>`).join('');
  openModal({
    title: 'Загрузить данные из файла',
    body: `<p class="note">Файл «${esc(fname)}»${meta && meta.exportedAt ? `, выгружен ${esc(String(meta.exportedAt).slice(0, 10))}` : ''}.</p>
      <div class="table-wrap"><table class="t"><thead><tr><th>Что</th><th class="r">В файле</th><th class="r">Сейчас в штабе</th></tr></thead><tbody>${rows}</tbody></table></div>
      <label class="check"><input type="radio" name="ptMode" value="merge" checked> <span><b>Добавить и обновить</b> — записи из файла лягут поверх, остальное останется</span></label>
      <label class="check"><input type="radio" name="ptMode" value="replace"> <span><b>Заменить</b> — в этих разделах останется только то, что в файле (ваша учётка сохранится)</span></label>`,
    foot: '<button class="btn" data-close>Отмена</button><button class="btn primary" id="ptGo">Загрузить</button>',
    onMount(el, close) {
      $('#ptGo', el).onclick = async () => {
        const mode = $('input[name=ptMode]:checked', el).value;
        const go = $('#ptGo', el);
        go.disabled = true;
        go.textContent = 'Загружаю…';
        const n = await Portable.apply(cols, mode);
        close();
        toast(Store.state.readOnly ? 'Не сохранилось: доступ только на просмотр' : `Загружено записей: ${n}`, Store.state.readOnly ? {error: true} : {});
      };
    },
  });
}
