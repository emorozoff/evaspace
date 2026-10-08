/* АСЬКА v2 — кино: разбор ссылок на видео, постеры, стартовая коллекция */
(function () {
  'use strict';
  const GENRES = ['мультфильм', 'фантастика', 'боевик', 'комедия', 'драма', 'мелодрама', 'документальное', 'ужасы', 'короткий метр', 'сериал'];
  // ссылка → как это показывать: встроенный плеер (iframe), прямой файл (<video>) или просто ссылка
  function parseLink(url) {
    url = String(url || '').trim(); let m;
    if (!url) return null;
    // ссылка со схемой — только http(s) или blob:: никаких javascript:/data: в src и href
    if (/^[a-z][a-z0-9+.-]*:/i.test(url) && !/^(https?|blob):/i.test(url)) return null;
    if ((m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([\w-]{6,})/))) return { kind: 'youtube', embed: `https://www.youtube.com/embed/${m[1]}?rel=0&autoplay=1`, label: 'YouTube' };
    if ((m = url.match(/(?:vk(?:video)?\.(?:com|ru))\/video(-?\d+)_(\d+)/))) return { kind: 'vk', embed: `https://vk.com/video_ext.php?oid=${m[1]}&id=${m[2]}&hd=2&autoplay=1`, label: 'VK Видео' };
    if ((m = url.match(/vk(?:video)?\.(?:com|ru)\/video_ext\.php\?[^#]*oid=(-?\d+)[^#]*id=(\d+)/))) return { kind: 'vk', embed: `https://vk.com/video_ext.php?oid=${m[1]}&id=${m[2]}&hd=2&autoplay=1`, label: 'VK Видео' };
    if ((m = url.match(/rutube\.ru\/(?:video|play\/embed)\/([0-9a-f]{32})/))) return { kind: 'rutube', embed: `https://rutube.ru/play/embed/${m[1]}`, label: 'Rutube' };
    if ((m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/))) return { kind: 'vimeo', embed: `https://player.vimeo.com/video/${m[1]}?autoplay=1`, label: 'Vimeo' };
    if ((m = url.match(/dzen\.ru\/video\/watch\/([0-9a-f]+)/))) return { kind: 'dzen', embed: `https://dzen.ru/embed/${m[1]}`, label: 'Дзен' };
    if ((m = url.match(/ok\.ru\/video\/(\d+)/))) return { kind: 'ok', embed: `https://ok.ru/videoembed/${m[1]}`, label: 'Одноклассники' };
    if ((m = url.match(/kinescope\.io\/(?:embed\/)?([\w]+)/))) return { kind: 'kinescope', embed: `https://kinescope.io/embed/${m[1]}`, label: 'Kinescope' };
    if (/\.(mp4|webm|m4v|ogv|mov|mkv)(\?|#|$)/i.test(url) || /^(\.{1,2}\/|\/)/.test(url) || /^blob:/.test(url)) return { kind: 'video', src: url, label: 'видеофайл' };
    if (/^https?:\/\//.test(url)) return { kind: 'link', label: 'ссылка' };
    return null;
  }
  // постер: цвет из названия, киноплёнка по краям, крупные буквы
  function hue(str) { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0; return h % 360; }
  function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  // постер: градиент по названию, мотив по жанру, крупное название внизу, как у стримингов
  const MOTIF = {
    'фантастика': (w, h, c) => `<g opacity=".9">${[[.15, .12, 1.2], [.8, .18, 1], [.6, .08, .8], [.3, .3, .7], [.88, .4, 1.1], [.12, .45, .8]].map(([x, y, r]) => `<circle cx="${x * w}" cy="${y * h}" r="${r * w / 60}" fill="#fff"/>`).join('')}<circle cx="${w * .62}" cy="${h * .36}" r="${w * .2}" fill="${c}" opacity=".9"/><ellipse cx="${w * .62}" cy="${h * .36}" rx="${w * .34}" ry="${w * .07}" fill="none" stroke="#fff" stroke-width="${w / 60}" opacity=".7" transform="rotate(-18 ${w * .62} ${h * .36})"/></g>`,
    'мультфильм': (w, h) => `<g><ellipse cx="${w * .38}" cy="${h * .16}" rx="${w * .07}" ry="${w * .2}" fill="#fff" opacity=".9"/><ellipse cx="${w * .62}" cy="${h * .16}" rx="${w * .07}" ry="${w * .2}" fill="#fff" opacity=".9"/><circle cx="${w * .5}" cy="${h * .4}" r="${w * .24}" fill="#fff" opacity=".95"/><circle cx="${w * .42}" cy="${h * .37}" r="${w * .03}" fill="#222"/><circle cx="${w * .58}" cy="${h * .37}" r="${w * .03}" fill="#222"/><path d="M${w * .42} ${h * .46} Q${w * .5} ${h * .52} ${w * .58} ${h * .46}" stroke="#222" stroke-width="${w / 50}" fill="none" stroke-linecap="round"/></g>`,
    'боевик': (w, h) => `<g><path d="M${w * .5} ${h * .12} L${w * .58} ${h * .3} L${w * .78} ${h * .24} L${w * .66} ${h * .4} L${w * .84} ${h * .52} L${w * .62} ${h * .5} L${w * .56} ${h * .66} L${w * .48} ${h * .5} L${w * .26} ${h * .58} L${w * .4} ${h * .42} L${w * .2} ${h * .3} L${w * .44} ${h * .3} Z" fill="#ffd34d" opacity=".95"/><path d="M0 ${h * .7} L${w} ${h * .2}" stroke="#fff" stroke-width="${w / 30}" opacity=".35"/></g>`,
    'комедия': (w, h) => `<g><circle cx="${w * .5}" cy="${h * .36}" r="${w * .26}" fill="#ffd34d"/><circle cx="${w * .41}" cy="${h * .31}" r="${w * .03}" fill="#222"/><circle cx="${w * .59}" cy="${h * .31}" r="${w * .03}" fill="#222"/><path d="M${w * .36} ${h * .4} Q${w * .5} ${h * .54} ${w * .64} ${h * .4}" stroke="#222" stroke-width="${w / 40}" fill="#fff" stroke-linejoin="round"/></g>`,
    'драма': (w, h) => `<g opacity=".8" stroke="#fff" stroke-width="${w / 90}">${[.15, .3, .45, .6, .75, .9].map((x, i) => `<line x1="${x * w}" y1="${(.05 + (i % 3) * .08) * h}" x2="${x * w - w * .05}" y2="${(.2 + (i % 3) * .08) * h}"/>`).join('')}</g><circle cx="${w * .5}" cy="${h * .42}" r="${w * .16}" fill="#fff" opacity=".2"/>`,
    'мелодрама': (w, h) => `<path d="M${w * .5} ${h * .55} C${w * .1} ${h * .35} ${w * .22} ${h * .12} ${w * .5} ${h * .26} C${w * .78} ${h * .12} ${w * .9} ${h * .35} ${w * .5} ${h * .55} Z" fill="#ff5f8f" opacity=".9"/>`,
    'документальное': (w, h) => `<g fill="none" stroke="#fff" stroke-width="${w / 40}" opacity=".85"><circle cx="${w * .5}" cy="${h * .36}" r="${w * .24}"/><circle cx="${w * .5}" cy="${h * .36}" r="${w * .1}"/>${[0, 60, 120, 180, 240, 300].map((a) => `<line x1="${w * .5}" y1="${h * .36}" x2="${w * .5 + w * .24 * Math.cos(a * Math.PI / 180)}" y2="${h * .36 + w * .24 * Math.sin(a * Math.PI / 180)}"/>`).join('')}</g>`,
    'короткий метр': (w, h, c) => `<g transform="translate(${w * .5} ${h * .36})">${[0, 72, 144, 216, 288].map((a) => `<ellipse rx="${w * .09}" ry="${w * .2}" fill="#ff7aa8" opacity=".9" transform="rotate(${a}) translate(0 ${-w * .14})"/>`).join('')}<circle r="${w * .08}" fill="#ffd34d"/></g>`,
    'ужасы': (w, h) => `<circle cx="${w * .62}" cy="${h * .26}" r="${w * .18}" fill="#f2f2d8" opacity=".9"/><circle cx="${w * .7}" cy="${h * .22}" r="${w * .16}" fill="#000" opacity=".55"/>`,
    'сериал': (w, h) => `<g fill="none" stroke="#fff" stroke-width="${w / 40}" opacity=".8"><rect x="${w * .22}" y="${h * .2}" width="${w * .56}" height="${h * .3}" rx="${w * .05}"/><line x1="${w * .4}" y1="${h * .14}" x2="${w * .5}" y2="${h * .2}"/><line x1="${w * .6}" y1="${h * .14}" x2="${w * .5}" y2="${h * .2}"/></g>`,
  };
  function posterSvg(mv, w) {
    w = w || 60; const h = Math.round(w * 1.45);
    const hu = hue(mv.title || '?'); const id = 'pg' + hu + '_' + (hue((mv.title || '') + 'x') % 997);
    const words = String(mv.title || '?').split(/\s+/);
    const lines = []; let cur = '';
    words.forEach((wd) => { if ((cur + ' ' + wd).trim().length > 11 && cur) { lines.push(cur); cur = wd; } else cur = (cur + ' ' + wd).trim(); });
    if (cur) lines.push(cur);
    const L = lines.slice(0, 3); const fs = Math.max(7, Math.round(w / (L.some((l) => l.length > 9) ? 8.4 : 7)));
    const motif = (MOTIF[mv.genre] || MOTIF[mv.kind === 'series' ? 'сериал' : 'драма'])(w, h, `hsl(${(hu + 180) % 360},70%,60%)`);
    const text = L.map((l, i) => `<text x="${w * .08}" y="${h - w * .14 - (L.length - 1 - i) * (fs + 2)}" font-family="-apple-system,'Segoe UI',Roboto,Arial,sans-serif" font-weight="800" font-size="${fs}" fill="#fff" letter-spacing="-.2">${esc(l.slice(0, 16))}</text>`).join('');
    return `<svg class="poster" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stop-color="hsl(${hu},70%,58%)"/><stop offset="1" stop-color="hsl(${(hu + 50) % 360},70%,16%)"/></linearGradient><linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".75"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#${id})"/>${motif}<rect width="${w}" height="${h}" fill="url(#${id}s)"/>${text}<text x="${w * .08}" y="${h - w * .05}" font-family="-apple-system,'Segoe UI',Roboto,Arial,sans-serif" font-size="${Math.max(5, w / 15)}" fill="#fff" opacity=".75">${mv.year || ''}${mv.kind === 'series' ? ' · сериал' : ''}</text>${mv.kind === 'series' ? `<rect x="0" y="${w * .06}" width="${w * .46}" height="${w * .13}" fill="#e5352a"/><text x="${w * .05}" y="${w * .155}" font-family="-apple-system,'Segoe UI',Roboto,Arial,sans-serif" font-weight="800" font-size="${Math.max(5, w / 13)}" fill="#fff" letter-spacing=".5">СЕРИАЛ</text>` : ''}</svg>`;
  }
  // стартовая коллекция: свободные фильмы фонда Blender и демо-ролики, плюс «Цветение» из соседней Евы
  const G = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/';
  const SEEDS = [
    { id: 'bbb', title: 'Большой Бак Банни', orig: 'Big Buck Bunny', kind: 'film', year: 2008, genre: 'мультфильм', desc: 'Добрый кролик, три хулигана-грызуна и месть по-кроличьи. 10 минут чистого настроения.', url: G + 'BigBuckBunny.mp4', addedBy: '000001', likes: ['100500', '555123', '000001'] },
    { id: 'sintel', title: 'Синтел', orig: 'Sintel', kind: 'film', year: 2010, genre: 'фантастика', desc: 'Девушка ищет своего дракона через полмира. Короткий, красивый и грустный.', url: G + 'Sintel.mp4', addedBy: '31337', likes: ['31337', '404404'] },
    { id: 'eldream', title: 'Сон слонов', orig: 'Elephants Dream', kind: 'film', year: 2006, genre: 'фантастика', desc: 'Двое в бесконечной машине. Первый открытый фильм в истории.', url: G + 'ElephantsDream.mp4', addedBy: '404404', likes: ['404404'] },
    { id: 'tears', title: 'Слёзы стали', orig: 'Tears of Steel', kind: 'film', year: 2012, genre: 'боевик', desc: 'Амстердам, роботы, бывшая и спасение мира. Снято с живыми актёрами.', url: G + 'TearsOfSteel.mp4', addedBy: '777777', likes: ['777777', '100500'] },
    { id: 'bloom', title: 'Цветение', orig: 'Eva: Bloom', kind: 'film', year: 2026, genre: 'короткий метр', desc: 'Минутка из соседней Евы. Смотреть на весь экран и с хорошим звуком.', url: '../video/bloom.mp4', addedBy: '000001', likes: ['000001', '200200'] },
    { id: 'bigger', title: 'Шире экран', orig: 'For Bigger', kind: 'series', year: 2014, genre: 'комедия', desc: 'Пять коротких серий о том, что на большом экране всё лучше: взрывы, побеги, веселье, покатушки и срывы.', addedBy: '100500', likes: ['100500', '555123'], episodes: [
      { title: '1. Взрывы', url: G + 'ForBiggerBlazes.mp4' }, { title: '2. Побеги', url: G + 'ForBiggerEscapes.mp4' }, { title: '3. Веселье', url: G + 'ForBiggerFun.mp4' }, { title: '4. Покатушки', url: G + 'ForBiggerJoyrides.mp4' }, { title: '5. Срывы', url: G + 'ForBiggerMeltdowns.mp4' }] },
    { id: 'cars', title: 'Тачки на тесте', orig: 'Car reviews', kind: 'series', year: 2013, genre: 'документальное', desc: 'Батя одобряет: четыре серии про машины, дорогу и разумный бюджет.', addedBy: '200200', likes: ['200200', '31337'], episodes: [
      { title: '1. Субару: улица и грунт', url: G + 'SubaruOutbackOnStreetAndDirt.mp4' }, { title: '2. Гольф GTI', url: G + 'VolkswagenGTIReview.mp4' }, { title: '3. Едем на Буллран', url: G + 'WeAreGoingOnBullrun.mp4' }, { title: '4. Что купить за тысячу', url: G + 'WhatCarCanYouGetForAGrand.mp4' }] },
  ];
  const BOT_LINES = {
    aska: ['Ты посоветовал мне кино! Смотрю сегодня же, с чаем и печеньками :)', 'Кино от тебя — это как открытка, только длиннее. Спасибо!'],
    kat: ['ооо кино!!! сегодня же смотрю)))', 'а это страшное? если страшное, смотрю с подушкой))'],
    vova: ['кино. ок. посмотрю, если не мп4 в 240р', 'качаю. 40 минут'],
    serega: ['КИНО!!! Зову Вову, делаем попкорн!!!', 'Фильм от тебя — это серьёзно! Смотрю на большом экране!'],
    lena: ['Спасибо за рекомендацию. Посмотрю вечером и напишу, что думаю.', 'Записала. Люблю, когда советуют со вкусом.'],
    batya: ['Кино посмотрю. Главное, чтоб без глупостей и со смыслом. Спасибо, сын.', 'Фильм принял. Вечером с матерью посмотрим.'],
    max: ['Кино — это способ прожить чужую жизнь за полтора часа. Благодарю, посмотрю.', 'Фильм как повод подумать. Принято.'],
    vinyl: ['Кино — это музыка плюс картинка. Оценю саундтрек.', 'Посмотрю. Если саундтрек хорош — расскажу.'],
  };
  window.AskaCinema = { GENRES, parseLink, posterSvg, SEEDS, BOT_LINES, hue };
})();
