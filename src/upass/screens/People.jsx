import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { Card, Chip, Search, Scroller, Seg, Empty, Tag, Btn } from '../components/UI.jsx';
import { Avatar } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';
import { RESIDENTS, SKILL_GROUPS, BADGES } from '../data/people.js';
import { CITIES } from '../data/places.js';
import { DEGREES, TIERS } from '../data/canon.js';
import { matchScore, visibleResidents } from '../lib/select.js';
import { plural, nf } from '../lib/format.js';

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
    return Object.entries(set).sort((a, b) => b[1] - a[1]);
  }, []);

  const list = useMemo(() => {
    let out = visibleResidents(me);
    if (city !== 'all') out = out.filter((r) => r.city === city);
    if (skill !== 'all') out = out.filter((r) => r.skills.includes(skill));
    if (q.trim()) {
      const s = q.toLowerCase();
      out = out.filter(
        (r) =>
          r.name.toLowerCase().includes(s) ||
          r.company.toLowerCase().includes(s) ||
          r.mission.toLowerCase().includes(s) ||
          r.talents.some((t) => t.toLowerCase().includes(s)) ||
          (r.gives || '').toLowerCase().includes(s)
      );
    }
    if (sort === 'match') out = [...out].sort((a, b) => matchScore(me, b) - matchScore(me, a));
    if (sort === 'new') out = [...out].sort((a, b) => b.since - a.since);
    if (sort === 'rep') out = [...out].sort((a, b) => b.vouches - a.vouches);
    return out;
  }, [me, city, skill, q, sort]);

  const hidden = RESIDENTS.length - visibleResidents(me).length;

  return (
    <div className="screen stack-16">
      <div>
        <div className="eyebrow">Круг</div>
        <h2 className="display" style={{ marginTop: 3 }}>
          {RESIDENTS.length} {plural(RESIDENTS.length, 'резидент', 'резидента', 'резидентов')} в {cities.length} городах
        </h2>
      </div>

      <Search value={q} onChange={setQ} placeholder="Имя, компания, талант, «визы», «сёрф»…" />

      <Scroller>
        <Chip on={city === 'all'} onClick={() => setCity('all')}>Все города</Chip>
        <Chip on={city === me.city} onClick={() => setCity(me.city)}>Рядом со мной</Chip>
        {cities.map(([key, n]) => (
          <Chip key={key} on={city === key} onClick={() => setCity(key)}>
            {CITIES[key].flag} {CITIES[key].name} · {n}
          </Chip>
        ))}
      </Scroller>

      <Scroller>
        <Chip on={skill === 'all'} onClick={() => setSkill('all')}>Все направления</Chip>
        {SKILL_GROUPS.map((g) => (
          <Chip key={g.id} on={skill === g.id} onClick={() => setSkill(g.id)}>{g.name}</Chip>
        ))}
      </Scroller>

      <Seg
        value={sort}
        onChange={setSort}
        options={[
          { value: 'match', label: 'Совпадение' },
          { value: 'rep', label: 'Репутация' },
          { value: 'new', label: 'Новые' },
        ]}
      />

      {list.length === 0 ? (
        <Empty title="Никого не нашлось" text="Попробуйте другой город или направление." />
      ) : (
        <div className="stack-8">
          {list.map((r) => (
            <PersonRow key={r.id} r={r} me={me} />
          ))}
        </div>
      )}

      {hidden > 0 && (
        <Card className="row-t" style={{ gap: 11 }}>
          <Icon name="lock" size={17} color="var(--ink-3)" />
          <div className="t-xs dim">
            Ещё {hidden} {plural(hidden, 'профиль', 'профиля', 'профилей')} скрыты: их уровень членства выше вашего.
            Верхние уровни видят нижние полностью, нижние верхние — нигде, включая списки участников событий.
          </div>
        </Card>
      )}
    </div>
  );
}

export function PersonRow({ r, me }) {
  const score = matchScore(me, r);
  const deg = DEGREES.find((d) => d.n === r.degree);
  return (
    <button className="card tap row-t" style={{ gap: 12 }} onClick={() => go(`/p/${r.id}`)}>
      <Avatar person={r} size={46} dot={r.online} ring={r.degree >= 3 ? deg.tone : null} />
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="row" style={{ gap: 7 }}>
          <span className="t-md">{r.name}</span>
          {r.badges?.includes('founder') && <Icon name="seal" size={13} color="var(--gold)" />}
        </div>
        <div className="t-xs dim" style={{ marginTop: 2 }}>
          {r.role} · {r.company}
        </div>
        <div className="t-xs dim-2 clamp-2" style={{ marginTop: 5, lineHeight: 1.4 }}>{r.gives}</div>
        <div className="wrap" style={{ marginTop: 8, gap: 6 }}>
          <Tag plain>{CITIES[r.city].flag} {CITIES[r.city].name}</Tag>
          {r.talents.slice(0, 2).map((t) => <Tag key={t} plain>{t}</Tag>)}
        </div>
      </div>
      {score >= 6 && (
        <div style={{ flex: 'none', textAlign: 'center' }}>
          <div className="t-xs gold num" style={{ fontWeight: 700 }}>{Math.min(99, 55 + score * 4)}%</div>
          <div className="eyebrow" style={{ fontSize: 8 }}>совпад.</div>
        </div>
      )}
    </button>
  );
}
