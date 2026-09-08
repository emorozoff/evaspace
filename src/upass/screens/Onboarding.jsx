import { useEffect, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { Btn, Chip, Card, Seg } from '../components/UI.jsx';
import { Seal, Guilloche } from '../components/Art.jsx';
import Passport from '../components/Passport.jsx';
import Install from '../components/Install.jsx';
import Icon from '../components/Icons.jsx';
import { SKILL_GROUPS, ROLES } from '../data/people.js';
import { CITIES } from '../data/places.js';
import { TIERS, LAWS, MOTTO_MASKED } from '../data/canon.js';
import { usdExact } from '../lib/format.js';

const TALENTS = ['Стратегия', 'Продажи', 'Найм', 'Публичные выступления', 'Переговоры', 'Инженерия', 'Дизайн', 'Тексты', 'Съёмка', 'Спорт', 'Кулинария', 'Языки', 'Инвестиции', 'Право', 'Психология', 'Музыка'];

export default function Onboarding() {
  const app = useApp();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: '', role: 'Основатель', company: '', city: 'dubai',
    skills: [], talents: [], mission: '', gives: '', needs: '',
  });
  const [tier, setTier] = useState(1);
  const [paid, setPaid] = useState(false);
  const [oath, setOath] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggle = (k, v) =>
    setForm((f) => ({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] }));

  /* модерация: в жизни до 24 часов, здесь — несколько секунд */
  useEffect(() => {
    if (app.stage !== 'review') return;
    const t = setTimeout(app.approve, 7000);
    return () => clearTimeout(t);
  }, [app.stage, app.approve]);

  if (app.stage === 'review') return <Review onApprove={app.approve} name={app.me.name} />;

  if (app.stage === 'approved') {
    if (!paid) return <Payment tier={tier} setTier={setTier} city={app.me.city} onPay={() => setPaid(true)} />;
    return (
      <Ceremony
        me={{ ...app.me, tier, degree: 1 }}
        oath={oath}
        setOath={setOath}
        onDone={() => app.payMembership(tier)}
      />
    );
  }

  if (step === 0) return <Hero onStart={() => setStep(1)} onDemo={() => demo(app)} />;

  const steps = [
    {
      title: 'Как вас зовут',
      hint: 'Имя и фамилия попадут на паспорт резидента. Псевдонимы не принимаются.',
      ok: form.name.trim().length > 3,
      body: (
        <input className="field" autoFocus placeholder="Имя и фамилия" value={form.name} onChange={(e) => set('name', e.target.value)} />
      ),
    },
    {
      title: 'Чем вы занимаетесь',
      hint: 'Роль в деле и компания. Это видят резиденты, когда решают, познакомиться ли с вами.',
      ok: form.company.trim().length > 1,
      body: (
        <div className="stack">
          <div className="wrap">
            {ROLES.map((r) => (
              <Chip key={r} on={form.role === r} onClick={() => set('role', r)}>{r}</Chip>
            ))}
          </div>
          <input className="field" placeholder="Компания или практика" value={form.company} onChange={(e) => set('company', e.target.value)} />
        </div>
      ),
    },
    {
      title: 'Где вы сейчас',
      hint: 'Город присутствия можно менять в любой момент — по нему клуб понимает, кто рядом.',
      ok: true,
      body: (
        <div className="wrap">
          {Object.entries(CITIES).slice(0, 12).map(([key, c]) => (
            <Chip key={key} on={form.city === key} onClick={() => set('city', key)}>
              {c.flag} {c.name}
            </Chip>
          ))}
        </div>
      ),
    },
    {
      title: 'Сильные стороны',
      hint: 'Направления и таланты. По ним вас найдут те, кому нужна именно ваша помощь.',
      ok: form.skills.length > 0,
      body: (
        <div className="stack-16">
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Направления</div>
            <div className="wrap">
              {SKILL_GROUPS.map((g) => (
                <Chip key={g.id} on={form.skills.includes(g.id)} onClick={() => toggle('skills', g.id)}>{g.name}</Chip>
              ))}
            </div>
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Таланты</div>
            <div className="wrap">
              {TALENTS.map((t) => (
                <Chip key={t} on={form.talents.includes(t)} onClick={() => toggle('talents', t)}>{t}</Chip>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Одним предложением',
      hint: 'Что вы строите и чем можете быть полезны кругу. Эту строку модератор читает первой.',
      ok: form.mission.trim().length > 10,
      body: (
        <div className="stack">
          <textarea className="field" autoFocus placeholder="Например: строю сеть ретрит-центров в Азии и помогаю основателям восстанавливаться" value={form.mission} onChange={(e) => set('mission', e.target.value)} />
          <input className="field" placeholder="Чем могу быть полезен кругу" value={form.gives} onChange={(e) => set('gives', e.target.value)} />
          <input className="field" placeholder="Что ищу" value={form.needs} onChange={(e) => set('needs', e.target.value)} />
        </div>
      ),
    },
  ];

  const cur = steps[step - 1];

  return (
    <div className="screen screen--plain" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div className="row" style={{ gap: 6, marginBottom: 22 }}>
        {steps.map((_, i) => (
          <div key={i} className="grow" style={{ height: 3, borderRadius: 2, background: i < step ? 'var(--gold)' : 'rgba(255,255,255,.1)', transition: '.3s' }} />
        ))}
      </div>

      <div className="eyebrow">Шаг {step} из {steps.length}</div>
      <h2 className="display" style={{ margin: '8px 0 8px' }}>{cur.title}</h2>
      <div className="t-sm dim" style={{ marginBottom: 20, lineHeight: 1.5 }}>{cur.hint}</div>

      {cur.body}

      <div style={{ marginTop: 'auto', paddingTop: 26, display: 'flex', gap: 10 }}>
        <Btn variant="quiet" onClick={() => setStep((s) => s - 1)}>Назад</Btn>
        <Btn
          variant="gold"
          wide
          disabled={!cur.ok}
          onClick={() => (step === steps.length ? app.apply(form) : setStep((s) => s + 1))}
        >
          {step === steps.length ? 'Отправить заявку' : 'Дальше'}
        </Btn>
      </div>
    </div>
  );
}

/* ---------- титульный экран ---------------------------------------------- */
function Hero({ onStart, onDemo }) {
  return (
    <div className="screen screen--plain" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      <div style={{ position: 'absolute', top: -70, left: '50%', transform: 'translateX(-46%)', opacity: 0.1, pointerEvents: 'none' }}>
        <Guilloche color="#D7B06A" opacity={0.7} size={420} seed="hero" />
      </div>

      <div style={{ marginTop: 54, position: 'relative' }}>
        <Seal size={78} glow />
        <h1 className="display" style={{ fontSize: 46, marginTop: 20, letterSpacing: '-0.02em' }}>
          UPASS
        </h1>
        <div className="eyebrow eyebrow--gold" style={{ marginTop: 8 }}>{MOTTO_MASKED}</div>
        <p className="dim" style={{ marginTop: 18, fontSize: 15, lineHeight: 1.55, maxWidth: 380 }}>
          Закрытый кооператив: люди, места и общая собственность. Один паспорт на весь мир,
          двадцать локаций UHOME, доля в активах вместо арендной наценки.
        </p>
      </div>

      <div className="stack-8" style={{ marginTop: 26, position: 'relative' }}>
        <Pillar icon="passport" title="Цифровой паспорт" text="Одна проверенная личность, репутация в цепочке хешей, доступ во все локации" />
        <Pillar icon="globe" title="Сеть UHOME" text="Отели, резиденции и лаунжи в двадцати городах — по внутреннему тарифу" />
        <Pillar icon="coin" title="Доля, а не аренда" text="Токен UHT — учёт вашей доли в портфеле активов кооператива" />
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 28, display: 'grid', gap: 10, position: 'relative' }}>
        <Install compact />
        <Btn variant="gold" wide onClick={onStart}>Подать заявку</Btn>
        <Btn variant="quiet" wide onClick={onDemo}>Войти демо-резидентом</Btn>
        <div className="center t-xs dim-2" style={{ marginTop: 4 }}>
          Вход только по заявке и решению модератора. Деньги принимаются после одобрения.
        </div>
      </div>
    </div>
  );
}

function Pillar({ icon, title, text }) {
  return (
    <Card className="row-t" style={{ gap: 12 }}>
      <div className="tile__ic" style={{ width: 36, height: 36, borderRadius: 11, flex: 'none' }}>
        <Icon name={icon} size={18} />
      </div>
      <div>
        <div className="t-md">{title}</div>
        <div className="t-xs dim" style={{ marginTop: 3, lineHeight: 1.45 }}>{text}</div>
      </div>
    </Card>
  );
}

/* ---------- модерация ----------------------------------------------------- */
function Review({ onApprove, name }) {
  const checks = [
    'Личность подтверждена и уникальна',
    'Профиль соответствует правилам круга',
    'Нет пересечений со списком исключённых',
    'Заявку читает живой модератор',
  ];
  const [done, setDone] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setDone((d) => Math.min(checks.length, d + 1)), 1500);
    return () => clearInterval(t);
  }, [checks.length]);

  return (
    <div className="screen screen--plain center" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', alignItems: 'center' }}>
      <div style={{ marginTop: 80 }} className="pulse">
        <Seal size={104} glow />
      </div>
      <h2 className="display" style={{ marginTop: 26 }}>Заявка на рассмотрении</h2>
      <p className="dim t-sm" style={{ marginTop: 10, maxWidth: 320, lineHeight: 1.55 }}>
        {name ? `${name.split(' ')[0]}, ваша заявка ушла модератору.` : 'Заявка ушла модератору.'} Обычно ответ приходит в течение суток.
        До одобрения приложение работает в ограниченном режиме, деньги не принимаются.
      </p>

      <div className="stack-8" style={{ marginTop: 28, width: '100%', textAlign: 'left' }}>
        {checks.map((c, i) => (
          <div key={c} className="card row" style={{ opacity: i < done ? 1 : 0.42, transition: '.4s' }}>
            <div style={{ width: 22, height: 22, borderRadius: 999, display: 'grid', placeItems: 'center', background: i < done ? 'var(--gold-soft)' : 'transparent', border: `1px solid ${i < done ? 'var(--gold)' : 'var(--line-2)'}`, flex: 'none' }}>
              {i < done ? <Icon name="check" size={12} color="var(--gold)" /> : <div className="t-xs dim-2">{i + 1}</div>}
            </div>
            <div className="t-sm grow">{c}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 'auto', width: '100%', paddingTop: 24 }}>
        <Btn variant="quiet" wide onClick={onApprove}>Ускорить рассмотрение · демо</Btn>
      </div>
    </div>
  );
}

/* ---------- оплата взноса ------------------------------------------------- */
function Payment({ tier, setTier, city, onPay }) {
  const t = TIERS.find((x) => x.n === tier);
  const ru = city === 'moscow';
  const [busy, setBusy] = useState(false);

  const pay = () => {
    setBusy(true);
    setTimeout(onPay, 1400);
  };

  return (
    <div className="screen screen--plain" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div className="eyebrow eyebrow--gold" style={{ marginTop: 18 }}>Заявка одобрена</div>
      <h2 className="display" style={{ margin: '8px 0 6px' }}>Выберите уровень членства</h2>
      <div className="t-sm dim" style={{ marginBottom: 18, lineHeight: 1.5 }}>
        Уровень покупается и открывает доступ. Степень — то, что зарабатывается внутри, — начинается с первой у всех.
      </div>

      <div className="stack-8">
        {TIERS.filter((x) => x.price).map((x) => (
          <button key={x.n} className={`card tap${tier === x.n ? ' card--gold' : ''}`} onClick={() => setTier(x.n)}>
            <div className="spread">
              <div className="row" style={{ gap: 10 }}>
                <div style={{ width: 4, height: 34, borderRadius: 3, background: `linear-gradient(180deg, ${x.edge[0]}, ${x.edge[1]})` }} />
                <div>
                  <div className="t-md">{x.name}</div>
                  <div className="t-xs dim">{x.line}</div>
                </div>
              </div>
              <div className="t-md num">{usdExact(x.price)}<span className="dim-2 t-xs"> / год</span></div>
            </div>
            {tier === x.n && (
              <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
                {x.perks.map((p) => (
                  <div key={p} className="row t-xs" style={{ gap: 7 }}>
                    <Icon name="check" size={13} color="var(--gold)" />
                    <span className="dim">{p}</span>
                  </div>
                ))}
              </div>
            )}
          </button>
        ))}
      </div>

      <Card style={{ marginTop: 14 }} className="row" >
        <Icon name="wallet" size={18} color="var(--ink-3)" />
        <div className="grow t-xs dim">
          Провайдер платежа выбран по вашему региону: {ru ? 'карты российских банков, рубли по курсу на момент оплаты' : 'международный платёж, доллары'}.
        </div>
      </Card>

      <div style={{ marginTop: 'auto', paddingTop: 22 }}>
        <Btn variant="gold" wide onClick={pay} disabled={busy}>
          {busy ? 'Проводим платёж…' : `Оплатить ${usdExact(t.price)} и получить паспорт`}
        </Btn>
        <div className="center t-xs dim-2" style={{ marginTop: 10 }}>Демонстрация: настоящий платёж не проводится</div>
      </div>
    </div>
  );
}

/* ---------- посвящение ---------------------------------------------------- */
function Ceremony({ me, oath, setOath, onDone }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 250);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="screen screen--plain" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div className="center" style={{ marginTop: 24 }}>
        <div className="eyebrow eyebrow--gold">Посвящение</div>
        <h2 className="display" style={{ marginTop: 8 }}>Паспорт выдан</h2>
      </div>

      <div style={{ marginTop: 22, opacity: show ? 1 : 0, transform: show ? 'none' : 'translateY(16px) scale(.96)', transition: '.7s cubic-bezier(.22,1,.36,1)' }}>
        <Passport me={me} chain={[]} flippable={false} />
      </div>

      <Card style={{ marginTop: 18 }}>
        <div className="eyebrow">Принятие законов</div>
        <div className="stack-8" style={{ marginTop: 10 }}>
          {LAWS.slice(0, 3).map((l) => (
            <div key={l.n} className="row-t t-xs dim" style={{ gap: 8 }}>
              <span className="gold mono" style={{ flex: 'none', width: 18 }}>{l.n}</span>
              <span style={{ lineHeight: 1.45 }}>{l.text}</span>
            </div>
          ))}
          <div className="t-xs dim-2">Полный свод из семи законов — в разделе «Кодекс».</div>
        </div>
        <button className="row" style={{ marginTop: 14, width: '100%', textAlign: 'left', gap: 10 }} onClick={() => setOath(!oath)}>
          <div style={{ width: 22, height: 22, borderRadius: 7, flex: 'none', display: 'grid', placeItems: 'center', border: `1px solid ${oath ? 'var(--gold)' : 'var(--line-2)'}`, background: oath ? 'var(--gold-soft)' : 'transparent' }}>
            {oath && <Icon name="check" size={13} color="var(--gold)" />}
          </div>
          <div className="t-sm grow">Принимаю законы клуба и правила выхода</div>
        </button>
      </Card>

      <div style={{ marginTop: 'auto', paddingTop: 20 }}>
        <Btn variant="gold" wide disabled={!oath} onClick={onDone}>Войти в круг</Btn>
      </div>
    </div>
  );
}

/* демо-резидент, чтобы посмотреть приложение целиком */
function demo(app) {
  app.apply({
    name: 'Евгений Морозов',
    role: 'Основатель',
    company: 'Upass',
    city: 'dubai',
    skills: ['it', 'ai', 'capital'],
    talents: ['Стратегия', 'Публичные выступления', 'Инвестиции'],
    mission: 'Строю кооператив, в котором успех каждого — доля каждого.',
    gives: 'Помогу собрать сообщество и запустить продукт',
    needs: 'Партнёры по активам в Азии и Заливе',
  });
  setTimeout(() => {
    app.approve();
    setTimeout(() => {
      app.payMembership(4);
      app.addRep('meet', 'me', { with: 'r22', weight: 3, note: 'Подтверждённая встреча: Мария Тонева' });
      app.addRep('meet', 'me', { with: 'r2', weight: 3, note: 'Подтверждённая встреча: Алексей Ремизов' });
      app.addRep('meet', 'me', { with: 'r9', weight: 3, note: 'Подтверждённая встреча: Наталья Верх' });
      app.addRep('vouch', 'me', { with: 'r13', weight: 5, note: 'Поручительство за Егор Тамм' });
      app.addRep('event', 'me', { weight: 2, note: 'Участие: Квартальный слёт, Дубай' });
      app.invest(24000, 24000 / app.pf.price);
    }, 120);
  }, 120);
}
