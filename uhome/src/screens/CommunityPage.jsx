import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { communityById, COMMUNITIES } from '../data/communities.js';
import { byId } from '../data/people.js';
import { REGIONS } from '../data/regions.js';
import { EVENTS } from '../data/events.js';
import { messagesOf } from '../lib/select.js';
import { plural } from '../lib/format.js';
import { Scene } from '../components/Covers.jsx';
import { Avatar, Tile } from '../components/Art.jsx';
import { EventRow } from '../components/EventCards.jsx';
import { TopBar, Section, List, Btn, Empty } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';
import Flag from '../components/Flag.jsx';

/* Сообщество: о чём оно, кто ведёт, ближайшие встречи и живой чат.
   Локальное — привязано к региону клуба, по интересам — к главам в регионах. */

const INTEREST_KINDS = { 'i-invest': ['closed'], 'i-realty': ['partner'], 'i-family': ['partner'], 'i-sport': ['club'], 'i-ai': ['online'] };

const ago = (at) => {
  const m = Math.max(1, Math.round((Date.now() - at) / 60000));
  if (m < 60) return `${m} мин`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} ч` : `${Math.round(h / 24)} д`;
};

export default function CommunityPage({ id }) {
  const app = useApp();
  const c = communityById(id);
  if (!c) return <div className="screen screen--nested"><TopBar backTo="/base?tab=comm" /><Empty title="Сообщество не найдено" /></div>;

  const local = c.kind === 'local';
  const R = local ? REGIONS[c.region] : null;
  const joined = app.joined.includes(c.id);
  const allEvents = local
    ? EVENTS.filter((e) => e.region === c.region)
    : EVENTS.filter((e) => INTEREST_KINDS[c.id]?.includes(e.kind));
  const events = [...allEvents].sort((a, b) => a.inDays - b.inDays).slice(0, 3);
  const last = messagesOf(app, c.id).slice(-3);
  const chapters = local
    ? COMMUNITIES.filter((x) => x.kind === 'interest' && x.chapters?.includes(c.region))
    : (c.chapters || []);

  const toggle = () => {
    app.toggleJoin(c.id);
    app.say(joined ? 'Вы вышли из сообщества' : `Вы в сообществе «${c.name}»`);
  };

  return (
    <div className="screen screen--nested cmp">
      <TopBar title={c.name} sub={`${c.members} ${plural(c.members, 'участник', 'участника', 'участников')}${joined ? ' · вы участник' : ''}`} backTo="/base?tab=comm" />

      <div className="stack-24">
        <div className="cmp-hero">
          {local ? (
            <Scene region={c.region} height={140} radius={0}>
              <span className="cmp-hero__eye kb-glass"><Flag cc={R.cc} size={14} /> {R.name} · {R.country}</span>
            </Scene>
          ) : (
            <div className="cmp-hero__art" style={{ '--tone-a': `${c.tone}38`, '--tone-b': `${c.tone}40` }}>
              <span className="cmp-hero__rings" aria-hidden="true"><i /><i /><i /></span>
              <span className="cmp-hero__tile" style={{ boxShadow: `0 0 0 1px ${c.tone}55, 0 0 40px -6px ${c.tone}88` }}><Tile icon={c.icon} tone={c.tone} size={64} radius={20} /></span>
              <span className="cmp-hero__eye kb-glass"><Icon name="globe" size={13} /> По интересам · {chapters.length} {plural(chapters.length, 'регион', 'региона', 'регионов')}</span>
            </div>
          )}
          <div className="cmp-hero__body">
            <span className="cmp-hero__k">{local ? 'Локальное сообщество' : 'Сообщество по интересам'}</span>
            <h1 className="h2">{c.name}</h1>
            <p className="cmp-hero__about">{c.about}</p>
            <div className="cmp-stats">
              <div><b>{c.members}</b><span>{plural(c.members, 'участник', 'участника', 'участников')}</span></div>
              <div><b>{allEvents.length}</b><span>{plural(allEvents.length, 'событие', 'события', 'событий')}</span></div>
              <div><b>{local ? chapters.length : chapters.length}</b><span>{local ? 'по интересам' : plural(chapters.length, 'регион', 'региона', 'регионов')}</span></div>
            </div>
          </div>
        </div>

        <div className="pair">
          <Btn variant={joined ? 'done' : 'gold'} icon={joined ? 'check' : 'plus'} onClick={toggle}>
            {joined ? 'Вы участник' : 'Вступить'}
          </Btn>
          <Btn variant="ghost" icon="message" onClick={() => go(`/chat/${c.id}`)}>Чат</Btn>
        </div>

        {chapters.length > 0 && (
          <Section title={local ? 'Главы в регионе' : 'Главы по регионам'} note={local ? 'Сообщества по интересам в регионе' : 'Где сообщество встречается вживую'}>
            <div className="cmp-chapters">
              {local
                ? chapters.map((x) => (
                  <button key={x.id} className="cmp-chip" onClick={() => go(`/community/${x.id}`)}>
                    <Tile icon={x.icon} tone={x.tone} size={22} radius={7} /> {x.name}
                  </button>
                ))
                : chapters.map((k) => (
                  <span key={k} className="cmp-chip cmp-chip--static">
                    <Flag cc={REGIONS[k].cc} size={16} /> {REGIONS[k].name}
                  </span>
                ))}
            </div>
          </Section>
        )}

        <Section title="Ведущие">
          <div className="mtp-people">
            {c.hosts.map(byId).map((p) => (
              <button key={p.id} className="mtp-person" onClick={() => go(`/p/${p.id}`)}>
                <Avatar person={p} size={40} dot={p.online} />
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="mtp-person__t">{p.name}</span>
                  <span className="mtp-person__s">{p.title} · {p.company}</span>
                </span>
                <Icon name="right" size={16} className="chev" />
              </button>
            ))}
          </div>
        </Section>

        {last.length > 0 && (
          <Section title="В чате" note="Последние сообщения" more="Открыть" onMore={() => go(`/chat/${c.id}`)}>
            <button className="cmp-feed" onClick={() => go(`/chat/${c.id}`)}>
              {last.map((m, i) => {
                const p = m.from === 'me' ? app.me : byId(m.who);
                return (
                  <span key={i} className="cmp-msg" style={{ '--i': i }}>
                    <Avatar person={p} size={28} />
                    <span className="grow" style={{ minWidth: 0 }}>
                      <span className="cmp-msg__who">{m.from === 'me' ? 'Вы' : p?.name}<em>{ago(m.at)}</em></span>
                      <span className="cmp-msg__t">{m.text}</span>
                    </span>
                  </span>
                );
              })}
            </button>
          </Section>
        )}

        {events.length > 0 && (
          <Section title="Ближайшие встречи" note={local ? `Всё, что ${R.loc}` : 'Во всех регионах клуба'}>
            <List>{events.map((e) => <EventRow key={e.id} app={app} event={e} />)}</List>
          </Section>
        )}
      </div>
    </div>
  );
}
