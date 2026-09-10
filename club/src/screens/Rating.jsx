import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { leaderboard, seasonPot, teamOf, teamRoster, isPro } from '../lib/logic.js';
import { money, moneyShort } from '../lib/format.js';
import { AvatarStack, Empty, KV, Note, Section, Tag, TopBar } from '../components/UI.jsx';
import TeamAvatar from '../components/TeamAvatar.jsx';
import { SponsorArt } from './Sponsor.jsx';
import Icon from '../components/Icons.jsx';

/* Рейтинг — простой список: кубок за первые три места, дальше медали. */

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

  return (
    <div className="screen" style={{ paddingTop: 0 }}>
      <TopBar title="Рейтинг" sub={state.season.title} backTo="/" />
      <div className="stack-20">
        <div className="card card--warm">
          <div className="row">
            <div className="item__ic" style={{ color: 'var(--warm)' }}><Icon name="cup" size={19} /></div>
            <div className="grow">
              <div className="t-xs dim-2">Копилка сезона</div>
              <div className="figure" style={{ fontSize: 24, marginTop: 2 }}>{money(seasonPot(state))}</div>
            </div>
          </div>
          <div className="t-xs dim-2" style={{ marginTop: 10, lineHeight: 1.5 }}>
            {money(state.season.clubPot)} — десятина клуба с продаж сезона, остальное — взносы команд. Всё уйдёт на призы и выпускной.
          </div>
        </div>

        {board.length === 0 ? (
          <Empty icon="cup" title="Рейтинг пуст" text="Команда попадает сюда, когда в ней хотя бы трое." />
        ) : (
          <div className="list">
            {board.map((row) => {
              const roster = teamRoster(state, row.team.id);
              const mine = myTeam?.id === row.team.id;
              const expanded = open === row.team.id;
              const top = row.place <= 3;
              return (
                <div key={row.team.id}>
                  <button className={`rank${row.debt > 0 ? ' rank--dim' : ''}`} onClick={() => setOpen(expanded ? null : row.team.id)}>
                    <span className="award" style={{ background: top ? `${row.award.tone}1f` : 'var(--surface-2)' }}>
                      <Icon name={row.award.icon} size={top ? 22 : 19} color={top ? row.award.tone : 'var(--ink-3)'} />
                      <span className="award__n">{row.place}</span>
                    </span>
                    <TeamAvatar team={row.team} size={38} />
                    <div className="grow">
                      <div className="row" style={{ gap: 6 }}>
                        <span className="t-md ell rank__t">{row.team.name}</span>
                        {mine && <Tag tone="accent">вы</Tag>}
                      </div>
                      <div className="row" style={{ gap: 8, marginTop: 5 }}>
                        <AvatarStack users={roster.map((r) => r.user)} max={3} size={20} />
                        {row.debt > 0 && <Tag tone="warm">нет взноса</Tag>}
                      </div>
                    </div>
                    <div className="item__meta">
                      <div className="figure rank__v" style={{ fontSize: 15 }}>{moneyShort(row.counted)}</div>
                      <span className="t-xs dim-2">{row.activity}% актив.</span>
                    </div>
                  </button>
                  {expanded && (
                    <div style={{ padding: '0 14px 14px 52px' }}>
                      <div className="t-xs dim" style={{ marginBottom: 8 }}>{row.team.goal || row.team.idea}</div>
                      <KV k="Выручка всего" v={money(row.total)} />
                      <KV k="Зачтено в рейтинг" v={money(row.counted)} tone="var(--accent)" />
                      <KV k="Копилка 10%" v={`${money(row.paid)} из ${money(row.required)}`} tone={row.debt ? 'var(--warm)' : undefined} />
                      <KV k="Активность" v={`${row.activity}%`} tone={row.activity >= 60 ? 'var(--accent)' : 'var(--warm)'} />
                      <KV k="В команде" v={`${roster.length} чел.`} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <Section title="Партнёры сезона">
          <div className="stack">
            {state.sponsors.map((s) => (
              <button key={s.id} className="sponsor tap" onClick={() => go(`/sponsor/${s.id}`)}>
                <SponsorArt tone={s.tone} height={84} />
                <span className="sponsor__logo" style={{ background: s.tone }}>{s.name[0]}</span>
                <div className="sponsor__body" style={{ paddingTop: 24 }}>
                  <div className="spread">
                    <div className="grow">
                      <div className="t-md">{s.name}</div>
                      <div className="t-xs dim-2" style={{ marginTop: 2 }}>{s.tag} · {s.short}</div>
                    </div>
                    <Icon name="right" size={16} className="chev" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Section>

        <Note icon="eye">Выручка без взноса в копилку не засчитывается: команда сама отмечает перевод и прикладывает подтверждение.</Note>
      </div>
    </div>
  );
}
