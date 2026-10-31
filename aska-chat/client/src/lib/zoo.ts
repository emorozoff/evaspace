// 🦖 Зверята: супер-смайлы-животные со своим голосом на ~2 секунды. Голоса синтезируются WebAudio на лету
// (без файлов): у голосовых — высота по «кривой», форманты (как рот складывает «у», «а», «и»), раскат «р-р-р»,
// дрожание и дыхание шумом. Набор держать одинаковым с ZOO_EMOJI в server/src/personas.js.
// Эмодзи не пересекаются со звуковыми смайлами (SFX) и прежними супер-смайлами (SUPER) в sfx.ts.

export type Synth = (c: AudioContext, out: AudioNode, t: number) => void;
export interface ZooDef { e: string; name: string; anim: string; fx?: string[]; glow: string; sound: Synth }

type Pts = [number, number][]; // [секунды от начала, значение]

// плавная «кривая»: точки по времени
function ramp(p: AudioParam, t: number, pts: Pts) {
  p.setValueAtTime(pts[0][1], t + pts[0][0]);
  for (let i = 1; i < pts.length; i++) p.linearRampToValueAtTime(pts[i][1], t + pts[i][0]);
}
// громкость: подъём, держим, затухание
function envGain(c: AudioContext, t: number, dur: number, peak: number, a = 0.04, r = 0.25) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.setValueAtTime(peak, t + Math.max(a, dur - r));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  return g;
}
// лёгкий перегруз — «хрип» в голосе (если браузер умеет)
function grit(c: AudioContext, amount: number): AudioNode | null {
  if (!amount || typeof c.createWaveShaper !== 'function') return null;
  const ws = c.createWaveShaper();
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x)); }
  ws.curve = curve;
  return ws;
}

let nb: AudioBuffer | null = null;
function noiseBuf(c: AudioContext) {
  if (!nb || nb.sampleRate !== c.sampleRate) {
    nb = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return nb;
}

interface VoiceOpt {
  pts: Pts;                       // высота голоса по времени, Гц
  type?: OscillatorType;
  gain?: number; a?: number; r?: number;
  formants?: { pts: Pts; q: number; g: number }[]; // «рот»: полосы, которые подчёркивают гласную
  lp?: Pts;                       // общий фильтр по времени (открыть/закрыть рот)
  rattle?: { rate: number; depth: number }; // раскат «р-р-р» — дрожание громкости
  vib?: { rate: number; depth: number };    // дрожание высоты
  drive?: number;                 // хрип
  detune?: number;                // второй голос чуть в сторону — гуще
}
function voiced(c: AudioContext, out: AudioNode, t: number, o: VoiceOpt) {
  const dur = o.pts[o.pts.length - 1][0];
  const g = envGain(c, t, dur, o.gain ?? 0.2, o.a ?? 0.04, o.r ?? 0.2);
  const oscs: OscillatorNode[] = [];
  for (const d of o.detune ? [0, o.detune] : [0]) {
    const osc = c.createOscillator();
    osc.type = o.type || 'sawtooth';
    ramp(osc.frequency, t, o.pts.map(([at, f]) => [at, f * (1 + d)] as [number, number]));
    if (o.vib) {
      const lfo = c.createOscillator();
      const lg = c.createGain();
      lfo.frequency.value = o.vib.rate;
      lg.gain.value = o.vib.depth;
      lfo.connect(lg).connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + dur);
    }
    oscs.push(osc);
  }
  let head: AudioNode = c.createGain();
  for (const osc of oscs) osc.connect(head);
  const sh = grit(c, o.drive || 0);
  if (sh) { head.connect(sh); head = sh; }
  if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; ramp(f.frequency, t, o.lp); f.Q.value = 0.8; head.connect(f); head = f; }
  if (o.rattle) {
    const am = c.createGain();
    am.gain.value = 1 - o.rattle.depth;
    const lfo = c.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = o.rattle.rate;
    const lg = c.createGain();
    lg.gain.value = o.rattle.depth;
    lfo.connect(lg).connect(am.gain);
    lfo.start(t);
    lfo.stop(t + dur);
    head.connect(am);
    head = am;
  }
  if (o.formants?.length) {
    for (const fm of o.formants) {
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      ramp(bp.frequency, t, fm.pts);
      bp.Q.value = fm.q;
      const fg = c.createGain();
      fg.gain.value = fm.g;
      head.connect(bp).connect(fg).connect(g);
    }
  } else head.connect(g);
  g.connect(out);
  for (const osc of oscs) { osc.start(t); osc.stop(t + dur + 0.02); }
}

// дыхание, шипение, хлопки — шум через фильтр
function breath(c: AudioContext, out: AudioNode, t: number, dur: number, o: { f: Pts; q?: number; type?: BiquadFilterType; gain?: number; a?: number; r?: number; tremolo?: number }) {
  const src = c.createBufferSource();
  src.buffer = noiseBuf(c);
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = o.type || 'bandpass';
  ramp(f.frequency, t, o.f);
  f.Q.value = o.q ?? 1;
  const g = envGain(c, t, dur, o.gain ?? 0.2, o.a ?? 0.02, o.r ?? 0.15);
  let head: AudioNode = f;
  if (o.tremolo) {
    const am = c.createGain();
    am.gain.value = 0.5;
    const lfo = c.createOscillator();
    lfo.frequency.value = o.tremolo;
    const lg = c.createGain();
    lg.gain.value = 0.5;
    lfo.connect(lg).connect(am.gain);
    lfo.start(t);
    lfo.stop(t + dur);
    f.connect(am);
    head = am;
  }
  src.connect(f);
  head.connect(g).connect(out);
  src.start(t);
  src.stop(t + dur + 0.02);
}

// глухой удар — шаг, клац, топот
function thump(c: AudioContext, out: AudioNode, t: number, f = 60, gain = 0.5, dur = 0.35) {
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(f * 2, t);
  osc.frequency.exponentialRampToValueAtTime(f, t + 0.08);
  const g = envGain(c, t, dur, gain, 0.005, dur - 0.02);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}
function click(c: AudioContext, out: AudioNode, t: number, f = 3000, gain = 0.3) {
  breath(c, out, t, 0.04, { f: [[0, f]], q: 3, gain, a: 0.001, r: 0.03 });
}

// 🦖 рык динозавра: земля дрожит, низкий раскатистый «Р-Р-Р-РАААР» с хрипом, сверху — визг, в конце — выдох
export const dinoRoar: Synth = (c, o, t) => {
  thump(c, o, t, 45, 0.55, 0.4);
  thump(c, o, t + 0.28, 40, 0.45, 0.4);
  voiced(c, o, t + 0.12, { pts: [[0, 70], [0.35, 115], [0.9, 105], [1.5, 75], [1.95, 52]], gain: 0.34, a: 0.18, r: 0.5, drive: 6, detune: 0.03,
    lp: [[0, 400], [0.4, 1300], [1.2, 900], [1.95, 300]], rattle: { rate: 26, depth: 0.55 }, vib: { rate: 5, depth: 4 } });
  voiced(c, o, t + 0.35, { pts: [[0, 380], [0.35, 720], [0.9, 600], [1.6, 320]], gain: 0.07, a: 0.2, r: 0.5, drive: 3,
    formants: [{ pts: [[0, 900], [0.5, 1300], [1.6, 700]], q: 4, g: 1 }], vib: { rate: 7, depth: 18 } });
  breath(c, o, t + 0.1, 2.05, { f: [[0, 300], [0.5, 900], [1.4, 500], [2.05, 180]], q: 0.9, gain: 0.22, a: 0.2, r: 0.5 });
};

// тише других вышли — подтягиваем громкость
const louder = (k: number, fn: Synth): Synth => (c, o, t) => { const g = c.createGain(); g.gain.value = k; g.connect(o); fn(c, g, t); };

export const ZOO: ZooDef[] = [
  { e: '🦕', name: 'у-у-ум', anim: 'stomp', glow: '#7fd8a8', sound: (c, o, t) => { // бронтозавр: шаги и низкий гул, как пароход
    [0, 0.45, 0.9].forEach((d) => thump(c, o, t + d, 42, 0.5, 0.35));
    voiced(c, o, t + 0.3, { pts: [[0, 58], [0.6, 66], [1.6, 50]], gain: 0.3, a: 0.3, r: 0.6, lp: [[0, 250], [0.6, 520], [1.6, 200]], vib: { rate: 3, depth: 2 }, detune: 0.5 });
  } },
  { e: '🦁', name: 'рык', anim: 'roar', glow: '#ffb347', sound: (c, o, t) => { // лев: «ух» и рокочущий рёв
    voiced(c, o, t, { pts: [[0, 140], [0.15, 110]], gain: 0.25, a: 0.01, r: 0.1, drive: 4, lp: [[0, 900], [0.15, 600]] });
    voiced(c, o, t + 0.25, { pts: [[0, 95], [0.4, 150], [1.1, 120], [1.75, 70]], gain: 0.32, a: 0.12, r: 0.5, drive: 5, detune: 0.02,
      lp: [[0, 500], [0.4, 1600], [1.75, 400]], rattle: { rate: 18, depth: 0.45 } });
    breath(c, o, t + 0.25, 1.75, { f: [[0, 500], [0.5, 1200], [1.75, 300]], q: 1, gain: 0.16, a: 0.15, r: 0.5 });
  } },
  { e: '🐺', name: 'а-у-у-у', anim: 'howl', fx: ['🌕'], glow: '#c9d6ff', sound: (c, o, t) => { // волк воет на луну
    voiced(c, o, t, { pts: [[0, 330], [0.45, 640], [1.4, 600], [2.1, 380]], type: 'triangle', gain: 0.22, a: 0.25, r: 0.5,
      formants: [{ pts: [[0, 700], [2.1, 500]], q: 2, g: 1.4 }], vib: { rate: 5.5, depth: 9 } });
    voiced(c, o, t, { pts: [[0, 660], [0.45, 1280], [1.4, 1200], [2.1, 760]], type: 'sine', gain: 0.05, a: 0.3, r: 0.5, vib: { rate: 5.5, depth: 18 } });
  } },
  { e: '🐶', name: 'гав-гав', anim: 'wag', fx: ['🦴'], glow: '#ffd27a', sound: louder(1.5, (c, o, t) => { // пёс: два громких «гав» и радостный скулёж
    [0, 0.32].forEach((d) => {
      voiced(c, o, t + d, { pts: [[0, 420], [0.05, 520], [0.18, 300]], gain: 0.3, a: 0.005, r: 0.1, drive: 5,
        formants: [{ pts: [[0, 700], [0.18, 500]], q: 2.5, g: 1.4 }, { pts: [[0, 1600], [0.18, 1200]], q: 4, g: 0.6 }] });
      breath(c, o, t + d, 0.16, { f: [[0, 1200], [0.16, 600]], q: 1.2, gain: 0.18, a: 0.004, r: 0.1 });
    });
    voiced(c, o, t + 0.85, { pts: [[0, 900], [0.3, 1300], [0.6, 1100], [1.1, 1400]], type: 'triangle', gain: 0.08, a: 0.08, r: 0.2, vib: { rate: 9, depth: 60 } });
  }) },
  { e: '🐈', name: 'мя-а-ау', anim: 'nod', glow: '#ffcfa8', sound: louder(1.8, (c, o, t) => { // кошка: «м-и-а-у» — рот открывается и закрывается
    const meow = (d: number, k: number) => voiced(c, o, t + d, { pts: [[0, 520 * k], [0.25, 800 * k], [0.55, 700 * k], [0.85, 480 * k]], gain: 0.22, a: 0.06, r: 0.25,
      formants: [{ pts: [[0, 350], [0.3, 900], [0.85, 380]], q: 5, g: 1.6 }, { pts: [[0, 2400], [0.3, 1500], [0.85, 900]], q: 7, g: 0.8 }], vib: { rate: 6, depth: 12 } });
    meow(0, 1);
    meow(1, 1.12);
  }) },
  { e: '🐮', name: 'му-у-у', anim: 'sway', glow: '#ffe3f0', sound: (c, o, t) => { // корова: «мммуууу»
    voiced(c, o, t, { pts: [[0, 125], [0.4, 140], [1.5, 118], [1.9, 105]], gain: 0.3, a: 0.2, r: 0.4, detune: 0.01,
      lp: [[0, 300], [0.35, 300], [0.7, 1100], [1.5, 900], [1.9, 350]], vib: { rate: 4, depth: 2 } });
  } },
  { e: '🐷', name: 'хрю-хрю', anim: 'bounce', glow: '#ffb3c7', sound: louder(4, (c, o, t) => { // поросёнок: три хрюка
    [0, 0.3, 0.6, 1.2].forEach((d, i) => voiced(c, o, t + d, { pts: [[0, 240 + i * 15], [0.18, 190]], gain: 0.22, a: 0.01, r: 0.08, rattle: { rate: 55, depth: 0.7 },
      formants: [{ pts: [[0, 950], [0.18, 800]], q: 6, g: 1.8 }] }));
    voiced(c, o, t + 1.45, { pts: [[0, 900], [0.25, 1500], [0.45, 1100]], type: 'square', gain: 0.06, a: 0.02, r: 0.15, formants: [{ pts: [[0, 1600]], q: 3, g: 1 }] });
  }) },
  { e: '🐑', name: 'бе-е-е', anim: 'shiver', glow: '#f2f2f2', sound: louder(3.2, (c, o, t) => { // овечка: дрожащее «бе-е-е»
    voiced(c, o, t, { pts: [[0, 380], [0.1, 430], [1.3, 410], [1.6, 360]], gain: 0.22, a: 0.03, r: 0.3, rattle: { rate: 7.5, depth: 0.6 },
      formants: [{ pts: [[0, 500], [0.1, 700], [1.6, 650]], q: 4, g: 1.4 }, { pts: [[0, 1900], [1.6, 1800]], q: 6, g: 0.7 }] });
  }) },
  { e: '🐴', name: 'и-го-го', anim: 'tip', glow: '#d7a86e', sound: louder(2.6, (c, o, t) => { // лошадь: ржание вниз с дрожью и фырканье
    voiced(c, o, t, { pts: [[0, 1100], [0.2, 1300], [0.9, 750], [1.3, 600]], gain: 0.13, a: 0.03, r: 0.3, vib: { rate: 13, depth: 110 },
      formants: [{ pts: [[0, 1600], [1.3, 1000]], q: 3, g: 1.5 }] });
    breath(c, o, t + 1.45, 0.45, { f: [[0, 700], [0.45, 300]], q: 0.8, gain: 0.25, a: 0.01, r: 0.3, tremolo: 30 });
  }) },
  { e: '🐘', name: 'ту-ру-ру', anim: 'stomp', glow: '#b8c7d9', sound: (c, o, t) => { // слон трубит хоботом
    thump(c, o, t, 40, 0.45, 0.4);
    voiced(c, o, t + 0.2, { pts: [[0, 380], [0.25, 700], [0.9, 680], [1.6, 520]], gain: 0.2, a: 0.08, r: 0.4, drive: 4, detune: 0.015,
      formants: [{ pts: [[0, 1000], [0.3, 1500], [1.6, 1100]], q: 3, g: 1.6 }], vib: { rate: 6, depth: 14 } });
  } },
  { e: '🐝', name: 'ж-ж-ж', anim: 'buzz', glow: '#ffe14d', sound: louder(1.6, (c, o, t) => { // пчела пролетает мимо
    voiced(c, o, t, { pts: [[0, 200], [0.8, 260], [1.8, 205]], gain: 0.13, a: 0.3, r: 0.6, detune: 0.012, vib: { rate: 24, depth: 7 },
      formants: [{ pts: [[0, 500], [0.8, 1200], [1.8, 450]], q: 1.2, g: 1.4 }] });
  }) },
  { e: '🦉', name: 'у-ху', anim: 'nod', fx: ['🌙'], glow: '#c3a3ff', sound: louder(1.3, (c, o, t) => { // сова: «у-ху… у-у-у»
    [[0, 0.35, 390], [0.45, 0.25, 360], [1.0, 0.25, 380], [1.3, 0.5, 350]].forEach(([d, dur, f]) =>
      voiced(c, o, t + d, { pts: [[0, f], [dur * 0.4, f * 1.06], [dur, f * 0.94]], type: 'sine', gain: 0.24, a: dur * 0.35, r: dur * 0.5, lp: [[0, 800]] }));
  }) },
  { e: '🐓', name: 'ку-ка-ре-ку', anim: 'peck', fx: ['☀️'], glow: '#ff9a3c', sound: louder(1.6, (c, o, t) => { // петух: «ку-ка-ре-кууу»
    [[0, 0.16, 650, 700], [0.2, 0.16, 820, 880], [0.4, 0.2, 1000, 1080], [0.66, 1.1, 1150, 760]].forEach(([d, dur, f1, f2]) =>
      voiced(c, o, t + d, { pts: [[0, f1], [dur * 0.3, f1 * 1.08], [dur, f2]], gain: 0.15, a: 0.02, r: 0.12, drive: 3, vib: { rate: 10, depth: 25 },
        formants: [{ pts: [[0, 1300]], q: 3, g: 1.5 }, { pts: [[0, 2600]], q: 5, g: 0.6 }] }));
  }) },
  { e: '🐍', name: 'ш-ш-ш', anim: 'sway', glow: '#9be36b', sound: (c, o, t) => { // змея: шипение и погремушка
    breath(c, o, t, 1.3, { f: [[0, 5000], [1.3, 6500]], q: 0.7, type: 'highpass', gain: 0.2, a: 0.2, r: 0.3 });
    breath(c, o, t + 1.25, 0.75, { f: [[0, 4000]], q: 2, gain: 0.22, a: 0.01, r: 0.1, tremolo: 40 });
  } },
  { e: '🐬', name: 'и-и-и!', anim: 'swim', fx: ['💦'], glow: '#7ec8ff', sound: louder(2.2, (c, o, t) => { // дельфин: щелчки и свист
    for (let i = 0; i < 10; i++) click(c, o, t + i * 0.045, 2500 + (i % 3) * 600, 0.22);
    voiced(c, o, t + 0.55, { pts: [[0, 1800], [0.25, 3200], [0.5, 2400], [0.75, 3600], [1.1, 2000]], type: 'sine', gain: 0.12, a: 0.03, r: 0.2 });
    voiced(c, o, t + 1.75, { pts: [[0, 2600], [0.4, 3800]], type: 'sine', gain: 0.1, a: 0.02, r: 0.15 });
  }) },
  { e: '🐋', name: 'песня кита', anim: 'swim', fx: ['🫧'], glow: '#5b8cff', sound: (c, o, t) => { // кит: долгие плавные голоса в глубине
    voiced(c, o, t, { pts: [[0, 180], [0.7, 420], [1.4, 260], [2.1, 160]], type: 'sine', gain: 0.22, a: 0.4, r: 0.6, vib: { rate: 2, depth: 8 } });
    voiced(c, o, t + 0.4, { pts: [[0, 600], [0.9, 380], [1.6, 520]], type: 'triangle', gain: 0.06, a: 0.4, r: 0.6, lp: [[0, 900]] });
  } },
  { e: '🦜', name: 'кр-р-ра! привет!', anim: 'flap', fx: ['🪶'], glow: '#4cd97b', sound: louder(2.4, (c, o, t) => { // попугай: «кра!» и «при-вет!»
    voiced(c, o, t, { pts: [[0, 1100], [0.25, 800]], gain: 0.15, a: 0.01, r: 0.1, drive: 6, rattle: { rate: 40, depth: 0.5 }, formants: [{ pts: [[0, 1800], [0.25, 1300]], q: 2, g: 1.6 }] });
    voiced(c, o, t + 0.55, { pts: [[0, 900], [0.18, 1100]], type: 'square', gain: 0.07, a: 0.01, r: 0.08,
      formants: [{ pts: [[0, 600], [0.18, 2300]], q: 5, g: 1.2 }, { pts: [[0, 2600]], q: 6, g: 0.5 }] }); // «при»
    voiced(c, o, t + 0.8, { pts: [[0, 1050], [0.3, 950]], type: 'square', gain: 0.07, a: 0.01, r: 0.1,
      formants: [{ pts: [[0, 500], [0.3, 550]], q: 5, g: 1.2 }, { pts: [[0, 1800], [0.3, 1900]], q: 6, g: 0.7 }] }); // «вет»
    click(c, o, t + 1.12, 5000, 0.18);
    voiced(c, o, t + 1.4, { pts: [[0, 1600], [0.15, 2300], [0.3, 1900]], type: 'sine', gain: 0.1, a: 0.01, r: 0.1 });
  }) },
  { e: '🐒', name: 'у-у-а-а', anim: 'crazy', fx: ['🍌'], glow: '#d9a35b', sound: louder(1.5, (c, o, t) => { // обезьяна: «у-у-а-а-а!»
    [[0, 0.22, 380, 520], [0.25, 0.22, 420, 600], [0.55, 0.28, 700, 1200], [0.85, 0.28, 760, 1300], [1.15, 0.5, 820, 1500]].forEach(([d, dur, f1, f2], i) =>
      voiced(c, o, t + d, { pts: [[0, f1], [dur, f2]], type: i < 2 ? 'triangle' : 'sawtooth', gain: i < 2 ? 0.2 : 0.12, a: 0.03, r: 0.1,
        formants: [{ pts: [[0, i < 2 ? 450 : 900], [dur, i < 2 ? 500 : 1200]], q: 3, g: 1.5 }] }));
  }) },
  { e: '🦗', name: 'стрекот', anim: 'shiver', fx: ['🌙'], glow: '#b7f28a', sound: louder(4.5, (c, o, t) => { // сверчок летним вечером
    for (let k = 0; k < 6; k++) voiced(c, o, t + k * 0.32, { pts: [[0, 4400], [0.18, 4500]], type: 'sine', gain: 0.07, a: 0.01, r: 0.05, rattle: { rate: 45, depth: 0.9 } });
  }) },
  { e: '🐊', name: 'клац!', anim: 'rage', glow: '#6bbf59', sound: (c, o, t) => { // крокодил: низкий рык и щелчок челюстей
    voiced(c, o, t, { pts: [[0, 60], [0.8, 75], [1.2, 55]], gain: 0.3, a: 0.2, r: 0.3, drive: 5, lp: [[0, 300], [0.6, 500], [1.2, 250]], rattle: { rate: 14, depth: 0.6 } });
    thump(c, o, t + 1.3, 120, 0.5, 0.18);
    click(c, o, t + 1.3, 2200, 0.4);
    thump(c, o, t + 1.6, 120, 0.4, 0.18);
    click(c, o, t + 1.6, 2600, 0.35);
  } },
];

const ZOO_BY = new Map(ZOO.map((x) => [x.e.replace(/️/g, ''), x]));
export const zooOf = (text?: string) => (text ? ZOO_BY.get(text.trim().replace(/️/g, '')) : undefined);
