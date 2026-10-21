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
  zoom:    {name: 'Раскраска', icon: '🖍'},   // ключ остался прежним: выбор уже сохранён у людей
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
/* язык под стиль: смысл тот же, подача — языком эпохи или детской книжки.
   Обычный и «для акционеров» — оригинальный текст. */
const PT_HEADS = {
  tsar: {'кратко': 'Вкратцѣ', 'решения': 'Повелѣваемъ', 'следующие шаги': 'Надлежитъ исполнить', 'повестка': 'Порядокъ собранія', 'итоги': 'Итоги'},
  zoom: {'кратко': 'О чём мы болтали', 'решения': 'Что мы вместе решили ♥', 'следующие шаги': 'Наши маленькие шаги', 'повестка': 'О чём хотели поговорить', 'итоги': 'Что получилось'},
};
const ptHead = (theme, line) => {
  const m = /^(.*?):\s*$/.exec(line.trim());
  if (!m) return null;
  const k = m[1].toLowerCase().replace(/ё/g, 'е');
  return (PT_HEADS[theme] || {})[k] || null;
};
const PT_WORDS = {
  tsar: [[/(?<![а-яёА-ЯЁ])задач(а|у|и|ей|ам|ами|ах)?(?![а-яёА-ЯЁ])/giu, w => ({'': 'порученій', а: 'порученіе', у: 'порученіе', и: 'порученія', ей: 'порученіемъ', ам: 'порученіямъ', ами: 'порученіями', ах: 'порученіяхъ'})[(/задач(.*)/i.exec(w) || [])[1] || ''] || w],
    [/(?<![а-яёА-ЯЁ])к (встрече|созвону)(?![а-яёА-ЯЁ])/giu, 'къ собранію'],
    [/(?<![а-яёА-ЯЁ])(созвон|встреча)(?![а-яёА-ЯЁ])/giu, 'собраніе'], [/(?<![а-яёА-ЯЁ])(созвоне|встрече)(?![а-яёА-ЯЁ])/giu, 'собраніи'], [/(?<![а-яёА-ЯЁ])(нужно|надо)(?![а-яёА-ЯЁ])/giu, 'надлежитъ'], [/(?<![а-яёА-ЯЁ])компани(я|и)(?![а-яёА-ЯЁ])/giu, (w, e) => 'компані' + e]],
  zoom: [[/(?<![а-яёА-ЯЁ])задач(а|у|и|ей)(?![а-яёА-ЯЁ])/giu, (w, e) => ({а: 'задачка', у: 'задачку', и: 'задачки', ей: 'задачкой'})[e.toLowerCase()]], [/(?<![а-яёА-ЯЁ])задач(?![а-яёА-ЯЁ])/giu, 'задачек'], [/(?<![а-яёА-ЯЁ])нужно(?![а-яёА-ЯЁ])/giu, 'надо бы']],
};
/* дореформенная орфография: «ъ» после согласной на конце слова, «і» перед гласной в окончаниях */
const ptYat = t => t.replace(/[А-Яа-яЁёІіѢѣ]+/g, w => {
  if (w.length > 1 && w === w.toUpperCase()) return w;
  let x = w.replace(/и(е|я|ю|й)$/i, (m, v) => 'і' + v).replace(/ие(м|х)$/i, 'іе$1');
  if (/[бвгджзклмнпрстфхцчшщ]$/i.test(x)) x += 'ъ';
  return x;
});
function ptLang(text, theme) {
  if (theme !== 'tsar' && theme !== 'zoom') return String(text || '');
  return String(text || '').split('\n').map(line => {
    const h = ptHead(theme, line);
    if (h) return h + ':';
    let x = line;
    /* заглавная буква в начале фразы остаётся заглавной */
    (PT_WORDS[theme] || []).forEach(([re, to]) => { x = x.replace(re, (...m) => { const r = typeof to === 'function' ? to(...m) : to; return /^[А-ЯЁ]/.test(m[0]) ? r[0].toUpperCase() + r.slice(1) : r; }); });
    return theme === 'tsar' ? ptYat(x) : x;
  }).join('\n');
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
  const body = ptBody(ptLang(p.text, theme));
  if (theme === 'zoom') return ptColoring(p);
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
  return `<article class="pt pt-std">
    <div class="pt-kick">Протокол · ${esc(dayLong(p.date))} ${String(p.date || '').slice(0, 4)}</div>
    <h1>${esc(p.title)}</h1>
    <div class="pt-sub">${esc(PROTO_LEVELS[lv].name)}${rec ? ` · <a href="${esc(rec)}">запись встречи</a>` : ''}</div>
    <div class="pt-text">${body}</div>
    ${ppl.length ? `<h3>Подтверждения</h3><ul class="pt-oks">${ppl.map(k => `<li><span>${esc(whoName(k))}</span><i>${ok[k] ? 'Ок · ' + esc(ptWhen(ok[k])) : 'ждём'}</i></li>`).join('')}</ul>` : ''}
  </article>`;
}
/* раскраска — как книжка для Исполнительного директора: шаги, похвала, картинки.
   Нажал на картинку — она раскрашивается; раскрасил всё — праздник. */
const PC_COLORS = ['#F6B3C8', '#FFD98A', '#B9E3C6', '#C9C2F2', '#A9D8F5', '#FFC2A8'];
const PC_PICS = [
  '<path class="pc-f" d="M20 52 L50 28 L80 52 Z"/><rect class="pc-f" x="26" y="52" width="48" height="36"/><rect class="pc-f" x="43" y="66" width="14" height="22"/><path d="M50 40 c-3 -4 -8 0 0 6 c8 -6 3 -10 0 -6z"/>',
  '<path class="pc-f" d="M50 14 L59 38 L84 38 L64 54 L72 80 L50 64 L28 80 L36 54 L16 38 L41 38 Z"/><circle cx="44" cy="46" r="1.8"/><circle cx="56" cy="46" r="1.8"/><path d="M44 53 q6 5 12 0"/>',
  '<circle class="pc-f" cx="50" cy="50" r="18"/><path d="M50 18 v-8 M50 90 v-8 M18 50 h-8 M90 50 h-8 M27 27 l-6 -6 M73 73 l6 6 M73 27 l6 -6 M27 73 l-6 6"/><circle cx="44" cy="46" r="1.8"/><circle cx="56" cy="46" r="1.8"/><path d="M43 55 q7 6 14 0"/>',
  '<path class="pc-f" d="M50 82 C20 60 14 44 22 32 C30 20 46 24 50 36 C54 24 70 20 78 32 C86 44 80 60 50 82Z"/>',
  '<circle class="pc-f" cx="50" cy="40" r="10"/><circle class="pc-f" cx="34" cy="34" r="10"/><circle class="pc-f" cx="66" cy="34" r="10"/><circle class="pc-f" cx="40" cy="52" r="10"/><circle class="pc-f" cx="60" cy="52" r="10"/><path d="M50 62 v26 M50 76 q-10 -8 -16 -4 M50 80 q10 -8 16 -4"/>',
  '<path class="pc-f" d="M50 12 C66 24 68 50 60 70 L40 70 C32 50 34 24 50 12Z"/><circle class="pc-f" cx="50" cy="38" r="7"/><path class="pc-f" d="M40 60 L28 76 L40 72 Z M60 60 L72 76 L60 72 Z"/><path d="M44 74 l-2 12 M50 74 v14 M56 74 l2 12"/>',
];
const PC_PRAISE = ['У тебя всё получится, мы в тебя верим!', 'Ты умеешь наводить порядок как никто другой!', 'С тобой всегда приятно работать!', 'Маленький шаг — большая радость для всей команды!', 'Ты настоящая звезда Евы!', 'Мы рядом и всегда поможем!'];
const pcPic = (i, label) => `<button type="button" class="pc-pic" data-pc="${i}" style="--pc:${PC_COLORS[i % PC_COLORS.length]}" aria-label="Раскрасить картинку: ${esc(label)}"><svg viewBox="0 0 100 100">${PC_PICS[i % PC_PICS.length]}</svg></button>`;
function ptColoring(p) {
  const ok = Proto.ok(p), ppl = p.people || [];
  const lines = ptLang(p.text, 'zoom').split('\n');
  const blocks = [];
  let cur = {head: '', paras: [], items: []};
  const push = () => { if (cur.head || cur.paras.length || cur.items.length) blocks.push(cur); };
  lines.forEach(raw => {
    const t = raw.trim();
    if (!t) return;
    const li = /^(?:[•\-–*]|\d+[.)])\s+(.*)$/.exec(t);
    if (li) { cur.items.push(li[1]); return; }
    if (t.length < 90 && /:$/.test(t)) { push(); cur = {head: t.slice(0, -1), paras: [], items: []}; return; }
    cur.paras.push(t);
  });
  push();
  let n = 0;
  const total = blocks.reduce((a, b) => a + (/шаг|задач|сделать/i.test(b.head) ? b.items.length : 0), 0);
  const step = it => {
    const m = /^([А-ЯЁA-Z][\wа-яё]+(?:\s[А-ЯЁ][\wа-яё]+)?)\s*:\s*(.+)$/u.exec(it);
    const who = m ? m[1] : '', what = m ? m[2] : it;
    const when = (/\b(до\s+[^,.;]{2,22}|к\s+пятниц[еу]|сегодня|завтра)/i.exec(what) || [])[1];
    const i = n++;
    return `<div class="pc-step"><div class="pc-num">Шаг ${i + 1} из ${total}</div>
      <div class="pc-row"><div class="pc-txt"><p><b>Что делаем:</b> ${esc(what)}</p>${who ? `<p><b>Кто:</b> ${esc(who)}</p>` : ''}${when ? `<p>☀ <b>Когда:</b> ${esc(when)}</p>` : ''}
        <p class="pc-love">♥ ${esc(PC_PRAISE[i % PC_PRAISE.length])}</p><p class="pc-check">☐ Готово? Раскрась картинку!</p></div>${pcPic(i, what)}</div></div>`;
  };
  const html = blocks.map(b => {
    const steps = /шаг|задач|сделать/i.test(b.head);
    return `${b.head ? `<h3>${esc(b.head)}</h3>` : ''}${b.paras.map(x => `<p>${esc(x)}</p>`).join('')}
      ${b.items.length ? (steps ? b.items.map(step).join('') : `<ul class="pc-hearts">${b.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`) : ''}`;
  }).join('');
  const rec = p.recUrl && safeUrl(p.recUrl) ? safeUrl(p.recUrl) : '';
  return `<article class="pt pt-zoom" data-pc-total="${n}">
    <div class="pc-cover"><div class="pc-for">для самой лучшей команды</div>
      <h1>${esc(p.title)}</h1>
      <div class="pc-sub">Наш протокол — по маленьким шагам и с картинками</div>
      <div class="pc-from">С любовью от Ясеня ♥ · ${esc(dayLong(p.date))}</div>
      ${pcPic(n + 1, 'обложка')}</div>
    <p class="pc-intro">Эта книжка — про наш созвон. Здесь всё, о чём мы договорились, разложено по маленьким шагам. Сделал шаг — раскрась картинку! К концу у нас будет целая цветная книжка ♥</p>
    ${html}
    ${ppl.length ? `<h3>Кто уже сказал «Ок» ♥</h3><div class="pt-stickers">${ppl.map(k => `<span class="${ok[k] ? 'ok' : ''}">${ok[k] ? '♥' : '☐'} ${esc(whoFirst(k))}${ok[k] ? ' — Ок!' : ' — ждём'}</span>`).join('')}</div>` : ''}
    ${rec ? `<p class="pc-rec">🎥 <a href="${esc(rec)}">Запись нашего созвона</a></p>` : ''}
    <div class="pc-hooray">Ура! Вся книжка раскрашена ♥ Вы лучшие!</div>
    <div class="pt-foot">Мы рядом и всегда поможем ♥</div>
  </article>`;
}
/* картинку раскрашивают нажатием: где бы протокол ни был открыт */
document.addEventListener('click', e => {
  const pic = e.target.closest && e.target.closest('.pc-pic');
  if (!pic) return;
  pic.classList.toggle('done');
  const step = pic.closest('.pc-step'), chk = step && step.querySelector('.pc-check');
  if (chk) chk.textContent = pic.classList.contains('done') ? '☑ Готово! Картинка раскрашена ♥' : '☐ Готово? Раскрась картинку!';
  const art = pic.closest('.pt-zoom');
  if (art) art.classList.toggle('all', art.querySelectorAll('.pc-pic').length === art.querySelectorAll('.pc-pic.done').length);
});
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

.pt-zoom{background:#fff; color:#222; font-family:Neucha,'Comic Sans MS',cursive; font-size:19px; border:3px solid #111; border-radius:22px; box-shadow:6px 6px 0 #111;}
.pt-zoom h3{font:400 24px Neucha,cursive; display:inline-block; border:2.5px solid #111; border-radius:12px; padding:2px 14px; transform:rotate(-1.5deg); margin-top:22px;}
.pt-zoom .pc-cover{text-align:center; border:2.5px dashed #111; border-radius:20px; padding:18px 18px 8px; margin-bottom:16px;}
.pt-zoom .pc-for{font-size:16px; letter-spacing:.06em;} .pt-zoom h1{font:400 34px/1.15 'Rubik Doodle Shadow',Neucha,cursive; margin:6px 0;}
.pt-zoom .pc-sub{font-size:20px;} .pt-zoom .pc-from{font-size:16px; margin:4px 0 6px;}
.pt-zoom .pc-cover .pc-pic{width:150px; height:150px;}
.pt-zoom .pc-step{border:2.5px solid #111; border-radius:18px; padding:12px 16px; margin:12px 0;}
.pt-zoom .pc-num{display:inline-block; border:2px solid #111; border-radius:99px; padding:0 12px; font-size:16px; margin-bottom:6px;}
.pt-zoom .pc-row{display:flex; gap:14px; align-items:center;} .pt-zoom .pc-txt{flex:1;} .pt-zoom .pc-txt p{margin:2px 0;}
.pt-zoom .pc-love{color:#B23A6F;} .pt-zoom .pc-check{font-size:17px; opacity:.85;}
.pt-zoom .pc-pic{flex:0 0 120px; width:120px; height:120px; border:0; background:none; padding:0; cursor:pointer; transition:transform .2s;}
.pt-zoom .pc-pic:hover{animation:pcWiggle .5s ease-in-out;}
.pt-zoom .pc-pic svg{width:100%; height:100%; fill:none; stroke:#111; stroke-width:2.6; stroke-linecap:round; stroke-linejoin:round;}
.pt-zoom .pc-pic .pc-f{fill:#fff; transition:fill .7s ease;} .pt-zoom .pc-pic.done .pc-f{fill:var(--pc);}
.pt-zoom .pc-pic.done{animation:pcPop .5s ease;}
.pt-zoom .pc-hearts{list-style:none; padding-left:4px;} .pt-zoom .pc-hearts li::before{content:'♡ ';}
.pt-zoom .pt-stickers{display:flex; flex-wrap:wrap; gap:10px;} .pt-zoom .pt-stickers span{border:2.5px solid #111; border-radius:14px; padding:4px 12px; transform:rotate(-2deg);} .pt-zoom .pt-stickers span:nth-child(even){transform:rotate(2deg);} .pt-zoom .pt-stickers span.ok{background:#FDE3EC;}
.pt-zoom .pc-hooray{display:none; text-align:center; font-size:26px; margin:18px 0 0; color:#B23A6F; animation:pcPop .6s ease;} .pt-zoom.all .pc-hooray{display:block;}
.pt-zoom .pt-foot{margin-top:18px; text-align:center; border-top:2.5px dashed #111; padding-top:10px;}
@keyframes pcWiggle{0%,100%{transform:rotate(0)}25%{transform:rotate(-6deg)}75%{transform:rotate(6deg)}}
@keyframes pcPop{0%{transform:scale(.85)}60%{transform:scale(1.08)}100%{transform:scale(1)}}
/* анимация видов: царский разворачивается и ставит печать, премиум — проявляется строками */
.pt-tsar .pt-frame{animation:ptUnroll 1s ease both;}
.pt-tsar .pt-seal{animation:ptStamp .8s .9s cubic-bezier(.3,1.6,.5,1) both;}
.pt-premium > *{animation:ptFade .6s ease both;} .pt-premium > *:nth-child(2){animation-delay:.08s} .pt-premium > *:nth-child(3){animation-delay:.16s} .pt-premium > *:nth-child(4){animation-delay:.24s} .pt-premium > *:nth-child(5){animation-delay:.32s} .pt-premium > *:nth-child(n+6){animation-delay:.4s}
.pt-zoom .pc-cover .pc-pic svg{animation:pcFloat 3s ease-in-out infinite;}
@keyframes ptUnroll{from{clip-path:inset(0 0 100% 0); opacity:.4}to{clip-path:inset(0 0 0 0); opacity:1}}
@keyframes ptStamp{0%{transform:scale(2.6) rotate(-50deg); opacity:0}70%{transform:scale(.9) rotate(-8deg); opacity:1}100%{transform:scale(1) rotate(-12deg); opacity:1}}
@keyframes ptFade{from{opacity:0; transform:translateY(6px)}to{opacity:1; transform:none}}
@keyframes pcFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@media (prefers-reduced-motion:reduce){ .pt *, .pt{animation:none !important;} }
@media (max-width:700px){ .pt{padding:22px 18px;} .pt-tsar .pt-frame{padding:22px 16px;} .pt-tsar h1{font-size:32px;} .pt-zoom h1{font-size:28px;} .pt-zoom .pc-row{flex-direction:column; align-items:flex-start;} .pt-zoom .pc-pic{width:100px; height:100px; flex-basis:100px;} }
@media print{ .pt{border-radius:0; box-shadow:none;} .pt *, .pt{animation:none !important;} .pt-zoom .pc-pic .pc-f{fill:#fff !important;} .pt-zoom .pc-hooray{display:none !important;} }
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
