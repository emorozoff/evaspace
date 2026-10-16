// Первый запуск: установка на экран «Домой», приглашение, регистрация, вход.
import { useState } from 'react';
import type { FormEvent } from 'react';
import { checkInvite, register, login } from '../lib/store.ts';
import { ApiError } from '../lib/api.ts';
import { isIOS, isStandalone } from '../lib/platform.ts';
import { LockIcon, ShareIcon, PlusSquareIcon } from './Icons.tsx';

function inviteFromUrl() {
  const m = location.hash.match(/invite=([A-Za-z0-9-]+)/);
  return m ? m[1].toUpperCase() : '';
}

export function Welcome() {
  const [skipInstall, setSkipInstall] = useState(false);
  const invite = inviteFromUrl();
  if (isIOS && !isStandalone && !skipInstall) return <InstallGuide invite={invite} onSkip={() => setSkipInstall(true)} />;
  return <AuthFlow initialInvite={invite} />;
}

function Logo() {
  return <img className="logo" src="/icons/icon-192.png" alt="" />;
}

function InstallGuide({ invite, onSkip }: { invite: string; onSkip: () => void }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(invite); setCopied(true); } catch { /* нет доступа */ }
  }
  return (
    <div className="screen welcome-screen">
      <div className="welcome">
        <Logo />
        <h1>Установи АСЬКУ</h1>
        <p className="lead">Так приложение откроется на весь экран и будут приходить уведомления.</p>
        <ol className="steps">
          <li><span className="step-n">1</span><span>Нажми <b className="inline-icon"><ShareIcon size={18} /></b> «Поделиться» в Safari (если не видно — сначала «•••»)</span></li>
          <li><span className="step-n">2</span><span>Выбери <b className="inline-icon"><PlusSquareIcon size={18} /></b> «На экран „Домой“»</span></li>
          <li><span className="step-n">3</span><span>Открой «АСЬКА» с экрана «Домой»</span></li>
        </ol>
        {invite && (
          <div className="card">
            <div className="hint">Твой код приглашения — введи его в приложении:</div>
            <div className="invite-code">{invite}</div>
            <button className="btn secondary" onClick={copy}>{copied ? 'Скопировано' : 'Скопировать код'}</button>
          </div>
        )}
        <button className="link-btn" onClick={onSkip}>Продолжить в браузере (без уведомлений)</button>
      </div>
    </div>
  );
}

type Step = 'start' | 'register' | 'login';

const ERRORS: Record<string, string> = {
  invite_invalid: 'Код не подходит или уже использован. Попроси у друга новый.',
  username_taken: 'Этот логин уже занят — придумай другой.',
  bad_username: 'Логин: от 3 до 20 символов, латиница, цифры и _.',
  bad_name: 'Напиши имя (до 40 символов).',
  bad_login: 'Неверный логин или пароль.',
  too_many: 'Слишком много попыток. Подожди 10 минут.',
  network: 'Нет связи с сервером. Проверь интернет.',
  backup_broken: 'Не получилось восстановить ключ шифрования.',
};
const errorText = (e: unknown) => {
  const code = e instanceof ApiError ? e.code : e instanceof Error ? e.message : '';
  return ERRORS[code] || 'Что-то пошло не так. Попробуй ещё раз.';
};

function AuthFlow({ initialInvite }: { initialInvite: string }) {
  const [step, setStep] = useState<Step>('start');
  const [invite, setInvite] = useState(initialInvite);
  const [invitedBy, setInvitedBy] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  async function onInvite(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!invite.trim()) return setError('Введи код из приглашения.');
    setBusy('Проверяю код…');
    try {
      const r = await checkInvite(invite.trim());
      setInvitedBy(r.invitedBy);
      setStep('register');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  async function onRegister(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('Напиши, как тебя зовут.');
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) return setError(ERRORS.bad_username);
    if (password.length < 8) return setError('Пароль — минимум 8 символов.');
    if (password !== password2) return setError('Пароли не совпадают.');
    setBusy('Создаю ключи шифрования…');
    setProgress(0);
    try {
      await register({ invite: invite.trim(), username: username.trim(), displayName: name.trim(), password }, setProgress);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'invite_invalid') setStep('start');
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

  const go = (s: Step) => { setError(''); setStep(s); };

  return (
    <div className="screen welcome-screen">
      <div className="welcome">
        <Logo />
        {step === 'start' && (
          <form onSubmit={onInvite} className="form">
            <h1>АСЬКА</h1>
            <p className="lead">АСЬКА для друзей. Переписку видят только участники — даже сервер не может её прочитать.</p>
            <label className="field">
              <span>Код приглашения</span>
              <input value={invite} onChange={(e) => setInvite(e.target.value.toUpperCase())} placeholder="ABCD-EFGH"
                autoCapitalize="characters" autoCorrect="off" autoComplete="off" spellCheck={false} inputMode="text" />
            </label>
            {error && <div className="error">{error}</div>}
            <button className="btn" disabled={!!busy}>{busy || 'Дальше'}</button>
            <button type="button" className="btn secondary" onClick={() => go('login')}>У меня уже есть аккаунт</button>
          </form>
        )}

        {step === 'register' && (
          <form onSubmit={onRegister} className="form">
            <h1>Знакомство</h1>
            {invitedBy && <p className="lead">Тебя пригласил(а) {invitedBy}.</p>}
            <label className="field">
              <span>Как тебя зовут</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя" maxLength={40} autoComplete="name" />
            </label>
            <label className="field">
              <span>Логин</span>
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="латиница, цифры и _"
                autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username" maxLength={20} />
            </label>
            <label className="field">
              <span>Пароль</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="минимум 8 символов" autoComplete="new-password" />
            </label>
            <label className="field">
              <span>Повтори пароль</span>
              <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} autoComplete="new-password" />
            </label>
            <div className="note">
              <LockIcon size={18} />
              <span>Пароль защищает твой ключ шифрования. Мы его не знаем и восстановить не сможем. С ним ты войдёшь на новом телефоне и вернёшь переписку — сохрани его.</span>
            </div>
            {error && <div className="error">{error}</div>}
            <button className="btn" disabled={!!busy}>{busy ? `${busy} ${Math.round(progress * 100)}%` : 'Создать аккаунт'}</button>
            <button type="button" className="btn secondary" onClick={() => go('start')} disabled={!!busy}>Назад</button>
          </form>
        )}

        {step === 'login' && (
          <form onSubmit={onLogin} className="form">
            <h1>Вход</h1>
            <p className="lead">Переписка восстановится после входа.</p>
            <label className="field">
              <span>Логин</span>
              <input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoCorrect="off"
                spellCheck={false} autoComplete="username" />
            </label>
            <label className="field">
              <span>Пароль</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </label>
            {error && <div className="error">{error}</div>}
            <button className="btn" disabled={!!busy}>{busy ? `${busy} ${Math.round(progress * 100)}%` : 'Войти'}</button>
            <button type="button" className="btn secondary" onClick={() => go('start')} disabled={!!busy}>У меня есть приглашение</button>
          </form>
        )}
      </div>
    </div>
  );
}
