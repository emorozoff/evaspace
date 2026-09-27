import { go } from '../lib/router.jsx';
import Icon from './Icons.jsx';

/* Пять вкладок — каркас клуба: главная, события, услуги, люди, база. */
const TABS = [
  { to: '/', icon: 'home', label: 'Главная', match: ['', 'chats', 'chat', 'profile', 'news'] },
  { to: '/events', icon: 'calendar', label: 'События', match: ['events', 'event'] },
  { to: '/services', icon: 'bag', label: 'Услуги', match: ['services', 'service'] },
  { to: '/people', icon: 'users', label: 'Люди', match: ['people', 'p'] },
  { to: '/base', icon: 'book', label: 'База', match: ['base', 'material', 'community'] },
];

export default function Nav({ root, badge = 0 }) {
  return (
    <nav className="tabbar">
      {TABS.map((t) => {
        const on = t.match.includes(root);
        return (
          <button key={t.to} className="tabbar__i" data-on={on} onClick={() => go(t.to)} aria-current={on ? 'page' : undefined}>
            <span className="tabbar__ic">
              <Icon name={t.icon} size={22} width={on ? 1.9 : 1.6} />
              {t.to === '/' && badge > 0 && <span className="badge">{badge}</span>}
            </span>
            <span>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
