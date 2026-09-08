import { useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { Top, List, Item, Section, Sheet, Btn, Note } from '../components/UI.jsx';
import { Seal, Avatar } from '../components/Art.jsx';
import Install from '../components/Install.jsx';
import Icon from '../components/Icons.jsx';
import { DEGREES, MOTTO, MOTTO_MASKED } from '../data/canon.js';
import { DMS } from '../data/life.js';

const GROUPS = [
  { title: 'Жизнь сообщества', items: [
    { to: '/events', icon: 'calendar', title: 'Афиша', sub: 'Встречи, эфиры и три больших слёта' },
    { to: '/chats', icon: 'message', title: 'Чаты', sub: 'Личные и сообщества' },
    { to: '/people', icon: 'users', title: 'Резиденты', sub: 'Кто есть в сообществе' },
    { to: '/market', icon: 'briefcase', title: 'Услуги', sub: 'Переезд, документы, быт' },
  ] },
  { title: 'Правила и знание', items: [
    { to: '/codex', icon: 'scroll', title: 'Кодекс', sub: 'Законы, традиции, ритуалы' },
    { to: '/vault', icon: 'book', title: 'База знаний', sub: 'Разборы, шаблоны, записи эфиров' },
    { to: '/degrees', icon: 'key', title: 'Уровень и степень', sub: 'Как расти внутри' },
    { to: '/rep', icon: 'hash', title: 'Репутация', sub: 'Подтверждённые события' },
  ] },
  { title: 'Личное', items: [
    { to: '/profile', icon: 'settings', title: 'Профиль и настройки', sub: 'Регион, видимость, данные' },
  ] },
];

export default function Club() {
  const app = useApp();
  const { me } = app;
  const [knocks, setKnocks] = useState(0);
  const [door, setDoor] = useState(false);
  const [word, setWord] = useState('');
  const [tries, setTries] = useState(0);
  const deg = DEGREES.find((d) => d.n === me.degree) || DEGREES[0];
  const unread = DMS.filter((d) => d.unread && !app.seen['dm-' + d.with]).length;

  const knock = () => {
    if (app.secret) return go('/lodge');
    const n = knocks + 1;
    setKnocks(n);
    if (n >= 3) { setDoor(true); setKnocks(0); }
  };
  const submit = () => {
    if (app.tryPassphrase(word)) { setDoor(false); setWord(''); go('/lodge'); }
    else { setTries((t) => t + 1); setWord(''); }
  };

  return (
    <div className="screen stack-20">
      <Top title="Клуб" />

      <List>
        <Item
          lead={<Avatar person={me} size={48} ring={deg.tone} />}
          title={me.name || 'Резидент'}
          sub={`Travel · степень ${deg.roman} · ${deg.secret ? '·····' : deg.name}`}
          onClick={() => go('/profile')}
        />
      </List>

      {GROUPS.map((g) => (
        <Section key={g.title} title={g.title}>
          <List>
            {g.items.map((it) => (
              <Item
                key={it.to}
                icon={it.icon}
                title={it.title}
                sub={it.sub}
                meta={it.to === '/chats' && unread ? <span className="unread">{unread}</span> : undefined}
                onClick={() => go(it.to)}
              />
            ))}
          </List>
          {g.title === 'Личное' && <Install />}
        </Section>
      ))}

      <div className="center" style={{ paddingTop: 8 }}>
        <button onClick={knock} aria-label="Печать клуба" style={{ opacity: app.secret ? 1 : 0.5 }}>
          <Seal size={68} motto={app.secret ? MOTTO : MOTTO_MASKED} glow={app.secret} />
        </button>
        <div className="t-xs dim-2" style={{ marginTop: 8 }}>{app.secret ? 'Ложа открыта' : knocks ? '·'.repeat(knocks) : 'Печать сообщества'}</div>
      </div>

      <Sheet open={door} onClose={() => setDoor(false)} title="Дверь без таблички" sub="Три удара">
        <div className="stack">
          <div className="t-sm dim" style={{ lineHeight: 1.5 }}>Войти можно, назвав последнее слово девиза на печати.</div>
          <div className="center mono gold" style={{ fontSize: 13, letterSpacing: '0.22em' }}>{MOTTO_MASKED}</div>
          <input className="field center mono" style={{ letterSpacing: '0.3em', textTransform: 'uppercase' }} value={word} autoFocus placeholder="·····" onChange={(e) => setWord(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          {tries > 0 && <Note icon="key">{tries === 1 ? 'Не то слово. Подсказка — в разделе «Кодекс».' : 'Пять традиций стоят в правильном порядке не случайно. Прочтите их первые буквы.'}</Note>}
          <Btn variant="gold" wide onClick={submit} disabled={!word.trim()}>Назвать слово</Btn>
        </div>
      </Sheet>
    </div>
  );
}
