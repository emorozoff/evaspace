import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { cityName, matchPercent, meetPhotos, meetsFor, MATCH_STRONG } from '../lib/logic.js';
import { weekKey, plural } from '../lib/time.js';
import { Avatar, Btn, Empty, Seg, Sheet, Tag, Top } from '../components/UI.jsx';
import { FeedList, PostForm } from './Feed.jsx';
import Icon from '../components/Icons.jsx';

/* Люди: все участники крупными карточками. По умолчанию сверху те, с кем
   совпадает сильнее всего; процент виден на каждой карточке. */

const MODES = [
  { value: 'match', label: 'По совпадению' },
  { value: 'city', label: 'Мой город' },
  { value: 'feed', label: 'Лента' },
];

export default function People({ now }) {
  const { state, me } = useStore();
  const [mode, setMode] = useState('match');
  const [write, setWrite] = useState(false);
  const week = weekKey(now);
  const meets = meetsFor(state, me.id, week);
  const fresh = meets.filter((m) => m.status === 'new').length;

  const list = useMemo(() => {
    const base = state.users
      .filter((u) => u.id !== me.id && u.visible !== false && u.active !== false)
      .map((u) => ({ u, percent: matchPercent(me, u) }));
    base.sort((a, b) => b.percent - a.percent);
    if (mode === 'city') {
      // Свой город сверху, дальше остальные — внутри каждой группы по совпадению
      return base.filter((x) => x.u.cityId === me.cityId).concat(base.filter((x) => x.u.cityId !== me.cityId));
    }
    return base;
  }, [state.users, me, mode]);

  const inCity = list.filter((x) => x.u.cityId === me.cityId).length;
  const strong = list.filter((x) => x.percent >= MATCH_STRONG).length;

  return (
    <div className="screen stack-20">
      <Top title="Люди" sub={`${state.users.length} ${plural(state.users.length, 'участник', 'участника', 'участников')} клуба`} />

      {/* Знакомства — главное действие этого раздела */}
      <button className="card card--accent tap row" onClick={() => go('/meet')}>
        <div className="item__ic" style={{ background: 'var(--accent-soft)' }}><Icon name="spark" size={20} /></div>
        <div className="grow">
          <div className="t-md">Новые знакомства</div>
          <div className="t-xs dim-2" style={{ marginTop: 2 }}>
            {fresh ? `${fresh} ${plural(fresh, 'новое предложение', 'новых предложения', 'новых предложений')} на этой неделе` : 'На этой неделе всё посмотрели'}
          </div>
        </div>
        {fresh > 0 && <span className="count">{fresh}</span>}
        <Icon name="right" size={16} className="chev" />
      </button>

      <Seg value={mode} onChange={setMode} options={MODES} />

      {mode === 'feed' ? (
        <>
          <div className="spread" style={{ marginTop: -8, paddingLeft: 4 }}>
            <span className="t-xs dim-2">Встречи, результаты и вопросы клуба</span>
            <Btn variant="soft" size="sm" icon="plus" onClick={() => setWrite(true)}>Написать</Btn>
          </div>
          <FeedList now={now} onWrite={() => setWrite(true)} />
        </>
      ) : (
      <>
      <div className="t-xs dim-2" style={{ marginTop: -8, paddingLeft: 4 }}>
        {mode === 'city'
          ? `${cityName(state, me.cityId)}: ${inCity} человек, дальше — остальные`
          : `Ярко выделены ${strong} ${plural(strong, 'человек', 'человека', 'человек')} с совпадением от ${MATCH_STRONG}%`}
      </div>

      {list.length === 0 ? (
        <Empty icon="people" title="Никого не нашлось" text="Попробуйте другую сортировку." />
      ) : (
        <div className="stack">
          {list.map(({ u, percent }) => {
            const photo = meetPhotos(u)[0];
            const strong = percent >= MATCH_STRONG;
            const tags = [u.facts?.role?.[0], u.facts?.sphere?.[0], ...(u.facts?.hobby || []).slice(0, 3)].filter(Boolean);
            return (
              <button key={u.id} className={`big${strong ? ' big--strong' : ''}`} onClick={() => go(`/person/${u.id}`)}>
                <div className="big__top">
                  {photo ? <img className="big__photo" src={photo} alt="" loading="lazy" /> : <Avatar user={u} size={84} radius={0.3} />}
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <span className="big__name ell">{u.name}</span>
                      <span className={`big__pct${strong ? ' big__pct--on' : ''}`}><Icon name="spark" size={11} /> {percent}%</span>
                    </div>
                    <div className="big__role">{u.facts?.role?.join(', ') || u.package.toUpperCase()}</div>
                    <div className="big__line">{u.about}</div>
                    <div className="t-xs dim-2" style={{ marginTop: 6 }}>{cityName(state, u.cityId)}</div>
                  </div>
                </div>
                <div className="wrap" style={{ marginTop: 12 }}>
                  {tags.map((t) => (
                    <Tag key={t} tone={(me.facts?.hobby || []).includes(t) || (me.facts?.role || []).includes(t) ? 'accent' : undefined}>{t}</Tag>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      )}
      </>
      )}

      <Sheet open={write} onClose={() => setWrite(false)} title="Что рассказать" sub="Фото со встречи — самое ценное">
        {write && <PostForm onDone={() => setWrite(false)} />}
      </Sheet>
    </div>
  );
}
