import { useEffect, useState } from 'react';
import { useStore } from '../useStore.ts';
import { enablePush, logout, myPublicKey } from '../lib/store.ts';
import { safetyCode, fromB64 } from '../lib/crypto.ts';
import { isIOS, isStandalone } from '../lib/platform.ts';
import { Avatar } from './Avatar.tsx';
import { BackIcon } from './Icons.tsx';
import { InviteSheet } from './InviteSheet.tsx';

export function Settings({ onBack }: { onBack: () => void }) {
  const s = useStore();
  const [myCode, setMyCode] = useState('');
  const [invite, setInvite] = useState(false);
  const [pushError, setPushError] = useState('');
  const me = s.me ? s.users[s.me.userId] : undefined;

  useEffect(() => { myPublicKey().then((pk) => pk && setMyCode(safetyCode(fromB64(pk)))); }, []);

  const friends = Object.values(s.users)
    .filter((u) => u.id !== s.me?.userId)
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'ru'));

  let push;
  if (s.pushState === 'subscribed') push = <span className="row-value ok">Включены</span>;
  else if (s.pushState === 'denied') push = <span className="row-value">Выключены в настройках iPhone</span>;
  else if (s.pushState === 'unsupported') push = <span className="row-value">{isIOS && !isStandalone ? 'Открой с экрана «Домой»' : 'Не поддерживаются'}</span>;
  else push = <button className="pill" onClick={() => enablePush().catch(() => setPushError('Не получилось включить.'))}>Включить</button>;

  async function onLogout() {
    if (!confirm('Выйти? Переписка на этом телефоне удалится. Вернуть её можно, войдя с логином и паролем.')) return;
    await logout();
  }

  return (
    <div className="screen settings">
      <header className="header">
        <div className="header-row">
          <button className="icon-btn" onClick={onBack} aria-label="Назад"><BackIcon /></button>
          <div className="header-title">Настройки</div>
          <div className="icon-btn" />
        </div>
      </header>
      <div className="scroll grouped">
        <div className="profile">
          <Avatar name={me?.displayName} id={me?.id} size={76} />
          <div className="profile-name">{me?.displayName}</div>
          <div className="profile-sub">@{s.me?.username}</div>
        </div>

        <div className="group-title">Уведомления</div>
        <div className="group">
          <div className="row"><span className="row-label">Уведомления</span>{push}</div>
        </div>
        {pushError && <div className="group-note error">{pushError}</div>}
        {s.pushState === 'denied' && <div className="group-note">«Настройки» → «Уведомления» → «АСЬКА» → «Допуск уведомлений».</div>}

        <div className="group-title">Друзья</div>
        <div className="group">
          <button className="row row-btn" onClick={() => setInvite(true)}>Пригласить друга</button>
        </div>

        <div className="group-title">Коды безопасности</div>
        <div className="group">
          <div className="row column">
            <span className="row-label">Мой код</span>
            <span className="code">{myCode}</span>
          </div>
          {friends.map((u) => (
            <div className="row column" key={u.id}>
              <span className="row-label">{u.displayName} {u.keyChanged && <span className="danger-text">— ключ изменился!</span>}</span>
              <span className="code">{safetyCode(fromB64(u.pk))}</span>
            </div>
          ))}
        </div>
        <div className="group-note">
          Сверь коды при встрече: открой этот экран у себя и попроси друга открыть «Мой код» у него. Если цифры совпадают — вашу переписку никто не подменяет.
        </div>

        <div className="group spaced">
          <button className="row row-btn danger" onClick={onLogout}>Выйти</button>
        </div>
        <div className="group-note center">АСЬКА · версия 0.1</div>
      </div>
      {invite && <InviteSheet onClose={() => setInvite(false)} />}
    </div>
  );
}
