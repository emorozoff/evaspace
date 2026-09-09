import { useEffect, useState } from 'react';
import { Btn, Card, TopBar } from '../components/UI.jsx';
import { IcDownload, IcCheck } from '../components/Icons.jsx';

/* Приложение ставится на телефон без магазинов: иконка на экране,
   запуск на весь экран и работа без интернета. */

function platform() {
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

export default function Install() {
  const [prompt, setPrompt] = useState(window.__installPrompt || null);
  const [done, setDone] = useState(false);
  const installed = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const os = platform();

  useEffect(() => {
    const on = (e) => {
      e.preventDefault();
      window.__installPrompt = e;
      setPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', on);
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, []);

  const install = async () => {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setDone(true);
    window.__installPrompt = null;
    setPrompt(null);
  };

  return (
    <div className="screen">
      <TopBar title="Установить на телефон" sub="Без App Store и Google Play" />

      {installed || done ? (
        <Card kind="accent">
          <div className="row">
            <IcCheck size={22} className="t-lime" />
            <div>
              <div className="t-title">Приложение установлено</div>
              <div className="t-sub">Открывайте его с домашнего экрана — оно работает и без интернета.</div>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {prompt && (
            <Btn kind="primary" wide onClick={install}>
              <IcDownload /> Установить приложение
            </Btn>
          )}

          {os === 'ios' && (
            <Card style={{ marginTop: 10 }}>
              <div className="t-title">iPhone и iPad</div>
              <div className="stack s" style={{ marginTop: 8 }}>
                <div className="t-sub">1. Откройте эту страницу в Safari</div>
                <div className="t-sub">2. Нажмите «Поделиться» — квадрат со стрелкой внизу экрана</div>
                <div className="t-sub">3. Выберите «На экран “Домой”»</div>
                <div className="t-sub">4. Нажмите «Добавить» — появится иконка приложения</div>
              </div>
            </Card>
          )}

          {os === 'android' && (
            <Card style={{ marginTop: 10 }}>
              <div className="t-title">Android</div>
              <div className="stack s" style={{ marginTop: 8 }}>
                <div className="t-sub">1. Откройте страницу в Chrome</div>
                <div className="t-sub">2. Меню из трёх точек справа сверху</div>
                <div className="t-sub">3. «Установить приложение» или «Добавить на главный экран»</div>
              </div>
            </Card>
          )}

          {os === 'desktop' && (
            <Card style={{ marginTop: 10 }}>
              <div className="t-title">Компьютер</div>
              <div className="t-sub" style={{ marginTop: 6 }}>
                В Chrome или Edge — значок установки справа в адресной строке. Приложение откроется отдельным окном.
              </div>
            </Card>
          )}
        </>
      )}

      <Card style={{ marginTop: 10 }}>
        <div className="t-title">Что это даёт</div>
        <div className="stack s" style={{ marginTop: 8 }}>
          <div className="t-sub">· Иконка на экране телефона, как у обычного приложения</div>
          <div className="t-sub">· Запуск на весь экран, без адресной строки</div>
          <div className="t-sub">· Расписание и база открываются без интернета</div>
          <div className="t-sub">· Обновления приходят сами, ничего скачивать не нужно</div>
        </div>
      </Card>
    </div>
  );
}
