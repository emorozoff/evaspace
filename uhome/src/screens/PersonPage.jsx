import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { byId, MEET_GOALS, TRIPS, roleEn } from '../data/people.js';
import { REGIONS } from '../data/regions.js';
import { EVENTS } from '../data/events.js';
import { COMMUNITIES } from '../data/communities.js';
import { companiesOf } from '../data/services.js';
import { match } from '../lib/match.js';
import { whenLabel, relDay } from '../lib/format.js';
import { whyText } from '../lib/intro.js';
import { assistantOf } from '../lib/assistant.js';
import { introduce } from '../components/Intros.jsx';
import { AvatarPortrait } from '../components/AvatarArt.jsx';
import { localParts, hhmm, diffLabel } from '../lib/time.js';
import { Brand } from '../components/Covers.jsx';
import { TopBar, Section, List, Item, Btn, KV, Empty, Stars } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';
import Flag from '../components/Flag.jsx';
import Gauge from '../components/people/Gauge.jsx';
import Holo from '../components/people/Holo.jsx';
import { ChipLine } from '../components/people/Chips.jsx';

/* Профиль резидента: кто он, почему вам стоит познакомиться (встречное
   совпадение словами), чем полезен, что ищет, его компания в маркетплейсе
   и куда он идёт — чтобы пересечься вживую. */

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export default function PersonPage({ id }) {
  const app = useApp();
  const p = byId(id);
  if (!p || p.id === 'team') return <div className="screen screen--nested"><TopBar backTo="/people" /><Empty title="Резидент не найден" /></div>;

  const m = match(app.me, p);
  const r = REGIONS[p.region];
  const inCircle = app.circle.includes(p.id);
  const companies = companiesOf(p.id);
  const events = EVENTS.filter((e) => e.going.includes(p.id) || e.host === p.id).slice(0, 4);
  const hosts = COMMUNITIES.filter((c) => c.hosts.includes(p.id));
  const local = hhmm(localParts(r.tz));
  const shift = diffLabel(r.tz, REGIONS[app.me.region].tz);
  const A = assistantOf(app);
  const introed = app.intros?.[p.id];
  const links = (m.toMe?.length || 0) + (m.fromMe?.length || 0) + (m.hobbies?.length || 0);
  const goalLabel = (g) => MEET_GOALS.find((x) => x.id === g)?.label || g;
  const sharedGoals = (app.me.goals || []).filter((g) => p.goals.includes(g)).map(goalLabel);
  // поводы встретиться вживую: одно событие, прилёт, один город
  const both = EVENTS.filter((e) => app.going[e.id] && e.going.includes(p.id));
  const trip = TRIPS.find((t) => t.who === p.id && t.to === app.me.region);
  const povody = [
    ...both.map((e) => ({ icon: 'calendar', text: `Вы оба идёте на «${e.title}» — ${whenLabel(e.inDays, e.time).toLowerCase()}` })),
    ...(trip ? [{ icon: 'plane', text: `${cap(relDay(trip.inDays))} — прилетает ${REGIONS[trip.to].loc}, пробудет ${trip.days} дн.` }] : []),
    ...(p.region === app.me.region ? [{ icon: 'pin', text: `Тоже ${r.loc}, ${p.city} — можно встретиться на кофе` }] : []),
  ];
  const verdict = m.pct >= 75 ? 'Стоит познакомиться' : m.pct >= 55 ? 'Есть что обсудить' : 'Пока мало общего';

  return (
    <div className="screen screen--nested pp">
      <TopBar title={p.name} sub={`${p.title} · ${p.company}`} backTo="/people" />

      <div className="stack-24">
        <section className="pp-id">
          <Holo
            p={p}
            plate={r.plate}
            size={104}
            nodes={Math.max(1, Math.min(5, links))}
            className="pp-id__holo"
            corners={{
              tl: <><Flag cc={r.cc} size={13} /> {p.city}</>,
              tr: <>местное {local}</>,
              bl: <>{roleEn(p)} · с {p.since}</>,
              br: p.online ? <span className="sea">● онлайн</span> : <>{shift === 'как у вас' ? 'ваш пояс' : `${shift} от вас`}</>,
            }}
          />
          <div className="pp-id__body">
            <h1 className="pp-id__name">{p.name}</h1>
            <div className="pp-id__role">{p.title} · {p.company}</div>
            <div className="pp-id__tags">
              <span>{p.langs.join(' · ')}</span>
              <span>{r.name}</span>
              {inCircle ? <span className="gold">в ближнем круге</span> : <span>в клубе с {p.since}</span>}
            </div>
          </div>
        </section>

        <div className="pair">
          <Btn variant="gold" icon="message" onClick={() => go(`/chat/${p.id}`)}>Написать</Btn>
          <Btn
            variant={inCircle ? 'done' : 'ghost'}
            icon={inCircle ? 'check' : 'plus'}
            onClick={() => { app.toggleCircle(p.id); app.say(inCircle ? 'Убрали из ближнего круга' : 'Добавили в ближний круг'); }}
          >
            {inCircle ? 'В круге' : 'В ближний круг'}
          </Btn>
        </div>

        <section className={`pp-use${m.pct >= 75 ? ' pp-use--hi' : ''}`}>
          <div className="pp-use__head">
            <Gauge pct={m.pct} size={84} label="польза" delay={200} />
            <div className="grow">
              <div className="pp-use__k">Польза знакомства</div>
              <div className="pp-use__t">{verdict}</div>
              <div className="pp-use__s">Ориентир по встречному совпадению анкет</div>
            </div>
          </div>
          {m.reasons.length > 0 && (
            <ul className="pp-why">
              {m.reasons.map((x) => <li key={x}>{cap(x)}</li>)}
            </ul>
          )}
          {povody.length > 0 && (
            <div className="pp-pov">
              <span className="pp-pov__k">Повод встретиться</span>
              {povody.map((x) => (
                <div key={x.text} className="pp-pov__i">
                  <Icon name={x.icon} size={15} />
                  <span>{x.text}</span>
                </div>
              ))}
            </div>
          )}
          <button
            className={`pp-eva${introed ? ' pp-eva--done' : ''}`}
            disabled={!!introed}
            onClick={() => introduce(app, p, povody[0]?.text ? `${povody[0].text}. ${whyText(m)}` : whyText(m))}
          >
            <AvatarPortrait who={A.id} size={34} />
            <span className="grow">
              <span className="pp-eva__k">{introed ? 'Чат открыт' : 'Напишет обоим и откроет чат'}</span>
              <span className="pp-eva__t">
                {introed ? `${A.name} уже ${A.she ? 'познакомила' : 'познакомил'} вас` : `${A.name} познакомит вас`}
              </span>
            </span>
            {!introed && <Icon name="right" size={16} />}
          </button>
        </section>

        <Section title="О себе">
          <p className="lead">{p.about}</p>
        </Section>

        <Section title="Обмен" note="Совпадения с вами подсвечены">
          <div className="pp-x">
            <ChipLine k="Даёт" items={p.gives} on={m.toMe} tone="gold" wrap />
            <ChipLine k="Ищет" items={p.needs} on={m.fromMe} tone="sea" wrap />
            <ChipLine k="Знакомится" items={p.goals.map(goalLabel)} on={sharedGoals} tone="gold" wrap />
            <ChipLine k="Интересы" items={p.interests} on={m.hobbies} tone="sea" wrap />
          </div>
        </Section>

        {companies.length > 0 && (
          <Section title="Компания в Услугах">
            <div className="stack-8">
              {companies.map((c) => (
                <button key={c.id} className="co pp-co" onClick={() => go(`/service/${c.id}`)}>
                  <Brand company={c} size={54} radius={15} />
                  <div className="co__body">
                    <div className="spread"><span className="t-md">{c.name}</span><Stars value={c.rating} /></div>
                    <div className="t-xs dim ell">{c.tagline}</div>
                    <div className="perk"><Icon name="gift" size={12} /><span>{c.perk}</span></div>
                  </div>
                </button>
              ))}
            </div>
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
                <Item key={c.id} icon="users" title={c.name} sub={`${c.members} участников`} onClick={() => go(`/community/${c.id}`)} />
              ))}
            </List>
          </Section>
        )}

        <div className="card pp-kv">
          <KV k="Языки" v={p.langs.join(' · ')} />
          <KV k="Регион" v={<><Flag cc={r.cc} size={13} /> {r.name}, {p.city}</>} />
          <KV k="Разница во времени" v={shift} />
          {p.contact && <KV k="Телеграм" v={p.contact} />}
        </div>
      </div>
    </div>
  );
}
