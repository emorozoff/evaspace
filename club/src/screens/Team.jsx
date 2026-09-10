import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import {
  teamOf, teamRoster, teamStats, teamPlace, lastReport, applicationOf, isPro, awardOf,
  MIN_TEAM, MAX_TEAM, TEAM_ROLES, TEAM_TITLES, titleOf, invitableUsers, invitesFrom, attendanceOf, userById, cityName,
} from '../lib/logic.js';
import { weekKey, dateShort, startOfWeek, weekTitle, relative } from '../lib/time.js';
import { money } from '../lib/format.js';
import { Avatar, Btn, Card, Empty, Field, List, Item, Note, Search, Section, Sheet, Top, Tag } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';
import TeamAvatar from '../components/TeamAvatar.jsx';
import EventCompact from '../components/EventCompact.jsx';
import Choice from '../components/Choice.jsx';
import RevenueSheet, { ContributionSheet } from '../components/RevenueSheet.jsx';
import { STEPS } from '../data/onboarding.js';

const ROLE_ICON = Object.fromEntries(
  STEPS[0].questions[0].options.map((o) => [o.id, o.icon])
);

/* Вкладка «Команда». Состав собирает куратор, но участники могут
   усиливать команду сами — позвать человека без команды. */

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
  const [role, setRole] = useState(me.facts?.role?.[0] || TEAM_ROLES[0]);
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
              <div className="t-sm dim" style={{ marginTop: 4, lineHeight: 1.5 }}>
                Отправлена {relative(application.at, now)}. Куратор собирает команды из 3–10 человек так, чтобы роли не повторялись.
              </div>
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
            Команда — это 3–10 человек, одна цель и общая выручка в рейтинге. Куратор подбирает людей так, чтобы роли дополняли друг друга.
          </div>
          <Btn variant="accent" wide style={{ marginTop: 14 }} icon="hand" onClick={() => setOpen(true)}>Оставить заявку</Btn>
        </Card>
      )}

      <Section title="Как это устроено">
        <List>
          <Item icon="hand" title="Вы оставляете заявку" sub="Роль и сколько часов в неделю готовы вкладывать" chev={false} />
          <Item icon="team" title="Куратор собирает команды" sub="По ролям, опыту и цифрам из анкеты — чтобы силы были равными" chev={false} />
          <Item icon="cup" title="Команда идёт в рейтинг" sub="Выручка, активность и копилка 10%" chev={false} onClick={() => go('/rating')} />
        </List>
      </Section>

      <Section title={`Команды сезона · ${state.teams.length}`}>
        <List>
          {state.teams.map((t) => {
            const roster = teamRoster(state, t.id);
            return <Item key={t.id} lead={<TeamAvatar team={t} size={40} />} title={t.name} sub={t.goal || t.idea} meta={<span>{roster.length} чел.</span>} chev={false} />;
          })}
        </List>
      </Section>

      <Sheet open={open} onClose={() => setOpen(false)} title="Заявка в команду" sub="Три поля — куратору этого хватит">
        <div className="stack">
          <Field label="Какую роль возьмёте">
            <Choice options={TEAM_ROLES.map((r) => ({ id: r, label: r, icon: ROLE_ICON[r] }))} value={[role]} max={1} onChange={(v) => setRole(v[0])} />
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
  const { state, me, dispatch } = useStore();
  const roster = teamRoster(state, team.id);
  const stats = teamStats(state, team.id, now);
  const place = teamPlace(state, team.id);
  const award = place ? awardOf(place) : null;
  const report = lastReport(state, team.id);
  const [sheet, setSheet] = useState(null);
  const isCaptain = team.captainId === me.id;
  const pending = invitesFrom(state, team.id);
  const call = state.events
    .filter((e) => e.teamId === team.id && !e.canceled && e.startsAt > now - 2 * 3600 * 1000)
    .sort((a, b) => a.startsAt - b.startsAt)[0];

  return (
    <div className="screen stack-20">
      <div className="top">
        <TeamAvatar team={team} size={52} />
        <div className="grow">
          <h1 className="h2 ell">{team.name}</h1>
          <div className="t-xs dim-2" style={{ marginTop: 3 }}>{roster.length} человек · активность {stats.activity}%</div>
        </div>
        <button className="iconbtn" onClick={() => go('/rating')} aria-label="Рейтинг"><Icon name="cup" size={18} /></button>
      </div>

      {/* Место и цифры сезона */}
      <div className="card row" style={{ gap: 14 }}>
        {award && (
          <span className="award" style={{ background: `${award.tone}22`, width: 52, height: 52, borderRadius: 16 }}>
            <Icon name={award.icon} size={28} color={award.tone} />
            <span className="award__n">{place}</span>
          </span>
        )}
        <div className="grow">
          <div className="t-xs dim-2">Выручка сезона</div>
          <div className="figure" style={{ fontSize: 24, marginTop: 2 }}>{money(stats.total)}</div>
        </div>
        <div className="center">
          <div className="figure" style={{ fontSize: 17, color: stats.activity >= 60 ? 'var(--accent)' : 'var(--warm)' }}>{stats.activity}%</div>
          <div className="t-xs dim-2" style={{ marginTop: 2 }}>активность</div>
        </div>
      </div>

      <div className="pair">
        <Btn variant="accent" icon="money" onClick={() => setSheet('revenue')}>Выручка</Btn>
        <Btn variant="ghost" onClick={() => setSheet('contribution')}>Взнос 10%</Btn>
      </div>

      {roster.length < MIN_TEAM && <Note icon="team" tone="var(--warm)">В команде меньше {MIN_TEAM} человек — в рейтинг она пока не попадает. Позовите людей сами или подождите куратора.</Note>}
      {stats.debt > 0 && (
        <Note icon="cup" tone="var(--warm)">
          Копилка не закрыта: нужно {money(stats.required)}, отмечено {money(stats.paid)}. В рейтинг засчитано {money(stats.counted)} из {money(stats.total)}.
        </Note>
      )}

      {/* Цель сезона */}
      <Section title="Цель сезона" more={isCaptain ? 'Изменить' : undefined} onMore={() => setSheet('goal')}>
        <Card variant="violet">
          <div className="row-t">
            <div className="item__ic" style={{ color: 'var(--violet)' }}><Icon name="target" size={19} /></div>
            <div className="grow">
              <div className="t-md" style={{ lineHeight: 1.4 }}>{team.goal || 'Цель ещё не записана'}</div>
              {team.idea && <div className="t-xs dim-2" style={{ marginTop: 6 }}>{team.idea}</div>}
            </div>
          </div>
        </Card>
      </Section>

      {call && <Section title="Следующая встреча"><EventCompact event={call} now={now} /></Section>}

      {/* Состав */}
      <Section title={`Состав · ${roster.length}`} more={roster.length < MAX_TEAM ? 'Позвать' : undefined} onMore={() => setSheet('invite')}>
        <List>
          {[...roster]
            .sort((a, b) => rank(team, a.userId) - rank(team, b.userId))
            .map((m) => {
              const title = titleOf(team, m.userId);
              const been = attendanceOf(state, m.userId, now);
              return (
                <Item
                  key={m.userId}
                  lead={<Avatar user={m.user} size={44} ring={title === 'captain' ? 'var(--warm)' : undefined} />}
                  title={m.user.name}
                  sub={`${m.role}${title !== 'member' ? ` · ${TEAM_TITLES[title].toLowerCase()}` : ''} · ${been.percent}% встреч`}
                  meta={title === 'captain' ? <Icon name="crown" size={16} color="var(--warm)" /> : title === 'mate' ? <Icon name="shield" size={16} color="var(--accent)" /> : undefined}
                  onClick={isCaptain && m.userId !== me.id ? () => setSheet({ member: m }) : () => go(`/person/${m.userId}`)}
                />
              );
            })}
        </List>
        {isCaptain && <Note icon="crown">Вы капитан: можно менять роли, назначить помощника и звать людей в команду.</Note>}
      </Section>

      {pending.length > 0 && (
        <Section title="Позвали, ждём ответа">
          <List>
            {pending.map((i) => {
              const user = userById(state, i.userId);
              return <Item key={i.id} lead={<Avatar user={user} size={40} />} title={user?.name} sub={`${cityName(state, user?.cityId)} · ${relative(i.at, now)}`} meta={<Tag tone="warm">ждём</Tag>} chev={false} />;
            })}
          </List>
        </Section>
      )}

      {/* Отчёт */}
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

      {/* Выручка */}
      <Section title="Записи о выручке" more="Рейтинг" onMore={() => go('/rating')}>
        {stats.entries.length === 0 ? (
          <Empty icon="money" title="Пока пусто" text="Первая запись — самая приятная." />
        ) : (
          <List>
            {stats.entries.slice(0, 8).map((entry) => {
              const author = userById(state, entry.userId);
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

      {team.chatUrl && <a className="btn btn--ghost btn--wide" href={team.chatUrl} target="_blank" rel="noreferrer">Чат команды в телеграме</a>}

      {sheet === 'revenue' && <RevenueSheet open teamId={team.id} onClose={() => setSheet(null)} />}
      {sheet?.edit && <RevenueSheet open teamId={team.id} entry={sheet.edit} onClose={() => setSheet(null)} />}
      {sheet === 'contribution' && <ContributionSheet open teamId={team.id} stats={stats} onClose={() => setSheet(null)} />}
      <Sheet open={sheet === 'report'} onClose={() => setSheet(null)} title="Недельный отчёт" sub="Три строки, честно">
        <ReportForm teamId={team.id} report={report} onDone={() => setSheet(null)} />
      </Sheet>
      <Sheet open={sheet === 'goal'} onClose={() => setSheet(null)} title="Цель сезона" sub="Одна строка, к которой идёте все вместе">
        <GoalForm team={team} onDone={() => setSheet(null)} />
      </Sheet>
      <Sheet open={sheet === 'invite'} onClose={() => setSheet(null)} title="Позвать в команду" sub="Тот, кого зовёте, решает сам">
        <InviteForm team={team} onDone={() => setSheet(null)} />
      </Sheet>
      <Sheet open={Boolean(sheet?.member)} onClose={() => setSheet(null)} title={sheet?.member?.user.name} sub="Роль в команде">
        {sheet?.member && <MemberForm team={team} member={sheet.member} onDone={() => setSheet(null)} onKick={() => { dispatch({ type: 'unassign', teamId: team.id, userId: sheet.member.userId }); setSheet(null); }} />}
      </Sheet>
    </div>
  );
}

/* Капитан, помощник, остальные — в таком порядке */
function rank(team, userId) {
  if (team.captainId === userId) return 0;
  if (team.mateId === userId) return 1;
  return 2;
}

function MemberForm({ team, member, onDone, onKick }) {
  const { dispatch } = useStore();
  const [role, setRole] = useState(member.role);
  const title = titleOf(team, member.userId);
  return (
    <div className="stack">
      <Choice options={TEAM_ROLES.map((r) => ({ id: r, label: r, icon: ROLE_ICON[r] }))} value={[role]} max={1} onChange={(v) => setRole(v[0])} />
      <Btn variant="accent" wide onClick={() => { dispatch({ type: 'teamRole', teamId: team.id, userId: member.userId, role }); onDone(); }}>Сохранить роль</Btn>
      <List>
        <Item icon="shield" title={title === 'mate' ? 'Снять помощника' : 'Назначить помощником'} sub="Помощник ведёт отчёт, когда капитана нет" chev={false} onClick={() => { dispatch({ type: 'teamTitle', teamId: team.id, userId: member.userId, title: 'mate' }); onDone(); }} />
        <Item icon="crown" title="Передать капитанство" sub="Вы останетесь в команде участником" chev={false} onClick={() => { dispatch({ type: 'teamTitle', teamId: team.id, userId: member.userId, title: 'captain' }); onDone(); }} />
        <Item icon="out" title="Убрать из команды" tone="var(--red)" chev={false} onClick={onKick} />
      </List>
    </div>
  );
}

function InviteForm({ team, onDone }) {
  const { state, dispatch } = useStore();
  const [query, setQuery] = useState('');
  const list = invitableUsers(state, team.id)
    .filter((u) => !query || `${u.name} ${u.about}`.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 20);

  return (
    <div className="stack">
      <Note icon="gift">За каждого, кто придёт по вашему зову, — 500 ₽ бонусами. Команда сильнее, вам приятно.</Note>
      <Search value={query} onChange={setQuery} placeholder="Имя, город или дело" />
      {list.length === 0 ? (
        <Empty icon="people" title="Некого звать" text="Все подходящие участники уже в командах." />
      ) : (
        <List>
          {list.map((u) => (
            <Item
              key={u.id}
              lead={<Avatar user={u} size={40} />}
              title={u.name}
              sub={`${cityName(state, u.cityId)} · ${u.facts?.role?.[0] || u.about}`}
              meta={<Icon name="plus" size={17} color="var(--accent)" />}
              chev={false}
              onClick={() => { dispatch({ type: 'invite', teamId: team.id, userId: u.id }); onDone(); }}
            />
          ))}
        </List>
      )}
    </div>
  );
}

function GoalForm({ team, onDone }) {
  const { dispatch } = useStore();
  const [goal, setGoal] = useState(team.goal || '');
  return (
    <div className="stack">
      <Field label="Цель сезона"><textarea className="field" placeholder="Дойти до миллиона выручки и нанять первого сотрудника" value={goal} onChange={(e) => setGoal(e.target.value)} /></Field>
      <Btn variant="accent" wide disabled={goal.trim().length < 5} onClick={() => { dispatch({ type: 'teamPatch', teamId: team.id, patch: { goal } }); onDone(); }}>Сохранить</Btn>
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
