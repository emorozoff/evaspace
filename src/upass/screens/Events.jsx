import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { Card, Chip, Seg, Scroller, Section, Empty, Tag } from '../components/UI.jsx';
import { Cover, Avatar } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';
import { EVENTS, EVENT_KINDS } from '../data/life.js';
import { LOCATIONS, CITIES, locById } from '../data/places.js';
import { RESIDENTS } from '../data/people.js';
import { canSee, eventDate, eventsSorted } from '../lib/select.js';
import { dateLong, weekday, relDay, usd, MONTH_NOM, WEEKDAYS, plural } from '../lib/format.js';

export default function Events() {
  const app = useApp();
  const { me } = app;
  const [tab, setTab] = useState('feed');
  const [city, setCity] = useState('all');
  const [kind, setKind] = useState('all');
  const [cursor, setCursor] = useState(0);

  const list = useMemo(() => {
    return eventsSorted()
      .filter((e) => e.inDays >= -14)
      .filter((e) => canSee(me, e.minTier, e.minDegree))
      .filter((e) => kind === 'all' || e.kind === kind)
      .filter((e) => city === 'all' || locById(e.loc)?.city === city);
  }, [me, kind, city]);

  const hiddenCount = EVENTS.filter((e) => e.inDays >= 0 && !canSee(me, e.minTier, e.minDegree)).length;

  const cities = useMemo(() => {
    const set = new Set(EVENTS.map((e) => locById(e.loc)?.city).filter(Boolean));
    return [...set];
  }, []);

  return (
    <div className="screen stack-16">
      <div className="spread">
        <div>
          <div className="eyebrow">Жизнь круга</div>
          <h2 className="display" style={{ marginTop: 3 }}>События</h2>
        </div>
        <button className="iconbtn" onClick={() => go('/club')}><Icon name="grid" size={18} /></button>
      </div>

      <Seg
        value={tab}
        onChange={setTab}
        options={[{ value: 'feed', label: 'Лента' }, { value: 'month', label: 'Календарь' }]}
      />

      <Scroller>
        <Chip on={kind === 'all'} onClick={() => setKind('all')}>Все форматы</Chip>
        {Object.entries(EVENT_KINDS).map(([k, v]) => (
          <Chip key={k} on={kind === k} onClick={() => setKind(k)}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: v.tone, display: 'inline-block' }} />
            {v.name}
          </Chip>
        ))}
      </Scroller>

      <Scroller>
        <Chip on={city === 'all'} onClick={() => setCity('all')}>Все города</Chip>
        {cities.map((c) => (
          <Chip key={c} on={city === c} onClick={() => setCity(c)}>{CITIES[c].flag} {CITIES[c].name}</Chip>
        ))}
      </Scroller>

      {tab === 'month' ? (
        <MonthGrid list={list} cursor={cursor} setCursor={setCursor} me={me} />
      ) : (
        <Feed list={list} me={me} app={app} />
      )}

      {hiddenCount > 0 && (
        <Card className="row-t" style={{ gap: 11 }}>
          <Icon name="lock" size={17} color="var(--ink-3)" />
          <div className="t-xs dim">
            {hiddenCount} {plural(hiddenCount, 'событие скрыто', 'события скрыты', 'событий скрыто')}: они требуют
            уровня выше вашего. Закрытые события не показываются даже списком.
          </div>
        </Card>
      )}
    </div>
  );
}

function Feed({ list, me, app }) {
  if (!list.length) return <Empty title="Событий не найдено" text="Смените фильтр или загляните в другой город." />;
  const past = list.filter((e) => e.inDays < 0);
  const future = list.filter((e) => e.inDays >= 0);
  return (
    <div className="stack-22">
      {future.length > 0 && (
        <div className="stack">
          {future.map((e) => <EventCard key={e.id} e={e} going={app.going.includes(e.id)} />)}
        </div>
      )}
      {past.length > 0 && (
        <Section eyebrow="Прошедшие" title="Записи и материалы">
          <div className="stack-8">
            {past.map((e) => (
              <button key={e.id} className="card tap row" style={{ gap: 12, opacity: 0.72 }} onClick={() => go(`/event/${e.id}`)}>
                <Icon name="clock" size={17} color="var(--ink-3)" />
                <div className="grow">
                  <div className="t-sm">{e.title}</div>
                  <div className="t-xs dim-2">{relDay(e.inDays)} · {locById(e.loc)?.name}</div>
                </div>
                <Icon name="right" size={14} color="var(--ink-4)" />
              </button>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

export function EventCard({ e, going }) {
  const loc = locById(e.loc);
  const k = EVENT_KINDS[e.kind];
  const d = eventDate(e);
  return (
    <button className="card tap" style={{ padding: 0, overflow: 'hidden', display: 'block', width: '100%', textAlign: 'left' }} onClick={() => go(`/event/${e.id}`)}>
      <Cover art={[k.tone, '#0a0c13']} seed={e.id} height={116}>
        <div style={{ position: 'absolute', left: 14, right: 14, bottom: 11 }}>
          <div className="row" style={{ gap: 6, marginBottom: 6 }}>
            <span className="tag" style={{ background: `${k.tone}2a`, color: k.tone }}>{k.name}</span>
            {e.minTier > 1 && <span className="tag tag--gold">от уровня {e.minTier}</span>}
            {going && <span className="tag tag--cyan">вы идёте</span>}
          </div>
          <div className="t-lg">{e.title}</div>
        </div>
      </Cover>
      <div className="spread" style={{ padding: 13 }}>
        <div>
          <div className="t-sm">{dateLong(d)}, {weekday(d)} · {e.time}</div>
          <div className="t-xs dim" style={{ marginTop: 2 }}>
            {CITIES[loc.city].flag} {loc.name}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="t-sm gold">{e.price ? usd(e.price) : 'Бесплатно'}</div>
          <div className="t-xs dim-2">{e.going.length} / {e.capacity}</div>
        </div>
      </div>
    </button>
  );
}

function MonthGrid({ list, cursor, setCursor, me }) {
  const base = new Date();
  const view = new Date(base.getFullYear(), base.getMonth() + cursor, 1);
  const year = view.getFullYear();
  const month = view.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const [pick, setPick] = useState(null);

  const byDay = useMemo(() => {
    const map = {};
    for (const e of list) {
      const d = eventDate(e);
      if (d.getFullYear() === year && d.getMonth() === month) {
        (map[d.getDate()] ||= []).push(e);
      }
    }
    return map;
  }, [list, year, month]);

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);

  const todayN = base.getMonth() === month && base.getFullYear() === year ? base.getDate() : null;
  const picked = pick && byDay[pick] ? byDay[pick] : null;

  return (
    <div className="stack-16">
      <div className="spread">
        <button className="iconbtn" onClick={() => { setCursor(cursor - 1); setPick(null); }}><Icon name="back" size={17} /></button>
        <div className="t-lg">{MONTH_NOM[month]} {year}</div>
        <button className="iconbtn" onClick={() => { setCursor(cursor + 1); setPick(null); }}><Icon name="right" size={17} /></button>
      </div>

      <Card tight>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
          {WEEKDAYS.map((w) => (
            <div key={w} className="eyebrow center" style={{ fontSize: 9, padding: '4px 0' }}>{w}</div>
          ))}
          {cells.map((d, i) => {
            const evs = d ? byDay[d] : null;
            const isToday = d === todayN;
            return (
              <button
                key={i}
                disabled={!d}
                onClick={() => setPick(d === pick ? null : d)}
                style={{
                  aspectRatio: '1', borderRadius: 10, display: 'grid', placeItems: 'center', gap: 2,
                  background: d && pick === d ? 'var(--panel-3)' : isToday ? 'var(--gold-soft)' : 'transparent',
                  border: isToday ? '1px solid rgba(215,176,106,.35)' : '1px solid transparent',
                  color: d ? (evs ? 'var(--ink)' : 'var(--ink-3)') : 'transparent',
                  fontSize: 13, fontWeight: evs ? 700 : 500,
                }}
              >
                <span>{d || ''}</span>
                <span style={{ display: 'flex', gap: 2, height: 4 }}>
                  {(evs || []).slice(0, 3).map((e, j) => (
                    <i key={j} style={{ width: 4, height: 4, borderRadius: 2, background: EVENT_KINDS[e.kind].tone, display: 'block' }} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {picked ? (
        <div className="stack-8">
          <div className="eyebrow">{pick} {MONTH_NOM[month].toLowerCase()}</div>
          {picked.map((e) => <EventCard key={e.id} e={e} />)}
        </div>
      ) : (
        <Card className="row-t" style={{ gap: 11 }}>
          <Icon name="calendar" size={17} color="var(--ink-3)" />
          <div className="t-xs dim">
            Точки под числом — события дня, цвет соответствует формату. Нажмите на день, чтобы раскрыть.
            В календарь попадают и ваши брони, и поездки круга.
          </div>
        </Card>
      )}
    </div>
  );
}
