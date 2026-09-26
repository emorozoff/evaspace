/* Режим интервью: всё, что нужно в Zoom, на одном экране.
   Слева — сценарий начала, вопросы с заметками (задан / звёздочка — яркая
   цитата), «что ещё прозвучало» и сценарий завершения. Справа — что уже
   знаем из анкеты, метки на лету и шпаргалка уточняющих вопросов. Таймер
   помнится в этом браузере и не сбрасывается от перерисовки; «Завершить
   интервью» сохраняет длительность и открывает итог. */

/* ── таймер: {start, acc} в состоянии вида — переживает перерисовку и перезагрузку ── */
const Timer = {
  id: null,
  get(pid) { return View.get('tm.' + pid, null); },
  secs(pid) { const t = this.get(pid); return t ? Math.floor(((t.start ? Date.now() - t.start : 0) + (t.acc || 0)) / 1000) : 0; },
  running(pid) { const t = this.get(pid); return !!(t && t.start); },
  start(pid) { const t = this.get(pid) || {acc: 0}; if (!t.start) { t.start = Date.now(); View.set('tm.' + pid, t); } },
  toggle(pid) {
    const t = this.get(pid) || {acc: 0};
    if (t.start) { t.acc = (t.acc || 0) + Date.now() - t.start; t.start = null; } else t.start = Date.now();
    View.set('tm.' + pid, t);
  },
  reset(pid) { View.set('tm.' + pid, null); },
  /* одна секундная стрелка на всё окно: обновляет все таймеры на экране */
  wire() {
    if (this.id) return;
    this.id = setInterval(() => $$('[data-timer-for]').forEach(el => { el.textContent = dur(Timer.secs(el.dataset.timerFor)); }), 1000);
  },
};

/* что показать из анкеты перед созвоном — самое полезное для разговора */
const KNOWN = {
  client: [['stage', 'Этап жизни'], ['age', 'Возраст'], ['city', 'Город'], ['pain', 'Болит'], ['goal', 'Важно'], ['time', 'Время в день'], ['when', 'Когда удобно'], ['tried', 'Уже пробовала'], ['spend', 'Тратит на себя'], ['formats', 'Интересно в Еве'], ['price', 'Готова платить'], ['fit', 'Идея Евы'], ['source', 'Откуда узнала']],
  expert: [['dirs', 'Направления'], ['topic', 'Тема'], ['exp', 'Стаж'], ['edu', 'Образование'], ['have', 'Уже есть'], ['course', 'Курс с Евой'], ['record', 'Можно записать'], ['where', 'Где снимать'], ['days', 'Время на съёмки'], ['aud', 'Аудитория'], ['deal', 'Формат'], ['check', 'Консультация']],
  partner: [['cat', 'Категория'], ['city', 'Город'], ['clients', 'Клиенток в месяц'], ['ages', 'Возраст клиенток'], ['want', 'Интересно'], ['give', 'Могут дать'], ['tell', 'Где расскажут'], ['aud', 'Соцсети'], ['when', 'Когда удобно']],
  amb: [['use', 'Пользуется Евой'], ['where', 'Где аудитория'], ['size', 'Читают'], ['topic', 'О чём блог'], ['women', 'Кто читает'], ['how', 'Как расскажет'], ['hours', 'Время в неделю'], ['motive', 'Главное'], ['tax', 'Статус'], ['pay', 'Выплаты']],
};
/* сценарий: что сказать в начале и в конце */
const SCRIPT = {
  client: {
    intro: ['Спасибо, что нашла время! Займёт минут 25.', 'Мы делаем Еву и хотим понять твой настоящий опыт. Правильных ответов нет, критика очень помогает.', 'Можно я буду коротко записывать? Ответы увидит только команда.', 'Буду спрашивать про то, что уже было, а не про «купила бы ты».'],
    outro: ['Что я не спросила, а стоило бы?', 'Можно написать тебе через месяц и показать, что получилось?', 'Кого из подруг нам стоит расспросить? Могу прислать ссылку.', 'Спасибо! Ты очень помогла.'],
  },
  expert: {
    intro: ['Спасибо за время! За две минуты расскажу, что такое Ева, дальше — о вас.', 'У нас 30 минут: знакомимся и ищем формат, выгодный обеим сторонам.', 'Можно я буду записывать ключевое?'],
    outro: ['Резюмирую: о чём договорились и какой следующий шаг.', 'Кто и к какому сроку делает следующий шаг?', 'Кого из коллег вы бы нам порекомендовали?', 'Спасибо! Пришлю итоги в Telegram сегодня.'],
  },
  partner: {
    intro: ['Спасибо за встречу! Коротко о Еве и наших участницах, дальше — о вас.', 'Цель — найти формат, который приведёт вам клиенток, а нам — участниц.', 'Можно я буду записывать ключевое?'],
    outro: ['Резюмирую договорённости: предложение, промо, сроки.', 'Кто у вас принимает решение и когда вернёмся с ответом?', 'Какие материалы вам прислать?', 'Спасибо! Пришлю итоги сегодня.'],
  },
  amb: {
    intro: ['Спасибо, что откликнулась! Созвон минут на 20.', 'Хочу понять твою аудиторию и как тебе удобнее рассказывать о Еве.', 'Можно я буду коротко записывать?'],
    outro: ['Резюмирую: как рассказываешь, что тебе нужно от нас, как получаешь вознаграждение.', 'Твоя ссылка — та же, что для анкеты: по ней мы видим, кого ты привела.', 'Кого ещё позвать в амбассадоры?', 'Спасибо! Пришлю материалы сегодня.'],
  },
};
const PROBES = {
  ty: ['Можешь вспомнить конкретный случай?', 'Почему это было важно?', 'А что было дальше?', 'Как ты решала это раньше?', 'Сколько это стоило — времени или денег?', 'Что бы ты сделала на месте Евы?'],
  vy: ['Можете привести пример?', 'Почему это важно для вас?', 'Что было дальше?', 'Как вы решаете это сейчас?', 'Сколько это стоит — времени или денег?', 'Что для вас было бы идеально?'],
};

function knownRows(p) {
  const a = p.answers || {};
  const qs = Questions.set(p.type).test;
  const seen = new Set();
  const val = (q, v) => (q && q.k === 'scale' ? `${v} из 5` : (q ? answerLabels(q, v) : [].concat(v)).map(noEmo).join(', '));
  const rows = (KNOWN[p.type] || []).filter(([id]) => a[id] !== undefined && a[id] !== '' && !(Array.isArray(a[id]) && !a[id].length)).map(([id, label]) => { seen.add(id); return [label, val(qs.find(q => q.id === id), a[id])]; });
  qs.forEach(q => { if (!seen.has(q.id) && !['name', 'tg', 'call', 'social', 'addr', 'contact'].includes(q.id) && a[q.id] !== undefined && a[q.id] !== '') rows.push([noEmo(q.t).replace(/\?.*$/, ''), val(q, a[q.id])]); });
  return rows;
}

function interviewPane(p, canEdit) {
  const qs = Questions.talk(p.type);
  const talk = p.talk || {};
  const T = TYPES[p.type];
  const asked = q => !!((talk[q.id] || {}).a || (talk[q.id] || {}).asked);
  const n = qs.filter(asked).length;
  const cur = qs.find(q => !asked(q));
  const secs = Timer.secs(p.id), run = Timer.running(p.id);
  const known = knownRows(p);
  const tags = p.type === 'client' ? INSIGHT_TAGS : RESULT_TAGS[p.type];
  const res = p.res || {tags: []};
  const S = SCRIPT[p.type] || SCRIPT.client;
  const word = p.type === 'client' ? 'интервью' : p.type === 'partner' ? 'встречу' : 'созвон';
  const done = p.s2 === 'done';
  return `<div class="iv">
    <div class="iv-main">
      <div class="iv-bar">
        <span class="timer ${run ? 'on' : ''}" data-timer-for="${p.id}" title="Длительность">${dur(secs)}</span>
        ${canEdit ? `<button class="btn sm" data-iv-timer>${run ? `${icon('pause')}Пауза` : `${icon('play')}${secs ? 'Продолжить' : 'Старт'}`}</button>` : ''}
        <span class="iv-prog"><b>${n}</b> из ${qs.length} вопросов<span class="iv-pbar"><i style="width:${qs.length ? (n / qs.length * 100).toFixed(0) : 0}%"></i></span></span>
        <span class="sp"></span>
        ${p.zoom ? `<a class="btn sm" href="${esc(p.zoom)}" target="_blank" rel="noopener">${icon('cam')}Zoom</a>` : ''}
        <button class="btn sm ghost" data-copy-q title="Скопировать вопросы в заметки Zoom">${icon('copy')}</button>
        ${canEdit && !done ? `<button class="btn sm primary" data-iv-finish>Завершить ${word}</button>` : ''}
        ${done ? `<span class="st good">${p.callDur ? `прошёл · ${Math.round(p.callDur / 60)} мин` : 'прошёл'}</span>` : ''}
      </div>
      <details class="iv-script" ${n ? '' : 'open'}><summary>Начало разговора</summary><ol>${S.intro.map(x => `<li>${esc(x)}</li>`).join('')}</ol></details>
      <div class="talk">${qs.map((q, i) => { const x = talk[q.id] || {}; const isAsked = asked(q); return `<div class="tq ${x.a ? 'filled' : ''} ${cur && cur.id === q.id ? 'cur' : ''} ${isAsked ? 'asked' : ''}">
        <div class="tq-h">${canEdit ? `<button class="tq-n" data-asked="${q.id}" title="${isAsked ? 'Задан' : 'Отметить, что вопрос задан'}">${isAsked ? '✓' : i + 1}</button>` : `<i>${i + 1}</i>`}<b>${esc(q.t)}</b>${canEdit ? `<button class="star ${x.star ? 'on' : ''}" data-star="${q.id}" title="${x.star ? 'Убрать из цитат' : 'Яркая цитата — попадёт в статистику'}">${icon('star')}</button>` : x.star ? `<span class="star on">${icon('star')}</span>` : ''}</div>
        ${q.why ? `<div class="tq-why">Зачем: ${esc(q.why)}</div>` : ''}
        <textarea class="textarea" data-talk="${q.id}" placeholder="${T.you === 'ты' ? 'Что ответила' : 'Что ответили'}…" ${canEdit ? '' : 'readonly'}>${esc(x.a || '')}</textarea></div>`; }).join('')}
        <div class="tq"><div class="tq-h"><i>＋</i><b>Что ещё важного прозвучало</b></div><textarea class="textarea" data-talk="_extra" placeholder="Всё, что не попало в вопросы" ${canEdit ? '' : 'readonly'}>${esc((talk._extra || {}).a || '')}</textarea></div>
      </div>
      <details class="iv-script" open><summary>Завершение</summary><ol>${S.outro.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
        ${['client', 'amb'].includes(p.type) && canEdit ? `<button class="btn sm" data-act="link" data-pid="${p.id}">${icon('link')}Скопировать ссылку для подруги</button>` : ''}</details>
      ${canEdit && !done ? `<div class="row" style="margin-top:12px"><button class="btn primary" data-iv-finish>Завершить ${word} и перейти к итогу</button></div>` : ''}
    </div>
    <aside class="iv-side">
      <div class="card iv-card"><h3>Что знаем из анкеты</h3>
        ${known.length ? `<div class="iv-known">${known.map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>`
          : `<p class="note">Анкеты нет. Задайте первые вопросы анкеты в начале разговора${canEdit ? ` или <button class="link-btn" data-act="fill" data-pid="${p.id}">заполните её за человека</button>` : ''}.</p>`}</div>
      <div class="card iv-card"><h3>Метки на лету</h3><p class="note">Отмечайте, пока слышите, — они уйдут в итог и статистику.</p>
        <div class="tagpick" data-tags>${tags.map(t => `<button type="button" class="${(res.tags || []).includes(t) ? 'on' : ''}" data-v="${esc(t)}" ${canEdit ? '' : 'disabled'}>${esc(noEmo(t))}</button>`).join('')}</div></div>
      <div class="card iv-card"><h3>Если ответ короткий</h3><ul class="iv-probes">${PROBES[T.you === 'ты' ? 'ty' : 'vy'].map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        <p class="note">Держите паузу 3 секунды — самое важное часто звучит после неё. Не подсказывайте ответ.</p></div>
    </aside>
  </div>`;
}

function wireInterview(root, p) {
  Timer.wire();
  on(root, 'click', '[data-iv-timer]', () => {
    Timer.toggle(p.id);
    if (Timer.running(p.id) && p.s2 !== 'done' && p.s2 !== 'set') People.patch(p.id, {s2: 'set', callAt: Date.now(), callMin: callMin(p)});
    App.render();
  });
  on(root, 'click', '[data-asked]', (e, el) => {
    const qid = el.dataset.asked;
    const cur = (People.get(p.id).talk || {})[qid] || {};
    People.patch(p.id, {talk: {[qid]: {...cur, asked: !cur.asked, t: Date.now()}}});
  });
  on(root, 'click', '[data-iv-finish]', () => finishInterview(p.id));
}

/* завершить: длительность по таймеру, шаг 2 — «прошёл», дальше — итог */
function finishInterview(id) {
  const p = People.get(id);
  if (!p) return;
  const secs = Timer.secs(id);
  const patch = {s2: 'done', talkAt: p.talkAt || Date.now()};
  if (secs >= 60) patch.callDur = secs;
  if (!p.callAt) { patch.callAt = Date.now() - secs * 1000; patch.callMin = callMin(p); }
  People.patch(id, patch, `${p.type === 'client' ? 'Интервью' : 'Созвон'} прошёл${secs >= 60 ? ` · ${Math.round(secs / 60)} мин` : ''}`, '✅');
  Timer.reset(id);
  syncCall(id);
  View.set('pp.last', id);
  View.set('pp.tab', 'result');
  App.render();
  toast(p.type === 'client' ? 'Интервью завершено. Отметьте главное, пока разговор свежий 💡' : 'Созвон завершён. Запишите решение и следующий шаг');
}

/* ── разбор с Claude: черновик итога по анкете и заметкам (платит тот, кто нажал) ── */
async function claudeDraft(p) {
  let sample = null;
  try { sample = window.claude && typeof window.claude.use === 'function' ? await window.claude.use('sample') : null; } catch (e) { sample = null; }
  if (!sample) throw {code: 'unavailable'};
  const qs = Questions.set(p.type).test, tq = Questions.talk(p.type);
  const ans = Object.entries(p.answers || {}).map(([id, v]) => { const q = qs.find(x => x.id === id); return q ? `- ${noEmo(q.t)}: ${answerLabels(q, v).map(noEmo).join(', ')}` : ''; }).filter(Boolean).join('\n');
  const notes = tq.map(q => ((p.talk || {})[q.id] || {}).a ? `- [${q.id}] ${q.t}\n  ${(p.talk[q.id].a || '').trim()}` : '').filter(Boolean).join('\n');
  const extra = ((p.talk || {})._extra || {}).a || '';
  const tags = p.type === 'client' ? INSIGHT_TAGS : RESULT_TAGS[p.type];
  const who = p.type === 'client' ? 'кастдев-интервью с потенциальной клиенткой' : `созвон с ${TYPES[p.type].one.toLowerCase() === 'партнёр' ? 'партнёром' : TYPES[p.type].one.toLowerCase() === 'эксперт' ? 'экспертом' : 'амбассадором'}`;
  const shape = p.type === 'client'
    ? `{"main": "главный инсайт одной фразой, до 160 знаков", "idea": "что улучшить в продукте: 1–3 пункта через «; »", "tags": ["до 4 меток строго из списка"], "quotes": ["id вопросов (t1, t2…) с самыми яркими ответами, не больше 2"], "why": "одно предложение: на каких ответах основан вывод"}`
    : `{"decision": "yes | think | no — подключаем, думает или не сейчас", "tags": ["до 4 меток строго из списка"], "next": "следующий шаг одной фразой", "note": "договорённости и условия, 1–3 предложения", "why": "одно предложение: на каких ответах основан вывод"}`;
  const input = `Ты помогаешь команде Eva Space разобрать ${who}. Eva Space — приложение для женщин 25–45: программа коротких практик под этап жизни, проверенные эксперты, сообщество; подписка 2 900 ₽ в месяц.
Опирайся только на то, что сказал человек, ничего не выдумывай. Пиши по-русски, коротко и без канцелярита.

Анкета:
${ans || '— нет'}

Заметки созвона:
${notes || '— нет'}
${extra ? `\nЕщё прозвучало:\n${extra}` : ''}

Метки (выбирай только из этого списка, пиши точно так же): ${tags.map(t => `«${t}»`).join(', ')}

Верни только JSON такого вида: ${shape}`;
  const out = await sample.json(input, {modelTier: 'default'});
  const clean = {...out};
  clean.tags = (Array.isArray(out.tags) ? out.tags : []).map(t => tags.find(x => x === t || noEmo(x) === noEmo(String(t)))).filter(Boolean).slice(0, 4);
  if (Array.isArray(out.quotes)) clean.quotes = out.quotes.filter(id => ((p.talk || {})[id] || {}).a).slice(0, 2);
  if (clean.decision && !['yes', 'think', 'no'].includes(clean.decision)) delete clean.decision;
  return clean;
}
const CLAUDE_ERR = {
  unavailable: 'Claude недоступен в этом окне — откройте CRM в Claude.',
  not_granted: 'Доступ к Claude для этой страницы не разрешён.',
  rate_limited: 'Слишком много запросов к Claude — попробуйте через минуту.',
};
