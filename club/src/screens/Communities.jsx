import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { communityMembers, inCommunity, suggestedCommunities, cityStats, unreadIn, communityChat } from '../lib/logic.js';
import { plural } from '../lib/time.js';
import { COMMUNITIES } from '../data/communities.js';
import { Avatar, AvatarStack, Card, List, Item, Note, Section, Tag, TopBar } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';

/* Сообщества: клубный чат сверху, дальше города и группы по интересам.
   Город — отдельная механика с пятницами, поэтому ведёт на свою страницу. */

export default function Communities() {
  const { state, me } = useStore();
  const club = COMMUNITIES.find((c) => c.kind === 'club');
  const interests = COMMUNITIES.filter((c) => c.kind === 'interest');
  const suggested = suggestedCommunities(state, me.id);
  const cities = [...state.cities]
    .map((c) => cityStats(state, c.id))
    .filter((s) => s.count > 0)
    .sort((a, b) => (b.city.id === me.cityId ? 1 : 0) - (a.city.id === me.cityId ? 1 : 0) || b.count - a.count);

  return (
    <div className="screen" style={{ paddingTop: 0 }}>
      <TopBar title="Сообщества" sub="Чаты клуба, городов и по интересам" backTo="/" />
      <div className="stack-20">
        {/* Клубное сообщество закреплено: оно одно на всех */}
        <button className="com com--pin" onClick={() => go(`/community/${club.id}`)}>
          <span className={`com__ic com__ic--${club.tone}`}><Icon name={club.icon} size={24} /></span>
          <span className="grow" style={{ minWidth: 0 }}>
            <span className="com__tag">закреплено</span>
            <span className="com__name">{club.name}</span>
            <span className="com__s">{communityMembers(state, club.id).length} участников · общий чат клуба</span>
          </span>
          <Unread id={club.id} />
          <Icon name="right" size={16} className="chev" />
        </button>

        {suggested.length > 0 && (
          <Note icon="spark">
            По вашей анкете подойдут: {suggested.slice(0, 3).map((c) => c.name).join(', ')}. Вступить можно одним нажатием.
          </Note>
        )}

        <Section title={`По интересам · ${interests.length}`} sub="Живут между встречами">
          <div className="stack-8">
            {interests.map((c) => {
              const members = communityMembers(state, c.id);
              const mine = inCommunity(state, c.id, me.id);
              return (
                <button key={c.id} className="com" onClick={() => go(`/community/${c.id}`)}>
                  <span className={`com__ic com__ic--${c.tone}`}><Icon name={c.icon} size={21} /></span>
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="com__name">{c.name}</span>
                    <span className="com__s">{c.short} · {members.length} {plural(members.length, 'участник', 'участника', 'участников')}</span>
                  </span>
                  {mine ? <Unread id={c.id} fallback={<Tag tone="accent">вы здесь</Tag>} /> : <AvatarStack users={members.slice(0, 3)} max={3} size={22} />}
                  <Icon name="right" size={16} className="chev" />
                </button>
              );
            })}
          </div>
        </Section>

        <Section title={`Города · ${cities.length}`} sub="У города своя пятница и свой организатор">
          <List>
            {cities.map((s) => (
              <Item
                key={s.city.id}
                lead={<div className="item__ic"><Icon name="city" size={19} /></div>}
                title={s.city.name}
                sub={s.ready
                  ? `${s.count} ${plural(s.count, 'участник', 'участника', 'участников')} · ${s.organizer ? `организатор ${s.organizer.name.split(' ')[0]}` : 'организатора нет'}`
                  : 'Пока один человек — чат появится со вторым'}
                meta={s.city.id === me.cityId ? <Tag tone="accent">ваш</Tag> : undefined}
                onClick={() => go(`/city/${s.city.id}`)}
              />
            ))}
          </List>
        </Section>
      </div>
    </div>
  );
}

/** Непрочитанные в чате сообщества — то же число, что и в «Сообщениях». */
function Unread({ id, fallback = null }) {
  const { state, me } = useStore();
  const n = unreadIn(state, communityChat(id), me.id);
  if (!n) return fallback;
  return <span className="count">{n}</span>;
}

/* ---------- страница сообщества ---------- */

export function CommunityPage({ id }) {
  const { state, me, dispatch } = useStore();
  const community = COMMUNITIES.find((c) => c.id === id);
  if (!community) return <div className="screen"><Card>Сообщество не найдено</Card></div>;

  const members = communityMembers(state, community.id);
  const mine = inCommunity(state, community.id, me.id);
  const key = communityChat(community.id);
  const unread = unreadIn(state, key, me.id);

  return (
    <div className="screen" style={{ paddingTop: 0 }}>
      <TopBar title={community.name} sub={community.kind === 'club' ? 'Сообщество клуба' : 'Сообщество по интересам'} backTo="/communities" />
      <div className="stack-20">
        <div className={`com-hero com-hero--${community.tone}`}>
          <span className="com-hero__ic"><Icon name={community.icon} size={30} /></span>
          <h2 className="h2">{community.name}</h2>
          <div className="t-sm dim" style={{ marginTop: 6, lineHeight: 1.55 }}>{community.about}</div>
        </div>

        <div className="pair">
          <button className="btn btn--accent" onClick={() => go(`/chat/${encodeURIComponent(key)}`)}>
            <Icon name="message" size={17} /> Открыть чат {unread > 0 ? `· ${unread}` : ''}
          </button>
          {community.kind === 'interest' && (
            <button className={`btn ${mine ? 'btn--quiet' : 'btn--soft'}`} onClick={() => dispatch({ type: 'community', id: community.id })}>
              {mine ? 'Выйти' : 'Вступить'}
            </button>
          )}
        </div>

        <Note icon="shield">{community.rules}</Note>

        <Section title={`Участники · ${members.length}`}>
          <List>
            {members.slice(0, 24).map((u) => (
              <Item
                key={u.id}
                lead={<Avatar user={u} size={44} />}
                title={u.name}
                sub={u.about}
                meta={u.id === me.id ? <Tag tone="accent">вы</Tag> : undefined}
                onClick={() => go(`/person/${u.id}`)}
              />
            ))}
          </List>
          {members.length > 24 && <div className="t-xs dim-2 center" style={{ marginTop: 10 }}>и ещё {members.length - 24}</div>}
        </Section>
      </div>
    </div>
  );
}
