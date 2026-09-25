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
    const row = (q, i, part) => `<div class="qi ${q.hidden ? 'hid' : ''}">
        <span class="n">${i + 1}</span><span class="k" title="${esc(part === 'test' ? KIND_NAME[q.k] : 'Открытый вопрос')}">${part === 'test' ? KIND_EMO[q.k] : '🎤'}</span>
        <div><b>${esc(q.t)}${!defIds.has(q.id) ? ' <span class="pill custom">новый</span>' : ''}${q.hidden ? ' <span class="pill">скрыт</span>' : ''}</b>
          ${part === 'test' && q.o ? `<small>${esc(q.o.join(' · '))}${q.k === 'many' && q.max ? ` · до ${q.max}` : ''}</small>` : ''}
          ${part === 'test' && q.k === 'scale' ? `<small>${SCALE_EMO.join(' ')} · ${esc(q.lo || '')} → ${esc(q.hi || '')}</small>` : ''}
          ${q.why ? `<small>🎯 ${esc(q.why)}</small>` : ''}${q.key ? `<small>↪ заполняет поле карточки</small>` : ''}</div>
        ${canEdit ? `<div class="acts">
          <button class="icon-btn" data-mv="${part}|${i}|-1" title="Выше" ${i ? '' : 'disabled'}>▲</button>
          <button class="icon-btn" data-mv="${part}|${i}|1" title="Ниже" ${i < set[part].length - 1 ? '' : 'disabled'}>▼</button>
          <button class="icon-btn" data-ed="${part}|${i}" title="Изменить">✏️</button>
          <button class="icon-btn" data-hide="${part}|${i}" title="${q.hidden ? 'Показать' : 'Скрыть'}">${q.hidden ? '👁' : '🙈'}</button>
          ${!defIds.has(q.id) ? `<button class="icon-btn" data-rm="${part}|${i}" title="Удалить">🗑</button>` : ''}</div>` : ''}
      </div>`;
    const previewUrl = `${settings().anketaUrl || LINKS.anketa}#${T.letter}.DEMO${Questions.diff(type) ? '.q' + Codec.encJson(Questions.diff(type)) : ''}`;

    root.innerHTML = `
      ${pageHead('❓ База вопросов', 'Анкета — быстрые ответы кнопками: человек заполняет сам по ссылке, из неё собирается статистика. Вопросы для созвона — открытые, для Zoom: из них рождаются инсайты.',
        `<a class="btn" href="${esc(previewUrl)}" target="_blank" rel="noopener">👀 Как видит человек</a><button class="btn" data-copy-all>📋 Скопировать всё</button>`)}
      ${tabsHtml('qs.type', Object.entries(TYPES).map(([k, t]) => [k, `${t.emo} ${t.name}`, Questions.test(k).length + Questions.talk(k).length]), type)}
      <div class="two">
        <section><div class="section-head"><h2>📝 Анкета · ${Questions.test(type).length}</h2>${canEdit ? '<button class="btn sm primary" data-add="test">➕ Вопрос</button>' : ''}</div>
          <p class="note" style="margin-bottom:10px">${T.you === 'ты' ? 'Обращаемся на «ты», как в приложении.' : 'Обращаемся на «вы».'} Держите анкету короткой: 10–15 вопросов, 3 минуты. Вопросы с вариантами дают статистику.</p>
          <div class="ql">${set.test.map((q, i) => row(q, i, 'test')).join('')}</div></section>
        <section><div class="section-head"><h2>🎤 Для созвона · ${Questions.talk(type).length}</h2>${canEdit ? '<button class="btn sm primary" data-add="talk">➕ Вопрос</button>' : ''}</div>
          <p class="note" style="margin-bottom:10px">Спрашивайте про прошлый опыт, а не «купили бы вы». Слушайте больше, чем говорите. 🎯 — зачем вопрос.</p>
          <div class="ql">${set.talk.map((q, i) => row(q, i, 'talk')).join('')}</div></section>
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
      const txt = [`${T.emo} ${T.name} — анкета`, ...Questions.test(type).map((q, i) => `${i + 1}. ${q.t}${q.o ? '\n   ' + q.o.join(' / ') : ''}`), '', `${T.emo} ${T.name} — вопросы для созвона`, ...Questions.talk(type).map((q, i) => `${i + 1}. ${q.t}${q.why ? ` (${q.why})` : ''}`)].join('\n');
      copyOrShow(txt, '📋 Все вопросы скопированы');
    });
  },
});

function openQuestion(type, part, i) {
  const set = Questions.set(type);
  const q = i >= 0 ? clone(set[part][i]) : (part === 'test' ? {id: 'c' + uid().slice(-5), k: 'one', t: '', o: []} : {id: 'tc' + uid().slice(-5), t: '', why: ''});
  const isTest = part === 'test';
  openModal({title: i >= 0 ? '✏️ Вопрос' : '➕ Новый вопрос', wide: true, body: `
      <label class="field"><span>Вопрос</span><textarea class="textarea" id="qT" style="min-height:64px" placeholder="${isTest ? 'Сколько раз в неделю ты занимаешься собой?' : 'Расскажи, как прошла твоя последняя неделя?'}">${esc(q.t)}</textarea><small>Эмодзи приветствуются ✨</small></label>
      ${isTest ? `<div class="field"><span>Как отвечать</span><div class="kinds">${Object.entries(KIND_NAME).map(([k, n]) => `<button type="button" data-k="${k}" class="${q.k === k ? 'on' : ''}">${KIND_EMO[k]} ${n}</button>`).join('')}</div></div>
        <label class="field" id="qOptsF"><span>Варианты — каждый с новой строки</span><textarea class="textarea opt-lines" id="qO" style="min-height:120px" placeholder="🌅 Утром&#10;🌆 Вечером">${esc((q.o || []).join('\n'))}</textarea></label>
        <div class="grid2"><label class="field" id="qMaxF"><span>Сколько можно выбрать</span><input class="input num" id="qMax" value="${q.max || ''}" placeholder="без ограничения"></label>
        <label class="field" id="qPhF"><span>Подсказка в поле</span><input class="input" id="qPh" value="${esc(q.ph || '')}"></label></div>` : `
        <label class="field"><span>🎯 Зачем спрашиваем</span><input class="input" id="qW" value="${esc(q.why || '')}" placeholder="Что хотим понять из ответа"></label>`}`,
    foot: '<button class="btn" data-close>Отмена</button><button class="btn primary" data-ok>Сохранить</button>',
    onMount(el, close) {
      const sync = () => {
        if (!isTest) return;
        const k = ($('.kinds button.on', el) || {}).dataset ? $('.kinds button.on', el).dataset.k : 'one';
        $('#qOptsF', el).hidden = !['one', 'many'].includes(k);
        $('#qMaxF', el).hidden = k !== 'many';
        $('#qPhF', el).hidden = !['short', 'text'].includes(k);
      };
      on(el, 'click', '.kinds button', (e, b) => { $$('.kinds button', el).forEach(x => x.classList.toggle('on', x === b)); sync(); });
      sync();
      $('[data-ok]', el).onclick = () => {
        const t = $('#qT', el).value.trim();
        if (!t) { $('#qT', el).classList.add('need'); return; }
        const out = {...q, t};
        if (isTest) {
          out.k = $('.kinds button.on', el).dataset.k;
          const o = $('#qO', el).value.split('\n').map(x => x.trim()).filter(Boolean);
          if (['one', 'many'].includes(out.k)) {
            if (o.length < 2) { $('#qO', el).classList.add('need'); toast('Нужно хотя бы два варианта'); return; }
            out.o = o;
          } else delete out.o;
          const mx = parseNum($('#qMax', el).value);
          if (out.k === 'many' && mx) out.max = mx; else delete out.max;
          const ph = $('#qPh', el).value.trim();
          if (ph && ['short', 'text'].includes(out.k)) out.ph = ph; else delete out.ph;
          if (out.k === 'scale') { out.lo = out.lo || 'совсем нет'; out.hi = out.hi || 'очень'; }
        } else out.why = $('#qW', el).value.trim();
        const s = clone(set);
        if (i >= 0) s[part][i] = out; else s[part].push(out);
        Questions.save(type, s);
        close();
        toast(isTest ? '✅ Вопрос в анкете — новые ссылки уже с ним' : '✅ Вопрос добавлен');
      };
    }});
}
