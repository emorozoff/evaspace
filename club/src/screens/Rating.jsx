import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { leaderboard, seasonPot, teamOf, teamRoster, isPro } from '../lib/logic.js';
import { money, moneyShort } from '../lib/format.js';
import { AvatarStack, Empty, KV, Note, Tag, TopBar } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';

/* Таблица лидеров. Выручка без взноса в копилку в рейтинг не идёт. */

export default function Rating() {
  const { state, me } = useStore();
  const board = leaderboard(state);
  const myTeam = teamOf(state, me.id);
  const [open, setOpen] = useState(myTeam?.id || null);

  if (!isPro(me)) {
    return (
      <div className="screen" style={{ paddingTop: 0 }}>
        <TopBar title="Рейтинг" />
        <Empty icon="trophy" title="Рейтинг — в пакете PRO" text="В нём соревнуются команды, которые вносят выручку и закрывают копилку." />
      </div>
    );
  }

  return (
    <div className="screen" style={{ paddingTop: 0 }}>
      <TopBar title="Рейтинг" sub={state.season.title} />
      <div className="stack-20">
        <div className="card card--warm row">
          <div className="item__ic" style={{ color: 'var(--warm)' }}><Icon name="trophy" size={19} /></div>
          <div className="grow">
            <div className="t-xs dim-2">Копилка сезона</div>
            <div className="figure" style={{ fontSize: 24, marginTop: 2 }}>{money(seasonPot(state))}</div>
          </div>
          <div className="t-xs dim-2" style={{ maxWidth: 110, textAlign: 'right' }}>на призы и выпускной</div>
        </div>

        {board.length === 0 ? (
          <Empty icon="trophy" title="Рейтинг пуст" text="Команда попадает сюда, когда в ней хотя бы трое." />
        ) : (
          <div className="list">
            {board.map((row) => {
              const roster = teamRoster(state, row.team.id);
              const mine = myTeam?.id === row.team.id;
              const expanded = open === row.team.id;
              return (
                <div key={row.team.id}>
                  <button className={`rank${row.debt > 0 ? ' rank--dim' : ''}`} onClick={() => setOpen(expanded ? null : row.team.id)}>
                    <div className={`rank__n${row.place <= 3 ? ' rank__n--top' : ''}`}>{row.place}</div>
                    <div className="grow">
                      <div className="row" style={{ gap: 6 }}>
                        <span className="t-md ell rank__t">{row.team.name}</span>
                        {mine && <Tag tone="accent">вы</Tag>}
                      </div>
                      <div className="row" style={{ gap: 8, marginTop: 5 }}>
                        <AvatarStack users={roster.map((r) => r.user)} max={4} size={22} />
                        {row.debt > 0 && <span className="t-xs warm">не засчитано</span>}
                      </div>
                    </div>
                    <div className="center">
                      <div className="figure rank__v" style={{ fontSize: 15 }}>{moneyShort(row.counted)}</div>
                      <div className="t-xs dim-2" style={{ marginTop: 3 }}>{row.hours} ч</div>
                    </div>
                  </button>
                  {expanded && (
                    <div style={{ padding: '0 14px 14px 52px' }}>
                      <div className="t-xs dim" style={{ marginBottom: 6 }}>{row.team.idea}</div>
                      <KV k="Выручка всего" v={money(row.total)} />
                      <KV k="Зачтено в рейтинг" v={money(row.counted)} tone="var(--accent)" />
                      <KV k="Копилка 10%" v={`${money(row.paid)} из ${money(row.required)}`} tone={row.debt ? 'var(--warm)' : undefined} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <Note icon="eye">Никто не проверяет цифры автоматически. Выручка без взноса в копилку не засчитывается: команда сама отмечает перевод и прикладывает подтверждение.</Note>
      </div>
    </div>
  );
}
