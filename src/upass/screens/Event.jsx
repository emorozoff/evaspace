import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { TopBar, Card, Btn, Section, Bar, KV, Empty, Tag } from '../components/UI.jsx';
import { Cover, Avatar, QR } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';
import { eventById, EVENT_KINDS, AWARDS } from '../data/life.js';
import { locById, CITIES } from '../data/places.js';
import { RESIDENTS, byId } from '../data/people.js';
import { eventDate, visibleOnly } from '../lib/select.js';
import { dateLong, weekday, relDay, usd, usdExact, plural } from '../lib/format.js';

export default function Event({ id }) {
  const app = useApp();
  const e = eventById(id);
  if (!e) return <Empty title="Событие не найдено" />;

  const k = EVENT_KINDS[e.kind];
  const loc = locById(e.loc);
  const city = CITIES[loc.city];
  const host = byId(e.host);
  const d = eventDate(e);
  const going = app.going.includes(e.id);
  const seats = e.capacity - e.going.length - (going ? 1 : 0);
  const past = e.inDays < 0;
  const shown = visibleOnly(app.me, e.going);

  return (
    <>
      <TopBar title={e.title} subtitle={k.name} backTo="/events" />
      <div className="screen stack-22">
        <Cover art={[k.tone, '#0a0c13']} seed={e.id} height={188} radius={20}>
          <div style={{ position: 'absolute', left: 16, right: 16, bottom: 14 }}>
            <div className="row" style={{ gap: 6, marginBottom: 8 }}>
              <span className="tag" style={{ background: `${k.tone}2a`, color: k.tone }}>{k.name}</span>
              {e.minTier > 1 && <span className="tag tag--gold">уровень {e.minTier}+</span>}
            </div>
            <h2 className="display" style={{ fontSize: 26 }}>{e.title}</h2>
          </div>
        </Cover>

        <div className="stack-8">
          <Card className="row" style={{ gap: 12 }}>
            <Icon name="calendar" size={18} color="var(--gold)" />
            <div className="grow">
              <div className="t-md">{dateLong(d)}, {weekday(d)} · {e.time}</div>
              <div className="t-xs dim">{relDay(e.inDays)} · {city.tz}</div>
            </div>
          </Card>
          <button className="card tap row" style={{ gap: 12 }} onClick={() => go(`/loc/${loc.id}`)}>
            <Icon name="pin" size={18} color="var(--gold)" />
            <div className="grow">
              <div className="t-md">{loc.name}</div>
              <div className="t-xs dim">{city.flag} {city.name} · {loc.address}</div>
            </div>
            <Icon name="right" size={15} color="var(--ink-4)" />
          </button>
        </div>

        <p className="dim t-sm" style={{ lineHeight: 1.6, margin: 0 }}>{e.about}</p>

        {e.kind === 'summit' && <SummitProgram e={e} />}

        <Card>
          <div className="spread">
            <div className="t-md">Участники</div>
            <div className="t-xs dim">{e.going.length + (going ? 1 : 0)} из {e.capacity}</div>
          </div>
          <div style={{ marginTop: 10 }}><Bar value={(e.going.length + (going ? 1 : 0)) / e.capacity} /></div>
          <div className="scroller" style={{ marginTop: 14, marginBottom: -2 }}>
            {shown.map((p) => {
              const rid = p.id;
              return (
                <button key={rid} className="center" style={{ width: 62 }} onClick={() => go(`/p/${rid}`)}>
                  <Avatar person={p} size={40} dot={p.online} style={{ margin: '0 auto' }} />
                  <div className="t-xs dim" style={{ marginTop: 6 }}>{p.name.split(' ')[0]}</div>
                </button>
              );
            })}
          </div>
        </Card>

        {host && (
          <Section eyebrow="Ведёт" title="Организатор">
            <button className="card tap row" style={{ gap: 12 }} onClick={() => go(`/p/${host.id}`)}>
              <Avatar person={host} size={44} dot={host.online} />
              <div className="grow">
                <div className="t-md">{host.name}</div>
                <div className="t-xs dim">{host.role} · {host.company}</div>
              </div>
              <Icon name="right" size={15} color="var(--ink-4)" />
            </button>
          </Section>
        )}

        {going && !past && (
          <Card variant="gold">
            <div className="row" style={{ gap: 14 }}>
              <div style={{ background: '#fff', borderRadius: 9, padding: 4, lineHeight: 0, flex: 'none' }}>
                <QR value={`ticket:${e.id}:${app.me.number}`} size={78} />
              </div>
              <div>
                <div className="eyebrow eyebrow--gold">Билет резидента</div>
                <div className="t-md" style={{ marginTop: 4 }}>Покажите код на входе</div>
                <div className="t-xs dim" style={{ marginTop: 5, lineHeight: 1.45 }}>
                  Отметка о регистрации попадёт в вашу цепочку репутации и зачтётся в степень.
                </div>
              </div>
            </div>
          </Card>
        )}

        {!past && (
          <div style={{ position: 'sticky', bottom: 'calc(var(--tab-h) + 12px)' }}>
            <Btn
              variant={going ? 'ghost' : 'gold'}
              wide
              icon={going ? 'check' : undefined}
              onClick={() => app.toggleGoing(e.id, e.title)}
            >
              {going ? 'Вы идёте · отменить' : e.price ? `Купить билет · ${usdExact(e.price)}` : 'Записаться'}
            </Btn>
            {!going && seats <= 5 && seats > 0 && (
              <div className="center t-xs gold" style={{ marginTop: 8 }}>
                Осталось {seats} {plural(seats, 'место', 'места', 'мест')}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function SummitProgram({ e }) {
  const isNewYear = e.title.toLowerCase().includes('новогодняя');
  const days = isNewYear
    ? [
        { d: 'День 1', t: 'Съезд, открытие, общий ужин' },
        { d: 'День 2', t: 'Итоги года по направлениям, отчёт по активам и NAV' },
        { d: 'День 3', t: 'Секции кругов: капитал, ИИ, недвижимость, тело' },
        { d: 'День 4', t: 'Свободный день: спорт, вода, семьи' },
        { d: 'День 5', t: 'Голосования и решения на год' },
        { d: 'День 6', t: 'Церемония года: девять номинаций и посвящение в степени' },
        { d: 'День 7', t: 'Общий стол и проводы' },
      ]
    : [
        { d: 'День 1', t: 'Открытие, отчёт по активам, новые резиденты' },
        { d: 'День 2', t: 'Шесть параллельных секций, питчи, спорт с утра' },
        { d: 'День 3', t: 'Голосования, решения о покупках, общий ужин' },
      ];

  return (
    <Section eyebrow="Программа" title={isNewYear ? 'Неделя года' : 'Три дня'}>
      <div className="stack-8">
        {days.map((x) => (
          <Card key={x.d} className="row-t" style={{ gap: 12 }}>
            <div className="eyebrow eyebrow--gold" style={{ width: 48, flex: 'none', paddingTop: 2 }}>{x.d}</div>
            <div className="t-sm">{x.t}</div>
          </Card>
        ))}
      </div>
      {isNewYear && (
        <Card style={{ marginTop: 4 }}>
          <div className="eyebrow">Номинации церемонии</div>
          <div className="stack-8" style={{ marginTop: 10 }}>
            {AWARDS.map((a) => (
              <div key={a.id} className="row-t" style={{ gap: 9 }}>
                <Icon name="star" size={14} color="var(--gold)" style={{ marginTop: 2, flex: 'none' }} />
                <div>
                  <div className="t-sm">{a.name}</div>
                  <div className="t-xs dim-2" style={{ marginTop: 1 }}>{a.about}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </Section>
  );
}
