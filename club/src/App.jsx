import { useEffect, useRef, useState } from 'react';
import { useRoute } from './lib/router.jsx';
import { useStore } from './lib/store.jsx';
import { unreadCount } from './lib/logic.js';
import Nav from './components/Nav.jsx';
import { Empty } from './components/UI.jsx';
import Auth, { Paywall } from './screens/Auth.jsx';
import Onboarding from './screens/Onboarding.jsx';
import Splash, { splashNeeded } from './components/Splash.jsx';
import Home from './screens/Home.jsx';
import Events from './screens/Events.jsx';
import EventPage from './screens/EventPage.jsx';
import CityPage from './screens/CityPage.jsx';
import Team from './screens/Team.jsx';
import Rating from './screens/Rating.jsx';
import Base from './screens/Base.jsx';
import MaterialPage from './screens/MaterialPage.jsx';
import People from './screens/People.jsx';
import PersonPage from './screens/PersonPage.jsx';
import Meet from './screens/Meet.jsx';
import Chat, { Chats } from './screens/Chat.jsx';
import Sponsor from './screens/Sponsor.jsx';
import Archive from './screens/Archive.jsx';
import Feed from './screens/Feed.jsx';
import Summit from './screens/Summit.jsx';
import Invite from './screens/Invite.jsx';
import Profile from './screens/Profile.jsx';
import Notifications from './screens/Notifications.jsx';
import Install from './screens/Install.jsx';
import Admin from './screens/Admin.jsx';

export default function App() {
  const { parts } = useRoute();
  const { state, me } = useStore();
  const [now, setNow] = useState(() => Date.now());
  const [splash, setSplash] = useState(splashNeeded);

  // Часы приложения: от них зависят «через час», кнопка «Подключиться» и напоминания
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 20000);
    return () => clearInterval(id);
  }, []);

  useSystemNotifications(state, me);

  const cover = splash ? <Splash onDone={() => setSplash(false)} /> : null;

  if (!me) return <>{cover}<Auth invite={parts[0] === 'join' ? parts[1] : null} /></>;

  // Сначала знакомство, потом оплата: анкета лёгкая и объясняет, зачем клуб
  if (me.onboarded === false) return <>{cover}<Onboarding /></>;

  if (me.demo !== true && me.paid === false) {
    return (
      <div className="app">
        <div className="gate">
          <div className="center">
            <h1 className="h1">Оплатите, чтобы войти</h1>
            <p className="lead" style={{ marginTop: 8 }}>У этого номера нет активной подписки. После оплаты доступ откроется сам.</p>
          </div>
          <Paywall selected={me.package} />
        </div>
      </div>
    );
  }

  const [root = '', id] = parts;
  const screen = (() => {
    switch (root) {
      case '':
      case 'join': return <Home now={now} />;
      case 'events': return <Events now={now} />;
      case 'event': return <EventPage id={id} now={now} />;
      case 'city': return <CityPage id={id} now={now} />;
      case 'team': return <Team id={id} now={now} />;
      case 'rating': return <Rating />;
      case 'base': return <Base />;
      case 'material': return <MaterialPage id={id} />;
      case 'people': return <People now={now} />;
      case 'person': return <PersonPage id={id} now={now} />;
      case 'meet': return <Meet now={now} />;
      case 'chat': return <Chat id={parts.slice(1).join('/')} />;
      case 'chats': return <Chats />;
      case 'sponsor': return <Sponsor id={id} />;
      case 'archive': return <Archive now={now} />;
      case 'feed': return <Feed now={now} />;
      case 'summit': return <Summit now={now} />;
      case 'invite': return <Invite />;
      case 'notes': return <Notifications now={now} />;
      case 'install': return <Install />;
      case 'profile': return <Profile />;
      case 'admin': return <Admin now={now} />;
      default: return <div className="screen"><Empty title="Страница не найдена" text="Вернитесь через нижнее меню." /></div>;
    }
  })();

  return (
    <div className="app">
      {cover}
      {screen}
      {root !== 'admin' && <Nav root={root} badge={unreadCount(state, me.id)} />}
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
    const mine = state.notes.filter((n) => n.userId === user.id && !n.read);
    if (seen.current === null) {
      seen.current = new Set(mine.map((n) => n.id));
      return;
    }
    mine.filter((n) => !seen.current.has(n.id)).forEach((n) => {
      seen.current.add(n.id);
      if (!document.hidden) return;
      try {
        new Notification(n.title, { body: n.text, icon: import.meta.env.BASE_URL + 'icons/icon-192.png', tag: n.key });
      } catch {
        /* браузер может запретить — не страшно */
      }
    });
  }, [state.notes, user]);
}
