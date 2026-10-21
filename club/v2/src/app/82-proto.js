/* Протоколы собраний: архив с поиском, уровни доступа и подтверждение «Ок».
   Уровень 1 — основатели (роли основатель, руководитель, финансы),
   2 — основатели и инвесторы, 3 — все участники. Кто какой уровень видит,
   решает сервер (hq-rules.js). Протокол заводят основатели: текст (вставить
   из Зума или документа), ссылка на запись, файл. Участники, от которых ждём
   подтверждения, получают уведомление со звуком и нажимают «Ок».
   Поменяли текст — подтверждения сбрасываются: «Ок» относится к тексту.
   Пока Зум не подключён к серверу, ссылки и текст вносятся вручную. */

const PROTO_LEVELS = {
  1: {name: 'Уровень 1 · основатели', short: 'Основатели', tone: 'rose', roles: ['owner', 'lead', 'finance']},
  2: {name: 'Уровень 2 · основатели и инвесторы', short: 'Основатели и инвесторы', tone: 'violet', roles: ['owner', 'lead', 'finance', 'investor']},
  3: {name: 'Уровень 3 · все участники', short: 'Все участники', tone: 'good', roles: ['owner', 'lead', 'finance', 'member', 'investor']},
};
const PROTO_FILE_MAX = 3 * 1024 * 1024;   // файл протокола — до 3 МБ (хранится в базе штаба)
const protoLevel = x => (PROTO_LEVELS[Number(x && x.level)] ? Number(x.level) : 1);
const protoLevelPill = lv => `<span class="pill ${PROTO_LEVELS[lv].tone}" title="${esc(PROTO_LEVELS[lv].name)}">ур. ${lv} · ${esc(PROTO_LEVELS[lv].short)}</span>`;
const protoCanEdit = () => Auth.can('proto.edit');
/* кто может быть на уровне: учётки с подходящей ролью; ключ — карточка человека или учётка */
const protoKey = a => a.personId || a.id;
function protoPeople(level) {
  const roles = PROTO_LEVELS[level].roles;
  return Store.all('accounts').filter(a => a.active !== false && a.name && roles.includes(roleOf(a.role)))
    .map(a => ({key: protoKey(a), name: whoName(protoKey(a)), role: roleOf(a.role)}))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}
const Proto = {
  all() { return Store.all('protocols').filter(p => p.title).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.at || 0) - (a.at || 0))); },
  ok(p) { return p.ok || {}; },
  waiting(p) { const ok = this.ok(p); return (p.people || []).filter(k => !ok[k]); },
  needsMe(p) { const me = Tasks.meKey(); return (p.people || []).includes(me) && !this.ok(p)[me]; },
  badge() { return Auth.me() ? this.all().filter(p => this.needsMe(p)).length : 0; },
  byMeeting(mid) { return mid ? this.all().find(p => p.meetingId === mid) || null : null; },
  approve(p) {
    const me = Tasks.meKey();
    Store.patch('protocols', p.id, {ok: {[me]: Date.now()}}, {mustExist: true});
    toast('Спасибо, ваше «Ок» записано');
  },
};

/* ── страница ── */
App.register('protocols', {
  title: 'Протоколы',
  render(root) {
    const q = View.get('pr.q', ''), lvF = View.get('pr.lv', 'all'), mine = View.get('pr.mine', false);
    const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е');
    const words = norm(q).split(/\s+/).filter(Boolean);
    const all = Proto.all();
    const list = all.filter(p => (lvF === 'all' || String(protoLevel(p)) === lvF) && (!mine || Proto.needsMe(p))
      && words.every(w => norm(`${p.title} ${p.text || ''} ${dayLong(p.date)} ${(p.people || []).map(whoName).join(' ')}`).includes(w)));
    const wait = all.filter(p => Proto.needsMe(p)).length;
    const snippet = p => {
      const txt = String(p.text || '').replace(/\s+/g, ' ').trim();
      if (!words.length) return esc(txt.slice(0, 180));
      const i = norm(txt).indexOf(words[0]);
      const part = i < 0 ? txt.slice(0, 180) : (i > 60 ? '…' : '') + txt.slice(Math.max(0, i - 60), i + 140);
      return esc(part).replace(new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi'), '<mark>$1</mark>');
    };
    root.innerHTML = `
      ${pageHead('Протоколы', 'Протоколы собраний: поиск по тексту, ссылки на запись и подтверждение «Ок» от участников.', protoCanEdit() ? `<button class="btn primary sm" id="prNew">${icon('plus')}Протокол</button>` : '')}
      ${helpBox('protocols', `<b>Как работают протоколы.</b> Протокол заводят основатели: вставляют текст (из Зума или документа), ссылку на запись и, если нужно, файл. Уровень решает, кто его видит: 1 — основатели, 2 — основатели и инвесторы, 3 — все участники. Те, от кого ждём подтверждения, получают уведомление со звуком и нажимают «Ок». Если текст потом поменяли, подтверждения сбрасываются. Протокол можно скачать в PDF. Протокол к собранию удобно открывать прямо из календаря — кнопка «Протокол» у собрания.`)}
      <div class="pr-tools">
        <input class="input" id="prQ" type="search" placeholder="Поиск: слово из текста, название, дата или участник" value="${esc(q)}" aria-label="Поиск по протоколам">
        <div class="seg">${[['all', 'Все'], ['1', 'Ур. 1'], ['2', 'Ур. 2'], ['3', 'Ур. 3']].map(([k, n]) => `<button type="button" data-prlv="${k}" class="${lvF === k ? 'on' : ''}">${n}</button>`).join('')}</div>
        <label class="check"><input type="checkbox" id="prMine" ${mine ? 'checked' : ''}> Ждут моего «Ок»${wait ? ` <span class="pill bad">${wait}</span>` : ''}</label>
      </div>
      ${list.length ? `<div class="pr-list">${list.map(p => {
        const ok = Proto.ok(p), ppl = p.people || [], done = ppl.filter(k => ok[k]).length;
        return `<button class="card pr-row ${Proto.needsMe(p) ? 'need' : ''}" data-proto="${p.id}">
          <span class="pr-date"><b>${dayShort(p.date)}</b><small>${p.date ? p.date.slice(0, 4) : ''}</small></span>
          <span class="pr-main"><b>${esc(p.title)}</b><small>${snippet(p)}</small></span>
          <span class="pr-meta">${protoLevelPill(protoLevel(p))}
            ${ppl.length ? `<span class="pill ${done === ppl.length ? 'good' : 'warn'}">Ок: ${done} из ${ppl.length}</span>` : ''}
            ${Proto.needsMe(p) ? '<span class="pill bad">ждём вашего «Ок»</span>' : ''}
            ${p.recUrl ? `<span class="pill line">${icon('video')}запись</span>` : ''}</span>
        </button>`;
      }).join('')}</div>`
        : `<div class="empty"><b>${all.length ? 'Ничего не нашлось' : 'Протоколов пока нет'}</b>${all.length ? 'Попробуйте другое слово или снимите фильтр.' : protoCanEdit() ? 'Нажмите «Протокол», чтобы добавить первый, или откройте собрание в календаре.' : 'Здесь появятся протоколы собраний.'}</div>`}`;
    wireHelp(root);
    const qi = $('#prQ', root);
    let t = null;
    qi.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { View.set('pr.q', qi.value); App.render({focus: 'prQ'}); }, 300); });
    on(root, 'click', '[data-prlv]', (e, el) => { View.set('pr.lv', el.dataset.prlv); App.render(); });
    $('#prMine', root).onchange = e => { View.set('pr.mine', e.target.checked); App.render(); };
    on(root, 'click', '[data-proto]', (e, el) => openProto(el.dataset.proto));
    const nb = $('#prNew', root);
    if (nb) nb.onclick = () => editProto(null);
  },
});

/* текст протокола: абзацы и списки как есть, строки «1.» и «•» — пунктами */
function protoTextHtml(text) {
  return String(text || '').split(/\n{2,}/).map(par => `<p>${esc(par).replace(/\n/g, '<br>')}</p>`).join('');
}
function protoFileOpen(p) {
  const f = p.file;
  if (!f || !f.data) return;
  try {
    const bin = atob(String(f.data).split(',')[1] || ''), arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([arr], {type: f.type || 'application/octet-stream'}));
    const a = document.createElement('a');
    a.href = url;
    if (f.type === 'application/pdf') a.target = '_blank'; else a.download = f.name || 'protocol';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 60000);
  } catch (e) { toast('Файл не открылся', {error: true}); }
}
/* PDF — через печать браузера: «Сохранить как PDF» */
function protoPdf(p) {
  const w = window.open('', '_blank');
  if (!w) { toast('Браузер не дал открыть окно печати — разрешите всплывающие окна'); return; }
  /* PDF — в том виде, который выбран у человека */
  w.document.write(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${esc(p.title)} — ${esc(dayLong(p.date))}</title>
    <link rel="stylesheet" href="${PT_FONTS}"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Unbounded:wght@500;600&family=Inter:wght@400;600&display=swap">
    <style>${PT_CSS} body{margin:0; padding:24px; background:#fff; -webkit-print-color-adjust:exact; print-color-adjust:exact;} .pt{max-width:820px; margin:0 auto;}</style></head><body>
    ${ptDoc(p, ptPick(p))}
    <script>(document.fonts ? document.fonts.ready : Promise.resolve()).then(function(){setTimeout(function(){window.print()},400)})<\/script></body></html>`);
  w.document.close();
}
function openProto(id) {
  const p = Store.get('protocols', id);
  if (!p) return;
  const ok = Proto.ok(p), lv = protoLevel(p);
  const meet = p.meetingId ? Store.get('meetings', p.meetingId) : null;
  openModal({
    title: p.title,
    wide: true,
    body: `<div class="pr-view">
        <p class="pr-sub">${esc(dayLong(p.date))} ${p.date ? p.date.slice(0, 4) : ''} · ${protoLevelPill(lv)}${meet ? ` · собрание «${esc(meet.title)}»` : ''}</p>
        <div class="row pr-links">${p.recUrl && safeUrl(p.recUrl) ? `<a class="btn sm" href="${esc(safeUrl(p.recUrl))}" target="_blank" rel="noopener">${icon('video')}Запись встречи</a>` : ''}
          ${p.file && p.file.data ? `<button type="button" class="btn sm" id="prFile">${icon('download')}${esc(p.file.name || 'Файл протокола')}</button>` : ''}
          <button type="button" class="btn sm ghost" id="prPdf">${icon('download')}Скачать PDF</button></div>
        <div class="pt-bar"><span class="label">Вид протокола</span>${ptSwitch(p)}</div>
        <div id="prDoc" class="pt-wrap">${ptDoc(p, ptPick(p))}</div>
        ${p.zoomText ? `<details class="pr-zoom"><summary>Версия протокола от Зума</summary><div class="pr-text">${protoTextHtml(p.zoomText)}</div></details>` : ''}
        ${logHtml(p)}
      </div>`,
    foot: `${protoCanEdit() ? `<button class="btn left" id="prEdit">${icon('edit')}Изменить</button>` : ''}<button class="btn" data-close>Закрыть</button>${Proto.needsMe(p) ? `<button class="btn primary" id="prOk">${icon('tick')}Ок, согласен(на)</button>` : ''}`,
    onMount(el, close) {
      $('#prPdf', el).onclick = () => protoPdf(p);
      ptFonts(); ptStyle();
      /* вид протокола: свой у каждого, помнится в учётке */
      on(el, 'click', '[data-pt]', (e, b) => {
        Prefs.set('proto.theme', b.dataset.pt);
        $$('[data-pt]', el).forEach(x => x.classList.toggle('on', x === b));
        $('#prDoc', el).innerHTML = ptDoc(p, ptPick(p));
      });
      const f = $('#prFile', el);
      if (f) f.onclick = () => protoFileOpen(p);
      const okB = $('#prOk', el);
      if (okB) okB.onclick = () => { Proto.approve(p); close(); };
      const ed = $('#prEdit', el);
      if (ed) ed.onclick = () => { close(); editProto(p.id); };
    },
  });
}
/* новый протокол или правка; preset — из собрания календаря */
function editProto(id, preset = {}) {
  if (!protoCanEdit()) return;
  const p = id ? Store.get('protocols', id) : null;
  const v = p ? clone(p) : {title: '', date: today(), level: 1, people: null, recUrl: '', text: '', file: null, meetingId: null, ...preset};
  let file = v.file || null;
  const lv0 = protoLevel(v);
  const chips = lv => {
    const ppl = protoPeople(lv), sel = v.people ? v.people : ppl.map(x => x.key);
    return ppl.map(x => `<button type="button" class="chip ${sel.includes(x.key) ? 'on' : ''}" data-prp="${esc(x.key)}">${esc(x.name)} <small class="note">${esc(ROLES[x.role].name)}</small></button>`).join('') || '<span class="note">На этом уровне пока нет учёток.</span>';
  };
  openModal({
    title: p ? 'Протокол' : 'Новый протокол',
    wide: true,
    body: `<div class="grid3">
        <label class="field fin-span2"><span>Название</span><input class="input" id="prT" maxlength="160" value="${esc(v.title)}" placeholder="Еженедельное собрание Eva Club"></label>
        <label class="field"><span>Дата</span><input class="input" type="date" id="prD" value="${esc(v.date || today())}"></label>
      </div>
      <div class="field"><span>Кто видит</span><div class="seg" id="prLv">${Object.entries(PROTO_LEVELS).map(([k, x]) => `<button type="button" data-lv="${k}" class="${Number(k) === lv0 ? 'on' : ''}">${esc(x.name)}</button>`).join('')}</div></div>
      <div class="field"><span>От кого ждём «Ок»</span><div class="chips" id="prPpl">${chips(lv0)}</div></div>
      <label class="field"><span>Ссылка на запись встречи</span><input class="input" id="prRec" value="${esc(v.recUrl || '')}" placeholder="https://… (облако Зума или диск)"></label>
      <label class="field"><span>Текст протокола</span><textarea class="textarea" id="prText" rows="16" placeholder="Вставьте текст протокола: повестка, решения, следующие шаги и ответственные">${esc(v.text || '')}</textarea>
        ${p && Object.keys(Proto.ok(p)).length ? '<small>Если поменять текст, подтверждения «Ок» сбросятся и участники получат протокол заново.</small>' : ''}</label>
      <div class="field"><span>Файл протокола <small class="note">PDF или документ, до 3 МБ</small></span>
        <div class="row"><span id="prFName" class="note">${file ? esc(file.name) : 'файла нет'}</span>
          <label class="btn xs">${icon('plus')}Выбрать файл<input type="file" id="prF" hidden accept=".pdf,.doc,.docx,.pages,.txt,.rtf,application/pdf"></label>
          <button type="button" class="btn xs ghost" id="prFDel" ${file ? '' : 'hidden'}>Убрать</button></div></div>`,
    foot: `${p ? `<button class="btn danger left" id="prDel">${icon('trash')}Удалить</button>` : ''}<button class="btn" data-close>Отмена</button><button class="btn primary" id="prSave">${p ? 'Сохранить' : 'Создать и разослать'}</button>`,
    onMount(el, close) {
      const lvNow = () => Number(($('#prLv .on', el) || {}).dataset?.lv || lv0);
      on(el, 'click', '[data-lv]', (e, b) => {
        $$('[data-lv]', el).forEach(x => x.classList.toggle('on', x === b));
        v.people = null;   // сменили уровень — по умолчанию все его участники
        $('#prPpl', el).innerHTML = chips(lvNow());
      });
      on(el, 'click', '[data-prp]', (e, b) => b.classList.toggle('on'));
      $('#prF', el).onchange = e => {
        const f = e.target.files[0];
        if (!f) return;
        if (f.size > PROTO_FILE_MAX) { toast('Файл больше 3 МБ — сохраните его в облаке и вставьте ссылку в текст'); e.target.value = ''; return; }
        const r = new FileReader();
        r.onload = () => { file = {name: f.name.slice(0, 120), type: f.type || '', size: f.size, data: r.result}; $('#prFName', el).textContent = f.name; $('#prFDel', el).hidden = false; };
        r.readAsDataURL(f);
      };
      $('#prFDel', el).onclick = () => { file = null; $('#prFName', el).textContent = 'файла нет'; $('#prFDel', el).hidden = true; };
      $('#prSave', el).onclick = () => {
        const title = $('#prT', el).value.trim();
        if (!title) { $('#prT', el).focus(); toast('Назовите протокол'); return; }
        const rec = $('#prRec', el).value.trim();
        if (rec && !safeUrl(rec)) { $('#prRec', el).focus(); toast('Ссылка на запись должна начинаться с https://'); return; }
        const text = $('#prText', el).value.replace(/\s+$/, '');
        const people = $$('[data-prp].on', el).map(b => b.dataset.prp);
        const data = {title, date: $('#prD', el).value || today(), level: lvNow(), people, recUrl: rec, text, file: file || null, upd: Date.now()};
        const me = Tasks.meKey();
        if (p) {
          const changed = text !== (p.text || '') || (file && p.file ? file.data !== p.file.data : !!file !== !!p.file);
          const hadOk = Object.keys(Proto.ok(p)).length;
          /* «Ок» относится к тексту: поменяли текст или файл — подтверждаем заново */
          Store.put('protocols', p.id, {...p, ...data, ok: changed ? {} : Proto.ok(p), log: {...(p.log || {}), ...finLog(changed ? `изменил(а) текст${hadOk ? ', подтверждения сброшены' : ''}` : 'обновил(а) протокол')}});
          toast(changed && hadOk ? 'Протокол сохранён, участники подтвердят его заново' : 'Протокол сохранён');
        } else {
          Store.add('protocols', {...data, meetingId: v.meetingId || null, ok: {}, by: me, at: Date.now(), log: finLog('создал(а) протокол')});
          toast(people.length ? `Протокол разослан: ждём «Ок» от ${people.length} ${plural(people.length, 'человека', 'человек', 'человек')}` : 'Протокол сохранён');
        }
        close();
      };
      const del = $('#prDel', el);
      if (del) del.onclick = async () => {
        if (!(await confirmPop(del, {text: 'Удалить протокол насовсем?', yes: 'Удалить', danger: true}))) return;
        Store.remove('protocols', p.id);
        close();
      };
    },
  });
}
/* из собрания календаря: открыть его протокол или завести новый */
function protoForMeeting(mid) {
  const ex = Proto.byMeeting(mid);
  if (ex) return openProto(ex.id);
  const m = Store.get('meetings', mid);
  if (!m) return;
  if (!protoCanEdit()) { toast('Протокола к этому собранию пока нет'); return; }
  const lv = protoLevel(m.level ? m : {level: 3});
  const inMeet = new Set(Meetings.people(m));
  const keys = protoPeople(lv).map(x => x.key).filter(k => inMeet.has(k));
  editProto(null, {title: m.title, date: m.date, level: lv, people: keys.length ? keys : null, meetingId: m.id, recUrl: m.recUrl || '',
    text: m.agenda ? `Повестка:\n${m.agenda}\n\nРешения:\n` : ''});
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-proto-meet]');
  if (!b) return;
  e.preventDefault(); e.stopPropagation();
  /* из окна собрания — сначала закрыть его */
  const x = b.closest('.modal-back');
  if (x) $('[data-close]', x).click();
  protoForMeeting(b.dataset.protoMeet);
}, true);

/* Зум на сервере: если подключён — собрание можно сразу создать в Зуме,
   запись и ИИ-протокол придут в «Протоколы» сами (server/lib/zoom.js) */
const ZoomSt = {
  on: false,
  load() { if (window.EvaServer && window.EvaServer.zoom) window.EvaServer.zoom.status().then(s => { this.on = !!(s && s.configured); }); },
  async meeting(id) {
    try {
      await window.EvaServer.zoom.meeting(id);
      toast('Встреча в Зуме готова: ссылка — в собрании, запись и протокол придут в «Протоколы» сами');
    } catch (e) { toast('Зум не создал встречу: ' + ((e && e.message) || 'нет связи'), {error: true}); }
  },
};

/* новый протокол на моё «Ок» — звук и уведомление */
const ProtoNotify = {
  since: 0,
  wired: false,
  init() {
    if (this.wired) return;
    this.wired = true;
    this.since = Date.now() - 2000;
    Store.subscribe(c => { if (c === 'protocols') setTimeout(() => this.check(), 40); });
  },
  check() {
    if (!Auth.me()) return;
    const me = Tasks.meKey();
    const fresh = Proto.all().filter(p => Proto.needsMe(p) && Math.max(p.at || 0, p.upd || 0) > this.since && p.by !== me);
    if (!fresh.length) return;
    this.since = Math.max(this.since, ...fresh.map(p => Math.max(p.at || 0, p.upd || 0)));
    Sound.play('control');
    fresh.slice(-3).forEach(p => toast(`Протокол на подтверждение: ${p.title}`, {ring: true, action: {label: 'Открыть', fn: () => openProto(p.id)}}));
  },
};
