import { useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { TopBar, List, Item, Section, Sheet, Chip, Tag, Empty, KV, Btn, Actions, Note } from '../components/UI.jsx';
import { Avatar } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';
import { SKILL_GROUPS, BADGES, byId } from '../data/people.js';
import { REGIONS } from '../data/regions.js';
import { DEGREES, TIERS } from '../data/canon.js';
import { COMMUNITIES, SERVICES, EVENTS } from '../data/life.js';
import { visibleOnly } from '../lib/select.js';
import { usdExact, plural } from '../lib/format.js';

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
  const city = REGIONS[r.city];
  const known = app.connections.includes(r.id);
  const circle = COMMUNITIES.find((c) => c.id === r.circle);
  const services = SERVICES.filter((s) => s.owner === r.id);
  const events = EVENTS.filter((e) => e.going.includes(r.id) && e.inDays >= 0).slice(0, 3);
  const vouchers = visibleOnly(app.me, r.vouchedBy || []);

  return (
    <>
      <TopBar title={r.name} sub={`${city.flag} ${city.name}${r.online ? ' · в сети' : ''}`} backTo="/people" />
      <div className="screen stack-20">
        {/* шапка профиля */}
        <div className="center" style={{ paddingTop: 6 }}>
          <Avatar person={r} size={92} dot={r.online} ring={deg.tone} style={{ margin: '0 auto' }} />
          <h2 className="h2" style={{ marginTop: 14 }}>
            {r.name} {r.verified && <Icon name="seal" size={16} color="var(--gold)" style={{ verticalAlign: '-2px' }} />}
          </h2>
          <div className="t-sm dim" style={{ marginTop: 4 }}>{r.title} · {r.company}</div>
          <div className="wrap" style={{ justifyContent: 'center', marginTop: 10, gap: 6 }}>
            <Tag tone="gold">{tier?.name || 'Travel'}</Tag>
            <Tag style={{ background: `${deg.tone}22`, color: deg.tone }}>Степень {deg.roman}{deg.secret ? '' : ` · ${deg.name}`}</Tag>
            {r.badges.map((b) => <Tag key={b} style={{ background: `${BADGES[b].tone}1e`, color: BADGES[b].tone }}>{BADGES[b].name}</Tag>)}
          </div>
        </div>

        <Actions
          items={[
            { icon: 'message', title: 'Написать', onClick: () => go(`/dm/${r.id}`) },
            { icon: 'cup', title: 'Позвать', onClick: () => setInvite(true) },
            { icon: known ? 'check' : 'plus', title: known ? 'В контактах' : 'В контакты', on: known, onClick: () => !known && app.connect(r.id) },
            { icon: 'shield', title: 'Поручиться', onClick: () => app.vouch(r.id) },
          ]}
        />

        <p className="lead">{r.mission}</p>

        <Section title="О себе">
          <div className="card t-sm" style={{ lineHeight: 1.6, color: 'var(--ink)' }}>{r.bio}</div>
        </Section>

        <Section title="Сейчас">
          <List>
            <Item icon="gift" title="Даёт кругу" sub={r.gives} subWrap chev={false} />
            <Item icon="target" title="Ищет" sub={r.needs} subWrap chev={false} />
          </List>
        </Section>

        <Section title="Сильные стороны">
          <div className="wrap">
            {r.skills.map((s) => {
              const g = SKILL_GROUPS.find((x) => x.id === s);
              return <span key={s} className="chip" style={{ color: g.tone, boxShadow: `inset 0 0 0 1px ${g.tone}55` }}>{g.name}</span>;
            })}
            {r.talents.map((t) => <span key={t} className="chip">{t}</span>)}
          </div>
        </Section>

        <Section title="Карьера">
          <List>
            {r.career.map((c) => (
              <Item key={c.years} icon="briefcase" title={c.role} sub={`${c.org} · ${c.years}`} chev={false} />
            ))}
            {r.education && <Item icon="graduation" title="Образование" sub={r.education} subWrap chev={false} />}
          </List>
        </Section>

        <Section title="Достижения">
          <List>
            {r.wins.map((w) => (
              <Item key={w} lead={<Icon name="award" size={18} color="var(--gold)" style={{ margin: '0 11px' }} />} title={<span style={{ whiteSpace: 'normal', fontWeight: 500, fontSize: 14 }}>{w}</span>} chev={false} plain />
            ))}
          </List>
        </Section>

        <Section title="Подробности">
          <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
            <KV k="Языки" v={r.langs.join(' · ')} />
            <KV k="Жил и работал" v={r.lived.join(', ')} />
            <KV k="Интересы" v={r.interests.join(', ')} />
            <KV k="В клубе с" v={String(r.since)} />
            <KV k="Подтверждённых встреч" v={String(r.meets)} tone="var(--cyan)" />
            <KV k="Поручительств" v={String(r.vouches)} tone="var(--gold)" />
            <KV k="Контакт" v={r.contact} />
          </div>
        </Section>

        {vouchers.length > 0 && (
          <Section title="За него поручились">
            <List>
              {vouchers.map((v) => (
                <Item key={v.id} lead={<Avatar person={v} size={40} />} title={v.name} sub={`${v.title} · ${v.company}`} onClick={() => go(`/p/${v.id}`)} />
              ))}
            </List>
          </Section>
        )}

        {(services.length > 0 || circle || events.length > 0) && (
          <Section title="В клубе">
            <List>
              {circle && <Item icon="message" title={circle.name} sub="Сообщество" onClick={() => go(`/chat/${circle.id}`)} />}
              {services.map((s) => (
                <Item key={s.id} icon="gift" title={s.title} sub="Услуга резидента" meta={<span className="gold">{s.price ? usdExact(s.price) : 'по запросу'}</span>} onClick={() => go(`/service/${s.id}`)} />
              ))}
              {events.map((e) => (
                <Item key={e.id} icon="calendar" title={e.title} sub="Будет на событии" onClick={() => go(`/event/${e.id}`)} />
              ))}
            </List>
          </Section>
        )}
      </div>

      <Sheet open={invite} onClose={() => setInvite(false)} title="Пригласить на встречу" sub={r.name}>
        <div className="stack">
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
            <div className="wrap">{SLOTS.map((s) => <Chip key={s} on={slot === s} onClick={() => setSlot(s)}>{s}</Chip>)}</div>
          </div>
          <Note icon="check">После встречи обе стороны подтверждают её в приложении — только тогда она попадает в цепочку репутации.</Note>
          <Btn variant="gold" wide onClick={() => { app.connect(r.id); app.confirmMeet(r.id); setInvite(false); }}>Отправить приглашение</Btn>
        </div>
      </Sheet>
    </>
  );
}
