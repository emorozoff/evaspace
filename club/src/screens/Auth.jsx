import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { PACKAGES } from '../lib/logic.js';
import { money } from '../lib/format.js';
import { Avatar, Btn, Card, Field, Sheet, List, Item, Tag } from '../components/UI.jsx';
import Choice from '../components/Choice.jsx';
import Icon from '../components/Icons.jsx';
import { ROLE_QUESTION } from '../data/onboarding.js';

/* Вход короткий: телефон и код, три поля, пакет. */

export default function Auth({ invite }) {
  const { state, dispatch } = useStore();
  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [about, setAbout] = useState('');
  const [pack, setPack] = useState('pro');
  const [role, setRole] = useState([]);
  const [roleOpen, setRoleOpen] = useState(false);
  const [demo, setDemo] = useState(false);

  // Пригласившего знаем, только если он заходил с этого же устройства; скидка — по коду.
  const inviter = invite ? state.users.find((u) => u.ref === invite) : null;
  const phoneOk = phone.replace(/\D/g, '').length >= 10 && code.length >= 4;
  const roleLabel = role.filter(Boolean).map((r) => ROLE_QUESTION.options.find((o) => o.id === r)?.label || r).join(', ');
  const profileOk = name.trim().length > 1 && role.filter(Boolean).length > 0 && city.trim().length > 1 && about.trim().length > 2;

  return (
    <div className="app">
      <div className="gate">
        <div className="gate__mark"><Icon name="spark" size={30} color="var(--accent)" /></div>
        <div className="center">
          <h1 className="h1">И АЙ КЛАБ</h1>
          <p className="lead" style={{ marginTop: 8 }}>События, команда, рейтинг и люди клуба. Общение — по-прежнему в телеграме.</p>
        </div>

        {invite && (
          <Card variant="accent" className="row">
            {inviter ? <Avatar user={inviter} size={40} /> : <Icon name="gift" size={22} color="var(--accent)" />}
            <div className="grow">
              <div className="t-md">{inviter ? `${inviter.name} приглашает вас` : 'Вы пришли по приглашению'}</div>
              <div className="t-xs dim-2">Скидка 10% на первый месяц уже применена</div>
            </div>
          </Card>
        )}

        {step === 'phone' && (
          <div className="stack">
            <Field label="Телефон">
              <input className="field" inputMode="tel" placeholder="+7 900 000-00-00" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Field label="Код из СМС" hint="Это демо — подойдёт любой код из четырёх цифр">
              <input className="field" inputMode="numeric" placeholder="••••" value={code} onChange={(e) => setCode(e.target.value)} />
            </Field>
            <Btn variant="accent" wide disabled={!phoneOk} onClick={() => setStep('profile')}>Войти</Btn>
            <Btn variant="quiet" wide onClick={() => setDemo(true)}>Посмотреть глазами участника</Btn>
          </div>
        )}

        {step === 'profile' && (
          <div className="stack">
            <Field label="Имя">
              <input className="field" placeholder="Как к вам обращаться" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            {/* Занятие — второй вопрос после имени: с него начинается подбор людей */}
            <Field label="Чем занимаетесь" hint="До двух — по этому подбираются люди и команды">
              <button className={`picker picker--field${role.filter(Boolean).length ? ' picker--on' : ''}`} onClick={() => setRoleOpen(true)}>
                <span className="grow ell">{roleLabel || 'Выберите из списка'}</span>
                <Icon name="down" size={16} />
              </button>
            </Field>
            <Field label="Город" hint="Двое в городе — и появится чат с пятничной встречей">
              <input className="field" list="cities" placeholder="Начните вводить" value={city} onChange={(e) => setCity(e.target.value)} />
            </Field>
            <datalist id="cities">{state.cities.map((c) => <option key={c.id} value={c.name} />)}</datalist>
            <Field label="Ваше дело">
              <input className="field" placeholder="Одной строкой" value={about} onChange={(e) => setAbout(e.target.value)} />
            </Field>
            <Btn variant="accent" wide disabled={!profileOk} onClick={() => { dispatch({ type: 'register', name, city, about, phone, pack, role: role.filter(Boolean), ref: invite }); setStep('pay'); }}>
              Продолжить
            </Btn>
            <div className="t-xs dim-2 center">Фото, ссылки и «что ищу» — потом, в профиле.</div>
          </div>
        )}

        {step === 'pay' && <Paywall selected={pack} onSelect={setPack} discount={Boolean(invite)} />}

        <Sheet open={roleOpen} onClose={() => setRoleOpen(false)} title={ROLE_QUESTION.title} sub={ROLE_QUESTION.hint}>
          <div className="stack">
            <Choice options={ROLE_QUESTION.options} value={role} max={ROLE_QUESTION.max} list onChange={setRole} />
            <Btn variant="accent" wide disabled={!role.filter(Boolean).length} onClick={() => setRoleOpen(false)}>Готово</Btn>
          </div>
        </Sheet>

        <Sheet open={demo} onClose={() => setDemo(false)} title="Войти как участник" sub="Демо: команда, рейтинг и друзья изнутри">
          <List>
            {state.users.filter((u) => u.demo).slice(0, 10).map((u) => (
              <Item key={u.id} lead={<Avatar user={u} size={40} />} title={u.name} sub={u.about} meta={<Tag tone={u.package === 'pro' ? 'violet' : undefined}>{u.package.toUpperCase()}</Tag>} chev={false} onClick={() => dispatch({ type: 'login', userId: u.id })} />
            ))}
          </List>
        </Sheet>
      </div>
    </div>
  );
}

/** «Оплатите, чтобы войти». Оплата снаружи — приложение только читает статус. */
export function Paywall({ selected = 'pro', onSelect, discount = false }) {
  const { dispatch } = useStore();
  const [pack, setPack] = useState(selected);
  const choose = (id) => { setPack(id); onSelect?.(id); };
  return (
    <div className="stack">
      <div className="hdr">Пакет</div>
      {Object.values(PACKAGES).map((p) => (
        <button key={p.id} className={`pack${pack === p.id ? ' pack--on' : ''}`} onClick={() => choose(p.id)}>
          <div className="spread">
            <div>
              <div className="t-lg">{p.title}</div>
              <div className="t-sm dim-2">{p.note}</div>
            </div>
            <div className="center">
              <div className="figure" style={{ fontSize: 17 }}>{money(discount ? Math.round(p.price * 0.9) : p.price)}</div>
              <div className="t-xs dim-2" style={{ marginTop: 3 }}>{discount ? <s>{money(p.price)}</s> : 'в месяц'}</div>
            </div>
          </div>
        </button>
      ))}
      <a className="btn btn--ghost btn--wide" href="https://t.me/" target="_blank" rel="noreferrer">Перейти к оплате</a>
      <Btn variant="accent" wide icon="check" onClick={() => dispatch({ type: 'pay', pack })}>Я оплатил — открыть доступ</Btn>
      <div className="t-xs dim-2 center">В демо вторая кнопка просто открывает доступ.</div>
    </div>
  );
}
