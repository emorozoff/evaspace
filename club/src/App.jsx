import { useEffect, useRef, useState } from 'react';
import { useRoute } from './lib/router.jsx';
import { useStore } from './lib/store.jsx';
import BottomNav from './components/BottomNav.jsx';
import Auth, { Paywall } from './screens/Auth.jsx';
import Home from './screens/Home.jsx';
import Schedule from './screens/Schedule.jsx';
import EventPage from './screens/EventPage.jsx';
import CityPage from './screens/CityPage.jsx';
import Team from './screens/Team.jsx';
import TeamPage from './screens/TeamPage.jsx';
import Rating from './screens/Rating.jsx';
import Base from './screens/Base.jsx';
import MaterialPage from './screens/MaterialPage.jsx';
import People from './screens/People.jsx';
import PersonPage from './screens/PersonPage.jsx';
import Coffee from './screens/Coffee.jsx';
import Summit from './screens/Summit.jsx';
import Invite from './screens/Invite.jsx';
import Profile from './screens/Profile.jsx';
import Notifications from './screens/Notifications.jsx';
import Install from './screens/Install.jsx';
import Admin from './screens/Admin.jsx';
import { Empty } from './components/UI.jsx';

export default function App() {
  const { path, parts, navigate } = useRoute();
  const { state, me } = useStore();
  const [now, setNow] = useState(() => Date.now());

  // Часы приложения: от них зависят «через час», кнопка «Подключиться» и напоминания
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 20000);
    return () => clearInterval(id);
  }, []);

  useSystemNotifications(state, me);

  if (!me) return <Auth invite={parts[0] === 'join' ? parts[1] : null} />;

  if (me.demo !== true && me.paid === false) {
    return (
      <div className="paywall">
        <div className="center stack s">
          <h1 className="t-huge">Оплатите, чтобы войти</h1>
          <div className="t-sub">У этого номера нет активной подписки. После оплаты доступ откроется автоматически.</div>
        </div>
        <Paywall selected={me.package} />
      </div>
    );
  }

  const screen = () => {
    const [head, id] = parts;
    switch (head) {
      case undefined:
      case 'join':
        return <Home navigate={navigate} now={now} />;
      case 'schedule':
        return <Schedule navigate={navigate} now={now} />;
      case 'event':
        return <EventPage id={id} navigate={navigate} now={now} />;
      case 'city':
        return <CityPage id={id} navigate={navigate} now={now} />;
      case 'team':
        return id ? <TeamPage id={id} navigate={navigate} now={now} /> : <Team navigate={navigate} now={now} />;
      case 'rating':
        return <Rating navigate={navigate} />;
      case 'base':
        return id ? <MaterialPage id={id} /> : <Base navigate={navigate} />;
      case 'people':
        return <People navigate={navigate} now={now} />;
      case 'person':
        return <PersonPage id={id} navigate={navigate} />;
      case 'coffee':
        return <Coffee navigate={navigate} now={now} />;
      case 'summit':
        return <Summit navigate={navigate} now={now} />;
      case 'invite':
        return <Invite />;
      case 'notes':
        return <Notifications navigate={navigate} now={now} />;
      case 'install':
        return <Install />;
      case 'profile':
        return <Profile navigate={navigate} />;
      case 'admin':
        return <Admin navigate={navigate} now={now} />;
      default:
        return <Empty title="Страница не найдена" text="Вернитесь на главную через нижнее меню." />;
    }
  };

  return (
    <div className="app">
      {screen()}
      {path !== '/admin' && <BottomNav path={path} />}
      <Toast />
    </div>
  );
}

function Toast() {
  const { state } = useStore();
  const [text, setText] = useState(null);

  useEffect(() => {
    if (!state.toast) return;
    setText(state.toast.text);
    const id = setTimeout(() => setText(null), 2200);
    return () => clearTimeout(id);
  }, [state.toast]);

  return text ? <div className="toast">{text}</div> : null;
}

/** Пуш на телефоне, когда приложение свёрнуто, — если участник разрешил уведомления. */
function useSystemNotifications(state, user) {
  const seen = useRef(null);

  useEffect(() => {
    if (!user || user.notifications === false) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    const mine = state.notes.filter((n) => n.userId === user.id && !n.read).sort((a, b) => b.at - a.at);
    if (seen.current === null) {
      seen.current = new Set(mine.map((n) => n.id));
      return;
    }
    const fresh = mine.filter((n) => !seen.current.has(n.id));
    fresh.forEach((n) => {
      seen.current.add(n.id);
      if (document.hidden) {
        try {
          new Notification(n.title, { body: n.text, icon: import.meta.env.BASE_URL + 'icons/icon-192.png', tag: n.key });
        } catch {
          /* браузер может запретить — не страшно */
        }
      }
    });
  }, [state.notes, user]);
}
