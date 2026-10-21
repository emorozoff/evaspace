/* Анкета «Каким быть Ясеню» — команда учит ассистента характеру и жаргону
   Eva Club. Открывается по ссылке #yasen. У каждого вопроса варианты и своё
   поле. Ответ человека — один документ в коллекции yasen (id — его карточка
   или учётка): свой видит и правит каждый, все ответы — основатель. */

const YASEN_Q = [
  {block: 'Характер'},
  {id: 'traits', q: 'Каким должен быть Ясень? Выберите до трёх слов', multi: 3, opts: ['Заботливый', 'Точный', 'С юмором', 'Строгий', 'Вдохновляющий', 'Спокойный', 'Дерзкий', 'Тёплый']},
  {id: 'address', q: 'Как Ясеню обращаться к команде?', opts: ['«Команда»', '«Коллеги»', 'По именам', '«Звёзды Евы»']},
  {id: 'you', q: 'На «ты» или на «вы»?', opts: ['На «ты»', 'На «вы»', 'С основателями на «вы», с остальными на «ты»']},
  {id: 'humor', q: 'Сколько юмора?', opts: ['Без шуток, только дело', 'Иногда, по настроению', 'Часто, но по делу', 'Ржём, но работаем']},
  {id: 'noJoke', q: 'Где шутить нельзя?', text: 'Например: деньги, увольнения, жалобы клиенток'},
  {id: 'emoji', q: 'Эмодзи?', opts: ['Побольше, это весело', 'В меру', 'Лучше без них']},
  {block: 'Работа'},
  {id: 'deadline', q: 'Как напоминать о сроках?', opts: ['Мягко: «не забудь, пожалуйста»', 'Твёрдо: «срок сегодня»', 'Твёрдо и с эскалацией основателю']},
  {id: 'alone', q: 'Что Ясень может делать сам, без спроса?', multi: 9, opts: ['Напоминать о сроках в личку', 'Предлагать улучшения', 'Ставить задачи из протокола', 'Предлагать перенос созвона без кворума', 'Подводить итоги недели', 'Отмечать молодцов в чате']},
  {id: 'never', q: 'Чего Ясень не делает никогда?', text: 'Например: не пишет ночью, не обсуждает зарплаты в общем чате'},
  {id: 'future', q: 'Какие задачи отдать Ясеню в будущем?', text: 'Например: отчёты инвесторам, онбординг новичков, ответы экспертам'},
  {block: 'Образ'},
  {id: 'avatar', q: 'Как выглядит Ясень на аватарке?', opts: ['Дерево ясень', 'Мудрая сова', 'Добрый робот', 'Звезда Евы']},
  {id: 'colors', q: 'Цвета и стиль аватара', text: 'Например: розовое золото, нежный, минимализм'},
  {id: 'values', q: 'Какие ценности Eva Space Ясень должен нести?', multi: 9, opts: ['Забота о себе', 'Честность', 'Поддержка друг друга', 'Качество во всём', 'Свобода и лёгкость', 'Результат']},
  {block: 'Жаргон Eva Club: научи Ясеня фразе'},
  {id: 'p_morning', q: 'Утром Ясень здоровается так…', text: 'Доброе утро, …', phrase: true},
  {id: 'p_early', q: 'Задачу закрыли раньше срока. Ясень говорит…', text: 'Огонь! …', phrase: true},
  {id: 'p_fire', q: 'Дедлайн горит. Ясень говорит…', text: '', phrase: true},
  {id: 'p_late', q: 'Созвон начался, а кого-то нет. Ясень пишет…', text: '', phrase: true},
  {id: 'p_ok', q: 'Протокол согласовали все. Ясень радуется…', text: '', phrase: true},
  {id: 'p_win', q: 'Первая продажа, новая звезда на платформе, победа. Ясень кричит…', text: '', phrase: true},
  {id: 'p_own', q: 'Своя ситуация и фраза', text: 'Когда …, Ясень говорит «…»', phrase: true},
];
const yasenMe = () => Tasks.meKey();
const yasenMine = () => Store.get('yasen', yasenMe());

App.register('yasen', {
  title: 'Анкета Ясеня',
  render(root) {
    if (!Auth.me()) { root.innerHTML = noAccess(); return; }
    const mine = yasenMine(), a = (mine && mine.answers) || {};
    const done = !!(mine && mine.at), all = Store.all('yasen').filter(x => x.at);
    const field = x => {
      if (x.block) return `<h2 class="ys-block">${esc(x.block)}</h2>`;
      const v = a[x.id] || {}, sel = Array.isArray(v.pick) ? v.pick : v.pick ? [v.pick] : [];
      const chips = (x.opts || []).map(o => `<button type="button" class="chip ys-chip ${sel.includes(o) ? 'on' : ''}" data-ys="${x.id}" data-multi="${x.multi || 0}" data-v="${esc(o)}">${esc(o)}</button>`).join('');
      return `<div class="card ys-q ${x.phrase ? 'phrase' : ''}" data-q="${x.id}"><b>${esc(x.q)}</b>
        ${chips ? `<div class="chips ys-opts">${chips}</div>` : ''}
        <input class="input ys-own" data-own="${x.id}" maxlength="300" value="${esc(v.own || '')}" placeholder="${esc(x.opts ? 'Свой вариант' : x.text || 'Ваш ответ')}"></div>`;
    };
    root.innerHTML = `
      ${pageHead('Каким быть Ясеню? 🌳', 'Ясень — ассистент нашей команды. Помогите ему стать живым: характер, манеры и фирменные фразы Eva Club. 3–5 минут, можно выбирать варианты или писать свои.')}
      ${done ? `<div class="card ys-thanks">${icon('tick')}<span>Спасибо! Ваши ответы у Ясеня. Можно поправить и сохранить ещё раз.</span></div>` : ''}
      <form id="ysForm" class="ys-form">${YASEN_Q.map(field).join('')}
        <div class="row ys-act"><button class="btn primary" type="submit">${icon('spark')}${done ? 'Сохранить ответы' : 'Отправить Ясеню'}</button><span class="note">Ответы видят Ясень и основатель.</span></div>
      </form>
      ${Auth.isOwner() && all.length ? yasenAllHtml(all) : ''}`;
    const form = $('#ysForm', root);
    on(form, 'click', '[data-ys]', (e, b) => {
      const max = Number(b.dataset.multi), box = b.parentElement;
      if (!max) $$('[data-ys]', box).forEach(x => { if (x !== b) x.classList.remove('on'); });
      else if (!b.classList.contains('on') && $$('.on', box).length >= max) { toast(`Не больше ${max}`); return; }
      b.classList.toggle('on');
    });
    form.addEventListener('submit', e => {
      e.preventDefault();
      const answers = {};
      YASEN_Q.filter(x => x.id).forEach(x => {
        const box = $(`[data-q="${x.id}"]`, form), pick = $$('[data-ys].on', box).map(b => b.dataset.v);
        const own = $('[data-own]', box).value.trim();
        if (pick.length || own) answers[x.id] = {pick: x.multi ? pick : pick[0] || '', own};
      });
      if (!Object.keys(answers).length) { toast('Ответьте хотя бы на один вопрос 🙂'); return; }
      Store.put('yasen', yasenMe(), {answers, name: whoName(yasenMe()), at: Date.now()});
      toast('Готово! Ясень запомнил 🌳');
      window.scrollTo({top: 0, behavior: 'smooth'});
    });
  },
});
/* основателю: ответы всей команды по вопросам */
function yasenAllHtml(all) {
  const show = v => [].concat(v.pick || []).filter(Boolean).concat(v.own ? [`«${v.own}»`] : []).join(', ');
  return `<section class="section"><div class="section-head"><h2>Ответы команды · ${all.length}</h2></div>
    ${YASEN_Q.filter(x => x.id).map(x => {
      const rows = all.map(p => ({p, v: (p.answers || {})[x.id]})).filter(r => r.v && show(r.v));
      return rows.length ? `<div class="card ys-ans"><b>${esc(x.q)}</b>${rows.map(r => `<div><small>${esc(r.p.name || '')}</small> ${esc(show(r.v))}</div>`).join('')}</div>` : '';
    }).join('')}</section>`;
}
