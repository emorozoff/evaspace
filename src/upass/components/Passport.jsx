import { useEffect, useRef, useState } from 'react';
import { Guilloche, QR, Avatar, Seal } from './Art.jsx';
import { mrz, residentNumber } from '../lib/art.js';
import { translit } from '../lib/format.js';
import { TIERS, DEGREES } from '../data/canon.js';
import { CITIES } from '../data/places.js';
import { shortHash } from '../lib/chain.js';

/* Цифровой паспорт. Лицевая сторона — кто это; оборот — всё, что нужно на входе:
   большой код для сканирования, номер, срок, уровень, степень, языки, наследник, хеш репутации. */

export default function Passport({ me, chain = [], heirs = [], flippable = true, compact = false }) {
  const [flip, setFlip] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const ref = useRef(null);

  const tier = TIERS.find((t) => t.n === me.tier) || TIERS[0];
  const degree = DEGREES.find((d) => d.n === me.degree) || DEGREES[0];
  const city = CITIES[me.city] || {};
  const number = me.number || residentNumber(me.name || 'guest', me.since);
  const [l1, l2] = mrz(translit(me.name || 'RESIDENT'), number.replace(/-/g, ''), 'UHM', 'P');
  const root = chain.length ? chain[chain.length - 1].hash : '';
  const [e1] = tier.edge;

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
      <div
        className="pass"
        onClick={() => flippable && setFlip((f) => !f)}
        style={{ transform: flip ? 'rotateY(180deg)' : `rotateY(${tilt.x * 6}deg) rotateX(${-tilt.y * 6}deg)` }}
      >
        {/* ЛИЦЕВАЯ */}
        <div className="pass__face">
          <div className="pass__bg" style={{ background: 'linear-gradient(150deg, #171a24 0%, #0d0f16 50%, #08090e 100%)' }} />
          <div style={{ position: 'absolute', right: -70, top: -60, opacity: 0.5 }}>
            <Guilloche color={e1} opacity={0.4} seed={number} size={280} />
          </div>
          <div className="pass__edge" style={{ boxShadow: `inset 0 0 0 1.5px ${e1}70, inset 0 0 30px ${e1}14` }} />
          <div className="pass__sheen" style={{ transform: `translate(${tilt.x * 26}px, ${tilt.y * 18}px)` }} />

          <div className="pass__body">
            <div className="spread">
              <div className="row" style={{ gap: 7 }}>
                <Seal size={20} color={e1} motto="" />
                <span style={{ fontWeight: 800, letterSpacing: '0.24em', fontSize: 12 }}>UPASS</span>
              </div>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', color: e1 }}>{tier.name.toUpperCase()}</span>
            </div>

            <div className="row" style={{ gap: 13, marginTop: 'auto' }}>
              <Avatar person={me} size={compact ? 46 : 54} ring={e1} />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="display ell" style={{ fontSize: compact ? 20 : 23 }}>{me.name || 'Имя резидента'}</div>
                <div style={{ height: 1.5, width: 54, background: `linear-gradient(90deg, ${e1}, transparent)`, margin: '5px 0' }} />
                <div className="ell" style={{ fontSize: 11, color: 'rgba(255,255,255,.62)' }}>
                  {me.title || me.role}{me.company ? ` · ${me.company}` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right', flex: 'none' }}>
                <div style={{ fontSize: 22, lineHeight: 1 }}>{city.flag}</div>
                <div style={{ fontSize: 8.5, letterSpacing: '0.1em', color: 'rgba(255,255,255,.6)', marginTop: 4 }}>{(city.name || '').toUpperCase()}</div>
              </div>
            </div>

            <div className="spread" style={{ marginTop: 12, alignItems: 'flex-end' }}>
              <div style={{ display: 'grid', gap: 6 }}>
                <F label="Номер" value={number} tone={e1} />
                <F label="Степень" value={`${degree.roman} · ${degree.secret ? '·····' : degree.name}`} tone={e1} />
                <F label="Действует до" value="12 · 2027" tone={e1} />
              </div>
              <div style={{ background: '#fff', borderRadius: 8, padding: 3, lineHeight: 0 }}>
                <QR value={`upass:${number}`} size={compact ? 52 : 60} />
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
          <div className="pass__bg" style={{ background: 'linear-gradient(150deg, #12141c, #08090e)' }} />
          <div className="pass__edge" style={{ boxShadow: `inset 0 0 0 1.5px ${e1}60` }} />
          <div className="pass__body" style={{ gap: 0 }}>
            <div className="spread">
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', color: e1 }}>ПРОПУСК В UHOME</span>
              <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,.5)', letterSpacing: '0.08em' }}>{number}</span>
            </div>

            <div className="row-t" style={{ gap: 14, marginTop: 10, flex: 1 }}>
              <div style={{ background: '#fff', borderRadius: 10, padding: 5, lineHeight: 0, flex: 'none', alignSelf: 'center' }}>
                <QR value={`upass:${number}:entry`} size={compact ? 84 : 98} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px 10px', flex: 1, alignContent: 'center' }}>
                <F label="Уровень" value={tier.name} tone={e1} />
                <F label="Степень" value={degree.secret ? `${degree.roman} · ·····` : `${degree.roman} · ${degree.name}`} tone={e1} />
                <F label="Город" value={`${city.flag} ${city.name || ''}`} tone="#fff" />
                <F label="Языки" value={(me.langs || []).join(' · ') || '—'} tone="#fff" />
                <F label="В клубе с" value={String(me.since || '')} tone="#fff" />
                <F label="Наследник" value={heirs.length ? 'назначен' : 'не назначен'} tone={heirs.length ? '#58D68D' : 'rgba(255,255,255,.55)'} />
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,.09)', paddingTop: 7, display: 'grid', gap: 3 }}>
              <div className="spread">
                <span className="pass__lbl">Репутация · записей {chain.length}</span>
                <span className="pass__lbl">Действует до 12 · 2027</span>
              </div>
              <div className="mono" style={{ fontSize: 9.5, color: e1, letterSpacing: '0.04em' }}>{root ? shortHash(root, 18) : 'цепочка пуста'}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,.45)', lineHeight: 1.35 }}>
                Покажите код на входе в любую локацию сети. Паспорт действует только внутри сообщества и аннулируется при исключении.
              </div>
            </div>
          </div>
        </div>
      </div>

      {flippable && (
        <div className="center dim-2 t-xs" style={{ marginTop: 9 }}>
          {flip ? 'Нажмите, чтобы вернуть лицевую сторону' : 'Нажмите на карту — на обороте пропуск'}
        </div>
      )}
    </div>
  );
}

function F({ label, value, tone }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="pass__lbl">{label}</div>
      <div className="pass__val ell" style={{ color: tone }}>{value}</div>
    </div>
  );
}
