import { useEffect, useState } from 'react';
import { QUESTIONS } from '../data/content.js';
import { useStore } from '../lib/store.jsx';
import { StarField, Logo, MatchRing } from '../components/UI.jsx';
import { IcCheck, IcNext, IcSparkStar } from '../components/Icons.jsx';
import { go, currentPath } from '../lib/router.jsx';

const STEPS = ['Читаю твои ответы', 'Просматриваю библиотеку и теги', 'Считаю совпадения по каждому уроку', 'Собираю программу на 7 дней'];

export default function Onboarding() {
  const { state, dispatch } = useStore();
  const [step, setStep] = useState(0); // 0 — приветствие, 1..6 — вопросы, 7 — анализ, 8 — результат
  const [name, setName] = useState(state.name || '');
  const [line, setLine] = useState(-1);

  const qIndex = step - 1;
  const q = QUESTIONS[qIndex];
  const picked = q ? state.answers[q.id] || [] : [];

  /* закрепляем онбординг за своим адресом: иначе после сборки программы
     экран «Ева анализирует» сразу сменился бы личным кабинетом */
  useEffect(() => {
    if (currentPath() !== '/onboarding') go('/onboarding', true);
  }, []);

  /* экран анализа */
  useEffect(() => {
    if (step !== 7) return;
    dispatch({ type: 'name', value: name.trim() });
    dispatch({ type: 'finish' });
    let i = 0;
    setLine(0);
    const t = setInterval(() => {
      i++;
      if (i >= STEPS.length) {
        clearInterval(t);
        setTimeout(() => setStep(8), 800);
      } else setLine(i);
    }, 900);
    return () => clearInterval(t);
  }, [step]);

  const next = () => {
    if (step === 0) {
      dispatch({ type: 'name', value: name.trim() });
      setStep(1);
      return;
    }
    setStep(step + 1);
  };

  return (
    <div className="onb">
      <StarField n={54} seed={11} />

      {/* ---------- приветствие ---------- */}
      {step === 0 && (
        <div className="onb-body" style={{ justifyContent: 'center' }}>
          <div className="anim-up" style={{ textAlign: 'center', marginBottom: 26 }}>
            <div style={{ display: 'inline-grid', placeItems: 'center', color: '#f6dfae', marginBottom: 14 }}>
              <IcSparkStar size={64} />
            </div>
            <div className="serif" style={{ fontSize: 42, lineHeight: 1.05, letterSpacing: 1 }}>
              Eva Space
            </div>
            <div style={{ opacity: 0.8, marginTop: 10, fontSize: 15, lineHeight: 1.5 }}>
              Платформа женского развития
              <br />с личной программой на каждый день
            </div>
          </div>

          <div className="anim-up d2" style={{ marginTop: 8 }}>
            <div className="tiny" style={{ opacity: 0.7, marginBottom: 8, paddingLeft: 4 }}>Как тебя зовут?</div>
            <input
              className="input"
              style={{ height: 54, fontSize: 17, background: 'rgba(255,255,255,.12)', border: '1.5px solid rgba(255,255,255,.2)', color: '#fff' }}
              placeholder="Имя"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={22}
            />
          </div>

          <div className="spacer" />

          <div className="anim-up d3" style={{ marginTop: 26 }}>
            <div className="small" style={{ opacity: 0.7, textAlign: 'center', marginBottom: 14, lineHeight: 1.5 }}>
              6 коротких вопросов — и Ева соберёт программу
              <br />из аффирмаций, практик и мастер-классов
            </div>
            <button className="btn gold" disabled={!name.trim()} onClick={next}>
              Начать <IcNext size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ---------- вопросы ---------- */}
      {q && (
        <div className="onb-body">
          <div className="row" style={{ gap: 12, marginBottom: 22 }}>
            <button className="icon-btn" style={{ background: 'rgba(255,255,255,.16)', color: '#fff', boxShadow: 'none' }} onClick={() => setStep(step - 1)}>
              ‹
            </button>
            <div className="dots" style={{ flex: 1 }}>
              {QUESTIONS.map((_, i) => (
                <i key={i} className={i <= qIndex ? 'on' : ''} />
              ))}
            </div>
            <div className="tiny" style={{ opacity: 0.6 }}>
              {qIndex + 1}/{QUESTIONS.length}
            </div>
          </div>

          <div key={q.id} className="anim-up">
            <div className="onb-q">{q.title}</div>
            <div className="small" style={{ opacity: 0.65, marginTop: 8 }}>{q.hint}</div>
          </div>

          <div className="stack" key={q.id + '-opts'} style={{ marginTop: 22 }}>
            {q.options.map((o, i) => {
              const on = picked.includes(o.id);
              return (
                <button
                  key={o.id}
                  className={'opt anim-up' + (on ? ' on' : '')}
                  style={{ animationDelay: 0.04 * i + 's' }}
                  onClick={() => dispatch({ type: 'answer', q, optId: o.id })}
                >
                  <span className="emo">{o.emo}</span>
                  <span style={{ flex: 1 }}>
                    {o.label}
                    {o.desc && <div className="desc">{o.desc}</div>}
                  </span>
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      border: on ? 'none' : '1.5px solid rgba(255,255,255,.3)',
                      background: on ? 'linear-gradient(135deg,#f6dfae,#e6a0c4)' : 'transparent',
                      color: '#4a2058',
                      flex: 'none',
                    }}
                  >
                    {on && <IcCheck size={13} />}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="spacer" style={{ minHeight: 20 }} />

          <button className="btn gold" style={{ marginTop: 18 }} disabled={!picked.length} onClick={next}>
            {step === QUESTIONS.length ? 'Собрать мою программу' : 'Дальше'} <IcNext size={18} />
          </button>
        </div>
      )}

      {/* ---------- анализ ---------- */}
      {step === 7 && (
        <div className="onb-body" style={{ justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', marginBottom: 34 }}>
            <div style={{ display: 'inline-grid', placeItems: 'center', color: '#f6dfae', animation: 'spinSlow 9s linear infinite' }}>
              <IcSparkStar size={58} />
            </div>
            <div className="serif" style={{ fontSize: 27, marginTop: 16 }}>
              Ева анализирует твои ответы
            </div>
            <div className="small" style={{ opacity: 0.65, marginTop: 6 }}>Это займёт пару секунд</div>
          </div>

          <div className="stack">
            {STEPS.map((s, i) => (
              <div key={i} className={'analyze-line' + (i <= line ? ' on' : '')}>
                <span className="tick">{i < line ? <IcCheck size={12} /> : i === line ? <span style={{ fontSize: 10 }}>●</span> : ''}</span>
                {s}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------- результат ---------- */}
      {step === 8 && <Reveal onOpen={() => go('/home')} />}
    </div>
  );
}

function Reveal({ onOpen }) {
  const { state } = useStore();
  const p = state.program;
  return (
    <div className="onb-body" style={{ justifyContent: 'center', textAlign: 'center' }}>
      <div className="anim-pop" style={{ display: 'grid', placeItems: 'center', marginBottom: 6 }}>
        <div
          style={{
            width: 108,
            height: 108,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            background: 'radial-gradient(circle at 50% 40%, rgba(246,223,174,.35), rgba(246,223,174,0) 70%)',
            color: '#f6dfae',
          }}
        >
          <IcSparkStar size={72} />
        </div>
      </div>

      <div className="serif anim-up d1" style={{ fontSize: 33, lineHeight: 1.1 }}>
        {state.name ? `${state.name}, твоя` : 'Твоя'}
        <br />
        программа готова
      </div>

      <div className="small anim-up d2" style={{ opacity: 0.75, marginTop: 12, lineHeight: 1.55 }}>
        Ева просмотрела {p?.scanned || 48} уроков и собрала
        <br />7 дней специально под твои ответы
      </div>

      <div className="anim-up d3" style={{ display: 'grid', placeItems: 'center', margin: '22px 0 6px' }}>
        <div style={{ background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 26, padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <MatchRing percent={p?.matchPercent || 88} size={62} color="#f6dfae" />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>совпадение с тобой</div>
            <div className="tiny" style={{ opacity: 0.7 }}>21 урок · 7 дней</div>
          </div>
        </div>
      </div>

      <div className="anim-up d4" style={{ marginTop: 16 }}>
        <div className="tiny" style={{ opacity: 0.6, marginBottom: 8 }}>Программа построена вокруг тем:</div>
        <div className="chips" style={{ justifyContent: 'center' }}>
          {(p?.topTags || []).map((t) => (
            <span key={t} className="chip" style={{ background: 'rgba(255,255,255,.14)', borderColor: 'rgba(255,255,255,.2)', color: '#fff' }}>
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="spacer" />

      <button className="btn gold anim-up d5" style={{ marginTop: 26 }} onClick={onOpen}>
        Открыть личный кабинет
      </button>
    </div>
  );
}
