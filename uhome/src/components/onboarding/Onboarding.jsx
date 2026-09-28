import { useMemo, useRef, useState } from 'react';
import { STEPS } from '../../data/test.js';
import { REGIONS } from '../../data/regions.js';
import { memberNumber } from '../../lib/art.js';
import { morph } from '../../lib/motion.js';
import { Btn } from '../UI.jsx';
import Icon from '../Icons.jsx';
import Strip from './Strip.jsx';
import StepBody from './StepBody.jsx';
import Analysis from './Analysis.jsx';
import Issued from './Issued.jsx';

/* Регистрация — одна карточка посреди экрана. Она не перемонтируется:
   от шага к шагу меняется содержимое, а переход делает morph()
   (View Transitions). У карточки, портрета ассистента, флагов и выбранных
   чипов есть view-transition-name, поэтому они физически переезжают:
   ответ — из тела карточки в полосу профиля наверху, портрет — в угол,
   флаг — в центр. Сверху карточки тонкая золотая линия — прогресс.
   После последнего шага карточка коротко «собирает профиль» и сама
   становится паспортом резидента.

   applicant — поля пустые (заявка); резидент видит подставленное из
   профиля и только подтверждает. onCommit — ответы отданы (перед сборкой),
   onEnter — «Войти в клуб», onLater — «Позже» с тем, что уже известно,
   onExit — назад с первого шага. */

const pad2 = (n) => String(n).padStart(2, '0');
const uniq = (xs) => [...new Set(xs.filter(Boolean))];
const compact = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && !(Array.isArray(v) && !v.length)));

const EMPTY = { name: '', role: '', company: '', region: '', assistant: '', tone: '', sphere: '', needs: [], gives: [], interests: [], formats: [] };

const fromMe = (me, applicant) =>
  applicant
    ? EMPTY
    : {
        name: me.name || '', role: me.role || '', company: me.company || '', region: me.region || '',
        assistant: me.assistant || '', tone: me.tone || '', sphere: me.sphere || '',
        needs: me.needs || [], gives: me.gives || [], interests: me.interests || [], formats: me.formats || [],
      };

const profileOf = (f) => ({
  name: f.name.trim(), role: f.role, title: f.role, company: f.company.trim(),
  region: f.region, city: REGIONS[f.region]?.name || '',
});
const answersOf = (f, initial, applicant) => ({
  assistant: f.assistant, tone: f.tone, sphere: f.sphere, needs: f.needs, gives: f.gives, interests: f.interests,
  regionsOften: uniq([f.region, ...(applicant ? [] : initial.regionsOften || [])]), formats: f.formats,
});
// у кандидата номер и год вступления появляются вместе с паспортом
const metaOf = (f, applicant) => {
  if (!applicant) return {};
  const y = new Date().getFullYear();
  return { since: y, number: memberNumber(f.name.trim(), y) };
};

const OK = {
  who: (f) => f.name.trim().length >= 2 && !!f.role,
  sphere: (f) => !!f.sphere,
  region: (f) => !!f.region,
  assistant: (f) => !!f.assistant,
  tone: (f) => !!f.tone,
  exchange: (f) => f.needs.length > 0 && f.gives.length > 0,
  social: (f) => f.interests.length > 0,
};

export default function Onboarding({ app, initial, applicant = false, onCommit, onEnter, onLater, onExit }) {
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState('q'); // q → analyze → pass
  const [f, setF] = useState(() => fromMe(initial, applicant));
  const cardEl = useRef(null);
  const cardRect = useRef(null);
  const total = STEPS.length;
  const cur = STEPS[step];
  const ok = OK[cur.id](f);

  const profile = () => ({ ...profileOf(f), ...metaOf(f, applicant) });
  const answers = () => answersOf(f, initial, applicant);
  // резидент паспорта — ровно то, что уйдёт в профиль
  const me = useMemo(
    () => ({ ...(applicant ? { id: 'me' } : initial), ...profileOf(f), ...metaOf(f, applicant), ...answersOf(f, initial, applicant), tested: true }),
    [f, initial, applicant]
  );

  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const setTravel = (k, v) => morph(() => setF((s) => ({ ...s, [k]: v })));

  const next = () => {
    if (!ok) return;
    if (step < total - 1) {
      morph(() => setStep(step + 1));
      return;
    }
    onCommit?.(profile(), answers());
    morph(() => setPhase('analyze'));
  };
  const back = () => (step > 0 ? morph(() => setStep(step - 1)) : onExit?.());
  const toPass = () => {
    if (phase !== 'analyze') return;
    cardRect.current = cardEl.current?.getBoundingClientRect() || null;
    morph(() => setPhase('pass'));
  };
  // без имени откладывать нечего — кандидат возвращается на вход
  const later = () => (applicant && !OK.who(f) ? onExit?.() : onLater?.(compact(profile()), compact(answers())));

  const progress = phase === 'q' ? (step + 1) / (total + 1) : 1;
  const counter = phase === 'pass' ? me.number : `${pad2(phase === 'q' ? step + 1 : total)} / ${pad2(total)}`;

  return (
    <div className="o-scr">
      <div className="chrome">
        <span>UHOME CLUB · {applicant ? 'Регистрация' : 'Профиль'}</span>
        <b>{counter}</b>
      </div>

      <div className="o-stage" data-phase={phase}>
        {phase === 'pass' ? (
          <Issued app={app} me={me} applicant={applicant} from={cardRect.current} onEnter={() => onEnter?.(profile(), answers())} />
        ) : (
          <div ref={cardEl} className="card card--gold o-card" style={{ viewTransitionName: 'o-card' }} onClick={phase === 'analyze' ? toPass : undefined}>
            <i className="o-card__bar" style={{ transform: `scaleX(${progress})` }} aria-hidden="true" />
            <Strip f={f} upto={phase === 'analyze' ? total : step} />
            {phase === 'analyze' ? (
              <Analysis onDone={toPass} />
            ) : (
              <>
                <h2 className="h2 o-card__t">{cur.title}</h2>
                <p className="o-card__s">{cur.kind === 'who' && !applicant ? 'Проверьте: так вас видят резиденты.' : cur.sub}</p>
                <div className="o-body" key={cur.id}>
                  <StepBody step={cur} f={f} set={set} setTravel={setTravel} applicant={applicant} onEnter={next} />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {phase === 'q' && (
        <>
          <div className="o-bar">
            <button className="backbtn" onClick={back} aria-label="Назад"><Icon name="back" size={20} width={2} /></button>
            <Btn variant="gold" disabled={!ok} onClick={next}>{step === total - 1 ? 'Собрать профиль' : 'Дальше'}</Btn>
          </div>
          <button className="o-later" onClick={later}>Позже</button>
        </>
      )}
    </div>
  );
}
