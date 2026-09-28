import { useEffect, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { memberNumber } from '../lib/art.js';
import { REGIONS, REGION_KEYS } from '../data/regions.js';
import { ROLES } from '../data/people.js';
import { Btn, Sheet, Field } from '../components/UI.jsx';
import Flag from '../components/Flag.jsx';
import Chrome from '../components/onboarding/Chrome.jsx';

/* Вход — короткая заставка, как титул презентации клуба: знак UHOME
   рисуется одной линией, вокруг проворачиваются кольца прибора,
   тонкие линии расходятся к краям, название проявляется по буквам.
   Под ним — пять регионов клуба с флагами и местным временем.
   Дальше два пути: резидент входит сразу (в демо — с заполненным
   профилем), кандидат оставляет заявку из трёх вопросов. */

const clock = (tz) => {
  try {
    return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: tz }).format(new Date());
  } catch {
    return '';
  }
};

export default function Welcome() {
  const app = useApp();
  const [apply, setApply] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  // после входа — короткий тест: по нему ассистент собирает группу и знакомства
  const enter = () => {
    app.enter();
    go(app.me.tested ? '/' : '/test', true);
  };

  return (
    <div className="wlc">
      <Chrome left="UHOME CLUB · закрытый клуб" right="2026" progress={1} />

      <div className="wlc__stage">
        <div className="wlc__splash">
          <i className="wlc__hair wlc__hair--l" />
          <i className="wlc__hair wlc__hair--r" />
          <Splash />
        </div>
        <h1 className="wlc__word" aria-label="UHOME CLUB">
          {'UHOME'.split('').map((c, i) => <span key={i} style={{ '--i': i }} aria-hidden="true">{c}</span>)}
        </h1>
        <div className="wlc__club" aria-hidden="true">CLUB</div>
        <p className="wlc__promise">Клуб предпринимателей, которые живут <b>между странами</b></p>
      </div>

      <div className="wlc__regions" aria-label="Регионы клуба">
        {REGION_KEYS.map((k, i) => (
          <div key={k} className="wlc__rg" style={{ '--i': i }}>
            <Flag cc={REGIONS[k].cc} size={18} />
            <span className="wlc__rn">{REGIONS[k].name}</span>
            <time className="wlc__rt">{clock(REGIONS[k].tz)}</time>
          </div>
        ))}
      </div>

      <div className="wlc__cta">
        <Btn variant="gold" wide onClick={enter}>Войти как резидент</Btn>
        <Btn variant="quiet" wide onClick={() => setApply(true)}>Стать резидентом</Btn>
        <div className="wlc__demo">Демо · данные хранятся только на этом телефоне</div>
      </div>

      <Sheet open={apply} onClose={() => setApply(false)} title="Заявка в клуб" sub="Три вопроса. Остальное — потом, в профиле.">
        <Apply onDone={(me) => { app.enter(me); app.say('Заявка принята — пока открыли демо-доступ'); go('/test', true); }} />
      </Sheet>
    </div>
  );
}

/* Заставка: кольца прибора и знак, который рисуется линией. */
function Splash() {
  return (
    <svg className="wlc__svg" viewBox="-100 -100 200 200" aria-hidden="true">
      <defs>
        <radialGradient id="wlcGlow">
          <stop offset="0%" stopColor="#d9b26b" stopOpacity=".3" />
          <stop offset="60%" stopColor="#d9b26b" stopOpacity=".05" />
          <stop offset="100%" stopColor="#d9b26b" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle className="wlc__glow" r="92" fill="url(#wlcGlow)" />
      <circle className="wlc__r wlc__r0" r="88" pathLength="1" />
      <g className="wlc__spin">
        <circle className="wlc__r wlc__r1" r="80" />
        <circle className="wlc__sat" cx="80" cy="0" r="2.2" />
      </g>
      <g className="wlc__spin wlc__spin--rev">
        <circle className="wlc__r wlc__r2" r="70" />
      </g>
      <path className="wlc__cross" d="M-99 0h9M99 0h-9M0 -99v9M0 99v-9" pathLength="1" />
      <g className="wlc__mark" transform="scale(.9) translate(-50 -52)">
        <path className="wlc__stroke" pathLength="1" d="M22 47 50 24 78 47" />
        <path className="wlc__stroke wlc__stroke--u" pathLength="1" d="M33 50v12a17 17 0 0 0 34 0V50" />
        <circle className="wlc__dot" cx="50" cy="58" r="4.6" />
      </g>
    </svg>
  );
}

function Apply({ onDone }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [region, setRegion] = useState('');
  const ok = name.trim().split(/\s+/).length >= 2 && role && region;

  return (
    <div className="stack" style={{ gap: 18 }}>
      <Field label="Имя и фамилия" hint="Так вас увидят резиденты; на карте — латиницей">
        <input className="field" placeholder="Например, Анна Смирнова" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </Field>
      <div>
        <span className="label">Чем занимаетесь</span>
        <div className="wrap">
          {ROLES.map((r) => (
            <button key={r} className={`chip${role === r ? ' chip--on' : ''}`} onClick={() => setRole(r)}>{r}</button>
          ))}
        </div>
      </div>
      <div>
        <span className="label">Где вы сейчас</span>
        <div className="wrap">
          {REGION_KEYS.map((k) => (
            <button key={k} className={`chip${region === k ? ' chip--on' : ''}`} onClick={() => setRegion(k)}>
              <Flag cc={REGIONS[k].cc} size={14} /> {REGIONS[k].name}
            </button>
          ))}
        </div>
      </div>
      <Btn
        variant="gold"
        wide
        disabled={!ok}
        onClick={() => onDone({
          name: name.trim(), role, title: role, region, city: REGIONS[region].name, company: '',
          since: new Date().getFullYear(), number: memberNumber(name.trim(), new Date().getFullYear()),
        })}
      >
        Отправить заявку
      </Btn>
    </div>
  );
}
