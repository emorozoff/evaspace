import express from 'express';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import { openDb, tx, GENERAL_CHAT, getSetting, setSetting } from './db.js';
import { createPush, isAllowedEndpoint } from './push.js';

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const UUID_RE = /^[A-Za-z0-9-]{8,64}$/;
const BLOB_ID_RE = /^[a-f0-9]{32}$/;
const B64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

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

function cleanName(s) {
  if (typeof s !== 'string') return null;
  const t = s.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return t.length >= 1 && t.length <= 40 ? t : null;
}

export function createApp({ dataDir, staticDir, publicUrl, pushSender, trustProxy = false, log = console.log }) {
  const db = openDb(dataDir);
  const blobDir = path.join(dataDir, 'blobs');
  fs.mkdirSync(blobDir, { recursive: true });
  const push = createPush({ db, publicUrl, sender: pushSender, log });

  let serverSecret = getSetting(db, 'secret');
  if (!serverSecret) {
    serverSecret = crypto.randomBytes(32).toString('hex');
    setSetting(db, 'secret', serverSecret);
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

  function auth(req, res, next) {
    const h = req.get('authorization') || '';
    const s = sessionByToken(h.startsWith('Bearer ') ? h.slice(7) : null);
    if (!s) return res.status(401).json({ error: 'unauthorized' });
    req.userId = s.user_id;
    req.sessionHash = s.token_hash;
    next();
  }

  const publicUser = (u) => ({ id: u.id, username: u.username, displayName: u.display_name, boxPk: u.box_pk });

  function chatView(chatId) {
    const chat = db.prepare('SELECT id, kind, title FROM chats WHERE id = ?').get(chatId);
    if (!chat) return null;
    const members = db.prepare('SELECT user_id AS userId, read_up_to AS readUpTo FROM chat_members WHERE chat_id = ? ORDER BY user_id').all(chatId);
    const last = db.prepare('SELECT MAX(id) AS id FROM messages WHERE chat_id = ?').get(chatId);
    return { id: chat.id, kind: chat.kind, title: chat.title, members: members.map((m) => ({ ...m })), lastId: last?.id || 0 };
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

  // ---------- живые соединения ----------

  const conns = new Map(); // userId -> Set<ws>

  function sendTo(userId, obj) {
    const set = conns.get(userId);
    if (!set) return;
    const data = JSON.stringify(obj);
    for (const ws of set) if (ws.readyState === 1) ws.send(data);
  }
  const sendToAll = (obj) => { for (const id of conns.keys()) sendTo(id, obj); };

  // «В сети» — у человека открыто приложение. После закрытия ждём немного: телефон мог просто переподключиться.
  const offlineTimers = new Map(); // userId -> timer
  const OFFLINE_DELAY = 8000;
  const onlineIds = () => [...new Set([...conns.keys(), ...offlineTimers.keys()])];
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
    res.json({ ok: true, invitedBy: row.by || null });
  });

  api.post('/register', json, (req, res) => {
    if (!allow(`reg:${req.ip}`, 20, 600_000)) return res.status(429).json({ error: 'too_many' });
    const { invite, username, displayName, boxPk, kdfSalt, authKey, backup } = req.body || {};
    const name = cleanName(displayName);
    const uname = typeof username === 'string' ? username.trim().toLowerCase() : '';
    if (!USERNAME_RE.test(uname)) return res.status(400).json({ error: 'bad_username' });
    if (!name) return res.status(400).json({ error: 'bad_name' });
    if (!b64Bytes(boxPk, 32) || !b64Bytes(kdfSalt, 16) || !b64Bytes(authKey, 32)
      || !backup || !b64Bytes(backup.n, 24) || !b64Bytes(backup.c, undefined, 400)) {
      return res.status(400).json({ error: 'bad_keys' });
    }
    const code = normalizeInvite(invite);
    let result;
    try {
      result = tx(db, () => {
        const inv = db.prepare('SELECT used_by FROM invites WHERE code = ?').get(code);
        if (!inv || inv.used_by) return { error: 'invite_invalid', status: 404 };
        if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(uname)) return { error: 'username_taken', status: 409 };
        const now = Date.now();
        const { lastInsertRowid } = db.prepare(`
          INSERT INTO users (username, display_name, box_pk, kdf_salt, auth_hash, backup_n, backup_c, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(uname, name, boxPk, kdfSalt, sha256hex(Buffer.from(authKey, 'base64')), backup.n, backup.c, now);
        const userId = Number(lastInsertRowid);
        db.prepare('UPDATE invites SET used_by = ?, used_at = ? WHERE code = ?').run(userId, now, code);
        const maxId = db.prepare('SELECT MAX(id) AS id FROM messages').get().id || 0;
        db.prepare('INSERT INTO chat_members (chat_id, user_id, read_up_to) VALUES (?, ?, ?)').run(GENERAL_CHAT, userId, maxId);
        return { userId, token: createSession(userId) };
      });
    } catch (e) {
      log('register error', e);
      return res.status(500).json({ error: 'server' });
    }
    if (result.error) return res.status(result.status).json({ error: result.error });
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.userId);
    sendToAll({ type: 'user', user: publicUser(user) });
    const general = chatView(GENERAL_CHAT);
    for (const id of memberIds(GENERAL_CHAT)) sendTo(id, { type: 'chat', chat: general });
    log(`registered ${uname}`);
    res.json({ token: result.token, userId: result.userId });
  });

  // Соль для пароля. Для несуществующего имени отдаём выдуманную, чтобы нельзя было перебирать имена.
  api.get('/salt', (req, res) => {
    if (!allow(`salt:${req.ip}`, 60, 600_000)) return res.status(429).json({ error: 'too_many' });
    const uname = String(req.query.username || '').trim().toLowerCase();
    const row = USERNAME_RE.test(uname) && db.prepare('SELECT kdf_salt FROM users WHERE username = ?').get(uname);
    const salt = row ? row.kdf_salt
      : crypto.createHmac('sha256', serverSecret).update(`salt:${uname}`).digest().subarray(0, 16).toString('base64');
    res.json({ salt });
  });

  api.post('/login', json, (req, res) => {
    const { username, authKey } = req.body || {};
    const uname = typeof username === 'string' ? username.trim().toLowerCase() : '';
    if (!allow(`login:${req.ip}`, 20, 600_000) || !allow(`login:${uname}`, 10, 600_000)) {
      return res.status(429).json({ error: 'too_many' });
    }
    const user = USERNAME_RE.test(uname) && db.prepare('SELECT * FROM users WHERE username = ?').get(uname);
    if (!user || !b64Bytes(authKey, 32)) return res.status(401).json({ error: 'bad_login' });
    const given = Buffer.from(sha256hex(Buffer.from(authKey, 'base64')), 'hex');
    const stored = Buffer.from(user.auth_hash, 'hex');
    if (!crypto.timingSafeEqual(given, stored)) return res.status(401).json({ error: 'bad_login' });
    res.json({ token: createSession(user.id), userId: user.id, boxPk: user.box_pk, backup: { n: user.backup_n, c: user.backup_c } });
  });

  api.delete('/session', auth, (req, res) => {
    db.prepare('DELETE FROM push_subs WHERE session_hash = ?').run(req.sessionHash);
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(req.sessionHash);
    res.json({ ok: true });
  });

  api.get('/state', auth, (req, res) => {
    const users = db.prepare('SELECT * FROM users ORDER BY id').all().map(publicUser);
    const chats = db.prepare('SELECT chat_id FROM chat_members WHERE user_id = ?').all(req.userId)
      .map((r) => chatView(r.chat_id));
    res.json({ me: req.userId, users, chats, vapidPublicKey: push.publicKey, badge: unreadCount(req.userId), online: onlineIds() });
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

    const createdAt = Date.now();
    const id = tx(db, () => {
      const { lastInsertRowid } = db.prepare('INSERT INTO messages (chat_id, sender_id, uuid, created_at) VALUES (?, ?, ?, ?)')
        .run(chatId, req.userId, uuid, createdAt);
      const msgId = Number(lastInsertRowid);
      const ins = db.prepare('INSERT INTO message_boxes (message_id, recipient_id, nonce, ct) VALUES (?, ?, ?, ?)');
      for (const b of byRecipient.values()) ins.run(msgId, b.to, b.n, b.c);
      db.prepare('UPDATE chat_members SET read_up_to = ? WHERE chat_id = ? AND user_id = ?').run(msgId, chatId, req.userId);
      return msgId;
    });
    res.json({ id, createdAt });

    for (const b of byRecipient.values()) {
      sendTo(b.to, { type: 'msg', m: { id, chatId, senderId: req.userId, uuid, createdAt, n: b.n, c: b.c } });
    }
    for (const memberId of members) sendTo(memberId, { type: 'read', chatId, userId: req.userId, upTo: id });

    for (const b of byRecipient.values()) {
      if (b.to === req.userId || isVisible(b.to)) continue;
      const data = { t: 'm', c: chatId, s: req.userId, i: id, b: unreadCount(b.to) };
      if (b.pn) { data.pn = b.pn; data.pc = b.pc; }
      push.notify(b.to, data).catch((e) => log('push notify failed', e));
    }
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
    if (!Number.isInteger(other) || other === req.userId || !db.prepare('SELECT 1 FROM users WHERE id = ?').get(other)) {
      return res.status(400).json({ error: 'bad_user' });
    }
    const [a, b] = [req.userId, other].sort((x, y) => x - y);
    const chatId = `dm:${a}:${b}`;
    const created = tx(db, () => {
      const { changes } = db.prepare("INSERT OR IGNORE INTO chats (id, kind, title, created_at) VALUES (?, 'dm', NULL, ?)").run(chatId, Date.now());
      if (changes) {
        const ins = db.prepare('INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)');
        ins.run(chatId, a);
        ins.run(chatId, b);
      }
      return changes > 0;
    });
    const chat = chatView(chatId);
    if (created) for (const id of [a, b]) sendTo(id, { type: 'chat', chat });
    res.json({ chat });
  });

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
      ws.on('pong', () => { ws.isAlive = true; });
      ws.on('message', (raw) => {
        let msg;
        try { msg = JSON.parse(raw.toString()); } catch { return; }
        if (msg.type === 'visible') ws.visible = !!msg.value;
        else if (msg.type === 'ping') ws.send('{"type":"pong"}');
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

  function close() {
    clearInterval(heartbeat);
    for (const t of offlineTimers.values()) clearTimeout(t);
    for (const ws of wss.clients) ws.terminate();
    return new Promise((resolve) => server.close(() => { db.close(); resolve(); }));
  }

  return { app, server, db, close, createInvite: (by) => formatInvite(createInvite(db, by)) };
}
