import { useMemo, useState } from 'react';
import { useStore, todayIndex, dayStars, levelOf, totalStars } from '../lib/store.jsx';
import { TYPE_META, expertById, COURSES } from '../data/content.js';
import { StarField, StarRow, Avatar, Logo, MatchRing, LessonCard } from '../components/UI.jsx';
import Art from '../components/Art.jsx';
import { IcStar, IcSparkStar, IcCheck, IcPlay, IcClock, IcCalendar, IcCrown, IcNext, IcFlame } from '../components/Icons.jsx';
import { go } from '../lib/router.jsx';
import { whyLesson } from '../lib/matching.js';

const WD = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

/* подписи дней считаем от даты старта программы */
function dayLabels(createdAt) {
  const start = new Date(createdAt || Date.now());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return WD[d.getDay()];
  });
}

export default function Home() {
  const { state, dispatch, allLessons } = useStore();
  const today = todayIndex(state.program);
  const [day, setDay] = useState(today);
  const program = state.program;
  const lvl = levelOf(state.points);
  const stars = totalStars(state);

  const byId = useMemo(() => Object.fromEntries(allLessons.map((l) => [l.id, l])), [allLessons]);
  const DAY_NAMES = useMemo(() => dayLabels(program?.createdAt), [program]);
  const d = program?.days?.[day];
  const items = d ? [['affirmation', d.affirmation], ['practice', d.practice], ['masterclass', d.masterclass]] : [];

  const recommended = useMemo(() => {
    if (!program) return [];
    const used = new Set((program.days || []).flatMap((x) => [x.affirmation, x.practice, x.masterclass]));
    return allLessons
      .filter((l) => !used.has(l.id))
      .map((l) => ({ l, w: whyLesson(l, program.weights, program.meta) }))
      .sort((a, b) => b.w.percent - a.w.percent)
      .slice(0, 8);
  }, [allLessons, program]);

  const myCourses = COURSES.filter((c) => state.purchases.includes(c.id));

  return (
    <div className="screen">
      {/* ---------- шапка ---------- */}
      <div className="hero-dark">
        <StarField n={30} seed={3} />
        <div className="row between" style={{ marginBottom: 18 }}>
          <Logo light size={20} />
          <button className="icon-btn" style={{ background: 'rgba(255,255,255,.16)', color: '#fff', boxShadow: 'none' }} onClick={() => go('/profile')}>
            <Avatar name={state.name || 'Ты'} hue={330} size={34} />
          </button>
        </div>

        <div className="serif" style={{ fontSize: 29, lineHeight: 1.12 }}>
          {greet()}
          {state.name ? `, ${state.name}` : ''}
        </div>
        <div className="small" style={{ opacity: 0.82, marginTop: 6 }}>
          День {today + 1} из 7 · твоя личная программа
        </div>

        <div className="row" style={{ gap: 8, marginTop: 18 }}>
          <div className="stat glass" style={{ flex: 1 }}>
            <b>{stars}</b>
            <span>ЗВЁЗД ИЗ 21</span>
          </div>
          <div className="stat glass" style={{ flex: 1 }}>
            <b>{state.points}</b>
            <span>БАЛЛОВ</span>
          </div>
          <div className="stat glass" style={{ flex: 1 }}>
            <b>{state.bonus} ₽</b>
            <span>БОНУСОВ</span>
          </div>
        </div>

        <button className="row between glass" style={{ width: '100%', marginTop: 10, padding: '10px 14px', borderRadius: 18, color: '#fff' }} onClick={() => go('/report')}>
          <span className="badge-lvl">
            <IcCrown size={14} /> {lvl.current.emoji} {lvl.current.name}
          </span>
          <span className="tiny" style={{ opacity: 0.85, flex: 1, textAlign: 'right' }}>
            {lvl.next ? `ещё ${lvl.next.from - state.points} баллов до статуса «${lvl.next.name}»` : 'высший уровень'}
          </span>
          <IcNext size={16} />
        </button>
      </div>

      {/* ---------- неделя ---------- */}
      <div style={{ marginTop: 18 }}>
        <div className="pad row between" style={{ marginBottom: 10 }}>
          <div className="eyebrow">Программа на 7 дней</div>
          <button className="tiny" style={{ fontWeight: 800, color: 'var(--rose-deep)' }} onClick={() => go('/report')}>
            Отчёт недели
          </button>
        </div>
        <div className="pad">
        <div className="rail">
          {Array.from({ length: 7 }, (_, i) => {
            const s = dayStars(state, i);
            return (
              <button key={i} className={'day-pill' + (i === day ? ' on' : '') + (s === 3 ? ' done' : '')} onClick={() => setDay(i)}>
                <span>{DAY_NAMES[i]}</span>
                <b>{i + 1}</b>
                <div className="mini-stars">
                  {Array.from({ length: 3 }, (_, k) => (
                    <IcStar key={k} size={9} filled={k < s} style={{ color: k < s ? (i === day ? '#f6dfae' : '#d5a45c') : i === day ? 'rgba(255,255,255,.3)' : 'rgba(59,30,78,.16)' }} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
        </div>
      </div>

      {/* ---------- три карточки дня ---------- */}
      <div className="pad" style={{ marginTop: 6 }}>
        <div className="row between" style={{ marginBottom: 12 }}>
          <div>
            <div className="sect-title" style={{ fontSize: 23 }}>
              {day === today ? 'Сегодня' : `День ${day + 1}`}
            </div>
            <div className="tiny muted">Выполни три шага — получишь три звезды</div>
          </div>
          <StarRow count={dayStars(state, day)} />
        </div>

        <div className="stack">
          {items.map(([type, id], i) => {
            const lesson = byId[id];
            if (!lesson) return null;
            const done = !!state.done[`${day}:${id}`];
            return <DayCard key={id} lesson={lesson} done={done} index={i} onOpen={() => go(`/lesson/${day}/${id}`)} onToggle={() => dispatch({ type: done ? 'uncomplete' : 'complete', day, lessonId: id, lessonType: type })} />;
          })}
        </div>

        {dayStars(state, day) === 3 && (
          <div className="card anim-pop" style={{ marginTop: 14, background: 'linear-gradient(120deg,#fbeed3,#f7d8e6)', padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 26 }}>⭐️⭐️⭐️</div>
            <div style={{ fontWeight: 800, marginTop: 4 }}>День закрыт полностью!</div>
            <div className="tiny muted" style={{ marginTop: 4 }}>
              {stars === 21 ? 'Ты собрала суперзвезду недели 🏆' : `Осталось ${21 - stars} звёзд до суперзвезды недели`}
            </div>
          </div>
        )}
      </div>

      {/* ---------- почему такая программа ---------- */}
      <div className="pad">
        <div className="sect-head">
          <div className="sect-title">Почему такая программа</div>
        </div>
        <div className="card card-pad">
          <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
            <MatchRing percent={program?.matchPercent || 88} size={52} />
            <div style={{ flex: 1 }}>
              <div className="small" style={{ lineHeight: 1.55 }}>
                Ева прочитала твои ответы, превратила их в теги и сравнила с тегами {program?.scanned || allLessons.length} уроков библиотеки. В программу попали те, где совпадений больше всего.
              </div>
            </div>
          </div>
          <div className="divider" />
          <div className="tiny muted" style={{ marginBottom: 8 }}>Твои главные темы сейчас:</div>
          <div className="chips">
            {(program?.topTags || []).map((t) => (
              <span key={t} className="tag rose">{t}</span>
            ))}
          </div>
          <button className="btn ghost sm" style={{ width: '100%', marginTop: 14 }} onClick={() => dispatch({ type: 'rebuild' })}>
            Пересобрать программу
          </button>
        </div>
      </div>

      {/* ---------- быстрые действия ---------- */}
      <div className="pad" style={{ marginTop: 20 }}>
        <div className="grid-2" style={{ gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          <button className="qa" onClick={() => go('/cycle')}>
            <span className="ic" style={{ background: 'var(--lilac-soft)', color: '#5b3f7d' }}><IcCalendar size={18} /></span>
            Календарь
          </button>
          <button className="qa" onClick={() => go('/library')}>
            <span className="ic" style={{ background: 'var(--blush)', color: 'var(--rose-deep)' }}><IcPlay size={18} /></span>
            Контент
          </button>
          <button className="qa" onClick={() => go('/report')}>
            <span className="ic" style={{ background: '#fbeed3', color: '#8a6420' }}><IcStar size={18} /></span>
            Отчёт
          </button>
          <button className="qa" onClick={() => go('/eva')}>
            <span className="ic" style={{ background: 'linear-gradient(135deg,#f7c8d8,#c3a7ec)', color: '#fff' }}><IcSparkStar size={18} /></span>
            Ева
          </button>
        </div>
      </div>

      {/* ---------- мои курсы ---------- */}
      {myCourses.length > 0 && (
        <div className="pad">
          <div className="sect-head">
            <div className="sect-title">Мои курсы</div>
            <button className="link" onClick={() => go('/courses')}>Все</button>
          </div>
          <div className="stack">
            {myCourses.map((c) => (
              <button key={c.id} className="list-item" style={{ width: '100%', textAlign: 'left' }} onClick={() => go(`/course/${c.id}`)}>
                <div className="thumb"><Art art={c.art} id={c.id} ratio="1-1" /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="ttl">{c.title}</div>
                  <div className="tiny muted" style={{ marginTop: 4 }}>{expertById(c.expert).name}</div>
                  <div className="progress" style={{ marginTop: 8 }}><i style={{ width: '15%' }} /></div>
                </div>
                <IcNext size={18} style={{ color: 'var(--muted)' }} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ---------- рекомендации ---------- */}
      <div style={{ marginTop: 4 }}>
        <div className="pad sect-head">
          <div className="sect-title">Ещё для тебя</div>
          <button className="link" onClick={() => go('/library')}>Весь контент</button>
        </div>
        <div className="pad">
          <div className="rail">
            {recommended.map(({ l, w }) => (
              <LessonCard key={l.id} lesson={l} percent={w.percent} onClick={() => go(`/lesson/x/${l.id}`)} />
            ))}
          </div>
        </div>
      </div>

      <div style={{ height: 12 }} />
    </div>
  );
}

function greet() {
  const h = new Date().getHours();
  if (h < 5) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

function DayCard({ lesson, done, onOpen, onToggle, index }) {
  const m = TYPE_META[lesson.type];
  const ex = expertById(lesson.expert);

  if (lesson.type === 'affirmation') {
    return (
      <div className="card anim-up" style={{ animationDelay: index * 0.06 + 's' }}>
        <div style={{ position: 'relative' }}>
          <Art art={lesson.art} id={lesson.id} image={lesson.image} ratio="16-10" />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(30,12,40,.15),rgba(30,12,40,.65))' }} />
          <div style={{ position: 'absolute', inset: 0, padding: '16px 18px', display: 'flex', flexDirection: 'column', color: '#fff' }}>
            <div className="row between">
              <span className="tag" style={{ background: 'rgba(255,255,255,.92)', color: m.color }}>{m.emoji} Аффирмация дня</span>
              {done && <span className="tag gold"><IcCheck size={12} /></span>}
            </div>
            <div className="spacer" />
            <div className="serif" style={{ fontSize: 21, lineHeight: 1.25, textShadow: '0 2px 12px rgba(0,0,0,.35)' }}>
              «{lesson.title}»
            </div>
          </div>
        </div>
        <div className="card-pad">
          <div className="small" style={{ lineHeight: 1.5 }}>{lesson.text}</div>
          <div className="row" style={{ gap: 8, marginTop: 14 }}>
            <button className="btn sm ghost" style={{ flex: 1 }} onClick={onOpen}>Подробнее</button>
            <button className={'btn sm ' + (done ? 'gold' : 'primary')} style={{ flex: 1.4 }} onClick={onToggle}>
              {done ? '✓ Выполнено' : `Прочитала +${m.points}`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card anim-up" style={{ animationDelay: index * 0.06 + 's' }}>
      <button style={{ width: '100%', display: 'block', textAlign: 'left' }} onClick={onOpen}>
        <Art art={lesson.art} id={lesson.id} image={lesson.image} ratio="16-10">
          <div className="art-overlay" />
          <div style={{ position: 'absolute', top: 12, left: 12 }}>
            <span className="tag" style={{ background: 'rgba(255,255,255,.92)', color: m.color }}>{m.emoji} {m.label}</span>
          </div>
          <div className="play-big">
            <span className="play-circle" style={{ width: 56, height: 56, color: 'var(--plum)' }}><IcPlay size={20} /></span>
          </div>
          <div style={{ position: 'absolute', left: 14, right: 14, bottom: 12, color: '#fff' }}>
            <div style={{ fontWeight: 800, fontSize: 17, lineHeight: 1.25 }}>{lesson.title}</div>
            <div className="tiny" style={{ opacity: 0.88, marginTop: 3 }}>{ex.name} · {lesson.min} мин</div>
          </div>
        </Art>
      </button>
      <div className="card-pad" style={{ paddingTop: 12 }}>
        {lesson.sub && <div className="small muted" style={{ marginBottom: 12 }}>{lesson.sub}</div>}
        <div className="row" style={{ gap: 8 }}>
          <button className="btn sm ghost" style={{ flex: 1 }} onClick={onOpen}>
            <IcPlay size={15} /> Смотреть
          </button>
          <button className={'btn sm ' + (done ? 'gold' : 'primary')} style={{ flex: 1.2 }} onClick={onToggle}>
            {done ? '✓ Выполнено' : `Отметить +${m.points}`}
          </button>
        </div>
      </div>
    </div>
  );
}
