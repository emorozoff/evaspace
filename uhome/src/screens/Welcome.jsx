import { useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { memberNumber } from '../lib/art.js';
import { REGIONS, REGION_KEYS } from '../data/regions.js';
import { ROLES } from '../data/people.js';
import { Mark } from '../components/Art.jsx';
import { Btn, Sheet, Field } from '../components/UI.jsx';
import Flag from '../components/Flag.jsx';

/* Вход: два пути. Резидент заходит сразу (в демо — с заполненным профилем),
   кандидат оставляет заявку из трёх вопросов: имя, чем занимается, где сейчас. */

export default function Welcome() {
  const app = useApp();
  const [apply, setApply] = useState(false);

  // после входа — короткий тест: по нему ассистент собирает группу и знакомства
  const enter = () => {
    app.enter();
    go(app.me.tested ? '/' : '/test', true);
  };

  return (
    <div className="welcome">
      <div />
      <div className="welcome__mark">
        <Mark size={88} ring glow />
        <div>
          <h1 className="welcome__title">UHOME<span>CLUB</span></h1>
          <p className="lead" style={{ marginTop: 14, maxWidth: 330 }}>
            Клуб резидентов, которые живут между странами. События, услуги своих, знакомства и база знаний — в одном приложении.
          </p>
        </div>
        <div className="welcome__hubs">
          {REGION_KEYS.map((k) => (
            <span key={k} className="chip" style={{ height: 32, fontSize: 13 }}><Flag cc={REGIONS[k].cc} size={14} /> {REGIONS[k].name}</span>
          ))}
        </div>
      </div>

      <div className="stack">
        <Btn variant="gold" wide onClick={enter}>Войти как резидент</Btn>
        <Btn variant="quiet" wide onClick={() => setApply(true)}>Стать резидентом</Btn>
        <div className="t-xs dim-2 center">Демо-версия: данные хранятся только на этом телефоне</div>
      </div>

      <Sheet open={apply} onClose={() => setApply(false)} title="Заявка в клуб" sub="Три вопроса. Остальное — потом, в профиле.">
        <Apply onDone={(me) => { app.enter(me); app.say('Заявка принята — пока открыли демо-доступ'); go('/test', true); }} />
      </Sheet>
    </div>
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
