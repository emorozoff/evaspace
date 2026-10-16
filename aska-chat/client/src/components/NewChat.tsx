import { useState } from 'react';
import { useStore } from '../useStore.ts';
import { openDm } from '../lib/store.ts';
import { Avatar } from './Avatar.tsx';
import { BackIcon, UserPlusIcon } from './Icons.tsx';
import { InviteSheet } from './InviteSheet.tsx';

export function NewChat({ onBack, onOpen }: { onBack: () => void; onOpen: (id: string) => void }) {
  const s = useStore();
  const [invite, setInvite] = useState(false);
  const [error, setError] = useState('');
  const people = Object.values(s.users)
    .filter((u) => u.id !== s.me?.userId)
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'ru'));

  async function open(id: number) {
    setError('');
    try { onOpen(await openDm(id)); } catch { setError('Не получилось открыть чат. Проверь интернет.'); }
  }

  return (
    <div className="screen">
      <header className="header">
        <div className="header-row">
          <button className="icon-btn" onClick={onBack} aria-label="Назад"><BackIcon /></button>
          <div className="header-title">Новый чат</div>
          <div className="icon-btn" />
        </div>
      </header>
      <div className="scroll list-bg">
        <button className="person-row accent" onClick={() => setInvite(true)}>
          <div className="avatar avatar-action"><UserPlusIcon /></div>
          <div className="person-main"><span className="chat-name">Пригласить друга</span></div>
        </button>
        {error && <div className="error pad">{error}</div>}
        {people.map((u) => (
          <button key={u.id} className="person-row" onClick={() => open(u.id)}>
            <Avatar name={u.displayName} id={u.id} size={44} />
            <div className="person-main">
              <span className="chat-name">{u.displayName}</span>
              <span className="person-sub">@{u.username}</span>
            </div>
          </button>
        ))}
        {!people.length && <p className="empty-hint">Пока здесь только ты. Пригласи друзей — и им можно будет писать лично.</p>}
      </div>
      {invite && <InviteSheet onClose={() => setInvite(false)} />}
    </div>
  );
}
