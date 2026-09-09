import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { leaderboard, seasonPot, teamOf, teamRoster, isPro } from '../lib/logic.js';
import { money, moneyShort } from '../lib/format.js';
import { AvatarStack, Btn, Card, Empty, TopBar } from '../components/UI.jsx';
import { IcTrophy, IcNext } from '../components/Icons.jsx';

/* Таблица лидеров. Выручка без взноса в копилку в рейтинг не идёт. */

export default function Rating({ navigate }) {
  const { state, me } = useStore();
  const board = leaderboard(state);
  const pot = seasonPot(state);
  const myTeam = teamOf(state, me.id);
  const [open, setOpen] = useState(null);

  if (!isPro(me)) {
    return (
      <div className="screen">
        <TopBar title="Рейтинг" />
        <Empty title="Рейтинг доступен в PRO" text="В нём участвуют команды, которые вносят выручку и закрывают копилку." />
      </div>
    );
  }

  return (
    <div className="screen">
      <TopBar title="Рейтинг" sub={state.season.title} />

      <div className="hero">
        <div className="row">
          <IcTrophy size={22} className="t-lime" />
          <div>
            <div className="t-dim">Копилка сезона</div>
            <div className="t-big mono">{money(pot)}</div>
          </div>
        </div>
        <div className="t-sub" style={{ marginTop: 8 }}>Столько потратим на призы и выпускной.</div>
      </div>

      <div className="table-head" style={{ marginTop: 18 }}>
        <span>#</span>
        <span>Команда</span>
        <span>Зачтено</span>
      </div>

      {board.length === 0 && <Empty title="Рейтинг пуст" text="Команда попадает сюда, когда в ней хотя бы трое." />}

      <Card>
        {board.map((row) => {
          const roster = teamRoster(state, row.team.id);
          const mine = myTeam?.id === row.team.id;
          const grey = row.debt > 0;
          const expanded = open === row.team.id;
          return (
            <div key={row.team.id} className={grey ? 'muted' : ''}>
              <div className="lead" onClick={() => setOpen(expanded ? null : row.team.id)} style={{ cursor: 'pointer' }}>
                <div className={`place ${row.place <= 3 ? 'top' : ''}`}>{row.place}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 6 }}>
                    <span className="ellipsis" style={{ fontWeight: 700 }}>{row.team.name}</span>
                    {mine && <span className="chip on" style={{ padding: '1px 7px', fontSize: 11 }}>вы</span>}
                  </div>
                  <div className="row" style={{ gap: 8, marginTop: 4 }}>
                    <AvatarStack users={roster.map((r) => r.user)} max={5} size={22} />
                    {grey && <span className="t-amber" style={{ fontSize: 11.5 }}>не засчитано</span>}
                  </div>
                </div>
                <div className="center">
                  <div className="mono" style={{ fontWeight: 800 }}>{moneyShort(row.counted)}</div>
                  <div className="t-dim">{row.hours} ч</div>
                </div>
              </div>

              {expanded && (
                <div className="stack s" style={{ padding: '0 0 12px 40px' }}>
                  <div className="t-sub">{row.team.idea}</div>
                  <div className="split"><span className="t-dim">Выручка всего</span><b className="mono">{money(row.total)}</b></div>
                  <div className="split"><span className="t-dim">Зачтено в рейтинг</span><b className="mono t-lime">{money(row.counted)}</b></div>
                  <div className="split">
                    <span className="t-dim">Копилка 10%</span>
                    <b className="mono">{money(row.paid)} из {money(row.required)}</b>
                  </div>
                  {row.debt > 0 && <div className="t-amber" style={{ fontSize: 12.5 }}>Не хватает {money(row.debt)}</div>}
                  <Btn kind="soft" small onClick={() => navigate(`/team/${row.team.id}`)}>
                    Открыть команду <IcNext size={15} />
                  </Btn>
                </div>
              )}
            </div>
          );
        })}
      </Card>

      <Card className="flat" style={{ marginTop: 14 }}>
        <div className="t-dim">
          Никто не проверяет цифры автоматически. Смысл в том, что выручка без взноса в копилку не засчитывается: команда
          сама отмечает перевод и прикладывает подтверждение.
        </div>
      </Card>
    </div>
  );
}
