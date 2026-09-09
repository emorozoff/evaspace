import { useEffect, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { relative } from '../lib/time.js';
import { Btn, Card, Empty, TopBar } from '../components/UI.jsx';

export default function Notifications({ navigate, now }) {
  const { state, me, dispatch } = useStore();
  const list = state.notes.filter((n) => n.userId === me.id).sort((a, b) => b.at - a.at);

  useEffect(() => {
    const id = setTimeout(() => dispatch({ type: 'notesRead' }), 900);
    return () => clearTimeout(id);
  }, [dispatch]);

  return (
    <div className="screen">
      <TopBar title="Уведомления" sub="Не больше пяти в неделю" />

      <PushPermission />

      {list.length === 0 ? (
        <Empty title="Пока тихо" text="Напомним про пятницу, пришлём пару недели и скажем, когда в базе появится новое видео." />
      ) : (
        <Card>
          {list.map((n) => (
            <div
              key={n.id}
              className={`note-item ${n.read ? '' : 'unread'}`}
              onClick={() => {
                dispatch({ type: 'noteRead', id: n.id });
                if (n.link) navigate(n.link);
              }}
            >
              <div style={{ fontWeight: 700 }}>{n.title}</div>
              <div className="t-sub">{n.text}</div>
              <div className="t-dim">{relative(n.at, now)}</div>
            </div>
          ))}
        </Card>
      )}

      <div className="t-dim center" style={{ marginTop: 16 }}>
        Уведомления выключаются одним переключателем в профиле.
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
    <Card kind="accent">
      <div className="t-title">Включить пуши на телефоне</div>
      <div className="t-sub" style={{ marginTop: 3 }}>
        Тогда напоминание про пятницу и пара недели придут, даже когда приложение закрыто.
      </div>
      <Btn
        kind="primary"
        wide
        small
        style={{ marginTop: 12 }}
        onClick={async () => setStatus(await Notification.requestPermission())}
      >
        Разрешить уведомления
      </Btn>
    </Card>
  );
}
