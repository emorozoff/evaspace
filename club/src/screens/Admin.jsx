import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { cityStats, cityName, goingUsers, leaderboard, teamRoster, teamSize, PACKAGES, MAX_TEAM } from '../lib/logic.js';
import { dateShort, inputValue, isoDate, timeOf, relative } from '../lib/time.js';
import { money, downloadCsv } from '../lib/format.js';
import { Avatar, Btn, Card, Empty, Field, List, Item, Note, Scroller, Section, Sheet, Stat, Tag, TopBar } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';

const PASSWORD = 'club2026';
const TABS = [['teams', 'Команды'], ['users', 'Участники'], ['events', 'События'], ['base', 'База'], ['rating', 'Копилка'], ['cities', 'Города'], ['mail', 'Рассылка'], ['export', 'Выгрузка']];

/* Админка куратора. По ТЗ это отдельный веб-экран: тот же адрес, раздел #/admin. */

export default function Admin({ now }) {
  const { state, dispatch } = useStore();
  const [pass, setPass] = useState('');
  const [tab, setTab] = useState('teams');

  if (!state.session.admin) {
    return (
      <div className="screen screen--plain" style={{ paddingTop: 0 }}>
        <TopBar title="Админка" sub="Вход для куратора" backTo="/profile" />
        <div className="stack">
          <Field label="Пароль" hint="В демо: club2026"><input className="field" type="password" value={pass} onChange={(e) => setPass(e.target.value)} /></Field>
          <Btn variant="accent" wide disabled={pass !== PASSWORD} onClick={() => dispatch({ type: 'admin', value: true })}>Войти</Btn>
        </div>
      </div>
    );
  }

  return (
    <div className="screen screen--plain" style={{ paddingTop: 0 }}>
      <TopBar title="Админка" sub={state.season.title} backTo="/profile" right={<Btn variant="quiet" size="sm" onClick={() => dispatch({ type: 'admin', value: false })}>Выйти</Btn>} />
      <div className="stack-20">
        <Scroller>{TABS.map(([id, label]) => <button key={id} className={`chip${tab === id ? ' chip--on' : ''}`} onClick={() => setTab(id)}>{label}</button>)}</Scroller>
        {tab === 'teams' && <Teams now={now} />}
        {tab === 'users' && <Users />}
        {tab === 'events' && <Events now={now} />}
        {tab === 'base' && <Base />}
        {tab === 'rating' && <Rating />}
        {tab === 'cities' && <Cities />}
        {tab === 'mail' && <Mail />}
        {tab === 'export' && <Export />}
      </div>
    </div>
  );
}

/* ---------- распределение по командам ---------- */
function Teams({ now }) {
  const { state, dispatch } = useStore();
  const [pick, setPick] = useState(null);   // заявка, которую распределяем
  const [create, setCreate] = useState(false);
  const [name, setName] = useState('');
  const [idea, setIdea] = useState('');
  const pending = state.applications.filter((a) => a.status === 'pending').sort((a, b) => a.at - b.at);
  const roleOf = (userId) => state.applications.find((a) => a.userId === userId && a.status === 'assigned')?.role;

  return (
    <>
      <Section title={`Ждут распределения · ${pending.length}`}>
        {pending.length === 0 ? (
          <Empty icon="hand" title="Заявок нет" text="Когда участник оставит заявку, она появится здесь." />
        ) : (
          <List>
            {pending.map((a) => {
              const user = state.users.find((u) => u.id === a.userId);
              return <Item key={a.id} lead={<Avatar user={user} size={40} />} title={user?.name} sub={`${a.role} · ${a.hours} ч/нед · ${cityName(state, user?.cityId)} · ${relative(a.at, now)}`} meta={<span className="accent">в команду</span>} chev={false} onClick={() => setPick(a)} />;
            })}
          </List>
        )}
      </Section>

      <Section title={`Команды · ${state.teams.length}`} more="Создать" onMore={() => setCreate(true)}>
        <div className="stack">
          {state.teams.map((t) => {
            const roster = teamRoster(state, t.id);
            return (
              <Card key={t.id}>
                <div className="spread">
                  <div className="grow"><div className="t-md ell">{t.name}</div><div className="t-xs dim-2 ell">{t.idea}</div></div>
                  <Tag tone={roster.length < 3 ? 'warm' : undefined}>{roster.length} из {MAX_TEAM}</Tag>
                </div>
                <div className="stack-8" style={{ marginTop: 10 }}>
                  {roster.map((m) => (
                    <div key={m.userId} className="row">
                      <Avatar user={m.user} size={28} />
                      <div className="grow t-sm ell">{m.user.name} <span className="dim-2">· {roleOf(m.userId) || m.role}</span></div>
                      {m.userId === t.captainId && <Tag tone="warm">капитан</Tag>}
                      <button className="t-xs dim-2" onClick={() => dispatch({ type: 'unassign', teamId: t.id, userId: m.userId })}>убрать</button>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      </Section>

      <Sheet open={Boolean(pick)} onClose={() => setPick(null)} title="В какую команду" sub={pick ? `${state.users.find((u) => u.id === pick.userId)?.name} · ${pick.role}` : ''}>
        {pick && (
          <div className="stack">
            {pick.about && <Note icon="user">{pick.about}</Note>}
            <List>
              {[...state.teams].map((t) => ({ t, n: teamSize(state, t.id) })).sort((a, b) => a.n - b.n).map(({ t, n }) => (
                <Item key={t.id} icon="team" title={t.name} sub={`${n} чел. · ${t.idea}`} meta={n >= MAX_TEAM ? <Tag tone="red">полная</Tag> : undefined} chev={false} onClick={n >= MAX_TEAM ? undefined : () => { dispatch({ type: 'assign', teamId: t.id, userId: pick.userId, role: pick.role }); setPick(null); }} />
              ))}
            </List>
          </div>
        )}
      </Sheet>

      <Sheet open={create} onClose={() => setCreate(false)} title="Новая команда">
        <div className="stack">
          <Field label="Название"><input className="field" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Идея в одну строку"><input className="field" value={idea} onChange={(e) => setIdea(e.target.value)} /></Field>
          <Btn variant="accent" wide disabled={name.trim().length < 2} onClick={() => { dispatch({ type: 'teamCreate', name, idea }); setName(''); setIdea(''); setCreate(false); }}>Создать</Btn>
        </div>
      </Sheet>
    </>
  );
}

function Users() {
  const { state, dispatch } = useStore();
  const [query, setQuery] = useState('');
  const list = state.users.filter((u) => `${u.name} ${u.about}`.toLowerCase().includes(query.toLowerCase())).slice(0, 40);
  return (
    <>
      <div className="search"><Icon name="search" size={17} /><input className="field" placeholder="Поиск участника" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
      <List>
        {list.map((u) => (
          <Item
            key={u.id}
            lead={<Avatar user={u} size={40} />}
            title={u.name}
            sub={`${cityName(state, u.cityId)} · с ${dateShort(u.joinedAt)}`}
            chev={false}
            meta={
              <div className="row" style={{ gap: 6 }}>
                <select className="field" style={{ minHeight: 34, padding: '0 28px 0 10px', width: 92, fontSize: 12 }} value={u.package} onChange={(e) => dispatch({ type: 'userPatch', userId: u.id, patch: { package: e.target.value } })}>
                  {Object.values(PACKAGES).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
                <button className={`chip${u.active === false ? '' : ' chip--on'}`} style={{ height: 34 }} onClick={() => dispatch({ type: 'userPatch', userId: u.id, patch: { active: u.active === false } })}>{u.active === false ? 'закрыт' : 'доступ'}</button>
              </div>
            }
          />
        ))}
      </List>
    </>
  );
}

function Events({ now }) {
  const { state, dispatch } = useStore();
  const [add, setAdd] = useState(false);
  const list = state.events.filter((e) => e.startsAt > now - 7 * 86400000).sort((a, b) => a.startsAt - b.startsAt).slice(0, 30);
  return (
    <>
      <Btn variant="accent" wide icon="plus" onClick={() => setAdd(true)}>Создать событие</Btn>
      <List>
        {list.map((e) => (
          <Item key={e.id} icon="calendar" title={e.title} sub={`${isoDate(e.startsAt)} ${timeOf(e.startsAt)} · ${e.type}${e.canceled ? ' · отменено' : ''} · идут ${goingUsers(state, e.id).length}`} chev={false}
            meta={<div className="row" style={{ gap: 4 }}><button className="chip" style={{ height: 30 }} onClick={() => go(`/event/${e.id}`)}>открыть</button><button className="chip" style={{ height: 30 }} onClick={() => dispatch({ type: 'eventPatch', eventId: e.id, patch: { canceled: !e.canceled } })}>{e.canceled ? 'вернуть' : 'отменить'}</button></div>} />
        ))}
      </List>
      <Sheet open={add} onClose={() => setAdd(false)} title="Новое событие"><EventForm onDone={() => setAdd(false)} /></Sheet>
    </>
  );
}

function EventForm({ onDone }) {
  const { state, dispatch } = useStore();
  const [f, setF] = useState({ title: '', description: '', type: 'online', cityId: '', startsAt: inputValue(Date.now() + 86400000), duration: 90, joinUrl: '', minPackage: 'start' });
  const field = (k) => ({ value: f[k], onChange: (e) => setF({ ...f, [k]: e.target.value }) });
  return (
    <div className="stack">
      <Field label="Название"><input className="field" {...field('title')} /></Field>
      <Field label="Короткое описание"><textarea className="field" {...field('description')} /></Field>
      <Field label="Тип"><select className="field" {...field('type')}><option value="online">Эфир</option><option value="offline">Встреча в городе</option><option value="summit">Слёт</option></select></Field>
      {f.type === 'offline' && <Field label="Город"><select className="field" {...field('cityId')}><option value="">Выберите</option>{state.cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}
      <Field label="Дата и время"><input className="field" type="datetime-local" {...field('startsAt')} /></Field>
      <Field label="Длительность, минут"><input className="field" type="number" {...field('duration')} /></Field>
      <Field label="Ссылка на подключение"><input className="field" placeholder="https://" {...field('joinUrl')} /></Field>
      <Field label="Минимальный пакет"><select className="field" {...field('minPackage')}><option value="start">START</option><option value="club">CLUB</option><option value="pro">PRO</option></select></Field>
      <Btn variant="accent" wide disabled={!f.title.trim()} onClick={() => { dispatch({ type: 'eventAdd', event: { ...f, cityId: f.cityId || null, teamId: null, duration: Number(f.duration) || 90, startsAt: new Date(f.startsAt).getTime(), series: 'manual', createdBy: 'admin', canceled: false, flexible: false, place: '', recordUrl: '' } }); onDone(); }}>Создать</Btn>
    </div>
  );
}

function Base() {
  const { state, dispatch } = useStore();
  const [f, setF] = useState({ title: '', type: 'эфир', topic: '', videoUrl: '', description: '' });
  const field = (k) => ({ value: f[k], onChange: (e) => setF({ ...f, [k]: e.target.value }) });
  return (
    <>
      <Card>
        <div className="t-md" style={{ marginBottom: 10 }}>Добавить материал</div>
        <div className="stack">
          <Field label="Название"><input className="field" {...field('title')} /></Field>
          <Field label="Тип"><select className="field" {...field('type')}>{['эфир', 'воркшоп', 'мастермайнд', 'гайд'].map((t) => <option key={t}>{t}</option>)}</select></Field>
          <Field label="Тема"><input className="field" placeholder="Продажи, Автоматизация…" {...field('topic')} /></Field>
          <Field label="Ссылка на видео"><input className="field" placeholder="YouTube, Kinescope, VK Видео, Google Drive" {...field('videoUrl')} /></Field>
          <Field label="Короткое описание"><textarea className="field" {...field('description')} /></Field>
          <Btn variant="accent" wide disabled={!f.title.trim() || !f.videoUrl.trim()} onClick={() => { dispatch({ type: 'materialAdd', material: { ...f, topic: f.topic || 'Разное' } }); setF({ title: '', type: 'эфир', topic: '', videoUrl: '', description: '' }); }}>Добавить</Btn>
        </div>
      </Card>
      <List>
        {[...state.materials].sort((a, b) => b.publishedAt - a.publishedAt).slice(0, 20).map((m) => (
          <Item key={m.id} icon="video" title={m.title} sub={`${m.type} · ${dateShort(m.publishedAt)}${m.seasonId < state.season.id ? ' · архив' : ''}`} meta={<button className="red t-xs" onClick={() => dispatch({ type: 'materialDelete', id: m.id })}>удалить</button>} chev={false} />
        ))}
      </List>
    </>
  );
}

function Rating() {
  const { state, dispatch } = useStore();
  return (
    <div className="stack">
      {leaderboard(state).map((row) => (
        <Card key={row.team.id}>
          <div className="spread"><div><div className="t-md">{row.place}. {row.team.name}</div><div className="t-xs dim-2">выручка {money(row.total)} · зачтено {money(row.counted)}</div></div><div className="center"><div className="figure" style={{ fontSize: 15 }}>{money(row.paid)}</div><div className="t-xs dim-2">из {money(row.required)}</div></div></div>
          {state.contributions.filter((c) => c.teamId === row.team.id).map((c) => (
            <div key={c.id} className="spread" style={{ marginTop: 10 }}>
              <div><div className="t-sm">{money(c.amount)}</div><div className="t-xs dim-2">{c.proof || 'без подтверждения'} · {dateShort(c.at)}</div></div>
              <button className={`chip${c.confirmed ? ' chip--on' : ''}`} onClick={() => dispatch({ type: 'contributionConfirm', id: c.id, value: !c.confirmed })}>{c.confirmed ? 'подтверждён' : 'подтвердить'}</button>
            </div>
          ))}
        </Card>
      ))}
    </div>
  );
}

function Cities() {
  const { state } = useStore();
  return (
    <List>
      {state.cities.map((c) => cityStats(state, c.id)).sort((a, b) => b.count - a.count).map((s) => (
        <Item key={s.city.id} icon="city" title={s.city.name} sub={`${s.count} чел. · ${s.organizer ? `организатор ${s.organizer.name}` : 'организатора нет'}`} meta={<Tag tone={s.ready ? 'accent' : 'warm'}>{s.ready ? 'пятница есть' : 'нужен второй'}</Tag>} onClick={() => go(`/city/${s.city.id}`)} />
      ))}
    </List>
  );
}

function Mail() {
  const { state, dispatch } = useStore();
  const [text, setText] = useState('');
  const [target, setTarget] = useState('all');
  return (
    <Card>
      <div className="stack">
        <Field label="Кому">
          <select className="field" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="all">Всем участникам</option>
            {state.cities.map((c) => <option key={c.id} value={`city:${c.id}`}>Город {c.name}</option>)}
            {Object.values(PACKAGES).map((p) => <option key={p.id} value={`pack:${p.id}`}>Пакет {p.title}</option>)}
          </select>
        </Field>
        <Field label="Сообщение"><textarea className="field" value={text} onChange={(e) => setText(e.target.value)} /></Field>
        <Btn variant="accent" wide disabled={text.trim().length < 3} onClick={() => { dispatch({ type: 'broadcast', text, target }); setText(''); }}>Отправить</Btn>
        {state.broadcasts.length > 0 && <div className="t-xs dim-2">Последняя рассылка: {state.broadcasts[state.broadcasts.length - 1].count} получателей</div>}
      </div>
    </Card>
  );
}

function Export() {
  const { state } = useStore();
  const users = () => downloadCsv('участники.csv', [['Имя', 'Город', 'Пакет', 'Чем занимается', 'В клубе с', 'Доступ'], ...state.users.map((u) => [u.name, cityName(state, u.cityId), u.package, u.about, dateShort(u.joinedAt), u.active === false ? 'закрыт' : 'открыт'])]);
  const revenue = () => downloadCsv('выручка.csv', [['Команда', 'Участник', 'Сумма', 'Часы', 'За что', 'Дата'], ...state.revenue.map((r) => [state.teams.find((t) => t.id === r.teamId)?.name || '', state.users.find((u) => u.id === r.userId)?.name || '', r.amount, r.hours, r.comment, dateShort(r.at)])]);
  const attendance = () => downloadCsv('посещаемость.csv', [['Событие', 'Дата', 'Тип', 'Идут'], ...state.events.map((e) => [e.title, dateShort(e.startsAt), e.type, goingUsers(state, e.id).length])]);
  return (
    <div className="stack">
      <div className="stats"><Stat v={state.users.length} l="участников" /><Stat v={state.teams.length} l="команд" /><Stat v={state.events.length} l="событий" /></div>
      <List>
        <Item icon="download" title="Участники, CSV" onClick={users} />
        <Item icon="download" title="Выручка, CSV" onClick={revenue} />
        <Item icon="download" title="Посещаемость, CSV" onClick={attendance} />
      </List>
    </div>
  );
}
