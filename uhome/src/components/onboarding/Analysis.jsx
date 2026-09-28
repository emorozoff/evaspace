import { useEffect, useState } from 'react';
import { AvatarPortrait } from '../AvatarArt.jsx';
import Icon from '../Icons.jsx';
import { prefersReduced } from '../../lib/motion.js';

/* Сверка с клубом: четыре строки загораются по очереди, справа —
   короткий итог каждой. Вся сцена длится около четырёх секунд,
   нажатие в любом месте экрана её пропускает (это делает Test). */

const AT = [900, 1850, 2800, 3500];
const END = 3950;

export default function Analysis({ A, lines, onDone }) {
  const [i, setI] = useState(() => (prefersReduced() ? lines.length : 0));

  useEffect(() => {
    if (prefersReduced()) {
      const t = setTimeout(onDone, 500);
      return () => clearTimeout(t);
    }
    const ts = AT.map((ms, k) => setTimeout(() => setI(k + 1), ms));
    const end = setTimeout(onDone, END);
    return () => {
      ts.forEach(clearTimeout);
      clearTimeout(end);
    };
    // сцена запускается один раз
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="oan">
      <div className="oq__head">
        <div className="o-eyebrow">
          <AvatarPortrait who={A.id} size={18} />
          <span>{A.name} сверяет ваш профиль</span>
        </div>
        <h1 className="o-title">Ищу ваших людей <b>в клубе</b></h1>
      </div>
      <div className="oan__list">
        {lines.map((l, k) => {
          const st = k < i ? 'done' : k === i ? 'now' : 'wait';
          return (
            <div className="oan__row" data-st={st} key={l.t}>
              <span className="oan__st">{st === 'done' ? <Icon name="check" size={11} width={2.6} /> : null}</span>
              <span className="oan__t">{l.t}</span>
              <span className="oan__v">{st === 'done' ? l.v : st === 'now' ? <span className="oan__dots"><i /><i /><i /></span> : '—'}</span>
            </div>
          );
        })}
      </div>
      <div className="oan__skip">Нажмите, чтобы пропустить</div>
    </div>
  );
}
