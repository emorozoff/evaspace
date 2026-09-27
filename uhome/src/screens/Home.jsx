import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { upcomingFor, totalUnread, newResidents } from '../lib/select.js';
import { match } from '../lib/match.js';
import { ago } from '../lib/format.js';
import { REGIONS } from '../data/regions.js';
import { NEWS } from '../data/news.js';
import ResidentCard from '../components/ResidentCard.jsx';
import Pulse from '../components/Pulse.jsx';
import Circle from '../components/Circle.jsx';
import Install from '../components/Install.jsx';
import { RegionButton } from '../components/RegionSheet.jsx';
import { EventCard, EventRow } from '../components/EventCards.jsx';
import { Avatar } from '../components/Art.jsx';
import { Section, List, Empty } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';

/* Главная — порядок из клуба: карта резидента, живой блок (время и курсы),
   ближний круг начиная с команды, ближайшие события, новые резиденты, новости. */

export default function Home() {
  const app = useApp();
  const r = REGIONS[app.me.region];
  const events = upcomingFor(app, 3);
  const unread = totalUnread(app);
  const [first, ...rest] = events;
  const fresh = newResidents(8);

  return (
    <div className="screen stack-24 rise-in">
      <div className="hometop">
        <RegionButton app={app} />
        <div className="grow" />
        <button className="iconbtn" onClick={() => go('/chats')} aria-label="Сообщения">
          <Icon name="message" size={19} />
          {unread > 0 && <span className="badge">{unread}</span>}
        </button>
        <button onClick={() => go('/profile')} aria-label="Профиль">
          <Avatar person={app.me} size={40} />
        </button>
      </div>

      <div style={{ marginTop: -14 }}>
        <ResidentCard
          me={app.me}
          stats={{ circle: app.circle.length, events: Object.keys(app.going).length }}
          hint={!app.hidden.flip}
          onFlip={() => app.hide('flip')}
        />
      </div>

      <Pulse app={app} />

      <Circle app={app} />

      <Section title="Ближайшие события" note={`${r.name} и эфиры`} more="Все" onMore={() => go('/events')}>
        {first ? <EventCard app={app} event={first} /> : <Empty icon="calendar" title="Пока тихо" text="В вашем регионе ближайших событий нет — загляните в афишу других." />}
        {rest.length > 0 && <List>{rest.map((e) => <EventRow key={e.id} app={app} event={e} />)}</List>}
      </Section>

      <Section title="Новые резиденты" more="Все" onMore={() => go('/people?tab=list&sort=new')}>
        <div className="scroller">
          {fresh.map((p) => {
            const m = match(app.me, p);
            return (
              <button key={p.id} className="newbie" onClick={() => go(`/p/${p.id}`)}>
                <div className="spread" style={{ alignItems: 'flex-start' }}>
                  <Avatar person={p} size={48} dot={p.online} />
                  <span className={`pct${m.pct >= 75 ? ' pct--hi' : ''}`}>{m.pct}%</span>
                </div>
                <div>
                  <div className="t-md clamp-2" style={{ lineHeight: 1.25 }}>{p.name}</div>
                  <div className="t-xs dim ell" style={{ marginTop: 4 }}>{p.company}</div>
                </div>
                <div className="t-xs dim-2 ell">{REGIONS[p.region].flag} {p.city} · {p.joined <= 1 ? 'сегодня' : `${p.joined} дн.`}</div>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Новости">
        <div className="stack-8">
          {NEWS.map((n) => (
            <button key={n.id} className="news" onClick={() => go(`/news/${n.id}`)}>
              <span className={`news__ic tone-${n.tone}`}><Icon name={n.icon} size={19} /></span>
              <span className="grow" style={{ minWidth: 0 }}>
                <span className="news__tag">{n.tag} · {ago(n.daysAgo)}</span>
                <span className="news__t">{n.title}</span>
                <span className="news__s">{n.sub}</span>
              </span>
              <Icon name="right" size={16} className="chev" />
            </button>
          ))}
        </div>
      </Section>

      <Install app={app} compact />
    </div>
  );
}
