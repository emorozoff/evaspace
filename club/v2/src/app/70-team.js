/* Команда: люди по направлениям, их задачи, вход в штаб. Основатель
   добавляет людей, выдаёт коды приглашений и меняет роли. Человек в
   команде может быть и без учётки — задачи на него ставить уже можно. */

App.register('team', {
  title: 'Команда',
  render(root) {
    const owner = Auth.can('team.manage');
    const ppl = people();
    const accs = Store.all('accounts');
    const invs = Store.all('invites');
    const tasks = Tasks.all();
    const accOf = pid => accs.find(a => a.personId === pid && a.active !== false);
    const invOf = pid => invs.find(i => i.personId === pid && !i.usedBy);

    const card = p => {
      const acc = accOf(p.id), inv = invOf(p.id);
      const open = tasks.filter(t => t.assignee === p.id && Tasks.isOpen(t));
      const late = open.filter(t => Tasks.overdue(t)).length;
      const lead = Object.entries(Strategy.whales()).find(([, w]) => w.lead === p.id);
      return `<div class="person">
        <div class="person-h">${avatar(p, 'lg')}<div class="person-n"><b>${esc(p.name || 'Имя не указано')}</b><span>${esc(p.title || '')}</span></div>
          ${owner ? `<button class="icon-btn" data-person-edit="${p.id}" title="Изменить">${icon('edit')}</button>` : ''}</div>
        <div class="person-tags">${dirPill(p.dir)}${lead ? `<span class="pill gold">ведёт «${DIRS[lead[0]].name}»</span>` : ''}${acc ? rolePill(acc.role) : inv ? '<span class="pill warn">приглашён</span>' : '<span class="pill line">без входа</span>'}</div>
        <div class="person-f">
          <button class="link-btn" data-person-tasks="${p.id}">${open.length} ${plural(open.length, 'задача', 'задачи', 'задач')}</button>${late ? `<span class="bad">${late} просрочено</span>` : ''}
          ${owner && !acc ? `<button class="btn xs" data-invite-for="${p.id}">${icon('key')}${inv ? 'Код' : 'Пригласить'}</button>` : ''}
        </div>
      </div>`;
    };
    const groups = [...Object.keys(DIRS), ''].map(d => {
      const list = ppl.filter(p => (p.dir || '') === d);
      if (!list.length) return '';
      return `<div class="team-group"><div class="team-gh">${d ? `<i class="dot" style="background:${DIRS[d].color}"></i>${DIRS[d].name}<span>${DIRS[d].metric}</span>` : 'Без направления'}</div>
        <div class="people">${list.map(card).join('')}</div></div>`;
    }).join('');

    root.innerHTML = `
      ${pageHead('Команда', 'Кто за что отвечает и чем занят. Нажмите на число задач — откроются задачи человека.',
        `${owner ? `<button class="btn primary" data-person-add>${icon('plus')}Человек</button>` : ''}`)}
      ${groups || '<div class="empty"><b>В команде пока никого</b>Добавьте людей кнопкой «Человек».</div>'}
      ${owner ? accessHtml(accs, invs) : ''}`;

    on(root, 'click', '[data-person-tasks]', (e, el) => { View.set('t.who', el.dataset.personTasks); View.set('t.chip', 'open'); View.set('t.dir', ''); View.set('t.goal', ''); App.go('tasks'); });
    on(root, 'click', '[data-person-edit]', (e, el) => editPerson(el.dataset.personEdit));
    on(root, 'click', '[data-person-add]', () => editPerson(null));
    on(root, 'click', '[data-invite-for]', (e, el) => issueInvite(el.dataset.inviteFor));
    if (owner) wireAccess(root);
  },
});

function editPerson(id) {
  const p = id ? personById(id) : null;
  const v = p || {name: '', title: '', dir: 'product'};
  openModal({
    title: p ? 'Человек в команде' : 'Новый человек',
    body: `<div class="grid2"><label class="field"><span>Имя и фамилия</span><input class="input" id="peName" value="${esc(v.name || '')}" placeholder="Можно оставить пустым для вакансии"></label>
      <label class="field"><span>Роль в команде</span><input class="input" id="peTitle" value="${esc(v.title || '')}" placeholder="Видеограф"></label></div>
      <label class="field"><span>Направление</span><select class="select" id="peDir"><option value="">Без направления</option>${Object.entries(DIRS).map(([k, d]) => `<option value="${k}" ${k === v.dir ? 'selected' : ''}>${d.name} — ${d.about}</option>`).join('')}</select></label>
      ${p ? '<p class="note">Если человек ушёл из команды, уберите его: задачи останутся, но без исполнителя в списках людей.</p>' : ''}`,
    foot: `${p && !p.founder ? `<button class="btn danger left" id="peDel">Убрать из команды</button>` : ''}<button class="btn" data-close>Отмена</button><button class="btn primary" id="peSave">Сохранить</button>`,
    onMount(el, close) {
      $('#peSave', el).onclick = () => {
        const name = $('#peName', el).value.trim(), title = $('#peTitle', el).value.trim();
        if (!name && !title) return $('#peName', el).focus();
        const data = {name, title, dir: $('#peDir', el).value};
        if (p) Store.patch('people', p.id, data); else Store.add('people', {...data, order: 50});
        close();
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