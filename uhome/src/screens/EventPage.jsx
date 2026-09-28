import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { eventById, KINDS } from '../data/events.js';
import { byId } from '../data/people.js';
import { REGIONS } from '../data/regions.js';
import { companyById } from '../data/services.js';
import { localOf } from '../data/communities.js';
import { goingCount } from '../lib/select.js';
import { eventIntros } from '../lib/intro.js';
import { assistantOf } from '../lib/assistant.js';
import { introduce } from '../components/Intros.jsx';
import { whenLabel, dateLong, dayShift, weekdayLong } from '../lib/format.js';
import { timeForMe, downloadIcs } from '../lib/calendar.js';
import { EventCover, Brand } from '../components/Covers.jsx';
import { KindTag, placeOf } from '../components/EventCards.jsx';
import { Avatar, AvaStack } from '../components/Art.jsx';
import { TopBar, Section, List, Item, Btn, Note, Empty } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';

/* Страница события: всё, чтобы решить «иду или нет», — время в вашем поясе,
   место, цена, кто ведёт, программа, кто идёт и с кем там стоит
   познакомиться (польза в процентах). На закрытое — заявка. */

export default function EventPage({ id }) {
  const app = useApp();
  const e = eventById(id);
  if (!e) return <div className="screen screen--nested"><TopBar backTo="/events" /><Empty title="Событие не найдено" /></div>;

  const host = byId(e.host);
  const partner = e.partner ? companyById(e.partner) : null;
  const going = app.going[e.id];
  const asked = app.asked[e.id];
  const closed = e.kind === 'closed';
  const people = e.going.map(byId).filter(Boolean);
  const n = goingCount(app, e);
  const left = Math.max(0, e.cap - n);
  const mineTime = timeForMe(e, app.me.region);
  const d = dayShift(e.inDays);
  const community = e.region ? localOf(e.region) : null;
  const A = assistantOf(app);
  const meet = eventIntros(app, e).slice(0, 4);

  const share = async () => {
    const text = `${e.title} — ${whenLabel(e.inDays, e.time)}, ${e.place}`;
    try {
      if (navigator.share) await navigator.share({ title: e.title, text, url: location.href });
      else {
        await navigator.clipboard.writeText(`${text}\n${location.href}`);
        app.say('Ссылка скопирована');
      }
    } catch {
      /* отменили — ничего не делаем */
    }
  };

  const main = () => {
    if (closed && !going) {
      app.askClosed(e.id);
      app.say('Заявка отправлена — команда ответит в течение дня');
      return;
    }
    app.toggleGoing(e.id);
    app.say(going ? 'Отметку сняли' : 'Вы в списке. Код на входе — на обороте карты резидента');
  };

  return (
    <div className="screen screen--nested">
      <TopBar
        title={e.title}
        sub={<>{KINDS[e.kind].name} · {placeOf(e)}</>}
        backTo="/events"
        right={<button className="iconbtn" onClick={share} aria-label="Поделиться"><Icon name="share" size={18} /></button>}
      />

      <div className="stack-24">
        <div className="stack">
          <EventCover event={e} height={196}>
            <div className="scene__top">
              <span className="glass">{placeOf(e)}</span>
              <span className="glass">{left ? `осталось ${left} мест` : 'мест нет'}</span>
            </div>
            <div className="scene__over">
              <KindTag kind={e.kind} />
            </div>
          </EventCover>
          <h1 className="h2">{e.title}</h1>
        </div>

        <List>
          <Item
            icon="calendar"
            title={`${weekdayLong(d)[0].toUpperCase()}${weekdayLong(d).slice(1)}, ${dateLong(d)} · ${e.time}`}
            sub={`${e.dur} · ${e.tzName || 'местное время'}${mineTime ? ` · ${mineTime}` : ''}`}
          />
          <Item
            icon={e.kind === 'online' ? 'video' : 'pin'}
            title={e.place}
            sub={e.kind === 'online' ? 'Ссылка придёт в сообщения за час до начала' : `${REGIONS[e.region].name}, ${REGIONS[e.region].country}`}
            onClick={e.kind === 'online' || closed ? undefined : () => window.open(`https://maps.google.com/?q=${encodeURIComponent(`${e.place}, ${REGIONS[e.region].name}`)}`, '_blank', 'noopener')}
            meta={e.kind === 'online' || closed ? undefined : <Icon name="external" size={15} color="var(--ink-3)" />}
            chev={false}
          />
          <Item icon="gift" title={e.price} sub={closed ? 'Закрытое событие: мест мало, участников подтверждает команда' : 'Оплата на месте или по ссылке от команды'} />
        </List>

        <Section title="О событии">
          <p className="lead">{e.about}</p>
          {e.program?.length > 0 && (
            <div className="card steps">
              {e.program.map((s, i) => (
                <div key={i} className="step">
                  <span className="step__n">{i + 1}</span>
                  <span className="step__t">{s}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Кто ведёт">
          <List>
            {host && (
              <Item
                lead={<Avatar person={host} size={44} dot={host.online} />}
                title={host.name}
                sub={`${host.title} · ${host.company}`}
                onClick={() => go(`/p/${host.id}`)}
              />
            )}
            {partner && (
              <Item
                lead={<Brand company={partner} size={44} radius={13} />}
                title={partner.name}
                sub={`Партнёр события · ${partner.tagline}`}
                onClick={() => go(`/service/${partner.id}`)}
              />
            )}
          </List>
        </Section>

        <Section title={`Идут · ${n}`} note={`Мест: ${e.cap}${left ? `, свободно ${left}` : ', все заняты'}`}>
          <div className="card">
            <div className="row" style={{ gap: 12 }}>
              <AvaStack people={going ? [app.me, ...people] : people} size={34} max={7} />
              <span className="t-sm dim grow">
                {people.slice(0, 3).map((p) => p.name.split(' ')[0]).join(', ')}
                {n > 3 ? ` и ещё ${n - 3}` : ''}
              </span>
            </div>
            <div className="bar" style={{ marginTop: 14, height: 5, borderRadius: 999, background: 'var(--surface-3)', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, (n / e.cap) * 100)}%`, height: '100%', background: 'var(--gold)', borderRadius: 999 }} />
            </div>
          </div>
        </Section>

        {meet.length > 0 && (
          <Section title="С кем познакомиться" note={`${A.name} ${A.found} по пользе для вас`}>
            <List>
              {meet.map((x) => {
                const done = app.intros?.[x.p.id];
                return (
                  <div key={x.p.id} className="item">
                    <button className="row grow" style={{ gap: 14, minWidth: 0, textAlign: 'left' }} onClick={() => go(`/p/${x.p.id}`)}>
                      <Avatar person={x.p} size={46} dot={x.p.online} />
                      <span className="item__body">
                        <span className="item__t" style={{ display: 'block' }}>{x.p.name}</span>
                        <span className="item__s item__s--wrap" style={{ display: 'block' }}>{x.why}</span>
                      </span>
                    </button>
                    <div className="item__meta">
                      <span className={`pct${x.pct >= 75 ? ' pct--hi' : ''}`}>{x.pct}%</span>
                      {done
                        ? <span className="t-xs" style={{ color: 'var(--sea)' }}>интро</span>
                        : <button className="t-xs gold" style={{ fontWeight: 600 }} onClick={() => introduce(app, x.p, `Вы оба идёте на «${e.title}». ${x.why}`)}>Познакомить</button>}
                    </div>
                  </div>
                );
              })}
            </List>
            {!going && !closed && <div className="t-xs dim-2">Отметьтесь «Иду» — {A.name} предупредит их, что вы тоже будете.</div>}
          </Section>
        )}

        {closed && !going && (
          <Note icon="lock" tone="var(--violet)">
            {asked ? 'Заявка у команды. Как только подтвердят — придёт сообщение, а адрес появится здесь.' : 'Адрес откроется после подтверждения. Команда смотрит заявки каждый день.'}
          </Note>
        )}

        <div className="stack-8">
          <Btn
            variant={going ? 'done' : 'gold'}
            wide
            icon={going ? 'check' : closed ? 'lock' : undefined}
            disabled={closed && asked && !going}
            onClick={main}
          >
            {going ? 'Вы идёте · отменить' : closed ? (asked ? 'Заявка отправлена' : 'Подать заявку') : e.kind === 'online' ? 'Записаться на эфир' : 'Иду'}
          </Btn>
          <div className="pair">
            <Btn variant="ghost" icon="calendar" size="sm" onClick={() => downloadIcs(e)}>В календарь</Btn>
            <Btn variant="ghost" icon="message" size="sm" onClick={() => go(community ? `/community/${community.id}` : '/chat/team')}>
              {community ? 'Чат региона' : 'Спросить'}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
