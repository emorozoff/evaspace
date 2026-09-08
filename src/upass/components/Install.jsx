import { useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { useInstall, STEPS } from '../lib/install.js';
import { List, Item, Sheet, Btn, Note } from './UI.jsx';
import { Seal } from './Art.jsx';
import Icon from './Icons.jsx';

const TITLES = {
  ios: 'Установить на iPhone',
  'ios-other': 'Откройте в Safari',
  android: 'Установить на Android',
  desktop: 'Установить на компьютер',
};

/* Приглашение поставить приложение на телефон. Прячется, если уже установлено
   или если резидент отказался. */
export default function Install({ compact }) {
  const app = useApp();
  const { ready, installed, install, platform } = useInstall();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (installed) return null;
  if (compact && app.seen['install-hidden']) return null;

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
        <div className="card">
          <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
            <Seal size={34} />
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="t-md">Поставьте UPASS на телефон</div>
              <div className="t-xs dim" style={{ marginTop: 3, lineHeight: 1.4 }}>
                Своя иконка, полный экран, работает без интернета
              </div>
            </div>
            <button className="iconbtn" style={{ width: 28, height: 28 }} aria-label="Скрыть" onClick={() => app.markSeen('install-hidden')}>
              <Icon name="x" size={13} />
            </button>
          </div>
          <Btn size="sm" variant="gold" wide style={{ marginTop: 12 }} disabled={busy} onClick={run}>
            {busy ? 'Устанавливаем…' : ready ? 'Установить' : TITLES[platform]}
          </Btn>
        </div>
      ) : (
        <List>
          <Item
            icon="passport"
            title="Установить приложение"
            sub={ready ? 'Иконка на рабочем столе, полный экран, работа без сети' : TITLES[platform]}
            onClick={run}
          />
        </List>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title={TITLES[platform]} sub="Три шага, занимает полминуты">
        <div className="stack">
          <div className="center" style={{ padding: '4px 0 8px' }}><Seal size={72} glow /></div>
          <List>
            {STEPS[platform].map((s, i) => (
              <Item
                key={i}
                lead={<div className="item__ic display" style={{ fontSize: 17 }}>{i + 1}</div>}
                title={<span style={{ whiteSpace: 'normal', fontWeight: 500, fontSize: 14, lineHeight: 1.45 }}>{s}</span>}
                chev={false}
              />
            ))}
          </List>
          <Note icon="check">После установки UPASS открывается со своей иконкой, без адресной строки и работает даже без интернета.</Note>
          <Btn variant="gold" wide onClick={() => setOpen(false)}>Понятно</Btn>
        </div>
      </Sheet>
    </>
  );
}
