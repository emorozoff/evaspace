import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import {
  teamOf, teamRoster, teamStats, teamPlace, lastReport, applicationOf, isPro, awardOf,
  MIN_TEAM, MAX_TEAM, TEAM_ROLES, TEAM_AIMS, TEAM_FIELDS, TEAM_TITLES, titleOf, invitableUsers, invitesFrom,
  attendanceOf, userById, cityName, chatKey, unreadIn, votesOf, openVotes, voteTally, voteSummary, VOTE_KINDS,
} from '../lib/logic.js';
import { callLabel, callPlan } from '../lib/events.js';
import { weekKey, dateShort, startOfWeek, weekTitle, relative, WEEK } from '../lib/time.js';
import { money, moneyShort } from '../lib/format.js';
import { Avatar, AvatarStack, Btn, Card, Empty, Field, List, Item, Note, Search, Section, Seg, Sheet, Top, Tag } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';
import TeamAvatar from '../components/TeamAvatar.jsx';
import TeamCover, { COVERS } from '../components/TeamCover.jsx';
import EventCompact from '../components/EventCompact.jsx';
import Choice from '../components/Choice.jsx';
import RevenueSheet, { ContributionSheet } from '../components/RevenueSheet.jsx';
import { STEPS } from '../data/onboarding.js';

const ROLE_ICON = Object.fromEntries(STEPS[1].questions[1].options.map((o) => [o.id, o.icon]));

export default function Team({ id, now }) {
  const { state, me } = useStore();
  const mine = teamOf(state, me.id);
  // По id открывается чужая команда — из списка всех команд или из рейтинга
  const team = id ? state.teams.find((t) => t.id === id) || null : mine;
  if (id === 'all') return <AllTeams now={now} />;

  if (!isPro(me)) {
    return (
      <div className="screen stack-20">
        <Top title="Команда" />
        <Empty icon="team" title="Команды — в пакете PRO" text="В CLUB открыты события, база знаний и люди. Команда, рейтинг и мастермайнды — в PRO." action={<Btn variant="accent" size="sm" onClick={() => go('/profile')}>Посмотреть пакеты</Btn>} />
      </div>
    );
  }
  if (id && !team) return <div className="screen stack-20"><Top title="Команда" back backTo="/team" /><Empty icon="team" title="Команда не найдена" /></div>;
  if (!team) return <Waiting now={now} />;
  return <TeamScreen key={team.id} team={team} mine={mine?.id === team.id} now={now} />;
}

/* ---------- без команды ---------- */
function Waiting({ now }) {
  const { state, me, dispatch } = useStore();
  const application = applicationOf(state, me.id);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState(me.facts?.craft?.[0] || TEAM_ROLES[0]);
  const [hours, setHours] = useState('5');
  const [aim, setAim] = useState([TEAM_AIMS[0].id]);
  const [field, setField] = useState([TEAM_FIELDS[0].id]);
  const [about, setAbout] = useState(me.about || '');

  return (
    <div className="screen stack-20">
      <Top title="Команда" sub="Команды на сезон собирает ИИ-куратор" />

      {application ? (
        <Card variant="accent">
          <div className="row-t">
            <div className="item__ic"><Icon name="clock" size={19} /></div>
            <div className="grow">
              <div className="t-lg">Заявка у куратора</div>
              <div className="t-sm dim" style={{ marginTop: 4, lineHeight: 1.5 }}>
                Отправлена {relative(application.at, now)}. ИИ-куратор разложит заявки по командам из 3–10 человек: сравнит роли, сферы и опыт, чтобы силы вышли равными.
              </div>
              <div className="wrap" style={{ marginTop: 10 }}>
                <Tag tone="accent">{application.role}</Tag>
                <Tag>{application.hours} ч проекту</Tag>
                {application.aim?.[0] && <Tag tone="violet">{application.aim[0]}</Tag>}
                {application.field?.[0] && <Tag>{application.field[0]}</Tag>}
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
            Команда — это 3–10 человек, одна цель и общая выручка в рейтинге. ИИ-куратор подбирает людей по анкете: роли, сферы и опыт должны дополнять друг друга.
          </div>
          <Btn variant="accent" wide style={{ marginTop: 14 }} icon="hand" onClick={() => setOpen(true)}>Оставить заявку</Btn>
        </Card>
      )}

      <Section title={`Команды сезона · ${state.teams.length}`}>
        <List>
          {state.teams.map((t) => (
            <Item key={t.id} lead={<TeamAvatar team={t} size={44} />} title={t.name} sub={t.goal || t.idea} meta={<span>{teamRoster(state, t.id).length} чел.</span>} chev={false} />
          ))}
        </List>
      </Section>

      <Sheet open={open} onClose={() => setOpen(false)} title="Заявка в команду" sub="По этим ответам ИИ-куратор и собирает состав">
        <div className="stack">
          <Field label="Какую роль возьмёте" hint="Роли в команде не должны повторяться">
            <Choice options={TEAM_ROLES.map((r) => ({ id: r, label: r, icon: ROLE_ICON[r] }))} value={[role]} max={1} onChange={(v) => setRole(v[0])} />
          </Field>
          <Field label="Зачем вам команда" hint="Команды собираются по общей цели">
            <Choice options={TEAM_AIMS} value={aim} max={1} onChange={setAim} />
          </Field>
          <Field label="Что хотите делать" hint="Можно вписать своё">
            <Choice options={TEAM_FIELDS} value={field} max={1} onChange={setField} />
          </Field>
          <Field label="Сколько часов в неделю готовы уделять проекту и команде" hint="Честно: по этому куратор сверяет ожидания внутри команды">
            <input className="field" inputMode="numeric" value={hours} onChange={(e) => setHours(e.target.value.replace(/\D/g, ''))} />
          </Field>
          <Field label="Что умеете и что хотите сделать за сезон"><textarea className="field" value={about} onChange={(e) => setAbout(e.target.value)} /></Field>
          <Btn variant="accent" wide onClick={() => { dispatch({ type: 'apply', role, hours: Number(hours) || 0, aim, field, about }); setOpen(false); }}>Отправить куратору</Btn>
        </div>
      </Sheet>
    </div>
  );
}

/* ---------- все команды сезона ---------- */
function AllTeams({ now }) {
  const { state, me } = useStore();
  const mine = teamOf(state, me.id);
  return (
    <div className="screen stack-20">
      <Top title="Команды сезона" sub={`${state.teams.length} команд`} back backTo={mine ? '/team' : '/'} />
      <div className="stack-8">
        {state.teams.map((t) => {
          const roster = teamRoster(state, t.id);
          const stats = teamStats(state, t.id, now);
          const place = teamPlace(state, t.id);
          return (
            <button key={t.id} className="card tap" onClick={() => go(`/team/${t.id}`)}>
              <div className="row">
                <TeamAvatar team={t} size={46} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 6 }}>
                    <span className="t-md ell">{t.name}</span>
                    {mine?.id === t.id && <Tag tone="accent">ваша</Tag>}
                  </div>
                  <div className="t-xs dim-2 ell" style={{ marginTop: 2 }}>{t.goal || t.idea}</div>
                </div>
                {place && (
                  <span className="award" style={{ background: `${awardOf(place).tone}22` }}>
                    <Icon name={awardOf(place).icon} size={19} color={awardOf(place).tone} />
                    <span className="award__n">{place}</span>
                  </span>
                )}
              </div>
              <div className="row" style={{ gap: 10, marginTop: 10 }}>
                <AvatarStack users={roster.map((r) => r.user)} max={5} size={24} />
                <span className="t-xs dim-2">{roster.length} чел. · {moneyShort(stats.total)} · {stats.activity}% актив.</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- экран команды ---------- */
function TeamScreen({ team, mine, now }) {
  const { state, me, dispatch } = useStore();
  const roster = teamRoster(state, team.id);
  const stats = teamStats(state, team.id, now);
  const place = teamPlace(state, team.id);
  const award = place ? awardOf(place) : null;
  const report = lastReport(state, team.id);
  const [sheet, setSheet] = useState(null);
  const [tab, setTab] = useState('team');
  const isCaptain = team.captainId === me.id;
  const inTeam = roster.some((m) => m.userId === me.id);
  const pending = invitesFrom(state, team.id);
  const chat = chatKey('team', [team.id]);
  const unread = unreadIn(state, chat, me.id);
  const open = openVotes(state, team.id);
  const call = state.events
    .filter((e) => e.teamId === team.id && !e.canceled && e.startsAt > now - 2 * 3600 * 1000)
    .sort((a, b) => a.startsAt - b.startsAt)[0];

  return (
    <div className="screen stack-20">
      {/* Своя команда сверху, рядом вход во все команды сезона */}
      <div className="spread" style={{ padding: '2px 2px 0' }}>
        {mine ? (
          <span className="t-xs dim-2">Ваша команда</span>
        ) : (
          <button className="backbtn" style={{ height: 32 }} onClick={() => go('/team')}>
            <Icon name="back" size={16} /><span>Моя команда</span>
          </button>
        )}
        <button className="allbtn" onClick={() => go('/team/all')}>
          <Icon name="grid" size={15} /><span>Все команды</span>
        </button>
      </div>

      {/* Обложка — лицо команды, её меняет капитан */}
      <TeamCover team={team} height={150}>
        {isCaptain && mine && (
          <button className="iconbtn tcover__edit" onClick={() => setSheet('cover')} aria-label="Сменить обложку"><Icon name="edit" size={16} /></button>
        )}
        <div className="tcover__body">
          <TeamAvatar team={team} size={52} />
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="h2 ell">{team.name}</div>
            <div className="t-xs dim-2">{roster.length} человек · активность {stats.activity}%</div>
          </div>
          {award && (
            <span className="award" style={{ background: `${award.tone}22` }}>
              <Icon name={award.icon} size={22} color={award.tone} />
              <span className="award__n">{place}</span>
            </span>
          )}
        </div>
      </TeamCover>

      {inTeam && (
        <Seg
          value={tab}
          onChange={setTab}
          options={[
            { value: 'team', label: 'Команда' },
            { value: 'votes', label: open.length ? `Голосования · ${open.length}` : 'Голосования' },
          ]}
        />
      )}

      {tab === 'votes' ? (
        <Votes team={team} now={now} />
      ) : (
      <>
      {/* Чат и созвон — первое, что нужно каждый день */}
      <div className="pair">
        <Btn variant="ghost" icon="message" onClick={() => go(`/chat/${encodeURIComponent(chat)}`)}>
          Чат{unread > 0 ? ` · ${unread}` : ''}
        </Btn>
        <Btn variant="ghost" icon="calendar" onClick={() => call && go(`/event/${call.id}`)} disabled={!call}>Созвон</Btn>
      </div>

      {/* Расписание созвонов меняется голосованием, а не решением капитана */}
      <button className="card tap row" onClick={() => inTeam && setSheet('call')}>
        <div className="item__ic"><Icon name="calendar" size={19} /></div>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="t-xs dim-2">Созвон команды</div>
          <div className="t-md" style={{ lineHeight: 1.3 }}>{callLabel(team)}</div>
        </div>
        {inTeam && <span className="t-xs accent" style={{ fontWeight: 700 }}>изменить</span>}
      </button>

      {/* Выручка: одна плашка, подробности — по нажатию */}
      <button className="card tap" onClick={() => setSheet('money')}>
        <div className="spread">
          <div>
            <div className="t-xs dim-2">Выручка сезона</div>
            <div className="figure" style={{ fontSize: 26, marginTop: 3 }}>{money(stats.total)}</div>
          </div>
          <div className="center">
            <Icon name="chart" size={20} color="var(--accent)" />
            <div className="t-xs dim-2" style={{ marginTop: 4 }}>подробнее</div>
          </div>
        </div>
        {stats.debt > 0 && <div className="t-xs warm" style={{ marginTop: 10 }}>Копилка не закрыта: не хватает {money(stats.debt)}</div>}
      </button>

      {roster.length < MIN_TEAM && <Note icon="team" tone="var(--warm)">В команде меньше {MIN_TEAM} человек — в рейтинг она пока не попадает. ИИ-куратор доберёт людей из новых заявок.</Note>}

      <Section title="Цель команды на сезон">
        <Card variant="violet">
          <div className="row-t">
            <div className="item__ic" style={{ color: 'var(--violet)' }}><Icon name="target" size={19} /></div>
            <div className="grow t-md" style={{ lineHeight: 1.4 }}>{team.goal || 'Цель ещё не записана'}</div>
            {inTeam && (
              <button className="iconbtn" style={{ width: 32, height: 32 }} onClick={() => setSheet('goal')} aria-label="Предложить цель">
                <Icon name="edit" size={15} />
              </button>
            )}
          </div>
          {inTeam && (
            <div className="t-xs dim-2" style={{ marginTop: 10, lineHeight: 1.5 }}>
              Цель меняет вся команда: любой предлагает свою, она уходит на голосование и меняется только при единогласном «за».
            </div>
          )}
        </Card>
      </Section>

      <Section title={`Состав · ${roster.length}`} more={roster.length < MAX_TEAM ? 'Позвать' : undefined} onMore={() => setSheet('invite')}>
        <List>
          {[...roster].sort((a, b) => rank(team, a.userId) - rank(team, b.userId)).map((m) => {
            const title = titleOf(team, m.userId);
            const been = attendanceOf(state, m.userId, now);
            return (
              <Item
                key={m.userId}
                lead={<Avatar user={m.user} size={44} ring={title === 'captain' ? 'var(--warm)' : title === 'mate' ? 'var(--accent)' : undefined} />}
                title={m.user.name}
                sub={`${m.role}${title !== 'member' ? ` · ${TEAM_TITLES[title].toLowerCase()}` : ''} · ${been.percent}% встреч`}
                meta={title === 'captain' ? <Icon name="crown" size={16} color="var(--warm)" /> : title === 'mate' ? <Icon name="shield" size={16} color="var(--accent)" /> : undefined}
                onClick={isCaptain && m.userId !== me.id ? () => setSheet({ member: m }) : () => go(`/person/${m.userId}`)}
              />
            );
          })}
        </List>
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

      {call && <Section title="Следующая встреча"><EventCompact event={call} now={now} /></Section>}

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

      </>
      )}

      {sheet === 'money' && <MoneySheet team={team} stats={stats} now={now} onClose={() => setSheet(null)} onAdd={() => setSheet('revenue')} onPay={() => setSheet('contribution')} onEdit={(entry) => setSheet({ edit: entry })} />}
      {sheet === 'revenue' && <RevenueSheet open teamId={team.id} onClose={() => setSheet(null)} />}
      {sheet?.edit && <RevenueSheet open teamId={team.id} entry={sheet.edit} onClose={() => setSheet(null)} />}
      {sheet === 'contribution' && <ContributionSheet open teamId={team.id} stats={stats} onClose={() => setSheet(null)} />}
      <Sheet open={sheet === 'report'} onClose={() => setSheet(null)} title="Недельный отчёт" sub="Три строки, честно">
        <ReportForm teamId={team.id} report={report} onDone={() => setSheet(null)} />
      </Sheet>
      <Sheet open={sheet === 'goal'} onClose={() => setSheet(null)} title="Предложить цель" sub="Команда решает единогласно">
        {sheet === 'goal' && <GoalForm team={team} onDone={() => { setSheet(null); setTab('votes'); }} />}
      </Sheet>
      <Sheet open={sheet === 'call'} onClose={() => setSheet(null)} title="Время созвона" sub="Новое время утверждает вся команда">
        {sheet === 'call' && <CallForm team={team} onDone={() => { setSheet(null); setTab('votes'); }} />}
      </Sheet>
      <Sheet open={sheet === 'cover'} onClose={() => setSheet(null)} title="Обложка команды" sub="Видна всем в клубе">
        <div className="stack">
          {COVERS.map((name, i) => (
            <button key={name} onClick={() => { dispatch({ type: 'teamCover', teamId: team.id, cover: i }); setSheet(null); }} style={{ display: 'block', width: '100%' }}>
              <TeamCover team={{ ...team, cover: i }} height={92}>
                <div className="tcover__body"><span className="t-md">{name}</span></div>
              </TeamCover>
            </button>
          ))}
        </div>
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

function rank(team, userId) {
  if (team.captainId === userId) return 0;
  if (team.mateId === userId) return 1;
  return 2;
}

/** Вся денежная кухня в одном месте: график по неделям, записи и кнопки. */
function MoneySheet({ team, stats, now, onClose, onAdd, onPay, onEdit }) {
  const { state, me } = useStore();
  const weeks = useMemo(() => {
    const start = startOfWeek(state.season.startsAt);
    const count = Math.min(10, Math.round((startOfWeek(now) - start) / WEEK) + 1);
    return Array.from({ length: count }, (_, i) => {
      const from = start + i * WEEK;
      const sum = stats.entries.filter((e) => e.at >= from && e.at < from + WEEK).reduce((s, e) => s + e.amount, 0);
      return { from, sum };
    });
  }, [state.season.startsAt, stats.entries, now]);
  const peak = Math.max(1, ...weeks.map((w) => w.sum));

  return (
    <Sheet open onClose={onClose} title="Выручка команды" sub={`${team.name} · сезон`}>
      <div className="stack-20">
        <div className="stats">
          <div className="stat"><div className="stat__v" style={{ fontSize: 16 }}>{moneyShort(stats.total)}</div><div className="stat__l">всего</div></div>
          <div className="stat"><div className="stat__v" style={{ fontSize: 16 }}>{moneyShort(stats.counted)}</div><div className="stat__l">зачтено</div></div>
          <div className="stat"><div className="stat__v" style={{ fontSize: 16, color: stats.debt ? 'var(--warm)' : 'var(--accent)' }}>{stats.debt ? moneyShort(stats.debt) : 'ок'}</div><div className="stat__l">копилка</div></div>
        </div>

        <Card>
          <div className="t-xs dim-2" style={{ marginBottom: 10 }}>По неделям сезона</div>
          <div className="spark">
            {weeks.map((w, i) => (
              <div key={w.from} className="spark__col">
                <div className={`spark__bar${w.sum ? '' : ' spark__bar--dim'}`} style={{ height: `${Math.max(3, (w.sum / peak) * 76)}px` }} title={money(w.sum)} />
                <span className="spark__l">{i + 1}</span>
              </div>
            ))}
          </div>
          <div className="t-xs dim-2 center" style={{ marginTop: 8 }}>Лучшая неделя — {money(peak)}</div>
        </Card>

        <div className="pair">
          <Btn variant="accent" icon="money" onClick={onAdd}>Добавить</Btn>
          <Btn variant="ghost" onClick={onPay}>Взнос 10%</Btn>
        </div>

        {stats.entries.length === 0 ? (
          <Empty icon="money" title="Пока пусто" text="Первая запись — самая приятная." />
        ) : (
          <List>
            {stats.entries.slice(0, 12).map((entry) => {
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
                  onClick={editable ? () => onEdit(entry) : undefined}
                />
              );
            })}
          </List>
        )}
      </div>
    </Sheet>
  );
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
      <Note icon="gift">За каждого, кто придёт по вашему зову, — 500 ₽ бонусами.</Note>
      <Search value={query} onChange={setQuery} placeholder="Имя, город или дело" />
      {list.length === 0 ? (
        <Empty icon="people" title="Некого звать" text="Все подходящие участники уже в командах." />
      ) : (
        <List>
          {list.map((u) => (
            <Item key={u.id} lead={<Avatar user={u} size={40} />} title={u.name} sub={`${cityName(state, u.cityId)} · ${u.facts?.craft?.[0] || u.about}`} meta={<Icon name="plus" size={17} color="var(--accent)" />} chev={false} onClick={() => { dispatch({ type: 'invite', teamId: team.id, userId: u.id }); onDone(); }} />
          ))}
        </List>
      )}
    </div>
  );
}

/* ---------- голосования команды ---------- */

/** Единогласно — значит каждый видит, чей голос ещё не пришёл. */
function Votes({ team, now }) {
  const { state, me, dispatch } = useStore();
  const open = openVotes(state, team.id);
  const closed = [...votesOf(state, team.id, 'passed'), ...votesOf(state, team.id, 'failed')].sort((a, b) => b.at - a.at).slice(0, 6);

  return (
    <div className="stack-20">
      {open.length === 0 ? (
        <Empty
          icon="hand"
          title="Открытых голосований нет"
          text="Предложите новую цель команды или другое время созвона — предложение уйдёт всем сразу."
        />
      ) : (
        <div className="stack-8">
          {open.map((vote) => {
            const tally = voteTally(state, vote);
            const author = userById(state, vote.byId);
            const my = vote.votes[me.id];
            return (
              <Card key={vote.id}>
                <div className="row">
                  <div className="item__ic"><Icon name={VOTE_KINDS[vote.kind].icon} size={19} /></div>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="t-xs dim-2">{VOTE_KINDS[vote.kind].title} · предложил {author?.name.split(' ')[0]}</div>
                    <div className="t-md" style={{ marginTop: 2, lineHeight: 1.35 }}>{voteSummary(vote)}</div>
                  </div>
                  <Tag tone="warm">{tally.yes.length} из {tally.need}</Tag>
                </div>

                <div className="row" style={{ gap: 8, marginTop: 12 }}>
                  <AvatarStack users={tally.yes.map((m) => m.user)} max={6} size={26} />
                  <span className="t-xs dim-2 grow">
                    {tally.waiting.length ? `ждём: ${tally.waiting.map((m) => m.user.name.split(' ')[0]).join(', ')}` : 'все проголосовали'}
                  </span>
                </div>

                {my ? (
                  <div className="t-sm dim" style={{ marginTop: 12 }}>
                    Ваш голос: <b className={my === 'yes' ? 'accent' : 'red'}>{my === 'yes' ? 'за' : 'против'}</b>
                    {vote.byId === me.id && (
                      <>
                        {' · '}
                        <button className="t-xs dim-2" onClick={() => dispatch({ type: 'voteCancel', id: vote.id })}>снять предложение</button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="pair" style={{ marginTop: 12 }}>
                    <Btn variant="accent" size="sm" icon="check" onClick={() => dispatch({ type: 'voteCast', id: vote.id, yes: true })}>За</Btn>
                    <Btn variant="quiet" size="sm" onClick={() => dispatch({ type: 'voteCast', id: vote.id, yes: false })}>Против</Btn>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Note icon="hand">
        Решение принимается только единогласно: один голос «против» закрывает предложение. Так никто не остаётся
        с целью или временем, которые ему не подходят.
      </Note>

      {closed.length > 0 && (
        <Section title="Уже решили">
          <List>
            {closed.map((vote) => (
              <Item
                key={vote.id}
                icon={VOTE_KINDS[vote.kind].icon}
                title={voteSummary(vote)}
                sub={`${VOTE_KINDS[vote.kind].title} · ${relative(vote.at, now)}`}
                meta={<Tag tone={vote.status === 'passed' ? 'accent' : undefined}>{vote.status === 'passed' ? 'принято' : 'не прошло'}</Tag>}
                chev={false}
              />
            ))}
          </List>
        </Section>
      )}
    </div>
  );
}

function GoalForm({ team, onDone }) {
  const { state, me, dispatch } = useStore();
  const [goal, setGoal] = useState(team.goal || '');
  const alone = teamRoster(state, team.id).length <= 1;
  return (
    <div className="stack">
      <Field label="Цель команды на сезон" hint="Одна строка, к которой идёте все вместе">
        <textarea className="field" placeholder="Дойти до миллиона выручки и нанять первого сотрудника" value={goal} onChange={(e) => setGoal(e.target.value)} />
      </Field>
      <Note icon="hand">
        {alone
          ? 'Вы пока одни в команде — цель применится сразу.'
          : 'Предложение уйдёт всем в команде. Цель поменяется, только если все ответят «за».'}
      </Note>
      <Btn
        variant="accent"
        wide
        disabled={goal.trim().length < 5 || goal.trim() === (team.goal || '').trim()}
        onClick={() => { dispatch({ type: 'voteStart', teamId: team.id, kind: 'goal', proposal: { goal: goal.trim() } }); onDone(); }}
      >
        {alone ? 'Записать цель' : 'Отправить на голосование'}
      </Btn>
      {me.id === team.captainId && !alone && (
        <div className="t-xs dim-2 center">Капитан предлагает так же, как все: команда решает вместе.</div>
      )}
    </div>
  );
}

const WEEKDAY_OPTIONS = [
  { id: 1, label: 'Пн' }, { id: 2, label: 'Вт' }, { id: 3, label: 'Ср' }, { id: 4, label: 'Чт' },
  { id: 5, label: 'Пт' }, { id: 6, label: 'Сб' }, { id: 7, label: 'Вс' },
];
const HOUR_OPTIONS = [9, 11, 13, 15, 17, 18, 19, 20, 21];

/** Новое время созвона: день недели и час, дальше решает команда. */
function CallForm({ team, onDone }) {
  const { state, dispatch } = useStore();
  const plan = callPlan(team);
  const [weekday, setWeekday] = useState(plan.weekday);
  const [hour, setHour] = useState(plan.hour);
  const [minute, setMinute] = useState(plan.minute);
  const alone = teamRoster(state, team.id).length <= 1;
  const same = weekday === plan.weekday && hour === plan.hour && minute === plan.minute;

  return (
    <div className="stack">
      <Note icon="calendar">Сейчас: {callLabel(team)}. Созвон всегда раз в две недели — меняются только день и время.</Note>

      <Field label="День недели">
        <div className="wrap">
          {WEEKDAY_OPTIONS.map((d) => (
            <button key={d.id} className={`chip${weekday === d.id ? ' chip--on' : ''}`} onClick={() => setWeekday(d.id)}>{d.label}</button>
          ))}
        </div>
      </Field>

      <Field label="Начало">
        <div className="wrap">
          {HOUR_OPTIONS.map((h) => (
            <button key={h} className={`chip${hour === h && minute === 0 ? ' chip--on' : ''}`} onClick={() => { setHour(h); setMinute(0); }}>
              {String(h).padStart(2, '0')}:00
            </button>
          ))}
          <button className={`chip${minute === 30 ? ' chip--on' : ''}`} onClick={() => setMinute(minute === 30 ? 0 : 30)}>+30 минут</button>
        </div>
      </Field>

      <Btn
        variant="accent"
        wide
        disabled={same}
        onClick={() => { dispatch({ type: 'voteStart', teamId: team.id, kind: 'call', proposal: { ...plan, weekday, hour, minute } }); onDone(); }}
      >
        {alone ? 'Поставить это время' : 'Отправить команде на голосование'}
      </Btn>
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
