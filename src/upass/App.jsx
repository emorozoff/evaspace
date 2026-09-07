import { useApp } from './lib/store.jsx';
import { useRoute } from './lib/router.jsx';
import Nav from './components/Nav.jsx';
import Onboarding from './screens/Onboarding.jsx';
import Home from './screens/Home.jsx';
import MapScreen from './screens/Map.jsx';
import Location from './screens/Location.jsx';
import People from './screens/People.jsx';
import Person from './screens/Person.jsx';
import Events from './screens/Events.jsx';
import Event from './screens/Event.jsx';
import Club from './screens/Club.jsx';
import Circles from './screens/Circles.jsx';
import Circle from './screens/Circle.jsx';
import Market from './screens/Market.jsx';
import Service from './screens/Service.jsx';
import Capital from './screens/Capital.jsx';
import Dao from './screens/Dao.jsx';
import Codex from './screens/Codex.jsx';
import Vault from './screens/Vault.jsx';
import Degrees from './screens/Degrees.jsx';
import Lodge from './screens/Lodge.jsx';
import Rep from './screens/Rep.jsx';
import Wallet from './screens/Wallet.jsx';
import Heritage from './screens/Heritage.jsx';
import Profile from './screens/Profile.jsx';

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

  return (
    <>
      <div className="aura" />
      <div className="app">
        <main key={path}>{render(root, id, query)}</main>
        <Nav root={root} />
        {app.toast && <div className="toast">{app.toast}</div>}
      </div>
    </>
  );
}

function render(root, id, query) {
  switch (root) {
    case '': return <Home />;
    case 'map': return <MapScreen />;
    case 'loc': return <Location id={id} />;
    case 'people': return <People query={query} />;
    case 'p': return <Person id={id} />;
    case 'events': return <Events />;
    case 'event': return <Event id={id} />;
    case 'club': return <Club />;
    case 'circles': return <Circles />;
    case 'circle': return <Circle id={id} />;
    case 'market': return <Market />;
    case 'service': return <Service id={id} />;
    case 'capital': return <Capital />;
    case 'dao': return <Dao />;
    case 'codex': return <Codex />;
    case 'vault': return <Vault />;
    case 'degrees': return <Degrees />;
    case 'lodge': return <Lodge />;
    case 'rep': return <Rep />;
    case 'wallet': return <Wallet />;
    case 'heritage': return <Heritage />;
    case 'profile': return <Profile />;
    default: return <Home />;
  }
}
