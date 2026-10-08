/* АСЬКА — звуки. Ничего не скачивается: все звуки синтезируются
   на лету через Web Audio, поэтому работают офлайн и весят 0 байт.
   Главный — «о-оу» при входящем сообщении. У каждого смайла свой голос. */

window.AskaSound = (function () {
  let C = null;            // AudioContext
  let OUT = null;          // мастер-громкость
  let enabled = true;
  let volume = 0.8;

  function ensure() {
    if (!C) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      C = new AC();
      OUT = C.createGain();
      OUT.gain.value = volume;
      OUT.connect(C.destination);
    }
    if (C.state === 'suspended') C.resume().catch(() => {});
    return C;
  }

  /* ---------- кирпичики ---------- */

  function env(g, t0, dur, peak, a, r) {
    a = a == null ? 0.008 : a;
    r = r == null ? Math.min(0.06, dur / 2) : r;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + a);
    if (dur - r > a) g.gain.setValueAtTime(peak, t0 + dur - r);
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
  }

  // простой тон: синус/треугольник/квадрат с огибающей и скольжением частоты
  function tone(t0, dur, o) {
    const osc = C.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t0);
    if (o.fEnd) osc.frequency.exponentialRampToValueAtTime(o.fEnd, t0 + (o.slide || dur));
    if (o.detune) osc.detune.value = o.detune;
    const g = C.createGain();
    env(g, t0, dur, o.gain == null ? 0.25 : o.gain, o.a, o.r);
    let last = osc;
    if (o.lp) {
      const f = C.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = o.q || 0.7;
      last.connect(f); last = f;
    }
    if (o.trem) { // амплитудное дрожание
      const tg = C.createGain(); tg.gain.value = 0.5;
      const lfo = C.createOscillator(); lfo.frequency.value = o.trem;
      const lg = C.createGain(); lg.gain.value = 0.5;
      lfo.connect(lg); lg.connect(tg.gain);
      last.connect(tg); last = tg;
      lfo.start(t0); lfo.stop(t0 + dur + 0.05);
    }
    last.connect(g); g.connect(OUT);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }

  let noiseBuf = null;
  function noise(t0, dur, o) {
    if (!noiseBuf || noiseBuf.sampleRate !== C.sampleRate) {
      noiseBuf = C.createBuffer(1, C.sampleRate * 2, C.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = C.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    const f = C.createBiquadFilter();
    f.type = o.type || 'bandpass';
    f.frequency.setValueAtTime(o.f || 1000, t0);
    if (o.fEnd) f.frequency.exponentialRampToValueAtTime(o.fEnd, t0 + dur);
    f.Q.value = o.q || 1;
    const g = C.createGain();
    env(g, t0, dur, o.gain == null ? 0.2 : o.gain, o.a, o.r);
    let last = f;
    if (o.trem) {
      const tg = C.createGain(); tg.gain.value = 0.5;
      const lfo = C.createOscillator(); lfo.frequency.value = o.trem;
      const lg = C.createGain(); lg.gain.value = 0.5;
      lfo.connect(lg); lg.connect(tg.gain);
      last.connect(tg); last = tg;
      lfo.start(t0); lfo.stop(t0 + dur + 0.05);
    }
    src.connect(f); last.connect(g); g.connect(OUT);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }

  // «голос»: пила через формантные фильтры — получаются гласные
  const VOWELS = {
    a: [[730, 1090, 2440], [1, 0.5, 0.2]],
    e: [[530, 1840, 2480], [1, 0.4, 0.2]],
    i: [[270, 2290, 3010], [1, 0.3, 0.2]],
    o: [[570, 840, 2410], [1, 0.45, 0.15]],
    u: [[300, 870, 2240], [1, 0.3, 0.1]],
    uh: [[640, 1190, 2390], [1, 0.5, 0.2]],   // «а» как в «uh»
    oh: [[450, 1000, 2400], [1, 0.35, 0.12]], // «о-оу»
    m: [[250, 1100, 2100], [1, 0.08, 0.03]],
  };
  function vowel(t0, dur, o) {
    const src = C.createOscillator();
    src.type = o.type || 'sawtooth';
    src.frequency.setValueAtTime(o.f, t0);
    src.frequency.exponentialRampToValueAtTime(o.fEnd || o.f, t0 + dur);
    if (o.vib) {
      const lfo = C.createOscillator(); lfo.frequency.value = o.vibRate || 6;
      const lg = C.createGain(); lg.gain.value = o.vib;
      lfo.connect(lg); lg.connect(src.frequency);
      lfo.start(t0); lfo.stop(t0 + dur + 0.05);
    }
    const out = C.createGain();
    env(out, t0, dur, o.gain == null ? 0.5 : o.gain, o.a == null ? 0.02 : o.a, o.r == null ? 0.05 : o.r);
    const v1 = VOWELS[o.v || 'a'];
    const v2 = VOWELS[o.vEnd || o.v || 'a'];
    v1[0].forEach((f, i) => {
      const bp = C.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(f, t0);
      bp.frequency.linearRampToValueAtTime(v2[0][i], t0 + dur);
      bp.Q.value = o.q || 9;
      const fg = C.createGain(); fg.gain.value = v1[1][i] * 2.2;
      src.connect(bp); bp.connect(fg); fg.connect(out);
    });
    if (o.breath) noise(t0, dur, { type: 'bandpass', f: 1800, q: 0.8, gain: o.breath, a: 0.02 });
    out.connect(OUT);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }

  /* ---------- системные звуки ---------- */
  const S = {};

  // Фирменное «о-оу!» — входящее сообщение
  S.incoming = (t) => {
    vowel(t, 0.16, { v: 'uh', f: 330, fEnd: 300, gain: 0.8, a: 0.015, r: 0.04 });
    vowel(t + 0.21, 0.34, { v: 'oh', vEnd: 'u', f: 290, fEnd: 185, gain: 0.85, a: 0.02, r: 0.12, vib: 4, vibRate: 5 });
    return 0.6;
  };
  // сообщение отправлено — короткий «свист-щелчок»
  S.sent = (t) => {
    noise(t, 0.1, { f: 900, fEnd: 3200, q: 2, gain: 0.22, a: 0.005 });
    tone(t + 0.03, 0.06, { f: 1800, fEnd: 2600, gain: 0.14 });
    return 0.15;
  };
  // контакт появился в сети — два колокольчика вверх
  S.online = (t) => {
    tone(t, 0.3, { f: 660, gain: 0.18, r: 0.25 });
    tone(t + 0.13, 0.45, { f: 990, gain: 0.18, r: 0.4 });
    return 0.6;
  };
  // контакт ушёл — два вниз
  S.offline = (t) => {
    tone(t, 0.25, { f: 740, gain: 0.14, r: 0.2, lp: 1800 });
    tone(t + 0.14, 0.4, { f: 494, gain: 0.14, r: 0.35, lp: 1500 });
    return 0.55;
  };
  // вошли в сеть — маримба «до-ми-соль-до»
  S.connect = (t) => {
    [523, 659, 784, 1046].forEach((f, i) => tone(t + i * 0.1, 0.5 - i * 0.05, { f, type: 'triangle', gain: 0.2, r: 0.3 }));
    return 0.9;
  };
  S.error = (t) => {
    tone(t, 0.22, { f: 140, type: 'square', gain: 0.18, lp: 900 });
    return 0.25;
  };
  S.click = (t) => {
    tone(t, 0.03, { f: 1400, fEnd: 700, gain: 0.14 });
    return 0.05;
  };
  // стук в дверь — запрос авторизации
  S.knock = (t) => {
    [0, 0.17, 0.3].forEach((d) => {
      tone(t + d, 0.09, { f: 190, fEnd: 90, gain: 0.35, a: 0.002 });
      noise(t + d, 0.05, { f: 500, q: 0.5, gain: 0.1, a: 0.001 });
    });
    return 0.45;
  };

  /* ---------- голоса смайлов ---------- */
  const SM = {};

  SM.smile = (t) => { // довольное «дзинь-дзинь»
    tone(t, 0.25, { f: 1046, gain: 0.16, r: 0.2 });
    tone(t + 0.1, 0.35, { f: 1318, gain: 0.16, r: 0.3 });
    return 0.5;
  };
  SM.laugh = (t) => { // ха-ха-ха-ха
    for (let i = 0; i < 4; i++) {
      vowel(t + i * 0.15, 0.11, { v: 'a', f: 280 - i * 12, fEnd: 240 - i * 12, gain: 0.5, a: 0.01, breath: 0.05 });
    }
    return 0.65;
  };
  SM.wink = (t) => { // свистулька вверх + «тинь»
    tone(t, 0.26, { f: 520, fEnd: 1500, gain: 0.18, slide: 0.24 });
    tone(t + 0.26, 0.2, { f: 2100, gain: 0.12, r: 0.18 });
    return 0.5;
  };
  SM.sad = (t) => { // ва-а-а вниз
    vowel(t, 0.6, { v: 'a', vEnd: 'o', f: 230, fEnd: 150, gain: 0.5, a: 0.04, r: 0.25, vib: 5, vibRate: 5.5 });
    return 0.65;
  };
  SM.cry = (t) => { // бу-у-ху-ху
    vowel(t, 0.22, { v: 'u', f: 420, fEnd: 330, gain: 0.5, vib: 18, vibRate: 11 });
    vowel(t + 0.3, 0.16, { v: 'u', f: 380, fEnd: 300, gain: 0.45, vib: 18, vibRate: 11 });
    vowel(t + 0.5, 0.16, { v: 'u', f: 350, fEnd: 260, gain: 0.4, vib: 18, vibRate: 11 });
    return 0.7;
  };
  SM.tongue = (t) => { // пф-ф-ф (язык)
    noise(t, 0.4, { f: 350, q: 1.2, gain: 0.55, trem: 28, a: 0.01, r: 0.1 });
    tone(t, 0.4, { f: 85, fEnd: 70, type: 'sawtooth', gain: 0.2, lp: 300, trem: 28 });
    return 0.45;
  };
  SM.cool = (t) => { // крутой басовый ход
    [82, 98, 110, 123].forEach((f, i) => {
      tone(t + i * 0.14, 0.16, { f, type: 'triangle', gain: 0.35, lp: 400, a: 0.005 });
      noise(t + i * 0.14 + 0.07, 0.03, { f: 7000, q: 0.5, gain: 0.05, a: 0.001 });
    });
    return 0.7;
  };
  SM.surprise = (t) => { // «о!» вверх
    vowel(t, 0.3, { v: 'o', vEnd: 'a', f: 300, fEnd: 440, gain: 0.55, a: 0.015, r: 0.1 });
    return 0.35;
  };
  SM.kiss = (t) => { // м-м-чмок
    vowel(t, 0.16, { v: 'm', f: 200, fEnd: 230, gain: 0.5, type: 'triangle', a: 0.03 });
    tone(t + 0.17, 0.05, { f: 1500, fEnd: 300, gain: 0.3, a: 0.001 });
    noise(t + 0.17, 0.03, { f: 2500, q: 0.6, gain: 0.15, a: 0.001 });
    vowel(t + 0.22, 0.12, { v: 'a', f: 260, fEnd: 200, gain: 0.3, a: 0.01 });
    return 0.4;
  };
  SM.angry = (t) => { // р-р-р
    tone(t, 0.5, { f: 95, fEnd: 70, type: 'sawtooth', gain: 0.35, lp: 500, q: 3, trem: 27, a: 0.02, r: 0.1 });
    noise(t, 0.5, { f: 250, q: 0.8, gain: 0.12, trem: 27 });
    return 0.55;
  };
  SM.neutral = (t) => { // м-м-м (ровно)
    vowel(t, 0.45, { v: 'm', f: 165, gain: 0.9, type: 'triangle', a: 0.05, r: 0.15 });
    return 0.5;
  };
  SM.blush = (t) => { // хи-хи
    vowel(t, 0.1, { v: 'i', f: 440, fEnd: 400, gain: 0.8, breath: 0.06 });
    vowel(t + 0.14, 0.1, { v: 'i', f: 400, fEnd: 360, gain: 0.7, breath: 0.06 });
    return 0.3;
  };
  SM.heart = (t) => { // тук-тук, тук-тук
    [0, 0.17, 0.7, 0.87].forEach((d, i) => tone(t + d, 0.13, { f: i % 2 ? 48 : 60, fEnd: 35, gain: 0.5, a: 0.004, lp: 180 }));
    return 1.05;
  };
  SM.rose = (t) => { // арфа «та-да-а»
    [523, 659, 784, 1046, 1318].forEach((f, i) => tone(t + i * 0.06, 0.7, { f, gain: 0.13, r: 0.6 }));
    return 1.0;
  };
  SM.beer = (t) => { // дзынь + буль-буль
    tone(t, 0.3, { f: 2950, gain: 0.12, r: 0.28, a: 0.001 });
    tone(t, 0.3, { f: 4150, gain: 0.08, r: 0.28, a: 0.001, detune: 7 });
    [0.35, 0.5, 0.65].forEach((d, i) => tone(t + d, 0.11, { f: 230 - i * 30, fEnd: 110, gain: 0.3, lp: 600, a: 0.005 }));
    return 0.8;
  };
  SM.zzz = (t) => { // хр-р-р… пс-с-с
    noise(t, 0.45, { type: 'lowpass', f: 320, q: 1, gain: 0.6, trem: 22, a: 0.15, r: 0.1 });
    tone(t, 0.45, { f: 70, type: 'sawtooth', gain: 0.2, lp: 200, trem: 22, a: 0.15 });
    noise(t + 0.55, 0.35, { f: 2000, fEnd: 1200, q: 0.7, gain: 0.14, a: 0.05, r: 0.2 });
    return 0.95;
  };
  SM.devil = (t) => { // муа-ха-ха (низко)
    vowel(t, 0.2, { v: 'u', vEnd: 'a', f: 170, fEnd: 150, gain: 0.5, a: 0.02 });
    vowel(t + 0.26, 0.14, { v: 'a', f: 150, fEnd: 125, gain: 0.5, breath: 0.04 });
    vowel(t + 0.44, 0.18, { v: 'a', vEnd: 'o', f: 135, fEnd: 100, gain: 0.5, breath: 0.04, r: 0.08 });
    return 0.7;
  };
  SM.party = (t) => { // фанфары
    [[392, 0, 0.1], [523, 0.1, 0.1], [659, 0.2, 0.1], [784, 0.3, 0.45]].forEach(([f, d, dur]) => {
      tone(t + d, dur, { f, type: 'square', gain: 0.07, lp: 2500, r: 0.04 });
      tone(t + d, dur, { f: f / 2, type: 'triangle', gain: 0.12, r: 0.04 });
    });
    tone(t + 0.3, 0.45, { f: 988, type: 'square', gain: 0.05, lp: 2500 });
    return 0.8;
  };
  SM.think = (t) => { // хм-м?
    vowel(t, 0.35, { v: 'm', vEnd: 'm', f: 150, fEnd: 230, gain: 0.45, type: 'triangle', a: 0.05, r: 0.1 });
    return 0.4;
  };
  SM.sick = (t) => { // бэ-э
    vowel(t, 0.4, { v: 'e', vEnd: 'a', f: 200, fEnd: 140, gain: 0.45, a: 0.03, r: 0.15, vib: 9, vibRate: 7 });
    return 0.45;
  };
  SM.angel = (t) => { // «а-а-а» хором, светло
    [330, 415, 494, 659].forEach((f) => vowel(t, 0.8, { v: 'a', vEnd: 'o', f, fEnd: f * 1.01, gain: 0.13, a: 0.12, r: 0.4, vib: 2, vibRate: 5 }));
    return 0.85;
  };
  SM.shock = (t) => { // «а-а-а!» вверх с дрожью
    vowel(t, 0.5, { v: 'a', f: 300, fEnd: 520, gain: 0.5, a: 0.02, r: 0.1, vib: 12, vibRate: 14 });
    return 0.55;
  };

  /* ---------- API ---------- */
  function run(fn) {
    if (!enabled) return 0;
    const c = ensure();
    if (!c) return 0;
    try { return fn(c.currentTime + 0.01) || 0; } catch (e) { return 0; }
  }

  return {
    get enabled() { return enabled; },
    set enabled(v) { enabled = !!v; },
    get volume() { return volume; },
    set volume(v) { volume = Math.max(0, Math.min(1, v)); if (OUT) OUT.gain.value = volume; },
    unlock() { try { ensure(); } catch (e) {} },
    play(name) { return S[name] ? run(S[name]) : 0; },
    smile(id) { return SM[id] ? run(SM[id]) : 0; },
    hasSmile(id) { return !!SM[id]; },
    systemNames: Object.keys(S),
    smileNames: Object.keys(SM),
    // для проверки: отрисовать звук в офлайн-контекст
    _render(ctx, kind, name) {
      const pc = C, po = OUT;
      C = ctx; OUT = ctx.createGain(); OUT.gain.value = volume; OUT.connect(ctx.destination);
      let d = 0;
      try { d = (kind === 'smile' ? SM : S)[name](0.01); } finally { C = pc; OUT = po; }
      return d;
    },
  };
})();
