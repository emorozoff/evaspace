/* Оракул Евы: логика мини-приложения */
(function () {
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const STAR = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z"/></svg>';

/* ---------- хранилище ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('oracle.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('oracle.' + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem('oracle.' + k); } catch {} },
  clear() { try { Object.keys(localStorage).filter((k) => k.startsWith('oracle.')).forEach((k) => localStorage.removeItem(k)); } catch {} },
};

/* ---------- время и случайность ---------- */
const pad2 = (n) => String(n).padStart(2, '0');
const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const TODAY = dayKey();
let deviceId = store.get('device', null);
if (!deviceId) { deviceId = Math.random().toString(36).slice(2, 10); store.set('device', deviceId); }
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function shuffled(arr, seed) { const r = rng(seed); const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const fmtDate = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }); };
const fmtShort = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', ''); };
function untilTomorrow() { const n = new Date(); const t = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1); const ms = t - n; const h = Math.floor(ms / 3.6e6), m = Math.floor((ms % 3.6e6) / 6e4); return h ? `${h} ч ${m} мин` : `${m} мин`; }
function greeting() { const h = new Date().getHours(); return h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер'; }

/* ---------- профиль ---------- */
function profile() { return store.get('profile', null); }
function sign() { const p = profile(); return p ? window.signById(p.sign) : window.ZODIAC[0]; }
function el() { return sign().el; }

/* ---------- история и серия ---------- */
function history() { return store.get('history', []); }
function logDay(variant, id) {
  const h = history().filter((x) => !(x.date === TODAY && x.v === variant && x.id === id));
  h.push({ date: TODAY, v: variant, id });
  store.set('history', h.slice(-120));
  renderStreak();
}
function streak() {
  const days = new Set(history().map((x) => x.date));
  let n = 0; const d = new Date();
  if (!days.has(dayKey())) d.setDate(d.getDate() - 1);
  for (;;) { const k = dayKey(d); if (!days.has(k)) break; n++; d.setDate(d.getDate() - 1); }
  return n;
}
function renderStreak() { const e = $('#streak-n'); if (e) e.textContent = streak(); }

/* ---------- фон: звёзды ---------- */
(function starfield() {
  const c = $('#stars'); const ctx = c.getContext('2d');
  let w, h, stars = [];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function size() { w = c.width = innerWidth * devicePixelRatio; h = c.height = innerHeight * devicePixelRatio; stars = Array.from({ length: Math.round((innerWidth * innerHeight) / 9000) }, () => ({ x: Math.random() * w, y: Math.random() * h, r: (Math.random() * 1.3 + 0.4) * devicePixelRatio, p: Math.random() * Math.PI * 2, s: Math.random() * 0.02 + 0.005, v: Math.random() < 0.08 })); }
  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w * 0.5, -h * 0.1, 0, w * 0.5, -h * 0.1, h * 0.9);
    g.addColorStop(0, 'rgba(143,124,243,0.16)'); g.addColorStop(1, 'rgba(10,10,20,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (const s of stars) { const a = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(s.p + t * s.s)); ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fillStyle = s.v ? `rgba(217,181,111,${a})` : `rgba(240,236,255,${a})`; ctx.fill(); }
    if (!reduce) requestAnimationFrame((tt) => draw(tt / 16));
  }
  size(); addEventListener('resize', size); draw(0);
})();

/* ---------- Луна: рисунок ---------- */
function moonSVG(illum, waxing, size = 200, id = 'm') {
  const r = size / 2 - 6, cx = size / 2, cy = size / 2;
  const x = Math.cos(Math.PI * illum); // 1 → новолуние, -1 → полнолуние
  const rx = Math.abs(x) * r;
  const outer = waxing ? 1 : 0;
  const inner = waxing ? (illum < 0.5 ? 0 : 1) : (illum < 0.5 ? 1 : 0);
  const lit = illum < 0.01 ? '' : illum > 0.99 ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#lit-${id})"/>` : `<path d="M${cx} ${cy - r}A${r} ${r} 0 0 ${outer} ${cx} ${cy + r}A${rx.toFixed(2)} ${r} 0 0 ${inner} ${cx} ${cy - r}Z" fill="url(#lit-${id})"/>`;
  return `<svg class="moon" viewBox="0 0 ${size} ${size}" aria-hidden="true"><defs><radialGradient id="lit-${id}" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#fffdf6"/><stop offset="1" stop-color="#d9d3c2"/></radialGradient><radialGradient id="dark-${id}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#23213a"/><stop offset="1" stop-color="#15142a"/></radialGradient></defs><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#dark-${id})" stroke="rgba(242,238,227,0.28)"/>${lit}<g fill="rgba(0,0,0,0.08)"><circle cx="${cx - r * 0.3}" cy="${cy - r * 0.2}" r="${r * 0.12}"/><circle cx="${cx + r * 0.25}" cy="${cy + r * 0.3}" r="${r * 0.17}"/><circle cx="${cx + r * 0.1}" cy="${cy - r * 0.45}" r="${r * 0.08}"/><circle cx="${cx - r * 0.15}" cy="${cy + r * 0.45}" r="${r * 0.06}"/></g></svg>`;
}

/* ---------- тост и открытка ---------- */
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1800); }
let shareText = '';
function skyDots(n, seed) { const r = rng(seed); let s = ''; for (let i = 0; i < n; i++) { const z = (r() * 2 + 1).toFixed(1); s += `<span style="left:${(r() * 100).toFixed(1)}%;top:${(r() * 100).toFixed(1)}%;width:${z}px;height:${z}px;opacity:${(r() * .5 + .3).toFixed(2)}"></span>`; } return s; }
function openPost({ art, name, quote }) {
  const p = profile();
  $('#post').innerHTML = `<div class="sky">${skyDots(40, 21)}</div><div class="date">${esc(fmtDate(TODAY))}${p ? ' · ' + esc(sign().name) : ''}</div><div class="art">${art}</div><div class="n">${esc(name)}</div><div class="q">«${esc(quote)}»</div><div class="wm">ОРАКУЛ ЕВЫ · EVA SPACE</div>`;
  shareText = `${name}\n«${quote}»\n\nОракул Евы · Eva Space`;
  $('#share').hidden = false;
}
$('#share-close').addEventListener('click', () => { $('#share').hidden = true; });
$('#share').addEventListener('click', (e) => { if (e.target === e.currentTarget) $('#share').hidden = true; });
async function share(text) {
  try { if (navigator.share) { await navigator.share({ text }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); toast('Текст скопирован'); } catch { toast('Выдели и скопируй текст вручную'); }
}
$('#share-btn').addEventListener('click', () => share(shareText));

/* ---------- роутер ---------- */
const view = $('#view');
const ROUTES = { '': renderHome, 'welcome': renderWelcome, 'greeting': renderGreeting, 'silhouettes': renderSilhouettes, 'deck': renderDeck, 'moon': renderMoon, 'profile': renderProfile };
function go(path) { location.hash = '#/' + path; }
function route() {
  const path = location.hash.replace(/^#\/?/, '').split('?')[0];
  if (!profile() && path !== 'welcome') { location.replace('#/welcome'); return; }
  if (profile() && !store.get('greeting', false) && path !== 'welcome' && path !== 'greeting') { location.replace('#/greeting'); return; }
  const fn = ROUTES[path] || renderHome;
  document.querySelectorAll('.nav button').forEach((b) => b.classList.toggle('on', b.dataset.go === path));
  const noNav = path === 'welcome' || path === 'greeting';
  $('#nav').hidden = noNav; $('#topbar').hidden = noNav;
  $('#app').classList.toggle('no-nav', noNav);
  view.innerHTML = '';
  view.className = 'screen';
  fn();
  renderStreak();
  window.scrollTo({ top: 0 });
}
addEventListener('hashchange', route);
document.querySelectorAll('.nav button').forEach((b) => b.addEventListener('click', () => { pendingA = false; pendingB = false; go(b.dataset.go); }));

/* =====================================================================
   ОНБОРДИНГ
   ===================================================================== */
function renderWelcome() {
  const p = profile() || {};
  let step = 0; const draft = { name: p.name || '', d: p.d || '', m: p.m || '', y: p.y || '' };
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const draw = () => {
    const steps = `<div class="steps">${[0, 1, 2].map((i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>`;
    if (step === 0) {
      view.innerHTML = `<div class="welcome">${steps}<div class="moon-hero">${moonSVG(0.72, true, 150, 'w')}</div><div class="eyebrow">Оракул Евы</div><h1 class="display">Добро пожаловать в мир магии и подсказок</h1><p>Каждый день здесь ждёт послание: карты, символы и Луна говорят с тобой на языке, который понимает только ты.</p><button class="btn primary block" id="w-next" style="margin-top:14px">Войти</button></div>`;
    } else if (step === 1) {
      view.innerHTML = `<div class="welcome">${steps}<div class="eyebrow">Знакомство</div><h1 class="display">Как к тебе обращаться?</h1><p>Так Оракул будет называть тебя в посланиях.</p><input class="field" id="w-name" type="text" maxlength="24" placeholder="Твоё имя" autocomplete="given-name" value="${esc(draft.name)}"><button class="btn primary block" id="w-next" ${draft.name.trim() ? '' : 'disabled'}>Дальше</button></div>`;
      const inp = $('#w-name'); inp.focus();
      inp.addEventListener('input', () => { draft.name = inp.value; $('#w-next').disabled = !draft.name.trim(); });
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && draft.name.trim()) { step = 2; draw(); } });
    } else if (step === 2) {
      const y0 = new Date().getFullYear();
      view.innerHTML = `<div class="welcome">${steps}<div class="eyebrow">${esc(draft.name.trim())}</div><h1 class="display">Когда ты родилась?</h1><p>По дате рождения Оракул узнает твой знак и будет говорить с тобой с учётом его стихии и Луны.</p>
        <div class="date-row"><select id="w-d"><option value="">День</option>${Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}" ${String(i + 1) === String(draft.d) ? 'selected' : ''}>${i + 1}</option>`).join('')}</select><select id="w-m"><option value="">Месяц</option>${months.map((m, i) => `<option value="${i + 1}" ${String(i + 1) === String(draft.m) ? 'selected' : ''}>${m}</option>`).join('')}</select><select id="w-y"><option value="">Год</option>${Array.from({ length: 80 }, (_, i) => y0 - 14 - i).map((y) => `<option value="${y}" ${String(y) === String(draft.y) ? 'selected' : ''}>${y}</option>`).join('')}</select></div>
        <div id="w-sign"></div><button class="btn primary block" id="w-next" disabled>Показать мой знак</button></div>`;
      const upd = () => { draft.d = $('#w-d').value; draft.m = $('#w-m').value; draft.y = $('#w-y').value; $('#w-next').disabled = !(draft.d && draft.m && draft.y); };
      ['#w-d', '#w-m', '#w-y'].forEach((s) => $(s).addEventListener('change', upd)); upd();
    } else {
      const z = window.signFromDate(+draft.m, +draft.d); const e = window.ELEMENTS[z.el];
      view.innerHTML = `<div class="welcome">${steps}<div class="sign-reveal"><div class="glyph">${z.glyph}</div><div class="eyebrow">${esc(draft.name.trim())}, ты</div><h2 class="display">${esc(z.name)}</h2><span class="el-chip" style="--el:${e.color}"><i></i>стихия: ${esc(e.name)}</span><p>${esc(z.trait)}</p><p class="muted small">Сильная сторона: ${esc(z.strength)}. Тень: ${esc(z.shadow)}.</p></div><button class="btn primary block" id="w-next">${store.get('greeting', false) ? 'Начать' : 'Дальше'}</button></div>`;
    }
    $('#w-next').addEventListener('click', () => {
      if (step < 3) { step++; draw(); return; }
      const z = window.signFromDate(+draft.m, +draft.d);
      store.set('profile', { name: draft.name.trim(), d: +draft.d, m: +draft.m, y: +draft.y, sign: z.id, created: p.created || TODAY });
      go(store.get('greeting', false) ? '' : 'greeting');
    });
  };
  draw();
}


/* =====================================================================
   ПРИВЕТСТВЕННЫЙ РАСКЛАД (один раз, после знакомства)
   ===================================================================== */
function renderGreeting() {
  const p = profile(); const g = window.GREETING;
  const seen = store.get('greeting', false);
  const sigil = `<svg viewBox="0 0 160 220" fill="currentColor" aria-hidden="true"><path d="M96 74a34 34 0 1 0 0 66 27 34 0 1 1 0-66z" opacity=".9"/><circle cx="52" cy="58" r="3.2"/><circle cx="44" cy="150" r="2.4"/><circle cx="112" cy="168" r="2.6"/><path d="M50 96l2 5.6 5.6 2-5.6 2-2 5.6-2-5.6-5.6-2 5.6-2z"/></svg>`;
  const cardsHTML = g.cards.map((c, i) => `<div class="card3 greet-card" data-i="${i}"><div class="inner"><div class="face back">${sigil}</div><div class="face front"><span class="art">${window.GREET_ART[c.art]}</span><b>${esc(c.name)}</b></div></div></div>`).join('');

  if (!seen) {
    view.innerHTML = `<div class="greet-ready">
      <div class="orb" aria-hidden="true"><span></span><span></span><span></span></div>
      <div class="eyebrow">Приветственный расклад</div>
      <h1 class="display">${esc(p.name)}, это только для тебя</h1>
      <p>${esc(g.ready)}</p>
      <button class="btn primary block" id="g-start">Получить</button>
    </div>`;
    $('#g-start').addEventListener('click', () => { layout(true); });
    return;
  }
  layout(false);

  function layout(animate) {
    view.innerHTML = `<div class="greet">
      <div class="greet-head"><div class="eyebrow">Послание для ${esc(p.name)}</div><h1 class="display">Приветственный расклад</h1><p class="lead" id="g-intro">${esc(g.intro)}</p></div>
      <div class="night greet-night"><div class="spread greet-spread" id="g-spread">${cardsHTML}</div></div>
      <div id="g-body"></div>
    </div>`;
    const cards = [...document.querySelectorAll('#g-spread .card3')];
    const body = $('#g-body');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

    const blockHTML = (c, i) => `<div class="sheet greet-block${animate ? ' soft' : ''}" data-b="${i}"${animate ? ' hidden' : ''}>
      <div class="greet-mark"><span class="ic">${window.GREET_ART[c.art]}</span><div><div class="eyebrow">Карта ${i + 1}</div><h2 class="name display">${esc(c.name)}</h2><div class="key">${esc(c.key)}</div></div></div>
      <div class="msg">${c.text.map((t) => `<p>${esc(t)}</p>`).join('')}</div></div>`;
    const outroHTML = `<div class="sheet greet-block greet-outro${animate ? ' soft' : ''}" data-b="${g.cards.length}"${animate ? ' hidden' : ''}>
      ${g.outro.map((t) => `<p>${esc(t)}</p>`).join('')}
      <div class="sign display">${esc(g.sign)}</div>
      <button class="btn primary block" id="g-done" style="margin-top:18px">${seen ? 'Вернуться' : 'Войти в Оракул'}</button></div>`;
    body.innerHTML = g.cards.map(blockHTML).join('') + outroHTML;
    $('#g-done').addEventListener('click', () => { store.set('greeting', true); go(seen ? 'profile' : ''); if (!seen) maybeOfferInstall(900); });

    if (!animate) { cards.forEach((el) => el.classList.add('flipped')); $('#g-spread').classList.add('done'); return; }
    const show = (i) => { const el = body.querySelector(`[data-b="${i}"]`); if (!el) return; el.hidden = false; requestAnimationFrame(() => el.classList.remove('soft')); };
    const step = reduce ? 60 : 1150;
    cards.forEach((el, i) => setTimeout(() => {
      el.classList.add('flipped');
      setTimeout(() => { show(i); if (i === 0) window.scrollTo({ top: 0, behavior: 'smooth' }); }, reduce ? 20 : 700);
    }, 400 + i * step));
    setTimeout(() => show(g.cards.length), 400 + g.cards.length * step + (reduce ? 20 : 700));
  }
}

/* =====================================================================
   ГЛАВНАЯ
   ===================================================================== */
function renderHome() {
  const p = profile(); const z = sign(); const mi = window.moonInfo(new Date());
  const moonSign = window.signById(window.MOON_SIGN_ORDER[mi.signIndex]);
  const a = getA(), b = getB(), m = store.get('m.' + TODAY, null);
  const cnt = (st) => st.rounds.filter((r) => r.pick != null).length;
  const label = (st) => { const n = cnt(st); return n === 0 ? 'вытянуть' : n === 1 ? 'открыта · ещё' : n + ' карты · ещё'; };
  view.innerHTML = `
    <div class="hero"><div class="eyebrow">${esc(fmtDate(TODAY))}</div><h1 class="display">${esc(greeting())}, ${esc(p.name)}</h1><p class="lead">${esc(dayLead(mi, z))}</p></div>
    <div class="today-card"><div class="mini-moon">${moonSVG(mi.illum, mi.waxing, 84, 'h')}</div><div><h3 class="display">${esc(mi.phase)}</h3><p>${mi.day}-й лунный день · ${esc(window.LUNAR_DAYS[mi.day - 1].sym)}</p><div class="chips"><span class="tag gold">${z.glyph} ${esc(z.name)}</span><span class="tag violet">Луна в ${esc(inSign(moonSign))}</span></div></div></div>
    <div class="sect"><div class="eyebrow">Послания на сегодня</div><div class="mech">
      <button class="mech-card ${cnt(a) ? 'done' : ''}" data-go="silhouettes"><div class="ic">${window.SIL.lantern}</div><div><b>Три силуэта</b><span>Выбери тему и фигуру, которая про тебя</span></div><div class="st">${label(a)}</div></button>
      <button class="mech-card ${cnt(b) ? 'done' : ''}" data-go="deck"><div class="ic">${window.SYM.key}</div><div><b>Колода Евы</b><span>Состояние, веер и вопрос для дневника</span></div><div class="st">${label(b)}</div></button>
      <button class="mech-card ${m ? 'done' : ''}" data-go="moon"><div class="ic">${moonSVG(mi.illum, mi.waxing, 40, 'hm')}</div><div><b>Лунный день</b><span>Фаза, ${mi.day}-й день и подсказка для ${esc(z.gen)}</span></div><div class="st">${m ? 'прочитан' : 'открыть'}</div></button>
    </div></div>
    <div class="sect history" id="home-history"></div>
    <p class="proto-note">Оракул не предсказывает будущее. Он помогает услышать то, что ты уже знаешь.</p>`;
  document.querySelectorAll('.mech-card').forEach((c) => c.addEventListener('click', () => { pendingA = false; pendingB = false; go(c.dataset.go); }));
  renderHistory($('#home-history'));
  maybeOfferInstall();
}
function inSign(z) { const m = { aries: 'Овне', taurus: 'Тельце', gemini: 'Близнецах', cancer: 'Раке', leo: 'Льве', virgo: 'Деве', libra: 'Весах', scorpio: 'Скорпионе', sagittarius: 'Стрельце', capricorn: 'Козероге', aquarius: 'Водолее', pisces: 'Рыбах' }; return m[z.id]; }
function dayLead(mi, z) {
  const g = { new: 'Небо тёмное: время замыслов, а не действий.', waxing: 'Луна растёт: всё, что начинаешь, набирает силу.', full: 'Полнолуние: чувства на пике, видно далеко.', waning: 'Луна убывает: время завершать и отпускать.' }[mi.group];
  return `${g} ${z.advice}`;
}
function renderHistory(wrap) {
  const h = history().filter((x) => x.v !== 'm').slice(-14).reverse();
  if (!h.length) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = `<div class="eyebrow">Твои карты</div><div class="row">${h.map((x) => {
    const sil = x.v === 'a'; const c = sil ? window.DECK_A.find((k) => k.id === x.id) : window.DECK_B.find((k) => k.id === x.id); if (!c) return '';
    return `<div class="hcard ${sil ? 'sil' : ''} ${x.date === TODAY ? 'today' : ''}"><div class="m">${sil ? window.SIL[x.id] : window.SYM[x.id]}</div><small>${esc(c.name)}<br>${esc(fmtShort(x.date))}</small></div>`;
  }).join('')}</div>`;
}

/* =====================================================================
   ТРИ СИЛУЭТА (можно добирать карты в течение дня)
   ===================================================================== */
const findA = (id) => window.DECK_A.find((c) => c.id === id);
let pendingA = false;

function getA() {
  let st = store.get('a.' + TODAY, null);
  if (!st) return { rounds: [], view: 0 };
  if (st.ids) st = { rounds: [{ theme: st.theme, ids: st.ids, pick: st.pick }], view: 0 }; // старый формат
  if (!Array.isArray(st.rounds)) st.rounds = [];
  if (typeof st.view !== 'number' || st.view >= st.rounds.length) st.view = Math.max(0, st.rounds.length - 1);
  return st;
}
const saveA = (st) => store.set('a.' + TODAY, st);

function renderSilhouettes() {
  const st = getA();
  const cur = st.rounds[st.view];
  if (pendingA || !cur) { chooseThemeA(st); return; }
  view.innerHTML = playA();
  mountA(st);
}
function chooseThemeA(st) {
  const extra = st.rounds.length > 0;
  view.innerHTML = `<div class="hero"><div class="eyebrow">${extra ? 'Ещё одна карта' : 'Три силуэта'}</div><h1 class="display">${extra ? 'О чём спросишь теперь?' : 'О чём сегодня твой вопрос?'}</h1><p class="lead">${extra ? 'Выбери другую тему, и колода выложит три новые фигуры. Первая карта дня остаётся с тобой.' : 'Выбери тему. Три фигуры выйдут навстречу, и та, к которой первой потянется рука, и есть ответ.'}</p></div>
    <div class="choice-grid">${Object.entries(window.THEMES).map(([k, t]) => `<button class="choice${extra && st.rounds.some((r) => r.theme === k) ? ' used' : ''}" data-theme="${k}"><b>${esc(t.label)}</b><span>${esc(t.hint)}</span></button>`).join('')}</div>
    ${extra ? `<div class="demo"><button class="textlink" id="a-back">Вернуться к открытым картам</button></div>` : `<p class="pad small muted" style="margin-top:14px">Метафорические карты ничего не предсказывают. Они зеркало: ты выбираешь то, что уже знаешь о себе.</p>`}`;
  document.querySelectorAll('.choice').forEach((b) => b.addEventListener('click', () => {
    b.classList.add('on');
    const n = st.rounds.length;
    const used = new Set(st.rounds.filter((r) => r.pick != null).map((r) => r.ids[r.pick]));
    const pool = window.DECK_A.filter((c) => !used.has(c.id));
    const deck = pool.length >= 3 ? pool : window.DECK_A;
    const ids = shuffled(deck, hash(TODAY + deviceId + 'a' + n)).slice(0, 3).map((c) => c.id);
    st.rounds.push({ theme: b.dataset.theme, ids, pick: null });
    st.view = st.rounds.length - 1;
    pendingA = false; saveA(st);
    setTimeout(() => { view.innerHTML = playA(); mountA(st); }, 220);
  }));
  const back = $('#a-back');
  if (back) back.addEventListener('click', () => { pendingA = false; renderSilhouettes(); });
}
function playA() {
  return `<div class="night"><div class="cap"><div class="eyebrow" id="a-cap-eyebrow"></div><p id="a-cap-text"></p></div><div class="spread" id="a-spread"></div></div><div id="a-strip"></div><div id="a-sheet"></div>`;
}
function mountA(st) {
  const r = st.rounds[st.view];
  $('#a-cap-eyebrow').textContent = window.THEMES[r.theme].label;
  $('#a-cap-text').textContent = r.pick == null ? 'Какая фигура сегодня про тебя? Не думай. Коснись.' : (st.view === 0 ? 'Твоя карта дня открыта.' : 'Дополнительная карта открыта.');
  const sp = $('#a-spread');
  sp.innerHTML = r.ids.map((id) => { const c = findA(id); return `<div class="card3" data-id="${id}" role="button" tabindex="0" aria-label="Карта"><div class="inner"><div class="face back">${window.SIL[id]}</div><div class="face front"><span class="orn">${STAR}</span><b>${esc(c.name)}</b><i>${esc(c.key)}</i></div></div></div>`; }).join('');
  sp.querySelectorAll('.card3').forEach((elm, i) => {
    const pick = () => {
      if (r.pick != null) return;
      r.pick = i; saveA(st); logDay('a', r.ids[i]);
      elm.classList.add('flipped'); sp.classList.add('done');
      $('#a-cap-text').textContent = 'Рука знала. Читай ниже.';
      setTimeout(() => { stripA(st); sheetA(st); $('#a-sheet').scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 900);
    };
    elm.addEventListener('click', pick);
    elm.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  });
  if (r.pick != null) { sp.children[r.pick].classList.add('flipped'); sp.classList.add('done'); stripA(st); sheetA(st); }
  else stripA(st);
}
function stripA(st) {
  const done = st.rounds.filter((r) => r.pick != null);
  const wrap = $('#a-strip'); if (!wrap) return;
  if (done.length < 1) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = `<div class="today-strip">${st.rounds.map((r, i) => {
    if (r.pick == null) return '';
    const c = findA(r.ids[r.pick]);
    return `<button data-view="${i}" class="${i === st.view ? 'on' : ''}"><div class="m">${window.SIL[c.id]}</div><small>${i === 0 ? 'карта дня' : '+' + i}</small></button>`;
  }).join('')}<button class="add" id="a-more"><div class="m">+</div><small>ещё</small></button></div>`;
  wrap.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
    st.view = +b.dataset.view; saveA(st); view.innerHTML = playA(); mountA(st); window.scrollTo({ top: 0, behavior: 'smooth' });
  }));
  $('#a-more').addEventListener('click', () => { pendingA = true; renderSilhouettes(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
}
function sheetA(st) {
  const r = st.rounds[st.view];
  const c = findA(r.ids[r.pick]); const th = window.THEMES[r.theme]; const pos = window.POS[r.pick]; const z = sign();
  const others = r.ids.filter((_, j) => j !== r.pick).map(findA);
  $('#a-sheet').innerHTML = `<div class="sheet">
      <div class="eyebrow">${st.view === 0 ? 'Твоя карта' : 'Дополнительная карта'} · ${esc(fmtDate(TODAY))}</div>
      <h2 class="name display">${esc(c.name)}</h2><div class="key">${esc(c.key)}</div>
      <div class="tags"><span class="tag gold">${esc(th.label)}</span><span class="tag">${esc(pos.label)} · ${esc(pos.tag)}</span></div>
      <div class="msg"><p>${esc(c.p1)}</p><p>${esc(c.p2)}</p><p>${esc(c.t[r.theme])}</p>
        <div class="note"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z"/></svg><span>${esc(pos.line)}</span></div></div>
      <div class="box zodiac"><div class="eyebrow">${z.glyph} Для ${esc(z.gen)} · стихия ${esc(window.ELEMENTS[z.el].name.toLowerCase())}</div><p>${esc(c.el[z.el])}</p></div>
      <div class="box"><div class="eyebrow">Сегодня попробуй</div><p>${esc(c.act)}</p></div>
      <div class="box quote"><div class="eyebrow">Фраза дня</div><p>«${esc(c.phrase)}»</p><div class="btn-row"><button class="btn primary sm" id="a-post">Открытка в сторис</button><button class="btn sm" id="a-copy">Скопировать</button></div></div>
      <details><summary>Две фигуры, которые ты обошла</summary><div class="shadow-list">${others.map((o) => `<div class="shadow-item"><div class="mini">${window.SIL[o.id]}</div><div><b>${esc(o.name)}</b><span>${esc(o.shadow)}</span></div></div>`).join('')}</div></details>
      <div class="draw-again"><button class="btn block" id="a-again">Вытянуть ещё карту</button><div class="hint">Можно доставать сколько захочется. Главной остаётся первая карта дня.</div></div>
      <div class="foot"><span>Новый расклад дня через ${untilTomorrow()}</span><span>Серия: ${streak()} дн.</span></div></div>`;
  $('#a-post').addEventListener('click', () => openPost({ art: window.SIL[c.id], name: c.name, quote: c.phrase }));
  $('#a-copy').addEventListener('click', () => share(`${c.name}\n«${c.phrase}»\n\nОракул Евы · Eva Space`));
  $('#a-again').addEventListener('click', () => { pendingA = true; renderSilhouettes(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
}

/* =====================================================================
   КОЛОДА ЕВЫ (можно добирать карты в течение дня)
   ===================================================================== */
const findB = (id) => window.DECK_B.find((c) => c.id === id);
let pendingB = false;

function getB() {
  let st = store.get('b.' + TODAY, null);
  if (!st) return { rounds: [], view: 0 };
  if (st.ids) st = { rounds: [{ mood: st.mood, ids: st.ids, pick: st.pick, note: st.note || '' }], view: 0 };
  if (!Array.isArray(st.rounds)) st.rounds = [];
  if (typeof st.view !== 'number' || st.view >= st.rounds.length) st.view = Math.max(0, st.rounds.length - 1);
  return st;
}
const saveB = (st) => store.set('b.' + TODAY, st);

function renderDeck() {
  const st = getB();
  const cur = st.rounds[st.view];
  if (pendingB || !cur) { chooseMoodB(st); return; }
  view.innerHTML = playB();
  mountB(st);
}
function chooseMoodB(st) {
  const extra = st.rounds.length > 0;
  view.innerHTML = `<div class="hero"><div class="eyebrow">${extra ? 'Ещё одна карта' : 'Колода Евы'}</div><h1 class="display">${extra ? 'А сейчас как ты?' : 'Как ты сейчас?'}</h1><p class="lead">${extra ? 'Состояние меняется в течение дня. Скажи, какое оно сейчас, и колода ответит заново.' : 'Одно честное слово о своём состоянии. Карта ответит именно на него, а вечером можно вернуться и записать, что сбылось.'}</p></div>
    <div class="chips">${Object.entries(window.MOODS).map(([k, m]) => `<button class="chip" data-mood="${k}" style="--dot:${m.dot}"><i></i>${m.label}</button>`).join('')}</div>
    ${extra ? `<div class="demo"><button class="textlink" id="b-back">Вернуться к открытым картам</button></div>` : ''}`;
  document.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => {
    b.classList.add('on');
    const n = st.rounds.length;
    const used = new Set(st.rounds.filter((r) => r.pick != null).map((r) => r.ids[r.pick]));
    const pool = window.DECK_B.filter((c) => !used.has(c.id));
    const deck = pool.length >= 7 ? pool : window.DECK_B;
    const ids = shuffled(deck, hash(TODAY + deviceId + 'b' + n)).slice(0, 7).map((c) => c.id);
    st.rounds.push({ mood: b.dataset.mood, ids, pick: null, note: '' });
    st.view = st.rounds.length - 1;
    pendingB = false; saveB(st);
    setTimeout(() => { view.innerHTML = playB(); mountB(st); }, 220);
  }));
  const back = $('#b-back');
  if (back) back.addEventListener('click', () => { pendingB = false; renderDeck(); });
}
function playB() {
  return `<div class="night"><div class="cap"><div class="eyebrow" id="b-cap-eyebrow"></div><p id="b-cap-text"></p></div><div class="fan-wrap" id="b-fanwrap"><div class="fan" id="b-fan"></div></div><div class="reveal" id="b-reveal" hidden></div></div><div id="b-strip"></div><div id="b-sheet"></div>`;
}
function mountB(st) {
  const r = st.rounds[st.view];
  $('#b-cap-eyebrow').textContent = window.MOODS[r.mood].label;
  $('#b-cap-text').textContent = 'Проведи взглядом по вееру и коснись карты, которая откликнулась.';
  const fan = $('#b-fan'); const n = r.ids.length;
  fan.innerHTML = r.ids.map((id, i) => { const a = -29 + (58 / (n - 1)) * i; return `<div class="fcard" data-i="${i}" role="button" tabindex="0" aria-label="Карта ${i + 1}" style="--a:${a.toFixed(1)}deg;--d:${(i * 0.06).toFixed(2)}s"><div class="b">${STAR}</div></div>`; }).join('');
  fan.querySelectorAll('.fcard').forEach((elm) => {
    const pick = () => {
      if (r.pick != null) return;
      r.pick = +elm.dataset.i; saveB(st); logDay('b', r.ids[r.pick]);
      elm.classList.add('lift'); fan.classList.add('picking');
      $('#b-cap-text').textContent = 'Эта. Смотри, что на ней.';
      setTimeout(() => revealB(st, true), 520);
    };
    elm.addEventListener('click', pick);
    elm.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  });
  if (r.pick != null) { $('#b-cap-text').textContent = st.view === 0 ? 'Твоя карта дня открыта.' : 'Дополнительная карта открыта.'; revealB(st, false); }
  else stripB(st);
}
function revealB(st, animate) {
  const r = st.rounds[st.view];
  const c = findB(r.ids[r.pick]);
  $('#b-fanwrap').hidden = true;
  const rv = $('#b-reveal'); rv.hidden = false;
  rv.innerHTML = `<div class="bigcard"><div class="face back"><span style="width:40%;color:var(--gold-2)">${STAR}</span></div><div class="face front"><div class="sym">${window.SYM[c.id]}</div><b>${esc(c.name)}</b><i>${esc(c.key)}</i></div></div>`;
  const big = $('.bigcard', rv);
  if (animate) { requestAnimationFrame(() => requestAnimationFrame(() => big.classList.add('flipped'))); setTimeout(() => { stripB(st); sheetB(st); $('#b-sheet').scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 1000); }
  else { big.style.transition = 'none'; big.classList.add('flipped'); stripB(st); sheetB(st); }
}
function stripB(st) {
  const wrap = $('#b-strip'); if (!wrap) return;
  const done = st.rounds.filter((r) => r.pick != null);
  if (!done.length) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = `<div class="today-strip">${st.rounds.map((r, i) => {
    if (r.pick == null) return '';
    const c = findB(r.ids[r.pick]);
    return `<button data-view="${i}" class="${i === st.view ? 'on' : ''}"><div class="m">${window.SYM[c.id]}</div><small>${i === 0 ? 'карта дня' : '+' + i}</small></button>`;
  }).join('')}<button class="add" id="b-more"><div class="m">+</div><small>ещё</small></button></div>`;
  wrap.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
    st.view = +b.dataset.view; saveB(st); view.innerHTML = playB(); mountB(st); window.scrollTo({ top: 0, behavior: 'smooth' });
  }));
  $('#b-more').addEventListener('click', () => { pendingB = true; renderDeck(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
}
function sheetB(st) {
  const r = st.rounds[st.view];
  const c = findB(r.ids[r.pick]); const m = window.MOODS[r.mood]; const z = sign();
  $('#b-sheet').innerHTML = `<div class="sheet">
      <div class="eyebrow">${st.view === 0 ? 'Карта дня' : 'Дополнительная карта'} · ${esc(fmtDate(TODAY))}</div>
      <h2 class="name display">${esc(c.name)}</h2><div class="key">${esc(c.key)}</div>
      <div class="tags"><span class="tag gold">${esc(m.label)}</span><span class="tag">Колода Евы</span></div>
      <div class="msg"><p>${esc(c.p1)}</p><p><strong>${esc(m.said)}</strong> ${esc(c.m[r.mood])}</p></div>
      <div class="box zodiac"><div class="eyebrow">${z.glyph} Совет для ${esc(z.gen)}</div><p>${esc(z.advice)} ${esc(c.name)} сегодня напоминает именно об этом.</p></div>
      <div class="box"><div class="eyebrow">Вопрос для дневника</div><p>${esc(c.q)}</p><textarea id="b-note" placeholder="Напиши пару строк, только для себя. Сохранится на этом телефоне.">${esc(r.note || '')}</textarea><div class="saved" id="b-saved">${r.note ? 'Сохранено' : ''}</div></div>
      <div class="box quote"><div class="eyebrow">Аффирмация дня</div><p>«${esc(c.aff)}»</p><div class="btn-row"><button class="btn primary sm" id="b-post">Открытка в сторис</button><button class="btn sm" id="b-copy">Скопировать</button></div></div>
      <div class="box"><div class="eyebrow">Маленький ритуал</div><p>${esc(c.rit)}</p></div>
      <div class="draw-again"><button class="btn block" id="b-again">Вытянуть ещё карту</button><div class="hint">Состояние меняется — карта тоже. Первая остаётся картой дня.</div></div>
      <div class="foot"><span>Новая колода через ${untilTomorrow()}</span><span>Серия: ${streak()} дн.</span></div></div>`;
  let t;
  $('#b-note').addEventListener('input', (e) => { clearTimeout(t); $('#b-saved').textContent = 'Пишу…'; t = setTimeout(() => { r.note = e.target.value; saveB(st); $('#b-saved').textContent = 'Сохранено'; }, 500); });
  $('#b-post').addEventListener('click', () => openPost({ art: window.SYM[c.id], name: c.name, quote: c.aff }));
  $('#b-copy').addEventListener('click', () => share(`${c.name}\n«${c.aff}»\n\nОракул Евы · Eva Space`));
  $('#b-again').addEventListener('click', () => { pendingB = true; renderDeck(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
}

/* =====================================================================
   ЛУННЫЙ ДЕНЬ
   ===================================================================== */
function renderMoon() {
  const z = sign(); const mi = window.moonInfo(new Date()); const ld = window.LUNAR_DAYS[mi.day - 1];
  const moonSign = window.signById(window.MOON_SIGN_ORDER[mi.signIndex]); const inMine = moonSign.id === z.id;
  const pe = window.PHASE_ELEMENT[mi.group][z.el];
  if (!store.get('m.' + TODAY, null)) { store.set('m.' + TODAY, { day: mi.day }); logDay('m', 'd' + mi.day); }
  view.innerHTML = `
    <div class="moon-stage"><div class="orbit"><div class="halo"></div><div id="moon-art">${moonSVG(0, true, 200, 'big')}</div></div>
      <div class="eyebrow" style="margin-top:18px">${esc(fmtDate(TODAY))}</div><h2 class="display">${esc(mi.phase)}</h2><div class="sub">${mi.day}-й лунный день · символ «${esc(ld.sym)}»</div>
      <div class="moon-stats"><div><b>${mi.day}</b><span>из 30</span></div><div><b>${Math.round(mi.illum * 100)}%</b><span>света</span></div><div><b>${moonSign.glyph}</b><span>Луна в ${esc(inSign(moonSign))}</span></div></div></div>
    <div class="sheet flat">
      <div class="eyebrow">${mi.day}-й лунный день</div><h2 class="name display">${esc(ld.sym)}</h2><div class="key">${esc(ld.key)}</div>
      <div class="msg">${ld.text.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
      <div class="dodont"><div class="yes"><div class="eyebrow">Стоит</div>${esc(ld.do)}</div><div class="no"><div class="eyebrow">Не стоит</div>${esc(ld.avoid)}</div></div>
      <div class="box zodiac"><div class="eyebrow">${z.glyph} ${esc(z.name)} и ${esc(window.PHASE_NAMES[mi.group].toLowerCase())}</div><p>${esc(pe)}</p></div>
      <div class="box"><div class="eyebrow">${moonSign.glyph} Луна сегодня в ${esc(inSign(moonSign))}</div><p>${esc(window.MOON_IN_SIGN[moonSign.id])}</p>${inMine ? `<p style="margin-top:10px;color:var(--gold-2)">${esc(window.MOON_IN_YOUR_SIGN)}</p>` : ''}</div>
      <div class="box quote"><div class="eyebrow">Твоя фраза на лунный день</div><p>«${esc(moonPhrase(mi, z))}»</p><div class="btn-row"><button class="btn primary sm" id="m-post">Открытка в сторис</button><button class="btn sm" id="m-copy">Скопировать</button></div></div>
      <div class="foot"><span>Следующий лунный день начнётся с восходом Луны</span><span>Серия: ${streak()} дн.</span></div></div>`;
  animateMoon(mi);
  const quote = moonPhrase(mi, z);
  $('#m-post').addEventListener('click', () => openPost({ art: moonSVG(mi.illum, mi.waxing, 110, 'post'), name: `${mi.day}-й лунный день`, quote }));
  $('#m-copy').addEventListener('click', () => share(`${mi.phase}, ${mi.day}-й лунный день · «${ld.sym}»\n«${quote}»\n\nОракул Евы · Eva Space`));
}
function moonPhrase(mi, z) {
  const base = { new: 'Я загадываю по-крупному и не тороплю всходы.', waxing: 'Всё, что я начинаю сейчас, растёт вместе с Луной.', full: 'Я вижу далеко и не принимаю решений на пике.', waning: 'Я отпускаю лишнее, и мне становится легче.' }[mi.group];
  const e = { fire: 'Мой огонь горит ровно.', earth: 'Моя земля держит меня.', air: 'Мой ветер знает направление.', water: 'Моя вода спокойна.' }[z.el];
  return `${base} ${e}`;
}
function animateMoon(mi) {
  const wrap = $('#moon-art'); if (!wrap) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) { wrap.innerHTML = moonSVG(mi.illum, mi.waxing, 200, 'big'); return; }
  const t0 = performance.now(); const dur = 1600;
  const tick = (t) => { const k = Math.min(1, (t - t0) / dur); const e = 1 - Math.pow(1 - k, 3); wrap.innerHTML = moonSVG(mi.illum * e, mi.waxing, 200, 'big'); if (k < 1 && $('#moon-art')) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}

/* =====================================================================
   ПРОФИЛЬ
   ===================================================================== */
function renderProfile() {
  const p = profile(); const z = sign(); const e = window.ELEMENTS[z.el];
  const h = history(); const cards = h.filter((x) => x.v !== 'm').length; const days = new Set(h.map((x) => x.date)).size;
  view.innerHTML = `<div class="hero"><div class="eyebrow">Профиль</div><h1 class="display">${esc(p.name)}</h1></div>
    <div class="prof"><div class="glyph">${z.glyph}</div><div><h2 class="display">${esc(z.name)}</h2><p>${p.d} ${['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'][p.m - 1]} ${p.y} · стихия ${esc(e.name.toLowerCase())}</p></div></div>
    <div class="stats"><div><b>${streak()}</b><span>дней подряд</span></div><div><b>${cards}</b><span>карт открыто</span></div><div><b>${days}</b><span>дней с Оракулом</span></div></div>
    <div class="box zodiac" style="margin:16px 18px 0"><div class="eyebrow">${z.glyph} ${esc(z.name)}</div><p>${esc(z.trait)}</p><p class="muted small" style="margin-top:8px">Сильная сторона: ${esc(z.strength)}. Тень: ${esc(z.shadow)}.</p></div>
    <div class="list"><button id="p-install">Установить на телефон <span>→</span></button><button id="p-greet">Перечитать приветственный расклад <span>→</span></button><button id="p-edit">Изменить имя или дату рождения <span>→</span></button><button id="p-today" class="danger">Сбросить сегодняшние карты (демо) <span>→</span></button><button id="p-reset" class="danger">Удалить все данные <span>→</span></button></div>
    <p class="proto-note">Все данные хранятся только в этом браузере. Ничего не отправляется на сервер.</p>`;
  $('#p-install').addEventListener('click', () => openInstall(true));
  $('#p-greet').addEventListener('click', () => go('greeting'));
  $('#p-edit').addEventListener('click', () => go('welcome'));
  $('#p-today').addEventListener('click', () => { ['a', 'b', 'm'].forEach((v) => store.del(v + '.' + TODAY)); store.set('history', history().filter((x) => x.date !== TODAY)); toast('Сегодняшние карты сброшены'); renderProfile(); });
  $('#p-reset').addEventListener('click', () => { if (confirm('Удалить профиль, историю и заметки?')) { store.clear(); location.hash = '#/welcome'; location.reload(); } });
}


/* =====================================================================
   УСТАНОВКА НА ТЕЛЕФОН
   ===================================================================== */
const UA = navigator.userAgent || '';
const isIOS = /iPad|iPhone|iPod/.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = /Android/.test(UA);
const inAppBrowser = /FBAN|FBAV|FB_IAB|Instagram|MicroMessenger|VKClient|WhatsApp|Telegram|TikTok|OKApp|Line\//i.test(UA) || (isIOS && !/Safari/.test(UA));
function isStandalone() {
  try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch { return false; }
}
let installEvent = null;
let installShown = false;

addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; });
addEventListener('appinstalled', () => { store.set('install.done', true); closeInstall(); toast('Готово, Оракул на твоём экране'); });

const IC_SHARE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3"/><path d="M8.5 6.5 12 3l3.5 3.5"/><path d="M6 12H5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1h-1"/></svg>';
const IC_PLUS_BOX = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><path d="M12 8v8M8 12h8"/></svg>';
const IC_DOTS = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9"/></svg>';

function installVariant() {
  if (isStandalone()) return null;
  if (installEvent) return 'prompt';
  if (inAppBrowser) return 'inapp';
  if (isIOS) return 'ios';
  if (isAndroid) return 'android';
  return null;
}
function maybeOfferInstall(delay = 1400) {
  if (installShown || isStandalone() || store.get('install.done', false)) return;
  const later = store.get('install.later', 0);
  if (later && Date.now() - later < 3 * 86400000) return;
  if (!installVariant()) return;
  installShown = true;
  setTimeout(() => { if (!isStandalone()) openInstall(); }, delay);
}
function closeInstall() { const el = $('#install'); if (el) { el.classList.remove('on'); setTimeout(() => { el.hidden = true; }, 260); } }

function openInstall(manual) {
  const v = installVariant();
  const el = $('#install');
  if (!v) { if (manual) toast(isStandalone() ? 'Оракул уже установлен' : 'Добавь страницу в закладки'); return; }
  const icon = `<span class="app-ic"><img src="icons/icon-192.png" alt=""></span>`;
  let body = '';
  if (v === 'prompt' || v === 'android') {
    body = `<h3 class="display">Пусть Оракул живёт на твоём экране</h3>
      <p>Приложение откроется на весь экран, без адресной строки, и будет работать даже без интернета.</p>
      <button class="btn primary block" id="ins-go">Установить</button>`;
  } else if (v === 'ios') {
    body = `<h3 class="display">Добавь Оракула на экран «Домой»</h3>
      <p>Три касания, и он будет открываться как обычное приложение, на весь экран и без интернета.</p>
      <ol class="steps-list">
        <li><span class="n">1</span><span>Нажми <i class="gl">${IC_SHARE}</i> внизу экрана</span></li>
        <li><span class="n">2</span><span>Пролистай и выбери <i class="gl">${IC_PLUS_BOX}</i> «На экран «Домой»</span></li>
        <li><span class="n">3</span><span>Нажми «Добавить» справа вверху</span></li>
      </ol>
      <button class="btn block" id="ins-later">Понятно</button>`;
  } else {
    body = `<h3 class="display">Открой Оракула в браузере</h3>
      <p>Сейчас страница открыта внутри мессенджера, отсюда приложение не установить.</p>
      <ol class="steps-list">
        <li><span class="n">1</span><span>Нажми <i class="gl">${IC_DOTS}</i> в углу экрана</span></li>
        <li><span class="n">2</span><span>Выбери «Открыть в ${isIOS ? 'Safari' : 'браузере'}»</span></li>
        <li><span class="n">3</span><span>Там появится подсказка, как добавить на экран</span></li>
      </ol>
      <button class="btn block" id="ins-copy">Скопировать ссылку</button>`;
  }
  el.innerHTML = `<div class="install-back"></div><div class="install-card">${icon}${body}<button class="textlink" id="ins-dismiss">Не сейчас</button></div>`;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add('on'));
  const dismiss = () => { store.set('install.later', Date.now()); closeInstall(); };
  $('#ins-dismiss').addEventListener('click', dismiss);
  $('.install-back', el).addEventListener('click', dismiss);
  const go = $('#ins-go');
  if (go) go.addEventListener('click', async () => {
    if (!installEvent) { toast('Открой меню браузера и выбери «Установить приложение»'); return; }
    closeInstall();
    installEvent.prompt();
    try { const r = await installEvent.userChoice; if (r && r.outcome !== 'accepted') store.set('install.later', Date.now()); } catch {}
    installEvent = null;
  });
  const later = $('#ins-later'); if (later) later.addEventListener('click', dismiss);
  const copy = $('#ins-copy'); if (copy) copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(location.href); toast('Ссылка скопирована'); } catch { toast(location.href); }
  });
}

/* регистрация офлайн-оболочки */
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && document.querySelector('link[rel="manifest"]')) {
  addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}

route();
})();
