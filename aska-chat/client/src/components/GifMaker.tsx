// 🎞 Гифка по ТЗ: пишешь, какую гифку хочешь, — АСЬКА собирает живую гифку (с «мозгом» — ИИ, без него — по словарю).
// Дальше можно поправить героя, подпись, движение, эффект и фон и выпустить её НФТ (по умолчанию 10 🪙).
import { useState } from 'react';
import type { GifSpec, Nft } from '../lib/web3.ts';
import { makeGif, GIF_ANIMS, ANIM_NAMES, GIF_FX, FX_NAMES, GIF_PALETTES, cleanGif } from '../lib/web3.ts';
import { ApiError } from '../lib/api.ts';
import { LiveGif } from './LiveGif.tsx';
import { MintDialog } from './Gallery.tsx';

const IDEAS = ['динозаврик рычит и прыгает, подпись "Р-Р-Р"', 'котик спит на солнышке', 'туса у нас, конфетти, подпись "ПОГНАЛИ"', 'деньги летят 💸 надпись: богатею',
  'грустный пёс под дождём', 'корона и искры, подпись "ВАШЕ ВЕЛИЧЕСТВО"', 'ракета в космос, подпись "К ЗВЁЗДАМ"', 'волк воет на луну'];

export function GifMaker({ onGallery }: { onGallery: (n?: Nft) => void }) {
  const [brief, setBrief] = useState('');
  const [spec, setSpec] = useState<GifSpec | null>(null);
  const [title, setTitle] = useState('');
  const [by, setBy] = useState<'ai' | 'rules' | ''>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mint, setMint] = useState(false);
  const edit = (patch: Partial<GifSpec>) => setSpec((s) => (s ? cleanGif({ ...s, ...patch }) || s : s));

  async function go(text = brief) {
    if (text.trim().length < 2) { setError('Напиши пару слов: кто, что делает, какая подпись.'); return; }
    setBusy(true); setError('');
    try {
      const r = await makeGif(text.trim());
      setSpec(r.spec); setTitle(r.title); setBy(r.by);
    } catch (e) { setError(e instanceof ApiError && e.code === 'too_many' ? 'Много гифок за час — передохни немного.' : 'Не получилось. Попробуй ещё раз.'); } finally { setBusy(false); }
  }

  return (
    <div className="aska-gifmaker">
      <div className="nft-hero"><div><b>🎞 Гифка по ТЗ</b><small>Опиши, какую гифку хочешь, — соберу. Каждая гифка — НФТ, по умолчанию 10 🪙.</small></div></div>
      <textarea className="field" rows={3} maxLength={300} value={brief} onChange={(e) => setBrief(e.target.value)}
        placeholder={'ТЗ: кто на гифке, что делает, какое настроение, подпись в кавычках.\nНапример: динозаврик танцует под дождём, подпись "РРР"'} />
      <div className="gm-ideas">{IDEAS.map((x) => <button key={x} type="button" className="chip" onClick={() => { setBrief(x); go(x); }}>{x}</button>)}</div>
      <button className="btn primary aska-wide" disabled={busy} onClick={() => go()}>{busy ? 'Собираю…' : '✨ Собрать гифку'}</button>
      {error && <div className="err">{error}</div>}
      {spec && (
        <div className="gm-result">
          <div className="gm-prev"><LiveGif spec={spec} size="l" /></div>
          <div className="hint">{by === 'ai' ? 'Собрал ИИ по твоему ТЗ.' : 'Собрано по словарю АСЬКИ.'}{spec.snd ? ' Нажми на гифку — герой подаст голос 🔊' : ''}</div>
          <div className="gm-edit">
            <label>Герой <input className="field" value={spec.e} maxLength={12} onChange={(e) => edit({ e: e.target.value })} /></label>
            <label>Подпись <input className="field" value={spec.cap} maxLength={28} onChange={(e) => edit({ cap: e.target.value })} /></label>
            <label>Движение <select className="field" value={spec.anim} onChange={(e) => edit({ anim: e.target.value })}>{GIF_ANIMS.map((a) => <option key={a} value={a}>{ANIM_NAMES[a] || a}</option>)}</select></label>
            <label>Эффект <select className="field" value={spec.fx || ''} onChange={(e) => edit({ fx: (e.target.value || undefined) as GifSpec['fx'] })}>
              <option value="">без эффекта</option>{GIF_FX.map((f) => <option key={f} value={f}>{FX_NAMES[f]}</option>)}</select></label>
          </div>
          <div className="gm-pal">{Object.entries(GIF_PALETTES).map(([k, bg]) => (
            <button key={k} type="button" className={`gm-sw${spec.bg[0] === bg[0] ? ' on' : ''}`} style={{ background: `linear-gradient(135deg, ${bg[0]}, ${bg[1]})` }} onClick={() => edit({ bg })} aria-label={`Фон ${k}`} />
          ))}</div>
          <div className="row">
            <button className="btn" disabled={busy} onClick={() => go()}>↺ Ещё раз</button>
            <button className="btn primary" onClick={() => setMint(true)}>💎 Выпустить НФТ</button>
          </div>
        </div>
      )}
      <button className="btn" onClick={() => onGallery()}>💎 В галерею</button>
      {mint && spec && <MintDialog spec={spec} brief={brief} title={title} onClose={() => setMint(false)} onDone={(n) => { setMint(false); onGallery(n); }} />}
    </div>
  );
}
