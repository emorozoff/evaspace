import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { Card, Btn, Section, Sheet, KV, Bar, Chip, Seg } from '../components/UI.jsx';
import { Spark, Ring } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';
import { ASSETS, ASSET_KINDS, TREASURY, DISTRIBUTIONS } from '../data/capital.js';
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
  const yearAgo = prices[0];
  const now = pf.price;
  const change = (now - yearAgo) / yearAgo;

  const myValue = me.uht * now;
  const share = me.uht / pf.supply;
  const joinedMonths = app.joinedAt ? Math.max(0, Math.round((Date.now() - new Date(app.joinedAt)) / 2.63e9)) : 0;
  const red = redemption(me.uht, now, joinedMonths);
  const dist = distributionFor(me.uht);
  const tokens = issueAt(amount, now);

  return (
    <div className="screen stack-22">
      <div>
        <div className="eyebrow">Капитал кооператива</div>
        <h2 className="display" style={{ marginTop: 3 }}>UHT · доля в активах</h2>
      </div>

      <Card variant="gold">
        <div className="eyebrow eyebrow--gold">Ваша доля</div>
        <div className="row" style={{ alignItems: 'baseline', gap: 10, marginTop: 6 }}>
          <div className="display" style={{ fontSize: 38 }}>{nf(me.uht, 1)}</div>
          <div className="t-md gold">UHT</div>
        </div>
        <div className="t-sm dim">{usdExact(Math.round(myValue))} · {pct(share, 3)} портфеля</div>
        <div className="row" style={{ gap: 10, marginTop: 16 }}>
          <Btn variant="gold" wide onClick={() => setBuy(true)}>Внести капитал</Btn>
          <Btn variant="quiet" onClick={() => setExit(true)}>Выход</Btn>
        </div>
      </Card>

      <Card>
        <div className="spread">
          <div>
            <div className="eyebrow">Цена токена</div>
            <div className="display" style={{ fontSize: 28, marginTop: 4 }}>{usdExact(now, 2)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="t-sm" style={{ color: change >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {change >= 0 ? '+' : ''}{pct(change, 1)} за год
            </div>
            <div className="t-xs dim-2">{monthLabel(hist[0].m)} → сейчас</div>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <Spark data={prices} h={82} dots />
        </div>
        <div className="spread t-xs dim-2" style={{ marginTop: 4 }}>
          <span>{usdExact(yearAgo, 2)}</span>
          <span>цена = NAV ÷ токены в обращении</span>
          <span>{usdExact(now, 2)}</span>
        </div>
      </Card>

      <Section eyebrow="Как считается" title="Чистая стоимость активов">
        <Card>
          <KV k="Недвижимость и транспорт" v={usd(pf.assetsValue)} />
          <KV k="Денежные средства" v={usd(pf.cash)} />
          <KV k="Обязательства" v={`− ${usd(pf.liabilities)}`} />
          <KV k="NAV" v={usd(pf.nav)} tone="var(--gold)" />
          <KV k="Токенов в обращении" v={nf(Math.round(pf.supply))} />
          <KV k="Цена выпуска и выкупа" v={usdExact(now, 2)} tone="var(--gold)" />
          <div className="t-xs dim" style={{ marginTop: 12, lineHeight: 1.5 }}>
            Переоценка недвижимости — {TREASURY.valuationPeriod}. Следующая: {TREASURY.nextValuation.replace('-', ' · ')}.
            Между переоценками стоимость держится неизменной, отчёты публикуются целиком.
          </div>
          <Btn variant="quiet" size="sm" wide style={{ marginTop: 12 }} onClick={() => setWhy(true)}>
            Почему не «сначала 1000 токенов, потом 900»
          </Btn>
        </Card>
      </Section>

      <Seg
        value={tab}
        onChange={setTab}
        options={[
          { value: 'assets', label: 'Портфель' },
          { value: 'flow', label: 'Поток' },
          { value: 'dist', label: 'Выплаты' },
        ]}
      />

      {tab === 'assets' && (
        <div className="stack-8">
          {ASSETS.map((a) => {
            const growth = (a.value - a.cost) / a.cost;
            const loc = a.loc ? locById(a.loc) : null;
            return (
              <button
                key={a.id}
                className="card tap"
                style={{ display: 'block', width: '100%', textAlign: 'left' }}
                onClick={() => loc && go(`/loc/${loc.id}`)}
              >
                <div className="spread">
                  <div>
                    <div className="t-md">{a.name}</div>
                    <div className="t-xs dim" style={{ marginTop: 2 }}>
                      {ASSET_KINDS[a.kind]}{a.city ? ` · ${CITIES[a.city].name}` : ''} · с {a.bought.replace('-', '.')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="t-md gold num">{usd(a.value)}</div>
                    <div className="t-xs" style={{ color: growth >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {growth >= 0 ? '+' : ''}{pct(growth, 1)}
                    </div>
                  </div>
                </div>
                <div className="t-xs dim-2" style={{ marginTop: 8, lineHeight: 1.4 }}>{a.note}</div>
                {a.rentYear > 0 && (
                  <div className="row t-xs dim" style={{ marginTop: 8, gap: 14 }}>
                    <span>Аренда {usd(a.rentYear)}/год</span>
                    <span>Эксплуатация {usd(a.opexYear)}/год</span>
                  </div>
                )}
              </button>
            );
          })}
          <Card className="row-t" style={{ gap: 11 }}>
            <Icon name="shield" size={17} color="var(--ink-3)" />
            <div className="t-xs dim">
              Заёмного финансирования на первых объектах нет. Плечо — только после трёх лет
              стабильного потока и по решению общего собрания.
            </div>
          </Card>
        </div>
      )}

      {tab === 'flow' && (
        <Card>
          <KV k="Арендный поток в год" v={usd(pf.rentYear)} />
          <KV k="Эксплуатация" v={`− ${usd(pf.opexYear)}`} />
          <KV k="Чистый поток" v={usd(pf.netYear)} tone="var(--gold)" />
          <KV k="В месяц" v={usd(pf.netMonth)} />
          <KV k={`В фонд выкупа (${pct(TREASURY.buybackShare)} аренды)`} v={usd(pf.buybackYear)} tone="var(--cyan)" />
          <KV k="Доходность на стоимость активов" v={pct(pf.yieldOnValue, 1)} />
          <KV k="Рост оценки к цене покупки" v={pct(pf.growth, 1)} tone="var(--green)" />
          <div className="t-xs dim" style={{ marginTop: 12, lineHeight: 1.5 }}>
            Тариф резидента покрывает эксплуатацию, налоги и отчисление в резерв. Прибыль сверх
            этого увеличивает NAV — то есть стоимость вашей доли.
          </div>
        </Card>
      )}

      {tab === 'dist' && (
        <div className="stack-8">
          {dist.map((d) => (
            <Card key={d.q} className="spread">
              <div>
                <div className="t-md">{d.q}</div>
                <div className="t-xs dim" style={{ marginTop: 2 }}>
                  База {usd(d.base)} · {usdExact(d.perToken, 3)} на токен
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="t-md gold">{usdExact(Math.round(d.mine))}</div>
                <div className="t-xs dim-2">{d.paid ? 'выплачено' : 'к выплате'}</div>
              </div>
            </Card>
          ))}
          <Card className="row-t" style={{ gap: 11 }}>
            <Icon name="coin" size={17} color="var(--gold)" />
            <div className="t-xs dim">
              Распределение считается от чистого потока после эксплуатации и отчисления в резерв
              ликвидности. Держателей — {nf(TREASURY.holders)}.
            </div>
          </Card>
        </div>
      )}

      {/* внесение капитала */}
      <Sheet open={buy} onClose={() => setBuy(false)} eyebrow="Выпуск по текущей цене NAV" title="Внести капитал">
        <div className="stack-16">
          <div className="wrap">
            {[1000, 5000, 10000, 25000, 50000].map((v) => (
              <Chip key={v} on={amount === v} onClick={() => setAmount(v)}>{usdExact(v)}</Chip>
            ))}
          </div>
          <input
            className="field"
            type="number"
            value={amount}
            min={100}
            onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
          />
          <Card>
            <KV k="Цена выпуска" v={`${usdExact(now, 2)} за UHT`} />
            <KV k="Вы получаете" v={`${nf(tokens, 1)} UHT`} tone="var(--gold)" />
            <KV k="Доля после выпуска" v={pct((me.uht + tokens) / (pf.supply + tokens), 3)} />
            <KV k="Цена токена после выпуска" v={usdExact(now, 2)} tone="var(--cyan)" />
            <div className="t-xs dim" style={{ marginTop: 11, lineHeight: 1.5 }}>
              Цена не меняется: деньги и новые токены входят в одинаковой пропорции. Ни один
              участник не разбавлен — это и есть правило «выпуск строго по NAV».
            </div>
          </Card>
          <Btn variant="gold" wide onClick={() => { app.invest(amount, tokens); setBuy(false); }}>
            Внести {usdExact(amount)}
          </Btn>
          <div className="center t-xs dim-2">Демонстрация. Реальный выпуск возможен только после юридической структуры.</div>
        </div>
      </Sheet>

      {/* сравнение моделей */}
      <Sheet open={why} onClose={() => setWhy(false)} eyebrow="Критическая точка модели" title="Две модели выпуска">
        <Pyramid />
      </Sheet>

      {/* выход */}
      <Sheet open={exit} onClose={() => setExit(false)} eyebrow="Правила зафиксированы до первого взноса" title="Выход из кооператива">
        <div className="stack-16">
          <Card>
            <KV k="Локап" v={red.canRedeem ? 'пройден' : `осталось ${red.lockLeft} мес.`} tone={red.canRedeem ? 'var(--green)' : 'var(--gold)'} />
            <KV k="Ваша доля" v={`${nf(me.uht, 1)} UHT · ${usdExact(Math.round(red.myValue))}`} />
            <KV k="Фонд обратного выкупа" v={usd(TREASURY.buybackFund)} />
            <KV k="Лимит выкупа за квартал" v={`${pct(TREASURY.quarterCapShare)} обращения`} />
            <KV k="Уже выкуплено в квартале" v={pct(TREASURY.quarterRedeemed, 1)} />
            <KV k="Очередь сейчас" v={`≈ ${red.queueMonths} ${plural(red.queueMonths, 'месяц', 'месяца', 'месяцев')}`} tone="var(--cyan)" />
          </Card>
          <Card className="row-t" style={{ gap: 11 }}>
            <Icon name="shield" size={17} color="var(--ink-3)" />
            <div className="t-xs dim" style={{ lineHeight: 1.5 }}>
              На этом ломались клубы вроде Exclusive Resorts: активы продаются месяцами, а вернуть
              деньги нужно сразу. Поэтому здесь — локап 24 месяца, очередь по дате заявки,
              резерв ликвидности из 15% аренды и квартальный лимит выкупа.
            </div>
          </Card>
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
    <div className="stack-16">
      <div className="t-sm dim" style={{ lineHeight: 1.55 }}>
        Идея «вход всегда стоит $1 000, но даёт всё меньше токенов» честна ровно в одном случае:
        если токенов меньше потому, что выросла стоимость активов на токен. Если снижение задано
        правилом ради ощущения роста — доходность первых оплачивают взносы последующих.
      </div>

      <Card>
        <div className="eyebrow eyebrow--gold">Цена выпуска = NAV на токен</div>
        <div className="stack-8" style={{ marginTop: 10 }}>
          {honest.map((r) => (
            <div key={r.round} className="spread t-xs">
              <span className="dim">Взнос {r.round}</span>
              <span className="num">{usdExact(r.price, 2)} за токен · {nf(r.tokens, 0)} UHT</span>
            </div>
          ))}
        </div>
        <div className="t-xs cyan" style={{ marginTop: 10 }}>Цена растёт только вместе с активами. Разрыва нет.</div>
      </Card>

      <Card style={{ borderColor: 'rgba(255,122,110,.3)' }}>
        <div className="eyebrow" style={{ color: 'var(--red)' }}>Фиксированное правило 1000 → 900 → 800</div>
        <div className="stack-8" style={{ marginTop: 10 }}>
          {fixed.map((r) => (
            <div key={r.round} className="spread t-xs">
              <span className="dim">Взнос {r.round}</span>
              <span className="num">
                {usdExact(r.price, 2)} <span className="dim-2">при обеспечении {usdExact(r.backing, 2)}</span>
                {r.gap > 0.02 && <span style={{ color: 'var(--red)' }}> · +{pct(r.gap, 0)}</span>}
              </span>
            </div>
          ))}
        </div>
        <div className="t-xs" style={{ marginTop: 10, color: 'var(--red)', lineHeight: 1.5 }}>
          К восьмому взносу участник платит вдвое больше, чем стоит его доля. Это структура
          пирамиды независимо от намерений основателей и наличия реальных вилл на балансе.
        </div>
      </Card>

      <Card className="row-t" style={{ gap: 11 }}>
        <Icon name="check" size={17} color="var(--green)" />
        <div className="t-xs dim">
          Правило, снимающее риск: цена выпуска токена всегда равна текущему NAV на токен,
          рассчитанному независимым оценщиком. Оценка — не эмитентом.
        </div>
      </Card>
    </div>
  );
}
