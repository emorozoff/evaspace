import { useEffect, useState } from 'react';
import { Btn, Card, List, Item, TopBar } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';

/* Приложение ставится без магазинов: иконка на экране, весь экран, офлайн. */

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
    const on = (e) => { e.preventDefault(); window.__installPrompt = e; setPrompt(e); };
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

  const steps = os === 'ios'
    ? ['Откройте эту страницу в Safari', 'Нажмите «Поделиться» — квадрат со стрелкой', 'Выберите «На экран “Домой”»', 'Нажмите «Добавить»']
    : os === 'android'
    ? ['Откройте страницу в Chrome', 'Меню из трёх точек справа сверху', '«Установить приложение» или «Добавить на главный экран»']
    : ['В Chrome или Edge — значок установки справа в адресной строке', 'Приложение откроется отдельным окном'];

  return (
    <div className="screen" style={{ paddingTop: 0 }}>
      <TopBar title="Установить на телефон" sub="Без App Store и Google Play" backTo="/profile" />
      <div className="stack-20">
        {installed || done ? (
          <Card variant="accent" className="row">
            <Icon name="check" size={22} color="var(--accent)" />
            <div><div className="t-md">Приложение установлено</div><div className="t-xs dim-2">Открывайте его с домашнего экрана — работает и без интернета.</div></div>
          </Card>
        ) : (
          <>
            {prompt && <Btn variant="accent" wide icon="download" onClick={install}>Установить приложение</Btn>}
            <List>
              {steps.map((s, i) => <Item key={i} lead={<div className="item__ic num" style={{ fontWeight: 800 }}>{i + 1}</div>} title={s} chev={false} />)}
            </List>
          </>
        )}
        <List>
          <Item icon="home" title="Иконка на экране" sub="Как у обычного приложения" chev={false} />
          <Item icon="eye" title="Весь экран" sub="Без адресной строки браузера" chev={false} />
          <Item icon="download" title="Работает офлайн" sub="Расписание и база открываются без сети" chev={false} />
          <Item icon="refresh" title="Обновляется сама" sub="Ничего скачивать не нужно" chev={false} />
        </List>
      </div>
    </div>
  );
}
