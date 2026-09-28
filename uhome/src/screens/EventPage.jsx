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
import { whenLabel, dayShift, weekdayLong, monthShort } from '../lib/format.js';
import { timeForMe, downloadIcs } from '../lib/calendar.js';
import { EventCover, Brand } from '../components/Covers.jsx';
import { KindTag, placeOf, PctRing } from '../components/EventCards.jsx';
import { Avatar, AvaStack } from '../components/Art.jsx';
import { TopBar, Section, List, Item, Btn, Note, Empty } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';

/* Страница события: всё, чтобы решить «иду или нет». Сверху — сцена и
   «билет» моноширинными полями: дата, начало, длительность, места.
   Дальше место и вход, программа линией времени, кто ведёт, зал
   по местам и с кем стоит познакомиться (польза кольцом). Главное
   действие всегда под рукой — в стеклянной панели внизу. */

export default function EventPage({ id }) {
  const app = useApp();
  const e = eventById(id);
  if (!e) return <div className="screen screen--nested"><TopBar backTo="/events" /><Empty title="Событие не найдено" /></div>;

  const host = byId(e.host);
  const partner = e.partner ? companyById(e.partner) : null;
  const going = app.going[e.id];
  const asked = app.asked[e.id];
  const closed = e.kind === 'closed';
  const online = e.kind === 'online';
  const people = e.going.map(byId).filter(Boolean);
  const n = goingCount(app, e);
  const left = Math.max(0, e.cap - n);
  const mineTime = timeForMe(e, app.me.region);
  const d = dayShift(e.inDays);
  const community = e.region ? localOf(e.region) : null;
  const A = assistantOf(app);
  const meet = eventIntros(app, e).slice(0, 4);
  const R = REGIONS[e.region];

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

  const openMap = online || closed ? undefined : () => window.open(`https://maps.google.com/?q=${encodeURIComponent(`${e.place}, ${R.name}`)}`, '_blank', 'noopener');

  return (
    <div className="screen screen--nested xevp">
      <TopBar
        title={e.title}
        sub={online ? 'Эфир · Zoom' : <>{KINDS[e.kind].name} · {placeOf(e)}</>}
        backTo="/events"
        right={<button className="iconbtn" onClick={share} aria-label="Поделиться"><Icon name="share" size={18} /></button>}
      />

      <div className="stack-24">
        <div className="xevp__hero">
          <EventCover event={e} height={188}>
            <div className="scene__top">
              <span className="cv-chip">{placeOf(e)}</span>
              {going ? <span className="cv-chip cv-chip--sea"><Icon name="check" size={12} width={2} /> вы идёте</span> : <KindTag kind={e.kind} />}
            </div>
          </EventCover>
          <h1 className="h2 xevp__title">{e.title}</h1>

          <div className="xticket">
            <div className="xticket__c">
              <span className="xticket__k">Дата</span>
              <span className="xticket__v">{String(d.getDate()).padStart(2, '0')} {monthShort(d)}</span>
              <span className="xticket__s">{weekdayLong(d)}</span>
            </div>
            <div className="xticket__c">
              <span className="xticket__k">Начало</span>
              <span className="xticket__v">{e.time}</span>
              <span className="xticket__s">{e.tzName || 'местное'}</span>
            </div>
            <div className="xticket__c">
              <span className="xticket__k">Длится</span>
              <span className="xticket__v">{String(e.dur).replace(/\s*час(а|ов)?$/, ' ч')}</span>
              <span className="xticket__s">до {endOf(e)}</span>
            </div>
            <div className="xticket__c">
              <span className="xticket__k">Места</span>
              <span className="xticket__v">{left ? left : '—'}<small>/{e.cap}</small></span>
              <span className="xticket__s">{left ? 'свободно' : 'мест нет'}</span>
            </div>
          </div>
          {mineTime && (
            <div className="xevp__tz"><Icon name="clock" size={13} /> В вашем поясе — {mineTime.replace('у вас ', '')}</div>
          )}
        </div>

        <List>
          <Item
            icon={online ? 'video' : 'pin'}
            title={e.place}
            sub={online ? 'Ссылка придёт в сообщения за час до начала' : `${R.name}, ${R.country}`}
            onClick={openMap}
            meta={openMap ? <Icon name="external" size={15} color="var(--ink-3)" /> : undefined}
            chev={false}
          />
          <Item icon="gift" title={e.price} sub={closed ? 'Закрытое событие: мест мало, участников подтверждает команда' : 'Оплата на месте или по ссылке от команды'} />
        </List>

        <Section title="О событии">
          <p className="lead">{e.about}</p>
          {e.program?.length > 0 && (
            <ol className={`xtl${e.program.some((x) => /^\d{1,2}:\d{2}/.test(x)) ? '' : ' xtl--n'}`}>
              {e.program.map((s, i) => {
                const m = /^(\d{1,2}:\d{2})\s*[—–-]\s*(.+)$/.exec(s);
                return (
                  <li key={i} className="xtl__i" style={{ '--i': i }}>
                    <span className="xtl__t">{m ? m[1] : String(i + 1).padStart(2, '0')}</span>
                    <span className="xtl__d">{m ? m[2] : s}</span>
                  </li>
                );
              })}
            </ol>
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

        <Section title="Кто идёт" note={`${n} из ${e.cap} · ${left ? `свободно ${left}` : 'все места заняты'}`}>
          <div className="xhall">
            <Seats n={n} cap={e.cap} mine={going} />
            <div className="xhall__who">
              <AvaStack people={going ? [app.me, ...people] : people} size={30} max={6} />
              <span className="xhall__names">
                {going && 'Вы, '}{people.slice(0, going ? 2 : 3).map((p) => p.name.split(' ')[0]).join(', ')}
                {people.length > (going ? 2 : 3) ? ` и\u00a0ещё\u00a0${people.length - (going ? 2 : 3)}` : ''}
              </span>
            </div>
          </div>
        </Section>

        {meet.length > 0 && (
          <Section title="С кем познакомиться" note={`${A.name} ${A.found} по пользе для вас`}>
            <div className="xmeet">
              {meet.map((x, i) => {
                const done = app.intros?.[x.p.id];
                return (
                  <div key={x.p.id} className="xmeet__row" style={{ '--i': i }}>
                    <button className="xmeet__ava" onClick={() => go(`/p/${x.p.id}`)} aria-label={x.p.name}>
                      <Avatar person={x.p} size={42} dot={x.p.online} />
                    </button>
                    <div className="xmeet__body">
                      <button className="xmeet__name" onClick={() => go(`/p/${x.p.id}`)}>{x.p.name}</button>
                      <div className="xmeet__why">{x.why}</div>
                      {done ? (
                        <span className="xmeet__done"><Icon name="check" size={12} width={2.2} /> интро отправлено</span>
                      ) : (
                        <button className="xmeet__act" onClick={() => introduce(app, x.p, `Вы оба идёте на «${e.title}». ${x.why}`)}>
                          <Icon name="handshake" size={14} /> Познакомить
                        </button>
                      )}
                    </div>
                    <PctRing pct={x.pct} size={46} />
                  </div>
                );
              })}
            </div>
            {!going && !closed && <div className="xevp__hint">Отметьтесь «Иду» — {A.name} предупредит их, что вы тоже будете.</div>}
          </Section>
        )}

        {closed && !going && (
          <Note icon="lock" tone="var(--violet)">
            {asked ? 'Заявка у команды. Как только подтвердят — придёт сообщение, а адрес появится здесь.' : 'Адрес откроется после подтверждения. Команда смотрит заявки каждый день.'}
          </Note>
        )}

        <div className="xcta">
          <Btn
            variant={going ? 'done' : 'gold'}
            className="xcta__main"
            icon={going ? 'check' : closed ? 'lock' : undefined}
            disabled={closed && asked && !going}
            onClick={main}
          >
            {going ? 'Вы идёте · отменить' : closed ? (asked ? 'Заявка отправлена' : 'Подать заявку') : online ? 'Записаться на эфир' : 'Иду'}
          </Btn>
          <button className="xcta__ic" onClick={() => downloadIcs(e)} aria-label="Добавить в календарь" title="В календарь">
            <Icon name="calendar" size={19} />
          </button>
          <button
            className="xcta__ic"
            onClick={() => go(community ? `/community/${community.id}` : '/chat/team')}
            aria-label={community ? 'Чат региона' : 'Спросить команду'}
            title={community ? 'Чат региона' : 'Спросить'}
          >
            <Icon name="message" size={19} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* Когда закончится: начало плюс длительность — «до 10:00». */
function endOf(e) {
  const [h, m] = e.time.split(':').map(Number);
  const dur = parseFloat(String(e.dur).replace(',', '.')) || 2;
  const t = (h * 60 + m + Math.round(dur * 60)) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/* Зал по местам: до сорока мест — каждое деление, больше — шкала
   с отметками по десяткам процентов. Ваше место — зелёным. */
function Seats({ n, cap, mine }) {
  if (cap <= 40) {
    return (
      <div className="xseats" style={{ '--cols': cap > 20 ? Math.ceil(cap / 2) : cap }} aria-label={`Занято ${n} из ${cap}`}>
        {Array.from({ length: cap }, (_, i) => (
          <i key={i} className={i < n ? (mine && i === 0 ? 'is-me' : 'is-on') : ''} style={{ '--i': i }} />
        ))}
      </div>
    );
  }
  return (
    <div className="xgaugebar" aria-label={`Занято ${n} из ${cap}`}>
      <span className="xgaugebar__fill" style={{ '--f': Math.max(0.015, n / cap) }} />
      {Array.from({ length: 9 }, (_, i) => <i key={i} style={{ left: `${(i + 1) * 10}%` }} />)}
      <span className="xgaugebar__l">занято {Math.max(1, Math.round((n / cap) * 100))}%</span>
    </div>
  );
}
