/* Кастдев — один раздел вместо четырёх: сверху вкладки «Доска · Встречи · Статистика · Настройки»,
   на доске — переключатель групп «Все · Эксперты · Клиентки · Партнёры · Амбассадоры». Старые адреса
   (#client, #expert, #partner, #amb, #meetings, #stats, #questions) работают и открываются внутри раздела. */

const CD_TABS = [['custdev', 'Доска'], ['meetings', 'Встречи'], ['stats', 'Статистика'], ['questions', 'Настройки: вопросы и формы']];
const CD_GROUPS = [['all', 'Все'], ['expert', 'Эксперты'], ['client', 'Клиентки'], ['partner', 'Партнёры'], ['amb', 'Амбассадоры']];
const CD_ROUTES = ['custdev', 'meetings', 'stats', 'questions', ...Object.keys(TYPES)];
const cdHash = g => (g === 'all' ? 'custdev' : g);

function cdTop(tab, group) {
  const n = g => (g === 'all' ? People.all().length : People.all(g).length);
  const fresh = g => freshList().filter(p => g === 'all' || p.type === g).length;
  return `<div class="cd-top">
    <nav class="cd-tabs" aria-label="Кастдев">${CD_TABS.map(([k, name]) => `<a href="#${k === 'custdev' ? cdHash(group) : k}" class="${tab === k ? 'on' : ''}">${name}${k === 'meetings' ? (() => { const c = Store.all('people').filter(p => People.col(p) === 2 && p.s2 !== 'set').length; return c ? `<span class="n">${c}</span>` : ''; })() : ''}</a>`).join('')}</nav>
    ${tab === 'custdev' ? `<div class="cd-groups" role="group" aria-label="Группа">${CD_GROUPS.map(([g, name]) => `<a href="#${cdHash(g)}" class="chip ${group === g ? 'on' : ''}">${g === 'all' ? '' : TYPES[g].emo + ' '}${name}<span class="chip-n">${n(g)}</span>${fresh(g) ? `<span class="chip-new">+${fresh(g)}</span>` : ''}</a>`).join('')}</div>` : ''}
  </div>`;
}
/* страница внутри раздела: полоса сверху и сама страница ниже */
function cdWrap(tab, inner, group = null) {
  return {
    title: inner.title,
    render(root) {
      const g = group || View.get('cd.type', 'all');
      if (group) View.set('cd.type', group);
      root.innerHTML = `${cdTop(tab, g)}<div class="cd-body"></div>`;
      inner.render($('.cd-body', root));
    },
  };
}
(() => {
  const P = App.pages;
  const board = g => (g === 'all' ? P['cd-all'] : P[g]);
  const boards = Object.fromEntries(Object.keys(TYPES).map(k => [k, P[k]]));
  App.register('custdev', {title: 'Кастдев', render(root) { View.set('cd.type', 'all'); cdWrap('custdev', board('all'), 'all').render(root); }});
  Object.keys(TYPES).forEach(k => App.register(k, cdWrap('custdev', boards[k], k)));
  ['meetings', 'stats', 'questions'].forEach(k => App.register(k, cdWrap(k, P[k])));
})();
