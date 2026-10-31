// 📈 Биржа АСЬКИ (тестовые механизмы UPASS): условный курс аськоина (10 🪙 = $1), курсы валют Банка России,
// график за последние дни, конвертер «как в обменнике» и рынок НФТ (оборот, сделки).
// Купить или вывести аськоины за настоящие деньги пока нельзя — механизм в тесте и лицензируется.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FxInfo } from '../lib/web3.ts';
import { getFx, convert, rubPer } from '../lib/web3.ts';
import { useStore } from '../useStore.ts';

const fmt = (v: number, max = 2) => (Math.abs(v) >= 1000 ? v.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) : v.toLocaleString('ru-RU', { maximumFractionDigits: v < 1 ? 4 : max }));
const ORDER = ['USD', 'EUR', 'CNY', 'AED', 'THB', 'IDR', 'KZT', 'BYN', 'GEL', 'AMD', 'TRY', 'GBP', 'INR'];

// Маленький график в строке курса: одна линия, без осей
function Spark({ pts }: { pts: number[] }) {
  if (pts.length < 2) return <span className="fx-spark empty" />;
  const min = Math.min(...pts), max = Math.max(...pts), k = max - min || 1;
  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${((i / (pts.length - 1)) * 60).toFixed(1)},${(20 - ((v - min) / k) * 18 - 1).toFixed(1)}`).join('');
  return <svg className="fx-spark" viewBox="0 0 60 20" aria-hidden="true"><path d={d} /></svg>;
}

// Большой график курса за дни: линия 2px, сетка бледная, при наведении — точка и подсказка с датой и курсом
function Chart({ fx, code }: { fx: FxInfo; code: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const pts = fx.history.map((h) => ({ date: h.date, v: code === 'ASK' ? (h.rates.USD || 0) * fx.ask.usd : h.rates[code] || 0 })).filter((p) => p.v > 0);
  if (pts.length < 2) return <div className="hint">График появится, когда накопится история курса за несколько дней.</div>;
  const W = 320, H = 140, P = { l: 8, r: 8, t: 12, b: 22 };
  const min = Math.min(...pts.map((p) => p.v)), max = Math.max(...pts.map((p) => p.v)), k = max - min || max * 0.01 || 1;
  const x = (i: number) => P.l + (i / (pts.length - 1)) * (W - P.l - P.r);
  const y = (v: number) => P.t + (1 - (v - min) / k) * (H - P.t - P.b);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const h = hover !== null ? pts[hover] : null;
  const onMove = (ev: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const rel = ((ev.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(pts.length - 1, Math.round(((rel - P.l) / (W - P.l - P.r)) * (pts.length - 1)))));
  };
  return (
    <div className="fx-chart">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Курс ${code} к рублю за ${pts.length} дн.`}
        onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((t) => <line key={t} className="fx-grid" x1={P.l} x2={W - P.r} y1={P.t + t * (H - P.t - P.b)} y2={P.t + t * (H - P.t - P.b)} />)}
        <path className="fx-line" d={d} />
        <text className="fx-axis" x={P.l} y={H - 6}>{pts[0].date.slice(5).split('-').reverse().join('.')}</text>
        <text className="fx-axis" x={W - P.r} y={H - 6} textAnchor="end">{pts[pts.length - 1].date.slice(5).split('-').reverse().join('.')}</text>
        {h && hover !== null && (
          <>
            <line className="fx-cross" x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} />
            <circle className="fx-dot" cx={x(hover)} cy={y(h.v)} r={4.5} />
          </>
        )}
      </svg>
      <div className="fx-tip" aria-live="polite">{h ? `${h.date.split('-').reverse().join('.')}: 1 ${code === 'ASK' ? '🪙' : code} = ${fmt(h.v)} ₽` : `мин ${fmt(min)} ₽ · макс ${fmt(max)} ₽`}</div>
    </div>
  );
}

export function Exchange() {
  const s = useStore();
  const [fx, setFx] = useState<FxInfo | null>(null);
  const [error, setError] = useState('');
  const [amount, setAmount] = useState('100');
  const [from, setFrom] = useState('ASK');
  const [to, setTo] = useState('RUB');
  const [chart, setChart] = useState('USD');
  useEffect(() => { getFx().then(setFx).catch(() => setError('Курсы не загрузились — нет связи.')); }, []);
  const codes = useMemo(() => (fx ? ['ASK', 'RUB', ...ORDER.filter((c) => fx.rates[c])] : []), [fx]);
  if (!fx) return <div className="aska-exchange"><div className="hint">{error || 'Загружаю курсы…'}</div></div>;
  const label = (c: string) => (c === 'ASK' ? '🪙 Аськоин' : `${fx.currencies[c]?.flag || ''} ${c} — ${fx.currencies[c]?.name || c}`);
  const num = Number(String(amount).replace(',', '.')) || 0;
  const result = convert(fx, num, from, to);
  const mine = s.profile?.coins ?? 0;
  const change = (c: string) => (fx.prev && fx.prev[c] ? ((fx.rates[c] - fx.prev[c]) / fx.prev[c]) * 100 : null);
  return (
    <div className="aska-exchange">
      <div className="fx-hero">
        <div className="fx-ask"><span>🪙 1 аськоин</span><b>${fx.ask.usd.toFixed(2)}</b><small>≈ {fmt(fx.ask.rub)} ₽ · 10 🪙 = $1</small></div>
        <div className="fx-mine"><span>У тебя</span><b>{fmt(mine)} 🪙</b><small>≈ ${fmt(mine * fx.ask.usd)} · {fmt(mine * fx.ask.rub, 0)} ₽</small></div>
      </div>
      <div className="groupbox fx-conv">
        <div className="legend">🔄 Конвертер</div>
        <div className="fx-row">
          <input className="field" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, '').slice(0, 14))} aria-label="Сумма" />
          <select className="field" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Из">{codes.map((c) => <option key={c} value={c}>{label(c)}</option>)}</select>
        </div>
        <button type="button" className="btn fx-swap" onClick={() => { setFrom(to); setTo(from); }} aria-label="Поменять местами">⇅</button>
        <div className="fx-row">
          <output className="field fx-out">{fmt(result)}</output>
          <select className="field" value={to} onChange={(e) => setTo(e.target.value)} aria-label="В">{codes.map((c) => <option key={c} value={c}>{label(c)}</option>)}</select>
        </div>
        <div className="fx-quick">{[10, 100, 500, 1000].map((v) => <button key={v} type="button" className="chip" onClick={() => { setAmount(String(v)); setFrom('ASK'); }}>{v} 🪙</button>)}</div>
      </div>
      <div className="groupbox">
        <div className="legend">💱 Курсы к рублю {fx.source === 'cbr' ? `· Банк России, ${fx.date?.split('-').reverse().join('.')}` : '· примерные (нет связи с Банком России)'}</div>
        <div className="fx-table" role="table">
          <button type="button" className={`fx-tr${chart === 'ASK' ? ' on' : ''}`} onClick={() => setChart('ASK')}>
            <span className="fx-c">🪙 ASK</span><span className="fx-n">аськоин</span><Spark pts={fx.history.map((h) => (h.rates.USD || 0) * fx.ask.usd)} /><b>{fmt(fx.ask.rub)} ₽</b><span className="fx-d">—</span>
          </button>
          {ORDER.filter((c) => fx.rates[c]).map((c) => {
            const ch = change(c);
            return (
              <button type="button" key={c} className={`fx-tr${chart === c ? ' on' : ''}`} onClick={() => setChart(c)}>
                <span className="fx-c">{fx.currencies[c]?.flag} {c}</span><span className="fx-n">{fx.currencies[c]?.name}{fx.approx.includes(c) ? ' ≈' : ''}</span>
                <Spark pts={fx.history.map((h) => h.rates[c]).filter(Boolean)} />
                <b>{fmt(rubPer(fx, c))} ₽</b>
                <span className={`fx-d${ch === null ? '' : ch > 0 ? ' up' : ch < 0 ? ' down' : ''}`}>{ch === null ? '—' : `${ch > 0 ? '▲' : ch < 0 ? '▼' : ''}${Math.abs(ch).toFixed(2)}%`}</span>
              </button>
            );
          })}
        </div>
        <Chart fx={fx} code={chart} />
      </div>
      <div className="groupbox">
        <div className="legend">💎 Рынок НФТ</div>
        <div className="fx-stats">
          <div><b>{fmt(fx.market.volume24h)} 🪙</b><small>оборот за сутки</small></div>
          <div><b>{fx.market.trades24h}</b><small>сделок за сутки</small></div>
          <div><b>{fx.market.nfts}</b><small>НФТ в галерее</small></div>
          <div><b>{fx.market.forSale}</b><small>на продаже</small></div>
        </div>
        {fx.market.last.length > 0 && (
          <div className="fx-last">{fx.market.last.map((t, i) => <div key={i} className="row aska-kv"><span>{t.token} «{t.title}» → {t.buyerName}</span><b>{t.price} 🪙</b></div>)}</div>
        )}
        <div className="hint">Всего у людей АСЬКИ: {fmt(fx.coins.total)} 🪙 ≈ ${fmt(fx.coins.total * fx.ask.usd)}</div>
      </div>
      <div className="hint fx-legal">⚠️ Тестовые механизмы UPASS. Курс 10 🪙 = $1 — условный ориентир: купить или вывести аськоины за настоящие деньги пока нельзя, механизм лицензируется. Курсы валют — справочно, не предложение обмена.</div>
    </div>
  );
}
