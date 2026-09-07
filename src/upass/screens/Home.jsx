import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import Passport from '../components/Passport.jsx';
import { Avatar, Cover, Ring } from '../components/Art.jsx';
import { Btn, Card, Section, Sheet, Chip, Bar, KV } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';
import { CITIES, locById } from '../data/places.js';
import { DEGREES } from '../data/canon.js';
import { EVENT_KINDS, TRIPS } from '../data/life.js';
import { RESIDENTS } from '../data/people.js';
import { upcoming, nearby, spendTotals, suggestions, eventDate } from '../lib/select.js';
import { usd, nf, pct, relDay, dateShort, plural } from '../lib/format.js';

export default function Home() {
  const app = useApp();
  const { me, chain, pf } = app;
  const [cityOpen, setCityOpen] = useState(false);
  const [tripOpen, setTripOpen] = useState(false);
  const [tripCity, setTripCity] = useState('bali');
  const [tripIn, setTripIn] = useState(7);
  const [tripDays, setTripDays] = useState(7);

  const next = upcoming(me, 1)[0];
  const around = useMemo(() => nearby(me).filter((r) => r.id !== me.id), [me]);
  const picks = useMemo(() => suggestions(me, 4), [me]);
  const spend = useMemo(() => spendTotals(app.extraSpend), [app.extraSpend]);
  const incoming = useMemo(
    () => TRIPS.filter((t) => t.city === me.city).sort((a, b) => a.inDays - b.inDays).slice(0, 6),
    [me.city]
  );

  const deg = DEGREES.find((d) => d.n === me.degree) || DEGREES[0];
  const nextDeg = DEGREES.find((d) => d.n === me.degree + 1);
  const progress = nextDeg
    ? Math.min(1, (app.counts.meets / Math.max(1, nextDeg.need.meets)) * 0.5 +
        (app.counts.vouches / Math.max(1, nextDeg.need.vouches)) * 0.3 +
        (app.counts.events / Math.max(1, nextDeg.need.events || 1)) * 0.2)
    : 1;

  const city = CITIES[me.city];

  return (
    <div className="screen stack-22 rise-in">
      <div className="spread" style={{ marginTop: 4 }}>
        <div>
          <div className="eyebrow">{greeting()}</div>
          <div className="t-lg" style={{ marginTop: 2 }}>{(me.name || 'Резидент').split(' ')[0]}</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="chip" onClick={() => setCityOpen(true)}>
            {city.flag} {city.name}
          </button>
          <button className="iconbtn" style={{ position: 'relative' }} onClick={() => go('/club')}>
            <Icon name="bell" size={18} />
            <span className="badge-n">3</span>
          </button>
        </div>
      </div>

      <Passport me={me} chain={chain} />

      <div className="stats">
        <button className="stat tap" onClick={() => go('/capital')}>
          <div className="stat__v gold">{nf(me.uht, 0)}</div>
          <div className="stat__l">UHT · {usd(me.uht * pf.price)}</div>
        </button>
        <button className="stat tap" onClick={() => go('/wallet')}>
          <div className="stat__v">{nf(app.points)}</div>
          <div className="stat__l">Баллы</div>
        </button>
        <button className="stat tap" onClick={() => go('/rep')}>
          <div className="stat__v cyan">{app.counts.meets}</div>
          <div className="stat__l">Встречи</div>
        </button>
      </div>

      {/* степень */}
      <Card as="button" className="tap" onClick={() => go('/degrees')} style={{ display: 'block', width: '100%', textAlign: 'left' }}>
        <div className="spread">
          <div className="row" style={{ gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 11, display: 'grid', placeItems: 'center', background: `${deg.tone}22`, color: deg.tone, fontFamily: 'var(--display)', fontSize: 16, fontWeight: 700 }}>
              {deg.roman}
            </div>
            <div>
              <div className="t-md">Степень {deg.secret ? '·····' : deg.name}</div>
              <div className="t-xs dim">{nextDeg ? `До степени ${nextDeg.roman}` : 'Высшая известная степень'}</div>
            </div>
          </div>
          <Icon name="right" size={16} color="var(--ink-4)" />
        </div>
        {nextDeg && (
          <>
            <div style={{ marginTop: 12 }}><Bar value={progress} /></div>
            <div className="row t-xs dim-2" style={{ marginTop: 8, gap: 14 }}>
              <span>Встречи {app.counts.meets}/{nextDeg.need.meets}</span>
              <span>Поручительства {app.counts.vouches}/{nextDeg.need.vouches}</span>
              <span>События {app.counts.events}/{nextDeg.need.events}</span>
            </div>
          </>
        )}
      </Card>

      {/* ближайшее событие */}
      {next && (
        <Section eyebrow="Ближайшее" title="Событие" more="Все" onMore={() => go('/events')}>
          <Card as="button" className="tap" onClick={() => go(`/event/${next.id}`)} style={{ padding: 0, overflow: 'hidden', display: 'block', width: '100%', textAlign: 'left' }}>
            <Cover art={coverOf(next)} seed={next.id} height={124}>
              <div style={{ position: 'absolute', left: 14, right: 14, bottom: 12 }}>
                <div className="row" style={{ gap: 6, marginBottom: 6 }}>
                  <span className="tag" style={{ background: `${EVENT_KINDS[next.kind].tone}28`, color: EVENT_KINDS[next.kind].tone }}>
                    {EVENT_KINDS[next.kind].name}
                  </span>
                  <span className="tag tag--plain">{relDay(next.inDays)} · {next.time}</span>
                </div>
                <div className="t-lg">{next.title}</div>
              </div>
            </Cover>
            <div className="spread" style={{ padding: 13 }}>
              <div className="row" style={{ gap: 8 }}>
                <div style={{ display: 'flex' }}>
                  {next.going.slice(0, 4).map((id, i) => {
                    const p = RESIDENTS.find((r) => r.id === id);
                    return <div key={id} style={{ marginLeft: i ? -9 : 0 }}><Avatar person={p} size={24} /></div>;
                  })}
                </div>
                <span className="t-xs dim">{next.going.length} идут</span>
              </div>
              <span className="t-xs gold">{locById(next.loc)?.name}</span>
            </div>
          </Card>
        </Section>
      )}

      {/* кто рядом */}
      <Section eyebrow={`${city.flag} ${city.name}`} title="Кто рядом" more="Все люди" onMore={() => go('/people')}>
        {around.length ? (
          <div className="scroller">
            {around.map((r) => (
              <button key={r.id} className="card tap" style={{ width: 132, padding: 12 }} onClick={() => go(`/p/${r.id}`)}>
                <Avatar person={r} size={44} dot={r.online} />
                <div className="t-sm" style={{ marginTop: 9, fontWeight: 600, lineHeight: 1.25 }}>{r.name}</div>
                <div className="t-xs dim-2" style={{ marginTop: 3 }}>{r.role}</div>
              </button>
            ))}
          </div>
        ) : (
          <Card>
            <div className="t-sm dim">В этом городе пока никого из круга. Посмотрите карту — резиденты рядом могут быть в соседней стране.</div>
            <Btn size="sm" variant="quiet" style={{ marginTop: 12 }} onClick={() => go('/map')}>Открыть карту</Btn>
          </Card>
        )}
      </Section>

      {/* поездки */}
      <Section
        eyebrow="Перелёты круга"
        title={`Прилетают в ${city.name}`}
        more="Объявить поездку"
        onMore={() => setTripOpen(true)}
      >
        {incoming.length ? (
          <div className="stack-8">
            {incoming.map((t) => {
              const r = RESIDENTS.find((x) => x.id === t.who);
              if (!r) return null;
              return (
                <button key={t.who + t.inDays} className="card tap row-t" style={{ gap: 12 }} onClick={() => go(`/p/${r.id}`)}>
                  <Avatar person={r} size={40} dot={r.online} />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="row" style={{ gap: 7 }}>
                      <span className="t-md">{r.name}</span>
                      <span className="t-xs gold">{relDay(t.inDays)}</span>
                    </div>
                    <div className="t-xs dim" style={{ marginTop: 3, lineHeight: 1.4 }}>{t.note}</div>
                    <div className="t-xs dim-2" style={{ marginTop: 4 }}>
                      {t.days} {plural(t.days, 'день', 'дня', 'дней')} в городе
                    </div>
                  </div>
                  <Icon name="plane" size={16} color="var(--ink-4)" />
                </button>
              );
            })}
          </div>
        ) : (
          <Card>
            <div className="t-sm dim">В ближайшие недели в ваш город никто не летит. Объявите свою поездку — круг в другом городе увидит и позовёт.</div>
          </Card>
        )}
        {app.trips.length > 0 && (
          <div className="stack-8">
            {app.trips.map((t) => (
              <Card key={t.id} variant="gold" className="row" style={{ gap: 12 }}>
                <Icon name="plane" size={17} color="var(--gold)" />
                <div className="grow">
                  <div className="t-sm">Ваша поездка: {t.cityName}</div>
                  <div className="t-xs dim">{relDay(t.inDays)} · {t.days} {plural(t.days, 'день', 'дня', 'дней')}</div>
                </div>
                <button className="iconbtn" onClick={() => app.cancelTrip(t.id)}><Icon name="x" size={14} /></button>
              </Card>
            ))}
          </div>
        )}
      </Section>

      {/* подбор знакомств */}
      <Section eyebrow="Подбор" title="С кем познакомиться" more="Ещё" onMore={() => go('/people')}>
        <div className="stack-8">
          {picks.map((r) => (
            <button key={r.id} className="card tap row" style={{ gap: 12 }} onClick={() => go(`/p/${r.id}`)}>
              <Avatar person={r} size={42} dot={r.online} />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="t-md">{r.name}</div>
                <div className="t-xs dim clamp-2" style={{ marginTop: 2 }}>{r.gives}</div>
              </div>
              <Icon name="right" size={15} color="var(--ink-4)" />
            </button>
          ))}
        </div>
      </Section>

      {/* доля трат внутри */}
      <Card>
        <div className="row" style={{ gap: 16 }}>
          <Ring value={spend.share} size={96} stroke={8}>
            <div>
              <div className="display" style={{ fontSize: 22 }}>{pct(spend.share)}</div>
              <div className="eyebrow" style={{ fontSize: 8 }}>внутри</div>
            </div>
          </Ring>
          <div className="grow">
            <div className="t-md">Траты внутри кооператива</div>
            <div className="t-xs dim" style={{ marginTop: 5, lineHeight: 1.45 }}>
              Цель круга — 80%. Каждый доллар внутри возвращается: часть уходит в NAV,
              часть — кэшбэком вам.
            </div>
            <div className="t-xs gold" style={{ marginTop: 8 }}>
              {usd(spend.inside)} из {usd(spend.total)} за 90 дней
            </div>
          </div>
        </div>
      </Card>

      {/* быстрые действия */}
      <div className="tiles">
        <Quick icon="bed" title="Забронировать" to="/map" />
        <Quick icon="coin" title="Внести капитал" to="/capital" />
        <Quick icon="gavel" title="Голосовать" to="/dao" />
      </div>

      <Section eyebrow="Лента" title="Что происходит в круге">
        <div className="stack-8">
          {FEED.map((f, i) => (
            <Card key={i} className="row-t" style={{ gap: 11 }}>
              <div style={{ width: 30, height: 30, borderRadius: 10, flex: 'none', display: 'grid', placeItems: 'center', background: 'var(--panel-2)', color: f.tone }}>
                <Icon name={f.icon} size={15} />
              </div>
              <div>
                <div className="t-sm">{f.text}</div>
                <div className="t-xs dim-2" style={{ marginTop: 3 }}>{f.when}</div>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Sheet open={tripOpen} onClose={() => setTripOpen(false)} eyebrow="Круг увидит вас заранее" title="Объявить поездку">
        <div className="stack-16">
          <div>
            <div className="label">Куда</div>
            <div className="wrap">
              {Object.entries(CITIES).slice(0, 12).map(([key, c]) => (
                <Chip key={key} on={tripCity === key} onClick={() => setTripCity(key)}>{c.flag} {c.name}</Chip>
              ))}
            </div>
          </div>
          <div>
            <div className="label">Когда</div>
            <div className="wrap">
              {[1, 3, 7, 14, 30].map((d) => (
                <Chip key={d} on={tripIn === d} onClick={() => setTripIn(d)}>{relDay(d)}</Chip>
              ))}
            </div>
          </div>
          <div>
            <div className="label">Насколько</div>
            <div className="wrap">
              {[2, 3, 5, 7, 14, 30].map((d) => (
                <Chip key={d} on={tripDays === d} onClick={() => setTripDays(d)}>{d} {plural(d, 'день', 'дня', 'дней')}</Chip>
              ))}
            </div>
          </div>
          <Card>
            <KV k="Город" v={`${CITIES[tripCity].flag} ${CITIES[tripCity].name}`} />
            <KV k="Резидентов там" v={String(RESIDENTS.filter((r) => r.city === tripCity).length)} />
            <KV k="Локация UHOME" v={locById(`u-${tripCity}`)?.name || 'пока нет'} />
          </Card>
          <Btn
            variant="gold"
            wide
            onClick={() => {
              app.announceTrip({ city: tripCity, cityName: CITIES[tripCity].name, inDays: tripIn, days: tripDays });
              setTripOpen(false);
            }}
          >
            Объявить
          </Btn>
          <div className="center t-xs dim-2">
            Видна только дата и город. Точное место и маршрут клуб не спрашивает и не хранит.
          </div>
        </div>
      </Sheet>

      <Sheet open={cityOpen} onClose={() => setCityOpen(false)} eyebrow="Где вы сейчас" title="Город присутствия">
        <div className="t-sm dim" style={{ marginBottom: 14, lineHeight: 1.5 }}>
          Клуб знает только город, который вы указали сами. История перемещений не хранится.
        </div>
        <div className="wrap">
          {Object.entries(CITIES).map(([key, c]) => (
            <Chip key={key} on={me.city === key} onClick={() => { app.setMe({ city: key }); setCityOpen(false); }}>
              {c.flag} {c.name}
            </Chip>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

function Quick({ icon, title, to }) {
  return (
    <button className="tile" onClick={() => go(to)}>
      <div className="tile__ic"><Icon name={icon} size={19} /></div>
      <div className="tile__t">{title}</div>
    </button>
  );
}

const FEED = [
  { icon: 'users', tone: '#5FE0C8', text: 'Четыре новых резидента представлены кругу за неделю', when: 'сегодня' },
  { icon: 'chart', tone: '#D7B06A', text: 'Опубликован отчёт независимого оценщика по объектам в Азии', when: '2 дня назад' },
  { icon: 'gavel', tone: '#8E7BF5', text: 'Голосование о следующей локации UHOME закрывается через шесть дней', when: '3 дня назад' },
  { icon: 'seal', tone: '#F2789B', text: 'Назначена дата церемонии года и новогодней недели', when: 'неделю назад' },
];

function coverOf(e) {
  const tone = EVENT_KINDS[e.kind].tone;
  return [tone, '#0a0c13'];
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}
