import { useEffect, useState } from 'react';
import { useRoute, go } from './lib/router.jsx';
import { useStore } from './lib/store.jsx';
import BottomNav from './components/BottomNav.jsx';
import { Toast, Celebrate, StarField, Logo } from './components/UI.jsx';
import { IcSparkStar, IcClose, IcShare } from './components/Icons.jsx';

import Onboarding from './screens/Onboarding.jsx';
import Home from './screens/Home.jsx';
import Lesson from './screens/Lesson.jsx';
import Library from './screens/Library.jsx';
import { Courses, CourseDetail, ExpertPage } from './screens/Courses.jsx';
import { Market, ProductDetail, Cart } from './screens/Market.jsx';
import { Community, GroupPage } from './screens/Community.jsx';
import Profile from './screens/Profile.jsx';
import Report from './screens/Report.jsx';
import Cycle from './screens/Cycle.jsx';
import Admin from './screens/Admin.jsx';
import Eva from './screens/Eva.jsx';

const TABS = ['/home', '/library', '/courses', '/market', '/community', '/profile', '/report', '/cycle', '/'];

export default function App() {
  const { path } = useRoute();
  const { state, dispatch } = useStore();
  const clean = path.split('?')[0];
  const parts = clean.split('/').filter(Boolean);

  // до прохождения теста пускаем только на онбординг и страницу приглашения
  const publicRoute = clean === '/onboarding' || parts[0] === 'join';
  if (!state.onboarded && !publicRoute) return <Shell><Onboarding /></Shell>;

  let screen = null;
  switch (parts[0]) {
    case undefined:
    case 'home':
      screen = <Home />;
      break;
    case 'onboarding':
      screen = <Onboarding />;
      break;
    case 'join':
      screen = <Invite code={parts[1]} />;
      break;
    case 'lesson':
      screen = <Lesson dayParam={parts[1]} id={parts[2]} />;
      break;
    case 'library':
      screen = <Library key={path} />;
      break;
    case 'courses':
      screen = <Courses />;
      break;
    case 'course':
      screen = <CourseDetail id={parts[1]} />;
      break;
    case 'expert':
      screen = <ExpertPage id={parts[1]} />;
      break;
    case 'market':
      screen = <Market />;
      break;
    case 'product':
      screen = <ProductDetail id={parts[1]} />;
      break;
    case 'cart':
      screen = <Cart />;
      break;
    case 'community':
      screen = <Community />;
      break;
    case 'group':
      screen = <GroupPage id={parts[1]} />;
      break;
    case 'profile':
      screen = <Profile />;
      break;
    case 'report':
      screen = <Report />;
      break;
    case 'cycle':
      screen = <Cycle />;
      break;
    case 'admin':
      screen = <Admin />;
      break;
    case 'eva':
      screen = <Eva />;
      break;
    default:
      screen = <Home />;
  }

  const showNav = TABS.includes(clean) && state.onboarded;

  return (
    <Shell>
      {screen}
      {showNav && <BottomNav path={clean === '/' ? '/home' : clean} />}
      <Toast text={state.toast} onDone={() => dispatch({ type: 'clearToast' })} />
      <Celebrate trigger={state.celebrate || 0} />
      {showNav && <InstallHint />}
    </Shell>
  );
}

function Shell({ children }) {
  return <div className="app-shell">{children}</div>;
}

/* ---------- приглашение по реферальной ссылке ---------- */
function Invite({ code }) {
  const name = decodeURIComponent(code || '').split('-')[0];
  return (
    <div className="onb">
      <StarField n={46} seed={23} />
      <div className="onb-body" style={{ justifyContent: 'center', textAlign: 'center' }}>
        <div className="anim-pop" style={{ display: 'grid', placeItems: 'center', color: '#f6dfae', marginBottom: 16 }}>
          <IcSparkStar size={62} />
        </div>
        <div className="serif" style={{ fontSize: 31, lineHeight: 1.12 }}>
          Тебя пригласили
          <br />в Eva Space
        </div>
        <div className="small anim-up d2" style={{ opacity: 0.8, marginTop: 14, lineHeight: 1.6 }}>
          {name ? `${name[0].toUpperCase() + name.slice(1)} делится с тобой доступом.` : 'Подруга делится с тобой доступом.'}
          <br />Тебя ждёт скидка 20% на первый курс,
          <br />а её — бонус за приглашение.
        </div>
        <div className="anim-up d3" style={{ marginTop: 22 }}>
          <span className="chip" style={{ background: 'rgba(255,255,255,.14)', borderColor: 'rgba(255,255,255,.22)', color: '#fff' }}>
            промокод: {(code || 'eva-star').toUpperCase()}
          </span>
        </div>
        <div className="spacer" />
        <button className="btn gold anim-up d4" style={{ marginTop: 28 }} onClick={() => go('/onboarding')}>
          Принять приглашение
        </button>
      </div>
    </div>
  );
}

/* ---------- подсказка «добавь на экран Домой» ---------- */
function InstallHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const standalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const hidden = localStorage.getItem('eva.installHint') === 'off';
    if (ios && !standalone && !hidden) {
      const t = setTimeout(() => setShow(true), 3500);
      return () => clearTimeout(t);
    }
  }, []);

  if (!show) return null;
  return (
    <div
      style={{
        position: 'absolute', left: 12, right: 12, bottom: 'calc(var(--nav-h) + var(--safe-b) + 12px)', zIndex: 70,
        background: 'rgba(46,27,54,.96)', color: '#fff', borderRadius: 20, padding: '13px 14px',
        display: 'flex', alignItems: 'center', gap: 11, boxShadow: 'var(--sh-lg)', animation: 'fadeUp .4s ease both',
      }}
    >
      <span style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#f6dfae,#e6a0c4)', display: 'grid', placeItems: 'center', color: '#4a2058', flex: 'none' }}>
        <IcSparkStar size={18} />
      </span>
      <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.4 }}>
        Добавь Eva Space на экран «Домой»: <IcShare size={12} style={{ verticalAlign: -2 }} /> Поделиться → «На экран Домой»
      </div>
      <button
        style={{ color: '#fff', opacity: 0.7, flex: 'none' }}
        onClick={() => {
          localStorage.setItem('eva.installHint', 'off');
          setShow(false);
        }}
      >
        <IcClose size={16} />
      </button>
    </div>
  );
}
