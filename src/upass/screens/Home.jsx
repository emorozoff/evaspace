import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import Passport from '../components/Passport.jsx';
import Pulse from '../components/Pulse.jsx';
import Install from '../components/Install.jsx';
import { Avatar } from '../components/Art.jsx';
import { PosterThumb } from '../components/Poster.jsx';
import { Top, List, Item, Section, Sheet, Chip, Btn, Actions, Note } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';
import { REGIONS, REGION_KEYS } from '../data/regions.js';
import { EVENT_KINDS, COMMUNITIES, DMS } from '../data/life.js';
import { peopleInCircle } from '../data/circles.js';
import { agendaFor, requestsIn } from '../lib/select.js';
import { relDay, plural, nf } from '../lib/format.js';
import { byId } from '../data/people.js';

export default function Home() {
  const app = useApp();
  const { me, chain } = app;
  const [pick, setPick] = useState(false);
  const [clocks, setClocks] = useState(false);

  const r = REGIONS[me.city];
  const agenda = useMemo(() => agendaFor(me, me.city, 3), [me]);
  const asks = useMemo(() => requestsIn(me.city).slice(0, 2), [me.city]);
  const mine = COMMUNITIES.filter((c) => app.communities.includes(c.id));
  const inner = useMemo(
    () => peopleInCircle('inner', app.circles).map(byId).filter(Boolean),
    [app.circles]
  );
  const unread = DMS.filter((d) => d.unread && !app.seen['dm-' + d.with]).length;

  return (
    <div className="screen stack-20 rise-in">
      <Top
        title="Паспорт"
        right={
          <button className="iconbtn" onClick={() => go('/profile')} aria-label="Профиль">
            <Icon name="settings" size={18} />
          </button>
        }
      />

      <Passport me={me} chain={chain} trips={app.trips} />

      <Pulse
        app={app}
        onSettings={() => setClocks(true)}
        onOpen={(id) => {
          if (id === 'region') setPick(true);
          else if (id === 'clock') setClocks(true);
          else if (id === 'trip') go('/map');
          else go(`/people?region=${me.city}`);
        }}
      />

      <Actions
        items={[
          { icon: 'send', title: 'Мессенджер', badge: unread, onClick: () => go('/chats') },
          { icon: 'compass', title: 'Карта', onClick: () => go('/map') },
          { icon: 'message', title: 'Запросы', onClick: () => go('/requests') },
          { icon: 'calendar', title: 'Афиша', onClick: () => go('/events') },
        ]}
      />

      <Install compact />

      {inner.length > 0 && (
        <Section title="Ближний круг" more="Все чаты" onMore={() => go('/chats')}>
          <div className="scroller">
            {inner.map((p) => (
              <button key={p.id} className="center" style={{ width: 66 }} onClick={() => go(`/dm/${p.id}`)}>
                <Avatar person={p} size={52} dot={p.online} style={{ margin: '0 auto' }} />
                <div className="t-xs" style={{ marginTop: 7, fontWeight: 600 }}>{p.name.split(' ')[0]}</div>
              </button>
            ))}
            <button className="center" style={{ width: 66 }} onClick={() => go('/people')}>
              <span className="circle-add"><Icon name="plus" size={20} /></span>
              <div className="t-xs dim-2" style={{ marginTop: 7, fontWeight: 600 }}>Добавить</div>
            </button>
          </div>
        </Section>
      )}

      {agenda.length > 0 && (
        <Section title={`Ближайшее · ${r.name}`} more="Афиша" onMore={() => go('/events')}>
          <List>
            {agenda.map((e) => (
              <Item
                key={e.id}
                lead={<PosterThumb event={e} size={44} />}
                title={e.title}
                sub={`${relDay(e.inDays)}, ${e.time} · ${e.online ? 'эфир' : REGIONS[e.region]?.name || 'сообщество'}`}
                meta={<span className="tag" style={{ background: `${EVENT_KINDS[e.kind].tone}22`, color: EVENT_KINDS[e.kind].tone }}>{EVENT_KINDS[e.kind].name}</span>}
                onClick={() => go(`/event/${e.id}`)}
              />
            ))}
          </List>
        </Section>
      )}

      {asks.length > 0 && (
        <Section title="Запросы рядом" more="Все" onMore={() => go('/requests')}>
          <List>
            {asks.map((q) => {
              const p = byId(q.who);
              return (
                <Item
                  key={q.id}
                  lead={<Avatar person={p} size={42} dot={p?.online} />}
                  title={p?.name}
                  sub={q.text}
                  subWrap
                  onClick={() => go(`/request/${q.id}`)}
                />
              );
            })}
          </List>
        </Section>
      )}

      {mine.length > 0 && (
        <Section title="Мои сообщества" more="Все" onMore={() => go('/communities')}>
          <List>
            {mine.slice(0, 3).map((c) => (
              <Item
                key={c.id}
                lead={<div className="item__ic" style={{ background: `${c.tone}22`, color: c.tone, borderRadius: 14 }}><Icon name={c.icon} size={19} /></div>}
                title={c.name}
                sub={`${nf(c.members)} ${plural(c.members, 'участник', 'участника', 'участников')}`}
                onClick={() => go(`/chat/${c.id}`)}
              />
            ))}
          </List>
        </Section>
      )}

      {app.trips.length > 0 && (
        <Section title="Мои поездки">
          <List>
            {app.trips.map((t) => (
              <Item
                key={t.id}
                icon="plane"
                title={REGIONS[t.region]?.name}
                sub={`${t.when || relDay(t.inDays)} · ${t.days} ${plural(t.days, 'день', 'дня', 'дней')}`}
                meta={<button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => app.cancelTrip(t.id)}><Icon name="x" size={13} /></button>}
                chev={false}
              />
            ))}
          </List>
        </Section>
      )}

      <Sheet open={pick} onClose={() => setPick(false)} title="Где вы сейчас" sub="Регион определяет сообщества, афишу и запросы">
        <div className="wrap">
          {REGION_KEYS.map((key) => (
            <Chip key={key} on={me.city === key} onClick={() => { app.setRegion(key); setPick(false); }}>
              {REGIONS[key].flag} {REGIONS[key].name}
            </Chip>
          ))}
        </div>
        <Btn variant="quiet" wide style={{ marginTop: 16 }} onClick={() => { setPick(false); go('/map'); }}>Открыть карту</Btn>
      </Sheet>

      <Sheet open={clocks} onClose={() => setClocks(false)} title="Часы на главной" sub="До трёх регионов — время идёт само">
        <ClockPicker app={app} />
      </Sheet>
    </div>
  );
}

function ClockPicker({ app }) {
  const on = app.clocks || [];
  const toggle = (k) =>
    app.setClocks(on.includes(k) ? on.filter((x) => x !== k) : on.length < 3 ? [...on, k] : [...on.slice(1), k]);
  return (
    <div className="stack">
      <div className="wrap">
        {REGION_KEYS.map((k) => (
          <Chip key={k} on={on.includes(k)} onClick={() => toggle(k)}>
            {REGIONS[k].flag} {REGIONS[k].name}
          </Chip>
        ))}
      </div>
      <Note icon="clock">Выбрано {on.length} из трёх. Четвёртый регион вытеснит самый старый.</Note>
    </div>
  );
}
