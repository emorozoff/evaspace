import { useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { TopBar, List, Item, Btn, Section, Sheet, KV, Bar, Chip, Empty, Note } from '../components/UI.jsx';
import Scene from '../components/Scene.jsx';
import { Avatar } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';
import { locById, CITIES, KINDS, STATUS, AMENITIES } from '../data/places.js';
import { byId } from '../data/people.js';
import { EVENTS, EVENT_KINDS } from '../data/life.js';
import { assetById } from '../data/capital.js';
import { usd, usdExact, nf, pct, plural, dateShort } from '../lib/format.js';
import { eventDate, visibleResidents } from '../lib/select.js';

export default function Location({ id }) {
  const app = useApp();
  const loc = locById(id);
  const [nights, setNights] = useState(4);
  const [open, setOpen] = useState(false);
  const [usePoints, setUsePoints] = useState(false);

  if (!loc) return <Empty title="Локация не найдена" />;

  const city = CITIES[loc.city];
  const lead = byId(loc.lead);
  const here = visibleResidents(app.me).filter((r) => r.city === loc.city);
  const events = EVENTS.filter((e) => e.loc === loc.id && e.inDays >= 0).sort((a, b) => a.inDays - b.inDays);
  const asset = loc.assetId ? assetById(loc.assetId) : null;

  const total = loc.tariff * nights;
  const discount = usePoints ? Math.min(app.points / 100, total * 0.3) : 0;
  const pay = Math.max(0, total - discount);

  const book = () => {
    if (usePoints && discount > 0) app.spendPoints(Math.round(discount * 100), 'оплата брони');
    app.book({ locId: loc.id, locName: loc.name, nights, total: pay });
    setOpen(false);
  };

  return (
    <>
      <TopBar title={loc.name} sub={`${city.flag} ${city.name}, ${city.country}`} backTo="/map" />
      <div className="screen stack-20">
        <Scene city={loc.city} height={190} label>
          <div className="scene__over">
            <div className="row" style={{ gap: 6, marginBottom: 6 }}>
              <span className="tag" style={{ background: `${STATUS[loc.status].tone}2a`, color: STATUS[loc.status].tone }}>{STATUS[loc.status].name}</span>
              <span className="tag">{KINDS[loc.kind].name}</span>
            </div>
            <div className="h2" style={{ color: '#fff' }}>{loc.name}</div>
            <div className="t-xs" style={{ color: 'rgba(255,255,255,.65)', marginTop: 3 }}>{loc.address}</div>
          </div>
        </Scene>

        <p className="lead">{loc.about}</p>

        {loc.tariff > 0 && (
          <div className="card card--gold">
            <div className="spread">
              <div>
                <div className="eyebrow eyebrow--gold">Тариф резидента</div>
                <div className="display" style={{ fontSize: 30, marginTop: 4 }}>{usdExact(loc.tariff)} <span className="t-sm dim">за ночь</span></div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="t-sm dim-2" style={{ textDecoration: 'line-through' }}>{usdExact(loc.market)}</div>
                <div className="t-xs cyan" style={{ marginTop: 3 }}>−{pct(1 - loc.tariff / loc.market)} к рынку</div>
              </div>
            </div>
            <Btn variant="gold" wide style={{ marginTop: 14 }} onClick={() => setOpen(true)} disabled={loc.status !== 'open'}>
              {loc.status === 'open' ? 'Забронировать' : 'Откроется позже'}
            </Btn>
          </div>
        )}

        <div className="card" style={{ paddingTop: 2, paddingBottom: 2 }}>
          <KV k="Ключей" v={String(loc.keys || '—')} />
          <KV k="Мест в лаунже" v={String(loc.seats)} />
          <KV k="Резидентов в городе" v={String(loc.residents)} />
          {loc.status === 'open' && <KV k="Загрузка" v={pct(loc.occupancy)} tone="var(--gold)" />}
          {loc.opened && <KV k="Открытие" v={String(loc.opened)} />}
        </div>

        <Section title="На месте">
          <div className="wrap">{loc.amenities.map((a) => <span key={a} className="chip">{AMENITIES[a]}</span>)}</div>
        </Section>

        {events.length > 0 && (
          <Section title="Календарь локации" more="Все" onMore={() => go('/events')}>
            <List>
              {events.map((e) => (
                <Item
                  key={e.id}
                  lead={<DateBlock d={eventDate(e)} />}
                  title={e.title}
                  sub={`${e.time} · ${EVENT_KINDS[e.kind].name} · ${e.going.length} идут`}
                  onClick={() => go(`/event/${e.id}`)}
                />
              ))}
            </List>
          </Section>
        )}

        {(lead || here.length > 0) && (
          <Section title="Люди">
            <List>
              {lead && <Item lead={<Avatar person={lead} size={44} dot={lead.online} />} title={lead.name} sub={`Управляющий локацией · ${lead.company}`} onClick={() => go(`/p/${lead.id}`)} />}
              {here.filter((r) => r.id !== lead?.id).slice(0, 4).map((r) => (
                <Item key={r.id} lead={<Avatar person={r} size={44} dot={r.online} />} title={r.name} sub={`${r.title} · ${r.company}`} onClick={() => go(`/p/${r.id}`)} />
              ))}
              {here.length > 5 && <Item icon="users" title={`Все резиденты в городе · ${here.length}`} onClick={() => go(`/people?city=${loc.city}`)} />}
            </List>
          </Section>
        )}

        {asset && (
          <Section title="В портфеле кооператива">
            <div className="card" style={{ paddingTop: 2, paddingBottom: 2 }}>
              <KV k="Куплен" v={asset.bought.replace('-', ' · ')} />
              <KV k="Цена покупки" v={usd(asset.cost)} />
              <KV k="Оценка" v={usd(asset.value)} tone="var(--gold)" />
              <KV k="Оценщик" v={asset.valuer} />
              <KV k="Аренда в год" v={usd(asset.rentYear)} />
            </div>
            <Btn variant="quiet" size="sm" wide onClick={() => go('/capital')}>Как это влияет на цену UHT</Btn>
          </Section>
        )}
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Бронирование" sub={loc.name}>
        <div className="stack">
          <div>
            <div className="label">Ночей</div>
            <div className="wrap">{[2, 3, 4, 7, 10, 14, 21, 30].map((n) => <Chip key={n} on={nights === n} onClick={() => setNights(n)}>{n}</Chip>)}</div>
          </div>
          <div className="card" style={{ paddingTop: 2, paddingBottom: 2 }}>
            <KV k={`${usdExact(loc.tariff)} × ${nights} ${plural(nights, 'ночь', 'ночи', 'ночей')}`} v={usdExact(total)} />
            {discount > 0 && <KV k="Баллы" v={`−${usdExact(discount)}`} tone="var(--cyan)" />}
            <KV k="К оплате" v={usdExact(Math.round(pay))} tone="var(--gold)" />
            <KV k="Экономия к рынку" v={usdExact((loc.market - loc.tariff) * nights)} tone="var(--cyan)" />
          </div>
          <button className="card row tap" onClick={() => setUsePoints((v) => !v)}>
            <div style={{ width: 22, height: 22, borderRadius: 7, flex: 'none', display: 'grid', placeItems: 'center', border: `1px solid ${usePoints ? 'var(--gold)' : 'var(--line-2)'}`, background: usePoints ? 'var(--gold-soft)' : 'transparent' }}>
              {usePoints && <Icon name="check" size={12} color="var(--gold)" />}
            </div>
            <div className="grow">
              <div className="t-sm">Списать баллы</div>
              <div className="t-xs dim-2">Доступно {nf(app.points)} · до 30% суммы</div>
            </div>
          </button>
          <Btn variant="gold" wide onClick={book}>Подтвердить бронь</Btn>
        </div>
      </Sheet>
    </>
  );
}

export function DateBlock({ d }) {
  return (
    <div style={{ width: 44, flex: 'none', textAlign: 'center', padding: '4px 0', borderRadius: 10, background: 'var(--surface-3)' }}>
      <div className="display" style={{ fontSize: 19 }}>{d.getDate()}</div>
      <div className="eyebrow" style={{ fontSize: 8 }}>{dateShort(d).split(' ')[1]}</div>
    </div>
  );
}
