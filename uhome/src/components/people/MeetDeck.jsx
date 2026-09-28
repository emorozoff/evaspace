import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { go } from '../../lib/router.jsx';
import { REGIONS } from '../../data/regions.js';
import { firstNameOf } from '../../data/people.js';
import { assistantOf } from '../../lib/assistant.js';
import { prefersReduced } from '../../lib/transition.js';
import { Avatar } from '../Art.jsx';
import { AvatarPortrait } from '../AvatarArt.jsx';
import { Btn, List } from '../UI.jsx';
import Icon from '../Icons.jsx';
import Flag from '../Flag.jsx';
import { Exchange, PersonRow } from './Bits.jsx';

/* Знакомства недели: одна спокойная карточка. Свайп вправо — знакомиться,
   влево — пропустить, средняя кнопка — ассистент знакомит сам. Логика
   недели (кто в подборке, ответы) — в screens/People.jsx, здесь показ и жест. */

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const pad2 = (n) => String(n).padStart(2, '0');

function MeetCard({ item }) {
  const { p, pct, reasons = [], toMe = [], fromMe = [] } = item;
  const r = REGIONS[p.region];
  return (
    <>
      <div className="p-mcard__head">
        <Avatar person={p} size={92} radius={0.5} ring="var(--hair-2)" dot={p.online} />
        <h2 className="h2">{p.name}</h2>
        <div className="p-mcard__s">{p.title} · {p.company}</div>
        <div className="p-mcard__s"><Flag cc={r.cc} size={12} /> {p.city} · {r.name}</div>
      </div>
      <div className="p-mcard__mid">
        <div className="p-mcard__use">
          <span className="tile__v">{pct}<small>%</small></span>
          <span className="tile__k">польза знакомства</span>
        </div>
        <ul className="p-mcard__why">
          {(reasons.length ? reasons.slice(0, 2) : ['вы в одном клубе — повод найдётся']).map((x) => <li key={x}>{cap(x)}</li>)}
        </ul>
      </div>
      <div className="p-mcard__x">
        <Exchange k="Даёт" items={p.gives} on={toMe} />
        <Exchange k="Ищет" items={p.needs} on={fromMe} />
      </div>
      <button className="p-mcard__open" onClick={() => go(`/p/${p.id}`)}>Открыть профиль<Icon name="right" size={14} /></button>
    </>
  );
}

export function MeetDeck({ app, item, onCommit, paused, chat }) {
  const A = assistantOf(app);
  const card = useRef(null);
  const g = useRef(null);
  const busy = useRef(false);
  const [lean, setLean] = useState('');

  const fling = (dir) => {
    const el = card.current;
    if (!el || busy.current) return;
    busy.current = true;
    const quick = prefersReduced();
    if (!quick) {
      const x = dir === 'right' ? 1 : -1;
      el.style.transition = 'transform 0.4s cubic-bezier(0.3, 0.6, 0.3, 1), opacity 0.4s';
      el.style.transform = dir === 'up' ? 'translateY(-24px) scale(0.94)' : `translate(${x * (window.innerWidth + 80)}px, 24px) rotate(${x * 14}deg)`;
      el.style.opacity = dir === 'up' ? '0' : '0.5';
    }
    setLean(dir);
    setTimeout(() => { busy.current = false; setLean(''); onCommit(item, dir); }, quick ? 0 : 380);
  };

  const onDown = (e) => {
    if (busy.current || e.target.closest('button, a') || (e.pointerType === 'mouse' && e.button !== 0)) return;
    g.current = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, vx: 0, lx: e.clientX, lt: e.timeStamp };
    card.current.setPointerCapture?.(e.pointerId);
    card.current.style.transition = 'none';
  };
  const onMove = (e) => {
    const s = g.current;
    if (!s || e.pointerId !== s.id) return;
    s.dx = e.clientX - s.x;
    const dt = e.timeStamp - s.lt;
    if (dt > 0) { s.vx = 0.7 * ((e.clientX - s.lx) / dt) + 0.3 * s.vx; s.lx = e.clientX; s.lt = e.timeStamp; }
    card.current.style.transform = `translate(${s.dx}px, ${(e.clientY - s.y) * 0.25}px) rotate(${s.dx / 18}deg)`;
    const l = s.dx > 40 ? 'right' : s.dx < -40 ? 'left' : '';
    if (l !== lean) setLean(l);
  };
  const onUp = (e) => {
    const s = g.current;
    if (!s || e.pointerId !== s.id) return;
    g.current = null;
    const fast = Math.abs(s.vx) > 0.5 && Math.abs(s.dx) > 30;
    if (e.type !== 'pointercancel' && (Math.abs(s.dx) > 100 || fast)) return fling(s.dx > 0 ? 'right' : 'left');
    card.current.style.transition = 'transform 0.45s var(--ease)';
    card.current.style.transform = '';
    setLean('');
  };

  // стрелки на клавиатуре — для компьютера
  useEffect(() => {
    if (paused) return undefined;
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea')) return;
      if (e.key === 'ArrowRight') fling('right');
      if (e.key === 'ArrowLeft') fling('left');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="p-deck" data-lean={lean}>
      <article
        key={item.p.id} ref={card} className="card p-mcard"
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      >
        <MeetCard item={item} />
      </article>
      <div className="p-acts">
        <button className="p-act" onClick={() => fling('left')} aria-label="Пропустить">
          <span className="p-act__b"><Icon name="x" size={20} /></span><span>Пропустить</span>
        </button>
        {chat ? (
          <button className="p-act p-act--mid" onClick={() => go(`/chat/${item.p.id}`)} aria-label="Написать">
            <span className="p-act__b"><Icon name="message" size={22} /></span><span>Написать</span>
          </button>
        ) : (
          <button className="p-act p-act--mid" onClick={() => fling('up')} aria-label={`${A.name} познакомит`}>
            <span className="p-act__b"><AvatarPortrait who={A.id} size={30} ring={false} /></span><span>{A.name} познакомит</span>
          </button>
        )}
        <button className="p-act p-act--like" onClick={() => fling('right')} aria-label="Знакомиться">
          <span className="p-act__b"><Icon name="check" size={22} width={2} /></span><span>Знакомиться</span>
        </button>
      </div>
    </div>
  );
}

/* Взаимно: короткая карточка поверх экрана. */
export function Match({ app, p, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const first = firstNameOf(p);
  return createPortal(
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="p-match" role="dialog" aria-modal="true" aria-label="Взаимно">
        <div className="card card--gold p-match__box">
          <div className="p-match__avas">
            <Avatar person={app.me} size={64} radius={0.5} />
            <i />
            <Avatar person={p} size={64} radius={0.5} />
          </div>
          <h2 className="h2">Взаимно</h2>
          <p>{first} тоже хочет познакомиться. Чат открыт, {first} — в вашем ближнем круге.</p>
          <Btn variant="gold" wide icon="message" onClick={() => { onClose(); go(`/chat/${p.id}`); }}>Открыть чат</Btn>
          <Btn variant="quiet" wide onClick={onClose}>Дальше</Btn>
        </div>
      </div>
    </>,
    document.body
  );
}

/* Подборка недели списком: кто есть кто и что с ним вышло. */
export function WeekList({ app, list, stateOf }) {
  const TAG = { matched: ['взаимно', 'tag--gold'], intro: ['интро', 'tag--gold'], liked: ['ждём', ''], skipped: ['пропущено', ''] };
  return (
    <List>
      {list.map(({ p, pct }, i) => {
        const s = stateOf(p.id);
        const [label, cls] = TAG[s] || [`${pad2(i + 1)}`, ''];
        const open = s === 'matched' || s === 'intro';
        return (
          <PersonRow
            key={p.id} app={app} p={p} pct={pct}
            sub={`${p.title} · ${p.company} · польза ${pct}%`}
            meta={<span className={`tag ${cls}`}>{label}</span>}
            onClick={() => go(open ? `/chat/${p.id}` : `/p/${p.id}`)}
          />
        );
      })}
    </List>
  );
}
