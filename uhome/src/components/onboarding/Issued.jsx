import { useEffect, useMemo, useRef, useState } from 'react';
import { groupsOf } from '../../lib/groups.js';
import { reasons } from '../../lib/intro.js';
import { MASTERMIND_SIZE } from '../../data/groups.js';
import { canTransition, flip } from '../../lib/transition.js';
import { Btn } from '../UI.jsx';
import ResidentCard from '../ResidentCard.jsx';

/* Паспорт выдан. Карточка регистрации становится паспортом: у обёртки то
   же view-transition-name, что было у карточки, поэтому паспорт
   появляется там, где она стояла, и принимает свои пропорции (где нет
   View Transitions — FLIP из прежнего прямоугольника). Поля печатаются,
   потом ниже проявляются метка «выдан», мастер-группа, три первых
   знакомства с пользой и вход в клуб. */

export default function Issued({ app, me, applicant, from, onEnter }) {
  const [issued, setIssued] = useState(false);
  const wrap = useRef(null);

  useEffect(() => {
    if (!canTransition()) flip(wrap.current, from, 600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const g = useMemo(() => groupsOf(me)[0], [me]);
  const rs = useMemo(() => reasons({ ...app, me, intros: {}, going: applicant ? {} : app.going }, 3), [app, me, applicant]);

  return (
    <div className="o-pass">
      <div ref={wrap} className="o-pass__card" style={{ viewTransitionName: 'o-card' }}>
        <ResidentCard
          me={me}
          stats={{ circle: applicant ? 0 : app.circle.length, events: applicant ? 0 : Object.keys(app.going).length }}
          hint={false}
          issue
          onIssued={() => setIssued(true)}
        />
      </div>

      <div className="o-pass__sum" data-on={issued}>
        <div className="center"><span className="tag tag--fill">Выдан</span></div>
        <div className="rows">
          <div className="rows__r">
            <div className="rows__k">{g.name}<i>{MASTERMIND_SIZE} человек · {g.when}</i></div>
          </div>
          {rs.map((r) => (
            <div key={r.id} className="rows__r">
              <div className="rows__k">{r.p.name}<i>{r.why}</i></div>
              <div className="rows__v">{r.pct}%</div>
            </div>
          ))}
        </div>
        <Btn variant="gold" wide onClick={onEnter}>Войти в клуб</Btn>
      </div>
    </div>
  );
}
