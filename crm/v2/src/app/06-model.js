/* Модель CRM 2.0. Человек — один документ people/<id>: кто он (клиентка,
   эксперт, партнёр, амбассадор), уникальный код для ссылки, три шага
   (s1 — анкета, s2 — созвон, s3 — итог), ответы анкеты, заметки созвона,
   итог и короткая история. Статистика и рекомендации считаются из ответов. */

let MV = 0;
Store.subscribe(() => { MV++; });
function memo(fn) { let v = -1, val; return () => (v === MV ? val : (v = MV, val = fn())); }

/* адреса опубликованных страниц; руководитель может поменять в настройках */
const LINKS = {
  crm: 'https://claude.ai/artifact/CRM_URL_PLACEHOLDER',
  anketa: 'https://claude.ai/artifact/ANKETA_URL_PLACEHOLDER',
};
const settings = memo(() => ({anketaUrl: LINKS.anketa, ...(Store.get('cfg', 'settings') || {})}));

/* ── вопросы с правками команды ── */
/* для сравнения и для ссылки: без служебных полей и без текстов рекомендаций */
const strip = q => { const {hidden, custom, rec, ...rest} = q; return rest; };
const Questions = {
  set(type) {
    const d = Store.get('cfg', 'q_' + type);
    return {test: d && Array.isArray(d.test) ? d.test : clone(Q_DEFAULT[type].test), talk: d && Array.isArray(d.talk) ? d.talk : clone(Q_DEFAULT[type].talk)};
  },
  test(type) { return this.set(type).test.filter(q => !q.hidden); },
  talk(type) { return this.set(type).talk.filter(q => !q.hidden); },
  find(type, id) { return this.set(type).test.find(q => q.id === id) || null; },
  save(type, set) { return Store.put('cfg', 'q_' + type, {test: set.test, talk: set.talk, at: Date.now()}); },
  reset(type) { return Store.remove('cfg', 'q_' + type); },
  /* что изменили в анкете относительно стартового набора — едет в ссылке */
  diff(type) {
    const cur = this.set(type).test, def = Q_DEFAULT[type].test;
    const defIds = def.map(q => q.id);
    const h = cur.filter(q => q.hidden && defIds.includes(q.id)).map(q => q.id);
    const c = cur.filter(q => !q.hidden && (!defIds.includes(q.id) || JSON.stringify(strip(q)) !== JSON.stringify(strip(def.find(d => d.id === q.id))))).map(strip);
    const order = cur.filter(q => !q.hidden).map(q => q.id);
    const defOrder = [...def.filter(q => order.includes(q.id)).map(q => q.id), ...order.filter(id => !defIds.includes(id))];
    const s = JSON.stringify(order) !== JSON.stringify(defOrder) ? order : undefined;
    if (!h.length && !c.length && !s) return null;
    const d = {};
    if (h.length) d.h = h;
    if (c.length) d.c = c;
    if (s) d.s = s;
    return d;
  },
  edited(type) { return !!Store.get('cfg', 'q_' + type); },
};

/* ── люди ── */
const People = {
  all(type) { return Store.all('people').filter(p => !type || p.type === type).sort((a, b) => (b.touchedAt || b.createdAt || 0) - (a.touchedAt || a.createdAt || 0)); },
  get(id) { return id ? Store.get('people', id) : null; },
  byCode(code) { const c = String(code || '').toUpperCase(); return Store.all('people').find(p => p.code === c) || null; },
  name(p) { return p ? p.name || 'Без имени' : '—'; },
  /* в какой колонке человек: 1 — анкета, 2 — созвон, 3 — итог */
  col(p) {
    if (['new', 'sent'].includes(p.s1 || 'new')) return 1;
    if (['done', 'skip'].includes(p.s2)) return 3;
    return 2;
  },
  connected(p) { return p.type === 'client' ? ['done', 'fan'].includes(p.s3) : p.s3 === 'yes'; },
  /* строка под именем: без смайлов, чтобы читалась с одного взгляда */
  sub(p) {
    const a = p.answers || {};
    if (p.type === 'expert') return [p.topic || a.topic || (p.dirs || []).map(noEmo).join(', '), p.city].filter(Boolean).join(' · ');
    if (p.type === 'partner') return [noEmo(p.cat), p.city].filter(Boolean).join(' · ');
    if (p.type === 'amb') return [a.size ? `аудитория ${noEmo(a.size)}` : '', p.city].filter(Boolean).join(' · ');
    return [a.age ? noEmo(a.age) : '', p.city, a.stage ? noEmo(a.stage) : ''].filter(Boolean).join(' · ');
  },
  uniqueCode(name) {
    let code = refCodeFor(name || 'eva');
    const base = code.replace(/\d+$/, '');
    let n = 0;
    while (Store.all('people').some(p => p.code === code) && n < 50) { code = base + (100 + ((hashStr(name) + ++n * 37) % 900)); }
    return code;
  },
  create(f) {
    const now = Date.now();
    const doc = {s1: 'new', s2: 'none', s3: 'none', answers: {}, talk: {}, res: {tags: []}, createdAt: now, touchedAt: now, owner: Who.id(), ...f};
    doc.code = doc.code || this.uniqueCode(doc.name);
    doc.log = {[uid()]: {t: now, by: Who.id(), emo: '✨', text: f.ref ? `Пришла по ссылке ${f.ref}` : 'Добавлен в CRM'}, ...(f.log || {})};
    return Store.add('people', doc);
  },
  patch(id, p, logText = '', emo = '•') {
    const now = Date.now();
    const data = {...p, touchedAt: now};
    if (logText) data.log = {[uid()]: {t: now, by: Who.id(), emo, text: logText}};
    return Store.patch('people', id, data);
  },
  link(p) {
    const base = settings().anketaUrl || LINKS.anketa;
    const d = Questions.diff(p.type);
    return `${base}#${TYPES[p.type].letter}.${p.code}${d ? '.q' + Codec.encJson(d) : ''}`;
  },
  canEdit() { return Who.can('edit') && !Who.readOnly(); },
  invited(p) { return Store.all('people').filter(x => x.ref && x.ref === p.code); },
};

/* ── ответы анкеты: из ссылки или вручную ── */
const KEY_FIELDS = ['name', 'city', 'tg', 'cat', 'dirs', 'contact'];
function keyPatch(p, type, answers) {
  const out = {};
  Questions.set(type).test.forEach(q => {
    if (!q.key) return;
    const v = answers[q.id];
    if (v === undefined || v === '' || (Array.isArray(v) && !v.length)) return;
    if (!p || !p[q.key] || (Array.isArray(p[q.key]) && !p[q.key].length) || q.key === 'dirs' || q.key === 'cat') out[q.key] = v;
  });
  return out;
}
const Import = {
  /* сохранить ответы, присланные по ссылке: к карточке по коду или новой карточкой */
  apply(pl) {
    const type = TYPE_BY_LETTER[pl.t] || pl.t;
    if (!TYPES[type]) throw new Error('Неизвестный тип анкеты');
    const answers = pl.a || {};
    const owner = pl.c ? People.byCode(pl.c) : null;
    if (owner && !pl.r) {
      People.patch(owner.id, {answers: {...(owner.answers || {}), ...answers}, s1: 'done', answeredAt: pl.at || Date.now(), answeredBy: 'self', ...keyPatch(owner, type, answers)}, 'Заполнила анкету по ссылке', '📝');
      return owner.id;
    }
    const fromKeys = keyPatch(null, type, answers);
    return People.create({type, name: fromKeys.name || 'Без имени', ...fromKeys, answers, s1: 'done', answeredAt: pl.at || Date.now(), answeredBy: 'self', ref: pl.r && owner ? owner.code : pl.r ? pl.c : null, source: pl.r ? 'ref' : 'link'});
  },
};

/* ── статистика ответов ── */
/* шкала 1–5 цифрами: крайние значения с подписью, без смайлов */
const scaleName = (q, i) => (i === 0 ? `1 — ${q.lo || 'совсем нет'}` : i === 4 ? `5 — ${q.hi || 'очень'}` : String(i + 1));
const Stats = {
  agg(type, list = People.all(type)) {
    const answered = list.filter(p => p.answers && Object.keys(p.answers).length);
    return Questions.test(type).filter(q => ['one', 'many', 'scale'].includes(q.k)).map(q => {
      const counts = {};
      let n = 0, total = 0;
      answered.forEach(p => {
        const v = p.answers[q.id];
        if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return;
        n++;
        if (q.k === 'scale') { total += Number(v) || 0; counts[v] = (counts[v] || 0) + 1; return; }
        answerLabels(q, v).forEach(l => { counts[l] = (counts[l] || 0) + 1; });
      });
      const opts = q.k === 'scale' ? [1, 2, 3, 4, 5].map(String) : (q.o || []);
      const rows = opts.map((o, i) => ({i, name: q.k === 'scale' ? scaleName(q, i) : o, v: counts[o] || 0})).filter(r => r.v || q.k !== 'many');
      Object.keys(counts).forEach(k => { if (q.k !== 'scale' && !opts.includes(k)) rows.push({i: -1, name: k, v: counts[k]}); });
      return {q, n, rows, avg: q.k === 'scale' && n ? total / n : null};
    });
  },
  top(a) { const r = a.rows.slice().sort((x, y) => y.v - x.v)[0]; return r && r.v ? r : null; },
  funnel(type) { const L = People.all(type); return {all: L.length, c1: L.filter(p => People.col(p) === 1).length, c2: L.filter(p => People.col(p) === 2).length, c3: L.filter(p => People.col(p) === 3).length, yes: L.filter(People.connected).length, answered: L.filter(p => p.s1 === 'done').length}; },
  quotes() {
    const out = [];
    Store.all('people').forEach(p => Object.entries(p.talk || {}).forEach(([qid, x]) => { if (x && x.star && x.a) out.push({p, qid, text: x.a, t: x.t || p.talkAt || 0}); }));
    return out.sort((a, b) => b.t - a.t);
  },
  insightTags() {
    const m = {};
    People.all('client').forEach(p => ((p.res || {}).tags || []).forEach(t => { m[t] = (m[t] || 0) + 1; }));
    return Object.entries(m).map(([name, v]) => ({name, v})).sort((a, b) => b.v - a.v);
  },
  dirCoverage() {
    return DIRECTIONS.map(d => {
      const L = People.all('expert').filter(p => (p.dirs || []).includes(d));
      return {d, n: L.length, yes: L.filter(People.connected).length, course: L.filter(p => /Да|готовый/.test(String((p.answers || {}).course || ''))).length};
    });
  },
  catCoverage() { return PARTNER_CATS.map(c => ({c, n: People.all('partner').filter(p => p.cat === c).length, yes: People.all('partner').filter(p => p.cat === c && People.connected(p)).length})); },
};

/* ── рекомендации двух видов: «сделать сейчас» (где люди застряли) и
   «что улучшить» (из ответов и пробелов в экспертах и партнёрах) ── */
const REACH = {'До 500': 300, '500–3 000': 1500, '3–10 тыс.': 6000, '10–50 тыс.': 25000, 'Больше 50 тыс.': 60000};
/* группа, где таких людей больше всего, — туда ведёт ссылка */
const topType = (list, def = 'client') => { const m = {}; list.forEach(p => { m[p.type] = (m[p.type] || 0) + 1; }); return Object.keys(m).sort((a, b) => m[b] - m[a])[0] || def; };
const names3 = list => list.slice(0, 3).map(People.name).join(', ') + (list.length > 3 ? ` и ещё ${list.length - 3}` : '');
function recommendations() {
  const out = [];
  const add = (kind, type, text, why, w, href = type) => out.push({kind, type, text: noEmo(text), why: noEmo(why), w, href});
  const t0 = Date.now();
  /* сделать сейчас */
  const stuck2 = Store.all('people').filter(p => p.s1 === 'done' && p.s2 === 'none' && (t0 - (p.answeredAt || p.touchedAt || 0)) > 2 * 864e5);
  if (stuck2.length) add('now', 'all', `Назначьте созвон: ${stuck2.length} ${plural(stuck2.length, 'человек заполнил', 'человека заполнили', 'человек заполнили')} анкету больше двух дней назад. Пока интерес тёплый.`, names3(stuck2), 1.2, topType(stuck2));
  const stuck3 = Store.all('people').filter(p => p.type !== 'client' && ['done', 'skip'].includes(p.s2) && (p.s3 || 'none') === 'none');
  if (stuck3.length) add('now', 'all', `Запишите решение после созвона: ${stuck3.length} ${plural(stuck3.length, 'человек', 'человека', 'человек')} без итога.`, names3(stuck3), 1.1, topType(stuck3, 'expert'));
  const clientsNoInsight = People.all('client').filter(p => ['done', 'skip'].includes(p.s2) && (p.s3 || 'none') === 'none');
  if (clientsNoInsight.length) add('now', 'client', `Разберите ${clientsNoInsight.length} ${plural(clientsNoInsight.length, 'интервью', 'интервью', 'интервью')}, пока разговор свежий: отметьте, что услышали.`, names3(clientsNoInsight), 1.05);
  const noTax = People.all('amb').filter(p => /Пока нет/.test(String((p.answers || {}).tax || '')) && /карту/.test(String((p.answers || {}).pay || '')));
  if (noTax.length) add('now', 'amb', `Отправьте памятку про «Мой налог»: ${noTax.length} ${plural(noTax.length, 'амбассадор хочет', 'амбассадора хотят', 'амбассадоров хотят')} выплаты на карту, но без статуса. Или предложите баланс Евы +10%.`, names3(noTax), 0.7);
  /* что улучшить: самый частый вариант ответа, если он набрал заметную долю */
  Object.keys(TYPES).forEach(type => {
    Stats.agg(type).forEach(a => {
      if (!a.q.rec || a.n < 3) return;
      const top = Stats.top(a);
      if (!top || top.i < 0 || !a.q.rec[top.i]) return;
      const share = top.v / a.n;
      if (share < 0.3) return;
      add('idea', type, a.q.rec[top.i], `${top.v} из ${a.n} ответили «${noEmo(top.name)}»`, share + (type === 'client' ? 0.3 : 0));
    });
  });
  const sleepPain = People.all('client').filter(p => ((p.answers || {}).pain || []).some(x => /сплю/.test(x))).length;
  if (sleepPain >= 2 && !DIRECTIONS.some(d => /Сон/.test(d))) add('idea', 'client', 'Плохой сон — частая боль, а направления «Сон» среди 14 нет. Добавьте направление и найдите эксперта.', `${sleepPain} ${plural(sleepPain, 'клиентка жалуется', 'клиентки жалуются', 'клиенток жалуются')} на сон`, 0.95);
  const empty = Stats.dirCoverage().filter(x => !x.n).map(x => noEmo(x.d));
  if (empty.length) add('idea', 'expert', `Найдите экспертов по направлениям: ${empty.slice(0, 5).join(', ')}${empty.length > 5 ? ` и ещё ${empty.length - 5}` : ''}. Пока там никого.`, `закрыто ${DIRECTIONS.length - empty.length} из ${DIRECTIONS.length} направлений`, 0.9);
  const wantCourse = People.all('expert').filter(p => /Да, уже есть идея/.test(String((p.answers || {}).course || '')));
  if (wantCourse.length) add('idea', 'expert', `Поставьте съёмочные дни в план: ${wantCourse.length} ${plural(wantCourse.length, 'эксперт хочет', 'эксперта хотят', 'экспертов хотят')} снять курс.`, names3(wantCourse), 0.8);
  const emptyCats = Stats.catCoverage().filter(x => !x.n).map(x => noEmo(x.c));
  if (emptyCats.length && People.all('partner').length) add('idea', 'partner', `Нет партнёров в категориях: ${emptyCats.slice(0, 4).join(', ')}${emptyCats.length > 4 ? ` и ещё ${emptyCats.length - 4}` : ''}.`, `охвачено ${PARTNER_CATS.length - emptyCats.length} из ${PARTNER_CATS.length} категорий`, 0.5);
  const reach = sum(People.all('amb'), p => REACH[(p.answers || {}).size] || 0);
  if (reach) add('idea', 'amb', `Амбассадоры читают около ${fmt(reach)} человек. Даже 1% — это ${fmt(Math.round(reach * 0.01))} ${plural(Math.round(reach * 0.01), 'регистрация', 'регистрации', 'регистраций')}.`, 'по ответам «Сколько людей тебя читает»', 0.4);
  return out.sort((a, b) => b.w - a.w);
}
