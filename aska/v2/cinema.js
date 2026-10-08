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
  function posterSvg(mv, w) {
    w = w || 60; const h = Math.round(w * 1.4);
    const hu = hue(mv.title || '?');
    const words = String(mv.title || '?').split(/\s+/).slice(0, 2);
    const holes = []; for (let y = 4; y < h - 2; y += 7) holes.push(`<rect x="1.5" y="${y}" width="3" height="4" rx="1" fill="#000" opacity=".6"/><rect x="${w - 4.5}" y="${y}" width="3" height="4" rx="1" fill="#000" opacity=".6"/>`);
    const text = words.map((wd, i) => `<text x="${w / 2}" y="${h / 2 + (words.length === 1 ? 4 : i * 12 - 2)}" text-anchor="middle" font-family="Tahoma,Arial" font-weight="bold" font-size="${wd.length > 8 ? 7 : 9}" fill="#fff" stroke="#000" stroke-width=".6" paint-order="stroke">${esc(wd.slice(0, 11))}</text>`).join('');
    return `<svg class="poster" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><defs><linearGradient id="pg${hu}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hu},70%,55%)"/><stop offset="1" stop-color="hsl(${(hu + 60) % 360},70%,30%)"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#pg${hu})"/><rect x="0" y="0" width="6" height="${h}" fill="#222"/><rect x="${w - 6}" y="0" width="6" height="${h}" fill="#222"/>${holes.join('')}<circle cx="${w / 2}" cy="${h * 0.3}" r="${w * 0.14}" fill="#fff" opacity=".25"/><path d="M${w / 2 - 3} ${h * 0.3 - 4} L${w / 2 + 5} ${h * 0.3} L${w / 2 - 3} ${h * 0.3 + 4} Z" fill="#fff" opacity=".8"/>${text}${mv.kind === 'series' ? `<rect x="8" y="${h - 12}" width="${w - 16}" height="8" fill="#000" opacity=".5"/><text x="${w / 2}" y="${h - 5.5}" text-anchor="middle" font-family="Tahoma,Arial" font-size="6" fill="#ffe14d">сериал · ${(mv.episodes || []).length} серий</text>` : ''}</svg>`;
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
  window.AskaCinema = { GENRES, parseLink, posterSvg, SEEDS, BOT_LINES };
})();
