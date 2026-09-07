import { useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { TopBar, Card, Btn, Section, Sheet, Chip, Tag, Empty, KV } from '../components/UI.jsx';
import { Avatar, Guilloche, QR } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';
import { RESIDENTS, SKILL_GROUPS, BADGES, byId } from '../data/people.js';
import { CITIES } from '../data/places.js';
import { DEGREES, TIERS } from '../data/canon.js';
import { CIRCLES, SERVICES, EVENTS } from '../data/life.js';
import { residentNumber } from '../lib/art.js';
import { usd, plural, nf } from '../lib/format.js';

const SLOTS = ['Сегодня, 18:00', 'Завтра, 09:00', 'Завтра, 19:30', 'В субботу, 11:00'];

export default function Person({ id }) {
  const app = useApp();
  const r = byId(id);
  const [invite, setInvite] = useState(false);
  const [slot, setSlot] = useState(SLOTS[1]);
  const [format, setFormat] = useState('coffee');

  if (!r) return <Empty title="Резидент не найден" />;

  const deg = DEGREES.find((d) => d.n === r.degree);
  const tier = TIERS.find((t) => t.n === r.tier);
  const city = CITIES[r.city];
  const known = app.connections.includes(r.id);
  const circles = CIRCLES.filter((c) => c.id === r.circle);
  const services = SERVICES.filter((s) => s.owner === r.id);
  const events = EVENTS.filter((e) => e.going.includes(r.id) && e.inDays >= 0).slice(0, 3);

  const sendInvite = () => {
    app.connect(r.id);
    app.confirmMeet(r.id);
    setInvite(false);
  };

  return (
    <>
      <TopBar title={r.name} subtitle={`${city.flag} ${city.name}`} backTo="/people" right={
        <button className="iconbtn" onClick={() => app.vouch(r.id)} title="Поручиться">
          <Icon name="shield" size={17} />
        </button>
      } />

      <div className="screen stack-22">
        <Card style={{ position: 'relative', overflow: 'hidden', padding: 20 }}>
          <div style={{ position: 'absolute', right: -70, top: -70, opacity: 0.3, pointerEvents: 'none' }}>
            <Guilloche color={r.tone} opacity={0.6} size={240} seed={r.id} />
          </div>
          <div className="row" style={{ gap: 14, position: 'relative' }}>
            <Avatar person={r} size={68} dot={r.online} ring={deg.tone} />
            <div className="grow">
              <h2 className="display" style={{ fontSize: 23 }}>{r.name}</h2>
              <div className="t-sm dim" style={{ marginTop: 3 }}>{r.role} · {r.company}</div>
              <div className="wrap" style={{ marginTop: 9, gap: 6 }}>
                <Tag tone="gold">{tier.name}</Tag>
                <Tag style={{ background: `${deg.tone}22`, color: deg.tone }}>
                  Степень {deg.roman}{deg.secret ? '' : ` · ${deg.name}`}
                </Tag>
                {r.badges.map((b) => (
                  <Tag key={b} style={{ background: `${BADGES[b].tone}1e`, color: BADGES[b].tone }}>{BADGES[b].name}</Tag>
                ))}
              </div>
            </div>
          </div>
          <p className="t-sm" style={{ marginTop: 16, lineHeight: 1.55, position: 'relative' }}>{r.mission}</p>
        </Card>

        <div className="stats">
          <div className="stat"><div className="stat__v cyan">{r.meets}</div><div className="stat__l">Встречи</div></div>
          <div className="stat"><div className="stat__v gold">{r.vouches}</div><div className="stat__l">Поручительств</div></div>
          <div className="stat"><div className="stat__v">{r.since}</div><div className="stat__l">В клубе с</div></div>
        </div>

        <div className="row" style={{ gap: 10 }}>
          <Btn variant={known ? 'ghost' : 'gold'} wide icon={known ? 'check' : 'plus'} onClick={() => !known && app.connect(r.id)}>
            {known ? 'В контактах' : 'В контакты'}
          </Btn>
          <Btn variant="ghost" wide icon="cup" onClick={() => setInvite(true)}>Позвать</Btn>
        </div>

        <Section eyebrow="Чем полезен" title="Сильные стороны">
          <div className="stack-8">
            <Card>
              <div className="eyebrow eyebrow--gold">Даёт кругу</div>
              <div className="t-sm" style={{ marginTop: 6, lineHeight: 1.5 }}>{r.gives}</div>
            </Card>
            <Card>
              <div className="eyebrow">Ищет</div>
              <div className="t-sm" style={{ marginTop: 6, lineHeight: 1.5 }}>{r.needs}</div>
            </Card>
          </div>
          <div className="wrap" style={{ marginTop: 4 }}>
            {r.skills.map((s) => {
              const g = SKILL_GROUPS.find((x) => x.id === s);
              return <span key={s} className="chip" style={{ pointerEvents: 'none', borderColor: `${g.tone}55`, color: g.tone }}>{g.name}</span>;
            })}
            {r.talents.map((t) => <span key={t} className="chip" style={{ pointerEvents: 'none' }}>{t}</span>)}
            {r.langs.map((l) => <span key={l} className="chip chip--sm" style={{ pointerEvents: 'none' }}>{l}</span>)}
          </div>
        </Section>

        {services.length > 0 && (
          <Section eyebrow="Витрина" title="Услуги резидента" more="В маркет" onMore={() => go('/market')}>
            <div className="stack-8">
              {services.map((s) => (
                <button key={s.id} className="card tap spread" onClick={() => go(`/service/${s.id}`)}>
                  <div>
                    <div className="t-md">{s.title}</div>
                    <div className="t-xs dim" style={{ marginTop: 2 }}>Ответ в среднем за {s.reply} мин · кэшбэк {s.cashback}%</div>
                  </div>
                  <div className="t-sm gold">{s.price ? usd(s.price) : 'по запросу'}</div>
                </button>
              ))}
            </div>
          </Section>
        )}

        {circles.length > 0 && (
          <Section eyebrow="Состоит" title="Круги">
            <div className="wrap">
              {circles.map((c) => (
                <Chip key={c.id} onClick={() => go(`/circle/${c.id}`)}>{c.name}</Chip>
              ))}
            </div>
          </Section>
        )}

        {events.length > 0 && (
          <Section eyebrow="Планы" title="Будет на событиях">
            <div className="stack-8">
              {events.map((e) => (
                <button key={e.id} className="card tap spread" onClick={() => go(`/event/${e.id}`)}>
                  <div className="t-sm">{e.title}</div>
                  <Icon name="right" size={15} color="var(--ink-4)" />
                </button>
              ))}
            </div>
          </Section>
        )}

        <Card className="row" style={{ gap: 14 }}>
          <div style={{ background: '#fff', borderRadius: 9, padding: 4, lineHeight: 0, flex: 'none' }}>
            <QR value={`upass:${residentNumber(r.name, r.since)}`} size={68} />
          </div>
          <div>
            <div className="t-md">Публичный профиль</div>
            <div className="t-xs dim" style={{ marginTop: 4, lineHeight: 1.45 }}>
              Код открывает страницу резидента и предлагает добавить его в контакты.
              Номер: {residentNumber(r.name, r.since)}
            </div>
          </div>
        </Card>
      </div>

      <Sheet open={invite} onClose={() => setInvite(false)} eyebrow={r.name.split(' ')[0]} title="Пригласить на встречу">
        <div className="stack-16">
          <div>
            <div className="label">Формат</div>
            <div className="wrap">
              {[['coffee', 'Кофе'], ['walk', 'Прогулка'], ['sport', 'Спорт'], ['call', 'Созвон']].map(([k, v]) => (
                <Chip key={k} on={format === k} onClick={() => setFormat(k)}>{v}</Chip>
              ))}
            </div>
          </div>
          <div>
            <div className="label">Когда</div>
            <div className="wrap">
              {SLOTS.map((s) => <Chip key={s} on={slot === s} onClick={() => setSlot(s)}>{s}</Chip>)}
            </div>
          </div>
          <Card>
            <KV k="Город" v={`${city.flag} ${city.name}`} />
            <KV k="Время ответа обычно" v="до 3 часов" />
            <div className="t-xs dim" style={{ marginTop: 10, lineHeight: 1.45 }}>
              После встречи обе стороны подтверждают её в приложении. Только подтверждённая встреча
              попадает в цепочку репутации и считается в степень.
            </div>
          </Card>
          <Btn variant="gold" wide onClick={sendInvite}>Отправить приглашение</Btn>
        </div>
      </Sheet>
    </>
  );
}
