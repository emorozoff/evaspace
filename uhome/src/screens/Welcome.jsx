import { useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { morph } from '../lib/motion.js';
import { REGION_KEYS } from '../data/regions.js';
import { regionStats } from '../data/communities.js';
import { EVENTS } from '../data/events.js';
import { Btn } from '../components/UI.jsx';
import Onboarding from '../components/onboarding/Onboarding.jsx';

/* Вход — титульный слайд колоды: строка-шапка, знак UHOME рисуется одной
   линией, слово антиквой, обещание в одну строку, полоса цифр и два пути.
   Резидент входит сразу (в демо — с заполненным профилем) и, если тест
   ещё не пройден, попадает в карточку регистрации. Кандидат проходит ту
   же карточку с пустыми полями прямо здесь и входит в клуб в конце —
   уже с профилем и паспортом (app.apply — чистый профиль кандидата). */

// hash меняется асинхронно: ждём его, чтобы клуб открылся сразу на нужном экране
const afterHash = () =>
  new Promise((resolve) => {
    let done = false;
    const fin = () => {
      if (done) return;
      done = true;
      window.removeEventListener('hashchange', fin);
      resolve();
    };
    window.addEventListener('hashchange', fin);
    setTimeout(fin, 80);
  });

export default function Welcome() {
  const app = useApp();
  const [apply, setApply] = useState(false);
  const residents = REGION_KEYS.reduce((n, k) => n + regionStats(k).residents, 0);

  const enter = async () => {
    if (app.me.tested) {
      app.enter();
      go('/', true);
      return;
    }
    go('/test', true);
    await afterHash();
    morph(() => app.enter());
  };

  if (apply) {
    return (
      <Onboarding
        app={app}
        initial={app.me}
        applicant
        onEnter={(profile, answers) => {
          app.apply(profile);
          app.finishTest(answers);
          app.say('Заявка принята — открыли демо-доступ');
          go('/', true);
        }}
        onLater={(profile, answers) => {
          app.apply(profile);
          app.updateMe(answers);
          go('/', true);
        }}
        onExit={() => morph(() => setApply(false))}
      />
    );
  }

  return (
    <div className="o-scr">
      <div className="chrome o-in"><span>UHOME CLUB · закрытый клуб</span><b>2026</b></div>

      <div className="o-wlc__stage">
        <svg className="o-wlc__mark" viewBox="0 0 100 100" aria-hidden="true">
          <path pathLength="1" d="M22 47 50 24 78 47" />
          <path pathLength="1" d="M33 50v12a17 17 0 0 0 34 0V50" />
          <circle cx="50" cy="58" r="4.6" />
        </svg>
        <h1 className="o-wlc__word o-in" style={{ '--d': '0.85s' }}>UHOME</h1>
        <p className="lead o-wlc__lead o-in" style={{ '--d': '1.05s' }}>
          Закрытый клуб предпринимателей, которые живут <em>между странами</em>.
        </p>
      </div>

      <div className="strip o-in" style={{ '--d': '1.25s' }}>
        <div><span className="strip__v">{REGION_KEYS.length}</span><span className="strip__k">регионов</span></div>
        <div><span className="strip__v">{residents}</span><span className="strip__k">резидентов</span></div>
        <div><span className="strip__v">{EVENTS.length}</span><span className="strip__k">событий</span></div>
      </div>

      <div className="o-wlc__cta o-in" style={{ '--d': '1.4s' }}>
        <Btn variant="gold" wide onClick={enter}>Войти как резидент</Btn>
        <Btn variant="quiet" wide onClick={() => morph(() => setApply(true))}>Стать резидентом</Btn>
        <div className="o-wlc__demo">Демо · данные хранятся только на этом телефоне</div>
      </div>
    </div>
  );
}
