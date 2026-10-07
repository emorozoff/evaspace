/* Живой двор — интерактив и векторные «чертежи».
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
    ink: '#1C211D', ink2: '#4B534D', muted: '#858D86', green: '#2E5C40', green2: '#3F7A56',
    green3: '#8DB59A', lime: '#E8884E', sage: '#BFD0B5', water: '#7FA8C9', paper: '#FFFFFF', sand: '#E2C892',
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

  // Общие штриховки для планов
  const PATTERNS = (p) => `
    <pattern id="${p}hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#E9E8E1"/><path d="M0 0V6" stroke="${C.ink}" stroke-width=".7" opacity=".55"/></pattern>
    <pattern id="${p}meadow" width="9" height="9" patternUnits="userSpaceOnUse"><rect width="9" height="9" fill="#E3EBD9"/><circle cx="2" cy="2" r=".8" fill="${C.green2}" opacity=".55"/><circle cx="6.5" cy="6" r=".6" fill="${C.green2}" opacity=".4"/></pattern>
    <pattern id="${p}water" width="14" height="6" patternUnits="userSpaceOnUse"><rect width="14" height="6" fill="#D6E3EC"/><path d="M0 3q3.5-2.4 7 0t7 0" fill="none" stroke="${C.water}" stroke-width=".7"/></pattern>
    <pattern id="${p}tile" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#E9E6DC"/><path d="M8 0V8M0 8H8" stroke="${C.ink}" stroke-width=".35" opacity=".45"/></pattern>
    <pattern id="${p}rubber" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="#E7DEC4"/><circle cx="2.5" cy="2.5" r=".6" fill="${C.ink}" opacity=".35"/></pattern>
    <pattern id="${p}deck" width="40" height="5" patternUnits="userSpaceOnUse"><rect width="40" height="5" fill="#E6D9BF"/><path d="M0 5H40M17 0V5" stroke="${C.ink}" stroke-width=".4" opacity=".5"/></pattern>`;

  // Рендер-стиль мастерплана: мягкие тени, объёмные кроны, свет сверху-слева
  const RDEFS = (p) => `
    <radialGradient id="${p}dec" cx=".38" cy=".34" r=".72"><stop offset="0" stop-color="#CBDFB9"/><stop offset=".55" stop-color="#9DBF93"/><stop offset="1" stop-color="#5F8E6B"/></radialGradient>
    <radialGradient id="${p}con" cx=".38" cy=".34" r=".72"><stop offset="0" stop-color="#9FBF9A"/><stop offset=".6" stop-color="#5F8F6A"/><stop offset="1" stop-color="#2F5C42"/></radialGradient>
    <radialGradient id="${p}flw" cx=".38" cy=".34" r=".72"><stop offset="0" stop-color="#FBE6D6"/><stop offset=".6" stop-color="#F2C1A4"/><stop offset="1" stop-color="#D98E6A"/></radialGradient>
    <radialGradient id="${p}shr" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#D6E5C6"/><stop offset="1" stop-color="#8FB38B"/></radialGradient>
    <linearGradient id="${p}lawn" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E4ECD8"/><stop offset="1" stop-color="#CFDEC2"/></linearGradient>
    <linearGradient id="${p}pond" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C9DDEA"/><stop offset="1" stop-color="#8FB4CF"/></linearGradient>
    <linearGradient id="${p}roof" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F3F1EB"/><stop offset="1" stop-color="#DEDAD0"/></linearGradient>
    <linearGradient id="${p}deck" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EBDDC6"/><stop offset="1" stop-color="#D9C5A6"/></linearGradient>
    <pattern id="${p}pave" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#EAE6DC"/><path d="M10 0V10M0 10H10" stroke="#fff" stroke-width=".8" opacity=".7"/></pattern>
    <pattern id="${p}rubber" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#F1D4BB"/><circle cx="3" cy="3" r=".7" fill="#D99A74" opacity=".5"/></pattern>
    <filter id="${p}soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.2"/></filter>
    <filter id="${p}cloud" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="28"/></filter>`;

  // Дерево в плане: тень, крона с объёмом, лёгкий блик
  function tree(x, y, r, kind, d, p = 'r-') {
    const sx = f1(x + r * 0.22), sy = f1(y + r * 0.26);
    const st = d === undefined ? '' : `class="pop" style="--d:${d}s"`;
    const shadow = `<ellipse cx="${sx}" cy="${sy}" rx="${f1(r * 1.02)}" ry="${f1(r * 0.92)}" fill="rgba(28,33,29,.16)" filter="url(#${p}soft)"/>`;
    if (kind === 'con') {
      const pts = [];
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2, rr = i % 2 ? r * 0.8 : r;
        pts.push(f1(x + Math.cos(a) * rr) + ',' + f1(y + Math.sin(a) * rr));
      }
      return `<g ${st}>${shadow}<polygon points="${pts.join(' ')}" fill="url(#${p}con)"/><circle cx="${f1(x - r * .3)}" cy="${f1(y - r * .3)}" r="${f1(r * .22)}" fill="#fff" opacity=".22"/></g>`;
    }
    const fill = kind === 'flw' ? `url(#${p}flw)` : `url(#${p}dec)`;
    return `<g ${st}>${shadow}<path d="${blob(x, y, r, 7 + (kind === 'flw' ? 2 : 0), 0.07, Math.round(x * 3 + y))}" fill="${fill}"/><circle cx="${f1(x - r * .32)}" cy="${f1(y - r * .34)}" r="${f1(r * .24)}" fill="#fff" opacity=".28"/></g>`;
  }
  function shrub(x, y, r, d, p = 'r-') {
    const st = d === undefined ? '' : `class="pop" style="--d:${d}s"`;
    return `<g ${st}><ellipse cx="${f1(x + r * .2)}" cy="${f1(y + r * .25)}" rx="${f1(r)}" ry="${f1(r * .9)}" fill="rgba(28,33,29,.1)"/><path d="${blob(x, y, r, 6, 0.12, Math.round(x + y * 5))}" fill="url(#${p}shr)"/></g>`;
  }
  // Здание в плане: тень от объёма и светлая кровля
  function building(x, y, w, h, p = 'r-', d) {
    const st = d === undefined ? '' : `class="rise" style="--d:${d}s"`;
    return `<g ${st}><rect x="${x + 8}" y="${y + 10}" width="${w}" height="${h}" rx="3" fill="rgba(28,33,29,.22)" filter="url(#${p}soft)"/>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="url(#${p}roof)" stroke="rgba(28,33,29,.35)" stroke-width=".8"/>
      <rect x="${x + 6}" y="${y + 6}" width="${w - 12}" height="${h - 12}" rx="2" fill="none" stroke="rgba(28,33,29,.14)" stroke-width=".8"/></g>`;
  }
  // Дорожка: кромка + покрытие, рисуется штрихом
  function walk(d, w, p = 'r-', delay = 0, cls = 'draw') {
    return `<path class="${cls}" pathLength="1" style="--d:${delay}s" d="${d}" fill="none" stroke="rgba(28,33,29,.28)" stroke-width="${w + 2}" stroke-linecap="round"/>
      <path class="${cls} pv" data-hw="${w / 2}" pathLength="1" style="--d:${delay + .05}s" d="${d}" fill="none" stroke="url(#${p}pave)" stroke-width="${w}" stroke-linecap="round"/>`;
  }
  // Подпись на плане: белая плашка с мягкой тенью и выноской
  function pill(x1, y1, x2, y2, t, d) {
    const w = t.length * 8.8 + 30, h = 34;
    const st = d === undefined ? '' : `class="fade" style="--d:${d}s"`;
    return `<g ${st} font-family="Manrope, system-ui, sans-serif" font-size="15" font-weight="600" fill="${C.ink}">
      <path d="M${x1},${y1}L${x2},${y2}" fill="none" stroke="${C.ink}" stroke-width="1" opacity=".55"/>
      <circle cx="${x1}" cy="${y1}" r="4" fill="${C.lime}" stroke="#fff" stroke-width="1.5"/>
      <rect x="${x2 - w / 2 + 2}" y="${y2 - h / 2 + 3}" width="${w}" height="${h}" rx="17" fill="rgba(28,33,29,.12)" filter="url(#r-soft)"/>
      <rect x="${x2 - w / 2}" y="${y2 - h / 2}" width="${w}" height="${h}" rx="17" fill="#fff"/>
      <text x="${x2}" y="${y2 + 5.2}" text-anchor="middle">${t}</text></g>`;
  }

  /* =====================================================================
     1. ГЕНПЛАН В ПЕРВОМ ЭКРАНЕ
     ===================================================================== */
  function heroPlan() {
    const host = $('#heroPlan');
    if (!host) return;
    const R = rng(23);
    const B = [
      { x: 40, y: 36, w: 420, h: 76 }, { x: 540, y: 36, w: 150, h: 118 }, { x: 862, y: 36, w: 98, h: 400 },
      { x: 40, y: 170, w: 88, h: 320 }, { x: 40, y: 606, w: 350, h: 78 }, { x: 610, y: 606, w: 350, h: 78 },
    ];
    const PATHS = [
      ['M320,340a180,112 0 1,0 360,0a180,112 0 1,0 -360,0', 18],
      ['M500,720C500,640 500,520 500,452', 26],
      ['M560,0C560,70 560,140 560,228', 20],
      ['M320,340C290,342 265,330 245,322', 14],
      ['M190,250C160,210 130,170 128,120', 14],
      ['M680,340C715,342 740,370 760,400', 14],
      ['M835,478C855,510 880,520 960,520', 14],
      ['M402,606C440,570 470,540 470,500', 14],
    ];
    const play = { x: 232, y: 300, r: 72 }, ring = { x: 500, y: 340, rx: 180, ry: 112 };

    let s = `<svg viewBox="0 0 1000 720" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Генеральный план двора жилого комплекса">
      <defs>${RDEFS('r-')}
        <radialGradient id="r-glow"><stop offset="0" stop-color="#F7D88A" stop-opacity=".85"/><stop offset=".4" stop-color="#F7D88A" stop-opacity=".3"/><stop offset="1" stop-color="#F7D88A" stop-opacity="0"/></radialGradient>
        <radialGradient id="r-bg" cx=".5" cy=".45" r=".75"><stop offset="0" stop-color="#F4F2EC"/><stop offset="1" stop-color="#E9E6DD"/></radialGradient>
      </defs>
      <rect width="1000" height="720" fill="url(#r-bg)"/>
      <g id="r-parallax">`;

    // Зоны — мягкие подложки
    s += `<g data-g="zones" class="fade" style="--d:.2s">
      <circle cx="${play.x}" cy="${play.y}" r="122" fill="#D9E6CF" opacity=".7"/>
      <ellipse cx="500" cy="340" rx="222" ry="150" fill="#D6E4CA" opacity=".55"/>
      <rect x="664" y="372" width="200" height="140" rx="40" fill="#EADFC8" opacity=".6"/>
      <circle cx="330" cy="520" r="78" fill="#D6E0E8" opacity=".55"/></g>`;

    // Газон и дорожки
    s += `<ellipse class="fade" style="--d:.35s" cx="500" cy="340" rx="${ring.rx - 14}" ry="${ring.ry - 14}" fill="url(#r-lawn)"/>`;
    s += `<g data-g="paving"><rect class="fade" style="--d:.4s" x="400" y="560" width="200" height="160" fill="url(#r-pave)"/>`;
    PATHS.forEach(([d, w], i) => { s += walk(d, w, 'r-', 0.45 + i * 0.1); });
    s += `</g>`;

    // Объекты
    s += `<g class="pop" style="--d:1.1s"><circle cx="${play.x + 6}" cy="${play.y + 8}" r="${play.r}" fill="rgba(28,33,29,.1)" filter="url(#r-soft)"/>
        <circle cx="${play.x}" cy="${play.y}" r="${play.r}" fill="url(#r-rubber)"/>
        <circle cx="${play.x}" cy="${play.y}" r="48" fill="none" stroke="#fff" stroke-width="1.6" opacity=".8"/>
        <rect x="212" y="276" width="26" height="26" rx="5" fill="${C.lime}"/><rect x="242" y="300" width="20" height="12" rx="3" fill="#fff"/>
        <circle cx="212" cy="326" r="9" fill="#fff"/><path d="M246,262l20,-12" stroke="${C.ink}" stroke-width="3" stroke-linecap="round"/></g>`;
    s += `<g class="pop" style="--d:1.2s" transform="rotate(-6 765 445)"><rect x="696" y="408" width="146" height="84" rx="8" fill="rgba(28,33,29,.12)" filter="url(#r-soft)"/>
        <rect x="690" y="402" width="146" height="84" rx="8" fill="#BFD4B6"/>
        <g fill="none" stroke="#fff" stroke-width="1.6"><rect x="698" y="410" width="130" height="68" rx="4"/><line x1="763" y1="410" x2="763" y2="478"/><circle cx="763" cy="444" r="14"/></g></g>`;
    s += `<path class="pop" style="--d:1.3s" d="${blob(600, 500, 62, 5, 0.14, 7, 42)}" fill="url(#r-pond)"/>
      <path d="${blob(600, 500, 62, 5, 0.14, 7, 42)}" class="pop" style="--d:1.3s" fill="none" stroke="#fff" stroke-width="1.2" opacity=".7"/>`;
    s += `<g class="pop" style="--d:1.25s" fill="none" stroke="#fff" stroke-width="2.4"><path d="M274,520A56,56 0 0 1 386,520M286,520A44,44 0 0 1 374,520M298,520A32,32 0 0 1 362,520"/><rect x="312" y="520" width="36" height="12" rx="3" fill="url(#r-deck)" stroke="none"/></g>`;
    s += `<g class="pop" style="--d:1.35s"><rect x="648" y="550" width="180" height="30" rx="4" fill="rgba(28,33,29,.1)" transform="translate(5 6)" filter="url(#r-soft)"/><rect x="648" y="550" width="180" height="30" rx="4" fill="url(#r-deck)"/>
        <path d="${Array.from({ length: 17 }, (_, i) => `M${658 + i * 10},550V580`).join('')}" stroke="#fff" stroke-width="1.2" opacity=".7"/></g>`;

    // Здания
    s += `<g>` + B.map((b, i) => building(b.x, b.y, b.w, b.h, 'r-', i * 0.06)).join('') + `</g>`;
    s += `<g data-g="dendro" id="r-dendro"></g><g data-g="eng" class="off" id="r-eng"></g><g data-g="light" class="off" id="r-light"></g><g id="r-notes"></g>`;
    // Тень облака — медленно плывёт по плану
    s += `<g class="cloud" opacity=".07" pointer-events="none"><path d="${blob(0, 0, 160, 5, 0.22, 3, 90)}" fill="${C.ink}" filter="url(#r-cloud)"/></g>`;
    s += `</g>
      <g transform="translate(962 40)" class="fade" style="--d:2.4s"><circle r="13" fill="#fff" opacity=".9"/><path d="M0,-9L4.5,6L0,3L-4.5,6Z" fill="${C.ink}"/><text y="-17" text-anchor="middle" font-family="Manrope" font-size="10" font-weight="700" fill="${C.ink}">С</text></g>
      <g transform="translate(40 694)" class="fade" style="--d:2.4s" font-family="Manrope" font-size="10" font-weight="600" fill="${C.ink2}"><rect width="40" height="4" rx="2" fill="${C.ink}"/><rect x="40" width="40" height="4" rx="2" fill="#fff"/><rect x="80" width="40" height="4" rx="2" fill="${C.ink}"/><text y="16">0</text><text x="60" y="16" text-anchor="middle">10</text><text x="120" y="16" text-anchor="middle">20 м</text></g>
    </svg>`;
    host.innerHTML = s;

    const svg = $('svg', host);
    const pv = $$('.pv', svg).map((p) => {
      const L = p.getTotalLength(), pts = [];
      for (let l = 0; l <= L; l += 6) { const q = p.getPointAtLength(l); pts.push([q.x, q.y]); }
      return { el: p, L, hw: +p.dataset.hw, pts };
    });
    const inRect = (x, y, rx, ry, rw, rh, m = 0) => x > rx - m && x < rx + rw + m && y > ry - m && y < ry + rh + m;
    const free = (x, y, r) => {
      if (B.some((b) => inRect(x, y, b.x, b.y, b.w, b.h, r + 10))) return false;
      if (((x - ring.x) / (ring.rx + r + 12)) ** 2 + ((y - ring.y) / (ring.ry + r + 12)) ** 2 < 1) return false;
      if (Math.hypot(x - play.x, y - play.y) < play.r + r + 10) return false;
      if (inRect(x, y, 680, 392, 170, 110, r + 4)) return false;      // корт
      if (Math.hypot(x - 600, y - 500) < 72 + r) return false;         // дождевой сад
      if (inRect(x, y, 268, 456, 124, 80, r + 4)) return false;        // амфитеатр
      if (inRect(x, y, 640, 544, 196, 42, r + 4)) return false;        // пергола
      if (inRect(x, y, 396, 556, 208, 170, r)) return false;           // входная площадь
      for (const p of pv) for (const q of p.pts) if (Math.hypot(x - q[0], y - q[1]) < p.hw + r * 0.8 + 4) return false;
      return true;
    };
    // Деревья: немного крупных в центре, остальные по периметру
    const trees = [{ x: 455, y: 320, r: 30, k: 'dec' }, { x: 560, y: 362, r: 24, k: 'dec' }, { x: 525, y: 290, r: 16, k: 'flw' }];
    for (let a = 0; a < 7000 && trees.length < 58; a++) {
      const x = 140 + R() * 720, y = 120 + R() * 470, roll = R();
      const k = roll < 0.66 ? 'dec' : roll < 0.86 ? 'con' : 'flw';
      const r = k === 'dec' ? 13 + R() * 11 : k === 'con' ? 11 + R() * 5 : 11 + R() * 4;
      if (!free(x, y, r)) continue;
      if (trees.some((t) => Math.hypot(t.x - x, t.y - y) < t.r + r + 4)) continue;
      trees.push({ x, y, r, k });
    }
    const shrubs = [];
    for (let a = 0; a < 5000 && shrubs.length < 34; a++) {
      const x = 140 + R() * 720, y = 120 + R() * 470, r = 6 + R() * 6;
      if (!free(x, y, r)) continue;
      if (trees.some((t) => Math.hypot(t.x - x, t.y - y) < t.r + r + 2)) continue;
      if (shrubs.some((t) => Math.hypot(t.x - x, t.y - y) < t.r + r + 2)) continue;
      shrubs.push({ x, y, r });
    }
    let dh = shrubs.map((b) => shrub(b.x, b.y, b.r, f1(1.3 + (b.y / 720) * 1.0))).join('');
    trees.sort((a, b) => a.y - b.y).forEach((t) => { dh += tree(t.x, t.y, t.r, t.k, f1(1.2 + (Math.hypot(t.x - 500, t.y - 720) / 820) * 1.3)); });
    $('#r-dendro', svg).innerHTML = dh;
    const tc = $('#treeCount'); if (tc) tc.textContent = trees.length + ' деревьев';

    // Свет: фонари вдоль дорожек
    let lh = '';
    pv.forEach((p, pi) => {
      for (let l = 24, side = 1; l < p.L - 12; l += 64, side *= -1) {
        const a = p.el.getPointAtLength(l), b = p.el.getPointAtLength(Math.min(l + 1, p.L));
        const dx = b.x - a.x, dy = b.y - a.y, n = Math.hypot(dx, dy) || 1;
        const x = a.x - (dy / n) * (p.hw + 7) * side, y = a.y + (dx / n) * (p.hw + 7) * side;
        if (B.some((bb) => inRect(x, y, bb.x, bb.y, bb.w, bb.h, 2))) continue;
        lh += `<circle class="glow" style="--d:${f1((pi + l) % 3)}s" cx="${f1(x)}" cy="${f1(y)}" r="30" fill="url(#r-glow)"/><circle cx="${f1(x)}" cy="${f1(y)}" r="3" fill="#fff" stroke="${C.ink}" stroke-width="1.2"/>`;
      }
    });
    $('#r-light', svg).innerHTML = lh;

    // Вода и полив
    let eh = `<path class="flow" d="M150,140V540H840V140M500,540V700M560,540V520" fill="none" stroke="${C.water}" stroke-width="2.4" opacity=".9"/>
      <path d="M340,340H660M500,250V430" fill="none" stroke="${C.green}" stroke-width="1.2" stroke-dasharray="6 4" opacity=".8"/>`;
    [[150, 140], [150, 540], [500, 540], [840, 540], [840, 140], [500, 700]].forEach(([x, y]) => { eh += `<circle cx="${x}" cy="${y}" r="6" fill="#fff" stroke="${C.water}" stroke-width="1.6"/>`; });
    [380, 440, 500, 560, 620].forEach((x) => { eh += `<circle cx="${x}" cy="340" r="24" fill="rgba(127,168,201,.14)" stroke="${C.water}" stroke-width=".8" stroke-dasharray="2 3"/><circle cx="${x}" cy="340" r="2.6" fill="${C.green}"/>`; });
    $('#r-eng', svg).innerHTML = eh;

    // Подписи — в свободных местах, с выносками
    $('#r-notes', svg).innerHTML =
      pill(455, 320, 330, 160, 'Липа · крупномер 7 м', 2.6) +
      pill(232, 300, 200, 560, 'Детская площадка', 2.7) +
      pill(600, 500, 500, 660, 'Дождевой сад', 2.8) +
      pill(765, 445, 740, 330, 'Спортивный корт', 2.9);

    requestAnimationFrame(() => svg.classList.add('drawn'));

    // Лёгкий параллакс за курсором
    const g = $('#r-parallax', svg); let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    const tick = () => { cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08; g.setAttribute('transform', `translate(${f1(cx)} ${f1(cy)})`); if (Math.abs(tx - cx) > 0.05 || Math.abs(ty - cy) > 0.05) raf = requestAnimationFrame(tick); else raf = 0; };
    const move = (e) => { const r = svg.getBoundingClientRect(); tx = ((e.clientX - r.left) / r.width - 0.5) * -10; ty = ((e.clientY - r.top) / r.height - 0.5) * -10; if (!raf) raf = requestAnimationFrame(tick); };
    if (!reduced && matchMedia('(hover: hover)').matches) {
      svg.addEventListener('pointermove', move);
      svg.addEventListener('pointerleave', () => { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(tick); });
    }
    $$('.layer').forEach((b) => b.addEventListener('click', () => {
      b.classList.toggle('on');
      const gg = $(`[data-g="${b.dataset.layer}"]`, svg);
      if (gg) gg.classList.toggle('off', !b.classList.contains('on'));
    }));
  }

  /* =====================================================================
     2. РАЗРЕЗ 1–1
     ===================================================================== */
  const SD_MARKS = [
    [150, 300, 'Мощение на щебёночном основании — не проседает и не пучится зимой'],
    [330, 372, 'Структурный грунт под дорожками: корням есть куда расти'],
    [458, 316, 'Крупномер из нашего питомника с комом земли — приживается в 97% случаев'],
    [488, 62, 'Взрослое дерево 7–8 м даёт тень уже в первое лето'],
    [688, 352, 'Дождевой сад впитывает ливень вместо луж и ливнёвки'],
    [790, 368, 'Дренаж отводит лишнюю воду от корней и фундаментов'],
    [945, 214, 'Луг вместо газона: два полива за сезон вместо сорока'],
    [1112, 282, 'Мягкое покрытие площадки — безопасно при падении'],
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
        <radialGradient id="s-canopy" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#D3E4C4"/><stop offset=".6" stop-color="#A4C49A"/><stop offset="1" stop-color="#6B9A74"/></radialGradient>
        <linearGradient id="s-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7F8F4"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
        <pattern id="s-earth" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="2" cy="3" r=".7" fill="${C.ink}" opacity=".25"/><circle cx="7" cy="8" r=".5" fill="${C.ink}" opacity=".2"/></pattern>
        <pattern id="s-soil" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="#E2DACB"/><circle cx="1" cy="1" r=".55" fill="${C.ink}" opacity=".45"/></pattern>
        <pattern id="s-gravel" width="9" height="7" patternUnits="userSpaceOnUse"><rect width="9" height="7" fill="#ECEAE2"/><circle cx="2.5" cy="2.5" r="1.7" fill="none" stroke="${C.ink}" stroke-width=".45"/><circle cx="7" cy="5" r="1.3" fill="none" stroke="${C.ink}" stroke-width=".45"/></pattern>
        <pattern id="s-cells" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" fill="#E4DCC8"/><path d="M0 0H14V14" fill="none" stroke="${C.green2}" stroke-width=".8"/><circle cx="7" cy="7" r=".8" fill="${C.ink}" opacity=".4"/></pattern>
        <pattern id="s-root" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="#D9CBB0"/><path d="M0 5L5 0M0 0L5 5" stroke="${C.ink}" stroke-width=".35" opacity=".6"/></pattern>
        <pattern id="s-dense" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="#DAD8D0"/><path d="M0 0V4" stroke="${C.ink}" stroke-width=".8" opacity=".6"/></pattern>
        <clipPath id="s-rgclip"><path d="M640,${G}L660,${G}C690,${G} 700,330 755,330C810,330 820,${G} 850,${G}L860,${G}V440H640Z"/></clipPath>
      </defs>
      <rect width="1200" height="${G}" fill="url(#s-sky)"/>
      <rect x="0" y="${G}" width="1200" height="170" fill="url(#s-earth)"/>
      <ellipse cx="420" cy="${G + 2}" rx="150" ry="7" fill="rgba(28,33,29,.14)"/>`;

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
    s += `<path d="${blob(400, 92, 112, 11, 0.07, 4, 78)}" fill="url(#s-canopy)"/>
      <path d="${blob(372, 104, 58, 8, 0.1, 9, 44)}" fill="#fff" opacity=".14"/>
      <path d="${blob(440, 78, 50, 8, 0.1, 12, 36)}" fill="#fff" opacity=".14"/>
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
      if (i % 3 === 0) s += `<circle cx="${x + 3}" cy="${G - 52 - (i * 13) % 18}" r="3" fill="${i % 2 ? '#F2B280' : '#E5A9C0'}" stroke="${C.ink}" stroke-width=".5"/>`;
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
    const L = 'rgba(46,92,64,.7)', LL = 'rgba(28,33,29,.22)';
    let s = `<svg viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Схема собственного питомника">
      <path d="M0,200H600M300,0V400" stroke="#EEEBE2" stroke-width="18"/>
      <path d="M0,200H600M300,0V400" stroke="${LL}" stroke-width="1" stroke-dasharray="10 8"/>`;
    SECTORS.forEach((c) => {
      let g = `<rect class="bg" x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" rx="8" fill="#F6F4EE" stroke="${LL}" stroke-width="1"/>`;
      const R = rng(c.id.charCodeAt(0) * 7 + +c.id[1]);
      const ix = c.x + 10, iy = c.y + 26, iw = c.w - 20, ih = c.h - 34;
      if (c.k === 'dec' || c.k === 'dec2' || c.k === 'flw') {
        const st = c.k === 'dec' ? 19 : c.k === 'dec2' ? 16 : 17;
        for (let y = iy + st / 2; y < iy + ih; y += st) for (let x = ix + st / 2; x < ix + iw; x += st) {
          const r = st * (0.3 + R() * 0.12);
          g += c.k === 'flw'
            ? `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="rgba(232,136,78,.25)" stroke="${C.lime}" stroke-width=".6" stroke-dasharray="1.5 1.5"/>`
            : `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="rgba(63,122,86,.12)" stroke="${L}" stroke-width=".7"/><circle cx="${f1(x)}" cy="${f1(y)}" r="1" fill="${L}"/>`;
        }
      } else if (c.k === 'con') {
        for (let y = iy + 9; y < iy + ih; y += 17) for (let x = ix + 8 + ((y / 17) % 2) * 6; x < ix + iw; x += 15) {
          const h = 5 + R() * 2.5;
          g += `<path d="M${f1(x)},${f1(y - h)}L${f1(x + h * 0.8)},${f1(y + h * 0.7)}H${f1(x - h * 0.8)}Z" fill="rgba(63,122,86,.15)" stroke="${L}" stroke-width=".7"/>`;
        }
      } else if (c.k === 'shr' || c.k === 'shr2') {
        const st = c.k === 'shr' ? 9 : 7;
        for (let y = iy + 4; y < iy + ih; y += st) for (let x = ix + 4; x < ix + iw; x += st) {
          g += `<circle cx="${f1(x + (R() - 0.5) * 1.5)}" cy="${f1(y)}" r="${f1(st * 0.3)}" fill="${L}" opacity="${f1(0.4 + R() * 0.5)}"/>`;
        }
      } else if (c.k === 'gh') {
        for (let i = 0; i < 4; i++) {
          const y = iy + 2 + i * (ih / 4);
          g += `<rect x="${ix}" y="${f1(y)}" width="${iw}" height="${f1(ih / 4 - 7)}" fill="rgba(63,122,86,.08)" stroke="${L}" stroke-width=".7"/>`;
          for (let x = ix + 6; x < ix + iw; x += 8) g += `<line x1="${x}" y1="${f1(y)}" x2="${x}" y2="${f1(y + ih / 4 - 7)}" stroke="${LL}" stroke-width=".5"/>`;
        }
      } else if (c.k === 'pond') {
        g += `<path d="${blob(c.x + c.w / 2, c.y + 88, 44, 5, 0.1, 3, 40)}" fill="rgba(127,168,201,.35)" stroke="${C.water}" stroke-width="1"/>`;
        for (let i = 0; i < 4; i++) g += `<path d="M${c.x + 34 + i * 4},${c.y + 74 + i * 9}q6,-3 12,0t12,0t12,0" fill="none" stroke="${C.water}" stroke-width=".7" opacity=".7"/>`;
      }
      g += `<text x="${c.x + 8}" y="${c.y + 16}" font-family="JetBrains Mono, monospace" font-size="11" font-weight="600" fill="${C.green}">${c.id}</text>`;
      s += `<g class="np-sector" data-id="${c.id}" tabindex="0">${g}</g>`;
    });
    s += `<g transform="translate(578 384)"><circle r="9" fill="none" stroke="${LL}"/><path d="M0,-8L3.5,4L0,1.5L-3.5,4Z" fill="${C.green}"/></g></svg>`;
    host.innerHTML = s;

    const info = $('#npInfo');
    const pick = (g) => {
      $$('.np-sector', host).forEach((x) => x.classList.toggle('on', x === g));
      const c = SECTORS.find((x) => x.id === g.dataset.id);
      info.textContent = `${c.id} · ${c.t}`;
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
    ['Липа, крупномер 7 м', 'ствол 12–14 см, с комом', 48000, 31200],
    ['Сосна обыкновенная 4–5 м', 'с комом', 65000, 42300],
    ['Кустарники и многолетники', 'за м² посадок', 4200, 2750],
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
    { type: 'court', f: 'zhk', tag: 'Жилой комплекс', t: 'Двор-парк бизнес-класса', d: 'Двор без машин, четыре сценария досуга и дождевые сады вдоль главной аллеи.', m: ['2,9 га', '2025'] },
    { type: 'roof', f: 'zhk', tag: 'Жилой комплекс', t: 'Сад на кровле паркинга', d: 'Деревья до 6 м в кадках, деревянные деки и приватные патио над подземной парковкой.', m: ['0,6 га', '2025'] },
    { type: 'park', f: 'pub', tag: 'Парк', t: 'Городской парк у воды', d: 'Заброшенная территория стала парком с прудом, лугами, тропами и площадками для всех возрастов.', m: ['12 га', '2024'] },
    { type: 'embank', f: 'pub', tag: 'Набережная', t: 'Набережная и прогулочный маршрут', d: 'Несколько уровней у воды, понтоны, амфитеатр и аллея из взрослых деревьев.', m: ['1,8 км', '2024'] },
    { type: 'school', f: 'infra', tag: 'Школа', t: 'Территория школы на 1 100 мест', d: 'Стадион, учебные огороды, тихие дворики и безопасные маршруты от остановок.', m: ['3,4 га', '2025'] },
    { type: 'boulevard', f: 'infra', tag: 'Бульвар', t: 'Бульвар у станции метро', d: 'Двухрядная аллея, велодорожка, биодренаж вдоль проезжей части и площадь у входа в метро.', m: ['960 м', '2026'] },
  ];
  function projPlan(type, seed) {
    const R = rng(seed);
    const p = `p${seed}-`;
    let s = `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><defs>${RDEFS(p)}</defs><rect width="400" height="300" fill="#EFEDE6"/>`;
    const trees = [];
    const scatter = (n, test, rmin, rmax) => {
      for (let a = 0; a < n * 80 && n > 0; a++) {
        const x = R() * 400, y = R() * 300, r = rmin + R() * (rmax - rmin);
        if (!test(x, y, r)) continue;
        if (trees.some((t) => Math.hypot(t.x - x, t.y - y) < t.r + r + 2)) continue;
        trees.push({ x, y, r, k: R() < 0.72 ? 'dec' : R() < 0.6 ? 'con' : 'flw' }); n--;
      }
    };
    const road = (d, w) => walk(d, w, p, 0, 'static');
    const bld = (x, y, w, h) => building(x, y, w, h, p);

    if (type === 'court') {
      s += `<ellipse cx="200" cy="155" rx="96" ry="60" fill="url(#${p}lawn)"/>`;
      s += road('M200,300C200,260 200,230 200,215M104,155a96,60 0 1,0 192,0a96,60 0 1,0 -192,0M200,95C210,70 255,60 255,0', 12);
      s += `<circle cx="100" cy="100" r="30" fill="url(#${p}rubber)"/><circle cx="100" cy="100" r="20" fill="none" stroke="#fff" stroke-width="1.2" opacity=".8"/>`;
      s += `<path d="${blob(310, 225, 30, 5, 0.14, seed, 22)}" fill="url(#${p}pond)"/>`;
      scatter(34, (x, y, r) => x > 70 && x < 330 && y > 66 && y < 244 && ((x - 200) / 112) ** 2 + ((y - 155) / 76) ** 2 > 1 && Math.hypot(x - 100, y - 100) > 34 + r && Math.hypot(x - 310, y - 225) > 34 + r && Math.abs(x - 200) > 12 + r, 7, 12);
      scatter(4, (x, y, r) => ((x - 200) / 70) ** 2 + ((y - 155) / 40) ** 2 < 0.4, 9, 14);
      s += bld(10, 10, 230, 46) + bld(270, 10, 120, 46) + bld(10, 80, 46, 210) + bld(344, 80, 46, 150) + bld(80, 254, 230, 40);
    } else if (type === 'roof') {
      s += `<rect x="20" y="20" width="360" height="260" rx="6" fill="url(#${p}deck)"/>`;
      for (let y = 20; y < 280; y += 12) s += `<line x1="20" y1="${y}" x2="380" y2="${y}" stroke="#fff" stroke-width=".8" opacity=".45"/>`;
      const planters = [[40, 40, 120, 60], [190, 40, 80, 120], [300, 40, 60, 200], [40, 130, 60, 130], [130, 200, 140, 60]];
      planters.forEach(([x, y, w, h]) => { s += `<rect x="${x + 4}" y="${y + 5}" width="${w}" height="${h}" rx="10" fill="rgba(28,33,29,.14)" filter="url(#${p}soft)"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="url(#${p}lawn)"/>`; });
      s += `<rect x="115" y="120" width="60" height="50" rx="8" fill="url(#${p}pond)"/>`;
      planters.forEach(([x, y, w, h]) => scatter(Math.round(w * h / 1700), (tx, ty, r) => tx > x + r && tx < x + w - r && ty > y + r && ty < y + h - r, 7, 12));
    } else if (type === 'park') {
      s += `<path d="${blob(250, 150, 72, 4, 0.18, seed, 50)}" fill="url(#${p}pond)"/><path d="${blob(250, 150, 72, 4, 0.18, seed, 50)}" fill="none" stroke="#fff" stroke-width="1.2" opacity=".7"/>`;
      s += `<path d="${blob(110, 220, 62, 5, 0.15, seed + 2, 42)}" fill="url(#${p}lawn)"/>`;
      s += road('M0,90C80,70 140,110 170,150S190,260 260,290', 9) + road('M400,60C330,80 300,60 260,70S170,40 120,0', 8) + road('M340,300C340,250 320,230 330,200', 7);
      scatter(70, (x, y, r) => Math.hypot(x - 250, (y - 150) * 1.4) > 84 + r && Math.hypot(x - 110, (y - 220) * 1.4) > 70, 6, 13);
    } else if (type === 'embank') {
      s += `<rect x="0" y="205" width="400" height="95" fill="url(#${p}pond)"/>`;
      for (let i = 0; i < 6; i++) s += `<path d="M0,${222 + i * 14}q20,-4 40,0t40,0t40,0t40,0t40,0t40,0t40,0t40,0t40,0t40,0" fill="none" stroke="#fff" stroke-width=".8" opacity=".5"/>`;
      s += `<rect x="60" y="205" width="60" height="40" rx="3" fill="url(#${p}deck)"/><rect x="250" y="205" width="80" height="30" rx="3" fill="url(#${p}deck)"/>`;
      s += road('M0,180C120,176 280,184 400,178', 20) + road('M0,110C120,100 260,120 400,105', 9);
      s += `<path d="M150,200A40,40 0 0 1 230,200M162,200A28,28 0 0 1 218,200" fill="none" stroke="#fff" stroke-width="2"/>`;
      for (let x = 16; x < 400; x += 28) trees.push({ x, y: 148 + Math.sin(x / 40) * 3, r: 10, k: 'dec' });
      scatter(30, (x, y, r) => (y > 32 + r && y < 94 - r) || (y > 124 + r && y < 136 - r), 6, 11);
      s += bld(0, 0, 400, 26);
    } else if (type === 'school') {
      s += `<rect x="30" y="185" width="200" height="100" rx="50" fill="#E5D9BF"/><rect x="62" y="205" width="136" height="60" rx="4" fill="#BFD4B6" stroke="#fff" stroke-width="1.5"/><line x1="130" y1="205" x2="130" y2="265" stroke="#fff" stroke-width="1.5"/>`;
      for (let i = 0; i < 6; i++) s += `<rect x="${250 + (i % 3) * 38}" y="${200 + Math.floor(i / 3) * 40}" width="30" height="30" rx="6" fill="url(#${p}lawn)"/>`;
      s += road('M0,170H140M210,120H400M330,0V300', 9);
      scatter(44, (x, y, r) => (x < 140 - r && y < 160 - r) || (x > 320 + r && y < 110 - r) || (x > 210 && x < 320 && y > 130 + r && y < 190 - r) || (x > 345 && y > 130), 6, 12);
      s += bld(150, 30, 160, 50) + bld(150, 80, 50, 90);
    } else {
      s += `<rect x="0" y="0" width="400" height="70" fill="#E3E0D8"/><rect x="0" y="230" width="400" height="70" fill="#E3E0D8"/>`;
      s += `<path d="M0,35H400M0,265H400" stroke="#fff" stroke-width="1.5" stroke-dasharray="12 10"/>`;
      s += road('M0,118H400', 24) + `<path d="M0,170H400" stroke="#E8B48A" stroke-width="12"/><path d="M0,170H400" stroke="#fff" stroke-width=".8" stroke-dasharray="6 6"/>`;
      s += `<rect x="0" y="198" width="400" height="22" fill="url(#${p}lawn)"/>`;
      for (let x = 12; x < 300; x += 26) { trees.push({ x, y: 90, r: 11, k: 'dec' }); trees.push({ x: x + 13, y: 146, r: 11, k: 'dec' }); }
      s += `<rect x="300" y="72" width="100" height="90" fill="url(#${p}pave)"/><rect x="340" y="95" width="40" height="40" rx="6" fill="${C.ink}"/><text x="360" y="120" text-anchor="middle" font-family="Manrope" font-size="14" font-weight="700" fill="#fff">М</text>`;
    }
    trees.sort((a, b) => a.y - b.y).forEach((t) => { s += tree(t.x, t.y, t.r, t.k, undefined, p); });
    s += `</svg>`;
    return s;
  }
  function projects() {
    const host = $('#projGrid');
    if (!host) return;
    host.innerHTML = PROJECTS.map((p, i) => `
      <article class="pcard reveal" data-f="${p.f}">
        <div class="pcard__img">${projPlan(p.type, i + 3)}<span class="pcard__tag">${p.tag}</span></div>
        <div class="pcard__body"><h3>${p.t}</h3><p>${p.d}</p>
          <div class="pcard__meta">${p.m.map((m) => `<span>${m}</span>`).join('')}</div></div>
      </article>`).join('');
    $$('.filters button').forEach((b) => b.addEventListener('click', () => {
      $$('.filters button').forEach((x) => x.classList.toggle('on', x === b));
      $$('.pcard', host).forEach((c) => c.classList.toggle('hide', b.dataset.f !== 'all' && c.dataset.f !== b.dataset.f));
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
  const SAVING = 0.09;                 // экономия студии: свой питомник и свои бригады
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
      $('#oOurs').textContent = money(ours);
      $('#oSave').textContent = nf(SAVING * 100, 0) + '%';
      $('#oRoi').textContent = '×' + nf(rev / ours, 1);
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
    ['Анна Северина', 'Главный архитектор', 'Автор концепций для 60+ жилых комплексов. Стажировалась в ландшафтных бюро Нидерландов и Дании.'],
    ['Михаил Громов', 'Главный инженер', 'Вертикальная планировка, дренаж, эксплуатируемые кровли. Ведёт экспертизу и согласования с городом.'],
    ['Елена Вяземская', 'Главный дендролог', 'Подбирает и акклиматизирует растения, обследует существующие деревья, отвечает за гарантию.'],
    ['Артём Лесков', 'Директор по строительству', 'Собственные бригады, график с контрольными точками, качество и безопасность на объекте.'],
  ];
  function avatar(name, seed) {
    const R = rng(seed * 97 + 13);
    const cx = 30 + R() * 52, cy = 30 + R() * 50;
    let rings = '';
    for (let i = 0; i < 11; i++) rings += `<path d="${blob(cx, cy, 8 + i * 9, 3 + (i % 3), 0.09 + R() * 0.05, seed * 10 + i, (8 + i * 9) * (0.85 + R() * 0.2))}" fill="none" stroke="${C.green}" stroke-width="${i % 4 === 0 ? 1 : 0.5}" opacity="${i % 4 === 0 ? 0.6 : 0.28}"/>`;
    const ini = name.split(' ').map((w) => w[0]).join('');
    return `<svg viewBox="0 0 112 124" aria-hidden="true"><rect width="112" height="124" fill="#DDE6D5"/>${rings}
      <circle cx="${f1(cx)}" cy="${f1(cy)}" r="2.5" fill="${C.lime}"/>
      <text x="12" y="110" font-family="Unbounded, Manrope" font-size="26" font-weight="400" fill="${C.green}">${ini}</text></svg>`;
  }
  function team() {
    const host = $('#teamGrid'); if (!host) return;
    host.innerHTML = TEAM.map(([n, r, t], i) => `<article class="member reveal">${avatar(n, i + 1)}<div class="member__role">${r}</div><h3>${n}</h3><p>${t}</p></article>`).join('');
  }

  const STEPS = [
    ['Встреча и выезд', 'Смотрим участок, слушаем задачи по продажам, собираем исходные данные.', '1–3 дня'],
    ['Концепция', 'Зонирование, сценарии жизни во дворе, визуализации и бюджет-ориентир.', '3–5 недель'],
    ['Смета и договор', 'Фиксируем цену и график с контрольными точками.', '5 дней'],
    ['Проект и стройка', 'Рабочая документация, согласования, резерв растений в питомнике, собственные бригады.', '4–9 месяцев'],
    ['Сдача и уход', 'Приёмка, паспорт объекта для УК, два года гарантийного ухода.', '24 месяца'],
  ];
  function process() {
    const host = $('#steps'); if (!host) return;
    host.innerHTML = STEPS.map(([h, p, t], i) => `<li class="step reveal"><span class="step__n">Шаг ${i + 1}</span><h3>${h}</h3><p>${p}</p><span class="step__t">${t}</span></li>`).join('');
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
    $$('.reveal, .prices').forEach((el) => io.observe(el));
  }

  function form() {
    const f = $('#leadForm'); if (!f) return;
    const mail = $('#cMail').textContent.trim();
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      let ok = true;
      ['name', 'contact'].forEach((n) => {
        const inp = f.elements[n]; const bad = !inp.value.trim();
        inp.closest('.fld').classList.toggle('err', bad); if (bad) ok = false;
      });
      const msg = $('#formMsg');
      if (!ok) { msg.style.color = '#E8884E'; msg.textContent = 'Заполните имя и контакт — этого достаточно, чтобы мы связались.'; return; }
      const d = Object.fromEntries(new FormData(f));
      const body = `Имя: ${d.name}\nКомпания: ${d.company || '—'}\nКонтакт: ${d.contact}\nОбъект: ${d.type}\n\n${d.note || ''}`;
      location.href = `mailto:${mail}?subject=${encodeURIComponent('Заявка на проект — Живой двор')}&body=${encodeURIComponent(body)}`;
      msg.style.color = ''; msg.textContent = 'Письмо подготовлено в почтовом приложении — отправьте его, и мы ответим в течение рабочего дня.';
    });
  }

  /* ---------- запуск ---------- */
  heroPlan();
  sectionDrawing();
  nurseryPlan();
  priceRows();
  projects();
  calc();
  team();
  process();
  nav();
  form();
  observe();
})();
