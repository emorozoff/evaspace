import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { TYPE_META, expertById } from '../data/content.js';
import Art from '../components/Art.jsx';
import { Avatar, TopBar, LessonRow, MatchRing } from '../components/UI.jsx';
import { IcPlay, IcCheck, IcClock, IcHeart, IcSparkStar, IcNext } from '../components/Icons.jsx';
import { go, back } from '../lib/router.jsx';
import { whyLesson } from '../lib/matching.js';

const BASE = import.meta.env.BASE_URL;

export default function Lesson({ dayParam, id }) {
  const { state, dispatch, allLessons } = useStore();
  const lesson = allLessons.find((l) => l.id === id);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef(null);

  // если урок есть в программе — засчитываем в тот день
  const day = useMemo(() => {
    const days = state.program?.days || [];
    const idx = days.findIndex((d) => [d.affirmation, d.practice, d.masterclass].includes(id));
    if (idx >= 0) return String(idx);
    return dayParam === 'x' ? 'x' : String(dayParam);
  }, [state.program, id, dayParam]);

  const done = !!state.done[`${day}:${id}`];

  /* «плеер» для уроков без видеофайла — анимированная обложка с таймером */
  useEffect(() => {
    if (!playing || (lesson?.video && !failed)) return;
    const total = 16000;
    const t0 = Date.now();
    const t = setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / total);
      setProgress(p);
      if (p >= 1) clearInterval(t);
    }, 100);
    return () => clearInterval(t);
  }, [playing, lesson, failed]);

  if (!lesson) {
    return (
      <div className="screen">
        <TopBar title="Урок не найден" />
        <div className="pad">
          <button className="btn ghost" onClick={() => go('/library')}>В библиотеку</button>
        </div>
      </div>
    );
  }

  const m = TYPE_META[lesson.type];
  const ex = expertById(lesson.expert);
  const why = whyLesson(lesson, state.program?.weights, state.program?.meta);
  const related = allLessons.filter((l) => l.id !== lesson.id && l.tags?.some((t) => lesson.tags?.includes(t))).slice(0, 4);
  const useVideo = !!lesson.video && !failed;

  const complete = () => {
    dispatch({ type: done ? 'uncomplete' : 'complete', day, lessonId: id, lessonType: lesson.type });
  };

  return (
    <div className="screen no-nav">
      {/* ---------- плеер ---------- */}
      <div className="player-wrap">
        {useVideo && playing ? (
          <video
            ref={videoRef}
            controls
            autoPlay
            playsInline
            loop={false}
            onError={() => setFailed(true)}
            onEnded={() => setProgress(1)}
            style={{ background: '#1c0f27' }}
          >
            <source src={`${BASE}${lesson.video}.mp4`} type="video/mp4" />
            <source src={`${BASE}${lesson.video}.webm`} type="video/webm" />
          </video>
        ) : (
          <>
            <Art art={lesson.art} id={lesson.id} image={lesson.image} ratio="16-9" kenburns={playing} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(28,15,39,.25),rgba(28,15,39,.55))' }} />
            {!playing ? (
              <div className="play-big">
                <button className="play-circle" style={{ color: 'var(--plum)' }} onClick={() => setPlaying(true)} aria-label="Смотреть">
                  <IcPlay size={26} />
                </button>
              </div>
            ) : (
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff', textAlign: 'center', padding: 20 }}>
                <div>
                  <div style={{ animation: 'floaty 4s ease-in-out infinite' }}><IcSparkStar size={34} /></div>
                  <div className="serif" style={{ fontSize: 20, marginTop: 8, textShadow: '0 2px 10px rgba(0,0,0,.4)' }}>
                    {progress >= 1 ? 'Практика завершена' : 'Практика идёт…'}
                  </div>
                  <div className="tiny" style={{ opacity: 0.8, marginTop: 4 }}>
                    {progress >= 1 ? 'Отметь выполнение ниже' : 'Дыши спокойно и следуй за голосом'}
                  </div>
                </div>
              </div>
            )}
            {playing && (
              <div style={{ position: 'absolute', left: 14, right: 14, bottom: 12 }}>
                <div className="progress" style={{ background: 'rgba(255,255,255,.25)' }}>
                  <i style={{ width: progress * 100 + '%', background: 'linear-gradient(90deg,#f6dfae,#e6a0c4)' }} />
                </div>
              </div>
            )}
          </>
        )}

        <button
          className="icon-btn"
          style={{ position: 'absolute', top: 'calc(var(--safe-t) + 12px)', left: 12, background: 'rgba(0,0,0,.35)', color: '#fff', boxShadow: 'none' }}
          onClick={back}
          aria-label="Назад"
        >
          ‹
        </button>
        <button
          className="icon-btn"
          style={{ position: 'absolute', top: 'calc(var(--safe-t) + 12px)', right: 12, background: 'rgba(0,0,0,.35)', color: state.favorites[id] ? '#ff9bc0' : '#fff', boxShadow: 'none' }}
          onClick={() => dispatch({ type: 'fav', id })}
          aria-label="В избранное"
        >
          <IcHeart size={18} filled={!!state.favorites[id]} />
        </button>
      </div>

      {/* ---------- инфо ---------- */}
      <div className="pad" style={{ marginTop: 16 }}>
        <div className="row" style={{ gap: 8, marginBottom: 8 }}>
          <span className="tag" style={{ background: '#fff', color: m.color, boxShadow: 'var(--sh-sm)' }}>{m.emoji} {m.label}</span>
          <span className="tag"><IcClock size={11} style={{ marginRight: 4 }} />{lesson.min} мин</span>
          {lesson.custom && <span className="tag green">Добавлен через админку</span>}
        </div>

        <div className="sect-title" style={{ fontSize: 27 }}>{lesson.title}</div>
        {lesson.sub && <div className="small muted" style={{ marginTop: 6 }}>{lesson.sub}</div>}

        <button className="list-item" style={{ width: '100%', marginTop: 16, textAlign: 'left' }} onClick={() => go(`/expert/${ex.id}`)}>
          <Avatar name={ex.name} hue={ex.hue} size={46} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 14.5 }}>{ex.name}</div>
            <div className="tiny muted">{ex.role}</div>
          </div>
          <IcNext size={18} style={{ color: 'var(--muted)' }} />
        </button>

        {lesson.type === 'affirmation' ? (
          <div className="card card-pad" style={{ marginTop: 14, background: 'linear-gradient(120deg,#fdf1ec,#f7e2ee)' }}>
            <div className="serif" style={{ fontSize: 21, lineHeight: 1.4 }}>«{lesson.text}»</div>
            <div className="tiny muted" style={{ marginTop: 12 }}>
              Прочитай вслух три раза. Медленно, с паузой между повторами — так формулировка доходит до тела, а не остаётся в голове.
            </div>
          </div>
        ) : (
          lesson.about && (
            <div className="card card-pad" style={{ marginTop: 14 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Об уроке</div>
              <div className="small" style={{ lineHeight: 1.6 }}>{lesson.about}</div>
            </div>
          )
        )}

        {/* почему подобрано — показываем, только когда есть реальные совпадения */}
        {state.program && why.tags.length > 0 && (
          <div className="card card-pad" style={{ marginTop: 12 }}>
            <div className="row" style={{ gap: 14 }}>
              <MatchRing percent={why.percent} size={50} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>Подходит тебе</div>
                <div className="tiny muted" style={{ marginTop: 3 }}>Совпало по тегам: {why.tags.join(', ')}</div>
              </div>
            </div>
          </div>
        )}

        <div className="chips" style={{ marginTop: 14 }}>
          {(lesson.tags || []).map((t) => (
            <button key={t} className="chip" onClick={() => go(`/library?tag=${encodeURIComponent(t)}`)}>#{t}</button>
          ))}
        </div>

        <button className={'btn ' + (done ? 'gold' : 'primary')} style={{ marginTop: 20 }} onClick={complete}>
          {done ? (
            <>
              <IcCheck size={18} /> Выполнено · звезда получена
            </>
          ) : (
            <>Отметить выполненной · +{m.points} баллов</>
          )}
        </button>
        {!done && <div className="tiny muted" style={{ textAlign: 'center', marginTop: 8 }}>За каждый выполненный урок — звезда в программе дня</div>}

        {related.length > 0 && (
          <>
            <div className="sect-head">
              <div className="sect-title" style={{ fontSize: 21 }}>Похожее</div>
            </div>
            <div className="stack" style={{ marginBottom: 10 }}>
              {related.map((l) => (
                <LessonRow key={l.id} lesson={l} onClick={() => go(`/lesson/x/${l.id}`)} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
