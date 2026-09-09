import { useStore } from '../lib/store.jsx';
import { cityName, friendStatus, friendIds, teamOf } from '../lib/logic.js';
import { dateShort } from '../lib/time.js';
import { Avatar, Btn, Card, Empty, TopBar } from '../components/UI.jsx';
import { IcNext } from '../components/Icons.jsx';

export default function PersonPage({ id, navigate }) {
  const { state, me, dispatch } = useStore();
  const user = state.users.find((u) => u.id === id);
  if (!user) return <Empty title="Участник не найден" />;

  const link = friendStatus(state, me.id, user.id);
  const team = teamOf(state, user.id);
  const mutual = friendIds(state, me.id).filter((x) => friendIds(state, user.id).includes(x)).length;

  return (
    <div className="screen">
      <TopBar title={user.name} sub={cityName(state, user.cityId)} />

      <div className="hero center">
        <div style={{ display: 'grid', justifyItems: 'center', gap: 10 }}>
          <Avatar user={user} size={82} />
          <div>
            <div className="t-big">{user.name}</div>
            <div className="t-sub">{cityName(state, user.cityId)} · в клубе с {dateShort(user.joinedAt)}</div>
          </div>
          <span className={`chip ${user.package === 'pro' ? 'pro' : ''}`}>{user.package.toUpperCase()}</span>
        </div>
      </div>

      <Card style={{ marginTop: 10 }}>
        <div className="t-dim">Чем занимается</div>
        <div style={{ marginTop: 3 }}>{user.about}</div>
        {user.lookingFor && (
          <>
            <div className="t-dim" style={{ marginTop: 12 }}>Что ищет</div>
            <div style={{ marginTop: 3 }}>{user.lookingFor}</div>
          </>
        )}
        {(user.skills || []).length > 0 && (
          <div className="row wrap" style={{ gap: 6, marginTop: 12 }}>
            {user.skills.map((s) => (
              <span key={s} className="chip static">{s}</span>
            ))}
          </div>
        )}
        {user.links && (
          <a className="link t-lime" style={{ display: 'block', marginTop: 12 }} href={user.links} target="_blank" rel="noreferrer">
            {user.links}
          </a>
        )}
      </Card>

      {team && (
        <Card tap style={{ marginTop: 10 }} onClick={() => navigate(`/team/${team.id}`)}>
          <div className="split">
            <div style={{ minWidth: 0 }}>
              <div className="t-dim">Команда</div>
              <div className="t-title ellipsis">{team.name}</div>
              <div className="t-sub ellipsis">{team.idea}</div>
            </div>
            <IcNext />
          </div>
        </Card>
      )}

      {mutual > 0 && <div className="t-dim center" style={{ marginTop: 12 }}>Общих друзей: {mutual}</div>}

      {user.id !== me.id && (
        <div className="btn-row" style={{ marginTop: 14 }}>
          <a className="btn primary" href={`https://t.me/${(user.tg || '').replace('@', '')}`} target="_blank" rel="noreferrer">
            Написать в телеграм
          </a>
          {link.status === 'accepted' ? (
            <Btn kind="soft" onClick={() => dispatch({ type: 'friendRemove', id: link.link.id })}>Убрать из друзей</Btn>
          ) : link.incoming ? (
            <Btn kind="primary" onClick={() => dispatch({ type: 'friendAnswer', id: link.link.id, accept: true })}>Принять заявку</Btn>
          ) : (
            <Btn kind="ghost" disabled={link.status === 'pending'} onClick={() => dispatch({ type: 'friendAdd', userId: user.id })}>
              {link.status === 'pending' ? 'Заявка отправлена' : 'Добавить в друзья'}
            </Btn>
          )}
        </div>
      )}

      <div className="t-dim center" style={{ marginTop: 14 }}>
        Личных сообщений внутри приложения нет — для этого есть телеграм.
      </div>
    </div>
  );
}
