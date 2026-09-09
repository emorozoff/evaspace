import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { Top, List, Item, Seg, Empty, Note, Tag, Picker } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';
import { COMMUNITY_TOPICS, THREADS } from '../data/life.js';
import { REGIONS, REGION_KEYS } from '../data/regions.js';
import { byId } from '../data/people.js';
import { communitiesFor } from '../lib/select.js';
import { nf, plural } from '../lib/format.js';

/* Три взгляда на сообщества: мои, по регионам, закрытые клубы. */
export default function Communities() {
  const app = useApp();
  const { me } = app;
  const [tab, setTab] = useState('all');
  const [regions, setRegions] = useState([]);   // пусто — все регионы
  const [topic, setTopic] = useState('all');

  const all = useMemo(() => communitiesFor(me), [me]);

  /* Свои поднимаются наверх любого фильтра и отделяются пустотой —
     отдельная вкладка «Мои» для этого не нужна. */
  const list = useMemo(() => {
    let out = all.filter((c) => (tab === 'closed' ? c.access === 'closed' : c.access === 'open'));
    if (regions.length) out = out.filter((c) => c.region === 'global' || regions.includes(c.region));
    if (topic !== 'all') out = out.filter((c) => c.topic === topic);
    return {
      mine: out.filter((c) => app.communities.includes(c.id)),
      rest: out.filter((c) => !app.communities.includes(c.id)),
    };
  }, [all, tab, regions, topic, app.communities]);

  return (
    <div className="screen stack">
      <Top
        back title="Сообщества" sub={`${all.length} ${plural(all.length, 'сообщество', 'сообщества', 'сообществ')} · вступление в один тап`} />

      <Seg
        value={tab}
        onChange={setTab}
        options={[
          { value: 'all', label: 'Открытые' },
          { value: 'closed', label: 'Закрытые клубы' },
        ]}
      />

      <div className="filters">
        <Picker
          label="Тема"
          summary={topic === 'all' ? 'Тема' : topic}
          title="Тема сообщества"
          options={COMMUNITY_TOPICS.map((t) => ({ id: t, name: t }))}
          value={topic}
          onChange={setTopic}
          allLabel="Все темы"
        />
        <Picker
          label="Регион"
          summary={regionSummary(regions)}
          title="Регионы"
          sub="Можно выбрать несколько"
          options={REGION_KEYS.map((k) => ({ id: k, lead: REGIONS[k].flag, name: REGIONS[k].name, sub: `${REGIONS[k].communities} ${plural(REGIONS[k].communities, 'сообщество', 'сообщества', 'сообществ')}` }))}
          value={regions}
          onChange={setRegions}
          multi
          allLabel="Все регионы"
        />
      </div>

      {list.mine.length + list.rest.length === 0 ? (
        <Empty icon="users" title="Ничего не нашлось" text="Снимите фильтр по региону или теме." />
      ) : (
        <>
          {list.mine.length > 0 && <List>{list.mine.map((c) => <CommunityRow key={c.id} c={c} joined />)}</List>}
          {list.rest.length > 0 && (
            <List style={list.mine.length ? { marginTop: 4 } : undefined}>
              {list.rest.map((c) => <CommunityRow key={c.id} c={c} />)}
            </List>
          )}
        </>
      )}

      {tab === 'closed' && <Note icon="lock">Закрытые клубы открываются со степенью: её зарабатывают встречами и поручительствами, а не деньгами.</Note>}
      {tab === 'all' && <Note icon="plus">Своё сообщество можно предложить с третьей степени — заявка уходит куратору.</Note>}
    </div>
  );
}

const regionSummary = (keys) => {
  if (!keys.length) return 'Регион';
  if (keys.length === 1) return `${REGIONS[keys[0]].flag} ${REGIONS[keys[0]].name}`;
  return `${keys.map((k) => REGIONS[k].flag).join(' ')} · ${keys.length}`;
};

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
