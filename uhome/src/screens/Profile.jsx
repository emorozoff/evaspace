import { useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { REGIONS } from '../data/regions.js';
import { ROLES, EXCHANGE } from '../data/people.js';
import { EVENTS } from '../data/events.js';
import { companyById } from '../data/services.js';
import ResidentCard from '../components/ResidentCard.jsx';
import RegionSheet from '../components/RegionSheet.jsx';
import Install from '../components/Install.jsx';
import { AvatarPortrait } from '../components/AvatarArt.jsx';
import { EventRow } from '../components/EventCards.jsx';
import { assistantOf } from '../lib/assistant.js';
import { groupsOf } from '../lib/groups.js';
import { plural } from '../lib/format.js';
import { TONES } from '../data/avatars.js';
import { GroupAva } from '../components/Art.jsx';
import { TopBar, Section, List, Item, Btn, Sheet, Field } from '../components/UI.jsx';
import Flag from '../components/Flag.jsx';

/* Профиль: карта резидента, регион, анкета, ассистент и группа, мои
   события и заявки. Всё правится здесь же, без отдельных экранов. */

export default function Profile() {
  const app = useApp();
  const [region, setRegion] = useState(false);
  const [edit, setEdit] = useState(false);
  const r = REGIONS[app.me.region];
  const going = EVENTS.filter((e) => app.going[e.id]).sort((a, b) => a.inDays - b.inDays);
  const A = assistantOf(app);
  const mm = groupsOf(app.me)[0];

  return (
    <div className="screen screen--nested">
      <TopBar title="Профиль" sub={app.me.name} backTo="/" />
      <div className="stack-24">
        <ResidentCard me={app.me} stats={{ circle: app.circle.length, events: going.length }} />

        <List>
          <Item lead={<span className="disc"><Flag cc={r.cc} size={22} /></span>} title={`Я сейчас: ${r.name}`} sub={r.country} meta={<span className="gold">сменить</span>} chev={false} onClick={() => setRegion(true)} />
          <Item icon="edit" title="Анкета" sub={`${app.me.title || app.me.role}${app.me.company ? ` · ${app.me.company}` : ''}`} onClick={() => setEdit(true)} />
          <Item icon="message" title="Сообщения" sub="Команда клуба, резиденты, сообщества" onClick={() => go('/chats')} />
        </List>

        <Section title="Ассистент и группа">
          <List>
            <Item lead={<AvatarPortrait who={A.id} size={42} />} title={A.name} sub={`Тон: ${TONES.find((t) => t.id === (app.me.tone || 'warm'))?.name.toLowerCase()} · что знает о вас`} onClick={() => go('/ai?tab=me')} />
            <Item lead={<GroupAva members={mm.members} size={42} />} title={mm.name} sub={`${mm.members.length + 1} ${plural(mm.members.length + 1, 'участник', 'участника', 'участников')} · ${mm.when}`} onClick={() => go('/group/g-mm')} />
            <Item icon="spark" title={app.me.tested ? 'Пройти тест заново' : 'Пройти тест'} sub="Минута — и подбор людей и событий точнее" onClick={() => go('/test')} />
          </List>
        </Section>

        <Section title="Мои события" note={going.length ? `${going.length} ${plural(going.length, 'отметка', 'отметки', 'отметок')} «иду»` : undefined} more="Афиша" onMore={() => go('/events')}>
          {going.length ? (
            <List>{going.map((e) => <EventRow key={e.id} app={app} event={e} />)}</List>
          ) : (
            <div className="note-line">Пока никуда не записаны — загляните в афишу.</div>
          )}
        </Section>

        {app.orders.length > 0 && (
          <Section title="Мои заявки в услуги">
            <List>
              {app.orders.map((o) => {
                const c = companyById(o.company);
                return <Item key={o.id} icon="bag" title={o.offer} sub={`${c?.name} · ответ придёт в сообщения`} onClick={() => go(`/chat/${c?.owner}`)} />;
              })}
            </List>
          </Section>
        )}

        <Section title="Приложение">
          <Install app={app} />
          <List>
            <Item icon="message" title="Написать команде" sub="Вопрос, идея или жалоба — ответим за 15 минут" onClick={() => go('/chat/team')} />
            <Item
              icon="logout"
              title="Выйти из демо"
              sub="Всё, что вы меняли, сотрётся с этого телефона"
              onClick={() => { if (window.confirm('Выйти и сбросить демо-данные?')) { app.leave(); go('/', true); } }}
            />
          </List>
        </Section>
      </div>

      <RegionSheet app={app} open={region} onClose={() => setRegion(false)} />
      <Sheet open={edit} onClose={() => setEdit(false)} title="Анкета" sub="Это видят резиденты в вашем профиле и в знакомствах">
        {edit && <EditForm app={app} onDone={() => setEdit(false)} />}
      </Sheet>
    </div>
  );
}

function EditForm({ app, onDone }) {
  const [f, setF] = useState({
    name: app.me.name, role: app.me.role, title: app.me.title || '', company: app.me.company || '',
    about: app.me.about || '', gives: app.me.gives || [],
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const toggle = (id) => setF({ ...f, gives: f.gives.includes(id) ? f.gives.filter((x) => x !== id) : f.gives.length < 3 ? [...f.gives, id] : f.gives });

  return (
    <div className="stack" style={{ gap: 16 }}>
      <Field label="Имя и фамилия"><input className="field" value={f.name} onChange={set('name')} /></Field>
      <div>
        <span className="label">Роль</span>
        <div className="wrap">
          {ROLES.map((x) => <button key={x} className={`chip${f.role === x ? ' chip--on' : ''}`} onClick={() => setF({ ...f, role: x })}>{x}</button>)}
        </div>
      </div>
      <div className="pair">
        <Field label="Должность"><input className="field" value={f.title} onChange={set('title')} placeholder="Основатель" /></Field>
        <Field label="Компания"><input className="field" value={f.company} onChange={set('company')} placeholder="Название" /></Field>
      </div>
      <Field label="О себе"><textarea className="field" value={f.about} onChange={set('about')} placeholder="Чем занимаетесь, одной-двумя фразами" /></Field>
      <div>
        <span className="label">Чем можете помочь · до трёх</span>
        <div className="wrap">
          {Object.entries(EXCHANGE).map(([id, x]) => (
            <button key={id} className={`chip${f.gives.includes(id) ? ' chip--on' : ''}`} onClick={() => toggle(id)}>{x.name}</button>
          ))}
        </div>
      </div>
      <Btn variant="gold" wide disabled={f.name.trim().length < 3} onClick={() => { app.updateMe({ ...f, name: f.name.trim() }); app.say('Анкета сохранена'); onDone(); }}>
        Сохранить
      </Btn>
    </div>
  );
}
