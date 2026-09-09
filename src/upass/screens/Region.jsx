import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import Scene from '../components/Scene.jsx';
import PersonCard from '../components/PersonCard.jsx';
import { PosterThumb } from '../components/Poster.jsx';
import { TopBar, List, Item, Section, Btn, KV, Chip, Seg, Note, Empty, Sheet, Tag } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';
import { REGIONS, TIERS_REGION, visaShort } from '../data/regions.js';
import { COMMUNITIES } from '../data/life.js';
import { EVENT_KINDS, FLAGSHIPS, SERVICE_CATS, SERVICE_ORDER, serviceCat } from '../data/life.js';
import { byId } from '../data/people.js';
import { Avatar } from '../components/Art.jsx';
import { agendaFor, communitiesIn, residentsIn, servicesIn, arrivalsIn } from '../lib/select.js';
import { matchScore, matchPct } from '../lib/match.js';
import { flight, monthly, hoursText } from '../lib/travel.js';
import { usdExact, nf, plural, relDay, monthsAhead, stayLabel } from '../lib/format.js';

const STAY = [3, 7, 14, 30, 60, 89];

export default function Region({ id }) {
  const app = useApp();
  const { me } = app;
  const r = REGIONS[id];
  const [style, setStyle] = useState('lean');
  const [trip, setTrip] = useState(false);

  const here = me.city === id;
  const f = here ? null : flight(me.city, id);
  const m = monthly(id, style);

  const events = useMemo(() => {
    const list = agendaFor(me, id, 30);
    return [...list].sort((a, b) => rank(b) - rank(a) || a.inDays - b.inDays).slice(0, 4);
  }, [me, id]);

  const people = useMemo(
    () =>
      residentsIn(id)
        .filter((p) => p.id !== me.id)
        .map((p) => ({ p, score: matchScore(me, p), pct: matchPct(me, p) }))
        .sort((a, b) => b.score - a.score),
    [me, id]
  );

  /* В регионе всегда есть что показать: свои чаты плюс общие сообщества,
     иначе в новом регионе блок выглядит пустым. */
  const communities = useMemo(() => {
    const own = communitiesIn(id);
    const global = COMMUNITIES.filter((c) => c.region === 'global' && c.access === 'open');
    return [...own, ...global].slice(0, 6);
  }, [id]);
  const arrivals = useMemo(() => arrivalsIn(id).slice(0, 8), [id]);
  const services = servicesIn(id);
  const cats = useMemo(() => {
    const has = new Set(servicesIn(id).map((s) => s.cat));
    return SERVICE_ORDER.filter((c) => has.has(c)).map(serviceCat);
  }, [id]);

  if (!r) return <Empty title="Регион не найден" />;


  return (
    <>
      <TopBar title={r.name} sub={`${r.flag} ${r.country}`} backTo="/map" />
      <div className="screen stack-20">
        <Scene city={id} height={176}>
          <div className="scene__over">
            <span className="tag" style={{ background: `${TIERS_REGION[r.tier].tone}2a`, color: TIERS_REGION[r.tier].tone }}>
              {TIERS_REGION[r.tier].name}
            </span>
            <div className="h2" style={{ color: '#fff', marginTop: 6 }}>{r.name}</div>
          </div>
        </Scene>

        <p className="lead">{r.about}</p>

        {here ? (
          <Note icon="pin" tone="var(--cyan)">Вы сейчас здесь. Афиша, сообщества и запросы на главной уже из этого региона.</Note>
        ) : (
          <div className="pair">
            <Btn variant="gold" icon="plane" onClick={() => setTrip(true)}>Объявить поездку</Btn>
            <Btn variant="ghost" icon="pin" onClick={() => app.setRegion(id)}>Я здесь</Btn>
          </div>
        )}

        {/* что есть в регионе — сразу, чтобы не искать прокруткой */}
        <div className="scroller">
          <Jump to="r-people" emoji="🧑" title="Люди" n={people.length} />
          <Jump to="r-events" emoji="🗓" title="События" n={events.length} />
          <Jump to="r-communities" emoji="💬" title="Сообщества" n={communities.length} />
          <Jump to="r-services" emoji="🛠" title="Услуги" n={services.length} />
        </div>

        <div className="stats">
          <div className="stat"><div className="stat__v">{nf(r.residents)}</div><div className="stat__l">Резидентов</div></div>
          <div className="stat"><div className="stat__v">{nf(r.companies)}</div><div className="stat__l">Компаний</div></div>
          <div className="stat"><div className="stat__v">{r.communities}</div><div className="stat__l">Сообществ</div></div>
        </div>

        {people.length > 0 && (
          <Section id="r-people" title="Кто вам подойдёт" more={`Все · ${nf(r.residents)}`} onMore={() => go(`/people?region=${id}`)}>
            <div className="scroller">
              {people.slice(0, 30).map(({ p, pct }) => <PersonCard key={p.id} p={p} pct={pct} me={me} />)}
            </div>
          </Section>
        )}

        {arrivals.length > 0 && (
          <Section title="Прилетают">
            <div className="scroller">
              {arrivals.map((t) => {
                const p = byId(t.who);
                if (!p) return null;
                return (
                  <button key={p.id + t.inDays} className="center" style={{ width: 70 }} onClick={() => go(`/p/${p.id}`)}>
                    <Avatar person={p} size={48} dot={p.online} style={{ margin: '0 auto' }} />
                    <div className="t-xs" style={{ marginTop: 6, fontWeight: 600 }}>{p.name.split(' ')[0]}</div>
                    <div className="t-xs dim-2">{relDay(t.inDays)}</div>
                  </button>
                );
              })}
            </div>
          </Section>
        )}

        {/* короткая справка: сколько стоит, когда ехать, какая погода, нужна ли виза */}
        <div className="facts">
          <Fact emoji="🧾" v={usdExact(r.check)} l="Ужин на одного" />
          <Fact emoji="🌡" v={`${r.temp[0]}° … ${r.temp[1]}°`} l="Прохладно / жарко" />
          <Fact emoji="🗓" v={r.best.split(',')[0]} l="Лучший сезон" />
          <Fact emoji="🛂" v={visaShort(id)} l="Въезд" />
        </div>

        {events.length > 0 && (
          <Section id="r-events" title="Ключевые события" more="Вся афиша" onMore={() => go('/events')}>
            <List>
              {events.map((e) => (
                <Item
                  key={e.id}
                  lead={<PosterThumb event={e} size={44} />}
                  title={e.title}
                  sub={`${relDay(e.inDays)}, ${e.time} · ${EVENT_KINDS[e.kind].name}${e.online ? ' · эфир' : ''}`}
                  meta={FLAGSHIPS.includes(e.kind) ? <Tag tone="gold">Маст-хэв</Tag> : e.top ? <Tag tone="cyan">Топ</Tag> : undefined}
                  onClick={() => go(`/event/${e.id}`)}
                />
              ))}
            </List>
          </Section>
        )}

        {communities.length > 0 && (
          <Section id="r-communities" title="Сообщества региона" more="Все" onMore={() => go('/communities')}>
            <div className="tiles">
              {communities.slice(0, 6).map((c) => (
                <button key={c.id} className="tile" onClick={() => go(`/chat/${c.id}`)}>
                  <span className="tile__ic" style={{ background: `${c.tone}1f`, color: c.tone }}>
                    <Icon name={c.icon} size={20} />
                  </span>
                  <span className="tile__t">{tileName(c, r.name)}</span>
                  <span className="tile__n figure">{nf(c.members)}</span>
                </button>
              ))}
            </div>
          </Section>
        )}

        {cats.length > 0 && (
          <Section id="r-services" title="Помощь с переездом" more="Все услуги" onMore={() => go('/market')}>
            <div className="scroller">
              {cats.map((c) => (
                <button key={c.id} className="shelf" onClick={() => go('/market')}>
                  <span className="shelf__e">{c.emoji}</span>
                  <span className="shelf__t">{c.short}</span>
                  <span className="shelf__n">{services.filter((s) => s.cat === c.id).length}</span>
                </button>
              ))}
            </div>
            <List>
              {services.slice(0, 3).map((s) => (
                <Item
                  key={s.id}
                  icon={SERVICE_CATS.find((c) => c.id === s.cat)?.icon || 'gift'}
                  title={s.title}
                  sub={`${byId(s.owner)?.company} · ${s.days} ${plural(s.days, 'день', 'дня', 'дней')}`}
                  meta={<span className="gold" style={{ fontSize: 13, fontWeight: 700 }}>{s.price ? usdExact(s.price) : 'по запросу'}</span>}
                  chev={false}
                  onClick={() => go(`/service/${s.id}`)}
                />
              ))}
            </List>
          </Section>
        )}

        <Section title="Сколько стоит месяц">
          <Seg value={style} onChange={setStyle} options={[{ value: 'lean', label: 'Экономно' }, { value: 'comfort', label: 'Комфортно' }]} />
          <div className="card" style={{ paddingTop: 2, paddingBottom: 2 }}>
            {f && <KV k="Билет" v={`от ${usdExact(f.from)} · ${hoursText(f.hours)}${f.direct ? '' : ' с пересадкой'}`} tone="var(--gold)" />}
            <KV k="Апартаменты, месяц" v={`от ${usdExact(r.rent.apt[0])} · обычно ${usdExact(r.rent.apt[1])}`} />
            <KV k="Вилла, месяц" v={`от ${usdExact(r.rent.villa[0])} · обычно ${usdExact(r.rent.villa[1])}`} />
            <KV k="Отель, ночь" v={`от ${usdExact(r.rent.hotel[0])} · обычно ${usdExact(r.rent.hotel[1])}`} />
            <KV k="Еда, транспорт, связь" v={usdExact(m.living)} />
            <KV k="Комфортный минимум" v={`${usdExact(m.total)} в месяц`} tone="var(--gold)" />
          </div>
        </Section>
      </div>

      <TripSheet open={trip} onClose={() => setTrip(false)} region={id} app={app} f={f} m={m} />
    </>
  );
}

const rank = (e) => (FLAGSHIPS.includes(e.kind) ? 2 : e.top ? 1 : 0);

/* Чип-навигация по блокам региона: экран длинный, а нужен один раздел. */
function Jump({ to, emoji, title, n }) {
  return (
    <button
      className="jump"
      onClick={() => document.getElementById(to)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
    >
      <span>{emoji}</span>
      <span className="jump__t">{title}</span>
      <span className="jump__n figure">{n}</span>
    </button>
  );
}

/* На плитке имя региона лишнее — он и так открыт. */
const tileName = (c, region) => {
  if (c.expat) return 'Экспаты';
  const short = c.name.replace(`${region}: `, '');
  return short[0].toUpperCase() + short.slice(1);
};

function Fact({ emoji, v, l }) {
  return (
    <div className="fact">
      <span className="fact__e">{emoji}</span>
      <span className="fact__v">{v}</span>
      <span className="fact__l">{l}</span>
    </div>
  );
}

/* Поездка объявляется месяцем и сроком: точные даты сообществу не нужны,
   важно, что человек будет в регионе и его можно позвать. */
function TripSheet({ open, onClose, region, app, f, m }) {
  const months = useMemo(() => monthsAhead(7), []);
  const [month, setMonth] = useState(months[0].key);
  const [days, setDays] = useState(14);
  const r = REGIONS[region];
  const picked = months.find((x) => x.key === month) || months[0];
  const live = m ? Math.round((m.total / 30) * days) : 0;

  return (
    <Sheet open={open} onClose={onClose} title="Объявить поездку" sub={`${r.flag} ${r.name}`}>
      <div className="stack">
        <div>
          <div className="label">Когда</div>
          <div className="wrap">
            {months.map((x) => (
              <Chip key={x.key} on={month === x.key} onClick={() => setMonth(x.key)}>{x.label}</Chip>
            ))}
          </div>
        </div>
        <div>
          <div className="label">На сколько</div>
          <div className="wrap">
            {STAY.map((d) => (
              <Chip key={d} on={days === d} onClick={() => setDays(d)}>{stayLabel(d)}</Chip>
            ))}
          </div>
        </div>
        <div className="card" style={{ paddingTop: 2, paddingBottom: 2 }}>
          {f && <KV k="Билеты туда-обратно" v={`от ${usdExact(f.from * 2)}`} />}
          <KV k="Жизнь на срок" v={usdExact(live)} />
          <KV k="Всего примерно" v={usdExact((f ? f.from * 2 : 0) + live)} tone="var(--gold)" />
        </div>
        <Note icon="users">Видны только регион и месяц. Резиденты на месте увидят вас в списке «прилетают» и позовут на встречи.</Note>
        <Btn
          variant="gold"
          wide
          onClick={() => {
            app.announceTrip({ region, inDays: picked.inDays, days, month: picked.key, when: picked.label });
            onClose();
          }}
        >
          Объявить
        </Btn>
      </div>
    </Sheet>
  );
}
