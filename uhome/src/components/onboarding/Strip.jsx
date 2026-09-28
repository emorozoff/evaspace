import { useLayoutEffect, useRef } from 'react';
import { STEPS } from '../../data/test.js';
import { ROLES } from '../../data/people.js';
import { REGIONS } from '../../data/regions.js';
import { AvatarPortrait } from '../AvatarArt.jsx';
import Flag from '../Flag.jsx';

/* Полоса профиля наверху карточки: ответы пройденных шагов мелкими
   чипами, портрет выбранного ассистента — в углу. Имена view-transition
   те же, что у вариантов в теле карточки, поэтому выбранный чип, флаг и
   портрет переезжают сюда сами. Показывает только пройденные шаги (upto),
   чтобы имена не дублировались с текущим. */

export const vt = (group, i) => (i >= 0 ? `o-c-${group}-${i}` : undefined);

export default function Strip({ f, upto }) {
  const el = useRef(null);
  const chips = [];
  let ava = null;

  for (const s of STEPS.slice(0, upto)) {
    if (s.kind === 'who') {
      if (f.name.trim()) chips.push({ key: 'name', text: f.name.trim() });
      if (f.role) chips.push({ key: 'role', text: f.role, vt: vt('role', ROLES.indexOf(f.role)) });
    } else if (s.kind === 'one') {
      const i = s.options.findIndex((o) => o.id === f[s.id]);
      if (i >= 0) chips.push({ key: s.id, text: s.options[i].name, vt: s.rows ? undefined : vt(s.id, i) });
    } else if (s.kind === 'region' && REGIONS[f.region]) {
      chips.push({ key: 'region', text: REGIONS[f.region].name, flag: f.region });
    } else if (s.kind === 'avatar' && f.assistant) {
      ava = f.assistant;
    } else if (s.kind === 'groups') {
      for (const g of s.groups) {
        for (const id of f[g.id]) {
          const i = g.options.findIndex((o) => o.id === id);
          if (i >= 0) chips.push({ key: `${g.id}-${id}`, text: g.options[i].name, vt: vt(g.id, i) });
        }
      }
    }
  }

  // новое — справа; полоса подъезжает к нему до снимка перехода
  useLayoutEffect(() => {
    const n = el.current;
    if (n) n.scrollLeft = n.scrollWidth;
  }, [chips.length, ava]);

  if (!chips.length && !ava) return null;
  // портрет стоит в углу, прокручиваются только чипы
  return (
    <div className="o-strip">
      {ava && (
        <span className="o-strip__ava" style={{ viewTransitionName: `o-ava-${ava}` }}>
          <AvatarPortrait who={ava} size={26} />
        </span>
      )}
      <div className="o-strip__row" ref={el}>
        {chips.map((c) => (
          <span key={c.key} className="o-pill" style={c.vt ? { viewTransitionName: c.vt } : undefined}>
            {c.flag && (
              <span className="o-pill__flag" style={{ viewTransitionName: `o-flag-${c.flag}` }}>
                <Flag cc={REGIONS[c.flag].cc} size={12} />
              </span>
            )}
            {c.text}
          </span>
        ))}
      </div>
    </div>
  );
}
