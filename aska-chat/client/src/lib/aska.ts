// Обёртки над графикой и звуками «Аськи» + выбор дизайна (Зумер / Миллениал).
// Если файлы «Аськи» почему-то не загрузились, приложение работает без цветочков и звуков.

export type Design = 'zoomer' | 'millennial';
const DESIGN_KEY = 'aska-design';
const SOUND_KEY = 'aska-sound';

function readLS(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeLS(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* приватный режим */ }
}

export function getDesign(): Design {
  return readLS(DESIGN_KEY) === 'millennial' ? 'millennial' : 'zoomer';
}

export function applyDesign(d: Design) {
  document.body.classList.toggle('skin-aero', d === 'zoomer');
  document.body.classList.toggle('skin-classic', d === 'millennial');
  document.body.classList.add('theme-chat');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', d === 'zoomer' ? '#2c8de0' : '#0a246a');
}

export function setDesign(d: Design) {
  writeLS(DESIGN_KEY, d);
  applyDesign(d);
}

// ---------- цветочки ----------

export function flower(status: string, size = 16): string {
  return window.AskaArt?.statusFlower(status, size) ?? '';
}

export function logoFlower(size = 44): string {
  return window.AskaArt?.flowerSvg('#3cb44a', size, { logo: true }) ?? '';
}

export function envelope(size = 16): string {
  return window.AskaArt?.envelopeSvg(size) ?? '✉';
}

// ---------- смайлы ----------

interface SmileCode { code: string; id: string }
let smileCodes: SmileCode[] | null = null;
function codes(): SmileCode[] {
  if (!smileCodes) {
    const list = window.AskaArt?.SMILES ?? [];
    smileCodes = list.flatMap((s) => s.codes.map((code) => ({ code, id: s.id })))
      .sort((a, b) => b.code.length - a.code.length);
  }
  return smileCodes;
}

export function smiles() {
  return window.AskaArt?.SMILES ?? [];
}

export function smileSvg(id: string, size = 18): string {
  return window.AskaArt?.smileSvg(id, size) ?? '';
}

export type TextPart = { text: string } | { smile: string; code: string };

// Делит текст на обычные куски и смайлы вида :) ;) <3 — как в «Аське».
export function splitSmiles(text: string): TextPart[] {
  const list = codes();
  if (!list.length) return [{ text }];
  const parts: TextPart[] = [];
  let buf = '';
  let i = 0;
  outer: while (i < text.length) {
    for (const c of list) {
      if (text.startsWith(c.code, i)) {
        const prev = i > 0 ? text[i - 1] : ' ';
        // смайл должен стоять отдельно (не внутри ссылки вроде http://)
        if (/\s|[(,.!?]/.test(prev) || i === 0) {
          if (buf) { parts.push({ text: buf }); buf = ''; }
          parts.push({ smile: c.id, code: c.code });
          i += c.code.length;
          continue outer;
        }
      }
    }
    buf += text[i];
    i += 1;
  }
  if (buf) parts.push({ text: buf });
  return parts;
}

// ---------- звуки ----------
// Настоящие звуки ICQ 99a лежат только на сервере (/sounds/…, в репозиторий не попадают — права у ICQ).
// Есть файл — играет он, нет — синтезированный звук «Аськи».
const REAL: Record<string, string> = { incoming: '/sounds/uh-oh.wav', online: '/sounds/online.wav', sent: '/sounds/sent.wav' };
let ctx: AudioContext | null = null;
const buffers = new Map<string, AudioBuffer>();
let realLoading: Promise<void> | null = null;

function audio(): AudioContext | null {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function loadRealSounds() {
  if (realLoading) return realLoading;
  realLoading = (async () => {
    const c = audio();
    if (!c) return;
    await Promise.all(Object.entries(REAL).map(async ([name, url]) => {
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        buffers.set(name, await c.decodeAudioData(await res.arrayBuffer()));
      } catch { /* нет файла — останется синтезированный звук */ }
    }));
  })();
  return realLoading;
}

export function realSoundsLoaded() {
  return [...buffers.keys()];
}

export function soundEnabled() {
  return readLS(SOUND_KEY) !== 'off';
}

export function setSoundEnabled(on: boolean) {
  writeLS(SOUND_KEY, on ? 'on' : 'off');
  if (window.AskaSound) window.AskaSound.enabled = on;
}

export function play(name: 'incoming' | 'sent' | 'online' | 'offline' | 'connect' | 'error' | 'click') {
  if (!soundEnabled()) return;
  const buf = buffers.get(name);
  if (buf && ctx) {
    try {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start();
      return;
    } catch { /* играем запасной */ }
  }
  try { window.AskaSound?.play(name); } catch { /* звук не обязателен */ }
}

export function playSmile(id: string) {
  if (!soundEnabled()) return;
  try { window.AskaSound?.smile(id); } catch { /* звук не обязателен */ }
}

// iPhone разрешает звук только после первого касания.
export function unlockSoundOnFirstTouch() {
  if (window.AskaSound) window.AskaSound.enabled = soundEnabled();
  loadRealSounds();
  const unlock = () => {
    try { window.AskaSound?.unlock(); } catch { /* нет звука */ }
    const c = audio();
    if (c) {
      // тихий звук «разблокирует» воспроизведение на iPhone
      try {
        const src = c.createBufferSource();
        src.buffer = c.createBuffer(1, 1, 22050);
        src.connect(c.destination);
        src.start();
      } catch { /* пусто */ }
    }
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}
