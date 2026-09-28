import { useEffect, useRef, useState } from 'react';
import { QR, Avatar, Mark, Guilloche } from './Art.jsx';
import Icon from './Icons.jsx';
import { mrz } from '../lib/art.js';
import { translit } from '../lib/format.js';
import { roleEn } from '../data/people.js';
import { REGIONS } from '../data/regions.js';
import Flag from './Flag.jsx';
import { prefersReduced } from '../lib/transition.js';

/* Карта резидента — паспорт из колоды UPASS: тёмная карта с гильошем,
   заполнена латиницей, как проездной документ. Лицевая сторона — кто это
   и где сейчас, оборот — пропуск с большим кодом для входа на события.
   Медленно качается, доворачивается за пальцем и наклоном телефона,
   переворачивается по нажатию.

   issue — выпуск после регистрации: поля печатаются одно за другим,
   гильош проявляется, световая полоса проходит один раз, затем onIssued.
   На главной и в профиле карта спокойная. */

const ISSUE_MS = 1700;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// гильош у всех карт один и тот же — спокойная трёхлепестковая розетка, а не лотерея по номеру
const GUILLOCHE_FRONT = 'uhome-club';
const GUILLOCHE_BACK = 'UHOME';

export default function ResidentCard({ me, stats = {}, hint = true, onFlip, issue = false, onIssued }) {
  const [flip, setFlip] = useState(false);
  const [issuing, setIssuing] = useState(() => issue && !prefersReduced());
  const scene = useRef(null);
  const card = useRef(null);
  const told = useRef(false);
  const issued = useRef(onIssued);
  issued.current = onIssued;

  const region = REGIONS[me.region] || {};
  const number = me.number || 'UH-26-0000';
  const nameEn = translit(me.name) || 'RESIDENT';
  const [l1, l2] = mrz(nameEn, number.replace(/-/g, ''));
  const org = (me.company || '').toUpperCase();

  // выпуск заканчивается сам; сообщаем один раз
  useEffect(() => {
    if (!issue || told.current) return undefined;
    const t = setTimeout(() => {
      told.current = true;
      setIssuing(false);
      issued.current?.();
    }, prefersReduced() ? 0 : ISSUE_MS);
    return () => clearTimeout(t);
  }, [issue]);

  // наклон: палец, мышь или гироскоп → переменные --tx/--ty на карте, без перерисовки React
  useEffect(() => {
    const el = scene.current;
    if (!el) return undefined;
    let raf = 0;
    const t = { x: 0, y: 0 };
    const apply = () => {
      raf = 0;
      const c = card.current;
      if (!c) return;
      c.style.setProperty('--tx', `${(t.x * 9).toFixed(2)}deg`);
      c.style.setProperty('--ty', `${(-t.y * 9).toFixed(2)}deg`);
    };
    const set = (x, y) => {
      t.x = x;
      t.y = y;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      set(clamp((e.clientX - r.left) / r.width - 0.5, -0.5, 0.5), clamp((e.clientY - r.top) / r.height - 0.5, -0.5, 0.5));
    };
    const onLeave = () => set(0, 0);
    const onTilt = (e) => {
      if (e.gamma == null || e.beta == null) return;
      set(clamp(e.gamma / 50, -0.4, 0.4), clamp((e.beta - 50) / 60, -0.4, 0.4));
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    if (!prefersReduced()) window.addEventListener('deviceorientation', onTilt);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('deviceorientation', onTilt);
    };
  }, []);

  const onCard = () => {
    setFlip((v) => !v);
    onFlip?.();
  };

  const regionVal = <><Flag cc={region.cc} size={11} style={{ marginRight: 5 }} />{region.en || ''}</>;

  return (
    /* тень — на сцене, а не на самой карте: filter на .pass сплющивает её 3D-контекст,
       и при перевороте вместо оборота видна зеркальная лицевая сторона */
    <div className={`pass-scene${issuing ? ' o-issue' : ''}`} ref={scene} style={{ filter: 'drop-shadow(0 34px 40px rgba(0, 0, 0, 0.7))' }}>
      <div className="pass-float">
        <div ref={card} className={`pass${flip ? ' pass--flip' : ''}`} style={{ filter: 'none' }} onClick={onCard} role="button" aria-label="Перевернуть карту резидента">
          {/* ЛИЦЕВАЯ */}
          <div className="pass__face">
            <div className="pass__bg" />
            <div className="pass__guilloche" style={{ left: '30%', display: 'grid', placeItems: 'center' }}>
              <Guilloche opacity={0.36} seed={GUILLOCHE_FRONT} size={330} />
            </div>
            <div className="pass__band" />
            <div className="pass__body">
              <div className="pass__head">
                <div className="row" style={{ gap: 8 }}>
                  <Mark size={20} />
                  <span className="pass__mark">UHOME<small>CLUB</small></span>
                </div>
                <span className="pass__tier">Resident</span>
              </div>

              <div className="pass__id">
                <Avatar person={me} size={50} ring="var(--gold)" />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="pass__name ell" style={{ fontSize: nameSize(nameEn) }}>{nameEn}</div>
                  <div className="pass__role ell">{roleEn(me)}{org ? ` · ${org}` : ''}</div>
                </div>
                <QR value={`uhome:${number}`} size={48} radius={10} />
              </div>

              <div className="pass__grid">
                <F label="Member No." value={number} gold mono />
                <F label="Region" value={regionVal} />
                <F label="Valid thru" value="12 / 27" align="right" mono />
              </div>

              <div className="pass__mrzbox">
                <div className="pass__mrz">{l1}</div>
                <div className="pass__mrz">{l2}</div>
              </div>
            </div>
          </div>

          {/* ОБОРОТ */}
          <div className="pass__face pass__face--back">
            <div className="pass__bg" />
            <div className="pass__guilloche" style={{ right: '38%', display: 'grid', placeItems: 'center' }}>
              <Guilloche opacity={0.32} seed={GUILLOCHE_BACK} size={330} />
            </div>
            <div className="pass__band" />
            <div className="pass__body">
              <div className="pass__head">
                <span className="pass__mark">MEMBER PASS</span>
                <span className="pass__tier">{number}</span>
              </div>
              <div className="pass__back">
                <QR value={`uhome:${number}:entry`} size={100} radius={14} />
                <div className="pass__pairs">
                  <F label="Region" value={regionVal} gold />
                  <F label="Member since" value={String(me.since || '')} mono />
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

/* Имя латиницей по длине, и на узком телефоне чуть мельче — чтобы влезало. */
function nameSize(name) {
  const px = name.length > 17 ? 16 : name.length > 13 ? 18 : 20;
  return `min(${px}px, ${(px / 4.1).toFixed(2)}vw)`;
}

function F({ label, value, gold, align, mono }) {
  return (
    <div style={{ minWidth: 0, textAlign: align }}>
      <div className="pass__lbl">{label}</div>
      <div
        className="pass__val ell"
        style={{
          ...(gold ? { color: 'var(--gold)' } : null),
          ...(mono ? { fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: '0.02em' } : null),
        }}
      >
        {value}
      </div>
    </div>
  );
}
