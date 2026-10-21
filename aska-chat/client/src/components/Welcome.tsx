// Окно «АСЬКА — вход в сеть». Три пути: вход (телефон или номер + пароль), регистрация по приглашению
// (имя → телефон → код из СМС → пароль) и «не помню пароль» (код из СМС или от администратора → новый пароль).
import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { checkInvite, register, login, recover, sendCode, verifyCode, smsAvailable } from '../lib/store.ts';
import { ApiError } from '../lib/api.ts';
import { isIOS, isStandalone } from '../lib/platform.ts';
import { getDesign, setDesign, logoFlower, flower } from '../lib/aska.ts';
import type { Design } from '../lib/aska.ts';
import { Win, Svg } from './Win.tsx';

export const APP_VERSION = 'v2.0';

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
              <div className="logo-word center">АСЬКА<small>мессенджер для своих</small></div>
            </div>
            {isIOS && !isStandalone && !skipInstall
              ? <InstallGuide invite={invite} onSkip={() => setSkipInstall(true)} />
              : <Auth initialInvite={invite} />}
            <div className="aska-design-mini">
              <span className="hint">Вид:</span>
              {(['zoomer', 'millennial'] as Design[]).map((d) => (
                <button key={d} type="button" className={`chip${design === d ? ' on' : ''}`} data-design={d} onClick={() => pick(d)}>
                  {d === 'zoomer' ? 'Зумер' : 'Миллениал'}
                </button>
              ))}
            </div>
          </div>
          <div className="statusbar">
            <div className="cell"><Svg html={flower('offline', 12)} /> Не в сети</div>
            <div className="cell fit">{APP_VERSION}</div>
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
          <div className="hint">Твой код приглашения — понадобится в приложении:</div>
          <div className="uin-box">{invite}</div>
          <div className="right"><button className="btn" onClick={copy}>{copied ? 'Скопировано' : 'Скопировать код'}</button></div>
        </div>
      )}
      <div className="center mt"><button className="link aska-linkbtn" onClick={onSkip}>Продолжить в браузере (без уведомлений)</button></div>
    </div>
  );
}

const ERRORS: Record<string, string> = {
  invite_invalid: 'Приглашение не подходит или уже использовано. Попроси у друга новое.',
  bad_name: 'Напиши имя (до 40 символов).',
  bad_phone: 'Проверь номер телефона: например, +7 999 123-45-67.',
  phone_taken: 'Этот телефон уже привязан к другой АСЬКЕ. Войди с ним или нажми «Не помню пароль».',
  phone_unverified: 'Сначала подтверди телефон кодом из СМС.',
  bad_code: 'Код не подошёл. Проверь цифры или запроси новый.',
  sms_failed: 'СМС не отправилась. Попробуй через минуту.',
  bad_login: 'Неверный телефон, номер, логин или пароль.',
  bad_recover: 'Код не подошёл или устарел. Запроси новый.',
  too_many: 'Слишком много попыток. Подожди 10–15 минут.',
  network: 'Нет связи с сервером. Проверь интернет.',
  backup_broken: 'Не получилось восстановить ключ шифрования.',
};
const errorText = (e: unknown) => {
  const code = e instanceof ApiError ? e.code : e instanceof Error ? e.message : '';
  return ERRORS[code] || 'Что-то пошло не так. Попробуй ещё раз.';
};

type Mode = 'login' | 'invite' | 'recover';

function Auth({ initialInvite }: { initialInvite: string }) {
  const [mode, setMode] = useState<Mode>(initialInvite ? 'invite' : 'login');
  const [phoneHint, setPhoneHint] = useState('');
  return (
    <div className="aska-auth">
      {mode === 'login' && <Login onInvite={() => setMode('invite')} onForgot={(p) => { setPhoneHint(p); setMode('recover'); }} />}
      {mode === 'invite' && <SignUp initialInvite={initialInvite} onLogin={() => setMode('login')} />}
      {mode === 'recover' && <Recover initialPhone={phoneHint} onBack={() => setMode('login')} />}
    </div>
  );
}

function Busy({ label, progress }: { label: string; progress?: number }) {
  return <>{label}{progress !== undefined && progress > 0 ? ` ${Math.round(progress * 100)}%` : ''}</>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="aska-field">
      <span className="lbl">{label}</span>
      {children}
    </label>
  );
}

function PasswordInput({ value, onChange, autoComplete, autoFocus }: { value: string; onChange: (v: string) => void; autoComplete: string; autoFocus?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <span className="aska-pass">
      <input className="field" type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete} autoFocus={autoFocus} />
      <button type="button" className="btn icon" onClick={() => setShow((v) => !v)} aria-label={show ? 'Скрыть пароль' : 'Показать пароль'}>{show ? '🙈' : '👁'}</button>
    </span>
  );
}

function Login({ onInvite, onForgot }: { onInvite: () => void; onForgot: (phone: string) => void }) {
  const [loginName, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!loginName.trim() || !password) return setError('Введи телефон или номер АСЬКИ и пароль.');
    setBusy(true);
    setProgress(0);
    try {
      await login(loginName, password, setProgress);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <form className="col" onSubmit={submit}>
      <div className="aska-step-title">Вход</div>
      <Field label="Телефон, номер АСЬКИ или логин">
        <input className="field" value={loginName} onChange={(e) => setLogin(e.target.value)} placeholder="+7 999…, А 001 МР или логин"
          autoCapitalize="characters" autoCorrect="off" spellCheck={false} autoComplete="username" />
      </Field>
      <Field label="Пароль">
        <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
      </Field>
      <div className="err">{error}</div>
      <div className="hint">Регистрировался(ась) раньше с логином (например, kirill)? Он тоже подходит, пароль — прежний.</div>
      <button className="btn primary aska-wide" disabled={busy}>{busy ? <Busy label="Проверяю пароль…" progress={progress} /> : 'Войти'}</button>
      <div className="aska-links">
        <button type="button" className="link aska-linkbtn" onClick={() => onForgot(/\d{6,}/.test(loginName.replace(/\D/g, '')) ? loginName : '')}>Не помню пароль</button>
        <button type="button" className="link aska-linkbtn" onClick={onInvite}>У меня приглашение</button>
      </div>
    </form>
  );
}

type SignStep = 'code' | 'name' | 'phone' | 'sms' | 'password';

function Steps({ step, list }: { step: string; list: string[] }) {
  const i = list.indexOf(step);
  return (
    <div className="aska-dots" aria-label={`Шаг ${i + 1} из ${list.length}`}>
      {list.map((s, n) => <i key={s} className={n <= i ? 'on' : ''} />)}
    </div>
  );
}

function SignUp({ initialInvite, onLogin }: { initialInvite: string; onLogin: () => void }) {
  const [step, setStep] = useState<SignStep>(initialInvite ? 'name' : 'code');
  const [invite, setInvite] = useState(initialInvite);
  const [invitedBy, setInvitedBy] = useState<string | null>(null);
  const [smsOn, setSmsOn] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [ticket, setTicket] = useState<string | undefined>();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const checked = useRef(false);

  const run = async (fn: () => Promise<void>) => {
    setError('');
    setBusy(true);
    try { await fn(); } catch (err) {
      if (err instanceof ApiError && err.code === 'invite_invalid') setStep('code');
      setError(errorText(err));
    } finally { setBusy(false); }
  };

  useEffect(() => {
    if (!initialInvite || checked.current) return;
    checked.current = true;
    run(async () => { const r = await checkInvite(initialInvite); setInvitedBy(r.invitedBy); setSmsOn(r.sms); });
  }, [initialInvite]); // eslint-disable-line react-hooks/exhaustive-deps

  const list: SignStep[] = smsOn ? ['name', 'phone', 'sms', 'password'] : ['name', 'phone', 'password'];

  function onCode(e: FormEvent) {
    e.preventDefault();
    if (!invite.trim()) return setError('Введи код из приглашения.');
    run(async () => { const r = await checkInvite(invite.trim()); setInvitedBy(r.invitedBy); setSmsOn(r.sms); setStep('name'); });
  }
  function onName(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('Как тебя зовут?');
    setError('');
    setStep('phone');
  }
  function onPhone(e: FormEvent) {
    e.preventDefault();
    if (phone.replace(/\D/g, '').length < 10) return setError(ERRORS.bad_phone);
    run(async () => {
      const r = await sendCode(phone, 'register', invite);
      if (r.mode === 'sms') { setSmsOn(true); setCode(''); setStep('sms'); } else { setSmsOn(false); setStep('password'); }
    });
  }
  function onSms(e: FormEvent) {
    e.preventDefault();
    run(async () => { setTicket(await verifyCode(phone, 'register', code)); setStep('password'); });
  }
  function onPassword(e: FormEvent) {
    e.preventDefault();
    if (password.length < 6) return setError('Пароль — минимум 6 символов.');
    setProgress(0);
    run(async () => { await register({ invite: invite.trim(), displayName: name.trim(), phone, phoneTicket: ticket, password }, setProgress); });
  }

  const back = (to: SignStep) => <button type="button" className="btn" onClick={() => { setError(''); setStep(to); }} disabled={busy}>Назад</button>;

  return (
    <div className="col">
      {step === 'code' && (
        <form className="col" onSubmit={onCode}>
          <div className="aska-step-title">Приглашение</div>
          <Field label="Код из приглашения">
            <input className="field" value={invite} onChange={(e) => setInvite(e.target.value.toUpperCase())} placeholder="ABCD-EFGH"
              autoCapitalize="characters" autoCorrect="off" autoComplete="off" spellCheck={false} autoFocus />
          </Field>
          <div className="err">{error}</div>
          <div className="hint">В АСЬКУ попадают только по приглашению друга.</div>
          <button className="btn primary aska-wide" disabled={busy}>{busy ? 'Проверяю…' : 'Дальше'}</button>
          <div className="aska-links"><button type="button" className="link aska-linkbtn" onClick={onLogin}>У меня уже есть АСЬКА</button></div>
        </form>
      )}

      {step === 'name' && (
        <form className="col" onSubmit={onName}>
          <Steps step={step} list={list} />
          <div className="aska-step-title">{invitedBy ? `Тебя зовёт ${invitedBy} 🌼` : 'Привет! 🌼'}</div>
          <Field label="Как тебя зовут?">
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Имя или ник" autoComplete="nickname" autoFocus />
          </Field>
          <div className="err">{error}</div>
          <button className="btn primary aska-wide" disabled={busy}>Дальше</button>
          <div className="aska-links"><button type="button" className="link aska-linkbtn" onClick={onLogin}>У меня уже есть АСЬКА</button></div>
        </form>
      )}

      {step === 'phone' && (
        <form className="col" onSubmit={onPhone}>
          <Steps step={step} list={list} />
          <div className="aska-step-title">Твой телефон</div>
          <Field label="Номер телефона">
            <input className="field" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 999 123-45-67" autoComplete="tel" autoFocus />
          </Field>
          <div className="err">{error}</div>
          <div className="hint">По телефону ты войдёшь на новом устройстве и легко вернёшь вход, если забудешь пароль. Друзья его не видят.</div>
          <div className="row mt">{back('name')}<span className="sp" /><button className="btn primary" disabled={busy}>{busy ? 'Отправляю…' : 'Дальше'}</button></div>
        </form>
      )}

      {step === 'sms' && (
        <form className="col" onSubmit={onSms}>
          <Steps step={step} list={list} />
          <div className="aska-step-title">Код из СМС</div>
          <div className="hint">Отправили на {phone}</div>
          <Field label="Код">
            <input className="field aska-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="••••" autoFocus />
          </Field>
          <div className="err">{error}</div>
          <Resend onResend={() => run(async () => { await sendCode(phone, 'register', invite); })} />
          <div className="row mt">{back('phone')}<span className="sp" /><button className="btn primary" disabled={busy || code.length < 4}>{busy ? 'Проверяю…' : 'Подтвердить'}</button></div>
        </form>
      )}

      {step === 'password' && (
        <form className="col" onSubmit={onPassword}>
          <Steps step={step} list={list} />
          <div className="aska-step-title">Придумай пароль</div>
          <Field label="Пароль (от 6 символов)">
            <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" autoFocus />
          </Field>
          <div className="err">{error}</div>
          <div className="hint">Пароль запирает твою переписку — её шифруют прямо на телефоне. Забудешь — вход вернём по телефону, но старые сообщения на новом устройстве не откроются.</div>
          <div className="row mt">{back('phone')}<span className="sp" /><button className="btn primary" disabled={busy}>{busy ? <Busy label="Создаю ключи…" progress={progress} /> : 'Получить АСЬКУ'}</button></div>
        </form>
      )}
    </div>
  );
}

function Resend({ onResend }: { onResend: () => void }) {
  const [left, setLeft] = useState(45);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return (
    <div className="hint">
      {left > 0 ? `Отправить ещё раз можно через ${left} с` : (
        <button type="button" className="link aska-linkbtn" onClick={() => { setLeft(45); onResend(); }}>Отправить код ещё раз</button>
      )}
    </div>
  );
}

type RecStep = 'phone' | 'sms' | 'help' | 'password';

function Recover({ initialPhone, onBack }: { initialPhone: string; onBack: () => void }) {
  const [step, setStep] = useState<RecStep>('phone');
  const [phone, setPhone] = useState(initialPhone);
  const [code, setCode] = useState('');
  const [ticket, setTicket] = useState<string | undefined>();
  const [loginName, setLogin] = useState(initialPhone);
  const [helpCode, setHelpCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const run = async (fn: () => Promise<void>) => {
    setError('');
    setBusy(true);
    try { await fn(); } catch (err) { setError(errorText(err)); } finally { setBusy(false); }
  };

  function onPhone(e: FormEvent) {
    e.preventDefault();
    if (phone.replace(/\D/g, '').length < 10) return setError(ERRORS.bad_phone);
    run(async () => {
      const r = await sendCode(phone, 'recover');
      if (r.mode === 'sms') { setStep('sms'); return; }
      setLogin(phone);
      setStep('help');
    });
  }
  async function onNoPhone() {
    setError('');
    const on = await smsAvailable().catch(() => false);
    setStep(on ? 'phone' : 'help');
  }

  return (
    <div className="col">
      {step === 'phone' && (
        <form className="col" onSubmit={onPhone}>
          <div className="aska-step-title">Вернём вход</div>
          <Field label="Телефон, привязанный к АСЬКЕ">
            <input className="field" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 999 123-45-67" autoComplete="tel" autoFocus />
          </Field>
          <div className="err">{error}</div>
          <button className="btn primary aska-wide" disabled={busy}>{busy ? 'Отправляю…' : 'Прислать код'}</button>
          <div className="aska-links">
            <button type="button" className="link aska-linkbtn" onClick={onBack}>Назад ко входу</button>
            <button type="button" className="link aska-linkbtn" onClick={() => { setStep('help'); }}>Телефон не привязан</button>
          </div>
        </form>
      )}

      {step === 'sms' && (
        <form className="col" onSubmit={(e) => { e.preventDefault(); run(async () => { setTicket(await verifyCode(phone, 'recover', code)); setStep('password'); }); }}>
          <div className="aska-step-title">Код из СМС</div>
          <div className="hint">Если {phone} привязан к АСЬКЕ, на него пришёл код.</div>
          <Field label="Код">
            <input className="field aska-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="••••" autoFocus />
          </Field>
          <div className="err">{error}</div>
          <Resend onResend={() => run(async () => { await sendCode(phone, 'recover'); })} />
          <div className="row mt">
            <button type="button" className="btn" onClick={() => setStep('phone')} disabled={busy}>Назад</button>
            <span className="sp" />
            <button className="btn primary" disabled={busy || code.length < 4}>{busy ? 'Проверяю…' : 'Дальше'}</button>
          </div>
        </form>
      )}

      {step === 'help' && (
        <form className="col" onSubmit={(e) => {
          e.preventDefault();
          if (!loginName.trim() || helpCode.replace(/[^A-Za-z0-9]/g, '').length < 8) return setError('Введи телефон или номер и код из 8 знаков.');
          setError('');
          setStep('password');
        }}>
          <div className="aska-step-title">Код от администратора</div>
          <div className="hint">Попроси администратора АСЬКИ: «Ещё» → «Управление АСЬКОЙ» → «Люди» → «Код для входа». Он даст код из 8 знаков — он действует сутки.</div>
          <Field label="Твой телефон, номер АСЬКИ или логин">
            <input className="field" value={loginName} onChange={(e) => setLogin(e.target.value)} placeholder="+7 999…, А 001 МР или логин" autoCapitalize="characters" autoCorrect="off" spellCheck={false} />
          </Field>
          <Field label="Код для входа">
            <input className="field aska-code" value={helpCode} onChange={(e) => setHelpCode(e.target.value.toUpperCase())} placeholder="ABCD-EFGH"
              autoCapitalize="characters" autoCorrect="off" autoComplete="off" spellCheck={false} />
          </Field>
          <div className="err">{error}</div>
          <div className="row mt">
            <button type="button" className="btn" onClick={onNoPhone}>Назад</button>
            <span className="sp" />
            <button className="btn primary">Дальше</button>
          </div>
        </form>
      )}

      {step === 'password' && (
        <form className="col" onSubmit={(e) => {
          e.preventDefault();
          if (password.length < 6) return setError('Пароль — минимум 6 символов.');
          setProgress(0);
          run(async () => {
            await recover(ticket ? { ticket, password } : { login: loginName, helpCode, password }, setProgress);
          });
        }}>
          <div className="aska-step-title">Новый пароль</div>
          <Field label="Пароль (от 6 символов)">
            <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" autoFocus />
          </Field>
          <div className="err">{error}</div>
          <div className="hint">Вход вернётся сразу. Старые сообщения на этом устройстве не откроются — так работает шифрование. Новые придут как обычно.</div>
          <div className="row mt">
            <button type="button" className="btn" onClick={() => setStep(ticket ? 'sms' : 'help')} disabled={busy}>Назад</button>
            <span className="sp" />
            <button className="btn primary" disabled={busy}>{busy ? <Busy label="Создаю ключи…" progress={progress} /> : 'Войти'}</button>
          </div>
        </form>
      )}
    </div>
  );
}
