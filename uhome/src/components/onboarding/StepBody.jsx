import { REGIONS, REGION_KEYS } from '../../data/regions.js';
import { ROLES } from '../../data/people.js';
import { AVATARS } from '../../data/avatars.js';
import { AvatarPortrait } from '../AvatarArt.jsx';
import { List, Item } from '../UI.jsx';
import Icon from '../Icons.jsx';
import Flag from '../Flag.jsx';
import { vt } from './Strip.jsx';

/* Тело карточки на каждом шаге. Выбранные варианты получают
   view-transition-name — и на следующем шаге переезжают в полосу
   профиля (Strip). Ничего лишнего: поля, чипы, строки, пять флагов,
   два портрета. */

export default function StepBody({ step, f, set, setTravel, applicant, onEnter }) {
  switch (step.kind) {
    case 'who':
      return <Who f={f} set={set} applicant={applicant} onEnter={onEnter} />;
    case 'one':
      return step.rows
        ? <Rows options={step.options} value={f[step.id]} onPick={(id) => set(step.id, id)} />
        : <Chips group={step.id} options={step.options} value={f[step.id]} onPick={(id) => set(step.id, id)} />;
    case 'region':
      return <Region f={f} setTravel={setTravel} />;
    case 'avatar':
      return <Assistant options={step.options} value={f.assistant} onPick={(id) => set('assistant', id)} />;
    case 'groups':
      return step.groups.map((g) => <Group key={g.id} g={g} value={f[g.id]} onChange={(v) => set(g.id, v)} />);
    default:
      return null;
  }
}

function Who({ f, set, applicant, onEnter }) {
  const key = (e) => e.key === 'Enter' && onEnter();
  return (
    <div className="o-form">
      <input className="field" placeholder="Имя и фамилия" value={f.name} onChange={(e) => set('name', e.target.value)} onKeyDown={key} autoComplete="name" />
      <Chips group="role" options={ROLES.map((r) => ({ id: r, name: r }))} value={f.role} onPick={(r) => set('role', r)} />
      <input className="field" placeholder={applicant ? 'Компания или проект' : 'Компания'} value={f.company} onChange={(e) => set('company', e.target.value)} onKeyDown={key} autoComplete="organization" />
    </div>
  );
}

/* Один ответ чипом. */
function Chips({ group, options, value, onPick }) {
  return (
    <div className="wrap o-chips">
      {options.map((o, i) => {
        const on = value === o.id;
        return (
          <button key={o.id} className={`chip o-chip${on ? ' chip--on' : ''}`} style={on ? { viewTransitionName: vt(group, i) } : undefined} onClick={() => onPick(o.id)} aria-pressed={on}>
            {o.name}
          </button>
        );
      })}
    </div>
  );
}

/* Один ответ строкой — где у вариантов есть пояснение. */
function Rows({ options, value, onPick }) {
  return (
    <List plain>
      {options.map((o) => (
        <Item
          key={o.id}
          title={o.name}
          sub={o.sub}
          chev={false}
          onClick={() => onPick(o.id)}
          meta={value === o.id ? <Icon name="check" size={18} color="var(--gold)" width={2} /> : <span className="o-radio" />}
        />
      ))}
    </List>
  );
}

/* Пять регионов: нажатый флаг переезжает из ряда в центр карточки,
   на его месте остаётся пустое кольцо. */
function Region({ f, setTravel }) {
  const r = REGIONS[f.region];
  return (
    <div className="o-region">
      <div className="o-region__now">
        {r ? (
          <>
            <span className="o-region__big" style={{ viewTransitionName: `o-flag-${f.region}` }}><Flag cc={r.cc} size={34} /></span>
            <div style={{ minWidth: 0 }}>
              <div className="t-lg">{r.name}</div>
              <div className="t-sm dim-2 ell">{r.country}</div>
            </div>
          </>
        ) : (
          <div className="t-sm dim-2">Нажмите на флаг — он займёт место в карточке.</div>
        )}
      </div>
      <div className="o-region__row">
        {REGION_KEYS.map((k) => {
          const on = k === f.region;
          return (
            <button key={k} className="o-region__d" onClick={() => !on && setTravel('region', k)} aria-pressed={on}>
              {on
                ? <span className="o-region__disc o-region__disc--slot" />
                : <span className="o-region__disc" style={{ viewTransitionName: `o-flag-${k}` }}><Flag cc={REGIONS[k].cc} size={22} /></span>}
              <span>{REGIONS[k].name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* Ева или Адам: портрет, имя, одна строка. */
function Assistant({ options, value, onPick }) {
  return (
    <div className="o-ava">
      {options.map((o) => {
        const A = AVATARS[o.id];
        return (
          <button key={o.id} className="o-ava__o" aria-pressed={value === o.id} onClick={() => onPick(o.id)}>
            <span className="o-ava__p" style={{ viewTransitionName: `o-ava-${o.id}` }}><AvatarPortrait who={o.id} size={96} /></span>
            <span className="o-ava__n">{A.name}</span>
            <span className="o-ava__l">{o.line}</span>
          </button>
        );
      })}
    </div>
  );
}

/* Несколько ответов чипами, не больше max: лишний вытесняет самый ранний. */
function Group({ g, value, onChange }) {
  const toggle = (id) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : value.length < g.max ? [...value, id] : [...value.slice(1), id]);
  return (
    <div className="o-group">
      <div className="o-lbl"><span>{g.label}</span><span>{value.length} / {g.max}</span></div>
      <div className="wrap o-chips">
        {g.options.map((o, i) => {
          const on = value.includes(o.id);
          return (
            <button key={o.id} className={`chip o-chip${on ? ' chip--on' : ''}`} style={on ? { viewTransitionName: vt(g.id, i) } : undefined} onClick={() => toggle(o.id)} aria-pressed={on}>
              {o.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
