import { useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { Top, List, Item, Section, Sheet, Btn, Note } from '../components/UI.jsx';
import { Seal, Avatar } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';
import { DEGREES, TIERS, MOTTO_MASKED, MOTTO } from '../data/canon.js';
import { nf } from '../lib/format.js';

const GROUPS = [
  { title: 'Сообщество', items: [
    { to: '/events', icon: 'calendar', title: 'События', sub: 'Лента, календарь, слёты' },
    { to: '/market', icon: 'gift', title: 'Услуги резидентов', sub: 'Витрина и кэшбэк' },
    { to: '/chats', icon: 'message', title: 'Круги по интересам', sub: 'ИТ, ИИ, недвижимость, капитал…' },
  ] },
  { title: 'Капитал', items: [
    { to: '/capital', icon: 'coin', title: 'Капитал UHT', sub: 'Доля, активы, цена токена' },
    { to: '/dao', icon: 'gavel', title: 'Голосования', sub: 'Решения общего собрания' },
    { to: '/wallet', icon: 'wallet', title: 'Баллы и приглашения', sub: 'Кэшбэк и рефералы' },
  ] },
  { title: 'Устав', items: [
    { to: '/codex', icon: 'scroll', title: 'Кодекс', sub: 'Законы, традиции, ритуалы' },
    { to: '/vault', icon: 'book', title: 'База знаний', sub: 'Разборы, документы, шаблоны' },
    { to: '/degrees', icon: 'key', title: 'Уровни и степени', sub: 'Как переходить выше' },
    { to: '/rep', icon: 'hash', title: 'Репутация', sub: 'Цепочка подтверждённых событий' },
  ] },
  { title: 'Личное', items: [
    { to: '/heritage', icon: 'shield', title: 'Наследие', sub: 'Кому перейдёт доля' },
    { to: '/profile', icon: 'settings', title: 'Профиль и настройки', sub: 'Видимость, данные, выход' },
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
  const tier = TIERS.find((t) => t.n === me.tier) || TIERS[0];

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
          sub={`${tier.name} · степень ${deg.roman} · ${nf(app.points)} баллов`}
          onClick={() => go('/profile')}
        />
      </List>

      <List>
        <Item icon="gavel" title="Голосование о следующей локации" sub="Закрывается через 6 дней" meta={<span className="unread">1</span>} chev={false} onClick={() => go('/dao')} />
        <Item icon="chart" title="Опубликован отчёт оценщика" sub="NAV пересчитан, цена токена обновлена" onClick={() => go('/capital')} />
      </List>

      {GROUPS.map((g) => (
        <Section key={g.title} title={g.title}>
          <List>
            {g.items.map((it) => <Item key={it.to} icon={it.icon} title={it.title} sub={it.sub} onClick={() => go(it.to)} />)}
          </List>
        </Section>
      ))}

      <div className="center" style={{ paddingTop: 8 }}>
        <button onClick={knock} aria-label="Печать клуба" style={{ opacity: app.secret ? 1 : 0.55 }}>
          <Seal size={72} motto={app.secret ? MOTTO : MOTTO_MASKED} glow={app.secret} />
        </button>
        <div className="t-xs dim-2" style={{ marginTop: 8 }}>{app.secret ? 'Ложа открыта' : knocks ? '·'.repeat(knocks) : 'Печать клуба'}</div>
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
