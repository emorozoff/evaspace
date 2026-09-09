import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { cityName, friendIds, friendStatus, teamOf, coffeeFor, userById } from '../lib/logic.js';
import { SKILLS } from '../data/people.js';
import { weekKey, WEEK } from '../lib/time.js';
import { money } from '../lib/format.js';
import { Avatar, Btn, Empty, List, Item, Picker, Search, Section, Seg, Tag, Top } from '../components/UI.jsx';

/* Люди: каталог и друзья. Пара по рандом-кофе — первой строкой. */

export default function People({ now }) {
  const { state, me } = useStore();
  const [tab, setTab] = useState('all');
  const pair = coffeeFor(state, me.id, weekKey(now));
  const buddy = pair ? userById(state, pair.a === me.id ? pair.b : pair.a) : null;
  const incoming = state.friends.filter((f) => f.status === 'pending' && f.b === me.id).length;

  return (
    <div className="screen stack-20">
      <Top title="Люди" sub="Каталог участников, друзья и кофе" />
      <Seg value={tab} onChange={setTab} options={[{ value: 'all', label: 'Все' }, { value: 'friends', label: incoming ? `Друзья · ${incoming}` : 'Друзья' }]} />

      {buddy && me.coffeeEnabled && (
        <List>
          <Item
            lead={<Avatar user={buddy} size={44} ring="var(--accent)" />}
            title={`Пара недели: ${buddy.name}`}
            sub={pair.status === 'agreed' ? 'Договорились — хорошей встречи' : 'Напишите и договоритесь о кофе'}
            meta={<Tag tone="accent">кофе</Tag>}
            onClick={() => go('/coffee')}
          />
        </List>
      )}

      {tab === 'all' ? <Catalog /> : <Friends now={now} />}
    </div>
  );
}

function Catalog() {
  const { state, me } = useStore();
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('all');
  const [skill, setSkill] = useState('all');

  const list = useMemo(() =>
    state.users
      .filter((u) => u.id !== me.id && u.visible !== false && u.active !== false)
      .filter((u) => city === 'all' || u.cityId === city)
      .filter((u) => skill === 'all' || (u.skills || []).includes(skill))
      .filter((u) => !query || `${u.name} ${u.about} ${u.lookingFor}`.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru')),
  [state.users, me.id, city, skill, query]);

  return (
    <>
      <div className="stack-8">
        <Search value={query} onChange={setQuery} placeholder="Имя, дело или запрос" />
        <div className="filters">
          <Picker label="Все города" title="Город" options={state.cities.map((c) => ({ id: c.id, label: c.name }))} value={city} onChange={setCity} allLabel="Все города" />
          <Picker label="Все навыки" title="Навык" options={SKILLS.map((s) => ({ id: s, label: s }))} value={skill} onChange={setSkill} allLabel="Все навыки" />
        </div>
      </div>

      {list.length === 0 ? (
        <Empty icon="people" title="Никого не нашлось" text="Снимите фильтры или измените запрос." />
      ) : (
        <List>
          {list.map((u) => {
            const link = friendStatus(state, me.id, u.id);
            return (
              <Item
                key={u.id}
                lead={<Avatar user={u} size={44} />}
                title={u.name}
                sub={`${cityName(state, u.cityId)} · ${u.about}`}
                meta={link.status === 'accepted' ? <Tag tone="accent">друг</Tag> : u.package === 'pro' ? <Tag tone="violet">PRO</Tag> : undefined}
                onClick={() => go(`/person/${u.id}`)}
              />
            );
          })}
        </List>
      )}
    </>
  );
}

function Friends({ now }) {
  const { state, me, dispatch } = useStore();
  const incoming = state.friends.filter((f) => f.status === 'pending' && f.b === me.id);
  const friends = friendIds(state, me.id).map((id) => userById(state, id)).filter(Boolean);
  const feed = friends
    .map((friend) => {
      const team = teamOf(state, friend.id);
      const sum = state.revenue.filter((r) => r.userId === friend.id && now - r.at < 2 * WEEK).reduce((s, r) => s + r.amount, 0);
      return { friend, team, sum };
    })
    .sort((a, b) => b.sum - a.sum);

  return (
    <>
      {incoming.length > 0 && (
        <Section title={`Хотят дружить · ${incoming.length}`}>
          <List>
            {incoming.map((f) => {
              const user = userById(state, f.a);
              return (
                <Item
                  key={f.id}
                  lead={<Avatar user={user} size={44} />}
                  title={user?.name}
                  sub={user?.about}
                  chev={false}
                  meta={
                    <div className="row" style={{ gap: 6 }}>
                      <Btn variant="accent" size="sm" onClick={() => dispatch({ type: 'friendAnswer', id: f.id, accept: true })}>Принять</Btn>
                      <Btn variant="quiet" size="sm" onClick={() => dispatch({ type: 'friendAnswer', id: f.id, accept: false })}>Нет</Btn>
                    </div>
                  }
                />
              );
            })}
          </List>
        </Section>
      )}

      {friends.length === 0 ? (
        <Empty icon="people" title="Друзей пока нет" text="Откройте человека в каталоге и нажмите «В друзья» — друзей вы увидите в расписании и здесь." />
      ) : (
        <Section title={`Друзья · ${friends.length}`}>
          <List>
            {feed.map(({ friend, team, sum }) => (
              <Item
                key={friend.id}
                lead={<Avatar user={friend} size={44} />}
                title={friend.name}
                sub={team ? `команда «${team.name}»${sum ? ` · +${money(sum)} за две недели` : ''}` : cityName(state, friend.cityId)}
                onClick={() => go(`/person/${friend.id}`)}
              />
            ))}
          </List>
        </Section>
      )}
    </>
  );
}
