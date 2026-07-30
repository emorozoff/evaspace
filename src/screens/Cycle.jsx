import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { CYCLE_PHASES } from '../data/content.js';
import { TopBar, LessonRow, StarField } from '../components/UI.jsx';
import { IcCalendar, IcNext, IcMoon } from '../components/Icons.jsx';
import { go } from '../lib/router.jsx';

const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_N = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

const toDate = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysBetween = (a, b) => Math.round((b - a) / 86400000);

function phaseForDay(day, length) {
  // растягиваем классические фазы под длину цикла
  const k = length / 28;
  for (const p of CYCLE_PHASES) {
    const from = Math.round((p.from - 1) * k) + 1;
    const to = Math.round(p.to * k);
    if (day >= from && day <= to) return p;
  }
  return CYCLE_PHASES[CYCLE_PHASES.length - 1];
}

export default function Cycle() {
  const { state, dispatch, allLessons } = useStore();
  const [form, setForm] = useState({ last: state.cycle?.last || fmt(new Date()), length: state.cycle?.length || 28 });
  const [monthOffset, setMonthOffset] = useState(0);

  const cycle = state.cycle;

  const info = useMemo(() => {
    if (!cycle) return null;
    const last = toDate(cycle.last);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.max(0, daysBetween(last, today));
    const day = (diff % cycle.length) + 1;
    const phase = phaseForDay(day, cycle.length);
    const next = new Date(last);
    while (next <= today) next.setDate(next.getDate() + cycle.length);
    return { day, phase, next, daysToNext: daysBetween(today, next) };
  }, [cycle]);

  const grid = useMemo(() => {
    const base = new Date();
    base.setDate(1);
    base.setMonth(base.getMonth() + monthOffset);
    const year = base.getFullYear();
    const month = base.getMonth();
    const first = new Date(year, month, 1);
    const startPad = (first.getDay() + 6) % 7;
    const total = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= total; d++) cells.push(new Date(year, month, d));
    return { cells, year, month };
  }, [monthOffset]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const recommended = useMemo(() => {
    if (!info) return [];
    return allLessons.filter((l) => (l.tags || []).some((t) => info.phase.tags.includes(t))).slice(0, 3);
  }, [info, allLessons]);

  /* ---------- форма, если календарь ещё не настроен ---------- */
  if (!cycle) {
    return (
      <div className="screen">
        <div className="hero-dark">
          <StarField n={22} seed={31} />
          <TopBar title="" dark onBack={() => go('/home')} />
          <div style={{ paddingBottom: 6 }}>
            <div style={{ fontSize: 30 }}>🌙</div>
            <div className="serif" style={{ fontSize: 26, marginTop: 6 }}>Календарь цикла</div>
            <div className="small" style={{ opacity: 0.85, marginTop: 8, lineHeight: 1.55 }}>
              Отметь начало последних месячных — и Ева будет подбирать практики под твою фазу.
            </div>
          </div>
        </div>

        <div className="pad" style={{ marginTop: 18 }}>
          <div className="card card-pad">
            <div className="tiny muted" style={{ marginBottom: 6 }}>Первый день последних месячных</div>
            <input className="input" type="date" value={form.last} onChange={(e) => setForm({ ...form, last: e.target.value })} />
            <div className="tiny muted" style={{ margin: '14px 0 6px' }}>Длина цикла: {form.length} дней</div>
            <div className="chips">
              {[21, 24, 26, 28, 30, 32, 35].map((n) => (
                <button key={n} className={'chip' + (form.length === n ? ' on' : '')} onClick={() => setForm({ ...form, length: n })}>
                  {n}
                </button>
              ))}
            </div>
            <button className="btn primary" style={{ marginTop: 18 }} onClick={() => dispatch({ type: 'cycle', value: { ...form, period: 5 } })}>
              Показать мой цикл
            </button>
          </div>

          <div className="card card-pad" style={{ marginTop: 12 }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Зачем это нужно</div>
            {CYCLE_PHASES.map((p) => (
              <div key={p.id} className="row" style={{ gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 18 }}>{p.emoji}</span>
                <div>
                  <b style={{ fontSize: 13.5 }}>{p.name}</b>
                  <div className="tiny muted" style={{ marginTop: 2, lineHeight: 1.45 }}>{p.advice}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- сам календарь ---------- */
  return (
    <div className="screen">
      <div className="hero-dark" style={{ background: `linear-gradient(140deg, #3a1a4a 0%, hsl(${info.phase.hue} 46% 36%) 58%, hsl(${info.phase.hue} 62% 58%) 100%)` }}>
        <StarField n={22} seed={41} />
        <TopBar title="" dark onBack={() => go('/home')} />
        <div style={{ paddingBottom: 4 }}>
          <div className="row between">
            <div>
              <div className="eyebrow" style={{ color: 'rgba(255,255,255,.75)' }}>День цикла</div>
              <div className="serif" style={{ fontSize: 32, lineHeight: 1.1, marginTop: 2 }}>{info.day}-й день</div>
            </div>
            <div style={{ fontSize: 38 }}>{info.phase.emoji}</div>
          </div>
          <div className="small" style={{ opacity: 0.9, marginTop: 6 }}>
            {info.phase.name} фаза · {info.phase.short}
          </div>
          <div className="glass" style={{ marginTop: 16, padding: '12px 14px', borderRadius: 18 }}>
            <div className="small" style={{ lineHeight: 1.55 }}>{info.phase.advice}</div>
          </div>
          <div className="tiny" style={{ opacity: 0.8, marginTop: 12 }}>
            Следующие месячные ≈ {info.next.getDate()} {MONTHS[info.next.getMonth()]} · через {info.daysToNext} дн.
          </div>
        </div>
      </div>

      <div className="pad" style={{ marginTop: 18 }}>
        <div className="card card-pad">
          <div className="row between" style={{ marginBottom: 14 }}>
            <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => setMonthOffset(monthOffset - 1)}>‹</button>
            <b style={{ fontSize: 15 }}>{MONTHS_N[grid.month]} {grid.year}</b>
            <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => setMonthOffset(monthOffset + 1)}>›</button>
          </div>
          <div className="cal-grid" style={{ marginBottom: 6 }}>
            {WD.map((w) => (
              <div key={w} className="tiny muted" style={{ textAlign: 'center', fontWeight: 800 }}>{w}</div>
            ))}
          </div>
          <div className="cal-grid">
            {grid.cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const diff = daysBetween(toDate(cycle.last), d);
              const cd = ((diff % cycle.length) + cycle.length) % cycle.length + 1;
              const p = phaseForDay(cd, cycle.length);
              const isToday = d.getTime() === today.getTime();
              return (
                <div
                  key={i}
                  className={'cal-cell' + (isToday ? ' today' : '')}
                  style={{ background: `hsl(${p.hue} 70% ${p.id === 'menstrual' ? 84 : 93}%)`, color: `hsl(${p.hue} 45% 32%)` }}
                  title={`${p.name}, день ${cd}`}
                >
                  {d.getDate()}
                </div>
              );
            })}
          </div>
          <div className="chips" style={{ marginTop: 14 }}>
            {CYCLE_PHASES.map((p) => (
              <span key={p.id} className="tiny row" style={{ gap: 5, marginRight: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: `hsl(${p.hue} 70% ${p.id === 'menstrual' ? 84 : 93}%)`, border: `1px solid hsl(${p.hue} 40% 75%)` }} />
                {p.short}
              </span>
            ))}
          </div>
        </div>

        <div className="sect-head">
          <div className="sect-title" style={{ fontSize: 21 }}>Практики для этой фазы</div>
        </div>
        <div className="stack">
          {recommended.map((l) => (
            <LessonRow key={l.id} lesson={l} onClick={() => go(`/lesson/x/${l.id}`)} />
          ))}
        </div>

        <button className="btn ghost" style={{ marginTop: 16 }} onClick={() => dispatch({ type: 'cycle', value: null })}>
          Изменить даты цикла
        </button>
        <div style={{ height: 14 }} />
      </div>
    </div>
  );
}
