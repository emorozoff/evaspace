// «Номера»: коллекционные номера — как NFT внутри АСЬКИ. Мои номера (основной, улучшить, продать),
// витрина популярных номеров, рынок (что продают другие) и «подобрать свой» — страна, город, цифры.
import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useStore } from '../useStore.ts';
import { myPlates, plateMarket, plateCard, quotePlate, buyPlate, activatePlate, upgradePlate, listPlate } from '../lib/store.ts';
import type { MyPlates, PlateInfo, Quote } from '../lib/store.ts';
import { ApiError } from '../lib/api.ts';
import { Dialog } from './Win.tsx';
import { Plate, RARITY_CLASS } from './Plate.tsx';

type Tab = 'mine' | 'showcase' | 'market' | 'pick';

const ERR: Record<string, string> = {
  no_coins: 'Не хватает аськоинов 🪙',
  gold_only: 'Золотая серия АМР — только у голд (админов).',
  plate_taken: 'Этот номер уже занят.',
  bad_plate: 'Такого номера не бывает — проверь буквы и цифры.',
  not_for_sale: 'Этот номер уже не продаётся.',
  active_plate: 'Основной номер продать нельзя — сначала сделай основным другой.',
  bad_price: 'Цена — целое число аськоинов.',
  max_level: 'Номер уже улучшен до предела 💎',
  too_many: 'Слишком часто. Подожди немного.',
};
const errText = (e: unknown) => (e instanceof ApiError && ERR[e.code]) || 'Не получилось. Проверь интернет.';
const fmtDate = (t: number) => new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

function Rarity({ r, name }: { r: number; name: string }) {
  return <span className={`aska-rarity ${RARITY_CLASS[r] || 'common'}`}>{name}</span>;
}

function PlateTile({ p, children, onOpen }: { p: PlateInfo; children?: ReactNode; onOpen: () => void }) {
  return (
    <div className="aska-ptile" onClick={onOpen}>
      <div className="pt-plate"><Plate plate={p.code} country={p.country} level={p.level} size="m" /></div>
      <div className="pt-meta">
        <span className="pt-token">{p.token}</span>
        <Rarity r={p.rarity} name={p.rarityName} />
        {p.level > 0 && <span className="aska-lvl">{p.levelName}</span>}
        <span className="pt-city">{p.countryName}{p.city ? ` · ${p.city}` : ''}</span>
      </div>
      {children && <div className="pt-actions" onClick={(e) => e.stopPropagation()}>{children}</div>}
    </div>
  );
}

export function Plates() {
  const s = useStore();
  const [tab, setTab] = useState<Tab>('mine');
  const [mine, setMine] = useState<MyPlates | null>(null);
  const [market, setMarket] = useState<{ showcase: PlateInfo[]; listings: PlateInfo[] } | null>(null);
  const [card, setCard] = useState<number | null>(null);
  const [selling, setSelling] = useState<PlateInfo | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const load = async () => {
    try {
      const [m, k] = await Promise.all([myPlates(), plateMarket()]);
      setMine(m);
      setMarket(k);
    } catch { setError('Не получилось загрузить номера. Проверь интернет.'); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    setError('');
    setNote('');
    try { await fn(); await load(); if (ok) setNote(ok); } catch (e) { setError(errText(e)); } finally { setBusy(false); }
  };

  const coins = mine?.coins ?? s.profile?.coins ?? 0;

  return (
    <>
      <div className="aska-wallet">
        <span className="coins">🪙 <b>{coins}</b> аськоинов</span>
        <span className="hint">+{mine?.bonuses.daily ?? 20} за вход каждый день · +{mine?.bonuses.invite ?? 50} за друга · +{mine?.bonuses.guess ?? 15} за угаданного ИИ</span>
      </div>
      <div className="hint aska-lead">Номера здесь коллекционные — как NFT внутри АСЬКИ: у каждого свой токен, редкость и история владельцев. Покупай, улучшай и продавай за аськоины.</div>
      <div className="chips aska-subtabs">
        {([['mine', 'Мои'], ['showcase', 'Витрина'], ['market', 'Рынок'], ['pick', 'Подобрать']] as [Tab, string][]).map(([t, name]) => (
          <button key={t} className={`chip${tab === t ? ' on' : ''}`} onClick={() => { setTab(t); setError(''); setNote(''); }}>{name}</button>
        ))}
      </div>
      {error && <div className="err">{error}</div>}
      {note && <div className="aska-note">{note}</div>}
      {!mine && !error && <div className="hint">Загружаю…</div>}

      {tab === 'mine' && mine && (
        <div className="aska-ptiles">
          {mine.plates.map((p) => {
            const active = p.id === mine.activeId;
            return (
              <PlateTile key={p.id} p={p} onOpen={() => setCard(p.id)}>
                {active ? <span className="aska-active">✓ основной</span> : <button className="btn" disabled={busy} onClick={() => act(() => activatePlate(p.id), 'Теперь это твой основной номер 🚗')}>Сделать основным</button>}
                {p.nextLevelCost !== null && (
                  <button className="btn" disabled={busy || coins < p.nextLevelCost} onClick={() => act(() => upgradePlate(p.id), 'Номер улучшен ✨')}>
                    ✨ {mine.levels[p.level + 1]?.name} — {p.nextLevelCost} 🪙
                  </button>
                )}
                {!active && (p.price !== null
                  ? <button className="btn" disabled={busy} onClick={() => act(() => listPlate(p.id, null), 'Снят с продажи')}>Снять с продажи ({p.price} 🪙)</button>
                  : <button className="btn" disabled={busy} onClick={() => setSelling(p)}>Продать</button>)}
              </PlateTile>
            );
          })}
          {!mine.plates.length && <div className="hint">Пока нет номеров.</div>}
        </div>
      )}

      {tab === 'showcase' && market && (
        <div className="aska-ptiles">
          {market.showcase.map((p) => (
            <PlateTile key={p.id} p={p} onOpen={() => setCard(p.id)}>
              <button className="btn primary" disabled={busy || coins < (p.price || 0)} onClick={() => act(() => buyPlate({ plateId: p.id }), `Номер ${p.text} твой! Сделай его основным во вкладке «Мои»`)}>Купить — {p.price} 🪙</button>
            </PlateTile>
          ))}
          {!market.showcase.length && <div className="hint">Витрину уже раскупили 🙂 Загляни на «Рынок» или подбери свой.</div>}
        </div>
      )}

      {tab === 'market' && market && (
        <div className="aska-ptiles">
          {market.listings.map((p) => (
            <PlateTile key={p.id} p={p} onOpen={() => setCard(p.id)}>
              <span className="hint">продаёт {p.ownerName}</span>
              <button className="btn primary" disabled={busy || coins < (p.price || 0)} onClick={() => act(() => buyPlate({ plateId: p.id }), `Номер ${p.text} твой!`)}>Купить — {p.price} 🪙</button>
            </PlateTile>
          ))}
          {!market.listings.length && <div className="hint">Пока никто ничего не продаёт. Выстави свой номер во вкладке «Мои».</div>}
        </div>
      )}

      {tab === 'pick' && mine && <Pick mine={mine} coins={coins} onBought={(msg) => { load(); setNote(msg); setTab('mine'); }} />}

      {mine && mine.log.length > 0 && (
        <details className="groupbox aska-coinlog">
          <summary className="legend">История аськоинов</summary>
          {mine.log.map((l, i) => <div key={i} className="row"><span className={l.delta > 0 ? 'plus' : 'minus'}>{l.delta > 0 ? `+${l.delta}` : l.delta}</span><span className="sp">{l.reason}</span></div>)}
        </details>
      )}

      {card !== null && <PlateCard id={card} onClose={() => { setCard(null); load(); }} />}
      {selling && <SellDialog plate={selling} onClose={() => setSelling(null)} onDone={() => { setSelling(null); load(); setNote('Номер выставлен на рынок 🏷'); }} />}
    </>
  );
}

function Pick({ mine, coins, onBought }: { mine: MyPlates; coins: number; onBought: (msg: string) => void }) {
  const [country, setCountry] = useState('RU');
  const c = mine.countries.find((x) => x.id === country) || mine.countries[0];
  const [region, setRegion] = useState(c.regions[0]?.code ?? '');
  const [code, setCode] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const cities = [...new Map(c.regions.map((r) => [r.city, r])).values()];
  const cityCodes = c.regions.filter((r) => r.city === c.regions.find((x) => x.code === region)?.city);
  const examples: Record<string, string> = { RU: 'например, В 777 ОР или 123', BY: 'например, 7777 AA', KZ: 'например, 777 AAA', AM: 'например, 77 AA 777', GE: 'например, AA-777-AA', DE: 'например, B AA 777', US: 'например, 7AAA777', AE: 'например, A 777', GB: 'например, LA77 AAA' };

  async function check(e?: FormEvent, random = false) {
    e?.preventDefault();
    setError('');
    setBusy(true);
    try { setQuote(await quotePlate({ country, region, code: random ? undefined : code.trim() || undefined })); } catch (err) { setError(errText(err)); setQuote(null); } finally { setBusy(false); }
  }
  async function buy() {
    if (!quote) return;
    setBusy(true);
    setError('');
    try {
      await buyPlate({ country: quote.country, region: quote.region, code: quote.code, activate: true });
      onBought(`Номер ${quote.text} твой и уже основной 🚗`);
    } catch (err) { setError(errText(err)); setBusy(false); }
  }

  return (
    <form className="groupbox col" onSubmit={check}>
      <div className="legend">Подобрать свой номер</div>
      <label className="aska-field"><span className="lbl">Страна</span>
        <select className="field" value={country} onChange={(e) => { const id = e.target.value; setCountry(id); setRegion(mine.countries.find((x) => x.id === id)?.regions[0]?.code ?? ''); setQuote(null); }}>
          {mine.countries.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </label>
      {cities.length > 1 && (
        <label className="aska-field"><span className="lbl">Город</span>
          <select className="field" value={c.regions.find((r) => r.code === region)?.city} onChange={(e) => { setRegion(c.regions.find((r) => r.city === e.target.value)?.code ?? ''); setQuote(null); }}>
            {cities.map((r) => <option key={r.city} value={r.city}>{r.city}</option>)}
          </select>
        </label>
      )}
      {cityCodes.length > 1 && (
        <label className="aska-field"><span className="lbl">Код региона</span>
          <select className="field" value={region} onChange={(e) => { setRegion(e.target.value); setQuote(null); }}>
            {cityCodes.map((r) => <option key={r.code} value={r.code}>{r.code}</option>)}
          </select>
        </label>
      )}
      <label className="aska-field"><span className="lbl">Буквы и цифры (можно пусто — подберу сам)</span>
        <input className="field" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setQuote(null); }} placeholder={examples[country]} autoCapitalize="characters" autoCorrect="off" spellCheck={false} />
      </label>
      <div className="row">
        <button type="button" className="btn" disabled={busy} onClick={() => check(undefined, true)}>🎲 Случайный</button>
        <span className="sp" />
        <button className="btn primary" disabled={busy}>Проверить</button>
      </div>
      {error && <div className="err">{error}</div>}
      {quote && (
        <div className="aska-quote-card">
          <Plate plate={quote.code} country={quote.country} size="l" />
          <div className="row"><Rarity r={quote.rarity} name={quote.rarityName} /><span className="sp" /><b>{quote.price} 🪙</b></div>
          {!quote.free && <div className="err">Этот номер уже занят — попробуй другие цифры.</div>}
          {quote.free && !quote.allowed && <div className="err">Золотая серия АМР — только у голд (админов).</div>}
          {quote.free && quote.allowed && (
            <button type="button" className="btn primary aska-wide" disabled={busy || coins < quote.price} onClick={buy}>
              {coins < quote.price ? `Не хватает ${quote.price - coins} 🪙` : `Купить за ${quote.price} 🪙 и сделать основным`}
            </button>
          )}
        </div>
      )}
      <div className="hint">Чем красивее номер, тем он дороже: одинаковые цифры (111), 001, 007, 777, «зеркальные» (121) и одинаковые буквы ценятся выше.</div>
    </form>
  );
}

function SellDialog({ plate, onClose, onDone }: { plate: PlateInfo; onClose: () => void; onDone: () => void }) {
  const [price, setPrice] = useState(String(Math.max(plate.rarity >= 2 ? 300 : 60, 50)));
  const [error, setError] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    const n = parseInt(price, 10);
    if (!n || n < 1) return setError('Укажи цену в аськоинах.');
    try { await listPlate(plate.id, n); onDone(); } catch (err) { setError(errText(err)); }
  }
  return (
    <Dialog title="Продать номер" onClose={onClose}>
      <form className="col" onSubmit={submit}>
        <div className="center"><Plate plate={plate.code} country={plate.country} level={plate.level} size="l" /></div>
        <label className="aska-field"><span className="lbl">Цена, аськоинов</span>
          <input className="field" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} autoFocus />
        </label>
        <div className="hint">Номер появится на «Рынке». Когда кто-то купит, аськоины придут тебе, а номер уйдёт к нему вместе с улучшениями.</div>
        {error && <div className="err">{error}</div>}
        <div className="btns"><button className="btn primary">Выставить</button><button type="button" className="btn" onClick={onClose}>Отмена</button></div>
      </form>
    </Dialog>
  );
}

const KIND: Record<string, string> = { mint: 'выпущен', buy: 'купил(а) у АСЬКИ', sale: 'продан', upgrade: 'улучшен', list: 'выставлен на продажу', gold: 'золотая серия', admin: 'выдан администратором', revoke: 'возвращён АСЬКЕ' };

// Карточка номера-токена: владелец, редкость, уровень, история
export function PlateCard({ id, onClose }: { id: number; onClose: () => void }) {
  const s = useStore();
  const [p, setP] = useState<PlateInfo | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { plateCard(id).then(setP).catch(() => setError('Не получилось загрузить номер.')); }, [id]);
  const mine = p && p.ownerId === s.me?.userId;
  const coins = s.profile?.coins ?? 0;

  async function buy() {
    if (!p) return;
    setBusy(true);
    setError('');
    try { await buyPlate({ plateId: p.id }); setP(await plateCard(p.id)); } catch (e) { setError(errText(e)); } finally { setBusy(false); }
  }

  return (
    <Dialog title={p ? `Номер ${p.token}` : 'Номер'} onClose={onClose}>
      {!p ? <div className="hint">{error || 'Загружаю…'}</div> : (
        <div className="aska-pcard">
          <div className="center"><Plate plate={p.code} country={p.country} level={p.level} size="l" /></div>
          <div className="row aska-kv"><span>Токен</span><b>{p.token}</b><span className="sp" /><Rarity r={p.rarity} name={p.rarityName} /></div>
          <div className="row aska-kv"><span>Страна</span><b>{p.countryName}{p.city ? `, ${p.city}` : ''}</b></div>
          <div className="row aska-kv"><span>Улучшение</span><b>{p.levelName}</b></div>
          <div className="row aska-kv"><span>Владелец</span><b>{p.ownerId ? (mine ? 'ты' : p.ownerName) : 'АСЬКА'}</b>{p.gold && <span className="aska-gold" title="Золотая серия">★</span>}</div>
          <div className="row aska-kv"><span>Выпущен</span><b>{fmtDate(p.mintedAt)}</b></div>
          {p.price !== null && !mine && (
            <button className="btn primary aska-wide" disabled={busy || coins < p.price} onClick={buy}>
              {coins < p.price ? `Стоит ${p.price} 🪙 — не хватает ${p.price - coins}` : `Купить за ${p.price} 🪙`}
            </button>
          )}
          {error && <div className="err">{error}</div>}
          {p.history && p.history.length > 0 && (
            <div className="groupbox">
              <div className="legend">История</div>
              <ol className="aska-history">
                {p.history.map((h, i) => (
                  <li key={i}>
                    <span className="muted">{fmtDate(h.at)}</span> {KIND[h.kind] || h.kind}
                    {h.kind === 'sale' && <> · {h.from} → {h.to}</>}
                    {h.kind !== 'sale' && h.to !== 'АСЬКА' && h.kind !== 'list' && h.kind !== 'upgrade' && <> · {h.to}</>}
                    {h.note && h.kind === 'upgrade' && <> до «{h.note}»</>}
                    {h.price ? <> · {h.price} 🪙</> : null}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
