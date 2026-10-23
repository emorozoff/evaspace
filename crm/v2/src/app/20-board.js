/* Страница группы (кастдев, эксперты, партнёры, амбассадоры): три шага
   общения колонками — анкета → созвон → итог. На карточке — имя, одна
   строка о человеке, статус (только если он что-то добавляет) и одна-две
   кнопки следующего действия. */

const stChip = (tone, text) => `<span class="st ${tone}">${esc(text)}</span>`;
/* 'сегодня' · 'вчера' · '3 дня' */
function sinceDays(ts) {
  const d = Math.floor((Date.now() - ts) / 864e5);
  return d <= 0 ? 'сегодня' : d === 1 ? 'вчера' : `${d} ${plural(d, 'день', 'дня', 'дней')}`;
}
/* направления эксперта и теги — чипами: на доске первые n, в карточке все */
function chipsOf(p, n = 99) {
  const dirs = p.type === 'expert' ? (p.dirs || []).map(d => `<span class="tagchip dir">${esc(noEmo(d))}</span>`) : [];
  const all = [...dirs, ...(p.tags || []).map(t => `<span class="tagchip">${esc(t)}</span>`)];
  return all.length ? `<div class="pc-tags">${all.slice(0, n).join('')}${all.length > n ? `<span class="tagchip more">+${all.length - n}</span>` : ''}</div>` : '';
}
/* статус на карточке: пусто, если кнопка рядом и так говорит, что делать */
function statusLine(p) {
  const c = People.col(p);
  if (c === 1) return p.s1 === 'sent' ? stChip('warn', `Ждём ответы${p.sentAt ? ' · ' + sinceDays(p.sentAt) : ''}`) : '';
  if (c === 2) {
    if (p.s2 === 'set') return stChip('violet', p.callAt ? `Созвон ${when(p.callAt)}` : 'Созвон назначен');
    if (p.s2 === 'noshow') return stChip('bad', 'Созвон не состоялся');
    return '';
  }
  const s = s3Map(p.type)[p.s3 || 'none'];
  return (p.s3 || 'none') !== 'none' ? stChip(s.tone, s.name) : '';
}
/* перенести на этап из списка ('2', '3:fan') — кнопкой на доске и выбором «Этап» в карточке;
   то же, что перетащить карточку, но работает и на телефоне */
function moveToStage(p, value) {
  const [c, zone] = String(value).split(':');
  const before = People.moveTo(People.get(p.id), Number(c), zone || null);
  if (!before) return false;
  syncCall(p.id);
  const T = TYPES[p.type];
  toast(`${People.name(p)} → ${T.steps[Number(c) - 1]}${zone ? ' · ' + s3Map(p.type)[zone].name.toLowerCase() : ''}`, {undo: () => People.patch(p.id, before, 'Отменили перенос', '↩')});
  return true;
}
/* кнопки следующего шага: одни и те же на доске и в карточке (big — в карточке, больше вариантов) */
function nextActs(p, big = false) {
  if (!People.canEdit()) return '';
  const b = (act, label, primary = false) => `<button class="btn ${big ? 'sm' : 'xs'} ${primary ? 'primary' : ''}" data-act="${act}" data-pid="${p.id}">${label}</button>`;
  const talk = p.type === 'client' ? 'интервью' : 'созвон';
  const c = People.col(p);
  if (c === 1) return (p.s1 === 'sent' ? b('link', 'Ссылка ещё раз') : b('link', 'Отправить анкету', true)) + b('fill', 'Заполнить') + (big ? b('skip1', 'Без анкеты') : '');
  if (c === 2) {
    if (p.s2 === 'set') return b('talk', `Начать ${talk}`, true) + b('done2', p.type === 'client' ? 'Прошло' : 'Прошёл') + (big ? b('time', 'Перенести') + b('noshow', 'Не состоялся') : '');
    return b('time', 'Назначить созвон', true) + (big ? b('talk', `Начать ${talk} сейчас`) + b('tlink', 'Отправить вопросы ссылкой') + b('skip2', 'Без созвона') : '');
  }
  const s3 = p.s3 || 'none';
  if (p.type === 'client') return s3 === 'none' ? b('result', 'Разобрать интервью', true) : '';
  if (s3 === 'none') return b('yes', 'Подключаем', true) + b('think', 'Думает') + b('no', 'Не сейчас');
  if (s3 === 'think') return b('yes', 'Подключаем', true) + b('no', 'Не сейчас');
  return '';
}
/* обработчик всех кнопок шагов */
function wireActs(root) {
  on(root, 'click', '[data-act]', async (e, el) => {
    e.stopPropagation();
    const p = People.get(el.dataset.pid);
    if (!p) return;
    const act = el.dataset.act;
    const T = TYPES[p.type];
    if (act === 'link') {
      await copyOrShow(People.link(p), 'Ссылка скопирована 💌 Отправьте её в Telegram или WhatsApp');
      if ((p.s1 || 'new') === 'new') People.patch(p.id, {s1: 'sent', sentAt: Date.now()}, 'Отправили ссылку на анкету', '🔗');
    } else if (act === 'tlink') {
      await copyOrShow(People.talkLink(p), `Ссылка на вопросы ${p.type === 'client' ? 'интервью' : 'созвона'} скопирована 💬 Отправьте её человеку — ответы сами лягут в карточку`);
      if (!p.talkSentAt) People.patch(p.id, {talkSentAt: Date.now()}, 'Отправили ссылку на вопросы интервью', '💬');
    } else if (act === 'fill') { View.set('pp.last', p.id); View.set('pp.tab', 'anketa'); View.set('pp.edit', true); App.go('p-' + p.id); }
    else if (act === 'skip1') People.patch(p.id, {s1: 'skip'}, 'Решили без анкеты', '⏭');
    else if (act === 'time') openTimePicker(p);
    else if (act === 'talk') { Timer.start(p.id); View.set('pp.last', p.id); View.set('pp.tab', 'talk'); App.go('p-' + p.id); }
    else if (act === 'done2') { People.patch(p.id, {s2: 'done', talkAt: p.talkAt || Date.now()}, `${p.type === 'client' ? 'Интервью' : 'Созвон'} прошёл`, '✅'); syncCall(p.id); }
    else if (act === 'noshow') People.patch(p.id, {s2: 'noshow'}, 'Не пришла на созвон', '🙈');
    else if (act === 'skip2') People.patch(p.id, {s2: 'skip'}, 'Без созвона', '⏭');
    else if (act === 'result') { View.set('pp.last', p.id); View.set('pp.tab', 'result'); App.go('p-' + p.id); }
    else if (['yes', 'think', 'no'].includes(act)) { const s = S3.other[act]; People.patch(p.id, {s3: act}, `Итог: ${s.name}`, s.emo); toast(`${s.emo} ${People.name(p)}: ${s.name.toLowerCase()}`); }
    void T;
  });
}

/* форма интервью отдельной страницей (/interview/): общая ссылка — кто заполнит, тот появится
   новой карточкой; личная — в карточке человека, ответы лягут к нему */
function openTalkForm(type) {
  const T = TYPES[type], url = People.talkForm(type);
  const qs = Questions.talk(type), blocks = groupByBlock(type, 'talk', qs);
  const what = type === 'client' ? 'интервью' : 'созвона';
  openModal({title: type === 'client' ? 'Форма интервью' : 'Вопросы созвона — формой', wide: true, body: `
      <p class="note">${qs.length} ${plural(qs.length, 'вопрос', 'вопроса', 'вопросов')} ${what} отдельной страницей: человек отвечает своими словами, ответы сами ложатся в CRM — во вкладку «Интервью» карточки, карточка переходит на шаг «${esc(T.steps[2])}». Ту же форму можно открыть самим во время онлайн-${type === 'client' ? 'интервью' : 'созвона'} и записывать ответы.</p>
      ${blocks.length > 1 ? `<div class="tf-blocks">${blocks.map((g, i) => `<span><b>${i + 1}. ${esc(g.name)}</b> ${g.qs.length}</span>`).join('')}</div>` : ''}
      <h3 class="tf-h">Общая ссылка — для любого респондента</h3>
      ${url ? `<div class="tf-link"><input class="input" readonly value="${esc(url)}" id="tfUrl" aria-label="Общая ссылка на форму"><button class="btn primary" data-copy>${icon('copy')}Скопировать</button><a class="btn" href="${esc(url)}" target="_blank" rel="noopener">${icon('ext')}Открыть</a></div>
        <p class="note">Сначала форма спросит имя и Telegram. Каждый, кто заполнит, — новая карточка в «${esc(groupName(type))}».</p>`
        : '<p class="note">Общая ссылка работает на сервере Евы — eva.tytproai.ru.</p>'}
      <h3 class="tf-h">Личная ссылка — для конкретного человека</h3>
      <p class="note">В карточке человека — кнопка «Ссылка на ${type === 'client' ? 'интервью' : 'вопросы'}» (и «Отправить вопросы ссылкой» на шаге «${esc(T.steps[1])}»). Ответы лягут именно в его карточку, записанное командой не затрётся.</p>
      <p class="note"><button class="link-btn" data-qs>Изменить вопросы</button> — правки сами попадут в форму и в новые ссылки.</p>`,
    foot: '<button class="btn" data-close>Закрыть</button>',
    onMount(el, close) {
      const cp = $('[data-copy]', el);
      if (cp) cp.onclick = () => copyOrShow(url, `Ссылка на форму ${what} скопирована 💬`);
      $('[data-qs]', el).onclick = () => { View.set('qs.type', type); close(); App.go('questions'); };
    }});
}

/* удалить несколько карточек разом (руководитель) — например, тестовые. Заранее отмечены похожие
   на тестовые: пример (demo), «тест» в имени, а в кастдеве — все клиентки, заведённые до утра 23.10.2026,
   кроме Алены Красильниковой: на это время её интервью — единственное настоящее (просьба основателей) */
const TEST_UNTIL = Date.UTC(2026, 9, 23, 8, 0);
const looksTest = p => !!p.demo || /тест|test/i.test(People.name(p))
  || (p.type === 'client' && (p.createdAt || 0) < TEST_UNTIL && !/красильников|krasilnikov/i.test(People.name(p).replace(/ё/gi, 'е')));
function openBulkDelete(type) {
  const T = TYPES[type], list = People.all(type);
  const info = p => [`шаг ${People.col(p)} · ${T.steps[People.col(p) - 1]}`, p.city,
    Object.keys(p.answers || {}).length ? 'есть анкета' : '', Object.values(p.talk || {}).some(x => x && x.a) ? 'есть интервью' : '',
    p.createdAt ? 'добавлена ' + when(p.createdAt).replace(/, \d\d:\d\d$/, '') : ''].filter(Boolean).join(' · ');
  openModal({title: `Удалить карточки — ${groupName(type)}`, wide: true, body: `
      <p class="note">Отметьте, что удалить, — например, тестовые карточки. Похожие на тестовые уже отмечены: проверьте список. Удалённую карточку не вернуть.</p>
      <div class="bd-tools"><button class="link-btn" data-all>Отметить все</button><button class="link-btn" data-none>Снять все</button></div>
      <div class="bd-list">${list.map(p => `<label class="bd-row"><input type="checkbox" value="${p.id}" ${looksTest(p) ? 'checked' : ''}>${avatar(People.name(p))}<span><b>${esc(People.name(p))}</b><small>${esc(info(p))}</small></span></label>`).join('') || '<p class="note">Карточек нет</p>'}</div>`,
    foot: '<button class="btn" data-close>Отмена</button><button class="btn danger solid" data-ok>Удалить</button>',
    onMount(el, close) {
      const ok = $('[data-ok]', el), boxes = () => $$('.bd-row input', el);
      const upd = () => { const n = boxes().filter(i => i.checked).length; ok.textContent = n ? `Удалить ${n}` : 'Удалить'; ok.disabled = !n; };
      on(el, 'change', '.bd-row input', upd);
      $('[data-all]', el).onclick = () => { boxes().forEach(i => { i.checked = true; }); upd(); };
      $('[data-none]', el).onclick = () => { boxes().forEach(i => { i.checked = false; }); upd(); };
      ok.onclick = async () => {
        const ids = boxes().filter(i => i.checked).map(i => i.value);
        if (!ids.length || !await confirmPop(ok, {text: `Удалить ${ids.length} ${plural(ids.length, 'карточку', 'карточки', 'карточек')} со всеми ответами? Вернуть их будет нельзя.`, yes: 'Удалить', danger: true})) return;
        ids.forEach(id => Store.remove('people', id));
        close();
        toast(`Удалено: ${ids.length} ${plural(ids.length, 'карточка', 'карточки', 'карточек')}`);
      };
      upd();
    }});
}

/* поля «выбрать из списка» в форме: кнопка открывает поиск с галочками, выбранное — чипами */
function wirePicked(el, picked, cfg) {
  on(el, 'click', '[data-pick-open]', async (e, b) => {
    const id = b.dataset.pickOpen, c = cfg[id];
    const v = await multiPop(b, {items: c.items, selected: picked[id], allowNew: !!c.allowNew, placeholder: c.placeholder, label: c.label || (x => x)});
    if (!v) return;
    picked[id] = v;
    $('#' + id, el).outerHTML = pickedHtml(id, v, c.empty || (c.allowNew ? 'Добавить теги' : 'Выбрать из списка'));
  });
}

/* быстро добавить человека: имя, контакт — и сразу ссылка */
function openAdd(type) {
  const T = TYPES[type];
  const extra = type === 'expert' ? `<div class="field"><span>Направления</span>${pickedHtml('adDirs', [], 'Выбрать из списка')}</div>`
    : type === 'partner' ? `<label class="field"><span>Категория</span><select class="select" id="adCat">${PARTNER_CATS.map(c => `<option value="${esc(c)}">${esc(noEmo(c))}</option>`).join('')}</select></label><label class="field"><span>Контактное лицо</span><input class="input" id="adContact" placeholder="Ирина, управляющая"></label>` : '';
  openModal({title: `${T.one}: добавить`, body: `
      <label class="field"><span>${type === 'partner' ? 'Название' : 'Имя'}</span><input class="input" id="adName" placeholder="${type === 'partner' ? 'Студия «Баланс»' : 'Анна Иванова'}"></label>
      <div class="grid2"><label class="field"><span>Telegram или телефон</span><input class="input" id="adTg" placeholder="@username"></label>
      <label class="field"><span>Город</span><input class="input" id="adCity" placeholder="Москва"></label></div>
      ${extra}
      <div class="field"><span>Теги</span>${pickedHtml('adTags', [], 'Добавить теги')}</div>
      <p class="note">Ссылка на анкету скопируется сама — отправьте её человеку. Ответы попадут в карточку.</p>`,
    foot: '<button class="btn" data-close>Отмена</button><button class="btn" data-only>Просто добавить</button><button class="btn primary" data-ok>Добавить и скопировать ссылку</button>',
    onMount(el, close) {
      const picked = {adDirs: [], adTags: []};
      wirePicked(el, picked, {adDirs: {items: DIRECTIONS, label: noEmo, placeholder: 'Найти направление…'}, adTags: {items: People.tagsOf(type).list, allowNew: true, placeholder: 'Найти или добавить тег…'}});
      const save = async withLink => {
        const name = $('#adName', el).value.trim();
        if (!name) { $('#adName', el).classList.add('need'); $('#adName', el).focus(); return; }
        const f = {type, name, tg: $('#adTg', el).value.trim(), city: $('#adCity', el).value.trim()};
        if (type === 'expert') f.dirs = picked.adDirs;
        if (picked.adTags.length) f.tags = picked.adTags;
        if (type === 'partner') { f.cat = $('#adCat', el).value; f.contact = $('#adContact', el).value.trim(); }
        const id = People.create(f);
        close();
        if (withLink) {
          const p = People.get(id);
          await copyOrShow(People.link(p), 'Ссылка скопирована 💌 Отправьте её человеку');
          People.patch(id, {s1: 'sent', sentAt: Date.now()}, 'Отправили ссылку на анкету', '🔗');
        } else toast(`${name}: добавлено ✨`);
      };
      $('[data-ok]', el).onclick = () => save(true);
      $('[data-only]', el).onclick = () => save(false);
    }});
}

function audiencePage(type) {
  return {
    title: groupName(type),
    render(root) {
      const T = TYPES[type];
      const q = View.get(type + '.q', '').trim().toLowerCase();
      const f = View.get(type + '.f', ''), tg = View.get(type + '.tag', '');
      const everyone = People.all(type);
      let list = everyone;
      if (q) list = list.filter(p => (People.name(p) + ' ' + (p.city || '') + ' ' + (p.code || '') + ' ' + (p.topic || '') + ' ' + (p.tags || []).join(' ')).toLowerCase().includes(q));
      if (f) list = list.filter(p => (type === 'expert' ? (p.dirs || []).includes(f) : type === 'partner' ? p.cat === f : true));
      if (tg) list = list.filter(p => (p.tags || []).includes(tg));
      const tags = People.tagsOf(type);
      const cols = [1, 2, 3].map(c => list.filter(p => People.col(p) === c));
      const hints = [
        'Отправьте ссылку — человек ответит сам за 3 минуты. Или заполните за него.',
        type === 'client' ? 'Интервью в Zoom — 40 минут по плану. Вопросы, таймер и заметки — в карточке; или вопросы ссылкой, письменно.' : 'Созвон 30 минут: знакомимся и договариваемся.',
        type === 'client' ? 'Отметьте, что услышали, — это попадёт в статистику.' : 'Запишите решение: подключаем, думает или не сейчас.',
      ];
      /* направления и категории — выпадающим списком (с числом людей), а не стеной кнопок */
      const filters = type === 'expert' ? DIRECTIONS.map(d => [d, everyone.filter(p => (p.dirs || []).includes(d)).length])
        : type === 'partner' ? PARTNER_CATS.map(c => [c, everyone.filter(p => p.cat === c).length])
        : [];
      const fSel = filters.length ? `<select class="select sm t-filter" id="bf" aria-label="${type === 'expert' ? 'Направление' : 'Категория'}"><option value="">${type === 'expert' ? 'Все направления' : 'Все категории'}</option>${filters.map(([v, c]) => `<option value="${esc(v)}" ${f === v ? 'selected' : ''}>${esc(noEmo(v))}${c ? ` · ${c}` : ''}</option>`).join('')}</select>` : '';
      const usedTags = Object.keys(tags.n);
      const tSel = usedTags.length || tg ? `<select class="select sm t-filter" id="bt" aria-label="Тег"><option value="">Все теги</option>${[...new Set([...usedTags, ...(tg ? [tg] : [])])].map(t => `<option value="${esc(t)}" ${tg === t ? 'selected' : ''}>${esc(t)} · ${tags.n[t] || 0}</option>`).join('')}</select>` : '';
      const canEdit = People.canEdit();
      if (canEdit) hints[0] += ' Перенести на другой этап — кнопкой ⇄ на карточке или перетащить её.';

      root.innerHTML = `
        ${pageHead(`${T.emo} ${groupName(type)}`, esc(T.about),
          `<button class="btn" data-stats>${icon('chart')}Статистика</button>${canEdit ? `<button class="btn" data-tform>${icon('msg')}${type === 'client' ? 'Форма интервью' : 'Вопросы формой'}</button><button class="btn" data-paste>${icon('inbox')}Вставить ответы</button><button class="btn primary" data-add>${icon('plus')}${type === 'client' ? 'Клиентка' : T.one}</button>` : ''}${Who.can('delete') && everyone.length ? `<button class="icon-btn" data-bulk-del title="Удалить несколько карточек — например, тестовые">${icon('trash')}</button>` : ''}`)}
        ${!everyone.length ? `<div class="welcome"><span class="e">${T.emo}</span><div><b>Здесь пока никого</b><p>Добавьте первого человека — ссылка на анкету скопируется сама. ${type === 'client' ? 'Для кастдева хватит 10–15 интервью, чтобы увидеть закономерности.' : ''}</p></div></div>` : ''}
        <div class="t-bar"><input class="input sm t-search" id="bq" placeholder="Поиск: имя, город, код, тег" value="${esc(View.get(type + '.q', ''))}">${fSel}${tSel}
          ${f || tg ? '<button class="link-btn" data-f-clear>Сбросить</button>' : ''}<span class="t-bar-sp"></span>
          <span class="note">${list.length === everyone.length ? `${everyone.length} ${plural(everyone.length, 'человек', 'человека', 'человек')}` : `найдено ${list.length} из ${everyone.length}`}</span></div>
        <div class="board3 ${canEdit ? 'can-drag' : ''}">${[0, 1, 2].map(i => `
          <div class="b3-col" data-col="${i + 1}"><div class="b3-h"><span class="num">${i + 1}</span><b>${T.steps[i]}</b><span class="kb-n">${cols[i].length}</span></div>
            <div class="b3-hint">${esc(hints[i])}</div>
            ${i === 2 && canEdit ? `<div class="b3-zones">${Object.entries(s3Map(type)).filter(([k]) => k !== 'none').map(([k, z]) => `<div class="b3-zone ${z.tone}" data-zone="${k}">${esc(z.name)}</div>`).join('')}</div>` : ''}
            <div class="b3-list">${cols[i].map(p => { const st = statusLine(p), acts = nextActs(p); return `<div class="pc" data-open="${p.id}" data-drag="${p.id}">
              <div class="pc-top">${avatar(People.name(p))}<b>${esc(People.name(p))}</b>${canEdit ? `<button class="pc-move" data-move-pop="${p.id}" title="Перенести на другой этап" aria-label="Перенести на другой этап">${icon('swap')}</button>` : ''}</div>
              ${People.sub(p, true) || p.ref ? `<div class="pc-sub">${esc(People.sub(p, true))}${p.ref ? `${People.sub(p, true) ? ' · ' : ''}<span class="pc-ref">по приглашению</span>` : ''}</div>` : ''}
              ${chipsOf(p, 3)}
              ${st ? `<div>${st}</div>` : ''}
              ${acts ? `<div class="pc-acts">${acts}</div>` : ''}
            </div>`; }).join('') || '<p class="note" style="padding:6px 4px">Пусто</p>'}</div>
          </div>`).join('')}</div>`;

      let qt;
      $('#bq', root).oninput = e => { clearTimeout(qt); const v = e.target.value; qt = setTimeout(() => { View.set(type + '.q', v); App.render({focus: 'bq'}); }, 250); };
      const bf = $('#bf', root), bt = $('#bt', root);
      if (bf) bf.onchange = () => { View.set(type + '.f', bf.value); App.render(); };
      if (bt) bt.onchange = () => { View.set(type + '.tag', bt.value); App.render(); };
      on(root, 'click', '[data-f-clear]', () => { View.set(type + '.f', ''); View.set(type + '.tag', ''); App.render(); });
      on(root, 'click', '[data-add]', () => openAdd(type));
      on(root, 'click', '[data-paste]', () => openPaste());
      on(root, 'click', '[data-tform]', () => openTalkForm(type));
      on(root, 'click', '[data-bulk-del]', () => openBulkDelete(type));
      on(root, 'click', '[data-stats]', () => { View.set('st.type', type); App.go('stats'); });
      on(root, 'click', '[data-open]', (e, el) => { if (e.target.closest('button')) return; App.go('p-' + el.dataset.open); });
      on(root, 'click', '[data-move-pop]', async (e, el) => {
        const p = People.get(el.dataset.movePop);
        if (!p) return;
        const v = await pickPop(el, People.stages(p), People.stageOf(p));
        if (v) moveToStage(p, v);
      });
      wireActs(root);
      /* зажать карточку и перенести в другой шаг — статус меняется сам */
      if (canEdit) Drag.board($('.board3', root), {onDrop: (id, col, zone) => {
        const p = People.get(id);
        if (!p) return;
        const before = People.moveTo(p, Number(col), zone);
        if (!before) { App.render(); return; }
        syncCall(id);
        const zn = zone ? ' · ' + s3Map(type)[zone].name.toLowerCase() : '';
        toast(`${People.name(p)} → ${T.steps[Number(col) - 1]}${zn}`, {undo: () => People.patch(id, before, 'Отменили перенос', '↩')});
      }});
    },
  };
}
Object.keys(TYPES).forEach(type => App.register(type, audiencePage(type)));
