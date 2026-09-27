import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { communityById } from '../data/communities.js';
import { byId } from '../data/people.js';
import { REGIONS } from '../data/regions.js';
import { EVENTS } from '../data/events.js';
import { messagesOf } from '../lib/select.js';
import { Scene } from '../components/Covers.jsx';
import { Avatar, Tile } from '../components/Art.jsx';
import { EventRow } from '../components/EventCards.jsx';
import { TopBar, Section, List, Item, Btn, Empty } from '../components/UI.jsx';

/* Сообщество: о чём оно, кто ведёт, ближайшие встречи и живой чат.
   Локальное — привязано к региону клуба, по интересам — ко всем регионам. */

const INTEREST_KINDS = { 'i-invest': ['closed'], 'i-realty': ['partner'], 'i-family': ['partner'], 'i-sport': ['club'], 'i-ai': ['online'] };

export default function CommunityPage({ id }) {
  const app = useApp();
  const c = communityById(id);
  if (!c) return <div className="screen screen--nested"><TopBar backTo="/base?tab=comm" /><Empty title="Сообщество не найдено" /></div>;

  const joined = app.joined.includes(c.id);
  const events = (c.kind === 'local'
    ? EVENTS.filter((e) => e.region === c.region)
    : EVENTS.filter((e) => INTEREST_KINDS[c.id]?.includes(e.kind))
  ).sort((a, b) => a.inDays - b.inDays).slice(0, 3);
  const last = messagesOf(app, c.id).slice(-3);

  const cover = c.kind === 'local' ? (
    <Scene region={c.region} height={170}>
      <div className="scene__over">
        <span className="glass">{REGIONS[c.region].flag} {REGIONS[c.region].name} · {REGIONS[c.region].country}</span>
      </div>
    </Scene>
  ) : (
    <div className="scene" style={{ height: 170, display: 'grid', placeItems: 'center', background: `radial-gradient(80% 90% at 50% 15%, ${c.tone}33, #151412 72%)` }}>
      <Tile icon={c.icon} tone={c.tone} size={84} radius={26} />
    </div>
  );

  return (
    <div className="screen screen--nested">
      <TopBar title={c.name} sub={`${c.members} участников`} backTo="/base?tab=comm" />

      <div className="stack-24">
        <div className="stack">
          {cover}
          <h1 className="h2">{c.name}</h1>
          <p className="lead">{c.about}</p>
        </div>

        <div className="pair">
          <Btn
            variant={joined ? 'done' : 'gold'}
            icon={joined ? 'check' : 'plus'}
            onClick={() => { app.toggleJoin(c.id); app.say(joined ? 'Вы вышли из сообщества' : `Вы в сообществе «${c.name}»`); }}
          >
            {joined ? 'Вы участник' : 'Вступить'}
          </Btn>
          <Btn variant="ghost" icon="message" onClick={() => go(`/chat/${c.id}`)}>Чат</Btn>
        </div>

        <Section title="Ведущие">
          <List>
            {c.hosts.map(byId).map((p) => (
              <Item key={p.id} lead={<Avatar person={p} size={42} dot={p.online} />} title={p.name} sub={`${p.title} · ${p.company}`} onClick={() => go(`/p/${p.id}`)} />
            ))}
          </List>
        </Section>

        {last.length > 0 && (
          <Section title="В чате" more="Открыть" onMore={() => go(`/chat/${c.id}`)}>
            <button className="card" style={{ display: 'grid', gap: 12 }} onClick={() => go(`/chat/${c.id}`)}>
              {last.map((m, i) => {
                const p = m.from === 'me' ? app.me : byId(m.who);
                return (
                  <div key={i} className="row-t" style={{ gap: 10 }}>
                    <Avatar person={p} size={30} />
                    <div className="grow">
                      <div className="t-xs gold" style={{ fontWeight: 700 }}>{m.from === 'me' ? 'Вы' : p?.name}</div>
                      <div className="t-sm dim" style={{ marginTop: 2, lineHeight: 1.45 }}>{m.text}</div>
                    </div>
                  </div>
                );
              })}
            </button>
          </Section>
        )}

        {events.length > 0 && (
          <Section title="Ближайшие встречи" note={c.kind === 'local' ? `Всё, что ${REGIONS[c.region].loc}` : undefined}>
            <List>{events.map((e) => <EventRow key={e.id} app={app} event={e} />)}</List>
          </Section>
        )}
      </div>
    </div>
  );
}

