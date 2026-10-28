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

/* ── интервью кастдева из документов (прежний набор из 37 вопросов) → нынешние 18 вопросов ── */
const CD = require('./crm-data/custdev-2026-10.json');
/* к вопросу нового набора — ответы на слитые с ним прежние вопросы, с подписью */
const MERGE = {
  t_job: [['t_day', 'Обычный день']], t_pain: [['t_drain', 'Что забирает силы']], t_morning: [['t_selftime', 'Время для себя утром']],
  t_pauses: [['t_audio', 'Подкасты и музыка']], t_evening: [['t_switch', 'Как переключается на отдых'], ['t_fallasleep', 'Сон']],
  t_happy: [['t_mood', 'Что поднимает настроение']], t_lack: [['t_hour', 'Лишний час для себя']], t_apps: [['t_worth', 'За что не жалко денег']],
  t_favapp: [['t_annoy', 'Что раздражает в приложениях'], ['t_push', 'Пуши']], t_apply: [['t_saved', 'Сохраняет «на потом»'], ['t_overload', 'Перегруз'], ['t_how', 'Как смотрит полезный контент']],
  t_trust: [['t_follow', 'Кого слушает']], t_idealvideo: [['t_visual', 'Красивый кадр или разбор']], t_change: [['t_result', 'Как понимает, что изменилась']],
};
const NEW_IDS = ['t_job', 't_weather', 't_pain', 't_goal', 't_morning', 't_pauses', 't_evening', 't_happy', 't_lack', 't_last', 't_apps', 't_favapp', 't_apply', 't_trust', 't_idealvideo', 't_three', 't_change', 't_friend'];
const EXTRA = [['t_best', 'Какая сфера закрыта лучше всего'], ['t_grateful', 'За что благодарна своему образу жизни']];
function talkOf(old, now, stars = [], weather = '') {
  const talk = {};
  NEW_IDS.forEach(id => {
    const main = old[id] || '';
    const parts = [main, ...(MERGE[id] || []).map(([o, l]) => (old[o] && old[o] !== main ? `${l}: ${old[o]}` : ''))].filter(Boolean);
    if (!parts.length) return;
    talk[id] = {a: parts.join('\n\n'), asked: true, t: now, doc: true, ...(stars.includes(id) ? {star: true} : {}), ...(id === 't_weather' && weather ? {pick: weather} : {})};
  });
  const extra = EXTRA.map(([o, l]) => (old[o] ? `${l}: ${old[o]}` : '')).filter(Boolean);
  if (extra.length) talk._extra = {a: extra.join('\n\n'), t: now, doc: true};
  return talk;
}
const RU_LAT = {а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ы: 'y', э: 'e', ю: 'yu', я: 'ya'};
function codeFor(store, name, num) {
  const lat = [...norm(name).split(' ')[0]].map(c => RU_LAT[c] ?? (/[a-z0-9]/.test(c) ? c : '')).join('').slice(0, 10).toUpperCase() || 'EVA';
  const used = new Set(store.list('people').map(p => p.code));
  for (let n = 0; n < 900; n++) { const c = lat + (100 + ((num * 137 + n * 61) % 900)); if (!used.has(c)) return c; }
  return lat + Date.now().toString(36).toUpperCase();
}

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
  {
    id: '2026-10-28-custdev-1-3',
    about: 'Интервью кастдева 1–3 из документов: Алена Красильникова, Раиля Кадяшева, Светлана Хилько — карточки, ответы интервью, итог, этап',
    /* карточка есть — дописываем только пустое (записанное командой не трогаем), этап только вперёд; нет — заводим */
    run(store, {now = Date.now()} = {}) {
      const head = store.list('team').find(t => t.head && !t.archived);
      const done = [];
      CD.people.forEach((x, i) => {
        const t0 = now - (CD.people.length - i) * 60e3;
        const talk = talkOf(x.talk, t0, x.stars, x.weather);
        const res = x.res ? {tags: x.res.tags, main: x.res.main, idea: x.res.idea} : null;
        const stage = x.done ? {s2: 'done', s3: res ? 'done' : 'none', talkAt: t0} : {s2: 'none', s3: 'none'};
        const log = {t: t0, by: 'fix', emo: '📄', text: `Интервью ${x.num}. CD из документа: ${Object.keys(talk).filter(k => k !== '_extra').length} ответов${x.note ? '. ' + x.note : ''}`};
        const cur = store.list('people').find(p => p.type === 'client' && norm(p.name).includes(x.match));
        if (!cur) {
          const id = `cd${x.num}${now.toString(36)}`;
          store.set('people', id, {type: 'client', name: x.name, code: codeFor(store, x.name, x.num), ...(x.city ? {city: x.city} : {}), owner: head ? head.id : null,
            s1: 'skip', ...stage, answers: {}, talk, res: res || {tags: []}, tags: x.tags, source: 'interview-doc', createdAt: t0, touchedAt: now,
            fresh: {at: now, kind: 'talk', text: `${x.name}: интервью из документа в карточке`}, log: {['fx' + x.num + now.toString(36)]: log}});
          done.push(`${x.name} — новая карточка`);
          return;
        }
        const {id, ...doc} = cur;
        const ct = {...(doc.talk || {})};
        Object.entries(talk).forEach(([k, v]) => { if (!(ct[k] && ct[k].a)) ct[k] = v; });
        const col = !['done', 'skip'].includes(doc.s1 || 'new') ? 1 : ['done', 'skip'].includes(doc.s2) ? 3 : 2;
        const r0 = doc.res || {};
        store.set('people', id, {...doc, talk: ct, s1: ['done', 'skip'].includes(doc.s1) ? doc.s1 : 'skip',
          ...(x.done && col < 3 ? stage : !x.done && col < 2 ? {s2: 'none'} : {}),
          ...(x.done && (doc.s3 || 'none') === 'none' && res ? {s3: 'done'} : {}),
          res: res ? {...r0, tags: (r0.tags || []).length ? r0.tags : res.tags, main: r0.main || res.main, idea: r0.idea || res.idea} : r0,
          tags: [...new Set([...(doc.tags || []), ...x.tags])], owner: doc.owner || (head ? head.id : null), touchedAt: now,
          fresh: {at: now, kind: 'talk', text: `${x.name}: интервью из документа в карточке`}, log: {...(doc.log || {}), ['fx' + x.num + now.toString(36)]: log}});
        done.push(`${x.name} — дописали в карточку`);
      });
      return {text: done.join('; ')};
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
