// Телефоны и СМС-коды. СМС отправляет SMS.ru — ключ администратор вставляет в настройках АСЬКИ.
// Пока ключа нет, телефон просто запоминается, а восстановить вход помогает администратор.
import crypto from 'node:crypto';
import { getSetting, setSetting } from './db.js';

// «8 (999) 123-45-67», «+7 999 1234567», «9991234567» → «+79991234567»
export function normalizePhone(s) {
  const raw = String(s || '').trim();
  let d = raw.replace(/\D/g, '');
  if (d.length === 11 && d[0] === '8') d = `7${d.slice(1)}`;
  else if (d.length === 10 && d[0] === '9') d = `7${d}`;
  if (d.length < 11 || d.length > 15) return null;
  if (d[0] === '7' && d.length !== 11) return null;
  return `+${d}`;
}

export const looksLikePhone = (s) => /^\s*(\+|8|7|9)?[\d\s()\-]{9,}\s*$/.test(String(s || '')) && normalizePhone(s) !== null;

// +79991234567 → «+7 999 ***-**-67»
export function maskPhone(p) {
  if (!p) return '';
  if (p.startsWith('+7') && p.length === 12) return `+7 ${p.slice(2, 5)} ***-**-${p.slice(10)}`;
  return `${p.slice(0, 4)}…${p.slice(-2)}`;
}

export function formatPhone(p) {
  if (p && p.startsWith('+7') && p.length === 12) return `+7 ${p.slice(2, 5)} ${p.slice(5, 8)}-${p.slice(8, 10)}-${p.slice(10)}`;
  return p || '';
}

export function createSms({ db, sender, log = console.log, fetchImpl = globalThis.fetch }) {
  const conf = () => JSON.parse(getSetting(db, 'sms') || '{}');
  let lastError = '';

  function configured() {
    return Boolean(sender) || Boolean(conf().apiId);
  }

  async function send(phone, text) {
    if (sender) return sender(phone, text);
    const { apiId } = conf();
    if (!apiId) throw new Error('sms_off');
    const url = `https://sms.ru/sms/send?api_id=${encodeURIComponent(apiId)}&to=${encodeURIComponent(phone.slice(1))}&msg=${encodeURIComponent(text)}&json=1`;
    let r;
    try {
      r = await (await fetchImpl(url, { signal: AbortSignal.timeout(15000) })).json();
    } catch (e) {
      lastError = 'нет связи с SMS.ru';
      throw new Error('sms_failed');
    }
    const one = r?.sms ? Object.values(r.sms)[0] : null;
    if (r?.status !== 'OK' || one?.status !== 'OK') {
      lastError = one?.status_text || r?.status_text || 'SMS.ru отказал';
      log('sms error', lastError);
      throw new Error('sms_failed');
    }
    lastError = '';
  }

  async function balance() {
    const { apiId } = conf();
    if (!apiId) return { ok: false, error: 'Ключ SMS.ru не задан' };
    try {
      const r = await (await fetchImpl(`https://sms.ru/my/balance?api_id=${encodeURIComponent(apiId)}&json=1`, { signal: AbortSignal.timeout(15000) })).json();
      if (r?.status === 'OK') return { ok: true, balance: r.balance };
      return { ok: false, error: r?.status_text || 'Ключ не подошёл' };
    } catch {
      return { ok: false, error: 'Нет связи с SMS.ru' };
    }
  }

  function setConfig(patch) {
    const c = { ...conf(), ...patch };
    if (!c.apiId) delete c.apiId;
    setSetting(db, 'sms', JSON.stringify(c));
  }

  return { configured, send, balance, setConfig, status: () => ({ configured: configured(), lastError, hasKey: Boolean(conf().apiId) }) };
}

// Одноразовые коды: 4 цифры, 10 минут, 5 попыток.
export function createCodes({ db, secret }) {
  const hash = (code) => crypto.createHmac('sha256', secret).update(`code:${code}`).digest('hex');

  function issue(phone, purpose) {
    const code = String(crypto.randomInt(10000)).padStart(4, '0');
    const now = Date.now();
    db.prepare(`INSERT INTO phone_codes (phone, purpose, code_hash, expires_at, attempts, created_at) VALUES (?, ?, ?, ?, 0, ?)
      ON CONFLICT(phone, purpose) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0, created_at = excluded.created_at`)
      .run(phone, purpose, hash(code), now + 10 * 60_000, now);
    return code;
  }

  function check(phone, purpose, code) {
    const row = db.prepare('SELECT * FROM phone_codes WHERE phone = ? AND purpose = ?').get(phone, purpose);
    if (!row || row.expires_at < Date.now() || row.attempts >= 5) return false;
    const ok = crypto.timingSafeEqual(Buffer.from(hash(String(code || '').replace(/\D/g, ''))), Buffer.from(row.code_hash));
    if (!ok) {
      db.prepare('UPDATE phone_codes SET attempts = attempts + 1 WHERE phone = ? AND purpose = ?').run(phone, purpose);
      return false;
    }
    db.prepare('DELETE FROM phone_codes WHERE phone = ? AND purpose = ?').run(phone, purpose);
    return true;
  }

  // Подтверждённый телефон — подписанный «билетик» на 20 минут: его приносят в регистрацию или восстановление.
  function ticket(phone, purpose) {
    const exp = Date.now() + 20 * 60_000;
    const body = `${purpose}|${phone}|${exp}`;
    return `${Buffer.from(body).toString('base64url')}.${crypto.createHmac('sha256', secret).update(`ticket:${body}`).digest('base64url')}`;
  }

  function readTicket(t, purpose) {
    const [b, sig] = String(t || '').split('.');
    if (!b || !sig) return null;
    const body = Buffer.from(b, 'base64url').toString();
    const want = crypto.createHmac('sha256', secret).update(`ticket:${body}`).digest('base64url');
    if (want.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return null;
    const [p, phone, exp] = body.split('|');
    if (p !== purpose || Number(exp) < Date.now()) return null;
    return phone;
  }

  // Код от администратора (когда СМС нет): 8 символов, сутки, 5 попыток
  function issueHelp(userId) {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (const b of crypto.randomBytes(8)) code += alphabet[b % alphabet.length];
    db.prepare(`INSERT INTO help_codes (user_id, code_hash, expires_at, attempts) VALUES (?, ?, ?, 0)
      ON CONFLICT(user_id) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0`)
      .run(userId, hash(code), Date.now() + 86_400_000);
    return `${code.slice(0, 4)}-${code.slice(4)}`;
  }

  function checkHelp(userId, code) {
    const row = db.prepare('SELECT * FROM help_codes WHERE user_id = ?').get(userId);
    if (!row || row.expires_at < Date.now() || row.attempts >= 5) return false;
    const norm = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!crypto.timingSafeEqual(Buffer.from(hash(norm)), Buffer.from(row.code_hash))) {
      db.prepare('UPDATE help_codes SET attempts = attempts + 1 WHERE user_id = ?').run(userId);
      return false;
    }
    db.prepare('DELETE FROM help_codes WHERE user_id = ?').run(userId);
    return true;
  }

  return { issue, check, ticket, readTicket, issueHelp, checkHelp };
}
