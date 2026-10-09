/* Касания: рассылки (почта, пуш, Telegram, WhatsApp, MAX, SMS) по
   сегментам и условиям, цепочки прогрева, шаблоны и частота касаний.
   Каждое касание записывается в историю клиентки. Без согласия на
   рекламу и без контакта в канале сообщение не уходит — это видно
   до отправки. */

function audienceOf(camp) {
  if (camp.audience && Array.isArray(camp.audience.ids)) return camp.audience.ids.map(id => Clients.get(id)).filter(Boolean);
  const a = camp.audience || {};
  return Clients.all().filter(c => {
    if (a.seg && ((cx(c).segment || {}).id !== a.seg)) return false;
    if (a.rules && a.rules.length && !testRules(a.rules, a.match, c)) return false;
    return true;
  });
}
/* сколько пушей клиентка получила за 7 дней — лимит как в приложении */
function recentPushes(c) { const since = Date.now() - 7 * 864e5; return Ev.list(c).filter(e => e.kind === 'camp' && e.ch === 'push' && e.t >= since).length; }
function audienceCheck(camp) {
  const s = settings();
  const all = audienceOf(camp);
  const res = {all, ok: [], noConsent: 0, noContact: 0, unsub: 0, capped: 0};
  all.forEach(c => {
    const a = allowed(c, camp.ch);
    if (!a.ok) { if (a.why === 'нет контакта') res.noContact++; else if (a.why === 'отписалась') res.unsub++; else res.noConsent++; return; }
    if (camp.ch === 'push' && recentPushes(c) >= s.pushPerWeek) { res.capped++; return; }
    res.ok.push(c);
  });
  return res;
}

App.register('campaigns', {
  title: 'Касания',
  render(root) {
    const tab = View.get('cp.tab', 'camps');
    const camps = Camps.all();
    const canSend = Who.can('campaigns.send') && !Who.readOnly();
    let body = '';
    if (tab === 'camps') {
      body = camps.length ? `<div class="stack">${camps.map(cp => {
        const st = Camps.stats(cp);
        const base = st.total || 0;
        const p = x => (base ? pct(x / base) : '—');
        const statusPill = cp.status === 'draft' ? '<span class="pill">Черновик</span>' : cp.status === 'queued' ? '<span class="pill warn">Ждёт подключения канала</span>' : '<span class="pill good">Отправлена</span>';
        return `<div class="card camp">
          <div><div class="camp-h">${chBadge(cp.ch, true)}<b>${esc(cp.name)}</b>${statusPill}</div>
            <p class="note" style="margin-top:4px">${cp.at ? when(cp.at) : 'не отправлялась'} · ${esc(Team.first(Team.get(cp.by)) || '')}${cp.excluded ? ` · без согласия или контакта: ${cp.excluded}` : ''}</p>
            <p class="soft" style="margin-top:6px;font-size:13px">${esc(fillTemplate(cp.text, null))}</p></div>
          <div class="row">${cp.status === 'draft' && canSend ? `<button class="btn sm" data-edit-camp="${cp.id}">${icon('edit')}Изменить</button>` : ''}<button class="btn sm ghost" data-dup-camp="${cp.id}" ${canSend ? '' : 'hidden'}>${icon('copy')}Копия</button></div>
          ${cp.status !== 'draft' ? `<div class="camp-stats">
            <div><b>${fmt(base)}</b>получили</div><div><b>${p(st.delivered)}</b>доставлено</div><div><b>${p(st.opened)}</b>открыли</div>
            <div><b>${p(st.clicked)}</b>перешли</div><div><b>${fmt(st.replied)}</b>ответили</div><div><b>${fmt(st.unsub)}</b>отписались</div>
            <div><b>${fmt(st.paid)}</b>оплатили за 7 дн.${st.paidSum && Who.can('money.view') ? `<br>${rubK(st.paidSum)}` : ''}</div></div>` : ''}
        </div>`;
      }).join('')}</div>` : '<div class="empty"><b>Рассылок пока нет</b>Создайте первую: выберите канал, аудиторию и текст.</div>';
    } else if (tab === 'seq') {
      const seqs = Cfg.items('sequences');
      body = `<p class="note" style="margin-bottom:12px">Цепочки запускаются сами, когда клиентка попадает на этап или совершает действие. День 0 — сразу, минус — до события (например, за 3 дня до встречи). Работают на сервере рассылок после подключения каналов; здесь — их состав и тексты.</p>
        <div class="stack">${seqs.map(sq => `<div class="card"><div class="card-head"><div><h2>${esc(sq.name)}</h2><p class="note">Запуск: ${esc(sq.trigger)}</p></div>
          <div class="row"><span class="pill ${sq.on ? 'good' : ''}">${sq.on ? 'Включена' : 'Выключена'}</span>${canSend ? `<button class="btn sm" data-seq-toggle="${sq.id}">${sq.on ? 'Выключить' : 'Включить'}</button><button class="btn sm ghost" data-seq-edit="${sq.id}">${icon('edit')}</button>` : ''}</div></div>
          <div class="seq-steps">${(sq.steps || []).map(st => `<div class="seq-step"><b>${st.day > 0 ? `+${st.day} дн.` : st.day < 0 ? `${st.day} дн.` : 'сразу'}</b>${chBadge(st.ch, true)}<span>${esc(st.text)}</span></div>`).join('')}</div></div>`).join('')}</div>`;
    } else if (tab === 'tpl') {
      const tpl = Cfg.items('templates');
      body = `<p class="note" style="margin-bottom:12px">Шаблоны подставляются в сообщение из карточки и из «Сообщений». Переменные: <code>{имя}</code>, <code>{менеджер}</code>, <code>{промокод}</code>, <code>{ссылка}</code>, <code>{цена}</code>.</p>
        <div class="table-wrap"><table class="t"><thead><tr><th>Шаблон</th><th>Канал</th><th>Текст</th><th></th></tr></thead><tbody>
        ${tpl.map(t => `<tr><td><b>${esc(t.name)}</b></td><td>${chBadge(t.ch, true)}</td><td style="white-space:normal">${esc(t.text)}</td><td class="r">${Who.can('funnels.edit') ? `<button class="btn xs ghost" data-tpl="${t.id}">${icon('edit')}</button>` : ''}</td></tr>`).join('')}
        </tbody></table></div>
        ${Who.can('funnels.edit') ? `<button class="btn" style="margin-top:12px" data-tpl="">${icon('plus')}Шаблон</button>` : ''}`;
    } else {
      /* частота: кому писали слишком часто за 7 дней */
      const since = Date.now() - 7 * 864e5;
      const rows = Clients.visible().map(c => {
        const evs = Ev.list(c).filter(e => e.t >= since && ((e.kind === 'msg' && e.dir === 'out') || e.kind === 'camp' || (e.kind === 'call' && e.dir === 'out')));
        return {c, n: evs.length, push: evs.filter(e => e.ch === 'push').length};
      }).filter(r => r.n);
      const dist = [1, 2, 3, 4, 5].map(k => ({name: k === 5 ? '5 и больше' : `${k} ${plural(k, 'касание', 'касания', 'касаний')}`, v: rows.filter(r => (k === 5 ? r.n >= 5 : r.n === k)).length}));
      const over = rows.filter(r => r.n >= 5 || r.push > settings().pushPerWeek).sort((a, b) => b.n - a.n);
      body = `<div class="two">
        <div class="card"><div class="card-head"><h2>Правила частоты</h2></div>
          <ul class="legal"><li>Пуши — не чаще ${settings().pushPerWeek} раз в неделю: итоги в понедельник и напоминание в субботу (как в приложении).</li>
          <li>Ева пишет не чаще 2 раз в день, послание — не чаще раза в день.</li>
          <li>Не больше 5 касаний в неделю на одну клиентку по всем каналам.</li>
          <li>Тихие часы: с 21:00 до 9:00 по времени клиентки — рассылки ждут утра.</li>
          <li>Две тихие недели подряд — один бережный вопрос, не чаще раза в месяц. Не пишем «ты забросила»: вина не возвращает людей.</li></ul></div>
        <div class="card"><div class="card-head"><h2>Касаний за 7 дней на клиентку</h2></div>${hbarList(dist, {color: 'var(--rose)'})}</div>
      </div>
      <section class="section card"><div class="card-head"><h2>Слишком часто</h2><span class="note">5+ касаний за неделю или пушей сверх лимита</span></div>
        ${over.length ? `<div class="task-list">${over.slice(0, 20).map(r => `<div class="task-row">${avatar(Clients.name(r.c))}<div class="tt"><b>${esc(Clients.name(r.c))}</b><br><a href="#client-${r.c.id}">открыть карточку</a></div><span class="${r.n >= 5 ? 'bad' : 'warn'}">${r.n} касаний${r.push ? `, пушей ${r.push}` : ''}</span></div>`).join('')}</div>` : '<div class="okline">Никого не перегружаем.</div>'}
      </section>`;
    }

    root.innerHTML = `
      ${pageHead('Касания', 'Рассылки, пуши и цепочки прогрева. Каждое касание видно в карточке клиентки; без согласия на рассылки и без контакта сообщение не уходит.', canSend ? `<button class="btn primary" data-new-camp>${icon('plus')}Рассылка</button>` : '')}
      ${tabsHtml('cp.tab', [['camps', 'Рассылки', camps.length], ['seq', 'Цепочки прогрева', Cfg.items('sequences').length], ['tpl', 'Шаблоны', Cfg.items('templates').length], ['freq', 'Частота касаний']], tab)}
      ${body}`;

    wireTabs(root);
    on(root, 'click', '[data-new-camp]', () => openCampaignForm(null));
    on(root, 'click', '[data-edit-camp]', (e, el) => openCampaignForm(el.dataset.editCamp));
    on(root, 'click', '[data-dup-camp]', (e, el) => { const cp = Store.get('campaigns', el.dataset.dupCamp); const id = Store.add('campaigns', {name: cp.name + ' (копия)', ch: cp.ch, text: cp.text, audience: cp.audience && !cp.audience.ids ? cp.audience : {match: 'all', rules: []}, status: 'draft', createdAt: Date.now(), by: Who.id()}); openCampaignForm(id); });
    on(root, 'click', '[data-seq-toggle]', (e, el) => { const sq = Cfg.list('sequences')[el.dataset.seqToggle]; Cfg.save('sequences', el.dataset.seqToggle, {...sq, on: !sq.on}); });
    on(root, 'click', '[data-seq-edit]', (e, el) => openSequenceForm(el.dataset.seqEdit));
    on(root, 'click', '[data-tpl]', (e, el) => openTemplateForm(el.dataset.tpl));
  },
});

function openCampaignForm(id, preset = {}) {
  const cp = id ? Store.get('campaigns', id) : null;
  const state = {
    name: cp ? cp.name : preset.ids ? `Рассылка для ${preset.ids.length} выбранных` : '',
    ch: cp ? cp.ch : 'tg', text: cp ? cp.text : '',
    rules: cp && cp.audience && cp.audience.rules ? clone(cp.audience.rules) : [], match: (cp && cp.audience && cp.audience.match) || 'all',
    seg: (cp && cp.audience && cp.audience.seg) || '', ids: preset.ids || (cp && cp.audience && cp.audience.ids) || null,
  };
  const body = `<div class="grid2">
      <label class="field"><span>Название</span><input class="input" id="cpName" value="${esc(state.name)}" placeholder="Октябрьский запуск"></label>
      <label class="field"><span>Канал</span><select class="select" id="cpCh">${MASS_CH.map(ch => opt(ch, CHANNELS[ch].name, state.ch)).join('')}</select></label>
    </div>
    ${state.ids ? `<p class="note">Аудитория: <b>${state.ids.length}</b> выбранных в таблице клиенток.</p>` : `<div class="field"><span>Аудитория</span>
      <select class="select" id="cpSeg">${opt('', 'Все клиентки, подходящие под условия', state.seg)}${Segments.all().map(s => opt(s.id, 'Сегмент: ' + s.name, state.seg)).join('')}</select></div>
      <div id="cpRules">${rulesEditorHtml(state.rules, state.match)}</div>`}
    <label class="field"><span>Текст</span><textarea class="textarea" id="cpText" placeholder="{имя}, …">${esc(state.text)}</textarea><small>Переменные: {имя}, {промокод}, {ссылка}, {цена}. Первое предложение — главное: его видно в уведомлении.</small></label>
    <div id="cpCheck"></div>`;
  openModal({title: cp ? 'Рассылка' : 'Новая рассылка', wide: true, body,
    foot: `<button class="btn ghost left" data-close>Отмена</button><button class="btn" data-draft>Сохранить черновик</button><button class="btn primary" data-send>Отправить</button>`,
    onMount(el, close) {
      const draft = () => ({name: $('#cpName', el).value.trim() || 'Без названия', ch: $('#cpCh', el).value, text: $('#cpText', el).value.trim(),
        audience: state.ids ? {ids: state.ids} : {seg: ($('#cpSeg', el) || {}).value || '', rules: state.read ? state.read() : state.rules, match: state.match}});
      const check = () => {
        const d = draft();
        const r = audienceCheck(d);
        const sample = r.ok[0];
        $('#cpCheck', el).innerHTML = `<div class="${r.ok.length ? 'okline' : 'warnline'}">${icon('users')}<span>Получат: <b>${r.ok.length}</b> из ${r.all.length}${r.noConsent ? ` · без согласия на рассылки ${r.noConsent}` : ''}${r.unsub ? ` · отписались ${r.unsub}` : ''}${r.noContact ? ` · нет контакта в канале ${r.noContact}` : ''}${r.capped ? ` · уже получили ${settings().pushPerWeek} пуша за неделю ${r.capped}` : ''}</span></div>
          ${sample && d.text ? `<p class="note" style="margin-top:8px">Как увидит ${esc(Clients.name(sample).split(' ')[0])}:</p><div class="bub out" style="max-width:100%">${esc(fillTemplate(d.text, sample))}</div>` : ''}
          ${!Inbox.live(d.ch) ? `<p class="note" style="margin-top:8px">Канал «${esc(CHANNELS[d.ch].name)}» ещё не подключён: рассылка встанет в очередь и уйдёт после подключения в «Настройках → Интеграции». В карточках она будет видна со статусом «В очереди».</p>` : ''}`;
      };
      if (!state.ids) wireRulesEditor($('#cpRules', el), state, check);
      el.addEventListener('input', () => { clearTimeout(el._t); el._t = setTimeout(check, 200); });
      el.addEventListener('change', () => check());
      check();
      $('[data-draft]', el).onclick = () => {
        const d = draft();
        if (cp) Store.patch('campaigns', cp.id, {...d, audience: d.audience}); else Store.add('campaigns', {...d, status: 'draft', createdAt: Date.now(), by: Who.id()});
        close();
        toast('Черновик сохранён');
      };
      $('[data-send]', el).onclick = async e => {
        const d = draft();
        if (!d.text) { $('#cpText', el).classList.add('need'); $('#cpText', el).focus(); return; }
        const r = audienceCheck(d);
        if (!r.ok.length) { toast('Некому отправить: проверьте аудиторию и согласия', {error: true}); return; }
        if (!await confirmPop(e.currentTarget, {text: `Отправить ${r.ok.length} ${plural(r.ok.length, 'клиентке', 'клиенткам', 'клиенткам')}?`, yes: 'Отправить'})) return;
        const live = Inbox.live(d.ch);
        const cid = cp ? cp.id : uid();
        const now = Date.now();
        Store.put('campaigns', cid, {...(cp || {}), ...d, audience: state.ids ? {ids: state.ids} : d.audience, status: live ? 'sent' : 'queued', at: now, createdAt: (cp && cp.createdAt) || now, by: Who.id(), excluded: r.all.length - r.ok.length, sent: r.ok.length});
        let n = 0;
        for (const c of r.ok) {
          Ev.add('clients', c.id, {kind: 'camp', camp: cid, ch: d.ch, status: live ? 'sent' : 'queued', text: d.name});
          if (++n % 25 === 0) await new Promise(res => setTimeout(res, 20));
        }
        close();
        Sel.clear();
        toast(live ? `Отправлено: ${n}` : `В очереди: ${n}. Уйдёт после подключения канала`);
        App.go('campaigns');
      };
    }});
}

function openTemplateForm(id) {
  const t = id ? Cfg.list('templates')[id] : null;
  openModal({title: t ? 'Шаблон' : 'Новый шаблон', body: `<div class="grid2"><label class="field"><span>Название</span><input class="input" id="tpName" value="${esc(t ? t.name : '')}"></label>
      <label class="field"><span>Канал</span><select class="select" id="tpCh">${MSG_CH.map(ch => opt(ch, CHANNELS[ch].name, t ? t.ch : 'tg')).join('')}</select></label></div>
      <label class="field"><span>Текст</span><textarea class="textarea" id="tpText">${esc(t ? t.text : '')}</textarea><small>{имя}, {менеджер}, {промокод}, {ссылка}, {цена}</small></label>`,
    foot: `${t ? '<button class="btn danger left" data-del>Удалить</button>' : ''}<button class="btn" data-close>Отмена</button><button class="btn primary" data-ok>Сохранить</button>`,
    onMount(el, close) {
      $('[data-ok]', el).onclick = () => { const name = $('#tpName', el).value.trim(); if (!name) { $('#tpName', el).classList.add('need'); return; } Cfg.save('templates', id || 'tp' + uid().slice(-5), {name, ch: $('#tpCh', el).value, text: $('#tpText', el).value.trim()}); close(); };
      const del = $('[data-del]', el);
      if (del) del.onclick = async () => { if (await confirmPop(del, {text: 'Удалить шаблон?', yes: 'Удалить', danger: true})) { Cfg.drop('templates', id); close(); } };
    }});
}

function openSequenceForm(id) {
  const sq = clone(Cfg.list('sequences')[id]);
  const stepRow = (st, i) => `<div class="rule" data-i="${i}" style="grid-template-columns:90px 130px minmax(0,1fr) 32px"><input class="input num" data-k="day" value="${st.day}" title="День"><select class="select" data-k="ch">${MASS_CH.map(ch => opt(ch, CHANNELS[ch].name, st.ch)).join('')}</select><input class="input" data-k="text" value="${esc(st.text)}"><button class="icon-btn" data-rm="${i}">${icon('x')}</button></div>`;
  openModal({title: sq.name, wide: true, body: `<label class="field"><span>Название</span><input class="input" id="sqName" value="${esc(sq.name)}"></label>
      <label class="field"><span>Когда запускается</span><input class="input" id="sqTrig" value="${esc(sq.trigger)}"></label>
      <div class="field"><span>Шаги: день, канал, текст</span><div class="rules" id="sqSteps">${sq.steps.map(stepRow).join('')}</div></div>
      <button class="btn sm" data-add style="align-self:flex-start">${icon('plus')}Шаг</button>`,
    foot: '<button class="btn" data-close>Отмена</button><button class="btn primary" data-ok>Сохранить</button>',
    onMount(el, close) {
      const read = () => $$('#sqSteps .rule', el).map(r => ({day: parseNum($('[data-k="day"]', r).value), ch: $('[data-k="ch"]', r).value, text: $('[data-k="text"]', r).value}));
      on(el, 'click', '[data-add]', () => { sq.steps = read(); sq.steps.push({day: (sq.steps.length ? sq.steps[sq.steps.length - 1].day : 0) + 2, ch: 'tg', text: ''}); $('#sqSteps', el).innerHTML = sq.steps.map(stepRow).join(''); });
      on(el, 'click', '[data-rm]', (e, b) => { sq.steps = read(); sq.steps.splice(Number(b.dataset.rm), 1); $('#sqSteps', el).innerHTML = sq.steps.map(stepRow).join(''); });
      $('[data-ok]', el).onclick = () => { Cfg.save('sequences', id, {...sq, name: $('#sqName', el).value.trim() || sq.name, trigger: $('#sqTrig', el).value.trim(), steps: read().filter(s => s.text.trim())}); close(); };
    }});
}
