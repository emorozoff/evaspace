// 💎 НФТ-галерея (тестовые механизмы UPASS): фото, видео, музыка и гифки — у каждого автор, совладельцы с долями
// и цена, которую назначает автор. Можно привязать вещь в реальном мире (кольцо, ожерелье…) с особым номером:
// она продаётся вместе с сертификатом НФТ. Галерею видят все в АСЬКЕ — это не личка.
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../useStore.ts';
import { ApiError } from '../lib/api.ts';
import { setCoins, refreshState } from '../lib/store.ts';
import type { GifSpec, Nft, NftFull, NftKind, MintBody } from '../lib/web3.ts';
import { NFT_KINDS, PHYSICAL, GIF_PRICE, nftList, nftGet, nftMint, nftBuy, nftPrice, nftPhysical, nftRemove, nftUpload, nftMediaUrl } from '../lib/web3.ts';
import { LiveGif } from './LiveGif.tsx';
import { Dialog } from './Win.tsx';

const ERR: Record<string, string> = {
  no_coins: 'Не хватает аськоинов.', not_for_sale: 'Уже не продаётся.', own: 'Это твой НФТ.', bad_share: 'Доли совладельцев — от 1 до 99%, автору должно остаться хотя бы 1%.',
  bad_coauthor: 'Совладельцы — только люди из АСЬКИ, без повторов.', serial_taken: 'Вещь с таким номером уже привязана к другому НФТ.', bad_serial: 'Номер вещи: буквы и цифры, 2–40 знаков.',
  bad_media: 'Файл не подошёл: нужны фото (JPEG, PNG, WebP, GIF), видео (MP4, MOV, WebM) или музыка (MP3, M4A, OGG, WAV, FLAC).', too_large: 'Файл слишком большой: фото до 8 МБ, музыка до 20 МБ, видео до 50 МБ.',
  bad_price: 'Цена — от 1 до 1 000 000 🪙.', bad_title: 'Название — до 80 знаков.', too_many: 'Сегодня выпущено много — продолжим завтра.', media_used: 'Этот файл уже выпущен как НФТ.', forbidden: 'Это может только владелец или автор.',
};
const errText = (e: unknown) => (e instanceof ApiError ? ERR[e.code] || 'Не получилось. Попробуй ещё раз.' : 'Нет связи. Попробуй ещё раз.');
const dt = (ts: number) => new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// Что внутри НФТ: гифка, фото, видео или музыка (файлы — с сервера, только для вошедших)
export function NftMedia({ n, big }: { n: Pick<Nft, 'kind' | 'spec' | 'media' | 'mime' | 'title'>; big?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (n.media && (big || n.kind === 'photo' || n.kind === 'gif')) nftMediaUrl(n.media).then((u) => alive && setUrl(u)).catch(() => {});
    return () => { alive = false; };
  }, [n.media, big, n.kind]);
  if (n.spec) return <LiveGif spec={n.spec} size={big ? 'l' : 'm'} />;
  if (n.kind === 'photo' || n.kind === 'gif') return <span className="nft-pic">{url ? <img src={url} alt={n.title} /> : <span className="spin" />}</span>;
  if (n.kind === 'video') return big && url ? <video className="nft-video" src={url} controls playsInline /> : <span className="nft-ph v">🎬<small>видео</small></span>;
  if (n.kind === 'music') return big && url ? <span className="nft-audio"><span className="nft-ph m">🎵</span><audio src={url} controls /></span> : <span className="nft-ph m">🎵<small>музыка</small></span>;
  return null;
}

function NftCard({ n, onOpen }: { n: Nft; onOpen: () => void }) {
  return (
    <button type="button" className="nft-card" onClick={onOpen}>
      <span className="nft-thumb"><NftMedia n={n} /></span>
      <span className="nft-meta">
        <b>{n.title}</b>
        <small>{NFT_KINDS[n.kind].icon} {n.token} · {n.authorName}{n.rights.length > 1 ? ` +${n.rights.length - 1}` : ''}</small>
        <span className="nft-price">{n.forSale ? `${n.price} 🪙` : 'не продаётся'}{n.physical ? ` · ${n.physical.label.split(' ')[0]}` : ''}</span>
      </span>
    </button>
  );
}

// Совладельцы: ближний круг — первыми; у каждого своя доля, автору — остаток
function CoauthorPick({ value, onChange }: { value: { userId: number; share: number }[]; onChange: (v: { userId: number; share: number }[]) => void }) {
  const s = useStore();
  const me = s.me!.userId;
  const people = useMemo(() => Object.values(s.users).filter((u) => (u.kind === 'human' || !u.kind) && u.id !== me)
    .sort((a, b) => Number(s.groups[b.id] === 'close') - Number(s.groups[a.id] === 'close') || a.displayName.localeCompare(b.displayName)), [s.users, s.groups, me]);
  const [open, setOpen] = useState(false);
  const left = 100 - value.reduce((n, c) => n + c.share, 0);
  return (
    <div className="nft-co">
      <div className="row aska-kv"><span>👑 Автор (ты)</span><b>{left}%</b></div>
      {value.map((c) => (
        <div key={c.userId} className="row aska-kv nft-co-row">
          <span>{s.users[c.userId]?.displayName || '?'}</span>
          <input className="field" type="number" min={1} max={99} value={c.share} aria-label="Доля, %"
            onChange={(e) => onChange(value.map((x) => (x.userId === c.userId ? { ...x, share: Math.max(1, Math.min(99, Math.floor(Number(e.target.value) || 1))) } : x)))} />
          <span>%</span>
          <button type="button" className="btn" onClick={() => onChange(value.filter((x) => x.userId !== c.userId))} aria-label="Убрать">×</button>
        </div>
      ))}
      {left < 1 && <div className="err">Автору должно остаться хотя бы 1%.</div>}
      {value.length < 5 && (open ? (
        <div className="nft-co-list">
          {people.filter((u) => !value.some((c) => c.userId === u.id)).map((u) => (
            <button type="button" key={u.id} className="chip" onClick={() => { onChange([...value, { userId: u.id, share: 10 }]); setOpen(false); }}>
              {s.groups[u.id] === 'close' ? '💛 ' : ''}{u.displayName}
            </button>
          ))}
        </div>
      ) : <button type="button" className="btn" onClick={() => setOpen(true)}>＋ Совладелец из ближнего круга</button>)}
      <div className="hint">Совладельцы — правообладатели и выгодоприобретатели: при продаже аськоины делятся по долям.</div>
    </div>
  );
}

function PhysicalPick({ value, onChange }: { value: { kind: string; serial: string; note: string } | null; onChange: (v: { kind: string; serial: string; note: string } | null) => void }) {
  return (
    <div className="nft-phys">
      <div className="nft-kinds">
        <button type="button" className={`chip${!value ? ' on' : ''}`} onClick={() => onChange(null)}>Без вещи</button>
        {Object.entries(PHYSICAL).map(([k, label]) => (
          <button type="button" key={k} className={`chip${value?.kind === k ? ' on' : ''}`} onClick={() => onChange({ kind: k, serial: value?.serial || '', note: value?.note || '' })}>{label}</button>
        ))}
      </div>
      {value && (
        <>
          <input className="field" value={value.serial} maxLength={40} onChange={(e) => onChange({ ...value, serial: e.target.value })} placeholder="Особый номер вещи, например AU-750-0001" />
          <input className="field" value={value.note} maxLength={200} onChange={(e) => onChange({ ...value, note: e.target.value })} placeholder="Что за вещь: металл, проба, гравировка…" />
          <div className="hint">Эксклюзивный экземпляр: вещь продаётся вместе с сертификатом НФТ. Номер у каждой вещи свой и записывается в цепочку блоков.</div>
        </>
      )}
    </div>
  );
}

// Выпустить НФТ: из файла (фото, видео, музыка, GIF) или из гифки по ТЗ
export function MintDialog({ file, spec, brief, title: title0, onClose, onDone }: {
  file?: File | Blob | null; spec?: GifSpec | null; brief?: string; title?: string; onClose: () => void; onDone: (n: Nft) => void;
}) {
  const [title, setTitle] = useState(title0 || '');
  const [about, setAbout] = useState('');
  const [price, setPrice] = useState(spec ? GIF_PRICE : 100);
  const [forSale, setForSale] = useState(true);
  const [co, setCo] = useState<{ userId: number; share: number }[]>([]);
  const [phys, setPhys] = useState<{ kind: string; serial: string; note: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ w?: number; h?: number; dur?: number }>({});
  const kind: NftKind | null = spec ? 'gif' : file ? (file.type === 'image/gif' ? 'gif' : file.type.startsWith('image/') ? 'photo' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'music' : null) : null;
  useEffect(() => {
    if (!file) return;
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  async function go() {
    if (!kind || !title.trim()) { setError('Дай название.'); return; }
    setBusy(true); setError('');
    try {
      const body: MintBody = { kind, title: title.trim(), about: about.trim(), price, forSale, coauthors: co, physical: phys && phys.serial.trim() ? { ...phys, serial: phys.serial.trim() } : null, ...meta };
      if (spec) { body.spec = spec; body.brief = brief || ''; } else if (file) body.media = (await nftUpload(file)).id;
      onDone(await nftMint(body));
    } catch (e) { setError(errText(e)); } finally { setBusy(false); }
  }

  return createPortal(
    <Dialog title="💎 Выпустить НФТ" onClose={onClose} buttons={<>
      <button className="btn" onClick={onClose}>Отмена</button>
      <button className="btn primary" disabled={busy || !kind} onClick={go}>{busy ? 'Выпускаю…' : 'Выпустить'}</button>
    </>}>
      <div className="nft-mint">
        <div className="nft-mint-prev">
          {spec ? <LiveGif spec={spec} size="m" />
            : kind === 'photo' || kind === 'gif' ? <img src={preview || ''} alt="" />
              : kind === 'video' ? <video src={preview || ''} playsInline muted controls onLoadedMetadata={(e) => setMeta({ w: e.currentTarget.videoWidth, h: e.currentTarget.videoHeight, dur: e.currentTarget.duration })} />
                : kind === 'music' ? <audio src={preview || ''} controls onLoadedMetadata={(e) => setMeta({ dur: e.currentTarget.duration })} /> : <span className="err">Такой файл не подходит.</span>}
        </div>
        <input className="field" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="Название воспоминания" />
        <textarea className="field" rows={2} value={about} maxLength={500} onChange={(e) => setAbout(e.target.value)} placeholder="История: где, когда, с кем (по желанию)" />
        <div className="row aska-kv"><span>Цена</span>
          <input className="field nft-price-in" type="number" min={1} max={1000000} value={price} onChange={(e) => setPrice(Math.max(1, Math.floor(Number(e.target.value) || 1)))} />
          <b>🪙 ≈ ${(price / 10).toFixed(2)}</b>
        </div>
        <label className="row aska-check"><input type="checkbox" checked={forSale} onChange={(e) => setForSale(e.target.checked)} /> Сразу выставить на продажу</label>
        <div className="legend-s">Правообладатели</div>
        <CoauthorPick value={co} onChange={setCo} />
        <div className="legend-s">Вещь в реальном мире</div>
        <PhysicalPick value={phys} onChange={setPhys} />
        <div className="hint">🔓 Галерею видят все в АСЬКЕ. Выпуск — блок в цепочке АСЬКИ (тестовые механизмы UPASS). Выпускай только своё: копирование чужого без письменного согласия авторов запрещено.</div>
        {error && <div className="err">{error}</div>}
      </div>
    </Dialog>,
    document.body,
  );
}

// Сертификат НФТ: токен, автор, правообладатели с долями, вещь с номером, история владельцев, блоки цепочки
function Certificate({ n }: { n: NftFull }) {
  const mint = n.blocks.find((b) => b.kind === 'nft.mint');
  return (
    <div className="nft-cert">
      <div className="nft-cert-head">
        <div className="nft-cert-orn">✦ СЕРТИФИКАТ НФТ ✦</div>
        <b>{n.title}</b>
        <span>{n.token} · {NFT_KINDS[n.kind].name}</span>
      </div>
      <dl>
        <dt>Автор</dt><dd>{n.authorName}</dd>
        <dt>Правообладатели</dt><dd>{n.rights.map((r) => `${r.name} — ${r.share}%`).join(', ')}</dd>
        <dt>Владелец</dt><dd>{n.ownerName}</dd>
        <dt>Выпущен</dt><dd>{dt(n.createdAt)}, блок №{n.block}</dd>
        {n.mediaHash && <><dt>Отпечаток файла</dt><dd className="mono">SHA-256 {n.mediaHash.slice(0, 16)}…{n.mediaHash.slice(-8)}</dd></>}
        {n.physical && <><dt>Вещь</dt><dd>{n.physical.label} № <b>{n.physical.serial}</b>{n.physical.note ? ` — ${n.physical.note}` : ''}. Эксклюзивный экземпляр: передаётся вместе с этим сертификатом.</dd></>}
        {mint && <><dt>Хеш блока</dt><dd className="mono">{mint.hash.slice(0, 20)}…</dd></>}
      </dl>
      {n.tradeList.length > 0 && (
        <div className="nft-cert-trades">
          <div className="legend-s">История владельцев</div>
          {n.tradeList.map((t, i) => <div key={i} className="row aska-kv"><span>{t.sellerName} → {t.buyerName}</span><b>{t.price} 🪙</b><small>{dt(t.at)}</small></div>)}
        </div>
      )}
      <div className="nft-cert-foot">Тестовые механизмы UPASS · цепочка АСЬКИ · {n.blocks.length} {n.blocks.length === 1 ? 'блок' : 'блоков'}</div>
    </div>
  );
}

function NftDetail({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const s = useStore();
  const [n, setN] = useState<NftFull | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [price, setPriceV] = useState(0);
  const [phys, setPhys] = useState<{ kind: string; serial: string; note: string } | null>(null);
  const load = () => nftGet(id).then((x) => { setN(x); setPriceV(x.price); }).catch((e) => setError(errText(e)));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (fn: () => Promise<unknown>) => { setBusy(true); setError(''); try { await fn(); await load(); onChanged(); } catch (e) { setError(errText(e)); } finally { setBusy(false); } };
  const coins = s.profile?.coins ?? 0;
  let actions: ReactNode = null;
  if (n) {
    if (!n.mine && n.forSale) {
      actions = <button className="btn primary" disabled={busy || coins < n.price} onClick={() => act(async () => { await nftBuy(n.id); await refreshState(); })}>
        Купить за {n.price} 🪙{coins < n.price ? ` (у тебя ${coins})` : ''}</button>;
    } else if (n.mine) {
      actions = (
        <div className="nft-own">
          <div className="row aska-kv"><span>Цена</span><input className="field nft-price-in" type="number" min={1} value={price} onChange={(e) => setPriceV(Math.max(1, Math.floor(Number(e.target.value) || 1)))} /><span>🪙</span></div>
          <div className="row">
            <button className="btn primary" disabled={busy} onClick={() => act(() => nftPrice(n.id, price, true))}>{n.forSale ? 'Обновить цену' : 'Выставить на продажу'}</button>
            {n.forSale && <button className="btn" disabled={busy} onClick={() => act(() => nftPrice(n.id, price, false))}>Снять с продажи</button>}
          </div>
          {n.iAmAuthor && !n.physical && n.trades === 0 && (
            <>
              <div className="legend-s">Привязать вещь</div>
              <PhysicalPick value={phys} onChange={setPhys} />
              {phys && <button className="btn" disabled={busy || !phys.serial.trim()} onClick={() => act(() => nftPhysical(n.id, { ...phys, serial: phys.serial.trim() }))}>Привязать {PHYSICAL[phys.kind]}</button>}
            </>
          )}
          {n.iAmAuthor && n.trades === 0 && <button className="btn" disabled={busy} onClick={() => { if (confirm('Убрать НФТ из галереи? Запись в цепочке останется.')) act(async () => { await nftRemove(n.id); onClose(); }); }}>🗑 Убрать из галереи</button>}
        </div>
      );
    }
  }
  return createPortal(
    <div className="overlay aska-story-ov aska-nft-ov" onClick={onClose}>
      <div className="aska-story-win" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="btn aska-story-close" onClick={onClose} aria-label="Закрыть">×</button>
        <div className="nft-detail">
          {!n ? <div className="hint">{error || 'Открываю…'}</div> : (
            <>
              <div className="nft-big"><NftMedia n={n} big /></div>
              <h2>{n.title}</h2>
              {n.about && <p className="nft-about">{n.about}</p>}
              {n.brief && <p className="hint">ТЗ: «{n.brief}»</p>}
              <div className="nft-price-big">{n.forSale ? `${n.price} 🪙 ≈ $${(n.price / 10).toFixed(2)}` : 'Не продаётся'}</div>
              {actions}
              {error && <div className="err">{error}</div>}
              <Certificate n={n} />
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

type Tab = 'all' | 'sale' | 'mine' | 'authored';
export function Gallery({ onGifMaker }: { onGifMaker: () => void }) {
  const s = useStore();
  const [tab, setTab] = useState<Tab>('all');
  const [kind, setKind] = useState<NftKind | ''>('');
  const [items, setItems] = useState<Nft[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const load = () => nftList({ kind: kind || undefined, sale: tab === 'sale', mine: tab === 'mine', authored: tab === 'authored' }).then(setItems).catch((e) => setError(errText(e)));
  useEffect(() => { setItems(null); load(); }, [tab, kind]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="aska-gallery">
      <div className="nft-hero">
        <div><b>💎 Галерея НФТ</b><small>У каждого воспоминания — автор, совладельцы и цена. Тестовые механизмы UPASS.</small></div>
        <span className="nft-coins">{s.profile?.coins ?? 0} 🪙</span>
      </div>
      <div className="nft-actions">
        <label className="btn primary nft-file">＋ Фото, видео, музыка
          <input type="file" accept="image/*,video/*,audio/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setFile(f); }} />
        </label>
        <button className="btn" onClick={onGifMaker}>🎞 Гифка по ТЗ</button>
      </div>
      <div className="tabs nft-tabs">
        {([['all', 'Все'], ['sale', 'На продаже'], ['mine', 'Мои'], ['authored', 'Я автор']] as [Tab, string][]).map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      <div className="nft-kinds">
        <button className={`chip${!kind ? ' on' : ''}`} onClick={() => setKind('')}>Всё</button>
        {(Object.keys(NFT_KINDS) as NftKind[]).map((k) => <button key={k} className={`chip${kind === k ? ' on' : ''}`} onClick={() => setKind(k)}>{NFT_KINDS[k].icon} {NFT_KINDS[k].name}</button>)}
      </div>
      {error && <div className="err">{error}</div>}
      {!items ? <div className="hint">Загружаю…</div> : !items.length ? <div className="hint nft-empty">Пока пусто. Выпусти первое воспоминание — фото, видео, музыку или гифку по ТЗ.</div> : (
        <div className="nft-grid">{items.map((n) => <NftCard key={n.id} n={n} onOpen={() => setOpen(n.id)} />)}</div>
      )}
      <div className="hint">🔓 Галерея открыта всем в АСЬКЕ. Вся интеллектуальная собственность защищена: копирование и распространение без письменного согласия авторов запрещено.</div>
      {open !== null && <NftDetail id={open} onClose={() => setOpen(null)} onChanged={load} />}
      {file && <MintDialog file={file} title={file.name.replace(/\.[^.]+$/, '').slice(0, 80)} onClose={() => setFile(null)} onDone={(n) => { setFile(null); setTab('mine'); setOpen(n.id); load(); setCoins(s.profile?.coins ?? 0); }} />}
    </div>
  );
}
