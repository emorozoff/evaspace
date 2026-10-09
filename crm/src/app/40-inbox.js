/* Сообщения: вся переписка в одном окне — Telegram, WhatsApp, MAX, почта,
   SMS — и групповые чаты. Сообщение, адресованное в групповой чат
   конференции, показывается в этом чате у всех участниц и попадает в
   историю каждой из них. Ещё здесь — новые заявки из приложения. */

App.register('inbox', {
  title: 'Сообщения',
  render(root) {
    const filter = View.get('ib.f', 'all');
    let sel = View.get('ib.sel', '');
    if (!sel && window.innerWidth > 880) { const w = Inbox.threads().find(c => cx(c).waiting); sel = w ? w.id : Chats.all()[0] ? 'chat:' + Chats.all()[0].id : ''; }
    const q = View.get('ib.q', '').trim().toLowerCase();
    const threads = Inbox.threads().filter(c => {
      const d = cx(c);
      if (filter === 'wait' && !d.waiting) return false;
      if (filter === 'unread' && !d.unread) return false;
      if (MSG_CH.includes(filter) && !d.msgs.some(m => m.ch === filter)) return false;
      if (q && !Clients.name(c).toLowerCase().includes(q)) return false;
      return true;
    });
    const chats = Chats.all();
    const apps = newApplications();
    const counts = {all: Inbox.threads().length, wait: Inbox.threads().filter(c => cx(c).waiting).length, unread: Inbox.threads().filter(c => cx(c).unread).length};

    const listHtml = () => {
      if (filter === 'apps') {
        return apps.length ? apps.map(a => `<a class="ib-i" href="${a.href}">${avatar(a.name)}<div class="ib-i-b"><div class="ib-i-t"><span class="nm">${esc(a.name)}</span><time>${timeAgo(a.t)}</time></div><div class="ib-i-p"><span class="pill ${a.tone}">${esc(a.kind)}</span><span class="snip">${esc(a.text)}</span></div></div></a>`).join('')
          : '<div class="ib-empty">Новых заявок нет</div>';
      }
      const groupPart = (filter === 'all' || filter === 'group') && chats.length ? `<div class="ib-sec">Групповые чаты</div>${chats.map(ch => {
        const ms = Chats.msgs(ch), last = ms[ms.length - 1];
        return `<a class="ib-i ${sel === 'chat:' + ch.id ? 'on' : ''}" href="#inbox" data-sel="chat:${ch.id}"><span class="ib-group-ico">${icon('users')}</span><div class="ib-i-b"><div class="ib-i-t"><span class="nm">${esc(ch.name.split(' · ')[0])}</span>${last ? `<time>${timeAgo(last.t)}</time>` : ''}</div><div class="ib-i-p">${chBadge(ch.ch || 'tg')}<span class="snip">${last ? esc(msgAuthor(last).split(' ')[0] + ': ' + last.text) : 'сообщений пока нет'}</span></div></div></a>`;
      }).join('')}` : '';
      if (filter === 'group') return groupPart;
      const personal = threads.map(c => {
        const d = cx(c), m = d.lastMsg;
        return `<a class="ib-i ${sel === c.id ? 'on' : ''} ${d.unread ? 'unread' : ''}" href="#inbox" data-sel="${c.id}">${avatar(Clients.name(c))}<div class="ib-i-b">
          <div class="ib-i-t"><span class="nm">${esc(Clients.name(c))}</span><time>${timeAgo(m.t)}</time></div>
          <div class="ib-i-p">${chBadge(m.ch)}<span class="snip">${m.dir === 'out' ? (m.by ? esc(Team.first(Team.get(m.by))) + ': ' : 'Вы: ') : ''}${esc(m.text)}</span>${d.unread ? `<span class="counter">${d.unread}</span>` : d.waiting ? '<span class="pill rose">ждёт</span>' : ''}</div></div></a>`;
      }).join('');
      return groupPart + `<div class="ib-sec">Личные диалоги</div>` + (personal || '<div class="ib-empty">Диалогов по фильтру нет</div>');
    };

    let thread = '<div class="ib-empty">Выберите диалог слева</div>';
    let hasThread = false;
    if (sel.startsWith('chat:')) {
      const ch = Chats.get(sel.slice(5));
      if (ch) { thread = groupThreadHtml(ch); hasThread = true; }
    } else if (sel) {
      const c = Clients.get(sel);
      if (c) { thread = personalThreadHtml(c); hasThread = true; }
    }

    root.innerHTML = `
      ${pageHead('Сообщения', 'Вся переписка с клиентками в одном окне и групповые чаты. История сохраняется в карточке — даже если сотрудник уйдёт, диалог останется у компании.')}
      ${!Inbox.live('tg') && !Inbox.live('wa') ? `<div class="warnline" style="margin-bottom:12px">${icon('plug')}<span><b>Каналы пока в демо-режиме.</b> Входящие придут сами, а ответы начнут уходить в Telegram и WhatsApp после подключения в «Настройках → Интеграции». До этого ответ сохраняется в истории, а отправить его можно кнопкой «Открыть в Telegram / WhatsApp».</span></div>` : ''}
      <div class="tabs">${[['all', 'Все', counts.all], ['wait', 'Ждут ответа', counts.wait], ['unread', 'Непрочитанные', counts.unread], ['tg', 'Telegram'], ['wa', 'WhatsApp'], ['email', 'Почта'], ['group', 'Групповые чаты', chats.length], ['apps', 'Заявки из приложения', apps.length]]
        .map(([k, n, cnt]) => `<button data-ibf="${k}" class="${filter === k ? 'on' : ''}">${n}${cnt ? `<span class="n">${cnt}</span>` : ''}</button>`).join('')}</div>
      <div class="ib ${hasThread ? 'has-thread' : ''}">
        <div class="ib-list">
          <div class="ib-list-h"><input class="input sm" id="ibQ" placeholder="Поиск по имени" value="${esc(View.get('ib.q', ''))}"></div>
          <div class="ib-items">${listHtml()}</div>
        </div>
        <div class="ib-thread">${thread}</div>
      </div>`;

    on(root, 'click', '[data-ibf]', (e, el) => { View.set('ib.f', el.dataset.ibf); App.render(); });
    on(root, 'click', '[data-sel]', (e, el) => { e.preventDefault(); View.set('ib.sel', el.dataset.sel); App.render(); });
    on(root, 'click', '[data-ib-back]', () => { View.set('ib.sel', ''); App.render(); });
    let qt;
    $('#ibQ', root).oninput = e => { clearTimeout(qt); const v = e.target.value; qt = setTimeout(() => { View.set('ib.q', v); App.render({focus: 'ibQ'}); }, 250); };
    const box = $('.ib-msgs', root);
    if (box) box.scrollTop = box.scrollHeight;
    wireThread(root, sel);
  },
});

function msgAuthor(m) {
  if (!m.from) return '';
  if (m.from.type === 'team') return Team.name(Team.get(m.from.id));
  if (m.from.type === 'client') return Clients.name(Clients.get(m.from.id));
  return '';
}

function personalThreadHtml(c) {
  const d = cx(c);
  const items = [...d.msgs, ...d.groupMsgs.map(m => ({...m, kind: 'group'}))].sort((a, b) => a.t - b.t);
  let last = '';
  const body = items.map(m => {
    const dd = isoTs(m.t);
    const sep = dd !== last ? `<div class="tl-day">${dd === today() ? 'Сегодня' : cap(dayWd(dd))}</div>` : '';
    last = dd;
    if (m.kind === 'group') return sep + `<div class="bub in"><div class="bub-who">${chBadge('group')} в чате «${esc(m.chatName.split(' · ')[0])}»</div>${esc(m.text)}<div class="bub-meta">${hm(m.t)}</div></div>`;
    return sep + `<div class="bub ${m.dir}">${esc(m.text)}<div class="bub-meta">${chBadge(m.ch)}${m.dir === 'out' && m.by ? ' ' + esc(Team.first(Team.get(m.by))) + ' ·' : ''} ${hm(m.t)}${m.dir === 'out' ? (m.status === 'saved' ? ' · <span class="saved">не отправлено</span>' : m.status === 'queued' ? ' · в очереди' : ' · ✓') : ''}</div></div>`;
  }).join('');
  const lastCh = d.lastMsg ? d.lastMsg.ch : 'tg';
  const groups = Chats.memberOf(c);
  const tpl = Cfg.items('templates');
  const canEdit = Clients.canEdit(c);
  return `<div class="ib-th-h">
      <button class="icon-btn" data-ib-back title="К списку">${icon('back')}</button>
      ${avatar(Clients.name(c))}
      <div class="t"><a href="#client-${c.id}">${esc(Clients.name(c))}</a><small>${esc((Funnels.stage('sales', c.stage) || {}).name || '')} · ${esc(c.city || '')}${c.manager ? ' · ' + esc(Team.first(Team.get(c.manager))) : ' · без менеджера'}</small></div>
      ${c.tg ? `<a class="btn sm" href="${esc(Clients.chatUrl(c, 'tg'))}" target="_blank" rel="noopener">${icon('ext')}Telegram</a>` : ''}
      ${(c.wa || c.phone) ? `<a class="btn sm" href="${esc(Clients.chatUrl(c, 'wa'))}" target="_blank" rel="noopener">${icon('ext')}WhatsApp</a>` : ''}
      <a class="btn sm" href="#client-${c.id}">Карточка</a>
    </div>
    <div class="ib-msgs"><div class="thread2">${body || '<div class="ib-empty">Сообщений пока нет</div>'}</div></div>
    ${canEdit ? `<div class="ib-comp">
      <div class="comp-row">
        <select class="select" id="ibCh">${MSG_CH.map(ch => opt(ch, `${CHANNELS[ch].name} · ${Clients.contactFor(c, ch) || 'нет контакта'}`, lastCh)).join('')}${groups.map(g => opt('group:' + g.id, `В групповой чат «${g.name.split(' · ')[0]}»`, '')).join('')}</select>
        ${tpl.length ? `<select class="select" id="ibTpl">${opt('', 'Шаблон…', '')}${tpl.map(t => opt(t.id, t.name, '')).join('')}</select>` : ''}
      </div>
      <textarea class="textarea" id="ibText" placeholder="Сообщение. Ctrl+Enter — отправить"></textarea>
      <div class="comp-foot"><span class="note" id="ibHint"></span><button class="btn primary sm" data-ib-send="${c.id}">${icon('send')}Отправить</button></div>
    </div>` : ''}`;
}

function groupThreadHtml(ch) {
  const ms = Chats.msgs(ch);
  let last = '';
  const body = ms.map(m => {
    const dd = isoTs(m.t);
    const sep = dd !== last ? `<div class="tl-day">${dd === today() ? 'Сегодня' : cap(dayWd(dd))}</div>` : '';
    last = dd;
    const team = m.from && m.from.type === 'team';
    const name = msgAuthor(m) || 'Участница';
    const link = m.from && m.from.type === 'client' ? `<a class="inline-link" href="#client-${m.from.id}">${esc(name)}</a>` : esc(name);
    return sep + `<div class="gmsg ${team ? 'team' : ''}">${avatar(name)}<div class="bub ${team ? 'out' : 'in'}"><div class="bub-who">${link}${team ? ' · команда Евы' : ''}</div>${esc(m.text)}<div class="bub-meta">${hm(m.t)}</div></div></div>`;
  }).join('');
  const members = (ch.members || []).map(id => Clients.get(id)).filter(Boolean);
  return `<div class="ib-th-h">
      <button class="icon-btn" data-ib-back title="К списку">${icon('back')}</button>
      <span class="ib-group-ico">${icon('users')}</span>
      <div class="t"><b>${esc(ch.name)}</b><small>${esc(ch.about || '')} · ${members.length} ${plural(members.length, 'участница', 'участницы', 'участниц')}</small></div>
      <button class="btn sm" data-members="${ch.id}">${icon('users')}Участницы</button>
    </div>
    <div class="ib-msgs"><div class="thread2">${body || '<div class="ib-empty">Сообщений пока нет</div>'}</div></div>
    ${Who.can('inbox.view') && !Who.readOnly() ? `<div class="ib-comp">
      <p class="note">Сообщение уйдёт в общий чат${ch.ch === 'tg' ? ' в Telegram' : ''}: его увидят все участницы, и оно попадёт в историю чата. ${Inbox.live(ch.ch || 'tg') ? '' : 'Пока канал не подключён, сообщение сохраняется здесь.'}</p>
      <textarea class="textarea" id="ibText" placeholder="Сообщение для всех участниц. Ctrl+Enter — отправить"></textarea>
      <div class="comp-foot"><span class="note"></span><button class="btn primary sm" data-ib-group="${ch.id}">${icon('send')}В чат</button></div>
    </div>` : ''}`;
}

function wireThread(root, sel) {
  const text = $('#ibText', root);
  const tplSel = $('#ibTpl', root);
  const c = sel && !sel.startsWith('chat:') ? Clients.get(sel) : null;
  if (c) Inbox.markRead(c);
  if (tplSel) tplSel.onchange = () => { const t = (Cfg.list('templates') || {})[tplSel.value]; if (t) { text.value = fillTemplate(t.text, c); if (t.ch) $('#ibCh', root).value = t.ch; text.focus(); } };
  const send = () => {
    const v = text.value.trim();
    if (!v) { text.classList.add('need'); text.focus(); return; }
    if (c) {
      const ch = $('#ibCh', root).value;
      if (ch.startsWith('group:')) { Chats.post(ch.slice(6), v, {to: c.id}); toast('Отправлено в групповой чат'); }
      else { Inbox.send(c.id, ch, v); toast(Inbox.live(ch) ? 'Отправлено' : 'Сохранено в истории — канал не подключён'); }
    } else if (sel.startsWith('chat:')) {
      Chats.post(sel.slice(5), v);
      toast('Отправлено в групповой чат');
    }
    text.value = '';
  };
  if (text) text.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } });
  on(root, 'click', '[data-ib-send], [data-ib-group]', e => { e.preventDefault(); send(); });
  on(root, 'click', '[data-members]', (e, el) => {
    const ch = Chats.get(el.dataset.members);
    const members = (ch.members || []).map(id => Clients.get(id)).filter(Boolean);
    const canManage = Who.can('clients.edit') && !Who.readOnly();
    openModal({title: `Участницы: ${ch.name.split(' · ')[0]}`, body: `<div class="task-list">${members.map(m => `<div class="task-row">${avatar(Clients.name(m))}<div class="tt"><b>${esc(Clients.name(m))}</b><br><a href="#client-${m.id}" data-close>${esc(m.city || '')} · ${esc((Funnels.stage('sales', m.stage) || {}).name || '')}</a></div>${canManage ? `<button class="btn xs ghost" data-rm="${m.id}">Убрать</button>` : ''}</div>`).join('') || '<p class="note">Пока никого.</p>'}</div>
      ${canManage ? `<div class="row" style="margin-top:10px"><select class="select" id="addMember">${opt('', 'Добавить клиентку…', '')}${Clients.all().filter(x => !(ch.members || []).includes(x.id)).sort((a, b) => Clients.name(a).localeCompare(Clients.name(b), 'ru')).map(x => opt(x.id, Clients.name(x), '')).join('')}</select></div>` : ''}`,
    onMount(mel, close) {
      on(mel, 'click', '[data-rm]', (ev, b) => { Store.patch('chats', ch.id, {members: (ch.members || []).filter(x => x !== b.dataset.rm)}); close(); });
      const add = $('#addMember', mel);
      if (add) add.onchange = () => { if (add.value) { Store.patch('chats', ch.id, {members: [...(ch.members || []), add.value]}); toast('Добавлена в чат'); close(); } };
    }});
  });
}

/* новые заявки: свободные заявки на подписку, заявки экспертов и партнёров */
function newApplications() {
  const out = [];
  Clients.visible().filter(c => !c.manager && ['lead', 'base'].includes(c.stage)).forEach(c => {
    out.push({kind: 'Подписка', tone: 'violet', name: Clients.name(c), text: (cx(c).lastIn || {}).text || `Заявка · ${SOURCES[c.source] || ''}`, t: c.createdAt || 0, href: '#client-' + c.id});
  });
  if (Who.can('experts.view')) Experts.all().filter(e => e.stage === 'list' && Ev.list(e).some(x => x.kind === 'sys' && /приложени/i.test(x.text || ''))).forEach(e => out.push({kind: 'Эксперт', tone: 'gold', name: e.name, text: `${e.direction} · стаж ${e.experience || '—'}`, t: e.createdAt || 0, href: '#expert-' + e.id}));
  if (Who.can('partners.view')) Partners.all().filter(p => p.stage === 'base').forEach(p => out.push({kind: 'Партнёр', tone: 'good', name: p.name, text: `${p.category} · ${p.city}`, t: p.createdAt || 0, href: '#partner-' + p.id}));
  return out.sort((a, b) => b.t - a.t);
}
