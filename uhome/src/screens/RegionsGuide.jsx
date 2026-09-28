import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { REGIONS } from '../data/regions.js';
import { GUIDE_KEYS, METRICS, MONTHS_1, regionGuide } from '../data/regionsGuide.js';
import { pinOf } from '../data/base.js';
import { landDots, project, distanceKm } from '../data/world.js';
import { localParts, hhmm } from '../lib/time.js';
import { nf, plural } from '../lib/format.js';
import { TopBar, Btn } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';
import Flag from '../components/Flag.jsx';

/* Регионы клуба: описание и сравнение — второй закреп базы.
   Сверху карта: точки суши, пять узлов и дуги связей от выбранного
   региона. Ниже — карточка региона, которая пересобирается при выборе,
   и сравнение: одна метрика за раз, столбики перетекают между метриками. */

const PIN = pinOf('regions');
const MONTH_NAMES = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

/* Кадр карты: от Майами до Бали, без полюсов. */
const MAP = { W: 720, H: 276, x0: 160, x1: 630, y0: 26, y1: 214 };
const VBW = MAP.x1 - MAP.x0;
const VBH = MAP.y1 - MAP.y0;
const at = (lat, lon) => {
  const p = project(lat, lon);
  return { x: p.x * MAP.W, y: p.y * MAP.H };
};
/* Подпись узла — с той стороны, где ей не тесно. */
const LABEL_SIDE = { moscow: 'r', europe: 'l', dubai: 'b', bali: 'l', miami: 'r' };

export default function RegionsGuide() {
  const app = useApp();
  const mine = app.me.region;
  const [sel, setSel] = useState(GUIDE_KEYS.includes(mine) ? mine : GUIDE_KEYS[0]);

  useEffect(() => {
    if (!app.watched.regions) app.watch('regions');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const guides = useMemo(() => Object.fromEntries(GUIDE_KEYS.map((k) => [k, regionGuide(k)])), []);

  return (
    <div className="screen screen--nested rgd">
      <TopBar title="Регионы клуба" sub="Описание и сравнение · 5 регионов" backTo="/base" />

      <header className="rgd-hero">
        <div className="dct-hero__eye"><span>Закреп {PIN?.n || '02'}</span><span>Текст</span><span>{PIN?.time || '5 мин'}</span></div>
        <h1 className="h1">Регионы клуба</h1>
        <p className="dct-hero__lead">Пять точек, между которыми живут резиденты. Что клуб делает в каждой и чем они отличаются.</p>
      </header>

      <div className="rgd-map-card">
        <DotMap sel={sel} mine={mine} onSelect={setSel} />
        <div className="rgd-tabs" role="tablist">
          {GUIDE_KEYS.map((k) => (
            <button key={k} role="tab" data-on={sel === k} onClick={() => setSel(k)}>
              <Flag cc={REGIONS[k].cc} size={20} />
              <span>{REGIONS[k].name}</span>
              {k === mine && <i className="rgd-tabs__me" aria-label="ваш регион" />}
            </button>
          ))}
        </div>
      </div>

      <RegionCard key={sel} g={guides[sel]} mine={mine} />

      <Compare guides={guides} mine={mine} sel={sel} onSelect={setSel} />

      <div className="dct-add rgd-note">
        <div className="dct-add__k"><Icon name="shield" size={13} /> Ориентир, а не консультация</div>
        <div className="dct-add__t">
          Оценки 1–5 сравнивают регионы между собой. Визы, налоги и цены меняются — перед решением детали подтверждает команда клуба и эксперты-резиденты.
        </div>
        <Btn size="sm" variant="ghost" icon="message" onClick={() => go('/chat/team')}>Уточнить у команды</Btn>
      </div>
    </div>
  );
}

/* ——— карта ——— */

function DotMap({ sel, mine, onSelect }) {
  const dots = useMemo(() => {
    const s = 2.1;
    let d = '';
    for (const [fx, fy] of landDots()) {
      const x = fx * MAP.W;
      const y = fy * MAP.H;
      if (x < MAP.x0 - 4 || x > MAP.x1 + 4 || y < MAP.y0 - 4 || y > MAP.y1 + 4) continue;
      d += `M${(x - s / 2).toFixed(1)} ${(y - s / 2).toFixed(1)}h${s}v${s}h-${s}z`;
    }
    return d;
  }, []);
  const nodes = useMemo(() => GUIDE_KEYS.map((k) => ({ k, ...at(REGIONS[k].lat, REGIONS[k].lon) })), []);
  const from = nodes.find((n) => n.k === sel);
  const now = new Date();

  return (
    <div className="rgd-map">
      <svg viewBox={`${MAP.x0} ${MAP.y0} ${VBW} ${VBH}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs>
          <linearGradient id="rgdArc" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#f0dcb4" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#d9b26b" stopOpacity="0.25" />
          </linearGradient>
        </defs>
        <path d={dots} className="rgd-map__land" />
        <g key={sel}>
          {nodes.filter((n) => n.k !== sel).map((n, i) => {
            const mx = (from.x + n.x) / 2;
            const dist = Math.hypot(n.x - from.x, n.y - from.y);
            const my = (from.y + n.y) / 2 - dist * 0.32;
            return (
              <g key={n.k}>
                <path d={`M${from.x} ${from.y} Q${mx} ${my} ${n.x} ${n.y}`} pathLength="1" className="rgd-arc" style={{ '--i': i }} />
                <path d={`M${from.x} ${from.y} Q${mx} ${my} ${n.x} ${n.y}`} pathLength="1" className="rgd-arc rgd-arc--run" style={{ '--i': i }} />
              </g>
            );
          })}
        </g>
      </svg>
      {nodes.map((n) => {
        const R = REGIONS[n.k];
        const t = hhmm(localParts(R.tz, now));
        return (
          <button
            key={n.k}
            className="rgd-node"
            data-on={n.k === sel}
            data-side={LABEL_SIDE[n.k]}
            style={{ left: `${((n.x - MAP.x0) / VBW) * 100}%`, top: `${((n.y - MAP.y0) / VBH) * 100}%` }}
            onClick={() => onSelect(n.k)}
            aria-label={R.name}
          >
            <span className="rgd-node__dot">{n.k === sel && <i />}</span>
            <span className="rgd-node__l">
              <b>{R.name}{n.k === mine ? ' · вы' : ''}</b>
              <em>{t}</em>
            </span>
          </button>
        );
      })}
      <span className="rgd-map__k">UTC · живое время</span>
    </div>
  );
}

/* ——— карточка региона ——— */

function Meter({ v }) {
  return (
    <span className="rgd-meter" aria-label={`${v} из 5`}>
      {[1, 2, 3, 4, 5].map((i) => <i key={i} data-on={i <= v} style={{ '--i': i }} />)}
    </span>
  );
}

function tzLine(key, mine) {
  const now = new Date();
  const o = localParts(REGIONS[key].tz, now).offset;
  const d = (o - localParts(REGIONS[mine].tz, now).offset) / 60;
  const utc = `UTC${o >= 0 ? '+' : '−'}${Math.abs(o / 60)}`;
  const rel = key === mine ? 'вы здесь' : d === 0 ? 'как у вас' : `${d > 0 ? '+' : '−'}${Math.abs(d)} ч от вас`;
  return { utc, rel, time: hhmm(localParts(REGIONS[key].tz, now)) };
}

function RegionCard({ g, mine }) {
  const tz = tzLine(g.key, mine);
  const METRIC = Object.fromEntries(METRICS.map((m) => [m.id, m]));
  const km = g.key !== mine ? distanceKm(REGIONS[mine], REGIONS[g.key]) : 0;
  return (
    <section className="rgd-card">
      <div className="rgd-card__head">
        <span className="rgd-card__flag"><Flag cc={g.cc} size={38} /></span>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="rgd-card__t">{g.name}</div>
          <div className="rgd-card__c">{g.country}</div>
        </div>
        <div className="rgd-card__time">
          <b>{tz.time}</b>
          <span>{tz.utc} · {tz.rel}</span>
        </div>
      </div>

      <div className="rgd-card__tags">
        <span className="tag tag--gold">{g.role}</span>
        {g.key === mine && <span className="tag tag--sea">ваш регион</span>}
        {km > 0 && <span className="tag tag--line">≈ {nf(Math.round(km / 100) * 100)} км от вас</span>}
      </div>

      <p className="rgd-card__about">{g.does}</p>

      <div className="rgd-card__stats">
        <div><b>{g.stats.members}</b><span>{plural(g.stats.members, 'резидент', 'резидента', 'резидентов')}</span></div>
        <div><b>{g.stats.communities}</b><span>{plural(g.stats.communities, 'сообщество', 'сообщества', 'сообществ')}</span></div>
        <div><b>{g.events}</b><span>{plural(g.events, 'событие', 'события', 'событий')}</span></div>
      </div>

      <div className="rgd-kv">
        <div className="rgd-kv__row">
          <span className="rgd-kv__k">Сезон</span>
          <span className="rgd-kv__v">{g.seasonText}</span>
          <span className="rgd-months rgd-months--sm">{MONTHS_1.map((m, i) => <i key={i} data-on={g.season.includes(i + 1)} title={MONTH_NAMES[i]}>{m}</i>)}</span>
        </div>
        {['cost', 'visa', 'biz'].map((id) => (
          <div key={id} className="rgd-kv__row">
            <span className="rgd-kv__k">{METRIC[id].chip}</span>
            <span className="rgd-kv__v"><Meter v={g[id]} /> {METRIC[id].words[g[id]]}</span>
            <span className="rgd-kv__x">{g[`${id}Text`]}</span>
          </div>
        ))}
        <div className="rgd-kv__row">
          <span className="rgd-kv__k">Фокус</span>
          <span className="rgd-kv__v rgd-kv__tags">{g.focus.map((f) => <span key={f}>{f}</span>)}</span>
        </div>
        <div className="rgd-kv__row">
          <span className="rgd-kv__k">Язык</span>
          <span className="rgd-kv__v">{g.lang}</span>
        </div>
        <div className="rgd-kv__foot">Ориентир · детали подтверждает команда клуба</div>
      </div>

      <div className="pair">
        <Btn size="sm" variant="ghost" icon="users" onClick={() => go(`/community/${g.local?.id}`)}>Сообщество</Btn>
        <Btn size="sm" variant="quiet" icon="search" onClick={() => go(`/people?tab=list&region=${g.key}`)}>Резиденты</Btn>
      </div>
    </section>
  );
}

/* ——— сравнение ——— */

function useInView() {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return undefined;
    }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setSeen(true);
        io.disconnect();
      }
    }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen];
}

const names = (keys) => {
  const n = keys.map((k) => REGIONS[k].name);
  return n.length > 1 ? `${n.slice(0, -1).join(', ')} и ${n[n.length - 1]}` : n[0];
};

/** Для каждой метрики: полоса (left, width в долях дорожки), подпись и значение. */
function rowsFor(metric, guides, mine) {
  const now = new Date();
  const myOff = localParts(REGIONS[mine].tz, now).offset;
  if (metric.kind === 'scale') {
    return GUIDE_KEYS.map((k) => ({ k, l: 0, w: guides[k][metric.id] / 5, v: `${guides[k][metric.id]}/5`, word: metric.words[guides[k][metric.id]], raw: guides[k][metric.id] }));
  }
  if (metric.kind === 'count') {
    const max = Math.max(...GUIDE_KEYS.map((k) => guides[k].stats.members));
    return GUIDE_KEYS.map((k) => {
      const s = guides[k].stats;
      return { k, l: 0, w: s.members / max, v: String(s.members), word: `${s.communities} ${plural(s.communities, 'сообщество', 'сообщества', 'сообществ')}`, raw: s.members };
    });
  }
  if (metric.kind === 'tz') {
    const diffs = GUIDE_KEYS.map((k) => (localParts(REGIONS[k].tz, now).offset - myOff) / 60);
    const R = Math.max(6, ...diffs.map(Math.abs));
    return GUIDE_KEYS.map((k, i) => {
      const d = diffs[i];
      return {
        k, l: (Math.min(0, d) + R) / (2 * R), w: Math.abs(d) / (2 * R), flip: d < 0,
        v: d === 0 ? '0 ч' : `${d > 0 ? '+' : '−'}${Math.abs(d)} ч`,
        word: k === mine ? `вы · ${hhmm(localParts(REGIONS[k].tz, now))}` : hhmm(localParts(REGIONS[k].tz, now)),
        raw: Math.abs(d),
      };
    });
  }
  // климат: полосы нет, есть месяцы
  return GUIDE_KEYS.map((k) => {
    const s = guides[k].season;
    return { k, l: 0, w: 0, v: `${s.length} мес`, word: guides[k].seasonText.split(',')[0], raw: s.length };
  });
}

function summary(metric, rows, guides, mine) {
  const by = (fn) => rows.filter(fn).map((r) => r.k);
  const max = Math.max(...rows.map((r) => r.raw));
  const min = Math.min(...rows.map((r) => r.raw));
  switch (metric.id) {
    case 'cost': return `Дешевле всего — ${names(by((r) => r.raw === min))}, дороже — ${names(by((r) => r.raw === max))}.`;
    case 'visa': return `Проще всего — ${names(by((r) => r.raw === max))}, сложнее — ${names(by((r) => r.raw === min))}.`;
    case 'biz': return `Мягче всего — ${names(by((r) => r.raw === max))}, строже — ${names(by((r) => r.raw === min))}.`;
    case 'people': return `Больше всего резидентов — ${names(by((r) => r.raw === max))}, самое молодое сообщество — ${names(by((r) => r.raw === min))}.`;
    case 'tz': {
      const others = rows.filter((r) => r.k !== mine);
      const far = Math.max(...others.map((r) => r.raw));
      const near = Math.min(...others.map((r) => r.raw));
      return `Ближе всего к вам по времени — ${names(others.filter((r) => r.raw === near).map((r) => r.k))}, дальше всего — ${names(others.filter((r) => r.raw === far).map((r) => r.k))}.`;
    }
    case 'climate': {
      const winter = GUIDE_KEYS.filter((k) => guides[k].season.includes(1));
      const summer = GUIDE_KEYS.filter((k) => guides[k].season.includes(7));
      return `Зимой встречаемся там, где тепло: ${names(winter)}. Летом — ${names(summer)}.`;
    }
    default: return '';
  }
}

/* Полоса — только transform: сдвиг и масштаб от левого края. Отрицательная
   разница по времени рисуется зеркально, чтобы светлый конец был снаружи. */
function barTransform(r, on, centered) {
  if (!on) return `translateX(${centered ? 50 : 0}%) scaleX(0.0001)`;
  const w = Math.max(r.w, 0.0001);
  return r.flip ? `translateX(${(r.l + r.w) * 100}%) scaleX(${-w})` : `translateX(${r.l * 100}%) scaleX(${w})`;
}

function Compare({ guides, mine, sel, onSelect }) {
  const [mid, setMid] = useState('cost');
  const metric = METRICS.find((m) => m.id === mid);
  const rows = rowsFor(metric, guides, mine);
  const [ref, seen] = useInView();
  const months = metric.kind === 'months';

  return (
    <section className="rgd-cmp" ref={ref} data-seen={seen}>
      <div className="sect__head">
        <div style={{ minWidth: 0 }}>
          <div className="sect__title">Сравнение</div>
          <div className="sect__note">Одна метрика — пять регионов</div>
        </div>
        {metric.kind === 'scale' && <span className="rgd-cmp__ori">ориентир</span>}
      </div>

      <div className="rgd-metrics" role="tablist">
        {METRICS.map((m) => (
          <button key={m.id} role="tab" data-on={m.id === mid} onClick={() => setMid(m.id)}>{m.chip}</button>
        ))}
      </div>

      <div className="rgd-board" data-kind={metric.kind}>
        <div className="rgd-board__head">
          <span className="rgd-board__t">{metric.name}</span>
          <span className="rgd-board__h" key={mid}>{metric.hint}</span>
        </div>
        {months && (
          <div className="rgd-row rgd-row--legend" aria-hidden="true">
            <span className="rgd-months">{MONTHS_1.map((m, i) => <i key={i}>{m}</i>)}</span>
          </div>
        )}
        {metric.kind === 'tz' && (
          <div className="rgd-row rgd-row--legend rgd-tzlegend" aria-hidden="true">
            <span>← раньше</span><span>{REGIONS[mine].name} · вы</span><span>позже →</span>
          </div>
        )}
        {rows.map((r, i) => (
          <button key={r.k} className="rgd-row" data-on={r.k === sel} onClick={() => onSelect(r.k)} style={{ '--i': i }}>
            <span className="rgd-row__top">
              <span className="rgd-row__who"><Flag cc={REGIONS[r.k].cc} size={16} /> {REGIONS[r.k].name}</span>
              <span className="rgd-row__val" key={mid}>
                <span className="rgd-row__word">{r.word}</span>
                <b>{r.v}</b>
              </span>
            </span>
            <span className="rgd-row__track" data-tz={metric.kind === 'tz'} data-months={months}>
              <i
                className="rgd-row__bar"
                data-zero={r.w === 0 && !months}
                style={{ transform: barTransform(r, seen && !months, metric.kind === 'tz') }}
              />
              {metric.kind === 'tz' && r.w === 0 && <i className="rgd-row__zero" />}
              <span className="rgd-months rgd-row__months" data-show={months && seen}>
                {MONTHS_1.map((m, j) => <i key={j} data-on={guides[r.k].season.includes(j + 1)} style={{ '--j': j }} />)}
              </span>
            </span>
          </button>
        ))}
        <div className="rgd-board__sum" key={`s${mid}`}>
          <Icon name="spark" size={13} color="var(--gold)" />
          <span>{summary(metric, rows, guides, mine)}</span>
        </div>
      </div>
    </section>
  );
}
