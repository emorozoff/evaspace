import { go } from '../lib/router.jsx';
import Icon from './Icons.jsx';

const TABS = [
  { to: '/', icon: 'passport', label: 'Паспорт', match: [''] },
  { to: '/map', icon: 'globe', label: 'Карта', match: ['map', 'loc'] },
  { to: '/people', icon: 'users', label: 'Люди', match: ['people', 'p'] },
  { to: '/events', icon: 'calendar', label: 'События', match: ['events', 'event'] },
  { to: '/club', icon: 'grid', label: 'Клуб', match: ['club', 'circles', 'circle', 'market', 'service', 'capital', 'dao', 'codex', 'vault', 'degrees', 'lodge', 'rep', 'wallet', 'heritage', 'profile'] },
];

export default function Nav({ root }) {
  return (
    <nav className="tabbar">
      {TABS.map((t) => {
        const on = t.match.includes(root);
        return (
          <button key={t.to} className="tabbar__i" data-on={on} onClick={() => go(t.to)}>
            <Icon name={t.icon} size={21} width={on ? 1.9 : 1.6} />
            <span>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
