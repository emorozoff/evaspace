/* Хранилище. Один слой — два источника:
   • в артефакте Claude — общая база claude.use('db'): у каждой записи свой
     документ, правки расходятся по команде вживую (onSnapshot);
   • везде ещё (GitHub Pages, локальный сервер) — localStorage этого браузера.
   История клиента (касания, звонки, сообщения, оплаты, задачи) лежит внутри
   его документа картой ev: {id: событие}. db.update() сливает вложенные
   объекты, поэтому два менеджера, записавшие звонок и сообщение одной
   клиентке одновременно, не затирают друг друга. */

const Store = (() => {
  const COLS = ['team', 'clients', 'experts', 'partners', 'chats', 'campaigns', 'payouts', 'cfg'];
  const LS = 'eva-crm:';
  const data = Object.fromEntries(COLS.map(c => [c, new Map()]));
  const subs = new Set();
  const statusSubs = new Set();
  const queue = new Map();
  const state = {mode: 'local', ready: false, pending: 0, error: null, readOnly: false, quota: false};
  let db = null;

  /* не больше четырёх записей одновременно — база не любит залпы */
  let inFlight = 0;
  const waiters = [];
  const slot = () => (inFlight < 4 ? (inFlight++, Promise.resolve()) : new Promise(r => waiters.push(r)));
  const release = () => { const w = waiters.shift(); if (w) w(); else inFlight--; };

  const strip = o => { const {id, ...body} = o || {}; return body; };
  const emit = c => subs.forEach(fn => { try { fn(c); } catch (e) { console.error(e); } });
  const emitStatus = () => statusSubs.forEach(fn => { try { fn(state); } catch (e) { console.error(e); } });

  function loadLocal() {
    for (const c of COLS) {
      const o = Local.get(LS + c, null);
      if (o && typeof o === 'object') for (const [id, v] of Object.entries(o)) data[c].set(id, {...v, id});
    }
  }
  let saveT = {};
  function saveLocal(c) {
    clearTimeout(saveT[c]);
    saveT[c] = setTimeout(() => Local.set(LS + c, Object.fromEntries([...data[c]].map(([id, v]) => [id, strip(v)]))), 120);
  }

  async function init() {
    let api = null;
    try {
      api = window.claude && typeof window.claude.use === 'function' ? await window.claude.use('db') : null;
    } catch (e) { api = null; }
    if (!api) { loadLocal(); state.mode = 'local'; state.ready = true; emitStatus(); return; }
    db = api;
    state.mode = 'db';
    /* ждём первый окончательный снимок каждой коллекции; через 9 с идём с тем, что есть */
    await new Promise(resolve => {
      let left = COLS.length, done = false;
      const finish = () => { if (!done) { done = true; clearTimeout(timer); resolve(); } };
      const timer = setTimeout(finish, 9000);
      COLS.forEach(c => {
        let settled = false;
        const settle = () => { if (!settled) { settled = true; if (--left === 0) finish(); } };
        try {
          db.collection(c).onSnapshot(snap => {
            const m = new Map();
            snap.docs.forEach(d => { const v = d.data(); if (v) m.set(d.id, {...clone(v), id: d.id}); });
            data[c] = m;
            if (!snap.metadata || !snap.metadata.fromCache) settle();
            if (state.ready) emit(c);
          }, err => {
            state.error = (err && err.code) || 'error';
            if (err && err.code === 'revoked') state.readOnly = true;
            settle();
            emitStatus();
          });
        } catch (e) { settle(); }
      });
    });
    state.ready = true;
    emitStatus();
  }

  /* одна запись на документ за раз: следующая ждёт предыдущую */
  function enqueue(path, op) {
    state.pending++;
    emitStatus();
    const prev = queue.get(path) || Promise.resolve();
    const run = async () => {
      await slot();
      try {
        try { await op(); }
        catch (e) {
          if (e && (e.code === 'unavailable' || e.code === 'resource_exhausted')) { await new Promise(r => setTimeout(r, 700 + Math.random() * 900)); await op(); }
          else throw e;
        }
      } finally { release(); }
    };
    const p = prev.catch(() => {}).then(run).then(
      () => { state.error = null; },
      e => {
        state.error = (e && e.code) || 'error';
        if (e && e.code === 'invalid_argument') state.readOnly = true;
        if (e && e.code === 'quota_exceeded') state.quota = true;
        console.warn('Запись не прошла', path, e);
        if (typeof toast === 'function') toast(writeErrorText(e), {error: true});
      }
    ).finally(() => {
      state.pending--;
      if (queue.get(path) === p) queue.delete(path);
      emitStatus();
    });
    queue.set(path, p);
    return p;
  }
  function writeErrorText(e) {
    const code = e && e.code;
    if (code === 'quota_exceeded') return 'База заполнена (до 5 000 записей): удалите старые или демо-записи в «Настройках → Данные»';
    if (code === 'invalid_argument') return 'Не сохранилось: у вас доступ только на просмотр этой CRM';
    if (code === 'resource_exhausted') return 'Слишком много правок подряд — повторите через минуту';
    return 'Не сохранилось. Проверьте связь и повторите';
  }

  function commitLocal(c) { if (!db) saveLocal(c); emit(c); }

  function put(c, id, obj) {
    const body = strip(obj);
    data[c].set(id, {...clone(body), id});
    commitLocal(c);
    if (db) return enqueue(`${c}/${id}`, () => db.collection(c).doc(id).set(body));
    return Promise.resolve();
  }
  function add(c, obj, id = uid()) { put(c, id, obj); return id; }
  function patch(c, id, partial) {
    const cur = data[c].get(id);
    const next = deepMerge(cur ? strip(cur) : {}, partial);
    data[c].set(id, {...next, id});
    commitLocal(c);
    if (!db) return Promise.resolve();
    return enqueue(`${c}/${id}`, async () => {
      const ref = db.collection(c).doc(id);
      if (!cur) return ref.set(next);
      try { await ref.update(clone(partial)); }
      catch (e) {
        /* документа уже нет в базе (удалили с другого устройства) — записываем целиком */
        if (e && e.code === 'invalid_argument') await ref.set(strip(data[c].get(id) || next));
        else throw e;
      }
    });
  }
  /* удалить вложенное поле (например, событие из ev): в базе — полной
     перезаписью документа, потому что update() умеет только сливать */
  function unset(c, id, pathArr) {
    const cur = data[c].get(id);
    if (!cur) return Promise.resolve();
    const next = clone(strip(cur));
    let o = next;
    for (let i = 0; i < pathArr.length - 1; i++) { o = o && o[pathArr[i]]; }
    if (o) delete o[pathArr[pathArr.length - 1]];
    return put(c, id, next);
  }
  function remove(c, id) {
    data[c].delete(id);
    commitLocal(c);
    if (db) return enqueue(`${c}/${id}`, () => db.collection(c).doc(id).delete());
    return Promise.resolve();
  }

  return {
    COLS, state, init, put, add, patch, unset, remove,
    all: c => [...data[c].values()],
    get: (c, id) => data[c].get(id) || null,
    count: c => data[c].size,
    total: () => COLS.reduce((a, c) => a + data[c].size, 0),
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    onStatus(fn) { statusSubs.add(fn); return () => statusSubs.delete(fn); },
    flush: () => Promise.all([...queue.values()]),
    isDb: () => !!db,
  };
})();
