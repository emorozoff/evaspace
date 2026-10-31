// 🌙 Ночь: комнаты-форумы. В комнате — шапка в своём стиле (код, круглые, диван, портал), совет комнаты
// (президент, советники, хранители, джедаи), лента «как на форуме 2000-х»: пиксельный НФТ-аватар, ник, ранг,
// число сообщений, подпись и «спасибо». Писать — с НФТ-аватаром и пропуском (первый час в день бесплатно).
import { useEffect, useRef, useState } from 'react';
import { refreshState } from '../lib/store.ts';
import { nightOverview, nightCollection, mintAvatar, roomView, enterRoom, payRoom, postNight, thankNight, onNight, RANK_NAME } from '../lib/night.ts';
import type { NightOverview, RoomView, NightMsg } from '../lib/night.ts';
import { ApiError } from '../lib/api.ts';
import { timeShort } from '../lib/format.ts';
import { Dialog } from './Win.tsx';
import { NftArt, traitsOf, rarityName } from './NftArt.tsx';

export function Night({ onLevels }: { onLevels: () => void }) {
  const [ov, setOv] = useState<NightOverview | null>(null);
  const [room, setRoom] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [error, setError] = useState('');
  const load = () => nightOverview().then(setOv).catch(() => setError('Не получилось загрузить Ночь. Проверь интернет.'));
  useEffect(() => { load(); }, []);
  if (!ov) return <div className="hint">{error || 'Загружаю Ночь…'}</div>;
  if (room) return <Room key={room} roomKey={room} ov={ov} onBack={() => { setRoom(null); load(); }} onPick={() => setPicker(true)} onLevels={onLevels} pickerOpen={picker} onPicked={() => { setPicker(false); load(); }} onClosePicker={() => setPicker(false)} />;
  return (
    <div className="aska-night">
      <div className="aska-night-hero">
        {ov.avatar ? (
          <>
            <NftArt id={ov.avatar.id} size={64} />
            <span className="t"><small>Твой ночной ник</small><b>{ov.avatar.nick}</b><span>НФТ #{String(ov.avatar.id).padStart(2, '0')} · {rarityName(traitsOf(ov.avatar.id).rare)}{ov.avatar.block ? ` · блок ⛓ ${ov.avatar.block}` : ''}</span></span>
          </>
        ) : (
          <span className="t">
            <b>🌙 Добро пожаловать в Ночь</b>
            <span>Ночью здесь общаются люди и ночные постояльцы — по нику не понять, кто есть кто. Как форумы 2000-х, только живые.</span>
            {ov.canWrite
              ? <button className="btn primary" onClick={() => setPicker(true)}>🎴 Выбрать НФТ-аватар — {ov.prices.nft} 🪙{ov.prices.nft < ov.prices.nftFull ? ` (вместо ${ov.prices.nftFull})` : ''}</button>
              : <span className="aska-night-lock">🔒 Писать в комнатах — с уровня Голд. Смотреть можно уже сейчас. <button className="btn" onClick={onLevels}>🎖 Уровни</button></span>}
          </span>
        )}
      </div>
      <div className="aska-rooms">
        {ov.rooms.map((r) => (
          <button key={r.key} className={`aska-room t-${r.theme}`} onClick={() => setRoom(r.key)}>
            <span className="rm-art" aria-hidden="true"><i /><i /><i /></span>
            <span className="rm-top"><span className="rm-emoji">{r.emoji}</span><b>{r.title}</b><span className="rm-on">● {r.online}</span></span>
            <small className="rm-about">{r.about}</small>
            {r.last && <span className="rm-last"><b>{r.last.nick}:</b> {r.last.text}</span>}
            {r.president && <span className="rm-pres">👑 {r.president.nick}{r.president.away ? ' (ещё не заходил)' : ''}</span>}
          </button>
        ))}
      </div>
      <div className="groupbox aska-night-rules">
        <div className="legend">Как устроена Ночь</div>
        <ul>
          <li>🎴 Вход — свой НФТ-аватар: {ov.prices.nft} 🪙, один на все комнаты, ник — любой.</li>
          <li>⏱ В каждой комнате первый час в день — бесплатно, дальше {ov.prices.hour ? `${ov.prices.hour} 🪙 за час` : 'у тебя без оплаты (Блэк)'}.</li>
          <li>{ov.ranks.map((r) => `${r.emoji} ${r.name}${r.seats ? ` (${r.seats})` : ''}`).join(' · ')} — ранги растут от сообщений и «спасибо».</li>
          <li>🔓 Комнаты не шифруются: их читает сервер и ночные постояльцы-ИИ.</li>
        </ul>
      </div>
      {picker && <NftPicker price={ov.prices.nft} onClose={() => setPicker(false)} onDone={() => { setPicker(false); load(); }} />}
    </div>
  );
}

function left(until: number | null) {
  if (!until) return '';
  const m = Math.max(0, Math.round((until - Date.now()) / 60_000));
  return m >= 60 ? `${Math.floor(m / 60)} ч ${m % 60} мин` : `${m} мин`;
}

function Room({ roomKey, ov, onBack, onPick, onLevels, pickerOpen, onPicked, onClosePicker }: {
  roomKey: string; ov: NightOverview; onBack: () => void; onPick: () => void; onLevels: () => void; pickerOpen: boolean; onPicked: () => void; onClosePicker: () => void;
}) {
  const [v, setV] = useState<RoomView | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [, tick] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const load = () => roomView(roomKey).then(setV).catch(() => setError('Не получилось открыть комнату.'));
  useEffect(() => { load(); }, [roomKey]);
  useEffect(() => onNight((m: NightMsg) => {
    if (m.room !== roomKey) return;
    setV((x) => (x && !x.messages.some((y) => y.id === m.id) ? { ...x, messages: [...x.messages, m] } : x));
  }), [roomKey]);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30_000); return () => clearInterval(t); }, []);
  useEffect(() => { list.current?.scrollTo(0, list.current.scrollHeight); }, [v?.messages.length]);
  if (!v) return <div className="hint">{error || 'Открываю комнату…'}</div>;
  const r = v.room;
  const pass = v.pass;
  const active = !!pass && (pass.unlimited || (!!pass.until && pass.until > Date.now()));

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try { await fn(); await load(); await refreshState(); } catch (e) {
      const code = e instanceof ApiError ? e.code : '';
      setError(code === 'no_coins' ? 'Не хватает аськоинов.' : code === 'pay' ? 'Час закончился — продли пропуск.' : 'Не получилось. Попробуй ещё раз.');
    } finally { setBusy(false); }
  }
  async function send() {
    const t = text.trim();
    if (!t) return;
    setBusy(true);
    setError('');
    try {
      const { message } = await postNight(roomKey, t);
      setText('');
      setV((x) => (x && !x.messages.some((y) => y.id === message.id) ? { ...x, messages: [...x.messages, message] } : x));
    } catch (e) {
      const code = e instanceof ApiError ? e.code : '';
      setError(code === 'pay' ? 'Час закончился — продли пропуск.' : code === 'no_avatar' ? 'Сначала выбери НФТ-аватар.' : 'Не отправилось.');
      if (code === 'pay') load();
    } finally { setBusy(false); }
  }
  const c = v.council;

  return (
    <div className={`aska-nroom t-${r.theme}`}>
      <div className="nr-head">
        <span className="nr-art" aria-hidden="true"><i /><i /><i /><i /><i /></span>
        <button className="btn nr-back" onClick={onBack}>‹ Комнаты</button>
        <b className="nr-title">{r.emoji} {r.title}</b>
        <small className="nr-about">{r.about}</small>
      </div>
      <div className="nr-council">
        <span className="nc"><em>👑 Президент</em>{c.president ? <b>{c.president.nick}{c.president.away ? ' 💤' : ''}</b> : <b>—</b>}</span>
        <span className="nc"><em>🎩 Советники</em>{c.advisors.map((a) => <b key={a.id}>{a.nick}</b>)}</span>
        <span className="nc"><em>🗝 Хранители</em>{c.keepers.map((a) => <b key={a.id}>{a.nick}</b>)}</span>
        <span className="nc"><em>⚔️ Джедаи</em>{c.jedi.length ? c.jedi.map((a) => <b key={a.id}>{a.nick}</b>) : <i>место свободно</i>}</span>
        <span className="nc"><em>🗡 Самураи</em><b>{c.samurai}</b></span>
      </div>
      <div className="nr-posts" ref={list}>
        {v.messages.map((m) => {
          const rk = RANK_NAME[m.avatar.rank];
          const mine = ov.avatar?.id === m.avatar.id;
          return (
            <div key={m.id} className={`np rk-${m.avatar.rank}${mine ? ' mine' : ''}`}>
              <div className="np-side">
                <NftArt id={m.avatar.id} size={40} />
                <b className="np-nick">{m.avatar.nick}</b>
                <span className="np-rank">{rk.emoji} {rk.name}</span>
                <small>сообщ.: {m.avatar.posts}</small>
              </div>
              <div className="np-body">
                <div className="np-meta"><span>#{m.id}</span><span>{timeShort(m.at)}</span></div>
                <div className="np-text">{m.text}</div>
                <div className="np-foot">
                  <span className="np-sig">— НФТ #{String(m.avatar.id).padStart(2, '0')} · реп. {m.avatar.rep}</span>
                  {!mine && <button className="np-thx" onClick={() => thankNight(m.id).then(({ thanks }) => setV((x) => x && { ...x, messages: x.messages.map((y) => (y.id === m.id ? { ...y, thanks } : y)) })).catch(() => {})}>🙏 спасибо{m.thanks ? ` ${m.thanks}` : ''}</button>}
                  {mine && m.thanks > 0 && <span className="np-thx got">🙏 {m.thanks}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="nr-compose">
        {!v.canWrite ? (
          <div className="nr-gate">🔒 Писать в комнатах — с уровня Голд. <button className="btn" onClick={onLevels}>🎖 Уровни</button></div>
        ) : !ov.avatar ? (
          <div className="nr-gate">🎴 Чтобы писать, нужен НФТ-аватар. <button className="btn primary" onClick={onPick}>Выбрать — {ov.prices.nft} 🪙</button></div>
        ) : !active ? (
          <div className="nr-gate">
            {pass?.freeLeft
              ? <button className="btn primary" disabled={busy} onClick={() => act(() => enterRoom(roomKey))}>▶ Войти — первый час бесплатно</button>
              : <button className="btn primary" disabled={busy} onClick={() => act(() => payRoom(roomKey))}>⏱ Час в комнате — {ov.prices.hour} 🪙</button>}
          </div>
        ) : (
          <>
            <div className="nr-pass">
              <NftArt id={ov.avatar.id} size={22} /> <b>{ov.avatar.nick}</b>
              <span className="sp" />
              {pass!.unlimited ? <span>∞ Блэк</span> : <span>⏱ осталось {left(pass!.until)}</span>}
              {!pass!.unlimited && <button className="btn" disabled={busy} onClick={() => act(() => payRoom(roomKey))}>+1 ч — {ov.prices.hour} 🪙</button>}
            </div>
            <div className="row nr-input">
              <textarea className="field" rows={2} maxLength={500} value={text} placeholder="Напиши в комнату…" onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) { e.preventDefault(); send(); } }} />
              <button className="btn primary" disabled={busy || !text.trim()} onClick={send}>Отправить</button>
            </div>
          </>
        )}
        {error && <div className="err">{error}</div>}
      </div>
      {pickerOpen && <NftPicker price={ov.prices.nft} onClose={onClosePicker} onDone={onPicked} />}
    </div>
  );
}

// Выбор НФТ-аватара: 96 пиксельных, занятые — серые; выбрал, придумал ник — купил
export function NftPicker({ price, onClose, onDone }: { price: number; onClose: () => void; onDone: () => void }) {
  const [list, setList] = useState<{ id: number; taken: boolean }[] | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [nick, setNick] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { nightCollection().then(setList).catch(() => setError('Не получилось загрузить коллекцию.')); }, []);
  async function buy() {
    if (!sel) return;
    setBusy(true);
    setError('');
    try { await mintAvatar(sel, nick.trim()); await refreshState(); onDone(); } catch (e) {
      const code = e instanceof ApiError ? e.code : '';
      setError(code === 'taken' ? 'Этот аватар или ник уже заняты.' : code === 'bad_nick' ? 'Ник — от 3 до 20 знаков: буквы, цифры, _ и -.' : code === 'no_coins' ? `Не хватает аськоинов: нужно ${price} 🪙.` : code === 'level' ? 'Ночь — с уровня Голд.' : 'Не получилось.');
      setBusy(false);
    }
  }
  const t = sel ? traitsOf(sel) : null;
  return (
    <Dialog title="🎴 НФТ-аватар для Ночи" onClose={onClose}>
      <div className="hint">Пиксельная коллекция из 96 штук. Каждый — один на всю АСЬКУ, выпускается в цепочку блоков. С ним ты пишешь во всех ночных комнатах.</div>
      {sel && t && (
        <div className="aska-nft-sel">
          <NftArt id={sel} size={88} />
          <span className="t">
            <b>НФТ #{String(sel).padStart(2, '0')}</b>
            <span>{t.speciesName} · {rarityName(t.rare)}</span>
            <input className="field" value={nick} maxLength={20} onChange={(e) => setNick(e.target.value)} placeholder="ночной ник, например Пиксель_99" />
            <button className="btn primary" disabled={busy || nick.trim().length < 3} onClick={buy}>Купить за {price} 🪙</button>
          </span>
        </div>
      )}
      {error && <div className="err">{error}</div>}
      <div className="aska-nft-grid">
        {(list || []).map((a) => (
          <button key={a.id} className={`aska-nft-cell${sel === a.id ? ' on' : ''}`} disabled={a.taken} onClick={() => setSel(a.id)} title={a.taken ? 'уже у кого-то' : `#${a.id}`}>
            <NftArt id={a.id} size={40} />
            <small>{a.taken ? 'занят' : `#${a.id}`}</small>
          </button>
        ))}
      </div>
    </Dialog>
  );
}
