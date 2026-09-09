import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { Top, List, Item, Section, Sheet, Btn, Note } from '../components/UI.jsx';
import { Seal } from '../components/Art.jsx';
import ResidentCard from '../components/ResidentCard.jsx';
import Icon from '../components/Icons.jsx';
import { MOTTO, MOTTO_MASKED } from '../data/canon.js';
import { COMMUNITIES, SERVICE_CATS, SERVICE_ORDER, SERVICES } from '../data/life.js';
import { RESIDENTS } from '../data/people.js';
import { REGIONS } from '../data/regions.js';
import { bestMatches } from '../lib/match.js';
import { nf, plural } from '../lib/format.js';

/* Клуб — это справочник из трёх блоков: сообщества, люди, услуги.
   Всё, что про правила и личный рост, живёт в настройках. */
export default function Club() {
  const app = useApp();
  const { me } = app;
  const [knocks, setKnocks] = useState(0);
  const [door, setDoor] = useState(false);
  const [word, setWord] = useState('');
  const [tries, setTries] = useState(0);

  const open = COMMUNITIES.filter((c) => c.access === 'open');
  const byTopic = open.filter((c) => c.region === 'global').length;
  const byCity = open.filter((c) => c.region !== 'global').length;
  const clubs = COMMUNITIES.filter((c) => c.access === 'closed').length;
  const joined = COMMUNITIES.filter((c) => app.communities.includes(c.id));

  /* В витрине показываем разных людей: подряд четыре инвестора с одинаковым
     процентом выглядят как ошибка, хотя счёт честный. */
  const people = useMemo(() => {
    const seen = {};
    return bestMatches(me, RESIDENTS, 40)
      .filter(({ p }) => (seen[p.role] = (seen[p.role] || 0) + 1) <= 2)
      .slice(0, 4);
  }, [me]);
  const cats = useMemo(() => {
    const has = {};
    for (const s of SERVICES) has[s.cat] = (has[s.cat] || 0) + 1;
    return SERVICE_ORDER.map((id) => SERVICE_CATS.find((c) => c.id === id)).filter((c) => has[c.id]);
  }, []);
  const count = (id) => SERVICES.filter((s) => s.cat === id).length;

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
      <Top
        title="Клуб"
        sub={`${COMMUNITIES.length} сообществ · ${RESIDENTS.length} резидентов · ${SERVICES.length} услуг`}
        right={<button className="iconbtn" onClick={() => go('/profile')} aria-label="Настройки"><Icon name="settings" size={18} /></button>}
      />

      {/* — сообщества — */}
      <Section title="Сообщества" more="Все" onMore={() => go('/communities')}>
        <div className="tiles">
          <Tile emoji="🧭" title="По интересам" n={byTopic} onClick={() => go('/communities')} />
          <Tile emoji="📍" title="По городам" n={byCity} onClick={() => go('/communities')} />
          <Tile emoji="🔒" title="Закрытые клубы" n={clubs} onClick={() => go('/communities')} />
        </div>
        {joined.length > 0 && (
          <List>
            {joined.slice(0, 3).map((c) => (
              <Item
                key={c.id}
                lead={<div className="item__ic" style={{ background: `${c.tone}22`, color: c.tone, borderRadius: 14 }}><Icon name={c.icon} size={19} /></div>}
                title={c.name}
                sub={`Вы здесь · ${nf(c.members)} ${plural(c.members, 'участник', 'участника', 'участников')}`}
                onClick={() => go(`/chat/${c.id}`)}
              />
            ))}
          </List>
        )}
      </Section>

      {/* — резиденты — */}
      <Section title="Резиденты" more={`Вся база · ${RESIDENTS.length}`} onMore={() => go('/people')}>
        <div className="stack-8">
          {people.map(({ p }) => <ResidentCard key={p.id} p={p} me={me} />)}
        </div>
      </Section>

      {/* — услуги — */}
      <Section title="Услуги" more="Все услуги" onMore={() => go('/market')}>
        <div className="scroller">
          {cats.map((c) => (
            <button key={c.id} className="shelf" onClick={() => go('/market')}>
              <span className="shelf__e">{c.emoji}</span>
              <span className="shelf__t">{c.short}</span>
              <span className="shelf__n">{count(c.id)}</span>
            </button>
          ))}
        </div>
        <List>
          {SERVICES.slice(0, 2).map((s) => (
            <Item
              key={s.id}
              icon={SERVICE_CATS.find((c) => c.id === s.cat)?.icon || 'gift'}
              title={s.title}
              sub={`${s.region === 'global' ? 'везде' : REGIONS[s.region]?.name} · ${s.days} ${plural(s.days, 'день', 'дня', 'дней')}`}
              onClick={() => go(`/service/${s.id}`)}
            />
          ))}
        </List>
      </Section>

      <div className="center" style={{ paddingTop: 4 }}>
        <button onClick={knock} aria-label="Печать клуба" style={{ opacity: app.secret ? 1 : 0.5 }}>
          <Seal size={64} motto={app.secret ? MOTTO : MOTTO_MASKED} glow={app.secret} />
        </button>
        <div className="t-xs dim-2" style={{ marginTop: 8 }}>
          {app.secret ? 'Ложа открыта' : knocks ? '·'.repeat(knocks) : 'Печать сообщества'}
        </div>
      </div>

      <Sheet open={door} onClose={() => setDoor(false)} title="Дверь без таблички" sub="Три удара">
        <div className="stack">
          <div className="t-sm dim" style={{ lineHeight: 1.5 }}>Войти можно, назвав последнее слово девиза на печати.</div>
          <div className="center mono gold" style={{ fontSize: 13, letterSpacing: '0.22em' }}>{MOTTO_MASKED}</div>
          <input className="field center mono" style={{ letterSpacing: '0.3em', textTransform: 'uppercase' }} value={word} autoFocus placeholder="·····" onChange={(e) => setWord(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          {tries > 0 && <Note icon="key">{tries === 1 ? 'Не то слово. Подсказка — в разделе «Кодекс» в настройках.' : 'Пять традиций стоят в правильном порядке не случайно. Прочтите их первые буквы.'}</Note>}
          <Btn variant="gold" wide onClick={submit} disabled={!word.trim()}>Назвать слово</Btn>
        </div>
      </Sheet>
    </div>
  );
}

function Tile({ emoji, title, n, onClick }) {
  return (
    <button className="tile" onClick={onClick}>
      <span className="tile__ic" style={{ background: 'var(--surface-3)', fontSize: 19 }}>{emoji}</span>
      <span className="tile__t">{title}</span>
      <span className="tile__n figure">{n}</span>
    </button>
  );
}
