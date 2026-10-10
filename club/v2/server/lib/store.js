/* Хранилище в одном файле: коллекции «id → документ» того же формата, что
   «Выгрузить всё» в штабе (см. DATA.md). Всё в памяти, на диск — с задержкой
   и атомарно; копия на каждый день. */

'use strict';
const fs = require('fs');
const path = require('path');

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
function merge(a, b) {
  const o = isObj(a) ? {...a} : {};
  Object.entries(b || {}).forEach(([k, v]) => { o[k] = isObj(v) && isObj(o[k]) ? merge(o[k], v) : v; });
  return o;
}

class JsonStore {
  constructor({file, cols, format, backups = 30}) {
    this.file = file;
    this.cols = cols;
    this.format = format;
    this.keep = backups;
    this.db = {format, version: 1, collections: {}};
    this.subs = new Set();
    this.timer = null;
    this.dirty = false;
    /* номер правки: по нему браузер понимает, что свежее — ответ на запись или событие.
       Отсчёт от времени запуска, чтобы после перезапуска сервера номера не пошли назад */
    this.rev = Date.now();
  }
  normalize(j) {
    if (!j || typeof j !== 'object') throw new Error('пустой файл');
    const cols = j.collections || j;   // принимаем и голый {коллекция: {id: doc}}
    const out = {format: this.format, version: 1, collections: {}};
    Object.entries(cols).forEach(([c, docs]) => { if (isObj(docs) && /^[a-z]{2,20}$/.test(c)) out.collections[c] = docs; });
    return out;
  }
  load() {
    try { this.db = this.normalize(JSON.parse(fs.readFileSync(this.file, 'utf8'))); }
    catch (e) { if (e.code !== 'ENOENT') { console.error('Не прочитал', this.file, e.message); process.exit(1); } }
    this.cols.forEach(c => { this.db.collections[c] = this.db.collections[c] || {}; });
    return this;
  }
  save(now) {
    clearTimeout(this.timer);
    this.dirty = true;
    const run = () => {
      fs.mkdirSync(path.dirname(this.file), {recursive: true});
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.db), {mode: 0o600});
      fs.renameSync(tmp, this.file);
      this.dirty = false;
      this.backup();
    };
    if (now) run(); else this.timer = setTimeout(run, 300);
  }
  /* перед выходом — дописать то, что ждёт задержки */
  flush() { if (this.dirty) this.save(true); }
  backup() {
    const dir = path.join(path.dirname(this.file), 'backups');
    const base = path.basename(this.file, '.json');
    const day = new Date().toISOString().slice(0, 10);
    const f = path.join(dir, `${base}-${day}.json`);
    if (fs.existsSync(f)) return;
    fs.mkdirSync(dir, {recursive: true});
    fs.copyFileSync(this.file, f);
    fs.chmodSync(f, 0o600);
    const re = new RegExp('^' + base.replace(/[^a-z0-9-]/gi, '.') + '-\\d{4}-\\d\\d-\\d\\d\\.json$');
    fs.readdirSync(dir).filter(n => re.test(n)).sort().slice(0, -this.keep).forEach(n => fs.unlinkSync(path.join(dir, n)));
  }
  has(c) { return this.cols.includes(c); }
  col(c) { return this.db.collections[c] || {}; }
  /* только свои записи коллекции: id вроде «constructor» не должен находить встроенное в объект */
  get(c, id) { const col = this.db.collections[c]; return (col && Object.prototype.hasOwnProperty.call(col, id) && col[id]) || null; }
  list(c) { return Object.entries(this.col(c)).map(([id, d]) => ({...d, id})); }
  count(c) { return Object.keys(this.col(c)).length; }
  set(c, id, doc) {
    this.db.collections[c] = this.db.collections[c] || {};
    const prev = this.db.collections[c][id] || null;
    if (doc === null) delete this.db.collections[c][id]; else this.db.collections[c][id] = doc;
    this.save();
    const rev = ++this.rev;
    this.subs.forEach(fn => { try { fn({col: c, id, doc, prev, rev}); } catch (e) { console.error(e); } });
  }
  patch(c, id, part) { const next = merge(this.get(c, id), part); this.set(c, id, next); return next; }
  /* загрузка выгрузки: 'all' — заменить базу целиком; 'replace' — заменить только те
     разделы, что есть в файле; 'merge' — добавить и обновить */
  replace(j, mode = 'all') {
    const inc = this.normalize(j);
    if (mode === 'all') this.db = inc;
    else Object.entries(inc.collections).forEach(([c, docs]) => { this.db.collections[c] = mode === 'replace' ? docs : {...(this.db.collections[c] || {}), ...docs}; });
    this.cols.forEach(c => { this.db.collections[c] = this.db.collections[c] || {}; });
    this.save(true);
    this.subs.forEach(fn => { try { fn({reset: true}); } catch (e) { console.error(e); } });
  }
  export() { return {...this.db, exportedAt: new Date().toISOString()}; }
  on(fn) { this.subs.add(fn); return () => this.subs.delete(fn); }
}

module.exports = {JsonStore, merge, isObj};
