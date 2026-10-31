// 📞 Звонки на экране: кнопка в шапке беседы, плашка «Идёт звонок · Присоединиться»,
// входящий звонок во весь экран и панель разговора (свернуть — тонкая полоска сверху).
import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../useStore.ts';
import { chatTitle, dmPeer } from '../lib/format.ts';
import { userFlower } from '../lib/aska.ts';
import { callsState, subscribeCalls, startCall, acceptCall, declineCall, hangUp, toggleMute, setMinimized, callSupported } from '../lib/calls.ts';
import { Svg } from './Win.tsx';

export const useCalls = () => useSyncExternalStore(subscribeCalls, callsState);

const fmt = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

function useTick(on: boolean) {
  const [, setT] = useState(0);
  useEffect(() => { if (!on) return; const i = setInterval(() => setT((x) => x + 1), 1000); return () => clearInterval(i); }, [on]);
}

// Можно ли звонить в эту беседу: личка с человеком, круг или рабочий чат; не Аське, не Бате, не личному ИИ
export function useCanCall(chatId: string) {
  const s = useStore();
  const chat = s.chats[chatId];
  if (!chat || !callSupported() || chat.kind === 'twin') return false;
  if (chat.kind === 'dm') { const p = dmPeer(chat, s); return !!p && (p.kind === 'human' || !p.kind); }
  return chat.members.length >= 2;
}

export function CallButton({ chatId }: { chatId: string }) {
  const c = useCalls();
  const ok = useCanCall(chatId);
  if (!ok) return null;
  const inThis = c.active?.chatId === chatId;
  const going = !!c.calls[chatId];
  return (
    <button type="button" className={`btn icon aska-call-btn${going ? ' live' : ''}`} title={inThis ? 'Звонок' : going ? 'Присоединиться к звонку' : 'Позвонить'}
      aria-label={inThis ? 'Открыть звонок' : going ? 'Присоединиться к звонку' : 'Позвонить'}
      onClick={(e) => { e.stopPropagation(); if (inThis) setMinimized(false); else startCall(chatId); }}>📞</button>
  );
}

export function CallBanner({ chatId }: { chatId: string }) {
  const c = useCalls();
  const s = useStore();
  const call = c.calls[chatId];
  useTick(!!call);
  if (!call || c.active?.chatId === chatId || call.members.length === 0) return null;
  const names = call.members.map((id) => s.users[id]?.displayName || '?');
  return (
    <div className="aska-call-banner">
      <span>📞 Идёт звонок · {names.slice(0, 3).join(', ')}{names.length > 3 ? ` и ещё ${names.length - 3}` : ''} · {fmt(Date.now() - call.at)}</span>
      <button type="button" className="btn primary" onClick={() => startCall(chatId)}>Присоединиться</button>
    </div>
  );
}

// Слой поверх всего приложения: входящий звонок и текущий разговор
export function CallLayer({ onOpenChat }: { onOpenChat: (chatId: string) => void }) {
  const c = useCalls();
  const s = useStore();
  useTick(!!c.active);
  const myId = s.me?.userId;

  const title = (chatId: string) => { const chat = s.chats[chatId]; return chat ? chatTitle(chat, s) : 'Звонок'; };

  let incoming = null;
  if (c.incoming) {
    const from = s.users[c.incoming.from];
    const chat = s.chats[c.incoming.chatId];
    incoming = (
      <div className="aska-call-ov ring" role="dialog" aria-label="Входящий звонок">
        <div className="call-card">
          <div className="call-ava"><Svg html={userFlower(from, true, 64)} /></div>
          <div className="call-kind">{c.incoming.group ? '📞 Групповой звонок' : '📞 Входящий звонок'}</div>
          <div className="call-name">{from?.displayName || 'Кто-то'}</div>
          {c.incoming.group && chat && <div className="call-sub">в «{chatTitle(chat, s)}»</div>}
          <div className="call-acts">
            <button type="button" className="call-round no" onClick={declineCall} aria-label="Отклонить"><i>☎</i><span>Отклонить</span></button>
            <button type="button" className="call-round yes" onClick={acceptCall} aria-label="Принять"><i>☎</i><span>Принять</span></button>
          </div>
        </div>
      </div>
    );
  }

  let active = null;
  if (c.active) {
    const a = c.active;
    const others = a.members.filter((id) => id !== myId);
    const connected = Object.values(a.peers).some((p) => p === 'connected');
    const status = others.length === 0 ? 'звоним…' : connected ? fmt(Date.now() - a.joinedAt) : 'соединяемся…';
    if (c.minimized) {
      active = (
        <button type="button" className="aska-call-mini" onClick={() => setMinimized(false)}>
          <span className="dot" />📞 {title(a.chatId)} · {status}{a.muted ? ' · 🔇' : ''}<b>вернуться</b>
        </button>
      );
    } else {
      active = (
        <div className="aska-call-ov" role="dialog" aria-label="Звонок">
          <div className="call-card">
            <div className="call-kind">📞 {title(a.chatId)}</div>
            <div className="call-time">{status}</div>
            <div className="call-people">
              {[myId!, ...others].map((id) => {
                const u = s.users[id];
                const st = id === myId ? 'connected' : a.peers[id];
                return (
                  <div key={id} className={`call-person ${st || 'connecting'}`}>
                    <Svg html={userFlower(u, st === 'connected', 40)} />
                    <span>{id === myId ? 'Ты' : u?.displayName || '?'}</span>
                    <small>{id === myId ? (a.muted ? '🔇 без звука' : '🎙') : st === 'connected' ? '🔊 на связи' : st === 'failed' ? '⚠ не соединилось' : '…'}</small>
                  </div>
                );
              })}
            </div>
            {Object.values(a.peers).some((p) => p === 'failed') && <div className="call-hint">Не соединилось: у кого-то строгая сеть. Попробуйте Wi-Fi или мобильный интернет — или попросите админа подключить TURN-сервер.</div>}
            <div className="call-acts">
              <button type="button" className={`call-round mute${a.muted ? ' on' : ''}`} onClick={toggleMute} aria-label={a.muted ? 'Включить микрофон' : 'Выключить микрофон'}><i>{a.muted ? '🔇' : '🎙'}</i><span>{a.muted ? 'Включить' : 'Без звука'}</span></button>
              <button type="button" className="call-round no" onClick={hangUp} aria-label="Положить трубку"><i>☎</i><span>Завершить</span></button>
              <button type="button" className="call-round min" onClick={() => { setMinimized(true); onOpenChat(a.chatId); }} aria-label="Свернуть звонок"><i>💬</i><span>В чат</span></button>
            </div>
            <div className="call-note">Звук идёт напрямую между телефонами и шифруется. Держи АСЬКУ открытой во время звонка.</div>
          </div>
        </div>
      );
    }
  }

  if (!incoming && !active && !c.note) return null;
  return createPortal(
    <>
      {active}
      {incoming}
      {c.note && <div className="aska-call-note" role="status">{c.note}</div>}
    </>,
    document.body,
  );
}
