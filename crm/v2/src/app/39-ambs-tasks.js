/* 6. Амбассадоры — реферальная программа: личная ссылка, кого привели, кто из них купил, аудитория,
      вознаграждения (начислено / выплачено), рейтинг.
   7. Задачи — «связаться через неделю», «прислать материалы»: по контакту или общие, со сроком и
      исполнителем. Просроченные и на сегодня — в меню и на главной. */

/* ── амбассадоры ── */
const rewardsOf = p => (p.rewards || []).filter(Boolean);
const owed = p => rewardsOf(p).filter(r => !r.paid).reduce((a, r) => a + (Number(r.amount) || 0), 0);
App.register('ambs', {
  title: 'Амбассадоры',
  render(root) {
    const L = People.all('amb'), canEdit = People.canEdit();
    const rows = L.map(p => { const inv = People.invited(p); return {p, inv, ans: inv.filter(x => x.s1 === 'done').length, buy: inv.filter(x => Sales.pays(x).length).length, aud: Number(p.followers) || 0}; })
      .sort((a, b) => b.buy - a.buy || b.inv.length - a.inv.length);
    const tot = k => rows.reduce((a, r) => a + (k === 'inv' ? r.inv.length : r[k]), 0);
    const rules = (Store.get('cfg', 'ambrules') || {}).text || '';
    root.innerHTML = `
      ${pageHead('Амбассадоры', 'Реферальная программа: у каждого своя ссылка — кто по ней пришёл, заполнил анкету и купил. Вознаграждения и рейтинг. Знакомство с амбассадором — в «Кастдеве».',
        canEdit ? `<a class="btn" href="#amb">${icon('funnel')}Кастдев амбассадоров</a><button class="btn primary" data-aadd>${icon('plus')}Амбассадор</button>` : '')}
      <div class="kpis kpis-4 card">${[[L.length, 'амбассадоров'], [tot('inv'), 'пришли по их ссылкам'], [tot('buy'), 'из них купили'], [rub(L.reduce((a, p) => a + owed(p), 0)), 'начислено, не выплачено']].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('')}</div>
      <div class="two section">
        ${card('Рейтинг', 'по покупкам приглашённых', rows.filter(r => r.inv.length).length ? hbarList(rows.filter(r => r.inv.length).slice(0, 8).map(r => ({name: People.name(r.p), v: r.buy || 0})), {color: 'var(--good)', sub: r => ''}) : '<p class="note">Появится, когда по ссылкам придут первые люди.</p>')}
        ${card('Условия программы', 'видит вся команда', canEdit ? `<textarea class="textarea" id="ambRules" style="min-height:120px" placeholder="Например: 500 ₽ за каждую подругу, купившую подписку; месяц Евы в подарок за 3 приглашения">${esc(rules)}</textarea>` : `<p>${esc(rules) || '<span class="note">Не заполнены.</span>'}</p>`)}
      </div>
      <div class="card section" style="padding:0;overflow:auto">${rows.length ? `<table class="t base-t"><thead><tr><th>Амбассадор</th><th class="r">Аудитория</th><th class="r">Пришли</th><th class="r">Анкета</th><th class="r">Купили</th><th class="r">К выплате</th><th></th></tr></thead><tbody>
        ${rows.map(r => `<tr data-open="${r.p.id}"><td><div class="bt-who">${avatar(People.name(r.p))}<span><b>${esc(People.name(r.p))}</b><small>${esc(r.p.code)}${(r.p.answers || {}).where ? ' · ' + esc([].concat(r.p.answers.where).map(noEmo).join(', ')) : ''}</small></span></div></td>
          <td class="r">${r.aud ? fmt(r.aud) : esc(noEmo((r.p.answers || {}).size || '—'))}</td><td class="r">${r.inv.length}</td><td class="r">${r.ans}</td><td class="r"><b>${r.buy}</b></td><td class="r">${owed(r.p) ? rub(owed(r.p)) : '—'}</td>
          <td class="r nowrap"><button class="btn xs" data-act="link" data-pid="${r.p.id}">Ссылка</button>${canEdit ? `<button class="btn xs" data-reward="${r.p.id}">Начислить</button>${owed(r.p) ? `<button class="btn xs primary" data-paid="${r.p.id}">Выплачено</button>` : ''}` : ''}</td></tr>`).join('')}
      </tbody></table>` : '<p class="note" style="padding:16px">Амбассадоров пока нет — добавьте в «Кастдеве».</p>'}</div>`;
    on(root, 'click', '[data-open]', (e, el) => { if (!e.target.closest('button, a')) App.go('p-' + el.dataset.open); });
    on(root, 'click', '[data-aadd]', () => openAdd('amb'));
    wireActs(root);
    const ar = $('#ambRules', root);
    if (ar) ar.onchange = () => Store.put('cfg', 'ambrules', {text: ar.value.trim(), at: Date.now()});
    on(root, 'click', '[data-reward]', (e, el) => {
      const p = People.get(el.dataset.reward);
      openModal({title: `Начислить: ${People.name(p)}`, body: `<div class="grid2"><label class="field"><span>Сумма, ₽</span><input class="input" type="number" id="rwA" value="500"></label><label class="field"><span>За что</span><input class="input" id="rwN" placeholder="подруга купила подписку"></label></div>`,
        foot: '<button class="btn" data-close>Отмена</button><button class="btn primary" data-ok>Начислить</button>',
        onMount(m, close) { $('[data-ok]', m).onclick = () => { const amount = Number($('#rwA', m).value) || 0, note = $('#rwN', m).value.trim(); People.patch(p.id, {rewards: [...rewardsOf(p), {id: uid(), at: Date.now(), amount, note, paid: false}]}, `Начислено ${rub(amount)}${note ? ': ' + note : ''}`, '🎁'); close(); }; }});
    });
    on(root, 'click', '[data-paid]', (e, el) => { const p = People.get(el.dataset.paid); People.patch(p.id, {rewards: rewardsOf(p).map(r => (r.paid ? r : {...r, paid: Date.now()}))}, `Выплачено ${rub(owed(p))}`, '💸'); });
  },
});

/* ── задачи ── */
const Tasks = {
  all() { return Store.all('tasks'); },
  open() { return this.all().filter(t => !t.done); },
  /* на сегодня и просроченные */
  due() { const d = today(); return this.open().filter(t => t.due && t.due <= d); },
};
const isMineTask = t => !t.owner || t.owner === Who.id();
function addTask(f) { return Store.add('tasks', {text: f.text, pid: f.pid || null, due: f.due || '', owner: f.owner || Who.id(), done: false, at: Date.now(), by: Who.id()}); }
function doneTask(t, on = true) { Store.patch('tasks', t.id, on ? {done: true, doneAt: Date.now(), doneBy: Who.id()} : {done: false, doneAt: null}); }
const taskRow = (t, canEdit, withWho = true) => { const p = People.get(t.pid), o = Team.get(t.owner), late = t.due && t.due < today() && !t.done;
  return `<div class="tk ${t.done ? 'done' : ''} ${late ? 'late' : ''}"><input type="checkbox" data-tdone="${t.id}" ${t.done ? 'checked' : ''} ${canEdit ? '' : 'disabled'} aria-label="Сделано">
    <span class="tk-t"><b>${esc(t.text)}</b><small>${withWho && p ? `<a href="#p-${p.id}">${esc(People.name(p))}</a> · ` : ''}${t.due ? `<span class="${late ? 'bad-t' : ''}">${esc(dayOrWhen(t.due))}</span>` : 'без срока'}${o ? ` · ${esc(Team.first(o))}` : ''}</small></span>
    ${canEdit ? `<button class="icon-btn" data-tdel="${t.id}" title="Удалить">${icon('trash')}</button>` : ''}</div>`; };
function taskForm(pid = '') {
  return `<form class="tk-add" data-tadd="${pid}"><input class="input sm" name="text" placeholder="${pid ? 'Задача по контакту: написать через неделю…' : 'Новая задача…'}" required>
    <input class="input sm" type="date" name="due" value="${addDays(today(), 1)}" aria-label="Срок">
    <select class="select sm" name="owner" aria-label="Кто">${Team.assignable().map(m => `<option value="${m.id}" ${m.id === Who.id() ? 'selected' : ''}>${esc(Team.first(m))}</option>`).join('')}</select>
    ${pid ? '' : '<button type="button" class="btn sm" data-tpick>Контакт</button><input type="hidden" name="pid">'}<button class="btn sm primary">${icon('plus')}Добавить</button></form>`;
}
function wireTasks(root) {
  on(root, 'change', '[data-tdone]', (e, el) => doneTask(Store.get('tasks', el.dataset.tdone), el.checked));
  on(root, 'click', '[data-tdel]', (e, el) => Store.remove('tasks', el.dataset.tdel));
  on(root, 'click', '[data-tpick]', async (e, el) => {
    const v = await pickPop(el, People.all().slice(0, 300).map(p => [p.id, `${People.name(p)} · ${TYPES[p.type].one}`]), '');
    if (!v) return;
    el.form.pid.value = v; el.textContent = People.name(People.get(v));
  });
  on(root, 'submit', '[data-tadd]', (e, f) => {
    e.preventDefault();
    const text = f.text.value.trim();
    if (!text) return;
    addTask({text, due: f.due.value, owner: f.owner.value, pid: f.dataset.tadd || (f.pid ? f.pid.value : '')});
    toast('Задача добавлена');
  });
}
function tasksBox(p, canEdit) {
  const L = Tasks.all().filter(t => t.pid === p.id).sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || String(a.due || '9').localeCompare(String(b.due || '9')));
  return `<div class="tk-box"><h3 class="tf-h">Задачи по контакту</h3>${L.map(t => taskRow(t, canEdit, false)).join('') || '<p class="note">Нет задач.</p>'}${canEdit ? taskForm(p.id) : ''}</div>`;
}
App.register('tasks', {
  title: 'Задачи',
  render(root) {
    const who = View.get('tk.who', 'me'), canEdit = People.canEdit();
    const L = Tasks.all().filter(t => who === 'all' || (who === 'me' ? isMineTask(t) : t.owner === who));
    const d = today(), wk = addDays(d, 7);
    const open = L.filter(t => !t.done).sort((a, b) => String(a.due || '9').localeCompare(String(b.due || '9')));
    const sec = (title, list, empty) => `<section class="card section"><div class="card-head"><h2>${title} <span class="h-n">${list.length}</span></h2></div>${list.map(t => taskRow(t, canEdit)).join('') || `<p class="note">${empty}</p>`}</section>`;
    root.innerHTML = `
      ${pageHead('Задачи', 'Что сделать по контактам: написать, позвонить, прислать материалы. Просроченные и на сегодня видны в меню.')}
      <div class="t-bar"><select class="select sm t-filter" id="tkWho"><option value="me">Мои</option><option value="all" ${who === 'all' ? 'selected' : ''}>Все</option>${Team.assignable().map(m => `<option value="${m.id}" ${who === m.id ? 'selected' : ''}>${esc(Team.name(m))}</option>`).join('')}</select><span class="t-bar-sp"></span><span class="note">открытых: ${open.length}</span></div>
      ${canEdit ? `<div class="card section">${taskForm()}</div>` : ''}
      ${sec('Просрочено', open.filter(t => t.due && t.due < d), 'Ничего не просрочено 👌')}
      ${sec('Сегодня', open.filter(t => t.due === d), 'На сегодня задач нет.')}
      ${sec('На неделе', open.filter(t => t.due > d && t.due <= wk), 'Пусто.')}
      ${sec('Позже и без срока', open.filter(t => !t.due || t.due > wk), 'Пусто.')}
      ${sec('Сделано', L.filter(t => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)).slice(0, 15), 'Пока ничего.')}`;
    $('#tkWho', root).onchange = e => { View.set('tk.who', e.target.value); App.render(); };
    wireTasks(root);
  },
});
