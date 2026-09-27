import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { byId, EXCHANGE, MEET_GOALS, TRIPS } from '../data/people.js';
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
import { localParts, hhmm } from '../lib/time.js';
import { Avatar } from '../components/Art.jsx';
import { Brand } from '../components/Covers.jsx';
import { TopBar, Section, List, Item, Btn, KV, Empty, Stars } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';

/* Профиль резидента: кто он, почему вам стоит познакомиться (встречное
   совпадение словами), чем полезен, что ищет, его компания в маркетплейсе
   и куда он идёт — чтобы пересечься вживую. */

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
  const A = assistantOf(app);
  const introed = app.intros?.[p.id];
  // поводы встретиться вживую: одно событие, прилёт, один город
  const both = EVENTS.filter((e) => app.going[e.id] && e.going.includes(p.id));
  const trip = TRIPS.find((t) => t.who === p.id && t.to === app.me.region);
  const povody = [
    ...both.map((e) => ({ icon: 'calendar', text: `Вы оба идёте на «${e.title}» — ${whenLabel(e.inDays, e.time).toLowerCase()}` })),
    ...(trip ? [{ icon: 'plane', text: `Прилетает ${REGIONS[trip.to].loc} ${relDay(trip.inDays)} на ${trip.days} дн.` }] : []),
    ...(p.region === app.me.region ? [{ icon: 'pin', text: `Тоже ${r.loc}, ${p.city} — можно встретиться на кофе` }] : []),
  ];

  return (
    <div className="screen screen--nested">
      <TopBar title={p.name} sub={`${p.title} · ${p.company}`} backTo="/people" />

      <div className="stack-24">
        <div className="card center" style={{ padding: '22px 16px 18px', background: `radial-gradient(90% 80% at 50% 0%, ${r.plate}88, transparent 70%), var(--surface)` }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Avatar person={p} size={92} radius={0.3} dot={p.online} ring={inCircle ? 'var(--sea)' : null} />
          </div>
          <h1 className="h2" style={{ marginTop: 14 }}>{p.name}</h1>
          <div className="t-sm dim" style={{ marginTop: 4 }}>{p.title} · {p.company}</div>
          <div className="wrap" style={{ justifyContent: 'center', marginTop: 12 }}>
            <span className="tag tag--line">{r.flag} {p.city}</span>
            <span className="tag tag--line"><Icon name="clock" size={11} /> местное {local}</span>
            <span className="tag tag--line">в клубе с {p.since}</span>
            {p.online && <span className="tag tag--sea">онлайн</span>}
          </div>
        </div>

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

        <div className={`card${m.pct >= 75 ? ' card--gold' : ''}`}>
          <div className="row" style={{ gap: 14 }}>
            <div className="figure" style={{ fontSize: 34, color: m.pct >= 75 ? 'var(--gold)' : 'var(--ink)' }}>{m.pct}%</div>
            <div className="grow">
              <div className="t-md">{m.pct >= 75 ? 'Стоит познакомиться' : m.pct >= 55 ? 'Есть что обсудить' : 'Пока мало общего'}</div>
              <div className="t-xs dim-2" style={{ marginTop: 2 }}>Польза знакомства для вас</div>
            </div>
          </div>
          {m.reasons.length > 0 && (
            <ul className="points" style={{ marginTop: 14 }}>
              {m.reasons.map((x) => <li key={x}>{x[0].toUpperCase() + x.slice(1)}</li>)}
            </ul>
          )}
          {povody.length > 0 && (
            <div className="stack-8" style={{ marginTop: 14 }}>
              {povody.map((x) => (
                <div key={x.text} className="row t-sm" style={{ gap: 10, color: 'var(--ink-2)' }}>
                  <Icon name={x.icon} size={16} color="var(--gold)" />
                  <span>{x.text}</span>
                </div>
              ))}
            </div>
          )}
          <button
            className="row"
            style={{ gap: 10, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line)', width: '100%', textAlign: 'left' }}
            disabled={!!introed}
            onClick={() => introduce(app, p, povody[0]?.text ? `${povody[0].text}. ${whyText(m)}` : whyText(m))}
          >
            <AvatarPortrait who={A.id} size={32} />
            <span className="grow t-sm" style={{ color: introed ? 'var(--sea)' : 'var(--gold)', fontWeight: 600 }}>
              {introed ? `${A.name} уже ${A.she ? 'познакомила' : 'познакомил'} вас — чат открыт` : `${A.name} познакомит вас — напишет обоим`}
            </span>
            {!introed && <Icon name="right" size={16} color="var(--gold)" />}
          </button>
        </div>

        <Section title="О себе">
          <p className="lead">{p.about}</p>
        </Section>

        <Section title="Чем может помочь и что ищет">
          <div className="card stack">
            <div>
              <div className="hdr" style={{ padding: 0 }}>Даёт</div>
              <div className="wrap" style={{ marginTop: 8 }}>
                {p.gives.map((g) => <span key={g} className={`tag${m.toMe.includes(g) ? ' tag--gold' : ''}`}>{EXCHANGE[g].name}</span>)}
              </div>
            </div>
            <div className="divider" />
            <div>
              <div className="hdr" style={{ padding: 0 }}>Ищет</div>
              <div className="wrap" style={{ marginTop: 8 }}>
                {p.needs.map((g) => <span key={g} className={`tag${m.fromMe.includes(g) ? ' tag--sea' : ''}`}>{EXCHANGE[g].name}</span>)}
              </div>
            </div>
            <div className="divider" />
            <div>
              <div className="hdr" style={{ padding: 0 }}>Знакомится, чтобы</div>
              <div className="wrap" style={{ marginTop: 8 }}>
                {p.goals.map((g) => <span key={g} className="tag">{MEET_GOALS.find((x) => x.id === g)?.label}</span>)}
              </div>
            </div>
            <div className="divider" />
            <div>
              <div className="hdr" style={{ padding: 0 }}>Интересы</div>
              <div className="wrap" style={{ marginTop: 8 }}>
                {p.interests.map((t) => <span key={t} className={`tag${m.hobbies.includes(t) ? ' tag--sea' : ''}`}>{t}</span>)}
              </div>
            </div>
          </div>
        </Section>

        {companies.length > 0 && (
          <Section title="Компания в Услугах">
            <div className="stack-8">
              {companies.map((c) => (
                <button key={c.id} className="co" onClick={() => go(`/service/${c.id}`)}>
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

        <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
          <KV k="Языки" v={p.langs.join(' · ')} />
          <KV k="Регион" v={`${r.flag} ${r.name}, ${p.city}`} />
          {p.contact && <KV k="Телеграм" v={p.contact} />}
        </div>
      </div>
    </div>
  );
}
