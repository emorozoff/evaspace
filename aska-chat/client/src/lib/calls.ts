// 📞 Аудиозвонки 1:1 и групповые (до 8 человек, каждый связан с каждым — WebRTC).
// Звук идёт напрямую между телефонами и шифруется (DTLS-SRTP). Сервер знакомит телефоны и передаёт сигналы,
// а сами сигналы (SDP, ICE) зашифрованы ключом собеседника (sealFor/openFromUser в store.ts): подменить
// отпечаток шифрования и подслушать сервер не может. Предлагает соединение тот, кто вошёл в звонок позже.
import { api } from './api.ts';
import { store, wsSend, sealFor, openFromUser } from './store.ts';
import { onCall } from './callbus.ts';
import type { CallView } from './callbus.ts';

export type PeerState = 'connecting' | 'connected' | 'failed';
export interface ActiveCall { chatId: string; joinedAt: number; muted: boolean; peers: Record<number, PeerState>; members: number[]; startedAt: number }
export interface CallsState {
  active: ActiveCall | null;
  incoming: { chatId: string; from: number; group: boolean } | null;
  calls: Record<string, CallView>; // идущие звонки в моих беседах (для плашки «Присоединиться»)
  note: string;                    // короткое сообщение: «не ответили», «нет доступа к микрофону»…
  minimized: boolean;
}

let st: CallsState = { active: null, incoming: null, calls: {}, note: '', minimized: false };
const subs = new Set<() => void>();
const set = (patch: Partial<CallsState>) => { st = { ...st, ...patch }; for (const f of subs) f(); };
export const callsState = () => st;
export const subscribeCalls = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

const getState = () => store.get();
const me = () => getState().me?.userId ?? -1;
let local: MediaStream | null = null;
const pcs = new Map<number, RTCPeerConnection>();
const pendingIce = new Map<number, RTCIceCandidateInit[]>();
const audios = new Map<number, HTMLAudioElement>();
let ice: RTCIceServer[] | null = null;
let noteTimer = 0;

export const callSupported = () => typeof RTCPeerConnection !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

function note(text: string) {
  clearTimeout(noteTimer);
  set({ note: text });
  noteTimer = window.setTimeout(() => set({ note: '' }), 4000);
}

async function iceServers(): Promise<RTCIceServer[]> {
  if (ice) return ice;
  try { ice = (await api.get<{ iceServers: RTCIceServer[] }>('/calls/ice')).iceServers; } catch { ice = [{ urls: 'stun:stun.l.google.com:19302' }]; }
  return ice;
}

async function mic(): Promise<boolean> {
  if (local) return true;
  try {
    local = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
    return true;
  } catch (e) {
    note((e as Error)?.name === 'NotAllowedError' ? '🎙 Нет доступа к микрофону — разреши его для АСЬКИ в настройках телефона' : '🎙 Микрофон не включился');
    return false;
  }
}

// ---------- звуки: входящий звонок и гудки ----------
let actx: AudioContext | null = null;
let toneTimer = 0;
function tone(freqs: number[], dur: number, vol = 0.12) {
  try {
    actx = actx || new AudioContext();
    if (actx.state === 'suspended') actx.resume().catch(() => {});
    const t0 = actx.currentTime;
    const g = actx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.02);
    g.gain.setValueAtTime(vol, t0 + dur - 0.05);
    g.gain.linearRampToValueAtTime(0, t0 + dur);
    g.connect(actx.destination);
    for (const f of freqs) { const o = actx.createOscillator(); o.frequency.value = f; o.connect(g); o.start(t0); o.stop(t0 + dur); }
  } catch { /* без звука */ }
}
function ringIn() {
  stopTones();
  const once = () => { tone([660], 0.18); setTimeout(() => tone([880], 0.18), 220); setTimeout(() => tone([660], 0.18), 520); setTimeout(() => tone([990], 0.3), 740); navigator.vibrate?.([300, 200, 300]); };
  once();
  toneTimer = window.setInterval(once, 2600);
}
function ringBack() { // гудки «ту-у… ту-у…» у звонящего
  stopTones();
  tone([425], 1, 0.08);
  toneTimer = window.setInterval(() => tone([425], 1, 0.08), 4000);
}
function stopTones() { clearInterval(toneTimer); toneTimer = 0; }
function beep(up: boolean) { tone([up ? 520 : 780], 0.12, 0.1); setTimeout(() => tone([up ? 780 : 520], 0.14, 0.1), 140); }

// ---------- соединения ----------
function sendSig(to: number, chatId: string, payload: object) {
  const data = sealFor(to, { ...payload, chat: chatId });
  if (data) wsSend({ type: 'call_signal', chatId, to, data });
}

function setPeer(id: number, s: PeerState | null) {
  if (!st.active) return;
  const peers = { ...st.active.peers };
  if (s) peers[id] = s; else delete peers[id];
  set({ active: { ...st.active, peers } });
}

async function makePc(peer: number, chatId: string): Promise<RTCPeerConnection> {
  const old = pcs.get(peer);
  if (old) return old;
  const pc = new RTCPeerConnection({ iceServers: await iceServers() });
  pcs.set(peer, pc);
  local?.getTracks().forEach((t) => pc.addTrack(t, local!));
  pc.onicecandidate = (e) => { if (e.candidate) sendSig(peer, chatId, { k: 'ice', cand: e.candidate.toJSON() }); };
  pc.ontrack = (e) => {
    let a = audios.get(peer);
    if (!a) {
      a = document.createElement('audio');
      a.autoplay = true;
      a.setAttribute('playsinline', '');
      a.className = 'aska-call-audio';
      document.body.appendChild(a);
      audios.set(peer, a);
    }
    a.srcObject = e.streams[0] || new MediaStream([e.track]);
    a.play().catch(() => {});
  };
  pc.onconnectionstatechange = () => {
    const s = pc.connectionState;
    if (s === 'connected') { setPeer(peer, 'connected'); stopTones(); }
    else if (s === 'failed') setPeer(peer, 'failed');
    else if (s === 'connecting' || s === 'new') setPeer(peer, 'connecting');
  };
  setPeer(peer, 'connecting');
  return pc;
}

function closePeer(peer: number) {
  pcs.get(peer)?.close();
  pcs.delete(peer);
  pendingIce.delete(peer);
  const a = audios.get(peer);
  if (a) { a.srcObject = null; a.remove(); audios.delete(peer); }
  setPeer(peer, null);
}

async function offerTo(peer: number, chatId: string) {
  const pc = await makePc(peer, chatId);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  sendSig(peer, chatId, { k: 'offer', sdp: pc.localDescription?.sdp });
}

async function flushIce(peer: number) {
  const pc = pcs.get(peer);
  const list = pendingIce.get(peer) || [];
  pendingIce.delete(peer);
  for (const c of list) await pc?.addIceCandidate(c).catch(() => {});
}

async function onSignal(chatId: string, from: number, data: { n: string; c: string }) {
  const a = st.active;
  if (!a || a.chatId !== chatId) return;
  const msg = openFromUser(from, data) as { k?: string; sdp?: string; cand?: RTCIceCandidateInit; chat?: string } | null;
  if (!msg || msg.chat !== chatId) return; // сигнал не от того человека или не для этой беседы
  try {
    if (msg.k === 'offer' && typeof msg.sdp === 'string') {
      const pc = await makePc(from, chatId);
      await pc.setRemoteDescription({ type: 'offer', sdp: msg.sdp });
      await flushIce(from);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSig(from, chatId, { k: 'answer', sdp: pc.localDescription?.sdp });
    } else if (msg.k === 'answer' && typeof msg.sdp === 'string') {
      const pc = pcs.get(from);
      if (pc && pc.signalingState === 'have-local-offer') { await pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp }); await flushIce(from); }
    } else if (msg.k === 'ice' && msg.cand) {
      const pc = pcs.get(from);
      if (pc?.remoteDescription) await pc.addIceCandidate(msg.cand).catch(() => {});
      else pendingIce.set(from, [...(pendingIce.get(from) || []), msg.cand]);
    }
  } catch (e) { console.error('call signal', e); }
}

// Обновился состав звонка: со всеми, кто вошёл раньше меня, соединяюсь сам; кто ушёл — отключаю
function syncPeers(view: CallView) {
  const a = st.active;
  const my = me();
  if (!a || a.chatId !== view.chatId) return;
  const idx = view.members.indexOf(my);
  if (idx < 0) return;
  for (const id of [...pcs.keys()]) if (!view.members.includes(id)) closePeer(id);
  view.members.forEach((id, i) => { if (id !== my && i < idx && !pcs.has(id)) offerTo(id, view.chatId).catch((e) => console.error('offer', e)); });
  if (view.members.length > 1) stopTones();
  set({ active: { ...a, members: view.members, startedAt: view.at } });
}

function cleanup() {
  stopTones();
  for (const id of [...pcs.keys()]) closePeer(id);
  local?.getTracks().forEach((t) => t.stop());
  local = null;
  set({ active: null, minimized: false });
}

// ---------- что делает человек ----------
export async function startCall(chatId: string) {
  if (st.active) { if (st.active.chatId === chatId) set({ minimized: false }); else note('Сначала заверши текущий звонок'); return; }
  if (!callSupported()) { note('Этот браузер не умеет звонить'); return; }
  if (!(await mic())) return;
  const existing = st.calls[chatId];
  set({ active: { chatId, joinedAt: Date.now(), muted: false, peers: {}, members: [me()], startedAt: Date.now() }, incoming: null, minimized: false });
  if (!wsSend({ type: existing ? 'call_join' : 'call_start', chatId })) { note('Нет связи — звонок не начался'); cleanup(); return; }
  if (!existing) ringBack();
}

export async function acceptCall() {
  const inc = st.incoming;
  if (!inc) return;
  stopTones();
  set({ incoming: null });
  if (st.active) cleanup();
  if (!(await mic())) { wsSend({ type: 'call_decline', chatId: inc.chatId }); return; }
  set({ active: { chatId: inc.chatId, joinedAt: Date.now(), muted: false, peers: {}, members: [], startedAt: Date.now() }, minimized: false });
  wsSend({ type: 'call_join', chatId: inc.chatId });
}

export function declineCall() {
  const inc = st.incoming;
  if (!inc) return;
  stopTones();
  wsSend({ type: 'call_decline', chatId: inc.chatId });
  set({ incoming: null });
}

export function hangUp() {
  const a = st.active;
  if (!a) return;
  wsSend({ type: 'call_leave', chatId: a.chatId });
  beep(false);
  cleanup();
}

export function toggleMute() {
  const a = st.active;
  if (!a) return;
  const muted = !a.muted;
  local?.getAudioTracks().forEach((t) => { t.enabled = !muted; });
  set({ active: { ...a, muted } });
}
export const setMinimized = (v: boolean) => set({ minimized: v });

// ---------- события с сервера ----------
function onView(view: CallView) {
  const my = me();
  set({ calls: { ...st.calls, [view.chatId]: view } });
  if (st.active?.chatId === view.chatId) {
    if (view.members.includes(my)) syncPeers(view);
    return;
  }
  // мне звонят (и я не в другом звонке)
  if (view.ringing.includes(my) && !view.members.includes(my)) {
    if (!st.incoming && !st.active) {
      const chat = getState().chats[view.chatId];
      set({ incoming: { chatId: view.chatId, from: view.by, group: chat ? chat.kind !== 'dm' : false } });
      ringIn();
    }
  } else if (st.incoming?.chatId === view.chatId) { stopTones(); set({ incoming: null }); }
}

onCall((e) => {
  switch (e.type) {
    case 'call': onView(e.call); break;
    case 'calls': {
      set({ calls: Object.fromEntries(e.calls.map((c) => [c.chatId, c])) });
      for (const c of e.calls) onView(c);
      // переподключились, а сервер успел вывести нас из звонка — входим снова (соединения могли уцелеть)
      const a = st.active;
      if (a && !e.calls.some((c) => c.chatId === a.chatId)) { note('Звонок закончился'); cleanup(); }
      else if (a && !e.calls.find((c) => c.chatId === a.chatId)?.members.includes(me())) wsSend({ type: 'call_join', chatId: a.chatId });
      break;
    }
    case 'call_end': {
      const { [e.chatId]: _gone, ...rest } = st.calls;
      set({ calls: rest });
      if (st.incoming?.chatId === e.chatId) { stopTones(); set({ incoming: null }); }
      if (st.active?.chatId === e.chatId) {
        const alone = st.active.members.length < 2;
        note(e.reason === 'no_answer' && alone ? '📵 Не ответили' : e.reason === 'declined' ? '📵 Звонок отклонён' : '📞 Звонок завершён');
        beep(false);
        cleanup();
      }
      break;
    }
    case 'call_signal': onSignal(e.chatId, e.from, e.data); break;
    case 'call_error':
      if (st.active?.chatId === e.chatId) { cleanup(); note(e.error === 'full' ? 'В звонке уже 8 человек — больше нельзя' : 'Сюда позвонить нельзя'); }
      break;
  }
});

// закрыли вкладку — кладём трубку
window.addEventListener('pagehide', () => { if (st.active) wsSend({ type: 'call_leave', chatId: st.active.chatId }); });
