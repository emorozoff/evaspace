import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { materialById, TOPICS, MATERIALS, PINS, pinOf } from '../data/base.js';
import { localOf } from '../data/communities.js';
import { byId } from '../data/people.js';
import { ago, nf, plural } from '../lib/format.js';
import { Avatar } from '../components/Art.jsx';
import { MaterialCover } from '../components/Covers.jsx';
import { TopBar, Section, Btn, Empty, List, Item } from '../components/UI.jsx';
import { MaterialRow } from './Base.jsx';

/* Материал базы: запись эфира или гайд. Обложка, заголовок антиквой,
   факты строками, главные мысли шагами, таймкоды строками. Главное —
   текстом, чтобы не пересматривать час ради трёх выводов. */

const TOPIC_COMMUNITY = { money: 'i-invest', biz: 'i-invest', realty: 'i-realty', family: 'i-family', ai: 'i-ai' };

export default function MaterialPage({ id }) {
  const app = useApp();
  const m = materialById(id);
  if (!m) return <div className="screen screen--nested"><TopBar backTo="/base" /><Empty title="Материал не найден" /></div>;

  const topic = TOPICS.find((t) => t.id === m.topic);
  const zoom = m.kind === 'zoom';
  const pin = pinOf(m.id);
  const community = TOPIC_COMMUNITY[m.topic] || localOf(app.me.region)?.id;
  const more = MATERIALS.filter((x) => x.topic === m.topic && x.id !== m.id && !pinOf(x.id)).slice(0, 3);
  const nextPin = pin ? PINS[PINS.indexOf(pin) + 1] : null;
  const done = !!app.watched[m.id];
  const speakers = m.speakers.map(byId).filter(Boolean);

  const play = () => {
    app.watch(m.id);
    app.say(zoom ? 'В демо-версии записи нет — главное и таймкоды ниже' : 'Отмечено как прочитанное');
  };

  return (
    <div className="screen screen--nested">
      <TopBar title={zoom ? (pin ? 'Видео клуба' : 'Запись эфира') : 'Гайд'} sub={topic.name} backTo="/base" />

      <div className="stack-24">
        <div className="stack">
          <MaterialCover material={m} height={150}>
            <div className="scene__top">
              <span className="glass">{pin ? `Закреп ${pin.n}` : topic.name}</span>
              {done && <span className="glass sea">{zoom ? 'смотрели' : 'прочитано'}</span>}
            </div>
          </MaterialCover>
          <h1 className="h2" style={{ marginTop: 6 }}>{m.title}</h1>
          <p className="lead">{m.about}</p>
        </div>

        <div className="rows">
          <div className="rows__r"><span className="rows__k">{zoom ? 'Длительность' : 'Чтение'}</span><span className="rows__v">{zoom ? m.dur : m.read}</span></div>
          <div className="rows__r"><span className="rows__k">{speakers.length > 1 ? 'Спикеры' : 'Спикер'}</span><span className="rows__v" style={{ fontSize: 15 }}>{speakers.map((p) => p.name.split(' ')[0]).join(', ')}</span></div>
          <div className="rows__r"><span className="rows__k">Дата</span><span className="rows__v" style={{ fontSize: 15 }}>{ago(m.daysAgo)}</span></div>
          {zoom && <div className="rows__r"><span className="rows__k">Просмотров</span><span className="rows__v">{nf(m.views)}</span></div>}
        </div>

        <div className="pair">
          <Btn variant="gold" icon={zoom ? 'play' : 'check'} onClick={play}>{zoom ? 'Смотреть' : done ? 'Прочитано' : 'Прочитал(а)'}</Btn>
          <Btn variant="ghost" icon="message" onClick={() => go(`/community/${community}`)}>Обсудить</Btn>
        </div>
        {zoom && <div className="note-line">Демо-версия: записи нет, ниже — главные мысли и таймкоды.</div>}

        <Section title="Главное" note={`${m.points.length} ${plural(m.points.length, 'мысль', 'мысли', 'мыслей')} · читать минуту`}>
          <div className="steps">
            {m.points.map((x, i) => (
              <div key={x} className="step"><span className="step__n">{String(i + 1).padStart(2, '0')}</span><span className="step__t">{x}</span></div>
            ))}
          </div>
        </Section>

        {m.chapters && (
          <Section title="Таймкоды">
            <div className="rows">
              {m.chapters.map((c) => (
                <button key={c.t} className="rows__r" style={{ width: '100%' }} onClick={play}>
                  <span className="rows__k">{c.name}</span>
                  <span className="rows__v" style={{ fontSize: 15 }}>{c.t}</span>
                </button>
              ))}
            </div>
          </Section>
        )}

        <Section title={speakers.length > 1 ? 'Спикеры' : 'Спикер'}>
          <List>
            {speakers.map((p) => (
              <Item key={p.id} lead={<Avatar person={p} size={42} />} title={p.name} sub={`${p.title} · ${p.company}`} onClick={() => go(p.id === 'team' ? '/chat/team' : `/p/${p.id}`)} />
            ))}
          </List>
        </Section>

        {nextPin && (
          <Section title="Дальше в закрепе">
            <List>
              <Item lead={<span className="b-n">{nextPin.n}</span>} title={nextPin.title} sub={`${nextPin.format === 'video' ? 'Видео' : 'Текст'} · ${nextPin.time}`} onClick={() => go(nextPin.to)} />
            </List>
          </Section>
        )}

        {more.length > 0 && (
          <Section title="Ещё по теме">
            <List>{more.map((x) => <MaterialRow key={x.id} m={x} watched={app.watched[x.id]} />)}</List>
          </Section>
        )}
      </div>
    </div>
  );
}
