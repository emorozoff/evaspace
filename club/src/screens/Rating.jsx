import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { leaderboard, seasonPot, teamOf, teamRoster, isPro } from '../lib/logic.js';
import { money, moneyShort } from '../lib/format.js';
import { AvatarStack, Card, Empty, KV, Note, Tag, TopBar } from '../components/UI.jsx';
import TeamAvatar from '../components/TeamAvatar.jsx';
import Icon from '../components/Icons.jsx';

/* Таблица лидеров: три кубка на подиуме, дальше медали.
   Выручка без взноса в копилку в рейтинг не идёт. */

export default function Rating() {
  const { state, me } = useStore();
  const board = leaderboard(state);
  const myTeam = teamOf(state, me.id);
  const [open, setOpen] = useState(myTeam?.id || null);

  if (!isPro(me)) {
    return (
      <div className="screen" style={{ paddingTop: 0 }}>
        <TopBar title="Рейтинг" backTo="/" />
        <Empty icon="cup" title="Рейтинг — в пакете PRO" text="В нём соревнуются команды, которые вносят выручку и закрывают копилку." />
      </div>
    );
  }

  const podium = board.slice(0, 3);
  const rest = board.slice(3);
  // На подиуме серебро слева, золото в центре, бронза справа
  const order = [podium[1], podium[0], podium[2]].filter(Boolean);

  return (
    <div className="screen" style={{ paddingTop: 0 }}>
      <TopBar title="Рейтинг" sub={state.season.title} backTo="/" />
      <div className="stack-20">
        <div className="card card--warm row">
          <div className="item__ic" style={{ color: 'var(--warm)' }}><Icon name="cup" size={19} /></div>
          <div className="grow">
            <div className="t-xs dim-2">Копилка сезона</div>
            <div className="figure" style={{ fontSize: 23, marginTop: 2 }}>{money(seasonPot(state))}</div>
          </div>
          <div className="t-xs dim-2" style={{ maxWidth: 108, textAlign: 'right' }}>на призы и выпускной</div>
        </div>

        {board.length === 0 ? (
          <Empty icon="cup" title="Рейтинг пуст" text="Команда попадает сюда, когда в ней хотя бы трое." />
        ) : (
          <>
            <div className="podium">
              {order.map((row) => (
                <button
                  key={row.team.id}
                  className="podium__i"
                  style={{ paddingTop: row.place === 1 ? 18 : 12, boxShadow: myTeam?.id === row.team.id ? 'inset 0 0 0 1.5px var(--accent)' : undefined }}
                  onClick={() => setOpen(open === row.team.id ? null : row.team.id)}
                >
                  <Icon name="cup" size={row.place === 1 ? 34 : 27} color={row.award.tone} />
                  <TeamAvatar team={row.team} size={row.place === 1 ? 40 : 34} />
                  <span className="podium__t">{row.team.name}</span>
                  <span className="podium__v" style={{ color: row.award.tone }}>{moneyShort(row.counted)}</span>
                </button>
              ))}
            </div>

            {rest.length > 0 && (
              <div className="list">
                {rest.map((row) => (
                  <Row key={row.team.id} row={row} mine={myTeam?.id === row.team.id} open={open === row.team.id} onToggle={() => setOpen(open === row.team.id ? null : row.team.id)} state={state} />
                ))}
              </div>
            )}

            {/* Раскрытая карточка призёра показывается отдельно под подиумом */}
            {podium.some((r) => r.team.id === open) && (
              <Card>
                <Details row={board.find((r) => r.team.id === open)} state={state} />
              </Card>
            )}
          </>
        )}

        <Note icon="eye">Никто не проверяет цифры автоматически. Выручка без взноса в копилку не засчитывается: команда сама отмечает перевод.</Note>
      </div>
    </div>
  );
}

function Row({ row, mine, open, onToggle, state }) {
  const roster = teamRoster(state, row.team.id);
  return (
    <div>
      <button className={`rank${row.debt > 0 ? ' rank--dim' : ''}`} onClick={onToggle}>
        <span className="award" style={{ background: 'var(--surface-2)', width: 36, height: 36 }}>
          <Icon name="medal" size={19} color="var(--ink-3)" />
          <span className="award__n">{row.place}</span>
        </span>
        <div className="grow">
          <div className="row" style={{ gap: 6 }}>
            <span className="t-md ell rank__t">{row.team.name}</span>
            {mine && <Tag tone="accent">вы</Tag>}
          </div>
          <div className="row" style={{ gap: 8, marginTop: 5 }}>
            <AvatarStack users={roster.map((r) => r.user)} max={4} size={22} />
            <span className="t-xs dim-2 nowrap">{row.activity}% · {row.hours} ч</span>
          </div>
        </div>
        <div className="item__meta">
          <div className="figure rank__v" style={{ fontSize: 15 }}>{moneyShort(row.counted)}</div>
          {row.debt > 0 && <span className="t-xs warm">не засчитано</span>}
        </div>
      </button>
      {open && <div style={{ padding: '0 14px 14px 52px' }}><Details row={row} state={state} /></div>}
    </div>
  );
}

function Details({ row, state }) {
  if (!row) return null;
  const roster = teamRoster(state, row.team.id);
  return (
    <>
      <div className="row" style={{ marginBottom: 10 }}>
        <TeamAvatar team={row.team} size={38} />
        <div className="grow">
          <div className="t-md">{row.team.name}</div>
          <div className="t-xs dim-2 clamp-2" style={{ whiteSpace: 'normal' }}>{row.team.goal || row.team.idea}</div>
        </div>
      </div>
      <KV k="Выручка всего" v={money(row.total)} />
      <KV k="Зачтено в рейтинг" v={money(row.counted)} tone="var(--accent)" />
      <KV k="Копилка 10%" v={`${money(row.paid)} из ${money(row.required)}`} tone={row.debt ? 'var(--warm)' : undefined} />
      <KV k="Активность команды" v={`${row.activity}%`} tone={row.activity >= 60 ? 'var(--accent)' : 'var(--warm)'} />
      <KV k="В команде" v={`${roster.length} чел.`} />
      <button className="t-sm accent" style={{ fontWeight: 600, marginTop: 10 }} onClick={() => go('/team')}>Открыть свою команду →</button>
    </>
  );
}
