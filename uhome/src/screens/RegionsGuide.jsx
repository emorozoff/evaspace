import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { REGIONS } from '../data/regions.js';
import { GUIDE_KEYS, METRICS, regionGuide } from '../data/regionsGuide.js';
import { pinOf } from '../data/base.js';
import { localParts, hhmm } from '../lib/time.js';
import { plural } from '../lib/format.js';
import { transition } from '../lib/transition.js';
import { TopBar, Btn, Section, Seg } from '../components/UI.jsx';
import Flag from '../components/Flag.jsx';

/* Регионы клуба: описание и сравнение — второй закреп базы. Пять флагов,
   одна карточка региона и сравнение по одной метрике за раз. */

const PIN = pinOf('regions');
const METRIC = Object.fromEntries(METRICS.map((m) => [m.id, m]));

export default function RegionsGuide() {
  const app = useApp();
  const mine = app.me.region;
  const [sel, setSel] = useState(GUIDE_KEYS.includes(mine) ? mine : GUIDE_KEYS[0]);

  useEffect(() => {
    if (!app.watched.regions) app.watch('regions');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const guides = useMemo(() => Object.fromEntries(GUIDE_KEYS.map((k) => [k, regionGuide(k)])), []);
  const pick = (k) => transition(() => setSel(k));

  return (
    <div className="screen screen--nested">
      <TopBar title="Регионы клуба" sub={`Закреп ${PIN?.n || '02'} · ${PIN?.time || '5 мин'}`} backTo="/base" />

      <div className="stack-24">
        <div className="top" style={{ padding: 0 }}>
          <h1 className="h1">Регионы клуба</h1>
          <div className="top__sub" style={{ marginTop: 0 }}>Пять точек, между которыми живут резиденты: что клуб делает в каждой и чем они отличаются.</div>
        </div>

        <div className="scroller" role="tablist">
          {GUIDE_KEYS.map((k) => (
            <button key={k} role="tab" className={`chip${sel === k ? ' chip--on' : ''}`} onClick={() => pick(k)}>
              <Flag cc={REGIONS[k].cc} size={16} /> {REGIONS[k].name}{k === mine ? ' · вы' : ''}
            </button>
          ))}
        </div>

        <RegionCard key={sel} g={guides[sel]} mine={mine} />

        <Compare guides={guides} mine={mine} sel={sel} onSelect={pick} />

        <div className="note-line">Оценки 1–5 сравнивают регионы между собой. Визы, налоги и цены — ориентир, а не консультация: перед решением детали подтверждает команда клуба.</div>
        <Btn variant="ghost" wide icon="message" onClick={() => go('/chat/team')}>Уточнить у команды</Btn>
      </div>
    </div>
  );
}

/* Пять точек: столько золотых, какова оценка. */
function Dots({ v }) {
  return (
    <span className="b-dots" aria-label={`${v} из 5`}>
      {[1, 2, 3, 4, 5].map((i) => <i key={i} data-on={i <= v} />)}
    </span>
  );
}

function tzLine(key, mine) {
  const now = new Date();
  const o = localParts(REGIONS[key].tz, now).offset;
  const d = (o - localParts(REGIONS[mine].tz, now).offset) / 60;
  const rel = key === mine ? 'вы здесь' : d === 0 ? 'как у вас' : `${d > 0 ? '+' : '−'}${Math.abs(d)} ч от вас`;
  return { rel, time: hhmm(localParts(REGIONS[key].tz, now)) };
}

function RegionCard({ g, mine }) {
  const tz = tzLine(g.key, mine);
  return (
    <div className="card b-region" style={{ viewTransitionName: 'region-card' }}>
      <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
        <span className="disc"><Flag cc={g.cc} size={24} /></span>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="sect__eye">{g.role}</div>
          <div className="h2">{g.name}</div>
          <div className="t-sm dim-2" style={{ marginTop: 4 }}>{g.country}</div>
        </div>
        <div style={{ textAlign: 'right', flex: 'none' }}>
          <div className="figure" style={{ fontSize: 22 }}>{tz.time}</div>
          <div className="t-xs dim-2" style={{ marginTop: 4 }}>{tz.rel}</div>
        </div>
      </div>

      <p style={{ marginTop: 14 }}>{g.does}</p>

      <div className="strip" style={{ marginTop: 16 }}>
        <div><span className="strip__v">{g.stats.residents}</span><span className="strip__k">{plural(g.stats.residents, 'резидент', 'резидента', 'резидентов')}</span></div>
        <div><span className="strip__v">{g.stats.communities}</span><span className="strip__k">{plural(g.stats.communities, 'сообщество', 'сообщества', 'сообществ')}</span></div>
        <div><span className="strip__v">{g.events}</span><span className="strip__k">{plural(g.events, 'событие', 'события', 'событий')}</span></div>
      </div>

      <div className="rows" style={{ marginTop: 16, borderTop: 0 }}>
        <div className="rows__r"><span className="rows__k">Сезон клуба<i>{g.seasonText}</i></span></div>
        {['cost', 'visa', 'biz'].map((id) => (
          <div key={id} className="rows__r">
            <span className="rows__k">{METRIC[id].name}<i>{g[`${id}Text`]}</i></span>
            <span className="rows__v" style={{ display: 'grid', justifyItems: 'end', gap: 6 }}><Dots v={g[id]} /><span className="t-xs dim-2" style={{ fontWeight: 500 }}>{METRIC[id].words[g[id]]}</span></span>
          </div>
        ))}
        <div className="rows__r"><span className="rows__k">Фокус</span><span className="rows__v" style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 500 }}>{g.focus.join(', ')}</span></div>
        <div className="rows__r"><span className="rows__k">Язык</span><span className="rows__v" style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 500 }}>{g.lang}</span></div>
      </div>

      <div className="pair" style={{ marginTop: 16 }}>
        <Btn size="sm" variant="ghost" onClick={() => go(`/community/${g.local?.id}`)}>Сообщество</Btn>
        <Btn size="sm" variant="quiet" onClick={() => go(`/people?tab=list&region=${g.key}`)}>Резиденты</Btn>
      </div>
    </div>
  );
}

/* ——— сравнение ——— */

const names = (keys) => {
  const n = keys.map((k) => REGIONS[k].name);
  return n.length > 1 ? `${n.slice(0, -1).join(', ')} и ${n[n.length - 1]}` : n[0] || '—';
};

function valueOf(metric, g, mine) {
  const now = new Date();
  if (metric.kind === 'scale') return { raw: g[metric.id], node: <Dots v={g[metric.id]} />, word: metric.words[g[metric.id]] };
  if (metric.kind === 'count') return { raw: g.stats.residents, node: String(g.stats.residents), word: `${g.stats.members} ${plural(g.stats.members, 'участник', 'участника', 'участников')} в сообществе` };
  if (metric.kind === 'tz') {
    const d = (localParts(REGIONS[g.key].tz, now).offset - localParts(REGIONS[mine].tz, now).offset) / 60;
    return { raw: Math.abs(d), node: d === 0 ? '0 ч' : `${d > 0 ? '+' : '−'}${Math.abs(d)} ч`, word: hhmm(localParts(REGIONS[g.key].tz, now)) };
  }
  return { raw: g.season.length, node: `${g.season.length} мес`, word: g.seasonText.split(',')[0] };
}

function summary(metric, rows, guides, mine) {
  const by = (fn) => rows.filter(fn).map((r) => r.k);
  const max = Math.max(...rows.map((r) => r.raw));
  const min = Math.min(...rows.map((r) => r.raw));
  switch (metric.id) {
    case 'cost': return `Дешевле всего — ${names(by((r) => r.raw === min))}, дороже — ${names(by((r) => r.raw === max))}.`;
    case 'visa': return `Проще всего — ${names(by((r) => r.raw === max))}, сложнее — ${names(by((r) => r.raw === min))}.`;
    case 'biz': return `Мягче всего — ${names(by((r) => r.raw === max))}, строже — ${names(by((r) => r.raw === min))}.`;
    case 'people': return `Больше всего резидентов — ${names(by((r) => r.raw === max))}, меньше всего — ${names(by((r) => r.raw === min))}.`;
    case 'tz': {
      const others = rows.filter((r) => r.k !== mine);
      const far = Math.max(...others.map((r) => r.raw));
      const near = Math.min(...others.map((r) => r.raw));
      return `Ближе всего к вам по времени — ${names(others.filter((r) => r.raw === near).map((r) => r.k))}, дальше всего — ${names(others.filter((r) => r.raw === far).map((r) => r.k))}.`;
    }
    case 'climate': {
      const winter = GUIDE_KEYS.filter((k) => guides[k].season.includes(1));
      const summer = GUIDE_KEYS.filter((k) => guides[k].season.includes(7));
      return `Зимовка — там, где тепло: ${names(winter)}. Летом клуб собирается в ${names(summer).replace('Москва', 'Москве').replace('Европа', 'Европе')}.`;
    }
    default: return '';
  }
}

function Compare({ guides, mine, sel, onSelect }) {
  const [mid, setMid] = useState('cost');
  const metric = METRICS.find((m) => m.id === mid);
  const rows = GUIDE_KEYS.map((k) => ({ k, ...valueOf(metric, guides[k], mine) }));

  return (
    <Section title="Сравнение" note="Одна метрика — пять регионов">
      <Seg value={mid} onChange={(v) => transition(() => setMid(v))} options={METRICS.map((m) => ({ value: m.id, label: m.chip }))} />
      <div className="t-sm dim-2" style={{ lineHeight: 1.45 }}>{metric.hint}</div>
      <div className="rows" key={mid}>
        {rows.map((r) => (
          <button key={r.k} className="rows__r" style={{ width: '100%' }} data-on={r.k === sel} onClick={() => onSelect(r.k)}>
            <span className="rows__k row" style={{ gap: 8, color: r.k === sel ? 'var(--gold-hi)' : undefined }}><Flag cc={REGIONS[r.k].cc} size={16} /> {REGIONS[r.k].name}{r.k === mine ? <span className="dim-2"> · вы</span> : ''}</span>
            <span className="rows__v" style={{ display: 'grid', justifyItems: 'end', gap: 5 }}>
              <span>{r.node}</span>
              <span className="t-xs dim-2" style={{ fontWeight: 500 }}>{r.word}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="note-line">{summary(metric, rows, guides, mine)}</div>
    </Section>
  );
}
