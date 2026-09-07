import { useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { Card, Btn, Section, Sheet } from '../components/UI.jsx';
import { Seal, Avatar } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';
import { DEGREES, TIERS, MOTTO_MASKED, MOTTO } from '../data/canon.js';
import { usd, nf } from '../lib/format.js';

const MODULES = [
  { to: '/circles', icon: 'message', title: 'Сообщества', hint: 'Круги по интересам' },
  { to: '/market', icon: 'gift', title: 'Услуги', hint: 'Витрина резидентов' },
  { to: '/capital', icon: 'coin', title: 'Капитал UHT', hint: 'Доля и активы' },
  { to: '/dao', icon: 'gavel', title: 'Голосования', hint: 'Решения круга' },
  { to: '/vault', icon: 'book', title: 'База знаний', hint: 'Разборы и документы' },
  { to: '/codex', icon: 'scroll', title: 'Кодекс', hint: 'Законы и традиции' },
  { to: '/degrees', icon: 'key', title: 'Степени', hint: 'Уровни и переходы' },
  { to: '/rep', icon: 'hash', title: 'Репутация', hint: 'Цепочка событий' },
  { to: '/wallet', icon: 'wallet', title: 'Баллы', hint: 'Кэшбэк и рефералы' },
  { to: '/heritage', icon: 'shield', title: 'Наследие', hint: 'Кому перейдёт доля' },
  { to: '/events', icon: 'calendar', title: 'Слёты', hint: 'Квартальные встречи' },
  { to: '/profile', icon: 'settings', title: 'Профиль', hint: 'Настройки и доступ' },
];

const NOTES = [
  { icon: 'gavel', tone: '#8E7BF5', title: 'Голосование закрывается через 6 дней', text: 'Следующая локация UHOME: Лондон, Нью-Йорк или Кейптаун', to: '/dao' },
  { icon: 'users', tone: '#5FE0C8', title: 'Четверо новых в вашем городе', text: 'Круг ждёт вашего приветствия — первый отклик важнее всего', to: '/people' },
  { icon: 'chart', tone: '#D7B06A', title: 'Отчёт оценщика опубликован', text: 'NAV пересчитан, цена токена обновлена', to: '/capital' },
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
    if (n >= 3) {
      setDoor(true);
      setKnocks(0);
    }
  };

  const submit = () => {
    if (app.tryPassphrase(word)) {
      setDoor(false);
      setWord('');
      go('/lodge');
    } else {
      setTries((t) => t + 1);
      setWord('');
    }
  };

  return (
    <div className="screen stack-22">
      <div className="spread" style={{ marginTop: 4 }}>
        <div>
          <div className="eyebrow">Клуб</div>
          <h2 className="display" style={{ marginTop: 3 }}>Всё в одном месте</h2>
        </div>
        <button className="row" onClick={() => go('/')} style={{ gap: 9 }}>
          <div style={{ textAlign: 'right' }}>
            <div className="t-sm" style={{ fontWeight: 700 }}>{(me.name || 'Резидент').split(' ')[0]}</div>
            <div className="t-xs" style={{ color: deg.tone }}>{deg.roman} · {tier.name}</div>
          </div>
          <Avatar person={me} size={38} ring={deg.tone} />
        </button>
      </div>

      <div className="stack-8">
        {NOTES.map((n) => (
          <button key={n.title} className="card tap row-t" style={{ gap: 12 }} onClick={() => go(n.to)}>
            <div style={{ width: 32, height: 32, borderRadius: 11, flex: 'none', display: 'grid', placeItems: 'center', background: `${n.tone}1c`, color: n.tone }}>
              <Icon name={n.icon} size={16} />
            </div>
            <div className="grow">
              <div className="t-sm" style={{ fontWeight: 600 }}>{n.title}</div>
              <div className="t-xs dim" style={{ marginTop: 2 }}>{n.text}</div>
            </div>
            <Icon name="right" size={15} color="var(--ink-4)" />
          </button>
        ))}
      </div>

      <Section eyebrow="Разделы" title="Супер-приложение резидента">
        <div className="tiles">
          {MODULES.map((m) => (
            <button key={m.to} className="tile" onClick={() => go(m.to)}>
              <div className="tile__ic"><Icon name={m.icon} size={19} /></div>
              <div className="tile__t">{m.title}</div>
              <div className="t-xs dim-2" style={{ fontSize: 9.5, lineHeight: 1.2 }}>{m.hint}</div>
            </button>
          ))}
        </div>
      </Section>

      <div className="center" style={{ paddingTop: 6 }}>
        <button onClick={knock} aria-label="Печать клуба" style={{ opacity: app.secret ? 1 : 0.5, transition: '.3s' }}>
          <Seal size={72} motto={app.secret ? MOTTO : MOTTO_MASKED} glow={app.secret} />
        </button>
        <div className="t-xs dim-2" style={{ marginTop: 10, maxWidth: 260, margin: '10px auto 0', lineHeight: 1.5 }}>
          {app.secret
            ? 'Ложа открыта. Нажмите на печать, чтобы войти.'
            : 'Печать клуба. На ней выбит девиз, но последнее слово стёрлось.'}
        </div>
        {knocks > 0 && !app.secret && (
          <div className="t-xs gold" style={{ marginTop: 8 }}>{'·'.repeat(knocks)}</div>
        )}
      </div>

      <Sheet open={door} onClose={() => setDoor(false)} eyebrow="Три удара" title="Дверь без таблички">
        <div className="stack-16">
          <div className="t-sm dim" style={{ lineHeight: 1.55 }}>
            За этой дверью — то, о чём в открытой части клуба не говорят. Войти можно, назвав
            последнее слово девиза.
          </div>
          <div className="center">
            <div className="mono gold" style={{ fontSize: 13, letterSpacing: '0.22em' }}>{MOTTO_MASKED}</div>
          </div>
          <input
            className="field center mono"
            style={{ letterSpacing: '0.3em', textTransform: 'uppercase' }}
            value={word}
            autoFocus
            placeholder="·····"
            onChange={(e) => setWord(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          {tries > 0 && (
            <Card className="row-t" style={{ gap: 10 }}>
              <Icon name="key" size={16} color="var(--gold)" />
              <div className="t-xs dim">
                {tries === 1
                  ? 'Не то слово. Подсказка лежит в открытом доступе — в разделе «Кодекс».'
                  : 'Пять традиций записаны в правильном порядке не случайно. Прочтите их первые буквы.'}
              </div>
            </Card>
          )}
          <Btn variant="gold" wide onClick={submit} disabled={!word.trim()}>Назвать слово</Btn>
        </div>
      </Sheet>
    </div>
  );
}
