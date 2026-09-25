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
  funnel: '<path d="M3 4h18l-7 8.5V19l-4 2v-8.5z"/>',
  video: '<rect x="3" y="6" width="12" height="12" rx="2"/><path d="m15 10 6-3v10l-6-3"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
};
const icon = (name, cls = '') => `<svg viewBox="0 0 24 24" class="${cls}" aria-hidden="true">${ICONS[name] || ''}</svg>`;

/* Знак Евы — как иконка приложения Eva Space: золотая звезда с мягким
   свечением на сливовом градиенте и три искры. Рисуем вектором, чтобы
   значок был чётким в меню, на входе и во вкладке браузера. */
let brandSeq = 0;
function brandIcon(cls = '') {
  const n = ++brandSeq, g = 'evg' + n, r = 'evr' + n;
  const spark = (x, y, s) => `<path d="M${x} ${y - s}C${x + s * .18} ${y - s * .18} ${x + s * .18} ${y - s * .18} ${x + s} ${y}C${x + s * .18} ${y + s * .18} ${x + s * .18} ${y + s * .18} ${x} ${y + s}C${x - s * .18} ${y + s * .18} ${x - s * .18} ${y + s * .18} ${x - s} ${y}C${x - s * .18} ${y - s * .18} ${x - s * .18} ${y - s * .18} ${x} ${y - s}Z" fill="#FFF3DA"/>`;
  return `<svg viewBox="0 0 48 48" class="${cls}" aria-hidden="true">
    <defs>
      <linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3B2150"/><stop offset=".55" stop-color="#5E2F66"/><stop offset="1" stop-color="#94527F"/></linearGradient>
      <radialGradient id="${r}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFE3B0" stop-opacity=".55"/><stop offset="1" stop-color="#FFE3B0" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="48" height="48" rx="11" fill="url(#${g})"/>
    <circle cx="23" cy="25" r="15" fill="url(#${r})"/>
    <path d="M23 9C24.1 19.2 26.8 21.9 37 23C26.8 24.1 24.1 26.8 23 37C21.9 26.8 19.2 24.1 9 23C19.2 21.9 21.9 19.2 23 9Z" fill="#F3CD8C"/>
    ${spark(37, 9.5, 2.2)}${spark(9.5, 36, 1.6)}${spark(38, 37, 1.3)}
  </svg>`;
}

/* ── аватар по имени ── */
function initials(p) {
  const n = personName(p).replace(/[^\p{L}\s-]/gu, '').trim().split(/\s+/);
  return ((n[0] || '?')[0] + (n[1] ? n[1][0] : '')).toUpperCase();
}
function avatar(p, cls = '') {
  if (!p) return `<span class="av none ${cls}" title="Не назначено">?</span>`;
  const color = (DIRS[p.dir] || {}).color || '#7A7386';
  const inner = p.photo ? `<img src="${esc(p.photo)}" alt="">` : esc(initials(p));
  return `<span class="av ${cls}" style="background:${color}" title="${esc(personName(p))}">${inner}</span>`;
}
const rolePill = r => `<span class="pill ${ROLES[roleOf(r)].tone}">${ROLES[roleOf(r)].name}</span>`;
const dirPill = d => (DIRS[d] ? `<span class="pill line"><i class="dot" style="background:${DIRS[d].color}"></i>${DIRS[d].name}</span>` : '');

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
  const hidden = Local.get('eva-hq-help', {})[key];
  return `<div class="help" data-help="${key}" ${hidden ? 'hidden' : ''}>${icon('help', 'help-ico')}<div>${html}</div>
    <button class="btn xs ghost x" data-help-hide="${key}">Понятно</button></div>`;
}
const helpBtn = key => `<button class="btn ghost sm" data-help-show="${key}" title="Как пользоваться">${icon('help')}Как пользоваться</button>`;
function wireHelp(root) {
  on(root, 'click', '[data-help-hide]', (e, el) => {
    const m = Local.get('eva-hq-help', {}); m[el.dataset.helpHide] = 1; Local.set('eva-hq-help', m);
    const box = $(`[data-help="${el.dataset.helpHide}"]`, root); if (box) box.hidden = true;
  });
  on(root, 'click', '[data-help-show]', (e, el) => {
    const m = Local.get('eva-hq-help', {}); delete m[el.dataset.helpShow]; Local.set('eva-hq-help', m);
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

/* ── графики ──
   Линии: факт — сплошная розовая с заливкой 10% и точкой на конце;
   планы — пунктир (это прогноз), подписаны у правого края.
   Столбики: не толще 24 px, скругление 4 px сверху. Подсказка по наведению. */
/* ровная шкала: шаг 1-2-2,5-5 × 10ⁿ, для штук — только целые */
function niceScale(v, integer = true, ticks = 4) {
  const raw = Math.max(v, integer ? 1 : 1e-9) / ticks;
  const p = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / p;
  let step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  if (integer) step = Math.max(1, Math.ceil(step));
  const max = Math.max(step, Math.ceil(v / step) * step);
  return {max, step};
}
/* ширина графика в пикселях страницы — чтобы подписи были обычного размера */
const chartWidth = () => clamp((($('#page') || {}).clientWidth || 800) - 44, 300, 1200);
function lineChart({labels, series, height = 240, yFmt = fmt}) {
  const W = chartWidth(), H = height, L = 44, R = W < 520 ? 84 : 118, T = 14, B = 26;
  const n = labels.length;
  const sc = niceScale(Math.max(1, ...series.flatMap(s => s.values.filter(v => v !== null))));
  const maxV = sc.max;
  const x = i => L + (n <= 1 ? 0 : (i / (n - 1)) * (W - L - R));
  const y = v => T + (1 - v / maxV) * (H - T - B);
  let g = '';
  for (let v = 0; v <= maxV + 1e-9; v += sc.step) {
    g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${esc(yFmt(v))}</text>`;
  }
  const step = Math.max(1, Math.ceil(n / 8));
  labels.forEach((lb, i) => { if (lb.tick) g += `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${esc(lb.tick)}</text>`; else if (!labels.some(l => l.tick) && i % step === 0) g += `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${esc(lb.text)}</text>`; });
  let marks = '';
  const ends = [], endsAbove = [];
  series.forEach(s => {
    const pts = s.values.map((v, i) => (v === null ? null : [x(i), y(v)])).filter(Boolean);
    if (!pts.length) return;
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
    if (s.area) marks += `<path d="${d}L${pts[pts.length - 1][0].toFixed(1)} ${y(0)}L${pts[0][0].toFixed(1)} ${y(0)}Z" fill="${s.color}" opacity=".1"/>`;
    marks += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width || 2}" stroke-linecap="round" stroke-linejoin="round" ${s.dash ? 'stroke-dasharray="5 5"' : ''} opacity="${s.opacity || 1}"/>`;
    const last = pts[pts.length - 1];
    if (s.dot) marks += `<circle cx="${last[0]}" cy="${last[1]}" r="5" fill="${s.color}" stroke="var(--surface)" stroke-width="2"/>`;
    if (s.endLabel) (s.labelAbove ? endsAbove : ends).push({y: last[1], x: last[0], text: s.endLabel, above: !!s.labelAbove});
  });
  ends.sort((a, b) => a.y - b.y);
  ends.push(...endsAbove);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;
  ends.forEach(e => { marks += e.above ? `<text x="${e.x}" y="${e.y - 12}" text-anchor="middle" style="fill:var(--ink);font-weight:600">${esc(e.text)}</text>` : `<text x="${e.x + 8}" y="${e.y + 4}" style="fill:var(--ink-2)">${esc(e.text)}</text>`; });
  const legend = series.filter(s => s.legend).map(s => `<span><i class="${s.dash ? 'dash' : ''}" style="background:${s.color};color:${s.color}"></i>${esc(s.legend)}</span>`).join('');
  const data = esc(JSON.stringify({labels: labels.map(l => l.text), series: series.map(s => ({name: s.legend || s.endLabel || '', color: s.color, dash: !!s.dash, values: s.values}))}));
  return `<div class="chart-box" data-chart="line" data-cfg="${data}" data-geo="${[W, H, L, R, T, B].join(',')}">
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${g}<line class="axis" x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}"/>${marks}<line class="cross" x1="0" x2="0" y1="${T}" y2="${y(0)}" hidden/></svg>
    <div class="chart-tip" hidden></div>
  </div>${legend ? `<div class="legend">${legend}</div>` : ''}`;
}
function barChart({labels, values, plan = null, height = 200, color = 'var(--rose)', yFmt = fmt, highlight = -1}) {
  const W = chartWidth(), H = height, L = 40, R = 12, T = 12, B = 26;
  const n = labels.length;
  const sc = niceScale(Math.max(1, ...values.map(v => v || 0), ...(plan || []).map(v => v || 0)));
  const maxV = sc.max;
  const band = (W - L - R) / Math.max(1, n);
  const bw = Math.min(24, Math.max(3, band - 2));
  const y = v => T + (1 - v / maxV) * (H - T - B);
  let g = '';
  for (let v = 0; v <= maxV + 1e-9; v += sc.step) {
    g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${esc(yFmt(v))}</text>`;
  }
  const step = Math.max(1, Math.ceil(n / (W < 520 ? 7 : 12)));
  let marks = '';
  values.forEach((v, i) => {
    const cx = L + band * i + band / 2;
    if (i % step === 0 || i === n - 1) g += `<text x="${cx}" y="${H - 6}" text-anchor="middle">${esc(labels[i].tick ?? labels[i].text)}</text>`;
    const val = v || 0;
    const h = Math.max(0, y(0) - y(val));
    const r = Math.min(4, h / 2, bw / 2);
    const x0 = cx - bw / 2, top = y(0) - h;
    const d = h > 0 ? `M${x0} ${y(0)}V${top + r}Q${x0} ${top} ${x0 + r} ${top}H${x0 + bw - r}Q${x0 + bw} ${top} ${x0 + bw} ${top + r}V${y(0)}Z` : '';
    const tip = `${labels[i].text}|${yFmt(val)}${plan ? '|' + yFmt(plan[i] || 0) : ''}`;
    marks += `<g class="bar-hit" data-tip="${esc(tip)}" tabindex="0"><rect x="${cx - band / 2}" y="${T}" width="${band}" height="${y(0) - T}" fill="transparent"/>${d ? `<path d="${d}" fill="${color}" opacity="${i === highlight || highlight < 0 ? 1 : .55}"/>` : ''}</g>`;
  });
  if (plan) {
    const pts = plan.map((v, i) => `${i ? 'L' : 'M'}${(L + band * i + band / 2).toFixed(1)} ${y(v || 0).toFixed(1)}`).join('');
    marks += `<path d="${pts}" fill="none" stroke="var(--ink-2)" stroke-width="1.5" stroke-dasharray="4 4" pointer-events="none"/>`;
  }
  return `<div class="chart-box" data-chart="bar"><svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${g}<line class="axis" x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}"/>${marks}</svg><div class="chart-tip" hidden></div></div>
    ${plan ? `<div class="legend"><span><i style="background:${color}"></i>Факт</span><span><i class="dash" style="color:var(--ink-2)"></i>План</span></div>` : ''}`;
}
/* подсказки графиков: одна подписка на весь документ */
function wireCharts() {
  const tipAt = (box, html, px, py) => {
    const tip = $('.chart-tip', box);
    tip.innerHTML = html;
    tip.hidden = false;
    const bw = box.clientWidth, tw = tip.offsetWidth;
    tip.style.left = clamp(px + 12, 0, bw - tw) + 'px';
    tip.style.top = Math.max(0, py - tip.offsetHeight - 8) + 'px';
  };
  document.addEventListener('pointermove', e => {
    const box = e.target.closest && e.target.closest('.chart-box');
    $$('.chart-box').forEach(b => { if (b !== box) { const t = $('.chart-tip', b); if (t) t.hidden = true; const c = $('.cross', b); if (c) c.setAttribute('hidden', ''); } });
    if (!box) return;
    const rect = box.getBoundingClientRect();
    if (box.dataset.chart === 'line') {
      const cfg = JSON.parse(box.dataset.cfg);
      const [W, H, L, R, T, B] = box.dataset.geo.split(',').map(Number);
      const sx = (e.clientX - rect.left) * (W / rect.width);
      const n = cfg.labels.length;
      const i = clamp(Math.round(((sx - L) / (W - L - R)) * (n - 1)), 0, n - 1);
      const cx = L + (n <= 1 ? 0 : (i / (n - 1)) * (W - L - R));
      const cross = $('.cross', box);
      cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.removeAttribute('hidden');
      const rows = cfg.series.filter(s => s.values[i] !== null && s.values[i] !== undefined)
        .map(s => `<div class="tip-row"><i class="${s.dash ? 'dash' : ''}" style="background:${s.color};color:${s.color}"></i><b>${fmt(s.values[i])}</b><span>${esc(s.name)}</span></div>`).join('');
      tipAt(box, `<div class="tip-h">${esc(cfg.labels[i])}</div>${rows}`, (cx / W) * rect.width, e.clientY - rect.top);
    } else {
      const hit = e.target.closest('.bar-hit');
      if (!hit) { $('.chart-tip', box).hidden = true; return; }
      const [label, val, plan] = hit.dataset.tip.split('|');
      tipAt(box, `<div class="tip-h">${esc(label)}</div><div class="tip-row"><b>${esc(val)}</b><span>факт</span></div>${plan !== undefined ? `<div class="tip-row"><b>${esc(plan)}</b><span>план</span></div>` : ''}`, e.clientX - rect.left, e.clientY - rect.top);
    }
  });
}