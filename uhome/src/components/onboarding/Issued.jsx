import { useEffect, useMemo, useState } from 'react';
import { go } from '../../lib/router.jsx';
import { groupsOf } from '../../lib/groups.js';
import { reasons } from '../../lib/intro.js';
import { firstNameOf } from '../../data/people.js';
import { plural } from '../../lib/format.js';
import { Btn } from '../UI.jsx';
import { Avatar, GroupAva } from '../Art.jsx';
import Icon from '../Icons.jsx';
import ResidentCard from '../ResidentCard.jsx';
import Chrome, { pad2 } from './Chrome.jsx';
import { figureStats } from './Constellation.jsx';
import { prefersReduced, useCountUp } from '../../lib/motion.js';

/* Итог теста: фигура схлопнулась — и из её света выпускается паспорт
   резидента. Пока идёт выпуск, под картой бежит короткий журнал печати.
   После печати — итог фигуры, мастер-группа, три первых знакомства
   с пользой и вход в клуб. Нажатие во время выпуска досматривать
   не заставляет. */

const LOG = [
  { t: 'Формирую носитель', v: 'OK', at: 250 },
  { t: 'Печатаю данные резидента', v: 'OK', at: 950 },
  { t: 'Кодирую машинную зону', v: 'MRZ · OK', at: 1550 },
  { t: 'Защитный гильош', v: 'OK', at: 2050 },
  { t: 'Печать клуба', v: 'ISSUED', at: 2650 },
];

export default function Issued({ app, A }) {
  const me = app.me;
  const [done, setDone] = useState(prefersReduced);
  const [skip, setSkip] = useState(false);
  const g = useMemo(() => groupsOf(me)[0], [me]);
  const rs = useMemo(() => reasons(app, 3), [app]);
  const today = new Date();
  const date = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}.${today.getFullYear()}`;
  const name = firstNameOf(me);
  const fig = useMemo(() => figureStats({
    tone: me.tone, sphere: me.sphere, needs: me.needs || [], gives: me.gives || [],
    interests: me.interests || [], regions: me.regionsOften || [me.region], formats: me.formats || [],
  }), [me]);

  const finish = () => {
    if (done) return;
    setSkip(true);
    setDone(true);
  };

  return (
    <div className={`onb onb--pass${done ? ' is-done' : ''}`} onClick={done ? undefined : finish}>
      <Chrome
        left="UHOME · ПАСПОРТ РЕЗИДЕНТА"
        right={done ? <span className="o-ok"><Icon name="check" size={11} width={2.6} /> Выдан</span> : 'Выпуск'}
        progress={1}
        live={!done}
      />

      <div className="opass__card">
        <ResidentCard
          me={me}
          stats={{ circle: app.circle.length, events: Object.keys(app.going).length }}
          hint={done}
          issue
          skip={skip}
          onIssued={() => setDone(true)}
        />
      </div>

      <div className="opass__body">
      {!done && <IssueLog />}
      <div className="opass__sum" data-on={done}>
        <div className="oq__head">
          <div className="o-eyebrow o-eyebrow--sea">
            <span>Паспорт выдан · {date}</span>
            <span className="o-eyebrow__r">{me.number}</span>
          </div>
          <h1 className="o-title">Добро пожаловать{name ? <>, <b>{name}</b></> : <b> в клуб</b>}</h1>
        </div>

        <div className="opass__fig">
          <span><b>{pad2(fig.nodes)}</b> {plural(fig.nodes, 'узел', 'узла', 'узлов')}</span>
          <span><b>{pad2(fig.links)}</b> {plural(fig.links, 'связь', 'связи', 'связей')}</span>
          <span><b className="gold">{fig.overlaps}</b> {plural(fig.overlaps, 'совпадение', 'совпадения', 'совпадений')}</span>
        </div>

        <button className="ogrp" onClick={() => go('/group/g-mm', true)}>
          <GroupAva members={g.members} size={46} />
          <span className="grow" style={{ minWidth: 0 }}>
            <span className="ogrp__k">Мастер-группа · {g.members.length + 1} участников</span>
            <span className="ogrp__t">{g.theme.name}</span>
            <span className="ogrp__s">{g.when}</span>
          </span>
          <Icon name="right" size={16} className="chev" />
        </button>

        <div className="o-label">
          <span>Первые знакомства</span>
          <span>Польза</span>
        </div>
        <div className="ointro">
          {rs.map((r, i) => (
            <button key={r.id} className="ointro__i" style={{ '--i': i }} onClick={() => go(`/p/${r.p.id}`, true)}>
              <Avatar person={r.p} size={38} />
              <span className="grow" style={{ minWidth: 0 }}>
                <span className="ointro__n">{r.p.name}</span>
                <span className="ointro__w">{r.label} · {r.why}</span>
              </span>
              <Gauge pct={r.pct} run={done} delay={300 + i * 140} />
            </button>
          ))}
        </div>
      </div>

      </div>

      <div className="o-bar opass__bar" data-on={done}>
        <Btn variant="gold" wide onClick={() => go('/', true)}>Войти в клуб</Btn>
      </div>
    </div>
  );
}

/* Журнал выпуска: строки появляются по ходу церемонии на карте. */
function IssueLog() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const ts = LOG.map((l, k) => setTimeout(() => setN(k + 1), l.at));
    return () => ts.forEach(clearTimeout);
  }, []);
  return (
    <div className="opass__log" aria-hidden="true">
      {LOG.slice(0, n).map((l, k) => (
        <div key={l.t} className={`opass__ln${k === n - 1 ? ' is-now' : ''}`}>
          <span className="opass__lt">› {l.t}</span>
          <i className="opass__lf" />
          <span className="opass__lv">{l.v}</span>
        </div>
      ))}
    </div>
  );
}

/* Польза знакомства: кольцо дорисовывается, число досчитывается. */
function Gauge({ pct, run, delay }) {
  const v = useCountUp(run ? pct : 0, { ms: 900, delay, from: 0 });
  const c = 2 * Math.PI * 17;
  return (
    <span className="ogauge">
      <svg viewBox="-20 -20 40 40" width="40" height="40" aria-hidden="true">
        <circle r="17" className="ogauge__bg" />
        <circle r="17" className="ogauge__fg" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} />
      </svg>
      <span className="ogauge__v">{v}<small>%</small></span>
    </span>
  );
}
