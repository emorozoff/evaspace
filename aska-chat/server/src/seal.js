// Шифрование для ботов (Аська, ИИ-люди, личные ИИ). Боты — такие же участники чатов,
// только их ключи лежат на сервере. Формат тот же, что в client/src/lib/protocol.ts:
// каждый участник получает свою копию, внутри шифра — id чата и uuid.
import nacl from 'tweetnacl';
import crypto from 'node:crypto';

const enc = new TextEncoder();
const dec = new TextDecoder();
export const b64 = (u8) => Buffer.from(u8).toString('base64');
export const unb64 = (s) => new Uint8Array(Buffer.from(s, 'base64'));

export function newKeys() {
  const kp = nacl.box.keyPair();
  return { pk: b64(kp.publicKey), sk: b64(kp.secretKey) };
}

export function previewText(body) {
  if (body.kind === 'image') return body.text ? `📷 ${body.text}` : '📷 Фото';
  if (body.kind === 'video') return '🎬 Видео-квадратик';
  const t = (body.text || '').replace(/\s+/g, ' ').trim();
  return t.length > 140 ? `${t.slice(0, 140)}…` : t;
}

function box(plain, theirPk, mySk) {
  const n = nacl.randomBytes(24);
  return { n: b64(n), c: b64(nacl.box(plain, n, unb64(theirPk), unb64(mySk))) };
}

// members: [{ id, pk }] — pk в base64
export function encodeOutgoing(chatId, uuid, body, members, myId, mySk) {
  const plain = enc.encode(JSON.stringify({ v: 1, chat: chatId, uuid, ...body }));
  const preview = enc.encode(JSON.stringify({ t: previewText(body) }));
  return members.map((m) => {
    const main = box(plain, m.pk, mySk);
    if (m.id === myId) return { to: m.id, ...main };
    const p = box(preview, m.pk, mySk);
    return { to: m.id, n: main.n, c: main.c, pn: p.n, pc: p.c };
  });
}

// Открыть свою копию. Возвращает всё содержимое (с act/gift и прочим) или null.
export function decodeIncoming(row, senderPks, mySk) {
  for (const pk of [].concat(senderPks).filter(Boolean)) {
    let plain = null;
    try { plain = nacl.box.open(unb64(row.c), unb64(row.n), unb64(pk), unb64(mySk)); } catch { plain = null; }
    if (!plain) continue;
    try {
      const inner = JSON.parse(dec.decode(plain));
      if (inner.v !== 1 || inner.chat !== row.chatId || inner.uuid !== row.uuid) return null;
      return inner;
    } catch {
      return null;
    }
  }
  return null;
}

export const newUuid = () => crypto.randomUUID();
