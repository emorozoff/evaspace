// Звуковые смайлы: отправил эмодзи из этого набора — у тебя и у друга он звучит.
// В сообщении это обычный текст (сам эмодзи), шифрование и протокол те же. Звуки синтезируются
// на лету: часть — голоса смайлов «Аськи» (AskaSound.smile), часть — свои ниже.
import { audioCtx, soundEnabled } from './aska.ts';

type Synth = (c: AudioContext, out: AudioNode, t: number) => void;

function tone(c: AudioContext, out: AudioNode, t: number, dur: number, o: { f: number; fEnd?: number; type?: OscillatorType; gain?: number; a?: number; lp?: number }) {
  const osc = c.createOscillator();
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(o.f, t);
  if (o.fEnd) osc.frequency.exponentialRampToValueAtTime(o.fEnd, t + dur);
  const g = c.createGain();
  const peak = o.gain ?? 0.25;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + (o.a ?? 0.008));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let last: AudioNode = osc;
  if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); last = f; }
  last.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

let noiseBuf: AudioBuffer | null = null;
function noise(c: AudioContext, out: AudioNode, t: number, dur: number, o: { f: number; fEnd?: number; q?: number; type?: BiquadFilterType; gain?: number; a?: number }) {
  if (!noiseBuf || noiseBuf.sampleRate !== c.sampleRate) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = o.type || 'bandpass';
  f.frequency.setValueAtTime(o.f, t);
  if (o.fEnd) f.frequency.exponentialRampToValueAtTime(o.fEnd, t + dur);
  f.Q.value = o.q ?? 1;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(o.gain ?? 0.3, t + (o.a ?? 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t);
  src.stop(t + dur + 0.05);
}

const SYNTH: Record<string, Synth> = {
  fire: (c, o, t) => { // вжух и треск костра
    noise(c, o, t, 0.6, { f: 400, fEnd: 2400, q: 0.8, gain: 0.35, a: 0.08 });
    for (let i = 0; i < 7; i++) noise(c, o, t + 0.15 + Math.random() * 0.5, 0.03, { f: 3000 + Math.random() * 3000, q: 4, gain: 0.25 });
  },
  skull: (c, o, t) => { // ксилофон из косточек: тук-тук-тук вниз
    [784, 659, 523, 392].forEach((f, i) => tone(c, o, t + i * 0.11, 0.18, { f, type: 'triangle', gain: 0.32, a: 0.002 }));
  },
  clap: (c, o, t) => { // аплодисменты
    for (let i = 0; i < 16; i++) noise(c, o, t + i * 0.055 + Math.random() * 0.03, 0.05, { f: 1500 + Math.random() * 1200, q: 1.2, gain: 0.35 });
  },
  drum: (c, o, t) => { // ба-дум-тсс
    tone(c, o, t, 0.15, { f: 180, fEnd: 90, gain: 0.5, a: 0.002 });
    tone(c, o, t + 0.16, 0.2, { f: 150, fEnd: 70, gain: 0.55, a: 0.002 });
    noise(c, o, t + 0.36, 0.5, { f: 8000, type: 'highpass', q: 0.5, gain: 0.22, a: 0.002 });
  },
  frog: (c, o, t) => { // ква-ква
    [0, 0.22].forEach((d) => tone(c, o, t + d, 0.16, { f: 180, fEnd: 120, type: 'square', gain: 0.12, lp: 900 }));
  },
  horn: (c, o, t) => { // дудка: ту-ту-туу
    [[0, 0.12], [0.15, 0.12], [0.3, 0.45]].forEach(([d, dur]) => {
      tone(c, o, t + d, dur, { f: 466, type: 'sawtooth', gain: 0.12, lp: 2200 });
      tone(c, o, t + d, dur, { f: 587, type: 'sawtooth', gain: 0.09, lp: 2200 });
    });
  },
  clown: (c, o, t) => { // клаксон: би-бип
    [0, 0.2].forEach((d) => { tone(c, o, t + d, 0.15, { f: 380, type: 'square', gain: 0.12, lp: 1400 }); tone(c, o, t + d, 0.15, { f: 480, type: 'square', gain: 0.1, lp: 1400 }); });
  },
  poop: (c, o, t) => { // пффф
    tone(c, o, t, 0.45, { f: 90, fEnd: 60, type: 'sawtooth', gain: 0.18, lp: 400 });
    noise(c, o, t, 0.45, { f: 300, fEnd: 150, q: 2, gain: 0.15 });
  },
  rocket: (c, o, t) => { // взлёт
    noise(c, o, t, 1, { f: 200, fEnd: 4000, q: 1.5, gain: 0.3, a: 0.1 });
    tone(c, o, t, 1, { f: 200, fEnd: 1600, type: 'triangle', gain: 0.1 });
  },
  bell: (c, o, t) => { // дзынь
    [[1320, 0.3], [1980, 0.12], [2640, 0.08]].forEach(([f, g]) => tone(c, o, t, 1.1, { f, gain: g, a: 0.002 }));
  },
  duck: (c, o, t) => { // кря
    tone(c, o, t, 0.22, { f: 520, fEnd: 380, type: 'sawtooth', gain: 0.14, lp: 1600 });
    tone(c, o, t + 0.26, 0.2, { f: 500, fEnd: 360, type: 'sawtooth', gain: 0.12, lp: 1600 });
  },
  cat: (c, o, t) => { // мяу
    tone(c, o, t, 0.5, { f: 520, fEnd: 880, type: 'triangle', gain: 0.18, a: 0.05 });
    tone(c, o, t + 0.25, 0.35, { f: 880, fEnd: 500, type: 'triangle', gain: 0.16 });
  },
  wave: (c, o, t) => { // фьють — свист
    tone(c, o, t, 0.18, { f: 1200, fEnd: 2400, gain: 0.18 });
    tone(c, o, t + 0.22, 0.3, { f: 2400, fEnd: 1000, gain: 0.16 });
  },
  money: (c, o, t) => { // ка-чинг
    noise(c, o, t, 0.06, { f: 2500, q: 3, gain: 0.3 });
    [2093, 2637, 3136].forEach((f, i) => tone(c, o, t + 0.08 + i * 0.04, 0.6, { f, gain: 0.12, a: 0.002 }));
  },
  sad: (c, o, t) => { // грустный тромбон: ва-ва-ва-ваааа
    [[311, 0.3], [294, 0.3], [277, 0.3], [262, 0.8]].forEach(([f, dur], i) => tone(c, o, t + i * 0.32, dur, { f, fEnd: i === 3 ? 240 : undefined, type: 'sawtooth', gain: 0.12, lp: 900 }));
  },
  zap: (c, o, t) => { // разряд
    tone(c, o, t, 0.25, { f: 1800, fEnd: 120, type: 'square', gain: 0.1, lp: 3000 });
    noise(c, o, t, 0.25, { f: 5000, fEnd: 500, q: 1, gain: 0.18 });
  },
  heart: (c, o, t) => { // тук-тук и перелив
    [0, 0.18].forEach((d) => tone(c, o, t + d, 0.14, { f: 70, fEnd: 45, gain: 0.5, a: 0.003, lp: 200 }));
    [784, 988, 1175].forEach((f, i) => tone(c, o, t + 0.4 + i * 0.07, 0.5, { f, gain: 0.08 }));
  },
};

// Порядок — как в панели. smile: голос смайла «Аськи», synth — свой звук
export const SFX: { e: string; name: string; smile?: string; synth?: string }[] = [
  { e: '😂', name: 'ржака', smile: 'laugh' },
  { e: '🔥', name: 'огонь', synth: 'fire' },
  { e: '💀', name: 'я умер', synth: 'skull' },
  { e: '👏', name: 'браво', synth: 'clap' },
  { e: '🥁', name: 'ба-дум-тсс', synth: 'drum' },
  { e: '😘', name: 'чмок', smile: 'kiss' },
  { e: '🫶', name: 'люблю', synth: 'heart' },
  { e: '😭', name: 'плачу', smile: 'cry' },
  { e: '😱', name: 'шок', smile: 'shock' },
  { e: '🤔', name: 'хм', smile: 'think' },
  { e: '🎉', name: 'туса', smile: 'party' },
  { e: '🥂', name: 'чин-чин', smile: 'wine' },
  { e: '😎', name: 'чётко', smile: 'cool' },
  { e: '😡', name: 'бесит', smile: 'angry' },
  { e: '😴', name: 'сплю', smile: 'zzz' },
  { e: '😈', name: 'муа-ха-ха', smile: 'devil' },
  { e: '🐸', name: 'ква', synth: 'frog' },
  { e: '🦆', name: 'кря', synth: 'duck' },
  { e: '🐱', name: 'мяу', synth: 'cat' },
  { e: '📯', name: 'ту-ту', synth: 'horn' },
  { e: '🤡', name: 'клоун', synth: 'clown' },
  { e: '💩', name: 'пфф', synth: 'poop' },
  { e: '🚀', name: 'взлёт', synth: 'rocket' },
  { e: '🔔', name: 'дзынь', synth: 'bell' },
  { e: '👋', name: 'фьють', synth: 'wave' },
  { e: '💸', name: 'ка-чинг', synth: 'money' },
  { e: '😿', name: 'грусть', synth: 'sad' },
  { e: '⚡', name: 'разряд', synth: 'zap' },
];
const BY_EMOJI = new Map(SFX.map((x) => [x.e, x]));

// Сообщение — один звуковой смайл (можно с вариантом эмодзи)?
export function sfxOf(text?: string) {
  if (!text) return undefined;
  return BY_EMOJI.get(text.trim().replace(/️/g, ''));
}

export function playSfx(e: string) {
  const x = BY_EMOJI.get(e);
  if (!x || !soundEnabled()) return;
  if (x.smile) {
    try { window.AskaSound?.smile(x.smile); } catch { /* звук не обязателен */ }
    return;
  }
  const c = audioCtx();
  const fn = x.synth && SYNTH[x.synth];
  if (!c || !fn) return;
  try {
    const out = c.createGain();
    out.gain.value = 0.8;
    out.connect(c.destination);
    fn(c, out, c.currentTime + 0.01);
  } catch { /* звук не обязателен */ }
}

// Только эмодзи (1–3 штуки) — показываем крупно, без пузыря
const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*\s*){1,3}$/u;
export const isEmojiOnly = (text?: string) => !!text && text.length <= 24 && EMOJI_ONLY.test(text.trim());
