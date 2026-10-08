/* АСЬКА — безопасность: пароли, чистка текста, проверка ссылок и номеров.
   Общий модуль для всех дизайнов.

   Пароли больше не хранятся открытым текстом: PBKDF2-SHA256, 120 000
   итераций, своя соль на каждый аккаунт. Старые аккаунты переводятся на хеш
   при первом удачном входе. Если WebCrypto нет (страница открыта не по
   https), считаем тем же алгоритмом на чистом JS — медленнее, но совместимо. */
(function () {
  'use strict';

  const ITER = 120000;
  const ALG = 'pbkdf2-sha256';
  const enc = new TextEncoder();
  const subtle = window.crypto && window.crypto.subtle && window.isSecureContext !== false ? window.crypto.subtle : null;

  const b64 = (u8) => btoa(String.fromCharCode.apply(null, Array.from(u8)));
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  function randomBytes(n) {
    const out = new Uint8Array(n);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(out);
    else for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
    return out;
  }
  const token = (n) => Array.from(randomBytes(n || 16), (b) => (b < 16 ? '0' : '') + b.toString(16)).join('');

  /* ---------- SHA-256 / HMAC / PBKDF2 на JS (запасной путь) ---------- */
  const K = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  function sha256(bytes) {
    const l = bytes.length, nb = ((l + 9 + 63) >> 6) << 6;
    const m = new Uint8Array(nb); m.set(bytes); m[l] = 0x80;
    const dv = new DataView(m.buffer); dv.setUint32(nb - 4, l * 8); dv.setUint32(nb - 8, Math.floor(l / 0x20000000));
    const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    const W = new Uint32Array(64);
    for (let o = 0; o < nb; o += 64) {
      for (let i = 0; i < 16; i++) W[i] = dv.getUint32(o + i * 4);
      for (let i = 16; i < 64; i++) {
        const a = W[i - 15], b = W[i - 2];
        const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
        const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
        W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
      }
      let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (let i = 0; i < 64; i++) {
        const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        const t1 = (h + S1 + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
        const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
    }
    const out = new Uint8Array(32); const ov = new DataView(out.buffer);
    for (let i = 0; i < 8; i++) ov.setUint32(i * 4, H[i]);
    return out;
  }
  function hmacFactory(key) {
    if (key.length > 64) key = sha256(key);
    const ip = new Uint8Array(64), op = new Uint8Array(64);
    for (let i = 0; i < 64; i++) { ip[i] = (key[i] || 0) ^ 0x36; op[i] = (key[i] || 0) ^ 0x5c; }
    return (msg) => { const a = new Uint8Array(64 + msg.length); a.set(ip); a.set(msg, 64); const inner = sha256(a); const b = new Uint8Array(96); b.set(op); b.set(inner, 64); return sha256(b); };
  }
  function pbkdf2js(pass, salt, iter) {
    const mac = hmacFactory(pass);
    const s = new Uint8Array(salt.length + 4); s.set(salt); s[salt.length + 3] = 1;
    let u = mac(s); const t = u.slice();
    for (let i = 1; i < iter; i++) { u = mac(u); for (let j = 0; j < 32; j++) t[j] ^= u[j]; }
    return t;
  }
  async function derive(pass, salt, iter) {
    const p = enc.encode(String(pass));
    if (subtle) {
      try {
        const key = await subtle.importKey('raw', p, 'PBKDF2', false, ['deriveBits']);
        return new Uint8Array(await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256));
      } catch (err) { /* падаем на JS-реализацию */ }
    }
    return pbkdf2js(p, salt, iter);
  }
  function sameBytes(a, b) {
    if (a.length !== b.length) return false;
    let x = 0; for (let i = 0; i < a.length; i++) x |= a[i] ^ b[i];
    return x === 0;
  }

  async function hashPassword(pass) {
    const salt = randomBytes(16);
    const h = await derive(pass, salt, ITER);
    return { a: ALG, i: ITER, s: b64(salt), h: b64(h) };
  }
  // true/false; старый аккаунт с открытым паролем тоже проверяется (и потом переводится на хеш)
  async function verifyPassword(acc, pass) {
    if (!acc) return false;
    const pw = acc.pw;
    if (pw && pw.a === ALG && pw.s && pw.h) {
      try { return sameBytes(await derive(pass, unb64(pw.s), pw.i || ITER), unb64(pw.h)); } catch (err) { return false; }
    }
    if (typeof acc.pass === 'string') return sameBytes(enc.encode(acc.pass), enc.encode(String(pass)));
    return false;
  }
  const needsUpgrade = (acc) => !!acc && (!acc.pw || acc.pw.a !== ALG || (acc.pw.i || 0) < ITER || typeof acc.pass === 'string');

  /* ---------- перебор пароля: растущая пауза после ошибок ---------- */
  const TRY_KEY = 'aska.tries';
  function tries() { try { return JSON.parse(sessionStorage.getItem(TRY_KEY) || '{}') || {}; } catch (err) { return {}; } }
  function lockLeft(id) { const t = tries()[id]; if (!t || t.n < 3) return 0; const wait = Math.min(60000, 1000 * Math.pow(2, t.n - 3)); return Math.max(0, t.ts + wait - Date.now()); }
  function noteFail(id) { const all = tries(); const t = all[id] || { n: 0, ts: 0 }; all[id] = { n: t.n + 1, ts: Date.now() }; try { sessionStorage.setItem(TRY_KEY, JSON.stringify(all)); } catch (err) {} }
  function noteOk(id) { const all = tries(); delete all[id]; try { sessionStorage.setItem(TRY_KEY, JSON.stringify(all)); } catch (err) {} }

  /* ---------- текст ---------- */
  // управляющие символы, «переворачиватели» текста (bidi) и невидимые пробелы:
  // через них подделывают ники («админ» с невидимкой) и ломают вёрстку
  const BAD = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f​-‏‪-‮⁠-⁤⁦-⁯﻿￹-￻]/g;
  function cleanText(s, max) {
    let t = String(s == null ? '' : s).replace(/\r\n?/g, '\n').replace(BAD, '');
    t = t.replace(/\n{4,}/g, '\n\n\n').trim();
    // «зальго»: десятки диакритик над одной буквой
    t = t.replace(/([̀-ͯ҃-҉᪰-᫿᷀-᷿⃐-⃿︠-︯]{3})[̀-ͯ҃-҉᪰-᫿᷀-᷿⃐-⃿︠-︯]+/g, '$1');
    return max ? Array.from(t).slice(0, max).join('') : t;
  }
  const cleanLine = (s, max) => cleanText(s, 0).replace(/\s+/g, ' ').slice(0, max || 200).trim();
  const cleanNick = (s) => cleanLine(s, 24);

  /* ---------- ссылки и номера ---------- */
  // только http(s): никаких javascript:, data: и прочих сюрпризов в href/src
  function safeUrl(u) {
    const s = String(u || '').trim();
    if (!s) return '';
    try { const x = new URL(s, location.href); return x.protocol === 'https:' || x.protocol === 'http:' ? x.href : ''; } catch (err) { return ''; }
  }
  const isUin = (s) => /^(tw)?\d{3,9}$/.test(String(s || ''));
  const isId = (s) => /^[\w-]{1,64}$/.test(String(s || ''));

  window.AskaSecure = { hashPassword, verifyPassword, needsUpgrade, lockLeft, noteFail, noteOk, cleanText, cleanLine, cleanNick, safeUrl, isUin, isId, token, ITER, _sha256: sha256, _pbkdf2js: pbkdf2js };
})();
