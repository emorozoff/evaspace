import Icon from './Icons.jsx';

/* Четыре вкладки — больше не помещается в голове. Профиль, база знаний
   и рейтинг открываются с главной и из своих разделов. */
const TABS = [
  { to: '/', icon: 'home', label: 'Главная', match: ['', 'base', 'material', 'rating', 'invite', 'notes', 'profile', 'install', 'summit', 'city'] },
  { to: '/events', icon: 'calendar', label: 'События', match: ['events', 'event'] },
  { to: '/team', icon: 'team', label: 'Команда', match: ['team'] },
  { to: '/people', icon: 'people', label: 'Люди', match: ['people', 'person', 'coffee'] },
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
