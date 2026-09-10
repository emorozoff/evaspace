import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import {
  chatKey, cityName, friendStatus, friendIds, matchPercent, matchReasons, matchedWith,
  teamOf, factOf, pointsOf, attendanceOf, feedPosts, titleOf, TEAM_TITLES,
} from '../lib/logic.js';
import { dateShort } from '../lib/time.js';
import { FACT_LABELS } from '../data/onboarding.js';
import { hash } from '../lib/format.js';
import { Actions, Avatar, Card, Empty, List, Item, Note, Section, Tag, TopBar, toneOf } from '../components/UI.jsx';
import { Post } from './Feed.jsx';
import Icon from '../components/Icons.jsx';

/* Страница участника: широкая шапка, крупные факты и живая активность —
   по ней сразу понятно, о чём говорить при встрече. */

const SHOWN = ['role', 'sphere', 'work', 'schedule', 'exp', 'ai', 'craft', 'age', 'status'];

export default function PersonPage({ id, now = Date.now() }) {
  const { state, me, dispatch } = useStore();
  const user = state.users.find((u) => u.id === id);
  if (!user) return <div className="screen"><Empty title="Участник не найден" /></div>;

  const mine = user.id === me.id;
  const link = friendStatus(state, me.id, user.id);
  const team = teamOf(state, user.id);
  const mutual = friendIds(state, me.id).filter((x) => friendIds(state, user.id).includes(x)).length;
  const matched = matchedWith(state, me.id).some((u) => u.id === user.id);
  const dm = chatKey('dm', [me.id, user.id]);
  const percent = matchPercent(me, user);
  const reasons = matchReasons(me, user);
  const been = attendanceOf(state, user.id, now);
  const posts = feedPosts(state).filter((p) => p.userId === user.id).slice(0, 2);
  const tone = toneOf(user);

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
        <div className="hero-user">
          <div className="hero-user__bg">
            <svg viewBox="0 0 320 200" preserveAspectRatio="none">
              <defs>
                <linearGradient id={`hu${hash(user.id)}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={tone} stopOpacity="0.28" />
                  <stop offset="70%" stopColor="#12151c" />
                </linearGradient>
              </defs>
              <rect width="320" height="200" fill={`url(#hu${hash(user.id)})`} />
              <g fill="none" stroke="#fff" strokeOpacity="0.06">
                {[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M-10 ${40 + i * 34} C 90 ${20 + i * 30}, 210 ${70 + i * 26}, 330 ${30 + i * 32}`} />)}
              </g>
            </svg>
          </div>

          <Avatar user={user} size={104} radius={0.3} />
          <div>
            <h2 className="h2">{user.name}</h2>
            <div className="t-sm dim" style={{ marginTop: 6, lineHeight: 1.5 }}>{user.about}</div>
          </div>
          <div className="wrap" style={{ justifyContent: 'center' }}>
            <Tag tone="accent">{factOf(user, 'role') || user.package.toUpperCase()}</Tag>
            {factOf(user, 'sphere') && <Tag>{factOf(user, 'sphere')}</Tag>}
            {team && <Tag tone="violet">{team.name}</Tag>}
          </div>
          {!mine && (
            <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
              <Tag tone="accent"><Icon name="spark" size={12} /> совпадение {percent}%</Tag>
            </div>
          )}
        </div>

        {!mine && (
          <Actions items={[
            matched
              ? { icon: 'message', title: 'Написать', onClick: () => go(`/chat/${encodeURIComponent(dm)}`) }
              : { icon: 'spark', title: 'Познакомиться', onClick: () => go('/meet') },
            friendAction,
            { icon: 'people', title: 'В круг', onClick: () => dispatch({ type: 'circleAdd', userId: user.id }) },
          ]} />
        )}

        {!mine && reasons.length > 0 && (
          <Note icon="spark" tone="var(--accent)">Общее: {reasons.join(' · ')}</Note>
        )}

        <div className="stats">
          <div className="stat"><div className="stat__v" style={{ fontSize: 18 }}>{pointsOf(state, user.id)}</div><div className="stat__l">баллов</div></div>
          <div className="stat"><div className="stat__v" style={{ fontSize: 18 }}>{been.went}</div><div className="stat__l">встреч</div></div>
          <div className="stat"><div className="stat__v" style={{ fontSize: 18 }}>{dateShort(user.joinedAt).split(' ')[0]}</div><div className="stat__l">{dateShort(user.joinedAt).split(' ')[1]}</div></div>
        </div>

        <Section title="О человеке">
          <div className="facts">
            {SHOWN.filter((k) => factOf(user, k)).map((k) => (
              <div key={k} className="fact">
                <div className="fact__l">{FACT_LABELS[k]}</div>
                <div className="fact__v">{factOf(user, k)}</div>
              </div>
            ))}
            {user.lookingFor && (
              <div className="fact fact--wide">
                <div className="fact__l">Что ищет</div>
                <div className="fact__v">{user.lookingFor}</div>
              </div>
            )}
          </div>
        </Section>

        {(user.facts?.goal?.length > 0 || user.facts?.hobby?.length > 0) && (
          <Card>
            {user.facts?.goal?.length > 0 && (
              <>
                <div className="eyebrow">Зачем в клубе</div>
                <div className="wrap" style={{ marginTop: 7 }}>{user.facts.goal.map((x) => <Tag key={x} tone="accent">{x}</Tag>)}</div>
              </>
            )}
            {user.facts?.hobby?.length > 0 && (
              <>
                <div className="eyebrow" style={{ marginTop: 16 }}>Вне работы</div>
                <div className="wrap" style={{ marginTop: 7 }}>
                  {user.facts.hobby.map((x) => <Tag key={x} tone={(me.facts?.hobby || []).includes(x) ? 'accent' : undefined}>{x}</Tag>)}
                </div>
              </>
            )}
            {user.links && <a className="accent t-sm" style={{ display: 'block', marginTop: 16, fontWeight: 600 }} href={user.links} target="_blank" rel="noreferrer">{user.links}</a>}
          </Card>
        )}

        {(team || mutual > 0) && (
          <List>
            {team && <Item icon="team" title={`Команда «${team.name}»`} sub={`${TEAM_TITLES[titleOf(team, user.id)]} · ${team.goal || team.idea}`} subWrap chev={false} />}
            {mutual > 0 && <Item icon="people" title={`Общих друзей: ${mutual}`} chev={false} />}
          </List>
        )}

        {posts.length > 0 && (
          <Section title="В ленте" more="Вся лента" onMore={() => go('/feed')}>
            <div className="stack">{posts.map((p) => <Post key={p.id} post={p} now={now} compact />)}</div>
          </Section>
        )}

        {!mine && !matched && <Note icon="spark">Личный чат открывается после взаимного знакомства — загляните в «Новые знакомства».</Note>}
      </div>
    </div>
  );
}
