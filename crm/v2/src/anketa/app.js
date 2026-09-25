/* Публичная анкета Eva. Ссылка: <анкета>#k.ANNA482 — тип и код человека.
   Один вопрос на экран, варианты — крупные кнопки, один выбор листает
   дальше сам. Ответы помнятся в этом браузере до отправки. В конце —
   «Отправить»: человек пересылает менеджеру ссылку, которая кладёт ответы
   в карточку CRM. Эта же ссылка — реферальная: подруга выберет «Меня
   пригласили», и CRM запишет, кто её привёл. */

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
  client:  {emo: '🌸', title: 'Привет! Помоги нам сделать Еву лучше 💜', lead: 'Пара минут и почти только кнопки. Здесь нет правильных ответов — нам важен твой честный опыт.'},
  expert:  {emo: '🎓', title: 'Давайте знакомиться ✨', lead: 'Несколько вопросов о вашем опыте и о том, что можно создать вместе с Евой. 3–4 минуты.'},
  partner: {emo: '🤝', title: 'Давайте дружить 🤝', lead: 'Расскажите о себе — подберём формат, выгодный обеим сторонам. 3 минуты.'},
  amb:     {emo: '📣', title: 'Стань голосом Евы 💜', lead: 'Расскажи о себе и своей аудитории — придумаем, как тебе удобнее делиться Евой. 3 минуты.'},
};

const S = {type: null, code: '', invited: false, qs: [], i: -1, a: {}, key: ''};

function init() {
  const h = Codec.parseAnketaHash(location.hash);
  S.type = h.type;
  S.code = h.code;
  S.qs = h.type ? applyDiff(h.type, h.diff) : [];
  S.key = `eva-anketa:${h.type || ''}:${h.code || 'new'}`;
  const saved = store.get(S.key);
  if (saved && saved.a) { S.a = saved.a; S.invited = !!saved.invited; }
  if (!S.type) return renderChooser();
  S.i = -1;
  render();
}
function save() { store.set(S.key, {a: S.a, invited: S.invited}); }
function total() { return S.qs.length; }

function shell(inner, withTop = true) {
  const pct = S.i < 0 ? 0 : Math.round(((S.i) / total()) * 100);
  $('#app').innerHTML = `${withTop ? `<div class="top"><span class="mark">✦</span><span class="brand">Eva</span>${S.i >= 0 && S.i < total() ? `<span class="count">${S.i + 1} из ${total()}</span>` : ''}</div>
    ${S.i >= 0 && S.i < total() ? `<div class="bar"><i style="width:${pct}%"></i></div>` : ''}` : ''}${inner}`;
}

function renderChooser() {
  S.i = -1;
  shell(`<div class="card intro fade"><div class="big">✦</div><h1>Кто вы?</h1><p class="lead">Выберите — и покажем вопросы для вас</p>
    <div class="types">${Object.entries(TYPES).map(([k, t]) => `<button data-t="${k}"><span>${t.emo}</span>${t.one}</button>`).join('')}</div></div>`);
  $('#app').onclick = e => {
    const b = e.target.closest('[data-t]');
    if (!b) return;
    S.type = b.dataset.t;
    S.qs = applyDiff(S.type, null);
    S.key = `eva-anketa:${S.type}:new`;
    const saved = store.get(S.key);
    S.a = saved && saved.a ? saved.a : {};
    S.i = -1;
    render();
  };
}

function render() {
  if (S.i < 0) return renderIntro();
  if (S.i >= total()) return renderDone();
  const q = S.qs[S.i];
  const v = S.a[q.id];
  let ctl = '';
  if (q.k === 'one' || q.k === 'many') {
    const sel = q.k === 'one' ? [v] : (v || []);
    ctl = `<div class="opts">${q.o.map((o, j) => `<button class="opt ${sel.includes(o) ? 'on' : ''}" data-o="${j}"><span>${esc(o)}</span>${q.k === 'many' ? `<span class="tick">${sel.includes(o) ? '✓' : ''}</span>` : ''}</button>`).join('')}</div>
      ${q.k === 'many' ? `<p class="hint">${q.max ? `Можно выбрать до ${q.max}` : 'Можно выбрать несколько'}</p>` : ''}`;
  } else if (q.k === 'scale') {
    ctl = `<div class="scale">${SCALE_EMO.map((e, j) => `<button class="${Number(v) === j + 1 ? 'on' : ''}" data-s="${j + 1}" aria-label="${j + 1} из 5">${e}<small>${j + 1}</small></button>`).join('')}</div>
      <div class="scale-ends"><span>${esc(q.lo || '')}</span><span>${esc(q.hi || '')}</span></div>`;
  } else if (q.k === 'text') {
    ctl = `<textarea class="inp" id="inp" placeholder="${esc(q.ph || 'Напишите, как есть')}">${esc(v || '')}</textarea>`;
  } else {
    ctl = `<input class="inp" id="inp" value="${esc(v || '')}" placeholder="${esc(q.ph || '')}" ${q.key === 'tg' ? 'autocomplete="tel"' : q.key === 'name' ? 'autocomplete="given-name"' : ''}>`;
  }
  const needNext = q.k !== 'one' && q.k !== 'scale';
  const optional = q.k === 'short' && q.key !== 'name';
  shell(`<div class="card fade"><h2>${esc(q.t)}</h2>${ctl}
    ${needNext ? `<button class="go" id="next">${S.i === total() - 1 ? 'Готово 🎉' : 'Дальше →'}</button>` : ''}
    <div class="nav"><button class="link" id="back">← Назад</button>${optional || q.k === 'many' ? '<button class="link" id="skip">Пропустить</button>' : '<span></span>'}</div></div>`);
  const inp = $('#inp');
  if (inp) { inp.focus(); inp.addEventListener('keydown', e => { if (e.key === 'Enter' && (q.k === 'short' || e.ctrlKey || e.metaKey)) { e.preventDefault(); next(); } }); }
  $('#app').onclick = e => {
    const o = e.target.closest('[data-o]');
    const s = e.target.closest('[data-s]');
    if (o) {
      const label = q.o[Number(o.dataset.o)];
      if (q.k === 'one') { S.a[q.id] = label; save(); render(); setTimeout(() => { S.i++; render(); }, 220); return; }
      const cur = new Set(S.a[q.id] || []);
      if (cur.has(label)) cur.delete(label);
      else { if (q.max && cur.size >= q.max) { flash(`Можно выбрать до ${q.max}`); return; } cur.add(label); }
      S.a[q.id] = [...cur];
      save();
      render();
      return;
    }
    if (s) { S.a[q.id] = Number(s.dataset.s); save(); render(); setTimeout(() => { S.i++; render(); }, 220); return; }
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
  shell(`<div class="card intro fade"><div class="big">${I.emo}</div><h1>${esc(I.title)}</h1><p class="lead">${esc(I.lead)}</p>
    ${S.invited ? '<div class="note">👭 Вы пришли по приглашению — мы сохраним, кто вас позвал.</div>' : ''}
    <button class="go" id="start">${started ? 'Продолжить 🚀' : 'Начать 🚀'}</button>
    ${S.code && !S.invited ? '<button class="link" id="inv">Меня пригласили по этой ссылке 👭</button>' : ''}
    <p class="small">Нажимая «Начать», вы соглашаетесь, что команда Eva Space увидит ваши ответы и сможет связаться с вами. Ответы нужны, чтобы сделать продукт лучше, и никуда не публикуются.</p></div>`);
  $('#app').onclick = e => {
    if (e.target.closest('#start')) { S.i = started ? Math.min(total() - 1, S.qs.findIndex(q => S.a[q.id] === undefined) >= 0 ? S.qs.findIndex(q => S.a[q.id] === undefined) : 0) : 0; render(); }
    if (e.target.closest('#inv')) { S.invited = true; S.a = {}; S.key += ':inv'; save(); render(); }
  };
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
