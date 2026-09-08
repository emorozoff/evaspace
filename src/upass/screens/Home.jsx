import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import Passport from '../components/Passport.jsx';
import Install from '../components/Install.jsx';
import { Avatar } from '../components/Art.jsx';
import { SceneThumb } from '../components/Scene.jsx';
import { Top, List, Item, Section, Sheet, Chip, Btn, Actions, Bar, KV } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';
import { CITIES, locById } from '../data/places.js';
import { DEGREES, TIERS } from '../data/canon.js';
import { EVENT_KINDS, TRIPS } from '../data/life.js';
import { RESIDENTS } from '../data/people.js';
import { upcoming, nearby, visibleOnly } from '../lib/select.js';
import { usd, nf, relDay, plural } from '../lib/format.js';

export default function Home() {
  const app = useApp();
  const { me, chain, pf } = app;
  const [tripOpen, setTripOpen] = useState(false);
  const [tripCity, setTripCity] = useState('bali');
  const [tripIn, setTripIn] = useState(7);
  const [tripDays, setTripDays] = useState(7);

  const next = upcoming(me, 1)[0];
  const around = useMemo(() => nearby(me), [me]);
  const incoming = useMemo(
    () => visibleOnly(me, TRIPS.filter((t) => t.city === me.city).sort((a, b) => a.inDays - b.inDays).map((t) => t.who)).slice(0, 3)
      .map((r) => ({ r, t: TRIPS.find((t) => t.who === r.id && t.city === me.city) })),
    [me]
  );
  const city = CITIES[me.city];
  const deg = DEGREES.find((d) => d.n === me.degree) || DEGREES[0];
  const tier = TIERS.find((t) => t.n === me.tier) || TIERS[0];
  const nextDeg = DEGREES.find((d) => d.n === me.degree + 1);
  const progress = nextDeg
    ? Math.min(1, (app.counts.meets / Math.max(1, nextDeg.need.meets)) * 0.5 + (app.counts.vouches / Math.max(1, nextDeg.need.vouches)) * 0.3 + (app.counts.events / Math.max(1, nextDeg.need.events || 1)) * 0.2)
    : 1;

  return (
    <div className="screen stack-20 rise-in">
      <Top
        title="Паспорт"
        right={
          <button className="iconbtn" onClick={() => go('/profile')} aria-label="Профиль">
            <Icon name="settings" size={18} />
          </button>
        }
      />

      <Passport me={me} chain={chain} heirs={app.heirs} />

      <List>
        <Item
          lead={<div className="item__ic" style={{ background: `${deg.tone}22`, color: deg.tone, fontFamily: 'var(--display)', fontSize: 17, fontWeight: 700 }}>{deg.roman}</div>}
          title={`${tier.name} · степень ${deg.secret ? '·····' : deg.name}`}
          sub={nextDeg ? `До степени ${nextDeg.roman}: встречи ${app.counts.meets}/${nextDeg.need.meets}, поручительства ${app.counts.vouches}/${nextDeg.need.vouches}` : 'Высшая известная степень'}
          meta={nextDeg ? <div style={{ width: 48 }}><Bar value={progress} /></div> : null}
          onClick={() => go('/degrees')}
        />
        <Item
          icon="coin"
          title={`${nf(me.uht, 0)} UHT · ${usd(me.uht * pf.price)}`}
          sub={`Доля в активах · ${nf(app.points)} баллов на счёте`}
          onClick={() => go('/capital')}
        />
      </List>

      <Actions
        items={[
          { icon: 'bed', title: 'Бронь', onClick: () => go('/map') },
          { icon: 'plane', title: 'Поездка', onClick: () => setTripOpen(true) },
          { icon: 'cup', title: 'Кофе', onClick: () => go('/people') },
          { icon: 'gavel', title: 'Голос', onClick: () => go('/dao') },
        ]}
      />

      <Install compact />

      {next && (
        <Section title="Ближайшее событие" more="Все" onMore={() => go('/events')}>
          <List>
            <Item
              lead={<SceneThumb city={locById(next.loc)?.city} size={44} />}
              title={next.title}
              sub={`${relDay(next.inDays)}, ${next.time} · ${locById(next.loc)?.name}`}
              meta={<span className="tag" style={{ background: `${EVENT_KINDS[next.kind].tone}22`, color: EVENT_KINDS[next.kind].tone }}>{EVENT_KINDS[next.kind].name}</span>}
              onClick={() => go(`/event/${next.id}`)}
            />
          </List>
        </Section>
      )}

      <Section title={`Рядом · ${city.flag} ${city.name}`} more="Все люди" onMore={() => go(`/people?city=${me.city}`)}>
        {around.length ? (
          <div className="scroller">
            {around.map((r) => (
              <button key={r.id} className="center" style={{ width: 66 }} onClick={() => go(`/p/${r.id}`)}>
                <Avatar person={r} size={52} dot={r.online} style={{ margin: '0 auto' }} />
                <div className="t-xs" style={{ marginTop: 7, fontWeight: 600 }}>{r.name.split(' ')[0]}</div>
              </button>
            ))}
          </div>
        ) : (
          <List><Item icon="globe" title="В этом городе пока никого" sub="Посмотрите карту — круг может быть в соседней стране" onClick={() => go('/map')} /></List>
        )}
      </Section>

      {(incoming.length > 0 || app.trips.length > 0) && (
        <Section title="Перелёты">
          <List>
            {app.trips.map((t) => (
              <Item
                key={t.id}
                icon="plane"
                title={`Вы летите: ${t.cityName}`}
                sub={`${relDay(t.inDays)} · ${t.days} ${plural(t.days, 'день', 'дня', 'дней')}`}
                meta={<button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => app.cancelTrip(t.id)}><Icon name="x" size={13} /></button>}
                chev={false}
              />
            ))}
            {incoming.map(({ r, t }) => (
              <Item
                key={r.id}
                lead={<Avatar person={r} size={40} dot={r.online} />}
                title={r.name}
                sub={`${relDay(t.inDays)} в ${city.name} · ${t.note}`}
                onClick={() => go(`/p/${r.id}`)}
              />
            ))}
          </List>
        </Section>
      )}

      <Sheet open={tripOpen} onClose={() => setTripOpen(false)} title="Объявить поездку" sub="Круг в городе увидит вас заранее">
        <div className="stack">
          <div>
            <div className="label">Куда</div>
            <div className="wrap">
              {Object.entries(CITIES).map(([key, c]) => (
                <Chip key={key} on={tripCity === key} onClick={() => setTripCity(key)}>{c.flag} {c.name}</Chip>
              ))}
            </div>
          </div>
          <div>
            <div className="label">Когда</div>
            <div className="wrap">{[1, 3, 7, 14, 30].map((d) => <Chip key={d} on={tripIn === d} onClick={() => setTripIn(d)}>{relDay(d)}</Chip>)}</div>
          </div>
          <div>
            <div className="label">Насколько</div>
            <div className="wrap">{[2, 3, 5, 7, 14, 30].map((d) => <Chip key={d} on={tripDays === d} onClick={() => setTripDays(d)}>{d} {plural(d, 'день', 'дня', 'дней')}</Chip>)}</div>
          </div>
          <div className="card">
            <KV k="Резидентов там" v={String(RESIDENTS.filter((r) => r.city === tripCity).length)} />
            <KV k="Локация UHOME" v={locById(`u-${tripCity}`)?.name || 'пока нет'} />
          </div>
          <Btn variant="gold" wide onClick={() => { app.announceTrip({ city: tripCity, cityName: CITIES[tripCity].name, inDays: tripIn, days: tripDays }); setTripOpen(false); }}>
            Объявить
          </Btn>
          <div className="center t-xs dim-2">Видны только дата и город. Маршрут клуб не спрашивает и не хранит.</div>
        </div>
      </Sheet>
    </div>
  );
}
