// Окно «АСЬКА — вход в сеть»: выбор дизайна, установка на iPhone, приглашение, регистрация, вход.
import { useState } from 'react';
import type { FormEvent } from 'react';
import { checkInvite, register, login } from '../lib/store.ts';
import { ApiError } from '../lib/api.ts';
import { isIOS, isStandalone } from '../lib/platform.ts';
import { getDesign, setDesign, logoFlower, flower } from '../lib/aska.ts';
import type { Design } from '../lib/aska.ts';
import { Win, Svg } from './Win.tsx';

function inviteFromUrl() {
  const m = location.hash.match(/invite=([A-Za-z0-9-]+)/);
  return m ? m[1].toUpperCase() : '';
}

export function DesignPick({ value, onChange }: { value: Design; onChange: (d: Design) => void }) {
  return (
    <div className="design-pick" role="radiogroup" aria-label="Дизайн">
      <button type="button" role="radio" aria-checked={value === 'zoomer'} className={value === 'zoomer' ? 'on' : ''}
        data-design="zoomer" onClick={() => onChange('zoomer')}>
        <b>Зумер</b><small>стекло, пузыри, крупно</small>
      </button>
      <button type="button" role="radio" aria-checked={value === 'millennial'} className={value === 'millennial' ? 'on' : ''}
        data-design="millennial" onClick={() => onChange('millennial')}>
        <b>Миллениал</b><small>классика 2000-х, окна</small>
      </button>
    </div>
  );
}

export function Welcome() {
  const [design, setD] = useState<Design>(getDesign());
  const [skipInstall, setSkipInstall] = useState(false);
  const invite = inviteFromUrl();
  const pick = (d: Design) => { setDesign(d); setD(d); };

  return (
    <div className="desktop">
      <div className="wins">
        <Win id="loginwin" className="dialog" title="АСЬКА — вход в сеть" icon={logoFlower(14)}>
          <div className="login-body">
            <div className="bigflower">
              <Svg html={logoFlower(44)} />
              <div className="logo-word center">АСЬКА<small>мессенджер для своих · с шифрованием</small></div>
            </div>
            <DesignPick value={design} onChange={pick} />
            {isIOS && !isStandalone && !skipInstall
              ? <InstallGuide invite={invite} onSkip={() => setSkipInstall(true)} />
              : <AuthTabs initialInvite={invite} />}
          </div>
          <div className="statusbar">
            <div className="cell"><Svg html={flower('offline', 12)} /> Не в сети</div>
            <div className="cell fit">v1.0</div>
          </div>
        </Win>
      </div>
    </div>
  );
}

function InstallGuide({ invite, onSkip }: { invite: string; onSkip: () => void }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(invite); setCopied(true); } catch { /* нет доступа */ }
  }
  return (
    <div className="groupbox">
      <div className="legend">Сначала установи АСЬКУ на iPhone</div>
      <ol className="aska-steps">
        <li>Нажми «Поделиться» внизу Safari (если не видно — сначала «•••»).</li>
        <li>Выбери «На экран „Домой“».</li>
        <li>Открой АСЬКУ с экрана «Домой» — так будут приходить уведомления.</li>
      </ol>
      {invite && (
        <div className="col">
          <div className="hint">Твой код приглашения — введи его в приложении:</div>
          <div className="uin-box">{invite}</div>
          <div className="right"><button className="btn" onClick={copy}>{copied ? 'Скопировано' : 'Скопировать код'}</button></div>
        </div>
      )}
      <div className="center mt"><button className="link aska-linkbtn" onClick={onSkip}>Продолжить в браузере (без уведомлений)</button></div>
    </div>
  );
}

const ERRORS: Record<string, string> = {
  invite_invalid: 'Код не подходит или уже использован. Попроси у друга новый.',
  username_taken: 'Этот логин уже занят — придумай другой.',
  bad_username: 'Логин: от 3 до 20 символов, латиница, цифры и _.',
  bad_name: 'Напиши ник (до 40 символов).',
  bad_login: 'Неверный логин или пароль.',
  too_many: 'Слишком много попыток. Подожди 10 минут.',
  network: 'Нет связи с сервером. Проверь интернет.',
  backup_broken: 'Не получилось восстановить ключ шифрования.',
};
const errorText = (e: unknown) => {
  const code = e instanceof ApiError ? e.code : e instanceof Error ? e.message : '';
  return ERRORS[code] || 'Что-то пошло не так. Попробуй ещё раз.';
};

function AuthTabs({ initialInvite }: { initialInvite: string }) {
  const [tab, setTab] = useState<'reg' | 'login'>('reg');
  const [step, setStep] = useState<'code' | 'form'>('code');
  const [invite, setInvite] = useState(initialInvite);
  const [invitedBy, setInvitedBy] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const switchTab = (t: 'reg' | 'login') => { setError(''); setTab(t); };
  const busyLabel = busy ? `${busy} ${Math.round(progress * 100)}%` : null;

  async function onInvite(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!invite.trim()) return setError('Введи код из приглашения.');
    setBusy('Проверяю…');
    try {
      const r = await checkInvite(invite.trim());
      setInvitedBy(r.invitedBy);
      setStep('form');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  async function onRegister(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('Напиши, как тебя звать в сети.');
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) return setError(ERRORS.bad_username);
    if (password.length < 8) return setError('Пароль — минимум 8 символов.');
    if (password !== password2) return setError('Пароли не совпадают.');
    setBusy('Создаю ключи…');
    setProgress(0);
    try {
      await register({ invite: invite.trim(), username: username.trim(), displayName: name.trim(), password }, setProgress);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'invite_invalid') setStep('code');
      setError(errorText(err));
      setBusy(null);
    }
  }

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) return setError('Введи логин и пароль.');
    setBusy('Проверяю пароль…');
    setProgress(0);
    try {
      await login(username, password, setProgress);
    } catch (err) {
      setError(errorText(err));
      setBusy(null);
    }
  }

  return (
    <>
      <div className="tabs">
        <button className={tab === 'reg' ? 'on' : ''} onClick={() => switchTab('reg')}>По приглашению</button>
        <button className={tab === 'login' ? 'on' : ''} onClick={() => switchTab('login')}>Уже есть АСЬКА</button>
      </div>
      <div className="tabpanel">
        {tab === 'reg' && step === 'code' && (
          <form className="col" onSubmit={onInvite}>
            <label className="row">
              <span className="lbl">Код</span>
              <input className="field" value={invite} onChange={(e) => setInvite(e.target.value.toUpperCase())} placeholder="ABCD-EFGH"
                autoCapitalize="characters" autoCorrect="off" autoComplete="off" spellCheck={false} />
            </label>
            <div className="err">{error}</div>
            <div className="hint">АСЬКА — только для своих: войти можно по приглашению друга. Переписку видят только участники — даже сервер не может её прочитать.</div>
            <div className="right mt"><button className="btn primary" disabled={!!busy}>{busy || 'Дальше'}</button></div>
          </form>
        )}

        {tab === 'reg' && step === 'form' && (
          <form className="col" onSubmit={onRegister}>
            {invitedBy && <div className="hint">Тебя позвал(а) {invitedBy}.</div>}
            <label className="row">
              <span className="lbl">Ник</span>
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="как тебя звать в сети" autoComplete="nickname" />
            </label>
            <label className="row">
              <span className="lbl">Логин</span>
              <input className="field" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={20} placeholder="латиница, цифры и _"
                autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username" />
            </label>
            <label className="row">
              <span className="lbl">Пароль</span>
              <input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="минимум 8 символов" autoComplete="new-password" />
            </label>
            <label className="row">
              <span className="lbl">Ещё раз</span>
              <input className="field" type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} autoComplete="new-password" />
            </label>
            <div className="err">{error}</div>
            <div className="hint">Пароль защищает твой ключ шифрования. Мы его не знаем и восстановить не сможем — запиши его на бумажке. С ним ты войдёшь на новом телефоне и вернёшь переписку.</div>
            <div className="row mt">
              <button type="button" className="btn" onClick={() => { setError(''); setStep('code'); }} disabled={!!busy}>Назад</button>
              <span className="sp" />
              <button className="btn primary" disabled={!!busy}>{busyLabel || 'Получить АСЬКУ'}</button>
            </div>
          </form>
        )}

        {tab === 'login' && (
          <form className="col" onSubmit={onLogin}>
            <label className="row">
              <span className="lbl">Логин</span>
              <input className="field" value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoCorrect="off"
                spellCheck={false} autoComplete="username" />
            </label>
            <label className="row">
              <span className="lbl">Пароль</span>
              <input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </label>
            <div className="err">{error}</div>
            <div className="hint">После входа переписка восстановится — она хранится зашифрованной.</div>
            <div className="right mt"><button className="btn primary" disabled={!!busy}>{busyLabel || 'Войти'}</button></div>
          </form>
        )}
      </div>
    </>
  );
}
