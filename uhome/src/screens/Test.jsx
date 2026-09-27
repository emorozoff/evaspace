import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { TEST } from '../data/test.js';
import { AVATARS } from '../data/avatars.js';
import { groupsOf } from '../lib/groups.js';
import { reasons } from '../lib/intro.js';
import { firstNameOf } from '../data/people.js';
import { plural } from '../lib/format.js';
import { Btn } from '../components/UI.jsx';
import { Avatar, GroupAva } from '../components/Art.jsx';
import { AvatarPortrait } from '../components/AvatarArt.jsx';
import Icon from '../components/Icons.jsx';

/* Тест на входе: восемь вопросов нажатием, около минуты. По ответам
   ассистент собирает мастер-группу, считает пользу знакомств и с первого
   дня знает, кого и куда вам предлагать. Ответы подставлены из профиля —
   резидент может пролистать и поправить только то, что изменилось. */

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

export default function Test() {
  const app = useApp();
  const [step, setStep] = useState(-1);
  const [a, setA] = useState(() => FROM_ME(app.me));
  const A = AVATARS[a.assistant] || AVATARS.eva;
  const total = TEST.length;

  const finish = () => {
    const { regions, ...rest } = a;
    app.finishTest({ ...rest, regionsOften: regions });
    setStep(total);
  };

  if (step < 0) return <Intro A={A} onStart={() => setStep(0)} onSkip={() => go('/', true)} />;
  if (step >= total) return <Result app={app} A={A} />;

  const q = TEST[step];
  const val = a[q.id];
  const ok = q.kind === 'many' ? val.length > 0 : !!val;
  const set = (v) => setA((s) => ({ ...s, [q.id]: v }));
  const toggle = (id) => {
    if (val.includes(id)) set(val.filter((x) => x !== id));
    else if (val.length < q.max) set([...val, id]);
    else set([...val.slice(1), id]);
  };
  const next = () => (step === total - 1 ? finish() : setStep(step + 1));

  return (
    <div className="test">
      <div className="row">
        <button className="backbtn" onClick={() => setStep(step - 1)} aria-label="Назад"><Icon name="back" size={20} width={2} /></button>
        <div className="test__bar grow">{TEST.map((x, i) => <i key={x.id} data-on={i <= step} />)}</div>
        <span className="t-xs dim-2" style={{ minWidth: 34, textAlign: 'right' }}>{step + 1}/{total}</span>
      </div>

      <div className="stack" style={{ gap: 10 }}>
        <div className="row" style={{ gap: 8 }}>
          <AvatarPortrait who={A.id} size={26} />
          <span className="t-xs gold" style={{ letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>{A.name} спрашивает</span>
        </div>
        <h1 className="test__q">{q.title}</h1>
        <p className="lead" style={{ fontSize: 15 }}>{q.sub}</p>
      </div>

      <div className="stack-8 grow" style={{ alignContent: 'start' }}>
        {q.kind === 'avatar' &&
          ['eva', 'adam'].map((id) => {
            const x = AVATARS[id];
            const on = val === id;
            return (
              <button key={id} className={`opt opt--ava${on ? ' opt--on' : ''}`} onClick={() => set(id)}>
                <AvatarPortrait who={id} size={72} />
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="opt__name">{x.name}</span>
                  <span className="opt__sub">{x.about}</span>
                </span>
                <span className="opt__check">{on && <Icon name="check" size={14} width={2.4} />}</span>
              </button>
            );
          })}
        {q.kind === 'one' &&
          q.options.map((o) => {
            const on = val === o.id;
            return (
              <button key={o.id} className={`opt${on ? ' opt--on' : ''}`} onClick={() => set(o.id)}>
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="opt__name">{o.name}</span>
                  {o.sub && <span className="opt__sub">{o.sub}</span>}
                </span>
                <span className="opt__check">{on && <Icon name="check" size={14} width={2.4} />}</span>
              </button>
            );
          })}
        {q.kind === 'many' && (
          <>
            <div className="wrap" style={{ gap: 8 }}>
              {q.options.map((o) => (
                <button key={o.id} className={`chip chip--lg${val.includes(o.id) ? ' chip--on' : ''}`} onClick={() => toggle(o.id)}>
                  {val.includes(o.id) && <Icon name="check" size={14} width={2.4} />}
                  {o.name}
                </button>
              ))}
            </div>
            <div className="t-xs dim-2">Выбрано {val.length} из {q.max}</div>
          </>
        )}
      </div>

      <Btn variant="gold" wide disabled={!ok} onClick={next}>
        {step === total - 1 ? `${A.name}, собирай` : 'Дальше'}
      </Btn>
    </div>
  );
}

function Intro({ A, onStart, onSkip }) {
  return (
    <div className="test" style={{ justifyContent: 'space-between' }}>
      <div />
      <div className="aihead" style={{ gap: 18 }}>
        <AvatarPortrait who={A.id} size={132} />
        <div className="t-xs gold" style={{ letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 600 }}>Цифровой ассистент клуба</div>
        <h1 className="test__q" style={{ fontSize: 34 }}>Давайте познакомимся</h1>
        <p className="lead" style={{ maxWidth: 330 }}>
          Восемь коротких вопросов — около минуты. По ним я соберу вашу мастер-группу из десяти человек, посчитаю пользу знакомств и буду каждый день находить вам повод для встречи.
        </p>
      </div>
      <div className="stack">
        <Btn variant="gold" wide onClick={onStart}>Начать</Btn>
        <Btn variant="quiet" wide onClick={onSkip}>Позже</Btn>
      </div>
    </div>
  );
}

function Result({ app, A }) {
  const g = useMemo(() => groupsOf(app.me)[0], [app.me]);
  const rs = useMemo(() => reasons(app, 3), [app]);
  return (
    <div className="test">
      <div className="aihead" style={{ paddingTop: 12 }}>
        <AvatarPortrait who={A.id} size={84} />
        <h1 className="test__q" style={{ fontSize: 30 }}>Готово{app.me.name ? `, ${firstNameOf(app.me)}` : ''}</h1>
        <p className="lead" style={{ fontSize: 15 }}>
          Я {A.she ? 'запомнила' : 'запомнил'} ваши ответы и уже {A.found} людей. Дальше учусь на ваших выборах.
        </p>
      </div>

      <button className="card card--gold" onClick={() => go('/group/g-mm', true)} style={{ textAlign: 'left' }}>
        <div className="row" style={{ gap: 14 }}>
          <GroupAva members={g.members} size={56} />
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="aicard__k">Ваша мастер-группа</div>
            <div style={{ fontWeight: 600, fontSize: 16, marginTop: 4 }}>{g.theme.name}</div>
            <div className="t-xs dim-2" style={{ marginTop: 3 }}>10 участников · {g.when}</div>
          </div>
          <Icon name="right" size={18} color="var(--ink-3)" />
        </div>
      </button>

      <div className="stack-8">
        <div className="label" style={{ margin: 0 }}>Первые знакомства — {rs.length} {plural(rs.length, 'человек', 'человека', 'человек')}</div>
        {rs.map((r) => (
          <button key={r.id} className="aicard2" onClick={() => go(`/p/${r.p.id}`)}>
            <Avatar person={r.p} size={46} />
            <span className="grow" style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 600 }}>{r.p.name}</span>
              <span className="t-xs dim-2" style={{ display: 'block', marginTop: 2 }}>{r.label} · {r.why}</span>
            </span>
            <span className="use"><span className="use__v">{r.pct}%</span><span className="use__l">польза</span></span>
          </button>
        ))}
      </div>

      <div className="grow" />
      <Btn variant="gold" wide onClick={() => go('/', true)}>В клуб</Btn>
    </div>
  );
}
