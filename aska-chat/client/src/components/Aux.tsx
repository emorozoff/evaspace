// Окно-приставка «Аськи»: круги, мой ИИ, «Ещё» (профиль и настройки), приглашение, управление.
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useStore } from '../useStore.ts';
import {
  enablePush, logout, myPublicKey, createInvite, listInvites, updateProfile, linkPhone, sendCode, verifyCode, game,
} from '../lib/store.ts';
import { ApiError } from '../lib/api.ts';
import { safetyCode, fromB64 } from '../lib/crypto.ts';
import { isIOS, isStandalone } from '../lib/platform.ts';
import { getDesign, setDesign, soundEnabled, setSoundEnabled, play, flower } from '../lib/aska.ts';
import type { Design } from '../lib/aska.ts';
import { DesignPick, APP_VERSION } from './Welcome.tsx';
import { Win, Ico, Dialog } from './Win.tsx';
import { Plate } from './Plate.tsx';
import { Circles } from './Circles.tsx';
import { MyAI } from './MyAI.tsx';
import { Admin } from './Admin.tsx';

export type AuxKind = 'settings' | 'invite' | 'circles' | 'myai' | 'admin';

const TITLES: Record<AuxKind, string> = {
  settings: 'Ещё', invite: 'Позвать друга', circles: 'Круги', myai: 'Мой ИИ', admin: 'Управление АСЬКОЙ',
};

export function Aux({ kind, onBack, onOpen, onAux }: { kind: AuxKind; onBack: () => void; onOpen: (chatId: string) => void; onAux: (k: AuxKind) => void }) {
  return (
    <Win id="auxwin" className="aux" title={TITLES[kind]} onBack={onBack} onClose={onBack} closeClass="close-aux">
      <div className="aux-body">
        {kind === 'invite' && <Invite />}
        {kind === 'settings' && <Settings onAux={onAux} />}
        {kind === 'circles' && <Circles onOpen={onOpen} />}
        {kind === 'myai' && <MyAI onOpen={onOpen} />}
        {kind === 'admin' && <Admin />}
      </div>
    </Win>
  );
}

function Settings({ onAux }: { onAux: (k: AuxKind) => void }) {
  const s = useStore();
  const [design, setD] = useState<Design>(getDesign());
  const [sound, setSound] = useState(soundEnabled());
  const [myCode, setMyCode] = useState('');
  const [pushError, setPushError] = useState('');
  const [confirmExit, setConfirmExit] = useState(false);
  const [editing, setEditing] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [score, setScore] = useState<{ right: number; total: number; top: { userId: number; right: number; total: number }[] } | null>(null);
  const me = s.me ? s.users[s.me.userId] : undefined;

  useEffect(() => { myPublicKey().then((pk) => pk && setMyCode(safetyCode(fromB64(pk)))); }, []);
  useEffect(() => { game().then(setScore).catch(() => {}); }, []);

  const friends = Object.values(s.users).filter((u) => u.id !== s.me?.userId && (u.kind || 'human') === 'human')
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'ru'));

  let push;
  if (s.pushState === 'subscribed') push = <span>Включены ✓</span>;
  else if (s.pushState === 'denied') push = <span className="hint">Выключены в настройках iPhone: «Уведомления» → «АСЬКА».</span>;
  else if (s.pushState === 'unsupported') push = <span className="hint">{isIOS && !isStandalone ? 'Открой АСЬКУ с экрана «Домой».' : 'Этот браузер не умеет.'}</span>;
  else push = <button className="btn primary" onClick={() => enablePush().catch(() => setPushError('Не получилось включить.'))}>Включить</button>;

  const phone = s.profile?.phone;
  const phoneText = phone && phone.startsWith('+7') && phone.length === 12 ? `+7 ${phone.slice(2, 5)} ${phone.slice(5, 8)}-${phone.slice(8, 10)}-${phone.slice(10)}` : phone;

  return (
    <>
      <div className="groupbox aska-me-card">
        <div className="legend">Мой профиль</div>
        <div className="aska-profile-head">
          <Ico className="ico big" html={flower(s.connected ? 'online' : 'offline', 36)} />
          <div className="who">
            <b>{me?.displayName}</b>
            <div className="muted">{[me?.city, me?.about].filter(Boolean).join(' · ') || 'расскажи о себе'}</div>
          </div>
          <button className="btn" onClick={() => setEditing(true)}>Изменить</button>
        </div>
        <div className="aska-profile-plate"><Plate plate={me?.plate} size="l" /></div>
        <div className="hint center">Твой номер в АСЬКЕ — им можно входить и делиться с друзьями.</div>
        <div className="row aska-kv">
          <span>Телефон</span>
          <b>{phone ? `${phoneText}${s.profile?.phoneVerified ? ' ✓' : ''}` : 'не привязан'}</b>
          <span className="sp" />
          <button className="btn" onClick={() => setPhoneOpen(true)}>{phone ? 'Сменить' : 'Привязать'}</button>
        </div>
        {!phone && <div className="hint">С телефоном легко вернуть вход, если забудешь пароль.</div>}
      </div>

      <div className="aska-actions">
        <button className="btn primary" onClick={() => onAux('invite')}>➕ Позвать друга</button>
        {s.profile?.isAdmin && <button className="btn" onClick={() => onAux('admin')}>👑 Управление АСЬКОЙ</button>}
      </div>

      <div className="groupbox">
        <div className="legend">Вид</div>
        <DesignPick value={design} onChange={(d) => { setDesign(d); setD(d); }} />
      </div>

      <div className="groupbox">
        <div className="legend">Звук и уведомления</div>
        <label className="row">
          <input type="checkbox" checked={sound} onChange={(e) => { setSoundEnabled(e.target.checked); setSound(e.target.checked); }} />
          <span className="sp">«О-оу» и голоса смайлов</span>
          <button className="btn" onClick={() => play('incoming')} disabled={!sound}>Послушать</button>
        </label>
        <div className="row mt"><span className="sp">Уведомления, когда АСЬКА закрыта</span>{push}</div>
        {pushError && <div className="err">{pushError}</div>}
      </div>

      <div className="groupbox">
        <div className="legend">Игра «Кто здесь ИИ?»</div>
        <div className="hint">Среди людей в АСЬКЕ есть ИИ. Открой профиль человека и попробуй угадать — попытка одна.</div>
        {score && <div className="row aska-kv"><span>Ты угадал(а)</span><b>{score.right} из {score.total}</b></div>}
        {score && score.top.length > 0 && (
          <ol className="aska-top">
            {score.top.slice(0, 5).map((t) => <li key={t.userId}>{s.users[t.userId]?.displayName || '?'} — {t.right} из {t.total}</li>)}
          </ol>
        )}
      </div>

      <details className="groupbox aska-codes">
        <summary className="legend">Коды безопасности</summary>
        <div className="row"><b>Мой код</b><span className="code">{myCode}</span></div>
        {friends.map((u) => (
          <div className="row" key={u.id}>
            <span>{u.displayName}{u.keyChanged && <span className="err"> — ключ изменился!</span>}</span>
            <span className="code">{safetyCode(fromB64(u.pk))}</span>
          </div>
        ))}
        <div className="hint mt">Сверь коды при встрече: если цифры совпадают с теми, что у друга в «Моём коде», вашу переписку никто не подменяет.</div>
      </details>

      <div className="hint">
        🔒 Переписка между людьми шифруется на телефоне — её не видит даже сервер. То, что пишешь ИИ (Аське, личным ИИ, ИИ-людям
        и в круги, где они есть), читает сервер и нейросеть.
      </div>

      <div className="right"><button className="btn" onClick={() => setConfirmExit(true)}>Выйти из АСЬКИ</button></div>
      <div className="center muted mt">АСЬКА · {APP_VERSION}</div>

      {editing && <EditProfile onClose={() => setEditing(false)} />}
      {phoneOpen && <PhoneDialog onClose={() => setPhoneOpen(false)} />}
      {confirmExit && (
        <Dialog title="Выход" onClose={() => setConfirmExit(false)}
          buttons={<>
            <button className="btn primary" onClick={() => logout()}>Да</button>
            <button className="btn" onClick={() => setConfirmExit(false)}>Нет</button>
          </>}>
          Выйти из АСЬКИ? Переписка на этом устройстве удалится. Вернуть её можно, войдя по телефону или номеру и паролю.
        </Dialog>
      )}
    </>
  );
}

function EditProfile({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const me = s.me ? s.users[s.me.userId] : undefined;
  const [name, setName] = useState(me?.displayName || '');
  const [city, setCity] = useState(me?.city || '');
  const [about, setAbout] = useState(me?.about || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('Имя не может быть пустым.');
    setBusy(true);
    try { await updateProfile({ displayName: name.trim(), city: city.trim(), about: about.trim() }); onClose(); } catch { setError('Не получилось сохранить.'); setBusy(false); }
  }
  return (
    <Dialog title="Мой профиль" onClose={onClose}>
      <form className="col" onSubmit={save}>
        <label className="aska-field"><span className="lbl">Имя</span><input className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} /></label>
        <label className="aska-field"><span className="lbl">Город</span><input className="field" value={city} onChange={(e) => setCity(e.target.value)} maxLength={40} /></label>
        <label className="aska-field"><span className="lbl">О себе</span><textarea className="field" rows={3} value={about} onChange={(e) => setAbout(e.target.value)} maxLength={200} placeholder="пара слов: чем живёшь, что любишь" /></label>
        {error && <div className="err">{error}</div>}
        <div className="btns"><button className="btn primary" disabled={busy}>Сохранить</button><button type="button" className="btn" onClick={onClose}>Отмена</button></div>
      </form>
    </Dialog>
  );
}

function PhoneDialog({ onClose }: { onClose: () => void }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fail = (e: unknown) => {
    const c = e instanceof ApiError ? e.code : '';
    setError(c === 'phone_taken' ? 'Этот телефон уже привязан к другой АСЬКЕ.' : c === 'bad_code' ? 'Код не подошёл.' : c === 'bad_phone' ? 'Проверь номер.' : c === 'too_many' ? 'Слишком много попыток, подожди.' : 'Не получилось. Попробуй ещё раз.');
  };
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (step === 'phone') {
        const r = await sendCode(phone, 'link');
        if (r.mode === 'sms') { setStep('code'); return; }
        await linkPhone(phone);
        onClose();
      } else {
        await linkPhone(phone, await verifyCode(phone, 'link', code));
        onClose();
      }
    } catch (err) { fail(err); } finally { setBusy(false); }
  }
  return (
    <Dialog title="Телефон" onClose={onClose}>
      <form className="col" onSubmit={submit}>
        {step === 'phone' ? (
          <label className="aska-field"><span className="lbl">Номер телефона</span>
            <input className="field" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 999 123-45-67" autoFocus />
          </label>
        ) : (
          <label className="aska-field"><span className="lbl">Код из СМС на {phone}</span>
            <input className="field aska-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
          </label>
        )}
        <div className="hint">Друзья твой телефон не видят. Он нужен, чтобы войти на новом устройстве и вернуть вход.</div>
        {error && <div className="err">{error}</div>}
        <div className="btns"><button className="btn primary" disabled={busy}>{step === 'phone' ? 'Дальше' : 'Подтвердить'}</button><button type="button" className="btn" onClick={onClose}>Отмена</button></div>
      </form>
    </Dialog>
  );
}

function Invite() {
  // Приглашения одноразовые: на каждого друга — своё. Показываем все свободные и даём сделать ещё.
  const [codes, setCodes] = useState<string[] | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        let list = (await listInvites()).invites.map((i) => i.code);
        if (!list.length) list = [(await createInvite()).code];
        setCodes(list);
        setCurrent(list[0]);
      } catch {
        setError('Не получилось создать приглашение. Проверь интернет.');
      }
    })();
  }, []);

  async function more() {
    setBusy(true);
    setError('');
    try {
      const { code } = await createInvite();
      setCodes((c) => [code, ...(c || [])]);
      setCurrent(code);
      setCopied(false);
    } catch {
      setError('Не получилось. Попробуй ещё раз чуть позже.');
    } finally {
      setBusy(false);
    }
  }

  const link = current ? `${location.origin}/#invite=${current}` : '';
  const text = `Привет! Зову тебя в АСЬКУ — наш мессенджер.\nОткрой ссылку в Safari на iPhone: ${link}`;

  async function share() {
    if (navigator.share) {
      try { await navigator.share({ text }); } catch { /* закрыли окно */ }
      return;
    }
    copy();
  }
  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); } catch { /* нет доступа */ }
  }

  return (
    <>
      <div className="groupbox">
        <div className="legend">Приглашение для друга</div>
        {error && <div className="err">{error}</div>}
        {!codes && !error && <div className="hint">Создаю приглашение…</div>}
        {current && (
          <div className="col">
            <div className="uin-box">{current}</div>
            <div className="hint">Одно приглашение — для одного друга. Друг откроет ссылку, напишет имя и телефон — и получит свой номер АСЬКИ.</div>
            <div className="aska-invite-link muted">{link}</div>
            <div className="row mt">
              <button className="btn" onClick={copy}>{copied ? 'Скопировано' : 'Скопировать'}</button>
              <span className="sp" />
              <button className="btn primary" onClick={share}>Отправить</button>
            </div>
          </div>
        )}
      </div>
      {codes && (
        <div className="groupbox">
          <div className="legend">Свободные приглашения ({codes.length})</div>
          <div className="chips">
            {codes.map((c) => (
              <button key={c} className={`chip${c === current ? ' on' : ''}`} onClick={() => { setCurrent(c); setCopied(false); }}>{c}</button>
            ))}
          </div>
          <div className="right mt"><button className="btn" onClick={more} disabled={busy}>{busy ? 'Создаю…' : '+ Ещё приглашение'}</button></div>
        </div>
      )}
    </>
  );
}
