import { useEffect, useState } from 'react';
import { createInvite } from '../lib/store.ts';
import { Sheet } from './Sheet.tsx';
import { ShareIcon } from './Icons.tsx';

export function InviteSheet({ onClose }: { onClose: () => void }) {
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
      try { await navigator.share({ text }); return; } catch { /* закрыли окно */ return; }
    }
    copy();
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch { /* нет доступа к буферу */ }
  }

  return (
    <Sheet title="Пригласить друга" onClose={onClose}>
      <div className="invite">
        {error && <div className="error">{error}</div>}
        {!code && !error && <div className="hint">Создаю приглашение…</div>}
        {code && (
          <>
            <div className="invite-code">{code}</div>
            <div className="hint">Приглашение одноразовое: по нему зайдёт один человек. Отправь другу ссылку — в ней есть инструкция.</div>
            <div className="invite-link">{link}</div>
            <button className="btn" onClick={share}><ShareIcon /> Отправить</button>
            <button className="btn secondary" onClick={copy}>{copied ? 'Скопировано' : 'Скопировать текст'}</button>
          </>
        )}
      </div>
    </Sheet>
  );
}
