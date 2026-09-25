/* Команда: сначала список — должность, направление, ставка, формат, оклад,
   с какого месяца, статус и вход в штаб; затем вид по направлениям.
   Оклад связан с планом платежей в «Деньгах»: поменяли здесь — поменялось
   там. Не активированные люди в плане платежей не считаются. */

const PERSON_STATUS = {
  active:   {name: 'В команде',       tone: 'good'},
  inactive: {name: 'Не активирован',  tone: 'warn'},
  vacancy:  {name: 'Вакансия',        tone: 'line'},
};
const RATES = ['Полная', 'Частичная', 'Проектная'];
const FORMATS = ['Офис', 'Удалённо', 'Гибрид'];
const pStatus = p => (PERSON_STATUS[p.status] ? p.status : 'active');

App.register('team', {
  title: 'Команда',
  render(root) {
    const owner = Auth.can('team.manage');
    const seePay = Auth.can('payroll.view');
    const view = View.get('team.view', 'list');
    const ppl = people();
    const accs = Store.all('accounts');
    const invs = Store.all('invites');
    const tasks = Tasks.all();
    const accOf = pid => accs.find(a => a.personId === pid && a.active !== false);
    const invOf = pid => invs.find(i => i.personId === pid && !i.usedBy);
    const load = p => {
      const open = tasks.filter(t => t.assignee === p.id && Tasks.isOpen(t));
      return {open: open.length, late: open.filter(t => Tasks.overdue(t)).length};
    };
    const active = ppl.filter(p => pStatus(p) === 'active');
    const fot = sum(active, p => Number(p.salary) || 0);
    const access = p => {
      const acc = accOf(p.id), inv = invOf(p.id);
      if (acc) return `${rolePill(acc.role)}<small>${acc.lastSeen ? 'был ' + timeAgo(acc.lastSeen) : ''}</small>`;
      if (inv) return `<span class="pill warn">код выдан</span>${owner ? `<button class="link-btn" data-invite-for="${p.id}">код</button>` : ''}`;
      return owner && pStatus(p) !== 'vacancy' ? `<button class="btn xs" data-invite-for="${p.id}">${icon('key')}Пригласить</button>` : '<span class="muted">нет входа</span>';
    };

    const table = `<div class="table-wrap"><table class="t team-t">
      <thead><tr><th>Человек</th><th>Направление</th><th>Ставка · формат</th>${seePay ? '<th class="r">Оклад</th><th>С</th>' : ''}<th>Статус</th><th>Вход в штаб</th><th class="r">Задачи</th>${owner ? '<th></th>' : ''}</tr></thead>
      <tbody>${ppl.map(p => {
        const l = load(p), st = PERSON_STATUS[pStatus(p)];
        return `<tr class="${pStatus(p) !== 'active' ? 'dim' : ''}">
          <td><a class="tp" href="#p-${p.id}">${avatar(p)}<span><b>${esc(p.name || 'Имя не указано')}</b><small>${esc(p.title || '')}</small></span></a></td>
          <td>${dirPill(p.dir) || '<span class="muted">—</span>'}</td>
          <td class="soft">${esc([p.rate, p.format].filter(Boolean).join(' · ') || '—')}</td>
          ${seePay ? `<td class="r nowrap">${p.salary ? rub(p.salary) : '<span class="muted">—</span>'}</td><td class="nowrap soft">${p.startMonth ? monthShort(p.startMonth) : '—'}</td>` : ''}
          <td><span class="pill ${st.tone}">${st.name}</span></td>
          <td class="tp-acc">${access(p)}</td>
          <td class="r nowrap"><button class="link-btn" data-person-tasks="${p.id}">${l.open}</button>${l.late ? ` <span class="bad" title="просрочено">· ${l.late}</span>` : ''}</td>
          ${owner ? `<td class="r"><button class="icon-btn" data-person-edit="${p.id}" title="Изменить">${icon('edit')}</button></td>` : ''}
        </tr>`;
      }).join('')}</tbody>
      ${seePay ? `<tfoot><tr class="total"><td colspan="3">Фонд оплаты труда в месяц — активные</td><td class="r nowrap">${rub(fot)}</td><td colspan="${owner ? 5 : 4}" class="soft">с взносами ${rub(Math.round(fot * (1 + settings().insurance)))}</td></tr></tfoot>` : ''}
    </table></div>`;

    const card = p => {
      const l = load(p), acc = accOf(p.id);
      const lead = Object.entries(Strategy.whales()).find(([, w]) => w.lead === p.id);
      return `<a class="person" href="#p-${p.id}">
        <div class="person-h">${avatar(p, 'lg')}<div class="person-n"><b>${esc(p.name || 'Имя не указано')}</b><span>${esc(p.title || '')}</span></div></div>
        <div class="person-tags">${pStatus(p) !== 'active' ? `<span class="pill ${PERSON_STATUS[pStatus(p)].tone}">${PERSON_STATUS[pStatus(p)].name}</span>` : ''}${lead ? `<span class="pill gold">ведёт «${DIRS[lead[0]].name}»</span>` : ''}${acc ? rolePill(acc.role) : ''}</div>
        <div class="person-f"><span>${l.open} ${plural(l.open, 'задача', 'задачи', 'задач')}</span>${l.late ? `<span class="bad">${l.late} просрочено</span>` : ''}</div>
      </a>`;
    };
    const groups = [...Object.keys(DIRS), ''].map(d => {
      const list = ppl.filter(p => (p.dir || '') === d);
      if (!list.length) return '';
      return `<div class="team-group"><div class="team-gh">${d ? `<i class="dot" style="background:${DIRS[d].color}"></i>${DIRS[d].name}<span>${DIRS[d].metric}</span>` : 'Без направления'}<em>${list.length}</em></div>
        <div class="people">${list.map(card).join('')}</div></div>`;
    }).join('');

    root.innerHTML = `
      ${pageHead('Команда', 'Люди, должности, условия и доступ в штаб. Нажмите на человека — откроется его страница.',
        `${owner ? `<button class="btn primary" data-person-add>${icon('plus')}Человек</button>` : ''}`)}
      <div class="team-bar">
        <div class="seg"><button data-tv="list" class="${view === 'list' ? 'on' : ''}">Список</button><button data-tv="dirs" class="${view === 'dirs' ? 'on' : ''}">По направлениям</button></div>
        <span class="team-sum">${ppl.length} ${plural(ppl.length, 'человек', 'человека', 'человек')} · в команде ${active.length}${seePay ? ` · ФОТ ${rubK(fot)} в месяц` : ''}</span>
      </div>
      ${ppl.length ? (view === 'dirs' ? groups : table) : '<div class="empty"><b>В команде пока никого</b>Добавьте людей кнопкой «Человек».</div>'}
      ${owner ? accessHtml(accs, invs) : ''}`;

    on(root, 'click', '[data-tv]', (e, el) => { View.set('team.view', el.dataset.tv); App.render(); });
    on(root, 'click', '[data-person-tasks]', (e, el) => { View.set('t.who', el.dataset.personTasks); View.set('t.late', false); View.set('t.dir', ''); View.set('t.goal', ''); App.go('tasks'); });
    on(root, 'click', '[data-person-edit]', (e, el) => editPerson(el.dataset.personEdit));
    on(root, 'click', '[data-person-add]', () => editPerson(null));
    on(root, 'click', '[data-invite-for]', (e, el) => { e.preventDefault(); issueInvite(el.dataset.inviteFor); });
    if (owner) wireAccess(root);
  },
});

/* оклад → план платежей: меняем суммы у связанных строк зарплаты,
   а если строки нет — заводим её с месяца начала до конца года */
function syncPayroll(pid) {
  const p = personById(pid);
  if (!p) return;
  const items = Store.all('plan').filter(it => it.group === 'payroll' && it.personId === pid);
  const salary = Number(p.salary) || 0;
  items.forEach(it => { if (it.amount !== salary && salary > 0) Store.patch('plan', it.id, {amount: salary}); });
  if (!items.length && salary > 0 && pStatus(p) === 'active') {
    const from = p.startMonth || monthOf(today());
    const months = CF_MONTHS.filter(m => m >= from);
    if (months.length) Store.put('plan', 'pay_' + pid, {title: p.title || personName(p), group: 'payroll', cat: 'payroll', amount: salary, months, personId: pid, insurance: true});
  }
}

function editPerson(id) {
  const p = id ? personById(id) : null;
  const v = p || {name: '', title: '', dir: 'product', status: 'active', rate: 'Полная', format: 'Удалённо', startMonth: monthOf(today())};
  const opt = (list, cur) => list.map(x => `<option ${x === cur ? 'selected' : ''}>${esc(x)}</option>`).join('');
  const months = monthRange('2026-08', '2027-12');
  openModal({
    title: p ? personName(p) : 'Новый человек',
    wide: true,
    body: `<div class="form-sec"><span class="label">Кто</span>
      <div class="grid3"><label class="field"><span>Имя и фамилия</span><input class="input" id="peName" value="${esc(v.name || '')}" placeholder="Пусто — вакансия"></label>
      <label class="field"><span>Должность</span><input class="input" id="peTitle" value="${esc(v.title || '')}" placeholder="Финансовый директор"></label>
      <label class="field"><span>Направление</span><select class="select" id="peDir"><option value="">Без направления</option>${Object.entries(DIRS).map(([k, d]) => `<option value="${k}" ${k === v.dir ? 'selected' : ''}>${d.name}</option>`).join('')}</select></label></div></div>
      <div class="form-sec"><span class="label">Условия</span>
      <div class="grid3"><label class="field"><span>Статус</span><select class="select" id="peStatus">${Object.entries(PERSON_STATUS).map(([k, s]) => `<option value="${k}" ${k === pStatus(v) ? 'selected' : ''}>${s.name}</option>`).join('')}</select><small>«Не активирован» — в плане платежей не считается</small></label>
      <label class="field"><span>Ставка</span><select class="select" id="peRate"><option value="">—</option>${opt(RATES, v.rate)}</select></label>
      <label class="field"><span>Формат</span><select class="select" id="peFormat"><option value="">—</option>${opt(FORMATS, v.format)}</select></label>
      <label class="field"><span>Оклад в месяц, ₽</span><input class="input num" id="peSalary" inputmode="numeric" value="${v.salary || ''}" placeholder="0 — пока без оклада"><small>попадёт в план платежей</small></label>
      <label class="field"><span>С какого месяца платим</span><select class="select" id="peStart">${months.map(m => `<option value="${m}" ${m === (v.startMonth || monthOf(today())) ? 'selected' : ''}>${monthName(m, true)}</option>`).join('')}</select></label></div></div>
      <div class="form-sec"><span class="label">Контакты</span>
      <div class="grid3"><label class="field"><span>Почта</span><input class="input" id="peEmail" value="${esc(v.email || '')}"></label>
      <label class="field"><span>Телефон</span><input class="input" id="pePhone" value="${esc(v.phone || '')}"></label>
      <label class="field"><span>Телеграм</span><input class="input" id="peTg" value="${esc(v.telegram || '')}" placeholder="@name"></label></div>
      <label class="field"><span>Почта для календаря <small class="note">если приглашения нужны на другую почту</small></span><input class="input" id="peCal" type="email" value="${esc(v.calEmail || '')}" placeholder="пусто — возьмём почту выше"></label></div>
      <div class="form-sec"><span class="label">Зона ответственности</span>
      <label class="field"><span>Обязанности</span><textarea class="textarea" id="peDuties" rows="2">${esc(v.duties || '')}</textarea></label>
      <label class="field"><span>Результат, по которому оцениваем (KPI)</span><textarea class="textarea" id="peKpi" rows="2">${esc(v.kpi || '')}</textarea></label></div>
      ${p ? '<p class="note">Если человек ушёл из команды, уберите его: задачи останутся, учётка будет отключена.</p>' : ''}`,
    foot: `${p && !p.founder ? '<button class="btn danger left" id="peDel">Убрать из команды</button>' : ''}${p ? `<a class="btn ghost" href="#p-${p.id}" data-close>Страница</a>` : ''}<button class="btn" data-close>Отмена</button><button class="btn primary" id="peSave">Сохранить</button>`,
    onMount(el, close) {
      $('#peSave', el).onclick = () => {
        const name = $('#peName', el).value.trim(), title = $('#peTitle', el).value.trim();
        if (!name && !title) return $('#peName', el).focus();
        const data = {name, title, dir: $('#peDir', el).value, status: $('#peStatus', el).value, rate: $('#peRate', el).value,
          format: $('#peFormat', el).value, salary: Math.max(0, Math.round(parseNum($('#peSalary', el).value))), startMonth: $('#peStart', el).value,
          email: $('#peEmail', el).value.trim(), phone: $('#pePhone', el).value.trim(), telegram: $('#peTg', el).value.trim(), calEmail: $('#peCal', el).value.trim(),
          duties: $('#peDuties', el).value.trim(), kpi: $('#peKpi', el).value.trim()};
        let pid = p ? p.id : null;
        if (p) Store.patch('people', p.id, data); else pid = Store.add('people', {...data, order: 50});
        syncPayroll(pid);
        close();
        toast(p ? 'Сохранено' : 'Человек добавлен');
      };
      const del = $('#peDel', el);
      if (del) del.onclick = async () => {
        if (!(await confirmPop(del, {text: `Убрать ${personName(p)} из команды? Учётка, если есть, будет отключена.`, yes: 'Да, убрать', danger: true}))) return;
        Store.patch('people', p.id, {archived: true});
        Store.all('accounts').filter(a => a.personId === p.id && a.role !== 'owner').forEach(a => Store.patch('accounts', a.id, {active: false}));
        close();
        toast('Человек убран из команды', {undo: () => Store.patch('people', p.id, {archived: false})});
      };
    },
  });
}

/* ── приглашения ── */
function inviteText(code) {
  return `Код приглашения в штаб Eva Club: ${code}. Откройте штаб по ссылке, нажмите «У меня приглашение» и введите код.`;
}
function copyText(text, btn) {
  const done = () => { if (btn) { const o = btn.innerHTML; btn.textContent = 'Скопировано'; setTimeout(() => { btn.innerHTML = o; }, 1500); } };
  try {
    navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
  } catch (e) { fallbackCopy(text, done); }
}
function fallbackCopy(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;left:-9999px;top:0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  ta.remove();
  if (ok) done(); else toast('Скопируйте код вручную: выделите его и нажмите Ctrl+C');
}
function issueInvite(pid) {
  const p = pid ? personById(pid) : null;
  const existing = p ? Store.all('invites').find(i => i.personId === pid && !i.usedBy) : null;
  openModal({
    title: p ? `Вход для: ${personName(p)}` : 'Код приглашения',
    body: `${p ? '' : `<div class="grid2"><label class="field"><span>Имя (если знаете)</span><input class="input" id="ivName" placeholder="Анна Смирнова"></label>
      <label class="field"><span>Роль в команде</span><input class="input" id="ivTitle" placeholder="SMM-менеджер"></label></div>
      <label class="field"><span>Направление</span><select class="select" id="ivDir"><option value="">Без направления</option>${Object.entries(DIRS).map(([k, d]) => `<option value="${k}">${d.name}</option>`).join('')}</select></label>`}
      <label class="field"><span>Доступ в штабе</span><select class="select" id="ivRole">${Object.entries(ROLES).filter(([k]) => k !== 'owner').map(([k, r]) => `<option value="${k}" ${k === (existing ? existing.role : 'member') ? 'selected' : ''}>${r.name} — ${r.about}</option>`).join('')}</select></label>
      <div class="invite-out" id="ivOut" ${existing ? '' : 'hidden'}>
        <span class="label">Код</span><b class="inv-code" id="ivCode">${existing ? esc(existing.id) : ''}</b>
        <p class="note" id="ivText">${existing ? esc(inviteText(existing.id)) : ''}</p>
        <button class="btn sm" id="ivCopy">${icon('copy')}Скопировать сообщение</button>
      </div>`,
    foot: `<button class="btn" data-close>Готово</button><button class="btn primary" id="ivGo">${existing ? 'Выдать новый код' : 'Создать код'}</button>`,
    onMount(el) {
      $('#ivGo', el).onclick = () => {
        let personId = pid;
        if (!p) {
          const name = $('#ivName', el).value.trim(), title = $('#ivTitle', el).value.trim();
          personId = Store.add('people', {name, title: title || 'Новый человек', dir: $('#ivDir', el).value, order: 50});
        }
        if (existing) Store.remove('invites', existing.id);
        const code = makeCode();
        const pp = personById(personId) || {};
        Store.put('invites', code, {role: $('#ivRole', el).value, personId, title: pp.title || '', dir: pp.dir || '', by: Tasks.meKey(), at: Date.now()});
        $('#ivCode', el).textContent = code;
        $('#ivText', el).textContent = inviteText(code);
        $('#ivOut', el).hidden = false;
        $('#ivGo', el).textContent = 'Выдать новый код';
      };
      $('#ivCopy', el).onclick = e => copyText(inviteText($('#ivCode', el).textContent), e.currentTarget);
    },
  });
}

/* ── доступы (основатель) ── */
function accessHtml(accs, invs) {
  const me = Auth.me();
  const owners = accs.filter(a => a.role === 'owner' && a.active !== false).length;
  const pending = invs.filter(i => !i.usedBy).sort((a, b) => (b.at || 0) - (a.at || 0));
  return `<section class="section">
    <div class="section-head"><h2>Вход в штаб</h2><span class="hint-inline">Роль решает, что человек видит. Пароли хранятся только в виде хеша.</span>
      <button class="btn sm" data-invite-new>${icon('key')}Новый код приглашения</button></div>
    <div class="table-wrap"><table class="t acc">
      <thead><tr><th>Человек</th><th>Почта</th><th>Роль</th><th>Был в штабе</th><th></th></tr></thead>
      <tbody>${accs.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).map(a => {
        const self = a.id === me.id, off = a.active === false;
        const lockRole = self || (a.role === 'owner' && owners <= 1);
        return `<tr class="${off ? 'off' : ''}"><td><b>${esc(a.name)}</b>${self ? ' <span class="note">это вы</span>' : ''}</td><td class="soft">${esc(a.email)}</td>
          <td><select class="select sm" data-acc-role="${a.id}" ${lockRole ? 'disabled' : ''}>${Object.entries(ROLES).map(([k, r]) => `<option value="${k}" ${k === roleOf(a.role) ? 'selected' : ''}>${r.name}</option>`).join('')}</select></td>
          <td class="soft nowrap">${a.lastSeen ? timeAgo(a.lastSeen) : '—'}</td>
          <td class="r nowrap">${self ? '' : `<button class="btn xs" data-acc-reset="${a.id}">Код сброса</button> <button class="btn xs ${off ? '' : 'danger'}" data-acc-toggle="${a.id}">${off ? 'Включить' : 'Отключить'}</button>`}</td></tr>`;
      }).join('')}</tbody></table></div>
    ${pending.length ? `<div class="section-head inv-h"><h3>Коды, которые ещё не использовали</h3></div>
      <div class="table-wrap"><table class="t inv"><thead><tr><th>Код</th><th>Для кого</th><th>Роль</th><th>Выдан</th><th></th></tr></thead>
      <tbody>${pending.map(i => { const p = personById(i.personId); return `<tr><td><span class="inv-code">${esc(i.id)}</span></td><td>${esc(p ? personName(p) : i.title || '—')}</td><td>${rolePill(i.role)}</td><td class="soft">${timeAgo(i.at)}</td>
        <td class="r nowrap"><button class="btn xs" data-inv-copy="${esc(i.id)}">${icon('copy')}Сообщение</button> <button class="btn xs danger" data-inv-del="${esc(i.id)}">Отозвать</button></td></tr>`; }).join('')}</tbody></table></div>` : ''}
    <p class="note">Честно о безопасности: вход разделяет кабинеты внутри команды. Настоящая граница — доступ к самому штабу: кому открыт штаб, тот может прочитать общую базу. Не используйте здесь пароли от почты или банка.</p>
  </section>`;
}
function wireAccess(root) {
  on(root, 'click', '[data-invite-new]', () => issueInvite(null));
  on(root, 'change', '[data-acc-role]', (e, el) => {
    Store.patch('accounts', el.dataset.accRole, {role: el.value});
    toast(`Роль изменена: ${ROLES[el.value].name}`);
  });
  on(root, 'click', '[data-acc-toggle]', async (e, el) => {
    const a = Store.get('accounts', el.dataset.accToggle);
    const off = a.active === false;
    if (!off && !(await confirmPop(el, {text: `Отключить вход для ${a.name}?`, yes: 'Да, отключить', danger: true}))) return;
    Store.patch('accounts', a.id, {active: off});
  });
  on(root, 'click', '[data-acc-reset]', async (e, el) => {
    const a = Store.get('accounts', el.dataset.accReset);
    const code = await Auth.issueReset(a.id);
    const text = `Код сброса пароля в штабе Eva Club: ${code}. Действует сутки: на входе нажмите «Забыли пароль?», введите почту ${a.email} и код.`;
    openModal({title: `Код сброса для ${a.name}`, body: `<b class="inv-code big-code">${code}</b><p class="note">${esc(text)}</p>`,
      foot: `<button class="btn" data-close>Готово</button><button class="btn primary" id="rsCopy">${icon('copy')}Скопировать сообщение</button>`,
      onMount(m) { $('#rsCopy', m).onclick = ev => copyText(text, ev.currentTarget); }});
  });
  on(root, 'click', '[data-inv-copy]', (e, el) => copyText(inviteText(el.dataset.invCopy), el));
  on(root, 'click', '[data-inv-del]', async (e, el) => {
    if (!(await confirmPop(el, {text: 'Отозвать код? По нему больше нельзя будет войти.', yes: 'Да, отозвать', danger: true}))) return;
    Store.remove('invites', el.dataset.invDel);
  });
}