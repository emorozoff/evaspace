// Живая гифка: эмодзи двигается на цветном фоне, вокруг эффект, подпись-мем; нажал — звучит голос героя
// (если это зверёнок или супер-смайл). Те же гифки — «живые гифки» стен (STICKERS) и гифки по ТЗ (НФТ).
import type { GifSpec } from '../lib/web3.ts';
import { playSuper } from '../lib/sfx.ts';

export function LiveGif({ spec, size = 'm', onClick }: { spec: GifSpec; size?: 's' | 'm' | 'l'; onClick?: () => void }) {
  const fx = spec.fx ? Array.from({ length: spec.fx === 'flash' ? 1 : 7 }, (_, i) => i) : [];
  const fxChar = spec.fx === 'rain' ? '💧' : spec.fx === 'confetti' ? ['🎊', '✨', '🎉'] : spec.fx === 'sparkle' ? '✨' : spec.fx === 'notes' ? ['🎵', '🎶'] : '';
  return (
    <span className={`aska-sticker ${size} an-${spec.anim}${spec.fx ? ` fx-${spec.fx}` : ''}${spec.snd ? ' has-snd' : ''}`}
      style={{ background: `linear-gradient(135deg, ${spec.bg[0]}, ${spec.bg[1]})` }} title={spec.cap}
      onClick={() => { if (spec.snd) playSuper(spec.snd); onClick?.(); }}>
      {fx.map((i) => <i key={i} className="st-fx" style={{ left: `${8 + i * 13}%`, animationDelay: `${(i * 0.37) % 1.6}s` }}>{Array.isArray(fxChar) ? fxChar[i % fxChar.length] : fxChar}</i>)}
      <span className="st-e">{spec.e}</span>
      {spec.cap && <b className="st-cap">{spec.cap}</b>}
      {spec.snd && <i className="st-snd" aria-label="со звуком">🔊</i>}
    </span>
  );
}
