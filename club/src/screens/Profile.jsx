import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { PACKAGES, cityName, teamOf, referralStats, factOf, pointsOf, pointsRank } from '../lib/logic.js';
import { SKILLS } from '../data/people.js';
import { dateShort, addMonths } from '../lib/time.js';
import { money } from '../lib/format.js';
import { readImage } from '../lib/image.js';
import { Avatar, Btn, Card, Field, FileButton, List, Item, Section, Sheet, Stat, Switch, Tag, TopBar } from '../components/UI.jsx';
import Choice from '../components/Choice.jsx';
import { STEPS, FACT_LABELS } from '../data/onboarding.js';
import { VERSION } from '../version.js';

export default function Profile() {
  const { state, me, dispatch } = useStore();
  const [edit, setEdit] = useState(false);
  const [packs, setPacks] = useState(false);
  const [quiz, setQuiz] = useState(false);
  const team = teamOf(state, me.id);
  const referral = referralStats(state, me.id);
  let nextCharge = me.joinedAt;
  while (nextCharge < Date.now()) nextCharge = addMonths(nextCharge, 1);
  const set = (patch) => dispatch({ type: 'profile', patch, silent: true });

  return (
    <div className="screen" style={{ paddingTop: 0 }}>
      <TopBar title="Профиль" backTo="/" right={<Btn variant="ghost" size="sm" icon="edit" onClick={() => setEdit(true)}>Изменить</Btn>} />
      <div className="stack-20">
        <div className="center" style={{ display: 'grid', justifyItems: 'center', gap: 10 }}>
          <Avatar user={me} size={92} />
          <div>
            <h2 className="h2">{me.name}</h2>
            <div className="t-sm dim-2" style={{ marginTop: 4 }}>{cityName(state, me.cityId)} · {me.about}</div>
          </div>
          <div className="wrap" style={{ justifyContent: 'center' }}>
            {me.facts?.role?.length > 0 && <Tag tone="accent">{factOf(me, 'role')}</Tag>}
            {me.facts?.sphere?.length > 0 && <Tag>{factOf(me, 'sphere')}</Tag>}
            {me.facts?.ai?.length > 0 && <Tag tone="violet">ИИ: {factOf(me, 'ai')}</Tag>}
          </div>
        </div>

        <div className="stats">
          <Stat v={pointsOf(state, me.id)} l={`баллов · ${pointsRank(state, me.id)}-е место`} tone="var(--accent)" />
          <Stat v={PACKAGES[me.package].title} l="пакет" />
          <Stat v={money(me.bonus || 0)} l="бонусов" />
        </div>

        <List>
          <Item icon="star" title={`${PACKAGES[me.package].title} · ${money(PACKAGES[me.package].price)} в месяц`} sub={`Следующее списание ${dateShort(nextCharge)}`} meta={<span className="accent">сменить</span>} chev={false} onClick={() => setPacks(true)} />
          <Item icon="camera" title="Лента клуба" sub="Фото со встреч и результаты — за них баллы" onClick={() => go('/feed')} />
          <Item icon="gift" title="Пригласить друга" sub={referral.paid > 0 ? `Вы привели ${referral.paid} · бонусов ${money(referral.earned)}` : 'Ссылка, бонусы и текст для сторис'} onClick={() => go('/invite')} />
          {team && <Item icon="team" title={`Команда «${team.name}»`} sub={team.idea} onClick={() => go('/team')} />}
          <Item icon="city" title={`Город ${cityName(state, me.cityId)}`} sub="Пятница, чат и участники" onClick={() => go(`/city/${me.cityId}`)} />
          <Item icon="download" title="Установить на телефон" sub="Иконка на экране, работа офлайн" onClick={() => go('/install')} />
        </List>

        <Section title="Анкета" more="Изменить" onMore={() => setQuiz(true)}>
          <Card>
            {['role', 'work', 'schedule', 'sphere', 'craft', 'exp', 'ai', 'age', 'income', 'status', 'gender'].filter((k) => me.facts?.[k]?.length).map((k) => (
              <div key={k} className="kv">
                <span className="kv__k">{LABELS[k]}</span>
                <span className="kv__v">{factOf(me, k)}</span>
              </div>
            ))}
            {me.facts?.powers?.length > 0 && <div className="wrap" style={{ marginTop: 12 }}>{me.facts.powers.map((x) => <Tag key={x} tone="accent">{x}</Tag>)}</div>}
            {me.facts?.hobby?.length > 0 && <div className="wrap" style={{ marginTop: 8 }}>{me.facts.hobby.map((x) => <Tag key={x}>{x}</Tag>)}</div>}
            {!me.facts?.role?.length && <div className="t-sm dim">Анкета не заполнена — куратору сложнее подобрать вам команду.</div>}
          </Card>
        </Section>

        <Section title="Настройки">
          <List>
            <Switch title="Уведомления" sub="Не больше пяти в неделю" on={me.notifications !== false} onChange={(v) => set({ notifications: v })} />
            <Switch title="Новые знакомства" sub="Несколько предложений каждый понедельник" on={me.coffeeEnabled} onChange={(v) => set({ coffeeEnabled: v })} />
            <Switch title="Показывать меня в каталоге" sub="Иначе вас не будет в разделе «Люди»" on={me.visible !== false} onChange={(v) => set({ visible: v })} />
          </List>
        </Section>

        <List>
          <Item icon="settings" title="Админка клуба" sub="Отдельный вход для организаторов" onClick={() => go('/admin')} />
          <Item icon="out" title="Выйти" chev={false} onClick={() => dispatch({ type: 'logout' })} />
          <Item icon="refresh" title="Сбросить демо-данные" sub="Пересоздать участников, команды и события" tone="var(--red)" chev={false} onClick={() => { if (confirm('Пересоздать демо-данные? Ваш профиль в этом браузере будет удалён.')) dispatch({ type: 'reset' }); }} />
        </List>

        <div className="t-xs dim-2 center" style={{ lineHeight: 1.5 }}>
          Данные хранятся в этом браузере. Оплата проходит вне приложения — приложение только читает статус подписки.<br />Версия {VERSION}
        </div>
      </div>

      <Sheet open={edit} onClose={() => setEdit(false)} title="Профиль" sub="Всё, кроме имени и города, можно оставить пустым">
        {edit && <EditForm onDone={() => setEdit(false)} />}
      </Sheet>
      <Sheet open={packs} onClose={() => setPacks(false)} title="Пакет" sub="Оплата проходит вне приложения">
        <PackForm onDone={() => setPacks(false)} />
      </Sheet>
      <Sheet open={quiz} onClose={() => setQuiz(false)} title="Анкета" sub="Ответы видит куратор, когда собирает команды">
        {quiz && <QuizForm onDone={() => setQuiz(false)} />}
      </Sheet>
    </div>
  );
}

const LABELS = FACT_LABELS;

/** Перепройти анкету можно в любой момент — люди меняются за сезон. */
function QuizForm({ onDone }) {
  const { me, dispatch } = useStore();
  const [facts, setFacts] = useState(me.facts || {});
  const questions = STEPS.flatMap((step) => step.questions);
  return (
    <div className="stack-20">
      {questions.map((q) => (
        <section key={q.id} className="stack-8">
          <div className="hdr" style={{ padding: 0 }}>{q.title || LABELS[q.id] || 'Выберите'}</div>
          <Choice
            options={q.options}
            value={facts[q.id] || []}
            max={q.max}
            list={q.list}
            wide={Boolean(q.options[0]?.big)}
            onChange={(v) => setFacts({ ...facts, [q.id]: v })}
          />
        </section>
      ))}
      <Btn variant="accent" wide onClick={() => { dispatch({ type: 'onboard', facts }); onDone(); }}>Сохранить</Btn>
    </div>
  );
}

function EditForm({ onDone }) {
  const { state, me, dispatch } = useStore();
  const [form, setForm] = useState({ name: me.name, city: cityName(state, me.cityId), about: me.about, lookingFor: me.lookingFor || '', tg: me.tg || '', links: me.links || '', photo: me.photo || '', skills: me.skills || [] });
  const [error, setError] = useState('');
  const field = (key) => ({ value: form[key], onChange: (e) => setForm({ ...form, [key]: e.target.value }) });
  const pickPhoto = async (file) => {
    if (!file) return;
    try { setForm({ ...form, photo: await readImage(file) }); setError(''); } catch (err) { setError(err.message); }
  };
  const toggleSkill = (s) => setForm({ ...form, skills: form.skills.includes(s) ? form.skills.filter((x) => x !== s) : [...form.skills, s].slice(0, 5) });

  return (
    <div className="stack">
      <div className="row">
        <Avatar user={{ ...me, photo: form.photo }} size={60} />
        <FileButton label="Загрузить фото" onFile={pickPhoto} />
        {form.photo && <Btn variant="quiet" size="sm" onClick={() => setForm({ ...form, photo: '' })}>Убрать</Btn>}
      </div>
      {error && <div className="t-sm red">{error}</div>}
      <Field label="Имя"><input className="field" {...field('name')} /></Field>
      <Field label="Город" hint="Смена города меняет ваши пятничные встречи"><input className="field" list="cities-edit" {...field('city')} /></Field>
      <datalist id="cities-edit">{state.cities.map((c) => <option key={c.id} value={c.name} />)}</datalist>
      <Field label="Чем занимаюсь"><input className="field" {...field('about')} /></Field>
      <Field label="Что ищу"><input className="field" placeholder="Партнёра, клиентов, наставника" {...field('lookingFor')} /></Field>
      <Field label="Телеграм"><input className="field" placeholder="@username" {...field('tg')} /></Field>
      <Field label="Ссылка"><input className="field" placeholder="Сайт или соцсеть" {...field('links')} /></Field>
      <Field label="Навыки — до пяти">
        <div className="wrap">{SKILLS.map((s) => <button key={s} className={`chip${form.skills.includes(s) ? ' chip--on' : ''}`} onClick={() => toggleSkill(s)}>{s}</button>)}</div>
      </Field>
      <Btn variant="accent" wide disabled={!form.name.trim() || !form.city.trim()} onClick={() => { dispatch({ type: 'profile', patch: form }); onDone(); }}>Сохранить</Btn>
    </div>
  );
}

function PackForm({ onDone }) {
  const { me, dispatch } = useStore();
  const [pack, setPack] = useState(me.package);
  return (
    <div className="stack">
      {Object.values(PACKAGES).map((p) => (
        <button key={p.id} className={`pack${pack === p.id ? ' pack--on' : ''}`} onClick={() => setPack(p.id)}>
          <div className="spread"><div><div className="t-lg">{p.title}</div><div className="t-sm dim-2">{p.note}</div></div><div className="figure" style={{ fontSize: 16 }}>{money(p.price)}</div></div>
        </button>
      ))}
      <Btn variant="accent" wide onClick={() => { dispatch({ type: 'profile', patch: { package: pack } }); onDone(); }}>Перейти на {PACKAGES[pack].title}</Btn>
    </div>
  );
}
