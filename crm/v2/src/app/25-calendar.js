/* Календарь созвонов: неделя сеткой, месяц и список, статистика созвонов —
   общая, по группам, по 14 направлениям экспертов, по категориям партнёров
   и по людям в команде. Созвон переносится перетаскиванием, клик по
   пустому месту — назначить созвон на это время. Серым — свои события из
   Google Календаря, если он подключён. */

const CAL_H0 = 8, CAL_H1 = 22;
const DURS = [20, 30, 45, 60, 90];
const GROUP_TONE = {client: 'g-client', expert: 'g-expert', partner: 'g-partner', amb: 'g-amb'};
const CallUI = {ws: null, month: null};

/* ── созвоны ── */
const hasCall = p => !!p.callAt && ['set', 'done', 'noshow'].includes(p.s2 || 'none');
function callState(p) {
  if (p.s2 === 'done') return 'done';
  if (p.s2 === 'noshow') return 'noshow';
  return p.callAt + callMin(p) * 60e3 < Date.now() ? 'late' : 'set';
}
const CALL_STATE = {set: 'назначен', late: 'прошёл? отметьте', done: 'прошёл', noshow: 'не состоялся'};
const callsBetween = (a, b) => Store.all('people').filter(p => hasCall(p) && p.callAt >= a && p.callAt < b).sort((x, y) => x.callAt - y.callAt);
const minOfDay = ts => { const d = new Date(ts); return d.getHours() * 60 + d.getMinutes(); };
const tsOf = (iso, min) => { const d = dateOf(iso); d.setHours(Math.floor(min / 60), min % 60, 0, 0); return d.getTime(); };
const hmMin = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
/* после любой смены времени или статуса — привести своё событие в Google */
const syncCall = id => setTimeout(() => Gcal.sync(People.get(id)), 60);

/* ── назначить или перенести созвон ── */
function openTimePicker(p, preset = null) {
  Gcal.init();
  const base = preset ? preset.ts : p.callAt || (() => { const d = new Date(Date.now() + 864e5); d.setHours(12, 0, 0, 0); return d.getTime(); })();
  const d = new Date(base);
  const local = `${isoOf(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const pref = (p.answers || {}).call || (p.answers || {}).when || '';
  const dur = callMin(p);
  const gOn = Gcal.usable();
  const busyWith = ts => {
    const e = ts + Number(($('#tpDur') || {}).value || dur) * 60e3;
    const crm = Store.all('people').filter(x => x.id !== p.id && hasCall(x) && x.s2 === 'set' && x.callAt < e && x.callAt + callMin(x) * 60e3 > ts).map(x => `${hmMin(minOfDay(x.callAt))} ${People.name(x)}`);
    const ws = weekStart(isoTs(ts));
    const g = ((Gcal.week[ws] || {}).events || []).filter(ev => !gIsCrm(ev) && gBusy(ev)).map(ev => ({ev, r: gRange(ev)})).filter(x => x.r && !x.r.allDay && x.r.start < e && x.r.end > ts).map(x => `${hmMin(minOfDay(x.r.start))} ${x.ev.summary || 'занято'}`);
    return [...crm.map(x => 'CRM: ' + x), ...g.map(x => 'Google: ' + x)];
  };
  openModal({title: `${p.callAt && p.s2 === 'set' ? 'Перенести' : 'Назначить'} созвон: ${People.name(p)}`, body: `
      ${pref ? `<div class="warnline" style="background:var(--violet-soft);color:var(--violet)">В анкете удобно: «${esc(noEmo(Array.isArray(pref) ? pref.join(', ') : pref))}»</div>` : ''}
      <div class="grid2"><label class="field"><span>Когда</span><input class="input" type="datetime-local" id="tpWhen" value="${local}" step="900"></label>
      <label class="field"><span>Сколько</span><select class="select" id="tpDur">${DURS.map(m => `<option value="${m}" ${m === dur ? 'selected' : ''}>${m} минут</option>`).join('')}</select></label></div>
      <div class="chip-row">${[['Завтра 12:00', 1, 12], ['Завтра 19:00', 1, 19], ['Послезавтра 12:00', 2, 12], ['Через неделю', 7, 12]].map(([n, dd, hh]) => `<button class="chip" data-quick="${dd}|${hh}">${n}</button>`).join('')}</div>
      <div id="tpBusy"></div>
      <label class="field"><span>Ссылка на Zoom (необязательно)</span><input class="input" id="tpZoom" value="${esc(p.zoom || '')}" placeholder="https://zoom.us/j/…"></label>
      ${gOn ? `<label class="check"><input type="checkbox" id="tpG" ${Gcal.auto() || Gcal.mine(p) ? 'checked' : ''}> Поставить в мой Google Календарь${Gcal.mine(p) ? ' (событие уже есть — обновится)' : ''}</label>` : ''}`,
    foot: '<button class="btn" data-close>Отмена</button><button class="btn primary" data-ok>Сохранить</button>',
    onMount(el, close) {
      const paintBusy = () => {
        const v = $('#tpWhen', el).value;
        const list = v ? busyWith(new Date(v).getTime()) : [];
        $('#tpBusy', el).innerHTML = list.length ? `<div class="warnline">В это время уже: ${esc(list.slice(0, 3).join(' · '))}</div>` : '';
      };
      paintBusy();
      $('#tpWhen', el).oninput = paintBusy;
      $('#tpDur', el).onchange = paintBusy;
      on(el, 'click', '[data-quick]', (ev, b) => { const [dd, hh] = b.dataset.quick.split('|').map(Number); const x = new Date(); x.setDate(x.getDate() + dd); x.setHours(hh, 0, 0, 0); $('#tpWhen', el).value = `${isoOf(x)}T${pad(hh)}:00`; paintBusy(); });
      $('[data-ok]', el).onclick = async () => {
        const v = $('#tpWhen', el).value;
        if (!v) return;
        const ts = new Date(v).getTime();
        const moved = p.callAt && p.s2 === 'set' && p.callAt !== ts;
        People.patch(p.id, {s2: 'set', callAt: ts, callMin: Number($('#tpDur', el).value) || 30, zoom: $('#tpZoom', el).value.trim(), s1: ['done', 'skip'].includes(p.s1) ? p.s1 : 'skip'}, `${moved ? 'Созвон перенесён' : 'Созвон назначен'} на ${when(ts)}`, '📅');
        const wantG = $('#tpG', el) && $('#tpG', el).checked;
        close();
        toast(`Созвон ${moved ? 'перенесён' : 'назначен'}: ${when(ts)}`);
        if (wantG) { View.set('gcal.auto', true); await Gcal.push(People.get(p.id)); }
        else { if ($('#tpG', el)) View.set('gcal.auto', false); syncCall(p.id); }
      };
    }});
}

/* кого позвать на свободное время: кому нужен созвон — сверху */
function openSlotPicker(ts) {
  const need = Store.all('people').filter(p => People.col(p) === 2 && ['none', 'noshow'].includes(p.s2 || 'none'));
  const rest = Store.all('people').filter(p => !need.includes(p) && !(p.s2 === 'set'));
  const row = p => `<button class="slot-p" data-pick="${p.id}">${avatar(People.name(p))}<span><b>${esc(People.name(p))}</b><small>${groupName(p.type)}${People.sub(p) ? ' · ' + esc(People.sub(p)) : ''}</small></span></button>`;
  openModal({title: `Созвон ${when(ts)}`, body: `
      <input class="input" id="spQ" placeholder="Поиск: имя, город">
      <div class="slot-list" id="spList">
        ${need.length ? `<p class="rec-h">Ждут созвона · ${need.length}</p>${need.map(row).join('')}` : ''}
        <p class="rec-h">Остальные</p>${rest.slice(0, 60).map(row).join('')}
      </div>`,
    foot: '<button class="btn" data-close>Отмена</button>',
    onMount(el, close) {
      $('#spQ', el).oninput = e => { const q = e.target.value.trim().toLowerCase(); $$('[data-pick]', el).forEach(b => { b.hidden = q && !b.textContent.toLowerCase().includes(q); }); };
      on(el, 'click', '[data-pick]', (e, b) => { close(); setTimeout(() => openTimePicker(People.get(b.dataset.pick), {ts}), 80); });
    }});
}

/* созвон по клику: что с ним сделать */
function openCallCard(p) {
  const st = callState(p);
  const canEdit = People.canEdit();
  const owner = p.owner ? Team.get(p.owner) : null;
  openModal({title: People.name(p), body: `
      <div class="call-head"><span class="cb-dot ${GROUP_TONE[p.type]}"></span><b>${groupName(p.type)}</b><span class="st ${st === 'done' ? 'good' : st === 'noshow' ? 'bad' : st === 'late' ? 'warn' : 'violet'}">${CALL_STATE[st]}</span></div>
      <div class="kv-list">
        ${kv('Когда', esc(`${cap(dayWd(isoTs(p.callAt)))}, ${hmMin(minOfDay(p.callAt))}–${hmMin(minOfDay(p.callAt + callMin(p) * 60e3))}`))}
        ${People.sub(p) ? kv('Кто это', esc(People.sub(p))) : ''}
        ${owner ? kv('Ведёт', esc(Team.name(owner))) : ''}
        ${p.zoom ? kv('Zoom', `<a href="${esc(p.zoom)}" target="_blank" rel="noopener">открыть ↗</a>`) : ''}
        ${p.gcal && p.gcal.id ? kv('Google', p.gcal.link ? `<a href="${esc(p.gcal.link)}" target="_blank" rel="noopener">событие в календаре ↗</a>` : 'событие в календаре') : ''}
      </div>`,
    foot: `<button class="btn" data-go>Карточка</button>${canEdit ? `
      ${st === 'set' || st === 'late' ? `<button class="btn" data-cc="time">Перенести</button><button class="btn" data-cc="noshow">Не состоялся</button><button class="btn" data-cc="done">Прошёл</button><button class="btn primary" data-cc="talk">Начать ${p.type === 'client' ? 'интервью' : 'созвон'}</button>` : ''}
      ${st === 'noshow' ? '<button class="btn primary" data-cc="time">Назначить заново</button>' : ''}
      ${st === 'done' ? '<button class="btn primary" data-cc="result">Итог</button>' : ''}` : ''}`,
    onMount(el, close) {
      $('[data-go]', el).onclick = () => { close(); App.go('p-' + p.id); };
      on(el, 'click', '[data-cc]', (e, b) => {
        const a = b.dataset.cc;
        close();
        if (a === 'time') setTimeout(() => openTimePicker(People.get(p.id)), 80);
        else if (a === 'talk') { Timer.start(p.id); View.set('pp.last', p.id); View.set('pp.tab', 'talk'); App.go('p-' + p.id); }
        else if (a === 'result') { View.set('pp.last', p.id); View.set('pp.tab', 'result'); App.go('p-' + p.id); }
        else if (a === 'done') People.patch(p.id, {s2: 'done', talkAt: p.talkAt || Date.now()}, `${p.type === 'client' ? 'Интервью' : 'Созвон'} прошёл`, '✅');
        else if (a === 'noshow') { People.patch(p.id, {s2: 'noshow'}, 'Созвон не состоялся', '🙈'); toast('Отметили. Назначьте новое время, пока человек на связи', {undo: () => People.patch(p.id, {s2: 'set'})}); }
      });
    }});
}

/* ── статистика созвонов за период ── */
function callStats(list) {
  const done = list.filter(p => p.s2 === 'done'), noshow = list.filter(p => p.s2 === 'noshow');
  const future = list.filter(p => callState(p) === 'set'), late = list.filter(p => callState(p) === 'late');
  const durs = done.map(p => p.callDur ? p.callDur / 60 : 0).filter(Boolean);
  const byGroup = Object.keys(TYPES).map(k => { const L = list.filter(p => p.type === k); return {k, all: L.length, done: L.filter(p => p.s2 === 'done').length, noshow: L.filter(p => p.s2 === 'noshow').length, set: L.filter(p => p.s2 === 'set').length}; });
  const byDir = DIRECTIONS.map(d => { const L = list.filter(p => p.type === 'expert' && (p.dirs || []).includes(d)); return {name: noEmo(d), v: L.length, done: L.filter(p => p.s2 === 'done').length}; });
  const byCat = PARTNER_CATS.map(c => { const L = list.filter(p => p.type === 'partner' && p.cat === c); return {name: noEmo(c), v: L.length, done: L.filter(p => p.s2 === 'done').length}; }).filter(x => x.v);
  const byOwner = Team.all().map(m => { const L = list.filter(p => p.owner === m.id); return {name: Team.name(m), v: L.length, done: L.filter(p => p.s2 === 'done').length}; }).filter(x => x.v);
  const noOwner = list.filter(p => !p.owner || !Team.get(p.owner)).length;
  if (noOwner) byOwner.push({name: 'Не назначен', v: noOwner, done: list.filter(p => (!p.owner || !Team.get(p.owner)) && p.s2 === 'done').length});
  const byHour = Array.from({length: CAL_H1 - CAL_H0}, (_, i) => ({name: `${pad(CAL_H0 + i)}:00`, v: list.filter(p => new Date(p.callAt).getHours() === CAL_H0 + i).length}));
  const byWd = WD_SH.map((w, i) => ({name: w, v: list.filter(p => weekday(isoTs(p.callAt)) === i).length}));
  const closed = done.length + noshow.length;
  return {all: list.length, done: done.length, noshow: noshow.length, future: future.length, late: late.length, show: closed ? done.length / closed : null,
    avg: durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length) : null, byGroup, byDir, byCat, byOwner, byHour, byWd};
}

App.register('calendar', {
  title: 'Календарь',
  render(root) {
    Gcal.init();
    const t = today();
    const tab = View.get('cal.tab', 'week');
    const ws = CallUI.ws || weekStart(t);
    const month = CallUI.month || monthOf(t);
    const range = tab === 'month' ? [dateOf(monthStart(month)).getTime(), dateOf(addDays(monthEnd(month), 1)).getTime()]
      : tab === 'week' ? [dateOf(ws).getTime(), dateOf(addDays(ws, 7)).getTime()] : [0, Infinity];
    const period = View.get('cal.period', 'view');
    const statList = period === 'all' ? Store.all('people').filter(hasCall) : callsBetween(range[0], range[1]);
    const S = callStats(statList);
    const canEdit = People.canEdit();
    const late = Store.all('people').filter(p => hasCall(p) && callState(p) === 'late');

    root.innerHTML = `
      ${pageHead('Календарь созвонов', 'Все созвоны CRM по дням. Перетащите созвон, чтобы перенести; нажмите на свободное время, чтобы назначить.',
        canEdit ? `<button class="btn primary" data-slot-now>${icon('plus')}Назначить созвон</button>` : '')}
      ${gcalCard(ws)}
      ${late.length ? `<div class="warnline cal-late"><span><b>${late.length} ${plural(late.length, 'созвон прошёл', 'созвона прошли', 'созвонов прошли')} без отметки.</b> Отметьте, состоялись ли они — это нужно для статистики.</span><span class="sp"></span>${late.slice(0, 3).map(p => `<button class="btn xs" data-call="${p.id}">${esc(People.name(p))}</button>`).join('')}</div>` : ''}
      <div class="kpis kpis-4 card cal-kpis">${[
        [S.all, period === 'all' ? 'созвонов всего' : tab === 'week' ? 'созвонов на неделе' : tab === 'month' ? 'созвонов в месяце' : 'созвонов всего'],
        [S.done, 'прошли'],
        [S.noshow, 'не состоялись'],
        [S.show === null ? '—' : pct(S.show), 'доходимость'],
      ].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('')}</div>
      <div class="cal-bar">
        ${tabsHtml('cal.tab', [['week', 'Неделя'], ['month', 'Месяц'], ['list', 'Список']], tab)}
        ${tab === 'week' ? `<div class="cal-nav"><button class="icon-btn" data-wk="-7" aria-label="Предыдущая неделя">${icon('back')}</button><b>${weekLabel(ws)}</b><button class="icon-btn flip" data-wk="7" aria-label="Следующая неделя">${icon('back')}</button>${ws !== weekStart(t) ? '<button class="btn xs ghost" data-wk="0">Сегодня</button>' : ''}</div>` : ''}
        ${tab === 'month' ? `<div class="cal-nav"><button class="icon-btn" data-mo="-1" aria-label="Предыдущий месяц">${icon('back')}</button><b>${monthName(month, true)}</b><button class="icon-btn flip" data-mo="1" aria-label="Следующий месяц">${icon('back')}</button>${month !== monthOf(t) ? '<button class="btn xs ghost" data-mo="0">Сегодня</button>' : ''}</div>` : ''}
      </div>
      <div class="cal-legend">${Object.keys(TYPES).map(k => `<span><i class="cb-dot ${GROUP_TONE[k]}"></i>${groupName(k)}</span>`).join('')}${Gcal.conn === 'ready' ? '<span><i class="cb-dot g-google"></i>ваш Google Календарь</span>' : ''}<span class="note">бледные — прошедшие</span></div>
      <div id="calView">${tab === 'month' ? monthView(month) : tab === 'list' ? listView() : weekView(ws)}</div>
      <section class="section">
        <div class="section-head"><h2>Статистика созвонов</h2>
          <div class="seg">${[['view', tab === 'week' ? 'Эта неделя' : tab === 'month' ? 'Этот месяц' : 'Список'], ['all', 'Всё время']].map(([v, n]) => `<button data-period="${v}" class="${period === v ? 'on' : ''}">${n}</button>`).join('')}</div></div>
        ${S.all ? callStatsHtml(S) : '<p class="note">В этом периоде созвонов нет.</p>'}
      </section>`;

    wireTabs(root);
    on(root, 'click', '[data-wk]', (e, el) => { const n = Number(el.dataset.wk); CallUI.ws = n ? addDays(ws, n) : weekStart(t); App.render(); });
    on(root, 'click', '[data-mo]', (e, el) => { const n = Number(el.dataset.mo); CallUI.month = n ? addMonths(month, n) : monthOf(t); App.render(); });
    on(root, 'click', '[data-period]', (e, el) => { View.set('cal.period', el.dataset.period); App.render(); });
    on(root, 'click', '[data-call]', (e, el) => { e.stopPropagation(); if (Date.now() - CalDrag.dropped < 350) return; openCallCard(People.get(el.dataset.call)); });
    on(root, 'click', '[data-day]', (e, el) => { CallUI.ws = weekStart(el.dataset.day); View.set('cal.tab', 'week'); App.render(); });
    on(root, 'click', '[data-slot-now]', () => { const d = new Date(Date.now() + 864e5); d.setHours(12, 0, 0, 0); openSlotPicker(d.getTime()); });
    on(root, 'click', '[data-gcal-connect]', async (e, el) => { el.disabled = true; el.textContent = 'Подключаю…'; await Gcal.connect(ws); App.render(); });
    on(root, 'click', '[data-gcal-auto]', (e, el) => { View.set('gcal.auto', el.dataset.gcalAuto === '1'); App.render(); });
    on(root, 'click', '[data-gcal-refresh]', () => { Gcal.loadWeek(ws, true); });
    on(root, 'click', '[data-gcal-retry]', () => { Gcal._init = null; Gcal.err = null; Gcal.conn = 'checking'; Gcal.week = {}; App.render(); });
    if (tab === 'week') wireWeek(root, canEdit);
    if (tab === 'week' && Gcal.conn === 'ready' && !Gcal.week[ws]) Gcal.loadWeek(ws);
  },
});

function gcalCard(ws) {
  const c = Gcal.conn;
  if (c === 'checking') return '<div class="gc-card slim"><i class="dot"></i><span>Проверяю Google Календарь…</span></div>';
  if (c === 'off') return '<div class="gc-card slim off"><i class="dot"></i><span><b>Google Календарь подключается, когда CRM открыта в Claude.</b> Здесь созвоны живут только в CRM.</span></div>';
  if (c === 'error' && Gcal.err) return `<div class="gc-card warn"><span><b>Google Календарь не отвечает</b><br>${esc(Gcal.err.text)}</span><span class="sp"></span><button class="btn sm" data-gcal-retry>Проверить снова</button></div>`;
  if (c === 'denied') return '<div class="gc-card warn"><span><b>Доступ к календарю не разрешён.</b> Обновите страницу и нажмите «Разрешить», когда Claude спросит.</span></div>';
  if (c === 'prompt') return `<div class="gc-card"><span><b>Подключите свой Google Календарь</b><br>Созвоны сами встанут в ваш календарь с пометкой «CRM», а в сетке будет видно, когда вы заняты. Штаб увидит созвоны CRM в общем календаре. Claude спросит разрешение — нажмите «Разрешить».</span><span class="sp"></span><button class="btn primary" data-gcal-connect>Подключить Google Календарь</button></div>`;
  const w = Gcal.week[ws];
  const mine = Store.all('people').filter(p => Gcal.mine(p)).length;
  return `<div class="gc-card slim ok"><i class="dot"></i><span><b>Google Календарь подключён</b> · ваших созвонов CRM в нём: ${mine} · ${w && w.loading ? 'загружаю неделю…' : w && w.err ? esc(w.err.text) : w ? 'неделя обновлена ' + timeAgo(w.at) : ''}</span><span class="sp"></span>
    <button class="btn xs ghost" data-gcal-refresh>${icon('refresh')}Обновить</button>
    <button class="btn xs ${Gcal.auto() ? '' : 'ghost'}" data-gcal-auto="${Gcal.auto() ? '0' : '1'}">${Gcal.auto() ? 'Новые созвоны ставлю в Google' : 'Не ставлю созвоны в Google'}</button></div>`;
}

/* ── неделя ── */
function weekView(ws) {
  const t = today();
  const dates = Array.from({length: 7}, (_, i) => addDays(ws, i));
  const H = CAL_H1 - CAL_H0;
  const pctOf = min => clamp((min - CAL_H0 * 60) / (H * 60) * 100, 0, 100);
  const calls = callsBetween(dateOf(ws).getTime(), dateOf(addDays(ws, 7)).getTime());
  const gw = Gcal.week[ws];
  const gev = gw && gw.events ? gw.events.filter(ev => !gIsCrm(ev) && gBusy(ev)).map(ev => ({ev, r: gRange(ev)})).filter(x => x.r && !x.r.allDay) : [];
  const col = d => {
    const items = [];
    calls.filter(p => isoTs(p.callAt) === d).forEach(p => items.push({s: p.callAt, e: p.callAt + callMin(p) * 60e3, p}));
    gev.filter(x => isoTs(x.r.start) === d).forEach(x => items.push({s: x.r.start, e: x.r.end, g: x.ev}));
    lanesOf(items);
    const blocks = items.map(it => {
      const top = pctOf(minOfDay(it.s)), h = Math.max(pctOf(minOfDay(it.s) + (it.e - it.s) / 60e3) - top, 3);
      const style = `top:${top.toFixed(2)}%;height:${h.toFixed(2)}%;left:calc(${(it.lane / it.lanes * 100).toFixed(2)}% + 2px);width:calc(${(100 / it.lanes).toFixed(2)}% - 4px)`;
      const time = `${hmMin(minOfDay(it.s))}–${hmMin(minOfDay(it.e))}`;
      if (it.g) return `<div class="cb gcal" style="${style}" title="${esc(it.g.summary || 'Занято')} · ${time} · из вашего Google Календаря"><b>${esc(it.g.summary || 'Занято')}</b><small>${time}</small></div>`;
      const st = callState(it.p);
      return `<div class="cb ${GROUP_TONE[it.p.type]} st-${st} ${it.e - it.s <= 35 * 60e3 ? 'short' : ''}" style="${style}" data-call="${it.p.id}" data-cdrag="${it.p.id}" title="${esc(People.name(it.p))} · ${time} · ${CALL_STATE[st]}"><b>${esc(People.name(it.p))}</b><small>${time} · ${groupName(it.p.type)}${st === 'done' ? ' · прошёл' : st === 'noshow' ? ' · не состоялся' : st === 'late' ? ' · отметьте' : ''}</small></div>`;
    }).join('');
    const now = new Date();
    const nowLine = d === t ? `<i class="cw-now" style="top:${pctOf(now.getHours() * 60 + now.getMinutes()).toFixed(2)}%"></i>` : '';
    return `<div class="cw-col ${weekday(d) > 4 ? 'we' : ''} ${d < t ? 'past' : ''}" data-date="${d}">${blocks}${nowLine}</div>`;
  };
  return `<div class="cal-wrap"><div class="cal-week">
      <div class="cw-corner"></div>
      ${dates.map(d => { const n = calls.filter(p => isoTs(p.callAt) === d).length; return `<div class="cw-dh ${d === t ? 'is-today' : ''} ${weekday(d) > 4 ? 'we' : ''}"><span>${WD_SH[weekday(d)]}</span><b>${Number(d.slice(8))}</b><small>${n ? `${n} ${plural(n, 'созвон', 'созвона', 'созвонов')}` : MONTHS_SH[dateOf(d).getMonth()]}</small></div>`; }).join('')}
      <div class="cw-times">${Array.from({length: H}, (_, i) => `<span style="top:${(i / H * 100).toFixed(2)}%">${pad(CAL_H0 + i)}:00</span>`).join('')}</div>
      ${dates.map(col).join('')}
    </div></div>`;
}
/* пересекающиеся блоки — рядом, дорожками */
function lanesOf(items) {
  items.sort((a, b) => a.s - b.s || b.e - a.e);
  let group = [], ends = [], groupEnd = -Infinity;
  const finish = () => { const n = ends.length || 1; group.forEach(x => { x.lanes = n; }); };
  items.forEach(it => {
    if (it.s >= groupEnd && group.length) { finish(); group = []; ends = []; }
    let c = ends.findIndex(end => end <= it.s);
    if (c < 0) { c = ends.length; ends.push(0); }
    ends[c] = it.e;
    it.lane = c;
    group.push(it);
    groupEnd = Math.max(groupEnd, it.e);
  });
  if (group.length) finish();
  return items;
}

/* клик по пустому месту — назначить; зажать созвон и перенести — сменить время */
const CalDrag = {st: null, dropped: 0};
function wireWeek(root, canEdit) {
  const grid = $('.cal-week', root);
  if (!grid || !canEdit) return;
  const H = CAL_H1 - CAL_H0;
  const minAt = (colEl, y) => { const r = colEl.getBoundingClientRect(); return clamp(Math.round((CAL_H0 * 60 + (y - r.top) / r.height * H * 60) / 15) * 15, CAL_H0 * 60, CAL_H1 * 60 - 15); };
  on(grid, 'click', '.cw-col', (e, el) => {
    if (e.target.closest('.cb') || Date.now() - CalDrag.dropped < 350) return;
    const min = Math.floor(minAt(el, e.clientY) / 30) * 30;
    openSlotPicker(tsOf(el.dataset.date, min));
  });
  grid.addEventListener('pointerdown', e => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const blk = e.target.closest('[data-cdrag]');
    if (!blk) return;
    const p = People.get(blk.dataset.cdrag);
    if (!p || p.s2 !== 'set') return;
    const touch = e.pointerType !== 'mouse';
    const r = blk.getBoundingClientRect();
    const st = {blk, p, x0: e.clientX, y0: e.clientY, id: e.pointerId, touch, on: false, dy: e.clientY - r.top, timer: null};
    if (touch) st.timer = setTimeout(() => { if (CalDrag.st === st) calDragStart(st); }, 300);
    CalDrag.st = st;
  });
  const move = e => {
    const st = CalDrag.st;
    if (!st || e.pointerId !== st.id) return;
    if (!st.on) {
      const d = Math.hypot(e.clientX - st.x0, e.clientY - st.y0);
      if (st.touch) { if (d > 10) { clearTimeout(st.timer); CalDrag.st = null; } return; }
      if (d < 5) return;
      calDragStart(st);
    }
    e.preventDefault();
    st.blk.style.visibility = 'hidden';
    const under = document.elementFromPoint(e.clientX, e.clientY);
    st.blk.style.visibility = '';
    const colEl = under && under.closest('.cw-col');
    if (!colEl) return;
    const min = minAt(colEl, e.clientY - st.dy);
    const top = (min - CAL_H0 * 60) / (H * 60) * 100;
    if (st.blk.parentNode !== colEl) colEl.appendChild(st.blk);
    st.blk.style.top = top.toFixed(2) + '%';
    st.blk.style.left = '2px';
    st.blk.style.width = 'calc(100% - 4px)';
    st.target = {date: colEl.dataset.date, min};
    $('small', st.blk).textContent = `${hmMin(min)}–${hmMin(min + callMin(st.p))} · перенести сюда`;
  };
  const end = (e, drop) => {
    const st = CalDrag.st;
    if (!st || (e && e.pointerId !== st.id)) return;
    clearTimeout(st.timer);
    CalDrag.st = null;
    if (!st.on) return;
    CalDrag.dropped = Date.now();
    document.body.classList.remove('dragging-now');
    st.blk.classList.remove('cb-drag');
    if (!drop || !st.target) { App.render(); return; }
    const ts = tsOf(st.target.date, st.target.min);
    if (ts === st.p.callAt) { App.render(); return; }
    const before = st.p.callAt;
    People.patch(st.p.id, {callAt: ts}, `Созвон перенесён на ${when(ts)}`, '📅');
    syncCall(st.p.id);
    toast(`${People.name(st.p)}: ${when(ts)}`, {undo: () => { People.patch(st.p.id, {callAt: before}, 'Отменили перенос созвона', '↩'); syncCall(st.p.id); }});
  };
  if (!CalDrag.wired) {
    CalDrag.wired = true;
    document.addEventListener('pointermove', move, {passive: false});
    document.addEventListener('pointerup', e => end(e, true));
    document.addEventListener('pointercancel', e => end(e, false));
    document.addEventListener('touchmove', e => { if (CalDrag.st && CalDrag.st.on) e.preventDefault(); }, {passive: false});
  }
}
function calDragStart(st) {
  st.on = true;
  st.blk.classList.add('cb-drag');
  document.body.classList.add('dragging-now');
  if (navigator.vibrate && st.touch) { try { navigator.vibrate(12); } catch (err) { /* ничего */ } }
}

/* ── месяц ── */
function monthView(month) {
  const t = today();
  const first = monthStart(month), start = weekStart(first);
  const days = Array.from({length: 42}, (_, i) => addDays(start, i));
  const weeks = days[35] > monthEnd(month) ? days.slice(0, 35) : days;
  const calls = callsBetween(dateOf(start).getTime(), dateOf(addDays(start, weeks.length)).getTime());
  return `<div class="cal-month">${WD_SH.map(w => `<div class="cm-h">${w}</div>`).join('')}${weeks.map(d => {
    const L = calls.filter(p => isoTs(p.callAt) === d);
    return `<button class="cm-d ${d.slice(0, 7) !== month ? 'out' : ''} ${d === t ? 'is-today' : ''} ${d < t ? 'past' : ''}" data-day="${d}">
      <span class="cm-n">${Number(d.slice(8))}</span>
      ${L.slice(0, 3).map(p => `<span class="cm-c ${GROUP_TONE[p.type]} st-${callState(p)}">${hmMin(minOfDay(p.callAt))} ${esc(People.name(p).split(' ')[0])}</span>`).join('')}
      ${L.length > 3 ? `<span class="cm-more">ещё ${L.length - 3}</span>` : ''}</button>`;
  }).join('')}</div>`;
}

/* ── список ── */
function listView() {
  const t = today();
  const all = Store.all('people').filter(hasCall).sort((a, b) => a.callAt - b.callAt);
  const upcoming = all.filter(p => isoTs(p.callAt) >= t);
  const past = all.filter(p => isoTs(p.callAt) < t).reverse().slice(0, 30);
  const byDay = list => { const m = {}; list.forEach(p => { const d = isoTs(p.callAt); (m[d] = m[d] || []).push(p); }); return Object.entries(m); };
  const row = p => { const st = callState(p); return `<button class="cl-row" data-call="${p.id}"><time>${hmMin(minOfDay(p.callAt))}</time><span class="cb-dot ${GROUP_TONE[p.type]}"></span><span class="cl-n"><b>${esc(People.name(p))}</b><small>${groupName(p.type)}${People.sub(p) ? ' · ' + esc(People.sub(p)) : ''}</small></span><span class="st ${st === 'done' ? 'good' : st === 'noshow' ? 'bad' : st === 'late' ? 'warn' : ''}">${CALL_STATE[st]}</span></button>`; };
  const block = (title, list) => `<div class="card cl-card"><div class="card-head"><h2>${title}</h2><span class="note">${list.length}</span></div>${list.length ? byDay(list).map(([d, L]) => `<div class="cl-day"><p class="rec-h">${cap(dayOrWhen(d) === dayShort(d) ? dayWd(d) : dayOrWhen(d) + ', ' + dayWd(d))}</p>${L.map(row).join('')}</div>`).join('') : '<p class="note">Пусто.</p>'}</div>`;
  return `<div class="two">${block('Впереди', upcoming)}${block('Прошедшие', past)}</div>`;
}

function callStatsHtml(S) {
  return `<div class="two">
    <div class="card"><div class="card-head"><h2>По группам</h2><span class="note">прошли · не состоялись · впереди</span></div>
      <div class="cs-groups">${S.byGroup.filter(g => g.all).map(g => `<div class="cs-g"><span class="cb-dot ${GROUP_TONE[g.k]}"></span><b>${groupName(g.k)}</b>
        <span class="cs-bar"><i class="good" style="width:${(g.done / g.all * 100).toFixed(1)}%"></i><i class="bad" style="width:${(g.noshow / g.all * 100).toFixed(1)}%"></i><i class="set" style="width:${(g.set / g.all * 100).toFixed(1)}%"></i></span>
        <span class="cs-n">${g.done} · ${g.noshow} · ${g.set}</span></div>`).join('') || '<p class="note">Нет созвонов.</p>'}</div>
      <div class="kpis" style="margin-top:14px">${[[S.future, 'впереди'], [S.late, 'ждут отметки'], [S.avg === null ? '—' : S.avg + ' мин', 'средняя длина']].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('')}</div></div>
    <div class="card"><div class="card-head"><h2>Кто ведёт</h2><span class="note">созвонов · из них прошли</span></div>
      ${S.byOwner.length ? hbarList(S.byOwner, {color: 'var(--link)', sub: r => `прошли ${r.done}`}) : '<p class="note">Созвоны без ведущего.</p>'}</div>
    <div class="card"><div class="card-head"><h2>Эксперты по направлениям</h2><span class="note">созвоны в периоде</span></div>
      ${S.byDir.some(x => x.v) ? hbarList(S.byDir.filter(x => x.v).sort((a, b) => b.v - a.v), {color: 'var(--violet)', sub: r => `прошли ${r.done}`}) : '<p class="note">С экспертами созвонов нет.</p>'}
      ${S.byDir.some(x => !x.v) ? `<p class="note" style="margin-top:8px">Без созвонов: ${S.byDir.filter(x => !x.v).map(x => x.name).join(', ')}</p>` : ''}</div>
    <div class="card"><div class="card-head"><h2>Партнёры по категориям</h2></div>
      ${S.byCat.length ? hbarList(S.byCat.sort((a, b) => b.v - a.v), {color: 'var(--good)', sub: r => `прошли ${r.done}`}) : '<p class="note">С партнёрами созвонов нет.</p>'}</div>
    <div class="card"><div class="card-head"><h2>Когда созваниваемся</h2><span class="note">по часам начала</span></div>
      <div class="hours">${S.byHour.map(h => `<div title="${h.name}: ${h.v}"><i style="height:${(h.v / Math.max(1, ...S.byHour.map(x => x.v)) * 100).toFixed(0)}%"></i><small>${h.name.slice(0, 2)}</small></div>`).join('')}</div></div>
    <div class="card"><div class="card-head"><h2>По дням недели</h2></div>
      ${hbarList(S.byWd, {color: 'var(--gold)'})}</div>
  </div>`;
}
