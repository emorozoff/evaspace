// 🏠 Комнаты — сообщества по интересам, как группы ВКонтакте (мотоклуб, любители пенного, предприниматели, «Поплачь сюда»…)
// и 🌙 ночные комнаты-форумы (Матрица, Шарики, Жёлтый диван, Портал). Постояльцы (боты) и люди — по нику не понять, кто есть кто.
// С 31.10.2026 вход и посты бесплатные для всех: «Вступить» — и пиши под своим именем (свой «аватар-профиль»: id = 100000 + userId,
// bot = 'u:<userId>'). Пиксельный НФТ-аватар (100 🪙, скидка по уровню) — по желанию: с ним пишешь под ником и картинкой.
// Почасовые пропуска (night_passes) больше не нужны — enter/payHour оставлены для старых приложений и просто вступают в комнату.
// Ранги: президент (назначается), 2 советника, 3 хранителя, 5 джедаев — по репутации; остальные — самураи.
// Комнаты не шифруются (как стены): их читает сервер и, если подключён «мозг», постояльцы-ИИ.
import { ROOMS, roomOf, RANKS, NIGHT_BOTS, COLLECTION_SIZE, LINES, REPLIES, NIGHT_RULES, CATEGORIES } from './night-data.js';
import { getSetting, setSetting, tx } from './db.js';
import * as L from './ledger.js';
import * as TIER from './tiers.js';
import { REPLY_SCHEMA } from './personas.js';

export const NFT_PRICE = 100;
export const HOUR_PRICE = 0; // с 31.10.2026 комнаты бесплатные
const HOUR = 3_600_000;
const NICK_RE = /^[A-Za-zА-Яа-яЁё0-9_\-]{3,20}$/;
const mskHour = () => new Date(Date.now() + 3 * HOUR).getUTCHours();
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rand = (a, b) => a + Math.random() * (b - a);

export function createNight({ db, ai, log = () => {}, addCoins, userRow, sendToAll, timing = {} }) {
  const scale = timing.scale ?? 1;
  const T = (ms) => Math.max(0, Math.round(ms * scale));
  const nextDue = new Map(); // room → когда постояльцу пора сказать своё

  // ---------- постояльцы, места президентов, первые сообщения ----------
  function seed() {
    const now = Date.now();
    tx(db, () => {
      for (const b of NIGHT_BOTS) {
        if (!avatarRow(b.id)) {
          // ник уже занят человеком — постояльцу добавим номер, чтобы не путать
          const nick = db.prepare('SELECT 1 FROM night_avatars WHERE lower(nick) = lower(?)').get(b.nick) ? `${b.nick}_${b.id}` : b.nick;
          db.prepare('INSERT OR IGNORE INTO night_avatars (id, owner_id, bot, nick, minted_at) VALUES (?, NULL, ?, ?, ?)').run(b.id, b.bot, nick, now);
        }
        db.prepare('INSERT OR IGNORE INTO night_rep (room, avatar_id, posts, rep, last_at) VALUES (?, ?, 0, ?, 0)').run(b.room, b.id, b.rep);
      }
      for (const r of ROOMS) {
        if (db.prepare('SELECT 1 FROM night_seats WHERE room = ?').get(r.key)) continue;
        const pres = NIGHT_BOTS.find((b) => b.room === r.key && b.president);
        db.prepare('INSERT INTO night_seats (room, president_user, president_avatar) VALUES (?, NULL, ?)').run(r.key, pres?.id ?? null);
      }
      // в пустую комнату — немного разговора «из прошлого», чтобы новичок не попадал в тишину
      for (const r of ROOMS) {
        if (db.prepare('SELECT 1 FROM night_messages WHERE room = ?').get(r.key)) continue;
        const bots = NIGHT_BOTS.filter((b) => b.room === r.key);
        LINES[r.key].slice(0, 8).forEach((text, i) => {
          db.prepare('INSERT INTO night_messages (room, avatar_id, text, at) VALUES (?, ?, ?, ?)').run(r.key, bots[i % bots.length].id, text, now - (8 - i) * 9 * 60_000);
        });
        setSetting(db, `night_i:${r.key}`, '8');
      }
    });
  }

  // ---------- аватары ----------
  const avatarOfUser = (userId) => db.prepare('SELECT * FROM night_avatars WHERE owner_id = ?').get(userId) || null;
  const avatarRow = (id) => db.prepare('SELECT * FROM night_avatars WHERE id = ?').get(id) || null;
  const nftPrice = (u) => TIER.discounted(u, NFT_PRICE);

  function collection() {
    const taken = new Map(db.prepare('SELECT id, nick FROM night_avatars').all().map((r) => [r.id, r.nick]));
    return Array.from({ length: COLLECTION_SIZE }, (_, i) => ({ id: i + 1, taken: taken.has(i + 1) }));
  }

  function mint(userId, id, nick) {
    const u = userRow(userId);
    if (avatarOfUser(userId)) return { error: 'has_avatar', status: 409 };
    if (!Number.isInteger(id) || id < 1 || id > COLLECTION_SIZE) return { error: 'bad_avatar', status: 400 };
    const name = String(nick || '').trim();
    if (!NICK_RE.test(name)) return { error: 'bad_nick', status: 400 };
    if (db.prepare('SELECT 1 FROM night_avatars WHERE id = ? OR lower(nick) = lower(?)').get(id, name)) return { error: 'taken', status: 409 };
    const price = nftPrice(u);
    if ((u.coins || 0) < price) return { error: 'no_coins', status: 402, price };
    return tx(db, () => {
      if (price) addCoins(userId, -price, `НФТ-аватар #${id} «${name}» для Ночи`);
      const { block } = L.append(db, { kind: 'nft.mint', ref: `NIGHT#${id}`, actor: userId, data: { id, nick: name } });
      db.prepare('INSERT INTO night_avatars (id, owner_id, bot, nick, minted_at, block) VALUES (?, ?, NULL, ?, ?, ?)').run(id, userId, name, Date.now(), block);
      return { avatar: { id, nick: name, block }, price };
    });
  }

  // ---------- ранги ----------
  function council(room) {
    const seat = db.prepare('SELECT * FROM night_seats WHERE room = ?').get(room) || {};
    let presAvatar = seat.president_avatar || null;
    let presName = null;
    // в «Портале» президент — первый человек АСЬКИ, если администратор не назначил другого
    const presUser = seat.president_user || (room === 'portal' ? db.prepare("SELECT MIN(id) AS id FROM users WHERE kind = 'human'").get()?.id || null : null);
    if (presUser) {
      const a = avatarOfUser(presUser);
      if (a) presAvatar = a.id;
      else { presAvatar = null; presName = userRow(presUser)?.display_name || null; }
    }
    const list = db.prepare(`SELECT r.avatar_id, r.rep, r.posts, a.nick FROM night_rep r JOIN night_avatars a ON a.id = r.avatar_id
      WHERE r.room = ? ORDER BY r.rep DESC, r.posts DESC, r.avatar_id`).all(room).filter((r) => r.avatar_id !== presAvatar);
    const ranks = new Map();
    if (presAvatar) ranks.set(presAvatar, 'president');
    let i = 0;
    for (const rk of RANKS.slice(1)) {
      for (let k = 0; k < rk.seats && i < list.length; k++, i++) ranks.set(list[i].avatar_id, rk.key);
    }
    const pres = presAvatar ? { id: presAvatar, nick: authorOf(avatarRow(presAvatar)).nick } : presName ? { id: null, nick: presName, away: true } : null;
    const of = (key) => list.filter((r) => ranks.get(r.avatar_id) === key).map((r) => ({ id: r.avatar_id, nick: authorOf(avatarRow(r.avatar_id)).nick, rep: r.rep }));
    return { ranks, view: { president: pres, advisors: of('advisor'), keepers: of('keeper'), jedi: of('jedi'), samurai: of('samurai').length } };
  }

  // ---------- вступить / выйти (бесплатно) ----------
  const isMember = (userId, room) => !!db.prepare('SELECT 1 FROM night_members WHERE room = ? AND user_id = ?').get(room, userId);
  const memberCount = (room) => db.prepare('SELECT COUNT(*) AS n FROM night_members WHERE room = ?').get(room).n + NIGHT_BOTS.filter((b) => b.room === room).length;
  function join(userId, room) {
    const u = userRow(userId);
    if (!roomOf(room)) return { error: 'not_found', status: 404 };
    if (!u || u.kind !== 'human' || u.blocked_at) return { error: 'forbidden', status: 403 };
    db.prepare('INSERT OR IGNORE INTO night_members (room, user_id, joined_at) VALUES (?, ?, ?)').run(room, userId, Date.now());
    return { joined: true, members: memberCount(room), pass: { until: null, unlimited: true, freeLeft: false } };
  }
  function leave(userId, room) {
    if (!roomOf(room)) return { error: 'not_found', status: 404 };
    db.prepare('DELETE FROM night_members WHERE room = ? AND user_id = ?').run(room, userId);
    return { joined: false, members: memberCount(room) };
  }
  // старые приложения: «зайти» и «оплатить час» — теперь просто вступить, бесплатно
  const enter = (userId, room) => join(userId, room);
  const payHour = (userId, room) => join(userId, room);

  // свой «аватар-профиль»: пишешь под своим именем, без НФТ
  function personalAvatar(userId) {
    const id = 100000 + userId;
    if (!avatarRow(id)) db.prepare('INSERT OR IGNORE INTO night_avatars (id, owner_id, bot, nick, minted_at) VALUES (?, NULL, ?, ?, ?)').run(id, `u:${userId}`, `u${userId}`, Date.now());
    return avatarRow(id);
  }
  // кто автор: человек с НФТ, человек под своим именем или постоялец
  function authorOf(a) {
    if (!a) return { nick: '?' };
    if (a.bot && a.bot.startsWith('u:')) {
      const uid = Number(a.bot.slice(2));
      const u = userRow(uid);
      return { nick: u?.display_name || '?', userId: uid, profile: true };
    }
    if (a.owner_id) return { nick: a.nick, userId: a.owner_id, nft: a.id };
    return { nick: a.nick, nft: a.id };
  }

  // ---------- сообщения ----------
  function msgView(m, ranks) {
    const a = avatarRow(m.avatar_id);
    const rep = db.prepare('SELECT posts, rep FROM night_rep WHERE room = ? AND avatar_id = ?').get(m.room, m.avatar_id);
    const thanks = db.prepare('SELECT COUNT(*) AS n FROM night_thanks WHERE message_id = ?').get(m.id).n;
    const who = authorOf(a);
    return { id: m.id, room: m.room, avatar: { id: m.avatar_id, nick: who.nick, userId: who.userId || null, profile: !!who.profile, nft: who.nft || null,
      rank: ranks.get(m.avatar_id) || 'samurai', posts: rep?.posts || 0, rep: rep?.rep || 0 }, text: m.text, at: m.at, thanks };
  }
  function roomView(userId, room, before) {
    const r = roomOf(room);
    if (!r) return null;
    const u = userRow(userId);
    const { ranks, view } = council(room);
    const rows = db.prepare(`SELECT * FROM night_messages WHERE room = ? ${before ? 'AND id < ?' : ''} ORDER BY id DESC LIMIT 60`).all(...(before ? [room, before] : [room])).reverse();
    // лица комнаты: кто писал недавно (люди и постояльцы), до 12
    const faces = db.prepare('SELECT avatar_id, MAX(at) AS at FROM night_messages WHERE room = ? GROUP BY avatar_id ORDER BY at DESC LIMIT 12').all(room)
      .map((x) => { const a = avatarRow(x.avatar_id); const who = authorOf(a); return { id: x.avatar_id, nick: who.nick, userId: who.userId || null, nft: who.nft || null }; });
    return { room: r, council: view, messages: rows.map((m) => msgView(m, ranks)), joined: u ? isMember(u.id, room) : false, members: memberCount(room), faces,
      pass: { until: null, unlimited: true, freeLeft: false }, canWrite: !!u && u.kind === 'human' && !u.blocked_at };
  }
  function insert(room, avatarId, text, isBot) {
    const at = Date.now();
    const { lastInsertRowid } = db.prepare('INSERT INTO night_messages (room, avatar_id, text, at) VALUES (?, ?, ?, ?)').run(room, avatarId, text, at);
    db.prepare(`INSERT INTO night_rep (room, avatar_id, posts, rep, last_at) VALUES (?, ?, 1, ?, ?)
      ON CONFLICT(room, avatar_id) DO UPDATE SET posts = posts + 1, rep = rep + ?, last_at = excluded.last_at`).run(room, avatarId, isBot ? 0 : 1, at, isBot ? 0 : 1);
    const m = db.prepare('SELECT * FROM night_messages WHERE id = ?').get(Number(lastInsertRowid));
    const view = msgView(m, council(room).ranks);
    sendToAll({ type: 'night_msg', message: view });
    return view;
  }
  function post(userId, room, text) {
    const u = userRow(userId);
    if (!roomOf(room)) return { error: 'not_found', status: 404 };
    if (!u || u.kind !== 'human' || u.blocked_at) return { error: 'forbidden', status: 403 };
    const t0 = Date.now();
    const recent = db.prepare(`SELECT COUNT(*) AS n FROM night_messages m JOIN night_avatars a ON a.id = m.avatar_id
      WHERE (a.owner_id = ? OR a.bot = ?) AND m.at > ?`).get(userId, `u:${userId}`, t0 - 60_000).n;
    if (recent >= 10) return { error: 'too_many', status: 429 };
    join(userId, room); // написал — значит, в комнате
    const a = avatarOfUser(userId) || personalAvatar(userId);
    const who = authorOf(a);
    const t = String(text || '').replace(/[\u0000-\u0009\u000b-\u001f\u007f‪-‮⁦-⁩]/g, '').trim();
    if (!t || t.length > 500) return { error: 'bad_text', status: 400 };
    const message = insert(room, a.id, t, false);
    // постоялец ответит через 15–60 секунд
    const delay = T(rand(15_000, 60_000));
    setTimeout(() => { reply(room, who.nick, t).catch((e) => log('night reply', e)); }, delay);
    return { message };
  }
  function thank(userId, messageId) {
    const m = db.prepare('SELECT * FROM night_messages WHERE id = ?').get(messageId);
    if (!m) return { error: 'not_found', status: 404 };
    const am = avatarRow(m.avatar_id);
    if (am?.owner_id === userId || am?.bot === `u:${userId}`) return { error: 'self', status: 400 };
    const { changes } = db.prepare('INSERT OR IGNORE INTO night_thanks (message_id, user_id) VALUES (?, ?)').run(messageId, userId);
    if (changes) db.prepare('UPDATE night_rep SET rep = rep + 2 WHERE room = ? AND avatar_id = ?').run(m.room, m.avatar_id);
    return { thanks: db.prepare('SELECT COUNT(*) AS n FROM night_thanks WHERE message_id = ?').get(messageId).n };
  }

  // ---------- постояльцы говорят ----------
  const botsOf = (room) => NIGHT_BOTS.filter((b) => b.room === room);
  const lastMsg = (room) => db.prepare('SELECT * FROM night_messages WHERE room = ? ORDER BY id DESC LIMIT 1').get(room);
  function chooseBot(room, notId) { const list = botsOf(room).filter((b) => b.id !== notId); return pick(list.length ? list : botsOf(room)); }

  async function aiLine(room, bot, task) {
    if (!ai?.available?.()) return null;
    const r = roomOf(room);
    const hist = db.prepare('SELECT * FROM night_messages WHERE room = ? ORDER BY id DESC LIMIT 12').all(room).reverse()
      .map((m) => `${authorOf(avatarRow(m.avatar_id)).nick}: ${m.text.slice(0, 200)}`).join('\n');
    const out = await ai.complete({
      system: `${NIGHT_RULES}\n\nКомната «${r.title}»: ${r.about}\nТвой ник: ${bot.nick}.`,
      schema: REPLY_SCHEMA,
      prompt: `Последние сообщения (старые сверху):\n${hist}\n\n${task}\nОдно сообщение. note оставь пустым.`,
    });
    const text = Array.isArray(out?.messages) ? out.messages.find((m) => typeof m === 'string' && m.trim()) : null;
    return text ? text.trim().slice(0, 300) : null;
  }

  // ответ человеку: с «мозгом» — своими словами, без — по шпаргалке
  async function reply(room, nick, text) {
    const bot = chooseBot(room, lastMsg(room)?.avatar_id);
    const line = await aiLine(room, bot, `${nick} только что написал(а): «${text.slice(0, 200)}». Ответь ему(ей) по-доброму и по теме комнаты.`).catch(() => null)
      || pick(REPLIES[room]).replace('{nick}', nick);
    insert(room, bot.id, line, true);
  }

  // реплика по кругу (без «мозга») или своими словами
  async function chatter(room) {
    const bot = chooseBot(room, lastMsg(room)?.avatar_id);
    // «мозг» тратим, только если в комнате недавно (30 минут) писал живой человек — иначе реплики по кругу
    const people = db.prepare(`SELECT 1 FROM night_messages m JOIN night_avatars a ON a.id = m.avatar_id
      WHERE m.room = ? AND (a.owner_id IS NOT NULL OR a.bot LIKE 'u:%') AND m.at > ? LIMIT 1`).get(room, Date.now() - 30 * 60_000);
    let line = people ? await aiLine(room, bot, 'Продолжи разговор в комнате или начни новую тему — как живой участник ночного форума.').catch(() => null) : null;
    if (!line) {
      const i = Number(getSetting(db, `night_i:${room}`) || 0);
      line = LINES[room][i % LINES[room].length];
      setSetting(db, `night_i:${room}`, String(i + 1));
    }
    insert(room, bot.id, line, true);
  }

  // Ночные комнаты ночью (22–6 по Москве) говорят чаще: раз в 3–8 минут, днём — раз в 20–45.
  // Комнаты по интересам — спокойнее: днём раз в 40–90 минут, ночью раз в 2–4 часа (люди спят)
  function gap(room) {
    const h = mskHour();
    const night = h >= 22 || h < 6;
    if (roomOf(room)?.cat === 'night') return T(night ? rand(3, 8) * 60_000 : rand(20, 45) * 60_000);
    return T(night ? rand(120, 240) * 60_000 : rand(40, 90) * 60_000);
  }
  async function tick() {
    const now = Date.now();
    for (const r of ROOMS) {
      if (!nextDue.has(r.key)) nextDue.set(r.key, (lastMsg(r.key)?.at || now) + gap(r.key));
      if (now < nextDue.get(r.key)) continue;
      nextDue.set(r.key, now + gap(r.key));
      try { await chatter(r.key); } catch (e) { log('night chatter', e); }
    }
  }
  let timer = null;
  function start() {
    seed();
    if (timing.nightTickMs !== 0) timer = setInterval(() => { tick().catch(() => {}); }, timing.nightTickMs ?? 60_000);
  }
  function stop() { clearInterval(timer); }

  // ---------- для экранов «Комнаты» и «Ночь» ----------
  function overview(userId) {
    const u = userRow(userId);
    const a = avatarOfUser(userId);
    const h = mskHour();
    const night = h >= 22 || h < 6;
    const mine = new Set(db.prepare('SELECT room FROM night_members WHERE user_id = ?').all(userId).map((r) => r.room));
    return {
      rooms: ROOMS.map((r) => {
        const last = lastMsg(r.key);
        const active = db.prepare(`SELECT COUNT(DISTINCT m.avatar_id) AS n FROM night_messages m JOIN night_avatars a ON a.id = m.avatar_id
          WHERE m.room = ? AND (a.owner_id IS NOT NULL OR a.bot LIKE 'u:%') AND m.at > ?`).get(r.key, Date.now() - 15 * 60_000).n;
        const bots = r.cat === 'night' ? (night ? 4 + (r.key.length % 3) : 2) : (night ? 1 : 2 + (r.key.length % 2));
        return { ...r, online: active + bots, members: memberCount(r.key), joined: mine.has(r.key),
          last: last ? { nick: authorOf(avatarRow(last.avatar_id)).nick, text: last.text, at: last.at } : null, president: council(r.key).view.president };
      }),
      categories: CATEGORIES,
      avatar: a ? { id: a.id, nick: a.nick, block: a.block } : null,
      canWrite: !!u && u.kind === 'human' && !u.blocked_at, tier: TIER.tierOf(u), free: true,
      prices: { nft: nftPrice(u), nftFull: NFT_PRICE, hour: 0 },
      ranks: RANKS.map(({ key, name, emoji, seats }) => ({ key, name, emoji, seats: Number.isFinite(seats) ? seats : null })),
    };
  }

  // Президент комнаты — человек (администратор назначает); null — вернуть постояльца
  function setPresident(room, userId) {
    if (!roomOf(room)) return false;
    const pres = NIGHT_BOTS.find((b) => b.room === room && b.president);
    db.prepare(`INSERT INTO night_seats (room, president_user, president_avatar) VALUES (?, ?, ?)
      ON CONFLICT(room) DO UPDATE SET president_user = excluded.president_user`).run(room, userId || null, pres?.id ?? null);
    return true;
  }

  return { start, stop, tick, chatter, reply, collection, mint, enter, payHour, join, leave, isMember, roomView, post, thank, overview, setPresident, avatarOfUser, council, nftPrice };
}
