/* Вход: пароли, сессии, защита от перебора.
   Пароль хранится так же, как в штабе до переезда, — PBKDF2-SHA256,
   150 000 итераций, соль — строка base64 — поэтому старые пароли подходят.
   Сессия — случайный ключ в cookie (HttpOnly); на диске лежит только его
   отпечаток, сам ключ есть только у браузера. */

'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const normEmail = s => String(s || '').trim().toLowerCase();
const normCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^(.{4})(.+)$/, '$1-$2');
const uid = () => Date.now().toString(36) + crypto.randomBytes(4).toString('hex').slice(0, 6);
const newSalt = () => crypto.randomBytes(16).toString('base64');
function makeCode() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += abc[crypto.randomInt(abc.length)];
  return s.slice(0, 4) + '-' + s.slice(4);
}

function pbkdf2(pw, salt) {
  return new Promise((resolve, reject) => crypto.pbkdf2(String(pw), Buffer.from(String(salt), 'utf8'), 150000, 32, 'sha256',
    (e, key) => (e ? reject(e) : resolve('pbkdf2$' + key.toString('base64')))));
}
/* запасной способ из старых браузеров без WebCrypto — только чтобы такие учётки смогли войти */
function weak(pw, salt) {
  let h = 5381;
  const s = salt + '|' + pw;
  for (let r = 0; r < 20000; r++) for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return 'weak$' + h.toString(36);
}
const hashPassword = pbkdf2;
function same(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
/* → false | 'ok' | 'weak' (вошёл по слабому отпечатку — пора пересчитать) */
async function verify(pw, salt, hash) {
  if (!salt || !hash) return false;
  if (String(hash).startsWith('weak$')) return same(weak(pw, salt), hash) ? 'weak' : false;
  return same(await pbkdf2(pw, salt), hash) ? 'ok' : false;
}

/* ── сессии ── */
const fingerprint = token => crypto.createHash('sha256').update(String(token)).digest('hex');
class Sessions {
  constructor(file, {ttlDays = 30} = {}) {
    this.file = file;
    this.ttl = ttlDays * 864e5;
    this.map = {};
    this.timer = null;
    try { this.map = JSON.parse(fs.readFileSync(file, 'utf8')) || {}; } catch (e) { this.map = {}; }
    this.sweep();
  }
  save(now) {
    clearTimeout(this.timer);
    const run = () => {
      fs.mkdirSync(path.dirname(this.file), {recursive: true});
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.map), {mode: 0o600});
      fs.renameSync(tmp, this.file);
    };
    if (now) run(); else this.timer = setTimeout(run, 500);
  }
  sweep() {
    const now = Date.now();
    let n = 0;
    Object.entries(this.map).forEach(([k, s]) => { if (!s || s.exp < now) { delete this.map[k]; n++; } });
    if (n) this.save();
  }
  create(accId) {
    const token = crypto.randomBytes(32).toString('base64url');
    this.map[fingerprint(token)] = {acc: accId, at: Date.now(), exp: Date.now() + this.ttl};
    this.save();
    return token;
  }
  get(token) {
    if (!token) return null;
    const k = fingerprint(token), s = this.map[k];
    if (!s) return null;
    if (s.exp < Date.now()) { delete this.map[k]; this.save(); return null; }
    /* продлеваем не чаще раза в сутки — чтобы не писать на диск на каждый запрос */
    if (s.exp - Date.now() < this.ttl - 864e5) { s.exp = Date.now() + this.ttl; this.save(); }
    return s;
  }
  drop(token) { if (token && this.map[fingerprint(token)]) { delete this.map[fingerprint(token)]; this.save(); } }
  dropFor(accId, exceptToken) {
    const keep = exceptToken ? fingerprint(exceptToken) : '';
    let n = 0;
    Object.entries(this.map).forEach(([k, s]) => { if (s.acc === accId && k !== keep) { delete this.map[k]; n++; } });
    if (n) this.save();
  }
  clear() { this.map = {}; this.save(true); }
}

/* ── перебор паролей: не больше max неудач за окно на один ключ ── */
class Limiter {
  constructor({max = 8, windowMs = 15 * 60e3} = {}) { this.max = max; this.win = windowMs; this.map = new Map(); }
  blocked(key) {
    const x = this.map.get(key);
    if (!x) return 0;
    if (Date.now() - x.at > this.win) { this.map.delete(key); return 0; }
    return x.n >= this.max ? Math.ceil((x.at + this.win - Date.now()) / 60e3) : 0;
  }
  fail(key) {
    const x = this.map.get(key);
    if (!x || Date.now() - x.at > this.win) this.map.set(key, {n: 1, at: Date.now()});
    else x.n++;
    if (this.map.size > 5000) [...this.map.keys()].slice(0, 1000).forEach(k => this.map.delete(k));
  }
  ok(key) { this.map.delete(key); }
}

function readCookie(req, name) {
  const m = new RegExp('(?:^|;\\s*)' + name + '=([^;]+)').exec(req.headers.cookie || '');
  return m ? decodeURIComponent(m[1]) : '';
}

module.exports = {normEmail, normCode, uid, newSalt, makeCode, hashPassword, verify, Sessions, Limiter, readCookie, same};
