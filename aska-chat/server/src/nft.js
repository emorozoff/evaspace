// 💎 НФТ-галерея АСЬКИ (тестовые механизмы UPASS): у каждого цифрового «воспоминания» — фото, видео, музыки,
// гифки — есть автор, совладельцы из ближнего круга с долями (правообладатели и выгодоприобретатели) и цена,
// которую назначает автор. Выпуск, продажа, смена цены и привязка вещи в реальном мире (кольцо, ожерелье…
// с особым номером — эксклюзивный экземпляр, продаётся вместе с сертификатом НФТ) — блоки в цепочке АСЬКИ (ledger.js).
// Продажа: первая — деньги делятся между правообладателями по долям; перепродажа — продавцу 90%,
// правообладателям 10% по долям. Галерея открыта всем в АСЬКЕ (не шифруется) — это написано в приложении.
// Файлы лежат в DATA_DIR/nft/, сервер принимает только картинки, видео и звук (по первым байтам файла).
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { tx } from './db.js';
import * as L from './ledger.js';
import { cleanGif, gifFromBrief, gifFromAi, GIF_RULES, GIF_SCHEMA, GIF_PRICE } from './gifs.js';

export const KINDS = { gif: { prefix: 'G', name: 'Гифка' }, photo: { prefix: 'P', name: 'Фото' }, video: { prefix: 'V', name: 'Видео' }, music: { prefix: 'S', name: 'Музыка' } };
export const PHYSICAL = { ring: '💍 Кольцо', necklace: '📿 Ожерелье', bracelet: '⌚ Браслет', other: '🎁 Вещь' };
export const PRICE_MIN = 1;
export const PRICE_MAX = 1_000_000;
export const ROYALTY = 10;        // % правообладателям при перепродаже
export const MAX_COAUTHORS = 5;
export const MINT_PER_DAY = 20;
const LIMITS = { photo: 8 << 20, gif: 8 << 20, video: 50 << 20, music: 20 << 20 };
const MEDIA_RE = /^[0-9a-f]{32}$/;

export const tokenOf = (kind, id) => `${KINDS[kind]?.prefix || 'N'}-${String(id).padStart(6, '0')}`;
const clean = (s, max) => {
  const t = String(s ?? '').replace(/[\u0000-\u0009\u000b-\u001f\u007f​-‏‪-‮⁦-⁩]/g, ' ').replace(/[ \t]+/g, ' ').trim();
  return t.length <= max ? t : null;
};

// Что за файл — по первым байтам (не по тому, что прислал телефон)
export function mediaType(buf) {
  if (!buf || buf.length < 12) return null;
  const a = (i, n) => buf.toString('latin1', i, i + n);
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', kind: 'photo' };
  if (a(1, 3) === 'PNG') return { mime: 'image/png', kind: 'photo' };
  if (a(0, 4) === 'RIFF' && a(8, 4) === 'WEBP') return { mime: 'image/webp', kind: 'photo' };
  if (a(0, 4) === 'GIF8') return { mime: 'image/gif', kind: 'gif' };
  if (a(0, 4) === 'RIFF' && a(8, 4) === 'WAVE') return { mime: 'audio/wav', kind: 'music' };
  if (a(0, 4) === 'OggS') return { mime: 'audio/ogg', kind: 'music' };
  if (a(0, 3) === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0 && (buf[1] & 0x06) !== 0)) return { mime: 'audio/mpeg', kind: 'music' };
  if (a(0, 4) === 'fLaC') return { mime: 'audio/flac', kind: 'music' };
  if (a(4, 4) === 'ftyp') {
    const brand = a(8, 4);
    if (/^M4A|^M4B/.test(brand)) return { mime: 'audio/mp4', kind: 'music' };
    if (brand === 'qt  ') return { mime: 'video/quicktime', kind: 'video' };
    return { mime: 'video/mp4', kind: 'video' };
  }
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return { mime: 'video/webm', kind: 'video' };
  return null;
}

// Доли по справедливости: целые аськоины, остаток — самым большим долям
export function split(amount, holders) {
  const total = holders.reduce((n, h) => n + h.share, 0) || 1;
  const parts = holders.map((h) => ({ userId: h.userId, exact: (amount * h.share) / total }));
  parts.forEach((p) => { p.coins = Math.floor(p.exact); });
  let left = amount - parts.reduce((n, p) => n + p.coins, 0);
  [...parts].sort((x, y) => (y.exact - y.coins) - (x.exact - x.coins)).forEach((p) => { if (left > 0) { p.coins++; left--; } });
  return parts.filter((p) => p.coins > 0).map(({ userId, coins }) => ({ userId, coins }));
}

export function createNft({ db, dataDir, ai, addCoins, userRow, onEvent = () => {}, log = () => {} }) {
  const dir = path.join(dataDir, 'nft');
  fs.mkdirSync(dir, { recursive: true });
  const nameOf = (id) => userRow(id)?.display_name || '?';
  const row = (id) => db.prepare('SELECT * FROM nfts WHERE id = ? AND hidden = 0').get(id);
  const rightsOf = (id) => db.prepare('SELECT user_id AS userId, share, role FROM nft_rights WHERE nft_id = ? ORDER BY role, share DESC').all(id).map((r) => ({ ...r }));

  function view(r, viewerId) {
    if (!r) return null;
    const rights = rightsOf(r.id).map((x) => ({ ...x, name: nameOf(x.userId) }));
    return {
      id: r.id, token: tokenOf(r.kind, r.id), kind: r.kind, title: r.title, about: r.about || '',
      spec: r.spec ? JSON.parse(r.spec) : null, brief: r.brief || '', media: r.media || null, mime: r.mime || null, mediaHash: r.media_hash || null,
      w: r.w, h: r.h, dur: r.dur,
      authorId: r.author_id, authorName: nameOf(r.author_id), ownerId: r.owner_id, ownerName: nameOf(r.owner_id),
      price: r.price, forSale: !!r.for_sale, createdAt: r.created_at, block: r.block, rights,
      physical: r.physical_kind ? { kind: r.physical_kind, label: PHYSICAL[r.physical_kind], serial: r.physical_serial, note: r.physical_note || '' } : null,
      mine: viewerId === r.owner_id, iAmAuthor: viewerId === r.author_id,
      trades: db.prepare('SELECT COUNT(*) AS n FROM nft_trades WHERE nft_id = ?').get(r.id).n,
    };
  }

  function saveMedia(uploaderId, buf) {
    const t = mediaType(buf);
    if (!t) return { error: 'bad_media' };
    if (buf.length > LIMITS[t.kind]) return { error: 'too_large', limit: LIMITS[t.kind] };
    const id = crypto.randomBytes(16).toString('hex');
    const hash = crypto.createHash('sha256').update(buf).digest('hex');
    fs.writeFileSync(path.join(dir, id), buf);
    db.prepare('INSERT INTO nft_media (id, uploader_id, mime, size, hash, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, uploaderId, t.mime, buf.length, hash, Date.now());
    return { id, mime: t.mime, kind: t.kind, hash, size: buf.length };
  }

  // правообладатели: автор + до 5 совладельцев-людей, доли целые, вместе 100
  function rightsFrom(authorId, coauthors) {
    const list = [];
    let rest = 100;
    for (const c of Array.isArray(coauthors) ? coauthors.slice(0, MAX_COAUTHORS) : []) {
      const uid = Number(c?.userId);
      const share = Math.floor(Number(c?.share));
      const u = userRow(uid);
      if (!u || u.kind !== 'human' || uid === authorId || list.some((x) => x.userId === uid)) return { error: 'bad_coauthor' };
      if (!(share >= 1 && share <= 99)) return { error: 'bad_share' };
      rest -= share;
      list.push({ userId: uid, share, role: 'coauthor' });
    }
    if (rest < 1) return { error: 'bad_share' };
    return { rights: [{ userId: authorId, share: rest, role: 'author' }, ...list] };
  }

  function physicalFrom(p) {
    if (!p || !p.kind) return { physical: null };
    if (!PHYSICAL[p.kind]) return { error: 'bad_physical' };
    const serial = clean(p.serial, 40);
    if (!serial || !/^[\p{L}\p{N}][\p{L}\p{N} ._\-/#№]{1,39}$/u.test(serial)) return { error: 'bad_serial' };
    const note = clean(p.note || '', 200);
    if (note === null) return { error: 'bad_physical' };
    if (db.prepare('SELECT 1 FROM nfts WHERE physical_serial = ? AND hidden = 0').get(serial)) return { error: 'serial_taken' };
    return { physical: { kind: p.kind, serial, note } };
  }

  // Выпустить НФТ
  function mint(authorId, b) {
    const kind = b?.kind;
    if (!KINDS[kind]) return { error: 'bad_kind' };
    const title = clean(b.title, 80);
    const about = clean(b.about || '', 500);
    if (!title || about === null) return { error: 'bad_title' };
    let spec = null; let brief = null; let media = null;
    if (kind === 'gif' && b.spec) {
      spec = cleanGif(b.spec);
      brief = clean(b.brief || '', 300);
      if (!spec || brief === null) return { error: 'bad_gif' };
    } else {
      media = MEDIA_RE.test(String(b.media || '')) ? db.prepare('SELECT * FROM nft_media WHERE id = ?').get(b.media) : null;
      if (!media || media.uploader_id !== authorId) return { error: 'bad_media' };
      const mk = mediaKind(media.mime);
      if (mk !== kind) return { error: 'bad_media' };
      if (db.prepare('SELECT 1 FROM nfts WHERE media = ?').get(media.id)) return { error: 'media_used' };
    }
    const price = b.price == null ? (kind === 'gif' ? GIF_PRICE : 100) : Math.floor(Number(b.price));
    if (!(price >= PRICE_MIN && price <= PRICE_MAX)) return { error: 'bad_price' };
    const r = rightsFrom(authorId, b.coauthors);
    if (r.error) return r;
    const ph = physicalFrom(b.physical);
    if (ph.error) return ph;
    const num = (v, max) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.min(max, Number(v)) : null);
    const id = tx(db, () => {
      const at = Date.now();
      const { lastInsertRowid } = db.prepare(`INSERT INTO nfts (kind, title, about, spec, brief, media, mime, media_hash, w, h, dur, author_id, owner_id, price, for_sale,
        physical_kind, physical_serial, physical_note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(kind, title, about || null, spec ? JSON.stringify(spec) : null, brief || null, media?.id || null, media?.mime || null, media?.hash || null,
          num(b.w, 20000), num(b.h, 20000), num(b.dur, 36000), authorId, authorId, price, b.forSale === false ? 0 : 1,
          ph.physical?.kind || null, ph.physical?.serial || null, ph.physical?.note || null, at);
      const nid = Number(lastInsertRowid);
      const ins = db.prepare('INSERT INTO nft_rights (nft_id, user_id, share, role) VALUES (?, ?, ?, ?)');
      for (const x of r.rights) ins.run(nid, x.userId, x.share, x.role);
      const blk = L.append(db, { kind: 'nft.mint', ref: tokenOf(kind, nid), actor: authorId, data: {
        token: tokenOf(kind, nid), kind, title, price, rights: r.rights.map((x) => ({ u: x.userId, share: x.share, role: x.role })),
        ...(media ? { sha256: media.hash, mime: media.mime } : { gif: spec }), ...(ph.physical ? { physical: ph.physical } : {}),
      } });
      db.prepare('UPDATE nfts SET block = ? WHERE id = ?').run(blk.block, nid);
      return nid;
    });
    const v = view(row(id), authorId);
    onEvent('mint', { nft: v, rights: r.rights });
    return { nft: v };
  }

  function mediaKind(mime) {
    if (mime === 'image/gif') return 'gif';
    if (mime.startsWith('image/')) return 'photo';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'music';
    return null;
  }

  // Купить: аськоины покупателя → правообладателям (и продавцу при перепродаже), НФТ — покупателю
  function buy(buyerId, id) {
    const n = row(id);
    if (!n) return { error: 'not_found' };
    if (!n.for_sale) return { error: 'not_for_sale' };
    if (n.owner_id === buyerId) return { error: 'own' };
    const buyer = userRow(buyerId);
    if (!buyer || buyer.kind !== 'human' || buyer.blocked_at) return { error: 'forbidden' };
    if ((buyer.coins || 0) < n.price) return { error: 'no_coins', need: n.price, have: buyer.coins || 0 };
    const holders = rightsOf(n.id);
    const firstSale = n.owner_id === n.author_id && !db.prepare('SELECT 1 FROM nft_trades WHERE nft_id = ?').get(n.id);
    const royalty = firstSale ? n.price : Math.floor((n.price * ROYALTY) / 100);
    const payouts = split(royalty, holders);
    if (!firstSale && n.price - royalty > 0) payouts.push({ userId: n.owner_id, coins: n.price - royalty, seller: true });
    const token = tokenOf(n.kind, n.id);
    tx(db, () => {
      addCoins(db, buyerId, -n.price, `купил(а) НФТ ${token}`);
      for (const p of payouts) addCoins(db, p.userId, p.coins, p.seller ? `продал(а) НФТ ${token}` : `доля правообладателя ${token}`);
      const blk = L.append(db, { kind: 'nft.sale', ref: token, actor: buyerId, data: { token, from: n.owner_id, to: buyerId, price: n.price, payouts: payouts.map((p) => ({ u: p.userId, c: p.coins })) } });
      db.prepare('INSERT INTO nft_trades (nft_id, seller_id, buyer_id, price, at, block) VALUES (?, ?, ?, ?, ?, ?)').run(n.id, n.owner_id, buyerId, n.price, Date.now(), blk.block);
      db.prepare('UPDATE nfts SET owner_id = ?, for_sale = 0 WHERE id = ?').run(buyerId, n.id);
    });
    const v = view(row(n.id), buyerId);
    onEvent('sale', { nft: v, sellerId: n.owner_id, buyerId, price: n.price, payouts });
    return { nft: v, payouts };
  }

  function setPrice(userId, id, b) {
    const n = row(id);
    if (!n) return { error: 'not_found' };
    if (n.owner_id !== userId) return { error: 'forbidden' };
    const price = b?.price == null ? n.price : Math.floor(Number(b.price));
    if (!(price >= PRICE_MIN && price <= PRICE_MAX)) return { error: 'bad_price' };
    const forSale = b?.forSale == null ? !!n.for_sale : !!b.forSale;
    tx(db, () => {
      db.prepare('UPDATE nfts SET price = ?, for_sale = ? WHERE id = ?').run(price, forSale ? 1 : 0, n.id);
      if (price !== n.price) L.append(db, { kind: 'nft.price', ref: tokenOf(n.kind, n.id), actor: userId, data: { token: tokenOf(n.kind, n.id), price } });
    });
    return { nft: view(row(n.id), userId) };
  }

  // Привязать вещь в реальном мире (кольцо, ожерелье…) с особым номером. Автор, пока НФТ у него и не продавалось.
  function setPhysical(userId, id, b) {
    const n = row(id);
    if (!n) return { error: 'not_found' };
    if (n.author_id !== userId || n.owner_id !== userId || db.prepare('SELECT 1 FROM nft_trades WHERE nft_id = ?').get(n.id)) return { error: 'forbidden' };
    if (n.physical_serial) return { error: 'already' };
    const ph = physicalFrom(b);
    if (ph.error || !ph.physical) return { error: ph.error || 'bad_physical' };
    tx(db, () => {
      db.prepare('UPDATE nfts SET physical_kind = ?, physical_serial = ?, physical_note = ? WHERE id = ?').run(ph.physical.kind, ph.physical.serial, ph.physical.note || null, n.id);
      L.append(db, { kind: 'nft.physical', ref: tokenOf(n.kind, n.id), actor: userId, data: { token: tokenOf(n.kind, n.id), physical: ph.physical } });
    });
    return { nft: view(row(n.id), userId) };
  }

  // Убрать: автор — пока не продавалось; администрация — всегда (запись в цепочке остаётся)
  function remove(userId, id, isAdmin) {
    const n = row(id);
    if (!n) return { error: 'not_found' };
    const sold = db.prepare('SELECT 1 FROM nft_trades WHERE nft_id = ?').get(n.id);
    if (!isAdmin && (n.author_id !== userId || n.owner_id !== userId || sold)) return { error: 'forbidden' };
    db.prepare('UPDATE nfts SET hidden = 1, for_sale = 0 WHERE id = ?').run(n.id);
    return { ok: true };
  }

  function list({ kind, owner, author, forSale, before }, viewerId) {
    const where = ['hidden = 0'];
    const args = [];
    if (KINDS[kind]) { where.push('kind = ?'); args.push(kind); }
    if (owner) { where.push('owner_id = ?'); args.push(owner); }
    if (author) { where.push('id IN (SELECT nft_id FROM nft_rights WHERE user_id = ?)'); args.push(author); }
    if (forSale) where.push('for_sale = 1');
    if (before) { where.push('id < ?'); args.push(before); }
    return db.prepare(`SELECT * FROM nfts WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT 40`).all(...args).map((r) => view(r, viewerId));
  }

  function full(id, viewerId) {
    const n = row(id);
    if (!n) return null;
    const v = view(n, viewerId);
    const trades = db.prepare('SELECT * FROM nft_trades WHERE nft_id = ? ORDER BY id').all(n.id).map((t) => ({
      sellerId: t.seller_id, sellerName: nameOf(t.seller_id), buyerId: t.buyer_id, buyerName: nameOf(t.buyer_id), price: t.price, at: t.at, block: t.block }));
    const blocks = db.prepare('SELECT * FROM ledger WHERE ref = ? ORDER BY id').all(v.token).map(L.blockView);
    return { ...v, tradeList: trades, blocks };
  }

  // рынок для биржи: оборот и сделки
  function market() {
    const day = Date.now() - 86_400_000;
    const d = db.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(price), 0) AS vol FROM nft_trades WHERE at > ?').get(day);
    const all = db.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(price), 0) AS vol FROM nft_trades').get();
    const last = db.prepare('SELECT t.*, n.kind, n.title FROM nft_trades t JOIN nfts n ON n.id = t.nft_id ORDER BY t.id DESC LIMIT 8').all().map((t) => ({
      token: tokenOf(t.kind, t.nft_id), title: t.title, price: t.price, at: t.at, buyerName: nameOf(t.buyer_id) }));
    return { trades24h: d.n, volume24h: d.vol, tradesAll: all.n, volumeAll: all.vol, nfts: db.prepare('SELECT COUNT(*) AS n FROM nfts WHERE hidden = 0').get().n,
      forSale: db.prepare('SELECT COUNT(*) AS n FROM nfts WHERE hidden = 0 AND for_sale = 1').get().n, last };
  }

  // гифка по ТЗ: с «мозгом» — ИИ, без него — словарь
  async function makeGif(brief) {
    const b = clean(brief, 300);
    if (!b || b.length < 2) return { error: 'bad_brief' };
    let out = null;
    try { out = gifFromAi(await ai?.complete?.({ system: GIF_RULES, schema: GIF_SCHEMA, prompt: `ТЗ на гифку: ${b}` })); } catch (e) { log('gif ai', e); }
    if (out) return { spec: out.spec, title: out.title || b.slice(0, 40), by: 'ai' };
    const spec = gifFromBrief(b);
    return spec ? { spec, title: b.slice(0, 40), by: 'rules' } : { error: 'bad_brief' };
  }

  // ---------- API ----------
  function mount(api, { auth, json, allow, isAdmin }) {
    const send = (res, r) => (r?.error ? res.status(r.error === 'not_found' ? 404 : r.error === 'forbidden' || r.error === 'own' ? 403 : 400).json(r) : res.json(r));

    api.post('/nft/media', auth, express.raw({ type: () => true, limit: '50mb' }), (req, res) => {
      if (!allow(`nftmedia:${req.userId}`, 30, 3_600_000)) return res.status(429).json({ error: 'too_many' });
      if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'bad_media' });
      send(res, saveMedia(req.userId, req.body));
    });
    api.get('/nft/media/:id', auth, (req, res) => {
      const m = MEDIA_RE.test(req.params.id) ? db.prepare('SELECT * FROM nft_media WHERE id = ?').get(req.params.id) : null;
      if (!m) return res.status(404).end();
      res.set('Content-Type', m.mime);
      res.set('Cache-Control', 'private, max-age=31536000, immutable');
      res.sendFile(path.join(dir, m.id), { acceptRanges: true }); // видео и музыка — кусками (iPhone так играет)
    });
    api.post('/gifs/make', auth, json, async (req, res) => {
      if (!allow(`gifmake:${req.userId}`, 30, 3_600_000)) return res.status(429).json({ error: 'too_many' });
      send(res, await makeGif(req.body?.brief));
    });
    api.get('/nft', auth, (req, res) => {
      const q = req.query;
      const who = q.mine === '1' ? req.userId : Number(q.owner) || 0;
      res.json({ items: list({ kind: q.kind, owner: who, author: q.authored === '1' ? req.userId : Number(q.author) || 0, forSale: q.sale === '1', before: Number(q.before) || 0 }, req.userId) });
    });
    api.get('/nft/:id', auth, (req, res) => {
      const v = full(Number(req.params.id), req.userId);
      if (!v) return res.status(404).json({ error: 'not_found' });
      res.json({ nft: v });
    });
    api.post('/nft', auth, json, (req, res) => {
      if (!allow(`nftmint:${req.userId}`, MINT_PER_DAY, 86_400_000)) return res.status(429).json({ error: 'too_many' });
      send(res, mint(req.userId, req.body));
    });
    api.post('/nft/:id/buy', auth, (req, res) => send(res, buy(req.userId, Number(req.params.id))));
    api.post('/nft/:id/price', auth, json, (req, res) => send(res, setPrice(req.userId, Number(req.params.id), req.body)));
    api.post('/nft/:id/physical', auth, json, (req, res) => send(res, setPhysical(req.userId, Number(req.params.id), req.body)));
    api.delete('/nft/:id', auth, (req, res) => send(res, remove(req.userId, Number(req.params.id), isAdmin(userRow(req.userId)))));
  }

  return { mount, mint, buy, setPrice, setPhysical, remove, list, full, market, makeGif, saveMedia, view };
}
