import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { Top, List, Item, Chip, Seg, Scroller, Section, Empty, Note } from '../components/UI.jsx';
import Poster, { PosterThumb } from '../components/Poster.jsx';
import Icon from '../components/Icons.jsx';
import { EVENTS, EVENT_KINDS, FLAGSHIPS } from '../data/life.js';
import { REGIONS } from '../data/regions.js';
import { eventDate, eventsSorted, canSee } from '../lib/select.js';
import { relDay, usdExact, MONTH_NOM, WEEKDAYS, plural, dateLong, weekday } from '../lib/format.js';

export default function Events() {
  const app = useApp();
  const { me } = app;
  const [tab, setTab] = useState('feed');
  const [filter, setFilter] = useState('all');
  const [cursor, setCursor] = useState(0);

  const list = useMemo(
    () =>
      eventsSorted()
        .filter((e) => e.inDays >= -14 && canSee(me, e.minDegree))
        .filter((e) => {
          if (filter === 'live') return e.online;
          if (filter === 'meet') return !e.online;
          if (filter === 'big') return FLAGSHIPS.includes(e.kind);
          if (filter === 'mine') return e.region === me.city || e.region === 'global';
          return true;
        }),
    [me, filter]
  );

  const big = EVENTS.filter((e) => FLAGSHIPS.includes(e.kind) && e.inDays >= 0).sort((a, b) => a.inDays - b.inDays);

  return (
    <div className="screen stack">
      <Top
        back title="Афиша" sub="Встречи в регионах и эфиры сообщества" />

      <Seg value={tab} onChange={setTab} options={[{ value: 'feed', label: 'Расписание' }, { value: 'month', label: 'Календарь' }]} />

      <Scroller>
        <Chip on={filter === 'all'} onClick={() => setFilter('all')}>Всё</Chip>
        <Chip on={filter === 'mine'} onClick={() => setFilter('mine')}>{REGIONS[me.city].flag} Мой регион</Chip>
        <Chip on={filter === 'live'} onClick={() => setFilter('live')}>Эфиры</Chip>
        <Chip on={filter === 'meet'} onClick={() => setFilter('meet')}>Встречи</Chip>
        <Chip on={filter === 'big'} onClick={() => setFilter('big')}>Большие слёты</Chip>
      </Scroller>

      {tab === 'month' ? (
        <MonthGrid list={list} cursor={cursor} setCursor={setCursor} going={app.going} />
      ) : (
        <>
          {filter === 'all' && big.length > 0 && (
            <Section title="Три больших события года">
              <div className="stack">
                {big.map((e) => (
                  <button key={e.id} className="tap" style={{ display: 'block', width: '100%' }} onClick={() => go(`/event/${e.id}`)}>
                    <Poster event={e} height={158} radius={16}>
                      <div className="scene__over">
                        <div className="t-lg" style={{ color: '#fff' }}>{e.title}</div>
                        <div className="t-xs" style={{ color: 'rgba(255,255,255,.72)', marginTop: 3 }}>
                          {relDay(e.inDays)} · {e.days} {plural(e.days, 'день', 'дня', 'дней')} · {REGIONS[e.region]?.name}
                        </div>
                      </div>
                    </Poster>
                  </button>
                ))}
              </div>
            </Section>
          )}
          <Feed list={list} going={app.going} skip={filter === 'all' ? big.map((e) => e.id) : []} />
        </>
      )}
    </div>
  );
}

export function EventItem({ e, going }) {
  const k = EVENT_KINDS[e.kind];
  const d = eventDate(e);
  return (
    <Item
      lead={<PosterThumb event={e} size={46} />}
      title={e.title}
      sub={`${d.getDate()} ${MONTH_NOM[d.getMonth()].toLowerCase().slice(0, 3)}, ${e.time} · ${e.online ? 'онлайн' : REGIONS[e.region]?.name || ''} · ${e.going.length} идут`}
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

function Feed({ list, going, skip = [] }) {
  const items = list.filter((e) => !skip.includes(e.id));
  if (!items.length) return <Empty title="Ничего не нашлось" text="Смените фильтр." />;
  const future = items.filter((e) => e.inDays >= 0);
  const past = items.filter((e) => e.inDays < 0);
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
              <Item key={e.id} icon="clock" title={e.title} sub={`${relDay(e.inDays)} · запись в базе знаний`} onClick={() => go(`/event/${e.id}`)} />
            ))}
          </List>
        </Section>
      )}
    </div>
  );
}

function MonthGrid({ list, cursor, setCursor, going }) {
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
        <List>{picked.map((e) => <EventItem key={e.id} e={e} going={going.includes(e.id)} />)}</List>
      ) : (
        <Note icon="calendar">Точки под числом — события дня. Синие — эфиры, золотые — встречи, розовые — слёты.</Note>
      )}
    </div>
  );
}
