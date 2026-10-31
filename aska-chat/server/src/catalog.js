// ⛓ Реестр АСЬКИ: музыка, кино, книги. Занёс первым — запись твоя («кто первый занёс, того и тапки»):
// у неё номер (M-000013, F-…, B-…), отметка «занёс(ла) …» и блок во внутреннем блокчейне (ledger.js).
// Авторство — отдельно: человек отмечает «это моё», администрация согласовывает и ставит галочку (тоже блоком в цепочке).
// В реестре — сведения и ссылка, сами файлы АСЬКА не хранит: чужие песни и фильмы не раздаём.
import { tx, getSetting, setSetting } from './db.js';
import * as L from './ledger.js';
import * as TIER from './tiers.js';

export const KINDS = { music: { prefix: 'M', name: 'Музыка' }, film: { prefix: 'F', name: 'Кино' }, book: { prefix: 'B', name: 'Книги' } };
export const ADD_BONUS = 5;       // за новую запись…
export const ADD_BONUS_DAY = 10;  // …не больше 10 раз в день
const norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^0-9a-zа-я]+/g, ' ').trim();
const clean = (s, max) => {
  const t = String(s ?? '').replace(/[\u0000-\u001f\u007f‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : null;
};
export const tokenOf = (kind, id) => `${KINDS[kind]?.prefix || 'X'}-${String(id).padStart(6, '0')}`;
const mskDay = () => new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 10);

// Хиты Аськи — свои инструменталки (синтез в music.js), авторство АСЬКИ подтверждено сразу.
// И несколько произведений-классики в общественном достоянии, чтобы реестр не был пустым.
const SEED = [
  ...[['dialup', 'Дайлап-любовь', 'Катюха_98 и Модемы', 1999], ['summer99', 'Лето 1999', 'DJ Serёga', 1999], ['cassette', 'Кассета', 'Ленка_Питер', 1998],
    ['pager', 'Пейджер молчит', 'Макс_Философ', 1997], ['disco99', 'Дискотека 99', 'DJ Serёga', 1999], ['sevens', 'Три семёрки', 'DJ Serёga', 2000],
    ['bsod', 'Синий экран', 'ha©keR_Vova', 1998], ['karas', 'Карась', 'Батя_в_сети', 1996], ['uhoh', 'О-оу (ремикс)', 'Аська', 1998],
    ['cookies', 'Печеньки', 'Аська', 1999], ['lisboa', 'Урюпинск — Лиссабон', 'Аська и Макс', 2000], ['flower', 'Цветочек', 'АСЬКА (заставка)', 1998]]
    .map(([synth, title, author, year]) => ({ kind: 'music', title, author, year, synth, rights: 'verified', note: 'Свой трек АСЬКИ: играет прямо в приложении' })),
  { kind: 'music', title: 'Щелкунчик', author: 'Пётр Чайковский', year: 1892, note: 'Общественное достояние' },
  { kind: 'film', title: 'Прибытие поезда на вокзал Ла-Сьота', author: 'Братья Люмьер', year: 1896, note: 'Общественное достояние' },
  { kind: 'film', title: 'Путешествие на Луну', author: 'Жорж Мельес', year: 1902, note: 'Общественное достояние' },
  { kind: 'book', title: 'Евгений Онегин', author: 'Александр Пушкин', year: 1833, note: 'Общественное достояние' },
  { kind: 'book', title: 'Война и мир', author: 'Лев Толстой', year: 1869, note: 'Общественное достояние' },
  { kind: 'book', title: 'Вишнёвый сад', author: 'Антон Чехов', year: 1904, note: 'Общественное достояние' },
];

export function createCatalog({ db, addCoins, userRow, askaId }) {
  const nameOf = (id) => (id ? userRow(id)?.display_name || '?' : 'АСЬКА');
  const view = (r) => r && ({
    id: r.id, token: tokenOf(r.kind, r.id), kind: r.kind, title: r.title, author: r.author, year: r.year, link: r.link || null, note: r.note || '',
    addedBy: r.added_by, addedByName: nameOf(r.added_by), createdAt: r.created_at, block: r.block,
    hash: db.prepare('SELECT hash FROM ledger WHERE id = ?').get(r.block)?.hash || '',
    rights: r.rights, rightsBy: r.rights_by, rightsByName: r.rights_by ? nameOf(r.rights_by) : null, rightsNote: r.rights_note || '', rightsBlock: r.rights_block,
    synth: r.synth || null,
  });

  function insert(userId, it) {
    const key = `${it.kind}|${norm(it.title)}|${norm(it.author)}`;
    if (db.prepare('SELECT 1 FROM catalog_items WHERE key = ?').get(key)) return null;
    const { lastInsertRowid } = db.prepare(`INSERT INTO catalog_items (kind, key, title, author, year, link, note, added_by, created_at, block, rights, rights_by, synth)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`).run(it.kind, key, it.title, it.author, it.year ?? null, it.link ?? null, it.note ?? null, userId,
      Date.now(), it.rights || 'none', it.rights && it.rights !== 'none' ? userId : null, it.synth ?? null);
    const id = Number(lastInsertRowid);
    const { block } = L.append(db, { kind: 'catalog.add', ref: tokenOf(it.kind, id), actor: userId, data: { kind: it.kind, title: it.title, author: it.author, year: it.year ?? null } });
    db.prepare('UPDATE catalog_items SET block = ? WHERE id = ?').run(block, id);
    if (it.rights === 'verified') {
      const rb = L.append(db, { kind: 'catalog.rights', ref: tokenOf(it.kind, id), actor: userId, data: { holder: nameOf(userId), ok: true } });
      db.prepare('UPDATE catalog_items SET rights_block = ? WHERE id = ?').run(rb.block, id);
    }
    return id;
  }

  function seed() {
    if (getSetting(db, 'catalog_seeded') === '1') return;
    const aska = askaId();
    if (!aska) return;
    tx(db, () => { for (const it of SEED) insert(aska, it); });
    setSetting(db, 'catalog_seeded', '1');
  }

  function list({ kind, q, before, userId }) {
    const where = ['1 = 1'];
    const args = [];
    if (KINDS[kind]) { where.push('kind = ?'); args.push(kind); }
    if (before) { where.push('id < ?'); args.push(before); }
    if (userId) { where.push('added_by = ?'); args.push(userId); }
    let rows = db.prepare(`SELECT * FROM catalog_items WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT 200`).all(...args);
    if (q) { const n = norm(q); rows = rows.filter((r) => norm(`${r.title} ${r.author}`).includes(n)); }
    return rows.slice(0, 60).map(view);
  }

  // Занести: Голд и выше. link — только http(s). claim — «это моё произведение» (ждёт согласования).
  function add(userId, b) {
    const u = userRow(userId);
    if (!TIER.perks(u).catalogAdd) return { error: 'level', status: 403 };
    const kind = KINDS[b?.kind] ? b.kind : null;
    const title = clean(b?.title, 120);
    const author = clean(b?.author, 80);
    const link = b?.link ? clean(b.link, 300) : '';
    const note = b?.note ? clean(b.note, 200) : '';
    const year = b?.year == null || b.year === '' ? null : Number(b.year);
    if (!kind || !title || !author || link === null || note === null || (year !== null && !(Number.isInteger(year) && year >= 1000 && year <= 2100))) return { error: 'bad_request', status: 400 };
    if (link && !/^https?:\/\/[^\s]+$/i.test(link)) return { error: 'bad_link', status: 400 };
    const key = `${kind}|${norm(title)}|${norm(author)}`;
    const existing = db.prepare('SELECT * FROM catalog_items WHERE key = ?').get(key);
    if (existing) return { error: 'exists', status: 409, item: view(existing) };
    const id = tx(db, () => {
      const nid = insert(userId, { kind, title, author, year, link: link || null, note: note || null, rights: b?.claim ? 'claimed' : 'none' });
      const day = mskDay();
      const k = `catalog_bonus:${userId}:${day}`;
      const n = Number(getSetting(db, k) || 0);
      if (n < ADD_BONUS_DAY) { addCoins(userId, ADD_BONUS, `занёс(ла) в реестр ${tokenOf(kind, nid)}`); setSetting(db, k, String(n + 1)); }
      return nid;
    });
    return { item: view(db.prepare('SELECT * FROM catalog_items WHERE id = ?').get(id)) };
  }

  // «Это моё» для уже занесённой записи (если авторство ещё никто не заявил)
  function claim(userId, id) {
    const u = userRow(userId);
    if (!TIER.perks(u).catalogAdd) return { error: 'level', status: 403 };
    const r = db.prepare('SELECT * FROM catalog_items WHERE id = ?').get(id);
    if (!r) return { error: 'not_found', status: 404 };
    if (r.rights !== 'none' && r.rights !== 'rejected') return { error: 'claimed', status: 409 };
    db.prepare("UPDATE catalog_items SET rights = 'claimed', rights_by = ?, rights_note = NULL WHERE id = ?").run(userId, id);
    return { item: view(db.prepare('SELECT * FROM catalog_items WHERE id = ?').get(id)) };
  }

  // Администрация согласовала (или нет) авторство — блок в цепочке
  function decide(adminId, id, ok, note) {
    const r = db.prepare('SELECT * FROM catalog_items WHERE id = ?').get(id);
    if (!r || r.rights !== 'claimed') return { error: 'not_found', status: 404 };
    return tx(db, () => {
      const n = note ? String(note).slice(0, 200) : null;
      const { block } = L.append(db, { kind: 'catalog.rights', ref: tokenOf(r.kind, r.id), actor: adminId, data: { holder: nameOf(r.rights_by), ok: Boolean(ok), note: n } });
      db.prepare('UPDATE catalog_items SET rights = ?, rights_note = ?, rights_block = ? WHERE id = ?').run(ok ? 'verified' : 'rejected', n, block, id);
      return { item: view(db.prepare('SELECT * FROM catalog_items WHERE id = ?').get(id)) };
    });
  }

  const claims = () => db.prepare("SELECT * FROM catalog_items WHERE rights = 'claimed' ORDER BY id").all().map(view);
  const get = (id) => view(db.prepare('SELECT * FROM catalog_items WHERE id = ?').get(id));

  return { seed, list, add, claim, decide, claims, get, view };
}
