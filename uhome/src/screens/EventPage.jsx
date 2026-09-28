import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { eventById, KINDS } from '../data/events.js';
import { byId, firstNameOf } from '../data/people.js';
import { REGIONS } from '../data/regions.js';
import { companyById } from '../data/services.js';
import { localOf } from '../data/communities.js';
import { goingCount } from '../lib/select.js';
import { eventIntros } from '../lib/intro.js';
import { assistantOf } from '../lib/assistant.js';
import { introduce } from '../components/Intros.jsx';
import { whenLabel, dayShift, weekdayLong, dateLong, plural } from '../lib/format.js';
import { downloadIcs } from '../lib/calendar.js';
import { EventCover, Brand } from '../components/Covers.jsx';
import { placeOf, myTime } from '../components/EventCards.jsx';
import { Avatar, AvaStack } from '../components/Art.jsx';
import { TopBar, Section, List, Item, Btn, Empty } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';

/* Страница события: всё, чтобы решить «иду или нет». Обложка, заголовок
   антиквой, факты строками, программа шагами, кто идёт и с кем стоит
   познакомиться. Главное действие — в панели у нижнего края. */

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
  const free = /бесплатно/i.test(e.price);
  const people = e.going.map(byId).filter(Boolean);
  const n = goingCount(app, e);
  const left = Math.max(0, e.cap - n);
  const mine = myTime(e, app.me.region); // только у эфиров: пояс организатора и ваш
  const d = dayShift(e.inDays);
  const community = e.region ? localOf(e.region) : null;
  const A = assistantOf(app);
  const meet = eventIntros(app, e).slice(0, 4);
  const R = REGIONS[e.region];
  const canCalendar = !closed || going;

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
      // заявка уходит в чат с командой (store.askClosed) — обещание «придёт сообщение» держим
      app.askClosed(e.id);
      app.say('Заявка отправлена — ответ команды придёт в сообщения');
      return;
    }
    app.toggleGoing(e.id);
    app.say(going ? 'Отметку сняли' : 'Вы в списке. Код на входе — на обороте карты резидента');
  };

  const openMap = online || closed ? undefined : () => window.open(`https://maps.google.com/?q=${encodeURIComponent(`${e.place}, ${R.name}`)}`, '_blank', 'noopener');
  const introWhy = (x) => (going ? `Вы оба идёте на «${e.title}». ${x.why}` : `На этом событии будет ${firstNameOf(x.p)}: «${e.title}». ${x.why}`);

  return (
    <div className="screen screen--nested s-hascta">
      <TopBar
        title={e.title}
        sub={online ? 'Эфир · Zoom' : <>{KINDS[e.kind].name} · {placeOf(e)}</>}
        backTo="/events"
        right={<button className="iconbtn" onClick={share} aria-label="Поделиться"><Icon name="share" size={18} /></button>}
      />

      <div className="stack-24">
        <div className="stack">
          <EventCover event={e} height={170}>
            <div className="scene__top">
              <span className="glass">{placeOf(e)}</span>
              {going ? <span className="glass sea"><Icon name="check" size={12} width={2} /> вы идёте</span> : e.kind !== 'club' ? <span className="glass">{KINDS[e.kind].name}</span> : null}
            </div>
          </EventCover>
          <h1 className="h2" style={{ marginTop: 6 }}>{e.title}</h1>
        </div>

        <div className="rows">
          <div className="rows__r">
            <span className="rows__k">Когда<i>{weekdayLong(d)}, {dateLong(d)}</i></span>
            <span className="rows__v">{e.time}{e.tzName && <u>{e.tzName}</u>}</span>
          </div>
          {mine && (
            <div className="rows__r">
              <span className="rows__k">Время у вас<i>{REGIONS[app.me.region].name}</i></span>
              <span className="rows__v">{mine.time}{mine.dayShift ? <u>{mine.dayShift > 0 ? '+' : '−'}{Math.abs(mine.dayShift)} день</u> : null}</span>
            </div>
          )}
          <div className="rows__r">
            <span className="rows__k">Цена<i>{free ? 'Бесплатно для резидентов — нужна только отметка «Иду»' : closed ? 'Участников подтверждает команда' : 'Оплата на месте или по ссылке от команды'}</i></span>
            <span className="rows__v">{free ? 'бесплатно' : e.price}</span>
          </div>
          <div className="rows__r">
            <span className="rows__k">Места</span>
            <span className="rows__v">{left || '—'}<u>из {e.cap}</u></span>
          </div>
        </div>

        <List>
          <Item
            icon={online ? 'video' : closed && !going ? 'lock' : 'pin'}
            title={closed && !going ? 'Адрес — после подтверждения' : e.place}
            sub={online ? 'Ссылка придёт в сообщения за час до начала' : closed && !going ? `${R.name}, ${R.country} · закрытое событие` : `${R.name}, ${R.country}`}
            subWrap
            meta={openMap ? <Icon name="external" size={15} color="var(--ink-3)" /> : undefined}
            chev={false}
            onClick={openMap}
          />
        </List>

        <Section title="О событии">
          <p className="lead">{e.about}</p>
        </Section>

        {e.program?.length > 0 && (
          <Section title="Программа" note={`Длится ${e.dur}`}>
            <div className="steps">
              {e.program.map((s, i) => {
                const m = /^(\d{1,2}:\d{2})\s*[—–-]\s*(.+)$/.exec(s);
                return (
                  <div key={i} className="step">
                    <span className={`step__n${m ? ' s-time' : ''}`}>{m ? m[1] : String(i + 1).padStart(2, '0')}</span>
                    <span className="step__t">{m ? m[2] : s}</span>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        <Section title="Кто ведёт">
          <List>
            {host && <Item lead={<Avatar person={host} size={42} dot={host.online} />} title={host.name} sub={`${host.title} · ${host.company}`} onClick={() => go(`/p/${host.id}`)} />}
            {partner && <Item lead={<Brand company={partner} size={42} radius={21} />} title={partner.name} sub={`Партнёр события · ${partner.tagline}`} onClick={() => go(`/service/${partner.id}`)} />}
          </List>
        </Section>

        <Section title="Кто идёт" note={`${n} из ${e.cap} · ${left ? `свободно ${left}` : 'все места заняты'}`}>
          <div className="row" style={{ gap: 12 }}>
            <AvaStack people={going ? [app.me, ...people] : people} size={30} max={6} />
            <span className="t-sm dim">
              {going && 'Вы, '}{people.slice(0, going ? 2 : 3).map((p) => p.name.split(' ')[0]).join(', ')}
              {people.length > (going ? 2 : 3) ? ` и ещё ${people.length - (going ? 2 : 3)}` : ''}
            </span>
          </div>
        </Section>

        {meet.length > 0 && (
          <Section title="С кем познакомиться" note={`${A.name} ${A.found} по пользе для вас`}>
            <List>
              {meet.map((x) => {
                const done = app.intros?.[x.p.id];
                return (
                  <div key={x.p.id} className="item" style={{ alignItems: 'flex-start' }}>
                    <button onClick={() => go(`/p/${x.p.id}`)} aria-label={x.p.name}><Avatar person={x.p} size={42} dot={x.p.online} /></button>
                    <span className="item__body">
                      <button className="item__t" style={{ display: 'block', maxWidth: '100%' }} onClick={() => go(`/p/${x.p.id}`)}>{x.p.name}</button>
                      <span className="item__s item__s--wrap">{x.why}</span>
                      {done
                        ? <span className="t-xs sea" style={{ display: 'block', marginTop: 6 }}>Интро отправлено</span>
                        : <button className="s-act" onClick={() => introduce(app, x.p, introWhy(x))}>Познакомить</button>}
                    </span>
                    <span className="s-pct">{x.pct}<small>%</small></span>
                  </div>
                );
              })}
            </List>
            {!going && !closed && <div className="note-line">Отметьтесь «Иду» — {A.name} предупредит их, что вы тоже будете.</div>}
          </Section>
        )}

        {closed && !going && (
          <div className="note-line">
            {asked ? 'Заявка у команды. Как только подтвердят — придёт сообщение, а адрес появится здесь.' : 'Закрытое событие: мест мало, участников подтверждает команда. Адрес откроется после подтверждения.'}
          </div>
        )}
      </div>

      <div className="s-cta">
        <Btn variant={going ? 'done' : 'gold'} className="grow" icon={going ? 'check' : undefined} disabled={closed && asked && !going} onClick={main}>
          {going ? 'Вы идёте · отменить' : closed ? (asked ? 'Заявка отправлена' : 'Подать заявку') : online ? 'Записаться на эфир' : 'Иду'}
        </Btn>
        {canCalendar && (
          <button className="s-cta__ic" onClick={() => downloadIcs(e)} aria-label="Добавить в календарь" title="В календарь"><Icon name="calendar" size={19} /></button>
        )}
        <button className="s-cta__ic" onClick={() => go(community ? `/community/${community.id}` : '/chat/team')} aria-label={community ? 'Чат региона' : 'Спросить команду'}><Icon name="message" size={19} /></button>
      </div>
    </div>
  );
}
