/* Партнёры: салоны, студии пилатеса и йоги, фитнес, косметология,
   пространства, бренды маркета. Карточка: условия взаимодействия,
   спецпредложения с промокодами, адрес, контактное лицо, договор,
   приведённые клиентки и вознаграждение. */

App.register('partners', {
  title: 'Партнёры',
  render(root) {
    const tab = View.get('pt.tab', 'list');
    const all = Partners.all();
    const q = View.get('pt.q', '').trim().toLowerCase();
    const catF = View.get('pt.cat', ''), cityF = View.get('pt.city', ''), stF = View.get('pt.st', '');
    const list = all.filter(p => (!q || (p.name + ' ' + p.contactName + ' ' + p.address).toLowerCase().includes(q)) && (!catF || p.category === catF) && (!cityF || p.city === cityF) && (!stF || p.stage === stF));
    const canEdit = Who.can('partners.edit') && !Who.readOnly();
    const cities = [...new Set(all.map(p => p.city).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
    const active = all.filter(p => p.stage === 'active');
    const stats = all.map(p => ({p, s: Partners.stats(p)}));
    const offers = all.filter(p => ['active', 'contract'].includes(p.stage)).flatMap(p => Partners.offers(p).map(o => ({p, o})));

    let body = '';
    if (tab === 'list') {
      body = `<div class="t-bar"><input class="input sm t-search" id="ptQ" placeholder="Название, контакт, адрес" value="${esc(View.get('pt.q', ''))}">
          <select class="select sm" id="ptCat">${opts([['', 'Все категории'], ...PARTNER_CATS.map(c => [c, c])], catF)}</select>
          <select class="select sm" id="ptCity">${opts([['', 'Все города'], ...cities.map(c => [c, c])], cityF)}</select>
          <select class="select sm" id="ptSt">${opts([['', 'Все этапы'], ...Funnels.stages('partners').map(s => [s.id, s.name]), ['lost', 'Отказ']], stF)}</select></div>
        <div class="pgrid">${list.map(p => {
          const s = Partners.stats(p);
          const of = Partners.offers(p);
          return `<a class="card pcard" href="#partner-${p.id}">
            <div class="pcard-h">${avatar(p.name, 'lg')}<div><b>${esc(p.name)}</b><small>${esc(p.category)} · ${esc(p.city)}</small></div></div>
            <div class="row" style="gap:6px">${stagePill('partners', p.stage)}<span class="pill line">${esc((PARTNER_MODELS[p.model] || '').split(':')[0])}</span></div>
            ${of.length ? `<div class="offer"><span class="ico">${icon('gift')}</span><div><b>${esc(of[0].title)}</b>${of[0].promo ? `<small><span class="promo">${esc(of[0].promo)}</span></small>` : ''}</div></div>` : ''}
            <div class="pcard-f">${icon('users')}<span>${esc(p.contactName || '—')}${p.contactRole ? ', ' + esc(p.contactRole) : ''}</span><span class="sp"></span>${s.n ? `<b>${s.n}</b> ${plural(s.n, 'клиентка', 'клиентки', 'клиенток')}` : ''}</div>
          </a>`;
        }).join('') || '<div class="empty"><b>Никого не нашли</b>Поменяйте фильтры.</div>'}</div>`;
    } else if (tab === 'offers') {
      body = `<p class="note" style="margin-bottom:12px">Действующие спецпредложения партнёров. Менеджер делится ими с клиентками — в карточке клиентки видны предложения её города.</p>
        <div class="pgrid">${offers.map(({p, o}) => `<div class="card offer" style="border-style:solid"><span class="ico">${icon('gift')}</span><div style="flex:1">
          <b>${esc(o.title)}</b><small><a class="inline-link" href="#partner-${p.id}">${esc(p.name)}</a> · ${esc(p.city)}${o.until ? ` · до ${dayShort(o.until)}` : ''}</small>
          ${o.promo ? `<div class="row" style="margin-top:8px"><span class="promo">${esc(o.promo)}</span><button class="btn xs" data-copy="${esc(o.promo)}">${icon('copy')}Копировать</button></div>` : ''}</div></div>`).join('') || '<div class="empty"><b>Предложений нет</b>Добавьте их в карточке партнёра.</div>'}</div>`;
    } else {
      const rows = stats.filter(x => x.s.n || x.s.reward || x.s.paidOut).sort((a, b) => b.s.revenue - a.s.revenue);
      body = `<div class="table-wrap"><table class="t"><thead><tr><th>Партнёр</th><th>Модель</th><th class="r">Клиенток</th><th class="r">Оплатили</th><th class="r">Принесли</th><th class="r">Ставка</th><th class="r">Вознаграждение</th><th class="r">Выплачено</th><th class="r">К выплате</th></tr></thead><tbody>
        ${rows.map(({p, s}) => `<tr><td><a class="inline-link" href="#partner-${p.id}">${esc(p.name)}</a></td><td>${esc((PARTNER_MODELS[p.model] || '').split(':')[0])}</td><td class="r">${s.n}</td><td class="r">${s.paying}</td><td class="r">${rub(s.revenue)}</td><td class="r">${s.rate ? pct(s.rate) : '—'}</td><td class="r">${rub(s.reward)}</td><td class="r">${rub(s.paidOut)}</td><td class="r"><b>${rub(Math.max(0, s.reward - s.paidOut))}</b></td></tr>`).join('') || '<tr><td colspan="9"><p class="note">Пока нет клиенток от партнёров.</p></td></tr>'}
      </tbody></table></div>
      <p class="note" style="margin-top:8px">Вознаграждение считается с оплат клиенток, у которых в карточке указан партнёр (по промокоду или ссылке). Выплата — по акту раз в месяц; внесите её в карточке партнёра («Выплата»).</p>`;
    }

    root.innerHTML = `
      ${pageHead('Партнёры', 'Салоны красоты, студии пилатеса и йоги, фитнес, косметология, пространства и бренды. Условия, спецпредложения, контактные лица и что партнёр приносит.',
        `<a class="btn" href="#funnels" data-fnid="partners">${icon('funnel')}Воронка партнёров</a>${canEdit ? `<button class="btn primary" data-new>${icon('plus')}Партнёр</button>` : ''}`)}
      <div class="tiles6">
        <div class="card stat"><span class="label">Партнёров</span><div class="big">${all.length}</div><div class="foot">активных ${active.length} · в переговорах ${all.filter(p => ['contact', 'meeting', 'terms'].includes(p.stage)).length}</div></div>
        <div class="card stat"><span class="label">Спецпредложения</span><div class="big">${offers.length}</div><div class="foot">действуют для участниц Евы</div></div>
        <div class="card stat"><span class="label">Привели клиенток</span><div class="big">${sum(stats, x => x.s.n)}</div><div class="foot">оплатили ${sum(stats, x => x.s.paying)}</div></div>
        ${Who.can('money.view') ? `<div class="card stat"><span class="label">Принесли денег</span><div class="big">${rubK(sum(stats, x => x.s.revenue))}</div><div class="foot">вознаграждение ${rubK(sum(stats, x => x.s.reward))}</div></div>` : ''}
      </div>
      <div class="section">${tabsHtml('pt.tab', [['list', 'Все партнёры', all.length], ['offers', 'Спецпредложения', offers.length], ['money', 'Вознаграждения']], tab)}${body}</div>`;

    wireTabs(root);
    let qt;
    const qi = $('#ptQ', root);
    if (qi) qi.oninput = e => { clearTimeout(qt); const v = e.target.value; qt = setTimeout(() => { View.set('pt.q', v); App.render({focus: 'ptQ'}); }, 250); };
    [['ptCat', 'pt.cat'], ['ptCity', 'pt.city'], ['ptSt', 'pt.st']].forEach(([i, k]) => { const el = $('#' + i, root); if (el) el.onchange = () => { View.set(k, el.value); App.render(); }; });
    on(root, 'click', '[data-new]', () => openPartnerForm(null));
    on(root, 'click', '[data-fnid]', (e, el) => View.set('fn.id', el.dataset.fnid));
    on(root, 'click', '[data-copy]', async (e, el) => { e.preventDefault(); if (await copyText(el.dataset.copy)) toast('Промокод скопирован'); });
  },
});

function openPartnerForm(id, stage = 'base') {
  const p = id ? Partners.get(id) : null;
  const v = k => (p ? p[k] ?? '' : '');
  const body = `<div class="grid2">
      <label class="field"><span>Название *</span><input class="input" id="pfName" value="${esc(v('name'))}" placeholder="Студия пилатеса «Баланс»"></label>
      <label class="field"><span>Категория</span><select class="select" id="pfCat">${PARTNER_CATS.map(c => opt(c, c, v('category') || PARTNER_CATS[0])).join('')}</select></label>
      <label class="field"><span>Город</span><input class="input" id="pfCity" value="${esc(v('city'))}"></label>
      <label class="field"><span>Адрес</span><input class="input" id="pfAddr" value="${esc(v('address'))}" placeholder="ул. Покровка, 17"></label>
      <label class="field"><span>Контактное лицо</span><input class="input" id="pfCName" value="${esc(v('contactName'))}"></label>
      <label class="field"><span>Должность</span><input class="input" id="pfCRole" value="${esc(v('contactRole'))}" placeholder="управляющая"></label>
      <label class="field"><span>Телефон</span><input class="input" id="pfPhone" value="${esc(phoneFmt(v('phone')))}"></label>
      <label class="field"><span>Telegram</span><input class="input" id="pfTg" value="${esc(v('tg'))}"></label>
      <label class="field"><span>Почта</span><input class="input" id="pfEmail" value="${esc(v('email'))}"></label>
      <label class="field"><span>Сайт или соцсеть</span><input class="input" id="pfSite" value="${esc(v('site'))}"></label>
      <label class="field"><span>Формат сотрудничества</span><select class="select" id="pfModel">${Object.entries(PARTNER_MODELS).map(([k, n]) => opt(k, n, v('model') || 'commission')).join('')}</select></label>
      <label class="field"><span>Ставка партнёра, %</span><input class="input num" id="pfRate" inputmode="decimal" value="${p && typeof p.rate === 'number' ? Math.round(p.rate * 100) : Math.round(settings().partnerRate * 100)}"><small>с оплат приведённых клиенток; 0 — без денег</small></label>
      <label class="field"><span>Промокод партнёра</span><input class="input" id="pfPromo" value="${esc(v('promo'))}" placeholder="LAVANDA"></label>
      <label class="field"><span>Договор: номер и дата</span><div class="row" style="flex-wrap:nowrap"><input class="input" id="pfCNum" value="${esc(p && p.contract ? p.contract.num : '')}" placeholder="П-2026-011"><input class="input" type="date" id="pfCDate" value="${esc(p && p.contract ? p.contract.date : '')}"></div></label>
      <label class="field" style="grid-column:1/-1"><span>Условия взаимодействия</span><textarea class="textarea" id="pfTerms" placeholder="Что даём мы, что даёт партнёр, как считаем и когда платим">${esc(v('terms'))}</textarea></label>
    </div>`;
  openModal({title: p ? p.name : 'Новый партнёр', wide: true, body,
    foot: `<button class="btn" data-close>Отмена</button><button class="btn primary" data-ok>${p ? 'Сохранить' : 'Добавить'}</button>`,
    onMount(el, close) {
      $('[data-ok]', el).onclick = () => {
        const name = $('#pfName', el).value.trim();
        if (!name) { $('#pfName', el).classList.add('need'); $('#pfName', el).focus(); return; }
        const cnum = $('#pfCNum', el).value.trim(), cdate = $('#pfCDate', el).value;
        const d = {name, category: $('#pfCat', el).value, city: $('#pfCity', el).value.trim(), address: $('#pfAddr', el).value.trim(), contactName: $('#pfCName', el).value.trim(), contactRole: $('#pfCRole', el).value.trim(),
          phone: phoneDigits($('#pfPhone', el).value), tg: tgUser($('#pfTg', el).value), email: $('#pfEmail', el).value.trim(), site: $('#pfSite', el).value.trim(), model: $('#pfModel', el).value,
          rate: parseNum($('#pfRate', el).value) / 100, promo: $('#pfPromo', el).value.trim().toUpperCase(), terms: $('#pfTerms', el).value.trim(), contract: cnum || cdate ? {num: cnum, date: cdate, until: p && p.contract ? p.contract.until || '' : ''} : null};
        if (p) { Store.patch('partners', p.id, d); if (!d.contract) Store.patch('partners', p.id, {contract: null}); close(); return; }
        const nid = Store.add('partners', {...d, stage, funnel: 'partners', manager: Who.id(), offers: {}, created: today(), createdAt: Date.now(), stageAt: Date.now(),
          ev: {[uid()]: {kind: 'sys', t: Date.now(), by: Who.id(), text: 'Партнёр добавлен'}}});
        close();
        App.go('partner-' + nid);
      };
    }});
}

function openOfferForm(p, oid) {
  const o = oid ? (p.offers || {})[oid] : null;
  openModal({title: o ? 'Спецпредложение' : 'Новое спецпредложение', body: `<label class="field"><span>Что предлагаем</span><input class="input" id="ofTitle" value="${esc(o ? o.title : '')}" placeholder="−15% на уход по промокоду"></label>
      <div class="grid3"><label class="field"><span>Промокод</span><input class="input" id="ofPromo" value="${esc(o ? o.promo : p.promo || '')}"></label>
      <label class="field"><span>Скидка, %</span><input class="input num" id="ofDisc" value="${esc(o ? o.discount || '' : '')}"></label>
      <label class="field"><span>Действует до</span><input class="input" type="date" id="ofUntil" value="${esc(o ? o.until || '' : addDays(today(), 90))}"></label></div>
      <label class="field"><span>Для кого</span><select class="select" id="ofFor">${opts([['участницам Евы', 'Участницам Евы'], ['клиентам партнёра', 'Клиентам партнёра — от Евы']], o ? o.forWhom : 'участницам Евы')}</select></label>`,
    foot: `${o ? '<button class="btn danger left" data-arch>В архив</button>' : ''}<button class="btn" data-close>Отмена</button><button class="btn primary" data-ok>Сохранить</button>`,
    onMount(el, close) {
      $('[data-ok]', el).onclick = () => {
        const title = $('#ofTitle', el).value.trim();
        if (!title) { $('#ofTitle', el).classList.add('need'); return; }
        Store.patch('partners', p.id, {offers: {[oid || 'o' + uid().slice(-5)]: {title, promo: $('#ofPromo', el).value.trim().toUpperCase(), discount: parseNum($('#ofDisc', el).value) || 0, until: $('#ofUntil', el).value, forWhom: $('#ofFor', el).value}}});
        close();
      };
      const a = $('[data-arch]', el);
      if (a) a.onclick = () => { Store.patch('partners', p.id, {offers: {[oid]: {archived: true}}}); close(); };
    }});
}

App.register('partner', {
  title: id => (Partners.get(id) || {}).name || 'Партнёр',
  render(root, id) {
    const p = Partners.get(id);
    if (!p) { root.innerHTML = `<a class="back-link" href="#partners">${icon('back')}Партнёры</a><div class="empty"><b>Партнёр не найден</b></div>`; return; }
    const s = Partners.stats(p);
    const canEdit = Who.can('partners.edit') && !Who.readOnly();
    const mode = View.get('cm.mode', 'msg');
    const tab = View.get('pp.tab', 'feed');
    const evs = Ev.list(p);
    const clients = Partners.clients(p);
    const offers = Partners.offers(p);
    const mapUrl = 'https://yandex.ru/maps/?text=' + encodeURIComponent(`${p.city || ''}, ${p.address || ''}`);
    const pane = tab === 'clients' ? (clients.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Клиентка</th><th>Пришла</th><th>Этап</th><th>Подписка</th><th class="r">Принесла</th></tr></thead><tbody>
        ${clients.map(c => `<tr><td><a class="inline-link" href="#client-${c.id}">${esc(Clients.name(c))}</a></td><td>${dayShort(c.created)}</td><td>${stagePill('sales', c.stage)}</td><td>${subPill(c)}</td><td class="r">${rub(cx(c).ltv)}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="note">Пока никого. Клиентка привязывается к партнёру по промокоду или вручную в карточке («Привёл партнёр»).</p>')
      : timelineHtml('partners', p, evs, canEdit);

    root.innerHTML = `
      <a class="back-link" href="#partners">${icon('back')}Партнёры</a>
      <div class="cc-head">${avatar(p.name, 'xl')}
        <div class="cc-title"><h1>${esc(p.name)}</h1>
          <div class="cc-sub">${stagePill('partners', p.stage)}<span>${esc(p.category)}</span><span>${esc(p.city)}</span>${p.promo ? `<span class="promo">${esc(p.promo)}</span>` : ''}</div></div>
        <div class="cc-acts">${canEdit ? `<button class="btn sm" data-edit>${icon('edit')}Изменить</button>` : ''}<a class="btn sm" href="${esc(mapUrl)}" target="_blank" rel="noopener">${icon('pin')}На карте</a></div>
      </div>
      ${stepperHtml('partners', p, canEdit)}
      <div class="cc-grid">
        <div class="cc-main">${canEdit ? composerHtml('partners', p, mode === 'pay' ? 'msg' : mode) : ''}
          <div class="card">${tabsHtml('pp.tab', [['feed', 'Лента', evs.length], ['clients', 'Приведённые клиентки', clients.length]], tab)}<div class="cc-pane">${pane}</div></div></div>
        <aside class="cc-side">
          <div class="card"><div class="mini-h"><h3>Контактное лицо</h3></div>
            ${kv('Имя', esc(p.contactName || ''))}${kv('Должность', esc(p.contactRole || ''))}
            ${kv('Телефон', p.phone ? `${esc(phoneFmt(p.phone))} <button class="link-btn" data-copy="${esc(phoneFmt(p.phone))}">копировать</button>` : '')}
            ${kv('Telegram', p.tg ? `<a href="https://t.me/${esc(tgUser(p.tg))}" target="_blank" rel="noopener">@${esc(tgUser(p.tg))}</a>` : '')}
            ${kv('Почта', esc(p.email || ''))}</div>
          <div class="card"><div class="mini-h"><h3>Адрес</h3></div><p style="font-size:13.5px">${esc(p.city || '')}${p.address ? ', ' + esc(p.address) : ''}</p><a class="inline-link" href="${esc(mapUrl)}" target="_blank" rel="noopener">Открыть в Яндекс Картах</a></div>
          <div class="card"><div class="mini-h"><h3>Условия взаимодействия</h3></div>
            ${kv('Формат', esc(PARTNER_MODELS[p.model] || ''))}${kv('Ставка партнёра', s.rate ? pct(s.rate) : 'без денег')}
            ${p.contract ? kv('Договор', `${esc(p.contract.num || '')}${p.contract.date ? ' от ' + dayShort(p.contract.date) : ''}`) : kv('Договор', '<span class="warn">не подписан</span>')}
            ${p.terms ? `<p class="note" style="margin-top:6px;color:var(--ink-2)">${esc(p.terms)}</p>` : ''}</div>
          <div class="card"><div class="mini-h"><h3>Спецпредложения</h3>${canEdit ? '<button class="btn xs ghost" data-offer="">+ Добавить</button>' : ''}</div>
            <div class="stack">${offers.map(o => `<div class="offer"><span class="ico">${icon('gift')}</span><div style="flex:1"><b>${esc(o.title)}</b><small>${o.promo ? `<span class="promo">${esc(o.promo)}</span> · ` : ''}${esc(o.forWhom || '')}${o.until ? ` · до ${dayShort(o.until)}` : ''}</small></div>${canEdit ? `<button class="icon-btn" data-offer="${o.id}">${icon('edit')}</button>` : ''}</div>`).join('') || '<p class="note">Пока нет.</p>'}</div></div>
          ${Who.can('money.view') ? `<div class="card"><div class="mini-h"><h3>Что приносит</h3></div>${kv('Клиенток', `${s.n} · оплатили ${s.paying}`)}${kv('Принесли', rub(s.revenue))}${kv('Вознаграждение', rub(s.reward))}${kv('Выплачено', rub(s.paidOut))}${kv('К выплате', `<b>${rub(Math.max(0, s.reward - s.paidOut))}</b>`)}</div>` : ''}
        </aside>
      </div>`;

    wireTabs(root);
    wireStepper(root, 'partners', p);
    wireTimeline(root, 'partners', p);
    wireComposer(root, 'partners', p);
    on(root, 'click', '[data-edit]', () => openPartnerForm(p.id));
    on(root, 'click', '[data-offer]', (e, el) => openOfferForm(p, el.dataset.offer));
    on(root, 'click', '[data-copy]', async (e, el) => { if (await copyText(el.dataset.copy)) toast('Скопировано'); });
  },
});
