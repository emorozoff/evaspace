import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { Top, List, Item, Chip, Seg, Scroller, Section, Empty, Note } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';
import { EVENTS, EVENT_KINDS } from '../data/life.js';
import { CITIES, locById } from '../data/places.js';
import { canSee, eventDate, eventsSorted } from '../lib/select.js';
import { DateBlock } from './Location.jsx';
import { relDay, usdExact, MONTH_NOM, WEEKDAYS, plural, weekday, dateLong } from '../lib/format.js';

export default function Events() {
  const app = useApp();
  const { me } = app;
  const [tab, setTab] = useState('feed');
  const [kind, setKind] = useState('all');
  const [cursor, setCursor] = useState(0);

  const list = useMemo(
    () => eventsSorted().filter((e) => e.inDays >= -14).filter((e) => canSee(me, e.minTier, e.minDegree)).filter((e) => kind === 'all' || e.kind === kind),
    [me, kind]
  );
  const hiddenCount = EVENTS.filter((e) => e.inDays >= 0 && !canSee(me, e.minTier, e.minDegree)).length;

  return (
    <div className="screen stack">
      <Top title="События" right={<button className="iconbtn" onClick={() => go('/club')}><Icon name="back" size={18} /></button>} />

      <Seg value={tab} onChange={setTab} options={[{ value: 'feed', label: 'Лента' }, { value: 'month', label: 'Календарь' }]} />

      <Scroller>
        <Chip on={kind === 'all'} onClick={() => setKind('all')}>Все</Chip>
        {Object.entries(EVENT_KINDS).map(([k, v]) => (
          <Chip key={k} on={kind === k} onClick={() => setKind(k)}>
            <span style={{ width: 7, height: 7, borderRadius: 4, background: v.tone, display: 'inline-block' }} />
            {v.name}
          </Chip>
        ))}
      </Scroller>

      {tab === 'month' ? <MonthGrid list={list} cursor={cursor} setCursor={setCursor} /> : <Feed list={list} going={app.going} />}

      {hiddenCount > 0 && (
        <Note icon="lock">{hiddenCount} {plural(hiddenCount, 'событие скрыто', 'события скрыты', 'событий скрыто')}: они требуют уровня выше вашего.</Note>
      )}
    </div>
  );
}

export function EventItem({ e, going }) {
  const loc = locById(e.loc);
  const k = EVENT_KINDS[e.kind];
  return (
    <Item
      lead={<DateBlock d={eventDate(e)} />}
      title={e.title}
      sub={`${e.time} · ${CITIES[loc.city].flag} ${loc.name} · ${e.going.length} идут`}
      meta={
        <>
          <span className="tag" style={{ background: `${k.tone}22`, color: k.tone }}>{k.name}</span>
          <span>{going ? 'вы идёте' : e.price ? usdExact(e.price) : 'бесплатно'}</span>
        </>
      }
      chev={false}
      onClick={() => go(`/event/${e.id}`)}
    />
  );
}

function Feed({ list, going }) {
  if (!list.length) return <Empty title="Событий не найдено" />;
  const future = list.filter((e) => e.inDays >= 0);
  const past = list.filter((e) => e.inDays < 0);
  const groups = [];
  for (const e of future) {
    const key = e.inDays <= 7 ? 'На этой неделе' : e.inDays <= 30 ? 'В этом месяце' : 'Позже';
    (groups.find((g) => g.key === key) || groups[groups.push({ key, items: [] }) - 1]).items.push(e);
  }
  return (
    <div className="stack-20">
      {groups.map((g) => (
        <Section key={g.key} title={g.key}>
          <List>{g.items.map((e) => <EventItem key={e.id} e={e} going={going.includes(e.id)} />)}</List>
        </Section>
      ))}
      {past.length > 0 && (
        <Section title="Прошедшие · записи">
          <List>
            {past.map((e) => (
              <Item key={e.id} icon="clock" title={e.title} sub={`${relDay(e.inDays)} · ${locById(e.loc)?.name}`} onClick={() => go(`/event/${e.id}`)} />
            ))}
          </List>
        </Section>
      )}
    </div>
  );
}

function MonthGrid({ list, cursor, setCursor }) {
  const base = new Date();
  const view = new Date(base.getFullYear(), base.getMonth() + cursor, 1);
  const year = view.getFullYear(), month = view.getMonth();
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const [pick, setPick] = useState(null);

  const byDay = useMemo(() => {
    const map = {};
    for (const e of list) {
      const d = eventDate(e);
      if (d.getFullYear() === year && d.getMonth() === month) (map[d.getDate()] ||= []).push(e);
    }
    return map;
  }, [list, year, month]);

  const cells = [...Array(startOffset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const todayN = base.getMonth() === month && base.getFullYear() === year ? base.getDate() : null;
  const picked = pick && byDay[pick];

  return (
    <div className="stack">
      <div className="spread">
        <button className="iconbtn" onClick={() => { setCursor(cursor - 1); setPick(null); }}><Icon name="back" size={17} /></button>
        <div className="t-lg">{MONTH_NOM[month]} {year}</div>
        <button className="iconbtn" onClick={() => { setCursor(cursor + 1); setPick(null); }}><Icon name="right" size={17} /></button>
      </div>
      <div className="card" style={{ padding: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
          {WEEKDAYS.map((w) => <div key={w} className="eyebrow center" style={{ fontSize: 9, padding: '4px 0' }}>{w}</div>)}
          {cells.map((d, i) => {
            const evs = d ? byDay[d] : null;
            const isToday = d === todayN;
            return (
              <button
                key={i}
                disabled={!d}
                onClick={() => setPick(d === pick ? null : d)}
                style={{
                  aspectRatio: '1', borderRadius: 10, display: 'grid', placeItems: 'center', gap: 2, textAlign: 'center',
                  background: d && pick === d ? 'var(--surface-3)' : isToday ? 'var(--gold-soft)' : 'transparent',
                  color: d ? (evs ? 'var(--ink)' : 'var(--ink-3)') : 'transparent', fontSize: 13, fontWeight: evs ? 700 : 500,
                }}
              >
                <span>{d || ''}</span>
                <span style={{ display: 'flex', gap: 2, height: 4 }}>
                  {(evs || []).slice(0, 3).map((e, j) => <i key={j} style={{ width: 4, height: 4, borderRadius: 2, background: EVENT_KINDS[e.kind].tone, display: 'block' }} />)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {picked ? (
        <List>{picked.map((e) => <EventItem key={e.id} e={e} />)}</List>
      ) : (
        <Note icon="calendar">Нажмите на день с точками — раскроются события. Цвет точки — формат.</Note>
      )}
    </div>
  );
}
