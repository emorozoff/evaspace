/* Путь контакта: добавить → ссылка на анкету → ответы пришли («новое» у исполнителя) → встреча →
   итог → подарок доступа к Еве.
   • «Добавить»: сначала поиск среди всех контактов CRM (в том числе тех, кто сам заполнил анкету на
     сайте): нашёлся в этой группе — открываем его карточку, в другой — заводим карточку здесь по тем
     же данным. Иначе — новый контакт: имя, Telegram, город, кто ведёт, теги. Похожий контакт
     подсвечивается, чтобы не плодить дубли.
   • После создания — личная ссылка на анкету: скопировать или отправить в Telegram / WhatsApp.
   • Ответы приходят сами (сервер): на карточке пометка «новое», исполнителю — сообщение в Telegram,
     в этом окне — всплывающее сообщение. Открыл карточку исполнитель — пометка снимается.
   • Подарок: доступ к Еве на неделю, месяц, год… — записываем, кому и до какого числа. */

/* ── поиск контакта ── */
const normTg = s => tgUser(s).toLowerCase().replace(/\s+/g, '');
const phoneOf = s => { const d = String(s || '').replace(/\D/g, ''); return d.length >= 10 ? d.slice(-10) : ''; };
function findContacts(q, limit = 8) {
  const v = String(q || '').trim().toLowerCase().replace(/ё/g, 'е');
  if (v.length < 2) return [];
  const tg = normTg(v), ph = phoneOf(v);
  return Store.all('people').filter(p => {
    const name = People.name(p).toLowerCase().replace(/ё/g, 'е');
    return name.includes(v) || (p.code || '').toLowerCase() === v || (tg.length > 2 && normTg(p.tg) === tg) || (ph && phoneOf(p.tg) === ph);
  }).sort((a, b) => (b.touchedAt || 0) - (a.touchedAt || 0)).slice(0, limit);
}
/* тот же человек: совпал Telegram или телефон, либо имя целиком */
function sameContact(name, tg) {
  const n = String(name || '').trim().toLowerCase().replace(/ё/g, 'е'), t = normTg(tg), ph = phoneOf(tg);
  return Store.all('people').filter(p => (t.length > 2 && normTg(p.tg) === t) || (ph && phoneOf(p.tg) === ph) || (n.length > 3 && People.name(p).toLowerCase().replace(/ё/g, 'е') === n));
}
const contactLine = p => [groupName(p.type), `шаг ${People.col(p)} · ${TYPES[p.type].steps[People.col(p) - 1]}`, p.tg, p.city].filter(Boolean).join(' · ');

/* поиск контакта в меню слева: из любого раздела — сразу в карточку (Enter — первая) */
function wireGlobalFind() {
  const inp = $('#gFind'), res = $('#gFindRes');
  if (!inp) return;
  const draw = () => {
    const list = findContacts(inp.value, 7);
    res.hidden = inp.value.trim().length < 2;
    res.innerHTML = list.map((p, i) => `<a href="#p-${p.id}" class="${i ? '' : 'first'}">${avatar(People.name(p))}<span><b>${esc(People.name(p))}</b><small>${esc(contactLine(p))}</small></span></a>`).join('') || '<p>Никого не нашли</p>';
  };
  inp.addEventListener('input', draw);
  inp.addEventListener('keydown', e => {
    if (e.key === 'Escape') { inp.value = ''; res.hidden = true; inp.blur(); }
    if (e.key === 'Enter') { const a = $('a', res); if (a) { location.hash = a.getAttribute('href').slice(1); inp.value = ''; res.hidden = true; inp.blur(); } }
  });
  res.addEventListener('click', e => { if (e.target.closest('a')) { inp.value = ''; res.hidden = true; } });
  inp.addEventListener('blur', () => setTimeout(() => { res.hidden = true; }, 200));
  inp.addEventListener('focus', () => { if (inp.value.trim().length >= 2) draw(); });
}

/* ── добавить контакт ── */
function openAdd(type) {
  const T = TYPES[type];
  const me = Who.id();
  const team = Team.assignable();
  const extra = type === 'expert' ? `<div class="field"><span>Направления</span>${pickedHtml('adDirs', [], 'Выбрать из списка')}</div>`
    : type === 'partner' ? `<div class="grid2"><label class="field"><span>Категория</span><select class="select" id="adCat">${PARTNER_CATS.map(c => `<option value="${esc(c)}">${esc(noEmo(c))}</option>`).join('')}</select></label><label class="field"><span>Контактное лицо</span><input class="input" id="adContact" placeholder="Ирина, управляющая"></label></div>` : '';
  openModal({title: `Добавить: ${T.one.toLowerCase()}`, wide: true, body: `
      <div class="add-steps"><span class="on"><i>1</i>Контакт</span><span><i>2</i>Ссылка на анкету</span><span><i>3</i>Ответы придут сами</span></div>
      <section class="add-find"><label class="field"><span>Найти среди контактов</span><input class="input" id="adFind" type="search" autocomplete="off" placeholder="Имя, @telegram, телефон или код — например, тех, кто уже прошёл анкету на сайте"></label>
        <div class="add-hits" id="adHits"></div></section>
      <div class="add-or"><span>или новый контакт</span></div>
      <label class="field"><span>${type === 'partner' ? 'Название' : 'Имя и фамилия'}</span><input class="input" id="adName" placeholder="${type === 'partner' ? 'Студия «Баланс»' : 'Анна Иванова'}"></label>
      <div class="grid2"><label class="field"><span>Telegram или телефон</span><input class="input" id="adTg" placeholder="@username или +7…"></label>
      <label class="field"><span>Город</span><input class="input" id="adCity" placeholder="Москва"></label></div>
      <div class="add-dup" id="adDup" hidden></div>
      ${extra}
      <div class="grid2"><label class="field"><span>Кто ведёт</span><select class="select" id="adOwner"><option value="">Пока никто</option>${team.map(m => `<option value="${m.id}" ${m.id === me ? 'selected' : ''}>${esc(Team.name(m))}${m.id === me ? ' (я)' : ''}</option>`).join('')}</select><small>Этому человеку придёт уведомление, когда ответы будут готовы</small></label>
      <div class="field"><span>Теги</span>${pickedHtml('adTags', [], 'Добавить теги')}</div></div>`,
    foot: '<button class="btn" data-close>Отмена</button><button class="btn primary" data-ok>Создать карточку и ссылку</button>',
    onMount(el, close) {
      const picked = {adDirs: [], adTags: []};
      wirePicked(el, picked, {adDirs: {items: DIRECTIONS, label: noEmo, placeholder: 'Найти направление…'}, adTags: {items: People.tagsOf(type).list, allowNew: true, placeholder: 'Найти или добавить тег…'}});
      /* поиск: в этой группе — открыть карточку, в другой — завести здесь по тем же данным */
      const hits = $('#adHits', el);
      const drawHits = () => {
        const list = findContacts($('#adFind', el).value);
        hits.innerHTML = list.map(p => `<div class="add-hit">${avatar(People.name(p))}<span><b>${esc(People.name(p))}</b><small>${esc(contactLine(p))}${Object.keys(p.answers || {}).length ? ' · анкета есть' : ''}</small></span>
          ${p.type === type ? `<button class="btn sm" data-open-hit="${p.id}">Открыть карточку</button>` : `<button class="btn sm primary" data-copy-hit="${p.id}">Завести здесь</button>`}</div>`).join('')
          || ($('#adFind', el).value.trim().length >= 2 ? '<p class="note">Не нашли — заполните нового ниже.</p>' : '');
      };
      $('#adFind', el).addEventListener('input', drawHits);
      on(el, 'click', '[data-open-hit]', (e, b) => { close(); App.go('p-' + b.dataset.openHit); });
      on(el, 'click', '[data-copy-hit]', (e, b) => {
        const src = People.get(b.dataset.copyHit);
        if (!src) return;
        const id = People.create({type, name: src.name, tg: src.tg || '', city: src.city || '', evaId: src.evaId || '', contact: src.contact || '', owner: $('#adOwner', el).value || null, from: src.id,
          ...(src.tags ? {tags: src.tags} : {})});
        close();
        openSendLink(People.get(id), true);
      });
      /* похожий контакт уже есть — подсказка, не запрет */
      const dup = $('#adDup', el);
      const checkDup = () => {
        const d = sameContact($('#adName', el).value, $('#adTg', el).value);
        dup.hidden = !d.length;
        dup.innerHTML = d.length ? `Похоже, такой контакт уже есть: ${d.slice(0, 3).map(p => `<a href="#p-${p.id}" data-close>${esc(People.name(p))}</a> <small>(${esc(groupName(p.type))})</small>`).join(', ')}` : '';
      };
      $('#adName', el).addEventListener('input', checkDup);
      $('#adTg', el).addEventListener('input', checkDup);
      $('[data-ok]', el).onclick = () => {
        const name = $('#adName', el).value.trim();
        if (!name) { $('#adName', el).classList.add('need'); $('#adName', el).focus(); return; }
        const f = {type, name, tg: $('#adTg', el).value.trim(), city: $('#adCity', el).value.trim(), owner: $('#adOwner', el).value || null};
        if (type === 'expert') f.dirs = picked.adDirs;
        if (picked.adTags.length) f.tags = picked.adTags;
        if (type === 'partner') { f.cat = $('#adCat', el).value; f.contact = $('#adContact', el).value.trim(); }
        const id = People.create(f);
        close();
        openSendLink(People.get(id), true);
      };
      if (!matchMedia('(pointer:coarse)').matches) $('#adFind', el).focus();
    }});
}

/* ── ссылка на анкету: скопировать или отправить сразу в мессенджер ── */
function openSendLink(p, fresh = false) {
  if (!p) return;
  const link = People.link(p), T = TYPES[p.type];
  const hi = T.you === 'ты' ? `Привет${p.name ? ', ' + String(p.name).split(' ')[0] : ''}! Это анкета Евы — пара минут, почти всё кнопками 💜` : `Здравствуйте${p.name ? ', ' + String(p.name).split(' ')[0] : ''}! Небольшая анкета Eva Space — несколько минут ✨`;
  const tg = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(hi)}`;
  const wa = `https://wa.me/?text=${encodeURIComponent(hi + ' ' + link)}`;
  const sent = () => { const cur = People.get(p.id); if (cur && (cur.s1 || 'new') === 'new') People.patch(p.id, {s1: 'sent', sentAt: Date.now()}, 'Отправили ссылку на анкету', '🔗'); };
  openModal({title: fresh ? `Карточка готова: ${People.name(p)}` : `Анкета для ${People.name(p)}`, body: `
      ${fresh ? '<div class="add-steps"><span class="done"><i>✓</i>Контакт</span><span class="on"><i>2</i>Ссылка на анкету</span><span><i>3</i>Ответы придут сами</span></div>' : ''}
      <p class="note">Личная ссылка ${esc(People.name(p))}: ответы сами лягут в карточку, ${p.owner ? `${esc(Team.name(Team.get(p.owner)))} получит` : 'команда получит'} уведомление, карточка перейдёт на шаг «${esc(T.steps[1])}».</p>
      <div class="tf-link"><input class="input" readonly value="${esc(link)}" id="slUrl" aria-label="Ссылка на анкету"><button class="btn" data-copy>${icon('copy')}Скопировать</button></div>
      <div class="send-row"><a class="btn primary" href="${esc(tg)}" target="_blank" rel="noopener" data-sent>${icon('send')}Отправить в Telegram</a><a class="btn" href="${esc(wa)}" target="_blank" rel="noopener" data-sent>${icon('msg')}В WhatsApp</a></div>`,
    foot: `<button class="btn" data-close>Отправлю позже</button><button class="btn" data-open>Открыть карточку</button>`,
    onMount(el, close) {
      $('[data-copy]', el).onclick = async () => { await copyOrShow(link, 'Ссылка скопирована 💌 Отправьте её человеку'); sent(); };
      on(el, 'click', '[data-sent]', () => sent());
      $('[data-open]', el).onclick = () => { close(); App.go('p-' + p.id); };
    }});
}

/* ── доступ к Еве в подарок ── */
const ACCESS_PLANS = [['week', 'Неделя', 7], ['2w', '2 недели', 14], ['month', 'Месяц', 30], ['3m', '3 месяца', 91], ['6m', 'Полгода', 182], ['year', 'Год', 365]];
const planOf = k => ACCESS_PLANS.find(x => x[0] === k) || null;
const accessOn = p => !!(p.access && p.access.until && p.access.until > Date.now());
const dateRu = ts => { const d = new Date(ts); return `${d.getDate()} ${['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'][d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''}`; };
function giveAccess(p, key) {
  const pl = planOf(key);
  if (!pl) return;
  const now = Date.now(), cur = People.get(p.id) || p;
  /* продлеваем от конца действующего доступа */
  const from = accessOn(cur) ? cur.access.until : now;
  const access = {plan: key, days: pl[2], from, until: from + pl[2] * 864e5, by: Who.id(), at: now};
  const gift = cur.gift && !cur.gift.done ? {gift: {...cur.gift, done: true, doneAt: now, by: Who.id()}} : {};
  People.patch(p.id, {access, ...gift}, `Подарили доступ к Еве: ${pl[1].toLowerCase()} (до ${dateRu(access.until)})`, '🎁');
  toast(`🎁 ${People.name(p)}: доступ к Еве — ${pl[1].toLowerCase()}, до ${dateRu(access.until)}`);
}
/* полоса в карточке: что подарено и кнопки сроков */
function accessHtml(p, canEdit) {
  const on = accessOn(p), a = p.access || null, pl = a && planOf(a.plan);
  const owed = p.gift && !p.gift.done;
  const plans = canEdit ? `<div class="acc-plans" role="group" aria-label="Срок доступа">${ACCESS_PLANS.map(([k, n]) => `<button type="button" class="${owed && k === 'week' && !on ? 'sug' : ''}" data-access="${k}">${n}</button>`).join('')}</div>` : '';
  return `<div class="card acc ${on ? 'on' : ''}">
    <div class="acc-h">${icon('gift')}<div><b>Доступ к Еве</b>
      <small>${on ? `Подарен: ${esc(pl ? pl[1].toLowerCase() : a.days + ' дн.')} · до ${esc(dateRu(a.until))}${a.by && Team.get(a.by) ? ` · ${esc(Team.name(Team.get(a.by)))}` : ''}`
        : a ? `Был до ${esc(dateRu(a.until))} — закончился` : owed ? 'За анкету обещали неделю Евы — подарите' : 'Можно подарить доступ на неделю, месяц, год'}</small></div>
      ${on && canEdit ? '<button class="link-btn" data-access-off>Отменить</button>' : ''}</div>
    ${canEdit ? `<div class="acc-row"><span class="note">${on ? 'Продлить ещё на:' : 'Подарить:'}</span>${plans}</div>
      <p class="note acc-note">Доступ в самом приложении Евы открывает менеджер — здесь записываем, кому и до какого числа.</p>` : ''}
  </div>`;
}
function wireAccess(root, p) {
  on(root, 'click', '[data-access]', async (e, el) => {
    const pl = planOf(el.dataset.access);
    if (!pl || !await confirmPop(el, {text: `Подарить ${People.name(p)} доступ к Еве: ${pl[1].toLowerCase()}?`, yes: 'Подарить'})) return;
    giveAccess(p, pl[0]);
  });
  on(root, 'click', '[data-access-off]', async (e, el) => {
    if (!await confirmPop(el, {text: 'Отменить подаренный доступ?', yes: 'Отменить', danger: true})) return;
    People.patch(p.id, {access: {...(People.get(p.id).access || {}), until: Date.now(), off: true}}, 'Отменили подаренный доступ к Еве', '↩');
  });
}

/* ── «новое»: ответы пришли — исполнителю ── */
/* моя карточка: веду я, или её никто не ведёт (тогда она общая) */
const isMine = p => !p.owner || p.owner === Who.id();
const freshFor = p => !!(p.fresh && p.fresh.at && isMine(p));
const freshList = () => Store.all('people').filter(freshFor).sort((a, b) => b.fresh.at - a.fresh.at);
/* исполнитель открыл карточку — пометка «новое» снимается (без записи в историю) */
function seenFresh(p) {
  if (p && p.fresh && p.fresh.at && (p.owner === Who.id() || (!p.owner && People.canEdit())) && People.canEdit()) Store.patch('people', p.id, {fresh: null});
}
/* пришли ответы, пока CRM открыта, — всплывающее сообщение со ссылкой */
const Fresh = {
  seen: new Map(),
  t0: 0,
  init() {
    /* что пришло до открытия страницы — видно на главной и на доске, всплывать не нужно */
    this.t0 = Date.now();
    Store.all('people').forEach(p => { if (p.fresh) this.seen.set(p.id, p.fresh.at); });
    Store.subscribe(c => {
      if (c !== 'people') return;
      Store.all('people').forEach(p => {
        if (!p.fresh || !p.fresh.at || this.seen.get(p.id) === p.fresh.at) return;
        this.seen.set(p.id, p.fresh.at);
        if (freshFor(p) && p.fresh.at > this.t0 - 2000) toast(`📝 ${p.fresh.text}`, {action: {label: 'Открыть', fn: () => App.go('p-' + p.id)}});
      });
    });
  },
};

/* ── «Встречи»: всё, что на шаге 2 — назначить, провести, разобрать ── */
App.register('meetings', {
  title: 'Встречи',
  render(root) {
    const who = View.get('mt.who', 'all'), grp = View.get('mt.type', '');
    const me = Who.id();
    let all = Store.all('people').filter(p => !grp || p.type === grp);
    if (who === 'me') all = all.filter(p => p.owner === me);
    else if (who === 'none') all = all.filter(p => !p.owner);
    else if (who !== 'all') all = all.filter(p => p.owner === who);
    const now = Date.now(), dayEnd = dateOf(addDays(today(), 1)).getTime();
    const set = all.filter(p => People.col(p) === 2 && p.s2 === 'set').sort((a, b) => (a.callAt || 0) - (b.callAt || 0));
    const todayL = set.filter(p => p.callAt && p.callAt < dayEnd);
    const later = set.filter(p => !p.callAt || p.callAt >= dayEnd);
    const need = all.filter(p => People.col(p) === 2 && ['none', 'noshow'].includes(p.s2 || 'none')).sort((a, b) => (a.answeredAt || 0) - (b.answeredAt || 0));
    const review = all.filter(p => People.col(p) === 3 && (p.s3 || 'none') === 'none').sort((a, b) => (b.talkAt || 0) - (a.talkAt || 0));
    const canEdit = People.canEdit();
    const row = (p, acts) => { const o = Team.get(p.owner); return `<div class="mt-r ${p.fresh && freshFor(p) ? 'is-new' : ''}">
        <time>${p.callAt && p.s2 === 'set' ? esc(when(p.callAt)) : p.answeredAt ? `анкета ${esc(sinceDays(p.answeredAt))}` : '—'}</time>
        <a class="mt-who" href="#p-${p.id}">${avatar(People.name(p))}<span><b>${esc(People.name(p))}</b><small>${esc([groupName(p.type), People.sub(p, true)].filter(Boolean).join(' · '))}</small></span></a>
        <span class="mt-owner" title="Кто ведёт">${o ? Team.av(o, 'xs') + esc(Team.first(o)) : '<span class="muted">никто</span>'}</span>
        <span class="mt-acts">${canEdit ? acts(p) : ''}</span></div>`; };
    const b = (act, p, label, primary = false) => `<button class="btn sm ${primary ? 'primary' : ''}" data-act="${act}" data-pid="${p.id}">${label}</button>`;
    const sec = (title, note, list, acts, empty) => `<section class="section card mt-sec"><div class="card-head"><h2>${title} <span class="h-n">${list.length}</span></h2><span class="note">${note}</span></div>
      ${list.length ? `<div class="mt-list">${list.map(p => row(p, acts)).join('')}</div>` : `<p class="note">${empty}</p>`}</section>`;
    const talkW = p => (p.type === 'client' ? 'интервью' : 'созвон');
    root.innerHTML = `
      ${pageHead('Встречи', 'Все, кто прошёл анкету: назначить созвон, провести интервью по готовым вопросам и подвести итог. Ответы интервью сразу идут в статистику.')}
      <div class="t-bar"><select class="select sm t-filter" id="mtWho" aria-label="Кто ведёт"><option value="all">Все исполнители</option><option value="me" ${who === 'me' ? 'selected' : ''}>Мои</option><option value="none" ${who === 'none' ? 'selected' : ''}>Без исполнителя</option>${Team.assignable().map(m => `<option value="${m.id}" ${who === m.id ? 'selected' : ''}>${esc(Team.name(m))}</option>`).join('')}</select>
        <select class="select sm t-filter" id="mtType" aria-label="Группа"><option value="">Все группы</option>${Object.keys(TYPES).map(k => `<option value="${k}" ${grp === k ? 'selected' : ''}>${groupName(k)}</option>`).join('')}</select>
        <span class="t-bar-sp"></span><a class="note" href="#calendar">Календарь →</a></div>
      <div class="kpis kpis-4 card">${[[todayL.length, 'сегодня'], [later.length, 'назначено дальше'], [need.length, 'ждут назначения'], [review.length, 'ждут разбора']].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('')}</div>
      ${sec('Сегодня', 'кнопка «Начать» откроет вопросы, таймер и план на 40 минут', todayL, p => b('talk', p, `Начать ${talkW(p)}`, true) + b('time', p, 'Перенести'), 'Сегодня встреч нет.')}
      ${sec('Ждут назначения', 'анкета пришла — договоритесь о времени или отправьте вопросы ссылкой', need, p => b('time', p, 'Назначить', true) + b('tlink', p, 'Вопросы ссылкой') + b('talk', p, 'Начать сейчас'), 'Все, кто прошёл анкету, уже с датой.')}
      ${sec('Назначены', 'ближайшие встречи', later, p => b('talk', p, 'Открыть') + b('time', p, 'Перенести'), 'Пока ничего не назначено.')}
      ${sec('Прошли — подвести итог', 'отметьте, что услышали: метки и цитаты попадут в статистику', review, p => b('result', p, p.type === 'client' ? 'Разобрать интервью' : 'Записать решение', true), 'Все встречи разобраны.')}`;
    $('#mtWho', root).onchange = e => { View.set('mt.who', e.target.value); App.render(); };
    $('#mtType', root).onchange = e => { View.set('mt.type', e.target.value); App.render(); };
    wireActs(root);
  },
});
