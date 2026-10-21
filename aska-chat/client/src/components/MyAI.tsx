// «Мой ИИ»: что он знает обо мне, разрешить ли анонимные сообщения, поговорить с ним.
// Всё, что друзья передают через него (комплименты, подарки, вопросы), приходит в беседу с ним.
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useStore } from '../useStore.ts';
import { myTwin, addTwinFact, deleteTwinFact, openTwinChat, updateProfile, unreadIn } from '../lib/store.ts';
import type { TwinInfo } from '../lib/store.ts';
import { flower } from '../lib/aska.ts';
import { Ico } from './Win.tsx';

export function MyAI({ onOpen }: { onOpen: (chatId: string) => void }) {
  const s = useStore();
  const [info, setInfo] = useState<TwinInfo | null>(null);
  const [fact, setFact] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const me = s.users[s.me!.userId];

  const load = () => myTwin().then(setInfo).catch(() => setError('Не получилось загрузить. Проверь интернет.'));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try { await fn(); } catch { setError('Не получилось. Попробуй ещё раз.'); } finally { setBusy(false); }
  };

  async function add(e: FormEvent) {
    e.preventDefault();
    if (fact.trim().length < 2) return;
    await act(async () => { await addTwinFact(fact.trim()); setFact(''); await load(); });
  }

  const ownChat = info ? Object.values(s.chats).find((c) => c.kind === 'dm' && c.members.some((m) => m.userId === info.twinId)) : undefined;
  const unread = ownChat ? unreadIn(ownChat.id, s) : 0;
  const allowAnon = s.profile?.allowAnon ?? info?.allowAnon ?? true;

  return (
    <>
      <div className="wall-head aska-twin-head">
        <Ico html={flower('chat', 28)} />
        <span className="who"><b>ИИ · {me?.displayName}</b><br /><span className="muted">твой личный ИИ</span></span>
      </div>
      <div className="hint aska-lead">
        Друзья пишут твоему ИИ из твоего профиля — открыто или анонимно. Он болтает с ними, а тебе передаёт комплименты, подарки и вопросы.
        Чем больше он о тебе знает, тем лучше отвечает.
      </div>
      {error && <div className="err">{error}</div>}
      <div className="aska-actions">
        <button className="btn primary" disabled={!info || busy} onClick={() => act(async () => onOpen(await openTwinChat(info!.twinId, false)))}>
          💬 Поговорить с ним{unread ? ` (${unread})` : ''}
        </button>
      </div>

      <div className="groupbox">
        <div className="legend">Анонимные сообщения</div>
        <label className="row aska-check">
          <input type="checkbox" checked={allowAnon} disabled={busy} onChange={(e) => act(() => updateProfile({ allowAnon: e.target.checked }))} />
          <span>Разрешить писать моему ИИ анонимно — я не узнаю, кто это был</span>
        </label>
      </div>

      <div className="groupbox">
        <div className="legend">Что он о тебе знает ({info?.facts.length ?? '…'})</div>
        <form className="row aska-fact-add" onSubmit={add}>
          <input className="field" value={fact} onChange={(e) => setFact(e.target.value)} maxLength={200} placeholder="Например: «люблю горы и кофе»" />
          <button className="btn" disabled={busy || fact.trim().length < 2}>Добавить</button>
        </form>
        {info && !info.facts.length && <div className="hint">Пока ничего. Добавь пару фактов или просто поболтай с ним — он сам запомнит.</div>}
        <ul className="aska-facts">
          {info?.facts.map((f) => (
            <li key={f.id}>
              <span>{f.text}</span>
              <button className="tbtn" aria-label="Удалить" title="Удалить" disabled={busy}
                onClick={() => act(async () => { await deleteTwinFact(f.id); await load(); })}>×</button>
            </li>
          ))}
        </ul>
        <div className="hint">Пароли, адреса и номера карт он не запоминает. Удалить можно любой факт.</div>
      </div>

      {info && (
        <div className="hint center">
          С ним говорили в {info.stats.chats} {info.stats.chats === 1 ? 'беседе' : 'беседах'} · вопросов: {info.stats.questions}, ты ответил(а) на {info.stats.answered}
        </div>
      )}
    </>
  );
}
