/* Карточка человека: три шага крупно, анкета (ответы кнопками), режим
   созвона (вопросы + заметки + ⭐ цитаты), итог и история. Всё сохраняется
   само — кнопки «Сохранить» почти нигде не нужны. */

/* ── анкета кнопками: общая для ручного заполнения ── */
function fillFormHtml(type, answers, prefix = 'fa') {
  return `<div class="fill">${Questions.test(type).map((q, i) => {
    const v = answers[q.id];
    let ctl = '';
    if (q.k === 'one' || q.k === 'many') {
      const sel = answerLabels(q, v);
      ctl = `<div class="ans" data-q="${q.id}" data-k="${q.k}" data-max="${q.max || 0}">${(q.o || []).map(o => `<button type="button" class="${sel.includes(o) ? 'on' : ''}" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
    } else if (q.k === 'scale') {
      ctl = `<div class="scale" data-q="${q.id}" data-k="scale">${SCALE_EMO.map((e, j) => `<button type="button" class="${Number(v) === j + 1 ? 'on' : ''}" data-v="${j + 1}">${e}<small>${j + 1}</small></button>`).join('')}</div>`;
    } else if (q.k === 'text') {
      ctl = `<textarea class="textarea" data-q="${q.id}" data-k="text" placeholder="${esc(q.ph || '')}">${esc(v || '')}</textarea>`;
    } else {
      ctl = `<input class="input" data-q="${q.id}" data-k="short" value="${esc(v || '')}" placeholder="${esc(q.ph || '')}">`;
    }
    return `<div class="fq"><div class="fq-t"><i>${i + 1}</i><span>${esc(q.t)}${q.k === 'many' && q.max ? ` <span class="fq-hint">· до ${q.max}</span>` : ''}</span></div><div class="fq-v">${ctl}</div></div>`;
  }).join('')}</div>`;
}
function wireFill(el) {
  on(el, 'click', '.ans button', (e, b) => {
    const box = b.closest('.ans');
    if (box.dataset.k === 'one') { $$('button', box).forEach(x => x !== b && x.classList.remove('on')); b.classList.toggle('on'); return; }
    const max = Number(box.dataset.max) || 99;
    if (!b.classList.contains('on') && $$('button.on', box).length >= max) { toast(`Можно выбрать до ${max}`); return; }
    b.classList.toggle('on');
  });
  on(el, 'click', '.scale button', (e, b) => { const box = b.closest('.scale'); $$('button', box).forEach(x => x !== b && x.classList.remove('on')); b.classList.toggle('on'); });
}
function readFill(el) {
  const out = {};
  $$('[data-q]', el).forEach(n => {
    const id = n.dataset.q, k = n.dataset.k;
    if (k === 'one') { const b = $('button.on', n); if (b) out[id] = b.dataset.v; }
    else if (k === 'many') { const L = $$('button.on', n).map(b => b.dataset.v); if (L.length) out[id] = L; }
    else if (k === 'scale') { const b = $('button.on', n); if (b) out[id] = Number(b.dataset.v); }
    else { const v = n.value.trim(); if (v) out[id] = v; }
  });
  return out;
}
function answersView(type, answers) {
  const qs = Questions.set(type).test;
  const ids = Object.keys(answers || {});
  if (!ids.length) return '';
  const ordered = [...qs.filter(q => ids.includes(q.id)), ...ids.filter(id => !qs.some(q => q.id === id)).map(id => ({id, t: id, k: 'short'}))];
  return ordered.map((q, i) => {
    const labels = answerLabels(q, answers[q.id]);
    return `<div class="fq"><div class="fq-t"><i>${i + 1}</i><span>${esc(q.t)}${q.hidden ? ' <span class="fq-hint">· скрытый вопрос</span>' : ''}</span></div>
      <div class="fq-v answer-val">${['short', 'text'].includes(q.k) ? `<em>${esc(labels.join(''))}</em>` : labels.map(l => `<span>${esc(l)}</span>`).join('')}</div></div>`;
  }).join('');
}

/* ── таймер созвона: только в этой вкладке ── */
const Timer = {start: 0, id: null, tick(el) { if (!el) return; const s = Math.floor((Date.now() - this.start) / 1000); el.textContent = `⏱ ${Math.floor(s / 60)}:${pad(s % 60)}`; }};

App.register('person', {
  title: id => People.name(People.get(id)),
  render(root, id) {
    const p = People.get(id);
    if (!p) { root.innerHTML = `<a class="back-link" href="#home">${icon('back')}Назад</a><div class="empty"><b>Карточка не найдена 🤷‍♀️</b>Возможно, её удалили.</div>`; return; }
    const T = TYPES[p.type];
    const canEdit = People.canEdit();
    /* режим правки анкеты не переносится на другую карточку */
    if (View.get('pp.last', null) !== p.id) { View.set('pp.last', p.id); View.set('pp.edit', false); View.set('pp.tab', ''); }
    const tab = View.get('pp.tab', '') || (p.s1 === 'done' || p.s1 === 'skip' ? (People.col(p) === 3 ? 'result' : 'talk') : 'anketa');
    const col = People.col(p);
    const invited = People.invited(p);
    const ref = p.ref ? People.byCode(p.ref) : null;
    const tgUrl = p.tg && !/^\+?\d[\d\s()-]+$/.test(p.tg) ? 'https://t.me/' + encodeURIComponent(tgUser(p.tg)) : '';

    /* три шага крупно */
    const box = (n, title, statusHtml, acts, done, cur) => `<div class="b3 ${done ? 'done' : ''} ${cur ? 'cur' : ''}"><div class="b3-t"><span class="step-n">${done ? '✓' : n}</span>${esc(title)}</div><div class="b3-s">${statusHtml}</div><div class="row">${acts}</div></div>`;
    const s1 = S1[p.s1 || 'new'], s2 = S2[p.s2 || 'none'], s3 = s3Map(p.type)[p.s3 || 'none'];
    const steps = `<div class="big3">
      ${box(1, T.steps[0], `${s1.emo} ${esc(s1.name)}${p.answeredAt ? ` <span class="note">· ${when(p.answeredAt)}${p.answeredBy === 'self' ? ', сама' : ''}</span>` : ''}`, col === 1 ? nextActs(p, true) : canEdit ? `<button class="btn xs ghost" data-act="link" data-pid="${p.id}">🔗 Ссылка ещё раз</button>` : '', ['done', 'skip'].includes(p.s1), col === 1)}
      ${box(2, T.steps[1], `${s2.emo} ${esc(s2.name)}${p.callAt && p.s2 === 'set' ? ` <span class="note">· ${when(p.callAt)}</span>` : ''}${p.zoom && p.s2 === 'set' ? ` <a class="note" href="${esc(p.zoom)}" target="_blank" rel="noopener">Zoom ↗</a>` : ''}`, col === 2 ? nextActs(p, true) : '', ['done', 'skip'].includes(p.s2), col === 2)}
      ${box(3, T.steps[2], `${s3.emo} ${esc(s3.name)}`, col === 3 ? nextActs(p, true) : '', People.connected(p), col === 3)}
    </div>`;

    let pane = '';
    if (tab === 'anketa') {
      const edit = View.get('pp.edit', false) || !Object.keys(p.answers || {}).length;
      pane = edit && canEdit
        ? `<p class="note" style="margin-bottom:6px">Заполните за человека — например, по ходу звонка. Или отправьте ссылку: ответы придут сами.</p>
           <div id="fillBox">${fillFormHtml(p.type, p.answers || {})}</div>
           <div class="row" style="margin-top:12px"><button class="btn primary" data-save-fill>✅ Сохранить ответы</button>${Object.keys(p.answers || {}).length ? '<button class="btn ghost" data-cancel-fill>Отмена</button>' : ''}</div>`
        : `<div class="row" style="margin-bottom:6px"><span class="note">${p.answeredBy === 'self' ? '📝 Заполнила сама по ссылке' : '✍️ Заполнено командой'}${p.answeredAt ? ' · ' + when(p.answeredAt) : ''}</span><span class="sp"></span>${canEdit ? '<button class="btn xs" data-edit-fill>✏️ Изменить</button>' : ''}</div>${answersView(p.type, p.answers)}`;
    } else if (tab === 'talk') {
      const qs = Questions.talk(p.type);
      const talk = p.talk || {};
      pane = `<div class="row" style="margin-bottom:10px;align-items:center">
          <span class="note">Задавайте вопросы своими словами, записывайте коротко. ⭐ — яркая цитата, попадёт на главную.</span><span class="sp"></span>
          <span class="timer" id="timer">${Timer.id ? '' : '⏱ 0:00'}</span>
          ${canEdit ? `<button class="btn sm" data-timer>${Timer.id ? '⏸ Стоп' : '▶️ Старт'}</button>` : ''}
          <button class="btn sm ghost" data-copy-q>📋 Вопросы</button>
        </div>
        <div class="talk">${qs.map((q, i) => { const x = talk[q.id] || {}; return `<div class="tq ${x.a ? 'filled' : ''}">
          <div class="tq-h"><i>${i + 1}</i><b>${esc(q.t)}</b>${canEdit ? `<button class="star ${x.star ? 'on' : ''}" data-star="${q.id}" title="Яркая цитата">⭐</button>` : x.star ? '⭐' : ''}</div>
          ${q.why ? `<div class="tq-why">🎯 ${esc(q.why)}</div>` : ''}
          <textarea class="textarea" data-talk="${q.id}" placeholder="Что ответила…" ${canEdit ? '' : 'readonly'}>${esc(x.a || '')}</textarea></div>`; }).join('')}
          <div class="tq"><div class="tq-h"><i>＋</i><b>Что ещё важного прозвучало</b></div><textarea class="textarea" data-talk="_extra" placeholder="Всё, что не попало в вопросы">${esc((talk._extra || {}).a || '')}</textarea></div>
        </div>
        ${canEdit && p.s2 !== 'done' ? `<div class="row" style="margin-top:12px"><button class="btn primary" data-act="done2" data-pid="${p.id}">✅ ${p.type === 'client' ? 'Интервью' : 'Созвон'} прошёл</button></div>` : ''}`;
    } else if (tab === 'result') {
      const res = p.res || {tags: []};
      if (p.type === 'client') {
        pane = `<div class="stack">
          <div class="field"><span>Что услышали — отметьте метки</span><div class="tagpick" data-tags>${INSIGHT_TAGS.map(t => `<button type="button" class="${(res.tags || []).includes(t) ? 'on' : ''}" data-v="${esc(t)}" ${canEdit ? '' : 'disabled'}>${esc(t)}</button>`).join('')}</div></div>
          <label class="field"><span>💡 Главный инсайт — одной фразой</span><textarea class="textarea" data-res="main" placeholder="Например: бросает практики, когда болеет ребёнок — нужен режим «пауза без чувства вины»">${esc(res.main || '')}</textarea></label>
          <label class="field"><span>🛠 Что улучшить в Еве</span><textarea class="textarea" data-res="idea" placeholder="Идеи и просьбы">${esc(res.idea || '')}</textarea></label>
          ${canEdit ? `<div class="row"><button class="btn primary" data-s3="done">💡 Инсайты собраны</button><button class="btn" data-s3="fan">💜 Готова помогать ещё</button></div>` : ''}</div>`;
      } else {
        pane = `<div class="stack">
          <div class="field"><span>Решение</span><div class="row">${Object.entries(S3.other).filter(([k]) => k !== 'none').map(([k, s]) => `<button class="btn ${p.s3 === k ? 'primary' : ''}" data-s3="${k}" ${canEdit ? '' : 'disabled'}>${s.emo} ${esc(s.name)}</button>`).join('')}</div></div>
          <div class="field"><span>О чём договорились</span><div class="tagpick" data-tags>${RESULT_TAGS[p.type].map(t => `<button type="button" class="${(res.tags || []).includes(t) ? 'on' : ''}" data-v="${esc(t)}" ${canEdit ? '' : 'disabled'}>${esc(t)}</button>`).join('')}</div></div>
          <div class="grid2"><label class="field"><span>👉 Следующий шаг</span><input class="input" data-res="next" value="${esc(res.next || '')}" placeholder="${p.type === 'expert' ? 'Съёмка 3 практик' : p.type === 'partner' ? 'Прислать макет стойки' : 'Выдать материалы'}"></label>
          <label class="field"><span>📅 Когда</span><input class="input" type="date" data-res="date" value="${esc(res.date || '')}"></label></div>
          <label class="field"><span>📝 Заметка</span><textarea class="textarea" data-res="note" placeholder="Условия, договорённости, что важно помнить">${esc(res.note || '')}</textarea></label>
          ${p.type === 'amb' ? `<div class="okline">🔗 Реферальная ссылка амбассадора — та же, что и для анкеты. Кто придёт по ней, появится с пометкой «пришла по ссылке ${esc(p.code)}». Пришли: <b>${invited.length}</b></div>` : ''}</div>`;
      }
    } else {
      const log = Object.values(p.log || {}).sort((a, b) => b.t - a.t);
      pane = `<div class="log">${log.map(l => `<div><time>${when(l.t)}</time><span>${esc(l.emo || '•')} ${esc(l.text)}${l.by && Team.get(l.by) ? ` <span class="muted">· ${esc(Team.first(Team.get(l.by)))}</span>` : ''}</span></div>`).join('') || '<p class="note">Пока пусто</p>'}</div>`;
    }

    const talkN = Object.values(p.talk || {}).filter(x => x && x.a).length;
    root.innerHTML = `
      <a class="back-link" href="#${p.type}">${icon('back')}${T.emo} ${T.name}</a>
      <div class="ph"><span class="type-emo">${T.emo}</span>
        <div><h1>${esc(People.name(p))}</h1>
          <div class="ph-sub"><span class="code" title="Уникальный код: анкета и реферальная ссылка">${esc(p.code)}</span>
            ${People.sub(p) ? `<span>${esc(People.sub(p))}</span>` : ''}
            ${p.tg ? (tgUrl ? `<a href="${esc(tgUrl)}" target="_blank" rel="noopener">✈️ @${esc(tgUser(p.tg))}</a>` : `<span>📞 ${esc(p.tg)}</span>`) : ''}
            ${p.contact ? `<span>👤 ${esc(p.contact)}</span>` : ''}
            ${ref ? `<a href="#p-${ref.id}">🔗 пришла от ${esc(People.name(ref))}</a>` : p.ref ? `<span>🔗 по ссылке ${esc(p.ref)}</span>` : ''}
            ${invited.length ? `<span>👭 привела ${invited.length}</span>` : ''}</div></div>
        <div class="ph-acts">${canEdit ? `<button class="btn sm" data-act="link" data-pid="${p.id}">🔗 Ссылка на анкету</button><button class="btn sm" data-edit-person>✏️</button>` : ''}${Who.can('delete') ? `<button class="icon-btn" data-del title="Удалить">${icon('trash')}</button>` : ''}</div>
      </div>
      ${steps}
      <div class="card" style="padding:0;overflow:hidden">
        <div style="padding:0 12px;background:var(--surface-2)">${tabsHtml('pp.tab', [['anketa', '📝 Анкета', Object.keys(p.answers || {}).length || null], ['talk', `🎤 ${p.type === 'client' ? 'Интервью' : 'Созвон'}`, talkN || null], ['result', p.type === 'client' ? '💡 Инсайты' : '🚀 Итог'], ['log', '🕒 История']], tab)}</div>
        <div style="padding:14px 18px">${pane}</div>
      </div>`;

    wireTabs(root);
    wireActs(root);
    const fb = $('#fillBox', root);
    if (fb) wireFill(fb);
    on(root, 'click', '[data-edit-fill]', () => { View.set('pp.edit', true); App.render(); });
    on(root, 'click', '[data-cancel-fill]', () => { View.set('pp.edit', false); App.render(); });
    on(root, 'click', '[data-save-fill]', () => {
      const answers = readFill(fb);
      if (!Object.keys(answers).length) { toast('Отметьте хотя бы один ответ'); return; }
      People.patch(p.id, {answers, s1: 'done', answeredAt: Date.now(), answeredBy: 'team', ...keyPatch(p, p.type, answers)}, 'Анкету заполнила команда', '✍️');
      View.set('pp.edit', false);
      toast('✅ Ответы сохранены');
    });
    /* заметки созвона сохраняются сами */
    let tt = {};
    on(root, 'input', '[data-talk]', (e, el) => {
      clearTimeout(tt[el.dataset.talk]);
      tt[el.dataset.talk] = setTimeout(() => {
        const qid = el.dataset.talk;
        const cur = (People.get(p.id).talk || {})[qid] || {};
        People.patch(p.id, {talk: {[qid]: {...cur, a: el.value, t: Date.now()}}, talkAt: p.talkAt || Date.now()});
        el.closest('.tq').classList.toggle('filled', !!el.value.trim());
      }, 600);
    });
    on(root, 'click', '[data-star]', (e, el) => {
      const qid = el.dataset.star;
      const cur = (p.talk || {})[qid] || {};
      People.patch(p.id, {talk: {[qid]: {...cur, star: !cur.star, t: Date.now()}}});
    });
    on(root, 'click', '[data-copy-q]', () => copyOrShow(Questions.talk(p.type).map((q, i) => `${i + 1}. ${q.t}`).join('\n'), '📋 Вопросы скопированы — можно вставить в заметки Zoom'));
    on(root, 'click', '[data-timer]', () => {
      if (Timer.id) { clearInterval(Timer.id); Timer.id = null; App.render(); return; }
      Timer.start = Date.now();
      Timer.id = setInterval(() => Timer.tick($('#timer')), 1000);
      if (p.s2 !== 'done' && p.s2 !== 'set') People.patch(p.id, {s2: 'set', callAt: Date.now()});
      App.render();
    });
    if (Timer.id) Timer.tick($('#timer', root));
    /* итог */
    on(root, 'click', '[data-tags] button', (e, el) => {
      const res = (People.get(p.id).res) || {tags: []};
      const tags = new Set(res.tags || []);
      if (tags.has(el.dataset.v)) tags.delete(el.dataset.v); else tags.add(el.dataset.v);
      People.patch(p.id, {res: {tags: [...tags]}});
    });
    on(root, 'change', '[data-res]', (e, el) => People.patch(p.id, {res: {[el.dataset.res]: el.value}}));
    on(root, 'click', '[data-s3]', (e, el) => {
      const k = el.dataset.s3, s = s3Map(p.type)[k];
      $$('[data-res]', root).forEach(n => { if (n.value !== ((p.res || {})[n.dataset.res] || '')) People.patch(p.id, {res: {[n.dataset.res]: n.value}}); });
      People.patch(p.id, {s3: k, s2: ['done', 'skip'].includes(p.s2) ? p.s2 : 'done'}, `Итог: ${s.name}`, s.emo);
      toast(`${s.emo} ${s.name}`);
    });
    on(root, 'click', '[data-edit-person]', () => openEditPerson(p));
    on(root, 'click', '[data-del]', async (e, el) => {
      if (!await confirmPop(el, {text: `Удалить ${People.name(p)} со всеми ответами?`, yes: 'Удалить', danger: true})) return;
      Store.remove('people', p.id);
      App.go(p.type);
      toast('Удалено');
    });
  },
});

function openEditPerson(p) {
  const T = TYPES[p.type];
  openModal({title: `✏️ ${People.name(p)}`, body: `
      <label class="field"><span>${p.type === 'partner' ? 'Название' : 'Имя'}</span><input class="input" id="epName" value="${esc(p.name || '')}"></label>
      <div class="grid2"><label class="field"><span>Telegram или телефон</span><input class="input" id="epTg" value="${esc(p.tg || '')}"></label>
      <label class="field"><span>Город</span><input class="input" id="epCity" value="${esc(p.city || '')}"></label></div>
      ${p.type === 'expert' ? `<div class="field"><span>Направления</span><div class="ans" id="epDirs">${DIRECTIONS.map(d => `<button type="button" class="${(p.dirs || []).includes(d) ? 'on' : ''}" data-v="${esc(d)}">${esc(d)}</button>`).join('')}</div></div>
        <label class="field"><span>Тема экспертизы</span><input class="input" id="epTopic" value="${esc(p.topic || (p.answers || {}).topic || '')}"></label>` : ''}
      ${p.type === 'partner' ? `<label class="field"><span>Категория</span><select class="select" id="epCat">${PARTNER_CATS.map(c => `<option ${p.cat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
        <label class="field"><span>Контактное лицо</span><input class="input" id="epContact" value="${esc(p.contact || '')}"></label>` : ''}
      <label class="field"><span>Кто ведёт</span><select class="select" id="epOwner"><option value="">—</option>${Team.all().map(m => `<option value="${m.id}" ${p.owner === m.id ? 'selected' : ''}>${esc(Team.name(m))}</option>`).join('')}</select></label>
      <label class="field"><span>Тип</span><select class="select" id="epType">${Object.entries(TYPES).map(([k, t]) => `<option value="${k}" ${p.type === k ? 'selected' : ''}>${t.emo} ${t.one}</option>`).join('')}</select></label>`,
    foot: '<button class="btn" data-close>Отмена</button><button class="btn primary" data-ok>Сохранить</button>',
    onMount(el, close) {
      on(el, 'click', '#epDirs button', (e, b) => b.classList.toggle('on'));
      $('[data-ok]', el).onclick = () => {
        const d = {name: $('#epName', el).value.trim() || p.name, tg: $('#epTg', el).value.trim(), city: $('#epCity', el).value.trim(), owner: $('#epOwner', el).value || null, type: $('#epType', el).value};
        if ($('#epDirs', el)) { d.dirs = $$('#epDirs button.on', el).map(b => b.dataset.v); d.topic = $('#epTopic', el).value.trim(); }
        if ($('#epCat', el)) { d.cat = $('#epCat', el).value; d.contact = $('#epContact', el).value.trim(); }
        People.patch(p.id, d);
        close();
        void T;
      };
    }});
}
