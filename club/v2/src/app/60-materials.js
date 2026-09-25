/* Стандарты и презентации — смотрим прямо в штабе. Файлы презентаций
   опубликованы рядом со штабом (папка m/); если их нет (например, на
   GitHub Pages), остаётся ссылка на оригинал. Основатель может добавить
   свои ссылки — они лежат в базе, в коллекции links. */

const TEAM_ROLES = ['owner', 'lead', 'member'];
const ALL_ROLES = ['owner', 'lead', 'member', 'investor'];
const MAT_GROUPS = {
  standards: {name: 'Стандарты',             about: 'Как мы работаем, говорим и считаем деньги'},
  team:      {name: 'Команде',               about: 'План квартала и выступление основателя'},
  investors: {name: 'Инвесторам',            about: 'Для встреч по раунду pre-seed'},
  experts:   {name: 'Экспертам и партнёрам', about: 'Чтобы пригласить эксперта или партнёра'},
  more:      {name: 'Ещё по проекту',        about: 'Открываются в новой вкладке'},
};
const MATERIALS = [
  {id: 'standards', group: 'standards', title: 'Книга стандартов', sub: 'Версия 1.0 · 13 глав и тест из 20 вопросов. Выдаётся каждому в команде', file: 'm/standards.html', url: 'https://claude.ai/artifact/6YLAiVtzRwmqwMJ2DqrsvH', roles: TEAM_ROLES},
  {id: 'team', group: 'team', title: 'Квартал команды', sub: 'IV квартал 2026 · 13 слайдов: цели, план продаж, премия и ритм', file: 'm/team.html', url: 'https://claude.ai/artifact/L3xYahrutEbWqbf51fq9Jx', roles: TEAM_ROLES},
  {id: 'speech', group: 'team', title: 'Выступление основателя', sub: 'Та же презентация по шагам — 40 шагов с текстом к каждому', file: 'm/speech.html', url: 'https://claude.ai/artifact/C88pX22Rcg6YpyUDogoPUy', roles: TEAM_ROLES},
  {id: 'investor', group: 'investors', title: 'Инвестору', sub: 'Сентябрь 2026 · 15 слайдов: рынок, продукт, деньги, раунд', file: 'm/investor.html', url: 'https://claude.ai/artifact/HdzeCgjPiYhYiUQAagA8B8', roles: ALL_ROLES},
  {id: 'pitch', group: 'investors', title: 'Питч', sub: 'Seed-раунд · 17 слайдов для первой встречи', file: 'm/pitch.html', url: 'https://claude.ai/artifact/5p5k6GJP3b35uDJpFkgYBu', roles: ALL_ROLES},
  {id: 'experts', group: 'experts', title: 'Экспертам', sub: 'Приглашение в проект · 11 слайдов', file: 'm/experts.html', url: 'https://claude.ai/artifact/RCzzjUdrE7EaEqbgfupFzb', roles: TEAM_ROLES},
  {id: 'experts-partners', group: 'experts', title: 'Экспертам и партнёрам', sub: '9 слайдов: вход бесплатный, публикация за 7 дней', file: 'm/experts-partners.html', url: 'https://claude.ai/artifact/EC1YLLoicdHourkCCTw3BN', roles: TEAM_ROLES},
];
const MORE_LINKS = [
  {title: 'Амбассадорская программа', url: 'https://claude.ai/artifact/UKVD5gRKe6vVMouhsmCryR'},
  {title: 'План съёмок', url: 'https://claude.ai/artifact/JRsdV1BPqJ1B5aLPQ9C62B'},
  {title: 'Права и роли в приложении', url: 'https://claude.ai/artifact/XLvX3eRMxRSJrxQHgc7n5x'},
  {title: 'Главная Eva Space', url: 'https://claude.ai/artifact/EWQbgtvGnVbQtcRiZDHbGR'},
  {title: 'Голоса Eva Space', url: 'https://claude.ai/artifact/VDoTpBTQJBHTG9B3cYosAC'},
  {title: 'Штаб продукта Eva Space', url: 'https://claude.ai/artifact/P723mALW3WEZzUaWtgRZYD'},
];
const matVisible = m => (m.roles || ALL_ROLES).includes(Auth.role());
const safeUrl = u => (/^https:\/\//i.test(String(u || '')) ? String(u) : '');

function materialsHtml() {
  const mats = MATERIALS.filter(matVisible);
  const custom = Store.all('links').filter(l => (l.roles || ALL_ROLES).includes(Auth.role())).sort((a, b) => (a.at || 0) - (b.at || 0));
  const std = mats.find(m => m.group === 'standards');
  const card = m => `<a class="mat" href="#m-${m.id}"><span class="mat-ico">${icon(m.group === 'standards' ? 'book' : 'play')}</span><span class="mat-t"><b>${esc(m.title)}</b><small>${esc(m.sub)}</small></span>${icon('arrow', 'mat-go')}</a>`;
  const groups = ['team', 'investors', 'experts'].map(g => {
    const list = mats.filter(m => m.group === g);
    const own = custom.filter(l => l.group === g);
    if (!list.length && !own.length) return '';
    return `<div class="mat-group"><div class="mat-gh"><b>${MAT_GROUPS[g].name}</b><span>${MAT_GROUPS[g].about}</span></div>
      ${list.map(card).join('')}${own.map(linkCard).join('')}</div>`;
  }).join('');
  const more = Auth.role() === 'investor' ? [] : MORE_LINKS;
  const ownMore = custom.filter(l => !l.group || l.group === 'more' || l.group === 'standards');
  return `<div class="mats">
    ${std ? `<a class="mat-hero" href="#m-${std.id}">${brandIcon('mat-star')}<div><span class="label">Стандарты</span><b>${esc(std.title)}</b><p>${esc(std.sub)}</p></div><span class="btn primary sm">Открыть${icon('arrow')}</span></a>` : ''}
    <div class="mat-groups">${groups}</div>
    ${more.length || ownMore.length ? `<div class="mat-more"><span class="label">${MAT_GROUPS.more.name}</span>${more.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.title)}${icon('ext')}</a>`).join('')}${ownMore.map(l => `<a href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener">${esc(l.title)}${icon('ext')}</a>`).join('')}</div>` : ''}
    ${Auth.isOwner() ? `<button class="btn sm ghost mat-add" data-link-add>${icon('plus')}Добавить материал по ссылке</button>` : ''}
  </div>`;
}
function linkCard(l) {
  const url = safeUrl(l.url);
  return `<div class="mat-wrap"><a class="mat" href="${esc(url)}" target="_blank" rel="noopener"><span class="mat-ico">${icon('ext')}</span><span class="mat-t"><b>${esc(l.title)}</b><small>${esc(l.sub || 'ссылка, откроется в новой вкладке')}</small></span></a>${Auth.isOwner() ? `<button class="icon-btn mat-del" data-link-del="${l.id}" title="Убрать ссылку" aria-label="Убрать ссылку">${icon('x')}</button>` : ''}</div>`;
}
function wireMaterials(root) {
  on(root, 'click', '[data-link-add]', () => {
    openModal({
      title: 'Материал по ссылке',
      body: `<label class="field"><span>Название</span><input class="input" id="lkTitle" placeholder="Например: Отчёт для инвестора, ноябрь"></label>
        <label class="field"><span>Ссылка</span><input class="input" id="lkUrl" placeholder="https://claude.ai/artifact/…"></label>
        <label class="field"><span>Короткое описание</span><input class="input" id="lkSub" placeholder="Необязательно"></label>
        <div class="grid2"><label class="field"><span>Раздел</span><select class="select" id="lkGroup">${Object.entries(MAT_GROUPS).filter(([k]) => k !== 'standards').map(([k, g]) => `<option value="${k}">${g.name}</option>`).join('')}</select></label>
        <label class="field"><span>Кому видно</span><select class="select" id="lkRoles"><option value="team">Команде</option><option value="all">Всем, включая инвесторов</option></select></label></div>`,
      foot: '<button class="btn" data-close>Отмена</button><button class="btn primary" id="lkSave">Добавить</button>',
      onMount(el, close) {
        $('#lkSave', el).onclick = () => {
          const title = $('#lkTitle', el).value.trim(), url = safeUrl($('#lkUrl', el).value.trim());
          if (!title) return $('#lkTitle', el).focus();
          if (!url) { $('#lkUrl', el).focus(); toast('Нужна ссылка, начинающаяся с https://'); return; }
          Store.add('links', {title, url, sub: $('#lkSub', el).value.trim(), group: $('#lkGroup', el).value,
            roles: $('#lkRoles', el).value === 'all' ? ALL_ROLES : TEAM_ROLES, at: Date.now()});
          close();
        };
      },
    });
  });
  on(root, 'click', '[data-link-del]', async (e, el) => {
    e.preventDefault();
    e.stopPropagation();
    if (!(await confirmPop(el, {text: 'Убрать ссылку из материалов?', yes: 'Да, убрать', danger: true}))) return;
    const copy = clone(Store.get('links', el.dataset.linkDel));
    Store.remove('links', el.dataset.linkDel);
    toast('Ссылка убрана', {undo: () => Store.put('links', copy.id, copy)});
  });
}

/* ── просмотр материала ── */
const deckCache = {};
App.register('material', {
  title: 'Материал',
  render(root, id) {
    const m = MATERIALS.find(x => x.id === id);
    if (!m || !matVisible(m)) { root.innerHTML = pageHead('Материал', '') + noAccess('Материал не найден или закрыт для вашей роли.'); return; }
    const siblings = MATERIALS.filter(x => x.group === m.group && x.id !== m.id && matVisible(x));
    root.innerHTML = `<div class="viewer">
      <div class="viewer-head">
        <a class="btn ghost sm" href="#home">${icon('back')}Главная</a>
        <div class="viewer-t"><span class="label">${MAT_GROUPS[m.group].name}</span><b>${esc(m.title)}</b></div>
        <div class="viewer-act">
          ${siblings.map(x => `<a class="btn sm" href="#m-${x.id}">${esc(x.title)}</a>`).join('')}
          <a class="btn sm" href="${esc(m.url)}" target="_blank" rel="noopener">${icon('ext')}Открыть оригинал</a>
        </div>
      </div>
      <div class="viewer-frame" id="vFrame"><div class="viewer-load">Открываю «${esc(m.title)}»…</div></div>
      <p class="note">${m.group === 'standards' ? 'Книга читается прокруткой, оглавление слева, тест — в конце. Прогресс чтения запоминается в этом браузере.' : 'Листайте стрелками ← → или пробелом, F — на весь экран.'} Если материал не открылся здесь, нажмите «Открыть оригинал».</p>
    </div>`;
    const box = $('#vFrame', root);
    const show = html => {
      const f = document.createElement('iframe');
      f.title = m.title;
      f.setAttribute('sandbox', 'allow-scripts allow-popups allow-popups-to-escape-sandbox');
      f.setAttribute('allowfullscreen', '');
      f.srcdoc = html;
      box.innerHTML = '';
      box.appendChild(f);
      setTimeout(() => { try { f.focus(); } catch (e) { /* ничего */ } }, 200);
    };
    if (deckCache[m.id]) { show(deckCache[m.id]); return; }
    fetch(m.file, {cache: 'force-cache'}).then(r => { if (!r.ok) throw new Error(r.status); return r.text(); }).then(html => {
      deckCache[m.id] = html;
      if (box.isConnected) show(html);
    }).catch(() => {
      if (!box.isConnected) return;
      box.innerHTML = `<div class="viewer-load"><b>Здесь презентация не открылась</b><p>Файл лежит только в артефакте штаба. Откройте оригинал — он всегда под рукой.</p>
        <a class="btn primary" href="${esc(m.url)}" target="_blank" rel="noopener">${icon('ext')}Открыть «${esc(m.title)}»</a></div>`;
    });
  },
});