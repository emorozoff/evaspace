import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { TopBar, Card, Btn, Section, Sheet, KV, Bar, Chip, Empty } from '../components/UI.jsx';
import { Cover, Avatar } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';
import { locById, CITIES, KINDS, STATUS, AMENITIES } from '../data/places.js';
import { RESIDENTS } from '../data/people.js';
import { EVENTS, EVENT_KINDS } from '../data/life.js';
import { assetById } from '../data/capital.js';
import { usd, usdExact, nf, pct, relDay, dateShort, plural } from '../lib/format.js';
import { eventDate, visibleResidents } from '../lib/select.js';

export default function Location({ id }) {
  const app = useApp();
  const loc = locById(id);
  const [nights, setNights] = useState(4);
  const [open, setOpen] = useState(false);
  const [usePoints, setUsePoints] = useState(false);

  if (!loc) return <Empty title="Локация не найдена" />;

  const city = CITIES[loc.city];
  const lead = RESIDENTS.find((r) => r.id === loc.lead);
  const here = visibleResidents(app.me).filter((r) => r.city === loc.city);
  const events = EVENTS.filter((e) => e.loc === loc.id && e.inDays >= 0).sort((a, b) => a.inDays - b.inDays);
  const asset = loc.assetId ? assetById(loc.assetId) : null;

  const total = loc.tariff * nights;
  const discount = usePoints ? Math.min(app.points / 100, total * 0.3) : 0;
  const pay = Math.max(0, total - discount);
  const savedVsMarket = (loc.market - loc.tariff) * nights;

  const book = () => {
    if (usePoints && discount > 0) app.spendPoints(Math.round(discount * 100), 'оплата брони');
    app.book({ locId: loc.id, locName: loc.name, nights, total: pay });
    setOpen(false);
  };

  return (
    <>
      <TopBar title={loc.name} subtitle={`${city.flag} ${city.name}`} backTo="/map" />
      <div className="screen stack-22">
        <Cover art={loc.art} seed={loc.id} height={186} radius={20}>
          <div style={{ position: 'absolute', left: 16, bottom: 14, right: 16 }}>
            <div className="row" style={{ gap: 6, marginBottom: 7 }}>
              <span className="tag" style={{ background: `${STATUS[loc.status].tone}28`, color: STATUS[loc.status].tone }}>
                {STATUS[loc.status].name}
              </span>
              <span className="tag tag--plain">{KINDS[loc.kind].name}</span>
            </div>
            <h2 className="display" style={{ fontSize: 26 }}>{loc.name}</h2>
            <div className="t-xs dim" style={{ marginTop: 4 }}>{loc.address}</div>
          </div>
        </Cover>

        <div className="stats">
          <div className="stat"><div className="stat__v">{loc.keys || '—'}</div><div className="stat__l">Ключей</div></div>
          <div className="stat"><div className="stat__v">{loc.seats}</div><div className="stat__l">Мест в лаунже</div></div>
          <div className="stat"><div className="stat__v">{loc.residents}</div><div className="stat__l">Резидентов</div></div>
        </div>

        <p className="dim t-sm" style={{ lineHeight: 1.6, margin: 0 }}>{loc.about}</p>

        {loc.tariff > 0 && (
          <Card variant="gold">
            <div className="spread">
              <div>
                <div className="eyebrow eyebrow--gold">Внутренний тариф</div>
                <div className="display" style={{ fontSize: 30, marginTop: 4 }}>{usdExact(loc.tariff)}</div>
                <div className="t-xs dim">за ночь для резидента</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="t-sm dim-2" style={{ textDecoration: 'line-through' }}>{usdExact(loc.market)}</div>
                <div className="t-xs cyan" style={{ marginTop: 3 }}>−{pct(1 - loc.tariff / loc.market)} к рынку</div>
              </div>
            </div>
            <div className="t-xs dim" style={{ marginTop: 12, lineHeight: 1.45 }}>
              Тариф покрывает эксплуатацию, обслуживание, налоги и отчисление в резерв.
              Разница с рынком — это отсутствие арендной наценки третьей стороны, а не демпинг.
            </div>
            <Btn variant="gold" wide style={{ marginTop: 14 }} onClick={() => setOpen(true)} disabled={loc.status !== 'open'}>
              {loc.status === 'open' ? 'Забронировать' : 'Откроется позже'}
            </Btn>
          </Card>
        )}

        {loc.status === 'open' && (
          <Card>
            <div className="spread">
              <div className="t-md">Загрузка объекта</div>
              <div className="t-md gold num">{pct(loc.occupancy)}</div>
            </div>
            <div style={{ marginTop: 10 }}><Bar value={loc.occupancy} /></div>
            <div className="t-xs dim" style={{ marginTop: 8 }}>
              Приоритет при совпадении броней — по стажу членства и уровню, как записано в уставе.
            </div>
          </Card>
        )}

        <Section eyebrow="Что есть на месте" title="Инфраструктура">
          <div className="wrap">
            {loc.amenities.map((a) => (
              <span key={a} className="chip" style={{ pointerEvents: 'none' }}>{AMENITIES[a]}</span>
            ))}
          </div>
        </Section>

        {events.length > 0 && (
          <Section eyebrow="Календарь локации" title={`${events.length} ${plural(events.length, 'событие', 'события', 'событий')} впереди`} more="Все" onMore={() => go('/events')}>
            <div className="stack-8">
              {events.map((e) => (
                <button key={e.id} className="card tap row" style={{ gap: 12 }} onClick={() => go(`/event/${e.id}`)}>
                  <div style={{ width: 42, textAlign: 'center', flex: 'none' }}>
                    <div className="display" style={{ fontSize: 20 }}>{eventDate(e).getDate()}</div>
                    <div className="eyebrow" style={{ fontSize: 8 }}>{dateShort(eventDate(e)).split(' ')[1]}</div>
                  </div>
                  <div className="grow">
                    <div className="t-md">{e.title}</div>
                    <div className="t-xs dim" style={{ marginTop: 2 }}>
                      {e.time} · {EVENT_KINDS[e.kind].name} · {e.going.length} идут
                    </div>
                  </div>
                  <Icon name="right" size={15} color="var(--ink-4)" />
                </button>
              ))}
            </div>
          </Section>
        )}

        {lead && (
          <Section eyebrow="Отвечает за локацию" title="Управляющий">
            <button className="card tap row" style={{ gap: 12 }} onClick={() => go(`/p/${lead.id}`)}>
              <Avatar person={lead} size={44} dot={lead.online} />
              <div className="grow">
                <div className="t-md">{lead.name}</div>
                <div className="t-xs dim">{lead.role} · {lead.company}</div>
              </div>
              <Icon name="message" size={17} color="var(--ink-3)" />
            </button>
          </Section>
        )}

        {here.length > 0 && (
          <Section eyebrow="В городе" title={`${here.length} ${plural(here.length, 'резидент', 'резидента', 'резидентов')}`} more="Все" onMore={() => go(`/people?city=${loc.city}`)}>
            <div className="scroller">
              {here.map((r) => (
                <button key={r.id} className="card tap center" style={{ width: 96, padding: 11 }} onClick={() => go(`/p/${r.id}`)}>
                  <Avatar person={r} size={40} dot={r.online} style={{ margin: '0 auto' }} />
                  <div className="t-xs" style={{ marginTop: 8, fontWeight: 600 }}>{r.name.split(' ')[0]}</div>
                </button>
              ))}
            </div>
          </Section>
        )}

        {asset && (
          <Section eyebrow="Актив кооператива" title="Этот объект в портфеле">
            <Card>
              <KV k="Куплен" v={asset.bought.replace('-', ' · ')} />
              <KV k="Цена покупки" v={usd(asset.cost)} />
              <KV k="Текущая оценка" v={usd(asset.value)} tone="var(--gold)" />
              <KV k="Оценщик" v={asset.valuer} />
              <KV k="Арендный поток в год" v={usd(asset.rentYear)} />
              <Btn variant="quiet" wide size="sm" style={{ marginTop: 12 }} onClick={() => go('/capital')}>
                Как это влияет на NAV и цену UHT
              </Btn>
            </Card>
          </Section>
        )}
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} eyebrow={loc.name} title="Бронирование">
        <div className="stack-16">
          <div>
            <div className="label">Сколько ночей</div>
            <div className="wrap">
              {[2, 3, 4, 7, 10, 14, 21, 30].map((n) => (
                <Chip key={n} on={nights === n} onClick={() => setNights(n)}>{n}</Chip>
              ))}
            </div>
          </div>

          <Card>
            <KV k={`${usdExact(loc.tariff)} × ${nights} ${plural(nights, 'ночь', 'ночи', 'ночей')}`} v={usdExact(total)} />
            {discount > 0 && <KV k={`Баллы (${nf(Math.round(discount * 100))})`} v={`−${usdExact(discount)}`} tone="var(--cyan)" />}
            <KV k="К оплате" v={usdExact(Math.round(pay))} tone="var(--gold)" />
            <div className="t-xs cyan" style={{ marginTop: 10 }}>
              Дешевле рынка на {usdExact(savedVsMarket)} за эту поездку
            </div>
          </Card>

          <button className="card row tap" onClick={() => setUsePoints((v) => !v)} style={{ textAlign: 'left' }}>
            <div style={{ width: 22, height: 22, borderRadius: 7, flex: 'none', display: 'grid', placeItems: 'center', border: `1px solid ${usePoints ? 'var(--gold)' : 'var(--line-2)'}`, background: usePoints ? 'var(--gold-soft)' : 'transparent' }}>
              {usePoints && <Icon name="check" size={12} color="var(--gold)" />}
            </div>
            <div className="grow">
              <div className="t-sm">Списать баллы</div>
              <div className="t-xs dim-2">Доступно {nf(app.points)} баллов · до 30% суммы</div>
            </div>
          </button>

          <Btn variant="gold" wide onClick={book}>Подтвердить бронь</Btn>
          <div className="center t-xs dim-2">
            После выезда обе стороны подтверждают состояние объекта — это часть репутации.
          </div>
        </div>
      </Sheet>
    </>
  );
}
