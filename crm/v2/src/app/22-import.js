/* Ответы, присланные по ссылке. Человек заполнил анкету и нажал
   «Отправить» — менеджер получил в Telegram ссылку вида <CRM>#in.… и открыл
   её (или вставил текст в «Вставить ответы»). Показываем, что пришло,
   и одним нажатием кладём в карточку. */

async function openImport(raw) {
  let pl;
  try { pl = await Codec.unpack(raw); }
  catch (e) { toast('Не получилось прочитать ответы 😕 Попросите прислать ссылку ещё раз', {error: true}); return; }
  showImport(pl);
}
function showImport(pl) {
  const type = TYPE_BY_LETTER[pl.t] || pl.t;
  const T = TYPES[type];
  if (!T) { toast('Непонятная анкета', {error: true}); return; }
  if (pl.m === 'talk') return showTalkImport(pl, type);
  const owner = pl.c ? People.byCode(pl.c) : null;
  const target = owner && !pl.r ? owner : null;
  const name = (pl.a || {}).name || (target ? People.name(target) : 'Новый человек');
  const n = Object.keys(pl.a || {}).length;
  const canEdit = People.canEdit();
  openModal({title: `Ответы: ${name}`, wide: true, body: `
      <div class="${target ? 'okline' : 'warnline'}"><span>${target ? `Анкета «${groupName(type)}» для карточки <b>${esc(People.name(target))}</b> (${esc(target.code)})` : pl.r && owner ? `Новый человек пришёл по ссылке <b>${esc(People.name(owner))}</b> — создадим карточку и отметим, кто пригласил` : `Карточки с кодом ${esc(pl.c || '—')} нет — создадим новую`} · ${n} ${plural(n, 'ответ', 'ответа', 'ответов')}${pl.at ? ` · ${when(pl.at)}` : ''}</span></div>
      <div>${answersView(type, pl.a || {})}</div>`,
    foot: canEdit ? `<button class="btn" data-close>Не сейчас</button><button class="btn primary" data-ok>Сохранить в карточку</button>` : '<button class="btn" data-close>Закрыть</button>',
    onMount(el, close) {
      const ok = $('[data-ok]', el);
      if (ok) ok.onclick = () => {
        const id = Import.apply(pl);
        close();
        toast('Ответы в карточке 📝');
        App.go('p-' + id);
      };
    }});
}
/* ответы интервью: в карточку по коду, а если кода нет (перенесли из файла) — в выбранную карточку */
function showTalkImport(pl, type) {
  const owner = pl.c ? People.byCode(pl.c) : null;
  const a = pl.a || {};
  const qs = Questions.set(type).talk.filter(q => typeof a[q.id] === 'string' && a[q.id].trim());
  const hint = String(pl.n || '').toLowerCase().split(/\s+/)[0];
  const list = People.all(type);
  const guess = owner || list.find(p => hint && People.name(p).toLowerCase().includes(hint)) || null;
  const canEdit = People.canEdit();
  openModal({title: `Ответы интервью${pl.n ? ': ' + pl.n : ''}`, wide: true, body: `
      ${owner ? `<div class="okline"><span>Интервью для карточки <b>${esc(People.name(owner))}</b> · ${qs.length} ${plural(qs.length, 'ответ', 'ответа', 'ответов')}</span></div>`
        : `<label class="field"><span>В какую карточку положить ответы</span><select class="select" id="imWho">${list.map(p => `<option value="${p.id}" ${guess && guess.id === p.id ? 'selected' : ''}>${esc(People.name(p))}${p.city ? ' · ' + esc(p.city) : ''}</option>`).join('')}</select></label>`}
      <div class="im-talk">${qs.map(q => `<div class="tq filled"><div class="tq-h"><b>${esc(q.t)}</b></div><p class="tq-old">${esc(a[q.id])}</p></div>`).join('')}</div>
      <p class="note">Ответы лягут во вкладку «Интервью», карточка перейдёт на шаг «Итог». То, что уже записала команда, не затрётся.</p>`,
    foot: canEdit && (owner || list.length) ? `<button class="btn" data-close>Не сейчас</button><button class="btn primary" data-ok>Сохранить в карточку</button>` : '<button class="btn" data-close>Закрыть</button>',
    onMount(el, close) {
      const ok = $('[data-ok]', el);
      if (ok) ok.onclick = () => {
        const p = owner || People.get($('#imWho', el).value);
        if (!p) return;
        const id = Import.apply({...pl, c: p.code});
        close();
        toast('Ответы интервью в карточке 💬');
        View.set('pp.tab', 'talk');
        App.go('p-' + id);
      };
    }});
}
function openPaste() {
  openModal({title: 'Вставить ответы', body: `
      <p class="note">Вставьте сообщение, которое прислал человек после анкеты, — ссылку целиком или код ответов. Лишний текст не мешает.</p>
      <textarea class="textarea" id="pasteBox" placeholder="Привет! Это мои ответы для Eva 💜 https://claude.ai/…#in.z…" style="min-height:120px"></textarea>`,
    foot: '<button class="btn" data-close>Отмена</button><button class="btn primary" data-ok>Показать ответы</button>',
    onMount(el, close) {
      $('[data-ok]', el).onclick = async () => {
        const raw = Codec.findPayload($('#pasteBox', el).value);
        if (!raw) { $('#pasteBox', el).classList.add('need'); toast('Не вижу ответов в тексте — нужна ссылка с #in.', {error: true}); return; }
        close();
        openImport(raw);
      };
    }});
}
