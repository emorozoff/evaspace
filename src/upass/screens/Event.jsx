import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { TopBar, List, Item, Btn, Section, Bar, Empty, Note } from '../components/UI.jsx';
import Scene from '../components/Scene.jsx';
import { Avatar, QR } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';
import { eventById, EVENT_KINDS, AWARDS } from '../data/life.js';
import { locById, CITIES } from '../data/places.js';
import { byId } from '../data/people.js';
import { eventDate, visibleOnly } from '../lib/select.js';
import { dateLong, weekday, relDay, usdExact, plural } from '../lib/format.js';

export default function Event({ id }) {
  const app = useApp();
  const e = eventById(id);
  if (!e) return <Empty title="Событие не найдено" />;

  const k = EVENT_KINDS[e.kind];
  const loc = locById(e.loc);
  const city = CITIES[loc.city];
  const host = byId(e.host);
  const d = eventDate(e);
  const going = app.going.includes(e.id);
  const past = e.inDays < 0;
  const shown = visibleOnly(app.me, e.going);
  const count = e.going.length + (going ? 1 : 0);

  return (
    <>
      <TopBar title={e.title} sub={k.name} backTo="/events" />
      <div className="screen stack-20">
        <Scene city={loc.city} height={180} label>
          <div className="scene__over">
            <div className="row" style={{ gap: 6, marginBottom: 6 }}>
              <span className="tag" style={{ background: `${k.tone}2a`, color: k.tone }}>{k.name}</span>
              {e.minTier > 1 && <span className="tag tag--gold">уровень {e.minTier}+</span>}
            </div>
            <div className="h2" style={{ color: '#fff' }}>{e.title}</div>
          </div>
        </Scene>

        <List>
          <Item icon="calendar" title={`${dateLong(d)}, ${weekday(d)} · ${e.time}`} sub={`${relDay(e.inDays)} · ${city.tz}`} chev={false} />
          <Item icon="pin" title={loc.name} sub={`${city.flag} ${city.name} · ${loc.address}`} onClick={() => go(`/loc/${loc.id}`)} />
          {host && <Item lead={<Avatar person={host} size={40} dot={host.online} />} title={host.name} sub={`Ведёт · ${host.company}`} onClick={() => go(`/p/${host.id}`)} />}
        </List>

        <p className="lead">{e.about}</p>

        {e.kind === 'summit' && <Program e={e} />}

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

        {going && !past && (
          <div className="card card--gold row" style={{ gap: 14 }}>
            <div style={{ background: '#fff', borderRadius: 9, padding: 4, lineHeight: 0, flex: 'none' }}>
              <QR value={`ticket:${e.id}:${app.me.number}`} size={76} />
            </div>
            <div>
              <div className="t-md">Билет резидента</div>
              <div className="t-xs dim" style={{ marginTop: 4, lineHeight: 1.45 }}>Покажите код на входе. Отметка попадёт в цепочку репутации.</div>
            </div>
          </div>
        )}

        {!past && (
          <div style={{ position: 'sticky', bottom: 'calc(var(--tab-h) + 12px)' }}>
            <Btn variant={going ? 'ghost' : 'gold'} wide icon={going ? 'check' : undefined} onClick={() => app.toggleGoing(e.id, e.title)}>
              {going ? 'Вы идёте · отменить' : e.price ? `Купить билет · ${usdExact(e.price)}` : 'Записаться'}
            </Btn>
          </div>
        )}
      </div>
    </>
  );
}

function Program({ e }) {
  const ny = e.title.toLowerCase().includes('новогодняя');
  const days = ny
    ? ['Съезд, открытие, общий ужин', 'Итоги года по направлениям, отчёт по активам', 'Секции кругов: капитал, ИИ, недвижимость, тело', 'Свободный день: спорт, вода, семьи', 'Голосования и решения на год', 'Церемония года: девять номинаций и посвящение в степени', 'Общий стол и проводы']
    : ['Открытие, отчёт по активам, новые резиденты', 'Шесть секций, питчи, спорт с утра', 'Голосования, решения о покупках, общий ужин'];
  return (
    <Section title="Программа">
      <List>
        {days.map((t, i) => <Item key={i} lead={<div className="item__ic" style={{ fontFamily: 'var(--display)', fontSize: 18 }}>{i + 1}</div>} title={<span style={{ whiteSpace: 'normal', fontWeight: 500, fontSize: 14 }}>{t}</span>} chev={false} />)}
      </List>
      {ny && (
        <List>
          {AWARDS.map((a) => <Item key={a.id} icon="star" title={a.name} sub={a.about} subWrap chev={false} />)}
        </List>
      )}
    </Section>
  );
}
