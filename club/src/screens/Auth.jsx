import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { PACKAGES } from '../lib/logic.js';
import { Avatar, Btn, Card, Input, Area, Sheet } from '../components/UI.jsx';
import { IcSpark, IcCheck } from '../components/Icons.jsx';
import { money } from '../lib/format.js';

/* Вход максимально короткий: телефон, три поля, пакет. */

export default function Auth({ invite: refCode }) {
  const { state, dispatch } = useStore();
  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [about, setAbout] = useState('');
  const [pack, setPack] = useState('pro');
  const [demo, setDemo] = useState(false);

  // Пригласившего мы знаем, только если он заходил с этого же устройства.
  // Ссылка работает в любом случае: скидка применяется по самому коду.
  const inviter = refCode ? state.users.find((u) => u.ref === refCode) : null;
  const invited = Boolean(refCode);

  const phoneOk = phone.replace(/\D/g, '').length >= 10;
  const profileOk = name.trim().length > 1 && city.trim().length > 1 && about.trim().length > 2;

  return (
    <div className="paywall">
      <div className="auth-logo">
        <IcSpark size={34} className="t-lime" />
      </div>

      <div className="center stack s">
        <h1 className="t-huge">И АЙ КЛАБ</h1>
        <div className="t-sub">
          Расписание, команды, рейтинг выручки, база знаний и люди. Телеграм оставляем для живого общения.
        </div>
      </div>

      {invited && (
        <Card kind="accent">
          <div className="row">
            {inviter ? <Avatar user={inviter} size={40} /> : <IcSpark size={22} className="t-lime" />}
            <div>
              <div style={{ fontWeight: 700 }}>
                {inviter ? `${inviter.name} приглашает вас в клуб` : 'Вы пришли по приглашению'}
              </div>
              <div className="t-sub">Скидка 10% на первый месяц уже применена</div>
            </div>
          </div>
        </Card>
      )}

      {step === 'phone' && (
        <Card>
          <div className="stack">
            <Input
              label="Телефон"
              inputMode="tel"
              placeholder="+7 900 000-00-00"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Input
              label="Код из СМС"
              inputMode="numeric"
              placeholder="4 цифры"
              hint="Это демо: подойдёт любой код"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <Btn kind="primary" wide disabled={!phoneOk || code.length < 4} onClick={() => setStep('profile')}>
              Войти
            </Btn>
            <Btn kind="ghost" wide onClick={() => setDemo(true)}>
              Посмотреть как участник клуба
            </Btn>
          </div>
        </Card>
      )}

      {step === 'profile' && (
        <Card>
          <div className="stack">
            <div className="t-sub">Три поля — и вы внутри. Фото, ссылки и «что ищу» можно заполнить потом.</div>
            <Input label="Имя" placeholder="Как к вам обращаться" value={name} onChange={(e) => setName(e.target.value)} />
            <Input
              label="Город"
              list="cities"
              placeholder="Начните вводить"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              hint="Как только в городе наберётся двое — появится чат и пятничная встреча"
            />
            <datalist id="cities">
              {state.cities.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
            <Area label="Чем занимаетесь" placeholder="Одной строкой" value={about} onChange={(e) => setAbout(e.target.value)} />
            <Btn
              kind="primary"
              wide
              disabled={!profileOk}
              onClick={() => {
                dispatch({ type: 'register', name, city, about, phone, pack, ref: refCode });
                setStep('pay');
              }}
            >
              Продолжить
            </Btn>
          </div>
        </Card>
      )}

      {step === 'pay' && <Paywall selected={pack} onSelect={setPack} discount={invited} />}

      {demo && <DemoLogin onClose={() => setDemo(false)} />}
    </div>
  );
}

/** Экран «Оплати, чтобы войти». Оплата живёт снаружи, приложение только читает статус. */
export function Paywall({ selected = 'pro', onSelect, discount = false }) {
  const { dispatch } = useStore();
  const [pack, setPack] = useState(selected);
  const choose = (id) => {
    setPack(id);
    onSelect?.(id);
  };

  return (
    <div className="stack">
      <div className="center stack s">
        <div className="t-title">Оплатите доступ</div>
        <div className="t-sub">Оплата проходит вне приложения. После оплаты доступ откроется сам.</div>
      </div>

      {Object.values(PACKAGES).map((p) => (
        <div key={p.id} className={`pack ${pack === p.id ? 'on' : ''}`} onClick={() => choose(p.id)}>
          <div className="split">
            <div>
              <div className="t-title">{p.title}</div>
              <div className="t-sub">{p.note}</div>
            </div>
            <div className="center">
              <div className="mono" style={{ fontWeight: 800 }}>
                {money(discount ? Math.round(p.price * 0.9) : p.price)}
              </div>
              {discount && <div className="t-dim" style={{ textDecoration: 'line-through' }}>{money(p.price)}</div>}
              <div className="t-dim">в месяц</div>
            </div>
          </div>
        </div>
      ))}

      <a className="btn violet wide" href="https://t.me/" target="_blank" rel="noreferrer">
        Перейти к оплате
      </a>
      <Btn kind="primary" wide onClick={() => dispatch({ type: 'pay', pack })}>
        <IcCheck /> Я оплатил — открыть доступ
      </Btn>
      <div className="t-dim center">В демо вторая кнопка просто открывает доступ.</div>
    </div>
  );
}

function DemoLogin({ onClose }) {
  const { state, dispatch } = useStore();
  const list = state.users.filter((u) => u.demo).slice(0, 12);
  return (
    <Sheet title="Войти как участник" sub="Демо-режим: чтобы посмотреть команды, рейтинг и друзей изнутри" onClose={onClose}>
      <div className="stack s">
        {list.map((u) => (
          <div key={u.id} className="person" onClick={() => dispatch({ type: 'login', userId: u.id })} style={{ padding: '8px 0', cursor: 'pointer' }}>
            <Avatar user={u} size={40} />
            <div style={{ minWidth: 0 }}>
              <div className="ellipsis" style={{ fontWeight: 600 }}>{u.name}</div>
              <div className="t-dim ellipsis">{u.about}</div>
            </div>
            <span className={`chip ${u.package === 'pro' ? 'pro' : ''}`}>{u.package.toUpperCase()}</span>
          </div>
        ))}
      </div>
    </Sheet>
  );
}
