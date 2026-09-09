import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { teamOf, teamRoster, teamStats, teamPlace, lastReport, applicationOf, isPro, MIN_TEAM, TEAM_ROLES } from '../lib/logic.js';
import { weekKey, dateShort, startOfWeek, weekTitle, relative } from '../lib/time.js';
import { money, moneyShort } from '../lib/format.js';
import { Avatar, Btn, Card, Empty, Field, List, Item, Note, Section, Sheet, Stat, Top, Tag } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';
import EventCard from '../components/EventCard.jsx';
import RevenueSheet, { ContributionSheet } from '../components/RevenueSheet.jsx';

/* Вкладка «Команда». Команды собирает куратор: участник оставляет короткую
   заявку, куратор распределяет — и здесь появляется экран команды. */

export default function Team({ now }) {
  const { state, me } = useStore();
  const team = teamOf(state, me.id);

  if (!isPro(me)) {
    return (
      <div className="screen stack-20">
        <Top title="Команда" />
        <Empty icon="team" title="Команды — в пакете PRO" text="В CLUB открыты события, база знаний и люди. Команда, рейтинг и мастермайнды — в PRO." action={<Btn variant="accent" size="sm" onClick={() => go('/profile')}>Посмотреть пакеты</Btn>} />
      </div>
    );
  }

  if (!team) return <Waiting now={now} />;
  return <TeamScreen team={team} now={now} />;
}

/* ---------- без команды: заявка куратору ---------- */
function Waiting({ now }) {
  const { state, me, dispatch } = useStore();
  const application = applicationOf(state, me.id);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState(TEAM_ROLES[0]);
  const [hours, setHours] = useState('5');
  const [about, setAbout] = useState(me.about || '');

  return (
    <div className="screen stack-20">
      <Top title="Команда" sub="Команды на сезон собирает куратор" />

      {application ? (
        <Card variant="accent">
          <div className="row-t">
            <div className="item__ic"><Icon name="clock" size={19} /></div>
            <div className="grow">
              <div className="t-lg">Заявка у куратора</div>
              <div className="t-sm dim" style={{ marginTop: 4, lineHeight: 1.5 }}>Отправлена {relative(application.at, now)}. Куратор соберёт команды из 3–10 человек и напишет, когда определит вас.</div>
              <div className="wrap" style={{ marginTop: 10 }}>
                <Tag tone="accent">{application.role}</Tag>
                <Tag>{application.hours} ч в неделю</Tag>
              </div>
            </div>
          </div>
          <div className="pair" style={{ marginTop: 14 }}>
            <Btn variant="ghost" size="sm" onClick={() => setOpen(true)}>Изменить</Btn>
            <Btn variant="quiet" size="sm" onClick={() => dispatch({ type: 'applyCancel' })}>Отозвать</Btn>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="t-lg">Хотите в команду сезона?</div>
          <div className="t-sm dim" style={{ marginTop: 4, lineHeight: 1.5 }}>
            Команда — это 3–10 человек, одна идея и общая выручка в рейтинге. Куратор подбирает людей так, чтобы роли дополняли друг друга.
          </div>
          <Btn variant="accent" wide style={{ marginTop: 14 }} icon="hand" onClick={() => setOpen(true)}>Оставить заявку</Btn>
        </Card>
      )}

      <Section title="Как это устроено">
        <List>
          <Item icon="hand" title="Вы оставляете заявку" sub="Роль, сколько часов в неделю готовы вкладывать" chev={false} />
          <Item icon="team" title="Куратор собирает команды" sub="В первый месяц сезона, с учётом ролей и городов" chev={false} />
          <Item icon="trophy" title="Команда идёт в рейтинг" sub="Выручка, часы и копилка 10%" chev={false} onClick={() => go('/rating')} />
        </List>
      </Section>

      <Section title={`Команды сезона · ${state.teams.length}`}>
        <List>
          {state.teams.map((t) => {
            const roster = teamRoster(state, t.id);
            return <Item key={t.id} lead={<div className="item__ic"><Icon name="team" size={19} /></div>} title={t.name} sub={t.idea} meta={<span>{roster.length} чел.</span>} chev={false} />;
          })}
        </List>
      </Section>

      <Sheet open={open} onClose={() => setOpen(false)} title="Заявка в команду" sub="Три поля — куратору этого хватит">
        <div className="stack">
          <Field label="Какую роль возьмёте">
            <div className="wrap">
              {TEAM_ROLES.map((r) => <button key={r} className={`chip${role === r ? ' chip--on' : ''}`} onClick={() => setRole(r)}>{r}</button>)}
            </div>
          </Field>
          <Field label="Часов в неделю"><input className="field" inputMode="numeric" value={hours} onChange={(e) => setHours(e.target.value)} /></Field>
          <Field label="Что умеете и что хотите сделать за сезон"><textarea className="field" value={about} onChange={(e) => setAbout(e.target.value)} /></Field>
          <Btn variant="accent" wide onClick={() => { dispatch({ type: 'apply', role, hours: Number(hours) || 0, about }); setOpen(false); }}>Отправить куратору</Btn>
        </div>
      </Sheet>
    </div>
  );
}

/* ---------- экран команды ---------- */
function TeamScreen({ team, now }) {
  const { state, me } = useStore();
  const roster = teamRoster(state, team.id);
  const stats = teamStats(state, team.id);
  const place = teamPlace(state, team.id);
  const report = lastReport(state, team.id);
  const [sheet, setSheet] = useState(null);
  const call = state.events.filter((e) => e.teamId === team.id && !e.canceled && e.startsAt > now - 2 * 3600 * 1000).sort((a, b) => a.startsAt - b.startsAt)[0];

  return (
    <div className="screen stack-20">
      <Top
        title={team.name}
        sub={team.idea}
        right={<button className="iconbtn" onClick={() => go('/rating')} aria-label="Рейтинг"><Icon name="trophy" size={18} /></button>}
      />

      <div className="stats">
        <Stat v={place || '—'} l="место" tone="var(--warm)" />
        <Stat v={moneyShort(stats.total)} l="выручка" />
        <Stat v={stats.debt ? moneyShort(stats.debt) : 'ок'} l="копилка" tone={stats.debt ? 'var(--warm)' : 'var(--accent)'} />
      </div>

      <div className="pair">
        <Btn variant="accent" icon="money" onClick={() => setSheet('revenue')}>Выручка</Btn>
        <Btn variant="ghost" onClick={() => setSheet('contribution')}>Взнос 10%</Btn>
      </div>

      {roster.length < MIN_TEAM && <Note icon="team" tone="var(--warm)">В команде меньше {MIN_TEAM} человек — в рейтинг она пока не попадает. Куратор доберёт людей.</Note>}
      {stats.debt > 0 && (
        <Note icon="trophy" tone="var(--warm)">
          Копилка не закрыта: нужно {money(stats.required)}, отмечено {money(stats.paid)}. В рейтинг засчитано {money(stats.counted)} из {money(stats.total)}.
        </Note>
      )}

      {call && <Section title="Созвон команды"><EventCard event={call} now={now} /></Section>}

      <Section title="Недельный отчёт" more={report?.week === weekKey(now) ? 'Изменить' : 'Заполнить'} onMore={() => setSheet('report')}>
        {report ? (
          <Card>
            <div className="t-xs dim-2">{weekTitle(startOfWeek(report.at), now)}</div>
            <div className="stack-8" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.5 }}>
              <div><b>Сделали:</b> <span className="dim">{report.done}</span></div>
              <div><b>Не получилось:</b> <span className="dim">{report.stuck}</span></div>
              <div><b>Дальше:</b> <span className="dim">{report.next}</span></div>
            </div>
          </Card>
        ) : (
          <Empty icon="edit" title="Отчёта ещё нет" text="Три строки в неделю: что сделали, что не вышло, что дальше." />
        )}
      </Section>

      <Section title="Записи о выручке" more="Рейтинг" onMore={() => go('/rating')}>
        {stats.entries.length === 0 ? (
          <Empty icon="money" title="Пока пусто" text="Первая запись — самая приятная." />
        ) : (
          <List>
            {stats.entries.slice(0, 8).map((entry) => {
              const author = state.users.find((u) => u.id === entry.userId);
              const editable = entry.userId === me.id && now < entry.editableUntil;
              return (
                <Item
                  key={entry.id}
                  lead={<Avatar user={author} size={36} />}
                  title={entry.comment || 'Без описания'}
                  sub={`${author?.name.split(' ')[0]} · ${dateShort(entry.at)}${entry.hours ? ` · ${entry.hours} ч` : ''}`}
                  meta={<><b className="num" style={{ color: 'var(--ink)' }}>{money(entry.amount)}</b>{editable && <span className="accent">изменить</span>}</>}
                  chev={false}
                  onClick={editable ? () => setSheet({ edit: entry }) : undefined}
                />
              );
            })}
          </List>
        )}
      </Section>

      <Section title={`Состав · ${roster.length}`}>
        <List>
          {roster.map((m) => (
            <Item key={m.userId} lead={<Avatar user={m.user} size={40} />} title={m.user.name} sub={m.role} meta={m.userId === team.captainId ? <Tag tone="warm">капитан</Tag> : undefined} onClick={() => go(`/person/${m.userId}`)} />
          ))}
        </List>
        <Note icon="team">Состав меняет куратор. Если что-то не так — напишите ему в телеграм.</Note>
      </Section>

      {team.chatUrl && <a className="btn btn--ghost btn--wide" href={team.chatUrl} target="_blank" rel="noreferrer">Чат команды в телеграме</a>}

      {sheet === 'revenue' && <RevenueSheet open teamId={team.id} onClose={() => setSheet(null)} />}
      {sheet?.edit && <RevenueSheet open teamId={team.id} entry={sheet.edit} onClose={() => setSheet(null)} />}
      {sheet === 'contribution' && <ContributionSheet open teamId={team.id} stats={stats} onClose={() => setSheet(null)} />}
      <Sheet open={sheet === 'report'} onClose={() => setSheet(null)} title="Недельный отчёт" sub="Три строки, честно">
        <ReportForm teamId={team.id} report={report} onDone={() => setSheet(null)} />
      </Sheet>
    </div>
  );
}

function ReportForm({ teamId, report, onDone }) {
  const { dispatch } = useStore();
  const [done, setDone] = useState(report?.done || '');
  const [stuck, setStuck] = useState(report?.stuck || '');
  const [next, setNext] = useState(report?.next || '');
  return (
    <div className="stack">
      <Field label="Что сделали"><textarea className="field" value={done} onChange={(e) => setDone(e.target.value)} /></Field>
      <Field label="Что не получилось"><textarea className="field" value={stuck} onChange={(e) => setStuck(e.target.value)} /></Field>
      <Field label="Что дальше"><textarea className="field" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
      <Btn variant="accent" wide disabled={!done.trim()} onClick={() => { dispatch({ type: 'report', teamId, patch: { done, stuck, next } }); onDone(); }}>Сохранить</Btn>
    </div>
  );
}
