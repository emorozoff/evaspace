// 🎬 Видео-квадратики: ролики до 20 секунд с камеры, как «кружочки», только квадратные.
// Запись — MediaRecorder прямо на телефоне, файл шифруется как фото (sendVideo в lib/store.ts), сервер видит только шифр.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { VideoRef } from '../lib/protocol.ts';
import { load } from './EncryptedImage.tsx';

export const VIDEO_MAX = 20; // секунд

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

// Квадратик в беседе: первый кадр и ▶; нажал — играет со звуком, ещё раз — пауза
export function VideoSquare({ video, local }: { video: VideoRef; local?: string }) {
  const [url, setUrl] = useState<string | null>(local || null);
  const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'paused' | 'failed'>('idle');
  const [p, setP] = useState(0);
  const ref = useRef<HTMLVideoElement>(null);

  async function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    const v = ref.current;
    if (state === 'playing') { v?.pause(); setState('paused'); return; }
    if (url && v) { v.muted = false; v.play().then(() => setState('playing')).catch(() => setState('paused')); return; }
    if (!video.blob) return;
    setState('loading');
    try {
      const u = await load(video);
      setUrl(u);
      setState('playing'); // играть начнёт onCanPlay
    } catch { setState('failed'); }
  }

  return (
    <span className={`aska-vsq s-${state}`} onClick={toggle} role="button" aria-label={state === 'playing' ? 'Пауза' : 'Смотреть видео-квадратик'}>
      {video.thumb && <img className="vsq-thumb" src={video.thumb} alt="" draggable={false} />}
      {url && (
        <video ref={ref} src={url} playsInline preload="metadata"
          onCanPlay={() => { if (state === 'playing' && ref.current?.paused) ref.current.play().catch(() => setState('paused')); }}
          onTimeUpdate={() => { const v = ref.current; if (v && v.duration) setP(v.currentTime / v.duration); }}
          onEnded={() => { setState('idle'); setP(0); if (ref.current) ref.current.currentTime = 0; }}
          onError={() => setState('failed')} />
      )}
      <Ring p={p} />
      {state !== 'playing' && state !== 'loading' && state !== 'failed' && <span className="vsq-play" aria-hidden="true">▶</span>}
      {state === 'loading' && <span className="spin" />}
      {state === 'failed' && <span className="fail">Видео не открылось на этом устройстве</span>}
      <span className="vsq-dur">🎬 {fmt(video.dur || 0)}</span>
    </span>
  );
}

// Запись квадратика: камера в квадрате, большая кнопка, 20 секунд, переснять или отправить
export function VideoRecorder({ onSend, onClose }: { onSend: (video: Blob, dur: number, thumb?: string) => void; onClose: () => void }) {
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
      const dur = Math.min(VIDEO_MAX, (Date.now() - started.current) / 1000);
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
      if (t >= VIDEO_MAX) stop();
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
      <div className="aska-vrec" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Видео-квадратик">
        <div className="vrec-top">
          <b>🎬 Видео-квадратик</b>
          <span className="vrec-time">{phase === 'done' && clip ? fmt(clip.dur) : `${fmt(sec)} / 0:${VIDEO_MAX}`}</span>
          <button type="button" className="btn vrec-x" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <div className={`vrec-box${facing === 'user' ? ' mirror' : ''}${phase === 'rec' ? ' on' : ''}`}>
          <video ref={live} className={phase === 'done' ? 'hide' : ''} muted playsInline autoPlay />
          {phase === 'done' && clip && <video className="vrec-clip" src={clip.url} playsInline autoPlay loop controls={false} onClick={(e) => { const v = e.currentTarget; v.muted = !v.muted; }} />}
          {phase === 'rec' && <Ring p={sec / VIDEO_MAX} />}
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
              <span className="vrec-hint">{phase === 'rec' ? 'нажми ещё раз — стоп' : `до ${VIDEO_MAX} секунд`}</span>
            </>
          )}
        </div>
        {phase === 'done' && <div className="vrec-note">Нажми на видео — включить звук. Квадратик шифруется на телефоне, как фото.</div>}
      </div>
    </div>,
    document.body,
  );
}
