import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { cityName, friendStatus, friendIds, teamOf, factOf } from '../lib/logic.js';
import { dateShort } from '../lib/time.js';
import { Actions, Avatar, Card, Empty, List, Item, Note, Tag, TopBar } from '../components/UI.jsx';

export default function PersonPage({ id }) {
  const { state, me, dispatch } = useStore();
  const user = state.users.find((u) => u.id === id);
  if (!user) return <div className="screen"><Empty title="Участник не найден" /></div>;

  const link = friendStatus(state, me.id, user.id);
  const team = teamOf(state, user.id);
  const mutual = friendIds(state, me.id).filter((x) => friendIds(state, user.id).includes(x)).length;
  const tg = `https://t.me/${(user.tg || '').replace('@', '')}`;

  const friendAction = link.status === 'accepted'
    ? { icon: 'check', title: 'В друзьях', on: true, onClick: () => dispatch({ type: 'friendRemove', id: link.link.id }) }
    : link.incoming
    ? { icon: 'plus', title: 'Принять', onClick: () => dispatch({ type: 'friendAnswer', id: link.link.id, accept: true }) }
    : link.status === 'pending'
    ? { icon: 'clock', title: 'Заявка', disabled: true, onClick: () => {} }
    : { icon: 'plus', title: 'В друзья', onClick: () => dispatch({ type: 'friendAdd', userId: user.id }) };

  return (
    <div className="screen" style={{ paddingTop: 0 }}>
      <TopBar title={user.name} sub={cityName(state, user.cityId)} />
      <div className="stack-20">
        <div className="center" style={{ display: 'grid', justifyItems: 'center', gap: 10 }}>
          <Avatar user={user} size={92} />
          <div>
            <h2 className="h2">{user.name}</h2>
            <div className="t-sm dim-2" style={{ marginTop: 4 }}>{cityName(state, user.cityId)} · в клубе с {dateShort(user.joinedAt)}</div>
          </div>
          <Tag tone={user.package === 'pro' ? 'violet' : undefined}>{user.package.toUpperCase()}</Tag>
        </div>

        {user.id !== me.id && (
          <Actions items={[
            { icon: 'send', title: 'Написать', onClick: () => window.open(tg, '_blank') },
            friendAction,
            { icon: 'coffee', title: 'Кофе', onClick: () => go('/coffee') },
          ]} />
        )}

        {(user.facts?.role?.length || user.facts?.heart?.length) && (
          <div className="wrap" style={{ justifyContent: 'center' }}>
            {user.facts?.role?.length > 0 && <Tag tone="accent">{factOf(user, 'role')}</Tag>}
            {user.facts?.exp?.length > 0 && <Tag>{factOf(user, 'exp')} в деле</Tag>}
            {user.facts?.age?.length > 0 && <Tag>{factOf(user, 'age')} лет</Tag>}
            {user.facts?.heart?.length > 0 && <Tag tone="violet">{factOf(user, 'heart')}</Tag>}
          </div>
        )}

        <Card>
          <div className="eyebrow">Чем занимается</div>
          <div style={{ marginTop: 4, lineHeight: 1.5 }}>{user.about}</div>
          {user.facts?.powers?.length > 0 && (
            <>
              <div className="eyebrow" style={{ marginTop: 14 }}>Что получается лучше всего</div>
              <div className="wrap" style={{ marginTop: 6 }}>{user.facts.powers.map((x) => <Tag key={x}>{x}</Tag>)}</div>
            </>
          )}
          {user.facts?.hobby?.length > 0 && (
            <>
              <div className="eyebrow" style={{ marginTop: 14 }}>Вне работы</div>
              <div className="wrap" style={{ marginTop: 6 }}>{user.facts.hobby.map((x) => <Tag key={x}>{x}</Tag>)}</div>
            </>
          )}
          {user.lookingFor && (<><div className="eyebrow" style={{ marginTop: 14 }}>Что ищет</div><div style={{ marginTop: 4, lineHeight: 1.5 }}>{user.lookingFor}</div></>)}
          {user.links && <a className="accent t-sm" style={{ display: 'block', marginTop: 12, fontWeight: 600 }} href={user.links} target="_blank" rel="noreferrer">{user.links}</a>}
        </Card>

        {(team || mutual > 0) && (
          <List>
            {team && <Item icon="team" title={`Команда «${team.name}»`} sub={team.idea} chev={false} />}
            {mutual > 0 && <Item icon="people" title={`Общих друзей: ${mutual}`} chev={false} />}
          </List>
        )}

        <Note icon="send">Личных сообщений внутри приложения нет — для этого есть телеграм.</Note>
      </div>
    </div>
  );
}
