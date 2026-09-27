import { useApp } from './lib/store.jsx';
import { useRoute } from './lib/router.jsx';
import { totalUnread } from './lib/select.js';
import Nav from './components/Nav.jsx';
import Welcome from './screens/Welcome.jsx';
import Home from './screens/Home.jsx';
import Events from './screens/Events.jsx';
import EventPage from './screens/EventPage.jsx';
import Services from './screens/Services.jsx';
import ServicePage from './screens/ServicePage.jsx';
import People from './screens/People.jsx';
import PersonPage from './screens/PersonPage.jsx';
import Base from './screens/Base.jsx';
import MaterialPage from './screens/MaterialPage.jsx';
import CommunityPage from './screens/CommunityPage.jsx';
import Chats from './screens/Chats.jsx';
import Chat from './screens/Chat.jsx';
import Profile from './screens/Profile.jsx';
import NewsPage from './screens/NewsPage.jsx';
import Assistant from './screens/Assistant.jsx';
import Test from './screens/Test.jsx';
import Group from './screens/Group.jsx';
import AiFab from './components/AiFab.jsx';

/* Внутри переписки, чата с ассистентом и теста таб-бара нет. */
const FULLSCREEN = new Set(['chat', 'ai', 'test']);
/* Кнопка ассистента — на корнях вкладок; на главной он и так в круге и в карточке. */
const TABS = new Set(['events', 'services', 'people', 'base']);

export default function App() {
  const app = useApp();
  const { full, parts, query } = useRoute();
  const [root = '', id] = parts;

  if (app.stage !== 'member') {
    return (
      <>
        <div className="aura" />
        <div className="app">
          <Welcome />
          {app.toast && <div className="toast" style={{ bottom: 28 }}>{app.toast.text}</div>}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="aura" />
      <div className="app">
        <main key={full}>{screen(root, id, query)}</main>
        {TABS.has(root) && <AiFab app={app} />}
        {!FULLSCREEN.has(root) && <Nav root={root} badge={totalUnread(app)} />}
        {app.toast && <div className="toast" key={app.toast.at} style={FULLSCREEN.has(root) ? { bottom: 90 } : undefined}>{app.toast.text}</div>}
      </div>
    </>
  );
}

function screen(root, id, query) {
  switch (root) {
    case '': return <Home />;
    case 'events': return <Events query={query} />;
    case 'event': return <EventPage id={id} />;
    case 'services': return <Services query={query} />;
    case 'service': return <ServicePage id={id} />;
    case 'people': return <People query={query} />;
    case 'p': return <PersonPage id={id} />;
    case 'base': return <Base query={query} />;
    case 'material': return <MaterialPage id={id} />;
    case 'community': return <CommunityPage id={id} />;
    case 'chats': return <Chats />;
    case 'chat': return <Chat id={id} />;
    case 'profile': return <Profile />;
    case 'news': return <NewsPage id={id} />;
    case 'ai': return <Assistant query={query} />;
    case 'test': return <Test />;
    case 'group': return <Group id={id} />;
    default: return <Home />;
  }
}
