// Сайт АСЬКИ: номера (как в приложении), печать с цветком, гильош, звёздное небо, появление при прокрутке,
// демо уровней сияния, переключатель дизайнов, наклон карточек. Без библиотек — CSP сайта разрешает только свои скрипты.
(() => {
  'use strict';
  const root = document.documentElement;
  root.classList.add('js');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const NS = 'http://www.w3.org/2000/svg';

  /* ---------- номера: те же форматы, что в client/src/components/Plate.tsx ---------- */
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
    const label = `номер ${p.main}${p.region && country === 'KZ' ? ` ${p.region}` : ''}`;
    return `<span class="${cls}" role="img" aria-label="${label}">`
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

  // Бегущая лента номеров разных стран и уровней
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

  /* ---------- печать с цветком АСЬКИ ---------- */
  function flower(cx, cy, k) {
    let s = '';
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 - Math.PI / 2;
      const x = (cx + 5 * k * Math.cos(a)).toFixed(2);
      const y = (cy + 5 * k * Math.sin(a)).toFixed(2);
      s += `<circle cx="${x}" cy="${y}" r="${(2.7 * k).toFixed(2)}" fill="${i === 3 ? 'url(#seal-red)' : 'url(#seal-gold)'}" stroke="#2a1d07" stroke-width="${(0.35 * k).toFixed(2)}"/>`;
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
  const SEAL_BIG = `<svg viewBox="0 0 200 200">${DEFS}`
    + '<circle cx="100" cy="100" r="98" fill="none" stroke="#d9b26b" stroke-opacity=".55" stroke-width=".8"/>'
    + dots
    + '<g class="ring-text"><text font-family="Manrope, sans-serif" font-size="10.5" font-weight="600" letter-spacing="3.2" fill="#d9b26b">'
    + '<textPath href="#seal-path">АСЬКА · INTER NOS · MMXXVI · МЕССЕНДЖЕР ДЛЯ СВОИХ ·</textPath></text></g>'
    + '<circle cx="100" cy="100" r="66" fill="rgba(7,8,12,.6)" stroke="#d9b26b" stroke-opacity=".7" stroke-width=".8"/>'
    + '<circle cx="100" cy="100" r="61" fill="none" stroke="#d9b26b" stroke-opacity=".3" stroke-width=".6" stroke-dasharray="1 3"/>'
    + flower(100, 100, 7.4)
    + '</svg>';
  const SEAL_SMALL = `<svg viewBox="0 0 200 200">${DEFS}<circle cx="100" cy="100" r="94" fill="none" stroke="#d9b26b" stroke-opacity=".7" stroke-width="6"/>${flower(100, 100, 9.6)}</svg>`;
  for (const el of $$('[data-seal]')) el.innerHTML = el.dataset.seal === 'small' ? SEAL_SMALL : SEAL_BIG;

  /* ---------- гильош (как на паспорте UPASS): две спирографические кривые ---------- */
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
  sym('g-b', `<path d="${troch(100, 28, 44, 7, 1300, 2.15)}" fill="none" stroke="#8e7bf5" stroke-width=".4" stroke-opacity=".45"/>`
    + '<circle cx="250" cy="250" r="238" fill="none" stroke="#d9b26b" stroke-opacity=".25" stroke-width=".6"/>'
    + '<circle cx="250" cy="250" r="246" fill="none" stroke="#d9b26b" stroke-opacity=".15" stroke-width=".6" stroke-dasharray="2 4"/>');
  for (const el of $$('.guilloche')) {
    el.innerHTML = '<svg viewBox="0 0 500 500"><g><use href="#g-a"/></g><g><use href="#g-b"/></g></svg>';
  }

  /* ---------- звёздное небо (как в Eva Space) ---------- */
  function sky(canvas) {
    const ctx = canvas.getContext('2d');
    let w = 0; let h = 0; let stars = []; let shoot = null; let next = 0; let visible = true; let raf = 0;
    const dpr = Math.min(2, devicePixelRatio || 1);
    function resize() {
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.min(420, Math.round((w * h) / 2600));
      stars = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h, r: Math.random() ** 2.2 * 1.5 + 0.25,
        p: Math.random() * Math.PI * 2, s: 0.4 + Math.random() * 1.4, z: Math.random(),
        c: Math.random() < 0.12 ? '243,224,179' : Math.random() < 0.2 ? '190,180,255' : '255,255,255',
      }));
      if (reduce) draw(0);
    }
    function draw(t) {
      ctx.clearRect(0, 0, w, h);
      const ox = (window.__mx || 0) * 10; const oy = (window.__my || 0) * 8;
      for (const st of stars) {
        const a = reduce ? 0.7 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(st.p + (t / 1000) * st.s));
        const x = st.x + ox * st.z; const y = st.y + oy * st.z;
        ctx.beginPath(); ctx.fillStyle = `rgba(${st.c},${(a * (0.4 + st.z * 0.6)).toFixed(3)})`;
        ctx.arc(x, y, st.r, 0, Math.PI * 2); ctx.fill();
        if (st.r > 1.25) { // крупные звёзды — с лучиками
          ctx.strokeStyle = `rgba(${st.c},${(a * 0.35).toFixed(3)})`; ctx.lineWidth = 0.5;
          ctx.beginPath(); ctx.moveTo(x - st.r * 4, y); ctx.lineTo(x + st.r * 4, y); ctx.moveTo(x, y - st.r * 4); ctx.lineTo(x, y + st.r * 4); ctx.stroke();
        }
      }
      if (reduce) return;
      if (!shoot && t > next) { shoot = { x: Math.random() * w * 0.8 + w * 0.1, y: Math.random() * h * 0.35, vx: -(3 + Math.random() * 3), vy: 1.4 + Math.random() * 1.2, life: 0 }; }
      if (shoot) {
        shoot.life += 1; shoot.x += shoot.vx; shoot.y += shoot.vy;
        const g = ctx.createLinearGradient(shoot.x, shoot.y, shoot.x - shoot.vx * 22, shoot.y - shoot.vy * 22);
        const fade = Math.max(0, 1 - shoot.life / 70);
        g.addColorStop(0, `rgba(243,224,179,${0.9 * fade})`); g.addColorStop(1, 'rgba(243,224,179,0)');
        ctx.strokeStyle = g; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(shoot.x, shoot.y); ctx.lineTo(shoot.x - shoot.vx * 22, shoot.y - shoot.vy * 22); ctx.stroke();
        if (shoot.life > 70) { shoot = null; next = t + 3500 + Math.random() * 6000; }
      }
    }
    function loop(t) { draw(t); raf = visible ? requestAnimationFrame(loop) : 0; }
    resize();
    addEventListener('resize', () => { resize(); }, { passive: true });
    if (reduce) return;
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(loop);
    }).observe(canvas);
  }
  $$('canvas.sky').forEach(sky);

  /* ---------- шапка, полоса прокрутки, активный раздел ---------- */
  const nav = $('.nav');
  const bar = $('.progress');
  let ticking = false;
  function onScroll() {
    ticking = false;
    const y = scrollY;
    nav.classList.toggle('solid', y > 40);
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.setProperty('--p', max > 0 ? (y / max).toFixed(4) : 0);
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();
  const links = $$('.links a');
  const spy = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      for (const a of links) a.classList.toggle('on', a.getAttribute('href') === `#${e.target.id}`);
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('section[id]').forEach((s) => spy.observe(s));

  /* ---------- появление при прокрутке и счётчики ---------- */
  function countUp(el) {
    const to = Number(el.dataset.count);
    if (reduce || !to) { el.textContent = String(to); return; }
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 1300);
      el.textContent = String(Math.round(to * (1 - (1 - k) ** 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  const shown = (el) => { el.classList.add('in'); $$('[data-count]', el).forEach(countUp); };
  if (reduce || !('IntersectionObserver' in window)) {
    $$('.reveal').forEach(shown);
  } else {
    // То, что появилось на экране одновременно, проявляется по очереди
    const io = new IntersectionObserver((entries) => {
      let k = 0;
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.style.setProperty('--rd', `${Math.min(k++, 6) * 90}ms`);
        shown(e.target); io.unobserve(e.target);
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    $$('.reveal').forEach((el) => io.observe(el));
  }

  /* ---------- параллакс телефонов на главном экране ---------- */
  const phones = $('.hero-phones');
  if (phones && finePointer && !reduce) {
    let tx = 0; let ty = 0; let cx = 0; let cy = 0; let running = false;
    const tick = () => {
      cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
      phones.style.setProperty('--mx', cx.toFixed(3)); phones.style.setProperty('--my', cy.toFixed(3));
      window.__mx = cx; window.__my = cy;
      running = Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001;
      if (running) requestAnimationFrame(tick);
    };
    addEventListener('pointermove', (e) => {
      tx = (e.clientX / innerWidth) * 2 - 1; ty = (e.clientY / innerHeight) * 2 - 1;
      if (!running) { running = true; requestAnimationFrame(tick); }
    }, { passive: true });
  }

  /* ---------- уровни сияния ---------- */
  const NOTES = [
    'Обычная рамка — так выглядит любой новый номер.',
    'Серебро — двойная стальная рамка. 60 аськоинов.',
    'Неон — рамка светится и переливается от голубого к розовому. 150 аськоинов.',
    'Голограмма — по номеру бегут радужные блики. 350 аськоинов.',
    'Платина — металлический номер с бегущим бликом. 800 аськоинов.',
    'Бриллиант — белое сияние с искрами. 2000 аськоинов, а все улучшения подряд — 3360.',
  ];
  const glow = $('#glow');
  if (glow) {
    const plate = $('.aska-plate', glow);
    const btns = $$('.levels button', glow);
    const note = $('.level-note', glow);
    const CYCLE = 2600;
    glow.style.setProperty('--cycle', `${CYCLE}ms`);
    btns.forEach((b) => { const i = document.createElement('i'); i.className = 'bar'; b.appendChild(i); b.setAttribute('role', 'tab'); });
    let lvl = 0; let timer = 0; let inView = false; let manual = false;
    function set(n) {
      lvl = n;
      plate.className = plate.className.replace(/\blvl-\d\b/, `lvl-${n}`);
      plate.classList.remove('bump'); void plate.offsetWidth; plate.classList.add('bump');
      btns.forEach((b, i) => b.setAttribute('aria-selected', String(i === n)));
      note.textContent = NOTES[n];
    }
    function schedule() {
      clearTimeout(timer);
      if (manual || !inView || reduce) return;
      timer = setTimeout(() => { set((lvl + 1) % 6); schedule(); }, CYCLE);
    }
    btns.forEach((b, i) => b.addEventListener('click', () => { manual = true; glow.classList.add('manual'); clearTimeout(timer); set(i); }));
    new IntersectionObserver(([e]) => { inView = e.isIntersecting; if (inView) { set(lvl); schedule(); } else clearTimeout(timer); }, { threshold: 0.4 }).observe(glow);
    if (finePointer && !reduce) {
      const stage = $('.stage', glow);
      stage.addEventListener('pointermove', (e) => {
        const r = stage.getBoundingClientRect();
        plate.style.setProperty('--tx', (((e.clientX - r.left) / r.width - 0.5) * 24).toFixed(1));
        plate.style.setProperty('--ty', (-((e.clientY - r.top) / r.height - 0.5) * 18).toFixed(1));
      });
      stage.addEventListener('pointerleave', () => { plate.style.setProperty('--tx', 0); plate.style.setProperty('--ty', 0); });
    }
  }

  /* ---------- Зумер / Миллениал ---------- */
  const sw = $('.switch');
  if (sw) {
    const imgs = $$('.screens img');
    const tabs = $$('button', sw);
    let auto = !reduce; let cur = 'zoomer'; let t = 0; let inView = false;
    const show = (d) => {
      cur = d;
      tabs.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.design === d)));
      sw.classList.toggle('right', d === 'millennial');
      imgs.forEach((im) => im.classList.toggle('on', im.dataset.design === d));
    };
    const loop = () => { clearTimeout(t); if (auto && inView) t = setTimeout(() => { show(cur === 'zoomer' ? 'millennial' : 'zoomer'); loop(); }, 4200); };
    tabs.forEach((b) => b.addEventListener('click', () => { auto = false; clearTimeout(t); show(b.dataset.design); }));
    new IntersectionObserver(([e]) => { inView = e.isIntersecting; loop(); }, { threshold: 0.35 }).observe($('.screen-frame'));
  }

  /* ---------- наклон карточек рангов и подсветка возможностей ---------- */
  if (finePointer && !reduce) {
    for (const card of $$('[data-tilt]')) {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width; const y = (e.clientY - r.top) / r.height;
        card.style.setProperty('--rx', `${((x - 0.5) * 10).toFixed(2)}deg`);
        card.style.setProperty('--ry', `${(-(y - 0.5) * 8).toFixed(2)}deg`);
        card.style.setProperty('--gx', `${(x * 100).toFixed(1)}%`);
        card.style.setProperty('--gy', `${(y * 100).toFixed(1)}%`);
      });
      card.addEventListener('pointerleave', () => { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
    }
    for (const f of $$('.feat')) {
      f.addEventListener('pointermove', (e) => {
        const r = f.getBoundingClientRect();
        f.style.setProperty('--x', `${e.clientX - r.left}px`); f.style.setProperty('--y', `${e.clientY - r.top}px`);
      });
    }
  }
})();
