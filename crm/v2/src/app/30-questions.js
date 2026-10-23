/* База вопросов: для каждой группы — анкета (кнопки, статистика) и
   вопросы для созвона (открытые). Добавлять, править, прятать, менять
   порядок. Изменения анкеты сами уезжают в ссылки — переопубликовывать
   ничего не нужно. */

App.register('questions', {
  title: 'Вопросы',
  render(root) {
    const type = View.get('qs.type', 'client');
    const T = TYPES[type];
    const set = Questions.set(type);
    const canEdit = People.canEdit();
    const defIds = new Set([...Q_DEFAULT[type].test, ...Q_DEFAULT[type].talk].map(q => q.id));
    /* строка вопроса: номер, текст, как отвечать (словами), варианты, действия значками */
    const row = (q, i, part) => `<div class="qi ${q.hidden ? 'hid' : ''}">
        <span class="n">${i + 1}</span>
        <div><b>${esc(q.t)}${!defIds.has(q.id) ? ' <span class="pill custom">новый</span>' : ''}${q.hidden ? ' <span class="pill">скрыт</span>' : ''}</b>
          ${part === 'test' ? `<small><span class="qk">${esc(KIND_NAME[q.k] || '')}${q.k === 'scale' ? ` 1–${scaleN(q)}` : ''}${q.k === 'many' && q.max ? `, до ${q.max}` : ''}${q.other ? ', есть «Другое»' : ''}</span>${q.o ? esc(q.o.map(noEmo).join(' · ')) : q.k === 'scale' ? `1 — ${esc(q.lo || 'совсем нет')}, ${scaleN(q)} — ${esc(q.hi || 'очень')}` : ''}</small>` : ''}
          ${q.why ? `<small>Зачем: ${esc(q.why)}</small>` : ''}${(q.pick || []).length ? `<small>Быстрые метки: ${esc(q.pick.join(' · '))}</small>` : ''}${q.key ? '<small>Ответ сам попадает в карточку</small>' : ''}${qRuleNote(type, q)}</div>
        ${canEdit ? `<div class="acts">
          <button class="icon-btn up" data-mv="${part}|${i}|-1" title="Выше" ${i ? '' : 'disabled'}>${icon('down')}</button>
          <button class="icon-btn" data-mv="${part}|${i}|1" title="Ниже" ${i < set[part].length - 1 ? '' : 'disabled'}>${icon('down')}</button>
          <button class="icon-btn" data-ed="${part}|${i}" title="Изменить">${icon('edit')}</button>
          <button class="icon-btn ${q.hidden ? 'on' : ''}" data-hide="${part}|${i}" title="${q.hidden ? 'Показать снова' : 'Скрыть из анкеты'}">${icon('eye')}</button>
          ${!defIds.has(q.id) ? `<button class="icon-btn" data-rm="${part}|${i}" title="Удалить">${icon('trash')}</button>` : ''}</div>` : ''}
      </div>`;
    /* по разделам, но порядок и кнопки «выше/ниже» — по общему списку */
    const byBlocks = part => groupByBlock(type, part, set[part]).map(g => `${g.name ? `<div class="ql-h">${g.emo ? `<span aria-hidden="true">${g.emo}</span>` : ''}${esc(g.name)}<small>${g.qs.filter(q => !q.hidden).length}</small></div>` : ''}${g.qs.map(q => row(q, set[part].indexOf(q), part)).join('')}`).join('');
    const previewUrl = `${settings().anketaUrl || LINKS.anketa}#${T.letter}.DEMO${Questions.diff(type) ? '.q' + Codec.encJson(Questions.diff(type)) : ''}`;

    root.innerHTML = `
      ${pageHead('База вопросов', 'Два набора на каждую группу. Анкета — ответы кнопками, человек заполняет сам по ссылке, из неё строится статистика. Вопросы для созвона — открытые, для Zoom.',
        `<a class="btn" href="${esc(previewUrl)}" target="_blank" rel="noopener">${icon('eye')}Как видит человек</a><button class="btn" data-copy-all>${icon('copy')}Скопировать всё</button>`)}
      ${tabsHtml('qs.type', Object.keys(TYPES).map(k => [k, groupName(k)]), type)}
      <div class="two">
        <section><div class="section-head"><h2>Анкета <span class="h-n">${Questions.test(type).length} ${plural(Questions.test(type).length, 'вопрос', 'вопроса', 'вопросов')}</span></h2>${canEdit ? `<button class="btn sm primary" data-add="test">${icon('plus')}Вопрос</button>` : ''}</div>
          <p class="note" style="margin-bottom:10px">${T.you === 'ты' ? 'Обращаемся на «ты», как в приложении.' : 'Обращаемся на «вы».'} ${type === 'client' ? 'Анкета разбита на разделы — человек видит, в каком он разделе и сколько осталось. Каждый ответ с вариантами попадает в статистику.' : 'Держите анкету короткой: 10–15 вопросов, 3 минуты.'}</p>
          <div class="ql">${byBlocks('test')}</div></section>
        <section><div class="section-head"><h2>Для созвона <span class="h-n">${Questions.talk(type).length} ${plural(Questions.talk(type).length, 'вопрос', 'вопроса', 'вопросов')}</span></h2><span class="sh-acts"><a class="btn sm" href="${esc(People.talkLink({type, code: 'DEMO'}))}" target="_blank" rel="noopener" title="Эти же вопросы отдельной формой — так их видит человек по ссылке">${icon('eye')}Форма</a>${canEdit ? `<button class="btn sm primary" data-add="talk">${icon('plus')}Вопрос</button>` : ''}</span></div>
          <p class="note" style="margin-bottom:10px">Спрашивайте про прошлый опыт, а не «купили бы вы». Слушайте больше, чем говорите.</p>
          <div class="ql">${byBlocks('talk')}</div></section>
      </div>
      ${Questions.edited(type) && canEdit ? `<p class="note" style="margin-top:14px">Набор изменён — новые ссылки уже несут правки. <button class="link-btn" data-reset>Вернуть стартовый набор</button></p>` : ''}`;

    wireTabs(root);
    const save = s => Questions.save(type, s);
    on(root, 'click', '[data-mv]', (e, el) => { const [part, i, d] = el.dataset.mv.split('|'); const s = clone(set); const a = Number(i), b = a + Number(d); [s[part][a], s[part][b]] = [s[part][b], s[part][a]]; save(s); });
    on(root, 'click', '[data-hide]', (e, el) => { const [part, i] = el.dataset.hide.split('|'); const s = clone(set); s[part][i].hidden = !s[part][i].hidden; if (!s[part][i].hidden) delete s[part][i].hidden; save(s); });
    on(root, 'click', '[data-rm]', async (e, el) => { const [part, i] = el.dataset.rm.split('|'); if (!await confirmPop(el, {text: 'Удалить вопрос? Уже данные ответы останутся в карточках.', yes: 'Удалить', danger: true})) return; const s = clone(set); s[part].splice(Number(i), 1); save(s); });
    on(root, 'click', '[data-ed]', (e, el) => { const [part, i] = el.dataset.ed.split('|'); openQuestion(type, part, Number(i)); });
    on(root, 'click', '[data-add]', (e, el) => openQuestion(type, el.dataset.add, -1));
    on(root, 'click', '[data-reset]', async (e, el) => { if (await confirmPop(el, {text: 'Вернуть стартовые вопросы этой группы? Новые вопросы удалятся.', yes: 'Вернуть', danger: true})) Questions.reset(type); });
    on(root, 'click', '[data-copy-all]', () => {
      const txt = [`${groupName(type)} — анкета`, ...Questions.test(type).map((q, i) => `${i + 1}. ${q.t}${q.o ? '\n   ' + q.o.join(' / ') : ''}`), '', `${groupName(type)} — вопросы для созвона`, ...Questions.talk(type).map((q, i) => `${i + 1}. ${q.t}${q.why ? ` (${q.why})` : ''}`)].join('\n');
      copyOrShow(txt, 'Все вопросы скопированы 📋');
    });
  },
});

/* особые правила вопроса — простыми словами */
function qRuleNote(type, q) {
  const name = id => { const x = Questions.find(type, id); return x ? `«${noEmo(x.t).replace(/\?.*$/, '')}»` : 'другой вопрос'; };
  const notes = [q.auto === 'city' ? 'В анкете не спрашиваем — подставляем по городу; незнакомый город — выбор страны на том же экране' : '',
    q.showIf ? `Показываем, только если в вопросе ${name(q.showIf.id)} выбрано: ${q.showIf.o.length > 3 ? `${q.showIf.o.slice(0, 3).join(', ')} и ещё ${q.showIf.o.length - 3}` : q.showIf.o.join(', ')}` : '',
    q.dep ? `Второй шаг после вопроса ${name(q.dep.id)}: показываем только варианты выбранной сферы` : '',
    q.sh ? 'У каждого деления шкалы — подсказка, цвет от красного к зелёному' : '',
    q.od ? 'У части вариантов — пояснение мелким шрифтом' : ''].filter(Boolean);
  return notes.map(n => `<small>${esc(n)}</small>`).join('');
}
/* варианты в поле редактора; у этапа жизни — по группам, строки «## Группа» */
function optLines(q) {
  if (!q.groups) return (q.o || []).join('\n');
  return q.groups.map((g, gi) => [`## ${g}`, ...(q.o || []).filter((o, j) => q.g[j] === gi)].join('\n')).join('\n');
}
function parseOptLines(q, text) {
  const lines = text.split('\n').map(x => x.trim()).filter(Boolean);
  if (!q.groups) return {o: lines};
  const o = [], g = [];
  let cur = 0;
  for (const l of lines) {
    if (l.startsWith('##')) {
      cur = q.groups.indexOf(l.replace(/^#+\s*/, ''));
      if (cur < 0) return {err: `Нет такой группы: «${l.replace(/^#+\s*/, '')}». Названия групп менять нельзя.`};
    } else { o.push(l); g.push(cur); }
  }
  return {o, g};
}
/* варианты поменялись: подсказки к вариантам (od), советы (rec), группы (g) и старые подписи (alias) — по названию, а не по номеру */
function remapOpts(q, out, o, g) {
  const old = (q.o || []).map(plainLabel);
  const idx = o.map(x => old.indexOf(plainLabel(x)));
  out.o = o;
  if (g) out.g = g;
  if (q.rec) { const r = {}; idx.forEach((j, k) => { if (j >= 0 && q.rec[j]) r[k] = q.rec[j]; }); if (Object.keys(r).length) out.rec = r; else delete out.rec; }
  if (q.od) { const d = {}; o.forEach(x => { if (q.od[plainLabel(x)]) d[plainLabel(x)] = q.od[plainLabel(x)]; }); if (Object.keys(d).length) out.od = d; else delete out.od; }
  if (q.alias) { const keep = new Set(o.map(plainLabel)); const al = {}; Object.entries(q.alias).forEach(([k, v]) => { if (keep.has(v)) al[k] = v; }); out.alias = al; }
}
function openQuestion(type, part, i) {
  const set = Questions.set(type);
  const blocks = Object.entries(((Q_BLOCKS[type] || {})[part]) || {});
  const lastB = (set[part][set[part].length - 1] || {}).b || '';
  const q = i >= 0 ? clone(set[part][i]) : (part === 'test' ? {id: 'c' + uid().slice(-5), k: 'one', t: '', o: [], b: lastB} : {id: 'tc' + uid().slice(-5), t: '', why: '', b: lastB});
  const isTest = part === 'test';
  const blockSel = blocks.length ? `<label class="field"><span>Раздел</span><select class="select" id="qB">${blocks.map(([k, b]) => `<option value="${k}" ${q.b === k ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}<option value="" ${!q.b ? 'selected' : ''}>Дополнительно</option></select></label>` : '';
  openModal({title: i >= 0 ? 'Вопрос' : 'Новый вопрос', wide: true, body: `
      <label class="field"><span>Вопрос</span><textarea class="textarea" id="qT" style="min-height:64px" placeholder="${isTest ? 'Сколько раз в неделю ты занимаешься собой?' : 'Расскажи, как прошла твоя последняя неделя?'}">${esc(q.t)}</textarea><small>${isTest ? 'Этот текст увидит человек в анкете.' : 'Задавайте про прошлый опыт: «когда последний раз…», «как это было».'}</small></label>
      ${blockSel}
      ${isTest ? `<div class="field"><span>Как отвечать</span><div class="kinds">${Object.entries(KIND_NAME).map(([k, n]) => `<button type="button" data-k="${k}" class="${q.k === k ? 'on' : ''}">${n}</button>`).join('')}</div></div>
        <label class="field" id="qOptsF"><span>Варианты — каждый с новой строки</span><textarea class="textarea opt-lines" id="qO" style="min-height:${q.groups ? 260 : 120}px" placeholder="Утром&#10;Вечером">${esc(optLines(q))}</textarea>${q.groups ? '<small>Строки с «##» — группы этапов: вариант попадает в группу, под заголовком которой стоит. Названия групп не меняйте.</small>' : ''}</label>
        <label class="check" id="qOthF"><input type="checkbox" id="qOth" ${q.other ? 'checked' : ''}>Добавить «Другое» со своим ответом — свои ответы видны под графиком</label>
        <div class="grid2" id="qScF"><label class="field"><span>Шкала</span><select class="select" id="qN"><option value="5" ${scaleN(q) === 5 ? 'selected' : ''}>1–5, смайлы</option><option value="10" ${scaleN(q) === 10 ? 'selected' : ''}>1–10, цифры</option></select></label>
          <div class="grid2"><label class="field"><span>Подпись к 1</span><input class="input" id="qLo" value="${esc(q.lo || '')}" placeholder="совсем нет"></label><label class="field"><span>Подпись к максимуму</span><input class="input" id="qHi" value="${esc(q.hi || '')}" placeholder="очень"></label></div></div>
        <div class="grid2"><label class="field" id="qMaxF"><span>Сколько можно выбрать</span><input class="input num" id="qMax" value="${q.max || ''}" placeholder="без ограничения"></label>
        <label class="field" id="qPhF"><span>Подсказка в поле</span><input class="input" id="qPh" value="${esc(q.ph || '')}"></label></div>` : `
        <label class="field"><span>Зачем спрашиваем</span><input class="input" id="qW" value="${esc(q.why || '')}" placeholder="Что хотим понять из ответа"></label>
        <label class="field"><span>Быстрые метки для статистики — каждая с новой строки</span><textarea class="textarea opt-lines" id="qP" style="min-height:80px" placeholder="Например, для «погоды»: Солнечно&#10;Пасмурно&#10;Гроза">${esc((q.pick || []).join('\n'))}</textarea><small>Необязательно. Интервьюер отмечает одну метку кнопкой — она попадает в статистику.</small></label>`}`,
    foot: '<button class="btn" data-close>Отмена</button><button class="btn primary" data-ok>Сохранить</button>',
    onMount(el, close) {
      const sync = () => {
        if (!isTest) return;
        const k = ($('.kinds button.on', el) || {}).dataset ? $('.kinds button.on', el).dataset.k : 'one';
        $('#qOptsF', el).hidden = !['one', 'many'].includes(k);
        $('#qOthF', el).hidden = !['one', 'many'].includes(k);
        $('#qScF', el).hidden = k !== 'scale';
        $('#qMaxF', el).hidden = k !== 'many';
        $('#qPhF', el).hidden = !['short', 'text'].includes(k);
      };
      on(el, 'click', '.kinds button', (e, b) => { $$('.kinds button', el).forEach(x => x.classList.toggle('on', x === b)); sync(); });
      sync();
      $('[data-ok]', el).onclick = () => {
        const t = $('#qT', el).value.trim();
        if (!t) { $('#qT', el).classList.add('need'); return; }
        const out = {...q, t};
        const bs = $('#qB', el);
        if (bs) { if (bs.value) out.b = bs.value; else delete out.b; }
        if (isTest) {
          out.k = $('.kinds button.on', el).dataset.k;
          const parsed = parseOptLines(q, $('#qO', el).value);
          if (parsed.err) { $('#qO', el).classList.add('need'); toast(parsed.err); return; }
          const o = parsed.o;
          if (['one', 'many'].includes(out.k)) {
            if (o.length < 2) { $('#qO', el).classList.add('need'); toast('Нужно хотя бы два варианта'); return; }
            remapOpts(q, out, o, parsed.g);
            if ($('#qOth', el).checked) out.other = q.other || 'Другое'; else delete out.other;
          } else { delete out.o; delete out.other; }
          const mx = parseNum($('#qMax', el).value);
          if (out.k === 'many' && mx) out.max = mx; else delete out.max;
          const ph = $('#qPh', el).value.trim();
          if (ph && ['short', 'text'].includes(out.k)) out.ph = ph; else delete out.ph;
          if (out.k === 'scale') {
            out.lo = $('#qLo', el).value.trim() || 'совсем нет';
            out.hi = $('#qHi', el).value.trim() || 'очень';
            if ($('#qN', el).value === '10') out.n = 10; else delete out.n;
          } else { delete out.lo; delete out.hi; delete out.n; }
          /* подсказки к делениям шкалы — только если число делений не поменялось */
          if (out.sh && (out.k !== 'scale' || out.sh.length !== scaleN(out))) delete out.sh;
        } else {
          out.why = $('#qW', el).value.trim();
          const pk = $('#qP', el).value.split('\n').map(x => x.trim()).filter(Boolean);
          if (pk.length) out.pick = pk; else delete out.pick;
        }
        const s = clone(set);
        if (i >= 0) s[part][i] = out; else s[part].push(out);
        Questions.save(type, s);
        close();
        toast(isTest ? 'Вопрос в анкете — новые ссылки уже с ним ✅' : 'Вопрос сохранён ✅');
      };
    }});
}
