import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { materialById, TOPICS, MATERIALS } from '../data/base.js';
import { localOf } from '../data/communities.js';
import { byId } from '../data/people.js';
import { ago, nf } from '../lib/format.js';
import { MaterialCover } from '../components/Covers.jsx';
import { Avatar } from '../components/Art.jsx';
import { TopBar, Section, List, Item, Btn, Empty } from '../components/UI.jsx';
import { MaterialRow } from './Base.jsx';
import Icon from '../components/Icons.jsx';

/* Материал базы: запись эфира или гайд. Главные мысли — текстом сверху,
   чтобы не пересматривать час ради трёх выводов; ниже — таймкоды. */

const TOPIC_COMMUNITY = { money: 'i-invest', biz: 'i-invest', realty: 'i-realty', family: 'i-family', ai: 'i-ai' };

export default function MaterialPage({ id }) {
  const app = useApp();
  const m = materialById(id);
  if (!m) return <div className="screen screen--nested"><TopBar backTo="/base" /><Empty title="Материал не найден" /></div>;

  const topic = TOPICS.find((t) => t.id === m.topic);
  const zoom = m.kind === 'zoom';
  const community = TOPIC_COMMUNITY[m.topic] || localOf(app.me.region)?.id;
  const more = MATERIALS.filter((x) => x.topic === m.topic && x.id !== m.id).slice(0, 3);

  const play = () => {
    app.watch(m.id);
    app.say(zoom ? 'В демо-версии записи нет — конспект и таймкоды ниже' : 'Отмечено как прочитанное');
  };

  return (
    <div className="screen screen--nested">
      <TopBar title={m.title} sub={`${zoom ? 'Zoom-эфир' : 'Гайд'} · ${topic.name}`} backTo="/base" />

      <div className="stack-24">
        <div className="stack">
          <button onClick={play} style={{ display: 'block', width: '100%' }} aria-label={zoom ? 'Смотреть запись' : 'Отметить прочитанным'}>
            <MaterialCover material={m} height={196} radius={18} big>
              <div className="scene__top">
                <span className="glass">{zoom ? <><Icon name="video" size={12} /> Запись · {m.dur}</> : <>Гайд · {m.read}</>}</span>
                {app.watched[m.id] && <span className="glass" style={{ color: 'var(--sea)' }}><Icon name="check" size={12} /> {zoom ? 'смотрели' : 'прочитано'}</span>}
              </div>
            </MaterialCover>
          </button>
          <h1 className="h2">{m.title}</h1>
          <div className="t-xs dim-2">
            {topic.name} · {ago(m.daysAgo)}{zoom ? ` · ${nf(m.views)} просмотров` : ''}
          </div>
        </div>

        <p className="lead">{m.about}</p>

        <Section title="Главное">
          <div className="card">
            <ul className="points">{m.points.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
        </Section>

        {m.chapters && (
          <Section title="Таймкоды">
            <div className="list">
              {m.chapters.map((c) => (
                <button key={c.t} className="chapter" onClick={play}>
                  <span className="chapter__t">{c.t}</span>
                  <span className="t-sm grow">{c.name}</span>
                  <Icon name="play" size={13} color="var(--ink-3)" />
                </button>
              ))}
            </div>
          </Section>
        )}

        <Section title={m.speakers.length > 1 ? 'Спикеры' : 'Спикер'}>
          <List>
            {m.speakers.map(byId).map((p) => (
              <Item key={p.id} lead={<Avatar person={p} size={42} />} title={p.name} sub={`${p.title} · ${p.company}`} onClick={() => go(`/p/${p.id}`)} />
            ))}
          </List>
        </Section>

        <div className="pair">
          <Btn variant="gold" icon={zoom ? 'play' : 'check'} onClick={play}>{zoom ? 'Смотреть' : 'Прочитано'}</Btn>
          <Btn variant="ghost" icon="message" onClick={() => go(`/community/${community}`)}>Обсудить</Btn>
        </div>

        {more.length > 0 && (
          <Section title="Ещё по теме">
            <div className="list">{more.map((x) => <MaterialRow key={x.id} m={x} watched={app.watched[x.id]} />)}</div>
          </Section>
        )}
      </div>
    </div>
  );
}
