import { useEffect, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { Btn, Sheet } from '../components/UI.jsx';
import Icon from './Icons.jsx';

/* Предложение поставить приложение — сразу после входа, один раз.
   На Android и в десктопных Chrome установка происходит по нажатию:
   браузер уже отдал нам событие beforeinstallprompt. На iPhone такого
   события нет, поэтому там показываем два коротких шага. */

const isIOS = () => {
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

export const standalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

export default function InstallGate() {
  const { state, dispatch } = useStore();
  const [prompt, setPrompt] = useState(window.__installPrompt || null);
  const [busy, setBusy] = useState(false);
  const open = !state.seenInstall && !standalone();

  useEffect(() => {
    const on = (e) => { e.preventDefault(); window.__installPrompt = e; setPrompt(e); };
    window.addEventListener('beforeinstallprompt', on);
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, []);

  if (!open) return null;

  // Одно нажатие делает всё: ставит приложение и включает уведомления
  const install = async () => {
    setBusy(true);
    try {
      if (prompt) {
        prompt.prompt();
        await prompt.userChoice;
        window.__installPrompt = null;
        setPrompt(null);
      }
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    } catch {
      /* пользователь закрыл системное окно — это не ошибка */
    }
    setBusy(false);
    dispatch({ type: 'seenInstall' });
  };

  const ios = isIOS();

  return (
    <Sheet open onClose={() => dispatch({ type: 'seenInstall' })} title="Поставьте клуб на телефон" sub="Без App Store и Google Play — иконка на экране и уведомления">
      <div className="stack">
        <div className="gains">
          <Gain icon="home" title="Иконка на экране" text="Открывается как обычное приложение" />
          <Gain icon="bell" title="Уведомления" text="Метчи, ответы и напоминания о встречах" />
          <Gain icon="eye" title="Весь экран" text="Без адресной строки, работает офлайн" />
        </div>

        {ios ? (
          <div className="rules">
            <div className="rules__i"><span className="rules__n">1</span><span>Нажмите «Поделиться» — квадрат со стрелкой внизу Safari.</span></div>
            <div className="rules__i"><span className="rules__n">2</span><span>Выберите «На экран “Домой”» и нажмите «Добавить».</span></div>
          </div>
        ) : (
          <>
            <Btn variant="accent" wide icon="download" disabled={busy} onClick={install}>
              {prompt ? 'Установить и включить уведомления' : 'Включить уведомления'}
            </Btn>
            {/* Браузер отдаёт установку одной кнопкой не всегда — тогда подсказываем путь */}
            {!prompt && (
              <div className="t-xs dim-2 center">
                Установка: меню браузера → «Установить приложение» или «Добавить на главный экран».
              </div>
            )}
          </>
        )}

        <Btn variant="quiet" wide onClick={() => dispatch({ type: 'seenInstall' })}>Позже</Btn>
        <div className="t-xs dim-2 center">Вернуться к установке можно в профиле.</div>
      </div>
    </Sheet>
  );
}

function Gain({ icon, title, text }) {
  return (
    <div className="gain">
      <span className="gain__ic"><Icon name={icon} size={18} /></span>
      <div>
        <div className="t-md">{title}</div>
        <div className="t-xs dim-2" style={{ marginTop: 2 }}>{text}</div>
      </div>
    </div>
  );
}
