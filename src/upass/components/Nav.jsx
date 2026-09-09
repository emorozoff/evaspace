import { go } from '../lib/router.jsx';
import Icon from './Icons.jsx';

const TABS = [
  { to: '/', icon: 'passport', label: 'Паспорт', match: [''] },
  { to: '/map', icon: 'compass', label: 'Регионы', match: ['map', 'region'] },
  { to: '/chats', icon: 'send', label: 'Чаты', match: ['chats', 'chat', 'dm', 'communities'] },
  { to: '/requests', icon: 'message', label: 'Запросы', match: ['requests', 'request'] },
  { to: '/club', icon: 'grid', label: 'Клуб', match: ['club', 'events', 'event', 'people', 'p', 'market', 'service', 'codex', 'vault', 'degrees', 'lodge', 'rep', 'profile'] },
];

export default function Nav({ root, unread = 0 }) {
  return (
    <nav className="tabbar">
      {TABS.map((t) => {
        const on = t.match.includes(root);
        return (
          <button key={t.to} className="tabbar__i" data-on={on} onClick={() => go(t.to)}>
            <Icon name={t.icon} size={22} width={on ? 1.9 : 1.6} />
            <span>{t.label}</span>
            {t.to === '/chats' && unread > 0 && <span className="tabbar__badge">{unread}</span>}
          </button>
        );
      })}
    </nav>
  );
}
