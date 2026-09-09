import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import Passport from '../components/Passport.jsx';
import Pulse from '../components/Pulse.jsx';
import Install from '../components/Install.jsx';
import { Avatar } from '../components/Art.jsx';
import { PosterThumb } from '../components/Poster.jsx';
import { SceneThumb } from '../components/Scene.jsx';
import { Top, List, Item, Section, Sheet, Btn, Actions, Note } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';
import { REGIONS } from '../data/regions.js';
import { EVENT_KINDS, COMMUNITIES, DMS } from '../data/life.js';
import { CIRCLES, peopleInCircle, circleOf } from '../data/circles.js';
import { agendaFor, requestsIn } from '../lib/select.js';
import { bestMatches, matchPct } from '../lib/match.js';
import { relDay, plural, nf, stayLabel } from '../lib/format.js';
import { byId, RESIDENTS } from '../data/people.js';

export default function Home() {
  const app = useApp();
  const { me, chain } = app;
  const [add, setAdd] = useState(false);

  const r = REGIONS[me.city];
  const agenda = useMemo(() => agendaFor(me, me.city, 3), [me]);
  const asks = useMemo(() => requestsIn(me.city).slice(0, 2), [me.city]);
  const mine = COMMUNITIES.filter((c) => app.communities.includes(c.id));
  const unread = DMS.filter((d) => d.unread && !app.seen['dm-' + d.with]).length;

  /* Ближний круг сортируется по тому, с кем переписка живее. */
  const talk = useMemo(() => {
    const n = {};
    for (const d of DMS) n[d.with] = d.thread.length + (d.unread || 0) * 3;
    for (const [id, msgs] of Object.entries(app.dms)) n[id] = (n[id] || 0) + msgs.length * 2;
    return n;
  }, [app.dms]);

  const inner = useMemo(
    () =>
      peopleInCircle('inner', app.circles)
        .map(byId)
        .filter(Boolean)
        .sort((a, b) => (talk[b.id] || 0) - (talk[a.id] || 0)),
    [app.circles, talk]
  );

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

      <Section title="Ближний круг" more="Все чаты" onMore={() => go('/chats')}>
        <div className="scroller">
          {inner.map((p) => (
            <button key={p.id} className="center" style={{ width: 66 }} onClick={() => go(`/dm/${p.id}`)}>
              <Avatar person={p} size={52} dot={p.online} style={{ margin: '0 auto' }} />
              <div className="t-xs" style={{ marginTop: 7, fontWeight: 600 }}>{p.name.split(' ')[0]}</div>
            </button>
          ))}
          <button className="center" style={{ width: 66 }} onClick={() => setAdd(true)}>
            <span className="circle-add"><Icon name="plus" size={20} /></span>
            <div className="t-xs dim-2" style={{ marginTop: 7, fontWeight: 600 }}>Добавить</div>
          </button>
        </div>
      </Section>

      <Pulse app={app} />

      <Actions
        items={[
          { icon: 'send', title: 'Мессенджер', badge: unread, onClick: () => go('/chats') },
          { icon: 'compass', title: 'Карта', onClick: () => go('/map') },
          { icon: 'message', title: 'Запросы', onClick: () => go('/requests') },
          { icon: 'plane', title: 'Поездки', badge: app.trips.length, onClick: () => go('/trips') },
        ]}
      />

      <Install compact />

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

      <Section title="Мои поездки" more={app.trips.length ? 'Все' : undefined} onMore={() => go('/trips')}>
        <List>
          {[...app.trips].sort((a, b) => a.inDays - b.inDays).slice(0, 3).map((t) => (
            <Item
              key={t.id}
              lead={<SceneThumb city={t.region} size={44} />}
              title={`${REGIONS[t.region]?.flag} ${REGIONS[t.region]?.name}`}
              sub={`${t.when || relDay(t.inDays)} · ${stayLabel(t.days)}`}
              onClick={() => go('/trips')}
            />
          ))}
          <Item
            icon="plus"
            title="Добавить поездку"
            sub={app.trips.length ? 'Регион, месяц и срок' : 'Сообщество в регионе увидит вас и позовёт на встречи'}
            tone="var(--gold)"
            onClick={() => go('/trips?new=1')}
          />
        </List>
      </Section>

      <Sheet open={add} onClose={() => setAdd(false)} title="Кого добавить" sub="Нажатие сразу переносит в ближний круг">
        <AddCircle app={app} />
      </Sheet>
    </div>
  );
}

/* Быстрое добавление: один тап — человек в круге, шторка не закрывается. */
function AddCircle({ app }) {
  const { me } = app;
  const suggest = useMemo(() => {
    const known = new Set(DMS.map((d) => d.with));
    const ranked = bestMatches(me, RESIDENTS, 40);
    return ranked.sort((a, b) => (known.has(b.p.id) ? 1 : 0) - (known.has(a.p.id) ? 1 : 0)).slice(0, 14);
  }, [me]);

  return (
    <div className="stack">
      <List>
        {suggest.map(({ p, pct }) => {
          const on = circleOf(p.id, app.circles) === 'inner';
          return (
            <Item
              key={p.id}
              lead={<Avatar person={p} size={44} dot={p.online} />}
              title={p.name}
              sub={`${REGIONS[p.city].flag} ${REGIONS[p.city].name} · ${p.company}`}
              meta={
                <span className={`tag${on ? ' tag--cyan' : pct >= 75 ? ' tag--gold' : ''}`}>
                  {on ? 'в круге' : `${pct}%`}
                </span>
              }
              chev={false}
              onClick={() => app.setCircle(p.id, on ? 'none' : 'inner')}
            />
          );
        })}
      </List>
      <Note icon="users">Круг можно поменять в профиле резидента или в шапке переписки: ближний, друзья, бизнес.</Note>
    </div>
  );
}
