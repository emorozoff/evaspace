/* Перетаскивание карточек между шагами — мышью и пальцем (как в штабе).
   Мышь: зажали и повели (от 5 px). Палец: подержали ~0,3 с и повели —
   так обычная прокрутка не превращается в перетаскивание. Карточка едет
   за указателем, на месте вставки — пустая рамка, у краёв окна страница
   прокручивается сама. Зоны [data-zone] внутри колонки (например,
   «Подключаем» в «Итоге») ловят карточку точнее, чем колонка целиком. */

const Drag = {
  active: null,
  justDropped: 0,
  wired: false,

  /* root — доска; карточки [data-drag], колонки [data-col] со списком .b3-list */
  board(root, {canDrag, onDrop}) {
    root.addEventListener('pointerdown', e => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const card = e.target.closest('[data-drag]');
      if (!card || !root.contains(card) || e.target.closest('button, a, input, select, textarea, [data-nodrag]')) return;
      if (canDrag && !canDrag(card.dataset.drag)) return;
      Drag.arm(e, card, root, onDrop);
    });
    if (Drag.wired) return;
    Drag.wired = true;
    document.addEventListener('pointermove', e => Drag.move(e), {passive: false});
    document.addEventListener('pointerup', e => Drag.end(e, true));
    document.addEventListener('pointercancel', e => Drag.end(e, false));
    document.addEventListener('touchmove', e => { if (Drag.active && Drag.active.on) e.preventDefault(); }, {passive: false});
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && Drag.active) Drag.end(null, false); });
    /* клик сразу после отпускания карточки не должен её открывать */
    document.addEventListener('click', e => { if (Date.now() - Drag.justDropped < 350 && e.target.closest && e.target.closest('[data-drag]')) { e.stopPropagation(); e.preventDefault(); } }, true);
  },

  arm(e, card, root, onDrop) {
    const touch = e.pointerType !== 'mouse';
    const st = {card, root, onDrop, on: false, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, id: e.pointerId, touch, timer: null, from: card.closest('[data-col]')};
    if (touch) st.timer = setTimeout(() => { if (Drag.active === st) Drag.start(st); }, 300);
    Drag.active = st;
  },

  start(st) {
    const r = st.card.getBoundingClientRect();
    st.on = true;
    st.dx = st.x0 - r.left;
    st.dy = st.y0 - r.top;
    const ghost = st.card.cloneNode(true);
    ghost.classList.add('drag-ghost');
    ghost.style.width = r.width + 'px';
    document.body.appendChild(ghost);
    st.ghost = ghost;
    const ph = document.createElement('div');
    ph.className = 'drag-ph';
    ph.style.height = r.height + 'px';
    st.card.after(ph);
    st.card.classList.add('drag-src');
    st.ph = ph;
    document.body.classList.add('dragging-now');
    if (st.from) st.from.classList.add('drag-from');
    if (navigator.vibrate && st.touch) { try { navigator.vibrate(12); } catch (err) { /* ничего */ } }
    Drag.place(st);
  },

  move(e) {
    const st = Drag.active;
    if (!st || e.pointerId !== st.id) return;
    st.x = e.clientX; st.y = e.clientY;
    if (!st.on) {
      const d = Math.hypot(st.x - st.x0, st.y - st.y0);
      if (st.touch) { if (d > 10) { clearTimeout(st.timer); Drag.active = null; } return; }
      if (d < 5) return;
      Drag.start(st);
    }
    e.preventDefault();
    Drag.place(st);
    Drag.autoscroll(st);
  },

  place(st) {
    st.ghost.style.transform = `translate(${st.x - st.dx}px, ${st.y - st.dy}px) rotate(1.5deg)`;
    st.ghost.style.visibility = 'hidden';
    const under = document.elementFromPoint(st.x, st.y);
    st.ghost.style.visibility = '';
    const col = under && under.closest('[data-col]');
    const zone = under && under.closest('[data-zone]');
    $$('.drop-on', st.root).forEach(c => c !== col && c !== zone && c.classList.remove('drop-on'));
    st.zone = zone && st.root.contains(zone) ? zone : null;
    if (st.zone) st.zone.classList.add('drop-on');
    if (!col || !st.root.contains(col)) { st.col = null; return; }
    col.classList.add('drop-on');
    const list = $('.b3-list', col);
    const cards = $$('[data-drag]', list).filter(c => c !== st.card);
    let before = null;
    for (const c of cards) {
      const r = c.getBoundingClientRect();
      if (st.y < r.top + r.height / 2) { before = c; break; }
    }
    if (before) list.insertBefore(st.ph, before); else list.appendChild(st.ph);
    st.col = col;
  },

  autoscroll(st) {
    const edge = 60, speed = 14;
    if (st.y < edge) window.scrollBy(0, -speed);
    else if (st.y > window.innerHeight - edge) window.scrollBy(0, speed);
  },

  end(e, drop) {
    const st = Drag.active;
    if (!st || (e && e.pointerId !== st.id)) return;
    clearTimeout(st.timer);
    Drag.active = null;
    if (!st.on) return;
    Drag.justDropped = Date.now();
    st.ghost.remove();
    st.ph.remove();
    st.card.classList.remove('drag-src');
    document.body.classList.remove('dragging-now');
    $$('.drop-on, .drag-from', st.root).forEach(c => c.classList.remove('drop-on', 'drag-from'));
    if (drop && st.col) st.onDrop(st.card.dataset.drag, st.col.dataset.col, st.zone ? st.zone.dataset.zone : null);
  },
};
