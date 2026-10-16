// Окно-приставка «Аськи»: настройки и приглашение друга.
import { useEffect, useState } from 'react';
import { useStore } from '../useStore.ts';
import { enablePush, logout, myPublicKey, createInvite } from '../lib/store.ts';
import { safetyCode, fromB64 } from '../lib/crypto.ts';
import { isIOS, isStandalone } from '../lib/platform.ts';
import { getDesign, setDesign, soundEnabled, setSoundEnabled, play, flower } from '../lib/aska.ts';
import type { Design } from '../lib/aska.ts';
import { DesignPick } from './Welcome.tsx';
import { Win, Ico, Dialog } from './Win.tsx';

export type AuxKind = 'settings' | 'invite';

export function Aux({ kind, onBack }: { kind: AuxKind; onBack: () => void }) {
  return (
    <Win id="auxwin" className="aux" title={kind === 'invite' ? 'Позвать друга' : 'Настройки'}
      onBack={onBack} onClose={onBack} closeClass="close-aux">
      <div className="aux-body">{kind === 'invite' ? <Invite /> : <Settings />}</div>
    </Win>
  );
}

function Settings() {
  const s = useStore();
  const [design, setD] = useState<Design>(getDesign());
  const [sound, setSound] = useState(soundEnabled());
  const [myCode, setMyCode] = useState('');
  const [pushError, setPushError] = useState('');
  const [confirmExit, setConfirmExit] = useState(false);
  const me = s.me ? s.users[s.me.userId] : undefined;

  useEffect(() => { myPublicKey().then((pk) => pk && setMyCode(safetyCode(fromB64(pk)))); }, []);

  const friends = Object.values(s.users).filter((u) => u.id !== s.me?.userId)
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'ru'));

  let push;
  if (s.pushState === 'subscribed') push = <span>Включены ✓</span>;
  else if (s.pushState === 'denied') push = <span className="hint">Выключены в настройках iPhone: «Уведомления» → «АСЬКА».</span>;
  else if (s.pushState === 'unsupported') push = <span className="hint">{isIOS && !isStandalone ? 'Открой АСЬКУ с экрана «Домой».' : 'Этот браузер не умеет.'}</span>;
  else push = <button className="btn primary" onClick={() => enablePush().catch(() => setPushError('Не получилось включить.'))}>Включить</button>;

  return (
    <>
      <div className="wall-head">
        <Ico html={flower(s.connected ? 'online' : 'offline', 22)} />
        <span className="who"><b>{me?.displayName}</b><br /><span className="muted">@{s.me?.username}</span></span>
      </div>

      <div className="groupbox">
        <div className="legend">Вид</div>
        <DesignPick value={design} onChange={(d) => { setDesign(d); setD(d); }} />
      </div>

      <div className="groupbox">
        <div className="legend">Звук</div>
        <label className="row">
          <input type="checkbox" checked={sound} onChange={(e) => { setSoundEnabled(e.target.checked); setSound(e.target.checked); }} />
          <span className="sp">«О-оу» при новом сообщении и голоса смайлов</span>
          <button className="btn" onClick={() => play('incoming')} disabled={!sound}>Послушать</button>
        </label>
      </div>

      <div className="groupbox">
        <div className="legend">Уведомления</div>
        <div className="row"><span className="sp">Когда АСЬКА закрыта</span>{push}</div>
        {pushError && <div className="err">{pushError}</div>}
      </div>

      <div className="groupbox aska-codes">
        <div className="legend">Коды безопасности</div>
        <div className="row"><b>Мой код</b><span className="code">{myCode}</span></div>
        {friends.map((u) => (
          <div className="row" key={u.id}>
            <span>{u.displayName}{u.keyChanged && <span className="err"> — ключ изменился!</span>}</span>
            <span className="code">{safetyCode(fromB64(u.pk))}</span>
          </div>
        ))}
        <div className="hint mt">Сверь коды при встрече: попроси друга открыть «Мой код». Если цифры совпадают с теми, что у тебя напротив его ника, — вашу переписку никто не подменяет.</div>
      </div>

      <div className="right"><button className="btn" onClick={() => setConfirmExit(true)}>Выйти из АСЬКИ</button></div>
      <div className="center muted mt">АСЬКА · v1.0 · сквозное шифрование</div>

      {confirmExit && (
        <Dialog title="Выход" onClose={() => setConfirmExit(false)}
          buttons={<>
            <button className="btn primary" onClick={() => logout()}>Да</button>
            <button className="btn" onClick={() => setConfirmExit(false)}>Нет</button>
          </>}>
          Выйти из АСЬКИ? Переписка на этом телефоне удалится. Вернуть её можно, войдя с логином и паролем.
        </Dialog>
      )}
    </>
  );
}

function Invite() {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    createInvite().then((r) => setCode(r.code)).catch(() => setError('Не получилось создать приглашение. Проверь интернет.'));
  }, []);

  const link = code ? `${location.origin}/#invite=${code}` : '';
  const text = `Привет! Зову тебя в АСЬКУ — наш мессенджер с шифрованием.\nОткрой ссылку в Safari на iPhone: ${link}\nКод приглашения: ${code}`;

  async function share() {
    if (navigator.share) {
      try { await navigator.share({ text }); } catch { /* закрыли окно */ }
      return;
    }
    copy();
  }
  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); } catch { /* нет доступа */ }
  }

  return (
    <div className="groupbox">
      <div className="legend">Приглашение (одноразовое)</div>
      {error && <div className="err">{error}</div>}
      {!code && !error && <div className="hint">Создаю приглашение…</div>}
      {code && (
        <div className="col">
          <div className="uin-box">{code}</div>
          <div className="hint">По нему зайдёт один человек. Отправь другу ссылку — в ней есть инструкция.</div>
          <div className="aska-invite-link muted">{link}</div>
          <div className="row mt">
            <button className="btn" onClick={copy}>{copied ? 'Скопировано' : 'Скопировать'}</button>
            <span className="sp" />
            <button className="btn primary" onClick={share}>Отправить</button>
          </div>
        </div>
      )}
    </div>
  );
}
