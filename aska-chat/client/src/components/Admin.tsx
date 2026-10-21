// Управление АСЬКОЙ (только для администратора): «мозг» ИИ (ключ Claude, модель, лимит), ИИ-люди,
// СМС (SMS.ru) и люди — с кодом для входа, если кто-то забыл пароль, а СМС не подключены.
import { useEffect, useState } from 'react';
import { adminInfo, adminSetAi, adminCheckAi, adminSetPeople, adminSetSms, adminCheckSms, adminHelpCode } from '../lib/store.ts';
import type { AdminInfo } from '../lib/store.ts';
import { ApiError } from '../lib/api.ts';
import { Plate } from './Plate.tsx';

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
        <div className="aska-admin-users">
          {info.users.map((u) => (
            <div key={u.id} className="aska-admin-user">
              <div className="row"><b>{u.displayName}{u.isAdmin ? ' 👑' : ''}</b><span className="sp" /><Plate plate={u.plate} size="s" /></div>
              <div className="row muted">
                <span>{fmtPhone(u.phone)}{u.phone ? (u.phoneVerified ? ' ✓' : ' (не подтверждён)') : ''} · был(а) {ago(u.lastActive)}</span>
                <span className="sp" />
                {!u.isAdmin && <button className="btn" disabled={busy} onClick={() => act(async () => { const r = await adminHelpCode(u.id); setCodes((c) => ({ ...c, [u.id]: r.code })); })}>Код для входа</button>}
              </div>
              {codes[u.id] && <div className="aska-help-code">Код: <b>{codes[u.id]}</b> — действует сутки. Передай лично: «Не помню пароль» → «Телефон не привязан».</div>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
