import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { Top, List, Item, Chip, Scroller, Section, Seg, Empty, Note, Tag } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';
import { COMMUNITY_TOPICS, THREADS } from '../data/life.js';
import { REGIONS, REGION_KEYS } from '../data/regions.js';
import { byId } from '../data/people.js';
import { communitiesFor } from '../lib/select.js';
import { nf, plural, agoHours } from '../lib/format.js';

/* Три взгляда на сообщества: мои, по регионам, закрытые клубы. */
export default function Communities() {
  const app = useApp();
  const { me } = app;
  const [tab, setTab] = useState('all');
  const [regions, setRegions] = useState([]);   // пусто — все регионы
  const [topic, setTopic] = useState('all');

  const all = useMemo(() => communitiesFor(me), [me]);

  const list = useMemo(() => {
    let out = all;
    if (tab === 'mine') out = out.filter((c) => app.communities.includes(c.id));
    if (tab === 'closed') out = out.filter((c) => c.access === 'closed');
    if (tab === 'all') out = out.filter((c) => c.access === 'open');
    if (regions.length) out = out.filter((c) => c.region === 'global' || regions.includes(c.region));
    if (topic !== 'all') out = out.filter((c) => c.topic === topic);
    return out;
  }, [all, tab, regions, topic, app.communities]);

  const toggleRegion = (k) => setRegions((v) => (v.includes(k) ? v.filter((x) => x !== k) : [...v, k]));

  return (
    <div className="screen stack">
      <Top title="Сообщества" sub={`${all.length} направлений · вступление в один тап`} />

      <Seg
        value={tab}
        onChange={setTab}
        options={[
          { value: 'all', label: 'Открытые' },
          { value: 'mine', label: `Мои · ${app.communities.length}` },
          { value: 'closed', label: 'Клубы' },
        ]}
      />

      {tab !== 'mine' && (
        <>
          <Scroller>
            <Chip on={topic === 'all'} onClick={() => setTopic('all')}>Все темы</Chip>
            {COMMUNITY_TOPICS.map((t) => <Chip key={t} on={topic === t} onClick={() => setTopic(t)}>{t}</Chip>)}
          </Scroller>
          <Scroller>
            <Chip on={regions.length === 0} onClick={() => setRegions([])}>Все регионы</Chip>
            <Chip on={regions.length === 1 && regions[0] === me.city} onClick={() => setRegions([me.city])}>{REGIONS[me.city].flag} Мой</Chip>
            {REGION_KEYS.filter((k) => REGIONS[k].communities > 2).map((k) => (
              <Chip key={k} on={regions.includes(k)} onClick={() => toggleRegion(k)}>{REGIONS[k].flag} {REGIONS[k].name}</Chip>
            ))}
          </Scroller>
        </>
      )}

      {list.length === 0 ? (
        <Empty
          icon="users"
          title={tab === 'mine' ? 'Вы пока ни в одном' : 'Ничего не нашлось'}
          text={tab === 'mine' ? 'Вступите в сообщество — оно появится здесь и в чатах.' : 'Снимите фильтр по региону или теме.'}
        />
      ) : (
        <List>
          {list.map((c) => <CommunityRow key={c.id} c={c} joined={app.communities.includes(c.id)} />)}
        </List>
      )}

      {tab === 'closed' && <Note icon="lock">Закрытые клубы открываются со степенью: её зарабатывают встречами и поручительствами, а не деньгами.</Note>}
      {tab === 'all' && <Note icon="plus">Своё сообщество можно предложить с третьей степени — заявка уходит куратору.</Note>}
    </div>
  );
}

export function CommunityRow({ c, joined }) {
  const thread = THREADS[c.id] || [];
  const last = thread[thread.length - 1];
  const author = last ? byId(last.who) : null;
  return (
    <Item
      lead={
        <div className="item__ic" style={{ background: `${c.tone}22`, color: c.tone, borderRadius: 15, opacity: c.locked ? 0.5 : 1 }}>
          <Icon name={c.icon} size={20} />
        </div>
      }
      title={
        <span className="row" style={{ gap: 6 }}>
          <span className="ell">{c.locked ? <span className="redacted">{c.name}</span> : c.name}</span>
          {c.locked && <Icon name="lock" size={12} color="var(--ink-3)" />}
          {joined && <Tag tone="cyan">вы здесь</Tag>}
        </span>
      }
      sub={
        c.locked
          ? `Закрытый клуб · нужна степень ${c.minDegree}`
          : last
            ? `${author?.name.split(' ')[0]}: ${last.text}`
            : c.about
      }
      meta={
        <>
          <span>{c.region === 'global' ? 'везде' : REGIONS[c.region]?.flag}</span>
          <span>{nf(c.members)}</span>
        </>
      }
      chev={false}
      onClick={() => go(`/chat/${c.id}`)}
    />
  );
}
