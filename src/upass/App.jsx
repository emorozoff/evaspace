import { useApp } from './lib/store.jsx';
import { useRoute } from './lib/router.jsx';
import Nav from './components/Nav.jsx';
import { DMS } from './data/life.js';
import Onboarding from './screens/Onboarding.jsx';
import Home from './screens/Home.jsx';
import MapScreen from './screens/Map.jsx';
import Region from './screens/Region.jsx';
import People from './screens/People.jsx';
import Person from './screens/Person.jsx';
import Communities from './screens/Communities.jsx';
import Chats from './screens/Chats.jsx';
import Chat from './screens/Chat.jsx';
import Requests from './screens/Requests.jsx';
import Request from './screens/Request.jsx';
import Events from './screens/Events.jsx';
import Event from './screens/Event.jsx';
import Market from './screens/Market.jsx';
import Service from './screens/Service.jsx';
import Club from './screens/Club.jsx';
import Codex from './screens/Codex.jsx';
import Vault from './screens/Vault.jsx';
import Degrees from './screens/Degrees.jsx';
import Lodge from './screens/Lodge.jsx';
import Rep from './screens/Rep.jsx';
import Profile from './screens/Profile.jsx';
import Trips from './screens/Trips.jsx';

/* Экраны, которые занимают всю высоту и прячут таб-бар. */
const FULLSCREEN = new Set(['chat', 'dm']);

export default function App() {
  const app = useApp();
  const { path, parts, query } = useRoute();
  const root = parts[0] || '';
  const id = parts[1];

  if (app.stage !== 'member') {
    return (
      <>
        <div className="aura" />
        <div className="app">
          <Onboarding />
          {app.toast && <div className="toast" style={{ bottom: 28 }}>{app.toast}</div>}
        </div>
      </>
    );
  }

  const unread = DMS.filter((d) => d.unread && !app.seen['dm-' + d.with]).length;

  return (
    <>
      <div className="aura" />
      <div className="app">
        <main key={path}>{render(root, id, query)}</main>
        {/* внутри разговора таб-бара нет: поле ввода стоит на его месте */}
        {!FULLSCREEN.has(root) && <Nav root={root} unread={unread} />}
        {app.toast && <div className="toast">{app.toast}</div>}
      </div>
    </>
  );
}

function render(root, id, query) {
  switch (root) {
    case '': return <Home />;
    case 'map': return <MapScreen />;
    case 'region': return <Region id={id} />;
    case 'people': return <People query={query} />;
    case 'p': return <Person id={id} />;
    case 'communities': return <Communities />;
    case 'chats': return <Chats />;
    case 'chat': return <Chat kind="community" id={id} />;
    case 'dm': return <Chat kind="dm" id={id} />;
    case 'requests': return <Requests />;
    case 'request': return <Request id={id} />;
    case 'events': return <Events />;
    case 'event': return <Event id={id} />;
    case 'market': return <Market />;
    case 'service': return <Service id={id} />;
    case 'club': return <Club />;
    case 'codex': return <Codex />;
    case 'vault': return <Vault />;
    case 'degrees': return <Degrees />;
    case 'lodge': return <Lodge />;
    case 'rep': return <Rep />;
    case 'profile': return <Profile />;
    case 'trips': return <Trips query={query} />;
    default: return <Home />;
  }
}
