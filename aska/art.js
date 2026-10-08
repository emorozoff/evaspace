/* АСЬКА — общая графика: цветочки-статусы и смайлы.
   Рисуется векторно прямо в коде, поэтому файлов с картинками нет.
   Используется и самим мессенджером, и промо-слайдами. */
window.AskaArt = (function () {
  /* ================= статусы ================= */
  const STATUSES = [
    { key: 'online', label: 'В сети', color: '#3cb44a' },
    { key: 'chat', label: 'Готов болтать', color: '#1fa3e0', glyph: 'chat' },
    { key: 'away', label: 'Отошёл', color: '#e8c22d', glyph: 'clock' },
    { key: 'na', label: 'Недоступен', color: '#e88b2d', glyph: 'clock' },
    { key: 'occupied', label: 'Занят', color: '#d85050', glyph: 'minus' },
    { key: 'dnd', label: 'Не беспокоить', color: '#b01818', glyph: 'minus' },
    { key: 'invisible', label: 'Невидимый', color: '#a8a8a8', glyph: 'ghost' },
    { key: 'offline', label: 'Не в сети', color: '#d8232a' },
  ];
  const statusInfo = (key) => STATUSES.find((s) => s.key === key) || STATUSES[STATUSES.length - 1];

  /* ================= цветочек ================= */
  function flowerInner(color, opts) {
    opts = opts || {};
    let petals = '';
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 - Math.PI / 2;
      const cx = (8 + 5 * Math.cos(a)).toFixed(2), cy = (8 + 5 * Math.sin(a)).toFixed(2);
      const fill = opts.logo && i === 3 ? '#d8232a' : color;
      petals += `<circle cx="${cx}" cy="${cy}" r="2.7" fill="${fill}" stroke="#1a1a1a" stroke-width=".55"/>`;
    }
    let glyph = '';
    if (opts.glyph === 'minus') glyph = '<rect x="4" y="7" width="8" height="2" fill="#fff"/><rect x="4.5" y="7.5" width="7" height="1" fill="#b01818"/>';
    if (opts.glyph === 'clock') glyph = '<path d="M8 5.5V8h2" stroke="#000" stroke-width="1" fill="none"/>';
    if (opts.glyph === 'chat') glyph = '<rect x="5" y="6" width="6" height="4" rx="1" fill="#fff" stroke="#000" stroke-width=".6"/><path d="M6.5 10l-1 1.6 2-1.6" fill="#fff" stroke="#000" stroke-width=".6"/>';
    const center = opts.glyph === 'minus' || opts.glyph === 'chat' ? '' : `<circle cx="8" cy="8" r="2.5" fill="#fff" stroke="#1a1a1a" stroke-width=".55"/>`;
    return petals + center + glyph;
  }
  function flowerSvg(color, size, opts) {
    opts = opts || {};
    size = size || 16;
    const op = opts.glyph === 'ghost' ? ' opacity=".55"' : '';
    const ring = opts.ring ? `<circle cx="8" cy="8" r="7.3" fill="none" stroke="${opts.ring}" stroke-width="1.2"/>` : '';
    return `<svg viewBox="0 0 16 16" width="${size}" height="${size}" aria-hidden="true"${op}>${ring}${flowerInner(color, opts)}</svg>`;
  }
  const statusFlower = (key, size, ring) => { const s = statusInfo(key); return flowerSvg(s.color, size, { glyph: s.glyph, ring }); };
  const envelopeSvg = (size) => `<svg viewBox="0 0 16 16" width="${size || 16}" height="${size || 16}" aria-hidden="true"><rect x="1" y="3.5" width="14" height="9" fill="#ffe14d" stroke="#000" stroke-width=".7"/><path d="M1 3.5l7 5 7-5M1 12.5l5.5-5M15 12.5l-5.5-5" stroke="#000" stroke-width=".7" fill="none"/></svg>`;

  /* ================= смайлы ================= */
  const SMILES = [
    { id: 'smile', codes: [':)', ':-)'], name: 'улыбка' },
    { id: 'laugh', codes: [':D', ':-D'], name: 'смех' },
    { id: 'wink', codes: [';)', ';-)'], name: 'подмигиваю' },
    { id: 'sad', codes: [':(', ':-('], name: 'грусть' },
    { id: 'cry', codes: [":'(", ':_('], name: 'плачу' },
    { id: 'tongue', codes: [':P', ':-P', ':p'], name: 'язык' },
    { id: 'cool', codes: ['8)', '8-)', 'B)'], name: 'крутой' },
    { id: 'surprise', codes: [':O', ':-O', ':o'], name: 'ого' },
    { id: 'kiss', codes: [':*', ':-*'], name: 'чмок' },
    { id: 'angry', codes: ['>:(', ':@'], name: 'злюсь' },
    { id: 'neutral', codes: [':|', ':-|'], name: 'хм' },
    { id: 'blush', codes: [':$', ':-$'], name: 'смущаюсь' },
    { id: 'heart', codes: ['<3'], name: 'сердце' },
    { id: 'rose', codes: ['@}->--', '@)->--', '(f)'], name: 'роза' },
    { id: 'beer', codes: ['(b)', '(B)'], name: 'пиво' },
    { id: 'zzz', codes: ['|-)', '(zzz)'], name: 'сплю' },
    { id: 'devil', codes: ['>:)', '}:)'], name: 'чёртик' },
    { id: 'party', codes: ['<:o)', '(party)'], name: 'праздник' },
    { id: 'think', codes: [':-?', '(think)'], name: 'думаю' },
    { id: 'sick', codes: [':-&', '(sick)'], name: 'фу' },
    { id: 'angel', codes: ['O:)', 'O:-)'], name: 'ангел' },
    { id: 'shock', codes: ['8-O', '8O', ':-0'], name: 'шок' },
    { id: 'wine', codes: ['(wine)', '(вино)', '(чин)'], name: 'чокнемся', anim: true },
    { id: 'heart2', codes: ['(love)', '(сердце)', '(л)'], name: 'сердечко', anim: true },
  ];
  const SMILE_BY_ID = {};
  SMILES.forEach((s) => (SMILE_BY_ID[s.id] = s));

  const FACE = (fill, stroke) => `<defs><radialGradient id="g_${fill.slice(1)}" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset=".35" stop-color="${fill}"/><stop offset="1" stop-color="${stroke}"/></radialGradient></defs><circle cx="10" cy="10" r="8.6" fill="url(#g_${fill.slice(1)})" stroke="#000" stroke-width=".8"/>`;
  const Y = ['#ffd21e', '#c98a00'], R = ['#ff5a3c', '#a01a00'], G = ['#9bd14a', '#4b7d12'], P = ['#ff9ec7', '#b5376f'];
  const EYES = (dx, dy) => `<circle cx="${7 - (dx || 0)}" cy="${8 + (dy || 0)}" r="1.1"/><circle cx="${13 + (dx || 0)}" cy="${8 + (dy || 0)}" r="1.1"/>`;
  const SMILE_ART = {
    smile: () => FACE(...Y) + EYES() + '<path d="M5.5 11.5q4.5 4.5 9 0" fill="none" stroke="#000" stroke-width="1.1" stroke-linecap="round"/>',
    laugh: () => FACE(...Y) + '<path d="M5 8q2-2 4 0M11 8q2-2 4 0" fill="none" stroke="#000" stroke-width="1.1" stroke-linecap="round"/><path d="M5 11h10q-1 5-5 5t-5-5z" fill="#6b1010" stroke="#000" stroke-width=".7"/><path d="M6 11.3h8l-.4 1.4H6.4z" fill="#fff"/>',
    wink: () => FACE(...Y) + '<circle cx="7" cy="8" r="1.1"/><path d="M11.5 8.2h3.5" stroke="#000" stroke-width="1.2" stroke-linecap="round"/><path d="M5.5 11.5q4.5 4.5 9 0" fill="none" stroke="#000" stroke-width="1.1" stroke-linecap="round"/>',
    sad: () => FACE(...Y) + EYES() + '<path d="M6 14.5q4-4 8 0" fill="none" stroke="#000" stroke-width="1.1" stroke-linecap="round"/>',
    cry: () => FACE(...Y) + EYES() + '<path d="M6 14.5q4-4 8 0" fill="none" stroke="#000" stroke-width="1.1" stroke-linecap="round"/><path d="M6.5 9.5q-1.3 3 0 3.6q1.3-.6 0-3.6z" fill="#3fa0ff" stroke="#1659a8" stroke-width=".4"/><path d="M13.5 9.5q-1.3 3 0 3.6q1.3-.6 0-3.6z" fill="#3fa0ff" stroke="#1659a8" stroke-width=".4"/>',
    tongue: () => FACE(...Y) + EYES() + '<path d="M5.5 11.5q4.5 4 9 0" fill="none" stroke="#000" stroke-width="1.1" stroke-linecap="round"/><path d="M9 13.2h4.2v2.2q0 2-2.1 2t-2.1-2z" fill="#ff5f8f" stroke="#a01a40" stroke-width=".6"/>',
    cool: () => FACE(...Y) + '<path d="M3.5 7.5h13" stroke="#000" stroke-width="1"/><rect x="4" y="7" width="5" height="3.5" rx="1" fill="#111"/><rect x="11" y="7" width="5" height="3.5" rx="1" fill="#111"/><path d="M6.5 13q4 2.5 7.5-.5" fill="none" stroke="#000" stroke-width="1.1" stroke-linecap="round"/>',
    surprise: () => FACE(...Y) + '<circle cx="7" cy="7.8" r="1.5"/><circle cx="13" cy="7.8" r="1.5"/><ellipse cx="10" cy="13.3" rx="2" ry="2.5" fill="#6b1010" stroke="#000" stroke-width=".7"/>',
    kiss: () => FACE(...Y) + '<circle cx="7" cy="8" r="1.1"/><path d="M11.5 8.2h3.5" stroke="#000" stroke-width="1.2" stroke-linecap="round"/><path d="M8.5 12.8q1.5-1.2 3 0q-1.5 1.6-3 0z" fill="#e02050" stroke="#7a0020" stroke-width=".5"/><path d="M14.2 12.6l1-1q1-.6 1.3.4q.2.9-2.3 2.3q-2.5-1.4-2.3-2.3q.3-1 1.3-.4z" fill="#e02050"/>',
    angry: () => FACE(...R) + '<path d="M4.5 5.5l4 1.8M15.5 5.5l-4 1.8" stroke="#000" stroke-width="1.2" stroke-linecap="round"/>' + EYES(0, .6) + '<path d="M6 14.5q4-3 8 0" fill="none" stroke="#000" stroke-width="1.1" stroke-linecap="round"/>',
    neutral: () => FACE(...Y) + EYES() + '<path d="M6 13.2h8" stroke="#000" stroke-width="1.1" stroke-linecap="round"/>',
    blush: () => FACE(...Y) + '<circle cx="5.5" cy="11" r="1.7" fill="#ff8aa0" opacity=".8"/><circle cx="14.5" cy="11" r="1.7" fill="#ff8aa0" opacity=".8"/>' + EYES(0, .8) + '<path d="M7.5 13.5q2.5 1.8 5 0" fill="none" stroke="#000" stroke-width="1" stroke-linecap="round"/>',
    heart: () => '<path d="M10 17.5L3.2 10.6A3.9 3.9 0 0 1 10 5.9a3.9 3.9 0 0 1 6.8 4.7z" fill="#e8203a" stroke="#7a0010" stroke-width=".8"/><path d="M6 7.5q1.5-1.8 3.2-.3" fill="none" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity=".8"/>',
    rose: () => '<path d="M10 18V9" stroke="#2f7d1e" stroke-width="1.3"/><path d="M10 13q-3-.5-4 2.5q3 .5 4-2.5zM10 11q3-.5 4 2.5q-3 .5-4-2.5z" fill="#4ca12c" stroke="#2f7d1e" stroke-width=".5"/><circle cx="10" cy="6.5" r="4.2" fill="#d8182e" stroke="#7a0010" stroke-width=".7"/><path d="M8 6q2-2.5 4 0q-1 2.5-4 1.5z" fill="#ff5c6c" opacity=".8"/>',
    beer: () => '<rect x="4" y="6" width="9" height="11" rx="1" fill="#f7b31c" stroke="#7a4a00" stroke-width=".8"/><path d="M13 8h2.5a1.5 1.5 0 0 1 0 3V13a1.5 1.5 0 0 1 0 3H13" fill="none" stroke="#7a4a00" stroke-width=".9"/><path d="M4 7q1-3 3-2q1-2.5 3.5-1.5q2-1 3 2.5v1H4z" fill="#fff" stroke="#999" stroke-width=".6"/><path d="M6.5 9v6M9 9v6M11.5 9v6" stroke="#fff" stroke-width=".7" opacity=".6"/>',
    zzz: () => FACE(...Y) + '<path d="M5 8.5q2 1.2 4 0M11 8.5q2 1.2 4 0" fill="none" stroke="#000" stroke-width="1.1" stroke-linecap="round"/><ellipse cx="10" cy="13.5" rx="1.3" ry="1" fill="#6b1010"/><text x="12.5" y="5" font-size="5.5" font-family="Tahoma,Verdana,sans-serif" font-weight="bold" fill="#1a3ea8">z</text><text x="15.3" y="3.5" font-size="3.8" font-family="Tahoma,Verdana,sans-serif" font-weight="bold" fill="#1a3ea8">z</text>',
    devil: () => '<path d="M3 3l3 4h-1zM17 3l-3 4h1z" fill="#8a1010"/>' + FACE(...R) + '<path d="M4.5 6.5l4 1.3M15.5 6.5l-4 1.3" stroke="#000" stroke-width="1.1" stroke-linecap="round"/>' + EYES(0, .8) + '<path d="M5.5 12q4.5 4 9 0" fill="#fff" stroke="#000" stroke-width=".9"/><path d="M6.5 12.3h7" stroke="#000" stroke-width=".4"/>',
    party: () => '<path d="M10 1.5l-3.5 7.5h7z" fill="#5a3df0" stroke="#2a1a90" stroke-width=".6"/><circle cx="10" cy="1.8" r="1" fill="#ffd21e"/>' + FACE(...Y) + EYES() + '<path d="M5.5 11.5q4.5 5 9 0z" fill="#6b1010" stroke="#000" stroke-width=".8"/><circle cx="3" cy="4" r=".9" fill="#ff5a3c"/><circle cx="17.5" cy="5" r=".9" fill="#1fa3e0"/><circle cx="2.5" cy="15" r=".8" fill="#3cb44a"/>',
    think: () => FACE(...Y) + '<path d="M11 5.8l3.5-.8" stroke="#000" stroke-width="1" stroke-linecap="round"/><circle cx="7" cy="8" r="1.1"/><circle cx="13" cy="8" r="1.1"/><path d="M7 13.2h6" stroke="#000" stroke-width="1.1" stroke-linecap="round"/><text x="14" y="5" font-size="6" font-family="Tahoma,Verdana,sans-serif" font-weight="bold" fill="#1a3ea8">?</text>',
    sick: () => FACE(...G) + '<path d="M5 7.5q2-1.5 4 0M11 7.5q2-1.5 4 0" fill="none" stroke="#000" stroke-width="1.1" stroke-linecap="round"/><path d="M6 13.5q1-1.2 2 0t2 0t2 0t2 0" fill="none" stroke="#000" stroke-width="1.1" stroke-linecap="round"/>',
    angel: () => '<ellipse cx="10" cy="3" rx="6" ry="1.6" fill="none" stroke="#f0c020" stroke-width="1.2"/>' + FACE(...Y) + '<path d="M5 8.5q2-1.4 4 0M11 8.5q2-1.4 4 0" fill="none" stroke="#000" stroke-width="1.1" stroke-linecap="round"/><path d="M6.5 12q3.5 3 7 0" fill="none" stroke="#000" stroke-width="1.1" stroke-linecap="round"/>',
    wine: () => '<g class="an-glass-l" style="transform-origin:6px 18px"><path d="M2 2h8l-1 7q-1 3-3 3t-3-3z" fill="#f7f2c0" stroke="#555" stroke-width=".6"/><path d="M2.6 4h6.8l-.6 4.5q-.8 2.3-2.8 2.3t-2.8-2.3z" fill="#fff7a8"/><path d="M6 12v5M3.5 18h5" stroke="#555" stroke-width=".9" stroke-linecap="round"/></g><g class="an-glass-r" style="transform-origin:14px 18px"><path d="M10 2h8l-1 7q-1 3-3 3t-3-3z" fill="#c62a3a" stroke="#555" stroke-width=".6"/><path d="M10.6 4h6.8l-.6 4.5q-.8 2.3-2.8 2.3t-2.8-2.3z" fill="#8a0f1f"/><path d="M14 12v5M11.5 18h5" stroke="#555" stroke-width=".9" stroke-linecap="round"/></g><g class="an-spark"><path d="M10 1l.6 1.6L12.2 3l-1.6.6L10 5.2l-.6-1.6L7.8 3l1.6-.4z" fill="#ffd21e"/></g>',
    heart2: () => '<g class="an-heart" style="transform-origin:10px 10px"><path d="M10 17.5L3.2 10.6A3.9 3.9 0 0 1 10 5.9a3.9 3.9 0 0 1 6.8 4.7z" fill="#ff2d55" stroke="#9a0025" stroke-width=".7"/><path d="M6 7.5q1.5-1.8 3.2-.3" fill="none" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity=".85"/></g><g class="an-spark"><circle cx="3" cy="4" r="1" fill="#ffb6c1"/><circle cx="17" cy="5" r="1.2" fill="#ffb6c1"/><circle cx="16" cy="15" r=".9" fill="#ffd21e"/><circle cx="4" cy="14" r=".8" fill="#ffd21e"/></g>',
    shock: () => FACE(...Y) + '<path d="M4.5 5.5l4-1M15.5 5.5l-4-1" stroke="#000" stroke-width="1" stroke-linecap="round"/><circle cx="7" cy="8" r="1.9" fill="#fff" stroke="#000" stroke-width=".7"/><circle cx="13" cy="8" r="1.9" fill="#fff" stroke="#000" stroke-width=".7"/><circle cx="7" cy="8" r=".9"/><circle cx="13" cy="8" r=".9"/><ellipse cx="10" cy="13.8" rx="3" ry="2.6" fill="#6b1010" stroke="#000" stroke-width=".7"/>',
  };
  function smileSvg(id, size) {
    const art = SMILE_ART[id];
    if (!art) return '';
    return `<svg viewBox="0 0 20 20" width="${size || 18}" height="${size || 18}" aria-hidden="true">${art()}</svg>`;
  }


  /* ---------- открытки (анимация — в styles.css) ---------- */
  function postcardSvg(kind) {
    if (artStyle === 'boomer') return postcardBoomer(kind);
    const paper = (bg) => `<rect width="200" height="120" fill="${bg}"/>`;
    const fl = (color, cx, cy, s) => `<g transform="translate(${cx - 8 * s},${cy - 8 * s}) scale(${s})">${flowerInner(color)}</g>`;
    const label = (text, color, x, y, anchor) => `<text x="${x}" y="${y}" font-family="Tahoma,Verdana,sans-serif" font-weight="bold" font-size="11" fill="${color || '#0a246a'}" text-anchor="${anchor || 'start'}">${text}</text>`;
    const heart = (cx, cy, s, fill) => `<path transform="translate(${cx},${cy}) scale(${s})" d="M0 9L-8.5 .4A4.6 4.6 0 0 1 0-5.3a4.6 4.6 0 0 1 8.5 5.7z" fill="${fill}" stroke="#7a0010" stroke-width=".6"/>`;
    let body = '';
    switch (kind) {
      case 'flowers':
        body = paper('#fdf3dc') + `<g class="sway" style="transform-origin:100px 118px">
          <path d="M100 118C100 92 82 74 62 50M100 118C100 88 100 66 100 42M100 118C100 92 118 74 138 50" stroke="#3a8a2a" stroke-width="3" fill="none" stroke-linecap="round"/>
          <path d="M92 92q-18-2-22-20q16 2 22 20zM108 86q18-2 22-20q-16 2-22 20z" fill="#4ca12c" stroke="#2f7d1e" stroke-width=".6"/>
          ${fl('#d8232a', 62, 48, 2.1)}${fl('#3cb44a', 100, 40, 2.3)}${fl('#1fa3e0', 138, 48, 2.1)}</g>
          <path d="M84 110q16-12 32 0q-16 12-32 0z" fill="#e8203a" stroke="#7a0010" stroke-width=".6"/><circle cx="100" cy="110" r="4.5" fill="#ff7a8a" stroke="#7a0010" stroke-width=".6"/>
          ${label('тебе!', '#b01818', 168, 112, 'end')}`;
        break;
      case 'sun':
        body = paper('#8ec7ff') + `<g class="rays" style="transform-origin:150px 38px">${Array.from({ length: 12 }, (_, i) => { const a = (i * Math.PI) / 6; return `<line x1="${(150 + 24 * Math.cos(a)).toFixed(1)}" y1="${(38 + 24 * Math.sin(a)).toFixed(1)}" x2="${(150 + 36 * Math.cos(a)).toFixed(1)}" y2="${(38 + 36 * Math.sin(a)).toFixed(1)}" stroke="#ffd21e" stroke-width="3" stroke-linecap="round"/>`; }).join('')}</g>
          <circle cx="150" cy="38" r="19" fill="#ffd21e" stroke="#c98a00" stroke-width="1"/><circle cx="144" cy="35" r="1.6"/><circle cx="156" cy="35" r="1.6"/><path d="M143 43q7 6 14 0" fill="none" stroke="#000" stroke-width="1.2" stroke-linecap="round"/>
          <g class="drift"><ellipse cx="55" cy="40" rx="24" ry="10" fill="#fff"/><ellipse cx="42" cy="46" rx="16" ry="8" fill="#fff"/><ellipse cx="70" cy="46" rx="14" ry="7" fill="#fff"/></g>
          <path d="M0 120Q50 72 110 100T200 88V120z" fill="#9bd14a"/><path d="M0 120Q70 96 140 112T200 104V120z" fill="#4ca12c"/>
          ${fl('#d8232a', 40, 104, 1.1)}${fl('#1fa3e0', 70, 110, .9)}${label('Доброе утро!', '#0a246a', 10, 22)}`;
        break;
      case 'heart':
        body = paper('#ffe3ea') + `<g class="beat" style="transform-origin:100px 58px">${heart(100, 58, 5, '#e8203a')}<path d="M86 48q6-8 14-4" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/></g>
          ${[30, 55, 150, 172].map((x, i) => `<g class="rise" style="animation-delay:${i * .7}s">${heart(x, 108, 1.4, '#ff6b8a')}</g>`).join('')}
          ${label('от всего цветочка', '#b01818', 100, 112, 'middle')}`;
        break;
      case 'star':
        body = paper('#0a246a') + [[20, 18, 1.6, 0], [48, 40, 1, .4], [76, 14, 1.3, .8], [120, 30, 1, .2], [170, 16, 1.8, .6], [186, 52, 1, 1], [100, 60, 1.2, .3], [34, 70, 1, .9], [150, 70, 1.4, .5], [64, 92, 1, .7]].map(([x, y, r, d]) => `<circle class="tw" cx="${x}" cy="${y}" r="${r}" fill="#fff" style="animation-delay:${d}s"/>`).join('') +
          `<circle cx="150" cy="42" r="18" fill="#ffe14d"/><circle cx="158" cy="36" r="16" fill="#0a246a"/>
          <path d="M0 120Q40 100 80 110T160 104T200 112V120z" fill="#061640"/><rect x="20" y="96" width="14" height="24" fill="#061640"/><rect x="24" y="100" width="3" height="3" fill="#ffe14d"/><rect x="29" y="106" width="3" height="3" fill="#ffe14d"/>
          ${label('Спокойной ночи', '#fff', 10, 24)}<text x="12" y="40" font-family="Tahoma,Verdana,sans-serif" font-size="9" fill="#a6caf0">z z z…</text>`;
        break;
      case 'cake':
        body = paper('#fff5f8') + `<ellipse cx="100" cy="104" rx="60" ry="9" fill="#ddd" stroke="#999" stroke-width=".6"/>
          <rect x="52" y="78" width="96" height="26" rx="3" fill="#f7b3c8" stroke="#a0405a" stroke-width=".7"/><rect x="62" y="56" width="76" height="24" rx="3" fill="#ffe4ec" stroke="#a0405a" stroke-width=".7"/>
          <path d="M62 60q8 10 16 0t16 0t16 0t16 0t12 0v6H62z" fill="#e8203a" opacity=".85"/><path d="M52 82q8 10 16 0t16 0t16 0t16 0t16 0t16 0v6H52z" fill="#e8203a" opacity=".85"/>
          <rect x="97" y="34" width="6" height="22" fill="#4aa3ff" stroke="#1659a8" stroke-width=".5"/><g class="flicker" style="transform-origin:100px 34px"><ellipse cx="100" cy="27" rx="4" ry="7" fill="#ffb21e"/><ellipse cx="100" cy="29" rx="2" ry="4" fill="#fff3a0"/></g>
          ${[[20, '#1fa3e0', 0], [40, '#3cb44a', .5], [160, '#ffd21e', .2], [180, '#e8203a', .8], [30, '#e8203a', 1.1], [172, '#1fa3e0', .4]].map(([x, c, d]) => `<circle class="rise" cx="${x}" cy="100" r="3" fill="${c}" style="animation-delay:${d}s"/>`).join('')}
          ${label('Ура!', '#b01818', 100, 20, 'middle')}`;
        break;
      case 'cat':
        body = paper('#fff8e1') + `<g class="wag" style="transform-origin:138px 96px"><path d="M138 96q26-6 30-30" stroke="#8a8a8a" stroke-width="7" fill="none" stroke-linecap="round"/></g>
          <ellipse cx="100" cy="92" rx="42" ry="22" fill="#9a9a9a" stroke="#444" stroke-width=".8"/>
          <path d="M62 56l6-24 16 14zM138 56l-6-24-16 14z" fill="#9a9a9a" stroke="#444" stroke-width=".8"/><path d="M68 50l3-12 8 7zM132 50l-3-12-8 7z" fill="#f4a7b9"/>
          <circle cx="100" cy="60" r="30" fill="#9a9a9a" stroke="#444" stroke-width=".8"/>
          <g class="blink-eye" style="transform-origin:100px 56px"><ellipse cx="88" cy="56" rx="5" ry="6" fill="#ffe14d" stroke="#444" stroke-width=".6"/><ellipse cx="112" cy="56" rx="5" ry="6" fill="#ffe14d" stroke="#444" stroke-width=".6"/><ellipse cx="88" cy="56" rx="1.6" ry="5"/><ellipse cx="112" cy="56" rx="1.6" ry="5"/></g>
          <path d="M96 66h8l-4 4z" fill="#f4a7b9" stroke="#444" stroke-width=".5"/><path d="M100 70v4m0 0q-5 4-9 0m9 0q5 4 9 0" fill="none" stroke="#444" stroke-width="1"/>
          <path d="M60 64h24M60 70l24-2M140 64h-24M140 70l-24-2" stroke="#444" stroke-width=".8"/>
          ${label('мяу', '#444', 160, 40, 'middle')}`;
        break;
      case 'trip':
        body = paper('#bfe3ff') + `<g class="drift"><ellipse cx="40" cy="80" rx="26" ry="9" fill="#fff"/><ellipse cx="160" cy="30" rx="22" ry="8" fill="#fff"/><ellipse cx="172" cy="36" rx="14" ry="6" fill="#fff"/></g>
          <g class="planefly"><g transform="translate(0,50)"><path d="M0 0h40l10-4-3 6 3 6-10-4H0z" fill="#fff" stroke="#333" stroke-width="1"/><path d="M12 0l-8-12h8l10 12zM12 4l-8 12h8l10-12z" fill="#d8232a" stroke="#333" stroke-width=".7"/><circle cx="36" cy="2" r="1.6" fill="#1fa3e0"/><circle cx="30" cy="2" r="1.6" fill="#1fa3e0"/><circle cx="24" cy="2" r="1.6" fill="#1fa3e0"/></g></g>
          <path d="M0 120Q60 100 100 108T200 100V120z" fill="#9bd14a"/><rect x="150" y="90" width="22" height="30" fill="#f7b31c" stroke="#7a4a00" stroke-width=".8"/><rect x="156" y="84" width="10" height="6" fill="none" stroke="#7a4a00" stroke-width="1.2"/>
          ${label('летим!', '#0a246a', 12, 112)}`;
        break;
      case 'roses':
        body = paper('#fff0f3') + `<g class="sway" style="transform-origin:100px 118px"><path d="M100 118C98 92 84 76 70 58M100 118C100 90 100 72 100 50M100 118C102 92 116 76 130 58" stroke="#2f7d1e" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M88 96q-16-2-20-18q14 2 20 18zM112 90q16-2 20-18q-14 2-20 18z" fill="#4ca12c" stroke="#2f7d1e" stroke-width=".6"/>${[[70, 56], [100, 46], [130, 56], [85, 68], [115, 68]].map(([x, y]) => `<g transform="translate(${x},${y})"><circle r="11" fill="#d8182e" stroke="#7a0010" stroke-width=".8"/><path d="M-6 -2q6-7 12 0q-3 7-9 4z" fill="#ff5c6c" opacity=".8"/><path d="M-3 3q3-4 6 0" fill="none" stroke="#7a0010" stroke-width=".7"/></g>`).join('')}</g><path d="M82 112q18-12 36 0q-18 12-36 0z" fill="#ffd21e" stroke="#806a00" stroke-width=".6"/>${label('с любовью', '#b01818', 100, 112, 'middle')}`;
        break;
      case 'candle':
        body = paper('#2a1030') + `<rect x="0" y="80" width="200" height="40" fill="#5a2a3a"/><ellipse cx="100" cy="84" rx="70" ry="12" fill="#f3e9d2" stroke="#999" stroke-width=".6"/>
          <rect x="97" y="40" width="6" height="36" fill="#fff5d0" stroke="#999" stroke-width=".5"/><g class="flicker" style="transform-origin:100px 40px"><ellipse cx="100" cy="33" rx="4" ry="7" fill="#ffb21e"/><ellipse cx="100" cy="35" rx="2" ry="4" fill="#fff3a0"/></g><circle cx="100" cy="36" r="22" fill="#ffb21e" opacity=".12"/>
          <g transform="translate(60,52)"><path d="M0 0h18l-2 16q-2 7-7 7t-7-7z" fill="#f7f2c0" stroke="#999" stroke-width=".6"/><path d="M9 23v9M3 33h12" stroke="#999" stroke-width="1"/></g><g transform="translate(122,52)"><path d="M0 0h18l-2 16q-2 7-7 7t-7-7z" fill="#c62a3a" stroke="#999" stroke-width=".6"/><path d="M9 23v9M3 33h12" stroke="#999" stroke-width="1"/></g>
          ${[[30, 20], [170, 24], [20, 60], [180, 62]].map(([x, y], i) => `<g class="rise" style="animation-delay:${i * .6}s">${heart(x, y + 50, 1.2, '#ff6b8a')}</g>`).join('')}${label('ужин при свечах', '#ffd9a0', 100, 20, 'middle')}`;
        break;
      case 'kiss':
        body = paper('#ffe3ea') + `<g class="beat" style="transform-origin:100px 62px"><path d="M60 62q20-22 40-6q20-16 40 6q-20 24-40 14q-20 10-40-14z" fill="#e02050" stroke="#7a0020" stroke-width="1"/><path d="M60 62q40 6 80 0" fill="none" stroke="#7a0020" stroke-width="1.2"/><path d="M78 52q10-6 20 2q10-8 20-2" fill="none" stroke="#ff7a9a" stroke-width="2" opacity=".7"/></g>
          ${[[25, 108], [50, 112], [150, 110], [176, 106]].map(([x, y], i) => `<g class="rise" style="animation-delay:${i * .7}s">${heart(x, y, 1.5, '#ff6b8a')}</g>`).join('')}${label('чмок!', '#b01818', 100, 110, 'middle')}`;
        break;
      case 'couple':
        body = paper('#1b1b4a') + [[20, 18, 1.4, 0], [60, 10, 1, .4], [140, 14, 1.2, .8], [180, 30, 1, .2], [100, 22, 1, .6], [40, 40, 1, 1]].map(([x, y, r, d]) => `<circle class="tw" cx="${x}" cy="${y}" r="${r}" fill="#fff" style="animation-delay:${d}s"/>`).join('') + `<circle cx="160" cy="36" r="16" fill="#ffe14d"/><circle cx="167" cy="31" r="14" fill="#1b1b4a"/>
          <path d="M0 120Q50 96 100 104T200 96V120z" fill="#0d0d30"/><path d="M78 118V84q0-10 8-10t8 10v34zM106 118V86q0-10 8-10t8 10v32z" fill="#000"/><circle cx="86" cy="68" r="7" fill="#000"/><circle cx="114" cy="70" r="7" fill="#000"/><path d="M94 90q6-6 12 0" stroke="#000" stroke-width="3" fill="none" stroke-linecap="round"/>
          <g class="beat" style="transform-origin:100px 52px">${heart(100, 52, 1.8, '#ff2d55')}</g>${label('только ты и я', '#ffd9e6', 100, 112, 'middle')}`;
        break;
      case 'tea':
        body = paper('#f3e9d2') + `<ellipse cx="100" cy="104" rx="56" ry="8" fill="#ddd" stroke="#999" stroke-width=".6"/>
          <path d="M60 58h80v24q0 20-20 20H80q-20 0-20-20z" fill="#fff" stroke="#555" stroke-width="1"/><path d="M140 64h10a10 10 0 0 1 0 20h-10" fill="none" stroke="#555" stroke-width="2.2"/>
          <ellipse cx="100" cy="58" rx="40" ry="7" fill="#c8862a" stroke="#555" stroke-width="1"/><ellipse cx="100" cy="58" rx="34" ry="5" fill="#e0a040"/>
          <g class="steam" style="animation-delay:0s"><path d="M80 48q-6-8 0-14t0-12" fill="none" stroke="#999" stroke-width="2" stroke-linecap="round"/></g><g class="steam" style="animation-delay:.8s"><path d="M100 46q-6-8 0-14t0-12" fill="none" stroke="#999" stroke-width="2" stroke-linecap="round"/></g><g class="steam" style="animation-delay:1.6s"><path d="M120 48q-6-8 0-14t0-12" fill="none" stroke="#999" stroke-width="2" stroke-linecap="round"/></g>
          <rect x="22" y="80" width="26" height="14" rx="3" fill="#d9a066" stroke="#7a4a00" stroke-width=".7"/><circle cx="29" cy="87" r="1.2" fill="#7a4a00"/><circle cx="35" cy="87" r="1.2" fill="#7a4a00"/><circle cx="41" cy="87" r="1.2" fill="#7a4a00"/>
          ${label('чай-пауза', '#7a4a00', 100, 20, 'middle')}`;
        break;
      default:
        body = paper('#fff') + fl('#3cb44a', 100, 60, 3);
    }
    return `<svg viewBox="0 0 200 120" aria-hidden="true">${body}</svg>`;
  }

  /* ---------- магниты на холодильник ---------- */
  const COUNTRIES = [
    { code: 'TR', in: 'в Турции', from: 'из Турции', name: 'Турция', to: 'в Турцию', flag: '🇹🇷', icon: '🕌', colors: ['#e30a17', '#ffffff'] },
    { code: 'EG', in: 'в Египте', from: 'из Египта', name: 'Египет', to: 'в Египет', flag: '🇪🇬', icon: '🐫', colors: ['#ce1126', '#ffffff', '#111111'] },
    { code: 'IT', in: 'в Италии', from: 'из Италии', name: 'Италия', to: 'в Италию', flag: '🇮🇹', icon: '🍕', colors: ['#009246', '#ffffff', '#ce2b37'] },
    { code: 'FR', in: 'во Франции', from: 'из Франции', name: 'Франция', to: 'во Францию', flag: '🇫🇷', icon: '🗼', colors: ['#0055a4', '#ffffff', '#ef4135'] },
    { code: 'ES', in: 'в Испании', from: 'из Испании', name: 'Испания', to: 'в Испанию', flag: '🇪🇸', icon: '💃', colors: ['#aa151b', '#f1bf00', '#aa151b'] },
    { code: 'GR', in: 'в Греции', from: 'из Греции', name: 'Греция', to: 'в Грецию', flag: '🇬🇷', icon: '🏛️', colors: ['#0d5eaf', '#ffffff', '#0d5eaf'] },
    { code: 'TH', in: 'в Таиланде', from: 'из Таиланда', name: 'Таиланд', to: 'в Таиланд', flag: '🇹🇭', icon: '🌴', colors: ['#a51931', '#ffffff', '#2d2a4a'] },
    { code: 'AE', in: 'в ОАЭ', from: 'из ОАЭ', name: 'ОАЭ', to: 'в ОАЭ', flag: '🇦🇪', icon: '🏙️', colors: ['#00732f', '#ffffff', '#111111'] },
    { code: 'JP', in: 'в Японии', from: 'из Японии', name: 'Япония', to: 'в Японию', flag: '🇯🇵', icon: '🗻', colors: ['#ffffff', '#bc002d', '#ffffff'] },
    { code: 'US', in: 'в США', from: 'из США', name: 'США', to: 'в США', flag: '🇺🇸', icon: '🗽', colors: ['#3c3b6e', '#ffffff', '#b22234'] },
    { code: 'DE', in: 'в Германии', from: 'из Германии', name: 'Германия', to: 'в Германию', flag: '🇩🇪', icon: '🍺', colors: ['#111111', '#dd0000', '#ffce00'] },
    { code: 'CZ', in: 'в Чехии', from: 'из Чехии', name: 'Чехия', to: 'в Чехию', flag: '🇨🇿', icon: '🏰', colors: ['#11457e', '#ffffff', '#d7141a'] },
    { code: 'CY', in: 'на Кипре', from: 'с Кипра', name: 'Кипр', to: 'на Кипр', flag: '🇨🇾', icon: '🐱', colors: ['#ffffff', '#d57800', '#ffffff'] },
    { code: 'GE', in: 'в Грузии', from: 'из Грузии', name: 'Грузия', to: 'в Грузию', flag: '🇬🇪', icon: '🍷', colors: ['#ffffff', '#ff0000', '#ffffff'] },
    { code: 'AM', in: 'в Армении', from: 'из Армении', name: 'Армения', to: 'в Армению', flag: '🇦🇲', icon: '⛰️', colors: ['#d90012', '#0033a0', '#f2a800'] },
    { code: 'KZ', in: 'в Казахстане', from: 'из Казахстана', name: 'Казахстан', to: 'в Казахстан', flag: '🇰🇿', icon: '🦅', colors: ['#00afca', '#fec50c'] },
    { code: 'BY', in: 'в Беларуси', from: 'из Беларуси', name: 'Беларусь', to: 'в Беларусь', flag: '🇧🇾', icon: '🥔', colors: ['#c8313e', '#4aa657'] },
    { code: 'CN', in: 'в Китае', from: 'из Китая', name: 'Китай', to: 'в Китай', flag: '🇨🇳', icon: '🐼', colors: ['#de2910', '#ffde00'] },
    { code: 'IN', in: 'в Индии', from: 'из Индии', name: 'Индия', to: 'в Индию', flag: '🇮🇳', icon: '🐘', colors: ['#ff9933', '#ffffff', '#138808'] },
    { code: 'BR', in: 'в Бразилии', from: 'из Бразилии', name: 'Бразилия', to: 'в Бразилию', flag: '🇧🇷', icon: '⚽', colors: ['#009c3b', '#ffdf00'] },
    { code: 'MV', in: 'на Мальдивах', from: 'с Мальдив', name: 'Мальдивы', to: 'на Мальдивы', flag: '🇲🇻', icon: '🏝️', colors: ['#d21034', '#007e3a'] },
    { code: 'VN', in: 'во Вьетнаме', from: 'из Вьетнама', name: 'Вьетнам', to: 'во Вьетнам', flag: '🇻🇳', icon: '🍜', colors: ['#da251d', '#ffff00'] },
    { code: 'GB', in: 'в Британии', from: 'из Британии', name: 'Британия', to: 'в Британию', flag: '🇬🇧', icon: '☕', colors: ['#012169', '#ffffff', '#c8102e'] },
    { code: 'RU', in: 'в Сочи', from: 'из Сочи', name: 'Сочи', to: 'в Сочи', flag: '🇷🇺', icon: '🏖️', colors: ['#ffffff', '#0039a6', '#d52b1e'] },
    { code: 'UR', in: 'в Урюпинске', from: 'из Урюпинска', name: 'Урюпинск', to: 'в Урюпинск', flag: '🏘️', icon: '🐐', colors: ['#8fbc8f', '#f5deb3'] },
    { code: 'AQ', in: 'в Антарктиде', from: 'из Антарктиды', name: 'Антарктида', to: 'в Антарктиду', flag: '🐧', icon: '🐧', colors: ['#e8f4ff', '#9ec9ff'] },
    { code: 'MOON', in: 'на Луне', from: 'с Луны', name: 'Луна', to: 'на Луну', flag: '🌙', icon: '🚀', colors: ['#1a1a2e', '#c0c0c0'], tier: 'black' },
  ];
  const COUNTRY = {};
  COUNTRIES.forEach((c) => (COUNTRY[c.code] = c));
  const hashOf = (str) => { let h = 2166136261; for (let i = 0; i < String(str).length; i++) { h ^= String(str).charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };
  const escT = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // магнит на холодильник: форма зависит от страны, флаг, достопримечательность, табличка с именем, блик и номер НФТ
  function magnetSvg(code, size, opts) {
    if (artStyle === 'boomer') return magnetBoomer(code, size, opts);
    opts = opts || {};
    const c = COUNTRY[code] || COUNTRY.UR;
    const sz = size || 64; const h = hashOf(code);
    const shape = c.tier === 'black' ? 'star' : ['plate', 'badge', 'shield', 'oval'][h % 4];
    const n = c.colors.length, sh = 64 / n;
    const stripes = c.colors.map((col, i) => `<rect x="0" y="${(i * sh).toFixed(1)}" width="64" height="${(sh + 0.5).toFixed(1)}" fill="${col}"/>`).join('');
    const cid = 'mg' + code + shape;
    const path = shape === 'plate' ? '<rect x="2" y="2" width="60" height="60" rx="9"/>' : shape === 'badge' ? '<circle cx="32" cy="32" r="30"/>' : shape === 'shield' ? '<path d="M32 2 L60 10 V34 C60 50 46 60 32 62 C18 60 4 50 4 34 V10 Z"/>' : shape === 'oval' ? '<ellipse cx="32" cy="32" rx="30" ry="27"/>' : '<path d="M32 2 L40 22 L62 24 L45 38 L50 60 L32 48 L14 60 L19 38 L2 24 L24 22 Z"/>';
    const inner = shape === 'badge' || shape === 'oval' ? `<circle cx="32" cy="30" r="18" fill="#fff" stroke="#222" stroke-width="1.2"/>` : shape === 'star' ? `<circle cx="32" cy="33" r="13" fill="#fff" stroke="#222" stroke-width="1.2"/>` : `<rect x="10" y="14" width="44" height="32" rx="5" fill="#fff" stroke="#222" stroke-width="1.2"/>`;
    const iconY = shape === 'star' ? 39 : 36, iconSize = shape === 'star' ? 15 : 20;
    const plate = shape === 'star' ? `<rect x="14" y="48" width="36" height="9" rx="3" fill="#ffe14d" stroke="#806a00" stroke-width=".8"/><text x="32" y="55" font-size="6.5" text-anchor="middle" font-family="Tahoma,Verdana,sans-serif" font-weight="bold" fill="#222">${escT(c.name)}</text>` : `<rect x="8" y="49" width="48" height="10" rx="3" fill="rgba(255,255,255,.92)" stroke="#222" stroke-width=".6"/><text x="32" y="57" font-size="7.5" text-anchor="middle" font-family="Tahoma,Verdana,sans-serif" font-weight="bold" fill="#222">${escT(c.name)}</text>`;
    const gloss = `<path d="M8 10 Q32 0 56 10 Q40 14 8 10 Z" fill="#fff" opacity=".35"/>`;
    const screws = shape === 'plate' ? '<circle cx="8" cy="8" r="1.6" fill="#999" stroke="#333" stroke-width=".5"/><circle cx="56" cy="8" r="1.6" fill="#999" stroke="#333" stroke-width=".5"/>' : '';
    const serial = opts.serial ? `<rect x="36" y="2" width="26" height="7" rx="2" fill="#222"/><text x="49" y="7.5" font-size="5" text-anchor="middle" font-family="Tahoma,Verdana,sans-serif" fill="#ffe14d">${escT(opts.serial)}</text>` : '';
    return `<svg viewBox="0 0 64 64" width="${sz}" height="${sz}" aria-hidden="true"><defs><clipPath id="${cid}">${path}</clipPath></defs>
      <g clip-path="url(#${cid})">${stripes}${c.tier === 'black' ? '<rect width="64" height="64" fill="#111" opacity=".55"/>' : ''}</g>
      <g fill="none" stroke="#222" stroke-width="2">${path}</g>
      ${inner}<text x="32" y="${iconY}" font-size="${iconSize}" text-anchor="middle" font-family="'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif">${c.icon}</text>
      ${plate}${screws}${gloss}${serial}</svg>`;
  }
  /* ================= «Бумер»: торжественные открытки и коллекционные магниты =================
     Классическая поздравительная открытка: глубокий цвет, золотая рамка с вензелями
     по углам, золотая надпись с засечками и «блёстки». Магнит — фарфоровый сувенир
     в золотом овале с лавровой ветвью и лентой с названием. */
  let artStyle = 'default';
  const setStyle = (s) => { artStyle = s === 'boomer' ? 'boomer' : 'default'; };
  const SERIF = "Georgia,'Times New Roman',Times,serif";
  const GOLD_DEF = '<linearGradient id="bmGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff4c2"/><stop offset=".42" stop-color="#e7bf55"/><stop offset=".58" stop-color="#b07d12"/><stop offset="1" stop-color="#f3d36f"/></linearGradient>'
    + '<linearGradient id="bmGoldH" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9c6b0c"/><stop offset=".5" stop-color="#ffe9a3"/><stop offset="1" stop-color="#9c6b0c"/></linearGradient>'
    + '<radialGradient id="bmVig" cx=".5" cy=".45" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient>';
  // вензель в углу рамки
  const curl = (x, y, sx, sy) => `<g transform="translate(${x},${y}) scale(${sx},${sy})" fill="none" stroke="url(#bmGold)" stroke-width="1.1" stroke-linecap="round"><path d="M0 14 C0 4 4 0 14 0"/><path d="M4 12 C5 6 7 5 12 4"/><circle cx="3.2" cy="3.2" r="1.6" fill="url(#bmGold)" stroke="none"/><path d="M14 0 q4 0 6 3 M0 14 q0 4 3 6"/></g>`;
  const frame = () => `<rect x="5" y="5" width="190" height="110" rx="3" fill="none" stroke="url(#bmGold)" stroke-width="2"/><rect x="9.5" y="9.5" width="181" height="101" rx="2" fill="none" stroke="url(#bmGold)" stroke-width=".7" opacity=".9"/>${curl(12, 12, 1, 1)}${curl(188, 12, -1, 1)}${curl(12, 108, 1, -1)}${curl(188, 108, -1, -1)}`;
  const sparkle = (x, y, s) => `<path transform="translate(${x},${y}) scale(${s || 1})" d="M0-4 L.9-.9 L4 0 L.9 .9 L0 4 L-.9 .9 L-4 0 L-.9-.9 Z" fill="#fff6cf"/>`;
  const sparkles = (pts) => `<g class="bm-spark">${pts.map(([x, y, s]) => sparkle(x, y, s)).join('')}</g>`;
  // надпись золотом с тенью; длинная — в две строки
  const title = (text, y, size, color) => {
    const lines = Array.isArray(text) ? text : [text];
    return lines.map((t, i) => `<text x="100" y="${y + i * (size + 2)}" text-anchor="middle" font-family="${SERIF}" font-style="italic" font-weight="bold" font-size="${size}" fill="#000" opacity=".35" transform="translate(.8,.9)">${t}</text><text x="100" y="${y + i * (size + 2)}" text-anchor="middle" font-family="${SERIF}" font-style="italic" font-weight="bold" font-size="${size}" fill="${color || 'url(#bmGold)'}">${t}</text>`).join('');
  };
  const sub = (text, y, color) => `<text x="100" y="${y}" text-anchor="middle" font-family="${SERIF}" font-size="6.5" letter-spacing="1.6" fill="${color || '#f3e6c4'}">${text}</text>`;
  const bg = (c1, c2) => `<defs><linearGradient id="bmBg${c1.slice(1)}${c2.slice(1)}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="200" height="120" fill="url(#bmBg${c1.slice(1)}${c2.slice(1)})"/><rect width="200" height="120" fill="url(#bmVig)"/>`;
  // роза: чаша из лепестков
  const rose = (cx, cy, r, c, d) => `<g transform="translate(${cx},${cy})"><circle r="${r}" fill="${c}"/><path d="M${-r * .95} ${r * .15} Q0 ${r * 1.2} ${r * .95} ${r * .15}" fill="${d}" opacity=".45"/><path d="M${-r * .12} ${-r * .05} a${r * .16} ${r * .16} 0 1 1 ${r * .28} ${r * .1} a${r * .36} ${r * .36} 0 1 1 ${-r * .66} ${-r * .14} a${r * .6} ${r * .6} 0 1 1 ${r * 1.06} ${r * .3}" fill="none" stroke="${d}" stroke-width="${(r * .13).toFixed(2)}" stroke-linecap="round"/><path d="M${-r * .55} ${-r * .55} q${r * .35} ${-r * .25} ${r * .7} 0" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="${(r * .1).toFixed(2)}" stroke-linecap="round"/></g>`;
  const leaf = (x, y, a, s) => `<path transform="translate(${x},${y}) rotate(${a}) scale(${s || 1})" d="M0 0 Q6 -5 14 0 Q6 5 0 0Z" fill="#2f6b2a" stroke="#1d4a1a" stroke-width=".5"/>`;
  function postcardBoomer(kind) {
    let body = '';
    switch (kind) {
      case 'flowers':
        body = bg('#5c1420', '#2b070c') + `<path d="M100 104 C98 88 92 76 80 66 M100 104 C100 86 100 74 100 62 M100 104 C102 88 108 76 120 66" stroke="#2f6b2a" stroke-width="2.2" fill="none"/>${leaf(88, 86, -150, 1.1)}${leaf(112, 84, -30, 1.1)}${rose(80, 62, 10, '#c8102e', '#7d0a1c')}${rose(120, 62, 10, '#c8102e', '#7d0a1c')}${rose(100, 54, 12, '#e0283f', '#8a0b20')}<path d="M90 98 l10 8 l10 -8 l-4 12 h-12 z" fill="url(#bmGold)"/>`
          + title(['С наилучшими', 'пожеланиями'], 26, 13) + sparkles([[40, 50, 1], [160, 46, .8], [52, 86, .7], [150, 88, 1]]);
        break;
      case 'sun':
        body = bg('#1d3557', '#f0a35e') + `<circle cx="100" cy="92" r="26" fill="#ffd36b"/><g stroke="#ffe7a3" stroke-width="1.4" opacity=".85">${Array.from({ length: 11 }, (_, i) => { const a = Math.PI + (i * Math.PI) / 10; return `<line x1="${(100 + 31 * Math.cos(a)).toFixed(1)}" y1="${(92 + 31 * Math.sin(a)).toFixed(1)}" x2="${(100 + 42 * Math.cos(a)).toFixed(1)}" y2="${(92 + 42 * Math.sin(a)).toFixed(1)}"/>`; }).join('')}</g><path d="M0 96 Q60 84 100 94 T200 92 V120 H0Z" fill="#24402a"/><path d="M0 104 Q70 96 120 104 T200 102 V120 H0Z" fill="#1a2f1f"/><path d="M40 66 q4 -3 8 0 q4 -3 8 0" stroke="#1d1d1d" stroke-width="1" fill="none"/><path d="M150 60 q3 -2 6 0 q3 -2 6 0" stroke="#1d1d1d" stroke-width="1" fill="none"/>`
          + title('Доброе утро!', 30, 18) + sub('ХОРОШЕГО ВАМ ДНЯ', 44);
        break;
      case 'heart':
        body = bg('#10392b', '#06170f') + `<g transform="translate(100,68)"><path d="M0 22 L-24 -1 A13 13 0 0 1 0 -15 A13 13 0 0 1 24 -1 Z" fill="url(#bmGold)" stroke="#7a5a10" stroke-width="1"/><path d="M-12 -4 q6 -8 12 -2" stroke="#fff6cf" stroke-width="1.6" fill="none" opacity=".7"/></g>${[-1, 1].map((d) => `<g transform="translate(${100 + d * 40},70) scale(${d},1)">${[0, 1, 2, 3, 4].map((i) => `<ellipse cx="${-i * 3}" cy="${-16 + i * 8}" rx="2.4" ry="5" transform="rotate(${-30 + i * 14} ${-i * 3} ${-16 + i * 8})" fill="#c9a227"/>`).join('')}</g>`).join('')}`
          + title('С теплом и уважением', 30, 14) + sparkles([[60, 48, .9], [140, 50, 1], [70, 96, .7], [132, 98, .8]]);
        break;
      case 'star':
        body = bg('#0b1633', '#1d2b55') + `<path d="M108 44 a21 21 0 1 0 0 40 a16 16 0 1 1 0 -40z" fill="url(#bmGold)"/>${[[40, 52], [62, 44], [80, 68], [150, 48], [168, 64], [52, 84], [160, 88], [140, 74]].map(([x, y], i) => sparkle(x, y, i % 3 ? .7 : 1.1)).join('')}`
          + title('Спокойной ночи', 30, 17) + sub('ДОБРЫХ И СВЕТЛЫХ СНОВ', 102, '#d9cfa8');
        break;
      case 'cake':
        body = bg('#4a0f22', '#1f0610') + `<rect x="72" y="80" width="56" height="20" rx="3" fill="#f6e7c8" stroke="#c9a227" stroke-width="1"/><rect x="80" y="64" width="40" height="18" rx="3" fill="#fbefd6" stroke="#c9a227" stroke-width="1"/><path d="M72 86 q7 5 14 0 q7 5 14 0 q7 5 14 0 q7 5 14 0" fill="none" stroke="#c8102e" stroke-width="1.6"/><path d="M80 70 q5 4 10 0 q5 4 10 0 q5 4 10 0 q5 4 10 0" fill="none" stroke="#c8102e" stroke-width="1.4"/>${[88, 100, 112].map((x) => `<rect x="${x - 1.3}" y="52" width="2.6" height="12" fill="#fff"/><path d="M${x} 44 q3 4 0 8 q-3 -4 0 -8z" fill="#ffcf4d"/>`).join('')}<rect x="66" y="100" width="68" height="3" rx="1.5" fill="url(#bmGold)"/>`
          + title('С праздником!', 30, 18) + sparkles([[40, 60, 1.2], [160, 58, 1], [50, 94, .8], [152, 96, .9], [60, 40, .7], [142, 40, .7]]);
        break;
      case 'cat':
        body = bg('#f3ead3', '#dccaa0') + `<rect x="58" y="44" width="84" height="54" rx="2" fill="#8fb4d8" stroke="#6b4a1f" stroke-width="3"/><line x1="100" y1="44" x2="100" y2="98" stroke="#6b4a1f" stroke-width="2"/><line x1="58" y1="70" x2="142" y2="70" stroke="#6b4a1f" stroke-width="2"/><rect x="50" y="96" width="100" height="5" fill="#6b4a1f"/><g fill="#2b2b2b"><ellipse cx="82" cy="88" rx="10" ry="9"/><circle cx="82" cy="76" r="6"/><path d="M77 72 l1-6 l3 4zM87 72 l-1-6 l-3 4z"/><path d="M90 92 q10 2 8 -10" stroke="#2b2b2b" stroke-width="2.4" fill="none"/></g><rect x="114" y="84" width="14" height="12" fill="#b5563a"/>${rose(121, 80, 5, '#d8232a', '#8a0b20')}${leaf(116, 84, -140, .6)}`
          + title('Хорошего дня!', 30, 17, '#7a0f22') + sub('С ДОБРЫМИ ПОЖЕЛАНИЯМИ', 106, '#6b4a1f').replace('letter-spacing="1.6"', 'letter-spacing="1"');
        break;
      case 'trip':
        body = bg('#0f3b5c', '#08243a') + `<g transform="translate(64,40)"><rect width="72" height="52" fill="#f6efdc" stroke="url(#bmGold)" stroke-width="1.5" stroke-dasharray="3 2"/><rect x="6" y="6" width="60" height="40" fill="#7fb3d5"/><path d="M6 34 L24 18 L36 28 L46 20 L66 36 V46 H6Z" fill="#2f5d3a"/><path d="M6 40 Q36 34 66 40 V46 H6Z" fill="#1f6fa3"/><circle cx="54" cy="14" r="5" fill="#ffd36b"/></g>`
          + title('Привет из путешествия', 28, 13) + sub('НА ДОБРУЮ ПАМЯТЬ', 104);
        break;
      case 'tea':
        body = bg('#10392b', '#062016') + `<ellipse cx="100" cy="96" rx="40" ry="7" fill="#f6efdc" stroke="url(#bmGold)" stroke-width="1.5"/><path d="M74 66 h52 v6 c0 16 -12 24 -26 24 c-14 0 -26 -8 -26 -24z" fill="#f9f4e6" stroke="url(#bmGold)" stroke-width="1.6"/><path d="M126 72 q14 0 12 10 q-2 8 -14 6" fill="none" stroke="url(#bmGold)" stroke-width="2.2"/><path d="M80 76 q20 6 40 0" stroke="#c8102e" stroke-width="1.4" fill="none"/>${rose(100, 82, 4, '#c8102e', '#7d0a1c')}<g class="bm-steam" fill="none" stroke="#f3e6c4" stroke-width="1.4" opacity=".7"><path d="M90 60 q-4 -6 0 -12 q4 -6 0 -12"/><path d="M100 58 q-4 -6 0 -12 q4 -6 0 -12"/><path d="M110 60 q-4 -6 0 -12 q4 -6 0 -12"/></g>`
          + title('Приглашаю на чай', 26, 15);
        break;
      case 'roses':
        body = bg('#f6efdc', '#e4d3a8') + `<path d="M76 104 L100 62 L124 104Z" fill="#efe2bf" stroke="#b08a3a" stroke-width="1"/>${rose(86, 60, 10, '#c8102e', '#7d0a1c')}${rose(114, 60, 10, '#c8102e', '#7d0a1c')}${rose(100, 50, 11, '#d6203a', '#8a0b20')}${rose(93, 70, 8, '#b80d27', '#6d0817')}${rose(107, 70, 8, '#b80d27', '#6d0817')}${leaf(74, 66, -160, 1)}${leaf(126, 66, -20, 1)}<path d="M90 92 q10 6 20 0 l-4 8 q-6 -3 -12 0z" fill="#c8102e"/>`
          + title('Примите этот букет', 28, 15, '#7a0f22') + sparkles([[46, 56, .8], [154, 56, .8]]).replace(/#fff6cf/g, '#c9a227');
        break;
      case 'candle':
        body = bg('#2a1406', '#120802') + `<circle cx="100" cy="56" r="28" fill="#ffcf6b" opacity=".18"/><circle cx="100" cy="56" r="16" fill="#ffcf6b" opacity=".22"/><rect x="92" y="62" width="16" height="32" rx="2" fill="#f6efdc" stroke="#c9a227" stroke-width=".8"/><path d="M100 44 q6 8 0 16 q-6 -8 0 -16z" fill="#ffb02e"/><path d="M100 50 q2.5 4 0 8 q-2.5 -4 0 -8z" fill="#fff3c4"/><ellipse cx="100" cy="96" rx="20" ry="4" fill="url(#bmGold)"/>`
          + title('Уютного вечера', 28, 16) + sub('ТЕПЛА ВАШЕМУ ДОМУ', 106);
        break;
      case 'kiss':
        body = bg('#5c1420', '#2b070c') + `<g transform="translate(100,70)"><path d="M-10 16 L-30 -4 A11 11 0 0 1 -10 -16 A11 11 0 0 1 10 -4 Z" fill="#e0283f" stroke="url(#bmGold)" stroke-width="1.2"/><path d="M14 18 L-4 0 A10 10 0 0 1 14 -11 A10 10 0 0 1 32 0 Z" fill="url(#bmGold)" stroke="#7a5a10" stroke-width="1"/></g>`
          + title('С любовью', 30, 18) + sparkles([[50, 60, 1], [150, 62, 1], [60, 98, .7], [140, 98, .8]]);
        break;
      case 'couple':
        body = bg('#14213d', '#0a1120') + `<circle cx="90" cy="70" r="16" fill="none" stroke="url(#bmGold)" stroke-width="5"/><circle cx="110" cy="70" r="16" fill="none" stroke="url(#bmGoldH)" stroke-width="5"/><path d="M106 52 l4 -6 l4 6 l-4 4z" fill="#e8f4ff" stroke="#c9a227" stroke-width=".6"/>`
          + title('Вместе — навсегда', 30, 16) + sparkles([[52, 60, 1], [148, 60, 1], [64, 96, .8], [136, 96, .8]]);
        break;
      default:
        body = bg('#10392b', '#06170f') + title('С уважением', 64, 18);
    }
    return `<svg viewBox="0 0 200 120" aria-hidden="true" class="bm-card"><defs>${GOLD_DEF}</defs>${body}${frame()}</svg>`;
  }
  // коллекционный магнит: фарфор в золотом овале, лавровая ветвь, лента с названием
  function magnetBoomer(code, size, opts) {
    opts = opts || {};
    const c = COUNTRY[code] || COUNTRY.UR;
    const sz = size || 64;
    const dark = c.tier === 'black';
    const rim = dark ? '<linearGradient id="bmSilver" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f6fa"/><stop offset=".5" stop-color="#9aa3b2"/><stop offset="1" stop-color="#e3e7ee"/></linearGradient>' : '';
    const rimFill = dark ? 'url(#bmSilver)' : 'url(#bmGold)';
    const cols = c.colors.length ? c.colors : ['#c8102e'];
    const mid = 'bmMed' + code;
    const stripes = cols.map((col, i) => `<rect x="19" y="${(14 + i * (26 / cols.length)).toFixed(1)}" width="26" height="${(26 / cols.length + .4).toFixed(1)}" fill="${col}"/>`).join('');
    const laurel = (d) => `<g transform="translate(32,27) scale(${d},1)">${[0, 1, 2, 3, 4, 5].map((i) => { const a = (-70 + i * 26) * Math.PI / 180; const x = -17.5 * Math.cos(a), y = 17.5 * Math.sin(a); return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="1.6" ry="3.4" transform="rotate(${(-20 + i * 26).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="${dark ? '#c9d1dd' : '#5f7a2a'}" stroke="${dark ? '#7d8796' : '#3d5418'}" stroke-width=".3"/>`; }).join('')}</g>`;
    const serial = opts.serial ? `<text x="32" y="6.6" text-anchor="middle" font-family="${SERIF}" font-size="4.2" fill="${dark ? '#dfe5ee' : '#5a3d06'}">№ ${escT(String(opts.serial).replace(/^#/, ''))}</text>` : '';
    return `<svg viewBox="0 0 64 64" width="${sz}" height="${sz}" aria-hidden="true" class="bm-magnet"><defs>${GOLD_DEF}${rim}<radialGradient id="bmPorc" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="${dark ? '#1b2440' : '#efe4c8'}"/></radialGradient><clipPath id="${mid}"><circle cx="32" cy="27" r="12.5"/></clipPath></defs>
      <ellipse cx="32" cy="29" rx="29" ry="27" fill="#000" opacity=".25" transform="translate(1,1.4)"/>
      <ellipse cx="32" cy="29" rx="29" ry="27" fill="${rimFill}" stroke="${dark ? '#5d6675' : '#7a5a10'}" stroke-width=".8"/>
      <ellipse cx="32" cy="29" rx="24.5" ry="22.5" fill="url(#bmPorc)" stroke="${dark ? '#5d6675' : '#a07b22'}" stroke-width=".6"/>
      ${laurel(1)}${laurel(-1)}
      <g clip-path="url(#${mid})">${stripes}<rect x="19" y="14" width="26" height="26" fill="#fff" opacity=".18"/></g>
      <circle cx="32" cy="27" r="12.5" fill="none" stroke="${rimFill}" stroke-width="1.6"/>
      <circle cx="32" cy="27" r="9.4" fill="#fff" opacity=".9"/>
      <text x="32" y="31.6" text-anchor="middle" font-size="12" font-family="'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif">${c.icon}</text>
      <path d="M8 46 L14 43 H50 L56 46 L50 49 L52 54 L44 51 H20 L12 54 L14 49 Z" fill="${dark ? '#2a3354' : '#8b1a1a'}" stroke="${dark ? '#9aa3b2' : '#c9a227'}" stroke-width=".6"/>
      <text x="32" y="49.4" text-anchor="middle" font-family="${SERIF}" font-weight="bold" font-size="${c.name.length > 9 ? 4.6 : 5.6}" letter-spacing=".5" fill="#fff6dd">${escT(c.name.toUpperCase())}</text>
      ${serial}
      <path d="M12 16 Q32 4 52 16" fill="none" stroke="#fff" stroke-width="1.6" opacity=".35"/></svg>`;
  }

  // обложка трека: узор по стилю, цвет трека, пластинка выглядывает из конверта
  const COVER_PAT = {
    eurodance: (c) => `<g opacity=".35" fill="#fff">${[0, 30, 60, 90, 120, 150].map((a) => `<rect x="48" y="-10" width="6" height="120" transform="rotate(${a} 50 50)"/>`).join('')}</g>`,
    techno: () => `<g opacity=".3" stroke="#fff" stroke-width="1">${[15, 30, 45, 60, 75].map((v) => `<line x1="${v}" y1="0" x2="${v}" y2="100"/><line x1="0" y1="${v}" x2="100" y2="${v}"/>`).join('')}</g>`,
    ballad: () => `<g opacity=".3" fill="#fff"><circle cx="30" cy="35" r="18"/><circle cx="62" cy="48" r="26"/><circle cx="40" cy="70" r="12"/></g>`,
    lounge: () => `<g opacity=".35" fill="none" stroke="#fff" stroke-width="2">${[20, 35, 50, 65, 80].map((y) => `<path d="M0 ${y} Q25 ${y - 10} 50 ${y} T100 ${y}"/>`).join('')}</g>`,
    rock: () => `<path d="M55 5 L30 50 H48 L40 95 L72 42 H54 Z" fill="#fff" opacity=".4"/>`,
    pop: () => `<g opacity=".35" fill="#fff">${[[20, 20, 8], [60, 25, 12], [35, 55, 6], [75, 65, 9], [20, 80, 10], [55, 85, 5]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`,
    chiptune: () => `<g opacity=".4" fill="#fff">${[[10, 10], [30, 10], [20, 20], [40, 30], [60, 20], [80, 10], [70, 40], [10, 50], [50, 60], [30, 70], [80, 70], [60, 85], [20, 90]].map(([x, y]) => `<rect x="${x}" y="${y}" width="8" height="8"/>`).join('')}</g>`,
    link: () => `<g opacity=".4" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"><path d="M38 62 L62 38"/><path d="M45 32 l10 -10 a10 10 0 0 1 14 14 l-10 10"/><path d="M55 68 l-10 10 a10 10 0 0 1 -14 -14 l10 -10"/></g>`,
  };
  function coverSvg(t, size) {
    t = t || {}; const sz = size || 96;
    const col = t.color || '#7a3cff'; const h = hashOf(t.id || t.title || 'x');
    const pat = (COVER_PAT[t.url ? 'link' : t.style] || COVER_PAT.pop)(col);
    const words = String(t.title || '?').split(/\s+/); const l1 = words.slice(0, 2).join(' '), l2 = words.slice(2, 4).join(' ');
    const fs = l1.length > 12 ? 8 : l1.length > 8 ? 10 : 12;
    const cid = 'cv' + (h % 100000);
    return `<svg class="cover" viewBox="0 0 100 100" width="${sz}" height="${sz}" aria-hidden="true"><defs><clipPath id="${cid}"><rect x="0" y="0" width="100" height="100"/></clipPath><linearGradient id="${cid}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${col}"/><stop offset="1" stop-color="#1a1030"/></linearGradient></defs>
      <g clip-path="url(#${cid})"><rect width="100" height="100" fill="url(#${cid}g)"/>${pat}
      <circle cx="88" cy="50" r="40" fill="#151515"/><circle cx="88" cy="50" r="38" fill="none" stroke="#333" stroke-width="1" stroke-dasharray="2 1"/><circle cx="88" cy="50" r="30" fill="none" stroke="#2a2a2a" stroke-width="1"/><circle cx="88" cy="50" r="14" fill="${col}"/><circle cx="88" cy="50" r="2" fill="#eee"/>
      <rect x="0" y="0" width="76" height="100" fill="url(#${cid}g)" opacity=".97"/>${pat.replace(/opacity="[.0-9]+"/g, 'opacity=".25"')}</g>
      <text x="6" y="${l2 ? 58 : 62}" font-family="Tahoma,Verdana,sans-serif" font-weight="bold" font-size="${fs}" fill="#fff" stroke="#000" stroke-width=".5" paint-order="stroke">${escT(l1.slice(0, 16))}</text>${l2 ? `<text x="6" y="${58 + fs + 1}" font-family="Tahoma,Verdana,sans-serif" font-weight="bold" font-size="${fs}" fill="#fff" stroke="#000" stroke-width=".5" paint-order="stroke">${escT(l2.slice(0, 16))}</text>` : ''}
      <text x="6" y="90" font-family="Tahoma,Verdana,sans-serif" font-size="6.5" fill="#fff" opacity=".9">${escT(String(t.artist || '').slice(0, 22))}</text>
      ${t.year ? `<text x="6" y="12" font-family="Tahoma,Verdana,sans-serif" font-size="6" fill="#fff" opacity=".8">${t.year}</text>` : ''}
      <rect x="0" y="0" width="100" height="100" fill="none" stroke="#000" stroke-width="2"/></svg>`;
  }
  // еда и напитки в холодильнике: баночка, бутылка или тарелка с наклейкой НФТ
  function foodSvg(item, size) {
    item = item || {}; const sz = size || 48; const h = hashOf(item.code || 'x');
    const hue = h % 360; const col = `hsl(${hue},60%,55%)`, col2 = `hsl(${(hue + 40) % 360},60%,35%)`;
    const kind = item.kind === 'drink' ? (h % 2 ? 'bottle' : 'can') : (h % 3 === 0 ? 'jar' : 'plate');
    let body = '';
    if (kind === 'bottle') body = `<path d="M26 6 h12 v8 l6 8 v38 a4 4 0 0 1 -4 4 h-16 a4 4 0 0 1 -4 -4 v-38 l6 -8 z" fill="${col}" stroke="#222" stroke-width="1.5"/><rect x="26" y="3" width="12" height="5" rx="1" fill="#ddd" stroke="#222" stroke-width="1"/><rect x="22" y="30" width="20" height="18" rx="2" fill="#fff" stroke="#222" stroke-width="1"/>`;
    else if (kind === 'can') body = `<rect x="18" y="10" width="28" height="50" rx="5" fill="${col}" stroke="#222" stroke-width="1.5"/><ellipse cx="32" cy="11" rx="14" ry="4" fill="#ddd" stroke="#222" stroke-width="1"/><rect x="20" y="28" width="24" height="18" rx="2" fill="#fff" stroke="#222" stroke-width="1"/>`;
    else if (kind === 'jar') body = `<rect x="16" y="16" width="32" height="44" rx="6" fill="${col}" opacity=".9" stroke="#222" stroke-width="1.5"/><rect x="18" y="8" width="28" height="10" rx="2" fill="${col2}" stroke="#222" stroke-width="1.2"/><rect x="20" y="30" width="24" height="18" rx="2" fill="#fff" stroke="#222" stroke-width="1"/>`;
    else body = `<ellipse cx="32" cy="44" rx="28" ry="12" fill="#fff" stroke="#222" stroke-width="1.5"/><ellipse cx="32" cy="42" rx="20" ry="8" fill="${col}" opacity=".35"/>`;
    const iconY = kind === 'plate' ? 46 : 44;
    return `<svg viewBox="0 0 64 64" width="${sz}" height="${sz}" aria-hidden="true">${body}<text x="32" y="${iconY}" font-size="${kind === 'plate' ? 24 : 16}" text-anchor="middle" font-family="'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif">${item.icon || '🍽'}</text><path d="M20 12 Q32 6 44 12" fill="none" stroke="#fff" stroke-width="2" opacity=".5"/><rect x="38" y="52" width="24" height="9" rx="2" fill="#ffe14d" stroke="#806a00" stroke-width=".8"/><text x="50" y="59" font-size="6" text-anchor="middle" font-family="Tahoma,Verdana,sans-serif" font-weight="bold" fill="#222">НФТ</text></svg>`;
  }
  return { STATUSES, statusInfo, flowerSvg, statusFlower, envelopeSvg, SMILES, SMILE_BY_ID, smileSvg, postcardSvg, COUNTRIES, COUNTRY, magnetSvg, coverSvg, foodSvg, setStyle, style: () => artStyle };
})();
