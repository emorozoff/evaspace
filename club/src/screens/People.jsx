import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { cityName, friendIds, friendStatus, teamOf, coffeeFor, userById } from '../lib/logic.js';
import { SKILLS } from '../data/people.js';
import { weekKey, WEEK } from '../lib/time.js';
import { money, people as peopleWord } from '../lib/format.js';
import { Avatar, Btn, Card, Empty, Segmented } from '../components/UI.jsx';
import { IcSpark, IcSearch, IcNext, IcCoffee } from '../components/Icons.jsx';

export default function People({ navigate, now }) {
  const { state, me } = useStore();
  const [tab, setTab] = useState('catalog');
  const pair = coffeeFor(state, me.id, weekKey(now));
  const buddy = pair ? userById(state, pair.a === me.id ? pair.b : pair.a) : null;

  return (
    <div className="screen">
      <div className="topbar">
        <div className="logo">
          <div className="mark"><IcSpark size={16} className="t-lime" /></div>
          <h1>Люди</h1>
        </div>
      </div>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'catalog', label: 'Каталог' },
          { value: 'friends', label: 'Друзья' },
        ]}
      />

      {buddy && (
        <Card kind="accent" tap style={{ marginTop: 10 }} onClick={() => navigate('/coffee')}>
          <div className="row">
            <IcCoffee size={20} className="t-lime" />
            <div style={{ minWidth: 0 }}>
              <div className="t-title ellipsis">Пара недели: {buddy.name}</div>
              <div className="t-sub ellipsis">{buddy.about}</div>
            </div>
            <div className="spacer" />
            <IcNext />
          </div>
        </Card>
      )}

      {tab === 'catalog' ? <Catalog navigate={navigate} /> : <Friends navigate={navigate} now={now} />}
    </div>
  );
}

function Catalog({ navigate }) {
  const { state, me, dispatch } = useStore();
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('все');
  const [skill, setSkill] = useState('все');
  const [pack, setPack] = useState('все');

  const list = useMemo(() => {
    return state.users
      .filter((u) => u.id !== me.id && u.visible !== false && u.active !== false)
      .filter((u) => (city === 'все' ? true : u.cityId === city))
      .filter((u) => (skill === 'все' ? true : (u.skills || []).includes(skill)))
      .filter((u) => (pack === 'все' ? true : u.package === pack))
      .filter((u) => (query ? `${u.name} ${u.about} ${u.lookingFor}`.toLowerCase().includes(query.toLowerCase()) : true))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [state.users, me.id, city, skill, pack, query]);

  return (
    <>
      <div className="field" style={{ position: 'relative', marginTop: 10 }}>
        <input placeholder="Имя, занятие, запрос" value={query} onChange={(e) => setQuery(e.target.value)} style={{ paddingLeft: 40 }} />
        <span style={{ position: 'absolute', left: 13, top: 14, color: 'var(--dim)' }}><IcSearch /></span>
      </div>

      <div className="chips" style={{ marginTop: 10 }}>
        <span className={`chip ${city === 'все' ? 'on' : ''}`} onClick={() => setCity('все')}>все города</span>
        {state.cities.map((c) => (
          <span key={c.id} className={`chip ${city === c.id ? 'on' : ''}`} onClick={() => setCity(c.id)}>{c.name}</span>
        ))}
      </div>
      <div className="chips">
        <span className={`chip ${skill === 'все' ? 'on' : ''}`} onClick={() => setSkill('все')}>все навыки</span>
        {SKILLS.map((s) => (
          <span key={s} className={`chip ${skill === s ? 'on' : ''}`} onClick={() => setSkill(s)}>{s}</span>
        ))}
      </div>
      <div className="chips">
        {['все', 'start', 'club', 'pro'].map((p) => (
          <span key={p} className={`chip ${pack === p ? 'on' : ''}`} onClick={() => setPack(p)}>
            {p === 'все' ? 'все пакеты' : p.toUpperCase()}
          </span>
        ))}
      </div>

      <div className="t-dim" style={{ margin: '4px 2px 10px' }}>{peopleWord(list.length)}</div>

      {list.length === 0 && <Empty title="Никого не нашлось" text="Снимите фильтры или попробуйте другой запрос." />}

      <div className="stack">
        {list.map((u) => {
          const link = friendStatus(state, me.id, u.id);
          return (
            <Card key={u.id}>
              <div className="person" onClick={() => navigate(`/person/${u.id}`)} style={{ cursor: 'pointer' }}>
                <Avatar user={u} size={46} />
                <div style={{ minWidth: 0 }}>
                  <div className="ellipsis" style={{ fontWeight: 700 }}>{u.name}</div>
                  <div className="t-dim ellipsis">{cityName(state, u.cityId)}</div>
                  <div className="t-sub ellipsis" style={{ marginTop: 2 }}>{u.about}</div>
                </div>
                <IcNext />
              </div>
              {u.lookingFor && <div className="t-dim" style={{ marginTop: 8 }}>Ищет: {u.lookingFor}</div>}
              <div className="btn-row" style={{ marginTop: 10 }}>
                <a className="btn soft s" href={`https://t.me/${(u.tg || '').replace('@', '')}`} target="_blank" rel="noreferrer">
                  Написать
                </a>
                <Btn
                  kind={link.status === 'accepted' ? 'on' : link.status === 'pending' ? 'soft' : 'ghost'}
                  small
                  disabled={link.status !== 'none'}
                  onClick={() => dispatch({ type: 'friendAdd', userId: u.id })}
                >
                  {link.status === 'accepted' ? 'В друзьях' : link.status === 'pending' ? 'Заявка' : 'В друзья'}
                </Btn>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}

function Friends({ navigate, now }) {
  const { state, me, dispatch } = useStore();
  const incoming = state.friends.filter((f) => f.status === 'pending' && f.b === me.id);
  const ids = friendIds(state, me.id);
  const friends = ids.map((id) => userById(state, id)).filter(Boolean);

  // Лента: что друзья показали за неделю
  const feed = friends
    .map((friend) => {
      const team = teamOf(state, friend.id);
      const entries = state.revenue.filter((r) => r.userId === friend.id && now - r.at < 2 * WEEK);
      const sum = entries.reduce((s, r) => s + r.amount, 0);
      return { friend, team, sum, last: entries.sort((a, b) => b.at - a.at)[0] };
    })
    .filter((row) => row.sum > 0 || row.team)
    .sort((a, b) => b.sum - a.sum);

  return (
    <>
      {incoming.length > 0 && (
        <>
          <div className="section"><h2>Заявки · {incoming.length}</h2></div>
          <Card>
            {incoming.map((f) => {
              const user = userById(state, f.a);
              return (
                <div key={f.id} className="stack s" style={{ padding: '10px 0' }}>
                  <div className="row">
                    <Avatar user={user} size={36} />
                    <div style={{ minWidth: 0 }}>
                      <div className="ellipsis" style={{ fontWeight: 600 }}>{user?.name}</div>
                      <div className="t-dim ellipsis">{user?.about}</div>
                    </div>
                  </div>
                  <div className="btn-row">
                    <Btn kind="primary" small onClick={() => dispatch({ type: 'friendAnswer', id: f.id, accept: true })}>Принять</Btn>
                    <Btn kind="soft" small onClick={() => dispatch({ type: 'friendAnswer', id: f.id, accept: false })}>Отклонить</Btn>
                  </div>
                </div>
              );
            })}
          </Card>
        </>
      )}

      {friends.length === 0 ? (
        <Empty title="Друзей пока нет" text="Добавляйте людей из каталога — их вы будете видеть в расписании и в ленте." />
      ) : (
        <>
          <div className="section"><h2>Лента друзей</h2></div>
          {feed.length === 0 && <Empty title="За эту неделю тихо" text="Никто из друзей ещё не показывал результат." />}
          <div className="stack">
            {feed.map(({ friend, team, sum, last }) => (
              <Card key={friend.id} tap onClick={() => navigate(`/person/${friend.id}`)}>
                <div className="row">
                  <Avatar user={friend} size={40} />
                  <div style={{ minWidth: 0 }}>
                    <div className="ellipsis" style={{ fontWeight: 700 }}>{friend.name}</div>
                    <div className="t-dim ellipsis">{team ? `команда «${team.name}»` : 'пока без команды'}</div>
                  </div>
                </div>
                {sum > 0 && (
                  <div className="t-sub" style={{ marginTop: 8 }}>
                    Внёс <b className="t-lime mono">{money(sum)}</b> за две недели{last?.comment ? ` — ${last.comment}` : ''}
                  </div>
                )}
              </Card>
            ))}
          </div>

          <div className="section"><h2>Все друзья · {friends.length}</h2></div>
          <Card>
            {friends.map((u) => (
              <div key={u.id} className="lead" style={{ gridTemplateColumns: 'auto 1fr auto', cursor: 'pointer' }} onClick={() => navigate(`/person/${u.id}`)}>
                <Avatar user={u} size={34} />
                <div style={{ minWidth: 0 }}>
                  <div className="ellipsis" style={{ fontWeight: 600 }}>{u.name}</div>
                  <div className="t-dim ellipsis">{cityName(state, u.cityId)}</div>
                </div>
                <IcNext />
              </div>
            ))}
          </Card>
        </>
      )}
    </>
  );
}
