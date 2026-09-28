import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { TEST } from '../data/test.js';
import { AVATARS } from '../data/avatars.js';
import { PEOPLE } from '../data/people.js';
import { groupsOf } from '../lib/groups.js';
import { reasons } from '../lib/intro.js';
import { match } from '../lib/match.js';
import { prefersReduced } from '../lib/motion.js';
import { Btn } from '../components/UI.jsx';
import { AvatarPortrait } from '../components/AvatarArt.jsx';
import Icon from '../components/Icons.jsx';
import Flag from '../components/Flag.jsx';
import Chrome, { Titled, pad2 } from '../components/onboarding/Chrome.jsx';
import AvatarPick from '../components/onboarding/AvatarPick.jsx';
import Constellation from '../components/onboarding/Constellation.jsx';
import Analysis from '../components/onboarding/Analysis.jsx';
import Issued from '../components/onboarding/Issued.jsx';

/* Тест на входе — не анкета, а сборка. Восемь вопросов нажатием:
   первый — выбор ассистента, дальше каждый ответ становится узлом живой
   фигуры резидента наверху экрана (components/onboarding/Constellation).
   После последнего ответа фигура сверяется с клубом — вокруг появляются
   люди и польза знакомств, — схлопывается и выпускает паспорт резидента.
   Ответы подставлены из профиля: резидент пролистывает и правит только
   то, что изменилось. Тест можно пройти заново из профиля (/test). */

const FROM_ME = (me) => ({
  assistant: me.assistant || 'eva',
  tone: me.tone || 'warm',
  sphere: me.sphere || '',
  needs: me.needs || [],
  gives: me.gives || [],
  interests: me.interests || [],
  regions: me.regionsOften || [me.region],
  formats: me.formats || [],
});

const toAnswers = ({ regions, ...rest }) => ({ ...rest, regionsOften: regions });

// префикс узла фигуры для каждого вопроса
const NODE = { tone: 't', sphere: 's', needs: 'n', gives: 'g', interests: 'i', regions: 'r', formats: 'f' };

/** Кого фигура «нащупает» в клубе: первые знакомства и мастер-группа. */
function crowdFor(app, me) {
  const first = reasons({ ...app, me }, 3).map((r) => ({ p: r.p, pct: r.pct }));
  const g = groupsOf(me)[0];
  const rest = g.members
    .filter((p) => !first.some((x) => x.p.id === p.id))
    .map((p) => ({ p, pct: match(me, p).pct }))
    .sort((x, y) => y.pct - x.pct)
    .slice(0, 6 - first.length);
  return { list: [...first, ...rest].map((x) => ({ ...x, m: match(me, x.p) })), group: g };
}

export default function Test() {
  const app = useApp();
  const [step, setStep] = useState(0);
  const [a, setA] = useState(() => FROM_ME(app.me));
  const [phase, setPhase] = useState('q'); // q → analyze → collapse → pass
  const [spark, setSpark] = useState(null);
  const total = TEST.length;
  const A = AVATARS[a.assistant] || AVATARS.eva;
  const q = TEST[step];
  const analyzing = phase === 'analyze' || phase === 'collapse';

  const crowd = useMemo(
    () => (phase === 'q' ? null : crowdFor(app, { ...app.me, ...toAnswers(a), tested: true })),
    // состав считается один раз — в момент, когда ответы отданы
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase === 'q']
  );

  useEffect(() => {
    if (phase !== 'collapse') return undefined;
    const t = setTimeout(() => setPhase('pass'), prefersReduced() ? 0 : 720);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === 'pass') return <Issued app={app} A={A} />;

  const val = a[q.id];
  const ok = q.kind === 'many' ? val.length > 0 : !!val;
  const set = (v) => setA((s) => ({ ...s, [q.id]: v }));
  // точка вылетает из «узла» на самой кнопке — кружка или флага
  const fly = (e, id) => {
    const el = e.currentTarget.querySelector('.oo__node, .och__dot, svg') || e.currentTarget;
    const r = el.getBoundingClientRect();
    setSpark({ node: `${NODE[q.id]}:${id}`, x: r.left + r.width / 2, y: r.top + r.height / 2, k: Date.now() });
  };
  const pickOne = (o, e) => {
    if (val === o.id) return;
    set(o.id);
    fly(e, o.id);
  };
  const toggle = (o, e) => {
    if (val.includes(o.id)) return set(val.filter((x) => x !== o.id));
    set(val.length < q.max ? [...val, o.id] : [...val.slice(1), o.id]);
    fly(e, o.id);
  };
  const next = () => {
    if (step < total - 1) return setStep(step + 1);
    app.finishTest(toAnswers(a));
    setPhase('analyze');
  };

  const lines = crowd && [
    { t: 'Сверяю профили резидентов', v: `${PEOPLE.length} / ${PEOPLE.length}` },
    { t: 'Собираю мастер-группу', v: crowd.group.theme.name },
    { t: 'Считаю пользу знакомств', v: `${crowd.list.length} · до ${Math.max(...crowd.list.map((x) => x.pct))}%` },
    { t: 'Выпускаю паспорт', v: app.me.number },
  ];

  return (
    <div
      className={`onb onb--${analyzing ? 'an' : step === 0 ? 'ava' : 'q'}`}
      onClick={phase === 'analyze' ? () => setPhase('collapse') : undefined}
    >
      <Chrome
        left={analyzing ? 'UHOME · Сверка с клубом' : 'UHOME · Профиль резидента'}
        right={analyzing ? `${pad2(total)} / ${pad2(total)}` : `${pad2(step + 1)} / ${pad2(total)}`}
        progress={analyzing ? 1 : (step + 1) / total}
        onSkip={analyzing ? undefined : () => go('/', true)}
      />

      {step === 0 ? (
        <div className="oq oq--ava">
          <div className="oq__head">
            <div className="o-eyebrow"><span>Сборка профиля · 8 шагов</span><span className="o-eyebrow__r">≈ 1 минута</span></div>
            <Titled text={q.title} em={q.em} />
            <p className="o-sub">Из ваших ответов ассистент соберёт профиль, мастер-группу и паспорт резидента.</p>
          </div>
          <AvatarPick value={a.assistant} onPick={(id) => set(id)} />
        </div>
      ) : (
        <>
          <Constellation
            a={a}
            stage={analyzing ? 8 : step}
            me={app.me}
            spark={spark}
            people={crowd?.list}
            collapse={phase === 'collapse'}
          />
          {analyzing ? (
            <Analysis A={A} lines={lines} onDone={() => setPhase((p) => (p === 'analyze' ? 'collapse' : p))} />
          ) : (
            <Question key={q.id} q={q} A={A} val={val} onOne={pickOne} onToggle={toggle} />
          )}
        </>
      )}

      {!analyzing && (
        <div className="o-bar">
          {step > 0 && (
            <button className="o-back" onClick={() => setStep(step - 1)} aria-label="Назад">
              <Icon name="back" size={20} width={2} />
            </button>
          )}
          <Btn variant="gold" wide disabled={!ok} onClick={next}>
            {step === 0 ? `Выбрать ${A.acc}` : step === total - 1 ? `${A.name}, собирай` : 'Дальше'}
            <Icon name="right" size={16} />
          </Btn>
        </div>
      )}
    </div>
  );
}

function Question({ q, A, val, onOne, onToggle }) {
  const many = q.kind === 'many';
  const withSub = !many && q.options.some((o) => o.sub);
  return (
    <div className="oq">
      <div className="oq__head">
        <div className="o-eyebrow">
          <AvatarPortrait who={A.id} size={18} />
          <span>{A.name} спрашивает</span>
          <span className="o-eyebrow__r">
            {many ? <><b>{pad2(val.length)}</b> / {pad2(q.max)} · </> : null}
            {q.place}
          </span>
        </div>
        <Titled text={q.title} em={q.em} />
        <p className="o-sub">{q.sub}</p>
      </div>

      <div className="oq__opts">
        {!many && (
          <div className={withSub ? 'oo-list' : 'oo-grid'}>
            {q.options.map((o, i) => {
              const on = val === o.id;
              return (
                <button key={o.id} className={`oo${on ? ' is-on' : ''}`} style={{ '--i': i }} onClick={(e) => onOne(o, e)} aria-pressed={on}>
                  <span className="oo__k">{pad2(i + 1)}</span>
                  <span className="oo__t">
                    <span className="oo__n">{o.name}</span>
                    {o.sub && <span className="oo__s">{o.sub}</span>}
                  </span>
                  <span className="oo__node" />
                </button>
              );
            })}
          </div>
        )}
        {many && (
          <div className="och-wrap">
            {q.options.map((o, i) => {
              const on = val.includes(o.id);
              return (
                <button key={o.id} className={`och${on ? ' is-on' : ''}`} style={{ '--i': i }} onClick={(e) => onToggle(o, e)} aria-pressed={on}>
                  {o.cc ? <Flag cc={o.cc} size={16} /> : <span className="och__dot" />}
                  {o.name}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
