import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { TopBar, List, Item, Btn, Section, Bar, Empty, Note } from '../components/UI.jsx';
import Poster from '../components/Poster.jsx';
import { Avatar, QR } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';
import { eventById, EVENT_KINDS, AWARDS, FLAGSHIPS } from '../data/life.js';
import { REGIONS } from '../data/regions.js';
import { byId } from '../data/people.js';
import { eventDate, visibleOnly } from '../lib/select.js';
import { dateLong, weekday, relDay, usdExact, plural } from '../lib/format.js';

export default function Event({ id }) {
  const app = useApp();
  const e = eventById(id);
  if (!e) return <Empty title="Событие не найдено" />;

  const k = EVENT_KINDS[e.kind];
  const r = REGIONS[e.region];
  const host = byId(e.host);
  const d = eventDate(e);
  const going = app.going.includes(e.id);
  const past = e.inDays < 0;
  const shown = visibleOnly(app.me, e.going);
  const count = e.going.length + (going ? 1 : 0);
  const big = FLAGSHIPS.includes(e.kind);

  return (
    <>
      <TopBar title={e.title} sub={k.name} backTo="/events" />
      <div className="screen stack-20">
        <Poster event={e} height={186} radius={18}>
          <div className="scene__over">
            <div className="h2" style={{ color: '#fff' }}>{e.title}</div>
          </div>
        </Poster>

        <List>
          <Item
            icon="calendar"
            title={`${dateLong(d)}, ${weekday(d)} · ${e.time}`}
            sub={`${relDay(e.inDays)}${e.days ? ` · ${e.days} ${plural(e.days, 'день', 'дня', 'дней')}` : e.mins ? ` · ${e.mins} мин` : ''}${r ? ` · ${r.tz}` : ''}`}
            chev={false}
          />
          {e.online ? (
            <Item icon="video" title="Онлайн-эфир" sub="Ссылка придёт в личные сообщения за час до начала" chev={false} />
          ) : (
            <Item icon="pin" title={r?.name} sub={`${r?.flag} ${r?.country} · точный адрес после записи`} onClick={() => go(`/region/${e.region}`)} />
          )}
          {host && <Item lead={<Avatar person={host} size={40} dot={host.online} />} title={host.name} sub={`Ведёт · ${host.company}`} onClick={() => go(`/p/${host.id}`)} />}
        </List>

        <p className="lead">{e.about}</p>

        {e.program && (
          <Section title="Программа">
            <List>
              {e.program.map((t, i) => (
                <Item
                  key={i}
                  lead={<div className="item__ic display" style={{ fontSize: 18 }}>{i + 1}</div>}
                  title={<span style={{ whiteSpace: 'normal', fontWeight: 500, fontSize: 14, lineHeight: 1.45 }}>{t}</span>}
                  chev={false}
                />
              ))}
            </List>
          </Section>
        )}

        {e.kind === 'world' && (
          <Section title="Девять номинаций">
            <List>
              {AWARDS.map((a) => <Item key={a.id} icon="award" title={a.name} sub={a.about} subWrap chev={false} />)}
            </List>
          </Section>
        )}

        <Section title={`Участники · ${count} из ${e.capacity}`}>
          <div className="card">
            <Bar value={count / e.capacity} />
            <div className="scroller" style={{ marginTop: 14, marginBottom: -2 }}>
              {shown.map((p) => (
                <button key={p.id} className="center" style={{ width: 60 }} onClick={() => go(`/p/${p.id}`)}>
                  <Avatar person={p} size={40} dot={p.online} style={{ margin: '0 auto' }} />
                  <div className="t-xs dim-2" style={{ marginTop: 5 }}>{p.name.split(' ')[0]}</div>
                </button>
              ))}
            </div>
          </div>
        </Section>

        {going && !past && !e.online && (
          <div className="card card--gold row" style={{ gap: 14 }}>
            <div style={{ background: '#fff', borderRadius: 9, padding: 4, lineHeight: 0, flex: 'none' }}>
              <QR value={`ticket:${e.id}:${app.me.number}`} size={76} />
            </div>
            <div>
              <div className="t-md">Вход по коду</div>
              <div className="t-xs dim" style={{ marginTop: 4, lineHeight: 1.45 }}>Покажите на входе. Отметка попадёт в вашу репутацию.</div>
            </div>
          </div>
        )}

        {going && !past && e.online && <Note icon="video" tone="var(--blue)">Вы записаны. Ссылка на эфир придёт в личные сообщения за час до начала.</Note>}

        {!past && (
          <div style={{ position: 'sticky', bottom: 'calc(var(--tab-h) + 12px)' }}>
            <Btn variant={going ? 'ghost' : 'gold'} wide icon={going ? 'check' : undefined} onClick={() => app.toggleGoing(e.id, e.title)}>
              {going ? 'Вы идёте · отменить' : e.price ? `Записаться · ${usdExact(e.price)}` : 'Записаться'}
            </Btn>
          </div>
        )}
      </div>
    </>
  );
}
