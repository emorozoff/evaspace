import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import Scene from '../components/Scene.jsx';
import { Avatar } from '../components/Art.jsx';
import { PosterThumb } from '../components/Poster.jsx';
import { TopBar, List, Item, Section, Btn, KV, Chip, Seg, Note, Empty, Sheet } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';
import { REGIONS, TIERS_REGION } from '../data/regions.js';
import { EVENT_KINDS, SERVICE_CATS } from '../data/life.js';
import { byId } from '../data/people.js';
import { agendaFor, communitiesIn, residentsIn, requestsIn, servicesIn } from '../lib/select.js';
import { flight, monthly, hoursText } from '../lib/travel.js';
import { usdExact, nf, plural, relDay } from '../lib/format.js';

export default function Region({ id }) {
  const app = useApp();
  const { me } = app;
  const r = REGIONS[id];
  const [style, setStyle] = useState('lean');
  const [trip, setTrip] = useState(false);
  const [tripIn, setTripIn] = useState(7);
  const [tripDays, setTripDays] = useState(14);

  if (!r) return <Empty title="Регион не найден" />;

  const here = me.city === id;
  const f = here ? null : flight(me.city, id);
  const m = monthly(id, style);
  const events = useMemo(() => agendaFor(me, id, 5), [me, id]);
  const communities = communitiesIn(id);
  const people = residentsIn(id);
  const asks = requestsIn(id).slice(0, 2);
  const services = servicesIn(id).slice(0, 4);

  return (
    <>
      <TopBar title={r.name} sub={`${r.flag} ${r.country}`} backTo="/map" />
      <div className="screen stack-20">
        <Scene city={id} height={186} label>
          <div className="scene__over">
            <span className="tag" style={{ background: `${TIERS_REGION[r.tier].tone}2a`, color: TIERS_REGION[r.tier].tone }}>
              {TIERS_REGION[r.tier].name}
            </span>
            <div className="h2" style={{ color: '#fff', marginTop: 6 }}>{r.name}</div>
          </div>
        </Scene>

        <p className="lead">{r.about}</p>

        <div className="stats">
          <div className="stat"><div className="stat__v">{nf(r.residents)}</div><div className="stat__l">Резидентов</div></div>
          <div className="stat"><div className="stat__v">{nf(r.companies)}</div><div className="stat__l">Компаний</div></div>
          <div className="stat"><div className="stat__v">{r.communities}</div><div className="stat__l">Сообществ</div></div>
        </div>

        {here ? (
          <Note icon="pin" tone="var(--cyan)">Вы сейчас здесь. Афиша, сообщества и запросы на главной уже из этого региона.</Note>
        ) : (
          <div className="row" style={{ gap: 10 }}>
            <Btn variant="gold" wide icon="plane" onClick={() => setTrip(true)}>Объявить поездку</Btn>
            <Btn variant="ghost" onClick={() => app.setRegion(id)}>Я здесь</Btn>
          </div>
        )}

        {f && (
          <Section title="Перелёт">
            <div className="card" style={{ paddingTop: 2, paddingBottom: 2 }}>
              <KV k="Расстояние" v={`${nf(f.km)} км`} />
              <KV k="В пути" v={`${hoursText(f.hours)}${f.direct ? ', прямой' : ', с пересадкой'}`} />
              <KV k="Билет" v={`от ${usdExact(f.from)}`} tone="var(--gold)" />
              <KV k="Обычная цена" v={usdExact(f.avg)} />
            </div>
          </Section>
        )}

        <Section title="Сколько стоит месяц">
          <Seg value={style} onChange={setStyle} options={[{ value: 'lean', label: 'Экономно' }, { value: 'comfort', label: 'Комфортно' }]} />
          <div className="card" style={{ paddingTop: 2, paddingBottom: 2 }}>
            <KV k="Апартаменты, месяц" v={`от ${usdExact(r.rent.apt[0])} · обычно ${usdExact(r.rent.apt[1])}`} />
            <KV k="Вилла, месяц" v={`от ${usdExact(r.rent.villa[0])} · обычно ${usdExact(r.rent.villa[1])}`} />
            <KV k="Отель, ночь" v={`от ${usdExact(r.rent.hotel[0])} · обычно ${usdExact(r.rent.hotel[1])}`} />
            <KV k="Еда, транспорт, связь" v={usdExact(m.living)} />
            <KV k="Комфортный минимум" v={`${usdExact(m.total)} в месяц`} tone="var(--gold)" />
          </div>
          <Note icon="eye">{r.visa}. Лучшее время — {r.best.toLowerCase()}. Интернет около {r.internet} Мбит/с.</Note>
        </Section>

        {events.length > 0 && (
          <Section title="Афиша региона" more="Вся" onMore={() => go('/events')}>
            <List>
              {events.map((e) => (
                <Item
                  key={e.id}
                  lead={<PosterThumb event={e} size={44} />}
                  title={e.title}
                  sub={`${relDay(e.inDays)}, ${e.time}${e.online ? ' · эфир' : ''}`}
                  meta={<span className="tag" style={{ background: `${EVENT_KINDS[e.kind].tone}22`, color: EVENT_KINDS[e.kind].tone }}>{EVENT_KINDS[e.kind].name}</span>}
                  onClick={() => go(`/event/${e.id}`)}
                />
              ))}
            </List>
          </Section>
        )}

        {communities.length > 0 && (
          <Section title="Сообщества региона" more="Все" onMore={() => go('/communities')}>
            <List>
              {communities.map((c) => (
                <Item
                  key={c.id}
                  lead={<div className="item__ic" style={{ background: `${c.tone}22`, color: c.tone, borderRadius: 14 }}><Icon name={c.icon} size={19} /></div>}
                  title={c.name}
                  sub={`${nf(c.members)} ${plural(c.members, 'участник', 'участника', 'участников')} · куратор ${byId(c.curator)?.name.split(' ')[0]}`}
                  onClick={() => go(`/chat/${c.id}`)}
                />
              ))}
            </List>
          </Section>
        )}

        {people.length > 0 && (
          <Section title="Резиденты" more={`Все · ${r.residents}`} onMore={() => go(`/people?region=${id}`)}>
            <div className="scroller">
              {people.map((p) => (
                <button key={p.id} className="center" style={{ width: 66 }} onClick={() => go(`/p/${p.id}`)}>
                  <Avatar person={p} size={52} dot={p.online} style={{ margin: '0 auto' }} />
                  <div className="t-xs" style={{ marginTop: 7, fontWeight: 600 }}>{p.name.split(' ')[0]}</div>
                </button>
              ))}
            </div>
          </Section>
        )}

        {asks.length > 0 && (
          <Section title="Запросы из региона" more="Все" onMore={() => go('/requests')}>
            <List>
              {asks.map((q) => {
                const p = byId(q.who);
                return <Item key={q.id} lead={<Avatar person={p} size={42} />} title={p?.name} sub={q.text} subWrap onClick={() => go(`/request/${q.id}`)} />;
              })}
            </List>
          </Section>
        )}

        {services.length > 0 && (
          <Section title="Помощь с переездом" more="Все услуги" onMore={() => go('/market')}>
            <List>
              {services.map((s) => (
                <Item
                  key={s.id}
                  icon={SERVICE_CATS.find((c) => c.id === s.cat)?.icon || 'gift'}
                  title={s.title}
                  sub={`${byId(s.owner)?.company} · ${s.days} ${plural(s.days, 'день', 'дня', 'дней')}`}
                  meta={<span className="gold" style={{ fontSize: 13, fontWeight: 700 }}>{s.price ? usdExact(s.price) : 'по запросу'}</span>}
                  chev={false}
                  onClick={() => go(`/service/${s.id}`)}
                />
              ))}
            </List>
          </Section>
        )}
      </div>

      <Sheet open={trip} onClose={() => setTrip(false)} title="Объявить поездку" sub={`${r.flag} ${r.name}`}>
        <div className="stack">
          <div>
            <div className="label">Когда</div>
            <div className="wrap">{[1, 3, 7, 14, 30].map((d) => <Chip key={d} on={tripIn === d} onClick={() => setTripIn(d)}>{relDay(d)}</Chip>)}</div>
          </div>
          <div>
            <div className="label">Насколько</div>
            <div className="wrap">{[3, 7, 14, 30, 90].map((d) => <Chip key={d} on={tripDays === d} onClick={() => setTripDays(d)}>{d} {plural(d, 'день', 'дня', 'дней')}</Chip>)}</div>
          </div>
          {f && (
            <div className="card" style={{ paddingTop: 2, paddingBottom: 2 }}>
              <KV k="Билеты туда-обратно" v={`от ${usdExact(f.from * 2)}`} />
              <KV k="Жизнь на срок" v={usdExact(Math.round((m.total / 30) * tripDays))} />
              <KV k="Всего примерно" v={usdExact(f.from * 2 + Math.round((m.total / 30) * tripDays))} tone="var(--gold)" />
            </div>
          )}
          <Note icon="users">Видны только регион и даты. Резиденты на месте увидят вас в списке «прилетают» и позовут на встречи.</Note>
          <Btn variant="gold" wide onClick={() => { app.announceTrip({ region: id, inDays: tripIn, days: tripDays }); setTrip(false); }}>Объявить</Btn>
        </div>
      </Sheet>
    </>
  );
}
