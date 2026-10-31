// Фото хранится на сервере зашифрованным: скачиваем, расшифровываем на телефоне, показываем.
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../lib/api.ts';
import { decryptFile } from '../lib/crypto.ts';
import type { ImageRef, VideoRef } from '../lib/protocol.ts';
import { blobUrl } from '../lib/wall.ts';

const urls = new Map<string, string>();
const loading = new Map<string, Promise<string>>();

// Фото и видео-квадратики: скачать шифр, расшифровать на телефоне, отдать ссылку blob:
export function load(image: ImageRef | VideoRef): Promise<string> {
  const hit = urls.get(image.blob);
  if (hit) return Promise.resolve(hit);
  let p = loading.get(image.blob);
  if (!p) {
    p = (async () => {
      const ct = await api.download(image.blob);
      const plain = decryptFile(ct, image.key, image.nonce, image.hash);
      if (!plain) throw new Error('decrypt');
      const url = blobUrl(new Blob([plain as BlobPart], { type: image.mime || 'image/jpeg' }));
      urls.set(image.blob, url);
      return url;
    })().finally(() => loading.delete(image.blob));
    loading.set(image.blob, p);
  }
  return p;
}

export function photoSize(w: number, h: number, maxW = 230, maxH = 300) {
  const scale = Math.min(maxW / w, maxH / h, 1);
  return { width: Math.max(120, Math.round(w * scale)), height: Math.max(80, Math.round(h * scale)) };
}

export function EncryptedImage({ image, local, onOpen }: { image: ImageRef; local?: string; onOpen: (url: string) => void }) {
  const [url, setUrl] = useState<string | null>(local || (image.blob ? urls.get(image.blob) || null : null));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (url || !image.blob) return;
    let alive = true;
    load(image).then((u) => alive && setUrl(u)).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [image.blob]); // eslint-disable-line react-hooks/exhaustive-deps

  const size = photoSize(image.w, image.h);
  return (
    <span className="aska-photo" style={size} onClick={(e) => { if (url) { e.stopPropagation(); onOpen(url); } }}>
      {url ? <img src={url} alt="" draggable={false} /> : image.thumb && <img className="thumb" src={image.thumb} alt="" />}
      {!url && !failed && <span className="spin" />}
      {failed && <span className="fail">Не удалось загрузить фото</span>}
    </span>
  );
}

// Просмотр фото во весь экран; снизу — кнопки (сохранить, на стену)
export function ImageViewer({ url, onClose, actions }: { url: string; onClose: () => void; actions?: ReactNode }) {
  return (
    <div className="aska-viewer" onClick={onClose}>
      <img src={url} alt="" />
      {actions ? <div className="aska-viewer-acts" onClick={(e) => e.stopPropagation()}>{actions}<button className="btn" onClick={onClose}>✕</button></div>
        : <div className="h">Нажми, чтобы закрыть · удерживай, чтобы сохранить</div>}
    </div>
  );
}
