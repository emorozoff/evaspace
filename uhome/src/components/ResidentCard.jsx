import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { QR, Avatar, Mark, GOLD } from './Art.jsx';
import Icon from './Icons.jsx';
import { guillochePath, mrz, seeded } from '../lib/art.js';
import { translit } from '../lib/format.js';
import { roleEn } from '../data/people.js';
import { REGIONS } from '../data/regions.js';
import Flag from './Flag.jsx';
import { prefersReduced, useScramble } from '../lib/motion.js';

/* Карта резидента — из UPASS: заполнена латиницей, как проездной документ.
   Лицевая сторона — кто это и где сейчас, оборот — пропуск с большим кодом
   для входа на события. Сама медленно качается, доворачивается за пальцем
   (и за наклоном телефона), голографическая плёнка переливается вслед
   за наклоном, переворачивается по нажатию.

   issue — церемония выпуска (после теста): карта поднимается из глубины
   из светящейся линии, луч сканера проходит сверху вниз и «печатает» поля,
   гильош прорисовывается, машиночитаемая зона расшифровывается, падает
   печать ISSUED, карта вздрагивает и успокаивается. skip — досмотреть
   сразу. На главной и в профиле карта спокойная, без церемонии. */

const ISSUE_MS = 3700;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export default function ResidentCard({ me, stats = {}, hint = true, onFlip, issue = false, skip = false, onIssued }) {
  const [flip, setFlip] = useState(false);
  const [stage, setStage] = useState(() => (issue && !prefersReduced() ? 'issue' : 'calm'));
  const scene = useRef(null);
  const card = useRef(null);
  const sheen = useRef(null);
  const holo = useRef(null);
  const flipRef = useRef(false);
  const tilt = useRef({ x: 0, y: 0 });
  const told = useRef(false);
  const applyTilt = useRef(() => {});

  const region = REGIONS[me.region] || {};
  const number = me.number || 'UH-26-0000';
  const nameEn = translit(me.name) || 'RESIDENT';
  const [l1, l2] = mrz(nameEn, number.replace(/-/g, ''));
  const org = (me.company || '').toUpperCase();
  const issuing = stage === 'issue';

  // выпуск: конец церемонии или пропуск по нажатию
  useEffect(() => {
    if (!issuing) return undefined;
    if (skip) {
      setStage('calm');
      return undefined;
    }
    const t = setTimeout(() => setStage('calm'), ISSUE_MS);
    return () => clearTimeout(t);
  }, [issuing, skip]);
  useEffect(() => {
    if (issue && stage === 'calm' && !told.current) {
      told.current = true;
      onIssued?.();
    }
  }, [issue, stage, onIssued]);

  // наклон: палец, мышь или гироскоп → стили напрямую, без перерисовки React
  useEffect(() => {
    const el = scene.current;
    if (!el) return undefined;
    let raf = 0;
    const apply = () => {
      raf = 0;
      const { x, y } = tilt.current;
      if (card.current) card.current.style.transform = flipRef.current ? 'rotateY(180deg)' : `rotateY(${(x * 9).toFixed(2)}deg) rotateX(${(-y * 9).toFixed(2)}deg)`;
      if (sheen.current) sheen.current.style.transform = `translate(${(x * 60).toFixed(1)}px, ${(y * 40).toFixed(1)}px)`;
      if (holo.current) holo.current.style.transform = `translate3d(${(-x * 34).toFixed(1)}%, ${(-y * 22).toFixed(1)}%, 0) rotate(${(x * 30).toFixed(1)}deg)`;
    };
    const set = (x, y) => {
      tilt.current = { x, y };
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
    apply();
    applyTilt.current = apply;
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('deviceorientation', onTilt);
    };
  }, []);

  const onCard = (e) => {
    if (issuing) return; // во время выпуска нажатие ловит экран — и досматривает
    e.stopPropagation?.();
    flipRef.current = !flipRef.current;
    setFlip(flipRef.current);
    applyTilt.current();
    onFlip?.();
  };

  const regionVal = <><Flag cc={region.cc} size={11} style={{ marginRight: 5 }} />{region.en || ''}</>;
  const nameShown = useScramble(nameEn, { delay: 950, speed: 34, run: issuing });
  const numShown = useScramble(number, { delay: 1250, speed: 40, run: issuing });
  const m1 = useScramble(l1, { delay: 1500, speed: 13, run: issuing });
  const m2 = useScramble(l2, { delay: 1900, speed: 13, run: issuing });

  return (
    <div className="pass-scene" ref={scene} data-stage={stage} data-issued={issue ? 'true' : undefined}>
      <div className="pass-stage">
        {issuing && <i className="pass__beam" aria-hidden="true" />}
        {issuing && <i className="pass__shock" aria-hidden="true" />}
        <div className="pass-issue">
          <div className="pass-float">
            <div
              ref={card}
              className={`pass${flip ? ' pass--flip' : ''}`}
              onClick={onCard}
              role="button"
              aria-label="Перевернуть карту резидента"
            >
              {/* ЛИЦЕВАЯ */}
              <div className="pass__face">
                <div className="pass__bg" style={{ background: 'linear-gradient(150deg, #1a1e29 0%, #0e1016 50%, #08090e 100%)' }} />
                <div className="pass__guilloche"><GuillocheArt opacity={0.42} seed={number} size={280} draw={issuing} /></div>
                <div className="pass__guilloche pass__guilloche--spin"><GuillocheArt opacity={0.26} seed={`${number}b`} size={280} draw={issuing} late /></div>
                <div className="pass__edge" />
                <div className="pass__band" />
                <div className="pass__holo"><i ref={holo} /></div>
                <div className="pass__sheen" ref={sheen} />
                {issuing && <div className="pass__scan" />}

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
                      <div className="pass__name ell" style={{ fontSize: nameSize(nameEn) }}>{nameShown || ' '}</div>
                      <div className="pass__role ell">{roleEn(me)}{org ? ` · ${org}` : ''}</div>
                    </div>
                    <QR value={`uhome:${number}`} size={48} radius={10} />
                  </div>

                  <div className="pass__grid">
                    <F label="Member No." value={numShown || ' '} gold mono />
                    <F label="Region" value={regionVal} />
                    <F label="Valid thru" value="12 / 27" align="right" mono />
                  </div>

                  <div className="pass__mrzbox">
                    <div className="pass__mrz">{m1 || ' '}</div>
                    <div className="pass__mrz">{m2 || ' '}</div>
                  </div>
                </div>

                {issue && <Stamp />}
              </div>

              {/* ОБОРОТ */}
              <div className="pass__face pass__face--back">
                <div className="pass__bg" style={{ background: 'linear-gradient(150deg, #141720, #08090e)' }} />
                <div className="pass__guilloche pass__guilloche--back"><GuillocheArt opacity={0.22} seed={`${number}c`} size={300} /></div>
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
      <div className={`pass__val ell${mono ? ' pass__val--mono' : ''}`} style={gold ? { color: 'var(--gold)' } : undefined}>{value}</div>
    </div>
  );
}

/* Гильош карты. Тот же рисунок, что Guilloche в Art.jsx, но умеет
   прорисовываться линией (draw) — во время выпуска. */
function GuillocheArt({ color = GOLD, opacity = 0.3, seed = 1, size = 220, draw = false, late = false }) {
  const rings = useMemo(() => {
    const rnd = seeded('g' + seed);
    return [0, 1, 2].map((i) => ({
      d: guillochePath({ R: 100 - i * 16, r: 17 + Math.floor(rnd() * 9) + i, d: 52 - i * 9, turns: 17 + i * 4, steps: 620 }),
      o: opacity * (1 - i * 0.22),
    }));
  }, [seed, opacity]);
  return (
    <svg viewBox="-110 -110 220 220" width={size} height={size} aria-hidden="true">
      {rings.map((r, i) => (
        <path
          key={i} d={r.d} fill="none" stroke={color} strokeWidth="0.32" strokeOpacity={r.o}
          pathLength={draw ? 1 : undefined}
          className={draw ? 'g-draw' : undefined}
          style={draw ? { animationDelay: `${(late ? 0.9 : 0.35) + i * 0.22}s` } : undefined}
        />
      ))}
    </svg>
  );
}

/* Печать выпуска: круговая надпись, знак клуба и дата. */
function Stamp() {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const d = new Date();
  const date = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(2)}`;
  return (
    <div className="pass__stamp" aria-hidden="true">
      <svg viewBox="-50 -50 100 100" width="78" height="78">
        <defs>
          <path id={`st${id}`} d="M-37 0a37 37 0 1 1 74 0a37 37 0 1 1 -74 0" />
        </defs>
        <circle r="47" className="stamp__o" />
        <circle r="43.5" className="stamp__o stamp__o--thin" />
        <circle r="27" className="stamp__o stamp__o--thin" />
        <text className="stamp__ring"><textPath href={`#st${id}`}>ISSUED · UHOME CLUB · RESIDENT · 2026 ·</textPath></text>
        <text className="stamp__big" y="-2">ISSUED</text>
        <text className="stamp__date" y="10">{date}</text>
      </svg>
    </div>
  );
}
