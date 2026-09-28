import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { byId, TRIPS } from '../data/people.js';
import { REGIONS } from '../data/regions.js';
import { EVENTS } from '../data/events.js';
import { COMMUNITIES } from '../data/communities.js';
import { companiesOf } from '../data/services.js';
import { match } from '../lib/match.js';
import { whenLabel, relDayIn, plural, count } from '../lib/format.js';
import { whyText } from '../lib/intro.js';
import { assistantOf } from '../lib/assistant.js';
import { introduce, hasChat } from '../components/Intros.jsx';
import { AvatarPortrait } from '../components/AvatarArt.jsx';
import { localParts, hhmm, diffLabel } from '../lib/time.js';
import { Brand } from '../components/Covers.jsx';
import { Avatar } from '../components/Art.jsx';
import { TopBar, Section, List, Item, Btn, Empty } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';
import Flag from '../components/Flag.jsx';
import { Exchange } from '../components/people/Bits.jsx';

/* Профиль резидента: кто он, почему вам стоит познакомиться (встречное
   совпадение словами), что даёт и ищет, его компания и где пересечься. */

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const pad2 = (n) => String(n).padStart(2, '0');

export default function PersonPage({ id }) {
  const app = useApp();
  const p = byId(id);
  if (!p || p.id === 'team') return <div className="screen screen--nested"><TopBar backTo="/people" /><Empty title="Резидент не найден" /></div>;

  const m = match(app.me, p);
  const r = REGIONS[p.region];
  const inCircle = app.circle.includes(p.id);
  const chat = hasChat(app, p.id);
  const introed = !!app.intros?.[p.id];
  const companies = companiesOf(p.id);
  const events = EVENTS.filter((e) => e.going.includes(p.id) || e.host === p.id).slice(0, 4);
  const hosts = COMMUNITIES.filter((c) => c.hosts.includes(p.id));
  const local = hhmm(localParts(r.tz));
  const shift = diffLabel(r.tz, REGIONS[app.me.region].tz);
  const A = assistantOf(app);

  // поводы встретиться вживую: одно событие, прилёт, один город
  const both = EVENTS.filter((e) => app.going[e.id] && e.going.includes(p.id));
  const trip = TRIPS.find((t) => t.who === p.id && t.to === app.me.region);
  const why = [
    ...m.reasons.filter((x) => !x.startsWith('оба ')).map(cap),
    ...both.map((e) => `Вы оба идёте на «${e.title}» — ${whenLabel(e.inDays, e.time).toLowerCase()}`),
    ...(trip ? [`${cap(relDayIn(trip.inDays))} прилетает ${REGIONS[trip.to].loc} на ${trip.days} ${plural(trip.days, 'день', 'дня', 'дней')}`] : []),
    ...(p.region === app.me.region ? [`Тоже ${r.loc}, ${p.city} — можно встретиться на кофе`] : []),
  ];
  if (!why.length) why.push('Пока мало общего — но вы в одном клубе, и повод найдётся');

  return (
    <div className="screen screen--nested p-person">
      <TopBar title={p.name} sub={`${p.title} · ${p.company}`} backTo="/people" />

      <div className="stack-24">
        <div className="stack">
          <section className="card p-hero">
            <Avatar person={p} size={88} radius={0.5} ring="var(--hair-2)" dot={p.online} />
            <div className="p-hero__body">
              <h1 className="h2">{p.name}</h1>
              <div className="p-hero__s">{p.title} · {p.company}</div>
              <div className="p-hero__s"><Flag cc={r.cc} size={12} /> {p.city}, {r.name} · {local}</div>
            </div>
          </section>

          <div className="pair">
            <Btn variant="ghost" icon="message" onClick={() => go(`/chat/${p.id}`)}>Написать</Btn>
            <Btn
              variant={inCircle ? 'done' : 'quiet'}
              icon={inCircle ? 'check' : 'plus'}
              onClick={() => { app.toggleCircle(p.id); app.say(inCircle ? 'Убрали из ближнего круга' : 'Добавили в ближний круг'); }}
            >
              {inCircle ? 'В круге' : 'В круг'}
            </Btn>
          </div>

          {introed ? (
            <Btn variant="done" wide onClick={() => go(`/chat/${p.id}`)}>{A.name} уже {A.she ? 'познакомила' : 'познакомил'} вас · чат открыт</Btn>
          ) : !chat && (
            <Btn variant="gold" wide onClick={() => introduce(app, p, why[0] ? `${why[0]}. ${whyText(m)}` : whyText(m))}>
              <AvatarPortrait who={A.id} size={24} ring={false} />
              {A.name} познакомит вас
            </Btn>
          )}
        </div>

        <div className="strip">
          <div><span className="strip__v">{m.pct}%</span><span className="strip__k">польза</span></div>
          <div><span className="strip__v">{m.hobbies.length}</span><span className="strip__k">общих интересов</span></div>
          <div><span className="strip__v">{p.since}</span><span className="strip__k">в клубе с</span></div>
        </div>

        <Section title="Почему стоит познакомиться" note="Ориентир по встречному совпадению анкет">
          <div className="steps">
            {why.map((t, i) => (
              <div key={t} className="step"><span className="step__n">{pad2(i + 1)}</span><span className="step__t">{t}</span></div>
            ))}
          </div>
        </Section>

        <Section title="О себе">
          <p className="lead">{p.about}</p>
        </Section>

        <Section title="Даёт и ищет" note="Совпадения с вами подсвечены">
          <div className="stack">
            <Exchange k="Даёт" items={p.gives} on={m.toMe} wrap />
            <Exchange k="Ищет" items={p.needs} on={m.fromMe} wrap />
          </div>
        </Section>

        {companies.length > 0 && (
          <Section title="Компания в Услугах">
            <List>
              {companies.map((c) => (
                <Item key={c.id} lead={<Brand company={c} size={44} radius={13} />} title={c.name} sub={c.tagline} meta={<span className="p-num">{c.rating.toFixed(1)}</span>} onClick={() => go(`/service/${c.id}`)} />
              ))}
            </List>
          </Section>
        )}

        {events.length > 0 && (
          <Section title="Где пересечься" note="События, на которые идёт или которые ведёт">
            <List>
              {events.map((e) => (
                <Item
                  key={e.id}
                  icon={e.host === p.id ? 'star' : 'calendar'}
                  title={e.title}
                  sub={`${whenLabel(e.inDays, e.time)} · ${e.kind === 'online' ? 'Zoom' : REGIONS[e.region].name}${e.host === p.id ? ' · ведёт' : ''}`}
                  onClick={() => go(`/event/${e.id}`)}
                />
              ))}
            </List>
          </Section>
        )}

        {hosts.length > 0 && (
          <Section title="Ведёт сообщества">
            <List>
              {hosts.map((c) => (
                <Item key={c.id} icon="users" title={c.name} sub={count(c.members, 'участник', 'участника', 'участников')} onClick={() => go(`/community/${c.id}`)} />
              ))}
            </List>
          </Section>
        )}

        <div className="rows">
          <div className="rows__r"><span className="rows__k">Языки</span><span className="rows__v">{p.langs.join(' · ')}</span></div>
          <div className="rows__r"><span className="rows__k">Разница во времени</span><span className="rows__v">{shift}</span></div>
          {p.contact && <div className="rows__r"><span className="rows__k">Телеграм</span><span className="rows__v">{p.contact}</span></div>}
        </div>
      </div>
    </div>
  );
}
