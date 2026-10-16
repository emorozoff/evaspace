// Фото перед отправкой: уменьшаем до 1600 px и делаем крошечное превью.
export interface PreparedImage { bytes: Uint8Array; w: number; h: number; mime: string; thumb: string }

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image'));
    img.src = src;
  });
}

function draw(img: HTMLImageElement, w: number, h: number) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

export async function prepareImage(file: File, max = 1600): Promise<PreparedImage> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = draw(img, w, h);
    const blob: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', 0.85));
    const ts = 24 / Math.max(w, h);
    const thumb = draw(img, Math.max(1, Math.round(w * ts)), Math.max(1, Math.round(h * ts))).toDataURL('image/jpeg', 0.5);
    return { bytes: new Uint8Array(await blob.arrayBuffer()), w, h, mime: 'image/jpeg', thumb };
  } finally {
    URL.revokeObjectURL(url);
  }
}
