// Аватарка в Зумере: буквы имени на цветном градиенте и цветочек-статус в уголке (у голд — золотой).
// Аська — значок АСЬКИ, Батя и личные ИИ — эмодзи. В Миллениале аватарок нет: там цветочки, как в ICQ.
import type { User } from '../lib/store.ts';
import { markSvg } from '../lib/logo.ts';
import { userFlower } from '../lib/aska.ts';

const PALETTE = [
  ['#ff9a8b', '#ff5e7e'], ['#a18cd1', '#7b5cf0'], ['#5ee7a0', '#14b8a6'], ['#ffd36e', '#ff8a4c'], ['#6cc8ff', '#2f6bff'],
  ['#f78fd8', '#c13dd6'], ['#9be15d', '#2fb36a'], ['#ffb199', '#ff0844'], ['#7ee8fa', '#3a7bd5'], ['#c3a3ff', '#5b4bdb'],
];

export function initials(name: string) {
  const words = name.split(/\s+/).map((w) => w.match(/\p{L}/u)?.[0]).filter(Boolean) as string[];
  return (words.length > 1 ? words[0] + words[1] : words[0] || '?').toUpperCase();
}

export function Avatar({ user, online, size = 44, badge = true }: { user?: User; online?: boolean; size?: number; badge?: boolean }) {
  const st = { width: size, height: size, fontSize: Math.round(size * 0.4) };
  if (!user) return <span className="aska-av" style={st}>?</span>;
  if (user.kind === 'aska') return <span className="aska-av logo" style={st} dangerouslySetInnerHTML={{ __html: markSvg(size, 'circle') }} />;
  const [c1, c2] = PALETTE[user.id % PALETTE.length];
  const emoji = user.kind === 'friend' ? '👨' : user.kind === 'twin' ? '🤖' : '';
  return (
    <span className={`aska-av${emoji ? ' emo' : ''}${user.gold ? ' gold' : ''}`}
      style={{ ...st, ...(emoji ? { fontSize: Math.round(size * 0.56) } : {}), background: emoji ? undefined : `linear-gradient(135deg, ${c1}, ${c2})` }}>
      {emoji || initials(user.displayName)}
      {badge && user.kind !== 'twin' && <i className="fl" dangerouslySetInnerHTML={{ __html: userFlower(user, !!online, Math.max(12, Math.round(size * 0.34))) }} />}
    </span>
  );
}

// Кружок беседы или круга: эмодзи на мягком фоне
export function ChatAvatar({ emoji, size = 44 }: { emoji: string; size?: number }) {
  return <span className="aska-av emo chat" style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }}>{emoji}</span>;
}
