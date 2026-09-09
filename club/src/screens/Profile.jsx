import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { PACKAGES, cityName, teamOf, referralStats } from '../lib/logic.js';
import { SKILLS } from '../data/people.js';
import { dateShort, addMonths } from '../lib/time.js';
import { money } from '../lib/format.js';
import { readImage } from '../lib/image.js';
import { Avatar, Btn, Card, Input, Area, Sheet, Stat, Switch } from '../components/UI.jsx';
import { IcSpark, IcNext, IcOut, IcEdit, IcDownload } from '../components/Icons.jsx';
import { VERSION } from '../version.js';

export default function Profile({ navigate }) {
  const { state, me, dispatch } = useStore();
  const [edit, setEdit] = useState(false);
  const [packs, setPacks] = useState(false);
  const team = teamOf(state, me.id);
  const referral = referralStats(state, me.id);

  let nextCharge = me.joinedAt;
  while (nextCharge < Date.now()) nextCharge = addMonths(nextCharge, 1);

  const set = (patch) => dispatch({ type: 'profile', patch, silent: true });

  return (
    <div className="screen">
      <div className="topbar">
        <div className="logo">
          <div className="mark"><IcSpark size={16} className="t-lime" /></div>
          <h1>Профиль</h1>
        </div>
        <div className="spacer" />
        <button className="iconbtn" onClick={() => setEdit(true)} aria-label="Редактировать">
          <IcEdit />
        </button>
      </div>

      <div className="hero">
        <div className="row">
          <Avatar user={me} size={64} />
          <div style={{ minWidth: 0 }}>
            <div className="t-title ellipsis">{me.name}</div>
            <div className="t-sub ellipsis">{cityName(state, me.cityId)}</div>
            <div className="t-dim ellipsis" style={{ marginTop: 2 }}>{me.about}</div>
          </div>
        </div>
        {me.lookingFor && <div className="t-sub" style={{ marginTop: 12 }}>Ищу: {me.lookingFor}</div>}
        {(me.skills || []).length > 0 && (
          <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
            {me.skills.map((s) => (
              <span key={s} className="chip static">{s}</span>
            ))}
          </div>
        )}
      </div>

      <div className="grid3" style={{ marginTop: 10 }}>
        <Stat value={PACKAGES[me.package].title} label="пакет" />
        <Stat value={money(me.bonus || 0)} label="бонусы" tone="t-lime" />
        <Stat value={referral.paid} label="привёл" />
      </div>

      <Card style={{ marginTop: 10 }}>
        <div className="split">
          <div>
            <div className="t-title">{PACKAGES[me.package].title}</div>
            <div className="t-sub">{PACKAGES[me.package].note}</div>
            <div className="t-dim" style={{ marginTop: 4 }}>
              Следующее списание {dateShort(nextCharge)} · {money(PACKAGES[me.package].price)}
            </div>
          </div>
          <Btn kind="soft" small onClick={() => setPacks(true)}>Сменить</Btn>
        </div>
      </Card>

      <div className="stack" style={{ marginTop: 10 }}>
        <Card tap onClick={() => navigate('/invite')}>
          <div className="split">
            <div>
              <div className="t-title">Пригласить друга</div>
              <div className="t-sub">Ссылка, бонусы и текст для сторис</div>
            </div>
            <IcNext />
          </div>
        </Card>
        {team && (
          <Card tap onClick={() => navigate(`/team/${team.id}`)}>
            <div className="split">
              <div>
                <div className="t-title">Команда «{team.name}»</div>
                <div className="t-sub">{team.idea}</div>
              </div>
              <IcNext />
            </div>
          </Card>
        )}
        <Card tap onClick={() => navigate(`/city/${me.cityId}`)}>
          <div className="split">
            <div>
              <div className="t-title">Город {cityName(state, me.cityId)}</div>
              <div className="t-sub">Пятница, чат и участники</div>
            </div>
            <IcNext />
          </div>
        </Card>
        <Card tap onClick={() => navigate('/install')}>
          <div className="split">
            <div>
              <div className="t-title">Установить на телефон</div>
              <div className="t-sub">Иконка на экране, работа офлайн</div>
            </div>
            <IcDownload />
          </div>
        </Card>
      </div>

      <div className="section"><h2>Настройки</h2></div>
      <Card>
        <Switch title="Уведомления" sub="Не больше пяти в неделю" on={me.notifications !== false} onChange={(v) => set({ notifications: v })} />
        <div className="divider" />
        <Switch title="Участвовать в рандом-кофе" sub="Пара каждый понедельник" on={me.coffeeEnabled} onChange={(v) => set({ coffeeEnabled: v })} />
        <div className="divider" />
        <Switch title="Показывать меня в каталоге" sub="Иначе вас не будет в разделе «Люди»" on={me.visible !== false} onChange={(v) => set({ visible: v })} />
      </Card>

      <div className="stack" style={{ marginTop: 18 }}>
        <Btn kind="ghost" wide onClick={() => navigate('/admin')}>
          Админка клуба
        </Btn>
        <Btn kind="soft" wide onClick={() => dispatch({ type: 'logout' })}>
          <IcOut /> Выйти
        </Btn>
        <Btn
          kind="danger"
          wide
          onClick={() => {
            if (confirm('Пересоздать демо-данные? Ваш профиль и записи в этом браузере будут удалены.')) dispatch({ type: 'reset' });
          }}
        >
          Сбросить демо-данные
        </Btn>
      </div>

      <div className="t-dim center" style={{ marginTop: 18 }}>
        Данные хранятся в этом браузере. Оплата проходит вне приложения — приложение только читает статус подписки.
        <div style={{ marginTop: 6 }}>Версия {VERSION}</div>
      </div>

      {edit && <EditSheet onClose={() => setEdit(false)} />}
      {packs && <PackSheet onClose={() => setPacks(false)} />}
    </div>
  );
}

function EditSheet({ onClose }) {
  const { state, me, dispatch } = useStore();
  const [form, setForm] = useState({
    name: me.name,
    city: cityName(state, me.cityId),
    about: me.about,
    lookingFor: me.lookingFor || '',
    tg: me.tg || '',
    links: me.links || '',
    photo: me.photo || '',
    skills: me.skills || [],
  });
  const [error, setError] = useState('');

  const field = (key) => ({ value: form[key], onChange: (e) => setForm({ ...form, [key]: e.target.value }) });

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setForm({ ...form, photo: await readImage(file) });
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleSkill = (skill) =>
    setForm({
      ...form,
      skills: form.skills.includes(skill) ? form.skills.filter((s) => s !== skill) : [...form.skills, skill].slice(0, 5),
    });

  return (
    <Sheet title="Профиль" sub="Всё, кроме имени и города, можно оставить пустым" onClose={onClose}>
      <div className="stack">
        <div className="row">
          <Avatar user={{ ...me, photo: form.photo }} size={64} />
          <label className="btn soft s" style={{ cursor: 'pointer' }}>
            Загрузить фото
            <input type="file" accept="image/*" onChange={pickPhoto} style={{ display: 'none' }} />
          </label>
          {form.photo && (
            <Btn kind="ghost" small onClick={() => setForm({ ...form, photo: '' })}>
              Убрать
            </Btn>
          )}
        </div>
        {error && <div className="t-red">{error}</div>}

        <Input label="Имя" {...field('name')} />
        <Input label="Город" list="cities-edit" {...field('city')} hint="Смена города меняет ваши пятничные встречи" />
        <datalist id="cities-edit">
          {state.cities.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
        <Area label="Чем занимаюсь" {...field('about')} />
        <Area label="Что ищу" placeholder="Партнёра, клиентов, наставника" {...field('lookingFor')} />
        <Input label="Телеграм" placeholder="@username" {...field('tg')} />
        <Input label="Ссылка" placeholder="Сайт или соцсеть" {...field('links')} />

        <div className="field">
          <label>Навыки — до пяти</label>
          <div className="row wrap" style={{ gap: 6 }}>
            {SKILLS.map((s) => (
              <span key={s} className={`chip ${form.skills.includes(s) ? 'on' : ''}`} onClick={() => toggleSkill(s)}>
                {s}
              </span>
            ))}
          </div>
        </div>

        <Btn
          kind="primary"
          wide
          disabled={!form.name.trim() || !form.city.trim()}
          onClick={() => {
            dispatch({ type: 'profile', patch: form });
            onClose();
          }}
        >
          Сохранить
        </Btn>
      </div>
    </Sheet>
  );
}

function PackSheet({ onClose }) {
  const { me, dispatch } = useStore();
  const [pack, setPack] = useState(me.package);
  return (
    <Sheet title="Пакет" sub="Оплата проходит вне приложения" onClose={onClose}>
      <div className="stack">
        {Object.values(PACKAGES).map((p) => (
          <div key={p.id} className={`pack ${pack === p.id ? 'on' : ''}`} onClick={() => setPack(p.id)}>
            <div className="split">
              <div>
                <div className="t-title">{p.title}</div>
                <div className="t-sub">{p.note}</div>
              </div>
              <div className="mono" style={{ fontWeight: 800 }}>{money(p.price)}</div>
            </div>
          </div>
        ))}
        <Btn
          kind="primary"
          wide
          onClick={() => {
            dispatch({ type: 'profile', patch: { package: pack } });
            onClose();
          }}
        >
          Перейти на {PACKAGES[pack].title}
        </Btn>
      </div>
    </Sheet>
  );
}
