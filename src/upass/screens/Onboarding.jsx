import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { Btn, Chip, Card, Sheet, Note } from '../components/UI.jsx';
import { Seal, Guilloche, Avatar } from '../components/Art.jsx';
import Passport from '../components/Passport.jsx';
import Install from '../components/Install.jsx';
import Icon from '../components/Icons.jsx';
import { SKILL_GROUPS, ROLES, RESIDENTS } from '../data/people.js';
import { OFFERS } from '../data/exchange.js';
import { REGIONS, REGION_KEYS } from '../data/regions.js';
import { TIERS, LAWS, TRADITIONS, MOTTO_MASKED } from '../data/canon.js';
import { bestMatches, matchReasons } from '../lib/match.js';
import { usdExact, plural } from '../lib/format.js';

export default function Onboarding() {
  const app = useApp();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    first: '', last: '', role: 'Основатель', company: '', city: 'dubai',
    skills: [], wants: [], offers: [], mission: '',
  });
  const [paid, setPaid] = useState(false);
  const [oath, setOath] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggle = (k, v) =>
    setForm((f) => ({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] }));

  /* модерация: в жизни до суток, здесь — несколько секунд */
  useEffect(() => {
    if (app.stage !== 'review') return;
    const t = setTimeout(app.approve, 7000);
    return () => clearTimeout(t);
  }, [app.stage, app.approve]);

  if (app.stage === 'review') return <Review onApprove={app.approve} name={app.me.name} />;

  if (app.stage === 'approved') {
    if (!paid) return <Payment me={app.me} onPay={() => setPaid(true)} />;
    return <Ceremony me={{ ...app.me, tier: 1, degree: 1 }} oath={oath} setOath={setOath} onDone={() => app.payMembership()} />;
  }

  if (step === 0) return <Hero onStart={() => setStep(1)} onDemo={() => demo(app)} />;

  const steps = [
    {
      title: 'Как вас зовут',
      hint: 'Имя и фамилия попадут на паспорт резидента. Псевдонимы не принимаются.',
      ok: form.first.trim().length > 1 && form.last.trim().length > 1,
      body: (
        <div className="stack">
          <div>
            <div className="label">Имя</div>
            <input className="field" autoFocus placeholder="Сергей" value={form.first} onChange={(e) => set('first', e.target.value)} />
          </div>
          <div>
            <div className="label">Фамилия</div>
            <input className="field" placeholder="Морозов" value={form.last} onChange={(e) => set('last', e.target.value)} />
          </div>
        </div>
      ),
    },
    {
      title: 'Чем вы занимаетесь',
      hint: 'Роль в деле, компания и направления. Это видят резиденты, когда решают, познакомиться ли с вами.',
      ok: form.company.trim().length > 1 && form.skills.length > 0,
      body: (
        <div className="stack">
          <div className="wrap">
            {ROLES.map((r) => <Chip key={r} on={form.role === r} onClick={() => set('role', r)}>{r}</Chip>)}
          </div>
          <input className="field" placeholder="Компания или практика" value={form.company} onChange={(e) => set('company', e.target.value)} />
          <div>
            <div className="label">Направления</div>
            <div className="wrap">
              {SKILL_GROUPS.map((g) => (
                <Chip key={g.id} on={form.skills.includes(g.id)} onClick={() => toggle('skills', g.id)}>{g.emoji} {g.name}</Chip>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Обмен',
      hint: 'Два вопроса из одного словаря. Совпадение считается встречно: вы ищете инвестиции — вам покажут тех, кто инвестирует.',
      ok: form.wants.length > 0 && form.offers.length > 0,
      body: <Exchange form={form} toggle={toggle} />,
    },
    {
      title: 'Где вы сейчас',
      hint: 'Регион можно менять в любой момент — по нему сообщество понимает, кто рядом, и подбирает афишу.',
      ok: true,
      body: (
        <div className="wrap">
          {REGION_KEYS.map((key) => (
            <Chip key={key} on={form.city === key} onClick={() => set('city', key)}>
              {REGIONS[key].flag} {REGIONS[key].name}
            </Chip>
          ))}
        </div>
      ),
    },
    {
      title: 'Одним предложением',
      hint: 'Что вы строите. Эту строку модератор читает первой.',
      ok: form.mission.trim().length > 10,
      body: (
        <textarea
          className="field"
          autoFocus
          placeholder="Например: строю сеть ретрит-центров в Азии и помогаю основателям восстанавливаться"
          value={form.mission}
          onChange={(e) => set('mission', e.target.value)}
        />
      ),
    },
  ];

  const cur = steps[step - 1];

  const submit = () =>
    app.apply({
      ...form,
      name: `${form.first.trim()} ${form.last.trim()}`,
      title: form.role,
      gives: form.offers.map((id) => OFFERS.find((o) => o.id === id)?.give).filter(Boolean).join('. '),
      needs: form.wants.map((id) => OFFERS.find((o) => o.id === id)?.need).filter(Boolean).join(', '),
    });

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
        <Btn variant="gold" wide disabled={!cur.ok} onClick={() => (step === steps.length ? submit() : setStep((s) => s + 1))}>
          {step === steps.length ? 'Отправить заявку' : 'Дальше'}
        </Btn>
      </div>
    </div>
  );
}

/* ---------- два вопроса одним экраном ------------------------------------ */
function Exchange({ form, toggle }) {
  const me = { id: 'me', city: form.city, skills: form.skills, wants: form.wants, offers: form.offers };
  const found = useMemo(
    () => (form.wants.length || form.offers.length ? bestMatches(me, RESIDENTS, 3) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form.wants, form.offers, form.city, form.skills]
  );

  return (
    <div className="stack">
      <div>
        <div className="label">Что ищу</div>
        <div className="wrap">
          {OFFERS.map((o) => (
            <Chip key={o.id} on={form.wants.includes(o.id)} onClick={() => toggle('wants', o.id)}>{o.emoji} {o.short}</Chip>
          ))}
        </div>
      </div>

      <div>
        <div className="label">Чем могу быть полезен</div>
        <div className="wrap">
          {OFFERS.map((o) => (
            <Chip key={o.id} on={form.offers.includes(o.id)} onClick={() => toggle('offers', o.id)}>{o.emoji} {o.short}</Chip>
          ))}
        </div>
      </div>

      {found.length > 0 && (
        <div className="stack-8">
          <div className="eyebrow eyebrow--gold">Уже нашлись</div>
          {found.map(({ p, pct }) => (
            <div key={p.id} className="card row" style={{ gap: 11 }}>
              <Avatar person={p} size={40} />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="t-md ell">{p.name}</div>
                <div className="t-xs dim-2 ell">{matchReasons(me, p)[0] || `${p.title} · ${p.company}`}</div>
              </div>
              <span className="tag tag--gold">{pct}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- титульный экран ---------------------------------------------- */
function Hero({ onStart, onDemo }) {
  return (
    <div className="screen screen--plain" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -70, left: '50%', transform: 'translateX(-46%)', opacity: 0.1, pointerEvents: 'none' }}>
        <Guilloche color="#D7B06A" opacity={0.7} size={420} seed="hero" />
      </div>

      <div style={{ marginTop: 54, position: 'relative' }}>
        <Seal size={78} glow />
        <h1 className="display" style={{ fontSize: 46, marginTop: 20, letterSpacing: '-0.02em' }}>UPASS</h1>
        <div className="eyebrow eyebrow--gold" style={{ marginTop: 8 }}>{MOTTO_MASKED}</div>
        <p className="dim" style={{ marginTop: 18, fontSize: 15, lineHeight: 1.55, maxWidth: 380 }}>
          Сообщество тех, кто живёт между странами. Двадцать регионов, свои люди в каждом,
          общая афиша и помощь с переездом — от тех, кто уже там.
        </p>
      </div>

      <div className="stack-8" style={{ marginTop: 26, position: 'relative' }}>
        <Pillar icon="compass" title="Двадцать регионов" text="Куда лететь, сколько стоит билет и месяц жизни — считается на карте" />
        <Pillar icon="users" title="Свои в каждом городе" text="Совпадение считается встречно: вы ищете — у кого-то это есть" />
        <Pillar icon="calendar" title="События" text="Встречи, эфиры и три больших слёта года" />
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
      <div style={{ marginTop: 80 }} className="pulsing">
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

/* ---------- одобрено: сначала карта, потом цена --------------------------- */
function Payment({ me, onPay }) {
  const t = TIERS[0];
  const ru = me.city === 'moscow';
  const [busy, setBusy] = useState(false);
  const matched = useMemo(() => bestMatches(me, RESIDENTS, 30).filter((x) => x.pct >= 60).length, [me]);

  return (
    <div className="screen screen--plain" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div className="center" style={{ marginTop: 10, marginBottom: 16 }}>
        <div className="eyebrow eyebrow--gold">Заявка одобрена</div>
        <h2 className="display" style={{ marginTop: 6, fontSize: 30 }}>Ваш паспорт готов</h2>
      </div>

      <Passport me={{ ...me, tier: 1, degree: 1 }} chain={[]} flippable={false} />

      <Note icon="users" tone="var(--gold)">
        {matched > 0
          ? `По вашим меткам обмена нашлось ${matched} ${plural(matched, 'резидент', 'резидента', 'резидентов')} с совпадением выше 60 %.`
          : 'Метки обмена можно менять в профиле — по ним подбираются знакомства.'}
      </Note>

      <div className="card card--gold" style={{ marginTop: 14 }}>
        <div className="spread">
          <div>
            <div className="h2">{t.name}</div>
            <div className="t-xs dim-2" style={{ marginTop: 2 }}>{t.line}</div>
          </div>
          <div className="figure" style={{ fontSize: 22 }}>{usdExact(t.price)}<span className="t-xs dim" style={{ fontWeight: 600 }}> / год</span></div>
        </div>
        <div className="stack-8" style={{ marginTop: 14 }}>
          {t.perks.map((p) => (
            <div key={p} className="row t-sm" style={{ gap: 9 }}>
              <Icon name="check" size={15} color="var(--gold)" />
              <span className="dim">{p}</span>
            </div>
          ))}
        </div>
      </div>

      <Card style={{ marginTop: 12 }} className="row">
        <Icon name="wallet" size={18} color="var(--ink-3)" />
        <div className="grow t-xs dim">
          Платёж проходит по вашему региону: {ru ? 'карты российских банков, рубли по курсу на момент оплаты' : 'международный платёж в долларах'}.
        </div>
      </Card>

      <div style={{ marginTop: 'auto', paddingTop: 20 }}>
        <Btn variant="gold" wide disabled={busy} onClick={() => { setBusy(true); setTimeout(onPay, 1400); }}>
          {busy ? 'Проводим платёж…' : `Оплатить ${usdExact(t.price)} и активировать`}
        </Btn>
        <div className="center t-xs dim-2" style={{ marginTop: 10 }}>Демонстрация: настоящий платёж не проводится</div>
      </div>
    </div>
  );
}

/* ---------- посвящение ---------------------------------------------------- */
function Ceremony({ me, oath, setOath, onDone }) {
  const [show, setShow] = useState(false);
  const [codex, setCodex] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 250);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="screen screen--plain" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div className="center" style={{ marginTop: 18 }}>
        <div className="eyebrow eyebrow--gold">Посвящение</div>
        <h2 className="display" style={{ marginTop: 8, fontSize: 30 }}>Паспорт выдан</h2>
      </div>

      <div style={{ marginTop: 20, opacity: show ? 1 : 0, transform: show ? 'none' : 'translateY(16px) scale(.96)', transition: '.7s cubic-bezier(.22,1,.36,1)' }}>
        <Passport me={me} chain={[]} />
      </div>

      <Card style={{ marginTop: 16 }}>
        <div className="spread">
          <div className="eyebrow">Принятие законов</div>
          <button className="sect__more" onClick={() => setCodex(true)}>Весь кодекс</button>
        </div>
        <div className="stack-8" style={{ marginTop: 10 }}>
          {LAWS.slice(0, 3).map((l) => (
            <div key={l.n} className="row-t t-xs dim" style={{ gap: 8 }}>
              <span className="gold mono" style={{ flex: 'none', width: 18 }}>{l.n}</span>
              <span style={{ lineHeight: 1.45 }}>{l.text}</span>
            </div>
          ))}
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

      <Sheet open={codex} onClose={() => setCodex(false)} title="Кодекс кратко" sub="Семь законов и пять традиций — то, что вы принимаете">
        <div className="stack">
          <div className="stack-8">
            {LAWS.map((l) => (
              <div key={l.n} className="row-t t-sm" style={{ gap: 10 }}>
                <span className="gold mono" style={{ flex: 'none', width: 20 }}>{l.n}</span>
                <span className="dim" style={{ lineHeight: 1.45 }}>{l.text}</span>
              </div>
            ))}
          </div>
          <div className="eyebrow" style={{ marginTop: 4 }}>Традиции</div>
          <div className="stack-8">
            {TRADITIONS.map((t) => (
              <div key={t.key} className="row-t t-sm" style={{ gap: 10 }}>
                <span className="gold mono" style={{ flex: 'none', width: 20 }}>{t.key}</span>
                <span className="dim" style={{ lineHeight: 1.45 }}><b style={{ color: 'var(--ink)' }}>{t.name}.</b> {t.text}</span>
              </div>
            ))}
          </div>
          <Btn variant="quiet" wide onClick={() => setCodex(false)}>Понятно</Btn>
        </div>
      </Sheet>
    </div>
  );
}

/* демо-резидент, чтобы посмотреть приложение целиком */
function demo(app) {
  app.apply({
    name: 'Евгений Морозов',
    first: 'Евгений', last: 'Морозов',
    role: 'Основатель', title: 'Основатель', company: 'Upass', city: 'dubai',
    skills: ['it', 'ai', 'capital'],
    talents: ['Стратегия', 'Публичные выступления', 'Инвестиции'],
    wants: ['invest', 'partner', 'clients'],
    offers: ['product', 'ai', 'circle'],
    mission: 'Строю сообщество, в котором успех каждого — общий успех.',
    bio: 'Живу между Дубаем, Москвой и Бали. Собираю сообщество тех, кто выбрал жизнь между странами.',
    gives: 'Сделаю продукт, разберу техчасть. Внедряю ИИ в работу. Познакомлю и соберу стол',
    needs: 'Инвестиции в проект, Партнёр в дело, Клиенты и новый рынок',
  });
  setTimeout(() => {
    app.approve();
    setTimeout(() => {
      app.payMembership();
      app.addRep('meet', { with: 'r22', weight: 3, note: 'Подтверждённая встреча: Мария Тонева' });
      app.addRep('meet', { with: 'r9', weight: 3, note: 'Подтверждённая встреча: Наталья Верх' });
      app.addRep('meet', { with: 'r13', weight: 3, note: 'Подтверждённая встреча: Егор Тамм' });
      app.addRep('vouch', { with: 'r13', weight: 5, note: 'Поручительство за Егор Тамм' });
      app.addRep('event', { weight: 2, note: 'Участие: U-connect · Стамбул' });
      app.joinCommunity('c-move', 'Релокация и визы');
      app.joinCommunity('c-ai', 'Искусственный интеллект');
    }, 120);
  }, 120);
}
