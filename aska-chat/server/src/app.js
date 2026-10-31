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
import { parsePlate, plateKey, countryForPhone, defaultRegion, COUNTRIES, keyTaken, priceOf, isGoldCode, plateView, LEVELS, formatCode, randomFreeCode, rarityOf, RARITY, cityOf } from './plates.js';
import * as M from './market.js';
import { createSuperLinks } from './superlink.js';
import { createWall } from './wall.js';
import { STATUSES } from './personas.js';
import * as TIER from './tiers.js';
import * as L from './ledger.js';
import * as NET from './network.js';
import { PLACES, placeOf, defaultPlace } from './places.js';
import { createNight } from './night.js';
import { createCatalog } from './catalog.js';
import { bookView } from './book.js';

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

// А042МР777 → a042mp777: внутреннее имя для входа, его никто не придумывает
const plateUsername = (code) => plateKey(code).toLowerCase().slice(0, 16) || 'user';
const mskDay = () => new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 10);
const DAILY_BONUS = 20;
const INVITE_BONUS = 50;
const GUESS_BONUS = 15;
const WELCOME_COINS = 100;

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
  const superLinks = createSuperLinks({ db, secret: serverSecret });

  // Номера тем, у кого их ещё нет: голд — золотая серия (первому — А 001 МР 777), остальным — своей страны
  for (const u of db.prepare("SELECT * FROM users WHERE kind = 'human' AND plate_id IS NULL ORDER BY id").all()) {
    tx(db, () => M.firstPlate(db, u.id, { country: countryForPhone(u.phone), gold: M.isAdmin(u), preferred: M.isAdmin(u) ? M.ADMIN_PLATE : null }));
  }
  M.seedShowcase(db);

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

  // Администратор (role admin или super). Голд и Блэк — уровни (tiers.js), прав администратора они не дают
  function admin(req, res, next) {
    const me = userRow(req.userId);
    if (!M.isAdmin(me) || me.blocked_at) return res.status(403).json({ error: 'not_admin' });
    req.me = me;
    next();
  }

  // Статус: у людей — выбранный ими, у ботов — по их расписанию
  function statusOf(u) {
    if (u.kind !== 'human') return bots ? bots.statusOf(u) : null;
    if (!u.status) return null;
    try {
      const s = JSON.parse(u.status);
      const preset = s.key && STATUSES.find((x) => x.key === s.key);
      if (preset) return { emoji: preset.emoji, text: preset.text, at: u.status_at || 0 };
      return s.emoji || s.text ? { emoji: s.emoji || '', text: s.text || '', at: u.status_at || 0 } : null;
    } catch { return null; }
  }

  // Группы контактов: личные — Ближний круг, Знакомства; рабочие («Бизнес») — Команда, Работа, Бизнес, Партнёры.
  // Кого человек позвал или кто позвал его — сразу в ближний круг
  const BIZ = ['team', 'work', 'biz', 'partners'];
  const GROUPS = ['close', 'meet', ...BIZ];
  function groupsOf(userId) {
    const out = {};
    for (const r of db.prepare("SELECT id FROM users WHERE kind IN ('human', 'person') AND id != ?").all(userId)) out[r.id] = 'meet';
    for (const r of db.prepare('SELECT created_by, used_by FROM invites WHERE used_by IS NOT NULL AND (created_by = ? OR used_by = ?)').all(userId, userId)) {
      const other = r.created_by === userId ? r.used_by : r.created_by;
      if (other && out[other]) out[other] = 'close';
    }
    for (const r of db.prepare('SELECT target_id, grp FROM contact_groups WHERE user_id = ?').all(userId)) if (out[r.target_id]) out[r.target_id] = r.grp;
    return out;
  }

  // ИИ-люди для остальных выглядят как обычные люди: «person» наружу не отдаём
  function publicUser(u) {
    const p = M.plateRow(db, u.plate_id);
    const o = {
      id: u.id, username: u.username, displayName: u.display_name, boxPk: u.box_pk,
      plate: u.plate || null, about: u.about || '', city: u.city || '', kind: u.kind === 'person' ? 'human' : u.kind,
      gold: TIER.isGoldTier(u), blocked: Boolean(u.blocked_at),
    };
    if (p) { o.plateId = p.id; o.plateCountry = p.country; o.plateLevel = p.level; o.plateRarity = p.rarity; }
    // уровень и «где я»: регион на номере — VIP 777/888 у Голд и Блэк, у остальных — место
    if (u.kind === 'human' || u.kind === 'person') {
      o.tier = TIER.tierOf(u);
      const reg = p?.country === 'RU' ? (/(\d{2,3})$/.exec(p.code) || [])[1] : null;
      o.place = placeOf(u.place) ? u.place : defaultPlace(p?.country || 'RU', reg);
      const vip = TIER.vipRegionOf(u);
      if (vip) o.vipRegion = vip;
    }
    if (u.kind === 'twin') o.ownerId = u.owner_id;
    const st = statusOf(u);
    if (st) o.status = st;
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
    if (chat.biz) v.biz = chat.biz;
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
  function findByLogin(login, regionHint) {
    const s = String(login || '').trim();
    if (!s || s.length > 40) return null;
    const human = (sql, v) => db.prepare(`SELECT * FROM users WHERE kind = 'human' AND ${sql} = ?`).get(v);
    if (looksLikePhone(s)) { const u = human('phone', normalizePhone(s)); if (u) return u; }
    // номер: по ключу (кириллица = латиница), «001» и «а001мр» — как российские А…МР 777;
    // подходит любой номер человека, не только основной (сменил основной — старый для входа годится)
    const keys = new Set([plateKey(s)]);
    const ru = parsePlate(s, 'RU');
    if (ru) keys.add(plateKey(ru));
    for (const k of keys) {
      if (!k) continue;
      const u = db.prepare("SELECT u.* FROM users u JOIN plates p ON p.owner_id = u.id WHERE u.kind = 'human' AND p.key = ?").get(k);
      if (u) return u;
    }
    for (const k of keys) { const u = k && human('old_plate_key', k); if (u) return u; } // номер АМР, сменённый при переходе на третью версию
    // Только серия («А 001 МР»): регион в окне входа — это «где я сейчас», номер ищем по серии.
    // У одной серии в разных регионах может быть несколько хозяев — тогда помогает регион или основной номер.
    const ser = /^([A-Z])(\d{1,3})([A-Z]{2})$/.exec(plateKey(s));
    if (ser) {
      const prefix = `${ser[1]}${ser[2].padStart(3, '0')}${ser[3]}`;
      const rows = db.prepare(`SELECT u.*, p.key AS pkey, p.id AS pid FROM users u JOIN plates p ON p.owner_id = u.id
        WHERE u.kind = 'human' AND p.country = 'RU' AND p.key LIKE ? AND length(p.key) BETWEEN 8 AND 9`).all(`${prefix}%`);
      const owners = [...new Map(rows.map((r) => [r.id, r])).values()];
      if (owners.length === 1) return userRow(owners[0].id);
      const reg = /^\d{2,3}$/.test(String(regionHint || '')) ? rows.find((r) => r.pkey === `${prefix}${regionHint}`) : null;
      if (reg) return userRow(reg.id);
      const main = owners.filter((o) => rows.some((r) => r.id === o.id && r.pid === o.plate_id));
      if (main.length === 1) return userRow(main[0].id);
    }
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

  const wall = createWall({ db, dataDir, sendToAll, log });
  bots = createBots({
    db, ai, log, timing: botTiming, memberIds, post: botPost, ensureDm, sendTo, broadcastChat, broadcastUser, wall,
    presence: (userId, online) => sendToAll({ type: 'presence', userId, online }),
  });
  wall.setHooks(bots.wallHooks);
  const coin = (id, d, why) => M.addCoins(db, id, d, why);
  const night = createNight({ db, ai, log, addCoins: coin, userRow, sendToAll, timing: botTiming || {} });
  const catalog = createCatalog({ db, addCoins: coin, userRow, askaId: () => bots.askaId() });
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

  // Состояние «мозга» видно снаружи (без ключей): есть ли ключ, включены ли ИИ-люди, чем кончился последний запрос
  api.get('/health', (req, res) => {
    const st = ai.status();
    const brain = { key: st.configured, people: bots.peopleEnabled(), today: st.usedToday, ok: st.lastAt ? st.worked : null, error: st.lastError || undefined };
    res.json({ ok: true, version: process.env.APP_VERSION || 'dev', brain });
  });

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
        // Самый первый человек становится администратором (голд) и получает А 001 МР 777
        const firstAdmin = !db.prepare("SELECT 1 FROM users WHERE is_admin = 1 AND kind = 'human'").get();
        const now = Date.now();
        const tmp = `new_${crypto.randomBytes(6).toString('hex')}`;
        const { lastInsertRowid } = db.prepare(`
          INSERT INTO users (username, display_name, box_pk, kdf_salt, auth_hash, backup_n, backup_c, created_at, phone, phone_verified, last_active, role, is_admin)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(wanted || tmp, name, body.boxPk, body.kdfSalt, sha256hex(Buffer.from(body.authKey, 'base64')), body.backup.n, body.backup.c, now, phone, verified, now,
          firstAdmin ? 'admin' : 'user', firstAdmin ? 1 : 0);
        const userId = Number(lastInsertRowid);
        const country = countryForPhone(phone);
        M.firstPlate(db, userId, { country, gold: firstAdmin, preferred: firstAdmin ? M.ADMIN_PLATE : null });
        const plate = userRow(userId).plate;
        let uname = wanted || plateUsername(plate);
        for (let i = 2; !wanted && db.prepare('SELECT 1 FROM users WHERE username = ? AND id != ?').get(uname, userId); i++) uname = `${plateUsername(plate)}_${i}`;
        db.prepare('UPDATE users SET username = ? WHERE id = ?').run(uname, userId);
        M.addCoins(db, userId, WELCOME_COINS, 'подарок новичку');
        const inviter = db.prepare('SELECT created_by FROM invites WHERE code = ?').get(code)?.created_by;
        if (inviter) M.addCoins(db, inviter, INVITE_BONUS, `пригласил(а) ${name}`);
        db.prepare('UPDATE invites SET used_by = ?, used_at = ? WHERE code = ?').run(userId, now, code);
        // нетворк: всем вверх по цепочке +1, 2-й и 3-й линии — аськоины
        NET.onJoined(db, userId, name, (id, d, why) => M.addCoins(db, id, d, why));
        const maxId = db.prepare('SELECT MAX(id) AS id FROM messages').get().id || 0;
        db.prepare('INSERT INTO chat_members (chat_id, user_id, read_up_to) VALUES (?, ?, ?)').run(GENERAL_CHAT, userId, maxId);
        return { userId, plate, username: uname, token: createSession(userId), inviter: inviter || null };
      });
    } catch (e) {
      log('register error', e);
      return res.status(500).json({ error: 'server' });
    }
    if (result.error) return res.status(result.status).json({ error: result.error });
    broadcastUser(result.userId);
    broadcastChat(GENERAL_CHAT);
    bots.onUserRegistered(result.userId, { inviterId: result.inviter, bonus: result.inviter ? INVITE_BONUS : 0 });
    log(`registered ${result.username}`);
    res.json({ token: result.token, userId: result.userId, plate: result.plate, username: result.username });
  });

  // Соль для пароля. Для несуществующего входа отдаём выдуманную, чтобы нельзя было перебирать телефоны и имена.
  api.get('/salt', (req, res) => {
    if (!allow(`salt:${req.ip}`, 60, 600_000)) return res.status(429).json({ error: 'too_many' });
    const login = String(req.query.login || req.query.username || '').trim();
    const u = findByLogin(login, req.query.region);
    const key = normalizePhone(login) || plateKey(parsePlate(login, 'RU') || login) || login.toLowerCase();
    const salt = u ? u.kdf_salt
      : crypto.createHmac('sha256', serverSecret).update(`salt:${key}`).digest().subarray(0, 16).toString('base64');
    res.json({ salt });
  });

  api.post('/login', json, (req, res) => {
    const { authKey } = req.body || {};
    const login = req.body?.login ?? req.body?.username;
    const user = findByLogin(login, req.body?.region);
    const lkey = user ? `login:u${user.id}` : `login:${String(login || '').toLowerCase()}`;
    if (!allow(`login:${req.ip}`, 20, 600_000) || !allow(lkey, 10, 600_000)) return res.status(429).json({ error: 'too_many' });
    if (!user || !b64Bytes(authKey, 32)) return res.status(401).json({ error: 'bad_login' });
    const given = Buffer.from(sha256hex(Buffer.from(authKey, 'base64')), 'hex');
    const stored = Buffer.from(user.auth_hash, 'hex');
    if (!crypto.timingSafeEqual(given, stored)) return res.status(401).json({ error: 'bad_login' });
    if (user.blocked_at) return res.status(403).json({ error: 'blocked' });
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
    if (user.blocked_at) return res.status(403).json({ error: 'blocked' });
    if (!validKeys(body)) return res.status(400).json({ error: 'bad_keys' });
    const token = tx(db, () => resetKeys(user, body, viaPhone));
    afterReset(user);
    res.json({ token, userId: user.id, username: user.username });
  });

  // Новый пароль и новые ключи (внутри транзакции): старые входы закрыты, старые копии сообщений этому человеку удалены
  function resetKeys(user, body, viaPhone = false) {
    const prev = [user.box_pk, ...JSON.parse(user.prev_pks || '[]')].filter((k) => k !== body.boxPk).slice(0, 5);
    db.prepare(`UPDATE users SET box_pk = ?, kdf_salt = ?, auth_hash = ?, backup_n = ?, backup_c = ?, prev_pks = ?, key_reset_at = ?,
      phone_verified = CASE WHEN ? THEN 1 ELSE phone_verified END WHERE id = ?`)
      .run(body.boxPk, body.kdfSalt, sha256hex(Buffer.from(body.authKey, 'base64')), body.backup.n, body.backup.c,
        JSON.stringify(prev), Date.now(), viaPhone ? 1 : 0, user.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
    db.prepare('DELETE FROM push_subs WHERE user_id = ?').run(user.id);
    db.prepare('DELETE FROM message_boxes WHERE recipient_id = ?').run(user.id);
    return createSession(user.id);
  }
  function afterReset(user) {
    for (const ws of conns.get(user.id) || []) ws.close(4001, 'recovered');
    broadcastUser(user.id);
    bots.onRecovered(user.id);
    log(`recovered ${user.username}`);
  }

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
    // Бонус за первый вход дня
    let bonus = 0;
    if (me.kind === 'human' && me.daily_day !== mskDay()) {
      db.prepare('UPDATE users SET daily_day = ? WHERE id = ?').run(mskDay(), me.id);
      bonus = TIER.perks(me).daily;
      M.addCoins(db, me.id, bonus, 'вход сегодня');
    }
    const fresh = userRow(req.userId);
    res.json({
      me: req.userId, users, chats, vapidPublicKey: push.publicKey, badge: unreadCount(req.userId), online: onlineIds(),
      profile: {
        isAdmin: M.isAdmin(fresh), role: fresh.role, coins: fresh.coins, bonus, phone: fresh.phone || null, phoneVerified: Boolean(fresh.phone_verified),
        allowAnon: Boolean(fresh.allow_anon), plate: fresh.plate,
        tier: TIER.tierOf(fresh), tierUntil: TIER.tierOf(fresh) === 'gold' && fresh.tier === 'gold' ? fresh.tier_until || null : null,
        vipRegion: fresh.vip_region || null, netSize: fresh.net_size || 0, upass: TIER.isBlack(fresh) ? fresh.upass || null : null,
        blackInvites: db.prepare("SELECT COUNT(*) AS n FROM tier_invites WHERE to_id = ? AND accepted_at IS NULL").get(fresh.id).n,
      },
      pins, guesses, groups: groupsOf(req.userId), hidden: [...wall.hiddenSet(req.userId)], features: { ai: ai.available(), sms: sms.configured() },
      ...(M.isAdmin(fresh) ? { brain: { key: ai.configured(), people: bots.peopleEnabled(), error: ai.status().lastError || '' } } : {}),
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
    if (u.blocked_at) return res.status(403).json({ error: 'blocked' });
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

  // Стены: записи, фото, открытки, магниты, цветочки и «Стена АСЬКИ» (server/src/wall.js)
  wall.mount(api, { auth, json, allow, userRow });

  // ---------- уровни: Гость / Голд / Блэк ----------

  // Закрытый чат Блэк: все, у кого уровень Блэк, — участники; остальных нет
  function syncBlackChat(userId) {
    const u = userRow(userId);
    if (!u || u.kind !== 'human') return;
    db.prepare(`INSERT OR IGNORE INTO chats (id, kind, title, emoji, about, is_public, created_at) VALUES (?, 'circle', 'Блэк', '🖤', ?, 0, ?)`)
      .run(TIER.BLACK_CHAT, 'Закрытый чат уровня Блэк: только по приглашению', Date.now());
    const inside = memberIds(TIER.BLACK_CHAT).includes(userId);
    if (TIER.isBlack(u) && !u.blocked_at && !inside) {
      const maxId = db.prepare('SELECT MAX(id) AS id FROM messages WHERE chat_id = ?').get(TIER.BLACK_CHAT).id || 0;
      db.prepare('INSERT INTO chat_members (chat_id, user_id, read_up_to) VALUES (?, ?, ?)').run(TIER.BLACK_CHAT, userId, maxId);
      broadcastChat(TIER.BLACK_CHAT);
    } else if ((!TIER.isBlack(u) || u.blocked_at) && inside) {
      db.prepare('DELETE FROM chat_members WHERE chat_id = ? AND user_id = ?').run(TIER.BLACK_CHAT, userId);
      broadcastChat(TIER.BLACK_CHAT);
      sendTo(userId, { type: 'chat_left', chatId: TIER.BLACK_CHAT });
    }
  }
  // Стал Блэк: пропуск UPASS, закрытый чат, блок в цепочке
  function becameBlack(userId, byId) {
    const u = userRow(userId);
    if (!u.upass) db.prepare('UPDATE users SET upass = ? WHERE id = ?').run(TIER.upassCode(), userId);
    L.append(db, { kind: 'tier.black', ref: `user:${userId}`, actor: byId || null, data: { name: u.display_name } });
    syncBlackChat(userId);
  }
  function setTier(userId, tier, until, byId) {
    const before = TIER.tierOf(userRow(userId));
    db.prepare('UPDATE users SET tier = ?, tier_until = ? WHERE id = ?').run(tier, until ?? null, userId);
    const after = TIER.tierOf(userRow(userId));
    if (after === 'black' && before !== 'black') becameBlack(userId, byId);
    else syncBlackChat(userId);
    // твой приглашённый стал Голд — тебе подарок (один раз за человека)
    if (TIER.tierRank(userRow(userId)) >= 1 && before === 'guest' && getSetting(db, `gold_friend:${userId}`) !== '1') {
      setSetting(db, `gold_friend:${userId}`, '1');
      const inv = NET.inviterOf(db, userId);
      if (inv && userRow(inv)?.kind === 'human') {
        M.addCoins(db, inv, NET.GOLD_FRIEND_BONUS, `${userRow(userId).display_name} стал(а) Голд`);
        bots.askaSay(inv, [`⭐ ${userRow(userId).display_name}, кого ты позвал(а), теперь Голд! Тебе +${NET.GOLD_FRIEND_BONUS} 🪙`]);
      }
    }
    broadcastUser(userId);
  }

  function levelsView(u) {
    const t = TIER.tierOf(u);
    const sentBlack = db.prepare("SELECT COUNT(*) AS n FROM tier_invites WHERE from_id = ? AND created_at > ?").get(u.id, Date.now() - 30 * 86_400_000).n;
    return {
      tier: t, tierUntil: t === 'gold' && u.tier === 'gold' ? u.tier_until || null : null, coins: u.coins, netSize: u.net_size || 0,
      tiers: TIER.TIER_ORDER.map((k) => ({ ...TIER.TIERS[k], perks: TIER.TIER_PERKS[k] })),
      gold: { price: TIER.GOLD_PRICE, days: TIER.GOLD_DAYS, net: TIER.NET_GOLD },
      vipRegion: u.vip_region || null, vipRegions: TIER.VIP_REGIONS, upass: TIER.isBlack(u) ? u.upass || null : null,
      blackChat: TIER.isBlack(u) ? TIER.BLACK_CHAT : null,
      blackInvites: db.prepare(`SELECT i.id, i.created_at AS createdAt, u.display_name AS fromName FROM tier_invites i JOIN users u ON u.id = i.from_id
        WHERE i.to_id = ? AND i.accepted_at IS NULL`).all(u.id).map((r) => ({ ...r })),
      canInviteBlack: (TIER.isBlack(u) || M.isAdmin(u)) && (M.isAdmin(u) || sentBlack < TIER.BLACK_INVITES_PER_MONTH),
      isAdmin: M.isAdmin(u),
    };
  }
  api.get('/levels', auth, (req, res) => res.json(levelsView(userRow(req.userId))));

  // Голд за аськоины: 500 на 30 дней (продлевается с конца оплаченного срока). У Блэк и админов — не нужно.
  api.post('/levels/gold', auth, (req, res) => {
    const me = userRow(req.userId);
    if (TIER.isBlack(me) || (TIER.tierOf(me) === 'gold' && me.tier !== 'gold')) return res.status(409).json({ error: 'already' });
    if ((me.coins || 0) < TIER.GOLD_PRICE) return res.status(402).json({ error: 'no_coins', price: TIER.GOLD_PRICE });
    const from = me.tier === 'gold' && me.tier_until && me.tier_until > Date.now() ? me.tier_until : Date.now();
    tx(db, () => {
      M.addCoins(db, me.id, -TIER.GOLD_PRICE, `Голд на ${TIER.GOLD_DAYS} дней`);
      setTier(me.id, 'gold', from + TIER.GOLD_DAYS * 86_400_000, me.id);
    });
    res.json(levelsView(userRow(me.id)));
  });

  // VIP-регион на номере у Голд и Блэк: 777 или 888
  api.post('/levels/vip-region', auth, json, (req, res) => {
    const me = userRow(req.userId);
    if (!TIER.isGoldTier(me)) return res.status(403).json({ error: 'level' });
    if (!TIER.VIP_REGIONS.includes(req.body?.region)) return res.status(400).json({ error: 'bad_request' });
    db.prepare('UPDATE users SET vip_region = ? WHERE id = ?').run(req.body.region, me.id);
    broadcastUser(me.id);
    res.json({ vipRegion: req.body.region });
  });

  // Где я сейчас — регион на номере (у Голд и Блэк виден в карточке, на номере — VIP)
  api.post('/me/place', auth, json, (req, res) => {
    if (!placeOf(req.body?.place)) return res.status(400).json({ error: 'bad_request' });
    db.prepare('UPDATE users SET place = ? WHERE id = ?').run(req.body.place, req.userId);
    broadcastUser(req.userId);
    res.json({ place: req.body.place });
  });
  api.get('/places', (req, res) => res.json({ places: PLACES, vip: TIER.VIP_REGIONS }));
  // 📖 «Книга перемен» — открыта всем, в том числе до входа
  api.get('/book', (req, res) => res.json(bookView()));

  // Позвать в Блэк: Блэк — одного человека в месяц, администрация — без ограничений. Человек сам принимает.
  api.post('/levels/black-invite', auth, json, (req, res) => {
    const me = userRow(req.userId);
    const target = Number.isInteger(req.body?.userId) ? userRow(req.body.userId) : null;
    if (!target || target.kind !== 'human' || target.id === me.id || target.blocked_at) return res.status(400).json({ error: 'bad_request' });
    if (!levelsView(me).canInviteBlack) return res.status(403).json({ error: 'forbidden' });
    if (TIER.isBlack(target)) return res.status(409).json({ error: 'already' });
    const { changes } = db.prepare("INSERT OR IGNORE INTO tier_invites (from_id, to_id, tier, created_at) VALUES (?, ?, 'black', ?)").run(me.id, target.id, Date.now());
    if (!changes) return res.status(409).json({ error: 'invited' });
    bots.askaSay(target.id, [`🖤 ${me.display_name} приглашает тебя в Блэк — закрытый уровень АСЬКИ: чёрная карта, закрытый чат, пропуск UPASS. Принять — «Ещё» → «🎖 Уровни».`]);
    res.json({ ok: true });
  });
  api.post('/levels/black-accept', auth, json, (req, res) => {
    const me = userRow(req.userId);
    const inv = db.prepare("SELECT * FROM tier_invites WHERE id = ? AND to_id = ? AND accepted_at IS NULL").get(Number(req.body?.inviteId), me.id);
    if (!inv) return res.status(404).json({ error: 'not_found' });
    tx(db, () => {
      db.prepare('UPDATE tier_invites SET accepted_at = ? WHERE id = ?').run(Date.now(), inv.id);
      setTier(me.id, 'black', null, inv.from_id);
    });
    bots.askaSay(inv.from_id, [`🖤 ${me.display_name} принял(а) твоё приглашение в Блэк.`]);
    res.json(levelsView(userRow(me.id)));
  });

  // ---------- мой нетворк ----------
  api.get('/network', auth, (req, res) => {
    const me = userRow(req.userId);
    const nodeView = (id) => { const u = userRow(id); return { id, name: u?.display_name || '?', plate: u?.plate || null, tier: TIER.tierOf(u), blocked: Boolean(u?.blocked_at), size: u?.net_size || 0 }; };
    const t = NET.tree(db, me.id, nodeView);
    const earned = db.prepare("SELECT COALESCE(SUM(delta), 0) AS s FROM coin_log WHERE user_id = ? AND (reason LIKE 'пригласил(а)%' OR reason LIKE 'нетворк:%' OR reason LIKE '%стал(а) Голд')").get(me.id).s;
    const inv = NET.inviterOf(db, me.id);
    res.json({ ...t, earned, netSize: me.net_size || 0, invitedBy: inv ? nodeView(inv) : null, bonuses: { lines: NET.LINE_BONUS, gold: NET.GOLD_FRIEND_BONUS, penalty: NET.BLOCK_PENALTY, netGold: TIER.NET_GOLD } });
  });

  // ---------- администрация: уровень человека ----------
  api.post('/admin/users/:id/tier', auth, admin, json, (req, res) => {
    const target = humanTarget(req);
    const tier = req.body?.tier;
    const days = req.body?.days;
    if (!target || !TIER.TIERS[tier] || (days != null && !(Number.isInteger(days) && days > 0 && days <= 3650))) return res.status(400).json({ error: 'bad_request' });
    if (target.id !== req.me.id && !canManage(req.me, target) && target.role !== 'user') return res.status(403).json({ error: 'forbidden' });
    tx(db, () => setTier(target.id, tier, tier === 'gold' && days ? Date.now() + days * 86_400_000 : null, req.me.id));
    log(`tier ${target.username} → ${tier}${days ? ` ${days}d` : ''} by ${req.me.username}`);
    res.json({ ok: true, tier: TIER.tierOf(userRow(target.id)) });
  });

  // ---------- ночь ----------
  api.get('/night', auth, (req, res) => res.json(night.overview(req.userId)));
  api.get('/night/collection', auth, (req, res) => res.json({ avatars: night.collection() }));
  const sendResult = (res, r) => (r.error ? res.status(r.status).json({ error: r.error, ...(r.price != null ? { price: r.price } : {}), ...(r.freeLeft != null ? { freeLeft: r.freeLeft } : {}) }) : res.json(r));
  api.post('/night/avatar', auth, json, (req, res) => {
    if (!allow(`mint:${req.userId}`, 10, 600_000)) return res.status(429).json({ error: 'too_many' });
    sendResult(res, night.mint(req.userId, req.body?.id, req.body?.nick));
  });
  api.get('/night/rooms/:key', auth, (req, res) => {
    const v = night.roomView(req.userId, req.params.key, Number(req.query.before) || 0);
    if (!v) return res.status(404).json({ error: 'not_found' });
    res.json(v);
  });
  api.post('/night/rooms/:key/enter', auth, (req, res) => sendResult(res, night.enter(req.userId, req.params.key)));
  api.post('/night/rooms/:key/pay', auth, (req, res) => sendResult(res, night.payHour(req.userId, req.params.key)));
  api.post('/night/rooms/:key/messages', auth, json, (req, res) => {
    if (!allow(`nmsg:${req.userId}`, 40, 600_000)) return res.status(429).json({ error: 'too_many' });
    sendResult(res, night.post(req.userId, req.params.key, req.body?.text));
  });
  api.post('/night/messages/:id/thanks', auth, (req, res) => sendResult(res, night.thank(req.userId, Number(req.params.id))));
  api.post('/admin/night/:key/president', auth, admin, json, (req, res) => {
    const uid = req.body?.userId == null ? null : Number(req.body.userId);
    if (uid !== null && userRow(uid)?.kind !== 'human') return res.status(400).json({ error: 'bad_request' });
    if (!night.setPresident(req.params.key, uid)) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  });

  // ---------- реестр (музыка, кино, книги) и цепочка блоков ----------
  api.get('/catalog', auth, (req, res) => res.json({ items: catalog.list({ kind: req.query.kind, q: String(req.query.q || '').slice(0, 60), before: Number(req.query.before) || 0, userId: req.query.mine ? req.userId : 0 }) }));
  api.get('/catalog/:id', auth, (req, res) => { const it = catalog.get(Number(req.params.id)); return it ? res.json({ item: it }) : res.status(404).json({ error: 'not_found' }); });
  api.post('/catalog', auth, json, (req, res) => {
    if (!allow(`cat:${req.userId}`, 30, 86_400_000)) return res.status(429).json({ error: 'too_many' });
    const r = catalog.add(req.userId, req.body);
    if (r.error) return res.status(r.status).json({ error: r.error, ...(r.item ? { item: r.item } : {}) });
    res.json(r);
  });
  api.post('/catalog/:id/claim', auth, (req, res) => sendResult(res, catalog.claim(req.userId, Number(req.params.id))));
  api.get('/admin/catalog', auth, admin, (req, res) => res.json({ claims: catalog.claims() }));
  api.post('/admin/catalog/:id', auth, admin, json, (req, res) => sendResult(res, catalog.decide(req.me.id, Number(req.params.id), Boolean(req.body?.ok), req.body?.note)));
  api.get('/ledger', auth, (req, res) => {
    const before = Number(req.query.before) || 0;
    const rows = db.prepare(`SELECT * FROM ledger ${before ? 'WHERE id < ?' : ''} ORDER BY id DESC LIMIT 40`).all(...(before ? [before] : []));
    res.json({ blocks: rows.map(L.blockView), check: L.verify(db) });
  });

  // Статус: готовый (key) или свой (emoji + text); пустой — снять
  api.post('/me/status', auth, json, (req, res) => {
    const b = req.body || {};
    let value = null;
    if (typeof b.key === 'string' && b.key) {
      if (!STATUSES.some((x) => x.key === b.key)) return res.status(400).json({ error: 'bad_status' });
      value = { key: b.key };
    } else if (typeof b.text === 'string' || typeof b.emoji === 'string') {
      const text = cleanText(b.text || '', 40);
      const emoji = String(b.emoji || '').trim();
      if (text === null || emoji.length > 16 || (emoji && !/\p{Extended_Pictographic}/u.test(emoji)) || /[<>]/.test(emoji)) return res.status(400).json({ error: 'bad_status' });
      if (text || emoji) value = { emoji, text };
    }
    db.prepare('UPDATE users SET status = ?, status_at = ? WHERE id = ?').run(value ? JSON.stringify(value) : null, value ? Date.now() : null, req.userId);
    broadcastUser(req.userId);
    res.json({ status: statusOf(userRow(req.userId)) });
  });

  api.post('/groups', auth, json, (req, res) => {
    const { userId, group } = req.body || {};
    const t = Number.isInteger(userId) && userId !== req.userId ? userRow(userId) : null;
    if (!t || !['human', 'person'].includes(t.kind) || !GROUPS.includes(group)) return res.status(400).json({ error: 'bad_request' });
    db.prepare(`INSERT INTO contact_groups (user_id, target_id, grp) VALUES (?, ?, ?)
      ON CONFLICT(user_id, target_id) DO UPDATE SET grp = excluded.grp`).run(req.userId, userId, group);
    res.json({ groups: groupsOf(req.userId) });
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
    if (guess === truth) M.addCoins(db, req.userId, GUESS_BONUS, 'угадал(а) в «Кто здесь ИИ?»');
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
          isPublic: c.kind === 'general' || Boolean(c.is_public), member: Boolean(c.member), count: ids.length, biz: c.biz || undefined,
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
    // рабочий чат («Бизнес»): всегда закрытый, в своём разделе
    const biz = b.biz == null ? null : BIZ.includes(b.biz) ? b.biz : undefined;
    if (!title || about === null || biz === undefined) return res.status(400).json({ error: 'bad_request' });
    const ids = [...new Set(Array.isArray(b.memberIds) ? b.memberIds : [])]
      .filter((id) => Number.isInteger(id) && id !== req.userId)
      .filter((id) => ['human', 'person'].includes(userRow(id)?.kind));
    const id = `circle:${crypto.randomBytes(6).toString('hex')}`;
    tx(db, () => {
      db.prepare("INSERT INTO chats (id, kind, title, emoji, about, is_public, created_by, created_at, biz) VALUES (?, 'circle', ?, ?, ?, ?, ?, ?, ?)")
        .run(id, title, emoji || '⭕', about || null, b.isPublic && !biz ? 1 : 0, req.userId, Date.now(), biz);
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

  // Позвать людей в закрытый круг или рабочий чат: может любой его участник. Новенькие видят переписку с этого момента.
  api.post('/circles/:id/members', auth, json, (req, res) => {
    const c = db.prepare("SELECT * FROM chats WHERE id = ? AND kind = 'circle'").get(req.params.id);
    if (!c || !memberIds(c.id).includes(req.userId)) return res.status(404).json({ error: 'not_found' });
    if (!allow(`cmem:${req.userId}`, 60, 3_600_000)) return res.status(429).json({ error: 'too_many' });
    const ids = [...new Set(Array.isArray(req.body?.userIds) ? req.body.userIds : [])]
      .filter((id) => Number.isInteger(id) && ['human', 'person'].includes(userRow(id)?.kind) && !userRow(id).blocked_at);
    if (!ids.length || ids.length > 50) return res.status(400).json({ error: 'bad_request' });
    const maxId = db.prepare('SELECT MAX(id) AS id FROM messages WHERE chat_id = ?').get(c.id).id || 0;
    const ins = db.prepare('INSERT OR IGNORE INTO chat_members (chat_id, user_id, read_up_to) VALUES (?, ?, ?)');
    tx(db, () => { for (const uid of ids) ins.run(c.id, uid, maxId); });
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
      id: u.id, displayName: u.display_name, username: u.username, plate: u.plate, plateView: plateView(M.plateRow(db, u.plate_id)),
      phone: u.phone, phoneVerified: Boolean(u.phone_verified), createdAt: u.created_at, lastActive: u.last_active,
      isAdmin: M.isAdmin(u), role: u.role, blocked: Boolean(u.blocked_at), coins: u.coins,
      tier: TIER.tierOf(u), tierUntil: u.tier === 'gold' ? u.tier_until || null : null, netSize: u.net_size || 0,
    }));
    const hasSuper = anySuper();
    res.json({ ai: ai.status(), people: bots.peopleEnabled(), sms: sms.status(), users, me: { role: req.me.role, id: req.me.id }, hasSuper, canInviteSuper: req.me.role === 'super' || !hasSuper, party: bots.partyResults() });
  });

  // Кто кого может менять: админа и супер-админа — только супер-админ; обычных — любой админ. Себя — никто.
  function canManage(me, target) {
    if (!target || target.kind !== 'human' || target.id === me.id) return false;
    if (target.role === 'admin' || target.role === 'super') return me.role === 'super';
    return true;
  }
  const humanTarget = (req) => { const u = userRow(Number(req.params.id)); return u && u.kind === 'human' ? u : null; };

  // Сделать голд (админом) или снять
  api.post('/admin/users/:id/role', auth, admin, json, (req, res) => {
    const target = humanTarget(req);
    const role = req.body?.role;
    if (!target || !['admin', 'user'].includes(role)) return res.status(400).json({ error: 'bad_request' });
    if (role === 'admin' && target.role === 'user' && !target.blocked_at) {
      tx(db, () => {
        db.prepare("UPDATE users SET role = 'admin', is_admin = 1 WHERE id = ?").run(target.id);
        M.grantGoldPlate(db, userRow(target.id));
      });
    } else if (role === 'user' && (target.role === 'admin' || target.role === 'super')) {
      if (!canManage(req.me, target)) return res.status(403).json({ error: 'forbidden' });
      tx(db, () => {
        db.prepare("UPDATE users SET role = 'user', is_admin = 0 WHERE id = ?").run(target.id);
        M.revokeGoldPlates(db, userRow(target.id));
      });
    } else if (target.role !== role) return res.status(403).json({ error: 'forbidden' });
    broadcastUser(target.id);
    log(`role ${target.username} → ${role} by ${req.me.username}`);
    res.json({ ok: true });
  });

  // Заблокировать: вход закрыт, сессии сброшены, из общих бесед и кругов убран. Разблокировать — вернётся в общий чат.
  api.post('/admin/users/:id/block', auth, admin, json, (req, res) => {
    const target = humanTarget(req);
    if (!canManage(req.me, target)) return res.status(403).json({ error: 'forbidden' });
    const blocked = Boolean(req.body?.blocked);
    let left = [];
    tx(db, () => {
      if (blocked) {
        db.prepare('UPDATE users SET blocked_at = ? WHERE id = ?').run(Date.now(), target.id);
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(target.id);
        db.prepare('DELETE FROM push_subs WHERE user_id = ?').run(target.id);
        left = db.prepare("SELECT m.chat_id FROM chat_members m JOIN chats c ON c.id = m.chat_id WHERE m.user_id = ? AND c.kind IN ('general', 'circle')").all(target.id).map((r) => r.chat_id);
        for (const c of left) db.prepare('DELETE FROM chat_members WHERE chat_id = ? AND user_id = ?').run(c, target.id);
      } else {
        db.prepare('UPDATE users SET blocked_at = NULL WHERE id = ?').run(target.id);
        const maxId = db.prepare('SELECT MAX(id) AS id FROM messages').get().id || 0;
        db.prepare('INSERT OR IGNORE INTO chat_members (chat_id, user_id, read_up_to) VALUES (?, ?, ?)').run(GENERAL_CHAT, target.id, maxId);
        left = [GENERAL_CHAT];
      }
    });
    if (blocked) for (const ws of conns.get(target.id) || []) ws.close(4003, 'blocked');
    // «Мы в ответе за тех, кого пригласили»: с пригласившего — штраф
    const inviter = blocked ? NET.inviterOf(db, target.id) : null;
    if (inviter && userRow(inviter)?.kind === 'human') {
      M.addCoins(db, inviter, -NET.BLOCK_PENALTY, `в ответе за приглашённого: ${target.display_name} заблокирован(а)`);
      bots.askaSay(inviter, [`⚠️ ${target.display_name}, кого ты позвал(а) в АСЬКУ, заблокирован(а) за нарушение правил. По правилу «мы в ответе за тех, кого пригласили» — −${NET.BLOCK_PENALTY} 🪙. Зови тех, за кого ручаешься 🌼`]);
    }
    for (const c of left) broadcastChat(c);
    broadcastUser(target.id);
    log(`${blocked ? 'blocked' : 'unblocked'} ${target.username} by ${req.me.username}`);
    res.json({ ok: true });
  });

  // Сменить номер человеку: любой формат любой страны. Занятый другим — нельзя, золотой — только голд.
  api.post('/admin/users/:id/plate', auth, admin, json, (req, res) => {
    const target = humanTarget(req);
    if (!target || (target.id !== req.me.id && !canManage(req.me, target) && target.role !== 'user')) return res.status(403).json({ error: 'forbidden' });
    const country = COUNTRIES[req.body?.country] ? req.body.country : 'RU';
    const code = parsePlate(req.body?.code, country, req.body?.region);
    if (!code) return res.status(400).json({ error: 'bad_plate' });
    if (isGoldCode(country, code) && !M.canGoldPlate(target)) return res.status(400).json({ error: 'gold_only' });
    const existing = db.prepare('SELECT * FROM plates WHERE key = ?').get(plateKey(code));
    if (existing && existing.owner_id && existing.owner_id !== target.id) {
      return res.status(409).json({ error: 'plate_taken', owner: userRow(existing.owner_id)?.display_name || '' });
    }
    tx(db, () => {
      if (existing) {
        if (existing.owner_id !== target.id) {
          db.prepare('UPDATE plates SET owner_id = ?, price = NULL WHERE id = ?').run(target.id, existing.id);
          db.prepare("INSERT INTO plate_history (plate_id, from_id, to_id, price, kind, note, at) VALUES (?, NULL, ?, NULL, 'admin', ?, ?)").run(existing.id, target.id, `выдал ${req.me.display_name}`, Date.now());
        }
        M.activate(db, target.id, existing.id);
      } else {
        M.give(db, target.id, { country, code, kind: 'admin', note: `выдал ${req.me.display_name}` });
      }
    });
    broadcastUser(target.id);
    res.json({ ok: true, plate: plateView(M.plateRow(db, userRow(target.id).plate_id)) });
  });

  // Начислить или списать аськоины
  api.post('/admin/users/:id/coins', auth, admin, json, (req, res) => {
    const target = humanTarget(req);
    const delta = req.body?.delta;
    if (!target || !Number.isInteger(delta) || !delta || Math.abs(delta) > 1_000_000) return res.status(400).json({ error: 'bad_request' });
    M.addCoins(db, target.id, delta, delta > 0 ? `подарок от ${req.me.display_name}` : `списал(а) ${req.me.display_name}`);
    res.json({ coins: userRow(target.id).coins });
  });

  // Супер-админ: создаётся один раз админом (пароль шифруется на телефоне, как при регистрации)
  api.post('/admin/super', auth, admin, json, (req, res) => {
    if (req.me.role !== 'super' && anySuper()) return res.status(409).json({ error: 'super_exists' });
    const b = req.body || {};
    const login = typeof b.login === 'string' ? b.login.trim() : '';
    const uname = login.toLowerCase();
    if (!USERNAME_RE.test(uname)) return res.status(400).json({ error: 'bad_username' });
    if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(uname)) return res.status(409).json({ error: 'username_taken' });
    if (!validKeys(b)) return res.status(400).json({ error: 'bad_keys' });
    const userId = tx(db, () => createSuperAccount(uname, cleanName(b.displayName) || login, b));
    afterSuperCreated(userId);
    log(`super admin ${uname} created by ${req.me.username}`);
    res.json({ ok: true, plate: userRow(userId).plate });
  });

  // Новый вход супер-админа (внутри транзакции)
  function createSuperAccount(uname, displayName, keys) {
    const now = Date.now();
    const { lastInsertRowid } = db.prepare(`
      INSERT INTO users (username, display_name, box_pk, kdf_salt, auth_hash, backup_n, backup_c, created_at, last_active, role, is_admin)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'super', 1)
    `).run(uname, displayName, keys.boxPk, keys.kdfSalt, sha256hex(Buffer.from(keys.authKey, 'base64')), keys.backup.n, keys.backup.c, now, now);
    const id = Number(lastInsertRowid);
    M.grantGoldPlate(db, userRow(id));
    M.addCoins(db, id, WELCOME_COINS, 'подарок новичку');
    const maxId = db.prepare('SELECT MAX(id) AS id FROM messages').get().id || 0;
    db.prepare('INSERT INTO chat_members (chat_id, user_id, read_up_to) VALUES (?, ?, ?)').run(GENERAL_CHAT, id, maxId);
    return id;
  }
  function afterSuperCreated(userId) {
    broadcastUser(userId);
    broadcastChat(GENERAL_CHAT);
    bots.onUserRegistered(userId);
  }

  // ---------- ссылка супер-админа ----------
  // Создать: админ — пока супер-админа нет, супер-админ — всегда. login — уже существующий вход (логин, телефон, номер)
  // или новый логин. Ссылка одноразовая, на 7 дней; новая ссылка на тот же вход отменяет прежнюю.
  const anySuper = (exceptId = 0) => Boolean(db.prepare("SELECT 1 FROM users WHERE role = 'super' AND id != ? AND blocked_at IS NULL").get(exceptId));

  api.post('/admin/super-link', auth, admin, json, (req, res) => {
    if (req.me.role !== 'super' && anySuper()) return res.status(409).json({ error: 'super_exists' });
    const login = typeof req.body?.login === 'string' ? req.body.login.trim() : '';
    if (!login) return res.status(400).json({ error: 'bad_username' });
    const target = findByLogin(login);
    let code;
    if (target) {
      if (target.role === 'super') return res.status(409).json({ error: 'already_super' });
      if (target.blocked_at) return res.status(400).json({ error: 'blocked' });
      code = superLinks.create({ createdBy: req.me.id, userId: target.id });
    } else {
      const uname = login.toLowerCase();
      if (!USERNAME_RE.test(uname)) return res.status(400).json({ error: 'bad_username' });
      if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(uname)) return res.status(409).json({ error: 'username_taken' });
      code = superLinks.create({ createdBy: req.me.id, username: uname });
    }
    log(`super link for ${target ? target.username : login.toLowerCase()} by ${req.me.username}`);
    res.json({
      code,
      target: target ? { displayName: target.display_name, username: target.username, plate: target.plate } : null,
      username: target ? target.username : login.toLowerCase(),
    });
  });

  // Ссылка ещё действует? Кто позвал и для какого входа
  function superLinkInfo(row) {
    const by = row.created_by ? userRow(row.created_by) : null;
    const t = row.target_id ? userRow(row.target_id) : null;
    // админ, создавший ссылку, должен оставаться админом; если с тех пор появился другой супер-админ — ссылка от админа не действует
    if (!row.from_console && (!by || !M.isAdmin(by) || by.blocked_at || (by.role !== 'super' && anySuper(row.target_id || 0)))) return null;
    if (row.target_id && (!t || t.blocked_at || t.kind !== 'human')) return null;
    return { by, target: t };
  }

  api.get('/super-link/:code', (req, res) => {
    if (!allow(`slink:${req.ip}`, 30, 600_000)) return res.status(429).json({ error: 'too_many' });
    const row = superLinks.read(req.params.code);
    const info = row && superLinkInfo(row);
    if (!info) return res.status(404).json({ error: 'link_invalid' });
    res.json({
      username: info.target ? info.target.username : row.username,
      exists: Boolean(info.target),
      displayName: info.target ? info.target.display_name : null,
      plate: info.target ? info.target.plate : null,
      invitedBy: info.by ? info.by.display_name : null,
    });
  });

  // Принять ссылку. Уже есть в АСЬКЕ: либо вошёл своим паролем (токен в заголовке), либо задаёт новый пароль (новые ключи).
  // Нового входа нет: имя + пароль (ключи делаются на телефоне).
  api.post('/super-link/claim', json, (req, res) => {
    if (!allow(`sclaim:${req.ip}`, 10, 600_000)) return res.status(429).json({ error: 'too_many' });
    const body = req.body || {};
    const row = superLinks.read(body.code);
    const info = row && superLinkInfo(row);
    if (!info) return res.status(404).json({ error: 'link_invalid' });
    const by = info.by ? info.by.username : 'console';
    if (info.target) {
      const t = info.target;
      const s = sessionByToken(bearer(req));
      if (s && s.user_id === t.id) {
        tx(db, () => { makeSuper(t.id); superLinks.markUsed(row); });
        broadcastUser(t.id);
        log(`super admin ${t.username} (link from ${by})`);
        return res.json({ ok: true, userId: t.id, username: t.username, plate: userRow(t.id).plate });
      }
      if (!validKeys(body)) return res.status(401).json({ error: 'unauthorized' });
      const token = tx(db, () => { const tk = resetKeys(t, body); makeSuper(t.id); superLinks.markUsed(row); return tk; });
      afterReset(t);
      log(`super admin ${t.username} with new password (link from ${by})`);
      return res.json({ ok: true, token, userId: t.id, username: t.username, plate: userRow(t.id).plate });
    }
    const name = cleanName(body.displayName);
    if (!name) return res.status(400).json({ error: 'bad_name' });
    if (!validKeys(body)) return res.status(400).json({ error: 'bad_keys' });
    const result = tx(db, () => {
      if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(row.username)) return null;
      const id = createSuperAccount(row.username, name, body);
      superLinks.markUsed(row);
      return { id, token: createSession(id) };
    });
    if (!result) return res.status(409).json({ error: 'username_taken' });
    afterSuperCreated(result.id);
    log(`super admin ${row.username} created (link from ${by})`);
    res.json({ ok: true, token: result.token, userId: result.id, username: row.username, plate: userRow(result.id).plate });
  });

  // Стать супер-админом (внутри транзакции): голд, золотой номер
  function makeSuper(userId) {
    db.prepare("UPDATE users SET role = 'super', is_admin = 1 WHERE id = ?").run(userId);
    M.grantGoldPlate(db, userRow(userId));
  }

  api.post('/admin/ai', auth, admin, json, (req, res) => {
    const b = req.body || {};
    const patch = {};
    if (typeof b.apiKey === 'string') { if (b.apiKey.length > 300) return res.status(400).json({ error: 'bad_request' }); patch.apiKey = b.apiKey.trim(); }
    if (typeof b.model === 'string') patch.model = b.model;
    if (Number.isInteger(b.dailyLimit) && b.dailyLimit >= 10 && b.dailyLimit <= 20000) patch.dailyLimit = b.dailyLimit;
    if (typeof b.paused === 'boolean') patch.paused = b.paused;
    // шлюз — адрес API, совместимый с Claude; прокси — http(s)://логин:пароль@адрес:порт
    const url = (v, protos) => { try { const x = new URL(v); return protos.includes(x.protocol) && v.length <= 300 ? v.replace(/\/+$/, '') : null; } catch { return null; } };
    if (typeof b.baseUrl === 'string') { const v = b.baseUrl.trim(); if (v && !url(v, ['https:', 'http:'])) return res.status(400).json({ error: 'bad_url' }); patch.baseUrl = v ? url(v, ['https:', 'http:']) : ''; }
    if (typeof b.proxy === 'string') { const v = b.proxy.trim(); if (v && !url(v, ['http:', 'https:'])) return res.status(400).json({ error: 'bad_proxy' }); patch.proxy = v ? url(v, ['http:', 'https:']) : ''; }
    ai.setConfig(patch);
    res.json({ ai: ai.status() });
  });

  api.post('/admin/ai/check', auth, admin, async (req, res) => {
    res.json(await ai.check());
  });

  api.post('/admin/people', auth, admin, json, (req, res) => {
    // без ключа ИИ-люди тоже живут (в сети, стены, короткие ответы), а разговаривают по-настоящему — с ключом
    bots.setPeople(Boolean(req.body?.on));
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

  // ---------- номера-токены и аськоины ----------

  const ownPlate = (req) => {
    const p = M.plateRow(db, Number(req.params.id));
    return p && p.owner_id === req.userId ? p : null;
  };

  api.get('/plates/me', auth, (req, res) => {
    const me = userRow(req.userId);
    const plates = db.prepare('SELECT * FROM plates WHERE owner_id = ? ORDER BY id').all(req.userId).map((p) => plateView(p));
    const log = db.prepare('SELECT delta, reason, at FROM coin_log WHERE user_id = ? ORDER BY id DESC LIMIT 20').all(req.userId).map((r) => ({ ...r }));
    res.json({
      coins: me.coins, activeId: me.plate_id, gold: M.canGoldPlate(me), plates, log, levels: LEVELS, discount: TIER.perks(me).discount,
      countries: Object.entries(COUNTRIES).map(([id, c]) => ({ id, name: c.name, regions: c.regions })),
      bonuses: { daily: DAILY_BONUS, invite: INVITE_BONUS, guess: GUESS_BONUS },
    });
  });

  api.get('/plates/market', auth, (req, res) => {
    const rows = db.prepare('SELECT * FROM plates WHERE price IS NOT NULL ORDER BY rarity DESC, price DESC LIMIT 200').all();
    res.json({
      showcase: rows.filter((r) => !r.owner_id).map((r) => M.viewWithOwner(db, r)),
      listings: rows.filter((r) => r.owner_id && r.owner_id !== req.userId).map((r) => M.viewWithOwner(db, r)),
    });
  });

  api.get('/plates/:id', auth, (req, res) => {
    const p = M.plateRow(db, Number(req.params.id));
    if (!p) return res.status(404).json({ error: 'not_found' });
    const name = (id) => (id ? userRow(id)?.display_name || '?' : 'АСЬКА');
    const history = db.prepare('SELECT * FROM plate_history WHERE plate_id = ? ORDER BY id').all(p.id)
      .map((h) => ({ kind: h.kind, from: name(h.from_id), to: name(h.to_id), price: h.price, note: h.note, at: h.at }));
    res.json({ plate: { ...M.viewWithOwner(db, p), history } });
  });

  // Узнать цену: свой вариант (country, region, code) или случайный обычный номер региона
  api.post('/plates/quote', auth, json, (req, res) => {
    const me = userRow(req.userId);
    const country = COUNTRIES[req.body?.country] ? req.body.country : 'RU';
    const region = COUNTRIES[country].regions.some((r) => r.code === req.body?.region) ? req.body.region : defaultRegion(country);
    let code;
    if (req.body?.code) {
      code = parsePlate(req.body.code, country, region);
      if (!code) return res.status(400).json({ error: 'bad_plate' });
    } else {
      try { code = randomFreeCode(db, country, region); } catch { return res.status(409).json({ error: 'no_plates' }); }
    }
    const gold = isGoldCode(country, code);
    const r = rarityOf(country, code);
    res.json({
      code, text: formatCode(country, code), country, region, city: cityOf(country, region), price: TIER.discounted(me, priceOf(country, code)), fullPrice: priceOf(country, code),
      rarity: r, rarityName: RARITY[r].name, free: !keyTaken(db, plateKey(code)), gold, allowed: !gold || M.canGoldPlate(me),
    });
  });

  // Купить: номер с витрины или у другого человека (plateId) — или свой вариант (country, region, code)
  api.post('/plates/buy', auth, json, (req, res) => {
    if (!allow(`buy:${req.userId}`, 30, 600_000)) return res.status(429).json({ error: 'too_many' });
    const me = userRow(req.userId);
    const b = req.body || {};
    let result;
    try {
      result = tx(db, () => {
        if (Number.isInteger(b.plateId)) {
          const p = M.plateRow(db, b.plateId);
          if (!p || p.price === null || p.owner_id === me.id) return { error: 'not_for_sale', status: 400 };
          if (!M.canHold(me, p)) return { error: 'gold_only', status: 403 };
          const pay = p.owner_id ? p.price : TIER.discounted(me, p.price); // витрина АСЬКИ — со скидкой уровня
          if (me.coins < pay) return { error: 'no_coins', status: 402 };
          M.addCoins(db, me.id, -pay, `купил(а) номер ${formatCode(p.country, p.code)}`);
          if (p.owner_id) M.addCoins(db, p.owner_id, p.price, `продал(а) номер ${formatCode(p.country, p.code)}`);
          db.prepare('UPDATE plates SET owner_id = ?, price = NULL WHERE id = ?').run(me.id, p.id);
          db.prepare("INSERT INTO plate_history (plate_id, from_id, to_id, price, kind, at) VALUES (?, ?, ?, ?, 'sale', ?)").run(p.id, p.owner_id, me.id, p.price, Date.now());
          if (b.activate) M.activate(db, me.id, p.id);
          return { id: p.id, seller: p.owner_id };
        }
        const country = COUNTRIES[b.country] ? b.country : 'RU';
        const region = COUNTRIES[country].regions.some((r) => r.code === b.region) ? b.region : defaultRegion(country);
        const code = parsePlate(b.code, country, region);
        if (!code) return { error: 'bad_plate', status: 400 };
        if (keyTaken(db, plateKey(code))) return { error: 'plate_taken', status: 409 };
        if (isGoldCode(country, code) && !M.canGoldPlate(me)) return { error: 'gold_only', status: 403 };
        const price = TIER.discounted(me, priceOf(country, code));
        if (me.coins < price) return { error: 'no_coins', status: 402 };
        M.addCoins(db, me.id, -price, `купил(а) номер ${formatCode(country, code)}`);
        const id = M.give(db, me.id, { country, code, kind: 'buy', note: `за ${price}`, active: Boolean(b.activate) });
        db.prepare('UPDATE plate_history SET price = ? WHERE plate_id = ?').run(price, id);
        return { id };
      });
    } catch (e) {
      log('buy error', e);
      return res.status(500).json({ error: 'server' });
    }
    if (result.error) return res.status(result.status).json({ error: result.error });
    if (b.activate) broadcastUser(me.id);
    if (result.seller) broadcastUser(result.seller);
    res.json({ ok: true, plate: plateView(M.plateRow(db, result.id)), coins: userRow(me.id).coins });
  });

  api.post('/plates/:id/activate', auth, (req, res) => {
    const p = ownPlate(req);
    if (!p) return res.status(404).json({ error: 'not_found' });
    if (!M.canHold(userRow(req.userId), p)) return res.status(403).json({ error: 'gold_only' });
    db.prepare('UPDATE plates SET price = NULL WHERE id = ?').run(p.id);
    M.activate(db, req.userId, p.id);
    broadcastUser(req.userId);
    res.json({ ok: true });
  });

  // Улучшить номер: рамка, неон, голограмма, платина, бриллиант
  api.post('/plates/:id/upgrade', auth, (req, res) => {
    const p = ownPlate(req);
    if (!p) return res.status(404).json({ error: 'not_found' });
    const me = userRow(req.userId);
    const full = M.upgradeCost(p);
    if (full === null) return res.status(400).json({ error: 'max_level' });
    const cost = TIER.discounted(me, full);
    if (me.coins < cost) return res.status(402).json({ error: 'no_coins' });
    tx(db, () => {
      M.addCoins(db, me.id, -cost, `улучшил(а) номер ${formatCode(p.country, p.code)} до «${LEVELS[p.level + 1].name}»`);
      db.prepare('UPDATE plates SET level = level + 1 WHERE id = ?').run(p.id);
      db.prepare("INSERT INTO plate_history (plate_id, from_id, to_id, price, kind, note, at) VALUES (?, ?, ?, ?, 'upgrade', ?, ?)").run(p.id, me.id, me.id, cost, LEVELS[p.level + 1].name, Date.now());
    });
    if (me.plate_id === p.id) broadcastUser(me.id);
    res.json({ ok: true, plate: plateView(M.plateRow(db, p.id)), coins: userRow(me.id).coins });
  });

  // Выставить на продажу (цена) или снять (price: null). Основной номер продать нельзя — сначала сделай основным другой.
  api.post('/plates/:id/list', auth, json, (req, res) => {
    const p = ownPlate(req);
    if (!p) return res.status(404).json({ error: 'not_found' });
    const price = req.body?.price;
    if (price !== null && (!Number.isInteger(price) || price < 1 || price > 1_000_000)) return res.status(400).json({ error: 'bad_price' });
    if (price !== null && userRow(req.userId).plate_id === p.id) return res.status(400).json({ error: 'active_plate' });
    db.prepare('UPDATE plates SET price = ? WHERE id = ?').run(price, p.id);
    if (price !== null) db.prepare("INSERT INTO plate_history (plate_id, from_id, to_id, price, kind, at) VALUES (?, ?, NULL, ?, 'list', ?)").run(p.id, req.userId, price, Date.now());
    res.json({ ok: true, plate: plateView(M.plateRow(db, p.id)) });
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
    // свободных (ещё не использованных) приглашений — не больше, чем позволяет уровень
    const me = userRow(req.userId);
    const open = db.prepare('SELECT COUNT(*) AS n FROM invites WHERE created_by = ? AND used_by IS NULL').get(req.userId).n;
    if (!M.isAdmin(me) && open >= TIER.perks(me).invites) return res.status(403).json({ error: 'invite_limit', limit: TIER.perks(me).invites });
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
    // Сайт АСЬКИ (правила, уровни, номера) — отдельная страница рядом с приложением
    app.get('/site', (req, res) => {
      if (!req.path.endsWith('/')) return res.redirect(301, '/site/');
      res.set('Cache-Control', 'no-cache');
      res.sendFile(path.join(staticDir, 'site', 'index.html'));
    });
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

  const wallTimer = setInterval(() => { try { wall.bestOfDay(); } catch (e) { log('wall best', e); } }, 60_000);
  wallTimer.unref?.();
  if (startBots) bots.start();
  // переход на десятую версию: нетворк считаем один раз, чат Блэк — у всех Блэк, реестр и Ночь — с первыми записями
  if (getSetting(db, 'net_counted') !== '1') { NET.recountAll(db); setSetting(db, 'net_counted', '1'); }
  for (const { id } of db.prepare("SELECT id FROM users WHERE kind = 'human' AND (tier = 'black' OR role = 'super')").all()) {
    if (!userRow(id).upass) db.prepare('UPDATE users SET upass = ? WHERE id = ?').run(TIER.upassCode(), id);
    syncBlackChat(id);
  }
  catalog.seed();
  night.start();

  async function close() {
    clearInterval(heartbeat);
    clearInterval(wallTimer);
    night.stop();
    for (const t of offlineTimers.values()) clearTimeout(t);
    await bots.stop();
    for (const ws of wss.clients) ws.terminate();
    return new Promise((resolve) => server.close(() => { db.close(); resolve(); }));
  }

  return { app, server, db, close, bots, ai, wall, night, catalog, createInvite: (by) => formatInvite(createInvite(db, by)) };
}
