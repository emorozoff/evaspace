import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { COURSES, EXPERTS, expertById, courseById } from '../data/content.js';
import Art from '../components/Art.jsx';
import { Avatar, TopBar, Price, StarField, LessonRow, Sheet, Empty } from '../components/UI.jsx';
import { IcStar, IcCheck, IcLock, IcPlay, IcNext, IcCrown, IcSparkStar } from '../components/Icons.jsx';
import { go } from '../lib/router.jsx';

/* ============ Список курсов ============ */
export function Courses() {
  const { state, allLessons } = useStore();

  // эксперты, чьи практики уже есть в программе — их курсы показываем первыми
  const programExperts = useMemo(() => {
    const ids = new Set();
    (state.program?.days || []).forEach((d) => {
      [d.affirmation, d.practice, d.masterclass].forEach((id) => {
        const l = allLessons.find((x) => x.id === id);
        if (l) ids.add(l.expert);
      });
    });
    return ids;
  }, [state.program, allLessons]);

  const sorted = useMemo(() => {
    return [...COURSES].sort((a, b) => (programExperts.has(b.expert) ? 1 : 0) - (programExperts.has(a.expert) ? 1 : 0));
  }, [programExperts]);

  return (
    <div className="screen">
      <div className="topbar">
        <div style={{ flex: 1 }}>
          <div className="eyebrow">Обучение</div>
          <h1 style={{ marginTop: 2 }}>Курсы экспертов</h1>
        </div>
      </div>

      <div className="pad">
        <div className="card" style={{ background: 'var(--grad-hero)', color: '#fff', padding: 18, position: 'relative', overflow: 'hidden' }}>
          <StarField n={18} seed={9} />
          <div style={{ position: 'relative' }}>
            <div className="serif" style={{ fontSize: 21, lineHeight: 1.2 }}>Понравилась бесплатная практика?</div>
            <div className="small" style={{ opacity: 0.85, marginTop: 6, lineHeight: 1.5 }}>
              У каждого эксперта есть полный курс — продолжение того, что ты уже пробовала в программе.
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <div className="pad sect-head" style={{ marginTop: 0 }}>
          <div className="sect-title">Эксперты</div>
        </div>
        <div className="pad">
        <div className="rail">
          {EXPERTS.map((e) => (
            <button key={e.id} className="card" style={{ width: 132, padding: 14, textAlign: 'center' }} onClick={() => go(`/expert/${e.id}`)}>
              <div style={{ display: 'grid', placeItems: 'center' }}>
                <Avatar name={e.name} hue={e.hue} size={58} />
              </div>
              <div style={{ fontWeight: 800, fontSize: 13, marginTop: 9, lineHeight: 1.25 }}>{e.name}</div>
              <div className="tiny muted" style={{ marginTop: 3, lineHeight: 1.3 }}>{e.role}</div>
              <div className="tiny" style={{ marginTop: 6, color: 'var(--gold)', fontWeight: 800 }}>★ {e.rating}</div>
            </button>
          ))}
        </div>
        </div>
      </div>

      <div className="pad">
        <div className="sect-head">
          <div className="sect-title">Все курсы</div>
          <span className="tiny muted">{COURSES.length} шт.</span>
        </div>
        <div className="stack">
          {sorted.map((c) => {
            const ex = expertById(c.expert);
            const bought = state.purchases.includes(c.id);
            return (
              <button key={c.id} className="card" style={{ width: '100%', textAlign: 'left' }} onClick={() => go(`/course/${c.id}`)}>
                <Art art={c.art} id={c.id} ratio="16-10">
                  <div className="art-overlay" />
                  {programExperts.has(c.expert) && (
                    <div style={{ position: 'absolute', top: 10, left: 10 }}>
                      <span className="tag" style={{ background: 'rgba(255,255,255,.92)', color: 'var(--rose-deep)' }}>
                        <IcSparkStar size={11} style={{ marginRight: 4 }} /> эксперт из твоей программы
                      </span>
                    </div>
                  )}
                  {bought && (
                    <div style={{ position: 'absolute', top: 10, right: 10 }}>
                      <span className="tag green"><IcCheck size={11} style={{ marginRight: 3 }} /> куплен</span>
                    </div>
                  )}
                  <div style={{ position: 'absolute', left: 14, right: 14, bottom: 12, color: '#fff' }}>
                    <div style={{ fontWeight: 800, fontSize: 18, lineHeight: 1.2 }}>{c.title}</div>
                    <div className="tiny" style={{ opacity: 0.9, marginTop: 3 }}>{ex.name} · {c.lessons.length} уроков</div>
                  </div>
                </Art>
                <div className="card-pad">
                  <div className="small muted" style={{ lineHeight: 1.5 }}>{c.about}</div>
                  <div className="row between" style={{ marginTop: 12 }}>
                    <Price value={c.price} old={c.oldPrice} />
                    <span className="tiny muted">★ {c.rating} · {c.buyers.toLocaleString('ru-RU')} учениц</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ============ Страница курса ============ */
export function CourseDetail({ id }) {
  const { state, dispatch } = useStore();
  const c = courseById(id);
  const [pay, setPay] = useState(false);
  if (!c) return <Empty emoji="🔍" title="Курс не найден" action={<button className="btn ghost sm" onClick={() => go('/courses')}>К курсам</button>} />;
  const ex = expertById(c.expert);
  const bought = state.purchases.includes(c.id);

  return (
    <div className="screen no-nav">
      <div style={{ position: 'relative' }}>
        <Art art={c.art} id={c.id} ratio="16-10" />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(30,12,40,.2),rgba(30,12,40,.75))' }} />
        <button className="icon-btn" style={{ position: 'absolute', top: 'calc(var(--safe-t) + 12px)', left: 12, background: 'rgba(0,0,0,.35)', color: '#fff', boxShadow: 'none' }} onClick={() => go('/courses')}>‹</button>
        <div style={{ position: 'absolute', left: 18, right: 18, bottom: 16, color: '#fff' }}>
          <div className="serif" style={{ fontSize: 27, lineHeight: 1.15 }}>{c.title}</div>
          <div className="small" style={{ opacity: 0.9, marginTop: 6 }}>{c.lessons.length} уроков · ★ {c.rating}</div>
        </div>
      </div>

      <div className="pad" style={{ marginTop: 16 }}>
        <button className="list-item" style={{ width: '100%', textAlign: 'left' }} onClick={() => go(`/expert/${ex.id}`)}>
          <Avatar name={ex.name} hue={ex.hue} size={46} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 14.5 }}>{ex.name}</div>
            <div className="tiny muted">{ex.role}</div>
          </div>
          <IcNext size={18} style={{ color: 'var(--muted)' }} />
        </button>

        <div className="card card-pad" style={{ marginTop: 12 }}>
          <div className="small" style={{ lineHeight: 1.6 }}>{c.about}</div>
          <div className="chips" style={{ marginTop: 12 }}>
            {c.tags.map((t) => (
              <span key={t} className="tag rose">{t}</span>
            ))}
          </div>
        </div>

        <div className="sect-head">
          <div className="sect-title" style={{ fontSize: 21 }}>Программа курса</div>
        </div>
        <div className="stack">
          {c.lessons.map((title, i) => (
            <div key={i} className="list-item">
              <div style={{ width: 34, height: 34, borderRadius: 12, flex: 'none', display: 'grid', placeItems: 'center', background: bought || i === 0 ? 'var(--blush)' : 'rgba(59,30,78,.06)', color: bought || i === 0 ? 'var(--rose-deep)' : 'var(--muted)', fontWeight: 800, fontSize: 13 }}>
                {bought || i === 0 ? <IcPlay size={14} /> : <IcLock size={14} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ttl" style={{ fontSize: 14 }}>{title}</div>
                <div className="tiny muted" style={{ marginTop: 2 }}>Урок {i + 1} · {12 + i * 3} мин</div>
              </div>
              {i === 0 && !bought && <span className="tag green">бесплатно</span>}
            </div>
          ))}
        </div>

        {bought ? (
          <button className="btn gold" style={{ marginTop: 20 }} onClick={() => dispatch({ type: 'toast', value: 'В MVP уроки курса — заглушки' })}>
            <IcCheck size={18} /> Курс открыт — продолжить
          </button>
        ) : (
          <>
            <div className="card card-pad" style={{ marginTop: 20, background: 'linear-gradient(120deg,#fdf1ec,#f7e2ee)' }}>
              <div className="row between">
                <div>
                  <div className="tiny muted">Цена со скидкой</div>
                  <Price value={c.price} old={c.oldPrice} />
                </div>
                <div className="tag gold">−{Math.round((1 - c.price / c.oldPrice) * 100)}%</div>
              </div>
              <div className="tiny muted" style={{ marginTop: 8 }}>Доступ навсегда · +150 баллов после покупки</div>
            </div>
            <button className="btn primary" style={{ marginTop: 12 }} onClick={() => setPay(true)}>
              Купить курс за {c.price.toLocaleString('ru-RU')} ₽
            </button>
          </>
        )}
        <div style={{ height: 20 }} />
      </div>

      <Sheet open={pay} onClose={() => setPay(false)} title="Оплата курса">
        <div className="pad" style={{ paddingBottom: 20 }}>
          <div className="card card-pad flat">
            <div className="row between">
              <span className="small">{c.title}</span>
              <b>{c.price.toLocaleString('ru-RU')} ₽</b>
            </div>
            <div className="divider" />
            <div className="row between small muted">
              <span>Начислим баллов</span>
              <span>+150</span>
            </div>
          </div>
          <div className="tiny muted" style={{ textAlign: 'center', margin: '14px 0' }}>
            Это демо-оплата: настоящая касса подключается на следующем этапе
          </div>
          <button
            className="btn primary"
            onClick={() => {
              dispatch({ type: 'buyCourse', id: c.id });
              setPay(false);
            }}
          >
            Оплатить {c.price.toLocaleString('ru-RU')} ₽
          </button>
          <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => setPay(false)}>Отмена</button>
        </div>
      </Sheet>
    </div>
  );
}

/* ============ Страница эксперта ============ */
export function ExpertPage({ id }) {
  const { allLessons } = useStore();
  const ex = expertById(id);
  const lessons = allLessons.filter((l) => l.expert === id);
  const courses = COURSES.filter((c) => c.expert === id);

  return (
    <div className="screen no-nav">
      <div className="hero-dark" style={{ background: `linear-gradient(140deg, #3a1a4a 0%, hsl(${ex.hue} 46% 36%) 58%, hsl(${ex.hue} 62% 58%) 100%)` }}>
        <StarField n={22} seed={ex.hue} />
        <TopBar title="" dark onBack={() => go('/courses')} />
        <div style={{ textAlign: 'center', paddingBottom: 6 }}>
          <div style={{ display: 'grid', placeItems: 'center', marginBottom: 12 }}>
            <Avatar name={ex.name} hue={ex.hue} size={84} ring />
          </div>
          <div className="serif" style={{ fontSize: 26 }}>{ex.name}</div>
          <div className="small" style={{ opacity: 0.85, marginTop: 4 }}>{ex.role}</div>
          <div className="row" style={{ justifyContent: 'center', gap: 22, marginTop: 16 }}>
            <div className="stat"><b>★ {ex.rating}</b><span>РЕЙТИНГ</span></div>
            <div className="stat"><b>{(ex.students / 1000).toFixed(1)}k</b><span>УЧЕНИЦ</span></div>
            <div className="stat"><b>{lessons.length}</b><span>УРОКОВ</span></div>
          </div>
        </div>
      </div>

      <div className="pad" style={{ marginTop: 16 }}>
        <div className="card card-pad">
          <div className="small" style={{ lineHeight: 1.6 }}>{ex.bio}</div>
        </div>

        {courses.length > 0 && (
          <>
            <div className="sect-head">
              <div className="sect-title" style={{ fontSize: 21 }}>Курсы</div>
            </div>
            <div className="stack">
              {courses.map((c) => (
                <button key={c.id} className="list-item" style={{ width: '100%', textAlign: 'left' }} onClick={() => go(`/course/${c.id}`)}>
                  <div className="thumb"><Art art={c.art} id={c.id} ratio="1-1" /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="ttl">{c.title}</div>
                    <div className="row" style={{ marginTop: 6 }}><Price value={c.price} old={c.oldPrice} /></div>
                  </div>
                  <IcNext size={18} style={{ color: 'var(--muted)' }} />
                </button>
              ))}
            </div>
          </>
        )}

        <div className="sect-head">
          <div className="sect-title" style={{ fontSize: 21 }}>Бесплатные уроки</div>
        </div>
        <div className="stack" style={{ marginBottom: 16 }}>
          {lessons.map((l) => (
            <LessonRow key={l.id} lesson={l} onClick={() => go(`/lesson/x/${l.id}`)} />
          ))}
        </div>
      </div>
    </div>
  );
}
