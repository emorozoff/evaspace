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
import Intros from '../components/Intros.jsx';
import AiBrief from '../components/home/AiBrief.jsx';
import { Ring } from '../components/home/Gauge.jsx';
import Install from '../components/Install.jsx';
import { RegionButton } from '../components/RegionSheet.jsx';
import { EventCard, EventRow } from '../components/EventCards.jsx';
import { Avatar } from '../components/Art.jsx';
import { Section, List, Empty } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';
import Flag from '../components/Flag.jsx';

/* Главная — порядок из клуба: карта резидента, живой блок (время, курсы,
   люди, сообщества), ближний круг начиная с команды, сводка ассистента,
   ближайшие события, новые резиденты, знакомства дня, новости. */

export default function Home() {
  const app = useApp();
  const r = REGIONS[app.me.region];
  const events = upcomingFor(app, 3);
  const unread = totalUnread(app);
  const [first, ...rest] = events;
  const fresh = newResidents(8);

  return (
    <div className="screen stack-24 rise-in home">
      <div className="hometop">
        <RegionButton app={app} />
        <div className="grow" />
        <button className="iconbtn" onClick={() => go('/chats')} aria-label="Сообщения">
          <Icon name="message" size={19} />
          {unread > 0 && <span className="badge">{unread}</span>}
        </button>
        <button className="home__me" onClick={() => go('/profile')} aria-label="Профиль">
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

      <AiBrief app={app} />

      <Section title="Ближайшие события" note={`${r.name} и эфиры`} more="Все" onMore={() => go('/events')}>
        {first ? <EventCard app={app} event={first} height={132} /> : <Empty icon="calendar" title="Пока тихо" text="В вашем регионе ближайших событий нет — загляните в афишу других." />}
        {rest.length > 0 && <List>{rest.map((e) => <EventRow key={e.id} app={app} event={e} />)}</List>}
      </Section>

      <Section title="Новые резиденты" note="По дате вступления" more="Все" onMore={() => go('/people?tab=list&sort=new')}>
        <div className="scroller hn">
          {fresh.map((p, n) => {
            const m = match(app.me, p);
            return (
              <button key={p.id} className="hn__card" style={{ '--i': n }} onClick={() => go(`/p/${p.id}`)}>
                <span className="hn__top">
                  <Avatar person={p} size={40} dot={p.online} />
                  <Ring pct={m.pct} size={34} stroke={1.6}><span className="hn__pct">{m.pct}</span></Ring>
                </span>
                <span className="hn__name">{p.name}</span>
                <span className="hn__co">{p.company}</span>
                <span className="hn__meta">
                  <Flag cc={REGIONS[p.region].cc} size={11} />
                  <span className="ell">{p.city}</span>
                  <span className="hn__d">{p.joined <= 1 ? 'сегодня' : `${p.joined} дн.`}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Intros app={app} />

      <Section title="Новости" note="Клуб, партнёры и база">
        <div className="hnews">
          {NEWS.map((n) => (
            <button key={n.id} className="hnews__row" onClick={() => go(`/news/${n.id}`)}>
              <span className={`hnews__ic tone-${n.tone}`}><Icon name={n.icon} size={16} /></span>
              <span className="hnews__body">
                <span className="hnews__tag">{n.tag}<i>·</i>{ago(n.daysAgo)}</span>
                <span className="hnews__t">{n.title}</span>
              </span>
              <Icon name="right" size={15} className="chev" />
            </button>
          ))}
        </div>
      </Section>

      <Install app={app} compact />
    </div>
  );
}
