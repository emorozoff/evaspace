import { IcHome, IcLibrary, IcCourses, IcMarket, IcCommunity, IcSparkStar } from './Icons.jsx';
import { go } from '../lib/router.jsx';

const ITEMS = [
  { path: '/home', label: 'Главная', Icon: IcHome },
  { path: '/library', label: 'Контент', Icon: IcLibrary },
  { path: '/courses', label: 'Курсы', Icon: IcCourses },
  { path: '/market', label: 'Маркет', Icon: IcMarket },
  { path: '/community', label: 'Сообщество', Icon: IcCommunity },
];

export default function BottomNav({ path }) {
  return (
    <>
      <button className="fab-eva" onClick={() => go('/eva')} aria-label="Спросить Еву">
        <span style={{ color: '#fff' }}><IcSparkStar size={26} /></span>
      </button>
      <nav className="bottom-nav">
        {ITEMS.map(({ path: p, label, Icon }) => {
          const on = path === p || (p === '/home' && path === '/');
          return (
            <button key={p} className={'nav-item' + (on ? ' on' : '')} onClick={() => go(p)}>
              <Icon size={22} />
              {label}
            </button>
          );
        })}
      </nav>
    </>
  );
}
