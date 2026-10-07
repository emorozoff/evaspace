/* КРОНА — интерактив и векторные «чертежи».
   Вся графика сайта рисуется здесь: генплан, разрез, питомник, планы проектов,
   аватары команды. Внешних картинок нет — страница лёгкая и не «ломается». */
(() => {
  'use strict';

  /* ---------- утилиты ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const rng = (seed) => () => {               // mulberry32 — повторяемый «случай»
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const f1 = (n) => Math.round(n * 10) / 10;
  const nf = (n, d = 0) => n.toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d });
  const attrs = (o) => Object.entries(o).map(([k, v]) => `${k}="${v}"`).join(' ');
  const tag = (t, o, inner) => inner === undefined ? `<${t} ${attrs(o)}/>` : `<${t} ${attrs(o)}>${inner}</${t}>`;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const C = {
    ink: '#111513', ink2: '#39413C', muted: '#737B75', green: '#1D4634', green2: '#2E6A4E',
    green3: '#8DB59A', lime: '#C9F26B', water: '#6E9BC2', paper: '#F6F5F0', sand: '#E2C892',
  };

  // Контур «облака» (крона, куст) — окружность с волнами
  function blob(cx, cy, r, bumps = 9, amp = 0.12, seed = 1, ry) {
    const R = rng(seed); const ph = R() * 6.28; const pts = [];
    const n = 48; ry = ry || r;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const k = 1 + amp * Math.sin(a * bumps + ph) + amp * 0.4 * Math.sin(a * 3 + ph * 2);
      pts.push([cx + Math.cos(a) * r * k, cy + Math.sin(a) * ry * k]);
    }
    return 'M' + pts.map((p) => p.map(f1).join(',')).join('L') + 'Z';
  }

  // Условные обозначения деревьев в плане
  function treeSym(x, y, r, kind, d) {
    const st = `style="--d:${d}s"`;
    if (kind === 'con') {                        // хвойное — «звезда»
      const pts = [];
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2, rr = i % 2 ? r * 0.7 : r;
        pts.push(f1(x + Math.cos(a) * rr) + ',' + f1(y + Math.sin(a) * rr));
      }
      return `<g class="pop" ${st}><polygon points="${pts.join(' ')}" fill="rgba(29,70,52,.22)" stroke="${C.green}" stroke-width=".8"/><circle cx="${f1(x)}" cy="${f1(y)}" r="1.4" fill="${C.green}"/></g>`;
    }
    if (kind === 'flw') {                        // цветущее — пунктир + лайм
      return `<g class="pop" ${st}><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="rgba(201,242,107,.45)" stroke="${C.green2}" stroke-width=".8" stroke-dasharray="2 2"/><circle cx="${f1(x)}" cy="${f1(y)}" r="1.4" fill="${C.green}"/></g>`;
    }
    let spokes = '';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + x;
      spokes += `M${f1(x + Math.cos(a) * r * 0.2)},${f1(y + Math.sin(a) * r * 0.2)}L${f1(x + Math.cos(a) * r * 0.62)},${f1(y + Math.sin(a) * r * 0.62)}`;
    }
    return `<g class="pop" ${st}><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="rgba(46,106,78,.13)" stroke="${C.green2}" stroke-width=".9"/><path d="${spokes}" stroke="${C.green2}" stroke-width=".6" opacity=".7"/><circle cx="${f1(x)}" cy="${f1(y)}" r="1.5" fill="${C.green}"/></g>`;
  }

  // Общие штриховки для планов
  const PATTERNS = (p) => `
    <pattern id="${p}hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#E9E8E1"/><path d="M0 0V6" stroke="${C.ink}" stroke-width=".7" opacity=".55"/></pattern>
    <pattern id="${p}meadow" width="9" height="9" patternUnits="userSpaceOnUse"><rect width="9" height="9" fill="#E3EBD9"/><circle cx="2" cy="2" r=".8" fill="${C.green2}" opacity=".55"/><circle cx="6.5" cy="6" r=".6" fill="${C.green2}" opacity=".4"/></pattern>
    <pattern id="${p}water" width="14" height="6" patternUnits="userSpaceOnUse"><rect width="14" height="6" fill="#D6E3EC"/><path d="M0 3q3.5-2.4 7 0t7 0" fill="none" stroke="${C.water}" stroke-width=".7"/></pattern>
    <pattern id="${p}tile" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#E9E6DC"/><path d="M8 0V8M0 8H8" stroke="${C.ink}" stroke-width=".35" opacity=".45"/></pattern>
    <pattern id="${p}rubber" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="#E7DEC4"/><circle cx="2.5" cy="2.5" r=".6" fill="${C.ink}" opacity=".35"/></pattern>
    <pattern id="${p}deck" width="40" height="5" patternUnits="userSpaceOnUse"><rect width="40" height="5" fill="#E6D9BF"/><path d="M0 5H40M17 0V5" stroke="${C.ink}" stroke-width=".4" opacity=".5"/></pattern>`;

  /* =====================================================================
     1. ГЕНПЛАН В ПЕРВОМ ЭКРАНЕ
     ===================================================================== */
  function heroPlan() {
    const host = $('#heroPlan');
    if (!host) return;
    const R = rng(11);

    const B = [
      { x: 70, y: 30, w: 480, h: 80, l: 'К1 · 9 эт.' },
      { x: 600, y: 30, w: 140, h: 130, l: 'К2 · 24 эт.' },
      { x: 880, y: 30, w: 90, h: 450, l: 'К3 · 12 эт.' },
      { x: 30, y: 150, w: 90, h: 360, l: 'К4 · 9 эт.' },
      { x: 30, y: 555, w: 360, h: 95, l: 'К5 · 14 эт.' },
      { x: 560, y: 560, w: 330, h: 90, l: 'К6 · 14 эт.' },
    ];
    const PATHS = [
      { d: 'M335,330a165,105 0 1,0 330,0a165,105 0 1,0 -330,0', hw: 9 },
      { d: 'M475,700C476,600 488,480 500,435', hw: 13 },
      { d: 'M500,225C510,170 575,140 575,10', hw: 11 },
      { d: 'M335,330C300,335 280,300 240,292', hw: 8 },
      { d: 'M195,228C170,180 130,135 0,130', hw: 8 },
      { d: 'M665,330C710,330 740,360 760,400', hw: 8 },
      { d: 'M830,470C860,500 900,522 1010,522', hw: 8 },
    ];
    const playground = { x: 225, y: 290, r: 72 };
    const court = { x: 690, y: 398, w: 150, h: 84 };
    const ring = { x: 500, y: 330, rx: 165, ry: 105 };

    let s = `<svg viewBox="-50 -50 1100 780" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Генеральный план благоустройства двора жилого комплекса">
      <defs>${PATTERNS('h-')}
        <radialGradient id="h-glow"><stop offset="0" stop-color="#F6E27A" stop-opacity=".9"/><stop offset=".35" stop-color="#F6E27A" stop-opacity=".35"/><stop offset="1" stop-color="#F6E27A" stop-opacity="0"/></radialGradient>
        <marker id="h-ar" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L6 3L0 6Z" fill="${C.ink}"/></marker>
      </defs>`;

    // Оси и размеры
    const axX = [30, 218, 406, 594, 782, 970], axY = [30, 237, 443, 650];
    s += `<g opacity=".9" font-family="JetBrains Mono, monospace" font-size="10" fill="${C.ink2}">`;
    axX.forEach((x, i) => {
      s += `<line x1="${x}" y1="-28" x2="${x}" y2="690" stroke="${C.ink}" stroke-width=".4" stroke-dasharray="14 3 2 3" opacity=".22"/>`;
      s += `<circle cx="${x}" cy="-36" r="9" fill="${C.paper}" stroke="${C.ink}" stroke-width=".7"/><text x="${x}" y="-32.5" text-anchor="middle">${'АБВГДЕ'[i]}</text>`;
    });
    axY.forEach((y, i) => {
      s += `<line x1="-28" y1="${y}" x2="1000" y2="${y}" stroke="${C.ink}" stroke-width=".4" stroke-dasharray="14 3 2 3" opacity=".22"/>`;
      s += `<circle cx="-36" cy="${y}" r="9" fill="${C.paper}" stroke="${C.ink}" stroke-width=".7"/><text x="-36" y="${y + 3.5}" text-anchor="middle">${i + 1}</text>`;
    });
    // размерная цепочка сверху
    s += `<g stroke="${C.ink}" stroke-width=".6"><line x1="30" y1="-12" x2="970" y2="-12"/>`;
    axX.forEach((x) => { s += `<line x1="${x - 4}" y1="-8" x2="${x + 4}" y2="-16"/>`; });
    s += `</g>`;
    for (let i = 0; i < axX.length - 1; i++) s += `<text x="${(axX[i] + axX[i + 1]) / 2}" y="-16" text-anchor="middle" font-size="9">18 800</text>`;
    s += `<g stroke="${C.ink}" stroke-width=".6"><line x1="-12" y1="30" x2="-12" y2="650"/>`;
    axY.forEach((y) => { s += `<line x1="-16" y1="${y + 4}" x2="-8" y2="${y - 4}"/>`; });
    s += `</g><text transform="translate(-16 340) rotate(-90)" text-anchor="middle" font-size="9">62 000</text></g>`;

    // Зонирование
    s += `<g data-g="zones">
      <circle cx="225" cy="290" r="118" fill="${C.lime}" opacity=".28"/>
      <ellipse cx="500" cy="330" rx="205" ry="135" fill="${C.green3}" opacity=".22"/>
      <rect x="668" y="372" width="196" height="138" rx="18" fill="${C.sand}" opacity=".38"/>
      <circle cx="330" cy="488" r="72" fill="${C.water}" opacity=".16"/>
      <g font-family="JetBrains Mono, monospace" font-size="10" font-weight="500" fill="${C.ink}">
        ${zoneTag(150, 182, 'Z1 · Детская 0–7')}${zoneTag(560, 205, 'Z2 · Тихий отдых')}${zoneTag(700, 362, 'Z3 · Спорт')}${zoneTag(268, 565, 'Z4 · Сообщество')}
      </g></g>`;

    // Мощение (полосы дорожек — контур + покрытие)
    s += `<g data-g="paving">
      <rect x="395" y="545" width="160" height="150" fill="url(#h-tile)" stroke="${C.ink}" stroke-width=".7"/>`;
    PATHS.forEach((p, i) => {
      s += `<path class="draw" pathLength="1" style="--d:${0.2 + i * 0.12}s" d="${p.d}" fill="none" stroke="${C.ink}" stroke-width="${p.hw * 2 + 1.6}" stroke-linecap="butt"/>`;
      s += `<path class="draw pv" data-hw="${p.hw}" pathLength="1" style="--d:${0.25 + i * 0.12}s" d="${p.d}" fill="none" stroke="url(#h-tile)" stroke-width="${p.hw * 2}" stroke-linecap="butt"/>`;
    });
    s += `</g>`;

    // Объекты: луг, площадки, дождевой сад, амфитеатр, пергола
    s += `<g>
      <ellipse cx="500" cy="330" rx="${ring.rx - 10}" ry="${ring.ry - 10}" fill="url(#h-meadow)" stroke="${C.green2}" stroke-width=".7"/>
      <g class="pop" style="--d:.9s"><circle cx="${playground.x}" cy="${playground.y}" r="${playground.r}" fill="url(#h-rubber)" stroke="${C.ink}" stroke-width="1"/>
        <circle cx="${playground.x}" cy="${playground.y}" r="46" fill="none" stroke="${C.ink}" stroke-width=".6" stroke-dasharray="3 3"/>
        <rect x="206" y="268" width="24" height="24" fill="${C.lime}" stroke="${C.ink}" stroke-width=".8"/><rect x="232" y="292" width="18" height="10" fill="${C.paper}" stroke="${C.ink}" stroke-width=".8"/>
        <circle cx="204" cy="318" r="8" fill="${C.paper}" stroke="${C.ink}" stroke-width=".8"/><path d="M238,258l18,-10" stroke="${C.ink}" stroke-width="2"/></g>
      <g class="pop" style="--d:1s" transform="rotate(-6 765 440)"><rect x="${court.x}" y="${court.y}" width="${court.w}" height="${court.h}" fill="#D9E4D0" stroke="${C.ink}" stroke-width="1"/>
        <g fill="none" stroke="#fff" stroke-width="1.4"><rect x="${court.x + 8}" y="${court.y + 8}" width="${court.w - 16}" height="${court.h - 16}"/><line x1="765" y1="${court.y + 8}" x2="765" y2="${court.y + court.h - 8}"/><circle cx="765" cy="440" r="14"/></g></g>
      <path class="pop" style="--d:1.1s" d="M515,455C560,450 620,480 640,520C645,535 620,541 600,533C570,521 530,496 512,470Z" fill="url(#h-water)" stroke="${C.water}" stroke-width="1"/>
      <g fill="none" stroke="${C.ink}" stroke-width=".8">
        <path d="M276,500A54,54 0 0 1 384,500M288,500A42,42 0 0 1 372,500M300,500A30,30 0 0 1 360,500"/>
        <rect x="312" y="500" width="36" height="10" fill="url(#h-deck)"/></g>
      <g><rect x="640" y="520" width="180" height="28" fill="url(#h-deck)" stroke="${C.ink}" stroke-width=".8"/>
        <path d="${Array.from({ length: 17 }, (_, i) => `M${650 + i * 10},516V552`).join('')}" stroke="${C.ink}" stroke-width=".5" opacity=".7"/></g>
    </g>`;

    // Здания
    s += `<g>`;
    B.forEach((b, i) => {
      s += `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="url(#h-hatch)" stroke="${C.ink}" stroke-width="1.6"/>`;
      const tw = b.l.length * 6.3 + 12, cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      const rot = b.h > b.w * 1.6 ? `transform="rotate(-90 ${cx} ${cy})"` : '';
      s += `<g ${rot}><rect x="${cx - tw / 2}" y="${cy - 9}" width="${tw}" height="17" fill="${C.paper}" stroke="${C.ink}" stroke-width=".6"/><text x="${cx}" y="${cy + 3.5}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10" fill="${C.ink}">${b.l}</text></g>`;
    });
    s += `</g>`;

    // Слои, заполняемые после вставки в DOM (нужна геометрия путей)
    s += `<g data-g="dendro" id="h-dendro"></g>`;
    s += `<g data-g="eng" class="off" id="h-eng"></g>`;
    s += `<g data-g="light" class="off" id="h-light"></g>`;
    s += `<g id="h-notes"></g>`;

    // Север и масштаб
    s += `<g transform="translate(1020 0)" font-family="JetBrains Mono, monospace" font-size="10" fill="${C.ink}">
        <circle r="13" fill="none" stroke="${C.ink}" stroke-width=".7"/><path d="M0,-12L5,6L0,2L-5,6Z" fill="${C.ink}"/><text y="-17" text-anchor="middle">С</text></g>
      <g transform="translate(30 702)" font-family="JetBrains Mono, monospace" font-size="9" fill="${C.ink2}">
        <rect width="50" height="5" fill="${C.ink}"/><rect x="50" width="50" height="5" fill="none" stroke="${C.ink}" stroke-width=".7"/><rect x="100" width="100" height="5" fill="${C.ink}"/>
        <text y="18">0</text><text x="50" y="18" text-anchor="middle">5</text><text x="100" y="18" text-anchor="middle">10</text><text x="200" y="18" text-anchor="middle">20 м</text></g>`;
    s += `</svg>`;
    host.innerHTML = s;

    const svg = $('svg', host);
    // Точки вдоль дорожек — чтобы деревья не попадали на мощение
    const pv = $$('.pv', svg).map((p) => {
      const L = p.getTotalLength(), pts = [];
      for (let l = 0; l <= L; l += 6) { const q = p.getPointAtLength(l); pts.push([q.x, q.y]); }
      return { el: p, L, hw: +p.dataset.hw, pts };
    });
    const inRect = (x, y, rx, ry, rw, rh, m = 0) => x > rx - m && x < rx + rw + m && y > ry - m && y < ry + rh + m;
    const free = (x, y, r) => {
      if (B.some((b) => inRect(x, y, b.x, b.y, b.w, b.h, r + 6))) return false;
      if (((x - ring.x) / (ring.rx + r + 10)) ** 2 + ((y - ring.y) / (ring.ry + r + 10)) ** 2 < 1) return false;
      if (Math.hypot(x - playground.x, y - playground.y) < playground.r + r + 8) return false;
      if (inRect(x, y, 678, 380, 175, 115, r)) return false;              // корт
      if (inRect(x, y, 505, 445, 145, 100, r)) return false;              // дождевой сад
      if (inRect(x, y, 270, 440, 120, 75, r)) return false;               // амфитеатр
      if (inRect(x, y, 635, 512, 190, 42, r)) return false;               // пергола
      if (inRect(x, y, 395, 545, 160, 160, r)) return false;              // входная площадь
      for (const p of pv) for (const q of p.pts) if (Math.hypot(x - q[0], y - q[1]) < p.hw + r * 0.75 + 3) return false;
      return true;
    };

    // Дендроплан
    const trees = [
      { x: 450, y: 312, r: 24, k: 'dec' }, { x: 566, y: 350, r: 19, k: 'dec' }, { x: 530, y: 282, r: 13, k: 'flw' },
    ];
    for (let a = 0; a < 6000 && trees.length < 95; a++) {
      const x = 135 + R() * 760, y = 118 + R() * 430;
      const roll = R();
      const k = roll < 0.68 ? 'dec' : roll < 0.88 ? 'con' : 'flw';
      const r = k === 'dec' ? 10 + R() * 8 : k === 'con' ? 8 + R() * 4 : 8 + R() * 3;
      if (x > 868 && y < 480) continue;
      if (!free(x, y, r)) continue;
      if (trees.some((t) => Math.hypot(t.x - x, t.y - y) < (t.r + r) * 0.92)) continue;
      trees.push({ x, y, r, k });
    }
    const shrubs = [];
    for (let a = 0; a < 5000 && shrubs.length < 46; a++) {
      const x = 130 + R() * 750, y = 115 + R() * 435, r = 6 + R() * 6;
      if (!free(x, y, r)) continue;
      if (trees.some((t) => Math.hypot(t.x - x, t.y - y) < t.r + r * 0.6)) continue;
      if (shrubs.some((t) => Math.hypot(t.x - x, t.y - y) < (t.r + r) * 0.9)) continue;
      shrubs.push({ x, y, r });
    }
    let dh = '';
    shrubs.forEach((b, i) => {
      dh += `<path class="pop" style="--d:${1.2 + (b.y / 700) * 1.2}s" d="${blob(b.x, b.y, b.r, 7, 0.14, i + 3)}" fill="rgba(141,181,154,.42)" stroke="${C.green2}" stroke-width=".6"/>`;
    });
    trees.forEach((t) => {
      const d = 0.9 + (Math.hypot(t.x - 475, t.y - 680) / 900) * 1.6;
      dh += treeSym(t.x, t.y, t.r, t.k, f1(d));
    });
    $('#h-dendro', svg).innerHTML = dh;
    const tc = $('#treeCount'); if (tc) tc.textContent = trees.length + ' шт';

    // Освещение — опоры вдоль дорожек
    let lh = '';
    pv.forEach((p, pi) => {
      for (let l = 20, side = 1; l < p.L - 10; l += 58, side *= -1) {
        const a = p.el.getPointAtLength(l), b = p.el.getPointAtLength(Math.min(l + 1, p.L));
        const dx = b.x - a.x, dy = b.y - a.y, n = Math.hypot(dx, dy) || 1;
        const x = a.x - (dy / n) * (p.hw + 6) * side, y = a.y + (dx / n) * (p.hw + 6) * side;
        if (B.some((bb) => inRect(x, y, bb.x, bb.y, bb.w, bb.h, 2))) continue;
        lh += `<circle class="glow" style="--d:${f1((pi + l) % 3)}s" cx="${f1(x)}" cy="${f1(y)}" r="26" fill="url(#h-glow)"/>`;
        lh += `<circle cx="${f1(x)}" cy="${f1(y)}" r="2.6" fill="${C.ink}"/><circle cx="${f1(x)}" cy="${f1(y)}" r="4.5" fill="none" stroke="${C.ink}" stroke-width=".6"/>`;
      }
    });
    $('#h-light', svg).innerHTML = lh;

    // Инженерия: ливнёвка и полив
    const mh = [[140, 535], [475, 535], [600, 535], [865, 535], [475, 668], [140, 140], [865, 140]];
    let eh = `<g fill="none" stroke="${C.water}" stroke-width="2.2"><path class="flow" d="M140,140V535H865V140M475,535V700M600,535V505"/></g>
      <g fill="none" stroke="${C.green}" stroke-width="1.2" stroke-dasharray="8 3 2 3"><path d="M752,178H700V260H620M360,330H640M500,250V410"/></g>
      <rect x="742" y="168" width="26" height="18" fill="${C.paper}" stroke="${C.green}" stroke-width="1"/><text x="755" y="181" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="9" fill="${C.green}">УП</text>`;
    mh.forEach(([x, y]) => { eh += `<g stroke="${C.water}" stroke-width="1"><circle cx="${x}" cy="${y}" r="6" fill="${C.paper}"/><path d="M${x - 4},${y}H${x + 4}M${x},${y - 4}V${y + 4}"/></g>`; });
    [380, 440, 500, 560, 620].forEach((x) => { eh += `<circle cx="${x}" cy="330" r="22" fill="rgba(110,155,194,.12)" stroke="${C.water}" stroke-width=".6" stroke-dasharray="2 2"/><circle cx="${x}" cy="330" r="2.4" fill="${C.green}"/>`; });
    eh += noteLabel(150, 548, 'К1 · ливнёвка Ø200', C.water) + noteLabel(372, 356, 'В1 · полив ПЭ 32', C.green);
    $('#h-eng', svg).innerHTML = eh;

    // Выноски
    $('#h-notes', svg).innerHTML =
      callout(450, 312, 300, 180, 'Д1 · Tilia cordata · ств. 12–14 см') +
      callout(600, 505, 640, 606, 'Дождевой сад · 240 м² · биодренаж') +
      callout(225, 250, 140, 420, 'Детская 3–7 лет · резина 40 мм') +
      callout(800, 420, 760, 300, 'Мультикорт 26×15 м');

    // Анимация прорисовки + координаты под курсором
    requestAnimationFrame(() => svg.classList.add('drawn'));
    const xy = $('#xy');
    svg.addEventListener('pointermove', (e) => {
      const m = svg.getScreenCTM(); if (!m) return;
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
      xy.textContent = `X ${nf(Math.max(0, (p.x - 30) / 10), 1).padStart(5, '0')} · Y ${nf(Math.max(0, (p.y - 30) / 10), 1).padStart(5, '0')} м`;
    });
    svg.addEventListener('pointerleave', () => { xy.textContent = 'X 000.0 · Y 000.0'; });

    // Переключатели слоёв
    $$('.layer').forEach((b) => b.addEventListener('click', () => {
      b.classList.toggle('on');
      const g = $(`[data-g="${b.dataset.layer}"]`, svg);
      if (g) g.classList.toggle('off', !b.classList.contains('on'));
    }));
  }

  function zoneTag(x, y, t) {
    const w = t.length * 6.3 + 12;
    return `<rect x="${x}" y="${y}" width="${w}" height="16" fill="${C.paper}" stroke="${C.ink}" stroke-width=".6"/><text x="${x + 6}" y="${y + 11.5}">${t}</text>`;
  }
  function noteLabel(x, y, t, col) {
    const w = t.length * 6 + 10;
    return `<rect x="${x}" y="${y}" width="${w}" height="15" fill="${C.paper}" stroke="${col}" stroke-width=".6"/><text x="${x + 5}" y="${y + 10.5}" font-family="JetBrains Mono, monospace" font-size="9.5" fill="${col}">${t}</text>`;
  }
  function callout(x1, y1, x2, y2, t) {
    const w = t.length * 6.2 + 14;
    return `<g font-family="JetBrains Mono, monospace" font-size="10" fill="${C.ink}">
      <path d="M${x1},${y1}L${x2},${y2}H${x2 + w}" fill="none" stroke="${C.ink}" stroke-width=".8"/>
      <circle cx="${x1}" cy="${y1}" r="3" fill="${C.lime}" stroke="${C.ink}" stroke-width=".8"/>
      <rect x="${x2}" y="${y2 - 17}" width="${w}" height="17" fill="${C.paper}" stroke="${C.ink}" stroke-width=".6"/>
      <text x="${x2 + 7}" y="${y2 - 5}">${t}</text></g>`;
  }

  /* =====================================================================
     2. РАЗРЕЗ 1–1
     ===================================================================== */
  const SD_MARKS = [
    [150, 300, 'Покрытие: плитка 80 мм, ЦПС 40 мм, щебень 200 мм, геотекстиль'],
    [330, 372, 'Структурный грунт с ячеистой системой — 18 м³ для корней под мощением'],
    [458, 316, 'Ком 1,2×0,7 м — крупномер из питомника КРОНА, 3 года акклиматизации'],
    [488, 62, 'Липа мелколистная h 7–8 м — тень и «взрослый» двор с первого дня'],
    [688, 352, 'Дождевой сад: биофильтр 600 мм, принимает сток с 1 200 м² покрытий'],
    [790, 368, 'Перфорированный дренаж Ø110 в щебёночной обсыпке'],
    [945, 214, 'Луг из злаков и многолетников: 2 полива за сезон вместо 40 у газона'],
    [1112, 282, 'Резиновое покрытие 40 мм — безопасность при падении с высоты до 1,5 м'],
  ];
  function sectionDrawing() {
    const host = $('#sectionDrawing');
    if (!host) return;
    const G = 270;
    const tuft = (x, y, h, n, seed) => {
      const R = rng(seed); let d = '';
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.22 + (R() - 0.5) * 0.1;
        const hh = h * (0.7 + R() * 0.4);
        d += `M${x},${y}Q${f1(x + Math.cos(a) * hh * 0.4)},${f1(y + Math.sin(a) * hh * 0.6)} ${f1(x + Math.cos(a) * hh)},${f1(y + Math.sin(a) * hh)}`;
      }
      return d;
    };
    let s = `<svg viewBox="0 0 1200 440" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Разрез типового решения двора">
      <defs>${PATTERNS('s-')}
        <pattern id="s-earth" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="2" cy="3" r=".7" fill="${C.ink}" opacity=".25"/><circle cx="7" cy="8" r=".5" fill="${C.ink}" opacity=".2"/></pattern>
        <pattern id="s-soil" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="#E2DACB"/><circle cx="1" cy="1" r=".55" fill="${C.ink}" opacity=".45"/></pattern>
        <pattern id="s-gravel" width="9" height="7" patternUnits="userSpaceOnUse"><rect width="9" height="7" fill="#ECEAE2"/><circle cx="2.5" cy="2.5" r="1.7" fill="none" stroke="${C.ink}" stroke-width=".45"/><circle cx="7" cy="5" r="1.3" fill="none" stroke="${C.ink}" stroke-width=".45"/></pattern>
        <pattern id="s-cells" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" fill="#E4DCC8"/><path d="M0 0H14V14" fill="none" stroke="${C.green2}" stroke-width=".8"/><circle cx="7" cy="7" r=".8" fill="${C.ink}" opacity=".4"/></pattern>
        <pattern id="s-root" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="#D9CBB0"/><path d="M0 5L5 0M0 0L5 5" stroke="${C.ink}" stroke-width=".35" opacity=".6"/></pattern>
        <pattern id="s-dense" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="#DAD8D0"/><path d="M0 0V4" stroke="${C.ink}" stroke-width=".8" opacity=".6"/></pattern>
        <clipPath id="s-rgclip"><path d="M640,${G}L660,${G}C690,${G} 700,330 755,330C810,330 820,${G} 850,${G}L860,${G}V440H640Z"/></clipPath>
      </defs>
      <rect x="0" y="${G}" width="1200" height="170" fill="url(#s-earth)"/>`;

    // Дом
    s += `<rect x="0" y="0" width="90" height="${G}" fill="#ECEBE4" stroke="${C.ink}" stroke-width="1.4"/>`;
    for (let y = 22; y < G; y += 34) s += `<line x1="0" y1="${y}" x2="90" y2="${y}" stroke="${C.ink}" stroke-width=".5" opacity=".5"/><rect x="22" y="${y + 8}" width="46" height="18" fill="#DCE6EE" stroke="${C.ink}" stroke-width=".6"/>`;
    s += `<rect x="0" y="${G}" width="100" height="140" fill="url(#s-dense)" stroke="${C.ink}" stroke-width="1"/>`;

    // Пирог мощения
    s += `<rect x="100" y="${G}" width="540" height="8" fill="url(#s-tile)" stroke="${C.ink}" stroke-width=".8"/>
      <rect x="100" y="${G + 8}" width="540" height="10" fill="url(#s-soil)"/>
      <rect x="100" y="${G + 18}" width="540" height="30" fill="url(#s-gravel)"/>
      <line x1="100" y1="${G + 49}" x2="640" y2="${G + 49}" stroke="${C.ink}" stroke-width=".8" stroke-dasharray="5 3"/>
      <rect x="300" y="${G + 8}" width="200" height="118" fill="url(#s-cells)" stroke="${C.green2}" stroke-width="1" stroke-dasharray="4 3"/>
      <ellipse cx="400" cy="318" rx="56" ry="34" fill="url(#s-root)" stroke="${C.ink}" stroke-width="1"/>
      <path d="M380,330q-20,30 -50,40M420,332q25,26 55,30M400,350v40M370,312q-30,8 -60,4M430,310q30,4 58,-4" fill="none" stroke="${C.ink}" stroke-width=".7" opacity=".7"/>
      <rect x="350" y="${G - 4}" width="100" height="5" fill="${C.ink}"/>`;

    // Дерево
    s += `<path d="${blob(400, 92, 112, 11, 0.07, 4, 78)}" fill="rgba(46,106,78,.13)" stroke="${C.green2}" stroke-width="1.1"/>
      <path d="${blob(372, 104, 58, 8, 0.1, 9, 44)}" fill="none" stroke="${C.green2}" stroke-width=".6" opacity=".7"/>
      <path d="${blob(440, 78, 50, 8, 0.1, 12, 36)}" fill="none" stroke="${C.green2}" stroke-width=".6" opacity=".7"/>
      <path d="M395,${G}L396,150M405,${G}L404,150" stroke="${C.ink}" stroke-width="1.2"/>
      <path d="M396,180C380,150 360,130 340,108M404,165C420,140 440,118 462,96M400,150C398,120 400,80 402,40M398,140C385,120 380,96 372,70" fill="none" stroke="${C.ink}" stroke-width="1"/>
      <path d="M398,200L338,${G}M402,200L462,${G}" stroke="${C.ink}" stroke-width=".6" stroke-dasharray="3 2"/>
      <g stroke="${C.ink}" stroke-width=".7"><line x1="526" y1="${G}" x2="526" y2="14"/><line x1="520" y1="${G + 6}" x2="532" y2="${G - 6}"/><line x1="520" y1="20" x2="532" y2="8"/></g>
      <text transform="translate(520 150) rotate(-90)" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="${C.ink}">8 000</text>`;

    // Скамья и масштабная фигура
    s += `<g fill="none" stroke="${C.ink}" stroke-width="1.2"><path d="M555,250H612M560,250V${G}M607,250V${G}M555,250L552,228"/></g>
      <g fill="none" stroke="${C.ink}" stroke-width="1.1"><circle cx="632" cy="190" r="7"/><path d="M632,198V232M632,206L620,226M632,206L644,224M632,232L624,${G}M632,232L640,${G}"/></g>`;

    // Дождевой сад
    s += `<g clip-path="url(#s-rgclip)"><rect x="640" y="${G}" width="220" height="170" fill="url(#s-soil)"/>
        <rect x="640" y="312" width="220" height="22" fill="${C.water}" opacity=".35"/>
        <path d="M640,318q8,-3 16,0t16,0t16,0t16,0t16,0t16,0t16,0t16,0t16,0t16,0t16,0t16,0t16,0t16,0" fill="none" stroke="${C.water}" stroke-width="1"/>
        <rect x="690" y="345" width="130" height="36" fill="url(#s-gravel)" stroke="${C.ink}" stroke-width=".6"/></g>
      <path d="M640,${G}L660,${G}C690,${G} 700,330 755,330C810,330 820,${G} 850,${G}L860,${G}" fill="none" stroke="${C.ink}" stroke-width="1.4"/>
      <circle cx="755" cy="364" r="10" fill="${C.paper}" stroke="${C.water}" stroke-width="1.6"/>
      <path d="M749,364h12M755,358v12" stroke="${C.water}" stroke-width=".8"/>`;
    [[676, 284], [700, 306], [728, 325], [760, 330], [790, 322], [818, 296], [840, 276]].forEach(([x, y], i) => {
      s += `<path d="${tuft(x, y, 34 + (i % 3) * 8, 7, i + 20)}" fill="none" stroke="${C.green2}" stroke-width=".9"/>`;
    });

    // Луг
    s += `<rect x="860" y="${G}" width="170" height="30" fill="url(#s-soil)"/>`;
    for (let x = 866, i = 0; x < 1026; x += 11, i++) {
      s += `<path d="${tuft(x, G, 40 + (i * 37) % 34, 5, i + 50)}" fill="none" stroke="${C.green2}" stroke-width=".8"/>`;
      if (i % 3 === 0) s += `<circle cx="${x + 3}" cy="${G - 52 - (i * 13) % 18}" r="3" fill="${i % 2 ? C.lime : '#E5A9C0'}" stroke="${C.ink}" stroke-width=".5"/>`;
    }

    // Детская площадка
    s += `<rect x="1030" y="${G - 8}" width="170" height="8" fill="url(#s-rubber)" stroke="${C.ink}" stroke-width=".9"/>
      <rect x="1030" y="${G}" width="170" height="26" fill="url(#s-gravel)"/>
      <g fill="none" stroke="${C.ink}" stroke-width="1.6"><path d="M1060,${G - 8}L1090,140L1120,${G - 8}M1090,140H1185M1185,140V${G - 8}"/></g>
      <g fill="none" stroke="${C.ink}" stroke-width=".8"><path d="M1140,140V222M1160,140V222"/><rect x="1136" y="222" width="28" height="5" fill="${C.lime}"/></g>`;
    s += `<line x1="0" y1="${G}" x2="1200" y2="${G}" stroke="${C.ink}" stroke-width=".5" opacity=".4"/>`;

    // Отметки уровней
    const lvl = (x, y, t, left) => `<g font-family="JetBrains Mono, monospace" font-size="10" fill="${C.ink}"><path d="M${x - 6},${y - 10}H${x + 6}L${x},${y}Z" fill="none" stroke="${C.ink}" stroke-width=".8"/><line x1="${x}" y1="${y - 10}" x2="${left ? x - 46 : x + 46}" y2="${y - 10}" stroke="${C.ink}" stroke-width=".6"/><text x="${left ? x - 8 : x + 8}" y="${y - 14}" text-anchor="${left ? 'end' : 'start'}">${t}</text></g>`;
    s += lvl(196, G, '±0.000') + lvl(755, 330, '−0.600', true) + lvl(1192, G - 8, '+0.040', true);

    // Маркеры
    SD_MARKS.forEach(([x, y], i) => {
      s += `<g class="sd-mark" data-i="${i}"><circle cx="${x}" cy="${y}" r="11" fill="${C.paper}" stroke="${C.ink}" stroke-width="1"/><text x="${x}" y="${y + 3.6}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10.5" font-weight="500" fill="${C.ink}">${i + 1}</text></g>`;
    });
    s += `</svg>`;
    host.innerHTML = s;

    const legend = $('#sdLegend');
    legend.innerHTML = SD_MARKS.map((m, i) => `<li data-i="${i}"><b>${i + 1}</b><span>${m[2]}</span></li>`).join('');
    const hot = (i, on) => { $$(`[data-i="${i}"]`, host.parentNode).forEach((e) => e.classList.toggle('hot', on)); };
    $$('.sd-mark, #sdLegend li', host.parentNode).forEach((e) => {
      e.addEventListener('pointerenter', () => hot(e.dataset.i, true));
      e.addEventListener('pointerleave', () => hot(e.dataset.i, false));
    });
  }

  /* =====================================================================
     3. ПИТОМНИК
     ===================================================================== */
  const SECTORS = [
    { id: 'A1', x: 30, y: 30, w: 120, h: 155, k: 'dec', t: 'Липа мелколистная', n: '1 840 шт · ств. 10–16 см' },
    { id: 'A2', x: 160, y: 30, w: 125, h: 155, k: 'dec2', t: 'Клён, ясень, дуб', n: '2 260 шт · ств. 8–14 см' },
    { id: 'B1', x: 315, y: 30, w: 125, h: 155, k: 'con', t: 'Сосна, ель, лиственница', n: '1 520 шт · h 2–6 м' },
    { id: 'B2', x: 450, y: 30, w: 120, h: 155, k: 'flw', t: 'Плодовые декоративные', n: '980 шт · ств. 6–10 см' },
    { id: 'C1', x: 30, y: 215, w: 120, h: 155, k: 'shr', t: 'Дёрен, пузыреплодник, сирень', n: '14 600 шт · C5–C15' },
    { id: 'C2', x: 160, y: 215, w: 125, h: 155, k: 'shr2', t: 'Спирея, барбарис, кизильник', n: '21 300 шт · C3–C7' },
    { id: 'D1', x: 315, y: 215, w: 125, h: 155, k: 'gh', t: 'Теплицы: многолетники и злаки', n: '25 500 шт · P9–C3' },
    { id: 'D2', x: 450, y: 215, w: 120, h: 155, k: 'pond', t: 'Пруд-накопитель полива', n: '2 400 м³ · капельный полив' },
  ];
  function nurseryPlan() {
    const host = $('#nurseryPlan');
    if (!host) return;
    const L = 'rgba(238,243,236,.55)', LL = 'rgba(238,243,236,.3)';
    let s = `<svg viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Схема собственного питомника">
      <path d="M0,200H600M300,0V400" stroke="rgba(238,243,236,.18)" stroke-width="18"/>
      <path d="M0,200H600M300,0V400" stroke="${LL}" stroke-width="1" stroke-dasharray="10 8"/>`;
    SECTORS.forEach((c) => {
      let g = `<rect class="bg" x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" fill="rgba(238,243,236,.03)" stroke="${LL}" stroke-width="1"/>`;
      const R = rng(c.id.charCodeAt(0) * 7 + +c.id[1]);
      const ix = c.x + 10, iy = c.y + 26, iw = c.w - 20, ih = c.h - 34;
      if (c.k === 'dec' || c.k === 'dec2' || c.k === 'flw') {
        const st = c.k === 'dec' ? 19 : c.k === 'dec2' ? 16 : 17;
        for (let y = iy + st / 2; y < iy + ih; y += st) for (let x = ix + st / 2; x < ix + iw; x += st) {
          const r = st * (0.3 + R() * 0.12);
          g += c.k === 'flw'
            ? `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="rgba(201,242,107,.35)" stroke="${C.lime}" stroke-width=".6" stroke-dasharray="1.5 1.5"/>`
            : `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="rgba(238,243,236,.08)" stroke="${L}" stroke-width=".7"/><circle cx="${f1(x)}" cy="${f1(y)}" r="1" fill="${L}"/>`;
        }
      } else if (c.k === 'con') {
        for (let y = iy + 9; y < iy + ih; y += 17) for (let x = ix + 8 + ((y / 17) % 2) * 6; x < ix + iw; x += 15) {
          const h = 5 + R() * 2.5;
          g += `<path d="M${f1(x)},${f1(y - h)}L${f1(x + h * 0.8)},${f1(y + h * 0.7)}H${f1(x - h * 0.8)}Z" fill="rgba(238,243,236,.12)" stroke="${L}" stroke-width=".7"/>`;
        }
      } else if (c.k === 'shr' || c.k === 'shr2') {
        const st = c.k === 'shr' ? 9 : 7;
        for (let y = iy + 4; y < iy + ih; y += st) for (let x = ix + 4; x < ix + iw; x += st) {
          g += `<circle cx="${f1(x + (R() - 0.5) * 1.5)}" cy="${f1(y)}" r="${f1(st * 0.3)}" fill="${L}" opacity="${f1(0.4 + R() * 0.5)}"/>`;
        }
      } else if (c.k === 'gh') {
        for (let i = 0; i < 4; i++) {
          const y = iy + 2 + i * (ih / 4);
          g += `<rect x="${ix}" y="${f1(y)}" width="${iw}" height="${f1(ih / 4 - 7)}" fill="rgba(238,243,236,.06)" stroke="${L}" stroke-width=".7"/>`;
          for (let x = ix + 6; x < ix + iw; x += 8) g += `<line x1="${x}" y1="${f1(y)}" x2="${x}" y2="${f1(y + ih / 4 - 7)}" stroke="${LL}" stroke-width=".5"/>`;
        }
      } else if (c.k === 'pond') {
        g += `<path d="${blob(c.x + c.w / 2, c.y + 88, 44, 5, 0.1, 3, 40)}" fill="rgba(110,155,194,.35)" stroke="#9CC0DD" stroke-width="1"/>`;
        for (let i = 0; i < 4; i++) g += `<path d="M${c.x + 34 + i * 4},${c.y + 74 + i * 9}q6,-3 12,0t12,0t12,0" fill="none" stroke="#BCD6EA" stroke-width=".7"/>`;
      }
      g += `<text x="${c.x + 8}" y="${c.y + 16}" font-family="JetBrains Mono, monospace" font-size="11" font-weight="500" fill="${C.lime}">${c.id}</text>`;
      s += `<g class="np-sector" data-id="${c.id}" tabindex="0">${g}</g>`;
    });
    s += `<g font-family="JetBrains Mono, monospace" font-size="9" fill="rgba(238,243,236,.6)"><text x="580" y="196" text-anchor="end">ДОРОГА · 6 М</text>
      <g transform="translate(578 384)"><circle r="9" fill="none" stroke="${LL}"/><path d="M0,-8L3.5,4L0,1.5L-3.5,4Z" fill="${C.lime}"/></g></g></svg>`;
    host.innerHTML = s;

    const info = $('#npInfo');
    const pick = (g) => {
      $$('.np-sector', host).forEach((x) => x.classList.toggle('on', x === g));
      const c = SECTORS.find((x) => x.id === g.dataset.id);
      info.textContent = `${c.id} · ${c.t} · ${c.n}`;
    };
    $$('.np-sector', host).forEach((g) => {
      g.addEventListener('pointerenter', () => pick(g));
      g.addEventListener('click', () => pick(g));
      g.addEventListener('focus', () => pick(g));
    });
    pick($('.np-sector', host));
  }

  /* ---------- сравнение цен ---------- */
  const PRICES = [
    ['Липа мелколистная', 'ств. 12–14 см, ком 1,2×0,7', 48000, 31200],
    ['Клён остролистный «Globosum»', 'ств. 10–12 см', 42000, 27500],
    ['Сосна обыкновенная', 'h 4–5 м, ком 1,5×0,8', 65000, 42300],
    ['Яблоня декоративная ‘Royalty’', 'ств. 8–10 см', 26000, 17200],
    ['Дёрен белый ‘Sibirica’', 'C7, h 0,8–1,0 м', 1650, 1080],
    ['Многолетники и злаки', 'P9–C2, микс', 420, 275],
  ];
  function priceRows() {
    const host = $('#priceRows');
    if (!host) return;
    host.innerHTML = PRICES.map(([n, p, m, o]) => `
      <div class="prow">
        <div class="prow__name">${n}<small>${p}</small></div>
        <div class="prow__bars">
          <div class="prow__bar m"><i data-w="76"></i>${nf(m)} ₽</div>
          <div class="prow__bar o"><i data-w="${f1(76 * o / m)}"></i>${nf(o)} ₽</div>
        </div>
        <div class="prow__save">−${Math.round((1 - o / m) * 100)}%</div>
      </div>`).join('');
  }

  /* =====================================================================
     4. ПРОЕКТЫ
     ===================================================================== */
  const PROJECTS = [
    { type: 'court', f: 'zhk', tag: 'ЖК', code: 'П-24-117', t: 'Двор-парк ЖК бизнес-класса', d: 'Двор без машин на стилобате и грунте, 4 сценария досуга, дождевые сады вдоль главной аллеи.', m: [['2,9 га', 'площадь'], ['214', 'деревьев'], ['2025', 'сдача']] },
    { type: 'roof', f: 'zhk', tag: 'ЖК · кровля', code: 'П-25-031', t: 'Сад на стилобате ЖК премиум-класса', d: 'Эксплуатируемая кровля над паркингом: деревья в кадках до 6 м, деки, приватные патио.', m: [['0,6 га', 'площадь'], ['1,2 м', 'грунта'], ['2025', 'сдача']] },
    { type: 'park', f: 'pub', tag: 'Город', code: 'П-23-064', t: 'Городской парк у воды', d: 'Реконструкция заброшенной территории: пруд, луга, тропы, площадки для всех возрастов.', m: [['12 га', 'площадь'], ['1 860', 'деревьев'], ['2024', 'сдача']] },
    { type: 'embank', f: 'pub', tag: 'Город', code: 'П-24-009', t: 'Набережная и прогулочный маршрут', d: 'Многоуровневая набережная с понтонами, амфитеатром и аллеей из крупномеров.', m: [['1,8 км', 'длина'], ['540', 'деревьев'], ['2024', 'сдача']] },
    { type: 'school', f: 'infra', tag: 'Инфраструктура', code: 'П-25-078', t: 'Территория школы на 1 100 мест', d: 'Стадион, учебные огороды, тихие дворики и безопасные маршруты от остановок.', m: [['3,4 га', 'площадь'], ['310', 'деревьев'], ['2025', 'сдача']] },
    { type: 'boulevard', f: 'infra', tag: 'Инфраструктура', code: 'П-26-012', t: 'Бульвар у транспортного узла', d: 'Двухрядная аллея, велодорожка, биодренаж вдоль проезжей части, площадь у входа в метро.', m: [['960 м', 'длина'], ['286', 'деревьев'], ['2026', 'сдача']] },
  ];
  function projPlan(type, seed) {
    const R = rng(seed);
    const p = `p${seed}-`;
    let s = `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><defs>${PATTERNS(p)}</defs><rect width="400" height="300" fill="#F6F5F0"/>`;
    const grid = `<path d="${Array.from({ length: 9 }, (_, i) => `M${i * 50},0V300`).join('')}${Array.from({ length: 7 }, (_, i) => `M0,${i * 50}H400`).join('')}" stroke="${C.ink}" stroke-width=".3" opacity=".12"/>`;
    s += grid;
    const trees = [];
    const scatter = (n, test, rmin, rmax) => {
      for (let a = 0; a < n * 60 && trees.length < 400; a++) {
        const x = R() * 400, y = R() * 300, r = rmin + R() * (rmax - rmin);
        if (!test(x, y, r)) continue;
        if (trees.some((t) => Math.hypot(t.x - x, t.y - y) < (t.r + r) * 0.95)) continue;
        trees.push({ x, y, r, k: R() < 0.75 ? 'dec' : R() < 0.6 ? 'con' : 'flw' }); n--; if (n <= 0) break;
      }
    };
    const band = (d, w) => `<path d="${d}" fill="none" stroke="${C.ink}" stroke-width="${w + 1.4}"/><path d="${d}" fill="none" stroke="url(#${p}tile)" stroke-width="${w}"/>`;
    const bld = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${p}hatch)" stroke="${C.ink}" stroke-width="1.2"/>`;

    if (type === 'court') {
      s += bld(10, 10, 230, 46) + bld(270, 10, 120, 46) + bld(10, 80, 46, 210) + bld(344, 80, 46, 150) + bld(80, 254, 230, 40);
      s += `<ellipse cx="200" cy="155" rx="88" ry="55" fill="url(#${p}meadow)" stroke="${C.green2}" stroke-width=".7"/>`;
      s += band('M200,300C200,260 200,230 200,210M112,155a88,55 0 1,0 176,0a88,55 0 1,0 -176,0M200,100C210,80 255,70 255,0', 10);
      s += `<circle cx="100" cy="100" r="28" fill="url(#${p}rubber)" stroke="${C.ink}"/><path d="M300,200C320,215 330,235 320,250C305,255 290,240 290,220Z" fill="url(#${p}water)" stroke="${C.water}"/>`;
      scatter(48, (x, y, r) => x > 62 && x < 338 && y > 62 && y < 248 && ((x - 200) / 108) ** 2 + ((y - 155) / 74) ** 2 > 1 && Math.hypot(x - 100, y - 100) > 32 + r && Math.abs(x - 200) > 12 + r || (x > 62 && x < 338 && y > 62 && y < 248 && ((x - 200) / 70) ** 2 + ((y - 155) / 38) ** 2 < 0.35), 6, 11);
    } else if (type === 'roof') {
      s += `<rect x="20" y="20" width="360" height="260" fill="url(#${p}deck)" stroke="${C.ink}" stroke-width="1.4"/>`;
      for (let x = 50; x < 380; x += 60) for (let y = 50; y < 280; y += 60) s += `<rect x="${x - 3}" y="${y - 3}" width="6" height="6" fill="${C.ink}" opacity=".5"/>`;
      const planters = [[40, 40, 120, 60], [190, 40, 80, 120], [300, 40, 60, 200], [40, 130, 60, 130], [130, 200, 140, 60]];
      planters.forEach(([x, y, w, h]) => { s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="url(#${p}meadow)" stroke="${C.ink}" stroke-width="1"/>`; });
      s += `<rect x="115" y="120" width="60" height="50" fill="url(#${p}water)" stroke="${C.water}"/>`;
      planters.forEach(([x, y, w, h]) => scatter(Math.round(w * h / 1500), (tx, ty, r) => tx > x + r && tx < x + w - r && ty > y + r && ty < y + h - r, 7, 12));
    } else if (type === 'park') {
      s += `<path d="${blob(250, 150, 70, 4, 0.18, seed, 48)}" fill="url(#${p}water)" stroke="${C.water}" stroke-width="1"/>`;
      s += `<path d="${blob(110, 220, 60, 5, 0.15, seed + 2, 40)}" fill="url(#${p}meadow)" stroke="${C.green2}" stroke-width=".6"/>`;
      s += band('M0,90C80,70 140,110 170,150S190,260 260,290', 7) + band('M400,60C330,80 300,60 260,70S170,40 120,0', 6) + band('M340,300C340,250 320,230 330,200', 5);
      scatter(110, (x, y, r) => Math.hypot((x - 250) / 1.0, (y - 150) * 1.4) > 82 + r && Math.hypot(x - 110, (y - 220) * 1.4) > 66, 5, 12);
    } else if (type === 'embank') {
      s += `<rect x="0" y="205" width="400" height="95" fill="url(#${p}water)"/><path d="M0,205C100,200 300,210 400,204" fill="none" stroke="${C.ink}" stroke-width="1.4"/>`;
      s += `<rect x="60" y="205" width="60" height="40" fill="url(#${p}deck)" stroke="${C.ink}"/><rect x="250" y="205" width="80" height="30" fill="url(#${p}deck)" stroke="${C.ink}"/>`;
      s += band('M0,180C120,176 280,184 400,178', 18) + band('M0,110C120,100 260,120 400,105', 8);
      s += `<path d="M150,200A40,40 0 0 1 230,200M162,200A28,28 0 0 1 218,200" fill="none" stroke="${C.ink}"/>`;
      for (let x = 14; x < 400; x += 26) trees.push({ x, y: 148 + Math.sin(x / 40) * 3, r: 9, k: 'dec' });
      scatter(50, (x, y, r) => (y > 30 + r && y < 95 - r) || (y > 122 + r && y < 136 - r), 6, 11);
      s += bld(0, 0, 400, 26);
    } else if (type === 'school') {
      s += bld(150, 30, 160, 50) + bld(150, 80, 50, 90);
      s += `<rect x="30" y="185" width="200" height="100" rx="50" fill="#E7DEC4" stroke="${C.ink}"/><rect x="62" y="205" width="136" height="60" fill="#D9E4D0" stroke="#fff" stroke-width="1.5"/><line x1="130" y1="205" x2="130" y2="265" stroke="#fff" stroke-width="1.5"/>`;
      for (let i = 0; i < 6; i++) s += `<rect x="${250 + (i % 3) * 38}" y="${200 + Math.floor(i / 3) * 40}" width="30" height="30" fill="url(#${p}meadow)" stroke="${C.ink}" stroke-width=".8"/>`;
      s += band('M0,170H140M210,120H400M330,0V300', 8);
      scatter(70, (x, y, r) => (x < 140 && y < 160) || (x > 320 + r && y < 110) || (x > 210 && x < 320 && y > 130 + r && y < 190 - r) || (y > 290), 6, 11);
    } else {
      s += `<rect x="0" y="0" width="400" height="70" fill="#E3E1D9"/><rect x="0" y="230" width="400" height="70" fill="#E3E1D9"/>`;
      s += `<path d="M0,35H400M0,265H400" stroke="#fff" stroke-width="1.5" stroke-dasharray="12 10"/>`;
      s += band('M0,118H400', 22) + `<path d="M0,170H400" stroke="${C.lime}" stroke-width="12"/><path d="M0,170H400" stroke="${C.ink}" stroke-width=".6" stroke-dasharray="6 6"/>`;
      s += `<rect x="0" y="198" width="400" height="22" fill="url(#${p}water)" stroke="${C.water}" stroke-width=".6"/>`;
      for (let x = 12; x < 400; x += 24) { trees.push({ x, y: 88, r: 10, k: 'dec' }); trees.push({ x: x + 12, y: 146, r: 10, k: 'dec' }); }
      s += `<rect x="300" y="72" width="100" height="90" fill="url(#${p}tile)" stroke="${C.ink}"/><rect x="340" y="95" width="40" height="40" fill="${C.ink}"/><text x="360" y="119" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="12" fill="${C.lime}">М</text>`;
      for (let i = trees.length - 1; i >= 0; i--) if (trees[i].x > 296 && trees[i].y < 165) trees.splice(i, 1);
    }
    trees.forEach((t) => { s += treeSym(t.x, t.y, t.r, t.k, 0).replace('class="pop"', ''); });
    s += `</svg>`;
    return s;
  }
  function projects() {
    const host = $('#projGrid');
    if (!host) return;
    host.innerHTML = PROJECTS.map((p, i) => `
      <article class="pcard reveal" data-f="${p.f}">
        <div class="pcard__img">${projPlan(p.type, i + 3)}<span class="pcard__tag">${p.tag}</span><span class="pcard__code">${p.code}</span></div>
        <div class="pcard__body"><h3>${p.t}</h3><p>${p.d}</p>
          <div class="pcard__meta">${p.m.map(([b, s]) => `<div><b>${b}</b><span>${s}</span></div>`).join('')}</div></div>
      </article>`).join('');
    $$('.filters button').forEach((b) => b.addEventListener('click', () => {
      $$('.filters button').forEach((x) => x.classList.toggle('on', x === b));
      $$('.pcard', host).forEach((c) => c.classList.toggle('hide', b.dataset.f !== 'all' && c.dataset.f !== b.dataset.f));
    }));
  }

  /* =====================================================================
     5. СМЕТА И БАЛАНС
     ===================================================================== */
  const COST = [
    ['Подготовительные и земляные работы', '12 000', 'м²', 14.4, 0.05],
    ['Инженерные сети: дренаж, полив, освещение', '1', 'компл.', 27.0, 0],
    ['Мощение: гранит, бетонная плитка, бортовой камень', '3 600', 'м²', 41.4, 0.05],
    ['Детские и спортивные площадки', '1 680', 'м²', 23.4, 0.05],
    ['МАФ, перголы, навигация', '1', 'компл.', 18.0, 0],
    ['Посадочный материал', '7 845', 'шт', 34.2, 0.35],
    ['Посадка, газоны, цветники', '5 520', 'м²', 12.6, 0.05],
    ['Проектирование и авторский надзор', '1', 'компл.', 9.0, 0],
  ];
  function estimate() {
    const body = $('#costRows');
    if (!body) return;
    const total = COST.reduce((a, r) => a + r[3], 0);
    const ours = COST.reduce((a, r) => a + r[3] * (1 - r[4]), 0);
    body.innerHTML = COST.map((r, i) => `<tr><td>${String(i + 1).padStart(2, '0')}</td><td>${r[0]}${r[4] >= 0.3 ? ' <b style="color:var(--green-2)">· питомник −35%</b>' : ''}</td><td>${r[1]}</td><td>${r[2]}</td><td class="r">${nf(r[3] * 1e6)}</td><td class="r">${Math.round(r[3] / total * 100)}%<span class="share"><i style="width:${r[3] / total * 100 * 3}%"></i></span></td></tr>`).join('');
    $('#costMarket').textContent = nf(total * 1e6);
    $('#costOurs').textContent = nf(Math.round(ours * 10) / 10 * 1e6);
    $('#costSave').textContent = '−' + nf((1 - ours / total) * 100, 1) + '%';

    // Баланс территории — кольцевая диаграмма
    const parts = [
      ['Озеленение: газоны, луга, посадки', 5520, C.green2],
      ['Мощение и дорожки', 3600, '#CFCABB'],
      ['Детские и спортивные площадки', 1680, C.lime],
      ['МАФ, перголы, отмостка', 720, C.ink2],
      ['Дождевые сады, вода', 480, C.water],
    ];
    const sum = parts.reduce((a, p) => a + p[1], 0);
    let a0 = -Math.PI / 2, arcs = '';
    parts.forEach(([, v, col]) => {
      const a1 = a0 + (v / sum) * Math.PI * 2, r = 80, ri = 50, cx = 100, cy = 100;
      const big = a1 - a0 > Math.PI ? 1 : 0;
      const P = (a, rr) => `${f1(cx + Math.cos(a) * rr)},${f1(cy + Math.sin(a) * rr)}`;
      arcs += `<path d="M${P(a0, r)}A${r},${r} 0 ${big} 1 ${P(a1, r)}L${P(a1, ri)}A${ri},${ri} 0 ${big} 0 ${P(a0, ri)}Z" fill="${col}" stroke="#F8F7F2" stroke-width="2"/>`;
      a0 = a1;
    });
    $('#balance').innerHTML = `<svg viewBox="0 0 200 200">${arcs}<text x="100" y="98" text-anchor="middle" font-family="Manrope" font-size="22" font-weight="600" fill="${C.ink}">1,2 га</text><text x="100" y="116" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="${C.muted}">БАЛАНС</text></svg>
      <ul>${parts.map(([n, v, col]) => `<li><i style="background:${col}"></i>${n}<b>${nf(v)} м²</b><span>${nf(v / sum * 100, 0)}%</span></li>`).join('')}</ul>`;

    $$('.sheet__tabs button').forEach((b) => b.addEventListener('click', () => {
      $$('.sheet__tabs button').forEach((x) => x.classList.toggle('on', x === b));
      $$('.tab').forEach((t) => t.classList.toggle('on', t.dataset.pane === b.dataset.tab));
    }));
  }

  /* =====================================================================
     6. КАЛЬКУЛЯТОР ЭФФЕКТА
     ===================================================================== */
  const CLS = {
    comfort: { rate: 9500, uplift: 0.05 },
    business: { rate: 15000, uplift: 0.07 },
    premium: { rate: 26000, uplift: 0.09 },
  };
  const SAVING = 0.092;                // экономия КРОНА: питомник + свои бригады (см. смету)
  function money(v) {
    if (v >= 1e9) return nf(v / 1e9, 2) + ' млрд ₽';
    if (v >= 1e6) return nf(v / 1e6, v >= 1e8 ? 0 : 1) + ' млн ₽';
    return nf(v) + ' ₽';
  }
  function calc() {
    const iSale = $('#iSale'); if (!iSale) return;
    const iPrice = $('#iPrice'), iLand = $('#iLand');
    let cls = 'business';
    const paint = (el) => el.style.setProperty('--p', ((el.value - el.min) / (el.max - el.min) * 100) + '%');
    const upd = () => {
      const sale = +iSale.value, price = +iPrice.value, land = +iLand.value, c = CLS[cls];
      $('#vSale').textContent = nf(sale); $('#vPrice').textContent = nf(price); $('#vLand').textContent = nf(land);
      const market = land * c.rate, ours = market * (1 - SAVING), rev = sale * price * c.uplift;
      $('#oRevenue').textContent = '+' + money(rev);
      $('#oMarket').textContent = money(market);
      $('#oOurs').textContent = money(ours);
      $('#oRoi').textContent = '×' + nf(rev / ours, 1);
      $('#oShare').textContent = nf(ours / (sale * price) * 100, 2) + '%';
      [iSale, iPrice, iLand].forEach(paint);
    };
    [iSale, iPrice, iLand].forEach((el) => el.addEventListener('input', upd));
    $$('.seg button').forEach((b) => b.addEventListener('click', () => {
      cls = b.dataset.cls;
      $$('.seg button').forEach((x) => x.classList.toggle('on', x === b));
      upd();
    }));
    upd();
  }

  /* =====================================================================
     7. КОМАНДА, ЭТАПЫ, ГРАФИК
     ===================================================================== */
  const TEAM = [
    ['Анна Северина', 'Главный архитектор, партнёр', 'Автор концепций для 60+ жилых комплексов. Магистр ландшафтной архитектуры, стажировки в бюро Нидерландов и Дании.', '16 лет в профессии'],
    ['Михаил Громов', 'Главный инженер проекта', 'Вертикальная планировка, дренаж и эксплуатируемые кровли. Ведёт экспертизу и согласования.', '14 лет в профессии'],
    ['Елена Вяземская', 'Главный дендролог', 'Ассортимент и акклиматизация, обследование существующих насаждений, гарантийный надзор.', '19 лет в профессии'],
    ['Дмитрий Ольхов', 'Руководитель питомника', '42 га полей и 214 видов. Отвечает за качество посадочного материала и логистику до объекта.', '12 лет в профессии'],
    ['Ксения Белова', 'Руководитель отдела концепций', 'Исследования аудитории, сценарии жизни во дворе, визуализации для отделов продаж девелоперов.', '9 лет в профессии'],
    ['Артём Лесков', 'Директор по строительству', '12 собственных бригад, график с контрольными точками, качество и безопасность на объекте.', '15 лет в профессии'],
  ];
  function avatar(name, seed) {
    const R = rng(seed * 97 + 13);
    const cx = 30 + R() * 52, cy = 30 + R() * 50;
    let rings = '';
    for (let i = 0; i < 11; i++) rings += `<path d="${blob(cx, cy, 8 + i * 9, 3 + (i % 3), 0.09 + R() * 0.05, seed * 10 + i, (8 + i * 9) * (0.85 + R() * 0.2))}" fill="none" stroke="${C.lime}" stroke-width="${i % 4 === 0 ? 1 : 0.5}" opacity="${i % 4 === 0 ? 0.65 : 0.3}"/>`;
    const ini = name.split(' ').map((w) => w[0]).join('');
    return `<svg viewBox="0 0 112 136" aria-hidden="true"><rect width="112" height="136" fill="#1B2420"/>${rings}
      <circle cx="${f1(cx)}" cy="${f1(cy)}" r="2.5" fill="${C.lime}"/>
      <text x="10" y="124" font-family="Manrope" font-size="34" font-weight="600" letter-spacing="-1" fill="#F2F4EE">${ini}</text></svg>`;
  }
  function team() {
    const host = $('#teamGrid'); if (!host) return;
    host.innerHTML = TEAM.map(([n, r, t, e], i) => `<article class="member reveal">${avatar(n, i + 1)}<div><div class="member__role">${r}</div><h3>${n}</h3><p>${t}</p><p class="member__exp">${e}</p></div></article>`).join('');
  }

  const STEPS = [
    ['Заявка и выезд', 'Встреча, выезд на участок, сбор исходных данных и задач по продажам.', '1–3 дня'],
    ['Предпроектный анализ', 'Обследование, инсоляция, аудитория, конкуренты. ТЗ и бюджет-ориентир.', '1–2 недели'],
    ['Концепция', 'Мастер-план, зонирование, визуализации. Две итерации правок включены.', '3–5 недель'],
    ['Смета и договор', 'Фиксированная цена и график с контрольными точками в договоре.', '5 дней'],
    ['Проектирование', 'ПД и РД, дендроплан, инженерные разделы, сопровождение экспертизы.', '6–10 недель'],
    ['Питомник и стройка', 'Резерв растений на полях, собственные бригады, еженедельные отчёты.', '3–6 месяцев'],
    ['Сдача объекта', 'Приёмка, исполнительная документация, паспорт объекта для УК.', '1–2 недели'],
    ['Уход и гарантия', 'Сезонный уход по регламенту, замена растений по гарантии.', '24 месяца'],
  ];
  const GANTT = [
    ['Анализ и выезд', 0, 0.6, ''], ['Концепция', 0.5, 2, ''], ['Смета и договор', 1.8, 2.3, 'lime'],
    ['Проект ПД / РД', 2.2, 4.6, ''], ['Согласования', 3.6, 5.4, 'hatch'], ['Резерв в питомнике', 2.4, 6.5, 'lime'],
    ['Строительство', 5, 9.2, ''], ['Озеленение', 7, 10, 'lime'], ['Сдача', 9.8, 10.4, ''], ['Уход и гарантия', 10.4, 12, 'hatch'],
  ];
  function process() {
    const host = $('#steps'); if (!host) return;
    host.innerHTML = STEPS.map(([h, p, t], i) => `<li class="step reveal"><span class="step__n">${String(i + 1).padStart(2, '0')}</span><h3>${h}</h3><p>${p}</p><span class="step__t">Срок: <b>${t}</b></span></li>`).join('');
    $('#gantt').innerHTML = `<div class="gantt__inner">
      <div class="gantt__head"><span>ГР-09 · Типовой график, мес.</span><div class="gantt__months">${Array.from({ length: 12 }, (_, i) => `<span>М${i + 1}</span>`).join('')}</div></div>
      ${GANTT.map(([n, a, b, c], i) => `<div class="gantt__row"><span>${n}</span><div class="gantt__track"><i class="gantt__bar ${c}" style="left:${a / 12 * 100}%;width:${(b - a) / 12 * 100}%;--d:${i * 0.08}s"></i></div></div>`).join('')}
      <p class="gantt__note">Объект 1–3 га · сроки зависят от сезона посадок и стадии исходной документации · гарантийный уход продолжается 24 месяца</p></div>`;
  }

  /* =====================================================================
     8. ШАПКА, ПОЯВЛЕНИЕ, СЧЁТЧИКИ, ФОРМА
     ===================================================================== */
  function nav() {
    const n = $('.nav'), b = $('.nav__burger');
    const onScroll = () => n.classList.toggle('scrolled', scrollY > 20);
    addEventListener('scroll', onScroll, { passive: true }); onScroll();
    b.addEventListener('click', () => { const o = n.classList.toggle('open'); b.setAttribute('aria-expanded', o); });
    $$('.nav__links a').forEach((a) => a.addEventListener('click', () => { n.classList.remove('open'); b.setAttribute('aria-expanded', false); }));
  }

  function countUp(el) {
    const to = parseFloat(el.dataset.to), dec = +(el.dataset.dec || 0);
    if (reduced) { el.textContent = nf(to, dec); return; }
    const t0 = performance.now(), dur = 1600;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = nf(to * e, dec);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function observe() {
    // ступенчатое появление соседних элементов
    const groups = new Map();
    $$('.reveal').forEach((el) => {
      const p = el.parentElement; const i = groups.get(p) || 0;
      el.style.setProperty('--rd', Math.min(i, 6) * 0.07 + 's'); groups.set(p, i + 1);
    });
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      el.classList.add('in');
      $$('.count', el).forEach((c) => { if (!c.dataset.done) { c.dataset.done = 1; countUp(c); } });
      $$('.prow__bar i', el).forEach((i) => { i.style.width = i.dataset.w + '%'; });
      io.unobserve(el);
    }), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    $$('.reveal, .gantt, .prices').forEach((el) => io.observe(el));
  }

  function form() {
    const f = $('#leadForm'); if (!f) return;
    const no = 'Ф-' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' + String(Math.floor(Math.random() * 900) + 100);
    $('#formNo').textContent = '№ ' + no;
    const mail = $('#cMail').textContent.trim();
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      let ok = true;
      ['name', 'contact'].forEach((n) => {
        const inp = f.elements[n]; const bad = !inp.value.trim();
        inp.closest('.fld').classList.toggle('err', bad); if (bad) ok = false;
      });
      const msg = $('#formMsg');
      if (!ok) { msg.style.color = '#FF8A6B'; msg.textContent = 'Заполните имя и контакт — этого достаточно, чтобы мы связались.'; return; }
      const d = Object.fromEntries(new FormData(f));
      const body = `Заявка ${no}\n\nИмя: ${d.name}\nКомпания: ${d.company || '—'}\nКонтакт: ${d.contact}\nОбъект: ${d.type}\nПлощадь: ${d.area || '—'} м²\nСтадия: ${d.stage}\n\n${d.note || ''}`;
      location.href = `mailto:${mail}?subject=${encodeURIComponent('Заявка на проект ' + no)}&body=${encodeURIComponent(body)}`;
      msg.style.color = ''; msg.textContent = `Заявка ${no} подготовлена в почтовом приложении — отправьте письмо, и менеджер ответит в течение 2 часов.`;
    });
  }

  /* ---------- запуск ---------- */
  heroPlan();
  sectionDrawing();
  nurseryPlan();
  priceRows();
  projects();
  estimate();
  calc();
  team();
  process();
  nav();
  form();
  observe();
})();
