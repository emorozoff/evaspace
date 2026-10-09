/* Перетаскивание карточек между колонками — мышью и пальцем.
   Мышь: зажали и повели (от 5 px). Палец: подержали ~0,3 с и повели —
   так обычная прокрутка страницы не превращается в перетаскивание.
   Во время переноса карточка едет за указателем, на месте вставки — пустая
   рамка; у краёв окна и доски страница прокручивается сама. */

const Drag = {
  active: null,
  justDropped: 0,
  wired: false,

  /* root — контейнер доски; cols — селектор колонки (data-col="ключ");
     каждая колонка содержит список .kb-list с карточками [data-task] */
  board(root, {canDrag, onDrop}) {
    root.addEventListener('pointerdown', e => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const card = e.target.closest('[data-task]');
      if (!card || !root.contains(card) || e.target.closest('button, a, input, select, textarea, [data-nodrag]')) return;
      if (canDrag && !canDrag(card.dataset.task)) return;
      Drag.arm(e, card, root, onDrop);
    });
    if (!Drag.wired) {
      Drag.wired = true;
      document.addEventListener('pointermove', e => Drag.move(e), {passive: false});
      document.addEventListener('pointerup', e => Drag.end(e, true));
      document.addEventListener('pointercancel', e => Drag.end(e, false));
      document.addEventListener('touchmove', e => { if (Drag.active && Drag.active.on) e.preventDefault(); }, {passive: false});
      /* клик, который браузер шлёт сразу после отпускания карточки, не должен открывать её */
      document.addEventListener('click', e => { if (Date.now() - Drag.justDropped < 350 && e.target.closest && e.target.closest('[data-task]')) { e.stopPropagation(); e.preventDefault(); } }, true);
    }
  },

  arm(e, card, root, onDrop) {
    const touch = e.pointerType !== 'mouse';
    const st = {card, root, onDrop, on: false, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, id: e.pointerId, touch, timer: null};
    if (touch) st.timer = setTimeout(() => { if (Drag.active === st) Drag.start(st); }, 280);
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
    $$('.kb-col.drop-on', st.root).forEach(c => c !== col && c.classList.remove('drop-on'));
    if (!col || !st.root.contains(col)) return;
    col.classList.add('drop-on');
    const list = $('.kb-list', col);
    const cards = $$('[data-task]', list).filter(c => c !== st.card);
    let before = null;
    for (const c of cards) {
      const r = c.getBoundingClientRect();
      if (st.y < r.top + r.height / 2) { before = c; break; }
    }
    if (before) list.insertBefore(st.ph, before);
    else {
      const add = $('.kb-add, .kb-composer', list);
      if (add) list.insertBefore(st.ph, add); else list.appendChild(st.ph);
    }
    st.col = col;
  },

  autoscroll(st) {
    const edge = 56, speed = 14;
    if (st.y < edge) window.scrollBy(0, -speed);
    else if (st.y > window.innerHeight - edge) window.scrollBy(0, speed);
    const board = st.root.querySelector('.kb') || st.root;
    const r = board.getBoundingClientRect();
    if (board.scrollWidth > board.clientWidth) {
      if (st.x < r.left + edge) board.scrollLeft -= speed;
      else if (st.x > r.right - edge) board.scrollLeft += speed;
    }
  },

  end(e, drop) {
    const st = Drag.active;
    if (!st || (e && e.pointerId !== st.id)) return;
    clearTimeout(st.timer);
    Drag.active = null;
    if (!st.on) return;
    Drag.justDropped = Date.now();
    const col = st.col;
    let beforeId = null, afterId = null;
    if (col && drop) {
      const seq = $$('[data-task], .drag-ph', $('.kb-list', col)).filter(x => x !== st.card);
      const i = seq.indexOf(st.ph);
      const prev = seq[i - 1], next = seq[i + 1];
      afterId = prev && prev.dataset.task ? prev.dataset.task : null;
      beforeId = next && next.dataset.task ? next.dataset.task : null;
    }
    st.ghost.remove();
    st.ph.remove();
    st.card.classList.remove('drag-src');
    document.body.classList.remove('dragging-now');
    $$('.drop-on', st.root).forEach(c => c.classList.remove('drop-on'));
    if (col && drop) st.onDrop(st.card.dataset.task, col.dataset.col, {afterId, beforeId});
  },
};