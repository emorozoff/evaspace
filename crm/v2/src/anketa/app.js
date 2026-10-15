/* Публичная анкета Eva. Ссылка: <анкета>#k.ANNA482 — тип и код человека.
   Один вопрос на экран, варианты — крупные кнопки, ответ подтверждают
   кнопкой «Дальше». Ответы помнятся в этом браузере до отправки. В конце —
   «Отправить»: человек пересылает менеджеру ссылку, которая кладёт ответы
   в карточку CRM. Эта же ссылка — реферальная: подруга выберет «Меня
   пригласили», и CRM запишет, кто её привёл. Длинная анкета разбита на
   разделы: на вводном экране — оглавление, над вопросом — раздел и точки
   его вопросов. Страну подставляет город, этап жизни уточняется после
   сферы, график работы спрашиваем только у работающих. На трети и двух
   третях — тёплые слова, в конце у клиентки — подарок: неделя Евы. */

/* на своём сервере анкета живёт по адресу /anketa/, CRM — рядом, в /crm/ */
const CRM_URL = location.pathname.startsWith('/anketa') ? location.origin + '/crm/' : 'https://claude.ai/artifact/CRM_URL_PLACEHOLDER';
const $ = (s, r = document) => r.querySelector(s);
const ESC = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* приватное окно */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* ничего */ } },
};
const INTRO = {
  client:  {emo: '🌸', title: 'Привет! Помоги нам сделать Еву лучше 💜', lead: 'Почти всё — кнопками. Здесь нет правильных ответов: нам важен твой честный опыт. В конце — подарок 🎁', min: 8},
  expert:  {emo: '🎓', title: 'Давайте знакомиться ✨', lead: 'Несколько вопросов о вашем опыте и о том, что можно создать вместе с Евой.', min: 4},
  partner: {emo: '🤝', title: 'Давайте дружить 🤝', lead: 'Расскажите о себе — подберём формат, выгодный обеим сторонам.', min: 3},
  amb:     {emo: '📣', title: 'Стань голосом Евы 💜', lead: 'Расскажи о себе и своей аудитории — придумаем, как тебе удобнее делиться Евой.', min: 3},
};
/* тёплые слова на трети пути — одно из списка */
const CHEERS = [
  'Ты делаешь то, до чего у многих не доходят руки, — честно смотришь на свою жизнь. Это уже забота о себе.',
  'Спасибо за искренность. Такие ответы помогают сделать Еву по-настоящему твоей.',
  'Ты замечательная — и то, как внимательно ты отвечаешь, это только подтверждает.',
  'Каждый ответ — маленький шаг к себе. Ты уже прошла треть, и это прекрасно.',
];

const S = {type: null, code: '', invited: false, all: [], i: -1, a: {}, key: '', m: {}};

function init() {
  const h = Codec.parseAnketaHash(location.hash);
  S.type = h.type;
  S.code = h.code;
  setQuestions(h.type ? applyDiff(h.type, h.diff) : []);
  S.key = `eva-anketa:${h.type || ''}:${h.code || 'new'}`;
  const saved = store.get(S.key);
  if (saved && saved.a) { S.a = saved.a; S.invited = !!saved.invited; S.m = saved.m || {}; }
  if (!S.type) return renderChooser();
  S.i = -1;
  render();
}
/* вопросы по разделам: добавленный в раздел позже идёт внутри своего раздела */
function setQuestions(qs) { S.all = S.type ? groupByBlock(S.type, 'test', qs).flatMap(x => x.qs) : []; }
/* какие вопросы видны сейчас: без автоматических (страна) и без тех, чьё условие не выполнено */
function qs() { return S.all.filter(q => qVisible(q, S.a)); }
function blocks() { return groupByBlock(S.type, 'test', qs()); }
function save() { store.set(S.key, {a: S.a, invited: S.invited, m: S.m}); }
function total() { return qs().length; }
/* в каком разделе вопрос: номер раздела, его вопросы и место внутри */
function where(i) {
  const q = qs()[i], bl = blocks();
  const bi = bl.findIndex(b => b.qs.includes(q));
  const b = bl[bi] || {qs: [q], name: ''};
  return {bi, b, j: b.qs.indexOf(q), n: bl.length};
}

function shell(inner, withTop = true) {
  const inQ = S.i >= 0 && S.i < total();
  const pct = S.i < 0 ? 0 : Math.round((S.i / total()) * 100);
  const w = inQ ? where(S.i) : null;
  const named = w && w.b.name && w.n > 1;
  $('#app').innerHTML = `${withTop ? `<div class="top"><span class="mark">${brandMark()}</span><span class="brand">Eva Space</span>${inQ ? `<span class="count">${S.i + 1} из ${total()}</span>` : ''}</div>
    ${inQ ? `<div class="bar"><i style="width:${pct}%"></i></div>` : ''}
    ${named ? `<div class="sect"><span class="sect-e" aria-hidden="true">${w.b.emo || '•'}</span><b>${esc(w.b.name)}</b><span>${w.bi + 1} из ${w.n}</span>
      <span class="dots" aria-hidden="true">${w.b.qs.map((x, k) => `<i class="${k < w.j ? 'done' : k === w.j ? 'cur' : ''}"></i>`).join('')}</span></div>` : ''}` : ''}${inner}`;
}

function renderChooser() {
  S.i = -1;
  shell(`<div class="card intro fade"><div class="big mark-big">${brandMark()}</div><h1>Кто вы?</h1><p class="lead">Выберите — и покажем вопросы для вас</p>
    <div class="types">${Object.entries(TYPES).map(([k, t]) => `<button data-t="${k}"><span>${t.emo}</span>${t.one}</button>`).join('')}</div></div>`);
  $('#app').onclick = e => {
    const b = e.target.closest('[data-t]');
    if (!b) return;
    S.type = b.dataset.t;
    setQuestions(applyDiff(S.type, null));
    S.key = `eva-anketa:${S.type}:new`;
    const saved = store.get(S.key);
    S.a = saved && saved.a ? saved.a : {};
    S.m = saved && saved.m ? saved.m : {};
    S.i = -1;
    render();
  };
}

/* «Другое» хранится как «Другое: свой ответ» */
const isOther = (q, v) => !!q.other && (v === q.other || String(v || '').startsWith(q.other + OTHER_SEP));
const withOther = (q, text) => (text ? `${q.other}${OTHER_SEP}${text}` : q.other);
const canSkip = q => q.k === 'many' || q.k === 'date' || q.opt || (q.k === 'short' && q.key !== 'name' && !q.city) || q.k === 'text';
const answered = (q, v) => !(v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length));
/* подсказка у вопросов с несколькими ответами */
function pickHint(q) {
  if (q.k !== 'many') return '';
  if (q.hint) return q.hint;
  return q.max === 2 ? 'Выбери один или два варианта' : q.max ? `Выбери до ${q.max === 3 ? 'трёх' : q.max} вариантов` : 'Выбери один или несколько вариантов';
}
/* pick — длинный список с описаниями: два столбца, описание выбранного — под списком */
const optBtn = (q, o, j, on, pick) => {
  const d = pick ? '' : optDesc(q, o);
  return `<button class="opt ${on ? 'on' : ''}" data-o="${j}" aria-pressed="${on ? 'true' : 'false'}"><span class="ot"><span>${esc(o)}</span>${d ? `<small>${esc(d)}</small>` : ''}</span>${q.k === 'many' ? `<span class="tick">${on ? '✓' : ''}</span>` : '<span class="dot"></span>'}</button>`;
};

function render() {
  if (S.i < 0) return renderIntro();
  if (S.i >= total()) return renderDone();
  const q = qs()[S.i];
  const v = S.a[q.id];
  let ctl = '';
  if (q.k === 'one' || q.k === 'many') {
    let sel = q.k === 'one' ? [v] : (Array.isArray(v) ? v : v ? [v] : []);
    /* этап жизни: только варианты выбранной сферы; чужие отметки снимаем */
    const idx = depOptions(q, S.a);
    if (q.dep && q.k === 'many') { const keep = sel.filter(x => idx.some(i => q.o[i] === x)); if (keep.length !== sel.length) { S.a[q.id] = keep; sel = keep; save(); } }
    const otherOn = sel.some(x => isOther(q, x));
    const otherVal = otherOn ? otherText(q, sel.find(x => isOther(q, x))) : '';
    const many = idx.length + (q.other ? 1 : 0);
    const pick = !!q.od && many > 5;
    const two = pick || many > 7;
    const grouped = q.groups && new Set(idx.map(i => q.g[i])).size > 1;
    const list = grouped
      ? [...new Set(idx.map(i => q.g[i]))].map(g => `<p class="ogroup">${esc(q.groups[g])}</p>${idx.filter(i => q.g[i] === g).map(i => optBtn(q, q.o[i], i, sel.includes(q.o[i]), pick)).join('')}`).join('')
      : idx.map(i => optBtn(q, q.o[i], i, sel.includes(q.o[i]), pick)).join('');
    const tips = pick ? sel.filter(x => optDesc(q, x)).map(x => `<span><b>${esc(x)}</b> — ${esc(optDesc(q, x))}</span>`) : [];
    ctl = `<div class="opts ${two ? 'two' : ''} ${many > 8 ? 'dense' : ''}">${list}${q.other ? optBtn(q, q.other, q.o.length, otherOn, pick) : ''}</div>
      ${q.other ? `<input class="inp other-inp" id="oth" value="${esc(otherVal)}" placeholder="Напиши свой вариант" maxlength="120" ${otherOn ? '' : 'hidden'}>` : ''}
      ${pick ? `<div class="opt-tip ${tips.length ? 'on' : ''}" aria-live="polite">${tips.length ? tips.join('') : '<span>Нажми на вариант — покажем, что он значит</span>'}</div>` : ''}`;
  } else if (q.k === 'scale') {
    const n = scaleN(q);
    if (n === 5) {
      ctl = `<div class="scale">${SCALE_EMO.map((e, j) => `<button class="${Number(v) === j + 1 ? 'on' : ''}" data-s="${j + 1}" aria-label="${j + 1} из 5">${e}<small>${j + 1}</small></button>`).join('')}</div>
        <div class="scale-ends"><span>1 — ${esc(q.lo || '')}</span><span>${n} — ${esc(q.hi || '')}</span></div>`;
    } else {
      const x = Number(v) || 0, tip = q.sh && x ? q.sh[x - 1] : null;
      ctl = `<div class="scale10 hue" role="radiogroup">${Array.from({length: n}, (_, j) => `<button class="${x === j + 1 ? 'on' : ''}" data-s="${j + 1}" role="radio" aria-checked="${x === j + 1}" aria-label="${j + 1} из ${n}${q.sh ? ' — ' + esc(q.sh[j][0]) : ''}" style="--h:${scaleHue(j + 1, n)}">${j + 1}</button>`).join('')}</div>
        <div class="scale-ends"><span>1 — ${esc(q.lo || '')}</span><span>${n} — ${esc(q.hi || '')}</span></div>
        <div class="scale-tip ${tip ? 'on' : ''}" style="--h:${x ? scaleHue(x, n) : 0}" aria-live="polite">${tip ? `<b>${x} · ${esc(tip[0])}</b><span>${esc(tip[1])}</span>` : `<span>${q.sh ? 'Нажми на цифру — покажем, что она значит' : 'Выбери цифру'}</span>`}</div>`;
    }
  } else if (q.k === 'date') {
    const y = new Date().getFullYear();
    ctl = `<input class="inp" id="inp" type="date" value="${esc(v || '')}" min="${y - 90}-01-01" max="${y - 12}-12-31">`;
  } else if (q.k === 'text') {
    ctl = `<textarea class="inp" id="inp" placeholder="${esc(q.ph || 'Напишите, как есть')}">${esc(v || '')}</textarea>`;
  } else if (q.city) {
    ctl = `<input class="inp" id="inp" value="${esc(v || '')}" placeholder="${esc(q.ph || '')}" autocomplete="address-level2" autocapitalize="words">
      <div class="sugg" id="sugg"></div><div class="country" id="ctry"></div>`;
  } else {
    ctl = `<input class="inp" id="inp" value="${esc(v || '')}" placeholder="${esc(q.ph || '')}" ${q.key === 'tg' ? 'autocomplete="tel"' : q.key === 'name' ? 'autocomplete="given-name"' : ''}>`;
  }
  const last = S.i === total() - 1;
  const hint = q.k === 'many' ? pickHint(q) : q.city ? '' : q.hint || '';
  shell(`<div class="card q fade"><div class="qhead"><h2>${esc(q.t)}</h2>${hint ? `<p class="hint">${esc(hint)}</p>` : ''}</div>${ctl}
    <div class="act"><button class="go" id="next">${last ? 'Готово 🎉' : 'Дальше →'}</button>
    <div class="nav"><button class="link" id="back">← Назад</button>${canSkip(q) ? '<button class="link" id="skip">Пропустить</button>' : '<span></span>'}</div></div></div>`);
  const inp = $('#inp'), oth = $('#oth');
  if (inp && q.k !== 'date' && !matchMedia('(pointer:coarse)').matches) inp.focus();
  if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter' && (q.k === 'short' || e.ctrlKey || e.metaKey)) { e.preventDefault(); next(); } });
  if (q.city) wireCity(q, inp);
  if (oth) {
    if (!oth.hidden && !oth.value) oth.focus();
    oth.addEventListener('input', () => {
      const text = oth.value.trim().slice(0, 120);
      if (q.k === 'one') S.a[q.id] = withOther(q, text);
      else S.a[q.id] = (S.a[q.id] || []).map(x => (isOther(q, x) ? withOther(q, text) : x));
      save();
    });
    oth.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); next(); } });
  }
  $('#app').onclick = e => {
    const o = e.target.closest('[data-o]');
    const s = e.target.closest('[data-s]');
    if (o) {
      const j = Number(o.dataset.o);
      const isOth = j >= q.o.length;
      const label = isOth ? withOther(q, oth ? oth.value.trim() : '') : q.o[j];
      if (q.k === 'one') { S.a[q.id] = label; save(); render(); return; }
      const cur = (Array.isArray(S.a[q.id]) ? S.a[q.id] : S.a[q.id] ? [S.a[q.id]] : []).slice();
      const at = cur.findIndex(x => (isOth ? isOther(q, x) : x === label));
      if (at >= 0) cur.splice(at, 1);
      else { if (q.max && cur.length >= q.max) { flash(q.max === 2 ? 'Можно выбрать два — сними одну отметку' : `Можно выбрать до ${q.max}`); return; } cur.push(label); }
      S.a[q.id] = cur;
      save();
      render();
      return;
    }
    if (s) { S.a[q.id] = Number(s.dataset.s); save(); render(); return; }
    if (e.target.closest('#next')) next();
    if (e.target.closest('#back')) { S.i--; render(); }
    if (e.target.closest('#skip')) { delete S.a[q.id]; if (q.city) delete S.a.country; save(); go(); }
  };
  function next() {
    if (inp) {
      const val = inp.value.trim();
      if (!val && q.key === 'name') { inp.focus(); flash('Как к тебе обращаться? 🙂'); return; }
      if (q.city) {
        if (!val) { inp.focus(); flash('Напиши город — так мы поймём, где ты'); return; }
        const m = cityCountry(val);
        S.a[q.id] = (m ? m[0] : val).slice(0, 80);
        if (m) S.a.country = m[1];
        else if (!S.a.country) { flash('Выбери страну — город мы не узнали'); return; }
        save();
        return go();
      }
      if (val) S.a[q.id] = val.slice(0, q.k === 'text' ? 600 : 160); else delete S.a[q.id];
      save();
    }
    if (q.k === 'many' && !(S.a[q.id] || []).length) delete S.a[q.id];
    if (!inp && !canSkip(q) && !answered(q, S.a[q.id])) { flash(q.k === 'scale' ? 'Выбери цифру от 1 до ' + scaleN(q) : 'Выбери вариант'); return; }
    if (q.other && isOther(q, q.k === 'one' ? S.a[q.id] : (S.a[q.id] || []).find(x => isOther(q, x))) && oth && !oth.value.trim()) { oth.focus(); flash('Напиши свой вариант'); return; }
    go();
  }
}
/* следующий вопрос; на трети и двух третях — тёплые слова */
function go() {
  S.i++;
  const t = total();
  if (S.type === 'client' && t >= 9) {
    if (S.i === Math.round(t / 3) && !S.m.m1) { S.m.m1 = 1; save(); return cheer(1); }
    if (S.i === Math.round(t * 2 / 3) && !S.m.m2) { S.m.m2 = 1; save(); return cheer(2); }
  }
  render();
}
function cheer(k) {
  const name = S.a.name ? String(S.a.name).split(' ')[0] : '';
  const flowers = k === 2 ? `<div class="bloom" aria-hidden="true">${['🌸', '🌷', '🌼', '🌺', '💐', '🌸', '🌷', '🌼', '🌺', '🌸', '🌷', '🌼'].map((f, i) => `<i style="--x:${(i * 37) % 100}%;--d:${(i % 5) * .35}s;--s:${.9 + (i % 3) * .25}">${f}</i>`).join('')}</div>` : '';
  shell(`<div class="card intro cheer fade">${flowers}
    <div class="big pop">${k === 1 ? '💜' : '💐'}</div>
    <h1>${k === 1 ? `${name ? esc(name) + ', ты' : 'Ты'} молодец!` : 'Спасибо большое за искренние ответы!'}</h1>
    <p class="lead">${k === 1 ? esc(CHEERS[(String(S.a.name || '').length + total()) % CHEERS.length]) : 'Осталось совсем немножко — и твоя Ева станет ещё ближе к тебе 🌸'}</p>
    <p class="meta">${k === 1 ? 'Треть позади' : 'Две трети позади'} · отвечено ${S.i} из ${total()}</p>
    <button class="go" id="cont">${k === 1 ? 'Продолжаем ✨' : 'Дальше 🌷'}</button></div>`);
  $('#app').onclick = e => { if (e.target.closest('#cont')) render(); };
}
/* город: подсказки по первым буквам и страна, которую подставим сами */
function wireCity(q, inp) {
  const sugg = $('#sugg'), ctry = $('#ctry');
  const draw = () => {
    const val = inp.value.trim(), m = cityCountry(val);
    const list = m ? [] : citySuggest(val, 4);
    sugg.innerHTML = list.map(([c, k]) => `<button type="button" data-city="${esc(c)}">${esc(c)}<small>${esc(k)}</small></button>`).join('');
    if (m) { S.a.country = m[1]; save(); }
    const cq = S.all.find(x => x.id === 'country');
    if (!val) ctry.innerHTML = '';
    else if (m) ctry.innerHTML = `<span class="ok">Страна: <b>${esc(m[1])}</b> ✓</span>`;
    else if (!list.length && val.length >= 3 && cq) {
      const cur = S.a.country || '';
      ctry.innerHTML = `<p class="hint">Не узнали город — выбери страну:</p><div class="chips">${[...cq.o, cq.other].map(o => `<button type="button" class="${cur === o || (o === cq.other && isOther(cq, cur)) ? 'on' : ''}" data-ctry="${esc(o)}">${esc(o)}</button>`).join('')}</div>
        ${isOther(cq, cur) ? `<input class="inp other-inp" id="ctryo" value="${esc(otherText(cq, cur))}" placeholder="Какая страна?" maxlength="60">` : ''}`;
      const co = $('#ctryo');
      if (co) co.addEventListener('input', () => { S.a.country = withOther(cq, co.value.trim().slice(0, 60)); save(); });
    } else ctry.innerHTML = '';
  };
  inp.addEventListener('input', () => { if (!cityCountry(inp.value)) { const cq = S.all.find(x => x.id === 'country'); if (S.a.country && cq && cq.o.includes(S.a.country) && !$('#ctry .chips')) delete S.a.country; } draw(); });
  sugg.addEventListener('click', e => { const b = e.target.closest('[data-city]'); if (!b) return; inp.value = b.dataset.city; draw(); });
  ctry.addEventListener('click', e => {
    const b = e.target.closest('[data-ctry]'); if (!b) return;
    const cq = S.all.find(x => x.id === 'country');
    S.a.country = b.dataset.ctry === cq.other ? withOther(cq, '') : b.dataset.ctry;
    save(); draw();
    const co = $('#ctryo'); if (co) co.focus();
  });
  draw();
}
function flash(text) {
  let el = $('#flash');
  if (!el) { el = document.createElement('p'); el.id = 'flash'; el.className = 'flash'; el.setAttribute('role', 'alert'); $('.act').prepend(el); }
  el.textContent = text;
}

function renderIntro() {
  const I = INTRO[S.type];
  const started = Object.keys(S.a).length;
  const bl = blocks();
  const named = bl.length > 1 && bl[0].name;
  const doneIn = b => b.qs.filter(q => S.a[q.id] !== undefined).length;
  shell(`<div class="card intro fade"><div class="big">${I.emo}</div><h1>${esc(I.title)}</h1><p class="lead">${esc(I.lead)}</p>
    <p class="meta">${total()} ${plural(total(), 'вопрос', 'вопроса', 'вопросов')} · около ${I.min} минут${named ? ` · ${bl.length} ${plural(bl.length, 'раздел', 'раздела', 'разделов')}` : ''}</p>
    ${named ? `<ol class="toc">${bl.map(b => `<li class="${doneIn(b) === b.qs.length ? 'done' : ''}"><span class="toc-e" aria-hidden="true">${b.emo || '•'}</span><span><b>${esc(b.name)}</b>${b.about ? `<small>${esc(b.about)}</small>` : ''}</span><em>${doneIn(b) ? `${doneIn(b)}/${b.qs.length}` : b.qs.length}</em></li>`).join('')}</ol>` : ''}
    ${S.invited ? '<div class="note">👭 Ты пришла по приглашению — мы сохраним, кто тебя позвал.</div>' : ''}
    <button class="go" id="start">${started ? 'Продолжить 🚀' : 'Начать 🚀'}</button>
    ${S.code && !S.invited ? '<button class="link" id="inv">Меня пригласили по этой ссылке 👭</button>' : ''}
    <p class="small">Нажимая «Начать», вы соглашаетесь, что команда Eva Space увидит ваши ответы и сможет связаться с вами. Ответы нужны, чтобы сделать продукт лучше, и никуда не публикуются.</p></div>`);
  $('#app').onclick = e => {
    if (e.target.closest('#start')) { const k = qs().findIndex(q => S.a[q.id] === undefined); S.i = started && k >= 0 ? k : 0; render(); }
    if (e.target.closest('#inv')) { S.invited = true; S.a = {}; S.m = {}; S.key += ':inv'; save(); render(); }
  };
}
function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

async function renderDone() {
  /* ответы на вопросы, которые теперь не показываются (сменили занятость), не отправляем */
  S.all.forEach(q => { if (!q.auto && !qVisible(q, S.a)) delete S.a[q.id]; });
  save();
  const gift = S.type === 'client';
  const payload = {v: 1, t: TYPES[S.type].letter, c: S.code || '', r: S.invited ? 1 : 0, a: S.a, at: Date.now(), ...(gift ? {g: 1} : {})};
  const packed = await Codec.pack(payload);
  const link = `${CRM_URL}#in.${packed}`;
  const text = gift ? 'Привет! Это мои ответы для Eva 💜 Жду подарок — неделю Евы 🎁' : 'Привет! Это мои ответы для Eva 💜';
  const tg = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
  const wa = `https://wa.me/?text=${encodeURIComponent(text + ' ' + link)}`;
  const own = S.code && !S.invited && ['client', 'amb'].includes(S.type);
  shell(`<div class="card intro fade"><div class="big">🎉</div><h1>Спасибо${S.a.name ? ', ' + esc(String(S.a.name).split(' ')[0]) : ''}!</h1>
    ${gift ? `<div class="gift"><div class="gift-box" aria-hidden="true">🎁</div><div><b>Неделя Евы — в подарок</b><span>Отправь ответы менеджеру — и в ответ получишь доступ к Еве на 7 дней.</span></div></div>` : ''}
    <p class="lead">${gift ? 'Одно нажатие — и выбери чат с менеджером Евы, который прислал тебе ссылку.' : 'Остался один шаг: отправьте ответы менеджеру Евы, который прислал вам ссылку. Одно нажатие — и выберите чат с ним.'}</p>
    <div class="send" style="width:100%"><a class="tg" href="${esc(tg)}" target="_blank" rel="noopener">✈️ Отправить в Telegram</a><a class="wa" href="${esc(wa)}" target="_blank" rel="noopener">💬 Отправить в WhatsApp</a>
      <button class="go alt" id="copy">📋 Скопировать ссылку с ответами</button></div>
    <textarea class="linkbox" id="lb" readonly hidden>${esc(link)}</textarea>
    ${own ? `<div class="note">👭 Эту же страницу можно переслать подруге: она выберет «Меня пригласили», а мы узнаем, что она от тебя.</div>` : ''}
    <button class="link" id="edit">← Поменять ответы</button></div>`);
  $('#app').onclick = async e => {
    if (e.target.closest('#copy')) {
      const lb = $('#lb');
      try { await navigator.clipboard.writeText(link); e.target.closest('#copy').textContent = '✅ Скопировано — вставь в чат с менеджером'; }
      catch (err) { lb.hidden = false; lb.focus(); lb.select(); }
    }
    if (e.target.closest('#edit')) { S.i = total() - 1; render(); }
  };
}

window.addEventListener('hashchange', init);
init();
