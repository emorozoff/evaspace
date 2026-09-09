import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { Top, List, Item, Section, Seg, Sheet, Btn, Note, Search, Chip, Scroller } from '../components/UI.jsx';
import { Seal } from '../components/Art.jsx';
import ResidentCard from '../components/ResidentCard.jsx';
import { CommunityRow } from './Communities.jsx';
import Icon from '../components/Icons.jsx';
import { MOTTO, MOTTO_MASKED } from '../data/canon.js';
import { COMMUNITIES, SERVICES } from '../data/life.js';
import { RESIDENTS } from '../data/people.js';
import { REGIONS } from '../data/regions.js';
import { communitiesFor } from '../lib/select.js';
import { bestMatches } from '../lib/match.js';
import { plural } from '../lib/format.js';

/* Клуб — две вкладки: люди и сообщества. Деление сообществ на интересы,
   города и закрытые клубы стало обычным фильтром внутри вкладки. */

const GROUPS = [
  { id: 'all', name: 'Все' },
  { id: 'topic', name: 'По интересам' },
  { id: 'city', name: 'По городам' },
  { id: 'closed', name: 'Закрытые' },
];

export default function Club() {
  const app = useApp();
  const { me } = app;
  const [tab, setTab] = useState('people');
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('all');
  const [knocks, setKnocks] = useState(0);
  const [door, setDoor] = useState(false);
  const [word, setWord] = useState('');
  const [tries, setTries] = useState(0);

  const people = useMemo(() => {
    const s = q.trim().toLowerCase();
    const ranked = bestMatches(me, RESIDENTS, 60);
    if (!s) return ranked;
    return ranked.filter(({ p }) =>
      [p.name, p.company, p.title, p.gives, p.needs, REGIONS[p.city].name].join(' ').toLowerCase().includes(s)
    );
  }, [me, q]);

  /* Свои сообщества не прячутся в отдельную вкладку, а поднимаются наверх
     любого фильтра и отделяются пустотой. */
  const groups = useMemo(() => {
    let out = communitiesFor(me);
    if (group === 'topic') out = out.filter((c) => c.access === 'open' && c.region === 'global');
    if (group === 'city') out = out.filter((c) => c.access === 'open' && c.region !== 'global');
    if (group === 'closed') out = out.filter((c) => c.access === 'closed');
    const s = q.trim().toLowerCase();
    if (s) out = out.filter((c) => `${c.name} ${c.about}`.toLowerCase().includes(s));
    return {
      mine: out.filter((c) => app.communities.includes(c.id)),
      rest: out.filter((c) => !app.communities.includes(c.id)),
    };
  }, [me, group, q, app.communities]);

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
        back
        title="Клуб"
        right={<button className="iconbtn" onClick={() => go('/profile')} aria-label="Настройки"><Icon name="settings" size={18} /></button>}
      />

      <Seg
        value={tab}
        onChange={(v) => { setTab(v); setQ(''); }}
        options={[
          { value: 'people', label: `Резиденты · ${RESIDENTS.length}` },
          { value: 'groups', label: `Сообщества · ${COMMUNITIES.length}` },
        ]}
      />

      <Search value={q} onChange={setQ} placeholder={tab === 'people' ? 'Имя, компания, что даёт…' : 'Название сообщества'} />

      {tab === 'people' ? (
        <div className="stack-8">
          {people.length === 0 && <Note icon="search">Никого не нашлось. Попробуйте другое слово.</Note>}
          {people.slice(0, 30).map(({ p }) => <ResidentCard key={p.id} p={p} me={me} />)}
        </div>
      ) : (
        <>
          <Scroller>
            {GROUPS.map((g) => (
              <Chip key={g.id} on={group === g.id} onClick={() => setGroup(g.id)}>{g.name}</Chip>
            ))}
          </Scroller>
          {groups.mine.length + groups.rest.length === 0 ? (
            <Note icon="users">Ничего не нашлось. Снимите фильтр или измените запрос.</Note>
          ) : (
            <>
              {groups.mine.length > 0 && (
                <List>{groups.mine.map((c) => <CommunityRow key={c.id} c={c} joined />)}</List>
              )}
              {groups.rest.length > 0 && (
                <List style={groups.mine.length ? { marginTop: 4 } : undefined}>
                  {groups.rest.map((c) => <CommunityRow key={c.id} c={c} />)}
                </List>
              )}
            </>
          )}
        </>
      )}

      <Section title="Ещё">
        <List>
          <Item
            icon="briefcase"
            title="Услуги"
            sub={`${SERVICES.length} ${plural(SERVICES.length, 'услуга', 'услуги', 'услуг')} для переезда и быта`}
            onClick={() => go('/market')}
          />
          <Item icon="message" title="Запросы" sub="Что нужно резидентам прямо сейчас" onClick={() => go('/requests')} />
        </List>
      </Section>

      {/* Кодекс — единственная кнопка внизу. Дверь в ложу спрятана в подписи. */}
      <div className="center" style={{ paddingTop: 4 }}>
        <button className="codex-card" onClick={() => go('/codex')}>
          <Seal size={70} motto={app.secret ? MOTTO : MOTTO_MASKED} glow={app.secret} />
          <span className="t-md">Кодекс сообщества</span>
        </button>
        <button className="t-xs dim-2" style={{ marginTop: 8, padding: '4px 10px' }} onClick={knock}>
          {app.secret ? 'Ложа открыта' : knocks ? '·'.repeat(knocks) : 'Законы, традиции и ритуалы'}
        </button>
      </div>

      <Sheet open={door} onClose={() => setDoor(false)} title="Дверь без таблички" sub="Три удара">
        <div className="stack">
          <div className="t-sm dim" style={{ lineHeight: 1.5 }}>Войти можно, назвав последнее слово девиза на печати.</div>
          <div className="center mono gold" style={{ fontSize: 13, letterSpacing: '0.22em' }}>{MOTTO_MASKED}</div>
          <input className="field center mono" style={{ letterSpacing: '0.3em', textTransform: 'uppercase' }} value={word} autoFocus placeholder="·····" onChange={(e) => setWord(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          {tries > 0 && <Note icon="key">{tries === 1 ? 'Не то слово. Подсказка — в кодексе.' : 'Пять традиций стоят в правильном порядке не случайно. Прочтите их первые буквы.'}</Note>}
          <Btn variant="gold" wide onClick={submit} disabled={!word.trim()}>Назвать слово</Btn>
        </div>
      </Sheet>
    </div>
  );
}
