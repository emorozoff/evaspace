import { useState } from 'react';
import { useInstall, STEPS } from '../lib/install.js';
import { List, Item, Sheet, Btn } from './UI.jsx';
import { Mark } from './Art.jsx';
import Icon from './Icons.jsx';

const TITLES = {
  ios: 'Установить на iPhone',
  'ios-other': 'Откройте в Safari',
  android: 'Установить на Android',
  desktop: 'Установить на компьютер',
};
const SUBS = {
  ios: 'Своя иконка, полный экран, работает без интернета',
  'ios-other': 'Другие браузеры на iPhone не умеют ставить приложения',
  android: 'Своя иконка, полный экран, работает без интернета',
  desktop: 'Отдельное окно без адресной строки, работает без интернета',
};

/* Приглашение поставить приложение. Заголовок — по платформе, кнопка —
   просто «Установить». Прячется, если уже установлено или его скрыли. */
export default function Install({ app, compact }) {
  const { ready, installed, install, platform } = useInstall();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (installed) return null;
  if (compact && app.hidden.install) return null;

  const run = async () => {
    setBusy(true);
    const res = await install();
    setBusy(false);
    if (res === 'manual') setOpen(true);
    if (res === 'accepted') app.say('Приложение установлено');
  };

  return (
    <>
      {compact ? (
        <div className="xinst">
          <span className="xinst__mark"><Mark size={30} /></span>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="xinst__k">Приложение</div>
            <div className="xinst__t">{TITLES[platform]}</div>
            <div className="xinst__s">{SUBS[platform]}</div>
            <button className="xinst__go" disabled={busy} onClick={run}>
              <Icon name="download" size={14} />
              {busy ? 'Устанавливаем…' : platform === 'ios-other' ? 'Как это сделать' : 'Установить'}
            </button>
          </div>
          <button className="xinst__x" aria-label="Скрыть" onClick={() => app.hide('install')}>
            <Icon name="x" size={14} />
          </button>
        </div>
      ) : (
        <List>
          <Item icon="download" title={TITLES[platform]} sub={ready ? 'Иконка на экране, полный экран, работа без сети' : SUBS[platform]} onClick={run} />
        </List>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title={TITLES[platform]} sub="Полминуты — и UHOME на экране «Домой»">
        <div className="stack">
          <div className="steps">
            {STEPS[platform].map((s, i) => (
              <div key={i} className="step"><span className="step__n">{String(i + 1).padStart(2, '0')}</span><span className="step__t">{s}</span></div>
            ))}
          </div>
          <div className="note-line">После установки UHOME открывается со своей иконкой, без адресной строки и работает без интернета.</div>
          <Btn variant="gold" wide onClick={() => setOpen(false)}>Понятно</Btn>
        </div>
      </Sheet>
    </>
  );
}
