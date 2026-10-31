// Внутренний блокчейн АСЬКИ: журнал, где каждая запись (блок) хранит хеш предыдущей.
// Поменяй любую старую запись — сломаются хеши всех следующих, это видно проверкой verify().
// Сюда пишется всё, что «оцифровывается»: занесённые в реестр музыка, кино и книги, подтверждённое авторство,
// выпуск ночных НФТ-аватаров, приглашения в Блэк. Это не публичная сеть — цепочка живёт на сервере АСЬКИ.
import crypto from 'node:crypto';

export const GENESIS = '0'.repeat(64);

const blockHash = (prev, id, kind, ref, actor, data, at) =>
  crypto.createHash('sha256').update(`${prev}|${id}|${kind}|${ref}|${actor ?? ''}|${data}|${at}`).digest('hex');

// Новый блок (вызывать внутри транзакции, если рядом меняются другие таблицы)
export function append(db, { kind, ref, actor = null, data = {} }) {
  const last = db.prepare('SELECT id, hash FROM ledger ORDER BY id DESC LIMIT 1').get();
  const id = (last?.id || 0) + 1;
  const prev = last?.hash || GENESIS;
  const at = Date.now();
  const json = JSON.stringify(data);
  const hash = blockHash(prev, id, kind, String(ref), actor, json, at);
  db.prepare('INSERT INTO ledger (id, kind, ref, actor_id, data, prev_hash, hash, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, kind, String(ref), actor, json, prev, hash, at);
  return { block: id, hash };
}

// Пересчитать всю цепочку: где первый сломанный блок
export function verify(db) {
  let prev = GENESIS;
  let n = 0;
  for (const b of db.prepare('SELECT * FROM ledger ORDER BY id').iterate()) {
    n++;
    if (b.prev_hash !== prev || blockHash(prev, b.id, b.kind, b.ref, b.actor_id, b.data, b.at) !== b.hash || b.id !== n) {
      return { ok: false, blocks: n, brokenAt: b.id };
    }
    prev = b.hash;
  }
  return { ok: true, blocks: n, head: prev };
}

export const blockView = (b) => b && ({
  block: b.id, kind: b.kind, ref: b.ref, actorId: b.actor_id, data: JSON.parse(b.data), prevHash: b.prev_hash, hash: b.hash, at: b.at,
});
export const blockOf = (db, id) => blockView(db.prepare('SELECT * FROM ledger WHERE id = ?').get(id));
