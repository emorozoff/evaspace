/* Установка на телефон.
   Android и десктоп дают событие beforeinstallprompt — его перехватываем и
   показываем свою кнопку. iOS такого события не даёт: там приложение ставится
   вручную через «Поделиться» → «На экран Домой», поэтому показываем шаги. */

import { useEffect, useState } from 'react';

export function isStandalone() {
  if (window.__UPASS_EMBED__) return true;   // внутри published-страницы ставить нечего
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

export function platform() {
  const ua = navigator.userAgent || '';
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (iOS) return /CriOS|FxiOS|EdgiOS/.test(ua) ? 'ios-other' : 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

let deferred = null;
window.addEventListener?.('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e;
  window.dispatchEvent(new Event('upass:installable'));
});

export function useInstall() {
  const [ready, setReady] = useState(!!deferred);
  const [installed, setInstalled] = useState(isStandalone());

  useEffect(() => {
    const onReady = () => setReady(true);
    const onInstalled = () => {
      deferred = null;
      setReady(false);
      setInstalled(true);
    };
    window.addEventListener('upass:installable', onReady);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('upass:installable', onReady);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  /** Возвращает 'accepted' | 'dismissed' | 'manual' — последнее, если системного окна нет. */
  const install = async () => {
    if (!deferred) return 'manual';
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') {
      deferred = null;
      setReady(false);
    }
    return outcome;
  };

  return { ready, installed, install, platform: platform() };
}

/* Пошаговая инструкция для тех, у кого системного окна установки нет. */
export const STEPS = {
  ios: [
    'Нажмите «Поделиться» — квадрат со стрелкой вверх в нижней панели Safari',
    'Пролистайте список и выберите «На экран Домой»',
    'Нажмите «Добавить» — иконка с печатью появится на рабочем столе',
  ],
  'ios-other': [
    'Откройте эту страницу в Safari — другие браузеры на iPhone не умеют ставить приложения',
    'Нажмите «Поделиться» и выберите «На экран Домой»',
  ],
  android: [
    'Откройте меню браузера — три точки справа вверху',
    'Выберите «Установить приложение» или «Добавить на главный экран»',
    'Подтвердите установку',
  ],
  desktop: [
    'В адресной строке нажмите значок установки — монитор со стрелкой',
    'Или откройте меню браузера и выберите «Установить UPASS»',
  ],
};
