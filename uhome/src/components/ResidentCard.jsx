import { useEffect, useRef, useState } from 'react';
import { Guilloche, QR, Avatar, Mark } from './Art.jsx';
import Icon from './Icons.jsx';
import { mrz } from '../lib/art.js';
import { translit } from '../lib/format.js';
import { roleEn } from '../data/people.js';
import { REGIONS } from '../data/regions.js';
import Flag from './Flag.jsx';

/* Карта резидента — из UPASS: заполнена латиницей, как проездной документ.
   Лицевая сторона — кто это и где сейчас, оборот — пропуск с большим кодом
   для входа на события. Сама медленно качается, доворачивается за пальцем
   и переворачивается по нажатию. */

export default function ResidentCard({ me, stats = {}, hint = true, onFlip }) {
  const [flip, setFlip] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const ref = useRef(null);

  const region = REGIONS[me.region] || {};
  const number = me.number || 'UH-26-0000';
  const nameEn = translit(me.name) || 'RESIDENT';
  const [l1, l2] = mrz(nameEn, number.replace(/-/g, ''));
  const org = (me.company || '').toUpperCase();

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

  const regionVal = <><Flag cc={region.cc} size={11} style={{ marginRight: 5 }} />{region.en || ''}</>;

  return (
    <div className="pass-scene" ref={ref}>
      <div className="pass-float">
        <div
          className={`pass${flip ? ' pass--flip' : ''}`}
          onClick={() => { setFlip((f) => !f); onFlip?.(); }}
          style={{ '--tx': `${tilt.x * 7}deg`, '--ty': `${-tilt.y * 7}deg` }}
          role="button"
          aria-label="Перевернуть карту резидента"
        >
          {/* ЛИЦЕВАЯ */}
          <div className="pass__face">
            <div className="pass__bg" style={{ background: 'linear-gradient(150deg, #1a1e29 0%, #0e1016 50%, #08090e 100%)' }} />
            <div className="pass__guilloche"><Guilloche opacity={0.4} seed={number} size={280} /></div>
            <div className="pass__guilloche pass__guilloche--spin"><Guilloche opacity={0.25} seed={`${number}b`} size={280} /></div>
            <div className="pass__edge" />
            <div className="pass__band" />
            <div className="pass__sheen" style={{ transform: `translate(${tilt.x * 30}px, ${tilt.y * 20}px)` }} />

            <div className="pass__body">
              <div className="pass__head">
                <div className="row" style={{ gap: 8 }}>
                  <Mark size={20} />
                  <span className="pass__mark">UHOME<small>CLUB</small></span>
                </div>
                <span className="pass__tier">RESIDENT</span>
              </div>

              <div className="pass__id">
                <Avatar person={me} size={50} ring="#C9A96E" />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="pass__name ell" style={{ fontSize: nameEn.length > 17 ? 16 : nameEn.length > 13 ? 18 : 20 }}>{nameEn}</div>
                  <div className="pass__role ell">{roleEn(me)}{org ? ` · ${org}` : ''}</div>
                </div>
                <QR value={`uhome:${number}`} size={48} radius={10} />
              </div>

              <div className="pass__grid">
                <F label="Member No." value={number} gold />
                <F label="Region" value={regionVal} />
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
            <div className="pass__bg" style={{ background: 'linear-gradient(150deg, #141720, #08090e)' }} />
            <div className="pass__edge" />
            <div className="pass__band" />
            <div className="pass__body">
              <div className="pass__head">
                <span className="pass__mark" style={{ color: 'var(--gold)' }}>MEMBER PASS</span>
                <span className="mono" style={{ color: 'rgba(255,255,255,.55)', fontSize: 9.5 }}>{number}</span>
              </div>
              <div className="pass__back">
                <QR value={`uhome:${number}:entry`} size={100} radius={14} />
                <div className="pass__pairs">
                  <F label="Region" value={regionVal} gold />
                  <F label="Member since" value={String(me.since || '')} />
                  <F label="Languages" value={(me.langs || []).join(' · ') || '—'} />
                  <F label="Circle" value={`${stats.circle ?? 0} people`} />
                  <F label="Events" value={stats.events ? `${stats.events} booked` : 'none yet'} gold={!!stats.events} />
                  <F label="Status" value="ACTIVE" gold />
                </div>
              </div>
              <div className="pass__mrzbox">
                <div className="spread">
                  <span className="pass__lbl">Покажите код на входе</span>
                  <span className="pass__lbl">Valid thru 12 / 27</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {hint && !flip && <div className="pass__hint"><Icon name="flip" size={14} />Нажмите на карту — на обороте пропуск</div>}
    </div>
  );
}

function F({ label, value, gold, align }) {
  return (
    <div style={{ minWidth: 0, textAlign: align }}>
      <div className="pass__lbl">{label}</div>
      <div className="pass__val ell" style={gold ? { color: 'var(--gold)' } : undefined}>{value}</div>
    </div>
  );
}
