// Живые гифки: проверка формата (без зависимостей — нужна и в protocol.ts, и в service worker).
// Списки — те же, что в server/src/gifs.js (держать одинаковыми).
export interface GifSpec { e: string; cap: string; bg: [string, string]; anim: string; fx?: 'rain' | 'confetti' | 'sparkle' | 'notes' | 'flash'; snd?: string }
export const GIF_ANIMS = ['shake', 'wobble', 'zoom', 'drop', 'pulse', 'flicker', 'bob', 'wave', 'zoomfast', 'float', 'sway', 'spin', 'bounce', 'nod', 'beat', 'dance', 'tilt', 'boom', 'spinslow'];
export const ANIM_NAMES: Record<string, string> = { shake: 'трясётся', wobble: 'шатается', zoom: 'приближается', drop: 'падает', pulse: 'пульсирует', flicker: 'мигает',
  bob: 'качает головой', wave: 'машет', zoomfast: 'бах!', float: 'парит', sway: 'качается', spin: 'крутится', bounce: 'прыгает', nod: 'кивает', beat: 'бьётся', dance: 'танцует',
  tilt: 'думает', boom: 'взрыв', spinslow: 'медленно кружится' };
export const GIF_FX = ['rain', 'confetti', 'sparkle', 'notes', 'flash'] as const;
export const FX_NAMES: Record<string, string> = { rain: '💧 дождь', confetti: '🎊 конфетти', sparkle: '✨ искры', notes: '🎵 ноты', flash: '⚡ вспышка' };
export const GIF_PALETTES: Record<string, [string, string]> = {
  sun: ['#ffd23f', '#ff7a1a'], love: ['#ff8fb8', '#e8174f'], sad: ['#7ec8ff', '#2867c9'], rage: ['#ff5252', '#8e0000'],
  night: ['#3b2a6b', '#0d0d26'], nature: ['#7be08a', '#1f8f4e'], sea: ['#4fd1ff', '#1565ff'], money: ['#c6f24a', '#1f9d55'],
  party: ['#ff6fd8', '#ffd84a'], cool: ['#b06cff', '#2f6bff'], dino: ['#9be36b', '#2e7d32'], royal: ['#a3233b', '#c9a14a'],
  stone: ['#8a95a5', '#3b4250'], candy: ['#ffcfa8', '#ff8fa3'],
};
export const GIF_PRICE = 10;
const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*){1,3}$/u;
const HEX = /^#[0-9a-f]{6}$/i;

// Проверка гифки, пришедшей в сообщении: всё, что не из списков, — выкидываем
export function cleanGif(x: unknown): GifSpec | null {
  const s = x as Partial<GifSpec> | null;
  if (!s || typeof s !== 'object') return null;
  const e = String(s.e || '').replace(/\s+/g, '');
  if (!e || !EMOJI_ONLY.test(e)) return null;
  const cap = String(s.cap || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 28).toUpperCase();
  const bg = Array.isArray(s.bg) && s.bg.length === 2 && s.bg.every((c) => HEX.test(String(c))) ? [String(s.bg[0]), String(s.bg[1])] as [string, string] : GIF_PALETTES.sun;
  const anim = GIF_ANIMS.includes(String(s.anim)) ? String(s.anim) : 'bounce';
  const fx = (GIF_FX as readonly string[]).includes(String(s.fx)) ? s.fx : undefined;
  const snd = typeof s.snd === 'string' && /^\p{Extended_Pictographic}/u.test(s.snd) && s.snd.length <= 4 ? s.snd : undefined;
  return { e, cap, bg, anim, ...(fx ? { fx } : {}), ...(snd ? { snd } : {}) };
}
