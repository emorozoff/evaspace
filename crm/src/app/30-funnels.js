/* Воронки: доска по этапам с перетаскиванием, разбивка по сегментам
   (салоны красоты, пилатес… — условия задаются в «Настройках»), матрица
   «сегмент × этап» и критерии этапов. Работает для клиенток, экспертов
   и партнёров — у каждой воронки своя сущность. */

function entityList(col) {
  if (col === 'clients') return Clients.visible();
  if (col === 'experts') return Experts.all();
  return Partners.all();
}
function entityCanEdit(col, e) {
  if (col === 'clients') return Clients.canEdit(e);
  return Who.can(col === 'experts' ? 'experts.edit' : 'partners.edit') && !Who.readOnly();
}

function kanbanCard(col, e, fid) {
  const late = (e.stageAt && daysBetween(isoTs(e.stageAt), today())) || 0;
  const st = Funnels.stage(fid, e.stage);
  const lateTone = !st || st.won || e.stage === 'lost' ? '' : late > 14 ? 'late' : '';
  const nextTask = Ev.list(e).filter(x => x.kind === 'task' && !x.done).sort((a, b) => String(a.due).localeCompare(String(b.due)))[0];
  const due = nextTask && nextTask.due ? `<span class="kc-due ${nextTask.due < today() ? 'late' : nextTask.due === today() ? 'today' : ''}" title="${esc(nextTask.title)}">${icon('clock')}${dayOrWhen(nextTask.due)}</span>` : '';
  const m = Team.get(e.manager);
  const can = entityCanEdit(col, e);
  let mid = '', money = '';
  if (col === 'clients') {
    const d = cx(e);
    mid = `${e.org ? `<div class="kc-org">${esc(e.org)}</div>` : e.city ? `<div class="kc-org">${esc(e.city)}${e.niche ? ' · ' + esc(e.niche) : ''}</div>` : ''}
      ${(e.tags || []).length ? `<div class="tags-line">${tagsHtml(e.tags, 2)}</div>` : ''}`;
    if (d.pending.length) money = `<span class="kc-money">${rub(sum(d.pending, p => p.amount || settings().price))}</span>`;
    else if (d.ltv) money = `<span class="kc-money">${rubK(d.ltv)}</span>`;
    if (d.waiting) money = `<span class="pill rose" title="Ждёт ответа">ждёт ответа</span>` + money;
  } else if (col === 'experts') {
    const s = Experts.stats(e);
    mid = `<div class="kc-org">${esc(e.direction || '')}${e.audience ? ` · ${fmt(e.audience)} подписчиков` : ''}</div>
      <div class="kc-row">${s.content.length ? `${icon('cam')}${s.live}/${s.content.length} МК` : ''}${e.shootAt ? `<span>съёмка ${dayShort(e.shootAt)}</span>` : ''}</div>`;
    if (s.revenue) money = `<span class="kc-money">${rubK(s.revenue)}</span>`;
  } else {
    const s = Partners.stats(e);
    mid = `<div class="kc-org">${esc(e.category || '')} · ${esc(e.city || '')}</div>
      <div class="kc-row">${Partners.offers(e).length ? `<span class="pill gold">${icon('gift')}${Partners.offers(e).length}</span>` : ''}${s.n ? `<span>${s.n} ${plural(s.n, 'клиентка', 'клиентки', 'клиенток')}</span>` : ''}</div>`;
  }
  return `<div class="kc ${can ? 'can' : ''} ${col === 'clients' && cx(e).waiting ? 'waiting' : ''}" data-task="${e.id}" data-href="${entHref(col, e)}" tabindex="0">
    <div class="kc-name">${esc(entName(col, e))}</div>
    ${mid}
    <div class="kc-row">${m ? Team.av(m) : '<span class="av none" title="Без менеджера">?</span>'}<span class="kc-days ${lateTone}" title="Дней на этапе">${late} дн.</span>${due}<span class="sp"></span>${money}</div>
  </div>`;
}

App.register('funnels', {
  title: 'Воронки',
  render(root) {
    const list = Funnels.list().filter(f => f.entity !== 'clients' || Who.can('clients.view')).filter(f => f.entity === 'clients' || Who.can(f.entity + '.view'));
    let fid = View.get('fn.id', 'sales');
    if (!list.find(f => f.id === fid)) fid = list[0].id;
    const f = Funnels.get(fid);
    const col = f.entity;
    const view = View.get('fn.view', 'board');
    const segF = col === 'clients' ? View.get('fn.seg', '') : '';
    const mgrF = View.get('fn.mgr', '');
    const q = View.get('fn.q', '').trim().toLowerCase();
    const all = entityList(col).filter(e => Funnels.of(col, e) === fid);
    const segs = col === 'clients' ? Segments.all() : [];
    const segOf = e => cx(e).segment;
    let items = all.filter(e => {
      if (segF === 'none' && segOf(e)) return false;
      if (segF && segF !== 'none') { const s = segOf(e); if (!s || s.id !== segF) return false; }
      if (mgrF === 'me' && e.manager !== Who.id()) return false;
      if (mgrF === 'none' && e.manager) return false;
      if (q && !entName(col, e).toLowerCase().includes(q) && !String(e.org || e.city || '').toLowerCase().includes(q)) return false;
      return true;
    });
    const canAdd = col === 'clients' ? Who.can('clients.edit') : Who.can(col + '.edit');

    const tabs = list.map(x => [x.id, x.name, entityList(x.entity).filter(e => Funnels.of(x.entity, e) === x.id && e.stage !== 'lost').length]);
    const segStrip = col === 'clients' ? `<div class="seg-strip">
      <button class="chip ${!segF ? 'on' : ''}" data-segf="">Все <b>${all.length}</b></button>
      ${segs.map(s => { const n = all.filter(e => (segOf(e) || {}).id === s.id).length; return `<button class="chip ${segF === s.id ? 'on' : ''}" data-segf="${s.id}" title="${esc((s.rules || []).map(ruleText).join(s.match === 'any' ? ' или ' : ' и '))}"><i class="dot" style="background:${esc(s.color)}"></i>${esc(s.name)} <b>${n}</b></button>`; }).join('')}
      <button class="chip ${segF === 'none' ? 'on' : ''}" data-segf="none">Без сегмента <b>${all.filter(e => !segOf(e)).length}</b></button>
      ${Who.can('funnels.edit') ? '<a class="btn sm ghost" href="#settings" data-goset="segments">+ Сегмент и условия</a>' : ''}
    </div>` : '';

    let content = '';
    if (view === 'board') {
      const cols = [...f.stages.map(s => ({s, items: items.filter(e => e.stage === s.id)})), {s: {...LOST, about: 'Отказ с причиной. Раз в квартал — вернуться с новым предложением.'}, items: items.filter(e => e.stage === 'lost'), lost: true}];
      const orphan = items.filter(e => e.stage !== 'lost' && !f.stages.some(s => s.id === e.stage));
      if (orphan.length) cols[0].items.push(...orphan);
      const sumOf = (s, its) => {
        if (col !== 'clients') return '';
        if (s.id === 'invoice') { const v = sum(its, e => sum(cx(e).pending, p => p.amount || settings().price)); return v ? `ждём ${rubK(v)}` : ''; }
        if (s.won) { const v = sum(its, e => cx(e).ltv); return v ? `принесли ${rubK(v)}` : ''; }
        return '';
      };
      const collapsedLost = View.get('fn.lostOpen', false);
      content = `<div class="kb" id="board">${cols.map(({s, items: its, lost}) => `
        <div class="kb-col ${lost ? 'lost-col' : ''} ${s.won ? 'won-col' : ''}" data-col="${s.id}">
          <div class="kb-h"><b>${esc(s.name)}</b>${s.about ? `<button class="help-dot" title="${esc(s.about)}" data-nodrag>?</button>` : ''}<span class="kb-n">${its.length}</span>${sumOf(s, its) ? `<span class="kb-sum">${sumOf(s, its)}</span>` : ''}</div>
          <div class="kb-list">${(lost && !collapsedLost && its.length > 3 ? its.slice(0, 3) : its).sort((a, b) => (b.stageAt || 0) - (a.stageAt || 0)).map(e => kanbanCard(col, e, fid)).join('')}
            ${lost && !collapsedLost && its.length > 3 ? `<button class="kb-more-done" data-lost-open>Показать все отказы (${its.length})</button>` : ''}
            ${canAdd && !lost && !Who.readOnly() ? `<button class="kb-add" data-add="${s.id}">${icon('plus')}Добавить</button>` : ''}</div>
        </div>`).join('')}</div>`;
    } else if (view === 'matrix' && col === 'clients') {
      const rows = [...segs.map(s => ({id: s.id, name: s.name, color: s.color, list: all.filter(e => (segOf(e) || {}).id === s.id)})), {id: 'none', name: 'Без сегмента', color: 'var(--ink-3)', list: all.filter(e => !segOf(e))}];
      const max = Math.max(1, ...rows.flatMap(r => f.stages.map(s => r.list.filter(e => e.stage === s.id).length)));
      content = `<div class="table-wrap"><table class="t matrix"><thead><tr><th>Сегмент</th>${f.stages.map(s => `<th class="c">${esc(s.name)}</th>`).join('')}<th class="c">Отказ</th><th class="r">Всего</th><th class="r">Конверсия в оплату</th></tr></thead><tbody>
        ${rows.map(r => {
          const won = r.list.filter(e => f.stages.find(s => s.id === e.stage && s.won)).length;
          const lead = r.list.filter(e => Funnels.idx(fid, e.stage) >= Funnels.idx(fid, 'lead') || e.stage === 'lost').length;
          return `<tr><td><span class="row" style="gap:8px;align-items:center;flex-wrap:nowrap"><i class="dot" style="background:${esc(r.color)}"></i>${esc(r.name)}</span></td>
          ${f.stages.map(s => { const n = r.list.filter(e => e.stage === s.id).length; return `<td class="cell ${n ? '' : 'zero'}" data-cell="${r.id}"><span class="heat" style="background:color-mix(in srgb, var(--link) ${Math.round(n / max * 38)}%, transparent)"><b>${n}</b></span></td>`; }).join('')}
          <td class="cell ${r.list.filter(e => e.stage === 'lost').length ? '' : 'zero'}" data-cell="${r.id}">${r.list.filter(e => e.stage === 'lost').length}</td>
          <td class="r">${r.list.length}</td><td class="r">${lead ? pct(won / lead) : '—'} <small class="muted">${won}/${lead}</small></td></tr>`;
        }).join('')}
      </tbody></table></div>
      <p class="note" style="margin-top:8px">Конверсия — от заявки до оплаты: сколько из дошедших до «Заявка получена» оплатили. Нажмите на ячейку, чтобы открыть этот сегмент на доске.</p>`;
    } else {
      content = `<div class="crit">${f.stages.map((s, i) => {
        const its = all.filter(e => e.stage === s.id);
        const avg = its.length ? Math.round(sum(its, e => (e.stageAt ? daysBetween(isoTs(e.stageAt), today()) : 0)) / its.length) : 0;
        return `<div><b>${i + 1}. ${esc(s.name)}${s.won ? ' ✓' : ''}</b>${esc(s.about || 'Критерий не задан')}<p class="note" style="margin-top:6px">сейчас: ${its.length} · в среднем ${avg} дн. на этапе</p></div>`;
      }).join('')}<div><b>Отказ</b>Причина обязательна: ${esc(LOST_REASONS.join(', '))}.<p class="note" style="margin-top:6px">сейчас: ${all.filter(e => e.stage === 'lost').length}</p></div></div>
      <p class="note">${esc(f.about || '')}${Who.can('funnels.edit') ? ' Этапы и критерии меняются в «Настройках → Воронки».' : ''}</p>`;
    }

    root.innerHTML = `
      ${pageHead('Воронки', esc(f.about || ''), `${Who.can('funnels.edit') ? `<a class="btn" href="#settings" data-goset="funnels">${icon('gear')}Этапы</a>` : ''}${canAdd && !Who.readOnly() ? `<button class="btn primary" data-add="${f.stages[0].id}">${icon('plus')}${col === 'clients' ? 'Клиентка' : col === 'experts' ? 'Эксперт' : 'Партнёр'}</button>` : ''}`)}
      ${tabsHtml('fn.id', tabs, fid)}
      ${segStrip}
      <div class="t-bar">
        <input class="input sm t-search" id="fnQ" placeholder="Поиск по имени" value="${esc(View.get('fn.q', ''))}">
        <select class="select sm" id="fnMgr">${opts([['', 'Все менеджеры'], ['me', 'Мои'], ['none', 'Без менеджера']], mgrF)}</select>
        <span class="t-bar-sp"></span>
        <div class="seg">${[['board', 'Доска'], ...(col === 'clients' ? [['matrix', 'Сегменты × этапы']] : []), ['stages', 'Критерии этапов']].map(([k, n]) => `<button data-fnview="${k}" class="${view === k ? 'on' : ''}">${n}</button>`).join('')}</div>
      </div>
      ${view === 'board' ? `<p class="note" style="margin:-6px 0 10px">Перетащите карточку в другой этап: мышью — сразу, пальцем — подержите полсекунды. В «Отказ» — с причиной.</p>` : ''}
      ${content}`;

    wireTabs(root);
    let qt;
    $('#fnQ', root).oninput = e => { clearTimeout(qt); const v = e.target.value; qt = setTimeout(() => { View.set('fn.q', v); App.render({focus: 'fnQ'}); }, 250); };
    $('#fnMgr', root).onchange = e => { View.set('fn.mgr', e.target.value); App.render(); };
    on(root, 'click', '[data-segf]', (e, el) => { View.set('fn.seg', el.dataset.segf); App.render(); });
    on(root, 'click', '[data-fnview]', (e, el) => { View.set('fn.view', el.dataset.fnview); App.render(); });
    on(root, 'click', '[data-cell]', (e, el) => { View.set('fn.seg', el.dataset.cell); View.set('fn.view', 'board'); App.render(); });
    on(root, 'click', '[data-lost-open]', () => { View.set('fn.lostOpen', true); App.render(); });
    on(root, 'click', '[data-goset]', (e, el) => { View.set('st.tab', el.dataset.goset); });
    on(root, 'click', '[data-add]', (e, el) => {
      if (col === 'clients') openClientForm(null), setTimeout(() => { const s = $('#ff-stage'); if (s) s.value = el.dataset.add; const fn = $('#ff-funnel'); if (fn) fn.value = fid; }, 20);
      else if (col === 'experts') openExpertForm(null, el.dataset.add);
      else openPartnerForm(null, el.dataset.add);
    });
    on(root, 'click', '.kc', (e, el) => { if (e.target.closest('button, a')) return; location.hash = el.dataset.href; });
    on(root, 'keydown', '.kc', (e, el) => { if (e.key === 'Enter') location.hash = el.dataset.href; });
    const board = $('#board', root);
    if (board) Drag.board(board, {
      canDrag: id => entityCanEdit(col, Store.get(col, id)),
      onDrop: async (id, stage) => {
        const e = Store.get(col, id);
        if (!e || e.stage === stage) { App.render(); return; }
        let reason = '';
        if (stage === 'lost') {
          const anchor = $(`[data-col="lost"] .kb-h`, root) || root;
          reason = await pickPop(anchor, LOST_REASONS.map(r => [r, r]), '');
          if (reason === null) { App.render(); return; }
        }
        moveStage(col, id, stage, {reason});
        const nm = (Funnels.stage(fid, stage) || {}).name;
        toast(`${entName(col, e)} → ${nm}`, {undo: () => moveStage(col, id, e.stage, {reason: 'отмена переноса'})});
      },
    });
  },
});
