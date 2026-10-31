// 📞 Аудиозвонки: 1:1 и групповые. Звук идёт напрямую между телефонами (WebRTC, шифрование DTLS-SRTP).
// Сервер только знакомит телефоны: кто в звонке, кому звонит, и передаёт им сигналы — а сами сигналы
// (SDP и ICE) зашифрованы на телефоне ключом собеседника (nacl box), поэтому сервер не может подменить
// отпечаток шифрования и подслушать. Состояние звонков — в памяти: перезапуск сервера звонки обрывает.
// Боты (Аська, Батя, ИИ-люди, личные ИИ) в звонках не участвуют: им не звонит, они «не отвечают».

export const CALL_MAX = 8;          // участников в одном звонке (каждый связан с каждым)
export const RING_MS = 45_000;      // сколько звонит, если никто не взял
export const RING_GROUP_LIMIT = 12; // в больших группах не звоним всем — только плашка «Присоединиться»

export function createCalls({ db, memberIds, userRow, sendTo, notify, isVisible, log = () => {}, ringMs = RING_MS }) {
  const calls = new Map(); // chatId -> { id, chatId, by, at, members: Map<userId, joinedAt>, ringing: Set<userId>, timer }

  const chatRow = (chatId) => db.prepare('SELECT id, kind, title, emoji, is_public AS isPublic, biz FROM chats WHERE id = ?').get(chatId);
  const isHuman = (id) => userRow(id)?.kind === 'human';
  const humansOf = (chatId) => memberIds(chatId).filter(isHuman);

  // Звонить можно в личке и в группах, где есть хотя бы ещё один человек (не боту и не личному ИИ)
  function canCall(userId, chatId) {
    const chat = chatRow(chatId);
    if (!chat || chat.kind === 'twin') return false;
    const members = memberIds(chatId);
    if (!members.includes(userId) || !isHuman(userId) || userRow(userId)?.blocked_at) return false;
    // в личке — с человеком; ИИ-людям тоже можно позвонить (игра «Кто здесь ИИ?»): у них просто никто не возьмёт трубку
    if (chat.kind === 'dm') return members.some((id) => id !== userId && ['human', 'person'].includes(userRow(id)?.kind));
    return members.length >= 2;
  }

  const view = (c) => ({ id: c.id, chatId: c.chatId, by: c.by, at: c.at, members: [...c.members.keys()], ringing: [...c.ringing] });
  const tell = (c, obj, except) => { for (const id of memberIds(c.chatId)) if (id !== except) sendTo(id, obj); };
  const update = (c) => tell(c, { type: 'call', call: view(c) });

  function end(c, reason = 'end') {
    clearTimeout(c.timer);
    calls.delete(c.chatId);
    tell(c, { type: 'call_end', chatId: c.chatId, id: c.id, reason });
  }

  function ring(c, from) {
    const chat = chatRow(c.chatId);
    const targets = humansOf(c.chatId).filter((id) => id !== from && !c.members.has(id) && !userRow(id)?.blocked_at);
    // общий чат и большие группы не обзваниваем — там плашка «Идёт звонок · Присоединиться»
    if (chat.kind === 'general' || (chat.kind !== 'dm' && targets.length > RING_GROUP_LIMIT)) return;
    const caller = userRow(from);
    for (const id of targets) {
      c.ringing.add(id);
      if (!isVisible(id)) {
        const data = { t: 'c', c: c.chatId, s: from, sn: caller?.display_name || 'Кто-то', g: chat.kind === 'dm' ? 0 : 1 };
        Promise.resolve(notify(id, data)).catch((e) => log('call push', e));
      }
    }
  }

  // Начать звонок или войти в уже идущий в этой беседе
  function start(userId, chatId) {
    if (!canCall(userId, chatId)) return { error: 'forbidden' };
    const existing = calls.get(chatId);
    if (existing) return join(userId, chatId);
    const c = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, chatId, by: userId, at: Date.now(), members: new Map([[userId, Date.now()]]), ringing: new Set() };
    calls.set(chatId, c);
    ring(c, userId);
    // никто не взял — звонок заканчивается
    c.timer = setTimeout(() => { if (calls.get(chatId) === c && c.members.size < 2) end(c, 'no_answer'); }, ringMs);
    c.timer.unref?.();
    update(c);
    return { call: view(c) };
  }

  function join(userId, chatId) {
    const c = calls.get(chatId);
    if (!c) return { error: 'no_call' };
    if (!canCall(userId, chatId)) return { error: 'forbidden' };
    if (!c.members.has(userId) && c.members.size >= CALL_MAX) return { error: 'full' };
    c.members.set(userId, Date.now());
    c.ringing.delete(userId);
    update(c);
    return { call: view(c) };
  }

  function leave(userId, chatId) {
    const c = calls.get(chatId);
    if (!c || !c.members.has(userId)) return;
    c.members.delete(userId);
    const chat = chatRow(chatId);
    // в личке звонок кончается, когда один положил трубку; в группе — когда никого не осталось
    if (!c.members.size || (chat?.kind === 'dm' && c.members.size < 2)) end(c, 'end');
    else update(c);
  }

  function decline(userId, chatId) {
    const c = calls.get(chatId);
    if (!c || !c.ringing.has(userId)) return;
    c.ringing.delete(userId);
    const chat = chatRow(chatId);
    if (chat?.kind === 'dm' && c.members.size < 2) end(c, 'declined');
    else update(c);
  }

  // Передать зашифрованный сигнал другому участнику звонка. Сервер его не читает.
  function signal(userId, chatId, to, data) {
    const c = calls.get(chatId);
    if (!c || !c.members.has(userId) || !c.members.has(to) || to === userId) return false;
    if (!data || typeof data.n !== 'string' || typeof data.c !== 'string' || data.n.length > 64 || data.c.length > 24_000) return false;
    sendTo(to, { type: 'call_signal', chatId, from: userId, data: { n: data.n, c: data.c } });
    return true;
  }

  // Человек закрыл приложение — выходит из звонков
  function dropUser(userId) {
    for (const c of [...calls.values()]) {
      if (c.members.has(userId)) leave(userId, c.chatId);
      else if (c.ringing.has(userId)) { /* пусть звонит дальше: может, откроет приложение */ }
    }
  }

  const listFor = (userId) => [...calls.values()].filter((c) => memberIds(c.chatId).includes(userId)).map(view);
  const stop = () => { for (const c of calls.values()) clearTimeout(c.timer); calls.clear(); };

  return { start, join, leave, decline, signal, dropUser, listFor, canCall, stop, get: (chatId) => (calls.get(chatId) ? view(calls.get(chatId)) : null) };
}
