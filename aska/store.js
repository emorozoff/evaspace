/* АСЬКА — хранилище данных (общее для дизайнов «Зумер», «Миллениал» и v1).

   Раньше всё лежало одним JSON в localStorage['aska.v1'], и каждое действие
   (сообщение, лайк, сердцебиение присутствия) разбирало и записывало
   мегабайты целиком. Теперь каждая сущность лежит под своим ключом:

     aska3:<коллекция>:<id>   — запись коллекции (история пары, профиль, стена…)
     aska3:s:<имя>            — одиночные значения (настройки, lastLogin…)
     aska3:meta               — версия схемы
     aska3:rev, aska3:log     — счётчик ревизий и журнал последних изменений

   В памяти держится кэш (тот же объект db, что и раньше). mutate(fn) отдаёт
   fn прокси, который отмечает, какие записи тронуты, перечитывает их из
   localStorage (вдруг их поменяла соседняя вкладка) и после fn записывает
   только реально изменившиеся. sync() по журналу подтягивает чужие правки,
   а событие storage обновляет кэш в соседних вкладках сразу. */
(function () {
  'use strict';

  const P = 'aska3:';
  const LEGACY = 'aska.v1';
  const SCHEMA = 1;
  const LOG_MAX = 400;
  const MAPS = ['accounts', 'contacts', 'history', 'unread', 'presence', 'memory', 'profile', 'wall', 'interests', 'communities', 'events', 'tracks', 'trackOwners', 'trackLog', 'movies', 'radio'];
  const SINGLES = { refLog: () => [], settings: () => ({ sound: true, volume: 0.8 }), lastLogin: () => '' };

  const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
  const isArr = Array.isArray;
  // проверка формы: битая или подложенная запись не роняет приложение, а просто не загружается
  const SHAPE = {
    accounts: (v, id) => isObj(v) && String(v.uin) === id,
    contacts: (v) => isArr(v) && v.every((x) => typeof x === 'string'),
    history: (v) => isArr(v) && v.every(isObj),
    unread: isObj, presence: isObj, memory: isObj, profile: isObj,
    wall: (v) => isArr(v) && v.every(isObj),
    interests: isObj, communities: isObj, events: isObj, tracks: isObj, movies: isObj, radio: isObj,
    trackOwners: (v) => typeof v === 'string',
    trackLog: (v) => isArr(v),
  };
  const SINGLE_SHAPE = { refLog: isArr, settings: isObj, lastLogin: (v) => typeof v === 'string', magnetSeq: (v) => typeof v === 'number' };

  let ls = null;
  try { ls = window.localStorage; ls.getItem(P + 'meta'); } catch (err) { ls = null; }
  // приватный режим без localStorage: живём в памяти, чтобы приложение всё равно работало
  const mem = new Map();
  const S = ls ? {
    get: (k) => ls.getItem(k), set: (k, v) => ls.setItem(k, v), del: (k) => ls.removeItem(k),
    keys: () => { const out = []; for (let i = 0; i < ls.length; i++) out.push(ls.key(i)); return out; },
  } : { get: (k) => (mem.has(k) ? mem.get(k) : null), set: (k, v) => mem.set(k, String(v)), del: (k) => mem.delete(k), keys: () => Array.from(mem.keys()) };

  const db = {};
  const raw = new Map();          // ключ → последняя известная строка (для сравнения без разбора)
  let rev = 0;
  const listeners = [];
  const errListeners = [];
  const mkKey = (col, id) => P + col + ':' + id;
  const sKey = (name) => P + 's:' + name;

  function reset() {
    // коллекции чистим на месте: ссылки на db.history и т.п. остаются живыми
    MAPS.forEach((c) => { if (!isObj(db[c])) db[c] = {}; else Object.keys(db[c]).forEach((k) => delete db[c][k]); });
    Object.keys(db).forEach((k) => { if (!MAPS.includes(k)) delete db[k]; });
    Object.keys(SINGLES).forEach((k) => (db[k] = SINGLES[k]()));
    raw.clear();
  }
  function parseKey(key) {
    if (!key || key.indexOf(P) !== 0) return null;
    const rest = key.slice(P.length);
    if (rest.indexOf('s:') === 0) return { single: rest.slice(2) };
    const i = rest.indexOf(':');
    if (i < 0) return null;
    const col = rest.slice(0, i);
    return MAPS.includes(col) ? { col, id: rest.slice(i + 1) } : null;
  }
  // применить строку из хранилища к кэшу; null — запись удалена
  function apply(key, str) {
    const pk = parseKey(key);
    if (!pk) return null;
    raw.set(key, str);
    let v;
    if (str != null) { try { v = JSON.parse(str); } catch (err) { v = undefined; } }
    if (pk.single) {
      const ok = v !== undefined && (!SINGLE_SHAPE[pk.single] || SINGLE_SHAPE[pk.single](v));
      if (ok) db[pk.single] = v; else if (SINGLES[pk.single]) db[pk.single] = SINGLES[pk.single](); else delete db[pk.single];
      return 's:' + pk.single;
    }
    if (v !== undefined && SHAPE[pk.col](v, pk.id)) db[pk.col][pk.id] = v; else delete db[pk.col][pk.id];
    return pk.col;
  }
  function fullLoad() {
    reset();
    S.keys().forEach((k) => { if (parseKey(k)) apply(k, S.get(k)); });
    rev = +S.get(P + 'rev') || 0;
  }

  /* ---------- запись с защитой от переполнения ---------- */
  function trimLargest() {
    // освобождаем место: самые длинные истории и журналы урезаем до последних записей
    let freed = false;
    const hist = Object.keys(db.history).map((k) => [k, db.history[k].length]).sort((a, b) => b[1] - a[1]);
    hist.slice(0, 5).forEach(([k, n]) => { if (n > 150) { db.history[k] = db.history[k].slice(-Math.max(150, Math.floor(n / 2))); writeRaw(mkKey('history', k), JSON.stringify(db.history[k]), true); freed = true; } });
    Object.keys(db.trackLog).forEach((k) => { if (db.trackLog[k].length > 20) { db.trackLog[k] = db.trackLog[k].slice(-20); writeRaw(mkKey('trackLog', k), JSON.stringify(db.trackLog[k]), true); freed = true; } });
    Object.keys(db.wall).forEach((k) => { if (db.wall[k].length > 60) { db.wall[k] = db.wall[k].slice(0, 60); writeRaw(mkKey('wall', k), JSON.stringify(db.wall[k]), true); freed = true; } });
    const old = Date.now() - 864e5;
    Object.keys(db.presence).forEach((k) => { if (!db.presence[k] || db.presence[k].ts < old) { delete db.presence[k]; writeRaw(mkKey('presence', k), null, true); freed = true; } });
    return freed;
  }
  function writeRaw(key, str, noRetry) {
    try {
      if (str == null) S.del(key); else S.set(key, str);
      raw.set(key, str);
      return true;
    } catch (err) {
      if (noRetry) return false;
      if (trimLargest()) return writeRaw(key, str, true);
      errListeners.forEach((f) => { try { f(err); } catch (e) {} });
      return false;
    }
  }
  function journal(keys) {
    if (!keys.length) return;
    let log = [];
    try { log = JSON.parse(S.get(P + 'log') || '[]'); if (!isArr(log)) log = []; } catch (err) { log = []; }
    const cur = Math.max(rev, +S.get(P + 'rev') || 0) + 1;
    keys.forEach((k) => log.push([cur, k]));
    if (log.length > LOG_MAX) log = log.slice(-LOG_MAX);
    try { S.set(P + 'log', JSON.stringify(log)); S.set(P + 'rev', String(cur)); } catch (err) {}
    rev = cur;
  }

  /* ---------- sync: подтянуть чужие правки по журналу ---------- */
  function sync() {
    const cur = +S.get(P + 'rev') || 0;
    if (cur === rev) return db;
    let log = null;
    try { log = JSON.parse(S.get(P + 'log') || 'null'); } catch (err) { log = null; }
    if (!isArr(log) || !log.length || cur < rev || log[0][0] > rev + 1) { fullLoad(); return db; }
    if (log.some(([r, k]) => r > rev && k === '*')) { fullLoad(); return db; }
    const seen = new Set();
    log.forEach(([r, k]) => { if (r > rev && !seen.has(k)) { seen.add(k); const s = S.get(k); if (s !== raw.get(k)) apply(k, s); } });
    rev = cur;
    return db;
  }

  /* ---------- mutate: прокси, отмечающий тронутые записи ---------- */
  function mutate(fn) {
    sync();
    const touched = new Set();
    const touch = (key) => {
      if (touched.has(key)) return;
      touched.add(key);
      const s = S.get(key);
      if (s !== raw.get(key) && !(s == null && raw.get(key) === undefined)) apply(key, s);
    };
    const cols = {};
    const colProxy = (col) => cols[col] || (cols[col] = new Proxy(db[col], {
      get(t, id) { if (typeof id !== 'string' || id === 'toJSON') return db[col][id]; touch(mkKey(col, id)); return db[col][id]; },
      set(t, id, v) { if (typeof id !== 'string') return false; touch(mkKey(col, id)); db[col][id] = v; return true; },
      deleteProperty(t, id) { touch(mkKey(col, id)); delete db[col][id]; return true; },
      has(t, id) { return id in db[col]; },
      ownKeys() { return Reflect.ownKeys(db[col]); },
      getOwnPropertyDescriptor(t, id) { const d = Reflect.getOwnPropertyDescriptor(db[col], id); if (d) d.configurable = true; return d; },
    }));
    const root = new Proxy(db, {
      get(t, name) {
        if (typeof name !== 'string') return db[name];
        if (MAPS.includes(name)) return colProxy(name);
        touch(sKey(name));
        return db[name];
      },
      set(t, name, v) {
        if (MAPS.includes(name)) {
          if (v === cols[name]) return true;
          // целиком заменили коллекцию: перезаписываем все её записи
          const next = isObj(v) ? v : {};
          new Set(Object.keys(db[name]).concat(Object.keys(next))).forEach((id) => touched.add(mkKey(name, id)));
          db[name] = Object.assign({}, next);
          delete cols[name];
          return true;
        }
        touch(sKey(name));
        db[name] = v;
        return true;
      },
      deleteProperty(t, name) { if (MAPS.includes(name)) return false; touch(sKey(name)); delete db[name]; return true; },
    });
    const out = fn(root);
    const changed = [];
    touched.forEach((key) => {
      const pk = parseKey(key);
      const v = pk.single ? db[pk.single] : db[pk.col][pk.id];
      const str = v === undefined ? null : JSON.stringify(v);
      const prev = raw.has(key) ? raw.get(key) : null;
      if (str === prev) return;
      if (writeRaw(key, str)) changed.push(key);
    });
    journal(changed);
    return out;
  }

  /* ---------- соседние вкладки ---------- */
  let pend = new Set(), pendTimer = null;
  function notify(col) {
    pend.add(col);
    if (pendTimer) return;
    pendTimer = setTimeout(() => {
      const cols = pend; pend = new Set(); pendTimer = null;
      listeners.forEach((f) => { try { f(cols); } catch (err) { setTimeout(() => { throw err; }); } });
    }, 40);
  }
  if (ls) window.addEventListener('storage', (e) => {
    if (e.storageArea && e.storageArea !== ls) return;
    if (e.key == null) { fullLoad(); notify('*'); return; }
    if (e.key === LEGACY && e.newValue) { importLegacy(e.newValue, false); notify('*'); return; }
    const pk = parseKey(e.key);
    if (!pk || e.newValue === raw.get(e.key)) return;
    notify(apply(e.key, e.newValue));
  });

  /* ---------- переезд со старого формата aska.v1 ---------- */
  function msgKey(m) { return m.id || m.ts + '|' + m.from + '|' + (m.text || ''); }
  function importLegacy(str, overwrite) {
    let old;
    try { old = typeof str === 'string' ? JSON.parse(str) : str; } catch (err) { return false; }
    if (!isObj(old)) return false;
    let ok = true;
    const put = (key, v) => { if (ok && !writeRaw(key, JSON.stringify(v), true)) { try { S.del(LEGACY); } catch (e) {} ok = writeRaw(key, JSON.stringify(v), true); } };
    MAPS.forEach((col) => {
      const src = old[col];
      if (!isObj(src)) return;
      Object.keys(src).forEach((id) => {
        let v = src[id];
        if (!SHAPE[col](v, id)) return;
        const key = mkKey(col, id);
        const have = S.get(key);
        if (have != null && !overwrite) {
          if (col !== 'history') return;
          // одна и та же переписка в обоих форматах: склеиваем без повторов
          let cur = []; try { cur = JSON.parse(have); } catch (err) {}
          const seen = new Set(cur.map(msgKey));
          v = cur.concat(v.filter((m) => !seen.has(msgKey(m)))).sort((a, b) => (a.ts || 0) - (b.ts || 0)).slice(-1500);
        }
        put(key, v);
      });
    });
    Object.keys(old).forEach((name) => {
      if (MAPS.includes(name)) return;
      if (SINGLE_SHAPE[name] && !SINGLE_SHAPE[name](old[name])) return;
      const key = sKey(name);
      if (S.get(key) != null && !overwrite) return;
      put(key, old[name]);
    });
    if (ok) { try { S.del(LEGACY); } catch (err) {} }
    fullLoad();
    journal(['*']);   // соседние вкладки перечитают всё целиком
    return ok;
  }
  function init() {
    let meta = null;
    try { meta = JSON.parse(S.get(P + 'meta') || 'null'); } catch (err) { meta = null; }
    const legacy = S.get(LEGACY);
    if (legacy) importLegacy(legacy, !meta);
    if (!meta) { try { S.set(P + 'meta', JSON.stringify({ v: SCHEMA, created: Date.now(), from: legacy ? LEGACY : null })); } catch (err) {} }
    fullLoad();
  }

  /* ---------- резервная копия ---------- */
  function exportAll() {
    sync();
    return JSON.stringify({ app: 'aska', schema: SCHEMA, exported: Date.now(), data: db });
  }
  function importAll(str) {
    let pack;
    try { pack = JSON.parse(str); } catch (err) { return { ok: false, error: 'Это не файл АСЬКИ.' }; }
    if (!isObj(pack) || pack.app !== 'aska' || !isObj(pack.data)) return { ok: false, error: 'Это не файл АСЬКИ.' };
    if ((pack.schema || 0) > SCHEMA) return { ok: false, error: 'Файл из более новой версии АСЬКИ.' };
    const ok = importLegacy(pack.data, false);
    sync();
    return { ok, error: ok ? null : 'Не хватило места в памяти браузера.' };
  }
  function stats() {
    const out = { total: 0, cols: {} };
    S.keys().forEach((k) => { if (k.indexOf(P) !== 0) return; const n = (S.get(k) || '').length * 2; const pk = parseKey(k); const c = pk ? pk.col || 's' : 'meta'; out.cols[c] = (out.cols[c] || 0) + n; out.total += n; });
    return out;
  }

  init();

  window.AskaStore = {
    db, SCHEMA, persistent: !!ls,
    sync, mutate,
    onChange: (f) => listeners.push(f),
    onError: (f) => errListeners.push(f),
    exportAll, importAll, stats,
    // для отладки и тестов: подсунуть данные в старом формате
    _importLegacy: (obj) => importLegacy(obj, true),
  };
})();
