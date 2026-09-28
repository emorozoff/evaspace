import { useState } from 'react';
import { useInstall, STEPS } from '../lib/install.js';
import { List, Item, Sheet, Btn, Note } from './UI.jsx';
import { Mark } from './Art.jsx';
import Icon from './Icons.jsx';

const TITLES = {
  ios: 'Установить на iPhone',
  'ios-other': 'Откройте в Safari',
  android: 'Установить на Android',
  desktop: 'Установить на компьютер',
};

/* Приглашение поставить приложение на телефон. Прячется, если уже
   установлено или резидент нажал крестик — тогда остаётся в профиле. */
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
            <div className="xinst__k">На экран «Домой»</div>
            <div className="xinst__t">Поставьте UHOME на телефон</div>
            <div className="xinst__s">Своя иконка, полный экран, работает без интернета</div>
            <button className="xinst__go" disabled={busy} onClick={run}>
              <Icon name="download" size={14} />
              {busy ? 'Устанавливаем…' : ready ? 'Установить' : TITLES[platform]}
            </button>
          </div>
          <button className="xinst__x" aria-label="Скрыть" onClick={() => app.hide('install')}>
            <Icon name="x" size={14} />
          </button>
        </div>
      ) : (
        <List>
          <Item icon="download" title="Установить приложение" sub={ready ? 'Иконка на экране, полный экран, работа без сети' : TITLES[platform]} onClick={run} />
        </List>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title={TITLES[platform]} sub="Полминуты — и UHOME на экране «Домой»">
        <div className="stack">
          <div className="center" style={{ padding: '4px 0 8px', display: 'flex', justifyContent: 'center' }}><Mark size={72} ring glow /></div>
          <List>
            {STEPS[platform].map((s, i) => (
              <Item
                key={i}
                lead={<div className="item__ic xinst__n">{String(i + 1).padStart(2, '0')}</div>}
                title={<span style={{ whiteSpace: 'normal', fontWeight: 500, fontSize: 14, lineHeight: 1.45 }}>{s}</span>}
                chev={false}
              />
            ))}
          </List>
          <Note icon="check">После установки UHOME открывается со своей иконкой, без адресной строки и работает даже без интернета.</Note>
          <Btn variant="gold" wide onClick={() => setOpen(false)}>Понятно</Btn>
        </div>
      </Sheet>
    </>
  );
}
