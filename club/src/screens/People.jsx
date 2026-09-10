import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { cityName, matchPercent, meetsFor, WEEKLY_MEETS } from '../lib/logic.js';
import { weekKey, plural } from '../lib/time.js';
import { Avatar, Empty, Seg, Tag, Top } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';

/* Люди: все участники крупными карточками. Сортировка одним нажатием —
   по городу или по совпадению интересов. */

const MODES = [
  { value: 'all', label: 'Все' },
  { value: 'city', label: 'Мой город' },
  { value: 'match', label: 'По интересам' },
];

export default function People({ now }) {
  const { state, me } = useStore();
  const [mode, setMode] = useState('all');
  const week = weekKey(now);
  const meets = meetsFor(state, me.id, week);
  const fresh = meets.filter((m) => m.status === 'new').length;

  const list = useMemo(() => {
    const base = state.users
      .filter((u) => u.id !== me.id && u.visible !== false && u.active !== false)
      .map((u) => ({ u, percent: matchPercent(me, u) }));
    if (mode === 'city') {
      return base
        .filter((x) => x.u.cityId === me.cityId)
        .concat(base.filter((x) => x.u.cityId !== me.cityId))
        .slice(0, 60);
    }
    if (mode === 'match') return base.sort((a, b) => b.percent - a.percent);
    return base.sort((a, b) => a.u.name.localeCompare(b.u.name, 'ru'));
  }, [state.users, me, mode]);

  const inCity = list.filter((x) => x.u.cityId === me.cityId).length;

  return (
    <div className="screen stack-20">
      <Top title="Люди" sub={`${state.users.length} ${plural(state.users.length, 'участник', 'участника', 'участников')} клуба`} />

      {/* Знакомства — главное действие этого раздела */}
      <button className="card card--accent tap row" onClick={() => go('/meet')}>
        <div className="item__ic" style={{ background: 'var(--accent-soft)' }}><Icon name="spark" size={20} /></div>
        <div className="grow">
          <div className="t-md">Новые знакомства</div>
          <div className="t-xs dim-2" style={{ marginTop: 2 }}>
            {fresh ? `${fresh} из ${WEEKLY_MEETS} предложений на этой неделе` : 'На этой неделе всё посмотрели'}
          </div>
        </div>
        {fresh > 0 && <span className="count">{fresh}</span>}
        <Icon name="right" size={16} className="chev" />
      </button>

      <Seg value={mode} onChange={setMode} options={MODES} />
      {mode === 'city' && <div className="t-xs dim-2" style={{ marginTop: -8, paddingLeft: 4 }}>{cityName(state, me.cityId)}: {inCity} человек, дальше — остальные</div>}

      {list.length === 0 ? (
        <Empty icon="people" title="Никого не нашлось" text="Попробуйте другую сортировку." />
      ) : (
        <div className="people">
          {list.map(({ u, percent }) => (
            <button key={u.id} className="pcard" onClick={() => go(`/person/${u.id}`)}>
              {mode === 'match' && <span className="pcard__pct">{percent}%</span>}
              <Avatar user={u} size={64} radius={0.3} />
              <div>
                <div className="pcard__name">{u.name}</div>
                <div className="pcard__role" style={{ marginTop: 3 }}>{u.facts?.role?.[0] || u.package.toUpperCase()}</div>
              </div>
              <div className="pcard__line">{u.about}</div>
              <div className="pcard__tags">
                <Tag>{cityName(state, u.cityId)}</Tag>
                {(u.facts?.hobby || []).slice(0, 1).map((h) => (
                  <Tag key={h} tone={(me.facts?.hobby || []).includes(h) ? 'accent' : undefined}>{h}</Tag>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
