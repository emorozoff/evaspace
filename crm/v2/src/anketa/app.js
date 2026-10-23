/* Публичная анкета Eva. Ссылка: <анкета>#k.ANNA482 — тип и код человека.
   Один вопрос на экран, варианты — крупные кнопки, ответ подтверждают
   кнопкой «Дальше». Ответы помнятся в этом браузере до отправки. На своём
   сервере ответы сразу ложатся в карточку CRM, а следующий шаг — вопросы
   интервью по личной ссылке. Без сервера (или если он не ответил) — как
   раньше: человек пересылает менеджеру ссылку с ответами. Ссылка анкеты —
   реферальная: подруга выберет «Меня пригласили», и CRM запишет, кто её привёл. Длинная анкета разбита на
   разделы: на вводном экране — оглавление, над вопросом — раздел и точки
   его вопросов. Страну подставляет город, этап жизни уточняется после
   сферы, график работы спрашиваем только у работающих. На трети и двух
   третях — тёплые слова, в конце у клиентки — подарок: неделя Евы.
   Форма интервью — /interview/ (или ссылка с .i): открытые вопросы интервью,
   ответ своими словами; на своём сервере ответы сразу ложатся в карточку.
   /interview/#k.ANNA482 — личная ссылка, в карточку человека; /interview/ без
   кода — общая: сначала имя и контакт, сервер заводит новую карточку. */

/* на своём сервере анкета живёт по адресу /anketa/, форма интервью — /interview/, CRM — рядом, в /crm/ */
const TALK_PAGE = location.pathname.startsWith('/interview');
const ON_SRV = TALK_PAGE || location.pathname.startsWith('/anketa');
const CRM_URL = ON_SRV ? location.origin + '/crm/' : 'https://claude.ai/artifact/CRM_URL_PLACEHOLDER';
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
/* общая ссылка на интервью — карточки ещё нет: сначала кто отвечает (в первом разделе) */
function whoQs(type) {
  const ty = TYPES[type].you === 'ты', b = Object.keys((Q_BLOCKS[type] || {}).talk || {})[0];
  return [{id: 'name', k: 'short', key: 'name', b, t: type === 'partner' ? 'Как называется ваша компания?' : ty ? 'Как тебя зовут?' : 'Как вас зовут?', ph: type === 'partner' ? 'Студия «Баланс»' : 'Имя и фамилия'},
    {id: 'tg', k: 'short', key: 'tg', b, t: `${ty ? 'Твой' : 'Ваш'} Telegram или телефон — если захотим уточнить ответ`, ph: '@username или +7…'}];
}
/* интервью по ссылке: те же люди, вопросы — открытые */
const INTRO_TALK = {
  client:  {emo: '💬', title: 'Интервью Eva 💜', lead: 'Ответь своими словами — как рассказала бы подруге. Коротко или подробно, как удобно. Любой вопрос можно пропустить.', min: 20},
  expert:  {emo: '💬', title: 'Вопросы о вашем опыте ✨', lead: 'Ответьте своими словами. Любой вопрос можно пропустить.', min: 15},
  partner: {emo: '💬', title: 'Вопросы о вашем бизнесе 🤝', lead: 'Ответьте своими словами. Любой вопрос можно пропустить.', min: 15},
  amb:     {emo: '💬', title: 'Расскажи о себе 💜', lead: 'Ответь своими словами. Любой вопрос можно пропустить.', min: 15},
};
const TALK_MAX = 4000;
/* вопрос интервью — развёрнутый ответ, можно пропустить */
const asText = q => ({...q, k: 'text', opt: true});
/* тёплые слова на трети пути — одно из списка */
const CHEERS = [
  'Ты делаешь то, до чего у многих не доходят руки, — честно смотришь на свою жизнь. Это уже забота о себе.',
  'Спасибо за искренность. Такие ответы помогают сделать Еву по-настоящему твоей.',
  'Ты замечательная — и то, как внимательно ты отвечаешь, это только подтверждает.',
  'Каждый ответ — маленький шаг к себе. Ты уже прошла треть, и это прекрасно.',
];

const S = {type: null, code: '', talk: false, general: false, invited: false, all: [], i: -1, a: {}, key: '', m: {}, sent: 0};
const part = () => (S.talk ? 'talk' : 'test');

function init() {
  const h = Codec.parseAnketaHash(location.hash);
  /* форма интервью без типа в ссылке — интервью клиентки (кастдев) */
  S.type = h.type || (TALK_PAGE ? 'client' : null);
  S.code = h.code;
  /* интервью по ссылке с .i — только для своей карточки; на /interview/ можно и без кода */
  S.talk = TALK_PAGE || !!(h.talk && h.code);
  S.general = S.talk && !h.code;
  S.key = `eva-anketa:${S.talk ? 'talk:' : ''}${S.type || ''}:${h.code || 'new'}`;
  /* подруга уже нажала «Меня пригласили» на своём телефоне — её ответы лежат отдельно от ответов
     владелицы ссылки; если в этом браузере отвечала и сама владелица — открываем её ответы */
  if (!S.talk && h.code && !store.get(S.key) && store.get(S.key + ':inv')) S.key += ':inv';
  const saved = store.get(S.key);
  S.a = {}; S.invited = false; S.m = {}; S.sent = 0;
  if (saved && saved.a) { S.a = saved.a; S.invited = !!saved.invited; S.m = saved.m || {}; S.sent = saved.sent || 0; }
  /* после отправки сервер дал своей карточке код (новая, приглашённая, общая ссылка) — правки идут в неё */
  if (saved && saved.c && saved.c !== S.code) { S.code = saved.c; S.invited = false; }
  setQuestions(S.type ? applyDiff(S.type, h.diff, part()) : []);
  if (S.talk) document.title = 'Интервью Eva';
  if (!S.type) return renderChooser();
  S.i = -1;
  render();
}
/* вопросы по разделам: добавленный в раздел позже идёт внутри своего раздела */
function setQuestions(qs) { S.all = S.type ? groupByBlock(S.type, part(), S.talk ? [...(S.code ? [] : whoQs(S.type)), ...qs.map(asText)] : qs).flatMap(x => x.qs) : []; }
/* какие вопросы видны сейчас: без автоматических (страна) и без тех, чьё условие не выполнено */
function qs() { return S.all.filter(q => qVisible(q, S.a)); }
function blocks() { return groupByBlock(S.type, part(), qs()); }
function save() { store.set(S.key, {a: S.a, invited: S.invited, m: S.m, ...(S.sent ? {sent: S.sent, c: S.code} : {})}); }
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
    S.sent = saved && saved.sent ? saved.sent : 0;
    S.code = saved && saved.c ? saved.c : '';
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
    ctl = `<textarea class="inp ${S.talk ? 'tall' : ''}" id="inp" placeholder="${esc(q.ph || (S.talk ? 'Напиши своими словами' : 'Напишите, как есть'))}">${esc(v || '')}</textarea>`;
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
      if (val) S.a[q.id] = val.slice(0, S.talk ? TALK_MAX : q.k === 'text' ? 600 : 160); else delete S.a[q.id];
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
  const I = (S.talk ? INTRO_TALK : INTRO)[S.type];
  const started = Object.keys(S.a).length;
  const bl = blocks();
  const named = bl.length > 1 && bl[0].name;
  const doneIn = b => b.qs.filter(q => S.a[q.id] !== undefined).length;
  if (!S.talk && S.sent) return renderSentIntro();
  /* интервью уже отправлено: поменять ответы или (общая ссылка) начать новое — например, за следующую клиентку */
  if (S.talk && S.sent) {
    shell(`<div class="card intro fade"><div class="big">💜</div><h1>Ответы уже у команды Евы</h1>
      <p class="lead">${S.a.name ? esc(String(S.a.name).split(' ')[0]) + ', с' : 'С'}пасибо! Если хочется что-то дополнить — поменяй ответы и отправь ещё раз, они обновятся.</p>
      <button class="go" id="start">Поменять ответы ✏️</button>${S.general ? '<button class="go alt" id="fresh">Новое интервью ✨</button>' : ''}</div>`);
    $('#app').onclick = e => {
      if (e.target.closest('#start')) { S.i = 0; render(); }
      if (e.target.closest('#fresh')) freshTalk();
    };
    return;
  }
  shell(`<div class="card intro fade"><div class="big">${I.emo}</div><h1>${esc(I.title)}</h1><p class="lead">${esc(I.lead)}</p>
    <p class="meta">${total()} ${plural(total(), 'вопрос', 'вопроса', 'вопросов')} · около ${I.min} минут${named ? ` · ${bl.length} ${plural(bl.length, 'раздел', 'раздела', 'разделов')}` : ''}</p>
    ${named ? `<ol class="toc">${bl.map(b => `<li class="${doneIn(b) === b.qs.length ? 'done' : ''}"><span class="toc-e" aria-hidden="true">${b.emo || '•'}</span><span><b>${esc(b.name)}</b>${b.about ? `<small>${esc(b.about)}</small>` : ''}</span><em>${doneIn(b) ? `${doneIn(b)}/${b.qs.length}` : b.qs.length}</em></li>`).join('')}</ol>` : ''}
    ${S.invited ? '<div class="note">👭 Ты пришла по приглашению — мы сохраним, кто тебя позвал.</div>' : ''}
    <button class="go" id="start">${started ? 'Продолжить 🚀' : 'Начать 🚀'}</button>
    ${S.code && !S.invited && !S.talk ? '<button class="link" id="inv">Меня пригласили по этой ссылке 👭</button>' : ''}
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

/* новое интервью по общей ссылке: прежние ответы уже у команды, начинаем с чистого листа */
function freshTalk() { store.del(S.key); init(); }
/* интервью: на своём сервере ответы уходят сразу в карточку; иначе — ссылкой менеджеру, как анкета */
async function renderTalkDone() {
  /* предпросмотр из «Базы вопросов» — ответы никуда не уходят */
  if (S.code === 'DEMO') {
    shell(`<div class="card intro fade"><div class="big">👀</div><h1>Это предпросмотр</h1><p class="lead">Так форму видит человек. Здесь ответы никуда не отправляются — по настоящей ссылке они сразу лягут в карточку.</p>
      <button class="link" id="edit">← К вопросам</button></div>`);
    $('#app').onclick = e => { if (e.target.closest('#edit')) { S.i = total() - 1; render(); } };
    return;
  }
  if (ON_SRV) {
    shell('<div class="card intro fade"><div class="big">⏳</div><h1>Отправляем ответы…</h1></div>');
    let ok = false, why = '';
    try {
      const r = await fetch('/crm/api/talk', {method: 'POST', headers: {'content-type': 'application/json', 'x-eva': '1'}, body: JSON.stringify({c: S.code, t: TYPES[S.type].letter, a: S.a})});
      const j = await r.json().catch(() => ({}));
      ok = r.ok; why = j.error || '';
      /* общая ссылка: сервер завёл карточку — следующие правки ответов пойдут в неё */
      if (ok && j.c && !S.code) S.code = j.c;
    } catch (e) { why = 'Нет связи с интернетом'; }
    if (ok) {
      S.sent = Date.now();
      save();
      shell(`<div class="card intro fade"><div class="big">🎉</div><h1>Спасибо${S.a.name ? ', ' + esc(String(S.a.name).split(' ')[0]) : ''}!</h1><p class="lead">Ответы уже у команды Евы 💜 Каждый из них поможет сделать Еву лучше.</p>
        ${S.general ? '<button class="go alt" id="fresh">Новое интервью ✨</button>' : ''}<button class="link" id="edit">← Поменять ответы</button></div>`);
    } else {
      shell(`<div class="card intro fade"><div class="big">😕</div><h1>Не получилось отправить</h1><p class="lead">${esc(why || 'Попробуй ещё раз через минуту.')} Ответы сохранились в этом браузере.</p>
        <button class="go" id="retry">Отправить ещё раз</button><button class="link" id="edit">← Вернуться к ответам</button></div>`);
    }
    $('#app').onclick = e => {
      if (e.target.closest('#retry')) renderTalkDone();
      if (e.target.closest('#fresh')) freshTalk();
      if (e.target.closest('#edit')) { S.i = total() - 1; render(); }
    };
    return;
  }
  const packed = await Codec.pack({v: 1, t: TYPES[S.type].letter, c: S.code, m: 'talk', ...(S.a.name ? {n: String(S.a.name).slice(0, 80)} : {}), a: S.a, at: Date.now()});
  const link = `${CRM_URL}#in.${packed}`;
  shell(`<div class="card intro fade"><div class="big">🎉</div><h1>Спасибо!</h1><p class="lead">Скопируй ссылку с ответами и отправь менеджеру Евы, который прислал тебе вопросы.</p>
    <button class="go alt" id="copy">📋 Скопировать ссылку с ответами</button><textarea class="linkbox" id="lb" readonly hidden>${esc(link)}</textarea>
    <button class="link" id="edit">← Поменять ответы</button></div>`);
  $('#app').onclick = async e => {
    if (e.target.closest('#copy')) {
      try { await navigator.clipboard.writeText(link); e.target.closest('#copy').textContent = '✅ Скопировано'; }
      catch (err) { const lb = $('#lb'); lb.hidden = false; lb.focus(); lb.select(); }
    }
    if (e.target.closest('#edit')) { S.i = total() - 1; render(); }
  };
}

/* ссылка на вопросы интервью для своей карточки — следующий шаг после анкеты */
const talkUrl = () => `${location.origin}/interview/#${TYPES[S.type].letter}.${S.code}`;
/* поля карточки из ответов: имя, город, Telegram… */
function keyFields() {
  const k = {};
  S.all.forEach(q => { if (q.key && answered(q, S.a[q.id])) k[q.key] = S.a[q.id]; });
  return k;
}
/* что дальше после анкеты: вопросы интервью — созвоном или письменно */
function nextStepHtml() {
  const ty = TYPES[S.type].you === 'ты', talk = S.type === 'client' ? 'интервью' : 'созвона';
  const call = String(S.a.call || '');
  const noCall = /^нет|перепиш/i.test(call);
  return `<div class="next-step"><b>Следующий шаг — ${S.type === 'client' ? 'интервью, около 40 минут' : 'короткий созвон'}</b>
    <span>${noCall ? `${ty ? 'Если созваниваться неудобно, ответь' : 'Если созваниваться неудобно, ответьте'} на вопросы ${talk} письменно — в своём темпе, любой можно пропустить.`
      : `Мы напишем, чтобы договориться о созвоне в Zoom. ${ty ? 'Удобнее письменно? Ответь' : 'Удобнее письменно? Ответьте'} на вопросы ${talk} здесь — в своём темпе.`}</span>
    <a class="go alt" href="${esc(talkUrl())}">Ответить на вопросы ${talk} ✍️</a></div>`;
}
/* анкета отправлена раньше: поменять ответы или перейти к интервью */
function renderSentIntro() {
  const ty = TYPES[S.type].you === 'ты';
  shell(`<div class="card intro fade"><div class="big">💜</div><h1>${S.a.name ? esc(String(S.a.name).split(' ')[0]) + ', о' : 'О'}тветы уже у команды Евы</h1>
    <p class="lead">${ty ? 'Спасибо! Если хочется что-то поменять — исправь и отправь ещё раз, карточка обновится.' : 'Спасибо! Если хотите что-то поменять — исправьте и отправьте ещё раз.'}</p>
    ${S.code ? nextStepHtml() : ''}
    <button class="link" id="start">← Поменять ответы</button></div>`);
  $('#app').onclick = e => { if (e.target.closest('#start')) { S.i = 0; render(); } };
}
async function renderDone() {
  if (S.talk) return renderTalkDone();
  /* ответы на вопросы, которые теперь не показываются (сменили занятость), не отправляем */
  S.all.forEach(q => { if (!q.auto && !qVisible(q, S.a)) delete S.a[q.id]; });
  save();
  const gift = S.type === 'client';
  /* на своём сервере — сразу в карточку; не вышло — запасной путь ссылкой менеджеру */
  let why = '';
  if (ON_SRV) {
    shell('<div class="card intro fade"><div class="big">⏳</div><h1>Отправляем ответы…</h1></div>');
    try {
      const r = await fetch('/crm/api/anketa', {method: 'POST', headers: {'content-type': 'application/json', 'x-eva': '1'},
        body: JSON.stringify({t: TYPES[S.type].letter, c: S.code || '', r: S.invited ? 1 : 0, a: S.a, k: keyFields(), ...(gift ? {g: 1} : {})})});
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.c) {
        S.code = j.c; S.invited = false; S.sent = Date.now();
        save();
        return renderSaved(gift);
      }
      why = j.error || '';
    } catch (e) { why = 'Нет связи с сервером'; }
  }
  const payload = {v: 1, t: TYPES[S.type].letter, c: S.code || '', r: S.invited ? 1 : 0, a: S.a, at: Date.now(), ...(gift ? {g: 1} : {})};
  const packed = await Codec.pack(payload);
  const link = `${CRM_URL}#in.${packed}`;
  const text = gift ? 'Привет! Это мои ответы для Eva 💜 Жду подарок — неделю Евы 🎁' : 'Привет! Это мои ответы для Eva 💜';
  const tg = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
  const wa = `https://wa.me/?text=${encodeURIComponent(text + ' ' + link)}`;
  const own = S.code && !S.invited && ['client', 'amb'].includes(S.type);
  shell(`<div class="card intro fade"><div class="big">🎉</div><h1>Спасибо${S.a.name ? ', ' + esc(String(S.a.name).split(' ')[0]) : ''}!</h1>
    ${why ? `<p class="note">Сразу отправить не получилось (${esc(why)}) — ответы сохранились в этом браузере. Отправь их менеджеру одним нажатием ниже.</p>` : ''}
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

/* ответы уже в CRM: подарок, следующий шаг (вопросы интервью), ссылка для подруги */
function renderSaved(gift) {
  const ty = TYPES[S.type].you === 'ты';
  const own = ['client', 'amb'].includes(S.type);
  const share = `${location.origin}${location.pathname}#${TYPES[S.type].letter}.${S.code}`;
  shell(`<div class="card intro fade"><div class="big">🎉</div><h1>Спасибо${S.a.name ? ', ' + esc(String(S.a.name).split(' ')[0]) : ''}!</h1>
    <p class="lead">${ty ? 'Ответы уже у команды Евы 💜 Каждый из них поможет сделать Еву лучше.' : 'Ответы уже у команды Евы ✨ Спасибо за время.'}</p>
    ${gift ? `<div class="gift"><div class="gift-box" aria-hidden="true">🎁</div><div><b>Неделя Евы — в подарок</b><span>Менеджер Евы напишет тебе и откроет доступ на 7 дней.</span></div></div>` : ''}
    ${nextStepHtml()}
    ${own ? `<div class="note">👭 Подруге — эту же анкету по твоей ссылке: она выберет «Меня пригласили», а мы узнаем, что она от тебя. <button class="link" id="share">Скопировать ссылку</button></div>` : ''}
    <button class="link" id="edit">← Поменять ответы</button></div>`);
  $('#app').onclick = async e => {
    if (e.target.closest('#share')) {
      try { await navigator.clipboard.writeText(share); e.target.closest('#share').textContent = '✅ Скопировано'; }
      catch (err) { e.target.closest('#share').textContent = share; }
    }
    if (e.target.closest('#edit')) { S.i = total() - 1; render(); }
  };
}

window.addEventListener('hashchange', init);
init();
