import { AVATARS } from '../../data/avatars.js';
import { AvatarPortrait } from '../AvatarArt.jsx';
import { useTypewriter } from '../../lib/motion.js';

/* Выбор ассистента: два портрета в голографических орбитах. Выбранный
   выходит вперёд — кольца вращаются, по лицу идёт луч сканера, вокруг
   мягкое свечение; второй отступает в тень. Имя проявляется по буквам,
   описание печатается, как ответ в терминале. */

const IDS = ['eva', 'adam'];
const SKILLS = {
  eva: ['Люди', 'События', 'База знаний'],
  adam: ['Рынок', 'Сделки', 'Инвесторы'],
};

export default function AvatarPick({ value, onPick }) {
  const A = AVATARS[value] || AVATARS.eva;
  const about = useTypewriter(A.about, { speed: 11, delay: 380 });

  return (
    <div className="avp">
      <div className="avp__stage" data-on={value}>
        <svg className="avp__bridge" viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 20H200" />
        </svg>
        {IDS.map((id, i) => {
          const on = value === id;
          const X = AVATARS[id];
          return (
            <button
              key={id}
              className={`avp__o${on ? ' is-on' : ' is-off'}`}
              onClick={(e) => onPick(id, e)}
              aria-pressed={on}
              aria-label={`${X.name} — ${X.role}`}
            >
              <span className="avp__glow" />
              <Rings />
              <span className="avp__ph">
                <AvatarPortrait who={id} size={132} ring={false} />
                <span className="avp__scan" />
                <span className="avp__grid" />
              </span>
              <span className="avp__code">
                <b>{X.en}</b> · 0{i + 1}
              </span>
            </button>
          );
        })}
      </div>

      <div className="avp__id">
        <div className="avp__name display" key={A.id} aria-live="polite">
          {A.name.split('').map((c, i) => <span key={i} style={{ '--i': i }}>{c}</span>)}
        </div>
        <div className="avp__role">Цифровой ассистент · обучен на базе клуба</div>
        <div className="avp__skills" key={`s${A.id}`}>
          {SKILLS[A.id].map((x, i) => <span key={x} style={{ '--i': i }}>{x}</span>)}
        </div>
        <p className="avp__about">
          {about.text}
          <i className={`o-caret${about.done ? ' is-idle' : ''}`} />
        </p>
      </div>
    </div>
  );
}

/* Кольца орбиты: тонкая кромка, бегущие риски, дуги в обратную сторону,
   спутник на внешнем кольце и четыре метки по сторонам света. */
function Rings() {
  return (
    <svg className="avp__rings" viewBox="-90 -90 180 180" aria-hidden="true">
      <circle className="avp__r0" r="66" />
      <circle className="avp__r1" r="73" />
      <circle className="avp__r2" r="81" />
      <g className="avp__sat"><circle cx="81" cy="0" r="2.4" /></g>
      <path className="avp__tick" d="M0 -88v6M0 88v-6M-88 0h6M88 0h-6" />
    </svg>
  );
}
