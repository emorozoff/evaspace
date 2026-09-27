import { useId } from 'react';
import { portraitSvg } from '../lib/portraits.js';

/* Портрет Евы или Адама в круге с тонкой золотой каймой. Рисунок — в
   lib/portraits.js (наш статичный SVG). В маленьком размере кадр
   приближается к лицу, чтобы черты читались. Появятся настоящие
   портреты — достаточно передать photo, картинка встанет в тот же круг. */

export function AvatarPortrait({ who = 'eva', size = 56, ring = true, photo, style }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const box = size <= 64 ? '15 12 90 90' : '0 0 120 120';
  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%', overflow: 'hidden', flex: 'none', position: 'relative', ...style,
      }}
    >
      {photo ? (
        <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <svg
          viewBox={box} width={size} height={size} aria-hidden="true" style={{ display: 'block' }}
          dangerouslySetInnerHTML={{ __html: portraitSvg(who, `p${who}${id}`) }}
        />
      )}
      {ring && <i style={{ position: 'absolute', inset: 0, borderRadius: '50%', boxShadow: 'inset 0 0 0 1px rgba(201,169,110,.45)', pointerEvents: 'none' }} />}
    </div>
  );
}
