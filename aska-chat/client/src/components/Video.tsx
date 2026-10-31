// 🎬 Видеоквадратики: ролики с камеры, как «кружочки», только квадратные — до 20 секунд, у Голд и Блэк — до 40.
// Плюс видео и музыка из файлов телефона, просмотр на весь экран (повтор или следующее) и видеоквадратики Аськи-ассистента.
// Запись — MediaRecorder прямо на телефоне, файл шифруется как фото (sendVideo в lib/store.ts), сервер видит только шифр.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { VideoRef, AudioRef, ClipRef } from '../lib/protocol.ts';
import { flower, soundEnabled } from '../lib/aska.ts';
import { load } from './EncryptedImage.tsx';

export const VIDEO_MAX = 20;      // секунд
export const VIDEO_MAX_GOLD = 40; // у Голд и Блэк

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

// Какой формат пишет этот браузер: iPhone — mp4, Chrome — mp4 или webm, Firefox — webm
export function pickVideoMime(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const list = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return list.find((m) => { try { return MediaRecorder.isTypeSupported(m); } catch { return false; } }) || '';
}
export const canRecordVideo = () => !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

// Рамка-прогресс по краю квадратика
function Ring({ p }: { p: number }) {
  return (
    <svg className="vsq-ring" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path d="M50 1.5H83A15.5 15.5 0 0 1 98.5 17V83A15.5 15.5 0 0 1 83 98.5H17A15.5 15.5 0 0 1 1.5 83V17A15.5 15.5 0 0 1 17 1.5Z"
        pathLength="100" strokeDasharray={`${Math.max(0, Math.min(100, p * 100))} 100`} />
    </svg>
  );
}

// Кто играет сейчас в беседе: по окончании — следующее видео (playMedia), на весь экран — MediaViewer
const players = new Map<string, { play: () => void; el: () => HTMLElement | null }>();
export function playMedia(key: string) {
  const p = players.get(key);
  if (!p) return false;
  p.el()?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  p.play();
  return true;
}

// Видеоквадратик в беседе: первый кадр и ▶; нажал — играет со звуком, ещё раз — пауза.
// В левом верхнем уголке ⤢ — на весь экран. Видео из галереи телефона рисуется в своих пропорциях.
export function VideoSquare({ video, local, mkey, onEnded, onExpand }: { video: VideoRef; local?: string; mkey?: string; onEnded?: () => void; onExpand?: () => void }) {
  const [url, setUrl] = useState<string | null>(local || null);
  const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'paused' | 'failed'>('idle');
  const [p, setP] = useState(0);
  const ref = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLSpanElement>(null);
  const wide = video.sq === false && video.w && video.h ? video.w / video.h : 1;

  async function start() {
    const v = ref.current;
    if (url && v) { v.muted = false; v.play().then(() => setState('playing')).catch(() => setState('paused')); return; }
    if (!video.blob) return;
    setState('loading');
    try { setUrl(await load(video)); setState('playing'); } catch { setState('failed'); }
  }
  useEffect(() => {
    if (!mkey) return;
    players.set(mkey, { play: () => { start(); }, el: () => box.current });
    return () => { players.delete(mkey); };
  }); // каждый рендер — свежий start с текущим url

  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (state === 'playing') { ref.current?.pause(); setState('paused'); return; }
    start();
  }

  return (
    <span ref={box} className={`aska-vsq s-${state}${video.sq === false ? ' wide' : ''}`} style={video.sq === false ? { aspectRatio: String(Math.max(0.5, Math.min(2, wide))) } : undefined}
      onClick={toggle} role="button" aria-label={state === 'playing' ? 'Пауза' : 'Смотреть видео'}>
      {video.thumb && <img className="vsq-thumb" src={video.thumb} alt="" draggable={false} />}
      {url && (
        <video ref={ref} src={url} playsInline preload="metadata"
          onCanPlay={() => { if (state === 'playing' && ref.current?.paused) ref.current.play().catch(() => setState('paused')); }}
          onTimeUpdate={() => { const v = ref.current; if (v && v.duration) setP(v.currentTime / v.duration); }}
          onEnded={() => { setState('idle'); setP(0); if (ref.current) ref.current.currentTime = 0; onEnded?.(); }}
          onError={() => setState('failed')} />
      )}
      {video.sq !== false && <Ring p={p} />}
      {onExpand && <button type="button" className="vsq-full" onClick={(e) => { e.stopPropagation(); ref.current?.pause(); setState((st) => (st === 'playing' ? 'paused' : st)); onExpand(); }} aria-label="На весь экран" title="На весь экран">⤢</button>}
      {state !== 'playing' && state !== 'loading' && state !== 'failed' && <span className="vsq-play" aria-hidden="true">▶</span>}
      {state === 'loading' && <span className="spin" />}
      {state === 'failed' && <span className="fail">Видео не открылось на этом устройстве</span>}
      <span className="vsq-dur">🎬 {fmt(video.dur || 0)}</span>
    </span>
  );
}

// Запись квадратика: камера в квадрате, большая кнопка, 20 секунд, переснять или отправить
export function VideoRecorder({ onSend, onClose, max = VIDEO_MAX }: { onSend: (video: Blob, dur: number, thumb?: string) => void; onClose: () => void; max?: number }) {
  const live = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const thumb = useRef<string | undefined>(undefined);
  const timer = useRef(0);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [phase, setPhase] = useState<'ask' | 'ready' | 'rec' | 'done' | 'error'>('ask');
  const [error, setError] = useState('');
  const [sec, setSec] = useState(0);
  const [clip, setClip] = useState<{ blob: Blob; url: string; dur: number } | null>(null);

  const stopStream = () => { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; };

  useEffect(() => {
    let alive = true;
    (async () => {
      stopStream();
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 480 }, height: { ideal: 480 }, aspectRatio: { ideal: 1 } },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        if (!alive) { s.getTracks().forEach((t) => t.stop()); return; }
        stream.current = s;
        if (live.current) { live.current.srcObject = s; live.current.play().catch(() => {}); }
        setPhase((ph) => (ph === 'done' ? ph : 'ready'));
      } catch (e) {
        if (!alive) return;
        setError((e as Error)?.name === 'NotAllowedError'
          ? 'Нет доступа к камере. Разреши камеру и микрофон для АСЬКИ в настройках телефона.'
          : 'Камера не включилась. Возможно, она занята другим приложением.');
        setPhase('error');
      }
    })();
    return () => { alive = false; };
  }, [facing]);

  useEffect(() => () => { clearInterval(timer.current); try { rec.current?.state === 'recording' && rec.current.stop(); } catch { /* уже */ } stopStream(); if (clip) URL.revokeObjectURL(clip.url); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function grabThumb() {
    const v = live.current;
    if (!v || !v.videoWidth) return undefined;
    const side = Math.min(v.videoWidth, v.videoHeight);
    const c = document.createElement('canvas');
    c.width = c.height = 120;
    const g = c.getContext('2d');
    if (!g) return undefined;
    g.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, 120, 120);
    try { return c.toDataURL('image/jpeg', 0.6); } catch { return undefined; }
  }

  function start() {
    const s = stream.current;
    if (!s) return;
    const mimeType = pickVideoMime();
    let r: MediaRecorder;
    try {
      r = new MediaRecorder(s, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 700_000, audioBitsPerSecond: 64_000 });
    } catch {
      setError('Этот браузер не умеет записывать видео.'); setPhase('error'); return;
    }
    chunks.current = [];
    thumb.current = grabThumb();
    r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
    r.onstop = () => {
      clearInterval(timer.current);
      const dur = Math.min(max, (Date.now() - started.current) / 1000);
      const blob = new Blob(chunks.current, { type: r.mimeType || mimeType || 'video/mp4' });
      if (dur < 0.7 || !blob.size) { setPhase('ready'); return; } // случайное касание
      setClip({ blob, url: URL.createObjectURL(blob), dur });
      setPhase('done');
    };
    rec.current = r;
    started.current = Date.now();
    r.start(500);
    setSec(0);
    setPhase('rec');
    timer.current = window.setInterval(() => {
      const t = (Date.now() - started.current) / 1000;
      setSec(t);
      if (t >= max) stop();
    }, 100);
  }

  function stop() {
    clearInterval(timer.current);
    if (rec.current?.state === 'recording') rec.current.stop();
  }

  function retake() {
    if (clip) URL.revokeObjectURL(clip.url);
    setClip(null);
    setSec(0);
    setPhase(stream.current ? 'ready' : 'ask');
    if (live.current && stream.current) { live.current.srcObject = stream.current; live.current.play().catch(() => {}); }
  }

  function send() {
    if (!clip) return;
    onSend(clip.blob, clip.dur, thumb.current);
    stopStream();
    onClose();
  }

  return createPortal(
    <div className="aska-vrec-ov" onClick={onClose}>
      <div className="aska-vrec" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Видеоквадратик">
        <div className="vrec-top">
          <b>🎬 Видеоквадратик</b>
          <span className="vrec-time">{phase === 'done' && clip ? fmt(clip.dur) : `${fmt(sec)} / ${fmt(max)}`}</span>
          <button type="button" className="btn vrec-x" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <div className={`vrec-box${facing === 'user' ? ' mirror' : ''}${phase === 'rec' ? ' on' : ''}`}>
          <video ref={live} className={phase === 'done' ? 'hide' : ''} muted playsInline autoPlay />
          {phase === 'done' && clip && <video className="vrec-clip" src={clip.url} playsInline autoPlay loop controls={false} onClick={(e) => { const v = e.currentTarget; v.muted = !v.muted; }} />}
          {phase === 'rec' && <Ring p={sec / max} />}
          {phase === 'rec' && <span className="vrec-dot">● запись</span>}
          {phase === 'ask' && <span className="spin" />}
          {phase === 'error' && <span className="vrec-err">{error}</span>}
        </div>
        <div className="vrec-actions">
          {phase === 'done' ? (
            <>
              <button type="button" className="btn" onClick={retake}>↺ Переснять</button>
              <button type="button" className="btn primary" onClick={send}>Отправить</button>
            </>
          ) : (
            <>
              <button type="button" className="btn vrec-flip" onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))} disabled={phase === 'rec' || phase === 'error'} aria-label="Другая камера">🔄</button>
              <button type="button" className={`vrec-btn${phase === 'rec' ? ' on' : ''}`} onClick={phase === 'rec' ? stop : start} disabled={phase !== 'ready' && phase !== 'rec'}
                aria-label={phase === 'rec' ? 'Остановить' : 'Записать'}><i /></button>
              <span className="vrec-hint">{phase === 'rec' ? 'нажми ещё раз — стоп' : `до ${max} секунд`}</span>
            </>
          )}
        </div>
        {phase === 'done' && <div className="vrec-note">Нажми на видео — включить звук. Квадратик шифруется на телефоне, как фото.</div>}
      </div>
    </div>,
    document.body,
  );
}

// ---------- 🎵 музыка из файлов телефона ----------
export function AudioMsg({ audio, local }: { audio: AudioRef; local?: string }) {
  const [url, setUrl] = useState<string | null>(local || null);
  const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'paused' | 'failed'>('idle');
  const [t, setT] = useState(0);
  const ref = useRef<HTMLAudioElement>(null);
  async function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    const a = ref.current;
    if (state === 'playing') { a?.pause(); setState('paused'); return; }
    if (url && a) { a.play().then(() => setState('playing')).catch(() => setState('paused')); return; }
    setState('loading');
    try { setUrl(await load(audio)); setState('playing'); } catch { setState('failed'); }
  }
  const dur = audio.dur || 0;
  return (
    <span className={`aska-amsg s-${state}`} onClick={(e) => e.stopPropagation()}>
      <button type="button" className="am-play" onClick={toggle} aria-label={state === 'playing' ? 'Пауза' : 'Слушать'}>{state === 'playing' ? '⏸' : state === 'loading' ? '…' : '▶'}</button>
      <span className="am-body">
        <b>🎵 {audio.name || 'Музыка'}</b>
        <span className="am-bar"><i style={{ width: `${dur ? Math.min(100, (t / dur) * 100) : 0}%` }} /></span>
        <small>{state === 'failed' ? 'не открылась на этом устройстве' : `${fmt(t)} / ${fmt(dur)}`}</small>
      </span>
      {url && <audio ref={ref} src={url} preload="metadata" onCanPlay={() => { if (state === 'playing' && ref.current?.paused) ref.current.play().catch(() => setState('paused')); }}
        onTimeUpdate={() => setT(ref.current?.currentTime || 0)} onEnded={() => { setState('idle'); setT(0); }} onError={() => setState('failed')} />}
    </span>
  );
}

// ---------- 🌼 видеоквадратик Аськи-ассистента ----------
// Рисуется прямо в приложении: Аська (цветок с лицом) говорит по строчкам — субтитры и голос телефона (если есть русский).
const lineMs = (l: string) => Math.max(1800, Math.min(7000, l.length * 65));
export const clipDuration = (c: ClipRef) => c.lines.reduce((n, l) => n + lineMs(l), 0) / 1000;
function speak(text: string, onEnd: () => void): () => void {
  const synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
  let done = false;
  const finish = () => { if (!done) { done = true; onEnd(); } };
  const timer = window.setTimeout(finish, lineMs(text) + 2500); // голоса нет или он молчит — дальше по таймеру
  if (synth && soundEnabled()) {
    try {
      const u = new SpeechSynthesisUtterance(text.replace(/\p{Extended_Pictographic}/gu, ''));
      u.lang = 'ru-RU';
      u.rate = 1.05;
      u.pitch = 1.25;
      const v = synth.getVoices().find((x) => /^ru/i.test(x.lang) && /female|milena|katya|алёна|anna|irina|yandex|google/i.test(x.name)) || synth.getVoices().find((x) => /^ru/i.test(x.lang));
      if (v) u.voice = v;
      u.onend = () => { clearTimeout(timer); window.setTimeout(finish, 250); };
      synth.cancel();
      synth.speak(u);
    } catch { /* без голоса */ }
  } else { clearTimeout(timer); window.setTimeout(finish, lineMs(text)); }
  return () => { done = true; clearTimeout(timer); try { synth?.cancel(); } catch { /* */ } };
}

export function AskaClip({ clip, size = 'm', mkey, autoPlay, onEnded, onExpand }: { clip: ClipRef; size?: 'm' | 'l'; mkey?: string; autoPlay?: boolean; onEnded?: () => void; onExpand?: () => void }) {
  const [i, setI] = useState(-1); // какая строчка звучит; -1 — стоит
  const stop = useRef<(() => void) | null>(null);
  const box = useRef<HTMLSpanElement>(null);
  const total = clipDuration(clip);
  function play(from = 0) {
    stop.current?.();
    if (from >= clip.lines.length) { setI(-1); onEnded?.(); return; }
    setI(from);
    stop.current = speak(clip.lines[from], () => play(from + 1));
  }
  useEffect(() => () => stop.current?.(), []);
  useEffect(() => { if (autoPlay) play(0); }, [autoPlay]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!mkey) return;
    players.set(mkey, { play: () => play(0), el: () => box.current });
    return () => { players.delete(mkey); };
  });
  const playing = i >= 0;
  const done = playing ? clip.lines.slice(0, i).reduce((n, l) => n + lineMs(l), 0) / 1000 / total : 0;
  return (
    <span ref={box} className={`aska-vsq aska-clip ${size}${playing ? ' s-playing' : ''}`} role="button" aria-label={playing ? 'Остановить' : 'Смотреть видеоквадратик Аськи'}
      onClick={(e) => { e.stopPropagation(); if (playing) { stop.current?.(); setI(-1); } else play(0); }}>
      <span className="clip-stage" aria-hidden="true">
        <span className="clip-char">
          <span className="clip-flower" dangerouslySetInnerHTML={{ __html: flower('online', size === 'l' ? 240 : 120) }} />
          <span className={`clip-face${playing ? ' talk' : ''}`}><i className="eye l" /><i className="eye r" /><i className="mouth" /></span>
        </span>
        <span className="clip-spark s1">✨</span><span className="clip-spark s2">🌼</span>
      </span>
      <span className="clip-badge">Аська · ИИ</span>
      <span className="clip-sub">{playing ? clip.lines[i] : clip.lines[0]}</span>
      <Ring p={playing ? done : 0} />
      {onExpand && <button type="button" className="vsq-full" onClick={(e) => { e.stopPropagation(); stop.current?.(); setI(-1); onExpand(); }} aria-label="На весь экран" title="На весь экран">⤢</button>}
      {!playing && <span className="vsq-play" aria-hidden="true">▶</span>}
      <span className="vsq-dur">🎬 {fmt(total)}</span>
    </span>
  );
}

// ---------- ⤢ на весь экран: повтор или следующее ----------
export type MediaItem = { key: string; video?: VideoRef; clip?: ClipRef; local?: string; from: string };
export function MediaViewer({ items, start, onClose }: { items: MediaItem[]; start: number; onClose: () => void }) {
  const [idx, setIdx] = useState(Math.max(0, Math.min(items.length - 1, start)));
  const [mode, setMode] = useState<'loop' | 'next'>(() => (items.length > 1 ? 'next' : 'loop'));
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [round, setRound] = useState(0); // для повтора видеоквадратика Аськи
  const ref = useRef<HTMLVideoElement>(null);
  const it = items[idx];
  useEffect(() => {
    setUrl(null); setFailed(false);
    if (!it?.video) return;
    let alive = true;
    if (it.local) setUrl(it.local);
    else load(it.video).then((u) => alive && setUrl(u)).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });
  function go(d: number) { setIdx((i) => Math.max(0, Math.min(items.length - 1, i + d))); }
  function ended() {
    if (mode === 'loop') { if (ref.current) { ref.current.currentTime = 0; ref.current.play().catch(() => {}); } else setRound((r) => r + 1); return; }
    if (idx < items.length - 1) go(1);
  }
  if (!it) return null;
  return createPortal(
    <div className="aska-mview" role="dialog" aria-label="Видео на весь экран" onClick={onClose}>
      <div className="mv-top" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="mv-btn" onClick={onClose} aria-label="Закрыть">×</button>
        <span className="mv-title">{it.from} · {idx + 1} из {items.length}</span>
        <button type="button" className={`mv-btn mv-mode${mode === 'loop' ? ' on' : ''}`} onClick={() => setMode((m) => (m === 'loop' ? 'next' : 'loop'))}
          aria-label={mode === 'loop' ? 'Сейчас: повтор. Переключить на «следующее»' : 'Сейчас: следующее. Переключить на повтор'}>
          {mode === 'loop' ? '🔁 Повтор' : '⏭ Следующее'}
        </button>
      </div>
      <div className="mv-stage" onClick={(e) => e.stopPropagation()}>
        {it.clip ? <AskaClip key={`${it.key}:${round}`} clip={it.clip} size="l" autoPlay onEnded={ended} />
          : failed ? <span className="mv-fail">Видео не открылось на этом устройстве</span>
            : url ? <video key={it.key} ref={ref} className={it.video?.sq === false ? 'wide' : 'sq'} src={url} playsInline autoPlay controls onEnded={ended} />
              : <span className="spin" />}
      </div>
      <div className="mv-nav" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="mv-btn" disabled={idx === 0} onClick={() => go(-1)} aria-label="Предыдущее">◀</button>
        <span className="mv-hint">{mode === 'loop' ? 'по кругу' : idx < items.length - 1 ? 'дальше — следующее' : 'это последнее'}</span>
        <button type="button" className="mv-btn" disabled={idx >= items.length - 1} onClick={() => go(1)} aria-label="Следующее">▶</button>
      </div>
    </div>,
    document.body,
  );
}

// Длительность, размеры и первый кадр файла из телефона (видео — для превью в беседе)
export function mediaMeta(file: Blob, kind: 'video' | 'audio'): Promise<{ dur: number; w?: number; h?: number; thumb?: string }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement(kind);
    let done = false;
    const finish = (r: { dur: number; w?: number; h?: number; thumb?: string }) => { if (done) return; done = true; URL.revokeObjectURL(url); resolve(r); };
    setTimeout(() => finish({ dur: 0 }), 8000);
    el.preload = 'metadata';
    el.muted = true;
    (el as HTMLVideoElement).playsInline = true;
    el.onloadedmetadata = () => {
      const dur = Number.isFinite(el.duration) ? el.duration : 0;
      if (kind === 'audio') return finish({ dur });
      const v = el as HTMLVideoElement;
      v.currentTime = Math.min(0.1, dur / 2);
      v.onseeked = () => {
        let thumb: string | undefined;
        try {
          const c = document.createElement('canvas');
          const k = 160 / Math.max(v.videoWidth, v.videoHeight, 1);
          c.width = Math.max(1, Math.round(v.videoWidth * k)); c.height = Math.max(1, Math.round(v.videoHeight * k));
          c.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height);
          thumb = c.toDataURL('image/jpeg', 0.6);
        } catch { /* без превью */ }
        finish({ dur, w: v.videoWidth, h: v.videoHeight, thumb });
      };
    };
    el.onerror = () => finish({ dur: 0 });
    el.src = url;
  });
}
