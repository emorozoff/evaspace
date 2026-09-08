import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { Top, List, Item, Chip, Search, Scroller, Empty, Note, Seg } from '../components/UI.jsx';
import { Avatar } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';
import { RESIDENTS, SKILL_GROUPS } from '../data/people.js';
import { CITIES } from '../data/places.js';
import { HUB_MAIN } from '../data/landmarks.js';
import { matchScore, visibleResidents } from '../lib/select.js';
import { plural } from '../lib/format.js';

export default function People({ query = {} }) {
  const app = useApp();
  const { me } = app;
  const [q, setQ] = useState('');
  const [city, setCity] = useState(query.city || 'all');
  const [skill, setSkill] = useState('all');
  const [sort, setSort] = useState('match');

  const cities = useMemo(() => {
    const set = {};
    for (const r of RESIDENTS) set[r.city] = (set[r.city] || 0) + 1;
    return Object.entries(set).sort((a, b) => (HUB_MAIN.includes(b[0]) - HUB_MAIN.includes(a[0])) || b[1] - a[1]);
  }, []);

  const list = useMemo(() => {
    let out = visibleResidents(me);
    if (city !== 'all') out = out.filter((r) => r.city === city);
    if (skill !== 'all') out = out.filter((r) => r.skills.includes(skill));
    if (q.trim()) {
      const s = q.toLowerCase();
      out = out.filter((r) =>
        [r.name, r.company, r.title, r.mission, r.bio, r.gives, ...r.talents, ...r.interests].join(' ').toLowerCase().includes(s)
      );
    }
    if (sort === 'match') out = [...out].sort((a, b) => matchScore(me, b) - matchScore(me, a));
    if (sort === 'rep') out = [...out].sort((a, b) => b.vouches - a.vouches);
    if (sort === 'new') out = [...out].sort((a, b) => b.since - a.since);
    return out;
  }, [me, city, skill, q, sort]);

  const hidden = RESIDENTS.length - visibleResidents(me).length;

  return (
    <div className="screen stack">
      <Top title="Люди" sub={`${RESIDENTS.length} ${plural(RESIDENTS.length, 'резидент', 'резидента', 'резидентов')} · ${cities.length} городов`} />

      <Search value={q} onChange={setQ} placeholder="Имя, компания, талант, город…" />

      <Scroller>
        <Chip on={city === 'all'} onClick={() => setCity('all')}>Все</Chip>
        <Chip on={city === me.city} onClick={() => setCity(me.city)}>Рядом</Chip>
        {cities.map(([key, n]) => (
          <Chip key={key} on={city === key} onClick={() => setCity(key)}>{CITIES[key].flag} {CITIES[key].name} · {n}</Chip>
        ))}
      </Scroller>

      <Scroller>
        <Chip on={skill === 'all'} onClick={() => setSkill('all')}>Все направления</Chip>
        {SKILL_GROUPS.map((g) => (
          <Chip key={g.id} on={skill === g.id} onClick={() => setSkill(g.id)}>{g.name}</Chip>
        ))}
      </Scroller>

      <Seg value={sort} onChange={setSort} options={[{ value: 'match', label: 'Совпадение' }, { value: 'rep', label: 'Репутация' }, { value: 'new', label: 'Новые' }]} />

      {list.length === 0 ? (
        <Empty title="Никого не нашлось" text="Попробуйте другой город или направление." />
      ) : (
        <List>
          {list.map((r) => <PersonItem key={r.id} r={r} me={me} />)}
        </List>
      )}

      {hidden > 0 && (
        <Note icon="lock">
          Ещё {hidden} {plural(hidden, 'профиль скрыт', 'профиля скрыты', 'профилей скрыто')}: их уровень членства выше вашего.
        </Note>
      )}
    </div>
  );
}

export function PersonItem({ r, me, sub }) {
  const c = CITIES[r.city];
  const score = matchScore(me, r);
  return (
    <Item
      lead={<Avatar person={r} size={46} dot={r.online} />}
      title={
        <span className="row" style={{ gap: 6 }}>
          <span className="ell">{r.name}</span>
          {r.verified && <Icon name="seal" size={13} color="var(--gold)" />}
        </span>
      }
      sub={sub || `${c.flag} ${c.name} · ${r.company}`}
      meta={score >= 7 ? <span className="tag tag--gold">{Math.min(99, 55 + score * 4)}%</span> : undefined}
      onClick={() => go(`/p/${r.id}`)}
    />
  );
}
