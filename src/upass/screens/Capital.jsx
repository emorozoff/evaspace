import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { Top, List, Item, Btn, Section, Sheet, KV, Chip, Seg, Note } from '../components/UI.jsx';
import { Spark } from '../components/Art.jsx';
import { SceneThumb } from '../components/Scene.jsx';
import Icon from '../components/Icons.jsx';
import { ASSETS, ASSET_KINDS, TREASURY } from '../data/capital.js';
import { locById, CITIES } from '../data/places.js';
import { priceHistory, pyramidCompare, redemption, distributionFor, issueAt } from '../lib/nav.js';
import { usd, usdExact, nf, pct, monthLabel, plural } from '../lib/format.js';

export default function Capital() {
  const app = useApp();
  const { pf, me } = app;
  const [buy, setBuy] = useState(false);
  const [amount, setAmount] = useState(5000);
  const [why, setWhy] = useState(false);
  const [exit, setExit] = useState(false);
  const [tab, setTab] = useState('assets');

  const hist = useMemo(() => priceHistory(), []);
  const prices = hist.map((h) => h.price);
  const now = pf.price;
  const change = (now - prices[0]) / prices[0];
  const share = me.uht / pf.supply;
  const joinedMonths = app.joinedAt ? Math.max(0, Math.round((Date.now() - new Date(app.joinedAt)) / 2.63e9)) : 0;
  const red = redemption(me.uht, now, joinedMonths);
  const dist = distributionFor(me.uht);
  const tokens = issueAt(amount, now);

  return (
    <div className="screen stack-20">
      <Top title="Капитал" sub="UHT — доля в активах кооператива" right={<button className="iconbtn" onClick={() => go('/club')}><Icon name="back" size={18} /></button>} />

      <div className="card card--gold">
        <div className="eyebrow eyebrow--gold">Ваша доля</div>
        <div className="row" style={{ alignItems: 'baseline', gap: 8, marginTop: 6 }}>
          <div className="display" style={{ fontSize: 38 }}>{nf(me.uht, 1)}</div>
          <div className="t-md gold">UHT</div>
        </div>
        <div className="t-sm dim">{usdExact(Math.round(me.uht * now))} · {pct(share, 3)} портфеля</div>
        <div className="row" style={{ gap: 10, marginTop: 14 }}>
          <Btn variant="gold" wide onClick={() => setBuy(true)}>Внести капитал</Btn>
          <Btn variant="quiet" onClick={() => setExit(true)}>Выход</Btn>
        </div>
      </div>

      <div className="card">
        <div className="spread">
          <div>
            <div className="eyebrow">Цена токена</div>
            <div className="display" style={{ fontSize: 28, marginTop: 4 }}>{usdExact(now, 2)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="t-sm" style={{ color: change >= 0 ? 'var(--green)' : 'var(--red)' }}>{change >= 0 ? '+' : ''}{pct(change, 1)} за год</div>
            <div className="t-xs dim-2">{monthLabel(hist[0].m)} → сейчас</div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}><Spark data={prices} h={72} dots /></div>
      </div>

      <Section title="Как считается цена">
        <div className="card" style={{ paddingTop: 2, paddingBottom: 2 }}>
          <KV k="Недвижимость и транспорт" v={usd(pf.assetsValue)} />
          <KV k="Денежные средства" v={usd(pf.cash)} />
          <KV k="Обязательства" v={`− ${usd(pf.liabilities)}`} />
          <KV k="NAV" v={usd(pf.nav)} tone="var(--gold)" />
          <KV k="Токенов в обращении" v={nf(Math.round(pf.supply))} />
          <KV k="Цена = NAV ÷ токены" v={usdExact(now, 2)} tone="var(--gold)" />
        </div>
        <Btn variant="quiet" size="sm" wide onClick={() => setWhy(true)}>Почему не «1000 токенов, потом 900»</Btn>
      </Section>

      <Seg value={tab} onChange={setTab} options={[{ value: 'assets', label: 'Портфель' }, { value: 'flow', label: 'Поток' }, { value: 'dist', label: 'Выплаты' }]} />

      {tab === 'assets' && (
        <List>
          {ASSETS.map((a) => {
            const growth = (a.value - a.cost) / a.cost;
            const loc = a.loc ? locById(a.loc) : null;
            return (
              <Item
                key={a.id}
                lead={a.city ? <SceneThumb city={a.city} size={44} /> : <div className="item__ic"><Icon name={a.kind === 'transport' ? 'car' : 'coin'} size={19} /></div>}
                title={a.name}
                sub={`${ASSET_KINDS[a.kind]}${a.city ? ` · ${CITIES[a.city].name}` : ''} · ${a.note}`}
                subWrap
                meta={<><span className="gold" style={{ fontSize: 13, fontWeight: 700 }}>{usd(a.value)}</span><span style={{ color: growth >= 0 ? 'var(--green)' : 'var(--red)' }}>{growth >= 0 ? '+' : ''}{pct(growth, 1)}</span></>}
                chev={false}
                onClick={loc ? () => go(`/loc/${loc.id}`) : undefined}
              />
            );
          })}
        </List>
      )}

      {tab === 'flow' && (
        <div className="card" style={{ paddingTop: 2, paddingBottom: 2 }}>
          <KV k="Аренда в год" v={usd(pf.rentYear)} />
          <KV k="Эксплуатация" v={`− ${usd(pf.opexYear)}`} />
          <KV k="Чистый поток" v={usd(pf.netYear)} tone="var(--gold)" />
          <KV k={`В фонд выкупа (${pct(TREASURY.buybackShare)})`} v={usd(pf.buybackYear)} tone="var(--cyan)" />
          <KV k="Доходность на активы" v={pct(pf.yieldOnValue, 1)} />
          <KV k="Рост оценки к покупке" v={pct(pf.growth, 1)} tone="var(--green)" />
        </div>
      )}

      {tab === 'dist' && (
        <List>
          {dist.map((d) => (
            <Item key={d.q} icon="coin" title={d.q} sub={`${usdExact(d.perToken, 3)} на токен · ${d.paid ? 'выплачено' : 'к выплате'}`} meta={<span className="gold" style={{ fontSize: 13, fontWeight: 700 }}>{usdExact(Math.round(d.mine))}</span>} chev={false} />
          ))}
        </List>
      )}

      <Note icon="shield">Заёмных денег на первых объектах нет. Переоценка — раз в год независимым оценщиком, отчёты публикуются целиком.</Note>

      <Sheet open={buy} onClose={() => setBuy(false)} title="Внести капитал" sub="Выпуск по текущей цене NAV">
        <div className="stack">
          <div className="wrap">{[1000, 5000, 10000, 25000, 50000].map((v) => <Chip key={v} on={amount === v} onClick={() => setAmount(v)}>{usdExact(v)}</Chip>)}</div>
          <input className="field" type="number" value={amount} min={100} onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))} />
          <div className="card" style={{ paddingTop: 2, paddingBottom: 2 }}>
            <KV k="Цена выпуска" v={`${usdExact(now, 2)} за UHT`} />
            <KV k="Вы получаете" v={`${nf(tokens, 1)} UHT`} tone="var(--gold)" />
            <KV k="Цена после выпуска" v={usdExact(now, 2)} tone="var(--cyan)" />
          </div>
          <Note icon="check">Цена не меняется: деньги и токены входят в одинаковой пропорции. Никто не разбавлен.</Note>
          <Btn variant="gold" wide onClick={() => { app.invest(amount, tokens); setBuy(false); }}>Внести {usdExact(amount)}</Btn>
        </div>
      </Sheet>

      <Sheet open={why} onClose={() => setWhy(false)} title="Две модели выпуска" sub="Критическая точка модели">
        <Pyramid />
      </Sheet>

      <Sheet open={exit} onClose={() => setExit(false)} title="Выход из кооператива" sub="Правила зафиксированы до первого взноса">
        <div className="stack">
          <div className="card" style={{ paddingTop: 2, paddingBottom: 2 }}>
            <KV k="Локап" v={red.canRedeem ? 'пройден' : `ещё ${red.lockLeft} мес.`} tone={red.canRedeem ? 'var(--green)' : 'var(--gold)'} />
            <KV k="Ваша доля" v={`${nf(me.uht, 1)} UHT · ${usdExact(Math.round(red.myValue))}`} />
            <KV k="Фонд выкупа" v={usd(TREASURY.buybackFund)} />
            <KV k="Лимит за квартал" v={`${pct(TREASURY.quarterCapShare)} обращения`} />
            <KV k="Очередь" v={`≈ ${red.queueMonths} ${plural(red.queueMonths, 'месяц', 'месяца', 'месяцев')}`} tone="var(--cyan)" />
          </div>
          <Note icon="shield">Локап 24 месяца, очередь по дате заявки, резерв из 15% аренды и квартальный лимит — чтобы не повторить судьбу клубов, которые не пережили одновременные выходы.</Note>
          <Btn variant="quiet" wide disabled={!red.canRedeem} onClick={() => { app.say('Заявка на выкуп поставлена в очередь'); setExit(false); }}>
            {red.canRedeem ? 'Поставить заявку на выкуп' : `Локап: ещё ${red.lockLeft} мес.`}
          </Btn>
        </div>
      </Sheet>
    </div>
  );
}

function Pyramid() {
  const { honest, fixed } = useMemo(() => pyramidCompare({ rounds: 8 }), []);
  return (
    <div className="stack">
      <div className="t-sm dim" style={{ lineHeight: 1.55 }}>
        «Вход стоит $1 000, но даёт всё меньше токенов» честно ровно в одном случае: если токенов меньше потому, что выросла стоимость активов. Если снижение задано правилом — доходность первых оплачивают взносы последующих.
      </div>
      <div className="card">
        <div className="eyebrow eyebrow--gold">Цена выпуска = NAV на токен</div>
        <div className="stack-8" style={{ marginTop: 10 }}>
          {honest.map((r) => <div key={r.round} className="spread t-xs"><span className="dim">Взнос {r.round}</span><span className="num">{usdExact(r.price, 2)} · {nf(r.tokens, 0)} UHT</span></div>)}
        </div>
        <div className="t-xs cyan" style={{ marginTop: 10 }}>Цена растёт только вместе с активами. Разрыва нет.</div>
      </div>
      <div className="card" style={{ boxShadow: 'inset 0 0 0 1px rgba(255,122,110,.3)' }}>
        <div className="eyebrow" style={{ color: 'var(--red)' }}>Правило 1000 → 900 → 800</div>
        <div className="stack-8" style={{ marginTop: 10 }}>
          {fixed.map((r) => (
            <div key={r.round} className="spread t-xs">
              <span className="dim">Взнос {r.round}</span>
              <span className="num">{usdExact(r.price, 2)} <span className="dim-2">при обеспечении {usdExact(r.backing, 2)}</span>{r.gap > 0.02 && <span style={{ color: 'var(--red)' }}> · +{pct(r.gap, 0)}</span>}</span>
            </div>
          ))}
        </div>
        <div className="t-xs" style={{ marginTop: 10, color: 'var(--red)', lineHeight: 1.5 }}>К восьмому взносу участник платит вдвое больше, чем стоит его доля. Это пирамида независимо от намерений.</div>
      </div>
    </div>
  );
}
