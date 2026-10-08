/* АСЬКА — промо в формате приложения: 11 слайдов, листаются свайпом,
   «картинки» — настоящие окна мессенджера, собранные из его же стилей и графики. */
(function () {
  'use strict';
  const A = window.AskaArt, Snd = window.AskaSound;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const logo = (n) => A.flowerSvg('#3cb44a', n, { logo: true });

  // подставить смайлы в фиксированный текст
  const CODES = [];
  A.SMILES.forEach((s) => s.codes.forEach((c) => CODES.push([c, s.id])));
  CODES.sort((a, b) => b[0].length - a[0].length);
  function sm(text) {
    let out = text;
    CODES.forEach(([c, id]) => { out = out.split(c).join(`<span class="sm" data-sm="${id}">${A.smileSvg(id)}</span>`); });
    return out;
  }

  /* ---------- мини-окна из приложения ---------- */
  const mockTitle = (t) => `<div class="titlebar">${logo(12)}<span class="ttl">${t}</span><span class="tbtn">_</span><span class="tbtn">×</span></div>`;
  const citem = (st, nick, extra) => `<div class="citem ${st === 'offline' ? 'off' : ''}"><span class="ico">${st === 'mail' ? `<span class="blink">${A.envelopeSvg(16)}</span>` : A.statusFlower(st, 16)}</span><span class="nick">${nick}</span>${extra || ''}</div>`;
  const mockContacts = () => `<div class="win mock contacts">${mockTitle('АСЬКА')}
    <div class="menubar"><button>Контакты</button><button>Звук</button><button>Справка</button></div>
    <div class="me-panel"><span class="ico">${A.statusFlower('online')}</span><span class="nick">Вася_2000</span><span class="sp"></span><span class="uin">#123456</span></div>
    <div class="clist inset"><div class="cgroup"><span class="box">−</span>В сети <span class="cnt">(4)</span></div>
      ${citem('mail', 'Катюха_98', '<span class="muted">1</span>')}${citem('chat', 'DJ_Serёga')}${citem('away', 'Ленка :)')}${citem('online', 'Админ АСЬКИ')}
      <div class="cgroup"><span class="box">−</span>Не в сети <span class="cnt">(1)</span></div>${citem('offline', 'ha©keR')}</div>
    <div class="bottom-bar"><button class="btn status-btn">${A.statusFlower('online')}<span class="lab">В сети</span><span class="sp"></span>▾</button><button class="btn icon">+</button></div>
  </div>`;
  const msg = (who, mine, time, text) => `<div class="msg ${mine ? 'me' : 'them'}"><span class="hdr">${who} <span class="time">(${time})</span>:</span> <span class="txt">${sm(text)}</span></div>`;
  const mockChat = (nick, uin, msgs, extraCls) => `<div class="win mock ${extraCls || ''}">${mockTitle(nick + ' <small>— беседа</small>')}
    <div class="chat-head"><span class="ico">${A.statusFlower('online')}</span><span class="nick">${nick}</span><span class="muted">#${uin}</span><span class="sp"></span><span class="hint">В сети</span></div>
    <div class="history inset">${msgs.join('')}</div>
    <div class="compose"><div class="field" style="height:30px;color:#808080">Напиши что-нибудь…</div><div class="send-row"><button class="btn icon">${A.smileSvg('smile', 14)}</button><span class="sp"></span><button class="btn primary">Отправить</button></div></div>
  </div>`;
  const mockReg = () => `<div class="win mock">${mockTitle('АСЬКА — регистрация')}
    <div class="login-body"><div class="col">
      <label class="row"><span class="lbl">Телефон</span><span class="field">+7 (916) 123-45-67</span></label>
      <label class="row"><span class="lbl">Ник</span><span class="field">Вася_2000</span></label>
      <div class="center hint mt">Твой номер АСЬКИ:</div>
      <div class="center"><span class="stamp-box"><span class="uin-box inset">123456</span><span class="seal">Выдано</span></span></div>
      <div class="hint center">Запиши на бумажке!</div>
    </div></div></div>`;

  const smileGrid = () => `<div class="inset sm-grid">${A.SMILES.map((s) => `<button data-sm="${s.id}" title="${s.codes[0]} — ${s.name}">${A.smileSvg(s.id, 24)}</button>`).join('')}</div><div class="sm-cap" id="smcap">нажми на любой — он что-нибудь скажет</div>`;

  const globe = () => {
    const pins = [[70, 60, 'Москва'], [150, 50, 'Питер'], [60, 130, 'Лиссабон'], [160, 120, 'Урюпинск'], [110, 196, 'Антарктида']];
    return `<svg class="globe" viewBox="0 0 220 220" aria-hidden="true">
      <circle cx="110" cy="110" r="96" fill="#8ec7ff" stroke="#1a1a1a" stroke-width="1.5"/>
      <ellipse cx="110" cy="110" rx="40" ry="96" fill="none" stroke="#3a6ea5" stroke-width=".8"/><ellipse cx="110" cy="110" rx="75" ry="96" fill="none" stroke="#3a6ea5" stroke-width=".8"/>
      <line x1="14" y1="110" x2="206" y2="110" stroke="#3a6ea5" stroke-width=".8"/><ellipse cx="110" cy="70" rx="86" ry="20" fill="none" stroke="#3a6ea5" stroke-width=".8"/><ellipse cx="110" cy="150" rx="86" ry="20" fill="none" stroke="#3a6ea5" stroke-width=".8"/>
      <path d="M60 50q30-20 70-5t40 30q-10 25-45 20t-40 15q-30 5-40-20t15-40z" fill="#9bd14a" stroke="#4b7d12" stroke-width="1"/>
      <path d="M70 150q20-10 45 0t20 25q-25 10-45 0t-20-25z" fill="#9bd14a" stroke="#4b7d12" stroke-width="1"/>
      <path d="M40 190q70 30 140 0" fill="#fff" stroke="#999" stroke-width="1"/>
      <g stroke="#ffe14d" stroke-width="1.2" stroke-dasharray="3 3" fill="none"><path d="M70 60L150 50M150 50L160 120M70 60L60 130M60 130L110 196M160 120L110 196"/></g>
      ${pins.map(([x, y, n]) => `<g class="pin" style="transform-origin:${x}px ${y}px"><g transform="translate(${x - 8},${y - 8})">${A.flowerSvg('#3cb44a', 16)}</g><text x="${x}" y="${y + 20}" font-size="9" font-family="Tahoma,Verdana,sans-serif" font-weight="bold" text-anchor="middle" fill="#0a246a" stroke="#fff" stroke-width="2.5" paint-order="stroke">${n}</text></g>`).join('')}
    </svg>`;
  };

  const bsod = () => `<div class="bsod"><b> Windows </b>

Произошла ошибка: Windows не найдена.
АСЬКА продолжает работать в штатном режиме.

* Нажмите любую клавишу, чтобы ничего не произошло.
* Нажмите CTRL+ALT+DEL, чтобы вспомнить молодость.

Нажмите любую клавишу для продолжения <span class="cur">_</span></div>`;

  const net = () => `<div class="net">
    <div class="node"><div class="box"><div class="titlebar">${logo(10)}<span class="ttl">Вася</span></div><div class="inset">${sm('Маша, ку! :)')}</div></div></div>
    <div class="wire"><span class="cloud">☁ Вселенская сеть™</span><span class="env">${A.envelopeSvg(16)}</span></div>
    <div class="node"><div class="box"><div class="titlebar">${logo(10)}<span class="ttl">Маша</span></div><div class="inset"><span class="blink">${A.envelopeSvg(12)}</span> о-оу!</div></div></div>
  </div>`;

  const STATUS_JOKES = { online: 'тут', chat: 'очень тут, интернет безлимитный', away: 'отошёл к чайнику', na: 'чайник + сериал', occupied: 'делает вид, что занят', dnd: 'серьёзно, не надо', invisible: 'тут, но не признаётся' };
  const statusList = () => `<div class="inset st-list">${A.STATUSES.filter((s) => s.key !== 'offline').map((s) => `<div class="citem"><span class="ico">${A.statusFlower(s.key, 16)}</span><span class="nick">${s.label}</span><span class="d">— ${STATUS_JOKES[s.key]}</span></div>`).join('')}</div>`;

  const price = () => `<div class="inset price">
    <div class="row"><span>Пейджер</span><span class="sp"></span><span>150 $ + абонентка</span></div>
    <div class="row"><span>Час дайлапа</span><span class="sp"></span><span>60 ₽ и занятый телефон</span></div>
    <div class="row"><span>Модем 56k</span><span class="sp"></span><span>120 $ и крики мамы</span></div>
    <div class="row"><span>${logo(12)} АСЬКА</span><span class="sp"></span><span>0 ₽ 00 коп.</span></div>
  </div>`;

  /* ---------- слайды ---------- */
  const SLIDES = [
    { title: 'АСЬКА — презентация.exe', body: `
      <div class="cover"><span class="flower">${logo(64)}</span><div class="word">АСЬКА</div><div class="sub">I seek you — по-русски</div>
      <div class="h" style="margin-top:14px">Мессенджер <em>будущего</em>.<span class="tm">*</span></div>
      <div class="p">Свой номер, современные смайлы, сообщения со звуком. Работает на всём, везде и без Windows.</div>
      <div class="swipe">листай вправо <i>→</i></div></div>
      <div class="joke">Будущего образца 1999 года. Дальше — 10 преимуществ и ни одного недостатка. Недостатки мы не считали.</div>` },

    { title: 'Преимущество 1 из 10 — Номер', body: `
      <div class="num">Преимущество №1</div><div class="h">Свой <em>номер</em>. Шестизначный.</div>
      <div class="p">Никаких логинов из четырнадцати символов и «имя_пользователя_2». Шесть цифр — запомнит даже мама. Плюс ник и телефон, чтобы друзья нашли тебя за секунду.</div>
      <div class="art">${mockReg()}</div>
      <div class="joke">Номер выдаётся автоматически. Очередь, талончик и паспорт не нужны. Бумажка — нужна.</div>` },

    { title: 'Преимущество 2 из 10 — Смайлы.exe', body: `
      <div class="num">Преимущество №2</div><div class="h"><em>Современный</em> набор смайликов</div>
      <div class="p">Целых 22 штуки. Жёлтые, круглые, с глазами — всё по последней моде. Есть роза для романтиков и пиво для всех остальных. Нажми — каждый что-нибудь скажет.</div>
      <div class="art" style="flex-direction:column;gap:0">${smileGrid()}</div>
      <div class="joke">Анимированных нет. Зато звучащие — да. Это как анимация, только для ушей.</div>` },

    { title: 'Преимущество 3 из 10 — Звук', body: `
      <div class="num">Преимущество №3</div><div class="h">Технология <em>Звук-Сообщение</em><span class="tm">™</span></div>
      <div class="p">Каждое входящее приходит с фирменным «о-оу!». Будто кто-то рядом удивился, что тебе написали. Потому что так и есть.</div>
      <div class="art" style="flex-direction:column"><span class="uhoh" id="uhoh"><span class="bubble">о-оу!</span>${mockChat('Катюха_98', '100500', [msg('Вася_2000', true, '23:58', 'Катюх, ты тут?'), msg('Катюха_98', false, '23:59', 'Тут! Чё так поздно? :)')])}</span>
      <button class="btn big play" id="play-uhoh">Послушать «о-оу!»</button></div>
      <div class="joke">Звук синтезируется прямо в телефоне. Файлов нет, качать нечего, модем отдыхает.</div>` },

    { title: 'Преимущество 4 из 10 — Устройства', body: `
      <div class="num">Преимущество №4</div><div class="h">Работает <em>на всех устройствах</em></div>
      <div class="p">iPhone, Android, ноутбук, компьютер с Pentium II, холодильник с браузером. Открыл ссылку — работает. Добавил на экран «Домой» — работает как приложение.</div>
      <div class="art"><div class="phone"><div class="screen">${mockContacts()}</div></div><div class="crt"><div class="screen">${mockChat('DJ_Serёga', '777777', [msg('DJ_Serёga', false, '21:00', 'В субботу сейшн! (b)'), msg('Вася_2000', true, '21:01', 'Буду! 8)')])}<span class="led"></span></div><div class="stand"></div><div class="base"></div></div></div>
      <div class="art" style="margin-top:6px"><span class="no"><s>калькулятор</s></span><span class="no"><s>тамагочи</s></span><span class="no"><s>пейджер</s></span></div>
      <div class="joke">Калькулятор, тамагочи и пейджер пока не поддерживаются. Ведём переговоры.</div>` },

    { title: 'Преимущество 5 из 10 — География', body: `
      <div class="num">Преимущество №5</div><div class="h">Работает <em>из любой страны</em></div>
      <div class="p">Москва, Питер, Урюпинск, Лиссабон, Антарктида. Где есть интернет — там есть АСЬКА. Где нет интернета — тоже есть, но собеседников меньше.</div>
      <div class="art">${globe()}</div>
      <div class="joke">Поддерживаются 195 стран, Антарктида и дача без связи — для неё есть офлайн-режим.</div>` },

    { title: 'Преимущество 6 из 10 — Система', body: `
      <div class="num">Преимущество №6</div><div class="h"><em>Не требует Windows</em></div>
      <div class="p">Ни 95, ни 98, ни даже Millennium. Нужен только браузер. Mac, Linux, iOS, Android — всем рады. Диск с драйверами можно выбросить.</div>
      <div class="art">${bsod()}</div>
      <div class="joke">Синий экран остался только как цвет рабочего стола. Для атмосферы.</div>` },

    { title: 'Преимущество 7 из 10 — Связь', body: `
      <div class="num">Преимущество №7</div><div class="h">Свой канал связи через <em>Вселенскую сеть</em><span class="tm">™</span></div>
      <div class="p">Сообщения летят напрямую, по собственному протоколу, минуя посредников, серверы и Пентагон. Открыл АСЬКУ во второй вкладке — и вот уже два номера общаются.</div>
      <div class="art">${net()}</div>
      <div class="joke">Задержка доставки — ноль секунд. Пока в пределах одного устройства: межпланетный режим в разработке.</div>` },

    { title: 'Преимущество 8 из 10 — Статусы', body: `
      <div class="num">Преимущество №8</div><div class="h">Семь <em>цветочков</em>-настроений</div>
      <div class="p">Зелёный — тут. Жёлтый — отошёл к чайнику. Красный — не беспокоить, серьёзно. Невидимый — тут, но не признаётся.</div>
      <div class="art">${statusList()}</div>
      <div class="joke">Статус «Готов болтать» сообщает всем, что у тебя безлимитный интернет. Завидуйте.</div>` },

    { title: 'Преимущество 9 из 10 — Собеседники', body: `
      <div class="num">Преимущество №9</div><div class="h"><em>Друзья</em> в комплекте</div>
      <div class="p">Ещё никого не добавил? Не беда: Катюха_98, ha©keR, DJ_Serёga и Ленка уже в списке. Всегда в сети, всегда рады, всегда про модем.</div>
      <div class="art">${mockChat('Катюха_98', '100500', [msg('Катюха_98', false, '00:12', 'Скинь мп3 какую-нить, а? Только не больше 3 мегов, а то до утра качать'), msg('Вася_2000', true, '00:13', 'Держи. Руки Вверх, 2.8 мега :P'), msg('Катюха_98', false, '00:14', 'ооо круто!!! 8) ща чайник поставлю и вернусь')])}</div>
      <div class="joke">Боты не обижаются, не ставят «прочитано» и не спрашивают, почему не отвечаешь.</div>` },

    { title: 'Преимущество 10 из 10 — Цена', body: `
      <div class="num">Преимущество №10</div><div class="h">Стоимость: <em>0 ₽ 00 коп.</em></div>
      <div class="p">Для сравнения — честный прайс конца девяностых:</div>
      <div class="art">${price()}</div>
      <div class="cta"><a class="btn primary big" id="cta" href="../">${logo(14)} Получить номер</a><div class="hint">Бесплатно, без СМС и без карты. Регистрация — 9 секунд, мы засекали.<br>Потом добавь на экран «Домой»: будет как приложение и работает офлайн.</div></div>
      <div class="joke">На Pentium II регистрация занимает 11 секунд. Тоже неплохо.</div>` },
  ];

  /* ---------- сборка ---------- */
  const deck = $('#deck'), bar = $('#bar'), counter = $('#counter');
  deck.innerHTML = SLIDES.map((s, i) => `<section class="slide" data-i="${i}"><div class="win card"><div class="titlebar">${logo(14)}<span class="ttl">${s.title}</span><a class="tbtn" href="../" title="Хватит, хочу номер">×</a></div><div class="body">${s.body}</div></div></section>`).join('');
  bar.innerHTML = SLIDES.map(() => '<span class="seg"></span>').join('');
  $('#start-ico').innerHTML = logo(16);
  $('#tray-ico').innerHTML = A.statusFlower('online', 14);

  const slides = $$('.slide'), segs = $$('.seg');
  let cur = -1;
  const N = SLIDES.length;

  function setCurrent(i, silent) {
    if (i === cur) return;
    cur = i;
    slides.forEach((s, k) => s.classList.toggle('on', k === i));
    segs.forEach((s, k) => { s.classList.toggle('done', k < i); s.classList.toggle('cur', k === i); });
    counter.textContent = `${i + 1} / ${N}`;
    $('#prev').disabled = i === 0;
    $('#next').disabled = i === N - 1;
    try { history.replaceState(null, '', '#' + (i + 1)); } catch (e) {}
    if (!silent) Snd.play('click');
    if (i === 3) setTimeout(uhoh, 500);
  }
  function go(i, instant) {
    i = Math.max(0, Math.min(N - 1, i));
    deck.scrollTo({ left: i * deck.clientWidth, behavior: instant ? 'auto' : 'smooth' });
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting && e.intersectionRatio >= 0.6) setCurrent(+e.target.dataset.i); });
  }, { root: deck, threshold: [0.6] });
  slides.forEach((s) => io.observe(s));

  $('#prev').onclick = () => go(cur - 1);
  $('#next').onclick = () => go(cur + 1);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); go(cur + 1); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(cur - 1); }
    if (e.key === 'Home') go(0);
    if (e.key === 'End') go(N - 1);
  });
  // колесо мыши — тоже листает
  let wheelLock = 0;
  $('.promo').addEventListener('wheel', (e) => {
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(d) < 12 || Date.now() < wheelLock) return;
    e.preventDefault();
    wheelLock = Date.now() + 650;
    go(cur + (d > 0 ? 1 : -1));
  }, { passive: false });
  // перетаскивание мышью
  let drag = null;
  deck.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse' || e.target.closest('button, a, .sm-grid')) return; drag = { x: e.clientX, left: deck.scrollLeft }; deck.classList.add('drag'); });
  deck.addEventListener('pointermove', (e) => { if (!drag) return; deck.scrollLeft = drag.left - (e.clientX - drag.x); });
  const endDrag = (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    deck.classList.remove('drag');
    drag = null;
    go(Math.abs(dx) > 40 ? cur - Math.sign(dx) : cur);
  };
  deck.addEventListener('pointerup', endDrag);
  deck.addEventListener('pointercancel', endDrag);
  deck.addEventListener('pointerleave', (e) => { if (drag) endDrag(e); });
  window.addEventListener('resize', () => go(cur, true));
  window.addEventListener('hashchange', () => { const n = parseInt(location.hash.slice(1), 10); if (n >= 1 && n <= N && n - 1 !== cur) go(n - 1); });

  /* ---------- интерактив ---------- */
  function uhoh() {
    const el = $('#uhoh'); if (!el) return;
    el.classList.remove('say'); void el.offsetWidth; el.classList.add('say');
    Snd.play('incoming');
  }
  $('#play-uhoh').onclick = uhoh;
  $$('.sm-grid button').forEach((b) => (b.onclick = () => {
    const s = A.SMILE_BY_ID[b.dataset.sm];
    Snd.smile(s.id);
    b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit');
    $('#smcap').textContent = `${s.codes[0]} — ${s.name}`;
  }));
  document.addEventListener('click', (e) => {
    const sm = e.target.closest('.sm');
    if (sm && sm.dataset.sm) { Snd.smile(sm.dataset.sm); sm.classList.remove('bounce'); void sm.offsetWidth; sm.classList.add('bounce'); }
  });
  $('#cta').addEventListener('click', () => Snd.play('connect'));
  ['pointerdown', 'keydown', 'touchend'].forEach((ev) => document.addEventListener(ev, () => Snd.unlock(), { passive: true }));

  // часы в трее — настоящие, но дата всегда 31.12.1999
  const clock = $('#clock');
  const tick = () => { const d = new Date(); clock.textContent = (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes(); };
  tick(); setInterval(tick, 15000);
  clock.title = '31.12.1999';

  // старт: слайд из адреса (#5) или первый
  const start = Math.max(1, Math.min(N, parseInt(location.hash.slice(1), 10) || 1)) - 1;
  setCurrent(start, true);
  requestAnimationFrame(() => go(start, true));
})();
