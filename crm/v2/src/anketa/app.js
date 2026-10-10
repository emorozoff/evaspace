/* Публичная анкета Eva. Ссылка: <анкета>#k.ANNA482 — тип и код человека.
   Один вопрос на экран, варианты — крупные кнопки, один выбор листает
   дальше сам. Ответы помнятся в этом браузере до отправки. В конце —
   «Отправить»: человек пересылает менеджеру ссылку, которая кладёт ответы
   в карточку CRM. Эта же ссылка — реферальная: подруга выберет «Меня
   пригласили», и CRM запишет, кто её привёл. Длинная анкета разбита на
   разделы: на вводном экране — оглавление, над вопросом — раздел и точки
   его вопросов. */

const CRM_URL = 'https://claude.ai/artifact/CRM_URL_PLACEHOLDER';
const $ = (s, r = document) => r.querySelector(s);
const ESC = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* приватное окно */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* ничего */ } },
};
const INTRO = {
  client:  {emo: '🌸', title: 'Привет! Помоги нам сделать Еву лучше 💜', lead: 'Почти всё — кнопками. Здесь нет правильных ответов: нам важен твой честный опыт.', min: 7},
  expert:  {emo: '🎓', title: 'Давайте знакомиться ✨', lead: 'Несколько вопросов о вашем опыте и о том, что можно создать вместе с Евой.', min: 4},
  partner: {emo: '🤝', title: 'Давайте дружить 🤝', lead: 'Расскажите о себе — подберём формат, выгодный обеим сторонам.', min: 3},
  amb:     {emo: '📣', title: 'Стань голосом Евы 💜', lead: 'Расскажи о себе и своей аудитории — придумаем, как тебе удобнее делиться Евой.', min: 3},
};

const S = {type: null, code: '', invited: false, qs: [], i: -1, a: {}, key: '', blocks: []};

function init() {
  const h = Codec.parseAnketaHash(location.hash);
  S.type = h.type;
  S.code = h.code;
  S.qs = h.type ? applyDiff(h.type, h.diff) : [];
  S.blocks = h.type ? groupByBlock(h.type, 'test', S.qs) : [];
  S.qs = S.blocks.flatMap(x => x.qs);   // вопрос, добавленный в раздел позже, идёт внутри своего раздела
  S.key = `eva-anketa:${h.type || ''}:${h.code || 'new'}`;
  const saved = store.get(S.key);
  if (saved && saved.a) { S.a = saved.a; S.invited = !!saved.invited; }
  if (!S.type) return renderChooser();
  S.i = -1;
  render();
}
function save() { store.set(S.key, {a: S.a, invited: S.invited}); }
function total() { return S.qs.length; }
/* в каком разделе вопрос: номер раздела, его вопросы и место внутри */
function where(i) {
  const q = S.qs[i];
  const bi = S.blocks.findIndex(b => b.qs.includes(q));
  const b = S.blocks[bi] || {qs: [q], name: ''};
  return {bi, b, j: b.qs.indexOf(q)};
}

function shell(inner, withTop = true) {
  const inQ = S.i >= 0 && S.i < total();
  const pct = S.i < 0 ? 0 : Math.round((S.i / total()) * 100);
  const w = inQ ? where(S.i) : null;
  const named = w && w.b.name && S.blocks.length > 1;
  $('#app').innerHTML = `${withTop ? `<div class="top"><span class="mark">${brandMark()}</span><span class="brand">Eva Space</span>${inQ ? `<span class="count">${S.i + 1} из ${total()}</span>` : ''}</div>
    ${inQ ? `<div class="bar"><i style="width:${pct}%"></i></div>` : ''}
    ${named ? `<div class="sect"><span class="sect-e" aria-hidden="true">${w.b.emo || '•'}</span><b>${esc(w.b.name)}</b><span>раздел ${w.bi + 1} из ${S.blocks.length}</span>
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
    S.qs = applyDiff(S.type, null);
    S.blocks = groupByBlock(S.type, 'test', S.qs);
    S.qs = S.blocks.flatMap(x => x.qs);
    S.key = `eva-anketa:${S.type}:new`;
    const saved = store.get(S.key);
    S.a = saved && saved.a ? saved.a : {};
    S.i = -1;
    render();
  };
}

/* «Другое» хранится как «Другое: свой ответ» */
const isOther = (q, v) => !!q.other && (v === q.other || String(v || '').startsWith(q.other + OTHER_SEP));
const withOther = (q, text) => (text ? `${q.other}${OTHER_SEP}${text}` : q.other);
const canSkip = q => q.k === 'many' || q.k === 'date' || q.opt || (q.k === 'short' && q.key !== 'name') || q.k === 'text';

function render() {
  if (S.i < 0) return renderIntro();
  if (S.i >= total()) return renderDone();
  const q = S.qs[S.i];
  const v = S.a[q.id];
  let ctl = '';
  if (q.k === 'one' || q.k === 'many') {
    const sel = q.k === 'one' ? [v] : (v || []);
    const otherOn = sel.some(x => isOther(q, x));
    const otherVal = otherOn ? otherText(q, sel.find(x => isOther(q, x))) : '';
    const opts = [...q.o, ...(q.other ? [q.other] : [])];
    ctl = `<div class="opts ${opts.length > 6 && opts.every(o => o.length < 22) ? 'two' : ''}">${opts.map((o, j) => {
      const on = j < q.o.length ? sel.includes(o) : otherOn;
      return `<button class="opt ${on ? 'on' : ''}" data-o="${j}"><span>${esc(o)}</span>${q.k === 'many' ? `<span class="tick">${on ? '✓' : ''}</span>` : ''}</button>`;
    }).join('')}</div>
      ${q.other ? `<input class="inp other-inp" id="oth" value="${esc(otherVal)}" placeholder="Напиши свой вариант" maxlength="120" ${otherOn ? '' : 'hidden'}>` : ''}
      ${q.k === 'many' ? `<p class="hint">${q.max ? `Можно выбрать до ${q.max}` : 'Можно выбрать несколько'}</p>` : ''}`;
  } else if (q.k === 'scale') {
    const n = scaleN(q);
    ctl = n === 5
      ? `<div class="scale">${SCALE_EMO.map((e, j) => `<button class="${Number(v) === j + 1 ? 'on' : ''}" data-s="${j + 1}" aria-label="${j + 1} из 5">${e}<small>${j + 1}</small></button>`).join('')}</div>`
      : `<div class="scale10">${Array.from({length: n}, (_, j) => `<button class="${Number(v) === j + 1 ? 'on' : ''} ${v && j + 1 <= Number(v) ? 'fill' : ''}" data-s="${j + 1}" aria-label="${j + 1} из ${n}">${j + 1}</button>`).join('')}</div>`;
    ctl += `<div class="scale-ends"><span>1 — ${esc(q.lo || '')}</span><span>${n} — ${esc(q.hi || '')}</span></div>`;
  } else if (q.k === 'date') {
    const y = new Date().getFullYear();
    ctl = `<input class="inp" id="inp" type="date" value="${esc(v || '')}" min="${y - 90}-01-01" max="${y - 12}-12-31">`;
  } else if (q.k === 'text') {
    ctl = `<textarea class="inp" id="inp" placeholder="${esc(q.ph || 'Напишите, как есть')}">${esc(v || '')}</textarea>`;
  } else {
    ctl = `<input class="inp" id="inp" value="${esc(v || '')}" placeholder="${esc(q.ph || '')}" ${q.key === 'tg' ? 'autocomplete="tel"' : q.key === 'name' ? 'autocomplete="given-name"' : ''}>`;
  }
  const otherSel = q.other && (q.k === 'one' ? isOther(q, v) : (v || []).some(x => isOther(q, x)));
  const needNext = !['one', 'scale'].includes(q.k) || otherSel;
  const last = S.i === total() - 1;
  shell(`<div class="card fade"><h2>${esc(q.t)}</h2>${q.hint ? `<p class="hint">${esc(q.hint)}</p>` : ''}${ctl}
    ${needNext ? `<button class="go" id="next">${last ? 'Готово 🎉' : 'Дальше →'}</button>` : ''}
    <div class="nav"><button class="link" id="back">← Назад</button>${canSkip(q) ? '<button class="link" id="skip">Пропустить</button>' : '<span></span>'}</div></div>`);
  const inp = $('#inp'), oth = $('#oth');
  if (inp && q.k !== 'date') { inp.focus(); inp.addEventListener('keydown', e => { if (e.key === 'Enter' && (q.k === 'short' || e.ctrlKey || e.metaKey)) { e.preventDefault(); next(); } }); }
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
      if (q.k === 'one') {
        S.a[q.id] = label;
        save();
        render();
        if (!isOth) setTimeout(() => { S.i++; render(); }, 220);
        return;
      }
      const cur = (S.a[q.id] || []).slice();
      const at = cur.findIndex(x => (isOth ? isOther(q, x) : x === label));
      if (at >= 0) cur.splice(at, 1);
      else { if (q.max && cur.length >= q.max) { flash(`Можно выбрать до ${q.max}`); return; } cur.push(label); }
      S.a[q.id] = cur;
      save();
      render();
      return;
    }
    if (s) { S.a[q.id] = Number(s.dataset.s); save(); render(); setTimeout(() => { S.i++; render(); }, 240); return; }
    if (e.target.closest('#next')) next();
    if (e.target.closest('#back')) { S.i--; render(); }
    if (e.target.closest('#skip')) { delete S.a[q.id]; save(); S.i++; render(); }
  };
  function next() {
    if (inp) {
      const val = inp.value.trim();
      if (!val && q.key === 'name') { inp.focus(); flash('Как к вам обращаться? 🙂'); return; }
      if (val) S.a[q.id] = val.slice(0, q.k === 'text' ? 600 : 160); else delete S.a[q.id];
      save();
    }
    if (q.k === 'many' && !(S.a[q.id] || []).length) delete S.a[q.id];
    S.i++;
    render();
  }
}
function flash(text) {
  let el = $('#flash');
  if (!el) { el = document.createElement('p'); el.id = 'flash'; el.className = 'note'; $('.card').appendChild(el); }
  el.textContent = text;
}

function renderIntro() {
  const I = INTRO[S.type];
  const started = Object.keys(S.a).length;
  const named = S.blocks.length > 1 && S.blocks[0].name;
  const doneIn = b => b.qs.filter(q => S.a[q.id] !== undefined).length;
  shell(`<div class="card intro fade"><div class="big">${I.emo}</div><h1>${esc(I.title)}</h1><p class="lead">${esc(I.lead)}</p>
    <p class="meta">${total()} ${plural(total(), 'вопрос', 'вопроса', 'вопросов')} · около ${I.min} минут${named ? ` · ${S.blocks.length} ${plural(S.blocks.length, 'раздел', 'раздела', 'разделов')}` : ''}</p>
    ${named ? `<ol class="toc">${S.blocks.map(b => `<li class="${doneIn(b) === b.qs.length ? 'done' : ''}"><span class="toc-e" aria-hidden="true">${b.emo || '•'}</span><span><b>${esc(b.name)}</b>${b.about ? `<small>${esc(b.about)}</small>` : ''}</span><em>${doneIn(b) ? `${doneIn(b)}/${b.qs.length}` : b.qs.length}</em></li>`).join('')}</ol>` : ''}
    ${S.invited ? '<div class="note">👭 Вы пришли по приглашению — мы сохраним, кто вас позвал.</div>' : ''}
    <button class="go" id="start">${started ? 'Продолжить 🚀' : 'Начать 🚀'}</button>
    ${S.code && !S.invited ? '<button class="link" id="inv">Меня пригласили по этой ссылке 👭</button>' : ''}
    <p class="small">Нажимая «Начать», вы соглашаетесь, что команда Eva Space увидит ваши ответы и сможет связаться с вами. Ответы нужны, чтобы сделать продукт лучше, и никуда не публикуются.</p></div>`);
  $('#app').onclick = e => {
    if (e.target.closest('#start')) { const k = S.qs.findIndex(q => S.a[q.id] === undefined); S.i = started && k >= 0 ? k : 0; render(); }
    if (e.target.closest('#inv')) { S.invited = true; S.a = {}; S.key += ':inv'; save(); render(); }
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
  const payload = {v: 1, t: TYPES[S.type].letter, c: S.code || '', r: S.invited ? 1 : 0, a: S.a, at: Date.now()};
  const packed = await Codec.pack(payload);
  const link = `${CRM_URL}#in.${packed}`;
  const text = `Привет! Это мои ответы для Eva 💜`;
  const tg = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
  const wa = `https://wa.me/?text=${encodeURIComponent(text + ' ' + link)}`;
  const own = S.code && !S.invited && ['client', 'amb'].includes(S.type);
  shell(`<div class="card intro fade"><div class="big">🎉</div><h1>Спасибо${S.a.name ? ', ' + esc(String(S.a.name).split(' ')[0]) : ''}!</h1>
    <p class="lead">Остался один шаг: отправьте ответы менеджеру Евы, который прислал вам ссылку. Одно нажатие — и выберите чат с ним.</p>
    <div class="send" style="width:100%"><a class="tg" href="${esc(tg)}" target="_blank" rel="noopener">✈️ Отправить в Telegram</a><a class="wa" href="${esc(wa)}" target="_blank" rel="noopener">💬 Отправить в WhatsApp</a>
      <button class="go alt" id="copy">📋 Скопировать ссылку с ответами</button></div>
    <textarea class="linkbox" id="lb" readonly hidden>${esc(link)}</textarea>
    ${own ? `<div class="note">👭 Эту же страницу можно переслать подруге: она выберет «Меня пригласили», а мы узнаем, что она от тебя.</div>` : ''}
    <button class="link" id="edit">← Поменять ответы</button></div>`);
  $('#app').onclick = async e => {
    if (e.target.closest('#copy')) {
      const lb = $('#lb');
      try { await navigator.clipboard.writeText(link); e.target.closest('#copy').textContent = '✅ Скопировано — вставьте в чат с менеджером'; }
      catch (err) { lb.hidden = false; lb.focus(); lb.select(); }
    }
    if (e.target.closest('#edit')) { S.i = total() - 1; render(); }
  };
}

window.addEventListener('hashchange', init);
init();
