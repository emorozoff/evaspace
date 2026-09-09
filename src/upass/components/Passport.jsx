import { useEffect, useRef, useState } from 'react';
import { Guilloche, QR, Avatar, Seal } from './Art.jsx';
import { mrz, residentNumber } from '../lib/art.js';
import { translit } from '../lib/format.js';
import { roleEn } from '../data/people.js';
import { TIERS, DEGREES } from '../data/canon.js';
import { REGIONS } from '../data/regions.js';
import { shortHash } from '../lib/chain.js';

/* Цифровой паспорт. Заполнен латиницей, как настоящий проездной документ:
   лицевая сторона — кто это, оборот — пропуск с большим кодом.
   Карта живёт: медленно качается сама и доворачивается за пальцем,
   по нажатию переворачивается. */

export default function Passport({ me, chain = [], trips = [], flippable = true, compact = false }) {
  const [flip, setFlip] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const ref = useRef(null);

  const tier = TIERS.find((t) => t.n === me.tier) || TIERS[0];
  const degree = DEGREES.find((d) => d.n === me.degree) || DEGREES[0];
  const city = REGIONS[me.city] || {};
  const number = me.number || residentNumber(me.name || 'guest', me.since);
  const [l1, l2] = mrz(translit(me.name || 'RESIDENT'), number.replace(/-/g, ''), 'UHM', 'P');
  const root = chain.length ? chain[chain.length - 1].hash : '';
  const [e1] = tier.edge;

  const nameEn = translit(me.name || 'Resident') || 'RESIDENT';
  const org = (me.company || '').toUpperCase();
  const degreeEn = degree.secret ? '·····' : degree.en;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      setTilt({ x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5 });
    };
    const onLeave = () => setTilt({ x: 0, y: 0 });
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <div className="pass-scene" ref={ref}>
      {/* качается отдельным слоем: наклон за пальцем и переворот живут на карте,
          собственная анимация — на обёртке, иначе одно затирает другое */}
      <div className="pass-float">
        <div
          className={`pass${flip ? ' pass--flip' : ''}`}
          onClick={() => flippable && setFlip((f) => !f)}
          style={{ '--tx': `${tilt.x * 7}deg`, '--ty': `${-tilt.y * 7}deg` }}
        >
          {/* ЛИЦЕВАЯ */}
          <div className="pass__face">
            <div className="pass__bg" style={{ background: 'linear-gradient(148deg, #1a1e29 0%, #0e1017 52%, #08090e 100%)' }} />
            {/* два кольца гильоша: нижнее стоит, верхнее очень медленно
                вращается — на их пересечении линии переливаются сами */}
            <div className="pass__guilloche">
              <Guilloche color={e1} opacity={0.4} seed={number} size={270} />
            </div>
            <div className="pass__guilloche pass__guilloche--spin">
              <Guilloche color={e1} opacity={0.26} seed={`${number}b`} size={270} />
            </div>
            <div className="pass__edge" style={{ boxShadow: `inset 0 0 0 1.5px ${e1}66, inset 0 0 34px ${e1}12` }} />
            <div className="pass__band" style={{ '--tone': e1 }} />
            <div className="pass__sheen" style={{ transform: `translate(${tilt.x * 30}px, ${tilt.y * 20}px)` }} />

            <div className="pass__body">
              {/* шапка: марка отдельной строкой, аватар к ней не примыкает */}
              <div className="pass__head">
                <div className="row" style={{ gap: 8 }}>
                  <Seal size={17} color={e1} motto="" />
                  <span className="pass__mark">UPASS</span>
                </div>
                <span className="pass__tier" style={{ color: e1 }}>{tier.name.toUpperCase()}</span>
              </div>

              <div className="pass__id">
                <Avatar person={me} size={compact ? 42 : 48} ring={e1} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="pass__name ell">{nameEn}</div>
                  <div className="pass__role ell">{roleEn(me)}{org ? ` · ${org}` : ''}</div>
                </div>
                <QR value={`upass:${number}`} size={compact ? 42 : 48} tone={e1} radius={10} />
              </div>

              <div className="pass__grid">
                <F label="Passport No." value={number} tone={e1} />
                <F label="Region" value={`${city.flag || ''} ${(city.en || '').toUpperCase()}`} />
                <F label="Valid thru" value="12 / 27" align="right" />
              </div>

              <div className="pass__mrzbox">
                <div className="pass__mrz">{l1}</div>
                <div className="pass__mrz">{l2}</div>
              </div>
            </div>
          </div>

          {/* ОБОРОТ */}
          <div className="pass__face pass__face--back">
            <div className="pass__bg" style={{ background: 'linear-gradient(148deg, #141721, #08090e)' }} />
            <div className="pass__edge" style={{ boxShadow: `inset 0 0 0 1.5px ${e1}55` }} />
            <div className="pass__band" style={{ '--tone': e1 }} />
            <div className="pass__body">
              <div className="pass__head">
                <span className="pass__mark" style={{ color: e1 }}>MEMBER PASS</span>
                <span className="pass__no">{number}</span>
              </div>

              <div className="pass__back">
                <QR value={`upass:${number}:entry`} size={compact ? 86 : 96} tone={e1} radius={14} />
                <div className="pass__pairs">
                  <F label="Level" value={tier.name.toUpperCase()} tone={e1} />
                  <F label="Degree" value={`${degree.roman} · ${degreeEn}`} tone={e1} />
                  <F label="Region" value={`${city.flag || ''} ${(city.en || '').toUpperCase()}`} />
                  <F label="Languages" value={(me.langs || []).join(' · ') || '—'} />
                  <F label="Member since" value={String(me.since || '')} />
                  <F label="Trips" value={trips.length ? `${trips.length} announced` : 'none'} tone={trips.length ? '#58D68D' : undefined} />
                </div>
              </div>

              <div className="pass__mrzbox">
                <div className="spread">
                  <span className="pass__lbl">Reputation · {chain.length} {chain.length === 1 ? 'record' : 'records'}</span>
                  <span className="pass__lbl">Valid thru 12 / 27</span>
                </div>
                <div className="mono" style={{ fontSize: 9.5, color: e1, letterSpacing: '0.04em', marginTop: 3 }}>
                  {root ? shortHash(root, 18) : 'chain is empty'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {flippable && (
        <div className="center dim-2 t-xs" style={{ marginTop: 10 }}>
          {flip ? 'Нажмите, чтобы вернуть лицевую сторону' : 'Нажмите на карту — на обороте пропуск'}
        </div>
      )}
    </div>
  );
}

function F({ label, value, tone, align }) {
  return (
    <div style={{ minWidth: 0, textAlign: align }}>
      <div className="pass__lbl">{label}</div>
      <div className="pass__val ell" style={tone ? { color: tone } : undefined}>{value}</div>
    </div>
  );
}
