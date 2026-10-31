// 🎵 Музыка, 🎬 Кино, 📚 Книги — реестр АСЬКИ. Кто первый занёс — того и тапки: у записи номер (M-…, F-…, B-…),
// «занёс(ла) …» и блок во внутреннем блокчейне. Авторство — «это моё» → согласует администрация → ✓.
// Хиты Аськи (свои инструменталки) играют прямо тут — синтез из нот, файлов нет. Остальное — ссылкой.
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useStore } from '../useStore.ts';
import { listCatalog, addCatalog, claimCatalog, getLedger } from '../lib/levels.ts';
import type { CatalogItem, CatalogKind, Block } from '../lib/levels.ts';
import { ApiError } from '../lib/api.ts';
import { Dialog } from './Win.tsx';

const KIND: Record<CatalogKind, { title: string; emoji: string; one: string; author: string; titleHint: string; authorHint: string }> = {
  music: { title: 'Музыка', emoji: '🎵', one: 'трек', author: 'Исполнитель', titleHint: 'Название трека', authorHint: 'Кто поёт или играет' },
  film: { title: 'Кино', emoji: '🎬', one: 'фильм', author: 'Режиссёр', titleHint: 'Название фильма', authorHint: 'Режиссёр или студия' },
  book: { title: 'Книги', emoji: '📚', one: 'книгу', author: 'Автор', titleHint: 'Название книги', authorHint: 'Автор' },
};
const hue = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h % 360; };

function Cover({ it }: { it: CatalogItem }) {
  const h = hue(it.title + it.author);
  if (it.kind === 'music') return <span className="cv cv-vinyl" style={{ ['--h' as string]: h }}><i /></span>;
  if (it.kind === 'film') return <span className="cv cv-poster" style={{ ['--h' as string]: h }}><b>{it.title.slice(0, 18)}</b><small>{it.year || ''}</small></span>;
  return <span className="cv cv-book" style={{ ['--h' as string]: h }}><b>{it.title.slice(0, 22)}</b><small>{it.author.split(' ').slice(-1)[0]}</small></span>;
}

function usePlayer() {
  const [st, setSt] = useState<{ playing: boolean; trackId: string | null }>(() => window.AskaMusic?.state ? { playing: window.AskaMusic.state.playing, trackId: window.AskaMusic.state.trackId } : { playing: false, trackId: null });
  useEffect(() => { window.AskaMusic?.onChange((x) => setSt({ playing: x.playing, trackId: x.trackId })); }, []);
  return st;
}

export function Catalog({ kind, onLedger }: { kind: CatalogKind; onLedger: () => void }) {
  const s = useStore();
  const k = KIND[kind];
  const tier = s.profile?.tier || 'guest';
  const canAdd = tier !== 'guest';
  const [items, setItems] = useState<CatalogItem[] | null>(null);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const player = usePlayer();
  const load = (query = q) => listCatalog(kind, query).then(setItems).catch(() => setError('Не получилось загрузить реестр.'));
  useEffect(() => { load(''); }, [kind]);
  useEffect(() => { const t = setTimeout(() => load(q), 300); return () => clearTimeout(t); }, [q]);
  const play = (it: CatalogItem) => {
    const M = window.AskaMusic;
    if (!M || !it.synth) return;
    if (player.trackId === it.synth && player.playing) M.pause();
    else if (player.trackId === it.synth) M.resume();
    else { M.unlock(); M.play(it.synth); }
  };

  return (
    <div className="aska-catalog">
      <div className={`aska-cat-hero k-${kind}`}>
        <b>{k.emoji} {k.title}</b>
        <span>Реестр АСЬКИ: занеси {k.one} — запись станет твоей. Кто первый занёс, того и тапки. Каждая запись — блок в цепочке ⛓</span>
        <span className="row">
          {canAdd ? <button className="btn primary" onClick={() => setAdding(true)}>➕ Занести {k.one}</button>
            : <span className="aska-night-lock">🔒 Заносить — с уровня Голд, смотреть — всем.</span>}
          <button className="btn" onClick={onLedger}>⛓ Цепочка блоков</button>
        </span>
      </div>
      {player.playing && kind === 'music' && (
        <div className="aska-nowplay"><span className="cv cv-vinyl spin" style={{ ['--h' as string]: hue(player.trackId || '') }}><i /></span>
          <b>{window.AskaMusic?.TRACKS.find((t) => t.id === player.trackId)?.title || 'Играет'}</b>
          <span className="sp" /><button className="btn" onClick={() => window.AskaMusic?.pause()}>⏸</button></div>
      )}
      <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Найти: ${k.titleHint.toLowerCase()} или ${k.author.toLowerCase()}`} />
      {error && <div className="err">{error}</div>}
      <div className="aska-cat-list">
        {(items || []).map((it) => (
          <div key={it.id} className={`aska-cat-item k-${it.kind}`}>
            <Cover it={it} />
            <span className="ci">
              <b className="ci-title">{it.title}</b>
              <span className="ci-by">{it.author}{it.year ? ` · ${it.year}` : ''}</span>
              <span className="ci-tok"><code>{it.token}</code> · занёс(ла): <b>{it.addedByName}</b></span>
              <span className={`ci-rights r-${it.rights}`}>
                {it.rights === 'verified' ? `✓ Автор подтверждён: ${it.rightsByName}` : it.rights === 'claimed' ? `⏳ ${it.rightsByName} заявил(а) авторство — на согласовании` : it.rights === 'rejected' ? 'Авторство не подтверждено' : it.note || 'Авторство не заявлено'}
              </span>
              <span className="ci-hash">⛓ блок {it.block} · {it.hash.slice(0, 10)}…</span>
            </span>
            <span className="ca">
              {it.synth && <button className="btn icon" onClick={() => play(it)} aria-label="Играть">{player.trackId === it.synth && player.playing ? '⏸' : '▶'}</button>}
              {it.link && <a className="btn icon" href={it.link} target="_blank" rel="noopener noreferrer" aria-label="Открыть ссылку">🔗</a>}
              {canAdd && (it.rights === 'none' || it.rights === 'rejected') && it.addedBy === s.me?.userId && (
                <button className="btn" onClick={() => claimCatalog(it.id).then(() => load()).catch(() => {})}>Это моё</button>
              )}
            </span>
          </div>
        ))}
        {items && !items.length && <div className="hint">Пока пусто. {canAdd ? `Занеси первый ${k.one} — он будет твоим.` : ''}</div>}
      </div>
      {adding && <AddDialog kind={kind} onClose={() => setAdding(false)} onDone={() => { setAdding(false); load(); }} />}
    </div>
  );
}

function AddDialog({ kind, onClose, onDone }: { kind: CatalogKind; onClose: () => void; onDone: () => void }) {
  const k = KIND[kind];
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [year, setYear] = useState('');
  const [link, setLink] = useState('');
  const [note, setNote] = useState('');
  const [claim, setClaim] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !author.trim()) return setError('Нужны название и автор.');
    setBusy(true);
    setError('');
    try {
      await addCatalog({ kind, title: title.trim(), author: author.trim(), year: year ? Number(year) : null, link: link.trim(), note: note.trim(), claim });
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'exists') {
        const it = (err.data as { item?: CatalogItem } | undefined)?.item;
        setError(it ? `Уже занесено: ${it.token}, занёс(ла) ${it.addedByName}. Кто первый — того и тапки 🙂` : 'Это уже есть в реестре.');
      } else setError(err instanceof ApiError && err.code === 'bad_link' ? 'Ссылка должна начинаться с https://' : 'Не получилось занести. Проверь поля.');
      setBusy(false);
    }
  }
  return (
    <Dialog title={`${k.emoji} Занести ${k.one}`} onClose={onClose}>
      <form className="col" onSubmit={submit}>
        <label className="aska-field"><span className="lbl">{k.titleHint}</span><input className="field" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="aska-field"><span className="lbl">{k.author}</span><input className="field" value={author} maxLength={80} onChange={(e) => setAuthor(e.target.value)} placeholder={k.authorHint} /></label>
        <label className="aska-field"><span className="lbl">Год</span><input className="field" value={year} inputMode="numeric" maxLength={4} onChange={(e) => setYear(e.target.value.replace(/\D/g, ''))} /></label>
        <label className="aska-field"><span className="lbl">Ссылка (необязательно)</span><input className="field" value={link} maxLength={300} onChange={(e) => setLink(e.target.value)} placeholder="https://…" /></label>
        <label className="aska-field"><span className="lbl">Пара слов</span><input className="field" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} /></label>
        <label className="row aska-check"><input type="checkbox" checked={claim} onChange={(e) => setClaim(e.target.checked)} />
          <span>Это моё произведение — заявить авторство (галочку ставит администрация после согласования)</span></label>
        <div className="hint">Запись получит номер и блок в цепочке АСЬКИ, рядом будет «занёс(ла): ты». Файлы не загружаются — только сведения и ссылка.</div>
        {error && <div className="err">{error}</div>}
        <div className="row mt"><button type="button" className="btn" onClick={onClose}>Отмена</button><span className="sp" /><button className="btn primary" disabled={busy}>⛓ Занести в реестр</button></div>
      </form>
    </Dialog>
  );
}

const KIND_NAME: Record<string, string> = { 'catalog.add': '⛓ Занесено в реестр', 'catalog.rights': '✓ Авторство', 'nft.mint': '🎴 Выпущен НФТ', 'tier.black': '🖤 Новый Блэк' };

export function Ledger() {
  const [data, setData] = useState<{ blocks: Block[]; check: { ok: boolean; blocks: number; brokenAt?: number } } | null>(null);
  useEffect(() => { getLedger().then(setData).catch(() => {}); }, []);
  if (!data) return <div className="hint">Загружаю цепочку…</div>;
  return (
    <div className="aska-ledger">
      <div className={`aska-chain-ok${data.check.ok ? '' : ' bad'}`}>
        {data.check.ok ? `✓ Цепочка цела: ${data.check.blocks} блоков, каждый ссылается на хеш предыдущего` : `⚠ Цепочка сломана на блоке ${data.check.brokenAt}`}
      </div>
      <div className="hint">Внутренний блокчейн АСЬКИ: сюда записывается всё, что оцифровывается — музыка, кино, книги, авторство, НФТ, Блэк. Поменять старую запись незаметно нельзя: сломаются хеши всех следующих.</div>
      {data.blocks.map((b) => (
        <div key={b.block} className="aska-block">
          <span className="bn">#{b.block}</span>
          <span className="bk"><b>{KIND_NAME[b.kind] || b.kind}</b> <code>{b.ref}</code>{typeof b.data.title === 'string' ? ` · «${b.data.title}»` : ''}{typeof b.data.nick === 'string' ? ` · ${b.data.nick}` : ''}</span>
          <span className="bh">хеш {b.hash.slice(0, 12)}… ← {b.prevHash.slice(0, 8)}…</span>
        </div>
      ))}
    </div>
  );
}
