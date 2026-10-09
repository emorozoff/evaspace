/* Одна ссылка на человека — и для анкеты, и для рефералки.
   Ссылка анкеты:  <анкета>#k.ANNA482          k — клиентка, e — эксперт, p — партнёр, a — амбассадор
                   <анкета>#k.ANNA482.q…       хвост .q… — вопросы, которые команда добавила или скрыла
   Ответы назад:   <CRM>#in.z…                 z — сжатые ответы, j — без сжатия
   В адресе после # разрешены только буквы, цифры и . _ ~ - — поэтому
   данные упакованы в base64url. */

const Codec = {
  b64(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  unb64(str) {
    let b = String(str).replace(/-/g, '+').replace(/_/g, '/');
    while (b.length % 4) b += '=';
    const bin = atob(b);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },
  encJson(obj) { return this.b64(new TextEncoder().encode(JSON.stringify(obj))); },
  decJson(str) { return JSON.parse(new TextDecoder().decode(this.unb64(str))); },
  /* сжатие, где браузер умеет (CompressionStream); иначе — как есть */
  async pack(obj) {
    const raw = new TextEncoder().encode(JSON.stringify(obj));
    try {
      if (typeof CompressionStream === 'function') {
        const cs = new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'));
        const buf = new Uint8Array(await new Response(cs).arrayBuffer());
        if (buf.length < raw.length) return 'z' + this.b64(buf);
      }
    } catch (e) { /* ниже — без сжатия */ }
    return 'j' + this.b64(raw);
  },
  async unpack(str) {
    const s = String(str || '').trim();
    const body = s.slice(1);
    if (s[0] === 'j') return JSON.parse(new TextDecoder().decode(this.unb64(body)));
    if (s[0] === 'z') {
      const ds = new Blob([this.unb64(body)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return JSON.parse(await new Response(ds).text());
    }
    throw new Error('Не похоже на ответы анкеты');
  },
  /* разбор хвоста ссылки анкеты: k.ANNA482.q… */
  parseAnketaHash(h) {
    const parts = String(h || '').replace(/^#/, '').split('.');
    const type = TYPE_BY_LETTER[parts[0]] || null;
    const code = parts[1] && /^[A-Za-z0-9_-]{2,40}$/.test(parts[1]) ? parts[1].toUpperCase() : '';
    let diff = null;
    const q = parts.find((p, i) => i >= 2 && p[0] === 'q');
    if (q) { try { diff = this.decJson(q.slice(1)); } catch (e) { diff = null; } }
    return {type, code, diff};
  },
  /* найти ответы в любом тексте: ссылке, сообщении из Telegram, чистом коде */
  findPayload(text) {
    const s = String(text || '');
    const m = s.match(/#in\.([zj][A-Za-z0-9_-]+)/) || s.match(/\bin\.([zj][A-Za-z0-9_-]{20,})/) || s.match(/^\s*([zj][A-Za-z0-9_-]{20,})\s*$/);
    return m ? m[1] : null;
  },
};

/* вопросы анкеты с учётом правок команды: скрытые убираем, изменённые
   подменяем, новые добавляем в конец */
function applyDiff(type, diff) {
  const base = (Q_DEFAULT[type] || {test: []}).test.map(q => ({...q}));
  if (!diff) return base;
  const hide = new Set(diff.h || []);
  const changed = Object.fromEntries((diff.c || []).map(q => [q.id, q]));
  const out = base.filter(q => !hide.has(q.id)).map(q => (changed[q.id] ? {...q, ...changed[q.id]} : q));
  (diff.c || []).forEach(q => { if (!base.some(b => b.id === q.id) && !hide.has(q.id)) out.push(q); });
  if (Array.isArray(diff.s)) { const pos = id => { const i = diff.s.indexOf(id); return i < 0 ? 999 : i; }; out.sort((a, b) => pos(a.id) - pos(b.id)); }
  return out;
}
/* ответ вопроса «как текст»: индексы вариантов → подписи */
function answerLabels(q, v) {
  if (v === undefined || v === null || v === '') return [];
  if (q.k === 'one') return [typeof v === 'number' ? (q.o || [])[v] : v].filter(x => x !== undefined);
  if (q.k === 'many') return (Array.isArray(v) ? v : [v]).map(x => (typeof x === 'number' ? (q.o || [])[x] : x)).filter(x => x !== undefined);
  if (q.k === 'scale') return [`${SCALE_EMO[(v | 0) - 1] || ''} ${v} из 5`];
  return [String(v)];
}
