/* Карточка: всё о человеке на одной странице. Общие части — этапы,
   лента касаний, композер (сообщение, звонок, заметка, задача, оплата,
   встреча) — работают и для клиенток, и для экспертов, и для партнёров. */

/* ── этапы стрелками ── */
function stepperHtml(col, e, canEdit) {
  const fid = Funnels.of(col, e);
  const f = Funnels.get(fid);
  if (!f) return '';
  const cur = f.stages.findIndex(s => s.id === e.stage);
  return `<div class="stepper" role="group" aria-label="Этап воронки «${esc(f.name)}»">
    ${f.stages.map((s, i) => `<button class="step ${i < cur && e.stage !== 'lost' ? 'past' : ''} ${i === cur ? 'cur' : ''} ${s.won ? 'won' : ''}" data-step="${s.id}" ${canEdit ? '' : 'disabled'} title="${esc(s.about || '')}">${esc(s.name)}${i === cur && e.stageAt ? `<small>${cx0(e).stageDays} дн.</small>` : ''}</button>`).join('')}
    <button class="step lost ${e.stage === 'lost' ? 'cur' : ''}" data-step="lost" ${canEdit ? '' : 'disabled'} title="${e.stage === 'lost' ? esc(e.lostReason || '') : 'Отказ с причиной'}">${e.stage === 'lost' ? `Отказ: ${esc(e.lostReason || '')}` : 'Отказ'}</button>
  </div>`;
}
/* для экспертов и партнёров — только дни на этапе */
const cx0 = e => ({stageDays: e.stageAt ? daysBetween(isoTs(e.stageAt), today()) : 0});
function wireStepper(root, col, e) {
  on(root, 'click', '[data-step]', async (ev, el) => {
    const to = el.dataset.step;
    if (to === e.stage) return;
    let reason = '';
    if (to === 'lost') { reason = await pickPop(el, LOST_REASONS.map(r => [r, r]), ''); if (reason === null) return; }
    moveStage(col, e.id, to, {reason});
    toast(`Этап: ${(Funnels.stage(Funnels.of(col, e), to) || {}).name}`);
  });
}

/* ── лента ── */
const EV_ICON = {msg: 'msg', call: 'phone', camp: 'send', pay: 'card', note: 'note', task: 'check', stage: 'arrow', meet: 'cal', sys: 'db', group: 'users'};
function evItemHtml(col, ent, e, opts = {}) {
  const who = e.by ? Team.get(e.by) : null;
  const whoN = who ? esc(Team.first(who)) : '';
  const time = `<time title="${esc(new Date(e.t).toLocaleString('ru-RU'))}">${hm(e.t)}</time>`;
  const canEdit = opts.canEdit;
  const del = canEdit && ['note', 'task', 'call', 'meet'].includes(e.kind) && !e.demoLocked ? `<button class="icon-btn tl-del" data-ev-del="${e.id}" title="Удалить запись">${icon('trash')}</button>` : '';
  let body = '';
  switch (e.kind) {
    case 'msg': {
      const st = e.dir === 'out' ? (e.status === 'saved' ? '<span class="saved">не отправлено: канал не подключён</span>' : e.status === 'queued' ? 'в очереди' : 'отправлено') : '';
      body = `<div class="tl-h">${chBadge(e.ch, true)}<b>${e.dir === 'in' ? esc(entName(col, ent).split(' ')[0]) : whoN || 'Менеджер'}</b>${e.dir === 'in' ? 'написала' : 'ответила'} ${time}</div>
        <div class="bub ${e.dir}" style="align-self:${e.dir === 'out' ? 'flex-start' : 'flex-start'}">${esc(e.text)}${st ? `<div class="bub-meta">${st}</div>` : ''}</div>`;
      break;
    }
    case 'call': {
      const res = CALL_RESULTS[e.result] || e.result;
      body = `<div class="tl-h"><b>${e.dir === 'in' ? 'Входящий звонок' : 'Исходящий звонок'}</b>${whoN ? '· ' + whoN : ''} · <span class="${e.result === 'ok' ? 'good' : 'warn'}">${esc(res)}</span>${e.dur ? ` · ${dur(e.dur)}` : ''} ${time}${del}</div>
        ${e.result === 'ok' && e.dur ? `<div class="call-card">${recPlayer(e)}${e.text ? `<div class="tl-t">${esc(e.text)}</div>` : ''}</div>` : e.text ? `<div class="tl-t">${esc(e.text)}</div>` : ''}`;
      break;
    }
    case 'camp':
      body = `<div class="tl-h">${chBadge(e.ch, true)}<b>Рассылка</b>«${esc(e.text || '')}» · <span class="${['opened', 'clicked', 'replied'].includes(e.status) ? 'good' : e.status === 'unsub' || e.status === 'failed' ? 'bad' : ''}">${esc(CAMP_STATUS[e.status] || e.status)}</span> ${time}</div>`;
      break;
    case 'pay': {
      const pt = PAY_TYPES[e.type] || {name: e.type === 'payout' ? 'Выплата' : e.type};
      const ps = PAY_STATUS[e.status] || {name: e.status, tone: ''};
      const amount = e.amount ? rub(e.type === 'refund' ? -e.amount : e.amount) : (e.status === 'pending' ? 'сумма в ссылке' : '');
      body = `<div class="tl-h"><b>${esc(amount)}</b>${esc(pt.name)}${e.item ? ` · ${esc(e.item)}` : ''} · <span class="pill ${ps.tone}">${esc(ps.name)}</span>${e.method ? ` · ${esc(PAY_METHODS[e.method] || e.method)}` : ''}${e.bonusUsed ? ` · бонусами ${rub(e.bonusUsed)}` : ''} ${time}</div>
        ${e.text ? `<div class="tl-sys">${esc(e.text)}</div>` : ''}
        ${e.status === 'pending' && canEdit && col === 'clients' ? `<div class="tl-act"><button class="btn xs good" data-pay-ok="${e.id}">${icon('tick')}Оплачено</button><button class="btn xs" data-pay-fail="${e.id}">Не прошла</button></div>` : ''}`;
      break;
    }
    case 'note':
      body = `<div class="tl-h"><b>Заметка</b>${whoN ? '· ' + whoN : ''} ${time}${del}</div><div class="tl-note">${esc(e.text)}</div>`;
      break;
    case 'task': {
      const late = !e.done && e.due && e.due < today();
      body = `<div class="tl-h"><button class="t-check ${e.done ? 'done' : ''}" data-ev-task="${e.id}" ${canEdit ? '' : 'disabled'} aria-label="Готово">${icon('tick')}</button><b style="${e.done ? 'text-decoration:line-through;color:var(--ink-3)' : ''}">${esc(e.title)}</b>
        <span class="due ${late ? 'late' : ''}">${e.due ? 'срок ' + dayOrWhen(e.due) : ''}</span>${e.who ? `· ${esc(Team.first(Team.get(e.who)))}` : ''} ${time}${del}</div>`;
      break;
    }
    case 'stage': {
      const fid = e.funnel || Funnels.of(col, ent);
      const nm = s => (s ? (Funnels.stage(fid, s) || {name: s}).name : '—');
      body = `<div class="tl-sys">${e.auto ? 'Автоматически' : whoN || 'Этап'}: ${esc(nm(e.from))} → <b>${esc(nm(e.to))}</b>${e.text ? ` · ${esc(e.text)}` : ''} · ${time}</div>`;
      break;
    }
    case 'group':
      body = `<div class="tl-h">${chBadge('group', true)}<b>${esc(e.chatName)}</b>${time}</div><div class="bub in">${esc(e.text)}</div>`;
      break;
    default:
      body = `<div class="tl-sys">${e.ch ? chBadge(e.ch) : ''}${esc(e.text || EV_KINDS[e.kind] && EV_KINDS[e.kind].name || '')}${whoN ? ` · ${whoN}` : ''} · ${time}${del}</div>`;
  }
  const small = ['stage', 'sys'].includes(e.kind);
  return `<div class="tl-i ${small ? 'small' : ''}"><span class="tl-ico ${e.kind}">${icon(EV_ICON[e.kind] || 'msg')}</span><div class="tl-b">${body}</div></div>`;
}
function timelineHtml(col, ent, events, canEdit) {
  if (!events.length) return '<div class="empty"><b>Пока пусто</b>Здесь появятся сообщения, звонки, рассылки и оплаты.</div>';
  let last = '', html = '';
  events.slice().sort((a, b) => b.t - a.t).forEach(e => {
    const d = isoTs(e.t);
    if (d !== last) { html += `<div class="tl-day">${d === today() ? 'Сегодня' : d === addDays(today(), -1) ? 'Вчера' : cap(dayWd(d))}${d.slice(0, 4) !== today().slice(0, 4) ? ' ' + d.slice(0, 4) : ''}</div>`; last = d; }
    html += evItemHtml(col, ent, e, {canEdit});
  });
  return `<div class="tl">${html}</div>`;
}
function wireTimeline(root, col, ent) {
  on(root, 'click', '[data-ev-task]', (e, el) => { const x = (ent.ev || {})[el.dataset.evTask]; Tasks.done(col, ent.id, el.dataset.evTask, !(x && x.done)); });
  on(root, 'click', '[data-ev-del]', async (e, el) => { if (await confirmPop(el, {text: 'Удалить запись из истории?', yes: 'Удалить', danger: true})) Ev.del(col, ent.id, el.dataset.evDel); });
  on(root, 'click', '[data-pay-ok]', (e, el) => { Pay.markPaid(ent.id, el.dataset.payOk); toast('Оплата отмечена — клиентка перешла в «Оплата получена»'); });
  on(root, 'click', '[data-pay-fail]', (e, el) => Ev.set(col, ent.id, el.dataset.payFail, {status: 'fail'}));
}

/* ── композер ── */
const COMP_MODES = {msg: 'Сообщение', call: 'Звонок', note: 'Заметка', task: 'Задача', pay: 'Оплата', meet: 'Встреча'};
function composerHtml(col, ent, mode) {
  const modes = Object.keys(COMP_MODES).filter(m => col === 'clients' || m !== 'pay').concat(col !== 'clients' ? ['payout'] : []);
  const label = m => (m === 'payout' ? 'Выплата' : COMP_MODES[m]);
  const tpl = Cfg.items('templates');
  let inner = '';
  if (mode === 'msg') {
    const groups = col === 'clients' ? Chats.memberOf(ent) : [];
    const contactOf = ch => (col === 'clients' ? Clients.contactFor(ent, ch) : ch === 'tg' ? (ent.tg ? '@' + tgUser(ent.tg) : '') : ch === 'email' ? ent.email || '' : phoneFmt(ent.phone));
    const chOpts = MSG_CH.map(ch => [ch, `${CHANNELS[ch].name} · ${contactOf(ch) || 'нет контакта'}`]);
    const lastMsg = Ev.list(ent).filter(x => x.kind === 'msg').pop();
    const lastCh = lastMsg ? lastMsg.ch : 'tg';
    inner = `<div class="comp-row">
        <select class="select" id="cmCh">${chOpts.map(([v, n]) => opt(v, n, lastCh)).join('')}${groups.map(g => opt('group:' + g.id, `В групповой чат «${g.name.split(' · ')[0]}»`, '')).join('')}</select>
        ${tpl.length ? `<select class="select" id="cmTpl">${opt('', 'Шаблон…', '')}${tpl.map(t => opt(t.id, t.name, '')).join('')}</select>` : ''}
      </div>
      <textarea class="textarea" id="cmText" placeholder="Текст сообщения. Ctrl+Enter — отправить"></textarea>
      <div class="comp-foot"><span class="note" id="cmNote">${Inbox.live('tg') ? '' : 'Мессенджеры пока не подключены: сообщение сохранится в истории. Чтобы оно ушло, откройте чат по ссылке или подключите канал в «Настройках → Интеграции».'}</span>
        ${col === 'clients' && ent.tg ? `<a class="btn sm" href="${esc(Clients.chatUrl(ent, 'tg'))}" target="_blank" rel="noopener">${icon('ext')}Telegram</a>` : ''}
        ${col === 'clients' && (ent.wa || ent.phone) ? `<a class="btn sm" href="${esc(Clients.chatUrl(ent, 'wa'))}" target="_blank" rel="noopener">${icon('ext')}WhatsApp</a>` : ''}
        <button class="btn primary sm" data-cm-send>${icon('send')}Отправить</button></div>`;
  } else if (mode === 'call') {
    inner = `<div class="comp-row">
        <div class="seg" id="cmDir"><button data-v="out" class="on">Исходящий</button><button data-v="in">Входящий</button></div>
        <select class="select" id="cmRes">${Object.entries(CALL_RESULTS).map(([k, n]) => opt(k, n, 'ok')).join('')}</select>
        <input class="input" id="cmDur" placeholder="Длительность, мин" inputmode="decimal" style="max-width:150px">
      </div>
      <textarea class="textarea" id="cmText" placeholder="О чём договорились. Итог звонка"></textarea>
      <div class="comp-row"><input class="input" id="cmRec" placeholder="Ссылка на запись разговора из телефонии (необязательно)">
        <label class="check"><input type="checkbox" id="cmNext">Перезвонить</label><input class="input" type="date" id="cmNextD" value="${addDays(today(), 1)}" style="max-width:160px"></div>
      <div class="comp-foot"><span class="note">После подключения телефонии звонки и записи появятся сами.</span><button class="btn primary sm" data-cm-send>${icon('phone')}Записать звонок</button></div>`;
  } else if (mode === 'note') {
    inner = `<textarea class="textarea" id="cmText" placeholder="Что важно помнить о человеке: пожелания, договорённости, контекст"></textarea>
      <div class="comp-foot"><span class="note"></span><button class="btn primary sm" data-cm-send>${icon('note')}Сохранить заметку</button></div>`;
  } else if (mode === 'task') {
    inner = `<div class="comp-row"><input class="input" id="cmText" placeholder="Что сделать: перезвонить, отправить ссылку…" style="flex:3 1 240px">
        <input class="input" type="date" id="cmDue" value="${addDays(today(), 1)}" style="max-width:160px">
        <select class="select" id="cmWho">${Team.assignable().map(m => opt(m.id, Team.name(m), ent.manager || Who.id())).join('')}</select></div>
      <div class="comp-foot"><span class="note"></span><button class="btn primary sm" data-cm-send>${icon('check')}Поставить задачу</button></div>`;
  } else if (mode === 'meet') {
    inner = `<div class="comp-row"><select class="select" id="cmMeetCh">${opts([['call', 'Созвон в Zoom'], ['app', 'Эфир или мастер-класс'], ['group', 'Офлайн-встреча']], 'call')}</select><input class="input" type="date" id="cmDue" value="${today()}" style="max-width:160px"></div>
      <textarea class="textarea" id="cmText" placeholder="Что было на встрече"></textarea>
      <div class="comp-foot"><span class="note"></span><button class="btn primary sm" data-cm-send>${icon('cal')}Сохранить</button></div>`;
  } else if (mode === 'pay') {
    inner = `<div class="comp-foot"><span class="note">Оплаты придут сами после подключения платёжной системы. Вручную — счёт или оплата, прошедшая мимо CRM.</span><button class="btn sm" data-cm-invoice>${icon('link')}Выставить счёт</button><button class="btn primary sm" data-cm-pay>${icon('card')}Внести оплату</button></div>`;
  } else if (mode === 'payout') {
    inner = `<div class="comp-row"><input class="input num" id="cmAmount" placeholder="Сумма, ₽" inputmode="numeric" style="max-width:160px"><input class="input" id="cmText" placeholder="За что: доля с продаж за август"></div>
      <div class="comp-foot"><span class="note">Выплата по акту или счёту. Попадёт в расчёт «к выплате».</span><button class="btn primary sm" data-cm-send>${icon('coins')}Записать выплату</button></div>`;
  }
  return `<div class="composer" data-composer data-mode="${mode}">
    <div class="seg" role="tablist">${modes.map(m => `<button data-cm-mode="${m}" class="${m === mode ? 'on' : ''}">${label(m)}</button>`).join('')}</div>
    ${inner}</div>`;
}
function wireComposer(root, col, ent) {
  const box = $('[data-composer]', root);
  if (!box) return;
  on(root, 'click', '[data-cm-mode]', (e, el) => { View.set('cm.mode', el.dataset.cmMode); App.render(); });
  on(box, 'click', '#cmDir button', (e, el) => $$('#cmDir button', box).forEach(b => b.classList.toggle('on', b === el)));
  const tplSel = $('#cmTpl', box);
  if (tplSel) tplSel.onchange = () => {
    const t = (Cfg.list('templates') || {})[tplSel.value];
    if (!t) return;
    $('#cmText', box).value = fillTemplate(t.text, col === 'clients' ? ent : null);
    if (t.ch && $('#cmCh', box)) $('#cmCh', box).value = t.ch;
    $('#cmText', box).focus();
  };
  const text = $('#cmText', box);
  if (text && text.tagName === 'TEXTAREA') text.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } });
  const mode = box.dataset.mode;
  function send() {
    const v = text ? text.value.trim() : '';
    if (mode === 'msg') {
      if (!v) { text.classList.add('need'); text.focus(); return; }
      const ch = $('#cmCh', box).value;
      if (ch.startsWith('group:')) {
        const chat = Chats.get(ch.slice(6));
        Chats.post(chat.id, v, {to: ent.id});
        toast(`Отправлено в групповой чат «${chat.name.split(' · ')[0]}» — видно всем участницам`);
      } else {
        if (col === 'clients') Inbox.send(ent.id, ch, v);
        else Ev.add(col, ent.id, {kind: 'msg', ch, dir: 'out', text: v, status: Inbox.live(ch) ? 'queued' : 'saved'});
        toast(Inbox.live(ch) ? 'Сообщение поставлено в отправку' : 'Сохранено в истории. Канал не подключён — отправьте по ссылке');
      }
    } else if (mode === 'call') {
      const dir = ($('#cmDir button.on', box) || {}).dataset.v || 'out';
      const res = $('#cmRes', box).value;
      const mins = parseNum($('#cmDur', box).value);
      const rec = $('#cmRec', box).value.trim();
      Ev.add(col, ent.id, {kind: 'call', dir, result: res, dur: Math.round(mins * 60), text: v, rec: /^https?:\/\//.test(rec) ? rec : ''});
      if ($('#cmNext', box).checked || res === 'later' || res === 'noanswer') Tasks.add(col, ent.id, {title: res === 'noanswer' ? 'Перезвонить: не дозвонились' : 'Перезвонить', due: $('#cmNextD', box).value || addDays(today(), 1), who: ent.manager || Who.id()});
      toast('Звонок записан');
    } else if (mode === 'note') {
      if (!v) { text.classList.add('need'); text.focus(); return; }
      Ev.add(col, ent.id, {kind: 'note', text: v});
    } else if (mode === 'task') {
      if (!v) { text.classList.add('need'); text.focus(); return; }
      Tasks.add(col, ent.id, {title: v, due: $('#cmDue', box).value, who: $('#cmWho', box).value});
      toast('Задача поставлена');
    } else if (mode === 'meet') {
      if (!v) { text.classList.add('need'); text.focus(); return; }
      const d = $('#cmDue', box).value || today();
      Ev.add(col, ent.id, {kind: 'meet', ch: $('#cmMeetCh', box).value, text: v, t: d === today() ? Date.now() : dateOf(d).getTime() + 12 * 3600e3});
    } else if (mode === 'payout') {
      const amount = parseNum($('#cmAmount', box).value);
      if (!amount) { $('#cmAmount', box).classList.add('need'); return; }
      Ev.add(col, ent.id, {kind: 'pay', type: 'payout', amount, status: 'ok', method: 'invoice', text: v});
      toast('Выплата записана');
    }
  }
  on(box, 'click', '[data-cm-send]', e => { e.preventDefault(); send(); });
  on(box, 'click', '[data-cm-pay]', () => openPayForm(ent.id, 'ok'));
  on(box, 'click', '[data-cm-invoice]', () => openPayForm(ent.id, 'pending'));
}

/* ── оплата или счёт ── */
function openPayForm(clientId, status = 'ok') {
  const s = settings();
  const c = Clients.get(clientId);
  const exOpts = Experts.all().filter(x => ['live', 'paying', 'shot', 'agreed'].includes(x.stage));
  const body = `<div class="grid2">
      <label class="field"><span>Что</span><select class="select" id="pyType">${Object.entries(PAY_TYPES).map(([k, t]) => opt(k, t.name, 'sub')).join('')}</select></label>
      <label class="field"><span>Сумма, ₽</span><input class="input num" id="pyAmount" inputmode="numeric" value="${s.price}"></label>
      <label class="field"><span>Способ</span><select class="select" id="pyMethod">${Object.entries(PAY_METHODS).map(([k, n]) => opt(k, n, 'card')).join('')}</select></label>
      <label class="field"><span>Дата</span><input class="input" type="date" id="pyDate" value="${today()}"></label>
      <label class="field" style="grid-column:1/-1"><span>Название (курс, товар, событие)</span><input class="input" id="pyItem" placeholder="Курс «Мягкая сила»"></label>
      <label class="field"><span>Эксперт — для доли с продаж</span><select class="select" id="pyExpert">${opt('', '—', '')}${exOpts.map(x => opt(x.id, x.name, '')).join('')}</select></label>
      <label class="field"><span>Оплачено бонусами, ₽</span><input class="input num" id="pyBonus" inputmode="numeric" placeholder="до 30% заказа"></label>
    </div>
    ${status === 'pending' ? '<p class="note">Счёт попадёт в историю со статусом «Ждёт оплаты», клиентка — на этап «Счёт выставлен». Когда оплата придёт, нажмите «Оплачено» в ленте.</p>' : '<p class="note">Первая оплата сама переведёт клиентку в «Оплата получена».</p>'}`;
  openModal({title: status === 'pending' ? `Счёт: ${Clients.name(c)}` : `Оплата: ${Clients.name(c)}`, body,
    foot: `<button class="btn" data-close>Отмена</button><button class="btn primary" data-ok>${status === 'pending' ? 'Выставить счёт' : 'Внести оплату'}</button>`,
    onMount(el, close) {
      const typeSel = $('#pyType', el);
      typeSel.onchange = () => { const v = typeSel.value; $('#pyAmount', el).value = v === 'sub' ? s.price : v === 'year' ? s.priceYear : v === 'club' ? 1500 : ''; };
      $('[data-ok]', el).onclick = () => {
        const amount = parseNum($('#pyAmount', el).value);
        if (!amount && status === 'ok') { $('#pyAmount', el).classList.add('need'); return; }
        const d = $('#pyDate', el).value || today();
        const bonus = parseNum($('#pyBonus', el).value);
        Pay.add(clientId, {type: typeSel.value, amount, method: $('#pyMethod', el).value, status, item: $('#pyItem', el).value.trim() || undefined,
          expertId: $('#pyExpert', el).value || undefined, bonusUsed: bonus || undefined, t: d === today() ? Date.now() : dateOf(d).getTime() + 12 * 3600e3});
        close();
        toast(status === 'pending' ? 'Счёт выставлен' : 'Оплата внесена');
      };
    }});
}

/* ── карточка клиентки ── */
App.register('client', {
  title: id => Clients.name(Clients.get(id)),
  render(root, id) {
    const c = Clients.get(id);
    if (!c) { root.innerHTML = `<a class="back-link" href="#clients">${icon('back')}Клиенты</a><div class="empty"><b>Карточка не найдена</b>Возможно, её удалили или объединили с другой.</div>`; return; }
    if (!Who.can('clients.all') && c.manager && c.manager !== Who.id()) { root.innerHTML = noAccess('Это клиентка другого менеджера.'); return; }
    const d = cx(c);
    const canEdit = Clients.canEdit(c);
    const tab = View.get('card.tab', 'feed');
    const mode = View.get('cm.mode', 'msg');
    const s = settings();
    const mgr = Team.get(c.manager);
    const ref = c.referrerId ? Clients.get(c.referrerId) : null;
    const partner = Partners.get(c.partnerId);
    const seg = d.segment;
    const refSt = Referral.of(c);
    const chats = Chats.memberOf(c);
    const groupEvs = d.groupMsgs.map(m => ({...m, kind: 'group', id: 'g' + m.id}));
    const allEvs = [...d.evs, ...groupEvs];
    const byTab = {
      feed: allEvs,
      chat: [...d.msgs, ...groupEvs],
      calls: d.evs.filter(e => e.kind === 'call'),
      pays: d.evs.filter(e => e.kind === 'pay'),
      tasks: d.evs.filter(e => e.kind === 'task'),
      camps: d.evs.filter(e => e.kind === 'camp'),
    };
    const tabs = [['feed', 'Лента', allEvs.length], ['chat', 'Переписка', byTab.chat.length], ['calls', 'Звонки', byTab.calls.length], ['pays', 'Оплаты', byTab.pays.length], ['tasks', 'Задачи', d.tasks.length || null], ['camps', 'Рассылки', byTab.camps.length], ['refs', 'Рефералы', refSt.inv.length || null]];

    let pane = '';
    if (tab === 'refs') {
      pane = `<div class="stack">
        <div class="grid3">
          <div class="card flat stat"><span class="label">Пригласила</span><div class="big">${refSt.inv.length}</div><div class="foot">оплатили ${refSt.paying}</div></div>
          <div class="card flat stat"><span class="label">Начислено</span><div class="big">${rubK(refSt.accrued)}</div><div class="foot">${esc(REF_PROGRAMS[Referral.program(c)].name)}</div></div>
          <div class="card flat stat"><span class="label">К выплате</span><div class="big">${rubK(Math.max(0, refSt.available))}</div><div class="foot">выплачено ${rubK(refSt.settled)}</div></div>
        </div>
        ${refSt.inv.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Подруга</th><th>Пришла</th><th>Этап</th><th class="r">Принесла</th><th class="r">Начислено</th></tr></thead><tbody>
          ${refSt.inv.map(i => `<tr><td><a class="inline-link" href="#client-${i.id}">${esc(Clients.name(i))}</a></td><td>${dayShort(i.created)}</td><td>${stagePill('sales', i.stage)}</td><td class="r">${rub(cx(i).ltv)}</td><td class="r">${rub(sum(refSt.acc.filter(a => a.inv === i.id), a => a.amount))}</td></tr>`).join('')}
        </tbody></table></div>` : `<p class="note">Пока никого. Промокод для подруг: <span class="promo">${esc(c.refCode || '—')}</span> · ссылка eva.space/r/${esc((c.refCode || '').toLowerCase())}</p>`}
      </div>`;
    } else if (tab === 'chat') {
      const items = byTab.chat.slice().sort((a, b) => a.t - b.t);
      let last = '';
      pane = items.length ? `<div class="thread2">${items.map(m => {
        const dd = isoTs(m.t);
        const sep = dd !== last ? `<div class="tl-day">${dd === today() ? 'Сегодня' : cap(dayWd(dd))}</div>` : '';
        last = dd;
        if (m.kind === 'group') return sep + `<div class="bub in"><div class="bub-who">${chBadge('group')} ${esc(m.chatName.split(' · ')[0])}</div>${esc(m.text)}<div class="bub-meta">${hm(m.t)}</div></div>`;
        return sep + `<div class="bub ${m.dir}">${esc(m.text)}<div class="bub-meta">${chBadge(m.ch)} ${m.dir === 'out' && m.by ? esc(Team.first(Team.get(m.by))) + ' · ' : ''}${hm(m.t)}${m.status === 'saved' ? ' · <span class="saved">не отправлено</span>' : ''}</div></div>`;
      }).join('')}</div>` : '<div class="empty"><b>Переписки пока нет</b>Напишите первой — выберите канал в поле ниже.</div>';
    } else {
      pane = timelineHtml('clients', c, byTab[tab] || allEvs, canEdit);
    }

    const contact = [
      c.phone ? kv('Телефон', `<span class="nowrap">${esc(phoneFmt(c.phone))}</span> <button class="link-btn" data-copy="${esc(phoneFmt(c.phone))}">копировать</button>`) : '',
      c.tg ? kv('Telegram', `<a href="${esc(Clients.chatUrl(c, 'tg'))}" target="_blank" rel="noopener">@${esc(tgUser(c.tg))}</a>`) : '',
      (c.wa || c.phone) ? kv('WhatsApp', `<a href="${esc(Clients.chatUrl(c, 'wa'))}" target="_blank" rel="noopener">${esc(phoneFmt(c.wa || c.phone))}</a>`) : '',
      c.email ? kv('Почта', `${esc(c.email)} <button class="link-btn" data-copy="${esc(c.email)}">копировать</button>`) : '',
      kv('Город', esc(c.city || '')),
      c.birth ? kv('Возраст', `${ageOf(c.birth)} · ${dayLong(c.birth)}`) : '',
      kv('Сфера', esc(c.niche || '')),
      c.org ? kv('Организация', esc(c.org)) : '',
    ].join('');
    const quizRows = Object.keys(QUIZ).map(k => {
      const v = (c.quiz || {})[k];
      if (isEmpty(v)) return '';
      if (QUIZ[k].health && !c.consentHealth) return `<div class="quiz-row"><span>${esc(QUIZ[k].name)}</span><b class="muted">скрыто: нет согласия на данные о здоровье</b></div>`;
      return `<div class="quiz-row"><span>${esc(QUIZ[k].name)}</span><b>${esc(quizText(k, v))}</b></div>`;
    }).join('');
    const consent = (label, v, extra = '') => `<div class="consent"><i class="${v ? 'y' : 'n'}">${v ? '✓' : '—'}</i>${esc(label)}<small>${v ? dayShort(toDay(v)) : 'нет'}${extra}</small></div>`;
    const offers = Partners.all().filter(p => p.stage === 'active' && (p.city === c.city || p.city === 'Онлайн')).flatMap(p => Partners.offers(p).map(o => ({p, o}))).slice(0, 3);

    root.innerHTML = `
      <a class="back-link" href="#clients">${icon('back')}Клиенты</a>
      <div class="cc-head">
        ${avatar(Clients.name(c), 'xl')}
        <div class="cc-title">
          <h1>${esc(Clients.name(c))}</h1>
          <div class="cc-sub">${stagePill(Funnels.of('clients', c), c.stage)}${subPill(c)}${seg ? segPill(seg) : ''}${d.level ? `<span class="pill line">${icon('star')}${esc(d.level.name)}</span>` : ''}
            <span>${esc(SOURCES[c.source] || c.source || '')}${c.created ? ` · с ${dayShort(c.created)}${c.created.slice(0, 4) !== today().slice(0, 4) ? ' ' + c.created.slice(0, 4) : ''}` : ''}</span></div>
          <div class="tags-line" id="tagLine">${(c.tags || []).map(t => tagChip(t, canEdit)).join('')}${canEdit ? `<button class="btn xs ghost" data-tag-add>${icon('tag')}Тег</button>` : ''}</div>
        </div>
        <div class="cc-acts">
          ${canEdit ? `<button class="btn sm" data-mode-go="msg">${icon('msg')}Написать</button><button class="btn sm" data-mode-go="call">${icon('phone')}Звонок</button><button class="btn sm" data-invoice>${icon('link')}Счёт</button><button class="btn sm" data-mode-go="task">${icon('check')}Задача</button><button class="btn sm" data-edit>${icon('edit')}Изменить</button>` : ''}
          ${Who.can('clients.delete') ? `<button class="icon-btn" data-del title="Удалить карточку">${icon('trash')}</button>` : ''}
        </div>
      </div>
      ${stepperHtml('clients', c, canEdit)}
      <div class="cc-grid">
        <div class="cc-main">
          ${canEdit ? composerHtml('clients', c, mode === 'payout' ? 'msg' : mode) : ''}
          <div class="card">${tabsHtml('card.tab', tabs, tab)}<div class="cc-pane">${pane}</div></div>
        </div>
        <aside class="cc-side">
          <div class="card"><div class="mini-h"><h3>Работа</h3></div>
            ${kv('Менеджер', canEdit && Who.can('clients.assign') ? `<button class="link-btn" data-mgr>${esc(mgr ? Team.name(mgr) : 'Назначить')}</button>` : mgr ? esc(Team.name(mgr)) : (canEdit ? '<button class="link-btn" data-take>Взять себе</button>' : '—'))}
            ${kv('Следующий шаг', d.tasks.length ? `${esc(d.tasks[0].title)} · <span class="${d.tasks[0].due < today() ? 'bad' : ''}">${dayOrWhen(d.tasks[0].due)}</span>` : '<span class="warn">не запланирован</span>')}
            ${kv('Последнее касание', d.lastTouchTs ? when(d.lastTouchTs) : 'ни разу')}
            ${kv('Касаний', fmt(d.touches))}
            ${kv('Сегмент', seg ? `${esc(seg.name)}${c.segId ? ' · вручную' : ''}` : '—')}
            ${canEdit ? `<div class="row" style="margin-top:8px"><button class="btn xs" data-seg>Сменить сегмент</button></div>` : ''}
          </div>
          <div class="card"><div class="mini-h"><h3>Контакты</h3>${canEdit ? '<button class="btn xs ghost" data-edit>Изменить</button>' : ''}</div>${contact}</div>
          ${Who.can('money.view') || c.manager === Who.id() ? `<div class="card"><div class="mini-h"><h3>Подписка и деньги</h3></div>
            ${kv('Подписка', `${subPill(c)}`)}
            ${d.subUntil ? kv('Оплачено до', dayLong(d.subUntil)) : ''}
            ${c.trialUntil ? kv('Пробный до', dayLong(c.trialUntil)) : ''}
            ${kv('Принесла, LTV', `<b>${rub(d.ltv)}</b>`)}
            ${kv('Оплат', fmt(d.pays))}
            ${d.pending.length ? kv('Ждут оплаты', `<span class="warn">${d.pending.length} ${plural(d.pending.length, 'счёт', 'счёта', 'счетов')}</span>`) : ''}
            ${kv('Баланс Евы', rub(c.balance || 0))}
            ${kv('Бонусы', rub(c.bonus || 0))}
          </div>` : ''}
          <div class="card"><div class="mini-h"><h3>Анкета Eva Space</h3>${canEdit ? '<button class="btn xs ghost" data-edit-g="Анкета Eva Space">Изменить</button>' : ''}</div>${quizRows || '<p class="note">Анкету не заполняла — например, контакт из загруженной базы.</p>'}</div>
          <div class="card"><div class="mini-h"><h3>Согласия</h3>${canEdit ? '<button class="btn xs ghost" data-edit-g="Согласия">Изменить</button>' : ''}</div>
            ${consent('Обработка данных', c.consentPD)}${consent('Данные о здоровье', c.consentHealth)}${consent('Рекламные рассылки', c.consentAds, c.consentAds && c.allowCh && c.allowCh.length ? ' · ' + c.allowCh.map(x => CHANNELS[x].short).join(', ') : '')}
            ${!c.consentAds ? '<p class="note" style="margin-top:6px">Без согласия рассылки не уходят. Личные ответы на её сообщения — можно.</p>' : ''}
          </div>
          <div class="card"><div class="mini-h"><h3>В приложении</h3></div>
            ${kv('Была', c.lastSeen ? dayOrWhen(c.lastSeen) : '—')}${kv('Звёзд за неделю', `${fmt(c.stars || 0)} из 21`)}${kv('Практик пройдено', fmt(c.practices || 0))}${kv('Баллы', fmt(c.points || 0))}${c.appId ? kv('ID', esc(c.appId)) : ''}
          </div>
          <div class="card"><div class="mini-h"><h3>Откуда</h3></div>
            ${kv('Источник', esc(SOURCES[c.source] || c.source || ''))}${c.utm ? kv('Кампания', esc(c.utm)) : ''}
            ${ref ? kv('Пригласила', `<a href="#client-${ref.id}">${esc(Clients.name(ref))}</a>`) : ''}
            ${partner ? kv('Партнёр', `<a href="#partner-${partner.id}">${esc(partner.name)}</a>`) : ''}
            ${kv('Промокод для подруг', c.refCode ? `<span class="promo">${esc(c.refCode)}</span>` : '')}
            ${c.refProgram ? kv('Программа', esc(REF_PROGRAMS[c.refProgram].name)) : ''}
          </div>
          ${chats.length ? `<div class="card"><div class="mini-h"><h3>Групповые чаты</h3></div>${chats.map(g => `<a class="attn-row" href="#inbox" data-open-chat="${g.id}">${chBadge('group')}<span class="t">${esc(g.name)}</span></a>`).join('')}</div>` : ''}
          ${offers.length ? `<div class="card"><div class="mini-h"><h3>Предложения партнёров рядом</h3></div><div class="stack">${offers.map(({p, o}) => `<div class="offer"><span class="ico">${icon('gift')}</span><div><b>${esc(o.title)}</b><small><a class="inline-link" href="#partner-${p.id}">${esc(p.name)}</a>${o.promo ? ` · <span class="promo">${esc(o.promo)}</span>` : ''}</small></div></div>`).join('')}</div></div>` : ''}
        </aside>
      </div>`;

    wireTabs(root);
    wireStepper(root, 'clients', c);
    wireTimeline(root, 'clients', c);
    wireComposer(root, 'clients', c);
    if (tab === 'chat' || tab === 'feed') Inbox.markRead(c);
    on(root, 'click', '[data-mode-go]', (e, el) => { View.set('cm.mode', el.dataset.modeGo); App.render(); setTimeout(() => { const t = $('#cmText'); if (t) t.focus(); }, 30); });
    on(root, 'click', '[data-invoice]', () => openPayForm(c.id, 'pending'));
    on(root, 'click', '[data-edit]', () => openClientForm(c.id));
    on(root, 'click', '[data-edit-g]', (e, el) => openClientForm(c.id, el.dataset.editG));
    on(root, 'click', '[data-copy]', async (e, el) => { if (await copyText(el.dataset.copy)) toast('Скопировано'); });
    on(root, 'click', '[data-take]', () => { Store.patch('clients', c.id, {manager: Who.id()}); toast('Клиентка ваша'); });
    on(root, 'click', '[data-open-chat]', (e, el) => { View.set('ib.sel', 'chat:' + el.dataset.openChat); });
    on(root, 'click', '[data-mgr]', async (e, el) => {
      const v = await pickPop(el, [['', 'Без менеджера'], ...Team.assignable().map(m => [m.id, Team.name(m)])], c.manager || '');
      if (v === null) return;
      Store.patch('clients', c.id, {manager: v || null});
      Ev.add('clients', c.id, {kind: 'sys', text: v ? `Назначен менеджер: ${Team.name(Team.get(v))}` : 'Менеджер снят'});
    });
    on(root, 'click', '[data-seg]', async (e, el) => {
      const v = await pickPop(el, [['', 'Автоматически — по условиям'], ...Segments.all().map(sg => [sg.id, sg.name]), ['none', 'Без сегмента']], c.segId || '');
      if (v === null) return;
      Store.patch('clients', c.id, {segId: v || null});
    });
    on(root, 'click', '[data-untag]', (e, el) => Store.patch('clients', c.id, {tags: (c.tags || []).filter(t => t !== el.dataset.untag)}));
    on(root, 'click', '[data-tag-add]', async (e, el) => {
      const v = await pickPop(el, [...Tags.all().filter(t => !(c.tags || []).includes(t.id)).map(t => [t.id, `${t.name} · ${t.group}`]), ['__new', '+ Новый тег…']], '');
      if (v === null) return;
      let tid = v;
      if (v === '__new') { tid = Tags.ensure(await askText(el, 'Новый тег', 'Например, «Хочет курс по деньгам»')); if (!tid) return; }
      Store.patch('clients', c.id, {tags: [...(c.tags || []), tid]});
    });
    on(root, 'click', '[data-del]', async (e, el) => {
      if (!await confirmPop(el, {text: 'Удалить карточку со всей историей? Это нельзя отменить.', yes: 'Удалить', danger: true})) return;
      Store.remove('clients', c.id);
      App.go('clients');
      toast('Карточка удалена');
    });
    void s;
  },
});
