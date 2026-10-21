/* Вид протокола: обычный, царский (шрифт и обращения той эпохи, печать
   Королевства Ева), премиум для акционеров и раскраска для зумеров.
   Каждый выбирает вид сам (помнится в его учётке), по умолчанию — «Ясень
   подберёт»: протоколы основателей и инвесторов — премиум, остальные — обычный.
   Тот же вид уходит в PDF. Шрифты эпох грузятся, только когда вид открыли. */

const PT_THEMES = {
  auto:    {name: 'Ясень подберёт', icon: '✨'},
  std:     {name: 'Обычный', icon: '📄'},
  tsar:    {name: 'Царский', icon: '👑'},
  premium: {name: 'Для акционеров', icon: '💼'},
  zoom:    {name: 'Раскраска', icon: '🖍'},
};
const PT_FONTS = 'https://fonts.googleapis.com/css2?family=Old+Standard+TT:ital,wght@0,400;0,700;1,400&family=Ruslan+Display&family=Cormorant+Garamond:wght@500;600;700&family=Neucha&family=Rubik+Doodle+Shadow&display=swap';
const ptAuto = p => (protoLevel(p) <= 2 ? 'premium' : 'std');
const ptPick = p => { const t = Prefs.get('proto.theme', 'auto'); return t === 'auto' || !PT_THEMES[t] ? ptAuto(p) : t; };
function ptFonts(doc = document) {
  if (doc.getElementById('ptFonts')) return;
  const l = doc.createElement('link');
  l.id = 'ptFonts'; l.rel = 'stylesheet'; l.href = PT_FONTS;
  doc.head.appendChild(l);
}
/* текст протокола: строки «Решения:» — заголовки, «•», «-», «1.» — пункты */
function ptBody(text) {
  const out = [];
  let list = null;
  const flush = () => { if (list) { out.push(`<ul>${list.join('')}</ul>`); list = null; } };
  String(text || '').split('\n').forEach(raw => {
    const s = raw.trim();
    if (!s) { flush(); return; }
    const li = /^(?:[•\-–*]|\d+[.)])\s+(.*)$/.exec(s);
    if (li) { (list = list || []).push(`<li>${esc(li[1])}</li>`); return; }
    flush();
    if (s.length < 90 && /:$/.test(s)) out.push(`<h3>${esc(s.slice(0, -1))}</h3>`);
    else out.push(`<p>${esc(s)}</p>`);
  });
  flush();
  return out.join('') || '<p>Текста протокола пока нет.</p>';
}
const ptWhen = ts => new Date(ts).toLocaleString('ru-RU', {timeZone: 'Europe/Moscow', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'});
const ptDateLong = d => `${dayLong(d)} ${String(d || '').slice(0, 4)} года`;
/* печать Королевства Ева: сургуч, корона и надпись по кругу */
const PT_SEAL = `<svg class="pt-seal" viewBox="0 0 160 160" aria-label="Печать Королевства Ева">
  <defs><path id="ptRing" d="M80 80 m-56 0 a56 56 0 1 1 112 0 a56 56 0 1 1 -112 0"/></defs>
  <path d="M80 6 C104 4 118 18 134 26 C150 38 156 58 154 80 C156 104 146 120 132 134 C116 150 98 156 80 154 C58 156 40 148 26 134 C12 120 4 102 6 80 C4 56 14 36 28 24 C42 10 60 8 80 6Z" fill="#8E1B1B"/>
  <circle cx="80" cy="80" r="64" fill="none" stroke="#5E0F0F" stroke-width="3"/><circle cx="80" cy="80" r="46" fill="none" stroke="#5E0F0F" stroke-width="2"/>
  <text font-family="Ruslan Display, serif" font-size="12.5" fill="#F3D9A4" letter-spacing="2"><textPath href="#ptRing" startOffset="2%">ПЕЧАТЬ · КОРОЛЕВСТВА · ЕВА ·</textPath></text>
  <path d="M58 92 L54 66 L66 76 L80 58 L94 76 L106 66 L102 92 Z" fill="#F3D9A4"/><rect x="57" y="94" width="46" height="7" rx="2" fill="#F3D9A4"/>
  <circle cx="54" cy="64" r="3.5" fill="#F3D9A4"/><circle cx="80" cy="56" r="3.5" fill="#F3D9A4"/><circle cx="106" cy="64" r="3.5" fill="#F3D9A4"/>
  <text x="80" y="118" text-anchor="middle" font-family="Ruslan Display, serif" font-size="11" fill="#F3D9A4">MMXXVI</text></svg>`;
/* документ протокола в выбранном виде — и в окне, и в PDF */
function ptDoc(p, theme) {
  const ok = Proto.ok(p), ppl = p.people || [], lv = protoLevel(p);
  const rec = p.recUrl && safeUrl(p.recUrl) ? safeUrl(p.recUrl) : '';
  const no = `EVA-${String(p.date || '').replace(/-/g, '')}-${String(p.id || '').slice(-4).toUpperCase()}`;
  const body = ptBody(p.text);
  if (theme === 'tsar') {
    return `<article class="pt pt-tsar"><div class="pt-frame">
      <div class="pt-crown">♔</div>
      <div class="pt-kick">Высочайше утверждённый</div>
      <h1>Протоколъ</h1>
      <div class="pt-sub">${esc(p.title)}</div>
      <p class="pt-greet">Милостивыя государыни и государи!</p>
      <p class="pt-intro">Симъ объявляется, что въ Штабъ-квартирѣ Eva Club ${esc(ptDateLong(p.date))} держано было собраніе, на коемъ постановлено нижеслѣдующее:</p>
      <div class="pt-text">${body}</div>
      ${ppl.length ? `<h3 class="pt-oks-h">Собственноручно утвердили</h3><ul class="pt-oks">${ppl.map(k => `<li><span>${esc(whoName(k))}</span><i>${ok[k] ? 'утверждено ' + esc(ptWhen(ok[k])) : 'ожидаетъ утвержденія'}</i></li>`).join('')}</ul>` : ''}
      ${rec ? `<p class="pt-rec">Запись собранія хранится <a href="${esc(rec)}">въ архивѣ</a>.</p>` : ''}
      <div class="pt-end"><span>Быть по сему.</span>${PT_SEAL}</div>
    </div></article>`;
  }
  if (theme === 'premium') {
    return `<article class="pt pt-premium">
      <div class="pt-top"><span>Eva Space</span><span>Конфиденциально · для акционеров и инвесторов</span></div>
      <div class="pt-kick">Протокол заседания № ${esc(no)}</div>
      <h1>${esc(p.title)}</h1>
      <table class="pt-meta"><tr><td>Дата</td><td>${esc(ptDateLong(p.date))}</td></tr>
        <tr><td>Доступ</td><td>${esc(PROTO_LEVELS[lv].name)}</td></tr>
        ${rec ? `<tr><td>Запись</td><td><a href="${esc(rec)}">запись заседания</a></td></tr>` : ''}</table>
      <div class="pt-text">${body}</div>
      ${ppl.length ? `<h3>Утверждение протокола</h3><table class="pt-sign">${ppl.map(k => `<tr><td>${esc(whoName(k))}</td><td class="${ok[k] ? 'ok' : ''}">${ok[k] ? 'Утверждено · ' + esc(ptWhen(ok[k])) : 'Ожидает утверждения'}</td></tr>`).join('')}</table>` : ''}
      <div class="pt-foot"><span class="pt-mono">ES</span><span>Eva Space · штаб Eva Club · документ сформирован автоматически</span></div>
    </article>`;
  }
  if (theme === 'zoom') {
    const doodle = `<svg class="pt-doodle" viewBox="0 0 120 60"><path d="M10 40 l6 -14 l6 14 l-14 -9 h16 z" /><circle cx="52" cy="28" r="12"/><path d="M46 26 q2 -3 4 0 M54 26 q2 -3 4 0 M46 32 q6 6 12 0"/><path d="M80 44 c4 -18 22 -18 26 0 c-6 -8 -20 -8 -26 0z"/><path d="M92 18 v-8 M86 20 l-4 -6 M98 20 l4 -6"/></svg>`;
    return `<article class="pt pt-zoom">
      ${doodle}
      <div class="pt-kick">протокол, но вайбово ✌️</div>
      <h1>${esc(p.title)}</h1>
      <div class="pt-sub">📅 ${esc(dayLong(p.date))} · кто в теме: ${esc(PROTO_LEVELS[lv].short.toLowerCase())}${rec ? ` · <a href="${esc(rec)}">запись тут 🎥</a>` : ''}</div>
      <div class="pt-text">${body}</div>
      ${ppl.length ? `<h3>кто апрувнул 👇</h3><div class="pt-stickers">${ppl.map(k => `<span class="${ok[k] ? 'ok' : ''}">${ok[k] ? '✅' : '⏳'} ${esc(whoFirst(k))}${ok[k] ? ' апрувнул(а)' : ' ещё думает'}</span>`).join('')}</div>` : ''}
      <div class="pt-foot">раскрась меня 🖍 · no cap, всё по фактам 💅</div>
    </article>`;
  }
  return `<article class="pt pt-std">
    <div class="pt-kick">Протокол · ${esc(dayLong(p.date))} ${String(p.date || '').slice(0, 4)}</div>
    <h1>${esc(p.title)}</h1>
    <div class="pt-sub">${esc(PROTO_LEVELS[lv].name)}${rec ? ` · <a href="${esc(rec)}">запись встречи</a>` : ''}</div>
    <div class="pt-text">${body}</div>
    ${ppl.length ? `<h3>Подтверждения</h3><ul class="pt-oks">${ppl.map(k => `<li><span>${esc(whoName(k))}</span><i>${ok[k] ? 'Ок · ' + esc(ptWhen(ok[k])) : 'ждём'}</i></li>`).join('')}</ul>` : ''}
  </article>`;
}
/* оформление видов: в окне штаба и в окне печати одно и то же */
const PT_CSS = `
.pt{border-radius:14px; padding:34px 40px; line-height:1.6; font-size:15px; overflow-wrap:anywhere;}
.pt h1{margin:0 0 6px;} .pt h3{margin:20px 0 6px;} .pt p{margin:0 0 10px;} .pt ul{margin:0 0 10px; padding-left:22px;} .pt li{margin:3px 0;}
.pt a{color:inherit;}
.pt-oks{list-style:none; padding:0 !important;} .pt-oks li{display:flex; justify-content:space-between; gap:12px; border-bottom:1px solid rgba(0,0,0,.12); padding:6px 0;} .pt-oks i{font-style:normal; opacity:.75;}
.pt-std{background:#fff; color:#1d1b2e; font-family:Inter,-apple-system,Arial,sans-serif;}
.pt-std .pt-kick{font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:#A8456F; font-weight:600;}
.pt-std h1{font:600 24px/1.25 Unbounded,Inter,sans-serif;} .pt-std .pt-sub{color:#6b6880; margin-bottom:16px;} .pt-std h3{font:600 15px Inter,sans-serif; color:#4F46B8;}

.pt-tsar{background:radial-gradient(ellipse at center,#f7ecd0 0%,#ecd9ac 70%,#d9bf85 100%); color:#3b2412; font-family:'Old Standard TT',Georgia,serif; font-size:16.5px; padding:22px;}
.pt-tsar .pt-frame{border:3px double #7a1f1f; outline:1px solid #b8913f; outline-offset:-10px; border-radius:6px; padding:34px 46px 28px; text-align:left;}
.pt-tsar .pt-crown{text-align:center; font-size:34px; color:#9b7424; line-height:1;}
.pt-tsar .pt-kick{text-align:center; font-style:italic; color:#7a1f1f; margin-top:4px;}
.pt-tsar h1{text-align:center; font:400 44px/1.1 'Ruslan Display',serif; color:#7a1f1f; letter-spacing:.06em; margin:4px 0 2px;}
.pt-tsar .pt-sub{text-align:center; font-style:italic; margin-bottom:18px; border-bottom:1px solid #b8913f; padding-bottom:12px;}
.pt-tsar .pt-greet{font-weight:700; font-size:18px;}
.pt-tsar .pt-text > p:first-child::first-letter, .pt-tsar .pt-intro::first-letter{font:400 40px/0.9 'Ruslan Display',serif; color:#7a1f1f; float:left; margin:4px 6px 0 0;}
.pt-tsar h3{font:400 19px 'Ruslan Display',serif; color:#7a1f1f; letter-spacing:.03em;}
.pt-tsar ul li::marker{content:'❧  '; color:#7a1f1f;}
.pt-tsar .pt-oks li{border-bottom:1px dotted #7a1f1f;}
.pt-tsar .pt-end{display:flex; align-items:center; justify-content:space-between; margin-top:18px; font-size:20px; font-style:italic;}
.pt-tsar .pt-seal{width:128px; height:128px; transform:rotate(-12deg); filter:drop-shadow(2px 3px 2px rgba(60,10,10,.35));}

.pt-premium{background:#faf8f3; color:#10203a; font-family:Inter,-apple-system,Arial,sans-serif; border-top:6px solid #10203a;}
.pt-premium .pt-top{display:flex; justify-content:space-between; font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:#8a7350; border-bottom:1px solid #d9cdb4; padding-bottom:10px; margin-bottom:22px;}
.pt-premium .pt-kick{font:600 13px 'Cormorant Garamond',serif; letter-spacing:.12em; text-transform:uppercase; color:#b08d57;}
.pt-premium h1{font:700 32px/1.15 'Cormorant Garamond',Georgia,serif; margin:4px 0 14px;}
.pt-premium .pt-meta{border-collapse:collapse; margin-bottom:18px; font-size:13.5px;} .pt-premium .pt-meta td{padding:4px 18px 4px 0;} .pt-premium .pt-meta td:first-child{color:#8a7350; text-transform:uppercase; font-size:11px; letter-spacing:.1em;}
.pt-premium h3{font:700 20px 'Cormorant Garamond',serif; border-bottom:1px solid #d9cdb4; padding-bottom:4px;}
.pt-premium ul li::marker{color:#b08d57;}
.pt-premium .pt-sign{width:100%; border-collapse:collapse;} .pt-premium .pt-sign td{padding:12px 0 6px; border-bottom:1px solid #10203a;} .pt-premium .pt-sign td:last-child{text-align:right; color:#8a7350; font-size:13px;} .pt-premium .pt-sign td.ok{color:#2c6b4f;}
.pt-premium .pt-foot{display:flex; align-items:center; gap:12px; margin-top:24px; font-size:11px; color:#8a7350; letter-spacing:.05em;}
.pt-premium .pt-mono{width:38px; height:38px; border-radius:50%; border:1.5px solid #b08d57; display:grid; place-items:center; font:700 15px 'Cormorant Garamond',serif; color:#b08d57;}

.pt-zoom{background:#fff; color:#111; font-family:Neucha,'Comic Sans MS',cursive; font-size:19px; border:3px solid #111; border-radius:22px; position:relative; box-shadow:6px 6px 0 #111;}
.pt-zoom .pt-doodle{position:absolute; right:22px; top:16px; width:130px; fill:none; stroke:#111; stroke-width:2.5; stroke-linecap:round; stroke-linejoin:round;}
.pt-zoom .pt-kick{display:inline-block; border:2px dashed #111; border-radius:99px; padding:2px 12px; font-size:16px;}
.pt-zoom h1{font:400 38px/1.15 'Rubik Doodle Shadow',Neucha,cursive; margin:12px 0 6px; max-width:80%;}
.pt-zoom .pt-sub{margin-bottom:16px;}
.pt-zoom h3{font:400 24px 'Rubik Doodle Shadow',Neucha,cursive; display:inline-block; border:2.5px solid #111; border-radius:12px; padding:2px 12px; transform:rotate(-1.5deg);}
.pt-zoom ul{list-style:none; padding-left:4px;} .pt-zoom ul li::before{content:'☆ ';}
.pt-zoom .pt-stickers{display:flex; flex-wrap:wrap; gap:10px;} .pt-zoom .pt-stickers span{border:2.5px solid #111; border-radius:14px; padding:4px 12px; transform:rotate(-2deg);} .pt-zoom .pt-stickers span:nth-child(even){transform:rotate(2deg);}
.pt-zoom .pt-foot{margin-top:22px; text-align:center; border-top:2.5px dashed #111; padding-top:10px;}
@media (max-width:700px){ .pt{padding:22px 18px;} .pt-tsar .pt-frame{padding:22px 16px;} .pt-tsar h1{font-size:32px;} .pt-zoom .pt-doodle{display:none;} .pt-zoom h1{max-width:none; font-size:30px;} }
@media print{ .pt{border-radius:0; box-shadow:none;} }
`;
function ptStyle(doc = document) {
  if (doc.getElementById('ptCss')) return;
  const s = doc.createElement('style');
  s.id = 'ptCss'; s.textContent = PT_CSS;
  doc.head.appendChild(s);
}
/* переключатель вида над протоколом */
function ptSwitch(p, cur) {
  const pref = Prefs.get('proto.theme', 'auto');
  return `<div class="seg pt-switch">${Object.entries(PT_THEMES).map(([k, x]) => `<button type="button" data-pt="${k}" class="${k === pref ? 'on' : ''}" title="${k === 'auto' ? 'Сейчас: ' + esc(PT_THEMES[ptAuto(p)].name) : ''}">${x.icon} ${esc(x.name)}</button>`).join('')}</div>`;
}
