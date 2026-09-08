import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import Passport from '../components/Passport.jsx';
import Install from '../components/Install.jsx';
import { Avatar } from '../components/Art.jsx';
import { PosterThumb } from '../components/Poster.jsx';
import { Top, List, Item, Section, Sheet, Chip, Btn, Actions, Note } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';
import { REGIONS, REGION_KEYS } from '../data/regions.js';
import { DEGREES } from '../data/canon.js';
import { EVENT_KINDS, REQUESTS, COMMUNITIES } from '../data/life.js';
import { agendaFor, residentsIn, regionStats } from '../lib/select.js';
import { relDay, plural, nf } from '../lib/format.js';
import { byId } from '../data/people.js';

export default function Home() {
  const app = useApp();
  const { me, chain } = app;
  const [pick, setPick] = useState(false);

  const r = REGIONS[me.city];
  const stats = regionStats(me.city);
  const agenda = useMemo(() => agendaFor(me, me.city, 3), [me]);
  const around = useMemo(() => residentsIn(me.city).filter((x) => x.id !== me.id).slice(0, 10), [me]);
  const asks = useMemo(() => REQUESTS.filter((q) => q.region === me.city).slice(0, 2), [me.city]);
  const mine = COMMUNITIES.filter((c) => app.communities.includes(c.id));
  const deg = DEGREES.find((d) => d.n === me.degree) || DEGREES[0];

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

      <Passport me={me} chain={chain} />

      {/* регион задаёт всё остальное на экране */}
      <button className="card tap row" style={{ gap: 12 }} onClick={() => setPick(true)}>
        <div style={{ fontSize: 26, lineHeight: 1 }}>{r.flag}</div>
        <div className="grow">
          <div className="t-md">{r.name}</div>
          <div className="t-xs dim" style={{ marginTop: 2 }}>
            {nf(stats.residents)} резидентов · {nf(stats.companies)} компаний · {stats.communities} сообществ
          </div>
        </div>
        <span className="t-xs gold" style={{ fontWeight: 700 }}>сменить</span>
      </button>

      <Actions
        items={[
          { icon: 'compass', title: 'Куда лечу', onClick: () => go('/map') },
          { icon: 'message', title: 'Запросить', onClick: () => go('/requests') },
          { icon: 'users', title: 'Кто рядом', onClick: () => go(`/people?region=${me.city}`) },
          { icon: 'calendar', title: 'Афиша', onClick: () => go('/events') },
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

      <Section title={`Рядом · ${r.flag} ${r.name}`} more="Все" onMore={() => go(`/people?region=${me.city}`)}>
        {around.length ? (
          <div className="scroller">
            {around.map((p) => (
              <button key={p.id} className="center" style={{ width: 66 }} onClick={() => go(`/p/${p.id}`)}>
                <Avatar person={p} size={52} dot={p.online} style={{ margin: '0 auto' }} />
                <div className="t-xs" style={{ marginTop: 7, fontWeight: 600 }}>{p.name.split(' ')[0]}</div>
              </button>
            ))}
          </div>
        ) : (
          <Note icon="globe">В этом регионе пока никого из своих. Посмотрите карту — сообщество рядом.</Note>
        )}
      </Section>

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
                sub={`${relDay(t.inDays)} · ${t.days} ${plural(t.days, 'день', 'дня', 'дней')}`}
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
    </div>
  );
}
