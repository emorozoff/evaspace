import express from 'express';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import { openDb, tx, GENERAL_CHAT, getSetting, setSetting } from './db.js';
import { createPush, isAllowedEndpoint } from './push.js';
import { createAi } from './ai.js';
import { createBots } from './bots.js';
import { encodeOutgoing as sealOutgoing, newUuid } from './seal.js';
import { createSms, createCodes, normalizePhone, looksLikePhone } from './phone.js';
import { freePlate, normalizePlate, looksLikePlate, ADMIN_PLATE } from './plates.js';

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const UUID_RE = /^[A-Za-z0-9-]{8,64}$/;
const BLOB_ID_RE = /^[a-f0-9]{32}$/;
const B64_RE = /^[A-Za-z0-9+/]*={0,2}$/;
const GIFT_IDS = new Set(['flowers', 'coffee', 'cake', 'hug', 'star', 'heart']);

const sha256hex = (s) => crypto.createHash('sha256').update(s).digest('hex');
const randomToken = () => crypto.randomBytes(32).toString('base64url');

function b64Bytes(s, exact, maxLen = 200) {
  if (typeof s !== 'string' || s.length > maxLen || s.length % 4 !== 0 || !B64_RE.test(s)) return false;
  if (exact === undefined) return true;
  return Buffer.from(s, 'base64').length === exact;
}

export function normalizeInvite(code) {
  return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function newInviteCode() {
  const bytes = crypto.randomBytes(8);
  let s = '';
  for (const b of bytes) s += INVITE_ALPHABET[b % INVITE_ALPHABET.length];
  return s;
}

export function formatInvite(code) {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function createInvite(db, createdBy = null) {
  const code = newInviteCode();
  db.prepare('INSERT INTO invites (code, created_by, created_at) VALUES (?, ?, ?)').run(code, createdBy, Date.now());
  return code;
}

function cleanText(s, max) {
  if (typeof s !== 'string') return null;
  const t = s.replace(/[\u0000-\u0008\u000b-\u001f\u007f​-‏‪-‮⁦-⁩]/g, '').replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : null;
}
function cleanName(s) {
  const t = cleanText(s, 40);
  return t && t.length >= 1 ? t : null;
}

// А042МР777 → a042mr777: внутреннее имя для входа, его никто не придумывает
const TRANSLIT = { А: 'a', В: 'v', Е: 'e', К: 'k', М: 'm', Н: 'n', О: 'o', Р: 'r', С: 's', Т: 't', У: 'u', Х: 'h' };
const plateUsername = (plate) => plate.replace(/[А-Я]/g, (c) => TRANSLIT[c] || 'x').toLowerCase();

export function createApp({
  dataDir, staticDir, publicUrl, pushSender, smsSender, aiImpl, botTiming, startBots = true, trustProxy = false, log = console.log,
}) {
  const db = openDb(dataDir);
  const blobDir = path.join(dataDir, 'blobs');
  fs.mkdirSync(blobDir, { recursive: true });
  const push = createPush({ db, publicUrl, sender: pushSender, log });

  let serverSecret = getSetting(db, 'secret');
  if (!serverSecret) {
    serverSecret = crypto.randomBytes(32).toString('hex');
    setSetting(db, 'secret', serverSecret);
  }
  const ai = createAi({ db, impl: aiImpl, log });
  const sms = createSms({ db, sender: smsSender, log });
  const codes = createCodes({ db, secret: serverSecret });

  // Номера АСЬКИ тем, у кого их ещё нет: первый номер серии — администратору
  for (const u of db.prepare("SELECT id, is_admin FROM users WHERE kind = 'human' AND plate IS NULL ORDER BY id").all()) {
    const adminFree = u.is_admin && !db.prepare('SELECT 1 FROM users WHERE plate = ?').get(ADMIN_PLATE);
    db.prepare('UPDATE users SET plate = ? WHERE id = ?').run(adminFree ? ADMIN_PLATE : freePlate(db), u.id);
  }

  // ---------- вспомогательное ----------

  const hits = new Map();
  function allow(key, max, windowMs) {
    const now = Date.now();
    const h = hits.get(key);
    if (!h || h.reset < now) {
      hits.set(key, { count: 1, reset: now + windowMs });
      return true;
    }
    h.count += 1;
    return h.count <= max;
  }
  const hitsCleanup = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  }, 60_000);
  hitsCleanup.unref();

  const userRow = (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id);

  function sessionByToken(token) {
    if (!token || typeof token !== 'string' || token.length > 100) return null;
    const hash = sha256hex(token);
    const row = db.prepare('SELECT token_hash, user_id, last_seen FROM sessions WHERE token_hash = ?').get(hash);
    if (row && Date.now() - row.last_seen > 3_600_000) {
      db.prepare('UPDATE sessions SET last_seen = ? WHERE token_hash = ?').run(Date.now(), hash);
    }
    return row || null;
  }

  function createSession(userId) {
    const token = randomToken();
    const now = Date.now();
    db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, last_seen) VALUES (?, ?, ?, ?)')
      .run(sha256hex(token), userId, now, now);
    return token;
  }

  const bearer = (req) => { const h = req.get('authorization') || ''; return h.startsWith('Bearer ') ? h.slice(7) : null; };

  function auth(req, res, next) {
    const s = sessionByToken(bearer(req));
    if (!s) return res.status(401).json({ error: 'unauthorized' });
    req.userId = s.user_id;
    req.sessionHash = s.token_hash;
    next();
  }

  function admin(req, res, next) {
    if (!userRow(req.userId)?.is_admin) return res.status(403).json({ error: 'not_admin' });
    next();
  }

  // ИИ-люди для остальных выглядят как обычные люди: «person» наружу не отдаём
  function publicUser(u) {
    const o = {
      id: u.id, username: u.username, displayName: u.display_name, boxPk: u.box_pk,
      plate: u.plate || null, about: u.about || '', city: u.city || '', kind: u.kind === 'person' ? 'human' : u.kind,
    };
    if (u.kind === 'twin') o.ownerId = u.owner_id;
    const prev = JSON.parse(u.prev_pks || '[]');
    if (prev.length) o.prevPks = prev;
    return o;
  }

  function chatView(chatId) {
    const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId);
    if (!chat) return null;
    const members = db.prepare('SELECT user_id AS userId, read_up_to AS readUpTo FROM chat_members WHERE chat_id = ? ORDER BY user_id').all(chatId);
    const last = db.prepare('SELECT MAX(id) AS id FROM messages WHERE chat_id = ?').get(chatId);
    const v = { id: chat.id, kind: chat.kind, title: chat.title, members: members.map((m) => ({ ...m })), lastId: last?.id || 0 };
    if (chat.emoji) v.emoji = chat.emoji;
    if (chat.about) v.about = chat.about;
    if (chat.kind === 'circle') { v.isPublic = Boolean(chat.is_public); v.createdBy = chat.created_by || null; }
    if (chat.kind === 'twin') { const m = JSON.parse(chat.meta || '{}'); v.twin = { twinId: m.twinId, anon: Boolean(m.anon) }; }
    return v;
  }

  function memberIds(chatId) {
    return db.prepare('SELECT user_id FROM chat_members WHERE chat_id = ?').all(chatId).map((r) => r.user_id);
  }

  function unreadCount(userId) {
    return db.prepare(`
      SELECT COUNT(*) AS n FROM message_boxes b
      JOIN messages m ON m.id = b.message_id
      JOIN chat_members cm ON cm.chat_id = m.chat_id AND cm.user_id = b.recipient_id
      WHERE b.recipient_id = ? AND m.sender_id != ? AND m.id > cm.read_up_to
    `).get(userId, userId).n;
  }

  const touched = new Map();
  function touch(userId) {
    const t = Date.now();
    if (t - (touched.get(userId) || 0) < 60_000) return;
    touched.set(userId, t);
    db.prepare('UPDATE users SET last_active = ? WHERE id = ?').run(t, userId);
  }

  // Вход по телефону, номеру АСЬКИ или старому логину
  function findByLogin(login) {
    const s = String(login || '').trim();
    if (!s || s.length > 40) return null;
    const human = (sql, v) => db.prepare(`SELECT * FROM users WHERE kind = 'human' AND ${sql} = ?`).get(v);
    if (looksLikePhone(s)) { const u = human('phone', normalizePhone(s)); if (u) return u; }
    if (looksLikePlate(s) || /^\d{1,3}$/.test(s)) { const p = normalizePlate(s); const u = p && human('plate', p); if (u) return u; }
    const uname = s.toLowerCase();
    return USERNAME_RE.test(uname) ? human('username', uname) || null : null;
  }

  // ---------- живые соединения ----------

  const conns = new Map(); // userId -> Set<ws>

  function sendTo(userId, obj) {
    const set = conns.get(userId);
    if (!set) return;
    const data = JSON.stringify(obj);
    for (const ws of set) if (ws.readyState === 1) ws.send(data);
  }
  const sendToAll = (obj) => { for (const id of conns.keys()) sendTo(id, obj); };
  const broadcastChat = (chatId) => { const chat = chatView(chatId); if (chat) for (const id of memberIds(chatId)) sendTo(id, { type: 'chat', chat }); };
  const broadcastUser = (userId) => { const u = userRow(userId); if (u) sendToAll({ type: 'user', user: publicUser(u) }); };

  // «В сети» — у человека открыто приложение. После закрытия ждём немного: телефон мог просто переподключиться.
  const offlineTimers = new Map(); // userId -> timer
  const OFFLINE_DELAY = 8000;
  function wentOnline(userId) {
    const t = offlineTimers.get(userId);
    if (t) { clearTimeout(t); offlineTimers.delete(userId); return; }
    sendToAll({ type: 'presence', userId, online: true });
  }
  function wentOffline(userId) {
    offlineTimers.set(userId, setTimeout(() => {
      offlineTimers.delete(userId);
      if (!conns.has(userId)) sendToAll({ type: 'presence', userId, online: false });
    }, OFFLINE_DELAY));
  }
  function isVisible(userId) {
    const set = conns.get(userId);
    if (!set) return false;
    for (const ws of set) if (ws.readyState === 1 && ws.visible) return true;
    return false;
  }

  // ---------- сообщения ----------

  let bots = null;

  // Сохранить сообщение и разослать: живым — по WebSocket, свернувшим приложение — пушем, ботам — на чтение.
  function storeMessage(senderId, chatId, uuid, byRecipient, members) {
    const createdAt = Date.now();
    const id = tx(db, () => {
      const { lastInsertRowid } = db.prepare('INSERT INTO messages (chat_id, sender_id, uuid, created_at) VALUES (?, ?, ?, ?)')
        .run(chatId, senderId, uuid, createdAt);
      const msgId = Number(lastInsertRowid);
      const ins = db.prepare('INSERT INTO message_boxes (message_id, recipient_id, nonce, ct) VALUES (?, ?, ?, ?)');
      for (const b of byRecipient.values()) ins.run(msgId, b.to, b.n, b.c);
      db.prepare('UPDATE chat_members SET read_up_to = ? WHERE chat_id = ? AND user_id = ?').run(msgId, chatId, senderId);
      return msgId;
    });
    const sender = userRow(senderId);
    const fromBot = sender && sender.kind !== 'human';

    for (const b of byRecipient.values()) {
      sendTo(b.to, { type: 'msg', m: { id, chatId, senderId, uuid, createdAt, n: b.n, c: b.c } });
    }
    for (const memberId of members) sendTo(memberId, { type: 'read', chatId, userId: senderId, upTo: id });

    for (const b of byRecipient.values()) {
      if (b.to === senderId || isVisible(b.to) || userRow(b.to)?.kind !== 'human') continue;
      const data = { t: 'm', c: chatId, s: senderId, i: id, b: unreadCount(b.to) };
      if (b.pn) { data.pn = b.pn; data.pc = b.pc; }
      // Бота может ещё не быть на телефоне — даём имя и открытый ключ, чтобы расшифровать превью
      if (fromBot) { data.sn = sender.display_name; data.spk = sender.box_pk; }
      push.notify(b.to, data).catch((e) => log('push notify failed', e));
    }
    if (!fromBot) touch(senderId);
    setImmediate(() => { try { bots?.onMessage({ chatId, msgId: id, senderId }); } catch (e) { log('bots onMessage', e); } });
    return { id, createdAt };
  }

  function botPost(botId, chatId, body) {
    const bot = userRow(botId);
    const members = memberIds(chatId);
    if (!bot?.bot_sk || !members.includes(botId)) return null;
    const mem = members.map((id) => ({ id, pk: userRow(id).box_pk }));
    const uuid = newUuid();
    const boxes = sealOutgoing(chatId, uuid, body, mem, botId, bot.bot_sk);
    return storeMessage(botId, chatId, uuid, new Map(boxes.map((b) => [b.to, b])), members);
  }

  function ensureDm(a, b) {
    const [x, y] = [a, b].sort((p, q) => p - q);
    const chatId = `dm:${x}:${y}`;
    const created = tx(db, () => {
      const { changes } = db.prepare("INSERT OR IGNORE INTO chats (id, kind, title, created_at) VALUES (?, 'dm', NULL, ?)").run(chatId, Date.now());
      if (changes) {
        const ins = db.prepare('INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)');
        ins.run(chatId, x);
        ins.run(chatId, y);
      }
      return changes > 0;
    });
    if (created) broadcastChat(chatId);
    return chatId;
  }

  bots = createBots({
    db, ai, log, timing: botTiming, memberIds, post: botPost, ensureDm, sendTo, broadcastChat, broadcastUser,
    presence: (userId, online) => sendToAll({ type: 'presence', userId, online }),
  });
  bots.init();

  const onlineIds = () => [...new Set([...conns.keys(), ...offlineTimers.keys(), ...bots.onlineIds()])];

  // ---------- HTTP ----------

  const app = express();
  app.disable('x-powered-by');
  // За Caddy (через сокет) настоящий адрес клиента приходит в X-Forwarded-For.
  app.set('trust proxy', trustProxy ? true : 'loopback, uniquelocal');

  const wsOrigin = publicUrl ? publicUrl.replace(/^http/, 'ws') : '';
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'no-referrer');
    res.set('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data:",
      `connect-src 'self' ${wsOrigin}`.trim(),
      "worker-src 'self'",
      "manifest-src 'self'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
      "form-action 'none'",
    ].join('; '));
    next();
  });

  const json = express.json({ limit: '2mb' });
  const api = express.Router();
  app.use('/api', api);

  api.get('/health', (req, res) => res.json({ ok: true, version: process.env.APP_VERSION || 'dev' }));

  api.get('/invites/:code', (req, res) => {
    if (!allow(`inv:${req.ip}`, 30, 600_000)) return res.status(429).json({ error: 'too_many' });
    const row = db.prepare(`
      SELECT i.used_by, u.display_name AS by FROM invites i
      LEFT JOIN users u ON u.id = i.created_by WHERE i.code = ?
    `).get(normalizeInvite(req.params.code));
    if (!row || row.used_by) return res.status(404).json({ error: 'invite_invalid' });
    res.json({ ok: true, invitedBy: row.by || null, sms: sms.configured() });
  });

  api.get('/features', (req, res) => res.json({ sms: sms.configured() }));

  // ---------- телефон и коды ----------

  const PURPOSES = new Set(['register', 'link', 'recover']);
  const inviteFree = (code) => { const r = db.prepare('SELECT used_by FROM invites WHERE code = ?').get(normalizeInvite(code)); return r && !r.used_by; };
  const phoneOwner = (phone) => db.prepare('SELECT id FROM users WHERE phone = ?').get(phone)?.id;

  api.post('/phone/send', json, async (req, res) => {
    const { purpose, invite } = req.body || {};
    const phone = normalizePhone(req.body?.phone);
    if (!phone) return res.status(400).json({ error: 'bad_phone' });
    if (!PURPOSES.has(purpose)) return res.status(400).json({ error: 'bad_request' });
    if (!allow(`sms:ip:${req.ip}`, 8, 3_600_000) || !allow(`sms:ph:${phone}`, 3, 900_000) || !allow('sms:all', 300, 86_400_000)) {
      return res.status(429).json({ error: 'too_many' });
    }
    let exists = true;
    if (purpose === 'register') {
      if (!inviteFree(invite)) return res.status(404).json({ error: 'invite_invalid' });
      if (phoneOwner(phone)) return res.status(409).json({ error: 'phone_taken' });
    } else if (purpose === 'link') {
      const s = sessionByToken(bearer(req));
      if (!s) return res.status(401).json({ error: 'unauthorized' });
      const owner = phoneOwner(phone);
      if (owner && owner !== s.user_id) return res.status(409).json({ error: 'phone_taken' });
    } else {
      exists = Boolean(db.prepare("SELECT 1 FROM users WHERE kind = 'human' AND phone = ?").get(phone));
    }
    if (!sms.configured()) return res.json({ mode: 'none' });
    if (!exists) return res.json({ mode: 'sms' }); // не подсказываем, есть ли такой номер
    const code = codes.issue(phone, purpose);
    try {
      await sms.send(phone, `АСЬКА: код ${code}. Никому его не говори.`);
    } catch {
      return res.status(502).json({ error: 'sms_failed' });
    }
    res.json({ mode: 'sms' });
  });

  api.post('/phone/verify', json, (req, res) => {
    const { purpose, code } = req.body || {};
    const phone = normalizePhone(req.body?.phone);
    if (!phone || !PURPOSES.has(purpose)) return res.status(400).json({ error: 'bad_request' });
    if (!allow(`code:${req.ip}`, 20, 600_000)) return res.status(429).json({ error: 'too_many' });
    if (!codes.check(phone, purpose, code)) return res.status(400).json({ error: 'bad_code' });
    res.json({ ticket: codes.ticket(phone, purpose) });
  });

  // ---------- регистрация и вход ----------

  function validKeys(b) {
    return b64Bytes(b?.boxPk, 32) && b64Bytes(b?.kdfSalt, 16) && b64Bytes(b?.authKey, 32)
      && b?.backup && b64Bytes(b.backup.n, 24) && b64Bytes(b.backup.c, undefined, 400);
  }

  api.post('/register', json, (req, res) => {
    if (!allow(`reg:${req.ip}`, 20, 600_000)) return res.status(429).json({ error: 'too_many' });
    const body = req.body || {};
    const name = cleanName(body.displayName);
    if (!name) return res.status(400).json({ error: 'bad_name' });
    const wanted = typeof body.username === 'string' && body.username.trim() ? body.username.trim().toLowerCase() : null;
    if (wanted && !USERNAME_RE.test(wanted)) return res.status(400).json({ error: 'bad_username' });
    if (!validKeys(body)) return res.status(400).json({ error: 'bad_keys' });

    let phone = null;
    let verified = 0;
    if (body.phone) {
      phone = normalizePhone(body.phone);
      if (!phone) return res.status(400).json({ error: 'bad_phone' });
    }
    if (sms.configured()) {
      const fromTicket = codes.readTicket(body.phoneTicket, 'register');
      if (!phone || fromTicket !== phone) return res.status(400).json({ error: 'phone_unverified' });
      verified = 1;
    }

    const code = normalizeInvite(body.invite);
    let result;
    try {
      result = tx(db, () => {
        const inv = db.prepare('SELECT used_by FROM invites WHERE code = ?').get(code);
        if (!inv || inv.used_by) return { error: 'invite_invalid', status: 404 };
        if (wanted && db.prepare('SELECT 1 FROM users WHERE username = ?').get(wanted)) return { error: 'username_taken', status: 409 };
        if (phone && phoneOwner(phone)) return { error: 'phone_taken', status: 409 };
        // Самый первый человек становится администратором и получает первый номер серии
        const firstAdmin = !db.prepare("SELECT 1 FROM users WHERE is_admin = 1 AND kind = 'human'").get();
        const plate = firstAdmin && !db.prepare('SELECT 1 FROM users WHERE plate = ?').get(ADMIN_PLATE) ? ADMIN_PLATE : freePlate(db);
        let uname = wanted || plateUsername(plate);
        for (let i = 2; db.prepare('SELECT 1 FROM users WHERE username = ?').get(uname); i++) uname = `${plateUsername(plate)}_${i}`;
        const now = Date.now();
        const { lastInsertRowid } = db.prepare(`
          INSERT INTO users (username, display_name, box_pk, kdf_salt, auth_hash, backup_n, backup_c, created_at, plate, phone, phone_verified, last_active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(uname, name, body.boxPk, body.kdfSalt, sha256hex(Buffer.from(body.authKey, 'base64')), body.backup.n, body.backup.c, now, plate, phone, verified, now);
        const userId = Number(lastInsertRowid);
        db.prepare('UPDATE invites SET used_by = ?, used_at = ? WHERE code = ?').run(userId, now, code);
        const maxId = db.prepare('SELECT MAX(id) AS id FROM messages').get().id || 0;
        db.prepare('INSERT INTO chat_members (chat_id, user_id, read_up_to) VALUES (?, ?, ?)').run(GENERAL_CHAT, userId, maxId);
        if (firstAdmin) db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(userId);
        return { userId, plate, username: uname, token: createSession(userId) };
      });
    } catch (e) {
      log('register error', e);
      return res.status(500).json({ error: 'server' });
    }
    if (result.error) return res.status(result.status).json({ error: result.error });
    broadcastUser(result.userId);
    broadcastChat(GENERAL_CHAT);
    bots.onUserRegistered(result.userId);
    log(`registered ${result.username}`);
    res.json({ token: result.token, userId: result.userId, plate: result.plate, username: result.username });
  });

  // Соль для пароля. Для несуществующего входа отдаём выдуманную, чтобы нельзя было перебирать телефоны и имена.
  api.get('/salt', (req, res) => {
    if (!allow(`salt:${req.ip}`, 60, 600_000)) return res.status(429).json({ error: 'too_many' });
    const login = String(req.query.login || req.query.username || '').trim();
    const u = findByLogin(login);
    const key = normalizePhone(login) || normalizePlate(login) || login.toLowerCase();
    const salt = u ? u.kdf_salt
      : crypto.createHmac('sha256', serverSecret).update(`salt:${key}`).digest().subarray(0, 16).toString('base64');
    res.json({ salt });
  });

  api.post('/login', json, (req, res) => {
    const { authKey } = req.body || {};
    const login = req.body?.login ?? req.body?.username;
    const user = findByLogin(login);
    const lkey = user ? `login:u${user.id}` : `login:${String(login || '').toLowerCase()}`;
    if (!allow(`login:${req.ip}`, 20, 600_000) || !allow(lkey, 10, 600_000)) return res.status(429).json({ error: 'too_many' });
    if (!user || !b64Bytes(authKey, 32)) return res.status(401).json({ error: 'bad_login' });
    const given = Buffer.from(sha256hex(Buffer.from(authKey, 'base64')), 'hex');
    const stored = Buffer.from(user.auth_hash, 'hex');
    if (!crypto.timingSafeEqual(given, stored)) return res.status(401).json({ error: 'bad_login' });
    touch(user.id);
    res.json({
      token: createSession(user.id), userId: user.id, username: user.username, boxPk: user.box_pk,
      backup: { n: user.backup_n, c: user.backup_c },
    });
  });

  // Забыл пароль: телефон подтверждён кодом из СМС (или код от администратора) → новый пароль и новые ключи.
  // Старые сообщения на новом ключе не открыть — их копии для этого человека удаляем.
  api.post('/recover', json, (req, res) => {
    if (!allow(`rec:${req.ip}`, 10, 600_000)) return res.status(429).json({ error: 'too_many' });
    const body = req.body || {};
    let user = null;
    let viaPhone = false;
    if (body.ticket) {
      const phone = codes.readTicket(body.ticket, 'recover');
      user = phone ? db.prepare("SELECT * FROM users WHERE kind = 'human' AND phone = ?").get(phone) : null;
      viaPhone = Boolean(user);
    } else if (body.login && body.helpCode) {
      const u = findByLogin(body.login);
      if (u && allow(`rec:u${u.id}`, 5, 600_000) && codes.checkHelp(u.id, body.helpCode)) user = u;
    }
    if (!user) return res.status(401).json({ error: 'bad_recover' });
    if (!validKeys(body)) return res.status(400).json({ error: 'bad_keys' });
    const token = tx(db, () => {
      const prev = [user.box_pk, ...JSON.parse(user.prev_pks || '[]')].filter((k) => k !== body.boxPk).slice(0, 5);
      db.prepare(`UPDATE users SET box_pk = ?, kdf_salt = ?, auth_hash = ?, backup_n = ?, backup_c = ?, prev_pks = ?, key_reset_at = ?,
        phone_verified = CASE WHEN ? THEN 1 ELSE phone_verified END WHERE id = ?`)
        .run(body.boxPk, body.kdfSalt, sha256hex(Buffer.from(body.authKey, 'base64')), body.backup.n, body.backup.c,
          JSON.stringify(prev), Date.now(), viaPhone ? 1 : 0, user.id);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
      db.prepare('DELETE FROM push_subs WHERE user_id = ?').run(user.id);
      db.prepare('DELETE FROM message_boxes WHERE recipient_id = ?').run(user.id);
      return createSession(user.id);
    });
    for (const ws of conns.get(user.id) || []) ws.close(4001, 'recovered');
    broadcastUser(user.id);
    bots.onRecovered(user.id);
    log(`recovered ${user.username}`);
    res.json({ token, userId: user.id, username: user.username });
  });

  api.delete('/session', auth, (req, res) => {
    db.prepare('DELETE FROM push_subs WHERE session_hash = ?').run(req.sessionHash);
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(req.sessionHash);
    res.json({ ok: true });
  });

  // ---------- состояние ----------

  api.get('/state', auth, (req, res) => {
    const me = userRow(req.userId);
    const users = db.prepare('SELECT * FROM users ORDER BY id').all().map(publicUser);
    const chats = db.prepare('SELECT chat_id FROM chat_members WHERE user_id = ?').all(req.userId).map((r) => chatView(r.chat_id));
    const pins = db.prepare('SELECT target_id FROM pins WHERE user_id = ?').all(req.userId).map((r) => r.target_id);
    const guesses = {};
    for (const g of db.prepare('SELECT g.target_id, u.kind FROM guesses g JOIN users u ON u.id = g.target_id WHERE g.guesser_id = ?').all(req.userId)) {
      guesses[g.target_id] = g.kind === 'person' ? 'ai' : 'human';
    }
    touch(req.userId);
    res.json({
      me: req.userId, users, chats, vapidPublicKey: push.publicKey, badge: unreadCount(req.userId), online: onlineIds(),
      profile: { isAdmin: Boolean(me.is_admin), phone: me.phone || null, phoneVerified: Boolean(me.phone_verified), allowAnon: Boolean(me.allow_anon), plate: me.plate },
      pins, guesses, features: { ai: ai.available(), sms: sms.configured() },
    });
  });

  api.get('/sync', auth, (req, res) => {
    const after = Math.max(0, parseInt(req.query.after, 10) || 0);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 500));
    const rows = db.prepare(`
      SELECT m.id, m.chat_id AS chatId, m.sender_id AS senderId, m.uuid, m.created_at AS createdAt, b.nonce AS n, b.ct AS c
      FROM message_boxes b JOIN messages m ON m.id = b.message_id
      WHERE b.recipient_id = ? AND b.message_id > ?
      ORDER BY b.message_id LIMIT ?
    `).all(req.userId, after, limit + 1);
    const more = rows.length > limit;
    res.json({ messages: rows.slice(0, limit).map((r) => ({ ...r })), more });
  });

  api.post('/messages', auth, json, (req, res) => {
    if (!allow(`msg:${req.userId}`, 120, 60_000)) return res.status(429).json({ error: 'too_many' });
    const { chatId, uuid, boxes } = req.body || {};
    if (typeof chatId !== 'string' || !UUID_RE.test(uuid || '') || !Array.isArray(boxes)) {
      return res.status(400).json({ error: 'bad_request' });
    }
    const members = memberIds(chatId);
    if (!members.includes(req.userId)) return res.status(403).json({ error: 'not_member' });

    const existing = db.prepare('SELECT id, created_at FROM messages WHERE sender_id = ? AND uuid = ?').get(req.userId, uuid);
    if (existing) return res.json({ id: existing.id, createdAt: existing.created_at });

    const byRecipient = new Map();
    for (const b of boxes) {
      if (!b || !Number.isInteger(b.to) || byRecipient.has(b.to)) return res.status(400).json({ error: 'bad_boxes' });
      if (!b64Bytes(b.n, 24) || !b64Bytes(b.c, undefined, 200_000)) return res.status(400).json({ error: 'bad_boxes' });
      if (b.pn !== undefined && (!b64Bytes(b.pn, 24) || !b64Bytes(b.pc, undefined, 1200))) return res.status(400).json({ error: 'bad_boxes' });
      byRecipient.set(b.to, b);
    }
    if (byRecipient.size !== members.length || !members.every((id) => byRecipient.has(id))) {
      return res.status(409).json({ error: 'members_changed' });
    }
    res.json(storeMessage(req.userId, chatId, uuid, byRecipient, members));
  });

  api.post('/read', auth, json, (req, res) => {
    const { chatId, upTo } = req.body || {};
    if (typeof chatId !== 'string' || !Number.isInteger(upTo) || upTo < 0) return res.status(400).json({ error: 'bad_request' });
    const members = memberIds(chatId);
    if (!members.includes(req.userId)) return res.status(403).json({ error: 'not_member' });
    const maxId = db.prepare('SELECT MAX(id) AS id FROM messages WHERE chat_id = ?').get(chatId).id || 0;
    const value = Math.min(upTo, maxId);
    const { changes } = db.prepare('UPDATE chat_members SET read_up_to = ? WHERE chat_id = ? AND user_id = ? AND read_up_to < ?')
      .run(value, chatId, req.userId, value);
    if (changes) for (const id of members) sendTo(id, { type: 'read', chatId, userId: req.userId, upTo: value });
    res.json({ ok: true, badge: unreadCount(req.userId) });
  });

  api.post('/chats/dm', auth, json, (req, res) => {
    const other = req.body?.userId;
    const u = Number.isInteger(other) && other !== req.userId ? userRow(other) : null;
    if (!u) return res.status(400).json({ error: 'bad_user' });
    // Чужому личному ИИ пишут через /twins/:id/chat — там выбирают «открыто» или «анонимно»
    if (u.kind === 'twin' && u.owner_id !== req.userId) return res.status(403).json({ error: 'use_twin_chat' });
    res.json({ chat: chatView(ensureDm(req.userId, other)) });
  });

  // ---------- профиль ----------

  api.post('/me', auth, json, (req, res) => {
    const b = req.body || {};
    const me = userRow(req.userId);
    const patch = {};
    if (b.displayName !== undefined) { const n = cleanName(b.displayName); if (!n) return res.status(400).json({ error: 'bad_name' }); patch.display_name = n; }
    if (b.about !== undefined) { const t = cleanText(b.about, 200); if (t === null) return res.status(400).json({ error: 'too_long' }); patch.about = t; }
    if (b.city !== undefined) { const t = cleanText(b.city, 40); if (t === null) return res.status(400).json({ error: 'too_long' }); patch.city = t; }
    if (b.allowAnon !== undefined) patch.allow_anon = b.allowAnon ? 1 : 0;
    const keys = Object.keys(patch);
    if (keys.length) db.prepare(`UPDATE users SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...keys.map((k) => patch[k]), req.userId);
    if (patch.display_name && patch.display_name !== me.display_name) {
      const twin = db.prepare("SELECT id FROM users WHERE kind = 'twin' AND owner_id = ?").get(req.userId);
      if (twin) {
        db.prepare('UPDATE users SET display_name = ?, about = ? WHERE id = ?').run(bots.twinName(patch.display_name), `личный ИИ · ${patch.display_name}`, twin.id);
        broadcastUser(twin.id);
      }
    }
    broadcastUser(req.userId);
    res.json({ ok: true });
  });

  api.post('/me/phone', auth, json, (req, res) => {
    const phone = normalizePhone(req.body?.phone);
    if (!phone) return res.status(400).json({ error: 'bad_phone' });
    const owner = phoneOwner(phone);
    if (owner && owner !== req.userId) return res.status(409).json({ error: 'phone_taken' });
    let verified = 0;
    if (sms.configured()) {
      if (codes.readTicket(req.body?.ticket, 'link') !== phone) return res.status(400).json({ error: 'phone_unverified' });
      verified = 1;
    }
    db.prepare('UPDATE users SET phone = ?, phone_verified = ? WHERE id = ?').run(phone, verified, req.userId);
    res.json({ phone, phoneVerified: Boolean(verified) });
  });

  api.post('/pins', auth, json, (req, res) => {
    const { userId, on } = req.body || {};
    if (!Number.isInteger(userId) || !userRow(userId)) return res.status(400).json({ error: 'bad_user' });
    if (on) db.prepare('INSERT OR IGNORE INTO pins (user_id, target_id, created_at) VALUES (?, ?, ?)').run(req.userId, userId, Date.now());
    else db.prepare('DELETE FROM pins WHERE user_id = ? AND target_id = ?').run(req.userId, userId);
    res.json({ pins: db.prepare('SELECT target_id FROM pins WHERE user_id = ?').all(req.userId).map((r) => r.target_id) });
  });

  // ---------- игра «Кто здесь ИИ?» ----------

  api.post('/guess', auth, json, (req, res) => {
    const { userId, guess } = req.body || {};
    const t = Number.isInteger(userId) && userId !== req.userId ? userRow(userId) : null;
    if (!t || (t.kind !== 'human' && t.kind !== 'person') || !['human', 'ai'].includes(guess)) return res.status(400).json({ error: 'bad_request' });
    const truth = t.kind === 'person' ? 'ai' : 'human';
    const old = db.prepare('SELECT guess, correct FROM guesses WHERE guesser_id = ? AND target_id = ?').get(req.userId, userId);
    if (old) return res.json({ correct: Boolean(old.correct), truth, already: true });
    db.prepare('INSERT INTO guesses (guesser_id, target_id, guess, correct, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(req.userId, userId, guess, guess === truth ? 1 : 0, Date.now());
    res.json({ correct: guess === truth, truth });
  });

  api.get('/game', auth, (req, res) => {
    const mine = db.prepare('SELECT COUNT(*) AS total, COALESCE(SUM(correct), 0) AS right FROM guesses WHERE guesser_id = ?').get(req.userId);
    const top = db.prepare(`
      SELECT g.guesser_id AS userId, COUNT(*) AS total, SUM(g.correct) AS right FROM guesses g
      JOIN users u ON u.id = g.guesser_id WHERE u.kind = 'human'
      GROUP BY g.guesser_id ORDER BY right DESC, total ASC LIMIT 10
    `).all().map((r) => ({ ...r }));
    res.json({ right: mine.right, total: mine.total, top });
  });

  // ---------- круги ----------

  api.get('/circles', auth, (req, res) => {
    const online = new Set(onlineIds());
    const rows = db.prepare(`
      SELECT c.*, EXISTS(SELECT 1 FROM chat_members m WHERE m.chat_id = c.id AND m.user_id = ?) AS member
      FROM chats c WHERE c.kind = 'general' OR (c.kind = 'circle' AND (c.is_public = 1 OR c.id IN (SELECT chat_id FROM chat_members WHERE user_id = ?)))
      ORDER BY c.kind = 'general' DESC, c.created_at
    `).all(req.userId, req.userId);
    res.json({
      circles: rows.map((c) => {
        const ids = memberIds(c.id);
        const lastAt = db.prepare('SELECT MAX(created_at) AS t FROM messages WHERE chat_id = ?').get(c.id).t || 0;
        return {
          id: c.id, kind: c.kind, title: c.title, emoji: c.emoji || (c.kind === 'general' ? '🌼' : '⭕'), about: c.about || (c.kind === 'general' ? 'Все свои: здесь каждый, кого пригласили' : ''),
          isPublic: c.kind === 'general' || Boolean(c.is_public), member: Boolean(c.member), count: ids.length,
          online: ids.filter((id) => online.has(id)).length, lastAt,
        };
      }),
    });
  });

  api.post('/circles', auth, json, (req, res) => {
    if (!allow(`circle:${req.userId}`, 10, 3_600_000)) return res.status(429).json({ error: 'too_many' });
    const b = req.body || {};
    const title = cleanName(b.title);
    const about = b.about ? cleanText(b.about, 140) : '';
    const emoji = typeof b.emoji === 'string' && [...b.emoji].length <= 4 ? b.emoji.trim() : '⭕';
    if (!title || about === null) return res.status(400).json({ error: 'bad_request' });
    const ids = [...new Set(Array.isArray(b.memberIds) ? b.memberIds : [])]
      .filter((id) => Number.isInteger(id) && id !== req.userId)
      .filter((id) => ['human', 'person'].includes(userRow(id)?.kind));
    const id = `circle:${crypto.randomBytes(6).toString('hex')}`;
    tx(db, () => {
      db.prepare("INSERT INTO chats (id, kind, title, emoji, about, is_public, created_by, created_at) VALUES (?, 'circle', ?, ?, ?, ?, ?, ?)")
        .run(id, title, emoji || '⭕', about || null, b.isPublic ? 1 : 0, req.userId, Date.now());
      const ins = db.prepare('INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)');
      for (const uid of [req.userId, ...ids]) ins.run(id, uid);
    });
    broadcastChat(id);
    res.json({ chat: chatView(id) });
  });

  api.post('/circles/:id/join', auth, (req, res) => {
    const c = db.prepare("SELECT * FROM chats WHERE id = ? AND kind IN ('circle', 'general')").get(req.params.id);
    if (!c || (c.kind === 'circle' && !c.is_public && !memberIds(c.id).includes(req.userId))) return res.status(404).json({ error: 'not_found' });
    const maxId = db.prepare('SELECT MAX(id) AS id FROM messages WHERE chat_id = ?').get(c.id).id || 0;
    db.prepare('INSERT OR IGNORE INTO chat_members (chat_id, user_id, read_up_to) VALUES (?, ?, ?)').run(c.id, req.userId, maxId);
    broadcastChat(c.id);
    res.json({ chat: chatView(c.id) });
  });

  api.post('/circles/:id/leave', auth, (req, res) => {
    const c = db.prepare("SELECT * FROM chats WHERE id = ? AND kind = 'circle'").get(req.params.id);
    if (!c) return res.status(404).json({ error: 'not_found' });
    db.prepare('DELETE FROM chat_members WHERE chat_id = ? AND user_id = ?').run(c.id, req.userId);
    broadcastChat(c.id);
    sendTo(req.userId, { type: 'chat_left', chatId: c.id });
    res.json({ ok: true });
  });

  // ---------- личный ИИ ----------

  api.post('/twins/:id/chat', auth, json, (req, res) => {
    const twin = userRow(Number(req.params.id));
    if (!twin || twin.kind !== 'twin') return res.status(404).json({ error: 'not_found' });
    if (twin.owner_id === req.userId) return res.json({ chat: chatView(ensureDm(req.userId, twin.id)) });
    const owner = userRow(twin.owner_id);
    const anon = Boolean(req.body?.anon);
    if (anon && !owner?.allow_anon) return res.status(403).json({ error: 'anon_off' });
    const chatId = `twin:${twin.id}:${req.userId}:${anon ? 'a' : 'o'}`;
    const created = tx(db, () => {
      const { changes } = db.prepare("INSERT OR IGNORE INTO chats (id, kind, title, meta, created_at) VALUES (?, 'twin', NULL, ?, ?)")
        .run(chatId, JSON.stringify({ twinId: twin.id, ownerId: owner.id, anon }), Date.now());
      if (changes) {
        const ins = db.prepare('INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)');
        ins.run(chatId, req.userId);
        ins.run(chatId, twin.id);
      }
      return changes > 0;
    });
    if (created) broadcastChat(chatId);
    res.json({ chat: chatView(chatId) });
  });

  api.get('/twin', auth, (req, res) => {
    const twinId = bots.ensureTwin(req.userId);
    const me = userRow(req.userId);
    const facts = db.prepare('SELECT id, text, source, created_at AS createdAt FROM twin_facts WHERE owner_id = ? ORDER BY id DESC').all(req.userId).map((r) => ({ ...r }));
    const chats = db.prepare("SELECT COUNT(*) AS n FROM chats WHERE kind = 'twin' AND id LIKE ?").get(`twin:${twinId}:%`).n;
    const q = db.prepare('SELECT COUNT(*) AS n, COUNT(answered_at) AS answered FROM twin_questions WHERE twin_id = ?').get(twinId);
    res.json({ twinId, allowAnon: Boolean(me.allow_anon), facts, stats: { chats, questions: q.n, answered: q.answered } });
  });

  api.post('/twin/facts', auth, json, (req, res) => {
    const t = cleanText(req.body?.text, 200);
    if (!t || t.length < 2) return res.status(400).json({ error: 'bad_request' });
    bots.addFacts(req.userId, [t], 'owner');
    res.json({ ok: true });
  });

  api.delete('/twin/facts/:id', auth, (req, res) => {
    db.prepare('DELETE FROM twin_facts WHERE id = ? AND owner_id = ?').run(Number(req.params.id), req.userId);
    res.json({ ok: true });
  });

  // ---------- управление (администратор) ----------

  api.get('/admin', auth, admin, (req, res) => {
    const users = db.prepare("SELECT * FROM users WHERE kind = 'human' ORDER BY id").all().map((u) => ({
      id: u.id, displayName: u.display_name, plate: u.plate, phone: u.phone, phoneVerified: Boolean(u.phone_verified),
      createdAt: u.created_at, lastActive: u.last_active, isAdmin: Boolean(u.is_admin),
    }));
    res.json({ ai: ai.status(), people: bots.peopleEnabled(), sms: sms.status(), users });
  });

  api.post('/admin/ai', auth, admin, json, (req, res) => {
    const b = req.body || {};
    const patch = {};
    if (typeof b.apiKey === 'string') { if (b.apiKey.length > 300) return res.status(400).json({ error: 'bad_request' }); patch.apiKey = b.apiKey.trim(); }
    if (typeof b.model === 'string') patch.model = b.model;
    if (Number.isInteger(b.dailyLimit) && b.dailyLimit >= 10 && b.dailyLimit <= 20000) patch.dailyLimit = b.dailyLimit;
    if (typeof b.paused === 'boolean') patch.paused = b.paused;
    ai.setConfig(patch);
    res.json({ ai: ai.status() });
  });

  api.post('/admin/ai/check', auth, admin, async (req, res) => {
    res.json(await ai.check());
  });

  api.post('/admin/people', auth, admin, json, (req, res) => {
    const on = Boolean(req.body?.on);
    if (on && !ai.configured()) return res.status(400).json({ error: 'ai_off' });
    bots.setPeople(on);
    res.json({ people: bots.peopleEnabled() });
  });

  api.post('/admin/sms', auth, admin, json, (req, res) => {
    const apiId = typeof req.body?.apiId === 'string' ? req.body.apiId.trim().slice(0, 100) : undefined;
    if (apiId !== undefined) sms.setConfig({ apiId });
    res.json({ sms: sms.status() });
  });

  api.post('/admin/sms/check', auth, admin, async (req, res) => {
    res.json(await sms.balance());
  });

  api.post('/admin/help-code', auth, admin, json, (req, res) => {
    const u = userRow(req.body?.userId);
    if (!u || u.kind !== 'human') return res.status(400).json({ error: 'bad_user' });
    res.json({ code: codes.issueHelp(u.id), login: u.plate });
  });

  // ---------- файлы, приглашения, пуши ----------

  api.post('/blobs', auth, express.raw({ type: 'application/octet-stream', limit: '20mb' }), (req, res) => {
    if (!allow(`blob:${req.userId}`, 60, 600_000)) return res.status(429).json({ error: 'too_many' });
    if (!Buffer.isBuffer(req.body) || req.body.length < 17) return res.status(400).json({ error: 'empty' });
    const id = crypto.randomBytes(16).toString('hex');
    fs.writeFileSync(path.join(blobDir, id), req.body);
    db.prepare('INSERT INTO blobs (id, uploader_id, size, created_at) VALUES (?, ?, ?, ?)').run(id, req.userId, req.body.length, Date.now());
    res.json({ id });
  });

  api.get('/blobs/:id', auth, (req, res) => {
    const id = req.params.id;
    if (!BLOB_ID_RE.test(id) || !db.prepare('SELECT 1 FROM blobs WHERE id = ?').get(id)) return res.status(404).end();
    res.set('Cache-Control', 'private, max-age=31536000, immutable');
    res.type('application/octet-stream');
    res.sendFile(path.join(blobDir, id));
  });

  // Мои ещё не использованные приглашения — чтобы позвать нескольких друзей.
  api.get('/invites', auth, (req, res) => {
    const rows = db.prepare('SELECT code, created_at FROM invites WHERE created_by = ? AND used_by IS NULL ORDER BY created_at DESC LIMIT 20').all(req.userId);
    res.json({ invites: rows.map((r) => ({ code: formatInvite(r.code), createdAt: r.created_at })) });
  });

  api.post('/invites', auth, (req, res) => {
    if (!allow(`mkinv:${req.userId}`, 20, 3_600_000)) return res.status(429).json({ error: 'too_many' });
    res.json({ code: formatInvite(createInvite(db, req.userId)) });
  });

  api.post('/push/subscribe', auth, json, (req, res) => {
    const { endpoint, keys } = req.body || {};
    if (!isAllowedEndpoint(endpoint) || endpoint.length > 1000 || !keys
      || typeof keys.p256dh !== 'string' || keys.p256dh.length > 200 || typeof keys.auth !== 'string' || keys.auth.length > 100) {
      return res.status(400).json({ error: 'bad_subscription' });
    }
    db.prepare(`
      INSERT INTO push_subs (endpoint, user_id, session_hash, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, session_hash = excluded.session_hash,
        p256dh = excluded.p256dh, auth = excluded.auth
    `).run(endpoint, req.userId, req.sessionHash, keys.p256dh, keys.auth, Date.now());
    res.json({ ok: true });
  });

  api.post('/push/unsubscribe', auth, json, (req, res) => {
    db.prepare('DELETE FROM push_subs WHERE endpoint = ? AND user_id = ?').run(String(req.body?.endpoint || ''), req.userId);
    res.json({ ok: true });
  });

  api.use((req, res) => res.status(404).json({ error: 'not_found' }));

  // Раздача самого приложения.
  if (staticDir && fs.existsSync(staticDir)) {
    app.use(express.static(staticDir, {
      index: false,
      setHeaders(res, filePath) {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) res.set('Cache-Control', 'public, max-age=31536000, immutable');
        else res.set('Cache-Control', 'no-cache');
      },
    }));
    app.get(/^\/(?!api\/|ws$).*/, (req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  }

  app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'too_large' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'bad_json' });
    log('error', err);
    res.status(500).json({ error: 'server' });
  });

  // ---------- WebSocket ----------

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, 'http://local');
    const session = url.pathname === '/ws' && sessionByToken(url.searchParams.get('token'));
    if (!session) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const userId = session.user_id;
      ws.visible = url.searchParams.get('visible') !== '0';
      ws.isAlive = true;
      const first = !conns.has(userId);
      if (first) conns.set(userId, new Set());
      conns.get(userId).add(ws);
      if (first) wentOnline(userId);
      touch(userId);
      ws.on('pong', () => { ws.isAlive = true; });
      ws.on('message', (raw) => {
        let msg;
        try { msg = JSON.parse(raw.toString()); } catch { return; }
        if (msg.type === 'visible') ws.visible = !!msg.value;
        else if (msg.type === 'ping') ws.send('{"type":"pong"}');
        else if (msg.type === 'typing' && typeof msg.chatId === 'string' && msg.chatId.length < 100) {
          // «печатает…» — не чаще раза в 2 секунды и только участникам беседы
          if (!allow(`typing:${userId}:${msg.chatId}`, 1, 2000)) return;
          const members = memberIds(msg.chatId);
          if (!members.includes(userId)) return;
          for (const id of members) if (id !== userId) sendTo(id, { type: 'typing', chatId: msg.chatId, userId });
        }
      });
      ws.on('close', () => {
        const set = conns.get(userId);
        if (set) { set.delete(ws); if (!set.size) { conns.delete(userId); wentOffline(userId); } }
      });
      ws.send(JSON.stringify({ type: 'hello' }));
    });
  });

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false;
      ws.ping();
    }
  }, 30_000);
  heartbeat.unref();

  if (startBots) bots.start();

  async function close() {
    clearInterval(heartbeat);
    for (const t of offlineTimers.values()) clearTimeout(t);
    await bots.stop();
    for (const ws of wss.clients) ws.terminate();
    return new Promise((resolve) => server.close(() => { db.close(); resolve(); }));
  }

  return { app, server, db, close, bots, ai, createInvite: (by) => formatInvite(createInvite(db, by)) };
}
