import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { Top, List, Item, Search, Picker, Empty, Section } from '../components/UI.jsx';
import { Avatar } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';
import { RESIDENTS, SKILL_GROUPS } from '../data/people.js';
import { REGIONS, REGION_KEYS } from '../data/regions.js';
import { COMMUNITIES } from '../data/life.js';
import { visibleResidents, communitiesFor } from '../lib/select.js';
import { matchScore, matchPct } from '../lib/match.js';
import { CommunityRow } from './Communities.jsx';
import { nf, plural } from '../lib/format.js';

/* Кто рядом. Вместо двух лент чипов — три раскрывающихся фильтра в одну строку:
   кого искать, в каком регионе, по какому направлению. */

const KINDS = [
  { id: 'people', name: 'Резиденты', lead: '🧑' },
  { id: 'communities', name: 'Сообщества', lead: '👥' },
];

export default function People({ query = {} }) {
  const app = useApp();
  const { me } = app;
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const [region, setRegion] = useState(query.region || query.city || 'all');
  const [skill, setSkill] = useState('all');

  const people = useMemo(() => {
    if (kind === 'communities') return [];
    let out = visibleResidents(me).filter((r) => r.id !== me.id);
    if (region !== 'all') out = out.filter((r) => r.city === region);
    if (skill !== 'all') out = out.filter((r) => r.skills.includes(skill));
    if (q.trim()) {
      const s = q.toLowerCase();
      out = out.filter((r) =>
        [r.name, r.company, r.title, r.mission, r.bio, r.gives, ...r.talents, ...r.interests].join(' ').toLowerCase().includes(s)
      );
    }
    return [...out].sort((a, b) => matchScore(me, b) - matchScore(me, a));
  }, [me, region, skill, q, kind]);

  const groups = useMemo(() => {
    if (kind === 'people') return [];
    let out = communitiesFor(me);
    if (region !== 'all') out = out.filter((c) => c.region === region || c.region === 'global');
    if (skill !== 'all') out = out.filter((c) => c.skill === skill);
    if (q.trim()) {
      const s = q.toLowerCase();
      out = out.filter((c) => `${c.name} ${c.about}`.toLowerCase().includes(s));
    }
    return out.slice(0, kind === 'communities' ? 40 : 5);
  }, [me, region, skill, q, kind]);

  const regionOptions = REGION_KEYS.map((k) => ({
    id: k,
    lead: REGIONS[k].flag,
    name: REGIONS[k].name,
    sub: `${nf(REGIONS[k].residents)} ${plural(REGIONS[k].residents, 'резидент', 'резидента', 'резидентов')}`,
  }));

  const skillOptions = SKILL_GROUPS.map((g) => ({ id: g.id, lead: g.emoji, name: g.name }));

  return (
    <div className="screen stack">
      <Top title="Кто рядом" sub={`${RESIDENTS.length} резидентов · ${COMMUNITIES.length} сообществ`} />

      <Search value={q} onChange={setQ} placeholder="Имя, компания, талант…" />

      <div className="filters">
        <Picker
          label="Все"
          summary={kind === 'all' ? 'Все' : KINDS.find((k) => k.id === kind)?.name}
          title="Кого показывать"
          options={KINDS}
          value={kind}
          onChange={setKind}
          allLabel="Все"
        />
        <Picker
          label="Регион"
          summary={region === 'all' ? 'Регион' : `${REGIONS[region].flag} ${REGIONS[region].name}`}
          title="Регион"
          sub="Где искать"
          options={regionOptions}
          value={region}
          onChange={setRegion}
          allLabel="Все регионы"
        />
        <Picker
          label="Направление"
          summary={skill === 'all' ? 'Направление' : `${SKILL_GROUPS.find((g) => g.id === skill).emoji} ${SKILL_GROUPS.find((g) => g.id === skill).name}`}
          title="Направление"
          options={skillOptions}
          value={skill}
          onChange={setSkill}
          allLabel="Все направления"
        />
      </div>

      {people.length === 0 && groups.length === 0 && (
        <Empty title="Никого не нашлось" text="Снимите фильтр по региону или направлению." />
      )}

      {groups.length > 0 && (
        <Section title={kind === 'communities' ? 'Сообщества' : `Сообщества · ${groups.length}`} more={kind !== 'communities' ? 'Все' : undefined} onMore={() => setKind('communities')}>
          <List>{groups.map((c) => <CommunityRow key={c.id} c={c} joined={app.communities.includes(c.id)} />)}</List>
        </Section>
      )}

      {people.length > 0 && (
        <Section title={`Резиденты · ${people.length}`}>
          <List>{people.map((r) => <PersonItem key={r.id} r={r} me={me} />)}</List>
        </Section>
      )}
    </div>
  );
}

export function PersonItem({ r, me, sub }) {
  const c = REGIONS[r.city];
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
      meta={<span className={`tag${score >= 9 ? ' tag--gold' : ''}`}>{matchPct(me, r)}%</span>}
      onClick={() => go(`/p/${r.id}`)}
    />
  );
}
