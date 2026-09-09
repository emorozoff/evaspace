import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { teamRoster, teamStats, teamPlace, lastReport, MIN_TEAM } from '../lib/logic.js';
import { weekKey, dateShort, startOfWeek, weekTitle } from '../lib/time.js';
import { money, moneyShort } from '../lib/format.js';
import { Avatar, Btn, Card, Empty, Area, Sheet, Stat, TopBar } from '../components/UI.jsx';
import { IcSpark, IcNext, IcTrophy, IcMoney } from '../components/Icons.jsx';
import EventCard from '../components/EventCard.jsx';
import RevenueSheet, { ContributionSheet } from '../components/RevenueSheet.jsx';

export default function TeamPage({ id, navigate, now, embedded = false }) {
  const { state, me, dispatch } = useStore();
  const team = state.teams.find((t) => t.id === id);
  const [sheet, setSheet] = useState(null);

  if (!team) return <Empty title="Команда не найдена" />;

  const roster = teamRoster(state, team.id);
  const stats = teamStats(state, team.id);
  const place = teamPlace(state, team.id);
  const report = lastReport(state, team.id);
  const isMember = roster.some((r) => r.userId === me.id);
  const isCaptain = team.captainId === me.id;
  const requests = state.requests.filter((r) => r.teamId === team.id && r.status === 'pending');
  const call = state.events
    .filter((e) => e.teamId === team.id && !e.canceled && e.startsAt > now - 2 * 3600 * 1000)
    .sort((a, b) => a.startsAt - b.startsAt)[0];

  return (
    <div className="screen">
      {embedded ? (
        <div className="topbar">
          <div className="logo">
            <div className="mark"><IcSpark size={16} className="t-lime" /></div>
            <div style={{ minWidth: 0 }}>
              <h1 className="ellipsis">{team.name}</h1>
              <div className="sub ellipsis">{team.idea}</div>
            </div>
          </div>
          <div className="spacer" />
          <button className="iconbtn" onClick={() => navigate('/rating')} aria-label="Рейтинг">
            <IcTrophy size={19} />
          </button>
        </div>
      ) : (
        <TopBar title={team.name} sub={team.idea} />
      )}

      <div className="hero">
        <div className="split">
          <div>
            <div className="t-dim">Место в рейтинге</div>
            <div className="t-huge t-lime mono">{place || '—'}</div>
          </div>
          <div className="center">
            <div className="t-dim">Выручка сезона</div>
            <div className="t-big mono">{moneyShort(stats.total)}</div>
          </div>
        </div>
        {roster.length < MIN_TEAM && (
          <div className="chip warn" style={{ marginTop: 12 }}>
            В команде меньше {MIN_TEAM} человек — в рейтинг пока не попадает
          </div>
        )}
        <div className="grid3" style={{ marginTop: 12 }}>
          <Stat value={roster.length} label="в команде" />
          <Stat value={`${stats.hours} ч`} label="сэкономлено" />
          <Stat value={stats.debt ? moneyShort(stats.debt) : 'ок'} label="копилка" tone={stats.debt ? 't-amber' : 't-lime'} />
        </div>
      </div>

      {isMember && (
        <div className="btn-row" style={{ marginTop: 10 }}>
          <Btn kind="primary" onClick={() => setSheet('revenue')}>
            <IcMoney size={18} /> Выручка
          </Btn>
          <Btn kind="soft" onClick={() => setSheet('contribution')}>
            Взнос 10%
          </Btn>
        </div>
      )}

      {stats.debt > 0 && (
        <Card style={{ marginTop: 10 }}>
          <div className="t-amber t-title">Копилка не закрыта</div>
          <div className="t-sub">
            С внесённой выручки нужно {money(stats.required)}, отмечено {money(stats.paid)}. В рейтинг засчитано{' '}
            {money(stats.counted)} из {money(stats.total)}.
          </div>
        </Card>
      )}

      {call && (
        <>
          <div className="section"><h2>Командный созвон</h2></div>
          <EventCard event={call} now={now} onOpen={() => navigate(`/event/${call.id}`)} />
        </>
      )}

      <div className="section">
        <h2>Недельный отчёт</h2>
        {isMember && <span className="link" onClick={() => setSheet('report')}>{report?.week === weekKey(now) ? 'Изменить' : 'Заполнить'}</span>}
      </div>
      {report ? (
        <Card>
          <div className="t-dim">{weekTitle(startOfWeek(report.at), now)}</div>
          <div className="stack s" style={{ marginTop: 8 }}>
            <div><b>Сделали:</b> <span className="t-sub">{report.done}</span></div>
            <div><b>Не получилось:</b> <span className="t-sub">{report.stuck}</span></div>
            <div><b>Дальше:</b> <span className="t-sub">{report.next}</span></div>
          </div>
        </Card>
      ) : (
        <Empty title="Отчёта ещё нет" text="Три строки в неделю: что сделали, что не получилось, что дальше." />
      )}

      <div className="section">
        <h2>Записи о выручке</h2>
        <span className="link" onClick={() => navigate('/rating')}>Рейтинг</span>
      </div>
      {stats.entries.length === 0 ? (
        <Empty title="Пока пусто" text="Первая запись о выручке — самая приятная." />
      ) : (
        <Card>
          {stats.entries.slice(0, 8).map((entry) => {
            const author = state.users.find((u) => u.id === entry.userId);
            const editable = entry.userId === me.id && now < entry.editableUntil;
            return (
              <div key={entry.id} className="lead" style={{ gridTemplateColumns: 'auto 1fr auto' }}>
                <Avatar user={author} size={30} />
                <div style={{ minWidth: 0 }}>
                  <div className="ellipsis" style={{ fontWeight: 600 }}>{entry.comment || 'Без описания'}</div>
                  <div className="t-dim">
                    {author?.name.split(' ')[0]} · {dateShort(entry.at)}
                    {entry.hours ? ` · ${entry.hours} ч` : ''}
                  </div>
                </div>
                <div className="center">
                  <div className="mono" style={{ fontWeight: 700 }}>{money(entry.amount)}</div>
                  {editable && (
                    <span className="link t-dim" style={{ fontSize: 11 }} onClick={() => setSheet({ edit: entry })}>
                      изменить
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {isCaptain && requests.length > 0 && (
        <>
          <div className="section"><h2>Заявки · {requests.length}</h2></div>
          <Card>
            {requests.map((r) => {
              const user = state.users.find((u) => u.id === r.userId);
              return (
                <div key={r.id} className="stack s" style={{ padding: '10px 0', borderTop: '1px solid var(--line)' }}>
                  <div className="row">
                    <Avatar user={user} size={34} />
                    <div style={{ minWidth: 0 }}>
                      <div className="ellipsis" style={{ fontWeight: 600 }}>{user?.name}</div>
                      <div className="t-dim ellipsis">{user?.about}</div>
                    </div>
                  </div>
                  <div className="btn-row">
                    <Btn kind="primary" small onClick={() => dispatch({ type: 'teamAnswer', requestId: r.id, accept: true })}>Принять</Btn>
                    <Btn kind="soft" small onClick={() => dispatch({ type: 'teamAnswer', requestId: r.id, accept: false })}>Отклонить</Btn>
                  </div>
                </div>
              );
            })}
          </Card>
        </>
      )}

      <div className="section">
        <h2>Состав · {roster.length}</h2>
        {isCaptain && (
          <span className="link" onClick={() => dispatch({ type: 'teamPatch', teamId: team.id, patch: { isOpen: !team.isOpen } })}>
            {team.isOpen ? 'Закрыть набор' : 'Открыть набор'}
          </span>
        )}
      </div>
      <Card>
        {roster.map((m) => (
          <div key={m.userId} className="lead" style={{ gridTemplateColumns: 'auto 1fr auto', cursor: 'pointer' }} onClick={() => navigate(`/person/${m.userId}`)}>
            <Avatar user={m.user} size={34} />
            <div style={{ minWidth: 0 }}>
              <div className="ellipsis" style={{ fontWeight: 600 }}>{m.user.name}</div>
              <div className="t-dim">{m.role}</div>
            </div>
            {isCaptain && m.userId !== me.id ? (
              <span
                className="link t-dim"
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({ type: 'teamKick', teamId: team.id, userId: m.userId });
                }}
              >
                убрать
              </span>
            ) : (
              <IcNext />
            )}
          </div>
        ))}
      </Card>

      {team.chatUrl && (
        <a className="btn soft wide" style={{ marginTop: 10 }} href={team.chatUrl} target="_blank" rel="noreferrer">
          Чат команды в телеграме
        </a>
      )}

      {isMember && (
        <Btn kind="danger" wide style={{ marginTop: 10 }} onClick={() => dispatch({ type: 'teamLeave' })}>
          Выйти из команды
        </Btn>
      )}

      {sheet === 'revenue' && <RevenueSheet teamId={team.id} onClose={() => setSheet(null)} />}
      {sheet?.edit && <RevenueSheet teamId={team.id} entry={sheet.edit} onClose={() => setSheet(null)} />}
      {sheet === 'contribution' && <ContributionSheet teamId={team.id} stats={stats} onClose={() => setSheet(null)} />}
      {sheet === 'report' && <ReportSheet teamId={team.id} report={report} onClose={() => setSheet(null)} />}
    </div>
  );
}

function ReportSheet({ teamId, report, onClose }) {
  const { dispatch } = useStore();
  const [done, setDone] = useState(report?.done || '');
  const [stuck, setStuck] = useState(report?.stuck || '');
  const [next, setNext] = useState(report?.next || '');

  return (
    <Sheet title="Недельный отчёт" sub="Три строки, честно" onClose={onClose}>
      <div className="stack">
        <Area label="Что сделали" value={done} onChange={(e) => setDone(e.target.value)} />
        <Area label="Что не получилось" value={stuck} onChange={(e) => setStuck(e.target.value)} />
        <Area label="Что дальше" value={next} onChange={(e) => setNext(e.target.value)} />
        <Btn
          kind="primary"
          wide
          disabled={!done.trim()}
          onClick={() => {
            dispatch({ type: 'report', teamId, patch: { done, stuck, next } });
            onClose();
          }}
        >
          Сохранить
        </Btn>
      </div>
    </Sheet>
  );
}
