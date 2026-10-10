/* Карточка человека: три шага крупно, анкета (ответы кнопками), режим
   созвона (вопросы + заметки + звёздочка у яркой цитаты), итог и история.
   Всё сохраняется само — кнопки «Сохранить» почти нигде не нужны. */

/* ── анкета кнопками: общая для ручного заполнения, по разделам ── */
function fillFormHtml(type, answers, prefix = 'fa') {
  let i = 0;
  const one = q => {
    const v = answers[q.id];
    let ctl = '';
    if (q.k === 'one' || q.k === 'many') {
      const sel = answerLabels(q, v);
      const oth = sel.find(x => canonLabel(q, x) === q.other && q.other);
      ctl = `<div class="ans" data-q="${q.id}" data-k="${q.k}" data-max="${q.max || 0}">${(q.o || []).map(o => `<button type="button" class="${sel.some(x => canonLabel(q, x) === plainLabel(o)) ? 'on' : ''}" data-v="${esc(o)}">${esc(noEmo(o))}</button>`).join('')}
        ${q.other ? `<button type="button" class="${oth ? 'on' : ''}" data-v="${esc(q.other)}" data-other>${esc(q.other)}</button><input class="input sm ans-oth" value="${esc(oth ? otherText(q, oth) : '')}" placeholder="Свой вариант" ${oth ? '' : 'hidden'}>` : ''}</div>`;
    } else if (q.k === 'scale') {
      const n = scaleN(q);
      ctl = `<div class="scale num-scale ${n > 5 ? 's10' : ''}" data-q="${q.id}" data-k="scale">${Array.from({length: n}, (_, j) => `<button type="button" class="${Number(v) === j + 1 ? 'on' : ''}" data-v="${j + 1}">${j + 1}</button>`).join('')}<span class="scale-ends">1 — ${esc(q.lo || 'совсем нет')}, ${n} — ${esc(q.hi || 'очень')}</span></div>`;
    } else if (q.k === 'date') {
      ctl = `<input class="input" type="date" data-q="${q.id}" data-k="date" value="${esc(v || '')}" style="max-width:200px">`;
    } else if (q.k === 'text') {
      ctl = `<textarea class="textarea" data-q="${q.id}" data-k="text" placeholder="${esc(q.ph || '')}">${esc(v || '')}</textarea>`;
    } else {
      ctl = `<input class="input" data-q="${q.id}" data-k="short" value="${esc(v || '')}" placeholder="${esc(q.ph || '')}">`;
    }
    return `<div class="fq"><div class="fq-t"><i>${++i}</i><span>${esc(noEmo(q.t))}${q.k === 'many' && q.max ? ` <span class="fq-hint">· до ${q.max}</span>` : ''}</span></div><div class="fq-v">${ctl}</div></div>`;
  };
  return `<div class="fill">${groupByBlock(type, 'test', Questions.test(type)).map(g => `${g.name ? `<h3 class="fill-h">${g.emo ? `<span aria-hidden="true">${g.emo}</span>` : ''}${esc(g.name)}</h3>` : ''}${g.qs.map(one).join('')}`).join('')}</div>`;
}
function wireFill(el) {
  on(el, 'click', '.ans button', (e, b) => {
    const box = b.closest('.ans');
    const oth = $('.ans-oth', box);
    if (box.dataset.k === 'one') { $$('button', box).forEach(x => x !== b && x.classList.remove('on')); b.classList.toggle('on'); }
    else {
      const max = Number(box.dataset.max) || 99;
      if (!b.classList.contains('on') && $$('button.on', box).length >= max) { toast(`Можно выбрать до ${max}`); return; }
      b.classList.toggle('on');
    }
    if (oth) { oth.hidden = !$('[data-other].on', box); if (!oth.hidden && b.hasAttribute('data-other')) oth.focus(); }
  });
  on(el, 'click', '.scale button', (e, b) => { const box = b.closest('.scale'); $$('button', box).forEach(x => x !== b && x.classList.remove('on')); b.classList.toggle('on'); });
}
function readFill(el) {
  const out = {};
  $$('[data-q]', el).forEach(n => {
    const id = n.dataset.q, k = n.dataset.k;
    const label = b => { if (!b.hasAttribute('data-other')) return b.dataset.v; const t = ($('.ans-oth', n) || {}).value || ''; return t.trim() ? `${b.dataset.v}${OTHER_SEP}${t.trim()}` : b.dataset.v; };
    if (k === 'one') { const b = $('button.on', n); if (b) out[id] = label(b); }
    else if (k === 'many') { const L = $$('button.on', n).map(label); if (L.length) out[id] = L; }
    else if (k === 'scale') { const b = $('button.on', n); if (b) out[id] = Number(b.dataset.v); }
    else { const v = n.value.trim(); if (v) out[id] = v; }
  });
  return out;
}

/* ответы старой анкеты, которых нет в новом наборе вопросов */
const LEGACY_Q = {
  client: {age: {id: 'age', k: 'one', t: 'Сколько тебе лет (прошлая анкета)'}, fit: {id: 'fit', k: 'scale', n: 5, t: 'Насколько откликается идея Евы (прошлая анкета)'}},
};
const emptyAns = v => v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);
/* шкала 1–10 полоской: красная — низко, жёлтая — середина, зелёная — хорошо */
function gaugeHtml(v, n = 10) {
  const x = Number(v) || 0, share = x / n;
  return `<span class="gauge ${share <= .4 ? 'lo' : share < .7 ? 'mid' : 'hi'}"><b>${x}</b><small>/${n}</small><i><u style="width:${(share * 100).toFixed(0)}%"></u></i></span>`;
}
function answerValHtml(q, v) {
  if (q.k === 'scale') return gaugeHtml(v, scaleN(q));
  if (q.k === 'date') { const a = ageFromBirth(v); return `<em>${esc(dateLabel(v))}${a !== null ? ` · ${a} ${plural(a, 'год', 'года', 'лет')}` : ''}</em>`; }
  if (['short', 'text'].includes(q.k)) return `<em>${esc(answerLabels(q, v).join(''))}</em>`;
  return answerLabels(q, v).map(l => { const t = otherText(q, l); return `<span class="${t ? 'own' : ''}">${esc(t ? `${q.other}: ${t}` : canonLabel(q, l))}</span>`; }).join('');
}
/* коротко о клиентке — то, что важно увидеть за три секунды */
function portraitHtml(answers) {
  const a = answers || {};
  const Q = id => Questions.find('client', id);
  const lab = id => (emptyAns(a[id]) || !Q(id) ? '' : answerLabels(Q(id), a[id]).map(l => { const t = otherText(Q(id), l); return t || canonLabel(Q(id), l); }).join(', '));
  const age = ageFromBirth(a.birth);
  const country = lab('country');
  const facts = [age !== null ? `${age} ${plural(age, 'год', 'года', 'лет')}` : ageGroupOf(a), [a.city, country && country !== 'Россия' ? country : ''].filter(Boolean).join(', '), lab('status'), lab('job'), lab('stage')].filter(Boolean);
  const gauges = [['energy', 'Энергия'], ['happy', 'Довольна жизнью'], ['health', 'Здоровье']].filter(([id]) => !emptyAns(a[id]));
  const chips = [['Беспокоит', lab('pain')], ['Важнее всего', lab('goal')], ['Время на себя', [lab('time'), lab('when')].filter(Boolean).join(', ').toLowerCase()], ['Готова платить', lab('price')]].filter(x => x[1]);
  if (!facts.length && !gauges.length && !chips.length) return '';
  return `<div class="portrait">
    ${facts.length ? `<div class="pt-facts">${facts.map(f => `<span>${esc(f)}</span>`).join('')}</div>` : ''}
    ${gauges.length ? `<div class="pt-gauges">${gauges.map(([id, l]) => `<div><span>${l}</span>${gaugeHtml(a[id], scaleN(Q(id)))}</div>`).join('')}</div>` : ''}
    ${chips.length ? `<div class="pt-chips">${chips.map(([k, v]) => `<div><span>${k}</span><b>${esc(v)}</b></div>`).join('')}</div>` : ''}
  </div>`;
}
function answersView(type, answers) {
  const qs = Questions.set(type).test;
  const ids = Object.keys(answers || {}).filter(id => !emptyAns(answers[id]));
  if (!ids.length) return '';
  const legacy = LEGACY_Q[type] || {};
  const list = [...qs.filter(q => ids.includes(q.id)), ...ids.filter(id => !qs.some(q => q.id === id)).map(id => legacy[id] || {id, t: id, k: 'short'})];
  const row = q => `<div class="ar"><span class="ar-q">${esc(noEmo(q.t).replace(/\s*Выбери до \S+$/, ''))}${q.hidden ? ' · скрытый вопрос' : ''}</span><div class="ar-v answer-val">${answerValHtml(q, answers[q.id])}</div></div>`;
  return `${type === 'client' ? portraitHtml(answers) : ''}
    <div class="ablocks">${groupByBlock(type, 'test', list).map(g => `<section class="ab"><h3>${g.emo ? `<span aria-hidden="true">${g.emo}</span>` : ''}${esc(g.name || 'Ответы')}<small>${g.qs.length}</small></h3>${g.qs.map(row).join('')}</section>`).join('')}</div>`;
}

/* черновики итога от Claude — только в этом окне, пока не применили */
const Drafts = {};
function draftHtml(p) {
  const d = Drafts[p.id];
  const talkQs = Questions.talk(p.type);
  const head = `<div class="ai-h"><span class="ai-mark">${brandMark()}</span><div><b>Черновик итога от Claude</b><span class="note">по анкете и заметкам созвона — вы проверяете и сохраняете</span></div><span class="sp"></span>
    <button class="btn sm ${d && d.data ? '' : 'primary'}" data-ai ${d && d.loading ? 'disabled' : ''}>${d && d.loading ? 'Claude думает…' : d && d.data ? 'Ещё раз' : 'Разобрать с Claude'}</button></div>`;
  if (!d || (!d.data && !d.err)) return `<div class="ai-box">${head}</div>`;
  if (d.err) return `<div class="ai-box">${head}<p class="warnline" style="margin-top:10px">${esc(d.err)}</p></div>`;
  const x = d.data;
  const rows = p.type === 'client'
    ? [x.main ? ['Главный инсайт', esc(x.main)] : null, x.idea ? ['Что улучшить', esc(x.idea)] : null,
       (x.quotes || []).length ? ['Яркие цитаты', x.quotes.map(id => { const q = talkQs.find(t => t.id === id); const a = ((p.talk || {})[id] || {}).a || ''; return `«${esc(a.length > 140 ? a.slice(0, 140) + '…' : a)}»${q ? ` <span class="note">— ${esc(q.t.slice(0, 60))}…</span>` : ''}`; }).join('<br>')] : null]
    : [x.decision ? ['Решение', esc(S3.other[x.decision].name)] : null, x.next ? ['Следующий шаг', esc(x.next)] : null, x.note ? ['Заметка', esc(x.note)] : null];
  return `<div class="ai-box">${head}
    <div class="ai-rows">${rows.filter(Boolean).map(([k, v]) => `<div><span>${k}</span><div>${v}</div></div>`).join('')}
      ${(x.tags || []).length ? `<div><span>Метки</span><div class="ai-tags">${x.tags.map(t => `<i>${esc(noEmo(t))}</i>`).join('')}</div></div>` : ''}
      ${x.why ? `<div><span>Почему так</span><div class="note">${esc(x.why)}</div></div>` : ''}</div>
    <div class="row" style="margin-top:10px"><button class="btn sm primary" data-ai-apply>Применить — заполнить пустые поля и метки</button><button class="btn sm ghost" data-ai-hide>Скрыть</button></div></div>`;
}

App.register('person', {
  title: id => People.name(People.get(id)),
  render(root, id) {
    const p = People.get(id);
    if (!p) { root.innerHTML = `<a class="back-link" href="#home">${icon('back')}Назад</a><div class="empty"><b>Карточка не найдена</b>Возможно, её удалили.</div>`; return; }
    const T = TYPES[p.type];
    const canEdit = People.canEdit();
    /* режим правки анкеты не переносится на другую карточку */
    if (View.get('pp.last', null) !== p.id) { View.set('pp.last', p.id); View.set('pp.edit', false); View.set('pp.tab', ''); }
    const tab = View.get('pp.tab', '') || (p.s1 === 'done' || p.s1 === 'skip' ? (People.col(p) === 3 ? 'result' : 'talk') : 'anketa');
    const col = People.col(p);
    const invited = People.invited(p);
    const ref = p.ref ? People.byCode(p.ref) : null;
    const tgUrl = p.tg && !/^\+?\d[\d\s()-]+$/.test(p.tg) ? 'https://t.me/' + encodeURIComponent(tgUser(p.tg)) : '';

    /* три шага крупно: номер, название, состояние простым текстом */
    const box = (n, title, statusHtml, acts, done, cur) => `<div class="b3 ${done ? 'done' : ''} ${cur ? 'cur' : ''}"><div class="b3-t"><span class="step-n">${done ? '✓' : n}</span>Шаг ${n} · ${esc(title)}</div><div class="b3-s">${statusHtml}</div>${acts ? `<div class="row">${acts}</div>` : ''}</div>`;
    const s1 = S1[p.s1 || 'new'], s2 = S2[p.s2 || 'none'], s3 = s3Map(p.type)[p.s3 || 'none'];
    const small = t => ` <span class="b3-when">${t}</span>`;
    const steps = `<div class="big3">
      ${box(1, T.steps[0], `${esc(s1.name)}${p.s1 === 'done' && p.answeredAt ? small(`${when(p.answeredAt)} · ${p.answeredBy === 'self' ? 'по ссылке' : 'заполнила команда'}`) : p.s1 === 'sent' && p.sentAt ? small(`ссылка отправлена ${sinceDays(p.sentAt)}`) : ''}`, col === 1 ? nextActs(p, true) : '', ['done', 'skip'].includes(p.s1), col === 1)}
      ${box(2, T.steps[1], `${esc(s2.name)}${p.callAt && p.s2 === 'set' ? small(when(p.callAt)) : ''}${p.zoom && p.s2 === 'set' ? ` <a class="b3-when" href="${esc(p.zoom)}" target="_blank" rel="noopener">Zoom ↗</a>` : ''}`, col === 2 ? nextActs(p, true) : '', ['done', 'skip'].includes(p.s2), col === 2)}
      ${box(3, T.steps[2], esc(s3.name), col === 3 && tab !== 'result' ? nextActs(p, true) : '', People.connected(p), col === 3)}
    </div>`;

    let pane = '';
    if (tab === 'anketa') {
      const edit = View.get('pp.edit', false) || !Object.keys(p.answers || {}).length;
      pane = edit && canEdit
        ? `<p class="note" style="margin-bottom:6px">Заполните за человека — например, по ходу звонка. Или отправьте ссылку: ответы придут сами.</p>
           <div id="fillBox">${fillFormHtml(p.type, p.answers || {})}</div>
           <div class="row" style="margin-top:12px"><button class="btn primary" data-save-fill>Сохранить ответы</button>${Object.keys(p.answers || {}).length ? '<button class="btn ghost" data-cancel-fill>Отмена</button>' : ''}</div>`
        : `<div class="row" style="margin-bottom:6px"><span class="note">${p.answeredBy === 'self' ? 'Заполнено самим человеком по ссылке' : 'Заполнено командой'}${p.answeredAt ? ' · ' + when(p.answeredAt) : ''}</span><span class="sp"></span>${canEdit ? `<button class="btn xs" data-edit-fill>${icon('edit')}Изменить</button>` : ''}</div>${answersView(p.type, p.answers)}`;
    } else if (tab === 'talk') {
      pane = interviewPane(p, canEdit);
    } else if (tab === 'result') {
      const res = p.res || {tags: []};
      const ai = canEdit && (Object.values(p.talk || {}).some(x => x && x.a) || Object.keys(p.answers || {}).length) ? draftHtml(p) : '';
      if (p.type === 'client') {
        pane = `<div class="stack">${ai}
          <div class="field"><span>Что услышали — отметьте</span><div class="tagpick" data-tags>${INSIGHT_TAGS.map(t => `<button type="button" class="${(res.tags || []).includes(t) ? 'on' : ''}" data-v="${esc(t)}" ${canEdit ? '' : 'disabled'}>${esc(noEmo(t))}</button>`).join('')}</div></div>
          <label class="field"><span>Главный инсайт — одной фразой</span><textarea class="textarea" data-res="main" placeholder="Например: бросает практики, когда болеет ребёнок — нужен режим «пауза без чувства вины»">${esc(res.main || '')}</textarea></label>
          <label class="field"><span>Что улучшить в Еве</span><textarea class="textarea" data-res="idea" placeholder="Идеи и просьбы">${esc(res.idea || '')}</textarea></label>
          ${canEdit ? `<div class="row"><button class="btn ${p.s3 === 'done' ? 'primary' : p.s3 === 'fan' ? '' : 'primary'}" data-s3="done">Инсайты собраны</button><button class="btn ${p.s3 === 'fan' ? 'primary' : ''}" data-s3="fan">Готова помогать ещё</button></div>` : ''}</div>`;
      } else {
        pane = `<div class="stack">${ai}
          <div class="field"><span>Решение</span><div class="row">${Object.entries(S3.other).filter(([k]) => k !== 'none').map(([k, s]) => `<button class="btn ${p.s3 === k ? 'primary' : ''}" data-s3="${k}" ${canEdit ? '' : 'disabled'}>${esc(s.name)}</button>`).join('')}</div></div>
          <div class="field"><span>О чём договорились</span><div class="tagpick" data-tags>${RESULT_TAGS[p.type].map(t => `<button type="button" class="${(res.tags || []).includes(t) ? 'on' : ''}" data-v="${esc(t)}" ${canEdit ? '' : 'disabled'}>${esc(noEmo(t))}</button>`).join('')}</div></div>
          <div class="grid2"><label class="field"><span>Следующий шаг</span><input class="input" data-res="next" value="${esc(res.next || '')}" placeholder="${p.type === 'expert' ? 'Съёмка 3 практик' : p.type === 'partner' ? 'Прислать макет стойки' : 'Выдать материалы'}"></label>
          <label class="field"><span>Когда</span><input class="input" type="date" data-res="date" value="${esc(res.date || '')}"></label></div>
          <label class="field"><span>Заметка</span><textarea class="textarea" data-res="note" placeholder="Условия, договорённости, что важно помнить">${esc(res.note || '')}</textarea></label>
          ${p.type === 'amb' ? `<div class="okline">Реферальная ссылка амбассадора — та же, что и для анкеты. Кто придёт по ней, появится с пометкой «по приглашению». Уже пришли: <b>${invited.length}</b></div>` : ''}</div>`;
      }
    } else {
      const log = Object.values(p.log || {}).sort((a, b) => b.t - a.t);
      pane = `<div class="log">${log.map(l => `<div><time>${when(l.t)}</time><span>${esc(noEmo(l.text))}${l.by && Team.get(l.by) ? ` <span class="muted">· ${esc(Team.first(Team.get(l.by)))}</span>` : ''}</span></div>`).join('') || '<p class="note">Пока пусто</p>'}</div>`;
    }

    const talkN = Object.values(p.talk || {}).filter(x => x && x.a).length;
    const tgLink = p.tg ? (tgUrl ? `<a href="${esc(tgUrl)}" target="_blank" rel="noopener">@${esc(tgUser(p.tg))}</a>` : `<span>${esc(p.tg)}</span>`) : '';
    root.innerHTML = `
      <a class="back-link" href="#${p.type}">${icon('back')}${groupName(p.type)}</a>
      <div class="ph"><span class="type-emo" title="${esc(T.one)}">${T.emo}</span>
        <div><h1>${esc(People.name(p))}</h1>
          <div class="ph-sub"><span class="code" title="Личный код: в ссылке на анкету и в реферальной ссылке">${esc(p.code)}</span>
            <span>${esc(T.one)}</span>
            ${People.sub(p) ? `<span>${esc(People.sub(p))}</span>` : ''}
            ${tgLink}
            ${p.evaId ? `<span title="ID в приложении Ева">EVA ID ${esc(p.evaId)}</span>` : ''}
            ${p.contact ? `<span>контакт: ${esc(p.contact)}</span>` : ''}
            ${ref ? `<span>по приглашению <a href="#p-${ref.id}">${esc(People.name(ref))}</a></span>` : p.ref ? `<span>по приглашению ${esc(p.ref)}</span>` : ''}
            ${invited.length ? `<span>по ссылке пришли: ${invited.length}</span>` : ''}</div></div>
        <div class="ph-acts">${canEdit ? `<button class="btn sm" data-act="link" data-pid="${p.id}">${icon('link')}Скопировать ссылку</button><button class="icon-btn" data-edit-person title="Изменить данные">${icon('edit')}</button>` : ''}${Who.can('delete') ? `<button class="icon-btn" data-del title="Удалить">${icon('trash')}</button>` : ''}</div>
      </div>
      ${steps}
      <div class="card" style="padding:0;overflow:clip">
        <div style="padding:0 12px;background:var(--surface-2)">${tabsHtml('pp.tab', [['anketa', 'Анкета', Object.keys(p.answers || {}).length || null], ['talk', p.type === 'client' ? 'Интервью' : 'Созвон', talkN || null], ['result', 'Итог'], ['log', 'История']], tab)}</div>
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
      toast('Ответы сохранены ✅');
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
    on(root, 'click', '[data-copy-q]', () => copyOrShow(Questions.talk(p.type).map((q, i) => `${i + 1}. ${q.t}`).join('\n'), 'Вопросы скопированы — можно вставить в заметки Zoom 📋'));
    if (tab === 'talk') wireInterview(root, p);
    /* черновик итога от Claude */
    on(root, 'click', '[data-ai]', async () => {
      Drafts[p.id] = {loading: true};
      App.render();
      try { Drafts[p.id] = {data: await claudeDraft(People.get(p.id))}; }
      catch (e) { Drafts[p.id] = {err: CLAUDE_ERR[e && e.code] || (e && e.text) || 'Claude не ответил: ' + ((e && e.message) || 'попробуйте ещё раз')}; }
      App.render();
    });
    on(root, 'click', '[data-ai-hide]', () => { delete Drafts[p.id]; App.render(); });
    on(root, 'click', '[data-ai-apply]', () => {
      const x = (Drafts[p.id] || {}).data;
      if (!x) return;
      const cur = People.get(p.id), res = cur.res || {};
      const patch = {tags: [...new Set([...(res.tags || []), ...(x.tags || [])])]};
      ['main', 'idea', 'next', 'note'].forEach(k => { if (x[k] && !String(res[k] || '').trim()) patch[k] = x[k]; });
      const talkPatch = {};
      (x.quotes || []).forEach(id => { talkPatch[id] = {...((cur.talk || {})[id] || {}), star: true}; });
      People.patch(p.id, {res: patch, ...(Object.keys(talkPatch).length ? {talk: talkPatch} : {})}, 'Итог дополнен черновиком Claude', '✨');
      delete Drafts[p.id];
      toast(x.decision ? `Готово. Claude предлагает решение «${S3.other[x.decision].name}» — выберите его кнопкой, если согласны` : 'Готово: поля и метки заполнены, проверьте формулировки');
    });
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
      toast(`${s.name} ${s.emo}`);
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
  openModal({title: People.name(p), body: `
      <label class="field"><span>${p.type === 'partner' ? 'Название' : 'Имя'}</span><input class="input" id="epName" value="${esc(p.name || '')}"></label>
      <div class="grid2"><label class="field"><span>Telegram или телефон</span><input class="input" id="epTg" value="${esc(p.tg || '')}"></label>
      <label class="field"><span>Город</span><input class="input" id="epCity" value="${esc(p.city || '')}"></label></div>
      ${p.type === 'expert' ? `<div class="field"><span>Направления</span><div class="ans" id="epDirs">${DIRECTIONS.map(d => `<button type="button" class="${(p.dirs || []).includes(d) ? 'on' : ''}" data-v="${esc(d)}">${esc(noEmo(d))}</button>`).join('')}</div></div>
        <label class="field"><span>Тема экспертизы</span><input class="input" id="epTopic" value="${esc(p.topic || (p.answers || {}).topic || '')}"></label>` : ''}
      ${p.type === 'partner' ? `<label class="field"><span>Категория</span><select class="select" id="epCat">${PARTNER_CATS.map(c => `<option value="${esc(c)}" ${p.cat === c ? 'selected' : ''}>${esc(noEmo(c))}</option>`).join('')}</select></label>
        <label class="field"><span>Контактное лицо</span><input class="input" id="epContact" value="${esc(p.contact || '')}"></label>` : ''}
      <label class="field"><span>Кто ведёт</span><select class="select" id="epOwner"><option value="">—</option>${Team.all().map(m => `<option value="${m.id}" ${p.owner === m.id ? 'selected' : ''}>${esc(Team.name(m))}</option>`).join('')}</select></label>
      <label class="field"><span>Группа</span><select class="select" id="epType">${Object.keys(TYPES).map(k => `<option value="${k}" ${p.type === k ? 'selected' : ''}>${groupName(k)}</option>`).join('')}</select></label>`,
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
