// Где запущено приложение: iPhone, установлено ли на экран «Домой», есть ли пуши.
export const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent)
  || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);

export const isStandalone = (navigator as unknown as { standalone?: boolean }).standalone === true
  || window.matchMedia('(display-mode: standalone)').matches;

export const pushSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export const isTouch = window.matchMedia('(pointer: coarse)').matches;

export function setBadge(n: number) {
  const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
  try {
    if (n > 0) nav.setAppBadge?.(n)?.catch(() => {});
    else nav.clearAppBadge?.()?.catch(() => {});
  } catch { /* не поддерживается */ }
}
