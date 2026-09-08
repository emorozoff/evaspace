import { go } from '../lib/router.jsx';
import Icon from './Icons.jsx';

const TABS = [
  { to: '/', icon: 'passport', label: 'Паспорт', match: [''] },
  { to: '/people', icon: 'users', label: 'Люди', match: ['people', 'p'] },
  { to: '/chats', icon: 'message', label: 'Чаты', match: ['chats', 'chat', 'dm'] },
  { to: '/map', icon: 'globe', label: 'Карта', match: ['map', 'loc'] },
  { to: '/club', icon: 'grid', label: 'Клуб', match: ['club', 'events', 'event', 'market', 'service', 'capital', 'dao', 'codex', 'vault', 'degrees', 'lodge', 'rep', 'wallet', 'heritage', 'profile'] },
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
