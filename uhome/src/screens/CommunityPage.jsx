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
import { TopBar, Section, List, Item, Btn, Empty } from '../components/UI.jsx';
import Flag from '../components/Flag.jsx';

/* Сообщество: о чём оно, кто ведёт, ближайшие встречи и чат.
   Локальное — привязано к региону клуба, по интересам — к отделениям в регионах. */

/* События сообщества по интересам — по теме, а не по типу. */
const TOPIC_WORDS = {
  'i-invest': ['инвест', 'сделк', 'основател', 'фаундер', 'капитал'],
  'i-realty': ['недвиж', 'аренд', 'застройщ', 'квартир', 'ejari'],
  'i-family': ['семей', 'детей', 'детск', 'школ', 'little sun'],
  'i-sport': ['серф', 'падел', 'бег', 'байк', 'турнир', 'прогулк'],
  'i-ai': ['ai', 'ассистент', 'автоматиз', 'технолог'],
};
const onTopic = (c, e) => (TOPIC_WORDS[c.id] || []).some((w) => `${e.title} ${e.about}`.toLowerCase().includes(w));

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
  const allEvents = EVENTS.filter((e) => (local ? e.region === c.region : onTopic(c, e)));
  const events = [...allEvents].sort((a, b) => a.inDays - b.inDays).slice(0, 3);
  const last = messagesOf(app, c.id).slice(-3);
  const chapters = local ? COMMUNITIES.filter((x) => x.kind === 'interest' && x.chapters?.includes(c.region)) : (c.chapters || []);

  const toggle = () => {
    app.toggleJoin(c.id);
    app.say(joined ? 'Вы вышли из сообщества' : `Вы в сообществе «${c.name}»`);
  };

  return (
    <div className="screen screen--nested">
      <TopBar title={c.name} sub={`${c.members} ${plural(c.members, 'участник', 'участника', 'участников')}${joined ? ' · вы участник' : ''}`} backTo="/base?tab=comm" />

      <div className="stack-24">
        <div className="stack">
          {local ? (
            <Scene region={c.region} height={130}>
              <div className="scene__top"><span className="glass"><Flag cc={R.cc} size={13} /> {R.name} · {R.country}</span></div>
            </Scene>
          ) : (
            <div className="row" style={{ gap: 14 }}>
              <Tile icon={c.icon} tone={c.tone} size={56} radius={28} />
              <span className="sect__eye" style={{ margin: 0 }}>По интересам · {chapters.length} {plural(chapters.length, 'регион', 'региона', 'регионов')}</span>
            </div>
          )}
          <h1 className="h2" style={{ marginTop: 6 }}>{c.name}</h1>
          <p className="lead">{c.about}</p>
          <div className="strip">
            <div><span className="strip__v">{c.members}</span><span className="strip__k">{plural(c.members, 'участник', 'участника', 'участников')}</span></div>
            <div><span className="strip__v">{allEvents.length}</span><span className="strip__k">{plural(allEvents.length, 'событие', 'события', 'событий')}</span></div>
            <div><span className="strip__v">{chapters.length}</span><span className="strip__k">{local ? plural(chapters.length, 'отделение', 'отделения', 'отделений') : plural(chapters.length, 'регион', 'региона', 'регионов')}</span></div>
          </div>
        </div>

        <div className="pair">
          <Btn variant={joined ? 'done' : 'gold'} icon={joined ? 'check' : 'plus'} onClick={toggle}>{joined ? 'Вы участник' : 'Вступить'}</Btn>
          <Btn variant="ghost" icon="message" onClick={() => go(`/chat/${c.id}`)}>Чат</Btn>
        </div>

        {chapters.length > 0 && (
          <Section title={local ? 'Отделения в регионе' : 'Отделения по регионам'} note={local ? 'Сообщества по интересам, которые встречаются здесь' : 'Где сообщество встречается вживую'}>
            <div className="wrap">
              {local
                ? chapters.map((x) => <button key={x.id} className="chip" onClick={() => go(`/community/${x.id}`)}>{x.name}</button>)
                : chapters.map((k) => <span key={k} className="chip"><Flag cc={REGIONS[k].cc} size={15} /> {REGIONS[k].name}</span>)}
            </div>
          </Section>
        )}

        <Section title="Ведущие">
          <List>
            {c.hosts.map(byId).map((p) => (
              <Item key={p.id} lead={<Avatar person={p} size={42} dot={p.online} />} title={p.name} sub={`${p.title} · ${p.company}`} onClick={() => go(`/p/${p.id}`)} />
            ))}
          </List>
        </Section>

        {last.length > 0 && (
          <Section title="В чате" note="Последние сообщения" more="Открыть" onMore={() => go(`/chat/${c.id}`)}>
            <List>
              {last.map((m, i) => {
                const p = m.from === 'me' ? app.me : byId(m.who);
                return <Item key={i} lead={<Avatar person={p} size={36} />} title={m.from === 'me' ? 'Вы' : p?.name} sub={m.text} subWrap meta={ago(m.at)} chev={false} onClick={() => go(`/chat/${c.id}`)} />;
              })}
            </List>
          </Section>
        )}

        {events.length > 0 && (
          <Section title="Ближайшие встречи" note={local ? `Всё, что ${R.loc}` : 'По теме сообщества, во всех регионах'}>
            <List>{events.map((e) => <EventRow key={e.id} app={app} event={e} />)}</List>
          </Section>
        )}
      </div>
    </div>
  );
}
