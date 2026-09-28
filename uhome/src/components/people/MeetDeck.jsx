import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { go } from '../../lib/router.jsx';
import { REGIONS } from '../../data/regions.js';
import { roleEn, firstNameOf } from '../../data/people.js';
import { diffLabel } from '../../lib/time.js';
import { assistantOf } from '../../lib/assistant.js';
import { Avatar } from '../Art.jsx';
import { AvatarPortrait } from '../AvatarArt.jsx';
import { Btn } from '../UI.jsx';
import Icon from '../Icons.jsx';
import Flag from '../Flag.jsx';
import Gauge, { reducedMotion } from './Gauge.jsx';
import Holo from './Holo.jsx';
import { ChipLine } from './Chips.jsx';

/* Знакомства недели одним экраном: стопка карточек, свайп вправо —
   познакомиться, влево — пропустить, кнопка ассистента — «познакомит».
   Логика недели (кто в подборке, ответы) — в screens/People.jsx,
   здесь только показ и жесты. */

const pad2 = (n) => String(n).padStart(2, '0');
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Высота элемента через ResizeObserver — без опроса в цикле. */
function useHeight() {
  const [h, setH] = useState(0);
  const ro = useRef(null);
  const ref = useCallback((el) => {
    ro.current?.disconnect();
    if (!el || typeof ResizeObserver === 'undefined') return;
    ro.current = new ResizeObserver(([e]) => setH(Math.round(e.contentRect.height / 4) * 4));
    ro.current.observe(el);
  }, []);
  useEffect(() => () => ro.current?.disconnect(), []);
  return [ref, h];
}

/* ——— прогресс недели: семь делений, как на табло ——— */

export function MeetProgress({ list, status, currentId, week, met, chatOpen, onMet }) {
  const done = list.filter(({ p }) => status[p.id]).length;
  const pos = Math.min(list.length, done + (currentId ? 1 : 0));
  return (
    <div className="pm-prog">
      <div className="pm-prog__row">
        <span className="pm-prog__k">Подборка · неделя {week}</span>
        {met.length > 0 && (
          <button className="pm-prog__met" onClick={onMet} aria-label="Знакомства недели">
            <span className="pm-prog__avas">
              {met.slice(0, 3).map(({ p }) => <Avatar key={p.id} person={p} size={22} radius={0.5} />)}
            </span>
            {met.length} {met.length === 1 ? 'связь' : met.length < 5 ? 'связи' : 'связей'}
          </button>
        )}
        <span className="pm-prog__n"><b>{pad2(pos)}</b>/{pad2(list.length)}</span>
      </div>
      <div className="pm-prog__bar">
        {list.map(({ p }) => (
          <i key={p.id} data-s={status[p.id] ? (chatOpen(p.id) ? 'matched' : status[p.id]) : p.id === currentId ? 'now' : ''} />
        ))}
      </div>
    </div>
  );
}

/* ——— карточка ——— */

function MeetCard({ app, item, active }) {
  const { p, pct, reasons = [], toMe = [], fromMe = [], hobbies = [] } = item;
  const r = REGIONS[p.region];
  const mine = REGIONS[app.me.region];
  const near = p.region === app.me.region;
  const [holoRef, h] = useHeight();
  const ava = h ? Math.max(72, Math.min(128, Math.round((h * 0.52) / 4) * 4)) : 108;
  const links = Math.min(5, toMe.length + fromMe.length + hobbies.length);

  return (
    <>
      <div className="pm-card__holo" ref={holoRef}>
        <Holo
          p={p}
          plate={r.plate}
          size={ava}
          nodes={Math.max(1, links)}
          corners={{
            tl: <><Flag cc={r.cc} size={13} /> {p.city}</>,
            tr: near ? <span className="sea">● рядом</span> : <>созвон · {diffLabel(r.tz, mine.tz)}</>,
            bl: <>{roleEn(p)} · {p.langs?.join(' · ')}</>,
          }}
        />
      </div>
      <div className="pm-card__body">
        <div className="pm-head">
          <div className="pm-head__id">
            <div className="pm-name">{p.name}</div>
            <div className="pm-role">{p.title} · {p.company}</div>
          </div>
          <div className="pm-head__g">
            <Gauge pct={pct} size={60} run={active} delay={260} />
            <span>польза</span>
          </div>
        </div>
        {reasons.length > 0 && (
          <ul className="pm-why">
            {reasons.slice(0, 2).map((x) => <li key={x}>{cap(x)}</li>)}
          </ul>
        )}
        <div className="pm-lines">
          <ChipLine k="Даёт" items={p.gives} on={toMe} tone="gold" />
          <ChipLine k="Ищет" items={p.needs} on={fromMe} tone="sea" />
        </div>
        <button className="pm-open" onClick={() => go(`/p/${p.id}`)} tabIndex={active ? 0 : -1}>
          <span>Открыть профиль</span>
          <Icon name="right" size={14} />
        </button>
      </div>
      <div className="pm-edge pm-edge--like" />
      <div className="pm-edge pm-edge--skip" />
      <div className="pm-stamp pm-stamp--like"><Icon name="handshake" size={14} /> знакомиться</div>
      <div className="pm-stamp pm-stamp--skip"><Icon name="x" size={13} /> пропустить</div>
      <div className="pm-stamp pm-stamp--intro"><Icon name="spark" size={13} /> {assistantOf(app).name} познакомит</div>
    </>
  );
}

/* ——— стопка и жесты ——— */

export function MeetDeck({ app, items, onCommit, paused, children }) {
  const A = assistantOf(app);
  const stage = useRef(null);
  const top = useRef(null);
  const g = useRef(null);
  const busy = useRef(false);
  const [leaving, setLeaving] = useState(null);
  const [pulse, setPulse] = useState('');

  const setP = (dx) => {
    const el = stage.current;
    if (!el) return;
    const p = Math.max(-1, Math.min(1, dx / 120));
    el.style.setProperty('--p', Math.abs(p).toFixed(3));
    el.style.setProperty('--like', Math.max(0, p).toFixed(3));
    el.style.setProperty('--skip', Math.max(0, -p).toFixed(3));
  };

  const fling = (dir, from = { dx: 0, dy: 0 }) => {
    const el = top.current;
    const item = items[0];
    if (!el || !item || busy.current) return;
    busy.current = true;
    const quick = reducedMotion();
    const x = dir === 'right' ? 1 : -1;
    el.dataset.out = dir;
    el.style.transition = quick ? 'none' : dir === 'up'
      ? 'transform .5s cubic-bezier(.5,0,.2,1), opacity .5s ease, filter .5s ease'
      : 'transform .48s cubic-bezier(.3,.6,.3,1), opacity .48s ease';
    el.style.transform = dir === 'up'
      ? 'translate3d(0, 58%, 0) scale(.12)'
      : `translate3d(${x * (window.innerWidth + 120)}px, ${from.dy * 0.3 + 40}px, 0) rotate(${x * 22}deg)`;
    el.style.opacity = dir === 'up' ? '0' : '1';
    if (dir === 'up') el.style.filter = 'blur(2px)';
    setP(0);
    setPulse(dir);
    setLeaving(item.p.id);
    setTimeout(() => {
      busy.current = false;
      setLeaving(null);
      setPulse('');
      onCommit(item, dir);
    }, quick ? 0 : 420);
  };

  const onDown = (e) => {
    const el = top.current;
    if (busy.current || !el || !el.contains(e.target) || e.target.closest('button, a')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    g.current = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0, vx: 0, lx: e.clientX, lt: e.timeStamp };
    el.setPointerCapture?.(e.pointerId);
    el.style.transition = 'none';
    stage.current.classList.add('is-drag');
  };
  const onMove = (e) => {
    const s = g.current;
    if (!s || e.pointerId !== s.id) return;
    s.dx = e.clientX - s.x;
    s.dy = e.clientY - s.y;
    const dt = e.timeStamp - s.lt;
    if (dt > 0) {
      s.vx = 0.7 * ((e.clientX - s.lx) / dt) + 0.3 * s.vx;
      s.lx = e.clientX;
      s.lt = e.timeStamp;
    }
    top.current.style.transform = `translate3d(${s.dx}px, ${s.dy * 0.3}px, 0) rotate(${s.dx / 17}deg)`;
    setP(s.dx);
  };
  const onUp = (e) => {
    const s = g.current;
    if (!s || e.pointerId !== s.id) return;
    g.current = null;
    stage.current.classList.remove('is-drag');
    const fast = Math.abs(s.vx) > 0.5 && Math.abs(s.dx) > 36;
    if (e.type !== 'pointercancel' && (Math.abs(s.dx) > 105 || fast)) {
      fling(s.dx > 0 ? 'right' : 'left', s);
    } else {
      const el = top.current;
      el.style.transition = 'transform .55s var(--spring)';
      el.style.transform = '';
      setP(0);
    }
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

  const shown = items.slice(0, 3);

  return (
    <div className="pm-stage" ref={stage} data-pulse={pulse}>
      <div className="pm-deck">
        {shown.map((item, i) => {
          const isLeaving = item.p.id === leaving;
          const d = leaving && !isLeaving ? i - 1 : i;
          const first = i === 0;
          return (
            <div key={item.p.id} className="pm-slot" data-d={d} data-leaving={isLeaving || undefined} aria-hidden={d > 0 || undefined}>
              <article
                className="pm-card"
                ref={first ? top : undefined}
                onPointerDown={first ? onDown : undefined}
                onPointerMove={first ? onMove : undefined}
                onPointerUp={first ? onUp : undefined}
                onPointerCancel={first ? onUp : undefined}
              >
                <MeetCard app={app} item={item} active={d === 0 && !isLeaving} />
              </article>
            </div>
          );
        })}
      </div>

      <div className="pm-actions">
        <button className="pm-act pm-act--skip" onClick={() => fling('left')} aria-label="Пропустить">
          <span className="pm-act__b"><Icon name="x" size={22} /></span>
          <span className="pm-act__l">Пропустить</span>
        </button>
        <button className="pm-act pm-act--eva" onClick={() => fling('up')} aria-label={`${A.name} познакомит`}>
          <span className="pm-act__b">
            <AvatarPortrait who={A.id} size={44} ring={false} />
            <i className="pm-act__spark"><Icon name="spark" size={10} /></i>
          </span>
          <span className="pm-act__l">{A.name} познакомит</span>
        </button>
        <button className="pm-act pm-act--like" onClick={() => fling('right')} aria-label="Познакомиться">
          <span className="pm-act__b"><Icon name="handshake" size={26} /></span>
          <span className="pm-act__l">Знакомиться</span>
        </button>
      </div>
      {children}
    </div>
  );
}

/* ——— взаимно: две точки соединяются линией ——— */

export function Boom({ app, p, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const first = firstNameOf(p);
  return createPortal(
    <div className="pm-boom" role="dialog" aria-modal="true" aria-label="Взаимно">
      <div className="pm-boom__bg" onClick={onClose} />
      <div className="pm-boom__box">
        <div className="pm-boom__link">
          <span className="pm-boom__ring" />
          <span className="pm-boom__ring pm-boom__ring--2" />
          <div className="pm-boom__a"><Avatar person={app.me} size={76} radius={0.5} /></div>
          <div className="pm-boom__line"><i /><b /></div>
          <div className="pm-boom__b"><Avatar person={p} size={76} radius={0.5} /></div>
        </div>
        <div className="pm-boom__k">Связь установлена</div>
        <h2 className="pm-boom__t">Взаимно</h2>
        <p className="pm-boom__s">{first} тоже хочет познакомиться. Чат открыт, {first} — в вашем ближнем круге.</p>
        <div className="pm-boom__acts">
          <Btn variant="gold" wide icon="message" onClick={() => { onClose(); go(`/chat/${p.id}`); }}>Открыть чат</Btn>
          <Btn variant="quiet" wide onClick={onClose}>Смотреть дальше</Btn>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ——— неделя пройдена: вы в центре, семь связей вокруг ——— */

export function WeekDone({ app, list, status, week, chatOpen, onRestart }) {
  const n = list.length || 1;
  const S = 232;
  const R = 90;
  const conn = list.filter(({ p }) => chatOpen(p.id));
  const wait = list.filter(({ p }) => status[p.id] === 'liked' && !chatOpen(p.id));
  return (
    <div className="pm-done">
      <div className="pm-web" style={{ width: S, height: S }}>
        <svg viewBox={`${-S / 2} ${-S / 2} ${S} ${S}`} width={S} height={S} aria-hidden="true">
          <circle r={R} className="pm-web__orbit" />
          <circle r={R + 22} className="pm-web__orbit pm-web__orbit--2" />
          {list.map(({ p }, i) => {
            const a = (i / n) * Math.PI * 2 - Math.PI / 2;
            const s = chatOpen(p.id) ? 'on' : status[p.id] || 'none';
            return (
              <line
                key={p.id}
                className={`pm-web__ln pm-web__ln--${s}`}
                pathLength={s === 'liked' ? undefined : 1}
                x1={Math.cos(a) * 34} y1={Math.sin(a) * 34} x2={Math.cos(a) * (R - 20)} y2={Math.sin(a) * (R - 20)}
                style={{ '--i': i }}
              />
            );
          })}
        </svg>
        <div className="pm-web__me"><Avatar person={app.me} size={60} radius={0.5} /></div>
        {list.map(({ p }, i) => {
          const a = (i / n) * Math.PI * 2 - Math.PI / 2;
          const s = chatOpen(p.id) ? 'on' : status[p.id] || 'none';
          return (
            <button
              key={p.id}
              className={`pm-web__n pm-web__n--${s}`}
              style={{ left: S / 2 + Math.cos(a) * R, top: S / 2 + Math.sin(a) * R, '--i': i }}
              onClick={() => go(s === 'on' ? `/chat/${p.id}` : `/p/${p.id}`)}
              aria-label={p.name}
            >
              <Avatar person={p} size={38} radius={0.5} />
            </button>
          );
        })}
      </div>
      <div className="pm-done__k">Неделя {week} · подборка пройдена</div>
      <h2 className="pm-done__t">
        {conn.length ? <><b>{conn.length}</b> {conn.length === 1 ? 'новая связь' : conn.length < 5 ? 'новые связи' : 'новых связей'}</> : 'Неделя закрыта'}
      </h2>
      <p className="pm-done__s">
        {wait.length ? `Ещё ${wait.length} ждут ответа. ` : ''}Новая подборка придёт в понедельник.
      </p>
      <div className="pm-done__hint">Нажмите на человека — откроется чат или профиль</div>
      <div className="pm-legend">
        <span><i className="on" />чат открыт</span>
        <span><i className="liked" />ждём ответа</span>
        <span><i className="skipped" />пропущено</span>
      </div>
      <Btn size="sm" variant="ghost" icon="swap" onClick={onRestart}>Показать подборку снова</Btn>
    </div>
  );
}
