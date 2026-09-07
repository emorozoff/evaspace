import { useEffect, useRef, useState } from 'react';
import { Guilloche, QR, Avatar, Seal } from './Art.jsx';
import { mrz, residentNumber } from '../lib/art.js';
import { translit } from '../lib/format.js';
import { TIERS, DEGREES, MOTTO_MASKED } from '../data/canon.js';
import { CITIES } from '../data/places.js';
import { shortHash } from '../lib/chain.js';
import Icon from './Icons.jsx';

/* Цифровой паспорт резидента: главный носитель бренда.
   Кант карты окрашен по уровню членства, гильош и MRZ — как в настоящем документе. */

export default function Passport({ me, chain = [], flippable = true, compact = false }) {
  const [flip, setFlip] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const ref = useRef(null);

  const tier = TIERS.find((t) => t.n === me.tier) || TIERS[0];
  const degree = DEGREES.find((d) => d.n === me.degree) || DEGREES[0];
  const city = CITIES[me.city] || {};
  const number = me.number || residentNumber(me.name || 'guest', me.since);
  const [l1, l2] = mrz(translit(me.name || 'RESIDENT'), number.replace(/-/g, ''), 'UHM', 'P');
  const root = chain.length ? chain[chain.length - 1].hash : '';

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      setTilt({ x: px, y: py });
    };
    const onLeave = () => setTilt({ x: 0, y: 0 });
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  const [e1, e2] = tier.edge;

  return (
    <div className="pass-scene" ref={ref}>
      <div
        className="pass"
        data-flip={flip}
        onClick={() => flippable && setFlip((f) => !f)}
        style={{
          transform: flip
            ? 'rotateY(180deg)'
            : `rotateY(${tilt.x * 7}deg) rotateX(${-tilt.y * 7}deg)`,
        }}
      >
        {/* ЛИЦЕВАЯ СТОРОНА */}
        <div className="pass__face">
          <div className="pass__bg" style={{ background: `linear-gradient(150deg, #14161f 0%, #0a0c13 46%, #05060a 100%)` }} />
          <div style={{ position: 'absolute', inset: 0, opacity: 0.55, display: 'grid', placeItems: 'center' }}>
            <div style={{ transform: 'translate(24%, -6%)' }}>
              <Guilloche color={e1} opacity={0.34} seed={number} size={300} />
            </div>
          </div>
          <div
            className="pass__edge"
            style={{ boxShadow: `inset 0 0 0 1.5px ${e1}66, inset 0 0 26px ${e1}18` }}
          />
          <div className="pass__sheen" style={{ transform: `translate(${tilt.x * 26}px, ${tilt.y * 18}px)` }} />

          <div className="pass__body">
            <div className="spread">
              <div className="row" style={{ gap: 7 }}>
                <Seal size={20} color={e1} motto="" />
                <span style={{ fontWeight: 800, letterSpacing: '0.24em', fontSize: 12 }}>UPASS</span>
              </div>
              <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.18em', color: e1 }}>
                {tier.name.toUpperCase()}
              </span>
            </div>

            <div className="row" style={{ gap: 12, marginTop: 'auto' }}>
              <Avatar person={me} size={compact ? 44 : 52} ring={e1} />
              <div className="grow" style={{ minWidth: 0 }}>
                <div
                  className="display"
                  style={{ fontSize: compact ? 20 : 23, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  {me.name || 'Имя резидента'}
                </div>
                <div style={{ height: 1.5, width: 54, background: `linear-gradient(90deg, ${e1}, transparent)`, margin: '5px 0 5px' }} />
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.62)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {me.role}{me.company ? ` · ${me.company}` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right', flex: 'none' }}>
                <div style={{ fontSize: 22 }}>{city.flag}</div>
                <div style={{ fontSize: 9, letterSpacing: '0.1em', color: 'rgba(255,255,255,.6)', marginTop: 2 }}>
                  {(city.name || '').toUpperCase()}
                </div>
              </div>
            </div>

            <div className="spread" style={{ marginTop: 12, alignItems: 'flex-end' }}>
              <div style={{ display: 'grid', gap: 6 }}>
                <Field label="Номер" value={number} tone={e1} />
                <Field label="Степень" value={`${degree.roman} · ${degree.secret ? '·····' : degree.name}`} tone={e1} />
                <Field label="Действует до" value="12 · 2027" tone={e1} />
              </div>
              <div style={{ background: '#fff', borderRadius: 8, padding: 3, lineHeight: 0 }}>
                <QR value={`upass:${number}:${me.handle || 'you'}`} size={compact ? 54 : 62} />
              </div>
            </div>

            <div style={{ marginTop: 10, borderTop: '1px solid rgba(255,255,255,.09)', paddingTop: 6 }}>
              <div className="pass__mrz">{l1}</div>
              <div className="pass__mrz">{l2}</div>
            </div>
          </div>
        </div>

        {/* ОБОРОТ */}
        <div className="pass__face pass__face--back">
          <div className="pass__bg" style={{ background: 'linear-gradient(150deg, #0d0f17, #05060a)' }} />
          <div style={{ position: 'absolute', right: -30, bottom: -30, opacity: 0.5 }}>
            <Seal size={170} color={e1} motto={MOTTO_MASKED} />
          </div>
          <div className="pass__edge" style={{ boxShadow: `inset 0 0 0 1.5px ${e1}55` }} />
          <div className="pass__body" style={{ gap: 8 }}>
            <div className="eyebrow" style={{ color: e1 }}>Запись в цепочке репутации</div>
            <div style={{ display: 'grid', gap: 7, marginTop: 2 }}>
              <Field label="Корневой хеш" value={root ? shortHash(root, 14) : 'цепочка пуста'} mono tone={e1} />
              <Field label="Записей" value={String(chain.length)} tone={e1} />
              <Field label="Выдан" value={me.since ? `${me.since} год` : '—'} tone={e1} />
              <Field label="Уровень членства" value={`${tier.name}${tier.price ? ` · $${tier.price}/год` : ''}`} tone={e1} />
            </div>
            <div style={{ marginTop: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              <Icon name="shield" size={15} color={e1} />
              <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,.55)', lineHeight: 1.4 }}>
                Паспорт действителен только внутри сообщества. Утрата степени и исключение
                аннулируют доступ во всех локациях UHOME.
              </div>
            </div>
          </div>
        </div>
      </div>

      {flippable && (
        <div className="center dim-2 t-xs" style={{ marginTop: 9 }}>
          {flip ? 'Нажмите, чтобы вернуть лицевую сторону' : 'Нажмите на карту, чтобы посмотреть оборот'}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, tone, mono }) {
  return (
    <div>
      <div style={{ fontSize: 7.6, letterSpacing: '0.16em', color: 'rgba(255,255,255,.4)', fontWeight: 700 }}>
        {label.toUpperCase()}
      </div>
      <div
        className={mono ? 'mono' : ''}
        style={{ fontSize: mono ? 10 : 12, fontWeight: 700, color: tone, marginTop: 1, letterSpacing: mono ? '0.02em' : '0.03em' }}
      >
        {value}
      </div>
    </div>
  );
}
