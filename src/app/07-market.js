/* =====================================================================
   ОТЧЁТ И КАЛЕНДАРЬ
   ===================================================================== */
function pgReport(){
  const done = S.program.map((_,i) => doneOf(i));
  const total = done.reduce((a,b) => a+b, 0);
  const mins = S.program.flatMap(d => d.tasks).filter(t => t.done).reduce((a,t) => a + t.min, 0);
  const byTag = {};
  S.program.flatMap(d => d.tasks).filter(t => t.done).forEach(t => t.tags.forEach(x => byTag[x] = (byTag[x]||0)+1));
  const top = Object.entries(byTag).sort((a,b) => b[1]-a[1]).slice(0,5);
  const best = done.indexOf(Math.max(...done));

  return `<div class="view pad">${backBtn('Назад')}
    <h1 class="serif" style="font-size:29px;margin:10px 0 4px">Отчёт недели</h1>
    <p class="small muted" style="margin:0 0 16px">Без оценок и стыда - просто картина того, как прошли семь дней.</p>

    <div class="card">
      <div class="spread"><b style="font-size:15px">Выполнено заданий</b>
        <b class="serif" style="font-size:26px">${total} / 21</b></div>
      <div class="rep">${done.map((n,i) => `<div>
        <i style="height:${Math.max(4, n/3*88)}px;${i===todayIdx()?'opacity:1':'opacity:.75'}"></i>
        <span>${DAYS[i]}</span></div>`).join('')}</div>
      <div class="small muted">${total === 0 ? 'Неделя только началась - первая отметка появится здесь.' :
        `Лучший день - ${DAYS[best]}. Всего ${plural(mins,'минута','минуты','минут')} на себя.`}</div>
    </div>

    <div class="g2">
      <div class="card" style="text-align:center;margin:0"><div class="serif" style="font-size:30px">${streak()}</div>
        <div class="small muted">дней подряд</div></div>
      <div class="card" style="text-align:center;margin:0"><div class="serif" style="font-size:30px">${S.stars}</div>
        <div class="small muted">звёзд собрано</div></div>
    </div>

    <div class="card" style="margin-top:14px">
      <b style="font-size:15px">Над чем ты работала</b>
      ${top.length ? top.map(([t,n]) => `
        <div style="margin-top:11px">
          <div class="spread" style="margin-bottom:5px"><span class="small">${t}</span><span class="small muted">${n}</span></div>
          <div class="bar"><i style="width:${n/Math.max(1,top[0][1])*100}%"></i></div>
        </div>`).join('') : `<p class="small muted" style="margin:10px 0 0">Отметь первое задание - и здесь появятся твои темы.</p>`}
    </div>

    <div class="card">
      <b style="font-size:15px">Что говорит Ева</b>
      <p class="small muted" style="margin:8px 0 0">${
        total === 0 ? 'Ты только начала. Самое трудное - первое задание, дальше проще.' :
        total < 7 ? 'Неделя идёт неровно, и это нормально. Попробуй мягкий режим в те дни, когда нет сил: одно задание тоже считается.' :
        total < 15 ? 'Хороший темп. Ты закрываешь больше половины - и это уже устойчивая привычка, а не рывок.' :
        'Отличная неделя. Осторожно с ощущением «надо всё» - на следующей можно сознательно взять день отдыха.'}</p>
    </div>
  </div>`;
}

function pgCycle(){
  const cy = cycleNow();
  const c = S.cycle;
  if(!cy) return `<div class="view pad">${backBtn('Назад')}
    <h1 class="serif" style="font-size:26px;margin:10px 0 4px">Календарь цикла</h1>
    <p class="small muted" style="margin:0 0 14px">Программа будет учитывать фазу и не станет требовать одинаковой энергии всю неделю.</p>
    <div class="card">
      <b style="font-size:15px">Настроим за минуту</b>
      <label class="lbl" style="margin-top:10px">Первый день последних месячных</label>
      <input class="field" type="date" id="cl2" value="${c.last||''}">
      <div class="g2">
        <div><label class="lbl">Длина цикла</label><input class="field" type="number" id="cn2" value="${c.len||28}"></div>
        <div><label class="lbl">Длительность месячных</label><input class="field" type="number" id="cp2" value="${c.period||5}"></div>
      </div>
      <button class="btn" onclick="saveCycle2()">Сохранить</button>
      <p class="small muted" style="margin:10px 0 0">Это оценка по средней длине цикла, а не медицинский прогноз и не способ контрацепции.</p>
    </div>
  </div>`;

  const days = c.len;
  const rec = {
    menstrual:['Отменяй лишнее без чувства вины','Тепло, сон и мягкие практики','Хорошее время подводить итоги месяца'],
    follicular:['Силы растут - можно начинать новое','Тело хорошо отзывается на нагрузку','Планируй важные дела на ближайшие дни'],
    ovulation:['Пик энергии и общительности','Лучшее время для сложных разговоров','Можно взять больше, чем обычно'],
    luteal:['Снижай требования к себе заранее','Больше углеводов и меньше кофеина','Раздражение - это гормоны, а не ты']
  }[cy.phase.k];
  return `<div class="view pad">${backBtn('Назад')}
    <h1 class="serif" style="font-size:26px;margin:10px 0 4px">Календарь цикла</h1>
    <p class="small muted" style="margin:0 0 14px">День ${cy.day} из ${days} · ${esc(cy.phase.n)} фаза</p>

    <div class="card">
      <div class="cyclering">${cycleRing(cy)}</div>
      <div class="spread" style="margin-top:10px">
        <div><b style="font-size:15px">${esc(cy.phase.e)} ${esc(cy.phase.n)} фаза</b>
          <div class="small muted" style="margin-top:3px">${cy.phase.s}</div></div>
      </div>
      <div class="small muted" style="margin-top:10px">Следующие месячные примерно через ${plural(cy.next,'день','дня','дней')}</div>
    </div>

    <div class="g2">
      ${PHASES.map(p => `<div class="phbox ${p.k===cy.phase.k?'on':''}" style="text-align:left;padding:11px">
        <div style="font-size:15px">${esc(p.e)}</div>
        <b style="font-size:12px;display:block;margin-top:4px">${esc(p.n)}</b>
        <div class="small" style="font-size:10.5px;opacity:.75;margin-top:2px">${p.k===cy.phase.k?'сейчас':''}</div>
      </div>`).join('')}
    </div>

    <div class="card" style="margin-top:12px">
      <b style="font-size:15px">Что помогает в этой фазе</b>
      ${rec.map(r => `<div class="achline"><span class="wdot"></span><span style="flex:1">${r}</span></div>`).join('')}
    </div>

    <div class="card">
      <b style="font-size:15px">Программа и цикл</b>
      <p class="small muted" style="margin:7px 0 0">В менструальной и лютеиновой фазе Ева ставит более короткие практики,
        а в фолликулярной и овуляторной - более активные. Если сегодня совсем нет сил, включи мягкий режим на главной.</p>
      <button class="btn ghost" style="margin-top:10px" onclick="openSheet('cycle')">Изменить данные цикла</button>
    </div>
  </div>`;
}
function saveCycle2(){
  const l = ($('#cl2')||{}).value;
  if(!l) return toast('Укажи дату');
  S.cycle = {last:l, len:+($('#cn2')||{}).value || 28, period:+($('#cp2')||{}).value || 5, on:true};
  render(); schedulePersist(); toast('Трекер настроен');
}
function cycleRing(cy){
  const C = 2*Math.PI*46;
  const seg = C * (cy.day / cy.len);
  return `<svg width="120" height="120" viewBox="0 0 120 120" style="transform:rotate(-90deg);display:block;margin:0 auto">
    <circle cx="60" cy="60" r="46" fill="none" stroke="var(--line)" stroke-width="9"/>
    <circle cx="60" cy="60" r="46" fill="none" stroke="${esc(cy.phase.c)}" stroke-width="9" stroke-linecap="round"
      stroke-dasharray="${seg} ${C}"/>
    <text x="60" y="60" transform="rotate(90 60 60)" text-anchor="middle" dy="6"
      style="font:700 22px Inter;fill:var(--ink)">${cy.day}</text>
  </svg>`;
}

function pgCalendar(){
  const m = moon(), z = zodiac(S.birth.date), cy = cycleNow(), tip = zodTip(z);
  const first = new Date(); first.setDate(1);
  const shift = (first.getDay()+6)%7, days = new Date(first.getFullYear(), first.getMonth()+1, 0).getDate();
  const today = new Date().getDate();
  const month = first.toLocaleDateString('ru-RU',{month:'long', year:'numeric'});

  const cellPhase = n => {
    if(!cy) return null;
    const d = new Date(); d.setDate(n);
    const start = new Date(S.cycle.last); start.setHours(0,0,0,0); d.setHours(0,0,0,0);
    let k = Math.floor((d - start)/86400000) % S.cycle.len;
    if(k < 0) k += S.cycle.len;
    return k < S.cycle.period ? PHASES[0] : k <= Math.round(S.cycle.len/2)+1 && k >= Math.round(S.cycle.len/2)-1 ? PHASES[2] : null;
  };

  return `<div class="view pad">${backBtn('Назад')}
    <h1 class="serif" style="font-size:29px;margin:10px 0 4px">Календарь</h1>
    <p class="small muted" style="margin:0 0 16px">${month}</p>

    <div class="card advice">
      <div class="spread" style="margin-bottom:10px"><b style="font-size:15px">Сегодня</b>${hint('moon')}</div>
      <div class="moonbig" style="margin-bottom:12px">${moonDisc(m,64)}
        <div style="flex:1"><b style="font-size:15px">${esc(m.n)}</b>
          <div class="small muted">${m.s}</div>
          <div class="small muted" style="margin-top:3px">Освещённость ${m.pct}% · ${plural(m.age,'день','дня','дней')} лунного цикла</div></div></div>
      ${z ? `<div class="card" style="background:var(--surface-2);border:none;padding:12px;margin:0 0 10px">
        <div class="eyebrow" style="margin-bottom:5px">Твой день</div>
        <div class="small">${personalDay(m,z)}</div></div>` : ''}
      ${z ? `<div class="arow"><span class="ae">${esc(z.e)}</span><div><b>${esc(z.n)}</b><div class="small muted">${tip}</div></div></div>`
          : `<div class="arow"><span class="ae">✦</span><div><b>Знак не задан</b>
             <div class="small muted">Добавь дату рождения - появятся ежедневные подсказки по стихии.</div></div></div>`}
      ${cy ? `<div class="arow"><span class="ae">${esc(cy.phase.e)}</span><div><b>${esc(cy.phase.n)} фаза, день ${cy.day} из ${cy.len}</b>
        <div class="small muted">${cy.phase.s}</div>
        <div class="small muted" style="margin-top:4px">Следующие месячные примерно через ${plural(cy.next,'день','дня','дней')}</div></div></div>` : ''}
    </div>

    <div class="card">
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;text-align:center">
        ${DAYS.map(d => `<div class="small muted" style="font-size:10px;font-weight:800">${d}</div>`).join('')}
        ${[...Array(shift)].map(() => '<div></div>').join('')}
        ${[...Array(days)].map((_,i) => {
          const n = i+1, past = n < today, isToday = n === today;
          const done = past ? (hash('d'+n) % 10) > 3 : isToday ? doneOf(todayIdx()) === 3 : false;
          const ph = cellPhase(n);
          return `<div class="cday ${isToday?'now':''}" style="${done?'background:var(--blush);color:var(--rose-deep)':past?'color:var(--muted);opacity:.55':''}">
            ${n}${ph?`<i style="background:${esc(ph.c)}"></i>`:''}</div>`;
        }).join('')}
      </div>
      <div class="row" style="margin-top:14px;font-size:11px;color:var(--muted);gap:12px;flex-wrap:wrap">
        <span><i class="lg" style="background:var(--blush)"></i> закрытый день</span>
        <span><i class="lg" style="border:1.5px solid var(--rose)"></i> сегодня</span>
        ${cy?`<span><i class="lg" style="background:${PHASES[0].c}"></i> месячные</span>
        <span><i class="lg" style="background:${PHASES[2].c}"></i> овуляция</span>`:''}
      </div>
    </div>

    <div class="card">
      <div class="spread"><b style="font-size:15px">Трекер цикла</b>${hint('cycle')}</div>
      ${cy ? `
        <div class="bar" style="margin:12px 0 8px"><i style="width:${cy.day/cy.len*100}%"></i></div>
        <div class="small muted">День ${cy.day} из ${cy.len} · ${esc(cy.phase.n)} фаза</div>
        <div class="g2" style="margin-top:12px">
          ${PHASES.map(p => `<div class="phbox ${p.k===cy.phase.k?'on':''}">
            <div style="font-size:16px">${esc(p.e)}</div><b style="font-size:12px">${esc(p.n)}</b></div>`).join('')}
        </div>
        <button class="btn ghost" style="margin-top:12px" onclick="openSheet('cycle')">Изменить данные</button>`
      : `<p class="small muted" style="margin:8px 0 12px">Укажи дату последних месячных - программа будет учитывать фазу и не станет требовать одинаковой энергии всю неделю.</p>
         <button class="btn" onclick="openSheet('cycle')">Настроить трекер</button>`}
    </div>

    <div class="card">
      <div class="spread"><b style="font-size:15px">Human Design</b>${hint('hd')}</div>
      ${S.hd ? `
        <div class="arow" style="margin-top:10px"><span class="ae">✦</span>
          <div><b>${HD[S.hd].n}</b><div class="small muted">${HD[S.hd].s}</div></div></div>
        <div class="g2" style="margin-top:10px">
          <div class="phbox"><div class="small muted">Сила</div><b style="font-size:12px">${HD[S.hd].str}</b></div>
          <div class="phbox"><div class="small muted">Ловушка</div><b style="font-size:12px">${HD[S.hd].warn}</b></div>
        </div>
        <button class="btn ghost" style="margin-top:12px" onclick="startHD()">Пройти заново</button>`
      : `<p class="small muted" style="margin:8px 0 12px">Четыре вопроса о том, как ты начинаешь дела и принимаешь решения. Даст ориентир, в каком режиме тебе легче.</p>
         <button class="btn" onclick="startHD()">Пройти тест</button>`}
    </div>

    <button class="card" style="width:100%;text-align:left" onclick="openPage('birth')">
      <div class="row"><div style="flex:1">
        <b style="font-size:15px">Дата рождения и портрет</b>
        <div class="small muted" style="margin-top:3px">${z ? z.e + ' ' + z.n + ', стихия ' + z.el : 'Не заполнено - добавь, чтобы появились персональные подсказки'}</div>
      </div><span class="muted">›</span></div>
    </button>

    <div class="card">
      <b style="font-size:15px">Пропуски - часть пути</b>
      <p class="small muted" style="margin:8px 0 0">Стрик не обнуляется от одного пропущенного дня. Только после двух подряд, и то без драм: программа просто перестраивается.</p>
    </div>
  </div>`;
}

/* ---------- как работают баллы ---------- */
function pgPoints(){
  const {cur, next} = levelNow();
  const pct = next ? Math.min(100, Math.round((S.points - cur.from)/(next.from - cur.from)*100)) : 100;
  const earn = [['Аффирмация дня',10],['Утренняя практика',25],['Мастер-класс',40],['День закрыт целиком',50],
    ['Урок курса',20],['Домашнее задание',30],['Сообщение в группе',5],['Мероприятие',10],
    ['Покупка на 100 ₽',1],['Подруга дошла до программы',100]];
  const spend = [['Новые уровни','каждый статус открывает контент и повышает награду с приглашённых'],
    ['Ранний доступ','с 1000 баллов новые мастер-классы приходят на неделю раньше'],
    ['Своя группа','с уровня «Эксперт» можно вести собственное сообщество'],
    ['Свои курсы','наставницы публикуют курсы в общем каталоге']];
  return `<div class="view pad">${backBtn('Назад')}
    <h1 class="serif" style="font-size:26px;margin:10px 0 4px">Баллы и бонусы</h1>
    <p class="small muted" style="margin:0 0 14px">Баллы - это прогресс и статус, бонусы - внутренние деньги. Это разные вещи.</p>

    <div class="card" style="background:var(--grad-dark);color:#fff;border-color:transparent">
      <div class="g2">
        <div><div class="serif" style="font-size:30px">${S.points}</div>
          <div class="small" style="opacity:.75">баллов - статус</div></div>
        <div><div class="serif" style="font-size:30px">${S.bonus}</div>
          <div class="small" style="opacity:.75">бонусов ₽ - деньги</div></div>
      </div>
      <div class="bar" style="background:rgba(255,255,255,.2);margin:16px 0 8px"><i style="width:${pct}%"></i></div>
      <div class="spread small" style="opacity:.8">
        <span>${esc(cur.n)}</span><span>${next ? next.n : 'максимум'}</span></div>
      ${next ? `<div class="small" style="margin-top:8px;opacity:.75">Ещё ${next.from - S.points} баллов - и откроется «${esc(next.n)}»</div>` : ''}
    </div>

    <div class="card">
      <b style="font-size:15px">Как устроены уровни</b>
      <p class="small muted" style="margin:7px 0 0">Каждое выполненное задание даёт баллы. Баллы копятся и не сгорают.
        При переходе на новый уровень открывается дополнительный контент, растёт процент с покупок приглашённых
        и появляются новые возможности внутри платформы.</p>
      ${LEVELS.map(l => {
        const has = S.points >= l.from, now = cur.id === l.id;
        return `<div class="lvlrow ${now?'now':''}">
          <div class="lvlmark ${has?'has':''}">${has?'✓':l.e}</div>
          <div style="flex:1">
            <div class="spread"><b style="font-size:13.5px">${esc(l.n)}</b>
              <span class="small muted">${l.from ? 'от '+l.from+' баллов' : 'с первого дня'}</span></div>
            <div class="small muted" style="margin-top:3px">${l.perks.join(' · ')}</div>
          </div></div>`;
      }).join('')}
    </div>

    <div class="card">
      <b style="font-size:15px">За что начисляются</b>
      ${earn.map(([t,n]) => `<div class="uline"><span class="small" style="flex:1">${t}</span>
        <b style="color:var(--accent);font-size:13px">+${n}</b></div>`).join('')}
    </div>

    <div class="card">
      <b style="font-size:15px">На что тратятся</b>
      ${spend.map(([t,d]) => `<div class="uline" style="align-items:flex-start">
        <div style="flex:1"><b style="font-size:13px">${t}</b>
          <div class="small muted" style="margin-top:2px">${d}</div></div></div>`).join('')}
      <p class="small muted" style="margin:12px 0 0">Баллы не тратятся и не обмениваются - они только копятся
        и открывают новое. Бонусы приходят отдельно: кэшбэк с покупок и награда за приглашённых подруг.</p>
    </div>

    <div class="card">
      <b style="font-size:15px">Что открывается дальше</b>
      <p class="small muted" style="margin:7px 0 0">${next
        ? `На уровне «${esc(next.n)}»: ${next.perks[0].toLowerCase()}. Сейчас до него ${next.from - S.points} баллов -
           это примерно ${Math.ceil((next.from - S.points)/125)} полных дней программы.`
        : 'Ты на высшем уровне. Дальше - только твои собственные группы и курсы.'}</p>
      <button class="btn ghost" style="margin-top:10px" onclick="openPage('earn')">Зарабатывать с Евой</button>
    </div>
  </div>`;
}

function pgBirth(){
  const z = zodiac(S.birth.date), m = moon(), cy = cycleNow();
  const born = S.birth.date ? new Date(S.birth.date) : null;
  const wd = born ? ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'][born.getDay()] : null;
  const WDAY = {
    'понедельник':{p:'Луна', s:'Тебе особенно важны дом, покой и предсказуемость. Резкие перемены даются тяжелее, чем другим - и это не слабость, а устройство.', d:'Начинай неделю с малого: одно дело, один разговор.'},
    'вторник':{p:'Марс', s:'В тебе много воли и запала. Ты умеешь начинать там, где другие ещё сомневаются.', d:'Следи, чтобы энергия шла в своё, а не в чужие задачи.'},
    'среда':{p:'Меркурий', s:'Ты быстро думаешь, много говоришь и легко учишься. Тело при этом часто остаётся забытым.', d:'Каждый день возвращай себя в тело хотя бы на пять минут.'},
    'четверг':{p:'Юпитер', s:'Тебе нужен смысл в том, что делаешь. Без него гаснешь, даже когда всё получается.', d:'Раз в неделю спрашивай себя: зачем я это делаю.'},
    'пятница':{p:'Венера', s:'Красота, отношения и удовольствие для тебя не роскошь, а способ восстанавливаться.', d:'Планируй приятное так же серьёзно, как дела.'},
    'суббота':{p:'Сатурн', s:'Ты выносливее, чем сама думаешь. Обратная сторона - слишком высокие требования к себе.', d:'Учись останавливаться до того, как закончатся силы.'},
    'воскресенье':{p:'Солнце', s:'Тебе важно быть замеченной и делать своё. В тени чужих задач ты тускнеешь.', d:'Оставляй в неделе время только для себя.'}
  }[wd] || null;
  const ELTXT = {
    огонь:{s:'Ты быстро загораешься и так же быстро выгораешь. Твоя сила - в скорости, твой риск - в том, что после рывка приходит пустота.',
      good:['короткие интенсивные практики','движение и дыхание','ясные цели на неделю'], bad:['длинные медленные курсы','режим без пауз']},
    земля:{s:'Тебе нужны регулярность и опора в теле. Ты не про рывки, ты про то, что делается каждый день и потому работает.',
      good:['повторяющиеся ритуалы','телесные практики','понятный план'], bad:['резкая смена режима','обещания быстрого результата']},
    воздух:{s:'Ты живёшь в голове, и это забирает много сил. Всё, что возвращает в тело и дыхание, для тебя лечебно.',
      good:['дыхательные практики','письменные практики','разговор и обмен'], bad:['перегруз информацией','анализ вместо действия']},
    вода:{s:'Ты чувствуешь больше остальных, включая чужое. Это дар и нагрузка одновременно.',
      good:['практики на границы','вода, тепло, тишина','работа с эмоциями'], bad:['токсичное окружение','режим без уединения']}
  };
  const el = z ? ELTXT[z.el] : null;
  const years = [...Array(60)].map((_,i) => 2010 - i);
  const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  const bp = S.birth.parts || (S.birth.date ? {y:S.birth.date.split('-')[0], m:S.birth.date.split('-')[1], d:S.birth.date.split('-')[2]} : {y:'',m:'',d:''});
  const bd = [bp.y, bp.m, bp.d];

  return `<div class="view pad">${backBtn('Назад')}
    <h1 class="serif" style="font-size:26px;margin:10px 0 4px">Персональный портрет</h1>
    <p class="small muted" style="margin:0 0 14px">Дата рождения, цикл и фаза луны - вместе они дают Еве понимание твоего ритма.
      Это мягкий ориентир, а не приговор и не медицина.</p>

    <div class="card">
      <b style="font-size:15px">Когда ты родилась</b>
      <div class="g3" style="margin-top:10px">
        <div><label class="lbl">День</label>
          <select class="field" onchange="setBirthPart('d',this.value)">
            <option value="">—</option>
            ${[...Array(31)].map((_,i) => `<option value="${i+1}" ${+bd[2]===i+1?'selected':''}>${i+1}</option>`).join('')}
          </select></div>
        <div><label class="lbl">Месяц</label>
          <select class="field" onchange="setBirthPart('m',this.value)">
            <option value="">—</option>
            ${MONTHS.map((mn,i) => `<option value="${i+1}" ${+bd[1]===i+1?'selected':''}>${mn}</option>`).join('')}
          </select></div>
        <div><label class="lbl">Год</label>
          <select class="field" onchange="setBirthPart('y',this.value)">
            <option value="">—</option>
            ${years.map(y => `<option value="${y}" ${+bd[0]===y?'selected':''}>${y}</option>`).join('')}
          </select></div>
      </div>
      <label class="lbl">Время рождения, если знаешь</label>
      <input class="field" type="time" value="${S.birth.time}" onchange="setBirth('time',this.value)">
      ${z ? `<div class="chips wrap"><span class="chip pale">${esc(z.e)} ${esc(z.n)}</span>
        <span class="chip pale">стихия ${z.el}</span>${wd ? `<span class="chip pale">${wd}</span>` : ''}</div>`
      : `<div class="small muted">Выбери дату - появится знак, стихия и день недели рождения</div>`}
    </div>

    ${z ? `<div class="portrait">
      <div class="pbig">${esc(z.e)}</div>
      <div>
        <b style="font-size:17px;display:block">${esc(z.n)}</b>
        <div class="small muted">стихия ${z.el}${S.birth.time ? ' · рождена в ' + S.birth.time : ''}</div>
      </div>
    </div>
    <div class="card">
      <p style="font-size:14px;line-height:1.55;margin:0">${el.s}</p>
      <div class="g2" style="margin-top:12px">
        <div class="phbox" style="text-align:left">
          <div class="eyebrow" style="color:var(--ok)">Тебе подходит</div>
          ${el.good.map(g => `<div class="small" style="margin-top:5px">— ${g}</div>`).join('')}
        </div>
        <div class="phbox" style="text-align:left">
          <div class="eyebrow" style="color:var(--accent)">Тебе тяжело</div>
          ${el.bad.map(g => `<div class="small" style="margin-top:5px">— ${g}</div>`).join('')}
        </div>
      </div>
      <div class="hwbox" style="margin-top:12px"><b style="font-size:13px">Подсказка на сегодня</b>
        <div class="small muted" style="margin-top:4px">${zodTip(z)}</div></div>
    </div>` : ''}

    ${WDAY ? `<div class="card">
      <div class="spread"><b style="font-size:15px">Рождена в ${wd}</b>
        <span class="chip pale">${WDAY.p}</span></div>
      <p class="small muted" style="margin:8px 0 0">${WDAY.s}</p>
      <div class="hwbox" style="margin-top:10px"><div class="small">${esc(WDAY.d)}</div></div>
    </div>` : ''}

    <div class="card">
      <div class="moonbig">${moonDisc(m,58)}
        <div style="flex:1"><b style="font-size:15px">${esc(m.n)}</b>
          <div class="small muted" style="margin-top:3px">${m.s}</div></div></div>
      ${z ? `<div class="hwbox" style="margin-top:10px"><div class="small">${personalDay(m,z)}</div></div>` : ''}
    </div>

    <div class="card">
      <div class="spread"><b style="font-size:15px">Женский цикл</b>${hint('cycle')}</div>
      ${cy ? `<div class="row" style="margin-top:10px;gap:14px">
          ${cycleRing(cy)}
          <div style="flex:1"><b style="font-size:14px">${esc(cy.phase.n)} фаза</b>
            <div class="small muted" style="margin-top:3px">${cy.phase.s}</div>
            <div class="small muted" style="margin-top:4px">Следующие месячные через ${plural(cy.next,'день','дня','дней')}</div></div>
        </div>
        <button class="btn ghost" style="margin-top:10px" onclick="openPage('cycle')">Открыть календарь цикла</button>`
      : `<p class="small muted" style="margin:7px 0 10px">Укажи дату последних месячных - Ева перестанет требовать одинаковой энергии всю неделю.</p>
         <button class="btn" onclick="openSheet('cycle')">Настроить трекер</button>`}
    </div>

    <div class="card">
      <b style="font-size:15px">Что Ева делает с этим</b>
      <p class="small muted" style="margin:7px 0 0">${
        (z || cy)
        ? `Подсказка дня на главной собирается из фазы луны${z?', твоей стихии':''}${cy?' и дня цикла':''}. ` +
          (cy ? 'В менструальной и лютеиновой фазе программа ставит более короткие практики, в фолликулярной и овуляторной - более активные. ' : '') +
          (z ? `Как ${z.el === 'огонь' ? 'огненному знаку тебе чаще предлагаются короткие интенсивные практики' : z.el === 'земля' ? 'знаку земли тебе чаще предлагаются телесные и регулярные практики' : z.el === 'воздух' ? 'воздушному знаку тебе чаще предлагаются дыхательные и письменные практики' : 'водному знаку тебе чаще предлагаются практики на границы и восстановление'}.` : '')
        : 'Заполни хотя бы дату рождения - и на главной появятся персональные подсказки на каждый день.'}</p>
    </div>
  </div>`;
}
function setBirthPart(k, v){
  if(!S.birth.parts){
    const c = S.birth.date ? S.birth.date.split('-') : ['','',''];
    S.birth.parts = {y:c[0], m:c[1], d:c[2]};
  }
  const p = S.birth.parts;
  if(k === 'y') p.y = v;
  if(k === 'm') p.m = v ? String(v).padStart(2,'0') : '';
  if(k === 'd') p.d = v ? String(v).padStart(2,'0') : '';
  if(p.y && p.m && p.d){
    S.birth.date = `${p.y}-${p.m}-${esc(p.d)}`;
    render(); schedulePersist();
  } else {
    S.birth.date = '';
  }
}
function setBirth(f, v){ S.birth[f] = v; render(); schedulePersist(); }

function pgSettings(){
  const n = S.notif = S.notif || {daily:true, week:true, events:false, marketing:false, time:'09:00'};
  return `<div class="view pad">${backBtn('Профиль')}
    <h1 class="serif" style="font-size:26px;margin:10px 0 14px">Настройки</h1>

    <div class="card" style="text-align:center">
      <div style="width:88px;height:88px;margin:0 auto 12px;position:relative">
        ${avatarEl(88)}
        <button class="camera" onclick="pickAvatar()">▣</button>
      </div>
      <input class="field" style="text-align:center" value="${esc(S.name)}" oninput="S.name=this.value||'Ева'">
      <div class="small muted">JPEG, PNG или HEIC. Сожмём без потери резкости</div>
    </div>

    <div class="sec-h"><h2 class="serif" style="font-size:18px">Аккаунт</h2></div>
    <div class="card">
      <div class="uline" style="border:none;padding-top:0"><span class="small muted" style="width:92px">Почта</span>
        <b style="font-size:12.5px;flex:1;word-break:break-all">${S.user ? esc(S.user.email) : 'не указана'}</b>
        <button class="btn xs ghost" onclick="openSheet('changeMail')">Изменить</button></div>
      <div class="uline"><span class="small muted" style="width:92px">Пароль</span>
        <b style="font-size:12.5px;flex:1">••••••••</b>
        <button class="btn xs ghost" onclick="openSheet('changePass')">Сменить</button></div>
      <div class="uline"><span class="small muted" style="width:92px">Телеграм</span>
        <input class="field" style="margin:0;flex:1;padding:7px 10px;font-size:12.5px"
          placeholder="@nickname" value="${esc(S.tg||'')}" oninput="S.tg=this.value"></div>
      <div class="uline"><span class="small muted" style="width:92px">Телефон</span>
        <input class="field" style="margin:0;flex:1;padding:7px 10px;font-size:12.5px"
          placeholder="+7" value="${esc(S.phone||'')}" oninput="S.phone=this.value"></div>
    </div>

    <div class="sec-h"><h2 class="serif" style="font-size:18px">Уведомления</h2></div>
    <div class="card">
      ${[['daily','Напоминание о практике','Раз в день в удобное время'],
         ['week','Итоги недели','Каждое воскресенье вечером'],
         ['events','Мероприятия','Новые женские круги и встречи'],
         ['marketing','Новости и акции','Скидки на курсы и маркет']].map(([k,t,d]) =>
        `<div class="uline" ${k==='daily'?'style="border:none;padding-top:0"':''}>
          <div style="flex:1"><b style="font-size:13.5px">${t}</b>
            <div class="small muted" style="margin-top:2px">${d}</div></div>
          <button class="sw ${n[k]?'on':''}" onclick="tgNotif('${attJs(k)}')"><i></i></button></div>`).join('')}
      <div class="uline"><span class="small muted" style="flex:1">Время напоминания</span>
        <input class="field" type="time" style="margin:0;width:120px;padding:7px 10px" value="${n.time}"
          onchange="S.notif.time=this.value"></div>
    </div>

    <div class="sec-h"><h2 class="serif" style="font-size:18px">Оплаты</h2></div>
    <div class="card">
      <div class="spread"><div style="flex:1"><b style="font-size:14px">Подписка</b>
        <div class="small muted" style="margin-top:2px">${subLabel()}</div></div>
        <button class="btn sm ghost" onclick="openPage('sub')">Управлять</button></div>
      <div class="uline"><span class="small muted" style="flex:1">Способ оплаты</span>
        <b style="font-size:12.5px">${S.card || 'не привязан'}</b>
        <button class="btn xs ghost" onclick="addCard()">${S.card?'Заменить':'Привязать'}</button></div>
      <div class="uline"><span class="small muted" style="flex:1">Бонусный счёт</span>
        <b style="font-size:12.5px">${S.bonus} ₽</b></div>
      <div class="uline"><span class="small muted" style="flex:1">История покупок</span>
        <b style="font-size:12.5px">${S.purchases.length}</b>
        <button class="btn xs ghost" onclick="openPage('profile')">Открыть</button></div>
    </div>

    <div class="sec-h"><h2 class="serif" style="font-size:18px">Приложение</h2></div>
    ${[['voice','Голос Евы','Озвучка аффирмаций и ответов'],
       ['gentle','Мягкий режим','Одно задание вместо трёх в тяжёлые дни'],
       ['astroOn','Луна и гороскоп','Подсказки дня на главной']].map(([k,t,d]) =>
      `<div class="card"><div class="spread">
        <div style="flex:1"><b style="font-size:14px">${t}</b><div class="small muted" style="margin-top:2px">${d}</div></div>
        <button class="sw ${S[k]?'on':''}" onclick="toggle('${attJs(k)}')"><i></i></button>
      </div></div>`).join('')}

    <div class="sec-h"><h2 class="serif" style="font-size:18px">Помощь</h2></div>
    <div class="card">
      <button class="uline" style="border:none;padding-top:0;width:100%;text-align:left" onclick="openSheet('support')">
        <span style="flex:1;font-size:13.5px;font-weight:600">Написать в поддержку</span><span class="muted">›</span></button>
      <button class="uline" style="width:100%;text-align:left" onclick="openIdea()">
        <span style="flex:1;font-size:13.5px;font-weight:600">Предложить доработку</span><span class="muted">›</span></button>
      <button class="uline" style="width:100%;text-align:left" onclick="tourAgain()">
        <span style="flex:1;font-size:13.5px;font-weight:600">Показать подсказки заново</span><span class="muted">›</span></button>
      <button class="uline" style="width:100%;text-align:left" onclick="showWeekSum()">
        <span style="flex:1;font-size:13.5px;font-weight:600">Итоги недели</span><span class="muted">›</span></button>
      ${typeof pushRow === 'function' ? pushRow() : ''}
      <div class="uline"><span class="small muted" style="flex:1">Почта поддержки</span>
        <b style="font-size:12.5px">help@evaspace.ru</b></div>
    </div>

    <button class="btn ghost" onclick="openSheet('rebuild')">Пересобрать программу вручную</button>
    <button class="btn ghost" style="margin-top:9px" onclick="restartQuiz()">Пройти тест заново</button>
    <button class="btn ghost" style="margin-top:9px" onclick="logout()">Выйти из аккаунта</button>
    <p class="small muted" style="text-align:center;margin-top:16px;font-size:11px">
      Eva Space · прототип${Store.available?' · данные сохраняются в этом браузере':''}</p>
  </div>`;
}
function tgNotif(k){ S.notif[k] = !S.notif[k]; render(); toast(S.notif[k] ? 'Уведомление включено' : 'Выключено'); }
function addCard(){ S.card = '•••• 4242'; render(); toast('Карта привязана'); }

/* ---------- утилиты профиля ---------- */
function pickAvatar(){
  const mail = S.user && S.user.email;
  if(!mail) return toast('Сначала войди в аккаунт');
  const key = mailKey(mail);
  pickImage(key, data => {
    S.avatar = data;
    AVATARS[mail.toLowerCase()] = data;
    render(); schedulePersist();
    /* когда файл уедет на сервер, подменим на ссылку и раздадим всем */
    setTimeout(() => {
      const url = MEDIA[key];
      if(url && !String(url).startsWith('data:')){
        AVATARS[mail.toLowerCase()] = url;
        S.avatar = url;
        syncPush(['avatars', 'media']);
        render(); schedulePersist();
      }
    }, 2600);
  });
}
function toggle(k){ S[k] = !S[k]; if(k === 'gentle') return gentle(S[k]); render(); schedulePersist(); }

/* =====================================================================
   МАРКЕТ: расширенные товары, заказы, вопросы
   ===================================================================== */
Object.assign(S, {orders:[], qs:[], mkTab:'goods', gDraft:null, gallery:{}, viewGood:null});

/* дополнительные поля товаров */
const GOOD_INFO = {};
GOODS.forEach(g => {
  GOOD_INFO[g.id] = {
    about:'Сделано для практик Eva Space. Материалы подобраны так, чтобы вещь служила долго и была приятной на ощупь.',
    video:'', gallery:[],
    delivery:{free:g.p >= 3000, price:390, cities:'Москва и Санкт-Петербург - 1-2 дня, остальная Россия - 3-7 дней', pickup:true},
    offer:null, stock:(hash(g.id) % 40) + 5
  };
});

const ORDERS = [
  {id:'o1', who:'Настя Ковалёва', mail:'nastya.k@mail.ru', items:[{id:'g1', n:1}], sum:4900, bonus:900,
   st:'доставлен', d:'02.08', city:'Москва', phone:'+7 916 000-11-22'},
  {id:'o2', who:'Лена Соболева', mail:'sobol.lena@mail.ru', items:[{id:'g3', n:2},{id:'g7', n:1}], sum:3890, bonus:0,
   st:'в пути', d:'05.08', city:'Санкт-Петербург', phone:'+7 921 000-33-44'},
  {id:'o3', who:'Ирина Дёмина', mail:'irina.demina@gmail.com', items:[{id:'g8', n:1}], sum:1690, bonus:300,
   st:'новый', d:'сегодня', city:'Казань', phone:'+7 917 000-55-66'}
];

const GOOD_QS = [
  {id:'q1', gid:'g1', who:'Камила', mail:'kamila@yandex.ru', ago:'2 ч назад',
   t:'Коврик 6 мм не будет слишком мягким для баланса?', answer:''},
  {id:'q2', gid:'g4', who:'Юля', mail:'yulia.v@gmail.com', ago:'вчера',
   t:'Халат маломерит? Обычно ношу S, брать S или M?', answer:''},
  {id:'q3', gid:'g7', who:'Настя', mail:'nastya.k@mail.ru', ago:'3 дня назад',
   t:'Есть ли в составе мята? У меня на неё реакция.', answer:'Мяты нет: ромашка, мелисса, липа и малиновый лист.'}
];

const CATS = ['Для практики','Одежда','Дом и ритуалы','Уход','Книги'];

/* ---------- админ: маркет ---------- */
function adMarket(){
  const tabs = [['goods','Товары'],['orders','Заказы'],['qs','Вопросы']];
  const newQs = GOOD_QS.filter(q => !q.answer).length;
  const newOrders = ORDERS.filter(o => o.st === 'новый').length;
  return `
  <div class="seg">${tabs.map(([k,l]) => {
    const n = k === 'qs' ? newQs : k === 'orders' ? newOrders : 0;
    return `<button class="${(S.mkTab||'goods')===k?'on':''}" onclick="S.mkTab='${attJs(k)}';render()">
      ${l}${n?` <span class="cnt" style="background:var(--accent);color:#fff;border-radius:99px;padding:1px 5px;font-size:9px">${n}</span>`:''}</button>`;
  }).join('')}</div>
  ${({goods:adGoodsList, orders:adOrders, qs:adQuestions})[S.mkTab||'goods']()}`;
}

function adGoodsList(){
  const cat = S.mkCat || 'все';
  const list = cat === 'все' ? GOODS : GOODS.filter(g => g.c === cat);
  return `
  <button class="btn" onclick="openGoodEditor()">＋ Добавить товар</button>
  <div class="chips" style="margin-top:12px">
    ${['все', ...CATS].map(c => `<button class="chip ${cat===c?'on':''}" onclick="S.mkCat='${attJs(c)}';render()">${c}</button>`).join('')}
  </div>
  <div class="small muted" style="margin-bottom:10px">${plural(list.length,'товар','товара','товаров')}
    · продано за месяц ${ORDERS.length * 3}</div>
  ${list.map(g => {
    const info = GOOD_INFO[g.id] || {};
    return `<div class="acard">
      <div class="top">
        <button class="thumb" onclick="openGoodEditor('${attJs(g.id)}')">${goodPic(g)}</button>
        <div style="flex:1;min-width:0">
          <div class="spread" style="align-items:flex-start">
            <b style="font-size:13.5px;line-height:1.3">${esc(g.t)}</b>
            <span class="pill ${info.stock > 5 ? 'free':'paid'}">${info.stock} шт</span>
          </div>
          <div class="small muted" style="margin-top:3px">${esc(g.c)} · ${money(g.p)}${g.old?' вместо '+money(g.old):''}</div>
          <div class="small muted">${(info.gallery||[]).length} фото · ${info.video?'видео есть':'без видео'}
            · ${info.delivery && info.delivery.free ? 'доставка бесплатно' : 'доставка платная'}</div>
        </div>
      </div>
      <div class="bar2">
        <button class="chip" onclick="openGoodEditor('${attJs(g.id)}')">Редактировать</button>
        <button class="chip" onclick="openGood('${attJs(g.id)}')">Как видит покупатель</button>
        <button class="chip" style="margin-left:auto" onclick="delGood('${attJs(g.id)}')">✕</button>
      </div>
    </div>`;
  }).join('')}`;
}



function delGood(id){
  const i = GOODS.findIndex(g => g.id === id);
  GOODS.splice(i,1); pushShared(); render(); toast('Товар удалён');
}

/* ---------- редактор товара ---------- */
function openGoodEditor(id){
  const g = id ? GOODS.find(x => x.id === id) : null;
  const info = g ? GOOD_INFO[g.id] : null;
  S.gDraft = g ? {...g, ...info, _id:g.id, key:g.id, delivery:{...info.delivery}, gallery:[...(info.gallery||[])]}
    : {_id:'new', key:'gnew_' + Date.now().toString(36), t:'', p:2900, old:0, c:'Для практики', sh:'box',
       about:'', video:'', gallery:[], stock:20, offer:null,
       delivery:{free:false, price:390, cities:'Москва - 1-2 дня', pickup:true}};
  S.page = 'goodEditor'; S.sheet = null; render(); window.scrollTo(0,0);
}

function pgGoodEditor(){
  const d = S.gDraft;
  if(!d) return `<div class="empty">Товар не выбран</div>`;
  const key = d.key || (d._id === 'new' ? 'gnew' : d._id);
  return `<div class="view pad">
    <button class="backbtn" onclick="S.page=null;S.gDraft=null;render()">‹ Маркет</button>
    <h1 class="serif" style="font-size:24px;margin:10px 0 12px">${d._id === 'new' ? 'Новый товар' : 'Товар'}</h1>

    <label class="lbl">Фотографии товара</label>
    <div class="photos">
      ${(() => {
        const shots = [key, ...d.gallery].filter(k => MEDIA[k]);
        if(!shots.length) return `<button class="addphoto big" onclick="pickImage('${attJs(key)}')">
          <span class="pl2">＋</span>
          <b>Загрузить фото товара</b>
          <span class="small muted">JPEG, PNG или HEIC. Первое станет обложкой</span></button>`;
        return shots.map((k,i) => `<div class="photo ${k===key?'cover':''}">
            <img src="${safeUrl(MEDIA[k])}" alt="" style="object-position:${esc(k===key?(d.pos||'50% 50%'):'50% 50%')}">
            ${k===key ? '<span class="covlabel">обложка</span>' : `
              <button class="mkcov" onclick="setCoverFrom('${attJs(k)}')">Сделать обложкой</button>`}
            <button class="phdel" onclick="${k===key?`dropCover('${attJs(key)}')`:`delGalleryPhoto(${d.gallery.indexOf(k)})`}">✕</button>
          </div>`).join('') +
          `<button class="addphoto" onclick="addGalleryPhoto('${attJs(key)}')"><span class="pl2">＋</span><span class="small">ещё фото</span></button>`;
      })()}
    </div>
    <div class="small muted" style="margin:-2px 0 12px">Обложка показывается в каталоге, остальные листаются на странице товара</div>

    <label class="lbl">Название</label>
    <input class="field" value="${esc(d.t)}" oninput="S.gDraft.t=this.value">

    <label class="lbl">Категория</label>
    <div class="chips">${CATS.map(c => `<button class="chip ${d.c===c?'on':''}"
      onclick="chipPick(this,'gDraft.c','${attJs(c)}')">${c}</button>`).join('')}</div>

    ${MEDIA[key] ? cropBox(key, d.pos || '50% 50%', 'gDraft.pos') : ''}

    <label class="lbl">Описание</label>
    <textarea class="field" rows="4" oninput="S.gDraft.about=this.value">${esc(d.about)}</textarea>

    <label class="lbl">Видео о товаре - покажется на странице</label>
    <input class="field" value="${esc(d.video||'')}" placeholder="https://youtu.be/..." oninput="S.gDraft.video=this.value">

    <div class="g2">
      <div><label class="lbl">Цена, ₽</label>
        <input class="field" type="number" value="${d.p}" oninput="S.gDraft.p=+this.value||0"></div>
      <div><label class="lbl">Старая цена</label>
        <input class="field" type="number" value="${d.old||''}" oninput="S.gDraft.old=+this.value||0"></div>
    </div>
    <div class="g2">
      <div><label class="lbl">Остаток, шт</label>
        <input class="field" type="number" value="${d.stock}" oninput="S.gDraft.stock=+this.value||0"></div>
      <div><label class="lbl">Иконка</label>
        <select class="field" onchange="S.gDraft.sh=this.value">
          ${Object.keys(SHAPES).map(k => `<option value="${k}" ${d.sh===k?'selected':''}>${k}</option>`).join('')}
        </select></div>
    </div>

    <div class="card">
      <b style="font-size:14.5px">Спецпредложение</b>
      <div class="small muted" style="margin:4px 0 9px">Метка на карточке товара</div>
      <div class="chips wrap">${['','Хит','Новинка','Бестселлер','Выгодно','Последние'].map(f =>
        `<button class="chip ${(d.f||'')===f?'on':''}" onclick="chipPick(this,'gDraft.f','${attJs(f)}')">${f||'без метки'}</button>`).join('')}</div>
    </div>

    <div class="card">
      <b style="font-size:14.5px">Доставка</b>
      <div class="spread" style="margin-top:10px">
        <div style="flex:1"><b style="font-size:13.5px">Бесплатная доставка</b>
          <div class="small muted">Для этого товара</div></div>
        <button class="sw ${d.delivery.free?'on':''}" onclick="tgDeliveryFree(this)"><i></i></button>
      </div>
      <label class="lbl" style="margin-top:10px">Стоимость доставки, ₽</label>
      <input class="field" type="number" value="${d.delivery.price}" oninput="S.gDraft.delivery.price=+this.value||0">
      <label class="lbl">Города и сроки</label>
      <textarea class="field" rows="2" oninput="S.gDraft.delivery.cities=this.value">${esc(d.delivery.cities)}</textarea>
      <div class="spread">
        <div style="flex:1"><b style="font-size:13.5px">Самовывоз</b>
          <div class="small muted">Из студии в Москве</div></div>
        <button class="sw ${d.delivery.pickup?'on':''}" onclick="tgPickup(this)"><i></i></button>
      </div>
    </div>

    <button class="btn" onclick="saveGood()">${d._id === 'new' ? 'Добавить в каталог' : 'Сохранить'}</button>
  </div>`;
}
function tgDeliveryFree(btn){ S.gDraft.delivery.free = !S.gDraft.delivery.free; btn.classList.toggle('on', S.gDraft.delivery.free); }
function tgPickup(btn){ S.gDraft.delivery.pickup = !S.gDraft.delivery.pickup; btn.classList.toggle('on', S.gDraft.delivery.pickup); }

function setCoverFrom(gk){
  const d = S.gDraft, key = d.key;
  if(!MEDIA[gk]) return;
  const old = MEDIA[key];
  MEDIA[key] = MEDIA[gk];
  const i = d.gallery.indexOf(gk);
  if(i > -1){
    if(old){ MEDIA[gk] = old; }            // бывшая обложка уходит в галерею
    else d.gallery.splice(i, 1);
  }
  d.pos = '50% 50%';
  render(); toast('Фото стало обложкой');
}
function dropCover(key){
  const d = S.gDraft;
  if(d.gallery.length){                     // первое из галереи поднимаем в обложку
    const next = d.gallery.shift();
    MEDIA[key] = MEDIA[next];
    delete MEDIA[next];
  } else delete MEDIA[key];
  render(); toast('Обложка убрана');
}
/* ---------- кадрирование обложки ползунками ---------- */
function cropBox(key, pos, path){
  const [px, py] = String(pos).split(' ').map(v => parseInt(v) || 50);
  return `<label class="lbl">Кадрирование обложки</label>
    <div class="cropwrap">
      <div class="croppreview" id="croppv">
        <img src="${safeUrl(MEDIA[key])}" style="object-position:${px}% ${py}%">
        <span class="cropgrid"></span>
      </div>
      <div class="croprow">
        <span class="small muted">По горизонтали</span>
        <input type="range" min="0" max="100" value="${px}" class="crange"
          oninput="setCrop('${attJs(path)}','x',this.value)">
      </div>
      <div class="croprow">
        <span class="small muted">По вертикали</span>
        <input type="range" min="0" max="100" value="${py}" class="crange"
          oninput="setCrop('${attJs(path)}','y',this.value)">
      </div>
      <button class="btn ghost xs" style="margin-top:6px" onclick="resetCrop('${attJs(path)}')">Сбросить в центр</button>
    </div>
    <div class="small muted" style="margin:6px 0 12px">Двигай ползунки - так обложка будет обрезана в карточке и на странице</div>`;
}
function setCrop(path, axis, val){
  const cur = String(pathGet(S, path) || '50% 50%').split(' ').map(v => parseInt(v) || 50);
  if(axis === 'x') cur[0] = +val; else cur[1] = +val;
  const pos = cur[0] + '% ' + cur[1] + '%';
  pathSet(S, path, pos);
  const img = document.querySelector('#croppv img');
  if(img) img.style.objectPosition = pos;
}
function resetCrop(path){
  pathSet(S, path, '50% 50%');
  render();
}
function addGalleryPhoto(key){
  const gk = key + '_g' + Date.now().toString(36);
  pickImage(gk, () => { S.gDraft.gallery.push(gk); render(); });
}
function delGalleryPhoto(i){
  const gk = S.gDraft.gallery[i];
  delete MEDIA[gk];
  S.gDraft.gallery.splice(i,1); render();
}

function saveGood(){
  const d = S.gDraft;
  const key = d.key;
  if(!d.t.trim()) return toast('Назови товар');
  if(d._id === 'new'){
    const id = 'g'+Date.now().toString(36);
    if(MEDIA[d.key]){ MEDIA[id] = MEDIA[d.key]; delete MEDIA[d.key]; }
    GOODS.unshift({id, t:d.t.trim(), p:d.p, old:d.old || undefined, sh:d.sh, c:d.c, f:d.f || undefined});
    GOOD_INFO[id] = {about:d.about, video:d.video, gallery:d.gallery, delivery:d.delivery,
      stock:d.stock, offer:null, pos:d.pos || '50% 50%'};
    if(d.video) { S.videos = S.videos || {}; S.videos[id + '_vid'] = d.video; }
  } else {
    const g = GOODS.find(x => x.id === d._id);
    Object.assign(g, {t:d.t.trim(), p:d.p, old:d.old || undefined, sh:d.sh, c:d.c, f:d.f || undefined});
    GOOD_INFO[d._id] = {about:d.about, video:d.video, gallery:d.gallery, delivery:d.delivery,
      stock:d.stock, offer:null, pos:d.pos || '50% 50%'};
    if(d.video){ S.videos = S.videos || {}; S.videos[d._id + '_vid'] = d.video; }
  }
  S.gDraft = null; S.page = null; pushShared(); render();
  toast('Товар сохранён');
}

/* ---------- заказы ---------- */
function adOrders(){
  const all = [...ORDERS, ...S.orders];
  const view = S.ordView || 'card';
  const ST = {'новый':'st-trial','собирается':'st-think','в пути':'st-think','доставлен':'st-paid','отменён':'st-no'};
  const total = all.reduce((a,o) => a + o.sum, 0);
  return `
  <div class="g3" style="margin-bottom:12px">
    <div class="stat"><b style="font-size:18px">${all.length}</b><div class="small muted">заказов</div></div>
    <div class="stat"><b style="font-size:18px">${all.filter(o=>o.st==='новый').length}</b><div class="small muted">новых</div></div>
    <div class="stat"><b style="font-size:16px">${money(total)}</b><div class="small muted">оборот</div></div>
  </div>
  <div class="chips"><span class="small muted" style="align-self:center;margin-right:4px">Вид:</span>
    ${[['card','карточками'],['list','списком']].map(([k,l]) =>
      `<button class="chip ${view===k?'on':''}" onclick="S.ordView='${attJs(k)}';render()">${l}</button>`).join('')}</div>

  ${view === 'list' ? `<div class="tbl">
    <div class="trow head"><span style="flex:1">Заказ</span><span style="width:76px">Сумма</span><span style="width:70px">Статус</span></div>
    ${all.map(o => `<div class="trow">
      <div style="flex:1;min-width:0"><b style="font-size:12.5px">${esc(o.who)}</b>
        <div class="small muted" style="font-size:10.5px">${esc(o.d)} · ${esc(o.city)}</div></div>
      <b style="width:76px;font-size:12px">${money(o.sum)}</b>
      <span class="tag-st ${ST[o.st]}" style="width:70px;text-align:center;font-size:9px;padding:3px 4px">${esc(o.st)}</span>
    </div>`).join('')}
  </div>` : all.map(o => `<div class="card">
    <div class="spread">
      <div class="row"><div class="dot-ava" style="background:var(--ink)">${o.who[0]}</div>
        <div><b style="font-size:13.5px">${esc(o.who)}</b>
          <div class="small muted">${esc(o.d)} · ${esc(o.city)}</div></div></div>
      <span class="tag-st ${ST[o.st]}">${esc(o.st)}</span>
    </div>
    <div class="uline" style="margin-top:8px"><span class="small muted" style="width:80px">Состав</span>
      <div style="flex:1;font-size:12.5px">${o.items.map(it => {
        const g = GOODS.find(x => x.id === it.id);
        return (g ? g.t : 'товар') + (it.n > 1 ? ' ×'+it.n : '');
      }).join(', ')}</div></div>
    <div class="uline"><span class="small muted" style="width:80px">Сумма</span>
      <b style="font-size:13px">${money(o.sum)}</b>${o.bonus?`<span class="small muted"> · бонусами ${o.bonus}</span>`:''}</div>
    <div class="uline"><span class="small muted" style="width:80px">Контакты</span>
      <div style="flex:1;font-size:12.5px">${esc(o.mail)}${o.phone?' · '+o.phone:''}</div></div>
    <div class="chips" style="margin-top:8px">${['новый','собирается','в пути','доставлен','отменён'].map(st =>
      `<button class="chip ${o.st===st?'on':''}" onclick="setOrder('${attJs(o.id)}','${attJs(st)}')">${st}</button>`).join('')}</div>
    <button class="btn ghost sm" style="margin-top:8px" onclick="toast('Письмо отправлено на ${esc(o.mail)}')">Написать покупателю</button>
  </div>`).join('')}`;
}
function setOrder(id, st){
  const o = [...ORDERS, ...S.orders].find(x => x.id === id);
  o.st = st; render(); syncPush(['orders']); toast('Статус: ' + st);
}

/* ---------- вопросы по товарам ---------- */
function adQuestions(){
  const list = [...GOOD_QS, ...S.qs];
  return `
  <p class="small muted" style="margin:0 0 12px">Вопросы покупательниц о товарах. Ответ уходит в личные сообщения,
    на странице товара он не публикуется.</p>
  ${list.map(q => {
    const g = GOODS.find(x => x.id === q.gid);
    return `<div class="card ${q.answer?'':'unread'}">
      <div class="spread">
        <div class="row"><div class="dot-ava" style="background:var(--lilac)">${q.who[0]}</div>
          <div><b style="font-size:13.5px">${esc(q.who)}</b>
            <div class="small muted">${esc(q.ago)} · ${g ? g.t : 'товар удалён'}</div></div></div>
        <span class="tag-st ${q.answer?'st-paid':'st-trial'}">${q.answer?'отвечено':'новый'}</span>
      </div>
      <p class="small" style="margin:9px 0 8px">${esc(q.t)}</p>
      ${q.answer ? `<div class="hwbox"><div class="small"><b>Ответ отправлен:</b> ${esc(q.answer)}</div></div>`
      : `<div class="row" style="gap:8px">
          <input class="field" style="margin:0;flex:1" id="qa_${q.id}" placeholder="Ответить">
          <button class="btn sm" onclick="answerQ('${attJs(q.id)}')">→</button></div>`}
    </div>`;
  }).join('') || '<div class="empty">Вопросов пока нет</div>'}`;
}
function answerQ(id){
  const v = (($('#qa_'+id)||{}).value || '').trim();
  if(!v) return toast('Напиши ответ');
  const q = [...GOOD_QS, ...S.qs].find(x => x.id === id);
  if(!q) return;
  q.answer = v;
  q.answeredAt = Date.now();
  replyToBuyer(q, v);
  render(); syncPush(['questions','replies']);
  toast('Ответ отправлен покупательнице в личные сообщения');
}

/* ответ покупательнице в её переписку */
function replyToBuyer(q, text){
  if(typeof initInbox !== 'function') return;
  initInbox();
  const now = new Date();
  const tm = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
  S.marketReplies = S.marketReplies || [];
  S.marketReplies.push({qid:q.id, mail:q.mail, t:text, tm, at:Date.now()});
  /* В переписку сообщение попадёт одним путём — через pullMarketReplies.
     Раньше его клали ещё и напрямую, и покупательница видела ответ дважды. */
  if(typeof pullMarketReplies === 'function') pullMarketReplies();
}


/* =====================================================================
   СТРАНИЦА ТОВАРА
   ===================================================================== */
function openGood(id){ S.viewGood = id; S.gSlide = 0; S.sheet = null; render(); window.scrollTo(0,0); }
function closeGood(){ S.viewGood = null; render(); window.scrollTo(0,0); }

function pgGood(){
  const g = GOODS.find(x => x.id === S.viewGood);
  if(!g) return `<div class="empty">Товар не найден</div>`;
  const info = GOOD_INFO[g.id] || {gallery:[], delivery:{}, about:''};
  const shots = [g.id, ...(info.gallery||[])].filter(k => MEDIA[k]);
  const slides = shots.length ? shots : [g.id];
  const i = Math.min(S.gSlide || 0, slides.length-1);
  const bonus = Math.min(S.bonus, Math.round(g.p*0.3));
  const qs = [];   // вопросы теперь личные, на карточке не публикуются
  const inCart = (S.cart.find(c => c.id === g.id) || {}).n || 0;
  return `<div class="view pad">
    <button class="backbtn" onclick="closeGood()">‹ Маркет</button>

    <div class="gslider">
      <div class="gslide">${MEDIA[slides[i]] ? `<img src="${safeUrl(MEDIA[slides[i]])}" alt="" style="object-position:${esc(info.pos||'50% 50%')}">` : prodArt(g.id, g.sh)}
        ${g.f ? `<div class="flag">${g.f}</div>` : ''}</div>
      ${slides.length > 1 ? `
        <button class="gnav left" onclick="slideGood(-1,${slides.length})">‹</button>
        <button class="gnav right" onclick="slideGood(1,${slides.length})">›</button>
        <div class="gdots">${slides.map((_,k) => `<i class="${k===i?'on':''}"></i>`).join('')}</div>` : ''}
    </div>

    <div class="eyebrow">${esc(g.c)}</div>
    <h1 class="serif" style="font-size:23px;margin:8px 0 10px">${esc(g.t)}</h1>
    <div style="margin-bottom:12px">
      <span class="price" style="font-size:21px">${money(g.p)}</span>
      ${g.old?`<span class="old">${money(g.old)}</span>`:''}
      ${info.stock <= 5 ? `<span class="chip pale" style="margin-left:8px">осталось ${info.stock}</span>` : ''}
    </div>

    <p style="font-size:14px;line-height:1.55;color:var(--muted);margin:0 0 14px">${esc(info.about||'')}</p>

    ${info.video ? `<div class="sec-h" style="margin-top:6px"><h2 class="serif" style="font-size:18px">Видео о товаре</h2></div>
      <div class="promo${hasPlayer(g.id + '_vid') ? ' live' : ''}" style="height:auto;margin-bottom:14px">${videoBlock(g.id + '_vid')}</div>` : ''}

    <div class="card">
      <b style="font-size:14.5px">Доставка</b>
      <div class="uline" style="margin-top:8px"><span class="small muted" style="width:96px">Стоимость</span>
        <b style="font-size:13px;color:${info.delivery.free?'var(--ok)':'var(--ink)'}">
          ${info.delivery.free ? 'бесплатно' : money(info.delivery.price||390)}</b></div>
      <div class="uline"><span class="small muted" style="width:96px">Сроки</span>
        <div style="flex:1;font-size:12.5px">${esc(info.delivery.cities||'уточняется')}</div></div>
      ${info.delivery.pickup ? `<div class="uline"><span class="small muted" style="width:96px">Самовывоз</span>
        <b style="font-size:12.5px">из студии в Москве, бесплатно</b></div>` : ''}
    </div>

    <div class="card">
      <div class="spread"><span class="small muted">Бонусами можно закрыть</span>
        <b style="color:var(--accent)">до ${money(bonus)}</b></div>
      <div class="spread" style="margin-top:8px"><span class="small muted">Кэшбэк с заказа</span>
        <b style="color:var(--ok)">5% · ${money(Math.round(g.p*0.05))}</b></div>
    </div>

    <button class="btn ghost" onclick="openSheet({k:'askGood',id:'${attJs(g.id)}'})">Задать вопрос о товаре</button>
    <p class="small muted" style="text-align:center;margin:-4px 0 0;font-size:11.5px">Ответим в личных сообщениях</p>

    <div class="buybar">
      <div style="flex:1"><div class="small muted">${inCart ? 'в корзине ' + inCart + ' шт' : 'Итого'}</div>
        <b style="font-size:17px">${money(g.p)}</b></div>
      <button class="btn" style="width:auto;padding:12px 20px" onclick="addCart('${attJs(g.id)}')">В корзину</button>
    </div>
  </div>`;
}
function slideGood(d, n){
  S.gSlide = ((S.gSlide || 0) + d + n) % n;
  render();
}

