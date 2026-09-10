import { useEffect, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { STEPS, stepDone } from '../data/onboarding.js';
import Choice from '../components/Choice.jsx';
import { Btn } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';

/* Знакомство после регистрации: четыре лёгких экрана.
   Ничего не печатаем — только нажимаем на плитки. */

export default function Onboarding() {
  const { dispatch } = useStore();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  // Новый шаг всегда начинается сверху — иначе после длинного экрана
  // человек оказывается в середине следующего вопроса
  useEffect(() => window.scrollTo(0, 0), [index]);
  const step = STEPS[index];
  const ready = stepDone(step, answers);
  const last = index === STEPS.length - 1;

  const set = (questionId, value) => setAnswers((a) => ({ ...a, [questionId]: value }));

  const next = () => {
    if (!last) return setIndex(index + 1);
    dispatch({ type: 'onboard', facts: answers });
  };

  return (
    <div className="app">
      <div className="screen screen--plain stack-20">
        <div className="row" style={{ paddingTop: 6 }}>
          {index > 0 && (
            <button className="iconbtn" onClick={() => setIndex(index - 1)} aria-label="Назад"><Icon name="back" size={18} /></button>
          )}
          <div className="grow">
            <div className="steps">
              {STEPS.map((s, i) => <i key={s.id} data-on={i <= index} />)}
            </div>
          </div>
        </div>

        <div>
          <div className="eyebrow">{step.eyebrow}</div>
          <h1 className="h1" style={{ marginTop: 6 }}>{step.title}</h1>
          <p className="t-sm dim-2" style={{ marginTop: 8, lineHeight: 1.5 }}>{step.sub}</p>
        </div>

        {step.questions.map((q) => (
          <section key={q.id} className="stack-8">
            {q.title && (
              <div className="spread" style={{ padding: '0 4px' }}>
                <span className="hdr" style={{ padding: 0 }}>{q.title}</span>
                {q.max > 1 && <span className="t-xs dim-2">{(answers[q.id] || []).length} из {q.max}</span>}
              </div>
            )}
            {q.hint && <div className="t-xs dim-2" style={{ padding: '0 4px', marginTop: -4 }}>{q.hint}</div>}
            <Choice
              options={q.options}
              value={answers[q.id] || []}
              max={q.max}
              list={q.list}
              onChange={(v) => set(q.id, v)}
              wide={Boolean(q.options[0]?.big)}
            />
          </section>
        ))}

        <div className="sticky-cta sticky-cta--solid">
          <Btn variant="accent" wide disabled={!ready} onClick={next}>
            {last ? 'Готово' : 'Дальше'}
          </Btn>
        </div>

        <div className="t-xs dim-2 center">
          По ответам ИИ-куратор собирает равные команды. В каталоге видны только роль, сфера и увлечения.
        </div>
      </div>
    </div>
  );
}
