import { useId } from 'react';
import { useStore } from '../lib/store.jsx';
import { cityName, residentNumber, residentTitle, seasonProgress, teamOf, isPro } from '../lib/logic.js';
import { dateShort } from '../lib/time.js';
import { hash } from '../lib/format.js';
import { Avatar, toneOf } from './UI.jsx';
import Icon from './Icons.jsx';

/* Карточка резидента: то, что участник видит первым делом.
   Живёт сама — по ней раз в несколько секунд проходит полоса света,
   а линии на фоне нарисованы вектором и не грузятся из сети. */

export default function ResidentCard({ now = Date.now() }) {
  const { state, me } = useStore();
  const season = seasonProgress(state, now);
  const id = useId().replace(/:/g, '');
  const tone = isPro(me) ? '#8e7bf5' : toneOf(me);
  const team = teamOf(state, me.id);

  // Линии фона: устойчивый набор дуг, свой у каждого участника
  const seed = hash(me.id);
  const arcs = Array.from({ length: 7 }, (_, i) => {
    const y = 26 + i * 22 + (seed % 9);
    const amp = 10 + ((seed >> i) % 14);
    return `M-10 ${y} C 60 ${y - amp}, 140 ${y + amp}, 330 ${y - amp / 2}`;
  });

  return (
    <div className="res" style={{ '--tone': tone }}>
      <div className="res__bg">
        <svg viewBox="0 0 320 198" preserveAspectRatio="none">
          <defs>
            <linearGradient id={`rg${id}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={tone} stopOpacity="0.42" />
              <stop offset="55%" stopColor="#141822" />
              <stop offset="100%" stopColor="#0c0f16" />
            </linearGradient>
          </defs>
          <rect width="320" height="198" fill={`url(#rg${id})`} />
          <g fill="none" stroke="#fff" strokeOpacity="0.07" strokeWidth="1">
            {arcs.map((d, i) => <path key={i} d={d} />)}
          </g>
          <circle cx="272" cy="34" r="54" fill="#fff" opacity="0.04" />
        </svg>
      </div>
      <div className="res__band" />

      <div className="res__body">
        <div className="res__head">
          <span className="res__mark"><Icon name="spark" size={13} color={tone} /> IAI CLUB</span>
          <span className="res__no">№ {residentNumber(me)}</span>
        </div>

        <div className="res__id">
          <Avatar user={me} size={50} radius={0.3} />
          <div style={{ minWidth: 0 }}>
            <div className="res__name ell">{me.name}</div>
            <div className="res__tier" style={{ color: tone }}>{residentTitle(me)}</div>
          </div>
        </div>

        {/* Полоса сезона: видно, сколько пути пройдено */}
        <div className="res__season" title={`Сезон пройден на ${season.percent}%`}>
          <i style={{ width: `${season.percent}%`, background: tone }} />
        </div>

        <div className="res__foot">
          <div>
            <div className="res__lbl">Город</div>
            <div className="res__val">{cityName(state, me.cityId)}</div>
          </div>
          <div>
            <div className="res__lbl">Команда</div>
            <div className="res__val">{team ? team.name : '—'}</div>
          </div>
          <div>
            <div className="res__lbl">В клубе с</div>
            <div className="res__val">{dateShort(me.joinedAt)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
