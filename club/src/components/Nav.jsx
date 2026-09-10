import Icon from './Icons.jsx';

/* Пять вкладок — больше в голове не держится. Профиль открывается
   по аватарке на главной, рейтинг и город — оттуда же. */
const TABS = [
  { to: '/', icon: 'home', label: 'Главная', match: ['', 'join', 'rating', 'invite', 'notes', 'profile', 'install', 'summit', 'city', 'chat', 'chats', 'sponsor', 'feed'] },
  { to: '/events', icon: 'calendar', label: 'События', match: ['events', 'event', 'archive'] },
  { to: '/team', icon: 'team', label: 'Команда', match: ['team'] },
  { to: '/people', icon: 'people', label: 'Люди', match: ['people', 'person', 'meet'] },
  { to: '/base', icon: 'book', label: 'База', match: ['base', 'material'] },
];

export default function Nav({ root, badge = 0 }) {
  return (
    <nav className="tabbar">
      {TABS.map((t) => {
        const on = t.match.includes(root);
        return (
          <a key={t.to} href={`#${t.to}`} className="tabbar__i" data-on={on}>
            <Icon name={t.icon} size={22} width={on ? 1.9 : 1.6} />
            <span>{t.label}</span>
            {t.to === '/' && badge > 0 && <span className="tabbar__badge">{badge}</span>}
          </a>
        );
      })}
    </nav>
  );
}
