import { NAV_ICONS } from './Icons.jsx';

const TABS = [
  { path: '/', icon: 'home', label: 'Главная' },
  { path: '/schedule', icon: 'calendar', label: 'Расписание' },
  { path: '/team', icon: 'team', label: 'Команда' },
  { path: '/people', icon: 'people', label: 'Люди' },
  { path: '/base', icon: 'book', label: 'База' },
  { path: '/profile', icon: 'user', label: 'Профиль' },
];

export default function BottomNav({ path }) {
  return (
    <nav className="nav">
      {TABS.map((tab) => {
        const Icon = NAV_ICONS[tab.icon];
        const on = tab.path === '/' ? path === '/' : path.startsWith(tab.path);
        return (
          <a key={tab.path} href={`#${tab.path}`} className={on ? 'on' : ''}>
            <Icon size={21} />
            <span>{tab.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
