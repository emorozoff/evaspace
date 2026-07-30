import { useEffect, useRef, useState } from 'react';
import { useStore, todayIndex, totalStars } from '../lib/store.jsx';
import { evaReply, evaGreeting, EVA_CHIPS } from '../lib/eva.js';
import { StarField, Avatar, LessonRow } from '../components/UI.jsx';
import { IcSparkStar, IcMic, IcSend, IcSound, IcBack, IcNext } from '../components/Icons.jsx';
import { go, back } from '../lib/router.jsx';

const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

function speak(text, on) {
  if (!on || !canSpeak) return;
  try {
    window.speechSynthesis.cancel();
    const clean = text.replace(/[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}]/gu, '').replace(/\n+/g, '. ');
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = 'ru-RU';
    u.rate = 0.98;
    u.pitch = 1.08;
    const v = window.speechSynthesis.getVoices().find((x) => /ru/i.test(x.lang));
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  } catch {
    /* голос недоступен — не страшно */
  }
}

export default function Eva() {
  const { state, dispatch, allLessons } = useStore();
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const [rec, setRec] = useState(false);
  const [sound, setSound] = useState(true);
  const listRef = useRef(null);
  const recogRef = useRef(null);

  const ctx = {
    name: state.name,
    program: state.program,
    today: todayIndex(state.program),
    points: state.points,
    stars: totalStars(state),
    topTags: state.program?.topTags,
    scanned: state.program?.scanned,
    allLessons,
  };

  /* приветствие при первом заходе */
  useEffect(() => {
    if (state.chat.length === 0) {
      dispatch({ type: 'chat', message: { id: 'g' + Date.now(), from: 'eva', text: evaGreeting({ name: state.name }) } });
    }
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.chat, typing]);

  const send = (value, spoken = false) => {
    const t = (value ?? text).trim();
    if (!t) return;
    dispatch({ type: 'chat', message: { id: 'u' + Date.now(), from: 'me', text: t } });
    setText('');
    setTyping(true);
    setTimeout(() => {
      const r = evaReply(t, ctx);
      setTyping(false);
      dispatch({
        type: 'chat',
        message: { id: 'e' + Date.now(), from: 'eva', text: r.text, lessons: (r.lessons || []).map((l) => l.id), go: r.go, goLabel: r.goLabel },
      });
      speak(r.text, sound || spoken);
    }, 700 + Math.random() * 500);
  };

  const toggleMic = () => {
    if (!SR) {
      dispatch({ type: 'toast', value: 'Голосовой ввод не поддерживается этим браузером' });
      return;
    }
    if (rec) {
      recogRef.current?.stop();
      setRec(false);
      return;
    }
    const r = new SR();
    r.lang = 'ru-RU';
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      const t = Array.from(e.results).map((x) => x[0].transcript).join('');
      setText(t);
      if (e.results[e.results.length - 1].isFinal) {
        setRec(false);
        send(t, true);
      }
    };
    r.onerror = () => setRec(false);
    r.onend = () => setRec(false);
    recogRef.current = r;
    setRec(true);
    r.start();
  };

  return (
    <div className="screen no-nav" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
      {/* шапка */}
      <div style={{ position: 'relative', background: 'var(--grad-hero)', color: '#fff', padding: 'calc(var(--safe-t) + 12px) 16px 16px', flex: 'none', overflow: 'hidden' }}>
        <StarField n={18} seed={55} />
        <div className="row" style={{ position: 'relative', gap: 12 }}>
          <button className="icon-btn" style={{ background: 'rgba(255,255,255,.18)', color: '#fff', boxShadow: 'none' }} onClick={back}>
            <IcBack size={19} />
          </button>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg,#f6dfae,#e6a0c4)', display: 'grid', placeItems: 'center', color: '#4a2058', flex: 'none' }}>
            <IcSparkStar size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Ева</div>
            <div className="tiny" style={{ opacity: 0.8 }}>{typing ? 'печатает…' : 'на связи 24/7'}</div>
          </div>
          <button className="icon-btn" style={{ background: 'rgba(255,255,255,.18)', color: '#fff', boxShadow: 'none' }} onClick={() => { setSound(!sound); if (canSpeak) window.speechSynthesis.cancel(); }}>
            <IcSound size={18} off={!sound} />
          </button>
        </div>
      </div>

      {/* сообщения */}
      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 14px 6px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {state.chat.map((m) => (
          <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: m.from === 'me' ? 'flex-end' : 'flex-start', gap: 8 }}>
            <div className={'msg ' + (m.from === 'me' ? 'me' : 'eva')}>{m.text}</div>
            {m.lessons?.length > 0 && (
              <div className="stack" style={{ width: '100%' }}>
                {m.lessons
                  .map((id) => allLessons.find((l) => l.id === id))
                  .filter(Boolean)
                  .map((l) => (
                    <LessonRow key={l.id} lesson={l} onClick={() => go(`/lesson/x/${l.id}`)} />
                  ))}
              </div>
            )}
            {m.go && (
              <button className="btn sm ghost" onClick={() => go(m.go.replace('#', ''))}>
                {m.goLabel} <IcNext size={15} />
              </button>
            )}
          </div>
        ))}
        {typing && (
          <div className="msg eva typing">
            <i /><i /><i />
          </div>
        )}
        <div style={{ height: 4 }} />
      </div>

      {/* быстрые фразы */}
      <div className="chips scroll" style={{ padding: '4px 14px 8px', margin: 0, flex: 'none' }}>
        {EVA_CHIPS.map((c) => (
          <button key={c} className="chip" onClick={() => send(c)}>
            {c}
          </button>
        ))}
      </div>

      {/* ввод */}
      <div className="composer">
        <button className={'mic' + (rec ? ' rec' : '')} onClick={toggleMic} aria-label="Голосовой ввод">
          <IcMic size={19} />
        </button>
        <input
          className="input"
          placeholder={rec ? 'Слушаю…' : 'Напиши Еве…'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button className="mic" style={{ background: 'linear-gradient(120deg,#b64f7c,#7c2f69)', color: '#fff', border: 'none' }} onClick={() => send()} aria-label="Отправить">
          <IcSend size={18} />
        </button>
      </div>
    </div>
  );
}
