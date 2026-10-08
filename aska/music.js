/* АСЬКА — виниловый плеер. Все «хиты» — собственные инструменталки,
   которые синтезируются на лету из нот через Web Audio: ударные, бас,
   соло, подклад и шипение пластинки. Файлов нет, весит 0 байт. */
window.AskaMusic = (function () {
  'use strict';
  const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  const midiToF = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function noteMidi(n) { const m = /^([A-G][#b]?)(-?\d)$/.exec(n); return m ? 12 * (parseInt(m[2], 10) + 1) + NOTE[m[1]] : null; }
  function chord(name) { // → {root: midi(oct 2), iv: [...]}
    const m = /^([A-G][#b]?)(m7|maj7|m|dim|7)?$/.exec(name);
    const root = 36 + NOTE[m[1]];
    const q = m[2] || '';
    const iv = q === 'm' || q === 'm7' ? [0, 3, 7] : q === 'dim' ? [0, 3, 6] : [0, 4, 7];
    if (q === '7' || q === 'm7') iv.push(10);
    if (q === 'maj7') iv.push(11);
    return { root, iv };
  }
  const tokens = (s) => s.replace(/\|/g, ' ').trim().split(/\s+/);

  /* ---------- хиты ---------- */
  const TRACKS = [
    { id: 'dialup', title: 'Дайлап-любовь', artist: 'Катюха_98 и Модемы', by: 'kat', year: 1999, style: 'eurodance', bpm: 138, color: '#ff5fa0', chords: ['Am', 'F', 'C', 'G'],
      lead: 'E5 . E5 . D5 C5 D5 . | C5 . . . A4 . C5 D5 | E5 . E5 . G5 . E5 D5 | D5 . B4 . D5 . . .',
      lead2: 'A5 . G5 . E5 . D5 C5 | A4 . . . C5 D5 E5 . | G5 . E5 . G5 . A5 . | B4 . D5 . G5 . . .' },
    { id: 'summer99', title: 'Лето 1999', artist: 'DJ Serёga', by: 'serega', year: 1999, style: 'eurodance', bpm: 140, color: '#ffb21e', chords: ['C', 'G', 'Am', 'F'],
      lead: 'G4 . C5 . E5 . D5 C5 | D5 . B4 . G4 . . . | E5 . C5 . A4 . C5 E5 | F5 . E5 . C5 . . .',
      lead2: 'G5 . E5 . C5 . E5 G5 | D5 . B4 . D5 . G5 . | E5 . C5 . A4 . A5 . | F5 . E5 . C5 . D5 .' },
    { id: 'cassette', title: 'Кассета', artist: 'Ленка_Питер', by: 'lena', year: 1998, style: 'ballad', bpm: 84, color: '#c8a2ff', chords: ['Am', 'Em', 'F', 'G'],
      lead: 'A4 . . . B4 C5 . . | B4 . . . G4 . E4 . | A4 . . C5 . . A4 . | B4 . . . . . . .',
      lead2: 'E5 . . . D5 C5 . . | B4 . . . G4 . B4 . | C5 . . A4 . . C5 . | D5 . . B4 . . . .' },
    { id: 'pager', title: 'Пейджер молчит', artist: 'Макс_Философ', by: 'max', year: 1997, style: 'lounge', bpm: 96, color: '#8fd3c7', chords: ['Dm7', 'G7', 'Cmaj7', 'Am7'],
      lead: 'A4 . F4 . D4 . . . | B4 . G4 . D4 . . . | E5 . . . C5 . B4 . | A4 . . . . . E4 G4',
      lead2: 'D5 . C5 . A4 . F4 . | D5 . B4 . G4 . . . | G5 . E5 . C5 . . . | C5 . A4 . E4 . . .' },
    { id: 'disco99', title: 'Дискотека 99', artist: 'DJ Serёga', by: 'serega', year: 1999, style: 'techno', bpm: 136, color: '#1fa3e0', chords: ['Am', 'Am', 'F', 'G'],
      lead: 'A4 A4 . A4 . A4 C5 . | A4 A4 . A4 . E5 D5 C5 | F4 F4 . F4 . A4 C5 . | G4 . B4 . D5 . B4 G4',
      lead2: 'A5 . E5 . A5 . C6 . | A5 . E5 . G5 . E5 . | F5 . C5 . F5 . A5 . | G5 . D5 . B4 . D5 G5' },
    { id: 'sevens', title: 'Три семёрки', artist: 'DJ Serёga', by: 'serega', year: 2000, style: 'eurodance', bpm: 142, color: '#e8203a', chords: ['Em', 'C', 'D', 'Bm'],
      lead: 'E5 . . B4 . E5 . G5 | E5 . C5 . . . . . | D5 . D5 . F#5 . A5 . | F#5 . D5 . B4 . . .',
      lead2: 'G5 . E5 . B4 . E5 . | G5 . E5 . C5 . . . | A5 . F#5 . D5 . F#5 . | B5 . F#5 . D5 . . .' },
    { id: 'bsod', title: 'Синий экран', artist: 'ha©keR_Vova', by: 'vova', year: 1998, style: 'chiptune', bpm: 150, color: '#0000aa', chords: ['C', 'Am', 'F', 'G'],
      lead: 'C5 E5 G5 . E5 . C5 . | A4 C5 E5 . C5 . A4 . | F4 A4 C5 . A4 . F4 . | G4 B4 D5 . B4 D5 G5 .',
      lead2: 'G5 E5 C5 . E5 G5 C6 . | E5 C5 A4 . C5 E5 A5 . | C5 A4 F4 . A4 C5 F5 . | D5 B4 G4 . B4 D5 G5 B5' },
    { id: 'karas', title: 'Карась', artist: 'Батя_в_сети', by: 'batya', year: 1996, style: 'rock', bpm: 118, color: '#4ca12c', chords: ['G', 'C', 'D', 'G'],
      lead: 'G4 . B4 . D5 . B4 . | C5 . E5 . C5 . B4 A4 | A4 . A4 . F#4 . D4 . | G4 . . . G4 . . .',
      lead2: 'D5 . B4 . G4 . B4 D5 | E5 . C5 . G4 . C5 E5 | F#5 . D5 . A4 . D5 . | G5 . . . G4 . . .' },
    { id: 'uhoh', title: 'О-оу (ремикс)', artist: 'Аська', by: 'aska', year: 1998, style: 'pop', bpm: 120, color: '#3cb44a', chords: ['F', 'C', 'Dm', 'Bb'],
      lead: 'A4 . F4 . . . . . | G4 . E4 . . . C5 . | A4 . F4 . A4 . F4 . | F4 . D4 . . . . .',
      lead2: 'C5 . A4 . . . F4 . | G4 . E4 . G4 . C5 . | D5 . A4 . F4 . A4 . | Bb4 . F4 . D4 . . .' },
    { id: 'cookies', title: 'Печеньки', artist: 'Аська', by: 'aska', year: 1999, style: 'pop', bpm: 100, color: '#f7b31c', chords: ['C', 'G', 'Am', 'F'],
      lead: 'E5 . D5 . C5 . . . | D5 . . . B4 . G4 . | C5 . . D5 E5 . . . | F5 . E5 . D5 . C5 .',
      lead2: 'G5 . E5 . C5 . . . | D5 . B4 . G4 . B4 . | A4 . C5 . E5 . . . | F5 . A5 . G5 . E5 .' },
    { id: 'lisboa', title: 'Урюпинск — Лиссабон', artist: 'Аська и Макс', by: 'aska', year: 2000, style: 'lounge', bpm: 104, color: '#e88b2d', chords: ['Am', 'D7', 'Gmaj7', 'Cmaj7'],
      lead: 'E5 . . . C5 . A4 . | F#5 . . . D5 . A4 . | D5 . B4 . G4 . B4 D5 | E5 . . . . . . .',
      lead2: 'A5 . . . E5 . C5 . | A5 . . . F#5 . D5 . | G5 . D5 . B4 . D5 G5 | E5 . G5 . C5 . . .' },
    { id: 'flower', title: 'Цветочек', artist: 'АСЬКА (заставка)', by: 'aska', year: 1998, style: 'chiptune', bpm: 160, color: '#d8232a', chords: ['A', 'E', 'F#m', 'D'],
      lead: 'C#5 . E5 . A5 . E5 . | B4 . E5 . G#5 . E5 . | A4 . C#5 . F#5 . C#5 . | D5 . F#5 . A5 . F#5 D5',
      lead2: 'A5 . E5 . C#5 . E5 A5 | G#5 . E5 . B4 . E5 G#5 | F#5 . C#5 . A4 . C#5 F#5 | A5 . F#5 . D5 . A5 .' },
  ];
  const byId = {};
  TRACKS.forEach((t) => (byId[t.id] = t));

  const STYLE = {
    eurodance: { drums: 'four', bass: 'octave', bassWave: 'sawtooth', lead: 'sawtooth', stabs: true, pad: false },
    techno: { drums: 'four', bass: 'root16', bassWave: 'sawtooth', lead: 'square', stabs: true, pad: false },
    ballad: { drums: 'soft', bass: 'long', bassWave: 'triangle', lead: 'triangle', stabs: false, pad: true },
    lounge: { drums: 'swing', bass: 'walk', bassWave: 'triangle', lead: 'triangle', stabs: false, pad: true },
    rock: { drums: 'rock', bass: 'root8', bassWave: 'square', lead: 'square', stabs: false, pad: false, drive: true },
    pop: { drums: 'pop', bass: 'root8', bassWave: 'triangle', lead: 'triangle', stabs: false, pad: true },
    chiptune: { drums: 'chip', bass: 'octave', bassWave: 'square', lead: 'square', stabs: false, pad: false, chip: true },
  };
  const DRUMS = {
    four: { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', o: '..x...x...x...x.' },
    soft: { k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', o: '' },
    swing: { k: 'x.....x.x.......', s: '....x.......x..x', h: 'x..xx..xx..xx..x', o: '' },
    rock: { k: 'x...x.x.x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', o: '' },
    pop: { k: 'x.....x.x.....x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', o: '' },
    chip: { k: 'x...x...x...x.x.', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx', o: '' },
  };

  /* ---------- движок ---------- */
  let C = null, master = null, musicGain = null, crackleGain = null, crackleSrc = null, popTimer = null;
  let enabled = true, volume = 0.7, crackle = true;
  let state = { playing: false, trackId: null, bar: 0, loop: 0, queue: [], index: -1, queueName: '', kind: 'synth', pos: 0, dur: 0, embed: null, shuffle: false, repeat: false, motor: 0 };
  const external = {};          // треки по ссылке: id → {id,title,artist,url,kind,src,embed,style,by}
  let audioEl = null;
  // разбор ссылки: Яндекс Музыка, YouTube, SoundCloud, прямой mp3
  function parseLink(url) {
    url = String(url || '').trim();
    let m;
    if ((m = url.match(/music\.yandex\.(?:ru|com|by|kz|uz)\/album\/(\d+)\/track\/(\d+)/))) return { kind: 'yandex', embed: `https://music.yandex.ru/iframe/track/${m[2]}/${m[1]}`, label: 'Яндекс Музыка', h: 180 };
    if ((m = url.match(/music\.yandex\.(?:ru|com|by|kz|uz)\/users\/([^/]+)\/playlists\/(\d+)/))) return { kind: 'yandex', embed: `https://music.yandex.ru/iframe/playlist/${m[1]}/${m[2]}`, label: 'Яндекс Музыка · плейлист', h: 450 };
    if ((m = url.match(/music\.yandex\.(?:ru|com|by|kz|uz)\/album\/(\d+)/))) return { kind: 'yandex', embed: `https://music.yandex.ru/iframe/album/${m[1]}`, label: 'Яндекс Музыка · альбом', h: 450 };
    if ((m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/))([\w-]{6,})/))) return { kind: 'youtube', embed: `https://www.youtube.com/embed/${m[1]}?autoplay=1&rel=0`, label: 'YouTube', h: 200 };
    if (/soundcloud\.com\//.test(url)) return { kind: 'soundcloud', embed: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=true&color=%23ff5500`, label: 'SoundCloud', h: 166 };
    if (/\.(mp3|ogg|oga|m4a|wav|aac|flac|opus)(\?.*)?$/i.test(url)) return { kind: 'audio', src: url, label: 'аудиофайл', h: 0 };
    if (/^https?:\/\//.test(url)) return { kind: 'link', embed: null, label: 'ссылка', h: 0 };
    return null;
  }
  function registerExternal(t) { external[t.id] = t; }
  const anyById = (id) => byId[id] || external[id] || null;
  let timer = null, nextStep = 0, step = 0, loops = 2;
  const listeners = [];
  const emit = () => listeners.forEach((f) => { try { f(state); } catch (e) {} });

  function ensure() {
    if (!C) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      C = new AC();
      master = C.createGain(); master.gain.value = volume; master.connect(C.destination);
      musicGain = C.createGain(); musicGain.gain.value = 0.85;
      const comp = C.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.12;
      musicGain.connect(comp); comp.connect(master);
      crackleGain = C.createGain(); crackleGain.gain.value = 0; crackleGain.connect(master);
    }
    if (C.state === 'suspended') C.resume().catch(() => {});
    return C;
  }
  let noiseBuf = null;
  function noiseSrc() {
    if (!noiseBuf) { noiseBuf = C.createBuffer(1, C.sampleRate * 2, C.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const s = C.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s;
  }
  function env(g, t, a, d, peak, sus, r, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.linearRampToValueAtTime(sus, t + a + d);
    if (dur) { g.gain.setValueAtTime(sus, t + Math.max(a + d, dur - r)); g.gain.linearRampToValueAtTime(0.0001, t + dur); }
    else g.gain.linearRampToValueAtTime(0.0001, t + a + d + r);
  }
  // ударные
  function kick(t, gain) {
    const o = C.createOscillator(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const g = C.createGain(); env(g, t, 0.002, 0.08, gain || 0.9, 0.3, 0.18);
    o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + 0.35);
  }
  function snare(t, gain) {
    const n = noiseSrc(); const f = C.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.7;
    const g = C.createGain(); env(g, t, 0.001, 0.06, (gain || 1) * 0.35, 0.1, 0.1);
    n.connect(f); f.connect(g); g.connect(musicGain); n.start(t); n.stop(t + 0.25);
    const o = C.createOscillator(); o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(120, t + 0.08);
    const g2 = C.createGain(); env(g2, t, 0.001, 0.05, (gain || 1) * 0.25, 0.05, 0.05);
    o.connect(g2); g2.connect(musicGain); o.start(t); o.stop(t + 0.15);
  }
  function hat(t, open, gain) {
    const n = noiseSrc(); const f = C.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = C.createGain(); env(g, t, 0.001, open ? 0.1 : 0.02, (gain || 1) * (open ? 0.1 : 0.08), 0.02, open ? 0.15 : 0.02);
    n.connect(f); f.connect(g); g.connect(musicGain); n.start(t); n.stop(t + (open ? 0.35 : 0.08));
  }
  function bass(t, midi, dur, wave, chip) {
    const o = C.createOscillator(); o.type = wave; o.frequency.value = midiToF(midi);
    const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(chip ? 900 : 700, t); f.frequency.exponentialRampToValueAtTime(chip ? 500 : 180, t + Math.max(0.1, dur)); f.Q.value = 2;
    const g = C.createGain(); env(g, t, 0.005, 0.05, 0.32, 0.22, 0.04, dur);
    o.connect(f); f.connect(g); g.connect(musicGain); o.start(t); o.stop(t + dur + 0.06);
  }
  function lead(t, midi, dur, wave, chip, drive) {
    const g = C.createGain(); env(g, t, 0.01, 0.08, chip ? 0.11 : 0.17, chip ? 0.09 : 0.12, 0.06, dur);
    const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = drive ? 1800 : 2600; f.Q.value = 1;
    const mk = (det) => { const o = C.createOscillator(); o.type = wave; o.frequency.value = midiToF(midi); o.detune.value = det; o.connect(f); o.start(t); o.stop(t + dur + 0.1); return o; };
    const o1 = mk(0); if (!chip) mk(wave === 'sawtooth' ? 9 : 5);
    const lfo = C.createOscillator(); lfo.frequency.value = 5.5; const lg = C.createGain(); lg.gain.value = chip ? 0 : 4; lfo.connect(lg); lg.connect(o1.frequency); lfo.start(t); lfo.stop(t + dur + 0.1);
    if (drive) { const ws = C.createWaveShaper(); const curve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = (i / 128) - 1; curve[i] = Math.tanh(x * 3); } ws.curve = curve; f.connect(ws); ws.connect(g); } else f.connect(g);
    g.connect(musicGain);
  }
  function pad(t, midis, dur) {
    const g = C.createGain(); env(g, t, 0.25, 0.3, 0.045, 0.04, 0.3, dur);
    const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    midis.forEach((m) => [-6, 6].forEach((det) => { const o = C.createOscillator(); o.type = 'sawtooth'; o.frequency.value = midiToF(m); o.detune.value = det; o.connect(f); o.start(t); o.stop(t + dur + 0.4); }));
    f.connect(g); g.connect(musicGain);
  }
  function stab(t, midis) {
    const g = C.createGain(); env(g, t, 0.003, 0.08, 0.09, 0.02, 0.05);
    const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2200;
    midis.forEach((m) => { const o = C.createOscillator(); o.type = 'sawtooth'; o.frequency.value = midiToF(m); o.connect(f); o.start(t); o.stop(t + 0.2); });
    f.connect(g); g.connect(musicGain);
  }
  // шипение и щелчки пластинки
  function startCrackle() {
    if (!crackle || crackleSrc) return;
    crackleSrc = noiseSrc();
    const f = C.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 0.5;
    const g = C.createGain(); g.gain.value = 0.012;
    crackleSrc.connect(f); f.connect(g); g.connect(crackleGain); crackleSrc.start();
    crackleGain.gain.setTargetAtTime(1, C.currentTime, 0.1);
    const pop = () => {
      if (!crackleSrc) return;
      const n = noiseSrc(); const pf = C.createBiquadFilter(); pf.type = 'highpass'; pf.frequency.value = 2000;
      const pg = C.createGain(); const t = C.currentTime + 0.01; env(pg, t, 0.001, 0.004, 0.03 + Math.random() * 0.08, 0.001, 0.01);
      n.connect(pf); pf.connect(pg); pg.connect(crackleGain); n.start(t); n.stop(t + 0.05);
      popTimer = setTimeout(pop, 80 + Math.random() * 600);
    };
    pop();
  }
  function stopCrackle() {
    clearTimeout(popTimer); popTimer = null;
    if (crackleSrc) { try { crackleSrc.stop(C.currentTime + 0.2); } catch (e) {} crackleSrc = null; }
    if (crackleGain) crackleGain.gain.setTargetAtTime(0, C.currentTime, 0.05);
  }
  function needleDrop(t) {
    const n = noiseSrc(); const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g = C.createGain(); env(g, t, 0.005, 0.1, 0.25, 0.05, 0.1);
    n.connect(f); f.connect(g); g.connect(master); n.start(t); n.stop(t + 0.3);
    kick(t + 0.02, 0.5);
  }
  function needleLift() {
    const t = C.currentTime;
    const n = noiseSrc(); const f = C.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(1500, t); f.frequency.exponentialRampToValueAtTime(300, t + 0.25); f.Q.value = 2;
    const g = C.createGain(); env(g, t, 0.005, 0.1, 0.2, 0.02, 0.1);
    n.connect(f); f.connect(g); g.connect(master); n.start(t); n.stop(t + 0.3);
  }

  /* ---------- секвенсор ---------- */
  let cur = null; // {track, st, leadTok, lead2Tok, chords, bars}
  function prepare(track) {
    const st = STYLE[track.style] || STYLE.pop;
    const leadTok = tokens(track.lead), lead2Tok = tokens(track.lead2 || track.lead);
    cur = { track, st, leadTok, lead2Tok, chords: track.chords.map(chord), bars: 16 };
  }
  function scheduleStep(s, t) {
    const { track, st, leadTok, lead2Tok, chords } = cur;
    const spb = 60 / track.bpm, s16 = spb / 4, s8 = spb / 2;
    const bar = Math.floor(s / 16), inBar = s % 16;
    const section = bar % 16; // 0-3 вступление, 4-11 куплет, 12-15 припев
    const ch = chords[bar % chords.length];
    const d = DRUMS[st.drums];
    const swing = st.drums === 'swing' && inBar % 2 === 1 ? s16 * 0.3 : 0;
    const tt = t + swing;
    const intro = section < 4;
    // ударные
    if (d.k[inBar] === 'x') kick(tt, st.chip ? 0.7 : 0.9);
    if (d.s[inBar] === 'x' && !(intro && section < 2)) snare(tt, st.chip ? 0.6 : 1);
    if (d.h[inBar] === 'x' && !(intro && section < 1)) hat(tt, false, st.chip ? 0.5 : 1);
    if (d.o && d.o[inBar] === 'x' && !intro) hat(tt, true, 0.8);
    // бас
    const root = ch.root;
    if (st.bass === 'octave' && inBar % 2 === 0) bass(tt, root + ((inBar / 2) % 2 ? 12 : 0), s8 * 0.9, st.bassWave, st.chip);
    else if (st.bass === 'root8' && inBar % 2 === 0) bass(tt, root, s8 * 0.9, st.bassWave, st.chip);
    else if (st.bass === 'root16') bass(tt, root + (inBar % 4 === 3 ? 12 : 0), s16 * 0.8, st.bassWave, st.chip);
    else if (st.bass === 'long' && (inBar === 0 || inBar === 8)) bass(tt, root + (inBar === 8 ? 7 : 0), s8 * 3.8, st.bassWave, st.chip);
    else if (st.bass === 'walk' && inBar % 4 === 0) bass(tt, root + [0, 7, 12, ch.iv[1]][inBar / 4], s8 * 1.8, st.bassWave, st.chip);
    // подклад и стабы
    if (st.pad && inBar === 0) pad(tt, ch.iv.map((i) => root + 24 + i), spb * 4);
    if (st.stabs && !intro && (inBar === 2 || inBar === 6 || inBar === 10 || inBar === 14)) stab(tt, ch.iv.map((i) => root + 24 + i));
    // соло
    if (!intro && inBar % 2 === 0) {
      const toks = section >= 12 ? lead2Tok : leadTok;
      const idx = ((bar % 4) * 8 + inBar / 2) % toks.length;
      const tok = toks[idx];
      if (tok !== '.' && tok !== '-') {
        let len = 1; for (let j = idx + 1; j < toks.length && toks[j] === '.'; j++) len++;
        const midi = noteMidi(tok);
        if (midi != null) lead(tt, midi + (section >= 12 && track.style !== 'ballad' ? 0 : 0), s8 * len * 0.92, st.lead, st.chip, st.drive);
      }
    }
  }
  function tick() {
    if (!state.playing || !cur) return;
    const spb = 60 / cur.track.bpm, s16 = spb / 4;
    while (nextStep < C.currentTime + 0.3) {
      scheduleStep(step, nextStep);
      const bar = Math.floor(step / 16);
      if (bar !== state.bar) { state.bar = bar; emit(); }
      step++; nextStep += s16;
      if (step >= cur.bars * 16) {
        step = 0; state.loop++;
        if (state.loop >= loops) { setTimeout(next, 50); return; }
      }
    }
  }
  function stopExternal() {
    if (audioEl) { try { audioEl.pause(); } catch (e) {} audioEl.src = ''; audioEl = null; }
    state.embed = null; state.pos = 0; state.dur = 0;
  }
  function playTrack(id, keepQueue) {
    const track = anyById(id); if (!track) return;
    if (!ensure()) return;
    stopTimers(); stopExternal();
    if (!keepQueue) { state.queue = [id]; state.index = 0; state.queueName = ''; }
    state.playing = true; state.trackId = id; state.bar = 0; state.loop = 0; state.motor = 1;
    needleDrop(C.currentTime + 0.05);
    if (byId[id]) {
      state.kind = 'synth';
      prepare(track);
      step = 0; nextStep = C.currentTime + 0.35;
      startCrackle();
      timer = setInterval(tick, 90);
    } else if (track.kind === 'audio' && track.src) {
      state.kind = 'audio';
      audioEl = new Audio(track.src); audioEl.crossOrigin = 'anonymous'; audioEl.volume = volume;
      audioEl.addEventListener('timeupdate', () => { state.pos = audioEl.currentTime; state.dur = audioEl.duration || 0; emit(); });
      audioEl.addEventListener('ended', () => next());
      audioEl.addEventListener('error', () => { state.playing = false; state.error = 'не удалось загрузить аудио'; emit(); });
      audioEl.play().catch(() => {});
      startCrackle();
    } else if (track.embed) {
      state.kind = 'embed'; state.embed = track.embed; state.embedH = track.h || 180;
      startCrackle();
    } else {
      state.kind = 'link'; state.playing = false;
    }
    emit();
  }
  function stopTimers() { clearInterval(timer); timer = null; }
  function pause() {
    if (!state.playing) return;
    state.playing = false; state.motor = 0; stopTimers(); stopCrackle(); needleLift();
    if (audioEl) audioEl.pause();
    emit();
  }
  function resume() {
    if (state.playing || !state.trackId) return;
    ensure();
    state.playing = true; state.motor = 1;
    if (state.kind === 'synth') { nextStep = C.currentTime + 0.2; timer = setInterval(tick, 90); }
    if (audioEl) audioEl.play().catch(() => {});
    startCrackle(); emit();
  }
  function stop() { state.playing = false; state.motor = 0; stopTimers(); stopExternal(); if (C) { stopCrackle(); } state.trackId = null; state.bar = 0; emit(); }
  function playQueue(ids, name, startIndex) {
    const list = ids.filter((i) => anyById(i)); if (!list.length) return;
    state.queue = list; state.queueName = name || ''; state.index = startIndex || 0;
    playTrack(list[state.index], true);
  }
  function next() {
    if (!state.queue.length) return;
    if (state.repeat) { playTrack(state.queue[state.index], true); return; }
    if (state.shuffle && state.queue.length > 1) { let i; do { i = Math.floor(Math.random() * state.queue.length); } while (i === state.index); state.index = i; }
    else state.index = (state.index + 1) % state.queue.length;
    playTrack(state.queue[state.index], true);
  }
  function prev() {
    if (!state.queue.length) return;
    state.index = (state.index - 1 + state.queue.length) % state.queue.length;
    playTrack(state.queue[state.index], true);
  }
  function duration(id) { const t = byId[id]; return t ? Math.round(16 * 4 * 60 / t.bpm * loops) : 0; }
  function seek(sec) { if (audioEl && isFinite(sec)) audioEl.currentTime = sec; }

  return {
    TRACKS, byId, STYLE_NAMES: { eurodance: 'евродэнс', techno: 'техно', ballad: 'баллада', lounge: 'лаунж', rock: 'рок', pop: 'поп', chiptune: '8 бит' },
    play: playTrack, playQueue, pause, resume, stop, next, prev, duration, seek, parseLink, registerExternal, anyById, external,
    set shuffle(v) { state.shuffle = !!v; emit(); }, set repeat(v) { state.repeat = !!v; emit(); },
    toggle() { if (state.playing) pause(); else if (state.trackId) resume(); else playQueue(TRACKS.map((t) => t.id), 'Все хиты', 0); },
    get state() { return state; },
    get volume() { return volume; }, set volume(v) { volume = Math.max(0, Math.min(1, v)); if (master) master.gain.value = volume; if (audioEl) audioEl.volume = volume; },
    get crackle() { return crackle; }, set crackle(v) { crackle = !!v; if (C) { if (crackle && state.playing) startCrackle(); else stopCrackle(); } },
    onChange(f) { listeners.push(f); },
    unlock() { try { ensure(); } catch (e) {} },
    _render(ctx, id, seconds) { // для проверки: отрисовать трек в офлайн-контекст
      const pc = C, pm = master, pg = musicGain, pcg = crackleGain;
      C = ctx; master = ctx.createGain(); master.gain.value = volume; master.connect(ctx.destination); musicGain = ctx.createGain(); musicGain.gain.value = 0.85;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.12;
      musicGain.connect(comp); comp.connect(master); crackleGain = ctx.createGain(); crackleGain.connect(master);
      prepare(byId[id]);
      const s16 = 60 / byId[id].bpm / 4; let t = 0.05, s = 0;
      while (t < seconds) { scheduleStep(s, t); s++; t += s16; }
      C = pc; master = pm; musicGain = pg; crackleGain = pcg; cur = null;
    },
  };
})();
