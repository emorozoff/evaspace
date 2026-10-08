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
    return `<svg viewBox="0 0 16 16" width="${size}" height="${size}" aria-hidden="true"${op}>${flowerInner(color, opts)}</svg>`;
  }
  const statusFlower = (key, size) => { const s = statusInfo(key); return flowerSvg(s.color, size, { glyph: s.glyph }); };
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
    shock: () => FACE(...Y) + '<path d="M4.5 5.5l4-1M15.5 5.5l-4-1" stroke="#000" stroke-width="1" stroke-linecap="round"/><circle cx="7" cy="8" r="1.9" fill="#fff" stroke="#000" stroke-width=".7"/><circle cx="13" cy="8" r="1.9" fill="#fff" stroke="#000" stroke-width=".7"/><circle cx="7" cy="8" r=".9"/><circle cx="13" cy="8" r=".9"/><ellipse cx="10" cy="13.8" rx="3" ry="2.6" fill="#6b1010" stroke="#000" stroke-width=".7"/>',
  };
  function smileSvg(id, size) {
    const art = SMILE_ART[id];
    if (!art) return '';
    return `<svg viewBox="0 0 20 20" width="${size || 18}" height="${size || 18}" aria-hidden="true">${art()}</svg>`;
  }


  /* ---------- открытки (анимация — в styles.css) ---------- */
  function postcardSvg(kind) {
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
  return { STATUSES, statusInfo, flowerSvg, statusFlower, envelopeSvg, SMILES, SMILE_BY_ID, smileSvg, postcardSvg };
})();
