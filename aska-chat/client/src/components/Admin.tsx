// Управление АСЬКОЙ (только для администратора): «мозг» ИИ (ключ Claude, модель, лимит), ИИ-люди,
// СМС (SMS.ru) и люди — с кодом для входа, если кто-то забыл пароль, а СМС не подключены.
import { useEffect, useState } from 'react';
import { adminInfo, adminSetAi, adminCheckAi, adminSetPeople, adminSetSms, adminCheckSms, adminHelpCode, adminSetRole, adminBlock, adminSetPlate, adminCoins, adminCreateSuper } from '../lib/store.ts';
import type { AdminInfo } from '../lib/store.ts';

type AdminUser = AdminInfo['users'][number];
import { ApiError } from '../lib/api.ts';
import { Plate } from './Plate.tsx';
import { Dialog } from './Win.tsx';
import type { FormEvent } from 'react';

const fmtPhone = (p: string | null) => (p && p.startsWith('+7') && p.length === 12 ? `+7 ${p.slice(2, 5)} ${p.slice(5, 8)}-${p.slice(8, 10)}-${p.slice(10)}` : p || '—');
const ago = (t: number | null) => {
  if (!t) return 'давно';
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 2) return 'сейчас';
  if (m < 60) return `${m} мин назад`;
  if (m < 60 * 24) return `${Math.round(m / 60)} ч назад`;
  return `${Math.round(m / 1440)} дн назад`;
};

export function Admin() {
  const [info, setInfo] = useState<AdminInfo | null>(null);
  const [key, setKey] = useState('');
  const [limit, setLimit] = useState('');
  const [smsKey, setSmsKey] = useState('');
  const [aiCheck, setAiCheck] = useState('');
  const [smsCheck, setSmsCheck] = useState('');
  const [codes, setCodes] = useState<Record<number, string>>({});
  const [plateFor, setPlateFor] = useState<AdminUser | null>(null);
  const [coinsFor, setCoinsFor] = useState<AdminUser | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => adminInfo().then((i) => { setInfo(i); setLimit(String(i.ai.dailyLimit)); }).catch(() => setError('Не получилось загрузить.'));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try { await fn(); await load(); } catch (e) {
      setError(e instanceof ApiError && e.code === 'ai_off' ? 'Сначала вставь ключ Claude.' : 'Не получилось. Попробуй ещё раз.');
    } finally { setBusy(false); }
  };

  if (!info) return <div className="hint">{error || 'Загружаю…'}</div>;
  const ai = info.ai;

  return (
    <>
      {error && <div className="err">{error}</div>}
      <div className="groupbox">
        <div className="legend">🧠 Мозг ИИ — Claude</div>
        <div className="hint">Им думают Аська, ИИ-люди и личные ИИ. Без ключа они отвечают по шпаргалке.</div>
        <div className="row aska-kv"><span>Ключ</span><b>{ai.hasKey ? `вставлен ${ai.keyHint}` : 'нет'}</b></div>
        <div className="row aska-kv"><span>Сегодня ответов</span><b>{ai.usedToday} из {ai.dailyLimit}</b></div>
        {ai.lastError && <div className="err">Последняя ошибка: {ai.lastError}</div>}
        <label className="aska-field"><span className="lbl">Ключ Claude API (console.anthropic.com → API keys)</span>
          <span className="row">
            <input className="field" type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-…" autoComplete="off" />
            <button className="btn" disabled={busy || !key.trim()} onClick={() => act(async () => { await adminSetAi({ apiKey: key.trim() }); setKey(''); })}>Сохранить</button>
          </span>
        </label>
        <label className="aska-field"><span className="lbl">Модель</span>
          <select className="field" value={ai.model} disabled={busy} onChange={(e) => act(() => adminSetAi({ model: e.target.value }))}>
            {ai.models.map((m) => <option key={m.id} value={m.id}>{m.name} — {m.note}</option>)}
          </select>
        </label>
        <label className="aska-field"><span className="lbl">Лимит ответов в день (защита от больших счетов)</span>
          <span className="row">
            <input className="field" inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value.replace(/\D/g, ''))} />
            <button className="btn" disabled={busy || !limit || Number(limit) === ai.dailyLimit} onClick={() => act(() => adminSetAi({ dailyLimit: Number(limit) }))}>Сохранить</button>
          </span>
        </label>
        <div className="row mt">
          <button className="btn" disabled={busy || !ai.configured} onClick={() => act(async () => { const r = await adminCheckAi(); setAiCheck(r.ok ? `✅ Работает: «${r.reply}»` : `❌ ${r.error}`); })}>Проверить связь</button>
          <span className="sp" />
          {ai.hasKey && <button className="btn" disabled={busy} onClick={() => act(() => adminSetAi({ paused: !ai.paused }))}>{ai.paused ? '▶ Включить' : '⏸ Пауза'}</button>}
          {ai.hasKey && <button className="btn" disabled={busy} onClick={() => act(() => adminSetAi({ apiKey: '' }))}>Удалить ключ</button>}
        </div>
        {aiCheck && <div className="hint">{aiCheck}</div>}
      </div>

      <div className="groupbox">
        <div className="legend">👀 ИИ-люди</div>
        <div className="hint">
          Семь «новых людей» — ИИ, которые живут в кругах, пишут как люди и иногда сами начинают разговор. Все знают правила игры
          «Кто здесь ИИ?», но не знают, кто именно. Во всём серьёзном (здоровье, деньги, просьба сказать правду) они честно признаются.
        </div>
        <label className="row aska-check">
          <input type="checkbox" checked={info.people} disabled={busy || (!info.people && !ai.configured)}
            onChange={(e) => act(() => adminSetPeople(e.target.checked))} />
          <span>{info.people ? 'Включены' : ai.configured ? 'Выключены' : 'Сначала вставь ключ Claude'}</span>
        </label>
      </div>

      <div className="groupbox">
        <div className="legend">📱 СМС — SMS.ru</div>
        <div className="hint">Коды подтверждения телефона и восстановления входа. Зарегистрируйся на sms.ru, пополни баланс и скопируй api_id из раздела «Программистам».</div>
        <div className="row aska-kv"><span>Статус</span><b>{info.sms.configured ? 'подключены' : 'не подключены — восстановление через «Код для входа»'}</b></div>
        {info.sms.lastError && <div className="err">Последняя ошибка: {info.sms.lastError}</div>}
        <span className="row">
          <input className="field" type="password" value={smsKey} onChange={(e) => setSmsKey(e.target.value)} placeholder="api_id" autoComplete="off" />
          <button className="btn" disabled={busy || !smsKey.trim()} onClick={() => act(async () => { await adminSetSms(smsKey.trim()); setSmsKey(''); })}>Сохранить</button>
        </span>
        <div className="row mt">
          <button className="btn" disabled={busy || !info.sms.hasKey} onClick={() => act(async () => { const r = await adminCheckSms(); setSmsCheck(r.ok ? `✅ Баланс: ${r.balance} ₽` : `❌ ${r.error}`); })}>Проверить баланс</button>
          <span className="sp" />
          {info.sms.hasKey && <button className="btn" disabled={busy} onClick={() => act(() => adminSetSms(''))}>Отключить</button>}
        </div>
        {smsCheck && <div className="hint">{smsCheck}</div>}
      </div>

      <div className="groupbox">
        <div className="legend">👥 Люди ({info.users.length})</div>
        <div className="hint">★ — голд (админы, у них золотая серия АМР). Голд может менять номера, начислять аськоины, блокировать и назначать голд. Снять голд и заблокировать админа может только супер-админ.</div>
        <div className="aska-admin-users">
          {info.users.map((u) => {
            const isMe = u.id === info.me.id;
            const canTouch = !isMe && u.role !== 'super' && (u.role !== 'admin' || info.me.role === 'super');
            return (
              <div key={u.id} className={`aska-admin-user${u.blocked ? ' blocked' : ''}`}>
                <div className="row">
                  <b>{u.displayName}{u.isAdmin && <span className="aska-gold" title="Голд">★</span>}{u.role === 'super' ? ' · супер-админ' : ''}{isMe ? ' (ты)' : ''}</b>
                  <span className="sp" />
                  {u.plateView && <Plate plate={u.plateView.code} country={u.plateView.country} level={u.plateView.level} size="s" />}
                </div>
                <div className="row muted">
                  <span>{u.blocked ? '⛔ заблокирован(а) · ' : ''}{fmtPhone(u.phone)}{u.phone ? (u.phoneVerified ? ' ✓' : ' (не подтверждён)') : ''} · 🪙 {u.coins} · был(а) {ago(u.lastActive)} · логин {u.username}</span>
                </div>
                <div className="aska-admin-actions">
                  <button className="btn" disabled={busy} onClick={() => setPlateFor(u)}>🚗 Номер</button>
                  <button className="btn" disabled={busy} onClick={() => setCoinsFor(u)}>🪙 Аськоины</button>
                  {u.role === 'user' && !u.blocked && <button className="btn" disabled={busy} onClick={() => act(() => adminSetRole(u.id, 'admin'))}>★ Сделать голд</button>}
                  {u.role === 'admin' && canTouch && <button className="btn" disabled={busy} onClick={() => act(() => adminSetRole(u.id, 'user'))}>Снять голд</button>}
                  {canTouch && <button className="btn" disabled={busy} onClick={() => act(() => adminBlock(u.id, !u.blocked))}>{u.blocked ? 'Разблокировать' : '⛔ Заблокировать'}</button>}
                  {!isMe && !u.blocked && <button className="btn" disabled={busy} onClick={() => act(async () => { const r = await adminHelpCode(u.id); setCodes((c) => ({ ...c, [u.id]: r.code })); })}>Код для входа</button>}
                </div>
                {codes[u.id] && <div className="aska-help-code">Код: <b>{codes[u.id]}</b> — действует сутки. Передай лично: «Не помню пароль» → «Телефон не привязан».</div>}
              </div>
            );
          })}
        </div>
      </div>

      {!info.hasSuper && <SuperForm onDone={load} />}

      {plateFor && <PlateDialog user={plateFor} onClose={() => setPlateFor(null)} onDone={() => { setPlateFor(null); load(); }} />}
      {coinsFor && <CoinsDialog user={coinsFor} onClose={() => setCoinsFor(null)} onDone={() => { setCoinsFor(null); load(); }} />}
    </>
  );
}

const COUNTRY_NAMES: [string, string][] = [['RU', 'Россия'], ['BY', 'Беларусь'], ['KZ', 'Казахстан'], ['AM', 'Армения'], ['GE', 'Грузия'], ['DE', 'Германия'], ['US', 'США'], ['AE', 'ОАЭ'], ['GB', 'Великобритания']];

function PlateDialog({ user, onClose, onDone }: { user: AdminUser; onClose: () => void; onDone: () => void }) {
  const [country, setCountry] = useState(user.plateView?.country || 'RU');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!code.trim()) return setError('Напиши номер.');
    setBusy(true);
    setError('');
    try { await adminSetPlate(user.id, { country, code }); onDone(); } catch (err) {
      const c = err instanceof ApiError ? err.code : '';
      setError(c === 'gold_only' ? 'Серия АМР — только для голд. Сначала сделай человека голд.' : c === 'plate_taken' ? 'Этот номер уже у другого человека.' : c === 'bad_plate' ? 'Такого номера не бывает — проверь формат.' : 'Не получилось.');
      setBusy(false);
    }
  }
  return (
    <Dialog title={`Номер для ${user.displayName}`} onClose={onClose}>
      <form className="col" onSubmit={submit}>
        {user.plateView && <div className="center"><Plate plate={user.plateView.code} country={user.plateView.country} level={user.plateView.level} size="m" /></div>}
        <label className="aska-field"><span className="lbl">Страна</span>
          <select className="field" value={country} onChange={(e) => setCountry(e.target.value)}>
            {COUNTRY_NAMES.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <label className="aska-field"><span className="lbl">Новый номер</span>
          <input className="field" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoFocus autoCapitalize="characters" autoCorrect="off" spellCheck={false}
            placeholder={country === 'RU' ? 'В 777 ОР 116 (без региона — 777)' : country === 'BY' ? '7777 AA-7' : country === 'KZ' ? '777 AAA 02' : 'как на настоящем номере'} />
        </label>
        <div className="hint">Новый номер станет основным, старый останется в коллекции человека. Любые цифры, бесплатно.</div>
        {error && <div className="err">{error}</div>}
        <div className="btns"><button className="btn primary" disabled={busy}>Выдать</button><button type="button" className="btn" onClick={onClose}>Отмена</button></div>
      </form>
    </Dialog>
  );
}

function CoinsDialog({ user, onClose, onDone }: { user: AdminUser; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState('100');
  const [error, setError] = useState('');
  const send = async (sign: 1 | -1) => {
    const n = parseInt(amount, 10);
    if (!n) return setError('Сколько аськоинов?');
    try { await adminCoins(user.id, sign * n); onDone(); } catch { setError('Не получилось.'); }
  };
  return (
    <Dialog title={`Аськоины: ${user.displayName}`} onClose={onClose}>
      <div className="col">
        <div className="hint">Сейчас у человека 🪙 {user.coins}.</div>
        <input className="field" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} autoFocus />
        {error && <div className="err">{error}</div>}
        <div className="btns"><button className="btn primary" onClick={() => send(1)}>+ Начислить</button><button className="btn" onClick={() => send(-1)}>− Списать</button><button className="btn" onClick={onClose}>Отмена</button></div>
      </div>
    </Dialog>
  );
}

// Супер-админ — отдельный вход с полной властью; создаётся один раз. Пароль шифруется здесь же, на телефоне.
function SuperForm({ onDone }: { onDone: () => void }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!/^[A-Za-z0-9_]{3,20}$/.test(login.trim())) return setError('Логин: от 3 до 20 символов, латиница, цифры и _.');
    if (password.length < 6) return setError('Пароль — минимум 6 символов.');
    setBusy(true);
    setError('');
    try {
      const r = await adminCreateSuper(login.trim(), password, setProgress);
      setDone(`Готово: супер-админ «${login.trim()}», номер ${r.plate}. Входи с этим логином и паролем.`);
      setPassword('');
      onDone();
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'username_taken' ? 'Такой логин уже есть.' : 'Не получилось.');
    } finally { setBusy(false); }
  }
  return (
    <form className="groupbox col" onSubmit={submit}>
      <div className="legend">👑 Супер-админ</div>
      <div className="hint">Отдельный вход с полной властью: только он может снять голд с админа и заблокировать админа, его самого не может тронуть никто. Создаётся один раз.</div>
      {done ? <div className="aska-note">{done}</div> : (
        <>
          <label className="aska-field"><span className="lbl">Логин</span><input className="field" value={login} onChange={(e) => setLogin(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" /></label>
          <label className="aska-field"><span className="lbl">Пароль</span><input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></label>
          {error && <div className="err">{error}</div>}
          <div className="right"><button className="btn primary" disabled={busy}>{busy ? `Создаю ключи… ${Math.round(progress * 100)}%` : 'Создать супер-админа'}</button></div>
        </>
      )}
    </form>
  );
}
