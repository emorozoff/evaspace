import { useLayoutEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import Flag from '../Flag.jsx';
import { PEOPLE, toneOf, firstNameOf } from '../../data/people.js';
import { REGIONS } from '../../data/regions.js';
import { initials } from '../../lib/format.js';
import { flyDot, useCountUp } from '../../lib/motion.js';

/* Живая фигура резидента. Каждый ответ теста — узел, который прилетает
   из нажатой кнопки и встаёт на своё место. Фигура растёт по фазам:
     1–2  ОРБИТА   — тон и сфера на круге вокруг вас;
     3–4  КВАДРАТ  — что ищете (левая грань) и что даёте (правая), обмен;
     5–7  СЕТЬ     — второй квадрат поворачивается в ромб (звезда),
                     интересы и регионы на внешнем кольце, каналы на орбите;
     8    СВЕРКА   — фигура сжимается, вокруг появляются люди клуба,
                     линии тянутся от ваших ответов к их профилям.
   Узлы стоят в полярных координатах: transform: rotate(a) translateX(r)
   rotate(-a). Так при сдвиге слота узел скользит по дуге, а луч из центра
   (rotate(a) translateX(r0) scaleX(len)) идёт за ним без пересчёта.
   Анимируются только transform, opacity и stroke-dashoffset. */

const RAD = Math.PI / 180;
const CORE = 19;
const ORBIT = 62;
const SQ = 84;
const RX = 148;
const RY = 122;
// «камера» отъезжает по мере роста фигуры: крупно орбита, потом квадрат,
// потом вся сеть; в фазе сверки фигура сжимается, вокруг встают люди
const CAM = [1.42, 1.42, 1.42, 1.16, 1.16, 1, 1, 1, 0.6];
const INNER = CAM[8];
const phaseOf = (s) => (s <= 2 ? 1 : s <= 4 ? 2 : s <= 7 ? 3 : 4);

const TONE_SHORT = { business: 'ДЕЛОВОЙ', warm: 'ТЁПЛЫЙ', flirt: 'ФЛИРТ' };
const SPHERE_SHORT = {
  it: 'IT И ПРОДУКТ', finance: 'ФИНАНСЫ', realty: 'НЕДВИЖИМОСТЬ', trade: 'E-COMMERCE',
  services: 'КОНСАЛТИНГ', media: 'МЕДИА', life: 'LIFESTYLE', prod: 'ПРОИЗВОДСТВО',
};
const EX_SHORT = {
  invest: 'ИНВЕСТИЦИИ', partners: 'ПАРТНЁРЫ', clients: 'КЛИЕНТЫ', realty: 'НЕДВИЖИМОСТЬ', relocation: 'ВИЗЫ',
  hiring: 'КОМАНДА', marketing: 'МАРКЕТИНГ', ai: 'AI', law: 'ПРАВО', mentor: 'НАСТАВНИК', kids: 'ДЕТИ', friends: 'ДОСУГ',
};
const FORMAT_SHORT = { coffee: 'КОФЕ 1:1', dinner: 'УЖИНЫ', sport: 'СПОРТ', online: 'ОНЛАЙН', trips: 'РЕТРИТЫ' };
const FORMAT_ANG = [-148, -32, 148, 32, 180];
const PEOPLE_ANG = [-122, 180, 122, -58, 0, 58];

export const PHASES = [
  null,
  ['01', 'ОРБИТА'], ['01', 'ОРБИТА'],
  ['02', 'КВАДРАТ ОБМЕНА'], ['02', 'КВАДРАТ ОБМЕНА'],
  ['03', 'СЕТЬ'], ['03', 'СЕТЬ'], ['03', 'СЕТЬ'],
  ['04', 'СВЕРКА С КЛУБОМ'],
];

const toPolar = (x, y) => ({ a: Math.atan2(y, x) / RAD, r: Math.hypot(x, y) });
const onEllipse = (a, rx = RX, ry = RY) => {
  const t = a * RAD;
  return { a, r: (rx * ry) / Math.hypot(ry * Math.cos(t), rx * Math.sin(t)) };
};
const xy = (n, k = 1) => ({ x: n.r * k * Math.cos(n.a * RAD), y: n.r * k * Math.sin(n.a * RAD) });
const at = (a, r) => `rotate(${a.toFixed(2)}deg) translateX(${r.toFixed(2)}px) rotate(${(-a).toFixed(2)}deg)`;
const spread = (i, n, step) => (i - (n - 1) / 2) * step;

/** Узлы и связи фигуры для ответов `a` на этапе `stage`. */
export function buildFigure(a, stage) {
  const nodes = [];
  const rays = []; // лучи по радиусу: { id, a, r0, r1, step }
  const links = []; // связи между узлами: { id, d, kind, step }

  if (stage >= 1 && a.tone) {
    nodes.push({ id: `t:${a.tone}`, a: -90, r: ORBIT, label: TONE_SHORT[a.tone], side: 'r', major: true, step: 1 });
    rays.push({ id: `rt:${a.tone}`, a: -90, r0: CORE, r1: ORBIT, step: 1 });
  }
  if (stage >= 2 && a.sphere) {
    nodes.push({ id: `s:${a.sphere}`, a: 90, r: ORBIT, label: SPHERE_SHORT[a.sphere], side: 'r', major: true, step: 2 });
    rays.push({ id: `rs:${a.sphere}`, a: 90, r0: CORE, r1: ORBIT, step: 2 });
  }
  const needs = stage >= 3 ? a.needs : [];
  const gives = stage >= 4 ? a.gives : [];
  needs.forEach((id, i) => {
    const p = toPolar(-SQ, spread(i, needs.length, 46));
    p.a = (p.a + 360) % 360;
    nodes.push({ id: `n:${id}`, ...p, label: EX_SHORT[id], side: 'l', step: 3 });
    rays.push({ id: `rn:${id}`, a: p.a, r0: CORE, r1: p.r, step: 3 });
  });
  gives.forEach((id, i) => {
    const p = toPolar(SQ, spread(i, gives.length, 46));
    nodes.push({ id: `g:${id}`, ...p, label: EX_SHORT[id], side: 'r', step: 4 });
    rays.push({ id: `rg:${id}`, a: p.a, r0: CORE, r1: p.r, step: 4 });
  });
  // обмен: i-й запрос ↔ i-й вклад, дуги огибают центр
  for (let i = 0; i < Math.min(needs.length, gives.length); i++) {
    const n = xy(nodes.find((x) => x.id === `n:${needs[i]}`));
    const g = xy(nodes.find((x) => x.id === `g:${gives[i]}`));
    const my = (n.y + g.y) / 2;
    const cy = my === 0 ? 56 : my * 2.3;
    links.push({ id: `x:${needs[i]}:${gives[i]}`, d: `M${n.x.toFixed(1)} ${n.y.toFixed(1)}Q0 ${cy.toFixed(1)} ${g.x.toFixed(1)} ${g.y.toFixed(1)}`, kind: 'x', step: 4 });
  }

  const ring = (list, prefix, base, dir, step, extra) => {
    const out = list.map((id, i) => {
      const p = onEllipse(base + dir * spread(i, list.length, 30));
      const n = { id: `${prefix}:${id}`, ...p, step, ...extra(id) };
      nodes.push(n);
      rays.push({ id: `r${prefix}:${id}`, a: p.a, r0: ORBIT, r1: p.r - (n.cc ? 8 : 3), step, spoke: true });
      return n;
    });
    // соседние узлы кольца — одной дугой по эллипсу
    for (let i = 1; i < out.length; i++) {
      const p = xy(out[i - 1]);
      const q = xy(out[i]);
      links.push({
        id: `${prefix}${i}:${out[i - 1].id}:${out[i].id}`,
        d: `M${p.x.toFixed(1)} ${p.y.toFixed(1)}A${RX} ${RY} 0 0 ${dir > 0 ? 1 : 0} ${q.x.toFixed(1)} ${q.y.toFixed(1)}`,
        kind: prefix === 'r' ? 'route' : 'arc', step,
      });
    }
  };
  if (stage >= 5) ring(a.interests, 'i', -90, 1, 5, (id) => ({ label: id.toUpperCase(), side: 't' }));
  if (stage >= 6) ring(a.regions, 'r', 90, -1, 6, (id) => ({ label: (REGIONS[id]?.name || '').toUpperCase(), cc: REGIONS[id]?.cc, side: 'b' }));
  if (stage >= 7) {
    a.formats.forEach((id, i) => {
      const ang = FORMAT_ANG[i % FORMAT_ANG.length];
      nodes.push({ id: `f:${id}`, a: ang, r: ORBIT, label: FORMAT_SHORT[id], side: Math.abs(ang) > 90 ? 'l' : 'r', small: true, step: 7 });
      rays.push({ id: `rf:${id}`, a: ang, r0: CORE, r1: ORBIT, step: 7 });
    });
  }
  return { nodes, rays, links };
}

/** Сколько совпадений с резидентами дают ответы, открытые к этапу. */
export function overlapCount(a, stage) {
  let n = 0;
  for (const p of PEOPLE) {
    if (stage >= 2 && a.sphere && p.sphere === a.sphere) n += 1;
    if (stage >= 3) n += a.needs.filter((x) => (p.gives || []).includes(x)).length;
    if (stage >= 4) n += a.gives.filter((x) => (p.needs || []).includes(x)).length;
    if (stage >= 5) n += a.interests.filter((x) => (p.interests || []).includes(x)).length;
    if (stage >= 6 && a.regions.includes(p.region)) n += 1;
  }
  return n;
}

/** Итог фигуры по ответам резидента — для паспорта и профиля. */
export function figureStats(a) {
  const f = buildFigure(a, 7);
  return { nodes: 1 + f.nodes.length, links: f.rays.length + f.links.length, overlaps: overlapCount(a, 7) };
}

/** Люди вокруг фигуры в фазе сверки. Каждый связан линией с тем вашим
 *  ответом, который совпал с его профилем (ближайшим к нему), — так видно,
 *  через что вы связаны. Нет совпадений — линия идёт к центру. */
function peopleLayout(people, fig) {
  const byId = new Map(fig.nodes.map((n) => [n.id, n]));
  return people.slice(0, PEOPLE_ANG.length).map((x, i) => {
    const pos = onEllipse(PEOPLE_ANG[i], 160, 150);
    const p = xy(pos);
    const m = x.m || {};
    const hits = [
      ...(m.toMe || []).map((k) => `n:${k}`),
      ...(m.fromMe || []).map((k) => `g:${k}`),
      ...(m.hobbies || []).map((k) => `i:${k}`),
      `r:${x.p.region}`,
      `s:${x.p.sphere}`,
    ].filter((id) => byId.has(id));
    const dist = (id) => {
      const q = xy(byId.get(id), INNER);
      return Math.hypot(q.x - p.x, q.y - p.y);
    };
    const best = hits.sort((u, v) => dist(u) - dist(v))[0];
    return { ...x, pos, hits: [best || 'core'] };
  });
}

export default function Constellation({ a, stage, me, spark, people, collapse = false }) {
  const svgRef = useRef(null);
  const layerRef = useRef(null);
  const born = useRef(new Map());
  const prevStage = useRef(stage);
  const analyze = stage >= 8;

  const fig = useMemo(() => buildFigure(a, Math.min(stage, 7)), [a, stage]);
  const crowd = useMemo(() => (analyze && people ? peopleLayout(people, fig) : []), [analyze, people, fig]);

  // задержка появления узла фиксируется при первом рендере: прилетевший
  // из кнопки ждёт точку, новые узлы шага выходят по очереди
  const entering = stage !== prevStage.current && stage > prevStage.current;
  let k = 0;
  const alive = new Set();
  for (const n of fig.nodes) {
    alive.add(n.id);
    if (!born.current.has(n.id)) {
      const tapped = spark && spark.node === n.id && Date.now() - spark.k < 500;
      born.current.set(n.id, tapped ? 0.5 : entering || n.step === stage ? 0.35 + k++ * 0.12 : 0);
    }
  }
  for (const id of [...born.current.keys()]) if (!alive.has(id)) born.current.delete(id);
  useLayoutEffect(() => {
    prevStage.current = stage;
  }, [stage]);

  // полёт точки из нажатой кнопки в узел
  useLayoutEffect(() => {
    if (!spark || !svgRef.current) return;
    const n = fig.nodes.find((x) => x.id === spark.node);
    if (!n) return;
    const svg = svgRef.current;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const p = xy(n, CAM[Math.min(stage, 8)]);
    const pt = svg.createSVGPoint();
    pt.x = p.x;
    pt.y = p.y;
    const s = pt.matrixTransform(ctm);
    flyDot(layerRef.current, { x: spark.x, y: spark.y }, { x: s.x, y: s.y });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spark?.k]);

  const nodeCount = 1 + fig.nodes.length + crowd.length;
  const linkCount = fig.rays.length + fig.links.length + crowd.reduce((s, x) => s + x.hits.length, 0);
  const overlaps = overlapCount(a, Math.min(stage, 7));
  const cam = CAM[Math.min(stage, 8)];
  const ph = PHASES[Math.min(stage, 8)] || PHASES[1];
  const ini = initials(me?.name) || 'ВЫ';

  const nodePos = (id) => {
    if (id === 'core') return { x: 0, y: 0 };
    const n = fig.nodes.find((x) => x.id === id);
    return n ? xy(n, INNER) : { x: 0, y: 0 };
  };

  return (
    <div className={`cst${analyze ? ' cst--analyze' : ''}${collapse ? ' cst--collapse' : ''}`} data-stage={stage}>
      <div className="cst__fig">
        <svg ref={svgRef} className="cst__svg" viewBox="-180 -150 360 300" aria-hidden="true">
          <defs>
            <radialGradient id="cstGlow">
              <stop offset="0%" stopColor="#d9b26b" stopOpacity=".42" />
              <stop offset="55%" stopColor="#d9b26b" stopOpacity=".08" />
              <stop offset="100%" stopColor="#d9b26b" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* рамка прибора: перекрестье, уголки, фаза сборки; в фазе сверки рамка раздвигается */}
          <path className="cst__guide" d="M-176 0H-40M40 0H176M0 -146V-40M0 40V146" />
          <g className="cst__top">
            <path className="cst__corner" d="M-176 -134v-12h12M176 -134v-12h-12" />
            <text className="cst__pht" x="-166" y="-133" key={ph[1]}><tspan className="cst__phk">ФАЗА {ph[0]}</tspan> · {ph[1]}</text>
            <circle className="cst__lvd" cx="120" cy="-136.2" r="2.3" />
            <text className="cst__pht cst__pht--r" x="166" y="-133">{analyze ? 'СВЕРКА' : 'СБОРКА'}</text>
          </g>
          <path className="cst__corner cst__corner--b" d="M-176 134v12h12M176 134v12h-12" />

          <g className="cst__inner" style={{ transform: collapse ? 'scale(0) rotate(90deg)' : `scale(${cam}) rotate(0deg)` }}>
            {/* каркас */}
            <circle className="cst__dots" r="104" data-on={stage >= 1} />
            <ellipse className="cst__ring" rx={RX} ry={RY} pathLength="1" data-on={stage >= 5} />
            <ellipse className="cst__ticks" rx={RX} ry={RY} data-on={stage >= 6} />
            <rect className="cst__sq" x={-SQ} y={-SQ} width={SQ * 2} height={SQ * 2} pathLength="1" data-on={stage >= 3} />
            <rect
              className="cst__sq cst__sq--2" x={-SQ} y={-SQ} width={SQ * 2} height={SQ * 2} pathLength="1" data-on={stage >= 5}
              style={{ transform: stage >= 5 ? 'rotate(45deg)' : 'rotate(0deg)' }}
            />
            <circle className="cst__orbit" r={ORBIT} pathLength="1" data-on={stage >= 1} />
            <circle className="cst__orbit-d" r={ORBIT} data-on={stage >= 2} />

            {/* лучи из центра и спицы от орбиты */}
            {fig.rays.map((r) => (
              <line
                key={r.id} x1="0" y1="0" x2="1" y2="0" vectorEffect="non-scaling-stroke"
                className={`cst__ray${r.step === stage ? ' is-now' : ''}${r.spoke ? ' cst__ray--spoke' : ''}`}
                style={{
                  '--a': `${r.a}deg`, '--r0': `${r.r0}px`,
                  transform: `rotate(${r.a.toFixed(2)}deg) translateX(${r.r0}px) scaleX(${(r.r1 - r.r0).toFixed(2)})`,
                  animationDelay: `${(born.current.get(r.id.slice(1)) || 0) + 0.1}s`,
                }}
              />
            ))}

            {/* данные бегут от свежих ответов к центру */}
            {!analyze && fig.rays.filter((r) => r.step === stage).map((r, i) => (
              <circle
                key={`pk${r.id}`} r="1.7" className="cst__pk"
                style={{ '--a': `${r.a}deg`, '--r0': `${r.r0}px`, '--r1': `${r.r1}px`, animationDelay: `${1.1 + i * 0.37}s` }}
              />
            ))}

            {/* связи между ответами */}
            {fig.links.map((l) => (
              <path key={l.id + l.d} d={l.d} pathLength="1" className={`cst__link cst__link--${l.kind}${l.step === stage ? ' is-now' : ''}`} />
            ))}

            {/* узлы-ответы */}
            {fig.nodes.map((n) => {
              const now = n.step === stage;
              const show = !analyze && (now || n.major || phaseOf(n.step) === phaseOf(stage));
              const lx = n.side === 'l' ? -9 : n.side === 'r' ? 9 : 0;
              const ly = n.side === 't' ? -10 : n.side === 'b' ? 18 : 3;
              const anchor = n.side === 'l' ? 'end' : n.side === 'r' ? 'start' : 'middle';
              return (
                <g key={n.id} className="cst__n" style={{ transform: at(n.a, n.r) }}>
                  <g className={`cst__nb${now ? ' is-now' : ''}`} style={{ animationDelay: `${born.current.get(n.id) || 0}s` }}>
                    {now && <circle className="cst__halo" r="9" />}
                    {n.cc ? (
                      <g transform="translate(-7 -7)"><Flag cc={n.cc} size={14} /></g>
                    ) : n.major ? (
                      <>
                        <circle className="cst__mring" r="8" />
                        <circle className="cst__dot" r="4" />
                      </>
                    ) : (
                      <rect className="cst__dot" x={n.small ? -2.6 : -3.2} y={n.small ? -2.6 : -3.2} width={n.small ? 5.2 : 6.4} height={n.small ? 5.2 : 6.4} rx={n.small ? 0.6 : 3.2} transform={n.small ? 'rotate(45)' : undefined} />
                    )}
                    <text className={`cst__lbl${show ? ' is-on' : ''}${now ? ' is-now' : ''}`} x={lx} y={ly} textAnchor={anchor}>{n.label}</text>
                  </g>
                </g>
              );
            })}
          </g>

          {/* люди клуба вокруг фигуры */}
          {crowd.map((x, i) => {
            const d0 = 0.7 + i * 0.26;
            const p = xy(x.pos);
            return (
              <g key={x.p.id}>
                {x.hits.map((h) => {
                  const q = nodePos(h);
                  return (
                    <path
                      key={h} className="cst__plink" pathLength="1" style={{ animationDelay: `${d0 + 0.2}s` }}
                      d={`M${q.x.toFixed(1)} ${q.y.toFixed(1)}L${p.x.toFixed(1)} ${p.y.toFixed(1)}`}
                    />
                  );
                })}
                <g className="cst__n cst__n--p" style={{ transform: at(x.pos.a, collapse ? 0 : x.pos.r) }}>
                  <g className="cst__nb cst__nb--p" style={{ animationDelay: `${d0}s` }}>
                    <circle className="cst__pdisk" r="14.5" style={{ stroke: toneOf(x.p) }} />
                    <text className="cst__pini" y="3.4" style={{ fill: toneOf(x.p) }}>{initials(x.p.name)}</text>
                    <text className="cst__pname" y="-20">{firstNameOf(x.p).toUpperCase()}</text>
                    <Pct value={x.pct} delay={(d0 + 0.3) * 1000} />
                  </g>
                </g>
              </g>
            );
          })}

          {/* луч-сканер проходит круг при смене фазы — фигура перестраивается */}
          {!collapse && (
            <g className="cst__sweep" key={`sw${phaseOf(stage)}`}>
              <path className="cst__sweep-w" d="M0 0L150 0A150 150 0 0 0 136 -63.4Z" />
              <path className="cst__sweep-l" d="M0 0L150 0" />
            </g>
          )}

          {/* центр — вы */}
          <g className="cst__core">
            <circle r="34" fill="url(#cstGlow)" className="cst__glow" />
            <circle className="cst__core-r" r="26" />
            <circle className="cst__pulse" r={CORE} />
            <circle className="cst__disk" r={CORE} />
            <text className="cst__ini" y="3.6">{ini}</text>
          </g>
        </svg>
      </div>

      <div className="cst__hud">
        <Counter label="Узлов" value={nodeCount} />
        <Counter label="Связей" value={linkCount} />
        <Counter label="Совпадений" value={overlaps} dash={stage < 2} gold />
      </div>
      {createPortal(<div className="o-flylayer" ref={layerRef} />, document.body)}
    </div>
  );
}

function Counter({ label, value, dash, gold }) {
  const v = useCountUp(value, { ms: 650 });
  return (
    <div className="cst__cnt">
      <span className="cst__cl">{label}</span>
      <span className={`cst__cv${gold ? ' is-gold' : ''}`}>{dash ? '—' : String(v).padStart(2, '0')}</span>
    </div>
  );
}

function Pct({ value, delay }) {
  const v = useCountUp(value, { ms: 900, delay, from: 0 });
  return <text className="cst__ppct" y="28">{v}%</text>;
}
