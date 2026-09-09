import { useEffect, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { relative } from '../lib/time.js';
import { Btn, Card, Empty, List, Item, Note, TopBar } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';

export default function Notifications({ now }) {
  const { state, me, dispatch } = useStore();
  const list = state.notes.filter((n) => n.userId === me.id).sort((a, b) => b.at - a.at);

  useEffect(() => {
    const id = setTimeout(() => dispatch({ type: 'notesRead' }), 900);
    return () => clearTimeout(id);
  }, [dispatch]);

  return (
    <div className="screen" style={{ paddingTop: 0 }}>
      <TopBar title="Уведомления" sub="Не больше пяти в неделю" backTo="/" />
      <div className="stack-20">
        <PushPermission />
        {list.length === 0 ? (
          <Empty icon="bell" title="Пока тихо" text="Напомним про пятницу, пришлём пару недели и скажем, когда появится новое видео." />
        ) : (
          <List>
            {list.map((n) => (
              <Item
                key={n.id}
                lead={<div className="item__ic" style={{ color: n.read ? 'var(--ink-3)' : 'var(--accent)' }}><Icon name="bell" size={18} /></div>}
                title={n.title}
                sub={`${n.text} · ${relative(n.at, now)}`}
                subWrap
                onClick={() => { dispatch({ type: 'noteRead', id: n.id }); if (n.link) go(n.link); }}
              />
            ))}
          </List>
        )}
        <Note icon="settings">Уведомления выключаются одним переключателем в профиле.</Note>
      </div>
    </div>
  );
}

/** Пуши на телефоне: браузер спрашивает разрешение только по нажатию. */
function PushPermission() {
  const supported = typeof Notification !== 'undefined';
  const [status, setStatus] = useState(supported ? Notification.permission : 'unsupported');
  if (!supported || status !== 'default') return null;
  return (
    <Card variant="accent">
      <div className="t-md">Включить пуши на телефоне</div>
      <div className="t-sm dim" style={{ marginTop: 4, lineHeight: 1.5 }}>Напоминание про пятницу и пара недели придут, даже когда приложение закрыто.</div>
      <Btn variant="accent" size="sm" style={{ marginTop: 12 }} onClick={async () => setStatus(await Notification.requestPermission())}>Разрешить</Btn>
    </Card>
  );
}
