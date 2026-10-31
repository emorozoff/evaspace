// Окно «АСЬКА — вход в сеть». Три пути: вход (телефон или номер + пароль), регистрация по приглашению
// (имя → телефон → код из СМС → пароль) и «не помню пароль» (код из СМС или от администратора → новый пароль).
// Плюс ссылка супер-админа (#super=…): войти своим паролем, задать новый или создать новый вход.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { FormEvent, ReactNode } from 'react';
import { checkInvite, register, login, recover, sendCode, verifyCode, smsAvailable, superLinkInfo, claimSuperWithLogin, claimSuperWithPassword, claimSuperHere, logout } from '../lib/store.ts';
import type { SuperLinkInfo } from '../lib/store.ts';
import { ApiError } from '../lib/api.ts';
import { isIOS, isStandalone } from '../lib/platform.ts';
import { getDesign, setDesign, logoFlower, flower } from '../lib/aska.ts';
import type { Design } from '../lib/aska.ts';
import { Win, Svg, Dialog } from './Win.tsx';
import { Plate } from './Plate.tsx';
import { PLACES, VIP_REGIONS, placeOf, lastPlace, rememberPlace } from '../lib/places.ts';
import { setPlace as savePlace, setVipRegion } from '../lib/levels.ts';
import { History } from './History.tsx';
import { Book } from './Book.tsx';

export const APP_VERSION = 'v2.0';

function inviteFromUrl() {
  const m = location.hash.match(/invite=([A-Za-z0-9-]+)/);
  return m ? m[1].toUpperCase() : '';
}
export function superFromUrl() {
  const m = location.hash.match(/super=([A-Za-z0-9-]+)/);
  return m ? m[1].toUpperCase() : '';
}
const clearHash = () => history.replaceState(null, '', location.pathname + location.search);

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
  const [superCode, setSuperCode] = useState(superFromUrl());
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
            {superCode
              ? <SuperClaim code={superCode} onCancel={() => { clearHash(); setSuperCode(''); }} />
              : isIOS && !isStandalone && !skipInstall
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
  blocked: 'Этот вход заблокирован администратором АСЬКИ.',
  too_many: 'Слишком много попыток. Подожди 10–15 минут.',
  network: 'Нет связи с сервером. Проверь интернет.',
  backup_broken: 'Не получилось восстановить ключ шифрования.',
  link_invalid: 'Ссылка не подходит: устарела или уже использована. Попроси новую.',
  username_taken: 'Этот логин уже занят. Попроси новую ссылку.',
  unauthorized: 'Это не тот вход, для которого ссылка.',
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

// Вход: номер АСЬКИ пишется прямо в «номер» — серия (А 001 МР), а регион выбирается: это место, где ты сейчас
// (Москва 197, Питер 198, Бали, Дубай…; у Голд — 777 или 888). Можно и по телефону или старому логину.
const LAT2CYR: Record<string, string> = { A: 'А', B: 'В', E: 'Е', K: 'К', M: 'М', H: 'Н', O: 'О', P: 'Р', C: 'С', T: 'Т', Y: 'У', X: 'Х' };
const seriesText = (v: string) => v.toUpperCase().replace(/[ABEKMHOPCTYX]/g, (c) => LAT2CYR[c] || c).replace(/[^0-9А-ЯЁ ]/g, '').slice(0, 10);

function Login({ onInvite, onForgot }: { onInvite: () => void; onForgot: (phone: string) => void }) {
  const [byPlate, setByPlate] = useState(true);
  const [story, setStory] = useState<'' | 'history' | 'book'>('');
  const [loginName, setLogin] = useState('');
  const [region, setRegion] = useState(lastPlace());
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const vip = VIP_REGIONS.includes(region);
  const regionCode = vip ? region : placeOf(region)?.code || '';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!loginName.trim() || !password) return setError(byPlate ? 'Введи номер АСЬКИ и пароль.' : 'Введи телефон или логин и пароль.');
    setBusy(true);
    setProgress(0);
    try {
      await login(loginName, password, setProgress, byPlate ? regionCode : undefined);
      // регион «где я» — сразу на номер (у Голд — VIP 777/888)
      if (byPlate) {
        if (vip) setVipRegion(region).catch(() => {});
        else { rememberPlace(region); savePlace(region).catch(() => {}); }
      }
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <form className="col" onSubmit={submit}>
      <div className="aska-step-title">Вход</div>
      <div className="aska-plate-hero">
        <Plate plate="А777МР777" country="RU" size="l" region={{ code: '777', flag: '🇷🇺', vip: true, ru: true }} />
        <small>Например, <b>А 777 МР 777</b> — это АСЬКА Кирилла. У каждого свой номер — им и входят.</small>
      </div>
      {byPlate ? (
        <Field label="Твой номер АСЬКИ">
          <span className={`aska-plate-input${vip ? ' vip' : ''}`}>
            <input className="pi-series" value={loginName} onChange={(e) => setLogin(seriesText(e.target.value))} placeholder="А 001 МР"
              autoCapitalize="characters" autoCorrect="off" spellCheck={false} autoComplete="username" aria-label="Серия номера: буква, три цифры, две буквы" />
            <select className="pi-region" value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Регион — где ты сейчас">
              <optgroup label="Где ты сейчас">
                {PLACES.map((p) => <option key={p.key} value={p.key}>{p.code} {p.flag} {p.name}</option>)}
              </optgroup>
              <optgroup label="VIP (Голд и Блэк)">
                {VIP_REGIONS.map((r) => <option key={r} value={r}>{r} ⭐ VIP</option>)}
              </optgroup>
            </select>
          </span>
        </Field>
      ) : (
        <Field label="Телефон или логин">
          <input className="field" value={loginName} onChange={(e) => setLogin(e.target.value)} placeholder="+7 999… или логин"
            autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username" />
        </Field>
      )}
      {byPlate && <div className="hint aska-region-hint">Регион — это место, где ты сейчас: {placeOf(region)?.name || `VIP ${region}`}. Его увидят на твоём номере.</div>}
      <Field label="Пароль">
        <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
      </Field>
      <div className="err">{error}</div>
      <button className="btn primary aska-wide" disabled={busy}>{busy ? <Busy label="Проверяю пароль…" progress={progress} /> : 'Войти'}</button>
      <div className="aska-links">
        <button type="button" className="link aska-linkbtn" onClick={() => { setByPlate((v) => !v); setLogin(''); setError(''); }}>{byPlate ? 'Войти по телефону или логину' : 'Войти по номеру АСЬКИ'}</button>
        <button type="button" className="link aska-linkbtn" onClick={() => onForgot(/\d{6,}/.test(loginName.replace(/\D/g, '')) && !byPlate ? loginName : '')}>Не помню пароль</button>
        <button type="button" className="link aska-linkbtn" onClick={onInvite}>У меня приглашение</button>
      </div>
      <button type="button" className="link aska-linkbtn aska-about-link" onClick={() => setStory('book')}>📖 Книга перемен — история нового интернета</button>
      <button type="button" className="link aska-linkbtn aska-about-link" onClick={() => setStory('history')}>📜 История АСЬКИ — с чего всё началось</button>
      <a className="link aska-linkbtn aska-about-link" href="/site/" target="_blank" rel="noopener">Что такое АСЬКА? Правила и уровни →</a>
      {/* поверх всей страницы: окно входа анимируется, и fixed внутри него был бы зажат его рамками */}
      {story && createPortal(
        <div className={`overlay aska-story-ov${story === 'book' ? ' aska-book-ov' : ''}`} onClick={() => setStory('')}>
          <div className="aska-story-win" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="btn aska-story-close" onClick={() => setStory('')} aria-label="Закрыть">×</button>
            {story === 'book' ? <Book /> : <History />}
          </div>
        </div>,
        document.body,
      )}
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

// Ссылка супер-админа. Уже есть в АСЬКЕ — войти своим паролем (или задать новый); нового входа нет — имя и пароль.
function SuperClaim({ code, onCancel }: { code: string; onCancel: () => void }) {
  const [info, setInfo] = useState<SuperLinkInfo | null>(null);
  const [error, setError] = useState('');
  const [forgot, setForgot] = useState(false);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  useEffect(() => { superLinkInfo(code).then(setInfo).catch((e) => setError(errorText(e))); }, [code]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!info) return;
    if (!info.exists && !name.trim()) return setError('Напиши имя — так тебя увидят друзья.');
    if (password.length < 6) return setError('Пароль — минимум 6 символов.');
    setError('');
    setBusy(true);
    setProgress(0);
    clearHash(); // до входа: иначе открывшееся приложение снова увидит ссылку
    try {
      if (info.exists && !forgot) await claimSuperWithLogin(code, info.username, password, setProgress);
      else await claimSuperWithPassword(code, password, info.exists ? undefined : name.trim(), setProgress);
    } catch (err) {
      history.replaceState(null, '', `#super=${code}`);
      setError(errorText(err));
      setBusy(false);
    }
  }

  if (!info) {
    return (
      <div className="col aska-auth">
        <div className="aska-step-title">👑 Вход супер-админа</div>
        <div className={error ? 'err' : 'hint'}>{error || 'Проверяю ссылку…'}</div>
        {error && <button type="button" className="btn aska-wide" onClick={onCancel}>Обычный вход</button>}
      </div>
    );
  }
  return (
    <form className="col aska-auth" onSubmit={submit}>
      <div className="aska-step-title">👑 {info.invitedBy ? `${info.invitedBy} зовёт тебя супер-админом` : 'Ты — супер-админ АСЬКИ'}</div>
      <div className="hint">Супер-админ может всё, что админы (номера, аськоины, блокировка, голд), и ещё снимать голд с админов и блокировать админов.</div>
      {info.exists ? (
        <div className="aska-note">Вход: <b>{info.displayName}</b> · логин <b>{info.username}</b></div>
      ) : (
        <>
          <div className="aska-note">Новый вход · логин <b>{info.username}</b></div>
          <Field label="Имя (его увидят друзья)">
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus />
          </Field>
        </>
      )}
      <Field label={info.exists && !forgot ? 'Твой пароль' : 'Придумай пароль (от 6 символов)'}>
        <PasswordInput value={password} onChange={setPassword} autoComplete={info.exists && !forgot ? 'current-password' : 'new-password'} autoFocus={info.exists} />
      </Field>
      {info.exists && forgot && <div className="hint">Вход вернётся с новым паролем. Старые сообщения на новом пароле не откроются — так работает шифрование.</div>}
      <div className="err">{error}</div>
      <button className="btn primary aska-wide" disabled={busy}>
        {busy ? <Busy label={info.exists && !forgot ? 'Проверяю пароль…' : 'Создаю ключи…'} progress={progress} /> : info.exists ? 'Войти и стать супер-админом' : 'Создать вход'}
      </button>
      <div className="aska-links">
        {info.exists && <button type="button" className="link aska-linkbtn" onClick={() => { setForgot((v) => !v); setPassword(''); setError(''); }}>{forgot ? 'Я помню пароль' : 'Не помню пароль'}</button>}
        <button type="button" className="link aska-linkbtn" onClick={onCancel}>Обычный вход</button>
      </div>
    </form>
  );
}

// Ссылку супер-админа открыли, уже войдя в АСЬКУ: тем же входом — принять сразу, другим — выйти и открыть заново
export function SuperLinkInApp({ code, me, onClose }: { code: string; me: string; onClose: () => void }) {
  const [info, setInfo] = useState<SuperLinkInfo | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { superLinkInfo(code).then(setInfo).catch((e) => setError(errorText(e))); }, [code]);
  const close = () => { clearHash(); onClose(); };
  const mine = info && info.exists && info.username === me;
  async function accept() {
    setBusy(true);
    try { await claimSuperHere(code); setDone(true); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  return (
    <Dialog title="👑 Супер-админ" onClose={close}
      buttons={done || error || !info ? <button className="btn primary" onClick={close}>Хорошо</button>
        : mine ? <><button className="btn primary" disabled={busy} onClick={accept}>Стать супер-админом</button><button className="btn" onClick={close}>Не сейчас</button></>
          : <><button className="btn primary" onClick={() => logout()}>Выйти и открыть ссылку</button><button className="btn" onClick={close}>Отмена</button></>}>
      <div className="col">
        {done ? <div className="aska-note">Готово — ты супер-админ АСЬКИ 👑 Всё управление — «Ещё» → «Управление АСЬКОЙ».</div>
          : error ? <div className="err">{error}</div>
            : !info ? <div className="hint">Проверяю ссылку…</div>
              : mine ? <div className="hint">{info.invitedBy ? `${info.invitedBy} зовёт тебя` : 'Тебя зовут'} супер-админом АСЬКИ: можно всё, что админам, и ещё снимать голд с админов и блокировать админов.</div>
                : <div className="hint">Эта ссылка — для {info.exists ? `входа ${info.displayName} (логин ${info.username})` : `нового входа «${info.username}»`}, а ты сейчас в АСЬКЕ под другим входом. Выйди и открой ссылку заново.</div>}
      </div>
    </Dialog>
  );
}
