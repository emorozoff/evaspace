/* Команда и доступ.
   • Регистрация — экран для того, кто открыл CRM, но ещё не в команде:
     имя, должность, с кем работает, Telegram и код приглашения. С кодом —
     сразу в команде с ролью из приглашения, без кода — заявка, которую
     подтверждает главная (Зульфия, исполнительный директор).
   • «Команда» — заявки, кто в команде, роли, группы, приглашения кодом и
     как устроен доступ. Доступ к самой странице выдаёт владелец CRM через
     «Поделиться» — CRM сделать это за него не может. */

const GROUP_CHIPS = () => Object.keys(TYPES).map(k => [k, groupName(k)]);
const groupsHtml = (sel = [], attr = 'data-g') => `<div class="ans reg-groups">${GROUP_CHIPS().map(([k, n]) => `<button type="button" class="${sel.includes(k) ? 'on' : ''}" ${attr}="${k}">${TYPES[k].emo} ${esc(n)}</button>`).join('')}</div>`;
const groupsText = g => (g || []).map(groupName).join(', ');

/* ── экран регистрации ── */
const Reg = {done: null};
function renderRegistration(root) {
  /* имя из профиля Claude — подставляем, как только придёт, если поле ещё пустое */
  if (!Who.names[Who.uid]) Who.resolveNames([Who.uid]).then(() => { const n = $('#rgName', root); if (n && !n.value && Who.names[Who.uid]) n.value = Who.names[Who.uid]; });
  const head = Team.head();
  const ro = Who.readOnly();
  const d = Reg.done;
  const roles = Object.entries(ROLES).map(([k, r]) => `<li><span class="pill ${r.tone}">${r.name}</span><span>${esc(r.about)}</span></li>`).join('');
  root.innerHTML = `<div class="reg-page"><div class="reg">
    <div class="card reg-card">
      <div class="reg-brand">${brandIcon('reg-mark')}<div><b>Eva CRM</b><span>кастдев и подключение · Eva Space</span></div></div>
      ${d ? `<h1>${d.status === 'active' ? 'Добро пожаловать в команду!' : 'Заявка отправлена'}</h1>
        <p class="reg-lead">${d.status === 'active'
          ? `Вы в CRM с ролью «${esc(ROLES[d.role].name)}»${d.head ? ' и главная в CRM: вы подтверждаете новых участников и назначаете роли' : ''}.`
          : `${esc(head ? Team.name(head) : 'Руководитель')} увидит заявку на главной и в разделе «Команда». Пока заявку не подтвердили, CRM открыта только на просмотр.`}</p>
        <button class="btn primary reg-go" data-reg-open>Открыть CRM</button>`
      : `<h1>Регистрация в команде</h1>
        <p class="reg-lead">Это CRM команды Eva Space: кастдев клиенток, эксперты, партнёры и амбассадоры. Зарегистрируйтесь, чтобы вести людей и созвоны.${head ? ` Новых участников подтверждает главная в CRM — ${esc(Team.headName())}.` : ''}</p>
        ${ro ? '<div class="reg-msg">У вас доступ к этой странице только на просмотр — регистрация не сохранится. Попросите владельца CRM открыть доступ «Может редактировать» через «Поделиться», затем обновите страницу.</div>' : ''}
        <div class="reg-msg" id="regMsg" hidden></div>
        <form id="regForm" class="reg-fields" autocomplete="on">
          <label class="field"><span>Имя и фамилия</span><input class="input" id="rgName" autocomplete="name" placeholder="Анна Смирнова" value="${esc(Who.names[Who.uid] || '')}"></label>
          <label class="field"><span>Должность</span><input class="input" id="rgTitle" placeholder="Например: менеджер по кастдеву"></label>
          <div class="field"><span>С кем работаете</span>${groupsHtml([])}<small>Можно выбрать несколько — это видно команде.</small></div>
          <label class="field"><span>Telegram</span><input class="input" id="rgTg" placeholder="@username"></label>
          <label class="field"><span>Код приглашения</span><input class="input reg-code" id="rgCode" placeholder="EVA-7KQ2" autocomplete="one-time-code"><small>Если вам прислали код — с ним вы сразу попадёте в команду. Без кода заявку подтвердит главная.</small></label>
          <button class="btn primary reg-go" type="submit" ${ro ? 'disabled' : ''}>Зарегистрироваться</button>
        </form>
        <button class="link-btn reg-later" data-reg-later>Пока только посмотреть</button>`}
    </div>
    <aside class="reg-side"><p class="label">Роли в CRM</p><ul class="reg-roles">${roles}</ul>
      <p class="note">Роль назначает главная или руководитель в разделе «Команда». Роли разделяют, кто что может менять; видеть общую базу может любой, кому открыта эта страница.</p></aside>
  </div></div>`;
  on(root, 'click', '[data-g]', (e, b) => b.classList.toggle('on'));
  on(root, 'click', '[data-reg-later]', () => { View.set('reg.later', Who.uid); App.render({force: true}); });
  on(root, 'click', '[data-reg-open]', () => { Reg.done = null; App.render({force: true}); });
  const form = $('#regForm', root);
  if (!form) return;
  form.onsubmit = e => {
    e.preventDefault();
    const r = Who.register({name: $('#rgName', root).value, title: $('#rgTitle', root).value, tg: $('#rgTg', root).value, code: $('#rgCode', root).value, groups: $$('[data-g].on', root).map(b => b.dataset.g)});
    const msg = $('#regMsg', root);
    if (r.err) { msg.textContent = r.err; msg.hidden = false; return; }
    Reg.done = r;
    View.set('reg.later', null);
    renderRegistration(root);
  };
  setTimeout(() => { const n = $('#rgName', root); if (n && !n.value) n.focus(); }, 30);
}

/* ── страница «Команда» ── */
App.register('team', {
  title: 'Команда',
  render(root) {
    const own = Who.can('team') && !Who.readOnly();
    const me = Who.self();
    const head = Team.head();
    const pend = Team.pending();
    const rows = Team.everyone().filter(t => t.status !== 'pending');
    const leads = id => Store.all('people').filter(p => p.owner === id).length;
    const stCell = t => {
      const st = t.status || 'active';
      if (st === 'invited') return `<span class="pill warn">ждём входа</span>${own && t.code ? ` <span class="code">${esc(t.code)}</span>` : ''}`;
      return `<span class="muted">${t.joinedAt ? 'в CRM с ' + dayLong(isoTs(t.joinedAt)) : 'в команде'}</span>`;
    };
    root.innerHTML = `
      ${pageHead('Команда', `Кто работает в CRM, роли и новые заявки.${head ? ` Главная — ${esc(Team.headName())}: подтверждает новых и назначает роли.` : ''}`,
        `${me ? `<button class="btn" data-me-edit>${icon('edit')}Мой профиль</button>` : ''}${own ? `<button class="btn primary" data-invite>${icon('plus')}Пригласить</button>` : ''}`)}
      ${pend.length ? `<section class="card team-pend"><div class="card-head"><h2>Ждут подтверждения</h2><span class="pill warn">${pend.length}</span></div>
        <div class="tp-list">${pend.map(t => `<div class="tp-row">${Team.av(t)}<div class="tp-who"><b>${esc(Team.name(t))}</b><small>${esc([t.title, groupsText(t.groups), t.tg].filter(Boolean).join(' · ') || 'без подробностей')} · заявка ${timeAgo(t.joinedAt)}</small></div>
          ${own ? `<select class="select sm" data-pr="${t.id}">${Object.entries(ROLES).map(([k, r]) => `<option value="${k}" ${k === 'member' ? 'selected' : ''}>${r.name}</option>`).join('')}</select>
          <button class="btn sm primary" data-approve="${t.id}">${icon('check')}Подтвердить</button><button class="btn sm ghost" data-reject="${t.id}">Отклонить</button>` : '<span class="note">подтверждает руководитель</span>'}</div>`).join('')}</div></section>` : ''}
      <section class="section"><div class="table-wrap"><table class="t team-t">
        <thead><tr><th>Человек</th><th>Роль</th><th>С кем работает</th><th>Статус</th><th class="r">Ведёт</th>${own ? '<th></th>' : ''}</tr></thead>
        <tbody>${rows.map(t => `<tr class="${t.status === 'invited' ? 'dim' : ''}">
          <td><div class="tm-who">${Team.av(t)}<span><b>${esc(Team.name(t))}${t.uid && t.uid === Who.uid ? ' <span class="muted">· это вы</span>' : ''}</b><small>${esc(t.title || '')}${t.head ? `${t.title ? ' · ' : ''}<span class="pill gold">главная</span>` : ''}</small></span></div></td>
          <td>${own && t.uid !== Who.uid ? `<select class="select sm" data-role="${t.id}">${Object.entries(ROLES).map(([k, r]) => `<option value="${k}" ${roleOf(t.role) === k ? 'selected' : ''}>${r.name}</option>`).join('')}</select>` : `<span class="pill ${ROLES[roleOf(t.role)].tone}">${ROLES[roleOf(t.role)].name}</span>`}</td>
          <td class="soft">${esc(groupsText(t.groups)) || '<span class="muted">—</span>'}</td>
          <td>${stCell(t)}</td>
          <td class="r num">${leads(t.id) || ''}</td>
          ${own ? `<td class="r nowrap">${t.status === 'invited' ? `<button class="btn xs" data-inv-copy="${t.id}">${icon('copy')}Приглашение</button>` : ''}${!t.head ? `<button class="btn xs ghost" data-head="${t.id}" title="Главная подтверждает новых и назначает роли">Сделать главной</button>` : ''}${t.uid !== Who.uid ? `<button class="icon-btn" data-rm="${t.id}" title="Убрать из команды">${icon('trash')}</button>` : ''}</td>` : ''}
        </tr>`).join('')}</tbody></table></div>
        ${own ? `<form class="row team-add" id="stAdd"><input class="input sm" id="stName" placeholder="Добавить без входа — например, стажёр, которому поручают клиенток" style="flex:1"><button class="btn sm" type="submit">${icon('plus')}Добавить</button></form>` : ''}
      </section>
      <section class="section two">
        <div class="card"><div class="card-head"><h2>Как пригласить в команду</h2></div>
          <ol class="legal team-steps">
            <li><b>Откройте доступ к странице.</b> Владелец CRM: «Поделиться» → почта человека → «Может редактировать». Без этого он не войдёт, а заявка не сохранится.</li>
            <li><b>Пригласите кодом.</b> «Пригласить» → роль и группы → отправьте сообщение с кодом в Telegram.</li>
            <li><b>Человек регистрируется.</b> Открывает CRM, вводит имя и код — и сразу в команде. Без кода он оставляет заявку, её подтверждает главная здесь, вверху страницы.</li>
          </ol>
          <p class="note">Работает и в штабе? Пригласите его отдельно в штабе: «Команда» → «Пригласить». Штаб и CRM — разные страницы, вход в каждую свой.</p></div>
        <div class="card"><div class="card-head"><h2>Роли</h2></div>
          <ul class="reg-roles">${Object.entries(ROLES).map(([k, r]) => `<li><span class="pill ${r.tone}">${r.name}</span><span>${esc(r.about)}</span></li>`).join('')}
            <li><span class="pill gold">Главная</span><span>руководитель, к которому приходят заявки новых участников${head ? ` — сейчас ${esc(Team.name(head))}` : ''}</span></li></ul></div>
      </section>`;

    on(root, 'click', '[data-invite]', () => openInvite());
    on(root, 'click', '[data-me-edit]', () => openMyProfile());
    on(root, 'click', '[data-inv-copy]', (e, el) => { const t = Team.get(el.dataset.invCopy); if (t) copyOrShow(Team.inviteText(t), 'Приглашение скопировано — отправьте его в Telegram'); });
    on(root, 'change', '[data-role]', (e, el) => { Store.patch('team', el.dataset.role, {role: el.value}); toast('Роль изменена'); });
    on(root, 'click', '[data-approve]', (e, el) => {
      const id = el.dataset.approve, role = ($(`[data-pr="${id}"]`, root) || {}).value || 'member';
      Store.patch('team', id, {status: 'active', role, approvedBy: Who.id(), approvedAt: Date.now()});
      toast(`${Team.name(Team.get(id))} в команде — «${ROLES[role].name}»`);
    });
    on(root, 'click', '[data-reject]', async (e, el) => {
      const t = Team.get(el.dataset.reject);
      if (!await confirmPop(el, {text: `Отклонить заявку ${Team.name(t)}?`, yes: 'Отклонить', danger: true})) return;
      Store.patch('team', t.id, {status: 'rejected', archived: true, rejectedBy: Who.id(), rejectedAt: Date.now()});
    });
    on(root, 'click', '[data-head]', async (e, el) => {
      const t = Team.get(el.dataset.head);
      if (!await confirmPop(el, {text: `Сделать ${Team.name(t)} главной в CRM? Заявки новых участников будут приходить ей.`, yes: 'Сделать главной'})) return;
      Store.all('team').filter(x => x.head && x.id !== t.id).forEach(x => Store.patch('team', x.id, {head: false}));
      Store.patch('team', t.id, {head: true, role: 'owner'});
    });
    on(root, 'click', '[data-rm]', async (e, el) => {
      const t = Team.get(el.dataset.rm);
      if (!await confirmPop(el, {text: `Убрать ${Team.name(t)} из команды? Люди, которых ${t.status === 'invited' ? 'ей поручили' : 'он(а) ведёт'}, останутся без ведущего.`, yes: 'Убрать', danger: true})) return;
      Store.patch('team', t.id, {archived: true, head: false});
      toast('Убрали из команды', {undo: () => Store.patch('team', t.id, {archived: false, head: !!t.head})});
    });
    const add = $('#stAdd', root);
    if (add) add.onsubmit = e => { e.preventDefault(); const n = $('#stName', root).value.trim(); if (n) Store.add('team', {name: n, role: 'member', status: 'active', joinedAt: Date.now(), order: 30}); };
  },
});

/* приглашение кодом: место в команде ждёт человека, код его «открывает» */
function openInvite() {
  openModal({title: 'Пригласить в команду', body: `
      <div class="grid2"><label class="field"><span>Имя</span><input class="input" id="ivName" placeholder="Анна Смирнова"></label>
      <label class="field"><span>Должность</span><input class="input" id="ivTitle" placeholder="Менеджер по кастдеву"></label></div>
      <label class="field"><span>Роль</span><select class="select" id="ivRole">${Object.entries(ROLES).map(([k, r]) => `<option value="${k}" ${k === 'member' ? 'selected' : ''}>${r.name} — ${esc(r.about)}</option>`).join('')}</select></label>
      <div class="field"><span>С кем будет работать</span>${groupsHtml([], 'data-ig')}</div>
      <div class="invite-out" id="ivOut" hidden><span class="label">Код</span><b class="code inv-code" id="ivCode"></b>
        <textarea class="textarea" id="ivText" readonly style="min-height:150px"></textarea>
        <p class="note">Не забудьте открыть человеку доступ к странице: «Поделиться» → его почта → «Может редактировать».</p></div>`,
    foot: '<button class="btn" data-close>Готово</button><button class="btn primary" id="ivGo">Создать код</button>',
    onMount(el) {
      on(el, 'click', '[data-ig]', (e, b) => b.classList.toggle('on'));
      let made = null;
      $('#ivGo', el).onclick = () => {
        if (made) { copyOrShow(Team.inviteText(made), 'Приглашение скопировано — отправьте его в Telegram'); return; }
        const t = {name: $('#ivName', el).value.trim(), title: $('#ivTitle', el).value.trim(), role: $('#ivRole', el).value, groups: $$('[data-ig].on', el).map(b => b.dataset.ig), status: 'invited', code: Team.newCode(), invitedBy: Who.id(), invitedAt: Date.now(), order: 30};
        const id = Store.add('team', t);
        made = {...t, id};
        $('#ivCode', el).textContent = t.code;
        $('#ivText', el).value = Team.inviteText(made);
        $('#ivOut', el).hidden = false;
        $('#ivGo', el).innerHTML = `${icon('copy')}Скопировать приглашение`;
      };
    }});
}

/* свой профиль в команде: имя, должность, группы, Telegram */
function openMyProfile() {
  const m = Who.self();
  if (!m) return;
  openModal({title: 'Мой профиль в команде', body: `
      <div class="grid2"><label class="field"><span>Имя и фамилия</span><input class="input" id="mpName" value="${esc(m.name || Who.names[m.uid] || '')}"></label>
      <label class="field"><span>Должность</span><input class="input" id="mpTitle" value="${esc(m.title || '')}"></label></div>
      <div class="field"><span>С кем работаю</span>${groupsHtml(m.groups || [], 'data-mg')}</div>
      <label class="field"><span>Telegram</span><input class="input" id="mpTg" value="${esc(m.tg || '')}" placeholder="@username"></label>`,
    foot: '<button class="btn" data-close>Отмена</button><button class="btn primary" data-ok>Сохранить</button>',
    onMount(el, close) {
      on(el, 'click', '[data-mg]', (e, b) => b.classList.toggle('on'));
      $('[data-ok]', el).onclick = () => {
        Store.patch('team', m.id, {name: $('#mpName', el).value.trim(), title: $('#mpTitle', el).value.trim(), tg: $('#mpTg', el).value.trim(), groups: $$('[data-mg].on', el).map(b => b.dataset.mg)});
        close();
        toast('Профиль сохранён');
      };
    }});
}
