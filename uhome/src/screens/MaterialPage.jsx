import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { materialById, TOPICS, MATERIALS, PINS, pinOf } from '../data/base.js';
import { localOf } from '../data/communities.js';
import { byId } from '../data/people.js';
import { ago, nf, plural } from '../lib/format.js';
import { seeded } from '../lib/art.js';
import { prefersReduced } from '../lib/motion.js';
import { Avatar } from '../components/Art.jsx';
import { TopBar, Section, Btn, Empty } from '../components/UI.jsx';
import { MaterialRow } from './Base.jsx';
import Icon from '../components/Icons.jsx';

/* Материал базы: запись эфира или гайд. Сверху — плеер-табло: волна,
   шкала с таймкодами и бегунок; нажатие на таймкод переводит бегунок.
   Главные мысли — текстом, чтобы не пересматривать час ради трёх выводов. */

const TOPIC_COMMUNITY = { money: 'i-invest', biz: 'i-invest', realty: 'i-realty', family: 'i-family', ai: 'i-ai' };

/** «1 ч 24 мин» → 84, «58 мин» → 58. */
const durMin = (s = '') => {
  const h = /(\d+)\s*ч/.exec(s);
  const m = /(\d+)\s*мин/.exec(s);
  return (h ? +h[1] * 60 : 0) + (m ? +m[1] : 0) || 1;
};
/** «1:10:05» → 70.08, «12:40» → 12.67 (в минутах). */
const tcMin = (t) => {
  const p = t.split(':').map(Number);
  return p.length === 3 ? p[0] * 60 + p[1] + p[2] / 60 : p[0] + p[1] / 60;
};
const clock = (min) => {
  const s = Math.round(min * 60);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${String(m).padStart(2, '0')}:${ss}`;
};

export default function MaterialPage({ id }) {
  const app = useApp();
  const m = materialById(id);
  const player = useRef(null);
  const [seek, setSeek] = useState(null);
  if (!m) return <div className="screen screen--nested"><TopBar backTo="/base" /><Empty title="Материал не найден" /></div>;

  const topic = TOPICS.find((t) => t.id === m.topic);
  const zoom = m.kind === 'zoom';
  const pin = pinOf(m.id);
  const community = TOPIC_COMMUNITY[m.topic] || localOf(app.me.region)?.id;
  const more = MATERIALS.filter((x) => x.topic === m.topic && x.id !== m.id && !pinOf(x.id)).slice(0, 3);
  const nextPin = pin ? PINS[PINS.indexOf(pin) + 1] : null;
  const done = !!app.watched[m.id];

  const play = (at) => {
    app.watch(m.id);
    if (zoom) {
      setSeek({ at: at ?? 0, n: Date.now() });
      app.say('В демо-версии записи нет — конспект и таймкоды ниже');
    } else {
      app.say('Отмечено как прочитанное');
    }
  };
  const jump = (c) => {
    play(tcMin(c.t));
    player.current?.scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth', block: 'center' });
  };

  return (
    <div className="screen screen--nested mtp">
      <TopBar title={m.title} sub={`${pin ? `Закреп ${pin.n} · ` : ''}${zoom ? (pin ? 'Видео' : 'Zoom-эфир') : 'Гайд'} · ${topic.name}`} backTo="/base" />

      <div className="stack-24">
        <div className="stack mtp-head">
          <div ref={player}>
            {zoom ? <Player m={m} seek={seek} onPlay={play} done={done} pin={pin} /> : <Doc m={m} done={done} onRead={() => play()} />}
          </div>
          <div className="mtp-meta">
            <span>{topic.name}</span>
            <span>{ago(m.daysAgo)}</span>
            {zoom && <span>{nf(m.views)} просмотров</span>}
          </div>
          <h1 className="h2 mtp-title">{m.title}</h1>
          <p className="lead">{m.about}</p>
        </div>

        <Section title="Главное" note={`${m.points.length} ${plural(m.points.length, 'мысль', 'мысли', 'мыслей')} · читать минуту`}>
          <ol className="mtp-points">
            {m.points.map((x, i) => (
              <li key={x} style={{ '--i': i }}>
                <span className="mtp-points__n">{String(i + 1).padStart(2, '0')}</span>
                <span>{x}</span>
              </li>
            ))}
          </ol>
        </Section>

        {m.chapters && (
          <Section title="Таймкоды" note="Нажмите — бегунок перейдёт">
            <div className="mtp-chapters">
              {m.chapters.map((c, i) => {
                const next = m.chapters[i + 1];
                const len = (next ? tcMin(next.t) : durMin(m.dur)) - tcMin(c.t);
                return (
                  <button key={c.t} className="mtp-ch" onClick={() => jump(c)}>
                    <span className="mtp-ch__t">{c.t}</span>
                    <span className="mtp-ch__name">{c.name}</span>
                    <span className="mtp-ch__len">{Math.max(1, Math.round(len))} мин</span>
                    <Icon name="play" size={11} fill="currentColor" width={1} className="mtp-ch__ic" />
                  </button>
                );
              })}
            </div>
          </Section>
        )}

        <Section title={m.speakers.length > 1 ? 'Спикеры' : 'Спикер'}>
          <div className="mtp-people">
            {m.speakers.map(byId).map((p) => (
              <button key={p.id} className="mtp-person" onClick={() => go(p.id === 'team' ? '/chat/team' : `/p/${p.id}`)}>
                <Avatar person={p} size={40} />
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="mtp-person__t">{p.name}</span>
                  <span className="mtp-person__s">{p.title} · {p.company}</span>
                </span>
                <Icon name="right" size={16} className="chev" />
              </button>
            ))}
          </div>
        </Section>

        <div className="pair">
          <Btn variant="gold" icon={zoom ? 'play' : 'check'} onClick={() => play()}>{zoom ? 'Смотреть' : 'Прочитано'}</Btn>
          <Btn variant="ghost" icon="message" onClick={() => go(`/community/${community}`)}>Обсудить</Btn>
        </div>

        {nextPin && (
          <button className="mtp-next" onClick={() => go(nextPin.to)}>
            <span className="mtp-next__k">Дальше в закрепе · {nextPin.n} / {String(PINS.length).padStart(2, '0')}</span>
            <span className="mtp-next__t">{nextPin.title}</span>
            <span className="mtp-next__s">{nextPin.format === 'video' ? 'Видео' : 'Текст'} · {nextPin.time}</span>
            <Icon name="right" size={18} className="mtp-next__ic" />
          </button>
        )}

        {more.length > 0 && (
          <Section title="Ещё по теме">
            <div className="kb-list">{more.map((x) => <MaterialRow key={x.id} m={x} watched={app.watched[x.id]} />)}</div>
          </Section>
        )}
      </div>
    </div>
  );
}

/* Плеер-табло. Демо: волна оживает, бегунок едет от выбранного таймкода. */
function Player({ m, seek, onPlay, done, pin }) {
  const total = durMin(m.dur);
  const bars = useMemo(() => {
    const rnd = seeded('pl' + m.id);
    return Array.from({ length: 44 }, (_, i) => 0.18 + Math.abs(Math.sin(i * 0.37 + rnd() * 2.4)) * (0.5 + rnd() * 0.5));
  }, [m.id]);
  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!seek) return undefined;
    const start = Math.min(0.98, seek.at / total);
    setPos(start);
    if (prefersReduced()) return undefined;
    setPlaying(true);
    // бегунок проезжает немного вперёд — показать, что запись «идёт»
    const t1 = setTimeout(() => setPos(Math.min(1, start + 0.06)), 60);
    const t2 = setTimeout(() => setPlaying(false), 4200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [seek, total]);

  const chapters = (m.chapters || []).map((c) => ({ ...c, at: tcMin(c.t) / total }));
  const cur = chapters.filter((c) => c.at <= pos + 0.001).pop();

  return (
    <div className="mtp-player" data-playing={playing}>
      <div className="mtp-player__top">
        <span className="mtp-player__rec"><i />{playing ? 'Демо · воспроизведение' : pin ? `Видео клуба · закреп ${pin.n}` : 'Запись Zoom-эфира'}</span>
        <span className="mtp-player__dur" data-done={done}>{done && <Icon name="check" size={11} width={2.4} />}{done ? 'смотрели · ' : ''}{m.dur}</span>
      </div>

      <button className="mtp-player__stage" onClick={() => onPlay(pos * total)} aria-label="Смотреть запись">
        <svg className="mtp-player__wave" viewBox="0 0 440 90" preserveAspectRatio="none" aria-hidden="true">
          {bars.map((h, i) => {
            const bh = h * 76;
            const past = i / bars.length < pos;
            return <rect key={i} x={i * 10 + 3} y={45 - bh / 2} width="3" height={bh} rx="1.5" className={`mtp-bar${past ? ' mtp-bar--past' : ''}`} style={{ '--i': i % 11 }} />;
          })}
        </svg>
        <span className="mtp-player__btn">{done && !playing ? <Icon name="flip" size={20} /> : <Icon name={playing ? 'pause' : 'play'} size={20} fill={playing ? 'none' : 'currentColor'} width={playing ? 2.4 : 1} />}</span>
      </button>

      <div className="mtp-track">
        <div className="mtp-track__line" />
        <div className="mtp-track__fill" style={{ transform: `scaleX(${pos})`, transitionDuration: playing ? '4s' : undefined }} />
        {chapters.map((c) => <i key={c.t} className="mtp-track__tick" style={{ left: `${c.at * 100}%` }} data-on={c.at <= pos + 0.001} />)}
        <span className="mtp-track__head" style={{ transform: `translateX(${pos * 100}%)`, transitionDuration: playing ? '4s' : undefined }}><i /></span>
      </div>
      <div className="mtp-player__foot">
        <span>{clock(pos * total)}</span>
        <span className="mtp-player__ch">{cur ? cur.name : ''}</span>
        <span>{clock(total)}</span>
      </div>
    </div>
  );
}

/* Гайд: документ клуба — шапка с кодом, заголовок и главные мысли
   строками-схемой; нажатие отмечает прочитанным. */
function Doc({ m, done, onRead }) {
  const lines = useMemo(() => {
    const rnd = seeded('doc' + m.id);
    return m.points.map(() => [0.55 + rnd() * 0.45, 0.3 + rnd() * 0.4]);
  }, [m.id, m.points]);
  return (
    <button className="mtp-doc" onClick={onRead} data-done={done} aria-label="Отметить прочитанным">
      <span className="mtp-doc__k">
        <span><Icon name="book" size={13} /> Гайд · {m.read}</span>
        <span className="mtp-doc__code">UHOME / {m.id.toUpperCase()}</span>
      </span>
      <span className="mtp-doc__sheet" aria-hidden="true">
        <span className="mtp-doc__head"><i /><i /></span>
        {lines.map(([a, b], i) => (
          <span key={i} className="mtp-doc__row" style={{ '--i': i }}>
            <em>{String(i + 1).padStart(2, '0')}</em>
            <span><i style={{ '--w': a }} /><i style={{ '--w': b }} /></span>
          </span>
        ))}
        <span className="mtp-doc__stamp">{done ? 'прочитано' : 'проверено командой'}</span>
      </span>
      <span className="mtp-doc__foot">
        <span>{m.points.length} {plural(m.points.length, 'главная мысль', 'главные мысли', 'главных мыслей')} ниже</span>
        <span className={done ? 'sea' : 'gold'}>{done ? '✓ прочитано' : 'отметить прочитанным'}</span>
      </span>
    </button>
  );
}
