import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { cityStats, cityName, goingUsers, leaderboard, PACKAGES } from '../lib/logic.js';
import { dateShort, inputValue, isoDate, timeOf } from '../lib/time.js';
import { money, downloadCsv } from '../lib/format.js';
import { Avatar, Btn, Card, Input, Area, Select, Sheet, Stat, TopBar } from '../components/UI.jsx';
import { IcSearch, IcDownload, IcPlus } from '../components/Icons.jsx';

const PASSWORD = 'club2026';

/* Админка. По ТЗ это отдельный веб-экран: тот же адрес, раздел #/admin. */

export default function Admin({ navigate, now }) {
  const { state, dispatch } = useStore();
  const [pass, setPass] = useState('');
  const [tab, setTab] = useState('users');

  if (!state.session.admin) {
    return (
      <div className="screen">
        <TopBar title="Админка" sub="Отдельный вход" />
        <Card>
          <div className="stack">
            <Input label="Пароль" type="password" value={pass} onChange={(e) => setPass(e.target.value)} hint="В демо: club2026" />
            <Btn kind="primary" wide disabled={pass !== PASSWORD} onClick={() => dispatch({ type: 'admin', value: true })}>
              Войти
            </Btn>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="screen">
      <TopBar
        title="Админка"
        sub={state.season.title}
        right={
          <Btn kind="soft" small onClick={() => dispatch({ type: 'admin', value: false })}>
            Выйти
          </Btn>
        }
      />

      <div className="chips">
        {[
          ['users', 'Участники'],
          ['events', 'События'],
          ['base', 'База'],
          ['rating', 'Рейтинг'],
          ['cities', 'Города'],
          ['mail', 'Рассылка'],
          ['export', 'Выгрузка'],
        ].map(([id, label]) => (
          <span key={id} className={`chip ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>
            {label}
          </span>
        ))}
      </div>

      {tab === 'users' && <Users />}
      {tab === 'events' && <Events navigate={navigate} now={now} />}
      {tab === 'base' && <Base />}
      {tab === 'rating' && <Rating />}
      {tab === 'cities' && <Cities navigate={navigate} />}
      {tab === 'mail' && <Mail />}
      {tab === 'export' && <Export />}
    </div>
  );
}

function Users() {
  const { state, dispatch } = useStore();
  const [query, setQuery] = useState('');
  const list = state.users
    .filter((u) => `${u.name} ${u.about}`.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 40);

  return (
    <>
      <div className="field" style={{ position: 'relative', marginTop: 10 }}>
        <input placeholder="Поиск участника" value={query} onChange={(e) => setQuery(e.target.value)} style={{ paddingLeft: 40 }} />
        <span style={{ position: 'absolute', left: 13, top: 14, color: 'var(--dim)' }}><IcSearch /></span>
      </div>
      <div className="t-dim" style={{ margin: '8px 2px' }}>Всего в клубе: {state.users.length}</div>
      <div className="stack">
        {list.map((u) => (
          <Card key={u.id}>
            <div className="row">
              <Avatar user={u} size={38} />
              <div style={{ minWidth: 0 }}>
                <div className="ellipsis" style={{ fontWeight: 700 }}>{u.name}</div>
                <div className="t-dim ellipsis">
                  {cityName(state, u.cityId)} · с {dateShort(u.joinedAt)}
                </div>
              </div>
            </div>
            <div className="row" style={{ gap: 8, marginTop: 10 }}>
              <select
                value={u.package}
                onChange={(e) => dispatch({ type: 'userPatch', userId: u.id, patch: { package: e.target.value } })}
                style={{ flex: 1, minHeight: 38, borderRadius: 11, background: 'var(--bg-soft)', border: '1px solid var(--line)', padding: '0 10px' }}
              >
                {Object.values(PACKAGES).map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
              <Btn
                kind={u.active === false ? 'off' : 'on'}
                small
                onClick={() => dispatch({ type: 'userPatch', userId: u.id, patch: { active: u.active === false } })}
              >
                {u.active === false ? 'Доступ закрыт' : 'Доступ открыт'}
              </Btn>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

function Events({ navigate, now }) {
  const { state, dispatch } = useStore();
  const [add, setAdd] = useState(false);
  const list = state.events.filter((e) => e.startsAt > now - 7 * 86400000).sort((a, b) => a.startsAt - b.startsAt).slice(0, 30);

  return (
    <>
      <Btn kind="primary" wide style={{ marginTop: 10 }} onClick={() => setAdd(true)}>
        <IcPlus /> Создать событие
      </Btn>
      <div className="stack" style={{ marginTop: 10 }}>
        {list.map((e) => (
          <Card key={e.id}>
            <div className="split">
              <div style={{ minWidth: 0 }}>
                <div className="t-title ellipsis">{e.title}</div>
                <div className="t-dim">
                  {isoDate(e.startsAt)} {timeOf(e.startsAt)} · {e.type}
                  {e.canceled ? ' · отменено' : ''}
                </div>
              </div>
              <div className="center">
                <div className="mono" style={{ fontWeight: 700 }}>{goingUsers(state, e.id).length}</div>
                <div className="t-dim">идут</div>
              </div>
            </div>
            <div className="row" style={{ gap: 8, marginTop: 10 }}>
              <Btn kind="soft" small onClick={() => navigate(`/event/${e.id}`)}>Открыть</Btn>
              <Btn kind="soft" small onClick={() => dispatch({ type: 'eventPatch', eventId: e.id, patch: { canceled: !e.canceled } })}>
                {e.canceled ? 'Вернуть' : 'Отменить'}
              </Btn>
              <Btn kind="danger" small onClick={() => dispatch({ type: 'eventDelete', eventId: e.id })}>Удалить</Btn>
            </div>
          </Card>
        ))}
      </div>
      {add && <EventSheet onClose={() => setAdd(false)} />}
    </>
  );
}

function EventSheet({ onClose }) {
  const { state, dispatch } = useStore();
  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'online',
    cityId: '',
    startsAt: inputValue(Date.now() + 86400000),
    duration: 90,
    joinUrl: '',
    minPackage: 'start',
  });
  const field = (key) => ({ value: form[key], onChange: (e) => setForm({ ...form, [key]: e.target.value }) });

  return (
    <Sheet title="Новое событие" onClose={onClose}>
      <div className="stack">
        <Input label="Название" {...field('title')} />
        <Area label="Описание" {...field('description')} />
        <Select label="Тип" {...field('type')}>
          <option value="online">Онлайн</option>
          <option value="offline">Оффлайн</option>
          <option value="summit">Большой слёт</option>
        </Select>
        {form.type === 'offline' && (
          <Select label="Город" {...field('cityId')}>
            <option value="">Выберите город</option>
            {state.cities.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        )}
        <Input label="Дата и время" type="datetime-local" {...field('startsAt')} />
        <Input label="Длительность, минут" type="number" {...field('duration')} />
        <Input label="Ссылка на подключение" placeholder="https://" {...field('joinUrl')} />
        <Select label="Минимальный пакет" {...field('minPackage')}>
          <option value="start">START</option>
          <option value="club">CLUB</option>
          <option value="pro">PRO</option>
        </Select>
        <Btn
          kind="primary"
          wide
          disabled={!form.title.trim()}
          onClick={() => {
            dispatch({
              type: 'eventAdd',
              event: {
                ...form,
                cityId: form.cityId || null,
                teamId: null,
                duration: Number(form.duration) || 90,
                startsAt: new Date(form.startsAt).getTime(),
                series: 'manual',
                createdBy: 'admin',
                canceled: false,
                flexible: false,
                place: '',
                recordUrl: '',
              },
            });
            onClose();
          }}
        >
          Создать
        </Btn>
      </div>
    </Sheet>
  );
}

function Base() {
  const { state, dispatch } = useStore();
  const [form, setForm] = useState({ title: '', type: 'эфир', topic: '', videoUrl: '', description: '' });
  const field = (key) => ({ value: form[key], onChange: (e) => setForm({ ...form, [key]: e.target.value }) });

  return (
    <>
      <Card style={{ marginTop: 10 }}>
        <div className="t-title" style={{ marginBottom: 10 }}>Добавить материал</div>
        <div className="stack">
          <Input label="Название" {...field('title')} />
          <Select label="Тип" {...field('type')}>
            {['эфир', 'воркшоп', 'мастермайнд', 'гайд'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
          <Input label="Тема" placeholder="Продажи, Автоматизация…" {...field('topic')} />
          <Input label="Ссылка на видео" placeholder="YouTube, Kinescope, VK Видео, Google Drive" {...field('videoUrl')} />
          <Area label="Короткое описание" {...field('description')} />
          <Btn
            kind="primary"
            wide
            disabled={!form.title.trim() || !form.videoUrl.trim()}
            onClick={() => {
              dispatch({ type: 'materialAdd', material: { ...form, topic: form.topic || 'Разное' } });
              setForm({ title: '', type: 'эфир', topic: '', videoUrl: '', description: '' });
            }}
          >
            Добавить
          </Btn>
        </div>
      </Card>

      <div className="section"><h2>Материалы · {state.materials.length}</h2></div>
      <Card>
        {state.materials
          .slice()
          .sort((a, b) => b.publishedAt - a.publishedAt)
          .slice(0, 20)
          .map((m) => (
            <div key={m.id} className="lead" style={{ gridTemplateColumns: '1fr auto' }}>
              <div style={{ minWidth: 0 }}>
                <div className="ellipsis" style={{ fontWeight: 600 }}>{m.title}</div>
                <div className="t-dim">{m.type} · {dateShort(m.publishedAt)}{m.seasonId < state.season.id ? ' · архив' : ''}</div>
              </div>
              <span className="link t-red" onClick={() => dispatch({ type: 'materialDelete', id: m.id })}>удалить</span>
            </div>
          ))}
      </Card>
    </>
  );
}

function Rating() {
  const { state, dispatch } = useStore();
  const board = leaderboard(state);

  return (
    <>
      <div className="section"><h2>Копилка и выручка</h2></div>
      <div className="stack">
        {board.map((row) => (
          <Card key={row.team.id}>
            <div className="split">
              <div>
                <div className="t-title">{row.place}. {row.team.name}</div>
                <div className="t-dim">выручка {money(row.total)} · зачтено {money(row.counted)}</div>
              </div>
              <div className="center">
                <div className="mono" style={{ fontWeight: 700 }}>{money(row.paid)}</div>
                <div className="t-dim">из {money(row.required)}</div>
              </div>
            </div>
            {state.contributions
              .filter((c) => c.teamId === row.team.id)
              .map((c) => (
                <div key={c.id} className="lead" style={{ gridTemplateColumns: '1fr auto' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{money(c.amount)}</div>
                    <div className="t-dim">{c.proof || 'без подтверждения'} · {dateShort(c.at)}</div>
                  </div>
                  <Btn
                    kind={c.confirmed ? 'on' : 'soft'}
                    small
                    onClick={() => dispatch({ type: 'contributionConfirm', id: c.id, value: !c.confirmed })}
                  >
                    {c.confirmed ? 'подтверждён' : 'подтвердить'}
                  </Btn>
                </div>
              ))}
          </Card>
        ))}
      </div>
    </>
  );
}

function Cities({ navigate }) {
  const { state } = useStore();
  return (
    <Card style={{ marginTop: 10 }}>
      {state.cities
        .map((c) => cityStats(state, c.id))
        .sort((a, b) => b.count - a.count)
        .map((s) => (
          <div key={s.city.id} className="lead" style={{ gridTemplateColumns: '1fr auto', cursor: 'pointer' }} onClick={() => navigate(`/city/${s.city.id}`)}>
            <div>
              <div style={{ fontWeight: 600 }}>{s.city.name}</div>
              <div className="t-dim">
                {s.count} чел. · {s.organizer ? `организатор ${s.organizer.name}` : 'организатора нет'}
              </div>
            </div>
            <span className={`chip ${s.ready ? 'on' : 'warn'}`}>{s.ready ? 'пятница есть' : 'нужен второй'}</span>
          </div>
        ))}
    </Card>
  );
}

function Mail() {
  const { state, dispatch } = useStore();
  const [text, setText] = useState('');
  const [target, setTarget] = useState('all');

  return (
    <Card style={{ marginTop: 10 }}>
      <div className="stack">
        <Select label="Кому" value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="all">Всем участникам</option>
          {state.cities.map((c) => (
            <option key={c.id} value={`city:${c.id}`}>Город {c.name}</option>
          ))}
          {Object.values(PACKAGES).map((p) => (
            <option key={p.id} value={`pack:${p.id}`}>Пакет {p.title}</option>
          ))}
        </Select>
        <Area label="Сообщение" value={text} onChange={(e) => setText(e.target.value)} />
        <Btn
          kind="primary"
          wide
          disabled={text.trim().length < 3}
          onClick={() => {
            dispatch({ type: 'broadcast', text, target });
            setText('');
          }}
        >
          Отправить
        </Btn>
        {state.broadcasts.length > 0 && (
          <div className="t-dim">
            Последняя рассылка: {state.broadcasts[state.broadcasts.length - 1].count} получателей
          </div>
        )}
      </div>
    </Card>
  );
}

function Export() {
  const { state } = useStore();

  const users = () =>
    downloadCsv('участники.csv', [
      ['Имя', 'Город', 'Пакет', 'Чем занимается', 'В клубе с', 'Доступ'],
      ...state.users.map((u) => [u.name, cityName(state, u.cityId), u.package, u.about, dateShort(u.joinedAt), u.active === false ? 'закрыт' : 'открыт']),
    ]);

  const revenue = () =>
    downloadCsv('выручка.csv', [
      ['Команда', 'Участник', 'Сумма', 'Часы', 'За что', 'Дата'],
      ...state.revenue.map((r) => [
        state.teams.find((t) => t.id === r.teamId)?.name || '',
        state.users.find((u) => u.id === r.userId)?.name || '',
        r.amount,
        r.hours,
        r.comment,
        dateShort(r.at),
      ]),
    ]);

  const attendance = () =>
    downloadCsv('посещаемость.csv', [
      ['Событие', 'Дата', 'Тип', 'Идут'],
      ...state.events.map((e) => [e.title, dateShort(e.startsAt), e.type, goingUsers(state, e.id).length]),
    ]);

  return (
    <div className="stack" style={{ marginTop: 10 }}>
      <div className="grid3">
        <Stat value={state.users.length} label="участников" />
        <Stat value={state.teams.length} label="команд" />
        <Stat value={state.events.length} label="событий" />
      </div>
      <Btn kind="soft" wide onClick={users}><IcDownload /> Участники, CSV</Btn>
      <Btn kind="soft" wide onClick={revenue}><IcDownload /> Выручка, CSV</Btn>
      <Btn kind="soft" wide onClick={attendance}><IcDownload /> Посещаемость, CSV</Btn>
    </div>
  );
}
