import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { teamOf, teamRoster, teamStats, isPro, MIN_TEAM, MAX_TEAM } from '../lib/logic.js';
import { moneyShort, people } from '../lib/format.js';
import { AvatarStack, Btn, Card, Empty, Input, Area, Sheet } from '../components/UI.jsx';
import { IcSpark, IcNext, IcTrophy } from '../components/Icons.jsx';
import TeamPage from './TeamPage.jsx';

/* Вкладка «Команда»: своя команда или подбор новой. */

export default function Team({ navigate, now }) {
  const { state, me } = useStore();
  const team = teamOf(state, me.id);

  if (!isPro(me)) {
    return (
      <div className="screen">
        <Header />
        <Empty
          title="Команды доступны в PRO"
          text="В пакете CLUB открыты расписание, база знаний и люди. Команда, рейтинг и мастермайнды — в PRO."
          action={<Btn kind="primary" onClick={() => navigate('/profile')}>Посмотреть пакеты</Btn>}
        />
      </div>
    );
  }

  if (team) return <TeamPage id={team.id} navigate={navigate} now={now} embedded />;

  return <FindTeam />;
}

function Header() {
  return (
    <div className="topbar">
      <div className="logo">
        <div className="mark"><IcSpark size={16} className="t-lime" /></div>
        <h1>Команда</h1>
      </div>
    </div>
  );
}

function FindTeam() {
  const { state, me, dispatch } = useStore();
  const [create, setCreate] = useState(false);
  const open = state.teams.filter((t) => t.isOpen);
  const myRequests = state.requests.filter((r) => r.userId === me.id);

  return (
    <div className="screen">
      <Header />

      <Card kind="accent">
        <div className="t-title">Соберите команду сезона</div>
        <div className="t-sub" style={{ marginTop: 3 }}>
          От {MIN_TEAM} до {MAX_TEAM} человек, одна идея на всех и общая выручка в рейтинге. Меньше трёх — команда не
          считается собранной и в рейтинг не попадает.
        </div>
        <Btn kind="primary" wide small style={{ marginTop: 12 }} onClick={() => setCreate(true)}>
          Создать команду
        </Btn>
      </Card>

      {myRequests.length > 0 && (
        <>
          <div className="section"><h2>Мои заявки</h2></div>
          <Card>
            {myRequests.map((r) => {
              const team = state.teams.find((t) => t.id === r.teamId);
              return (
                <div key={r.id} className="lead" style={{ gridTemplateColumns: '1fr auto' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{team?.name}</div>
                    <div className="t-dim">
                      {r.status === 'pending' ? 'Ждём ответа капитана' : r.status === 'accepted' ? 'Принята' : 'Отклонена'}
                    </div>
                  </div>
                  <span className={`chip ${r.status === 'accepted' ? 'on' : r.status === 'declined' ? 'red' : 'warn'}`}>
                    {r.status === 'pending' ? 'в ожидании' : r.status === 'accepted' ? 'вы в команде' : 'отказ'}
                  </span>
                </div>
              );
            })}
          </Card>
        </>
      )}

      <div className="section"><h2>Открытые команды</h2></div>
      {open.length === 0 && <Empty title="Открытых команд нет" text="Создайте свою — заявки придут сами." />}
      <div className="stack">
        {open.map((team) => {
          const roster = teamRoster(state, team.id);
          const stats = teamStats(state, team.id);
          const applied = myRequests.some((r) => r.teamId === team.id && r.status === 'pending');
          const full = roster.length >= MAX_TEAM;
          return (
            <Card key={team.id}>
              <div className="split">
                <div style={{ minWidth: 0 }}>
                  <div className="t-title ellipsis">{team.name}</div>
                  <div className="t-sub">{team.idea}</div>
                </div>
                <IcNext />
              </div>
              <div className="row" style={{ marginTop: 12 }}>
                <AvatarStack users={roster.map((r) => r.user)} max={5} size={28} />
                <div className="t-dim">
                  {people(roster.length)} · ищут ещё {Math.max(0, team.wanted - roster.length)}
                </div>
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                <IcTrophy size={15} className="t-lime" />
                <div className="t-dim">выручка сезона {moneyShort(stats.total)}</div>
              </div>
              <Btn
                kind={applied ? 'soft' : 'primary'}
                wide
                small
                style={{ marginTop: 12 }}
                disabled={applied || full}
                onClick={() => dispatch({ type: 'teamApply', teamId: team.id })}
              >
                {applied ? 'Заявка отправлена' : full ? 'Команда набрана' : 'Подать заявку'}
              </Btn>
            </Card>
          );
        })}
      </div>

      <div className="t-dim center" style={{ marginTop: 18 }}>
        Набор идёт в первый месяц сезона. Дальше состав меняет капитан.
      </div>

      {create && <CreateSheet onClose={() => setCreate(false)} />}
    </div>
  );
}

function CreateSheet({ onClose }) {
  const { dispatch } = useStore();
  const [name, setName] = useState('');
  const [idea, setIdea] = useState('');
  const [wanted, setWanted] = useState(5);

  return (
    <Sheet title="Создать команду" sub="Вы станете капитаном" onClose={onClose}>
      <div className="stack">
        <Input label="Название" placeholder="Например, «Пульс»" value={name} onChange={(e) => setName(e.target.value)} />
        <Area label="Идея в одну строку" placeholder="Что делаете и для кого" value={idea} onChange={(e) => setIdea(e.target.value)} />
        <Input
          label="Сколько человек ищем"
          type="number"
          min={MIN_TEAM}
          max={MAX_TEAM}
          value={wanted}
          onChange={(e) => setWanted(Number(e.target.value))}
          hint={`Размер команды: от ${MIN_TEAM} до ${MAX_TEAM} человек`}
        />
        <Btn
          kind="primary"
          wide
          disabled={name.trim().length < 2 || idea.trim().length < 5}
          onClick={() => {
            dispatch({ type: 'teamCreate', name, idea, wanted });
            onClose();
          }}
        >
          Создать
        </Btn>
      </div>
    </Sheet>
  );
}
