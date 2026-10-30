// Стены АСЬКИ. У каждого своя стена: записи, фото, открытки и магниты от друзей. «Стена АСЬКИ» — все стены
// в одной ленте: видно, на чьей стене запись и кто её оставил.
// Стена видна всем в АСЬКЕ и НЕ шифруется, как переписка (людям это сказано прямо на стене).
// Механика: 🌼 цветочек записи — навсегда и +1 аськоин автору; «Пост дня» в 21:00 по Москве — запись с самым
// большим букетом за сутки, автору +30; магниты (за аськоины) собираются у хозяина стены на «холодильнике».
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import * as M from './market.js';
import { getSetting, setSetting } from './db.js';

// Открытки и магниты рисует «Аська» (AskaArt.postcardSvg / magnetSvg) — здесь только их коды
export const CARDS = {
  flowers: 'Цветы', sun: 'Доброе утро', heart: 'Сердце', star: 'Звёзды', cake: 'Тортик', cat: 'Котик',
  trip: 'Путешествие', roses: 'Розы', candle: 'Свеча', kiss: 'Поцелуй', couple: 'Парочка', tea: 'Чай',
};
// Цена магнита в аськоинах: обычные — 10, Урюпинск — 5, Антарктида и Луна — 50
export const MAGNETS = Object.fromEntries([
  ...['TR', 'EG', 'IT', 'FR', 'ES', 'GR', 'TH', 'AE', 'JP', 'US', 'DE', 'CZ', 'CY', 'GE', 'AM', 'KZ', 'BY', 'CN', 'IN', 'BR', 'MV', 'VN', 'GB', 'RU'].map((c) => [c, 10]),
  ['UR', 5], ['AQ', 50], ['MOON', 50],
]);
// Названия стран для подписи магнита (как в «Аське»)
export const MAGNET_NAMES = {
  TR: 'Турция', EG: 'Египет', IT: 'Италия', FR: 'Франция', ES: 'Испания', GR: 'Греция', TH: 'Таиланд', AE: 'ОАЭ', JP: 'Япония', US: 'США',
  DE: 'Германия', CZ: 'Чехия', CY: 'Кипр', GE: 'Грузия', AM: 'Армения', KZ: 'Казахстан', BY: 'Беларусь', CN: 'Китай', IN: 'Индия', BR: 'Бразилия',
  MV: 'Мальдивы', VN: 'Вьетнам', GB: 'Британия', RU: 'Сочи', UR: 'Урюпинск', AQ: 'Антарктида', MOON: 'Луна',
};
// Реакции на записи (одна от человека, можно сменить) и «живые гифки» — анимированные мемы
export const REACTIONS = ['👍', '❤️', '😂', '🔥', '😍', '😮', '😢', '👏', '💯', '💀'];
export const STICKERS = ['oru', 'kringe', 'baza', 'fiasko', 'zhiza', 'imba', 'vibe', 'redflag', 'sigma', 'nuvse', 'lois', 'shok', 'kaif',
  'plak', 'tusa', 'ponyal', 'kotik', 'lyublyu', 'tancy', 'hm', 'mozg', 'gg', 'cvetok', 'pushka'];
export const TIP_AMOUNTS = [5, 10, 25, 50];
export const FLOWER_COIN = 1;
export const BEST_COINS = 30;
const MSK = 3 * 3_600_000;
const PHOTO_RE = /^[a-f0-9]{32}$/;
const mskDay = (t) => new Date(t + MSK).toISOString().slice(0, 10);

// Текст записи: без управляющих символов, переносы строк оставляем
function cleanPost(s, max) {
  if (typeof s !== 'string') return '';
  const t = s.replace(/[\u0000-\u0009\u000b-\u001f\u007f​-‏‪-‮⁦-⁩]/g, '').replace(/\n{3,}/g, '\n\n').trim();
  return t.length <= max ? t : null;
}

function imageType(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 8 && buf.toString('latin1', 1, 4) === 'PNG') return 'image/png';
  if (buf.length > 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export function createWall({ db, dataDir, sendToAll, log = console.log }) {
  const dir = path.join(dataDir, 'wall');
  fs.mkdirSync(dir, { recursive: true });
  let hooks = {};
  const row = (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  const postRow = (id) => db.prepare('SELECT * FROM wall_posts WHERE id = ?').get(id);
  // стена есть у людей, ИИ-людей, Аськи и Бати; у личных ИИ — нет
  const hasWall = (u) => Boolean(u) && ['human', 'person', 'aska', 'friend'].includes(u.kind) && !u.blocked_at;

  function view(p, meId) {
    const flowers = db.prepare('SELECT COUNT(*) AS n FROM wall_flowers WHERE post_id = ?').get(p.id).n;
    const mine = meId ? Boolean(db.prepare('SELECT 1 FROM wall_flowers WHERE post_id = ? AND user_id = ?').get(p.id, meId)) : false;
    const hidden = meId ? hiddenSet(meId) : new Set();
    const comments = db.prepare('SELECT id, author_id AS authorId, text, sticker, created_at AS createdAt FROM wall_comments WHERE post_id = ? ORDER BY id LIMIT 50').all(p.id)
      .filter((c) => !hidden.has(c.authorId)).map((c) => (c.sticker ? { ...c } : { id: c.id, authorId: c.authorId, text: c.text, createdAt: c.createdAt }));
    const reactions = {};
    for (const r of db.prepare('SELECT emoji, COUNT(*) AS n FROM wall_reactions WHERE post_id = ? GROUP BY emoji ORDER BY n DESC').all(p.id)) reactions[r.emoji] = r.n;
    const my = meId ? db.prepare('SELECT emoji FROM wall_reactions WHERE post_id = ? AND user_id = ?').get(p.id, meId)?.emoji : null;
    const tips = db.prepare('SELECT COALESCE(SUM(amount), 0) AS n FROM wall_tips WHERE post_id = ?').get(p.id).n;
    const v = { id: p.id, wallId: p.wall_id, authorId: p.author_id, kind: p.kind, text: p.text || '', createdAt: p.created_at, flowers, mine, comments, reactions, tips };
    if (my) v.myReaction = my;
    if (p.sticker) v.sticker = p.sticker;
    if (p.card) v.card = p.card;
    if (p.magnet) v.magnet = p.magnet;
    if (p.photo) v.photo = { id: p.photo, w: p.w || 0, h: p.h || 0 };
    if (p.best_day) v.best = p.best_day;
    return v;
  }

  const notBlocked = 'author_id NOT IN (SELECT id FROM users WHERE blocked_at IS NOT NULL)';
  // «Убрать для себя»: кого человек скрыл — их записей и комментариев он не видит, на его стену они не пишут
  const hiddenSet = (userId) => new Set(db.prepare('SELECT target_id FROM user_hides WHERE user_id = ?').all(userId).map((r) => r.target_id));
  const hides = (userId, targetId) => Boolean(db.prepare('SELECT 1 FROM user_hides WHERE user_id = ? AND target_id = ?').get(userId, targetId));
  function setHidden(userId, targetId, on) {
    if (on) db.prepare('INSERT OR IGNORE INTO user_hides (user_id, target_id, created_at) VALUES (?, ?, ?)').run(userId, targetId, Date.now());
    else db.prepare('DELETE FROM user_hides WHERE user_id = ? AND target_id = ?').run(userId, targetId);
    return [...hiddenSet(userId)];
  }

  function list({ wallId, before, limit = 30, top }, meId) {
    const lim = Math.min(50, Math.max(1, limit));
    const hidden = meId ? hiddenSet(meId) : new Set();
    let rows;
    if (top) {
      rows = db.prepare(`SELECT p.*, (SELECT COUNT(*) FROM wall_flowers f WHERE f.post_id = p.id) AS fl FROM wall_posts p
        WHERE p.created_at > ? AND ${notBlocked} ORDER BY fl DESC, p.id DESC LIMIT ?`).all(Date.now() - 7 * 86_400_000, lim);
    } else if (wallId) {
      rows = db.prepare(`SELECT * FROM wall_posts WHERE wall_id = ? AND (? = 0 OR id < ?) AND ${notBlocked} ORDER BY id DESC LIMIT ?`).all(wallId, before || 0, before || 0, lim);
    } else {
      rows = db.prepare(`SELECT * FROM wall_posts WHERE (? = 0 OR id < ?) AND ${notBlocked} ORDER BY id DESC LIMIT ?`).all(before || 0, before || 0, lim);
    }
    return rows.filter((p) => !hidden.has(p.author_id)).map((p) => view(p, meId));
  }

  // Холодильник: магниты, которые человеку прислали на стену (страна → сколько)
  function fridge(wallId) {
    return db.prepare("SELECT magnet AS code, COUNT(*) AS n FROM wall_posts WHERE wall_id = ? AND kind = 'magnet' GROUP BY magnet ORDER BY MIN(id)").all(wallId).map((r) => ({ ...r }));
  }

  function savePhoto(uploaderId, buf) {
    const mime = imageType(buf);
    if (!mime) return null;
    const id = crypto.randomBytes(16).toString('hex');
    fs.writeFileSync(path.join(dir, id), buf);
    db.prepare('INSERT INTO wall_photos (id, uploader_id, size, mime, created_at) VALUES (?, ?, ?, ?, ?)').run(id, uploaderId, buf.length, mime, Date.now());
    return id;
  }

  function dropPhoto(id) {
    if (!id || db.prepare('SELECT 1 FROM wall_posts WHERE photo = ?').get(id)) return;
    db.prepare('DELETE FROM wall_photos WHERE id = ?').run(id);
    fs.rm(path.join(dir, id), { force: true }, () => {});
  }

  // Новая запись. Возвращает { post } или { error }. Боты (fromBot) магниты не покупают.
  function post(authorId, wallId, b, { fromBot = false } = {}) {
    const author = row(authorId);
    const owner = row(wallId);
    if (!author || !hasWall(owner) || (!fromBot && author.blocked_at)) return { error: 'bad_wall' };
    if (hides(wallId, authorId)) return { error: 'hidden' };
    const kind = b?.kind;
    const text = cleanPost(b?.text || '', 500);
    if (text === null) return { error: 'too_long' };
    const rec = { kind, text, card: null, magnet: null, photo: null, w: null, h: null, sticker: null };
    if (kind === 'text') {
      if (!text) return { error: 'empty' };
    } else if (kind === 'sticker') {
      if (!STICKERS.includes(b.sticker)) return { error: 'bad_sticker' };
      rec.sticker = b.sticker;
    } else if (kind === 'card') {
      if (!CARDS[b.card]) return { error: 'bad_card' };
      rec.card = b.card;
    } else if (kind === 'magnet') {
      const price = MAGNETS[b.magnet];
      if (!price) return { error: 'bad_magnet' };
      if (!fromBot && authorId !== wallId && (author.coins || 0) < price) return { error: 'no_coins', price };
      rec.magnet = b.magnet;
      rec.price = fromBot || authorId === wallId ? 0 : price;
    } else if (kind === 'photo') {
      const ph = b.photo;
      if (!ph || !PHOTO_RE.test(ph.id || '')) return { error: 'bad_photo' };
      const meta = db.prepare('SELECT * FROM wall_photos WHERE id = ?').get(ph.id);
      if (!meta || meta.uploader_id !== authorId || db.prepare('SELECT 1 FROM wall_posts WHERE photo = ?').get(ph.id)) return { error: 'bad_photo' };
      rec.photo = ph.id;
      rec.w = Number.isInteger(ph.w) && ph.w > 0 && ph.w < 10000 ? ph.w : null;
      rec.h = Number.isInteger(ph.h) && ph.h > 0 && ph.h < 10000 ? ph.h : null;
    } else return { error: 'bad_kind' };
    const now = Date.now();
    const { lastInsertRowid } = db.prepare(`INSERT INTO wall_posts (wall_id, author_id, kind, text, card, magnet, photo, w, h, sticker, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(wallId, authorId, kind, rec.text || null, rec.card, rec.magnet, rec.photo, rec.w, rec.h, rec.sticker, now);
    if (rec.price) M.addCoins(db, authorId, -rec.price, `магнит на стену: ${owner.display_name}`);
    const p = postRow(Number(lastInsertRowid));
    sendToAll({ type: 'wall', post: view(p) });
    hooks.onPost?.(p);
    return { post: p };
  }

  // 🌼 Цветочек записи: насовсем, один от человека; автору (если это не он сам) +1 аськоин
  function flower(userId, postId) {
    const p = postRow(postId);
    if (!p || !row(userId)) return null;
    const { changes } = db.prepare('INSERT OR IGNORE INTO wall_flowers (post_id, user_id, created_at) VALUES (?, ?, ?)').run(postId, userId, Date.now());
    if (changes && p.author_id !== userId && row(p.author_id)?.kind === 'human') M.addCoins(db, p.author_id, FLOWER_COIN, '🌼 цветочек на стене');
    const n = db.prepare('SELECT COUNT(*) AS n FROM wall_flowers WHERE post_id = ?').get(postId).n;
    if (changes) sendToAll({ type: 'wall_flower', postId, flowers: n, by: userId });
    return n;
  }

  // Комментарий: текст и/или гифка-мем
  function comment(userId, postId, text, sticker) {
    const p = postRow(postId);
    const t = cleanPost(text || '', 300);
    const st = sticker && STICKERS.includes(sticker) ? sticker : null;
    if (!p || t === null || (!t && !st) || (sticker && !st)) return null;
    if (hides(p.wall_id, userId) || hides(p.author_id, userId)) return null;
    const { lastInsertRowid } = db.prepare('INSERT INTO wall_comments (post_id, author_id, text, sticker, created_at) VALUES (?, ?, ?, ?, ?)').run(postId, userId, t, st, Date.now());
    const c = { id: Number(lastInsertRowid), authorId: userId, text: t, createdAt: Date.now() };
    if (st) c.sticker = st;
    sendToAll({ type: 'wall_comment', postId, comment: c });
    hooks.onComment?.(p, c);
    return c;
  }

  // Реакция: одна от человека, та же ещё раз — снять
  function react(userId, postId, emoji) {
    const p = postRow(postId);
    if (!p || (emoji && !REACTIONS.includes(emoji))) return null;
    const cur = db.prepare('SELECT emoji FROM wall_reactions WHERE post_id = ? AND user_id = ?').get(postId, userId)?.emoji;
    if (!emoji || cur === emoji) db.prepare('DELETE FROM wall_reactions WHERE post_id = ? AND user_id = ?').run(postId, userId);
    else db.prepare(`INSERT INTO wall_reactions (post_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(post_id, user_id) DO UPDATE SET emoji = excluded.emoji, created_at = excluded.created_at`).run(postId, userId, emoji, Date.now());
    const v = view(p, userId);
    sendToAll({ type: 'wall_react', postId, reactions: v.reactions, by: userId, emoji: v.myReaction || null });
    if (emoji && cur !== emoji) hooks.onReact?.(p, userId, emoji);
    return v;
  }

  // Аськоины автору записи в подарок
  function tip(fromId, postId, amount) {
    const p = postRow(postId);
    const from = row(fromId);
    if (!p || !from || !TIP_AMOUNTS.includes(amount)) return { error: 'bad_request' };
    if (p.author_id === fromId) return { error: 'own_post' };
    if ((from.coins || 0) < amount) return { error: 'no_coins' };
    const to = row(p.author_id);
    M.addCoins(db, fromId, -amount, `🪙 подарок за запись: ${to?.display_name || ''}`);
    M.addCoins(db, p.author_id, amount, `🪙 подарок за запись от ${from.display_name}`);
    db.prepare('INSERT INTO wall_tips (post_id, from_id, to_id, amount, created_at) VALUES (?, ?, ?, ?, ?)').run(postId, fromId, p.author_id, amount, Date.now());
    const tips = db.prepare('SELECT COALESCE(SUM(amount), 0) AS n FROM wall_tips WHERE post_id = ?').get(postId).n;
    sendToAll({ type: 'wall_tip', postId, tips, by: fromId, amount });
    hooks.onTip?.(p, fromId, amount);
    return { tips, coins: row(fromId).coins };
  }

  function remove(postId) {
    const p = postRow(postId);
    if (!p) return false;
    db.prepare('DELETE FROM wall_posts WHERE id = ?').run(postId);
    dropPhoto(p.photo);
    sendToAll({ type: 'wall_del', postId });
    return true;
  }

  // «Пост дня»: в 21:00 по Москве — запись с самым большим букетом за сутки (от двух цветочков)
  function bestOfDay(force = false) {
    const t = Date.now();
    const day = mskDay(t);
    if (!force && (new Date(t + MSK).getUTCHours() < 21 || getSetting(db, 'wall_best') === day)) return null;
    setSetting(db, 'wall_best', day);
    const best = db.prepare(`SELECT p.*, (SELECT COUNT(*) FROM wall_flowers f WHERE f.post_id = p.id AND f.user_id != p.author_id) AS fl
      FROM wall_posts p WHERE p.created_at > ? AND p.best_day IS NULL AND ${notBlocked} ORDER BY fl DESC, p.id LIMIT 1`).get(t - 86_400_000);
    if (!best || best.fl < 2) return null;
    db.prepare('UPDATE wall_posts SET best_day = ? WHERE id = ?').run(day, best.id);
    if (row(best.author_id)?.kind === 'human') M.addCoins(db, best.author_id, BEST_COINS, '🏆 пост дня на стене');
    const p = postRow(best.id);
    sendToAll({ type: 'wall', post: view(p) });
    hooks.onBest?.(p, best.fl);
    return p;
  }

  // ---------- API ----------
  function mount(api, { auth, json, allow, userRow }) {
    const me = (req) => userRow(req.userId);
    const isGold = (u) => M.isGold(u);

    api.get('/wall/feed', auth, (req, res) => {
      const before = Math.max(0, parseInt(req.query.before, 10) || 0);
      res.json({ posts: list({ before, top: req.query.top === '1' }, req.userId) });
    });

    api.post('/wall/photo', auth, express.raw({ type: ['image/*', 'application/octet-stream'], limit: '4mb' }), (req, res) => {
      if (!allow(`wallph:${req.userId}`, 30, 600_000)) return res.status(429).json({ error: 'too_many' });
      if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'bad_photo' });
      const id = savePhoto(req.userId, req.body);
      if (!id) return res.status(400).json({ error: 'bad_photo' });
      res.json({ id });
    });

    api.get('/wall/photo/:id', auth, (req, res) => {
      const meta = PHOTO_RE.test(req.params.id) ? db.prepare('SELECT * FROM wall_photos WHERE id = ?').get(req.params.id) : null;
      if (!meta) return res.status(404).end();
      res.set('Content-Type', meta.mime);
      res.set('Cache-Control', 'private, max-age=31536000, immutable');
      res.sendFile(path.join(dir, meta.id));
    });

    api.get('/wall/:userId', auth, (req, res) => {
      const owner = row(Number(req.params.userId));
      if (!hasWall(owner)) return res.status(404).json({ error: 'not_found' });
      const before = Math.max(0, parseInt(req.query.before, 10) || 0);
      const stats = db.prepare(`SELECT COUNT(*) AS posts, (SELECT COUNT(*) FROM wall_flowers f JOIN wall_posts p ON p.id = f.post_id WHERE p.author_id = ?) AS flowers
        FROM wall_posts WHERE wall_id = ?`).get(owner.id, owner.id);
      res.json({ owner: owner.id, posts: list({ wallId: owner.id, before }, req.userId), fridge: fridge(owner.id), stats: { ...stats } });
    });

    api.post('/wall/:userId', auth, json, (req, res) => {
      if (!allow(`wall:${req.userId}`, 20, 600_000)) return res.status(429).json({ error: 'too_many' });
      const r = post(req.userId, Number(req.params.userId), req.body || {});
      if (r.error) return res.status(r.error === 'no_coins' ? 402 : 400).json(r);
      res.json({ post: view(r.post, req.userId), coins: me(req).coins });
    });

    api.post('/wall/posts/:id/flower', auth, (req, res) => {
      if (!allow(`wallfl:${req.userId}`, 120, 600_000)) return res.status(429).json({ error: 'too_many' });
      const n = flower(req.userId, Number(req.params.id));
      if (n === null) return res.status(404).json({ error: 'not_found' });
      res.json({ flowers: n });
    });

    api.post('/wall/posts/:id/react', auth, json, (req, res) => {
      if (!allow(`wallre:${req.userId}`, 120, 600_000)) return res.status(429).json({ error: 'too_many' });
      const v = react(req.userId, Number(req.params.id), req.body?.emoji || null);
      if (!v) return res.status(400).json({ error: 'bad_request' });
      res.json({ reactions: v.reactions, myReaction: v.myReaction || null });
    });

    api.post('/wall/posts/:id/tip', auth, json, (req, res) => {
      if (!allow(`walltip:${req.userId}`, 30, 600_000)) return res.status(429).json({ error: 'too_many' });
      const r = tip(req.userId, Number(req.params.id), Number(req.body?.amount));
      if (r.error) return res.status(r.error === 'no_coins' ? 402 : 400).json(r);
      res.json(r);
    });

    // Скрыть человека для себя (и вернуть)
    api.post('/hides', auth, json, (req, res) => {
      const t = row(Number(req.body?.userId));
      if (!t || t.id === req.userId || !['human', 'person'].includes(t.kind)) return res.status(400).json({ error: 'bad_user' });
      res.json({ hidden: setHidden(req.userId, t.id, Boolean(req.body?.on)) });
    });

    api.post('/wall/posts/:id/comments', auth, json, (req, res) => {
      if (!allow(`wallcm:${req.userId}`, 40, 600_000)) return res.status(429).json({ error: 'too_many' });
      const c = comment(req.userId, Number(req.params.id), req.body?.text, req.body?.sticker);
      if (!c) return res.status(400).json({ error: 'bad_request' });
      res.json({ comment: c });
    });

    // Удалить запись может автор, хозяин стены и голд
    api.delete('/wall/posts/:id', auth, (req, res) => {
      const p = postRow(Number(req.params.id));
      if (!p) return res.status(404).json({ error: 'not_found' });
      if (p.author_id !== req.userId && p.wall_id !== req.userId && !isGold(me(req))) return res.status(403).json({ error: 'forbidden' });
      remove(p.id);
      res.json({ ok: true });
    });
  }

  return {
    mount, post, flower, comment, react, tip, remove, bestOfDay, list, fridge, view, savePhoto, hiddenSet, setHidden,
    setHooks: (h) => { hooks = h || {}; },
  };
}
