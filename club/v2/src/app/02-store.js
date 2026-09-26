/* Хранилище. Один слой — два источника:
   • в артефакте Claude — общая база claude.use('db'): у каждой записи свой
     документ, правки расходятся по команде вживую (onSnapshot);
   • везде ещё (GitHub Pages, локальный сервер) — localStorage этого браузера.
   Коллекции: люди, учётки, приглашения, задачи, операции, план расходов,
   продажи по дням, ссылки на материалы, собрания, занятость по людям
   (только интервалы «занят») и docs — одиночные документы
   (docs/strategy, docs/settings, docs/learning). */

const Store = (() => {
  const COLS = ['accounts', 'invites', 'people', 'tasks', 'ledger', 'plan', 'sales', 'links', 'docs', 'meetings', 'busy'];
  const LS = 'eva-hq:';
  const data = Object.fromEntries(COLS.map(c => [c, new Map()]));
  const subs = new Set();
  const statusSubs = new Set();
  const queue = new Map();
  const state = {mode: 'local', ready: false, pending: 0, error: null, readOnly: false};
  let db = null;

  const strip = o => { const {id, ...body} = o || {}; return body; };
  const emit = c => subs.forEach(fn => { try { fn(c); } catch (e) { console.error(e); } });
  const emitStatus = () => statusSubs.forEach(fn => { try { fn(state); } catch (e) { console.error(e); } });

  function loadLocal() {
    for (const c of COLS) {
      const o = Local.get(LS + c, null);
      if (o && typeof o === 'object') for (const [id, v] of Object.entries(o)) data[c].set(id, {...v, id});
    }
  }
  function saveLocal(c) {
    Local.set(LS + c, Object.fromEntries([...data[c]].map(([id, v]) => [id, strip(v)])));
  }

  async function init() {
    loadLocal();
    let api = null;
    try {
      api = window.claude && typeof window.claude.use === 'function' ? await window.claude.use('db') : null;
    } catch (e) { api = null; }
    if (!api) { state.mode = 'local'; state.ready = true; emitStatus(); return; }
    db = api;
    state.mode = 'db';
    /* ждём первый окончательный снимок каждой коллекции, чтобы не решить
       «учёток нет» по неполному кэшу; через 9 с идём с тем, что есть */
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
            saveLocal(c);
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
      try { await op(); }
      catch (e) {
        if (e && e.code === 'unavailable') { await new Promise(r => setTimeout(r, 600 + Math.random() * 900)); await op(); }
        else throw e;
      }
    };
    const p = prev.catch(() => {}).then(run).then(
      () => { state.error = null; },
      e => {
        state.error = (e && e.code) || 'error';
        if (e && e.code === 'invalid_argument') state.readOnly = true;
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
    if (code === 'quota_exceeded') return 'База заполнена: удалите старые записи, чтобы добавить новые';
    if (code === 'invalid_argument') return 'Не сохранилось: у вас доступ только на просмотр этого штаба';
    if (code === 'resource_exhausted') return 'Слишком много правок подряд — повторите через минуту';
    return 'Не сохранилось. Проверьте связь и повторите';
  }

  function commitLocal(c) { saveLocal(c); emit(c); }

  function put(c, id, obj) {
    const body = strip(obj);
    data[c].set(id, {...clone(body), id});
    commitLocal(c);
    if (db) return enqueue(`${c}/${id}`, () => db.collection(c).doc(id).set(body));
    return Promise.resolve();
  }
  function add(c, obj, id = uid()) { put(c, id, obj); return id; }
  /* mustExist: правка документа, которого уже нет (удалили с другого
     устройства), ничего не пишет — иначе из обрывка правки родится
     «призрак» без названия */
  function patch(c, id, partial, opts = {}) {
    const cur = data[c].get(id);
    if (opts.mustExist && !cur) return Promise.resolve(false);
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
        if (e && e.code === 'invalid_argument') { if (!opts.mustExist) await ref.set(strip(data[c].get(id) || next)); }
        else throw e;
      }
    });
  }
  function remove(c, id) {
    data[c].delete(id);
    commitLocal(c);
    if (db) return enqueue(`${c}/${id}`, () => db.collection(c).doc(id).delete());
    return Promise.resolve();
  }

  return {
    COLS, state, init, put, add, patch, remove,
    all: c => [...data[c].values()],
    get: (c, id) => data[c].get(id) || null,
    count: c => data[c].size,
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    onStatus(fn) { statusSubs.add(fn); return () => statusSubs.delete(fn); },
    flush: () => Promise.all([...queue.values()]),
  };
})();

/* ── производные доступа к данным ── */
function settings() {
  return deepMerge(DEFAULT_SETTINGS, Store.get('docs', 'settings') || {});
}
const saveSettings = partial => Store.patch('docs', 'settings', partial);
/* план продаж по сценарию: свои цифры основателя поверх стандартных */
function scenarioSales(key) {
  const s = settings();
  const base = SCENARIOS[key] || SCENARIOS.goal;
  const own = s.plans && s.plans[key] ? s.plans[key] : {};
  return Object.fromEntries(Q.months.map(m => [m, own[m] !== undefined ? Number(own[m]) : base.sales[m]]));
}
function people() {
  return Store.all('people').filter(p => !p.archived).sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || String(a.name || a.title).localeCompare(String(b.name || b.title), 'ru'));
}
function personById(id) { return id ? Store.get('people', id) : null; }
/* имя человека: если имени ещё нет — его должность */
function personName(p) { return p ? (p.name || p.title || 'Без имени') : 'Не назначено'; }
function firstName(p) { const n = personName(p); return p && p.name ? n.split(' ')[0] : n; }