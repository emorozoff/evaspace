// Состояние приложения и связь с сервером: синхронизация, отправка, прочтение, пуши.
import { api, ApiError, setToken, getToken } from './api.ts';
import * as C from './crypto.ts';
import { encodeOutgoing, decodeIncoming } from './protocol.ts';
import type { Body, ServerRow } from './protocol.ts';
import { kvGet, kvSet, allMessages, putMessages, wipeLocal } from './db.ts';
import type { LocalUser, LocalChat, StoredMsg, Session, Keys } from './db.ts';
import { prepareImage } from './images.ts';
import { setBadge, pushSupported } from './platform.ts';

export type Chat = LocalChat;
export type User = LocalUser;
export interface Msg extends StoredMsg { status?: 'sending' | 'failed'; localImage?: string }
export type PushState = 'unsupported' | 'default' | 'denied' | 'subscribed';
export interface Profile { isAdmin: boolean; phone: string | null; phoneVerified: boolean; allowAnon: boolean; plate: string | null }
export type Truth = 'ai' | 'human';

export interface State {
  phase: 'loading' | 'welcome' | 'ready';
  me: Session | null;
  users: Record<number, User>;
  chats: Record<string, Chat>;
  messages: Record<string, Msg[]>;
  connected: boolean;
  presence: Record<number, boolean>;
  vapidKey: string | null;
  pushState: PushState;
  profile: Profile | null;
  pins: number[];
  guesses: Record<number, Truth>;      // кого я уже угадал(а) в игре «Кто здесь ИИ?» и что оказалось
  features: { ai: boolean; sms: boolean };
  typing: Record<string, Record<number, number>>; // чат → кто печатает → когда
  welcomePlate: string | null;         // только что выданный номер — показать поздравление
}

const initial: State = {
  phase: 'loading', me: null, users: {}, chats: {}, messages: {}, connected: false, presence: {}, vapidKey: null, pushState: 'default',
  profile: null, pins: [], guesses: {}, features: { ai: false, sms: false }, typing: {}, welcomePlate: null,
};

let state: State = initial;
const listeners = new Set<() => void>();
function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

// Новое входящее сообщение, пришедшее прямо сейчас (не из истории): для звука и всплывашки.
const incomingListeners = new Set<(m: Msg) => void>();
export function onIncoming(l: (m: Msg) => void) {
  incomingListeners.add(l);
  return () => { incomingListeners.delete(l); };
}

// Друг только что появился в сети — для звука «User is online» и всплывашки.
const onlineListeners = new Set<(userId: number) => void>();
export function onFriendOnline(l: (userId: number) => void) {
  onlineListeners.add(l);
  return () => { onlineListeners.delete(l); };
}

export function activeChatId() {
  return activeChat;
}

export const store = {
  subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); },
  get: () => state,
};

let sk: Uint8Array | null = null;
let lastSeq = 0;
const known = new Set<number>();
let tempCounter = 0;
const TEMP_BASE = 1e15;

// ---------- вход ----------

export async function start() {
  const [session, keys] = await Promise.all([kvGet('session'), kvGet('keys')]);
  if (!session || !keys) return set({ phase: 'welcome' });
  await enter(session, keys);
}

async function enter(session: Session, keys: Keys) {
  setToken(session.token);
  sk = C.fromB64(keys.sk);
  const [users, chats, msgs, seq] = await Promise.all([kvGet('users'), kvGet('chats'), allMessages(), kvGet('lastSeq')]);
  lastSeq = seq || 0;
  const messages: Record<string, Msg[]> = {};
  for (const m of msgs.sort((a, b) => a.id - b.id)) {
    known.add(m.id);
    (messages[m.chatId] ||= []).push(m);
  }
  set({ phase: 'ready', me: session, users: users || {}, chats: chats || {}, messages });
  updateBadge();
  connect();
}

async function saveCredentials(session: Session, keys: Keys) {
  await wipeLocal();
  await kvSet('session', session);
  await kvSet('keys', keys);
  await kvSet('lastSeq', 0);
}

export async function checkInvite(code: string) {
  return api.get<{ ok: boolean; invitedBy: string | null; sms: boolean }>(`/invites/${encodeURIComponent(code)}`);
}

export const smsAvailable = () => api.get<{ sms: boolean }>('/features').then((r) => r.sms);

// Код по СМС. mode: 'sms' — код отправлен, 'none' — СМС не подключены (тогда кода не будет)
export function sendCode(phone: string, purpose: 'register' | 'link' | 'recover', invite?: string) {
  return api.post<{ mode: 'sms' | 'none' }>('/phone/send', { phone, purpose, invite });
}
export function verifyCode(phone: string, purpose: 'register' | 'link' | 'recover', code: string) {
  return api.post<{ ticket: string }>('/phone/verify', { phone, purpose, code }).then((r) => r.ticket);
}

// Новый пароль → новые ключи шифрования (секретный ключ уходит на сервер только зашифрованным паролем)
async function newKeys(password: string, onProgress?: (p: number) => void) {
  const kp = C.generateKeyPair();
  const salt = C.randomBytes(16);
  const { encKey, authKey } = await C.deriveFromPassword(password, salt, onProgress);
  return {
    kp,
    body: { boxPk: C.toB64(kp.pk), kdfSalt: C.toB64(salt), authKey: C.toB64(authKey), backup: C.sealSecret(kp.sk, encKey) },
    keys: { pk: C.toB64(kp.pk), sk: C.toB64(kp.sk) },
  };
}

export async function register(
  f: { invite: string; displayName: string; phone: string; phoneTicket?: string; password: string },
  onProgress?: (p: number) => void,
) {
  const k = await newKeys(f.password, onProgress);
  const r = await api.post<{ token: string; userId: number; plate: string; username: string }>('/register', {
    invite: f.invite, displayName: f.displayName, phone: f.phone, phoneTicket: f.phoneTicket, ...k.body,
  });
  const session = { token: r.token, userId: r.userId, username: r.username };
  await saveCredentials(session, k.keys);
  state = { ...state, welcomePlate: r.plate };
  await enter(session, k.keys);
}

// Вход по телефону, номеру АСЬКИ (А 001 МР 777) или старому логину
export async function login(loginName: string, password: string, onProgress?: (p: number) => void) {
  const l = loginName.trim();
  const { salt } = await api.get<{ salt: string }>(`/salt?login=${encodeURIComponent(l)}`);
  const { encKey, authKey } = await C.deriveFromPassword(password, C.fromB64(salt), onProgress);
  const r = await api.post<{ token: string; userId: number; username: string; boxPk: string; backup: C.Sealed }>('/login', {
    login: l, authKey: C.toB64(authKey),
  });
  const secret = C.openSecret(r.backup, encKey);
  if (!secret || C.toB64(C.publicFromSecret(secret)) !== r.boxPk) throw new Error('backup_broken');
  const session = { token: r.token, userId: r.userId, username: r.username };
  const keys = { pk: r.boxPk, sk: C.toB64(secret) };
  await saveCredentials(session, keys);
  await enter(session, keys);
}

// Не помню пароль: билет после кода из СМС или код от администратора → новый пароль и новые ключи
export async function recover(
  f: { ticket?: string; login?: string; helpCode?: string; password: string },
  onProgress?: (p: number) => void,
) {
  const k = await newKeys(f.password, onProgress);
  const r = await api.post<{ token: string; userId: number; username: string }>('/recover', {
    ticket: f.ticket, login: f.login, helpCode: f.helpCode, ...k.body,
  });
  const session = { token: r.token, userId: r.userId, username: r.username };
  await saveCredentials(session, k.keys);
  await enter(session, k.keys);
}

export function dismissWelcomePlate() {
  set({ welcomePlate: null });
}

export async function logout() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const sub = await reg?.pushManager?.getSubscription();
    await sub?.unsubscribe();
  } catch { /* не страшно */ }
  try { await api.del('/session'); } catch { /* сервер недоступен — всё равно выходим */ }
  await logoutLocal();
}

async function logoutLocal() {
  const sock = ws;
  ws = null;
  sock?.close();
  clearTimeout(retryTimer);
  await wipeLocal();
  setToken(null);
  sk = null;
  known.clear();
  pending.clear();
  lastSeq = 0;
  setBadge(0);
  state = { ...initial, phase: 'welcome' };
  for (const l of listeners) l();
}

// ---------- связь с сервером ----------

let ws: WebSocket | null = null;
let connecting = false;
let retry = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let pingTimer: ReturnType<typeof setTimeout> | undefined;

interface ServerUser {
  id: number; username: string; displayName: string; boxPk: string;
  plate?: string | null; about?: string; city?: string; kind?: 'human' | 'aska' | 'twin'; ownerId?: number; prevPks?: string[];
}

interface StateResp {
  me: number;
  users: ServerUser[];
  chats: Chat[];
  vapidPublicKey: string;
  badge: number;
  online: number[];
  profile: Profile;
  pins: number[];
  guesses: Record<number, Truth>;
  features: { ai: boolean; sms: boolean };
}

// Ключ друга запоминаем при первой встрече. Новый ключ принимаем, только если старый сервер числит прежним
// (друг восстановил вход) — тогда мягкое «ключ обновился». Иначе — предупреждение о возможной подмене.
function mergeUser(u: ServerUser, prev: User | undefined, myPk?: string): User {
  const pinned = u.id === state.me?.userId ? myPk : prev?.pk;
  const base: User = {
    id: u.id, username: u.username, displayName: u.displayName, pk: u.boxPk, plate: u.plate ?? null,
    about: u.about || '', city: u.city || '', kind: u.kind || 'human', ownerId: u.ownerId, prevPks: u.prevPks,
  };
  if (!pinned || pinned === u.boxPk) return prev?.keyRotated ? { ...base, keyRotated: true } : base;
  if ((u.prevPks || []).includes(pinned)) return { ...base, keyRotated: true };
  return { ...base, pk: pinned, keyChanged: true };
}

let pushChecked = false;

async function loadState() {
  const st = await api.get<StateResp>('/state');
  const myKeys = await kvGet('keys');
  const users: Record<number, User> = {};
  for (const u of st.users) users[u.id] = mergeUser(u, state.users[u.id], myKeys?.pk);
  const chats: Record<string, Chat> = {};
  for (const c of st.chats) chats[c.id] = c;
  const presence: Record<number, boolean> = {};
  for (const id of st.online || []) presence[id] = true;
  set({
    users, chats, vapidKey: st.vapidPublicKey, presence, profile: st.profile, pins: st.pins || [], guesses: st.guesses || {},
    features: st.features || { ai: false, sms: false },
  });
  await Promise.all([kvSet('users', users), kvSet('chats', chats)]);
  updateBadge();
  if (!pushChecked) {
    pushChecked = true;
    refreshPushState();
  }
}

async function connect() {
  clearTimeout(retryTimer);
  if (connecting || (ws && ws.readyState <= 1) || state.phase !== 'ready') return;
  connecting = true;
  try {
    await loadState();
  } catch (e) {
    connecting = false;
    if (e instanceof ApiError && e.status === 401) return logoutLocal();
    return scheduleReconnect();
  }
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const visible = document.visibilityState === 'visible' ? 1 : 0;
  const sock = new WebSocket(`${proto}://${location.host}/ws?token=${encodeURIComponent(getToken() || '')}&visible=${visible}`);
  ws = sock;
  connecting = false;
  sock.onopen = () => {
    retry = 0;
    set({ connected: true });
    sync();
    flushPending();
  };
  sock.onmessage = (e) => {
    try { onEvent(JSON.parse(e.data)); } catch (err) { console.error(err); }
  };
  sock.onclose = () => {
    if (ws !== sock) return;
    ws = null;
    set({ connected: false });
    scheduleReconnect();
  };
  sock.onerror = () => sock.close();
}

function scheduleReconnect() {
  if (state.phase !== 'ready') return;
  clearTimeout(retryTimer);
  const delay = [500, 1000, 2000, 5000, 10000][Math.min(retry++, 4)];
  retryTimer = setTimeout(connect, delay);
}

// После сна телефона соединение может молча умереть: проверяем пингом.
function checkAlive() {
  if (!ws || ws.readyState !== 1) return connect();
  ws.send('{"type":"ping"}');
  clearTimeout(pingTimer);
  const sock = ws;
  pingTimer = setTimeout(() => sock.close(), 4000);
}

document.addEventListener('visibilitychange', () => {
  if (state.phase !== 'ready') return;
  const visible = document.visibilityState === 'visible';
  if (ws?.readyState === 1) ws.send(JSON.stringify({ type: 'visible', value: visible }));
  if (visible) {
    checkAlive();
    sync();
    markRead();
  }
});
window.addEventListener('online', () => { if (state.phase === 'ready') { retry = 0; connect(); } });

type ServerEvent =
  | { type: 'hello' } | { type: 'pong' }
  | { type: 'msg'; m: ServerRow }
  | { type: 'read'; chatId: string; userId: number; upTo: number }
  | { type: 'chat'; chat: Chat }
  | { type: 'chat_left'; chatId: string }
  | { type: 'typing'; chatId: string; userId: number }
  | { type: 'presence'; userId: number; online: boolean }
  | { type: 'user'; user: ServerUser };

function onEvent(ev: ServerEvent) {
  switch (ev.type) {
    case 'pong':
      clearTimeout(pingTimer);
      break;
    case 'msg': {
      const live = !known.has(ev.m.id) && ev.m.senderId !== state.me?.userId;
      clearTyping(ev.m.chatId, ev.m.senderId);
      ingest([ev.m]).then(() => {
        scheduleSync();
        if (!live) return;
        const m = (state.messages[ev.m.chatId] || []).find((x) => x.id === ev.m.id);
        if (m) for (const l of incomingListeners) l(m);
      });
      break;
    }
    case 'presence': {
      const wasOnline = !!state.presence[ev.userId];
      set({ presence: { ...state.presence, [ev.userId]: ev.online } });
      if (ev.online && !wasOnline && ev.userId !== state.me?.userId) for (const l of onlineListeners) l(ev.userId);
      break;
    }
    case 'read': {
      const chat = state.chats[ev.chatId];
      if (!chat) break;
      const members = chat.members.map((m) => (m.userId === ev.userId ? { ...m, readUpTo: Math.max(m.readUpTo, ev.upTo) } : m));
      setChats({ ...state.chats, [chat.id]: { ...chat, members } });
      break;
    }
    case 'chat':
      if (!ev.chat.members.some((m) => m.userId === state.me?.userId)) {
        const { [ev.chat.id]: _gone, ...rest } = state.chats;
        setChats(rest);
      } else setChats({ ...state.chats, [ev.chat.id]: ev.chat });
      break;
    case 'chat_left': {
      const { [ev.chatId]: _gone, ...rest } = state.chats;
      setChats(rest);
      break;
    }
    case 'typing': {
      const chat = { ...(state.typing[ev.chatId] || {}), [ev.userId]: Date.now() };
      set({ typing: { ...state.typing, [ev.chatId]: chat } });
      setTimeout(() => {
        const t = state.typing[ev.chatId]?.[ev.userId];
        if (t && Date.now() - t >= 5000) clearTyping(ev.chatId, ev.userId);
      }, 5200);
      break;
    }
    case 'user': {
      const users = { ...state.users, [ev.user.id]: mergeUser(ev.user, state.users[ev.user.id]) };
      set({ users });
      kvSet('users', users);
      break;
    }
  }
}

function clearTyping(chatId: string, userId: number) {
  if (!state.typing[chatId]?.[userId]) return;
  const { [userId]: _gone, ...rest } = state.typing[chatId];
  set({ typing: { ...state.typing, [chatId]: rest } });
}

// «печатает…» — сообщаем собеседникам не чаще раза в 2,5 секунды
const typingSent = new Map<string, number>();
export function sendTyping(chatId: string) {
  const t = Date.now();
  if (t - (typingSent.get(chatId) || 0) < 2500 || ws?.readyState !== 1) return;
  typingSent.set(chatId, t);
  ws.send(JSON.stringify({ type: 'typing', chatId }));
}

export function typingIn(chatId: string, s: State = state): number[] {
  const now = Date.now();
  return Object.entries(s.typing[chatId] || {}).filter(([, t]) => now - t < 5000).map(([id]) => Number(id));
}

function setChats(chats: Record<string, Chat>) {
  set({ chats });
  kvSet('chats', chats);
  updateBadge();
}

let syncing = false;
let syncAgain = false;
let syncTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(sync, 300);
}

async function sync() {
  if (state.phase !== 'ready') return;
  if (syncing) { syncAgain = true; return; }
  syncing = true;
  try {
    for (;;) {
      const r = await api.get<{ messages: ServerRow[]; more: boolean }>(`/sync?after=${lastSeq}`);
      await ingest(r.messages);
      if (r.messages.length) {
        lastSeq = r.messages[r.messages.length - 1].id;
        await kvSet('lastSeq', lastSeq);
      }
      if (!r.more) break;
    }
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return logoutLocal();
  } finally {
    syncing = false;
    if (syncAgain) { syncAgain = false; sync(); }
  }
}

function insertSorted(list: Msg[], m: Msg) {
  let i = list.length;
  while (i > 0 && list[i - 1].id > m.id) i--;
  list.splice(i, 0, m);
}

async function ingest(rows: ServerRow[]) {
  const fresh = rows.filter((r) => !known.has(r.id));
  if (!fresh.length || !sk) return;
  if (fresh.some((r) => !state.users[r.senderId])) await loadState().catch(() => {});
  const stored: StoredMsg[] = [];
  for (const row of fresh) {
    if (known.has(row.id)) continue;
    const sender = state.users[row.senderId];
    let body = null;
    // после восстановления входа у друга новый ключ — старые сообщения открываем прежним
    for (const pk of sender ? [sender.pk, ...(sender.prevPks || [])] : []) {
      body = decodeIncoming(row, C.fromB64(pk), sk);
      if (body) break;
    }
    stored.push({ id: row.id, chatId: row.chatId, senderId: row.senderId, uuid: row.uuid, createdAt: row.createdAt, body });
    known.add(row.id);
  }
  await putMessages(stored);
  addToState(stored);
}

function addToState(stored: Msg[]) {
  if (!stored.length) return;
  const messages = { ...state.messages };
  const chats = { ...state.chats };
  for (const m of stored) {
    const old = messages[m.chatId] || [];
    const pendingTwin = old.find((x) => x.status && x.uuid === m.uuid && x.senderId === m.senderId);
    const list = old.filter((x) => x !== pendingTwin && x.id !== m.id);
    insertSorted(list, pendingTwin?.localImage ? { ...m, localImage: pendingTwin.localImage } : m);
    messages[m.chatId] = list;
    const chat = chats[m.chatId];
    if (chat && m.id > chat.lastId) chats[m.chatId] = { ...chat, lastId: m.id };
  }
  set({ messages, chats });
  markRead();
  updateBadge();
}

// ---------- отправка ----------

const pending = new Map<string, { msg: Msg; ct?: Uint8Array; inflight?: boolean; failed?: boolean }>();

function putPending(msg: Msg) {
  const messages = { ...state.messages };
  const list = (messages[msg.chatId] || []).filter((x) => x.uuid !== msg.uuid || !x.status);
  insertSorted(list, msg);
  messages[msg.chatId] = list;
  set({ messages });
}

export async function sendText(chatId: string, text: string, reply?: number, extra?: Pick<Body, 'act' | 'gift'>) {
  const body: Body = { kind: 'text', text, ...extra };
  if (reply) body.reply = reply;
  const msg: Msg = newPending(chatId, body);
  pending.set(msg.uuid, { msg });
  putPending(msg);
  await deliver(msg.uuid);
}

export async function sendImage(chatId: string, file: File, reply?: number) {
  const prep = await prepareImage(file);
  const f = C.encryptFile(prep.bytes);
  const body: Body = {
    kind: 'image',
    image: { blob: '', key: f.key, nonce: f.nonce, hash: f.hash, w: prep.w, h: prep.h, mime: prep.mime, thumb: prep.thumb },
  };
  if (reply) body.reply = reply;
  const msg: Msg = { ...newPending(chatId, body), localImage: URL.createObjectURL(new Blob([prep.bytes as BlobPart], { type: prep.mime })) };
  pending.set(msg.uuid, { msg, ct: f.ct });
  putPending(msg);
  await deliver(msg.uuid);
}

function newPending(chatId: string, body: Body): Msg {
  return {
    id: TEMP_BASE + ++tempCounter, chatId, senderId: state.me!.userId, uuid: crypto.randomUUID(),
    createdAt: Date.now(), body, status: 'sending',
  };
}

async function deliver(uuid: string) {
  const p = pending.get(uuid);
  if (!p || p.inflight || p.failed || !sk || !state.me) return;
  p.inflight = true;
  const { msg } = p;
  try {
    if (msg.body?.kind === 'image' && msg.body.image && !msg.body.image.blob) {
      const { id } = await api.upload(p.ct!);
      msg.body = { ...msg.body, image: { ...msg.body.image, blob: id } };
    }
    let r: { id: number; createdAt: number } | null = null;
    for (let attempt = 0; !r; attempt++) {
      const chat = state.chats[msg.chatId];
      if (!chat) throw new ApiError(404, 'no_chat');
      if (chat.members.some((m) => !state.users[m.userId])) await loadState();
      const members = chat.members.map((m) => ({ id: m.userId, pk: C.fromB64(state.users[m.userId].pk) }));
      const boxes = encodeOutgoing(msg.chatId, msg.uuid, msg.body!, members, state.me.userId, sk);
      try {
        r = await api.post<{ id: number; createdAt: number }>('/messages', { chatId: msg.chatId, uuid: msg.uuid, boxes });
      } catch (e) {
        if (e instanceof ApiError && e.code === 'members_changed' && attempt < 2) { await loadState(); continue; }
        throw e;
      }
    }
    pending.delete(uuid);
    if (known.has(r.id)) {
      // Своё сообщение уже пришло через WebSocket раньше ответа — просто убираем черновик.
      const list = (state.messages[msg.chatId] || []).filter((x) => !(x.status && x.uuid === uuid));
      set({ messages: { ...state.messages, [msg.chatId]: list } });
      return;
    }
    known.add(r.id);
    const stored: StoredMsg = { id: r.id, chatId: msg.chatId, senderId: msg.senderId, uuid, createdAt: r.createdAt, body: msg.body };
    await putMessages([stored]);
    addToState([{ ...stored, localImage: msg.localImage }]);
  } catch (e) {
    p.inflight = false;
    // Нет сети — оставляем «отправляется», повторим при подключении. Иначе — «не отправлено».
    if (!(e instanceof ApiError && e.status === 0)) {
      p.failed = true;
      p.msg = { ...msg, status: 'failed' };
      putPending(p.msg);
    }
  }
}

function flushPending() {
  for (const uuid of pending.keys()) deliver(uuid);
}

export function retrySend(uuid: string) {
  const p = pending.get(uuid);
  if (!p) return;
  p.failed = false;
  p.msg = { ...p.msg, status: 'sending' };
  putPending(p.msg);
  deliver(uuid);
}

export function discardFailed(uuid: string, chatId: string) {
  pending.delete(uuid);
  set({ messages: { ...state.messages, [chatId]: (state.messages[chatId] || []).filter((x) => !(x.uuid === uuid && x.status)) } });
}

// ---------- прочтение и счётчик ----------

let activeChat: string | null = null;
export function setActiveChat(id: string | null) {
  activeChat = id;
  markRead();
}

function markRead() {
  if (!activeChat || document.visibilityState !== 'visible' || !state.me) return;
  const chat = state.chats[activeChat];
  const list = state.messages[activeChat] || [];
  let maxId = 0;
  for (let i = list.length - 1; i >= 0; i--) if (!list[i].status) { maxId = list[i].id; break; }
  const mine = chat?.members.find((m) => m.userId === state.me!.userId);
  if (!chat || !mine || !maxId || mine.readUpTo >= maxId) return;
  const members = chat.members.map((m) => (m.userId === mine.userId ? { ...m, readUpTo: maxId } : m));
  setChats({ ...state.chats, [chat.id]: { ...chat, members } });
  const chatId = chat.id;
  api.post<{ badge: number }>('/read', { chatId, upTo: maxId }).then((r) => setBadge(r.badge)).catch(() => {});
  navigator.serviceWorker?.getRegistration()
    .then((reg) => reg?.getNotifications())
    .then((ns) => ns?.forEach((n) => { if (n.data?.chatId === chatId) n.close(); }))
    .catch(() => {});
}

export function unreadIn(chatId: string, s: State = state): number {
  const chat = s.chats[chatId];
  const me = s.me?.userId;
  const mine = chat?.members.find((m) => m.userId === me);
  if (!chat || !mine) return 0;
  let n = 0;
  const list = s.messages[chatId] || [];
  for (let i = list.length - 1; i >= 0 && list[i].id > mine.readUpTo; i--) {
    if (!list[i].status && list[i].senderId !== me) n++;
  }
  return n;
}

function updateBadge() {
  let total = 0;
  for (const id of Object.keys(state.chats)) total += unreadIn(id);
  setBadge(total);
}

// ---------- чаты, приглашения ----------

export async function openDm(userId: number): Promise<string> {
  const existing = Object.values(state.chats).find((c) => c.kind === 'dm' && c.members.some((m) => m.userId === userId));
  if (existing) return existing.id;
  const { chat } = await api.post<{ chat: Chat }>('/chats/dm', { userId });
  setChats({ ...state.chats, [chat.id]: chat });
  return chat.id;
}

export const createInvite = () => api.post<{ code: string }>('/invites');
export const listInvites = () => api.get<{ invites: { code: string; createdAt: number }[] }>('/invites');

// ---------- профиль, круги, личный ИИ, игра, управление ----------

export async function updateProfile(p: { displayName?: string; about?: string; city?: string; allowAnon?: boolean }) {
  await api.post('/me', p);
  if (p.allowAnon !== undefined && state.profile) set({ profile: { ...state.profile, allowAnon: p.allowAnon } });
}

export async function linkPhone(phone: string, ticket?: string) {
  const r = await api.post<{ phone: string; phoneVerified: boolean }>('/me/phone', { phone, ticket });
  if (state.profile) set({ profile: { ...state.profile, phone: r.phone, phoneVerified: r.phoneVerified } });
}

export async function setPin(userId: number, on: boolean) {
  const r = await api.post<{ pins: number[] }>('/pins', { userId, on });
  set({ pins: r.pins });
}

export async function guess(userId: number, g: Truth) {
  const r = await api.post<{ correct: boolean; truth: Truth }>('/guess', { userId, guess: g });
  set({ guesses: { ...state.guesses, [userId]: r.truth } });
  return r;
}
export const game = () => api.get<{ right: number; total: number; top: { userId: number; right: number; total: number }[] }>('/game');

export interface CircleInfo {
  id: string; kind: 'general' | 'circle'; title: string; emoji: string; about: string; isPublic: boolean;
  member: boolean; count: number; online: number; lastAt: number;
}
export const listCircles = () => api.get<{ circles: CircleInfo[] }>('/circles').then((r) => r.circles);

async function gotChat(chat: Chat) {
  setChats({ ...state.chats, [chat.id]: chat });
  sync();
  return chat.id;
}
export const joinCircle = async (id: string) => gotChat((await api.post<{ chat: Chat }>(`/circles/${encodeURIComponent(id)}/join`)).chat);
export async function leaveCircle(id: string) {
  await api.post(`/circles/${encodeURIComponent(id)}/leave`);
  const { [id]: _gone, ...rest } = state.chats;
  setChats(rest);
}
export async function createCircle(c: { title: string; emoji: string; about: string; memberIds: number[]; isPublic: boolean }) {
  if (c.memberIds.some((id) => !state.users[id])) await loadState();
  return gotChat((await api.post<{ chat: Chat }>('/circles', c)).chat);
}

export const openTwinChat = async (twinId: number, anon: boolean) => gotChat((await api.post<{ chat: Chat }>(`/twins/${twinId}/chat`, { anon })).chat);
export interface TwinInfo { twinId: number; allowAnon: boolean; facts: { id: number; text: string; source: string; createdAt: number }[]; stats: { chats: number; questions: number; answered: number } }
export const myTwin = () => api.get<TwinInfo>('/twin');
export const addTwinFact = (text: string) => api.post('/twin/facts', { text });
export const deleteTwinFact = (id: number) => api.del(`/twin/facts/${id}`);

export function twinOf(ownerId: number, s: State = state): User | undefined {
  return Object.values(s.users).find((u) => u.kind === 'twin' && u.ownerId === ownerId);
}
export const askaOf = (s: State = state) => Object.values(s.users).find((u) => u.kind === 'aska');

export interface AdminInfo {
  ai: { configured: boolean; hasKey: boolean; keyHint: string; model: string; models: { id: string; name: string; note: string }[]; dailyLimit: number; usedToday: number; paused: boolean; lastError: string };
  people: boolean;
  sms: { configured: boolean; hasKey: boolean; lastError: string };
  users: { id: number; displayName: string; plate: string; phone: string | null; phoneVerified: boolean; createdAt: number; lastActive: number | null; isAdmin: boolean }[];
}
export const adminInfo = () => api.get<AdminInfo>('/admin');
export const adminSetAi = (p: { apiKey?: string; model?: string; dailyLimit?: number; paused?: boolean }) => api.post('/admin/ai', p);
export const adminCheckAi = () => api.post<{ ok: boolean; reply?: string; error?: string }>('/admin/ai/check');
export const adminSetPeople = async (on: boolean) => { await api.post('/admin/people', { on }); await loadState(); };
export const adminSetSms = (apiId: string) => api.post('/admin/sms', { apiId });
export const adminCheckSms = () => api.post<{ ok: boolean; balance?: number; error?: string }>('/admin/sms/check');
export const adminHelpCode = (userId: number) => api.post<{ code: string; login: string }>('/admin/help-code', { userId });

export async function myPublicKey() {
  return (await kvGet('keys'))?.pk || '';
}

// ---------- уведомления ----------

function urlB64ToBytes(s: string) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  return C.fromB64(b64);
}

async function subscribePush() {
  const reg = await navigator.serviceWorker.ready;
  if (!state.vapidKey) await loadState();
  const key = urlB64ToBytes(state.vapidKey!);
  let sub = await reg.pushManager.getSubscription();
  const current = sub?.options.applicationServerKey;
  if (sub && current && C.toB64(new Uint8Array(current)) !== C.toB64(key)) {
    await sub.unsubscribe();
    sub = null;
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key as BufferSource });
  await api.post('/push/subscribe', sub.toJSON());
}

export async function refreshPushState() {
  if (!pushSupported) return set({ pushState: 'unsupported' });
  const perm = Notification.permission;
  if (perm !== 'granted') return set({ pushState: perm === 'denied' ? 'denied' : 'default' });
  try {
    await subscribePush();
    set({ pushState: 'subscribed' });
  } catch (e) {
    console.error('push', e);
    set({ pushState: 'default' });
  }
}

// Вызывать прямо из нажатия кнопки: iPhone спрашивает разрешение только в ответ на действие человека.
export async function enablePush(): Promise<PushState> {
  if (!pushSupported) return 'unsupported';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    const st: PushState = perm === 'denied' ? 'denied' : 'default';
    set({ pushState: st });
    return st;
  }
  try {
    await subscribePush();
    set({ pushState: 'subscribed' });
    return 'subscribed';
  } catch (e) {
    console.error('push', e);
    set({ pushState: 'default' });
    throw e;
  }
}
