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
/* кнопки следующего шага: одни и те же на доске и в карточке (big — в карточке, больше вариантов) */
function nextActs(p, big = false) {
  if (!People.canEdit()) return '';
  const b = (act, label, primary = false) => `<button class="btn ${big ? 'sm' : 'xs'} ${primary ? 'primary' : ''}" data-act="${act}" data-pid="${p.id}">${label}</button>`;
  const talk = p.type === 'client' ? 'интервью' : 'созвон';
  const c = People.col(p);
  if (c === 1) return (p.s1 === 'sent' ? b('link', 'Ссылка ещё раз') : b('link', 'Отправить анкету', true)) + b('fill', 'Заполнить') + (big ? b('skip1', 'Без анкеты') : '');
  if (c === 2) {
    if (p.s2 === 'set') return b('talk', `Начать ${talk}`, true) + b('done2', p.type === 'client' ? 'Прошло' : 'Прошёл') + (big ? b('time', 'Перенести') + b('noshow', 'Не состоялся') : '');
    return b('time', 'Назначить созвон', true) + (big ? b('talk', `Начать ${talk} сейчас`) + b('skip2', 'Без созвона') : '');
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
    } else if (act === 'fill') { View.set('pp.last', p.id); View.set('pp.tab', 'anketa'); View.set('pp.edit', true); App.go('p-' + p.id); }
    else if (act === 'skip1') People.patch(p.id, {s1: 'skip'}, 'Решили без анкеты', '⏭');
    else if (act === 'time') openTimePicker(p);
    else if (act === 'talk') { View.set('pp.last', p.id); View.set('pp.tab', 'talk'); App.go('p-' + p.id); }
    else if (act === 'done2') People.patch(p.id, {s2: 'done', talkAt: p.talkAt || Date.now()}, `${p.type === 'client' ? 'Интервью' : 'Созвон'} прошёл`, '✅');
    else if (act === 'noshow') People.patch(p.id, {s2: 'noshow'}, 'Не пришла на созвон', '🙈');
    else if (act === 'skip2') People.patch(p.id, {s2: 'skip'}, 'Без созвона', '⏭');
    else if (act === 'result') { View.set('pp.last', p.id); View.set('pp.tab', 'result'); App.go('p-' + p.id); }
    else if (['yes', 'think', 'no'].includes(act)) { const s = S3.other[act]; People.patch(p.id, {s3: act}, `Итог: ${s.name}`, s.emo); toast(`${s.emo} ${People.name(p)}: ${s.name.toLowerCase()}`); }
    void T;
  });
}

function openTimePicker(p) {
  const d = p.callAt ? new Date(p.callAt) : new Date(Date.now() + 864e5);
  if (!p.callAt) d.setHours(12, 0, 0, 0);
  const local = `${isoOf(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const pref = (p.answers || {}).call || (p.answers || {}).when || '';
  openModal({title: `Созвон: ${People.name(p)}`, body: `
      ${pref ? `<div class="warnline" style="background:var(--violet-soft);color:var(--violet)">В анкете удобно: «${esc(noEmo(Array.isArray(pref) ? pref.join(', ') : pref))}»</div>` : ''}
      <label class="field"><span>Когда</span><input class="input" type="datetime-local" id="tpWhen" value="${local}"></label>
      <div class="chip-row">${[['Завтра 12:00', 1, 12], ['Завтра 19:00', 1, 19], ['Послезавтра 12:00', 2, 12], ['Через неделю', 7, 12]].map(([n, dd, hh]) => `<button class="chip" data-quick="${dd}|${hh}">${n}</button>`).join('')}</div>
      <label class="field"><span>Ссылка на Zoom (необязательно)</span><input class="input" id="tpZoom" value="${esc(p.zoom || '')}" placeholder="https://zoom.us/j/…"></label>`,
    foot: '<button class="btn" data-close>Отмена</button><button class="btn primary" data-ok>Назначить</button>',
    onMount(el, close) {
      on(el, 'click', '[data-quick]', (ev, b) => { const [dd, hh] = b.dataset.quick.split('|').map(Number); const x = new Date(); x.setDate(x.getDate() + dd); x.setHours(hh, 0, 0, 0); $('#tpWhen', el).value = `${isoOf(x)}T${pad(hh)}:00`; });
      $('[data-ok]', el).onclick = () => {
        const v = $('#tpWhen', el).value;
        if (!v) return;
        const ts = new Date(v).getTime();
        People.patch(p.id, {s2: 'set', callAt: ts, zoom: $('#tpZoom', el).value.trim()}, `Созвон назначен на ${when(ts)}`, '📅');
        close();
        toast(`Созвон назначен: ${when(ts)}`);
      };
    }});
}

/* быстро добавить человека: имя, контакт — и сразу ссылка */
function openAdd(type) {
  const T = TYPES[type];
  const extra = type === 'expert' ? `<div class="field"><span>Направление</span><div class="ans" id="adDirs">${DIRECTIONS.map(d => `<button type="button" data-v="${esc(d)}">${esc(noEmo(d))}</button>`).join('')}</div></div>`
    : type === 'partner' ? `<label class="field"><span>Категория</span><select class="select" id="adCat">${PARTNER_CATS.map(c => `<option value="${esc(c)}">${esc(noEmo(c))}</option>`).join('')}</select></label><label class="field"><span>Контактное лицо</span><input class="input" id="adContact" placeholder="Ирина, управляющая"></label>` : '';
  openModal({title: `${T.one}: добавить`, body: `
      <label class="field"><span>${type === 'partner' ? 'Название' : 'Имя'}</span><input class="input" id="adName" placeholder="${type === 'partner' ? 'Студия «Баланс»' : 'Анна Иванова'}"></label>
      <div class="grid2"><label class="field"><span>Telegram или телефон</span><input class="input" id="adTg" placeholder="@username"></label>
      <label class="field"><span>Город</span><input class="input" id="adCity" placeholder="Москва"></label></div>
      ${extra}
      <p class="note">Ссылка на анкету скопируется сама — отправьте её человеку. Ответы попадут в карточку.</p>`,
    foot: '<button class="btn" data-close>Отмена</button><button class="btn" data-only>Просто добавить</button><button class="btn primary" data-ok>Добавить и скопировать ссылку</button>',
    onMount(el, close) {
      on(el, 'click', '#adDirs button', (ev, b) => b.classList.toggle('on'));
      const save = async withLink => {
        const name = $('#adName', el).value.trim();
        if (!name) { $('#adName', el).classList.add('need'); $('#adName', el).focus(); return; }
        const f = {type, name, tg: $('#adTg', el).value.trim(), city: $('#adCity', el).value.trim()};
        if (type === 'expert') f.dirs = $$('#adDirs button.on', el).map(b => b.dataset.v);
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
      const f = View.get(type + '.f', '');
      const everyone = People.all(type);
      let list = everyone;
      if (q) list = list.filter(p => (People.name(p) + ' ' + (p.city || '') + ' ' + (p.code || '') + ' ' + (p.topic || '')).toLowerCase().includes(q));
      if (f) list = list.filter(p => (type === 'expert' ? (p.dirs || []).includes(f) : type === 'partner' ? p.cat === f : true));
      const cols = [1, 2, 3].map(c => list.filter(p => People.col(p) === c));
      const hints = [
        'Отправьте ссылку — человек ответит сам за 3 минуты. Или заполните за него.',
        type === 'client' ? 'Интервью в Zoom, 20–30 минут. Вопросы и заметки — в карточке.' : 'Созвон 30 минут: знакомимся и договариваемся.',
        type === 'client' ? 'Отметьте, что услышали, — это попадёт в статистику.' : 'Запишите решение: подключаем, думает или не сейчас.',
      ];
      const filters = type === 'expert' ? DIRECTIONS.map(d => [d, everyone.filter(p => (p.dirs || []).includes(d)).length])
        : type === 'partner' ? PARTNER_CATS.map(c => [c, everyone.filter(p => p.cat === c).length]).filter(x => x[1])
        : [];
      const canEdit = People.canEdit();

      root.innerHTML = `
        ${pageHead(`${T.emo} ${groupName(type)}`, esc(T.about),
          `<button class="btn" data-stats>${icon('chart')}Статистика</button>${canEdit ? `<button class="btn" data-paste>${icon('inbox')}Вставить ответы</button><button class="btn primary" data-add>${icon('plus')}${type === 'client' ? 'Клиентка' : T.one}</button>` : ''}`)}
        ${!everyone.length ? `<div class="welcome"><span class="e">${T.emo}</span><div><b>Здесь пока никого</b><p>Добавьте первого человека — ссылка на анкету скопируется сама. ${type === 'client' ? 'Для кастдева хватит 10–15 интервью, чтобы увидеть закономерности.' : ''}</p></div></div>` : ''}
        <div class="t-bar"><input class="input sm t-search" id="bq" placeholder="Поиск: имя, город, код" value="${esc(View.get(type + '.q', ''))}"><span class="t-bar-sp"></span>
          <span class="note">${list.length === everyone.length ? `${everyone.length} ${plural(everyone.length, 'человек', 'человека', 'человек')}` : `найдено ${list.length} из ${everyone.length}`}</span></div>
        ${filters.length ? `<div class="chip-row"><button class="chip ${!f ? 'on' : ''}" data-f="">Все</button>${filters.map(([v, c]) => `<button class="chip ${f === v ? 'on' : ''}" data-f="${esc(v)}">${esc(noEmo(v))}<span class="chip-n">${c}</span></button>`).join('')}</div>` : ''}
        <div class="board3">${[0, 1, 2].map(i => `
          <div class="b3-col"><div class="b3-h"><span class="num">${i + 1}</span><b>${T.steps[i]}</b><span class="kb-n">${cols[i].length}</span></div>
            <div class="b3-hint">${esc(hints[i])}</div>
            <div class="b3-list">${cols[i].map(p => { const st = statusLine(p), acts = nextActs(p); return `<div class="pc" data-open="${p.id}">
              <div class="pc-top">${avatar(People.name(p))}<b>${esc(People.name(p))}</b></div>
              ${People.sub(p) || p.ref ? `<div class="pc-sub">${esc(People.sub(p))}${p.ref ? `${People.sub(p) ? ' · ' : ''}<span class="pc-ref">по приглашению</span>` : ''}</div>` : ''}
              ${st ? `<div>${st}</div>` : ''}
              ${acts ? `<div class="pc-acts">${acts}</div>` : ''}
            </div>`; }).join('') || '<p class="note" style="padding:6px 4px">Пусто</p>'}</div>
          </div>`).join('')}</div>`;

      let qt;
      $('#bq', root).oninput = e => { clearTimeout(qt); const v = e.target.value; qt = setTimeout(() => { View.set(type + '.q', v); App.render({focus: 'bq'}); }, 250); };
      on(root, 'click', '[data-f]', (e, el) => { View.set(type + '.f', el.dataset.f); App.render(); });
      on(root, 'click', '[data-add]', () => openAdd(type));
      on(root, 'click', '[data-paste]', () => openPaste());
      on(root, 'click', '[data-stats]', () => { View.set('st.type', type); App.go('stats'); });
      on(root, 'click', '[data-open]', (e, el) => { if (e.target.closest('button')) return; App.go('p-' + el.dataset.open); });
      wireActs(root);
    },
  };
}
Object.keys(TYPES).forEach(type => App.register(type, audiencePage(type)));
