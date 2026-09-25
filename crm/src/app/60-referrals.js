/* Рефералы: «Приведи подругу» и амбассадоры. Начисления считаются из
   фактических оплат приглашённых (одна ступень, без «сетки»). Раз в месяц —
   реестр: каждой пригласившей — вывод на карту или деньги на балансе Евы
   (+10% сверху). Выплата — до 10 числа следующего месяца. */

App.register('referrals', {
  title: 'Рефералы',
  render(root) {
    const tab = View.get('rf.tab', 'people');
    const s = settings();
    const refs = Referral.list();
    const rows = refs.map(r => ({r, st: Referral.of(r), stage: Referral.stageOf(r)}));
    const invited = sum(rows, x => x.st.inv.length);
    const paying = sum(rows, x => x.st.paying);
    const accrued = sum(rows, x => x.st.accrued);
    const cur = monthOf(today());
    const prev = addMonths(cur, -1);
    const regPrev = Referral.registry(prev);
    const duePrev = sum(regPrev.filter(x => x.status === 'due'), x => x.due);
    const onBalance = sum(Clients.all(), c => (c.refProgram || Referral.invitees(c.id).length) ? c.balance || 0 : 0);
    const canPay = Who.can('payouts.manage') && !Who.readOnly();

    let body = '';
    if (tab === 'people') {
      const f = View.get('rf.prog', '');
      const list = rows.filter(x => !f || Referral.program(x.r) === f).sort((a, b) => b.st.accrued - a.st.accrued);
      body = `<div class="t-bar"><div class="seg">${[['', 'Все'], ...Object.entries(REF_PROGRAMS).map(([k, p]) => [k, p.name])].map(([k, n]) => `<button data-prog="${k}" class="${f === k ? 'on' : ''}">${esc(n)}</button>`).join('')}</div></div>
        <div class="table-wrap"><table class="t"><thead><tr><th>Пригласившая</th><th>Программа</th><th>Уровень · ставка</th><th class="r">Пригласила</th><th class="r">Оплатили</th><th class="r">Принесли</th><th class="r">Начислено</th><th class="r">Получила</th><th class="r">Доступно</th><th>Как получать</th></tr></thead><tbody>
        ${list.map(({r, st}) => {
          const prog = Referral.program(r);
          const rate = prog === 'friend' ? s.refRates[levelOf(r.points).id] : prog === 'key' ? s.ambKeyRate : s.ambRate;
          const needTax = r.refMode === 'card' && prog !== 'friend' && !['npd', 'ip'].includes(r.taxStatus);
          return `<tr style="cursor:pointer" data-href="#client-${r.id}"><td><span class="row" style="gap:8px;align-items:center;flex-wrap:nowrap">${avatar(Clients.name(r))}<b>${esc(Clients.name(r))}</b></span><small class="muted">${esc(r.refCode || '')}</small></td>
            <td><span class="pill ${prog === 'friend' ? 'rose' : prog === 'key' ? 'gold' : 'violet'}">${esc(REF_PROGRAMS[prog].name)}</span></td>
            <td>${prog === 'friend' ? esc(levelOf(r.points).name) + ' · ' : ''}${pct(rate)}${prog !== 'friend' ? ' чистого' : ''}</td>
            <td class="r">${st.inv.length}</td><td class="r">${st.paying}</td><td class="r">${rub(st.revenue)}</td><td class="r">${rub(st.accrued)}</td><td class="r">${rub(st.settled)}</td><td class="r"><b>${rub(Math.max(0, st.available))}</b></td>
            <td>${r.refMode === 'card' ? 'на карту' : 'на баланс'}${needTax ? ' <span class="pill bad" title="Амбассадорам платим только самозанятым и ИП">нужен статус</span>' : ''}</td></tr>`;
        }).join('') || '<tr><td colspan="10"><p class="note">Пока никто никого не пригласил.</p></td></tr>'}
        </tbody></table></div>`;
    } else if (tab === 'registry') {
      const months = monthsBack(4);
      const m = View.get('rf.month', prev);
      const reg = Referral.registry(m);
      const closed = m >= cur;
      const toCard = reg.filter(x => x.status === 'due' && x.mode === 'card');
      const toBal = reg.filter(x => x.status === 'due' && x.mode === 'balance');
      body = `<div class="t-bar"><div class="seg">${months.map(x => `<button data-month="${x}" class="${x === m ? 'on' : ''}">${monthName(x)}</button>`).join('')}</div><span class="t-bar-sp"></span>
          ${reg.length ? `<button class="btn sm" data-reg-csv>${icon('download')}Реестр для бухгалтерии</button>` : ''}
          ${canPay && !closed && toBal.length ? `<button class="btn sm primary" data-pay-all-bal>Зачислить на балансы (${toBal.length})</button>` : ''}</div>
        ${closed ? `<div class="warnline" style="margin-bottom:12px">${icon('clock')}<span>${monthName(m)} ещё идёт: начисления копятся. Реестр закрывается после конца месяца, выплата — до ${s.refPayDay} ${MONTHS_GEN[monthIdx(addMonths(m, 1))]}.</span></div>` : `<p class="note" style="margin-bottom:10px">Выплата за ${MONTHS[monthIdx(m)]} — до ${s.refPayDay} ${MONTHS_GEN[monthIdx(addMonths(m, 1))]}. На карту: ${rub(sum(toCard, x => x.due))} (${toCard.length}), на балансы: ${rub(sum(toBal, x => x.due))} + ${pct(s.refBalanceBonus)} бонусом.</p>`}
        <div class="table-wrap"><table class="t"><thead><tr><th>Пригласившая</th><th>Программа</th><th class="r">Начислено за месяц</th><th class="r">К выплате с переносом</th><th>Как</th><th>Статус</th><th></th></tr></thead><tbody>
        ${reg.map(x => {
          const ps = PAYOUT_STATUS[x.status] || PAYOUT_STATUS.due;
          const bonus = x.mode === 'balance' ? Math.round(x.due * s.refBalanceBonus) : 0;
          return `<tr><td><a class="inline-link" href="#client-${x.r.id}">${esc(Clients.name(x.r))}</a></td><td>${esc(REF_PROGRAMS[Referral.program(x.r)].name)}</td><td class="r">${rub(x.inMonth)}</td>
            <td class="r"><b>${rub(x.due)}</b>${bonus ? `<br><small class="muted">+${rub(bonus)} бонус</small>` : ''}</td>
            <td>${x.mode === 'card' ? `на карту${x.needTax ? ' <span class="pill bad">нет статуса самозанятой</span>' : ''}` : 'на баланс Евы'}${x.status === 'carry' ? `<br><small class="muted">минимум для вывода ${rub(x.min)}</small>` : ''}</td>
            <td><span class="pill ${ps.tone}">${esc(ps.name)}</span>${x.row && x.row.at ? `<br><small class="muted">${dayShort(isoTs(x.row.at))}</small>` : ''}</td>
            <td class="r">${canPay && !closed && ['due', 'carry', 'hold'].includes(x.status) ? `<div class="row" style="gap:4px;justify-content:flex-end">
              ${x.mode === 'card' && x.status === 'due' && !x.needTax ? `<button class="btn xs good" data-pay="${x.r.id}|paid|${x.due}">Выплачено</button>` : ''}
              <button class="btn xs" data-pay="${x.r.id}|balance|${x.due}">На баланс</button>
              ${x.status !== 'hold' ? `<button class="btn xs ghost" data-pay="${x.r.id}|hold|${x.due}" title="Возвратов больше ${pct(s.refundPause)} или подозрение на накрутку">Пауза</button>` : ''}</div>`
              : canPay && ['paid', 'balance', 'hold'].includes(x.status) ? `<button class="btn xs ghost" data-unpay="${x.r.id}">Отменить</button>` : ''}</td></tr>`;
        }).join('') || '<tr><td colspan="7"><p class="note">За этот месяц начислений нет.</p></td></tr>'}
        </tbody></table></div>`;
    } else {
      const edit = Who.can('settings.edit') && !Who.readOnly();
      const inp = (k, v, suf = '%', mult = 100) => edit ? `<input class="input num sm" data-set="${k}" data-mult="${mult}" value="${fmt(v * mult, mult === 100 ? 0 : 0).replace(/\s/g, '')}" style="width:90px;display:inline-block"> ${suf}` : `${fmt(v * mult)} ${suf}`;
      body = `<div class="two">
        <div class="card"><div class="card-head"><h2>«Приведи подругу»</h2><span class="pill rose">для всех клиенток</span></div>
          <div class="kv"><span>Ученица</span><b>${inp('refRates.student', s.refRates.student)}</b></div>
          <div class="kv"><span>Практикующая (от 1 000 баллов)</span><b>${inp('refRates.expert', s.refRates.expert)}</b></div>
          <div class="kv"><span>Наставница (от 3 500 баллов)</span><b>${inp('refRates.mentor', s.refRates.mentor)}</b></div>
          <div class="kv"><span>Сколько месяцев платим с одной подруги</span><b>${inp('refMonths', s.refMonths, 'мес.', 1)}</b></div>
          <div class="kv"><span>Вывод на карту — от</span><b>${inp('refMin', s.refMin, '₽', 1)}</b></div>
          <div class="kv"><span>Подруге на первый заказ</span><b>${inp('friendBonus', s.friendBonus, 'бонусов', 1)}</b></div>
          <p class="note" style="margin-top:8px">Процент — с покупок подруги без учёта списанных бонусов. Подруга закрепляется навсегда, самоприглашение и накрутка отключают начисления.</p></div>
        <div class="card"><div class="card-head"><h2>Амбассадоры</h2><span class="pill gold">по приглашению</span></div>
          <div class="kv"><span>Стандартная ставка</span><b>${inp('ambRate', s.ambRate)}</b></div>
          <div class="kv"><span>Ключевым — первый год</span><b>${inp('ambKeyRate', s.ambKeyRate)}</b></div>
          <div class="kv"><span>Минимум к выплате</span><b>${inp('ambMin', s.ambMin, '₽', 1)}</b></div>
          <div class="kv"><span>Чистое поступление от платежа</span><b>${inp('netFactor', s.netFactor)}</b></div>
          <div class="kv"><span>Пауза, если возвратов больше</span><b>${inp('refundPause', s.refundPause)}</b></div>
          <p class="note" style="margin-top:8px">Только с подписок, от чистого поступления (платёж − эквайринг ≈3% − налог 6%). Годовая подписка начисляется по 1/12 в месяц. Выплата — самозанятым и ИП, по чеку или счёту.</p></div>
        <div class="card"><div class="card-head"><h2>Выплаты</h2></div>
          <div class="kv"><span>День выплаты за прошлый месяц</span><b>${inp('refPayDay', s.refPayDay, 'число', 1)}</b></div>
          <div class="kv"><span>Бонус, если оставить на балансе Евы</span><b>${inp('refBalanceBonus', s.refBalanceBonus)}</b></div>
          <ul class="legal" style="margin-top:8px"><li><b>На баланс Евы</b> — без минимума, сразу после закрытия месяца, +${pct(s.refBalanceBonus)}. Тратится на подписку, курсы и маркет.</li>
            <li><b>Вывод на карту</b> — раз в месяц, от минимума; меньше — копится до следующего месяца.</li>
            <li>Физлицам без статуса выгоднее баланс: выплата деньгами физлицу делает компанию налоговым агентом (НДФЛ и взносы).</li></ul></div>
        <div class="card"><div class="card-head"><h2>Правила, которые защищают</h2></div>
          <ul class="legal"><li>Одна ступень: платим только за тех, кого пригласила сама. Начислений «с приглашённых приглашённых» нет — иначе риск признания пирамидой (ст. 14.62 КоАП).</li>
            <li>Только с фактических оплат; возврат оплаты уменьшает начисление.</li>
            <li>Баллы и бонусы — скидка без денежного номинала, их нельзя вывести.</li>
            <li>Метка источника в ссылке (eva.space/r/код) закрепляет подругу за пригласившей.</li></ul></div>
      </div>`;
    }

    root.innerHTML = `
      ${pageHead('Рефералы', '«Приведи подругу» и амбассадоры: кто кого пригласил, сколько начислено и что выплатить в этом месяце.')}
      <div class="tiles6">
        <div class="card stat"><span class="label">Пригласившие</span><div class="big">${refs.length}</div><div class="foot">амбассадоров ${refs.filter(r => ['amb', 'key'].includes(r.refProgram)).length}</div></div>
        <div class="card stat"><span class="label">Приглашено</span><div class="big">${invited}</div><div class="foot">оплатили ${paying} · ${invited ? pct(paying / invited) : '—'}</div></div>
        <div class="card stat"><span class="label">Начислено всего</span><div class="big">${rubK(accrued)}</div><div class="foot">с фактических оплат</div></div>
        <div class="card stat"><span class="label">К выплате за ${MONTHS[monthIdx(prev)]}</span><div class="big">${rubK(duePrev)}</div><div class="foot">до ${s.refPayDay} ${MONTHS_GEN[monthIdx(cur)]}</div></div>
        <div class="card stat"><span class="label">На балансах Евы</span><div class="big">${rubK(onBalance)}</div><div class="foot">у пригласивших</div></div>
      </div>
      <div class="split section">
        <div class="card"><div class="card-head"><h2>Воронка рефералов</h2><span class="note">по пригласившим</span></div>
          ${funnelBars(REF_STAGES.map((st, i) => ({name: st.name, n: rows.filter(x => REF_STAGES.findIndex(z => z.id === x.stage) >= i).length, won: st.id === 'paid'})))}</div>
        <div class="card"><div class="card-head"><h2>Начисления по месяцам</h2></div>
          ${barChart({labels: monthsBack(6).map(m => ({text: monthName(m), tick: monthShort(m)})), values: monthsBack(6).map(m => sum(rows, x => sum(x.st.acc.filter(a => a.month === m), a => a.amount))), height: 180, yFmt: rubK, color: 'var(--gold)', half: true})}</div>
      </div>
      <div class="section">${tabsHtml('rf.tab', [['people', 'Пригласившие', refs.length], ['registry', 'Реестр выплат'], ['rules', 'Условия программы']], tab)}${body}</div>`;

    wireTabs(root);
    on(root, 'click', '[data-href]', (e, el) => { if (!e.target.closest('a')) location.hash = el.dataset.href; });
    on(root, 'click', '[data-prog]', (e, el) => { View.set('rf.prog', el.dataset.prog); App.render(); });
    on(root, 'click', '[data-month]', (e, el) => { View.set('rf.month', el.dataset.month); App.render(); });
    on(root, 'click', '[data-pay]', (e, el) => { const [rid, status, amount] = el.dataset.pay.split('|'); payoutMark(View.get('rf.month', prev), rid, status, Number(amount)); });
    on(root, 'click', '[data-unpay]', (e, el) => payoutUndo(View.get('rf.month', prev), el.dataset.unpay));
    on(root, 'click', '[data-pay-all-bal]', async (e, el) => {
      const m = View.get('rf.month', prev);
      const list = Referral.registry(m).filter(x => x.status === 'due' && x.mode === 'balance');
      if (!await confirmPop(el, {text: `Зачислить ${list.length} ${plural(list.length, 'пригласившей', 'пригласившим', 'пригласившим')} на баланс?`, yes: 'Зачислить'})) return;
      list.forEach(x => payoutMark(m, x.r.id, 'balance', x.due));
    });
    on(root, 'click', '[data-reg-csv]', () => {
      const m = View.get('rf.month', prev);
      const reg = Referral.registry(m);
      const rowsCsv = [['Месяц', 'Пригласившая', 'Телефон', 'Почта', 'Программа', 'Налоговый статус', 'Начислено за месяц', 'К выплате', 'Как', 'Статус'],
        ...reg.map(x => [m, Clients.name(x.r), phoneFmt(x.r.phone), x.r.email || '', REF_PROGRAMS[Referral.program(x.r)].name, ({npd: 'самозанятая', ip: 'ИП', none: 'физлицо'})[x.r.taxStatus] || '', x.inMonth, x.due, x.mode === 'card' ? 'на карту' : 'на баланс', PAYOUT_STATUS[x.status].name])];
      saveFile(`eva-reestr-vyplat-${m}.csv`, csvOf(rowsCsv), 'Реестр выплат');
    });
    on(root, 'change', '[data-set]', (e, el) => {
      const k = el.dataset.set, mult = Number(el.dataset.mult);
      const v = parseNum(el.value) / mult;
      const patch = k.includes('.') ? {[k.split('.')[0]]: {[k.split('.')[1]]: v}} : {[k]: v};
      saveSettings(patch);
      toast('Условия обновлены');
    });
  },
});

function payoutMark(month, rid, status, amount) {
  const r = Clients.get(rid);
  const s = settings();
  if (!Store.get('payouts', month)) Store.put('payouts', month, {month, createdAt: Date.now(), rows: {}});
  Store.patch('payouts', month, {rows: {[rid]: {status, amount, mode: status === 'paid' ? 'card' : r.refMode || 'balance', at: Date.now(), by: Who.id()}}});
  if (status === 'balance') {
    const add = Math.round(amount * (1 + s.refBalanceBonus));
    Store.patch('clients', rid, {balance: (r.balance || 0) + add});
    Ev.add('clients', rid, {kind: 'sys', text: `Реферальные за ${monthName(month)}: ${rub(amount)} + ${pct(s.refBalanceBonus)} бонус = ${rub(add)} зачислено на баланс Евы`});
  } else if (status === 'paid') {
    Ev.add('clients', rid, {kind: 'sys', text: `Реферальные за ${monthName(month)}: ${rub(amount)} выплачено на карту`});
  } else if (status === 'hold') {
    Ev.add('clients', rid, {kind: 'note', text: `Реферальные за ${monthName(month)} на паузе: проверить возвраты и накрутку`});
  }
  toast(status === 'hold' ? 'Начисление на паузе' : 'Отмечено');
}
function payoutUndo(month, rid) {
  const reg = Store.get('payouts', month);
  const row = reg && reg.rows && reg.rows[rid];
  if (!row) return;
  if (row.status === 'balance') {
    const r = Clients.get(rid);
    Store.patch('clients', rid, {balance: Math.max(0, (r.balance || 0) - Math.round(row.amount * (1 + settings().refBalanceBonus)))});
  }
  Store.unset('payouts', month, ['rows', rid]);
  toast('Отметка снята');
}
