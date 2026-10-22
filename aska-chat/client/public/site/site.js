// Сайт АСЬКИ: две подачи — «Зумер» (тёмная роскошь, коротко) и «Миллениал» (Windows 98, подробно).
// Номера рисуются тем же разбором, что Plate.tsx; 3D — цветок (flower3d.js), плита номера, монета и телефон из слоёв CSS.
// Без библиотек: CSP сайта разрешает только свои скрипты.
(() => {
  'use strict';
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const NS = 'http://www.w3.org/2000/svg';
  const style = () => root.dataset.style || 'z';
  const onView = (el, cb, opts) => { const io = new IntersectionObserver(([e]) => cb(e.isIntersecting), opts); io.observe(el); return io; };

  /* ===================================================== номера */
  function plateParts(country, code) {
    let m;
    switch (country) {
      case 'RU': m = /^([А-Я])(\d{3})([А-Я]{2})(\d{2,3})$/.exec(code); return m && { main: [m[1], m[2], m[3]], region: m[4] };
      case 'BY': m = /^(\d{4})([A-Z]{2})-(\d)$/.exec(code); return m && { main: `${m[1]} ${m[2]}-${m[3]}` };
      case 'KZ': m = /^(\d{3})([A-Z]{3})(\d{2})$/.exec(code); return m && { main: `${m[1]} ${m[2]}`, region: m[3] };
      case 'AM': m = /^(\d{2})([A-Z]{2})(\d{3})$/.exec(code); return m && { main: `${m[1]} ${m[2]} ${m[3]}` };
      case 'GE': m = /^([A-Z]{2})(\d{3})([A-Z]{2})$/.exec(code); return m && { main: `${m[1]}-${m[2]}-${m[3]}` };
      case 'DE': m = /^(B|M|HH|K|F)-([A-Z]{1,2})(\d{1,4})$/.exec(code); return m && { main: `${m[1]} ${m[2]} ${m[3]}` };
      case 'US':
        if (/^\d[A-Z]{3}\d{3}$/.test(code)) return { main: code, region: 'CA' };
        m = /^([A-Z]{3})(\d{4})$/.exec(code); return m && { main: `${m[1]}-${m[2]}`, region: 'NY' };
      case 'AE': m = /^([A-Z])(\d{1,5})$/.exec(code); return m && { main: `${m[1]} ${m[2]}` };
      case 'GB': m = /^(L[A-Z])(\d{2})([A-Z]{3})$/.exec(code); return m && { main: `${m[1]}${m[2]} ${m[3]}` };
      default: return null;
    }
  }
  const BAND = { BY: 'BY', KZ: 'KZ', AM: 'AM', GE: 'GE', DE: 'D', GB: 'UK' };
  const isGold = (country, code) => country === 'RU' && /^А\d{3}МР\d{2,3}$/.test(code);
  function plateHTML(country, code, level = 0, size = 'm') {
    const p = plateParts(country, code);
    if (!p) return '';
    const cls = `aska-plate c-${country} ${size} lvl-${level}${isGold(country, code) ? ' gold' : ''}`;
    if (country === 'RU') {
      const [a, num, bc] = p.main;
      return `<span class="${cls}" role="img" aria-label="номер ${a} ${num} ${bc} ${p.region}"><span class="main"><i>${a}</i><b>${num}</b><i>${bc}</i></span><span class="reg"><b>${p.region}</b><small>RUS<em class="flag f-RU"></em></small></span></span>`;
    }
    return `<span class="${cls}" role="img" aria-label="номер ${p.main}${p.region && country === 'KZ' ? ` ${p.region}` : ''}">`
      + (BAND[country] ? `<span class="band"><em class="flag f-${country}"></em><small>${BAND[country]}</small></span>` : '')
      + (country === 'US' ? `<span class="top">${p.region === 'NY' ? 'NEW YORK' : 'California'}</span>` : '')
      + (country === 'AE' ? '<span class="band ae"><small>DUBAI</small><small>دبي</small></span>' : '')
      + `<span class="main"><b>${p.main}</b></span>`
      + (country === 'KZ' ? `<span class="reg"><b>${p.region}</b></span>` : '')
      + '</span>';
  }
  for (const el of $$('[data-plate]')) {
    const [country, code] = el.dataset.plate.split(':');
    el.innerHTML = plateHTML(country, code, Number(el.dataset.lvl || 0), el.dataset.size || 'm');
  }
  const RIBBON = {
    a: [['RU', 'А777АА777', 5], ['BY', '7777AA-7', 2], ['KZ', '777AAA02', 3], ['RU', 'О001ОО77', 4], ['US', '7AAA777', 1], ['AE', 'A777', 5],
      ['RU', 'Т116ТТ116', 2], ['GB', 'LA77AAA', 0], ['DE', 'B-AA777', 3], ['RU', 'А001МР777', 0], ['AM', '77AA777', 1], ['GE', 'AA777AA', 0]],
    b: [['RU', 'Е007КХ99', 3], ['US', 'AAA7777', 2], ['RU', 'М888ММ197', 1], ['KZ', '123ABC02', 0], ['RU', 'С123СС78', 4], ['DE', 'M-AB1234', 0],
      ['BY', '1234AB-7', 0], ['RU', 'Х100ХХ777', 5], ['AE', 'B12345', 1], ['GB', 'LB21XYZ', 2], ['AM', '12AB345', 0], ['RU', 'А777МР777', 0], ['GE', 'QW123ER', 3]],
  };
  for (const el of $$('[data-marquee]')) {
    const html = RIBBON[el.dataset.marquee].map(([c, code, l]) => plateHTML(c, code, l, 'l')).join('');
    el.innerHTML = html + html;
  }

  /* ===================================================== печать и гильош (Зумер) */
  function flowerSVG(cx, cy, k) {
    let s = '';
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 - Math.PI / 2;
      s += `<circle cx="${(cx + 5 * k * Math.cos(a)).toFixed(2)}" cy="${(cy + 5 * k * Math.sin(a)).toFixed(2)}" r="${(2.7 * k).toFixed(2)}" fill="${i === 3 ? 'url(#seal-red)' : 'url(#seal-gold)'}" stroke="#2a1d07" stroke-width="${(0.35 * k).toFixed(2)}"/>`;
    }
    return `${s}<circle cx="${cx}" cy="${cy}" r="${(2.5 * k).toFixed(2)}" fill="#0b0c12" stroke="url(#seal-gold)" stroke-width="${(0.5 * k).toFixed(2)}"/>`;
  }
  const DEFS = '<defs><linearGradient id="seal-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3e0b3"/><stop offset=".5" stop-color="#d9b26b"/><stop offset="1" stop-color="#9c7a3c"/></linearGradient>'
    + '<linearGradient id="seal-red" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8a7a"/><stop offset="1" stop-color="#b8141c"/></linearGradient>'
    + '<path id="seal-path" d="M100 100m-80 0a80 80 0 1 1 160 0a80 80 0 1 1 -160 0"/></defs>';
  let dots = '';
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    dots += `<circle cx="${(100 + 93 * Math.cos(a)).toFixed(2)}" cy="${(100 + 93 * Math.sin(a)).toFixed(2)}" r="${i % 6 === 0 ? 1.3 : 0.6}" fill="#d9b26b" opacity="${i % 6 === 0 ? 0.9 : 0.5}"/>`;
  }
  const SEAL_BIG = `<svg viewBox="0 0 200 200">${DEFS}<circle cx="100" cy="100" r="98" fill="none" stroke="#d9b26b" stroke-opacity=".55" stroke-width=".8"/>${dots}`
    + '<g class="ring-text"><text font-family="Manrope, sans-serif" font-size="10.5" font-weight="600" letter-spacing="3.2" fill="#d9b26b"><textPath href="#seal-path">АСЬКА · INTER NOS · MMXXVI · МЕССЕНДЖЕР ДЛЯ СВОИХ ·</textPath></text></g>'
    + `<circle cx="100" cy="100" r="66" fill="rgba(7,8,12,.6)" stroke="#d9b26b" stroke-opacity=".7" stroke-width=".8"/>${flowerSVG(100, 100, 7.4)}</svg>`;
  const SEAL_SMALL = `<svg viewBox="0 0 200 200">${DEFS}<circle cx="100" cy="100" r="94" fill="none" stroke="#d9b26b" stroke-opacity=".7" stroke-width="6"/>${flowerSVG(100, 100, 9.6)}</svg>`;
  $$('[data-seal]').forEach((el) => { el.innerHTML = el.dataset.seal === 'small' ? SEAL_SMALL : SEAL_BIG; });

  function troch(R, r, d, turns, steps, s) {
    let path = '';
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2 * turns;
      const x = 250 + s * ((R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t));
      const y = 250 + s * ((R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t));
      path += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return path;
  }
  const sprite = $('svg.sprite');
  const sym = (id, inner) => { const s = document.createElementNS(NS, 'symbol'); s.id = id; s.setAttribute('viewBox', '0 0 500 500'); s.innerHTML = inner; sprite.appendChild(s); };
  sym('g-a', `<path d="${troch(100, 36, 62, 9, 1600, 1.9)}" fill="none" stroke="#d9b26b" stroke-width=".45" stroke-opacity=".55"/>`);
  sym('g-b', `<path d="${troch(100, 28, 44, 7, 1300, 2.15)}" fill="none" stroke="#8e7bf5" stroke-width=".4" stroke-opacity=".45"/><circle cx="250" cy="250" r="238" fill="none" stroke="#d9b26b" stroke-opacity=".25" stroke-width=".6"/>`);
  $$('.guilloche').forEach((el) => { el.innerHTML = '<svg viewBox="0 0 500 500"><g><use href="#g-a"/></g><g><use href="#g-b"/></g></svg>'; });

  /* ===================================================== 3D из слоёв: плита номера, монета, телефон */
  function layer(parent, cls, z) { const i = document.createElement('i'); i.className = cls; i.style.setProperty('--z', z); parent.insertBefore(i, parent.firstChild); return i; }
  for (const slab of $$('[data-slab]')) {
    const plate = $('.aska-plate', slab);
    if (!plate) continue;
    if (plate.classList.contains('gold')) slab.classList.add('gold');
    const h = parseFloat(getComputedStyle(plate).getPropertyValue('--h')) || 34;
    slab.style.setProperty('--h', `${h}px`);
    const depth = Math.max(4, Math.round(h * 0.16));
    for (let k = 1; k <= depth; k++) layer(slab, k === depth ? 'sl back' : 'sl', k);
  }
  for (const coin of $$('[data-coin]')) {
    const t = parseFloat(getComputedStyle(coin).getPropertyValue('--t')) || 18;
    const n = Math.round(t);
    for (let k = 0; k < n; k++) { const i = document.createElement('i'); i.className = 'ce'; i.style.setProperty('--z', (k - n / 2 + 0.5).toFixed(1)); coin.appendChild(i); }
  }
  for (const ph of $$('[data-phone3d]')) for (let k = 1; k <= 12; k++) layer(ph, 'pl', k * 1.4);

  /* ===================================================== 3D-цветок: монтируется, когда виден */
  const flowers = new Map();
  function mountFlowers() {
    if (!window.AskaFlower) return;
    for (const c of $$('canvas[data-flower]')) {
      if (flowers.has(c) || !c.closest(style() === 'm' ? '.v-m' : '.v-z')) continue;
      if (!c.clientWidth) continue;
      flowers.set(c, null);
      onView(c, (v) => {
        if (!v || flowers.get(c)) return;
        flowers.set(c, window.AskaFlower.mount(c, { theme: c.dataset.flower }) || 'fail');
      }, { rootMargin: '200px' });
    }
  }

  /* ===================================================== звёзды */
  function twinkleSky(canvas) {
    const ctx = canvas.getContext('2d');
    let w = 0; let h = 0; let stars = []; let shoot = null; let next = 0; let visible = false; let raf = 0;
    const dpr = Math.min(2, devicePixelRatio || 1);
    function resize() {
      w = canvas.clientWidth; h = canvas.clientHeight;
      if (!w || !h) return;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.min(420, Math.round((w * h) / 2600));
      stars = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, r: Math.random() ** 2.2 * 1.5 + 0.25, p: Math.random() * 6.28, s: 0.4 + Math.random() * 1.4, z: Math.random(),
        c: Math.random() < 0.12 ? '243,224,179' : Math.random() < 0.2 ? '190,180,255' : '255,255,255' }));
      draw(performance.now());
    }
    function draw(t) {
      ctx.clearRect(0, 0, w, h);
      const ox = (window.__mx || 0) * 10; const oy = (window.__my || 0) * 8;
      for (const st of stars) {
        const a = reduce ? 0.7 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(st.p + (t / 1000) * st.s));
        const x = st.x + ox * st.z; const y = st.y + oy * st.z;
        ctx.beginPath(); ctx.fillStyle = `rgba(${st.c},${(a * (0.4 + st.z * 0.6)).toFixed(3)})`; ctx.arc(x, y, st.r, 0, 6.283); ctx.fill();
        if (st.r > 1.25) {
          ctx.strokeStyle = `rgba(${st.c},${(a * 0.35).toFixed(3)})`; ctx.lineWidth = 0.5;
          ctx.beginPath(); ctx.moveTo(x - st.r * 4, y); ctx.lineTo(x + st.r * 4, y); ctx.moveTo(x, y - st.r * 4); ctx.lineTo(x, y + st.r * 4); ctx.stroke();
        }
      }
      if (reduce) return;
      if (!shoot && t > next) shoot = { x: Math.random() * w * 0.8 + w * 0.1, y: Math.random() * h * 0.35, vx: -(3 + Math.random() * 3), vy: 1.4 + Math.random() * 1.2, life: 0 };
      if (shoot) {
        shoot.life += 1; shoot.x += shoot.vx; shoot.y += shoot.vy;
        const g = ctx.createLinearGradient(shoot.x, shoot.y, shoot.x - shoot.vx * 22, shoot.y - shoot.vy * 22);
        const fade = Math.max(0, 1 - shoot.life / 70);
        g.addColorStop(0, `rgba(243,224,179,${0.9 * fade})`); g.addColorStop(1, 'rgba(243,224,179,0)');
        ctx.strokeStyle = g; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(shoot.x, shoot.y); ctx.lineTo(shoot.x - shoot.vx * 22, shoot.y - shoot.vy * 22); ctx.stroke();
        if (shoot.life > 70) { shoot = null; next = t + 3500 + Math.random() * 6000; }
      }
    }
    const loop = (t) => { draw(t); raf = visible ? requestAnimationFrame(loop) : 0; };
    new ResizeObserver(resize).observe(canvas);
    if (!reduce) onView(canvas, (v) => { visible = v; if (v && !raf) raf = requestAnimationFrame(loop); });
  }
  $$('canvas.sky').forEach(twinkleSky);

  // Заставка «Звёздное небо» из Windows: звёзды летят на зрителя
  function starfield(canvas) {
    const ctx = canvas.getContext('2d');
    let w = 0; let h = 0; let visible = false; let raf = 0;
    const stars = Array.from({ length: 220 }, () => ({ x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2, z: Math.random() }));
    function resize() { w = canvas.clientWidth; h = canvas.clientHeight; if (!w) return; canvas.width = w; canvas.height = h; draw(); }
    function draw() {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      for (const s of stars) {
        if (!reduce) { s.z -= 0.006; if (s.z <= 0.02) { s.x = (Math.random() - 0.5) * 2; s.y = (Math.random() - 0.5) * 2; s.z = 1; } }
        const k = 0.5 / s.z; const x = w / 2 + s.x * k * w * 0.5; const y = h / 2 + s.y * k * h * 0.5;
        if (x < 0 || x > w || y < 0 || y > h) continue;
        const r = Math.max(0.6, (1 - s.z) * 2.4);
        ctx.fillStyle = `rgba(255,255,255,${(1 - s.z).toFixed(2)})`; ctx.fillRect(x, y, r, r);
      }
    }
    const loop = () => { draw(); raf = visible ? requestAnimationFrame(loop) : 0; };
    new ResizeObserver(resize).observe(canvas);
    if (!reduce) onView(canvas, (v) => { visible = v; if (v && !raf) raf = requestAnimationFrame(loop); });
  }
  $$('canvas.starfield').forEach(starfield);

  /* ===================================================== появление, счётчики */
  function countUp(el) {
    const to = Number(el.dataset.count);
    if (reduce || !to) { el.textContent = String(to); return; }
    const t0 = performance.now();
    const step = (t) => { const k = Math.min(1, (t - t0) / 1300); el.textContent = String(Math.round(to * (1 - (1 - k) ** 3))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  const shown = (el) => { el.classList.add('in'); $$('[data-count]', el).forEach(countUp); if (el.matches('[data-count]')) countUp(el); };
  const revealables = $$('.v-z .reveal, .v-m .win');
  if (reduce) revealables.forEach(shown);
  else {
    const io = new IntersectionObserver((entries) => {
      let k = 0;
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.style.setProperty('--rd', `${Math.min(k++, 6) * 90}ms`);
        shown(e.target); io.unobserve(e.target);
      }
    }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
    revealables.forEach((el) => io.observe(el));
  }

  /* ===================================================== Зумер: шапка, параллакс */
  const nav = $('.nav'); const bar = $('.v-z .progress');
  let ticking = false;
  function onScroll() {
    ticking = false;
    if (style() !== 'z') return;
    nav.classList.toggle('solid', scrollY > 30);
    const max = root.scrollHeight - innerHeight;
    bar.style.setProperty('--p', max > 0 ? (scrollY / max).toFixed(4) : 0);
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  const links = $$('.links a');
  const spy = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) links.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === `#${e.target.id}`));
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('.v-z section[id]').forEach((s) => spy.observe(s));
  if (finePointer && !reduce) {
    let tx = 0; let ty = 0; let cx = 0; let cy = 0; let running = false;
    const tick = () => { cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08; window.__mx = cx; window.__my = cy; running = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.002; if (running) requestAnimationFrame(tick); };
    addEventListener('pointermove', (e) => { tx = (e.clientX / innerWidth) * 2 - 1; ty = (e.clientY / innerHeight) * 2 - 1; if (!running) { running = true; requestAnimationFrame(tick); } }, { passive: true });
  }

  /* ===================================================== уровни сияния (обе подачи) */
  const NOTES = [
    'Базовая рамка — так выглядит любой новый номер.',
    'Серебро — двойная стальная рамка. 60 аськоинов.',
    'Неон — рамка светится и переливается от голубого к розовому. 150 аськоинов.',
    'Голограмма — по номеру бегут радужные блики. 350 аськоинов.',
    'Платина — металлический номер с бегущим бликом. 800 аськоинов.',
    'Бриллиант — белое сияние с искрами. 2000 аськоинов, а все улучшения подряд — 3360.',
  ];
  for (const box of $$('[data-levels]')) {
    const plate = $('[data-level-target] .aska-plate', box);
    const ctrls = $$('[data-lvl]', box);
    const note = $('.level-note', box) || $('.level-note', box.parentElement);
    const auto = ctrls[0] && ctrls[0].tagName === 'BUTTON';
    const CYCLE = 2600; let lvl = 0; let timer = 0; let inView = false; let manual = false;
    box.style.setProperty('--cycle', `${CYCLE}ms`);
    if (auto) ctrls.forEach((b) => { const i = document.createElement('i'); i.className = 'bar'; b.appendChild(i); b.setAttribute('role', 'tab'); });
    function set(n) {
      lvl = n;
      plate.className = plate.className.replace(/\blvl-\d\b/, `lvl-${n}`);
      plate.classList.remove('bump'); void plate.offsetWidth; plate.classList.add('bump');
      ctrls.forEach((c, i) => { if (auto) c.setAttribute('aria-selected', String(i === n)); else c.checked = i === n; });
      if (note) note.textContent = NOTES[n];
    }
    const schedule = () => { clearTimeout(timer); if (!auto || manual || !inView || reduce) return; timer = setTimeout(() => { set((lvl + 1) % 6); schedule(); }, CYCLE); };
    ctrls.forEach((c, i) => c.addEventListener(auto ? 'click' : 'change', () => { manual = true; box.classList.add('manual'); clearTimeout(timer); set(i); }));
    onView(box, (v) => { inView = v; if (v) { if (auto && !manual) set(lvl); schedule(); } else clearTimeout(timer); }, { threshold: 0.4 });
    const stage = $('[data-stage]', box); const slab = $('[data-slab]', box);
    if (stage && slab && finePointer && !reduce) {
      stage.addEventListener('pointermove', (e) => {
        const r = stage.getBoundingClientRect();
        slab.style.setProperty('--ry', `${(((e.clientX - r.left) / r.width - 0.5) * 50).toFixed(1)}deg`);
        slab.style.setProperty('--rx', `${(-((e.clientY - r.top) / r.height - 0.5) * 34).toFixed(1)}deg`);
      });
      stage.addEventListener('pointerleave', () => { slab.style.setProperty('--ry', '-14deg'); slab.style.setProperty('--rx', '8deg'); });
    }
    if (slab) { slab.style.setProperty('--ry', '-14deg'); slab.style.setProperty('--rx', '8deg'); }
  }

  /* ===================================================== Зумер: экскурсия по экранам */
  const tour = $('.tour');
  if (tour) {
    const tabs = $$('[role="tab"]', tour); const img = $('.phone img', tour); const cap = $('.tour-cap', tour);
    const phone = $('[data-phone3d]', tour);
    let cur = 0; let timer = 0; let inView = false; let auto = !reduce;
    function show(i) {
      cur = i;
      tabs.forEach((t, k) => t.setAttribute('aria-selected', String(k === i)));
      const t = tabs[i];
      img.classList.add('out');
      setTimeout(() => { img.src = `/site/img/${t.dataset.src}.webp`; img.alt = t.textContent.trim(); img.onload = () => img.classList.remove('out'); if (img.complete) img.classList.remove('out'); }, 180);
      cap.textContent = t.dataset.cap;
      tabs[i].scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    }
    const loop = () => { clearTimeout(timer); tour.classList.toggle('auto', auto && inView); if (auto && inView) timer = setTimeout(() => { show((cur + 1) % tabs.length); loop(); }, 4500); };
    tabs.forEach((t, i) => t.addEventListener('click', () => { auto = false; tour.classList.remove('auto'); clearTimeout(timer); show(i); }));
    onView(tour, (v) => { inView = v; loop(); }, { threshold: 0.35 });
    tabs.forEach((t) => { const pre = new Image(); pre.src = `/site/img/${t.dataset.src}.webp`; });
    if (phone && finePointer && !reduce) {
      const stage = $('.tour-stage', tour);
      stage.addEventListener('pointermove', (e) => {
        const r = stage.getBoundingClientRect();
        phone.style.setProperty('--ry', `${(((e.clientX - r.left) / r.width - 0.5) * 34).toFixed(1)}deg`);
        phone.style.setProperty('--rx', `${(-((e.clientY - r.top) / r.height - 0.5) * 18).toFixed(1)}deg`);
      });
      stage.addEventListener('pointerleave', () => { phone.style.removeProperty('--ry'); phone.style.removeProperty('--rx'); });
    }
  }

  /* ===================================================== Зумер: ползунок дизайнов, шифр, подсветка плиток, наклон рангов */
  for (const cmp of $$('.compare')) {
    const r = $('input', cmp);
    r.addEventListener('input', () => cmp.style.setProperty('--pos', `${r.value}%`));
  }
  for (const el of $$('[data-scramble]')) {
    const text = el.dataset.scramble; const GL = 'ЖЪЫЭЮ#$%&@Ϟ§¥ΞΨΩ0123456789ABCDEFxyzqw';
    let on = false; let raf = 0; let t0 = 0;
    const frame = (t) => {
      if (!on) { raf = 0; return; }
      const ph = ((t - t0) / 1000) % 4.4; // 0–1.4 шифруется, 1.4–3.6 шифр, 3.6–4.4 обратно
      const k = ph < 1.4 ? ph / 1.4 : ph < 3.6 ? 1 : 1 - (ph - 3.6) / 0.8;
      el.textContent = [...text].map((ch, i) => (ch === ' ' ? ' ' : (i / text.length < k ? GL[(Math.random() * GL.length) | 0] : ch))).join('');
      raf = requestAnimationFrame(frame);
    };
    if (reduce) el.textContent = 'ЖΞ7#§ Ϟ$ Ψ@Ω0? %&';
    else onView(el, (v) => { on = v; if (v && !raf) { t0 = performance.now(); raf = requestAnimationFrame(frame); } });
  }
  if (finePointer && !reduce) {
    for (const f of $$('.tile')) f.addEventListener('pointermove', (e) => { const r = f.getBoundingClientRect(); f.style.setProperty('--x', `${e.clientX - r.left}px`); f.style.setProperty('--y', `${e.clientY - r.top}px`); });
    for (const card of $$('[data-tilt]')) {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width; const y = (e.clientY - r.top) / r.height;
        card.style.setProperty('--rx', `${((x - 0.5) * 10).toFixed(2)}deg`); card.style.setProperty('--ry', `${(-(y - 0.5) * 8).toFixed(2)}deg`);
        card.style.setProperty('--gx', `${(x * 100).toFixed(1)}%`); card.style.setProperty('--gy', `${(y * 100).toFixed(1)}%`);
      });
      card.addEventListener('pointerleave', () => { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
    }
  }

  /* ===================================================== «о-оу»: настоящий звук ICQ с сервера, иначе — синтезированный */
  let realSound = null;
  function ohOh(btn) {
    const synth = () => { try { window.AskaSound?.unlock(); window.AskaSound?.play('incoming'); } catch (e) { /* без звука */ } };
    if (realSound === false) synth();
    else {
      const a = new Audio('/sounds/uh-oh.wav');
      a.play().then(() => { realSound = true; }).catch(() => { realSound = false; synth(); });
    }
    const wave = btn.closest('.tile')?.querySelector('.wave');
    if (wave) { wave.classList.remove('play'); void wave.offsetWidth; wave.classList.add('play'); }
  }
  $$('[data-sound]').forEach((b) => b.addEventListener('click', () => ohOh(b)));

  /* ===================================================== Миллениал: окна, вкладки, просмотрщик, мастер, справка, калькулятор */
  const wins = $$('.v-m .win');
  for (const w of wins) {
    for (const b of $$('[data-win]', w)) {
      b.addEventListener('click', () => {
        if (b.dataset.win === 'max') { w.classList.toggle('max'); w.classList.remove('min'); if (!w.classList.contains('max')) w.scrollIntoView({ block: 'start' }); }
        else { w.classList.toggle('min'); w.classList.remove('max'); }
        syncTasks();
      });
    }
  }
  // активное окно — то, что ближе к середине экрана
  const activeIO = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { wins.forEach((w) => w.classList.toggle('active', w === e.target)); syncTasks(); }
  }, { rootMargin: '-40% 0px -55% 0px' });
  wins.forEach((w) => activeIO.observe(w));
  const tasks = $('[data-tasks]');
  wins.forEach((w) => {
    if (!w.id && !w.classList.contains('w-hero')) return;
    const b = document.createElement('button'); b.type = 'button';
    const ico = $('.title .t-ico', w).cloneNode(); b.appendChild(ico);
    b.appendChild(document.createTextNode($('.title h1, .title h2', w).textContent.replace(/^АСЬКА 98 — /, '')));
    b.addEventListener('click', () => { w.classList.remove('min'); w.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); });
    b._win = w; tasks.appendChild(b);
  });
  function syncTasks() { $$('button', tasks).forEach((b) => b.classList.toggle('on', b._win.classList.contains('active') && !b._win.classList.contains('min'))); }

  for (const tb of $$('[data-tabs]')) {
    const tabs = $$(':scope > .tablist > [role="tab"]', tb); const panels = $$(':scope > .tabpanel', tb);
    const sel = (i) => { tabs.forEach((t, k) => { t.setAttribute('aria-selected', String(k === i)); t.tabIndex = k === i ? 0 : -1; }); panels.forEach((p, k) => { p.hidden = k !== i; }); };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => sel(i));
      t.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length; sel(n); tabs[n].focus(); } });
    });
  }
  for (const v of $$('[data-viewer]')) {
    const items = $$('.v-thumbs [role="option"]', v); const img = $('.v-main img', v); const cap = $('.v-cap', v);
    let cur = 0;
    const show = (i) => {
      cur = (i + items.length) % items.length; const it = items[cur];
      items.forEach((b, k) => b.setAttribute('aria-selected', String(k === cur)));
      img.classList.add('out');
      setTimeout(() => { img.src = `/site/img/${it.dataset.src}.webp`; img.alt = it.textContent.replace('.bmp', ''); img.onload = () => img.classList.remove('out'); if (img.complete) img.classList.remove('out'); }, 120);
      cap.textContent = it.dataset.cap;
      it.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    };
    items.forEach((b, i) => b.addEventListener('click', () => show(i)));
    $$('[data-viewer-step]', v).forEach((b) => b.addEventListener('click', () => show(cur + Number(b.dataset.viewerStep))));
  }
  for (const wz of $$('[data-wizard]')) {
    const steps = $$('.wiz-step', wz); const back = $('[data-wiz="-1"]', wz); const next = $('[data-wiz="1"]', wz); const done = $('[data-wiz-done]', wz);
    let cur = 0;
    const show = (i) => {
      cur = Math.max(0, Math.min(steps.length - 1, i));
      steps.forEach((s, k) => { s.hidden = k !== cur; });
      back.disabled = cur === 0; const last = cur === steps.length - 1;
      next.hidden = last; done.hidden = !last;
    };
    back.addEventListener('click', () => show(cur - 1)); next.addEventListener('click', () => show(cur + 1));
    show(0);
  }
  for (const h of $$('[data-help]')) {
    const qs = $$('.help-list [role="option"]', h); const pages = $$('.help-page', h);
    qs.forEach((q, i) => q.addEventListener('click', () => { qs.forEach((x, k) => x.setAttribute('aria-selected', String(k === i))); pages.forEach((p, k) => { p.hidden = k !== i; }); }));
  }
  for (const c of $$('[data-calc]')) {
    const want = $('[data-calc-want]', c); const have = $('[data-calc-have]', c); const friend = $('[data-calc-friend]', c); const out = $('[data-calc-out]', c);
    const calc = () => {
      const price = Number(want.value); const start = Math.max(0, Number(have.value) || 0) + (friend.checked ? 50 : 0);
      const need = price - start;
      if (need <= 0) { out.innerHTML = `Хватает уже сейчас! Останется <b>${-need}</b> аськоинов.`; return; }
      const days = Math.ceil(need / 20);
      out.innerHTML = `Не хватает <b>${need}</b>. Если заходить каждый день (+20), наберётся за <b>${days}</b> ${days % 10 === 1 && days % 100 !== 11 ? 'день' : days % 10 >= 2 && days % 10 <= 4 && (days % 100 < 10 || days % 100 >= 20) ? 'дня' : 'дней'}.${friend.checked ? '' : ' С каждым приглашённым другом — на 2–3 дня быстрее.'}`;
    };
    [want, have, friend].forEach((el) => el.addEventListener('input', calc));
    calc();
  }
  const connect = $('[data-connect]');
  if (connect) {
    const text = $('[data-connect-text]', connect); let done = false;
    onView(connect, (v) => {
      if (!v || done) return; done = true;
      const lines = ['Набор номера…', 'Проверка имени пользователя и пароля…', 'Подключение к АСЬКЕ…', 'Соединение установлено. Свои уже в сети 🌼'];
      lines.forEach((l, i) => setTimeout(() => { text.textContent = l; }, reduce ? 0 : i * 800));
    }, { threshold: 0.5 });
  }

  // Пуск и часы
  const start = $('.taskbar .start'); const menu = $('#startmenu');
  const closeMenu = () => { menu.hidden = true; start.setAttribute('aria-expanded', 'false'); };
  start.addEventListener('click', (e) => { e.stopPropagation(); const open = menu.hidden; menu.hidden = !open; start.setAttribute('aria-expanded', String(open)); if (open) $('a, button', menu)?.focus(); });
  document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target)) closeMenu(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { closeMenu(); start.focus(); } });
  $$('a', menu).forEach((a) => a.addEventListener('click', closeMenu));
  const clock = $('[data-clock]');
  const tickClock = () => { const d = new Date(); clock.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  tickClock(); setInterval(tickClock, 20000);

  /* ===================================================== смена подачи */
  const splash = $('.switch-splash'); const theme = $('meta[name="theme-color"]');
  function syncControls() {
    const s = style();
    $$('[data-set-style]').forEach((el) => {
      const on = el.dataset.setStyle === s;
      if (el.type === 'radio') el.checked = on;
      else { if (el.hasAttribute('aria-pressed')) el.setAttribute('aria-pressed', String(on)); el.classList.toggle('on', on); }
    });
    theme.setAttribute('content', s === 'm' ? '#008080' : '#07080c');
  }
  function setStyle(s, animate = true) {
    if (s === style()) return;
    closeMenu();
    const apply = () => {
      root.dataset.style = s;
      try { localStorage.setItem('aska-site-style', s); } catch (e) { /* приватный режим */ }
      syncControls(); scrollTo(0, 0); onScroll();
      requestAnimationFrame(mountFlowers);
    };
    if (!animate || reduce) { apply(); return; }
    splash.className = `switch-splash go to-${s}`;
    setTimeout(apply, 260);
    setTimeout(() => { splash.className = 'switch-splash'; }, 1150);
  }
  $$('[data-set-style]').forEach((el) => el.addEventListener(el.type === 'radio' ? 'change' : 'click', () => setStyle(el.dataset.setStyle)));
  syncControls(); onScroll();
  if (document.readyState === 'complete') mountFlowers(); else addEventListener('load', mountFlowers);
  mountFlowers();
})();
