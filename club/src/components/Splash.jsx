import { useEffect, useState } from 'react';

/* Заставка при запуске: из тонких линий собирается искра клуба.
   Показывается один раз за сессию — при возврате на вкладку не мешает. */

const KEY = 'iaiclub.splash';

export function splashNeeded() {
  try {
    if (sessionStorage.getItem(KEY)) return false;
    sessionStorage.setItem(KEY, '1');
    return true;
  } catch {
    return true; // приватный режим — покажем один раз и не будем настаивать
  }
}

export default function Splash({ onDone }) {
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => {
      setGone(true);
      onDone?.();
    }, 2200);
    return () => clearTimeout(id);
  }, [onDone]);

  if (gone) return null;

  return (
    <div className="splash" onClick={() => { setGone(true); onDone?.(); }}>
      <div className="splash__art">
        <svg viewBox="0 0 200 200">
          <defs>
            <linearGradient id="sp-g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#79d2bf" />
              <stop offset="100%" stopColor="#8e7bf5" />
            </linearGradient>
          </defs>
          <g className="splash__ring" stroke="url(#sp-g)" fill="none">
            <circle cx="100" cy="100" r="76" strokeOpacity="0.18" strokeWidth="1" />
            <circle cx="100" cy="100" r="76" strokeOpacity="0.7" strokeWidth="1.4" strokeDasharray="12 240" strokeLinecap="round" />
            <ellipse cx="100" cy="100" rx="76" ry="30" strokeOpacity="0.14" strokeWidth="1" />
          </g>
          <g stroke="url(#sp-g)" fill="none" strokeWidth="1" strokeOpacity="0.5">
            <path className="splash__line" d="M12 100h48" />
            <path className="splash__line" style={{ animationDelay: '0.1s' }} d="M188 100h-48" />
            <path className="splash__line" style={{ animationDelay: '0.2s' }} d="M100 12v48" />
            <path className="splash__line" style={{ animationDelay: '0.3s' }} d="M100 188v-48" />
          </g>
          <path
            className="splash__spark"
            fill="url(#sp-g)"
            d="M100 46c7.5 42.5 11.5 46.5 54 54-42.5 7.5-46.5 11.5-54 54-7.5-42.5-11.5-46.5-54-54 42.5-7.5 46.5-11.5 54-54z"
          />
        </svg>
      </div>
      <div className="center">
        <div className="splash__name">И АЙ КЛАБ</div>
        <div className="splash__sub">сезон второй</div>
      </div>
    </div>
  );
}
