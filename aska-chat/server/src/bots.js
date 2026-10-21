// Боты АСЬКИ: Аська (живой аватар мессенджера), ИИ-люди (играют обычных людей в игре «Кто здесь ИИ?»)
// и личные ИИ каждого человека. Боты — обычные участники чатов: читают свою зашифрованную копию
// сообщения и отвечают так же, как люди. Все отложенные дела лежат в таблице bot_jobs и переживают перезапуск.
import crypto from 'node:crypto';
import { newKeys, decodeIncoming } from './seal.js';
import { getSetting, setSetting } from './db.js';
import { freePlate, ASKA_PLATE, formatPlate } from './plates.js';
import * as P from './personas.js';

const ANNOUNCE = '2026-10-21-v2';
const MSK = 3 * 3_600_000;
const SLOT = 15 * 60_000;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pad = (n) => String(n).padStart(2, '0');
const msk = (t) => new Date(t + MSK);
const mskHour = (t) => msk(t).getUTCHours();
const mskDay = (t) => msk(t).toISOString().slice(0, 10);
const hhmm = (t) => { const d = msk(t); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; };
const short = (s, n = 80) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n)}…` : t; };
const norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е');

export function createBots(ctx) {
  const { db, ai, log = console.log } = ctx;
  const timing = ctx.timing || {};
  const scale = timing.scale ?? 1;
  const T = (ms) => Math.max(0, Math.round(ms * scale));
  const sleep = (ms) => new Promise((r) => setTimeout(r, T(ms)));
  const now = () => Date.now();

  // ---------- люди и боты ----------

  const row = (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  const isBot = (u) => Boolean(u) && u.kind !== 'human';
  const humans = () => db.prepare("SELECT * FROM users WHERE kind = 'human' ORDER BY id").all();
  const persons = () => db.prepare("SELECT * FROM users WHERE kind = 'person' ORDER BY id").all();
  const askaId = () => db.prepare("SELECT id FROM users WHERE kind = 'aska'").get()?.id;
  const twinOf = (ownerId) => db.prepare("SELECT * FROM users WHERE kind = 'twin' AND owner_id = ?").get(ownerId);
  const personaOf = (u) => (u?.persona ? JSON.parse(u.persona) : null);
  const getChat = (id) => db.prepare('SELECT * FROM chats WHERE id = ?').get(id);
  const memberIds = (chatId) => ctx.memberIds(chatId);
  const peopleEnabled = () => getSetting(db, 'people') === '1';
  const peopleOn = () => peopleEnabled() && ai.available();

  function createBot({ kind, username, displayName, plate, about, city, ownerId, persona }) {
    const keys = newKeys();
    const junk = () => crypto.randomBytes(24).toString('base64');
    let uname = username;
    for (let i = 2; db.prepare('SELECT 1 FROM users WHERE username = ?').get(uname); i++) uname = `${username.slice(0, 16)}_${i}`;
    const { lastInsertRowid } = db.prepare(`
      INSERT INTO users (username, display_name, box_pk, kdf_salt, auth_hash, backup_n, backup_c, created_at,
        kind, owner_id, plate, about, city, bot_sk, persona)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(uname, displayName, keys.pk, junk(), crypto.randomBytes(32).toString('hex'), junk(), junk(), now(),
      kind, ownerId ?? null, plate ?? null, about ?? null, city ?? null, keys.sk, persona ? JSON.stringify(persona) : null);
    return Number(lastInsertRowid);
  }

  function ensureAska() {
    const id = askaId();
    if (id) return id;
    const plate = db.prepare('SELECT 1 FROM users WHERE plate = ?').get(ASKA_PLATE) ? null : ASKA_PLATE;
    return createBot({ kind: 'aska', username: 'aska', displayName: 'Аська', plate, about: 'душа АСЬКИ 🌼 спроси меня о чём угодно' });
  }

  const twinName = (name) => `ИИ · ${name}`;
  function ensureTwin(ownerId) {
    const owner = row(ownerId);
    if (!owner || (owner.kind !== 'human' && owner.kind !== 'person')) return null;
    const t = twinOf(ownerId);
    if (t) return t.id;
    return createBot({ kind: 'twin', username: `twin_${ownerId}`, displayName: twinName(owner.display_name), ownerId, about: `личный ИИ · ${owner.display_name}` });
  }

  function addMember(chatId, userId) {
    const maxId = db.prepare('SELECT MAX(id) AS id FROM messages WHERE chat_id = ?').get(chatId)?.id || 0;
    return db.prepare('INSERT OR IGNORE INTO chat_members (chat_id, user_id, read_up_to) VALUES (?, ?, ?)').run(chatId, userId, maxId).changes > 0;
  }

  function seedCircles() {
    for (const c of P.CIRCLES) {
      db.prepare("INSERT OR IGNORE INTO chats (id, kind, title, emoji, about, is_public, created_at) VALUES (?, 'circle', ?, ?, ?, 1, ?)")
        .run(c.id, c.title, c.emoji, c.about, now());
    }
    const aska = askaId();
    if (aska) addMember('circle:q', aska);
  }

  // ---------- ключи и чтение ----------

  const skCache = new Map();
  function skOf(botId) {
    let sk = skCache.get(botId);
    if (!sk) { sk = row(botId)?.bot_sk; if (sk) skCache.set(botId, sk); }
    return sk;
  }
  function pksOf(userId) {
    const u = row(userId);
    if (!u) return [];
    return [u.box_pk, ...JSON.parse(u.prev_pks || '[]')];
  }

  const HIST_SQL = `
    SELECT m.id, m.chat_id AS chatId, m.sender_id AS senderId, m.uuid, m.created_at AS createdAt, b.nonce AS n, b.ct AS c
    FROM messages m JOIN message_boxes b ON b.message_id = m.id AND b.recipient_id = ?
    WHERE m.chat_id = ? ORDER BY m.id DESC LIMIT ?`;

  function history(botId, chatId, limit = 30) {
    const sk = skOf(botId);
    return db.prepare(HIST_SQL).all(botId, chatId, limit).reverse()
      .map((r) => ({ id: r.id, senderId: r.senderId, createdAt: r.createdAt, body: decodeIncoming(r, pksOf(r.senderId), sk) }));
  }

  function peek(botId, msgId) {
    const r = db.prepare(`
      SELECT m.id, m.chat_id AS chatId, m.sender_id AS senderId, m.uuid, b.nonce AS n, b.ct AS c
      FROM messages m JOIN message_boxes b ON b.message_id = m.id AND b.recipient_id = ? WHERE m.id = ?`).get(botId, msgId);
    return r ? decodeIncoming(r, pksOf(r.senderId), skOf(botId)) : null;
  }

  function textOf(body) {
    if (!body) return '(не удалось прочитать)';
    let t = body.text ? String(body.text).slice(0, 1500) : '';
    if (body.kind === 'image') t = `[фото]${t ? ` ${t}` : ''}`;
    if (body.act === 'compliment') t = `[просит передать хозяину комплимент] ${t}`;
    if (body.act === 'question') t = `[вопрос хозяину] ${t}`;
    if (body.act === 'gift') t = `[дарит хозяину ${(P.GIFTS[body.gift] || P.GIFTS.flowers).name}] ${t}`;
    return t;
  }

  function transcript(hist, botId, nameOf) {
    return hist.map((m) => `[${hhmm(m.createdAt)}] ${m.senderId === botId ? 'Ты' : nameOf(m.senderId)}: ${textOf(m.body)}`).join('\n');
  }

  // ---------- присутствие ----------

  const forced = new Map(); // botId → «в сети» до
  const keepOnline = (id) => forced.set(id, now() + 12 * 60_000);

  function slotOnline(per, t) {
    if (timing.alwaysOnline) return true;
    const local = new Date(t + MSK + (per.tz || 0) * HOUR);
    const h = local.getUTCHours() + local.getUTCMinutes() / 60;
    const awake = per.sleep > 24 ? (h >= per.wake || h < per.sleep - 24) : (h >= per.wake && h < per.sleep);
    if (!awake) return false;
    const x = crypto.createHash('sha256').update(`${per.key}:${Math.floor(t / SLOT)}`).digest()[0] / 255;
    return x < (per.activity || 0.4) + (h >= 19 && h < 23 ? 0.15 : 0);
  }

  function isOnline(u) {
    if (!u) return false;
    if (u.kind === 'aska') return true;
    if (u.kind === 'twin') return true;
    if (u.kind !== 'person' || !peopleOn()) return false;
    if ((forced.get(u.id) || 0) > now()) return true;
    return slotOnline(personaOf(u), now());
  }

  function nextOnline(u, from = now()) {
    const per = personaOf(u);
    if (!per) return from;
    if (slotOnline(per, from)) return from;
    for (let t = from - (from % SLOT) + SLOT; t < from + 36 * HOUR; t += SLOT) if (slotOnline(per, t)) return t;
    return from + HOUR;
  }

  const shown = new Map(); // botId → что сейчас показано людям
  function presenceTick() {
    for (const u of persons()) {
      const on = isOnline(u);
      if (shown.get(u.id) !== on) {
        shown.set(u.id, on);
        ctx.presence(u.id, on);
      }
    }
  }

  function onlineIds() {
    const ids = [];
    for (const u of db.prepare("SELECT * FROM users WHERE kind != 'human'").all()) if (isOnline(u)) ids.push(u.id);
    return ids;
  }

  // ---------- действия бота ----------

  function sendTyping(botId, chatId) {
    for (const id of memberIds(chatId)) if (id !== botId) ctx.sendTo(id, { type: 'typing', chatId, userId: botId });
  }

  function markRead(botId, chatId) {
    const maxId = db.prepare('SELECT MAX(id) AS id FROM messages WHERE chat_id = ?').get(chatId)?.id || 0;
    const { changes } = db.prepare('UPDATE chat_members SET read_up_to = ? WHERE chat_id = ? AND user_id = ? AND read_up_to < ?').run(maxId, chatId, botId, maxId);
    if (changes) for (const id of memberIds(chatId)) ctx.sendTo(id, { type: 'read', chatId, userId: botId, upTo: maxId });
  }

  const typingMs = (u, text) => (u.kind === 'person'
    ? Math.min(9000, Math.max(1500, text.length * 55))
    : Math.min(2500, Math.max(600, text.length * 15)));

  function cleanOut(t, u) {
    let s = String(t || '').replace(/\r/g, '').trim();
    // модель иногда подписывает реплику своим именем — убираем
    const first = norm(u.display_name).split(/\s+/)[0];
    s = s.replace(/^(ты|я)\s*:\s*/i, '');
    if (first && norm(s).startsWith(`${first}:`)) s = s.slice(first.length + 1).trim();
    return s.slice(0, 1500);
  }

  async function say(botId, chatId, texts, { typing = true, reply } = {}) {
    const u = row(botId);
    if (!u) return [];
    const list = (Array.isArray(texts) ? texts : [texts]).map((t) => cleanOut(t, u)).filter(Boolean).slice(0, 3);
    const ids = [];
    for (let i = 0; i < list.length; i++) {
      if (!memberIds(chatId).includes(botId)) break;
      if (typing) {
        let left = typingMs(u, list[i]);
        while (left > 0) {
          sendTyping(botId, chatId);
          const step = Math.min(left, 4000);
          await sleep(step);
          left -= step;
        }
      }
      const body = { kind: 'text', text: list[i] };
      if (reply && i === 0) body.reply = reply;
      const r = ctx.post(botId, chatId, body);
      if (r) ids.push(r.id);
      if (u.kind === 'person') keepOnline(botId);
      if (i < list.length - 1) await sleep(rand(500, 1600));
    }
    return ids;
  }

  // ---------- дела (jobs) ----------

  function schedule(kind, botId, chatId, dueAt, payload, mode = 'keep') {
    if (mode === 'replace') db.prepare('DELETE FROM bot_jobs WHERE kind = ? AND bot_id = ? AND chat_id = ?').run(kind, botId, chatId || '');
    db.prepare('INSERT OR IGNORE INTO bot_jobs (due_at, kind, bot_id, chat_id, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(Math.round(dueAt), kind, botId, chatId || '', payload ? JSON.stringify(payload) : null, now());
  }

  const running = new Set();
  const inflight = new Set();
  let ticking = false;
  function tick() {
    if (ticking) return;
    ticking = true;
    try {
      const due = db.prepare('SELECT * FROM bot_jobs WHERE due_at <= ? ORDER BY due_at LIMIT 20').all(now());
      for (const j of due) {
        const key = `${j.bot_id}|${j.chat_id}`;
        if (running.has(key)) {
          db.prepare('UPDATE bot_jobs SET due_at = ? WHERE id = ?').run(now() + Math.max(50, T(2000)), j.id);
          continue;
        }
        db.prepare('DELETE FROM bot_jobs WHERE id = ?').run(j.id);
        running.add(key);
        const p = runJob(j).catch((e) => log('bot job error', j.kind, e)).finally(() => { running.delete(key); inflight.delete(p); });
        inflight.add(p);
      }
    } finally {
      ticking = false;
    }
  }

  async function runJob(j) {
    const payload = j.payload ? JSON.parse(j.payload) : {};
    switch (j.kind) {
      case 'reply': return replyJob(j.bot_id, j.chat_id);
      case 'announce': return announceJob(j.bot_id, j.chat_id, payload);
      case 'welcome': return welcomeJob(j.bot_id, j.chat_id, payload);
      case 'recovered': return say(j.bot_id, j.chat_id, [`С возвращением! 🌼 Вход восстановлен.`, 'Старые сообщения на этом телефоне не откроются — так работает шифрование. Зато новые придут как обычно.']);
      case 'people': return peopleJob(j.bot_id, j.chat_id);
      case 'qday': return say(j.bot_id, j.chat_id, [`❓ Вопрос дня: ${payload.q}`], { typing: false });
      case 'nudge': return nudgeJob(j.bot_id, j.chat_id, payload);
      case 'opener': return openerJob(j.bot_id, j.chat_id);
      case 'hello': return helloJob(j.bot_id, payload);
      case 'thank': return thankJob(j.bot_id, payload);
      case 'person_answer': return personAnswerJob(j.bot_id, payload);
      default: return null;
    }
  }

  // ---------- что пришло ----------

  function mentions(text, u) {
    const per = personaOf(u);
    if (!per?.mention || !text) return false;
    const re = new RegExp(`^(${per.mention})[а-я]{0,3}$`);
    return norm(text).split(/[^а-я]+/).some((w) => w && re.test(w));
  }

  function botStreak(chatId) {
    const rows = db.prepare('SELECT u.kind FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.chat_id = ? ORDER BY m.id DESC LIMIT 4').all(chatId);
    let n = 0;
    for (const r of rows) { if (r.kind === 'human') break; n++; }
    return n;
  }

  function replyDue(u, inCircle) {
    if (u.kind !== 'person') return now() + T(rand(1200, 3500));
    if (isOnline(u)) return now() + T(inCircle ? rand(8000, 70000) : rand(4000, 35000));
    const at = nextOnline(u);
    if (inCircle && at - now() > 2 * HOUR) return null;
    return at + T(rand(20000, 120000));
  }

  function onMessage({ chatId, msgId, senderId }) {
    const sender = row(senderId);
    const chat = getChat(chatId);
    if (!sender || !chat) return;
    const bots = memberIds(chatId).filter((id) => id !== senderId).map(row).filter(isBot);
    if (!bots.length) return;

    if (chat.kind === 'dm' || chat.kind === 'twin') {
      if (isBot(sender)) return; // боты между собой в личке не болтают
      const b = bots[0];
      db.prepare('UPDATE bot_reach SET unanswered = 0 WHERE bot_id = ? AND user_id = ?').run(b.id, senderId);
      if (b.kind === 'person' && !peopleOn()) return;
      const due = replyDue(b, false);
      if (due) schedule('reply', b.id, chatId, due);
      return;
    }

    if (chat.kind !== 'circle') return;
    const people = peopleOn() ? bots.filter((b) => b.kind === 'person') : [];
    if (!isBot(sender)) {
      const text = peek(bots[0].id, msgId)?.text || '';
      let chosen = people.filter((p) => mentions(text, p));
      if (!chosen.length && people.length && Math.random() < (timing.circleChance ?? 0.75)) {
        const on = people.filter(isOnline);
        const pool = on.length ? on : people;
        chosen = [pick(pool)];
        if (pool.length > 1 && Math.random() < 0.3) chosen.push(pick(pool.filter((p) => p !== chosen[0])));
      }
      for (const p of chosen) {
        const due = replyDue(p, true);
        if (due) schedule('reply', p.id, chatId, due);
      }
      const aska = bots.find((b) => b.kind === 'aska');
      if (aska && ai.available() && Math.random() < 0.5) schedule('reply', aska.id, chatId, now() + T(rand(5000, 30000)));
    } else if (sender.kind === 'person' && people.length) {
      // ИИ-люди иногда отвечают друг другу, но не больше двух реплик подряд без живых
      if (botStreak(chatId) >= 2 || Math.random() > (timing.chainChance ?? 0.3)) return;
      const others = people.filter((p) => p.id !== senderId && isOnline(p));
      if (others.length) schedule('reply', pick(others).id, chatId, now() + T(rand(20000, 120000)));
    }
  }

  async function replyJob(botId, chatId) {
    const bot = row(botId);
    const chat = getChat(chatId);
    if (!bot || !chat || !memberIds(chatId).includes(botId)) return;
    if (bot.kind === 'person' && !peopleOn()) return;
    const hist = history(botId, chatId, 30);
    const last = hist[hist.length - 1];
    if (!last || last.senderId === botId) return;
    markRead(botId, chatId);
    let lastMine = -1;
    for (let i = hist.length - 1; i >= 0; i--) if (hist[i].senderId === botId) { lastMine = i; break; }
    const fresh = hist.slice(lastMine + 1).filter((m) => m.senderId !== botId);
    if (bot.kind === 'aska') return askaReply(bot, chat, hist, fresh);
    if (bot.kind === 'twin') return chat.kind === 'twin' ? twinFriendReply(bot, chat, hist, fresh) : twinOwnerReply(bot, chat, hist, fresh);
    if (bot.kind === 'person') return personReply(bot, chat, hist);
  }

  // ---------- заметки ----------

  function notesOf(botId, userId) {
    return db.prepare('SELECT notes FROM bot_notes WHERE bot_id = ? AND user_id = ?').get(botId, userId)?.notes || '';
  }
  function addNote(botId, userId, note) {
    const n = short(note, 200);
    if (!n) return;
    const old = notesOf(botId, userId);
    if (old.includes(n)) return;
    const all = (old ? `${old}; ${n}` : n).slice(-1500);
    db.prepare(`INSERT INTO bot_notes (bot_id, user_id, notes, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(bot_id, user_id) DO UPDATE SET notes = excluded.notes, updated_at = excluded.updated_at`).run(botId, userId, all, now());
  }

  function timeLine(tz = 0) {
    const t = now();
    const d = msk(t);
    const local = new Date(t + MSK + tz * HOUR);
    const own = tz ? ` (у тебя ${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())})` : '';
    return `Сейчас ${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${hhmm(t)} по Москве${own}.`;
  }

  function describe(u) {
    if (!u) return 'неизвестно';
    const bits = [`имя «${u.display_name}»`];
    if (u.city) bits.push(`город ${u.city}`);
    if (u.about) bits.push(`о себе: «${short(u.about, 140)}»`);
    return bits.join(', ');
  }

  const nameOf = (id) => row(id)?.display_name || '?';
  const outMessages = (out) => (Array.isArray(out?.messages) ? out.messages.filter((m) => typeof m === 'string') : []);

  // ---------- ИИ-люди ----------

  async function personReply(bot, chat, hist) {
    const per = personaOf(bot);
    const isDm = chat.kind === 'dm';
    const last = hist[hist.length - 1];
    const otherId = isDm ? memberIds(chat.id).find((id) => id !== bot.id) : last.senderId;
    const other = row(otherId);
    const guessed = db.prepare("SELECT 1 FROM guesses WHERE guesser_id = ? AND target_id = ? AND guess = 'ai'").get(otherId, bot.id);
    const where = isDm
      ? `Личная переписка с ${describe(other)}.`
      : `Общий круг «${chat.emoji || ''} ${chat.title}» (${chat.about || ''}). Участники: ${memberIds(chat.id).filter((id) => id !== bot.id).map(nameOf).join(', ')}.`;
    const prompt = [
      timeLine(per.tz),
      where,
      !isDm && `Последнее сообщение — от ${describe(other)}.`,
      notesOf(bot.id, otherId) && `Твои заметки о «${other.display_name}»: ${notesOf(bot.id, otherId)}`,
      guessed && `«${other.display_name}» уже угадал(а), что ты ИИ: можешь этого не скрывать, но оставайся собой.`,
      'Переписка (старые сверху):',
      transcript(hist.slice(-24), bot.id, nameOf),
      isDm ? 'Ответь на последние сообщения.' : 'Ответь, только если тебе правда есть что сказать — не обязательно отвечать на всё. Можно обратиться к кому-то по имени.',
      'В поле note — что нового стоит запомнить о собеседнике (коротко), или пустая строка.',
    ].filter(Boolean).join('\n');
    const system = `${P.PERSON_RULES}\n\nКто ты:\n${per.card}\nИмя в АСЬКЕ: «${bot.display_name}», номер ${formatPlate(bot.plate)}.\nКак ты пишешь: ${per.style}`;
    const out = await ai.complete({ system, prompt, schema: P.REPLY_SCHEMA });
    if (!out) return;
    if (out.note && other?.kind === 'human') addNote(bot.id, otherId, out.note);
    await say(bot.id, chat.id, outMessages(out));
  }

  async function openerJob(botId, chatId) {
    const bot = row(botId);
    const chat = getChat(chatId);
    if (!bot || !chat || !peopleOn() || !memberIds(chatId).includes(botId)) return;
    const per = personaOf(bot);
    const hist = history(botId, chatId, 12);
    const prompt = [
      timeLine(per.tz),
      `Общий круг «${chat.emoji || ''} ${chat.title}» (${chat.about || ''}). В нём давно тихо.`,
      hist.length ? `Что писали раньше:\n${transcript(hist, botId, nameOf)}` : 'Раньше тут ничего не писали.',
      'Начни разговор сам(а): поделись чем-то из своей жизни по теме круга или спроси у всех что-нибудь. Одно-два коротких сообщения.',
      'note оставь пустым.',
    ].join('\n');
    const system = `${P.PERSON_RULES}\n\nКто ты:\n${per.card}\nИмя в АСЬКЕ: «${bot.display_name}».\nКак ты пишешь: ${per.style}`;
    const out = await ai.complete({ system, prompt, schema: P.REPLY_SCHEMA });
    if (out) await say(botId, chatId, outMessages(out));
  }

  async function helloJob(botId, { userId, circleId }) {
    const bot = row(botId);
    const human = row(userId);
    const circle = getChat(circleId);
    if (!bot || !human || !peopleOn()) return;
    const chatId = ctx.ensureDm(botId, userId);
    if (db.prepare('SELECT 1 FROM messages WHERE chat_id = ?').get(chatId)) return;
    const per = personaOf(bot);
    const prompt = [
      timeLine(per.tz),
      `Ты сам(а) пишешь первым(ой) человеку: ${describe(human)}. Вы оба в круге «${circle?.emoji || ''} ${circle?.title || ''}».`,
      'Напиши короткое первое сообщение, как живой человек: зацепись за что-то из круга или просто познакомься. Без «как дела» в лоб.',
      'note оставь пустым.',
    ].join('\n');
    const system = `${P.PERSON_RULES}\n\nКто ты:\n${per.card}\nИмя в АСЬКЕ: «${bot.display_name}».\nКак ты пишешь: ${per.style}`;
    const out = await ai.complete({ system, prompt, schema: P.REPLY_SCHEMA });
    if (!out || !outMessages(out).length) return;
    await say(botId, chatId, outMessages(out));
    reach(botId, userId);
  }

  async function thankJob(botId, { userId, what }) {
    const bot = row(botId);
    const friend = row(userId);
    if (!bot || !friend || !peopleOn()) return;
    const per = personaOf(bot);
    const chatId = ctx.ensureDm(botId, userId);
    const prompt = [
      timeLine(per.tz),
      `«${friend.display_name}» через твоего личного ИИ в АСЬКЕ передал(а) тебе: ${what}.`,
      'Напиши ему(ей) в личку пару слов — как живой человек, которому приятно. Коротко.',
      'note оставь пустым.',
    ].join('\n');
    const system = `${P.PERSON_RULES}\n\nКто ты:\n${per.card}\nИмя в АСЬКЕ: «${bot.display_name}».\nКак ты пишешь: ${per.style}`;
    const out = await ai.complete({ system, prompt, schema: P.REPLY_SCHEMA });
    if (out) await say(botId, chatId, outMessages(out));
  }

  async function personAnswerJob(botId, { questionId }) {
    const q = db.prepare('SELECT * FROM twin_questions WHERE id = ? AND answered_at IS NULL').get(questionId);
    const bot = row(botId);
    if (!q || !bot || !peopleOn()) return;
    const per = personaOf(bot);
    const prompt = [
      timeLine(per.tz),
      `Тебе через личного ИИ в АСЬКЕ задали вопрос${q.anon ? ' (анонимно)' : ` («${nameOf(q.asker_id)}»)`}: «${q.question}».`,
      'Ответь коротко, как живой человек. Если вопрос слишком личный — отшутись. Одно сообщение.',
      'note оставь пустым.',
    ].join('\n');
    const system = `${P.PERSON_RULES}\n\nКто ты:\n${per.card}\nИмя в АСЬКЕ: «${bot.display_name}».\nКак ты пишешь: ${per.style}`;
    const out = await ai.complete({ system, prompt, schema: P.REPLY_SCHEMA });
    const answer = outMessages(out).join(' ');
    if (answer) await relayAnswer(q, answer);
  }

  // ---------- Аська ----------

  function askaContext(userId) {
    const u = row(userId);
    if (!u) return '';
    const circles = db.prepare("SELECT c.title FROM chat_members m JOIN chats c ON c.id = m.chat_id WHERE m.user_id = ? AND c.kind IN ('circle', 'general')").all(userId).map((r) => r.title);
    const facts = db.prepare('SELECT COUNT(*) AS n FROM twin_facts WHERE owner_id = ?').get(userId).n;
    const g = db.prepare('SELECT COUNT(*) AS n, SUM(correct) AS ok FROM guesses WHERE guesser_id = ?').get(userId);
    const friends = db.prepare("SELECT COUNT(*) AS n FROM users WHERE kind = 'human' AND id != ?").get(userId).n;
    return [
      `Собеседник: ${describe(u)}, номер АСЬКИ ${formatPlate(u.plate)}.`,
      u.phone ? 'Телефон привязан.' : 'Телефон НЕ привязан (можно предложить привязать в «Ещё» → «Мой профиль»).',
      `Круги: ${circles.join(', ') || 'пока ни в одном'}.`,
      `Его личный ИИ знает фактов: ${facts}.`,
      `Игра «Кто здесь ИИ?»: угадал(а) ${g.ok || 0} из ${g.n}.`,
      `Живых друзей в АСЬКЕ, кроме него: ${friends}.`,
      u.is_admin ? `Он администратор АСЬКИ. ${ai.configured() ? '' : 'Ключ Claude ещё не вставлен («Ещё» → «Управление АСЬКОЙ»).'}` : '',
      notesOf(askaId(), userId) && `Твои заметки о нём: ${notesOf(askaId(), userId)}`,
    ].filter(Boolean).join('\n');
  }

  async function askaReply(bot, chat, hist, fresh) {
    const last = hist[hist.length - 1];
    const isDm = chat.kind === 'dm';
    const userId = isDm ? memberIds(chat.id).find((id) => id !== bot.id) : last.senderId;
    const u = row(userId);
    const prompt = [
      timeLine(),
      isDm ? 'Личная переписка.' : `Круг «${chat.emoji || ''} ${chat.title}». Тут ты ведущая: реагируй коротко и по-доброму, не на каждое сообщение.`,
      askaContext(userId),
      'Переписка (старые сверху):',
      transcript(hist.slice(-20), bot.id, nameOf),
      isDm ? 'Ответь на последние сообщения.' : 'Ответь, если к месту, иначе — пустой список.',
      'В поле note — что нового стоит запомнить о собеседнике (коротко), или пустая строка.',
    ].join('\n');
    const out = await ai.complete({ system: P.ASKA_RULES, prompt, schema: P.REPLY_SCHEMA });
    if (out) {
      if (out.note && u?.kind === 'human') addNote(bot.id, userId, out.note);
      return say(bot.id, chat.id, outMessages(out));
    }
    if (!isDm) return; // по шпаргалке в кругах не болтаем
    const text = fresh.map((m) => m.body?.text || '').join(' ');
    return say(bot.id, chat.id, P.askaScripted(text, { name: u?.display_name, plate: formatPlate(u?.plate) }));
  }

  function reach(botId, userId) {
    db.prepare(`INSERT INTO bot_reach (bot_id, user_id, last_at, unanswered) VALUES (?, ?, ?, 1)
      ON CONFLICT(bot_id, user_id) DO UPDATE SET last_at = excluded.last_at, unanswered = unanswered + 1`).run(botId, userId, now());
  }

  async function nudgeJob(botId, chatId, { userId }) {
    const u = row(userId);
    if (!u) return;
    let texts = null;
    const out = await ai.complete({
      system: P.ASKA_RULES,
      prompt: [
        timeLine(), askaContext(userId),
        'Ты сама пишешь первой: человек давно не заглядывал. Напиши одно короткое тёплое сообщение — предложи что-то конкретное (ответить на «Вопрос дня», рассказать о себе своему ИИ, написать другу, сыграть в «Кто здесь ИИ?», заглянуть в круг). Не дави и не повторяйся.',
        'note оставь пустым.',
      ].join('\n'),
      schema: P.REPLY_SCHEMA,
    });
    if (out) texts = outMessages(out);
    if (!texts?.length) {
      const used = JSON.parse(getSetting(db, `nudges:${userId}`) || '[]');
      const left = P.ASKA_NUDGES.map((_, i) => i).filter((i) => !used.includes(i));
      const i = left.length ? pick(left) : Math.floor(Math.random() * P.ASKA_NUDGES.length);
      setSetting(db, `nudges:${userId}`, JSON.stringify(left.length ? [...used, i] : [i]));
      texts = [P.ASKA_NUDGES[i]];
    }
    await say(botId, chatId, texts);
    reach(botId, userId);
  }

  async function announceJob(botId, chatId, { userId }) {
    const u = row(userId);
    if (!u) return;
    // Одно-два сообщения, чтобы обновление не принесло пачку уведомлений
    const msgs = [
      `Привет, ${u.display_name}! Это Аська 🌼 Теперь я живая: со мной можно болтать, а если что-то непонятно — спрашивай.\n\nЧто нового в АСЬКЕ:\n🚗 Номера как у машин — твой ${formatPlate(u.plate)}\n⭕ Круги — беседы по интересам (вкладка «Круги»)\n🤖 Твой личный ИИ: друзья пишут ему открыто или анонимно, передают тебе приятное и задают вопросы\n📱 Вход по телефону и лёгкое восстановление`,
    ];
    const tips = [];
    if (!u.phone) tips.push('Привяжи телефон: «Ещё» → «Мой профиль». Тогда, если забудешь пароль, вход вернётся за минуту.');
    if (u.is_admin && !ai.configured()) tips.push('Ты администратор 👑 Чтобы я и ИИ заговорили по-настоящему, вставь ключ Claude: «Ещё» → «Управление АСЬКОЙ».');
    if (tips.length) msgs.push(tips.join('\n\n'));
    for (const m of msgs) await say(botId, chatId, [m], { typing: true });
  }

  async function welcomeJob(botId, chatId, { userId }) {
    const u = row(userId);
    if (!u) return;
    await say(botId, chatId, [
      `Привет, ${u.display_name}! Я Аська 🌼 Добро пожаловать в АСЬКУ!`,
      `Твой номер — ${formatPlate(u.plate)}. Им можно входить вместо телефона и делиться с друзьями.`,
      'Загляни в «Круги», а во вкладке «Мой ИИ» расскажи о себе своему ИИ — друзьям будет интересно с ним болтать.',
      'И заполни профиль: «Ещё» → «Изменить» — город и пару слов о себе. Так тебя быстрее узнают 😉',
    ]);
  }

  async function peopleJob(botId, chatId) {
    await say(botId, chatId, [
      'Новости! В АСЬКУ пришли новые люди 👀',
      'Среди них есть ИИ — а может, и нет 😏 Угадаешь, кто есть кто? В профиле любого человека есть кнопка «Человек или ИИ?». Новенькие сидят в кругах — заходи знакомиться!',
    ]);
  }

  // ---------- личный ИИ ----------

  function factsOf(ownerId) {
    return db.prepare('SELECT text FROM twin_facts WHERE owner_id = ? ORDER BY id DESC LIMIT 80').all(ownerId).map((r) => r.text).reverse();
  }

  function addFacts(ownerId, list, source) {
    const have = new Set(db.prepare('SELECT text FROM twin_facts WHERE owner_id = ?').all(ownerId).map((r) => norm(r.text)));
    for (const f of list || []) {
      const t = short(f, 200);
      if (t.length < 3 || have.has(norm(t))) continue;
      if (/(\d[\s-]?){6,}|парол|pin|пин-?код|cvv|карт[аы] \d/i.test(t)) continue; // номера и пароли не запоминаем
      have.add(norm(t));
      db.prepare('INSERT INTO twin_facts (owner_id, text, source, created_at) VALUES (?, ?, ?, ?)').run(ownerId, t, source, now());
    }
    db.prepare('DELETE FROM twin_facts WHERE owner_id = ? AND id NOT IN (SELECT id FROM twin_facts WHERE owner_id = ? ORDER BY id DESC LIMIT 300)').run(ownerId, ownerId);
  }

  async function toOwner(twin, owner, text) {
    if (owner.kind !== 'human') return null;
    const dm = ctx.ensureDm(twin.id, owner.id);
    const [id] = await say(twin.id, dm, [text], { typing: false });
    return id;
  }

  async function askOwner(twin, owner, chat, friendId, anon, question) {
    const from = anon ? 'Кто-то анонимно' : nameOf(friendId);
    const { lastInsertRowid } = db.prepare('INSERT INTO twin_questions (twin_id, asker_id, chat_id, anon, question, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(twin.id, friendId, chat.id, anon ? 1 : 0, short(question, 500), now());
    const qid = Number(lastInsertRowid);
    if (owner.kind === 'human') {
      const msgId = await toOwner(twin, owner, `❓ ${from} спрашивает: «${short(question, 500)}»\nОтветь на это сообщение — я передам ответ.`);
      db.prepare('UPDATE twin_questions SET owner_msg_id = ? WHERE id = ?').run(msgId || null, qid);
    } else if (owner.kind === 'person') {
      const at = isOnline(owner) ? now() + T(rand(60_000, 600_000)) : nextOnline(owner) + T(rand(60_000, 300_000));
      schedule('person_answer', owner.id, `q:${qid}`, at, { questionId: qid });
    }
  }

  async function relayAnswer(q, answer) {
    const twin = row(q.twin_id);
    const owner = twin && row(twin.owner_id);
    if (!owner || !memberIds(q.chat_id).includes(twin.id)) return false;
    db.prepare('UPDATE twin_questions SET answered_at = ? WHERE id = ?').run(now(), q.id);
    await say(twin.id, q.chat_id, [`📬 ${owner.display_name} отвечает на твой вопрос «${short(q.question, 60)}»:\n${short(answer, 1000)}`], { typing: false });
    if (owner.kind === 'human') addFacts(owner.id, [`На вопрос «${short(q.question, 80)}» ответил(а): «${short(answer, 110)}»`], 'answer');
    return true;
  }

  function notifyVisit(twin, owner, friendId) {
    const r = db.prepare('SELECT last_at FROM bot_reach WHERE bot_id = ? AND user_id = ?').get(twin.id, friendId);
    if (r && now() - r.last_at < 20 * HOUR) return;
    db.prepare(`INSERT INTO bot_reach (bot_id, user_id, last_at, unanswered) VALUES (?, ?, ?, 0)
      ON CONFLICT(bot_id, user_id) DO UPDATE SET last_at = excluded.last_at`).run(twin.id, friendId, now());
    toOwner(twin, owner, `👋 Ко мне заглянул(а) ${nameOf(friendId)} — болтаем о тебе 🙂`);
  }

  function twinScripted(owner, text) {
    const t = norm(text);
    if (/^(привет|здравств|хай|ку|добр)/.test(t)) {
      return [`Привет! Я личный ИИ · ${owner.display_name} 🤖`, `Могу передать комплимент, подарок или вопрос — ${owner.display_name} увидит. Кнопки над полем ввода 👇`];
    }
    const words = t.split(/[^а-яa-z0-9]+/).filter((w) => w.length >= 4).map((w) => w.slice(0, 5));
    const facts = factsOf(owner.id);
    const hit = facts.find((f) => words.some((w) => norm(f).includes(w)));
    if (hit) return [`Вот что я знаю: ${hit}`];
    return ['Хм, этого я пока не знаю 🤔', `Нажми «❓ Вопрос» — я спрошу, и ${owner.display_name} ответит.`];
  }

  async function twinFriendReply(twin, chat, hist, fresh) {
    const meta = JSON.parse(chat.meta || '{}');
    const anon = Boolean(meta.anon);
    const owner = row(twin.owner_id);
    if (!owner) return;
    const friendId = memberIds(chat.id).find((id) => id !== twin.id);
    const from = anon ? 'Кто-то анонимно' : nameOf(friendId);
    const acks = [];
    for (const m of fresh) {
      const b = m.body;
      if (!b?.act) continue;
      // телефон добавляет к тексту значок (💐 / ❓ / подарок) — убираем, а у подарка оставляем только слова после « — »
      let text = short(String(b.text || '').replace(/^(💐|❓)\s*/u, ''), 500);
      if (b.act === 'gift') text = text.includes(' — ') ? text.split(' — ').slice(1).join(' — ') : '';
      if (b.act === 'compliment' && text) {
        acks.push(`Передал! ${owner.display_name} обязательно увидит 💐`);
        if (owner.kind === 'human') await toOwner(twin, owner, `💐 ${from} передаёт тебе: «${text}»`);
        else if (!anon) schedule('thank', owner.id, `u:${friendId}`, nextOnline(owner) + T(rand(120_000, 900_000)), { userId: friendId, what: `комплимент «${text}»` });
      } else if (b.act === 'gift') {
        const g = P.GIFTS[b.gift] || P.GIFTS.flowers;
        acks.push(`Вручил ${g.emoji}`);
        if (owner.kind === 'human') await toOwner(twin, owner, `${g.emoji} ${from} дарит тебе ${g.name}!${text ? ` И пишет: «${text}»` : ''}`);
        else if (!anon) schedule('thank', owner.id, `u:${friendId}`, nextOnline(owner) + T(rand(120_000, 900_000)), { userId: friendId, what: `подарок — ${g.name}${text ? ` и слова «${text}»` : ''}` });
      } else if (b.act === 'question' && text) {
        acks.push(`Спросил! ${owner.display_name} ответит — и я сразу напишу сюда 📬`);
        await askOwner(twin, owner, chat, friendId, anon, text);
      }
    }
    if (!anon && owner.kind === 'human') notifyVisit(twin, owner, friendId);

    const plain = fresh.filter((m) => !m.body?.act);
    if (!plain.length) {
      if (acks.length) await say(twin.id, chat.id, [...new Set(acks)].slice(0, 2));
      return;
    }
    const facts = factsOf(owner.id);
    const card = owner.kind === 'person' ? personaOf(owner)?.card : '';
    const prompt = [
      timeLine(),
      `Твой хозяин: «${owner.display_name}»${owner.city ? `, ${owner.city}` : ''}${owner.about ? `, о себе: «${short(owner.about, 140)}»` : ''}.`,
      card ? `Что ты о нём знаешь:\n${card}` : `Что ты о нём знаешь (факты):\n${facts.length ? facts.map((f) => `- ${f}`).join('\n') : '- пока почти ничего'}`,
      anon ? 'Переписка АНОНИМНАЯ: ты не знаешь, кто пишет, и не пытаешься узнать.' : `Тебе пишет «${nameOf(friendId)}».`,
      acks.length ? `Ты уже передал хозяину: ${acks.join('; ')}.` : '',
      'Переписка (старые сверху):',
      transcript(hist.slice(-20), twin.id, (id) => (anon && id === friendId ? 'Аноним' : nameOf(id))),
      'Ответь на последние сообщения. forward и ask_owner — пустые строки, если ничего передавать не нужно.',
    ].filter(Boolean).join('\n');
    const out = await ai.complete({ system: P.TWIN_RULES, prompt, schema: P.TWIN_SCHEMA });
    if (!out) {
      await say(twin.id, chat.id, [...acks.slice(0, 1), ...twinScripted(owner, plain.map((m) => m.body?.text || '').join(' '))]);
      return;
    }
    if (out.forward) {
      if (owner.kind === 'human') await toOwner(twin, owner, `💬 ${from} просит передать: «${short(out.forward, 500)}»`);
      else if (!anon) schedule('thank', owner.id, `u:${friendId}`, nextOnline(owner) + T(rand(120_000, 900_000)), { userId: friendId, what: `слова «${short(out.forward, 300)}»` });
    }
    if (out.ask_owner) await askOwner(twin, owner, chat, friendId, anon, out.ask_owner);
    await say(twin.id, chat.id, outMessages(out));
  }

  async function twinOwnerReply(twin, chat, hist, fresh) {
    const owner = row(twin.owner_id);
    if (!owner || !memberIds(chat.id).includes(owner.id)) return;
    // Ответ на вопрос друга: «Ответить» на сообщение с вопросом или просто следующее сообщение после вопроса
    let relayed = 0;
    const lastTwinMsg = [...hist].reverse().find((m) => m.senderId === twin.id && m.id < (fresh[0]?.id || Infinity));
    for (const m of fresh) {
      if (!m.body?.text) continue;
      let q = m.body.reply ? db.prepare('SELECT * FROM twin_questions WHERE twin_id = ? AND owner_msg_id = ? AND answered_at IS NULL').get(twin.id, m.body.reply) : null;
      if (!q && !m.body.reply && lastTwinMsg) q = db.prepare('SELECT * FROM twin_questions WHERE twin_id = ? AND owner_msg_id = ? AND answered_at IS NULL').get(twin.id, lastTwinMsg.id);
      if (q && await relayAnswer(q, m.body.text)) relayed++;
    }
    if (relayed) {
      await say(twin.id, chat.id, ['Передал ответ ✅']);
      return;
    }
    const facts = factsOf(owner.id);
    const prompt = [
      timeLine(),
      `Хозяин: «${owner.display_name}»${owner.city ? `, ${owner.city}` : ''}.`,
      `Что ты о нём уже знаешь:\n${facts.length ? facts.map((f) => `- ${f}`).join('\n') : '- пока ничего'}`,
      'Переписка (старые сверху):',
      transcript(hist.slice(-20), twin.id, nameOf),
      'Ответь хозяину. В facts — новые факты о нём из последних сообщений (или пустой список).',
    ].join('\n');
    const out = await ai.complete({ system: P.TWIN_OWNER_RULES, prompt, schema: P.OWNER_SCHEMA });
    if (out) {
      addFacts(owner.id, Array.isArray(out.facts) ? out.facts : [], 'chat');
      await say(twin.id, chat.id, outMessages(out));
      return;
    }
    // по шпаргалке: запоминаем рассказ и задаём следующий вопрос
    const text = fresh.map((m) => m.body?.text || '').join(' ').trim();
    const statement = text && !/\?\s*$/.test(text) && text.split(/\s+/).length >= 2;
    if (statement) addFacts(owner.id, [text], 'chat');
    const asked = Number(notesOf(twin.id, owner.id) || 0);
    const next = P.TWIN_TRAINING[asked % P.TWIN_TRAINING.length];
    db.prepare(`INSERT INTO bot_notes (bot_id, user_id, notes, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(bot_id, user_id) DO UPDATE SET notes = excluded.notes, updated_at = excluded.updated_at`).run(twin.id, owner.id, String(asked + 1), now());
    await say(twin.id, chat.id, statement
      ? ['Запомнил ✍️', next]
      : ['Я твой личный ИИ 🤖 Друзья пишут мне, а я передаю тебе приятное и вопросы. Расскажи о себе — так я буду отвечать лучше.', next]);
  }

  // ---------- сам пишет первым ----------

  let lastProactive = 0;
  function proactive(force = false) {
    const t = now();
    if (!force && t - lastProactive < 4 * 60_000) return;
    lastProactive = t;
    const h = mskHour(t);
    const day = mskDay(t);
    const aska = askaId();
    // Вопрос дня
    if ((h >= 11 || force) && getSetting(db, 'qday') !== day && memberIds('circle:q').includes(aska)) {
      setSetting(db, 'qday', day);
      const idx = Math.floor(t / DAY) % P.QUESTIONS_OF_DAY.length;
      schedule('qday', aska, 'circle:q', now(), { q: P.QUESTIONS_OF_DAY[idx] });
    }
    // Аська заглядывает к тем, кто давно не писал (не чаще раза в сутки, без навязчивости)
    if ((h >= 12 && h < 21) || force) {
      for (const u of humans()) {
        if (u.last_active && t - u.last_active > 14 * DAY) continue;
        const dm = `dm:${Math.min(aska, u.id)}:${Math.max(aska, u.id)}`;
        if (!getChat(dm)) continue;
        const lastAska = db.prepare('SELECT MAX(created_at) AS t FROM messages WHERE chat_id = ? AND sender_id = ?').get(dm, aska).t || 0;
        const lastUser = db.prepare('SELECT MAX(created_at) AS t FROM messages WHERE chat_id = ? AND sender_id = ?').get(dm, u.id).t || 0;
        if (t - lastAska < 24 * HOUR || t - lastUser < 20 * HOUR) continue;
        if (u.last_active && t - u.last_active < 3 * HOUR) continue; // и так в приложении
        const r = db.prepare('SELECT * FROM bot_reach WHERE bot_id = ? AND user_id = ?').get(aska, u.id);
        if (r && r.unanswered >= 2 && t - r.last_at < 72 * HOUR) continue;
        if (!force && Math.random() > 0.3) continue;
        schedule('nudge', aska, dm, now() + T(rand(0, 60_000)), { userId: u.id });
        break;
      }
    }
    if (!peopleOn() || (!force && (h < 10 || h >= 23))) return;
    // В тихом круге кто-то из ИИ-людей заводит разговор (не чаще двух раз в день на круг)
    for (const c of db.prepare("SELECT * FROM chats WHERE kind = 'circle'").all()) {
      const ppl = memberIds(c.id).map(row).filter((u) => u?.kind === 'person' && isOnline(u));
      if (!ppl.length) continue;
      const lastAt = db.prepare('SELECT MAX(created_at) AS t FROM messages WHERE chat_id = ?').get(c.id).t || 0;
      const key = `spont:${c.id}:${day}`;
      const count = Number(getSetting(db, key) || 0);
      if (t - lastAt < 4 * HOUR || count >= 2) continue;
      if (!force && Math.random() > 0.25) continue;
      setSetting(db, key, String(count + 1));
      schedule('opener', pick(ppl).id, c.id, now() + T(rand(0, 120_000)));
      break;
    }
    // ИИ-человек сам знакомится с кем-то из своего круга (каждому человеку — не чаще раза в день)
    if (force || Math.random() < 0.25) {
      for (const p of persons().filter(isOnline).sort(() => Math.random() - 0.5)) {
        if (getSetting(db, `hello:${p.id}`) === day) continue;
        const circles = db.prepare("SELECT m.chat_id FROM chat_members m JOIN chats c ON c.id = m.chat_id WHERE m.user_id = ? AND c.kind = 'circle'").all(p.id).map((r) => r.chat_id);
        for (const cid of circles) {
          const target = memberIds(cid).map(row).find((u) => u?.kind === 'human'
            && (!u.last_active || t - u.last_active < 3 * DAY)
            && getSetting(db, `greeted:${u.id}`) !== day
            && !getChat(`dm:${Math.min(p.id, u.id)}:${Math.max(p.id, u.id)}`)
            && db.prepare('SELECT 1 FROM messages WHERE chat_id = ? AND sender_id = ?').get(cid, u.id));
          if (!target) continue;
          setSetting(db, `hello:${p.id}`, day);
          setSetting(db, `greeted:${target.id}`, day);
          schedule('hello', p.id, `u:${target.id}`, now() + T(rand(0, 300_000)), { userId: target.id, circleId: cid });
          return;
        }
      }
    }
  }

  // ---------- включение ИИ-людей ----------

  function setPeople(on) {
    setSetting(db, 'people', on ? '1' : '0');
    if (on) {
      for (const per of P.PEOPLE) {
        let u = db.prepare("SELECT * FROM users WHERE kind = 'person' AND json_extract(persona, '$.key') = ?").get(per.key);
        if (!u) {
          const id = createBot({ kind: 'person', username: per.username, displayName: per.name, plate: freePlate(db), about: per.about, city: per.city, persona: per });
          ctx.broadcastUser(id);
          const twin = ensureTwin(id);
          if (twin) ctx.broadcastUser(twin);
          u = row(id);
        }
        for (const c of per.circles) if (getChat(c) && addMember(c, u.id)) ctx.broadcastChat(c);
      }
      if (getSetting(db, 'people_announced') !== '1') {
        setSetting(db, 'people_announced', '1');
        const aska = askaId();
        humans().forEach((h, i) => schedule('people', aska, `dm:${Math.min(aska, h.id)}:${Math.max(aska, h.id)}`, now() + T(4000 + i * 1500)));
      }
    }
    presenceTick();
  }

  // ---------- жизненный цикл ----------

  function init() {
    const aska = ensureAska();
    seedCircles();
    for (const h of humans()) {
      ensureTwin(h.id);
      ctx.ensureDm(aska, h.id);
    }
    // характеры ИИ-людей обновляются вместе с кодом
    for (const u of persons()) {
      const key = personaOf(u)?.key;
      const per = P.PEOPLE.find((p) => p.key === key);
      if (per) db.prepare('UPDATE users SET persona = ? WHERE id = ?').run(JSON.stringify(per), u.id);
      ensureTwin(u.id);
    }
    if (getSetting(db, 'announced') !== ANNOUNCE) {
      setSetting(db, 'announced', ANNOUNCE);
      humans().forEach((h, i) => schedule('announce', aska, `dm:${Math.min(aska, h.id)}:${Math.max(aska, h.id)}`, now() + T(3000 + i * 2000), { userId: h.id }));
    }
  }

  function onUserRegistered(userId) {
    const aska = ensureAska();
    const twin = ensureTwin(userId);
    if (twin) ctx.broadcastUser(twin);
    const dm = ctx.ensureDm(aska, userId);
    schedule('welcome', aska, dm, now() + T(2500), { userId });
  }

  function onRecovered(userId) {
    const aska = askaId();
    if (!aska) return;
    schedule('recovered', aska, ctx.ensureDm(aska, userId), now() + T(2500));
  }

  const timers = [];
  function start() {
    timers.push(setInterval(tick, timing.tickMs || 1000));
    timers.push(setInterval(presenceTick, timing.presenceMs || 30_000));
    timers.push(setInterval(() => proactive(false), timing.proactiveMs || 60_000));
    for (const t of timers) t.unref?.();
    presenceTick();
  }
  async function stop() {
    for (const t of timers) clearInterval(t);
    await Promise.allSettled([...inflight]);
  }
  async function idle(ms = 3000) {
    const t0 = Date.now();
    for (;;) {
      tick();
      const pending = db.prepare('SELECT COUNT(*) AS n FROM bot_jobs WHERE due_at <= ?').get(now()).n;
      if (!pending && !inflight.size) return;
      if (Date.now() - t0 > ms) return;
      await new Promise((r) => setTimeout(r, 10));
    }
  }

  return {
    init, start, stop, idle, tick, proactive, onMessage, onUserRegistered, onRecovered, onlineIds, isOnline,
    setPeople, peopleEnabled, ensureTwin, twinName, addFacts, factsOf, askaId,
  };
}
