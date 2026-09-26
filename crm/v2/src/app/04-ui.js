/* Интерфейс: значки, звезда Евы, окна, подтверждения, уведомления,
   подсказки и два небольших графика на SVG. */

const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  check: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="m8 12 3 3 5-6"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2Z"/><circle cx="16" cy="14.5" r="1.2"/>',
  chart: '<path d="M4 20V11"/><path d="M10 20V5"/><path d="M16 20v-7"/><path d="M21 20H3"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18 14.3a6.5 6.5 0 0 1 3.5 5.7"/>',
  book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5z"/><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  logout: '<path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h10"/>',
  ext: '<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  msg: '<path d="M4 5h16v11H9l-5 4z"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
  tick: '<path d="m5 12 5 5 9-10"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7"/><path d="M12 17h.01"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6 8.5 7 8.5-7"/>',
  send: '<path d="M21 3 10 14"/><path d="M21 3 14 21l-4-7-7-4z"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
  funnel: '<path d="M3 4h18l-7 8.5V20l-4-2v-5.5z"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9.5h18M3 15h18M9 4v16"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  gift: '<rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v8h14v-8M12 8v13"/><path d="M12 8C9 8 7 6.5 7.5 5S11 5 12 8c1-3 4-3.5 4.5-3S15 8 12 8z"/>',
  store: '<path d="M4 9 5.5 4h13L20 9"/><path d="M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0"/><path d="M5 11v9h14v-9"/><path d="M10 20v-5h4v5"/>',
  cam: '<rect x="3" y="7" width="13" height="11" rx="2"/><path d="m16 11 5-3v9l-5-3"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  note: '<path d="M5 3h10l4 4v14H5z"/><path d="M14 3v5h5M8 12h8M8 16h6"/>',
  card: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19M6 15h4"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  pin: '<path d="M12 21s7-6.2 7-11.5a7 7 0 1 0-14 0C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v4h16v-4"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 16v4h16v-4"/>',
  inbox: '<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5 5h14l2 8v6H3v-6z"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  merge: '<path d="M6 3v6a6 6 0 0 0 6 6h6"/><path d="m15 12 3 3-3 3"/><path d="M6 21v-6"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
  plug: '<path d="M9 3v5M15 3v5"/><path d="M6 8h12v3a6 6 0 0 1-12 0z"/><path d="M12 17v4"/>',
  shield: '<path d="M12 3 4.5 6v6c0 4.5 3.2 7.8 7.5 9 4.3-1.2 7.5-4.5 7.5-9V6z"/><path d="m9 12 2 2 4-4"/>',
  db: '<ellipse cx="12" cy="6" rx="7.5" ry="3"/><path d="M4.5 6v12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6"/><path d="M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  coins: '<ellipse cx="9" cy="7" rx="6" ry="2.5"/><path d="M3 7v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V7"/><path d="M9 16.2c.9.2 1.9.3 3 .3 3.3 0 6-1.1 6-2.5v-4"/><path d="M15 9.6c1.9.3 3 1 3 1.9"/>',
};
const icon = (name, cls = '') => `<svg viewBox="0 0 24 24" class="${cls}" aria-hidden="true">${ICONS[name] || ''}</svg>`;

/* знак Евы — общий рисунок из shared/05-brand.js */
const brandIcon = (cls = '') => brandMark(cls);


/* ── уведомления ── */
function toast(text, opts = {}) {
  const root = $('#toastRoot');
  if (!root) return;
  const el = document.createElement('div');
  el.className = 'toast' + (opts.error ? ' err' : '');
  const span = document.createElement('span');
  span.textContent = text;
  el.appendChild(span);
  let timer;
  const close = () => { clearTimeout(timer); el.remove(); };
  if (opts.undo) {
    const b = document.createElement('button');
    b.textContent = 'Отменить';
    b.onclick = () => { close(); opts.undo(); };
    el.appendChild(b);
  }
  root.appendChild(el);
  timer = setTimeout(close, opts.undo ? 7000 : 4200);
  while (root.children.length > 3) root.firstChild.remove();
}

/* ── окно ── */
function openModal({title, body, foot = '', wide = false, focus = true, onMount, onClose}) {
  closePops();
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Закрыть">${icon('x')}</button></div>
    <div class="modal-body">${body}</div>
    ${foot ? `<div class="modal-foot">${foot}</div>` : ''}
  </div>`;
  $('#modalRoot').appendChild(back);
  const el = $('.modal', back);
  const key = e => { if (e.key === 'Escape' && !$('.pop')) close(); };
  function close() {
    if (!back.isConnected) return;
    back.remove();
    document.removeEventListener('keydown', key);
    if (onClose) onClose();
    App.renderSoon();
  }
  back.addEventListener('mousedown', e => { if (e.target === back) close(); });
  on(back, 'click', '[data-close]', e => { e.preventDefault(); close(); });
  document.addEventListener('keydown', key);
  if (onMount) onMount(el, close);
  const first = $('input:not([type=checkbox]):not([disabled]), textarea, select', el);
  if (first && focus) setTimeout(() => { if (!el.contains(document.activeElement)) first.focus(); }, 30);
  return {el, close};
}
const modalOpen = () => !!$('#modalRoot .modal-back');

/* ── подтверждение «Да / Нет» рядом с кнопкой (confirm() в артефакте не работает) ── */
function closePops() { $$('.pop').forEach(p => (p._done ? p._done(false) : p.remove())); }
function confirmPop(anchor, {text, yes = 'Да', no = 'Нет', danger = false}) {
  return new Promise(resolve => {
    closePops();
    const pop = document.createElement('div');
    pop.className = 'pop';
    pop.setAttribute('role', 'alertdialog');
    pop.innerHTML = `<p></p><div class="row"><button class="btn sm ${danger ? 'danger solid' : 'primary'}" data-yes></button><button class="btn sm" data-no></button></div>`;
    $('p', pop).textContent = text;
    $('[data-yes]', pop).textContent = yes;
    $('[data-no]', pop).textContent = no;
    document.body.appendChild(pop);
    const r = anchor.getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight;
    let top = r.bottom + 6, left = r.left + r.width / 2 - w / 2;
    if (top + h > window.innerHeight - 8) top = r.top - h - 6;
    left = clamp(left, 8, window.innerWidth - w - 8);
    pop.style.top = (top + window.scrollY) + 'px';
    pop.style.left = (left + window.scrollX) + 'px';
    const done = v => {
      pop.remove();
      document.removeEventListener('mousedown', outside, true);
      document.removeEventListener('keydown', key, true);
      resolve(v);
    };
    pop._done = done;
    const outside = e => { if (!pop.contains(e.target)) done(false); };
    const key = e => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } };
    setTimeout(() => document.addEventListener('mousedown', outside, true), 0);
    document.addEventListener('keydown', key, true);
    $('[data-yes]', pop).onclick = () => done(true);
    $('[data-no]', pop).onclick = () => done(false);
    $('[data-yes]', pop).focus();
  });
}

/* ── выбор из списка рядом с кнопкой (исполнитель на карточке и т. п.) ── */
function pickPop(anchor, items, current) {
  return new Promise(resolve => {
    closePops();
    const pop = document.createElement('div');
    pop.className = 'pop pick';
    pop.setAttribute('role', 'listbox');
    items.forEach(([v, n]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pick-i' + (String(v) === String(current) ? ' on' : '');
      b.textContent = n;
      b.onclick = () => done(v);
      pop.appendChild(b);
    });
    document.body.appendChild(pop);
    const r = anchor.getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight;
    let top = r.bottom + 4, left = r.right - w;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 4);
    left = clamp(left, 8, window.innerWidth - w - 8);
    pop.style.top = (top + window.scrollY) + 'px';
    pop.style.left = (left + window.scrollX) + 'px';
    function done(v) {
      pop.remove();
      document.removeEventListener('mousedown', outside, true);
      document.removeEventListener('keydown', key, true);
      resolve(v);
    }
    pop._done = () => done(null);
    const outside = e => { if (!pop.contains(e.target)) done(null); };
    const key = e => { if (e.key === 'Escape') { e.stopPropagation(); done(null); } };
    setTimeout(() => document.addEventListener('mousedown', outside, true), 0);
    document.addEventListener('keydown', key, true);
    const on = $('.pick-i.on', pop) || $('.pick-i', pop);
    if (on) on.focus();
  });
}

/* ── подсказка «как пользоваться» на странице: скрывается и возвращается ── */
function helpBox(key, html) {
  const hidden = Local.get('eva-crm2-help', {})[key];
  return `<div class="help" data-help="${key}" ${hidden ? 'hidden' : ''}>${icon('help', 'help-ico')}<div>${html}</div>
    <button class="btn xs ghost x" data-help-hide="${key}">Понятно</button></div>`;
}
const helpBtn = key => `<button class="btn ghost sm" data-help-show="${key}" title="Как пользоваться">${icon('help')}Как пользоваться</button>`;
function wireHelp(root) {
  on(root, 'click', '[data-help-hide]', (e, el) => {
    const m = Local.get('eva-crm2-help', {}); m[el.dataset.helpHide] = 1; Local.set('eva-crm2-help', m);
    const box = $(`[data-help="${el.dataset.helpHide}"]`, root); if (box) box.hidden = true;
  });
  on(root, 'click', '[data-help-show]', (e, el) => {
    const m = Local.get('eva-crm2-help', {}); delete m[el.dataset.helpShow]; Local.set('eva-crm2-help', m);
    const box = $(`[data-help="${el.dataset.helpShow}"]`, root);
    if (box) { box.hidden = !box.hidden; if (!box.hidden) box.scrollIntoView({block: 'nearest', behavior: 'smooth'}); }
  });
}

/* полоса прогресса: доля и отметка «где должны быть» */
function progress(share, tone = '', mark = null) {
  const w = clamp(share || 0, 0, 1) * 100;
  return `<div class="bar"><i class="${tone}" style="width:${w.toFixed(1)}%"></i>${mark !== null ? `<b style="left:calc(${(clamp(mark, 0, 1) * 100).toFixed(1)}% - 1px)"></b>` : ''}</div>`;
}
const paceTone = (fact, plan) => (!plan ? '' : fact >= plan ? 'good' : fact >= plan * 0.8 ? 'warn' : 'bad');
/* ── CRM: аватар по имени, цвет — по имени же, чтобы человек узнавался ── */
const AV_COLORS = ['#5A50C0', '#AD4C74', '#2C7753', '#8F6B27', '#3D6FA8', '#8A4FA0', '#B0573A', '#4F7A7A'];
function initialsOf(name) {
  const n = String(name || '').replace(/[^\p{L}\s-]/gu, '').trim().split(/\s+/).filter(Boolean);
  return ((n[0] || '?')[0] + (n[1] ? n[1][0] : '')).toUpperCase();
}
function avatar(name, cls = '', color = null) {
  if (!name) return `<span class="av none ${cls}" title="Не назначено">?</span>`;
  const c = color || AV_COLORS[hashStr(name) % AV_COLORS.length];
  return `<span class="av ${cls}" style="background:${c}" title="${esc(name)}">${esc(initialsOf(name))}</span>`;
}

/* ── воронка: горизонтальные полосы с конверсией шага ── */
function funnelBars(rows, {money = false} = {}) {
  const max = Math.max(1, ...rows.map(r => r.n));
  return `<div class="fbars">${rows.map((r, i) => {
    const prev = i ? rows[i - 1].n : null;
    const conv = prev ? r.n / prev : null;
    return `<div class="fbar ${r.won ? 'won' : ''} ${r.lost ? 'lost' : ''}" ${r.href ? `data-go="${esc(r.href)}"` : ''}>
      <span class="fbar-n">${esc(r.name)}</span>
      <span class="fbar-track"><i style="width:${(r.n / max * 100).toFixed(1)}%"></i><b class="num">${fmt(r.n)}</b></span>
      <span class="fbar-c num">${conv === null || r.lost ? (r.sub || '') : pct(conv)}</span>
    </div>`;
  }).join('')}</div>`;
}
/* строки «название — полоса — значение», например источники */
function hbarList(rows, {valFmt = fmt, color = 'var(--link)', sub = null} = {}) {
  const max = Math.max(1, ...rows.map(r => r.v));
  if (!rows.length) return '<p class="note">Пока нет данных.</p>';
  return `<div class="hbl">${rows.map(r => `<div class="hbl-r">
      <span class="hbl-n">${r.dot ? `<i class="dot" style="background:${r.dot}"></i>` : ''}${esc(r.name)}</span>
      <span class="hbl-t"><i style="width:${(r.v / max * 100).toFixed(1)}%;background:${r.color || color}"></i></span>
      <b class="num">${valFmt(r.v)}</b>${sub ? `<small class="num">${sub(r)}</small>` : ''}
    </div>`).join('')}</div>`;
}
/* столбики с накоплением: деньги по месяцам и типам */
const kv = (k, v) => `<div class="kv"><span>${esc(k)}</span><b>${v === '' || v === null || v === undefined ? '<span class="muted">—</span>' : v}</b></div>`;
const opt = (v, n, cur) => `<option value="${esc(v)}" ${String(cur) === String(v) ? 'selected' : ''}>${esc(n)}</option>`;
const opts = (pairs, cur) => pairs.map(([v, n]) => opt(v, n, cur)).join('');
