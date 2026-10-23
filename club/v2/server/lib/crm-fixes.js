/* Разовые правки данных CRM, о которых просили основатели. Из сессий Claude доступа к данным
   людей нет — поэтому правка едет кодом: сервер при запуске применяет каждую ровно один раз
   и записывает в DATA_DIR/crm-fixes.json, когда и с каким итогом. Всё, что правка удаляет,
   сначала ложится копией в DATA_DIR/removed/<правка>.json — по ней записи можно вернуть.
   Новую попытку делаем новой правкой (новый id), а не повтором при каждом запуске. */
'use strict';
const fs = require('fs');
const path = require('path');

const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
/* Алена Красильникова — единственный настоящий кастдев на 23.10.2026 (имя кириллицей или латиницей) */
const isAlena = p => /красильников|krasilnikov/.test(norm(p.name));
const looksTest = p => /(^|[^а-яa-z])(тест|test)/.test(norm(p.name));

const FIXES = [
  {
    id: '2026-10-23-test-data',
    about: 'Убрать тестовые данные: пример (demo), карточки «тест»; в кастдеве — все клиентки, заведённые до утра 23.10, кроме Алены Красильниковой',
    /* until — клиентки, заведённые позже (настоящие анкеты после выкладки), не трогаем */
    run(store, {keep, until = Date.UTC(2026, 9, 23, 8, 0)}) {
      const people = store.list('people'), team = store.list('team'), cfg = store.list('cfg');
      const alena = people.filter(isAlena);
      const clientTest = p => alena.length > 0 && p.type === 'client' && (p.createdAt || 0) < until;
      const dropPeople = people.filter(p => !isAlena(p) && (p.demo === true || looksTest(p) || clientTest(p)));
      const dropTeam = team.filter(t => t.demo === true && !t.uid);
      const dropCfg = cfg.filter(c => c.demo === true);
      const removed = {people: dropPeople, team: dropTeam, cfg: dropCfg};
      if (dropPeople.length + dropTeam.length + dropCfg.length) keep(removed);
      Object.entries(removed).forEach(([c, docs]) => docs.forEach(d => store.set(c, d.id, null)));
      return {text: `оставили: ${alena.map(p => p.name).join(', ') || 'карточки Алены нет — клиенток без пометок не трогали'}; удалили карточек: ${dropPeople.length}, примеров команды: ${dropTeam.length}`,
        kept: alena.map(p => p.id), removed: Object.fromEntries(Object.entries(removed).map(([c, d]) => [c, d.map(x => x.id)]))};
    },
  },
];

/* копия удаляемого — до удаления; не записалась — правку не применяем */
function backup(dir, fixId, cols) {
  const d = path.join(dir, 'removed');
  fs.mkdirSync(d, {recursive: true});
  const out = {fix: fixId, at: new Date().toISOString(), collections: {}};
  Object.entries(cols).forEach(([c, docs]) => { out.collections[c] = Object.fromEntries(docs.map(({id, ...doc}) => [id, doc])); });
  fs.writeFileSync(path.join(d, `${fixId}.json`), JSON.stringify(out, null, 1), {mode: 0o600});
}

function runFixes(store, dir, {fixes = FIXES, log = console.log, opts = {}} = {}) {
  const file = path.join(dir, 'crm-fixes.json');
  let done = {};
  try { done = JSON.parse(fs.readFileSync(file, 'utf8')) || {}; } catch (e) { /* правок ещё не было */ }
  let changed = false;
  for (const fix of fixes) {
    if (done[fix.id]) continue;
    let r;
    /* упала — не отмечаем: попробуем при следующем запуске */
    try { r = fix.run(store, {keep: cols => backup(dir, fix.id, cols), ...opts}); }
    catch (e) { log(`Правка CRM ${fix.id} не применилась: ${e.message}`); continue; }
    done[fix.id] = {at: new Date().toISOString(), about: fix.about, ...r};
    changed = true;
    log(`Правка CRM ${fix.id}: ${r.text}`);
  }
  if (changed) {
    fs.mkdirSync(dir, {recursive: true});
    fs.writeFileSync(file, JSON.stringify(done, null, 1), {mode: 0o600});
    store.flush();
  }
  return done;
}

module.exports = {runFixes, FIXES, isAlena};
